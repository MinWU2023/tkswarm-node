(function () {
  if (!window.app) throw new Error('app-core must load before pages/aiCallLogs.js');
  const __methods = {
    async renderAiCallLogs(){
      const host=document.querySelector('#content');
      if(!host)return;
      if(!this.canPermission('system.ai_log')&&!this.canPermission('system.ai_platform')&&!this.canPermission('system.view')&&!this.canPermission('rbac.manage')){
        host.innerHTML=`<div class="panel"><div class="empty">当前角色无权查看 AI 记录</div></div>`;
        return;
      }
      const canManage=this.canPermission('system.ai_log')||this.canPermission('system.ai_platform')||this.canPermission('rbac.manage');
      const kw=this.aiLogKeyword||'';
      const st=this.aiLogStatus||'';
      const op=this.aiLogOperation||'';
      const page=this.aiLogPage||1;
      try{
        const q=`?page=${page}&pageSize=20&keyword=${encodeURIComponent(kw)}&status=${encodeURIComponent(st)}&operation=${encodeURIComponent(op)}`;
        const pack=await this.api('/ai-call-logs'+q);
        const rows=pack.items||[];
        const ops=pack.operations||[];
        this.aiLogOperations=ops;
        const pager={page:pack.page||1,pages:pack.pages||1,total:pack.total||0,pageSize:pack.pageSize||20,items:rows};
        this.aiLogPage=pager.page;
        host.innerHTML=`
          <div class="panel list-panel">
            <div class="matrix-action-bar">
              <div class="left"><span class="muted">共 ${pager.total} 条 · 记录平台、配置、用户、操作、体积与请求/响应内容</span></div>
              <div class="right">
                ${canManage?`<button class="tiny danger" type="button" onclick="app.clearAiCallLogs()">清理记录</button>`:''}
                <button class="ghost tiny" type="button" onclick="app.refresh()">刷新</button>
              </div>
            </div>
            <div class="search-bar task-filter-bar">
              <select id="ai-log-status" class="input">
                <option value="">全部状态</option>
                <option value="success" ${st==='success'?'selected':''}>成功</option>
                <option value="failed" ${st==='failed'?'selected':''}>失败</option>
              </select>
              <select id="ai-log-operation" class="input">
                <option value="">全部操作</option>
                ${ops.map(o=>`<option value="${this.esc(o.code)}" ${op===o.code?'selected':''}>${this.esc(o.label)}</option>`).join('')}
              </select>
              <input id="ai-log-search" class="input" type="search" placeholder="平台 / 配置 / 用户 / 操作" value="${this.esc(kw)}" onkeydown="if(event.key==='Enter')app.searchAiCallLogs()">
              <button class="primary" type="button" onclick="app.searchAiCallLogs()">查询</button>
              <button class="ghost" type="button" onclick="app.resetAiCallLogs()">重置</button>
            </div>
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>时间</th>
                    <th>平台</th>
                    <th>配置</th>
                    <th>用户</th>
                    <th>操作</th>
                    <th>输入KB</th>
                    <th>输出KB</th>
                    <th>状态</th>
                    <th>耗时</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows.length?rows.map(r=>`
                    <tr>
                      <td><b>#${r.id}</b></td>
                      <td class="muted" style="white-space:nowrap">${this.esc(r.createdAt||'-')}</td>
                      <td><b>${this.esc(r.platformName||'-')}</b><div class="muted">${this.esc(r.platformCode||'')}</div></td>
                      <td>${this.esc(r.configName||'-')}${r.configId?`<div class="muted">#${r.configId}</div>`:''}</td>
                      <td>${this.esc(r.username||'-')}${r.userId?`<div class="muted">#${r.userId}</div>`:''}</td>
                      <td>${this.esc(r.operationLabel||r.operation||'-')}</td>
                      <td>${r.inputKb??0}</td>
                      <td>${r.outputKb??0}</td>
                      <td>${this.badge(r.status==='success'?'online':'offline')} ${r.status==='success'?'成功':'失败'}${r.errorMessage?`<div class="muted" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${this.esc(r.errorMessage)}">${this.esc(r.errorMessage)}</div>`:''}</td>
                      <td class="muted">${r.durationMs??0}ms</td>
                      <td style="white-space:nowrap">
                        <button class="tiny" type="button" onclick="app.viewAiCallLog(${r.id})">详情</button>
                        ${canManage?`<button class="tiny danger" type="button" onclick="app.deleteAiCallLog(${r.id})">删除</button>`:''}
                      </td>
                    </tr>
                  `).join(''):`<tr><td colspan="11"><div class="empty">暂无 AI 调用记录。在「AI开放平台」做连通测试或业务调用后会出现在这里。</div></td></tr>`}
                </tbody>
              </table>
            </div>
            ${UI.pager(pager,'aiLogPage')}
          </div>`;
      }catch(err){
        host.innerHTML=`<div class="panel list-panel"><div class="empty">加载 AI 记录失败: ${this.esc(err.message)}</div></div>`;
      }
    },
    searchAiCallLogs(){
      this.aiLogStatus=document.querySelector('#ai-log-status')?.value||'';
      this.aiLogOperation=document.querySelector('#ai-log-operation')?.value||'';
      this.aiLogKeyword=document.querySelector('#ai-log-search')?.value?.trim()||'';
      this.aiLogPage=1;
      this.refresh();
    },
    resetAiCallLogs(){this.aiLogStatus='';this.aiLogOperation='';this.aiLogKeyword='';this.aiLogPage=1;this.refresh()},
    async viewAiCallLog(id){
      try{
        const r=await this.api(`/ai-call-logs/${id}`);
        this.modal('AI 调用详情 #'+id,`
          <div class="form-grid ai-log-detail">
            <div class="field"><label>平台</label><div>${this.esc(r.platformName||'-')} <span class="muted">${this.esc(r.platformCode||'')}</span></div></div>
            <div class="field"><label>配置</label><div>${this.esc(r.configName||'-')} ${r.configId?`(#${r.configId})`:''}</div></div>
            <div class="field"><label>用户</label><div>${this.esc(r.username||'-')} ${r.userId?`(#${r.userId})`:''}</div></div>
            <div class="field"><label>操作</label><div>${this.esc(r.operationLabel||r.operation||'-')}</div></div>
            <div class="field"><label>时间</label><div>${this.esc(r.createdAt||'-')}</div></div>
            <div class="field"><label>状态</label><div>${r.status==='success'?'成功':'失败'}${r.errorMessage?` · ${this.esc(r.errorMessage)}`:''}</div></div>
            <div class="field"><label>模型</label><div>${this.esc(r.model||'-')}</div></div>
            <div class="field"><label>耗时</label><div>${r.durationMs??0} ms</div></div>
            <div class="field"><label>输入</label><div>${r.inputKb??0} KB（${r.inputBytes??0} bytes）</div></div>
            <div class="field"><label>输出</label><div>${r.outputKb??0} KB（${r.outputBytes??0} bytes）</div></div>
            <div class="field full"><label>请求内容</label><pre class="ai-prompt-preview-src">${this.esc(r.requestContent||'')}</pre></div>
            <div class="field full"><label>响应内容</label><pre class="ai-prompt-preview-out">${this.esc(r.responseContent||'')}</pre></div>
          </div>
        `,async()=>{},false,{hideSubmit:true,wide:true});
      }catch(e){this.toast(e.message,true)}
    },
    async deleteAiCallLog(id){
      if(!(await this.ask(`确定删除记录 #${id} 吗？`)))return;
      try{await this.api(`/ai-call-logs/${id}`,{method:'DELETE'});this.toast('已删除');this.refresh()}catch(e){this.toast(e.message,true)}
    },
    async clearAiCallLogs(){
      if(!(await this.ask('确定清理当前可见范围的全部 AI 记录吗？此操作不可恢复。')))return;
      try{const r=await this.api('/ai-call-logs/clear',{method:'POST',body:'{}'});this.toast(`已清理 ${r.deleted||0} 条`);this.refresh()}catch(e){this.toast(e.message,true)}
    },
  };
  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages["aiCallLogs"] = true;
})();
