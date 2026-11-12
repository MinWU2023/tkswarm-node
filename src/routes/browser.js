/**
 * 本地浏览器能力路由：CDP / 环境操作在本地，账号数据一律 PHP API。
 */
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const { z } = require('zod');
const { ok, fail } = require('../http');
const {
  getProvider,
  getProviderAsync,
  listProviders,
  detectFromHealth,
  detectEnvTypeFromHealth,
  labelFor,
  configuredBackend,
  getCachedBackend,
  clearBackendCache,
  resolvePreferredCreateProvider,
  probeAvailableBackends,
  normalizeBackendId,
} = require('../services/browser/providers');
const { inspectTikTokSession } = require('../services/browser/cdp-client');
const { loginAssist, fullLogin, closeSession, restoreLoginOnOpen } = require('../services/browser/tiktok-login');
const { syncProfile, getProfile, syncVideos, getVideos, getStats } = require('../services/browser/tiktok-data');
const { preparePublish, prepareMessage } = require('../services/browser/tiktok-actions');
const { createQrSession, checkQrSession, closeQrSession } = require('../services/browser/qr-login');
const { assertPublishGate } = require('../services/account-gates');
const dataStore = require('../services/data-store');
const phpApi = require('../services/php-api');
const profileProvision = require('../services/browser/profile-provision');
const { probeProxyObject, batchTestProxies } = require('../services/proxy-probe');

const router = express.Router();

/**
 * 显式指定环境后端 → provider（bit / tkswarm / linux）。
 * 用于「创建环境 / 绑定环境 / 列表 / 开关窗」按操作选择自研或比特，
 * 不受全局 browserBackend 影响；未传或非法值返回 null（回退原有全局逻辑）。
 */
function envProviderFor(rawBackend) {
  const backend = normalizeBackendId(rawBackend);
  if (!backend) return null;
  const provider = getProvider(backend);
  provider.envType = backend;
  return { provider, backend, label: labelFor(backend) };
}

/** 从 body / query 里取环境后端原始值 */
function pickEnvBackend(source) {
  if (!source) return '';
  return String(source.browserBackend || source.browser_backend || '');
}

/**
 * Linux 服务器浏览器只跑长期占用的公共任务（AI 拓客 / 多账号客服），
 * 环境一律由任务自动创建、一个账号一个，不再从账号/环境界面手动创建或绑定。
 */
function manualLinuxBindingError(rawBackend) {
  if (normalizeBackendId(rawBackend) !== 'linux') return null;
  return Object.assign(
    new Error('Linux 服务器浏览器环境改为「任务自动创建」：AI 拓客、多账号客服会按账号自动准备环境，不再需要手动创建或绑定'),
    { status: 422 }
  );
}

const languageByCountry = {
  CN: 'zh-CN', TW: 'zh-TW', HK: 'zh-HK', US: 'en-US', GB: 'en-GB', CA: 'en-CA', AU: 'en-AU',
  JP: 'ja-JP', KR: 'ko-KR', DE: 'de-DE', FR: 'fr-FR', ES: 'es-ES', IT: 'it-IT', BR: 'pt-BR',
  PT: 'pt-PT', RU: 'ru-RU', TH: 'th-TH', VN: 'vi-VN', ID: 'id-ID', MY: 'ms-MY', PH: 'en-PH',
  // 中文国名（detect-proxy-countries.php / ip-api lang=zh-CN）
  '中国': 'zh-CN', '台湾': 'zh-TW', '香港': 'zh-HK', '美国': 'en-US', '英国': 'en-GB',
  '加拿大': 'en-CA', '澳大利亚': 'en-AU', '日本': 'ja-JP', '韩国': 'ko-KR', '德国': 'de-DE',
  '法国': 'fr-FR', '西班牙': 'es-ES', '意大利': 'it-IT', '巴西': 'pt-BR', '葡萄牙': 'pt-PT',
  '俄罗斯': 'ru-RU', '泰国': 'th-TH', '越南': 'vi-VN', '印度尼西亚': 'id-ID', '马来西亚': 'ms-MY',
  '菲律宾': 'en-PH',
};

async function loadAccount(accountId) {
  const account = await dataStore.getAccountBundle(accountId);
  if (!account) throw Object.assign(new Error('账号不存在'), { status: 404 });
  return account;
}

function parseBindingsPack(pack) {
  const map = pack?.map || {};
  return {
    map,
    bindings: new Map(Object.entries(map)),
    excludeOrphan: new Set((pack?.excludeOrphanProfileIds || []).map(String)),
    canSeeOrphans: !!pack?.canSeeOrphanProfiles,
  };
}

function enrichProfileRow(profile, binding, envType, backendTypeLabel) {
  const type = binding?.browser_type || binding?.browser_backend || envType;
  return {
    ...profile,
    account: binding,
    browser_type: type,
    browser_type_label: binding?.browser_type_label || backendTypeLabel(type),
    owner_user_id: binding?.owner_user_id || 0,
    owner_label: binding?.owner_label || (binding ? '-' : ''),
    owner_username: binding?.owner_username || '',
  };
}

/** 本地 API 不可用时，用 PHP 绑定记录构造可展示的环境行 */
function profileRowFromBinding(profileId, binding, backendTypeLabel) {
  const username = String(binding?.username || '').trim();
  const nickname = String(binding?.nickname || '').trim();
  const name = username ? `TK-${username}` : (nickname || `环境 ${profileId}`);
  const be = binding?.browser_type || binding?.browser_backend || 'bit';
  return enrichProfileRow({
    id: profileId,
    seq: '-',
    name,
    remark: binding?.id ? `账号 #${binding.id}` : '',
    status: null,
    proxyType: '-',
    host: '',
    port: '',
    coreProduct: '-',
    coreVersion: '',
    fromBindings: true,
  }, binding, be, backendTypeLabel);
}

function applyBrowserProfileScope(list, { canSeeOrphans, excludeOrphan, bindingsOk = true }) {
  // 绑定表读取失败时必须降级为「照实展示本机环境」：
  // 否则每一行都没有 account，过滤后环境列表会全空，看起来像「环境全丢了」。
  if (!bindingsOk) return list;
  if (canSeeOrphans) {
    return list.filter((row) => row.account || !excludeOrphan.has(String(row.id)));
  }
  // 共用：已绑定（含他人账号）的环境一律可见，只隐藏未绑定的孤儿窗
  return list.filter((row) => row.account);
}

function extractProfileId(profile, provider) {
  const raw = profile?.id ?? profile?.profileId ?? profile?.browserId ?? '';
  const id = String(raw || '').trim();
  if (id) return id;
  try {
    const sanitized = provider?.sanitizeProfile?.(profile);
    return String(sanitized?.id || '').trim();
  } catch {
    return '';
  }
}

