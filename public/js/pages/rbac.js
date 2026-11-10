(function () {
  if (!window.app) throw new Error('app-core must load before pages/rbac.js');
  const __methods = {
    canRbacManage(){return this.canPermission('rbac.manage')},
    canRbacUsersView(){return this.canPermission('rbac.users.view')},
    canRbacUsersCreate(){return this.canPermission('rbac.users.create')},
    canRbacUsersUpdate(){return this.canPermission('rbac.users.update')},
    canRbacUsersDelete(){return this.canPermission('rbac.users.delete')},
    canRbacUsersBrowserQuota(){
      return this.canPermission('rbac.users.browser_quota')
        && !!(this.authIsSuper || this.authLoginUser?.isSuper || this.authUser?.isSuper);
    },
    canRbacRolesView(){return this.canPermission('rbac.roles.view')},
    canRbacRolesCreate(){return this.canPermission('rbac.roles.create')},
    canRbacRolesUpdate(){return this.canPermission('rbac.roles.update')},
    canRbacRolesDelete(){return this.canPermission('rbac.roles.delete')},
    canRbacPermissionsView(){return this.canPermission('rbac.permissions.view')||this.canRbacManage()},
    canRbacPermissionsCreate(){return this.canPermission('rbac.permissions.create')},
    canRbacPermissionsUpdate(){return this.canPermission('rbac.permissions.update')},
    canRbacPermissionsDelete(){return this.canPermission('rbac.permissions.delete')},
    canRbacMenusView(){return this.canPermission('rbac.menus.view')},
    canRbacMenusUpdate(){return this.canPermission('rbac.menus.update')},
    canRbacLog(){return this.canPermission('rbac.logs.view')||this.canPermission('rbac.log')||this.canPermission('rbac.manage')},
    canRbacLogsClear(){return this.canPermission('rbac.logs.clear')},
    async renderRbac(){
      document.querySelector('#content').classList.remove('chat-mode');
      const sub = this.subview || 'permissions';
      const note = `<div class="rbac-tip" role="note"><b>权限说明：</b>开启鉴权后，菜单按角色裁剪；页面、按钮与 API 均按权限码校验。角色编辑支持「模块 → 子分组 → 单节点」三级勾选；菜单可见性请单独勾选 menu.* 节点。</div>`;
      if (sub === 'logs' && !this.canRbacLog()) {
        document.querySelector('#content').innerHTML = `<div class="panel"><div class="empty">当前角色无权查看审计日志（需 rbac.logs.view、rbac.log 或 rbac.manage）</div></div>`;
        return;
      }
      if (sub === 'permissions') {
        if (!this.canRbacPermissionsView()) {
          document.querySelector('#content').innerHTML = `<div class="panel"><div class="empty">当前角色无权查看权限节点（需 rbac.permissions.view 或 rbac.manage）</div></div>`;
          return;
        }
        await this.renderRbacPermissions(); document.querySelector('#content')?.insertAdjacentHTML('afterbegin', note);
      }
      else if (sub === 'roles') {
        if (!this.canRbacRolesView()) {
          document.querySelector('#content').innerHTML = `<div class="panel"><div class="empty">当前角色无权查看系统角色（需 rbac.roles.view 或 rbac.manage）</div></div>`;
          return;
        }
        await this.renderRbacRoles(); document.querySelector('#content')?.insertAdjacentHTML('afterbegin', note);
      }
      else if (sub === 'users') {
        if (!this.canRbacUsersView()) {
          document.querySelector('#content').innerHTML = `<div class="panel"><div class="empty">当前角色无权查看管理员用户（需 rbac.users.view 或 rbac.manage）</div></div>`;
          return;
        }
        await this.renderRbacUsers(); document.querySelector('#content')?.insertAdjacentHTML('afterbegin', note);
      }
      else if (sub === 'logs') { await this.renderRbacLogs(); document.querySelector('#content')?.insertAdjacentHTML('afterbegin', note); }
      else if (sub === 'menus') {
        if (!this.canRbacMenusView()) {
          document.querySelector('#content').innerHTML = `<div class="panel"><div class="empty">当前角色无权查看菜单配置（需 rbac.menus.view 或 rbac.manage）</div></div>`;
          return;
        }
        await this.renderRbacMenus(); document.querySelector('#content')?.insertAdjacentHTML('afterbegin', note);
      }
      else if (sub === 'country_data') {
        if (!this.canPermission('rbac.country_data.view') && !this.canPermission('rbac.country_data') && !this.canRbacManage()) {
          document.querySelector('#content').innerHTML = `<div class="panel"><div class="empty">当前角色无权管理国家数据（需 rbac.country_data.view、rbac.country_data 或 rbac.manage）</div></div>`;
          return;
        }
        if (typeof this.renderCountryData === 'function') await this.renderCountryData();
        else throw new Error('国家数据模块未加载');
      }
      else if (sub === 'industry_data') {
        if (!this.canPermission('rbac.industry_data.view') && !this.canPermission('rbac.industry_data') && !this.canRbacManage()) {
          document.querySelector('#content').innerHTML = `<div class="panel"><div class="empty">当前角色无权管理行业数据（需 rbac.industry_data.view、rbac.industry_data 或 rbac.manage）</div></div>`;
          return;
        }
        if (typeof this.renderIndustryData === 'function') await this.renderIndustryData();
        else throw new Error('行业数据模块未加载');
      }
      else if (sub === 'company_data') {
        if (!this.canPermission('rbac.company_data.view') && !this.canPermission('rbac.company_data') && !this.canPermission('rbac.industry_data') && !this.canRbacManage()) {
          document.querySelector('#content').innerHTML = `<div class="panel"><div class="empty">当前角色无权管理企业数据（需 rbac.company_data.view、rbac.company_data、rbac.industry_data 或 rbac.manage）</div></div>`;
          return;
        }
        if (typeof this.renderCompanyData === 'function') await this.renderCompanyData();
        else throw new Error('企业数据模块未加载');
      }
      else if (sub === 'settings') await this.renderSettings();
    },
    async renderRbacPermissions(){
      const host = document.querySelector('#content');
      if (!host) return;
      try {
        const allRows = await this.api('/permissions');
        const curMod = this.rbacPermModuleFilter || 'all';
        const kw = (this.rbacPermKeyword || '').trim().toLowerCase();
  
        const modPairs=this.permModulePairs();
        const modules = ['all', ...modPairs.map(x=>x[0])];
        const modLabels = Object.fromEntries([['all','全部模块'], ...modPairs]);
  
        const rows = allRows.filter(r => {
          const mod = this.permNormModule(r.module);
          if (curMod !== 'all' && mod !== curMod) return false;
          if (kw && !String(r.name).toLowerCase().includes(kw) && !String(r.code).toLowerCase().includes(kw)) return false;
          return true;
        });
        const pack = UI.paginateLocal(rows, this.rbacPermPage || 1, 20);
        this.rbacPermPage = pack.page;
  
        host.innerHTML = `
          <div class="panel list-panel">
            <div class="matrix-action-bar">
              <div class="left"><span class="muted">共 ${rows.length} / ${allRows.length} 个鉴权节点</span></div>
              <div class="right">
                ${this.canRbacPermissionsCreate()?`<button class="primary tiny" type="button" onclick="app.editPermissionModal()">添加权限节点</button>`:''}
              </div>
            </div>
            <div class="search-bar task-filter-bar rbac-perm-filter-bar">
              <select id="rbac-perm-module" class="input" title="业务模块" onchange="app.filterRbacPermModule(this.value)">
                ${modules.map(m => {
                  const cnt = m === 'all' ? allRows.length : allRows.filter(x => this.permNormModule(x.module) === m).length;
                  return `<option value="${this.esc(m)}" ${curMod===m?'selected':''}>${this.esc(modLabels[m]||m)} (${cnt})</option>`;
                }).join('')}
              </select>
              <input id="rbac-perm-search" class="input" type="search" placeholder="搜索节点名称或 Code" value="${this.esc(this.rbacPermKeyword||'')}" onkeydown="if(event.key==='Enter')app.searchRbacPermissions()">
              <button class="primary" type="button" onclick="app.searchRbacPermissions()">查询</button>
              <button class="ghost" type="button" onclick="app.resetRbacPermissions()">重置</button>
            </div>
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>所属模块</th>
                    <th>子分组</th>
                    <th>权限标识符 (Code)</th>
                    <th>权限节点名称</th>
                    <th>排序权重</th>
                    <th>当前状态</th>
                    <th>创建时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${pack.items.length ? pack.items.map(r => `
                    <tr>
                      <td><b>#${r.id}</b></td>
                      <td><span class="badge ${r.module==='account'?'online':r.module==='proxy'?'checking':r.module==='rbac'?'running':'pending'}">${this.esc(this.permModuleLabel(r.module))}</span></td>
                      <td class="muted">${this.esc(this.permSubgroupLabel(this.permSubgroupKey(r.code)))}</td>
                      <td><code>${this.esc(r.code)}</code></td>
                      <td><b>${this.esc(r.name)}</b></td>
                      <td>${r.sort_order}</td>
                      <td><span class="badge online">生效中</span></td>
                      <td class="muted">${this.esc((r.created_at || '-').slice(0, 19))}</td>
                      <td>
                        ${this.canRbacPermissionsUpdate()||this.canRbacPermissionsDelete()?`${this.canRbacPermissionsUpdate()?`<button class="tiny" onclick='app.editPermissionModal(${JSON.stringify(r)})'>编辑</button>`:''}${this.canRbacPermissionsDelete()?`<button class="tiny danger" onclick="app.deletePermission(${r.id},'${this.esc(r.name)}')">删除</button>`:''}`:'<span class="muted">只读</span>'}
                      </td>
                    </tr>
                  `).join('') : '<tr><td colspan="9" class="empty" style="text-align:center;padding:36px">未找到匹配的权限节点</td></tr>'}
                </tbody>
              </table>
            </div>
            ${UI.pager(pack,'rbacPermPage')}
          </div>
        `;
      } catch(err) {
        host.innerHTML = `<div class="panel list-panel"><div class="empty">加载权限节点失败: ${this.esc(err.message)}</div></div>`;
      }
    },
    filterRbacPermModule(mod){
      this.rbacPermModuleFilter = mod;
      this.rbacPermPage = 1;
      this.refresh();
    },
    searchRbacPermissions(){
      this.rbacPermModuleFilter = document.querySelector('#rbac-perm-module')?.value || 'all';
      this.rbacPermKeyword = document.querySelector('#rbac-perm-search')?.value?.trim() || '';
      this.rbacPermPage = 1;
      this.refresh();
    },
    resetRbacPermissions(){
      this.rbacPermModuleFilter = 'all';
      this.rbacPermKeyword = '';
      this.rbacPermPage = 1;
      this.refresh();
    },
    editPermissionModal(perm = {}){
      if (perm.id ? !this.canRbacPermissionsUpdate() : !this.canRbacPermissionsCreate()) {
        this.toast(perm.id ? '当前角色无权编辑权限节点（需 rbac.permissions.update 或 rbac.manage）' : '当前角色无权添加权限节点（需 rbac.permissions.create 或 rbac.manage）', true);
        return;
      }
      const modules = this.permModulePairs().map(([c,l])=>[c,`${l} (${c})`]);
      this.modal(perm.id ? '编辑权限节点' : '添加权限节点', `
        <div class="form-grid">
          <input type="hidden" name="id" value="${perm.id || ''}">
          ${this.selectRaw('module', '所属业务模块', modules, perm.module || 'account')}
          ${this.field('code', '权限标识符 (Code)', perm.code || '', 'text', true)}
          ${this.field('name', '节点中文名称', perm.name || '', 'text', true)}
          ${this.field('sort_order', '排序权重 (数字越大越靠前)', perm.sort_order || 0, 'number')}
        </div>
      `, async (d) => {
        if (perm.id ? !this.canRbacPermissionsUpdate() : !this.canRbacPermissionsCreate()) {
          this.toast(perm.id ? '当前角色无权编辑权限节点（需 rbac.permissions.update 或 rbac.manage）' : '当前角色无权添加权限节点（需 rbac.permissions.create 或 rbac.manage）', true);
          return;
        }
        await this.api('/permissions', { method: 'POST', body: JSON.stringify(d) });
        this.toast('权限节点已保存');
        this.closeModal();
        this.refresh();
      });
    },
    async deletePermission(id, name){
      if (!this.canRbacPermissionsDelete()) { this.toast('当前角色无权删除权限节点（需 rbac.permissions.delete 或 rbac.manage）', true); return; }
      const ok = await this.ask(`确定要删除权限节点【${name}】吗？`, 'danger');
      if (!ok) return;
      await this.api('/permissions/delete', { method: 'POST', body: JSON.stringify({ id }) });
      this.toast('权限节点已删除');
      this.refresh();
    },
  
    async renderRbacRoles(){
      const host = document.querySelector('#content');
      if (!host) return;
      try {
        const allRows = await this.api('/roles');
        const raw = Array.isArray(allRows) ? allRows : [];
        const kw = (this.rbacRoleKeyword || '').trim().toLowerCase();
        const st = String(this.rbacRoleStatus || '');
        const filtered = raw.filter(r => {
          if (st !== '' && String(r.status ? 1 : 0) !== st) return false;
          if (kw && !String(r.name||'').toLowerCase().includes(kw) && !String(r.description||'').toLowerCase().includes(kw)) return false;
          return true;
        });
        const pack = UI.paginateLocal(filtered, this.rbacRolePage || 1, 20);
        this.rbacRolePage = pack.page;
        host.innerHTML = `
          <div class="panel list-panel">
            <div class="matrix-action-bar">
              <div class="left"><span class="muted">共 ${filtered.length} / ${raw.length} 个系统角色</span></div>
              <div class="right">
                ${this.canRbacRolesCreate()?`<button class="primary tiny" type="button" onclick="app.editRoleModal()">新建系统角色</button>`:''}
              </div>
            </div>
            <div class="search-bar task-filter-bar">
              <select id="rbac-role-status" class="input" title="角色状态">
                <option value="">全部状态</option>
                <option value="1" ${st==='1'?'selected':''}>正常启用</option>
                <option value="0" ${st==='0'?'selected':''}>停用锁定</option>
              </select>
              <input id="rbac-role-search" class="input" type="search" placeholder="搜索角色名称 / 说明" value="${this.esc(this.rbacRoleKeyword||'')}" onkeydown="if(event.key==='Enter')app.searchRbacRoles()">
              <button class="primary" type="button" onclick="app.searchRbacRoles()">查询</button>
              <button class="ghost" type="button" onclick="app.resetRbacRoles()">重置</button>
            </div>
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>角色名称</th>
                    <th>说明描述</th>
                    <th>关联成员数</th>
                    <th>已分配权限节点</th>
                    <th>角色状态</th>
                    <th>更新时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${pack.items.length ? pack.items.map(r => {
                    let permCount = 0;
                    try {
                      const parsed = JSON.parse(r.permissions || '[]');
                      permCount = parsed.includes('*') ? '全量权限 (*)' : `${parsed.length} 个节点`;
                    } catch { permCount = '-'; }
                    return `
                    <tr>
                      <td><b>#${r.id}</b></td>
                      <td><b>${this.esc(r.name)}</b></td>
                      <td class="muted">${this.esc(r.description || '-')}</td>
                      <td><span class="badge online">${r.user_count || 0} 人</span></td>
                      <td><code>${this.esc(permCount)}</code></td>
                      <td>${this.badge(r.status ? 'online' : 'expired')}</td>
                      <td class="muted">${this.esc((r.updated_at || r.created_at || '-').slice(0, 19))}</td>
                      <td>
                        ${this.canRbacRolesUpdate()||this.canRbacRolesDelete()?`${this.canRbacRolesUpdate()?`<button class="tiny" onclick='app.editRoleModal(${JSON.stringify(r)})'>编辑权限</button>`:''}${r.id > 1 && this.canRbacRolesDelete() ? `<button class="tiny danger" onclick="app.deleteRole(${r.id},'${this.esc(r.name)}')">删除</button>` : ''}`:'<span class="muted">只读</span>'}
                      </td>
                    </tr>`;
                  }).join('') : '<tr><td colspan="8" class="empty" style="text-align:center;padding:36px">未找到匹配的角色</td></tr>'}
                </tbody>
              </table>
            </div>
            ${UI.pager(pack,'rbacRolePage')}
          </div>
        `;
      } catch(err) {
        host.innerHTML = `<div class="panel list-panel"><div class="empty">加载角色失败: ${this.esc(err.message)}</div></div>`;
      }
    },
    searchRbacRoles(){
      this.rbacRoleStatus = document.querySelector('#rbac-role-status')?.value || '';
      this.rbacRoleKeyword = document.querySelector('#rbac-role-search')?.value?.trim() || '';
      this.rbacRolePage = 1;
      this.refresh();
    },
    resetRbacRoles(){
      this.rbacRoleStatus = '';
      this.rbacRoleKeyword = '';
      this.rbacRolePage = 1;
      this.refresh();
    },
    async editRoleModal(role = {}){
      if (role.id ? !this.canRbacRolesUpdate() : !this.canRbacRolesCreate()) {
        this.toast(role.id ? '当前角色无权编辑系统角色（需 rbac.roles.update 或 rbac.manage）' : '当前角色无权新建系统角色（需 rbac.roles.create 或 rbac.manage）', true);
        return;
      }
      const perms = await this.api('/permissions');
      const selected = role.permissions ? (role.permissions === '["*"]' ? ['*'] : JSON.parse(role.permissions)) : [];
      const isAll = selected.includes('*');
      const selectedSet = new Set(selected.map(String));
      const modPairs = this.permModulePairs();
      const order = modPairs.map(([c]) => c);
      const moduleMap = new Map();
      (perms || []).forEach((p) => {
        const mod = this.permNormModule(p.module);
        const sub = this.permSubgroupKey(p.code);
        if (!moduleMap.has(mod)) moduleMap.set(mod, new Map());
        const subMap = moduleMap.get(mod);
        if (!subMap.has(sub)) subMap.set(sub, []);
        subMap.get(sub).push(p);
      });
      const modKeys = [
        ...order.filter((m) => moduleMap.has(m)),
        ...[...moduleMap.keys()].filter((m) => !order.includes(m)).sort(),
      ];
      const groupsHtml = modKeys.map((mod) => {
        const subMap = moduleMap.get(mod) || new Map();
        const allInMod = [...subMap.values()].flat();
        const modCheckedN = allInMod.filter((p) => isAll || selectedSet.has(String(p.id))).length;
        const subKeys = [...subMap.keys()].sort((a, b) => {
          const la = this.permSubgroupLabel(a);
          const lb = this.permSubgroupLabel(b);
          return la.localeCompare(lb, 'zh-CN');
        });
        const subHtml = subKeys.map((sub) => {
          const list = subMap.get(sub) || [];
          const groupKey = `${mod}::${sub}`;
          const checkedN = list.filter((p) => isAll || selectedSet.has(String(p.id))).length;
          const chips = list.map((p) => `
            <label class="chip">
              <input type="checkbox" name="permissions[]" value="${p.id}" data-perm-mod="${this.esc(mod)}" data-perm-sub="${this.esc(groupKey)}" ${isAll || selectedSet.has(String(p.id)) ? 'checked' : ''} onchange="app.syncRolePermGroupCheck('${this.esc(groupKey)}')">
              <span><b>${this.esc(p.name)}</b> <small class="muted">(${this.esc(p.code)})</small></span>
            </label>
          `).join('');
          return `<section class="rbac-perm-subgroup" data-perm-group="${this.esc(groupKey)}">
            <div class="rbac-perm-group-head rbac-perm-subgroup-head">
              <label class="rbac-perm-group-title">
                <input type="checkbox" class="rbac-perm-group-all" data-perm-mod="${this.esc(mod)}" data-perm-sub="${this.esc(groupKey)}" ${checkedN === list.length && list.length ? 'checked' : ''} ${checkedN && checkedN < list.length ? 'data-indeterminate="1"' : ''} onchange="app.toggleRolePermGroup('${this.esc(groupKey)}', this.checked)">
                <b>${this.esc(this.permSubgroupLabel(sub))}</b>
                <small class="muted">${this.esc(sub)} · ${checkedN}/${list.length}</small>
              </label>
              <div class="rbac-perm-group-actions">
                <button type="button" class="tiny ghost" onclick="app.toggleRolePermGroup('${this.esc(groupKey)}', true)">全选</button>
                <button type="button" class="tiny ghost" onclick="app.toggleRolePermGroup('${this.esc(groupKey)}', false)">清空</button>
              </div>
            </div>
            <div class="chip-row rbac-perm-group-chips">${chips}</div>
          </section>`;
        }).join('');
        return `<section class="rbac-perm-group" data-perm-module="${this.esc(mod)}">
          <div class="rbac-perm-module-head">
            <label class="rbac-perm-group-title">
              <input type="checkbox" class="rbac-perm-module-all" data-perm-mod="${this.esc(mod)}" ${modCheckedN === allInMod.length && allInMod.length ? 'checked' : ''} ${modCheckedN && modCheckedN < allInMod.length ? 'data-indeterminate="1"' : ''} onchange="app.toggleRolePermModule('${this.esc(mod)}', this.checked)">
              <b>${this.esc(this.permModuleLabel(mod))}</b>
              <small class="muted">${this.esc(mod)} · ${modCheckedN}/${allInMod.length}</small>
            </label>
            <div class="rbac-perm-group-actions">
              <button type="button" class="tiny ghost" onclick="app.toggleRolePermModule('${this.esc(mod)}', true)">全选模块</button>
              <button type="button" class="tiny ghost" onclick="app.toggleRolePermModule('${this.esc(mod)}', false)">清空模块</button>
            </div>
          </div>
          <div class="rbac-perm-subgroups">${subHtml}</div>
        </section>`;
      }).join('') || '<div class="empty" style="padding:24px">暂无权限节点</div>';

      this.modal(role.id ? '编辑角色权限' : '新建系统角色', `
        <div class="form-grid">
          <input type="hidden" name="id" value="${role.id || ''}">
          ${this.field('name', '角色名称', role.name || '', 'text', true)}
          ${this.field('description', '说明描述', role.description || '', 'text')}
          ${this.selectRaw('status', '角色状态', this.opt('roleStatuses', [['1', '正常启用'], ['0', '停用锁定']]), String(role.status ?? 1))}
          <div class="field full">
            <label>细粒度权限节点分配 (勾选授权)</label>
            <div class="rbac-perm-groups">${groupsHtml}</div>
          </div>
        </div>
      `, async (d) => {
        if (role.id ? !this.canRbacRolesUpdate() : !this.canRbacRolesCreate()) {
          this.toast(role.id ? '当前角色无权编辑系统角色（需 rbac.roles.update 或 rbac.manage）' : '当前角色无权新建系统角色（需 rbac.roles.create 或 rbac.manage）', true);
          return;
        }
        const checked = [...document.querySelectorAll('#modal-form input[name="permissions[]"]:checked')].map(el => el.value);
        const payload = {
          id: d.id || null,
          name: d.name,
          description: d.description || '',
          status: Number(d.status || 1),
          permissions: checked
        };
        await this.api('/roles', { method: 'POST', body: JSON.stringify(payload) });
        this.toast('角色已保存');
        this.closeModal();
        this.refresh();
      });
      // 半选态
      requestAnimationFrame(() => {
        document.querySelectorAll('#modal-form .rbac-perm-group-all[data-indeterminate="1"], #modal-form .rbac-perm-module-all[data-indeterminate="1"]').forEach((el) => {
          el.indeterminate = true;
        });
      });
    },
    toggleRolePermGroup(groupKey, on){
      const g = String(groupKey || '');
      document.querySelectorAll(`#modal-form input[name="permissions[]"][data-perm-sub="${g}"]`).forEach((el) => {
        el.checked = !!on;
      });
      this.syncRolePermGroupCheck(g);
    },
    toggleRolePermModule(mod, on){
      const m = String(mod || '');
      document.querySelectorAll(`#modal-form input[name="permissions[]"][data-perm-mod="${m}"]`).forEach((el) => {
        el.checked = !!on;
      });
      [...document.querySelectorAll(`#modal-form .rbac-perm-subgroup[data-perm-group^="${m}::"]`)].forEach((sec) => {
        this.syncRolePermGroupCheck(sec.getAttribute('data-perm-group') || '');
      });
      const head = document.querySelector(`#modal-form .rbac-perm-module-all[data-perm-mod="${m}"]`);
      if (head) {
        head.checked = !!on;
        head.indeterminate = false;
      }
    },
    syncRolePermGroupCheck(groupKey){
      const g = String(groupKey || '');
      const boxes = [...document.querySelectorAll(`#modal-form input[name="permissions[]"][data-perm-sub="${g}"]`)];
      const head = document.querySelector(`#modal-form .rbac-perm-group-all[data-perm-sub="${g}"]`);
      const tip = document.querySelector(`#modal-form .rbac-perm-subgroup[data-perm-group="${g}"] .rbac-perm-group-title small`);
      if (!boxes.length) return;
      const n = boxes.filter((el) => el.checked).length;
      if (head) {
        head.checked = n === boxes.length;
        head.indeterminate = n > 0 && n < boxes.length;
      }
      const mod = boxes[0]?.getAttribute('data-perm-mod') || '';
      if (mod) {
        const modBoxes = [...document.querySelectorAll(`#modal-form input[name="permissions[]"][data-perm-mod="${mod}"]`)];
        const modHead = document.querySelector(`#modal-form .rbac-perm-module-all[data-perm-mod="${mod}"]`);
        const mn = modBoxes.filter((el) => el.checked).length;
        if (modHead) {
          modHead.checked = mn === modBoxes.length;
          modHead.indeterminate = mn > 0 && mn < modBoxes.length;
        }
      }
      if (tip) {
        const code = tip.textContent.split('·')[0]?.trim() || g;
        tip.textContent = `${code} · ${n}/${boxes.length}`;
      }
    },
    async deleteRole(id, name){
      if (!this.canRbacRolesDelete()) { this.toast('当前角色无权删除系统角色（需 rbac.roles.delete 或 rbac.manage）', true); return; }
      if (id <= 1) {
        this.toast('超级管理员角色禁止删除', true);
        return;
      }
      const ok = await this.ask(`确定要删除角色【${name}】吗？`, 'danger');
      if (!ok) return;
      await this.api('/roles/delete', { method: 'POST', body: JSON.stringify({ id }) });
      this.toast('角色已删除');
      this.refresh();
    },
  
    async renderRbacUsers(){
      const host = document.querySelector('#content');
      if (!host) return;
      try {
        const page = this.rbacUserPage || 1;
        const kw = (this.rbacUserKeyword || '').trim();
        const st = String(this.rbacUserStatus || '');
        const qs = new URLSearchParams({ page: String(page), pageSize: '20' });
        if (kw) qs.set('keyword', kw);
        if (st !== '') qs.set('status', st);
        const res = await this.api(`/admin-users?${qs.toString()}`);
        let rows = res.items || [];
        if (st !== '' && !('status' in (res||{}))) {
          rows = rows.filter(u => String(u.status ? 1 : 0) === st);
        }
        const pack = {
          items: rows,
          page: res.page || page,
          pages: res.pages || res.lastPage || Math.max(1, Math.ceil((res.total || rows.length) / (res.pageSize || 20))),
          total: res.total || rows.length,
          pageSize: res.pageSize || 20,
        };
        this.rbacUserPage = pack.page;
        host.innerHTML = `
          <div class="panel list-panel">
            <div class="matrix-action-bar">
              <div class="left"><span class="muted">共 ${pack.total} 个管理员 · 改角色后立即生效</span></div>
              <div class="right">
                ${this.canRbacUsersCreate()?`<button class="primary tiny" type="button" onclick="app.editAdminUserModal()">添加管理员用户</button>`:''}
              </div>
            </div>
            <div class="search-bar task-filter-bar">
              <select id="rbac-user-status" class="input" title="账号状态">
                <option value="">全部状态</option>
                <option value="1" ${st==='1'?'selected':''}>正常启用</option>
                <option value="0" ${st==='0'?'selected':''}>禁用锁定</option>
              </select>
              <input id="rbac-user-search" class="input" type="search" placeholder="搜索用户名 / 昵称" value="${this.esc(this.rbacUserKeyword||'')}" onkeydown="if(event.key==='Enter')app.searchRbacUsers()">
              <button class="primary" type="button" onclick="app.searchRbacUsers()">查询</button>
              <button class="ghost" type="button" onclick="app.resetRbacUsers()">重置</button>
            </div>
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>登录用户名</th>
                    <th>显示昵称</th>
                    <th>通知邮箱</th>
                    <th>所属系统角色</th>
                    <th>所属企业</th>
                    <th>自研环境额度</th>
                    <th>子级</th>
                    <th>账号状态</th>
                    <th>注册时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows.length ? rows.map(u => `
                    <tr>
                      <td><b>#${u.id}</b></td>
                      <td><b>${this.esc(u.username)}</b></td>
                      <td>${this.esc(u.nickname || '-')}</td>
                      <td class="muted">${this.esc(u.email || '-')}</td>
                      <td><span class="badge ${u.role_id===1?'online':'running'}">${this.esc(u.role_name || (u.role_id===1?'超级管理员':'普通操作员'))}</span></td>
                      <td>${(u.companies && u.companies.length) ? u.companies.map(c => `<div><b>${this.esc(c.name)}</b></div>`).join('') : (u.company?.name ? `<b>${this.esc(u.company.name)}</b>` : '<span class="muted">-</span>')}</td>
                      <td><span class="muted">${Number(u.browserEnvUsed||0)}/${Number(u.browserEnvQuota??300)}</span></td>
                      <td>${(u.childIds||[]).length ? `<span class="muted">${(u.childIds||[]).length} 个子级</span>` : '<span class="muted">-</span>'}</td>
                      <td>${this.badge(u.status ? 'online' : 'offline')}</td>
                      <td class="muted">${this.esc((u.created_at || '-').slice(0, 19))}</td>
                      <td>
                        ${this.canRbacUsersUpdate()||this.canRbacUsersDelete()||this.canRbacUsersBrowserQuota()?`${this.canRbacUsersUpdate()?`<button class="tiny" onclick='app.editAdminUserModal(${JSON.stringify(u)})'>编辑信息</button>`:''}${this.canRbacUsersBrowserQuota()?`<button class="tiny" onclick='app.setAdminUserBrowserQuotaModal(${JSON.stringify({id:u.id,username:u.username,nickname:u.nickname||'',browserEnvQuota:u.browserEnvQuota??300,browserEnvUsed:u.browserEnvUsed||0})})'>设置浏览器额度</button>`:''}${u.id > 1 && this.canRbacUsersDelete() ? `<button class="tiny danger" onclick="app.deleteAdminUser(${u.id},'${this.esc(u.username)}')">删除</button>` : ''}`:'<span class="muted">只读</span>'}
                      </td>
                    </tr>
                  `).join('') : '<tr><td colspan="11" class="empty" style="text-align:center;padding:36px">未找到匹配的管理员</td></tr>'}
                </tbody>
              </table>
            </div>
            ${UI.pager(pack,'rbacUserPage')}
          </div>
        `;
      } catch(err) {
        host.innerHTML = `<div class="panel list-panel"><div class="empty">加载管理员列表失败: ${this.esc(err.message)}</div></div>`;
      }
    },
    searchRbacUsers(){
      this.rbacUserStatus = document.querySelector('#rbac-user-status')?.value || '';
      this.rbacUserKeyword = document.querySelector('#rbac-user-search')?.value?.trim() || '';
      this.rbacUserPage = 1;
      this.refresh();
    },
    resetRbacUsers(){
      this.rbacUserStatus = '';
      this.rbacUserKeyword = '';
      this.rbacUserPage = 1;
      this.refresh();
    },
    roleNameById(roleId, roles) {
      const r = (roles || this._rbacRoles || []).find((x) => Number(x.id) === Number(roleId));
      return String(r?.name || '');
    },
    isEnterpriseCustomerRoleId(roleId, roles) {
      return this.roleNameById(roleId, roles).includes('企业客户');
    },
    isOperatorRoleId(roleId, roles) {
      return this.roleNameById(roleId, roles).includes('运营专员');
    },
    isCompanyScopedRoleId(roleId, roles) {
      const name = this.roleNameById(roleId, roles);
      return name.includes('企业客户') || name.includes('运营专员');
    },
    isNoChildAdminRoleId(roleId, roles) {
      if (Number(roleId) === 1) return true;
      const name = this.roleNameById(roleId, roles);
      return name.includes('超级管理员')
        || name.includes('运营管理')
        || this.isCompanyScopedRoleId(roleId, roles);
    },
    selectedRoleName() {
      const roleSel = document.querySelector('#modal-form [name=role_id]');
      if (!roleSel) return '';
      return String(roleSel.options[roleSel.selectedIndex]?.text || '');
    },
    isEnterpriseCustomerRoleSelected() {
      const name = this.selectedRoleName();
      if (name.includes('企业客户')) return true;
      const roleSel = document.querySelector('#modal-form [name=role_id]');
      return roleSel ? this.isEnterpriseCustomerRoleId(roleSel.value, this._rbacRoles || []) : false;
    },
    isCompanyScopedRoleSelected() {
      const name = this.selectedRoleName();
      if (name.includes('企业客户') || name.includes('运营专员')) return true;
      const roleSel = document.querySelector('#modal-form [name=role_id]');
      return roleSel ? this.isCompanyScopedRoleId(roleSel.value, this._rbacRoles || []) : false;
    },
    isNoChildAdminRoleSelected() {
      const name = this.selectedRoleName();
      if (name.includes('超级管理员') || name.includes('运营管理') || name.includes('企业客户') || name.includes('运营专员')) return true;
      const roleSel = document.querySelector('#modal-form [name=role_id]');
      return roleSel ? this.isNoChildAdminRoleId(roleSel.value, this._rbacRoles || []) : false;
    },
    initAdminUserCompanyPicker(companies, selectedIds) {
      this._adminUserCompanyCatalog = (companies || []).map((c) => ({
        id: Number(c.id),
        name: String(c.name || ''),
        industryPath: String(c.industryPath || ''),
      }));
      const idSet = new Set((selectedIds || []).map(Number).filter((x) => x > 0));
      this._adminUserSelectedCompanies = this._adminUserCompanyCatalog.filter((c) => idSet.has(c.id));
      idSet.forEach((id) => {
        if (!this._adminUserSelectedCompanies.some((c) => c.id === id)) {
          this._adminUserSelectedCompanies.push({ id, name: '#' + id, industryPath: '' });
        }
      });
      this.renderAdminUserCompanyChips();
      this.refreshAdminUserCompanyPickOptions();
    },
    refreshAdminUserCompanyPickOptions() {
      const sel = document.querySelector('#admin-user-company-pick');
      if (!sel) return;
      const picked = new Set((this._adminUserSelectedCompanies || []).map((c) => c.id));
      const available = (this._adminUserCompanyCatalog || []).filter((c) => !picked.has(c.id));
      sel.innerHTML = `<option value="">选择企业后点击确认添加</option>`
        + available.map((c) => `<option value="${c.id}">${this.esc(c.name)}${c.industryPath ? `（${this.esc(c.industryPath)}）` : ''}</option>`).join('');
    },
    renderAdminUserCompanyChips() {
      const box = document.querySelector('#admin-user-company-chips');
      const hidden = document.querySelector('#admin-user-company-ids');
      const list = this._adminUserSelectedCompanies || [];
      if (hidden) hidden.value = list.map((c) => c.id).join(',');
      if (!box) return;
      box.innerHTML = list.length
        ? list.map((c) => `<span class="chip admin-user-company-chip"><span>${this.esc(c.name)}</span><button type="button" class="tiny danger" title="移除" aria-label="移除" onclick="app.removeAdminUserCompany(${c.id})">×</button></span>`).join('')
        : '<span class="muted">暂未关联企业，请从下拉框选择后点击「确认添加」</span>';
    },
    addAdminUserCompanyPick() {
      const sel = document.querySelector('#admin-user-company-pick');
      const id = Number(sel?.value || 0);
      if (!id) { this.toast('请先选择企业', true); return; }
      const item = (this._adminUserCompanyCatalog || []).find((c) => c.id === id);
      if (!item) { this.toast('企业不存在', true); return; }
      if ((this._adminUserSelectedCompanies || []).some((c) => c.id === id)) {
        this.toast('该企业已添加', true);
        return;
      }
      this._adminUserSelectedCompanies = [...(this._adminUserSelectedCompanies || []), item];
      this.renderAdminUserCompanyChips();
      this.refreshAdminUserCompanyPickOptions();
      if (sel) sel.value = '';
    },
    removeAdminUserCompany(id) {
      const cid = Number(id || 0);
      if (!cid) return;
      this._adminUserSelectedCompanies = (this._adminUserSelectedCompanies || []).filter((c) => c.id !== cid);
      this.renderAdminUserCompanyChips();
      this.refreshAdminUserCompanyPickOptions();
    },
    getAdminUserSelectedCompanyIds() {
      return (this._adminUserSelectedCompanies || []).map((c) => Number(c.id)).filter((x) => x > 0);
    },
    setAdminUserBlockVisible(el, visible) {
      if (!el) return;
      el.classList.toggle('hidden', !visible);
      if (visible) {
        el.removeAttribute('hidden');
        el.style.removeProperty('display');
      } else {
        el.setAttribute('hidden', '');
        el.style.setProperty('display', 'none', 'important');
      }
    },
    syncAdminUserRoleFields() {
      const isScoped = this.isCompanyScopedRoleSelected();
      const isEnt = this.isEnterpriseCustomerRoleSelected();
      const creatingEnt = !!document.querySelector('#admin-user-create-enterprise')?.checked;
      const isCreate = !!this._adminUserModalIsCreate;
      const childBox = document.querySelector('#admin-user-child-box');
      const companyBox = document.querySelector('#admin-user-company-box');
      const createEntWrap = document.querySelector('#admin-user-create-enterprise-wrap');
      const createEntFields = document.querySelector('#admin-user-enterprise-fields');
      const companyHint = document.querySelector('#admin-user-company-hint');
      const noChild = this.isNoChildAdminRoleSelected();
      this.setAdminUserBlockVisible(childBox, !noChild);
      this.setAdminUserBlockVisible(companyBox, isScoped && !creatingEnt);
      this.setAdminUserBlockVisible(createEntWrap, isEnt && isCreate);
      if (companyHint) {
        companyHint.textContent = isEnt ? '企业客户至少关联一个企业' : '运营专员可关联多个企业（可选）';
      }
      if (createEntFields) {
        const showFields = isEnt && creatingEnt;
        createEntFields.classList.toggle('hidden', !showFields);
        if (showFields) {
          createEntFields.removeAttribute('hidden');
          createEntFields.style.display = 'grid';
        } else {
          createEntFields.setAttribute('hidden', '');
          createEntFields.style.setProperty('display', 'none', 'important');
        }
      }
      if (noChild && childBox) {
        childBox.querySelectorAll('[name=childId]').forEach((el) => { el.checked = false; });
      }
    },
    toggleAdminUserEnterpriseFields(on) {
      const box = document.querySelector('#admin-user-enterprise-fields');
      const chk = document.querySelector('#admin-user-create-enterprise');
      if (box) {
        box.classList.toggle('hidden', !on);
        box.style.display = on ? 'grid' : 'none';
      }
      if (chk) chk.checked = !!on;
      const roleSel = document.querySelector('#modal-form [name=role_id]');
      if (on && roleSel) {
        const entRole = [...roleSel.options].find((o) => String(o.textContent || '').includes('企业客户'));
        if (entRole) roleSel.value = entRole.value;
      }
      this.syncAdminUserRoleFields();
    },
    async editAdminUserModal(user = {}) {
      if (user.id ? !this.canRbacUsersUpdate() : !this.canRbacUsersCreate()) {
        this.toast(user.id ? '当前角色无权编辑管理员用户（需 rbac.users.update 或 rbac.manage）' : '当前角色无权添加管理员用户（需 rbac.users.create 或 rbac.manage）', true);
        return;
      }
      const [roles, usersPack, companiesPack] = await Promise.all([
        this.api('/roles'),
        this.api('/admin-users?pageSize=200'),
        this.api('/companies?pageSize=500&status=1').catch(() => ({ items: [] })),
      ]);
      this._rbacRoles = roles;
      const companies = companiesPack.items || [];
      const allUsers = usersPack.items || [];
      const selfId = Number(user.id || 0);
      const isCreate = !user.id;
      const selectedCompanyIds = (user.companyIds && user.companyIds.length)
        ? user.companyIds.map(Number)
        : [Number(user.company_id || user.company?.id || 0)].filter((x) => x > 0);
      const selected = new Set((user.childIds || []).map(Number));
      const enterpriseRoleId = (roles.find((r) => String(r.name || '').includes('企业客户')) || {}).id || '';
      const defaultRoleId = user.role_id || enterpriseRoleId || 1;
      const initialIsScoped = this.isCompanyScopedRoleId(defaultRoleId, roles);
      const initialNoChild = this.isNoChildAdminRoleId(defaultRoleId, roles);
      this._adminUserModalIsCreate = isCreate;
      const childOpts = allUsers.filter((u) => Number(u.id) !== selfId && Number(u.role_id) !== 1);
      const childHiddenAttr = initialNoChild ? ' class="field full hidden" hidden style="display:none!important"' : ' class="field full"';
      const childBoxes = childOpts.length
        ? `<div id="admin-user-child-box"${childHiddenAttr}><label>子级管理员（可多选）</label><div class="chip-row" style="max-height:180px;overflow:auto;padding:8px;border:1px solid #e2e8f0;border-radius:8px">${childOpts.map((u) => {
            const id = Number(u.id);
            const label = this.esc(u.nickname || u.username) + ' · @' + this.esc(u.username);
            return `<label class="chip"><input type="checkbox" name="childId" value="${id}" ${selected.has(id) ? 'checked' : ''}> ${label}</label>`;
          }).join('')}</div><div class="muted" style="margin-top:6px">勾选后，该账号可在右下角切换到子账号查看其专属数据。超级管理员/运营管理/企业客户/运营专员不可设置子级。</div></div>`
        : `<div id="admin-user-child-box"${childHiddenAttr}><div class="muted">暂无其他管理员可作为子级（超级管理员不可被选）</div></div>`;
      const companyVisibleAttr = initialIsScoped ? ' class="field full"' : ' class="field full hidden" hidden style="display:none!important"';
      const companySelect = `<div id="admin-user-company-box"${companyVisibleAttr}>
        <label>关联企业 <span id="admin-user-company-hint" class="muted">可多选，选后点确认添加</span></label>
        <div class="admin-user-company-pick-row" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <select id="admin-user-company-pick" class="input" style="flex:1;min-width:200px"><option value="">选择企业后点击确认添加</option></select>
          <button type="button" class="primary tiny" onclick="app.addAdminUserCompanyPick()">确认添加</button>
        </div>
        <div id="admin-user-company-chips" class="chip-row" style="margin-top:10px;min-height:36px"></div>
        <input type="hidden" name="companyIds" id="admin-user-company-ids" value="">
      </div>`;
      const enterpriseBlock = isCreate ? `
          <div id="admin-user-create-enterprise-wrap" class="field full${this.isEnterpriseCustomerRoleId(defaultRoleId, roles) ? '' : ' hidden'}"${this.isEnterpriseCustomerRoleId(defaultRoleId, roles) ? '' : ' hidden style="display:none!important;"'}>
            <label class="chip" style="display:inline-flex;align-items:center;gap:8px">
              <input type="checkbox" id="admin-user-create-enterprise" name="createEnterprise" value="1" onchange="app.toggleAdminUserEnterpriseFields(this.checked)">
              <span><b>同时创建企业</b> <small class="muted">勾选后将新建企业并绑定为该账号主企业</small></span>
            </label>
          </div>
          <div id="admin-user-enterprise-fields" class="field full hidden" style="display:none;grid-column:1/-1;gap:12px">
            <div class="field full" style="margin:0"><label>所属行业 <span class="muted">四级联动，请选到最细分类</span></label>
              ${typeof this.industryCascadeHtml === 'function' ? this.industryCascadeHtml('admin-user-industry', 0) : '<div class="muted">行业模块未加载</div>'}
            </div>
            ${this.field('companyName', '公司名称', '', 'text')}
            ${this.field('contactName', '联系人', '', 'text')}
            ${this.field('contactPhone', '联系电话', '', 'text')}
            ${this.field('contactEmail', '联系邮箱', '', 'email')}
          </div>
        ` : '';
      this.modal(user.id ? '编辑管理员账号' : '添加管理用户', `
        <div class="form-grid">
          <input type="hidden" name="id" value="${user.id || ''}">
          ${this.field('username', '登录用户名', user.username || '', 'text', true)}
          ${this.field('nickname', '显示昵称', user.nickname || '', 'text')}
          ${this.field('email', '通知邮箱（拉取数据分析报告）', user.email || '', 'email')}
          ${this.field('password', user.id ? '重置登录密码 (留空则保持原密码)' : '初始登录密码', '', 'password', !user.id)}
          <div class="field"><label>所属系统角色</label><select name="role_id" class="input" onchange="app.syncAdminUserRoleFields()">${roles.map((r) => `<option value="${r.id}" ${String(r.id) === String(defaultRoleId) ? 'selected' : ''}>${this.esc(r.name)}</option>`).join('')}</select></div>
          ${this.selectRaw('status', '账号状态', this.opt('userStatuses', [['1', '正常启用'], ['0', '禁用锁定']]), String(user.status ?? 1))}
          ${companySelect}
          ${enterpriseBlock}
          ${childBoxes}
        </div>
      `, async (d) => {
        if (user.id ? !this.canRbacUsersUpdate() : !this.canRbacUsersCreate()) {
          this.toast(user.id ? '当前角色无权编辑管理员用户（需 rbac.users.update 或 rbac.manage）' : '当前角色无权添加管理员用户（需 rbac.users.create 或 rbac.manage）', true);
          return;
        }
        const roleId = Number(d.role_id || 1);
        const roleName = String(document.querySelector('#modal-form [name=role_id] option:checked')?.textContent || '');
        const isEnt = this.isEnterpriseCustomerRoleId(roleId, roles) || roleName.includes('企业客户');
        const isScoped = this.isCompanyScopedRoleId(roleId, roles) || roleName.includes('企业客户') || roleName.includes('运营专员');
        const noChild = this.isNoChildAdminRoleId(roleId, roles) || roleName.includes('超级管理员') || roleName.includes('运营管理') || isScoped;
        const createEnterprise = isCreate && isEnt && !!document.querySelector('#admin-user-create-enterprise')?.checked;
        const industryId = Number(document.querySelector('#admin-user-industry-value')?.value || d.industryId || 0);
        const companyIds = this.getAdminUserSelectedCompanyIds();
        if (createEnterprise) {
          if (!String(d.companyName || '').trim()) { this.toast('请填写公司名称', true); return; }
          if (!industryId) { this.toast('请选择行业分类', true); return; }
        } else if (isEnt && !companyIds.length) {
          this.toast('企业客户角色请至少关联一个企业', true);
          return;
        }
        const payload = {
          id: d.id ? Number(d.id) : undefined,
          username: d.username,
          nickname: d.nickname,
          email: String(d.email || '').trim(),
          password: d.password || '',
          role_id: roleId,
          status: Number(d.status ?? 1),
          childIds: noChild ? [] : [...document.querySelectorAll('#modal-form [name=childId]:checked')].map((x) => Number(x.value)),
          createEnterprise,
          companyIds: isScoped && !createEnterprise ? companyIds : [],
        };
        if (createEnterprise) {
          payload.company = {
            name: String(d.companyName || '').trim(),
            contactName: String(d.contactName || '').trim(),
            contactPhone: String(d.contactPhone || '').trim(),
            contactEmail: String(d.contactEmail || '').trim(),
            industryId,
          };
        }
        if (!payload.id) delete payload.id;
        await this.api('/admin-users', { method: 'POST', body: JSON.stringify(payload) });
        this.toast(createEnterprise ? '企业与管理用户已创建' : '管理员账号已保存');
        this.closeModal();
        this.refresh();
      });
      this.initAdminUserCompanyPicker(companies, selectedCompanyIds);
      requestAnimationFrame(() => this.syncAdminUserRoleFields());
      if (isCreate && typeof this.bindIndustryCascade === 'function') {
        await this.bindIndustryCascade('admin-user-industry', 0);
      }
    },
    async setAdminUserBrowserQuotaModal(user = {}){
      if (!this.canRbacUsersBrowserQuota()) {
        this.toast('当前无权设置浏览器额度（需超管且具备 rbac.users.browser_quota）', true);
        return;
      }
      const uid = Number(user.id || 0);
      if (!uid) { this.toast('用户无效', true); return; }
      const name = user.nickname || user.username || ('#' + uid);
      const used = Number(user.browserEnvUsed || 0);
      const cur = Number(user.browserEnvQuota ?? 300);
      this.modal('设置自研浏览器环境额度', `
        <div class="form-grid">
          <div class="field full"><div class="muted">管理用户：<b>${this.esc(name)}</b>（#${uid}）· 已用 <b>${used}</b>（自研桌面 + Linux，不含比特）</div></div>
          ${this.field('quota', '环境额度上限', String(cur), 'number', true)}
          <div class="field full"><div class="muted">创建自研 / 服务器浏览器环境时按此额度校验；默认 300。仅超级管理员可改。</div></div>
        </div>
      `, async (d) => {
        if (!this.canRbacUsersBrowserQuota()) {
          this.toast('当前无权设置浏览器额度', true);
          return;
        }
        const quota = Math.floor(Number(d.quota));
        if (!Number.isFinite(quota) || quota < 0) {
          this.toast('请填写有效额度（≥0）', true);
          return;
        }
        await this.api(`/admin-users/${uid}/browser-env-quota`, {
          method: 'PUT',
          body: JSON.stringify({ quota }),
        });
        await this.ensureAuth().catch(() => {});
        this.toast('浏览器环境额度已更新');
        this.closeModal();
        this.refresh();
      });
    },
    async deleteAdminUser(id, username){
      if (!this.canRbacUsersDelete()) { this.toast('当前角色无权删除管理员用户（需 rbac.users.delete 或 rbac.manage）', true); return; }
      if (id === 1) {
        this.toast('超级管理员账号禁止删除', true);
        return;
      }
      const ok = await this.ask(`确定要删除管理员【${username}】吗？`, 'danger');
      if (!ok) return;
      await this.api('/admin-users/delete', { method: 'POST', body: JSON.stringify({ id }) });
      this.toast('管理员账号已删除');
      this.refresh();
    },
  
    async renderRbacLogs(){
      const host = document.querySelector('#content');
      if (!host) return;
      try {
        const kw = (this.rbacLogKeyword || '').trim();
        const page = this.rbacLogPage || 1;
        const res = await this.api(`/admin-logs?page=${page}&pageSize=20${kw ? '&keyword=' + encodeURIComponent(kw) : ''}`);
        const rows = res.items || [];
        const pack = {
          items: rows,
          page: res.page || page,
          pages: res.pages || res.lastPage || Math.max(1, Math.ceil((res.total || rows.length) / (res.pageSize || 20))),
          total: res.total || rows.length,
          pageSize: res.pageSize || 20,
        };
        this.rbacLogPage = pack.page;
        host.innerHTML = `
          <div class="panel list-panel">
            <div class="matrix-action-bar">
              <div class="left"><span class="muted">共 ${pack.total} 条审计记录</span></div>
              <div class="right">
                ${this.canRbacLogsClear()?`<button class="danger tiny" type="button" onclick="app.clearRbacLogs()">清空所有日志</button>`:''}
              </div>
            </div>
            <div class="search-bar task-filter-bar">
              <input id="rbac-log-search" class="input" type="search" placeholder="搜索操作人、路由、动作或 IP" value="${this.esc(this.rbacLogKeyword||'')}" onkeydown="if(event.key==='Enter')app.searchRbacLogs()">
              <button class="primary" type="button" onclick="app.searchRbacLogs()">查询</button>
              <button class="ghost" type="button" onclick="app.resetRbacLogs()">重置</button>
            </div>
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>操作人员</th>
                    <th>所属模块</th>
                    <th>动作 (Action)</th>
                    <th>请求路由 (Path)</th>
                    <th>客户端 IP</th>
                    <th>记录时间</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows.length ? rows.map(l => `
                    <tr>
                      <td><b>#${l.id}</b></td>
                      <td><b>${this.esc(l.username || 'System')}</b></td>
                      <td><span class="badge ${l.module==='account'?'online':l.module==='proxy'?'checking':l.module==='rbac'?'running':'pending'}">${this.esc(l.module || 'system')}</span></td>
                      <td><span class="badge online">${this.esc(l.action)}</span></td>
                      <td><code>${this.esc(l.path || '-')}</code></td>
                      <td>${this.esc(l.ip || '-')}</td>
                      <td class="muted">${this.esc((l.created_at || '-').slice(0, 19))}</td>
                    </tr>
                  `).join('') : '<tr><td colspan="7" class="empty" style="text-align:center;padding:36px">暂无操作审计日志</td></tr>'}
                </tbody>
              </table>
            </div>
            ${UI.pager(pack,'rbacLogPage')}
          </div>
        `;
      } catch(err) {
        host.innerHTML = `<div class="panel list-panel"><div class="empty">加载操作日志失败: ${this.esc(err.message)}</div></div>`;
      }
    },
    searchRbacLogs(){
      this.rbacLogKeyword = document.querySelector('#rbac-log-search')?.value?.trim() || '';
      this.rbacLogPage = 1;
      this.refresh();
    },
    resetRbacLogs(){
      this.rbacLogKeyword = '';
      this.rbacLogPage = 1;
      this.refresh();
    },
    async clearRbacLogs(){
      if (!this.canRbacLogsClear()) { this.toast('当前角色无权清空审计日志（需 rbac.logs.clear 或 rbac.manage）', true); return; }
      const ok = await this.ask('确定要清空所有操作审计日志吗？清空后不可恢复。', 'danger');
      if (!ok) return;
      await this.api('/admin-logs/clear', { method: 'POST' });
      this.toast('操作日志已清空');
      this.refresh();
    },
  
    async renderRbacMenus(){
      const host = document.querySelector('#content');
      if (!host) return;
      try {
        const allRows = await this.api('/menus');
        const raw = Array.isArray(allRows) ? allRows : [];
        const kw = (this.rbacMenuKeyword || '').trim().toLowerCase();
        const vis = String(this.rbacMenuVisible || '');
        const filtered = raw.filter(m => {
          if (vis !== '' && String(m.visible ? 1 : 0) !== vis) return false;
          if (kw && !String(m.title||'').toLowerCase().includes(kw) && !String(m.view||'').toLowerCase().includes(kw) && !String(m.subview||'').toLowerCase().includes(kw) && !String(m.icon||'').toLowerCase().includes(kw)) return false;
          return true;
        });
        const pack = UI.paginateLocal(filtered, this.rbacMenuPage || 1, 20);
        this.rbacMenuPage = pack.page;
        host.innerHTML = `
          <div class="panel list-panel">
            <div class="matrix-action-bar">
              <div class="left"><span class="muted">共 ${filtered.length} / ${raw.length} 个菜单项</span></div>
              <div class="right">
                ${this.canRbacMenusUpdate()?`<button class="ghost tiny" type="button" onclick="app.refreshMenuTree()">刷新顶部导航</button>
                <button class="primary tiny" type="button" onclick="app.editMenuModal()">添加菜单项</button>`:''}
              </div>
            </div>
            <div class="search-bar task-filter-bar">
              <select id="rbac-menu-visible" class="input" title="显示状态">
                <option value="">全部状态</option>
                <option value="1" ${vis==='1'?'selected':''}>显示</option>
                <option value="0" ${vis==='0'?'selected':''}>隐藏</option>
              </select>
              <input id="rbac-menu-search" class="input" type="search" placeholder="搜索标题 / View / Subview / 图标" value="${this.esc(this.rbacMenuKeyword||'')}" onkeydown="if(event.key==='Enter')app.searchRbacMenus()">
              <button class="primary" type="button" onclick="app.searchRbacMenus()">查询</button>
              <button class="ghost" type="button" onclick="app.resetRbacMenus()">重置</button>
            </div>
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>层级关系</th>
                    <th>菜单标题</th>
                    <th>图标标识</th>
                    <th>对应视图 (View)</th>
                    <th>对应子视图 (Subview)</th>
                    <th>排序权重</th>
                    <th>显示状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${pack.items.length ? pack.items.map(m => `
                    <tr>
                      <td><b>#${m.id}</b></td>
                      <td>${m.parent_id ? `#${m.parent_id}` : '<span class="badge running">一级根菜单</span>'}</td>
                      <td><b>${this.esc(m.title)}</b></td>
                      <td><code>${this.esc(m.icon || '-')}</code></td>
                      <td><code>${this.esc(m.view)}</code></td>
                      <td><span class="muted">${this.esc(m.subview || '-')}</span></td>
                      <td>${m.sort_order}</td>
                      <td>${this.badge(m.visible ? 'online' : 'offline')}</td>
                      <td>
                        ${this.canRbacMenusUpdate()?`<button class="tiny" onclick='app.editMenuModal(${JSON.stringify(m)})'>编辑</button>
                        <button class="tiny danger" onclick="app.deleteMenu(${m.id},'${this.esc(m.title)}')">删除</button>`:'<span class="muted">只读</span>'}
                      </td>
                    </tr>
                  `).join('') : '<tr><td colspan="9" class="empty" style="text-align:center;padding:36px">未找到匹配的菜单项</td></tr>'}
                </tbody>
              </table>
            </div>
            ${UI.pager(pack,'rbacMenuPage')}
          </div>
        `;
      } catch(err) {
        host.innerHTML = `<div class="panel list-panel"><div class="empty">加载菜单失败: ${this.esc(err.message)}</div></div>`;
      }
    },
    searchRbacMenus(){
      this.rbacMenuVisible = document.querySelector('#rbac-menu-visible')?.value || '';
      this.rbacMenuKeyword = document.querySelector('#rbac-menu-search')?.value?.trim() || '';
      this.rbacMenuPage = 1;
      this.refresh();
    },
    resetRbacMenus(){
      this.rbacMenuVisible = '';
      this.rbacMenuKeyword = '';
      this.rbacMenuPage = 1;
      this.refresh();
    },
    async editMenuModal(m = {}){
      if (!this.canRbacMenusUpdate()) { this.toast('当前角色无权修改菜单配置（需 rbac.menus.update 或 rbac.manage）', true); return; }
      const allMenus = await this.api('/menus');
      const rootOpts = [['', '一级根菜单 (无上级)'], ...allMenus.filter(x => !m.id || x.id !== m.id).map(x => [x.id, `#${x.id} ${x.title}`])];
      this.modal(m.id ? '编辑菜单项' : '添加后台菜单', `
        <div class="form-grid">
          <input type="hidden" name="id" value="${m.id || ''}">
          ${this.selectRaw('parentId', '上级父级菜单', rootOpts, m.parent_id || '')}
          ${this.field('title', '菜单标题', m.title || '', 'text', true)}
          ${this.field('icon', '图标标识 (Icon Name)', m.icon || '', 'text')}
          ${this.field('view', '对应主视图 (View)', m.view || '', 'text', true)}
          ${this.field('subview', '对应子视图 (Subview)', m.subview || '', 'text')}
          ${this.field('sortOrder', '排序权重 (升序)', m.sort_order || 0, 'number')}
          ${this.selectRaw('visible', '是否可见显示', this.opt('menuVisibilities', [['1', '显示'], ['0', '隐藏']]), String(m.visible ?? 1))}
        </div>
      `, async (d) => {
        if (!this.canRbacMenusUpdate()) { this.toast('当前角色无权修改菜单配置（需 rbac.menus.update 或 rbac.manage）', true); return; }
        d.parentId = d.parentId ? Number(d.parentId) : null;
        d.sortOrder = Number(d.sortOrder || 0);
        d.visible = d.visible === '1';
        if (m.id) {
          await this.api(`/menus/${m.id}`, { method: 'PUT', body: JSON.stringify(d) });
        } else {
          await this.api('/menus', { method: 'POST', body: JSON.stringify(d) });
        }
        this.toast('菜单项已保存');
        this.closeModal();
        await this.loadNavigationMenus();
        this.refresh();
      });
    },
    async deleteMenu(id, title){
      if (!this.canRbacMenusUpdate()) { this.toast('当前角色无权删除菜单项（需 rbac.menus.update 或 rbac.manage）', true); return; }
      const ok = await this.ask(`确定要删除菜单【${title}】及其关联下级菜单吗？`, 'danger');
      if (!ok) return;
      await this.api(`/menus/${id}`, { method: 'DELETE' });
      this.toast('菜单项已删除');
      await this.loadNavigationMenus();
      this.refresh();
    },
    async refreshMenuTree(){
      if (!this.canRbacMenusUpdate()) { this.toast('当前角色无权刷新菜单配置（需 rbac.menus.update 或 rbac.manage）', true); return; }
      await this.loadNavigationMenus();
      this.toast('顶部导航菜单树已刷新');
      this.refresh();
    },
  };
  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages["rbac"] = true;
})();
