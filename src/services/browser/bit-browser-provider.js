const { db } = require('../../db');

function setting(key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

class BitBrowserProvider {
  constructor() {
    this.baseUrl = String(setting('browserApiUrl', 'http://127.0.0.1:54345')).replace(/\/+$/, '');
    this.apiToken = String(setting('browserApiToken', ''));
  }

  async request(endpoint, payload = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (this.apiToken) headers.Authorization = `Bearer ${this.apiToken}`;
      const response = await fetch(`${this.baseUrl}/${endpoint.replace(/^\//, '')}`, {
        method: 'POST', headers, body: JSON.stringify(payload), signal: controller.signal,
        // A local BitBrowser API must not silently redirect to a cloud host.
        // Following such a redirect caused confusing ENOTFOUND errors when the
        // machine could not resolve serviceapi.bitbrowser.cn.
        redirect: 'manual',
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location') || '';
        throw new Error(`比特浏览器本地 API 返回重定向（${response.status}${location ? ` → ${location}` : ''}），请检查 BitBrowser 本地服务和环境 ID`);
      }
      const text = await response.text();
      let result;
      try { result = JSON.parse(text); } catch { throw new Error(`比特浏览器返回了非 JSON 数据（HTTP ${response.status}）`); }
      if (!response.ok || !result.success) throw new Error(result.msg || result.message || `比特浏览器请求失败（HTTP ${response.status}）`);
      return result.data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error(`比特浏览器请求超时：${endpoint}`);
      if (error.cause?.code === 'ECONNREFUSED') throw new Error('无法连接比特浏览器，请先启动比特浏览器并启用本地 API');
      if (error.cause?.code === 'ENOTFOUND' || error.code === 'ENOTFOUND') throw new Error('比特浏览器本地 API 试图访问无法解析的云端地址，请重启 BitBrowser 本地服务并确认 API 地址为 http://127.0.0.1:54345');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  health() { return this.request('health'); }
  groups(page = 0, pageSize = 100) { return this.request('group/list', { page, pageSize }); }
  profiles(page = 0, pageSize = 100, name = '') { return this.request('browser/list', { page, pageSize, name }); }
  open(id) { return this.request('browser/open', { id }, 60000); }
  close(id) { return this.request('browser/close', { id }, 30000); }
  delete(id) { return this.request('browser/delete', { id }, 30000); }

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
