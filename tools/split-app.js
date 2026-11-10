/**
 * One-shot splitter: app.js → app-core.js + js/pages/*.js + router.js
 * Run from repo: node tools/split-app.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'public');
const SRC = path.join(ROOT, 'app.js');
const OUT_CORE = path.join(ROOT, 'js', 'app-core.js');
const OUT_ROUTER = path.join(ROOT, 'js', 'router.js');
const OUT_PAGES = path.join(ROOT, 'js', 'pages');
const CACHE_V = '10.0';

const src = fs.readFileSync(SRC, 'utf8');
const lines = src.split(/\n/);

// Parse object: starts with `const app = {` ends with `};` then maybe `app.init()`
const methods = [];
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^  (async )?([A-Za-z_][A-Za-z0-9_]*)\(/);
  if (m) methods.push({ name: m[2], start: i });
}
// property lines before first method (state)
const firstMethod = methods[0].start;
// Find end of each method: next method start - 1, or line before `};` closing app
let closeIdx = lines.length - 1;
for (let i = lines.length - 1; i >= 0; i--) {
  if (/^};?\s*$/.test(lines[i]) && i > 100) {
    // find `};` that closes app object - usually followed by window.app or app.init
    closeIdx = i;
    break;
  }
}
// Better: find line that is exactly `};` after last method
for (let i = methods[methods.length - 1].start; i < lines.length; i++) {
  if (lines[i] === '};' || lines[i] === '};') {
    closeIdx = i;
    break;
  }
}
for (let i = 0; i < methods.length; i++) {
  methods[i].end = (i + 1 < methods.length ? methods[i + 1].start : closeIdx) - 1;
  // trim trailing blank / comma-only handling: method body includes trailing comma on last line of method
}

function classify(name) {
  const n = name;
  // Core shared
  const coreExact = new Set([
    'api','esc','badge','toast','ask','downloadAuth','ensureBitOnline','ensureNodeOnline','probeNodeOnline',
    'nodeOwnedTaskHint','setPage','jumpPage','init','loadNavigationMenus','navMenuIcon','guessNavIcon',
    'isRemovedNavItem','filterNavTree','renderNavbarMenu','dispatchMenuClick','tickClock','clockCountryList','findClockCountry','applyClockPreference','bindClockCountryPicker','openClockCountryPicker','filterClockCountryPicker','selectClockCountry','getActingAsId',
    'ensureAuth','renderScopeSwitcher','toggleScopePanel','loadScopeUserOptions','filterScopeUsers','switchActingAs',
    'canPermission','canView','loadMeta','dictPairs','groupTypeLabel','loginStatusPairs','permModulePairs',
    'languagePairs','uiLanguagePairs','replyTonePairs','materialStatusPairs','modelTypePairs','translationModePairs',
    'notificationSoundPairs','browserWindowPairs','browserTypePairs','taskStatusPairs','massTargetPairs',
    'massChannelMeta','opt','exportFieldItems','viewPageMeta','renderUserChip','actionAccountSettings',
    'actionChangePassword','actionEnableAuthHint','openChangePasswordModal','actionRefreshPage','actionLogout',
    'authShell','showLoginGate','refreshCaptcha','showSetupGate','hideAuthGate','submitLogin','submitSetup',
    'logout','loadRefs','navigate','pageHead','refresh','connectLiveLogs','copyText','formatBytes','formatFileSize',
    'formRow','field','imageField','select','selectRaw','multiSelect','modal','closeModal','playTipSound',
    'previewTipSound','toggleToolbarDropdown','stat','statIco','statChip','rateField','remove','shuffleIds'
  ]);
  if (coreExact.has(n)) return 'core';

  // Page rules (order matters)
  if (/^(renderLiveLogs|renderLogs|setLogLevel|searchLiveLogs|clearLiveLogs|refreshLiveLog|renderDashboard)/.test(n)) return 'logs';
  if (/^(renderAiCall|searchAiCall|resetAiCall|viewAiCall|deleteAiCall|clearAiCall|aiLog)/i.test(n) || n.startsWith('aiCall')) return 'aiCallLogs';
  if (/^(renderAiPrompt|searchAiPrompt|resetAiPrompt|aiPrompt|editAiPrompt|previewAiPrompt|runAiPrompt|syncAiPrompt|addAiPrompt|removeAiPrompt|collectAiPrompt|toggleAiPrompt|deleteAiPrompt)/i.test(n)) return 'aiPromptTemplates';
  if (/^(renderAiPlatform|setAiPlatform|searchAiPlatform|resetAiPlatform|selectAiPlatform|toggleAiPlatform|aiPlatform|editAiPlatform|activateAiPlatform|deleteAiPlatform|testAiPlatform)/i.test(n)) return 'aiPlatform';
  if (/^(renderVersions|searchVersions|resetVersions|editVersion|uploadVersion|publishVersion|setLatestVersion|deleteVersion)/.test(n)) return 'versions';
  if (/^(renderHelp|searchHelp|resetHelp|editHelp|deleteHelp)/.test(n)) return 'helpDocs';
  if (/^(renderTickets|searchTickets|resetTickets|editTicket|deleteTicket)/.test(n)) return 'tickets';
  if (/^(renderSettings|bindSettings|scrollSettings|settingsInput|settingsSelect|changeEnvMode|saveEnvConfig|testBrowserConnection|openBitDownload|createBackup|restoreBackup|changeAuthPassword|addClock|removeClock)/.test(n)) return 'settings';
  if (/^(renderRbac|filterRbac|searchRbac|resetRbac|editPermission|deletePermission|editRole|deleteRole|editAdmin|deleteAdmin|clearRbac|editMenu|deleteMenu|refreshMenuTree)/.test(n)) return 'rbac';
  if (/^(renderGroups|switchGroupType|groupTable|editGroup|groupModal)/.test(n)) return 'groups';
  if (/^(renderTemplates|templateModal)/.test(n)) return 'templates';
  if (/^(renderWarm|openWarm|closeWarm|warm|searchWarm|resetWarm|editWarm|submitWarm|canWarm)/.test(n)) return 'warm';
  if (/^(renderAgent|bindAgent|batchDeleteAgents|emptyAgent|agentForm|setAgent|searchAgents|selectAgent|addAgent|collectAgent|saveAgent|toggleAgent|deleteAgent|openAgent|applyAgent|openTestChat|sendTestChat)/.test(n)) return 'agent';
  if (/^(renderChat|setChat|openChat|autoCheckChat|applyChat|clearChat|selectChat|searchChat|chat|startChat|stopChat|addChat|runChat|showChat|sendChat|useTemplate|togglePin|blockFriend|writeLocal|simulateInbound|bindAiHosting|editFriend|manageChat|deleteChatTag|insertChat|sendChatImage|batchChat|manageChatTemplates)/.test(n)) return 'chat';
  if (/^(renderUids|searchUids|importUid|exportUnused|cleanupUids|keepUnused|clearUid|dedupeUids|deleteUid|editUidGroup)/.test(n)) return 'chat';
  if (/^(renderProxies|resetProxy|bindProxy|copySelectedProxies|filterProxy|proxy|searchProxies|batchMoveProxies|batchDeleteProxies|openProxy|closeProxy|switchProxy|defaultProxy|collectProxy|submitProxy|downloadProxy|loadProxy|editProxy|copyProxy|testProxy|batchTest|fetchProxy|advancedDeleteProxies|toggleProxy)/.test(n)) return 'proxies';
  if (/^(batchImportProxies)$/.test(n)) return 'proxies';
  // publish / matrix / materials / tasks / mass / wizard
  if (/^(renderPublish|matrix|ensureMatrix|mountMatrix|switchMatrix|invalidateMatrix|renderTasks|setTask|searchTasks|resetTask|filterTasks|exportTask|openTask|defaultTask|switchTask|renderTask|task|batchRetry|batchDeleteTasks|batchTask|prepareTask|preflightTask|retryTask|retryFailed|resumePublish|confirmPublished|batchEditTask|editTaskItem|renderMaterials|publishMaterial|searchMaterials|resetMaterial|openMaterial|renderMaterial|material|previewMaterial|checkMaterial|onMaterialPicker|wizard|openPublish|closePublish|publishMode|collectWizard|bindWizard|renderWizard|removeWizard|clearWizard|handleWizard|uploadVideo|uploadPending|buildPair|createPublish|mass|openMass|closeMass|setMass|collectMass|fillMass|fillWizard|fillCompose|accountPick|toggleAccountPick|filterAccountPick|selectedAccountPick|setAccountPick|invertAccount|toggleCreatePublish)/.test(n)) return 'publish';
  if (/Wizard|wizard|Mass|massBody|massNext|massPrev|massSubmit|PairTask|Compose|matrixTab|Matrix/.test(n) && !/Warm/.test(n)) return 'publish';
  if (/^(renderMass|massWizard|massBody|massNext|massPrev|massSubmit|setMassScript)/.test(n)) return 'publish';
  // accounts + browser env under accounts
  if (/^(renderAccounts|toggleAccount|bindAccount|filterAccount|account|switchAccount|mountBrowser|accountsTable|batchDeleteAccounts|resetAccount|searchAccounts|openAccount|closeAccount|defaultAccount|renderAccount|collectAccount|submitAccount|loadAccount|batchAccount|downloadAccount|checkAccount|viewDiagnostics|syncTikTok|viewTikTok|previewTikTok|setAccountStatus|selectedAccountIds|toggleAccountBatch|exportAccounts|editAccount|authorizeCapCut|revokeCapCut|batchModify|modifyAccount|batchDeleteVideos|batchDeleteLocal|deleteTikTok|batchCheckAccount|detectProxyCountry|batchDetectProxy|monitorModal|runAccountMonitor|showMonitorResult|renderBrowser|browserTable|toggleBrowser|batchDeleteBrowser|deleteBrowser|bindBrowser|unbindBrowser|extractFingerprints|deleteBanned|copyAccountCk|addAccountSocks|canAssign|batchAssign|batchMoveAccounts|batchLogin|assignProxy|batchModifyIp|deleteBrowsersFromSettings)/.test(n)) return 'accounts';
  if (/Account|Browser|CapCut|TikTok|Monitor|Fingerprint|Socks/.test(n) && !/Chat|Warm|Pick|Mass|Wizard|ProxyIo|proxy/.test(n)) {
    // avoid stealing shared helpers wrongly — only if looks account-ish
    if (/^(batch|edit|sync|view|preview|check|authorize|revoke|run|show|copy|add|delete|can|toggle|filter|selected|export|import|mount|render|open|close|switch|default|collect|submit|load|download|set|unbind|bind)/.test(n)) return 'accounts';
  }
  if (/^(batchChatConnectModal)$/.test(n)) return 'chat';

  // leftover toggles that are generic UI
  if (/^toggle(TaskBatch|ProxyBatch|ChatMore|BrowserBatch)Menu$/.test(n)) {
    if (n.includes('Task')) return 'publish';
    if (n.includes('Proxy')) return 'proxies';
    if (n.includes('Chat')) return 'chat';
    if (n.includes('Browser')) return 'accounts';
  }

  // Catch remaining domain-looking names that slipped to core
  if (/AiPlatform|aiPlatform/.test(n)) return 'aiPlatform';
  if (/AiPrompt|aiPrompt/.test(n)) return 'aiPromptTemplates';
  if (/AiCall|aiLog|AiLog/.test(n)) return 'aiCallLogs';
  if (/Version/.test(n) && n !== 'formatFileSize') return 'versions';
  if (/HelpDoc|HelpCat|helpDoc|helpCat/.test(n)) return 'helpDocs';
  if (/Ticket/.test(n)) return 'tickets';
  if (/Rbac|Permission|AdminUser|MenuTree|RoleModal/.test(n)) return 'rbac';
  if (/Warm/.test(n)) return 'warm';
  if (/Agent|TestChat/.test(n)) return 'agent';
  if (/Chat|Uid|Friend|Inbound|Hosting|Emoji|SearchedUser|SyncMessages/.test(n)) return 'chat';
  if (/Proxy|proxy/.test(n)) return 'proxies';
  if (/Group/.test(n) && !/ScriptGroup/.test(n)) return 'groups';
  if (/Settings|Backup|AuthPassword|EnvConfig|EnvMode|BitDownload|Clock/.test(n)) return 'settings';
  if (/Material|Task|Publish|Wizard|Mass|Matrix|Compose/.test(n)) return 'publish';
  if (/Template/.test(n)) return 'templates';
  if (/LiveLog|Dashboard|LogLevel|LogSocket/.test(n)) return 'logs';

  return 'core';
}

const buckets = {};
for (const m of methods) {
  const page = classify(m.name);
  if (!buckets[page]) buckets[page] = [];
  buckets[page].push(m);
}

// Extract state block (lines 1..firstMethod-1) but strip `const app = {` handling
const stateAndHeader = lines.slice(0, firstMethod).join('\n');
// After close
const trailer = lines.slice(closeIdx + 1).join('\n');

function methodText(m) {
  return lines.slice(m.start, m.end + 1).join('\n');
}

function writePage(page, list) {
  if (page === 'core') return;
  const body = list.map(methodText).join('\n');
  const file = `(function () {
  if (!window.app) throw new Error('app-core must load before pages/${page}.js');
  const __methods = {
${body.split('\n').map(l => '  ' + l).join('\n')}
  };
  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages[${JSON.stringify(page)}] = true;
})();
`;
  fs.writeFileSync(path.join(OUT_PAGES, page + '.js'), file, 'utf8');
  console.log('page', page, list.length, 'methods', (file.length/1024).toFixed(1)+'KB');
}

for (const page of Object.keys(buckets).sort()) {
  if (page !== 'core') writePage(page, buckets[page]);
}

// Build core: state + core methods + navigate/refresh patches happen in router
const coreMethods = buckets.core || [];
const coreBody = coreMethods.map(methodText).join('\n');

const coreFile = `${stateAndHeader}
${coreBody}
};

window.app = app;
window.AppPages = window.AppPages || {};
`;
fs.writeFileSync(OUT_CORE, coreFile, 'utf8');
console.log('core methods', coreMethods.length, (coreFile.length/1024).toFixed(1)+'KB');

// Router
const VIEW_TO_PAGE = {
  accounts: 'accounts',
  proxies: 'proxies',
  groups: 'groups',
  warm: 'warm',
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
  system: 'settings',
};

const router = `/**
 * Hash router + lazy page loader for tkswarm-node
 */
