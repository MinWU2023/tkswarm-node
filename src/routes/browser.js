/**
 * 本机比特浏览器能力路由：CDP / 环境操作在本地，账号数据一律 PHP API。
 */
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const { z } = require('zod');
const { ok, fail } = require('../http');
const { BitBrowserProvider } = require('../services/browser/bit-browser-provider');
const { getProvider, listProviders } = require('../services/browser/providers');
const { inspectTikTokSession } = require('../services/browser/cdp-client');
const { loginAssist, closeSession } = require('../services/browser/tiktok-login');
const { syncProfile, getProfile, syncVideos, getVideos, getStats } = require('../services/browser/tiktok-data');
const { preparePublish, prepareMessage } = require('../services/browser/tiktok-actions');
const { createQrSession, checkQrSession, closeQrSession } = require('../services/browser/qr-login');
const { assertPublishGate } = require('../services/account-gates');
const dataStore = require('../services/data-store');
const phpApi = require('../services/php-api');
const { probeProxyObject } = require('../services/proxy-probe');

const router = express.Router();

const languageByCountry = {
  CN: 'zh-CN', TW: 'zh-TW', HK: 'zh-HK', US: 'en-US', GB: 'en-GB', CA: 'en-CA', AU: 'en-AU',
  JP: 'ja-JP', KR: 'ko-KR', DE: 'de-DE', FR: 'fr-FR', ES: 'es-ES', IT: 'it-IT', BR: 'pt-BR',
  PT: 'pt-PT', RU: 'ru-RU', TH: 'th-TH', VN: 'vi-VN', ID: 'id-ID', MY: 'ms-MY', PH: 'en-PH',
};

async function loadAccount(accountId) {
  const account = await dataStore.getAccountBundle(accountId);
  if (!account) throw Object.assign(new Error('账号不存在'), { status: 404 });
  return account;
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
  const country = String(account.country || account.proxy_country || '').toUpperCase();
  const profile = await provider.create({
    name: `TK-${account.username}`.slice(0, 100),
    username: account.username,
    remark: `TkSwarm account #${account.id}`,
    proxy,
    language: languageByCountry[country] || 'en-US',
  });
  try {
    await dataStore.updateBrowserBinding(account.id, profile.id, false);
  } catch (error) {
    try { await provider.delete(profile.id); } catch { /* best-effort */ }
    throw error;
  }
  return { accountId: account.id, username: account.username, profileId: profile.id, profileName: profile.name };
}

router.get('/accounts/:accountId/diagnostics', (req, res) => {
  const dir = path.resolve(__dirname, '../data/automation');
  const marker = `account-${Number(req.params.accountId)}-`;
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.includes(marker)).sort().reverse().slice(0, 100) : [];
  return ok(res, files.map((name) => ({ name, download: `/api/browser/diagnostics/${encodeURIComponent(name)}` })));
});

router.get('/diagnostics/:name', (req, res) => {
  const name = path.basename(req.params.name);
  if (!/^\d+[-a-zA-Z0-9_.]+\.png$/.test(name)) return fail(res, '诊断文件无效', 400);
  const file = path.resolve(__dirname, '../data/automation', name);
  if (!fs.existsSync(file)) return fail(res, '诊断文件不存在', 404);
  return res.sendFile(file);
});

router.post('/accounts/:accountId/message-prepare', async (req, res) => {
  try {
    const content = String(req.body?.content || '').trim();
    if (!content) return fail(res, '消息内容不能为空', 400);
    const result = await prepareMessage(Number(req.params.accountId), content, String(req.body?.recipient || ''));
    return ok(res, result, result.status === 'security_paused' ? '检测到安全验证，任务已暂停' : '消息已准备，等待人工确认');
  } catch (error) {
    return fail(res, error.message, 422);
  }
});

router.post('/accounts/:accountId/publish-prepare', async (req, res) => {
  try {
    const accountId = Number(req.params.accountId);
    const materialId = Number(req.body?.materialId);
    if (!Number.isInteger(materialId) || materialId < 1) return fail(res, '请选择素材', 400);
    await assertPublishGate(accountId, String(req.body?.channel || 'bit'));
    const result = await preparePublish(accountId, materialId, String(req.body?.title || ''), String(req.body?.caption || ''));
    return ok(res, result, result.status === 'security_paused' ? '检测到安全验证，任务已暂停' : '发布内容已准备，等待人工确认');
  } catch (error) {
    return fail(res, error.message, 422);
  }
});

