const fs = require('node:fs');
const path = require('node:path');
const dataStore = require('../data-store');

function readLocalSettings() {
  try {
    const file = path.resolve(__dirname, '../../../data/local-settings.json');
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, 'utf8')) || {};
  } catch {
    return {};
  }
}

function settingSync(key, fallback) {
  const local = readLocalSettings();
  if (key === 'browserApiUrl') {
    return process.env.BIT_API_URL || local.browserApiUrl || fallback;
  }
  if (key === 'browserApiToken') {
    return process.env.BIT_API_TOKEN || local.browserApiToken || fallback;
  }
  if (Object.prototype.hasOwnProperty.call(local, key)) return local[key];
  return fallback;
}

function normalizeBitBaseUrl(url) {
  let raw = String(url || 'http://127.0.0.1:54345').trim().replace(/\/+$/, '');
  if (!raw) raw = 'http://127.0.0.1:54345';
  // localhost 在部分 Windows / Node 上会走 IPv6(::1)，比特本地服务只监听 127.0.0.1
  raw = raw.replace(/^http:\/\/localhost(?=[:/]|$)/i, 'http://127.0.0.1');
  raw = raw.replace(/^https:\/\/localhost(?=[:/]|$)/i, 'https://127.0.0.1');
  return raw;
}

function isBitSuccess(result) {
  if (!result || typeof result !== 'object') return false;
  if (result.success === true || result.success === 'true' || result.success === 1) return true;
  if (result.code === 0 || result.code === '0') return true;
  return false;
}

function nestErrCode(error) {
  let cur = error;
  for (let i = 0; i < 4 && cur; i += 1) {
    if (cur.code) return String(cur.code);
    cur = cur.cause;
  }
  return '';
}

function friendlyBitConnectError(error, baseUrl) {
  const code = nestErrCode(error);
  const msg = String(error?.message || '');
  if (code === 'ECONNREFUSED' || /ECONNREFUSED/i.test(msg)) {
    return `无法连接比特本地 API（${baseUrl}）。请确认：1) 比特浏览器已登录运行；2) 设置里已开启「本地 API / Local Server」；3) 端口与地址一致（默认 54345）。仅打开主程序但未开本地 API 也会失败。`;
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || /ENOTFOUND|getaddrinfo/i.test(msg)) {
    return `比特 API 地址无法解析（${baseUrl}）。请改回 http://127.0.0.1:54345，不要填云端域名。`;
  }
  if (code === 'ETIMEDOUT' || /timeout|ETIMEDOUT/i.test(msg)) {
    return `连接比特本地 API 超时（${baseUrl}）。请检查防火墙是否拦截，或重启比特后重试。`;
  }
  if (/fetch failed/i.test(msg)) {
    return `无法访问比特本地 API（${baseUrl}）。请先启动比特并启用本地 API。`;
  }
  return msg || '比特浏览器请求失败';
}

