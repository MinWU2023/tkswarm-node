(function () {
  if (!window.app) throw new Error('app-core must load before pages/countryData.js');

  const __methods = {
    canCountryDataView() {
      return this.canPermission('rbac.country_data.view')
        || this.canPermission('rbac.country_data')
        || this.canPermission('rbac.manage')
        || this.canPermission('system.view');
    },
    canCountryData() {
      return this.canCountryDataView();
    },
    canCountryDataManage() {
      return this.canCountryDataCreate()
        || this.canCountryDataUpdate()
        || this.canCountryDataDelete();
    },
    canCountryDataCreate() {
      return this.canPermission('rbac.country_data.create')
        || this.canPermission('rbac.country_data')
        || this.canPermission('rbac.manage');
    },
    canCountryDataUpdate() {
      return this.canPermission('rbac.country_data.update')
        || this.canPermission('rbac.country_data')
        || this.canPermission('rbac.manage');
    },
    canCountryDataDelete() {
      return this.canPermission('rbac.country_data.delete')
        || this.canPermission('rbac.country_data')
        || this.canPermission('rbac.manage');
    },
    async renderCountryData() {
      if (this.countryDataPane === 'edit') return this.renderCountryDataEdit();
      return this.renderCountryDataList();
    },
    async renderCountryDataList() {
      const host = document.querySelector('#content');
      if (!host) return;
      if (!this.canCountryData()) {
        host.innerHTML = `<div class="panel"><div class="empty">当前角色无权管理国家数据</div></div>`;
        return;
      }
      const kw = this.countryDataKeyword || '';
      const enabled = this.countryDataEnabledFilter || '';
      const q = new URLSearchParams({
        page: String(this.countryDataPage || 1),
        pageSize: '20',
      });
      if (kw) q.set('keyword', kw);
      if (enabled !== '') q.set('enabled', enabled);
      try {
        const pack = await this.api('/country-data?' + q.toString());
        this._countryDataStats = pack.stats || {};
        const rows = pack.items || [];
        const stats = pack.stats || {};
        const pagerHtml = UI.pager(
          { page: pack.page, pages: pack.pages, total: pack.total, pageSize: pack.pageSize },
          'countryDataPage',
          { pageSize: 20 }
        );
        host.innerHTML = `<div class="ind-page">
          <div class="ind-hero panel">
            <div class="ind-hero__text">
              <h2 class="ind-hero__title">国家数据</h2>
              <p class="ind-hero__desc">ISO 3166-1 国家/地区列表，含中文名与英文名，首次访问自动导入约 250 条标准数据。</p>
            </div>
            <div class="ind-hero__stats">
              <div class="ind-stat"><b>${stats.total || 0}</b><span>总条目</span></div>
              <div class="ind-stat ind-stat--l1"><b>${stats.enabled || 0}</b><span>启用</span></div>
            </div>
          </div>
          <div class="panel ind-panel">
            <div class="toolbar ind-toolbar">
              <div class="ind-filters">
                <input class="input" id="country-keyword" placeholder="搜索代码 / 中文名 / 英文名" value="${this.esc(kw)}" onkeydown="if(event.key==='Enter')app.searchCountryData()">
                <select class="input" id="country-enabled">
                  <option value="">全部状态</option>
                  <option value="1" ${enabled === '1' ? 'selected' : ''}>启用</option>
                  <option value="0" ${enabled === '0' ? 'selected' : ''}>停用</option>
                </select>
                <button class="primary" type="button" onclick="app.searchCountryData()">查询</button>
                <button class="ghost" type="button" onclick="app.resetCountryDataFilters()">重置</button>
              </div>
              <div class="ind-actions">
                ${this.canCountryDataCreate() ? `<button class="primary" type="button" onclick="app.openCountryDataEdit()">添加国家</button>
                <button class="ghost" type="button" onclick="app.reseedCountryData()">重新导入种子</button>` : ''}
                <button class="ghost" type="button" onclick="app.refresh()">刷新</button>
              </div>
            </div>
            <div class="table-container ind-table-wrap">
              ${rows.length ? `<table class="ind-table"><thead><tr>
                <th>代码</th><th>中文名</th><th>英文名</th><th>大洲</th><th>排序</th><th>状态</th><th>更新时间</th><th style="min-width:140px">操作</th>
              </tr></thead><tbody>${rows.map((r) => this.countryDataRowHtml(r)).join('')}</tbody></table>`
                : `<div class="empty ind-empty"><p>暂无国家数据</p><span class="muted">首次访问会自动导入 ISO 国家种子数据</span></div>`}
            </div>
            ${pagerHtml}
          </div>
        </div>`;
      } catch (e) {
        host.innerHTML = `<div class="panel"><div class="empty">加载失败：${this.esc(e.message)}</div></div>`;
      }
    },
    countryDataRowHtml(r) {
      const canEdit = this.canCountryDataUpdate();
      const canDelete = this.canCountryDataDelete();
      return `<tr class="ind-row" data-id="${r.id}">
        <td><code class="ind-code">${this.esc(r.code || '-')}</code></td>
        <td><b>${this.esc(r.nameZh || '-')}</b></td>
        <td>${this.esc(r.nameEn || '-')}</td>
        <td>${this.esc(r.continent || '-')}</td>
        <td>${Number(r.sortOrder || 0)}</td>
        <td>${r.enabled ? '<span class="badge success">启用</span>' : '<span class="badge muted">停用</span>'}</td>
        <td><span class="muted">${this.esc((r.updatedAt || r.createdAt || '').slice(0, 19))}</span></td>
        <td class="ind-ops">
          ${canEdit || canDelete ? `${canEdit ? `<button class="tiny" type="button" onclick="app.openCountryDataEdit(${Number(r.id)})">编辑</button>` : ''}${canDelete ? `<button class="tiny danger" type="button" onclick="app.deleteCountryData(${Number(r.id)},'${this.esc(r.nameZh || r.code)}')">删除</button>` : ''}` : '<span class="muted">只读</span>'}
        </td>
      </tr>`;
    },
    searchCountryData() {
      this.countryDataKeyword = document.querySelector('#country-keyword')?.value || '';
      this.countryDataEnabledFilter = document.querySelector('#country-enabled')?.value || '';
      this.countryDataPage = 1;
      this.refresh();
    },
    resetCountryDataFilters() {
      this.countryDataKeyword = '';
      this.countryDataEnabledFilter = '';
      this.countryDataPage = 1;
      this.refresh();
    },
    openCountryDataEdit(id) {
      if (id ? !this.canCountryDataUpdate() : !this.canCountryDataCreate()) { this.toast(id ? '当前角色无权编辑国家数据' : '当前角色无权添加国家数据', true); return; }
      this.countryDataPane = 'edit';
      this.countryDataEditId = id ? Number(id) : null;
      this.refresh();
    },
    closeCountryDataEdit() {
      this.countryDataPane = 'list';
      this.countryDataEditId = null;
      this.refresh();
    },
    async renderCountryDataEdit() {
      const host = document.querySelector('#content');
      if (!host) return;
      if (!this.canCountryData()) {
        this.closeCountryDataEdit();
        return;
      }
      const editId = this.countryDataEditId ? Number(this.countryDataEditId) : 0;
      let draft = {
        code: '',
        nameZh: '',
        nameEn: '',
        continent: '',
        sortOrder: 0,
        enabled: true,
      };
      if (editId) {
        try {
          const d = await this.api('/country-data/' + editId);
          draft = {
            code: d.code || '',
            nameZh: d.nameZh || '',
            nameEn: d.nameEn || '',
            continent: d.continent || '',
            sortOrder: Number(d.sortOrder || 0),
            enabled: d.enabled !== false,
          };
        } catch (e) {
          this.toast(e.message, true);
          this.closeCountryDataEdit();
          return;
        }
      }
      host.innerHTML = `<div class="ind-edit-page">
        <div class="panel ind-edit-card">
          <div class="ind-edit-head">
            <div>
              <h2 class="ind-edit-title">${editId ? '编辑国家 #' + editId : '添加国家'}</h2>
              <p class="muted">国家代码为 ISO 3166-1 两位字母（如 CN、US）。</p>
            </div>
            <div class="ind-edit-head__actions">
              <button class="ghost" type="button" onclick="app.closeCountryDataEdit()">返回列表</button>
              <button class="primary" type="button" onclick="app.submitCountryDataForm()">保存</button>
            </div>
          </div>
          <form id="country-data-form" class="form-grid ind-edit-form" onsubmit="return false">
            <div class="field"><label>国家代码 <span class="req">*</span></label>
              <input class="input" name="code" value="${this.esc(draft.code)}" placeholder="如 CN" maxlength="2" ${editId ? 'readonly' : ''} required>
            </div>
            <div class="field"><label>中文名 <span class="req">*</span></label>
              <input class="input" name="nameZh" value="${this.esc(draft.nameZh)}" placeholder="如：中国" required>
            </div>
            <div class="field"><label>英文名 <span class="req">*</span></label>
              <input class="input" name="nameEn" value="${this.esc(draft.nameEn)}" placeholder="如：China" required>
            </div>
            <div class="field"><label>大洲/区域</label>
              <input class="input" name="continent" value="${this.esc(draft.continent)}" placeholder="可选，如：亚洲">
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
          </form>
        </div>
      </div>`;
    },
    async submitCountryDataForm() {
      const editIdGuard = this.countryDataEditId ? Number(this.countryDataEditId) : 0;
      if (editIdGuard ? !this.canCountryDataUpdate() : !this.canCountryDataCreate()) { this.toast(editIdGuard ? '当前角色无权编辑国家数据' : '当前角色无权添加国家数据', true); return; }
      const form = document.querySelector('#country-data-form');
      if (!form) return;
      const data = Object.fromEntries(new FormData(form));
      data.code = String(data.code || '').trim().toUpperCase();
      data.sortOrder = Number(data.sortOrder || 0);
      data.enabled = data.enabled === '1';
      if (!data.code || data.code.length !== 2) {
        this.toast('请填写两位国家代码', true);
        return;
      }
      if (!String(data.nameZh || '').trim() || !String(data.nameEn || '').trim()) {
        this.toast('请填写中文名和英文名', true);
        return;
      }
      const editId = this.countryDataEditId ? Number(this.countryDataEditId) : 0;
      try {
        if (editId) {
          await this.api('/country-data/' + editId, { method: 'PUT', body: JSON.stringify(data) });
          this.toast('已更新');
        } else {
          await this.api('/country-data', { method: 'POST', body: JSON.stringify(data) });
          this.toast('已添加');
        }
        this.closeCountryDataEdit();
      } catch (e) {
        this.toast(e.message, true);
      }
    },
    async deleteCountryData(id, name) {
      if (!this.canCountryDataDelete()) { this.toast('当前角色无权删除国家数据', true); return; }
      if (!(await this.ask(`确认删除「${name}」？`))) return;
      try {
        await this.api('/country-data/' + id, { method: 'DELETE' });
        this.toast('已删除');
        this.refresh();
      } catch (e) {
        this.toast(e.message, true);
      }
    },
    async ensureCountryOptions(force = false) {
      if (!force && this._countryOptionsCache?.length) return this._countryOptionsCache;
      try {
        const pack = await this.api('/country-data/options');
        this._countryOptionsCache = pack.items || [];
      } catch {
        this._countryOptionsCache = [];
      }
      return this._countryOptionsCache;
    },
    countryMatchValue(country, value) {
      const v = String(value || '').trim();
      if (!v) return false;
      const c = country || {};
      return v === c.code || v === c.nameZh || v === c.nameEn
        || v.toUpperCase() === String(c.code || '').toUpperCase();
    },
    countryCodeAliases() {
      return {
        US: ['USA', 'U.S.', 'U.S.A.', 'UNITED STATES', 'UNITED STATES OF AMERICA', 'AMERICA'],
        GB: ['UK', 'U.K.', 'UNITED KINGDOM', 'GREAT BRITAIN', 'ENGLAND'],
        AE: ['UAE', 'U.A.E.', 'UNITED ARAB EMIRATES'],
        KR: ['KOREA', 'SOUTH KOREA', 'REPUBLIC OF KOREA'],
        CN: ['CHINA', 'PRC', 'PEOPLE\'S REPUBLIC OF CHINA'],
        HK: ['HONG KONG', 'HONGKONG'],
        TW: ['TAIWAN'],
      };
    },
    resolveCountryIsoCode(value) {
      const v = String(value || '').trim();
      if (!v) return '';
      const cache = this._countryOptionsCache || [];
      const hit = cache.find((c) => this.countryMatchValue(c, v));
      if (hit) return String(hit.code || '').toUpperCase();
      const vu = v.toUpperCase();
      if (/^[A-Z]{2}$/.test(vu)) return vu;
      for (const [code, aliases] of Object.entries(this.countryCodeAliases())) {
        if (aliases.includes(vu)) return code;
      }
      const fuzzy = cache.find((c) => {
        const zh = String(c.nameZh || '').trim();
        const en = String(c.nameEn || '').toUpperCase();
        return (zh && (v === zh || zh.includes(v) || v.includes(zh)))
          || (en && (vu === en || en.includes(vu) || vu.includes(en)));
      });
      return fuzzy ? String(fuzzy.code || '').toUpperCase() : '';
    },
    countryProxyNames(code) {
      const iso = this.resolveCountryIsoCode(code) || String(code || '').trim();
      const c = (this._countryOptionsCache || []).find((row) => this.countryMatchValue(row, iso));
      if (!c) {
        const names = iso ? [iso] : [];
        const aliases = this.countryCodeAliases()[iso] || [];
        return [...names, ...aliases];
      }
      const base = [c.nameZh, c.nameEn, c.code].map((s) => String(s || '').trim()).filter(Boolean);
      const aliases = this.countryCodeAliases()[String(c.code || '').toUpperCase()] || [];
      return [...new Set([...base, ...aliases])];
    },
    proxyMatchesCountryCode(proxyCountry, countryCode) {
      const target = this.resolveCountryIsoCode(countryCode);
      if (!target) return true;
      const pc = String(proxyCountry || '').trim();
      if (!pc) return false;
      const proxyCode = this.resolveCountryIsoCode(pc);
      if (proxyCode && proxyCode === target) return true;
      const names = this.countryProxyNames(target);
      const pcU = pc.toUpperCase();
      return names.some((n) => n === pc || String(n).toUpperCase() === pcU);
    },
    filterProxiesByCountryCode(proxies, countryCode) {
      if (!countryCode) return proxies || [];
      return (proxies || []).filter((p) => this.proxyMatchesCountryCode(p.country, countryCode));
    },
    resolveAccountCountryCode(value) {
      const v = String(value || '').trim();
      if (!v) return '';
      const iso = this.resolveCountryIsoCode(v);
      return iso || v;
    },
    countryDisplayLabel(value, opts = {}) {
      const v = String(value || '').trim();
      if (!v) return '';
      const withCode = !!opts.withCode;
      const cache = this._countryOptionsCache || [];
      const pick = (c) => {
        const zh = String(c?.nameZh || '').trim();
        if (!withCode) return zh || String(c?.code || '').trim() || v;
        return zh ? `${zh} (${c.code})` : String(c?.code || v);
      };
      const hit = cache.find((c) => this.countryMatchValue(c, v));
      if (hit) return pick(hit);
      if (/[\u4e00-\u9fff]/.test(v)) return v;
      const iso = this.resolveCountryIsoCode(v);
      if (iso) {
        const hit2 = cache.find((c) => this.countryMatchValue(c, iso));
        if (hit2) return pick(hit2);
      }
      return v;
    },
    countrySelectHtml(name, selected, opts = {}) {
      const {
        id = name,
        blankLabel = '请选择国家',
        className = 'input',
        allowCustom = false,
      } = opts;
      const raw = String(selected || '').trim();
      // 已保存值可能是英文名/别名（United States、USA）→ 先归一到 ISO 码再匹配，
      // 否则下拉会匹配不到而回落到空白，看起来就像「没有回显」。
      const iso = raw && typeof this.resolveCountryIsoCode === 'function'
        ? this.resolveCountryIsoCode(raw)
        : '';
      const sel = iso || raw;
      const items = this._countryOptionsCache || [];
      const picked = (c) => this.countryMatchValue(c, sel)
        || (!!raw && sel !== raw && this.countryMatchValue(c, raw));
      const options = items.map((c) => {
        const on = picked(c);
        const label = this.countryDisplayLabel(c.code, { withCode: true });
        return `<option value="${this.esc(c.code)}" ${on ? 'selected' : ''}>${this.esc(label)}</option>`;
      }).join('');
      const matched = items.some(picked);
      // 历史值/自定义值不在国家数据里（或国家数据被停用删除）：保留原值选中，避免编辑时丢失回显
      const custom = raw && !matched
        ? `<option value="${this.esc(raw)}" selected>${this.esc(raw)}${allowCustom ? '（自定义）' : ''}</option>`
        : '';
      return `<select class="${className}" name="${this.esc(name)}" id="${this.esc(id)}">
        <option value="">${this.esc(blankLabel)}</option>
        ${custom}${options}
      </select>`;
    },
    countrySelectField(label, name, selected, opts = {}) {
      return `<div class="field"><label>${label}</label>${this.countrySelectHtml(name, selected, opts)}</div>`;
    },
    async reseedCountryData() {
      if (!this.canCountryDataCreate()) { this.toast('当前角色无权导入国家种子', true); return; }
      const hasData = Number(this._countryDataStats?.total || 0) > 0;
      if (hasData) {
        if (!(await this.ask('将清空现有国家数据并重新导入 ISO 种子，确认继续？'))) return;
      }
      try {
        const pack = await this.api('/country-data/seed', {
          method: 'POST',
          body: JSON.stringify({ force: hasData }),
        });
        this.toast(`已导入 ${pack.imported || 0} 条国家数据`);
        this.refresh();
      } catch (e) {
        this.toast(e.message, true);
      }
    },
  };

  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages.countryData = true;
})();
