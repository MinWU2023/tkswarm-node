/**
 * MaterialPicker — 视频素材选择弹框（单选/多选/上限可配）
 * 依赖全局 app（api / esc / toast / formatFileSize / authToken）
 */
(function () {
  const publishStatusLabel = {
    unused: '未发布',
    publishing: '发布中',
    published: '已发布',
  };

  function dialogFsButtons(rootSelector) {
    if (window.UI && typeof UI.dialogFullscreenButtonsHtml === 'function') {
      return UI.dialogFullscreenButtonsHtml(rootSelector);
    }
    return '';
  }

  function ensureDom() {
    let mask = document.querySelector('#material-picker-mask');
    if (mask && (!mask.querySelector('#mp-grid') || mask.querySelector('#mp-file') || !mask.querySelector('#mp-pager') || !mask.querySelector('#mp-loading') || !mask.querySelector('#mp-publish-filter') || !mask.querySelector('[data-dialog-fs]'))) {
      mask.remove();
      mask = null;
    }
    if (mask) return mask;
    mask = document.createElement('div');
    mask.id = 'material-picker-mask';
    mask.className = 'mp-mask hidden';
    mask.innerHTML = `
      <div class="mp-card" role="dialog" aria-modal="true">
        <div class="mp-head">
          <h2 id="mp-title">选择视频素材</h2>
          <div class="dialog-head-actions mp-head-actions">
            ${dialogFsButtons('#material-picker-mask')}
            <button type="button" class="mp-close icon-btn" id="mp-close" aria-label="关闭" title="关闭">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>
        <div class="mp-toolbar">
          <input class="input" id="mp-search" type="search" placeholder="搜索 ID / 文件名 / 后缀">
          <div class="mp-pub-filter" id="mp-publish-filter" role="group" aria-label="发布状态筛选">
            <button type="button" class="mp-pub-btn is-on" data-v="">全部</button>
            <button type="button" class="mp-pub-btn" data-v="unused">未发布</button>
            <button type="button" class="mp-pub-btn" data-v="published">已发布</button>
          </div>
          <button type="button" class="ghost" id="mp-refresh">刷新</button>
          <button type="button" class="primary" id="mp-upload-btn">添加本机视频</button>
        </div>
        <div class="mp-body">
          <div id="mp-dup-panel" class="mp-dup hidden"></div>
          <div id="mp-loading" class="mp-loading hidden" aria-live="polite" aria-busy="true">
            <div class="mp-loading-inner">
              <div class="ep-spinner" aria-hidden="true">
                <svg viewBox="25 25 50 50"><circle cx="50" cy="50" r="20" fill="none" stroke-width="4"></circle></svg>
              </div>
              <b>正在加载素材</b>
              <span>请稍候…</span>
            </div>
          </div>
          <div id="mp-grid" class="mp-grid"></div>
          <div id="mp-empty" class="mp-empty" style="display:none">暂无视频素材，请先上传</div>
        </div>
        <div class="mp-foot">
          <div class="mp-pager" id="mp-pager"></div>
          <div class="mp-foot-right">
            <span class="mp-count" id="mp-count">已选 0</span>
            <div style="display:flex;gap:8px">
              <button type="button" class="ep-btn ep-btn-primary" id="mp-ok">确定</button>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(mask);
    let pickerMaskDown = false;
    mask.addEventListener('mousedown', (e) => {
      pickerMaskDown = e.target === mask;
    });
    mask.addEventListener('click', (e) => {
      const pressedOnMask = pickerMaskDown;
      pickerMaskDown = false;
      if (e.target === mask && pressedOnMask) app.closeMaterialPicker(false);
    });
    mask.querySelector('#mp-close').onclick = () => app.closeMaterialPicker(false);
    mask.querySelector('#mp-ok').onclick = () => app.confirmMaterialPicker();
    mask.querySelector('#mp-refresh').onclick = () => app.reloadMaterialPickerList();
    mask.querySelector('#mp-search').oninput = (e) => {
      app._mp.keyword = e.target.value || '';
      clearTimeout(app._mpSearchTimer);
      app._mpSearchTimer = setTimeout(() => {
        if (!app._mp) return;
        app._mp.page = 1;
        app.reloadMaterialPickerList();
      }, 280);
    };
    mask.querySelector('#mp-upload-btn').onclick = () => app.openMaterialUploadDialog();
    mask.querySelector('#mp-publish-filter')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.mp-pub-btn');
      if (!btn || !app._mp) return;
      const v = btn.getAttribute('data-v') || '';
      if ((app._mp.publishStatus || '') === v) return;
      app._mp.publishStatus = v;
      app._mp.page = 1;
      mask.querySelectorAll('.mp-pub-btn').forEach((b) => {
        b.classList.toggle('is-on', (b.getAttribute('data-v') || '') === v);
      });
      app.reloadMaterialPickerList();
    });
    return mask;
  }

  function ensureUploadDom() {
    let mask = document.querySelector('#mp-upload-mask');
    if (mask && (!mask.querySelector('#mp-up-frames') || !mask.querySelector('#mp-up-cover-file') || !mask.querySelector('#mp-up-locked') || !mask.querySelector('[data-dialog-fs]'))) {
      mask.remove();
      mask = null;
    }
    if (mask) return mask;
    mask = document.createElement('div');
    mask.id = 'mp-upload-mask';
    mask.className = 'mp-upload-mask hidden';
    mask.innerHTML = `
      <div class="mp-upload-card" role="dialog" aria-modal="true">
        <div class="mp-upload-head">
          <h3>添加本机视频</h3>
          <div class="dialog-head-actions mp-head-actions">
            ${dialogFsButtons('#mp-upload-mask')}
            <button type="button" class="mp-close icon-btn" id="mp-up-close" aria-label="关闭" title="关闭">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>
        <div class="mp-upload-body">
          <div class="mp-upload-layout">
            <div class="mp-upload-left">
              <div class="mp-upload-drop" id="mp-up-drop">
                <div class="mp-upload-drop-ico">
                  <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
                <b>点击选择本地视频，或拖拽到此处</b>
                <span>支持 MP4 / MOV / AVI / MKV / WebM</span>
                <input type="file" id="mp-up-file" accept="video/*,.mp4,.mov,.avi,.mkv,.webm,.m4v" hidden>
              </div>
              <div class="mp-upload-locked hidden" id="mp-up-locked">
                <div class="mp-upload-drop-ico">
                  <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3V9z"/></svg>
                </div>
                <b>当前视频（不可替换）</b>
                <span id="mp-up-locked-tip">如需换片请删除后重新上传；可改封面与分享信息</span>
              </div>
              <div class="mp-upload-preview" id="mp-up-preview">
                <div id="mp-up-cover-wrap"><div class="mp-upload-cover-ph">封面预览</div></div>
                <div class="mp-upload-filemeta">
                  <div class="name" id="mp-up-fname">-</div>
                  <div class="meta" id="mp-up-fmeta">-</div>
                  <div class="meta" id="mp-up-cover-tip">可选视频截帧，或手动上传封面图</div>
                  <div class="mp-upload-cover-actions">
                    <button type="button" class="mp-cover-btn" id="mp-up-cover-pick" title="手动上传封面图">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                      上传封面图
                    </button>
                    <button type="button" class="mp-cover-btn ghost" id="mp-up-cover-clear" title="清除手动封面，改回视频帧" hidden>改用视频帧</button>
                    <input type="file" id="mp-up-cover-file" accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif" hidden>
                  </div>
                </div>
              </div>
              <div class="mp-upload-frames-wrap" id="mp-up-frames-wrap">
                <div class="mp-upload-frames-head">
                  <b>封面帧选择</b>
                  <span id="mp-up-frames-tip">请先选择视频</span>
                </div>
                <div class="mp-upload-frames" id="mp-up-frames"></div>
              </div>
            </div>
            <div class="mp-upload-right">
              <div class="mp-upload-progress" id="mp-up-progress"><i id="mp-up-bar"></i></div>
              <div class="mp-upload-grid">
                <div class="mp-upload-field">
                  <label>素材名称（可选）</label>
                  <input class="input" id="mp-up-name" type="text" placeholder="不填则使用文件名">
                </div>
                <div class="mp-upload-field">
                  <label>标签（逗号分隔）</label>
                  <input class="input" id="mp-up-tags" type="text" placeholder="例如：发布,活动" value="material-picker">
                </div>
                <div class="mp-upload-field full">
                  <label>分享标题</label>
                  <input class="input" id="mp-up-share-title" type="text" placeholder="发布到 TikTok 时使用的标题">
                </div>
                <div class="mp-upload-field full">
                  <label>分享文案</label>
                  <textarea id="mp-up-share-caption" placeholder="发布文案 / Caption…"></textarea>
                </div>
                <div class="mp-upload-field">
                  <label>文件类型</label>
                  <input class="input" id="mp-up-mime" type="text" readonly value="video/mp4">
                </div>
                <div class="mp-upload-field">
                  <label>文件大小</label>
                  <input class="input" id="mp-up-size" type="text" readonly value="-">
                </div>
                <div class="mp-upload-field full" id="mp-up-status-wrap" hidden>
                  <label>状态</label>
                  <select class="input" id="mp-up-status">
                    <option value="ready">可用</option>
                    <option value="disabled">停用</option>
                    <option value="missing">缺失</option>
                  </select>
                </div>
                <div class="mp-upload-field full">
                  <label>描述（内部备注）</label>
                  <textarea id="mp-up-desc" placeholder="可选，仅系统内备注…"></textarea>
                </div>
              </div>
              <div id="mp-up-dup" class="mp-dup hidden" style="margin-top:12px"></div>
            </div>
          </div>
        </div>
        <div class="mp-upload-foot">
          <button type="button" class="mp-btn-cancel" id="mp-up-cancel">取消</button>
          <button type="button" class="mp-btn-ok" id="mp-up-ok" disabled>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="20 6 9 17 4 12"/></svg>
            <span id="mp-up-ok-label">开始上传</span>
          </button>
        </div>
      </div>`;
    document.body.appendChild(mask);
    // 只有「按下」和「松开」都落在遮罩上才算点击遮罩：
    // 在输入框拖选文字 / 拖文本域缩放手柄后在卡片外松开，click 会落到遮罩上，不能因此关闭并清空表单
    let upMaskDown = false;
    mask.addEventListener('mousedown', (e) => {
      upMaskDown = e.target === mask;
    });
    mask.addEventListener('click', (e) => {
      const pressedOnMask = upMaskDown;
      upMaskDown = false;
      if (e.target !== mask || !pressedOnMask) return;
      // 已选视频或已填内容时，点遮罩不关闭，避免误触丢失（请用右上角关闭/取消）
      if (app._mpUpload?.file || app._mpUpload?.cover) return;
      app.closeMaterialUploadDialog();
    });
    const drop = mask.querySelector('#mp-up-drop');
    const fileInput = mask.querySelector('#mp-up-file');
    mask.querySelector('#mp-up-close').onclick = () => app.closeMaterialUploadDialog();
    mask.querySelector('#mp-up-cancel').onclick = () => app.closeMaterialUploadDialog();
    mask.querySelector('#mp-up-ok').onclick = () => app.submitMaterialUploadDialog();
    drop.onclick = () => fileInput.click();
    fileInput.onchange = (e) => app.onMaterialUploadFilePicked(e.target.files?.[0] || null);
    drop.ondragover = (e) => {
      e.preventDefault();
      drop.classList.add('is-drag');
    };
    drop.ondragleave = () => drop.classList.remove('is-drag');
    drop.ondrop = (e) => {
      e.preventDefault();
      drop.classList.remove('is-drag');
      const f = e.dataTransfer?.files?.[0];
      if (f) app.onMaterialUploadFilePicked(f);
    };
    const coverInput = mask.querySelector('#mp-up-cover-file');
    mask.querySelector('#mp-up-cover-pick').onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      coverInput?.click();
    };
    coverInput.onchange = (e) => {
      const f = e.target.files?.[0] || null;
      e.target.value = '';
      app.onMaterialUploadCoverPicked(f);
    };
    mask.querySelector('#mp-up-cover-clear').onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      app.clearMaterialUploadManualCover();
    };
    return mask;
  }

  function ensureDupPreviewDom() {
    let mask = document.querySelector('#mp-dup-preview-mask');
    if (mask && (!mask.querySelector('[data-dialog-fs]') || !mask.querySelector('#mp-dup-preview-status'))) {
      mask.remove();
      mask = null;
    }
    if (mask) return mask;
    mask = document.createElement('div');
    mask.id = 'mp-dup-preview-mask';
    mask.className = 'mp-dup-preview-mask hidden';
    mask.innerHTML = `
      <div class="mp-dup-preview-card" role="dialog" aria-modal="true">
        <div class="mp-dup-preview-head">
          <h3 id="mp-dup-preview-title">素材预览</h3>
          <div class="dialog-head-actions mp-head-actions">
            ${dialogFsButtons('#mp-dup-preview-mask')}
            <button type="button" class="mp-close icon-btn" id="mp-dup-preview-close" aria-label="关闭" title="关闭">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>
        <div class="mp-dup-preview-body">
          <div class="muted" id="mp-dup-preview-status" style="padding:12px 16px;text-align:center">正在加载…</div>
          <video id="mp-dup-preview-video" controls playsinline></video>
        </div>
        <div class="mp-dup-preview-foot">
          <button type="button" class="mp-btn-cancel" id="mp-dup-preview-ok">关闭</button>
        </div>
      </div>`;
    document.body.appendChild(mask);
    const close = () => app.closeMaterialDupPreview();
    let previewMaskDown = false;
    mask.addEventListener('mousedown', (e) => {
      previewMaskDown = e.target === mask;
    });
    mask.addEventListener('click', (e) => {
      const pressedOnMask = previewMaskDown;
      previewMaskDown = false;
      if (e.target === mask && pressedOnMask) close();
    });
    mask.querySelector('#mp-dup-preview-close').onclick = close;
    mask.querySelector('#mp-dup-preview-ok').onclick = close;
    return mask;
  }

  Object.assign(window.AppPrototype || {}, {});

  const methods = {
    /** 表单回显：已选视频用卡片（封面/标题/大小/状态），不用简单标签 */
    materialPickerSelectedCardHtml(m, fieldId) {
      const id = Number(m?.id || 0);
      if (!id) return '';
      const title = m.name || m.fileName || m.file_name || ('素材 #' + id);
      const ext = String(m.fileExt || m.file_ext || '').toLowerCase() || 'video';
      const sizeRaw = m.sizeBytes || m.size_bytes || 0;
      const size = this.formatFileSize ? this.formatFileSize(sizeRaw) : (sizeRaw ? Math.round(Number(sizeRaw) / 1024) + ' KB' : '-');
      const created = m.createdAt || m.created_at || '';
      const ps = m.publishStatus || m.publish_status || 'unused';
      const psMap = { unused: '未发布', published: '已发布', publishing: '发布中' };
      const psLabel = psMap[ps] || ps;
      const thumb = this.materialThumbHtml(m, {
        imgClass: 'mp-scard-cover',
        emptyClass: 'mp-scard-no',
        allowVideo: false,
      });
      const removeBtn = fieldId
        ? `<button type="button" class="mp-scard-remove" title="移除" aria-label="移除" onclick="event.stopPropagation();app.removeMaterialPickerChip('${fieldId}',${id})">×</button>`
        : '';
      return `<div class="mp-scard" data-id="${id}" title="${this.esc(title)}">
        <div class="mp-scard-thumb">
          <span class="mp-scard-id">#${id}</span>
          ${thumb}
          <span class="mp-scard-ext">${this.esc(ext)}</span>
          ${removeBtn}
        </div>
        <div class="mp-scard-body">
          <div class="mp-scard-name">${this.esc(title)}</div>
          <div class="mp-scard-meta"><span>${this.esc(String(size))}</span><span class="mp-status-${this.esc(ps)}">${this.esc(psLabel)}</span></div>
          ${created ? `<div class="mp-scard-meta muted">${this.esc(String(created).slice(0, 19))}</div>` : ''}
        </div>
      </div>`;
    },

    materialPickerSelectedListHtml(items, fieldId) {
      const list = (items || []).filter((m) => Number(m?.id));
      if (!list.length) return '<div class="mp-empty mp-field-empty">尚未选择视频素材</div>';
      return `<div class="mp-scard-grid">${list.map((m) => this.materialPickerSelectedCardHtml(m, fieldId)).join('')}</div>`;
    },

    materialPickerFieldHtml(opts = {}) {
      const multiple = opts.multiple !== false;
      const max = Number(opts.max || 0) || 0;
      const fieldId = opts.fieldId || 'material-picker-field';
      const ids = (opts.selectedIds || []).map(Number).filter(Boolean);
      const items = this.ownedMaterials().filter((m) => ids.includes(Number(m.id)));
      // 保持与 selectedIds 顺序一致
      const ordered = ids.map((id) => items.find((m) => Number(m.id) === id) || { id }).filter(Boolean);
      const cards = this.materialPickerSelectedListHtml(ordered, fieldId);
      return `<div class="mp-field" id="${fieldId}" data-multiple="${multiple ? 1 : 0}" data-max="${max}">
        <div class="mp-field-box mp-field-box--cards" id="${fieldId}-chips">${cards}</div>
        <div class="action-bar" style="margin:0">
          <button type="button" class="primary" onclick="app.openMaterialPickerFromField('${fieldId}')">选择视频素材</button>
          <button type="button" class="ghost" onclick="app.clearMaterialPickerField('${fieldId}')">清空</button>
          <span class="muted" id="${fieldId}-hint">${ids.length ? `已选 ${ids.length}${max ? ' / 最多 ' + max : ''} 个` : max ? `最多可选 ${max} 个` : multiple ? '可多选' : '单选'}</span>
        </div>
        <input type="hidden" name="${opts.name || 'materialIds'}" id="${fieldId}-value" value="${ids.join(',')}">
      </div>`;
    },

    openMaterialPickerFromField(fieldId) {
      const el = document.querySelector('#' + fieldId);
      if (!el) return;
      const multiple = el.getAttribute('data-multiple') !== '0';
      const max = Number(el.getAttribute('data-max') || 0) || 0;
      const raw = document.querySelector('#' + fieldId + '-value')?.value || '';
      const selectedIds = raw
        .split(',')
        .map((x) => Number(x))
        .filter(Boolean);
      this.openMaterialPicker({
        multiple,
        max,
        selectedIds,
        title: multiple ? '选择视频素材（可多选）' : '选择视频素材（单选）',
        onConfirm: (items) => this.applyMaterialPickerField(fieldId, items),
      });
    },

    applyMaterialPickerField(fieldId, items) {
      const ids = (items || []).map((m) => Number(m.id)).filter(Boolean);
      const box = document.querySelector('#' + fieldId + '-chips');
      const hidden = document.querySelector('#' + fieldId + '-value');
      const hint = document.querySelector('#' + fieldId + '-hint');
      const el = document.querySelector('#' + fieldId);
      const max = Number(el?.getAttribute('data-max') || 0) || 0;
      if (hidden) hidden.value = ids.join(',');
      if (box) {
        box.classList.add('mp-field-box--cards');
        box.innerHTML = this.materialPickerSelectedListHtml(items || [], fieldId);
      }
      if (hint) hint.textContent = ids.length ? `已选 ${ids.length}${max ? ' / 最多 ' + max : ''} 个` : max ? `最多可选 ${max} 个` : '';
      if (typeof this.onMaterialPickerFieldChange === 'function') {
        this.onMaterialPickerFieldChange(fieldId, ids, items);
      }
    },

    removeMaterialPickerChip(fieldId, id) {
      const hidden = document.querySelector('#' + fieldId + '-value');
      const ids = String(hidden?.value || '')
        .split(',')
        .map((x) => Number(x))
        .filter((x) => x && x !== Number(id));
      const items = this.ownedMaterials().filter((m) => ids.includes(Number(m.id)));
      this.applyMaterialPickerField(fieldId, items);
    },

    clearMaterialPickerField(fieldId) {
      this.applyMaterialPickerField(fieldId, []);
    },

    selectedMaterialPickerIds(fieldId) {
      const raw = document.querySelector('#' + fieldId + '-value')?.value || '';
      return raw
        .split(',')
        .map((x) => Number(x))
        .filter(Boolean);
    },

    openMaterialPicker(opts = {}) {
      ensureDom();
      const multiple = opts.multiple !== false;
      const max = Number(opts.max || 0) || 0;
      const selectedIds = (opts.selectedIds || []).map(Number).filter(Boolean);
      const excludeIds = new Set((opts.excludeIds || []).map(Number).filter(Boolean));
      const selectedMap = new Map();
      this.ownedMaterials().forEach((m) => {
        if (selectedIds.includes(Number(m.id))) selectedMap.set(Number(m.id), m);
      });
      this._mp = {
        multiple,
        max,
        excludeIds,
        selected: new Set(selectedIds.filter((id) => !excludeIds.has(id))),
        selectedMap,
        items: [],
        keyword: '',
        publishStatus: '',
        page: 1,
        pageSize: Number(opts.pageSize || 12) || 12,
        total: 0,
        pages: 1,
        onConfirm: opts.onConfirm || null,
        pendingFile: null,
      };
      const mask = document.querySelector('#material-picker-mask');
      document.querySelector('#mp-title').textContent =
        opts.title || (multiple ? (max ? `选择视频素材（最多 ${max} 个）` : '选择视频素材（可多选）') : '选择视频素材（单选）');
      document.querySelector('#mp-search').value = '';
      mask.querySelectorAll('.mp-pub-btn').forEach((b) => {
        b.classList.toggle('is-on', (b.getAttribute('data-v') || '') === '');
      });
      document.querySelector('#mp-dup-panel')?.classList.add('hidden');
      if (window.UI) UI.resetDialogFullscreen('#material-picker-mask');
      mask.classList.remove('hidden');
      this.setMaterialPickerLoading(true);
      this.reloadMaterialPickerList();
    },

    closeMaterialPicker() {
      this.closeMaterialUploadDialog?.();
      const mask = document.querySelector('#material-picker-mask');
      if (mask) {
        mask.classList.add('hidden');
        if (window.UI) UI.resetDialogFullscreen(mask);
      }
      this.setMaterialPickerLoading(false);
      this._mp = null;
    },

    setMaterialPickerLoading(on) {
      const loading = document.querySelector('#mp-loading');
      const grid = document.querySelector('#mp-grid');
      const empty = document.querySelector('#mp-empty');
      const pager = document.querySelector('#mp-pager');
      if (loading) {
        loading.classList.toggle('hidden', !on);
        loading.setAttribute('aria-busy', on ? 'true' : 'false');
      }
      if (on) {
        if (grid) {
          grid.innerHTML = '';
          grid.style.display = 'none';
        }
        if (empty) empty.style.display = 'none';
        if (pager) pager.innerHTML = '';
      }
    },

    async reloadMaterialPickerList() {
      if (!this._mp) return;
      this.setMaterialPickerLoading(true);
      try {
        const page = Math.max(1, Number(this._mp.page || 1));
        const pageSize = Math.max(1, Number(this._mp.pageSize || 12));
        const kw = encodeURIComponent(String(this._mp.keyword || '').trim());
        const ps = String(this._mp.publishStatus || '').trim();
        const qs = [
          `page=${page}`,
          `pageSize=${pageSize}`,
          kw ? `keyword=${kw}` : '',
          ps ? `publishStatus=${encodeURIComponent(ps)}` : '',
        ].filter(Boolean).join('&');
        const pack = await this.api(`/materials?${qs}`);
        if (!this._mp) return;
        const rawItems = Array.isArray(pack) ? pack : pack?.items || [];
        const exclude = this._mp.excludeIds || new Set();
        const items = rawItems.filter((m) => !exclude.has(Number(m.id)));
        this._mp.items = items;
        this._mp.total = Array.isArray(pack) ? items.length : Math.max(0, Number(pack?.total || 0) - exclude.size);
        this._mp.page = Array.isArray(pack) ? 1 : Number(pack?.page || page);
        this._mp.pageSize = Array.isArray(pack) ? items.length || pageSize : Number(pack?.pageSize || pageSize);
        this._mp.pages = Array.isArray(pack) ? 1 : Number(pack?.pages || 1);
        // 仅把本页/已选项并入轻量缓存，避免每次整表 sort 卡顿
        if (!Array.isArray(this.materials)) this.materials = [];
        const byId = new Map(this.materials.map((m) => [Number(m.id), m]));
        rawItems.forEach((m) => {
          const id = Number(m.id);
          if (!id) return;
          byId.set(id, Object.assign({}, byId.get(id) || {}, m, { coverBase64: '', cover_base64: '' }));
        });
        this.materials = this.ownedMaterials([...byId.values()]);
        items.forEach((m) => {
          if (this._mp.selected.has(Number(m.id))) this._mp.selectedMap.set(Number(m.id), m);
        });
        this.setMaterialPickerLoading(false);
        this.renderMaterialPickerList();
      } catch (e) {
        this.setMaterialPickerLoading(false);
        if (this._mp) this.renderMaterialPickerList();
        this.toast(e.message || '加载素材失败', true);
      }
    },

    setMaterialPickerPage(page) {
      if (!this._mp) return;
      const next = Math.max(1, Math.min(Number(this._mp.pages || 1), Number(page) || 1));
      if (next === this._mp.page) return;
      this._mp.page = next;
      this.reloadMaterialPickerList();
    },

    renderMaterialPickerPager() {
      const box = document.querySelector('#mp-pager');
      if (!box || !this._mp) return;
      const pack = {
        page: Number(this._mp.page || 1),
        pages: Number(this._mp.pages || 1),
        total: Number(this._mp.total || 0),
        pageSize: Number(this._mp.pageSize || 12),
      };
      box.innerHTML = UI.pager(pack, 'materialPickerPage') || `<span class="mp-pager-info">共 ${pack.total} 个素材</span>`;
    },

    renderMaterialPickerList() {
      if (!this._mp) return;
      const rows = this._mp.items || [];
      const grid = document.querySelector('#mp-grid');
      const empty = document.querySelector('#mp-empty');
      if (!grid) return;
      if (!rows.length) {
        grid.innerHTML = '';
        grid.style.display = 'none';
        if (empty) empty.style.display = '';
      } else {
        grid.style.display = '';
        if (empty) empty.style.display = 'none';
        grid.innerHTML = rows
          .map((m) => {
            const id = Number(m.id);
            const on = this._mp.selected.has(id);
            const ext = (m.fileExt || m.file_ext || '').toLowerCase();
            const size = this.formatFileSize ? this.formatFileSize(m.sizeBytes || m.size_bytes || 0) : m.sizeBytes || 0;
            const ps = m.publishStatus || m.publish_status || 'unused';
            const owner = m.ownerName || m.owner_name || (m.ownerId || m.owner_id ? '#' + (m.ownerId || m.owner_id) : '-');
            const pubAcc = m.publishAccount || m.publish_account || m.publish_account_name || '-';
            const title = m.name || m.fileName || m.file_name || ('#' + id);
            const thumb = this.materialThumbHtml(m, { allowVideo: false });
            return `<div class="mp-vcard ${on ? 'is-on' : ''}" data-id="${id}" onclick="app.toggleMaterialPickerItem(${id})">
              <div class="mp-vcard-thumb">
                <span class="mp-vcard-id">#${id}</span>
                ${thumb}
                <span class="mp-vcard-ext">${this.esc(ext || 'video')}</span>
              </div>
              <div class="mp-vcard-body">
                <div class="mp-vcard-name" title="${this.esc(title)}">${this.esc(title)}</div>
                <div class="mp-vcard-meta">${this.esc(String(size))} · ${this.esc(m.createdAt || m.created_at || '-')}</div>
                <div class="mp-vcard-meta">用户 ${this.esc(String(owner))} · <span class="mp-status-${this.esc(ps)}">${this.esc(publishStatusLabel[ps] || ps)}</span></div>
                <div class="mp-vcard-meta">发布账号：${this.esc(String(pubAcc))}</div>
                <div class="mp-vcard-actions" onclick="event.stopPropagation()">
                  <button type="button" class="tiny" data-preview-title="${this.esc(title)}" onclick="app.openMaterialDupPreview(${id}, this.getAttribute('data-preview-title'))">预览</button>
                  <button type="button" class="tiny" onclick="app.renameMaterialPickerItem(${id})">重命名</button>
                  <button type="button" class="tiny danger" onclick="app.deleteMaterialPickerItem(${id})">删除</button>
                </div>
              </div>
            </div>`;
          })
          .join('');
      }
      this.renderMaterialPickerPager();
      this.updateMaterialPickerCount();
    },

    updateMaterialPickerCount() {
      if (!this._mp) return;
      const n = this._mp.selected.size;
      const max = this._mp.max;
      const el = document.querySelector('#mp-count');
      if (el) el.textContent = max ? `已选 ${n} / 最多 ${max}` : `已选 ${n} 个`;
    },

    async toggleMaterialPickerItem(id) {
      if (!this._mp) return;
      id = Number(id);
      if (!this._mp.selectedMap) this._mp.selectedMap = new Map();
      const row = (this._mp.items || []).find((m) => Number(m.id) === id) || this._mp.selectedMap.get(id);
      const already = this._mp.selected.has(id);
      const selecting = this._mp.multiple ? !already : !already;
      if (selecting) {
        const ps = row?.publishStatus || row?.publish_status || 'unused';
        if (ps === 'published') {
          const ok = await this.ask('该视频已发布，是否仍然选择？');
          if (!ok || !this._mp) return;
        }
        if (this._mp.multiple && this._mp.max > 0 && this._mp.selected.size >= this._mp.max) {
          this.toast(`最多选择 ${this._mp.max} 个素材`, true);
          return;
        }
      }
      if (this._mp.multiple) {
        if (already) {
          this._mp.selected.delete(id);
          this._mp.selectedMap.delete(id);
        } else {
          this._mp.selected.add(id);
          if (row) this._mp.selectedMap.set(id, row);
        }
      } else {
        this._mp.selected.clear();
        this._mp.selectedMap.clear();
        this._mp.selected.add(id);
        if (row) this._mp.selectedMap.set(id, row);
      }
      this.renderMaterialPickerList();
    },

    async confirmMaterialPicker() {
      if (!this._mp) return;
      const ids = [...this._mp.selected];
      if (!ids.length) {
        this.toast('请至少选择一个素材', true);
        return;
      }
      if (this._mp.max > 0 && ids.length > this._mp.max) {
        this.toast(`最多选择 ${this._mp.max} 个素材`, true);
        return;
      }
      // 发布前确认本机文件还在
      for (const id of ids) {
        const check = await this.checkMaterialExists(id);
        if (!check.ok) {
          this.toast(`素材 #${id}：${check.message || '本机文件不存在'}`, true);
          return;
        }
      }
      const ordered = ids
        .map((id) => this._mp.selectedMap?.get(id) || this.ownedMaterials().find((m) => Number(m.id) === id) || { id })
        .filter(Boolean);
      const cb = this._mp.onConfirm;
      this.closeMaterialPicker();
      if (typeof cb === 'function') cb(ordered);
    },

    async renameMaterialPickerItem(id) {
      const row = this.ownedMaterials().find((m) => Number(m.id) === Number(id));
      const cur = row?.name || '';
      const name = window.prompt('重命名素材', cur);
      if (name == null) return;
      const next = String(name).trim();
      if (!next) {
        this.toast('名称不能为空', true);
        return;
      }
      try {
        await this.api(`/materials/${id}/rename`, { method: 'PUT', body: JSON.stringify({ name: next }) });
        this.toast('已重命名');
        await this.reloadMaterialPickerList();
        await this.loadRefs?.();
      } catch (e) {
        this.toast(e.message, true);
      }
    },

    async deleteMaterialPickerItem(id) {
      if (!(await this.ask('确定删除该视频素材？删除后不可恢复。', 'error'))) return;
      try {
        await this.api(`/materials/${id}`, { method: 'DELETE' });
        this._mp?.selected.delete(Number(id));
        this._mp?.selectedMap?.delete(Number(id));
        this.toast('已删除');
        if (this._mp && (this._mp.items || []).length <= 1 && this._mp.page > 1) {
          this._mp.page -= 1;
        }
        await this.reloadMaterialPickerList();
        await this.loadRefs?.();
      } catch (e) {
        this.toast(e.message, true);
      }
    },

    async handleMaterialPickerUpload(input) {
      const files = [...(input?.files || [])];
      if (input) input.value = '';
      if (!files.length) return;
      for (const file of files) {
        await this.uploadMaterialPickerFile(file, false);
      }
    },

    openMaterialUploadDialog(opts = {}) {
      ensureUploadDom();
      const options = opts && typeof opts === 'object' ? opts : {};
      const material = options.material && typeof options.material === 'object' ? options.material : null;
      const editId = Number(options.editId || material?.id || 0);
      const isEdit = editId > 0;
      const initialCover = String(material?.coverBase64 || material?.cover_base64 || '');
      this._mpUpload = {
        file: null,
        cover: initialCover,
        frames: [],
        coverIndex: 0,
        coverSource: initialCover ? 'existing' : '',
        coverFileName: '',
        frameSource: null,
        editId: isEdit ? editId : 0,
        initialCover,
        material: material || null,
      };
      this._mpUploadOpts = {
        mode: isEdit ? 'edit' : 'upload',
        defaultTags: options.defaultTags != null ? String(options.defaultTags) : (this._mp ? 'material-picker' : 'materials'),
        title: options.title || (isEdit ? '编辑视频素材' : '添加本机视频'),
        onUploaded: typeof options.onUploaded === 'function' ? options.onUploaded : null,
        onSaved: typeof options.onSaved === 'function' ? options.onSaved : null,
      };
      const mask = document.querySelector('#mp-upload-mask');
      const titleEl = mask.querySelector('.mp-upload-head h3');
      if (titleEl) titleEl.textContent = this._mpUploadOpts.title;
      if (window.UI) UI.resetDialogFullscreen('#mp-upload-mask');
      mask.classList.remove('hidden');
      document.querySelector('#mp-up-drop')?.classList.toggle('hidden', isEdit);
      document.querySelector('#mp-up-locked')?.classList.toggle('hidden', !isEdit);
      document.querySelector('#mp-up-status-wrap')?.toggleAttribute('hidden', !isEdit);
      document.querySelector('#mp-up-ok-label').textContent = isEdit ? '保存修改' : '添加到本机素材库';
      document.querySelector('#mp-up-progress').classList.remove('is-on');
      document.querySelector('#mp-up-bar').style.width = '0%';
      document.querySelector('#mp-up-dup')?.classList.add('hidden');
      const fi = document.querySelector('#mp-up-file');
      if (fi) fi.value = '';
      const ci = document.querySelector('#mp-up-cover-file');
      if (ci) ci.value = '';

      if (isEdit) {
        const fileName = material.fileName || material.file_name || material.name || ('素材#' + editId);
        const mime = material.mimeType || material.mime_type || 'video/mp4';
        const size = Number(material.sizeBytes || material.size_bytes || 0);
        const sizeText = this.formatFileSize ? `${this.formatFileSize(size)}（${size} 字节）` : String(size || '-');
        document.querySelector('#mp-up-name').value = material.name || '';
        document.querySelector('#mp-up-tags').value = material.tags || '';
        document.querySelector('#mp-up-share-title').value = material.shareTitle || material.share_title || '';
        document.querySelector('#mp-up-share-caption').value = material.shareCaption || material.share_caption || '';
        document.querySelector('#mp-up-desc').value = material.description || '';
        document.querySelector('#mp-up-mime').value = mime;
        document.querySelector('#mp-up-size').value = sizeText;
        document.querySelector('#mp-up-status').value = material.status || 'ready';
        document.querySelector('#mp-up-fname').textContent = fileName;
        document.querySelector('#mp-up-fmeta').textContent = `${mime} · ${this.formatFileSize?.(size) || size || '-'}`;
        document.querySelector('#mp-up-preview').classList.add('is-on');
        document.querySelector('#mp-up-ok').disabled = false;
        document.querySelector('#mp-up-frames').innerHTML = '';
        document.querySelector('#mp-up-frames-tip').textContent = '正在按秒分批解帧…';
        if (initialCover) {
          this.applyMaterialUploadCoverPreview(initialCover, '当前封面 · 可截帧或改传封面图');
        } else {
          this.applyMaterialUploadCoverPreview('', '暂无封面 · 可截帧或手动上传');
        }
        this.loadMaterialEditFrames(editId, material);
      } else {
        document.querySelector('#mp-up-name').value = '';
        document.querySelector('#mp-up-tags').value = this._mpUploadOpts.defaultTags;
        document.querySelector('#mp-up-share-title').value = '';
        document.querySelector('#mp-up-share-caption').value = '';
        document.querySelector('#mp-up-desc').value = '';
        document.querySelector('#mp-up-mime').value = 'video/mp4';
        document.querySelector('#mp-up-size').value = '-';
        document.querySelector('#mp-up-preview').classList.remove('is-on');
        document.querySelector('#mp-up-cover-wrap').innerHTML = '<div class="mp-upload-cover-ph">封面预览</div>';
        document.querySelector('#mp-up-cover-tip').textContent = '可选视频截帧，或手动上传封面图';
        document.querySelector('#mp-up-cover-clear')?.toggleAttribute('hidden', true);
        document.querySelector('#mp-up-frames').innerHTML = '';
        document.querySelector('#mp-up-frames-tip').textContent = '请先选择视频';
        document.querySelector('#mp-up-ok').disabled = true;
      }
    },

    openMaterialEditDialog(material, opts = {}) {
      if (!material?.id) {
        this.toast('素材无效', true);
        return;
      }
      this.openMaterialUploadDialog({
        ...opts,
        material,
        editId: Number(material.id),
        title: opts.title || '编辑视频素材',
        onSaved: opts.onSaved || (() => this.refresh?.()),
      });
    },

    async loadMaterialEditFrames(editId, material) {
      const stream = this.materialStreamUrl
        ? this.materialStreamUrl(editId, material?.streamUrl || material?.playUrl || '')
        : '';
      if (!stream || !this._mpUpload || this._mpUpload.editId !== editId) return;
      this._mpUpload.frameSource = stream;
      const frames = await this.extractVideoFramesList(stream, 16);
      if (!this._mpUpload || this._mpUpload.editId !== editId || this._mpUpload.frameSource !== stream) return;
      const keepManual = this._mpUpload.coverSource === 'upload' && this._mpUpload.cover;
      const keepExisting = this._mpUpload.coverSource === 'existing' && this._mpUpload.cover;
      this._mpUpload.frames = frames;
      const box = document.querySelector('#mp-up-frames');
      if (!frames.length) {
        document.querySelector('#mp-up-frames-tip').textContent = '解帧失败，可手动上传封面图';
        if (keepManual || keepExisting) {
          this.applyMaterialUploadCoverPreview(
            this._mpUpload.cover,
            keepManual ? `已用手动封面 · ${this._mpUpload.coverFileName || '图片'}` : '当前封面 · 可改传封面图'
          );
        }
        return;
      }
      document.querySelector('#mp-up-frames-tip').textContent = `共 ${frames.length} 帧，点击选择；或上方手动上传封面`;
      box.innerHTML = frames
        .map(
          (f, i) =>
            `<button type="button" class="mp-frame" onclick="app.selectMaterialUploadFrame(${i})" title="${f.time.toFixed(1)}s">
              <img src="${f.dataUrl}" alt="frame-${i}">
              <span>${f.time.toFixed(1)}s</span>
            </button>`
        )
        .join('');
      if (keepManual || keepExisting) {
        this.applyMaterialUploadCoverPreview(
          this._mpUpload.cover,
          keepManual ? `已用手动封面 · ${this._mpUpload.coverFileName || '图片'}` : '当前封面 · 点击帧可更换'
        );
      } else {
        this.selectMaterialUploadFrame(0);
      }
    },

    closeMaterialUploadDialog() {
      this.closeMaterialDupPreview?.();
      const mask = document.querySelector('#mp-upload-mask');
      if (mask) {
        mask.classList.add('hidden');
        if (window.UI) UI.resetDialogFullscreen(mask);
      }
      this._mpUpload = null;
      this._mpUploadOpts = null;
    },

    sortMaterialDupMatches(matches) {
      return [...(matches || [])].sort((a, b) => {
        const ta = String(a.createdAt || a.created_at || '');
        const tb = String(b.createdAt || b.created_at || '');
        if (ta !== tb) return tb.localeCompare(ta);
        return Number(b.id || 0) - Number(a.id || 0);
      });
    },

    buildMaterialDupCardsHtml(matches, code, totalOverride) {
      const sorted = this.sortMaterialDupMatches(matches);
      const total = Number(totalOverride) > 0 ? Number(totalOverride) : sorted.length;
      const top = sorted.slice(0, 3);
      const label = code === 'HASH_DUP' ? '内容哈希相同' : '同大小同格式';
      const cards = top
        .map((m) => {
          const id = Number(m.id);
          const cover = m.coverBase64 || m.cover_base64 || '';
          const title = m.name || m.fileName || m.file_name || '#' + id;
          const size = this.formatFileSize
            ? this.formatFileSize(m.sizeBytes || m.size_bytes || 0)
            : m.sizeBytes || m.size_bytes || 0;
          const time = m.createdAt || m.created_at || '-';
          const ext = (m.fileExt || m.file_ext || '').toUpperCase() || 'VIDEO';
          const streamUrl = m.streamUrl || m.playUrl || m.stream_url || '';
          const thumb = cover
            ? `<img src="${cover}" alt="cover" loading="lazy">`
            : `<div class="mp-dup-no">无封面</div>`;
          return `<div class="mp-dup-card" data-id="${id}">
            <div class="mp-dup-thumb">${thumb}<span class="mp-dup-id">#${id}</span><span class="mp-dup-ext">${this.esc(ext)}</span></div>
            <div class="mp-dup-info">
              <div class="mp-dup-name" title="${this.esc(title)}">${this.esc(title)}</div>
              <div class="mp-dup-meta">${this.esc(String(size))} · ${this.esc(String(time))}</div>
              <button type="button" class="tiny primary mp-dup-preview-btn" data-preview-id="${id}" data-stream-url="${this.esc(streamUrl)}" data-preview-title="${this.esc(title)}">弹框预览</button>
            </div>
          </div>`;
        })
        .join('');
      const more =
        total > top.length
          ? `<div class="mp-dup-more">共 ${total} 条疑似重复，仅展示时间最近的 ${top.length} 条</div>`
          : '';
      return `<h4>发现${label}视频（${total}）</h4>
        <div class="mp-dup-cards">${cards || '<div class="mp-empty">暂无匹配项</div>'}</div>
        ${more}`;
    },

    bindMaterialDupPreviewButtons(root) {
      if (!root) return;
      root.querySelectorAll('.mp-dup-preview-btn').forEach((btn) => {
        btn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const id = Number(btn.getAttribute('data-preview-id') || 0);
          const streamUrl = btn.getAttribute('data-stream-url') || '';
          const title = btn.getAttribute('data-preview-title') || '';
          if (id) this.openMaterialDupPreview(id, title, streamUrl);
        };
      });
    },

    /** 列表封面：独立接口，避免把 base64 塞进列表 JSON */
    materialCoverUrl(id, coverUrl) {
      const mid = Number(id);
      if (!mid) return '';
      let path = String(coverUrl || '').trim();
      if (!path || path.startsWith('data:')) {
        path = `/api/materials/${mid}/cover`;
      }
      try {
        const u = new URL(path, window.location.origin);
        if (this.authToken) u.searchParams.set('token', this.authToken);
        const acting = this.getActingAsId?.();
        if (acting) u.searchParams.set('actingAs', String(acting));
        return u.toString();
      } catch (_) {
        return path;
      }
    },

    materialThumbHtml(m, opts = {}) {
      const id = Number(m?.id || 0);
      const coverData = String(m?.coverBase64 || m?.cover_base64 || '');
      const hasCover = !!(m?.hasCover || m?.has_cover || (coverData && coverData.startsWith('data:')));
      const imgClass = opts.imgClass || 'mp-vcard-cover';
      const videoClass = opts.videoClass || '';
      const emptyClass = opts.emptyClass || 'mp-vcard-no';
      if (coverData.startsWith('data:')) {
        return `<img class="${imgClass}" src="${coverData}" alt="cover" loading="lazy" decoding="async">`;
      }
      if (hasCover && id) {
        const src = this.materialCoverUrl(id, m.coverUrl || m.cover_url || '');
        return `<img class="${imgClass}" src="${this.esc(src)}" alt="cover" loading="lazy" decoding="async">`;
      }
      if (opts.allowVideo && (m?.status || 'ready') === 'ready' && id) {
        // 列表禁止挂 video src（会并发打流接口）；仅点预览再播
        return `<div class="${emptyClass}">点击预览</div>`;
      }
      return `<div class="${emptyClass}">无封面</div>`;
    },

    /** 线下素材预览：始终走本机 Node，避免远程 PHP 读不到 Windows 路径 */
    materialStreamUrl(id, streamUrl) {
      let path = String(streamUrl || '').trim();
      // 旧数据可能仍指向 /api/materials/*/stream，统一改本机
      if (!path || /\/api\/materials\/\d+\/stream/i.test(path)) {
        path = `/api/local-materials/${Number(id)}/stream`;
      } else if (!/^https?:\/\//i.test(path) && !path.startsWith('/')) {
        path = `/api/local-materials/${Number(id)}/stream`;
      }
      try {
        const u = new URL(path, window.location.origin);
        if (this.authToken) u.searchParams.set('token', this.authToken);
        const acting = this.getActingAsId?.();
        if (acting) u.searchParams.set('actingAs', String(acting));
        return u.toString();
      } catch (_) {
        const q = new URLSearchParams();
        if (this.authToken) q.set('token', this.authToken);
        const acting = this.getActingAsId?.();
        if (acting) q.set('actingAs', String(acting));
        const qs = q.toString();
        const base = path.startsWith('/') ? (window.location.origin + path) : path;
        return base + (qs ? (base.includes('?') ? '&' : '?') + qs : '');
      }
    },

    revokeMaterialPreviewBlob() {
      if (this._mpDupPreviewBlob) {
        try {
          URL.revokeObjectURL(this._mpDupPreviewBlob);
        } catch (_) {}
        this._mpDupPreviewBlob = '';
      }
    },

    materialAuthHeaders() {
      const headers = {};
      if (this.authToken) headers.Authorization = 'Bearer ' + this.authToken;
      const acting = this.getActingAsId?.();
      if (acting) headers['X-Acting-As'] = String(acting);
      return headers;
    },

    /** 预览/发布前：检查本机 Node 能否读到线下素材文件 */
    async checkMaterialExists(id) {
      const mid = Number(id);
      if (!mid) return { ok: false, message: '素材无效', sizeBytes: 0 };
      try {
        const res = await fetch(`/api/local-materials/${mid}/check`, {
          method: 'POST',
          headers: { ...this.materialAuthHeaders(), 'Content-Type': 'application/json' },
          body: '{}',
        });
        const json = await res.json().catch(() => ({}));
        const r = json?.data || json;
        if (res.ok && (json?.success !== false)) {
          return {
            ok: !!r?.exists,
            message: r?.message || json?.message || (r?.exists ? '本机素材文件存在' : '未找到本机素材文件'),
            sizeBytes: Number(r?.sizeBytes || r?.size_bytes || 0),
            filePath: r?.filePath || r?.file_path || '',
            raw: r,
          };
        }
        throw new Error(json?.message || `检查失败 HTTP ${res.status}`);
      } catch (e) {
        try {
          const src = this.materialStreamUrl(mid);
          const res = await fetch(src, {
            method: 'GET',
            headers: { ...this.materialAuthHeaders(), Range: 'bytes=0-0' },
          });
          if (res.ok || res.status === 206) {
            return { ok: true, message: '本机素材文件存在', sizeBytes: 0 };
          }
          if (res.status === 404) {
            return { ok: false, message: '未找到本机素材文件', sizeBytes: 0 };
          }
        } catch (_) {}
        return { ok: false, message: e.message || '本机素材检测失败', sizeBytes: 0 };
      }
    },

    /**
     * 本机线下素材：一律用 Node Range 直链，禁止整文件拉成 blob（会卡死大视频）。
     * 浏览器安全策略不允许 http 页直接用 file:///D:/xxx.mp4。
     */
    async resolveMaterialPlayUrl(id, streamUrl, opts = {}) {
      const mid = Number(id);
      const direct = this.materialStreamUrl(mid, streamUrl);
      if (opts.forceStream !== false) {
        return { url: direct, via: 'stream', revoke: false };
      }
      return { url: direct, via: 'stream', revoke: false };
    },

    async loadMaterialPreviewVideo(video, id, streamUrl, opts = {}) {
      if (!video || !id) return false;
      const statusEl = opts.statusEl || null;
      const setStatus = (t) => {
        if (statusEl) {
          statusEl.hidden = false;
          statusEl.style.display = '';
          statusEl.textContent = t;
        }
      };
      this.revokeMaterialPreviewBlob();
      try {
        video.pause();
      } catch (_) {}
      video.onerror = null;
      video.removeAttribute('src');
      video.load();

      // 已检查过则跳过；否则只做轻量存在性探测（不再整包下载）
      let check = opts.check || null;
      if (!check && opts.skipCheck !== true) {
        setStatus('正在检测本机文件…');
        check = await this.checkMaterialExists(id);
        if (!check.ok) {
          setStatus(check.message || '素材文件不存在');
          this.toast?.(check.message || '素材文件不存在', true);
          return false;
        }
      }

      setStatus('正在打开本机视频…');
      const play = await this.resolveMaterialPlayUrl(id, streamUrl, { forceStream: true });
      video.setAttribute('playsinline', '');
      video.controls = true;
      video.style.display = '';
      // 同源本机流，不要设 crossOrigin，避免多余预检
      try { video.removeAttribute('crossorigin'); } catch (_) {}
      video.onerror = () => {
        setStatus('视频预览失败：请确认本机文件仍在且 Node 已重启');
        this.toast?.('视频预览失败', true);
      };
      video.src = play.url;
      try { video.load(); } catch (_) {}

      // 尽快露出画面：不等整段缓冲，canplay/loadeddata 任一即可
      const ready = await new Promise((resolve) => {
        let done = false;
        const finish = (ok) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          video.removeEventListener('loadeddata', onOk);
          video.removeEventListener('canplay', onOk);
          video.removeEventListener('loadedmetadata', onOk);
          video.removeEventListener('error', onErr);
          resolve(ok);
        };
        const onOk = () => finish(true);
        const onErr = () => finish(false);
        const timer = setTimeout(() => finish(video.readyState >= 1), 8000);
        video.addEventListener('loadedmetadata', onOk);
        video.addEventListener('loadeddata', onOk);
        video.addEventListener('canplay', onOk);
        video.addEventListener('error', onErr);
      });
      if (!ready && video.readyState < 1) {
        setStatus('视频加载失败');
        return false;
      }
      if (statusEl) {
        try {
          statusEl.remove();
        } catch (_) {
          statusEl.textContent = '';
          statusEl.hidden = true;
          statusEl.style.display = 'none';
        }
      }
      try {
        await video.play?.();
      } catch (_) {}
      return true;
    },

    async openMaterialDupPreview(id, title, streamUrl) {
      const mid = Number(id);
      if (!mid) return;
      // 先弹窗再检测，避免“点了没反应”
      ensureDupPreviewDom();
      const mask = document.querySelector('#mp-dup-preview-mask');
      const video = document.querySelector('#mp-dup-preview-video');
      const titleEl = document.querySelector('#mp-dup-preview-title');
      const statusEl = document.querySelector('#mp-dup-preview-status');
      if (titleEl) titleEl.textContent = title ? `预览 · ${title}` : `预览素材 #${mid}`;
      if (window.UI) UI.resetDialogFullscreen('#mp-dup-preview-mask');
      mask?.classList.remove('hidden');
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.style.display = '';
        statusEl.textContent = '正在打开本机视频…';
      }
      if (video) {
        video.style.display = '';
        video.removeAttribute('src');
      }
      const ok = await this.loadMaterialPreviewVideo(video, mid, streamUrl, { statusEl });
      if (ok && statusEl) {
        statusEl.hidden = true;
        statusEl.style.display = 'none';
      }
      if (!ok) {
        this.closeMaterialDupPreview();
      }
    },

    closeMaterialDupPreview() {
      const mask = document.querySelector('#mp-dup-preview-mask');
      const video = document.querySelector('#mp-dup-preview-video');
      if (video) {
        try {
          video.pause();
        } catch (_) {}
        video.onerror = null;
        video.removeAttribute('src');
        video.load();
      }
      this.revokeMaterialPreviewBlob();
      if (mask) {
        mask.classList.add('hidden');
        if (window.UI) UI.resetDialogFullscreen(mask);
      }
    },

    applyMaterialUploadCoverPreview(cover, tip) {
      if (cover) {
        document.querySelector('#mp-up-cover-wrap').innerHTML = `<img class="mp-upload-cover" src="${cover}" alt="cover">`;
      } else {
        document.querySelector('#mp-up-cover-wrap').innerHTML = '<div class="mp-upload-cover-ph">暂无封面</div>';
      }
      if (tip != null) document.querySelector('#mp-up-cover-tip').textContent = tip;
      const clearBtn = document.querySelector('#mp-up-cover-clear');
      if (clearBtn) clearBtn.hidden = this._mpUpload?.coverSource !== 'upload';
    },

    selectMaterialUploadFrame(index) {
      if (!this._mpUpload?.frames?.length) return;
      const i = Math.max(0, Math.min(this._mpUpload.frames.length - 1, Number(index) || 0));
      this._mpUpload.coverIndex = i;
      this._mpUpload.cover = this._mpUpload.frames[i]?.dataUrl || '';
      this._mpUpload.coverSource = 'frame';
      this._mpUpload.coverFileName = '';
      document.querySelectorAll('#mp-up-frames .mp-frame').forEach((el, idx) => {
        el.classList.toggle('is-on', idx === i);
      });
      const cover = this._mpUpload.cover;
      if (cover) {
        const t = this._mpUpload.frames[i]?.time ?? 0;
        this.applyMaterialUploadCoverPreview(cover, `已选封面 · 第 ${i + 1} 帧 · ${t.toFixed(1)}s`);
      }
    },

    clearMaterialUploadManualCover() {
      if (!this._mpUpload) return;
      this._mpUpload.coverSource = '';
      this._mpUpload.coverFileName = '';
      if (this._mpUpload.frames?.length) {
        this.selectMaterialUploadFrame(this._mpUpload.coverIndex || 0);
        return;
      }
      if (this._mpUpload.initialCover) {
        this._mpUpload.cover = this._mpUpload.initialCover;
        this._mpUpload.coverSource = 'existing';
        this.applyMaterialUploadCoverPreview(this._mpUpload.cover, '当前封面 · 可截帧或改传封面图');
        return;
      }
      this._mpUpload.cover = '';
      this.applyMaterialUploadCoverPreview('', '可选视频截帧，或手动上传封面图');
    },

    imageFileToCoverBase64(file, maxW = 720) {
      return new Promise((resolve) => {
        if (!file) {
          resolve('');
          return;
        }
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          try {
            const w = img.naturalWidth || img.width || 0;
            const h = img.naturalHeight || img.height || 0;
            if (!w || !h) {
              resolve('');
              return;
            }
            const scale = Math.min(1, maxW / w);
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(w * scale));
            canvas.height = Math.max(1, Math.round(h * scale));
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.86));
          } catch (_) {
            resolve('');
          } finally {
            try {
              URL.revokeObjectURL(url);
            } catch (_) {}
          }
        };
        img.onerror = () => {
          try {
            URL.revokeObjectURL(url);
          } catch (_) {}
          resolve('');
        };
        img.src = url;
      });
    },

    async onMaterialUploadCoverPicked(file) {
      if (!file) return;
      const ext = '.' + String(file.name || '').split('.').pop().toLowerCase();
      const okExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
      if (!(file.type || '').startsWith('image/') && !okExt.includes(ext)) {
        this.toast('请选择图片作为封面（JPG / PNG / WebP）', true);
        return;
      }
      if (!this._mpUpload) this._mpUpload = { file: null, cover: '', frames: [], coverIndex: 0, coverSource: '', coverFileName: '' };
      const tipEl = document.querySelector('#mp-up-cover-tip');
      if (tipEl) tipEl.textContent = '正在处理封面图…';
      const cover = await this.imageFileToCoverBase64(file);
      if (!cover) {
        this.toast('封面图读取失败，请换一张图片', true);
        if (tipEl) tipEl.textContent = this._mpUpload.cover ? '当前封面可用' : '可选视频截帧，或手动上传封面图';
        return;
      }
      this._mpUpload.cover = cover;
      this._mpUpload.coverSource = 'upload';
      this._mpUpload.coverFileName = file.name || 'cover.jpg';
      document.querySelectorAll('#mp-up-frames .mp-frame').forEach((el) => el.classList.remove('is-on'));
      this.applyMaterialUploadCoverPreview(cover, `已用手动封面 · ${file.name || '图片'}`);
      document.querySelector('#mp-up-preview')?.classList.add('is-on');
    },

    _mpSleep(ms) {
      return new Promise((r) => setTimeout(r, Math.max(0, Number(ms) || 0)));
    },

    /**
     * 在指定秒数截一帧：seeked + 轮询 readyState/currentTime，避免长视频 seek 卡住。
     */
    _mpCaptureVideoFrameAt(video, timeSec, opts = {}) {
      const timeoutMs = Math.max(800, Number(opts.timeoutMs) || 4500);
      const maxW = Math.max(80, Number(opts.maxW) || 320);
      const quality = Number(opts.quality) || 0.78;
      const target = Math.max(0.05, Number(timeSec) || 0.05);
      return new Promise((resolve) => {
        let settled = false;
        const finish = (val) => {
          if (settled) return;
          settled = true;
          clearInterval(poll);
          clearTimeout(timer);
          video.removeEventListener('seeked', onSeeked);
          resolve(val || null);
        };
        const draw = () => {
          try {
            const w = video.videoWidth || 0;
            const h = video.videoHeight || 0;
            if (!w || !h || video.readyState < 2) return false;
            const scale = Math.min(1, maxW / w);
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(w * scale));
            canvas.height = Math.max(1, Math.round(h * scale));
            canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
            finish({
              time: target,
              dataUrl: canvas.toDataURL('image/jpeg', quality),
            });
            return true;
          } catch (_) {
            return false;
          }
        };
        const onSeeked = () => {
          // 尚未 ready 时交给轮询，勿立刻判失败（长视频常见）
          draw();
        };
        const poll = setInterval(() => {
          if (settled) return;
          if (Math.abs((video.currentTime || 0) - target) <= 0.55 && video.readyState >= 2) {
            draw();
          }
        }, 90);
        const timer = setTimeout(() => {
          if (settled) return;
          if (Math.abs((video.currentTime || 0) - target) <= 1.2 && video.readyState >= 2) {
            draw();
          } else {
            finish(null);
          }
        }, timeoutMs);
        video.addEventListener('seeked', onSeeked);
        try {
          // 已接近目标时强制微调，确保触发 seeked / 轮询
          if (Math.abs((video.currentTime || 0) - target) < 0.02) {
            video.currentTime = Math.max(0.05, target + 0.01);
          } else {
            video.currentTime = target;
          }
        } catch (_) {
          finish(null);
        }
      });
    },

    /** 同一秒位失败时，在邻近视口再试几次 */
    async _mpCaptureVideoFrameWithRetry(video, timeSec, opts = {}) {
      const dur = Number(opts.duration) || 0;
      const base = Math.max(0.05, Number(timeSec) || 0.05);
      const deltas = opts.quick
        ? [0, 0.25, -0.25]
        : [0, 0.2, -0.2, 0.45, -0.45, 0.8];
      for (const d of deltas) {
        let t = base + d;
        if (dur > 0) t = Math.min(Math.max(0.05, t), Math.max(0.05, dur - 0.05));
        else t = Math.max(0.05, t);
        const frame = await this._mpCaptureVideoFrameAt(video, t, opts);
        if (frame?.dataUrl) return { ...frame, time: base };
        await this._mpSleep(15);
      }
      return null;
    },

    /**
     * 按「秒」取样封面帧；长视频按 6s 一批分段解析 + 轮询 seek，避免 >10s 视频整段 seek 失败。
     * 例：60s → 约 10 批，每批窗口 6s。
     */
    async extractVideoFramesList(source, count = 16) {
      if (!source) return [];
      const isFile = typeof File !== 'undefined' && source instanceof File;
      const url = isFile ? URL.createObjectURL(source) : String(source);
      const sourceKey = isFile ? source : url;
      if (this._mpUpload) this._mpUpload.frameSource = sourceKey;
      const stillCurrent = () => this._mpUpload?.frameSource === sourceKey;

      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      video.preload = 'auto';
      video.src = url;

      const cleanupUrl = () => {
        if (!isFile) return;
        try {
          URL.revokeObjectURL(url);
        } catch (_) {}
      };

      try {
        await new Promise((resolve, reject) => {
          const onMeta = () => {
            cleanup();
            resolve();
          };
          const onErr = () => {
            cleanup();
            reject(new Error('video load error'));
          };
          const cleanup = () => {
            video.removeEventListener('loadedmetadata', onMeta);
            video.removeEventListener('error', onErr);
          };
          video.addEventListener('loadedmetadata', onMeta);
          video.addEventListener('error', onErr);
          // 部分浏览器 blob 已缓存时可能错过事件
          if (video.readyState >= 1) {
            cleanup();
            resolve();
          }
        });
      } catch (_) {
        cleanupUrl();
        return [];
      }

      const dur = Number(video.duration);
      const safeDur = Number.isFinite(dur) && dur > 0 ? dur : 1;
      const n = Math.max(8, Math.min(24, Number(count) || 16));
      // 目标时刻：按整段均匀取「秒」点
      const targets = [];
      for (let i = 0; i < n; i += 1) {
        const t = safeDur * ((i + 0.5) / n);
        targets.push(Math.min(Math.max(0.05, t), Math.max(0.05, safeDur - 0.05)));
      }

      const BATCH_SEC = 6;
      const batchCount = Math.max(1, Math.ceil(safeDur / BATCH_SEC));
      const overallMs = Math.min(180000, Math.max(60000, Math.ceil(safeDur) * 2500 + batchCount * 1500));
      const startedAt = Date.now();
      const frames = [];
      const tipEl = () => document.querySelector('#mp-up-frames-tip');

      try {
        for (let b = 0; b < batchCount; b += 1) {
          if (!stillCurrent()) break;
          if (Date.now() - startedAt > overallMs) break;

          const batchStart = b * BATCH_SEC;
          const batchEnd = Math.min(safeDur, (b + 1) * BATCH_SEC);
          // 末批用闭区间，避免最后一帧落在终点被漏掉
          const inBatch = targets.filter((t) => {
            if (b === batchCount - 1) return t >= batchStart && t <= batchEnd + 0.001;
            return t >= batchStart && t < batchEnd;
          });
          if (!inBatch.length) continue;

          const tip = tipEl();
          if (tip) {
            tip.textContent = `正在解帧 第 ${b + 1}/${batchCount} 批（${batchStart.toFixed(0)}–${batchEnd.toFixed(0)}s）· ${frames.length}/${n}`;
          }

          // 先 seek 到本批起点预热解码器，再轮询等到接近起点
          try {
            video.currentTime = Math.max(0.05, batchStart || 0.05);
          } catch (_) {}
          await this._mpSleep(60);
          const warmDeadline = Date.now() + 1200;
          while (Date.now() < warmDeadline) {
            if (video.readyState >= 2 && Math.abs((video.currentTime || 0) - (batchStart || 0.05)) <= 1) break;
            await this._mpSleep(80);
          }

          for (const t of inBatch) {
            if (!stillCurrent()) break;
            if (Date.now() - startedAt > overallMs) break;
            // 跳过已成功截到的近似时刻
            if (frames.some((f) => Math.abs(f.time - t) < 0.08)) continue;
            const frame = await this._mpCaptureVideoFrameWithRetry(video, t, {
              duration: safeDur,
              timeoutMs: safeDur > 20 ? 4200 : 3200,
              maxW: 320,
              quality: 0.78,
              quick: true,
            });
            if (frame?.dataUrl) frames.push(frame);
            const tip2 = tipEl();
            if (tip2) {
              tip2.textContent = `正在解帧 第 ${b + 1}/${batchCount} 批 · ${frames.length}/${n}（${t.toFixed(1)}s）`;
            }
            // 帧与帧之间让出主线程，避免 UI 卡死
            await this._mpSleep(20);
          }

          // 批与批之间短暂停顿，给浏览器释放解码缓冲
          await this._mpSleep(40);
        }
      } finally {
        try {
          video.pause();
          video.removeAttribute('src');
          video.load();
        } catch (_) {}
        cleanupUrl();
      }

      // 按时间排序，保证封面帧顺序稳定
      frames.sort((a, b) => a.time - b.time);
      return frames;
    },

    async onMaterialUploadFilePicked(file) {
      if (!file) return;
      const ext = '.' + String(file.name || '').split('.').pop().toLowerCase();
      const okExt = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.flv'];
      if (!(file.type || '').startsWith('video/') && !okExt.includes(ext)) {
        this.toast('请选择视频文件', true);
        return;
      }
      if (!this._mpUpload) this._mpUpload = {};
      if (this._mpUpload.editId) {
        this.toast('编辑模式不可更换视频文件', true);
        return;
      }
      this._mpUpload.file = file;
      this._mpUpload.cover = '';
      this._mpUpload.frames = [];
      this._mpUpload.coverIndex = 0;
      this._mpUpload.coverSource = '';
      this._mpUpload.coverFileName = '';
      this._mpUpload.frameSource = file;
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      document.querySelector('#mp-up-name').value = baseName;
      if (!String(document.querySelector('#mp-up-share-title')?.value || '').trim()) {
        document.querySelector('#mp-up-share-title').value = baseName;
      }
      document.querySelector('#mp-up-mime').value = file.type || 'video/mp4';
      document.querySelector('#mp-up-size').value = this.formatFileSize
        ? `${this.formatFileSize(file.size)}（${file.size} 字节）`
        : String(file.size);
      document.querySelector('#mp-up-fname').textContent = file.name;
      document.querySelector('#mp-up-fmeta').textContent = `${file.type || 'video'} · ${this.formatFileSize?.(file.size) || file.size}`;
      document.querySelector('#mp-up-preview').classList.add('is-on');
      document.querySelector('#mp-up-cover-clear')?.toggleAttribute('hidden', true);
      document.querySelector('#mp-up-cover-tip').textContent = '正在按秒分段解析封面…也可先手动上传封面图';
      document.querySelector('#mp-up-cover-wrap').innerHTML = '<div class="mp-upload-cover-ph">解帧中…</div>';
      document.querySelector('#mp-up-frames').innerHTML = '';
      document.querySelector('#mp-up-frames-tip').textContent = '正在按秒分批解帧…';
      document.querySelector('#mp-up-ok').disabled = false;
      const frames = await this.extractVideoFramesList(file, 16);
      if (this._mpUpload?.file !== file) return;
      // 解帧期间若已手动上传封面，保留手动封面，仅填充帧列表供切换
      const keepManual = this._mpUpload.coverSource === 'upload' && this._mpUpload.cover;
      this._mpUpload.frames = frames;
      const box = document.querySelector('#mp-up-frames');
      if (!frames.length) {
        document.querySelector('#mp-up-frames-tip').textContent = '解帧失败，可手动上传封面或使用单帧';
        if (keepManual) {
          this.applyMaterialUploadCoverPreview(this._mpUpload.cover, `已用手动封面 · ${this._mpUpload.coverFileName || '图片'}`);
          return;
        }
        const cover = await this.captureVideoCoverBase64(file);
        if (this._mpUpload?.file !== file) return;
        if (this._mpUpload.coverSource === 'upload' && this._mpUpload.cover) {
          this.applyMaterialUploadCoverPreview(this._mpUpload.cover, `已用手动封面 · ${this._mpUpload.coverFileName || '图片'}`);
          return;
        }
        this._mpUpload.cover = cover || '';
        this._mpUpload.coverSource = cover ? 'frame' : '';
        if (cover) {
          this.applyMaterialUploadCoverPreview(cover, '已生成单帧封面 · 也可改传自定义封面');
        } else {
          this.applyMaterialUploadCoverPreview('', '封面截取失败，可手动上传封面图后仍可上传');
        }
        return;
      }
      document.querySelector('#mp-up-frames-tip').textContent = `共 ${frames.length} 帧，点击选择；或上方手动上传封面`;
      box.innerHTML = frames
        .map(
          (f, i) =>
            `<button type="button" class="mp-frame ${!keepManual && i === 0 ? 'is-on' : ''}" onclick="app.selectMaterialUploadFrame(${i})" title="${f.time.toFixed(1)}s">
              <img src="${f.dataUrl}" alt="frame-${i}">
              <span>${f.time.toFixed(1)}s</span>
            </button>`
        )
        .join('');
      if (keepManual) {
        this.applyMaterialUploadCoverPreview(this._mpUpload.cover, `已用手动封面 · ${this._mpUpload.coverFileName || '图片'}`);
      } else {
        this.selectMaterialUploadFrame(0);
      }
    },

    async submitMaterialUploadDialog(forceUpload = false) {
      const isEdit = this._mpUploadOpts?.mode === 'edit' || Number(this._mpUpload?.editId || 0) > 0;
      const editId = Number(this._mpUpload?.editId || 0);
      const file = this._mpUpload?.file;
      if (!isEdit && !file) {
        this.toast('请先选择视频文件', true);
        return;
      }
      const nameFallback = isEdit
        ? String(this._mpUpload?.material?.name || ('素材#' + editId))
        : file.name.replace(/\.[^/.]+$/, '');
      const name = String(document.querySelector('#mp-up-name')?.value || '').trim() || nameFallback;
      const fallbackTags = this._mpUploadOpts?.defaultTags || (this._mp ? 'material-picker' : 'materials');
      const tags = String(document.querySelector('#mp-up-tags')?.value || '').trim() || fallbackTags;
      const description = String(document.querySelector('#mp-up-desc')?.value || '').trim();
      const shareTitle = String(document.querySelector('#mp-up-share-title')?.value || '').trim();
      const shareCaption = String(document.querySelector('#mp-up-share-caption')?.value || '').trim();
      const cover = this._mpUpload?.cover || '';
      const onUploaded = this._mpUploadOpts?.onUploaded || null;
      const onSaved = this._mpUploadOpts?.onSaved || null;
      const okBtn = document.querySelector('#mp-up-ok');
      const prog = document.querySelector('#mp-up-progress');
      const bar = document.querySelector('#mp-up-bar');
      const dup = document.querySelector('#mp-up-dup');
      if (okBtn) okBtn.disabled = true;
      if (prog) prog.classList.add('is-on');
      if (bar) bar.style.width = isEdit ? '30%' : '0%';
      if (dup) {
        dup.classList.add('hidden');
        dup.innerHTML = '';
      }
      try {
        if (isEdit) {
          const matOld = this._mpUpload?.material || {};
          const status = String(document.querySelector('#mp-up-status')?.value || matOld.status || 'ready');
          const payload = {
            name,
            tags,
            description,
            shareTitle,
            shareCaption,
            status,
            fileName: matOld.fileName || matOld.file_name || '',
            mimeType: matOld.mimeType || matOld.mime_type || '',
            sizeBytes: Number(matOld.sizeBytes || matOld.size_bytes || 0),
            filePath: matOld.filePath || matOld.file_path || '',
          };
          if (bar) bar.style.width = '60%';
          const mat = await this.api(`/materials/${editId}`, { method: 'PUT', body: JSON.stringify(payload) });
          const coverChanged = cover && cover !== (this._mpUpload?.initialCover || '');
          if (coverChanged) {
            try {
              await this.api(`/materials/${editId}/cover`, { method: 'PUT', body: JSON.stringify({ coverBase64: cover }) });
            } catch (e) {
              this.toast(e.message || '封面更新失败', true);
            }
          }
          if (bar) bar.style.width = '100%';
          this.toast('素材已更新');
          this.closeMaterialUploadDialog();
          await this.loadRefs?.();
          if (typeof this.reloadMaterialPickerList === 'function' && this._mp) {
            await this.reloadMaterialPickerList();
          }
          if (typeof onSaved === 'function') {
            try { await onSaved(mat); } catch (_) {}
          } else if (typeof onUploaded === 'function') {
            try { await onUploaded(mat); } catch (_) {}
          } else if (!this._mp && (this.view === 'materials' || this.matrixTab === 'materials' || this.view === 'publish')) {
            this.refresh?.();
          }
          return;
        }
        // 有本机绝对路径（Electron file.path）只登记路径；否则落到本机 Node ingest，不上传 PHP
        const nativePath = String(file.path || file._path || '').trim();
        let mat = null;
        if (nativePath) {
          if (bar) bar.style.width = '40%';
          mat = await this.api('/local-materials/register', {
            method: 'POST',
            body: JSON.stringify({
              filePath: nativePath,
              name,
              tags,
              description,
              shareTitle,
              shareCaption,
              coverBase64: cover || '',
            }),
          });
          if (bar) bar.style.width = '100%';
        } else {
          const fd = new FormData();
          fd.append('file', file);
          fd.append('name', name);
          fd.append('tags', tags);
          fd.append('description', description);
          fd.append('shareTitle', shareTitle);
          fd.append('shareCaption', shareCaption);
          fd.append('reuseExisting', '0');
          if (forceUpload) fd.append('forceUpload', '1');
          if (cover) fd.append('coverBase64', cover);
          mat = await this.uploadVideoWithProgress(fd, (pct) => {
            if (bar) bar.style.width = pct + '%';
          });
        }
        if (mat?.id && cover && !(mat.coverBase64 || mat.cover_base64)) {
          try {
            await this.api(`/materials/${mat.id}/cover`, { method: 'PUT', body: JSON.stringify({ coverBase64: cover }) });
          } catch (_) {}
        }
        this.toast(`已添加本机素材：${mat?.name || name}`);
        this.closeMaterialUploadDialog();
        if (this._mp) this._mp.page = 1;
        if (typeof this.reloadMaterialPickerList === 'function' && this._mp) {
          await this.reloadMaterialPickerList();
        }
        await this.loadRefs?.();
        if (mat?.id && this._mp) {
          if (!this._mp.multiple) this._mp.selected.clear();
          if (!(this._mp.max > 0 && this._mp.selected.size >= this._mp.max)) {
            this._mp.selected.add(Number(mat.id));
            this._mp.selectedMap?.set(Number(mat.id), mat);
          }
          this.renderMaterialPickerList();
        }
        if (typeof onUploaded === 'function') {
          try { await onUploaded(mat); } catch (_) {}
        } else if (!this._mp && (this.view === 'materials' || this.matrixTab === 'materials')) {
          this.refresh?.();
        }
      } catch (err) {
        const data = err.data || {};
        if (data.code === 'SIZE_DUP' || data.code === 'HASH_DUP') {
          const matches = data.matches || [];
          const total = data.matchTotal || matches.length;
          if (dup) {
            dup.classList.remove('hidden');
            dup.innerHTML = `${this.buildMaterialDupCardsHtml(matches, data.code, total)}
              <div class="action-bar" style="margin-top:12px">
                <button type="button" class="primary" id="mp-up-force">非重复，继续入库</button>
                <button type="button" class="ghost" id="mp-up-dup-cancel">取消</button>
              </div>`;
            this.bindMaterialDupPreviewButtons(dup);
            dup.querySelector('#mp-up-force').onclick = () => this.submitMaterialUploadDialog(true);
            dup.querySelector('#mp-up-dup-cancel').onclick = () => {
              dup.classList.add('hidden');
              dup.innerHTML = '';
            };
          }
          this.toast(err.message || '发现疑似重复视频', 'warn', 4000);
        } else {
          this.toast(err.message || '上传失败', true);
        }
        if (okBtn) okBtn.disabled = false;
      } finally {
        if (prog) prog.classList.remove('is-on');
      }
    },

    /**
     * 单帧封面兜底：按秒候选点分批尝试（前 6s 一批，再试中段），配合轮询 seek。
     */
    async captureVideoCoverBase64(file, seekSec = 0.8) {
      if (!file) return '';
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      video.preload = 'auto';
      video.src = url;
      try {
        await new Promise((resolve, reject) => {
          const onReady = () => {
            cleanup();
            resolve();
          };
          const onErr = () => {
            cleanup();
            reject(new Error('video load error'));
          };
          const cleanup = () => {
            video.removeEventListener('loadedmetadata', onReady);
            video.removeEventListener('loadeddata', onReady);
            video.removeEventListener('error', onErr);
          };
          video.addEventListener('loadedmetadata', onReady);
          video.addEventListener('loadeddata', onReady);
          video.addEventListener('error', onErr);
          if (video.readyState >= 1) {
            cleanup();
            resolve();
          }
        });
      } catch (_) {
        try {
          URL.revokeObjectURL(url);
        } catch (_) {}
        return '';
      }

      const dur = Number(video.duration);
      const safeDur = Number.isFinite(dur) && dur > 0 ? dur : 1;
      const prefer = Math.max(0.1, Number(seekSec) || 0.8);
      // 按秒候选：前 6 秒优先，再中段，避免长视频一次 seek 到很远失败
      const candidates = [
        prefer,
        0.5,
        1,
        2,
        3,
        4,
        5,
        Math.min(safeDur * 0.08, 6),
        Math.min(safeDur * 0.25, Math.max(6, safeDur / 2)),
        Math.min(safeDur * 0.5, Math.max(0.1, safeDur - 0.1)),
      ]
        .map((t) => Math.min(Math.max(0.05, t), Math.max(0.05, safeDur - 0.05)))
        .filter((t, i, arr) => arr.findIndex((x) => Math.abs(x - t) < 0.05) === i);

      // 分两批：≤6s 与 >6s
      const batches = [
        candidates.filter((t) => t <= 6.01),
        candidates.filter((t) => t > 6.01),
      ].filter((b) => b.length);

      let cover = '';
      try {
        for (const batch of batches) {
          const warm = Math.max(0.05, batch[0] || 0.05);
          try {
            video.currentTime = warm;
          } catch (_) {}
          await this._mpSleep(80);
          for (const t of batch) {
            const frame = await this._mpCaptureVideoFrameWithRetry(video, t, {
              duration: safeDur,
              timeoutMs: 5000,
              maxW: 480,
              quality: 0.82,
            });
            if (frame?.dataUrl) {
              cover = frame.dataUrl;
              break;
            }
            await this._mpSleep(20);
          }
          if (cover) break;
          await this._mpSleep(40);
        }
      } finally {
        try {
          video.pause();
          video.removeAttribute('src');
          video.load();
        } catch (_) {}
        try {
          URL.revokeObjectURL(url);
        } catch (_) {}
      }
      return cover;
    },

    /**
     * 浏览器 FormData 上传到本机 Node ingest（带进度）。
     * 必须挂在 material-picker：videoDelivery 等页不加载 publish.js。
     */
    uploadVideoWithProgress(formData, onProgress) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/local-materials/ingest');
        if (this.authToken) xhr.setRequestHeader('Authorization', 'Bearer ' + this.authToken);
        const actingAs = this.getActingAsId?.();
        if (actingAs) xhr.setRequestHeader('X-Acting-As', String(actingAs));
        if (xhr.upload && typeof onProgress === 'function') {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
          };
        }
        xhr.onload = () => {
          let json = null;
          try { json = JSON.parse(xhr.responseText); } catch (_) {}
          if (xhr.status >= 200 && xhr.status < 300 && json && json.success) {
            resolve(json.data);
            return;
          }
          const err = new Error(json?.message || `上传失败 (HTTP ${xhr.status})`);
          err.data = json?.data || null;
          err.code = json?.code || json?.data?.code;
          reject(err);
        };
        xhr.onerror = () => reject(new Error('网络请求异常，请检查接口服务'));
        xhr.send(formData);
      });
    },

    async uploadMaterialPickerFile(file, forceUpload) {
      const panel = document.querySelector('#mp-dup-panel');
      try {
        this.toast('正在截取封面…', 'info', 1200);
        const cover = await this.captureVideoCoverBase64(file);
        const nativePath = String(file.path || file._path || '').trim();
        const name = file.name.replace(/\.[^/.]+$/, '');
        let mat = null;
        if (nativePath) {
          mat = await this.api('/local-materials/register', {
            method: 'POST',
            body: JSON.stringify({
              filePath: nativePath,
              name,
              tags: 'material-picker',
              coverBase64: cover || '',
            }),
          });
        } else {
          const fd = new FormData();
          fd.append('file', file);
          fd.append('name', name);
          fd.append('tags', 'material-picker');
          fd.append('reuseExisting', '0');
          if (forceUpload) fd.append('forceUpload', '1');
          if (cover) fd.append('coverBase64', cover);
          mat = await this.uploadVideoWithProgress(fd, null);
        }
        if (mat?.id && cover && !(mat.coverBase64 || mat.cover_base64)) {
          try {
            await this.api(`/materials/${mat.id}/cover`, { method: 'PUT', body: JSON.stringify({ coverBase64: cover }) });
          } catch (_) {}
        }
        if (panel) {
          panel.classList.add('hidden');
          panel.innerHTML = '';
        }
        this.toast(`已添加本机素材：${mat?.name || file.name}`);
        await this.reloadMaterialPickerList();
        await this.loadRefs?.();
        if (mat?.id && this._mp) {
          if (!this._mp.multiple) this._mp.selected.clear();
          if (!(this._mp.max > 0 && this._mp.selected.size >= this._mp.max)) {
            this._mp.selected.add(Number(mat.id));
          }
          this.renderMaterialPickerList();
        }
      } catch (err) {
        const data = err.data || {};
        if (data.code === 'SIZE_DUP' || data.code === 'HASH_DUP') {
          const matches = data.matches || [];
          const total = data.matchTotal || matches.length;
          if (panel) {
            panel.classList.remove('hidden');
            panel.innerHTML = `${this.buildMaterialDupCardsHtml(matches, data.code, total)}
              <div class="action-bar" style="margin-top:12px">
                <button type="button" class="primary" id="mp-force-upload">非重复，继续入库</button>
                <button type="button" class="ghost" id="mp-cancel-dup">取消本次上传</button>
              </div>`;
            this.bindMaterialDupPreviewButtons(panel);
            panel.querySelector('#mp-force-upload').onclick = () => {
              panel.classList.add('hidden');
              this.uploadMaterialPickerFile(file, true);
            };
            panel.querySelector('#mp-cancel-dup').onclick = () => {
              panel.classList.add('hidden');
              panel.innerHTML = '';
            };
          }
          this.toast(err.message || '发现疑似重复视频', 'warn', 4000);
          return;
        }
        this.toast(err.message || '上传失败', true);
      }
    },
  };

  // Attach to app when ready
  function attach() {
    if (!window.app) {
      setTimeout(attach, 30);
      return;
    }
    Object.assign(window.app, methods);
  }
  attach();
})();
