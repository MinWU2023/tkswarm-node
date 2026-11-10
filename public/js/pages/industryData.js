(function () {
  if (!window.app) throw new Error('app-core must load before pages/industryData.js');

  const LEVEL_LABELS = { 1: '一级行业', 2: '二级行业', 3: '三级行业', 4: '四级细分' };

  const __methods = {
    canIndustryDataView() {
      return this.canPermission('rbac.industry_data.view')
        || this.canPermission('rbac.industry_data')
        || this.canPermission('rbac.manage')
        || this.canPermission('system.view');
    },
    canIndustryData() {
      return this.canIndustryDataView();
    },
    canIndustryDataManage() {
      return this.canIndustryDataCreate()
        || this.canIndustryDataUpdate()
        || this.canIndustryDataDelete();
    },
    canIndustryDataCreate() {
      return this.canPermission('rbac.industry_data.create')
        || this.canPermission('rbac.industry_data')
        || this.canPermission('rbac.manage');
    },
    canIndustryDataUpdate() {
      return this.canPermission('rbac.industry_data.update')
        || this.canPermission('rbac.industry_data')
        || this.canPermission('rbac.manage');
    },
    canIndustryDataDelete() {
      return this.canPermission('rbac.industry_data.delete')
        || this.canPermission('rbac.industry_data')
        || this.canPermission('rbac.manage');
    },
    industryLevelBadge(level) {
      const lv = Number(level) || 1;
      const tones = { 1: 'online', 2: 'success', 3: 'warn', 4: 'muted' };
      return `<span class="ind-level-badge badge ${tones[lv] || 'muted'}">${this.esc(LEVEL_LABELS[lv] || ('L' + lv))}</span>`;
    },
    async renderIndustryData() {
      if (this.industryDataPane === 'edit') return this.renderIndustryDataEdit();
      return this.renderIndustryDataList();
    },
    async renderIndustryDataList() {
      const host = document.querySelector('#content');
      if (!host) return;
      if (!this.canIndustryData()) {
        host.innerHTML = `<div class="panel"><div class="empty">当前角色无权管理行业数据</div></div>`;
        return;
      }
      const kw = this.industryDataKeyword || '';
      const level = this.industryDataLevel || '';
      const paginateL1 = !kw && !level;
      const q = new URLSearchParams({ tree: '1' });
      if (kw) q.set('keyword', kw);
      if (level) q.set('level', level);
      if (paginateL1) {
        q.set('paginateL1', '1');
        q.set('page', String(this.industryDataPage || 1));
        q.set('pageSize', '10');
      } else {
        q.set('paginateL1', '0');
      }
      try {
        const pack = await this.api('/industry-data?' + q.toString());
        this._industryDataFlat = pack.flat || pack.items || [];
        this._industryDataStats = pack.stats || {};
        const stats = pack.stats || {};
        const rows = this.buildIndustryDisplayRows(pack, kw, level);
        const pagerHtml = paginateL1 && pack.paginateBy === 'l1'
          ? UI.pager({ page: pack.page, pages: pack.pages, total: pack.total, pageSize: pack.pageSize }, 'industryDataPage', { pageSize: 10 })
          : '';
        host.innerHTML = `<div class="ind-page">
          <div class="ind-hero panel">
            <div class="ind-hero__text">
              <h2 class="ind-hero__title">行业数据</h2>
              <p class="ind-hero__desc">外贸行业四级分类树，最多支持四级：一级行业 → 二级 → 三级 → 四级细分。</p>
            </div>
            <div class="ind-hero__stats">
              <div class="ind-stat"><b>${stats.total || 0}</b><span>总条目</span></div>
              <div class="ind-stat ind-stat--l1"><b>${stats.l1 || 0}</b><span>一级</span></div>
              <div class="ind-stat ind-stat--l2"><b>${stats.l2 || 0}</b><span>二级</span></div>
              <div class="ind-stat ind-stat--l3"><b>${stats.l3 || 0}</b><span>三级</span></div>
              <div class="ind-stat ind-stat--l4"><b>${stats.l4 || 0}</b><span>四级</span></div>
            </div>
          </div>
          <div class="panel ind-panel">
            <div class="toolbar ind-toolbar">
              <div class="ind-filters">
                <input class="input" id="ind-keyword" placeholder="搜索名称 / 编码" value="${this.esc(kw)}" onkeydown="if(event.key==='Enter')app.searchIndustryData()">
                <select class="input" id="ind-level">
                  <option value="">全部层级</option>
                  ${[1, 2, 3, 4].map((l) => `<option value="${l}" ${String(level) === String(l) ? 'selected' : ''}>${LEVEL_LABELS[l]}</option>`).join('')}
                </select>
                <button class="primary" type="button" onclick="app.searchIndustryData()">查询</button>
                <button class="ghost" type="button" onclick="app.resetIndustryDataFilters()">重置</button>
              </div>
              <div class="ind-actions">
                ${this.canIndustryDataCreate()?`<button class="primary" type="button" onclick="app.openIndustryDataEdit()">添加分类</button>
                <button class="ghost" type="button" onclick="app.reseedIndustryData()">重新导入种子</button>`:''}
                <button class="ghost" type="button" onclick="app.refresh()">刷新</button>
              </div>
            </div>
            ${paginateL1 && pack.paginateBy === 'l1' ? `<div class="ind-list-hint muted">按一级行业分页，每页 ${pack.pageSize || 10} 个一级分类（含下级）</div>` : ''}
            <div class="table-container ind-table-wrap">
              ${rows.length ? `<table class="ind-table"><thead><tr>
                <th>名称</th><th>编码</th><th>层级</th><th>排序</th><th>状态</th><th>时间</th><th style="min-width:200px">操作</th>
              </tr></thead><tbody>${rows.map((r) => this.industryDataRowHtml(r)).join('')}</tbody></table>`
                : `<div class="empty ind-empty"><p>暂无行业数据</p><span class="muted">首次访问会自动导入外贸行业种子数据</span></div>`}
            </div>
            ${pagerHtml}
          </div>
        </div>`;
      } catch (e) {
        host.innerHTML = `<div class="panel"><div class="empty">加载失败：${this.esc(e.message)}</div></div>`;
      }
    },
    buildIndustryDisplayRows(pack, kw, level) {
      const tree = pack?.items || [];
      const flat = pack?.flat || tree;
      const hasNestedTree = tree.some((n) => Array.isArray(n.children) && n.children.length);
      if (hasNestedTree) return this.flattenIndustryTree(tree, kw, level);
      return flat.map((n) => ({
        ...n,
        _depth: Math.max(0, Number(n.level || 1) - 1),
        _path: '',
      }));
    },
    flattenIndustryTree(nodes, kw, levelFilter, depth = 0, path = '') {
      const out = [];
      const kwL = String(kw || '').trim().toLowerCase();
      const lvF = levelFilter ? Number(levelFilter) : 0;
      (nodes || []).forEach((n) => {
        const item = { ...n, _depth: depth, _path: path ? path + ' / ' + n.name : n.name };
        const matchKw = !kwL
          || String(n.name || '').toLowerCase().includes(kwL)
          || String(n.code || '').toLowerCase().includes(kwL);
        const matchLv = !lvF || Number(n.level) === lvF;
        if (matchKw && matchLv) out.push(item);
        if (n.children && n.children.length) {
          out.push(...this.flattenIndustryTree(n.children, kw, levelFilter, depth + 1, item._path));
        }
      });
      return out;
    },
    industryDataRowHtml(r) {
      const depth = Number(r._depth ?? Math.max(0, Number(r.level || 1) - 1));
      const pad = Math.min(3, depth);
      const indent = pad ? `<span class="ind-tree-indent" style="padding-left:${pad * 18}px"></span>` : '';
      const prefix = pad ? `<span class="ind-tree-branch">└</span>` : '';
      const canEdit = this.canIndustryDataUpdate();
      const canDelete = this.canIndustryDataDelete();
      const canAddChild = this.canIndustryDataCreate() && Number(r.level || 0) < 4;
      return `<tr class="ind-row" data-id="${r.id}">
        <td>${indent}${prefix}<b>${this.esc(r.name)}</b>${r._path && pad ? `<div class="muted ind-path">${this.esc(r._path)}</div>` : ''}</td>
        <td><code class="ind-code">${this.esc(r.code || '-')}</code></td>
        <td>${this.industryLevelBadge(r.level)}</td>
        <td>${Number(r.sortOrder || 0)}</td>
        <td>${r.enabled ? '<span class="badge success">启用</span>' : '<span class="badge muted">停用</span>'}</td>
        <td><span class="muted">${this.esc((r.updatedAt || r.createdAt || '').slice(0, 19))}</span></td>
        <td class="ind-ops">
          ${canAddChild ? `<button class="tiny ghost" type="button" onclick="app.openIndustryDataEdit(null,${Number(r.id)})">加子级</button>` : ''}
          ${canEdit || canDelete ? `${canEdit ? `<button class="tiny" type="button" onclick="app.openIndustryDataEdit(${Number(r.id)})">编辑</button>` : ''}${canDelete ? `<button class="tiny danger" type="button" onclick="app.deleteIndustryData(${Number(r.id)},'${this.esc(r.name)}')">删除</button>` : ''}` : '<span class="muted">只读</span>'}
        </td>
      </tr>`;
    },
    searchIndustryData() {
      this.industryDataKeyword = document.querySelector('#ind-keyword')?.value || '';
      this.industryDataLevel = document.querySelector('#ind-level')?.value || '';
      this.industryDataPage = 1;
      this.refresh();
    },
    resetIndustryDataFilters() {
      this.industryDataKeyword = '';
      this.industryDataLevel = '';
      this.industryDataPage = 1;
      this.refresh();
    },
    openIndustryDataEdit(id, parentId) {
      if (id ? !this.canIndustryDataUpdate() : !this.canIndustryDataCreate()) { this.toast(id ? '当前角色无权编辑行业数据' : '当前角色无权添加行业数据', true); return; }
      this.industryDataPane = 'edit';
      this.industryDataEditId = id ? Number(id) : null;
      this.industryDataParentId = parentId ? Number(parentId) : null;
      this.refresh();
    },
    closeIndustryDataEdit() {
      this.industryDataPane = 'list';
      this.industryDataEditId = null;
      this.industryDataParentId = null;
      this.refresh();
    },
    async renderIndustryDataEdit() {
      const host = document.querySelector('#content');
      if (!host) return;
      if (!this.canIndustryData()) {
        this.closeIndustryDataEdit();
        return;
      }
      const editId = this.industryDataEditId ? Number(this.industryDataEditId) : 0;
      const presetParent = this.industryDataParentId ? Number(this.industryDataParentId) : 0;
      let draft = {
        parentId: presetParent,
        name: '',
        code: '',
        description: '',
        sortOrder: 0,
        enabled: true,
      };
      if (editId) {
        try {
          const d = await this.api('/industry-data/' + editId);
          draft = {
            parentId: Number(d.parentId || 0),
            name: d.name || '',
            code: d.code || '',
            description: d.description || '',
            sortOrder: Number(d.sortOrder || 0),
            enabled: d.enabled !== false,
          };
          this._industryDataEditPath = d.path || [];
        } catch (e) {
          this.toast(e.message, true);
          this.closeIndustryDataEdit();
          return;
        }
      } else {
        this._industryDataEditPath = [];
      }
      let parents = [];
      try {
        parents = await this.api('/industry-data/parents');
      } catch (e) {
        parents = (this._industryDataFlat || []).filter((x) => Number(x.level) < 4);
      }
      if (editId) {
        if (!this._industryDataFlat?.length) {
          try {
            const pack = await this.api('/industry-data?tree=1&paginateL1=0');
            this._industryDataFlat = pack.flat || pack.items || [];
          } catch (_) { /* ignore */ }
        }
        const blockIds = new Set([editId]);
        const flat = this._industryDataFlat || [];
        let changed = true;
        while (changed) {
          changed = false;
          flat.forEach((n) => {
            const id = Number(n.id);
            const pid = Number(n.parentId);
            if (blockIds.has(pid) && !blockIds.has(id)) {
              blockIds.add(id);
              changed = true;
            }
          });
        }
        parents = parents.filter((p) => !blockIds.has(Number(p.id)));
      }
      const parentOpts = `<option value="0">无（作为一级行业）</option>`
        + parents.map((p) => {
          const prefix = '　'.repeat(Math.max(0, Number(p.level) - 1));
          return `<option value="${p.id}" ${Number(draft.parentId) === Number(p.id) ? 'selected' : ''}>${prefix}${this.esc(p.name)} (${LEVEL_LABELS[p.level] || 'L' + p.level})</option>`;
        }).join('');
      const pathHtml = (this._industryDataEditPath || []).length
        ? `<div class="ind-edit-path">${(this._industryDataEditPath || []).map((p) => this.esc(p.name)).join(' <span class="muted">›</span> ')}</div>`
        : '';
      host.innerHTML = `<div class="ind-edit-page">
        <div class="panel ind-edit-card">
          <div class="ind-edit-head">
            <div>
              <h2 class="ind-edit-title">${editId ? '编辑行业分类 #' + editId : '添加行业分类'}</h2>
              <p class="muted">最多四级；选择上级后自动计算层级。</p>
              ${pathHtml}
            </div>
            <div class="ind-edit-head__actions">
              <button class="ghost" type="button" onclick="app.closeIndustryDataEdit()">返回列表</button>
              <button class="primary" type="button" onclick="app.submitIndustryDataForm()">保存</button>
            </div>
          </div>
          <form id="industry-data-form" class="form-grid ind-edit-form" onsubmit="return false">
            <div class="field full"><label>上级分类</label>
              <select class="input" name="parentId" id="ind-parent">${parentOpts}</select>
            </div>
            <div class="field"><label>名称 <span class="req">*</span></label>
              <input class="input" name="name" value="${this.esc(draft.name)}" placeholder="如：离心泵、LED灯泡" required>
            </div>
            <div class="field"><label>编码</label>
              <input class="input" name="code" value="${this.esc(draft.code)}" placeholder="留空自动生成英文 slug">
            </div>
            <div class="field"><label>排序</label>
              <input class="input" name="sortOrder" type="number" value="${Number(draft.sortOrder) || 0}">
            </div>
            <div class="field"><label>状态</label>
              <select class="input" name="enabled">
                <option value="1" ${draft.enabled ? 'selected' : ''}>启用</option>
                <option value="0" ${!draft.enabled ? 'selected' : ''}>停用</option>
              </select>
            </div>
            <div class="field full"><label>说明</label>
              <textarea class="input" name="description" rows="3" placeholder="可选备注">${this.esc(draft.description)}</textarea>
            </div>
          </form>
        </div>
      </div>`;
    },
    async submitIndustryDataForm() {
      const editIdGuard = this.industryDataEditId ? Number(this.industryDataEditId) : 0;
      if (editIdGuard ? !this.canIndustryDataUpdate() : !this.canIndustryDataCreate()) { this.toast(editIdGuard ? '当前角色无权编辑行业数据' : '当前角色无权添加行业数据', true); return; }
      const form = document.querySelector('#industry-data-form');
      if (!form) return;
      const data = Object.fromEntries(new FormData(form));
      data.parentId = Number(data.parentId || 0);
      data.sortOrder = Number(data.sortOrder || 0);
      data.enabled = data.enabled === '1';
      if (!String(data.name || '').trim()) {
        this.toast('请填写名称', true);
        return;
      }
      const editId = this.industryDataEditId ? Number(this.industryDataEditId) : 0;
      try {
        if (editId) {
          await this.api('/industry-data/' + editId, { method: 'PUT', body: JSON.stringify(data) });
          this.toast('已更新');
        } else {
          await this.api('/industry-data', { method: 'POST', body: JSON.stringify(data) });
          this.toast('已添加');
        }
        this.closeIndustryDataEdit();
      } catch (e) {
        this.toast(e.message, true);
      }
    },
    async deleteIndustryData(id, name) {
      if (!this.canIndustryDataDelete()) { this.toast('当前角色无权删除行业数据', true); return; }
      if (!(await this.ask(`确认删除「${name}」？若有下级分类需先删除子级。`))) return;
      try {
        await this.api('/industry-data/' + id, { method: 'DELETE' });
        this.toast('已删除');
        this.refresh();
      } catch (e) {
        this.toast(e.message, true);
      }
    },
    async ensureIndustryFlat() {
      if (this._industryFlatCache?.length) return this._industryFlatCache;
      try {
        const pack = await this.api('/industry-data?tree=1&paginateL1=0');
        this._industryFlatCache = pack.flat || pack.items || [];
      } catch (_) {
        this._industryFlatCache = [];
      }
      return this._industryFlatCache;
    },
    industryChildren(parentId, level) {
      const pid = Number(parentId || 0);
      const lv = Number(level || 1);
      return (this._industryFlatCache || []).filter(
        (x) => Number(x.parentId) === pid && Number(x.level) === lv && x.enabled !== false
      );
    },
    industryCascadeHtml(prefix, selectedId) {
      const p = prefix || 'ind-cascade';
      return `<div class="ind-cascade" id="${p}" data-selected="${Number(selectedId) || 0}">
        <select class="input ind-cascade__sel" data-level="1" id="${p}-l1"><option value="">一级行业</option></select>
        <select class="input ind-cascade__sel" data-level="2" id="${p}-l2" disabled><option value="">二级行业</option></select>
        <select class="input ind-cascade__sel" data-level="3" id="${p}-l3" disabled><option value="">三级行业</option></select>
        <select class="input ind-cascade__sel" data-level="4" id="${p}-l4" disabled><option value="">四级细分</option></select>
        <input type="hidden" name="industryId" id="${p}-value" value="${Number(selectedId) || 0}">
      </div>`;
    },
    async bindIndustryCascade(prefix, selectedId) {
      const p = prefix || 'ind-cascade';
      await this.ensureIndustryFlat();
      const root = document.querySelector('#' + p);
      if (!root) return;
      const path = [];
      if (selectedId) {
        let cur = Number(selectedId);
        let guard = 0;
        while (cur > 0 && guard < 8) {
          guard++;
          const node = (this._industryFlatCache || []).find((x) => Number(x.id) === cur);
          if (!node) break;
          path.unshift(node);
          cur = Number(node.parentId || 0);
        }
      }
      const fill = (level, parentId, sel) => {
        const el = document.querySelector('#' + p + '-l' + level);
        if (!el) return;
        const items = this.industryChildren(parentId, level);
        el.innerHTML = `<option value="">${level === 1 ? '一级行业' : level === 2 ? '二级行业' : level === 3 ? '三级行业' : '四级细分'}</option>`
          + items.map((n) => `<option value="${n.id}" ${Number(sel) === Number(n.id) ? 'selected' : ''}>${this.esc(n.name)}</option>`).join('');
        el.disabled = level === 1 ? false : !parentId;
      };
      fill(1, 0, path[0]?.id || 0);
      fill(2, path[0]?.id || 0, path[1]?.id || 0);
      fill(3, path[1]?.id || 0, path[2]?.id || 0);
      fill(4, path[2]?.id || 0, path[3]?.id || 0);
      const syncValue = () => {
        let val = 0;
        [4, 3, 2, 1].some((lv) => {
          const v = Number(document.querySelector('#' + p + '-l' + lv)?.value || 0);
          if (v) { val = v; return true; }
          return false;
        });
        const hidden = document.querySelector('#' + p + '-value');
        if (hidden) hidden.value = String(val || 0);
        root.dataset.selected = String(val || 0);
        if (val > 0) delete root.dataset.cleared;
      };
      syncValue();
      root.querySelectorAll('.ind-cascade__sel').forEach((sel) => {
        sel.onchange = () => {
          const lv = Number(sel.dataset.level || 1);
          const pid = Number(sel.value || 0);
          for (let i = lv + 1; i <= 4; i++) {
            fill(i, i === lv + 1 ? pid : 0, 0);
          }
          syncValue();
        };
      });
    },
    getIndustryCascadeValue(prefix) {
      const p = prefix || 'ind-cascade';
      return Number(document.querySelector('#' + p + '-value')?.value || document.querySelector('#' + p)?.dataset?.selected || 0);
    },
    clearIndustryCascade(prefix) {
      const p = prefix || 'ind-cascade';
      const root = document.querySelector('#' + p);
      [1, 2, 3, 4].forEach((lv) => {
        const el = document.querySelector('#' + p + '-l' + lv);
        if (!el) return;
        el.value = '';
        el.disabled = lv > 1;
        el.innerHTML = `<option value="">${lv === 1 ? '一级行业' : lv === 2 ? '二级行业' : lv === 3 ? '三级行业' : '四级细分'}</option>`;
      });
      const hidden = document.querySelector('#' + p + '-value');
      if (hidden) hidden.value = '0';
      if (root) {
        root.dataset.selected = '0';
        root.dataset.cleared = '1';
      }
    },
    industryFilterOptionsHtml(options, selectedId, id) {
      const sel = Number(selectedId || 0);
      const opts = (options || []).map((x) =>
        `<option value="${x.id}" ${sel === Number(x.id) ? 'selected' : ''}>${this.esc(x.label || x.name || '')}</option>`
      ).join('');
      return `<select class="input" id="${id || 'ind-filter'}"><option value="">全部行业</option>${opts}</select>`;
    },
    industryTagHtml(label) {
      if (!label) return '<span class="muted">-</span>';
      return `<span class="ind-tag" title="${this.esc(label)}">${this.esc(label.split(' / ').pop() || label)}</span>`;
    },
    async reseedIndustryData() {
      if (!this.canIndustryDataCreate()) { this.toast('当前角色无权导入行业种子', true); return; }
      const hasData = Number(this._industryDataStats?.total || 0) > 0;
      if (hasData) {
        if (!(await this.ask('将清空现有行业数据并重新导入外贸种子，确认继续？'))) return;
      }
      try {
        const pack = await this.api('/industry-data/seed', {
          method: 'POST',
          body: JSON.stringify({ force: hasData }),
        });
        this.toast(`已导入 ${pack.imported || 0} 条行业数据`);
        this.refresh();
      } catch (e) {
        this.toast(e.message, true);
      }
    },
  };

  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages.industryData = true;
})();
