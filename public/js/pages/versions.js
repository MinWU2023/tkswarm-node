(function () {
  if (!window.app) throw new Error('app-core must load before pages/versions.js');
  const __methods = {
    canViewVersions(){return this.canPermission('system.versions')||this.canPermission('system.view')||this.canPermission('rbac.manage')},
    canEditVersions(){return this.canPermission('system.versions')||this.canPermission('rbac.manage')},
    async renderVersions(){
      const host=document.querySelector('#content');
      if(!host)return;
      if(!this.canViewVersions()){
        host.innerHTML=`<div class="panel"><div class="empty">当前角色无权管理客户端版本</div></div>`;
        return;
      }
      const canEdit=this.canEditVersions();
      try{
        const rows=await this.api('/client-versions');
        const list=Array.isArray(rows)?rows:[];
        const kw=(this.versionKeyword||'').trim().toLowerCase();
        const ch=String(this.versionChannel||'');
        const st=String(this.versionStatus||'');
        const filtered=list.filter(v=>{
          if(ch && String(v.channel||'')!==ch)return false;
          if(st && String(v.status||'')!==st)return false;
          if(kw && !String(v.version||'').toLowerCase().includes(kw) && !String(v.title||'').toLowerCase().includes(kw))return false;
          return true;
        });
        const pack=UI.paginateLocal(filtered,this.versionPage||1,20);
        this.versionPage=pack.page;
        host.innerHTML=`
          <div class="panel list-panel">
            <div class="matrix-action-bar">
              <div class="left"><span class="muted">共 ${filtered.length} / ${list.length} 个版本 · 上传 zip 后发布供 EXE 下载</span></div>
              <div class="right">
                ${canEdit?`<button class="primary tiny" type="button" onclick="app.editVersionModal()">新建版本</button>`:''}
              </div>
            </div>
            <div class="search-bar task-filter-bar">
              <select id="version-channel-filter" class="input" title="通道">
                <option value="">全部通道</option>
                <option value="stable" ${ch==='stable'?'selected':''}>正式 stable</option>
                <option value="beta" ${ch==='beta'?'selected':''}>测试 beta</option>
              </select>
              <select id="version-status-filter" class="input" title="状态">
                <option value="">全部状态</option>
                <option value="draft" ${st==='draft'?'selected':''}>草稿</option>
                <option value="published" ${st==='published'?'selected':''}>已发布</option>
                <option value="archived" ${st==='archived'?'selected':''}>已归档</option>
              </select>
              <input id="version-search" class="input" type="search" placeholder="搜索版本号 / 标题" value="${this.esc(this.versionKeyword||'')}" onkeydown="if(event.key==='Enter')app.searchVersions()">
              <button class="primary" type="button" onclick="app.searchVersions()">查询</button>
              <button class="ghost" type="button" onclick="app.resetVersions()">重置</button>
            </div>
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>版本号</th>
                    <th>标题</th>
                    <th>通道</th>
                    <th>包大小</th>
                    <th>状态</th>
                    <th>下载次数</th>
                    <th>更新时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${pack.items.length?pack.items.map(v=>`
                    <tr>
                      <td><b>#${v.id}</b></td>
                      <td><b>${this.esc(v.version)}</b>${v.is_latest||v.isLatest?' <span class="badge running">最新</span>':''}</td>
                      <td>${this.esc(v.title||'')}</td>
                      <td>${this.esc(v.channel||'stable')}</td>
                      <td>${v.has_file||v.file_size||v.fileSize?this.formatBytes(v.file_size||v.fileSize||0):'<span class="muted">未上传</span>'}</td>
                      <td>${this.badge(v.status==='published'?'online':(v.status==='archived'?'offline':'checking'))} <span class="muted">${this.esc(v.status||'')}</span></td>
                      <td>${v.download_count||v.downloadCount||0}</td>
                      <td class="muted">${this.esc(v.updated_at||'-')}</td>
                      <td style="white-space:nowrap">
                        ${canEdit?`<button class="tiny" onclick='app.editVersionModal(${JSON.stringify(v)})'>编辑</button>
                        <button class="tiny" onclick="app.uploadVersionPackage(${v.id})">上传包</button>
                        ${v.status!=='published'?`<button class="tiny primary" onclick="app.publishVersion(${v.id})">发布</button>`:''}
                        ${v.status==='published'&&!(v.is_latest||v.isLatest)?`<button class="tiny" onclick="app.setLatestVersion(${v.id})">设为最新</button>`:''}
                        <button class="tiny danger" onclick="app.deleteVersion(${v.id},'${this.esc(v.version)}')">删除</button>`:'<span class="muted">只读</span>'}
                      </td>
                    </tr>
                  `).join(''):`<tr><td colspan="9"><div class="empty">暂无版本，请先新建并上传 zip 代码包</div></td></tr>`}
                </tbody>
              </table>
            </div>
            ${UI.pager(pack,'versionPage')}
          </div>`;
      }catch(err){
        host.innerHTML=`<div class="panel list-panel"><div class="empty">加载版本失败: ${this.esc(err.message)}</div></div>`;
      }
    },
    searchVersions(){
      this.versionChannel=document.querySelector('#version-channel-filter')?.value||'';
      this.versionStatus=document.querySelector('#version-status-filter')?.value||'';
      this.versionKeyword=document.querySelector('#version-search')?.value?.trim()||'';
      this.versionPage=1;
      this.refresh();
    },
    resetVersions(){
      this.versionChannel='';
      this.versionStatus='';
      this.versionKeyword='';
      this.versionPage=1;
      this.refresh();
    },
    editVersionModal(v={}){
      if(!this.canEditVersions()){this.toast('当前角色无权编辑版本',true);return}
      this.modal(v.id?'编辑版本':'新建版本',`
        <div class="form-grid">
          <input type="hidden" name="id" value="${v.id||''}">
          ${this.field('version','版本号',v.version||'','text',true)}
          ${this.field('title','标题',v.title||'','text',true)}
          ${this.selectRaw('channel','发布通道',[['stable','正式 stable'],['beta','测试 beta']],v.channel||'stable')}
          ${this.selectRaw('status','状态',[['draft','草稿'],['published','已发布'],['archived','已归档']],v.status||'draft')}
          ${this.field('description','说明',v.description||'','textarea')}
          <div class="field full"><div class="muted">建议将前端 public + 本机 Node（src/package.json 等）打成 zip 上传。客服 EXE 会下载并解压到本机后启动。</div></div>
        </div>
      `,async(d)=>{
        const id=d.id; delete d.id;
        if(id) await this.api(`/client-versions/${id}`,{method:'PUT',body:JSON.stringify(d)});
        else await this.api('/client-versions',{method:'POST',body:JSON.stringify(d)});
        this.toast('版本已保存');
        this.closeModal();
        this.refresh();
      });
    },
    uploadVersionPackage(id){
      if(!this.canEditVersions()){this.toast('当前角色无权上传版本包',true);return}
      const input=document.createElement('input');
      input.type='file';
      input.accept='.zip,application/zip';
      input.onchange=async()=>{
        const file=input.files?.[0];
        if(!file)return;
        if(!/\.zip$/i.test(file.name)){this.toast('请上传 zip 文件',true);return;}
        const fd=new FormData();
        fd.append('file',file);
        try{
          this.toast('正在上传代码包…');
          await this.api(`/client-versions/${id}/upload`,{method:'POST',body:fd});
          this.toast('代码包已上传');
          this.refresh();
        }catch(e){this.toast(e.message,true);}
      };
      input.click();
    },
    async publishVersion(id){
      if(!this.canEditVersions()){this.toast('当前角色无权发布版本',true);return}
      if(!(await this.ask('发布后客服客户端即可下载该版本，确认发布？')))return;
      try{
        await this.api(`/client-versions/${id}/publish`,{method:'POST',body:JSON.stringify({})});
        this.toast('版本已发布');
        this.refresh();
      }catch(e){this.toast(e.message,true);}
    },
    async setLatestVersion(id){
      if(!this.canEditVersions()){this.toast('当前角色无权设置最新版本',true);return}
      try{
        await this.api(`/client-versions/${id}/latest`,{method:'POST',body:JSON.stringify({})});
        this.toast('已设为最新版本');
        this.refresh();
      }catch(e){this.toast(e.message,true);}
    },
    async deleteVersion(id,version){
      if(!this.canEditVersions()){this.toast('当前角色无权删除版本',true);return}
      if(!(await this.ask(`确定删除版本 ${version} 及其代码包吗？`,'danger')))return;
      try{
        await this.api(`/client-versions/${id}`,{method:'DELETE'});
        this.toast('版本已删除');
        this.refresh();
      }catch(e){this.toast(e.message,true);}
    },
  };
  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages["versions"] = true;
})();
