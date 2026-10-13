/**
 * Hash router + lazy page loader for tkswarm-node
 */
(function () {
  const CACHE_V = '10.42';
  const VIEW_TO_PAGE = {
    accounts: 'accounts',
    proxies: 'proxies',
    groups: 'groups',
    warm: 'warm',
    aiLeads: 'aiLeads',
    msgTemplates: 'msgTemplates',
    accountWork: 'accountWork',
    agent: 'agent',
    publish: 'publish',
    chat: 'chat',
    logs: 'logs',
    rbac: 'rbac',
    settings: 'settings',
    versions: 'versions',
    helpDocs: 'helpDocs',
    tickets: 'tickets',
    aiPlatform: 'aiPlatform',
    aiPromptTemplates: 'aiPromptTemplates',
    aiCallLogs: 'aiCallLogs',
    templates: 'templates',
    envInstallers: 'versions',
    uids: 'chat',
    system: 'settings'
  };

  const loaded = Object.create(null);
  let navigating = false;
  let started = false;

  function pageForView(view) {
    return VIEW_TO_PAGE[view] || view;
  }

  function parseHash() {
    let raw = (location.hash || '').replace(/^#\/?/, '').trim();
    if (raw === 'login') return { view: 'accounts', subview: '', login: true };
    if (!raw) return { view: 'accounts', subview: '', login: false };
    const parts = raw.split('/').filter(Boolean);
    return { view: parts[0] || 'accounts', subview: parts.slice(1).join('/') || '', login: false };
  }

  function toHash(view, subview) {
    if (!view) return '#/accounts';
    const sv = subview ? '/' + String(subview).replace(/^\/+/, '') : '';
    return '#/' + view + sv;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[data-page-src="' + src + '"]')) {
        resolve();
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.dataset.pageSrc = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('加载页面脚本失败: ' + src));
      document.body.appendChild(s);
    });
  }

  async function ensureDeps(page) {
    const deps = [];
    if (page === 'publish') deps.push({ kind: 'root', src: '/material-picker.js?v=' + CACHE_V });
    if (page === 'chat' || page === 'publish') deps.push({ kind: 'page', name: 'templates' });
    if (['accounts', 'proxies', 'chat', 'publish', 'warm', 'aiLeads', 'msgTemplates', 'uids'].includes(page)) {
      deps.push({ kind: 'page', name: 'groups' });
    }
    for (const d of deps) {
      if (d.kind === 'root') {
        await loadScript(d.src);
      } else if (!(loaded[d.name] || (window.AppPages && window.AppPages[d.name]))) {
        await loadScript('/js/pages/' + d.name + '.js?v=' + CACHE_V);
        loaded[d.name] = true;
      }
    }
  }

  async function ensurePage(view) {
    const page = pageForView(view);
    if (!(loaded[page] || (window.AppPages && window.AppPages[page]))) {
      await ensureDeps(page);
      await loadScript('/js/pages/' + page + '.js?v=' + CACHE_V);
      loaded[page] = true;
    } else {
      loaded[page] = true;
      await ensureDeps(page);
    }
    return page;
  }

  /** 菜单一点就切导航+页壳，不等人脚本/接口 */
  function paintNavigateChrome(view, subview) {
    const app = window.app;
    if (!app || !app.canView(view)) return;
    app.syncNavActive?.(view);
    const metaKey = (view === 'chat' && (subview === 'uids' || subview === 'uid' || app.chatPane === 'uids')) ? 'uids' : view;
    const [pageTitle] = app.viewPageMeta?.(metaKey) || [];
    if (pageTitle) document.title = pageTitle + ' - TKSwarm';
    // 同页软切（矩阵 Tab）不抢壳
    if (view === 'publish' && app.view === 'publish') return;
    // 抬代次，作废仍在飞的旧页请求，避免盖住已展示的目标页壳
    app._navGen = (app._navGen || 0) + 1;
    app.showPageShell?.(view);
  }

  async function applyRoute(view, subview) {
    const app = window.app;
    if (!app) return;
    if (!app.canView(view)) {
      app.toast('当前角色无权访问该模块', true);
      return;
    }
    paintNavigateChrome(view, subview || '');
    await ensurePage(view);
    navigating = true;
    try {
      if (typeof app._navigateInternal === 'function') {
        await app._navigateInternal(view, subview || '');
      } else {
        await app.navigate(view, subview || '');
      }
    } finally {
      navigating = false;
    }
  }

  function patchApp() {
    const app = window.app;
    if (!app || app.__routerPatched) return;
    app.__routerPatched = true;

    app._navigateInternal = app.navigate.bind(app);
    app.navigate = async function (view, subview) {
      subview = subview || '';
      const hash = toHash(view, subview);
      navigating = true;
      if (location.hash !== hash) {
        history.replaceState(null, '', hash);
      }
      try {
        paintNavigateChrome(view, subview);
        await ensurePage(view);
        await app._navigateInternal(view, subview);
      } finally {
        navigating = false;
      }
    };

    const _refresh = app.refresh.bind(app);
    app.refresh = async function (opts) {
      try {
        await ensurePage(this.view);
      } catch (e) {
        this.toast(e.message, true);
        return;
      }
      const fn = this['render' + this.view[0].toUpperCase() + this.view.slice(1)];
      if (typeof fn !== 'function') {
        this.toast('页面模块未加载: ' + this.view, true);
        return;
      }
      return _refresh(opts);
    };

    app.router = { toHash, parseHash, ensurePage, applyRoute, pageForView, CACHE_V };
  }

  async function onHash() {
    if (navigating) return;
    const { view, subview, login } = parseHash();
    if (login) {
      window.app?.showLoginGate?.('请先登录');
      return;
    }
    await applyRoute(view, subview);
  }

  async function start() {
    if (started) return;
    started = true;
    const app = window.app;
    if (!app) throw new Error('app-core 未加载');
    patchApp();
    window.addEventListener('hashchange', () => {
      onHash().catch((e) => console.error(e));
    });

    const ready = await app.init();
    if (!ready) return;

    if (!location.hash || location.hash === '#' || location.hash === '#/') {
      history.replaceState(null, '', '#/accounts');
    }
    const { view, subview, login } = parseHash();
    if (login) {
      app.showLoginGate('请先登录');
      return;
    }
    await applyRoute(view || 'accounts', subview || '');
  }

  window.TkRouter = { start, ensurePage, parseHash, toHash, applyRoute, patchApp };
})();
