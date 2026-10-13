(function () {
  if (!window.app) throw new Error('app-core must load before pages/aiPlatform.js');
  const __methods = {
    async renderAiPlatform(){
      const host=document.querySelector('#content');
      if(!host)return;
      if(!this.canPermission('system.ai_platform')&&!this.canPermission('system.view')&&!this.canPermission('rbac.manage')){
        host.innerHTML=`<div class="panel"><div class="empty">当前角色无权管理 AI 开放平台</div></div>`;
        return;
      }
      const region=this.aiPlatformRegion||'';
      const kw=this.aiPlatformKeyword||'';
      try{
        const q=`?region=${encodeURIComponent(region)}&keyword=${encodeURIComponent(kw)}`;
        const pack=await this.api('/ai-platforms'+q);
        const platforms=pack.items||[];
        const active=pack.active||null;
        const regions=pack.regions||[{code:'cn',label:'国内'},{code:'intl',label:'国际'}];
        if(this.aiPlatformRegion==='local')this.aiPlatformRegion='';
        if(this.aiPlatformId&&!platforms.some(p=>Number(p.id)===Number(this.aiPlatformId)))this.aiPlatformId=null;
        if(!this.aiPlatformId&&platforms[0])this.aiPlatformId=platforms[0].id;
        const selected=platforms.find(p=>Number(p.id)===Number(this.aiPlatformId))||null;
        let configs=[];
        let fields=[];
        let models=[];
        if(selected){
          const cfgPack=await this.api(`/ai-platforms/${selected.id}/configs`);
          configs=cfgPack.items||[];
          fields=(cfgPack.platform&&cfgPack.platform.fields)||[];
          this.aiPlatformFields=fields;
          this.aiPlatformSelected=cfgPack.platform||selected;
          const mPack=await this.api(`/ai-platforms/${selected.id}/models`).catch(()=>({items:[]}));
          models=mPack.items||[];
          this.aiPlatformModels=models;
        }
        const canEdit=this.canPermission('system.ai_platform')||this.canPermission('rbac.manage');
        host.innerHTML=`
          <div class="panel list-panel ai-platform-page">
            <div class="matrix-action-bar">
              <div class="left">
                <span class="muted">平台卡片 + 开发配置列表 · 全局启用一套配置供业务调用</span>
                ${active?`<span class="badge running" style="margin-left:8px">当前启用：${this.esc(active.platformName||'')} / ${this.esc(active.name||'')}</span>`:'<span class="badge offline" style="margin-left:8px">尚未启用任何配置</span>'}
              </div>
              <div class="right"><button class="ghost tiny" type="button" onclick="app.refresh()">刷新</button></div>
            </div>
            <div class="search-bar task-filter-bar">
              <button type="button" class="tiny ${!region?'primary':''}" onclick="app.setAiPlatformRegion('')">全部</button>
              ${regions.map(r=>`<button type="button" class="tiny ${region===r.code?'primary':''}" onclick="app.setAiPlatformRegion('${this.esc(r.code)}')">${this.esc(r.label)}</button>`).join('')}
              <input id="ai-platform-search" class="input" type="search" placeholder="搜索平台名称 / 代码" value="${this.esc(kw)}" onkeydown="if(event.key==='Enter')app.searchAiPlatforms()">
              <button class="primary" type="button" onclick="app.searchAiPlatforms()">查询</button>
              <button class="ghost" type="button" onclick="app.resetAiPlatforms()">重置</button>
            </div>
            <div class="ai-platform-grid">
              ${platforms.length?platforms.map(p=>`
                <div class="ai-platform-card ${Number(p.id)===Number(this.aiPlatformId)?'active':''} ${p.enabled?'':'is-disabled'}" role="button" tabindex="0" onclick="app.selectAiPlatform(${p.id})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();app.selectAiPlatform(${p.id})}">
                  <div class="ai-platform-card-top">
                    <b>${this.esc(p.name)}</b>
                    <span class="badge ${p.enabled?'online':'offline'}">${p.enabled?'启用':'停用'}</span>
                  </div>
                  <div class="muted ai-platform-code">${this.esc(p.code)} · ${this.esc(p.regionLabel||p.region)} · ${this.esc(p.driver)}</div>
                  <p class="ai-platform-desc">${this.esc(p.description||'')}</p>
                  <div class="ai-platform-card-meta">
                    <span>配置 ${p.configCount??0}</span>
                    ${(p.activeCount||0)>0?'<span class="badge running">全局启用中</span>':''}
                  </div>
                </div>
              `).join(''):'<div class="empty" style="grid-column:1/-1">暂无平台，请刷新或检查种子数据</div>'}
            </div>
            ${selected?`
            <div class="ai-config-section">
              <div class="matrix-action-bar" style="margin-top:16px">
                <div class="left"><b>${this.esc(selected.name)}</b> <span class="muted">开发配置 · 字段随平台变化</span></div>
                <div class="right">
                  ${canEdit?`<button class="tiny" type="button" onclick="app.toggleAiPlatformEnabled(${selected.id},${selected.enabled?0:1})">${selected.enabled?'停用平台':'启用平台'}</button>
                  <button class="primary tiny" type="button" onclick="app.editAiPlatformConfig()">新增配置</button>`:''}
                </div>
              </div>
              <div class="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>名称</th>
                      <th>模型 / 关键信息</th>
                      <th>状态</th>
                      <th>全局启用</th>
                      <th>更新时间</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${configs.length?configs.map(c=>{
                      const model=c.config?.model||c.config?.deployment||'-';
                      const base=c.config?.base_url||c.config?.endpoint||'';
                      return `<tr>
                        <td><b>#${c.id}</b></td>
                        <td>${this.esc(c.name)}${c.remark?`<div class="muted">${this.esc(c.remark)}</div>`:''}</td>
                        <td><b>${this.esc(String(model))}</b>${base?`<div class="muted" style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${this.esc(String(base))}</div>`:''}</td>
                        <td>${this.badge(c.enabled?'online':'offline')} ${c.enabled?'启用':'禁用'}</td>
                        <td>${c.isActive?'<span class="badge running">当前启用</span>':'<span class="muted">—</span>'}</td>
                        <td class="muted">${this.esc(c.updatedAt||'-')}</td>
                        <td style="white-space:nowrap">
                          ${canEdit?`<button class="tiny" onclick='app.editAiPlatformConfig(${JSON.stringify(c)})'>编辑</button>
                          ${!c.isActive?`<button class="tiny primary" onclick="app.activateAiPlatformConfig(${c.id})">设为启用</button>`:''}
                          <button class="tiny" onclick="app.testAiPlatformConfig(${c.id})">连通测试</button>
                          <button class="tiny danger" onclick="app.deleteAiPlatformConfig(${c.id},'${this.esc(c.name)}')">删除</button>`:'<span class="muted">只读</span>'}
                        </td>
                      </tr>`;
                    }).join(''):`<tr><td colspan="7"><div class="empty">该平台暂无开发配置，点击「新增配置」</div></td></tr>`}
                  </tbody>
                </table>
              </div>
              <div class="matrix-action-bar" style="margin-top:20px">
                <div class="left"><b>可用模型</b> <span class="muted">智能体与配置下拉从此列表取值</span></div>
                <div class="right">
                  ${canEdit?`<button class="primary tiny" type="button" onclick="app.editAiPlatformModel()">新增模型</button>`:''}
                </div>
              </div>
              <div class="table-container">
                <table>
                  <thead><tr><th>编码</th><th>名称</th><th>默认</th><th>状态</th><th>操作</th></tr></thead>
                  <tbody>
                    ${models.length?models.map(m=>`<tr>
                      <td><code>${this.esc(m.code)}</code></td>
                      <td>${this.esc(m.name||m.code)}</td>
                      <td>${m.isDefault?'<span class="badge running">默认</span>':'<span class="muted">—</span>'}</td>
                      <td>${this.badge(m.enabled?'online':'offline')} ${m.enabled?'启用':'停用'}</td>
                      <td style="white-space:nowrap">
                        ${canEdit?`<button class="tiny" type="button" onclick='app.editAiPlatformModel(${JSON.stringify(m)})'>编辑</button>
                        <button class="tiny" type="button" onclick="app.toggleAiPlatformModel(${m.id},${m.enabled?0:1})">${m.enabled?'停用':'启用'}</button>
                        <button class="tiny danger" type="button" onclick="app.deleteAiPlatformModel(${m.id},'${this.esc(m.code)}')">删除</button>`:'<span class="muted">只读</span>'}
                      </td>
                    </tr>`).join(''):`<tr><td colspan="5"><div class="empty">暂无模型，点击「新增模型」或刷新以写入内置种子</div></td></tr>`}
                  </tbody>
                </table>
              </div>
            </div>`:'<div class="shell-note" style="margin-top:16px">请选择上方平台卡片查看配置列表</div>'}
          </div>`;
      }catch(err){
        host.innerHTML=`<div class="panel list-panel"><div class="empty">加载 AI 开放平台失败: ${this.esc(err.message)}</div></div>`;
      }
    },
    setAiPlatformRegion(code){this.aiPlatformRegion=code||'';this.aiPlatformId=null;this.refresh()},
    searchAiPlatforms(){this.aiPlatformKeyword=document.querySelector('#ai-platform-search')?.value?.trim()||'';this.refresh()},
    resetAiPlatforms(){this.aiPlatformRegion='';this.aiPlatformKeyword='';this.aiPlatformId=null;this.refresh()},
    selectAiPlatform(id){this.aiPlatformId=id;this.refresh()},
    async toggleAiPlatformEnabled(id,enabled){
      try{await this.api(`/ai-platforms/${id}`,{method:'PUT',body:JSON.stringify({enabled:!!enabled})});this.toast(enabled?'平台已启用':'平台已停用');this.refresh()}catch(e){this.toast(e.message,true)}
    },
    aiPlatformConfigFieldsHtml(fields,cfg={}){
      const c=cfg.config||{};
      return (fields||[]).map(f=>{
        const key=f.key;
        const val=c[key];
        const type=f.type||'text';
        const req=f.required?' required':'';
        const ph=f.placeholder?` placeholder="${this.esc(f.placeholder)}"`:'';
        if(type==='secret'){
          const show=(cfg.hasSecrets&&cfg.hasSecrets[key])?'******':(val||'');
          return `<div class="field"><label>${this.esc(f.label||key)}${f.required?' *':''}</label><input class="input" name="cfg_${this.esc(key)}" type="password" value="${this.esc(String(show||''))}"${req}${ph} autocomplete="new-password"></div>`;
        }
        if(type==='number'){
          return `<div class="field"><label>${this.esc(f.label||key)}${f.required?' *':''}</label><input class="input" name="cfg_${this.esc(key)}" type="number" step="any" value="${this.esc(String(val??f.default??''))}"${req}${ph}></div>`;
        }
        if(type==='boolean'||type==='bool'){
          const on=val===true||val===1||val==='true';
          return `<div class="field"><label>${this.esc(f.label||key)}</label><select class="input" name="cfg_${this.esc(key)}"><option value="true" ${on?'selected':''}>是</option><option value="false" ${!on?'selected':''}>否</option></select></div>`;
        }
        if(key==='model'||key==='deployment'){
          const models=(this.aiPlatformModels||[]).filter(m=>m.enabled!==false);
          const cur=String(val??f.default??'');
          if(models.length){
            const opts=models.map(m=>`<option value="${this.esc(m.code)}" ${cur===m.code?'selected':''}>${this.esc(m.name||m.code)} (${this.esc(m.code)})</option>`).join('');
            const extra=cur&&!models.some(m=>m.code===cur)?`<option value="${this.esc(cur)}" selected>${this.esc(cur)}</option>`:'';
            return `<div class="field"><label>${this.esc(f.label||key)}${f.required?' *':''}</label><select class="input" name="cfg_${this.esc(key)}"${req}>${extra}${opts}</select></div>`;
          }
        }
        return `<div class="field ${type==='textarea'?'full':''}"><label>${this.esc(f.label||key)}${f.required?' *':''}</label><${type==='textarea'?'textarea':'input'} class="input" name="cfg_${this.esc(key)}" ${type==='textarea'?'':`type="text" value="${this.esc(String(val??f.default??''))}"`}${req}${ph}>${type==='textarea'?this.esc(String(val??'')):''}</${type==='textarea'?'textarea':'input'}></div>`;
      }).join('');
    },
    editAiPlatformConfig(c=null){
      const platform=this.aiPlatformSelected||{};
      const fields=this.aiPlatformFields||platform.fields||[];
      if(!this.aiPlatformId){this.toast('请先选择平台',true);return}
      const isEdit=!!(c&&c.id);
      this.modal(isEdit?'编辑开发配置':'新增开发配置',`
        <div class="form-grid">
          <input type="hidden" name="id" value="${c?.id||''}">
          ${this.field('name','配置名称',c?.name||'','text',true)}
          ${this.selectRaw('enabled','状态',[['true','启用'],['false','禁用']],(c?.enabled===false||c?.enabled===0)?'false':'true')}
          ${this.selectRaw('isActive','设为全局启用',[['false','否'],['true','是']],c?.isActive?'true':'false')}
          ${this.field('remark','备注',c?.remark||'')}
          <div class="field full"><div class="muted">以下字段来自「${this.esc(platform.name||'')}」平台 schema，不同平台项可不同。密钥未改请保留 ******</div></div>
          ${this.aiPlatformConfigFieldsHtml(fields,c||{})}
        </div>
      `,async(d)=>{
        const id=d.id; delete d.id;
        const config={};
        (fields||[]).forEach(f=>{
          const k='cfg_'+f.key;
          if(d[k]===undefined)return;
          let v=d[k];
          if((f.type==='number')&&v!=='')v=Number(v);
          if(f.type==='boolean'||f.type==='bool')v=v==='true'||v===true;
          config[f.key]=v;
          delete d[k];
        });
        const payload={
          platform_id:Number(this.aiPlatformId),
          name:d.name,
          enabled:d.enabled==='true'||d.enabled===true,
          is_active:d.isActive==='true'||d.isActive===true,
          remark:d.remark||'',
          config
        };
        if(id) await this.api(`/ai-platform-configs/${id}`,{method:'PUT',body:JSON.stringify(payload)});
        else await this.api('/ai-platform-configs',{method:'POST',body:JSON.stringify(payload)});
        this.toast(id?'配置已更新':'配置已创建');
        this.refresh();
      });
    },
    async activateAiPlatformConfig(id){
      if(!(await this.ask('设为全局启用后，业务调用将使用此配置，确定？')))return;
      try{await this.api(`/ai-platform-configs/${id}/activate`,{method:'POST',body:'{}'});this.toast('已设为全局启用');this.refresh()}catch(e){this.toast(e.message,true)}
    },
    async deleteAiPlatformConfig(id,name){
      if(!(await this.ask(`确定删除配置「${name}」吗？`)))return;
      try{await this.api(`/ai-platform-configs/${id}`,{method:'DELETE'});this.toast('已删除');this.refresh()}catch(e){this.toast(e.message,true)}
    },
    editAiPlatformModel(m=null){
      if(!this.aiPlatformId){this.toast('请先选择平台',true);return}
      const isEdit=!!(m&&m.id);
      this.modal(isEdit?'编辑模型':'新增模型',`
        <div class="form-grid">
          <input type="hidden" name="id" value="${m?.id||''}">
          ${this.field('code','模型编码',m?.code||'','text',true)}
          ${this.field('name','展示名称',m?.name||'')}
          ${this.selectRaw('enabled','状态',[['true','启用'],['false','停用']],m?.enabled===false?'false':'true')}
          ${this.selectRaw('isDefault','设为默认',[['false','否'],['true','是']],m?.isDefault?'true':'false')}
          ${this.field('sortOrder','排序',m?.sortOrder??0,'number')}
        </div>
      `,async(d)=>{
        const body={
          platformId:Number(this.aiPlatformId),
          code:d.code,
          name:d.name||d.code,
          enabled:d.enabled==='true'||d.enabled===true,
          isDefault:d.isDefault==='true'||d.isDefault===true,
          sortOrder:Number(d.sortOrder||0),
        };
        if(!String(body.code||'').trim()){this.toast('请填写模型编码',true);return}
        if(d.id) await this.api(`/ai-platform-models/${d.id}`,{method:'PUT',body:JSON.stringify(body)});
        else await this.api('/ai-platform-models',{method:'POST',body:JSON.stringify(body)});
        this.toast(d.id?'模型已更新':'模型已添加');
        this.refresh();
      });
    },
    async toggleAiPlatformModel(id,enabled){
      try{await this.api(`/ai-platform-models/${id}/status`,{method:'PATCH',body:JSON.stringify({enabled:!!enabled})});this.toast(enabled?'已启用':'已停用');this.refresh()}catch(e){this.toast(e.message,true)}
    },
    async deleteAiPlatformModel(id,code){
      if(!(await this.ask(`确定删除模型「${code}」吗？`)))return;
      try{await this.api(`/ai-platform-models/${id}`,{method:'DELETE'});this.toast('已删除');this.refresh()}catch(e){this.toast(e.message,true)}
    },
    async testAiPlatformConfig(id){
      this.modal('连通测试',`
        <div class="form-grid">
          <input type="hidden" name="config_id" value="${id}">
          ${this.field('prompt','测试提示词','你好，请用一句话介绍你自己。','textarea',true)}
        </div>
      `,async(d)=>{
        try{
          const r=await this.api('/ai-platforms/test',{method:'POST',body:JSON.stringify({config_id:Number(d.config_id||id),prompt:d.prompt})});
          this.closeModal();
          this.modal('测试结果',`<div class="shell-note"><b>回复</b><pre style="white-space:pre-wrap;margin:8px 0 0">${this.esc(r.reply||'')}</pre><div class="muted" style="margin-top:10px">模型：${this.esc(r.model||'-')} · 平台：${this.esc(r.platform?.name||'-')}</div></div>`,async()=>{},false,{hideSubmit:true});
        }catch(e){this.toast(e.message||'连通测试失败',true);throw e}
      },false,{submitText:'开始测试'});
    },
  };
  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages["aiPlatform"] = true;
})();
