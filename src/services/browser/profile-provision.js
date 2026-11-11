/**
 * 环境供给 / 自愈
 * ---------------------------------------------------------------
 * 任务入口（自动推送、测试、AI 拓客私信、AI 拓客自动推送）都会先把账号代理
 * 写进浏览器环境。如果账号记着的环境 ID 在本地已经不存在（换电脑、清数据、
 * 从比特切到自研、环境被删），过去只能整个任务失败，让人去账号里手动解绑重建。
 *
 * 这里把「新建环境 + 写回中心库绑定」抽成服务，让任务入口能自动补一个环境，
 * 用户不用再手点。创建逻辑与 routes/browser.js 完全一致（同一份代码）。
 */
const dataStore = require('../data-store');
const phpApi = require('../php-api');

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

function languageForCountry(rawCountry) {
  const raw = String(rawCountry || '').trim();
  const key = /[\u4e00-\u9fff]/.test(raw) ? raw : raw.toUpperCase();
  return languageByCountry[key] || 'en-US';
}

/**
 * 按国家推断代表时区。
 * 时区与出口 IP 地区矛盾是风控最强的信号之一（服务器在 Asia/Shanghai、IP 在 US），
 * 所以建环境时就要把时区定下来，由指纹加固模块通过 CDP setTimezoneOverride 生效。
 */
const timezoneByCountry = {
  CN: 'Asia/Shanghai', TW: 'Asia/Taipei', HK: 'Asia/Hong_Kong', MO: 'Asia/Macau',
  US: 'America/New_York', CA: 'America/Toronto', MX: 'America/Mexico_City', BR: 'America/Sao_Paulo',
  GB: 'Europe/London', IE: 'Europe/Dublin', DE: 'Europe/Berlin', FR: 'Europe/Paris',
  ES: 'Europe/Madrid', IT: 'Europe/Rome', NL: 'Europe/Amsterdam', BE: 'Europe/Brussels',
  CH: 'Europe/Zurich', AT: 'Europe/Vienna', SE: 'Europe/Stockholm', NO: 'Europe/Oslo',
  DK: 'Europe/Copenhagen', FI: 'Europe/Helsinki', PL: 'Europe/Warsaw', PT: 'Europe/Lisbon',
  RU: 'Europe/Moscow', UA: 'Europe/Kiev', TR: 'Europe/Istanbul', AE: 'Asia/Dubai',
  SA: 'Asia/Riyadh', IL: 'Asia/Jerusalem', IN: 'Asia/Kolkata', PK: 'Asia/Karachi',
  BD: 'Asia/Dhaka', TH: 'Asia/Bangkok', VN: 'Asia/Ho_Chi_Minh', ID: 'Asia/Jakarta',
  MY: 'Asia/Kuala_Lumpur', SG: 'Asia/Singapore', PH: 'Asia/Manila', JP: 'Asia/Tokyo',
  KR: 'Asia/Seoul', AU: 'Australia/Sydney', NZ: 'Pacific/Auckland', ZA: 'Africa/Johannesburg',
  EG: 'Africa/Cairo', NG: 'Africa/Lagos', KE: 'Africa/Nairobi',
  // 中文国名
  '中国': 'Asia/Shanghai', '台湾': 'Asia/Taipei', '香港': 'Asia/Hong_Kong', '澳门': 'Asia/Macau',
  '美国': 'America/New_York', '加拿大': 'America/Toronto', '墨西哥': 'America/Mexico_City',
  '巴西': 'America/Sao_Paulo', '英国': 'Europe/London', '德国': 'Europe/Berlin',
  '法国': 'Europe/Paris', '西班牙': 'Europe/Madrid', '意大利': 'Europe/Rome',
  '荷兰': 'Europe/Amsterdam', '瑞士': 'Europe/Zurich', '瑞典': 'Europe/Stockholm',
  '波兰': 'Europe/Warsaw', '葡萄牙': 'Europe/Lisbon', '俄罗斯': 'Europe/Moscow',
  '土耳其': 'Europe/Istanbul', '阿联酋': 'Asia/Dubai', '沙特阿拉伯': 'Asia/Riyadh',
  '印度': 'Asia/Kolkata', '巴基斯坦': 'Asia/Karachi', '泰国': 'Asia/Bangkok',
  '越南': 'Asia/Ho_Chi_Minh', '印度尼西亚': 'Asia/Jakarta', '马来西亚': 'Asia/Kuala_Lumpur',
  '新加坡': 'Asia/Singapore', '菲律宾': 'Asia/Manila', '日本': 'Asia/Tokyo',
  '韩国': 'Asia/Seoul', '澳大利亚': 'Australia/Sydney', '新西兰': 'Pacific/Auckland',
  '南非': 'Africa/Johannesburg', '埃及': 'Africa/Cairo', '尼日利亚': 'Africa/Lagos',
};

