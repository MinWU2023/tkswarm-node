const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const { z } = require('zod');
const { db } = require('../db');
const { ok, fail } = require('../http');
const { BitBrowserProvider } = require('../services/browser/bit-browser-provider');
const { inspectTikTokSession } = require('../services/browser/cdp-client');
const { loginAssist, closeSession } = require('../services/browser/tiktok-login');
const { syncProfile, getProfile, syncVideos, getVideos, getStats } = require('../services/browser/tiktok-data');
const { preparePublish, prepareMessage } = require('../services/browser/tiktok-actions');

const router = express.Router();

const languageByCountry = {
  CN: 'zh-CN', TW: 'zh-TW', HK: 'zh-HK', US: 'en-US', GB: 'en-GB', CA: 'en-CA', AU: 'en-AU',
  JP: 'ja-JP', KR: 'ko-KR', DE: 'de-DE', FR: 'fr-FR', ES: 'es-ES', IT: 'it-IT', BR: 'pt-BR',
  PT: 'pt-PT', RU: 'ru-RU', TH: 'th-TH', VN: 'vi-VN', ID: 'id-ID', MY: 'ms-MY', PH: 'en-PH',
};

function accountWithProxy(accountId) {
  return db.prepare(`SELECT a.*, p.protocol proxy_protocol, p.host proxy_host, p.port proxy_port,
    p.username proxy_username, p.password proxy_password, p.status proxy_status
    FROM accounts a LEFT JOIN proxies p ON p.id=a.proxy_id WHERE a.id=?`).get(accountId);
}

async function createProfileForAccount(provider, account) {
  if (!account) throw new Error('账号不存在');
  if (account.browser_profile_id) throw new Error('账号已经绑定浏览器环境');
  const proxy = account.proxy_host ? {
    protocol: account.proxy_protocol,
    host: account.proxy_host,
    port: account.proxy_port,
    username: account.proxy_username,
    password: account.proxy_password,
  } : null;
  const country = String(account.country || '').toUpperCase();
  const profile = await provider.create({
    name: `TK-${account.username}`.slice(0, 100),
    username: account.username,
    remark: `TkSwarm account #${account.id}`,
    proxy,
    language: languageByCountry[country] || 'en-US',
  });
  try {
    const update = db.prepare(`UPDATE accounts SET browser_type='bit', browser_profile_id=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND browser_profile_id=''`).run(profile.id, account.id);
    if (!update.changes) throw new Error('保存环境绑定失败，账号可能已被其他任务处理');
  } catch (error) {
    try { await provider.delete(profile.id); } catch { /* best-effort compensation */ }
    throw error;
  }
  return { accountId: account.id, username: account.username, profileId: profile.id, profileName: profile.name };
}

router.get('/accounts/:accountId/diagnostics', (req,res)=>{const dir=path.resolve(__dirname,'../data/automation');const marker=`account-${Number(req.params.accountId)}-`;const files=fs.existsSync(dir)?fs.readdirSync(dir).filter(name=>name.includes(marker)).sort().reverse().slice(0,100):[];return ok(res,files.map(name=>({name,download:`/api/browser/diagnostics/${encodeURIComponent(name)}`})));});
router.get('/diagnostics/:name', (req,res)=>{const name=path.basename(req.params.name);if(!/^\\d+-account-\\d+-(publish|message)-[a-z]+\\.png$/.test(name))return fail(res,'诊断文件无效',400);const file=path.resolve(__dirname,'../data/automation',name);if(!fs.existsSync(file))return fail(res,'诊断文件不存在',404);return res.sendFile(file);});

router.post('/accounts/:accountId/message-prepare', async (req,res)=>{try{const content=String(req.body?.content||'').trim();if(!content)return fail(res,'消息内容不能为空',400);const result=await prepareMessage(Number(req.params.accountId),content,String(req.body?.recipient||''));return ok(res,result,result.status==='security_paused'?'检测到安全验证，任务已暂停':'消息已准备，等待人工确认');}catch(error){req.log?.error?.({accountId:req.params.accountId,error:error.message},'message preparation failed');return fail(res,error.message,422);}});

router.post('/accounts/:accountId/publish-prepare', async (req,res)=>{try{const accountId=Number(req.params.accountId);const materialId=Number(req.body?.materialId);if(!Number.isInteger(materialId)||materialId<1)return fail(res,'请选择素材',400);const result=await preparePublish(accountId,materialId,String(req.body?.title||''),String(req.body?.caption||''));return ok(res,result,result.status==='security_paused'?'检测到安全验证，任务已暂停':'发布内容已准备，等待人工确认');}catch(error){req.log?.error?.({accountId:req.params.accountId,error:error.message},'publish preparation failed');return fail(res,error.message,422);}});

