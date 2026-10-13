(function () {
  if (!window.app) throw new Error('app-core must load before pages/publish.js');
  const __methods = {
    toggleCreatePublishMenu(e){
      e?.stopPropagation?.();
      this.toggleToolbarDropdown('#create-publish-menu', e);
    },
    toggleTaskBatchMenu(e){
      e?.stopPropagation?.();
      this.toggleToolbarDropdown('#task-batch-menu', e);
    },
    taskPublishMode(x){
      const mode=String(x?.payload?.publishMode||x?.payload?.publish_mode||'').toLowerCase();
      if(mode==='ordered')return 'ordered';
      if(mode==='independent')return 'independent';
      if(mode==='random')return 'random';
      if(x?.type==='message')return 'message';
      const strategy=String(x?.payload?.publishStrategy||'').toLowerCase();
      if(strategy==='deduplicate')return 'independent';
      if(strategy==='pairs')return 'ordered';
      if(x?.type==='publish')return 'random';
      return '';
    },
    taskTypeLabel(x){
      const mode=this.taskPublishMode(x);
      if(mode==='ordered')return '群发任务';
      if(mode==='independent')return '独立发布';
      if(mode==='random')return '随机发布';
      if(x?.type==='message')return '历史消息';
      const types=this.meta?.taskTypes||{publish:'视频发布',message:'消息群发'};
      return types[x?.type]||x?.type||'-';
    },
    async renderTasks(opts={}){
      const gen=opts.gen||this._matrixSwitchGen;
      const still=()=>gen===this._matrixSwitchGen&&this.view==='publish'&&this.matrixTab==='tasks';
      if(this.taskRefreshTimer)clearInterval(this.taskRefreshTimer);
      const status=this.taskStatusFilter||'';
      const typeFilter=this.taskTypeFilter||'';
      const modeFilter=this.taskModeFilter||'';
      const keyword=String(this.taskKeyword||'').trim().toLowerCase();
      const page=this.taskPage||1;
      // 分两次拉 publish / message，兼容线上旧 API（不支持 type=a,b 多值）
      const [pubPack,msgPack]=await Promise.all([
        this.api('/tasks?page=1&pageSize=200&type=publish'),
        this.api('/tasks?page=1&pageSize=200&type=message').catch(()=>({items:[]})),
      ]);
      if(!still())return;
      const typeItems=[...(pubPack.items||[]),...(msgPack.items||[])].sort((a,b)=>Number(b.id||0)-Number(a.id||0));
      const modeOf=x=>this.taskPublishMode(x);
      const modeCounts={
        random:typeItems.filter(x=>modeOf(x)==='random').length,
        ordered:typeItems.filter(x=>modeOf(x)==='ordered').length,
        independent:typeItems.filter(x=>modeOf(x)==='independent').length,
        message:typeItems.filter(x=>x.type==='message').length,
        publish:typeItems.filter(x=>x.type==='publish').length,
      };
      let filtered=typeItems.slice();
      if(status)filtered=filtered.filter(x=>x.status===status);
      if(typeFilter==='publish'&&!modeFilter)filtered=filtered.filter(x=>x.type==='publish');
      if(typeFilter==='message')filtered=filtered.filter(x=>x.type==='message');
      if(modeFilter)filtered=filtered.filter(x=>modeOf(x)===modeFilter);
      if(keyword)filtered=filtered.filter(x=>String(x.name||'').toLowerCase().includes(keyword));
      const statusCounts={all:typeItems.length};
      ['draft','queued','running','paused','completed','failed','cancelled'].forEach(k=>{statusCounts[k]=typeItems.filter(x=>x.status===k).length});
      const pack=UI.paginateLocal(filtered,page,15);
      this.taskPage=pack.page;
      const d={items:pack.items,total:pack.total,page:pack.page,pages:pack.pages,pageSize:pack.pageSize||15};
      const queuedNode=filtered.filter(x=>x.status==='queued'&&['publish','message','warm','sync_fans','dm_sync','sync','profile'].includes(x.type)).length;
      // Node 探测放到首屏之后，避免切换 Tab 时多等 2.5s
      let nodeHint=queuedNode>0
        ?`<div class="shell-note" id="task-node-hint" style="margin:0 0 12px">有 <b>${queuedNode}</b> 个任务在排队，正在检测本机 Node…</div>`
        :'';
      const typeSelectValue=modeFilter||(typeFilter==='message'?'message':'');
      const typeOpts=[
        ['',`全部 (${(modeCounts.publish||0)+(modeCounts.message||0)})`],
        ['random',`随机发布 (${modeCounts.random||0})`],
        ['ordered',`群发任务 (${modeCounts.ordered||0})`],
        ['independent',`独立发布 (${modeCounts.independent||0})`],
      ];
      if(modeCounts.message)typeOpts.push(['message',`历史消息 (${modeCounts.message})`]);
      const statusOpts=[
        ['',`全部 (${statusCounts.all||0})`],
        ...this.taskStatusPairs().map(([k,n])=>[k,`${n} (${statusCounts[k]||0})`]),
      ];
      const html=`<div class="panel tasks-panel">
        <div class="matrix-action-bar">
          <div class="left">
            ${this.canPermission('publish.tasks')||this.canPermission('publish.mass')?`<div class="dropdown"><button class="primary" type="button" onclick="app.toggleCreatePublishMenu(event)">创建 <span class="btn-arrow-down">▾</span></button><div id="create-publish-menu" class="dropdown-menu align-left hidden">${this.canPermission('publish.tasks')?`<button type="button" onclick="app.openPublishWizard('random')">随机发布</button>`:''}${this.canPermission('publish.tasks')||this.canPermission('publish.mass')?`<button type="button" onclick="app.openPublishWizard('ordered')">群发任务</button>`:''}${this.canPermission('publish.tasks')?`<button type="button" onclick="app.openPublishWizard('independent')">独立发布</button>`:''}${this.canPermission('publish.tasks')?`<button type="button" onclick="app.openDeleteWizard()">删除视频</button>`:''}${this.canPermission('publish.tasks')?`<button type="button" onclick="app.openCommentReplyWizard()">回复评论</button>`:''}</div></div>`:''}
            <button class="ghost" onclick="app.refresh()">刷新</button>
            <button class="ghost" onclick="app.openTaskIo()">导入导出</button>
            ${this.canPermission('publish.tasks')||this.canPermission('publish.mass')?`<div class="dropdown"><button class="ghost" type="button" onclick="app.toggleTaskBatchMenu(event)">批量操作 <span class="btn-arrow-down">▾</span></button><div id="task-batch-menu" class="dropdown-menu align-left hidden"><button type="button" onclick="app.batchTaskAction('start')">批量启动</button><button type="button" onclick="app.batchTaskAction('pause')">批量暂停</button><button type="button" onclick="app.batchTaskAction('cancel')">批量取消</button><button type="button" onclick="app.batchRetryTasks()">批量重试</button><button type="button" class="is-danger" onclick="app.batchDeleteTasks()">批量删除</button></div></div>`:''}
          </div>
          <div class="right"><span class="muted">随机 / 群发 / 独立发布任务均在此列表；运行中会自动刷新</span></div>
        </div>
        ${nodeHint}
        <div class="search-bar task-filter-bar">
          <select id="task-type-filter" class="input" title="任务类型">
            ${typeOpts.map(([v,n])=>`<option value="${this.esc(v)}" ${typeSelectValue===v?'selected':''}>${this.esc(n)}</option>`).join('')}
          </select>
          <select id="task-status-filter" class="input" title="任务状态">
            ${statusOpts.map(([v,n])=>`<option value="${this.esc(v)}" ${status===v?'selected':''}>${this.esc(n)}</option>`).join('')}
          </select>
          <input id="task-name-filter" class="input" type="search" placeholder="任务名称" value="${this.esc(this.taskKeyword||'')}" onkeydown="if(event.key==='Enter')app.searchTasks()">
          <button class="primary" type="button" onclick="app.searchTasks()">搜索</button>
          <button class="ghost" type="button" onclick="app.resetTaskFilters()">重置</button>
        </div>
        <div class="table-container">${this.taskTable(d.items)}</div>
        ${UI.pager(d,'taskPage')}
      </div>`;
      if(!still())return;
      this.mountMatrixPanel(html,'tasks',{soft:!!opts.soft});
      if(queuedNode>0){
        Promise.resolve(this.probeNodeOnline()).then(nodeOk=>{
          if(!still())return;
          const el=document.querySelector('#task-node-hint');
          if(!el)return;
          el.innerHTML=nodeOk
            ?`本机 Node 在线；排队中的自动化任务将由 task-runner 领取。`
            :`有 <b>${queuedNode}</b> 个任务在排队等待本机 Node。请启动本机服务（start.bat）后再观察进度。`;
        }).catch(()=>{});
      }
      if(d.items.some(x=>['queued','running'].includes(x.status))||filtered.some(x=>['queued','running'].includes(x.status))){
        this.taskRefreshTimer=setInterval(()=>{if(this.view==='publish'&&this.matrixTab==='tasks'&&!this.wizardOpen&&!this.massWizardOpen)this.renderPublish();else clearInterval(this.taskRefreshTimer)},3000);
      }
    },
    setTaskTypeFilter(type){this.taskTypeFilter=type||'';this.taskModeFilter='';this.taskPage=1;this.refresh()},
    setTaskModeFilter(mode){this.taskModeFilter=mode||'';this.taskTypeFilter=mode?'publish':'';this.taskPage=1;this.refresh()},
    setTaskStatusFilter(status){this.taskStatusFilter=status||'';this.taskPage=1;this.refresh()},
    searchTasks(){
      const typeVal=String(document.querySelector('#task-type-filter')?.value||'').trim();
      const statusVal=String(document.querySelector('#task-status-filter')?.value||'').trim();
      const nameVal=String(document.querySelector('#task-name-filter')?.value||'').trim();
      if(typeVal==='message'){this.taskTypeFilter='message';this.taskModeFilter='';}
      else if(['random','ordered','independent'].includes(typeVal)){this.taskModeFilter=typeVal;this.taskTypeFilter='publish';}
      else{this.taskTypeFilter='';this.taskModeFilter='';}
      this.taskStatusFilter=statusVal;
      this.taskKeyword=nameVal;
      this.taskPage=1;
      this.refresh();
    },
    resetTaskFilters(){
      this.taskTypeFilter='';
      this.taskModeFilter='';
      this.taskStatusFilter='';
      this.taskKeyword='';
      this.taskPage=1;
      this.refresh();
    },
    async filterTasks(){this.searchTasks()},
    async exportTaskResultsCsv(id){try{const ok=await this.downloadAuth(`/api/tasks/${id}/results.csv`,`task-${id}-results.csv`,'没有可导出的任务结果');if(ok)this.toast('结果已导出')}catch(e){this.toast(e.message,true)}},
    openTaskIo(tab){
      this.matrixTab='io';
      this.taskIoTab=tab==='import'?'import':'export';
      this.wizardOpen=false;this.massWizardOpen=false;
      if(!Array.isArray(this.taskIoFields)||!this.taskIoFields.length)this.taskIoFields=this.defaultTaskIoFields();
      this.refresh();
    },
    defaultTaskIoFields(){
      return [
        {key:'id',label:'ID',on:true},
        {key:'name',label:'任务名称',on:true},
        {key:'type',label:'类型',on:true},
        {key:'publish_mode',label:'发布模式',on:true},
        {key:'status',label:'状态',on:true},
        {key:'group_name',label:'分组',on:true},
        {key:'total_count',label:'总数',on:true},
        {key:'success_count',label:'成功',on:true},
        {key:'fail_count',label:'失败',on:true},
        {key:'scheduled_at',label:'计划时间',on:false},
        {key:'started_at',label:'开始时间',on:false},
        {key:'finished_at',label:'结束时间',on:false},
        {key:'created_at',label:'创建时间',on:true},
        {key:'account_ids',label:'账号ID',on:false},
        {key:'material_ids',label:'素材ID',on:false},
      ];
    },
    switchTaskIoTab(tab){this.taskIoTab=tab==='import'?'import':'export';this.refresh()},
    async renderTaskIo(){
      if(this.taskRefreshTimer)clearInterval(this.taskRefreshTimer);
      const tab=this.taskIoTab||'export';
      if(!Array.isArray(this.taskIoFields)||!this.taskIoFields.length)this.taskIoFields=this.defaultTaskIoFields();
      const f=this.taskIoFilter||{};
      document.querySelector('#content').innerHTML=`<div class="panel task-io-panel">
        <div class="task-io-head">
          <button class="ghost" type="button" onclick="app.matrixTab='tasks';app.refresh()">← 返回视频任务</button>
          <div class="task-io-title-row">
            <b class="task-io-title">任务导入导出</b>
            <span class="muted">导出可自定义字段与表头；导入按固定模板，每行创建 1 个独立发布任务</span>
          </div>
        </div>
        <div class="subtabs" style="margin-bottom:14px">
          <button type="button" class="${tab==='export'?'active':''}" onclick="app.switchTaskIoTab('export')">导出数据</button>
          <button type="button" class="${tab==='import'?'active':''}" onclick="app.switchTaskIoTab('import')">导入数据</button>
        </div>
        ${tab==='import'?this.taskIoImportBody():this.taskIoExportBody(f)}
      </div>`;
    },
    taskIoExportBody(f){
      f=f||{};
      const typeOpts=[['','全部类型'],['publish','视频发布'],['message','消息群发'],['random','随机发布'],['ordered','群发任务'],['independent','独立发布']];
      const statusOpts=[['','全部状态'],...this.taskStatusPairs()];
      const fields=this.taskIoFields||[];
      return `<div class="task-io-export">
        <div class="form-grid task-io-filters">
          <div class="field"><label>类型</label><select id="tio-type" class="input">${typeOpts.map(([v,n])=>`<option value="${this.esc(v)}" ${String(f.type||'')===v?'selected':''}>${this.esc(n)}</option>`).join('')}</select></div>
          <div class="field"><label>状态</label><select id="tio-status" class="input">${statusOpts.map(([v,n])=>`<option value="${this.esc(v)}" ${String(f.status||'')===v?'selected':''}>${this.esc(n)}</option>`).join('')}</select></div>
          <div class="field"><label>任务名称</label><input id="tio-name" class="input" type="search" placeholder="模糊匹配" value="${this.esc(f.name||'')}"></div>
          <div class="field"><label>创建时间起</label><input id="tio-date-from" class="input" type="datetime-local" value="${this.esc(f.dateFrom||'')}"></div>
          <div class="field"><label>创建时间止</label><input id="tio-date-to" class="input" type="datetime-local" value="${this.esc(f.dateTo||'')}"></div>
          <div class="field"><label>ID 最小</label><input id="tio-id-min" class="input" type="number" min="0" placeholder="可空" value="${this.esc(f.idMin||'')}"></div>
          <div class="field"><label>ID 最大</label><input id="tio-id-max" class="input" type="number" min="0" placeholder="可空" value="${this.esc(f.idMax||'')}"></div>
        </div>
        <div class="field full" style="margin:12px 0 8px"><label>导出字段与表头（勾选并自定义表头名）</label></div>
        <div class="table-container task-io-fields-table" style="margin-bottom:14px">
          <table><thead><tr><th style="width:56px">导出</th><th>字段</th><th>表头名</th></tr></thead>
          <tbody>${fields.map((x,i)=>`<tr>
            <td><input type="checkbox" class="tio-field-on" data-idx="${i}" ${x.on?'checked':''}></td>
            <td><code>${this.esc(x.key)}</code></td>
            <td><input class="input tio-field-label" data-idx="${i}" value="${this.esc(x.label||'')}" style="width:100%;max-width:280px"></td>
          </tr>`).join('')}</tbody></table>
        </div>
        <div class="action-bar">
          <button class="primary" type="button" onclick="app.submitTaskIoExport()">导出 CSV</button>
          <button class="ghost" type="button" onclick="app.resetTaskIoExport()">重置筛选与字段</button>
        </div>
      </div>`;
    },
    taskIoImportBody(){
      return `<div class="task-io-import">
        <div class="shell-note" style="margin:0 0 14px">
          <b>固定格式说明：</b>必须使用模板表头；每一行 = 1 个账号 + 1 个视频，导入后全部创建为 <b>独立发布</b> 任务。<br>
          必填列：<code>account_id</code>、<code>material_id</code>；可选：<code>task_name</code>、<code>publish_title</code>、<code>publish_caption</code>。
        </div>
        <div class="action-bar" style="margin-bottom:12px">
          <button class="primary" type="button" onclick="app.downloadTaskImportTemplate()">下载导入模板</button>
          <label class="ghost" style="display:inline-flex;align-items:center;padding:8px 14px;cursor:pointer;border:1px solid #dcdfe6;border-radius:4px">选择 CSV 文件<input type="file" accept=".csv,text/csv,text/plain" hidden onchange="app.loadTaskImportFile(this)"></label>
        </div>
        <div class="form-grid">
          <div class="field full"><label>CSV 内容</label><textarea id="tio-import-content" class="input" rows="12" placeholder="粘贴 CSV，或选择文件自动填入"></textarea></div>
          <div class="field"><label>导入后自动启动</label><select id="tio-auto-start" class="input"><option value="0">否（草稿）</option><option value="1">是（入队）</option></select></div>
        </div>
        <div class="action-bar" style="margin-top:14px">
          <button class="primary" type="button" onclick="app.submitTaskIoImport()">开始导入</button>
        </div>
        <div id="tio-import-result" class="muted" style="margin-top:12px"></div>
      </div>`;
    },
    collectTaskIoExportForm(){
      const fields=(this.taskIoFields||[]).map((x,i)=>{
        const on=!!document.querySelector(`.tio-field-on[data-idx="${i}"]`)?.checked;
        const label=document.querySelector(`.tio-field-label[data-idx="${i}"]`)?.value ?? x.label;
        return {...x,on,label:String(label||x.key).trim()||x.key};
      });
      this.taskIoFields=fields;
      this.taskIoFilter={
        type:document.querySelector('#tio-type')?.value||'',
        status:document.querySelector('#tio-status')?.value||'',
        name:document.querySelector('#tio-name')?.value||'',
        dateFrom:document.querySelector('#tio-date-from')?.value||'',
        dateTo:document.querySelector('#tio-date-to')?.value||'',
        idMin:document.querySelector('#tio-id-min')?.value||'',
        idMax:document.querySelector('#tio-id-max')?.value||'',
      };
      return {filter:this.taskIoFilter,fields};
    },
    resetTaskIoExport(){
      this.taskIoFilter={};
      this.taskIoFields=this.defaultTaskIoFields();
      this.refresh();
    },
    async submitTaskIoExport(){
      const {filter,fields}=this.collectTaskIoExportForm();
      const selected=fields.filter(x=>x.on);
      if(!selected.length){this.toast('请至少勾选一个导出字段',true);return}
      // 类型：发布模式筛选用前端语义，API 仍用 type=publish + 客户端无法滤 mode 时，传 publish 并由后端字段导出；模式筛选在后端暂用 type 近似
      let typeQ='';
      if(filter.type==='message')typeQ='message';
      else if(['random','ordered','independent','publish'].includes(filter.type))typeQ='publish';
      const q=new URLSearchParams();
      if(typeQ)q.set('type',typeQ);
      if(filter.status)q.set('status',filter.status);
      if(filter.name)q.set('name',filter.name);
      if(filter.dateFrom)q.set('dateFrom',filter.dateFrom);
      if(filter.dateTo)q.set('dateTo',filter.dateTo);
      if(filter.idMin)q.set('idMin',filter.idMin);
      if(filter.idMax)q.set('idMax',filter.idMax);
      q.set('fields',selected.map(x=>x.key).join(','));
      q.set('headers',JSON.stringify(Object.fromEntries(selected.map(x=>[x.key,x.label]))));
      // 发布模式：后端导出后再无法精确滤 mode，这里若选了模式则拉全量 publish 后由服务端只导出字段；附加 mode 参数供后端扩展
      if(['random','ordered','independent'].includes(filter.type))q.set('publishMode',filter.type);
      try{
        const headers=this.authToken?{Authorization:'Bearer '+this.authToken}:{};
        const acting=this.getActingAsId();if(acting)headers['X-Acting-As']=String(acting);
        const base=window.TKSWARM_API_BASE||window.__TKSWARM_CONFIG__?.defaultApiBase||'';
        const r=await fetch(base+'/api/tasks/export.csv?'+q.toString(),{headers});
        if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.message||'导出失败')}
        const text=await r.text();
        const lines=String(text||'').split(/\r?\n/).filter(Boolean);
        if(lines.length<=1){this.toast('没有可导出的任务',true);return}
        // 若选了发布模式，在前端二次过滤（CSV 含「发布模式」列时）
        let out=text;
        if(['random','ordered','independent'].includes(filter.type)){
          const modeLabels={random:'随机发布',ordered:'群发任务',independent:'独立发布'};
          const want=modeLabels[filter.type];
          const parsed=this.parseCsvText(text);
          if(parsed.header.length){
            const modeIdx=parsed.header.findIndex(h=>h==='发布模式'||h==='publish_mode');
            if(modeIdx>=0){
              const kept=parsed.rows.filter(row=>String(row[modeIdx]||'')===want);
              const esc=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
              out='\uFEFF'+[parsed.header.map(esc).join(',')].concat(kept.map(row=>row.map(esc).join(','))).join('\r\n');
              if(!kept.length){this.toast('没有可导出的任务',true);return}
            }
          }
        }
        const blob=new Blob([out],{type:'text/csv;charset=utf-8'});
        const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='tasks-export.csv';a.click();URL.revokeObjectURL(url);
        this.toast('任务已导出');
      }catch(e){this.toast(e.message,true)}
    },
    async downloadTaskImportTemplate(){
      try{
        const headers={};if(this.authToken)headers.Authorization='Bearer '+this.authToken;
        const acting=this.getActingAsId();if(acting)headers['X-Acting-As']=String(acting);
        const base=window.TKSWARM_API_BASE||window.__TKSWARM_CONFIG__?.defaultApiBase||'';
        const r=await fetch(base+'/api/tasks/import-template.csv',{headers});
        if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.message||'下载失败')}
        const text=await r.text();
        if(!String(text||'').trim()){this.toast('模板为空',true);return}
        const blob=new Blob([text],{type:'text/csv;charset=utf-8'});
        const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='task-import-template.csv';a.click();URL.revokeObjectURL(url);
        this.toast('模板已下载');
      }catch(e){this.toast(e.message,true)}
    },
    loadTaskImportFile(input){
      const file=input?.files?.[0];if(input)input.value='';
      if(!file)return;
      const reader=new FileReader();
      reader.onload=()=>{const box=document.querySelector('#tio-import-content');if(box)box.value=String(reader.result||'');this.toast(`已读入 ${file.name}`)};
      reader.onerror=()=>this.toast('读取文件失败',true);
      reader.readAsText(file);
    },
    async submitTaskIoImport(){
      const content=document.querySelector('#tio-import-content')?.value||'';
      if(!String(content).trim()){this.toast('请先粘贴 CSV 或选择文件',true);return}
      const autoStart=document.querySelector('#tio-auto-start')?.value==='1';
      if(!(await this.ask(autoStart?'将按模板导入并自动入队（独立发布）。是否继续？':'将按模板导入为草稿（独立发布）。是否继续？')))return;
      try{
        const r=await this.api('/tasks/import',{method:'POST',body:JSON.stringify({content,autoStart})});
        const box=document.querySelector('#tio-import-result');
        const errHtml=(r.errors||[]).length?`<div class="shell-note" style="margin-top:8px">${(r.errors||[]).map(e=>this.esc(e)).join('<br>')}</div>`:'';
        if(box)box.innerHTML=`成功 <b>${r.created||0}</b>，失败 <b>${r.failed||0}</b>${errHtml}`;
        this.toast(r.created?`已导入 ${r.created} 个独立发布任务`:'没有成功导入的行',!r.created);
      }catch(e){this.toast(e.message,true)}
    },
    async exportTasks(){this.openTaskIo('export')},
    toggleAllTasks(checked){document.querySelectorAll('.task-check').forEach(x=>x.checked=checked)},
    async batchRetryTasks(){const ids=[...document.querySelectorAll('.task-check:checked')].map(x=>Number(x.value));if(!ids.length){this.toast('请先选择失败任务',true);return}try{const r=await this.api('/tasks/batch-retry',{method:'POST',body:JSON.stringify({taskIds:ids})});this.toast(r.changed?`批量重试已提交，变更 ${r.changed} 个任务`:'没有可重试的任务（需失败/跳过状态）',!r.changed);this.refresh()}catch(e){this.toast(e.message,true)}},
    async batchDeleteTasks(){const ids=[...document.querySelectorAll('.task-check:checked')].map(x=>Number(x.value));if(!ids.length){this.toast('请先选择任务',true);return}if(!(await this.ask('仅删除未运行任务，确定继续？')))return;try{const r=await this.api('/tasks/batch-delete',{method:'POST',body:JSON.stringify({taskIds:ids})});this.toast(r.deleted?`已删除 ${r.deleted} 个任务${r.blocked?'，'+r.blocked+' 个运行中任务未删除':''}`:'没有可删除的任务',!r.deleted);this.refresh()}catch(e){this.toast(e.message,true)}},
    async batchTaskAction(action){const ids=[...document.querySelectorAll('.task-check:checked')].map(x=>Number(x.value));if(!ids.length){this.toast('请先选择任务',true);return}const names={start:'启动',pause:'暂停',cancel:'取消'};if(action==='cancel'&&!(await this.ask(`确定批量取消 ${ids.length} 个任务吗？`)))return;try{const r=await this.api('/tasks/batch-action',{method:'POST',body:JSON.stringify({taskIds:ids,action})});this.toast(r.changed?`批量${names[action]}完成，变更 ${r.changed} 个任务`:`没有任务被${names[action]||action}`,!r.changed);this.refresh()}catch(e){this.toast(e.message,true)}},
    taskTable(rows){
      if(!rows.length)return '<div class="empty">还没有任务</div>';
      return `<table><thead><tr><th><input type="checkbox" onchange="app.toggleAllTasks(this.checked)" title="全选任务"></th><th>任务</th><th>类型</th><th>分组</th><th>进度</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead><tbody>${rows.map(x=>this.taskRowHtml(x)).join('')}</tbody></table>`;
    },
    taskRowHtml(x){
      const pct=x.total_count?Math.round((x.success_count+x.fail_count)/x.total_count*100):0;
      const canEdit=['draft','paused','failed'].includes(x.status);
      const more=[];
      if(canEdit){
        const startLabel=x.status==='paused'?'重启':(x.status==='failed'?'重试':'启动');
        more.push(`<button type="button" onclick="app.taskAction(${x.id},'start','${this.esc(x.status)}')">${startLabel}</button>`);
      }
      if(['queued','running'].includes(x.status)){
        more.push(`<button type="button" onclick="app.taskAction(${x.id},'pause')">暂停</button>`);
        more.push(`<button type="button" class="is-danger" onclick="app.taskAction(${x.id},'cancel')">取消</button>`);
      }
      if(['queued','running','completed','failed','cancelled','paused'].includes(x.status)){
        more.push(`<button type="button" onclick="app.taskDetailModal(${x.id})">详情</button>`);
        more.push(`<button type="button" onclick="app.exportTaskResultsCsv(${x.id})">结果 CSV</button>`);
        more.push(`<button type="button" onclick="app.taskPreview(${x.id})">预览</button>`);
        more.push(`<button type="button" onclick="app.preflightTask(${x.id})">执行前检查</button>`);
        if(['publish','message'].includes(x.type))more.push(`<button type="button" onclick="app.prepareTask(${x.id})">生成方案</button>`);
      }
      if(x.status==='failed'&&['sync','profile'].includes(x.type))more.push(`<button type="button" onclick="app.retryTask(${x.id})">重试失败</button>`);
      const editBtn=canEdit?`<button class="tiny" type="button" title="编辑" onclick='app.taskModal(${JSON.stringify(x)})'>编辑</button>`:`<button class="tiny" type="button" title="编辑" disabled>编辑</button>`;
      const delBtn=`<button class="tiny danger" type="button" title="删除" onclick="app.remove('/tasks/${x.id}','任务')">删除</button>`;
      const moreBtn=more.length?`<div class="ops-dropdown task-ops-dropdown"><button class="tiny" type="button" title="更多" onclick="app.toggleTaskOps(${x.id},event)">…</button><div id="task-ops-${x.id}" class="dropdown-menu ops-menu hidden">${more.join('')}</div></div>`:'';
      return `<tr><td><input class="task-check" type="checkbox" value="${x.id}"></td><td><b>${this.esc(x.name)}</b></td><td>${this.esc(this.taskTypeLabel(x))}</td><td>${this.esc(x.group_name||'-')}</td><td><div class="progress"><i style="width:${pct}%"></i></div><span class="muted">${x.success_count}/${x.total_count}</span></td><td>${this.badge(x.status)}${this.nodeOwnedTaskHint(x.status,x.type)}</td><td>${this.esc(x.created_at)}</td><td><div class="task-ops-cell">${editBtn}${delBtn}${moreBtn}</div></td></tr>`;
    },
    toggleTaskOps(id,e){
      e?.stopPropagation?.();
      const target=document.querySelector('#task-ops-'+id);
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
    async taskModal(x={}){const gs=this.groups.filter(g=>g.type==='account'),accounts=(await this.api('/accounts?pageSize=100')).items,scheduled=x.scheduled_at?new Date(x.scheduled_at).toISOString().slice(0,16):'',selectedAccounts=x.payload?.accountIds||[];this.modal(x.id?'编辑任务':'创建任务',`<div class="form-grid"><input type="hidden" name="id" value="${x.id||''}">${this.field('name','任务名称',x.name||'', 'text',true)}${this.selectRaw('type','任务类型',Object.entries(this.meta?.taskTypes||{publish:'视频发布',message:'消息群发',sync:'数据同步',profile:'资料同步'}),x.type||'sync')}<div class="field full"><label>指定发布账号（可多选，留空则按账号分组）</label><select name="accountIds" multiple size="6">${accounts.length?accounts.map(a=>`<option value="${a.id}" ${selectedAccounts.map(Number).includes(Number(a.id))?'selected':''}>#${a.id} · ${this.esc(a.username)} · ${this.esc(a.group_name||'未分组')}</option>`).join(''):'<option disabled>暂无账号</option>'}</select></div>${this.select('groupId','账号分组（未指定账号时生效）',gs,x.group_id)}${this.multiSelect('materialIds','关联素材',this.materials,x.payload?.materialIds||[])}${this.select('templateId','关联消息模板',this.templates,x.payload?.templateId)}${this.field('publishTitle','发布标题',x.payload?.publishTitle||'')}${this.field('publishCaption','发布描述/消息内容',x.payload?.publishCaption||'','textarea')}${this.field('totalCount','目标数量（0=全部所选）',x.total_count||0,'number')}${this.field('scheduledAt','计划开始时间',scheduled,'datetime-local')}</div>`,async d=>{const id=d.id;delete d.id;d.groupId=d.groupId?Number(d.groupId):null;d.totalCount=Number(d.totalCount||0);d.scheduledAt=d.scheduledAt?new Date(d.scheduledAt).toISOString():null;d.payload={accountIds:[...document.querySelector('[name="accountIds"]')?.selectedOptions||[]].map(o=>Number(o.value)).filter(Boolean),materialIds:[...document.querySelector('[name="materialIds"]')?.selectedOptions||[]].map(o=>Number(o.value)).filter(Boolean),templateId:d.templateId?Number(d.templateId):null,publishTitle:d.publishTitle||'',publishCaption:d.publishCaption||'',publishStrategy:'deduplicate',pushChannel:'bit',hashtags:''};delete d.templateId;delete d.publishTitle;delete d.publishCaption;await this.api(id?`/tasks/${id}`:'/tasks',{method:id?'PUT':'POST',body:JSON.stringify(d)});this.toast(id?'任务已更新':'任务已创建');this.closeModal();this.refresh()})},
    async taskAction(id,action,status=''){if(action==='cancel'&&!(await this.ask('确定取消这个任务吗？当前账号处理完成后将停止。')))return;try{await this.api(`/tasks/${id}/${action}`,{method:'POST'});const startTip=status==='paused'?'任务已重启并进入队列':status==='failed'?'任务已重试并进入队列':'任务已进入队列，执行器将按账号顺序处理';this.toast(action==='start'?startTip:action==='cancel'?'任务已取消':'任务已暂停');this.refresh()}catch(e){this.toast(e.message,true)}},
    async retryTask(id){if(!(await this.ask('只重试本任务中失败的账号，是否继续？')))return;try{await this.api(`/tasks/${id}/retry`,{method:'POST'});this.toast('失败账号已重新进入队列');this.refresh()}catch(e){this.toast(e.message,true)}},
    async prepareTask(id){try{const r=await this.api(`/tasks/${id}/prepare`,{method:'POST'});this.toast(r.message);if(await this.ask('执行方案已生成。确认后任务可按执行器策略自动运行，是否确认？')){await this.api(`/tasks/${id}/plans/${r.id}/confirm`,{method:'POST'});this.toast('执行方案已确认')}this.taskPreview(id)}catch(e){this.toast(e.message,true)}},
    async taskPlans(id){try{const plans=await this.api(`/tasks/${id}/plans`);return plans}catch(e){this.toast(e.message,true);return []}},
    async preflightTask(id){try{const r=await this.api(`/tasks/${id}/preflight`,{method:'POST'});this.toast(r.canRun?'执行前检查通过':'检查发现 '+r.issues.length+' 个问题',!r.canRun);if(!r.canRun)alert('执行前检查未通过：\\n\\n'+r.issues.join('\\n'))}catch(e){this.toast(e.message,true)}},
    async taskPreview(id){try{const r=await this.api(`/tasks/${id}/preview`);const p=r.payload||{};this.modal('任务预览',`<div class="data-summary"><div><small>任务名称</small><b>${this.esc(r.task.name)}</b></div><div><small>类型</small><b>${this.esc(r.task.type)}</b></div><div><small>目标数量</small><b>${r.task.total_count}</b></div></div><div class="data-meta">计划时间：${this.esc(r.task.scheduled_at||'立即')}<br>发布标题：${this.esc(p.publishTitle||'-')}<br>发布描述：${this.esc(p.publishCaption||'-')}<br>消息模板：${this.esc(r.template?.name||'-')}</div><h3>关联素材</h3>${r.materials.length?`<table><thead><tr><th>名称</th><th>文件</th><th>类型</th><th>状态</th></tr></thead><tbody>${r.materials.map(m=>`<tr><td>${this.esc(m.name)}</td><td>${this.esc(m.file_name||'-')}</td><td>${this.esc(m.mime_type||'-')}</td><td>${this.badge(m.status)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">未关联素材</div>'}`,()=>this.closeModal())}catch(e){this.toast(e.message,true)}},
    async taskDetailModal(id){
      try{
        const [taskList,rows,events,items]=await Promise.all([
          this.api('/tasks?pageSize=100'),
          this.api(`/tasks/${id}/runs`),
          this.api(`/tasks/${id}/events`),
          this.api(`/tasks/${id}/items`)
        ]);
        const task=(taskList.items||[]).find(t=>Number(t.id)===Number(id));
        const section=(title,body,emptyText)=>`<section class="task-detail-section"><div class="task-detail-section-head"><span class="task-detail-section-title">${this.esc(title)}</span></div><div class="task-detail-section-body">${body||`<div class="empty task-detail-empty">${this.esc(emptyText||'暂无数据')}</div>`}</div></section>`;
        const itemsBody=items.length?`<div class="table-container task-detail-table"><table><thead><tr><th>账号</th><th>素材</th><th>状态</th><th>说明</th><th>更新</th><th></th></tr></thead><tbody>${items.map(i=>{const shot=i.result?.screenshot?String(i.result.screenshot).split(/[/\\\\]/).pop():'';const canResume=['skipped','failed','pending'].includes(i.status)&&task?.type==='publish';return `<tr><td>${this.esc(i.username)}</td><td>${this.esc(i.material_name||'-')}</td><td>${this.badge(i.status)}</td><td class="task-detail-msg">${this.esc(i.error_message||i.result?.caption||'-')}${shot?`<div><a href="/api/browser/diagnostics/${encodeURIComponent(shot)}" target="_blank">截图</a></div>`:''}</td><td>${this.esc(i.updated_at||'-')}</td><td class="task-detail-ops">${i.status==='success'?'':`<button class="tiny" type="button" onclick="app.editTaskItem(${id},${i.id})">改文案</button>`}${canResume?` <button class="tiny primary" type="button" onclick="app.resumePublishItem(${id},${i.id})">继续发布</button> <button class="tiny" type="button" onclick="app.confirmPublishedItem(${id},${i.id})">标记已发布</button>`:''}</td></tr>`}).join('')}</tbody></table></div>`:'';
        const runsBody=rows.length?`<div class="table-container task-detail-table"><table><thead><tr><th>账号</th><th>状态</th><th>开始</th><th>结束</th><th>错误</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${this.esc(r.username)}</td><td>${this.badge(r.status)}</td><td>${this.esc(r.started_at)}</td><td>${this.esc(r.finished_at||'-')}</td><td class="task-detail-msg">${this.esc(r.error_message||'-')}</td></tr>`).join('')}</tbody></table></div>`:'';
        const eventsBody=events.length?`<div class="task-events task-detail-events">${events.map(e=>`<div class="task-event-row event-${this.esc(e.level)}"><span class="task-event-time">${this.esc(e.created_at)}</span><span class="task-event-msg">${this.esc(e.message)}</span></div>`).join('')}</div>`:'';
        const html=`<div class="task-detail">
          <div class="task-detail-summary">
            <div class="task-detail-chip"><small>类型</small><b>${this.esc(task?.type||'-')}</b></div>
            <div class="task-detail-chip"><small>状态</small><b>${task?this.badge(task.status):'-'}</b></div>
            <div class="task-detail-chip"><small>进度</small><b>${task?`${task.success_count}/${task.total_count}`:'-'}</b></div>
            <div class="task-detail-chip"><small>创建时间</small><b>${this.esc(task?.created_at||'-')}</b></div>
          </div>
          ${section('子任务明细',itemsBody,'暂无子任务')}
          ${section('执行记录',runsBody,'暂无执行记录')}
          ${section('事件日志',eventsBody,'暂无事件日志')}
          <div class="task-detail-actions">
            <button class="ghost" type="button" onclick="app.batchEditTaskItems(${id})">批量改文案</button>
            <button class="primary" type="button" onclick="app.retryFailedItems(${id})">重试失败/跳过</button>
            <button class="ghost" type="button" onclick="app.exportTaskResultsCsv(${id})">导出结果 CSV</button>
          </div>
        </div>`;
        this.modal(`任务详情 · ${this.esc(task?.name||('#'+id))}`,html,()=>{},false,{wide:true,hideSubmit:true,hideFooter:false});
        const foot=document.querySelector('#modal .modal-foot');
        if(foot){foot.classList.remove('hidden');const cancel=foot.querySelector('button[type=button]');if(cancel)cancel.textContent='关闭'}
      }catch(e){this.toast(e.message,true)}
    },
    async taskRuns(id){try{const [rows,events,results,items]=await Promise.all([this.api(`/tasks/${id}/runs`),this.api(`/tasks/${id}/events`),this.api(`/tasks/${id}/results`),this.api(`/tasks/${id}/items`)]);const itemsHtml=items.length?`<h3>发布子任务</h3><table><thead><tr><th>账号</th><th>素材</th><th>状态</th><th>说明</th></tr></thead><tbody>${items.map(i=>`<tr><td>${this.esc(i.username)}</td><td>${this.esc(i.material_name||'-')}</td><td>${this.badge(i.status)}</td><td>${this.esc(i.error_message||'-')}</td></tr>`).join('')}</tbody></table>`:'';const runsHtml=rows.length?`<table><thead><tr><th>账号</th><th>状态</th><th>开始时间</th><th>结束时间</th><th>错误</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${this.esc(r.username)}</td><td>${this.badge(r.status)}</td><td>${this.esc(r.started_at)}</td><td>${this.esc(r.finished_at||'-')}</td><td>${this.esc(r.error_message||'-')}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">暂无执行明细</div>';const eventsHtml=events.length?`<div class="task-events">${events.map(e=>`<div class="event-${this.esc(e.level)}"><span>${this.esc(e.created_at)}</span> ${this.esc(e.message)}</div>`).join('')}</div>`:'<div class="empty">暂无任务日志</div>';const resultsHtml=results.length?`<h3>动作结果</h3><table><thead><tr><th>账号</th><th>动作</th><th>状态</th><th>结果</th><th>错误</th><th>时间</th></tr></thead><tbody>${results.map(r=>`<tr><td>${this.esc(r.username)}</td><td>${this.esc(r.action_type)}</td><td>${this.badge(r.status)}</td><td>${this.esc(JSON.stringify(r.result||{}))}</td><td>${this.esc(r.error_message||'-')}</td><td>${this.esc(r.created_at)}</td></tr>`).join('')}</tbody></table>`:'<h3>动作结果</h3><div class="empty">暂无动作结果</div>';this.modal('任务执行明细',`${itemsHtml}${runsHtml}${resultsHtml}<h3>任务日志</h3>${eventsHtml}`,()=>this.closeModal())}catch(e){this.toast(e.message,true)}}, 
    async renderMaterials(opts={}){
      const gen=opts.gen||this._matrixSwitchGen;
      const still=()=>gen===this._matrixSwitchGen&&this.view==='publish'&&this.matrixTab==='materials';
      const page=this.materialPage||1;
      const kw=encodeURIComponent(this.materialKeyword||'');
      const st=encodeURIComponent(this.materialStatus||'');
      const ps=encodeURIComponent(this.materialPublishStatus||'');
      const tags=encodeURIComponent(this.materialTags||'');
      const pack=await this.api(`/materials?page=${page}&pageSize=12${kw?`&keyword=${kw}`:''}${st?`&status=${st}`:''}${ps?`&publishStatus=${ps}`:''}${tags?`&tags=${tags}`:''}`);
      if(!still())return;
      const rows=pack.items||(Array.isArray(pack)?pack:[]);
      const total=Number(pack.total??rows.length);
      const ready=rows.filter(x=>x.status==='ready').length;
      const statusOpts=[['','全部状态'],...this.materialStatusPairs()];
      const publishOpts=[['','全部发布状态'],['unused','未使用'],['publishing','发布中'],['published','已发布']];
      const html=`<div class="panel materials-panel">
        <div class="matrix-action-bar">
          <div class="left">
            ${this.canPermission('publish.tasks')?`<button class="primary" onclick="app.openMaterialPicker({multiple:true,max:0,title:'视频素材库',onConfirm:()=>app.toast('可在发布向导中选择素材')})">素材库弹框</button>
            <button class="ghost" onclick="app.materialModal()">+ 添加素材</button>
            <button class="ghost" onclick="app.matrixTab='materialImport';app.refresh()">素材导入</button>`:'<span class="muted">当前角色无权维护素材</span>'}
            <button class="ghost" onclick="app.refresh()">刷新</button>
          </div>
          <div class="right"><span class="muted">本页可用 ${ready} · 共 ${total} · 仅保存本地路径，不会自动上传 TikTok</span></div>
        </div>
        <div class="search-bar task-filter-bar material-filter-bar">
          <select id="mat-status-filter" class="input" title="素材状态">
            ${statusOpts.map(([v,n])=>`<option value="${this.esc(v)}" ${String(this.materialStatus||'')===v?'selected':''}>${this.esc(n)}</option>`).join('')}
          </select>
          <select id="mat-publish-filter" class="input" title="发布状态">
            ${publishOpts.map(([v,n])=>`<option value="${this.esc(v)}" ${String(this.materialPublishStatus||'')===v?'selected':''}>${this.esc(n)}</option>`).join('')}
          </select>
          <input id="mat-tags-filter" class="input" type="search" placeholder="标签" value="${this.esc(this.materialTags||'')}" onkeydown="if(event.key==='Enter')app.searchMaterials()">
          <input id="mat-keyword-filter" class="input" type="search" placeholder="名称 / 文件名 / ID" value="${this.esc(this.materialKeyword||'')}" onkeydown="if(event.key==='Enter')app.searchMaterials()">
          <button class="primary" type="button" onclick="app.searchMaterials()">搜索</button>
          <button class="ghost" type="button" onclick="app.resetMaterialFilters()">重置</button>
        </div>
        ${rows.length?`<div class="material-grid">${rows.map(x=>{
          const fileName=x.file_name||x.fileName||'-';
          const size=x.size_bytes||x.sizeBytes||0;
          const canPreview=x.status==='ready';
          const stream=this.materialStreamUrl?this.materialStreamUrl(x.id):(window.TKSWARM_API_BASE||'')+'/api/materials/'+x.id+'/stream';
          return `<div class="material-card">
            <div class="material-thumb">${(x.coverBase64||x.cover_base64)?`<img src="${x.coverBase64||x.cover_base64}" alt="cover" style="width:100%;height:140px;object-fit:cover">`:canPreview?`<video src="${stream}" muted preload="none"></video>`:'<div class="empty" style="padding:24px">无预览</div>'}</div>
            <div class="material-body">
              <b>${this.esc(x.name)}</b>
              <div class="muted">${this.esc(fileName)} · ${size?Math.round(size/1024)+' KB':'-'}</div>
              <div style="margin-top:6px">${this.badge(x.status)} <span class="muted">${this.esc(x.tags||'')}</span></div>
              <div class="action-bar material-card-ops" style="margin:10px 0 0">
                ${this.canPermission('publish.tasks')?`<button class="tiny icon-only-act" type="button" title="编辑" aria-label="编辑" onclick='app.materialModal(${JSON.stringify(x)})'>编辑</button>`:''}
                <button class="tiny icon-only-act" type="button" title="检查" aria-label="检查" onclick="app.checkMaterial(${x.id})">检查</button>
                <button class="tiny icon-only-act" type="button" title="预览" aria-label="预览" onclick="app.previewMaterial(${x.id})">预览</button>
                ${this.canPermission('publish.tasks')?`<button class="tiny primary icon-only-act" type="button" title="发布" aria-label="发布" onclick="app.publishMaterialModal(${x.id})" ${x.status==='ready'?'':'disabled'}>发布</button>`:''}
                <button class="tiny danger icon-only-act" type="button" title="删除" aria-label="删除" onclick="app.remove('/materials/${x.id}','素材')" ${this.canPermission('publish.tasks')?'':'disabled'}>删除</button>
              </div>
            </div>
          </div>`}).join('')}</div>`:'<div class="empty">还没有素材，点击添加本地视频</div>'}
        ${UI.pager(Array.isArray(pack)?{items:rows,page:1,pages:1,total:rows.length}:pack,'materialPage')}
      </div>`;
      if(!still())return;
      this.mountMatrixPanel(html,'materials',{soft:!!opts.soft});
  
    },
    async publishMaterialModal(materialId){
      if(!this.canPermission('publish.tasks')){this.toast('当前角色无权创建发布任务',true);return}
      const mid=Number(materialId);
      if(!mid){this.toast('素材无效',true);return}
      const mat=(this.materials||[]).find(m=>Number(m.id)===mid)||{id:mid,name:'素材#'+mid};
      if(mat.status&&mat.status!=='ready'){this.toast('仅可用状态的素材可发布',true);return}
      let accounts=[];
      try{
        const pack=await this.api('/accounts?pageSize=200');
        accounts=(pack.items||[]).filter(a=>a.enabled!==false&&a.enabled!==0);
      }catch(e){this.toast(e.message,true);return}
      if(!accounts.length){this.toast('暂无可用账号',true);return}
      const defaultName=`独立发布 · ${mat.name||('素材'+mid)}`.slice(0,160);
      const accOpts=accounts.map(a=>[a.id,`#${a.id} · ${a.username}${a.group_name?' · '+a.group_name:''}`]);
      this.modal('创建发布任务',`<div class="form-grid">
        <div class="field full"><label>素材</label><input class="input" value="${this.esc((mat.name||'')+'（#'+mid+'）')}" disabled></div>
        ${this.selectRaw('accountId','发布账号',accOpts,String(accOpts[0]?.[0]||''))}
        ${this.field('name','任务名称',defaultName,'text',true)}
        ${this.field('publishTitle','发布标题',mat.shareTitle||mat.share_title||mat.name||'')}
        ${this.field('publishCaption','发布文案',mat.shareCaption||mat.share_caption||'','textarea')}
        ${this.field('scheduledAt','定时启动（可空）','','datetime-local')}
        ${this.selectRaw('autoStart','创建后',[['1','立即入队启动'],['0','仅保存为草稿']],'1')}
        <div class="field full"><div class="muted">将创建为「独立发布」任务：1 个账号 × 1 个素材。</div></div>
      </div>`,async d=>{
        const accountId=Number(d.accountId);
        if(!accountId)throw new Error('请选择发布账号');
        const name=String(d.name||'').trim()||defaultName;
        const scheduledAt=d.scheduledAt?new Date(d.scheduledAt).toISOString():null;
        const payload={
          pushChannel:'bit',
          accountIds:[accountId],
          materialIds:[mid],
          pairs:[{accountId,materialId:mid}],
          folderPath:'',
          publishMode:'independent',
          publishStrategy:'pairs',
          publishTitle:String(d.publishTitle||'').trim(),
          publishCaption:String(d.publishCaption||'').trim(),
          hashtags:'',
          threadCount:1,
          saveTraffic:false,
          deleteAfterPublish:false,
        };
        const created=await this.api('/tasks',{method:'POST',body:JSON.stringify({
          name,type:'publish',groupId:null,totalCount:1,scheduledAt,payload,
        })});
        if(String(d.autoStart||'1')==='1'){
          if(!(await this.ensureBitOnline('比特发布'))){
            this.toast('任务已创建，但比特未在线，请稍后手动启动');
          }else{
            await this.api('/tasks/'+created.id+'/start',{method:'POST'});
            this.toast('发布任务已创建并入队');
          }
        }else{
          this.toast('发布任务已保存为草稿');
        }
        this.closeModal();
        this.matrixTab='tasks';
        this.taskTypeFilter='publish';
        this.taskModeFilter='independent';
        this.taskPage=1;
        this.navigate('publish','tasks');
      });
    },
    searchMaterials(){
      this.materialStatus=String(document.querySelector('#mat-status-filter')?.value||'').trim();
      this.materialPublishStatus=String(document.querySelector('#mat-publish-filter')?.value||'').trim();
      this.materialTags=String(document.querySelector('#mat-tags-filter')?.value||'').trim();
      this.materialKeyword=String(document.querySelector('#mat-keyword-filter')?.value||'').trim();
      this.materialPage=1;
      this.refresh();
    },
    resetMaterialFilters(){
      this.materialStatus='';
      this.materialPublishStatus='';
      this.materialTags='';
      this.materialKeyword='';
      this.materialPage=1;
      this.refresh();
    },
    openMaterialImport(){this.matrixTab='materialImport';this.refresh()},
    async renderMaterialImport(){
      if(this.taskRefreshTimer)clearInterval(this.taskRefreshTimer);
      if(!this.canPermission('publish.tasks')){
        document.querySelector('#content').innerHTML=`<div class="panel material-import-panel"><div class="empty">当前角色无权导入素材</div></div>`;
        return;
      }
      const last=this.materialImportResult||null;
      document.querySelector('#content').innerHTML=`<div class="panel material-import-panel">
        <div class="task-io-head">
          <button class="ghost" type="button" onclick="app.matrixTab='materials';app.refresh()">← 返回素材库</button>
          <div class="task-io-title-row">
            <b class="task-io-title">素材导入</b>
            <span class="muted">上传 ZIP（内含视频 + Excel 清单）；Excel「文件名」须与视频文件名一致；名称与大小重复禁止入库</span>
          </div>
        </div>
        <div class="material-import-layout">
          <section class="material-import-card">
            <div class="material-import-card-head"><b>1. 下载 Excel 模板</b></div>
            <p class="muted">模板列：文件名、素材名称、标签、分享标题、分享文案、描述。将填好的 Excel 与视频一起打成 ZIP。</p>
            <div class="action-bar" style="margin:0">
              <button class="primary" type="button" onclick="app.downloadMaterialImportTemplate()">下载 Excel 模板</button>
            </div>
          </section>
          <section class="material-import-card">
            <div class="material-import-card-head"><b>2. 上传 ZIP 压缩包</b></div>
            <div class="material-import-drop" id="mi-drop" onclick="document.querySelector('#mi-zip')?.click()">
              <b>点击选择 ZIP，或拖拽到此处</b>
              <span>包内需包含：视频文件（mp4/mov/…）+ Excel/CSV 清单</span>
              <input type="file" id="mi-zip" accept=".zip,application/zip" hidden onchange="app.onMaterialImportZipPicked(this)">
            </div>
            <div class="form-grid" style="margin-top:12px">
              <div class="field"><label>默认标签（Excel 未填时使用）</label><input id="mi-tags" class="input" value="zip-import"></div>
              <div class="field"><label>已选文件</label><input id="mi-fname" class="input" readonly value="未选择"></div>
            </div>
            <div class="action-bar" style="margin-top:14px">
              <button class="primary" type="button" id="mi-submit" onclick="app.submitMaterialImportZip()" disabled>开始导入</button>
              <button class="ghost" type="button" onclick="app.resetMaterialImportForm()">重置</button>
            </div>
            <div class="material-import-progress" id="mi-progress"><i id="mi-bar"></i></div>
          </section>
        </div>
        <section class="material-import-card material-import-result-card">
          <div class="material-import-card-head">
            <b>3. 导入结果</b>
            ${last?`<span class="muted">成功 ${last.imported||0} · 跳过 ${last.skipped||0} · 失败 ${last.failed||0}</span>`:''}
          </div>
          ${last?this.materialImportResultHtml(last):'<div class="empty material-import-empty">上传 ZIP 并导入后，这里显示逐条结果</div>'}
        </section>
      </div>`;
      const drop=document.querySelector('#mi-drop');
      if(drop){
        drop.ondragover=(e)=>{e.preventDefault();drop.classList.add('is-drag')};
        drop.ondragleave=()=>drop.classList.remove('is-drag');
        drop.ondrop=(e)=>{
          e.preventDefault();
          drop.classList.remove('is-drag');
          const f=e.dataTransfer?.files?.[0];
          if(f) this.setMaterialImportZip(f);
        };
      }
    },
    materialImportResultHtml(pack){
      const rows=pack.results||[];
      if(!rows.length)return `<div class="shell-note">${this.esc(pack.message||'无明细')}</div>`;
      return `<div class="table-container material-import-table"><table>
        <thead><tr><th>行</th><th>文件名</th><th>素材名称</th><th>大小</th><th>状态</th><th>说明</th></tr></thead>
        <tbody>${rows.map(r=>{
          const st=r.status||'';
          const label=st==='imported'?'成功':(st==='skipped'?'跳过':'失败');
          const cls=st==='imported'?'ok':(st==='skipped'?'skip':'fail');
          const size=r.sizeBytes?Math.round(Number(r.sizeBytes)/1024)+' KB':'-';
          return `<tr class="mi-row-${cls}"><td>${r.line||'-'}</td><td>${this.esc(r.fileName||'-')}</td><td>${this.esc(r.name||'-')}</td><td>${size}</td><td><span class="mi-status mi-${cls}">${label}</span></td><td class="task-detail-msg">${this.esc(r.reason||'')}${r.materialId?` · #${r.materialId}`:''}</td></tr>`;
        }).join('')}</tbody>
      </table></div>`;
    },
    async downloadMaterialImportTemplate(){
      try{
        const apiBase=window.TKSWARM_API_BASE||window.__TKSWARM_CONFIG__?.defaultApiBase||'';
        const ok=await this.downloadAuth((apiBase||'')+'/api/materials/import-template','material-import-template.xlsx','模板为空');
        if(ok)this.toast('模板已下载');
      }catch(e){this.toast(e.message,true)}
    },
    onMaterialImportZipPicked(input){
      const f=input?.files?.[0]||null;
      this.setMaterialImportZip(f);
    },
    setMaterialImportZip(file){
      this._materialImportZip=file||null;
      const nameEl=document.querySelector('#mi-fname');
      const btn=document.querySelector('#mi-submit');
      if(nameEl)nameEl.value=file?`${file.name}（${this.formatFileSize?this.formatFileSize(file.size):file.size}）`:'未选择';
      if(btn)btn.disabled=!file;
    },
    resetMaterialImportForm(){
      this._materialImportZip=null;
      this.materialImportResult=null;
      const inp=document.querySelector('#mi-zip');
      if(inp)inp.value='';
      this.renderMaterialImport();
    },
    async submitMaterialImportZip(){
      const file=this._materialImportZip||document.querySelector('#mi-zip')?.files?.[0];
      if(!file){this.toast('请先选择 ZIP 文件',true);return}
      if(!/\.zip$/i.test(file.name)){this.toast('请上传 .zip 压缩包',true);return}
      const tags=String(document.querySelector('#mi-tags')?.value||'').trim()||'zip-import';
      const btn=document.querySelector('#mi-submit');
      const prog=document.querySelector('#mi-progress');
      const bar=document.querySelector('#mi-bar');
      if(btn)btn.disabled=true;
      if(prog)prog.classList.add('is-on');
      if(bar)bar.style.width='8%';
      try{
        const fd=new FormData();
        fd.append('file',file);
        fd.append('tags',tags);
        let apiBase=window.TKSWARM_API_BASE||window.__TKSWARM_CONFIG__?.defaultApiBase||'http://tkswarm-api.dyyweb.com';
        const data=await new Promise((resolve,reject)=>{
          const xhr=new XMLHttpRequest();
          xhr.open('POST',apiBase+'/api/materials/import-zip');
          if(this.authToken)xhr.setRequestHeader('Authorization','Bearer '+this.authToken);
          const actingAs=this.getActingAsId();
          if(actingAs)xhr.setRequestHeader('X-Acting-As',String(actingAs));
          if(xhr.upload)xhr.upload.onprogress=(e)=>{if(e.lengthComputable&&bar)bar.style.width=Math.max(8,Math.round(e.loaded/e.total*90))+'%'};
          xhr.onload=()=>{
            let json;try{json=JSON.parse(xhr.responseText)}catch(_){json=null}
            if(xhr.status>=200&&xhr.status<300&&json&&json.success)resolve(json.data);
            else reject(new Error(json?.message||`导入失败 (HTTP ${xhr.status})`));
          };
          xhr.onerror=()=>reject(new Error('网络请求异常'));
          xhr.send(fd);
        });
        if(bar)bar.style.width='100%';
        this.materialImportResult=data||{};
        this.toast(data?.message||'导入完成',!(data?.imported));
        await this.loadRefs?.();
        this.renderMaterialImport();
      }catch(e){
        this.toast(e.message||'导入失败',true);
        if(btn)btn.disabled=false;
      }finally{
        if(prog)prog.classList.remove('is-on');
        if(bar)bar.style.width='0%';
      }
    },
    previewMaterial(id,streamUrl){const src=this.materialStreamUrl?this.materialStreamUrl(id,streamUrl):((window.TKSWARM_API_BASE||'')+'/api/materials/'+id+'/stream'+(this.authToken?('?token='+encodeURIComponent(this.authToken)):''));this.modal('素材预览',`<div class="material-preview"><video src="${this.esc(src)}" controls autoplay></video></div>`,()=>{},false,{hideSubmit:true,wide:true});const foot=document.querySelector('#modal .modal-foot');if(foot){const c=foot.querySelector('button[type=button]');if(c)c.textContent='关闭'}},
    async checkMaterial(id){try{const r=await this.api(`/materials/${id}/check`,{method:'POST'});this.toast(r.message,!r.exists);this.refresh()}catch(e){this.toast(e.message,true)}},
    materialModal(x={}){
      if(!this.canPermission('publish.tasks')){this.toast('当前角色无权维护素材',true);return}
      // 新增：与选择素材弹框内的「上传视频」保持同一套上传 UI
      if(!x||!x.id){
        if(typeof this.openMaterialUploadDialog==='function'){
          this.openMaterialUploadDialog({
            title:'上传视频素材',
            defaultTags:'materials',
            onUploaded:()=>this.refresh()
          });
          return;
        }
      }
      if(typeof this.openMaterialEditDialog==='function'){
        this.openMaterialEditDialog(x,{
          title:'编辑视频素材',
          onSaved:()=>this.refresh()
        });
        return;
      }
      this.modal('编辑素材',`<div class="form-grid"><input type="hidden" name="id" value="${x.id||''}">${this.field('name','素材名称',x.name||'','text',true)}${this.field('shareTitle','分享标题',x.shareTitle||x.share_title||'')}${this.field('shareCaption','分享文案',x.shareCaption||x.share_caption||'','textarea')}${this.selectRaw('status','状态',this.materialStatusPairs(),x.status||'ready')}${this.field('tags','标签（逗号分隔）',x.tags||'')}${this.field('description','描述',x.description||'','textarea')}<div class="field full"><div class="muted">编辑时不替换视频文件；如需换片请删除后重新上传。</div></div></div>`,async d=>{
        const id=d.id;delete d.id;
        d.sizeBytes=Number(x.size_bytes||x.sizeBytes||0);
        d.fileName=x.file_name||x.fileName||'';
        d.mimeType=x.mime_type||x.mimeType||'';
        d.filePath=x.file_path||x.filePath||'';
        await this.api(`/materials/${id}`,{method:'PUT',body:JSON.stringify(d)});
        this.toast('素材已更新');
        this.closeModal();
        this.refresh();
      });
    },
    matrixTabs(tab){const items=(this.opt('matrixTabs',[['tasks','视频任务'],['materials','素材库'],['uids','UID好友']])||[]).filter(([k])=>k!=='mass');const cur=tab==='mass'?'tasks':tab;return `<div class="matrix-tabs">${items.map(([k,n])=>`<button type="button" data-tab="${k}" class="${cur===k?'active':''}" onclick="app.switchMatrix('${k}')">${n}</button>`).join('')}</div>`},
    matrixCacheKey(tab){
      const t=tab||this.matrixTab||'tasks';
      if(t==='tasks')return `tasks|${this.taskPage||1}|${this.taskStatusFilter||''}|${this.taskTypeFilter||''}|${this.taskModeFilter||''}|${this.taskKeyword||''}`;
      if(t==='materials')return `materials|${this.materialPage||1}|${this.materialKeyword||''}|${this.materialStatus||''}|${this.materialPublishStatus||''}|${this.materialTags||''}`;
      if(t==='uids')return `uids|${this.uidGroupId||''}|${this.uidPage||1}|${this.uidKeyword||''}`;
      return t;
    },
    invalidateMatrixCache(tab){
      if(!this._matrixTabCache)return;
      if(tab)delete this._matrixTabCache[tab];
      else this._matrixTabCache={};
    },
    ensureMatrixShell(activeTab){
      const content=document.querySelector('#content');
      if(!content)return null;
      content.classList.remove('chat-mode');
      const tab=activeTab==='mass'?'tasks':(activeTab||this.matrixTab||'tasks');
      let body=content.querySelector('#matrix-body');
      let tabs=content.querySelector('.matrix-tabs');
      if(!body||!tabs){
        const head=content.querySelector('.page-head');
        const headHtml=head?head.outerHTML:(this.pageHead('publish')||'');
        content.innerHTML=`${headHtml}${this.matrixTabs(tab)}<div id="matrix-body" class="matrix-body"></div>`;
        body=content.querySelector('#matrix-body');
        tabs=content.querySelector('.matrix-tabs');
      }else{
        tabs.querySelectorAll('button[data-tab]').forEach(b=>b.classList.toggle('active',b.getAttribute('data-tab')===tab));
      }
      return body;
    },
    mountMatrixPanel(html,tab,opts={}){
      const t=tab==='mass'?'tasks':(tab||this.matrixTab||'tasks');
      const body=this.ensureMatrixShell(t);
      if(!body){
        const content=document.querySelector('#content');
        if(content)content.innerHTML=this.matrixTabs(t)+html;
        return content;
      }
      if(!this._matrixTabCache)this._matrixTabCache={};
      // 静默刷新只更新缓存，避免切换后二次整页重绘造成卡顿
      if(opts.soft&&body.children.length&&!body.querySelector('.matrix-loading-panel')){
        // 后台拉到的新 HTML 先 decorate 再写入缓存，切回时可免二次扫按钮
        const tmp=document.createElement('div');
        tmp.innerHTML=html;
        if(window.UI)UI.decorate(tmp);
        this._matrixTabCache[t]={html:tmp.innerHTML,at:Date.now(),key:this.matrixCacheKey(t),decorated:true};
        return body;
      }
      body.innerHTML=html;
      if(window.UI)UI.decorate(body);
      this._matrixTabCache[t]={html:body.innerHTML,at:Date.now(),key:this.matrixCacheKey(t),decorated:true};
      return body;
    },
    switchMatrix(tab){
      const next=tab==='mass'?'tasks':tab;
      this.view='publish';
      this.wizardOpen=false;
      this.massWizardOpen=false;
      const gen=++this._matrixSwitchGen;
      this.matrixTab=next;
      // 立刻切换 Tab 高亮，避免等接口才反馈
      document.querySelectorAll('.matrix-tabs button[data-tab]').forEach(b=>b.classList.toggle('active',b.getAttribute('data-tab')===next));
      const body=this.ensureMatrixShell(next);
      if(!body){this.refresh();return}
      const cache=this._matrixTabCache?.[next];
      const key=this.matrixCacheKey(next);
      if(cache&&cache.html&&cache.key===key&&(Date.now()-cache.at)<15000){
        body.innerHTML=cache.html;
        // 缓存已是 decorate 后的 HTML，命中时跳过全量扫按钮
        if(!cache.decorated&&window.UI)UI.decorate(body);
        // 快速连点时只保留最后一次静默刷新，避免请求堆叠卡顿
        clearTimeout(this._matrixSoftTimer);
        this._matrixSoftTimer=setTimeout(()=>{
          if(this._matrixSwitchGen===gen)this.renderPublish({gen,soft:true});
        },450);
        return;
      }
      body.innerHTML=`<div class="panel matrix-loading-panel" style="margin:0"><div class="muted" style="padding:48px;text-align:center">加载中…</div></div>`;
      this.renderPublish({gen});
    },
    async renderPublish(opts={}){
      const gen=opts.gen||++this._matrixSwitchGen;
      const soft=!!opts.soft;
      document.querySelector('#content')?.classList.remove('chat-mode');
      if(this.matrixTab==='mass')this.matrixTab='tasks';
      const still=()=>gen===this._matrixSwitchGen&&this.view==='publish';
      if(this.matrixTab==='materialImport'){
        if(this.taskRefreshTimer)clearInterval(this.taskRefreshTimer);
        if(!still())return;
        await this.renderMaterialImport();
        if(!still())return;
        const content=document.querySelector('#content');
        if(content&&!content.querySelector('.matrix-tabs'))content.insertAdjacentHTML('afterbegin',this.matrixTabs('materials'));
        return;
      }
      if(this.matrixTab==='materials'){
        if(this.taskRefreshTimer)clearInterval(this.taskRefreshTimer);
        if(!still())return;
        await this.renderMaterials({soft,gen});
        return;
      }
      if(this.matrixTab==='uids'){
        // UID好友已迁至客服聚合
        this.matrixTab='tasks';
        return this.navigate('chat','uids');
      }
      if(this.matrixTab==='io'){
        if(this.taskRefreshTimer)clearInterval(this.taskRefreshTimer);
        if(!still())return;
        await this.renderTaskIo();
        if(!still())return;
        const content=document.querySelector('#content');
        if(content&&!content.querySelector('.matrix-tabs'))content.insertAdjacentHTML('afterbegin',this.matrixTabs('tasks'));
        return;
      }
      if(this.massWizardOpen){this.massWizardOpen=false;this.openPublishWizard('ordered');return}
      if(this.commentReplyWizardOpen){
        if(this.taskRefreshTimer)clearInterval(this.taskRefreshTimer);
        if(!still())return;
        document.querySelector('#content').innerHTML=this.matrixTabs('tasks')+this.commentReplyWizardPanel();
        if((this.commentReplyWizard?.step||1)===1)await this.fillCommentReplyWizardAccounts();
        else if((this.commentReplyWizard?.step||1)===2)await this.fillCommentReplyWizardTemplates();
        return;
      }
      if(this.deleteWizardOpen){
        if(this.taskRefreshTimer)clearInterval(this.taskRefreshTimer);
        if(!still())return;
        document.querySelector('#content').innerHTML=this.matrixTabs('tasks')+this.deleteWizardPanel();
        if((this.deleteWizard?.step||1)===1)await this.fillDeleteWizardAccounts();
        return;
      }
      if(this.wizardOpen){
        if(this.taskRefreshTimer)clearInterval(this.taskRefreshTimer);
        if(!still())return;
        document.querySelector('#content').innerHTML=this.matrixTabs('tasks')+this.wizardPanel();
        await this.maybeFillWizardAccounts();
        return;
      }
      if(!still())return;
      await this.renderTasks({soft,gen});
    },
  async renderMassTasks(){
      if(this.taskRefreshTimer)clearInterval(this.taskRefreshTimer);
      const status=this.massStatusFilter||'';
      const page=this.massPage||1;
      const d=await this.api(`/tasks?page=${page}&pageSize=15&type=message${status?`&status=${encodeURIComponent(status)}`:''}`);
      const all=await this.api('/tasks?pageSize=200&type=message');
      const counts={all:all.total||all.items.length};
      ['draft','queued','running','paused','completed','failed'].forEach(k=>{counts[k]=all.items.filter(x=>x.status===k).length});
      document.querySelector('#content').innerHTML=`<div class="panel">
        <div class="matrix-action-bar">
          <div class="left">
            ${this.canPermission('publish.mass')?`<button class="primary" onclick="app.openMassWizard()">创建群发</button>`:''}
            <button class="ghost" onclick="app.refresh()">刷新</button>
            <button class="ghost" onclick="app.batchRetryTasks()">批量重试</button>
          </div>
          <div class="right"><span class="muted">群发通过比特浏览器打开环境，尝试真实发送 TikTok 私信。</span></div>
        </div>
        <div class="status-tags">
          <button type="button" class="status-tag ${!status?'active':''}" onclick="app.setMassStatusFilter('')">全部 <b>${counts.all||0}</b></button>
          ${this.taskStatusPairs().filter(([k])=>['queued','running','completed','failed'].includes(k)).map(([k,n])=>`<button type="button" class="status-tag ${status===k?'active':''}" onclick="app.setMassStatusFilter('${k}')">${this.esc(n)} <b>${counts[k]||0}</b></button>`).join('')}
        </div>
        <div class="table-container">${this.taskTable(d.items)}</div>
        ${UI.pager(d,'massPage')}
      </div>`;
      if(all.items.some(x=>['queued','running'].includes(x.status))){this.taskRefreshTimer=setInterval(()=>{if(this.view==='publish'&&this.matrixTab==='mass'&&!this.massWizardOpen)this.renderPublish();else clearInterval(this.taskRefreshTimer)},3000)}
    },
    setMassStatusFilter(status){this.massStatusFilter=status||'';this.massPage=1;this.refresh()},
    async openMassWizard(){return this.openPublishWizard('ordered')},
    closeMassWizard(){this.massWizardOpen=false;this.closePublishWizard()},
    massWizardPanel(){const step=this.mass?.step||1;const labels=['选择账号','发送对象','发送内容','任务配置','确认'];const m=this.mass||{};m.massChannel='bit';return `<div class="wizard"><div class="wizard-steps">${labels.map((n,i)=>`<span class="${i+1===step?'on':''}">${i+1} ${n}</span>`).join('')}</div><div class="shell-note" style="margin:0 0 12px">群发任务：用已选账号，经比特浏览器向目标 UID / 好友批量发送 TikTok 私信。</div>${this.massBody(step,m)}<div class="toolbar" style="margin-top:16px"><button class="ghost" onclick="app.closeMassWizard()">取消</button><div>${step>1?`<button class="ghost" type="button" onclick="app.massPrev()">上一步</button> `:''}${step<5?`<button class="primary" type="button" onclick="app.massNext()">下一步</button>`:`<button class="primary" type="button" onclick="app.massSubmit()">创建群发</button>`}</div></div></div>`},
    massBody(step,m){if(step===1){const gs=this.groups.filter(g=>g.type==='account');return `<div class="form-grid">${this.select('groupId','账号分组（可选）',gs,m.groupId)}<div class="field full"><label>指定账号</label>${this.accountPickToolbarHtml('mass-accounts',{batchHtml:`<button type="button" class="tiny" onclick="app.massSelectAccounts(true)">全选</button><button type="button" class="tiny" onclick="app.massSelectAccounts(false)">清空</button><button type="button" class="tiny" onclick="app.massInvertAccounts()">反选</button>`})}<div id="mass-accounts" class="account-pick-grid"></div></div></div>`}if(step===2){const ugs=this.groups.filter(g=>g.type==='uid');return `<div class="form-grid">${this.selectRaw('sendTargetType','发送对象',this.massTargetPairs(),m.sendTargetType||'imported')}${this.select('uidGroupId','UID 分组（导入好友时）',ugs,m.uidGroupId)}${this.field('fixedTargets','固定对象（每行一个 UID）',m.fixedTargets||'','textarea')}<div class="field full"><div class="muted">选「粉丝/互关」前请先在客服台对该账号执行「刷新粉丝」，把 TikTok 粉丝列表写入本地好友。</div></div></div>`}if(step===3){const sgs=this.groups.filter(g=>g.type==='message');const dmOn=this.dmTemplateEnabled!==false;const tpls=dmOn?this.templates.filter(t=>(t.enabled!==0&&t.enabled!==false)&&(!m.scriptGroupId||String(t.group_id)===String(m.scriptGroupId))):[];return `<div class="form-grid">${dmOn?`<div class="field"><label>话术分类</label><select onchange="app.setMassScriptGroup(this.value)"><option value="">全部分类</option>${sgs.map(g=>`<option value="${g.id}" ${String(m.scriptGroupId)===String(g.id)?'selected':''}>${this.esc(g.name)}</option>`).join('')}</select></div>${this.select('templateId','话术模板（可选）',tpls,m.templateId)}`:'<div class="field full"><div class="shell-note">设置中「启用私信话术」已关闭，请直接填写发送内容。</div></div>'}${this.field('content','发送内容（多行则轮换，支持 {{username}}）',m.content||'','textarea')}</div>`}if(step===4)return `<div class="form-grid">${this.field('name','任务名称',m.name||'','text',true)}${this.field('sendInterval','发送间隔（毫秒）',m.sendInterval??800,'number')}${this.field('retryCount','失败重试次数',m.retryCount??1,'number')}${this.field('perAccountLimit','每账号发送上限',m.perAccountLimit??20,'number')}${this.field('scheduledAt','定时开始',m.scheduledAt||'','datetime-local')}</div>`;return `<div class="data-meta"><b>注意：</b>将通过比特浏览器打开环境，尝试真实发送 TikTok 私信。<br>通道：比特浏览器<br>对象：${this.esc(m.sendTargetType||'-')}<br>账号：${(m.accountIds||[]).length||'按分组/全部'}<br>内容：${this.esc((m.content||'').slice(0,80)||'使用话术')}<br>间隔 ${m.sendInterval} ms · 重试 ${m.retryCount} · 每账号 ${m.perAccountLimit}</div>`},
    toggleAccountPickTag(el){
      if(!el)return;
      const willOn=!el.classList.contains('is-on');
      const inWizardAccounts=this.wizardOpen&&el.closest('#wizard-accounts');
      if(willOn&&inWizardAccounts&&this.wizardIsRandom()){
        const need=this.wizardMaterialCount();
        const cur=this.selectedAccountPickIds('wizard-accounts').length;
        if(need>0&&cur>=need){this.toast(`随机发布最多选择 ${need} 个账号（与素材数相等）`,true);return}
      }
      if(willOn&&inWizardAccounts&&this.wizardIsIndependent()){
        document.querySelectorAll('#wizard-accounts .account-pick-tag.is-on').forEach(t=>{if(t!==el)t.classList.remove('is-on')});
      }
      el.classList.toggle('is-on');
      if(inWizardAccounts)this.updateWizardAccountPickHint();
    },
    async fillMassAccounts(){const box=document.querySelector('#mass-accounts');if(!box)return;const accounts=(await this.api('/accounts?pageSize=200')).items;const selected=new Set((this.mass.accountIds||[]).map(Number));box.innerHTML=accounts.length?accounts.map(a=>this.accountPickTagHtml(a,selected)).join(''):'<div class="muted account-pick-empty" style="padding:12px;grid-column:1/-1">暂无账号</div>';this.filterAccountPick('mass-accounts');},
    massSelectAccounts(all){if(all)this.setAccountPickAll('mass-accounts',true);else document.querySelectorAll('#mass-accounts .account-pick-tag').forEach(el=>el.classList.remove('is-on'));},
    massInvertAccounts(){this.invertAccountPick('mass-accounts');},
    async fillWizardAccounts(){const box=document.querySelector('#wizard-accounts');if(!box)return;const accounts=(await this.api('/accounts?pageSize=200')).items;this._wizardAccountsCache=accounts||[];const selected=new Set((this.wizard.accountIds||[]).map(Number));box.innerHTML=accounts.length?accounts.map(a=>this.accountPickTagHtml(a,selected)).join(''):'<div class="muted account-pick-empty" style="padding:12px;grid-column:1/-1">暂无账号</div>';this.filterAccountPick('wizard-accounts');},
    wizardSelectAccounts(all){
      if(this.wizardIsIndependent()){
        if(all){
          const tags=[...document.querySelectorAll('#wizard-accounts .account-pick-tag')].filter(el=>!el.classList.contains('is-filtered-out'));
          tags.forEach(el=>el.classList.remove('is-on'));
          if(tags[0])tags[0].classList.add('is-on');
          else this.toast('没有可选账号',true);
        }else document.querySelectorAll('#wizard-accounts .account-pick-tag').forEach(el=>el.classList.remove('is-on'));
        this.updateWizardAccountPickHint();
        return;
      }
      if(all){if(this.wizardIsRandom()){const need=this.wizardMaterialCount();const tags=[...document.querySelectorAll('#wizard-accounts .account-pick-tag')].filter(el=>!el.classList.contains('is-filtered-out'));tags.forEach(el=>el.classList.remove('is-on'));tags.slice(0,need).forEach(el=>el.classList.add('is-on'));if(tags.length<need)this.toast(`可见账号不足 ${need} 个`,true)}else this.setAccountPickAll('wizard-accounts',true)}else document.querySelectorAll('#wizard-accounts .account-pick-tag').forEach(el=>el.classList.remove('is-on'));this.updateWizardAccountPickHint()
    },
    wizardInvertAccounts(){
      if(this.wizardIsIndependent()){this.toast('独立发布只能选择 1 个账号',true);return}
      this.invertAccountPick('wizard-accounts');if(this.wizardIsRandom()){const need=this.wizardMaterialCount();const on=[...document.querySelectorAll('#wizard-accounts .account-pick-tag.is-on')].filter(el=>!el.classList.contains('is-filtered-out'));if(on.length>need){on.slice(need).forEach(el=>el.classList.remove('is-on'));this.toast(`已自动裁剪为 ${need} 个账号`,true)}}this.updateWizardAccountPickHint()
    },
    setMassScriptGroup(id){this.collectMass();this.mass.scriptGroupId=id||'';this.mass.templateId='';document.querySelector('#content').innerHTML=this.matrixTabs('tasks')+this.massWizardPanel()},
    collectMass(){const m=this.mass;m.massChannel='bit';const read=name=>document.querySelector(`[name="${name}"]`)?.value;if(m.step===1){m.groupId=read('groupId')||'';m.accountIds=this.selectedAccountPickIds('mass-accounts')}if(m.step===2){m.sendTargetType=read('sendTargetType')||'imported';m.uidGroupId=read('uidGroupId')||'';m.fixedTargets=read('fixedTargets')||''}if(m.step===3){m.templateId=read('templateId')||'';m.content=read('content')||''}if(m.step===4){m.name=read('name')||'';m.sendInterval=Number(read('sendInterval')||800);m.retryCount=Number(read('retryCount')||0);m.perAccountLimit=Number(read('perAccountLimit')||20);m.scheduledAt=read('scheduledAt')||''}},
    async massNext(){this.collectMass();const m=this.mass;if(m.step===1&&!(m.accountIds||[]).length&&!m.groupId){this.toast('请勾选账号，或选择账号分组',true);return}if(m.step===2){const t=m.sendTargetType||'imported';if(t==='imported'&&!m.uidGroupId){this.toast('请选择 UID 分组',true);return}if(t==='fixed'&&!String(m.fixedTargets||'').trim()){this.toast('请填写固定对象 UID',true);return}}if(m.step===3){if(this.dmTemplateEnabled===false){m.templateId='';if(!String(m.content||'').trim()){this.toast('话术已关闭，请填写发送内容',true);return}}else if(!String(m.content||'').trim()&&!m.templateId){this.toast('请填写内容或选择话术',true);return}}if(m.step===4&&!m.name){this.toast('请填写任务名称',true);return}this.mass.step+=1;document.querySelector('#content').innerHTML=this.matrixTabs('tasks')+this.massWizardPanel();if(this.mass.step===1)await this.fillMassAccounts()},
    massPrev(){this.collectMass();this.mass.step=Math.max(1,this.mass.step-1);document.querySelector('#content').innerHTML=this.matrixTabs('tasks')+this.massWizardPanel();if(this.mass.step===1)this.fillMassAccounts()},
    async massSubmit(){this.collectMass();const m=this.mass;m.massChannel='bit';if(!m.name){this.toast('请填写任务名称',true);return}if(!(m.accountIds||[]).length&&!m.groupId){this.toast('请勾选账号或选择账号分组',true);return}const t=m.sendTargetType||'imported';if(t==='imported'&&!m.uidGroupId){this.toast('请选择 UID 分组',true);return}if(t==='fixed'&&!String(m.fixedTargets||'').trim()){this.toast('请填写固定对象',true);return}if(this.dmTemplateEnabled===false){m.templateId=''}if(!String(m.content||'').trim()&&!m.templateId){this.toast(this.dmTemplateEnabled===false?'话术已关闭，请填写发送内容':'请填写内容或选择话术',true);return}if(!(await this.ensureBitOnline('比特群发')))return;try{const created=await this.api('/tasks',{method:'POST',body:JSON.stringify({name:m.name,type:'message',groupId:m.groupId?Number(m.groupId):null,totalCount:0,scheduledAt:m.scheduledAt?new Date(m.scheduledAt).toISOString():null,payload:{massChannel:'bit',sendTargetType:m.sendTargetType||'imported',uidGroupId:m.uidGroupId?Number(m.uidGroupId):null,fixedTargets:m.fixedTargets||'',templateId:m.templateId?Number(m.templateId):null,content:m.content||'',accountIds:m.accountIds||[],sendInterval:Number(m.sendInterval||800),retryCount:Number(m.retryCount||0),perAccountLimit:Number(m.perAccountLimit||20)}})});await this.api('/tasks/'+created.id+'/start',{method:'POST'});this.toast('群发任务已创建并进入队列');this.massWizardOpen=false;this.matrixTab='tasks';this.taskTypeFilter='message';this.refresh()}catch(e){this.toast(e.message,true)}},
    async retryFailedItems(id){if(!(await this.ask('将失败和人工跳过的子任务重新排队（会重新上传准备），是否继续？')))return;try{const r=await this.api(`/tasks/${id}/items/retry-failed`,{method:'POST',body:JSON.stringify({includeSkipped:true})});this.toast(`已重新排队 ${r.retried} 条`);this.closeModal();this.refresh()}catch(e){this.toast(e.message,true)}},
    async resumePublishItem(taskId,itemId){if(!(await this.ask('将在已打开的比特环境里点击发布按钮。请确认页面仍停在上传编辑态。继续？')))return;this.toast('正在继续发布…');try{const r=await this.api(`/tasks/${taskId}/items/${itemId}/resume-publish`,{method:'POST'});this.toast(r.status==='published'?'继续发布成功':(r.reason||r.status||'已处理'),r.status!=='published');this.taskDetailModal(taskId);this.refresh()}catch(e){this.toast(e.message,true);this.taskDetailModal(taskId)}},
    async confirmPublishedItem(taskId,itemId){if(!(await this.ask('确认该条已在 TikTok 人工发布成功？将标记为成功；若任务开启了发后删除，会删除本地素材记录。')))return;try{await this.api(`/tasks/${taskId}/items/${itemId}/confirm-published`,{method:'POST'});this.toast('已标记为发布成功');this.taskDetailModal(taskId);this.refresh()}catch(e){this.toast(e.message,true)}},
    batchEditTaskItems(taskId){this.modal('批量修改子任务文案',`<div class="form-grid">${this.field('title','统一标题（可空）')}${this.field('caption','统一文案（可空）','','textarea')}${this.selectRaw('scope','范围',[['pending','仅待执行/失败/跳过'],['all','全部未成功']],'pending')}<div class="field full"><div class="muted">已成功或正在发布的子任务不会改。留空字段不改。</div></div></div>`,async d=>{const r=await this.api(`/tasks/${taskId}/items/batch-update`,{method:'POST',body:JSON.stringify({title:d.title||'',caption:d.caption||'',scope:d.scope||'pending'})});this.toast(`已更新 ${r.updated} 条`);this.closeModal();this.taskDetailModal(taskId)})},
    editTaskItem(taskId,itemId){this.modal('修改子任务文案',`<div class="form-grid">${this.field('title','标题，留空则用任务标题')}${this.field('caption','文案，留空则用任务文案','','textarea')}<div class="field full"><div class="muted">只影响这一条下次执行。已成功的子任务不能改。</div></div></div>`,async d=>{await this.api(`/tasks/${taskId}/items/${itemId}`,{method:'PUT',body:JSON.stringify({title:d.title||'',caption:d.caption||''})});this.toast('文案已保存，下次执行使用这条文案');this.closeModal();this.taskDetailModal(taskId)})},
    onMaterialPickerFieldChange(fieldId,ids){if(fieldId==='wizard-material-field'&&this.wizard){const next=ids||[];this.wizard.materialIds=this.wizardIsIndependent()?next.slice(0,1):next;this.wizard.materialSource='library'}},
    wizardIsRandom(w){w=w||this.wizard||{};return (w.publishMode||'random')==='random'},
    wizardIsOrdered(w){w=w||this.wizard||{};return (w.publishMode||'')==='ordered'},
    wizardIsIndependent(w){w=w||this.wizard||{};return (w.publishMode||'')==='independent'},
    wizardStepKinds(w){
      w=w||this.wizard||{};
      if(this.wizardIsOrdered(w))return ['entry','compose','config','confirm'];
      if(this.wizardIsRandom(w))return ['entry','materials','accounts','config','confirm'];
      return ['entry','accounts','materials','config','confirm'];
    },
    wizardStepKind(step,w){return this.wizardStepKinds(w||this.wizard)[(step||1)-1]||'entry'},
    wizardStepLabels(w){const map={entry:'发布入口',compose:'发布组合',materials:'选择视频',accounts:'选择账号',pairs:'发布组合',config:'任务配置',confirm:'确认'};return this.wizardStepKinds(w).map(k=>map[k])},
    wizardAccountLabel(id){
      const a=(this._wizardAccountsCache||[]).find(x=>Number(x.id)===Number(id));
      return a?(a.username||a.nickname||('#'+id)):('#'+id);
    },
    wizardMaterialLabel(id){
      const m=(this.materials||[]).find(x=>Number(x.id)===Number(id))||this._mp?.selectedMap?.get(Number(id));
      return m?(m.name||m.fileName||m.file_name||('#'+id)):('#'+id);
    },
    wizardUsedAccountIds(w){return [...new Set((w?.pairs||[]).map(p=>Number(p.accountId)).filter(Boolean))]},
    wizardUsedMaterialIds(w){return [...new Set((w?.pairs||[]).map(p=>Number(p.materialId)).filter(Boolean))]},
    syncWizardIdsFromPairs(){
      const w=this.wizard;if(!w)return;
      const pairs=(w.pairs||[]).filter(p=>Number(p.accountId)&&Number(p.materialId));
      w.pairs=pairs;
      w.accountIds=[...new Set(pairs.map(p=>Number(p.accountId)))];
      w.materialIds=[...new Set(pairs.map(p=>Number(p.materialId)))];
      w.materialSource='library';
      w.publishStrategy='pairs';
      w.groupId='';
    },
    ensureWizardPairDraft(){
      const w=this.wizard;if(!w)return {accountIds:[],materialIds:[]};
      if(!w.pairDraft)w.pairDraft={accountIds:[],materialIds:[]};
      w.pairDraft.accountIds=(w.pairDraft.accountIds||[]).map(Number).filter(Boolean);
      w.pairDraft.materialIds=(w.pairDraft.materialIds||[]).map(Number).filter(Boolean);
      return w.pairDraft;
    },
    tryCommitWizardPairDraft(){
      const w=this.wizard;if(!w)return;
      const draft=this.ensureWizardPairDraft();
      const usedAcc=new Set(this.wizardUsedAccountIds(w));
      const usedMat=new Set(this.wizardUsedMaterialIds(w));
      draft.accountIds=draft.accountIds.filter(id=>!usedAcc.has(id));
      draft.materialIds=draft.materialIds.filter(id=>!usedMat.has(id));
      const n=Math.min(draft.accountIds.length,draft.materialIds.length);
      if(!n){this.refreshWizardPairsPanel();return}
      w.pairs=w.pairs||[];
      for(let i=0;i<n;i++){
        const accountId=draft.accountIds[i];
        const materialId=draft.materialIds[i];
        if(w.pairs.some(p=>Number(p.accountId)===accountId&&Number(p.materialId)===materialId))continue;
        w.pairs.push({key:'p-'+Date.now()+'-'+i+'-'+Math.random().toString(36).slice(2,6),accountId,materialId});
      }
      draft.accountIds=draft.accountIds.slice(n);
      draft.materialIds=draft.materialIds.slice(n);
      this.syncWizardIdsFromPairs();
      this.refreshWizardPairsPanel();
    },
    removeWizardPair(key){
      const w=this.wizard;if(!w)return;
      w.pairs=(w.pairs||[]).filter(p=>p.key!==key);
      this.syncWizardIdsFromPairs();
      this.refreshWizardPairsPanel();
    },
    openComposeAccountPicker(){
      const w=this.wizard;if(!w)return;
      const used=new Set(this.wizardUsedAccountIds(w));
      this.modal('选择账号',`<div class="form-grid"><div class="field full"><div class="muted" style="margin-bottom:8px">已加入发布组合的账号不会出现。可多选；确认后与已选视频按顺序自动配对。</div>${this.accountPickToolbarHtml('pair-pick-accounts',{batchHtml:`<button type="button" class="tiny" onclick="app.setAccountPickAll('pair-pick-accounts',true)">全选</button><button type="button" class="tiny" onclick="app.setAccountPickAll('pair-pick-accounts',false)">清空</button>`})}<div id="pair-pick-accounts" class="account-pick-grid"><div class="muted account-pick-empty" style="padding:12px;grid-column:1/-1">加载中…</div></div></div></div>`,async()=>{
        const ids=this.selectedAccountPickIds('pair-pick-accounts');
        if(!ids.length)throw new Error('请至少选择一个账号');
        const draft=this.ensureWizardPairDraft();
        draft.accountIds=[...new Set([...(draft.accountIds||[]),...ids])];
        this.closeModal();
        this.tryCommitWizardPairDraft();
      },false,{submitText:'确认选择',wide:true});
      this.fillComposeAccountPicker(used);
    },
    async fillComposeAccountPicker(usedSet){
      const box=document.querySelector('#pair-pick-accounts');
      if(!box)return;
      try{
        const accounts=(await this.api('/accounts?pageSize=200')).items||[];
        this._wizardAccountsCache=accounts;
        const used=usedSet||new Set();
        const list=accounts.filter(a=>!used.has(Number(a.id)));
        box.innerHTML=list.length?list.map(a=>this.accountPickTagHtml(a,new Set())).join(''):'<div class="muted account-pick-empty" style="padding:12px;grid-column:1/-1">没有可选账号（可能都已加入组合）</div>';
        this.filterAccountPick('pair-pick-accounts');
      }catch(e){
        box.innerHTML=`<div class="muted account-pick-empty" style="padding:12px;grid-column:1/-1">${this.esc(e.message||'加载账号失败')}</div>`;
      }
    },
    openComposeMaterialPicker(){
      const w=this.wizard;if(!w)return;
      const used=this.wizardUsedMaterialIds(w);
      this.openMaterialPicker({
        multiple:true,
        max:0,
        selectedIds:[],
        excludeIds:used,
        title:'选择视频素材（已用过的不会出现）',
        onConfirm:(items)=>{
          const ids=(items||[]).map(m=>Number(m.id)).filter(Boolean);
          if(!ids.length){this.toast('请至少选择一个视频',true);return}
          const draft=this.ensureWizardPairDraft();
          draft.materialIds=[...new Set([...(draft.materialIds||[]),...ids])];
          (items||[]).forEach(m=>{
            if(!this.materials)this.materials=[];
            if(!this.materials.some(x=>Number(x.id)===Number(m.id)))this.materials.push(m);
          });
          this.tryCommitWizardPairDraft();
        },
      });
    },
    refreshWizardPairsPanel(){
      const box=document.querySelector('#wizard-pairs-panel');
      if(!box||!this.wizard)return;
      if(window.UI?.restorePopups)UI.restorePopups();
      box.innerHTML=this.wizardPairsBody(this.wizard);
      if(window.UI)UI.decorate(box);
    },
    wizardPairsBody(w){
      const pairs=w.pairs||[];
      const draft=w.pairDraft||{accountIds:[],materialIds:[]};
      const pendingAcc=(draft.accountIds||[]).length;
      const pendingMat=(draft.materialIds||[]).length;
      const rows=pairs.length?pairs.map((p)=>`<div class="pair-row">
        <div class="pair-cell"><span class="lbl">账号</span><span class="val">${this.esc(this.wizardAccountLabel(p.accountId))}</span><span class="sub">#${p.accountId}</span></div>
        <div class="pair-arrow">→</div>
        <div class="pair-cell"><span class="lbl">视频</span><span class="val">${this.esc(this.wizardMaterialLabel(p.materialId))}</span><span class="sub">#${p.materialId}</span></div>
        <button type="button" class="tiny danger" onclick="app.removeWizardPair('${p.key}')" title="取消此组合">取消</button>
      </div>`).join(''):`<div class="pair-empty">暂无组合。点击下方「选择账号」「选择视频」，两边都选好后会按顺序自动生成组合。</div>`;
      const pending=pendingAcc||pendingMat
        ?`<span class="pair-draft-chip">待配对 账号 ${pendingAcc} · 视频 ${pendingMat}</span>`
        :'<span class="muted" style="font-size:12px">已用过的账号/视频不会再出现在弹框中</span>';
      return `<div class="pair-board">
        <div class="pair-board-head">
          <div><b>发布组合（${pairs.length}）</b><div class="muted">每个组合将创建 1 个独立任务（1 账号 + 1 视频）。取消后可重新选择。</div></div>
        </div>
        <div class="pair-list">${rows}</div>
        <div class="pair-add">
          <div class="pair-add-actions">
            <button type="button" class="primary" onclick="app.openComposeAccountPicker()">选择账号</button>
            <button type="button" class="primary" onclick="app.openComposeMaterialPicker()">选择视频</button>
          </div>
          <div class="pair-add-hint">${pending}</div>
        </div>
      </div>`;
    },
    wizardComposeBody(w){
      return `<div class="wizard-compose"><div id="wizard-pairs-panel">${this.wizardPairsBody(w)}</div></div>`;
    },
    wizardMaterialCount(w){w=w||this.wizard||{};if((w.materialSource||'files')==='library')return (w.materialIds||[]).filter(Boolean).length;return (w.selectedVideos||[]).filter(v=>v.status==='ready'&&v.materialId).length},
    buildWizardTaskName(w){
      w=w||this.wizard||{};
      const accIds=(w.accountIds||[]).map(Number).filter(Boolean);
      const matIds=(w.materialIds||[]).map(Number).filter(Boolean);
      const clean=(s,fb)=>{const t=String(s||'').replace(/[\\/:*?"<>|\r\n]+/g,'').trim();return t||fb};
      let accName='';
      if(accIds.length){
        const cache=this._wizardAccountsCache||[];
        const a=cache.find(x=>Number(x.id)===accIds[0]);
        accName=a?.username||a?.nickname||('#'+accIds[0]);
        if(accIds.length>1)accName=`${accName}等${accIds.length}个`;
      }else if(w.groupId){
        const g=(this.groups||[]).find(x=>Number(x.id)===Number(w.groupId));
        accName=g?.name||('分组#'+w.groupId);
      }else{
        accName='全部账号';
      }
      let videoName='';
      if(matIds.length){
        const m=(this.materials||[]).find(x=>Number(x.id)===matIds[0])||this._mp?.selectedMap?.get(matIds[0]);
        videoName=m?.name||m?.fileName||m?.file_name||('#'+matIds[0]);
        if(matIds.length>1)videoName=`${videoName}等${matIds.length}个`;
      }else{
        videoName='未选视频';
      }
      return `account(${clean(accName,'账号')})-video(${clean(videoName,'视频')})`.slice(0,160);
    },
    updateWizardAccountPickHint(){const hint=document.querySelector('#wizard-accounts-count-hint');if(!hint)return;const need=this.wizardMaterialCount();const cur=this.selectedAccountPickIds('wizard-accounts').length;if(this.wizardIsRandom()){hint.textContent=`已选 ${cur} / 需选 ${need}`;hint.style.color=(cur===need&&need>0)?'#16a34a':'#dc2626'}else if(this.wizardIsIndependent()){hint.textContent=cur?`已选 1 个账号`:'请选择 1 个账号';hint.style.color=cur===1?'#16a34a':'#dc2626'}else{hint.textContent=`已选 ${cur} 个`;hint.style.color='#64748b'}},
    async maybeFillWizardAccounts(){if(this.wizardStepKind(this.wizardStep)==='accounts')await this.fillWizardAccounts()},
    wizardAccountsBody(w){
      const gs=this.groups.filter(g=>g.type==='account');
      const need=this.wizardMaterialCount(w);
      const random=this.wizardIsRandom(w);
      const indep=this.wizardIsIndependent(w);
      const label=random?`指定账号（必须选择 ${need} 个，与素材数量相等）`:(indep?'指定账号（只能选 1 个）':'指定账号（可多选，留空则使用分组或全部启用账号）');
      const groupField=(random||indep)?'':this.select('groupId','账号分组（可选）',gs,w.groupId);
      const tip=`<div class="muted" id="wizard-accounts-count-hint" style="margin:0 0 8px">${random?`已选 ${(w.accountIds||[]).length} / 需选 ${need}`:(indep?((w.accountIds||[]).length?`已选 1 个账号`:'请选择 1 个账号'):`已选 ${(w.accountIds||[]).length} 个`)}</div>`;
      const batchBtns=indep
        ?`<button type="button" class="tiny" onclick="app.wizardSelectAccounts(false)">清空</button>`
        :`<button type="button" class="tiny" onclick="app.wizardSelectAccounts(true)">全选</button><button type="button" class="tiny" onclick="app.wizardSelectAccounts(false)">清空</button><button type="button" class="tiny" onclick="app.wizardInvertAccounts()">反选</button>`;
      return `<div class="form-grid">${groupField}<div class="field full"><label>${label}</label>${tip}${this.accountPickToolbarHtml('wizard-accounts',{batchHtml:batchBtns})}<div id="wizard-accounts" class="account-pick-grid"></div></div></div>`;
    },
    wizardMaterialsBody(w){
      const indep=this.wizardIsIndependent(w);
      const tip=indep
        ?'独立发布：每次只能选择 1 个视频，与 1 个账号组成一条独立发布任务。'
        :'随机发布：账号数须与视频数相同；提交时随机配对，每对创建 1 个独立任务。';
      return `<div class="form-grid"><div class="field full"><label>视频素材${indep?'（单选）':''}</label><div class="muted" style="margin-bottom:8px">${tip} 从素材库弹框选择本账号已上传视频；可在弹框内上传、删除、重命名。新上传排在最前。</div>${this.materialPickerFieldHtml({fieldId:'wizard-material-field',name:'materialIds',multiple:!indep,max:indep?1:0,selectedIds:indep?(w.materialIds||[]).slice(0,1):(w.materialIds||[])})}</div></div>`;
    },
    openPublishWizard(mode='random',opts={}){
      const ordered=mode==='ordered';
      if(ordered){if(!this.canPermission('publish.tasks')&&!this.canPermission('publish.mass')){this.toast('当前角色无权创建群发任务',true);return}}
      else if(!this.canPermission('publish.tasks')){this.toast('当前角色无权创建发布任务',true);return}
      const publishMode=ordered?'ordered':(mode==='independent'?'independent':'random');
      const publishStrategy=publishMode==='independent'?'deduplicate':(publishMode==='ordered'?'pairs':'random');
      this.massWizardOpen=false;this.deleteWizardOpen=false;this.commentReplyWizardOpen=false;
      this.wizard={pushChannel:'bit',accountIds:[],groupId:'',materialIds:[],materialSource:'library',selectedVideos:[],folderPath:'',publishMode,publishStrategy,pairs:[],pairDraft:{accountIds:[],materialIds:[]},publishTitle:'',publishCaption:'',hashtags:'',name:'',scheduledAt:'',threadCount:1,saveTraffic:false,deleteAfterPublish:false};
      this.wizardStep=1;this.wizardOpen=true;this.matrixTab='tasks';
      if(!opts.skipRefresh)this.refresh();
    },
    publishModeLabel(mode){return mode==='independent'?'独立发布':(mode==='ordered'?'群发任务':'随机发布')},
    closePublishWizard(){this.wizardOpen=false;this.massWizardOpen=false;this.refresh()},
    wizardPanel(){const step=this.wizardStep||1;setTimeout(()=>this.bindWizardMaterialSource(),0);const w=this.wizard||{};const labels=this.wizardStepLabels(w);const last=labels.length;const modeTitle=this.publishModeLabel(w.publishMode||'random');const modeHint=this.wizardIsOrdered(w)?'人为指定账号↔视频组合，每组创建 1 个任务':(this.wizardIsRandom(w)?'账号与视频等量选择后随机配对，每对创建 1 个任务':'每次选 1 个账号 + 1 个视频，创建 1 条独立发布任务');return `<div class="wizard"><div class="toolbar" style="margin:0 0 12px"><div><b>${this.esc(modeTitle)}</b><span class="muted" style="margin-left:8px">${modeHint}</span></div></div><div class="wizard-steps">${labels.map((n,i)=>`<span class="${i+1===step?'on':''}">${i+1} ${n}</span>`).join('')}</div><div id="wizard-body">${this.wizardBody(step,w)}</div><div class="toolbar" style="margin-top:16px"><button class="ghost" onclick="app.closePublishWizard()">取消</button><div>${step>1?`<button class="ghost" type="button" onclick="app.wizardPrev()">上一步</button> `:''}${step<last?`<button class="primary" type="button" onclick="app.wizardNext()">下一步</button>`:`<button class="primary" type="button" onclick="app.wizardSubmit()">创建任务</button>`}</div></div></div>`},
    wizardBody(step,w){const kind=this.wizardStepKind(step,w);if(kind==='entry')return `<div class="channels"><button type="button" class="channel active"><b>比特浏览器</b><span class="muted">打开环境并上传，按设置自动点击发布或停在待确认</span></button></div>`;if(kind==='compose')return this.wizardComposeBody(w);if(kind==='accounts')return this.wizardAccountsBody(w);if(kind==='materials')return this.wizardMaterialsBody(w);if(kind==='pairs')return `<div id="wizard-pairs-panel">${this.wizardPairsBody(w)}</div>`;if(kind==='config')return `<div class="form-grid">${this.field('name','任务名称前缀',w.name||'','text',true)}${this.field('scheduledAt','定时发布（可空）',w.scheduledAt||'','datetime-local')}${this.field('threadCount','线程数（1-3）',w.threadCount??1,'number')}${this.selectRaw('saveTraffic','省流模式',[['false','关闭'],['true','开启']],String(w.saveTraffic)==='true'?'true':'false')}${this.selectRaw('deleteAfterPublish','发后删除素材记录',[['false','关闭'],['true','开启']],String(w.deleteAfterPublish)==='true'?'true':'false')}${this.wizardIsOrdered(w)||this.wizardIsRandom(w)?`<div class="field full"><div class="muted">将按「1 账号 + 1 视频 = 1 任务」创建多条任务；名称会自动带上账号与视频。</div></div>`:''}</div>`;const names=(w.accountIds||[]).length?`${w.accountIds.length} 个指定账号`:(w.groupId?`分组 #${w.groupId}`:'全部启用账号');const matCount=(w.materialIds||[]).length;const matText=w.materialSource==='library'?`素材库 ${matCount} 个`:`已选 ${matCount} 个视频文件`;const pairCount=this.wizardIsOrdered(w)?(w.pairs||[]).filter(p=>p.accountId&&p.materialId).length:(this.wizardIsRandom(w)?Math.min((w.accountIds||[]).length,matCount):0);const taskCountLine=(this.wizardIsOrdered(w)||this.wizardIsRandom(w))?`<br><b>将创建 ${pairCount} 个独立任务</b>（每任务 = 1 账号 + 1 视频）`:'';const pairLine=this.wizardIsOrdered(w)?`<br>组合：${pairCount} 条（人为指定）`:(this.wizardIsRandom(w)?`<br>配对：${pairCount} 条（提交时随机匹配）`:'');const strategyLabel=this.wizardIsOrdered(w)?'人为组合':(this.wizardIsRandom(w)?'随机配对':((this.opt('publishStrategies',[['deduplicate','去重'],['random','随机']]).find(x=>x[0]===w.publishStrategy)||[])[1]||w.publishStrategy||'-'));return `<div class="data-meta">通道：比特浏览器<br>账号：${this.esc(names)}<br>素材：${this.esc(matText)}，策略 ${this.esc(strategyLabel)}${pairLine}${taskCountLine}<br>标题/文案/封面：使用各素材自身的分享配置<br>计划：${this.esc(w.scheduledAt||'立即')}</div>`},
    collectWizard(){const w=this.wizard;const read=name=>{const el=document.querySelector(`[name="${name}"]`);return el?el.value:undefined};const kind=this.wizardStepKind(this.wizardStep,w);if(kind==='accounts'){if(this.wizardIsRandom(w)||this.wizardIsIndependent(w))w.groupId='';else w.groupId=read('groupId')||'';w.accountIds=this.selectedAccountPickIds('wizard-accounts');if(this.wizardIsIndependent(w))w.accountIds=(w.accountIds||[]).slice(0,1)}if(kind==='materials'){w.materialSource='library';w.publishStrategy=w.publishMode==='independent'?'deduplicate':'random';w.materialIds=this.selectedMaterialPickerIds?this.selectedMaterialPickerIds('wizard-material-field'):(w.materialIds||[]);if(this.wizardIsIndependent(w))w.materialIds=(w.materialIds||[]).slice(0,1);w.selectedVideos=[]}if(kind==='compose'){this.syncWizardIdsFromPairs()}if(kind==='config'){w.name=read('name')||'';w.scheduledAt=read('scheduledAt')||'';w.threadCount=Number(read('threadCount')||1);w.saveTraffic=read('saveTraffic')==='true';w.deleteAfterPublish=read('deleteAfterPublish')==='true'}},
    bindWizardMaterialSource(){const sel=document.querySelector('[name=materialSource]');if(!sel||sel._bound)return;sel._bound=true;const sync=()=>{const isFiles=(sel.value||'files')!=='library';const f=document.querySelector('#wizard-file-fields');const l=document.querySelector('#wizard-library-fields');if(f)f.style.display=isFiles?'':'none';if(l)l.style.display=isFiles?'none':''};sel.addEventListener('change',sync);sync()},
    renderWizardVideosListHtml(){const list=this.wizard?.selectedVideos||[];if(!list.length){return '<div class="muted" style="font-size:13px;padding:8px 0">暂未选择视频文件。点击上方区域即可选择本地视频。</div>'}const readyCount=list.filter(v=>v.status==='ready').length;const totalSize=list.reduce((acc,v)=>acc+(v.size||0),0);return `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #e2e8f0"><span style="font-weight:600;font-size:13px">已选视频：${readyCount}/${list.length} 个就绪 (${this.formatFileSize(totalSize)})</span><div style="display:flex;gap:8px"><button type="button" class="tiny ghost" onclick="document.querySelector('#wizard-video-input')?.click()">+ 继续添加</button><button type="button" class="tiny danger" onclick="app.clearWizardVideos()">清空全部</button></div></div><div class="table-card" style="max-height:220px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:8px"><table style="width:100%;font-size:12px;border-collapse:collapse"><thead><tr style="background:#f8fafc;text-align:left;border-bottom:1px solid #e2e8f0"><th style="padding:6px 10px">文件名</th><th style="padding:6px 10px;width:90px">大小</th><th style="padding:6px 10px;width:120px">状态</th><th style="padding:6px 10px;width:60px;text-align:center">操作</th></tr></thead><tbody>${list.map((v,i)=>{let statusBadge='<span class="badge queued">等待中</span>';if(v.status==='ready')statusBadge='<span class="badge success">已就绪</span>';else if(v.status==='uploading')statusBadge=`<span class="badge running">上传中 ${v.progress||0}%</span>`;else if(v.status==='error')statusBadge=`<span class="badge failed" title="${this.esc(v.error||'上传失败')}">失败</span>`;return `<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:6px 10px;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${this.esc(v.name)}">🎬 ${this.esc(v.name)}</td><td style="padding:6px 10px;color:#64748b">${this.formatFileSize(v.size||0)}</td><td style="padding:6px 10px">${statusBadge}</td><td style="padding:6px 10px;text-align:center"><button type="button" class="tiny danger" onclick="app.removeWizardVideo(${i})" style="padding:2px 6px">移除</button></td></tr>`}).join('')}</tbody></table></div>`},
    renderWizardVideosList(){const container=document.querySelector('#wizard-video-list-container');if(container)container.innerHTML=this.renderWizardVideosListHtml()},
    removeWizardVideo(index){if(!this.wizard?.selectedVideos)return;this.wizard.selectedVideos.splice(index,1);this.wizard.materialIds=(this.wizard.selectedVideos||[]).filter(v=>v.status==='ready'&&v.materialId).map(v=>v.materialId);this.renderWizardVideosList()},
    clearWizardVideos(){if(!this.wizard)return;this.wizard.selectedVideos=[];this.wizard.materialIds=[];this.renderWizardVideosList()},
    async handleWizardVideos(source){const fileList=source?.files?[...source.files]:[];const inp=document.querySelector('#wizard-video-input');if(inp)inp.value='';if(!fileList.length)return;const videoExts=['.mp4','.mov','.avi','.mkv','.webm','.m4v','.flv'];const validFiles=fileList.filter(f=>{const ext='.'+f.name.split('.').pop().toLowerCase();return (f.type&&f.type.startsWith('video/'))||videoExts.includes(ext)});if(!validFiles.length){this.toast('所选文件中未检测到视频，请选择 MP4、MOV 等视频文件',true);return}if(!this.wizard.selectedVideos)this.wizard.selectedVideos=[];let addedCount=0;for(const file of validFiles){const exists=this.wizard.selectedVideos.find(v=>v.name===file.name&&v.size===file.size);if(!exists){this.wizard.selectedVideos.push({file,name:file.name,size:file.size,status:'pending',progress:0,materialId:null,error:null});addedCount++}}this.renderWizardVideosList();if(addedCount>0){this.toast(`已选择 ${addedCount} 个视频，正在上传…`);await this.uploadPendingWizardVideos()}},
    uploadVideoWithProgress(formData,onProgress){return new Promise((resolve,reject)=>{let apiBase=window.TKSWARM_API_BASE||window.__TKSWARM_CONFIG__?.defaultApiBase||'http://tkswarm-api.dyyweb.com';const xhr=new XMLHttpRequest();xhr.open('POST',apiBase+'/api/materials/upload');if(this.authToken)xhr.setRequestHeader('Authorization','Bearer '+this.authToken);const actingAs=this.getActingAsId();if(actingAs)xhr.setRequestHeader('X-Acting-As',String(actingAs));if(xhr.upload&&onProgress){xhr.upload.onprogress=(e)=>{if(e.lengthComputable){const pct=Math.round((e.loaded/e.total)*100);onProgress(pct)}}};xhr.onload=()=>{let json;try{json=JSON.parse(xhr.responseText)}catch(_){json=null}if(xhr.status>=200&&xhr.status<300&&json&&json.success){resolve(json.data)}else{const err=new Error(json?.message||`上传失败 (HTTP ${xhr.status})`);err.data=json?.data||null;err.code=json?.code||json?.data?.code;reject(err)}};xhr.onerror=()=>reject(new Error('网络请求异常，请检查接口服务'));xhr.send(formData)})},
    async uploadPendingWizardVideos(){const list=this.wizard?.selectedVideos||[];const pending=list.filter(v=>v.status==='pending'||v.status==='error');if(!pending.length)return;for(const item of pending){if(!item.file)continue;item.status='uploading';item.progress=0;item.error=null;this.renderWizardVideosList();try{const fd=new FormData();const cover=await (this.captureVideoCoverBase64?this.captureVideoCoverBase64(item.file):Promise.resolve(''));fd.append('file',item.file);fd.append('name',item.name.replace(/\.[^/.]+$/,''));fd.append('tags','publish-wizard');fd.append('reuseExisting','1');if(cover)fd.append('coverBase64',cover);const mat=await this.uploadVideoWithProgress(fd,(pct)=>{item.progress=pct;this.renderWizardVideosList()});const matId=Number(mat?.id||mat?.data?.id);if(!matId)throw new Error(mat?.message||'未获取到素材ID');item.status='ready';item.materialId=matId;item.progress=100}catch(err){console.error('上传视频错误:',err);if(/内容重复|已存在/i.test(err.message)){try{await this.loadRefs();const cleanName=item.name.replace(/\.[^/.]+$/,'');const match=(this.materials||[]).find(m=>(m.file_name||m.fileName)===item.name||m.name===cleanName);if(match){item.status='ready';item.materialId=Number(match.id);item.progress=100;item.error=null}else{item.status='error';item.error=err.message||'素材已存在但未匹配到记录'}}catch(_){item.status='error';item.error=err.message||'上传失败'}}else{item.status='error';item.error=err.message||'上传失败'}}this.renderWizardVideosList()}this.wizard.materialIds=(this.wizard?.selectedVideos||[]).filter(v=>v.status==='ready'&&v.materialId).map(v=>v.materialId);const readyCount=this.wizard.materialIds.length;if(readyCount>0){this.toast(`视频已就绪 ${readyCount} 个`)}},
    async wizardNext(){
      this.collectWizard();
      const w=this.wizard;
      const kind=this.wizardStepKind(this.wizardStep,w);
      if(kind==='entry'&&!(await this.ensureBitOnline('比特发布')))return;
      if(kind==='accounts'){
        const ids=w.accountIds||[];
        if(this.wizardIsRandom(w)){
          const need=this.wizardMaterialCount(w);
          if(!need){this.toast('请先选择素材',true);return}
          if(ids.length!==need){this.toast(`随机发布需选择 ${need} 个账号（当前 ${ids.length} 个）`,true);return}
          w.groupId='';
        }else if(this.wizardIsIndependent(w)){
          if(ids.length!==1){this.toast('独立发布只能选择 1 个账号',true);return}
          w.groupId='';
          w.accountIds=ids.slice(0,1);
        }else if(!ids.length&&!w.groupId){this.toast('请勾选账号，或选择账号分组',true);return}
      }
      if(kind==='materials'){
        w.materialSource='library';
        if(!(w.materialIds||[]).length){this.toast('请至少选择一个视频素材',true);return}
        if(this.wizardIsIndependent(w)){
          if((w.materialIds||[]).length!==1){this.toast('独立发布只能选择 1 个视频',true);return}
          w.materialIds=(w.materialIds||[]).slice(0,1);
        }
      }
      if(kind==='compose'){
        this.syncWizardIdsFromPairs();
        if(!(w.pairs||[]).filter(p=>p.accountId&&p.materialId).length){this.toast('请至少添加一条发布组合',true);return}
      }
      if(kind==='config'&&!w.name){this.toast(this.wizardIsOrdered(w)||this.wizardIsRandom(w)?'请填写任务名称前缀':'请填写任务名称',true);return}
      this.wizardStep+=1;
      if(this.wizardStepKind(this.wizardStep)==='config'&&!String(w.name||'').trim()){
        // 群发/随机：仅填前缀；完整名在提交时由 buildPairTaskName 拼接，避免重复
        w.name=(this.wizardIsOrdered(w)||this.wizardIsRandom(w))
          ? this.publishModeLabel(w.publishMode||'random')
          : this.buildWizardTaskName(w);
      }
      document.querySelector('#content').innerHTML=this.matrixTabs('tasks')+this.wizardPanel();
      await this.maybeFillWizardAccounts();
      if(this.wizardStepKind(this.wizardStep)==='accounts')this.updateWizardAccountPickHint();
    },
    async wizardPrev(){this.collectWizard();this.wizardStep=Math.max(1,this.wizardStep-1);document.querySelector('#content').innerHTML=this.matrixTabs('tasks')+this.wizardPanel();await this.maybeFillWizardAccounts();if(this.wizardStepKind(this.wizardStep)==='accounts')this.updateWizardAccountPickHint()},
    buildPairTaskName(base,accountId,materialId,index,total){
      const clean=(s,fb)=>{const t=String(s||'').replace(/[\\/:*?"<>|\r\n]+/g,'').trim();return t||fb};
      // 若前缀里已带 account()-video()（旧逻辑误填），先剥掉再拼，避免名称重复两遍
      let prefix=clean(base,'发布').replace(/\s*account\([^)]*\)-video\([^)]*\)\s*/gi,' ').replace(/\s+/g,' ').trim();
      prefix=prefix||'发布';
      const acc=clean(this.wizardAccountLabel(accountId),'账号');
      const video=clean(this.wizardMaterialLabel(materialId),'视频');
      const seq=total>1?`(${index+1}/${total}) `:'';
      return `${prefix} ${seq}account(${acc})-video(${video})`.slice(0,160);
    },
    async createPublishPairTask(pair,opts={}){
      const accountId=Number(pair.accountId);
      const materialId=Number(pair.materialId);
      const payload={
        pushChannel:'bit',
        accountIds:[accountId],
        materialIds:[materialId],
        pairs:[{accountId,materialId}],
        folderPath:'',
        publishMode:opts.publishMode||'random',
        publishStrategy:'pairs',
        publishTitle:opts.publishTitle||'',
        publishCaption:opts.publishCaption||'',
        hashtags:opts.hashtags||'',
        threadCount:opts.threadCount||1,
        saveTraffic:!!opts.saveTraffic,
        deleteAfterPublish:!!opts.deleteAfterPublish,
      };
      const created=await this.api('/tasks',{method:'POST',body:JSON.stringify({
        name:opts.name||this.buildPairTaskName('发布',accountId,materialId,0,1),
        type:'publish',
        groupId:null,
        totalCount:1,
        scheduledAt:opts.scheduledAt||null,
        payload,
      })});
      await this.api('/tasks/'+created.id+'/start',{method:'POST'});
      return created;
    },
    async wizardSubmit(){
      this.collectWizard();
      const w=this.wizard;
      if(!w.name){this.toast(this.wizardIsOrdered(w)||this.wizardIsRandom(w)?'请填写任务名称前缀':'请填写任务名称',true);return}
      let materialIds=(w.materialIds||[]).map(Number).filter(Boolean);
      let ids=(w.accountIds||[]).map(Number).filter(Boolean);
      let pairs=[];
      if(this.wizardIsOrdered(w)){
        pairs=(w.pairs||[]).filter(p=>Number(p.accountId)&&Number(p.materialId)).map(p=>({accountId:Number(p.accountId),materialId:Number(p.materialId)}));
        if(!pairs.length){this.toast('请至少保留一条发布组合',true);return}
        w.groupId='';
      }else if(this.wizardIsRandom(w)){
        if(!materialIds.length){this.toast('请至少选择一个视频素材',true);return}
        if(ids.length!==materialIds.length){this.toast(`随机发布账号数必须等于素材数（账号 ${ids.length} / 素材 ${materialIds.length}）`,true);return}
        w.groupId='';
        const shuffled=this.shuffleIds(materialIds);
        pairs=ids.map((accountId,i)=>({accountId,materialId:shuffled[i]}));
      }else{
        if(!materialIds.length){this.toast('请选择 1 个视频素材',true);return}
        if(materialIds.length!==1){this.toast('独立发布只能选择 1 个视频',true);return}
        if(ids.length!==1){this.toast('独立发布只能选择 1 个账号',true);return}
        materialIds=materialIds.slice(0,1);
        ids=ids.slice(0,1);
        w.groupId='';
      }
      if(!(await this.ensureBitOnline('比特发布')))return;
      const scheduledAt=w.scheduledAt?new Date(w.scheduledAt).toISOString():null;
      try{
        if(this.wizardIsOrdered(w)||this.wizardIsRandom(w)){
          let ok=0;
          for(let i=0;i<pairs.length;i++){
            const p=pairs[i];
            await this.createPublishPairTask(p,{
              name:this.buildPairTaskName(w.name,p.accountId,p.materialId,i,pairs.length),
              publishMode:w.publishMode||'random',
              publishTitle:w.publishTitle||'',
              publishCaption:w.publishCaption||'',
              hashtags:w.hashtags||'',
              threadCount:w.threadCount||1,
              saveTraffic:!!w.saveTraffic,
              deleteAfterPublish:!!w.deleteAfterPublish,
              scheduledAt,
            });
            ok+=1;
          }
          this.toast(`${this.publishModeLabel(w.publishMode||'random')}：已创建 ${ok} 个任务并进入队列`);
          this.wizardOpen=false;this.massWizardOpen=false;this.matrixTab='tasks';
          this.taskTypeFilter='publish';this.taskModeFilter=this.wizardIsOrdered(w)?'ordered':(this.wizardIsRandom(w)?'random':'');
          this.taskPage=1;this.refresh();
          return;
        }
        const payload={
          pushChannel:'bit',accountIds:ids,materialIds,folderPath:'',
          publishMode:w.publishMode||'independent',
          publishStrategy:'deduplicate',
          publishTitle:w.publishTitle||'',publishCaption:w.publishCaption||'',hashtags:w.hashtags||'',
          threadCount:w.threadCount||1,saveTraffic:!!w.saveTraffic,deleteAfterPublish:!!w.deleteAfterPublish,
        };
        const created=await this.api('/tasks',{method:'POST',body:JSON.stringify({
          name:w.name,type:'publish',groupId:w.groupId?Number(w.groupId):null,
          totalCount:ids.length||0,
          scheduledAt,
          payload,
        })});
        await this.api('/tasks/'+created.id+'/start',{method:'POST'});
        this.toast((this.publishModeLabel(w.publishMode||'random'))+'已创建并进入队列');
        this.wizardOpen=false;this.massWizardOpen=false;this.matrixTab='tasks';
        this.taskTypeFilter='publish';this.taskModeFilter='independent';this.taskPage=1;this.refresh();
      }catch(e){this.toast(e.message,true)}
    },

    /* ========== 视频删除向导 ========== */
    openDeleteWizard(opts={}){
      if(!this.canPermission('publish.tasks')){this.toast('当前角色无权创建删除任务',true);return}
      this.wizardOpen=false;this.massWizardOpen=false;this.commentReplyWizardOpen=false;
      this.deleteWizard={
        step:1,
        accountIds:[],
        selectedKeys:new Set(),
        rows:[],
        loading:false,
        loadError:'',
        syncing:false,
      };
      this.deleteWizardOpen=true;
      this.matrixTab='tasks';
      if(!opts.skipRefresh)this.refresh();
    },
    closeDeleteWizard(){this.deleteWizardOpen=false;this.deleteWizard=null;this.refresh()},
    deleteWizardPanel(){
      const w=this.deleteWizard||{step:1};
      const step=Number(w.step||1);
      const labels=['选择账号','选择视频','确认删除'];
      return `<div class="wizard">
        <div class="toolbar" style="margin:0 0 12px"><div><b>视频删除向导</b><span class="muted" style="margin-left:8px">按账号加载已同步的 TikTok 视频（可关联系统已发布素材），多选后挂入删除任务</span></div></div>
        <div class="wizard-steps">${labels.map((n,i)=>`<span class="${i+1===step?'on':''}">${i+1} ${n}</span>`).join('')}</div>
        <div class="shell-note" style="margin:0 0 12px">删除 TikTok 视频必须使用平台 <b>video_id</b>。系统素材本身没有平台 ID：优先用发布回写的 <code>platform_video_id</code>；否则先「同步视频」再按账号匹配。没有 video_id 的行不可勾选。</div>
        <div id="delete-wizard-body">${this.deleteWizardBody(step,w)}</div>
        <div class="toolbar" style="margin-top:16px">
          <button class="ghost" type="button" onclick="app.closeDeleteWizard()">取消</button>
          <div>
            ${step>1?`<button class="ghost" type="button" onclick="app.deleteWizardPrev()">上一步</button> `:''}
            ${step<3?`<button class="primary" type="button" onclick="app.deleteWizardNext()">下一步</button>`:`<button class="primary" type="button" onclick="app.deleteWizardSubmit()">创建删除任务</button>`}
          </div>
        </div>
      </div>`;
    },
    deleteWizardBody(step,w){
      if(step===1){
        return `<div class="form-grid"><div class="field full"><label>选择账号</label>
          ${this.accountPickToolbarHtml('delete-wizard-accounts',{batchHtml:`<button type="button" class="tiny" onclick="app.setAccountPickAll('delete-wizard-accounts',true)">全选</button><button type="button" class="tiny" onclick="app.setAccountPickAll('delete-wizard-accounts',false)">清空</button><button type="button" class="tiny" onclick="app.invertAccountPick('delete-wizard-accounts')">反选</button>`})}
          <div id="delete-wizard-accounts" class="account-pick-grid"></div>
        </div></div>`;
      }
      if(step===2){
        const rows=w.rows||[];
        const selected=w.selectedKeys instanceof Set?w.selectedKeys:new Set(w.selectedKeys||[]);
        const selectable=rows.filter(r=>r.videoId);
        const syncing=!!w.syncing;
        const loading=!!w.loading;
        if(loading){
          return `<div class="empty" style="padding:48px 24px">正在加载所选账号的视频与关联素材…</div>`;
        }
        return `<div>
          <div class="matrix-action-bar" style="margin-bottom:10px">
            <div class="left">
              <button type="button" class="primary" ${syncing?'disabled':''} onclick="app.deleteWizardSyncVideos()">${syncing?'同步中…':'同步所选账号视频'}</button>
              <button type="button" class="ghost" ${syncing?'disabled':''} onclick="app.deleteWizardLoadVideos()">刷新列表</button>
              <button type="button" class="tiny" onclick="app.deleteWizardSelectAll(true)">全选可删</button>
              <button type="button" class="tiny" onclick="app.deleteWizardSelectAll(false)">清空</button>
              <span class="muted">已选 ${selected.size} / 可删 ${selectable.length} · 共 ${rows.length} 条</span>
            </div>
          </div>
          ${w.loadError?`<div class="shell-note" style="margin:0 0 10px;color:#b45309">${this.esc(w.loadError)}</div>`:''}
          ${!rows.length?`<div class="empty" style="padding:36px 20px;line-height:1.7">
              暂无视频列表。<br>
              1. 先点上方 <b>同步所选账号视频</b>，从 TikTok 拉取该账号主页视频；<br>
              2. 或确认素材已回写「发布账号」（publish_account_id）。<br>
              <span class="muted">未同步过的账号本地没有 tiktok_videos 记录，列表会为空。</span>
            </div>`:`
          <div class="table-container"><table><thead><tr>
            <th style="width:40px"></th><th>账号</th><th>封面</th><th>视频 ID</th><th>发布标题(搜索用)</th><th>关联素材</th><th>匹配</th>
          </tr></thead><tbody>${rows.map(r=>{
            const on=selected.has(r.key);
            const disabled=!r.videoId;
            const thumb=r.thumbnailUrl&&String(r.thumbnailUrl).startsWith('data:')
              ?`<img src="${r.thumbnailUrl}" alt="" style="width:48px;height:64px;object-fit:cover;border-radius:4px">`
              :(r.thumbnailUrl?`<img src="${this.esc(r.thumbnailUrl)}" alt="" style="width:48px;height:64px;object-fit:cover;border-radius:4px">`:'—');
            const pubTitle=r.publishTitle||r.description||r.materialName||'';
            return `<tr class="${disabled?'is-disabled':''}" style="${disabled?'opacity:.65':''}">
              <td><input type="checkbox" data-dw-key="${this.esc(String(r.key))}" ${on?'checked':''} ${disabled?'disabled':''} onchange='app.toggleDeleteWizardRow(${JSON.stringify(String(r.key))}, this.checked)'></td>
              <td>#${r.accountId} · ${this.esc(r.accountName||'-')}</td>
              <td>${thumb}</td>
              <td class="mono">${this.esc(r.videoId||'—')}</td>
              <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${this.esc(pubTitle)}">${this.esc(pubTitle||'—')}</td>
              <td>${r.materialId?`#${r.materialId} ${this.esc(r.materialName||'')}`:'—'}</td>
              <td>${this.esc(r.matchLabel||'-')}</td>
            </tr>`;
          }).join('')}</tbody></table></div>`}
        </div>`;
      }
      const picked=(w.rows||[]).filter(r=>{
        const sel=w.selectedKeys instanceof Set?w.selectedKeys:new Set(w.selectedKeys||[]);
        return sel.has(r.key);
      });
      const byAcc={};
      picked.forEach(r=>{byAcc[r.accountId]=(byAcc[r.accountId]||0)+1});
      return `<div class="data-meta">将为 <b>${Object.keys(byAcc).length}</b> 个账号挂入删除分任务，共 <b>${picked.length}</b> 条视频。<br>
        ${Object.entries(byAcc).map(([aid,n])=>`账号 #${aid}：${n} 条`).join('<br>')||'未选择'}
        <br><br>执行时进入 Studio 内容列表，用<strong>发布标题</strong>搜索后 ⋯ → Delete → 确认（不用 video_id、不打开视频直链）。</div>`;
    },
    async fillDeleteWizardAccounts(){
      const box=document.querySelector('#delete-wizard-accounts');
      if(!box)return;
      const accounts=(await this.api('/accounts?pageSize=200')).items||[];
      this._deleteWizardAccountsCache=accounts;
      const selected=new Set((this.deleteWizard?.accountIds||[]).map(Number));
      box.innerHTML=accounts.length?accounts.map(a=>this.accountPickTagHtml(a,selected)).join(''):'<div class="muted account-pick-empty" style="padding:12px;grid-column:1/-1">暂无账号</div>';
      this.filterAccountPick('delete-wizard-accounts');
    },
    async deleteWizardNext(){
      const w=this.deleteWizard;if(!w)return;
      if(w.step===1){
        w.accountIds=this.selectedAccountPickIds('delete-wizard-accounts');
        if(!w.accountIds.length){this.toast('请至少选择一个账号',true);return}
        w.step=2;w.selectedKeys=new Set();w.rows=[];w.loading=true;w.loadError='';
        document.querySelector('#content').innerHTML=this.matrixTabs('tasks')+this.deleteWizardPanel();
        await this.deleteWizardLoadVideos({autoSync:false});
        return;
      }
      if(w.step===2){
        if(w.loading){this.toast('视频列表加载中，请稍候',true);return}
        // 从 DOM 回读勾选，避免 onchange 属性异常导致 selectedKeys 未写入
        this.syncDeleteWizardSelectionFromDom();
        const sel=w.selectedKeys instanceof Set?w.selectedKeys:new Set(w.selectedKeys||[]);
        const picked=(w.rows||[]).filter(r=>sel.has(r.key)&&r.videoId);
        if(!picked.length){this.toast('请至少勾选一条可删除视频（无平台 video_id 的行不可删）',true);return}
        w.selectedKeys=sel;
        w.step=3;
        document.querySelector('#content').innerHTML=this.matrixTabs('tasks')+this.deleteWizardPanel();
      }
    },
    syncDeleteWizardSelectionFromDom(){
      const w=this.deleteWizard;if(!w)return;
      if(!(w.selectedKeys instanceof Set))w.selectedKeys=new Set(w.selectedKeys||[]);
      document.querySelectorAll('#delete-wizard-body input[type="checkbox"][data-dw-key]').forEach((el)=>{
        const k=el.getAttribute('data-dw-key');
        if(!k||el.disabled)return;
        if(el.checked)w.selectedKeys.add(k);
        else w.selectedKeys.delete(k);
      });
    },
    async deleteWizardPrev(){
      const w=this.deleteWizard;if(!w)return;
      if(w.step===2){
        const picked=this.selectedAccountPickIds('delete-wizard-accounts');
        if(picked.length)w.accountIds=picked;
      }
      w.step=Math.max(1,w.step-1);
      w.loading=false;
      document.querySelector('#content').innerHTML=this.matrixTabs('tasks')+this.deleteWizardPanel();
      if(w.step===1)await this.fillDeleteWizardAccounts();
    },
    toggleDeleteWizardRow(key,on){
      const w=this.deleteWizard;if(!w)return;
      if(!(w.selectedKeys instanceof Set))w.selectedKeys=new Set(w.selectedKeys||[]);
      key=String(key||'');
      if(!key)return;
      if(on)w.selectedKeys.add(key);else w.selectedKeys.delete(key);
      const body=document.querySelector('#delete-wizard-body');
      if(body)body.innerHTML=this.deleteWizardBody(2,w);
    },
    deleteWizardSelectAll(all){
      const w=this.deleteWizard;if(!w)return;
      w.selectedKeys=new Set();
      if(all)(w.rows||[]).forEach(r=>{if(r.videoId)w.selectedKeys.add(String(r.key))});
      const body=document.querySelector('#delete-wizard-body');
      if(body)body.innerHTML=this.deleteWizardBody(2,w);
    },
    async deleteWizardSyncVideos(){
      const w=this.deleteWizard;if(!w)return;
      if(!(await this.ensureBitOnline('同步视频')))return;
      const ids=(w.accountIds||[]).map(Number).filter(Boolean);
      if(!ids.length){this.toast('请先选择账号',true);return}
      w.syncing=true;w.loading=true;w.loadError='';
      document.querySelector('#content').innerHTML=this.matrixTabs('tasks')+this.deleteWizardPanel();
      let ok=0,fail=0;
      for(const id of ids){
        try{
          await this.api(`/browser/accounts/${id}/sync-videos`,{method:'POST',body:JSON.stringify({limit:100})});
          ok+=1;
        }catch(e){fail+=1}
      }
      w.syncing=false;
      this.toast(`同步完成：成功 ${ok}${fail?`，失败 ${fail}`:''}`,!!fail);
      await this.deleteWizardLoadVideos({autoSync:false});
    },
    normalizeTikTokVideoList(raw){
      if(Array.isArray(raw))return raw;
      if(Array.isArray(raw?.items))return raw.items;
      if(Array.isArray(raw?.list))return raw.list;
      if(Array.isArray(raw?.videos))return raw.videos;
      if(Array.isArray(raw?.data))return raw.data;
      return [];
    },
    async deleteWizardFetchLinkedMaterials(accountIds){
      const idSet=new Set(accountIds.map(Number).filter(Boolean));
      const matchAcc=(m)=>{
        const aid=Number(m.publishAccountId||m.publish_account_id||0);
        return aid>0&&idSet.has(aid);
      };
      // 1) 优先：已发布 + 账号过滤（新接口）
      try{
        const pack=await this.api(`/materials?page=1&pageSize=200&publishStatus=published&publishAccountIds=${[...idSet].join(',')}`);
        const items=Array.isArray(pack)?pack:(pack?.items||[]);
        if(items.length)return items.filter(matchAcc);
      }catch(_){/* 线上可能尚未支持 publishAccountIds */}
      // 2) 仅已发布，前端再按账号过滤
      try{
        const pack=await this.api('/materials?page=1&pageSize=200&publishStatus=published');
        const items=Array.isArray(pack)?pack:(pack?.items||[]);
        const hit=items.filter(matchAcc);
        if(hit.length)return hit;
      }catch(_){}
      // 3) 不过滤发布状态：凡 publish_account_id 命中即展示（兼容未回写 publish_status 的历史数据）
      try{
        const pack=await this.api('/materials?page=1&pageSize=500');
        const items=Array.isArray(pack)?pack:(pack?.items||[]);
        return items.filter(matchAcc);
      }catch(_){}
      // 4) 本地缓存兜底
      return (this.materials||[]).filter(matchAcc);
    },
    async deleteWizardLoadAccountVideos(accountId){
      // 先打线上 PHP；空则再试本机 Node 桥接（同源）
      try{
        const raw=await this.api(`/accounts/${accountId}/tiktok-videos`);
        const list=this.normalizeTikTokVideoList(raw);
        if(list.length)return list;
      }catch(_){}
      try{
        const raw=await this.api(`/browser/accounts/${accountId}/tiktok-videos`);
        return this.normalizeTikTokVideoList(raw);
      }catch(_){
        return [];
      }
    },
    async deleteWizardLoadVideos(opts={}){
      const w=this.deleteWizard;if(!w)return;
      const accountIds=(w.accountIds||[]).map(Number).filter(Boolean);
      if(!accountIds.length){
        w.rows=[];w.loading=false;
        document.querySelector('#content').innerHTML=this.matrixTabs('tasks')+this.deleteWizardPanel();
        return;
      }
      w.loading=true;w.loadError='';
      document.querySelector('#content').innerHTML=this.matrixTabs('tasks')+this.deleteWizardPanel();
      try{
        if(!this._deleteWizardAccountsCache?.length){
          try{
            const pack=await this.api('/accounts?pageSize=200');
            this._deleteWizardAccountsCache=pack?.items||[];
          }catch(_){this._deleteWizardAccountsCache=this._deleteWizardAccountsCache||[]}
        }
        const accMap=new Map((this._deleteWizardAccountsCache||[]).map(a=>[Number(a.id),a]));
        const materials=await this.deleteWizardFetchLinkedMaterials(accountIds);
        const matsByAcc=new Map();
        materials.forEach(m=>{
          const aid=Number(m.publishAccountId||m.publish_account_id||0);
          if(!matsByAcc.has(aid))matsByAcc.set(aid,[]);
          matsByAcc.get(aid).push(m);
        });
        const rows=[];
        const usedVideoIds=new Set();
        let videoFetchErrors=0;
        for(const accountId of accountIds){
          const acc=accMap.get(accountId)||{};
          const accountName=acc.username||acc.nickname||('#'+accountId);
          let videos=[];
          try{
            videos=await this.deleteWizardLoadAccountVideos(accountId);
          }catch(e){
            videoFetchErrors+=1;
            videos=[];
          }
          const mats=matsByAcc.get(accountId)||[];
          const byPlatform=new Map();
          mats.forEach(m=>{
            const pid=String(m.platformVideoId||m.platform_video_id||'').trim();
            if(pid)byPlatform.set(pid,m);
          });
          const unmatchedMats=mats.filter(m=>!String(m.platformVideoId||m.platform_video_id||'').trim());
          for(const v of videos){
            const videoId=String(v.video_id||v.videoId||'').trim();
            if(!videoId)continue;
            usedVideoIds.add(`${accountId}:${videoId}`);
            let mat=byPlatform.get(videoId)||null;
            let matchLabel='同步列表';
            if(mat){
              matchLabel='平台 ID 精确匹配';
            }else{
              const desc=String(v.description||'').toLowerCase();
              mat=unmatchedMats.find(m=>{
                const t=String(m.shareTitle||m.share_title||m.name||'').trim().toLowerCase();
                return t&&t.length>=4&&desc.includes(t);
              })||null;
              if(mat)matchLabel='标题弱匹配';
            }
            rows.push({
              key:`${accountId}:${videoId}`,
              accountId,
              accountName,
              videoId,
              videoUrl:v.video_url||v.videoUrl||'',
              thumbnailUrl:v.thumbnail_url||v.thumbnailUrl||'',
              description:v.description||'',
              materialId:mat?Number(mat.id):0,
              materialName:mat?(mat.name||mat.fileName||mat.file_name||''):'',
              // 与发布弹窗一致：shareTitle || name；绝不用同步描述里的 videoplayback
              publishTitle:mat
                ?(String(mat.shareTitle||mat.share_title||mat.name||'').trim())
                :'',
              matchLabel,
            });
          }
          for(const m of mats){
            const videoId=String(m.platformVideoId||m.platform_video_id||'').trim();
            if(!videoId||usedVideoIds.has(`${accountId}:${videoId}`))continue;
            usedVideoIds.add(`${accountId}:${videoId}`);
            const publishTitle=String(m.shareTitle||m.share_title||m.name||'').trim();
            rows.push({
              key:`${accountId}:${videoId}`,
              accountId,
              accountName,
              videoId,
              videoUrl:m.platformVideoUrl||m.platform_video_url||'',
              thumbnailUrl:(String(m.coverBase64||m.cover_base64||'').startsWith('data:')?(m.coverBase64||m.cover_base64):'')||'',
              description:publishTitle,
              materialId:Number(m.id),
              materialName:m.name||m.fileName||m.file_name||'',
              publishTitle,
              matchLabel:'素材已存平台 ID',
            });
          }
          for(const m of unmatchedMats){
            if(rows.some(r=>r.materialId===Number(m.id)))continue;
            const publishTitle=String(m.shareTitle||m.share_title||m.name||'').trim();
            rows.push({
              key:`mat:${m.id}`,
              accountId,
              accountName,
              videoId:'',
              videoUrl:'',
              thumbnailUrl:(String(m.coverBase64||m.cover_base64||'').startsWith('data:')?(m.coverBase64||m.cover_base64):'')||'',
              description:publishTitle,
              materialId:Number(m.id),
              materialName:m.name||m.fileName||m.file_name||'',
              publishTitle,
              matchLabel:'已关联账号，缺平台 ID（请同步视频）',
            });
          }
        }
        w.rows=rows;
        w.loadError=videoFetchErrors?`有 ${videoFetchErrors} 个账号拉取同步视频失败`: '';
        const valid=new Set(rows.filter(r=>r.videoId).map(r=>r.key));
        w.selectedKeys=new Set([...(w.selectedKeys||[])].filter(k=>valid.has(k)));
        w.loading=false;
        document.querySelector('#content').innerHTML=this.matrixTabs('tasks')+this.deleteWizardPanel();
        if(!rows.length){
          this.toast('暂无关联视频：请点击「同步所选账号视频」拉取 TikTok 列表',true);
        }else if(!rows.some(r=>r.videoId)&&opts.autoSync!==false){
          this.toast('有关联素材但无平台 video_id，请先同步视频',true);
        }else{
          this.toast(`已加载 ${rows.length} 条（可删 ${rows.filter(r=>r.videoId).length}）`);
        }
      }catch(e){
        w.loading=false;
        w.loadError=e.message||'加载失败';
        w.rows=[];
        document.querySelector('#content').innerHTML=this.matrixTabs('tasks')+this.deleteWizardPanel();
        this.toast(w.loadError,true);
      }
    },
    async deleteWizardSubmit(){
      const w=this.deleteWizard;if(!w)return;
      this.syncDeleteWizardSelectionFromDom?.();
      const sel=w.selectedKeys instanceof Set?w.selectedKeys:new Set(w.selectedKeys||[]);
      const picked=(w.rows||[]).filter(r=>sel.has(String(r.key))&&r.videoId);
      if(!picked.length){this.toast('请至少勾选一条可删除视频',true);return}
      const missingTitle=picked.filter(r=>!String(r.publishTitle||r.description||r.materialName||'').trim());
      if(missingTitle.length){
        this.toast(`有 ${missingTitle.length} 条缺少发布标题，无法在 Studio 搜索。请先同步视频或确认素材有分享标题/名称。`,true);
        return;
      }
      if(!(await this.ask(`确认将 ${picked.length} 条视频加入删除任务？将打开比特环境在 TikTok 上删除。`)))return;
      if(!(await this.ensureBitOnline('删除视频')))return;
      const byAcc=new Map();
      picked.forEach(r=>{
        if(!byAcc.has(r.accountId))byAcc.set(r.accountId,[]);
        byAcc.get(r.accountId).push(r);
      });
      let ok=0,fail=0;
      for(const [accountId,list] of byAcc.entries()){
        try{
          await this.api('/account-work-batches/enqueue',{method:'POST',body:JSON.stringify({
            accountId:Number(accountId),
            taskType:'delete_video',
            payload:{
              source:'delete_wizard',
              accountId:Number(accountId),
              videoIds:list.map(x=>x.videoId),
              items:list.map(x=>({
                videoId:x.videoId,
                videoUrl:x.videoUrl||'',
                materialId:x.materialId||0,
                materialName:x.materialName||'',
                shareTitle:x.publishTitle||'',
                publishTitle:x.publishTitle||x.materialName||'',
                description:x.description||'',
                // 搜索只用发布标题/素材名，绝不把同步描述（可能是 videoplayback）塞进来
                searchTitle:x.publishTitle||x.materialName||'',
              })),
            },
          })});
          ok+=1;
        }catch(e){fail+=1;this.toast(`账号 #${accountId} 入队失败：${e.message}`,true)}
      }
      if(ok)this.toast(`已为 ${ok} 个账号创建删除分任务${fail?`，失败 ${fail}`:''}`);
      this.deleteWizardOpen=false;this.deleteWizard=null;
      this.navigate('accountWork','list');
    },

    openCommentReplyWizard(opts={}){
      if(!this.canPermission('publish.tasks')){this.toast('当前角色无权创建回复评论任务',true);return}
      this.wizardOpen=false;this.massWizardOpen=false;this.deleteWizardOpen=false;
      this.commentReplyWizard={
        step:1,
        accountIds:[],
        replyMode:'fixed',
        replyTemplateIds:[],
        replyAiTemplateId:0,
        replyTexts:[],
        replyAiPrompt:'',
        maxReplies:10,
        templates:[],
      };
      this.commentReplyWizardOpen=true;
      this.matrixTab='tasks';
      if(!opts.skipRefresh)this.refresh();
    },
    closeCommentReplyWizard(){this.commentReplyWizardOpen=false;this.commentReplyWizard=null;this.refresh()},
    commentReplyWizardPanel(){
      const w=this.commentReplyWizard||{step:1};
      const step=Number(w.step||1);
      const labels=['选择账号','回复模板','确认入队'];
      return `<div class="wizard">
        <div class="toolbar" style="margin:0 0 12px"><div><b>回复评论向导</b><span class="muted" style="margin-left:8px">选择账号与固定/AI 回复模板，为每个账号挂入回复评论子任务</span></div></div>
        <div class="wizard-steps">${labels.map((n,i)=>`<span class="${i+1===step?'on':''}">${i+1} ${n}</span>`).join('')}</div>
        <div class="shell-note" style="margin:0 0 12px">执行时进入 <b>TikTok Studio → Comments</b>，筛选「未回复 / Not replied」，用固定文案或 AI 提示词模板生成后逐条回复。模板请先在「消息模板 · 回复评论」中维护。</div>
        <div id="comment-reply-wizard-body">${this.commentReplyWizardBody(step,w)}</div>
        <div class="toolbar" style="margin-top:16px">
          <button class="ghost" type="button" onclick="app.closeCommentReplyWizard()">取消</button>
          <div>
            ${step>1?`<button class="ghost" type="button" onclick="app.commentReplyWizardPrev()">上一步</button> `:''}
            ${step<3?`<button class="primary" type="button" onclick="app.commentReplyWizardNext()">下一步</button>`:`<button class="primary" type="button" onclick="app.commentReplyWizardSubmit()">创建回复任务</button>`}
          </div>
        </div>
      </div>`;
    },
    commentReplyWizardBody(step,w){
      if(step===1){
        return `<div class="form-grid"><div class="field full"><label>选择账号</label>
          ${this.accountPickToolbarHtml('comment-reply-wizard-accounts',{batchHtml:`<button type="button" class="tiny" onclick="app.setAccountPickAll('comment-reply-wizard-accounts',true)">全选</button><button type="button" class="tiny" onclick="app.setAccountPickAll('comment-reply-wizard-accounts',false)">清空</button><button type="button" class="tiny" onclick="app.invertAccountPick('comment-reply-wizard-accounts')">反选</button>`})}
          <div id="comment-reply-wizard-accounts" class="account-pick-grid"></div>
        </div></div>`;
      }
      if(step===2){
        const mode=String(w.replyMode||'fixed')==='ai'?'ai':'fixed';
        const tpls=Array.isArray(w.templates)?w.templates:[];
        const fixedTpls=tpls.filter(t=>(t.contentMode||'fixed')==='fixed');
        const aiTpls=tpls.filter(t=>t.contentMode==='ai');
        const fixedIds=new Set((w.replyTemplateIds||[]).map(Number));
        const aiId=Number(w.replyAiTemplateId||0);
        const maxReplies=Math.max(1,Math.min(50,Number(w.maxReplies||10)));
        return `<div class="form-grid">
          <div class="field full">
            <label>回复类型</label>
            <div class="tk-data-view-switch cr-reply-tabs" role="tablist" aria-label="回复类型">
              <button type="button" class="${mode==='fixed'?'is-active':''}" data-cr-tab="fixed" onclick="app.setCommentReplyMode('fixed')">固定回复</button>
              <button type="button" class="${mode==='ai'?'is-active':''}" data-cr-tab="ai" onclick="app.setCommentReplyMode('ai')">AI 回复</button>
            </div>
          </div>
          <div class="field full" id="cr-fixed-box" data-cr-pane="fixed" ${mode==='fixed'?'':'hidden'} style="${mode==='fixed'?'':'display:none'}">
            <label>固定文案模板（可多选）</label>
            <div class="muted" style="margin-bottom:8px">发回复时从勾选模板中随机取一条；切换 Tab 后勾选会保留</div>
            <div class="warm-comment-tpl-list" id="cr-fixed-list">${this.renderCommentReplyTplOptions(fixedTpls,'fixed',fixedIds)}</div>
          </div>
          <div class="field full" id="cr-ai-box" data-cr-pane="ai" ${mode==='ai'?'':'hidden'} style="${mode==='ai'?'':'display:none'}">
            <label>AI 提示词模板（单选）</label>
            <div class="muted" style="margin-bottom:8px">按原评论与视频描述生成回复；切换 Tab 后选择会保留</div>
            <div class="warm-comment-tpl-list" id="cr-ai-list">${this.renderCommentReplyTplOptions(aiTpls,'ai',aiId?[aiId]:[])}</div>
          </div>
          <div class="field"><label>每账号最多回复条数</label>
            <input class="input" type="number" min="1" max="50" id="cr-max-replies" value="${maxReplies}" onchange="app.syncCommentReplyMaxReplies()">
          </div>
        </div>`;
      }
      const mode=String(w.replyMode||'fixed')==='ai'?'ai':'fixed';
      const accN=(w.accountIds||[]).length;
      const tplLabel=mode==='ai'
        ?(w.replyAiTemplateId?`AI 模板 #${w.replyAiTemplateId}`:'AI（默认提示词）')
        :`固定模板 ${(w.replyTemplateIds||[]).length} 条`;
      return `<div class="data-meta">将为 <b>${accN}</b> 个账号各创建 1 条「回复评论」子任务。<br>
        回复类型：${mode==='ai'?'AI 生成':'固定文案'} · ${this.esc(tplLabel)}<br>
        每账号上限：${Number(w.maxReplies||10)} 条<br><br>
        执行时进入 TikTok Studio → Comments，筛选未回复后逐条发送文案。</div>`;
    },
    renderCommentReplyTplOptions(items, mode, selectedIds){
      const list=Array.isArray(items)?items:[];
      const selected=new Set([...(selectedIds||[])].map(Number).filter(Boolean));
      if(!list.length){
        const tip=mode==='ai'
          ?'暂无 AI 回复模板，请先在「消息模板 · 回复评论」新建内容类型为「AI 提示词」的模板'
          :'暂无固定回复模板，请先在「消息模板 · 回复评论」新建内容类型为「固定文案」的模板';
        return `<div class="warm-comment-empty">${tip}</div>`;
      }
      const contentOf=(t)=>{
        const c=String(t?.content||'').trim();
        if(c)return c;
        if(mode==='ai')return String(t?.aiPrompt||t?.ai_prompt||'').trim();
        return String(t?.fixedText||t?.fixed_text||'').trim();
      };
      if(mode==='ai'){
        return list.map(t=>{
          const id=Number(t.id);
          const prompt=contentOf(t);
          const preview=prompt.length>120?prompt.slice(0,120)+'…':prompt;
          return `<label class="warm-comment-tpl ${selected.has(id)?'is-on':''}">
            <input type="radio" name="crAiTemplateId" value="${id}" ${selected.has(id)?'checked':''} onchange="app.markCommentReplyTpl(this)">
            <span class="warm-comment-tpl-body"><b>${this.esc(t.name||('模板 #'+id))}</b><small>${this.esc(preview||'（无内容）')}</small></span>
          </label>`;
        }).join('');
      }
      return list.map(t=>{
        const id=Number(t.id);
        const text=contentOf(t);
        const preview=text.length>80?text.slice(0,80)+'…':text;
        return `<label class="warm-comment-tpl ${selected.has(id)?'is-on':''}">
          <input type="checkbox" name="crTemplateIds" value="${id}" ${selected.has(id)?'checked':''} onchange="app.markCommentReplyTpl(this)">
          <span class="warm-comment-tpl-body"><b>${this.esc(t.name||('模板 #'+id))}</b><small>${this.esc(preview||'（无内容）')}</small></span>
        </label>`;
      }).join('');
    },
    /** 把两个 Tab 的勾选同步进 wizard 状态（切换/下一步都会用） */
    syncCommentReplyTabSelections(){
      const w=this.commentReplyWizard;if(!w)return;
      const tpls=w.templates||[];
      const byId=Object.fromEntries(tpls.map(t=>[Number(t.id),t]));
      const contentOf=(t,prefer)=>{
        if(!t)return '';
        const c=String(t.content||'').trim();
        if(c)return c;
        if(prefer==='ai')return String(t.aiPrompt||t.ai_prompt||'').trim();
        return String(t.fixedText||t.fixed_text||'').trim();
      };
      const fixedBox=document.querySelector('#cr-fixed-box');
      const aiBox=document.querySelector('#cr-ai-box');
      if(fixedBox){
        const ids=[...fixedBox.querySelectorAll('input[name=crTemplateIds]:checked')]
          .map(el=>Number(el.value)).filter(Boolean);
        w.replyTemplateIds=ids;
        w.replyTexts=ids.map(id=>contentOf(byId[id],'fixed')).filter(Boolean);
      }
      if(aiBox){
        const aiId=Number(aiBox.querySelector('input[name=crAiTemplateId]:checked')?.value||0)||0;
        w.replyAiTemplateId=aiId;
        w.replyAiPrompt=contentOf(byId[aiId],'ai');
      }
      this.syncCommentReplyMaxReplies();
    },
    setCommentReplyMode(mode){
      const w=this.commentReplyWizard;if(!w)return;
      // 切换前先落盘当前两个面板的勾选，避免丢数据
      this.syncCommentReplyTabSelections();
      w.replyMode=mode==='ai'?'ai':'fixed';
      const fixedBox=document.querySelector('#cr-fixed-box');
      const aiBox=document.querySelector('#cr-ai-box');
      if(fixedBox){
        fixedBox.hidden=w.replyMode!=='fixed';
        fixedBox.style.display=w.replyMode==='fixed'?'':'none';
      }
      if(aiBox){
        aiBox.hidden=w.replyMode!=='ai';
        aiBox.style.display=w.replyMode==='ai'?'':'none';
      }
      document.querySelectorAll('.cr-reply-tabs [data-cr-tab]').forEach(btn=>{
        btn.classList.toggle('is-active',btn.getAttribute('data-cr-tab')===w.replyMode);
      });
    },
    markCommentReplyTpl(el){
      if(!el)return;
      const label=el.closest('.warm-comment-tpl');
      if(!label)return;
      if(el.type==='radio'){
        document.querySelectorAll('input[name=crAiTemplateId]').forEach(n=>{
          const lb=n.closest('.warm-comment-tpl');
          if(lb)lb.classList.toggle('is-on',n===el&&n.checked);
        });
      }else{
        label.classList.toggle('is-on',!!el.checked);
      }
      // 即时写入 wizard，保证切 Tab / 下一步都读到最新勾选
      this.syncCommentReplyTabSelections();
    },
    syncCommentReplyMaxReplies(){
      const w=this.commentReplyWizard;if(!w)return;
      const el=document.querySelector('#cr-max-replies');
      w.maxReplies=Math.max(1,Math.min(50,Number(el?.value||10)));
    },
    collectCommentReplyTemplatePayload(){
      const w=this.commentReplyWizard;if(!w)return null;
      this.syncCommentReplyTabSelections();
      const mode=String(w.replyMode||'fixed')==='ai'?'ai':'fixed';
      w.replyMode=mode;
      if(mode==='ai'){
        return {ok:!!(w.replyAiTemplateId||w.replyAiPrompt),mode:'ai'};
      }
      return {ok:(w.replyTemplateIds||[]).length>0,mode:'fixed'};
    },
    async fillCommentReplyWizardAccounts(){
      const box=document.querySelector('#comment-reply-wizard-accounts');
      if(!box)return;
      const accounts=(await this.api('/accounts?pageSize=200')).items||[];
      this._commentReplyWizardAccountsCache=accounts;
      const selected=new Set((this.commentReplyWizard?.accountIds||[]).map(Number));
      box.innerHTML=accounts.length?accounts.map(a=>this.accountPickTagHtml(a,selected)).join(''):'<div class="muted account-pick-empty" style="padding:12px;grid-column:1/-1">暂无账号</div>';
      this.filterAccountPick('comment-reply-wizard-accounts');
    },
    async fillCommentReplyWizardTemplates(){
      const w=this.commentReplyWizard;if(!w)return;
      try{
        const pack=await this.api('/interaction-templates?type=comment_reply');
        w.templates=(pack.items||[]).filter(t=>t.enabled!==0&&t.enabled!==false);
      }catch(_){w.templates=[]}
      const body=document.querySelector('#comment-reply-wizard-body');
      if(body)body.innerHTML=this.commentReplyWizardBody(2,w);
    },
    async commentReplyWizardNext(){
      const w=this.commentReplyWizard;if(!w)return;
      if(w.step===1){
        w.accountIds=this.selectedAccountPickIds('comment-reply-wizard-accounts');
        if(!w.accountIds.length){this.toast('请至少选择一个账号',true);return}
        w.step=2;
        document.querySelector('#content').innerHTML=this.matrixTabs('tasks')+this.commentReplyWizardPanel();
        await this.fillCommentReplyWizardTemplates();
        return;
      }
      if(w.step===2){
        const picked=this.collectCommentReplyTemplatePayload();
        if(!picked?.ok){
          this.toast(picked?.mode==='ai'?'请选择一条 AI 回复模板':'请至少勾选一条固定回复模板',true);
          return;
        }
        w.step=3;
        document.querySelector('#content').innerHTML=this.matrixTabs('tasks')+this.commentReplyWizardPanel();
      }
    },
    async commentReplyWizardPrev(){
      const w=this.commentReplyWizard;if(!w)return;
      if(w.step===2){
        this.collectCommentReplyTemplatePayload();
        const picked=this.selectedAccountPickIds('comment-reply-wizard-accounts');
        if(picked.length)w.accountIds=picked;
      }
      w.step=Math.max(1,w.step-1);
      document.querySelector('#content').innerHTML=this.matrixTabs('tasks')+this.commentReplyWizardPanel();
      if(w.step===1)await this.fillCommentReplyWizardAccounts();
      else if(w.step===2)await this.fillCommentReplyWizardTemplates();
    },
    async commentReplyWizardSubmit(){
      const w=this.commentReplyWizard;if(!w)return;
      const accountIds=(w.accountIds||[]).map(Number).filter(Boolean);
      if(!accountIds.length){this.toast('请先选择账号',true);return}
      if(w.replyMode==='fixed'&&!(w.replyTemplateIds||[]).length){this.toast('请至少勾选一条固定回复模板',true);return}
      if(w.replyMode==='ai'&&!w.replyAiTemplateId&&!w.replyAiPrompt){this.toast('请选择一条 AI 回复模板',true);return}
      if(!(await this.ask(`确认为 ${accountIds.length} 个账号创建回复评论任务？`)))return;
      if(!(await this.ensureBitOnline('回复评论')))return;
      let ok=0,fail=0;
      for(const accountId of accountIds){
        try{
          await this.api('/account-work-batches/enqueue',{method:'POST',body:JSON.stringify({
            accountId:Number(accountId),
            taskType:'comment_reply',
            payload:{
              source:'comment_reply_wizard',
              accountId:Number(accountId),
              replyMode:w.replyMode||'fixed',
              replyTemplateIds:w.replyMode==='fixed'?(w.replyTemplateIds||[]):[],
              replyAiTemplateId:w.replyMode==='ai'?Number(w.replyAiTemplateId||0):0,
              replyTexts:w.replyMode==='fixed'?(w.replyTexts||[]):[],
              replyAiPrompt:w.replyMode==='ai'?(w.replyAiPrompt||''):'',
              maxReplies:Math.max(1,Math.min(50,Number(w.maxReplies||10))),
            },
          })});
          ok+=1;
        }catch(e){fail+=1;this.toast(`账号 #${accountId} 入队失败：${e.message}`,true)}
      }
      if(ok)this.toast(`已为 ${ok} 个账号创建回复评论任务${fail?`，失败 ${fail}`:''}`);
      this.commentReplyWizardOpen=false;this.commentReplyWizard=null;
      this.navigate('accountWork','list');
    },
  };
  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages["publish"] = true;
})();