router.post('/qr-sessions', async (req, res) => {
  try {
    const body = z.object({
      groupId: z.union([z.coerce.number().int().positive(), z.null()]).optional().default(null),
      proxyId: z.union([z.coerce.number().int().positive(), z.null()]).optional().default(null),
      accountId: z.union([z.coerce.number().int().positive(), z.null()]).optional().default(null),
    }).parse(req.body || {});
    return ok(res, await createQrSession(body), '扫码会话已创建', 201);
  } catch (error) {
    return fail(res, error.message || '创建扫码会话失败', 422);
  }
});

router.get('/qr-sessions/:id', async (req, res) => {
  try {
    return ok(res, await checkQrSession(req.params.id));
  } catch (error) {
    return fail(res, error.message || '查询扫码状态失败', 422);
  }
});

router.delete('/qr-sessions/:id', async (req, res) => {
  await closeQrSession(req.params.id);
  return ok(res, null, '扫码会话已关闭');
});

router.post('/accounts/:accountId/capcut-authorize', async (req, res) => {
  try {
    const data = await phpApi.post(`/accounts/${req.params.accountId}/capcut-authorize`, {});
    return ok(res, data, '已标记 CapCut 授权（需在浏览器中完成实际授权流程）');
  } catch (error) {
    return fail(res, error.message, error.status || 422);
  }
});

router.post('/accounts/:accountId/capcut-revoke', async (req, res) => {
  try {
    await phpApi.post(`/accounts/${req.params.accountId}/capcut-revoke`, {});
    return ok(res, null, '已取消 CapCut 授权标记');
  } catch (error) {
    return fail(res, error.message, error.status || 422);
  }
});

router.post('/accounts/batch-calibrate-country', async (req, res) => {
  try {
    const body = z.object({ accountIds: z.array(z.coerce.number().int().positive()).min(1).max(500) }).parse(req.body || {});
    const data = await phpApi.post('/accounts/batch-calibrate-country', body);
    return ok(res, data, data?.updated ? `已校准 ${data.updated} 个账号国家` : '没有可校准的账号');
  } catch (error) {
    return fail(res, error.message, error.status || 422);
  }
});

router.post('/accounts/batch-modify-profile', async (req, res) => {
  const body = z.object({
    accountIds: z.array(z.coerce.number().int().positive()).min(1).max(50),
    mode: z.enum(['platform', 'local']).default('platform'),
    nickname: z.string().trim().max(100).optional().default(''),
    notes: z.string().trim().max(500).optional().default(''),
    country: z.string().trim().max(50).optional().default(''),
    modifyNickname: z.boolean().optional().default(false),
    nicknameList: z.string().max(20_000).optional().default(''),
    modifySignature: z.boolean().optional().default(false),
    signatureList: z.string().max(50_000).optional().default(''),
    modifyAvatar: z.boolean().optional().default(false),
    avatarFolder: z.string().trim().max(500).optional().default(''),
    distributionStrategy: z.enum(['sequential', 'random']).default('sequential'),
    threads: z.coerce.number().int().min(1).max(5).default(1),
  }).parse(req.body || {});

  if (body.mode === 'local') {
    let updated = 0;
    for (const id of body.accountIds) {
      try {
        if (body.nickname) await phpApi.patch(`/accounts/${id}/nickname`, { nickname: body.nickname });
        if (body.notes) await phpApi.patch(`/accounts/${id}/notes`, { notes: body.notes });
        if (body.country) {
          const cur = await phpApi.get(`/accounts/${id}`);
          await phpApi.put(`/accounts/${id}`, {
            username: cur.username,
            nickname: cur.nickname || '',
            country: body.country,
            groupId: cur.group_id ?? cur.groupId ?? null,
            proxyId: cur.proxy_id ?? cur.proxyId ?? null,
            browserType: cur.browser_type || cur.browserType || 'bit',
            browserProfileId: cur.browser_profile_id || cur.browserProfileId || '',
            loginStatus: cur.login_status || cur.loginStatus || 'offline',
            chatStatus: cur.chat_status || cur.chatStatus || 'offline',
            dmChannel: cur.dm_channel || cur.dmChannel || 'auto',
            enabled: cur.enabled !== 0 && cur.enabled !== false,
            notes: cur.notes || '',
          });
        }
        if (body.nickname || body.notes || body.country) updated += 1;
      } catch { /* skip missing */ }
    }
    return ok(res, { updated, mode: 'local' }, `已更新本地字段 ${updated} 个账号`);
  }

  try {
    const { batchModifyTikTokProfiles } = require('../services/browser/tiktok-actions');
    const result = await batchModifyTikTokProfiles(body.accountIds, body);
    return ok(res, { ...result, mode: 'platform' }, `平台改资料完成：成功 ${result.success}，失败 ${result.failed}`);
  } catch (error) {
    return fail(res, error.message || '批量修改资料失败', 422);
  }
});