router.get('/status', async (req, res) => {
  const provider = new BitBrowserProvider();
  try {
    const message = await provider.health();
    return ok(res, { online: true, provider: 'bit', apiUrl: provider.baseUrl, message });
  } catch (error) {
    return ok(res, { online: false, provider: 'bit', apiUrl: provider.baseUrl, message: error.message });
  }
});

router.get('/groups', async (req, res) => {
  const provider = new BitBrowserProvider();
  const data = await provider.groups(Number(req.query.page || 0), Math.min(100, Number(req.query.pageSize || 100)));
  return ok(res, data);
});

router.get('/profiles', async (req, res) => {
  const provider = new BitBrowserProvider();
  const data = await provider.profiles(Number(req.query.page || 0), Math.min(100, Number(req.query.pageSize || 100)), String(req.query.keyword || ''));
  const bindings = new Map(db.prepare(`SELECT browser_profile_id, id, username, nickname FROM accounts
    WHERE browser_type='bit' AND browser_profile_id <> ''`).all().map(row => [row.browser_profile_id, row]));
  const list = (data.list || []).map(profile => ({ ...provider.sanitizeProfile(profile), account: bindings.get(profile.id) || null }));
  return ok(res, { page: data.page, pageSize: data.pageSize, total: data.totalNum ?? list.length, items: list });
});

router.post('/profiles/:id/open', async (req, res) => {
  const provider = new BitBrowserProvider();
  const data = await provider.open(req.params.id);
  const safe = data && typeof data === 'object' ? {
    ws: data.ws,
    http: data.http,
    pid: data.pid,
    name: data.name,
    seq: data.seq,
    coreVersion: data.coreVersion,
  } : data;
  return ok(res, safe, '浏览器环境已打开');
});

router.post('/profiles/:id/close', async (req, res) => {
  const provider = new BitBrowserProvider();
  const data = await provider.close(req.params.id);
  return ok(res, data, '浏览器环境已关闭');
});

