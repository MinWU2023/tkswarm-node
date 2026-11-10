/**
 * TkSwarm icon bridge — Lucide (local UMD)
 * https://lucide.dev
 */
(function () {
  const ALIAS = {
    'message-circle': 'message-circle',
    message: 'message-circle',
    'file-text': 'file-text',
    'plus-square': 'square-plus',
    'user-check': 'user-check',
    film: 'clapperboard',
    browser: 'app-window',
    window: 'app-window',
    qr: 'qr-code',
    activity: 'activity',
    bot: 'bot',
    cpu: 'cpu',
    video: 'video',
    send: 'send',
    inbox: 'inbox',
    monitor: 'monitor',
    shield: 'shield',
    menu: 'menu',
    settings: 'settings',
    package: 'package',
    book: 'book-open',
    ticket: 'ticket',
    lock: 'lock',
    plus: 'plus',
    trash: 'trash-2',
    search: 'search',
    refresh: 'refresh-cw',
    check: 'check',
    edit: 'pencil',
    download: 'download',
    upload: 'upload',
    play: 'play',
    shuffle: 'shuffle',
    eye: 'eye',
    close: 'x',
    pause: 'pause',
    more: 'ellipsis',
    user: 'user',
    users: 'users',
    list: 'list',
    folder: 'folder',
    globe: 'globe',
    server: 'server',
    sparkles: 'sparkles',
    wand: 'wand-sparkles',
    key: 'key-round',
    link: 'link',
    copy: 'copy',
    mail: 'mail',
    save: 'save',
    logout: 'log-out',
    login: 'log-in',
    ban: 'ban',
    warn: 'triangle-alert',
    info: 'info',
    clock: 'clock',
    calendar: 'calendar',
    image: 'image',
    smile: 'smile',
    emoji: 'smile',
    music: 'music',
    mic: 'mic',
    hash: 'hash',
    tag: 'tag',
    tags: 'tags',
    filter: 'filter',
    sort: 'arrow-up-down',
    home: 'house',
    chart: 'chart-column',
    database: 'database',
    wifi: 'wifi',
    zap: 'zap',
    rocket: 'rocket',
    layers: 'layers',
    layout: 'layout-dashboard',
    terminal: 'terminal',
    code: 'code',
    bug: 'bug',
    bell: 'bell',
    star: 'star',
    heart: 'heart',
    pin: 'pin',
    share: 'share-2',
    external: 'external-link',
    chevronDown: 'chevron-down',
    chevronRight: 'chevron-right',
    arrowLeft: 'arrow-left',
    arrowRight: 'arrow-right'
  };

  function resolveName(name) {
    const key = String(name || '').trim();
    if (!key) return 'circle';
    if (ALIAS[key]) return ALIAS[key];
    // already lucide kebab?
    if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key)) return key;
    return 'circle';
  }

  function createIcons(root) {
    const L = window.lucide;
    if (!L || typeof L.createIcons !== 'function' || !L.icons) return;
    try {
      // Lucide 0.468+ 必须显式传入 icons 全集
      L.createIcons({
        icons: L.icons,
        root: root || document,
        nameAttr: 'data-lucide',
        attrs: {
          class: ['ui-ico'],
          'stroke-width': '2',
          'aria-hidden': 'true'
        }
      });
    } catch (e) {
      console.warn('lucide.createIcons failed', e);
    }
  }

  // Patch UI once ui.js is present
  function patchUI() {
    if (!window.UI) return false;
    const UI = window.UI;

    UI.resolveLucideName = resolveName;
    UI.refreshIcons = createIcons;

    UI.icon = function (name) {
      const lucideName = resolveName(name);
      // Placeholder; Lucide replaces with full SVG on createIcons()
      return `<i data-lucide="${lucideName}" class="ui-ico" aria-hidden="true"></i>`;
    };

    const _decorate = UI.decorate.bind(UI);
    UI.decorate = function (root) {
      const r = root || document;
      _decorate(r);
      createIcons(r === document ? document.body : r);
    };

    // guessIcon 已在 ui.js 统一维护；此处仅补充 Lucide 别名映射
    const _guess = UI.guessIcon.bind(UI);
    UI.guessIcon = function (text) {
      const hit = _guess(text);
      if (hit) return hit;
      const t = UI.stripEmoji(text);
      if (/保存/.test(t)) return 'save';
      if (/退出|登出|注销/.test(t)) return 'logout';
      if (/进入/.test(t)) return 'login';
      if (/禁用|封禁|禁止/.test(t)) return 'ban';
      if (/警告|注意/.test(t)) return 'warn';
      if (/时间|时钟/.test(t)) return 'clock';
      if (/图片|封面|缩略/.test(t)) return 'image';
      if (/表情|Emoji/i.test(t)) return 'smile';
      if (/标签/.test(t)) return 'tag';
      if (/AI|智能|提示词/.test(t)) return 'sparkles';
      if (/下一步|继续/.test(t)) return 'arrowRight';
      if (/统计|报表|图表/.test(t)) return 'chart';
      if (/文件|模板/.test(t)) return 'file-text';
      return '';
    };

    createIcons(document.body);
    return true;
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    if (patchUI()) return;
    // ui.js may load after this script — retry briefly
    let n = 0;
    const t = setInterval(function () {
      n += 1;
      if (patchUI() || n > 40) clearInterval(t);
    }, 50);
  });

  window.TkIcons = { resolveName, createIcons, ALIAS };
})();