(function () {
  const CACHE_V = ${JSON.stringify(CACHE_V)};
  const VIEW_TO_PAGE = ${JSON.stringify(VIEW_TO_PAGE, null, 2)};

  const loaded = Object.create(null);
  let navigating = false;

  function pageForView(view) {
    return VIEW_TO_PAGE[view] || view;
  }

  function parseHash() {
    let raw = (location.hash || '').replace(/^#\\/?/, '').trim();
    if (!raw || raw === 'login') return { view: 'accounts', subview: '', login: raw === 'login' };
    const parts = raw.split('/').filter(Boolean);
    const view = parts[0] || 'accounts';
    const subview = parts.slice(1).join('/') || '';
    return { view, subview, login: false };
  }

  function toHash(view, subview) {
    if (!view) return '#/accounts';
    const sv = subview ? '/' + String(subview).replace(/^\\/+/, '') : '';
    return '#/' + view + sv;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const exist = document.querySelector('script[data-page-src=\"' + src + '\"]');
      if (exist) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.dataset.pageSrc = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('加载页面脚本失败: ' + src));
      document.body.appendChild(s);
    });
  }

  async function ensurePage(view) {
    const page = pageForView(view);
    if (loaded[page] || (window.AppPages && window.AppPages[page])) {
      loaded[page] = true;
      return page;
    }
    // publish depends on material-picker helpers
    if (page === 'publish') {
      await loadScript('/material-picker.js?v=' + CACHE_V);
    }
    await loadScript('/js/pages/' + page + '.js?v=' + CACHE_V);
    loaded[page] = true;
    return page;
  }

  async function applyRoute(view, subview, opts) {
    const app = window.app;
    if (!app) return;
    opts = opts || {};
    if (!app.canView(view)) {
      app.toast('当前角色无权访问该模块', true);
      return;
    }
    await ensurePage(view);
    // Prefer existing navigate for pane/tab side-effects, but skip hash rewrite loop
    navigating = true;
    try {
      if (typeof app._navigateInternal === 'function') {
        await app._navigateInternal(view, subview || '', opts);
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
      if (location.hash !== hash) {
        navigating = true;
        location.hash = hash;
        // hashchange will call applyRoute; still run internal for immediate UX
      }
      await ensurePage(view);
      await app._navigateInternal(view, subview);
      navigating = false;
    };

    const _refresh = app.refresh.bind(app);
    app.refresh = async function () {
      try {
        await ensurePage(this.view);
      } catch (e) {
        this.toast(e.message, true);
        return;
      }
      return _refresh();
    };

    app.router = {
      toHash, parseHash, ensurePage, applyRoute, pageForView, CACHE_V
    };
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
    patchApp();
    window.addEventListener('hashchange', () => { onHash().catch(e => console.error(e)); });
    if (!location.hash || location.hash === '#' || location.hash === '#/') {
      location.replace('#/accounts');
    }
    // init already called from app-core; after auth, sync hash
    const { view, subview } = parseHash();
    if (window.app && window.app.authToken) {
      await applyRoute(view || 'accounts', subview || '');
    }
  }

  window.TkRouter = { start, ensurePage, parseHash, toHash, applyRoute };
})();
`;

fs.writeFileSync(OUT_ROUTER, router, 'utf8');
console.log('router written');

// Summary unclassified leftovers already in core
console.log('\\nBucket sizes:');
for (const [k,v] of Object.entries(buckets).sort((a,b)=>b[1].length-a[1].length)) {
  console.log(k, v.length);
}