function timezoneForCountry(rawCountry) {
  const raw = String(rawCountry || '').trim();
  const key = /[\u4e00-\u9fff]/.test(raw) ? raw : raw.toUpperCase();
  return timezoneByCountry[key] || '';
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

/** 写入中心库 account_browser_envs 并校验落库 */
async function persistBrowserBinding(accountId, profileId, asPrimary = false, browserBackend = 'bit', ownerUserId = 0) {
  const aid = Number(accountId);
  const pid = String(profileId || '').trim();
  if (!aid || !pid) throw new Error('账号或环境 ID 无效');
  const saved = await dataStore.updateBrowserBinding(
    aid,
    pid,
    false,
    asPrimary,
    browserBackend,
    Number(ownerUserId) > 0 ? Number(ownerUserId) : 0,
  );
  let row = null;
  try {
    row = await phpApi.get(`/node/accounts/by-profile/${encodeURIComponent(pid)}`);
  } catch { /* verify below */ }
  if (!row || Number(row.id) !== aid) {
    throw Object.assign(new Error('环境绑定未写入数据库，请检查 API 连接与权限后重试'), { status: 500 });
  }
  return { saved, row, dbPersisted: true };
}

/**
 * 在指定后端上给账号新建环境，并把绑定写回中心库。
 * @param {object} account 账号 bundle（含 id / username / 代理 / 国家）
 * @param {object} provider BitBrowserProvider
 * @param {{ asPrimary?: boolean, browserBackend?: string, suffix?: string, ownerUserId?: number }} [opts]
 */
async function provisionProfileForAccount(account, provider, opts = {}) {
  if (!account) throw new Error('账号不存在');
  if (!provider) throw new Error('没有可用的浏览器后端，无法自动创建环境');
  const asPrimary = opts.asPrimary !== false;
  const browserBackend = opts.browserBackend || 'bit';
  const ownerUserId = Number(
    opts.ownerUserId || opts.owner_user_id || account.owner_user_id || account.owner_id || 0,
  ) || 0;

  // 延迟 require：proxy-sync 也会反过来用本模块，避免循环依赖
  const { buildSyncProxyFromBundle } = require('./proxy-sync');
  const proxy = opts.proxy !== undefined
    ? opts.proxy
    : (account.proxy_host ? await buildSyncProxyFromBundle(account) : null);

  const envCount = Number(account.env_count || account.envCount || 0);
  const hasBound = String(account.browser_profile_id || account.tkswarm_browser_profile_id || '').trim() !== '';
  const suffix = opts.suffix != null
    ? String(opts.suffix)
    : ((envCount > 0 || hasBound) && !opts.name ? `#${Math.max(envCount, 0) + 1}` : '');

  const profileName = String(opts.name || `TK-${account.username}${suffix}`).slice(0, 100);
  const remark = String(opts.remark || `TkSwarm account #${account.id}${suffix}`).slice(0, 200);

  // 创建前按中心库额度预检（自研/Linux）；比特不计入
  let maxEnvs;
  if (ownerUserId > 0 && (browserBackend === 'tkswarm' || browserBackend === 'linux')) {
    try {
      const snap = await phpApi.get(`/node/browser-env-quota/${ownerUserId}`);
      maxEnvs = Number(snap?.quota ?? snap?.browserEnvQuota);
      const remaining = Number(snap?.remaining ?? snap?.browserEnvRemaining);
      if (Number.isFinite(remaining) && remaining <= 0) {
        throw Object.assign(
          new Error(`管理用户 #${ownerUserId} 自研浏览器环境额度已满（${snap?.used ?? '?'}/${snap?.quota ?? '?'}）`),
          { status: 422, nonRetryable: true },
        );
      }
    } catch (e) {
      if (e?.status === 422 || e?.nonRetryable) throw e;
      // 额度接口失败时仍继续，由本机浏览器 / 入库侧兜底
    }
  }

  const profile = await provider.create({
    name: profileName,
    username: account.username,
    remark,
    proxy,
    language: opts.language || languageForCountry(account.country || account.proxy_country),
    // 自研/Linux 浏览器按 owner_id 计额度；比特忽略该字段
    ownerId: ownerUserId > 0 ? ownerUserId : undefined,
    maxEnvs: Number.isFinite(maxEnvs) && maxEnvs >= 0 ? maxEnvs : undefined,
  });

  const profileId = extractProfileId(profile, provider);
  if (!profileId) throw new Error('本地浏览器未返回新环境 ID，请确认已登录且有创建窗口权限');

  let persisted = null;
  try {
    persisted = await persistBrowserBinding(account.id, profileId, asPrimary, browserBackend, ownerUserId);
  } catch (error) {
    try { await provider.delete(profileId); } catch { /* best-effort */ }
    const msg = error?.message || '写入中心库失败';
    throw Object.assign(new Error(`环境已创建但保存绑定失败：${msg}`), { status: error?.status || 422 });
  }

  return {
    accountId: account.id,
    username: account.username,
    profileId,
    dbPersisted: true,
    binding: persisted?.saved,
    profileName: profile.name,
    browserBackend,
    providerLabel: provider.backendLabel || browserBackend,
    ownerUserId: ownerUserId || undefined,
  };
}

module.exports = {
  languageByCountry,
  languageForCountry,
  timezoneByCountry,
  timezoneForCountry,
  extractProfileId,
  persistBrowserBinding,
  provisionProfileForAccount,
};
