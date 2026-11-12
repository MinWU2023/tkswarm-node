(function () {
  if (!window.app) throw new Error('app-core must load before pages/registerEnvs.js');
  const __methods = {
    canRegisterEnvs(){
      if(!this.authEnabled)return true;
      return this.canAnyPermission('account.view','account.create','account.update');
    },
    canEditRegisterEnvs(){
      if(!this.authEnabled)return true;
      return this.canAnyPermission('account.create','account.update');
    },
    async renderRegisterEnvs(opts={}){
      if(!this.canRegisterEnvs())return this.renderPageDenied('当前角色无权查看注册环境');
      const still=typeof opts.still==='function'?opts.still:()=>this.view==='registerEnvs';
      document.querySelector('#content')?.classList.remove('chat-mode');
      const kw=encodeURIComponent(this.registerEnvKeyword||'');
      const st=encodeURIComponent(this.registerEnvStatus||'');
      let d;
      try{
        d=await this.api(`/register-envs?page=${this.registerEnvPage||1}&pageSize=20&keyword=${kw}&status=${st}`);
      }catch(e){
        const host=document.querySelector('#content');
        if(host)host.innerHTML=`<div class="panel"><div class="empty">加载注册环境失败：${this.esc(e.message||'')}</div></div>`;
        return;
      }
      if(!still())return;
      const content=document.querySelector('#content');
      const headHtml=content?.querySelector('.page-head')?.outerHTML||(typeof this.pageHead==='function'?this.pageHead('registerEnvs'):'')||'';
      const canEdit=this.canEditRegisterEnvs();
      content.innerHTML=`${headHtml}<div class="panel list-panel">
        <div class="account-toolbar">
          <div class="action-buttons">
            ${canEdit?'<button class="primary" onclick="app.registerEnvModal()">新增注册环境</button>':''}
            <button class="ghost" onclick="app.refresh()">刷新</button>
          </div>
          <div class="search-bar">
            <input id="register-env-search" class="input" placeholder="搜索名称 / 账号 / 环境ID" value="${this.esc(this.registerEnvKeyword||'')}" onkeydown="if(event.key==='Enter')app.searchRegisterEnvs()">
            <select id="register-env-status"><option value="">全部状态</option><option value="draft" ${this.registerEnvStatus==='draft'?'selected':''}>草稿</option><option value="published" ${this.registerEnvStatus==='published'?'selected':''}>已发布</option></select>
            <button class="primary" onclick="app.searchRegisterEnvs()">查询</button>
            <button class="ghost" type="button" onclick="app.resetRegisterEnvFilters()">重置</button>
          </div>
        </div>
        <div class="table-container">${this.registerEnvTable(d.items||[])}</div>
        ${UI.pager(d,'registerEnvPage')}
      </div>`;
    },
    registerEnvTable(rows){
      if(!rows.length)return '<div class="empty">暂无注册环境，点「新增注册环境」创建</div>';
      const canEdit=this.canEditRegisterEnvs();
      const backendLabel=b=>b==='bit'?'比特浏览器':'自研浏览器';
      return `<table class="table"><thead><tr><th>名称</th><th>代理</th><th>浏览器</th><th>环境ID</th><th>账号名称</th><th>密码</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows.map(r=>{
        const published=r.status==='published';
        const proxy=r.proxy_host?`${this.esc(r.proxy_name||'')} ${this.esc(r.proxy_host)}:${this.esc(r.proxy_port)}`:'<span class="muted">代理已不存在</span>';
        const pid=String(r.browser_profile_id||'');
        return `<tr>
          <td>${this.esc(r.name||'')}</td>
          <td>${proxy}</td>
          <td>${backendLabel(r.browser_backend)}</td>
          <td>${pid?this.esc(pid.slice(0,12))+(pid.length>12?'…':''):'<span class="muted">未创建</span>'}</td>
          <td>${this.esc(r.account_username||'')||'<span class="muted">未填写</span>'}${r.account_id?` <span class="muted">#${this.esc(r.account_id)}</span>`:''}</td>
          <td>${Number(r.has_password)?'已填':'<span class="muted">未填</span>'}</td>
          <td>${published?'<span class="badge online">已发布</span>':'<span class="badge draft">草稿</span>'}</td>
          <td><div class="action-buttons">
            ${canEdit&&!published?`<button class="ghost tiny" onclick="app.openRegisterEnv(${r.id})">打开环境</button>`:''}
            ${canEdit&&!published?`<button class="ghost tiny" onclick="app.registerEnvModal(${r.id})">编辑</button>`:''}
            ${canEdit&&!published?`<button class="primary tiny" onclick="app.publishRegisterEnv(${r.id})">发布</button>`:''}
            ${canEdit?`<button class="ghost tiny danger" onclick="app.deleteRegisterEnv(${r.id})">删除</button>`:''}
          </div></td>
        </tr>`;
      }).join('')}</tbody></table>`;
    },
    searchRegisterEnvs(){
      this.registerEnvKeyword=document.querySelector('#register-env-search')?.value?.trim()||'';
      this.registerEnvStatus=document.querySelector('#register-env-status')?.value||'';
      this.registerEnvPage=1;
      this.refresh();
    },
    resetRegisterEnvFilters(){this.registerEnvKeyword='';this.registerEnvStatus='';this.registerEnvPage=1;this.refresh()},
    async registerEnvModal(id){
      if(!this.canEditRegisterEnvs()){this.toast('当前角色无权编辑注册环境',true);return}
      let x={};
      try{
        if(id)x=await this.api(`/register-envs/${id}`);
        const pd=await this.api('/proxies?page=1&pageSize=500');
        const proxies=(pd.items||[]).map(p=>({id:p.id,name:`${p.name||''} ${p.host||''}:${p.port||''}${p.country?' · '+p.country:''}`.trim()}));
        if(!proxies.length){this.toast('还没有可用代理，请先到代理IP页添加',true);return}
        const hasEnv=!!String(x.browser_profile_id||'').trim();
        const backendField=hasEnv
          ?`<div class="field"><label>浏览器</label><div class="muted">环境已创建（${x.browser_backend==='bit'?'比特浏览器':'自研浏览器'}），不能再切换</div><input type="hidden" name="browserBackend" value="${this.esc(x.browser_backend||'tkswarm')}"></div>`
          :this.selectRaw('browserBackend','浏览器',[['tkswarm','自研浏览器'],['bit','比特浏览器']],x.browser_backend||'tkswarm');
        const proxyHint=hasEnv?'<div class="field full"><div class="muted">修改代理后，下次「打开环境」会把新代理写入已创建的环境。</div></div>':'';
        this.modal(id?'编辑注册环境':'新增注册环境',`<div class="form-grid">
          ${this.field('name','环境名称',x.name||'')}
          ${this.select('proxyId','代理',proxies,x.proxy_id)}
          ${backendField}
          ${proxyHint}
          ${this.field('username','账号名称',x.account_username||'')}
          ${this.field('nickname','昵称',x.account_nickname||'')}
          ${this.field('password','账号密码','','password')}
          ${this.field('totpSecret','2FA 密钥（可空）','','password')}
          ${this.field('notes','备注',x.notes||'','textarea')}
          <div class="field full"><div class="muted">${id?'密码 / 2FA 留空表示不修改。':''}保存后点「打开环境」会按所选代理新建并打开浏览器；在里面完成注册后，点「发布」生成正式账号。</div></div>
        </div>`,async d=>{
          if(!d.proxyId){this.toast('请选择代理',true);return}
          const body={name:d.name,proxyId:Number(d.proxyId),browserBackend:d.browserBackend,username:d.username,nickname:d.nickname,password:d.password,totpSecret:d.totpSecret,notes:d.notes};
          if(id)await this.api(`/register-envs/${id}`,{method:'PUT',body:JSON.stringify(body)});
          else await this.api('/register-envs',{method:'POST',body:JSON.stringify(body)});
          this.toast(id?'注册环境已更新':'注册环境已创建');
          this.closeModal();
          this.refresh();
        });
      }catch(e){this.toast(e.message,true)}
    },
    async openRegisterEnv(id){
      if(!this.canEditRegisterEnvs()){this.toast('当前角色无权操作',true);return}
      // 打开要经历：同步代理 → 探测出口 IP → 启动窗口，常需 15~45 秒；
      // 只弹 2 秒 toast 会让人以为点击没反应而反复点，所以用常驻加载条并防重复点击
      this._openingRegisterEnvs=this._openingRegisterEnvs||new Set();
      if(this._openingRegisterEnvs.has(id)){this.toast('该环境正在打开中，请稍候…','info');return}
      this._openingRegisterEnvs.add(id);
      const task=window.UI&&UI.notifyLoading?UI.notifyLoading({title:'正在打开注册环境',message:'同步代理并启动浏览器，通常需要 15~45 秒…',key:'register-env-open-'+id}):null;
      if(!task)this.toast('正在按所选代理准备并打开环境…');
      try{
        const r=await this.api(`/browser/register-envs/${id}/open`,{method:'POST',body:JSON.stringify({}),timeoutMs:120000});
        const msg='浏览器环境已打开'+(r?.profileId?`（${String(r.profileId).slice(0,8)}…）`:'');
        if(task)task.success(msg,3000);else this.toast(msg);
        this.refresh();
      }catch(e){
        const msg='打开环境失败：'+(e.message||'未知错误');
        if(task)task.error(msg,8000);else this.toast(msg,true,8000);
      }finally{this._openingRegisterEnvs.delete(id)}
    },
    async publishRegisterEnv(id){
      if(!this.canEditRegisterEnvs()){this.toast('当前角色无权操作',true);return}
      if(!(await this.ask('发布后将用填写的账号信息创建正式账号，并关联该环境与代理，发布后不可再编辑。是否继续？')))return;
      try{
        const r=await this.api(`/browser/register-envs/${id}/publish`,{method:'POST',body:JSON.stringify({}),timeoutMs:120000});
        this.toast(r?.accountId?`已发布为正式账号 #${r.accountId}`:'已发布');
        this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    async deleteRegisterEnv(id){
      if(!this.canEditRegisterEnvs()){this.toast('当前角色无权操作',true);return}
      if(!(await this.ask('确定删除该注册环境记录吗？已创建的浏览器环境不会被删除，已发布生成的正式账号也不受影响。','error')))return;
      try{
        await this.api(`/register-envs/${id}`,{method:'DELETE'});
        this.toast('已删除');
        this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
  };
  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages.registerEnvs = true;
})();