router.post('/accounts/batch-delete-videos', async (req, res) => {
  const body = z.object({
    accountIds: z.array(z.coerce.number().int().positive()).min(1).max(50),
    keepLatest: z.coerce.number().int().min(0).max(100).default(0),
    mode: z.enum(['platform', 'local']).default('platform'),
    threads: z.coerce.number().int().min(1).max(3).default(1),
  }).parse(req.body || {});

  if (body.mode === 'local') {
    let deleted = 0;
    for (const accountId of body.accountIds) {
      try {
        const videos = await phpApi.get(`/accounts/${accountId}/tiktok-videos`) || [];
        const list = Array.isArray(videos) ? videos : (videos.items || []);
        const remove = list.slice(body.keepLatest);
        for (const video of remove) {
          await phpApi.post(`/node/accounts/${accountId}/tiktok-videos/delete`, {
            videoId: video.video_id || video.videoId,
            videoUrl: video.video_url || video.videoUrl,
          });
          deleted += 1;
        }
      } catch { /* skip */ }
    }
    return ok(res, { deleted, mode: 'local' }, `已从中心库删除 ${deleted} 条视频记录（未操作平台）`);
  }

  try {
    const { batchDeleteTikTokVideos } = require('../services/browser/tiktok-actions');
    const result = await batchDeleteTikTokVideos(body.accountIds, body);
    return ok(res, { ...result, mode: 'platform' }, `平台删视频完成：成功 ${result.success}，失败 ${result.failed}`);
  } catch (error) {
    return fail(res, error.message || '批量删除视频失败', 422);
  }
});

router.post('/accounts/:accountId/delete-video', async (req, res) => {
  const body = z.object({
    videoId: z.string().trim().min(1).max(80).optional(),
    videoUrl: z.string().trim().max(500).optional().default(''),
    localOnly: z.boolean().optional().default(false),
  }).parse(req.body || {});
  const accountId = Number(req.params.accountId);
  try {
    await loadAccount(accountId);
  } catch (e) {
    return fail(res, e.message, e.status || 404);
  }
  if (!body.videoId && !body.videoUrl) return fail(res, '请提供 videoId 或 videoUrl', 400);

  if (body.localOnly) {
    await phpApi.post(`/node/accounts/${accountId}/tiktok-videos/delete`, body);
    return ok(res, { mode: 'local' }, '已删除本地视频记录');
  }

  try {
    const { deleteTikTokVideo } = require('../services/browser/tiktok-actions');
    const result = await deleteTikTokVideo(accountId, body);
    if (result.status !== 'ok') return fail(res, result.error || '删除失败', 422, result);
    return ok(res, result, '平台视频已删除');
  } catch (error) {
    return fail(res, error.message || '删除视频失败', 422);
  }
});

router.post('/accounts/:accountId/modify-profile', async (req, res) => {
  const body = z.object({
    nickname: z.string().trim().max(100).optional().default(''),
    signature: z.string().trim().max(300).optional().default(''),
    avatarPath: z.string().trim().max(500).optional().default(''),
  }).parse(req.body || {});
  try {
    const { modifyTikTokProfile } = require('../services/browser/tiktok-actions');
    const result = await modifyTikTokProfile(Number(req.params.accountId), body);
    if (result.status !== 'ok') return fail(res, result.error || '修改失败', 422, result);
    return ok(res, result, '平台资料已修改');
  } catch (error) {
    return fail(res, error.message || '修改资料失败', 422);
  }
});

