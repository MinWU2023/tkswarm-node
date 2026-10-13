(function () {
  if (!window.app) throw new Error('app-core must load before pages/rbac.js');
  const __methods = {
    async renderRbac(){
      document.querySelector('#content').classList.remove('chat-mode');
      const sub = this.subview || 'permissions';
      const note = `<div class="rbac-tip" role="note"><b>权限说明：</b>开启鉴权后，顶栏菜单会按角色裁剪；删除账号、导入、任务写入、RBAC 管理等敏感接口会校验权限码。关闭鉴权时全部放行。</div>`;
      if (sub === 'permissions') { await this.renderRbacPermissions(); document.querySelector('#content')?.insertAdjacentHTML('afterbegin', note); }
      else if (sub === 'roles') { await this.renderRbacRoles(); document.querySelector('#content')?.insertAdjacentHTML('afterbegin', note); }
      else if (sub === 'users') { await this.renderRbacUsers(); document.querySelector('#content')?.insertAdjacentHTML('afterbegin', note); }
      else if (sub === 'logs') { await this.renderRbacLogs(); document.querySelector('#content')?.insertAdjacentHTML('afterbegin', note); }
      else if (sub === 'menus') { await this.renderRbacMenus(); document.querySelector('#content')?.insertAdjacentHTML('afterbegin', note); }
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
          if (curMod !== 'all' && r.module !== curMod) return false;
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
                <button class="primary tiny" type="button" onclick="app.editPermissionModal()">添加权限节点</button>
              </div>
            </div>
            <div class="search-bar task-filter-bar rbac-perm-filter-bar">
              <select id="rbac-perm-module" class="input" title="业务模块" onchange="app.filterRbacPermModule(this.value)">
                ${modules.map(m => {
                  const cnt = m === 'all' ? allRows.length : allRows.filter(x => x.module === m).length;
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
                    <th>所属业务模块</th>
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
                      <td><span class="badge ${r.module==='account'?'online':r.module==='proxy'?'checking':r.module==='rbac'?'running':'pending'}">${this.esc(r.module)}</span></td>
                      <td><code>${this.esc(r.code)}</code></td>
                      <td><b>${this.esc(r.name)}</b></td>
                      <td>${r.sort_order}</td>
                      <td><span class="badge online">生效中</span></td>
                      <td class="muted">${this.esc((r.created_at || '-').slice(0, 19))}</td>
                      <td>
                        <button class="tiny" onclick='app.editPermissionModal(${JSON.stringify(r)})'>编辑</button>
                        <button class="tiny danger" onclick="app.deletePermission(${r.id},'${this.esc(r.name)}')">删除</button>
                      </td>
                    </tr>
                  `).join('') : '<tr><td colspan="8" class="empty" style="text-align:center;padding:36px">未找到匹配的权限节点</td></tr>'}
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
        await this.api('/permissions', { method: 'POST', body: JSON.stringify(d) });
        this.toast('权限节点已保存');
        this.closeModal();
        this.refresh();
      });
    },
    async deletePermission(id, name){
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
                <button class="primary tiny" type="button" onclick="app.editRoleModal()">新建系统角色</button>
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
                        <button class="tiny" onclick='app.editRoleModal(${JSON.stringify(r)})'>编辑权限</button>
                        ${r.id > 1 ? `<button class="tiny danger" onclick="app.deleteRole(${r.id},'${this.esc(r.name)}')">删除</button>` : ''}
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
      const perms = await this.api('/permissions');
      const selected = role.permissions ? (role.permissions === '["*"]' ? ['*'] : JSON.parse(role.permissions)) : [];
      const isAll = selected.includes('*');
      const selectedSet = new Set(selected.map(String));
      const modPairs = this.permModulePairs();
      const modLabels = Object.fromEntries(modPairs);
      const order = modPairs.map(([c]) => c);
      const groups = new Map();
      (perms || []).forEach((p) => {
        const mod = String(p.module || 'system');
        if (!groups.has(mod)) groups.set(mod, []);
        groups.get(mod).push(p);
      });
      // 按已知模块顺序，未知模块靠后
      const modKeys = [
        ...order.filter((m) => groups.has(m)),
        ...[...groups.keys()].filter((m) => !order.includes(m)).sort(),
      ];
      const groupsHtml = modKeys.map((mod) => {
        const list = groups.get(mod) || [];
        const label = modLabels[mod] || mod;
        const checkedN = list.filter((p) => isAll || selectedSet.has(String(p.id))).length;
        const chips = list.map((p) => `
          <label class="chip">
            <input type="checkbox" name="permissions[]" value="${p.id}" data-perm-mod="${this.esc(mod)}" ${isAll || selectedSet.has(String(p.id)) ? 'checked' : ''} onchange="app.syncRolePermGroupCheck('${this.esc(mod)}')">
            <span><b>${this.esc(p.name)}</b> <small class="muted">(${this.esc(p.code)})</small></span>
          </label>
        `).join('');
        return `<section class="rbac-perm-group" data-perm-group="${this.esc(mod)}">
          <div class="rbac-perm-group-head">
            <label class="rbac-perm-group-title">
              <input type="checkbox" class="rbac-perm-group-all" data-perm-mod="${this.esc(mod)}" ${checkedN === list.length && list.length ? 'checked' : ''} ${checkedN && checkedN < list.length ? 'data-indeterminate="1"' : ''} onchange="app.toggleRolePermGroup('${this.esc(mod)}', this.checked)">
              <b>${this.esc(label)}</b>
              <small class="muted">${this.esc(mod)} · ${checkedN}/${list.length}</small>
            </label>
            <div class="rbac-perm-group-actions">
              <button type="button" class="tiny ghost" onclick="app.toggleRolePermGroup('${this.esc(mod)}', true)">全选</button>
              <button type="button" class="tiny ghost" onclick="app.toggleRolePermGroup('${this.esc(mod)}', false)">清空</button>
            </div>
          </div>
          <div class="chip-row rbac-perm-group-chips">${chips}</div>
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
        document.querySelectorAll('#modal-form .rbac-perm-group-all[data-indeterminate="1"]').forEach((el) => {
          el.indeterminate = true;
        });
      });
    },
    toggleRolePermGroup(mod, on){
      const m = String(mod || '');
      document.querySelectorAll(`#modal-form input[name="permissions[]"][data-perm-mod="${m}"]`).forEach((el) => {
        el.checked = !!on;
      });
      this.syncRolePermGroupCheck(m);
    },
    syncRolePermGroupCheck(mod){
      const m = String(mod || '');
      const boxes = [...document.querySelectorAll(`#modal-form input[name="permissions[]"][data-perm-mod="${m}"]`)];
      const head = document.querySelector(`#modal-form .rbac-perm-group-all[data-perm-mod="${m}"]`);
      const tip = document.querySelector(`#modal-form .rbac-perm-group[data-perm-group="${m}"] .rbac-perm-group-title small`);
      if (!boxes.length) return;
      const n = boxes.filter((el) => el.checked).length;
      if (head) {
        head.checked = n === boxes.length;
        head.indeterminate = n > 0 && n < boxes.length;
      }
      if (tip) {
        const code = tip.textContent.split('·')[0]?.trim() || m;
        tip.textContent = `${code} · ${n}/${boxes.length}`;
      }
    },
    async deleteRole(id, name){
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
                <button class="primary tiny" type="button" onclick="app.editAdminUserModal()">添加管理员用户</button>
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
                    <th>所属系统角色</th>
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
                      <td><span class="badge ${u.role_id===1?'online':'running'}">${this.esc(u.role_name || (u.role_id===1?'超级管理员':'普通操作员'))}</span></td>
                      <td>${(u.childIds||[]).length ? `<span class="muted">${(u.childIds||[]).length} 个子级</span>` : '<span class="muted">-</span>'}</td>
                      <td>${this.badge(u.status ? 'online' : 'offline')}</td>
                      <td class="muted">${this.esc((u.created_at || '-').slice(0, 19))}</td>
                      <td>
                        <button class="tiny" onclick='app.editAdminUserModal(${JSON.stringify(u)})'>编辑信息</button>
                        ${u.id > 1 ? `<button class="tiny danger" onclick="app.deleteAdminUser(${u.id},'${this.esc(u.username)}')">删除</button>` : ''}
                      </td>
                    </tr>
                  `).join('') : '<tr><td colspan="8" class="empty" style="text-align:center;padding:36px">未找到匹配的管理员</td></tr>'}
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
    async editAdminUserModal(user = {}){
      const [roles, usersPack] = await Promise.all([
        this.api('/roles'),
        this.api('/admin-users?pageSize=200')
      ]);
      const allUsers = usersPack.items || [];
      const selfId = Number(user.id || 0);
      const selected = new Set((user.childIds || []).map(Number));
      // 超级管理员（role_id=1）不可成为他人下级
      const childOpts = allUsers.filter(u => Number(u.id) !== selfId && Number(u.role_id) !== 1);
      const childBoxes = childOpts.length
        ? `<div class="field full"><label>子级管理员（可多选）</label><div class="chip-row" style="max-height:180px;overflow:auto;padding:8px;border:1px solid #e2e8f0;border-radius:8px">${childOpts.map(u => {
            const id = Number(u.id);
            const label = this.esc(u.nickname || u.username) + ' · @' + this.esc(u.username);
            return `<label class="chip"><input type="checkbox" name="childId" value="${id}" ${selected.has(id)?'checked':''}> ${label}</label>`;
          }).join('')}</div><div class="muted" style="margin-top:6px">勾选后，该账号可在右下角切换到子账号查看其专属数据。超级管理员不可设为下级。</div></div>`
        : `<div class="field full"><div class="muted">暂无其他管理员可作为子级（超级管理员不可被选）</div></div>`;
      this.modal(user.id ? '编辑管理员账号' : '添加管理用户', `
        <div class="form-grid">
          <input type="hidden" name="id" value="${user.id || ''}">
          ${this.field('username', '登录用户名', user.username || '', 'text', true)}
          ${this.field('nickname', '显示昵称', user.nickname || '', 'text')}
          ${this.field('password', user.id ? '重置登录密码 (留空则保持原密码)' : '初始登录密码', '', 'password', !user.id)}
          ${this.selectRaw('role_id', '所属系统角色', roles.map(r => [r.id, r.name]), user.role_id || 1)}
          ${this.selectRaw('status', '账号状态', this.opt('userStatuses', [['1', '正常启用'], ['0', '禁用锁定']]), String(user.status ?? 1))}
          ${childBoxes}
        </div>
      `, async (d) => {
        const payload = {
          id: d.id ? Number(d.id) : undefined,
          username: d.username,
          nickname: d.nickname,
          password: d.password || '',
          role_id: Number(d.role_id || 1),
          status: Number(d.status ?? 1),
          childIds: [...document.querySelectorAll('#modal-form [name=childId]:checked')].map(x => Number(x.value))
        };
        if (!payload.id) delete payload.id;
        await this.api('/admin-users', { method: 'POST', body: JSON.stringify(payload) });
        this.toast('管理员账号已保存');
        this.closeModal();
        this.refresh();
      });
    },
    async deleteAdminUser(id, username){
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
                <button class="danger tiny" type="button" onclick="app.clearRbacLogs()">清空所有日志</button>
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
                <button class="ghost tiny" type="button" onclick="app.refreshMenuTree()">刷新顶部导航</button>
                <button class="primary tiny" type="button" onclick="app.editMenuModal()">添加菜单项</button>
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
                        <button class="tiny" onclick='app.editMenuModal(${JSON.stringify(m)})'>编辑</button>
                        <button class="tiny danger" onclick="app.deleteMenu(${m.id},'${this.esc(m.title)}')">删除</button>
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
      const ok = await this.ask(`确定要删除菜单【${title}】及其关联下级菜单吗？`, 'danger');
      if (!ok) return;
      await this.api(`/menus/${id}`, { method: 'DELETE' });
      this.toast('菜单项已删除');
      await this.loadNavigationMenus();
      this.refresh();
    },
    async refreshMenuTree(){
      await this.loadNavigationMenus();
      this.toast('顶部导航菜单树已刷新');
      this.refresh();
    },
  };
  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages["rbac"] = true;
})();
