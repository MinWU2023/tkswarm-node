(function () {
  if (!window.app) throw new Error('app-core must load before pages/accounts.js');
  const __methods = {
    canImportAccounts(){if(this.isOperatorRole())return false;return this.canPermission('account.import')},
    canExportAccounts(){if(this.isOperatorRole())return false;return this.canAnyPermission('account.export','account.view','account.create')},
    canBatchModifyAccounts(){if(this.isOperatorRole())return false;return this.canEditAccounts()},
    canCreateAccounts(){if(this.isOperatorRole())return false;return this.canPermission('account.create')},
    canEditAccounts(){
      if(this.isEnterpriseCustomerRole())return false;
      if(this.isOperatorRole())return this.canPermission('account.view');
      return this.canPermission('account.update');
    },
    canEditBrowserEnvs(){
      if(typeof this.canUpdateProxies==='function')return this.canUpdateProxies();
      if(typeof this.canEditProxies==='function')return this.canEditProxies();
      if(this.isOperatorRole())return false;
      if(this.authUser?.isSuper||this.isOpsAdminRole()||this.isEnterpriseCustomerRole())return true;
      return this.canPermission('proxy.create');
    },
    /** 再绑/重绑环境：仅超管或运营管理可操作 */
    canRebindBrowserEnv(){
      if(this.authIsSuper||this.authLoginUser?.isSuper||this.authUser?.isSuper)return true;
      if(typeof this.isLoginOpsAdminRole==='function'&&this.isLoginOpsAdminRole())return true;
      if(typeof this.isOpsAdminRole==='function'&&this.isOpsAdminRole())return true;
      return false;
    },
    canEditBrowserEnvRow(row){
      // 环境本机共用：owner_user_id 只表示额度/创建归属，不套用代理「超管只能改未分配」
      if(!this.canEditBrowserEnvs())return false;
      if(this.authUser?.isSuper||this.isOpsAdminRole())return true;
      const oid=Number(row?.owner_user_id||row?.account?.owner_user_id||0);
      if(this.isEnterpriseCustomerRole()){
        const self=Number(this.authUser?.id||0);
        return oid<=0||oid===self||!!row?.account;
      }
      return true;
    },
    browserOfflineBanner(status){
      if(status?.online)return '';
      const tip=`请启动本地浏览器（${this.tkswarmBrowserLabel()}），并确认 API 地址为 ${this.esc(status?.apiUrl||'http://127.0.0.1:54345')}`;
      return `<div class="callout warn" style="margin-bottom:12px"><b>本地浏览器未连接</b><p>${this.esc(status?.message||'无法连接本地浏览器 API')}</p><p class="muted">以下为数据库中的环境绑定记录，打开、检测登录等操作需浏览器在线。${tip}</p><button type="button" class="primary tiny" onclick="app.refresh()">重新检测</button></div>`;
    },
    canAccountAdvancedFilter(){
      return (typeof this.canAccountPickIndustryFilter==='function'&&this.canAccountPickIndustryFilter())
        ||(typeof this.canAccountPickOperatorFilter==='function'&&this.canAccountPickOperatorFilter());
    },
    accountAdvFilterKeys(){return ['ownerId','companyId','industryId','hasEnv']},
    accountAdvFilterActive(){
      const f=this.accountAdvFilter||{};
      return this.accountAdvFilterKeys().some((k)=>String(f[k]||'').trim()!=='');
    },
    accountListQueryExtra(){
      const f=this.accountAdvFilter||{};
      const q=[];
      const sideOid=this.accountSidebarOwnerFilterId();
      if(sideOid>0)q.push(`ownerId=${encodeURIComponent(sideOid)}`);
      else if(f.ownerId&&this.canAccountPickOperatorFilter())q.push(`ownerId=${encodeURIComponent(f.ownerId)}`);
      if(f.companyId)q.push(`companyId=${encodeURIComponent(f.companyId)}`);
      if(f.industryId&&this.canAccountPickIndustryFilter())q.push(`industryId=${encodeURIComponent(f.industryId)}`);
      if(f.hasEnv==='1'||f.hasEnv==='0')q.push(`hasEnv=${encodeURIComponent(f.hasEnv)}`);
      return q.length?('&'+q.join('&')):'';
    },
    /** 侧栏归属筛选（只筛列表，不切换登录/Acting-As） */
    accountSidebarOwnerFilterId(){
      const raw=this.accountSidebarOwnerId;
      if(raw==null||raw==='')return 0;
      const n=Number(raw);
      return n>0?n:0;
    },
    async renderAccounts(opts={}){
      const still=typeof opts.still==='function'?opts.still:()=>this.view==='accounts';
      document.querySelector('#content')?.classList.remove('chat-mode');
      if(!this.canView('accounts')&&!this.canAnyPermission('account.view','account.update','account.create','account.import','account.export')) return this.renderPageDenied('当前角色无权查看账号中心');
      if((this.accountPane||'list')==='io'){await this.renderAccountIo(opts);return}
      await this.ensureAccountGroups();
      const listExtra=this.accountListQueryExtra();
      const statsQs=listExtra?String(listExtra).replace(/^&/,''):'';
      const [accStats,d]=await Promise.all([
        this.api(`/accounts/stats${statsQs?`?${statsQs}`:''}`),
        this.api(`/accounts?page=${this.accountPage||1}&pageSize=20&keyword=${encodeURIComponent(this.accountKeyword||'')}&status=${encodeURIComponent(this.accountStatus||'')}${this.accountGroupId?`&groupId=${this.accountGroupId}`:''}${this.accountCapcut?`&capcut=${this.accountCapcut}`:''}${this.accountSession?`&session=${this.accountSession}`:''}${listExtra}`),
        typeof this.ensureCountryOptions==='function'?this.ensureCountryOptions():Promise.resolve(),
      ]);
      if(!still())return;
      const gs=this.accountOwnedGroups();
      const pane=this.accountPane||'list';
      const hideStats=this.accountStatsHidden;
      const offline=Math.max(0,(accStats.total||0)-(accStats.online||0));
      const content=document.querySelector('#content');
      const headHtml=content?.querySelector('.page-head')?.outerHTML||(typeof this.pageHead==='function'?this.pageHead('accounts'):'')||'';
      content.innerHTML=`${headHtml}<div class="workspace accounts-workspace">
        <aside class="side-groups account-sidebar">
          <div class="sidebar-header"><h3>账号分组 <span class="count-pill">${gs.length}</span></h3>${this.groupSidebarAddBtn('account',this.canAnyPermission('group.create','group.manage'))}</div>
          ${this.accountSidebarOwnerHtml()}
          <div class="group-list">
            ${this.accountGroupSidebarHtml(accStats)}
          </div>
        </aside>
        <div class="account-main-wrapper">
          <div class="subtabs"><button class="${pane==='list'?'active':''}" onclick="app.switchAccountPane('list')">账号列表</button><button class="${pane==='browser'?'active':''}" onclick="app.switchAccountPane('browser')">浏览器环境</button></div>
          <div id="account-main"></div>
        </div>
      </div>`;
      this.mountAccountSidebarOwnerPicker();
      if(pane==='browser'){await this.mountBrowser();return}
      document.querySelector('#account-main').innerHTML=`<div class="account-main-panel">
        <div id="account-batch-panel" class="batch-panel hidden">
          <div class="batch-info">已选择 <strong id="account-selected-count">0</strong> 个账号</div>
        </div>
        <div class="account-toolbar">
          <div class="action-buttons">
            ${(this.canImportAccounts()||this.canExportAccounts())?`<button class="ghost" onclick="app.openAccountIo()">导入导出</button>`:''}${this.canCreateAccounts()?`<button class="ghost" onclick="app.accountModal()">添加账号</button>`:''}
            ${this.canAnyPermission('account.create','account.import','account.delete')||this.canEditAccounts()||this.canRebindBrowserEnv()?`<div class="dropdown"><button class="ghost" type="button" onclick="app.toggleAccountBatchMenu(event)">批量操作 <span class="btn-arrow-down">▾</span></button>
              <div id="account-batch-menu" class="dropdown-menu align-left hidden">
                ${this.canEditAccounts()?`${this.canBatchModifyAccounts()?`<button type="button" onclick="app.batchModifyProfiles()">修改数据</button>`:''}
                <button type="button" onclick="app.batchLoginAccounts()">登录环境</button>
                <button type="button" onclick="app.extractFingerprints()">提取指纹</button>`:''}
                ${this.canRebindBrowserEnv()?`<button type="button" onclick="app.batchRebindBrowserEnvs()">重绑环境</button>`:''}
                ${this.canAssignAccounts()?`<button type="button" onclick="app.batchClearAccountOwners()">清除关联人员</button>`:''}
                ${this.canPermission('account.delete')?`<button type="button" class="is-danger" onclick="app.batchDeleteAccounts()">删除数据</button>`:''}
              </div>
            </div>`:''}
          </div>
          <div class="search-bar">
            <input id="search" class="input" placeholder="搜索账号 / 昵称" value="${this.esc(this.accountKeyword||'')}" onkeydown="if(event.key==='Enter')app.searchAccounts()">
            <select id="account-status"><option value="">登录状态</option>${this.loginStatusPairs().map(([v,n])=>`<option value="${v}" ${this.accountStatus===v?'selected':''}>${this.esc(n)}</option>`).join('')}</select>
            <select id="account-capcut" onchange="app.accountCapcut=this.value;app.accountPage=1;app.refresh()"><option value="">CapCut标记全部</option><option value="1" ${this.accountCapcut==='1'?'selected':''}>本地已标</option><option value="0" ${this.accountCapcut==='0'?'selected':''}>未标记</option></select>
            <select id="account-session" onchange="app.accountSession=this.value;app.accountPage=1;app.refresh()"><option value="">会话全部</option><option value="1" ${this.accountSession==='1'?'selected':''}>有CK</option></select>
            <button class="primary" onclick="app.searchAccounts()">查询</button>
            ${this.canAccountAdvancedFilter()?`<button class="ghost ${this.accountAdvFilterActive()?'is-active':''}" type="button" onclick="app.openAccountAdvancedFilterModal()">高级筛选${this.accountAdvFilterActive()?' ·':''}</button>`:''}
            <button class="ghost" type="button" onclick="app.resetAccountFilters()">重置</button>
          </div>
        </div>
        <div class="stats-panel ${hideStats?'hidden':''}" id="account-stats-panel">
          <div class="stats-panel-head"><h3>账号统计</h3><div class="stats-panel-acts"><button class="tiny" type="button" title="刷新统计" onclick="app.refresh()">刷新</button><button class="tiny" type="button" onclick="app.toggleAccountStats()">${hideStats?'显示统计':'隐藏统计'}</button></div></div>
          <div class="stats-container">
            ${this.statChip('info','账号总数',accStats.total||0,'users')}
            ${this.statChip('ok','已登录',accStats.online||0,'check')}
            ${this.statChip('','未登录',offline,'logout')}
            ${this.statChip('warn','封号数',accStats.banned||0,'ban', (Number(accStats.banned)>0 && this.canPermission('account.delete')) ? 'app.deleteBannedAccounts()' : '')}
            ${this.statChip('fans','总粉丝',accStats.followers||0,'fans')}
            ${this.statChip('','总关注',accStats.following||0,'follow')}
            ${this.statChip('','总获赞',accStats.likes||0,'heart')}
            ${this.statChip('','视频数',accStats.videos||accStats.syncedVideos||0,'video')}
            ${this.statChip('info','有会话CK',accStats.with_session||0,'key')}
            ${this.statChip('info','CapCut本地标',accStats.capcut||0,'cut')}
          </div>
        </div>
        ${hideStats?`<div style="margin-bottom:12px"><button class="tiny" type="button" onclick="app.toggleAccountStats()">显示统计</button></div>`:''}
        <div class="table-container">${this.accountsTable(d.items)}</div>
        ${UI.pager(d,'accountPage')}
      </div>`;
      this.accounts=Array.isArray(d.items)?d.items:[];
      this.bindAccountChecks();
    },
    /** 侧栏归属筛选：只筛账号列表/分组，不切换登录身份（右下角仍可切 Acting-As） */
    accountSidebarOwnerLabel(){
      const self=this.authLoginUser||this.authUser;
      const sid=this.accountSidebarOwnerFilterId();
      if(!sid) return '全部用户';
      const selfId=Number(self?.id||0);
      if(selfId>0&&sid===selfId) return `本人 · ${String(self.nickname||self.username||'当前用户')}`;
      const children=this.authChildren||[];
      const hit=children.find((c)=>Number(c.id)===sid)
        ||(this._scopeUsers||[]).find((u)=>Number(u.id)===sid);
      if(hit) return String(hit.nickname||hit.username||sid);
      return `用户 #${sid}`;
    },
    accountSidebarOwnerHtml(){
      if(typeof this.canSwitchScope!=='function'||!this.canSwitchScope())return '';
      return `<div class="account-sidebar-owner">
          <button type="button" class="account-sidebar-owner-trigger" id="account-sidebar-owner-btn" title="按关联人员筛选账号（不会切换登录身份）" onclick="app.toggleAccountSidebarOwnerPanel(event)">
            <span class="account-sidebar-owner-label" id="account-sidebar-owner-label">${this.esc(this.accountSidebarOwnerLabel())}</span>
            <span class="account-sidebar-owner-caret">▾</span>
          </button>
          <div class="account-sidebar-owner-panel hidden" id="account-sidebar-owner-panel">
            <input type="search" class="input account-sidebar-owner-search" id="account-sidebar-owner-search" placeholder="筛选用户…" oninput="app.filterAccountSidebarOwners(this.value)" onclick="event.stopPropagation()">
            <div id="account-sidebar-owner-list" class="account-sidebar-owner-list"></div>
          </div>
        </div>`;
    },
    async mountAccountSidebarOwnerPicker(){
      if(typeof this.canSwitchScope!=='function'||!this.canSwitchScope())return;
      if(!document.querySelector('#account-sidebar-owner-list'))return;
      if((this.authIsSuper||(typeof this.isLoginOpsAdminRole==='function'&&this.isLoginOpsAdminRole()))&&!(this._scopeUsers||[]).length){
        try{
          const rows=await this.api('/auth/switchable-users');
          this._scopeUsers=Array.isArray(rows)?rows:[];
        }catch(_){
          this._scopeUsers=[];
        }
      }
      this.filterAccountSidebarOwners(document.querySelector('#account-sidebar-owner-search')?.value||'');
      if(!this._accountSidebarOwnerDocBound){
        this._accountSidebarOwnerDocBound=true;
        document.addEventListener('click',(ev)=>{
          const wrap=document.querySelector('.account-sidebar-owner');
          const panel=document.querySelector('#account-sidebar-owner-panel');
          if(!wrap||!panel||panel.classList.contains('hidden'))return;
          if(wrap.contains(ev.target))return;
          panel.classList.add('hidden');
        });
      }
    },
    toggleAccountSidebarOwnerPanel(e){
      e?.stopPropagation?.();
      const panel=document.querySelector('#account-sidebar-owner-panel');
      if(!panel)return;
      const opening=panel.classList.contains('hidden');
      panel.classList.toggle('hidden');
      if(opening){
        const scopePanel=document.querySelector('#scope-panel');
        if(scopePanel)scopePanel.classList.add('hidden');
        this.filterAccountSidebarOwners(document.querySelector('#account-sidebar-owner-search')?.value||'');
        setTimeout(()=>document.querySelector('#account-sidebar-owner-search')?.focus(),0);
      }
    },
    setAccountSidebarOwnerFilter(userId){
      const panel=document.querySelector('#account-sidebar-owner-panel');
      if(panel)panel.classList.add('hidden');
      const next=(userId==null||userId===''||userId===0)?'':Number(userId);
      const prev=this.accountSidebarOwnerId==null||this.accountSidebarOwnerId===''?'':Number(this.accountSidebarOwnerId);
      if(String(next||'')===String(prev||''))return;
      this.accountSidebarOwnerId=next===''?'':next;
      this.accountGroupId='';
      this.accountPage=1;
      this.invalidateAccountGroupsCache();
      this.refresh();
    },
    filterAccountSidebarOwners(kw=''){
      const host=document.querySelector('#account-sidebar-owner-list');
      if(!host)return;
      const q=String(kw||'').trim().toLowerCase();
      const selectedId=this.accountSidebarOwnerFilterId();
      const self=this.authLoginUser||this.authUser;
      const selfId=Number(self?.id||0);
      const children=this.authChildren||[];
      const selfLabel=this.esc((self&&(self.nickname||self.username))||'本人');
      const match=(u)=>{
        if(!q)return true;
        const hay=`${u.username||''} ${u.nickname||''}`.toLowerCase();
        return hay.includes(q);
      };
      let html=`<button type="button" class="scope-item ${!selectedId?'active':''}" onclick="app.setAccountSidebarOwnerFilter(null)"><b>全部用户</b><span>不限归属</span></button>`;
      if(selfId>0){
        html+=`<button type="button" class="scope-item ${selectedId===selfId?'active':''}" onclick="app.setAccountSidebarOwnerFilter(${selfId})"><b>本人账号</b><span>${selfLabel}</span></button>`;
      }
      const childRows=children.filter(match);
      if(childRows.length){
        html+=`<div class="scope-section">子级账号</div>`;
        html+=childRows.map((c)=>{
          const active=selectedId&&Number(selectedId)===Number(c.id)?'active':'';
          return `<button type="button" class="scope-item ${active}" onclick="app.setAccountSidebarOwnerFilter(${c.id})"><b>${this.esc(c.nickname||c.username)}</b><span>@${this.esc(c.username)}</span></button>`;
        }).join('');
      }
      if(this.authIsSuper||(typeof this.isLoginOpsAdminRole==='function'&&this.isLoginOpsAdminRole())){
        const childIds=new Set(children.map((c)=>Number(c.id)));
        const rows=(this._scopeUsers||[]).filter((u)=>{
          if(Number(u.id)===selfId)return false;
          if(childIds.has(Number(u.id)))return false;
          return match(u);
        }).slice(0,30);
        if(rows.length||q){
          html+=`<div class="scope-section">可选用户</div>`;
          html+=rows.map((u)=>{
            const active=selectedId&&Number(selectedId)===Number(u.id)?'active':'';
            return `<button type="button" class="scope-item ${active}" onclick="app.setAccountSidebarOwnerFilter(${u.id})"><b>${this.esc(u.nickname||u.username)}</b><span>@${this.esc(u.username)}</span></button>`;
          }).join('')||'<div class="muted" style="padding:8px">无匹配用户</div>';
        }
      }
      host.innerHTML=html;
    },
    toggleAccountStats(){this.accountStatsHidden=!this.accountStatsHidden;this.refresh()},
    bindAccountChecks(){
      const update=()=>{
        const n=document.querySelectorAll('.account-check:checked').length;
        const panel=document.querySelector('#account-batch-panel');
        const count=document.querySelector('#account-selected-count');
        if(count)count.textContent=String(n);
        if(panel)panel.classList.toggle('hidden',n===0);
      };
      document.querySelectorAll('.account-check').forEach(el=>el.addEventListener('change',update));
      update();
    },
    
    invalidateAccountGroupsCache(){
      this._accountGroupsCache={};
    },
    accountGroupsOwnerId(){
      const side=this.accountSidebarOwnerFilterId();
      if(side>0)return side;
      return Number(this.effectiveOwnerId()||0);
    },
    async ensureAccountGroups(){
      const oid=this.accountGroupsOwnerId();
      const ttl=30000;
      const cacheKey=oid>0?`account:${oid}`:'account:all';
      this._accountGroupsCache=this._accountGroupsCache||{};
      const hit=this._accountGroupsCache[cacheKey];
      if(hit?.at&&(Date.now()-hit.at)<ttl&&Array.isArray(hit.items)){
        this.groups=(this.groups||[]).filter(g=>g.type!=='account').concat(hit.items);
        return hit.items;
      }
      const qs=oid>0?`?type=account&ownerId=${oid}`:'?type=account';
      const rows=await this.api('/groups'+qs).catch(()=>[]);
      const items=Array.isArray(rows)?rows:[];
      this._accountGroupsCache[cacheKey]={items,at:Date.now()};
      const others=(this.groups||[]).filter(g=>g.type!=='account');
      this.groups=others.concat(items);
      return items;
    },
    accountOwnedGroups(){
      const oid=this.accountGroupsOwnerId();
      return (this.groups||[]).filter((g)=>{
        if(g.type!=='account')return false;
        if(oid<=0)return true;
        return Number(g.owner_id||0)===oid;
      });
    },
    filterAccountGroup(id){this.accountGroupId=id?String(id):'';this.accountPage=1;this.accountPane='list';this.refresh()},
    toggleAccountGroupOps(id,e){
      e?.stopPropagation?.();
      e?.preventDefault?.();
      const target=document.querySelector('#account-group-ops-'+id);
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
    toggleAccountGroupFold(id, ev){
      if(ev){ev.stopPropagation();ev.preventDefault()}
      this.accountGroupFold=this.accountGroupFold||{};
      const k=String(id);
      this.accountGroupFold[k]=!this.accountGroupFold[k];
      this.refresh();
    },
    accountGroupSidebarHtml(accStats){
      const all=this.accountOwnedGroups();
      const roots=all.filter(g=>!g.parent_id);
      const kids=all.filter(g=>g.parent_id);
      const fold=this.accountGroupFold||{};
      const canGroupUpdate=this.canAnyPermission('group.update','group.manage');
      const canGroupCreate=this.canAnyPermission('group.create','group.manage');
      const canGroupDelete=this.canAnyPermission('group.delete','group.manage');
      const canGroupAssign=this.canAssignAccountGroups();
      const menuItems=(g,isChild)=>{
        const items=[];
        if(canGroupUpdate) items.push(`<button type="button" onclick="event.stopPropagation();app.editGroup(${g.id})">编辑分组</button>`);
        if(canGroupCreate && !isChild) items.push(`<button type="button" onclick="event.stopPropagation();app.groupModal('account',{parent_id:${g.id}})">添加子组</button>`);
        if(canGroupAssign) items.push(`<button type="button" onclick="event.stopPropagation();app.assignAccountGroupOwner(${g.id})">分配用户</button>`);
        if(canGroupDelete) items.push(`<button type="button" class="is-danger" onclick="event.stopPropagation();app.remove('/groups/${g.id}','账号分组')">删除分组</button>`);
        return items.join('');
      };
      const item=(g,isChild)=>{
        const active=String(this.accountGroupId)===String(g.id);
        const children=kids.filter(k=>Number(k.parent_id)===Number(g.id));
        const hasKids=!isChild && children.length>0;
        const folded=!!fold[String(g.id)];
        const foldBtn=hasKids?`<button type="button" class="group-fold-btn" title="${folded?'展开':'收起'}" onclick="app.toggleAccountGroupFold(${g.id},event)">${folded?'▸':'▾'}</button>`:'<span class="group-fold-spacer"></span>';
        const menu=menuItems(g,isChild);
        const ops=menu?`<div class="ops-dropdown group-ops-dropdown"><button type="button" class="group-kebab" title="更多" onclick="app.toggleAccountGroupOps(${g.id},event)">⋮</button><div id="account-group-ops-${g.id}" class="dropdown-menu ops-menu hidden">${menu}</div></div>`:'';
        return `<div class="group-item-flat ${isChild?'is-child':''} ${active?'active':''}">
          <button type="button" class="group-item-main" onclick="app.filterAccountGroup(${g.id})">${foldBtn}<span class="group-item-name">${this.esc(g.name)}</span><span class="group-item-count">${g.member_count||0}</span></button>${ops}
        </div>${hasKids && !folded ? children.map(c=>item(c,true)).join('') : ''}`;
      };
      const rootHtml=roots.map(r=>item(r,false)).join('');
      const orphan=kids.filter(k=>!roots.some(r=>Number(r.id)===Number(k.parent_id)));
      const allActive=!this.accountGroupId;
      return `<div class="group-item-flat ${allActive?'active':''}">
          <button type="button" class="group-item-main" onclick="app.filterAccountGroup('')"><span class="group-fold-spacer"></span><span class="group-item-name">全部账号</span><span class="group-item-count">${accStats.total||0}</span></button>
        </div>${rootHtml}${orphan.map(c=>item(c,true)).join('')}`;
    },
    switchAccountPane(pane){this.accountPane=pane==='browser'?'browser':'list';this.refresh()},
    browserQuotaBadgeHtml(){
      const u=this.authUser||this.authLoginUser||{};
      const used=Number(u.browserEnvUsed??0);
      const quota=Number(u.browserEnvQuota??300);
      const name=this.esc(u.nickname||u.username||'当前用户');
      return `<span class="badge info" style="margin-right:8px" title="${name} 的自研/Linux 浏览器环境额度">自研额度：${used} / ${quota}</span>`;
    },
    async mountBrowser(){const host=document.querySelector('#account-main');const beFilter=this.normalizeEnvBackend(this.browserBackendFilter)||'';const profileQs=`/browser/profiles?pageSize=500${beFilter?`&browserBackend=${encodeURIComponent(beFilter)}`:''}`;const [status,d]=await Promise.all([this.api('/browser/status'),this.api(profileQs).catch(()=>({items:[],total:0})),this.ensureAuth().catch(()=>null)]);const pack=UI.paginateLocal(d.items||[],this.browserPage||1,20);this.browserPage=pack.page;host.innerHTML=`<div class="account-main-panel">${this.browserOfflineBanner(status)}<div class="toolbar">${this.browserBackendFilterHtml(beFilter)}${this.browserQuotaBadgeHtml()}<span class="muted">创建环境时会自动使用账号绑定的代理。</span><div><button class="ghost" type="button" onclick="app.diagnoseBrowser()" title="查看 health / group/list / browser/list 的原始返回">诊断</button><button class="ghost" type="button" onclick="app.updateAllEnvPacks()" title="按会话白名单精简打包，并以原环境 ID 文件名覆盖中心库环境包">一键更新环境包</button><div class="dropdown" style="display:inline-block"><button class="ghost" type="button" onclick="app.toggleBrowserBatchMenu(event)">批量操作 <span class="btn-arrow-down">▾</span></button><div id="browser-batch-menu" class="dropdown-menu align-left hidden">${this.canEditBrowserEnvs()?`<button type="button" onclick="app.batchCreateBrowserModal()">创建环境</button><button type="button" class="is-danger" onclick="app.batchDeleteBrowser()">删除环境</button>`:''}<button type="button" onclick="app.syncBrowserEnvs()">同步环境</button></div></div></div></div><div class="table-container">${this.browserTable(pack.items,d)}</div>${UI.pager(pack,'browserPage')}</div>`},
    accountsTable(rows){
      if(!rows.length)return '<div class="empty">还没有账号</div>';
      const canWrite=this.canCreateAccounts();
      const canEdit=this.canEditAccounts();
      const canDelete=this.canPermission('account.delete');
      return `<table><thead><tr>
      <th><input type="checkbox" onchange="app.toggleAllAccounts(this.checked)" title="全选"></th>
      <th>账号</th><th>分组</th><th>国家</th><th>代理IP</th><th>登录</th><th>2FA</th><th>备注</th><th>操作</th>
    </tr></thead><tbody>${rows.map(x=>{
        const more=[];
        const be=String(x.browser_backend||'').toLowerCase();
        const tkId=String(x.tkswarm_browser_profile_id||'').trim();
        const openId=be==='tkswarm'&&tkId?tkId:(x.browser_profile_id||'');
        if(x.browser_profile_id||tkId){
          more.push(`<button type="button" data-env="${this.esc(openId||x.browser_profile_id)}" data-env-backend="${this.esc(be)}" data-account-id="${Number(x.id)||0}" data-env-label="${this.esc('账号 '+(x.username||('#'+x.id)))}" onclick="app.browserActionFromBtn(this,'open')">打开环境</button>`);
          if(canWrite)more.push(`<button type="button" onclick="app.loginAccount(${x.id})">登录</button>`);
          if(this.canRebindBrowserEnv())more.push(`<button type="button" onclick="app.createAccountBrowser(${x.id},{rebind:true,ownerId:${Number(x.owner_id||0)}})">再绑环境</button>`);
        }else if(this.canEditBrowserEnvs()){
          more.push(`<button type="button" onclick="app.createAccountBrowser(${x.id},{rebind:false})">创建环境</button>`);
        }
        if(canWrite&&x.login_status==='online'&&!x.capcut_authorized)more.push(`<button type="button" onclick="app.authorizeCapCut(${x.id})">本地标记CapCut</button>`);
        if(canWrite&&x.capcut_authorized)more.push(`<button type="button" onclick="app.revokeCapCut(${x.id})">取消本地CapCut</button>`);
        if(canWrite)more.push(`<button type="button" onclick="app.pullTikTokStats(${x.id})">拉取数据</button>`);
        if(canEdit)more.push(`<button type="button" onclick="app.modifyAccountProfile(${x.id},'${this.esc(x.username)}')">修改资料</button>`);
        if(this.canAssignAccounts())more.push(`<button type="button" onclick="app.clearAccountOwner(${x.id},${JSON.stringify(x.username||'')})">清除关联人员</button>`);
        more.push(`<button type="button" onclick="app.viewTikTokData(${x.id})">查看数据</button>`);
        more.push(`<button type="button" onclick="app.openAccountNotifications(${x.id})">查看通知</button>`);
        more.push(`<button type="button" onclick="app.viewAccountDetail(${x.id})">查看详情</button>`);
        const editBtn=canEdit?`<button class="tiny" type="button" title="编辑" onclick='app.accountModal(${JSON.stringify(x)})'>编辑</button>`:'';
        const delBtn=canDelete?`<button class="tiny danger" type="button" title="删除" onclick="app.remove('/accounts/${x.id}','账号')">删除</button>`:'';
        const moreBtn=more.length?`<div class="ops-dropdown account-ops-dropdown"><button class="tiny" type="button" title="更多" onclick="app.toggleAccountOps(${x.id},event)">…</button><div id="account-ops-${x.id}" class="dropdown-menu ops-menu hidden">${more.join('')}</div></div>`:'';
        const accountCountryRaw=String(x.account_country||x.country||'').trim();
        const accountCountryLabel=accountCountryRaw&&typeof this.countryDisplayLabel==='function'?this.countryDisplayLabel(accountCountryRaw):accountCountryRaw;
        const proxyRegionLabel=[x.proxy_country,x.proxy_region,x.proxy_city].map(v=>String(v||'').trim()).filter(Boolean);
        const proxyRegionText=proxyRegionLabel.length?proxyRegionLabel.join(' · '):'';
        const proxyText=x.proxy_address||'';
        const notesCell=canEdit
          ?`<td class="notes-cell" title="点击编辑备注" style="cursor:pointer" onclick="event.stopPropagation();app.editAccountNotes(${x.id},${JSON.stringify(x.username||'')},${JSON.stringify(x.notes||'')})">${this.esc((x.notes||'-').slice(0,16))}</td>`
          :`<td class="notes-cell">${this.esc((x.notes||'-').slice(0,16))}</td>`;
        const ownerName=this.esc(x.owner_label||x.owner_nickname||x.owner_username||'-');
        const ownerUser=`<div>所属用户：${ownerName}${x.owner_username?` <span class="muted">@${this.esc(x.owner_username)}</span>`:''}</div>`;
        const companyLabel=String(x.company_name||x.companyName||'').trim()||'-';
        const industryLabel=String(x.industry_path||x.industryPath||'').trim()||'-';
        const ownerMeta=`<div class="account-owner-meta muted">${ownerUser}<div>所属行业：${this.esc(industryLabel)}</div><div>所属企业：${this.esc(companyLabel)}</div></div>`;
        return `<tr>
      <td><input class="account-check" type="checkbox" value="${x.id}"></td>
      <td class="account-name-cell"><b>${this.esc(x.username)}</b><div class="muted">#${x.id}${x.account_status==='banned'?' · 封号':''}${x.browser_profile_id||x.tkswarm_browser_profile_id?` · ${this.envBackendText(x.browser_backend||'tkswarm')}环境`:''}${this.bitBrowserUiEnabled?.()&&x.tkswarm_browser_profile_id&&String(x.browser_backend)!=='tkswarm'?` · 另有${this.tkswarmBrowserLabel()}`:''}</div>${ownerMeta}</td>
      <td>${this.esc(x.group_name||'-')}</td>
      <td title="${this.esc(accountCountryRaw)}">${accountCountryLabel?this.esc(accountCountryLabel):'<span class="muted">-</span>'}</td>
      <td title="${this.esc(proxyText)}">${this.esc(proxyText?proxyText.slice(0,28):'-')}${proxyRegionText?`<div class="muted">${this.esc(proxyRegionText)}</div>`:''}</td>
      <td class="login-status-cell" title="点击检测登录状态" style="cursor:pointer" onclick="event.stopPropagation();app.checkAccountLogin(${x.id})">${this.badge(x.login_status)}</td>
      <td>${x.has_totp?'<span class="badge success">已绑定</span>':'<span class="badge">未绑定</span>'}</td>
      ${notesCell}
      <td><div class="task-ops-cell account-ops-cell">${editBtn}${delBtn}${moreBtn}</div></td>
    </tr>`;
      }).join('')}</tbody></table>`;
    },
    toggleAccountOps(id,e){
      e?.stopPropagation?.();
      const target=document.querySelector('#account-ops-'+id);
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
    toggleAllAccounts(checked){document.querySelectorAll('.account-check').forEach(x=>{x.checked=checked});this.bindAccountChecks()},
    async batchDeleteAccounts(){if(!this.canPermission('account.delete')){this.toast('当前角色无权删除账号',true);return}const ids=[...document.querySelectorAll('.account-check:checked')].map(x=>Number(x.value));if(!ids.length){this.toast('请先选择要删除的账号',true);return}if(!(await this.ask(`确定删除选中的 ${ids.length} 个账号吗？账号密码和 2FA 密钥也会被删除；对应的浏览器环境不会自动删除。`)))return;try{const r=await this.api('/accounts/batch-delete',{method:'POST',body:JSON.stringify({accountIds:ids})});this.toast(`已删除 ${r.deleted} 个账号`);await this.loadRefs();this.refresh()}catch(e){this.toast(e.message,true)}},
    resetAccountFilters(){
      this.accountKeyword='';
      this.accountStatus='';
      this.accountCapcut='';
      this.accountSession='';
      this.accountAdvFilter={ownerId:'',companyId:'',industryId:'',hasEnv:''};
      this.accountSidebarOwnerId='';
      this.accountPage=1;
      this.invalidateAccountGroupsCache();
      this.refresh();
    },
    async openAccountAdvancedFilterModal(){
      if(!this.canAccountAdvancedFilter()){this.toast('当前角色不可使用高级筛选',true);return}
      const cur=this.accountAdvFilter||{ownerId:'',companyId:'',industryId:'',hasEnv:''};
      let opts={users:[],companies:[]};
      try{
        opts=await this.api('/auth/account-filter-options');
      }catch(e){
        this.toast(e.message||'加载筛选项失败',true);
        return;
      }
      const users=Array.isArray(opts.users)?opts.users:[];
      const companies=Array.isArray(opts.companies)?opts.companies:[];
      const userOpts=users.map((u)=>[String(u.id),`${u.nickname||u.username} · @${u.username}${u.role_name?`（${u.role_name}）`:''}`]);
      const companyOpts=companies.map((c)=>[String(c.id),`${c.name||'-'}${c.industryPath?` · ${c.industryPath}`:''}`]);
      const showOwner=this.canAccountPickOperatorFilter();
      const showIndustry=this.canAccountPickIndustryFilter();
      const cascade=showIndustry&&this.industryCascadeHtml?this.industryCascadeHtml('acct-adv-industry',cur.industryId||''):'';
      this.modal('高级筛选',`<div class="form-grid task-io-filters">
        ${showOwner?`<div class="field full"><label>运营专员用户</label>${this.selectRaw('ownerId','全部用户',[['','全部用户'],...userOpts],cur.ownerId||'')}</div>`:''}
        <div class="field full"><label>企业筛选</label>${this.selectRaw('companyId','全部企业',[['','全部企业'],...companyOpts],cur.companyId||'')}</div>
        ${showIndustry?`<div class="field full"><label>四级行业</label>${cascade||'<div class="muted">行业组件未加载</div>'}</div>`:''}
        <div class="field full"><label>浏览器环境</label>${this.selectRaw('hasEnv','不限',[['','不限'],['1','已绑定环境'],['0','未绑定环境']],cur.hasEnv||'')}</div>
        <div class="field full muted" style="font-size:12px">按账号归属、企业、行业及是否绑定浏览器环境过滤；留空表示不限制该项。</div>
      </div>`,async(d)=>{
        const industryId=this.getIndustryCascadeValue?Number(this.getIndustryCascadeValue('acct-adv-industry')||0):Number(d.industryId||0);
        const hasEnv=d.hasEnv==='1'||d.hasEnv==='0'?String(d.hasEnv):'';
        this.accountAdvFilter={
          ownerId:showOwner&&d.ownerId?String(d.ownerId):'',
          companyId:d.companyId?String(d.companyId):'',
          industryId:showIndustry&&industryId>0?String(industryId):'',
          hasEnv,
        };
        this.accountPage=1;
        this.closeModal();
        this.refresh();
      },false,{submitLabel:'应用筛选'});
      if(this.bindIndustryCascade){
        await this.bindIndustryCascade('acct-adv-industry',Number(cur.industryId||0));
      }
    },
    async searchAccounts(){this.accountKeyword=document.querySelector('#search')?.value||'';this.accountStatus=document.querySelector('#account-status')?.value||'';this.accountPage=1;this.refresh()},
    async loadOwnerAssignTargets(){
      try{
        const rows=await this.api('/auth/account-assign-targets');
        return (Array.isArray(rows)?rows:[]).map((u)=>{
          const name=u.nickname||u.username||('#'+u.id);
          const role=u.roleName?`（${u.roleName}）`:'';
          return {...u,id:Number(u.id),label:`${name} · @${u.username}${role}`};
        });
      }catch{
        return [];
      }
    },
    /** 再绑/重绑耗用额度用户：超管看全部启用用户；运营管理仍为运营专员/企业客户 */
    async loadRebindOwnerTargets(){
      const isSuper=!!(this.authIsSuper||this.authLoginUser?.isSuper||this.authUser?.isSuper);
      if(isSuper){
        const all=await this.loadGroupAssignTargets().catch(()=>[]);
        if(all.length)return all;
      }
      return this.loadOwnerAssignTargets().catch(()=>[]);
    },
    /** 分组分配：超管拉取全部用户；运营管理仍为运营专员/企业客户 */
    async loadGroupAssignTargets(){
      try{
        const rows=await this.api('/auth/group-assign-targets');
        return (Array.isArray(rows)?rows:[]).map((u)=>{
          const name=u.nickname||u.username||('#'+u.id);
          const role=u.roleName?`（${u.roleName}）`:'';
          return {...u,id:Number(u.id),label:`${name} · @${u.username}${role}`};
        });
      }catch{
        return [];
      }
    },
    ownerAssignLabel(u){
      const name=u.nickname||u.username||('#'+u.id);
      const role=u.roleName?`（${u.roleName}）`:'';
      return `${name} · @${u.username}${role}`;
    },
    async loadAccountCompanyOptions(){
      // 不缓存：企业数据页新增企业/用户后，账号弹框必须拿到最新企业列表
      try{
        const pack=await this.api('/auth/account-filter-options');
        this._accountCompanyOptions=Array.isArray(pack.companies)?pack.companies:[];
      }catch{
        this._accountCompanyOptions=[];
      }
      return this._accountCompanyOptions;
    },
    companyAssignFieldHtml(companies,curCompanyId='',opts={}){
      const mode=opts.mode||'edit';
      const blankLabel=mode==='batch'?'不修改':(opts.blankLabel||'不绑定企业');
      const prefix=mode==='batch'
        ?[['','不修改'],['__clear__','清除企业绑定']]
        :[['',blankLabel]];
      const companyOpts=prefix.concat((companies||[]).map((c)=>[
        String(c.id),
        `${c.name||'-'}${c.industryPath?` · ${c.industryPath}`:''}`,
      ]));
      const hint=opts.hint||'选择关联企业；账号行业请通过下方「四级行业」单独绑定，不会随企业自动变更。';
      return `<div class="field full account-company-bind" id="account-company-bind-wrap">${this.selectRaw('companyId','关联企业',companyOpts,String(curCompanyId||''))}<div class="muted account-company-bind-hint" style="margin-top:6px;font-size:12px">${hint}</div></div>`;
    },
    accountIndustryFieldHtml(industryId=0,opts={}){
      const mode=opts.mode||'edit';
      const prefix=opts.prefix||(mode==='batch'?'acct-batch-industry':'acct-edit-industry');
      if(typeof this.industryCascadeHtml!=='function'){
        return `<div class="field full"><label>四级行业</label><div class="muted">行业模块未加载</div></div>`;
      }
      const hint=mode==='batch'
        ?'不选择表示不修改；请选到最细一级后保存，或点「清除行业」移除绑定。'
        :'请通过四级联动选择账号所属行业；留空表示不绑定行业。';
      const clearBtn=`<button type="button" class="ghost tiny" style="margin-top:8px" onclick="app.clearIndustryCascade('${prefix}')">清除行业绑定</button>`;
      return `<div class="field full account-industry-bind" id="${prefix}-wrap">
        <label>四级行业</label>
        ${this.industryCascadeHtml(prefix,Number(industryId||0))}
        <div class="muted account-industry-hint" style="margin-top:6px;font-size:12px">${hint}</div>
        ${clearBtn}
      </div>`;
    },
    ownerAssignFieldsHtml(targets,curOwnerId='',opts={}){
      const blankLabel=opts.blankLabel||'请选择关联人员';
      const allowClear=opts.allowClear!==false;
      const ownerOpts=[['',blankLabel]];
      if(allowClear)ownerOpts.push(['__clear__','不关联任何人员']);
      for(const u of (targets||[]))ownerOpts.push([String(u.id),this.ownerAssignLabel(u)]);
      return this.selectRaw('ownerId','关联人员',ownerOpts,String(curOwnerId||''));
    },
    bindOwnerAssignHandlers(targets,companies,preferredCompanyId='',initialOwnerId='',opts={}){
      this._accountAssignTargets=targets||[];
      this._accountCompanyCatalog=companies||[];
      const ownerSel=document.querySelector('#modal-form select[name="ownerId"]');
      const companySel=document.querySelector('#modal-form select[name="companyId"]');
      const hintEl=document.querySelector('.account-company-bind-hint');
      if(!ownerSel||!companySel)return;
      const preferred=String(preferredCompanyId||'');
      const initialOwner=String(initialOwnerId||'');
      const mode=opts.mode||'edit';
      const blankCompany=mode==='batch'?'不修改':'不绑定企业';
      const renderCompanyOptions=(list,keepValue)=>{
        const cur=String(keepValue||companySel.value||'');
        const prefix=mode==='batch'
          ?[['','不修改'],['__clear__','清除企业绑定']]
          :[['',blankCompany]];
        companySel.innerHTML=prefix.map(([v,n])=>`<option value="${this.esc(v)}">${this.esc(n)}</option>`).join('')
          +(list||[]).map((c)=>`<option value="${c.id}">${this.esc(c.name||'-')}${c.industryPath?` · ${this.esc(c.industryPath)}`:''}</option>`).join('');
        if(cur&&[...companySel.options].some((o)=>o.value===cur))companySel.value=cur;
      };
      const sync=()=>{
        const rawOwner=String(ownerSel.value||'');
        if(rawOwner==='__clear__'){
          renderCompanyOptions(this._accountCompanyCatalog,'');
          companySel.value='';
          if(hintEl)hintEl.textContent='不关联任何人员时将同时清空关联企业。';
          return;
        }
        const uid=Number(rawOwner||0);
        const user=(this._accountAssignTargets||[]).find((u)=>Number(u.id)===uid);
        if(user?.roleType==='enterprise'){
          const userCompanies=Array.isArray(user.companies)?user.companies:[];
          renderCompanyOptions(userCompanies,companySel.value);
          const keepInitial=initialOwner&&String(uid)===initialOwner;
          const pick=keepInitial&&preferred&&userCompanies.some((c)=>String(c.id)===preferred)
            ?preferred
            :(userCompanies.length===1?String(userCompanies[0].id):'');
          if(pick)companySel.value=pick;
          if(hintEl)hintEl.textContent='企业客户需选择其关联企业；账号行业请通过「四级行业」单独绑定。';
          return;
        }
        renderCompanyOptions(this._accountCompanyCatalog,companySel.value);
        const keepInitial=initialOwner&&String(uid)===initialOwner;
        if(keepInitial&&preferred&&[...companySel.options].some((o)=>o.value===preferred))companySel.value=preferred;
        if(hintEl)hintEl.textContent=opts.hint||'选择关联企业；账号行业请通过「四级行业」单独绑定，不会随企业自动变更。';
      };
      ownerSel.addEventListener('change',sync);
      sync();
    },
    collectOwnerAssignPayload(data,targets){
      const raw=String(data.ownerId||'').trim();
      if(raw==='__clear__')return {ownerId:'__clear__',companyId:null};
      const ownerId=Number(raw||0);
      if(!ownerId)return {};
      const user=(targets||[]).find((u)=>Number(u.id)===ownerId);
      if(!user)throw new Error('请选择有效的关联人员');
      const companyRaw=String(data.companyId||'').trim();
      const companyId=companyRaw&&companyRaw!=='__clear__'?Number(companyRaw):0;
      if(user.roleType==='enterprise'){
        if(!companyId)throw new Error('企业客户需选择关联企业');
        return {ownerId,companyId};
      }
      // 运营专员：若表单选了企业则一并提交；未选则不带 companyId，避免误清空已有绑定
      return companyId>0?{ownerId,companyId}:{ownerId};
    },
    accountCountryProxyBlockHtml(opts={}){
      const mode=opts.mode||'single';
      const countryCode=opts.countryCode||'';
      const proxyId=opts.proxyId!=null&&opts.proxyId!==''?String(opts.proxyId):'';
      const proxyItems=opts.proxyItems||[];
      const accountCount=Number(opts.accountCount||0);
      const countryFieldOpts=mode==='batch'
        ?{id:'acct-batch-country',blankLabel:'不修改'}
        :{id:'acct-bind-country',blankLabel:'请选择国家',allowCustom:true};
      // 国家数据没加载到（接口失败/被清空）时退化成文本框，至少保证已保存值能回显、能继续保存
      const hasCountryOptions=(this._countryOptionsCache||[]).length>0;
      const countryField=typeof this.countrySelectField==='function'&&hasCountryOptions
        ?this.countrySelectField('国家/地区','country',countryCode,countryFieldOpts)
        :`<div class="field"><label>国家/地区</label><input class="input" name="country" id="${countryFieldOpts.id}" value="${this.esc(countryCode)}" placeholder="国家数据未加载，可直接填 US / 美国"></div>`;
      if(mode==='batch'){
        return `${countryField}<div class="field full account-proxy-pick-batch ${countryCode?'':'hidden'}" id="acct-batch-proxy-wrap"><label>代理（多选）</label><div class="account-proxy-multi-list muted">请先选择国家</div><div class="muted account-proxy-capacity-hint" style="margin-top:6px;font-size:12px">选择国家后按国家名匹配代理；每个代理最多绑定 3 个账号，请确保所选代理剩余额度 ≥ 已选 ${accountCount} 个账号。</div></div>`;
      }
      const list=countryCode&&typeof this.filterProxiesByCountryCode==='function'
        ?this.filterProxiesByCountryCode(proxyItems,countryCode)
        :[];
      const proxyOpts=[['','不绑定代理'],...list.map((p)=>[String(p.id),p.name])];
      const total=(proxyItems||[]).length;
      const hint=countryCode
        ?`公共池 ${total} 条，已按国家匹配 ${list.length} 条（每代理最多 3 个账号）`
        :'请先选择国家，再从匹配代理中选择一条';
      return `${countryField}<div class="field full account-proxy-pick-single"><label>代理</label>${this.selectRaw('proxyId','',proxyOpts,proxyId)}<div class="muted account-proxy-pick-hint" style="margin-top:6px;font-size:12px">${hint}</div></div>`;
    },
    renderAccountProxySingleOptions(proxyItems,countryCode,selectedId=''){
      const list=countryCode&&typeof this.filterProxiesByCountryCode==='function'
        ?this.filterProxiesByCountryCode(proxyItems,countryCode)
        :[];
      const sel=document.querySelector('#modal-form select[name="proxyId"]');
      const hint=document.querySelector('.account-proxy-pick-hint');
      if(!sel)return list;
      const prev=String(selectedId||sel.value||'');
      sel.innerHTML=[['','不绑定代理'],...list.map((p)=>[String(p.id),p.name])].map(([v,n])=>`<option value="${this.esc(v)}">${this.esc(n)}</option>`).join('');
      sel.value=[...sel.options].some((o)=>o.value===prev)?prev:'';
      if(hint){
        const total=(proxyItems||[]).length;
        hint.textContent=countryCode
          ?`公共池 ${total} 条，已按国家匹配 ${list.length} 条（每代理最多 3 个账号）`
          :'请先选择国家，再从匹配代理中选择一条';
      }
      return list;
    },
    renderAccountProxyBatchOptions(proxyItems,countryCode,selectedIds=[],accountCount=0){
      const wrap=document.querySelector('#acct-batch-proxy-wrap');
      const listEl=wrap?.querySelector('.account-proxy-multi-list');
      const hint=wrap?.querySelector('.account-proxy-capacity-hint');
      if(!wrap||!listEl)return;
      if(!countryCode){
        wrap.classList.add('hidden');
        listEl.innerHTML='请先选择国家';
        return;
      }
      wrap.classList.remove('hidden');
      const list=typeof this.filterProxiesByCountryCode==='function'
        ?this.filterProxiesByCountryCode(proxyItems,countryCode)
        :(proxyItems||[]);
      const picked=new Set((selectedIds||[]).map((x)=>String(x)));
      if(!list.length){
        const total=(proxyItems||[]).length;
        const noCountry=(proxyItems||[]).filter((p)=>!String(p.country||'').trim()).length;
        let tip='当前国家没有匹配代理，请更换国家或在代理管理中为国家字段填写与国家数据一致的内容。';
        if(total>0&&noCountry>0){
          tip+=`（公共池共 ${total} 条，其中 ${noCountry} 条未填写国家）`;
        }
        listEl.innerHTML=`<div class="muted">${tip}</div>`;
      }else{
        listEl.innerHTML=`<div class="account-proxy-multi-grid" style="display:grid;gap:8px;max-height:260px;overflow:auto;padding:4px 0">${list.map((p)=>{
          const id=String(p.id);
          const checked=picked.has(id)?'checked':'';
          const rem=Number(p.remaining??Math.max(0,3-Number(p.bindCount||0)));
          return `<label class="account-proxy-multi-item" style="display:flex;gap:8px;align-items:center"><input type="checkbox" class="acct-proxy-multi" value="${this.esc(id)}" ${checked}><span style="flex:1">${this.esc(p.name)}</span><small class="muted">余 ${rem}/3</small></label>`;
        }).join('')}</div>`;
      }
      this.refreshAccountProxyBatchCapacityHint(accountCount);
      if(hint){
        hint.textContent=`已选 ${accountCount} 个账号；按国家名匹配到 ${list.length} 条代理。请勾选足够数量的代理，保存前会校验剩余额度合计是否 ≥ 账号数。`;
      }
    },
    refreshAccountProxyBatchCapacityHint(accountCount=0){
      const hint=document.querySelector('.account-proxy-capacity-hint');
      const boxes=[...document.querySelectorAll('#modal-form .acct-proxy-multi:checked')];
      if(!hint)return;
      const need=Number(accountCount||0);
      let available=0;
      boxes.forEach((box)=>{
        const item=box.closest('.account-proxy-multi-item');
        const small=item?.querySelector('small')?.textContent||'';
        const m=small.match(/余\s*(\d+)/);
        available+=Number(m?.[1]||0);
      });
      const base=`已选 ${need} 个账号；已勾选 ${boxes.length} 个代理，剩余额度合计 ${available}`;
      hint.textContent=boxes.length
        ?`${base}${available<need?'（额度不足，请再选代理）':'（额度充足）'}`
        :`${base.replace('已勾选 0 个代理，剩余额度合计 0','尚未勾选代理')}。每个代理最多绑定 3 个账号。`;
    },
    bindAccountCountryProxyPicker(root,opts={}){
      const form=root||document.querySelector('#modal-form');
      if(!form)return;
      const mode=opts.mode||'single';
      if(opts.proxyItems)form._accountProxyItems=opts.proxyItems;
      const accountCount=Number(opts.accountCount||0);
      const countrySel=form.querySelector('select[name="country"]');
      if(!countrySel)return;
      const sync=()=>{
        const proxyItems=form._accountProxyItems||[];
        const code=String(countrySel.value||'').trim();
        if(mode==='batch'){
          const selected=[...form.querySelectorAll('.acct-proxy-multi:checked')].map((x)=>Number(x.value));
          this.renderAccountProxyBatchOptions(proxyItems,code,selected,accountCount);
          return;
        }
        this.renderAccountProxySingleOptions(proxyItems,code);
      };
      countrySel.addEventListener('change',sync);
      if(mode==='batch'){
        form.addEventListener('change',(e)=>{
          if(e.target?.classList?.contains('acct-proxy-multi'))this.refreshAccountProxyBatchCapacityHint(accountCount);
        });
      }
      sync();
    },
    collectAccountBatchProxyIds(root){
      return [...(root||document).querySelectorAll('.acct-proxy-multi:checked')].map((x)=>Number(x.value)).filter((id)=>id>0);
    },
    async accountModal(x={}){
      const isEdit=!!x.id;
      if(isEdit&&!this.canEditAccounts()){this.toast('当前角色无权编辑账号',true);return}
      if(!isEdit&&!this.canCreateAccounts()){this.toast('当前角色无权创建账号',true);return}
      const gs=this.accountGroupFlatOptions();
      let ownerField='';
      let companyField='';
      let assignTargets=[];
      let companyOptions=[];
      const assignLoads=[];
      if(this.canAssignAccounts()&&isEdit){
        assignLoads.push(this.loadOwnerAssignTargets(),this.loadAccountCompanyOptions());
      }else{
        assignLoads.push(this.loadOwnerAssignTargets().catch(()=>[]),Promise.resolve([]));
      }
      [assignTargets,companyOptions]=await Promise.all(assignLoads);
      this._accountAssignTargets=assignTargets||[];
      const proxyOwnerFilter=this.proxyCatalogOwnerFilter({
        ownerId:isEdit?Number(x.owner_id||0):0,
        useCurrentUser:!isEdit,
        targets:assignTargets,
      });
      await Promise.all([
        this.ensureProxyCatalogForAccounts({
          force:true,
          ownerId:isEdit?Number(x.owner_id||0):0,
          useCurrentUser:!isEdit,
          targets:assignTargets,
        }),
        typeof this.ensureCountryOptions==='function'?this.ensureCountryOptions():Promise.resolve(),
        typeof this.ensureIndustryFlat==='function'?this.ensureIndustryFlat():Promise.resolve(),
      ]);
      const proxyItems=this.proxySelectItems(null,{keepId:isEdit?(x.proxy_id||0):0});
      if(this.canAssignAccounts()&&isEdit){
        if(assignTargets.length){
          ownerField=this.ownerAssignFieldsHtml(assignTargets,String(x.owner_id||''),{blankLabel:'不修改关联人员',allowClear:true});
        }
        companyField=this.companyAssignFieldHtml(companyOptions,x.company_id||'',{blankLabel:'不绑定企业'});
      }
      const secretHint=x.id
        ?`<div class="field full"><div class="muted">密码 / 2FA / CK 留空表示不修改；已保存内容不会回显。当前 2FA：${x.has_totp?'已绑定':'未绑定'}；CK：${(x.has_session||x.session_saved)?'已有':'无'}。</div></div>`
        :`<div class="field full"><div class="muted">密码、2FA、CK 均为可选；2FA 密钥需 Base32；CK 需含 sessionid，保存后 AES 加密。</div></div>`;
      const proxyHint=`<div class="field full"><div class="muted account-proxy-scope-hint">${this.proxyCatalogScopeHint(proxyOwnerFilter,proxyItems.length)}。未选择表示不绑定。</div></div>`;
      // 编辑账号：执行后端 + 各后端已绑定的环境 ID（切换后端时自动带出）
      // Linux 服务器浏览器不再手动绑定（与桌面自研共用 EL 环境包；AI 拓客/客服坐席拉包执行），
      // 历史数据里 binding 为 linux 的账号按下拉里仍有的自研后端回显。
      const rawBackend=this.normalizeEnvBackend(x.browser_backend||x.browser_type)||(this.defaultTaskBrowserBackend?.()||'tkswarm');
      const curBackend=rawBackend==='linux'||(rawBackend==='bit'&&!(this.bitBrowserUiEnabled?.()))
        ?'tkswarm'
        :rawBackend;
      const envIdsByBackend={
        bit:rawBackend==='bit'?(x.browser_profile_id||''):'',
        tkswarm:curBackend==='tkswarm'
          ?(x.tkswarm_browser_profile_id||(rawBackend==='tkswarm'?(x.browser_profile_id||''):'')||'')
          :(x.tkswarm_browser_profile_id||''),
      };
      this._accountEnvIds=envIdsByBackend;
      // 编辑回显：已保存国家优先按 ISO 归一后再选中；国家数据没加载到时补拉一次，
      // 归一后的码不在国家数据里则保留原值（下拉用自定义项回显），避免打开编辑就变成空白。
      if(!(this._countryOptionsCache||[]).length&&typeof this.ensureCountryOptions==='function'){
        await this.ensureCountryOptions(true);
      }
      const savedCountry=String(x.account_country||x.country||'').trim();
      let initCountry=savedCountry;
      if(savedCountry&&typeof this.resolveAccountCountryCode==='function'){
        const isoCountry=this.resolveAccountCountryCode(savedCountry);
        const knownCountry=!!isoCountry&&(this._countryOptionsCache||[]).some((c)=>this.countryMatchValue(c,isoCountry));
        initCountry=knownCountry?isoCountry:savedCountry;
        if(!knownCountry){
          // 已保存值不在国家数据里（历史脏数据 / 国家被停用删除）：保留原值回显，避免下拉静默变空白
          console.warn('[account] 账号国家未匹配到国家数据，按原值回显：',savedCountry,'已加载国家数：',(this._countryOptionsCache||[]).length);
        }
      }
      const countryProxyBlock=this.accountCountryProxyBlockHtml({
        mode:'single',
        countryCode:initCountry,
        proxyId:x.proxy_id||'',
        proxyItems,
      });
      const industryField=(isEdit&&this.canEditAccounts())||(!isEdit&&this.canCreateAccounts())
        ?this.accountIndustryFieldHtml(x.industry_id||0,{mode:'edit'})
        :'';
      this.modal(x.id?'编辑账号':'添加账号',`<div class="form-grid"><input type="hidden" name="id" value="${x.id||''}">${this.field('username','账号名称',x.username,'text',true)}${this.field('nickname','昵称',x.nickname)}${this.select('groupId','账号分组',gs,x.group_id)}${countryProxyBlock}${proxyHint}${industryField}${ownerField}${companyField}<div class="field"><label>执行后端</label><select name="browserBackend" onchange="app.onEditAccountBackendChange(this.value)">${this.envBackendPairs().map(([v,n])=>`<option value="${v}" ${v===curBackend?'selected':''}>${n}</option>`).join('')}</select><small class="muted">任务按此选择打开对应客户端；保存时环境 ID 会写入该后端对应的列。Linux 服务器浏览器强制 Electron（EL）核，与桌面自研共用环境包；AI 拓客与客服坐席缺包时等待本机推送，不在此手动绑定。</small></div><div class="field"><label>环境 ID</label><input name="browserProfileId" value="${this.esc(envIdsByBackend[curBackend]||'')}" placeholder="留空表示不绑定"><small class="muted" id="edit-env-hint">当前：${this.esc(this.envBackendText(curBackend))}。切换后端后请确认环境 ID 属于该客户端。</small></div>${this.selectRaw('loginStatus','登录状态',this.loginStatusPairs(),x.login_status||'offline')}${this.selectRaw('dmChannel','私信通道',[['auto','自动（有指纹走 API）'],['api','仅 API'],['browser','仅浏览器']],x.dm_channel||'auto')}${this.field('notes','备注',x.notes,'textarea')}${secretHint}${this.field('password',x.id?'新密码（留空不改）':'密码','','password')}${this.field('totpSecret',x.id?'新 2FA 密钥（留空不改）':'2FA 密钥','','password')}${this.field('cookie',x.id?'Cookie / CK（留空不改）':'Cookie / CK','','textarea')}${this.field('fingerprint','指纹备注（可选）')}</div>`,async data=>{
        const id=data.id;delete data.id;
        const password=String(data.password||'').trim();
        const totpSecret=String(data.totpSecret||'').trim();
        const cookie=String(data.cookie||'').trim();
        const fingerprint=String(data.fingerprint||'').trim();
        delete data.password;delete data.totpSecret;delete data.cookie;delete data.fingerprint;
        data.groupId=data.groupId?Number(data.groupId):null;
        const countryRaw=String(data.country||'').trim();
        data.country=typeof this.resolveAccountCountryCode==='function'
          ?this.resolveAccountCountryCode(countryRaw)
          :countryRaw;
        data.proxyId=data.proxyId?Number(data.proxyId):null;
        if(!data.proxyId)delete data.proxyId;
        data.chatStatus=x.chat_status||'offline';
        data.enabled=true;
        const accountIdForCheck=Number(id||x.id||0);
        if(data.proxyId){
          const check=await this.api('/accounts/proxy-bind-check',{method:'POST',body:JSON.stringify({proxyId:data.proxyId,accountIds:accountIdForCheck>0?[accountIdForCheck]:[]})});
          if(!check.allowed){
            await this.ask(check.message||'该代理绑定后将超过上限（最多 3 个账号）','error');
            throw new Error(check.message||'代理绑定数量超限');
          }
        }
        if(String(data.ownerId||'')==='__clear__'){
          Object.assign(data,this.collectOwnerAssignPayload(data,assignTargets));
        }else if(data.ownerId){
          Object.assign(data,this.collectOwnerAssignPayload(data,assignTargets));
        }else{
          delete data.ownerId;
          if(this.canAssignAccounts()&&isEdit&&Object.prototype.hasOwnProperty.call(data,'companyId')){
            const companyVal=String(data.companyId||'').trim();
            data.companyId=companyVal&&companyVal!=='__clear__'?Number(companyVal):null;
          }else{
            delete data.companyId;
          }
        }
        if(industryField){
          const prefix='acct-edit-industry';
          const cleared=document.querySelector('#'+prefix)?.dataset?.cleared==='1';
          const industryVal=typeof this.getIndustryCascadeValue==='function'?Number(this.getIndustryCascadeValue(prefix)||0):Number(data.industryId||0);
          data.industryId=cleared?'__clear__':(industryVal>0?industryVal:0);
        }
        const saved=await this.api(id?`/accounts/${id}`:'/accounts',{method:id?'PUT':'POST',body:JSON.stringify(data)});
        const accountId=Number(id||saved?.id||0);
        if(!accountId)throw new Error('账号保存成功但未返回 ID');
        if(password||totpSecret){
          await this.api(`/accounts/${accountId}/secrets`,{method:'PUT',body:JSON.stringify({password,totpSecret})});
        }
        if(cookie){
          await this.api(`/accounts/${accountId}/session`,{method:'PUT',body:JSON.stringify({cookie,fingerprint})});
        }
        this.toast('账号已保存');
        this.closeModal();
        this.refresh();
      });
      if(assignTargets.length||companyField)this.bindOwnerAssignHandlers(assignTargets,companyOptions,isEdit?String(x.company_id||''):'',isEdit?String(x.owner_id||''):'');
      const ownerSel=document.querySelector('#modal-form select[name="ownerId"]');
      const modalForm=document.querySelector('#modal-form');
      this.bindAccountCountryProxyPicker(modalForm,{mode:'single',proxyItems});
      if(industryField&&typeof this.bindIndustryCascade==='function'){
        await this.bindIndustryCascade('acct-edit-industry',Number(x.industry_id||0));
      }
      if(ownerSel){
        ownerSel.addEventListener('change',async()=>{
          const oid=Number(ownerSel.value||0);
          try{
            const list=await this.ensureProxyCatalogForAccounts({
              force:true,
              ownerId:oid>0?oid:0,
              useCurrentUser:!(oid>0),
              targets:assignTargets,
            });
            const keepId=Number(modalForm?.querySelector('select[name="proxyId"]')?.value||x.proxy_id||0);
            const items=this.proxySelectItems(list,{keepId});
            if(modalForm)modalForm._accountProxyItems=items;
            const code=modalForm?.querySelector('select[name="country"]')?.value||initCountry;
            this.renderAccountProxySingleOptions(items,code,keepId||'');
            const filterId=this.proxyCatalogOwnerFilter({
              ownerId:oid>0?oid:0,
              useCurrentUser:!(oid>0),
              targets:assignTargets,
            });
            const scopeEl=modalForm?.querySelector('.account-proxy-scope-hint');
            if(scopeEl){
              scopeEl.textContent=`${this.proxyCatalogScopeHint(filterId,items.length)}。未选择表示不绑定。`;
            }
          }catch{}
        });
      }
    },
    editAccountNickname(id,username,nickname=''){if(!this.canEditAccounts()){this.toast('当前角色无权修改昵称',true);return}this.modal('编辑昵称',`<div class="form-grid"><div class="field full"><div class="muted">账号：${this.esc(username||('#'+id))}。仅更新本系统展示昵称，不会改 TikTok。</div></div>${this.field('nickname','昵称',nickname||'')}</div>`,async d=>{await this.api(`/accounts/${id}/nickname`,{method:'PATCH',body:JSON.stringify({nickname:d.nickname||''})});this.toast('昵称已更新');this.closeModal();this.refresh()})},
    editAccountBanStatus(id){
      if(!this.canEditAccounts()){this.toast('当前角色无权修改封禁状态',true);return}
      const dt=v=>v?String(v).replace(' ','T').slice(0,16):'';
      this.api(`/accounts/${id}`).then(x=>{
        const cur=String(x.account_status||'normal');
        const html=`<div class="form-grid">
          <div class="field full"><div class="muted">账号：${this.esc(x.username||('#'+id))}。标记为封禁时，若填了解封时间，到点后系统会自动恢复为「正常」；留空表示需要人工处理。</div></div>
          <div class="field"><label>账号状态</label><select name="status">
            <option value="normal"${cur==='banned'?'':' selected'}>正常</option>
            <option value="banned"${cur==='banned'?' selected':''}>封禁</option>
          </select></div>
          <div class="field"><label>解封时间</label><input type="datetime-local" name="banUntil" value="${this.esc(dt(x.ban_until))}"></div>
          <div class="field full"><label>原因解释</label><textarea name="reason" rows="3" placeholder="例如：违反社区规范被封禁 7 天">${this.esc(x.ban_reason||'')}</textarea></div>
        </div>`;
        this.modal('修改账号封禁状态',html,async d=>{
          await this.api(`/accounts/${id}/ban-status`,{method:'PATCH',body:JSON.stringify({status:d.status,reason:d.reason||'',banUntil:d.banUntil||''})});
          this.toast('封禁状态已更新');
          this.closeModal();
          this.refresh();
        });
      }).catch(e=>this.toast(e.message,true));
    },
    editAccountNotes(id,username,notes=''){if(!this.canEditAccounts()){this.toast('当前角色无权修改备注',true);return}this.modal('编辑备注',`<div class="form-grid"><div class="field full"><div class="muted">账号：${this.esc(username||('#'+id))}</div></div>${this.field('notes','备注',notes||'','textarea')}<div class="field full"><div class="muted">备注仅保存在本系统，不会写入 TikTok。</div></div></div>`,async d=>{await this.api(`/accounts/${id}/notes`,{method:'PATCH',body:JSON.stringify({notes:d.notes||''})});this.toast('备注已更新');this.closeModal();this.refresh()})},
    openAccountIo(tab){
      const canImport=this.canImportAccounts();
      const canExport=this.canExportAccounts();
      if(tab==='import'&&!canImport){this.toast('当前角色无权导入账号',true);return}
      if(tab==='export'&&!canExport){this.toast('当前角色无权导出账号',true);return}
      if(!tab){tab=canExport?'export':(canImport?'import':'export')}
      if(tab==='import'&&!canImport&&canExport)tab='export';
      if(tab==='export'&&!canExport&&canImport)tab='import';
      if(!canImport&&!canExport){this.toast('当前角色无权导入导出',true);return}
      this.view='accounts';
      this.accountPane='io';
      this.accountIoTab=tab==='import'?'import':'export';
      if(!Array.isArray(this.accountIoFields)||!this.accountIoFields.length)this.accountIoFields=this.defaultAccountIoFields();
      this.refresh();
    },
    closeAccountIo(){this.accountPane='list';this.refresh()},
    switchAccountIoTab(tab){
      if(tab==='import'&&!this.canImportAccounts()){this.toast('当前角色无权导入账号',true);return}
      if(tab==='export'&&!this.canExportAccounts()){this.toast('当前角色无权导出账号',true);return}
      this.accountIoTab=tab==='import'?'import':'export';this.refresh();
    },
    defaultAccountIoFields(){
      const fromMeta=this.meta?.exportFields;
      if(Array.isArray(fromMeta)&&fromMeta.length){
        return fromMeta.map(x=>({key:x.code,label:x.label||x.code,on:x.defaultOn!==false}));
      }
      return [
        {key:'id',label:'ID',on:false},
        {key:'username',label:'账号',on:true},
        {key:'nickname',label:'昵称',on:true},
        {key:'country',label:'国家',on:true},
        {key:'group',label:'分组',on:true},
        {key:'proxy',label:'代理',on:true},
        {key:'login',label:'登录状态',on:true},
        {key:'session',label:'会话',on:true},
        {key:'capcut',label:'CapCut',on:true},
        {key:'status',label:'账号状态',on:true},
        {key:'chat',label:'客服状态',on:false},
        {key:'notes',label:'备注',on:false},
        {key:'created_at',label:'创建时间',on:false},
        {key:'browser',label:'浏览器环境ID',on:false},
      ];
    },
    async renderAccountIo(){
      document.querySelector('#content').classList.remove('chat-mode');
      const tab=this.accountIoTab||'export';
      if(!Array.isArray(this.accountIoFields)||!this.accountIoFields.length)this.accountIoFields=this.defaultAccountIoFields();
      const f=this.accountIoFilter||{};
      await this.loadRefs();
      await Promise.all([
        this.ensureProxyCatalogForAccounts({force:true,useCurrentUser:true}),
        typeof this.ensureCountryOptions==='function'?this.ensureCountryOptions():Promise.resolve(),
      ]);
      if(!this.meta?.importFormats?.length)await this.loadMeta();
      const gs=this.accountGroupFlatOptions();
      document.querySelector('#content').innerHTML=`<div class="panel task-io-panel account-io-panel">
        <div class="task-io-head">
          <button class="ghost" type="button" onclick="app.closeAccountIo()">← 返回账号列表</button>
          <div class="task-io-title-row">
            <b class="task-io-title">导入导出</b>
            <span class="muted">导出可自定义字段与表头；导入使用固定多格式文本模板</span>
          </div>
        </div>
        <div class="subtabs" style="margin-bottom:14px">
          ${this.canExportAccounts()?`<button type="button" class="${tab==='export'?'active':''}" onclick="app.switchAccountIoTab('export')">导出数据</button>`:''}
          ${this.canImportAccounts()?`<button type="button" class="${tab==='import'?'active':''}" onclick="app.switchAccountIoTab('import')">导入数据</button>`:''}
        </div>
        ${tab==='import'?this.accountIoImportBody(gs):this.accountIoExportBody(f,gs)}
      </div>`;
    },
    accountIoExportBody(f,gs){
      f=f||{};
      gs=gs||[];
      const loginOpts=[['','全部登录状态'],...this.loginStatusPairs()];
      const statusOpts=[['','全部账号状态'],['normal','正常'],['banned','封号']];
      const fields=this.accountIoFields||[];
      return `<div class="task-io-export">
        <div class="form-grid task-io-filters">
          <div class="field"><label>关键词</label><input id="aio-keyword" class="input" type="search" placeholder="账号 / 昵称 / 备注" value="${this.esc(f.keyword||'')}"></div>
          <div class="field"><label>登录状态</label><select id="aio-login" class="input">${loginOpts.map(([v,n])=>`<option value="${this.esc(v)}" ${String(f.login||'')===v?'selected':''}>${this.esc(n)}</option>`).join('')}</select></div>
          <div class="field"><label>账号状态</label><select id="aio-status" class="input">${statusOpts.map(([v,n])=>`<option value="${this.esc(v)}" ${String(f.accountStatus||'')===v?'selected':''}>${this.esc(n)}</option>`).join('')}</select></div>
          <div class="field"><label>分组</label><select id="aio-group" class="input"><option value="">全部分组</option><option value="none" ${f.groupId==='none'?'selected':''}>未分组</option>${gs.map(g=>`<option value="${g.id}" ${String(f.groupId||'')===String(g.id)?'selected':''}>${this.esc(g.name)}</option>`).join('')}</select></div>
          ${typeof this.countrySelectField==='function'
            ?this.countrySelectField('国家','country',f.country||'',{id:'aio-country',blankLabel:'全部国家',allowCustom:true})
            :`<div class="field"><label>国家</label><input id="aio-country" class="input" placeholder="可空" value="${this.esc(f.country||'')}"></div>`}
          <div class="field"><label>CapCut</label><select id="aio-capcut" class="input"><option value="">全部</option><option value="1" ${f.capcut==='1'?'selected':''}>本地已标</option><option value="0" ${f.capcut==='0'?'selected':''}>未标记</option></select></div>
          <div class="field"><label>会话 CK</label><select id="aio-session" class="input"><option value="">全部</option><option value="1" ${f.session==='1'?'selected':''}>有CK</option></select></div>
          <div class="field"><label>ID 最小</label><input id="aio-id-min" class="input" type="number" min="0" placeholder="可空" value="${this.esc(f.idMin||'')}"></div>
          <div class="field"><label>ID 最大</label><input id="aio-id-max" class="input" type="number" min="0" placeholder="可空" value="${this.esc(f.idMax||'')}"></div>
          <div class="field"><label>仅勾选账号</label><select id="aio-selected-only" class="input"><option value="0">否（按筛选）</option><option value="1" ${f.selectedOnly?'selected':''}>是（列表页勾选）</option></select></div>
          <div class="field"><label>导出格式</label><select id="aio-format" class="input"><option value="csv" ${!f.format||f.format==='csv'?'selected':''}>CSV</option><option value="txt" ${f.format==='txt'?'selected':''}>TXT</option><option value="json" ${f.format==='json'?'selected':''}>JSON</option></select></div>
        </div>
        <div class="field full" style="margin:12px 0 8px"><label>导出字段与表头（勾选并自定义表头名）</label></div>
        <div class="table-container task-io-fields-table" style="margin-bottom:14px">
          <table><thead><tr><th style="width:56px">导出</th><th>字段</th><th>表头名</th></tr></thead>
          <tbody>${fields.map((x,i)=>`<tr>
            <td><input type="checkbox" class="aio-field-on" data-idx="${i}" ${x.on?'checked':''}></td>
            <td><code>${this.esc(x.key)}</code></td>
            <td><input class="input aio-field-label" data-idx="${i}" value="${this.esc(x.label||'')}" style="width:100%;max-width:280px"></td>
          </tr>`).join('')}</tbody></table>
        </div>
        <div class="action-bar">
          <button class="primary" type="button" onclick="app.submitAccountIoExport()">导出</button>
          <button class="ghost" type="button" onclick="app.resetAccountIoExport()">重置筛选与字段</button>
        </div>
      </div>`;
    },
    accountIoImportBody(gs){
      gs=gs||[];
      const pgs=this.ownedGroups('proxy');
      const proxyItems=this.proxySelectItems();
      const formats=this.meta?.importFormats||[{id:'auto',label:'自动识别'}];
      const formatOpts=formats.map(f=>`<option value="${this.esc(f.id)}"${f.id==='auto'?' selected':''}>${this.esc(f.label)}</option>`).join('');
      return `<div class="task-io-import">
        <div class="shell-note" style="margin:0 0 14px">
          <b>固定格式说明：</b>每行一条账号，支持账号----密码、账号----密码----2FA、账号----密码----CK、账号----CK、仅 CK、邮箱----密码----用户名----国家、以及 JSON 行。<br>
          密码与 CK 本地 AES 加密；重复账号自动跳过。可先下载模板对照填写。
        </div>
        <div class="action-bar" style="margin-bottom:12px">
          <button class="primary" type="button" onclick="app.downloadAccountImportTemplate()">下载导入模板</button>
          <label class="ghost" style="display:inline-flex;align-items:center;padding:8px 14px;cursor:pointer;border:1px solid #dcdfe6;border-radius:4px">选择文本文件<input type="file" accept=".txt,.csv,text/plain,text/csv" hidden onchange="app.loadAccountImportFile(this)"></label>
        </div>
        <div class="form-grid">
          <div class="field"><label>账号分组</label><select id="aio-import-group" class="input"><option value="">不指定</option>${gs.map(g=>`<option value="${g.id}">${this.esc(g.name)}</option>`).join('')}</select></div>
          <div class="field"><label>账号格式</label><select id="aio-import-format" class="input">${formatOpts}</select></div>
          <div class="field"><label>代理绑定方式</label><select id="aio-import-proxy-strategy" class="input"><option value="none" selected>不绑定代理</option><option value="sequential">按代理顺序绑定</option><option value="single">全部绑定同一代理</option></select></div>
          <div class="field"><label>顺序代理分组</label><select id="aio-import-proxy-group" class="input"><option value="">不指定</option>${pgs.map(g=>`<option value="${g.id}">${this.esc(g.name)}</option>`).join('')}</select></div>
          <div class="field"><label>统一绑定代理</label><select id="aio-import-proxy" class="input"><option value="">不指定</option>${proxyItems.map(p=>`<option value="${p.id}">${this.esc(p.name)}</option>`).join('')}</select></div>
          <div class="field"><label>浏览器类型</label><select id="aio-import-browser" class="input">${this.browserTypePairs().map(([v,n])=>`<option value="${this.esc(v)}" ${v===(this.defaultTaskBrowserBackend?.()||'tkswarm')?'selected':''}>${this.esc(n)}</option>`).join('')}</select></div>
          ${typeof this.countrySelectField==='function'
            ?this.countrySelectField('国家/地区','country','',{id:'aio-import-country',blankLabel:'不指定'})
            :`<div class="field"><label>国家/地区</label><input id="aio-import-country" class="input" placeholder="可空"></div>`}
          <div class="field full"><label>账号列表</label><textarea id="aio-import-content" class="input" rows="12" placeholder="每行一条账号，或选择文件自动填入"></textarea></div>
        </div>
        <div class="action-bar" style="margin-top:14px">
          <button class="primary" type="button" onclick="app.submitAccountIoImport()">开始导入</button>
        </div>
        <div id="aio-import-result" class="muted" style="margin-top:12px"></div>
      </div>`;
    },
    collectAccountIoExportForm(){
      const fields=(this.accountIoFields||[]).map((x,i)=>{
        const on=!!document.querySelector(`.aio-field-on[data-idx="${i}"]`)?.checked;
        const label=document.querySelector(`.aio-field-label[data-idx="${i}"]`)?.value ?? x.label;
        return {...x,on,label:String(label||x.key).trim()||x.key};
      });
      this.accountIoFields=fields;
      this.accountIoFilter={
        keyword:document.querySelector('#aio-keyword')?.value||'',
        login:document.querySelector('#aio-login')?.value||'',
        accountStatus:document.querySelector('#aio-status')?.value||'',
        groupId:document.querySelector('#aio-group')?.value||'',
        country:document.querySelector('#aio-country')?.value||'',
        capcut:document.querySelector('#aio-capcut')?.value||'',
        session:document.querySelector('#aio-session')?.value||'',
        idMin:document.querySelector('#aio-id-min')?.value||'',
        idMax:document.querySelector('#aio-id-max')?.value||'',
        selectedOnly:document.querySelector('#aio-selected-only')?.value==='1',
        format:document.querySelector('#aio-format')?.value||'csv',
      };
      return {filter:this.accountIoFilter,fields};
    },
    resetAccountIoExport(){
      this.accountIoFilter={};
      this.accountIoFields=this.defaultAccountIoFields();
      this.refresh();
    },
    async submitAccountIoExport(){
      if(!this.canExportAccounts()){this.toast('当前角色无权导出账号',true);return}
      const {filter,fields}=this.collectAccountIoExportForm();
      const selected=fields.filter(x=>x.on);
      if(!selected.length){this.toast('请至少勾选一个导出字段',true);return}
      const format=filter.format||'csv';
      const q=new URLSearchParams({format,fields:selected.map(x=>x.key).join(',')});
      q.set('headers',JSON.stringify(Object.fromEntries(selected.map(x=>[x.key,x.label]))));
      if(filter.selectedOnly){
        const ids=this.selectedAccountIds?.()||[];
        if(!ids.length){this.toast('请先在账号列表勾选要导出的账号',true);return}
        q.set('ids',ids.join(','));
      }else{
        if(filter.keyword)q.set('keyword',filter.keyword);
        if(filter.login)q.set('status',filter.login);
        if(filter.accountStatus)q.set('accountStatus',filter.accountStatus);
        if(filter.groupId)q.set('groupId',filter.groupId);
        if(filter.country)q.set('country',filter.country);
        if(filter.capcut!=='')q.set('capcut',filter.capcut);
        if(filter.session)q.set('session',filter.session);
        if(filter.idMin)q.set('idMin',filter.idMin);
        if(filter.idMax)q.set('idMax',filter.idMax);
      }
      try{
        const headers=this.authToken?{Authorization:'Bearer '+this.authToken}:{};
        const acting=this.getActingAsId();if(acting)headers['X-Acting-As']=String(acting);
        const base=window.TKSWARM_API_BASE||window.__TKSWARM_CONFIG__?.defaultApiBase||'';
        const r=await fetch(base+'/api/accounts/export?'+q.toString(),{headers});
        if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.message||'导出失败')}
        const text=await r.text();
        if(format==='json'){
          if(!String(text||'').trim()||text.trim()==='[]'){this.toast('没有可导出的账号',true);return}
        }else{
          const lines=String(text||'').split(/\r?\n/).filter(x=>String(x).trim());
          if(lines.length<=(format==='csv'?1:0)){this.toast('没有可导出的账号',true);return}
        }
        const mime=format==='json'?'application/json;charset=utf-8':(format==='csv'?'text/csv;charset=utf-8':'text/plain;charset=utf-8');
        const blob=new Blob([text],{type:mime});
        const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;
        a.download=format==='json'?'accounts-export.json':(format==='csv'?'accounts-export.csv':'accounts-export.txt');
        a.click();URL.revokeObjectURL(url);
        this.toast('账号已导出');
      }catch(e){this.toast(e.message,true)}
    },
    loadAccountImportFile(input){
      const file=input?.files?.[0];if(input)input.value='';
      if(!file)return;
      const reader=new FileReader();
      reader.onload=()=>{const box=document.querySelector('#aio-import-content');if(box)box.value=String(reader.result||'');this.toast(`已读入 ${file.name}`)};
      reader.onerror=()=>this.toast('读取文件失败',true);
      reader.readAsText(file);
    },
    async submitAccountIoImport(){
      if(!this.canImportAccounts()){this.toast('当前角色无权导入账号',true);return}
      const content=document.querySelector('#aio-import-content')?.value||'';
      if(!String(content).trim()){this.toast('请先粘贴账号列表或选择文件',true);return}
      if(!(await this.ask('将按固定模板导入账号，是否继续？')))return;
      try{
        const proxyStrategy=document.querySelector('#aio-import-proxy-strategy')?.value||'none';
        const bindProxy=proxyStrategy==='sequential'||proxyStrategy==='single';
        const r=await this.api('/accounts/batch-import',{method:'POST',body:JSON.stringify({
          content,
          format:document.querySelector('#aio-import-format')?.value||'auto',
          groupId:document.querySelector('#aio-import-group')?.value?Number(document.querySelector('#aio-import-group').value):null,
          proxyStrategy,
          proxyGroupId:bindProxy&&document.querySelector('#aio-import-proxy-group')?.value?Number(document.querySelector('#aio-import-proxy-group').value):null,
          proxyId:bindProxy&&document.querySelector('#aio-import-proxy')?.value?Number(document.querySelector('#aio-import-proxy').value):null,
          browserType:document.querySelector('#aio-import-browser')?.value||(this.defaultTaskBrowserBackend?.()||'tkswarm'),
          country:(()=>{
            const raw=document.querySelector('#aio-import-country')?.value||'';
            return typeof this.resolveAccountCountryCode==='function'?this.resolveAccountCountryCode(raw):raw;
          })(),
        })});
        const box=document.querySelector('#aio-import-result');
        let message=`成功 ${r.imported||0}，重复 ${r.duplicates||0}，错误 ${(r.errors||[]).length}`;
        if(r.errors?.length)message+=`；首个错误在第 ${r.errors[0].line} 行：${r.errors[0].reason}`;
        if(box)box.textContent=message;
        this.toast(r.imported?`已导入 ${r.imported} 个账号`:message,!r.imported);
        await this.loadRefs();
        if(r.imported){
          setTimeout(()=>{
            if(this.accountPane==='io')this.closeAccountIo();
          },1500);
        }
      }catch(e){this.toast(e.message,true)}
    },
  
    async batchAccountModal(){return this.openAccountIo('import')},
    downloadAccountImportTemplate(){
      const text=[
        '# TkSwarm 账号导入模板（删除说明行后导入）',
        '# 格式一：账号----密码',
        'demo_user----Passw0rd!',
        '# 格式二：账号----密码----2FA(Base32)',
        'demo_user2----Passw0rd!----JBSWY3DPEHPK3PXP',
        '# 格式三：账号----密码----CK',
        'demo_user3----Passw0rd!----sessionid=xxxxx; sid_tt=yyyyy',
        '# 格式四：账号----CK',
        'demo_user4----sessionid=xxxxx; sid_tt=yyyyy',
        '# 格式五：仅 CK（将自动生成临时用户名）',
        'sessionid=xxxxx; sid_tt=yyyyy',
        '# 格式六：邮箱----密码----用户名----国家',
        'user@mail.com----Passw0rd!----tiktok_name----US',
        '# 格式七：JSON 每行一条',
        '{"username":"json_user","password":"Passw0rd!","country":"US","cookie":"sessionid=xxx"}',
      ].join('\n');
      const blob=new Blob([text],{type:'text/plain;charset=utf-8'});
      const a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download='tkswarm-account-import-template.txt';
      a.click();
      setTimeout(()=>URL.revokeObjectURL(a.href),1000);
      this.toast('模板已下载');
    },
    async checkAccountLogin(id){
      if(!(await this.ask('是否检测该账号的 TikTok 登录状态？')))return;
      if(!(await this.ensureBitOnline('检测登录')))return;
      this.toast('正在检测 TikTok 登录状态...');
      try{
        const a=await this.api(`/accounts/${id}`);
        if(!a.browser_profile_id){this.toast('账号尚未绑定浏览器环境',true);return}
        const r=await this.api(`/browser/profiles/${a.browser_profile_id}/tiktok-status`,{method:'POST'});
        this.toast(r.loggedIn?'TikTok 已登录，状态已保存':'未检测到有效登录会话',!r.loggedIn);
        this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    async runAccountDiagnose(id){
      if(!(await this.ensureBitOnline('账号诊断')))return;
      try{
        const r=await this.api(`/accounts/${id}/diagnose`,{method:'POST',body:JSON.stringify({})});
        this.toast(r?.batch_id?`诊断任务已创建（总任务 #${r.batch_id}）`:'诊断任务已创建');
      }catch(e){this.toast(e.message,true)}
    },
    async viewDiagnostics(id){
      try{
        const pack=await this.api(`/accounts/${id}/diagnosis-records`).catch(()=>({items:[]}));
        const items=pack?.items||pack?.list||[];
        const labelMap={ 'account-check':'Account Check','account-standing':'Account Standing','chr':'CHR 健康分','studio-miss':'入口未找到' };
        const html=items.length?items.map(f=>{
          const name=f.screenshotPath||f.name||'';
          const href=f.download||`/api/browser/diagnostics/${encodeURIComponent(name)}`;
          const title=labelMap[f.label]||f.label||'诊断';
          const src=f.source==='warm'?'养号后':'手动';
          return `<div class="diagnostic-item">
            <div class="muted" style="margin-bottom:6px">${this.esc(title)} · ${this.esc(src)} · ${this.esc(f.createdAt||'')}</div>
            <a href="${this.esc(href)}" target="_blank" rel="noreferrer"><img src="${this.esc(href)}" alt="${this.esc(name)}" style="max-width:100%;border:1px solid #eee;border-radius:6px"></a>
            <div style="margin-top:4px"><a href="${this.esc(href)}" target="_blank" rel="noreferrer">${this.esc(name)}</a></div>
          </div>`;
        }).join(''):'<div class="empty">暂无诊断截图。可在「更多」里点「诊断账号」，或养号勾选结束后诊断。</div>';
        this.modal('账号诊断截图（最近 3 条）',html,()=>this.closeModal(),false,{hideSubmit:true});
      }catch(e){this.toast(e.message,true)}
    },
    async pullTikTokStats(id){
      if(!(await this.ensureBitOnline('拉取数据')))return;
      this.toast('正在创建「拉取数据」分任务…');
      try{
        const r=await this.api('/account-wizard/enqueue',{method:'POST',body:JSON.stringify({
          accountId:Number(id),
          taskType:'pull_stats',
          payload:{source:'manual',accountId:Number(id),saveTraffic:true},
        })});
        const batchId=r?.batch_id||r?.batchId||r?.batch?.id||'';
        const itemId=r?.item_id||r?.itemId||r?.item?.id||'';
        this.toast(`已创建拉取分任务${itemId?` #${itemId}`:''}${batchId?`（总任务 #${batchId}）`:''}，打开执行器或账号任务即可拉取 Studio 数据`);
        this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    /* ---------------- 系统通知 / 封禁状态 ---------------- */
    async openAccountNotifications(id, page, filter){
      const st=this._noticeState||{};
      const state={id:Number(id),page:Number(page||(st.id===Number(id)?st.page:1))||1,filter:filter!=null?filter:(st.id===Number(id)?st.filter:'')};
      this._noticeState=state;
      let d;
      try{
        d=await this.api(`/accounts/${id}/notifications?page=${state.page}&pageSize=10&filter=${encodeURIComponent(state.filter||'')}`);
      }catch(e){
        this.modal(`系统通知 #${id}`,`<div class="empty">加载失败：${this.esc(e.message)}</div>`,null,false,{hideSubmit:true,wide:true});
        return;
      }
      const ban=d.ban||{};
      const banBox=ban.banned
        ? `<div class="notice-ban"><div class="notice-ban-title">账号当前状态：封禁中</div>
             ${ban.reason?`<div class="notice-ban-line"><small>原因解释</small><div>${this.esc(ban.reason)}</div></div>`:''}
             <div class="notice-ban-line"><small>解封时间</small><div>${this.esc(ban.banUntil||'未给出（可能为永久封禁，需人工处理）')}</div></div>
             ${ban.checkedAt?`<div class="muted" style="margin-top:6px;font-size:12px">判定时间：${this.esc(ban.checkedAt)}${ban.source==='manual'?' · 人工设置':(ban.source==='ai'?' · AI 判定':(ban.source==='auto-restored'?' · 已自动解封':''))}</div>`:''}
           </div>`
        : '<div class="notice-ok">账号当前状态：正常</div>';
      const total=Number(d.total||0), pages=Number(d.pages||1), cur=Number(d.page||1);
      const rows=(d.items||[]).length
        ? (d.items||[]).map(n=>{
            const t=n.noticedAt||n.noticeTime||'-';
            const kws=(n.keywords||[]).slice(0,4).map(k=>`<span class="notice-kw">${this.esc(k)}</span>`).join('');
            const snippet=String(n.content||'').replace(/\s+/g,' ').slice(0,90);
            return `<div class="notice-row">
              <div class="notice-head" onclick="app.toggleNoticeDetail(${n.id})">
                <div class="notice-main">
                  <div class="notice-title">${this.esc(n.title||'（无标题）')}${n.isViolation?'<span class="badge error" style="margin-left:6px">疑似违规</span>':''}</div>
                  <div class="notice-snippet">${this.esc(snippet)}${String(n.content||'').length>90?'…':''}</div>
                </div>
                <div class="notice-meta"><div class="muted">${this.esc(t)}</div><div class="notice-arrow">查看详情 ▾</div></div>
              </div>
              <div id="notice-detail-${n.id}" class="notice-detail hidden">
                <div class="notice-detail-row"><small>通知时间</small><div>${this.esc(n.noticedAt||n.noticeTime||'-')}</div></div>
                ${n.category?`<div class="notice-detail-row"><small>通知分类</small><div>${this.esc(n.category)}</div></div>`:''}
                <div class="notice-detail-row"><small>通知标题</small><div>${this.esc(n.title||'-')}</div></div>
                <div class="notice-detail-row"><small>通知内容</small><div class="notice-detail-body">${this.esc(n.content||'-')}</div></div>
                ${kws?`<div class="notice-detail-row"><small>命中字样</small><div>${kws}</div></div>`:''}
                ${n.aiJudged?`<div class="muted" style="font-size:12px">该通知已用于 AI 封禁判定</div>`:''}
              </div>
            </div>`;
          }).join('')
        : `<div class="empty">还没有通知记录。点账号「更多操作 → 拉取数据」时会一并抓取 Studio 系统通知。</div>`;
      const pager=pages>1
        ? `<div class="notice-pager">
             <button class="ghost tiny" type="button" ${cur<=1?'disabled':''} onclick="app.openAccountNotifications(${id},${cur-1},'${this.esc(state.filter)}')">上一页</button>
             <span class="muted">第 ${cur} / ${pages} 页 · 共 ${total} 条</span>
             <button class="ghost tiny" type="button" ${cur>=pages?'disabled':''} onclick="app.openAccountNotifications(${id},${cur+1},'${this.esc(state.filter)}')">下一页</button>
           </div>`
        : `<div class="notice-pager"><span class="muted">共 ${total} 条</span></div>`;
      const html=`<style>
        .notice-ban{margin:0 0 12px;padding:10px 14px;border-radius:10px;background:#fff2f2;border:1px solid #ffd6d6}
        .notice-ban-title{font-weight:700;color:#d93026;margin-bottom:6px}
        .notice-ban-line{margin-top:6px}
        .notice-ban-line small{display:block;color:#909399;font-size:11px;margin-bottom:2px}
        .notice-ok{margin:0 0 12px;padding:8px 14px;border-radius:10px;background:#f0f9eb;border:1px solid #e1f3d8;color:#529b2e}
        .notice-row{border:1px solid #ebeef5;border-radius:10px;margin-bottom:8px;background:#fff;overflow:hidden}
        .notice-head{display:flex;gap:12px;padding:10px 12px;cursor:pointer;align-items:flex-start}
        .notice-head:hover{background:#f9fbff}
        .notice-main{flex:1;min-width:0}
        .notice-title{font-weight:600;color:#303133;font-size:13px;word-break:break-all}
        .notice-snippet{margin-top:4px;color:#7a8699;font-size:12px;word-break:break-all}
        .notice-meta{flex:0 0 auto;text-align:right;font-size:12px}
        .notice-arrow{color:#409eff;margin-top:6px}
        .notice-detail{padding:10px 12px;background:#f7f9fc;border-top:1px dashed #dfe6ee}
        .notice-detail-row{margin-bottom:8px}
        .notice-detail-row small{display:block;color:#909399;font-size:11px;margin-bottom:2px}
        .notice-detail-body{white-space:pre-wrap;word-break:break-word;color:#303133;font-size:13px;line-height:1.6}
        .notice-kw{display:inline-block;padding:0 6px;margin:0 4px 4px 0;border-radius:8px;background:#fdf6ec;color:#e6a23c;font-size:11px;border:1px solid #faecd8}
        .notice-pager{display:flex;gap:10px;align-items:center;justify-content:center;margin-top:8px}
        .notice-tools{display:flex;gap:8px;align-items:center;margin-bottom:10px}
      </style>
      <div class="notice-tools">
        <button class="ghost tiny" type="button" onclick="app.openAccountNotifications(${id},1,'')">全部通知</button>
        <button class="ghost tiny" type="button" onclick="app.openAccountNotifications(${id},1,'violation')">仅疑似违规（${Number(d.violationCount||0)}）</button>
        <button class="ghost tiny" type="button" onclick="app.accountBanAssess(${id})">AI 复核状态</button>
        <span class="muted">按「时间 + 内容」排重，重复通知不会重复入库</span>
      </div>
      ${banBox}
      <div class="notice-list">${rows}</div>
      ${pager}`;
      this.modal(`系统通知 · 账号 #${id}`,html,null,false,{hideSubmit:true,wide:true});
    },
    toggleNoticeDetail(noticeId){
      const el=document.querySelector(`#notice-detail-${noticeId}`);
      if(!el)return;
      el.classList.toggle('hidden');
      const arrow=el.parentElement?.querySelector('.notice-arrow');
      if(arrow)arrow.textContent=el.classList.contains('hidden')?'查看详情 ▾':'收起 ▴';
    },
    async accountBanAssess(id){
      try{
        UI.loading(true,'AI 判定中','正在分析系统通知，可能需要十几秒');
        const r=(await this.api(`/accounts/${id}/ban-assess`,{method:'POST',body:'{}'}))||{};
        const banned=r.ban?!!r.ban.banned:!!r.is_banned;
        let msg=banned?'AI 判定：账号封禁':'AI 判定：未封禁';
        if(r.skipped)msg='没有命中违规关键词的通知，未调用 AI';
        if(r.error)msg=`AI 调用失败：${r.error}`;
        this.toast(msg,!r.ok||banned);
      }catch(e){
        this.toast(e.message,true);
      }finally{
        UI.loading(false);
      }
      await this.openAccountNotifications(id,1,(this._noticeState||{}).filter||'');
      this.refresh();
    },
    async viewAccountDetail(id){
      try{
        if(typeof this.ensureCountryOptions==='function')await this.ensureCountryOptions();
        const x=await this.api(`/accounts/${id}`);
        const canWrite=this.canEditAccounts();
        const canEdit=this.canEditAccounts();
        const fp=x.has_fingerprint?'<span class="badge success">已有</span>':'<span class="badge">无</span>';
        const ck=(x.has_session||x.session_saved)?'<span class="badge success">CK</span>':'<span class="badge">无</span>';
        const capcut=x.capcut_authorized?'<span class="badge online" title="仅本地标记">本地已标</span>':'<span class="badge">未标记</span>';
        const chat=this.badge(x.chat_status);
        const nick=this.esc(x.nickname||'-');
        const fpNote=x.fingerprint?`<div class="muted" style="margin-top:6px;font-size:12px;word-break:break-all">${this.esc(String(x.fingerprint).slice(0,200))}${String(x.fingerprint).length>200?'…':''}</div>`:'';
        const nickRow=canEdit
          ?`<b style="color:#409eff;cursor:pointer" onclick="app.closeModal();app.editAccountNickname(${id},${JSON.stringify(x.username||'')},${JSON.stringify(x.nickname||'')})">${nick}</b><span class="muted" style="margin-left:8px;font-size:12px">点击编辑</span>`
          :`<b>${nick}</b>`;
        const capcutActs=canWrite?`<div class="action-bar" style="margin-top:10px">${x.capcut_authorized
          ?`<button class="ghost tiny" type="button" onclick="app.revokeCapCut(${id}).then(()=>app.viewAccountDetail(${id}))">取消本地CapCut</button>`
          :`<button class="ghost tiny" type="button" onclick="app.authorizeCapCut(${id}).then(()=>app.viewAccountDetail(${id}))">本地标记CapCut</button>`}</div>`:'';
        const e=(v)=>this.esc(v==null||String(v).trim()===''?'-':v);
        const yes=(t)=>`<span class="badge success">${t}</span>`;
        const no=(t)=>`<span class="badge">${t}</span>`;
        const be=String(x.browser_backend||'').toLowerCase();
        const beLabel=this.envBackendText(be);
        const mono=(v)=>v?`<code class="ad-code">${this.esc(v)}</code>`:'-';
        const item=(label,html,full)=>`<div class="ad-item${full?' full':''}"><small>${label}</small><div>${html}</div></div>`;
        const section=(title,items)=>`<section class="ad-sec"><h4>${title}</h4><div class="ad-grid">${items.join('')}</div></section>`;
        const avatar=x.profile_avatar||x.avatar_url||'';
        const initial=this.esc(String(x.nickname||x.username||'?').trim().charAt(0).toUpperCase()||'?');
        const avatarHtml=avatar
          ?`<img class="ad-avatar" src="${this.esc(avatar)}" alt="" onerror="this.outerHTML='<div class=&quot;ad-avatar ad-avatar-ph&quot;>${initial}</div>'">`
          :`<div class="ad-avatar ad-avatar-ph">${initial}</div>`;
        const accountCountryRaw=String(x.account_country||x.country||'').trim();
        const accountCountryLabel=accountCountryRaw&&typeof this.countryDisplayLabel==='function'?this.countryDisplayLabel(accountCountryRaw):accountCountryRaw;
        const proxyRegion=[x.proxy_country,x.proxy_region,x.proxy_city].map(v=>String(v||'').trim()).filter(Boolean).join(' · ');
        const ownerName=x.owner_label||x.owner_nickname||x.owner_username||'';
        const ownerHtml=ownerName?`${this.esc(ownerName)}${x.owner_username?` <span class="muted">@${this.esc(x.owner_username)}</span>`:''}`:'-';
        const banned=x.account_status==='banned';
        const banSourceMap={ai:'AI 判定',manual:'人工设置','auto-restored':'到期自动解封'};
        const banSource=banSourceMap[String(x.ban_source||'')]||(x.ban_source||'-');
        const css=`<style>
          /* 滚动交给 #modal-body；ad-wrap 勿再限高+flex 压缩，否则 ad-sec(overflow:hidden) 会把字段裁成一条缝 */
          .ad-wrap{display:flex;flex-direction:column;gap:14px;padding:2px 4px 6px;min-height:0}
          .ad-hero{display:flex;align-items:center;gap:14px;padding:16px 18px;border-radius:14px;background:linear-gradient(135deg,#ecf5ff 0%,#f5f0ff 100%);border:1px solid #e1ecfb;flex:0 0 auto}
          .ad-avatar{width:60px;height:60px;border-radius:50%;object-fit:cover;flex:0 0 auto;border:2px solid #fff;box-shadow:0 4px 14px rgba(64,158,255,.25)}
          .ad-avatar-ph{display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:#fff;background:linear-gradient(135deg,#409eff,#7c5cff)}
          .ad-hero-main{min-width:0;flex:1}
          .ad-name{font-size:18px;font-weight:700;color:#1f2d3d;word-break:break-all}
          .ad-sub{margin-top:3px;font-size:12px;color:#7a8699}
          .ad-tags{margin-top:8px;display:flex;flex-wrap:wrap;gap:6px}
          .ad-sec{border:1px solid #ebeef5;border-radius:12px;background:#fff;overflow:hidden;flex:0 0 auto;min-height:auto}
          .ad-sec h4{margin:0;padding:10px 14px;font-size:13px;font-weight:700;color:#303133;background:#f7f9fc;border-bottom:1px solid #ebeef5;display:flex;align-items:center;gap:8px}
          .ad-sec h4::before{content:'';width:3px;height:13px;border-radius:2px;background:#409eff;flex:0 0 auto}
          .ad-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:#f0f2f5}
          .ad-item{background:#fff;padding:10px 14px;min-width:0}
          .ad-item.full{grid-column:1/-1}
          .ad-item small{display:block;font-size:11px;color:#909399;margin-bottom:4px}
          .ad-item>div{font-size:13px;color:#303133;word-break:break-all;line-height:1.5}
          .ad-code{font-family:Consolas,Menlo,monospace;font-size:12px;background:#f4f6fa;padding:2px 6px;border-radius:5px;color:#4a5568}
          .ad-bio{white-space:pre-wrap}
          .ad-acts{display:flex;gap:8px;flex-wrap:wrap}
          @media(max-width:640px){.ad-grid{grid-template-columns:1fr}}
        </style>`;
        const hero=`<div class="ad-hero">${avatarHtml}<div class="ad-hero-main"><div class="ad-name">${this.esc(x.username||('#'+id))}</div><div class="ad-sub">${x.nickname?this.esc(x.nickname)+' · ':''}ID #${id}${x.sec_uid?' · sec_uid '+this.esc(String(x.sec_uid).slice(0,18))+(String(x.sec_uid).length>18?'…':''):''}</div><div class="ad-tags">${this.badge(x.login_status)}${banned?'<span class="badge error">封号</span>':'<span class="badge success">正常</span>'}${Number(x.enabled)===0?'<span class="badge">已停用</span>':''}${x.has_totp?yes('2FA 已绑定'):no('2FA 未绑定')}</div></div></div>`;
        const secBase=section('基本信息',[
          item('账号',e(x.username)),
          item('昵称',nickRow),
          item('账号 ID',`#${id}`),
          item('绑定国家',accountCountryLabel?e(accountCountryLabel):'-'),
          item('账号状态',banned?'<span class="badge error">封号</span>':'<span class="badge success">正常</span>'),
          ...(banned?[
            item('封禁原因',e(x.ban_reason),true),
            item('解封时间',x.ban_until?this.esc(x.ban_until):'<span class="muted">未给出（可能为永久封禁，需人工处理）</span>',true),
            item('判定时间',e(x.ban_checked_at)),
            item('判定来源',e(banSource)),
          ]:[]),
          item('封禁状态 / 通知',`<div class="ad-acts">
            <button class="ghost tiny" type="button" onclick="app.editAccountBanStatus(${id})">修改封禁状态</button>
            <button class="ghost tiny" type="button" onclick="app.openAccountNotifications(${id})">查看通知</button>
          </div>`,true),
          item('启用状态',Number(x.enabled)===0?no('已停用'):yes('已启用')),
          item('创建时间',e(x.created_at)),
          item('更新时间',e(x.updated_at)),
          item('备注',e(x.notes),true),
          ...(x.profile_bio?[item('个人简介',`<div class="ad-bio">${this.esc(x.profile_bio)}</div>`,true)]:[])
        ]);
        const secLogin=section('登录与安全',[
          item('登录状态',this.badge(x.login_status)),
          item('客服状态',chat),
          item('2FA',x.has_totp?yes('已绑定'):no('未绑定')),
          item('会话 CK',ck),
          item('浏览器指纹',fp+fpNote),
          item('CapCut 标记',capcut),
          item('私信通道',e(x.dm_channel))
        ]);
        const secEnv=section('浏览器环境',[
          item('当前后端',e(beLabel)),
          item('环境类型',e(x.browser_type)),
          item((this.bitBrowserUiEnabled?.()?'比特环境 ID':'环境 ID'),mono(x.browser_profile_id)),
          item(`${this.esc(this.tkswarmBrowserLabel())}环境 ID`,mono(x.tkswarm_browser_profile_id)),
          ...(x.linux_browser_profile_id?[item('服务器浏览器环境（EL 共用包）',mono(x.linux_browser_profile_id))]:[])
        ]);
        const secNet=section('代理网络',[
          item('代理名称',e(x.proxy_name)),
          item('代理地址',x.proxy_address?mono(x.proxy_address):'-'),
          item('出口地区',proxyRegion?e(proxyRegion):'-',true)
        ]);
        const secOwner=section('归属信息',[
          item('所属分组',e(x.group_name)),
          item('所属用户',ownerHtml),
          item('所属行业',e(x.industry_path||x.industryPath)),
          item('所属企业',e(x.company_name||x.companyName))
        ]);
        this.modal(`账号详情 · ${this.esc(x.username||('#'+id))}`,`${css}
          <div class="ad-wrap">
            ${hero}
            ${secBase}
            ${secLogin}
            ${secEnv}
            ${secNet}
            ${secOwner}
            ${capcutActs?`<div class="ad-acts">${capcutActs}</div>`:''}
          </div>`,async()=>{},false,{hideSubmit:true,wide:true});
      }catch(e){this.toast(e.message||'加载账号详情失败',true)}
    },
    /** @deprecated 兼容旧调用名 → 拉取数据分任务 */
    async syncTikTokProfile(id){return this.pullTikTokStats(id);},
    async syncTikTokVideos(id){if(!(await this.ensureBitOnline('同步视频')))return;this.toast('正在读取 TikTok 视频列表，请稍候...');try{const r=await this.api(`/browser/accounts/${id}/sync-videos`,{method:'POST',body:JSON.stringify({limit:100})});this.toast(`视频同步完成：${r.count} 条`);this.refresh()}catch(e){this.toast(e.message,true)}},
    async viewTikTokData(id){
      try{
        const [profile,videos,statsRaw,account]=await Promise.all([
          this.api(`/accounts/${id}/tiktok-profile`),
          this.api(`/accounts/${id}/tiktok-videos`),
          this.api(`/accounts/${id}/tiktok-stats`),
          this.api(`/accounts/${id}`).catch(()=>({})),
        ]);
        const p=profile||{};
        const statsProbe=Array.isArray(statsRaw)?{}:(statsRaw||{});
        // 缺省按关闭（与库字段 DEFAULT 0 一致）；账号详情 / stats 任一返回即可
        const mailPushRaw=account?.data_mail_push??account?.dataMailPush
          ??statsProbe.data_mail_push??statsProbe.dataMailPush??0;
        const mailPushOn=Number(mailPushRaw)===1;
        const stats=Array.isArray(statsRaw)?{snapshots:statsRaw,daily28:[]}:(statsRaw||{});
        const snaps=stats.snapshots||[];
        const daily=stats.daily28||[];
        // 展示层兜底去重：后端历史脏数据里同一作品可能有两个 video_id，
        // 这里按「数字视频 ID」或「封面+描述」再合一次，避免封面标题相同的两行同时出现。
        const vids=(()=>{
          const raw=Array.isArray(videos)?videos:[];
          const seen=new Set();
          const out=[];
          for(const v of raw){
            const vid=String(v?.video_id||'');
            const url=String(v?.video_url||'');
            const numId=(vid.match(/\d{8,}/)||[])[0]||(url.match(/\/(?:video|photo)\/(\d{8,})/)||[])[1]||'';
            const key=numId?`id:${numId}`:`meta:${String(v?.description||'').trim().toLowerCase()}|${String(v?.thumbnail_url||'')}`;
            if(seen.has(key))continue;
            seen.add(key);
            out.push(v);
          }
          return out;
        })();
        const fmt=(v)=>v==null||v===''?'—':v;
        const chip=(label,value)=>`<div class="tk-data-chip"><small>${label}</small><b title="${this.esc(String(fmt(value)))}">${this.esc(String(fmt(value)))}</b></div>`;
        const viewSwitch=(panel)=>`<div class="tk-data-view-switch" role="tablist">
            <button type="button" class="is-active" data-mode="list" onclick="app.tkDataSwitchView('${panel}','list')">列表</button>
            <button type="button" data-mode="chart" onclick="app.tkDataSwitchView('${panel}','chart')">折线图</button>
          </div>`;
        const dailyDesc=[...daily].sort((a,b)=>String(b.metric_date||'').localeCompare(String(a.metric_date||'')));
        const dailyTable=daily.length
          ?`<div class="tk-data-table-wrap"><table class="tk-data-table"><thead><tr><th>日期</th><th>播放</th><th>主页浏览</th><th>点赞</th><th>评论</th><th>转发</th><th>预估收益</th></tr></thead><tbody>${dailyDesc.map(d=>`<tr><td>${this.esc(d.metric_date)}</td><td>${fmt(d.video_views??0)}</td><td>${fmt(d.profile_views??0)}</td><td>${fmt(d.likes_count??0)}</td><td>${fmt(d.comments_count??0)}</td><td>${fmt(d.shares_count??0)}</td><td>${fmt(d.est_rewards??0)}</td></tr>`).join('')}</tbody></table></div>`
          :'<div class="tk-data-empty">暂无 28 天数据，请先「拉取数据」</div>';
        const videoTable=vids.length
          ?`<div class="tk-data-table-wrap"><table class="tk-data-table"><thead><tr><th>封面</th><th>视频 ID</th><th>描述</th><th>同步时间</th><th>操作</th></tr></thead><tbody>${vids.slice(0,20).map(v=>`<tr>
              <td>${v.thumbnail_url?`<img class="tk-data-thumb" src="${this.esc(v.thumbnail_url)}" alt="">`:'<span class="muted">—</span>'}</td>
              <td class="mono">${this.esc(v.video_id)}</td>
              <td class="tk-data-desc">${this.esc(v.description||'—')}</td>
              <td class="muted">${this.esc(v.last_synced_at||'—')}</td>
              <td class="tk-data-ops">
                <button class="tiny" type="button" onclick='app.previewTikTokVideo(${JSON.stringify({url:String(v.video_url||''),thumb:String(v.thumbnail_url||''),desc:String(v.description||''),id:String(v.video_id||'')})})'>预览</button>
                <button class="tiny" type="button" onclick='app.copyText(${JSON.stringify(String(v.video_url||''))})'>复制</button>
                <a class="tiny" href="${this.esc(v.video_url||'#')}" target="_blank" rel="noreferrer">打开</a>
                <button class="tiny danger" type="button" onclick='app.deleteTikTokVideo(${id},${JSON.stringify(String(v.video_id||''))},${JSON.stringify(String(v.video_url||''))},${JSON.stringify(String(v.description||''))})'>删除</button>
              </td>
            </tr>`).join('')}</tbody></table></div>`
          :'<div class="tk-data-empty">暂无视频数据</div>';
        const snapTable=snaps.length
          ?`<div class="tk-data-table-wrap"><table class="tk-data-table"><thead><tr><th>时间</th><th>粉丝</th><th>关注</th><th>获赞</th></tr></thead><tbody>${snaps.map(s=>`<tr><td>${this.esc(s.captured_at)}</td><td>${fmt(s.followers_count)}</td><td>${fmt(s.following_count)}</td><td>${fmt(s.likes_count)}</td></tr>`).join('')}</tbody></table></div>`
          :'<div class="tk-data-empty">拉取数据后会生成历史快照</div>';

        const dailyAsc=[...daily].sort((a,b)=>String(a.metric_date||'').localeCompare(String(b.metric_date||'')));
        const snapsAsc=[...snaps].sort((a,b)=>String(a.captured_at||'').localeCompare(String(b.captured_at||'')));
        this._tkChartData={
          daily28:{
            labels:dailyAsc.map(d=>String(d.metric_date||'').slice(5)),
            series:[
              {key:'video_views',name:'播放',color:'#409EFF',values:dailyAsc.map(d=>Number(d.video_views||0))},
              {key:'profile_views',name:'主页浏览',color:'#67C23A',values:dailyAsc.map(d=>Number(d.profile_views||0))},
              {key:'likes_count',name:'点赞',color:'#E6A23C',values:dailyAsc.map(d=>Number(d.likes_count||0))},
              {key:'comments_count',name:'评论',color:'#F56C6C',values:dailyAsc.map(d=>Number(d.comments_count||0))},
              {key:'shares_count',name:'转发',color:'#909399',values:dailyAsc.map(d=>Number(d.shares_count||0))},
              {key:'est_rewards',name:'预估收益',color:'#9B59B6',values:dailyAsc.map(d=>Number(d.est_rewards||0))},
            ],
          },
          snapshots:{
            labels:snapsAsc.map(s=>{
              const t=String(s.captured_at||'');
              return t.length>=16?t.slice(5,16):t.slice(5);
            }),
            series:[
              {key:'followers_count',name:'粉丝',color:'#409EFF',values:snapsAsc.map(s=>Number(s.followers_count||0))},
              {key:'following_count',name:'关注',color:'#67C23A',values:snapsAsc.map(s=>Number(s.following_count||0))},
              {key:'likes_count',name:'获赞',color:'#E6A23C',values:snapsAsc.map(s=>Number(s.likes_count||0))},
            ],
          },
        };
        this._tkChartHidden={daily28:{},snapshots:{}};

        // ---- Studio 四个页签 ----
        const studioTabs=Array.isArray(stats.studioTabs)?stats.studioTabs:[];
        const studioMetrics=stats.studioMetrics||{};
        const studioContent=Array.isArray(stats.studioContent)?stats.studioContent:[];
        const studioSync=stats.studioSync||null;
        const TAB_TITLE={overview:'总览 Overview',content:'内容 Content',followers:'粉丝 Followers',viewer:'观众 Viewer',live:'直播 Live'};
        const studioBlocks=studioTabs.length
          ? studioTabs.map(t=>{
              const list=studioMetrics[t.tab_key]||[];
              const rows=list.length
                ? list.map(mm=>`<tr><td>${this.esc(mm.label||mm.key)}</td><td class="mono">${this.esc(mm.text||String(mm.value))}</td></tr>`).join('')
                : '<tr><td colspan="2" class="muted">该页签未解析到指标</td></tr>';
              return `<div class="tk-data-tab-block">
                <div class="tk-data-section-title-row">
                  <div class="tk-data-section-title">${this.esc(TAB_TITLE[t.tab_key]||t.tab_label||t.tab_key)}</div>
                  <span class="tk-data-count">${list.length} 项</span>
                </div>
                <div class="tk-data-table-wrap"><table class="tk-data-table" style="min-width:0"><thead><tr><th>指标</th><th>数值</th></tr></thead><tbody>${rows}</tbody></table></div>
              </div>`;
            }).join('')
          : '<div class="tk-data-empty">本次未抓到页签数据（可看该板块标题下方的「最近拉取」信息）</div>';
        const contentTable=studioContent.length
          ? `<div class="tk-data-table-wrap"><table class="tk-data-table"><thead><tr><th>#</th><th>封面</th><th>内容</th><th>视频链接</th><th>素材ID</th><th>播放</th><th>点赞</th><th>评论</th><th>分享</th><th>发布时间</th><th>操作</th></tr></thead><tbody>${studioContent.map(c=>{
              const url=String(c.video_url||'');
              const cover=String(c.cover_url||'');
              const mid=Number(c.material_id||0);
              const vid=String(c.video_id||'');
              const titleHtml=`<div class="tk-data-desc" title="${this.esc(c.title||'')}">${this.esc(c.title||'—')}</div>${vid?`<div class="muted" style="font-size:11px;margin-top:2px">ID ${this.esc(vid)}</div>`:''}`;
              const linkHtml=url
                ?`<a class="tk-data-link" href="${this.esc(url)}" target="_blank" rel="noreferrer" title="${this.esc(url)}">${this.esc(url.replace(/^https?:\/\/(www\.)?/i,'').slice(0,42))}${url.length>48?'…':''}</a>`
                :'<span class="muted">—</span>';
              return `<tr>
              <td>${c.row_no}</td>
              <td>${cover?`<img class="tk-data-thumb" src="${this.esc(cover)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'muted',textContent:'—'}))">`:'<span class="muted">—</span>'}</td>
              <td>${titleHtml}</td>
              <td style="max-width:220px;white-space:normal">${linkHtml}</td>
              <td class="mono">${mid>0?mid:'<span class="muted">—</span>'}</td>
              <td>${c.views_num}</td>
              <td>${c.likes_num}</td>
              <td>${c.comments_num}</td>
              <td>${c.shares_num}</td>
              <td class="muted">${this.esc(c.posted_at||'—')}</td>
              <td class="tk-data-ops">
                ${url?`<a class="tiny" href="${this.esc(url)}" target="_blank" rel="noreferrer">打开</a>
                <button class="tiny" type="button" onclick='app.copyText(${JSON.stringify(url)})'>复制链接</button>`:'<span class="muted">—</span>'}
              </td>
            </tr>`;
            }).join('')}</tbody></table></div>`
          : '<div class="tk-data-empty">暂无内容数据（Content 页签）</div>';
        const syncLine=studioSync
          ? `最近拉取：${this.esc(studioSync.captured_at||'-')}　页签 ${studioSync.tab_count||0} 个　接口 ${studioSync.api_count||0} 个　状态 ${studioSync.status==='error'?'失败':'成功'}${studioSync.message?`　${this.esc(studioSync.message)}`:''}`
          : '尚未拉取过 Studio 数据';
        let syncMeta=null;
        try{syncMeta=studioSync&&studioSync.meta_json?JSON.parse(studioSync.meta_json):null}catch(e){syncMeta=null}
        const rangeLine=(syncMeta&&Array.isArray(syncMeta.ranges)&&syncMeta.ranges.length)
          ? `<div class="tk-data-meta">各页签数据区间：${syncMeta.ranges.map(r=>this.esc(r)).join('　')}</div>`
          : '';

        this.modal('TikTok 账号数据',`
          <div class="tk-data-view">
            <section class="tk-data-section">
              <div class="tk-data-section-head">
                <div>
                  <div class="tk-data-section-title">账号总览</div>
                  <div class="tk-data-meta">最后拉取：${this.esc(p.last_synced_at||'尚未拉取')}</div>
                  ${this.canAccountDataMailOps()?`<div class="tk-data-meta">邮件推送计划：${mailPushOn?'已开启（拉取成功后自动 AI 分析发信）':'已关闭（仅可手动发送）'}</div>`:''}
                </div>
                <div class="tk-data-actions">
                  <button class="primary" type="button" onclick="app.pullTikTokStats(${id}).then(()=>setTimeout(()=>app.viewTikTokData(${id}),800))">拉取数据</button>
                  ${this.canAccountDataMailOps()?`<button class="ghost" type="button" onclick="app.sendTikTokDataAnalysisMail(${id})">发送邮件通知</button>
                  ${mailPushOn
                    ?`<button class="warn" type="button" title="关闭后，拉取数据完成将不再自动入队邮件计划任务" onclick="app.setAccountDataMailPush(${id},false)">关闭推送</button>`
                    :`<button class="success" type="button" title="开启后，拉取数据完成将自动入队邮件计划任务" onclick="app.setAccountDataMailPush(${id},true)">开启推送</button>`}`:''}
                  <button class="ghost" type="button" onclick="app.modifyAccountProfile(${id},'${this.esc(p.handle||'')}')">修改资料</button>
                </div>
              </div>
              <div class="tk-data-chips">
                ${chip('用户名',p.handle||'-')}
                ${chip('显示名称',p.display_name||'-')}
                ${chip('粉丝',p.followers_count)}
                ${chip('关注',p.following_count)}
                ${chip('获赞',p.likes_count)}
                ${chip('视频',p.videos_count??vids.length)}
                ${chip('浏览量',p.views_count)}
                ${chip('评论总数',p.comments_count)}
              </div>
              <div class="tk-data-chips tk-data-chips-period">
                ${chip('播放 · 28天',p.period_video_views)}
                ${chip('主页浏览 · 28天',p.period_profile_views)}
                ${chip('点赞 · 28天',p.period_likes)}
                ${chip('评论 · 28天',p.period_comments)}
                ${chip('转发 · 28天',p.period_shares??p.shares_count)}
                ${chip('预估收益 · 28天',p.period_est_rewards)}
              </div>
            </section>

            <section class="tk-data-section" data-tk-panel="daily28">
              <div class="tk-data-section-head">
                <div class="tk-data-section-title-row">
                  <div class="tk-data-section-title">最近 28 天（Studio）</div>
                  <span class="tk-data-count">${daily.length} 天</span>
                </div>
                ${viewSwitch('daily28')}
              </div>
              <div class="tk-data-mode is-active" data-mode="list">${dailyTable}</div>
              <div class="tk-data-mode" data-mode="chart" hidden>
                ${daily.length
                  ?`<div class="tk-data-chart-box"><div class="tk-data-chart" id="tk-chart-daily28"></div><div class="tk-data-legend" id="tk-legend-daily28"></div></div>`
                  :'<div class="tk-data-empty">暂无 28 天数据，请先「拉取数据」</div>'}
              </div>
            </section>

            <section class="tk-data-section">
              <div class="tk-data-section-head">
                <div class="tk-data-section-title">最近同步视频</div>
                <span class="tk-data-count">${vids.length} 条</span>
              </div>
              ${videoTable}
            </section>

            <section class="tk-data-section">
              <div class="tk-data-section-head">
                <div>
                  <div class="tk-data-section-title">Studio 四页签数据</div>
                  <div class="tk-data-meta">${syncLine}</div>
                  ${rangeLine}
                </div>
                <span class="tk-data-count">${studioTabs.length} 个页签</span>
              </div>
              <div class="tk-data-tabs">${studioBlocks}</div>
            </section>

            <section class="tk-data-section">
              <div class="tk-data-section-head">
                <div class="tk-data-section-title">内容数据（Content）</div>
                <span class="tk-data-count">${studioContent.length} 条</span>
              </div>
              ${contentTable}
            </section>

            <section class="tk-data-section" data-tk-panel="snapshots">
              <div class="tk-data-section-head">
                <div class="tk-data-section-title-row">
                  <div class="tk-data-section-title">历史快照</div>
                  <span class="tk-data-count">最近 ${Math.min(snaps.length,30)} 次</span>
                </div>
                ${viewSwitch('snapshots')}
              </div>
              <div class="tk-data-mode is-active" data-mode="list">${snapTable}</div>
              <div class="tk-data-mode" data-mode="chart" hidden>
                ${snaps.length
                  ?`<div class="tk-data-chart-box"><div class="tk-data-chart" id="tk-chart-snapshots"></div><div class="tk-data-legend" id="tk-legend-snapshots"></div></div>`
                  :'<div class="tk-data-empty">拉取数据后会生成历史快照</div>'}
              </div>
            </section>
          </div>
        `,()=>this.closeModal(),false,{hideSubmit:true,wide:true});
        requestAnimationFrame(()=>{
          this.paintTkLineChart('daily28');
          this.paintTkLineChart('snapshots');
        });
      }catch(e){this.toast(e.message,true)}
    },
    /** 企业客户不可操作数据邮件通知/推送开关 */
    canAccountDataMailOps(){
      return !(typeof this.isEnterpriseCustomerRole==='function'&&this.isEnterpriseCustomerRole());
    },
    async sendTikTokDataAnalysisMail(id){
      if(!this.canAccountDataMailOps()){this.toast('当前角色无权发送邮件通知',true);return}
      const aid=Number(id||0);
      if(!aid){this.toast('账号无效',true);return}
      if(!(await this.ask('将基于当前已拉取数据做 AI 分析，并向账号绑定用户/企业用户的通知邮箱发送报告，是否继续？')))return;
      try{
        const r=await this.runFormSubmit(async()=>{
          return await this.api(`/accounts/${aid}/send-data-analysis-mail`,{method:'POST',body:'{}'});
        },{
          title:'正在 AI 分析并发送邮件',
          desc:'汇总账号指标 → AI 分析 → SMTP 发信，可能需要一分钟',
          successTitle:'邮件已发送',
          successDesc:'请查收绑定用户通知邮箱',
        });
        const emails=Array.isArray(r?.emails)?r.emails:[];
        this.toast(emails.length
          ?`AI 分析完成，已发送至：${emails.join('、')}`
          :'AI 分析完成，邮件已发送');
      }catch(e){this.toast(e.message||'发送失败',true)}
    },
    async setAccountDataMailPush(id,enabled){
      if(!this.canAccountDataMailOps()){this.toast('当前角色无权操作邮件推送',true);return}
      const aid=Number(id||0);
      if(!aid){this.toast('账号无效',true);return}
      const on=!!enabled;
      const tip=on
        ?'开启后，该账号「拉取数据」成功将自动入队邮件计划任务（AI 分析并发信）。是否继续？'
        :'关闭后，将取消该账号待发送的自动邮件计划任务；仍可手动「发送邮件通知」。是否继续？';
      if(!(await this.ask(tip)))return;
      try{
        const r=await this.api(`/accounts/${aid}/data-mail-push`,{
          method:'PATCH',
          body:JSON.stringify({enabled:on}),
        });
        const cancelled=Number(r?.cancelledPending||0);
        this.toast(on
          ?'已开启数据邮件推送'
          :(cancelled?`已关闭推送，并取消 ${cancelled} 个待发计划任务`:'已关闭数据邮件推送'));
        await this.viewTikTokData(aid);
      }catch(e){this.toast(e.message||'切换失败',true)}
    },
    tkDataSwitchView(panel,mode){
      const section=document.querySelector(`#modal [data-tk-panel="${panel}"]`);
      if(!section)return;
      section.querySelectorAll('.tk-data-view-switch button').forEach((el)=>{
        el.classList.toggle('is-active',el.dataset.mode===mode);
      });
      section.querySelectorAll('.tk-data-mode').forEach((el)=>{
        const on=el.dataset.mode===mode;
        el.classList.toggle('is-active',on);
        if(on)el.removeAttribute('hidden');
        else el.setAttribute('hidden','');
      });
      if(mode==='chart')requestAnimationFrame(()=>this.paintTkLineChart(panel));
    },
    toggleTkChartSeries(panel,key){
      if(!this._tkChartHidden)this._tkChartHidden={};
      if(!this._tkChartHidden[panel])this._tkChartHidden[panel]={};
      this._tkChartHidden[panel][key]=!this._tkChartHidden[panel][key];
      this.paintTkLineChart(panel);
    },
    paintTkLineChart(panel){
      const pack=this._tkChartData?.[panel];
      const host=document.getElementById(panel==='daily28'?'tk-chart-daily28':'tk-chart-snapshots');
      const legend=document.getElementById(panel==='daily28'?'tk-legend-daily28':'tk-legend-snapshots');
      if(!pack||!host)return;
      if(!pack.labels.length){
        host.innerHTML='<div class="tk-data-empty">暂无数据</div>';
        if(legend)legend.innerHTML='';
        return;
      }
      const hidden=this._tkChartHidden?.[panel]||{};
      const active=pack.series.filter((s)=>!hidden[s.key]);
      const W=760,H=260,padL=48,padR=16,padT=18,padB=36;
      const plotW=W-padL-padR,plotH=H-padT-padB;
      const n=pack.labels.length;
      const allVals=active.flatMap((s)=>s.values);
      let minV=0;
      let maxV=Math.max(1,...allVals);
      if(allVals.length&&Math.min(...allVals)<0)minV=Math.min(...allVals);
      const span=maxV-minV||1;
      const xAt=(i)=>padL+(n<=1?plotW/2:(i/(n-1))*plotW);
      const yAt=(v)=>padT+plotH-((Number(v)-minV)/span)*plotH;
      const grid=[];
      for(let g=0;g<=4;g++){
        const y=padT+(plotH*g)/4;
        const val=maxV-(span*g)/4;
        const label=val>=1000?`${(val/1000).toFixed(val>=10000?0:1)}k`:String(Math.round(val*100)/100);
        grid.push(`<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" class="tk-chart-grid"/>`);
        grid.push(`<text x="${padL-8}" y="${y+4}" text-anchor="end" class="tk-chart-axis">${this.esc(label)}</text>`);
      }
      const xLabels=[];
      const step=Math.max(1,Math.ceil(n/8));
      for(let i=0;i<n;i++){
        if(i%step!==0&&i!==n-1)continue;
        xLabels.push(`<text x="${xAt(i)}" y="${H-10}" text-anchor="middle" class="tk-chart-axis">${this.esc(pack.labels[i])}</text>`);
      }
      const paths=active.map((s)=>{
        const pts=s.values.map((v,i)=>`${i===0?'M':'L'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(' ');
        const dots=s.values.map((v,i)=>`<circle cx="${xAt(i).toFixed(1)}" cy="${yAt(v).toFixed(1)}" r="2.5" fill="${s.color}"><title>${this.esc(s.name)} ${this.esc(pack.labels[i])}: ${v}</title></circle>`).join('');
        return `<path d="${pts}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${dots}`;
      }).join('');
      host.innerHTML=`<svg class="tk-chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="折线统计图">${grid.join('')}${paths}${xLabels.join('')}</svg>`;
      if(legend){
        legend.innerHTML=pack.series.map((s)=>{
          const off=!!hidden[s.key];
          return `<button type="button" class="tk-legend-item${off?' is-off':''}" onclick="app.toggleTkChartSeries('${panel}','${s.key}')">
            <i style="background:${s.color}"></i><span>${this.esc(s.name)}</span>
          </button>`;
        }).join('');
      }
    },
    previewTikTokVideo(info={}){
      const url=info.url||'';
      const thumb=info.thumb||'';
      const desc=info.desc||'';
      const vid=info.id||'';
      if(!url){this.toast('没有视频链接',true);return}
      this.modal('视频预览',`<div class="form-grid"><div class="field full" style="text-align:center">${thumb?`<img src="${this.esc(thumb)}" alt="cover" style="max-width:100%;max-height:360px;border-radius:8px">`:'<div class="empty">无封面图</div>'}</div><div class="field full"><div class="muted">作品 ID：${this.esc(vid||'-')}<br>${this.esc(desc||'无描述')}<br><br>本地仅缓存作品页链接与封面，未下载可播放的视频文件。可预览封面或到 TikTok 打开原页。</div></div><div class="action-bar"><a class="primary" href="${this.esc(url)}" target="_blank" rel="noreferrer">在新窗口打开</a> <button class="ghost" type="button" onclick='app.copyText(${JSON.stringify(url)})'>复制链接</button> ${thumb?`<a class="ghost" href="${this.esc(thumb)}" download="tiktok-${this.esc(vid||'cover')}.jpg" target="_blank" rel="noreferrer">下载封面</a>`:''}</div></div>`,async()=>{},false,{hideSubmit:true});
    },
    async setAccountStatus(id,status){await this.api(`/accounts/${id}/status`,{method:'PATCH',body:JSON.stringify({loginStatus:status})});this.refresh()},
    selectedAccountIds(){return [...document.querySelectorAll('.account-check:checked')].map(x=>Number(x.value))},
    toggleAccountBatchMenu(e){
      e?.stopPropagation?.();
      this.toggleToolbarDropdown('#account-batch-menu', e);
    },
    async exportAccounts(){return this.openAccountIo('export')},
    async authorizeCapCut(id){if(!(await this.ask('仅在本系统打标记，不会真正授权 CapCut。继续？')))return;try{await this.api(`/accounts/${id}/capcut-authorize`,{method:'POST'});this.toast('已本地标记 CapCut');this.refresh()}catch(e){this.toast(e.message,true)}},
    async revokeCapCut(id){try{await this.api(`/accounts/${id}/capcut-revoke`,{method:'POST'});this.toast('已取消本地标记');this.refresh()}catch(e){this.toast(e.message,true)}},
    async batchModifyProfiles(){
      if(!this.canBatchModifyAccounts()){this.toast('当前角色无权批量修改账号',true);return}
      const ids=this.selectedAccountIds();
      if(!ids.length){this.toast('请先选择账号',true);return}
      await this.loadRefs();
      // 批量编辑：若勾选账号归属同一用户，用该用户代理；否则用当前用户代理
      const selectedRows=(this.accounts||[]).filter(a=>ids.includes(Number(a.id)));
      const ownerIds=[...new Set(selectedRows.map(a=>Number(a.owner_id||0)).filter(Boolean))];
      let assignTargets=[];
      let companyOptions=[];
      [assignTargets,companyOptions]=await Promise.all([
        this.loadOwnerAssignTargets().catch(()=>[]),
        this.canAssignAccounts()?this.loadAccountCompanyOptions():Promise.resolve([]),
      ]);
      this._accountAssignTargets=assignTargets||[];
      const proxyOwnerFilter=this.proxyCatalogOwnerFilter({ownerIds,targets:assignTargets});
      await Promise.all([
        this.ensureProxyCatalogForAccounts({force:true,ownerIds,targets:assignTargets}),
        typeof this.ensureCountryOptions==='function'?this.ensureCountryOptions():Promise.resolve(),
        typeof this.ensureIndustryFlat==='function'?this.ensureIndustryFlat():Promise.resolve(),
      ]);
      const gs=this.accountGroupFlatOptions();
      const proxies=this.proxySelectItems();
      const groupOpts=[['','不修改'],['__clear__','移出分组'],...gs.map(g=>[String(g.id),g.name])];
      const countryProxyBlock=this.accountCountryProxyBlockHtml({
        mode:'batch',
        countryCode:'',
        proxyItems:proxies,
        accountCount:ids.length,
      });
      const industryField=this.accountIndustryFieldHtml(0,{mode:'batch'});
      let ownerField='';
      let companyField='';
      if(this.canAssignAccounts()){
        if(assignTargets.length){
          ownerField=this.ownerAssignFieldsHtml(assignTargets,'',{blankLabel:'不修改',allowClear:true});
        }
        companyField=this.companyAssignFieldHtml(companyOptions,'',{mode:'batch'});
      }
      const proxyScopeNote=this.proxyCatalogScopeHint(proxyOwnerFilter,proxies.length);
      this.modal('批量修改',`<div class="form-grid">
        <div class="field full"><div class="muted">已选 ${ids.length} 个账号。未选择的项不会改动；只有选了对应项才会批量写入。${proxyScopeNote}</div></div>
        ${this.selectRaw('groupId','账号分组',groupOpts,'')}
        ${countryProxyBlock}
        ${industryField}
        ${ownerField}
        ${companyField}
        ${this.selectRaw('enabled','启用状态',[['','不修改'],['1','启用'],['0','禁用']],'')}
        ${this.selectRaw('dataMailPush','数据邮件推送',[['','不修改'],['1','开启推送'],['0','关闭推送']],'')}
        ${this.selectRaw('dmChannel','私信通道',[['','不修改'],['auto','自动'],['api','仅 API'],['browser','仅浏览器']],'')}
        ${this.field('nickname','统一昵称（留空不改）')}
        ${this.field('notes','统一备注（留空不改）','','textarea')}
      </div>`,async d=>{
        const fields={};
        if(d.groupId) fields.groupId = d.groupId==='__clear__' ? null : Number(d.groupId);
        const countryCode=String(d.country||'').trim();
        if(countryCode){
          fields.country=typeof this.resolveAccountCountryCode==='function'
            ?this.resolveAccountCountryCode(countryCode)
            :countryCode;
        }
        const industryPrefix='acct-batch-industry';
        const industryCleared=document.querySelector('#'+industryPrefix)?.dataset?.cleared==='1';
        const industryVal=typeof this.getIndustryCascadeValue==='function'?Number(this.getIndustryCascadeValue(industryPrefix)||0):0;
        if(industryCleared)fields.industryId='__clear__';
        else if(industryVal>0)fields.industryId=industryVal;
        const proxyIds=this.collectAccountBatchProxyIds(document.querySelector('#modal-form'));
        if(proxyIds.length){
          const check=await this.api('/accounts/proxy-bind-check-batch',{method:'POST',body:JSON.stringify({accountIds:ids,proxyIds})});
          if(!check.allowed){
            await this.ask(check.message||`所选代理剩余额度不足（需要 ${check.needed||ids.length}，可用 ${check.available||0}）`,'error');
            throw new Error(check.message||'代理剩余额度不足');
          }
          fields.proxyIds=proxyIds;
        }
        if(d.ownerId){
          Object.assign(fields,this.collectOwnerAssignPayload(d,assignTargets));
        }
        // 仅改关联企业、不改人员时也要写入；FormData 空字符串表示「不修改」
        if(Object.prototype.hasOwnProperty.call(d,'companyId')&&String(d.companyId||'')!==''){
          fields.companyId=d.companyId==='__clear__'?null:Number(d.companyId);
        }
        if(d.enabled!==''&&d.enabled!=null) fields.enabled = Number(d.enabled);
        if(d.dataMailPush!==''&&d.dataMailPush!=null) fields.dataMailPush = Number(d.dataMailPush) ? 1 : 0;
        if(d.dmChannel) fields.dmChannel = d.dmChannel;
        if(String(d.nickname||'').trim()) fields.nickname = String(d.nickname).trim();
        if(String(d.notes||'').trim()) fields.notes = String(d.notes).trim();
        if(!Object.keys(fields).length) throw new Error('请至少选择一项要修改的内容');
        const r=await this.api('/accounts/batch-update',{method:'POST',body:JSON.stringify({accountIds:ids,fields})});
        const parts=[];
        if(fields.groupId!==undefined) parts.push('分组');
        if(fields.country!==undefined) parts.push('国家');
        if(fields.industryId!==undefined) parts.push('行业');
        if(fields.proxyIds!==undefined) parts.push('代理');
        if(fields.proxyId!==undefined) parts.push('代理');
        if(fields.ownerId!==undefined) parts.push('关联人员');
        if(fields.companyId!==undefined) parts.push('关联企业');
        if(fields.enabled!==undefined) parts.push('启用状态');
        if(fields.dataMailPush!==undefined) parts.push(fields.dataMailPush?'开启推送':'关闭推送');
        if(fields.dmChannel!==undefined) parts.push('私信通道');
        if(fields.nickname!==undefined) parts.push('昵称');
        if(fields.notes!==undefined) parts.push('备注');
        const cancelled=Number(r?.cancelledPending||0);
        const extra=fields.dataMailPush===0&&cancelled>0?`，已取消 ${cancelled} 个待发邮件任务`:'';
        this.toast(`已更新 ${r.updated||ids.length} 个账号（${parts.join('、')}）${extra}`);
        this.closeModal();
        await this.loadRefs();
        this.refresh();
      });
      this.bindAccountCountryProxyPicker(document.querySelector('#modal-form'),{mode:'batch',proxyItems:proxies,accountCount:ids.length});
      if(typeof this.bindIndustryCascade==='function')await this.bindIndustryCascade('acct-batch-industry',0);
      if(assignTargets.length||companyField)this.bindOwnerAssignHandlers(assignTargets,companyOptions,'','',{mode:'batch'});
    },
    nicknameCooldownInfo(changedAt){
      const raw=String(changedAt||'').trim();
      if(!raw||raw==='0000-00-00 00:00:00')return{locked:false,hint:''};
      const ts=Date.parse(raw.replace(/-/g,'/'));
      if(!Number.isFinite(ts))return{locked:false,hint:''};
      const windowMs=7*24*3600*1000;
      if(Date.now()-ts>=windowMs)return{locked:false,hint:''};
      return{locked:true,hint:'距离上次修改未超过7天暂时无法修改'};
    },
    async modifyAccountProfile(id,username){
      // 账号向导已提供任务列表+创建编辑：有入口时优先跳转，逻辑仍与下方 PATCH+enqueue 一致
      if(typeof this.openModifyProfileWizard==='function'&&typeof this.canNavigateMenu==='function'
        &&this.canNavigateMenu('accountWizard','modify_profile')){
        this.accountWizardKind='modify_profile';
        this.accountWizardPane='create';
        this.accountWizardEditId=null;
        this._awDraft={
          accountIds:[Number(id)].filter(Boolean),
          username:String(username||'').replace(/^@+/,''),
          nickname:'',
          signature:'',
          avatarUrl:'',
          browserBackend:this.defaultTaskBrowserBackend?.()||'tkswarm',
          saveTraffic:true,
        };
        this.navigate('accountWizard','create_modify_profile');
        return;
      }
      if(!this.canEditAccounts()){this.toast('当前角色无权修改资料',true);return}
      let acc={};
      try{acc=await this.api(`/accounts/${id}`)||{}}catch{}
      const prevUsername=String(acc.username||username||'').replace(/^@+/,'').trim();
      const prevName=String(acc.nickname||'').trim();
      const prevBio=String(acc.profile_bio||acc.profileBio||'').trim();
      const prevAvatar=String(acc.profile_avatar||acc.profileAvatar||'').trim();
      const nickCool=this.nicknameCooldownInfo(acc.nickname_changed_at||acc.nicknameChangedAt);
      const nickDisabled=nickCool.locked;
      const nickHint=nickCool.hint||'';
      const nickChangedAt=this.fmtProfileTime(acc.nickname_changed_at||acc.nicknameChangedAt);
      // 昵称是否可输入：每次打开弹框都用最新一次「修改成功时间」重新判断，7 天内置灰不可输入
      const nickField=nickDisabled
        ? `<div class="field"><label>昵称 Name（可选）</label>
            <input class="input" name="nickname" type="text" value="${this.esc(prevName)}" disabled readonly style="background:#f0f2f5;color:#a8abb2;cursor:not-allowed;border-color:#e4e7ed">
            <div class="muted" style="margin-top:6px;color:#c0392b">${this.esc(nickHint)}</div>
            <div class="muted" style="margin-top:4px">上次修改成功：${this.esc(nickChangedAt)}（TikTok 规则：昵称 7 天只能修改一次，满 7 天后自动恢复可编辑）</div>
            <div class="field-error"></div>
          </div>`
        : this.field('nickname','昵称 Name（可选）',prevName);
      const bioLen=Array.from(prevBio).length;
      const bioField=`<div class="field full">
        <label>签名 Bio（可选）</label>
        <div class="muted field-hint" style="display:block;margin:0 0 6px;line-height:1.5">不得超过 80 个字符</div>
        <textarea class="input" name="signature" id="profile-bio-input" rows="3" maxlength="80" data-rule="max:80" placeholder="请输入签名 Bio...">${this.esc(prevBio)}</textarea>
        <div class="muted" id="profile-bio-count" style="margin-top:6px;text-align:right">${bioLen}/80</div>
        <div class="field-error"></div>
      </div>`;
      const avatarHint='建议比例 1:1（最低 20×20px），仅支持 JPG / PNG 图片';
      this.modal('修改资料（系统设置）',`<div class="form-grid">
        <div class="field full"><div class="muted">账号：${this.esc(prevUsername||id)}。保存会写入系统并创建一个「修改资料」分任务，由本地浏览器逐项提交（Username 被占用时自动恢复原账号名）。 <button type="button" class="tiny" onclick="app.openProfileChangeLogs(${Number(id)})">查看修改记录</button></div></div>
        ${this.field('username','账号名称 Username（可选）',prevUsername)}
        ${nickField}
        ${bioField}
        ${this.imageField('avatarUrl','头像（可选）',prevAvatar,false,{
          allowVideo:false,
          minImage:20,
          accept:'image/jpeg,image/jpg,image/png,.jpg,.jpeg,.png',
          pickLabel:'选择图片',
          dropText:'拖拽 JPG/PNG 图片到此处，或使用按钮选择。',
          hint:avatarHint,
        })}
      </div>`,async d=>{
        const nextUsername=String(d.username||'').replace(/^@+/,'').trim()||prevUsername;
        const nickname=String(d.nickname||'').trim();
        const signature=String(d.signature||'').trim();
        if(Array.from(signature).length>80)throw new Error('签名 Bio 不得超过 80 个字符');
        const avatarUrl=String(d.avatarUrl||'').split(',').map(s=>s.trim()).filter(Boolean)[0]||'';
        if(!nextUsername&&!nickname&&!signature&&!avatarUrl)throw new Error('请至少填写一项');
        const body={signature,avatarUrl};
        if(nextUsername)body.username=nextUsername;
        // 昵称可编辑时才写系统并推送；冷却期内输入框 disabled，d.nickname 为空，自然跳过
        if(nickname){body.nickname=nickname;}
        const usernameChanged=!!nextUsername&&nextUsername!==prevUsername;
        const nickChanged=!!nickname&&nickname!==prevName;
        const changed=usernameChanged||nickChanged||(signature&&signature!==prevBio)||(avatarUrl&&avatarUrl!==prevAvatar);
        // 只要弹框里有内容就推送：系统里「没变」不代表 TikTok 上已经是这个值，
        // 之前的 bug 就是重试时按「未变更」把昵称丢掉，导致 TikTok 一直没被填入。
        const payload={
          username:nextUsername,
          originalUsername:prevUsername,
          // 无论系统里是否「改过」都推一次：否则重试时会被当成「未变更」丢掉，
          // TikTok 上永远填不进去（历史 bug）。
          nickname,
          originalNickname:prevName,
          signature,
          avatarUrl,
          avatarPath:avatarUrl,
          applyProfileSettings:true,
          profileSettings:body,
          saveTraffic:true,
        };
        // 昵称在 7 天冷却内：明确告诉节点「本次不提交昵称」，
        // 否则节点会以为是老 payload 丢了昵称而用系统昵称兜底推送。
        if(nickDisabled)payload.skipNickname=true;
        const r=await this.api('/account-wizard/enqueue',{method:'POST',body:JSON.stringify({
          accountId:Number(id),
          taskType:'modify_profile',
          payload,
        })});
        const tail=r?.batch_id?`（总任务 #${r.batch_id}）`:'';
        this.toast(changed
          ? `修改资料任务已创建${nickDisabled?'（昵称在 7 天冷却内，本次不提交昵称）':'，昵称将一并提交'}${tail}`
          : `系统资料已保存，已创建任务重新推送一次${tail}`);
        this.closeModal();
        this.refresh();
      });
      // Bio 字数实时计数（按 Unicode 字符）
      const bioInput=document.querySelector('#profile-bio-input');
      const bioCount=document.querySelector('#profile-bio-count');
      if(bioInput&&bioCount){
        const syncBioCount=()=>{
          const n=Array.from(String(bioInput.value||'')).length;
          bioCount.textContent=`${n}/80`;
          bioCount.style.color=n>80?'#dc2626':'';
        };
        bioInput.addEventListener('input',syncBioCount);
        syncBioCount();
      }
    },
    fmtProfileTime(raw){
      const s=String(raw||'').trim();
      if(!s)return '-';
      return s.length>16?s.slice(0,16):s;
    },
    profileFieldRow(label,f,kind){
      if(!f)return '';
      let state='未修改',cls='muted';
      if(f.requested){ if(f.ok){state='成功';cls='online'}else{state='失败';cls='danger'} }
      const target=kind==='avatar'
        ? String(f.target||'').split('/').pop()
        : String(f.target||'');
      const reason=String(f.reason||'');
      return `<tr><td>${this.esc(label)}</td><td class="${cls}">${this.esc(state)}</td><td>${this.esc(target||'-')}</td><td class="muted">${this.esc(reason||'-')}</td></tr>`;
    },
    async openProfileChangeLogs(accountId){
      let pack={};
      try{ pack=await this.api(`/accounts/${accountId}/profile-change-logs?limit=50`)||{}; }catch(e){ this.toast(e.message||'读取修改记录失败',true); return; }
      const items=Array.isArray(pack.items)?pack.items:[];
      const body=items.length?items.map((rec)=>{
        const fields=rec.fields||{};
        const okAll=String(rec.status||'')==='ok';
        return `<div class="panel" style="margin-bottom:10px">
          <div class="toolbar" style="justify-content:space-between">
            <b>${this.esc(this.fmtProfileTime(rec.createdAt))}</b>
            <span class="${okAll?'online':'danger'}">${okAll?'执行成功':'执行失败'}${rec.itemId?` · 分任务 #${rec.itemId}`:''}</span>
          </div>
          ${rec.message?`<div class="muted" style="margin:6px 0">${this.esc(rec.message)}</div>`:''}
          ${rec.screenshot?`<div style="margin:6px 0"><a class="tiny" href="/api/browser/diagnostics/${encodeURIComponent(rec.screenshot)}" target="_blank" rel="noopener">查看现场截图</a></div>`:''}
          <table class="tk-data-table" style="min-width:0">
            <thead><tr><th style="width:90px">字段</th><th style="width:80px">结果</th><th>目标值</th><th>原因</th></tr></thead>
            <tbody>
              ${this.profileFieldRow('用户名',fields.username)}
              ${this.profileFieldRow('昵称',fields.nickname)}
              ${this.profileFieldRow('签名',fields.bio)}
              ${this.profileFieldRow('头像',fields.avatar,'avatar')}
            </tbody>
          </table>
        </div>`;
      }).join(''):'<div class="empty">暂无修改资料记录</div>';
      this.modal('修改资料记录',`<div class="form-grid"><div class="field full"><div class="muted">最近 50 次「修改资料」执行结果（用户名 / 昵称 / 签名 / 头像各自的成败与原因）。</div></div><div class="field full">${body}</div></div>`,
        async()=>{},
        false,
        {hideSubmit:true,wide:true,onClose:()=>{setTimeout(()=>this.modifyAccountProfile(accountId),200)}});
    },
    async batchDeleteVideos(){
      if(!this.canEditAccounts()){this.toast('当前角色无权批量删视频',true);return}
      const ids=this.selectedAccountIds();
      if(!ids.length){this.toast('请先选择账号',true);return}
      this.modal('批量删除视频',`<div class="form-grid">
        ${this.selectRaw('mode','执行方式',this.opt('videoDeleteModes',[['platform','浏览器环境删除 TikTok 视频'],['local','仅清理本地同步记录']]),'platform')}
        ${this.field('keepLatest','保留最新条数','0','number')}
        ${this.field('threads','并发（平台）','1','number')}
        <div class="field full"><div class="muted">已选 ${ids.length} 个账号。平台删除依赖本地已同步的视频列表；建议先「同步视频」。保留数之外的视频才会删除。</div></div>
      </div>`,async d=>{
        const mode=d.mode||'platform';
        const keepLatest=Number(d.keepLatest||0);
        if(mode==='platform'&&!(await this.ensureBitOnline('批量删视频')))return;
        if(mode==='platform'&&!(await this.ask(`确定在 TikTok 上删除超出保留 ${keepLatest} 条的视频吗？此操作不可恢复。`)))return;
        this.toast(mode==='platform'?'正在平台删除视频…':'正在清理本地记录…');
        const r=await this.api('/browser/accounts/batch-delete-videos',{method:'POST',body:JSON.stringify({accountIds:ids,keepLatest,mode,threads:Number(d.threads||1)})});
        if(r.mode==='local')this.toast(`已删除本地记录 ${r.deleted} 条`);
        else this.toast(`平台删视频：成功 ${r.success||r.deleted||0}，失败 ${r.failed||0}`,(r.failed||0)>0);
        this.closeModal();this.refresh();
      })
    },
    async batchDeleteLocalVideos(){return this.batchDeleteVideos()},
    async deleteTikTokVideo(accountId,videoId,videoUrl,description){
      if(!(await this.ask('确定在 TikTok 上删除该视频吗？')))return;
      try{
        this.toast('正在删除平台视频…');
        await this.api(`/browser/accounts/${accountId}/delete-video`,{method:'POST',body:JSON.stringify({
          videoId,
          videoUrl,
          description:description||'',
          searchTitle:description||'',
        })});
        this.toast('视频已删除');
        await this.viewTikTokData(accountId);
      }catch(e){this.toast(e.message,true)}
    },
    async batchCheckAccountIp(){const ids=this.selectedAccountIds();if(!ids.length){this.toast('请先选择账号',true);return}this.toast('正在批量检测代理出口…');try{const r=await this.api('/browser/accounts/batch-check-ip',{method:'POST',body:JSON.stringify({accountIds:ids})});this.toast(`可用 ${r.available}/${r.items.length}`);this.refresh()}catch(e){this.toast(e.message,true)}},
    async monitorModal(){const cfg=await this.api('/accounts/monitor');this.modal('监控账号设置',`<div class="form-grid">${this.selectRaw('enabled','启用定时监控',[['false','关闭'],['true','开启']],cfg.enabled?'true':'false')}${this.field('intervalMinutes','间隔（分钟）',cfg.intervalMinutes||60,'number')}${this.selectRaw('syncProfile','同步资料',[['true','是'],['false','否']],cfg.syncProfile?'true':'false')}${this.selectRaw('syncVideos','同步视频',[['false','否'],['true','是']],cfg.syncVideos?'true':'false')}<div class="field full"><div class="muted">上次运行：${this.esc(cfg.lastRunAt||'尚未运行')}。开启后服务会按间隔自动同步（需已绑定浏览器环境），也可手动点「同步账号资料」。 <button type="button" class="tiny" onclick="app.showMonitorResult()">查看上次结果</button></div></div></div>`,async d=>{d.enabled=d.enabled==='true';d.syncProfile=d.syncProfile==='true';d.syncVideos=d.syncVideos==='true';d.intervalMinutes=Number(d.intervalMinutes||60);d.accountIds=this.selectedAccountIds();await this.api('/accounts/monitor',{method:'PUT',body:JSON.stringify(d)});this.toast('监控配置已保存');this.closeModal()})},
    async runAccountMonitor(){if(!this.canEditAccounts()){this.toast('当前角色无权执行账号同步',true);return}this.toast('正在执行账号监控同步…');try{const r=await this.api('/accounts/monitor/run',{method:'POST'});const okCount=Number(r.profile||0)+Number(r.videos||0);const failed=Number(r.failed||0);this.toast(okCount||failed?`资料 ${r.profile||0}，视频 ${r.videos||0}，失败 ${failed}`:'没有可同步的账号（需已绑定浏览器环境）',!okCount);this.refresh()}catch(e){this.toast(e.message,true)}},
  
    envBackendPairs(){
      if(this.bitBrowserUiEnabled&&!this.bitBrowserUiEnabled())return [['tkswarm',this.tkswarmBrowserLabel()]];
      return [['bit','比特浏览器'],['tkswarm',this.tkswarmBrowserLabel()]];
    },
    normalizeEnvBackend(v){const s=String(v||'').toLowerCase().trim();if(s==='tkswarm'||s==='tkswarm-browses'||s==='desktop')return 'tkswarm';if(s==='linux'||s==='tkswarm-linux'||s==='tkswarm-linuxbrowse')return 'linux';if(s==='bit')return 'bit';return ''},
    detectedEnvBackend(st){
      const def=(this.defaultTaskBrowserBackend&&this.defaultTaskBrowserBackend())||'tkswarm';
      const a=st?.availableBackends||{};
      if(a.preferred){const p=this.normalizeEnvBackend(a.preferred);if(p&&(p!=='bit'||this.bitBrowserUiEnabled?.()))return p}
      if(a.tkswarm)return 'tkswarm';
      if(a.bit&&this.bitBrowserUiEnabled?.())return 'bit';
      const cur=this.normalizeEnvBackend(st?.provider||st?.browserBackend);
      return cur||def;
    },
    envBackendOnline(st,be){const a=st?.availableBackends||{};const b=this.normalizeEnvBackend(be)||((this.defaultTaskBrowserBackend&&this.defaultTaskBrowserBackend())||'tkswarm');if(b==='bit')return Boolean(a.bit);return Boolean(a.tkswarm)},
    envBackendText(be){const b=this.normalizeEnvBackend(be);if(b==='tkswarm')return this.tkswarmBrowserLabel();if(b==='linux')return this.tkswarmLinuxBrowserLabel();if(b==='bit'&&!(this.bitBrowserUiEnabled?.()))return '本地浏览器';return '比特浏览器'},
    /** 按指定后端校验在线（走该后端自己的地址/Token，不受全局配置影响） */
    async ensureEnvBackendOnline(be, actionLabel='该操作'){
      const def=(this.defaultTaskBrowserBackend&&this.defaultTaskBrowserBackend())||'tkswarm';
      const b=this.normalizeEnvBackend(be)||def;
      return this.ensureBrowserBackendOnline(b==='linux'?'tkswarm':(b==='bit'&&!(this.bitBrowserUiEnabled?.())?'tkswarm':b), actionLabel);
    },
    /** 浏览器诊断：把 health / group/list / browser/list 的原始返回摊开，定位 Token/登录/端口问题 */
    async diagnoseBrowser(){
      const be=this.normalizeEnvBackend(this.browserBackendFilter)||'';
      try{
        const d=await this.api(`/browser/diagnose${be?`?browserBackend=${encodeURIComponent(be)}`:''}`);
        const rows=(d.steps||[]).map(s=>{
          const detail=s.ok
            ? this.esc(JSON.stringify(s.data||{}).slice(0,400))
            : this.esc(`${s.message||''}${s.raw?` ／原始返回：${s.raw}`:''}`);
          return `<tr><td><code>${this.esc(s.step)}</code></td><td>${s.ok?'<span class="badge success">成功</span>':'<span class="badge warn">失败</span>'}</td><td>${s.ms}ms</td><td style="word-break:break-all;max-width:560px">${detail}</td></tr>`;
        }).join('');
        const head=`<div class="field full"><div class="muted">后端：<b>${this.esc(this.envBackendText(d.backend||be))}</b>；地址：<code>${this.esc(d.baseUrl||'-')}</code>；已带 Token：<b>${d.tokenSet?'是':'否'}</b>${d.tokenAutoDropped?'（Token 被客户端拒绝，已自动忽略）':''}</div></div>`;
        this.modal('浏览器诊断',`${head}<div class="table-container"><table class="table"><thead><tr><th>接口</th><th>结果</th><th>耗时</th><th>返回</th></tr></thead><tbody>${rows}</tbody></table></div>`,async()=>{this.closeModal()});
      }catch(e){
        this.toast(`诊断失败：${e.message||'未连接'}`,true,6000);
      }
    },
    formatEnvPackBytes(n){
      const v=Number(n)||0;
      if(v<=0)return '0B';
      if(v<1024)return `${v}B`;
      if(v<1024*1024)return `${Math.round(v/1024)}KB`;
      return `${(v/(1024*1024)).toFixed(1)}MB`;
    },
    /**
     * 一键更新环境包：按会话白名单精简打包，并以原环境 ID 同名文件覆盖中心库包。
     * （兼容旧名 syncAllEnvPacks）
     */
    async syncAllEnvPacks(){return this.updateAllEnvPacks()},
    async updateAllEnvPacks(){
      if(this._envPackSyncRunning){this.toast('正在更新环境包，请稍候');return}
      const bePreferred=this.normalizeEnvBackend(this.browserBackendFilter)||'tkswarm';
      const be=bePreferred==='bit'?'tkswarm':bePreferred;
      if(!(await this.ensureBrowserBackendOnline(be==='linux'?'linux':'tkswarm','更新环境包')))return;
      if(!(await this.ask(
        '将按「仅登录会话」规则重新打包本机自研/Linux 环境，并以原环境 ID 同名文件覆盖中心库环境包（不改环境名称与 ID）。\n\n'
        + '请确认本机第一页自研浏览器已升级并重启到 1.0.41+。是否继续？'
      )))return;
      this._envPackSyncRunning=true;
      const setProgress=(done,total,name='',extra='')=>{
        const title='正在更新环境包';
        const desc=total
          ?`共 ${total} 个，已更新 ${done} 个${name?` · 当前 ${name}`:''}${extra?`（${extra}）`:''}`
          :'正在读取本机环境列表…';
        if(window.UI)UI.loading(true,title,desc,{mode:'submit'});
      };
      setProgress(0,0);
      try{
        const qs=`/browser/profiles?pageSize=500&browserBackend=${encodeURIComponent(be==='linux'?'linux':'tkswarm')}`;
        const d=await this.api(qs).catch(()=>({items:[]}));
        const items=(d.items||[]).filter((x)=>{
          if(!x||!x.id)return false;
          if(x.fromBindings)return false; // 仅本机实体
          const t=String(x.browser_type||x.browser_backend||be||'').toLowerCase();
          if(t==='bit')return false;
          // 中心库落包需要账号绑定
          return !!(x.account&&(x.account.id||x.account.account_id));
        });
        const total=items.length;
        if(!total){
          if(window.UI)UI.loading(false);
          this.toast('没有可更新的本机自研环境（需本机存在且已绑定账号）',true);
          return;
        }
        let okCount=0;
        let failCount=0;
        let beforeTotal=0;
        let afterTotal=0;
        const errors=[];
        for(let i=0;i<items.length;i+=1){
          const row=items[i];
          const pid=String(row.id);
          const accountId=Number(row.account?.id||row.account?.account_id||0)||0;
          const label=row.account?.username
            ?`@${row.account.username}`
            :(row.name||pid.slice(0,8));
          let beforeBytes=0;
          try{
            const meta=await this.api(`/node/browser-profiles/${encodeURIComponent(pid)}/pack-meta`);
            beforeBytes=Number(meta?.packBytes||0)||0;
          }catch(_e){ beforeBytes=0; }
          setProgress(okCount,total,label,beforeBytes?`原 ${this.formatEnvPackBytes(beforeBytes)}`:'');
          try{
            const r=await this.api(`/browser/profiles/${encodeURIComponent(pid)}/sync-pack`,{
              method:'POST',
              body:JSON.stringify({
                accountId,
                browserBackend:be==='linux'?'linux':'tkswarm',
              }),
            });
            const afterBytes=Number(r?.packBytes||0)||0;
            beforeTotal+=beforeBytes;
            afterTotal+=afterBytes;
            okCount+=1;
            const sizeTip=afterBytes
              ?(beforeBytes
                ?`${this.formatEnvPackBytes(beforeBytes)} → ${this.formatEnvPackBytes(afterBytes)}`
                :this.formatEnvPackBytes(afterBytes))
              :'';
            setProgress(okCount,total,label,sizeTip);
          }catch(e){
            failCount+=1;
            errors.push(`${label}：${e.message||'失败'}`);
          }
        }
        const sizeSummary=(beforeTotal||afterTotal)
          ?`，体积 ${this.formatEnvPackBytes(beforeTotal)} → ${this.formatEnvPackBytes(afterTotal)}`
          :'';
        if(window.UI){
          UI.loading(
            true,
            failCount?`更新完成（失败 ${failCount}）`:'更新成功',
            `共 ${total} 个，成功 ${okCount} 个${failCount?`，失败 ${failCount} 个`:''}${sizeSummary}`,
            {mode:failCount?'submit':'success'},
          );
          await new Promise((r)=>setTimeout(r,failCount?900:1200));
          UI.loading(false);
        }
        if(failCount){
          const tip=errors.slice(0,3).join('；');
          this.toast(`环境包更新：成功 ${okCount}/${total}${sizeSummary}${tip?`。${tip}`:''}`,true,8000);
        }else{
          this.toast(`环境包已原名更新：共 ${total} 个${sizeSummary}`);
        }
      }catch(e){
        if(window.UI)UI.loading(false);
        this.toast(`更新失败：${e.message||e}`,true,6000);
      }finally{
        this._envPackSyncRunning=false;
      }
    },
    /** 编辑账号：切换执行后端时带出该后端已绑定的环境 ID */
    onEditAccountBackendChange(be){
      const b=this.normalizeEnvBackend(be)||(this.defaultTaskBrowserBackend?.()||'tkswarm');
      const input=document.querySelector('#modal-body [name="browserProfileId"]');
      if(input)input.value=(this._accountEnvIds||{})[b]||'';
      const hint=document.querySelector('#edit-env-hint');
      if(hint)hint.textContent=`当前：${this.envBackendText(b)}。请确认环境 ID 属于该客户端，保存后写入对应后端列。`;
    },
    browserBackendFilterHtml(cur){
      const v=this.normalizeEnvBackend(cur)||'';
      const opts=this.envBackendPairs().map(([k,n])=>`<option value="${k}" ${v===k?'selected':''}>${n}</option>`).join('');
      return `<select class="input" style="max-width:190px" title="按浏览器后端过滤环境列表" onchange="app.setBrowserBackendFilter(this.value)"><option value="" ${v?'':'selected'}>全部环境</option>${opts}</select>`;
    },
    setBrowserBackendFilter(be){
      this.browserBackendFilter=this.normalizeEnvBackend(be)||'';
      this.browserPage=1;
      // 账号页内嵌浏览器 Tab 用 mountBrowser，独立「环境」页用 renderBrowser
      if(document.querySelector('#account-main'))this.mountBrowser();
      else this.renderBrowser();
    },
    async renderBrowser(){
      if(!this.canView('accounts')&&!this.canAnyPermission('account.view','account.update','account.create')) return this.renderPageDenied('当前角色无权查看浏览器环境');
      const beFilter=this.normalizeEnvBackend(this.browserBackendFilter)||'';
      const profileQs=`/browser/profiles?pageSize=500${beFilter?`&browserBackend=${encodeURIComponent(beFilter)}`:''}`;
      const [status,d]=await Promise.all([this.api('/browser/status'),this.api(profileQs).catch(()=>({items:[],total:0})),this.ensureAuth().catch(()=>null)]);const u=this.authUser||this.authLoginUser||{};const quotaStat=this.stat('自研环境额度',`${Number(u.browserEnvUsed??0)} / ${Number(u.browserEnvQuota??300)}`,'当前账号已用 / 上限','#f0fdf4');const pack=UI.paginateLocal(d.items||[],this.browserPage||1,20);this.browserPage=pack.page;const connStat=status.online?this.stat('连接状态','在线',(status.providerLabel||'本地浏览器')+' API','#e8f8f1'):this.stat('连接状态','离线',status.message||'未连接','#fff0f0');const totalHint=status.online?'本地 API + 数据库绑定':'数据库绑定记录';document.querySelector('#content').innerHTML=`<div class="stats">${connStat}${quotaStat}${this.stat('环境总数',d.total,totalHint,'#eeeafe')}${this.stat('已绑定账号',(d.items||[]).filter(x=>x.account).length,'账号与环境关联','#e7f3ff')}${this.stat('API 地址',status.online?'在线':'离线',status.apiUrl||'-','#fff6df')}</div><div class="panel">${this.browserOfflineBanner(status)}<div class="toolbar">${this.browserBackendFilterHtml(beFilter)}${this.browserQuotaBadgeHtml()}<span class="muted">当前列表：${this.esc(this.envBackendText(beFilter||d.envType||status.provider))}。创建环境会使用账号代理并按国家设置语言。</span><div><button class="ghost" type="button" onclick="app.diagnoseBrowser()" title="查看 health / group/list / browser/list 的原始返回">诊断</button><button class="ghost" type="button" onclick="app.updateAllEnvPacks()" title="按会话白名单精简打包，并以原环境 ID 文件名覆盖中心库环境包">一键更新环境包</button><div class="dropdown" style="display:inline-block"><button class="ghost" type="button" onclick="app.toggleBrowserBatchMenu(event)">批量操作 <span class="btn-arrow-down">▾</span></button><div id="browser-batch-menu" class="dropdown-menu align-left hidden">${this.canEditBrowserEnvs()?`<button type="button" onclick="app.batchCreateBrowserModal()">创建环境</button><button type="button" class="is-danger" onclick="app.batchDeleteBrowser()">删除环境</button>`:''}<button type="button" onclick="app.syncBrowserEnvs()">同步环境</button></div></div></div></div>${this.browserTable(pack.items,d)}${UI.pager(pack,'browserPage')}</div>`},
    browserTypeBadge(type,label){
      const t=String(type||'').toLowerCase();
      const text=label||(t==='linux'?this.tkswarmLinuxBrowserLabel():t==='tkswarm'?this.tkswarmBrowserLabel():(t==='bit'&&this.bitBrowserUiEnabled?.())?'比特':'本地');
      const cls=t==='linux'?'online':t==='tkswarm'?'success':t==='bit'?'':'warn';
      return `<span class="badge ${cls}">${this.esc(text)}</span>`;
    },
    browserEnvEmptyHint(meta){
      if(this.authActingAs)return '当前正以子账号身份查看，仅显示该身份可见账号的环境绑定。右下角可切回超管身份。';
      if(meta?.bindingsError)return `读取环境绑定失败：${this.esc(meta.bindingsError)}`;
      if(meta?.localOnline)return '本地浏览器已连接，但当前身份可见范围内没有环境记录。请确认账号已「创建环境」并完成绑定。';
      if(Number(meta?.bindingCount||0)>0)return '数据库有绑定记录但未匹配到本机窗口，请启动浏览器后点「同步环境」。';
      return '数据库中暂无环境绑定。浏览器离线时无法读取本机窗口；请启动浏览器后在账号上「创建环境」，或访问 API 维护页执行 rebuild 回填。';
    },
    browserTable(rows,meta){
      if(!rows.length)return `<div class="empty"><p>还没有浏览器环境</p><p class="muted" style="margin-top:8px">${this.browserEnvEmptyHint(meta||{})}</p></div>`;
      return `<table><thead><tr><th><input type="checkbox" onchange="app.toggleAllBrowser(this.checked)" title="全选当前列表"></th><th>序号</th><th>环境名称</th><th>类型</th><th>所属用户</th><th>环境 ID</th><th>代理</th><th>内核</th><th>绑定账号</th><th>操作</th></tr></thead><tbody>${rows.map(x=>{
        const id=this.esc(x.id);
        const canEdit=this.canEditBrowserEnvRow(x);
        const typeLabel=x.browser_type_label||x.account?.browser_type_label||'';
        const typeVal=this.normalizeEnvBackend(x.browser_type||x.account?.browser_type||x.account?.browser_backend)||(this.defaultTaskBrowserBackend?.()||'tkswarm');
        const beArg=JSON.stringify(typeVal);
        const more=[];
        more.push(`<button type="button" onclick="app.checkBrowserTikTokStatus('${id}',${beArg})">检测登录</button>`);
        more.push(`<button type="button" data-env="${id}" data-env-backend="${this.esc(typeVal)}" data-env-label="${this.esc(x.name||('环境 '+id))}" onclick="app.browserActionFromBtn(this,'open')">打开</button>`);
        more.push(`<button type="button" data-env="${id}" data-env-backend="${this.esc(typeVal)}" data-env-label="${this.esc(x.name||('环境 '+id))}" onclick="app.browserActionFromBtn(this,'close')">关闭</button>`);
        const delBtn=canEdit?`<button class="tiny danger" type="button" title="删除" onclick="app.deleteBrowser('${id}',${beArg})">删除</button>`:'';
        const moreBtn=more.length?`<div class="ops-dropdown browser-ops-dropdown"><button class="tiny" type="button" title="更多" onclick="app.toggleBrowserOps('${id}',event)">…</button><div id="browser-ops-${id}" class="dropdown-menu ops-menu hidden">${more.join('')}</div></div>`:'';
        const owner=x.owner_label||x.account?.owner_label||(x.account?'-':'—');
        const shared=!!(x.account&&(x.account.shared||x.account.locked));
        const sharedTag=shared?' <span class="badge warn" title="该环境绑定的是其他用户的账号，可直接打开使用（环境共用）；解绑/删除需账号归属人权限">共用</span>':'';
        const bindCell=x.account
          ?`<b>${this.esc(x.account.username||'他人账号')}</b>${sharedTag}${x.account.saturation==='busy'?' <span class="badge warn">执行中</span>':' <span class="badge success">空闲</span>'}${canEdit&&!shared?` <button class="tiny" onclick="app.unbindBrowser(${x.account.id},${JSON.stringify(String(x.id||''))})">解绑</button>`:''}`
          :(canEdit?`<button class="tiny" onclick="app.bindBrowser('${id}',${beArg})">绑定账号</button>`:'<span class="muted">未绑定</span>');
        return `<tr><td><input class="browser-check" type="checkbox" value="${id}"></td><td>${x.seq||'-'}</td><td><b>${this.esc(x.name||'-')}</b><div class="muted">${this.esc(x.remark||'')}</div></td><td>${this.browserTypeBadge(typeVal,typeLabel)}</td><td>${this.esc(owner)}${x.owner_username||x.account?.owner_username?`<div class="muted">@${this.esc(x.owner_username||x.account.owner_username)}</div>`:''}</td><td><span class="muted">${id}</span></td><td>${this.esc(x.proxyType||'-')} ${this.esc(x.host||'')}${x.port?':'+x.port:''}</td><td>${this.esc(x.coreProduct||'-')} ${this.esc(x.coreVersion||'')}</td><td>${bindCell}</td><td><div class="task-ops-cell browser-ops-cell">${delBtn}${moreBtn}</div></td></tr>`;
      }).join('')}</tbody></table>`;
    },
    toggleBrowserOps(id,e){
      e?.stopPropagation?.();
      const menu=document.getElementById('browser-ops-'+id);
      const willShow=menu?.classList.contains('hidden');
      document.querySelectorAll('.dropdown-menu').forEach(m=>{m.classList.add('hidden');if(window.UI)UI.restoreMenu(m)});
      if(menu && willShow){
        menu.classList.add('ops-menu');
        menu.classList.remove('hidden');
        const btn=e?.currentTarget||menu.closest('.ops-dropdown')?.querySelector('button');
        if(window.UI) UI.liftMenu(menu, btn, {side:'left'});
      }
    },
    toggleBrowserBatchMenu(e){
      e?.stopPropagation?.();
      this.toggleToolbarDropdown('#browser-batch-menu', e);
    },
    async syncBrowserEnvs(){
      if(!(await this.ensureBitOnline('同步环境')))return;
      this.toast('正在将本机环境绑定写入数据库…',false,8000);
      try{
        const r=await this.api('/browser/profiles/sync-bindings',{method:'POST',body:'{}'});
        let msg=`扫描 ${r.scanned||0}，新入库 ${r.synced||0}，跳过 ${r.skipped||0}`;
        if(r.failed)msg+=`，失败 ${r.failed}`;
        const first=r.errors?.[0];
        if(first)msg+=`；${first.profileId}: ${first.reason||''}`;
        this.toast(msg,!!r.failed,r.failed?6000:3000);
        this.refresh();
      }catch(e){this.toast(e.message||'同步失败',true)}
    },
    toggleAllBrowser(checked){document.querySelectorAll('.browser-check').forEach(x=>{x.checked=checked})},
    async batchDeleteBrowser(){
      if(!this.canEditBrowserEnvs()){this.toast('当前角色无权删除浏览器环境',true);return}
      const ids=[...document.querySelectorAll('.browser-check:checked')].map(x=>x.value);
      if(!ids.length){this.toast('请先选择要删除的浏览器环境',true);return}
      const be=this.normalizeEnvBackend(this.browserBackendFilter)||'';
      if(!(await this.ask(`确定删除选中的 ${ids.length} 个浏览器环境吗？已绑定账号的会先解绑再删除（账号保留，其余环境仍可用）。`)))return;
      try{
        const r=await this.api('/browser/profiles/batch-delete',{method:'POST',body:JSON.stringify({profileIds:ids,browserBackend:be||undefined})});
        let message=`已删除 ${r.deleted} 个环境`;
        if(r.unbound)message+=`（其中 ${r.unbound} 个已同步解绑）`;
        if(r.blocked||r.failed)message+=`，跳过 ${r.blocked}，失败 ${r.failed}`;
        this.toast(message,Boolean(r.blocked||r.failed));
        this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    async deleteBrowser(id,backend=''){
      if(!this.canEditBrowserEnvs()){this.toast('当前角色无权删除浏览器环境',true);return}
      const be=this.normalizeEnvBackend(backend)||'';
      if(!(await this.ask('确定删除这个浏览器环境吗？若已绑定账号将先解绑再删除（不会删除账号）。')))return;
      try{
        await this.api(`/browser/profiles/${id}${be?`?browserBackend=${encodeURIComponent(be)}`:''}`,{method:'DELETE'});
        this.toast('浏览器环境已删除');
        this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    /** 从带 data-env* 的按钮发起开/关环境，便于把环境名带进提示 */
    browserActionFromBtn(btn, action='open'){
      const el=btn?.currentTarget||btn;
      const id=String(el?.getAttribute?.('data-env')||'').trim();
      const label=String(el?.getAttribute?.('data-env-label')||'').trim();
      const backend=String(el?.getAttribute?.('data-env-backend')||'').trim();
      const accountId=Number(el?.getAttribute?.('data-account-id')||0)||0;
      return this.browserAction(id, action, backend, label, accountId);
    },
    async browserAction(profileId, action='open', backend='', label='', accountId=0){
      if(!profileId){this.toast('缺少环境 ID',true);return}
      const be=this.normalizeEnvBackend(backend)||this.normalizeEnvBackend(this.browserBackendFilter)||'';
      const beText=this.envBackendText(be||(this.defaultTaskBrowserBackend?.()||'tkswarm'));
      const envText=String(label||'').trim()||`环境 ${profileId}`;
      const showTask=typeof UI!=='undefined'&&typeof UI.notifyLoading==='function';
      const verb=action==='close'?'关闭':'打开';
      // 先出提示再校验在线，避免点了没反应；校验失败就把这条提示改成失败
      const task=showTask?UI.notifyLoading({title:beText,message:`${envText} 正在${verb}中…`}):null;
      if(!task)this.toast(`${beText} · ${envText} 正在${verb}中…`,false,8000);
      if(!(await this.ensureEnvBackendOnline(be, action==='close'?'关闭环境':'打开环境'))){
        if(task)task.error(`${envText} ${verb}失败：${beText}未连接，请先启动客户端并开启本地 API`,7000);
        return;
      }
      const body=JSON.stringify({
        browserBackend:be||undefined,
        ...(action==='close'?{}:{fastOpen:true,accountId:accountId||undefined}),
      });
      if(action==='close'){
        try{
          await this.api(`/browser/profiles/${encodeURIComponent(profileId)}/close`,{method:'POST',body});
          if(task)task.success(`${envText} 已关闭`);else this.toast('已关闭浏览器环境');
        }catch(e){
          if(task)task.error(`${envText} 关闭失败：${e.message||'未知错误'}`);else this.toast(e.message||'操作失败',true,6000);
        }
        return;
      }
      // 打开窗口：右上角常驻「正在打开中」，结束后原地变成成功/失败，多条可同时显示
      const startedAt=Date.now();
      try{
        await this.api(`/browser/profiles/${encodeURIComponent(profileId)}/open`,{method:'POST',body});
        const cost=Date.now()-startedAt;
        const costText=cost>=1500?`（${(cost/1000).toFixed(1)} 秒）`:'';
        if(task)task.success(`${envText} 打开成功${costText}`);else this.toast('已打开浏览器环境');
      }catch(e){
        const msg=e.message||'操作失败';
        if(task)task.error(`${envText} 打开失败：${msg}`);else this.toast(msg,true,6000);
      }
    },
    async checkBrowserTikTokStatus(profileId, backend=''){
      if(!profileId){this.toast('缺少环境 ID',true);return}
      const be=this.normalizeEnvBackend(backend)||this.normalizeEnvBackend(this.browserBackendFilter)||'';
      if(!(await this.ensureEnvBackendOnline(be, '检测登录')))return;
      this.toast('正在检测 TikTok 登录状态...');
      try{
        const r=await this.api(`/browser/profiles/${encodeURIComponent(profileId)}/tiktok-status`,{method:'POST',body:JSON.stringify({browserBackend:be||undefined})});
        const top=r?.topRight?.avatar?'右上角有头像':(r?.topRight?.loginButton?'右上角显示 Log in 按钮':'');
        this.toast(
          r.loggedIn
            ?`TikTok 已登录，状态已保存${top?`（${top}）`:''}`
            :`账号未登录${top?`：${top}`:''}，请先点「登录」${r?.pageError?'（页面态检测失败，仅按 Cookie 判断）':''}`,
          !r.loggedIn
        );
        this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    /** 创建/再绑后兜底：服务端未推包时再调 sync-pack（仅自研/Linux） */
    async ensureEnvPackUploaded(profileId,accountId,browserBackend,createResult){
      const be=this.normalizeEnvBackend(browserBackend)||'';
      const pid=String(profileId||'').trim();
      if(!pid||(be!=='tkswarm'&&be!=='linux')){
        return {packPushed:false,packSkipped:true,packReason:'backend-unsupported'};
      }
      if(createResult&&createResult.packPushed===true){
        return {
          packPushed:true,
          packSkipped:false,
          packRevision:createResult.packRevision,
          packBytes:createResult.packBytes,
        };
      }
      if(createResult&&createResult.packSkipped===true){
        return {packPushed:false,packSkipped:true,packReason:createResult.packReason||'backend-unsupported'};
      }
      try{
        const r=await this.api(`/browser/profiles/${encodeURIComponent(pid)}/sync-pack`,{
          method:'POST',
          body:JSON.stringify({accountId:Number(accountId)||0,browserBackend:be}),
        });
        return {
          packPushed:true,
          packSkipped:false,
          packRevision:r?.packRevision,
          packBytes:r?.packBytes,
        };
      }catch(e){
        return {
          packPushed:false,
          packSkipped:false,
          packReason:e.message||String(e),
        };
      }
    },
    /** 解析账号在指定后端的当前环境 ID */
    resolveAccountEnvProfileId(acc,backend=''){
      const be=this.normalizeEnvBackend(backend)||'';
      if(!acc)return '';
      if(be==='tkswarm'){
        return String(acc.tkswarm_browser_profile_id||(String(acc.browser_backend||'')==='tkswarm'?acc.browser_profile_id:'')||'').trim();
      }
      if(be==='linux'){
        return String(acc.linux_browser_profile_id||(String(acc.browser_backend||'')==='linux'?acc.browser_profile_id:'')||'').trim();
      }
      if(be==='bit'){
        return String(acc.bit_browser_profile_id||(String(acc.browser_backend||'')==='bit'||!acc.browser_backend?acc.browser_profile_id:'')||acc.browser_profile_id||'').trim();
      }
      return String(acc.browser_profile_id||acc.tkswarm_browser_profile_id||acc.linux_browser_profile_id||'').trim();
    },
    /** 已绑定且中心库有环境包时不可再绑 */
    async checkRebindBlocked(accountId,backend,accHint=null){
      const be=this.normalizeEnvBackend(backend)||'';
      let acc=accHint;
      if(!acc){
        try{acc=await this.api(`/accounts/${accountId}`);}catch{acc=null;}
      }
      const pid=this.resolveAccountEnvProfileId(acc,be);
      if(!pid)return {blocked:false,profileId:''};
      try{
        const meta=await this.api(`/node/browser-profiles/${encodeURIComponent(pid)}/pack-meta`);
        if(meta?.hasPack){
          return {
            blocked:true,
            profileId:pid,
            reason:`账号已绑定环境 ${pid.slice(0,8)}… 且中心库已有环境包，不允许再绑更换。如需更换请先解绑该环境`,
          };
        }
      }catch{
        // 无包/404 放行；真正提交时服务端仍会校验
      }
      return {blocked:false,profileId:pid};
    },
    async createAccountBrowser(id,opts={}){
      const rebind=!!opts.rebind;
      if(rebind){
        if(!this.canRebindBrowserEnv()){this.toast('仅超级管理员或运营管理可再绑环境',true);return}
      }else if(!this.canEditBrowserEnvs()){
        this.toast('当前角色无权创建/绑定环境',true);return;
      }
      const actionLabel=rebind?'再绑环境':'创建环境';
      // 只做一次探测拿默认值，真正的在线校验在提交时按所选后端执行
      const st=await this.api('/browser/status').catch(()=>null);
      const detected=this.detectedEnvBackend(st||{});

      let ownerFieldHtml='';
      let ownerTargets=[];
      let defaultOwnerId=Number(opts.ownerId||0);
      let rebindAcc=null;
      if(rebind){
        const [acc,targets]=await Promise.all([
          this.api(`/accounts/${id}`).catch(()=>({id,owner_id:defaultOwnerId})),
          this.loadRebindOwnerTargets().catch(()=>[]),
        ]);
        rebindAcc=acc;
        defaultOwnerId=Number(acc?.owner_id||defaultOwnerId||0);
        ownerTargets=[...(Array.isArray(targets)?targets:[])];
        if(defaultOwnerId>0&&!ownerTargets.some((u)=>Number(u.id)===defaultOwnerId)){
          const nick=acc?.owner_nickname||acc?.owner_label||'';
          const uname=acc?.owner_username||'';
          ownerTargets.unshift({
            id:defaultOwnerId,
            username:uname||String(defaultOwnerId),
            nickname:nick||uname||('#'+defaultOwnerId),
            roleName:'',
            roleType:'operator',
          });
        }
        if(!ownerTargets.length){
          this.toast('没有可选的后台管理用户，无法再绑环境',true);
          return;
        }
        const cur=defaultOwnerId>0&&ownerTargets.some((u)=>Number(u.id)===defaultOwnerId)
          ?String(defaultOwnerId)
          :String(ownerTargets[0].id);
        const ownerOpts=ownerTargets.map((u)=>[String(u.id),this.ownerAssignLabel(u)]);
        ownerFieldHtml=this.selectRaw('ownerUserId','耗用环境的管理用户',ownerOpts,cur);
      }

      const hint=rebind
        ?`将在所选浏览器为账号 #${id} 再绑一个新环境（追加绑定）。若该后端已有绑定且中心库环境包存在，将禁止更换。新环境额度计入下方所选管理用户。`
        :`将在所选浏览器为账号 #${id} 新建环境并设为主绑定（写入数据库）。`;
      this.modal(actionLabel,`<div class="form-grid">
        ${this.selectRaw('browserBackend','创建到',this.envBackendPairs(),detected)}
        ${ownerFieldHtml}
        <div class="field full"><div class="muted">${this.esc(hint)}环境会自动继承账号代理，并按账号国家设置浏览器语言。</div></div>
      </div>`,async d=>{
        const be=this.normalizeEnvBackend(d.browserBackend)||detected;
        if(rebind){
          const guard=await this.checkRebindBlocked(id,be,rebindAcc);
          if(guard.blocked){this.toast(guard.reason,true,8000);return}
        }
        const online=await this.ensureEnvBackendOnline(be, actionLabel);
        if(!online)return;
        const body={asPrimary:!rebind,rebind,browserBackend:be};
        if(rebind){
          const ownerUserId=Number(d.ownerUserId||0);
          if(!ownerUserId){this.toast('请选择要耗用额度的管理用户',true);return}
          const u=ownerTargets.find((x)=>Number(x.id)===ownerUserId);
          const ownerName=u?this.ownerAssignLabel(u):('#'+ownerUserId);
          // 确认框需露出来，先关掉 modal 提交时的 loading
          if(window.UI)UI.loading(false);
          if(!(await this.ask(
            `确认为账号 #${id} 再绑环境？\n将新建并追加绑定一个浏览器环境，并耗用管理用户「${ownerName}」的 1 个环境额度。原环境仍保留。`
          )))return;
          if(window.UI)UI.loading(true,'正在提交','请稍候，正在再绑环境');
          body.ownerUserId=ownerUserId;
        }
        this.toast(`正在${this.envBackendText(be)}${actionLabel}并上传环境包…`,false,12000);
        const r=await this.api(`/browser/accounts/${id}/create`,{method:'POST',body:JSON.stringify(body)});
        const pack=await this.ensureEnvPackUploaded(r.profileId,id,r.browserBackend||be,r);
        const packOk=pack.packPushed===true;
        const packSkip=pack.packSkipped===true;
        const packTip=packOk?'，环境包已上传中心库'
          :(pack.packReason==='pack-too-small'?'（新环境尚未登录，环境包将在登录后上传）'
          :(!packSkip&&pack.packReason?`（环境包上传失败：${pack.packReason}）`:''));
        this.toast(rebind
          ?`已追加绑定到 ${this.envBackendText(r.browserBackend||be)}：${r.profileName||r.profileId||''}（原环境仍保留）${packTip}`
          :`已写入数据库并绑定到 ${this.envBackendText(r.browserBackend||be)}：${r.profileName||r.profileId||''}${packTip}`,
          !packSkip&&!packOk&&!!pack.packReason);
        this.closeModal();
        this.refresh();
      });
    },
    /**
     * 批量重绑环境：选管理用户 → JS 逐个再绑；Node 在每条创建成功后立即导出并上传环境包。
     * 仅超管 / 运营管理可见与可操作。
     */
    async batchRebindBrowserEnvs(){
      if(!this.canRebindBrowserEnv()){this.toast('仅超级管理员或运营管理可重绑环境',true);return}
      if(this._batchRebindRunning){this.toast('正在批量重绑环境，请稍候');return}
      const ids=this.selectedAccountIds();
      if(!ids.length){this.toast('请先勾选要重绑环境的账号',true);return}
      const st=await this.api('/browser/status').catch(()=>null);
      const detected=this.detectedEnvBackend(st||{});
      const ownerTargets=await this.loadRebindOwnerTargets().catch(()=>[]);
      if(!ownerTargets.length){this.toast('没有可选的后台管理用户，无法重绑环境',true);return}
      const ownerOpts=ownerTargets.map((u)=>[String(u.id),this.ownerAssignLabel(u)]);
      const defaultOwner=String(ownerTargets[0].id);
      this.modal('批量重绑环境',`<div class="form-grid">
        ${this.selectRaw('browserBackend','创建到',this.envBackendPairs(),detected)}
        ${this.selectRaw('ownerUserId','耗用环境的管理用户',ownerOpts,defaultOwner)}
        <div class="field full"><div class="muted">已选 ${ids.length} 个账号。将逐个追加绑定新环境（原环境保留）；若账号该后端已有绑定且中心库环境包存在则跳过。额度计入所选管理用户；每条创建成功后会立即导出并上传中心库环境包（自研/Linux）。</div></div>
      </div>`,async d=>{
        const be=this.normalizeEnvBackend(d.browserBackend)||detected;
        const ownerUserId=Number(d.ownerUserId||0);
        if(!ownerUserId){this.toast('请选择要耗用额度的管理用户',true);return}
        const u=ownerTargets.find((x)=>Number(x.id)===ownerUserId);
        const ownerName=u?this.ownerAssignLabel(u):('#'+ownerUserId);
        if(window.UI)UI.loading(false);
        if(!(await this.ask(
          `确认为 ${ids.length} 个账号重绑环境？\n将逐个新建并追加绑定，耗用「${ownerName}」共 ${ids.length} 个环境额度。原环境仍保留。\n已有环境包的账号将自动跳过。`
        )))return;
        const online=await this.ensureEnvBackendOnline(be,'批量重绑环境');
        if(!online)return;
        this.closeModal();
        this._batchRebindRunning=true;
        const packSupported=be==='tkswarm'||be==='linux';
        const setProgress=(done,total,label='',phase='')=>{
          const title='正在批量重绑环境';
          const desc=total
            ?`共 ${total} 个，已完成 ${done} 个${label?` · ${phase||'当前'} ${label}`:''}`
            :'准备中…';
          if(window.UI)UI.loading(true,title,desc,{mode:'submit'});
        };
        let okCount=0;
        let failCount=0;
        let skipCount=0;
        let packOk=0;
        const errors=[];
        setProgress(0,ids.length);
        try{
          for(let i=0;i<ids.length;i+=1){
            const id=ids[i];
            const label=`#${id}`;
            setProgress(okCount,ids.length,label,packSupported?'再绑并上传包':'再绑');
            try{
              const guard=await this.checkRebindBlocked(id,be);
              if(guard.blocked){
                skipCount+=1;
                errors.push(`${label}：已有环境包，已跳过`);
                continue;
              }
              const r=await this.api(`/browser/accounts/${id}/create`,{
                method:'POST',
                body:JSON.stringify({
                  asPrimary:false,
                  rebind:true,
                  browserBackend:be,
                  ownerUserId,
                }),
              });
              okCount+=1;
              if(packSupported){
                setProgress(okCount,ids.length,label,'上传包');
                const pack=await this.ensureEnvPackUploaded(r?.profileId,id,be,r);
                if(pack.packPushed)packOk+=1;
                else if(!pack.packSkipped){
                  errors.push(`${label} 已绑定但环境包失败：${pack.packReason||'上传失败'}`);
                }
              }
              setProgress(okCount,ids.length,label,'完成');
            }catch(e){
              failCount+=1;
              errors.push(`${label}：${e.message||'失败'}`);
            }
          }
          if(window.UI){
            UI.loading(
              true,
              (failCount||skipCount)?`重绑完成（失败 ${failCount}${skipCount?`，跳过 ${skipCount}`:''}）`:'重绑成功',
              `共 ${ids.length} 个，成功 ${okCount} 个${skipCount?`，跳过 ${skipCount} 个`:''}${failCount?`，失败 ${failCount} 个`:''}${packSupported?`，环境包 ${packOk}/${okCount}`:''}`,
              {mode:(failCount||skipCount)?'submit':'success'},
            );
            await new Promise((r)=>setTimeout(r,(failCount||skipCount)?900:1000));
            UI.loading(false);
          }
          if(failCount||skipCount||errors.length){
            const tip=errors.slice(0,3).join('；');
            this.toast(`重绑环境：成功 ${okCount}/${ids.length}${skipCount?`，跳过 ${skipCount}`:''}${packSupported?`，环境包 ${packOk}/${okCount}`:''}${tip?`。${tip}`:''}`,true,8000);
          }else{
            this.toast(`重绑环境成功：共 ${ids.length} 个${packSupported?`，环境包已上传 ${packOk}/${okCount}`:''}`);
          }
          this.refresh();
        }catch(e){
          if(window.UI)UI.loading(false);
          this.toast(`批量重绑失败：${e.message||e}`,true,6000);
        }finally{
          this._batchRebindRunning=false;
        }
      });
    },
    async batchCreateBrowserModal(){
      if(!this.canEditBrowserEnvs()){this.toast('当前角色无权批量创建环境',true);return}
      const st=await this.api('/browser/status').catch(()=>null);
      const detected=this.detectedEnvBackend(st||{});
      const ids=this.selectedAccountIds();
      const groups=(this.groups||[]).filter(g=>g.type==='account'||!g.type);
      const scopeTip=ids.length?`将为已勾选的 ${ids.length} 个账号创建环境。`:'未勾选账号时，按分组创建给「尚未绑定该后端环境」的账号。';
      this.modal('批量创建环境',`<div class="form-grid">
        ${this.selectRaw('browserBackend','创建到',this.envBackendPairs(),detected)}
        <div class="field full"><div class="muted">${this.esc(scopeTip)}创建到自研时会写入 tkswarm 环境 ID 并切主绑定；每条成功后会立即上传环境包到中心库。</div></div>
        ${ids.length?'':this.selectRaw('groupId','账号分组（可空=全部）',[['','全部账号'],...groups.map(g=>[String(g.id),g.name])])}
      </div>`,async d=>{
        const be=this.normalizeEnvBackend(d.browserBackend)||detected;
        const online=await this.ensureEnvBackendOnline(be, '批量创建环境');
        if(!online)return;
        this.toast(`正在${this.envBackendText(be)}批量创建环境，请稍候…`,false,8000);
        const body=ids.length
          ?{accountIds:ids,asPrimary:true,browserBackend:be}
          :{groupId:d.groupId?Number(d.groupId):null,requireProxy:false,browserBackend:be};
        const r=await this.api('/browser/accounts/batch-create',{method:'POST',body:JSON.stringify(body)});
        let packPushed=Number(r.packPushed||0);
        let packFailed=Number(r.packFailed||0);
        const packBe=this.normalizeEnvBackend(r.browserBackend||be)||be;
        if((packBe==='tkswarm'||packBe==='linux')&&Array.isArray(r.items)){
          for(const it of r.items){
            if(it?.packPushed||it?.packSkipped||!it?.profileId)continue;
            const pack=await this.ensureEnvPackUploaded(it.profileId,it.accountId,packBe,it);
            if(pack.packPushed){packPushed+=1;if(packFailed>0)packFailed-=1;}
            else if(!pack.packSkipped)packFailed+=1;
          }
        }
        const first=r.errors?.[0];
        let msg=`${this.envBackendText(r.browserBackend||be)}：成功 ${r.created}（已写入数据库），失败 ${r.failed}`;
        if(packPushed||packFailed){
          msg+=`，环境包上传 ${packPushed}/${r.created}`;
        }
        if(first)msg+=`；#${first.id}：${first.reason||''}`;
        this.toast(msg,r.failed>0||packFailed>0,r.failed||packFailed?6000:3000);
        this.closeModal();
        this.refresh();
      });
    },
    async batchCreateBrowser(){return this.batchCreateBrowserModal()},
    async bindBrowser(profileId, backend=''){
      if(!this.canEditBrowserEnvs()){this.toast('当前角色无权绑定浏览器环境',true);return}
      const be=this.normalizeEnvBackend(backend)||this.normalizeEnvBackend(this.browserBackendFilter)||'';
      const d=await this.api('/accounts?pageSize=200');
      // 一账号可绑多环境：列出全部启用账号（该 profile 未被占用由后端校验）
      const accounts=(d.items||[]).filter(x=>x.enabled!==0&&x.enabled!==false);
      if(!accounts.length){this.toast('没有可绑定的账号',true);return}
      const options=accounts.map(x=>({id:x.id,name:`#${x.id} · ${x.username}`+(x.nickname?' · '+x.nickname:'')+(x.browser_profile_id?'（已有环境，将追加）':'')}));
      const backendField=be?'':`<div class="field full"><div class="muted">未从列表识别到环境后端，请手动选择。</div></div>${this.selectRaw('browserBackend','环境所属浏览器',[...this.envBackendPairs(),['','按全局配置']],this.detectedEnvBackend({availableBackends:{}}))}`;
      this.modal('绑定浏览器环境',`<div class="form-grid">
        ${this.select('accountId','选择账号',options)}
        ${backendField}
        <div class="field full"><div class="muted">环境 ID：${this.esc(profileId)}${be?`（${this.esc(this.envBackendText(be))}）`:''}。同一账号可绑定多个浏览器环境；执行总任务时占用空闲环境，结束后释放。</div></div>
      </div>`,async data=>{
        if(!data.accountId)throw new Error('请选择账号');
        const chosen=this.normalizeEnvBackend(data.browserBackend)||be||'';
        const r=await this.api('/browser/bind',{method:'POST',body:JSON.stringify({accountId:Number(data.accountId),profileId,asPrimary:true,browserBackend:chosen||undefined})});
        this.toast(r?.dbPersisted?`环境已绑定到 ${this.envBackendText(r.browserBackend||chosen||this.defaultTaskBrowserBackend?.()||'tkswarm')} 并写入数据库`:(r?.message||'环境已绑定'));
        this.closeModal();
        this.refresh();
      });
    },
    async unbindBrowser(accountId, profileId){
      if(!this.canEditBrowserEnvs()){this.toast('当前角色无权解绑浏览器环境',true);return}
      const tip=profileId?`确定解除账号 #${accountId} 与该环境的绑定吗？`:'确定解除这个账号的全部浏览器环境绑定吗？';
      if(!(await this.ask(tip)))return;
      await this.api('/browser/unbind',{method:'POST',body:JSON.stringify({accountId, profileId: profileId||'', clear:true})});
      this.toast('已解除绑定');
      this.refresh();
    },
    async batchModifyIp(){
      if(!this.canBatchModifyAccounts()){this.toast('当前角色无权批量修改账号',true);return}
      const ids=this.selectedAccountIds();
      if(!ids.length){this.toast('请先勾选账号',true);return}
      this.modal('批量修改IP',`<div class="form-grid">
        ${this.field('proxyString','代理串','','text',true)}
        <div class="field full"><div class="muted">已选 ${ids.length} 个账号。格式：ip:端口 或 ip:端口:账号:密码。填写「-」可清空代理。</div></div>
      </div>`,async d=>{
        const clear=d.proxyString==='-'||String(d.proxyString||'').toLowerCase()==='none';
        const r=await this.api('/accounts/batch-set-proxy-string',{method:'POST',body:JSON.stringify({accountIds:ids,proxyString:d.proxyString,clear})});
        this.toast(r.cleared?`已清空 ${r.updated} 个账号代理`:`已绑定 ${r.host}:${r.port} 到 ${r.updated} 个账号`);
        this.closeModal();await this.loadRefs();this.refresh();
      })
    },
    async deleteBrowsersFromSettings(){if(!(await this.ask('将清理本机环境列表中的环境。已绑定账号的会先解绑再删除（账号保留）。继续？')))return;this.toast('正在读取环境列表…');try{const d=await this.api('/browser/profiles?pageSize=500');const ids=(d.items||[]).map(x=>String(x.id)).filter(Boolean);if(!ids.length){this.toast('没有可删除的环境');return}const r=await this.api('/browser/profiles/batch-delete',{method:'POST',body:JSON.stringify({profileIds:ids})});this.toast(`已删除 ${r.deleted}，跳过 ${r.blocked||0}，失败 ${r.failed||0}${r.unbound?`，解绑 ${r.unbound}`:''}`,Boolean(r.blocked||r.failed))}catch(e){this.toast(e.message,true)}},
    async assignProxyModal(){
      const ids=this.selectedAccountIds();
      if(!ids.length&&!this.accountGroupId){this.toast('请勾选账号，或先选中左侧分组',true);return}
      const pgs=this.ownedGroups('proxy');
      const selectedRows=(this.accounts||[]).filter(a=>ids.includes(Number(a.id)));
      const ownerIds=[...new Set(selectedRows.map(a=>Number(a.owner_id||0)).filter(Boolean))];
      const assignTargets=await this.loadOwnerAssignTargets().catch(()=>[]);
      this._accountAssignTargets=assignTargets||[];
      const proxyOwnerFilter=this.proxyCatalogOwnerFilter({ownerIds,targets:assignTargets});
      await this.ensureProxyCatalogForAccounts({force:true,ownerIds,targets:assignTargets});
      const proxies=this.proxySelectItems();
      const scopeNote=this.proxyCatalogScopeHint(proxyOwnerFilter,proxies.length);
      this.modal('分配代理',`<div class="form-grid">${ids.length?`<div class="field full"><div class="muted">将按顺序分配给已勾选的 ${ids.length} 个账号。${scopeNote}</div></div>`:`<div class="field full"><div class="muted">未勾选账号，将分配给当前分组内的启用账号。${scopeNote}</div></div>`}${this.select('proxyGroupId','从代理分组轮询（可空）',pgs)}${this.select('proxyId','或全部绑定同一代理',proxies)}<div class="field full"><div class="muted">两个都留空时，使用该用户下非失效代理轮询。</div></div></div>`,async d=>{
        const body={};
        if(ids.length)body.accountIds=ids;else body.groupId=Number(this.accountGroupId);
        if(d.proxyGroupId)body.proxyGroupId=Number(d.proxyGroupId);
        if(d.proxyId)body.proxyId=Number(d.proxyId);
        const r=await this.api('/accounts/batch-assign-proxy',{method:'POST',body:JSON.stringify(body)});
        this.toast(r.assigned?`已分配 ${r.assigned} 个账号`:`没有账号被分配`,!r.assigned);
        this.closeModal();
        this.invalidateProxyCatalog();
        await this.loadRefs({force:true});
        this.refresh();
      });
    },
    async loginAccount(id){
      if(!(await this.ensureBitOnline('登录')))return;
      const task=typeof UI!=='undefined'&&typeof UI.notifyLoading==='function'
        ?UI.notifyLoading({title:'一键登录',message:'正在打开浏览器环境并一键登录…'})
        :null;
      if(!task)this.toast('正在打开浏览器环境并一键登录…',false,8000);
      try{
        // 服务端单次登录上限约 180s（开环境+填表+2FA），前端默认 25s 会误杀
        const r=await this.api(`/browser/accounts/${id}/login-assist`,{
          method:'POST',
          body:JSON.stringify({autoSubmit:true,submitAfterTotp:true}),
          timeoutMs:200000,
        });
        const okLogin=!!(r?.loginOk||r?.alreadyLoggedIn||r?.loginStatus==='online');
        let msg=r?.message||(okLogin?'登录成功':'登录未完成');
        msg+=okLogin?'；登录状态已更新为已登录':'；登录状态已更新为未登录';
        if(r?.captcha)msg+='。请在浏览器窗口完成滑块验证后，再点登录状态检测';
        if(r?.filled&&!r?.submitted&&!okLogin)msg+='。若浏览器窗口未弹出，请确认本地浏览器已启动且环境未损坏';
        if(task){if(okLogin)task.success(msg,4000);else task.error(msg,8000);}else this.toast(msg,!okLogin,okLogin?3000:8000);
        this.refresh();
      }catch(e){
        const raw=e.message||'登录失败';
        const timedOut=/接口超时/i.test(raw);
        const msg=timedOut
          ?`${raw}。一键登录可能仍在后台进行，请查看浏览器窗口或稍后点「检测登录」`
          :`${raw}；登录状态已更新为未登录`;
        if(task)task.error(msg,8000);else this.toast(msg,true,8000);
        this.refresh();
      }
    },
    async batchLoginAccounts(){
      const ids=this.selectedAccountIds();
      if(!ids.length&&!this.accountGroupId){this.toast('请勾选账号，或先选中左侧分组',true);return}
      if(!(await this.ensureBitOnline('批量登录')))return;
      if(!(await this.ask('将依次对最多 5 个账号执行一键登录（自动填表、点登录、填 2FA）。是否继续？')))return;
      this.toast('正在一键登录，请稍候…',false,5000);
      try{
        const body=ids.length?{accountIds:ids.slice(0,5)}:{groupId:Number(this.accountGroupId)};
        // 最多 5 个账号串行，单号约 180s，给足前端等待时间
        const r=await this.api('/browser/accounts/batch-login',{method:'POST',body:JSON.stringify(body),timeoutMs:960000});
        const fails=(r.items||[]).filter(x=>!x.ok);
        const first=fails[0];
        let detail=`成功 ${r.prepared}，失败 ${r.failed}`;
        if(first)detail+=`；${first.username||('#'+first.accountId)}：${first.reason||first.message||'未知原因'}`;
        if(fails.some(x=>/未绑定/.test(x.reason||'')))detail+='。请先「创建环境」再登录';
        if(fails.some(x=>/密码|凭据|2FA/.test(x.reason||'')))detail+='。请在「密码/2FA」补全凭据';
        if(fails.some(x=>/Maximum|限制登录|attempts/i.test(x.reason||'')))detail+='。请换代理或等待后再试，勿连点';
        if(fails.some(x=>/安全验证|滑块|captcha/i.test(x.reason||'')))detail+='。请在浏览器窗口人工过验证后点「检测登录」';
        if(fails.some(x=>/权限不足|无权|拒绝操作/.test(x.reason||'')))detail+='。这是浏览器窗口权限问题：请用有权限的账号登录本地浏览器，或解绑后重建环境';
        this.toast(detail,r.failed>0,r.failed>0?6000:3000);
        this.refresh();
      }catch(e){this.toast(e.message,true,6000)}
    },
    batchMoveAccounts(){const ids=this.selectedAccountIds();if(!ids.length){this.toast('请先勾选账号',true);return}const gs=this.accountGroupFlatOptions();this.modal('转移分组',`<div class="form-grid">${this.select('groupId','目标分组（建议选公司子组）',gs)}<div class="field full"><div class="muted">已选 ${ids.length} 个账号。目标留空表示移出分组。</div></div></div>`,async d=>{await this.api('/accounts/batch-move-group',{method:'POST',body:JSON.stringify({accountIds:ids,groupId:d.groupId?Number(d.groupId):null})});this.toast('分组已更新');this.closeModal();await this.loadRefs();this.refresh()})},
    canAssignAccounts(){
      if(this.isEnterpriseCustomerRole()||this.isOperatorRole())return false;
      if(this.authUser?.isSuper||this.isOpsAdminRole())return true;
      if(this.getActingAsId())return false;
      return (this.authChildren||[]).length>0;
    },
    /** 分组分配用户：仅登录超管 / 运营管理 + group.assign 权限节点 */
    canAssignAccountGroups(){
      if(!(this.authIsSuper||this.isLoginOpsAdminRole()))return false;
      if(this.getActingAsId())return false;
      return this.canPermission('group.assign');
    },
    async assignAccountGroupOwner(groupId){
      if(!this.canAssignAccountGroups()){this.toast('当前角色无权分配分组用户',true);return}
      const gid=Number(groupId||0);
      if(!gid){this.toast('无效分组',true);return}
      const g=(this.accountOwnedGroups()||[]).find((x)=>Number(x.id)===gid);
      const groupName=g?.name||('#'+gid);
      const isParent=!g?.parent_id;
      const targets=await this.loadGroupAssignTargets();
      if(!targets.length){this.toast(this.authIsSuper?'没有可分配的用户':'没有可分配的运营专员或企业客户',true);return}
      const companyOptions=await this.loadAccountCompanyOptions();
      const scopeHint=isParent
        ?'将把该分组、其下全部子组，以及这些分组内的账号一并分配给所选管理用户。'
        :'将把该子组及其组内账号一并分配给所选管理用户。';
      this.modal('分配分组用户',`<div class="form-grid"><div class="field full"><div class="muted">分组：${this.esc(groupName)}。${scopeHint}</div></div>${this.ownerAssignFieldsHtml(targets,'',{blankLabel:'请选择管理用户'})}${this.companyAssignFieldHtml(companyOptions,'',{blankLabel:'请选择企业'})}</div>`,async d=>{
        const payload=this.collectOwnerAssignPayload(d,targets);
        if(!payload.ownerId)throw new Error('请选择管理用户');
        const r=await this.api(`/groups/${gid}/assign-owner`,{method:'POST',body:JSON.stringify(payload)});
        const name=r?.ownerName||'';
        const acc=Number(r?.accountsUpdated||0);
        this.toast(name?`已分配分组给 ${name}（账号 ${acc} 个）`:`已分配分组（账号 ${acc} 个）`);
        this.closeModal();
        if(String(this.accountGroupId||'')===String(gid)||(Array.isArray(r?.groupIds)&&r.groupIds.map(Number).includes(Number(this.accountGroupId||0)))){
          this.accountGroupId='';
        }
        // 分组归属已变：清侧栏分组缓存，按当前筛选用户重新拉最新列表
        this.invalidateAccountGroupsCache();
        await this.loadRefs({force:true});
        await this.refresh();
      });
      this.bindOwnerAssignHandlers(targets,companyOptions);
    },
    async batchAssignAccounts(presetIds){
      if(!this.canAssignAccounts()){this.toast('当前账号无权分配',true);return}
      const ids=Array.isArray(presetIds)&&presetIds.length?presetIds.map(Number):this.selectedAccountIds();
      if(!ids.length){this.toast('请先勾选要分配的账号',true);return}
      const targets=await this.loadOwnerAssignTargets();
      if(!targets.length){this.toast('没有可分配的运营专员或企业客户',true);return}
      const companyOptions=await this.loadAccountCompanyOptions();
      this.modal('分配账号关联人员',`<div class="form-grid"><div class="field full"><div class="muted">已选 ${ids.length} 个账号。仅可分配给运营专员或企业客户；企业客户需同时选择企业。</div></div>${this.ownerAssignFieldsHtml(targets,'',{blankLabel:'请选择关联人员',allowClear:false})}${this.companyAssignFieldHtml(companyOptions,'',{blankLabel:'请选择企业'})}</div>`,async d=>{
        const payload=this.collectOwnerAssignPayload(d,targets);
        if(!payload.ownerId||payload.ownerId==='__clear__')throw new Error('请选择关联人员');
        const r=await this.api('/accounts/batch-assign-owner',{method:'POST',body:JSON.stringify({accountIds:ids,...payload})});
        this.toast(r?.ownerName?`已分配 ${r.updated} 个账号给 ${r.ownerName}`:`已分配 ${r.updated||ids.length} 个账号`);
        this.closeModal();
        await this.loadRefs();
        this.refresh();
      });
      this.bindOwnerAssignHandlers(targets,companyOptions);
    },
    async clearAccountOwner(id,username=''){
      if(!this.canAssignAccounts()){this.toast('当前账号无权清除关联人员',true);return}
      const aid=Number(id||0);
      if(!aid)return;
      const label=username?`@${username}`:`#${aid}`;
      if(!(await this.ask(`清除账号 ${label} 的关联人员？同时会清空关联企业。`)))return;
      try{
        const r=await this.api('/accounts/batch-assign-owner',{method:'POST',body:JSON.stringify({accountIds:[aid],clear:true})});
        this.toast(r?.updated?`已清除 ${label} 的关联人员`:'该账号本就没有关联人员');
        this.refresh();
      }catch(e){this.toast(e.message||'清除失败',true)}
    },
    async batchClearAccountOwners(){
      if(!this.canAssignAccounts()){this.toast('当前账号无权清除关联人员',true);return}
      const ids=this.selectedAccountIds();
      if(!ids.length){this.toast('请先勾选要清除关联人员的账号',true);return}
      if(!(await this.ask(`清除已选 ${ids.length} 个账号的关联人员？同时会清空关联企业。`)))return;
      try{
        const r=await this.api('/accounts/batch-assign-owner',{method:'POST',body:JSON.stringify({accountIds:ids,clear:true})});
        this.toast(`已清除 ${r.updated||ids.length} 个账号的关联人员`);
        this.refresh();
      }catch(e){this.toast(e.message||'清除失败',true)}
    },
    async extractFingerprints(){if(!(await this.ensureBitOnline('提取指纹')))return;const ids=this.selectedAccountIds();if(!ids.length&&!this.accountGroupId){this.toast('请勾选账号，或先选中左侧分组',true);return}try{const body=ids.length?{accountIds:ids}:{groupId:Number(this.accountGroupId)};const r=await this.api('/browser/accounts/batch-fingerprint',{method:'POST',body:JSON.stringify(body)});const text=(r.items||[]).map(x=>x.username+'\t'+(x.fingerprint||'未采集')).join('\n');await navigator.clipboard.writeText(text);this.toast(`已复制 ${r.items.length} 条，有指纹 ${r.withFingerprint}${r.harvested?`，新采集 ${r.harvested}`:''}`)}catch(e){this.toast(e.message,true)}},
    async deleteBannedAccounts(){if(!this.canPermission('account.delete')){this.toast('当前角色无权删除账号',true);return}const scope=this.accountGroupId?'当前分组':'全部账号';if(!(await this.ask('删除'+scope+'中状态为封号的账号？此操作不可恢复。')))return;try{const r=await this.api('/accounts/batch-delete-banned',{method:'POST',body:JSON.stringify(this.accountGroupId?{groupId:Number(this.accountGroupId)}:{})});this.toast(r.deleted?`已删除 ${r.deleted} 个封号账号`:'没有可删除的封号账号',!r.deleted);this.refresh()}catch(e){this.toast(e.message,true)}},
    async showMonitorResult(){try{const cfg=await this.api('/accounts/monitor');if(!cfg.lastRunAt){this.toast('还没有监控记录',true);return}const r=cfg.lastResult||{};const errors=(r.errors||[]).length?(r.errors||[]).map(e=>`<div>#${this.esc(e.id)} ${this.esc(e.reason||'')}</div>`).join(''):'<div class="muted">无失败明细</div>';this.modal('上次监控结果',`<div class="data-summary"><div><small>时间</small><b>${this.esc(cfg.lastRunAt)}</b></div><div><small>扫描</small><b>${r.total||0}</b></div><div><small>资料</small><b>${r.profile||0}</b></div><div><small>视频</small><b>${r.videos||0}</b></div><div><small>失败</small><b>${r.failed||0}</b></div></div><h3>失败明细</h3>${errors}<div class="muted" style="margin-top:8px">${r.total?'以上为最近一次真实同步结果。':'上次没有可同步账号（需已绑定浏览器环境）。'}</div>`,()=>this.closeModal())}catch(e){this.toast(e.message,true)}},
  };
  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages["accounts"] = true;
})();
