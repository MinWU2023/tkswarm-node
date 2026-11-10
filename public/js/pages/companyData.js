(function () {
  if (!window.app) throw new Error('app-core must load before pages/companyData.js');

  const __methods = {
    canCompanyDataView() {
      return this.canPermission('rbac.company_data.view')
        || this.canPermission('rbac.company_data')
        || this.canPermission('rbac.industry_data')
        || this.canPermission('rbac.manage')
        || this.canPermission('system.view');
    },
    canCompanyData() {
      return this.canCompanyDataView();
    },
    canCompanyDataManage() {
      return this.canCompanyDataCreate()
        || this.canCompanyDataUpdate()
        || this.canCompanyDataDelete();
    },
    canCompanyDataCreate() {
      return this.canPermission('rbac.company_data.create')
        || this.canPermission('rbac.company_data')
        || this.canPermission('rbac.manage');
    },
    canCompanyDataUpdate() {
      return this.canPermission('rbac.company_data.update')
        || this.canPermission('rbac.company_data')
        || this.canPermission('rbac.manage');
    },
    canCompanyDataDelete() {
      return this.canPermission('rbac.company_data.delete')
        || this.canPermission('rbac.company_data')
        || this.canPermission('rbac.manage');
    },
    async renderCompanyData() {
      const host = document.querySelector('#content');
      if (!host) return;
      if (!this.canCompanyData()) {
        host.innerHTML = `<div class="panel"><div class="empty">当前角色无权查看企业数据</div></div>`;
        return;
      }
      const companyQs = new URLSearchParams({
        page: String(this.companyDataPage || 1),
        pageSize: '10',
      });
      const ckw = (this.companyDataKeyword || '').trim();
      const cst = String(this.companyDataStatus || '');
      if (ckw) companyQs.set('keyword', ckw);
      if (cst !== '') companyQs.set('status', cst);
      try {
        const pack = await this.api('/companies?' + companyQs.toString());
        const rows = pack.items || [];
        const total = pack.total || rows.length;
        const canCreate = this.canCompanyDataCreate();
        const canUpdate = this.canCompanyDataUpdate();
        const canDelete = this.canCompanyDataDelete();
        const pagerHtml = UI.pager(
          { page: pack.page || 1, pages: pack.pages || 1, total, pageSize: pack.pageSize || 10 },
          'companyDataPage',
          { pageSize: 10 }
        );
        host.innerHTML = `<div class="ind-page">
          <div class="ind-hero panel">
            <div class="ind-hero__text">
              <h2 class="ind-hero__title">企业数据</h2>
              <p class="ind-hero__desc">管理企业信息，绑定行业分类；可在本页新建/编辑企业，或在「管理用户」创建时勾选「同时创建企业」并绑定主账号。</p>
            </div>
            <div class="ind-hero__stats">
              <div class="ind-stat"><b>${total}</b><span>企业总数</span></div>
            </div>
          </div>
          <div class="panel ind-panel">
            <div class="toolbar ind-toolbar">
              <div class="ind-filters">
                <input class="input" id="company-keyword" placeholder="搜索企业名称 / 联系人 / 电话 / 邮箱" value="${this.esc(ckw)}" onkeydown="if(event.key==='Enter')app.searchCompanyData()">
                <select class="input" id="company-status">
                  <option value="">全部状态</option>
                  <option value="1" ${cst === '1' ? 'selected' : ''}>正常</option>
                  <option value="0" ${cst === '0' ? 'selected' : ''}>停用</option>
                </select>
                <button class="primary" type="button" onclick="app.searchCompanyData()">查询</button>
                <button class="ghost" type="button" onclick="app.resetCompanyDataFilters()">重置</button>
              </div>
              <div class="ind-actions">
                ${canCreate ? `<button class="primary" type="button" onclick="app.openCompanyModal()">新建企业</button>` : ''}
                <span class="muted">共 ${total} 家企业</span>
                <button class="ghost" type="button" onclick="app.refresh()">刷新</button>
              </div>
            </div>
            <div class="table-container ind-table-wrap">
              ${rows.length ? `<table class="ind-table"><thead><tr>
                <th>ID</th><th>企业名称</th><th>所属行业</th><th>服务版本</th><th>服务期限</th><th>联系人</th><th>联系电话</th><th>主账号</th><th>状态</th><th>更新时间</th><th style="min-width:140px">操作</th>
              </tr></thead><tbody>${rows.map((c) => this.companyDataRowHtml(c, { canUpdate, canDelete })).join('')}</tbody></table>`
                : `<div class="empty ind-empty"><p>暂无企业数据</p><span class="muted">点击「新建企业」添加，或在管理用户创建时勾选「同时创建企业」</span></div>`}
            </div>
            ${pagerHtml}
          </div>
        </div>`;
      } catch (e) {
        host.innerHTML = `<div class="panel"><div class="empty">加载失败：${this.esc(e.message)}</div></div>`;
      }
    },
    companyServiceVersionLabel(code) {
      const map = { standard: '标准版', pro: '专业版', enterprise: '企业版' };
      return map[String(code || 'standard')] || '标准版';
    },
    companyDataRowHtml(c, perms = {}) {
      const canUpdate = !!perms.canUpdate;
      const canDelete = !!perms.canDelete;
      const primary = c.primaryUser;
      const primaryLabel = primary
        ? `${this.esc(primary.nickname || primary.username)} <span class="muted">@${this.esc(primary.username)}</span>`
        : '<span class="muted">-</span>';
      const ver = this.esc(c.serviceVersionLabel || this.companyServiceVersionLabel(c.serviceVersion));
      const start = String(c.authStart || '').slice(0, 10);
      const end = String(c.authEnd || '').slice(0, 10);
      const term = (start || end)
        ? `${this.esc(start || '—')} ~ ${this.esc(end || '—')}`
        : '<span class="muted">未设置</span>';
      return `<tr class="ind-row" data-company-id="${c.id}">
        <td><b>#${c.id}</b></td>
        <td><b>${this.esc(c.name)}</b>${Number(c.userCount || 0) > 1 ? `<div class="muted" style="font-size:12px">${Number(c.userCount)} 个绑定用户</div>` : ''}</td>
        <td>${c.industryPath ? `<span title="${this.esc(c.industryPath)}">${this.esc(c.industryPath)}</span>` : '<span class="muted">-</span>'}</td>
        <td>${ver}</td>
        <td style="white-space:nowrap;font-size:12px">${term}</td>
        <td>${this.esc(c.contactName || '-')}</td>
        <td>${this.esc(c.contactPhone || '-')}</td>
        <td>${primaryLabel}</td>
        <td>${Number(c.status) === 1 ? '<span class="badge success">正常</span>' : '<span class="badge muted">停用</span>'}</td>
        <td><span class="muted">${this.esc((c.updatedAt || c.createdAt || '').slice(0, 19))}</span></td>
        <td class="ind-ops">
          ${canUpdate || canDelete
            ? `${canUpdate ? `<button class="tiny" type="button" onclick="app.openCompanyModal(${Number(c.id)})">编辑</button>` : ''}${canDelete ? `<button class="tiny danger" type="button" onclick="app.deleteCompany(${Number(c.id)},'${this.esc(c.name)}')">删除</button>` : ''}`
            : '<span class="muted">只读</span>'}
        </td>
      </tr>`;
    },
    searchCompanyData() {
      this.companyDataKeyword = document.querySelector('#company-keyword')?.value?.trim() || '';
      this.companyDataStatus = document.querySelector('#company-status')?.value || '';
      this.companyDataPage = 1;
      this.refresh();
    },
    resetCompanyDataFilters() {
      this.companyDataKeyword = '';
      this.companyDataStatus = '';
      this.companyDataPage = 1;
      this.refresh();
    },
    async openCompanyModal(companyId) {
      const id = Number(companyId || 0);
      if (id ? !this.canCompanyDataUpdate() : !this.canCompanyDataCreate()) { this.toast(id ? '当前角色无权编辑企业数据' : '当前角色无权新建企业数据', true); return; }
      let c = { status: 1 };
      if (id > 0) {
        try {
          c = await this.api('/companies/' + id);
        } catch (e) {
          this.toast(e.message, true);
          return;
        }
      }
      const industryId = Number(c.industryId || 0);
      const cascadePrefix = 'company-form-industry';
      const primaryUsers = Array.isArray(c.users) ? c.users.filter((u) => u.isPrimary) : [];
      const primary = c.primaryUser || primaryUsers[0] || null;
      const curVersion = String(c.serviceVersion || 'standard');
      const authStart = String(c.authStart || '').slice(0, 10);
      const authEnd = String(c.authEnd || '').slice(0, 10);
      const versionOpts = [
        ['standard', '标准版'],
        ['pro', '专业版'],
        ['enterprise', '企业版'],
      ];
      this.modal(id ? ('编辑企业 #' + id) : '新建企业', `
        <div class="form-grid">
          <input type="hidden" name="id" value="${id || ''}">
          ${this.field('name', '企业名称', c.name || '', 'text', true)}
          <div class="field full"><label>所属行业 <span class="muted">四级联动，请选到最细分类</span></label>
            ${typeof this.industryCascadeHtml === 'function' ? this.industryCascadeHtml(cascadePrefix, industryId) : '<div class="muted">行业模块未加载</div>'}
          </div>
          ${this.field('contactName', '联系人', c.contactName || '', 'text')}
          ${this.field('contactPhone', '联系电话', c.contactPhone || '', 'text')}
          ${this.field('contactEmail', '联系邮箱', c.contactEmail || '', 'email')}
          ${this.selectRaw('status', '企业状态', [['1', '正常'], ['0', '停用']], String(c.status ?? 1))}
          ${this.selectRaw('serviceVersion', '服务版本', versionOpts, curVersion)}
          <div class="field"><label>服务开始日期</label><input class="input" type="date" name="authStart" value="${this.esc(authStart)}"></div>
          <div class="field"><label>服务结束日期</label><input class="input" type="date" name="authEnd" value="${this.esc(authEnd)}"></div>
          ${primary ? `<div class="field full"><label>主账号</label><div class="muted">${this.esc(primary.nickname || primary.username)} · @${this.esc(primary.username)}</div></div>` : ''}
          <div class="field full"><div class="muted">服务版本与期限会同步到该企业绑定客户的「视频交付」授权配置。</div></div>
          ${!id ? `<div class="field full"><div class="muted">保存后可在「管理用户」中创建账号并勾选「同时创建企业」，或后续将用户绑定到该企业。</div></div>` : ''}
        </div>
      `, async (d) => {
        const payload = {
          name: String(d.name || '').trim(),
          contactName: String(d.contactName || '').trim(),
          contactPhone: String(d.contactPhone || '').trim(),
          contactEmail: String(d.contactEmail || '').trim(),
          industryId: typeof this.getIndustryCascadeValue === 'function' ? this.getIndustryCascadeValue(cascadePrefix) : Number(d.industryId || 0),
          status: Number(d.status ?? 1),
          serviceVersion: String(d.serviceVersion || 'standard'),
          authStart: String(d.authStart || '').trim(),
          authEnd: String(d.authEnd || '').trim(),
        };
        if (!payload.name) { this.toast('请填写企业名称', true); return; }
        if (!payload.industryId) { this.toast('请选择行业分类', true); return; }
        if (payload.authStart && payload.authEnd && payload.authEnd < payload.authStart) {
          this.toast('服务结束日期不能早于开始日期', true);
          return;
        }
        if (id) {
          await this.api('/companies/' + id, { method: 'PUT', body: JSON.stringify(payload) });
          this.toast('企业信息已更新');
        } else {
          await this.api('/companies', { method: 'POST', body: JSON.stringify(payload) });
          this.toast('企业已创建');
        }
        this.closeModal();
        this.refresh();
      }, false, id ? {} : { submitText: '创建' });
      if (typeof this.bindIndustryCascade === 'function') {
        await this.bindIndustryCascade(cascadePrefix, industryId);
      }
    },
    editCompanyModal(company) {
      const id = typeof company === 'object' ? Number(company?.id || 0) : Number(company || 0);
      return this.openCompanyModal(id || undefined);
    },
    async deleteCompany(id, name) {
      if (!this.canCompanyDataDelete()) { this.toast('当前角色无权删除企业数据', true); return; }
      if (!(await this.ask(`确认删除企业「${name}」？若仍绑定管理用户将无法删除。`, 'danger'))) return;
      try {
        await this.api('/companies/' + id, { method: 'DELETE' });
        this.toast('企业已删除');
        this.refresh();
      } catch (e) {
        this.toast(e.message, true);
      }
    },
  };

  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages.companyData = true;
})();
