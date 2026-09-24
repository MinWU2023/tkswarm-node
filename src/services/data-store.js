/**
 * 统一数据访问：客服端 Node 只走 PHP API（无本机 MySQL）。
 */
const fs = require('node:fs');
const path = require('node:path');
const phpApi = require('./php-api');

function usePhp() {
  return true;
}

function readLocalSetting(key, fallback) {
  try {
    const file = path.resolve(__dirname, '../../data/local-settings.json');
    if (!fs.existsSync(file)) return fallback;
    const j = JSON.parse(fs.readFileSync(file, 'utf8')) || {};
    return Object.prototype.hasOwnProperty.call(j, key) ? j[key] : fallback;
  } catch {
    return fallback;
  }
}

async function getSetting(key, fallback) {
  if (key === 'browserApiUrl') {
    return process.env.BIT_API_URL || readLocalSetting('browserApiUrl', fallback || 'http://127.0.0.1:54345');
  }
  if (key === 'browserApiToken') {
    return process.env.BIT_API_TOKEN || readLocalSetting('browserApiToken', fallback || '');
  }
  try {
    const map = await phpApi.get('/node/settings');
    if (map && Object.prototype.hasOwnProperty.call(map, key)) return map[key];
  } catch { /* fall through */ }
  return readLocalSetting(key, fallback);
}

async function setSetting(key, value) {
  try {
    await phpApi.post('/settings', { [key]: value });
  } catch {
    // 本地兜底（翻译配额等非关键）
    try {
      const file = path.resolve(__dirname, '../../data/local-settings.json');
      const j = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) || {} : {};
      j[key] = value;
      fs.writeFileSync(file, JSON.stringify(j, null, 2));
    } catch { /* ignore */ }
  }
}

async function getAccountBundle(accountId) {
  return phpApi.get(`/node/accounts/${accountId}/bundle`);
}

async function updateBrowserBinding(accountId, profileId, clear = false) {
  return phpApi.post(`/node/accounts/${accountId}/browser-binding`, {
    profileId: profileId || '',
    clear: Boolean(clear),
  });
}

async function updateLoginStatus(accountId, status) {
  return phpApi.patch(`/accounts/${accountId}/status`, { loginStatus: status });
}

async function saveSession(accountId, { cookie, fingerprint = '' }) {
  return phpApi.put(`/accounts/${accountId}/session`, { cookie, fingerprint });
}

async function saveFingerprint(accountId, fingerprint) {
  return phpApi.post(`/node/accounts/${accountId}/fingerprint`, { fingerprint });
}

async function tiktokSync(accountId, payload) {
  return phpApi.post(`/node/accounts/${accountId}/tiktok-sync`, payload);
}

async function qrComplete(payload) {
  return phpApi.post('/node/accounts/qr-complete', payload);
}

async function saveMonitorResult(result) {
  return phpApi.post('/node/monitor/result', { result });
}

async function dmIngest(payload) {
  return phpApi.post('/node/chat/dm-ingest', payload);
}

module.exports = {
  usePhp,
  getSetting,
  setSetting,
  getAccountBundle,
  updateBrowserBinding,
  updateLoginStatus,
  saveSession,
  saveFingerprint,
  tiktokSync,
  qrComplete,
  saveMonitorResult,
  dmIngest,
};
