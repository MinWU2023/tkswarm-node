/**
 * Hash router + lazy page loader for tkswarm-node
 */
(function () {
  // 改 pages/*.js 后必须同步 +1：子页面按 ?v=CACHE_V 加载，版本不变浏览器会一直用缓存的旧文件
  const CACHE_V = '12.73';
  const VIEW_TO_PAGE = {
    accounts: 'accounts',
    proxies: 'proxies',
    registerEnvs: 'registerEnvs',
    groups: 'groups',
    warm: 'warm',
    aiLeads: 'aiLeads',
    autoFollow: 'autoFollow',
    videoBoost: 'videoBoost',
    videoDelivery: 'videoDelivery',
    msgTemplates: 'msgTemplates',
    accountWork: 'accountWork',
    accountWizard: 'accountWizard',
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
    smtpConfig: 'smtpConfig',
    dmWeightConfig: 'dmWeightConfig',
    nocaptchaKeys: 'nocaptchaKeys',
    videoDeliveryTypes: 'videoDeliveryTypes',
    youtubeConfig: 'youtubeConfig',
    youtubeAccounts: 'youtubeAccounts',
    youtubeSync: 'youtubeSync',
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
      let done = false;
      const finish = (err) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (err) reject(err);
        else resolve();
      };
      const timer = setTimeout(() => finish(new Error('加载页面脚本超时: ' + src)), 12000);
      s.onload = () => finish();
      s.onerror = () => finish(new Error('加载页面脚本失败: ' + src));
      document.body.appendChild(s);
    });
  }

  async function ensureDeps(page) {
    const deps = [];
    if (page === 'publish' || page === 'videoDelivery') {
      deps.push({ kind: 'root', src: '/material-picker.js?v=' + CACHE_V });
    }
    if (page === 'publish') { deps.push({ kind: 'page', name: 'pullVideo' }); deps.push({ kind: 'page', name: 'publishImages' }); }
    if (page === 'chat' || page === 'publish') deps.push({ kind: 'page', name: 'templates' });
    if (['accounts', 'proxies', 'chat', 'publish', 'warm', 'aiLeads', 'msgTemplates', 'uids', 'accountWizard'].includes(page)) {
      deps.push({ kind: 'page', name: 'groups' });
    }
    if (['accounts', 'proxies'].includes(page)) {
      deps.push({ kind: 'page', name: 'countryData' });
    }
    if (['accounts', 'publish', 'warm', 'aiLeads'].includes(page)) {
      deps.push({ kind: 'page', name: 'industryData' });
    }
    // 养号列表复用矩阵任务的三点菜单 / 批量启停等方法（toggleTaskOps、taskAction…）
    if (page === 'warm') {
      deps.push({ kind: 'page', name: 'publish' });
    }
    if (page === 'accountWizard') {
      deps.push({ kind: 'page', name: 'accounts' });
      deps.push({ kind: 'page', name: 'accountWork' });
    }
    if (page === 'aiLeads') {
      deps.push({ kind: 'page', name: 'aiLeadClues' });
      deps.push({ kind: 'page', name: 'aiLeadClueData' });
    }
    if (page === 'rbac') {
      deps.push({ kind: 'page', name: 'countryData' });
      deps.push({ kind: 'page', name: 'industryData' });
      deps.push({ kind: 'page', name: 'companyData' });
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

  /** 菜单一点就切导航页壳，不等人脚本/接口 */
  function paintNavigateChrome(view, subview) {
    const app = window.app;
    if (!app || !app.canNavigateMenu(view, subview || '')) return;
    app.syncNavActive?.(view);
    const metaKey = (view === 'chat' && (subview === 'uids' || subview === 'uid' || app.chatPane === 'uids')) ? 'uids'
      : (view === 'aiLeads' && (subview === 'clues' || app.aiLeadsPane === 'clues')) ? 'aiLeadClues'
      : view;
    const [pageTitle] = app.viewPageMeta?.(metaKey) || [];
    if (pageTitle) document.title = pageTitle + ' - TKSwarm';
    // 同页矩阵 Tab 软切：不抢壳；但若仍停在 page-shell-loading 或矩阵壳未就绪，必须重画
    if (view === 'publish' && app.view === 'publish') {
      const content = document.querySelector('#content');
      const stuckShell = !!content?.querySelector?.('.page-shell-loading');
      const matrixReady = !!(content?.querySelector?.('#matrix-body') && content?.querySelector?.('.matrix-tabs'));
      if (!stuckShell && matrixReady) return;
    }
    // bump nav generation
    app._navGen = (app._navGen || 0) + 1;
    app.showPageShell?.(view);
  }

  function demotePublishShell(app, subview) {
    if (!app || typeof app.ensureMatrixShell !== 'function') return;
    const sv = String(subview || '');
    let tab = app.matrixTab || 'tasks';
    if (sv === 'materials' || sv === 'material') tab = 'materials';
    else if (sv === 'material_import' || sv === 'folder_materials' || sv === 'import') tab = 'materialImport';
    else if (sv === 'pull_comments' || sv === 'pull_video_detail') tab = 'pullComments';
    else if (sv === 'pull_video_list' || sv === 'pull_image_list') tab = 'pullVideoList';
    else if (sv === 'pull_image_details') tab = 'pullComments';
    else if (sv === 'customer_tasks' || sv === 'customerTasks') tab = 'customerTasks';
    else if (sv === 'tasks' || sv === 'list' || sv === '' || sv === 'mass') tab = 'tasks';
    app.matrixTab = tab;
    try {
      const body = app.ensureMatrixShell(tab);
      if (body && (body.querySelector('.page-shell-loading') || !body.children.length || body.querySelector('.tk-list-loading'))) {
        body.innerHTML = (window.UI && UI.listLoadingHtml)
          ? UI.listLoadingHtml({ title: '正在加载数据', desc: '同步列表中，请稍候', fill: true })
          : '<div class="muted" style="padding:48px;text-align:center">加载中…</div>';
      }
    } catch (e) {
      console.warn('[router] demotePublishShell', e);
    }
  }

  async function applyRoute(view, subview) {
    const app = window.app;
    if (!app) return;
    if (!app.canNavigateMenu(view, subview || '')) {
      app.toast('当前角色无权访问该菜单', true);
      return;
    }
    paintNavigateChrome(view, subview || '');
    try {
      await ensurePage(view);
    } catch (e) {
      console.error(e);
      app.toast(e.message || String(e), true);
      const shell = document.querySelector('#content .page-shell-loading, #content .is-page-loading');
      if (shell) {
        shell.classList.add('is-fail');
        const tip = shell.querySelector('.loader-text span') || shell.querySelector('.muted');
        if (tip) tip.textContent = '加载失败：' + (e.message || '脚本未加载');
        const title = shell.querySelector('.loader-text b');
        if (title) title.textContent = '加载失败';
      }
      return;
    }
    // 脚本已就绪：立刻拆掉「正在加载页面」壳，再拉列表数据
    if (view === 'publish') demotePublishShell(app, subview || '');
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
        try {
          await ensurePage(view);
        } catch (e) {
          console.error(e);
          app.toast(e.message || String(e), true);
          return;
        }
        if (view === 'publish') demotePublishShell(app, subview);
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
    let { view, subview, login } = parseHash();
    if (login) {
      window.app?.showLoginGate?.('请先登录');
      return;
    }
    const app = window.app;
    if (app && !app.canNavigateMenu(view, subview || '')) {
      const first = app.firstAccessibleRoute?.();
      if (first) {
        view = first.view;
        subview = first.subview || '';
        history.replaceState(null, '', toHash(view, subview));
      }
    }
    await applyRoute(view, subview);
  }

  async function start() {
    if (started) return;
    started = true;
    const app = window.app;
    if (!app) throw new Error('app-core not loaded');
    patchApp();
    window.addEventListener('hashchange', () => {
      onHash().catch((e) => console.error(e));
    });

    const ready = await app.init();
    if (!ready) return;

    let { view, subview, login } = parseHash();
    if (!location.hash || location.hash === '#' || location.hash === '#/') {
      const first = app.firstAccessibleRoute?.();
      if (first) {
        view = first.view;
        subview = first.subview || '';
        history.replaceState(null, '', toHash(view, subview));
      } else {
        history.replaceState(null, '', '#/accounts');
        view = 'accounts';
        subview = '';
      }
    } else if (!login && !app.canNavigateMenu(view, subview || '')) {
      const first = app.firstAccessibleRoute?.();
      if (first) {
        view = first.view;
        subview = first.subview || '';
        history.replaceState(null, '', toHash(view, subview));
      }
    }
    if (login) {
      app.showLoginGate('请先登录');
      return;
    }
    await applyRoute(view || 'accounts', subview || '');
  }

  window.TkRouter = { start, ensurePage, parseHash, toHash, applyRoute, patchApp };
})();