router.post('/accounts/batch-check-ip', async (req, res) => {
  const body = z.object({ accountIds: z.array(z.coerce.number().int().positive()).min(1).max(200) }).parse(req.body || {});
  const items = [];
  for (const id of body.accountIds) {
    let account;
    try {
      account = await loadAccount(id);
    } catch {
      items.push({ accountId: id, ok: false, reason: '账号不存在' });
      continue;
    }
    if (!account.proxy_host && !account.proxy_id) {
      items.push({ accountId: id, ok: false, reason: '未绑定代理' });
      continue;
    }
    try {
      const proxy = {
        id: account.proxy_id,
        protocol: account.proxy_protocol || 'http',
        host: account.proxy_host,
        port: account.proxy_port,
        username: account.proxy_username,
        password: account.proxy_password,
      };
      const result = await probeProxyObject(proxy);
      if (account.proxy_id) {
        await phpApi.post(`/node/proxies/${account.proxy_id}/probe-result`, result).catch(() => {});
      }
      items.push({ accountId: id, username: account.username, ...result });
    } catch (error) {
      items.push({ accountId: id, ok: false, reason: error.message });
    }
  }
  return ok(res, { items, available: items.filter((x) => x.available).length }, '批量 IP 检测完成');
});

router.get('/accounts/:accountId/session', async (req, res) => {
  try {
    const data = await phpApi.get(`/accounts/${req.params.accountId}/session`);
    return ok(res, data);
  } catch (error) {
    return fail(res, error.message, error.status || 404);
  }
});

router.put('/accounts/:accountId/session', async (req, res) => {
  try {
    const body = z.object({
      cookie: z.string().trim().min(1).max(100000),
      fingerprint: z.string().trim().max(2000).optional().default(''),
    }).parse(req.body || {});
    const data = await dataStore.saveSession(Number(req.params.accountId), body);
    return ok(res, data || { accountId: Number(req.params.accountId), hasSession: true }, '会话 CK 已加密保存');
  } catch (error) {
    return fail(res, error.message, error.status || 422);
  }
});

router.post('/accounts/batch-fingerprint', async (req, res) => {
  const body = z.object({
    accountIds: z.array(z.coerce.number().int().positive()).max(500).optional(),
    groupId: z.coerce.number().int().positive().optional(),
  }).parse(req.body || {});

  let rows = [];
  if (body.accountIds?.length) {
    for (const id of [...new Set(body.accountIds)]) {
      try {
        const a = await loadAccount(id);
        rows.push({
          id: a.id,
          username: a.username,
          fingerprint: a.fingerprint || '',
          browser_profile_id: a.browser_profile_id,
          session_fingerprint: a.session_fingerprint || '',
        });
      } catch { /* skip */ }
    }
  } else if (body.groupId) {
    const page = await phpApi.get(`/accounts?page=1&pageSize=500&groupId=${body.groupId}`);
    rows = (page?.items || []).map((a) => ({
      id: a.id,
      username: a.username,
      fingerprint: a.fingerprint || '',
      browser_profile_id: a.browser_profile_id,
      session_fingerprint: '',
    }));
  } else {
    return fail(res, '请选择账号或分组', 400);
  }

  const provider = new BitBrowserProvider();
  const items = [];
  let harvested = 0;
  for (const row of rows) {
    let fingerprint = row.session_fingerprint || row.fingerprint || '';
    if (!fingerprint && row.browser_profile_id) {
      try {
        const detail = await provider.detail(row.browser_profile_id);
        const raw = detail?.fingerprint || detail?.browserFingerPrint || detail?.ua || detail?.userAgent || '';
        fingerprint = typeof raw === 'string' ? raw : (raw ? JSON.stringify(raw) : '');
        fingerprint = String(fingerprint || '').slice(0, 800);
        if (fingerprint) {
          await dataStore.saveFingerprint(row.id, fingerprint);
          harvested += 1;
        }
      } catch { /* keep empty */ }
    }
    items.push({ accountId: row.id, username: row.username, fingerprint });
  }
  return ok(res, { items, withFingerprint: items.filter((item) => item.fingerprint).length, harvested }, '指纹提取完成');
});

