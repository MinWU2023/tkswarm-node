(function () {
  if (!window.app) throw new Error('app-core must load before pages/accounts.js');
  const __methods = {
    async renderAccounts(opts={}){
      const still=typeof opts.still==='function'?opts.still:()=>this.view==='accounts';
      document.querySelector('#content')?.classList.remove('chat-mode');
      if((this.accountPane||'list')==='io'){await this.renderAccountIo(opts);return}
      const [accStats,d]=await Promise.all([this.api('/accounts/stats'),this.api(`/accounts?page=${this.accountPage||1}&pageSize=20&keyword=${encodeURIComponent(this.accountKeyword||'')}&status=${encodeURIComponent(this.accountStatus||'')}${this.accountGroupId?`&groupId=${this.accountGroupId}`:''}${this.accountCapcut?`&capcut=${this.accountCapcut}`:''}${this.accountSession?`&session=${this.accountSession}`:''}`)]);
      if(!still())return;
      const gs=(this.groups||[]).filter(g=>g.type==='account');
      const pane=this.accountPane||'list';
      const hideStats=this.accountStatsHidden;
      const offline=Math.max(0,(accStats.total||0)-(accStats.online||0));
      document.querySelector('#content').innerHTML=`<div class="workspace accounts-workspace">
        <aside class="side-groups account-sidebar">
          <div class="sidebar-header"><h3>账号分组 <span class="count-pill">${gs.length}</span></h3>${this.canPermission('group.manage')?`<button class="primary tiny" onclick="app.groupModal('account')">添加</button>`:''}</div>
          <div class="group-list">
            ${this.accountGroupSidebarHtml(accStats)}
          </div>
        </aside>
        <div class="account-main-wrapper">
          <div class="subtabs"><button class="${pane==='list'?'active':''}" onclick="app.switchAccountPane('list')">账号列表</button><button class="${pane==='browser'?'active':''}" onclick="app.switchAccountPane('browser')">浏览器环境</button></div>
          <div id="account-main"></div>
        </div>
      </div>`;
      if(pane==='browser'){await this.mountBrowser();return}
      document.querySelector('#account-main').innerHTML=`<div class="account-main-panel">
        <div id="account-batch-panel" class="batch-panel hidden">
          <div class="batch-info">已选择 <strong id="account-selected-count">0</strong> 个账号</div>
        </div>
        <div class="account-toolbar">
          <div class="action-buttons">
            <button class="ghost" onclick="app.openAccountIo()">导入导出</button>${this.canPermission('account.create')?`<button class="ghost" onclick="app.accountModal()">添加账号</button>`:''}
            <div class="dropdown"><button class="ghost" type="button" onclick="app.toggleAccountBatchMenu(event)">批量操作 <span class="btn-arrow-down">▾</span></button>
              <div id="account-batch-menu" class="dropdown-menu align-left hidden">
                <button type="button" onclick="app.batchSyncMessages(true)">开启同步标记</button>
                <button type="button" onclick="app.batchSyncMessages(false)">取消同步标记</button>
                <button type="button" onclick="app.batchModifyProfiles()">批量修改</button>
                <button type="button" onclick="app.batchDeleteVideos()">批量删视频</button>
                <button type="button" onclick="app.batchLoginAccounts()">批量登录</button>
                <button type="button" onclick="app.runAccountMonitor()">同步账号资料</button>
                <button type="button" onclick="app.extractFingerprints()">提取指纹</button>
                ${this.canPermission('account.delete')?`<button type="button" onclick="app.deleteBannedAccounts()">删除封号</button>`:''}
                <button type="button" onclick="app.monitorModal()">监控设置</button>
                ${this.canPermission('account.delete')?`<button type="button" class="is-danger" onclick="app.batchDeleteAccounts()">批量删除账号</button>`:''}
              </div>
            </div>
          </div>
          <div class="search-bar">
            <input id="search" class="input" placeholder="搜索账号 / 昵称" value="${this.esc(this.accountKeyword||'')}" onkeydown="if(event.key==='Enter')app.searchAccounts()">
            <select id="account-status"><option value="">登录状态</option>${this.loginStatusPairs().map(([v,n])=>`<option value="${v}" ${this.accountStatus===v?'selected':''}>${this.esc(n)}</option>`).join('')}</select>
            <select id="account-capcut" onchange="app.accountCapcut=this.value;app.accountPage=1;app.refresh()"><option value="">CapCut标记全部</option><option value="1" ${this.accountCapcut==='1'?'selected':''}>本地已标</option><option value="0" ${this.accountCapcut==='0'?'selected':''}>未标记</option></select>
            <select id="account-session" onchange="app.accountSession=this.value;app.accountPage=1;app.refresh()"><option value="">会话全部</option><option value="1" ${this.accountSession==='1'?'selected':''}>有CK</option></select>
            <button class="primary" onclick="app.searchAccounts()">查询</button>
            <button class="ghost" type="button" onclick="app.resetAccountFilters()">重置</button>
          </div>
        </div>
        <div class="stats-panel ${hideStats?'hidden':''}" id="account-stats-panel">
          <div class="stats-panel-head"><h3>账号统计</h3><div class="stats-panel-acts"><button class="tiny" type="button" title="刷新统计" onclick="app.refresh()">刷新</button><button class="tiny" type="button" onclick="app.toggleAccountStats()">${hideStats?'显示统计':'隐藏统计'}</button></div></div>
          <div class="stats-container">
            ${this.statChip('info','账号总数',accStats.total||0,'users')}
            ${this.statChip('ok','已登录',accStats.online||0,'check')}
            ${this.statChip('','未登录',offline,'logout')}
            ${this.statChip('warn','封号数',accStats.banned||0,'ban', Number(accStats.banned)>0 ? 'app.deleteBannedAccounts()' : '')}
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
      this.bindAccountChecks();
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
    
    filterAccountGroup(id){this.accountGroupId=id?String(id):'';this.accountPage=1;this.accountPane='list';this.refresh()},
    toggleAccountGroupFold(id, ev){
      if(ev){ev.stopPropagation();ev.preventDefault()}
      this.accountGroupFold=this.accountGroupFold||{};
      const k=String(id);
      this.accountGroupFold[k]=!this.accountGroupFold[k];
      this.refresh();
    },
    accountGroupSidebarHtml(accStats){
      const all=(this.groups||[]).filter(g=>g.type==='account');
      const roots=all.filter(g=>!g.parent_id);
      const kids=all.filter(g=>g.parent_id);
      const fold=this.accountGroupFold||{};
      const canManage=this.canPermission('group.manage');
      const item=(g, isChild)=>{
        const active=String(this.accountGroupId)===String(g.id);
        const children=kids.filter(k=>Number(k.parent_id)===Number(g.id));
        const hasKids=!isChild && children.length>0;
        const folded=!!fold[String(g.id)];
        const foldBtn=hasKids?`<span class="group-fold" title="${folded?'展开':'收起'}" onclick="app.toggleAccountGroupFold(${g.id},event)">${folded?'▸':'▾'}</span>`:'';
        const addChild=(!isChild && canManage)?`<span class="group-act" title="添加公司子组" onclick="event.stopPropagation();app.groupModal('account',{parent_id:${g.id}})">+</span>`:'';
        return `<button type="button" class="group-item-modern ${isChild?'is-child':''} ${active?'active':''}" onclick="app.filterAccountGroup(${g.id})">
          <div class="row"><b>${foldBtn}${this.esc(g.name)}</b><span class="group-side-acts"><span class="pool">${isChild?'公司':'账号池'}</span>${canManage?`<span class="group-act" title="编辑" onclick="event.stopPropagation();app.editGroup(${g.id})">改</span>`:''}${canManage?`<span class="group-act danger" title="删除" onclick="event.stopPropagation();app.remove('/groups/${g.id}','账号分组')">删</span>`:''}${addChild}</span></div>
          <div class="row meta"><span>${this.esc((g.created_at||'').slice(0,10)||'')}</span><span>${g.member_count||0}</span></div>
        </button>${hasKids && !folded ? children.map(c=>item(c,true)).join('') : ''}`;
      };
      const rootHtml=roots.map(r=>item(r,false)).join('');
      const orphan=kids.filter(k=>!roots.some(r=>Number(r.id)===Number(k.parent_id)));
      return `<button type="button" class="group-item-modern ${this.accountGroupId?'':'active'}" onclick="app.filterAccountGroup('')"><div class="row"><b>全部账号</b><span class="pool">账号池</span></div><div class="row meta"><span>全部</span><span>${accStats.total||0}</span></div></button>
            ${rootHtml}${orphan.map(c=>item(c,true)).join('')}`;
    },
    switchAccountPane(pane){this.accountPane=pane==='browser'?'browser':'list';this.refresh()},
    async mountBrowser(){const host=document.querySelector('#account-main');const status=await this.api('/browser/status');if(!status.online){host.innerHTML=`<div class="account-main-panel"><div class="empty"><h2>比特浏览器未连接</h2><p>${this.esc(status.message)}</p><p>请启动比特浏览器，并确认本地 API 地址为 ${this.esc(status.apiUrl)}</p><button class="primary" onclick="app.refresh()">重新检测</button></div></div>`;return}const d=await this.api('/browser/profiles?pageSize=500');const pack=UI.paginateLocal(d.items||[],this.browserPage||1,20);this.browserPage=pack.page;host.innerHTML=`<div class="account-main-panel"><div class="toolbar"><span class="muted">创建环境时会自动使用账号绑定的代理。</span><div>${this.canPermission('account.create')?`<button class="primary" onclick="app.batchCreateBrowserModal()">批量创建环境</button>`:''}<div class="dropdown" style="display:inline-block"><button class="ghost" type="button" onclick="app.toggleBrowserBatchMenu(event)">批量操作 <span class="btn-arrow-down">▾</span></button><div id="browser-batch-menu" class="dropdown-menu align-left hidden">${this.canPermission('account.create')?`<button type="button" class="is-danger" onclick="app.batchDeleteBrowser()">批量删除环境</button>`:''}<button type="button" onclick="app.refresh()">同步环境</button></div></div></div></div><div class="table-container">${this.browserTable(pack.items)}</div>${UI.pager(pack,'browserPage')}</div>`},
    accountsTable(rows){
      if(!rows.length)return '<div class="empty">还没有账号</div>';
      const canWrite=this.canPermission('account.create');
      const canDelete=this.canPermission('account.delete');
      return `<table><thead><tr>
      <th><input type="checkbox" onchange="app.toggleAllAccounts(this.checked)" title="全选"></th>
      <th>账号</th><th>分组</th><th>代理IP</th><th>登录</th><th>2FA</th><th>指纹</th><th>CK</th><th>CapCut标</th><th>客服</th><th>昵称</th><th>备注</th><th>操作</th>
    </tr></thead><tbody>${rows.map(x=>{
        const more=[];
        if(x.browser_profile_id){
          more.push(`<button type="button" onclick="app.browserAction('${this.esc(x.browser_profile_id)}','open')">打开环境</button>`);
          more.push(`<button type="button" onclick="app.loginAccount(${x.id})">登录</button>`);
          more.push(`<button type="button" onclick="app.createAccountBrowser(${x.id})">再绑环境</button>`);
        }else{
          more.push(`<button type="button" onclick="app.createAccountBrowser(${x.id})">创建环境</button>`);
        }
        if(x.login_status==='online'&&!x.capcut_authorized)more.push(`<button type="button" onclick="app.authorizeCapCut(${x.id})">本地标记CapCut</button>`);
        if(x.capcut_authorized)more.push(`<button type="button" onclick="app.revokeCapCut(${x.id})">取消本地CapCut</button>`);
        more.push(`<button type="button" onclick="app.pullTikTokStats(${x.id})">拉取数据</button>`);
        more.push(`<button type="button" onclick="app.modifyAccountProfile(${x.id},'${this.esc(x.username)}')">修改资料</button>`);
        more.push(`<button type="button" onclick="app.viewTikTokData(${x.id})">查看数据</button>`);
        const editBtn=`<button class="tiny" type="button" title="编辑" onclick='app.accountModal(${JSON.stringify(x)})' ${canWrite?'':'disabled'}>编辑</button>`;
        const delBtn=`<button class="tiny danger" type="button" title="删除" onclick="app.remove('/accounts/${x.id}','账号')" ${canDelete?'':'disabled title="无删除权限"'}>删除</button>`;
        const moreBtn=`<div class="ops-dropdown account-ops-dropdown"><button class="tiny" type="button" title="更多" onclick="app.toggleAccountOps(${x.id},event)">…</button><div id="account-ops-${x.id}" class="dropdown-menu ops-menu hidden">${more.join('')}</div></div>`;
        const regionLabel=[x.country,x.proxy_region,x.proxy_city].map(v=>String(v||'').trim()).filter(Boolean);
        const countryText=regionLabel.length?regionLabel.join(' · '):'';
        const proxyText=x.proxy_address||'';
        return `<tr>
      <td><input class="account-check" type="checkbox" value="${x.id}"></td>
      <td><b>${this.esc(x.username)}</b><div class="muted">#${x.id}${x.account_status==='banned'?' · 封号':''}</div></td>
      <td>${this.esc(x.group_name||'-')}</td>
      <td title="${this.esc(proxyText)}">${this.esc(proxyText?proxyText.slice(0,28):'-')}${countryText?`<div class="muted">${this.esc(countryText)}</div>`:''}</td>
      <td class="login-status-cell" title="点击检测登录状态" style="cursor:pointer" onclick="event.stopPropagation();app.checkAccountLogin(${x.id})">${this.badge(x.login_status)}</td>
      <td>${x.has_totp?'<span class="badge success">已绑定</span>':'<span class="badge">未绑定</span>'}</td>
      <td>${x.has_fingerprint?'<span class="badge success">已有</span>':'<span class="badge">无</span>'}</td>
      <td>${x.has_session||x.session_saved?'<span class="badge success">CK</span>':'<span class="badge">无</span>'}</td>
      <td>${x.capcut_authorized?'<span class="badge online" title="仅本地标记">本地已标</span>':'<span class="badge">未标记</span>'}</td>
      <td>${this.badge(x.chat_status)}</td>
      <td class="nickname-cell" title="点击编辑昵称（仅本系统）" style="cursor:pointer;color:#409eff" onclick="event.stopPropagation();app.editAccountNickname(${x.id},${JSON.stringify(x.username||'')},${JSON.stringify(x.nickname||'')})">${this.esc(x.nickname||'-')}</td>
      <td class="notes-cell" title="点击编辑备注" style="cursor:pointer;color:#409eff" onclick="event.stopPropagation();app.editAccountNotes(${x.id},${JSON.stringify(x.username||'')},${JSON.stringify(x.notes||'')})">${this.esc((x.notes||'-').slice(0,16))}</td>
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
    async batchDeleteAccounts(){const ids=[...document.querySelectorAll('.account-check:checked')].map(x=>Number(x.value));if(!ids.length){this.toast('请先选择要删除的账号',true);return}if(!(await this.ask(`确定删除选中的 ${ids.length} 个账号吗？账号密码和 2FA 密钥也会被删除；对应的比特浏览器环境不会自动删除。`)))return;try{const r=await this.api('/accounts/batch-delete',{method:'POST',body:JSON.stringify({accountIds:ids})});this.toast(`已删除 ${r.deleted} 个账号`);await this.loadRefs();this.refresh()}catch(e){this.toast(e.message,true)}},
    resetAccountFilters(){this.accountKeyword='';this.accountStatus='';this.accountCapcut='';this.accountSession='';this.accountPage=1;this.refresh()},
    async searchAccounts(){this.accountKeyword=document.querySelector('#search')?.value||'';this.accountStatus=document.querySelector('#account-status')?.value||'';this.accountPage=1;this.refresh()},
    async loadOwnerAssignTargets(){
      const targets=[];
      const self=this.authUser;
      if(self?.id)targets.push({id:Number(self.id),label:(self.nickname||self.username)+'（本人） · @'+self.username});
      if(this.authIsSuper){
        try{
          const pack=await this.api('/admin-users?pageSize=200');
          const selfId=Number(self?.id||0);
          for(const u of (pack.items||[])){
            if(Number(u.id)===selfId)continue;
            if(Number(u.status)===0)continue;
            targets.push({id:Number(u.id),label:(u.nickname||u.username)+' · @'+u.username});
          }
        }catch{}
      }else{
        for(const c of (this.authChildren||[])){
          targets.push({id:Number(c.id),label:(c.nickname||c.username)+' · @'+c.username});
        }
      }
      return targets;
    },
    async accountModal(x={}){
      const gs=this.accountGroupFlatOptions();
      const isEdit=!!x.id;
      // 创建：当前有效用户的代理；编辑：被编辑账号归属用户的代理
      const proxyOwnerId=isEdit
        ?Number(x.owner_id||this.effectiveOwnerId()||0)
        :this.effectiveOwnerId();
      await this.ensureProxyCatalog({force:true,ownerId:proxyOwnerId});
      const proxyItems=this.proxySelectItems();
      let ownerField='';
      if(this.canAssignAccounts()){
        const targets=await this.loadOwnerAssignTargets();
        if(targets.length){
          const current=String(isEdit?(x.owner_id||this.authUser?.id||targets[0].id||''):(this.effectiveOwnerId()||targets[0].id||''));
          ownerField=this.selectRaw('ownerId','关联后台用户',targets.map(t=>[String(t.id),t.label]),current);
        }
      }
      const secretHint=x.id
        ?`<div class="field full"><div class="muted">密码 / 2FA / CK 留空表示不修改；已保存内容不会回显。当前 2FA：${x.has_totp?'已绑定':'未绑定'}；CK：${(x.has_session||x.session_saved)?'已有':'无'}。</div></div>`
        :`<div class="field full"><div class="muted">密码、2FA、CK 均为可选；2FA 密钥需 Base32；CK 需含 sessionid，保存后 AES 加密。</div></div>`;
      const proxyScopeHint=isEdit
        ?'代理列表按「被编辑账号所属用户」加载'
        :'代理列表仅显示当前登录用户下的代理';
      const proxyHint=`<div class="field full"><div class="muted">${proxyScopeHint}（可选 ${proxyItems.length} 条）。未选择表示不绑定。</div></div>`;
      this.modal(x.id?'编辑账号':'添加账号',`<div class="form-grid"><input type="hidden" name="id" value="${x.id||''}">${this.field('username','账号名称',x.username,'text',true)}${this.field('nickname','昵称',x.nickname)}${this.select('groupId','账号分组',gs,x.group_id)}${this.select('proxyId','代理',proxyItems,x.proxy_id)}${proxyHint}${ownerField}${this.selectRaw('browserType','浏览器类型',this.browserTypePairs(),x.browser_type||'bit')}${this.field('browserProfileId','环境 ID',x.browser_profile_id)}${this.selectRaw('loginStatus','登录状态',this.loginStatusPairs(),x.login_status||'offline')}${this.selectRaw('dmChannel','私信通道',[['auto','自动（有指纹走 API）'],['api','仅 API'],['browser','仅浏览器']],x.dm_channel||'auto')}${this.field('notes','备注',x.notes,'textarea')}${secretHint}${this.field('password',x.id?'新密码（留空不改）':'密码','','password')}${this.field('totpSecret',x.id?'新 2FA 密钥（留空不改）':'2FA 密钥','','password')}${this.field('cookie',x.id?'Cookie / CK（留空不改）':'Cookie / CK','','textarea')}${this.field('fingerprint','指纹备注（可选）')}</div>`,async data=>{
        const id=data.id;delete data.id;
        const password=String(data.password||'').trim();
        const totpSecret=String(data.totpSecret||'').trim();
        const cookie=String(data.cookie||'').trim();
        const fingerprint=String(data.fingerprint||'').trim();
        delete data.password;delete data.totpSecret;delete data.cookie;delete data.fingerprint;
        data.groupId=data.groupId?Number(data.groupId):null;
        data.proxyId=data.proxyId?Number(data.proxyId):null;
        data.chatStatus=x.chat_status||'offline';
        data.enabled=true;
        if(data.ownerId)data.ownerId=Number(data.ownerId);
        else delete data.ownerId;
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
      // 编辑时：切换「关联后台用户」后，代理下拉改为该用户的代理库
      if(isEdit){
        const ownerSel=document.querySelector('#modal-form select[name="ownerId"]');
        const proxySel=document.querySelector('#modal-form select[name="proxyId"]');
        if(ownerSel&&proxySel){
          ownerSel.addEventListener('change',()=>{
            const oid=Number(ownerSel.value||proxyOwnerId||this.effectiveOwnerId());
            this.refillProxySelect(proxySel,oid,true).catch(()=>{});
          });
        }
      }
    },
    editAccountNickname(id,username,nickname=''){if(!this.canPermission('account.create')){this.toast('当前角色无权修改昵称',true);return}this.modal('编辑昵称',`<div class="form-grid"><div class="field full"><div class="muted">账号：${this.esc(username||('#'+id))}。仅更新本系统展示昵称，不会改 TikTok。</div></div>${this.field('nickname','昵称',nickname||'')}</div>`,async d=>{await this.api(`/accounts/${id}/nickname`,{method:'PATCH',body:JSON.stringify({nickname:d.nickname||''})});this.toast('昵称已更新');this.closeModal();this.refresh()})},
    editAccountNotes(id,username,notes=''){if(!this.canPermission('account.create')){this.toast('当前角色无权修改备注',true);return}this.modal('编辑备注',`<div class="form-grid"><div class="field full"><div class="muted">账号：${this.esc(username||('#'+id))}</div></div>${this.field('notes','备注',notes||'','textarea')}<div class="field full"><div class="muted">备注仅保存在本系统，不会写入 TikTok。</div></div></div>`,async d=>{await this.api(`/accounts/${id}/notes`,{method:'PATCH',body:JSON.stringify({notes:d.notes||''})});this.toast('备注已更新');this.closeModal();this.refresh()})},
    openAccountIo(tab){
      if(!this.canPermission('account.create')&&tab==='import'){this.toast('当前角色无权导入账号',true);return}
      this.view='accounts';
      this.accountPane='io';
      this.accountIoTab=tab==='import'?'import':'export';
      if(!Array.isArray(this.accountIoFields)||!this.accountIoFields.length)this.accountIoFields=this.defaultAccountIoFields();
      this.refresh();
    },
    closeAccountIo(){this.accountPane='list';this.refresh()},
    switchAccountIoTab(tab){this.accountIoTab=tab==='import'?'import':'export';this.refresh()},
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
      // 导入属创建：仅当前用户代理
      await this.ensureProxyCatalog({force:true,ownerId:this.effectiveOwnerId()});
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
          <button type="button" class="${tab==='export'?'active':''}" onclick="app.switchAccountIoTab('export')">导出数据</button>
          <button type="button" class="${tab==='import'?'active':''}" onclick="app.switchAccountIoTab('import')">导入数据</button>
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
          <div class="field"><label>国家</label><input id="aio-country" class="input" placeholder="可空" value="${this.esc(f.country||'')}"></div>
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
      const pgs=this.groups.filter(g=>g.type==='proxy');
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
          <div class="field"><label>代理绑定方式</label><select id="aio-import-proxy-strategy" class="input"><option value="sequential">按代理顺序绑定（推荐）</option><option value="single">全部绑定同一代理</option><option value="none">不绑定代理</option></select></div>
          <div class="field"><label>顺序代理分组</label><select id="aio-import-proxy-group" class="input"><option value="">不指定</option>${pgs.map(g=>`<option value="${g.id}">${this.esc(g.name)}</option>`).join('')}</select></div>
          <div class="field"><label>统一绑定代理</label><select id="aio-import-proxy" class="input"><option value="">不指定</option>${proxyItems.map(p=>`<option value="${p.id}">${this.esc(p.name)}</option>`).join('')}</select></div>
          <div class="field"><label>浏览器类型</label><select id="aio-import-browser" class="input">${this.browserTypePairs().map(([v,n])=>`<option value="${this.esc(v)}" ${v==='bit'?'selected':''}>${this.esc(n)}</option>`).join('')}</select></div>
          <div class="field"><label>国家/地区</label><input id="aio-import-country" class="input" placeholder="可空"></div>
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
      if(!this.canPermission('account.create')){this.toast('当前角色无权导入账号',true);return}
      const content=document.querySelector('#aio-import-content')?.value||'';
      if(!String(content).trim()){this.toast('请先粘贴账号列表或选择文件',true);return}
      if(!(await this.ask('将按固定模板导入账号，是否继续？')))return;
      try{
        const r=await this.api('/accounts/batch-import',{method:'POST',body:JSON.stringify({
          content,
          format:document.querySelector('#aio-import-format')?.value||'auto',
          groupId:document.querySelector('#aio-import-group')?.value?Number(document.querySelector('#aio-import-group').value):null,
          proxyStrategy:document.querySelector('#aio-import-proxy-strategy')?.value||'sequential',
          proxyGroupId:document.querySelector('#aio-import-proxy-group')?.value?Number(document.querySelector('#aio-import-proxy-group').value):null,
          proxyId:document.querySelector('#aio-import-proxy')?.value?Number(document.querySelector('#aio-import-proxy').value):null,
          browserType:document.querySelector('#aio-import-browser')?.value||'bit',
          country:document.querySelector('#aio-import-country')?.value||'',
        })});
        const box=document.querySelector('#aio-import-result');
        let message=`成功 ${r.imported||0}，重复 ${r.duplicates||0}，错误 ${(r.errors||[]).length}`;
        if(r.errors?.length)message+=`；首个错误在第 ${r.errors[0].line} 行：${r.errors[0].reason}`;
        if(box)box.textContent=message;
        this.toast(r.imported?`已导入 ${r.imported} 个账号`:message,!r.imported);
        await this.loadRefs();
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
        const r=await this.api('/account-work-batches/enqueue',{method:'POST',body:JSON.stringify({
          accountId:Number(id),
          taskType:'pull_stats',
          payload:{source:'manual',accountId:Number(id)},
        })});
        const batchId=r?.batch_id||r?.batchId||r?.batch?.id||'';
        const itemId=r?.item_id||r?.itemId||r?.item?.id||'';
        this.toast(`已创建拉取分任务${itemId?` #${itemId}`:''}${batchId?`（总任务 #${batchId}）`:''}，打开执行器或账号任务即可拉取 Studio 数据`);
        this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    /** @deprecated 兼容旧调用名 → 拉取数据分任务 */
    async syncTikTokProfile(id){return this.pullTikTokStats(id);},
    async syncTikTokVideos(id){if(!(await this.ensureBitOnline('同步视频')))return;this.toast('正在读取 TikTok 视频列表，请稍候...');try{const r=await this.api(`/browser/accounts/${id}/sync-videos`,{method:'POST',body:JSON.stringify({limit:100})});this.toast(`视频同步完成：${r.count} 条`);this.refresh()}catch(e){this.toast(e.message,true)}},
    async viewTikTokData(id){
      try{
        const [profile,videos,statsRaw]=await Promise.all([
          this.api(`/accounts/${id}/tiktok-profile`),
          this.api(`/accounts/${id}/tiktok-videos`),
          this.api(`/accounts/${id}/tiktok-stats`),
        ]);
        const p=profile||{};
        const stats=Array.isArray(statsRaw)?{snapshots:statsRaw,daily28:[]}:(statsRaw||{});
        const snaps=stats.snapshots||[];
        const daily=stats.daily28||[];
        const vids=Array.isArray(videos)?videos:[];
        const fmt=(v)=>v==null||v===''?'—':v;
        const chip=(label,value)=>`<div class="tk-data-chip"><small>${label}</small><b title="${this.esc(String(fmt(value)))}">${this.esc(String(fmt(value)))}</b></div>`;
        const viewSwitch=(panel)=>`<div class="tk-data-view-switch" role="tablist">
            <button type="button" class="is-active" data-mode="list" onclick="app.tkDataSwitchView('${panel}','list')">列表</button>
            <button type="button" data-mode="chart" onclick="app.tkDataSwitchView('${panel}','chart')">折线图</button>
          </div>`;
        const dailyTable=daily.length
          ?`<div class="tk-data-table-wrap"><table class="tk-data-table"><thead><tr><th>日期</th><th>播放</th><th>主页浏览</th><th>点赞</th><th>评论</th><th>转发</th><th>预估收益</th></tr></thead><tbody>${daily.map(d=>`<tr><td>${this.esc(d.metric_date)}</td><td>${fmt(d.video_views??0)}</td><td>${fmt(d.profile_views??0)}</td><td>${fmt(d.likes_count??0)}</td><td>${fmt(d.comments_count??0)}</td><td>${fmt(d.shares_count??0)}</td><td>${fmt(d.est_rewards??0)}</td></tr>`).join('')}</tbody></table></div>`
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

        this.modal('TikTok 账号数据',`
          <div class="tk-data-view">
            <section class="tk-data-section">
              <div class="tk-data-section-head">
                <div>
                  <div class="tk-data-section-title">账号总览</div>
                  <div class="tk-data-meta">最后拉取：${this.esc(p.last_synced_at||'尚未拉取')}</div>
                </div>
                <div class="tk-data-actions">
                  <button class="primary" type="button" onclick="app.pullTikTokStats(${id}).then(()=>setTimeout(()=>app.viewTikTokData(${id}),800))">拉取数据</button>
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
              </div>
              <div class="tk-data-chips tk-data-chips-period">
                ${chip('播放 · 28天',p.period_video_views)}
                ${chip('主页浏览 · 28天',p.period_profile_views)}
                ${chip('点赞 · 28天',p.period_likes)}
                ${chip('评论 · 28天',p.period_comments??p.comments_count)}
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
      const ids=this.selectedAccountIds();
      if(!ids.length){this.toast('请先选择账号',true);return}
      await this.loadRefs();
      // 批量编辑：若勾选账号归属同一用户，用该用户代理；否则用当前用户代理
      const selectedRows=(this.accounts||[]).filter(a=>ids.includes(Number(a.id)));
      const ownerIds=[...new Set(selectedRows.map(a=>Number(a.owner_id||0)).filter(Boolean))];
      const proxyOwnerId=ownerIds.length===1?ownerIds[0]:this.effectiveOwnerId();
      await this.ensureProxyCatalog({force:true,ownerId:proxyOwnerId});
      const gs=this.accountGroupFlatOptions();
      const proxies=this.proxySelectItems();
      const groupOpts=[['','不修改'],['__clear__','移出分组'],...gs.map(g=>[String(g.id),g.name])];
      const proxyOpts=[['','不修改'],['__clear__','清空代理'],...proxies.map(p=>[String(p.id),p.name])];
      let ownerField='';
      if(this.canAssignAccounts()){
        const targets=await this.loadOwnerAssignTargets();
        if(targets.length){
          ownerField=this.selectRaw('ownerId','分配用户',[['', '不修改'],...targets.map(t=>[String(t.id),t.label])],'');
        }
      }
      const proxyScopeNote=ownerIds.length===1
        ?`代理列表按所选账号所属用户加载（${proxies.length} 条）`
        :`所选账号归属不一致或未知，代理列表按当前用户加载（${proxies.length} 条）`;
      this.modal('批量修改',`<div class="form-grid">
        <div class="field full"><div class="muted">已选 ${ids.length} 个账号。未选择的项不会改动；只有选了对应项才会批量写入。${proxyScopeNote}</div></div>
        ${this.selectRaw('groupId','账号分组',groupOpts,'')}
        ${this.selectRaw('proxyId','代理',proxyOpts,'')}
        ${ownerField}
        ${this.selectRaw('enabled','启用状态',[['','不修改'],['1','启用'],['0','禁用']],'')}
        ${this.selectRaw('dmChannel','私信通道',[['','不修改'],['auto','自动'],['api','仅 API'],['browser','仅浏览器']],'')}
        ${this.field('nickname','统一昵称（留空不改）')}
        ${this.field('notes','统一备注（留空不改）','','textarea')}
      </div>`,async d=>{
        const fields={};
        if(d.groupId) fields.groupId = d.groupId==='__clear__' ? null : Number(d.groupId);
        if(d.proxyId) fields.proxyId = d.proxyId==='__clear__' ? null : Number(d.proxyId);
        if(d.ownerId) fields.ownerId = Number(d.ownerId);
        if(d.enabled!==''&&d.enabled!=null) fields.enabled = Number(d.enabled);
        if(d.dmChannel) fields.dmChannel = d.dmChannel;
        if(String(d.nickname||'').trim()) fields.nickname = String(d.nickname).trim();
        if(String(d.notes||'').trim()) fields.notes = String(d.notes).trim();
        if(!Object.keys(fields).length) throw new Error('请至少选择一项要修改的内容');
        // 代理绑定上限：每代理最多 3 个账号；超限弹框提示并阻止保存
        if(fields.proxyId){
          const check=await this.api('/accounts/proxy-bind-check',{method:'POST',body:JSON.stringify({proxyId:fields.proxyId,accountIds:ids})});
          if(!check.allowed){
            await this.ask(check.message||`该代理绑定后将超过上限（最多 ${check.limit||3} 个账号）`,'error');
            throw new Error(check.message||'代理绑定数量超限');
          }
        }
        const r=await this.api('/accounts/batch-update',{method:'POST',body:JSON.stringify({accountIds:ids,fields})});
        const parts=[];
        if(fields.groupId!==undefined) parts.push('分组');
        if(fields.proxyId!==undefined) parts.push('代理');
        if(fields.ownerId!==undefined) parts.push('归属用户');
        if(fields.enabled!==undefined) parts.push('启用状态');
        if(fields.dmChannel!==undefined) parts.push('私信通道');
        if(fields.nickname!==undefined) parts.push('昵称');
        if(fields.notes!==undefined) parts.push('备注');
        this.toast(`已更新 ${r.updated||ids.length} 个账号（${parts.join('、')}）`);
        this.closeModal();
        await this.loadRefs();
        this.refresh();
      });
    },
    async modifyAccountProfile(id,username){
      let acc={};
      try{acc=await this.api(`/accounts/${id}`)||{}}catch{}
      const prevName=String(acc.nickname||'').trim();
      const prevBio=String(acc.profile_bio||acc.profileBio||'').trim();
      const prevAvatar=String(acc.profile_avatar||acc.profileAvatar||'').trim();
      this.modal('修改资料（系统设置）',`<div class="form-grid">
        <div class="field full"><div class="muted">账号：${this.esc(username||id)}。先保存到系统；与原先不同会创建「修改资料」分任务。推送到 TikTok 用「修改资料」任务；从 Studio 拉粉丝/28天指标用「拉取数据」。</div></div>
        ${this.field('nickname','昵称 Name（可选）',prevName)}
        ${this.field('signature','签名 Bio（可选）',prevBio,'textarea')}
        ${this.imageField('avatarUrl','头像（可选）',prevAvatar)}
      </div>`,async d=>{
        const nickname=String(d.nickname||'').trim();
        const signature=String(d.signature||'').trim();
        const avatarUrl=String(d.avatarUrl||'').split(',').map(s=>s.trim()).filter(Boolean)[0]||'';
        if(!nickname&&!signature&&!avatarUrl)throw new Error('请至少填写一项');
        // 先写入系统
        await this.api(`/accounts/${id}/profile-settings`,{method:'PATCH',body:JSON.stringify({
          nickname, signature, avatarUrl,
        })});
        const changed=(nickname&&nickname!==prevName)||(signature&&signature!==prevBio)||(avatarUrl&&avatarUrl!==prevAvatar);
        if(!changed){
          this.toast('系统资料已保存（与之前一致，未创建任务）');
          this.closeModal();
          this.refresh();
          return;
        }
        const r=await this.api('/account-work-batches/enqueue',{method:'POST',body:JSON.stringify({
          accountId:Number(id),
          taskType:'modify_profile',
          payload:{nickname,signature,avatarUrl,avatarPath:avatarUrl},
        })});
        this.toast(r?.batch_id?`修改资料任务已创建（总任务 #${r.batch_id}）`:'修改资料任务已创建');
        this.closeModal();
        this.refresh();
      });
    },
    async batchDeleteVideos(){
      const ids=this.selectedAccountIds();
      if(!ids.length){this.toast('请先选择账号',true);return}
      this.modal('批量删除视频',`<div class="form-grid">
        ${this.selectRaw('mode','执行方式',this.opt('videoDeleteModes',[['platform','比特环境删除 TikTok 视频'],['local','仅清理本地同步记录']]),'platform')}
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
    async detectProxyCountry(id){
      if(!this.canPermission('proxy.test')&&!this.canPermission('proxy.create')){this.toast('当前角色无权检测代理',true);return}
      this.toast('正在检测国家…');
      try{
        const r=await this.api('/browser/proxies/batch-detect-country',{method:'POST',body:JSON.stringify({proxyIds:[Number(id)]})});
        const item=(r.items||[])[0];
        this.toast(item?.country?`已写入国家 ${item.country}`:(item?.detail||'未能识别国家'),!item?.country);
        await this.loadRefs();this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    async batchDetectProxyCountry(){
      if(!this.canPermission('proxy.test')&&!this.canPermission('proxy.create')){this.toast('当前角色无权检测代理',true);return}
      const ids=this.selectedProxyIds();
      if(!ids.length){this.toast('请先勾选代理',true);return}
      this.toast(`正在检测 ${ids.length} 个代理的国家…`);
      try{
        const r=await this.api('/browser/proxies/batch-detect-country',{method:'POST',body:JSON.stringify({proxyIds:ids})});
        this.toast(r.updated?`已写入国家 ${r.updated}/${r.total}`:'未能识别国家（需可连代理或主机为公网 IP）',!r.updated);
        await this.loadRefs();this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    async monitorModal(){const cfg=await this.api('/accounts/monitor');this.modal('监控账号设置',`<div class="form-grid">${this.selectRaw('enabled','启用定时监控',[['false','关闭'],['true','开启']],cfg.enabled?'true':'false')}${this.field('intervalMinutes','间隔（分钟）',cfg.intervalMinutes||60,'number')}${this.selectRaw('syncProfile','同步资料',[['true','是'],['false','否']],cfg.syncProfile?'true':'false')}${this.selectRaw('syncVideos','同步视频',[['false','否'],['true','是']],cfg.syncVideos?'true':'false')}<div class="field full"><div class="muted">上次运行：${this.esc(cfg.lastRunAt||'尚未运行')}。开启后服务会按间隔自动同步（需已绑定浏览器环境），也可手动点「同步账号资料」。 <button type="button" class="tiny" onclick="app.showMonitorResult()">查看上次结果</button></div></div></div>`,async d=>{d.enabled=d.enabled==='true';d.syncProfile=d.syncProfile==='true';d.syncVideos=d.syncVideos==='true';d.intervalMinutes=Number(d.intervalMinutes||60);d.accountIds=this.selectedAccountIds();await this.api('/accounts/monitor',{method:'PUT',body:JSON.stringify(d)});this.toast('监控配置已保存');this.closeModal()})},
    async runAccountMonitor(){if(!this.canPermission('account.create')){this.toast('当前角色无权执行账号同步',true);return}this.toast('正在执行账号监控同步…');try{const r=await this.api('/accounts/monitor/run',{method:'POST'});const okCount=Number(r.profile||0)+Number(r.videos||0);const failed=Number(r.failed||0);this.toast(okCount||failed?`资料 ${r.profile||0}，视频 ${r.videos||0}，失败 ${failed}`:'没有可同步的账号（需已绑定浏览器环境）',!okCount);this.refresh()}catch(e){this.toast(e.message,true)}},
  
    async renderBrowser(){const status=await this.api('/browser/status');if(!status.online){document.querySelector('#content').innerHTML=`<div class="panel"><div class="empty"><h2>比特浏览器未连接</h2><p>${this.esc(status.message)}</p><p>请启动比特浏览器，并确认本地 API 地址为 ${this.esc(status.apiUrl)}</p><button class="primary" onclick="app.refresh()">重新检测</button></div></div>`;return}const d=await this.api('/browser/profiles?pageSize=500');const pack=UI.paginateLocal(d.items||[],this.browserPage||1,20);this.browserPage=pack.page;document.querySelector('#content').innerHTML=`<div class="stats">${this.stat('连接状态','在线','比特浏览器 API','#e8f8f1')}${this.stat('环境总数',d.total,'已从本地 API 同步','#eeeafe')}${this.stat('已绑定账号',(d.items||[]).filter(x=>x.account).length,'账号与环境关联','#e7f3ff')}${this.stat('API 地址','54345',status.apiUrl,'#fff6df')}</div><div class="panel"><div class="toolbar"><span class="muted">创建环境时会自动使用账号绑定的代理，并根据国家设置浏览器语言。</span><div>${this.canPermission('account.create')?`<button class="primary" onclick="app.batchCreateBrowserModal()">批量创建环境</button>`:''}<div class="dropdown" style="display:inline-block"><button class="ghost" type="button" onclick="app.toggleBrowserBatchMenu(event)">批量操作 <span class="btn-arrow-down">▾</span></button><div id="browser-batch-menu" class="dropdown-menu align-left hidden">${this.canPermission('account.create')?`<button type="button" class="is-danger" onclick="app.batchDeleteBrowser()">批量删除环境</button>`:''}<button type="button" onclick="app.refresh()">同步环境</button></div></div></div></div>${this.browserTable(pack.items)}${UI.pager(pack,'browserPage')}</div>`},
    browserTable(rows){
      if(!rows.length)return '<div class="empty">还没有浏览器环境</div>';
      const canWrite=this.canPermission('account.create');
      return `<table><thead><tr><th><input type="checkbox" onchange="app.toggleAllBrowser(this.checked)" title="全选当前列表"></th><th>序号</th><th>环境名称</th><th>环境 ID</th><th>代理</th><th>内核</th><th>绑定账号</th><th>操作</th></tr></thead><tbody>${rows.map(x=>{
        const id=this.esc(x.id);
        const more=[
          `<button type="button" onclick="app.checkTikTokStatus('${id}')">检测登录</button>`,
          `<button type="button" onclick="app.browserAction('${id}','open')">打开</button>`,
          `<button type="button" onclick="app.browserAction('${id}','close')">关闭</button>`,
        ];
        const delBtn=`<button class="tiny danger" type="button" title="删除" onclick="app.deleteBrowser('${id}')" ${canWrite?'':'disabled title="无维护权限"'}>删除</button>`;
        const moreBtn=`<div class="ops-dropdown browser-ops-dropdown"><button class="tiny" type="button" title="更多" onclick="app.toggleBrowserOps('${id}',event)">…</button><div id="browser-ops-${id}" class="dropdown-menu ops-menu hidden">${more.join('')}</div></div>`;
        return `<tr><td><input class="browser-check" type="checkbox" value="${id}"></td><td>${x.seq||'-'}</td><td><b>${this.esc(x.name||'-')}</b><div class="muted">${this.esc(x.remark||'')}</div></td><td><span class="muted">${id}</span></td><td>${this.esc(x.proxyType||'-')} ${this.esc(x.host||'')}${x.port?':'+x.port:''}</td><td>${this.esc(x.coreProduct||'-')} ${this.esc(x.coreVersion||'')}</td><td>${x.account?`<b>${this.esc(x.account.username)}</b>${x.account.saturation==='busy'?' <span class="badge warn">执行中</span>':' <span class="badge success">空闲</span>'} <button class="tiny" onclick="app.unbindBrowser(${x.account.id},${JSON.stringify(String(x.id||''))})">解绑</button>`:`<button class="tiny" onclick="app.bindBrowser('${id}')">绑定账号</button>`}</td><td><div class="task-ops-cell browser-ops-cell">${delBtn}${moreBtn}</div></td></tr>`;
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
    toggleAllBrowser(checked){document.querySelectorAll('.browser-check').forEach(x=>{x.checked=checked})},
    async batchDeleteBrowser(){const ids=[...document.querySelectorAll('.browser-check:checked')].map(x=>x.value);if(!ids.length){this.toast('请先选择要删除的浏览器环境',true);return}if(!(await this.ask(`确定删除选中的 ${ids.length} 个浏览器环境吗？已绑定账号的环境会被自动跳过。`)))return;try{const r=await this.api('/browser/profiles/batch-delete',{method:'POST',body:JSON.stringify({profileIds:ids})});let message=`已删除 ${r.deleted} 个环境`;if(r.blocked||r.failed)message+=`，跳过 ${r.blocked}，失败 ${r.failed}`;this.toast(message,Boolean(r.blocked||r.failed));this.refresh()}catch(e){this.toast(e.message,true)}},
    async deleteBrowser(id){if(!(await this.ask('确定删除这个比特浏览器环境吗？此操作不会删除账号。')))return;try{await this.api(`/browser/profiles/${id}`,{method:'DELETE'});this.toast('浏览器环境已删除');this.refresh()}catch(e){this.toast(e.message,true)}}, 
    async browserAction(profileId, action='open'){
      if(!profileId){this.toast('缺少环境 ID',true);return}
      if(!(await this.ensureBitOnline(action==='close'?'关闭环境':'打开环境')))return;
      try{
        if(action==='close'){
          await this.api(`/browser/profiles/${encodeURIComponent(profileId)}/close`,{method:'POST',body:'{}'});
          this.toast('已关闭浏览器环境');
        }else{
          await this.api(`/browser/profiles/${encodeURIComponent(profileId)}/open`,{method:'POST',body:'{}'});
          this.toast('已打开浏览器环境');
        }
      }catch(e){this.toast(e.message||'操作失败',true,6000)}
    },
    async createAccountBrowser(id){
      if(!this.canPermission('account.create')){this.toast('当前角色无权创建/绑定环境',true);return}
      if(!(await this.ensureBitOnline('创建环境')))return;
      const tip=`将在当前比特账号下为账号 #${id} 新建环境并设为主绑定。换过比特账号后旧环境会失效，需要再绑。是否继续？`;
      if(!(await this.ask(tip)))return;
      this.toast('正在创建并绑定环境…',false,8000);
      try{
        const r=await this.api(`/browser/accounts/${id}/create`,{method:'POST',body:JSON.stringify({asPrimary:true})});
        this.toast(`环境已绑定：${r.profileName||r.profileId||''}`);
        this.refresh();
      }catch(e){this.toast(e.message||'创建环境失败',true,8000)}
    },
    async batchCreateBrowserModal(){
      if(!this.canPermission('account.create')){this.toast('当前角色无权批量创建环境',true);return}
      if(!(await this.ensureBitOnline('批量创建环境')))return;
      const ids=this.selectedAccountIds();
      const groups=(this.groups||[]).filter(g=>g.type==='account'||!g.type);
      this.modal('批量创建环境',`<div class="form-grid">
        <div class="field full"><div class="muted">${ids.length?`将为已勾选的 ${ids.length} 个账号创建环境（已有环境也会再绑新主环境）。`:'未勾选账号时，按分组创建给「尚未绑定环境」的账号。换过比特账号建议勾选后批量再绑。'}</div></div>
        ${ids.length?'':this.select('groupId','账号分组（可空=全部）',[['','全部账号'],...groups.map(g=>[String(g.id),g.name])])}
      </div>`,async d=>{
        this.toast('正在批量创建环境，请稍候…',false,8000);
        const body=ids.length
          ?{accountIds:ids,asPrimary:true}
          :{groupId:d.groupId?Number(d.groupId):null,requireProxy:false};
        const r=await this.api('/browser/accounts/batch-create',{method:'POST',body:JSON.stringify(body)});
        const first=r.errors?.[0];
        let msg=`成功 ${r.created}，失败 ${r.failed}`;
        if(first)msg+=`；#${first.id}：${first.reason||''}`;
        this.toast(msg,r.failed>0,r.failed?6000:3000);
        this.closeModal();
        this.refresh();
      });
    },
    async batchCreateBrowser(){return this.batchCreateBrowserModal()},
    async bindBrowser(profileId){
      const d=await this.api('/accounts?pageSize=200');
      // 一账号可绑多环境：列出全部启用账号（该 profile 未被占用由后端校验）
      const accounts=(d.items||[]).filter(x=>x.enabled!==0&&x.enabled!==false);
      if(!accounts.length){this.toast('没有可绑定的账号',true);return}
      const options=accounts.map(x=>({id:x.id,name:`#${x.id} · ${x.username}`+(x.nickname?' · '+x.nickname:'')+(x.browser_profile_id?'（已有环境，将追加）':'')}));
      this.modal('绑定浏览器环境',`<div class="form-grid">${this.select('accountId','选择账号',options)}<div class="field full"><div class="muted">环境 ID：${this.esc(profileId)}。同一账号可绑定多个比特环境；执行总任务时占用空闲环境，结束后释放。</div></div></div>`,async data=>{
        if(!data.accountId)throw new Error('请选择账号');
        await this.api('/browser/bind',{method:'POST',body:JSON.stringify({accountId:Number(data.accountId),profileId,asPrimary:true})});
        this.toast('环境已绑定');
        this.closeModal();
        this.refresh();
      });
    },
    async unbindBrowser(accountId, profileId){
      const tip=profileId?`确定解除账号 #${accountId} 与该环境的绑定吗？`:'确定解除这个账号的全部浏览器环境绑定吗？';
      if(!(await this.ask(tip)))return;
      await this.api('/browser/unbind',{method:'POST',body:JSON.stringify({accountId, profileId: profileId||'', clear:true})});
      this.toast('已解除绑定');
      this.refresh();
    },
    async batchModifyIp(){
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
    async deleteBrowsersFromSettings(){if(!(await this.ask('将删除比特浏览器中未绑定账号的环境。已绑定账号的环境会跳过。继续？')))return;this.toast('正在读取环境列表…');try{const d=await this.api('/browser/profiles?pageSize=500');const ids=(d.items||[]).filter(x=>!x.account).map(x=>String(x.id)).filter(Boolean);if(!ids.length){this.toast('没有可删除的未绑定环境');return}const r=await this.api('/browser/profiles/batch-delete',{method:'POST',body:JSON.stringify({profileIds:ids})});this.toast(`已删除 ${r.deleted}，跳过 ${r.blocked||0}，失败 ${r.failed||0}`,Boolean(r.blocked||r.failed))}catch(e){this.toast(e.message,true)}},
    async assignProxyModal(){
      const ids=this.selectedAccountIds();
      if(!ids.length&&!this.accountGroupId){this.toast('请勾选账号，或先选中左侧分组',true);return}
      const pgs=this.groups.filter(g=>g.type==='proxy');
      const selectedRows=(this.accounts||[]).filter(a=>ids.includes(Number(a.id)));
      const ownerIds=[...new Set(selectedRows.map(a=>Number(a.owner_id||0)).filter(Boolean))];
      const proxyOwnerId=ownerIds.length===1?ownerIds[0]:this.effectiveOwnerId();
      await this.ensureProxyCatalog({force:true,ownerId:proxyOwnerId});
      const proxies=this.proxySelectItems();
      const scopeNote=ownerIds.length===1
        ?`代理按所选账号所属用户加载（${proxies.length} 条）`
        :`代理按当前用户加载（${proxies.length} 条）`;
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
      this.toast('正在打开比特环境并一键登录…',false,8000);
      try{
        const r=await this.api(`/browser/accounts/${id}/login-assist`,{method:'POST',body:JSON.stringify({autoSubmit:true,submitAfterTotp:true})});
        const okLogin=!!(r?.loginOk||r?.alreadyLoggedIn||r?.loginStatus==='online');
        let msg=r?.message||(okLogin?'登录成功':'登录未完成');
        msg+=okLogin?'；登录状态已更新为已登录':'；登录状态已更新为未登录';
        if(r?.captcha)msg+='。请在比特窗口完成滑块验证后，再点登录状态检测';
        if(r?.filled&&!r?.submitted&&!okLogin)msg+='。若比特窗口未弹出，请确认比特已启动且环境未损坏';
        this.toast(msg,!okLogin,okLogin?3000:8000);
        this.refresh();
      }catch(e){
        this.toast((e.message||'登录失败')+'；登录状态已更新为未登录',true,8000);
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
        const r=await this.api('/browser/accounts/batch-login',{method:'POST',body:JSON.stringify(body)});
        const fails=(r.items||[]).filter(x=>!x.ok);
        const first=fails[0];
        let detail=`成功 ${r.prepared}，失败 ${r.failed}`;
        if(first)detail+=`；${first.username||('#'+first.accountId)}：${first.reason||first.message||'未知原因'}`;
        if(fails.some(x=>/未绑定/.test(x.reason||'')))detail+='。请先「创建环境」再登录';
        if(fails.some(x=>/密码|凭据|2FA/.test(x.reason||'')))detail+='。请在「密码/2FA」补全凭据';
        if(fails.some(x=>/Maximum|限制登录|attempts/i.test(x.reason||'')))detail+='。请换代理或等待后再试，勿连点';
        if(fails.some(x=>/安全验证|滑块|captcha/i.test(x.reason||'')))detail+='。请在比特窗口人工过验证后点「检测登录」';
        if(fails.some(x=>/权限不足|无权|拒绝操作/.test(x.reason||'')))detail+='。这是比特窗口权限问题：请用有权限的比特账号登录，或解绑后重建环境';
        this.toast(detail,r.failed>0,r.failed>0?6000:3000);
        this.refresh();
      }catch(e){this.toast(e.message,true,6000)}
    },
    batchMoveAccounts(){const ids=this.selectedAccountIds();if(!ids.length){this.toast('请先勾选账号',true);return}const gs=this.accountGroupFlatOptions();this.modal('转移分组',`<div class="form-grid">${this.select('groupId','目标分组（建议选公司子组）',gs)}<div class="field full"><div class="muted">已选 ${ids.length} 个账号。目标留空表示移出分组。</div></div></div>`,async d=>{await this.api('/accounts/batch-move-group',{method:'POST',body:JSON.stringify({accountIds:ids,groupId:d.groupId?Number(d.groupId):null})});this.toast('分组已更新');this.closeModal();await this.loadRefs();this.refresh()})},
    canAssignAccounts(){return !!(this.authIsSuper||(this.authChildren&&this.authChildren.length))},
    async batchAssignAccounts(presetIds){
      if(!this.canAssignAccounts()){this.toast('当前账号无权分配',true);return}
      const ids=Array.isArray(presetIds)&&presetIds.length?presetIds.map(Number):this.selectedAccountIds();
      if(!ids.length){this.toast('请先勾选要分配的账号',true);return}
      const targets=await this.loadOwnerAssignTargets();
      if(!targets.length){this.toast('没有可分配的目标用户',true);return}
      const opts=targets.map(t=>[t.id,t.label]);
      this.modal('分配账号给管理用户',`<div class="form-grid"><div class="field full"><div class="muted">已选 ${ids.length} 个账号。分配后这些账号将归属于目标用户，你在本人视图下将不再看到它们（超管全量视图除外）。</div></div>${this.selectRaw('ownerId','目标管理用户',opts,opts[0]?.[0])}</div>`,async d=>{
        const ownerId=Number(d.ownerId||0);
        if(!ownerId)throw new Error('请选择目标用户');
        const r=await this.api('/accounts/batch-assign-owner',{method:'POST',body:JSON.stringify({accountIds:ids,ownerId})});
        this.toast(r?.ownerName?`已分配 ${r.updated} 个账号给 ${r.ownerName}`:`已分配 ${r.updated||ids.length} 个账号`);
        this.closeModal();
        await this.loadRefs();
        this.refresh();
      });
    },
    async extractFingerprints(){if(!(await this.ensureBitOnline('提取指纹')))return;const ids=this.selectedAccountIds();if(!ids.length&&!this.accountGroupId){this.toast('请勾选账号，或先选中左侧分组',true);return}try{const body=ids.length?{accountIds:ids}:{groupId:Number(this.accountGroupId)};const r=await this.api('/browser/accounts/batch-fingerprint',{method:'POST',body:JSON.stringify(body)});const text=(r.items||[]).map(x=>x.username+'\t'+(x.fingerprint||'未采集')).join('\n');await navigator.clipboard.writeText(text);this.toast(`已复制 ${r.items.length} 条，有指纹 ${r.withFingerprint}${r.harvested?`，新采集 ${r.harvested}`:''}`)}catch(e){this.toast(e.message,true)}},
    async deleteBannedAccounts(){if(!this.canPermission('account.delete')){this.toast('当前角色无权删除账号',true);return}const scope=this.accountGroupId?'当前分组':'全部账号';if(!(await this.ask('删除'+scope+'中状态为封号的账号？此操作不可恢复。')))return;try{const r=await this.api('/accounts/batch-delete-banned',{method:'POST',body:JSON.stringify(this.accountGroupId?{groupId:Number(this.accountGroupId)}:{})});this.toast(r.deleted?`已删除 ${r.deleted} 个封号账号`:'没有可删除的封号账号',!r.deleted);this.refresh()}catch(e){this.toast(e.message,true)}},
    async showMonitorResult(){try{const cfg=await this.api('/accounts/monitor');if(!cfg.lastRunAt){this.toast('还没有监控记录',true);return}const r=cfg.lastResult||{};const errors=(r.errors||[]).length?(r.errors||[]).map(e=>`<div>#${this.esc(e.id)} ${this.esc(e.reason||'')}</div>`).join(''):'<div class="muted">无失败明细</div>';this.modal('上次监控结果',`<div class="data-summary"><div><small>时间</small><b>${this.esc(cfg.lastRunAt)}</b></div><div><small>扫描</small><b>${r.total||0}</b></div><div><small>资料</small><b>${r.profile||0}</b></div><div><small>视频</small><b>${r.videos||0}</b></div><div><small>失败</small><b>${r.failed||0}</b></div></div><h3>失败明细</h3>${errors}<div class="muted" style="margin-top:8px">${r.total?'以上为最近一次真实同步结果。':'上次没有可同步账号（需已绑定浏览器环境）。'}</div>`,()=>this.closeModal())}catch(e){this.toast(e.message,true)}},
  };
  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages["accounts"] = true;
})();
