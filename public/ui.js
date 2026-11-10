const UI = {
  icons: {
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M4 7h16M9 7V5h6v2M8 7l1 12h6l1-12"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-3.5-3.5"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.2-5.5"/><path d="M20 4v6h-6"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    edit: '<path d="M4 20h4l10-10-4-4L4 16v4z"/>',
    download: '<path d="M12 4v10M8 10l4 4 4-4M5 20h14"/>',
    upload: '<path d="M12 16V6M8 10l4-4 4 4M5 20h14"/>',
    play: '<path d="M8 6l10 6-10 6z"/>',
    shuffle: '<path d="M16 5h4v4"/><path d="M4 9l4-4 5 6"/><path d="M20 5l-6 7"/><path d="M16 19h4v-4"/><path d="M4 15l4 4 4.5-5.5"/><path d="M20 19l-5.5-6.5"/>',
    message: '<path d="M4 6h16v10H8l-4 3V6z"/><path d="M8 10h8M8 13h5"/>',
    film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 5v14M16 5v14M3 9.5h5M16 9.5h5M3 14.5h5M16 14.5h5"/>',
    eye: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    pause: '<path d="M8 5h3v14H8zM13 5h3v14h-3z"/>',
    more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    browser: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v5"/>',
    window: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
    server: '<rect x="3" y="4" width="18" height="6" rx="1"/><rect x="3" y="14" width="18" height="6" rx="1"/><path d="M7 7h.01M7 17h.01"/>',
    bot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M9 8V6a3 3 0 0 1 6 0v2M9 14h.01M15 14h.01M8 18h8"/>',
    cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 9h6v6H9zM9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/>',
    video: '<rect x="3" y="6" width="12" height="12" rx="2"/><path d="m15 10 6-3v10l-6-3z"/>',
    send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/>',
    inbox: '<path d="M22 12h-6l-2 3H10l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l1.92-1.92a5 5 0 0 0-7.07-7.07L10.5 6.5"/><path d="M14 11a5 5 0 0 0-7.54-.54L4.54 12.38a5 5 0 0 0 7.07 7.07L13.5 17.5"/>',
    scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12"/>',
    'bar-chart': '<path d="M4 20V10M10 20V4M16 20v-7M22 20V8"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    monitor: '<rect x="2" y="4" width="20" height="14" rx="2"/><path d="M8 22h8M12 18v4"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    'user-check': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.36.56.96.9 1.6.9H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    package: '<path d="M16.5 9.4 7.55 4.24M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.29 7 12 12l8.71-5M12 22V12"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    ticket: '<path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M13 5v2M13 11v2M13 17v2"/>',
    qr: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2M18 14h2v2M14 18h2v2M18 18h2v2"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    'plus-square': '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 8v8M8 12h8"/>',
  },
  iconAliases: {
    'message-circle': 'message',
    'file-text': 'file-text',
    'plus-square': 'plus-square',
    'user-check': 'user-check',
  },
  icon(name) {
    const key = String(name || '').trim();
    const resolved = this.icons[key] ? key : (this.iconAliases[key] || key);
    const path = this.icons[resolved] || this.icons.menu || this.icons.plus;
    return `<svg class="ui-ico" viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
  },
  stripEmoji(text = '') {
    return String(text || '')
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  },
  /** 按钮已配图标 + 时，去掉文案里重复的文字加号 */
  stripLeadingPlus(text = '') {
    const t = String(text || '').trim();
    if (t === '+') return t;
    return t.replace(/^\+\s*/, '');
  },
  /** 按钮文案：去 emoji / 下拉箭头 / 手工符号图标，避免与自动图标重复 */
  stripButtonText(text = '') {
    return this.stripLeadingPlus(
      this.stripEmoji(String(text || ''))
        .replace(/[▾▼]/g, '')
        .replace(/[✓✔✕✖×→←⬆⬇☁★☆●○◆◇■□▲△▼▽]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    );
  },
  buttonHasPresetIcon(btn) {
    if (!btn) return false;
    // 仅认真实图标；下拉箭头 ▾ 不算已有图标（否则「批量操作」永远补不上 layers）
    return !!btn.querySelector('.ui-ico, i[data-lucide], .warm-ico, svg.lucide');
  },
  /** 同一按钮只保留一个图标，去掉重复叠放 */
  dedupeButtonIcons(btn) {
    if (!btn) return;
    const icons = [...btn.querySelectorAll('.ui-ico, i[data-lucide], svg.lucide, .warm-ico')];
    if (icons.length <= 1) return;
    icons.slice(1).forEach((n) => n.remove());
  },
  guessIcon(text) {
    const t = this.stripEmoji(text);
    if (!t) return '';
    if (/^(更多|\.\.\.|…|⋮|\+)$/.test(t)) return t === '+' ? 'plus' : 'more';
    if (/^(复制|拷贝)$/.test(t)) return 'copy';
    if (/^(检测|测试)$/.test(t)) return 'wifi';
    if (/^(分配|认领)$/.test(t)) return 'users';
    if (/^(绑定|关联)$/.test(t)) return 'link';
    if (/^(解绑|解除)$/.test(t)) return 'link';
    if (/开启推送/.test(t)) return 'mail';
    if (/关闭推送/.test(t)) return 'close';
    if (/^(打开|开启)$/.test(t)) return 'monitor';
    if (/^(关闭|取消)$/.test(t) || /^取消/.test(t) || /批量取消/.test(t)) return 'close';
    if (/^(刷新)$/.test(t)) return 'refresh';
    if (/^(批量操作)$/.test(t) || /批量修改|批量登录|批量转移|批量创建|批量删除账号/.test(t)) return 'layers';
    if (/高级删除|删除封号|删除代理|删除分组|批量删除/.test(t)) return 'trash';
    if (/编辑分组|修改资料/.test(t)) return 'edit';
    if (/添加子组|加子组|添加一级分组/.test(t)) return 'plus';
    if (/转移分组/.test(t)) return 'folder';
    if (/复制代理/.test(t)) return 'copy';
    if (/代理检测/.test(t)) return 'wifi';
    if (/认领代理/.test(t)) return 'user-check';
    if (/分配用户|分配代理|分配关联/.test(t)) return 'users';
    if (/添加IP|添加代理|添加账号|添加话术|添加分类/.test(t)) return 'plus';
    if (/获取云代理/.test(t)) return 'download';
    if (/导入导出/.test(t)) return 'upload';
    if (/刷新代理|同步环境|同步账号|重新检测/.test(t)) return 'refresh';
    if (/开启同步|开常态|开启常态/.test(t)) return 'check';
    if (/取消同步|取消本地|关常态|关闭常态/.test(t)) return 'close';
    if (/常态化/.test(t)) return 'refresh';
    if (/提取指纹/.test(t)) return 'key';
    if (/监控设置/.test(t)) return 'settings';
    if (/高级筛选/.test(t)) return 'filter';
    if (/隐藏统计|显示统计/.test(t)) return 'eye';
    if (/检测登录/.test(t)) return 'search';
    if (/绑定账号/.test(t)) return 'link';
    if (/本地标记/.test(t)) return 'check';
    if (/查看数据|查看详情|明细|详情/.test(t)) return 'list';
    if (/返回/.test(t)) return 'arrowLeft';
    if (/导出数据|下载.*模板|CSV 模板/.test(t)) return 'download';
    if (/导入数据|开始导入|逐行文本/.test(t)) return 'upload';
    if (/重置筛选/.test(t)) return 'refresh';
    if (/使用|全选|反选|清空/.test(t)) return 'check';
    if (/^(删|删除)$/.test(t) || /删除|移除|拉黑/.test(t)) return 'trash';
    if (/再绑环境|重新绑定|重绑/.test(t)) return 'link';
    if (/打开环境|浏览器环境|创建环境|更新环境包/.test(t)) return 'monitor';
    if (/CapCut|capcut/.test(t)) return 'scissors';
    if (/拉取数据|拉取/.test(t)) return 'download';
    if (/诊断/.test(t)) return 'activity';
    if (/执行前检查|预检/.test(t)) return 'search';
    if (/查询|搜索|检查/.test(t)) return 'search';
    if (/重置|刷新|同步|重试|重启|重推/.test(t)) return 'refresh';
    if (/暂停/.test(t)) return 'pause';
    if (/保存|确定|确认/.test(t)) return 'check';
    if (/登录/.test(t)) return 'login';
    if (/创建/.test(t)) return 'plus';
    if (/^(改|编辑)$/.test(t) || /编辑|修改/.test(t)) return 'edit';
    if (/导出|下载|CSV|csv|结果/.test(t)) return 'download';
    if (/积分充值|充值积分/.test(t) || /^(充值)$/.test(t)) return 'coins';
    if (/导入|上传|添加/.test(t)) return 'upload';
    if (/预览|查看/.test(t)) return 'eye';
    if (/随机发布/.test(t)) return 'shuffle';
    if (/群发|回复评论|删除视频/.test(t)) return 'film';
    if (/独立发布/.test(t)) return 'play';
    if (/^(发布)$/.test(t)) return 'send';
    if (/生成/.test(t)) return 'sparkles';
    if (/启动|发送|方案/.test(t)) return 'play';
    if (/发布/.test(t)) return 'send';
    if (/设置|配置/.test(t)) return 'settings';
    if (/新建|新增/.test(t)) return 'plus';
    if (/上一步/.test(t)) return 'arrowLeft';
    if (/下一步|继续/.test(t)) return 'arrowRight';
    if (/改文案/.test(t)) return 'edit';
    if (/重下|下载视频/.test(t)) return 'download';
    return '';
  },
  shouldSkipButtonDecor(btn) {
    if (!btn || btn.dataset.uiIcon === 'off') return true;
    if (btn.classList.contains('icon-btn') || btn.classList.contains('account-pick-tag')
      || btn.classList.contains('combo-trigger') || btn.classList.contains('combo-option')
      || btn.classList.contains('ai-platform-card') || btn.classList.contains('group-item-main')
      || btn.classList.contains('group-fold-btn') || btn.classList.contains('pager-num')
      || btn.classList.contains('pager-nav') || btn.classList.contains('pager-jump-go')
      || btn.classList.contains('executor-toggle') || btn.classList.contains('scope-tool-btn')
      || btn.classList.contains('composer-icon-btn') || btn.classList.contains('user-menu-item')
      || btn.classList.contains('clock-country-card') || btn.classList.contains('clock-icon')
      || btn.classList.contains('schedule-tz-preview-btn')
      || btn.classList.contains('account-pick-query')
      || btn.closest('.pager,.clock-country-grid,#clock,.schedule-tz-field,.account-pick-toolbar,.account-pick-batch')) return true;
    const inMenu = !!btn.closest('.dropdown-menu,.ops-menu');
    if (inMenu) return false;
    return !!btn.closest('.combo,.combo-menu,.nav-menu,.matrix-tabs,.subtabs,.chat-filters,.filter-sidebar,.chat-mode-switch,.chat-friend-tabs,.settings-menu,.channels,.wizard-steps,.account-pick-grid,.ai-platform-grid,#user-dropdown-wrap,.user-dropdown-wrap,.user-dropdown-menu,#hv-bell-wrap,.hv-bell-wrap,.hv-bell-panel,.group-tabs');
  },
  isIconOnlyAction(label) {
    return /^(编辑|改|删除|删|检查|预览|发布|更多|\.\.\.|…|⋮|\+|复制|检测|分配|绑定|解绑|打开|关闭)$/.test(String(label || '').trim());
  },
  decorate(root = document) {
    if (!root) return;
    // 为全系统所有按钮根据功能自动配置语义色彩与纯白图标
    const colorClasses = ['primary', 'ghost', 'danger', 'tiny', 'info', 'warn', 'success'];
    root.querySelectorAll('button').forEach(btn => {
      if (this.shouldSkipButtonDecor(btn)) return;
      this.dedupeButtonIcons(btn);
      const label = this.stripButtonText(btn.textContent);
      if (!label) return;

      // 智能匹配 Element 级语义色彩类名（如果没有显式指定关键类名）
      if (!colorClasses.some(cls => btn.classList.contains(cls))) {
        if (/删除|移除|拉黑|取消|批量删除/.test(label)) {
          btn.classList.add('danger');
        } else if (/确定|确认|保存|登录|创建|添加|生成/.test(label)) {
          btn.classList.add('primary');
        } else if (/暂停|告警/.test(label)) {
          btn.classList.add('warn');
        } else if (/查询|搜索|刷新|重试|检查|同步|测试/.test(label)) {
          btn.classList.add('info');
        } else if (/重置/.test(label)) {
          // 重置统一走白底描边 ghost，避免 info 白图标叠白底
          btn.classList.add('ghost');
        } else if (/成功|导出|下载/.test(label)) {
          btn.classList.add('success');
        } else {
          btn.classList.add('ghost');
        }
      }

      if (this.buttonHasPresetIcon(btn)) {
        this.dedupeButtonIcons(btn);
        btn.dataset.uiDecorated = label;
        return;
      }
      if (btn.dataset.uiDecorated === label && btn.querySelector('.ui-ico, i[data-lucide], svg.lucide')) return;
      const hasDownArrow = !!btn.querySelector('.btn-arrow-down') || /[▾▼]/.test(btn.textContent || '');
      const arrowSpan = hasDownArrow ? '<span class="btn-arrow-down">▾</span>' : '';
      const name = this.guessIcon(label);
      const displayLabel = label;
      btn.dataset.uiDecorated = label;
      const inMenu = !!btn.closest('.ops-menu,.dropdown-menu,.combo-menu');
      const iconOnly = !inMenu && !hasDownArrow && this.isIconOnlyAction(label) && name;
      if (iconOnly) {
        if (!btn.getAttribute('title')) btn.setAttribute('title', displayLabel || label);
        if (!btn.getAttribute('aria-label')) btn.setAttribute('aria-label', displayLabel || label);
        btn.classList.add('icon-only-act');
        btn.innerHTML = this.icon(name);
      } else if (hasDownArrow) {
        // 批量操作 / 创建▾：图标 + 文案 + 箭头，只插一次图标
        btn.classList.remove('icon-only-act');
        btn.innerHTML = name
          ? `${this.icon(name)}<span class="btn-label">${this.esc(displayLabel)}</span>${arrowSpan}`
          : `<span class="btn-label">${this.esc(displayLabel)}</span>${arrowSpan}`;
      } else if (name) {
        btn.classList.remove('icon-only-act');
        btn.innerHTML = `${this.icon(name)}<span class="btn-label">${this.esc(displayLabel)}</span>`;
      } else {
        btn.classList.remove('icon-only-act');
        btn.innerHTML = `<span class="btn-label">${this.esc(displayLabel)}</span>`;
      }
    });

    // 侧栏分组等文字操作 → 图标
    root.querySelectorAll('.group-act').forEach((el) => {
      const label = this.stripEmoji(el.textContent);
      if (!label || el.dataset.uiDecorated === label) return;
      const name = this.guessIcon(label);
      if (!name) return;
      el.dataset.uiDecorated = label;
      if (!el.getAttribute('title')) el.setAttribute('title', label);
      el.classList.add('icon-only-act');
      el.innerHTML = this.icon(name);
    });

    root.querySelectorAll('img').forEach(img => {
      if (img.closest('.thumb-wrap') || img.closest('.uploader-item') || img.closest('.preview-mask') || img.closest('.logo') || img.classList.contains('brand-logo') || !img.src) return;
      if (img.width && img.width > 240) return;
      const wrap = document.createElement('span');
      wrap.className = 'thumb-wrap';
      img.parentNode.insertBefore(wrap, img);
      wrap.appendChild(img);
      const peek = document.createElement('span');
      peek.className = 'peek';
      peek.innerHTML = '<svg class="ui-ico" viewBox="0 0 24 24" style="width:18px;height:18px"><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/></svg>';
      wrap.appendChild(peek);
      wrap.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.openPreview(img.currentSrc || img.src);
      });
    });
    root.querySelectorAll('select').forEach(sel => this.combo(sel));
    root.querySelectorAll('.uploader').forEach(box => this.bindUploader(box));
    root.querySelectorAll('.rich-editor-box').forEach(box => this.bindRichEditor(box));
  },
  bindRichEditor(box) {
    if (box.dataset.bound) return;
    box.dataset.bound = '1';
    const content = box.querySelector('.rich-content');
    const hidden = box.querySelector('input[type=hidden]');
    if (!content || !hidden) return;

    box.querySelectorAll('.rich-btn').forEach(btn => {
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const cmd = btn.dataset.cmd;
        if (!cmd) return;
        document.execCommand(cmd, false, null);
        hidden.value = content.innerHTML;
      });
    });

    content.addEventListener('input', () => {
      hidden.value = content.innerHTML;
    });
    content.addEventListener('blur', () => {
      hidden.value = content.innerHTML;
    });
  },
  notify({ type = 'info', title, message = '', duration = 3200 } = {}) {
    const titles = { success: '成功', error: '错误', warn: '警告', info: '提示' };
    const icons = {
      success: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>',
      error: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
      warn: '<svg viewBox="0 0 24 24"><path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 17.5h.01"/></svg>',
      info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 8h.01"/></svg>',
    };
    const stack = document.querySelector('#toast-stack');
    if (!stack) return;
    const kind = ['success', 'error', 'warn', 'info'].includes(type) ? type : 'info';
    const item = document.createElement('div');
    item.className = `toast-item el-message el-message--${kind} ${kind}`;
    item.innerHTML = `<div class="mark toast-icon">${icons[kind]}</div><div class="toast-body"><b class="toast-title">${this.esc(title || titles[kind])}</b><p class="toast-desc">${this.esc(message || '')}</p></div><button type="button" class="x toast-close" aria-label="关闭"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
    if (!message) item.querySelector('.toast-desc')?.remove();
    const close = () => {
      item.classList.add('is-leaving');
      setTimeout(() => item.remove(), 220);
    };
    item.querySelector('.toast-close').onclick = close;
    stack.appendChild(item);
    requestAnimationFrame(() => item.classList.add('is-enter'));
    setTimeout(close, Math.max(1200, duration || 3200));
    this.trimToastStack();
  },
  /** 正在进行的任务条不参与数量裁剪，避免把「正在打开中」顶掉；普通消息仍只留 5 条 */
  trimToastStack() {
    const stack = document.querySelector('#toast-stack');
    if (!stack) return;
    const plain = [...stack.children].filter((el) => !el.classList.contains('is-task'));
    for (let i = 0; i < plain.length - 5; i += 1) plain[i].remove();
  },
  /**
   * 常驻加载提示（右上角，与消息提示同一位置，可同时存在多条）。
   * @returns {{update:Function, success:Function, error:Function, close:Function, el:HTMLElement|null}}
   */
  notifyLoading({ title = '处理中', message = '', key = '' } = {}) {
    const stack = document.querySelector('#toast-stack');
    const icons = {
      success: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>',
      error: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
    };
    const marks = { success: '#16a34a', error: '#e11d48' };
    if (!stack) return { update() {}, success() {}, error() {}, close() {}, el: null };
    const item = document.createElement('div');
    item.className = 'toast-item el-message info is-task';
    if (key) item.dataset.taskKey = String(key);
    item.innerHTML = `<div class="mark toast-icon" style="background:#e0efff;color:#2563eb">`
      + `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="stroke:#2563eb">`
      + `<path d="M12 3a9 9 0 1 0 9 9"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.85s" repeatCount="indefinite"/></path>`
      + `</svg></div><div class="toast-body"><b class="toast-title">${this.esc(title)}</b><p class="toast-desc">${this.esc(message)}</p></div>`
      + '<button type="button" class="x toast-close" aria-label="关闭"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
    if (!message) item.querySelector('.toast-desc')?.remove();
    const titleEl = item.querySelector('.toast-title');
    const bodyEl = item.querySelector('.toast-body');
    const markEl = item.querySelector('.mark');
    const setText = (nextTitle, nextMessage) => {
      if (nextTitle != null && titleEl) titleEl.textContent = String(nextTitle);
      if (nextMessage == null) return;
      let desc = bodyEl?.querySelector('.toast-desc');
      if (!desc && bodyEl) {
        desc = document.createElement('p');
        desc.className = 'toast-desc';
        bodyEl.appendChild(desc);
      }
      if (desc) desc.textContent = String(nextMessage);
    };
    let timer = null;
    const close = () => {
      if (!item.isConnected) return;
      item.classList.add('is-leaving');
      setTimeout(() => item.remove(), 220);
    };
    const finish = (kind, nextMessage, duration = 2800) => {
      if (!item.isConnected) return;
      item.classList.remove('info');
      item.classList.add(kind);
      item.classList.remove('is-task');
      if (markEl) {
        markEl.innerHTML = icons[kind] || icons.success;
        markEl.style.background = marks[kind] || marks.success;
        markEl.style.color = '#fff';
        markEl.querySelector('svg')?.removeAttribute('style');
      }
      if (nextMessage != null) setText(null, nextMessage);
      clearTimeout(timer);
      timer = setTimeout(close, Math.max(1200, duration));
      this.trimToastStack();
    };
    item.querySelector('.toast-close').onclick = close;
    stack.appendChild(item);
    requestAnimationFrame(() => item.classList.add('is-enter'));
    this.trimToastStack();
    return {
      el: item,
      update(nextMessage, nextTitle) { setText(nextTitle, nextMessage); },
      success(nextMessage, duration) { finish('success', nextMessage, duration); },
      error(nextMessage, duration) { finish('error', nextMessage, duration ?? 6000); },
      close,
    };
  },
  esc(value = '') {
    return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  },
  liftMenu(menu, anchor, opts = {}) {
    if (!menu || menu.classList.contains('hidden')) return;
    // 三点 / 批量菜单抬升前统一装饰一次，保证菜单项有图标且不重复叠放
    try { this.decorate(menu); } catch (_) { /* ignore */ }
    this._bindMenuFollow?.();
    const setImp = (prop, val) => menu.style.setProperty(prop, val, 'important');
    const home = menu._liftHome || menu.parentElement;
    let target = anchor || menu._liftAnchor || home;
    if (!menu._liftHome) menu._liftHome = home;
    if (target) menu._liftAnchor = target;
    const isOps = !!(opts.side === 'left' || menu.classList.contains('ops-menu') || home?.classList?.contains('ops-dropdown') || /^account-ops-/.test(menu.id || '') || /^proxy-ops-/.test(menu.id || '') || /^task-ops-/.test(menu.id || ''));
    if (isOps && target?.querySelector) {
      const btn = target.matches?.('button') ? target : target.querySelector('button');
      if (btn) { target = btn; menu._liftAnchor = btn; }
    }
    // 工具栏「批量操作」等：锚到触发按钮本身
    if (!isOps && target?.closest?.('.dropdown')) {
      const btn = target.matches?.('button') ? target : (target.querySelector?.('button') || target.closest?.('.dropdown')?.querySelector?.('button'));
      if (btn) { target = btn; menu._liftAnchor = btn; }
    }
    const inModal = !!(target && target.closest && target.closest('#modal, .modal'));
    if (menu.parentElement !== document.body) document.body.appendChild(menu);
    const isCombo = menu.classList.contains('combo-menu');
    // combo：宽度/锚点严格对齐触发条，禁止被选项长文案撑宽
    let anchorEl = target;
    if (isCombo) {
      const owner = menu._owner || target?.closest?.('.combo');
      const triggerEl = (target?.matches?.('.combo-trigger') && target)
        || target?.querySelector?.('.combo-trigger')
        || owner?.querySelector?.('.combo-trigger')
        || target;
      if (triggerEl) {
        anchorEl = triggerEl;
        menu._liftAnchor = triggerEl;
      }
    }
    const rect = (anchorEl && anchorEl.getBoundingClientRect) ? anchorEl.getBoundingClientRect() : { top: 80, bottom: 112, left: 16, right: 196, width: 180 };
    const width = isOps
      ? Math.max(188, menu.scrollWidth || 188)
      : (isCombo ? Math.max(1, Math.round(rect.width)) : Math.max(180, Math.round(Math.max(rect.width || 180, menu.scrollWidth || 180))));
    menu.classList.add('is-lifted');
    menu.classList.toggle('from-modal', inModal);
    menu.classList.toggle('ops-float', isOps);
    setImp('position', 'fixed');
    setImp('right', 'auto');
    setImp('margin', '0');
    setImp('box-sizing', 'border-box');
    setImp('width', width + 'px');
    setImp('min-width', width + 'px');
    setImp('max-width', width + 'px');
    const gap = 8;
    let left;
    const alignLeft = !!(opts.align === 'left' || menu.classList.contains('align-left'));
    if (isOps || opts.side === 'left') {
      left = rect.left - width - gap;
      if (left < gap) left = Math.min(rect.right + gap, window.innerWidth - width - gap);
    } else if (isCombo || alignLeft) {
      left = rect.left;
    } else {
      left = rect.right - width;
    }
    if (left < gap) left = gap;
    if (left + width > window.innerWidth - gap) left = Math.max(gap, window.innerWidth - width - gap);
    const spaceBelow = Math.max(120, window.innerHeight - rect.bottom - gap);
    const spaceAbove = Math.max(120, rect.top - gap);
    const avail = Math.max(160, window.innerHeight - gap * 2);
    if (isOps) {
      setImp('max-height', avail + 'px');
      setImp('overflow-y', 'auto');
    } else if (isCombo) {
      // 固定面板高度：筛选条 + 选项区(最多约 220px)，选项行高固定，多了滚动
      const comboPanelMax = 280;
      const preferBelow = spaceBelow >= Math.min(comboPanelMax, spaceAbove);
      const comboMax = Math.min(comboPanelMax, preferBelow ? spaceBelow : spaceAbove);
      setImp('max-height', comboMax + 'px');
      setImp('height', 'auto');
      setImp('overflow', 'hidden');
      setImp('display', 'flex');
      setImp('flex-direction', 'column');
    } else {
      // 工具栏下拉（批量操作等）：限制高度可滚动，避免超出视口
      const panelMax = Math.min(420, Math.max(spaceBelow, spaceAbove));
      setImp('max-height', panelMax + 'px');
      setImp('overflow-y', 'auto');
    }
    // 先写 left，再量高度（combo 受 max-height 约束后 scrollHeight 更准）
    setImp('left', left + 'px');
    const height = Math.min(menu.scrollHeight || menu.offsetHeight || 220, isCombo ? 280 : avail);
    let top;
    if (isOps) {
      top = Math.min(Math.max(gap, rect.top), window.innerHeight - height - gap);
    } else if (isCombo) {
      const preferBelow = spaceBelow >= Math.min(280, spaceAbove) || spaceBelow >= height;
      if (preferBelow) top = rect.bottom + 4;
      else top = Math.max(gap, rect.top - height - 4);
    } else {
      top = rect.bottom + 4;
      if (top + Math.min(height, 280) > window.innerHeight - gap && rect.top > height + gap) {
        top = Math.max(gap, rect.top - Math.min(height, 280) - 4);
      }
    }
    setImp('top', top + 'px');
  },
  _bindMenuFollow() {
    if (this._menuFollowBound) return;
    this._menuFollowBound = true;
    let ticking = false;
    const repos = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        document.querySelectorAll('.dropdown-menu.is-lifted:not(.hidden), .combo-menu.is-lifted:not(.hidden)').forEach(menu => {
          const anchor = menu._liftAnchor;
          if (anchor && anchor.isConnected) {
            const r = anchor.getBoundingClientRect?.();
            // 锚点滚出视口则关闭，避免菜单悬空
            if (!r || r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) {
              menu.classList.add('hidden');
              this.restoreMenu(menu);
              return;
            }
            this.liftMenu(menu, anchor);
          } else {
            menu.classList.add('hidden');
            this.restoreMenu(menu);
          }
        });
      });
    };
    window.addEventListener('scroll', repos, true);
    window.addEventListener('resize', repos);
  },
  restoreMenu(menu) {
    if (!menu) return;
    menu.classList.remove('is-lifted', 'from-modal', 'ops-float');
    ['position', 'top', 'left', 'right', 'width', 'min-width', 'max-width', 'max-height', 'height', 'overflow', 'overflow-y', 'margin', 'display', 'flex-direction', 'box-sizing'].forEach((p) => {
      menu.style.removeProperty(p);
    });
    if (menu._liftHome && menu._liftHome.isConnected && menu.parentElement !== menu._liftHome) menu._liftHome.appendChild(menu);
  },
  syncMenus() {
    document.querySelectorAll('.dropdown-menu, .combo-menu').forEach(menu => {
      if (menu.classList.contains('hidden')) this.restoreMenu(menu);
      else this.liftMenu(menu, menu._liftAnchor || menu._owner?.querySelector?.('.combo-trigger') || menu._owner?.querySelector?.('.combo-input-wrapper'));
    });
  },
  restorePopups() {
    document.querySelectorAll('.dropdown-menu, .combo-menu').forEach(menu => {
      if (menu._liftHome && menu._liftHome.isConnected) this.restoreMenu(menu);
      else if (menu.classList.contains('is-lifted') && menu.parentElement === document.body) menu.remove();
    });
  },
  _dialogRoot(el) {
    if (!el) return null;
    if (typeof el === 'string') return document.querySelector(el);
    return el;
  },
  _dialogFsSvg:
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  _dialogRestoreSvg:
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  dialogFullscreenButtonsHtml(rootSelector) {
    const root = String(rootSelector || '').replace(/'/g, "\\'");
    return `<button type="button" class="dialog-fs icon-btn" data-dialog-fs onclick="UI.toggleDialogFullscreen('${root}',true)" aria-label="全屏" title="全屏">${this._dialogFsSvg}</button>`
      + `<button type="button" class="dialog-restore icon-btn hidden" data-dialog-restore onclick="UI.toggleDialogFullscreen('${root}',false)" aria-label="恢复默认" title="恢复默认">${this._dialogRestoreSvg}</button>`;
  },
  setDialogFullscreen(root, fullscreen) {
    const el = this._dialogRoot(root);
    if (!el) return;
    const on = !!fullscreen;
    el.classList.toggle('dialog-fullscreen', on);
    const fs = el.querySelector('[data-dialog-fs]');
    const rs = el.querySelector('[data-dialog-restore]');
    fs?.classList.toggle('hidden', on);
    rs?.classList.toggle('hidden', !on);
  },
  toggleDialogFullscreen(root, force) {
    const el = this._dialogRoot(root);
    if (!el) return;
    const next = force === true ? true : force === false ? false : !el.classList.contains('dialog-fullscreen');
    this.setDialogFullscreen(el, next);
  },
  resetDialogFullscreen(root) {
    this.setDialogFullscreen(root, false);
  },
  _ensureTechLoader(el) {
    if (!el || el.dataset.techLoader === '1') return;
    el.dataset.techLoader = '1';
    const card = el.querySelector('.loader-card');
    if (!card) return;
    if (!card.querySelector('.loader-visual')) {
      const oldSpin = card.querySelector('.ep-spinner');
      const visual = document.createElement('div');
      visual.className = 'loader-visual';
      visual.setAttribute('aria-hidden', 'true');
      visual.innerHTML = `
        <div class="loader-orbit">
          <i class="loader-ring r1"></i>
          <i class="loader-ring r2"></i>
          <i class="loader-core"></i>
          <i class="loader-pulse"></i>
        </div>
        <div class="loader-check">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
        </div>`;
      if (oldSpin) oldSpin.replaceWith(visual);
      else card.prepend(visual);
    }
    if (!card.querySelector('.loader-text')) {
      const box = document.createElement('div');
      box.className = 'loader-text';
      box.innerHTML = '<b id="loading-title">正在提交</b><span id="loading-desc">请稍候…</span>';
      card.appendChild(box);
    }
  },
  /** 列表/页壳加载占位：水平竖直居中，科技风轨道图标 + 文案 */
  listLoadingHtml(opts = {}) {
    const esc = (s) => String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    const title = esc(opts.title || '正在加载数据');
    const desc = esc(opts.desc || '同步列表中，请稍候…');
    const compact = opts.compact ? ' is-compact' : '';
    const fail = opts.fail ? ' is-fail' : '';
    const fill = opts.fill ? ' is-fill' : '';
    const icon = opts.iconSvg || `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>`;
    return `<div class="tk-list-loading${compact}${fail}${fill}" role="status" aria-live="polite" aria-busy="${opts.fail ? 'false' : 'true'}">
      <div class="tk-list-loading-card">
        <div class="loader-visual" aria-hidden="true">
          <div class="loader-orbit">
            <i class="loader-ring r1"></i>
            <i class="loader-ring r2"></i>
            <i class="loader-pulse"></i>
            <span class="tk-list-loading-ico">${icon}</span>
          </div>
        </div>
        <div class="loader-text">
          <b>${title}</b>
          <span>${desc}</span>
        </div>
      </div>
    </div>`;
  },
  /** 在已有页面的列表容器内铺加载占位（翻页/筛选软刷新用） */
  paintListLoading(root, opts = {}) {
    const el = typeof root === 'string' ? document.querySelector(root) : root;
    if (!el || el.nodeType !== 1) return 0;
    if (el.querySelector?.('.page-shell-loading')) return 0;
    const sels = [
      '.table-container',
      '[data-list-host]',
      '.ai-lead-table-wrap',
      '.ai-clue-table-wrap',
      '.ind-table-wrap',
      '.uid-table-wrap',
      '.task-detail-table',
      '#matrix-body',
      '#af-detail-table',
      '#proxy-table-host',
      '.account-pick-grid',
      '.pc-mat-pick',
      '.pc-card-grid',
      '.chat-list',
      '.chat-friend-list',
      '.msg-tpl-list',
    ];
    const nodes = [...el.querySelectorAll(sels.join(','))];
    let n = 0;
    const html = this.listLoadingHtml({ compact: true, ...opts });
    nodes.forEach((host) => {
      if (nodes.some((o) => o !== host && o.contains(host))) return;
      host.innerHTML = html;
      host.classList.add('is-list-loading');
      n += 1;
    });
    return n;
  },
  loading(show, text, desc, opts = {}) {
    const el = document.querySelector('#page-loading');
    if (!el) return;
    this._ensureTechLoader(el);
    const title = el.querySelector('#loading-title') || el.querySelector('b');
    const tip = el.querySelector('#loading-desc') || el.querySelector('span');
    if (text && title) title.textContent = text;
    if (desc != null && tip) tip.textContent = desc;
    el.classList.toggle('is-plain', !!opts.plain);
    el.classList.toggle('is-success', opts.mode === 'success');
    el.classList.toggle('is-submit', !opts.plain && opts.mode !== 'success');
    if (show) {
      el.classList.remove('hidden');
      requestAnimationFrame(() => el.classList.add('is-visible'));
    } else {
      el.classList.remove('is-visible');
      setTimeout(() => {
        el.classList.add('hidden');
        el.classList.remove('is-plain', 'is-success', 'is-submit');
      }, 220);
    }
  },
  confirm({
    title = '请确认操作',
    message = '',
    html = '',
    type = 'warn',
    okText = '确定',
    cancelText = '取消',
    wide = false,
  } = {}) {
    const mask = document.querySelector('#confirm-mask');
    const card = mask?.querySelector('.confirm-card');
    if (!mask) return Promise.resolve(window.confirm(message || '确认？'));
    // 连续二次确认时，上一次关闭动画的 setTimeout 不能把新弹窗又藏起来
    this._confirmSeq = (this._confirmSeq || 0) + 1;
    const seq = this._confirmSeq;
    if (this._confirmHideTimer) {
      clearTimeout(this._confirmHideTimer);
      this._confirmHideTimer = null;
    }
    const kind = type === 'danger' ? 'error' : (['error', 'warn', 'info', 'success'].includes(type) ? type : 'warn');
    const icons = {
      success: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>',
      error: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
      warn: '<svg viewBox="0 0 24 24"><path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 17.5h.01"/></svg>',
      info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 8h.01"/></svg>',
    };
    document.querySelector('#confirm-title').textContent = title;
    const desc = document.querySelector('#confirm-desc');
    if (html) {
      desc.innerHTML = html;
    } else {
      // 支持多行文案（任务汇总「全部清除」等）
      const text = String(message || '');
      if (text.includes('\n')) {
        desc.innerHTML = text
          .split('\n')
          .map((line) => `<div>${String(line)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')}</div>`)
          .join('');
      } else {
        desc.textContent = text;
      }
    }
    const iconEl = document.querySelector('#confirm-icon');
    if (iconEl) iconEl.innerHTML = icons[kind];
    card.className = `confirm-card el-message-box ${kind}${wide ? ' confirm-wide' : ''}`;
    const ok = document.querySelector('#confirm-ok');
    const cancel = document.querySelector('#confirm-cancel');
    ok.textContent = okText;
    cancel.textContent = cancelText;
    ok.className = `ep-btn ${kind === 'error' ? 'ep-btn-danger' : 'ep-btn-primary'}`;
    cancel.className = 'ep-btn ep-btn-default';
    this.resetDialogFullscreen(mask);
    mask.classList.remove('hidden');
    requestAnimationFrame(() => {
      if (this._confirmSeq === seq) mask.classList.add('is-visible');
    });
    return new Promise(resolve => {
      const done = (value) => {
        // 若已打开更新的确认框，旧回调只 resolve，不再动 DOM
        if (this._confirmSeq !== seq) {
          resolve(value);
          return;
        }
        mask.classList.remove('is-visible');
        this._confirmHideTimer = setTimeout(() => {
          this._confirmHideTimer = null;
          if (this._confirmSeq !== seq) return;
          mask.classList.add('hidden');
          card.classList.remove('confirm-wide');
          this.resetDialogFullscreen(mask);
          if (html || String(message || '').includes('\n')) desc.textContent = '';
        }, 160);
        ok.onclick = null;
        cancel.onclick = null;
        mask.onclick = null;
        resolve(value);
      };
      ok.onclick = () => done(true);
      cancel.onclick = () => done(false);
      mask.onclick = (e) => { if (e.target === mask) done(false); };
    });
  },
  openPreview(src) {
    if (!src) return;
    const mask = document.querySelector('#preview-mask');
    const img = document.querySelector('#preview-image');
    if (!mask || !img) return;
    this.resetDialogFullscreen(mask);
    img.src = src;
    mask.classList.remove('hidden');
  },
  closePreview() {
    const mask = document.querySelector('#preview-mask');
    if (!mask) return;
    mask.classList.add('hidden');
    this.resetDialogFullscreen(mask);
  },
  combo(sel) {
    if (sel.multiple || sel.dataset.combo === 'off') return;
    if (sel.closest('.combo') || sel.classList.contains('ui-native')) {
      const box = sel.closest('.combo');
      const display = box?.querySelector('.combo-display');
      const cur = sel.selectedOptions[0];
      if (display && cur) display.textContent = cur.textContent.trim();
      // 兼容旧版单输入结构：同步为选中文案
      const legacy = box?.querySelector('.combo-input:not(.combo-filter)');
      if (legacy && cur) legacy.value = cur.textContent.trim();
      return;
    }
    const field = sel.parentElement;
    if (!field) return;
    const box = document.createElement('div');
    box.className = 'combo';
    if (sel.style.cssText) {
      box.style.cssText = sel.style.cssText;
    }
    if (sel.style.width) box.style.width = sel.style.width;
    if (sel.style.maxWidth) box.style.maxWidth = sel.style.maxWidth;
    if (sel.style.minWidth) box.style.minWidth = sel.style.minWidth;
    sel.parentNode.insertBefore(box, sel);
    box.appendChild(sel);
    sel.classList.add('ui-native');

    const wrapper = document.createElement('div');
    wrapper.className = 'combo-input-wrapper';

    // 触发区：只显示当前选中，不可输入
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'combo-trigger';
    const display = document.createElement('span');
    display.className = 'combo-display';
    display.textContent = sel.selectedOptions[0]?.textContent?.trim() || '请选择';
    const arrow = document.createElement('span');
    arrow.className = 'combo-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    trigger.appendChild(display);
    trigger.appendChild(arrow);
    wrapper.appendChild(trigger);

    const menu = document.createElement('div');
    menu.className = 'combo-menu hidden';
    box.appendChild(wrapper);
    box.appendChild(menu);
    menu._owner = box;
    box._menu = menu;
    box._comboFilter = '';

    const syncDisplay = () => {
      const cur = sel.selectedOptions[0];
      display.textContent = cur ? cur.textContent.trim() : '请选择';
    };

    const syncMenuWidth = () => {
      const triggerRect = trigger.getBoundingClientRect();
      const wrapRect = wrapper.getBoundingClientRect();
      const targetWidth = Math.round(triggerRect.width || wrapRect.width || box.getBoundingClientRect().width || 0);
      if (targetWidth > 0) {
        menu.style.setProperty('width', targetWidth + 'px', 'important');
        menu.style.setProperty('min-width', targetWidth + 'px', 'important');
        menu.style.setProperty('max-width', targetWidth + 'px', 'important');
        menu.style.setProperty('box-sizing', 'border-box', 'important');
      }
    };

    const close = () => {
      if (menu.classList.contains('hidden')) return;
      menu.classList.add('hidden');
      wrapper.classList.remove('is-open');
      trigger.classList.remove('is-open');
      box._comboFilter = '';
      UI.restoreMenu(menu);
      syncDisplay();
    };

    const closeOthers = () => {
      document.querySelectorAll('.combo').forEach(other => {
        if (other === box) return;
        const m = other._menu || other.querySelector('.combo-menu');
        const w = other.querySelector('.combo-input-wrapper');
        const t = other.querySelector('.combo-trigger');
        if (m && !m.classList.contains('hidden')) {
          m.classList.add('hidden');
          w?.classList.remove('is-open');
          t?.classList.remove('is-open');
          other._comboFilter = '';
          UI.restoreMenu(m);
          const d = other.querySelector('.combo-display');
          const cur = other.querySelector('select')?.selectedOptions?.[0];
          if (d && cur) d.textContent = cur.textContent.trim();
        }
      });
    };

    const renderOptions = (filterText = '') => {
      const q = String(filterText || '').trim().toLowerCase();
      box._comboFilter = q;
      const options = [...sel.options].filter(opt => {
        if (opt.disabled) return false;
        // 无输入：显示全部；有输入：才按文案/值筛选
        if (!q) return true;
        return opt.textContent.toLowerCase().includes(q) || String(opt.value).toLowerCase().includes(q);
      });
      const listHtml = options.length
        ? options.map(opt => {
            const isSelected = String(opt.value) === String(sel.value);
            return `<button type="button" class="combo-option ${isSelected ? 'active is-selected' : ''}" data-value="${this.esc(opt.value)}"><span class="combo-option-text">${this.esc(opt.textContent)}</span>${isSelected ? '<span class="combo-option-check" aria-hidden="true">✓</span>' : ''}</button>`;
          }).join('')
        : '<div class="combo-empty muted">无匹配项</div>';
      return listHtml;
    };

    const render = (filterText = '', focusFilter = false) => {
      syncMenuWidth();
      const q = filterText == null ? (box._comboFilter || '') : filterText;
      menu.innerHTML = `
        <div class="combo-filter-bar">
          <input type="search" class="input combo-filter" placeholder="输入筛选..." autocomplete="off" value="${this.esc(q)}">
        </div>
        <div class="combo-option-list">${renderOptions(q)}</div>
      `;
      syncMenuWidth();
      menu.classList.remove('hidden');
      wrapper.classList.add('is-open');
      trigger.classList.add('is-open');
      UI.liftMenu(menu, trigger);
      const filterInput = menu.querySelector('.combo-filter');
      if (focusFilter && filterInput) {
        requestAnimationFrame(() => {
          // 再次对齐宽度，避免内容渲染后偏差
          syncMenuWidth();
          UI.liftMenu(menu, trigger);
          filterInput.focus();
          const len = filterInput.value.length;
          try { filterInput.setSelectionRange(len, len); } catch (_) {}
        });
      }
    };

    const selectOption = (btn) => {
      if (!btn) return;
      sel.value = btn.dataset.value;
      syncDisplay();
      close();
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const open = (focusFilter = true) => {
      closeOthers();
      // 打开时始终先展示全部列表，筛选框为空
      box._comboFilter = '';
      render('', focusFilter);
    };

    menu.addEventListener('mousedown', (e) => {
      // 防止点筛选框时触发外部关闭；选项选择用 click
      if (e.target.closest('.combo-filter-bar')) {
        e.stopPropagation();
        return;
      }
      const btn = e.target.closest('button.combo-option');
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        selectOption(btn);
      }
    });

    menu.addEventListener('click', (e) => {
      const btn = e.target.closest('button.combo-option');
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        selectOption(btn);
      }
    });

    menu.addEventListener('input', (e) => {
      const inp = e.target.closest?.('.combo-filter');
      if (!inp) return;
      const q = inp.value;
      const list = menu.querySelector('.combo-option-list');
      if (list) list.innerHTML = renderOptions(q);
      syncMenuWidth();
      UI.liftMenu(menu, trigger);
    });

    menu.addEventListener('keydown', (e) => {
      if (!e.target.closest?.('.combo-filter')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        trigger.focus();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const activeOpt = menu.querySelector('button.combo-option.is-kbd') || menu.querySelector('button.combo-option.active') || menu.querySelector('button.combo-option');
        if (activeOpt) selectOption(activeOpt);
        else close();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const opts = [...menu.querySelectorAll('button.combo-option')];
        if (!opts.length) return;
        const cur = menu.querySelector('button.combo-option.is-kbd') || menu.querySelector('button.combo-option.active');
        let idx = opts.indexOf(cur);
        if (e.key === 'ArrowDown') idx = idx < 0 ? 0 : Math.min(opts.length - 1, idx + 1);
        else idx = idx < 0 ? opts.length - 1 : Math.max(0, idx - 1);
        opts.forEach(o => o.classList.remove('is-kbd'));
        opts[idx].classList.add('is-kbd');
        opts[idx].scrollIntoView({ block: 'nearest' });
      }
    });

    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (menu.classList.contains('hidden')) open(true);
      else close();
    });

    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (menu.classList.contains('hidden')) open(true);
      } else if (e.key === 'Escape') {
        close();
      }
    });

    if (!UI._comboOutsideBound) {
      UI._comboOutsideBound = true;
      document.addEventListener('pointerdown', (e) => {
        const menuHit = e.target.closest?.('.combo-menu');
        const targetCombo = e.target.closest?.('.combo') || menuHit?._owner;
        document.querySelectorAll('.combo').forEach(c => {
          if (c !== targetCombo) {
            const m = c._menu || c.querySelector('.combo-menu');
            const w = c.querySelector('.combo-input-wrapper');
            const t = c.querySelector('.combo-trigger');
            if (m && !m.classList.contains('hidden')) {
              m.classList.add('hidden');
              w?.classList.remove('is-open');
              t?.classList.remove('is-open');
              c._comboFilter = '';
              UI.restoreMenu(m);
              const d = c.querySelector('.combo-display');
              const cur = c.querySelector('select')?.selectedOptions?.[0];
              if (d && cur) d.textContent = cur.textContent.trim();
            }
          }
        });
      });
    }
  },
  bindUploader(box) {
    if (box.dataset.bound) return;
    box.dataset.bound = '1';
    const input = box.querySelector('input[type=file]');
    const hidden = box.querySelector('input[type=hidden]');
    const list = box.querySelector('.uploader-list');
    const pick = box.querySelector('[data-pick]');
    const open = () => input?.click();
    const runUpload = () => this.uploadImages(input, hidden, list, box.dataset.multiple === 'true', box);
    pick?.addEventListener('click', open);
    box.addEventListener('dragover', (event) => { event.preventDefault(); box.classList.add('drag'); });
    box.addEventListener('dragleave', () => box.classList.remove('drag'));
    box.addEventListener('drop', (event) => {
      event.preventDefault();
      box.classList.remove('drag');
      if (input && event.dataTransfer?.files) {
        input.files = event.dataTransfer.files;
        runUpload();
      }
    });
    input?.addEventListener('change', runUpload);
    this.bindUploaderListActions(list, hidden);
  },
  bindUploaderListActions(list, hidden) {
    if (!list) return;
    list.querySelectorAll('img').forEach((img) => {
      img.onclick = () => this.openPreview(img.src);
    });
    list.querySelectorAll('video').forEach((video) => {
      video.onclick = (e) => {
        e.preventDefault();
        if (video.paused) video.play().catch(() => {});
        else video.pause();
      };
    });
    list.querySelectorAll('button[data-url]').forEach((btn) => {
      btn.onclick = () => {
        const left = String(hidden.value || '').split(',').filter((url) => url && url !== btn.dataset.url);
        hidden.value = left.join(',');
        btn.parentElement?.remove();
      };
    });
  },
  readImageSize(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const size = { width: img.naturalWidth || 0, height: img.naturalHeight || 0 };
        URL.revokeObjectURL(url);
        resolve(size);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('无法读取图片信息'));
      };
      img.src = url;
    });
  },
  readVideoDuration(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        const duration = Number(video.duration) || 0;
        URL.revokeObjectURL(url);
        resolve(duration);
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('无法读取视频信息'));
      };
      video.src = url;
    });
  },
  async validateUploadFiles(files, box) {
    const allowVideo = box?.dataset?.allowVideo === 'true';
    const maxVideoSec = Math.max(1, Number(box?.dataset?.maxVideoSec || 6));
    const minImage = Math.max(0, Number(box?.dataset?.minImage || 0));
    const imageExt = /\.(jpe?g|png|webp|gif)$/i;
    const videoExt = /\.mp4$/i;
    const ok = [];
    for (const file of files) {
      const name = String(file.name || '');
      const mime = String(file.type || '').toLowerCase();
      const isImage = mime.startsWith('image/') || imageExt.test(name);
      const isVideo = mime === 'video/mp4' || mime === 'application/mp4' || videoExt.test(name);
      if (isVideo) {
        if (!allowVideo) throw new Error('当前仅支持上传图片');
        if (!videoExt.test(name) && mime !== 'video/mp4' && mime !== 'application/mp4') {
          throw new Error('动态头像仅支持 MP4 格式');
        }
        let duration = 0;
        try {
          duration = await this.readVideoDuration(file);
        } catch {
          throw new Error(`视频「${name}」无法读取时长，请更换文件`);
        }
        if (!(duration > 0) || duration > maxVideoSec + 0.05) {
          throw new Error(`视频「${name}」时长为 ${duration.toFixed(1)} 秒，不得超过 ${maxVideoSec} 秒`);
        }
        ok.push(file);
        continue;
      }
      if (!isImage) {
        throw new Error(`「${name}」格式不支持，请上传 JPG/PNG 图片${allowVideo ? '或不超过 6 秒的 MP4' : ''}`);
      }
      if (minImage > 0) {
        let size;
        try {
          size = await this.readImageSize(file);
        } catch {
          throw new Error(`图片「${name}」无法读取尺寸，请更换文件`);
        }
        if (size.width < minImage || size.height < minImage) {
          throw new Error(`图片「${name}」尺寸为 ${size.width}x${size.height}，最低 ${minImage}x${minImage}px`);
        }
      }
      ok.push(file);
    }
    return ok;
  },
  renderUploaderItem(url) {
    const isVid = /\.mp4($|\?)/i.test(url);
    if (isVid) {
      return `<div class="uploader-item is-video"><video src="${this.esc(url)}" muted playsinline></video><button type="button" class="danger" data-url="${this.esc(url)}">×</button></div>`;
    }
    return `<div class="uploader-item"><img src="${this.esc(url)}" alt=""><button type="button" class="danger" data-url="${this.esc(url)}">×</button></div>`;
  },
  async uploadImages(input, hidden, list, multiple, box) {
    const files = [...(input.files || [])];
    if (!files.length) return;
    const host = box || input?.closest?.('.uploader');
    try {
      const valid = await this.validateUploadFiles(files.slice(0, multiple ? 9 : 1), host);
      if (!valid.length) return;
      const body = new FormData();
      valid.forEach((file) => body.append('files', file));
      const hasVideo = valid.some((f) => /\.mp4$/i.test(f.name) || String(f.type).includes('video'));
      this.loading(true, hasVideo ? '正在上传视频' : '正在上传图片');
      const headers = {};
      if (window.app?.authToken) headers.Authorization = 'Bearer ' + window.app.authToken;
      const response = await fetch('/api/uploads/images', { method: 'POST', headers, body });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.message || '上传失败');
      const urls = (json.data.items || []).map((item) => item.url);
      const current = multiple ? String(hidden.value || '').split(',').filter(Boolean) : [];
      const next = multiple ? [...current, ...urls] : urls.slice(0, 1);
      hidden.value = next.join(',');
      list.innerHTML = next.map((url) => this.renderUploaderItem(url)).join('');
      this.bindUploaderListActions(list, hidden);
      window.app?.toast(urls.some((u) => /\.mp4($|\?)/i.test(u)) ? '文件已上传' : '图片已上传');
    } catch (error) {
      window.app?.toast(error.message, true);
    } finally {
      this.loading(false);
      input.value = '';
    }
  },
  rulesFor(name, type, required) {
    const rules = [];
    if (required) rules.push('required');
    if (type === 'number' || name === 'port' || name === 'intervalMinutes' || name === 'temperature') rules.push('number');
    if (name === 'port') rules.push('port');
    if (name === 'host') rules.push('host');
    if (name === 'totpSecret') rules.push('base32');
    if (/email/i.test(name)) rules.push('email');
    if (name === 'password' && required) rules.push('min:6');
    if (name === 'newPassword') rules.push('min:6');
    if (name === 'username' && required) rules.push('min:1', 'max:80');
    if (name === 'signature' || name === 'bio' || name === 'profileBio') rules.push('max:80');
    if (name === 'intervalMinutes') rules.push('min:1', 'max:1440');
    if (name === 'temperature') rules.push('min:0', 'max:2');
    return rules.join('|');
  },
  validate(form) {
    let message = '';
    form.querySelectorAll('[data-rule]').forEach(el => {
      el.closest('.field')?.classList.remove('is-error');
      const error = el.closest('.field')?.querySelector('.field-error');
      if (error) error.textContent = '';
      const value = String(el.value || '').trim();
      const rules = String(el.dataset.rule || '').split('|').filter(Boolean);
      let reason = '';
      for (const rule of rules) {
        if (rule === 'required' && !value) reason = '此项为必填';
        else if (!value) continue;
        else if (rule === 'number' && Number.isNaN(Number(value))) reason = '请输入数字';
        else if (rule === 'port') { const n = Number(value); if (!Number.isInteger(n) || n < 1 || n > 65535) reason = '端口需为 1-65535 的整数'; }
        else if (rule === 'host' && !/^([a-zA-Z0-9.-]+|\d{1,3}(\.\d{1,3}){3})$/.test(value)) reason = '主机格式不正确';
        else if (rule === 'base32' && !/^[A-Z2-7]+=*$/i.test(value.replace(/\s/g, ''))) reason = '2FA 密钥需为 Base32';
        else if (rule === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) reason = '邮箱格式不正确';
        else if (rule.startsWith('min:')) { const n = Number(rule.slice(4)); if (el.type === 'number' || rules.includes('number') || rules.includes('port')) { if (Number(value) < n) reason = `不能小于 ${n}`; } else if (value.length < n) reason = `至少 ${n} 个字符`; }
        else if (rule.startsWith('max:') && el.type !== 'number' && value.length > Number(rule.slice(4))) reason = `不能超过 ${rule.slice(4)} 个字符`;
        if (reason) break;
      }
      if (reason) {
        el.closest('.field')?.classList.add('is-error');
        if (error) error.textContent = reason;
        if (!message) message = `${el.closest('.field')?.querySelector('label')?.innerText || '字段'}：${reason}`;
      }
    });
    return message;
  },
  pager(pack, pageKey, opts = {}) {
    if (!pack) return '';
    const pageSize = Math.max(1, Number(pack.pageSize || opts.pageSize || 20));
    const total = Number(pack.total || 0);
    let pages = Number(pack.pages || pack.lastPage || 0);
    if (!pages) pages = Math.max(1, Math.ceil(total / pageSize) || 1);
    pages = Math.max(1, pages);
    const page = Math.min(pages, Math.max(1, Number(pack.page || 1)));
    if (pages <= 1 && total <= 0) return '';
    const windowSize = Math.min(6, Math.max(1, Number(opts.windowSize || 6)));
    let start = Math.max(1, page - Math.floor(windowSize / 2));
    let end = Math.min(pages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    const nums = [];
    for (let i = start; i <= end; i++) nums.push(i);
    const prev = Math.max(1, page - 1);
    const next = Math.min(pages, page + 1);
    const disFirst = page <= 1 ? 'disabled' : '';
    const disLast = page >= pages ? 'disabled' : '';
    const key = String(pageKey || 'page').replace(/[^a-zA-Z0-9_]/g, '');
    const jumpId = `pager-jump-${key}`;
    return `<div class="pager" data-page-key="${key}">
      <div class="pager-inner">
        <button type="button" class="pager-nav" ${disFirst} onclick="app.setPage('${key}',1)" title="首页" aria-label="首页">«</button>
        <button type="button" class="pager-nav" ${disFirst} onclick="app.setPage('${key}',${prev})" title="上一页" aria-label="上一页">‹</button>
        <div class="pager-pages">${nums
          .map(
            (n) =>
              `<button type="button" class="pager-num ${n === page ? 'is-on' : ''}" onclick="app.setPage('${key}',${n})" ${n === page ? 'aria-current="page"' : ''}>${n}</button>`
          )
          .join('')}</div>
        <button type="button" class="pager-nav" ${disLast} onclick="app.setPage('${key}',${next})" title="下一页" aria-label="下一页">›</button>
        <button type="button" class="pager-nav" ${disLast} onclick="app.setPage('${key}',${pages})" title="末页" aria-label="末页">»</button>
        <div class="pager-jump">
          <span>跳至</span>
          <input type="number" class="pager-jump-input" id="${jumpId}" min="1" max="${pages}" value="${page}" inputmode="numeric"
            onkeydown="if(event.key==='Enter'){event.preventDefault();app.jumpPage('${key}')}">
          <button type="button" class="pager-jump-go" onclick="app.jumpPage('${key}')">GO</button>
        </div>
        <div class="pager-meta">共 <b>${total}</b> 条 · <b>${pages}</b> 页</div>
      </div>
    </div>`;
  },
  /** 本地数组分页：返回 { items, page, pages, total, pageSize } */
  paginateLocal(items, page, pageSize = 20) {
    const list = Array.isArray(items) ? items : [];
    const size = Math.max(1, Number(pageSize) || 20);
    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / size) || 1);
    const p = Math.min(Math.max(1, Number(page) || 1), pages);
    return {
      items: list.slice((p - 1) * size, p * size),
      page: p,
      pages,
      total,
      pageSize: size,
    };
  },
};
window.UI = UI;
document.addEventListener('click', (event) => {
  if (event.target.id === 'preview-mask') UI.closePreview();
});