function parseAccountIdFromRemark(remark) {
  const m = String(remark || '').match(/TkSwarm account #(\d+)/i);
  return m ? Number(m[1]) : 0;
}

function parseAccountIdFromName(name, byUsername) {
  const m = String(name || '').match(/^TK-([^#]+)(?:#\d+)?$/i);
  if (!m) return 0;
  const acc = byUsername.get(String(m[1]).toLowerCase());
  return acc ? Number(acc.id) : 0;
}

/** 写入中心库 account_browser_envs 并校验落库（实现见 profile-provision，任务入口共用） */
async function persistBrowserBinding(accountId, profileId, asPrimary = false, browserBackend = 'bit') {
  return profileProvision.persistBrowserBinding(accountId, profileId, asPrimary, browserBackend);
}

function profileDeleteAllowed(profileId, binding, pack) {
  // 已绑定账号：允许删除（删除前自动解绑并清理中心库行）
  if (binding?.id) {
    return {
      ok: true,
      unbindAccountId: Number(binding.id) || 0,
      unbindUsername: String(binding.username || ''),
    };
  }
  if (!pack.canSeeOrphans) {
    return { ok: false, reason: '当前角色无权删除未绑定环境' };
  }
  if (pack.excludeOrphan.has(String(profileId))) {
    return { ok: false, reason: '该环境已分配给用户，无权删除' };
  }
  return { ok: true };
}

/** 删除本机环境；若仍绑定账号则先解绑（保留账号上其余环境，并回落到 id 最大的） */
async function deleteLocalProfile(provider, profileId, gate = {}) {
  const pid = String(profileId || '').trim();
  if (!pid) throw new Error('缺少环境 ID');
  const aid = Number(gate.unbindAccountId || 0);
  if (aid > 0) {
    try {
      await dataStore.updateBrowserBinding(aid, pid, true);
    } catch (e) {
      // 解绑失败仍尝试删本机窗，避免脏绑定卡死删除
      console.warn('[browser-delete] unbind failed', aid, pid, e?.message || e);
    }
  }
  return provider.delete(pid);
}

/** 给账号新建环境并写回绑定（实现见 profile-provision，任务入口自愈时复用同一份） */
async function createProfileForAccount(provider, account, {
  asPrimary = true,
  browserBackend = 'bit',
  ownerUserId = 0,
} = {}) {
  return profileProvision.provisionProfileForAccount(account, provider, {
    asPrimary,
    browserBackend,
    ownerUserId: Number(ownerUserId) > 0 ? Number(ownerUserId) : 0,
  });
}

/**
 * 创建/再绑成功后立刻导出本地环境包并上传中心库（仅自研桌面 / Linux）。
 * 失败不阻断绑定结果，把 pack* 字段带回给前端提示；失败时再重试一次。
 */
async function pushPackAfterCreate(provider, result, accountId) {
  const { pushLocalEnvPack, supportsPackSync } = require('../services/browser/env-pack-sync');
  const profileId = String(result?.profileId || '').trim();
  if (!profileId || !provider || !supportsPackSync(provider)) {
    return { packPushed: false, packSkipped: true, packReason: 'backend-unsupported' };
  }
  const aid = Number(accountId || result?.accountId || 0) || 0;
  let pack = await pushLocalEnvPack(profileId, { accountId: aid, provider });
  // 新建环境尚未登录 → 包必然过小，属预期：不重试、不当失败，登录后会自动上传
  if (pack?.reason === 'pack-too-small') {
    return { packPushed: false, packSkipped: true, packReason: 'pack-too-small', packBytes: pack.bytes };
  }
  if (!pack?.pushed && pack?.reason !== 'skip') {
    await new Promise((r) => setTimeout(r, 400));
    pack = await pushLocalEnvPack(profileId, { accountId: aid, provider });
  }
  if (!pack?.pushed && pack?.reason === 'pack-too-small') {
    return { packPushed: false, packSkipped: true, packReason: 'pack-too-small', packBytes: pack.bytes };
  }
  if (pack?.pushed) {
    return {
      packPushed: true,
      packSkipped: false,
      packRevision: pack.meta?.packRevision,
      packBytes: pack.meta?.packBytes,
    };
  }
  return {
    packPushed: false,
    packSkipped: pack?.reason === 'skip',
    packReason: pack?.reason || 'upload-failed',
  };
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
    searchTitle: z.string().trim().max(300).optional().default(''),
    materialName: z.string().trim().max(300).optional().default(''),
    description: z.string().trim().max(1000).optional().default(''),
    localOnly: z.boolean().optional().default(false),
  }).parse(req.body || {});
  const accountId = Number(req.params.accountId);
  try {
    await loadAccount(accountId);
  } catch (e) {
    return fail(res, e.message, e.status || 404);
  }
  if (!body.videoId && !body.videoUrl && !body.searchTitle && !body.materialName && !body.description) {
    return fail(res, '请提供 videoId、videoUrl 或标题（searchTitle）', 400);
  }

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

/**
 * 拓客「查数据账号」预检：本地浏览器在线 + 环境存在 + 代理可连通。
 * 不真正 open 窗口，避免打扰正在使用的环境。
 */
router.post('/accounts/:accountId/env-check', async (req, res) => {
  const accountId = Number(req.params.accountId || 0);
  if (!accountId) return fail(res, '缺少账号 ID', 422);
  let account;
  try {
    account = await loadAccount(accountId);
  } catch {
    return fail(res, '账号不存在', 404);
  }
  const {
    resolveAccountBrowser,
    resolveEffectiveBackend,
    profileIdCandidatesForBackend,
    protocolBackendId,
  } = require('../services/browser/providers');
  // 前端可能指定后端（AI 拓客选「服务器浏览器」时传 linux），不能一律按账号默认后端查
  const requestedBackend = normalizeBackendId(pickEnvBackend(req.body));
  const backend = requestedBackend || resolveEffectiveBackend(account);
  const isServerBrowser = backend === 'linux';
  let resolved;
  try {
    resolved = resolveAccountBrowser(account, { requireProfile: false, browserBackend: backend });
  } catch {
    resolved = { provider: getProvider(normalizeBackendId(backend) || protocolBackendId(backend)), profileId: '', label: labelFor(backend) };
  }
  const provider = resolved.provider;
  const label = resolved.label || provider.backendLabel || labelFor(backend) || '本地浏览器';
  let profileId = String(resolved.profileId || '').trim();
  const profileCandidates = profileIdCandidatesForBackend(account, backend);
  const proxyId = Number(account.proxy_id || account.proxyId || 0);
  const checks = {
    accountId,
    username: account.username || '',
    bitOnline: false,
    bitLoggedIn: false,
    profileOk: false,
    profileId,
    proxyOk: false,
    proxyId,
    proxyIp: '',
    proxyCountry: '',
    ok: false,
    message: '',
    backend: provider.backendId || '',
    backendLabel: label,
  };
  try {
    await provider.health();
    checks.bitOnline = true;
    try {
      await provider.profiles(0, 1);
      checks.bitLoggedIn = true;
    } catch (authErr) {
      const tip = String(authErr.message || '');
      checks.message = tip || `${label} 本地 API 未登录`;
      return ok(res, checks, checks.message);
    }
  } catch (error) {
    checks.message = error.message || `无法连接${label} API`;
    return ok(res, checks, checks.message);
  }
  const tryIds = isServerBrowser ? profileCandidates.filter(Boolean) : (profileCandidates.length ? [...profileCandidates] : (profileId ? [profileId] : []));
  if (!tryIds.length && !isServerBrowser) {
    checks.message = `账号未绑定${label}环境`;
    return ok(res, checks, checks.message);
  }
  // 服务器浏览器：环境由任务自动创建，没有绑定 ID 也算通过（服务在线即可）
  if (!tryIds.length && isServerBrowser) {
    checks.profileOk = true;
    checks.message = '服务器浏览器环境将在任务执行时自动创建';
  }
  let detail = null;
  let hitId = '';
  for (const pid of tryIds) {
    try {
      const row = await provider.detail(pid);
      if (row && (row.id || row.name || Object.keys(row).length)) {
        detail = row;
        hitId = pid;
        break;
      }
    } catch { /* try next */ }
  }
  if (!detail && tryIds.length) {
    checks.message = `绑定的${label}环境均不可用（${tryIds.map((id) => id.slice(0, 8)).join('、')}…），请再绑或创建环境`;
    return ok(res, checks, checks.message);
  }
  checks.profileOk = true;
  if (hitId) { checks.profileId = hitId; profileId = hitId; }
  if (hitId && hitId !== (profileCandidates[0] || '')) {
    try {
      await persistBrowserBinding(accountId, hitId, true, backend);
      checks.message = `已自动将有效环境 ${hitId.slice(0, 8)}… 同步为主绑定`;
    } catch { /* non-fatal */ }
  }
  if (!account.proxy_host && !proxyId) {
    checks.message = '账号未绑定代理';
    return ok(res, checks, checks.message);
  }
  try {
    const { resolveProxyCredsFromBundle } = require('../services/proxy-probe');
    const resolved = await resolveProxyCredsFromBundle(account);
    const proxy = resolved || {
      id: proxyId,
      protocol: account.proxy_protocol || 'http',
      host: account.proxy_host,
      port: account.proxy_port,
      username: account.proxy_username,
      password: account.proxy_password,
    };
    const result = await probeProxyObject(proxy);
    if (proxyId) {
      await phpApi.post(`/node/proxies/${proxyId}/probe-result`, result).catch(() => {});
    }
    checks.proxyOk = !!result?.available;
    checks.proxyIp = String(result?.egressIp || result?.ip || result?.query || '');
    checks.proxyCountry = String(result?.country || result?.countryCode || '');
    if (!checks.proxyOk) {
      checks.message = result?.detail || result?.reason || result?.error || '代理检测失败';
      return ok(res, checks, checks.message);
    }
  } catch (error) {
    checks.message = error.message || '代理检测异常';
    return ok(res, checks, checks.message);
  }
  checks.ok = true;
  checks.message = `环境与代理正常${checks.proxyIp ? ` · IP ${checks.proxyIp}` : ''}${checks.proxyCountry ? ` · ${checks.proxyCountry}` : ''}`;
  return ok(res, checks, checks.message);
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
      const { resolveProxyCredsFromBundle } = require('../services/proxy-probe');
      const resolved = await resolveProxyCredsFromBundle(account);
      const proxy = resolved || {
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

router.post('/proxies/batch-test', async (req, res) => {
  const body = z.object({
    proxyIds: z.array(z.coerce.number().int().positive()).min(1).max(200),
  }).parse(req.body || {});
  try {
    const data = await batchTestProxies(body.proxyIds);
    let message = `可用 ${data.available}，不可用 ${data.unavailable}`;
    if (data.updated) message += `，已写入国家 ${data.updated}/${data.total}`;
    return ok(res, data, message);
  } catch (error) {
    return fail(res, error.message || '批量检测失败', 422);
  }
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

  const { resolveAccountBrowser } = require('../services/browser/providers');
  const items = [];
  let harvested = 0;
  for (const row of rows) {
    let fingerprint = row.session_fingerprint || row.fingerprint || '';
    let profileId = row.browser_profile_id || '';
    let provider = getProvider();
    try {
      const resolved = resolveAccountBrowser(row, { requireProfile: false });
      if (resolved.profileId) profileId = resolved.profileId;
      if (resolved.provider) provider = resolved.provider;
    } catch { /* keep */ }
    if (!fingerprint && profileId) {
      try {
        const detail = await provider.detail(profileId);
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
      .filter((a) => a.enabled !== 0 && (a.browser_profile_id || a.tkswarm_browser_profile_id))
      .map((a) => Number(a.id))
      .slice(0, 5);
  }
  ids = ids.slice(0, 5);
  if (!ids.length) return fail(res, '没有已绑定浏览器环境的账号', 400);
  const { resolveProfileIdForAccount } = require('../services/browser/providers');
  const items = [];
  for (const id of ids) {
    let account;
    try {
      account = await loadAccount(id);
    } catch {
      items.push({ accountId: id, ok: false, reason: '账号不存在' });
      continue;
    }
    if (!resolveProfileIdForAccount(account)) {
      items.push({ accountId: id, username: account.username, ok: false, reason: '未绑定浏览器环境' });
      continue;
    }
    try {
      const result = await fullLogin(id);
      if (result?.attemptLimited || result?.captcha) {
        items.push({
          accountId: id,
          username: account.username,
          ok: false,
          reason: result.message || (result.captcha ? '需要人工完成安全验证' : 'TikTok 限制登录尝试'),
        });
      } else if (result?.loginOk || result?.alreadyLoggedIn) {
        items.push({
          accountId: id,
          username: account.username,
          ok: true,
          status: 'online',
          message: result?.message || '登录成功',
        });
      } else if (result?.submitted) {
        items.push({
          accountId: id,
          username: account.username,
          ok: true,
          status: 'submitted',
          message: result?.message || '已提交登录，请稍后检测',
        });
      } else {
        items.push({ accountId: id, username: account.username, ok: false, reason: result?.message || '登录未完成' });
      }
    } catch (error) {
      items.push({ accountId: id, username: account.username, ok: false, reason: error.message });
    }
  }
  const prepared = items.filter((item) => item.ok).length;
  return ok(res, { items, prepared, failed: items.length - prepared }, `一键登录完成：成功 ${prepared}，失败 ${items.length - prepared}`);
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
  clearBackendCache();
  const configured = configuredBackend();
  // 指定后端（?browserBackend=tkswarm）时只探该后端，用它的专用地址/Token，
  // 避免在自研环境上操作却去校验比特、或被全局 browserApiUrl 带偏
  const explicit = envProviderFor(pickEnvBackend(req.query));
  if (explicit) {
    const { provider, backend, label } = explicit;
    try { await provider.refreshConfig?.(); } catch { /* ignore */ }
    const providerLabel = provider.backendLabel || label;
    const base = {
      provider: backend,
      providerLabel,
      browserBackend: backend,
      apiUrl: provider.baseUrl,
      availableBackends: { bit: null, tkswarm: null, preferred: null },
    };
    let health = null;
    try {
      health = await provider.health();
    } catch (error) {
      return ok(res, {
        ...base,
        online: false,
        bitLoggedIn: false,
        message: error.message || `无法连接${providerLabel}（${provider.baseUrl}），请确认已启动并开启本地 API`,
      });
    }
    // 该端口上响应的到底是不是自研客户端
    const healthProviderId = String(health?.provider || health?.data?.provider || '').toLowerCase();
    if (backend === 'tkswarm' && healthProviderId && !healthProviderId.includes('tkswarm')) {
      return ok(res, {
        ...base,
        online: false,
        bitLoggedIn: false,
        providerId: healthProviderId,
        message: `${provider.baseUrl} 上响应的不是第一页自研浏览器（health.provider=${healthProviderId}）。请确认自研客户端已启动，或把「第一页自研浏览器专用 URL」改成它实际监听的端口（默认 54345，多客户端同时开时须改一端端口）。`,
        health,
      });
    }
    // 自研客户端 /health 会返回 loggedIn：为 false 说明桌面端没登录，直接给出确切原因。
    // Linux 服务器浏览器是常驻服务：loggedIn=false 只代表控制台当前没有活跃会话，
    // 不能据此判成离线（否则明明在线也会被判离线）。
    if (backend !== 'linux' && health && typeof health === 'object' && health.loggedIn === false) {
      return ok(res, {
        ...base,
        online: false,
        bitLoggedIn: false,
        loggedIn: false,
        providerId: String(health.provider || '') || undefined,
        message: `${providerLabel}桌面端尚未登录（health.loggedIn=false）：请在该客户端里登录后再试`,
        health,
      });
    }
    try {
      await provider.profiles(0, 1);
      return ok(res, {
        ...base,
        online: true,
        bitLoggedIn: true,
        loggedIn: typeof health?.loggedIn === 'boolean' ? health.loggedIn : null,
        providerId: String(health?.provider || health?.data?.provider || '') || undefined,
        message: provider.tokenAutoDropped
          ? 'Token 与本机客户端不一致，已自动忽略该 Token（自研默认不需要 Token）'
          : (typeof health === 'string' ? health : (health?.status || 'ok')),
        health,
      });
    } catch (authErr) {
      const authMsg = authErr.message || `${providerLabel}未登录或 API Token 失效`;
      if (backend === 'linux') {
        // health 已经通了 → 服务本身在线，只是接口鉴权没过，别报成"离线"
        return ok(res, {
          ...base,
          online: false,
          reachable: true,
          bitLoggedIn: false,
          loggedIn: typeof health?.loggedIn === 'boolean' ? health.loggedIn : null,
          providerId: String(health?.provider || health?.data?.provider || '') || undefined,
          message: `${providerLabel}服务在线（${provider.baseUrl}），但接口鉴权未通过：${authMsg}。请在 ${provider.baseUrl} 控制台登录后，把 Token 填到「设置 → 服务器浏览器(Linux) Token」`,
          health,
        });
      }
      return ok(res, {
        ...base,
        online: false,
        bitLoggedIn: false,
        loggedIn: typeof health?.loggedIn === 'boolean' ? health.loggedIn : null,
        providerId: String(health?.provider || health?.data?.provider || '') || undefined,
        message: authMsg,
        health,
      });
    }
  }
  const available = await probeAvailableBackends().catch(() => ({ bit: null, tkswarm: null, preferred: null }));
  const probed = available.preferred ? available[available.preferred] : null;
  if (probed?.provider) {
    const kind = probed.detected === 'tkswarm'
      ? (detectEnvTypeFromHealth(probed.health) === 'linux' ? 'linux' : 'tkswarm')
      : 'bit';
    const healthProvider = String(probed.health?.provider || probed.health?.data?.provider || '').toLowerCase();
    const label = probed.provider.backendLabel || labelFor(kind);
    const fixTip = available.autoFixedUrl
      ? `已自动将 API 地址修正为 ${available.autoFixedUrl}（原配置端口不可用）。`
      : '';
    return ok(res, {
      online: true,
      bitLoggedIn: true,
      provider: kind,
      providerId: healthProvider || undefined,
      providerLabel: label,
      browserBackend: configured,
      apiUrl: probed.url || probed.provider.baseUrl,
      availableBackends: {
        bit: !!available.bit,
        tkswarm: !!available.tkswarm,
        preferred: available.preferred,
      },
      message: fixTip || (typeof probed.health === 'string' ? probed.health : (probed.health?.status || 'ok')),
      health: probed.health,
      autoFixedUrl: available.autoFixedUrl || undefined,
    });
  }
  const provider = await getProviderAsync();
  try {
    const message = await provider.health();
    const kind = detectFromHealth(message);
    const healthProvider = String(message?.provider || message?.data?.provider || '').toLowerCase();
    const label = String(message?.providerLabel || message?.data?.providerLabel || '').trim()
      || (healthProvider === 'tkswarm-linuxbrowse' ? '第一页自研浏览器 Linux' : '')
      || labelFor(kind);
    try {
      await provider.profiles(0, 1);
      return ok(res, {
        online: true,
        bitLoggedIn: true,
        provider: kind,
        providerId: healthProvider || undefined,
        providerLabel: label,
        browserBackend: configured,
        apiUrl: provider.baseUrl,
        availableBackends: {
          bit: !!available.bit,
          tkswarm: !!available.tkswarm,
          preferred: available.preferred,
        },
        message: typeof message === 'string' ? message : (message?.status || 'ok'),
        health: message,
      });
    } catch (authErr) {
      const tip = String(authErr.message || '');
      if (/login\s*out|未登录|token.*失效|token.*过期|未.*登录/i.test(tip)) {
        return ok(res, {
          online: false,
          bitLoggedIn: false,
          provider: kind,
          providerId: healthProvider || undefined,
          providerLabel: label,
          browserBackend: configured,
          apiUrl: provider.baseUrl,
          availableBackends: {
            bit: !!available.bit,
            tkswarm: !!available.tkswarm,
            preferred: available.preferred,
          },
          message: tip,
          health: message,
        });
      }
      return ok(res, {
        online: true,
        bitLoggedIn: null,
        provider: kind,
        providerId: healthProvider || undefined,
        providerLabel: label,
        browserBackend: configured,
        apiUrl: provider.baseUrl,
        message: typeof message === 'string' ? message : (message?.status || 'ok'),
        health: message,
        warn: tip,
      });
    }
  } catch (error) {
    const cached = getCachedBackend();
    return ok(res, {
      online: false,
      bitLoggedIn: false,
      provider: cached.backend || 'unknown',
      providerLabel: cached.label || '本地浏览器',
      browserBackend: configured,
      apiUrl: provider.baseUrl,
      availableBackends: {
        bit: !!available.bit,
        tkswarm: !!available.tkswarm,
        preferred: available.preferred,
      },
      message: error.message || '无法连接本地浏览器 API，请启动自研浏览器',
    });
  }
});

/** 浏览器诊断：一次拿到 health / group/list / browser/list 的原始返回，用于定位 Token、登录态、端口问题 */
router.get('/diagnose', async (req, res) => {
  clearBackendCache();
  const explicit = envProviderFor(pickEnvBackend(req.query));
  const provider = explicit ? explicit.provider : await getProviderAsync().catch(() => getProvider());
  try { await provider.refreshConfig?.(); } catch { /* ignore */ }
  const out = {
    backend: explicit ? explicit.backend : (provider.backendId || 'bit'),
    providerLabel: provider.backendLabel || '',
    baseUrl: provider.baseUrl,
    tokenSet: Boolean(provider.apiToken),
    tokenAutoDropped: Boolean(provider.tokenAutoDropped),
    steps: [],
  };
  const probes = [
    ['health', () => provider.health()],
    ['group/list', () => provider.groups(0, 1)],
    ['browser/list', () => provider.profiles(0, 1)],
  ];
  for (const [name, fn] of probes) {
    const started = Date.now();
    try {
      const data = await fn();
      out.steps.push({ step: name, ok: true, ms: Date.now() - started, data });
    } catch (error) {
      out.steps.push({
        step: name,
        ok: false,
        ms: Date.now() - started,
        message: error?.message || String(error),
        raw: error?.rawMessage || '',
        businessCode: error?.businessCode || '',
      });
    }
  }
  return ok(res, out);
});

router.get('/groups', async (req, res) => {
  const provider = getProvider();
  const data = await provider.groups(Number(req.query.page || 0), Math.min(100, Number(req.query.pageSize || 100)));
  return ok(res, data);
});

router.get('/profiles', async (req, res) => {
  // 显式后端（?browserBackend=tkswarm）时只列该后端环境，默认沿用全局配置
  const explicit = envProviderFor(pickEnvBackend(req.query));
  const provider = explicit ? explicit.provider : getProvider();
  const {
    backendTypeLabel,
    detectEnvTypeFromHealth,
    getCachedBackend,
  } = require('../services/browser/providers');
  const page = Number(req.query.page || 0);
  const pageSize = Math.min(100, Number(req.query.pageSize || 100));
  const keyword = String(req.query.keyword || '');
  let bindingsPack = { map: {}, excludeOrphanProfileIds: [], canSeeOrphanProfiles: false };
  let bindingsError = '';
  try {
    bindingsPack = await phpApi.get('/node/accounts/bindings');
  } catch (error) {
    bindingsError = error?.message || '无法读取环境绑定';
  }
  const { bindings, excludeOrphan, canSeeOrphans } = parseBindingsPack(bindingsPack);
  const bindingCount = bindings.size;

  let currentEnvType = explicit
    ? explicit.backend
    : (provider.envType || getCachedBackend()?.envType || provider.backendId || 'bit');
  let localOnline = false;
  let data = { list: [], page, pageSize };
  try {
    data = await provider.profiles(page, pageSize, keyword);
    localOnline = true;
    try {
      const health = await provider.health().catch(() => null);
      // 显式指定后端时以请求为准，不被 health 识别结果覆盖
      if (health && !explicit) currentEnvType = detectEnvTypeFromHealth(health);
    } catch { /* keep */ }
  } catch {
    localOnline = false;
  }

  const localById = new Map();
  let list = [];
  for (const profile of (data.list || [])) {
    const id = String(profile.id);
    localById.set(id, profile);
    const binding = bindings.get(id) || null;
    const envType = binding?.browser_type || binding?.browser_backend || currentEnvType;
    list.push(enrichProfileRow(provider.sanitizeProfile(profile), binding, envType, backendTypeLabel));
  }
  // 本地 API 离线或本机无对应窗口时，仍展示 PHP 中可见账号的环境绑定
  for (const [profileId, binding] of bindings) {
    if (localById.has(profileId)) continue;
    if (explicit) {
      const boundBackend = normalizeBackendId(binding?.browser_type || binding?.browser_backend);
      if (boundBackend && boundBackend !== explicit.backend) continue;
    }
    list.push(profileRowFromBinding(profileId, binding, backendTypeLabel));
  }

  // 与账号列表 scope 一致（bindings 由 PHP 按可见账号过滤）：超管/运营管理可见孤儿窗；其余仅见已绑定且账号在范围内的环境
  list = applyBrowserProfileScope(list, { canSeeOrphans, excludeOrphan, bindingsOk: !bindingsError });

  return ok(res, {
    page: data.page ?? page,
    pageSize: data.pageSize ?? pageSize,
    total: list.length,
    items: list,
    localOnline,
    bindingCount,
    bindingsError,
    canSeeOrphans,
    envType: currentEnvType,
    envTypeLabel: backendTypeLabel(currentEnvType),
  });
});

/** 将本机浏览器环境按备注/名称匹配账号，写入中心库 account_browser_envs */
router.post('/profiles/sync-bindings', async (req, res) => {
  let provider;
  let backend = 'bit';
  try {
    const pack = await resolvePreferredCreateProvider();
    provider = pack.provider;
    backend = pack.backend || 'bit';
  } catch (error) {
    return fail(res, error.message || '本地浏览器未连接，无法同步', 422);
  }

  let allProfiles = [];
  try {
    for (let page = 0; page < 10; page += 1) {
      const data = await provider.profiles(page, 100, '');
      const list = data.list || [];
      allProfiles.push(...list);
      if (list.length < 100) break;
    }
  } catch (error) {
    return fail(res, error.message || '本地浏览器未连接，无法同步', 422);
  }

  let bindingsPack = { map: {} };
  try {
    bindingsPack = await phpApi.get('/node/accounts/bindings');
  } catch (error) {
    return fail(res, error.message || '无法读取已有绑定', 422);
  }
  const boundIds = new Set(Object.keys(bindingsPack.map || {}));

  let accounts = [];
  try {
    const page = await phpApi.get('/accounts?page=1&pageSize=500');
    accounts = page?.items || [];
  } catch { /* empty */ }
  const byUsername = new Map();
  for (const acc of accounts) {
    const u = String(acc.username || '').trim().toLowerCase();
    if (u) byUsername.set(u, acc);
  }

  const result = { scanned: 0, synced: 0, skipped: 0, failed: 0, errors: [] };
  for (const profile of allProfiles) {
    const profileId = extractProfileId(profile, provider);
    if (!profileId) continue;
    result.scanned += 1;
    if (boundIds.has(profileId)) {
      result.skipped += 1;
      continue;
    }
    let accountId = parseAccountIdFromRemark(profile.remark);
    if (!accountId) accountId = parseAccountIdFromName(profile.name, byUsername);
    if (!accountId) {
      result.skipped += 1;
      continue;
    }
    try {
      await persistBrowserBinding(accountId, profileId, true, backend);
      boundIds.add(profileId);
      result.synced += 1;
    } catch (error) {
      result.failed += 1;
      if (result.errors.length < 20) {
        result.errors.push({ profileId, accountId, reason: error.message || '绑定失败' });
      }
    }
  }
  return ok(res, result, `同步完成：新入库 ${result.synced}，跳过 ${result.skipped}，失败 ${result.failed}`);
});

/** 请求显式带 skipRestoreLogin=true 时不做打开后的自动恢复登录 */
function fastOpenSkipRestore(body) {
  return body?.skipRestoreLogin === true;
}

/**
 * 打开环境后挂载 CDP 旋转图片验证监听（用于「打开环境」แต่未带 accountId 或 skipRestoreLogin，以及注册环境打开）。
 * 静默连接、不阻塞 HTTP 响应、不关闭浏览器窗口。
 */
function attachRotateCaptchaToOpened(opened, accountId = 0) {
  if (!opened?.ws && !opened?.http) return;
  setImmediate(async () => {
    try {
      const { connectPlaywrightOverCDP, ensurePlaywrightPage } = require('../services/browser/cdp-connect');
      const { solveRotateCaptchaIfPresent } = require('../services/browser/nocaptchaai');
      const browser = await connectPlaywrightOverCDP(opened, { timeoutMs: 25000, retries: 2 });
      const page = await ensurePlaywrightPage(browser, { timeoutMs: 15000, preferUrl: /tiktok\.com/i, allowNewPage: false }).catch(() => null);
      if (page && !page.isClosed?.()) {
        await solveRotateCaptchaIfPresent(page, { accountId }).catch(() => {});
      }
    } catch { /* ignore */ }
  });
}

router.post('/profiles/:id/open', async (req, res) => {
  const provider = envProviderFor(pickEnvBackend(req.body))?.provider || getProvider();
  const profileId = String(req.params.id || '').trim();
  const fastOpen = req.body?.fastOpen === true;
  try {
    // 账号列表「打开环境」：本机没有时先从中心库拉环境包（或代建），再 open
    let accountId = Number(req.body?.accountId || req.body?.account_id || 0) || 0;
    if (!accountId) {
      try {
        const acc = await phpApi.get(`/node/accounts/by-profile/${encodeURIComponent(profileId)}`);
        accountId = Number(acc?.id || 0) || 0;
      } catch { /* ignore */ }
    }
    let readyId = profileId;
    try {
      const { prepareEnvForOpen } = require('../services/browser/env-pack-sync');
      const { publish: liveLog } = require('../services/live-log');
      const prepared = await prepareEnvForOpen(profileId, {
        accountId,
        provider,
        backend: provider.backendId || provider.envType || '',
        autoProvision: Boolean(accountId),
      });
      readyId = String(prepared?.profileId || profileId).trim() || profileId;
      if (prepared?.hydrated) {
        liveLog(
          `账号 #${accountId || '-'}：打开环境前已从中心库还原 ${readyId.slice(0, 8)}…`,
          'info',
          { accountId },
        );
      } else if (prepared?.provisioned) {
        liveLog(
          `账号 #${accountId || '-'}：打开环境前已代建环境 ${readyId.slice(0, 8)}…`,
          'info',
          { accountId },
        );
      }
    } catch (prepErr) {
      // 拉包/占锁失败不直接吞掉：若本机已有仍可尝试 open；否则抛出可读错误
      const msg = String(prepErr?.message || prepErr || '');
      try {
        await provider.detail(profileId);
      } catch {
        return fail(res, msg || '环境未就绪，无法打开', 422);
      }
    }

    // fastOpen：界面「打开环境」用，窗口起来就返回，页面就绪/指纹注入在浏览器端后台继续
    let data;
    try {
      data = await provider.open(readyId, { fastOpen });
    } catch (openErr) {
      const openMsg = String(openErr?.message || openErr || '');
      if (!/不存在|已删除|not\s*found/i.test(openMsg)) throw openErr;
      // 竞态：准备后仍 missing → 再拉一次包
      const { ensureEnvReady } = require('../services/browser/env-pack-sync');
      const again = await ensureEnvReady(readyId, {
        accountId,
        provider,
        backend: provider.backendId || provider.envType || '',
        autoProvision: Boolean(accountId),
      });
      readyId = String(again?.profileId || readyId).trim() || readyId;
      data = await provider.open(readyId, { fastOpen });
    }
    const safe = data && typeof data === 'object' ? {
      ws: data.ws, http: data.http, pid: data.pid, name: data.name, seq: data.seq, coreVersion: data.coreVersion,
      profileId: readyId,
    } : data;
    // 打开环境后台自动恢复登录：环境包登录态 → 已存凭证 → 否则提示走表单；不阻塞本次返回
    if (accountId && !fastOpenSkipRestore(req.body)) {
      setImmediate(() => {
        restoreLoginOnOpen(accountId, readyId, provider).catch(() => {});
      });
    } else {
      attachRotateCaptchaToOpened(data, accountId);
    }
    return ok(res, safe, '浏览器环境已打开');
  } catch (error) {
    return fail(res, error.message, 422);
  }
});

router.post('/profiles/:id/close', async (req, res) => {
  const provider = envProviderFor(pickEnvBackend(req.body))?.provider || getProvider();
  const data = await provider.close(req.params.id);
  return ok(res, data, '浏览器环境已关闭');
});

router.post('/profiles/:id/tiktok-status', async (req, res) => {
  const provider = envProviderFor(pickEnvBackend(req.body))?.provider || getProvider();
  const connection = await provider.open(req.params.id);
  if (!connection?.ws) {
    const label = provider.backendLabel || labelFor(provider.backendId) || '本地浏览器';
    throw new Error(`${label}未返回 CDP WebSocket 地址`);
  }
  // 以真实页面右上角（Log in 按钮 / 头像）为准；页面起不来时才退回只看 Cookie
  let status;
  try {
    const { inspectOpenedSession } = require('../services/browser/tiktok-actions');
    status = await inspectOpenedSession(connection.ws);
  } catch (pageErr) {
    status = await inspectTikTokSession(connection.ws);
    status.pageError = pageErr.message;
  }
  let account = null;
  try {
    account = await phpApi.get(`/node/accounts/by-profile/${encodeURIComponent(req.params.id)}`);
  } catch { account = null; }
  if (account?.id) {
    await dataStore.updateLoginStatus(account.id, status.loggedIn ? 'online' : 'offline').catch(() => {});
    if (!status.loggedIn) {
      await dataStore.clearSession(account.id).catch(() => {});
    }
  }
  let browserClosed = false;
  if (status.loggedIn) {
    await provider.close(req.params.id);
    browserClosed = true;
  }
  // 检测后推环境包，同步登录/离线态到中心库供服务器浏览器使用
  try {
    const { pushLocalEnvPack } = require('../services/browser/env-pack-sync');
    await pushLocalEnvPack(req.params.id, {
      accountId: Number(account?.id || 0) || 0,
      provider,
    });
  } catch { /* ignore */ }
  const topHint = status.topRight?.avatar
    ? '右上角有头像'
    : (status.topRight?.loginButton ? '右上角显示 Log in 按钮' : '右上角未识别到头像/登录按钮');
  const apiHint = status.apiProbe?.ok
    ? (status.apiProbe.loggedIn ? '账号接口：已登录' : `账号接口：${status.apiProbe.sessionExpired ? 'session_expired（Cookie 已失效）' : (status.apiProbe.reason || '未登录')}`)
    : `账号接口：无结论${status.apiProbe?.reason ? '（' + status.apiProbe.reason + '）' : ''}`;
  const message = status.loggedIn
    ? `TikTok 登录状态有效（${apiHint}，${topHint}），已关闭当前账号绑定的浏览器`
    : `账号未登录（${apiHint}，${topHint}${status.hasSessionCookie ? '；仅有残留 Cookie 不算登录' : ''}），浏览器保持打开`;
  return ok(
    res,
    { ...status, account: account || null, browserClosed },
    message
  );
});

router.get('/accounts/:accountId/tiktok-profile', async (req, res) => {
  return ok(res, await getProfile(req.params.accountId));
});

router.post('/accounts/:accountId/sync-profile', async (req, res) => {
  try {
    const body = req.body || {};
    const result = await syncProfile(req.params.accountId, {
      username: body.username || body.handle || '',
      originalUsername: body.originalUsername || body.original_username || '',
      nickname: body.nickname || body.displayName || '',
      originalNickname: body.originalNickname ?? body.original_nickname,
      signature: body.signature || body.bio || '',
      avatarPath: body.avatarPath || body.avatarUrl || '',
      avatarUrl: body.avatarUrl || '',
    });
    return ok(res, result, result.message || '系统资料已同步到 TikTok');
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

router.post('/accounts/:accountId/login', async (req, res) => {
  try {
    const result = await fullLogin(req.params.accountId);
    const okLogin = Boolean(result?.loginOk || result?.alreadyLoggedIn);
    return ok(res, result, result?.message || (okLogin ? '登录成功，状态已更新' : '登录未完成，状态已更新为未登录'));
  } catch (error) {
    await dataStore.updateLoginStatus(Number(req.params.accountId), 'offline').catch(() => {});
    return fail(res, error.message || '一键登录失败', 422);
  }
});

router.post('/accounts/:accountId/login-assist', async (req, res) => {
  // 兼容旧接口：默认走一键登录（填表 + 提交 + 2FA）
  const body = z.object({
    autoSubmit: z.boolean().default(true),
    submitAfterTotp: z.boolean().default(true),
  }).parse(req.body || {});
  try {
    const result = body.autoSubmit && body.submitAfterTotp
      ? await fullLogin(req.params.accountId)
      : await loginAssist(req.params.accountId, body);
    const okLogin = Boolean(result?.loginOk || result?.alreadyLoggedIn);
    return ok(res, result, result?.message || (okLogin ? '登录成功，状态已更新' : '登录未完成，状态已更新为未登录'));
  } catch (error) {
    await dataStore.updateLoginStatus(Number(req.params.accountId), 'offline').catch(() => {});
    return fail(res, error.message || '登录失败', 422);
  }
});

router.post('/profiles/:id/session-close', async (req, res) => {
  const accountId = Number(req.body?.accountId || req.query?.accountId || 0) || 0;
  await closeSession(req.params.id, { accountId, pushPack: true });
  return ok(res, null, '登录辅助会话已关闭');
});

/**
 * 将本机自研/Linux 环境按会话白名单精简打包，并以原环境 ID 同名文件覆盖中心库包。
 * 须本机存在该环境，且已绑定账号（否则中心库无处落包）。
 */
router.post('/profiles/:id/sync-pack', async (req, res) => {
  const profileId = String(req.params.id || '').trim();
  if (!profileId) return fail(res, '缺少环境 ID', 422);
  const accountId = Number(req.body?.accountId || req.query?.accountId || 0) || 0;
  const be = pickEnvBackend(req.body) || pickEnvBackend(req.query);
  let provider;
  try {
    const resolved = envProviderFor(be);
    provider = resolved?.provider || await getProviderAsync(be || undefined).catch(() => getProvider());
  } catch (e) {
    return fail(res, e.message || '无法连接本地浏览器', 503);
  }
  const { pushLocalEnvPack, supportsPackSync } = require('../services/browser/env-pack-sync');
  if (!supportsPackSync(provider)) {
    return fail(res, '当前浏览器后端不支持环境包同步（仅第一页自研桌面 / Linux）', 422);
  }
  const detail = await provider.detail(profileId).catch(() => null);
  if (!detail) {
    return fail(res, '本机不存在该环境，无法导出上传', 404);
  }
  let beforeBytes = 0;
  try {
    const meta = await require('../services/php-api').get(
      `/node/browser-profiles/${encodeURIComponent(profileId)}/pack-meta`,
    );
    beforeBytes = Number(meta?.packBytes || 0) || 0;
  } catch { /* 无旧包 */ }
  try {
    const result = await pushLocalEnvPack(profileId, { accountId, provider });
    if (!result?.pushed) {
      return fail(res, result?.reason || '环境包上传失败', 422);
    }
    return ok(res, {
      profileId,
      accountId,
      packRevision: result.meta?.packRevision,
      packBytes: result.meta?.packBytes,
      beforeBytes,
      replaced: true,
      packFile: `${String(profileId).replace(/[^a-zA-Z0-9_-]/g, '') || profileId.slice(0, 12)}.tgz`,
    }, '环境包已原名替换到中心库');
  } catch (e) {
    return fail(res, e.message || '环境包更新失败', 422);
  }
});

router.post('/profiles/batch-delete', async (req, res) => {
  const body = z.object({ profileIds: z.array(z.string().trim().min(1).max(150)).min(1).max(500) }).parse(req.body);
  const profileIds = [...new Set(body.profileIds)];
  const provider = envProviderFor(pickEnvBackend(req.body))?.provider || getProvider();
  const result = { requested: profileIds.length, deleted: 0, blocked: 0, failed: 0, unbound: 0, errors: [] };
  let bindingsPack = {};
  try {
    bindingsPack = await phpApi.get('/node/accounts/bindings');
  } catch { bindingsPack = {}; }
  const pack = parseBindingsPack(bindingsPack);
  for (const profileId of profileIds) {
    const binding = pack.map[String(profileId)] || null;
    const gate = profileDeleteAllowed(profileId, binding, pack);
    if (!gate.ok) {
      result.blocked += 1;
      result.errors.push({ profileId, reason: gate.reason });
      continue;
    }
    try {
      await deleteLocalProfile(provider, profileId, gate);
      result.deleted += 1;
      if (gate.unbindAccountId) result.unbound += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push({ profileId, reason: error.message });
    }
  }
  return ok(res, result, `批量删除完成：成功 ${result.deleted}，阻止 ${result.blocked}，失败 ${result.failed}`);
});

router.delete('/profiles/:id', async (req, res) => {
  let bindingsPack = {};
  try {
    bindingsPack = await phpApi.get('/node/accounts/bindings');
  } catch { bindingsPack = {}; }
  const pack = parseBindingsPack(bindingsPack);
  const binding = pack.map[String(req.params.id)] || null;
  const gate = profileDeleteAllowed(req.params.id, binding, pack);
  if (!gate.ok) return fail(res, gate.reason, 403);
  const provider = envProviderFor(pickEnvBackend(req.query))?.provider || getProvider();
  const data = await deleteLocalProfile(provider, req.params.id, gate);
  const tip = gate.unbindAccountId
    ? `浏览器环境已删除（已同步解绑账号 #${gate.unbindAccountId}${gate.unbindUsername ? ` · ${gate.unbindUsername}` : ''}）`
    : '浏览器环境已删除';
  return ok(res, data, tip);
});

router.post('/accounts/:accountId/create', async (req, res) => {
  try {
    const blocked = manualLinuxBindingError(pickEnvBackend(req.body));
    if (blocked) return fail(res, blocked.message, blocked.status);
    const explicit = envProviderFor(pickEnvBackend(req.body));
    const { provider, backend, label } = explicit || await resolvePreferredCreateProvider();
    const account = await loadAccount(Number(req.params.accountId));
    // 再绑环境须显式 asPrimary:false；首次「创建环境」默认 true
    const rebind = req.body?.rebind === true;
    const asPrimary = req.body?.asPrimary === true || req.body?.as_primary === true
      || (req.body?.asPrimary !== false && req.body?.as_primary !== false && !rebind);
    const ownerUserId = Number(req.body?.ownerUserId || req.body?.owner_user_id || req.body?.ownerId || 0) || 0;

    if (rebind || !asPrimary) {
      // 再绑/重绑：仅超管或运营管理，且必须指定耗用额度的管理用户
      let st = null;
      try { st = await phpApi.get('/auth/status'); } catch { st = null; }
      const isSuper = !!(st?.isSuper || st?.loginUser?.isSuper || st?.user?.isSuper);
      const loginRole = String(st?.loginUser?.role || '');
      const userRole = String(st?.user?.role || '');
      const isOpsAdmin = loginRole.includes('运营管理') || userRole.includes('运营管理');
      if (!isSuper && !isOpsAdmin) {
        return fail(res, '仅超级管理员或运营管理可再绑环境', 403);
      }
      if (ownerUserId <= 0) {
        return fail(res, '再绑环境请选择要耗用额度的管理用户', 422);
      }
      // 已绑定且中心库有环境包 → 禁止再绑更换（在创建本地窗之前拦截，避免白建）
      try {
        const { fetchPackMeta } = require('../services/browser/env-pack-sync');
        const typedPid = backend === 'tkswarm'
          ? String(account.tkswarm_browser_profile_id || (account.browser_backend === 'tkswarm' ? account.browser_profile_id : '') || '').trim()
          : (backend === 'linux'
            ? String(account.linux_browser_profile_id || (account.browser_backend === 'linux' ? account.browser_profile_id : '') || '').trim()
            : String(
              account.bit_browser_profile_id
              || (account.browser_backend === 'bit' || !account.browser_backend ? account.browser_profile_id : '')
              || account.browser_profile_id
              || ''
            ).trim());
        if (typedPid) {
          const meta = await fetchPackMeta(typedPid);
          // 与 PHP 一致：仅有效包(hasPack)拦截手动再绑；残缺文件不拦
          if (meta?.hasPack) {
            return fail(
              res,
              `账号已绑定环境 ${typedPid.slice(0, 8)}… 且中心库已有环境包，不允许再绑更换。如需更换请先解绑该环境`,
              409
            );
          }
        }
      } catch (e) {
        if (e?.status === 409) throw e;
        // pack-meta 临时失败不误拦无包场景；真正创建时 PHP bind 仍会二次校验
        console.warn('[rebind-guard] pack-meta check failed', e?.message || e);
      }
    }

    const result = await createProfileForAccount(provider, account, {
      asPrimary,
      browserBackend: backend,
      ownerUserId,
    });
    const packInfo = await pushPackAfterCreate(provider, result, account.id);
    const payload = { ...result, ...packInfo };
    let msg = asPrimary
      ? `已在${label}新建环境并设为主绑定`
      : `已在${label}创建并绑定环境`;
    if (packInfo.packPushed) msg += '，环境包已上传中心库';
    else if (packInfo.packReason === 'pack-too-small') msg += '（新环境尚未登录，环境包将在登录后上传）';
    else if (!packInfo.packSkipped && packInfo.packReason) msg += `（环境包上传失败：${packInfo.packReason}）`;
    return ok(res, payload, msg, 201);
  } catch (error) {
    return fail(res, error.message || '创建失败', error.status || 422);
  }
});

router.post('/accounts/batch-create', async (req, res) => {
  const body = z.object({
    accountIds: z.array(z.coerce.number().int().positive()).max(200).optional(),
    groupId: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
    requireProxy: z.boolean().default(false),
    browserBackend: z.enum(['bit', 'tkswarm', 'linux', 'auto']).optional(),
  }).parse(req.body);
  const blockedBatch = manualLinuxBindingError(body.browserBackend);
  if (blockedBatch) return fail(res, blockedBatch.message, blockedBatch.status);
  const explicit = envProviderFor(body.browserBackend);
  let accountIds = body.accountIds || [];
  if (!accountIds.length) {
    const qs = new URLSearchParams({ page: '1', pageSize: '200' });
    if (body.groupId) qs.set('groupId', String(body.groupId));
    const page = await phpApi.get(`/accounts?${qs}`);
    const hasEnvFor = (a, be) => {
      if (be === 'tkswarm') return Boolean(a.tkswarm_browser_profile_id || (a.browser_backend === 'tkswarm' && a.browser_profile_id));
      if (be === 'linux') return Boolean(a.linux_browser_profile_id || (a.browser_backend === 'linux' && a.browser_profile_id));
      return Boolean(a.browser_backend === 'bit' && a.browser_profile_id);
    };
    accountIds = (page?.items || [])
      .filter((a) => a.enabled !== 0)
      // 显式后端时只看该后端是否已有环境；默认沿用「无任何环境」的旧规则
      .filter((a) => (explicit ? !hasEnvFor(a, explicit.backend) : (!a.browser_profile_id && !a.tkswarm_browser_profile_id)))
      .filter((a) => !body.requireProxy || a.proxy_id)
      .map((a) => Number(a.id))
      .slice(0, 200);
  }
  if (!accountIds.length) return fail(res, '没有符合条件的未绑定账号', 422);

  const { provider, backend, label } = explicit || await resolvePreferredCreateProvider();
  const result = {
    requested: accountIds.length,
    created: 0,
    failed: 0,
    packPushed: 0,
    packFailed: 0,
    items: [],
    errors: [],
    browserBackend: backend,
    providerLabel: label,
  };
  for (const id of accountIds) {
    try {
      const account = await loadAccount(id);
      const created = await createProfileForAccount(provider, account, { asPrimary: true, browserBackend: backend });
      result.created += 1;
      const packInfo = await pushPackAfterCreate(provider, created, id);
      const item = {
        accountId: id,
        profileId: created.profileId,
        packPushed: !!packInfo.packPushed,
        packSkipped: !!packInfo.packSkipped,
        packReason: packInfo.packReason || '',
      };
      result.items.push(item);
      if (packInfo.packPushed) result.packPushed += 1;
      else if (!packInfo.packSkipped) {
        result.packFailed += 1;
        if (result.errors.length < 20) {
          result.errors.push({ id, reason: `已创建但环境包上传失败：${packInfo.packReason || 'unknown'}` });
        }
      }
    } catch (error) {
      result.failed += 1;
      if (result.errors.length < 20) result.errors.push({ id, reason: error.message });
    }
  }
  let batchMsg = `批量创建完成（${label}）：成功 ${result.created}，失败 ${result.failed}`;
  if (result.packPushed || result.packFailed) {
    batchMsg += `，环境包上传 ${result.packPushed}/${result.created}`;
  }
  return ok(res, result, batchMsg);
});

router.post('/bind', async (req, res) => {
  try {
    const body = z.object({
      accountId: z.coerce.number().int().positive(),
      profileId: z.string().trim().min(1).max(150),
      asPrimary: z.boolean().optional().default(false),
      browserBackend: z.enum(['bit', 'tkswarm', 'linux', 'auto']).optional(),
    }).parse(req.body || {});
    const blockedBind = manualLinuxBindingError(body.browserBackend);
    if (blockedBind) return fail(res, blockedBind.message, blockedBind.status);
    const explicit = envProviderFor(body.browserBackend);
    let backend = body.browserBackend;
    if (!backend || backend === 'auto') {
      const pack = await resolvePreferredCreateProvider();
      backend = pack.backend;
    }
    // 显式指定后端时先校验该环境确实存在于该客户端，避免把自研环境绑到比特（或反之）
    if (explicit) {
      try {
        await explicit.provider.detail(body.profileId);
      } catch (error) {
        return fail(
          res,
          `环境 ${body.profileId} 在${explicit.label}中不存在或不可用：${error.message || '查询失败'}`,
          422
        );
      }
    }
    const persisted = await persistBrowserBinding(body.accountId, body.profileId, body.asPrimary, backend);
    return ok(res, { ...body, browserBackend: backend, dbPersisted: true, binding: persisted.saved }, '环境已绑定并写入数据库');
  } catch (error) {
    return fail(res, error.message, error.status || 422);
  }
});

router.post('/unbind', async (req, res) => {
  try {
    const body = z.object({
      accountId: z.coerce.number().int().positive(),
      profileId: z.string().trim().max(150).optional().default(''),
      clear: z.boolean().optional().default(true),
    }).parse(req.body || {});
    await dataStore.updateBrowserBinding(body.accountId, body.profileId || '', true);
    return ok(res, body, '已解除绑定');
  } catch (error) {
    return fail(res, error.message, error.status || 422);
  }
});

/**
 * 兼容旧前端的「同步浏览器 Token」接口。
 * 现已改为：清空误写入的 tkswarmBrowserApiToken，让 Provider 不带 Bearer，
 * 依赖本机自研/Linux 已登录用户打开共用环境（见 data-store.syncBrowserAuthToken）。
 */
router.post('/sync-auth-token', async (req, res) => {
  try {
    await dataStore.setSetting('tkswarmBrowserApiToken', '');
    clearBackendCache();
    return ok(res, { synced: false, cleared: true }, '已改为不自动同步；本机浏览器登录即可共用环境');
  } catch (error) {
    return fail(res, error.message, error.status || 422);
  }
});

/** 把浏览器相关设置写入本机 local-settings（Provider 同步读取） */
router.post('/local-settings', async (req, res) => {
  try {
    const body = req.body || {};
    const keys = [
      'browserApiUrl', 'browserApiToken', 'browserBackend',
      'bitBrowserApiUrl', 'tkswarmBrowserApiUrl', 'tkswarmBrowserApiToken',
      'linuxBrowserApiUrl', 'linuxBrowserApiToken',
      'taskConcurrency',
    ];
    const saved = {};
    const { normalizeLinuxApiUrl } = require('../services/browser/providers');
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
      let val = body[key];
      const isSecret = /ApiToken$/.test(key);
      if (isSecret && (val == null || String(val).trim() === '')) continue;
      // 服务器浏览器地址：允许只填 IP:端口，自动补 http:// 并去掉结尾 /；空表示未选择（由运营后台清单下发）
      if (key === 'linuxBrowserApiUrl') {
        val = normalizeLinuxApiUrl(val);
      }
      if (key === 'taskConcurrency') {
        const n = Number(val);
        val = Number.isFinite(n) ? Math.min(20, Math.max(3, Math.floor(n))) : 6;
      }
      await dataStore.setSetting(key, val);
      saved[key] = isSecret ? '(set)' : val;
    }
    clearBackendCache();
    return ok(res, saved, '本地浏览器设置已同步');
  } catch (error) {
    return fail(res, error.message, error.status || 422);
  }
});

// ───────────── 注册环境：先选代理建环境 → 打开环境填账号 → 发布生成正式账号 ─────────────

async function loadRegisterEnv(id) {
  const bundle = await phpApi.get(`/register-envs/${encodeURIComponent(id)}/bundle`);
  if (!bundle) throw Object.assign(new Error('注册环境不存在'), { status: 404 });
  return bundle;
}

function registerEnvProvider(bundle) {
  const backend = normalizeBackendId(bundle.browser_backend) || 'tkswarm';
  if (backend === 'linux') {
    throw Object.assign(new Error('注册环境不支持服务器浏览器，请选择自研浏览器或比特浏览器'), { status: 422 });
  }
  const picked = envProviderFor(backend);
  if (!picked) throw Object.assign(new Error('没有可用的浏览器后端'), { status: 422 });
  return picked;
}

/** 没有环境就按所选代理新建一个，并把环境 ID 回写到注册记录；已有则直接返回 */
async function ensureRegisterEnvProfile(id, bundle, provider) {
  const existing = String(bundle.browser_profile_id || '').trim();
  if (existing) return { profileId: existing, created: false };
  const ownerUserId = Number(bundle.owner_id || 0) || 0;
  const backend = normalizeBackendId(bundle.browser_backend) || 'tkswarm';
  let maxEnvs;
  if (ownerUserId > 0 && (backend === 'tkswarm' || backend === 'linux')) {
    try {
      const snap = await phpApi.get(`/node/browser-env-quota/${ownerUserId}`);
      maxEnvs = Number(snap?.quota ?? snap?.browserEnvQuota);
      const remaining = Number(snap?.remaining ?? snap?.browserEnvRemaining);
      if (Number.isFinite(remaining) && remaining <= 0) {
        throw Object.assign(
          new Error(`管理用户 #${ownerUserId} 自研浏览器环境额度已满（${snap?.used ?? '?'}/${snap?.quota ?? '?'}）`),
          { status: 422 },
        );
      }
    } catch (e) {
      if (e?.status === 422) throw e;
    }
  }
  const label = bundle.name || bundle.account_username || `#${id}`;
  const profile = await provider.create({
    name: `REG-${label}`.slice(0, 100),
    username: bundle.account_username || label,
    remark: `TkSwarm register env #${id}`.slice(0, 200),
    proxy: bundle.proxy || null,
    language: profileProvision.languageForCountry(bundle.country || bundle.proxy?.country),
    ownerId: ownerUserId > 0 ? ownerUserId : undefined,
    maxEnvs: Number.isFinite(maxEnvs) && maxEnvs >= 0 ? maxEnvs : undefined,
  });
  const profileId = profileProvision.extractProfileId(profile, provider);
  if (!profileId) throw new Error('本地浏览器未返回新环境 ID，请确认已登录且有创建窗口权限');
  try {
    await phpApi.put(`/register-envs/${encodeURIComponent(id)}/profile`, { browserProfileId: profileId });
  } catch (e) {
    try { await provider.delete(profileId); } catch { /* best-effort */ }
    throw Object.assign(new Error(`环境已创建但保存到注册记录失败：${e?.message || e}`), { status: e?.status || 422 });
  }
  return { profileId, created: true };
}

/** 新建环境（已有则复用） */
router.post('/register-envs/:id/create-profile', async (req, res) => {
  try {
    const bundle = await loadRegisterEnv(req.params.id);
    if (bundle.status === 'published') return fail(res, '该注册环境已发布', 409);
    const { provider, label } = registerEnvProvider(bundle);
    const r = await ensureRegisterEnvProfile(req.params.id, bundle, provider);
    return ok(res, { profileId: r.profileId, created: r.created }, r.created ? `已在${label}新建环境` : '环境已存在');
  } catch (error) {
    return fail(res, error.message || '创建环境失败', error.status || 422);
  }
});

/** 打开环境：没有环境先建；已有环境把代理重写一次再开，保证用的是当前选择的代理 */
router.post('/register-envs/:id/open', async (req, res) => {
  try {
    const bundle = await loadRegisterEnv(req.params.id);
    if (bundle.status === 'published') return fail(res, '该注册环境已发布，请到账号管理里打开环境', 409);
    const { provider } = registerEnvProvider(bundle);
    const r = await ensureRegisterEnvProfile(req.params.id, bundle, provider);
    if (!r.created && bundle.proxy) {
      // 环境里的代理与注册记录一致就不重写：
      // proxy/update 要先经代理探测出口 IP，代理慢或不可达时会拖很久甚至卡死，
      // 而 open 本身并不依赖这一步，没变化时没必要冒险。
      let sameProxy = false;
      try {
        const detail = await provider.detail(r.profileId);
        const want = bundle.proxy;
        sameProxy = !!detail
          && String(detail.proxyType || '').toLowerCase() === provider.normalizeProxyType(want.protocol)
          && String(detail.host || '') === String(want.host || '')
          && Number(detail.port || 0) === Number(want.port || 0)
          && String(detail.proxyUserName || '') === String(want.username || '')
          && String(detail.proxyPassword || '') === String(want.password || '')
          // 老环境时区为空（旧版本没对齐过地区）：代理没变也要走一次 proxy/update 补写时区/语言/经纬度
          && String(detail.timezone || '').trim() !== ''
          && String(detail.country || '').trim() !== '';
      } catch { /* 读不到详情就按需重写 */ }
      if (!sameProxy) {
        try {
          await provider.close(r.profileId).catch(() => {});
          await provider.updateProxy(r.profileId, bundle.proxy);
        } catch (e) {
          return fail(res, `写入代理失败：${e?.message || e}`, 422);
        }
      }
    }
    const data = await provider.open(r.profileId, { fastOpen: true });
    attachRotateCaptchaToOpened(data, 0);
    const safe = data && typeof data === 'object'
      ? { ws: data.ws, http: data.http, pid: data.pid, name: data.name, seq: data.seq, profileId: r.profileId }
      : { profileId: r.profileId };
    return ok(res, safe, '浏览器环境已打开');
  } catch (error) {
    return fail(res, error.message || '打开环境失败', error.status || 422);
  }
});

/** 发布：用填写的账号信息创建正式账号，关联环境与代理，再回写注册记录状态 */
router.post('/register-envs/:id/publish', async (req, res) => {
  let accountId = 0;
  try {
    const bundle = await loadRegisterEnv(req.params.id);
    if (bundle.status === 'published') return fail(res, '该注册环境已发布', 409);
    const username = String(bundle.account_username || '').trim();
    if (!username) return fail(res, '请先填写账号名称再发布', 422);
    const profileId = String(bundle.browser_profile_id || '').trim();
    if (!profileId) return fail(res, '还没有创建环境，请先点「打开环境」', 422);
    const { provider, backend } = registerEnvProvider(bundle);
    const ownerUserId = Number(bundle.owner_id || 0) || 0;

    const created = await phpApi.post('/accounts', {
      username,
      nickname: bundle.account_nickname || '',
      country: bundle.country || bundle.proxy_country || '',
      groupId: bundle.group_id || undefined,
      proxyId: bundle.proxy_id || undefined,
      browserType: backend,
      browserBackend: backend,
      browserProfileId: profileId,
      notes: bundle.notes || '',
    });
    accountId = Number(created?.id || 0);
    if (!accountId) throw new Error('创建账号失败：接口未返回账号 ID');

    try {
      await profileProvision.persistBrowserBinding(accountId, profileId, true, backend, ownerUserId);
    } catch (bindErr) {
      // 绑定没落库：回滚刚建的账号，避免出现无环境的半成品；注册记录仍是草稿，可重试
      try { await phpApi.request('DELETE', `/accounts/${accountId}`); } catch { /* best-effort */ }
      throw Object.assign(new Error(`账号已创建但环境绑定失败，已回滚：${bindErr?.message || bindErr}`), { status: bindErr?.status || 422 });
    }

    let secretsNote = '';
    if (bundle.account_password || bundle.account_totp) {
      try {
        await phpApi.put(`/accounts/${accountId}/secrets`, {
          password: bundle.account_password || '',
          totpSecret: bundle.account_totp || '',
        });
      } catch (e) {
        secretsNote = `（账号密码/2FA 保存失败：${e?.message || e}，请到账号里重新填写）`;
      }
    }

    const packInfo = await pushPackAfterCreate(provider, { profileId }, accountId).catch((e) => ({ packPushed: false, packReason: String(e?.message || e) }));
    await phpApi.post(`/register-envs/${encodeURIComponent(req.params.id)}/published`, { accountId });
    let msg = `已发布为正式账号 #${accountId}`;
    if (packInfo.packPushed) msg += '，环境包已上传中心库';
    else if (packInfo.packReason === 'pack-too-small') msg += '（新环境尚未登录，环境包将在登录后上传）';
    else if (packInfo.packReason && packInfo.packReason !== 'backend-unsupported') msg += `（环境包上传失败：${packInfo.packReason}）`;
    return ok(res, { accountId, profileId, ...packInfo }, msg + secretsNote, 201);
  } catch (error) {
    return fail(res, error.message || '发布失败', error.status || 422);
  }
});

/** 本机 browser 未匹配路由：返回 JSON 404，禁止落入 phpApiProxy 把请求打到线上变成 nginx HTML 404 */
router.use((req, res) => fail(res, `本机浏览器接口不存在：${req.method} ${req.originalUrl}（请确认 Node 已重启加载最新路由）`, 404));

module.exports = router;
