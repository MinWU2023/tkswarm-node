(function () {
  if (!window.app) throw new Error('app-core must load before pages/aiPromptTemplates.js');
  const __methods = {
    async renderAiPromptTemplates(){
      const host=document.querySelector('#content');
      if(!host)return;
      if(!this.canPermission('system.ai_prompt')&&!this.canPermission('system.ai_platform')&&!this.canPermission('system.view')&&!this.canPermission('rbac.manage')){
        host.innerHTML=`<div class="panel"><div class="empty">当前角色无权管理 AI 提示词模板</div></div>`;
        return;
      }
      const canEdit=this.canPermission('system.ai_prompt')||this.canPermission('system.ai_platform')||this.canPermission('rbac.manage');
      const cat=this.aiPromptCategory||'';
      const kw=this.aiPromptKeyword||'';
      try{
        const q=`?category=${encodeURIComponent(cat)}&keyword=${encodeURIComponent(kw)}`;
        const pack=await this.api('/ai-prompt-templates'+q);
        const rows=pack.items||[];
        const categories=pack.categories||[];
        this.aiPromptCategories=categories;
        const packLocal=UI.paginateLocal(rows,this.aiPromptPage||1,20);
        this.aiPromptPage=packLocal.page;
        host.innerHTML=`
          <div class="panel list-panel">
            <div class="matrix-action-bar">
              <div class="left"><span class="muted">正文使用 <code>{{变量名}}</code> 占位；不同模板可定义不同变量与默认值</span></div>
              <div class="right">${canEdit?`<button class="primary tiny" type="button" onclick="app.editAiPromptTemplate()">新建模板</button>`:''}</div>
            </div>
            <div class="search-bar task-filter-bar">
              <select id="ai-prompt-cat" class="input" title="分类">
                <option value="">全部分类</option>
                ${categories.map(c=>`<option value="${this.esc(c.code)}" ${cat===c.code?'selected':''}>${this.esc(c.label)}</option>`).join('')}
              </select>
              <input id="ai-prompt-search" class="input" type="search" placeholder="搜索名称 / 代码 / 内容" value="${this.esc(kw)}" onkeydown="if(event.key==='Enter')app.searchAiPromptTemplates()">
              <button class="primary" type="button" onclick="app.searchAiPromptTemplates()">查询</button>
              <button class="ghost" type="button" onclick="app.resetAiPromptTemplates()">重置</button>
            </div>
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>名称</th>
                    <th>分类</th>
                    <th>变量占位</th>
                    <th>状态</th>
                    <th>更新时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${packLocal.items.length?packLocal.items.map(t=>`
                    <tr>
                      <td><b>#${t.id}</b></td>
                      <td>
                        <b>${this.esc(t.name)}</b>
                        ${t.isBuiltin?' <span class="badge running">内置</span>':''}
                        <div class="muted">${this.esc(t.code||'')}${t.description?` · ${this.esc(t.description)}`:''}</div>
                      </td>
                      <td>${this.esc(t.categoryLabel||t.category||'-')}</td>
                      <td><div class="ai-var-chips">${(t.variables||[]).length?(t.variables||[]).map(v=>`<span class="ai-var-chip" title="${this.esc(v.label||v.key)}">{{${this.esc(v.key)}}}${v.required?'*':''}</span>`).join(''):'<span class="muted">无变量</span>'}</div></td>
                      <td>${this.badge(t.enabled?'online':'offline')} ${t.enabled?'启用':'停用'}</td>
                      <td class="muted">${this.esc(t.updatedAt||'-')}</td>
                      <td style="white-space:nowrap">
                        <button class="tiny" type="button" onclick='app.previewAiPromptTemplate(${JSON.stringify(t)})'>预览</button>
                        ${canEdit?`<button class="tiny" type="button" onclick='app.editAiPromptTemplate(${JSON.stringify(t)})'>编辑</button>
                        <button class="tiny" type="button" onclick="app.toggleAiPromptTemplate(${t.id},${t.enabled?0:1})">${t.enabled?'停用':'启用'}</button>
                        ${!t.isBuiltin?`<button class="tiny danger" type="button" onclick="app.deleteAiPromptTemplate(${t.id},'${this.esc(t.name)}')">删除</button>`:''}`:'<span class="muted">只读</span>'}
                      </td>
                    </tr>
                  `).join(''):`<tr><td colspan="7"><div class="empty">暂无提示词模板</div></td></tr>`}
                </tbody>
              </table>
            </div>
            ${UI.pager(packLocal,'aiPromptPage')}
          </div>`;
      }catch(err){
        host.innerHTML=`<div class="panel list-panel"><div class="empty">加载提示词模板失败: ${this.esc(err.message)}</div></div>`;
      }
    },
    searchAiPromptTemplates(){
      this.aiPromptCategory=document.querySelector('#ai-prompt-cat')?.value||'';
      this.aiPromptKeyword=document.querySelector('#ai-prompt-search')?.value?.trim()||'';
      this.aiPromptPage=1;
      this.refresh();
    },
    resetAiPromptTemplates(){this.aiPromptCategory='';this.aiPromptKeyword='';this.aiPromptPage=1;this.refresh()},
    aiPromptVarRowsHtml(vars=[]){
      const list=vars.length?vars:[{key:'',label:'',required:true,default:'',example:'',type:'text'}];
      return list.map((v,i)=>`
        <tr data-var-row="${i}">
          <td><input class="input" name="var_key_${i}" value="${this.esc(v.key||'')}" placeholder="key" style="min-width:100px"></td>
          <td><input class="input" name="var_label_${i}" value="${this.esc(v.label||'')}" placeholder="显示名" style="min-width:100px"></td>
          <td>
            <select class="input" name="var_type_${i}">
              <option value="text" ${(v.type||'text')==='text'?'selected':''}>文本</option>
              <option value="textarea" ${v.type==='textarea'?'selected':''}>多行</option>
              <option value="number" ${v.type==='number'?'selected':''}>数字</option>
            </select>
          </td>
          <td><select class="input" name="var_required_${i}"><option value="true" ${v.required!==false?'selected':''}>是</option><option value="false" ${v.required===false?'selected':''}>否</option></select></td>
          <td><input class="input" name="var_default_${i}" value="${this.esc(v.default||'')}" placeholder="默认值"></td>
          <td><input class="input" name="var_example_${i}" value="${this.esc(v.example||'')}" placeholder="示例"></td>
          <td><button class="tiny danger" type="button" onclick="app.removeAiPromptVarRow(this)">删</button></td>
        </tr>
      `).join('');
    },
    collectAiPromptVarsFromForm(){
      const rows=[...document.querySelectorAll('#ai-prompt-var-body tr')];
      return rows.map(tr=>{
        const i=tr.getAttribute('data-var-row');
        const key=(document.querySelector(`[name="var_key_${i}"]`)?.value||'').trim();
        if(!key)return null;
        return {
          key,
          label:(document.querySelector(`[name="var_label_${i}"]`)?.value||key).trim(),
          type:document.querySelector(`[name="var_type_${i}"]`)?.value||'text',
          required:document.querySelector(`[name="var_required_${i}"]`)?.value==='true',
          default:document.querySelector(`[name="var_default_${i}"]`)?.value||'',
          example:document.querySelector(`[name="var_example_${i}"]`)?.value||'',
        };
      }).filter(Boolean);
    },
    addAiPromptVarRow(){
      const body=document.querySelector('#ai-prompt-var-body');
      if(!body)return;
      const i=Date.now()%100000+body.children.length;
      body.insertAdjacentHTML('beforeend', this.aiPromptVarRowsHtml([{key:'',label:'',required:true,default:'',example:'',type:'text'}]).replace(/data-var-row="0"/g,`data-var-row="${i}"`).replace(/var_(\w+)_0/g,`var_$1_${i}`));
    },
    removeAiPromptVarRow(btn){
      const tr=btn?.closest('tr');
      const body=document.querySelector('#ai-prompt-var-body');
      if(!tr||!body)return;
      if(body.children.length<=1){tr.querySelectorAll('input').forEach(el=>el.value='');return}
      tr.remove();
    },
    async syncAiPromptVarsFromContent(){
      const content=document.querySelector('[name="content"]')?.value||'';
      const current=this.collectAiPromptVarsFromForm();
      try{
        const r=await this.api('/ai-prompt-templates/parse-variables',{method:'POST',body:JSON.stringify({content,variables:current})});
        const body=document.querySelector('#ai-prompt-var-body');
        if(body)body.innerHTML=this.aiPromptVarRowsHtml(r.variables||[]);
        this.toast(`已同步 ${(r.variables||[]).length} 个变量`);
      }catch(e){this.toast(e.message,true)}
    },
    editAiPromptTemplate(t=null){
      const isEdit=!!(t&&t.id);
      const cats=this.aiPromptCategories||[{code:'general',label:'通用'},{code:'translate',label:'翻译'},{code:'chat',label:'客服'},{code:'publish',label:'发布文案'},{code:'agent',label:'智能体'}];
      const vars=t?.variables||[];
      this.modal(isEdit?'编辑提示词模板':'新建提示词模板',`
        <div class="form-grid">
          <input type="hidden" name="id" value="${t?.id||''}">
          ${this.field('name','模板名称',t?.name||'','text',true)}
          ${this.field('code','模板代码',t?.code||'','text',false)}
          ${this.selectRaw('category','分类',cats.map(c=>[c.code,c.label]),t?.category||'general')}
          ${this.selectRaw('enabled','状态',[['true','启用'],['false','停用']],t?.enabled===false||t?.enabled===0?'false':'true')}
          ${this.field('description','说明',t?.description||'')}
          ${this.field('content','提示词正文（使用 {{变量名}}）',t?.content||'','textarea',true)}
          <div class="field full">
            <div class="matrix-action-bar" style="margin:0 0 8px">
              <div class="left"><b>变量定义</b> <span class="muted">各模板可不同；* 为必填</span></div>
              <div class="right">
                <button class="tiny" type="button" onclick="app.syncAiPromptVarsFromContent()">从正文同步</button>
                <button class="tiny primary" type="button" onclick="app.addAiPromptVarRow()">加变量</button>
              </div>
            </div>
            <div class="table-container">
              <table>
                <thead><tr><th>Key</th><th>显示名</th><th>类型</th><th>必填</th><th>默认值</th><th>示例</th><th></th></tr></thead>
                <tbody id="ai-prompt-var-body">${this.aiPromptVarRowsHtml(vars)}</tbody>
              </table>
            </div>
          </div>
        </div>
      `,async(d)=>{
        const id=d.id; delete d.id;
        const payload={
          name:d.name,
          code:d.code||undefined,
          category:d.category||'general',
          description:d.description||'',
          content:d.content||'',
          enabled:d.enabled==='true'||d.enabled===true,
          variables:this.collectAiPromptVarsFromForm(),
        };
        if(id) await this.api(`/ai-prompt-templates/${id}`,{method:'PUT',body:JSON.stringify(payload)});
        else await this.api('/ai-prompt-templates',{method:'POST',body:JSON.stringify(payload)});
        this.toast(id?'模板已更新':'模板已创建');
        this.refresh();
      },true,{wide:true});
    },
    previewAiPromptTemplate(t){
      const vars=t.variables||[];
      const fields=vars.length?vars.map(v=>{
        const val=v.example||v.default||'';
        if(v.type==='textarea')return this.field('pv_'+v.key,`${v.label||v.key}${v.required?' *':''}`,val,'textarea',!!v.required);
        return this.field('pv_'+v.key,`${v.label||v.key}${v.required?' *':''}`,val,v.type==='number'?'number':'text',!!v.required);
      }).join(''):'<div class="shell-note">该模板无变量，可直接查看正文</div>';
      this.modal('渲染预览 · '+this.esc(t.name),`
        <div class="form-grid">
          <div class="field full"><div class="muted">原文</div><pre class="ai-prompt-preview-src">${this.esc(t.content||'')}</pre></div>
          ${fields}
          <div class="field full"><div class="muted">渲染结果</div><pre id="ai-prompt-preview-out" class="ai-prompt-preview-out">填写变量后点「渲染」</pre></div>
        </div>
        <div class="toolbar" style="margin-top:8px"><button class="primary" type="button" onclick="app.runAiPromptPreview(${t.id})">渲染</button></div>
      `,async()=>{},false,{hideSubmit:true,wide:true});
    },
    async runAiPromptPreview(id){
      const variables={};
      document.querySelectorAll('#modal-form [name^="pv_"]').forEach(el=>{
        variables[el.name.slice(3)]=el.value;
      });
      try{
        const r=await this.api(`/ai-prompt-templates/${id}/render`,{method:'POST',body:JSON.stringify({variables})});
        const out=document.querySelector('#ai-prompt-preview-out');
        if(out)out.textContent=r.rendered||'';
        this.toast('渲染成功');
      }catch(e){this.toast(e.message,true)}
    },
    async toggleAiPromptTemplate(id,enabled){
      try{await this.api(`/ai-prompt-templates/${id}/status`,{method:'PATCH',body:JSON.stringify({enabled:!!enabled})});this.toast(enabled?'已启用':'已停用');this.refresh()}catch(e){this.toast(e.message,true)}
    },
    async deleteAiPromptTemplate(id,name){
      if(!(await this.ask(`确定删除提示词模板「${name}」吗？`)))return;
      try{await this.api(`/ai-prompt-templates/${id}`,{method:'DELETE'});this.toast('已删除');this.refresh()}catch(e){this.toast(e.message,true)}
    },
  };
  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages["aiPromptTemplates"] = true;
})();
