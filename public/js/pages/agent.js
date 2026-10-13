(function () {
  if (!window.app) throw new Error('app-core must load before pages/agent.js');
  const __methods = {
    async renderAgent(){
      document.querySelector('#content').classList.remove('chat-mode');
      const page=this.agentPage||1;
      const [pack, platPack]=await Promise.all([
        this.api(`/agents?page=${page}&pageSize=20${this.agentKeyword?`&keyword=${encodeURIComponent(this.agentKeyword)}`:''}`),
        this.api('/ai-platforms').catch(()=>({items:[]})),
      ]);
      const agents=Array.isArray(pack)?pack:(pack.items||[]);
      const pagerPack=Array.isArray(pack)?UI.paginateLocal(pack,1,Math.max(agents.length,1)):{page:pack.page||1,pages:pack.pages||1,total:pack.total||agents.length,pageSize:pack.pageSize||20,items:agents};
      this.agentPlatforms=(platPack.items||[]).filter(p=>p.enabled!==false&&p.enabled!==0);
      if(this.agentId&&!agents.some(a=>Number(a.id)===Number(this.agentId))){
        if(!this.agentCreating)this.agentId=agents[0]?.id||null;
      }
      if(this.agentId&&!this.agentCreating&&(!this.agentForm||Number(this.agentForm.id)!==Number(this.agentId))){
        this.agentForm=await this.api(`/agents/${this.agentId}`);
        this.agentNameTouched=true;
        this.testChat=[];
      }
      if(!this.agentId&&!this.agentCreating)this.agentForm=null;
      const f=this.agentForm||this.emptyAgentForm();
      const platformId=Number(f.platformId||0);
      let models=this.agentModelsCache?.[platformId]||[];
      if(platformId>0&&!this.agentModelsCache?.[platformId]){
        try{
          const mPack=await this.api(`/ai-platforms/${platformId}/models?enabled=1`);
          models=(mPack.items||[]).filter(m=>m.enabled!==false&&m.enabled!==0);
          this.agentModelsCache={...(this.agentModelsCache||{}),[platformId]:models};
        }catch(_){models=[]}
      }else if(platformId>0){
        models=this.agentModelsCache[platformId]||[];
      }
      if(this.agentForm&&platformId>0&&!this.agentForm.modelId&&models.length){
        const def=models.find(m=>m.isDefault)||models[0];
        if(def)this.agentForm.modelId=def.code;
        f.modelId=this.agentForm.modelId;
      }
      if(this.agentForm&&!this.agentNameTouched){
        const auto=this.buildAgentName(this.agentForm,models);
        if(auto){this.agentForm.name=auto;f.name=auto}
      }
      const canManage=this.canPermission('agent.manage');
      const summary=f.platformName||f.modelName
        ?`${this.esc(f.platformName||'未选平台')} · ${this.esc(f.modelName||f.modelId||'未选模型')}`
        :'选择平台与模型后即可对话';
      const modelTags=models.length
        ?this.agentTagField('modelId','模型',models.map(m=>[m.code,m.name||m.code]),f.modelId||'')
        :`<div class="field full"><label>模型</label><div class="muted agent-tag-empty">${platformId?'该平台暂无可用模型':'请先选择平台'}</div></div>`;
      document.querySelector('#content').innerHTML=`<div class="agent-shell">
        <aside class="panel agent-list-panel" style="margin:0">
          <div class="panel-head"><h3>智能体 <span class="muted">${pagerPack.total||agents.length}</span></h3>${canManage?`<button class="primary tiny" onclick="app.addAgent()">新建</button>`:''}</div>
          <div id="agent-batch-panel" class="batch-panel hidden" style="margin:0 0 10px">
            <div class="batch-info">已选 <strong id="agent-selected-count">0</strong></div>
            ${canManage?`<div class="action-buttons"><button class="danger tiny" type="button" onclick="app.batchDeleteAgents()">批量删除</button></div>`:''}
          </div>
          <div class="filters agent-search-bar"><input class="input" id="agent-search" placeholder="搜索名称..." value="${this.esc(this.agentKeyword||'')}" onkeydown="if(event.key==='Enter')app.searchAgents()"><button class="ghost" type="button" onclick="app.searchAgents()">查询</button></div>
          <div class="agent-list">${agents.length?agents.map(a=>{
            const sub=[a.platformName,a.modelName||a.modelId].filter(Boolean).join(' · ')||'未配置平台';
            return `<div class="agent-item ${!this.agentCreating&&Number(a.id)===Number(this.agentId)?'active':''}" onclick="app.selectAgent(${a.id})">
              <input class="agent-check" type="checkbox" value="${a.id}" onclick="event.stopPropagation();app.bindAgentChecks()" title="选择">
              <div class="chat-meta"><b class="agent-name">${this.esc(a.name)}</b><small>${this.esc(sub)}</small></div>
              <span class="badge ${a.enabled?'online':'offline'}">${a.enabled?'启用':'禁用'}</span>
            </div>`;
          }).join(''):'<div class="shell-note">暂无智能体，点击新建开始配置</div>'}</div>
          ${UI.pager(pagerPack,'agentPage')}
        </aside>
        <section class="panel agent-config agent-main-wrapper" style="margin:0">
          ${(this.agentId||this.agentCreating)?`
          <div class="panel-head">
            <div><h3>${this.esc(f.name||(this.agentCreating?'新建智能体':'未命名'))}</h3><div class="muted">${summary}</div></div>
            <div class="agent-head-actions">
              ${canManage&&this.agentId?`<button class="tiny" onclick="app.toggleAgentStatus()">${f.enabled?'禁用':'启用'}</button>`:''}
              ${this.agentId?`<button class="tiny" onclick="app.openTestChat()">测试聊天</button>`:''}
              ${canManage&&this.agentId?`<button class="tiny danger" onclick="app.deleteAgent()">删除</button>`:''}
              ${canManage?`<button class="primary tiny" onclick="app.saveAgent()">保存</button>`:'<span class="muted">当前角色只可查看</span>'}
            </div>
          </div>
          <div id="agent-form-body" class="agent-simple-form">
            <div class="config-section">
              <div class="config-section-title">基础配置</div>
              <div class="form-grid agent-form-grid">
                ${this.agentFullField(this.field('name','智能体名称',f.name||'','text',true))}
                ${this.agentFullField(this.selectRaw('platformId','AI 开放平台',[['', '请选择平台'],...this.agentPlatforms.map(p=>[String(p.id),p.name])],platformId?String(platformId):''))}
                ${modelTags}
                ${this.agentTagField('replyTone','语言风格',this.replyTonePairs(),f.replyTone||'friendly')}
                ${this.agentTagField('replyLanguage','回复语言',this.languagePairs(false),f.replyLanguage||'zh')}
                ${this.agentFullField(this.selectRaw('enabled','状态',[['true','启用'],['false','禁用']],f.enabled===false||f.enabled===0?'false':'true'))}
              </div>
              <p class="muted agent-form-hint">名称默认按「模型-语言-语言风格」自动生成，可手动修改；回复走所选开放平台的当前启用配置。</p>
            </div>
          </div>
          <div class="toolbar agent-form-toolbar">
            <span class="muted">${this.agentCreating?'填写后保存即可创建':'修改后点击保存生效'}</span>
            ${canManage?`<button class="primary" onclick="app.saveAgent()">保存智能体</button>`:''}
          </div>`
          :'<div class="shell-note agent-empty-state">请从左侧选择智能体，或点击「新建」</div>'}
        </section>
      </div>`;
      this.bindAgentChecks();
      this.bindAgentFormEvents();
    },
    agentFullField(html){return String(html||'').replace('class="field','class="field full')},
    agentTagField(name,label,items,value){
      const chips=(items||[]).map(([v,n])=>{
        const checked=String(v)===String(value)?'checked':'';
        return `<label class="chip agent-tag"><input type="radio" name="${name}" value="${this.esc(String(v))}" ${checked}> ${this.esc(String(n))}</label>`;
      }).join('');
      return `<div class="field full"><label>${label}</label><div class="chip-row agent-tag-row">${chips||'<span class="muted">暂无可选项</span>'}</div></div>`;
    },
    agentLabelOf(pairs,code,fallback=''){
      const hit=(pairs||[]).find(([v])=>String(v)===String(code));
      return hit?String(hit[1]):(fallback||String(code||''));
    },
    buildAgentName(form,models){
      const f=form||{};
      const modelCode=f.modelId||'';
      if(!modelCode)return '';
      const modelRow=(models||[]).find(m=>String(m.code)===String(modelCode));
      const modelLabel=modelRow?(modelRow.name||modelRow.code):modelCode;
      const langLabel=this.agentLabelOf(this.languagePairs(false),f.replyLanguage||'zh',f.replyLanguage||'zh');
      const toneLabel=this.agentLabelOf(this.replyTonePairs(),f.replyTone||'friendly',f.replyTone||'friendly');
      return [modelLabel,langLabel,toneLabel].filter(Boolean).join('-');
    },
    syncAgentAutoName(){
      if(!this.agentForm||this.agentNameTouched)return;
      const pid=Number(this.agentForm.platformId||0);
      const models=this.agentModelsCache?.[pid]||[];
      const auto=this.buildAgentName(this.agentForm,models);
      if(!auto)return;
      this.agentForm.name=auto;
      const input=document.querySelector('#agent-form-body [name="name"]');
      if(input)input.value=auto;
      const title=document.querySelector('.agent-config .panel-head h3');
      if(title)title.textContent=auto;
    },
    bindAgentFormEvents(){
      const platSel=document.querySelector('#agent-form-body [name="platformId"]');
      if(platSel)platSel.addEventListener('change',()=>this.onAgentPlatformChange());
      const nameInput=document.querySelector('#agent-form-body [name="name"]');
      if(nameInput){
        nameInput.addEventListener('input',()=>{
          this.agentNameTouched=true;
          if(this.agentForm)this.agentForm.name=nameInput.value;
        });
      }
      document.querySelectorAll('#agent-form-body .agent-tag input[type="radio"]').forEach(el=>{
        el.addEventListener('change',()=>{
          if(!this.agentForm)return;
          const key=el.name;
          if(key==='modelId')this.agentForm.modelId=el.value;
          if(key==='replyTone')this.agentForm.replyTone=el.value;
          if(key==='replyLanguage')this.agentForm.replyLanguage=el.value;
          this.syncAgentAutoName();
        });
      });
    },
    bindAgentChecks(){
      const n=document.querySelectorAll('.agent-check:checked').length;
      const panel=document.querySelector('#agent-batch-panel');
      const count=document.querySelector('#agent-selected-count');
      if(count)count.textContent=String(n);
      if(panel)panel.classList.toggle('hidden',n===0);
    },
    async batchDeleteAgents(){
      const ids=[...document.querySelectorAll('.agent-check:checked')].map(x=>Number(x.value));
      if(!ids.length){this.toast('请先勾选智能体',true);return}
      if(!(await this.ask(`确定删除选中的 ${ids.length} 个智能体吗？`)))return;
      try{
        const r=await this.api('/agents/batch-delete',{method:'POST',body:JSON.stringify({ids})});
        this.toast(`已删除 ${r.deleted}`);
        if(ids.includes(Number(this.agentId))){this.agentId=null;this.agentForm=null;this.agentCreating=false}
        this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    emptyAgentForm(){
      const first=this.agentPlatforms?.[0];
      return{
        name:'',
        enabled:true,
        platformId:first?.id||null,
        modelId:'',
        replyTone:'friendly',
        replyLanguage:'zh',
      };
    },
    async onAgentPlatformChange(){
      this.collectAgentForm();
      const pid=Number(this.agentForm?.platformId||0);
      this.agentForm.modelId='';
      if(pid>0){
        try{
          const mPack=await this.api(`/ai-platforms/${pid}/models?enabled=1`);
          const models=(mPack.items||[]).filter(m=>m.enabled!==false&&m.enabled!==0);
          this.agentModelsCache={...(this.agentModelsCache||{}),[pid]:models};
          const def=models.find(m=>m.isDefault)||models[0];
          if(def)this.agentForm.modelId=def.code;
        }catch(_){}
      }
      if(!this.agentNameTouched){
        const models=this.agentModelsCache?.[pid]||[];
        this.agentForm.name=this.buildAgentName(this.agentForm,models)||'';
      }
      this.refresh();
    },
    searchAgents(){this.agentKeyword=document.querySelector('#agent-search')?.value||'';this.agentPage=1;this.refresh()},
    async selectAgent(id){
      this.agentCreating=false;
      this.agentId=id;
      this.agentForm=null;
      this.agentNameTouched=true;
      this.testChat=[];
      this.refresh();
    },
    addAgent(){
      if(!this.canPermission('agent.manage')){this.toast('当前角色无权管理智能体',true);return}
      this.agentCreating=true;
      this.agentId=null;
      this.agentNameTouched=false;
      this.agentForm=this.emptyAgentForm();
      this.testChat=[];
      this.refresh();
    },
    collectAgentForm(){
      if(!this.agentForm)return;
      if(!document.querySelector('#agent-form-body'))return;
      const read=name=>{
        const radio=document.querySelector(`#agent-form-body input[type="radio"][name="${name}"]:checked`);
        if(radio)return radio.value;
        return document.querySelector(`#agent-form-body [name="${name}"]`)?.value;
      };
      if(read('name')!=null)this.agentForm.name=read('name');
      if(read('platformId')!=null)this.agentForm.platformId=read('platformId')?Number(read('platformId')):null;
      if(read('modelId')!=null)this.agentForm.modelId=read('modelId')||'';
      if(read('replyTone')!=null)this.agentForm.replyTone=read('replyTone');
      if(read('replyLanguage')!=null)this.agentForm.replyLanguage=read('replyLanguage');
      if(read('enabled')!=null)this.agentForm.enabled=read('enabled')==='true';
    },
    agentSavePayload(){
      const f=this.agentForm||{};
      return{
        name:f.name,
        enabled:f.enabled!==false&&f.enabled!==0,
        platformId:Number(f.platformId||0)||null,
        modelId:f.modelId||'',
        replyTone:f.replyTone||'friendly',
        replyLanguage:f.replyLanguage||'zh',
      };
    },
    async saveAgent(){
      if(!this.canPermission('agent.manage')){this.toast('当前角色无权管理智能体',true);return}
      this.collectAgentForm();
      if(!this.agentNameTouched){
        const pid=Number(this.agentForm.platformId||0);
        const auto=this.buildAgentName(this.agentForm,this.agentModelsCache?.[pid]||[]);
        if(auto)this.agentForm.name=auto;
      }
      const payload=this.agentSavePayload();
      if(!payload.name?.trim()){this.toast('请填写智能体名称',true);return}
      if(!payload.platformId){this.toast('请选择 AI 开放平台',true);return}
      if(!payload.modelId){this.toast('请选择模型',true);return}
      try{
        if(this.agentId){
          this.agentForm=await this.api(`/agents/${this.agentId}`,{method:'PUT',body:JSON.stringify(payload)});
          this.toast('智能体已保存');
        }else{
          const created=await this.api('/agents',{method:'POST',body:JSON.stringify(payload)});
          this.agentId=created.id;
          this.agentForm=created;
          this.agentCreating=false;
          this.agentNameTouched=true;
          this.toast('智能体已创建');
        }
        this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    async toggleAgentStatus(){
      if(!this.agentId)return;
      try{
        this.agentForm=await this.api(`/agents/${this.agentId}/status`,{method:'PATCH',body:JSON.stringify({enabled:!this.agentForm.enabled})});
        this.toast(this.agentForm.enabled?'已启用':'已禁用');
        this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    async deleteAgent(){
      if(!this.agentId)return;
      if(!(await this.ask('确定删除该智能体吗？')))return;
      try{
        await this.api(`/agents/${this.agentId}`,{method:'DELETE'});
        this.agentId=null;this.agentForm=null;this.agentCreating=false;
        this.toast('已删除');
        this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    async openTestChat(skipSave=false){
      if(!this.agentId){this.toast('请先保存智能体',true);return}
      if(!skipSave&&this.canPermission('agent.manage')){
        try{
          this.collectAgentForm();
          this.agentForm=await this.api(`/agents/${this.agentId}`,{method:'PUT',body:JSON.stringify(this.agentSavePayload())});
        }catch(e){this.toast(e.message||'请先保存智能体配置',true);return}
      }
      this.testChat=this.testChat||[];
      this.modal('测试聊天',`<div class="test-chat"><div id="test-chat-thread" class="thread">${this.testChat.length?this.testChat.map(m=>`<div class="bubble ${m.role==='assistant'?'out':''}">${this.esc(m.content)}<span class="time">${m.role==='assistant'?'AI':'我'}</span></div>`).join(''):'<div class="shell-note">输入消息，将按当前平台模型与语言风格回复。</div>'}</div><div class="filters"><input class="input" id="test-chat-input" style="flex:1" placeholder="请输入消息..." onkeydown="if(event.key==='Enter'){event.preventDefault();app.sendTestChat()}"><button type="button" class="primary" onclick="app.sendTestChat()">发送</button></div></div>`,async()=>{});
      document.querySelector('#modal-form button[type=submit]')?.remove();
      setTimeout(()=>{const el=document.querySelector('#test-chat-thread');if(el)el.scrollTop=el.scrollHeight},0);
    },
    async sendTestChat(){
      const input=document.querySelector('#test-chat-input');
      const content=input?.value?.trim();
      if(!content){this.toast('请输入消息',true);return}
      this.testChat.push({role:'user',content});
      try{
        const r=await this.api(`/agents/${this.agentId}/test-chat`,{method:'POST',body:JSON.stringify({content,history:this.testChat.slice(0,-1)})});
        this.testChat.push({role:'assistant',content:r.reply});
        input.value='';
        this.openTestChat(true);
      }catch(e){this.testChat.pop();this.toast(e.message,true)}
    },
  };
  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages["agent"] = true;
})();
