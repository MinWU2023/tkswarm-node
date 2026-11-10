(function () {
  if (!window.app) throw new Error('app-core must load before pages/helpDocs.js');
  const __methods = {
    canViewHelpDocs(){return this.canPermission('system.help')||this.canPermission('system.view')||this.canPermission('rbac.manage')},
    canEditHelpDocs(){return this.canPermission('system.help')||this.canPermission('rbac.manage')},
    async renderHelpDocs(){
      const host=document.querySelector('#content');
      if(!host)return;
      if(!this.canViewHelpDocs()){
        host.innerHTML=`<div class="panel"><div class="empty">当前角色无权管理帮助文档</div></div>`;
        return;
      }
      const canEdit=this.canEditHelpDocs();
      const tab=this.helpDocsTab||'docs';
      try{
        const cats=await this.api('/help-categories');
        const catList=Array.isArray(cats)?cats:[];
        if(tab==='cats'){
          const kw=(this.helpCatKeyword||'').trim().toLowerCase();
          const filtered=catList.filter(c=>{
            if(!kw)return true;
            return String(c.name||'').toLowerCase().includes(kw)||String(c.slug||'').toLowerCase().includes(kw);
          });
          const pack=UI.paginateLocal(filtered,this.helpCatPage||1,20);
          this.helpCatPage=pack.page;
          host.innerHTML=`
            <div class="panel list-panel">
              <div class="matrix-action-bar">
                <div class="left"><span class="muted">共 ${filtered.length} / ${catList.length} 个帮助分类</span></div>
                <div class="right">
                  <button class="ghost tiny" type="button" onclick="app.helpDocsTab='docs';app.refresh()">文档列表</button>
                  ${canEdit?`<button class="primary tiny" type="button" onclick="app.editHelpCategoryModal()">新建分类</button>`:''}
                </div>
              </div>
              <div class="search-bar task-filter-bar">
                <input id="help-cat-search" class="input" type="search" placeholder="搜索分类名称 / Slug" value="${this.esc(this.helpCatKeyword||'')}" onkeydown="if(event.key==='Enter')app.searchHelpCats()">
                <button class="primary" type="button" onclick="app.searchHelpCats()">查询</button>
                <button class="ghost" type="button" onclick="app.resetHelpCats()">重置</button>
              </div>
              <div class="table-container">
                <table>
                  <thead><tr><th>ID</th><th>名称</th><th>Slug</th><th>排序</th><th>可见</th><th>操作</th></tr></thead>
                  <tbody>
                    ${pack.items.length?pack.items.map(c=>`
                      <tr>
                        <td><b>#${c.id}</b></td>
                        <td><b>${this.esc(c.name)}</b></td>
                        <td class="muted">${this.esc(c.slug||'-')}</td>
                        <td>${c.sortOrder??c.sort_order??0}</td>
                        <td>${c.visible?'显示':'隐藏'}</td>
                        <td style="white-space:nowrap">
                          ${canEdit?`<button class="tiny" onclick='app.editHelpCategoryModal(${JSON.stringify(c)})'>编辑</button>
                          <button class="tiny danger" onclick="app.deleteHelpCategory(${c.id},'${this.esc(c.name)}')">删除</button>`:'<span class="muted">只读</span>'}
                        </td>
                      </tr>`).join(''):`<tr><td colspan="6"><div class="empty">暂无分类</div></td></tr>`}
                  </tbody>
                </table>
              </div>
              ${UI.pager(pack,'helpCatPage')}
            </div>`;
          return;
        }
        const q=this.helpDocsCatId?`?category_id=${encodeURIComponent(this.helpDocsCatId)}`:'';
        const docs=await this.api('/help-documents'+q);
        const list=Array.isArray(docs)?docs:[];
        const kw=(this.helpDocKeyword||'').trim().toLowerCase();
        const st=String(this.helpDocStatus||'');
        const filtered=list.filter(d=>{
          if(st && String(d.status||'')!==st)return false;
          if(kw && !String(d.title||'').toLowerCase().includes(kw) && !String(d.summary||'').toLowerCase().includes(kw) && !String(d.categoryName||'').toLowerCase().includes(kw))return false;
          return true;
        });
        const pack=UI.paginateLocal(filtered,this.helpDocPage||1,20);
        this.helpDocPage=pack.page;
        host.innerHTML=`
          <div class="panel list-panel">
            <div class="matrix-action-bar">
              <div class="left"><span class="muted">共 ${filtered.length} / ${list.length} 篇文档 · 发布后客户端可查看</span></div>
              <div class="right">
                <button class="ghost tiny" type="button" onclick="app.helpDocsTab='cats';app.refresh()">管理分类</button>
                ${canEdit?`<button class="primary tiny" type="button" onclick="app.editHelpDocumentModal()">新建文档</button>`:''}
              </div>
            </div>
            <div class="search-bar task-filter-bar">
              <select id="help-doc-cat" class="input" title="分类">
                <option value="">全部分类</option>
                ${catList.map(c=>`<option value="${c.id}" ${String(this.helpDocsCatId)===String(c.id)?'selected':''}>${this.esc(c.name)}</option>`).join('')}
              </select>
              <select id="help-doc-status" class="input" title="状态">
                <option value="">全部状态</option>
                <option value="draft" ${st==='draft'?'selected':''}>草稿</option>
                <option value="published" ${st==='published'?'selected':''}>已发布</option>
              </select>
              <input id="help-doc-search" class="input" type="search" placeholder="搜索标题 / 摘要" value="${this.esc(this.helpDocKeyword||'')}" onkeydown="if(event.key==='Enter')app.searchHelpDocs()">
              <button class="primary" type="button" onclick="app.searchHelpDocs()">查询</button>
              <button class="ghost" type="button" onclick="app.resetHelpDocs()">重置</button>
            </div>
            <div class="table-container">
              <table>
                <thead><tr><th>ID</th><th>标题</th><th>分类</th><th>状态</th><th>排序</th><th>阅读</th><th>更新</th><th>操作</th></tr></thead>
                <tbody>
                  ${pack.items.length?pack.items.map(d=>`
                    <tr>
                      <td><b>#${d.id}</b></td>
                      <td><b>${this.esc(d.title)}</b><div class="muted" style="font-size:12px">${this.esc((d.summary||'').slice(0,60))}</div></td>
                      <td>${this.esc(d.categoryName||'-')}</td>
                      <td>${this.badge(d.status==='published'?'online':'checking')} <span class="muted">${this.esc(d.status)}</span></td>
                      <td>${d.sortOrder??0}</td>
                      <td>${d.viewCount??0}</td>
                      <td class="muted">${this.esc(d.updatedAt||'-')}</td>
                      <td style="white-space:nowrap">
                        ${canEdit?`<button class="tiny" onclick="app.editHelpDocumentModalById(${d.id})">编辑</button>
                        <button class="tiny danger" onclick="app.deleteHelpDocument(${d.id},'${this.esc(d.title)}')">删除</button>`:'<span class="muted">只读</span>'}
                      </td>
                    </tr>`).join(''):`<tr><td colspan="8"><div class="empty">暂无文档</div></td></tr>`}
                </tbody>
              </table>
            </div>
            ${UI.pager(pack,'helpDocPage')}
          </div>`;
      }catch(err){
        host.innerHTML=`<div class="panel list-panel"><div class="empty">加载失败: ${this.esc(err.message)}</div></div>`;
      }
    },
    searchHelpDocs(){
      this.helpDocsCatId=document.querySelector('#help-doc-cat')?.value||'';
      this.helpDocStatus=document.querySelector('#help-doc-status')?.value||'';
      this.helpDocKeyword=document.querySelector('#help-doc-search')?.value?.trim()||'';
      this.helpDocPage=1;
      this.refresh();
    },
    resetHelpDocs(){
      this.helpDocsCatId='';
      this.helpDocStatus='';
      this.helpDocKeyword='';
      this.helpDocPage=1;
      this.refresh();
    },
    searchHelpCats(){
      this.helpCatKeyword=document.querySelector('#help-cat-search')?.value?.trim()||'';
      this.helpCatPage=1;
      this.refresh();
    },
    resetHelpCats(){
      this.helpCatKeyword='';
      this.helpCatPage=1;
      this.refresh();
    },
    editHelpCategoryModal(c={}){
      if(!this.canEditHelpDocs()){this.toast('当前角色无权编辑帮助分类',true);return}
      this.modal(c.id?'编辑分类':'新建分类',`
        <div class="form-grid">
          <input type="hidden" name="id" value="${c.id||''}">
          ${this.field('name','分类名称',c.name||'','text',true)}
          ${this.field('slug','Slug',c.slug||'')}
          ${this.field('sortOrder','排序',c.sortOrder??c.sort_order??0,'number')}
          ${this.selectRaw('visible','是否可见',[['1','显示'],['0','隐藏']],c.visible===false||c.visible===0?'0':'1')}
        </div>
      `,async(d)=>{
        const id=d.id; delete d.id;
        d.sortOrder=Number(d.sortOrder||0);
        d.visible=d.visible==='1'||d.visible===1||d.visible===true;
        if(id) await this.api(`/help-categories/${id}`,{method:'PUT',body:JSON.stringify(d)});
        else await this.api('/help-categories',{method:'POST',body:JSON.stringify(d)});
        this.toast('分类已保存');
        this.closeModal();
        this.refresh();
      });
    },
    async deleteHelpCategory(id,name){
      if(!this.canEditHelpDocs()){this.toast('当前角色无权删除帮助分类',true);return}
      if(!(await this.ask(`确定删除分类「${name}」吗？分类下有文档时无法删除。`,'danger')))return;
      try{
        await this.api(`/help-categories/${id}`,{method:'DELETE'});
        this.toast('分类已删除');
        this.refresh();
      }catch(e){this.toast(e.message,true);}
    },
    editHelpDocumentModal(d={}){
      if(!this.canEditHelpDocs()){this.toast('当前角色无权编辑帮助文档',true);return}
      const run=async()=>{
        let cats=[];
        try{cats=await this.api('/help-categories')||[];}catch{}
        const catPairs=(Array.isArray(cats)?cats:[]).map(c=>[String(c.id),c.name]);
        this.modal(d.id?'编辑文档':'新建文档',`
          <div class="form-grid">
            <input type="hidden" name="id" value="${d.id||''}">
            ${this.field('title','标题',d.title||'','text',true)}
            ${this.selectRaw('categoryId','分类',[['0','未分类'],...catPairs],String(d.categoryId||d.category_id||0))}
            ${this.field('summary','摘要',d.summary||'','textarea')}
            ${this.field('content','正文 (支持 Markdown)',d.content||'','textarea')}
            ${this.selectRaw('status','状态',[['draft','草稿'],['published','已发布']],d.status||'draft')}
            ${this.field('sortOrder','排序',d.sortOrder??0,'number')}
          </div>
        `,async(form)=>{
          const id=form.id; delete form.id;
          form.categoryId=Number(form.categoryId||0);
          form.sortOrder=Number(form.sortOrder||0);
          if(id) await this.api(`/help-documents/${id}`,{method:'PUT',body:JSON.stringify(form)});
          else await this.api('/help-documents',{method:'POST',body:JSON.stringify(form)});
          this.toast('文档已保存');
          this.closeModal();
          this.refresh();
        });
      };
      run();
    },
    async editHelpDocumentModalById(id){
      if(!this.canEditHelpDocs()){this.toast('当前角色无权编辑帮助文档',true);return}
      try{
        const rows=await this.api('/help-documents');
        const d=(Array.isArray(rows)?rows:[]).find(x=>Number(x.id)===Number(id));
        if(!d){this.toast('文档不存在',true);return;}
        this.editHelpDocumentModal(d);
      }catch(e){this.toast(e.message,true);}
    },
    async deleteHelpDocument(id,title){
      if(!this.canEditHelpDocs()){this.toast('当前角色无权删除帮助文档',true);return}
      if(!(await this.ask(`确定删除文档「${title}」吗？`,'danger')))return;
      try{
        await this.api(`/help-documents/${id}`,{method:'DELETE'});
        this.toast('文档已删除');
        this.refresh();
      }catch(e){this.toast(e.message,true);}
    },
  };
  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages["helpDocs"] = true;
})();