router.post('/accounts/batch-login', async (req, res) => {
  const body = z.object({
    accountIds: z.array(z.coerce.number().int().positive()).max(20).optional(),
    groupId: z.coerce.number().int().positive().optional(),
  }).parse(req.body || {});
  let ids = body.accountIds?.length ? [...new Set(body.accountIds)] : [];
  if (!ids.length && body.groupId) {
    const page = await phpApi.get(`/accounts?page=1&pageSize=50&groupId=${body.groupId}`);
    ids = (page?.items || [])
      .filter((a) => a.enabled !== 0 && a.browser_profile_id)
      .map((a) => Number(a.id))
      .slice(0, 5);
  }
  ids = ids.slice(0, 5);
  if (!ids.length) return fail(res, '没有已绑定浏览器环境的账号', 400);
  const items = [];
  for (const id of ids) {
    let account;
    try {
      account = await loadAccount(id);
    } catch {
      items.push({ accountId: id, ok: false, reason: '账号不存在' });
      continue;
    }
    if (!account.browser_profile_id) {
      items.push({ accountId: id, username: account.username, ok: false, reason: '未绑定浏览器环境' });
      continue;
    }
    try {
      const result = await loginAssist(id, { autoSubmit: false, submitAfterTotp: false });
      items.push({ accountId: id, username: account.username, ok: true, status: result?.status || 'prepared' });
    } catch (error) {
      items.push({ accountId: id, username: account.username, ok: false, reason: error.message });
    }
  }
  const prepared = items.filter((item) => item.ok).length;
  return ok(res, { items, prepared, failed: items.length - prepared }, `登录辅助完成：成功 ${prepared}，失败 ${items.length - prepared}`);
});

router.post('/accounts/:accountId/socks', async (req, res) => {
  try {
    const body = z.object({
      host: z.string().trim().min(1).max(200),
      port: z.coerce.number().int().min(1).max(65535),
      username: z.string().trim().max(200).optional().default(''),
      password: z.string().max(200).optional().default(''),
      country: z.string().trim().max(40).optional().default(''),
    }).parse(req.body || {});
    const data = await phpApi.post(`/accounts/${req.params.accountId}/socks`, body);
    return ok(res, data, 'SOCKS5 已绑定到该账号', 201);
  } catch (error) {
    return fail(res, error.message, error.status || 422);
  }
});

router.get('/providers', (req, res) => ok(res, listProviders()));

