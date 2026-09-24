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
    eye: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    pause: '<path d="M8 5h3v14H8zM13 5h3v14h-3z"/>',
    more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  },
  icon(name) {
    const path = this.icons[name] || this.icons.plus;
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
    if (/查询|搜索|检查/.test(t)) return 'search';
    if (/重置|刷新|同步|重试/.test(t)) return 'refresh';
    if (/暂停/.test(t)) return 'pause';
    if (/保存|确定|确认|登录|创建/.test(t)) return 'check';
    if (/^(改|编辑)$/.test(t) || /编辑|修改/.test(t)) return 'edit';
    if (/导出|下载|CSV|csv/.test(t)) return 'download';
    if (/导入|上传|添加/.test(t)) return 'upload';
    if (/预览|查看|详情/.test(t)) return 'eye';
    if (/启动|发布|发送|方案/.test(t)) return 'play';
    return '';
  },
  isIconOnlyAction(label) {
    return /^(编辑|改|删除|删)$/.test(String(label || '').trim());
  },
  decorate(root = document) {
    if (!root) return;
    // 为全系统所有按钮根据功能自动配置语义色彩与纯白图标
    const colorClasses = ['primary', 'ghost', 'danger', 'tiny', 'info', 'warn', 'success'];
    root.querySelectorAll('button').forEach(btn => {
      if (btn.classList.contains('icon-btn') || btn.closest('.combo-menu,.nav-menu,.matrix-tabs,.subtabs,.chat-filters,.filter-sidebar,.chat-mode-switch,.group-list,.settings-menu,.channels,.wizard-steps,#user-dropdown-wrap,.user-dropdown-wrap,.user-dropdown-menu')) return;
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
        } else if (/查询|搜索|刷新|重置|重试|检查|同步|测试/.test(label)) {
          btn.classList.add('info');
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
    const home = menu._liftHome || menu.parentElement;
    let target = anchor || menu._liftAnchor || home;
    if (!menu._liftHome) menu._liftHome = home;
    if (target) menu._liftAnchor = target;
    const isOps = !!(opts.side === 'left' || menu.classList.contains('ops-menu') || home?.classList?.contains('ops-dropdown') || /^account-ops-/.test(menu.id || ''));
    if (isOps && target?.querySelector) {
      const btn = target.matches?.('button') ? target : target.querySelector('button');
      if (btn) { target = btn; menu._liftAnchor = btn; }
    }
    const inModal = !!(target && target.closest && target.closest('#modal, .modal'));
    if (menu.parentElement !== document.body) document.body.appendChild(menu);
    const rect = (target && target.getBoundingClientRect) ? target.getBoundingClientRect() : { top: 80, bottom: 112, left: 16, right: 196, width: 180 };
    const isCombo = menu.classList.contains('combo-menu');
    const width = isOps ? Math.max(188, menu.scrollWidth || 188) : Math.max(isCombo ? rect.width : 180, menu.offsetWidth || rect.width || 180);
    menu.style.width = width + 'px';
    menu.style.minWidth = width + 'px';
    menu.style.maxWidth = width + 'px';
    menu.style.maxHeight = '';
    menu.classList.add('is-lifted');
    menu.classList.toggle('from-modal', inModal);
    menu.classList.toggle('ops-float', isOps);
    const gap = 8;
    let left;
    if (isOps || opts.side === 'left') {
      left = rect.left - width - gap;
      if (left < gap) left = Math.min(rect.right + gap, window.innerWidth - width - gap);
    } else if (isCombo) {
      left = rect.left;
    } else {
      left = rect.right - width;
    }
    if (left < gap) left = gap;
    if (left + width > window.innerWidth - gap) left = Math.max(gap, window.innerWidth - width - gap);
    const avail = Math.max(160, window.innerHeight - gap * 2);
    if (isOps) {
      menu.style.maxHeight = avail + 'px';
      menu.style.overflowY = 'auto';
    }
    const height = Math.min(menu.scrollHeight || menu.offsetHeight || 220, avail);
    let top;
    if (isOps) {
      // 贴在操作按钮左侧，纵向固定贴合视口（尽量对齐按钮，必要时上移，保证完整可见）
      top = Math.min(Math.max(gap, rect.top), window.innerHeight - height - gap);
    } else {
      top = rect.bottom + 4;
      if (top + Math.min(height, 280) > window.innerHeight - gap && rect.top > height + gap) {
        top = Math.max(gap, rect.top - Math.min(height, 280) - 4);
      }
    }
    menu.style.top = top + 'px';
    menu.style.left = left + 'px';
  },
  restoreMenu(menu) {
    if (!menu) return;
    menu.classList.remove('is-lifted', 'from-modal', 'ops-float');
    menu.style.position = '';
    menu.style.top = '';
    menu.style.left = '';
    menu.style.right = '';
    menu.style.width = '';
    menu.style.minWidth = '';
    menu.style.maxWidth = '';
    menu.style.maxHeight = '';
    menu.style.overflowY = '';
    if (menu._liftHome && menu._liftHome.isConnected && menu.parentElement !== menu._liftHome) menu._liftHome.appendChild(menu);
  },
  syncMenus() {
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
      if (menu.classList.contains('hidden')) this.restoreMenu(menu);
      else this.liftMenu(menu, menu._liftAnchor);
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
  confirm({ title = '请确认操作', message = '', type = 'warn', okText = '确定', cancelText = '取消' } = {}) {
    const mask = document.querySelector('#confirm-mask');
    const card = mask?.querySelector('.confirm-card');
    if (!mask) return Promise.resolve(window.confirm(message));
    const kind = type === 'danger' ? 'error' : (['error', 'warn', 'info', 'success'].includes(type) ? type : 'warn');
    const icons = {
      success: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>',
      error: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
      warn: '<svg viewBox="0 0 24 24"><path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 17.5h.01"/></svg>',
      info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 8h.01"/></svg>',
    };
    document.querySelector('#confirm-title').textContent = title;
    document.querySelector('#confirm-desc').textContent = message || '';
    const iconEl = document.querySelector('#confirm-icon');
    if (iconEl) iconEl.innerHTML = icons[kind];
    card.className = `confirm-card el-message-box ${kind}`;
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
        setTimeout(() => mask.classList.add('hidden'), 160);
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
      const inp = box?.querySelector('.combo-input');
      const cur = sel.selectedOptions[0];
      if (inp && cur) inp.value = cur.textContent.trim();
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

    const input = document.createElement('input');
    input.className = 'input combo-input';
    input.placeholder = sel.getAttribute('placeholder') || '输入或选择...';
    input.value = sel.selectedOptions[0]?.textContent?.trim() || '';
    input.autocomplete = 'off';

    const arrow = document.createElement('span');
    arrow.className = 'combo-arrow';
    arrow.innerHTML = '▾';

    wrapper.appendChild(input);
    wrapper.appendChild(arrow);

    const menu = document.createElement('div');
    menu.className = 'combo-menu hidden';
    box.appendChild(wrapper);
    box.appendChild(menu);
    menu._owner = box;
    box._menu = menu;

    const syncMenuWidth = () => {
      const boxRect = box.getBoundingClientRect();
      const wrapRect = wrapper.getBoundingClientRect();
      const targetWidth = wrapRect.width || boxRect.width;
      if (targetWidth > 0) {
        menu.style.width = targetWidth + 'px';
        menu.style.minWidth = targetWidth + 'px';
        menu.style.maxWidth = targetWidth + 'px';
        menu.style.boxSizing = 'border-box';
      }
    };

    const close = () => {
      if (menu.classList.contains('hidden')) return;
      menu.classList.add('hidden');
      wrapper.classList.remove('is-open');
      UI.restoreMenu(menu);
      const curOpt = sel.selectedOptions[0];
      if (curOpt) {
        input.value = curOpt.textContent.trim();
      }
    };

    const open = () => {
      // Close any other open combo
      document.querySelectorAll('.combo').forEach(other => {
        if (other !== box) {
          const m = other._menu || other.querySelector('.combo-menu');
          const w = other.querySelector('.combo-input-wrapper');
          const s = other.querySelector('select');
          const i = other.querySelector('.combo-input');
          if (m && !m.classList.contains('hidden')) {
            m.classList.add('hidden');
            w?.classList.remove('is-open');
            UI.restoreMenu(m);
            const cur = s?.selectedOptions?.[0];
            if (cur && i) i.value = cur.textContent.trim();
          }
        }
      });
      render('');
    };

    const render = (filterText = '') => {
      syncMenuWidth();
      const q = filterText.trim().toLowerCase();
      const options = [...sel.options].filter(opt => !opt.disabled && (!q || opt.textContent.toLowerCase().includes(q) || String(opt.value).toLowerCase().includes(q)));
      menu.innerHTML = options.length ? options.map(opt => {
        const isSelected = String(opt.value) === String(sel.value);
        return `<button type="button" class="combo-option ${isSelected?'active':''}" data-value="${this.esc(opt.value)}">${this.esc(opt.textContent)}</button>`;
      }).join('') : '<div class="muted" style="padding:10px;text-align:center;font-size:12px">无匹配项</div>';
      syncMenuWidth();
      menu.classList.remove('hidden');
      wrapper.classList.add('is-open');
      UI.liftMenu(menu, wrapper);
    };

    const selectOption = (btn) => {
      if (!btn) return;
      sel.value = btn.dataset.value;
      input.value = btn.textContent.trim();
      close();
      input.blur();
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    };

    // Use delegation on menu for clicking/selecting options
    menu.addEventListener('mousedown', (e) => {
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

    input.addEventListener('focus', () => {
      open();
    });

    input.addEventListener('click', (e) => {
      e.stopPropagation();
      if (menu.classList.contains('hidden')) {
        open();
      }
    });

    input.addEventListener('input', () => {
      render(input.value);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        close();
        input.blur();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const activeOpt = menu.querySelector('button.combo-option.active') || menu.querySelector('button.combo-option');
        if (activeOpt) {
          selectOption(activeOpt);
        } else {
          close();
          input.blur();
        }
      }
    });

    arrow.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (menu.classList.contains('hidden')) {
        input.focus();
        open();
      } else {
        close();
      }
    });

    input.addEventListener('blur', () => {
      setTimeout(() => {
        if (box.contains(document.activeElement)) return;
        close();
      }, 150);
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
            const s = c.querySelector('select');
            const inp = c.querySelector('.combo-input');
            if (m && !m.classList.contains('hidden')) {
              m.classList.add('hidden');
              w?.classList.remove('is-open');
              UI.restoreMenu(m);
              const cur = s?.selectedOptions?.[0];
              if (cur && inp) inp.value = cur.textContent.trim();
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
  pager(pack, pageKey) {
    const page = Number(pack?.page || 1);
    const pages = Number(pack?.pages || 1);
    const total = Number(pack?.total || 0);
    if (!pages || pages <= 1) return '';
    const prev = Math.max(1, page - 1);
    const next = Math.min(pages, page + 1);
    return `<div class="pager">
      <button type="button" class="info ${page<=1?'disabled':''}" ${page<=1?'disabled':''} onclick="app.setPage('${pageKey}',1)">首页</button>
      <button type="button" class="info ${page<=1?'disabled':''}" ${page<=1?'disabled':''} onclick="app.setPage('${pageKey}',${prev})">上一页</button>
      <span class="page-info">第 ${page} / ${pages} 页 · 共 ${total} 条数据</span>
      <button type="button" class="info ${page>=pages?'disabled':''}" ${page>=pages?'disabled':''} onclick="app.setPage('${pageKey}',${next})">下一页</button>
      <button type="button" class="info ${page>=pages?'disabled':''}" ${page>=pages?'disabled':''} onclick="app.setPage('${pageKey}',${pages})">末页</button>
    </div>`;
  },
};
window.UI = UI;
document.addEventListener('click', (event) => {
  if (event.target.id === 'preview-mask') UI.closePreview();
});