function normalizeOpenData(data) {
  if (!data || typeof data !== 'object') return data;
  if (data.ws) return data;
  // 少数版本只回 http，补成 CDP ws
  const http = String(data.http || data.httpUrl || '').trim();
  if (http) {
    const host = http.replace(/^https?:\/\//i, '');
    return { ...data, ws: `ws://${host}/devtools/browser` };
  }
  return data;
}

class BitBrowserProvider {
  constructor() {
    this.baseUrl = normalizeBitBaseUrl(settingSync('browserApiUrl', 'http://127.0.0.1:54345'));
    this.apiToken = String(settingSync('browserApiToken', ''));
  }

  async refreshConfig() {
    try {
      const url = await dataStore.getSetting('browserApiUrl', this.baseUrl);
      const token = await dataStore.getSetting('browserApiToken', this.apiToken);
      if (url) this.baseUrl = normalizeBitBaseUrl(url);
      if (token != null) this.apiToken = String(token);
    } catch { /* keep sync defaults */ }
  }

  async request(endpoint, payload = {}, timeoutMs = 15000) {
    await this.refreshConfig();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (this.apiToken) headers.Authorization = `Bearer ${this.apiToken}`;
      const response = await fetch(`${this.baseUrl}/${endpoint.replace(/^\//, '')}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload ?? {}),
        signal: controller.signal,
        redirect: 'manual',
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location') || '';
        throw new Error(`比特浏览器本地 API 返回重定向（${response.status}${location ? ` → ${location}` : ''}），请检查 BitBrowser 本地服务和环境 ID`);
      }
      const text = await response.text();
      let result;
      try {
        result = text ? JSON.parse(text) : { success: response.ok };
      } catch {
        throw new Error(`比特浏览器返回了非 JSON 数据（HTTP ${response.status}）`);
      }
      if (!response.ok || !isBitSuccess(result)) {
        throw new Error(result.msg || result.message || result.error || `比特浏览器请求失败（HTTP ${response.status}）`);
      }
      return result.data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error(`比特浏览器请求超时：${endpoint}`);
      // 已是友好中文业务错误则原样抛出
      if (error && error.message && /比特|BitBrowser|本地 API/i.test(error.message) && !/fetch failed/i.test(error.message)) {
        throw error;
      }
      throw new Error(friendlyBitConnectError(error, this.baseUrl));
    } finally {
      clearTimeout(timer);
    }
  }

  health() { return this.request('health', {}); }
  groups(page = 0, pageSize = 100) { return this.request('group/list', { page, pageSize }); }
  profiles(page = 0, pageSize = 100, name = '') { return this.request('browser/list', { page, pageSize, name }); }

  async open(id, options = {}) {
    const profileId = String(id || '').trim();
    if (!profileId) throw new Error('缺少比特环境 ID，请先给账号创建/绑定浏览器环境');
    const payload = {
      id: profileId,
      // 排队打开，避免批量登录并发打爆本地 API
      queue: options.queue !== false,
    };
    if (options.headless) {
      payload.args = Array.isArray(options.args) && options.args.length
        ? options.args
        : ['--headless=new', '--disable-gpu'];
    }
    const data = normalizeOpenData(await this.request('browser/open', payload, 60000));
    if (!data?.ws) {
      throw new Error('比特浏览器已响应，但未返回 CDP WebSocket 地址。请升级比特或在比特设置中确认本地 API 正常');
    }
    return data;
  }

  close(id) { return this.request('browser/close', { id: String(id || '') }, 30000); }
  delete(id) { return this.request('browser/delete', { id: String(id || '') }, 30000); }
  detail(id) { return this.request('browser/detail', { id: String(id || '') }); }

  create({ name, username = '', remark = '', proxy = null, language = 'en-US' }) {
    const hasProxy = Boolean(proxy?.host && proxy?.port);
    return this.request('browser/update', {
      platform: 'https://www.tiktok.com',
      platformIcon: 'other',
      url: 'https://www.tiktok.com',
      name,
      remark,
      // Keep platform username blank. TikTok's username is stored only in TkSwarm;
      // BitBrowser rejects creation when a deleted/hidden profile has the same username.
      userName: '',
      password: '',
      cookie: '',
      otherCookie: '',
      isGlobalProxyInfo: false,
      proxyMethod: 2,
      proxyType: hasProxy ? proxy.protocol : 'noproxy',
      host: hasProxy ? proxy.host : '',
      port: hasProxy ? proxy.port : '',
      proxyUserName: hasProxy ? proxy.username : '',
      proxyPassword: hasProxy ? proxy.password : '',
      ipCheckService: 'ip2location',
      browserFingerPrint: {
        coreVersion: '148',
        ostype: 'PC',
        os: 'Win32',
        isIpCreateTimeZone: true,
        isIpCreatePosition: true,
        isIpCreateLanguage: true,
        languages: language,
        resolutionType: '0',
        resolution: '1920 x 1080',
        webRTC: '0',
      },
    }, 30000);
  }

  sanitizeProfile(profile) {
    return {
      id: profile.id,
      seq: profile.seq,
      code: profile.code,
      name: profile.name,
      remark: profile.remark,
      status: profile.status,
      platform: profile.platform,
      proxyType: profile.proxyType,
      host: profile.host,
      port: profile.port,
      country: profile.country || profile.lastCountry,
      lastIp: profile.lastIp,
      coreProduct: profile.coreProduct,
      coreVersion: profile.coreVersion,
      createdTime: profile.createdTime,
      updateTime: profile.updateTime,
    };
  }
}

module.exports = { BitBrowserProvider };
