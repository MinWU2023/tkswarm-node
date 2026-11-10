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
    // 本机 Node 页面走同源 /api，由 Node 转发至 PHP，避免跨域与混合内容
    try {
      const host = (location.hostname || '').toLowerCase();
      if (host === '127.0.0.1' || host === 'localhost') return '';
    } catch { /* ignore */ }
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

/** 每次调用取当前 API 根地址；本机 Node 下返回 ''（同源 /api 代理） */
window.getTkswarmApiBase = function () {
  return window.__TKSWARM_CONFIG__?.getApiBase?.() ?? '';
};
window.TKSWARM_API_BASE = window.getTkswarmApiBase();

/**
 * 统一美化层：在所有样式表之后追加 theme-polish.css（保证最后加载、覆盖冲突样式）。
 * index.html 编码非 UTF-8，故通过此处注入，避免直接改动该文件。
 */
(function injectPolishTheme() {
  try {
    if (document.querySelector('link[data-tk-polish], link[href*="theme-polish.css"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/theme-polish.css?v=2.6';
    link.setAttribute('data-tk-polish', '1');
    (document.head || document.documentElement).appendChild(link);
  } catch { /* ignore */ }
})();