router.post('/profiles/:id/tiktok-status', async (req, res) => {
  const provider = new BitBrowserProvider();
  // Keep the environment open while login is incomplete so the user can
  // continue credential, 2FA, or CAPTCHA handling. Once a valid TikTok session
  // is confirmed, close the account's bound environment as requested.
  const connection = await provider.open(req.params.id);
  if (!connection?.ws) throw new Error('比特浏览器未返回 CDP WebSocket 地址');
  const status = await inspectTikTokSession(connection.ws);
  const account = db.prepare("SELECT id, username FROM accounts WHERE browser_type='bit' AND browser_profile_id=?").get(req.params.id);
  if (account) {
    db.prepare('UPDATE accounts SET login_status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(status.loggedIn ? 'online' : 'offline', account.id);
  }
  let browserClosed = false;
  if (status.loggedIn) {
    await provider.close(req.params.id);
    browserClosed = true;
  }
  return ok(res, { ...status, account: account || null, browserClosed }, status.loggedIn ? 'TikTok 登录状态有效，已关闭当前账号绑定的浏览器' : '未检测到有效 TikTok 登录会话，浏览器保持打开');
});

router.get('/accounts/:accountId/tiktok-profile', (req, res) => {
  return ok(res, getProfile(req.params.accountId));
});

router.post('/accounts/:accountId/sync-profile', async (req, res) => {
  try {
    const result = await syncProfile(req.params.accountId);
    return ok(res, result, 'TikTok 资料同步完成');
  } catch (error) {
    req.log.error({ accountId: req.params.accountId, error: error.message }, 'TikTok profile sync failed');
    return fail(res, error.message, 422);
  }
});

router.get('/accounts/:accountId/tiktok-videos', (req, res) => ok(res, getVideos(req.params.accountId)));
router.get('/accounts/:accountId/tiktok-stats', (req, res) => ok(res, getStats(req.params.accountId)));

router.post('/accounts/:accountId/sync-videos', async (req, res) => {
  try {
    const result = await syncVideos(req.params.accountId, req.body?.limit);
    return ok(res, result, `TikTok 视频同步完成：${result.count} 条`);
  } catch (error) {
    req.log.error({ accountId: req.params.accountId, error: error.message }, 'TikTok video sync failed');
    return fail(res, error.message, 422);
  }
});

router.post('/accounts/:accountId/login-assist', async (req, res) => {
  const body = z.object({ autoSubmit: z.boolean().default(false), submitAfterTotp: z.boolean().default(true) }).parse(req.body || {});
  try {
    const result = await loginAssist(req.params.accountId, body);
    return ok(res, result, result.message);
  } catch (error) {
    db.prepare("UPDATE accounts SET login_status='offline', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(req.params.accountId);
    req.log.error({ accountId: req.params.accountId, error: error.message }, 'TikTok login assist failed');
    return fail(res, error.message || '登录辅助失败', 422);
  }
});

router.post('/profiles/:id/session-close', async (req, res) => {
  await closeSession(req.params.id);
  return ok(res, null, '登录辅助会话已关闭');
});

router.post('/profiles/batch-delete', async (req, res) => {
  const body = z.object({ profileIds: z.array(z.string().trim().min(1).max(150)).min(1).max(500) }).parse(req.body);
  const profileIds = [...new Set(body.profileIds)];
  const provider = new BitBrowserProvider();
  const result = { requested: profileIds.length, deleted: 0, blocked: 0, failed: 0, errors: [] };
  for (const profileId of profileIds) {
    const binding = db.prepare("SELECT id, username FROM accounts WHERE browser_type='bit' AND browser_profile_id=?").get(profileId);
    if (binding) {
      result.blocked += 1;
      result.errors.push({ profileId, reason: `仍绑定账号 ${binding.username}，请先解绑` });
      continue;
    }
    try {
      await provider.delete(profileId);
      result.deleted += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push({ profileId, reason: error.message });
    }
  }
  return ok(res, result, `批量删除完成：成功 ${result.deleted}，阻止 ${result.blocked}，失败 ${result.failed}`);
});

router.delete('/profiles/:id', async (req, res) => {
  const binding = db.prepare("SELECT id, username FROM accounts WHERE browser_type='bit' AND browser_profile_id=?").get(req.params.id);
  if (binding) return fail(res, `环境仍绑定账号 ${binding.username}，请先解绑`, 409);
  const provider = new BitBrowserProvider();
  const data = await provider.delete(req.params.id);
  return ok(res, data, '浏览器环境已删除');
});

router.post('/accounts/:accountId/create', async (req, res) => {
  const provider = new BitBrowserProvider();
  const result = await createProfileForAccount(provider, accountWithProxy(req.params.accountId));
  return ok(res, result, '浏览器环境已创建并绑定', 201);
});

router.post('/accounts/batch-create', async (req, res) => {
  const body = z.object({
    accountIds: z.array(z.coerce.number().int().positive()).max(200).optional(),
    groupId: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
    requireProxy: z.boolean().default(false),
  }).parse(req.body);
  const filters = ["a.browser_profile_id=''", "a.enabled=1"];
  const params = {};
  if (body.accountIds?.length) {
    filters.push(`a.id IN (${body.accountIds.map(() => '?').join(',')})`);
  } else if (body.groupId) {
    filters.push('a.group_id=?');
  }
  if (body.requireProxy) filters.push('a.proxy_id IS NOT NULL');
  const values = body.accountIds?.length ? body.accountIds : body.groupId ? [body.groupId] : [];
  const accounts = db.prepare(`SELECT a.id FROM accounts a WHERE ${filters.join(' AND ')} ORDER BY a.id LIMIT 200`).all(...values);
  if (!accounts.length) return fail(res, '没有符合条件的未绑定账号', 422);

  const provider = new BitBrowserProvider();
  const result = { total: accounts.length, created: 0, failed: 0, items: [], errors: [] };
  for (const row of accounts) {
    try {
      const item = await createProfileForAccount(provider, accountWithProxy(row.id));
      result.created += 1;
      result.items.push(item);
    } catch (error) {
      result.failed += 1;
      result.errors.push({ accountId: row.id, reason: error.message });
    }
  }
  return ok(res, result, `批量创建完成：成功 ${result.created}，失败 ${result.failed}`);
});

router.post('/bind', (req, res) => {
  const body = z.object({
    accountId: z.coerce.number().int().positive(),
    profileId: z.string().trim().min(1).max(100),
  }).parse(req.body);
  const occupied = db.prepare(`SELECT id, username FROM accounts WHERE browser_type='bit' AND browser_profile_id=? AND id<>?`)
    .get(body.profileId, body.accountId);
  if (occupied) return fail(res, `该环境已绑定账号 ${occupied.username}`, 409);
  const result = db.prepare(`UPDATE accounts SET browser_type='bit', browser_profile_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(body.profileId, body.accountId);
  if (!result.changes) return fail(res, '账号不存在', 404);
  return ok(res, null, '浏览器环境已绑定');
});

router.post('/unbind', (req, res) => {
  const body = z.object({ accountId: z.coerce.number().int().positive() }).parse(req.body);
  const result = db.prepare("UPDATE accounts SET browser_profile_id='', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(body.accountId);
  if (!result.changes) return fail(res, '账号不存在', 404);
  return ok(res, null, '已解除浏览器环境绑定');
});

module.exports = router;
