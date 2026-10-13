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
  guessIcon(text) {
    const t = this.stripEmoji(text);
    if (/^(删|删除)$/.test(t) || /删除|移除|拉黑/.test(t)) return 'trash';
    if (/再绑环境|重新绑定/.test(t)) return 'link';
    if (/打开环境|浏览器环境|创建环境/.test(t)) return 'monitor';
    if (/CapCut|capcut/.test(t)) return 'scissors';
    if (/拉取数据|拉取/.test(t)) return 'download';
    if (/诊断/.test(t)) return 'activity';
    if (/查询|搜索|检查/.test(t)) return 'search';
    if (/重置|刷新|同步|重试/.test(t)) return 'refresh';
    if (/暂停/.test(t)) return 'pause';
    if (/保存|确定|确认|登录|创建/.test(t)) return 'check';
    if (/^(改|编辑)$/.test(t) || /编辑|修改/.test(t)) return 'edit';
    if (/导出|下载|CSV|csv/.test(t)) return 'download';
    if (/导入|上传|添加/.test(t)) return 'upload';
    if (/预览|查看|详情/.test(t)) return 'eye';
    if (/随机发布/.test(t)) return 'shuffle';
    if (/群发/.test(t)) return 'film';
    if (/独立发布/.test(t)) return 'play';
    if (/^(发布)$/.test(t)) return 'send';
    if (/^(更多|\.\.\.|…)$/.test(t)) return 'more';
    if (/启动|发送|方案/.test(t)) return 'play';
    if (/发布/.test(t)) return 'send';
    return '';
  },
  isIconOnlyAction(label) {
    return /^(编辑|改|删除|删|检查|预览|发布|更多|\.\.\.|…)$/.test(String(label || '').trim());
  },
  decorate(root = document) {
    if (!root) return;
    // 为全系统所有按钮根据功能自动配置语义色彩与纯白图标
    const colorClasses = ['primary', 'ghost', 'danger', 'tiny', 'info', 'warn', 'success'];
    root.querySelectorAll('button').forEach(btn => {
      if (btn.classList.contains('icon-btn') || btn.classList.contains('account-pick-tag') || btn.classList.contains('combo-trigger') || btn.classList.contains('combo-option') || btn.classList.contains('ai-platform-card') || btn.closest('.combo,.combo-menu,.nav-menu,.matrix-tabs,.subtabs,.chat-filters,.filter-sidebar,.chat-mode-switch,.group-list,.settings-menu,.channels,.wizard-steps,.account-pick-grid,.ai-platform-grid,#user-dropdown-wrap,.user-dropdown-wrap,.user-dropdown-menu')) return;
      if (btn.dataset.uiIcon === 'off') return;
      const label = this.stripEmoji(btn.textContent);
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

      if (btn.dataset.uiDecorated === label && btn.querySelector('.ui-ico')) return;
      const hasDownArrow = /[▾▼]/.test(label);
      const cleanLabel = label.replace(/[▾▼]/g, '').trim();
      const arrowSpan = hasDownArrow ? '<span class="btn-arrow-down">▾</span>' : '';
      const name = this.guessIcon(cleanLabel);
      btn.dataset.uiDecorated = label;
      const inMenu = !!btn.closest('.ops-menu,.dropdown-menu,.combo-menu');
      const iconOnly = !inMenu && this.isIconOnlyAction(cleanLabel) && name;
      if (iconOnly) {
        if (!btn.getAttribute('title')) btn.setAttribute('title', cleanLabel);
        if (!btn.getAttribute('aria-label')) btn.setAttribute('aria-label', cleanLabel);
        btn.classList.add('icon-only-act');
        btn.innerHTML = this.icon(name);
      } else if (name) {
        btn.classList.remove('icon-only-act');
        btn.innerHTML = `${this.icon(name)}<span class="btn-label">${this.esc(cleanLabel)}</span>${arrowSpan}`;
      } else if (hasDownArrow) {
        btn.classList.remove('icon-only-act');
        btn.innerHTML = `<span class="btn-label">${this.esc(cleanLabel)}</span>${arrowSpan}`;
      } else {
        btn.classList.remove('icon-only-act');
        btn.textContent = label;
      }
    });

    // 侧栏分组等「改 / 删」文字操作 → 编辑 / 删除图标
    root.querySelectorAll('.group-act').forEach((el) => {
      const label = this.stripEmoji(el.textContent);
      if (!label || el.dataset.uiDecorated === label) return;
      let name = '';
      if (/^(改|编辑)$/.test(label) || /编辑/.test(label)) name = 'edit';
      else if (/^(删|删除)$/.test(label) || /删除/.test(label)) name = 'trash';
      else return;
      el.dataset.uiDecorated = label;
      if (!el.getAttribute('title')) el.setAttribute('title', /删/.test(label) ? '删除' : '编辑');
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
    while (stack.children.length > 5) stack.firstChild.remove();
  },
  esc(value = '') {
    return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  },
  liftMenu(menu, anchor, opts = {}) {
    if (!menu || menu.classList.contains('hidden')) return;
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
  loading(show, text, desc) {
    const el = document.querySelector('#page-loading');
    if (!el) return;
    const title = el.querySelector('#loading-title') || el.querySelector('b');
    const tip = el.querySelector('#loading-desc') || el.querySelector('span');
    if (text && title) title.textContent = text;
    if (desc && tip) tip.textContent = desc;
    if (show) {
      el.classList.remove('hidden');
      requestAnimationFrame(() => el.classList.add('is-visible'));
    } else {
      el.classList.remove('is-visible');
      setTimeout(() => el.classList.add('hidden'), 180);
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
      desc.textContent = message || '';
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
    mask.classList.remove('hidden');
    requestAnimationFrame(() => mask.classList.add('is-visible'));
    return new Promise(resolve => {
      const done = (value) => {
        mask.classList.remove('is-visible');
        setTimeout(() => {
          mask.classList.add('hidden');
          card.classList.remove('confirm-wide');
          if (html) desc.textContent = '';
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
    img.src = src;
    mask.classList.remove('hidden');
  },
  closePreview() { document.querySelector('#preview-mask')?.classList.add('hidden'); },
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
    pick?.addEventListener('click', open);
    box.addEventListener('dragover', (event) => { event.preventDefault(); box.classList.add('drag'); });
    box.addEventListener('dragleave', () => box.classList.remove('drag'));
    box.addEventListener('drop', (event) => {
      event.preventDefault();
      box.classList.remove('drag');
      if (input && event.dataTransfer?.files) {
        input.files = event.dataTransfer.files;
        this.uploadImages(input, hidden, list, box.dataset.multiple === 'true');
      }
    });
    input?.addEventListener('change', () => this.uploadImages(input, hidden, list, box.dataset.multiple === 'true'));
  },
  async uploadImages(input, hidden, list, multiple) {
    const files = [...(input.files || [])];
    if (!files.length) return;
    const body = new FormData();
    files.slice(0, multiple ? 9 : 1).forEach(file => body.append('files', file));
    this.loading(true, '正在上传图片');
    try {
      const headers = {};
      if (window.app?.authToken) headers.Authorization = 'Bearer ' + window.app.authToken;
      const response = await fetch('/api/uploads/images', { method: 'POST', headers, body });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.message || '上传失败');
      const urls = (json.data.items || []).map(item => item.url);
      const current = multiple ? String(hidden.value || '').split(',').filter(Boolean) : [];
      const next = multiple ? [...current, ...urls] : urls.slice(0, 1);
      hidden.value = next.join(',');
      list.innerHTML = next.map(url => `<div class="uploader-item"><img src="${this.esc(url)}" alt=""><button type="button" class="danger" data-url="${this.esc(url)}">×</button></div>`).join('');
      list.querySelectorAll('img').forEach(img => img.onclick = () => this.openPreview(img.src));
      list.querySelectorAll('button').forEach(btn => btn.onclick = () => {
        const left = hidden.value.split(',').filter(url => url && url !== btn.dataset.url);
        hidden.value = left.join(',');
        btn.parentElement.remove();
      });
      window.app?.toast('图片已上传');
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
