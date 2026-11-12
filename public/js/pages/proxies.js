(function () {
  if (!window.app) throw new Error('app-core must load before pages/proxies.js');
  const __methods = {
    canViewProxies(){
      if(this.isOperatorRole())return false;
      return this.canAnyPermission('proxy.view','proxy.create','proxy.update','proxy.delete','proxy.import');
    },
    canCreateProxies(){
      if(this.isOperatorRole())return false;
      return this.canPermission('proxy.create');
    },
    canUpdateProxies(){
      if(this.isOperatorRole())return false;
      return this.canPermission('proxy.update');
    },
    canDeleteProxies(){
      if(this.isOperatorRole())return false;
      return this.canPermission('proxy.delete');
    },
    canEditProxies(){
      if(this.isOperatorRole())return false;
      return this.canCreateProxies()||this.canUpdateProxies()||this.canDeleteProxies();
    },
    canImportProxies(){
      if(this.isOperatorRole())return false;
      return this.canPermission('proxy.import')&&this.canAnyPermission('proxy.create','proxy.update');
    },
    canTestProxies(){
      if(this.isOperatorRole())return false;
      return this.canPermission('proxy.test');
    },
    canEditProxyRow(row){
      if(!this.canUpdateProxies())return false;
      const oid=Number(row?.owner_id||0);
      if(this.isEnterpriseCustomerRole())return oid>0&&oid===Number(this.authUser?.id||0);
      if(this.authUser?.isSuper||this.isOpsAdminRole())return oid<=0;
      return true;
    },
    canDeleteProxyRow(row){
      if(!this.canDeleteProxies())return false;
      const oid=Number(row?.owner_id||0);
      if(this.isEnterpriseCustomerRole())return oid>0&&oid===Number(this.authUser?.id||0);
      if(this.authUser?.isSuper||this.isOpsAdminRole())return oid<=0;
      return true;
    },
    proxyAccountBindLimit(){return 3},
    proxyAccountBindCount(row){
      const n=Number(row?.account_bind_count);
      return Number.isFinite(n)?n:0;
    },
    canAssignProxyRow(row){
      if(!this.canAssignProxies())return false;
      if(Number(row?.owner_id||0)>0)return false;
      return this.proxyAccountBindCount(row)<this.proxyAccountBindLimit();
    },
    proxyDeleteScopeHint(){
      if(this.authUser?.isSuper||this.isOpsAdminRole())return '仅删除列表中可管理的「未关联用户」代理，再结合下方条件筛选；不会动已分配给用户的代理。';
      if(this.isEnterpriseCustomerRole())return '仅删除已认领/归属本人的代理，再结合下方条件筛选；公共池中未关联代理不会被删除。';
      return '仅删除当前身份可管理的代理，再结合下方条件筛选。';
    },
    toggleProxyBatchMenu(e){
      e?.stopPropagation?.();
      this.toggleToolbarDropdown('#proxy-batch-menu', e);
    },
    proxyBatchBtn(label,onclick,opts={}){
      const iconMap={
        '复制代理':'copy',
        '代理检测':'wifi',
        '转移分组':'folder',
        '认领代理':'user-check',
        '分配代理':'users',
        '删除代理':'trash',
      };
      const iconName=iconMap[label]||'';
      const icon=iconName&&window.UI?.icon?UI.icon(iconName):'';
      const cls=opts.danger?' class="is-danger"':'';
      return `<button type="button"${cls} onclick="${onclick}" data-ui-decorated="${this.esc(label)}">${icon}<span class="btn-label">${this.esc(label)}</span></button>`;
    },
    async renderProxies(opts={}){
      if(!this.canView('proxies')&&!this.canViewProxies()) return this.renderPageDenied('当前角色无权查看代理IP池');
      const still=typeof opts.still==='function'?opts.still:()=>this.view==='proxies';
      document.querySelector('#content')?.classList.remove('chat-mode');
      if(this.proxyPane==='io'){await this.renderProxyIo(opts);return}
      // 只拉分组，避免 loadRefs 顺带打 materials/templates 拖死首屏
      await Promise.all([
        this.ensureGroups(),
        typeof this.ensureCountryOptions==='function'?this.ensureCountryOptions():Promise.resolve(),
      ]);
      if(!still())return;
      const gs=this.ownedGroups('proxy');
      const kw=encodeURIComponent(this.proxyKeyword||'');
      const st=encodeURIComponent(this.proxyStatus||'');
      this._proxyCountryChoices=await this.proxyCountryChoices();
      const d=await this.api(`/proxies?page=${this.proxyPage||1}&pageSize=20&keyword=${kw}&status=${st}${this.proxyGroupId?`&groupId=${encodeURIComponent(this.proxyGroupId)}`:''}${this.proxyCountryQs()}`);
      if(!still())return;
      this.proxies=d.items;
      const content=document.querySelector('#content');
      const headHtml=content?.querySelector('.page-head')?.outerHTML||(typeof this.pageHead==='function'?this.pageHead('proxies'):'')||'';
      content.innerHTML=`${headHtml}<div class="workspace proxy-workspace">
        <aside class="side-groups account-sidebar">
          <div class="sidebar-header"><h3>代理分组 <span class="count-pill">${gs.length}</span></h3>${this.groupSidebarAddBtn('proxy',this.canManageProxyGroups())}</div>
          <div class="group-list">
            ${this.proxyGroupSidebarHtml(d.total||d.items.length)}
          </div>
        </aside>
        <div class="proxy-main-wrapper account-main-panel">
          <div id="proxy-batch-panel" class="batch-panel hidden">
            <div class="batch-info">已选择 <strong id="proxy-selected-count">0</strong> 个代理</div>
            <div class="action-buttons">
              <div class="dropdown">
                <button class="ghost" type="button" onclick="app.toggleProxyBatchMenu(event)">批量操作 <span class="btn-arrow-down">▾</span></button>
                <div id="proxy-batch-menu" class="dropdown-menu align-left hidden">
                  ${this.proxyBatchBtn('复制代理','app.copySelectedProxies()')}
                  ${this.canTestProxies()?this.proxyBatchBtn('代理检测','app.batchTestProxies()'):''}
                  ${this.canUpdateProxies()?this.proxyBatchBtn('转移分组','app.batchMoveProxies()'):''}
                  ${this.canAssignProxies()?this.proxyBatchBtn('分配代理','app.batchAssignProxies()'):''}
                  ${this.canDeleteProxies()?this.proxyBatchBtn('删除代理','app.batchDeleteProxies()',{danger:true}):''}
                </div>
              </div>
            </div>
          </div>
          <div class="account-toolbar">
            <div class="action-buttons">
              ${this.canCreateProxies()?`<button class="primary" onclick="app.proxyModal()">添加IP</button>`:''}
              ${(this.canImportProxies()||this.canViewProxies())?`<button class="ghost" onclick="app.openProxyIo()">导入导出</button>`:''}
              ${this.canCreateProxies()?`<button class="ghost" onclick="app.fetchProxyModal()">获取云代理</button>`:''}
              ${this.canTestProxies()?`<button class="ghost" onclick="app.batchTestProxies()">代理检测</button>`:''}
              <button class="ghost" onclick="app.refresh()">刷新代理</button>
              ${this.canDeleteProxies()?`<button class="ghost" onclick="app.advancedDeleteProxies()">高级删除</button>`:''}
            </div>
            <div class="search-bar">
              <input id="proxy-search" class="input" placeholder="搜索名称或地址" value="${this.esc(this.proxyKeyword||'')}" onkeydown="if(event.key==='Enter')app.searchProxies()">
              <select id="proxy-status"><option value="">全部状态</option><option value="available" ${this.proxyStatus==='available'?'selected':''}>可用</option><option value="unavailable" ${this.proxyStatus==='unavailable'?'selected':''}>不可用</option><option value="unchecked" ${this.proxyStatus==='unchecked'?'selected':''}>未检测</option></select>
              ${this.proxyCountrySelectHtml()}
              <button class="primary" onclick="app.searchProxies()">查询</button>
              <button class="ghost" type="button" onclick="app.resetProxyFilters()">重置</button>
            </div>
          </div>
          <div class="table-container" id="proxy-table-host">${this.proxyTable(d.items)}</div>
          <div id="proxy-pager-host">${UI.pager(d,'proxyPage')}</div>
        </div>
      </div>`;
      this.bindProxyChecks();
    },
    /** 库里实际存在的国家（同一国家的不同写法归一到 ISO 码去重），供筛选下拉使用 */
    async proxyCountryChoices(){
      let rows=[];
      try{const g=await this.api('/proxies/geo');rows=g?.countries||[]}catch{}
      const map=new Map();
      for(const r of rows){
        const raw=String(r?.name||'').trim();
        if(!raw)continue;
        const iso=typeof this.resolveCountryIsoCode==='function'?this.resolveCountryIsoCode(raw):'';
        const key=iso||raw;
        if(!map.has(key)){
          const label=iso&&typeof this.countryDisplayLabel==='function'?this.countryDisplayLabel(iso,{withCode:true}):raw;
          map.set(key,{value:key,label,raws:[]});
        }
        map.get(key).raws.push(raw);
      }
      return [...map.values()].sort((a,b)=>String(a.label).localeCompare(String(b.label),'zh'));
    },
    proxyCountrySelectHtml(){
      const cur=String(this.proxyCountry||'');
      const opts=(this._proxyCountryChoices||[]).map(c=>`<option value="${this.esc(c.value)}" ${cur===c.value?'selected':''}>${this.esc(c.label)}</option>`).join('');
      return `<select id="proxy-country" title="按国家筛选"><option value="">全部国家</option><option value="none" ${cur==='none'?'selected':''}>未指定国家</option>${opts}</select>`;
    },
    /** 当前国家筛选对应的查询串：把该国家在库里的所有写法用 | 拼起来 */
    proxyCountryQs(){
      const v=String(this.proxyCountry||'').trim();
      if(!v)return '';
      if(v==='none')return '&country=none';
      const choice=(this._proxyCountryChoices||[]).find(c=>c.value===v);
      const names=new Set([v,...(choice?.raws||[])]);
      if(typeof this.countryProxyNames==='function'){
        for(const n of this.countryProxyNames(v))if(n)names.add(String(n));
      }
      return '&country='+encodeURIComponent([...names].join('|'));
    },
    resetProxyFilters(){this.proxyPage=1;this.proxyGroupId='';this.proxyKeyword='';this.proxyStatus='';this.proxyCountry='';this.refresh()},
    bindProxyChecks(){
      const update=()=>{
        const n=document.querySelectorAll('.proxy-check:checked').length;
        document.querySelector('#proxy-selected-count')&&(document.querySelector('#proxy-selected-count').textContent=String(n));
        document.querySelector('#proxy-batch-panel')?.classList.toggle('hidden',n===0);
      };
      document.querySelectorAll('.proxy-check').forEach(el=>el.addEventListener('change',update));
      update();
    },
    async copySelectedProxies(){
      const ids=[...document.querySelectorAll('.proxy-check:checked')].map(x=>Number(x.value));
      if(!ids.length){this.toast('请先勾选要复制的代理（不会默认导出全部）',true);return}
      try{
        const r=await this.api('/proxies/export-strings',{method:'POST',body:JSON.stringify({proxyIds:ids})});
        if(!r.count){this.toast('没有可复制的代理',true);return}
        try{await navigator.clipboard.writeText(r.text);this.toast(`已复制 ${r.count} 条（host:port[:user:pass]）`)}
        catch{this.toast(r.text)}
      }catch(e){this.toast(e.message,true)}
    },
    filterProxyGroup(id){this.proxyGroupId=id?String(id):'';this.proxyPage=1;this.refresh()},
    toggleProxyGroupOps(id,e){
      e?.stopPropagation?.();
      e?.preventDefault?.();
      const target=document.querySelector('#proxy-group-ops-'+id);
      const willShow=target?.classList.contains('hidden');
      document.querySelectorAll('.dropdown-menu').forEach((el)=>{
        el.classList.add('hidden');
        if(window.UI) UI.restoreMenu(el);
      });
      if(target && willShow){
        target.classList.add('ops-menu');
        target.classList.remove('hidden');
        const btn=e?.currentTarget||target.closest('.ops-dropdown')?.querySelector('button');
        if(window.UI) UI.liftMenu(target, btn, {side:'left'});
      }
    },
    toggleProxyGroupFold(id,ev){
      if(ev){ev.stopPropagation();ev.preventDefault()}
      this.proxyGroupFold=this.proxyGroupFold||{};
      const k=String(id);
      this.proxyGroupFold[k]=!this.proxyGroupFold[k];
      this.refresh();
    },
    proxyGroupSidebarHtml(total){
      const all=(this.groups||[]).filter(g=>g.type==='proxy');
      const roots=all.filter(g=>!g.parent_id);
      const kids=all.filter(g=>g.parent_id);
      const fold=this.proxyGroupFold||{};
      const canManage=this.canManageProxyGroups();
      const menuItems=(g,isChild)=>{
        const items=[];
        if(canManage) items.push(`<button type="button" onclick="event.stopPropagation();app.editGroup(${g.id})">编辑分组</button>`);
        if(canManage && !isChild) items.push(`<button type="button" onclick="event.stopPropagation();app.groupModal('proxy',{parent_id:${g.id}})">添加子组</button>`);
        if(canManage) items.push(`<button type="button" class="is-danger" onclick="event.stopPropagation();app.remove('/groups/${g.id}','代理分组')">删除分组</button>`);
        return items.join('');
      };
      const item=(g,isChild)=>{
        const active=String(this.proxyGroupId)===String(g.id);
        const children=kids.filter(k=>Number(k.parent_id)===Number(g.id));
        const hasKids=!isChild && children.length>0;
        const folded=!!fold[String(g.id)];
        const foldBtn=hasKids?`<button type="button" class="group-fold-btn" title="${folded?'展开':'收起'}" onclick="app.toggleProxyGroupFold(${g.id},event)">${folded?'▸':'▾'}</button>`:'<span class="group-fold-spacer"></span>';
        const menu=menuItems(g,isChild);
        const ops=menu?`<div class="ops-dropdown group-ops-dropdown"><button type="button" class="group-kebab" title="更多" onclick="app.toggleProxyGroupOps(${g.id},event)">⋮</button><div id="proxy-group-ops-${g.id}" class="dropdown-menu ops-menu hidden">${menu}</div></div>`:'';
        return `<div class="group-item-flat ${isChild?'is-child':''} ${active?'active':''}">
          <button type="button" class="group-item-main" onclick="app.filterProxyGroup(${g.id})">${foldBtn}<span class="group-item-name">${this.esc(g.name)}</span><span class="group-item-count">${g.member_count||0}</span></button>${ops}
        </div>${hasKids && !folded ? children.map(c=>item(c,true)).join('') : ''}`;
      };
      const rootHtml=roots.map(r=>item(r,false)).join('');
      const orphan=kids.filter(k=>!roots.some(r=>Number(r.id)===Number(k.parent_id)));
      const allActive=!this.proxyGroupId;
      return `<div class="group-item-flat ${allActive?'active':''}">
          <button type="button" class="group-item-main" onclick="app.filterProxyGroup('')"><span class="group-fold-spacer"></span><span class="group-item-name">全部代理</span><span class="group-item-count">${total||0}</span></button>
        </div>${rootHtml}${orphan.map(c=>item(c,true)).join('')}`;
    },
    proxyAddrLabel(x){
      const proto=String(x?.protocol||'http').toLowerCase();
      const host=String(x?.host||'').trim();
      const port=Number(x?.port||0);
      if(!host||!port)return '-';
      return `${proto}://${host}:${port}`;
    },
    proxyAddrCell(x,canWrite){
      const addr=this.proxyAddrLabel(x);
      const country=String(x.country||'').trim();
      const countryLabel=typeof this.countryDisplayLabel==='function'?this.countryDisplayLabel(country):country;
      const group=String(x.group_name||'').trim()||'未分组';
      const countryLine=country
        ?(canWrite
          ?`<div class="proxy-addr-country" title="点击编辑国家" onclick="event.stopPropagation();app.editProxyCountry(${x.id},${JSON.stringify(country)})">${this.esc(countryLabel)}</div>`
          :`<div class="proxy-addr-country muted">${this.esc(countryLabel)}</div>`)
        :'';
      const main=canWrite
        ?`<div class="proxy-addr-main" title="点击修改 IP" onclick="event.stopPropagation();app.editProxyAddress(${x.id})">${this.esc(addr)}</div>`
        :`<div class="proxy-addr-main">${this.esc(addr)}</div>`;
      const sub=`<div class="proxy-addr-meta muted">${countryLine}<div class="proxy-addr-group">${this.esc(group)}</div></div>`;
      return `<td><div class="proxy-addr-cell">${main}${sub}</div></td>`;
    },
    proxyTable(rows){
      if(!rows.length)return '<div class="empty">还没有符合条件的代理</div>';
      return `<table><thead><tr><th><input type="checkbox" onchange="app.toggleAllProxies(this.checked)" title="全选"></th><th>地址</th><th>状态</th><th>测速速度</th><th>使用次数</th><th>创建时间</th><th>操作</th></tr></thead><tbody>${rows.map(x=>{
        const canWrite=this.canEditProxyRow(x);
        const canDel=this.canDeleteProxyRow(x);
        const more=[];
        more.push(`<button type="button" onclick="app.viewProxyAccountBindings(${x.id})">查看明细</button>`);
        more.push(`<button type="button" onclick="app.copyProxy(${x.id})">复制</button>`);
        if(this.canTestProxies())more.push(`<button type="button" onclick="app.testProxy(${x.id})">检测</button>`);
        if(this.canAssignProxyRow(x))more.push(`<button type="button" onclick="app.assignProxyOwner(${x.id})">分配</button>`);
        const editBtn=canWrite?`<button class="tiny" type="button" title="编辑" onclick='app.editProxyModal(${JSON.stringify(x)})'>编辑</button>`:'';
        const delBtn=canDel?`<button class="tiny danger" type="button" title="删除" onclick="app.remove('/proxies/${x.id}','代理')">删除</button>`:'';
        const moreBtn=more.length?`<div class="ops-dropdown proxy-ops-dropdown"><button class="tiny" type="button" title="更多" onclick="app.toggleProxyOps(${x.id},event)">…</button><div id="proxy-ops-${x.id}" class="dropdown-menu ops-menu hidden">${more.join('')}</div></div>`:'';
        const speed=x.latency_ms!=null&&x.latency_ms!==''?`${x.latency_ms} ms`:'-';
        return `<tr><td><input class="proxy-check" type="checkbox" value="${x.id}"></td>${this.proxyAddrCell(x,canWrite)}<td>${this.badge(x.status||'unchecked')}</td><td>${speed}</td><td>${x.use_count||0}</td><td>${this.esc((x.created_at||'').slice(0,19)||'-')}</td><td><div class="task-ops-cell proxy-ops-cell">${editBtn}${delBtn}${moreBtn}</div></td></tr>`;
      }).join('')}</tbody></table>`;
    },
    toggleProxyOps(id,e){
      e?.stopPropagation?.();
      const target=document.querySelector('#proxy-ops-'+id);
      const willShow=target?.classList.contains('hidden');
      document.querySelectorAll('.dropdown-menu').forEach(el=>{
        el.classList.add('hidden');
        if(window.UI) UI.restoreMenu(el);
      });
      if(target && willShow){
        target.classList.add('ops-menu');
        target.classList.remove('hidden');
        const btn=e?.currentTarget||target.closest('.ops-dropdown')?.querySelector('button');
        if(window.UI) UI.liftMenu(target, btn, {side:'left'});
      }
    },
    selectedProxyIds(){return [...document.querySelectorAll('.proxy-check:checked')].map(x=>Number(x.value))},
    async searchProxies(){this.proxyKeyword=document.querySelector('#proxy-search')?.value||'';this.proxyStatus=document.querySelector('#proxy-status')?.value||'';this.proxyCountry=document.querySelector('#proxy-country')?.value||'';this.proxyPage=1;this.refresh()},
    batchMoveProxies(){if(!this.canUpdateProxies()){this.toast('当前角色无权修改代理',true);return}const ids=this.selectedProxyIds();if(!ids.length){this.toast('请先选择要转移的代理',true);return}const gs=this.ownedGroups('proxy');this.modal('批量转移代理分组',`<div class="form-grid">${this.select('groupId','目标代理分组',gs)}<div class="field full"><div class="muted">已选择 ${ids.length} 个代理。目标分组留空表示移出分组。</div></div></div>`,async d=>{await this.api('/proxies/batch-move',{method:'POST',body:JSON.stringify({proxyIds:ids,groupId:d.groupId?Number(d.groupId):null})});this.toast(`已转移 ${ids.length} 个代理`);this.closeModal();this.invalidateProxyCatalog();await this.loadRefs({force:true});this.refresh()})},
    async batchDeleteProxies(){if(!this.canDeleteProxies()){this.toast('当前角色无权删除代理',true);return}const ids=this.selectedProxyIds();if(!ids.length){this.toast('请先选择要删除的代理',true);return}if(!(await this.ask(`确定删除选中的 ${ids.length} 个代理吗？绑定这些代理的账号将自动变为未绑定代理。`)))return;try{const r=await this.api('/proxies/batch-delete',{method:'POST',body:JSON.stringify({proxyIds:ids})});this.toast(`已删除 ${r.deleted} 个代理，解除 ${r.unboundAccounts} 个账号的代理绑定`);this.invalidateProxyCatalog();await this.loadRefs({force:true});this.refresh()}catch(e){this.toast(e.message,true)}},
    canAssignProxies(){
      if(this.isOperatorRole()||this.isEnterpriseCustomerRole())return false;
      return !!(this.authUser?.isSuper||this.isOpsAdminRole());
    },
    async loadProxyAssignTargets(){
      try{
        const rows=await this.api('/auth/proxy-assign-targets');
        return (rows||[]).map((u)=>({
          id:Number(u.id),
          label:(u.nickname||u.username||('用户#'+u.id))+' · @'+(u.username||''),
          roleType:u.roleType||'',
        }));
      }catch{
        return [];
      }
    },
    async assignProxyOwner(id){return this.batchAssignProxies([Number(id)])},
    async viewProxyAccountBindings(proxyId){
      const pid=Number(proxyId||0);
      if(!pid){this.toast('无效代理',true);return}
      try{
        const pack=await this.api(`/proxies/${pid}/accounts`);
        this._proxyBindDraft={proxyId:pid,keyword:'',suggest:[]};
        this.openProxyBindingModal(pack);
      }catch(e){this.toast(e.message||'加载绑定明细失败',true)}
    },
    openProxyBindingModal(pack){
      const pid=Number(pack?.proxy?.id||this._proxyBindDraft?.proxyId||0);
      const limit=Number(pack?.limit||this.proxyAccountBindLimit());
      const bound=Number(pack?.bound!=null?pack.bound:((pack?.items||[]).length||0));
      const remaining=Math.max(0,Number(pack?.remaining!=null?pack.remaining:(limit-bound)));
      const canEdit=!!pack?.canEdit;
      const proxy=pack?.proxy||{};
      const addr=this.proxyAddrLabel(proxy)||(proxy.name||('#'+pid));
      const items=pack?.items||[];
      this._proxyBindDraft={
        proxyId:pid,
        keyword:this._proxyBindDraft?.keyword||'',
        boundIds:items.map((a)=>Number(a.id)).filter(Boolean),
      };
      const rows=items.length
        ?items.map((a)=>`<tr>
            <td><b>${this.esc(a.username||('-'))}</b>${a.nickname?`<div class="muted">${this.esc(a.nickname)}</div>`:''}</td>
            <td>${this.esc(a.groupName||'未分组')}</td>
            <td>${this.badge(a.loginStatus||'-')}</td>
            <td>${canEdit?`<button class="tiny danger" type="button" onclick="app.unbindProxyAccount(${pid},${a.id})">解绑</button>`:'<span class="muted">-</span>'}</td>
          </tr>`).join('')
        :`<tr><td colspan="4" class="empty">暂无绑定账号</td></tr>`;
      const addBlock=canEdit
        ?`<div class="field full" style="margin-top:14px;border-top:1px solid var(--line);padding-top:12px">
            <label>添加绑定 <span class="muted">（还可绑定 ${remaining} 个，上限 ${limit}）</span></label>
            ${remaining>0
              ?`<div style="display:flex;gap:8px;align-items:center;margin-top:6px">
                  <input id="proxy-bind-search" class="input" type="search" placeholder="搜索账号用户名 / 昵称 / ID" value="${this.esc(this._proxyBindDraft.keyword||'')}"
                    oninput="app.searchProxyBindAccounts(${pid},this.value)" style="flex:1">
                </div>
                <div id="proxy-bind-suggest" class="combo-menu" style="margin-top:6px"></div>`
              :`<div class="muted" style="margin-top:6px">已达绑定上限，请先解绑后再添加。</div>`}
          </div>`
        :`<div class="muted" style="margin-top:12px">当前角色仅可查看绑定明细，无法解绑或添加。</div>`;
      const body=`<div class="form-grid">
        <div class="field full"><div class="muted">代理：${this.esc(addr)} · 已绑定 <b>${bound}</b> / ${limit}</div></div>
        <div class="field full"><div class="table-container"><table>
          <thead><tr><th>账号</th><th>分组</th><th>登录</th><th style="width:90px">操作</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div></div>
        ${addBlock}
      </div>`;
      this.modal(`代理绑定明细`,body,async()=>{},false,{hideSubmit:true,wide:true});
      if(canEdit&&remaining>0&&this._proxyBindDraft.keyword){
        this.searchProxyBindAccounts(pid,this._proxyBindDraft.keyword);
      }
    },
    async refreshProxyBindingModal(proxyId){
      const pid=Number(proxyId||this._proxyBindDraft?.proxyId||0);
      if(!pid)return;
      try{
        const pack=await this.api(`/proxies/${pid}/accounts`);
        this.openProxyBindingModal(pack);
      }catch(e){this.toast(e.message||'刷新失败',true)}
    },
    searchProxyBindAccounts(proxyId,keyword){
      clearTimeout(this._proxyBindSearchTimer);
      this._proxyBindDraft=this._proxyBindDraft||{proxyId:Number(proxyId),boundIds:[]};
      this._proxyBindDraft.keyword=String(keyword||'');
      this._proxyBindSearchTimer=setTimeout(()=>this._doSearchProxyBindAccounts(proxyId,keyword),280);
    },
    async _doSearchProxyBindAccounts(proxyId,keyword){
      const box=document.querySelector('#proxy-bind-suggest');
      if(!box)return;
      const kw=String(keyword||'').trim();
      if(!kw){box.innerHTML='';return}
      const pid=Number(proxyId||0);
      const pack=await this.api(`/accounts?page=1&pageSize=20&keyword=${encodeURIComponent(kw)}`).catch(()=>({items:[]}));
      const boundIds=new Set((this._proxyBindDraft?.boundIds||[]).map(Number));
      const items=(pack.items||[]).filter((a)=>!boundIds.has(Number(a.id)));
      if(!items.length){
        box.innerHTML=`<div class="muted" style="padding:8px">无匹配账号，或均已绑定</div>`;
        return;
      }
      box.innerHTML=`<div class="combo-list" style="border:1px solid var(--line);border-radius:8px;background:#fff;max-height:200px;overflow:auto">
        ${items.map((a)=>{
          const label=`${a.username||('#'+a.id)}${a.nickname?` · ${a.nickname}`:''}`;
          return `<button type="button" class="combo-item" style="display:block;width:100%;text-align:left;padding:8px 10px;border:0;background:transparent;cursor:pointer"
            onclick="app.bindProxyAccount(${pid},${a.id})">${this.esc(label)}</button>`;
        }).join('')}
      </div>`;
    },
    async bindProxyAccount(proxyId,accountId){
      const pid=Number(proxyId||0);
      const aid=Number(accountId||0);
      if(!pid||!aid)return;
      try{
        const r=await this.api(`/proxies/${pid}/bind-accounts`,{method:'POST',body:JSON.stringify({accountIds:[aid]})});
        this.toast(r?.bound?`已绑定 ${r.bound} 个账号`:(r?.message||'已处理'));
        if(this._proxyBindDraft)this._proxyBindDraft.keyword='';
        this.invalidateProxyCatalog();
        await this.refreshProxyBindingModal(pid);
        this.refresh();
      }catch(e){this.toast(e.message||'绑定失败',true)}
    },
    async unbindProxyAccount(proxyId,accountId){
      const pid=Number(proxyId||0);
      const aid=Number(accountId||0);
      if(!pid||!aid)return;
      if(!(await this.ask('确定解绑该账号与此代理？')))return;
      try{
        await this.api(`/proxies/${pid}/unbind-accounts`,{method:'POST',body:JSON.stringify({accountIds:[aid]})});
        this.toast('已解绑');
        this.invalidateProxyCatalog();
        await this.refreshProxyBindingModal(pid);
        this.refresh();
      }catch(e){this.toast(e.message||'解绑失败',true)}
    },
    async batchAssignProxies(presetIds){
      if(!this.canAssignProxies()){this.toast('当前角色无权分配代理',true);return}
      const ids=Array.isArray(presetIds)&&presetIds.length?presetIds.map(Number):this.selectedProxyIds();
      if(!ids.length){this.toast('请先勾选要分配的代理',true);return}
      const bindLimit=this.proxyAccountBindLimit();
      const unassigned=ids.filter((id)=>{
        const row=(this.proxies||[]).find((p)=>Number(p.id)===Number(id));
        if(!row)return false;
        if(Number(row.owner_id||0)>0)return false;
        return this.proxyAccountBindCount(row)<bindLimit;
      });
      if(!unassigned.length){this.toast(`仅可分配未关联用户且绑定账号少于${bindLimit}个的代理`,true);return}
      const skipped=ids.length-unassigned.length;
      const targets=await this.loadProxyAssignTargets();
      if(!targets.length){this.toast('没有可分配的运营专员或企业客户',true);return}
      const pairs=targets.map((t)=>[String(t.id),t.label]);
      const skipHint=skipped?`（已跳过 ${skipped} 个已关联或已满额）`:'';
      this.modal('分配代理关联人员',`<div class="form-grid"><div class="field full"><div class="muted">已选 ${unassigned.length} 个可分配代理${skipHint}。仅可分配给运营专员或企业客户。</div></div>${this.selectRaw('ownerId','关联人员',pairs,'',{blankLabel:'请选择关联人员'})}</div>`,async d=>{
        const ownerId=Number(d.ownerId||0);
        if(!ownerId)throw new Error('请选择关联人员');
        const r=await this.api('/proxies/batch-assign-owner',{method:'POST',body:JSON.stringify({proxyIds:unassigned,ownerId})});
        this.toast(r?.ownerName?`已分配 ${r.updated} 个代理给 ${r.ownerName}`:`已分配 ${r.updated||unassigned.length} 个代理`);
        this.closeModal();
        this.invalidateProxyCatalog();
        await this.loadRefs({force:true});
        this.refresh();
      });
    },
    openProxyIo(tab){
      if(!this.canImportProxies()&&tab==='import'){this.toast('当前角色无权导入代理',true);return}
      this.proxyPane='io';
      this.proxyIoTab=tab==='import'?'import':'export';
      if(!Array.isArray(this.proxyIoFields)||!this.proxyIoFields.length)this.proxyIoFields=this.defaultProxyIoFields();
      this.refresh();
    },
    closeProxyIo(){this.proxyPane='list';this.refresh()},
    switchProxyIoTab(tab){this.proxyIoTab=tab==='import'?'import':'export';this.refresh()},
    defaultProxyIoFields(){
      return [
        {key:'id',label:'ID',on:true},
        {key:'name',label:'名称',on:true},
        {key:'protocol',label:'协议',on:true},
        {key:'host',label:'主机',on:true},
        {key:'port',label:'端口',on:true},
        {key:'username',label:'用户名',on:true},
        {key:'password',label:'密码',on:false},
        {key:'proxy_string',label:'代理文本',on:true},
        {key:'country',label:'国家',on:true},
        {key:'group_name',label:'分组',on:true},
        {key:'status',label:'状态',on:true},
        {key:'latency_ms',label:'测速速度ms',on:false},
        {key:'use_count',label:'使用次数',on:false},
        {key:'egress_ip',label:'出口IP',on:false},
        {key:'created_at',label:'创建时间',on:true},
        {key:'last_checked_at',label:'检测时间',on:false},
        {key:'owner_id',label:'关联用户ID',on:false},
        {key:'owner_label',label:'关联用户',on:true},
      ];
    },
    async renderProxyIo(opts={}){
      const still=typeof opts.still==='function'?opts.still:()=>this.view==='proxies';
      const tab=this.proxyIoTab||'export';
      if(!Array.isArray(this.proxyIoFields)||!this.proxyIoFields.length)this.proxyIoFields=this.defaultProxyIoFields();
      const f=this.proxyIoFilter||{};
      await Promise.all([
        this.ensureGroups(),
        typeof this.ensureCountryOptions==='function'?this.ensureCountryOptions():Promise.resolve(),
      ]);
      if(!still())return;
      const gs=this.ownedGroups('proxy');
      document.querySelector('#content').innerHTML=`<div class="panel task-io-panel proxy-io-panel">
        <div class="task-io-head">
          <button class="ghost" type="button" onclick="app.closeProxyIo()">← 返回代理列表</button>
          <div class="task-io-title-row">
            <b class="task-io-title">导入导出</b>
            <span class="muted">导出可自定义字段；导入支持 CSV 模板或逐行文本</span>
          </div>
        </div>
        <div class="subtabs" style="margin-bottom:14px">
          <button type="button" class="${tab==='export'?'active':''}" onclick="app.switchProxyIoTab('export')">导出数据</button>
          <button type="button" class="${tab==='import'?'active':''}" onclick="app.switchProxyIoTab('import')">导入数据</button>
        </div>
        ${tab==='import'?this.proxyIoImportBody(gs):this.proxyIoExportBody(f,gs)}
      </div>`;
    },
    proxyIoExportBody(f,gs){
      f=f||{};gs=gs||[];
      const statusOpts=[['','全部状态'],['available','可用'],['unavailable','不可用'],['unchecked','未检测']];
      const protoOpts=[['','全部协议'],['http','HTTP'],['https','HTTPS'],['socks5','SOCKS5']];
      const fields=this.proxyIoFields||[];
      return `<div class="task-io-export">
        <div class="form-grid task-io-filters">
          <div class="field"><label>关键词</label><input id="pio-keyword" class="input" type="search" placeholder="名称 / 主机 / 国家" value="${this.esc(f.keyword||'')}"></div>
          <div class="field"><label>状态</label><select id="pio-status" class="input">${statusOpts.map(([v,n])=>`<option value="${this.esc(v)}" ${String(f.status||'')===v?'selected':''}>${this.esc(n)}</option>`).join('')}</select></div>
          <div class="field"><label>协议</label><select id="pio-protocol" class="input">${protoOpts.map(([v,n])=>`<option value="${this.esc(v)}" ${String(f.protocol||'')===v?'selected':''}>${this.esc(n)}</option>`).join('')}</select></div>
          <div class="field"><label>分组</label><select id="pio-group" class="input"><option value="">全部分组</option><option value="none" ${f.groupId==='none'?'selected':''}>未分组</option>${gs.map(g=>`<option value="${g.id}" ${String(f.groupId||'')===String(g.id)?'selected':''}>${this.esc(g.name)}</option>`).join('')}</select></div>
          ${typeof this.countrySelectField==='function'
            ?this.countrySelectField('国家','country',f.country||'',{id:'pio-country',blankLabel:'全部国家',allowCustom:true})
            :`<div class="field"><label>国家</label><input id="pio-country" class="input" placeholder="可空" value="${this.esc(f.country||'')}"></div>`}
          <div class="field"><label>ID 最小</label><input id="pio-id-min" class="input" type="number" min="0" placeholder="可空" value="${this.esc(f.idMin||'')}"></div>
          <div class="field"><label>ID 最大</label><input id="pio-id-max" class="input" type="number" min="0" placeholder="可空" value="${this.esc(f.idMax||'')}"></div>
          <div class="field"><label>仅勾选代理</label><select id="pio-selected-only" class="input"><option value="0">否（按筛选）</option><option value="1" ${f.selectedOnly?'selected':''}>是（列表页勾选）</option></select></div>
        </div>
        <div class="field full" style="margin:12px 0 8px"><label>导出字段与表头（勾选并自定义表头名）</label></div>
        <div class="table-container task-io-fields-table" style="margin-bottom:14px">
          <table><thead><tr><th style="width:56px">导出</th><th>字段</th><th>表头名</th></tr></thead>
          <tbody>${fields.map((x,i)=>`<tr>
            <td><input type="checkbox" class="pio-field-on" data-idx="${i}" ${x.on?'checked':''}></td>
            <td><code>${this.esc(x.key)}</code></td>
            <td><input class="input pio-field-label" data-idx="${i}" value="${this.esc(x.label||'')}" style="width:100%;max-width:280px"></td>
          </tr>`).join('')}</tbody></table>
        </div>
        <div class="action-bar">
          <button class="primary" type="button" onclick="app.submitProxyIoExport()">导出</button>
          <button class="ghost" type="button" onclick="app.resetProxyIoExport()">重置筛选与字段</button>
        </div>
      </div>`;
    },
    proxyIoImportBody(gs){
      gs=gs||[];
      const mode=this.proxyIoImportMode||'csv';
      return `<div class="task-io-import">
        <div class="subtabs" style="margin-bottom:12px">
          <button type="button" class="${mode==='csv'?'primary':'ghost'}" onclick="app.proxyIoImportMode='csv';app.refresh()">CSV 模板</button>
          <button type="button" class="${mode==='lines'?'primary':'ghost'}" onclick="app.proxyIoImportMode='lines';app.refresh()">逐行文本</button>
        </div>
        ${mode==='lines'?this.proxyIoImportLinesBody(gs):this.proxyIoImportCsvBody(gs)}
      </div>`;
    },
    proxyIoImportCsvBody(gs){
      gs=gs||[];
      return `
        <div class="shell-note" style="margin:0 0 14px">
          <b>CSV 模板说明：</b>使用下方模板表头；每行一条代理。<br>
          列：<code>protocol,host,port,username,password,name,country,group_name</code>；也可增加 <code>proxy_string</code> 列。
        </div>
        <div class="action-bar" style="margin-bottom:12px">
          <button class="primary" type="button" onclick="app.downloadProxyImportTemplate()">下载导入模板</button>
          <label class="ghost" style="display:inline-flex;align-items:center;padding:8px 14px;cursor:pointer;border:1px solid #dcdfe6;border-radius:4px">选择文件<input type="file" accept=".txt,.csv,text/plain,text/csv" hidden onchange="app.loadProxyImportFile(this)"></label>
        </div>
        <div class="form-grid">
          <div class="field"><label>默认分组（行未填时）</label><select id="pio-import-group" class="input"><option value="">不指定</option>${gs.map(g=>`<option value="${g.id}">${this.esc(g.name)}</option>`).join('')}</select></div>
          <div class="field full"><label>CSV 内容</label><textarea id="pio-import-content" class="input" rows="12" placeholder="protocol,host,port,username,password,name,country,group_name&#10;http,1.2.3.4,8080,user,pass,美西01,US,默认分组&#10;socks5,5.6.7.8,1080,,,东京节点,JP,&#10;&#10;也可使用 proxy_string 列，例如：&#10;protocol,host,port,username,password,name,country,group_name,proxy_string&#10;,,,,,,,美西02,US,,http://user:pass@1.2.3.4:8080"></textarea></div>
        </div>
        <div class="action-bar" style="margin-top:14px">
          <button class="primary" type="button" onclick="app.submitProxyIoImport()">开始导入</button>
        </div>
        <div id="pio-import-result" class="muted" style="margin-top:12px"></div>`;
    },
    proxyIoImportLinesBody(gs){
      gs=gs||[];
      return `
        <div class="shell-note" style="margin:0 0 14px">
          兼容原「批量导入」格式：每行一个代理，支持 host:port、host:port:user:pass、user:pass@host:port、带协议 URL；空行与 # 注释忽略。
        </div>
        <div class="form-grid">
          <div class="field"><label>默认协议</label><select id="pio-lines-protocol" class="input"><option value="http">HTTP</option><option value="https">HTTPS</option><option value="socks5">SOCKS5</option></select></div>
          <div class="field"><label>代理分组</label><select id="pio-lines-group" class="input"><option value="">不指定</option>${gs.map(g=>`<option value="${g.id}">${this.esc(g.name)}</option>`).join('')}</select></div>
          ${typeof this.countrySelectField==='function'
            ?this.countrySelectField('国家/地区（可选）','country','',{id:'pio-lines-country',blankLabel:'不指定'})
            :`<div class="field"><label>国家/地区（可选）</label><input id="pio-lines-country" class="input" placeholder="可空"></div>`}
          <div class="field full"><label>代理列表</label><textarea id="pio-lines-content" class="input" rows="12" placeholder="每行一个代理，例如：&#10;1.2.3.4:8080&#10;1.2.3.4:8080:user:pass&#10;user:pass@1.2.3.4:8080&#10;http://user:pass@1.2.3.4:8080&#10;socks5://1.2.3.4:1080&#10;# 注释行会被忽略"></textarea></div>
        </div>
        <div class="action-bar" style="margin-top:14px">
          <button class="primary" type="button" onclick="app.submitProxyLinesImport()">开始导入</button>
        </div>
        <div id="pio-lines-result" class="muted" style="margin-top:12px"></div>`;
    },
    collectProxyIoExportForm(){
      const fields=(this.proxyIoFields||[]).map((x,i)=>{
        const on=!!document.querySelector('.pio-field-on[data-idx="'+i+'"]')?.checked;
        const label=document.querySelector('.pio-field-label[data-idx="'+i+'"]')?.value ?? x.label;
        return {...x,on,label:String(label||x.key).trim()||x.key};
      });
      this.proxyIoFields=fields;
      this.proxyIoFilter={
        keyword:document.querySelector('#pio-keyword')?.value||'',
        status:document.querySelector('#pio-status')?.value||'',
        protocol:document.querySelector('#pio-protocol')?.value||'',
        groupId:document.querySelector('#pio-group')?.value||'',
        country:document.querySelector('#pio-country')?.value||'',
        idMin:document.querySelector('#pio-id-min')?.value||'',
        idMax:document.querySelector('#pio-id-max')?.value||'',
        selectedOnly:document.querySelector('#pio-selected-only')?.value==='1',
      };
      return {filter:this.proxyIoFilter,fields};
    },
    resetProxyIoExport(){
      this.proxyIoFilter={};
      this.proxyIoFields=this.defaultProxyIoFields();
      this.refresh();
    },
    async submitProxyIoExport(){
      const {filter,fields}=this.collectProxyIoExportForm();
      const selected=fields.filter(x=>x.on);
      if(!selected.length){this.toast('请至少勾选一个导出字段',true);return}
      const q=new URLSearchParams({fields:selected.map(x=>x.key).join(',')});
      q.set('headers',JSON.stringify(Object.fromEntries(selected.map(x=>[x.key,x.label]))));
      if(filter.selectedOnly){
        const ids=this.selectedProxyIds?.()||[];
        if(!ids.length){this.toast('请先在代理列表勾选要导出的代理',true);return}
        q.set('ids',ids.join(','));
      }else{
        if(filter.keyword)q.set('keyword',filter.keyword);
        if(filter.status)q.set('status',filter.status);
        if(filter.protocol)q.set('protocol',filter.protocol);
        if(filter.groupId)q.set('groupId',filter.groupId);
        if(filter.country)q.set('country',filter.country);
        if(filter.idMin)q.set('idMin',filter.idMin);
        if(filter.idMax)q.set('idMax',filter.idMax);
      }
      try{
        const headers=this.authToken?{Authorization:'Bearer '+this.authToken}:{};
        const acting=this.getActingAsId();if(acting)headers['X-Acting-As']=String(acting);
        const base=window.TKSWARM_API_BASE||window.__TKSWARM_CONFIG__?.defaultApiBase||'';
        const r=await fetch(base+'/api/proxies/export.csv?'+q.toString(),{headers});
        if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.message||'导出失败')}
        const text=await r.text();
        const lines=String(text||'').split(/\r?\n/).filter(x=>String(x).trim());
        if(lines.length<=1){this.toast('没有可导出的代理',true);return}
        const blob=new Blob([text],{type:'text/csv;charset=utf-8'});
        const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;
        a.download='tkswarm-proxies.csv';a.click();URL.revokeObjectURL(url);
        this.toast('代理已导出');
      }catch(e){this.toast(e.message,true)}
    },
    async downloadProxyImportTemplate(){
      try{
        const headers=this.authToken?{Authorization:'Bearer '+this.authToken}:{};
        const acting=this.getActingAsId();if(acting)headers['X-Acting-As']=String(acting);
        const base=window.TKSWARM_API_BASE||window.__TKSWARM_CONFIG__?.defaultApiBase||'';
        const r=await fetch(base+'/api/proxies/import-template.csv',{headers});
        if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.message||'下载失败')}
        const text=await r.text();
        if(!String(text||'').trim()){this.toast('模板为空',true);return}
        const blob=new Blob([text],{type:'text/csv;charset=utf-8'});
        const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;
        a.download='proxy-import-template.csv';a.click();URL.revokeObjectURL(url);
        this.toast('模板已下载');
      }catch(e){this.toast(e.message,true)}
    },
    loadProxyImportFile(input){
      const file=input?.files?.[0];if(input)input.value='';
      if(!file)return;
      const reader=new FileReader();
      reader.onload=()=>{const box=document.querySelector('#pio-import-content');if(box)box.value=String(reader.result||'');this.toast('已读入 '+file.name)};
      reader.onerror=()=>this.toast('读取文件失败',true);
      reader.readAsText(file);
    },
    async submitProxyIoImport(){
      if(!this.canImportProxies()){this.toast('当前角色无权导入代理',true);return}
      const content=document.querySelector('#pio-import-content')?.value||'';
      if(!String(content).trim()){this.toast('请先粘贴 CSV 或选择文件',true);return}
      if(!(await this.ask('将按 CSV 模板导入代理，是否继续？')))return;
      try{
        const r=await this.api('/proxies/import',{method:'POST',body:JSON.stringify({
          content,
          groupId:document.querySelector('#pio-import-group')?.value?Number(document.querySelector('#pio-import-group').value):null,
        })});
        const box=document.querySelector('#pio-import-result');
        const errHtml=(r.errors||[]).length?'<div style="margin-top:6px">'+(r.errors||[]).slice(0,8).map(e=>this.esc(typeof e==='string'?e:(e.reason||JSON.stringify(e)))).join('<br>')+'</div>':'';
        if(box)box.innerHTML='成功 <b>'+(r.imported||0)+'</b>，重复 <b>'+(r.duplicates||0)+'</b>，错误 <b>'+((r.errors||[]).length)+'</b>'+errHtml;
        this.toast('导入完成');
        this.invalidateProxyCatalog();
      }catch(e){this.toast(e.message,true)}
    },
    async submitProxyLinesImport(){
      if(!this.canImportProxies()){this.toast('当前角色无权导入代理',true);return}
      const content=document.querySelector('#pio-lines-content')?.value||'';
      if(!String(content).trim()){this.toast('请粘贴代理列表',true);return}
      try{
        const r=await this.api('/proxies/batch-import',{method:'POST',body:JSON.stringify({
          content,
          defaultProtocol:document.querySelector('#pio-lines-protocol')?.value||'http',
          groupId:document.querySelector('#pio-lines-group')?.value?Number(document.querySelector('#pio-lines-group').value):null,
          country:document.querySelector('#pio-lines-country')?.value||'',
        })});
        let message='成功 '+r.imported+'，重复 '+r.duplicates+'，错误 '+r.errors.length;
        if(r.errors?.length)message+='；首个错误在第 '+r.errors[0].line+' 行：'+r.errors[0].reason;
        const box=document.querySelector('#pio-lines-result');
        if(box)box.textContent=message;
        this.toast(message);
        this.invalidateProxyCatalog();
      }catch(e){this.toast(e.message,true)}
    },
    async proxyModal(){
      if(!this.canCreateProxies()){this.toast('当前角色无权添加代理',true);return}
      if(typeof this.ensureCountryOptions==='function')await this.ensureCountryOptions();
      const gs=this.ownedGroups('proxy');
      const countryField=typeof this.countrySelectField==='function'
        ?this.countrySelectField('国家/地区','country','',{blankLabel:'不指定'})
        :this.field('country','国家/地区');
      this.modal('添加代理',`<div class="form-grid">${this.field('name','名称','新代理','text',true)}${this.selectRaw('protocol','协议',(this.meta?.proxyProtocols||[]).length?(this.meta.proxyProtocols.map(x=>[x.code,x.label])):[['http','HTTP'],['https','HTTPS'],['socks5','SOCKS5']],'http')}${this.field('host','主机','','text',true)}${this.field('port','端口','','number',true)}${this.field('username','用户名')}${this.field('password','密码','','password')}${countryField}${this.select('groupId','代理分组',gs)}</div>`,async d=>{
        d.port=Number(d.port);d.groupId=d.groupId?Number(d.groupId):null;
        await this.api('/proxies',{method:'POST',body:JSON.stringify(d)});
        this.toast('代理已添加');this.closeModal();this.invalidateProxyCatalog();await this.loadRefs({force:true});this.refresh();
      });
    },
    editProxyAddress(id){
      const row=this.proxies.find(p=>Number(p.id)===Number(id));
      if(!row){this.toast('代理不存在，请刷新',true);return}
      if(!this.canEditProxyRow(row)){this.toast('当前角色无权修改该代理',true);return}
      const cur=row.host+':'+row.port+(row.username?':'+row.username:'');
      this.modal('修改IP',`<div class="form-grid">${this.field('proxyString','代理地址',cur,'text',true)}<div class="field full"><div class="muted">格式：host:port 或 host:port:user:pass。不填密码则保留原密码。</div></div></div>`,async d=>{
        const raw=String(d.proxyString||'').trim();
        const parts=raw.split(':').map(x=>x.trim());
        if(parts.length<2)throw new Error('格式应为 host:port 或 host:port:user:pass');
        const host=parts[0];const port=Number(parts[1]);
        if(!host||!Number.isInteger(port)||port<1||port>65535)throw new Error('端口无效');
        const body={name:row.name,protocol:row.protocol,host,port,username:parts[2]||row.username||'',country:row.country||'',groupId:row.group_id||null};
        if(parts.length>=4)body.password=parts.slice(3).join(':');
        await this.api('/proxies/'+id,{method:'PUT',body:JSON.stringify(body)});
        this.toast('代理地址已更新');this.closeModal();this.invalidateProxyCatalog();await this.loadRefs({force:true});this.refresh();
      });
    },
    async editProxyCountry(id,country=''){
      const row=this.proxies.find(p=>Number(p.id)===Number(id));
      if(!row){this.toast('代理不存在，请刷新',true);return}
      if(!this.canEditProxyRow(row)){this.toast('当前角色无权修改该代理',true);return}
      if(typeof this.ensureCountryOptions==='function')await this.ensureCountryOptions();
      const countryField=typeof this.countrySelectField==='function'
        ?this.countrySelectField('国家/地区','country',country||'',{blankLabel:'不指定',allowCustom:true})
        :this.field('country','国家/地区',country||'');
      this.modal('修改代理国家',`<div class="form-grid"><input type="hidden" name="id" value="${id}">${countryField}<div class="field full"><div class="muted">账号列表的「国家」会关联显示此字段。也可在「检测」时自动写入。留空表示清除。</div></div></div>`,async d=>{
        const row=this.proxies.find(p=>Number(p.id)===Number(id));
        if(!row)throw new Error('代理不存在，请刷新');
        const body={name:row.name,protocol:row.protocol,host:row.host,port:row.port,username:row.username||'',country:d.country||'',groupId:row.group_id||null};
        await this.api('/proxies/'+id,{method:'PUT',body:JSON.stringify(body)});
        this.toast('代理国家已更新');this.closeModal();this.invalidateProxyCatalog();await this.loadRefs({force:true});this.refresh();
      });
    },
    async editProxyModal(x={}){
      if(!this.canEditProxyRow(x)){this.toast('当前角色无权编辑该代理',true);return}
      if(typeof this.ensureCountryOptions==='function')await this.ensureCountryOptions();
      const gs=this.ownedGroups('proxy');
      const countryField=typeof this.countrySelectField==='function'
        ?this.countrySelectField('国家/地区','country',x.country||'',{blankLabel:'不指定',allowCustom:true})
        :this.field('country','国家/地区',x.country||'');
      this.modal('编辑代理',`<div class="form-grid"><input type="hidden" name="id" value="${x.id||''}">${this.field('name','名称',x.name||'','text',true)}${this.selectRaw('protocol','协议',(this.meta?.proxyProtocols||[]).length?(this.meta.proxyProtocols.map(x=>[x.code,x.label])):[['http','HTTP'],['https','HTTPS'],['socks5','SOCKS5']],x.protocol||'http')}${this.field('host','主机',x.host||'','text',true)}${this.field('port','端口',x.port||'','number',true)}${this.field('username','用户名',x.username||'')}${this.field('password','密码（留空不改）','','password')}${countryField}${this.select('groupId','代理分组',gs,x.group_id)}</div>`,async d=>{
        const id=d.id;delete d.id;d.port=Number(d.port);d.groupId=d.groupId?Number(d.groupId):null;
        if(!d.password)delete d.password;
        await this.api('/proxies/'+id,{method:'PUT',body:JSON.stringify(d)});
        this.toast('代理已更新');this.closeModal();this.invalidateProxyCatalog();await this.loadRefs({force:true});this.refresh();
      });
    },
    batchImportProxies(){return this.batchProxyModal()},
    async batchProxyModal(){
      if(!this.canImportProxies()){this.toast('当前角色无权导入代理',true);return}
      if(typeof this.ensureCountryOptions==='function')await this.ensureCountryOptions();
      const gs=this.ownedGroups('proxy');
      const countryField=typeof this.countrySelectField==='function'
        ?this.countrySelectField('国家/地区（可选）','country','',{blankLabel:'不指定'})
        :this.field('country','国家/地区（可选）');
      this.modal('批量导入代理',`<div class="form-grid">${this.selectRaw('defaultProtocol','默认协议',(this.meta?.proxyProtocols||[]).length?(this.meta.proxyProtocols.map(x=>[x.code,x.label])):[['http','HTTP'],['https','HTTPS'],['socks5','SOCKS5']],'http')}${this.select('groupId','代理分组',gs)}${countryField}${this.field('content','代理列表','','textarea',true)}<div class="field full"><div class="muted">每行一个，支持：<br>host:port<br>host:port:username:password<br>username:password@host:port<br>http://username:password@host:port<br>也支持竖线或逗号分隔；空行和 # 开头的注释会忽略。</div></div></div>`,async d=>{
        d.groupId=d.groupId?Number(d.groupId):null;
        const r=await this.api('/proxies/batch-import',{method:'POST',body:JSON.stringify(d)});
        let message=`成功 ${r.imported}，重复 ${r.duplicates}，错误 ${r.errors.length}`;
        if(r.errors.length)message+=`；首个错误在第 ${r.errors[0].line} 行：${r.errors[0].reason}`;
        this.toast(message,!!r.errors.length);this.closeModal();this.invalidateProxyCatalog();await this.loadRefs({force:true});this.refresh();
      });
    },
    async testProxy(id){
      if(!this.canTestProxies()){this.toast('当前角色无权检测代理',true);return}
      await this.runDirectProxyTests([Number(id)],{single:true});
    },
    async batchTestProxies(){
      if(!this.canTestProxies()){this.toast('当前角色无权检测代理',true);return}
      const selected=this.selectedProxyIds();
      const preferSelected=selected.length>0;
      const html=`
        <div class="form-grid">
          <div class="field full"><div class="shell-note">检测方式：<b>直连上游代理</b>（本机 Node 直连 SOCKS/HTTP，不经 Clash/系统代理）</div></div>
          <div class="field full">
            <label class="warm-check-line" style="display:flex;gap:8px;align-items:flex-start;cursor:pointer">
              <input type="radio" name="proxyTestScope" value="selected" ${preferSelected?'checked':''} style="margin-top:3px">
              <span>仅列表勾选${preferSelected?`（已选 ${selected.length} 个）`:'（请先勾选）'}</span>
            </label>
            <label class="warm-check-line" style="display:flex;gap:8px;align-items:flex-start;cursor:pointer;margin-top:10px">
              <input type="radio" name="proxyTestScope" value="all" ${preferSelected?'':'checked'} style="margin-top:3px">
              <span>全部检测（当前分组/搜索/状态下的全部代理）</span>
            </label>
          </div>
          <div class="action-bar" style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end">
            <button class="ghost" type="button" onclick="app.closeModal()">取消</button>
            <button class="primary" type="button" onclick="app.startDirectProxyBatchTest()">开始检测</button>
          </div>
        </div>`;
      this.modal('代理检测',html,async()=>{},false,{hideSubmit:true});
    },
    async startDirectProxyBatchTest(){
      if(!this.canTestProxies()){this.toast('当前角色无权检测代理',true);return}
      const scope=document.querySelector('input[name=proxyTestScope]:checked')?.value||'selected';
      let ids=[];
      try{
        if(scope==='all'){
          ids=await this.collectProxyIdsForDirectTest({all:true});
          if(!ids.length){this.toast('当前筛选下没有可检测的代理',true);return}
        }else{
          ids=this.selectedProxyIds();
          if(!ids.length){this.toast('请先勾选要检测的代理，或改选「全部检测」',true);return}
        }
      }catch(e){this.toast(e.message||'获取代理列表失败',true);return}
      this.closeModal();
      await this.runDirectProxyTests(ids);
    },
    /** 按当前列表筛选拉全量代理 ID（用于「全部检测」） */
    async collectProxyIdsForDirectTest({all=false}={}){
      if(!all)return this.selectedProxyIds();
      const kw=encodeURIComponent(this.proxyKeyword||'');
      const st=encodeURIComponent(this.proxyStatus||'');
      const groupQs=(this.proxyGroupId?`&groupId=${encodeURIComponent(this.proxyGroupId)}`:'')+this.proxyCountryQs();
      const ids=[];
      let page=1;
      const pageSize=100;
      let total=Infinity;
      while(ids.length<total && page<=200){
        const d=await this.api(`/proxies?page=${page}&pageSize=${pageSize}&keyword=${kw}&status=${st}${groupQs}`);
        total=Number(d.total||0);
        const items=Array.isArray(d.items)?d.items:[];
        for(const row of items){
          const id=Number(row.id||0);
          if(id>0)ids.push(id);
        }
        if(!items.length)break;
        page+=1;
      }
      return [...new Set(ids)];
    },
    /** 直连检测：全屏进度「正在检测 x / 共 y」，结束后关动画并提示 */
    async runDirectProxyTests(ids,opts={}){
      const list=[...new Set((ids||[]).map(Number).filter((n)=>Number.isInteger(n)&&n>0))];
      if(!list.length){this.toast('没有可检测的代理',true);return}
      const total=list.length;
      let available=0;
      let unavailable=0;
      let updated=0;
      const single=!!opts.single;
      if(window.UI)UI.loading(true,'正在直连检测代理',`正在检测 0 / 共 ${total}`);
      try{
        // 逐条直连检测，便于刷新进度；接口本身即直连上游（不经 Clash）
        for(let i=0;i<list.length;i+=1){
          const cur=i+1;
          if(window.UI)UI.loading(true,'正在直连检测代理',`正在检测 ${cur} / 共 ${total}`);
          try{
            const r=await this.api('/browser/proxies/batch-test',{
              method:'POST',
              body:JSON.stringify({proxyIds:[list[i]]}),
            });
            available+=Number(r.available||0);
            unavailable+=Number(r.unavailable||0);
            updated+=Number(r.updated||0);
            if(single){
              const item=(r.items||[])[0];
              const country=item?.country?` · ${item.country}`:'';
              const warn=item?.softWarning&&!item?.available;
              const lat=item?.latencyMs;
              const egressLat=item?.egressLatencyMs;
              const latText=lat!=null
                ?(egressLat!=null&&egressLat>lat+150?`握手 ${lat}ms（全程 ${egressLat}ms）`:`${lat} ms`)
                :'-';
              if(window.UI)UI.loading(false);
              this.toast(
                item?.available?`${item.detail||'可用'} · ${latText}${country}`:(item?.detail||'连接失败'),
                !item?.available&&!warn,
              );
              if(warn)this.toast(item.detail||'代理握手异常',true);
              this.invalidateProxyCatalog();
              await this.loadRefs({force:true});
              this.refresh();
              return;
            }
          }catch{
            unavailable+=1;
          }
        }
        if(window.UI)UI.loading(false);
        let msg=`检测完成：可用 ${available}，不可用 ${unavailable}`;
        if(updated)msg+=`，已写入国家 ${updated}`;
        this.toast(msg);
        this.invalidateProxyCatalog();
        await this.loadRefs({force:true});
        this.refresh();
      }catch(e){
        if(window.UI)UI.loading(false);
        this.toast(e.message||'代理检测失败',true);
      }
    },
    fetchProxyModal(){
      if(!this.canCreateProxies()){this.toast('当前角色无权拉取代理',true);return}
      const gs=this.ownedGroups('proxy');
      this.modal('获取代理IP',`<div class="form-grid">${this.select('groupId','写入分组',gs)}${this.field('country','国家代码（如 US）')}${this.field('region','州/省（可选）')}${this.field('city','城市（可选）')}${this.field('count','数量',5,'number')}${this.field('rotateMinutes','轮转分钟（0-120）',0,'number')}<div class="field full"><div class="muted">已配置「云代理 API」时从云端拉取；未配置则明确走本地可用池，不会假装成云端成功。</div></div></div>`,async d=>{
        d.groupId=d.groupId?Number(d.groupId):null;d.count=Number(d.count||5);d.rotateMinutes=Number(d.rotateMinutes||0);
        const r=await this.api('/proxies/fetch',{method:'POST',body:JSON.stringify(d)});
        const source=r.source==='cloud'?'云端':(r.source==='local-pool'?'本地代理池':r.source||'未知');
        this.toast(`来源：${source} · 已获取 ${r.count} 个`);
        this.closeModal();this.invalidateProxyCatalog();await this.loadRefs({force:true});this.refresh();
      });
    },
    advancedDeleteProxies(){
      if(!this.canDeleteProxies()){this.toast('当前角色无权删除代理',true);return}
      this.modal('高级删除代理',`<div class="form-grid">${this.selectRaw('status','状态',[['','不限'],['unavailable','不可用'],['unchecked','未检测'],['available','可用']],'')}${this.field('country','国家，精确匹配')}${this.field('minUse','使用次数不少于','','number')}<div class="field full"><div class="muted">${this.esc(this.proxyDeleteScopeHint())}<br>至少填一个筛选条件。删除后，账号上的这条代理绑定会被清空。</div></div></div>`,async d=>{
        const body={};if(d.status)body.status=d.status;if(String(d.country||'').trim())body.country=String(d.country).trim();if(d.minUse)body.minUse=Number(d.minUse);
        const r=await this.api('/proxies/advanced-delete',{method:'POST',body:JSON.stringify(body)});
        this.toast(r.deleted?`已删除 ${r.deleted} 条`:`没有符合条件的代理可删`,!r.deleted);
        this.closeModal();this.invalidateProxyCatalog();await this.loadRefs({force:true});this.refresh();
      });
    },
    async copyProxy(id){
      try{
        const r=await this.api('/proxies/export-strings',{method:'POST',body:JSON.stringify({proxyIds:[Number(id)]})});
        if(!r.count){this.toast('没有可复制的代理',true);return}
        try{await navigator.clipboard.writeText(r.text);this.toast('已复制 1 条')}
        catch{this.toast(r.text)}
      }catch(e){this.toast(e.message,true)}
    },
    toggleAllProxies(checked){
      document.querySelectorAll('.proxy-check').forEach((el)=>{el.checked=!!checked});
      this.bindProxyChecks();
    }
  };
  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages["proxies"] = true;
})();
