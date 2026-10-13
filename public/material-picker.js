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

  function ensureDom() {
    let mask = document.querySelector('#material-picker-mask');
    if (mask && (!mask.querySelector('#mp-grid') || mask.querySelector('#mp-file') || !mask.querySelector('#mp-pager') || !mask.querySelector('#mp-loading') || !mask.querySelector('#mp-publish-filter'))) {
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
          <button type="button" class="mp-close" id="mp-close" aria-label="关闭" title="关闭">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="mp-toolbar">
          <input class="input" id="mp-search" type="search" placeholder="搜索 ID / 文件名 / 后缀">
          <div class="mp-pub-filter" id="mp-publish-filter" role="group" aria-label="发布状态筛选">
            <button type="button" class="mp-pub-btn is-on" data-v="">全部</button>
            <button type="button" class="mp-pub-btn" data-v="unused">未发布</button>
            <button type="button" class="mp-pub-btn" data-v="published">已发布</button>
          </div>
          <button type="button" class="ghost" id="mp-refresh">刷新</button>
          <button type="button" class="primary" id="mp-upload-btn">上传视频</button>
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
              <button type="button" class="ep-btn ep-btn-default" id="mp-cancel">取消</button>
              <button type="button" class="ep-btn ep-btn-primary" id="mp-ok">确定</button>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(mask);
    mask.addEventListener('click', (e) => {
      if (e.target === mask) app.closeMaterialPicker(false);
    });
    mask.querySelector('#mp-close').onclick = () => app.closeMaterialPicker(false);
    mask.querySelector('#mp-cancel').onclick = () => app.closeMaterialPicker(false);
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
    if (mask && (!mask.querySelector('#mp-up-frames') || !mask.querySelector('#mp-up-cover-file') || !mask.querySelector('#mp-up-locked'))) {
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
          <h3>上传视频素材</h3>
          <button type="button" class="mp-close" id="mp-up-close" aria-label="关闭" title="关闭">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
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
    mask.addEventListener('click', (e) => {
      if (e.target === mask) app.closeMaterialUploadDialog();
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
    if (mask) return mask;
    mask = document.createElement('div');
    mask.id = 'mp-dup-preview-mask';
    mask.className = 'mp-dup-preview-mask hidden';
    mask.innerHTML = `
      <div class="mp-dup-preview-card" role="dialog" aria-modal="true">
        <div class="mp-dup-preview-head">
          <h3 id="mp-dup-preview-title">素材预览</h3>
          <button type="button" class="mp-close" id="mp-dup-preview-close" aria-label="关闭" title="关闭">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="mp-dup-preview-body">
          <video id="mp-dup-preview-video" controls playsinline></video>
        </div>
        <div class="mp-dup-preview-foot">
          <button type="button" class="mp-btn-cancel" id="mp-dup-preview-ok">关闭</button>
        </div>
      </div>`;
    document.body.appendChild(mask);
    const close = () => app.closeMaterialDupPreview();
    mask.addEventListener('click', (e) => {
      if (e.target === mask) close();
    });
    mask.querySelector('#mp-dup-preview-close').onclick = close;
    mask.querySelector('#mp-dup-preview-ok').onclick = close;
    return mask;
  }

  Object.assign(window.AppPrototype || {}, {});

  const methods = {
    materialPickerFieldHtml(opts = {}) {
      const multiple = opts.multiple !== false;
      const max = Number(opts.max || 0) || 0;
      const fieldId = opts.fieldId || 'material-picker-field';
      const ids = (opts.selectedIds || []).map(Number).filter(Boolean);
      const items = (this.materials || []).filter((m) => ids.includes(Number(m.id)));
      const chips = items.length
        ? items
            .map(
              (m) =>
                `<span class="mp-chip" data-id="${m.id}">#${m.id} ${this.esc(m.name || m.fileName || m.file_name || '')}<button type="button" title="移除" onclick="app.removeMaterialPickerChip('${fieldId}',${m.id})">×</button></span>`
            )
            .join('')
        : '<span class="mp-empty">尚未选择视频素材</span>';
      return `<div class="mp-field" id="${fieldId}" data-multiple="${multiple ? 1 : 0}" data-max="${max}">
        <div class="mp-field-box" id="${fieldId}-chips">${chips}</div>
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
        box.innerHTML = ids.length
          ? items
              .map(
                (m) =>
                  `<span class="mp-chip" data-id="${m.id}">#${m.id} ${this.esc(m.name || m.fileName || m.file_name || '')}<button type="button" title="移除" onclick="app.removeMaterialPickerChip('${fieldId}',${m.id})">×</button></span>`
              )
              .join('')
          : '<span class="mp-empty">尚未选择视频素材</span>';
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
      const items = (this.materials || []).filter((m) => ids.includes(Number(m.id)));
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
      (this.materials || []).forEach((m) => {
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
      mask.classList.remove('hidden');
      this.setMaterialPickerLoading(true);
      this.reloadMaterialPickerList();
    },

    closeMaterialPicker() {
      this.closeMaterialUploadDialog?.();
      const mask = document.querySelector('#material-picker-mask');
      if (mask) mask.classList.add('hidden');
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
        // 合并到缓存，便于跨页回显已选
        const cache = new Map((this.materials || []).map((m) => [Number(m.id), m]));
        rawItems.forEach((m) => cache.set(Number(m.id), m));
        this.materials = [...cache.values()].sort((a, b) => Number(b.id) - Number(a.id));
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
      const apiBase = window.TKSWARM_API_BASE || window.__TKSWARM_CONFIG__?.defaultApiBase || '';
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
            const canPreview = (m.status || 'ready') === 'ready';
            const stream = this.materialStreamUrl
              ? this.materialStreamUrl(id)
              : `${apiBase}/api/materials/${id}/stream`;
            const cover = m.coverBase64 || m.cover_base64 || '';
            const thumb = cover
              ? `<img class="mp-vcard-cover" src="${cover}" alt="cover" loading="lazy">`
              : canPreview
                ? `<video src="${stream}" muted preload="metadata" onclick="event.stopPropagation()"></video>`
                : `<div class="mp-vcard-no">无预览</div>`;
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
                  <button type="button" class="tiny" onclick="app.previewMaterial(${id})">预览</button>
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

    confirmMaterialPicker() {
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
      const ordered = ids
        .map((id) => this._mp.selectedMap?.get(id) || (this.materials || []).find((m) => Number(m.id) === id) || { id })
        .filter(Boolean);
      const cb = this._mp.onConfirm;
      this.closeMaterialPicker();
      if (typeof cb === 'function') cb(ordered);
    },

    async renameMaterialPickerItem(id) {
      const row = (this.materials || []).find((m) => Number(m.id) === Number(id));
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
        title: options.title || (isEdit ? '编辑视频素材' : '上传视频素材'),
        onUploaded: typeof options.onUploaded === 'function' ? options.onUploaded : null,
        onSaved: typeof options.onSaved === 'function' ? options.onSaved : null,
      };
      const mask = document.querySelector('#mp-upload-mask');
      const titleEl = mask.querySelector('.mp-upload-head h3');
      if (titleEl) titleEl.textContent = this._mpUploadOpts.title;
      mask.classList.remove('hidden');
      document.querySelector('#mp-up-drop')?.classList.toggle('hidden', isEdit);
      document.querySelector('#mp-up-locked')?.classList.toggle('hidden', !isEdit);
      document.querySelector('#mp-up-status-wrap')?.toggleAttribute('hidden', !isEdit);
      document.querySelector('#mp-up-ok-label').textContent = isEdit ? '保存修改' : '开始上传';
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
        document.querySelector('#mp-up-frames-tip').textContent = '正在从视频解帧…';
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
      document.querySelector('#mp-upload-mask')?.classList.add('hidden');
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

    materialStreamUrl(id, streamUrl) {
      const apiBase = String(window.TKSWARM_API_BASE || window.__TKSWARM_CONFIG__?.defaultApiBase || '').replace(/\/+$/, '');
      let path = String(streamUrl || '').trim();
      if (!path) path = `/api/materials/${Number(id)}/stream`;
      if (/^https?:\/\//i.test(path)) {
        // already absolute
      } else if (path.startsWith('/')) {
        path = apiBase + path;
      } else {
        path = `${apiBase}/api/materials/${Number(id)}/stream`;
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
        return path + (qs ? (path.includes('?') ? '&' : '?') + qs : '');
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

    async loadMaterialPreviewVideo(video, id, streamUrl) {
      if (!video || !id) return;
      this.revokeMaterialPreviewBlob();
      try {
        video.pause();
      } catch (_) {}
      video.onerror = null;
      video.removeAttribute('src');
      video.load();
      const src = this.materialStreamUrl(id, streamUrl);
      video.src = src;
      video.onerror = () => {
        this.toast?.('视频预览加载失败：请确认素材文件存在且已登录', true);
      };
      try {
        await video.play?.();
      } catch (_) {}
    },

    openMaterialDupPreview(id, title, streamUrl) {
      const mid = Number(id);
      if (!mid) return;
      ensureDupPreviewDom();
      const mask = document.querySelector('#mp-dup-preview-mask');
      const video = document.querySelector('#mp-dup-preview-video');
      const titleEl = document.querySelector('#mp-dup-preview-title');
      if (titleEl) titleEl.textContent = title ? `预览 · ${title}` : `预览素材 #${mid}`;
      mask?.classList.remove('hidden');
      this.loadMaterialPreviewVideo(video, mid, streamUrl);
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
      mask?.classList.add('hidden');
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

    async extractVideoFramesList(source, count = 16) {
      return new Promise((resolve) => {
        if (!source) {
          resolve([]);
          return;
        }
        const isFile = typeof File !== 'undefined' && source instanceof File;
        const url = isFile ? URL.createObjectURL(source) : String(source);
        const sourceKey = isFile ? source : url;
        if (this._mpUpload) this._mpUpload.frameSource = sourceKey;
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.crossOrigin = 'anonymous';
        video.preload = 'auto';
        video.src = url;
        const frames = [];
        let finished = false;
        const done = (list) => {
          if (finished) return;
          finished = true;
          if (isFile) {
            try {
              URL.revokeObjectURL(url);
            } catch (_) {}
          }
          resolve(list || []);
        };
        const stillCurrent = () => this._mpUpload?.frameSource === sourceKey;
        const timer = setTimeout(() => done(frames), 45000);
        const captureAt = (t) =>
          new Promise((res) => {
            const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked);
              try {
                const w = video.videoWidth || 0;
                const h = video.videoHeight || 0;
                if (!w || !h) {
                  res(null);
                  return;
                }
                const maxW = 320;
                const scale = Math.min(1, maxW / w);
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(w * scale));
                canvas.height = Math.max(1, Math.round(h * scale));
                canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
                res({ time: t, dataUrl: canvas.toDataURL('image/jpeg', 0.78) });
              } catch (_) {
                res(null);
              }
            };
            video.addEventListener('seeked', onSeeked);
            try {
              video.currentTime = Math.max(0.05, t);
            } catch (_) {
              video.removeEventListener('seeked', onSeeked);
              res(null);
            }
          });
        video.addEventListener('error', () => {
          clearTimeout(timer);
          done([]);
        });
        video.addEventListener('loadedmetadata', async () => {
          try {
            const dur = Number(video.duration);
            const safeDur = Number.isFinite(dur) && dur > 0 ? dur : 1;
            const n = Math.max(8, Math.min(24, count));
            for (let i = 0; i < n; i++) {
              if (!stillCurrent()) break;
              const t = safeDur * ((i + 0.5) / n);
              const frame = await captureAt(Math.min(t, Math.max(0.05, safeDur - 0.05)));
              if (frame?.dataUrl) frames.push(frame);
              const tip = document.querySelector('#mp-up-frames-tip');
              if (tip) tip.textContent = `正在解帧 ${frames.length}/${n}…`;
            }
            clearTimeout(timer);
            done(frames);
          } catch (_) {
            clearTimeout(timer);
            done(frames);
          }
        });
      });
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
      document.querySelector('#mp-up-cover-tip').textContent = '正在逐帧解析封面…也可先手动上传封面图';
      document.querySelector('#mp-up-cover-wrap').innerHTML = '<div class="mp-upload-cover-ph">解帧中…</div>';
      document.querySelector('#mp-up-frames').innerHTML = '';
      document.querySelector('#mp-up-frames-tip').textContent = '正在解帧…';
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
        const mat = await this.uploadVideoWithProgress(fd, (pct) => {
          if (bar) bar.style.width = pct + '%';
        });
        if (mat?.id && cover && !(mat.coverBase64 || mat.cover_base64)) {
          try {
            await this.api(`/materials/${mat.id}/cover`, { method: 'PUT', body: JSON.stringify({ coverBase64: cover }) });
          } catch (_) {}
        }
        this.toast(`已上传：${mat?.name || name}`);
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

    async captureVideoCoverBase64(file, seekSec = 0.8) {
      return new Promise((resolve) => {
        if (!file) {
          resolve('');
          return;
        }
        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.src = url;
        let done = false;
        const finish = (val) => {
          if (done) return;
          done = true;
          try {
            URL.revokeObjectURL(url);
          } catch (_) {}
          resolve(val || '');
        };
        const timer = setTimeout(() => finish(''), 12000);
        video.addEventListener('error', () => {
          clearTimeout(timer);
          finish('');
        });
        video.addEventListener('loadeddata', () => {
          try {
            const dur = Number(video.duration);
            const t = Number.isFinite(dur) && dur > 0 ? Math.min(seekSec, Math.max(0.1, dur * 0.08)) : seekSec;
            video.currentTime = t;
          } catch (_) {
            clearTimeout(timer);
            finish('');
          }
        });
        video.addEventListener('seeked', () => {
          try {
            const w = video.videoWidth || 0;
            const h = video.videoHeight || 0;
            if (!w || !h) {
              clearTimeout(timer);
              finish('');
              return;
            }
            const maxW = 480;
            const scale = Math.min(1, maxW / w);
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(w * scale));
            canvas.height = Math.max(1, Math.round(h * scale));
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
            clearTimeout(timer);
            finish(dataUrl);
          } catch (_) {
            clearTimeout(timer);
            finish('');
          }
        });
      });
    },

    async uploadMaterialPickerFile(file, forceUpload) {
      const panel = document.querySelector('#mp-dup-panel');
      try {
        this.toast('正在截取封面…', 'info', 1200);
        const cover = await this.captureVideoCoverBase64(file);
        const fd = new FormData();
        fd.append('file', file);
        fd.append('name', file.name.replace(/\.[^/.]+$/, ''));
        fd.append('tags', 'material-picker');
        fd.append('reuseExisting', '0');
        if (forceUpload) fd.append('forceUpload', '1');
        if (cover) fd.append('coverBase64', cover);
        const mat = await this.uploadVideoWithProgress(fd, null);
        if (mat?.id && cover && !(mat.coverBase64 || mat.cover_base64)) {
          try {
            await this.api(`/materials/${mat.id}/cover`, { method: 'PUT', body: JSON.stringify({ coverBase64: cover }) });
          } catch (_) {}
        }
        if (panel) {
          panel.classList.add('hidden');
          panel.innerHTML = '';
        }
        this.toast(`已上传：${mat?.name || file.name}`);
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
