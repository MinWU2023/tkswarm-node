(function () {
  if (!window.app) throw new Error('app-core must load before pages/proxies.js');
  const __methods = {
    toggleProxyBatchMenu(e){
      e?.stopPropagation?.();
      this.toggleToolbarDropdown('#proxy-batch-menu', e);
    },
    async renderProxies(opts={}){
      const still=typeof opts.still==='function'?opts.still:()=>this.view==='proxies';
      document.querySelector('#content')?.classList.remove('chat-mode');
      if(this.proxyPane==='io'){await this.renderProxyIo(opts);return}
      // 只拉分组，避免 loadRefs 顺带打 materials/templates 拖死首屏
      await this.ensureGroups();
      if(!still())return;
      const gs=this.groups.filter(g=>g.type==='proxy');
      const kw=encodeURIComponent(this.proxyKeyword||'');
      const st=encodeURIComponent(this.proxyStatus||'');
      const d=await this.api(`/proxies?page=${this.proxyPage||1}&pageSize=20&keyword=${kw}&status=${st}${this.proxyGroupId?`&groupId=${encodeURIComponent(this.proxyGroupId)}`:''}`);
      if(!still())return;
      this.proxies=d.items;
      document.querySelector('#content').innerHTML=`<div class="workspace proxy-workspace">
        <aside class="side-groups account-sidebar">
          <div class="sidebar-header"><h3>代理分组 <span class="count-pill">${gs.length}</span></h3>${this.canPermission('group.manage')?`<button class="primary tiny" onclick="app.groupModal('proxy')">添加</button>`:''}</div>
          <div class="group-list">
            <button type="button" class="group-item-modern ${this.proxyGroupId?'':'active'}" onclick="app.filterProxyGroup('')"><div class="row"><b>全部代理</b><span class="pool">IP池</span></div><div class="row meta"><span>全部</span><span>${d.total||d.items.length}</span></div></button>
            ${gs.map(g=>`<button type="button" class="group-item-modern ${String(this.proxyGroupId)===String(g.id)?'active':''}" onclick="app.filterProxyGroup(${g.id})"><div class="row"><b>${this.esc(g.name)}</b><span class="group-side-acts"><span class="pool">IP池</span>${this.canPermission('group.manage')?`<span class="group-act" title="编辑分组" onclick="event.stopPropagation();app.editGroup(${g.id})">改</span>`:''}${this.canPermission('group.manage')?`<span class="group-act danger" title="删除分组" onclick="event.stopPropagation();app.remove('/groups/${g.id}','代理分组')">删</span>`:''}</span></div><div class="row meta"><span>${this.esc((g.created_at||'').slice(0,10)||'')}</span><span>${g.member_count||0}</span></div></button>`).join('')}
          </div>
        </aside>
        <div class="proxy-main-wrapper account-main-panel">
          <div id="proxy-batch-panel" class="batch-panel hidden">
            <div class="batch-info">已选择 <strong id="proxy-selected-count">0</strong> 个代理</div>
            <div class="action-buttons">
              <div class="dropdown">
                <button class="ghost" type="button" onclick="app.toggleProxyBatchMenu(event)">批量操作 <span class="btn-arrow-down">▾</span></button>
                <div id="proxy-batch-menu" class="dropdown-menu align-left hidden">
                  <button type="button" onclick="app.copySelectedProxies()">复制代理</button>
                  ${this.canPermission('proxy.test')?`<button type="button" onclick="app.batchTestProxies()">批量检测</button>`:''}
                  ${this.canPermission('proxy.test')||this.canPermission('proxy.create')?`<button type="button" onclick="app.batchDetectProxyCountry()">批量检测国家</button>`:''}
                  ${this.canPermission('proxy.create')?`<button type="button" onclick="app.batchMoveProxies()">批量转移分组</button>`:''}
                  ${this.canAssignProxies()?`<button type="button" onclick="app.batchAssignProxies()">批量分配</button>`:''}
                  ${this.canPermission('proxy.create')?`<button type="button" class="is-danger" onclick="app.batchDeleteProxies()">批量删除</button>`:''}
                </div>
              </div>
            </div>
          </div>
          <div class="account-toolbar">
            <div class="action-buttons">
              ${this.canPermission('proxy.create')?`<button class="primary" onclick="app.proxyModal()">添加IP</button><button class="ghost" onclick="app.openProxyIo()">导入导出</button><button class="ghost" onclick="app.fetchProxyModal()">获取云代理</button>`:''}
              <button class="ghost" onclick="app.refresh()">刷新代理</button>
              ${this.canPermission('proxy.create')?`<button class="ghost" onclick="app.advancedDeleteProxies()">高级删除</button>`:''}
            </div>
            <div class="search-bar">
              <input id="proxy-search" class="input" placeholder="搜索名称或地址" value="${this.esc(this.proxyKeyword||'')}" onkeydown="if(event.key==='Enter')app.searchProxies()">
              <select id="proxy-status"><option value="">全部状态</option><option value="available" ${this.proxyStatus==='available'?'selected':''}>可用</option><option value="unavailable" ${this.proxyStatus==='unavailable'?'selected':''}>不可用</option><option value="unchecked" ${this.proxyStatus==='unchecked'?'selected':''}>未检测</option></select>
              <button class="primary" onclick="app.searchProxies()">查询</button>
              <button class="ghost" type="button" onclick="app.resetProxyFilters()">重置</button>
            </div>
          </div>
          <div class="table-container" id="proxy-table-host">${this.proxyTable(d.items)}</div>
          <div id="proxy-pager-host">${UI.pager(d,'proxyPage')}</div>
        </div>
      </div>`;
      this.bindProxyChecks();
    },
    resetProxyFilters(){this.proxyPage=1;this.proxyGroupId='';this.proxyKeyword='';this.proxyStatus='';this.refresh()},
    bindProxyChecks(){
      const update=()=>{
        const n=document.querySelectorAll('.proxy-check:checked').length;
        document.querySelector('#proxy-selected-count')&&(document.querySelector('#proxy-selected-count').textContent=String(n));
        document.querySelector('#proxy-batch-panel')?.classList.toggle('hidden',n===0);
      };
      document.querySelectorAll('.proxy-check').forEach(el=>el.addEventListener('change',update));
      update();
    },
    async copySelectedProxies(){
      const ids=[...document.querySelectorAll('.proxy-check:checked')].map(x=>Number(x.value));
      if(!ids.length){this.toast('请先勾选要复制的代理（不会默认导出全部）',true);return}
      try{
        const r=await this.api('/proxies/export-strings',{method:'POST',body:JSON.stringify({proxyIds:ids})});
        if(!r.count){this.toast('没有可复制的代理',true);return}
        try{await navigator.clipboard.writeText(r.text);this.toast(`已复制 ${r.count} 条（host:port[:user:pass]）`)}
        catch{this.toast(r.text)}
      }catch(e){this.toast(e.message,true)}
    },
    filterProxyGroup(id){this.proxyGroupId=id?String(id):'';this.proxyPage=1;this.refresh()},
    proxyTable(rows){
      if(!rows.length)return '<div class="empty">还没有符合条件的代理</div>';
      const canWrite=this.canPermission('proxy.create');
      const canTest=this.canPermission('proxy.test');
      return `<table><thead><tr><th><input type="checkbox" onchange="app.toggleAllProxies(this.checked)" title="全选"></th><th>名称</th><th>地址</th><th>协议</th><th>国家</th><th>分组</th><th>状态</th><th>延迟</th><th>使用次数</th><th>出口IP</th><th>创建时间</th><th>操作</th></tr></thead><tbody>${rows.map(x=>{
        const more=[];
        more.push(`<button type="button" onclick="app.copyProxy(${x.id})">复制</button>`);
        if(canTest)more.push(`<button type="button" onclick="app.testProxy(${x.id})">检测</button>`);
        if(canTest||canWrite)more.push(`<button type="button" onclick="app.detectProxyCountry(${x.id})">检测国家</button>`);
        if(this.canAssignProxies())more.push(`<button type="button" onclick="app.assignProxyOwner(${x.id})">分配</button>`);
        const editBtn=`<button class="tiny" type="button" title="编辑" onclick='app.editProxyModal(${JSON.stringify(x)})' ${canWrite?'':'disabled'}>编辑</button>`;
        const delBtn=`<button class="tiny danger" type="button" title="删除" onclick="app.remove('/proxies/${x.id}','代理')" ${canWrite?'':'disabled title="无代理维护权限"'}>删除</button>`;
        const moreBtn=`<div class="ops-dropdown proxy-ops-dropdown"><button class="tiny" type="button" title="更多" onclick="app.toggleProxyOps(${x.id},event)">…</button><div id="proxy-ops-${x.id}" class="dropdown-menu ops-menu hidden">${more.join('')}</div></div>`;
        return `<tr><td><input class="proxy-check" type="checkbox" value="${x.id}"></td><td><b>${this.esc(x.name)}</b></td><td title="点击修改 IP" style="cursor:pointer;color:#409eff" onclick="event.stopPropagation();app.editProxyAddress(${x.id})">${this.esc(x.host)}:${x.port}</td><td>${x.protocol}</td><td title="点击编辑国家" style="cursor:pointer;color:#409eff" onclick="event.stopPropagation();app.editProxyCountry(${x.id},${JSON.stringify(x.country||'')})">${this.esc(x.country||'-')}</td><td>${this.esc(x.group_name||'未分组')}</td><td>${this.badge(x.status)}</td><td>${x.latency_ms?x.latency_ms+' ms':'-'}</td><td>${x.use_count||0}</td><td>${this.esc(x.egress_ip||'-')}</td><td>${this.esc((x.created_at||'').slice(0,19)||'-')}</td><td><div class="task-ops-cell proxy-ops-cell">${editBtn}${delBtn}${moreBtn}</div></td></tr>`;
      }).join('')}</tbody></table>`;
    },
    toggleProxyOps(id,e){
      e?.stopPropagation?.();
      const target=document.querySelector('#proxy-ops-'+id);
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
    selectedProxyIds(){return [...document.querySelectorAll('.proxy-check:checked')].map(x=>Number(x.value))},
    async searchProxies(){this.proxyKeyword=document.querySelector('#proxy-search')?.value||'';this.proxyStatus=document.querySelector('#proxy-status')?.value||'';this.proxyPage=1;this.refresh()},
    batchMoveProxies(){const ids=this.selectedProxyIds();if(!ids.length){this.toast('请先选择要转移的代理',true);return}const gs=this.groups.filter(g=>g.type==='proxy');this.modal('批量转移代理分组',`<div class="form-grid">${this.select('groupId','目标代理分组',gs)}<div class="field full"><div class="muted">已选择 ${ids.length} 个代理。目标分组留空表示移出分组。</div></div></div>`,async d=>{await this.api('/proxies/batch-move',{method:'POST',body:JSON.stringify({proxyIds:ids,groupId:d.groupId?Number(d.groupId):null})});this.toast(`已转移 ${ids.length} 个代理`);this.closeModal();this.invalidateProxyCatalog();await this.loadRefs({force:true});this.refresh()})},
    async batchDeleteProxies(){const ids=this.selectedProxyIds();if(!ids.length){this.toast('请先选择要删除的代理',true);return}if(!(await this.ask(`确定删除选中的 ${ids.length} 个代理吗？绑定这些代理的账号将自动变为未绑定代理。`)))return;try{const r=await this.api('/proxies/batch-delete',{method:'POST',body:JSON.stringify({proxyIds:ids})});this.toast(`已删除 ${r.deleted} 个代理，解除 ${r.unboundAccounts} 个账号的代理绑定`);this.invalidateProxyCatalog();await this.loadRefs({force:true});this.refresh()}catch(e){this.toast(e.message,true)}},
    canAssignProxies(){return !!(this.authIsSuper||(this.authChildren&&this.authChildren.length))},
    async assignProxyOwner(id){return this.batchAssignProxies([Number(id)])},
    async batchAssignProxies(presetIds){
      if(!this.canAssignProxies()){this.toast('当前账号无权分配（需为超管或已配置下级用户）',true);return}
      const ids=Array.isArray(presetIds)&&presetIds.length?presetIds.map(Number):this.selectedProxyIds();
      if(!ids.length){this.toast('请先勾选要分配的代理',true);return}
      const targets=await this.loadProxyAssignTargets();
      // 分配给下级：默认排除「本人」，仅保留下级/其他管理员；若只有本人则仍可选
      let opts=targets.filter(t=>!(String(t.label||'').includes('（本人）')));
      if(!opts.length)opts=targets;
      if(!opts.length){this.toast('没有可分配的目标用户，请先在权限管理里配置下级',true);return}
      const pairs=opts.map(t=>[String(t.id),t.label]);
      this.modal('分配代理给管理用户',`<div class="form-grid"><div class="field full"><div class="muted">已选 ${ids.length} 个代理。分配后这些代理将归属于目标用户，你在本人视图下将不再看到它们（超管全量视图除外）。账号上的代理绑定不会自动解除。</div></div>${this.selectRaw('ownerId','目标管理用户',pairs,pairs[0]?.[0])}</div>`,async d=>{
        const ownerId=Number(d.ownerId||0);
        if(!ownerId)throw new Error('请选择目标用户');
        const r=await this.api('/proxies/batch-assign-owner',{method:'POST',body:JSON.stringify({proxyIds:ids,ownerId})});
        this.toast(r?.ownerName?`已分配 ${r.updated} 个代理给 ${r.ownerName}`:`已分配 ${r.updated||ids.length} 个代理`);
        this.closeModal();
        this.invalidateProxyCatalog();
        await this.loadRefs({force:true});
        this.refresh();
      });
    },
    openProxyIo(tab){
      if(!this.canPermission('proxy.create')&&tab==='import'){this.toast('当前角色无权导入代理',true);return}
      this.proxyPane='io';
      this.proxyIoTab=tab==='import'?'import':'export';
      if(!Array.isArray(this.proxyIoFields)||!this.proxyIoFields.length)this.proxyIoFields=this.defaultProxyIoFields();
      this.refresh();
    },
    closeProxyIo(){this.proxyPane='list';this.refresh()},
    switchProxyIoTab(tab){this.proxyIoTab=tab==='import'?'import':'export';this.refresh()},
    defaultProxyIoFields(){
      return [
        {key:'id',label:'ID',on:true},
        {key:'name',label:'名称',on:true},
        {key:'protocol',label:'协议',on:true},
        {key:'host',label:'主机',on:true},
        {key:'port',label:'端口',on:true},
        {key:'username',label:'用户名',on:true},
        {key:'password',label:'密码',on:false},
        {key:'proxy_string',label:'代理文本',on:true},
        {key:'country',label:'国家',on:true},
        {key:'group_name',label:'分组',on:true},
        {key:'status',label:'状态',on:true},
        {key:'latency_ms',label:'延迟ms',on:false},
        {key:'use_count',label:'使用次数',on:false},
        {key:'egress_ip',label:'出口IP',on:false},
        {key:'created_at',label:'创建时间',on:true},
        {key:'last_checked_at',label:'检测时间',on:false},
      ];
    },
    async renderProxyIo(opts={}){
      const still=typeof opts.still==='function'?opts.still:()=>this.view==='proxies';
      const tab=this.proxyIoTab||'export';
      if(!Array.isArray(this.proxyIoFields)||!this.proxyIoFields.length)this.proxyIoFields=this.defaultProxyIoFields();
      const f=this.proxyIoFilter||{};
      await this.ensureGroups();
      if(!still())return;
      const gs=this.groups.filter(g=>g.type==='proxy');
      document.querySelector('#content').innerHTML=`<div class="panel task-io-panel proxy-io-panel">
        <div class="task-io-head">
          <button class="ghost" type="button" onclick="app.closeProxyIo()">← 返回代理列表</button>
          <div class="task-io-title-row">
            <b class="task-io-title">导入导出</b>
            <span class="muted">导出可自定义字段；导入支持 CSV 模板或逐行文本</span>
          </div>
        </div>
        <div class="subtabs" style="margin-bottom:14px">
          <button type="button" class="${tab==='export'?'active':''}" onclick="app.switchProxyIoTab('export')">导出数据</button>
          <button type="button" class="${tab==='import'?'active':''}" onclick="app.switchProxyIoTab('import')">导入数据</button>
        </div>
        ${tab==='import'?this.proxyIoImportBody(gs):this.proxyIoExportBody(f,gs)}
      </div>`;
    },
    proxyIoExportBody(f,gs){
      f=f||{};gs=gs||[];
      const statusOpts=[['','全部状态'],['available','可用'],['unavailable','不可用'],['unchecked','未检测']];
      const protoOpts=[['','全部协议'],['http','HTTP'],['https','HTTPS'],['socks5','SOCKS5']];
      const fields=this.proxyIoFields||[];
      return `<div class="task-io-export">
        <div class="form-grid task-io-filters">
          <div class="field"><label>关键词</label><input id="pio-keyword" class="input" type="search" placeholder="名称 / 主机 / 国家" value="${this.esc(f.keyword||'')}"></div>
          <div class="field"><label>状态</label><select id="pio-status" class="input">${statusOpts.map(([v,n])=>`<option value="${this.esc(v)}" ${String(f.status||'')===v?'selected':''}>${this.esc(n)}</option>`).join('')}</select></div>
          <div class="field"><label>协议</label><select id="pio-protocol" class="input">${protoOpts.map(([v,n])=>`<option value="${this.esc(v)}" ${String(f.protocol||'')===v?'selected':''}>${this.esc(n)}</option>`).join('')}</select></div>
          <div class="field"><label>分组</label><select id="pio-group" class="input"><option value="">全部分组</option><option value="none" ${f.groupId==='none'?'selected':''}>未分组</option>${gs.map(g=>`<option value="${g.id}" ${String(f.groupId||'')===String(g.id)?'selected':''}>${this.esc(g.name)}</option>`).join('')}</select></div>
          <div class="field"><label>国家</label><input id="pio-country" class="input" placeholder="可空" value="${this.esc(f.country||'')}"></div>
          <div class="field"><label>ID 最小</label><input id="pio-id-min" class="input" type="number" min="0" placeholder="可空" value="${this.esc(f.idMin||'')}"></div>
          <div class="field"><label>ID 最大</label><input id="pio-id-max" class="input" type="number" min="0" placeholder="可空" value="${this.esc(f.idMax||'')}"></div>
          <div class="field"><label>仅勾选代理</label><select id="pio-selected-only" class="input"><option value="0">否（按筛选）</option><option value="1" ${f.selectedOnly?'selected':''}>是（列表页勾选）</option></select></div>
        </div>
        <div class="field full" style="margin:12px 0 8px"><label>导出字段与表头（勾选并自定义表头名）</label></div>
        <div class="table-container task-io-fields-table" style="margin-bottom:14px">
          <table><thead><tr><th style="width:56px">导出</th><th>字段</th><th>表头名</th></tr></thead>
          <tbody>${fields.map((x,i)=>`<tr>
            <td><input type="checkbox" class="pio-field-on" data-idx="${i}" ${x.on?'checked':''}></td>
            <td><code>${this.esc(x.key)}</code></td>
            <td><input class="input pio-field-label" data-idx="${i}" value="${this.esc(x.label||'')}" style="width:100%;max-width:280px"></td>
          </tr>`).join('')}</tbody></table>
        </div>
        <div class="action-bar">
          <button class="primary" type="button" onclick="app.submitProxyIoExport()">导出</button>
          <button class="ghost" type="button" onclick="app.resetProxyIoExport()">重置筛选与字段</button>
        </div>
      </div>`;
    },
    proxyIoImportBody(gs){
      gs=gs||[];
      const mode=this.proxyIoImportMode||'csv';
      return `<div class="task-io-import">
        <div class="subtabs" style="margin-bottom:12px">
          <button type="button" class="${mode==='csv'?'primary':'ghost'}" onclick="app.proxyIoImportMode='csv';app.refresh()">CSV 模板</button>
          <button type="button" class="${mode==='lines'?'primary':'ghost'}" onclick="app.proxyIoImportMode='lines';app.refresh()">逐行文本</button>
        </div>
        ${mode==='lines'?this.proxyIoImportLinesBody(gs):this.proxyIoImportCsvBody(gs)}
      </div>`;
    },
    proxyIoImportCsvBody(gs){
      gs=gs||[];
      return `
        <div class="shell-note" style="margin:0 0 14px">
          <b>CSV 模板说明：</b>使用下方模板表头；每行一条代理。<br>
          列：<code>protocol,host,port,username,password,name,country,group_name</code>；也可增加 <code>proxy_string</code> 列。
        </div>
        <div class="action-bar" style="margin-bottom:12px">
          <button class="primary" type="button" onclick="app.downloadProxyImportTemplate()">下载导入模板</button>
          <label class="ghost" style="display:inline-flex;align-items:center;padding:8px 14px;cursor:pointer;border:1px solid #dcdfe6;border-radius:4px">选择文件<input type="file" accept=".txt,.csv,text/plain,text/csv" hidden onchange="app.loadProxyImportFile(this)"></label>
        </div>
        <div class="form-grid">
          <div class="field"><label>默认分组（行未填时）</label><select id="pio-import-group" class="input"><option value="">不指定</option>${gs.map(g=>`<option value="${g.id}">${this.esc(g.name)}</option>`).join('')}</select></div>
          <div class="field full"><label>CSV 内容</label><textarea id="pio-import-content" class="input" rows="12" placeholder="粘贴 CSV 或选择文件"></textarea></div>
        </div>
        <div class="action-bar" style="margin-top:14px">
          <button class="primary" type="button" onclick="app.submitProxyIoImport()">开始导入</button>
        </div>
        <div id="pio-import-result" class="muted" style="margin-top:12px"></div>`;
    },
    proxyIoImportLinesBody(gs){
      gs=gs||[];
      return `
        <div class="shell-note" style="margin:0 0 14px">
          兼容原「批量导入」格式：每行一个代理，支持 host:port、host:port:user:pass、user:pass@host:port、带协议 URL；空行与 # 注释忽略。
        </div>
        <div class="form-grid">
          <div class="field"><label>默认协议</label><select id="pio-lines-protocol" class="input"><option value="http">HTTP</option><option value="https">HTTPS</option><option value="socks5">SOCKS5</option></select></div>
          <div class="field"><label>代理分组</label><select id="pio-lines-group" class="input"><option value="">不指定</option>${gs.map(g=>`<option value="${g.id}">${this.esc(g.name)}</option>`).join('')}</select></div>
          <div class="field"><label>国家/地区（可选）</label><input id="pio-lines-country" class="input" placeholder="可空"></div>
          <div class="field full"><label>代理列表</label><textarea id="pio-lines-content" class="input" rows="12" placeholder="每行一个代理"></textarea></div>
        </div>
        <div class="action-bar" style="margin-top:14px">
          <button class="primary" type="button" onclick="app.submitProxyLinesImport()">开始导入</button>
        </div>
        <div id="pio-lines-result" class="muted" style="margin-top:12px"></div>`;
    },
    collectProxyIoExportForm(){
      const fields=(this.proxyIoFields||[]).map((x,i)=>{
        const on=!!document.querySelector('.pio-field-on[data-idx="'+i+'"]')?.checked;
        const label=document.querySelector('.pio-field-label[data-idx="'+i+'"]')?.value ?? x.label;
        return {...x,on,label:String(label||x.key).trim()||x.key};
      });
      this.proxyIoFields=fields;
      this.proxyIoFilter={
        keyword:document.querySelector('#pio-keyword')?.value||'',
        status:document.querySelector('#pio-status')?.value||'',
        protocol:document.querySelector('#pio-protocol')?.value||'',
        groupId:document.querySelector('#pio-group')?.value||'',
        country:document.querySelector('#pio-country')?.value||'',
        idMin:document.querySelector('#pio-id-min')?.value||'',
        idMax:document.querySelector('#pio-id-max')?.value||'',
        selectedOnly:document.querySelector('#pio-selected-only')?.value==='1',
      };
      return {filter:this.proxyIoFilter,fields};
    },
    resetProxyIoExport(){
      this.proxyIoFilter={};
      this.proxyIoFields=this.defaultProxyIoFields();
      this.refresh();
    },
    async submitProxyIoExport(){
      const {filter,fields}=this.collectProxyIoExportForm();
      const selected=fields.filter(x=>x.on);
      if(!selected.length){this.toast('请至少勾选一个导出字段',true);return}
      const q=new URLSearchParams({fields:selected.map(x=>x.key).join(',')});
      q.set('headers',JSON.stringify(Object.fromEntries(selected.map(x=>[x.key,x.label]))));
      if(filter.selectedOnly){
        const ids=this.selectedProxyIds?.()||[];
        if(!ids.length){this.toast('请先在代理列表勾选要导出的代理',true);return}
        q.set('ids',ids.join(','));
      }else{
        if(filter.keyword)q.set('keyword',filter.keyword);
        if(filter.status)q.set('status',filter.status);
        if(filter.protocol)q.set('protocol',filter.protocol);
        if(filter.groupId)q.set('groupId',filter.groupId);
        if(filter.country)q.set('country',filter.country);
        if(filter.idMin)q.set('idMin',filter.idMin);
        if(filter.idMax)q.set('idMax',filter.idMax);
      }
      try{
        const headers=this.authToken?{Authorization:'Bearer '+this.authToken}:{};
        const acting=this.getActingAsId();if(acting)headers['X-Acting-As']=String(acting);
        const base=window.TKSWARM_API_BASE||window.__TKSWARM_CONFIG__?.defaultApiBase||'';
        const r=await fetch(base+'/api/proxies/export.csv?'+q.toString(),{headers});
        if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.message||'导出失败')}
        const text=await r.text();
        const lines=String(text||'').split(/\r?\n/).filter(x=>String(x).trim());
        if(lines.length<=1){this.toast('没有可导出的代理',true);return}
        const blob=new Blob([text],{type:'text/csv;charset=utf-8'});
        const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;
        a.download='tkswarm-proxies.csv';a.click();URL.revokeObjectURL(url);
        this.toast('代理已导出');
      }catch(e){this.toast(e.message,true)}
    },
    async downloadProxyImportTemplate(){
      try{
        const headers=this.authToken?{Authorization:'Bearer '+this.authToken}:{};
        const acting=this.getActingAsId();if(acting)headers['X-Acting-As']=String(acting);
        const base=window.TKSWARM_API_BASE||window.__TKSWARM_CONFIG__?.defaultApiBase||'';
        const r=await fetch(base+'/api/proxies/import-template.csv',{headers});
        if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.message||'下载失败')}
        const text=await r.text();
        if(!String(text||'').trim()){this.toast('模板为空',true);return}
        const blob=new Blob([text],{type:'text/csv;charset=utf-8'});
        const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;
        a.download='proxy-import-template.csv';a.click();URL.revokeObjectURL(url);
        this.toast('模板已下载');
      }catch(e){this.toast(e.message,true)}
    },
    loadProxyImportFile(input){
      const file=input?.files?.[0];if(input)input.value='';
      if(!file)return;
      const reader=new FileReader();
      reader.onload=()=>{const box=document.querySelector('#pio-import-content');if(box)box.value=String(reader.result||'');this.toast('已读入 '+file.name)};
      reader.onerror=()=>this.toast('读取文件失败',true);
      reader.readAsText(file);
    },
    async submitProxyIoImport(){
      if(!this.canPermission('proxy.create')){this.toast('当前角色无权导入代理',true);return}
      const content=document.querySelector('#pio-import-content')?.value||'';
      if(!String(content).trim()){this.toast('请先粘贴 CSV 或选择文件',true);return}
      if(!(await this.ask('将按 CSV 模板导入代理，是否继续？')))return;
      try{
        const r=await this.api('/proxies/import',{method:'POST',body:JSON.stringify({
          content,
          groupId:document.querySelector('#pio-import-group')?.value?Number(document.querySelector('#pio-import-group').value):null,
        })});
        const box=document.querySelector('#pio-import-result');
        const errHtml=(r.errors||[]).length?'<div style="margin-top:6px">'+(r.errors||[]).slice(0,8).map(e=>this.esc(typeof e==='string'?e:(e.reason||JSON.stringify(e)))).join('<br>')+'</div>':'';
        if(box)box.innerHTML='成功 <b>'+(r.imported||0)+'</b>，重复 <b>'+(r.duplicates||0)+'</b>，错误 <b>'+((r.errors||[]).length)+'</b>'+errHtml;
        this.toast('导入完成');
        this.invalidateProxyCatalog();
      }catch(e){this.toast(e.message,true)}
    },
    async submitProxyLinesImport(){
      if(!this.canPermission('proxy.create')){this.toast('当前角色无权导入代理',true);return}
      const content=document.querySelector('#pio-lines-content')?.value||'';
      if(!String(content).trim()){this.toast('请粘贴代理列表',true);return}
      try{
        const r=await this.api('/proxies/batch-import',{method:'POST',body:JSON.stringify({
          content,
          defaultProtocol:document.querySelector('#pio-lines-protocol')?.value||'http',
          groupId:document.querySelector('#pio-lines-group')?.value?Number(document.querySelector('#pio-lines-group').value):null,
          country:document.querySelector('#pio-lines-country')?.value||'',
        })});
        let message='成功 '+r.imported+'，重复 '+r.duplicates+'，错误 '+r.errors.length;
        if(r.errors?.length)message+='；首个错误在第 '+r.errors[0].line+' 行：'+r.errors[0].reason;
        const box=document.querySelector('#pio-lines-result');
        if(box)box.textContent=message;
        this.toast(message);
        this.invalidateProxyCatalog();
      }catch(e){this.toast(e.message,true)}
    },
    proxyModal(){
      const gs=this.groups.filter(g=>g.type==='proxy');
      this.modal('添加代理',`<div class="form-grid">${this.field('name','名称','新代理','text',true)}${this.selectRaw('protocol','协议',(this.meta?.proxyProtocols||[]).length?(this.meta.proxyProtocols.map(x=>[x.code,x.label])):[['http','HTTP'],['https','HTTPS'],['socks5','SOCKS5']],'http')}${this.field('host','主机','','text',true)}${this.field('port','端口','','number',true)}${this.field('username','用户名')}${this.field('password','密码','','password')}${this.field('country','国家/地区')}${this.select('groupId','代理分组',gs)}</div>`,async d=>{
        d.port=Number(d.port);d.groupId=d.groupId?Number(d.groupId):null;
        await this.api('/proxies',{method:'POST',body:JSON.stringify(d)});
        this.toast('代理已添加');this.closeModal();this.invalidateProxyCatalog();await this.loadRefs({force:true});this.refresh();
      });
    },
    editProxyAddress(id){
      if(!this.canPermission('proxy.create')){this.toast('当前角色无权修改代理',true);return}
      const row=this.proxies.find(p=>Number(p.id)===Number(id));
      if(!row){this.toast('代理不存在，请刷新',true);return}
      const cur=row.host+':'+row.port+(row.username?':'+row.username:'');
      this.modal('修改IP',`<div class="form-grid">${this.field('proxyString','代理地址',cur,'text',true)}<div class="field full"><div class="muted">格式：host:port 或 host:port:user:pass。不填密码则保留原密码。</div></div></div>`,async d=>{
        const raw=String(d.proxyString||'').trim();
        const parts=raw.split(':').map(x=>x.trim());
        if(parts.length<2)throw new Error('格式应为 host:port 或 host:port:user:pass');
        const host=parts[0];const port=Number(parts[1]);
        if(!host||!Number.isInteger(port)||port<1||port>65535)throw new Error('端口无效');
        const body={name:row.name,protocol:row.protocol,host,port,username:parts[2]||row.username||'',country:row.country||'',groupId:row.group_id||null};
        if(parts.length>=4)body.password=parts.slice(3).join(':');
        await this.api('/proxies/'+id,{method:'PUT',body:JSON.stringify(body)});
        this.toast('代理地址已更新');this.closeModal();this.invalidateProxyCatalog();await this.loadRefs({force:true});this.refresh();
      });
    },
    editProxyCountry(id,country=''){
      if(!this.canPermission('proxy.create')){this.toast('当前角色无权修改代理',true);return}
      this.modal('修改代理国家',`<div class="form-grid"><input type="hidden" name="id" value="${id}">${this.field('country','国家/地区',country||'')}<div class="field full"><div class="muted">账号列表的「国家」会关联显示此字段。也可在批量操作里「检测国家」自动写入。留空表示清除。</div></div></div>`,async d=>{
        const row=this.proxies.find(p=>Number(p.id)===Number(id));
        if(!row)throw new Error('代理不存在，请刷新');
        const body={name:row.name,protocol:row.protocol,host:row.host,port:row.port,username:row.username||'',country:d.country||'',groupId:row.group_id||null};
        await this.api('/proxies/'+id,{method:'PUT',body:JSON.stringify(body)});
        this.toast('代理国家已更新');this.closeModal();this.invalidateProxyCatalog();await this.loadRefs({force:true});this.refresh();
      });
    },
    editProxyModal(x={}){
      const gs=this.groups.filter(g=>g.type==='proxy');
      this.modal('编辑代理',`<div class="form-grid"><input type="hidden" name="id" value="${x.id||''}">${this.field('name','名称',x.name||'','text',true)}${this.selectRaw('protocol','协议',(this.meta?.proxyProtocols||[]).length?(this.meta.proxyProtocols.map(x=>[x.code,x.label])):[['http','HTTP'],['https','HTTPS'],['socks5','SOCKS5']],x.protocol||'http')}${this.field('host','主机',x.host||'','text',true)}${this.field('port','端口',x.port||'','number',true)}${this.field('username','用户名',x.username||'')}${this.field('password','密码（留空不改）','','password')}${this.field('country','国家/地区',x.country||'')}${this.select('groupId','代理分组',gs,x.group_id)}</div>`,async d=>{
        const id=d.id;delete d.id;d.port=Number(d.port);d.groupId=d.groupId?Number(d.groupId):null;
        if(!d.password)delete d.password;
        await this.api('/proxies/'+id,{method:'PUT',body:JSON.stringify(d)});
        this.toast('代理已更新');this.closeModal();this.invalidateProxyCatalog();await this.loadRefs({force:true});this.refresh();
      });
    },
    batchImportProxies(){return this.batchProxyModal()},
    batchProxyModal(){
      const gs=this.groups.filter(g=>g.type==='proxy');
      this.modal('批量导入代理',`<div class="form-grid">${this.selectRaw('defaultProtocol','默认协议',(this.meta?.proxyProtocols||[]).length?(this.meta.proxyProtocols.map(x=>[x.code,x.label])):[['http','HTTP'],['https','HTTPS'],['socks5','SOCKS5']],'http')}${this.select('groupId','代理分组',gs)}${this.field('country','国家/地区（可选）')}${this.field('content','代理列表','','textarea',true)}<div class="field full"><div class="muted">每行一个，支持：<br>host:port<br>host:port:username:password<br>username:password@host:port<br>http://username:password@host:port<br>也支持竖线或逗号分隔；空行和 # 开头的注释会忽略。</div></div></div>`,async d=>{
        d.groupId=d.groupId?Number(d.groupId):null;
        const r=await this.api('/proxies/batch-import',{method:'POST',body:JSON.stringify(d)});
        let message=`成功 ${r.imported}，重复 ${r.duplicates}，错误 ${r.errors.length}`;
        if(r.errors.length)message+=`；首个错误在第 ${r.errors[0].line} 行：${r.errors[0].reason}`;
        this.toast(message,!!r.errors.length);this.closeModal();this.invalidateProxyCatalog();await this.loadRefs({force:true});this.refresh();
      });
    },
    async testProxy(id){
      this.toast('正在检测出口 IP...');
      const r=await this.api(`/proxies/${id}/test`,{method:'POST'});
      this.toast(r.available?`${r.detail||'可用'} · ${r.latencyMs||'-'} ms`:(r.detail||'连接失败'),!r.available);
      this.invalidateProxyCatalog();await this.loadRefs({force:true});this.refresh();
    },
    async batchTestProxies(){
      const ids=this.selectedProxyIds();
      this.toast('正在批量真实检测…');
      try{
        const r=await this.api('/proxies/batch-test',{method:'POST',body:JSON.stringify({proxyIds:ids})});
        this.toast(`可用 ${r.available}，不可用 ${r.unavailable}`);
        this.invalidateProxyCatalog();await this.loadRefs({force:true});this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    fetchProxyModal(){
      const gs=this.groups.filter(g=>g.type==='proxy');
      this.modal('获取代理IP',`<div class="form-grid">${this.select('groupId','写入分组',gs)}${this.field('country','国家代码（如 US）')}${this.field('region','州/省（可选）')}${this.field('city','城市（可选）')}${this.field('count','数量',5,'number')}${this.field('rotateMinutes','轮转分钟（0-120）',0,'number')}<div class="field full"><div class="muted">已配置「云代理 API」时从云端拉取；未配置则明确走本地可用池，不会假装成云端成功。</div></div></div>`,async d=>{
        d.groupId=d.groupId?Number(d.groupId):null;d.count=Number(d.count||5);d.rotateMinutes=Number(d.rotateMinutes||0);
        const r=await this.api('/proxies/fetch',{method:'POST',body:JSON.stringify(d)});
        const source=r.source==='cloud'?'云端':(r.source==='local-pool'?'本地代理池':r.source||'未知');
        this.toast(`来源：${source} · 已获取 ${r.count} 个`);
        this.closeModal();this.invalidateProxyCatalog();await this.loadRefs({force:true});this.refresh();
      });
    },
    async detectProxyCountry(id){
      if(!this.canPermission('proxy.test')&&!this.canPermission('proxy.create')){this.toast('当前角色无权检测代理',true);return}
      this.toast('正在检测国家…');
      try{
        const r=await this.api('/browser/proxies/batch-detect-country',{method:'POST',body:JSON.stringify({proxyIds:[Number(id)]})});
        const item=(r.items||[])[0];
        this.toast(item?.country?`已写入国家 ${item.country}`:(item?.detail||'未能识别国家'),!item?.country);
        this.invalidateProxyCatalog();await this.loadRefs({force:true});this.refresh();
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
        this.invalidateProxyCatalog();await this.loadRefs({force:true});this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    advancedDeleteProxies(){
      this.modal('高级删除代理',`<div class="form-grid">${this.selectRaw('status','状态',[['','不限'],['unavailable','不可用'],['unchecked','未检测'],['available','可用']],'')}${this.field('country','国家，精确匹配')}${this.field('minUse','使用次数不少于','','number')}<div class="field full"><div class="muted">至少填一个条件。删除后，账号上的这条代理绑定会被清空。</div></div></div>`,async d=>{
        const body={};if(d.status)body.status=d.status;if(String(d.country||'').trim())body.country=String(d.country).trim();if(d.minUse)body.minUse=Number(d.minUse);
        const r=await this.api('/proxies/advanced-delete',{method:'POST',body:JSON.stringify(body)});
        this.toast(r.deleted?`已删除 ${r.deleted} 条`:`没有符合条件的代理可删`,!r.deleted);
        this.closeModal();this.invalidateProxyCatalog();await this.loadRefs({force:true});this.refresh();
      });
    },
    async copyProxy(id){
      try{
        const r=await this.api('/proxies/export-strings',{method:'POST',body:JSON.stringify({proxyIds:[Number(id)]})});
        if(!r.count){this.toast('没有可复制的代理',true);return}
        try{await navigator.clipboard.writeText(r.text);this.toast('已复制 1 条')}
        catch{this.toast(r.text)}
      }catch(e){this.toast(e.message,true)}
    },
    toggleAllProxies(checked){
      document.querySelectorAll('.proxy-check').forEach((el)=>{el.checked=!!checked});
      this.bindProxyChecks();
    }
  };
  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages["proxies"] = true;
})();