router.get('/status', async (req, res) => {
  const provider = new BitBrowserProvider();
  try {
    const message = await provider.health();
    return ok(res, {
      online: true,
      provider: 'bit',
      apiUrl: provider.baseUrl,
      message: message == null ? 'ok' : message,
    });
  } catch (error) {
    return ok(res, {
      online: false,
      provider: 'bit',
      apiUrl: provider.baseUrl,
      message: error.message || '无法连接比特本地 API',
    });
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
  let bindings = new Map();
  try {
    const pack = await phpApi.get('/node/accounts/bindings');
    const map = pack?.map || {};
    bindings = new Map(Object.entries(map));
  } catch { /* empty bindings */ }
  const list = (data.list || []).map((profile) => ({
    ...provider.sanitizeProfile(profile),
    account: bindings.get(String(profile.id)) || null,
  }));
  return ok(res, { page: data.page, pageSize: data.pageSize, total: data.totalNum ?? list.length, items: list });
});

router.post('/profiles/:id/open', async (req, res) => {
  const provider = new BitBrowserProvider();
  try {
    const data = await provider.open(req.params.id);
    const safe = data && typeof data === 'object' ? {
      ws: data.ws, http: data.http, pid: data.pid, name: data.name, seq: data.seq, coreVersion: data.coreVersion,
    } : data;
    return ok(res, safe, '浏览器环境已打开');
  } catch (error) {
    return fail(res, error.message, 422);
  }
});

router.post('/profiles/:id/close', async (req, res) => {
  const provider = new BitBrowserProvider();
  const data = await provider.close(req.params.id);
  return ok(res, data, '浏览器环境已关闭');
});

router.post('/profiles/:id/tiktok-status', async (req, res) => {
  const provider = new BitBrowserProvider();
  const connection = await provider.open(req.params.id);
  if (!connection?.ws) throw new Error('比特浏览器未返回 CDP WebSocket 地址');
  const status = await inspectTikTokSession(connection.ws);
  let account = null;
  try {
    account = await phpApi.get(`/node/accounts/by-profile/${encodeURIComponent(req.params.id)}`);
  } catch { account = null; }
  if (account?.id) {
    await dataStore.updateLoginStatus(account.id, status.loggedIn ? 'online' : 'offline').catch(() => {});
  }
  let browserClosed = false;
  if (status.loggedIn) {
    await provider.close(req.params.id);
    browserClosed = true;
  }
  return ok(
    res,
    { ...status, account: account || null, browserClosed },
    status.loggedIn ? 'TikTok 登录状态有效，已关闭当前账号绑定的浏览器' : '未检测到有效 TikTok 登录会话，浏览器保持打开'
  );
});

router.get('/accounts/:accountId/tiktok-profile', async (req, res) => {
  return ok(res, await getProfile(req.params.accountId));
});

router.post('/accounts/:accountId/sync-profile', async (req, res) => {
  try {
    return ok(res, await syncProfile(req.params.accountId), 'TikTok 资料同步完成');
  } catch (error) {
    return fail(res, error.message, 422);
  }
});

router.get('/accounts/:accountId/tiktok-videos', async (req, res) => ok(res, await getVideos(req.params.accountId)));
router.get('/accounts/:accountId/tiktok-stats', async (req, res) => ok(res, await getStats(req.params.accountId)));

router.post('/accounts/:accountId/sync-videos', async (req, res) => {
  try {
    const result = await syncVideos(req.params.accountId, req.body?.limit);
    return ok(res, result, `TikTok 视频同步完成：${result.count} 条`);
  } catch (error) {
    return fail(res, error.message, 422);
  }
});

router.post('/accounts/:accountId/login-assist', async (req, res) => {
  const body = z.object({ autoSubmit: z.boolean().default(false), submitAfterTotp: z.boolean().default(true) }).parse(req.body || {});
  try {
    const result = await loginAssist(req.params.accountId, body);
    return ok(res, result, result.message);
  } catch (error) {
    await dataStore.updateLoginStatus(Number(req.params.accountId), 'offline').catch(() => {});
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
    let binding = null;
    try {
      binding = await phpApi.get(`/node/accounts/by-profile/${encodeURIComponent(profileId)}`);
    } catch { binding = null; }
    if (binding?.id) {
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
  let binding = null;
  try {
    binding = await phpApi.get(`/node/accounts/by-profile/${encodeURIComponent(req.params.id)}`);
  } catch { binding = null; }
  if (binding?.id) return fail(res, `环境仍绑定账号 ${binding.username}，请先解绑`, 409);
  const provider = new BitBrowserProvider();
  const data = await provider.delete(req.params.id);
  return ok(res, data, '浏览器环境已删除');
});

router.post('/accounts/:accountId/create', async (req, res) => {
  try {
    const provider = new BitBrowserProvider();
    const account = await loadAccount(Number(req.params.accountId));
    const result = await createProfileForAccount(provider, account);
    return ok(res, result, '浏览器环境已创建并绑定', 201);
  } catch (error) {
    return fail(res, error.message || '创建失败', error.status || 422);
  }
});

router.post('/accounts/batch-create', async (req, res) => {
  const body = z.object({
    accountIds: z.array(z.coerce.number().int().positive()).max(200).optional(),
    groupId: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
    requireProxy: z.boolean().default(false),
  }).parse(req.body);
  let accountIds = body.accountIds || [];
  if (!accountIds.length) {
    const qs = new URLSearchParams({ page: '1', pageSize: '200' });
    if (body.groupId) qs.set('groupId', String(body.groupId));
    const page = await phpApi.get(`/accounts?${qs}`);
    accountIds = (page?.items || [])
      .filter((a) => !a.browser_profile_id && a.enabled !== 0)
      .filter((a) => !body.requireProxy || a.proxy_id)
      .map((a) => Number(a.id))
      .slice(0, 200);
  }
  if (!accountIds.length) return fail(res, '没有符合条件的未绑定账号', 422);

  const provider = new BitBrowserProvider();
  const result = { requested: accountIds.length, created: 0, failed: 0, errors: [] };
  for (const id of accountIds) {
    try {
      const account = await loadAccount(id);
      await createProfileForAccount(provider, account);
      result.created += 1;
    } catch (error) {
      result.failed += 1;
      if (result.errors.length < 20) result.errors.push({ id, reason: error.message });
    }
  }
  return ok(res, result, `批量创建完成：成功 ${result.created}，失败 ${result.failed}`);
});

router.post('/bind', async (req, res) => {
  try {
    const body = z.object({
      accountId: z.coerce.number().int().positive(),
      profileId: z.string().trim().min(1).max(150),
    }).parse(req.body || {});
    await dataStore.updateBrowserBinding(body.accountId, body.profileId, false);
    return ok(res, body, '环境已绑定');
  } catch (error) {
    return fail(res, error.message, error.status || 422);
  }
});

router.post('/unbind', async (req, res) => {
  try {
    const body = z.object({ accountId: z.coerce.number().int().positive() }).parse(req.body || {});
    await dataStore.updateBrowserBinding(body.accountId, '', true);
    return ok(res, body, '已解除绑定');
  } catch (error) {
    return fail(res, error.message, error.status || 422);
  }
});

module.exports = router;
