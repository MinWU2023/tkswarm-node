(function () {
  if (!window.app) throw new Error('app-core must load before pages/chat.js');
  const __methods = {
    canChatManage(){return this.canPermission('chat.manage')||this.canPermission('chat.update')||this.canPermission('publish.mass')},
    canChatOps(){return this.canPermission('chat.manage')||this.canPermission('chat.update')||this.canPermission('chat.send')||this.canPermission('publish.mass')},
    /** 按与账号列表相同的可见范围，分页拉全量客服账号（批量操作用） */
    async fetchAllChatAccounts(extraQs=''){
      const items=[];
      let page=1, pages=1;
      const extra=extraQs?`&${String(extraQs).replace(/^\?/,'')}`:'';
      do{
        const pack=await this.api(`/chat/accounts?page=${page}&pageSize=100${extra}`);
        items.push(...(pack.items||[]));
        pages=Math.max(1, Number(pack.pages||1));
        page+=1;
      }while(page<=pages && page<=50);
      return items;
    },
    batchChatConnectModal(){
      if(!this.canChatManage()){this.toast('当前角色无权批量标记客服',true);return}
      const selected=[...document.querySelectorAll('.account-check:checked')].map(x=>Number(x.value));this.modal('批量标记客服在线',`<div class="form-grid">${this.selectRaw('scope','账号范围',this.opt('chatConnectScopes',[['selected','勾选账号'],['online','全部已登录 TikTok']]),'selected')}${this.selectRaw('syncMessages','同步消息标记',[['true','开启'],['false','关闭']],'true')}${this.selectRaw('autoTranslate','自动翻译',[['false','关闭'],['true','开启']],'false')}<div class="field full"><div class="muted">将账号标记为客服在线，并写入会话连接。真实 TikTok 私信同步仍依赖本地会话层。</div></div></div>`,async d=>{let ids=selected;if(d.scope==='online'){const all=await this.fetchAllChatAccounts('status=online');ids=all.filter(a=>a.login_status==='online'&&a.browser_profile_id).map(a=>a.id)}if(!ids.length)throw new Error(d.scope==='selected'?'请先勾选账号':'没有可登录的账号');const r=await this.api('/chat/accounts/batch-connect',{method:'POST',body:JSON.stringify({accountIds:ids,syncMessages:d.syncMessages==='true',autoTranslate:d.autoTranslate==='true'})});this.toast(`批量登录成功 ${r.connected}，失败 ${r.failed}`);this.closeModal();this.refresh()})},
    async manageChatTemplates(){
      if(!this.canChatManage()&&!this.canAnyPermission('account.msg_template','account.msg_template.comment','account.msg_template.dm')){this.toast('当前角色无权管理话术',true);return}
      await this.loadRefs();
      const rows=(this.templates||[]).slice();
      const gs=this.ownedGroups('message');
      const canEdit=this.canChatManage()||this.canAnyPermission('account.msg_template','account.msg_template.comment','account.msg_template.dm');
      this.modal('管理话术',`<div class="form-grid"><div class="field full"><div class="action-bar" style="margin:0">${canEdit?`<button class="primary tiny" type="button" onclick="app.closeModal();app.templateModal()">+ 添加话术</button>${gs.length?'':`<button class="ghost tiny" type="button" onclick="app.closeModal();app.groupModal('message')">先建分类</button>`}`:''}</div></div><div class="field full">${rows.length?`<div class="table-container"><table><thead><tr><th>名称</th><th>分类</th><th>内容</th><th></th></tr></thead><tbody>${rows.map(t=>`<tr><td>${this.esc(t.name)}</td><td>${this.esc(t.group_name||'-')}</td><td>${this.esc(String(t.content||'').slice(0,60))}</td><td>${canEdit?`<button class="tiny" type="button" onclick='app.closeModal();app.templateModal(${JSON.stringify(t)})'>编辑</button> `:''}<button class="tiny" type="button" onclick='app.useTemplate(${JSON.stringify(t.content)});app.closeModal()'>使用</button>${canEdit?` <button class="tiny danger" type="button" onclick="app.remove('/message-templates/${t.id}','消息模板')">删除</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">还没有话术，点上方添加</div>'}</div></div>`,async()=>{},false,{hideSubmit:true,wide:true});
    },
    async renderUids(opts={}){
      if(!this.canView('uids')&&!this.canAnyPermission('chat.manage','publish.mass')) return this.renderPageDenied('当前角色无权查看 UID 好友');
      this._uidRenderGen=(this._uidRenderGen||0)+1;
      const gen=opts.gen||this._uidRenderGen;
      const still=()=>this.view==='chat'&&(this.chatPane||'')==='uids'&&gen===this._uidRenderGen;
      const canWrite=this.canPermission('chat.manage')||this.canPermission('publish.mass');
      const canGroup=this.canPermission('group.manage');
      const groups=await this.api('/uids/groups');
      this.uidGroups=groups;
      if(this.uidGroupId&&!groups.some(g=>Number(g.id)===Number(this.uidGroupId)))this.uidGroupId='';
      if(!this.uidGroupId&&groups[0])this.uidGroupId=groups[0].id;
      const kw=encodeURIComponent(this.uidKeyword||'');
      const page=this.uidPage||1;
      const pack=this.uidGroupId
        ?await this.api(`/uids?groupId=${this.uidGroupId}&page=${page}&pageSize=20${kw?`&keyword=${kw}`:''}`)
        :{items:[],stats:{total:0,unused:0,used:0,failed:0},page:1,pages:1,total:0};
      if(!still())return;
      const stats=pack.stats||{};
      const writeBtns=canWrite
        ?`<button type="button" class="ghost" onclick="app.exportUnusedUids()">导出未使用</button>
            <button type="button" class="ghost" onclick="app.dedupeUids()">去重</button>
            <button type="button" class="ghost" onclick="app.cleanupUids('used')">清理已使用</button>
            <button type="button" class="ghost" onclick="app.cleanupUids('failed')">清理失败</button>
            <button type="button" class="ghost" onclick="app.cleanupUids('unused')">清理未使用</button>
            <button type="button" class="ghost" onclick="app.keepUnusedUids()">私信成功去重</button>
            <button type="button" class="danger" onclick="app.clearUidGroup()">按组删除</button>`
        :'<span class="muted">当前角色仅可查看 UID</span>';
      const hasGroup=!!this.uidGroupId;
      const rows=pack.items||[];
      const importBlock=hasGroup
        ?(canWrite
          ?`<div class="uid-import-card">
              <div class="uid-import-head">
                <b>导入 UID</b>
                <span class="muted">每行一个：UID 或 UID----用户名</span>
              </div>
              <textarea id="uid-import" class="input uid-import-textarea" rows="4" placeholder="123456789&#10;987654321----nickname"></textarea>
              <div class="uid-import-actions">
                <select id="uid-import-mode" class="input uid-import-mode">
                  <option value="append">追加导入</option>
                  <option value="dedupe">去重导入</option>
                  <option value="replace">清空后导入</option>
                </select>
                <button type="button" class="primary" onclick="app.importUids()">导入</button>
                <label class="ghost uid-import-file" title="从 TXT 读入后再点导入">导入 TXT<input type="file" accept=".txt,text/plain" hidden onchange="app.importUidFile(this)"></label>
              </div>
            </div>`
          :'<div class="uid-import-card"><div class="muted" style="padding:12px 0">当前角色无权导入 UID</div></div>')
        :'';
      let listBlock='';
      if(!hasGroup){
        listBlock=`<div class="uid-empty-panel"><div class="empty">请先在左侧创建并选择 UID 分组</div></div>`;
      }else if(rows.length){
        listBlock=`<div class="table-container uid-table-wrap"><table><thead><tr><th>UID</th><th>用户名</th><th>状态</th><th>使用时间</th><th>操作</th></tr></thead><tbody>${rows.map(x=>`<tr><td><code class="uid-code">${this.esc(x.uid)}</code></td><td>${this.esc(x.username||'-')}</td><td>${this.badge(x.status==='unused'?'pending':x.status==='used'?'success':x.status)}</td><td class="muted">${this.esc(x.used_at||'-')}</td><td>${canWrite?`<button type="button" class="tiny danger" onclick='app.deleteUidRow(${x.id},${JSON.stringify(x.uid)})'>删除</button>`:'-'}</td></tr>`).join('')}</tbody></table></div>${UI.pager(pack,'uidPage')}`;
      }else if(this.uidKeyword){
        listBlock=`<div class="uid-empty-panel"><div class="empty">没有匹配「${this.esc(this.uidKeyword)}」的 UID</div></div>`;
      }else{
        listBlock='';
      }
      const content=document.querySelector('#content');
      content.classList.remove('chat-mode');
      content.innerHTML=`<div class="workspace uid-workspace">
        <aside class="side-groups uid-sidebar">
          <h3>UID 分组</h3>
          <div class="group-list">${groups.map(g=>`<button type="button" class="${Number(this.uidGroupId)===Number(g.id)?'active':''}" onclick="app.selectUidGroup(${g.id})">
            <div class="row"><b>${this.esc(g.name)}</b>${canGroup?`<span class="group-side-acts"><span class="group-act" title="编辑分组" onclick="event.stopPropagation();app.editUidGroup(${g.id})">改</span><span class="group-act danger" title="删除分组" onclick="event.stopPropagation();app.remove('/groups/${g.id}','UID 分组')">删</span></span>`:''}</div>
            <div class="row meta"><span>${g.unused||0} 未使用</span><span>共 ${g.total||0}</span></div>
          </button>`).join('')||'<div class="muted" style="padding:8px">暂无分组</div>'}</div>
          <button type="button" class="ghost uid-add-group" onclick="app.groupModal('uid')" ${canGroup?'':'disabled title="无分组管理权限"'}>+ 分组</button>
        </aside>
        <div class="panel uid-main-panel">
          <div class="matrix-action-bar uid-action-bar">
            <div class="left">${hasGroup?writeBtns:'<span class="muted">选择左侧分组后可管理 UID</span>'}</div>
            <div class="right"><span class="muted">客服群发目标池 · 按分组维护</span></div>
          </div>
          ${hasGroup?`<div class="search-bar task-filter-bar uid-filter-bar">
            <input id="uid-search" class="input" type="search" placeholder="搜索 UID / 用户名" value="${this.esc(this.uidKeyword||'')}" onkeydown="if(event.key==='Enter')app.searchUids()">
            <button type="button" class="primary" onclick="app.searchUids()">查询</button>
            <button type="button" class="ghost" onclick="app.uidKeyword='';app.uidPage=1;app.refresh()">重置</button>
          </div>
          <div class="stats uid-stats">${this.stat('总数',stats.total||0,'本组 UID','#ecf5ff')}${this.stat('未使用',stats.unused||0,'可分配','#f0f9eb')}${this.stat('已使用',stats.used||0,'群发已消耗','#fdf6ec')}${this.stat('失败',stats.failed||0,'发送失败','#fef0f0')}</div>
          ${importBlock}`:''}
          ${listBlock}
        </div>
      </div>`;
    },selectUidGroup(id){this.uidGroupId=id;this.uidKeyword='';this.uidPage=1;this.refresh()},
    searchUids(){this.uidKeyword=document.querySelector('#uid-search')?.value||'';this.uidPage=1;this.refresh()},
    async importUids(){if(!this.uidGroupId){this.toast('请选择分组',true);return}if(!(this.canPermission('chat.manage')||this.canPermission('publish.mass'))){this.toast('当前角色无权导入 UID',true);return}const content=document.querySelector('#uid-import')?.value||'';const mode=document.querySelector('#uid-import-mode')?.value||'append';if(!content.trim()){this.toast('请粘贴 UID',true);return}if(mode==='replace'&&!(await this.ask('将清空该分组全部 UID 再导入，是否继续？')))return;try{const r=await this.api('/uids/import',{method:'POST',body:JSON.stringify({groupId:Number(this.uidGroupId),content,mode})});this.toast(r.imported?`导入 ${r.imported}，重复 ${r.duplicates}${r.cleared?`，清空 ${r.cleared}`:''}`:`没有新 UID 导入（重复 ${r.duplicates||0}）`,!r.imported);this.refresh()}catch(e){this.toast(e.message,true)}},
    importUidFile(input){const file=input?.files?.[0];if(input)input.value='';if(!file)return;const reader=new FileReader();reader.onload=()=>{const box=document.querySelector('#uid-import');if(box)box.value=String(reader.result||'');this.toast(`已读入 ${file.name}，请选择导入方式后点导入`)};reader.onerror=()=>this.toast('读取文件失败',true);reader.readAsText(file)},
    async exportUnusedUids(){if(!this.uidGroupId){this.toast('请选择分组',true);return}if(!(this.canPermission('chat.manage')||this.canPermission('publish.mass'))){this.toast('当前角色无权导出 UID',true);return}if(!(await this.ask('导出当前分组中未使用的 UID？')))return;try{const headers=this.authToken?{Authorization:'Bearer '+this.authToken}:{};const base=window.TKSWARM_API_BASE||'';const r=await fetch(base+'/api/uids/export?groupId='+this.uidGroupId,{headers});if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.message||'导出失败')}const text=await r.text();if(!String(text||'').trim()){this.toast('没有未使用 UID 可导出',true);return}const blob=new Blob([text],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='unused-uids.txt';a.click();URL.revokeObjectURL(url);this.toast('已导出未使用 UID')}catch(e){this.toast(e.message,true)}},
    async cleanupUids(status){if(!this.uidGroupId){this.toast('请选择分组',true);return}if(!(this.canPermission('chat.manage')||this.canPermission('publish.mass'))){this.toast('当前角色无权清理 UID',true);return}const labels={used:'已使用',failed:'失败',unused:'未使用'};if(!(await this.ask(`确定清理该分组中状态为「${labels[status]||status}」的 UID 吗？`)))return;try{const r=await this.api('/uids/cleanup',{method:'POST',body:JSON.stringify({groupId:Number(this.uidGroupId),status})});this.toast(r.deleted?`已清理 ${r.deleted} 条`:`没有可清理的 UID`,!r.deleted);this.refresh()}catch(e){this.toast(e.message,true)}},
    async keepUnusedUids(){if(!this.uidGroupId){this.toast('请选择分组',true);return}if(!(this.canPermission('chat.manage')||this.canPermission('publish.mass'))){this.toast('当前角色无权操作 UID',true);return}if(!(await this.ask('将删除该分组中已使用/失败的 UID，仅保留未使用。是否继续？')))return;try{const r=await this.api('/uids/keep-unused',{method:'POST',body:JSON.stringify({groupId:Number(this.uidGroupId)})});this.toast(r.deleted?`已去掉 ${r.deleted} 条，剩余未使用 ${r.remaining}`:'没有需要去掉的已使用/失败 UID',!r.deleted);this.refresh()}catch(e){this.toast(e.message,true)}},
    async clearUidGroup(){if(!this.uidGroupId)return;if(!(this.canPermission('chat.manage')||this.canPermission('publish.mass'))){this.toast('当前角色无权清空 UID',true);return}if(!(await this.ask('确定删除该分组下的全部 UID 吗？分组本身会保留。')))return;try{const r=await this.api(`/uids/group/${this.uidGroupId}`,{method:'DELETE'});this.toast(r.deleted?`已删除 ${r.deleted} 条`:'该分组没有 UID 可删',!r.deleted);this.refresh()}catch(e){this.toast(e.message,true)}},
    async renderChat(){
      if((this.chatPane||'workbench')==='uids'){
        if(!this.canView('uids')&&!this.canAnyPermission('chat.manage','publish.mass')) return this.renderPageDenied('当前角色无权查看 UID 好友');
        this.stopChatSyncTimer?.();
        return this.renderUids();
      }
      if(!this.canView('chat')&&!this.canAnyPermission('chat.manage','chat.view','chat.update','chat.send','publish.mass')) return this.renderPageDenied('当前角色无权进入客服工作台');
      document.querySelector('#content').classList.add('chat-mode');
      this.startChatSyncTimer();
      // 与账号列表同一套可见范围（API 内 accountListScopeSql）；服务端分页，勿一次拉全量
      const keywordAcc=this.chatAccountKeyword||'';
      const accountPage=Math.max(1, Number(this.chatAccountPage||1));
      const accountQs=[
        `page=${accountPage}`,
        'pageSize=20',
        `keyword=${encodeURIComponent(keywordAcc)}`,
        this.chatAccountId?`includeId=${Number(this.chatAccountId)}`:'',
      ].filter(Boolean).join('&');
      const accountsPack=await this.api(`/chat/accounts?${accountQs}`);
      const accounts=accountsPack.items||[];
      const shownAccounts=accounts;
      this.chatAccountPage=Number(accountsPack.page||accountPage);
      const friendTab=this.chatFriendTab||'dm';
      const tabFilterMap={dm:'all',follower:'follower',following:'following'};
      let friendsPack={items:[],counts:{},tags:[]}; let messagesPack={items:[],friend:null};
      if(!this.chatAccountId&&accounts.length)this.chatAccountId=accounts.find(a=>a.login_status==='online')?.id||accounts[0].id;
      const account=accountsPack.selected
        || accounts.find(a=>Number(a.id)===Number(this.chatAccountId))
        || null;
      if(friendTab!=='search'&&account){
        const filter=tabFilterMap[friendTab]||'all';
        const friendQuery=`filter=${filter}&keyword=${encodeURIComponent(this.chatKeyword||'')}&pageSize=100`;
        friendsPack=await this.api(`/chat/friends?accountId=${account.id}&${friendQuery}`);
        if(!this.chatFriendId&&friendsPack.items[0])this.chatFriendId=friendsPack.items[0].id;
        if(this.chatFriendId&&!friendsPack.items.some(f=>Number(f.id)===Number(this.chatFriendId)))this.chatFriendId=friendsPack.items[0]?.id||null;
      }
      if(this.chatFriendId)messagesPack=await this.api(`/chat/messages?friendId=${this.chatFriendId}&pageSize=100`);
      const composerIco=(name)=>window.UI&&typeof UI.icon==='function'?UI.icon(name):'';
      const accountStatus=account?(account.login_status==='online'?'已登录':'未登录'):'';
      const peerLang=(messagesPack.friend?.lang||'').trim();
      const langLabel=peerLang?({zh:'中文',en:'英语',ja:'日语',ko:'韩语',es:'西班牙语'}[peerLang]||peerLang):'未获取（按英语处理）';
      const translateInfo=messagesPack.friend
        ?(this.chatTranslateOn?`已开启即时翻译（对方 ${this.esc(langLabel)} → 中文；发送中文会按对方语种投递）`:`对方语种：${this.esc(langLabel)} · 点击「翻译」将当前会话消息译为中文`)
        :(account?`账号：${this.esc(account.username)} · ${accountStatus}`:'请先选择账号');
      const canManage=this.canChatManage();
      const canOps=this.canChatOps();
      const canSend=this.canPermission('chat.send');
      const accountLoginActions=(canManage&&account)?`<button class="tiny" type="button" onclick="app.chatDetectLogin(${account.id})">检测</button>${account.login_status==='online'?`<button class="tiny" type="button" onclick="app.chatAccountLogout(${account.id})">退出</button>`:`<button class="tiny primary" type="button" onclick="app.chatAccountLogin(${account.id})" ${account.browser_profile_id?'':'disabled'}>登录</button>`}`:'';
      const translateActions=[
        (canOps&&messagesPack.friend)?`<button class="tiny ${this.chatTranslateOn?'primary':''}" type="button" onclick="app.toggleChatTranslation(true)" ${this.chatTranslateOn?'disabled':''}>翻译</button><button class="tiny ${!this.chatTranslateOn?'primary':''}" type="button" onclick="app.toggleChatTranslation(false)" ${!this.chatTranslateOn?'disabled':''}>还原</button><button class="tiny" type="button" title="打开对方主页判断语种（服务器浏览器）" onclick="app.fetchChatFriendLang()" ${account&&account.login_status==='online'?'':'disabled'}>获取语言</button>`:'',
        accountLoginActions
      ].filter(Boolean).join('');
      const renderChatAccount=(a)=>{
        const loginOnline=a.login_status==='online';
        const loginActs=canManage?`<div class="chat-account-actions" onclick="event.stopPropagation()"><button class="tiny" type="button" onclick="app.chatDetectLogin(${a.id})">检测</button>${loginOnline?`<button class="tiny" type="button" onclick="app.chatAccountLogout(${a.id})">退出</button>`:`<button class="tiny primary" type="button" onclick="app.chatAccountLogin(${a.id})" ${a.browser_profile_id?'':'disabled'}>登录</button>`}</div>`:'';
        return `<div class="chat-account ${Number(a.id)===Number(this.chatAccountId)?'active':''}" title="单击选择 · 双击查看资料卡" onclick="app.selectChatAccount(${a.id})" ondblclick="event.stopPropagation();app.openChatAccountCard(${a.id})"><div class="chat-avatar">${this.esc((a.username||'?')[0].toUpperCase())}</div><div class="chat-meta"><b>${this.esc(a.username)}${a.unread_count?` <span class="badge failed">${a.unread_count}</span>`:''}</b><small><span class="dot ${loginOnline?'on':''}"></span>${loginOnline?'已登录':'未登录'} · 好友 ${a.friend_count||0}</small>${loginActs}</div></div>`;
      };
      const renderChatBubble=(m)=>{
        const fid=this.chatFriendId;
        const cache=this._chatTranslateCache?.[fid]?.[m.id];
        const showTrans=this.chatTranslateOn&&m.msg_type!=='image';
        // 开翻译后会话统一展示中文：对方消息气泡主体显示中文译文，原文降级为小字附注
        const hasZh=cache&&cache!=='__loading__'&&!String(cache).startsWith('[翻译失败]')&&String(cache).trim()!=='';
        const useZh=showTrans&&m.direction!=='out'&&hasZh;
        const body=m.msg_type==='image'?`<img src="${this.esc(m.content)}" alt="图片" style="max-width:220px;border-radius:8px;display:block">`:this.esc(useZh?cache:m.content);
        const transHtml=showTrans?`<div class="bubble-translation ${cache==='__loading__'?'loading':cache&&String(cache).startsWith('[翻译失败]')?'fail':''}">${cache==='__loading__'?'翻译中…':(useZh?this.esc(m.content):(hasZh?this.esc(cache):(cache?this.esc(cache):'')))}</div>`:'';
        // 发送失败：气泡左侧给一个重发按钮，点了把该消息的坐席任务重置为待执行
        const failed=m.direction==='out'&&String(m.status||'')==='failed';
        const resendBtn=failed
          ?`<button class="bubble-resend" type="button" title="重新发送（重置服务器浏览器任务为待执行）" onclick="app.resendChatMessage(${m.id})">↻</button>`
          :'';
        return `<div class="bubble-wrap ${m.direction==='out'?'out':''}${failed?' is-failed':''}" data-msg-id="${m.id}">${resendBtn}<div class="bubble ${m.direction==='out'?'out':''}">${body}<span class="time">${this.esc(m.created_at)} · ${m.direction==='out'?'我':'对方'}${m.direction==='out'?({syncing:' · <b style="color:#d97706">同步中</b>',failed:' · <b style="color:#dc2626">发送失败</b>',synced:' · <span style="color:#16a34a">已同步</span>'}[m.status]||''):''}</span></div>${transHtml}</div>`;
      };
      this._chatLastMessages=messagesPack.items||[];
      document.querySelector('#content').innerHTML=`<div class="chat-shell">
        <aside class="chat-col chat-account-col">
          <div class="chat-col-head"><h3>账号</h3></div>
          <div class="chat-stats"><span>总 <b>${accountsPack.stats?.total??accountsPack.total??0}</b></span><span>在线 <b>${accountsPack.stats?.online||0}</b></span><span>未读 <b>${accountsPack.stats?.unread||0}</b></span></div>
          <div class="chat-account-search"><input class="input" style="width:100%" placeholder="搜索账号（与账号列表同范围）" value="${this.esc(keywordAcc)}" onkeydown="if(event.key==='Enter'){app.chatAccountKeyword=this.value;app.chatAccountPage=1;app.refresh()}"></div>
          <div class="chat-list">${shownAccounts.length?shownAccounts.map(renderChatAccount).join(''):'<div class="shell-note">暂无账号</div>'}</div>
          <div class="chat-account-pager">${UI.pager({page:accountsPack.page||1,pages:accountsPack.pages||1,total:accountsPack.total||0,pageSize:accountsPack.pageSize||20},'chatAccountPage')}</div>
        </aside>
        <aside class="chat-col chat-friend-col">
          <div class="chat-friend-tabs">
            <button type="button" class="${friendTab==='dm'?'active':''}" onclick="app.setChatFriendTab('dm')">私信</button>
            <button type="button" class="${friendTab==='follower'?'active':''}" onclick="app.setChatFriendTab('follower')">粉丝</button>
            <button type="button" class="${friendTab==='following'?'active':''}" onclick="app.setChatFriendTab('following')">关注</button>
            <button type="button" class="${friendTab==='search'?'active':''}" onclick="app.setChatFriendTab('search')">搜索</button>
          </div>
          ${friendTab==='search'?`<div class="chat-search-inline"><div class="filters"><input id="chat-search-keyword-inline" class="input" style="flex:1" placeholder="搜索词（至少 6 个字符）" value="${this.esc(this.chatSearchKeyword||'')}" oninput="app.chatSearchKeyword=this.value" onkeydown="if(event.key==='Enter'){event.preventDefault();app.runChatUserSearch(this.value)}"><button class="primary" type="button" onclick="app.runChatUserSearch(document.querySelector('#chat-search-keyword-inline')?.value)">搜索</button></div><div class="muted" style="margin-top:8px;font-size:12px">通过服务器浏览器在 TikTok 搜索用户。点击搜索到的用户即可直接发私信，下次搜索会覆盖结果列表。</div></div><div id="chat-search-results-inline" class="chat-search-results">${this.chatSearchPanelHtml()}</div>`:`${friendTab==='dm'?`<div class="chat-tab-toolbar">${canManage?`<button class="tiny primary" type="button" onclick="app.refreshChatDm()">刷新私信</button>`:''}<span class="muted">从 TikTok 收件箱拉取私信用户列表</span></div>`:''}${friendTab==='follower'?`<div class="chat-tab-toolbar">${canManage?`<button class="tiny primary" type="button" onclick="app.refreshChatFans()">刷新粉丝</button>`:''}<span class="muted">从 TikTok 拉取最新粉丝列表</span></div>`:''}${friendTab==='following'?`<div class="chat-tab-toolbar">${canManage?`<button class="tiny primary" type="button" onclick="app.refreshChatFollowing()">刷新关注</button>`:''}<span class="muted">从 TikTok 拉取最新关注列表</span></div>`:''}<div class="filters" style="padding:8px 12px;border-bottom:1px solid var(--line)"><input id="chat-friend-search" class="input" style="flex:1" placeholder="搜索${friendTab==='follower'?'粉丝':friendTab==='following'?'关注':'好友'}" value="${this.esc(this.chatKeyword||'')}" oninput="app.chatKeyword=this.value" onkeydown="if(event.key==='Enter')app.searchChatFriends()"><button class="ghost" onclick="app.searchChatFriends()">查询</button></div><div class="chat-list">${!account?'<div class="shell-note">请先选择账号并登录客服</div>':(friendsPack.items.length?friendsPack.items.map(f=>`<div class="chat-friend ${Number(f.id)===Number(this.chatFriendId)?'active':''}" onclick="app.selectChatFriend(${f.id},${f.account_id})"><div class="chat-avatar">${this.esc(((f.nickname||f.username||'?')[0]||'?').toUpperCase())}</div><div class="chat-meta"><b class="chat-name">${f.is_pinned?'📌 ':''}${this.esc(f.nickname||f.username||f.friend_uid)}</b>${this.chatLangTag(f.lang)}${(f.tags||[]).length?` <span class="muted">${(f.tags||[]).map(t=>this.esc(t)).join(' ')}</span>`:''}${f.unread_count?` <span class="badge failed">${f.unread_count}</span>`:''}</b><small>${this.esc(f.last_message||'暂无消息')}</small></div></div>`).join(''):`<div class="shell-note">暂无${friendTab==='follower'?'粉丝':friendTab==='following'?'关注':'好友'}</div>`)}</div>`}
        </aside>
        <section class="chat-col">
          <div class="chat-col-head"><div><h3>${messagesPack.friend?this.esc(messagesPack.friend.nickname||messagesPack.friend.username||messagesPack.friend.friend_uid):'会话'}</h3><div class="muted">${messagesPack.friend?`关系：${this.esc(messagesPack.friend.relation)} · UID ${this.esc(messagesPack.friend.friend_uid)}`:''}</div></div><div>${messagesPack.friend&&canOps?`<button class="tiny" onclick="app.togglePinFriend()">${messagesPack.friend.is_pinned?'取消置顶':'置顶'}</button><button class="tiny" onclick="app.blockFriend()">${messagesPack.friend.relation==='blocked'?'取消拉黑':'拉黑'}</button>${canManage?`<button class="tiny danger" onclick="app.deleteChatFriend()">删除</button>`:''}`:''}</div></div>
          ${account?`<div class="translate-bar"><span class="translate-bar-info">${translateInfo}</span><div class="translate-bar-actions">${translateActions}</div></div>`:''}
          <div class="thread" id="chat-thread">${messagesPack.items?.length?messagesPack.items.map(renderChatBubble).join(''):'<div class="shell-note">选择好友后开始会话。<br>这里是本地会话。没有官方私信接口时，不会写入假的 TikTok 消息。</div>'}</div>
          <div class="composer">
            <div class="composer-toolbar">
              ${canSend?`<button class="tiny ghost composer-icon-btn" type="button" title="表情" aria-label="表情" onclick="app.openChatEmoji()" data-ui-icon="off">${composerIco('smile')}</button>
              <label class="tiny ghost composer-icon-btn" title="图片" aria-label="图片" data-ui-icon="off">${composerIco('image')}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onchange="app.sendChatImage(this)"></label>`:''}
            </div>
            <textarea id="chat-input" placeholder="${account?(account.login_status==='online'?'输入消息…':'请先检测/登录 TikTok'):'请先选择账号'}" ${canSend&&account&&account.login_status==='online'&&messagesPack.friend?'':'disabled'}></textarea>
            <div class="toolbar" style="margin:0;justify-content:flex-start;gap:8px">${canSend?`<button class="primary" onclick="app.sendChatMessageBit()" ${account&&account.login_status==='online'&&messagesPack.friend&&account.browser_profile_id?'':'disabled'}>发送</button><button class="ghost" onclick="app.chatAiReply()" ${account&&account.login_status==='online'&&messagesPack.friend?'':'disabled'}>AI回复</button>`:`<button class="primary" disabled>无发送权限</button>`}</div>
          </div>
        </section>
      </div>`;
      const thread=document.querySelector('#chat-thread'); if(thread)thread.scrollTop=thread.scrollHeight;
      if(this.chatTranslateOn&&messagesPack.items?.length) this.ensureChatTranslations(messagesPack.items);
    },
    async toggleChatTranslation(on){
      if(!this.chatFriendId){this.toast('请先选择好友',true);return}
      const enable=on!==false;
      if(enable===this.chatTranslateOn)return;
      this.chatTranslateOn=enable;
      if(!enable){this.refresh();return}
      this.toast('正在翻译当前会话…');
      await this.refresh();
    },
    _looksChinese(text){
      const s=String(text||'').trim();
      if(!s)return true;
      const han=(s.match(/[\u4e00-\u9fff]/g)||[]).length;
      return han/Math.max(1,s.length)>0.35;
    },
    async _translateChatMessage(msg){
      const text=String(msg.content||'').trim();
      if(!text) return text;
      if(this._looksChinese(text)) return text;
      let lastErr=null;
      for(let i=0;i<2;i++){
        try{
          const r=await this.api('/translate/instant',{method:'POST',body:JSON.stringify({text,to:'zh'})});
          return String(r.text||'').trim()||text;
        }catch(e){
          lastErr=e;
          if(i===0) await new Promise(res=>setTimeout(res,1200));
        }
      }
      throw lastErr||new Error('翻译失败');
    },
    async ensureChatTranslations(items){
      if(!this.chatTranslateOn||!this.chatFriendId)return;
      const list=(items||this._chatLastMessages||[]).filter(m=>m&&m.msg_type!=='image'&&String(m.content||'').trim());
      if(!list.length)return;
      const fid=Number(this.chatFriendId);
      this._chatTranslateCache=this._chatTranslateCache||{};
      this._chatTranslateCache[fid]=this._chatTranslateCache[fid]||{};
      const cache=this._chatTranslateCache[fid];
      const pending=list.filter(m=>!cache[m.id]);
      for(const m of pending){
        cache[m.id]='__loading__';
        this.updateChatBubbleTranslation(m.id);
      }
      for(const m of pending){
        if(Number(this.chatFriendId)!==fid||!this.chatTranslateOn) return;
        try{
          cache[m.id]=await this._translateChatMessage(m);
        }catch(e){
          cache[m.id]='[翻译失败] '+(e.message||'未知错误');
        }
        this.updateChatBubbleTranslation(m.id);
        if(pending.indexOf(m)<pending.length-1) await new Promise(res=>setTimeout(res,450));
      }
      if(Number(this.chatFriendId)===fid&&this.chatTranslateOn) this.toast('翻译完成');
    },
    updateChatBubbleTranslation(msgId){
      const fid=this.chatFriendId;
      const cache=this._chatTranslateCache?.[fid]?.[msgId];
      const wrap=document.querySelector(`#chat-thread .bubble-wrap[data-msg-id="${msgId}"]`);
      if(!wrap||!this.chatTranslateOn)return;
      let el=wrap.querySelector('.bubble-translation');
      if(!el){
        el=document.createElement('div');
        el.className='bubble-translation';
        wrap.appendChild(el);
      }
      el.classList.remove('loading','fail');
      const isOut=wrap.classList.contains('out');
      const msg=(this._chatLastMessages||[]).find(x=>String(x.id)===String(msgId));
      const origText=String(msg?.content||'');
      const bodyEl=wrap.querySelector('.bubble');
      const settleBody=(zhText)=>{
        if(!bodyEl||!zhText||isOut)return;
        // 保留气泡底部的时间行，只替换正文
        const timeEl=bodyEl.querySelector('.time');
        bodyEl.textContent=zhText;
        if(timeEl)bodyEl.appendChild(timeEl);
      };
      if(cache==='__loading__'){el.classList.add('loading');el.textContent='翻译中…';return}
      if(!cache){el.textContent='';if(bodyEl&&!isOut&&origText){const t=bodyEl.querySelector('.time');bodyEl.textContent=origText;if(t)bodyEl.appendChild(t)}return}
      if(String(cache).startsWith('[翻译失败]')){el.classList.add('fail');el.textContent=cache;return}
      // 翻译成功：对方消息主体显示中文，原文作为附注
      settleBody(String(cache));
      el.textContent=isOut?cache:origText;
    },
    setChatFriendTab(tab){this.chatFriendTab=tab||'dm';this.chatFriendId=null;this.chatTag='';if(tab!=='search')this.chatSearchResultsHtml='';this.refresh()},
    setChatTag(tag){this.chatTag=tag||'';this.chatFriendId=null;this.refresh()},
    openChatTranslate(){if(!this.chatFriendId){this.toast('请先选择好友',true);return}this.api(`/chat/messages?friendId=${this.chatFriendId}&pageSize=1`).then(pack=>{const f=pack.friend||{};this.modal('翻译设置',`<div class="form-grid">${this.selectRaw('translateIn','接收翻译',[['false','关闭'],['true','开启']],f.translate_in?'true':'false')}${this.selectRaw('translateOut','发送翻译',[['false','关闭'],['true','开启']],f.translate_out?'true':'false')}${this.selectRaw('translateSource','原文语言',[['auto','自动检测'],['zh','中文'],['en','英文'],['ja','日文'],['ko','韩文'],['es','西班牙文']],f.translate_source||'auto')}${this.selectRaw('translateTarget','目标语言',[['zh','中文'],['en','英文'],['ja','日文'],['ko','韩文'],['es','西班牙文']],f.translate_target||'zh')}<div class="field full"><div class="muted">只对当前好友生效。未配置翻译接口时不会假装翻译成功。也可点「自动检测语言」根据对方近期消息识别原文语言。</div></div><div class="action-bar"><button class="ghost tiny" type="button" onclick="app.autoCheckChatLang(true)">自动检测语言并填入</button></div></div>`,async d=>{await this.api(`/chat/friends/${this.chatFriendId}`,{method:'PATCH',body:JSON.stringify({translateIn:d.translateIn==='true',translateOut:d.translateOut==='true',translateSource:d.translateSource||'auto',translateTarget:d.translateTarget||'zh'})});this.toast('翻译设置已保存');this.closeModal();this.refresh()})}).catch(e=>this.toast(e.message,true))},
    async autoCheckChatLang(fromModal=false){
      if(!this.chatFriendId){this.toast('请先选择好友',true);return}
      this.toast('正在根据对方近期消息检测语言…');
      try{
        const r=await this.api(`/chat/friends/${this.chatFriendId}/auto-check-lang`,{method:'POST',body:JSON.stringify({apply:true})});
        const labels={zh:'中文',en:'英文',ja:'日文',ko:'韩文',es:'西班牙文',other:'其他'};
        const tip=`识别为 ${labels[r.language]||r.language}（${r.method==='ai'?'智能翻译':r.method==='local'?'本地特征':'检测'}）`;
        this.toast(r.note?`${tip} · ${r.note}`:tip);
        if(fromModal){
          const sel=document.querySelector('#modal-form [name=translateSource]');
          if(sel && r.language && r.language!=='other') sel.value=r.language;
        } else {
          this.refresh();
        }
      }catch(e){this.toast(e.message,true)}
    },
    async applyChatTranslate(){if(!this.canChatOps()){this.toast('当前角色无权修改翻译设置',true);return}if(!this.chatFriendId||!this.chatAccountId){this.toast('请先选择好友',true);return}const pack=await this.api(`/chat/friends?accountId=${this.chatAccountId}&pageSize=200`);const others=(pack.items||[]).filter(f=>Number(f.id)!==Number(this.chatFriendId));if(!others.length){this.toast('没有其他好友可应用',true);return}this.modal('应用到其他好友',`<div class="form-grid"><div class="field full"><div class="muted">把当前好友的收/发翻译设置复制到勾选的好友。</div></div><div class="field full"><label>好友</label><div class="chip-row">${others.map(f=>`<label class="chip"><input type="checkbox" class="apply-friend" value="${f.id}"> ${this.esc(f.nickname||f.username||f.friend_uid)}</label>`).join('')}</div></div></div>`,async()=>{const friendIds=[...document.querySelectorAll('.apply-friend:checked')].map(el=>Number(el.value));if(!friendIds.length)throw new Error('请至少选择一个好友');const r=await this.api(`/chat/friends/${this.chatFriendId}/apply-translate`,{method:'POST',body:JSON.stringify({friendIds})});this.toast(`已应用到 ${r.updated??r.applied??0} 个好友`);this.closeModal();this.refresh()})},
    async clearChatTranslate(){if(!this.canChatOps()){this.toast('当前角色无权修改翻译设置',true);return}if(!this.chatFriendId){this.toast('请先选择好友',true);return}if(!(await this.ask('取消当前好友的收信和发信翻译？')))return;try{await this.api(`/chat/friends/${this.chatFriendId}`,{method:'PATCH',body:JSON.stringify({clearTranslate:true})});this.toast('已取消翻译');this.refresh()}catch(e){this.toast(e.message,true)}},
    selectChatAccount(id){
      // 延迟执行，避免双击时两次 refresh 冲掉资料卡弹框
      clearTimeout(this._chatSelectTimer);
      const aid=Number(id);
      this._chatSelectTimer=setTimeout(()=>{
        if(Number(this.chatAccountId)===aid)return;
        this.chatAccountId=aid;
        this.chatFriendId=null;
        this.refresh();
      },260);
    },
    searchChatAccounts(){this.chatAccountKeyword=document.querySelector('.chat-account-search input')?.value||this.chatAccountKeyword||'';this.chatAccountPage=1;this.refresh()},
    /** 双击账号：弹出与「选择账号」同款 Card 资料卡（可关闭） */
    async openChatAccountCard(id){
      const aid=Number(id);
      if(!aid)return;
      clearTimeout(this._chatSelectTimer);
      this.chatAccountId=aid;
      try{
        const a=await this.api(`/accounts/${aid}`);
        if(!a||!a.id){this.toast('账号不存在或无权查看',true);return}
        const card=typeof this.accountPickTagHtml==='function'
          ?this.accountPickTagHtml(a,true,{readonly:true})
          :(typeof this.accountPairCardHtml==='function'?this.accountPairCardHtml(a):`<div class="shell-note">#${aid} ${this.esc(a.username||'')}</div>`);
        this.modal(
          '账号资料',
          `<div class="chat-account-card-modal">
            ${card}
            <button type="button" class="chat-account-card-close" onclick="app.closeModal()" aria-label="关闭" title="关闭">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>`,
          async()=>{},
          false,
          {hideSubmit:true, bare:true}
        );
      }catch(e){this.toast(e.message||'打开资料卡失败',true)}
    },
    selectChatFriend(id,accountId){this.chatFriendId=id;if(accountId)this.chatAccountId=Number(accountId);if(this.chatFriendTab==='search'){this.chatFriendTab='dm';this.chatSearchResultsHtml='';}this.refresh()},
    setChatFilter(filter){this.chatFilter=filter;this.refresh()},
    searchChatFriends(){
      // 定时刷新会重绘输入框，DOM 读不到时回退 state，避免把已输入的关键字冲成空。
      // 用 || 而非 ??：被重绘后的输入框值是空字符串，?? 不会回退。
      const el=document.querySelector('#chat-friend-search');
      this.chatKeyword=String(el?.value||this.chatKeyword||'').trim();
      this.refresh();
    },
    async runSeatTaskAndWait(action,extra={},onEnqueued=null){
      if(!(await this.ensureNodeOnline('客服坐席')))return null;
      const accountId=Number(extra.accountId||this.chatAccountId);
      if(!accountId){this.toast('请先选择账号',true);return null}
      const enq=await this.api('/chat/seat-tasks',{
        method:'POST',
        body:JSON.stringify({accountId,action,...extra}),
        timeoutMs:120000,
      });
      const itemId=Number(enq?.itemId||0);
      if(!itemId){this.toast(enq?.message||'入队失败',true);return null}
      if(typeof onEnqueued==='function'){try{onEnqueued(enq)}catch{}}
      const started=Date.now();
      while(Date.now()-started<180000){
        await new Promise(r=>setTimeout(r,2000));
        const st=await this.api(`/chat/seat-items/${itemId}`);
        const status=String(st?.status||'');
        if(status==='completed'||status==='failed'||status==='cancelled'||status==='paused'){
          return {...st, enq};
        }
        if(st?.errorMessage&&/等待|缺环境包|登录数据/.test(String(st.errorMessage))){
          this.toast(st.errorMessage,false,4000);
        }
      }
      this.toast('任务仍在服务器浏览器执行中，可稍后刷新查看',false,5000);
      return {status:'running',enq,itemId};
    },
    async chatDetectLogin(id){
      if(!this.canChatManage()){this.toast('当前角色无权检测登录',true);return}
      const accountId=Number(id||this.chatAccountId);
      if(!accountId){this.toast('请先选择账号',true);return}
      this.toast('已推送检测登录到服务器浏览器…');
      try{
        const r=await this.runSeatTaskAndWait('detect',{accountId});
        if(!r)return;
        const loggedIn=Boolean(r?.result?.loggedIn)||r?.loginStatus==='online';
        this.toast(r.status==='completed'?(loggedIn?'已登录 TikTok':'未登录'):(r.errorMessage||'检测未完成'),r.status!=='completed'||!loggedIn);
        this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    async chatAccountLogin(id){
      if(!this.canChatManage()){this.toast('当前角色无权登录客服账号',true);return}
      const accountId=Number(id||this.chatAccountId);
      if(!accountId){this.toast('请先选择账号',true);return}
      this.toast('已推送登录任务到服务器浏览器（EL）…');
      try{
        const r=await this.runSeatTaskAndWait('login',{accountId});
        if(!r)return;
        const ok=r.status==='completed'&&(r?.result?.loginOk||r?.loginStatus==='online');
        this.toast(ok?'登录成功':(r.errorMessage||'登录未完成'),!ok);
        if(ok){
          try{await this.chatConnect(accountId)}catch{/* connect 已在执行侧尝试 */}
        }
        this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    async chatAccountLogout(id){
      if(!this.canChatManage()){this.toast('当前角色无权退出客服账号',true);return}
      const accountId=Number(id||this.chatAccountId);
      if(!accountId){this.toast('请先选择账号',true);return}
      if(!(await this.ask('退出将关闭服务器浏览器环境并标记为未登录，是否继续？')))return;
      this.toast('已推送退出任务到服务器浏览器…');
      try{
        const r=await this.runSeatTaskAndWait('logout',{accountId});
        this.toast(r?.status==='completed'?'已退出':(r?.errorMessage||'退出未完成'),r?.status!=='completed');
        this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    async chatConnect(id){try{let autoTranslate=false,syncMessages=true;try{const st=await this.api('/settings');autoTranslate=st.translationOnReceive===true||st.translationMode==='basic'||st.translationMode==='ai'||st.translationMode==='normal';syncMessages=st.privateMessageSync!==false;this.messageSyncInterval=Number(st.messageSyncInterval||10);this.notificationInterval=Number(st.notificationInterval||1);this.notificationSound=st.notificationSound||this.notificationSound;this.notificationSync=st.notificationSync!==false}catch{}await this.api(`/chat/accounts/${id}/connect`,{method:'POST',body:JSON.stringify({autoTranslate,syncMessages})});this.toast('已登录客服聊天');this.chatAccountId=id;this.startChatSyncTimer();this.refresh()}catch(e){this.toast(e.message,true)}},
    startChatSyncTimer(){if(this._chatSyncTimer)clearInterval(this._chatSyncTimer);const mins=Math.min(60,Math.max(1,Number(this.notificationInterval||this.messageSyncInterval||1)||1));const sec=Math.min(300,Math.max(15,mins*60));this._chatSyncTimer=setInterval(()=>{if(this.view==='chat')this.refresh()},sec*1000)},
    async refreshChatDm(){
      if(!this.canChatManage()){this.toast('当前角色无权刷新私信',true);return}
      if(!this.chatAccountId){this.toast('请先选择账号',true);return}
      if(!(await this.ensureNodeOnline('私信同步')))return;
      this.toast('已推送私信列表同步到服务器浏览器…');
      try{
        const r=await this.runSeatTaskAndWait('dm_sync',{
          accountId:Number(this.chatAccountId),
          maxConversations:30,
          maxMessagesPerChat:10,
        });
        if(!r)return;
        const res=r.result||{};
        if(r.status==='completed'){
          this.toast(`私信列表同步完成：会话用户 ${res.friendsUpserted??res.conversations??'-'} · 消息 ${res.messagesUpserted??'-'}`);
        }else{
          this.toast(r.errorMessage||`私信同步结束：${r.status}`,true);
        }
        this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    async refreshChatFans(){
      if(!this.canChatManage()){this.toast('当前角色无权刷新粉丝',true);return}
      if(!this.chatAccountId){this.toast('请先选择账号',true);return}
      this.toast('已推送粉丝同步到服务器浏览器…');
      try{
        const r=await this.runSeatTaskAndWait('sync_fans',{accountId:Number(this.chatAccountId)});
        if(!r)return;
        const p=r.result?.progress||{};
        if(r.status==='completed'){
          this.toast(`粉丝同步完成：抓取 ${p.scraped??'-'} · 新增 ${p.added??'-'} / 更新 ${p.updated??'-'}`);
        }else{
          this.toast(r.errorMessage||`粉丝同步结束：${r.status}`,true);
        }
        this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    async refreshChatFollowing(){
      if(!this.canChatManage()){this.toast('当前角色无权刷新关注',true);return}
      if(!this.chatAccountId){this.toast('请先选择账号',true);return}
      this.toast('已推送关注同步到服务器浏览器…');
      try{
        const r=await this.runSeatTaskAndWait('sync_following',{accountId:Number(this.chatAccountId)});
        if(!r)return;
        const p=r.result?.progress||{};
        if(r.status==='completed'){
          this.toast(`关注同步完成：抓取 ${p.scraped??'-'} · 新增 ${p.added??'-'} / 更新 ${p.updated??'-'}`);
        }else{
          this.toast(r.errorMessage||`关注同步结束：${r.status}`,true);
        }
        this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    stopChatSyncTimer(){if(this._chatSyncTimer){clearInterval(this._chatSyncTimer);this._chatSyncTimer=null}},
    async chatDisconnect(id){try{await this.api(`/chat/accounts/${id}/disconnect`,{method:'POST'});this.toast('已退出客服聊天');this.refresh()}catch(e){this.toast(e.message,true)}},
    async batchChatConnect(){const all=await this.fetchAllChatAccounts('status=online');const ids=all.filter(a=>a.login_status==='online'&&a.browser_profile_id&&a.connection_status!=='online').map(a=>a.id);if(!ids.length){this.toast('没有可登录的账号（需已登录 TikTok 且绑定环境）',true);return}try{const r=await this.api('/chat/accounts/batch-connect',{method:'POST',body:JSON.stringify({accountIds:ids})});this.toast(`批量登录成功 ${r.connected}，失败 ${r.failed}`);this.refresh()}catch(e){this.toast(e.message,true)}},
    async batchChatDisconnect(){const all=await this.fetchAllChatAccounts();const ids=all.filter(a=>a.connection_status==='online').map(a=>a.id);if(!ids.length){this.toast('当前没有在线客服账号',true);return}if(!(await this.ask(`确定退出全部 ${ids.length} 个在线客服连接？`)))return;try{await this.api('/chat/accounts/batch-disconnect',{method:'POST',body:JSON.stringify({accountIds:ids})});this.toast('已批量退出');this.refresh()}catch(e){this.toast(e.message,true)}},
    async chatReadAll(){if(!this.chatAccountId){this.toast('请先选择客服账号',true);return}try{await this.api(`/chat/accounts/${this.chatAccountId}/read-all`,{method:'POST'});this.toast('全部已读');this.refresh()}catch(e){this.toast(e.message,true)}},
    async chatMenuReadAll(){
      try{
        const all=await this.fetchAllChatAccounts();
        const online=all.filter(a=>a.connection_status==='online');
        if(!online.length){this.toast('请先登录至少一个客服账号，再使用全部已读',true);return}
        if(this.chatAccountId && online.some(a=>Number(a.id)===Number(this.chatAccountId))){
          await this.chatReadAll();
          return;
        }
        if(online.length===1){
          this.chatAccountId=online[0].id;
          await this.chatReadAll();
          return;
        }
        this.modal('全部一键已读',`<div class="form-grid">${this.selectRaw('accountId','选择客服账号',online.map(a=>[a.id,a.username||('账号#'+a.id)]),this.chatAccountId||online[0].id)}<div class="field full"><div class="muted">将对所选账号的本地会话全部标为已读。</div></div></div>`,async d=>{
          this.chatAccountId=Number(d.accountId);
          await this.api(`/chat/accounts/${this.chatAccountId}/read-all`,{method:'POST'});
          this.toast('全部已读');
          this.closeModal();
          this.refresh();
        });
      }catch(e){this.toast(e.message,true)}
    },
    async chatMenuTranslate(){
      if(this.chatFriendId){await this.toggleChatTranslation(!this.chatTranslateOn);return}
      try{
        const all=await this.fetchAllChatAccounts();
        const online=all.filter(a=>a.connection_status==='online');
        if(!online.length){this.toast('请先登录客服并选择好友，再翻译',true);return}
        const accountId=this.chatAccountId && online.some(a=>Number(a.id)===Number(this.chatAccountId))?this.chatAccountId:online[0].id;
        this.chatAccountId=accountId;
        const friends=await this.api(`/chat/friends?accountId=${accountId}&pageSize=200`);
        const items=friends.items||[];
        if(!items.length){this.toast('当前账号还没有好友会话，请先发起聊天',true);this.refresh();return}
        this.modal('选择会话',`<div class="form-grid">${this.selectRaw('friendId','选择好友',items.map(f=>[f.id,(f.nickname||f.username||f.friend_uid)]),items[0].id)}<div class="field full"><div class="muted">选择好友后将自动识别语种并译为中文。</div></div></div>`,async d=>{
          this.chatFriendId=Number(d.friendId);
          this.closeModal();
          await this.toggleChatTranslation(true);
        });
      }catch(e){this.toast(e.message,true)}
    },
    async chatMenuAutoLang(){await this.chatMenuTranslate()},
    async chatMenuAiHosting(){
      if(this.chatAccountId){
        try{
          const all=await this.fetchAllChatAccounts();
          const account=all.find(a=>Number(a.id)===Number(this.chatAccountId));
          if(account?.connection_status==='online'){await this.bindAiHosting();return}
        }catch{}
      }
      try{
        const all=await this.fetchAllChatAccounts();
        const online=all.filter(a=>a.connection_status==='online');
        if(!online.length){this.toast('请先登录客服聊天，再开启 AI 托管',true);return}
        this.modal('AI 客服智能托管',`<div class="form-grid">${this.selectRaw('accountId','选择已登录客服',online.map(a=>[a.id,`${a.username||('账号#'+a.id)}${a.ai_hosting?'（已托管）':''}`]),online[0].id)}<div class="field full"><div class="muted">托管后对本系统本地消息自动回复，不会伪造 TikTok 投递。</div></div></div>`,async d=>{
          this.chatAccountId=Number(d.accountId);
          this.closeModal();
          this.refresh();
          setTimeout(()=>this.bindAiHosting(),80);
        });
      }catch(e){this.toast(e.message,true)}
    },
    addChatFriend(){if(!this.chatAccountId){this.toast('请先选择账号',true);return}this.modal('发起聊天',`<div class="form-grid">${this.field('friendUid','UID / 用户标识','','text',true)}${this.field('username','用户名（可选）')}${this.field('nickname','昵称（可选）')}${this.selectRaw('relation','关系',[['stranger','陌生人'],['follower','粉丝'],['friend','好友'],['mutual','互关']],'stranger')}${this.field('greeting','打招呼内容（可选）','','textarea')}</div>`,async d=>{d.accountId=Number(this.chatAccountId);const friend=await this.api('/chat/friends',{method:'POST',body:JSON.stringify(d)});this.toast('好友已添加');this.chatFriendId=friend.id;this.closeModal();this.refresh()})},
    /**
     * 语言标签：把 lang 码渲染成小徽标，列表里统一展示。
     * 未获取时显示灰色「语言?」，让客服一眼看出还没跑过「获取语言」。
     */
    chatLangTag(lang){
      const code=String(lang||'').trim().toLowerCase();
      const map={zh:'中文',en:'英语',ja:'日语',ko:'韩语',es:'西班牙语'};
      if(!code)return '<span class="chat-lang unknown" title="尚未获取语言，可在右侧点「获取语言」">语言?</span>';
      const label=map[code]||code.toUpperCase();
      return `<span class="chat-lang" title="对方语言：${this.esc(label)}">${this.esc(label)}</span>`;
    },
    searchChatUser(){this.setChatFriendTab('search');},
    async runChatUserSearch(passed){
      // 取值优先级：调用方直传 > state > DOM。
      // 定时刷新会重绘输入框（value 来自 state），DOM 可能已被换成一个空的新元素，
      // 所以 DOM 只能当最后兜底；state 由 oninput 实时维护，最可靠。
      // 空字符串要用 || 回退，?? 不会回退。
      const domEl=document.querySelector('#chat-search-keyword-inline')||document.querySelector('#chat-search-keyword');
      const inline=!!document.querySelector('#chat-search-keyword-inline');
      const box=document.querySelector(inline?'#chat-search-results-inline':'#chat-search-results');
      const fromPassed=String(passed==null?'':passed).trim();
      const fromState=String(this.chatSearchKeyword==null?'':this.chatSearchKeyword).trim();
      const fromDom=String(domEl&&domEl.value!=null?domEl.value:'').trim();
      const keyword=fromPassed||fromState||fromDom;
      this.chatSearchKeyword=keyword;
      if(!this.chatAccountId){this.toast('请先选择账号',true);return}
      if(!keyword){this.toast('请输入搜索词（至少 6 个字符，如 nikefans）',true);return}
      // 与后端一致：搜索词必须大于 5 个字符（按字符数，不是字节数）
      const kwLen=Array.from(keyword).length;
      if(kwLen<=5){this.toast(`搜索词必须大于 5 个字符（当前 ${kwLen} 个：「${keyword}」）`,true);return}
      if(!box&&!inline){this.toast('请先切换到搜索 Tab',true);return}
      if(!(await this.ensureNodeOnline('用户搜索')))return;
      // 每个账号独立一份搜索状态：搜索中显示占位板块，切换账号不串数据
      const aid=Number(this.chatAccountId);
      const st=this.chatSearchStateOf(aid);
      Object.assign(st,{loading:true,loaded:true,keyword,items:[],error:'',expireAt:0});
      if(box)box.innerHTML=this.chatSearchSkeletonHtml(keyword);
      try{
        // 每次搜索都重新跑任务；后端完成时会把结果按账号写入 Redis（有效期一天），下次搜索覆盖
        const r=await this.runSeatTaskAndWait('search_users',{
          accountId:aid,
          keyword,
          limit:40,
        });
        if(!r){st.loading=false;this.chatSearchRepaint();return}
        const res=r.result||{};
        if(r.status!=='completed'){
          Object.assign(st,{loading:false,error:r.errorMessage||'搜索失败',items:[]});
          this.chatSearchRepaint();
          return;
        }
        Object.assign(st,{
          loading:false,
          keyword,
          items:Array.isArray(res.items)?res.items:[],
          error:'',
          expireAt:Date.now()+86400000,
        });
        this.chatSearchRepaint();
      }catch(e){
        Object.assign(st,{loading:false,error:''});
        this.chatSearchRepaint();
        this.toast(e.message,true);
      }
    },
    /** 每个账号一份搜索状态（内存），与 Redis 里按账号独立的缓存对应 */
    chatSearchStateOf(aid){
      this._chatSearchState=this._chatSearchState||{};
      const k=Number(aid)||0;
      return this._chatSearchState[k]||(this._chatSearchState[k]={loading:false,cacheLoading:false,loaded:false,keyword:'',items:[],error:'',expireAt:0});
    },
    /** 数据占位板块：结果出来之前显示骨架屏，避免空白 */
    chatSearchSkeletonHtml(keyword){
      const row='<div class="search-skeleton-row"><span class="sk-avatar"></span><span class="sk-lines"><i></i><i></i></span></div>';
      return `<div class="search-skeleton"><div class="muted" style="padding:8px 12px;font-size:12px">${keyword?`正在服务器浏览器搜索「${this.esc(keyword)}」，请稍候…`:'正在加载搜索结果…'}</div>${row.repeat(6)}</div>`;
    },
    /** 当前账号的搜索面板：占位 / 错误 / 空 / 结果；过期（一天）后自动变空 */
    chatSearchPanelHtml(){
      const aid=Number(this.chatAccountId);
      if(!aid)return '<div class="muted" style="padding:12px;font-size:12px">请先选择账号</div>';
      const st=this.chatSearchStateOf(aid);
      if(st.expireAt&&Date.now()>st.expireAt){
        Object.assign(st,{items:[],keyword:'',error:'',expireAt:0,loaded:true});
      }
      if(!st.loaded&&!st.loading&&!st.cacheLoading){
        this.loadChatSearchCache(aid);
        return this.chatSearchSkeletonHtml('');
      }
      if(st.loading||st.cacheLoading)return this.chatSearchSkeletonHtml(st.loading?st.keyword:'');
      if(st.error)return `<div class="empty">${this.esc(st.error)}</div>`;
      if(!st.keyword&&!st.items.length)return '<div class="muted" style="padding:12px;font-size:12px">暂无搜索结果，输入关键词后点击搜索</div>';
      // 供点击某条结果时按索引取用
      this._chatSearchTmp={keyword:st.keyword,items:st.items,inline:true};
      return this.chatSearchHtml(st.keyword,st.items,true);
    },
    chatSearchRepaint(){
      const b=document.querySelector('#chat-search-results-inline');
      if(b)b.innerHTML=this.chatSearchPanelHtml();
    },
    /** 从 Redis 读取该账号上一次的搜索结果（一天内有效，过期为空） */
    async loadChatSearchCache(aid){
      const st=this.chatSearchStateOf(aid);
      if(st.cacheLoading||st.loading)return;
      st.cacheLoading=true;
      try{
        const r=await this.api(`/chat/search-cache?accountId=${Number(aid)}`);
        // 加载期间用户已发起新搜索：以新搜索为准，不覆盖
        if(st.loading)return;
        if(r&&r.cached){
          st.keyword=String(r.keyword||'');
          st.items=Array.isArray(r.items)?r.items:[];
          st.expireAt=r.expiresIn?Date.now()+Number(r.expiresIn)*1000:0;
          if(Number(this.chatAccountId)===Number(aid)&&st.keyword)this.chatSearchKeyword=st.keyword;
        }else{
          st.keyword='';st.items=[];st.expireAt=0;
        }
        st.error='';
      }catch(e){
        // 读缓存失败只当没有缓存，不打扰客服
      }finally{
        st.cacheLoading=false;
        st.loaded=true;
        this.chatSearchRepaint();
      }
    },
    async addSearchedUser(candidate){if(!this.canChatOps()){this.toast('当前角色无权加入会话',true);return}if(!candidate)return;const accountId=Number(this.chatAccountId);if(!accountId){this.toast('请先选择账号',true);return}try{const friend=await this.api('/chat/friends',{method:'POST',body:JSON.stringify({accountId,friendUid:candidate.friendUid,username:candidate.username||candidate.friendUid,nickname:candidate.nickname||'',relation:candidate.relation||'stranger'})});this.toast('已加入本地会话');this.chatAccountId=accountId;this.chatFriendId=friend.id;this.chatFriendTab='dm';this.chatSearchResultsHtml='';this.closeModal();this.refresh()}catch(e){this.toast(e.message,true)}},
    /**
     * 把临时搜索结果里的第 i 条加入本地会话。
     * 搜索结果本身不入库，只有用户主动点「加入会话」时才落库成 chat_users。
     */
    async addSearchedUserTmp(i){
      if(!this.canChatOps()){this.toast('当前角色无权加入会话',true);return}
      const tmp=this._chatSearchTmp;
      const u=tmp&&Array.isArray(tmp.items)?tmp.items[Number(i)]:null;
      if(!u){this.toast('搜索结果已过期，请重新搜索',true);return}
      const accountId=Number(this.chatAccountId);
      if(!accountId){this.toast('请先选择账号',true);return}
      if(!(await this.ask(`把 @${u.username} 加入本地会话？（只是本地会话记录，不会在 TikTok 上关注或发消息）`)))return;
      try{
        const friend=await this.api('/chat/friends',{method:'POST',body:JSON.stringify({
          accountId,
          // 搜索结果没有 UID，用用户名作为标识，避免后续去重时冲突
          friendUid:String(u.username||''),
          username:String(u.username||''),
          nickname:String(u.nickname||''),
          relation:'stranger',
        })});
        this.toast('已加入本地会话');
        this.chatAccountId=accountId;
        this.chatFriendId=friend.id;
        this.chatFriendTab='dm';
        this.chatSearchResultsHtml='';
        this._chatSearchTmp=null;
        this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    /** 搜索结果列表 HTML：整行可点，点击直接进入该用户的私信（与关注列表一致） */
    chatSearchHtml(keyword,items,inline){
      const rows=items.map((u,i)=>{
        const active=u.friendId&&Number(u.friendId)===Number(this.chatFriendId);
        const bg=active?' style="background:var(--brand-soft)"':'';
        return inline
          ?`<div class="search-hit"${bg} title="点击直接发私信" onclick="app.openSearchedUserChat(${i})"><div class="chat-avatar">${this.esc(((u.nickname||u.username||'?')[0]||'?').toUpperCase())}</div><div class="chat-meta"><b class="chat-name">${this.esc(u.nickname||u.username||'-')}</b>${this.chatLangTag(u.lang)}<small>@${this.esc(u.username)}${u.followersText?` · ${this.esc(u.followersText)}`:''}</small></div></div>`
          :`<tr${bg} style="cursor:pointer" onclick="app.openSearchedUserChat(${i})"><td>${this.esc(u.nickname||u.username||'-')} ${this.chatLangTag(u.lang)}</td><td>@${this.esc(u.username)}</td><td>${this.esc(u.followersText||'-')}</td></tr>`;
      }).join('');
      return `${rows?(inline?rows:`<div class="table-container"><table><thead><tr><th>用户</th><th>用户名</th><th>粉丝</th></tr></thead><tbody>${rows}</tbody></table></div>`):`<div class="empty">TikTok 没有返回「${this.esc(keyword)}」的用户结果</div>`}<div class="muted" style="margin-top:8px;font-size:12px">点击用户即可直接发私信 · 临时结果 ${items.length} 条（下次搜索会覆盖）</div>`;
    },
    /**
     * 点击搜索结果：不弹确认、不跳转 Tab。
     * 后台静默建立本地会话记录（已存在则复用），选中后右侧直接出现聊天框，发送走和关注一样的私信任务。
     */
    async openSearchedUserChat(i){
      if(!this.canChatOps()){this.toast('当前角色无权发私信',true);return}
      const tmp=this._chatSearchTmp;
      const u=tmp&&Array.isArray(tmp.items)?tmp.items[Number(i)]:null;
      if(!u){this.toast('搜索结果已过期，请重新搜索',true);return}
      const accountId=Number(this.chatAccountId);
      if(!accountId){this.toast('请先选择账号',true);return}
      try{
        let friendId=Number(u.friendId||0);
        if(!friendId){
          const friend=await this.api('/chat/friends',{method:'POST',body:JSON.stringify({
            accountId,
            friendUid:String(u.username||''),
            username:String(u.username||''),
            nickname:String(u.nickname||''),
            relation:'stranger',
          })});
          friendId=Number(friend&&friend.id||0);
          if(!friendId)throw new Error('建立会话失败');
          u.friendId=friendId;
        }
        this.chatFriendId=friendId;
        // 留在搜索 Tab，刷新高亮后重绘
        this.chatSearchResultsHtml=this.chatSearchHtml(tmp.keyword,tmp.items,tmp.inline!==false);
        this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    async showChatAccountStats(){if(!this.chatAccountId){this.toast('请先选择账号',true);return}try{const r=await this.api(`/chat/accounts/${this.chatAccountId}/stats`);const p=r.profile||{};this.modal('账号统计',`<div class="data-summary"><div><small>账号</small><b>${this.esc(r.username)}</b></div><div><small>粉丝</small><b>${p.followers_count??'-'}</b></div><div><small>关注</small><b>${p.following_count??'-'}</b></div><div><small>获赞</small><b>${p.likes_count??'-'}</b></div><div><small>本地好友</small><b>${r.friends?.total||0}</b></div><div><small>未读</small><b>${r.friends?.unread||0}</b></div></div><div class="data-meta">主页上次同步：${this.esc(p.last_synced_at||'尚未同步')}</div>`,()=>{},false,{hideSubmit:true}) }catch(e){this.toast(e.message,true)}},
    async sendChatMessage(){const content=document.querySelector('#chat-input')?.value?.trim();if(!content){this.toast('请输入消息',true);return}if(!this.chatFriendId){this.toast('请选择好友',true);return}try{await this.api('/chat/messages',{method:'POST',body:JSON.stringify({friendId:Number(this.chatFriendId),content})});document.querySelector('#chat-input').value='';this.refresh()}catch(e){this.toast(e.message,true)}},
    async sendChatMessageBit(){
      const content=document.querySelector('#chat-input')?.value?.trim();
      if(!content){this.toast('请输入消息',true);return}
      if(!this.chatFriendId){this.toast('请选择好友',true);return}
      if(!this.chatAccountId){this.toast('请先选择账号',true);return}
      if(!(await this.ask('将通过服务器浏览器（EL）向该好友发送私信，是否继续？')))return;
      this.toast('已推送发信任务到服务器浏览器…');
      try{
        const r=await this.runSeatTaskAndWait('send',{
          accountId:Number(this.chatAccountId),
          friendId:Number(this.chatFriendId),
          content,
        },()=>{
          // 入队即清空输入框并刷新：这条消息已入库，显示为「同步中」
          const inp=document.querySelector('#chat-input');if(inp)inp.value='';
          this.refresh();
        });
        if(!r)return;
        if(r.status==='completed'){
          this.toast('发送成功，已同步');
        }else{
          this.toast(r.errorMessage||'发送失败',true);
        }
        this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    /**
     * 重发失败消息：后端把该消息对应的坐席分任务重置为「待执行」，
     * 服务器浏览器队列会重新领取并发送，不需要新建消息。
     */
    async resendChatMessage(recordId){
      if(!this.canChatOps()){this.toast('当前角色无权重发',true);return}
      const id=Number(recordId||0);
      if(!id){this.toast('消息 id 无效',true);return}
      if(!(await this.ask('把这条消息的发送任务重置为待执行，由服务器浏览器重新发送？')))return;
      try{
        const r=await this.api('/chat/messages/resend',{method:'POST',body:JSON.stringify({recordId:id})});
        this.toast(r?.message||'已重置发送任务，等待服务器浏览器重新发送');
        this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    async chatAiReply(){
      if(!this.chatFriendId){this.toast('请选择好友',true);return}
      if(!this.canPermission('chat.send')){this.toast('当前角色无发送权限',true);return}
      this.toast('AI 正在生成回复…');
      try{
        const r=await this.api('/chat/messages/ai-reply',{method:'POST',body:JSON.stringify({friendId:Number(this.chatFriendId)})});
        const input=document.querySelector('#chat-input');
        if(input){
          input.value=String(r.reply||'').trim();
          input.focus();
        }
        this.toast(r.agentName?`已生成回复（${r.agentName}）`:'已生成回复，可编辑后发送');
      }catch(e){this.toast(e.message,true)}
    },
    /**
     * 获取语言：走服务器浏览器坐席任务，打开对方主页读简介判断语种。
     * 判断不出时后端按默认英语落库。
     */
    async fetchChatFriendLang(){
      if(!this.chatFriendId){this.toast('请先选择好友',true);return}
      if(!this.chatAccountId){this.toast('请先选择账号',true);return}
      if(!(await this.ask('将通过服务器浏览器打开对方主页判断语种，是否继续？')))return;
      this.toast('已推送获取语言任务到服务器浏览器…');
      try{
        const r=await this.runSeatTaskAndWait('fetch_lang',{
          accountId:Number(this.chatAccountId),
          friendId:Number(this.chatFriendId),
        });
        if(!r)return;
        const res=r.result||{};
        if(r.status==='completed'){
          const lang=String(res.lang||'en');
          const label={zh:'中文',en:'英语',ja:'日语',ko:'韩语',es:'西班牙语'}[lang]||lang;
          this.toast(res.fallback?`未能判断语种，已按默认${label}处理`:`已识别对方语种：${label}`,Boolean(res.fallback));
        }else{
          this.toast(r.errorMessage||'获取语言失败',true);
        }
        this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    setChatScriptGroup(id){this.scriptGroupId=id||'';this.refresh()},
    useTemplate(content){if(this.dmTemplateEnabled===false){this.toast('设置中「启用私信话术」已关闭',true);return}const el=document.querySelector('#chat-input');if(!el||el.disabled){this.toast('请先登录客服并选择好友',true);return}el.value=content;el.focus()},
    async togglePinFriend(){if(!this.canChatOps()){this.toast('当前角色无权置顶会话',true);return}if(!this.chatFriendId)return;try{const pack=await this.api(`/chat/messages?friendId=${this.chatFriendId}&pageSize=1`);const pinned=!pack.friend?.is_pinned;if(!(await this.ask(pinned?'置顶仅作用于本系统会话列表，不会同步到 TikTok 收件箱。继续？':'取消本系统置顶？')))return;await this.api(`/chat/friends/${this.chatFriendId}`,{method:'PATCH',body:JSON.stringify({isPinned:pinned})});this.toast(pinned?'已置顶（仅本地）':'已取消置顶');this.refresh()}catch(e){this.toast(e.message,true)}},
    async blockFriend(){if(!this.canChatOps()){this.toast('当前角色无权拉黑会话',true);return}if(!this.chatFriendId)return;const pack=await this.api(`/chat/messages?friendId=${this.chatFriendId}&pageSize=1`);const blocked=pack.friend?.relation==='blocked';if(blocked){if(!(await this.ask('取消本系统拉黑标记？（不会操作 TikTok 拉黑状态）')))return;try{await this.api(`/chat/friends/${this.chatFriendId}`,{method:'PATCH',body:JSON.stringify({relation:'stranger'})});this.toast('已取消拉黑（仅本地）');this.refresh()}catch(e){this.toast(e.message,true)}return}if(!(await this.ask('拉黑仅更新本系统会话：之后不能再发本地消息，也不会调用 TikTok 拉黑接口。继续？')))return;try{await this.api(`/chat/friends/${this.chatFriendId}`,{method:'PATCH',body:JSON.stringify({relation:'blocked'})});this.toast('已拉黑（仅本地）');this.refresh()}catch(e){this.toast(e.message,true)}},
    async deleteChatFriend(){
      if(!this.canChatManage()){this.toast('当前角色无权删除会话',true);return}
      if(!this.chatFriendId){this.toast('请先选择好友',true);return}
      if(!(await this.ask('删除该本地会话及全部聊天记录？此操作不可恢复，不会删除 TikTok 上的私信。','error')))return;
      const fid=Number(this.chatFriendId);
      try{
        await this.api(`/chat/friends/${fid}`,{method:'DELETE'});
        if(this._chatTranslateCache) delete this._chatTranslateCache[fid];
        this.chatFriendId=null;
        this.toast('会话已删除');
        this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    async writeLocalTestInbound(){if(!this.chatFriendId)return;if(!(await this.ask('只会写入本系统本地入站消息，用于测试 AI 回复，不会从 TikTok 拉取。继续？')))return;const content=prompt('测试消息内容');if(!content)return;try{await this.api('/chat/messages/simulate-in',{method:'POST',body:JSON.stringify({friendId:Number(this.chatFriendId),content})});this.toast('已写入本地测试消息');this.refresh()}catch(e){this.toast(e.message,true)}},
    async simulateInbound(){return this.writeLocalTestInbound()},
    async bindAiHosting(){
      if(!this.canChatManage()){this.toast('当前角色无权管理 AI 托管',true);return}
      if(!this.chatAccountId){this.toast('请先选择账号',true);return}
      const pack=await this.api(`/chat/accounts?page=1&pageSize=1&includeId=${Number(this.chatAccountId)}`);
      const account=pack.selected||(pack.items||[]).find(a=>Number(a.id)===Number(this.chatAccountId));
      if(!account){this.toast('账号不存在或无权访问',true);return}
      if(account.connection_status!=='online'){this.toast('请先登录客服聊天',true);return}
      if(account.ai_hosting){
        try{await this.api(`/chat/accounts/${this.chatAccountId}/ai-hosting`,{method:'POST',body:JSON.stringify({enabled:false})});this.toast('已关闭 AI 托管');this.refresh()}catch(e){this.toast(e.message,true)}
        return;
      }
      const agents=(await this.api('/agents')).filter(a=>a.enabled);
      if(!agents.length){this.toast('请先在 AI智能体页创建并启用智能体',true);return}
      this.modal('开启 AI 托管',`<div class="form-grid">${this.select('agentId','绑定智能体',agents,account.agent_id||agents[0].id)}${this.selectRaw('autoTranslate','收信自动翻译',[['false','关闭'],['true','开启']],account.auto_translate?'true':'false')}<div class="field full"><div class="muted">托管后，对本系统收到的本地消息（含「写入本地测试消息」）由智能体自动回复到本地会话。不会伪造 TikTok 平台投递成功。</div></div></div>`,async d=>{
        await this.api(`/chat/accounts/${this.chatAccountId}/ai-hosting`,{method:'POST',body:JSON.stringify({enabled:true,agentId:Number(d.agentId),autoTranslate:d.autoTranslate==='true'})});
        this.toast('已开启 AI 托管');this.closeModal();this.refresh();
      });
    },
    async editFriendTags(){if(!this.canChatOps()){this.toast('当前角色无权编辑好友标签',true);return}if(!this.chatFriendId)return;const [pack,customTags]=await Promise.all([this.api(`/chat/messages?friendId=${this.chatFriendId}&pageSize=1`),this.api('/chat/tags')]);const current=new Set(pack.friend?.tags||[]);const chips=(customTags||[]).map(t=>`<label class="chip"><input type="checkbox" class="friend-tag-check" data-tag="${this.esc(t.name)}" ${current.has(t.name)?'checked':''}> ${this.esc(t.name)}</label>`).join('');this.modal('好友标签',`<div class="form-grid"><div class="field full"><label>预设标签</label><div class="chip-row">${chips||'<span class="muted">暂无预设，可先点左侧「管理」添加</span>'}</div></div>${this.field('tags','额外标签，逗号分隔',[...current].filter(t=>!(customTags||[]).some(c=>c.name===t)).join(','))}<div class="field full"><div class="muted">保存后出现在左侧，可按标签筛选。这是本地标签。</div></div></div>`,async d=>{const picked=[...document.querySelectorAll('.friend-tag-check:checked')].map(el=>el.getAttribute('data-tag')).filter(Boolean);const extra=String(d.tags||'').split(/[,，]/).map(x=>x.trim()).filter(Boolean);const tags=[...new Set([...picked,...extra])];await this.api(`/chat/friends/${this.chatFriendId}`,{method:'PATCH',body:JSON.stringify({tags})});this.toast('标签已保存');this.closeModal();this.refresh()});},
    async manageChatTags(){if(!this.canPermission('chat.manage')&&!this.canPermission('chat.send')){this.toast('当前角色无权管理标签',true);return}const tags=await this.api('/chat/tags');this.modal('管理自定义标签',`<div class="form-grid">${this.field('name','新标签名称')}${this.field('color','颜色（可选）','')}<div class="field full"><div class="action-bar"><button class="primary tiny" type="button" onclick="app.addChatTagFromModal()">添加标签</button></div></div><div class="field full"><div class="muted">标签供好友筛选使用，删除时会从好友上移除该标签名。也可只删除下方已有标签。</div></div><div class="field full">${(tags||[]).length?`<table><thead><tr><th>名称</th><th></th></tr></thead><tbody>${tags.map(t=>`<tr><td>${this.esc(t.name)}</td><td><button class="tiny danger" type="button" onclick="app.deleteChatTag(${t.id})">删除</button></td></tr>`).join('')}</tbody></table>`:'<div class="shell-note">还没有自定义标签</div>'}</div></div>`,async()=>{},false,{hideSubmit:true});},async addChatTagFromModal(){const name=document.querySelector('#modal-form [name=name]')?.value?.trim();const color=document.querySelector('#modal-form [name=color]')?.value?.trim()||'';if(!name){this.toast('请填写标签名称',true);return}try{await this.api('/chat/tags',{method:'POST',body:JSON.stringify({name,color})});this.toast('标签已添加');this.closeModal();this.refresh()}catch(e){this.toast(e.message,true)}},
    async deleteChatTag(id){if(!(await this.ask('删除该标签？好友上的同名标签也会去掉。')))return;try{await this.api('/chat/tags/'+id,{method:'DELETE'});this.toast('标签已删除');this.closeModal();this.refresh()}catch(e){this.toast(e.message,true)}},
    openChatEmoji(){const input=document.querySelector('#chat-input');if(!input||input.disabled){this.toast('请先登录客服并选择好友',true);return}const emojis=(this.meta?.chatEmojis&&this.meta.chatEmojis.length)?this.meta.chatEmojis:['😀','😂','❤️','👍','🙏','🔥','🎉','😭','😍','🤝','✨','😎'];this.modal('插入表情',`<div class="chip-row">${emojis.map(e=>`<button type="button" class="tiny" onclick="app.insertChatText('${e}')">${e}</button>`).join('')}</div>`,async()=>{});document.querySelector('#modal-form button[type=submit]')?.remove()},
    insertChatText(text){const input=document.querySelector('#chat-input');if(!input||input.disabled){this.toast('请先登录客服并选择好友',true);return}input.value=(input.value||'')+text;input.focus();this.closeModal()},
    async sendChatImage(input){const file=input?.files?.[0];if(input)input.value='';if(!file)return;if(!this.canPermission('chat.send')){this.toast('当前角色无发送权限',true);return}if(!this.chatFriendId){this.toast('请选择好友',true);return}if(!this.chatAccountId){this.toast('请先选择客服账号',true);return}try{const fd=new FormData();fd.append('files',file);const uploaded=await this.api('/uploads/images',{method:'POST',body:fd});const url=uploaded.items?.[0]?.url;if(!url)throw new Error('上传没有返回地址');await this.api('/chat/messages',{method:'POST',body:JSON.stringify({friendId:Number(this.chatFriendId),content:url,msgType:'image'})});this.toast('图片已写入会话');this.refresh()}catch(e){this.toast(e.message,true)}},
    async batchChatDisconnectSelected(){const ids=this.selectedAccountIds();if(!ids.length){this.toast('请先勾选账号',true);return}if(!(await this.ask(`确定退出选中的 ${ids.length} 个客服连接？`)))return;try{const r=await this.api('/chat/accounts/batch-disconnect',{method:'POST',body:JSON.stringify({accountIds:ids})});this.toast(`已退出 ${r.closed??ids.length} 个客服`);this.refresh()}catch(e){this.toast(e.message,true)}},
    async batchSyncMessages(enable){const ids=this.selectedAccountIds();if(!ids.length){this.toast('请先勾选账号',true);return}if(!(await this.ask(enable?'仅开启本系统「同步标记」，不会从 TikTok 拉取私信。继续？':'取消本系统同步标记？')))return;try{const r=await this.api('/chat/accounts/batch-sync',{method:'POST',body:JSON.stringify({accountIds:ids,syncMessages:!!enable})});this.toast(enable?`已开启同步标记 ${r.updated}`:`已取消同步标记 ${r.updated}`);this.refresh()}catch(e){this.toast(e.message,true)}},
    async dedupeUids(){if(!this.uidGroupId){this.toast('请选择分组',true);return}if(!(await this.ask('将删除本组重复 UID，只保留最早一条。继续？')))return;try{const r=await this.api('/uids/dedupe',{method:'POST',body:JSON.stringify({groupId:Number(this.uidGroupId)})});this.toast(r.removed?`已去掉 ${r.removed} 条重复`:'没有重复 UID',!r.removed);this.refresh()}catch(e){this.toast(e.message,true)}},
    async deleteUidRow(id,uid){if(!(this.canPermission('chat.manage')||this.canPermission('publish.mass'))){this.toast('当前角色无权删除 UID',true);return}if(!(await this.ask(`删除 UID「${uid||id}」？`)))return;try{await this.api('/uids/'+id,{method:'DELETE'});this.toast('已删除');this.refresh()}catch(e){this.toast(e.message,true)}},
    editUidGroup(id){if(!this.canPermission('group.manage')){this.toast('当前角色无权管理分组',true);return}const g=(this.uidGroups||[]).find(x=>Number(x.id)===Number(id));if(!g){this.toast('分组不存在，请刷新',true);return}this.groupModal('uid',g)},
  };
  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages["chat"] = true;
})();
