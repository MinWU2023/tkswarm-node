/**
 * TKSwarm 前端接口配置
 * 业务数据一律走线上 PHP API；比特浏览器 / WebSocket 仍用本机 Node。
 */
window.__TKSWARM_CONFIG__ = {
  env: 'php',
  defaultApiBase: 'http://tkswarm-api.dyyweb.com',

  environments: {
    php: {
      apiBase: 'http://tkswarm-api.dyyweb.com',
      wsBase: 'ws://127.0.0.1:8999/ws',
      debug: true,
      envName: 'PHP API + MySQL'
    },
    local: {
      apiBase: 'http://tkswarm-api.dyyweb.com',
      wsBase: 'ws://127.0.0.1:8999/ws',
      debug: true,
      envName: 'PHP API + MySQL'
    },
    // 旧 production（同源 Node）已废弃，强制映射到线上 PHP
    production: {
      apiBase: 'http://tkswarm-api.dyyweb.com',
      wsBase: 'ws://127.0.0.1:8999/ws',
      debug: true,
      envName: 'PHP API + MySQL'
    },
    test: {
      apiBase: 'http://test-api.tkswarm.com',
      wsBase: 'ws://test-api.tkswarm.com/ws',
      debug: true,
      envName: '测试联调环境'
    }
  },

  getApiBase: function () {
    const fallback = this.defaultApiBase || 'http://tkswarm-api.dyyweb.com';
    let envMode = localStorage.getItem('tkswarm_env_mode') || this.env || 'php';
    if (envMode === 'local' || envMode === 'production') envMode = 'php';

    const custom = (localStorage.getItem('tkswarm_custom_api_base') || '').trim().replace(/\/+$/, '');

    // 禁止空域名 / 本机 Node 作为业务 API
    const isForbidden = (base) => {
      if (!base) return true;
      try {
        const u = new URL(base, location.href);
        const host = (u.hostname || '').toLowerCase();
        if (host === '127.0.0.1' || host === 'localhost') return true;
        if (base === location.origin) return true;
      } catch {
        return true;
      }
      return false;
    };

    if (envMode === 'custom') {
      return isForbidden(custom) ? fallback : custom;
    }
    if (custom && !isForbidden(custom)) {
      return custom;
    }
    const conf = this.environments[envMode] || this.environments.php;
    const base = (conf.apiBase || '').replace(/\/+$/, '');
    return isForbidden(base) ? fallback : base;
  },

  getWsBase: function () {
    const customWs = localStorage.getItem('tkswarm_custom_ws_base');
    if (customWs) return customWs;
    let envMode = localStorage.getItem('tkswarm_env_mode') || this.env || 'php';
    if (envMode === 'local' || envMode === 'production') envMode = 'php';
    const conf = this.environments[envMode] || this.environments.php;
    return conf.wsBase || 'ws://127.0.0.1:8999/ws';
  }
};

// 强制纠偏：业务 API 一律指向线上 PHP，清掉旧的空域名 / 本机配置
(function forceOnlinePhpApi() {
  try {
    const online = 'http://tkswarm-api.dyyweb.com';
    localStorage.setItem('tkswarm_env_mode', 'php');
    const custom = (localStorage.getItem('tkswarm_custom_api_base') || '').trim();
    const bad = !custom
      || custom === '/'
      || /127\.0\.0\.1|localhost/i.test(custom)
      || custom === 'http://tkswarm-api.wumin'
      || custom === 'http://tkswarm-api.wumin/';
    if (bad) {
      localStorage.setItem('tkswarm_custom_api_base', online);
    }
    localStorage.setItem('tkswarm_env_migrated_force_online_api', '3');
  } catch { /* ignore */ }
})();

window.TKSWARM_API_BASE = window.__TKSWARM_CONFIG__.getApiBase();
