(function () {
  if (!window.app) throw new Error('app-core must load before pages/warm.js');
  const __methods = {
    canWarmTasks(){return this.canPermission('account.create')||this.canPermission('publish.tasks')},
    async renderWarm(){
      document.querySelector('#content').classList.remove('chat-mode');
      if(this.warmRefreshTimer){clearInterval(this.warmRefreshTimer);this.warmRefreshTimer=null}
      if(this.warmPane==='create')return this.renderWarmCreate();
      return this.renderWarmList();
    },
    openWarmCreate(editTask){
      if(!this.canWarmTasks()){this.toast('当前角色无权管理养号任务',true);return}
      this.warmPane='create';
      this.warmCreateStep=1;
      this.warmEditId=editTask?.id||null;
      this._warmEditSnapshot=editTask||null;
      this._warmCreateDraft=null;
      this.view='warm';
      this.refresh();
    },
    closeWarmCreate(){
      this.warmPane='list';
      this.warmCreateStep=1;
      this.warmEditId=null;
      this._warmEditSnapshot=null;
      this._warmCreateDraft=null;
      this.refresh();
    },
    setWarmCreateStep(step){
      const n=Math.max(1,Math.min(2,Number(step)||1));
      const form=document.querySelector('#warm-create-form');
      if(n===2){
        const ids=this.selectedWarmAccountIds();
        const groupId=String(form?.querySelector('[name=groupId]')?.value||'').trim();
        if(!ids.length&&!groupId){this.toast('请先勾选账号，或选择账号分组',true);return}
      }
      this.warmCreateStep=n;
      if(form&&document.querySelector('.warm-create-panel')){
        this.patchWarmCreateChrome(n);
        return;
      }
      this.refresh();
    },
    selectedWarmAccountIds(){
      return [...document.querySelectorAll('#warm-accounts .account-pick-tag.is-on')]
        .map(el=>Number(el.getAttribute('data-id')))
        .filter(Boolean);
    },
    warmAccountPickTagHtml(a, selected){
      return this.accountPickTagHtml(a, selected, {onclick:'app.toggleWarmAccountPickTag(this)'});
    },
    toggleWarmAccountPickTag(el){
      if(!el)return;
      el.classList.toggle('is-on');
      this.updateWarmAccountCount();
    },
    filterWarmAccountPick(keyword){
      this.filterAccountPick('warm-accounts', keyword);
    },
    setWarmAccountPickAll(all){
      document.querySelectorAll('#warm-accounts .account-pick-tag').forEach(el=>{
        if(el.classList.contains('is-filtered-out'))return;
        el.classList.toggle('is-on',!!all);
      });
      this.updateWarmAccountCount();
    },
    invertWarmAccountPick(){
      document.querySelectorAll('#warm-accounts .account-pick-tag').forEach(el=>{
        if(el.classList.contains('is-filtered-out'))return;
        el.classList.toggle('is-on');
      });
      this.updateWarmAccountCount();
    },
    updateWarmAccountCount(){
      const n=this.selectedWarmAccountIds().length;
      const el=document.querySelector('#warm-acc-count');
      if(el)el.textContent=String(n);
    },
    fillWarmAccounts(accounts, selectedIds){
      const box=document.querySelector('#warm-accounts');
      if(!box)return;
      const selected=new Set((selectedIds||[]).map(Number));
      const list=accounts||[];
      box.innerHTML=list.length
        ?list.map(a=>this.warmAccountPickTagHtml(a,selected)).join('')
        :'<div class="muted account-pick-empty" style="padding:12px;grid-column:1/-1">暂无账号</div>';
      this.filterAccountPick('warm-accounts');
      this.updateWarmAccountCount();
    },
    parseWarmSearchTerms(raw){
      if(Array.isArray(raw))return raw.map(x=>String(x||'').trim()).filter(Boolean);
      return String(raw||'').split(/[\r\n,，;；]+/).map(s=>s.trim()).filter(Boolean);
    },
    getWarmSearchTerms(){
      const box=document.querySelector('#warm-search-terms');
      if(!box)return this.parseWarmSearchTerms(this._warmCreateDraft?.searchTerms||'');
      return [...box.querySelectorAll('.warm-term-tag')].map(el=>{
        const input=el.querySelector('.warm-term-edit');
        if(input)return String(input.value||'').trim();
        return String(el.getAttribute('data-term')||'').trim();
      }).filter(Boolean);
    },
    syncWarmSearchTermsValue(){
      const terms=this.getWarmSearchTerms();
      const hidden=document.querySelector('#warm-search-terms-value');
      if(hidden)hidden.value=terms.join('\n');
      return terms;
    },
    warmSearchTermTagHtml(term){
      const t=String(term||'').trim();
      if(!t)return '';
      return `<span class="warm-term-tag" data-term="${this.esc(t)}" title="双击修改" ondblclick="app.beginWarmSearchTermEdit(this)"><span class="warm-term-text">${this.esc(t)}</span><button type="button" class="warm-term-del" title="删除" onclick="event.stopPropagation();app.removeWarmSearchTerm(this)" aria-label="删除">×</button></span>`;
    },
    renderWarmSearchTermTags(terms){
      const box=document.querySelector('#warm-search-terms');
      if(!box)return;
      const list=this.parseWarmSearchTerms(terms);
      box.innerHTML=`${list.map(t=>this.warmSearchTermTagHtml(t)).join('')}<button type="button" class="warm-term-add" title="添加搜索词" onclick="app.addWarmSearchTerm()" aria-label="添加">+</button>`;
      this.syncWarmSearchTermsValue();
    },
    addWarmSearchTerm(){
      const box=document.querySelector('#warm-search-terms');
      if(!box)return;
      if(box.querySelector('.warm-term-tag.is-editing')){
        box.querySelector('.warm-term-edit')?.focus();
        return;
      }
      const addBtn=box.querySelector('.warm-term-add');
      const tag=document.createElement('span');
      tag.className='warm-term-tag is-editing is-new';
      tag.innerHTML=`<input class="warm-term-edit" type="text" maxlength="120" placeholder="输入搜索词" aria-label="新搜索词"><button type="button" class="warm-term-del" title="取消" onclick="event.stopPropagation();app.removeWarmSearchTerm(this)" aria-label="取消">×</button>`;
      if(addBtn)box.insertBefore(tag,addBtn);else box.appendChild(tag);
      const input=tag.querySelector('.warm-term-edit');
      input?.focus();
      input?.addEventListener('keydown',(e)=>{
        if(e.key==='Enter'){e.preventDefault();this.commitWarmSearchTermEdit(tag)}
        if(e.key==='Escape'){e.preventDefault();tag.remove();this.syncWarmSearchTermsValue()}
      });
      input?.addEventListener('blur',()=>{setTimeout(()=>{if(tag.isConnected&&tag.classList.contains('is-editing'))this.commitWarmSearchTermEdit(tag)},120)});
    },
    beginWarmSearchTermEdit(el){
      if(!el||el.classList.contains('is-editing'))return;
      const cur=String(el.getAttribute('data-term')||'').trim();
      el.classList.add('is-editing');
      el.innerHTML=`<input class="warm-term-edit" type="text" maxlength="120" value="${this.esc(cur)}" aria-label="修改搜索词"><button type="button" class="warm-term-del" title="删除" onclick="event.stopPropagation();app.removeWarmSearchTerm(this)" aria-label="删除">×</button>`;
      const input=el.querySelector('.warm-term-edit');
      input?.focus();
      input?.select();
      input?.addEventListener('keydown',(e)=>{
        if(e.key==='Enter'){e.preventDefault();this.commitWarmSearchTermEdit(el)}
        if(e.key==='Escape'){
          e.preventDefault();
          const wrap=document.createElement('div');
          wrap.innerHTML=this.warmSearchTermTagHtml(cur);
          const node=wrap.firstElementChild;
          if(node)el.replaceWith(node);
          this.syncWarmSearchTermsValue();
        }
      });
      input?.addEventListener('blur',()=>{setTimeout(()=>{if(el.isConnected&&el.classList.contains('is-editing'))this.commitWarmSearchTermEdit(el)},120)});
    },
    commitWarmSearchTermEdit(el){
      if(!el||!el.classList.contains('is-editing'))return;
      const input=el.querySelector('.warm-term-edit');
      const next=String(input?.value||'').trim();
      if(!next){el.remove();this.syncWarmSearchTermsValue();return}
      const html=this.warmSearchTermTagHtml(next);
      const wrap=document.createElement('div');
      wrap.innerHTML=html;
      const node=wrap.firstElementChild;
      if(node)el.replaceWith(node);
      this.syncWarmSearchTermsValue();
    },
    removeWarmSearchTerm(btn){
      const tag=btn?.closest?.('.warm-term-tag');
      if(tag)tag.remove();
      this.syncWarmSearchTermsValue();
    },
    captureWarmCreateDraft(){
      const form=document.querySelector('#warm-create-form');
      if(!form)return;
      const fd=new FormData(form);
      const d=Object.fromEntries(fd.entries());
      const accountIds=this.selectedWarmAccountIds();
      const searchTerms=this.syncWarmSearchTermsValue().join('\n');
      const comment=this.collectWarmCommentPayload?.()||{};
      this._warmCreateDraft={
        ...d,
        accountIds,
        searchType:'video',
        searchTerms,
        matchKeywords:'',
        diagnoseAfterWarm:!!form.querySelector('[name=diagnoseAfterWarm]')?.checked,
        recurring:!!form.querySelector('[name=recurring]')?.checked,
        recurringDays:Number(form.querySelector('[name=recurringDays]')?.value||d.recurringDays||1)||1,
        ...comment,
      };
    },
    toggleWarmRecurringFields(){
      const on=!!document.querySelector('#warm-create-form [name=recurring]')?.checked;
      const box=document.querySelector('#warm-recurring-days-field');
      if(box)box.classList.toggle('hidden',!on);
    },
    filterWarmAccountList(){this.filterWarmAccountPick(document.querySelector('#warm-accounts-search')?.value||'')},
    toggleWarmAccountAll(checked){this.setWarmAccountPickAll(!!checked)},
    patchWarmCreateChrome(step){
      const n=step===2?2:1;
      const edit=!!(this._warmEditSnapshot||this.warmEditId);
      document.querySelectorAll('.warm-step-pane').forEach(el=>{
        el.classList.toggle('is-show',Number(el.getAttribute('data-step'))===n);
      });
      document.querySelectorAll('.warm-step').forEach((el,idx)=>{
        const s=idx+1;
        el.classList.toggle('is-active',s===n);
        el.classList.toggle('is-done',s<n);
      });
      const line=document.querySelector('.warm-step-line');
      if(line)line.classList.toggle('is-on',n===2);
      const foot=document.querySelector('.warm-create-footer');
      if(!foot)return;
      if(n===1){
        foot.innerHTML=`
          <button class="ghost warm-foot-btn" type="button" onclick="app.closeWarmCreate()"><span class="warm-ico">✕</span>取消</button>
          <div class="warm-foot-spacer"></div>
          <button class="primary warm-foot-btn" type="button" onclick="app.setWarmCreateStep(2)">下一步：养号设置 →</button>`;
      }else{
        foot.innerHTML=`
          <button class="primary warm-foot-btn" type="button" onclick="app.submitWarmTask(true)"><span class="warm-ico">✓</span>${edit?'保存并启动':'创建并启动'}</button>
          <button class="ghost warm-foot-btn" type="button" onclick="app.submitWarmTask(false)"><span class="warm-ico">✓</span>${edit?'仅保存':'创建为草稿'}</button>
          <button class="ghost warm-foot-btn" type="button" onclick="app.closeWarmCreate()"><span class="warm-ico">✕</span>取消</button>`;
      }
    },
    async renderWarmList(){
      const status=this.warmStatusFilter||'';
      const keyword=String(this.warmKeyword||'').trim().toLowerCase();
      const page=this.warmPage||1;
      const pack=await this.api('/tasks?page=1&pageSize=200&type=warm').catch(()=>({items:[]}));
      let items=(pack.items||[]).slice().sort((a,b)=>Number(b.id||0)-Number(a.id||0));
      if(status)items=items.filter(x=>x.status===status);
      if(keyword)items=items.filter(x=>String(x.name||'').toLowerCase().includes(keyword));
      const statusCounts={all:(pack.items||[]).length};
      ['draft','queued','running','paused','completed','failed','cancelled'].forEach(k=>{statusCounts[k]=(pack.items||[]).filter(x=>x.status===k).length});
      const paged=UI.paginateLocal(items,page,15);
      this.warmPage=paged.page;
      const d={items:paged.items,total:paged.total,page:paged.page,pages:paged.pages,pageSize:paged.pageSize||15};
      const queued=items.filter(x=>x.status==='queued').length;
      const statusOpts=[['',`全部 (${statusCounts.all||0})`],...this.taskStatusPairs().map(([k,n])=>[k,`${n} (${statusCounts[k]||0})`])];
      document.querySelector('#content').innerHTML=`<div class="panel warm-tasks-panel">
        <div class="matrix-action-bar">
          <div class="left">
            ${this.canWarmTasks()?`<button class="primary" type="button" onclick="app.openWarmCreate()">创建养号任务</button>`:''}
            <button class="ghost" type="button" onclick="app.refresh()">刷新</button>
            ${this.canWarmTasks()?`<div class="dropdown"><button class="ghost" type="button" onclick="app.toggleTaskBatchMenu(event)">批量操作 <span class="btn-arrow-down">▾</span></button><div id="task-batch-menu" class="dropdown-menu align-left hidden"><button type="button" onclick="app.batchTaskAction('start')">批量启动</button><button type="button" onclick="app.batchTaskAction('pause')">批量暂停</button><button type="button" onclick="app.batchTaskAction('cancel')">批量取消</button><button type="button" onclick="app.batchRetryTasks()">批量重试</button><button type="button" class="is-danger" onclick="app.batchDeleteTasks()">批量删除</button></div></div>`:''}
          </div>
          <div class="right"><span class="muted">养号任务由本机 Node 领取执行；需账号已绑定比特环境并保持登录</span></div>
        </div>
        ${queued?`<div class="shell-note" id="warm-node-hint" style="margin:0 0 12px">有 <b>${queued}</b> 个养号任务在排队，请确认本机 Node 已启动</div>`:''}
        <div class="search-bar task-filter-bar">
          <select id="warm-status-filter" class="input" title="任务状态">${statusOpts.map(([v,n])=>`<option value="${this.esc(v)}" ${status===v?'selected':''}>${this.esc(n)}</option>`).join('')}</select>
          <input id="warm-name-filter" class="input" type="search" placeholder="任务名称" value="${this.esc(this.warmKeyword||'')}" onkeydown="if(event.key==='Enter')app.searchWarmTasks()">
          <button class="primary" type="button" onclick="app.searchWarmTasks()">搜索</button>
          <button class="ghost" type="button" onclick="app.resetWarmFilters()">重置</button>
        </div>
        <div class="table-container">${this.warmTaskTable(d.items)}</div>
        ${UI.pager(d,'warmPage')}
      </div>`;
      if(queued){
        Promise.resolve(this.probeNodeOnline()).then(ok=>{
          const el=document.querySelector('#warm-node-hint');
          if(!el||this.view!=='warm')return;
          el.innerHTML=ok?`本机 Node 在线；排队中的养号任务将由 task-runner 领取。`:`有 <b>${queued}</b> 个养号任务在排队。请启动本机服务（start.bat）后再观察进度。`;
        }).catch(()=>{});
      }
      if(d.items.some(x=>['queued','running'].includes(x.status))||items.some(x=>['queued','running'].includes(x.status))){
        this.warmRefreshTimer=setInterval(()=>{if(this.view==='warm'&&this.warmPane==='list')this.renderWarm();else clearInterval(this.warmRefreshTimer)},3000);
      }
    },
    warmTaskTable(rows){
      if(!rows.length)return '<div class="empty">还没有养号任务，点击「创建养号任务」开始</div>';
      return `<table><thead><tr><th><input type="checkbox" onchange="app.toggleAllTasks(this.checked)" title="全选任务"></th><th>任务</th><th>类型</th><th>分组</th><th>进度</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead><tbody>${rows.map(x=>this.warmTaskRowHtml(x)).join('')}</tbody></table>`;
    },
    warmTaskRowHtml(x){
      const pct=x.total_count?Math.round((x.success_count+x.fail_count)/x.total_count*100):0;
      const canEdit=['draft','paused','failed','completed'].includes(x.status);
      const more=[];
      if(canEdit){
        const startLabel=x.status==='paused'?'重启':(x.status==='failed'?'重试':'启动');
        more.push(`<button type="button" onclick="app.taskAction(${x.id},'start','${this.esc(x.status)}')">${startLabel}</button>`);
      }
      if(['queued','running'].includes(x.status)){
        more.push(`<button type="button" onclick="app.taskAction(${x.id},'pause')">暂停</button>`);
        more.push(`<button type="button" class="is-danger" onclick="app.taskAction(${x.id},'cancel')">取消</button>`);
      }
      if(['queued','running','completed','failed','cancelled','paused','draft'].includes(x.status)){
        more.push(`<button type="button" onclick="app.warmTaskDetailModal(${x.id})">明细</button>`);
        more.push(`<button type="button" onclick="app.exportTaskResultsCsv(${x.id})">结果 CSV</button>`);
        more.push(`<button type="button" onclick="app.preflightTask(${x.id})">执行前检查</button>`);
      }
      if(x.status==='failed')more.push(`<button type="button" onclick="app.retryTask(${x.id})">重试失败</button>`);
      const detailBtn=`<button class="tiny" type="button" title="查看明细" onclick="app.warmTaskDetailModal(${x.id})">明细</button>`;
      const editBtn=canEdit?`<button class="tiny" type="button" title="编辑" onclick="app.editWarmTask(${x.id})">编辑</button>`:`<button class="tiny" type="button" title="编辑" disabled>编辑</button>`;
      const delBtn=`<button class="tiny danger" type="button" title="删除" onclick="app.remove('/tasks/${x.id}','养号任务')">删除</button>`;
      const moreBtn=more.length?`<div class="ops-dropdown task-ops-dropdown"><button class="tiny" type="button" title="更多" onclick="app.toggleTaskOps(${x.id},event)">…</button><div id="task-ops-${x.id}" class="dropdown-menu ops-menu hidden">${more.join('')}</div></div>`:'';
      const p=x.payload||{};
      const recurring=!!(p.recurring||p.isRecurring);
      const days=Number(p.recurringDays||p.repeatDays||1)||1;
      const recBadge=recurring?`<span class="badge online" title="常态化 · 每 ${days} 天">常态/${days}天</span>`:'';
      return `<tr class="warm-task-row" data-id="${x.id}"><td><input class="task-check" type="checkbox" value="${x.id}" onclick="event.stopPropagation()"></td><td><button type="button" class="warm-task-name-link" onclick="app.warmTaskDetailModal(${x.id})"><b>${this.esc(x.name)}</b></button>${recBadge?`<div style="margin-top:4px">${recBadge}</div>`:''}</td><td>自动养号</td><td>${this.esc(x.group_name||'-')}</td><td><div class="progress"><i style="width:${pct}%"></i></div><span class="muted">${x.success_count}/${x.total_count}</span></td><td>${this.badge(x.status)}${this.nodeOwnedTaskHint(x.status,x.type)}</td><td>${this.esc(x.created_at)}</td><td><div class="task-ops-cell">${detailBtn}${editBtn}${delBtn}${moreBtn}</div></td></tr>`;
    },
    warmPlanActionTags(step){
      const tags=[];
      if(step?.like)tags.push(['like','点赞']);
      if(step?.comment)tags.push(['comment','评论']);
      if(step?.favorite)tags.push(['favorite','收藏']);
      if(step?.follow)tags.push(['follow','关注']);
      if(step?.viewComments&&!step?.comment)tags.push(['view','看评']);
      if(step?.commentLike)tags.push(['clike','评赞']);
      if(!tags.length)tags.push(['stay','仅停留']);
      return tags.map(([k,l])=>`<span class="warm-plan-tag warm-plan-tag-${k}">${l}</span>`).join('');
    },
    /** 明细展示：videos 与 videoCount 对齐，缺的补「仅停留」行，避免抬头 9 条却只列出 4 行 */
    normalizeWarmPlanVideos(kw, stayMin=10, stayMax=20){
      const list=Array.isArray(kw?.videos)?kw.videos.slice():[];
      // 兼容 videos 被存成 {0:{},1:{}} 的情况
      const fromObj=(!list.length&&kw?.videos&&typeof kw.videos==='object')
        ?Object.keys(kw.videos).sort((a,b)=>Number(a)-Number(b)).map(k=>kw.videos[k]).filter(Boolean)
        :list;
      const videos=fromObj.slice();
      const declared=Math.max(0,Number(kw?.videoCount||0));
      const target=Math.max(videos.length,declared);
      const sMin=Math.max(1,Number(stayMin)||10);
      const sMax=Math.max(sMin,Number(stayMax)||20);
      while(videos.length<target){
        const i=videos.length;
        videos.push({
          index:i,
          staySeconds:sMin+Math.floor(Math.random()*Math.max(1,sMax-sMin+1)),
          like:false,comment:false,follow:false,favorite:false,
          viewComments:false,commentLike:false,
          _padded:true,
        });
      }
      return{
        ...kw,
        videoCount:videos.length,
        videos,
        likeCount:videos.filter(v=>v?.like).length,
        commentCount:videos.filter(v=>v?.comment).length,
        followCount:videos.filter(v=>v?.follow).length,
      };
    },
    renderWarmExecutionPlanHtml(plan, accountLabel, cfg={}){
      if(!plan||!Array.isArray(plan.keywords)||!plan.keywords.length){
        return `<div class="warm-plan-empty">暂无执行计划（旧任务或未保存生成）</div>`;
      }
      const commentMode=String(plan.commentMode||cfg.commentMode||'fixed');
      const commentTexts=Array.isArray(plan.commentTexts)?plan.commentTexts.filter(Boolean):[];
      const commentLabel=commentMode==='ai'
        ?'AI 英文评论'
        :(commentTexts.length>1
          ?`固定轮换 ${commentTexts.length} 条`
          :`「${this.esc(commentTexts[0]||plan.commentText||'很棒的视频，点赞')}」`);
      const stayMin=Number(cfg.staySecondsMin||plan.staySecondsMin||10);
      const stayMax=Number(cfg.staySecondsMax||plan.staySecondsMax||20);
      let listedTotal=0;
      const kwCards=plan.keywords.map((kw,ki)=>{
        const norm=this.normalizeWarmPlanVideos(kw,stayMin,stayMax);
        const videos=norm.videos;
        listedTotal+=videos.length;
        const padded=videos.filter(v=>v?._padded).length;
        const rows=videos.length?videos.map((v,vi)=>{
          const idx=(v.index!=null?v.index:vi)+1;
          const stay=Number(v.staySeconds||0);
          return `<div class="warm-plan-video">
            <span class="warm-plan-video-idx">#${idx}</span>
            <span class="warm-plan-video-stay"><i>${stay}</i> 秒</span>
            <div class="warm-plan-video-tags">${this.warmPlanActionTags(v)}</div>
          </div>`;
        }).join(''):`<div class="muted" style="padding:8px 0">该关键词无视频配额</div>`;
        return `<div class="warm-plan-kw">
          <div class="warm-plan-kw-head">
            <div class="warm-plan-kw-term"><span class="warm-plan-kw-badge">${ki+1}</span><b>${this.esc(norm.term||'-')}</b></div>
            <div class="warm-plan-kw-meta">
              <span>${videos.length} 条视频</span>
              <span>点赞 ${norm.likeCount}</span>
              <span>评论 ${norm.commentCount}</span>
              <span>关注 ${norm.followCount}</span>
              ${padded?`<span title="原计划条数不足，已补齐仅停留">补齐 ${padded}</span>`:''}
            </div>
          </div>
          <div class="warm-plan-video-list">${rows}</div>
        </div>`;
      }).join('');
      const planTotal=Number(plan.videoTotal||listedTotal||0);
      return `<div class="warm-plan-block">
        ${accountLabel?`<div class="warm-plan-account">${accountLabel}</div>`:''}
        <div class="warm-plan-overview">
          <div class="warm-plan-stat"><small>计划视频</small><b>${planTotal}</b></div>
          <div class="warm-plan-stat"><small>明细条数</small><b>${listedTotal}</b></div>
          <div class="warm-plan-stat"><small>关键词</small><b>${plan.keywords.length}</b></div>
          <div class="warm-plan-stat warm-plan-stat-wide"><small>评论</small><b>${commentLabel}</b></div>
        </div>
        <div class="warm-plan-kw-list">${kwCards}</div>
      </div>`;
    },
    async warmTaskDetailModal(id){
      try{
        const pack=await this.api('/tasks?page=1&pageSize=200&type=warm');
        const task=(pack.items||[]).find(x=>Number(x.id)===Number(id));
        if(!task){this.toast('任务不存在',true);return}
        const p=task.payload||{};
        const accountIds=(p.accountIds||[]).map(Number).filter(Boolean);
        let accountMap={};
        if(accountIds.length){
          const accPack=await this.api('/accounts?pageSize=500').catch(()=>({items:[]}));
          (accPack.items||[]).forEach(a=>{accountMap[Number(a.id)]=a});
        }
        const section=(title,body,emptyText)=>`<section class="task-detail-section"><div class="task-detail-section-head"><span class="task-detail-section-title">${this.esc(title)}</span></div><div class="task-detail-section-body">${body||`<div class="empty task-detail-empty">${this.esc(emptyText||'暂无数据')}</div>`}</div></section>`;

        const rates=[
          ['点赞',p.likeRate],[ '评论',p.commentRate??p.viewCommentRate],[ '关注',p.followRate],
          ['收藏',p.favoriteRate],['评赞',p.commentLikeRate],
        ].map(([n,v])=>`<span class="warm-cfg-pill"><em>${n}</em>${Number(v||0)}%</span>`).join('');

        const cfgBody=`<div class="warm-cfg-grid">
          <div class="warm-cfg-item"><small>搜索类型</small><b>视频</b></div>
          <div class="warm-cfg-item"><small>刷视频数</small><b>${Number(p.videoCountMin||0)} ~ ${Number(p.videoCountMax||0)}</b></div>
          <div class="warm-cfg-item"><small>停留秒数</small><b>${Number(p.staySecondsMin||0)} ~ ${Number(p.staySecondsMax||0)}</b></div>
          <div class="warm-cfg-item"><small>并发线程</small><b>${Number(p.threadCount||1)}</b></div>
          <div class="warm-cfg-item"><small>常态化</small><b>${(p.recurring||p.isRecurring)?`是 · 每 ${Number(p.recurringDays||p.repeatDays||1)||1} 天`:'否'}</b></div>
          <div class="warm-cfg-item full"><small>搜索词</small><b>${this.esc(String(p.searchTerms||'-').replace(/\n/g,' · '))}</b></div>
          <div class="warm-cfg-item full"><small>互动概率</small><div class="warm-cfg-pills">${rates}</div></div>
          <div class="warm-cfg-item full"><small>评论内容</small><b>${String(p.commentMode||'fixed')==='ai'
            ?`AI 英文 · 模板 #${Number(p.commentAiTemplateId||0)||'-'}`
            :(Array.isArray(p.commentTexts)&&p.commentTexts.length
              ?`固定 · ${p.commentTexts.length} 条文案`
              :`固定 · ${this.esc(p.commentText||'很棒的视频，点赞')}`)}</b></div>
        </div>`;

        const plansMap=(p.executionPlans&&typeof p.executionPlans==='object'&&!Array.isArray(p.executionPlans))?p.executionPlans:{};
        const planKeys=Object.keys(plansMap);
        let planBody='';
        if(planKeys.length){
          const tabs=planKeys.map((aid,i)=>{
            const a=accountMap[Number(aid)];
            const label=a?`#${aid} · ${a.username||''}`:`账号 #${aid}`;
            return `<button type="button" class="warm-plan-tab ${i===0?'is-on':''}" data-plan-tab="${this.esc(aid)}" onclick="app.switchWarmPlanTab('${this.esc(aid)}')">${this.esc(label)}</button>`;
          }).join('');
          const panes=planKeys.map((aid,i)=>{
            const a=accountMap[Number(aid)];
            const label=a?`账号 #${aid} · ${this.esc(a.username||'')}`:`账号 #${aid}`;
            return `<div class="warm-plan-pane ${i===0?'is-show':''}" data-plan-pane="${this.esc(aid)}">${this.renderWarmExecutionPlanHtml(plansMap[aid],label,p)}</div>`;
          }).join('');
          planBody=`<div class="warm-plan-tabs">${tabs}</div><div class="warm-plan-panes">${panes}</div>`;
        }else if(p.executionPlan){
          planBody=this.renderWarmExecutionPlanHtml(p.executionPlan, accountIds.length===1?`账号 #${accountIds[0]}`:'',p);
        }else{
          planBody='';
        }

        const html=`<div class="task-detail warm-task-detail">
          <div class="task-detail-summary">
            <div class="task-detail-chip"><small>类型</small><b>自动养号</b></div>
            <div class="task-detail-chip"><small>状态</small><b>${this.badge(task.status)}</b></div>
            <div class="task-detail-chip"><small>进度</small><b>${task.success_count}/${task.total_count}</b></div>
            <div class="task-detail-chip"><small>定时</small><b>${this.esc(task.scheduled_at||'立即')}</b></div>
            <div class="task-detail-chip"><small>创建时间</small><b>${this.esc(task.created_at||'-')}</b></div>
            <div class="task-detail-chip"><small>账号数</small><b>${accountIds.length||(task.group_name?`分组·${task.group_name}`:'-')}</b></div>
          </div>
          ${section('养号配置',cfgBody)}
          ${section('执行计划',planBody,'暂无执行计划。重新保存任务后会生成。')}
          <div class="task-detail-actions">
            ${['draft','paused','failed'].includes(task.status)?`<button class="primary" type="button" onclick="app.closeModal();app.editWarmTask(${id})">编辑任务</button>`:''}
            <button class="ghost" type="button" onclick="app.exportTaskResultsCsv(${id})">导出结果 CSV</button>
          </div>
        </div>`;
        this.modal(`养号明细 · ${this.esc(task.name||('#'+id))}`,html,()=>{},false,{wide:true,hideSubmit:true,hideFooter:false});
        const foot=document.querySelector('#modal .modal-foot');
        if(foot){foot.classList.remove('hidden');const cancel=foot.querySelector('button[type=button]');if(cancel)cancel.textContent='关闭'}
      }catch(e){this.toast(e.message,true)}
    },
    switchWarmPlanTab(aid){
      const key=String(aid||'');
      document.querySelectorAll('.warm-plan-tab').forEach(el=>el.classList.toggle('is-on',el.getAttribute('data-plan-tab')===key));
      document.querySelectorAll('.warm-plan-pane').forEach(el=>el.classList.toggle('is-show',el.getAttribute('data-plan-pane')===key));
    },
    searchWarmTasks(){
      this.warmStatusFilter=String(document.querySelector('#warm-status-filter')?.value||'').trim();
      this.warmKeyword=String(document.querySelector('#warm-name-filter')?.value||'').trim();
      this.warmPage=1;
      this.refresh();
    },
    resetWarmFilters(){this.warmStatusFilter='';this.warmKeyword='';this.warmPage=1;this.refresh()},
    async editWarmTask(id){
      try{
        const pack=await this.api('/tasks?page=1&pageSize=200&type=warm');
        const task=(pack.items||[]).find(x=>Number(x.id)===Number(id));
        if(!task){this.toast('任务不存在',true);return}
        if(!['draft','paused','failed'].includes(task.status)){this.toast('仅草稿/暂停/失败任务可编辑',true);return}
        this.openWarmCreate(task);
      }catch(e){this.toast(e.message,true)}
    },
    async renderWarmCreate(){
      if(!this.canWarmTasks()){this.toast('当前角色无权管理养号任务',true);this.warmPane='list';return this.renderWarmList()}
      await this.loadRefs();
      const edit=this._warmEditSnapshot||null;
      const draft=this._warmCreateDraft||null;
      const p=edit?.payload||{};
      const selected=(draft?.accountIds||p.accountIds||[]).map(Number);
      const accounts=(await this.api('/accounts?pageSize=500').catch(()=>({items:[]}))).items||[];
      const gs=this.accountGroupFlatOptions();
      const scheduled=draft?.scheduledAt||(edit?.scheduled_at?new Date(edit.scheduled_at).toISOString().slice(0,16):'');
      const termsRaw=draft?.searchTerms!=null?draft.searchTerms:(Array.isArray(p.searchTerms)?p.searchTerms.join('\n'):(p.searchTerms||''));
      const termList=this.parseWarmSearchTerms(termsRaw);
      const step=this.warmCreateStep===2?2:1;
      const taskName=draft?.name||edit?.name||`自动养号 ${new Date().toLocaleString('zh-CN',{hour12:false})}`;
      const groupVal=draft?.groupId??(edit?.group_id||p.groupId||'');
      const val=(k,fallback)=>draft?.[k]!=null&&draft[k]!==''?draft[k]:fallback;
      const diag=draft?!!draft.diagnoseAfterWarm:!!p.diagnoseAfterWarm;
      const recurring=draft?!!draft.recurring:!!(p.recurring||p.isRecurring);
      const recurringDays=Number(val('recurringDays',p.recurringDays??p.repeatDays??1))||1;
      const commentMode=String(val('commentMode',p.commentMode||'fixed'))==='ai'?'ai':'fixed';
      const fixedIds=(draft?.commentTemplateIds||p.commentTemplateIds||[]).map(Number).filter(Boolean);
      const aiId=Number(val('commentAiTemplateId',p.commentAiTemplateId||0))||0;
      let commentTpls=[];
      try{
        const pack=await this.api('/interaction-templates?type=comment');
        commentTpls=(pack.items||[]).filter(t=>t.enabled!==0&&t.enabled!==false);
      }catch(_){commentTpls=[]}
      this._warmCommentTemplates=commentTpls;
      const fixedTpls=commentTpls.filter(t=>(t.contentMode||'fixed')==='fixed');
      const aiTpls=commentTpls.filter(t=>t.contentMode==='ai');

      document.querySelector('#content').innerHTML=`<div class="panel warm-create-panel">
        <div class="warm-create-top">
          <div class="warm-create-heading">
            <h2>${edit?'编辑养号任务':'创建养号任务'}</h2>
            <p>自动搜索并刷互动 · 需账号已绑定比特环境并保持登录</p>
          </div>
          <div class="warm-stepper" aria-label="创建步骤">
            <button type="button" class="warm-step ${step===1?'is-active':(step>1?'is-done':'')}" onclick="app.setWarmCreateStep(1)">
              <i>1</i><span>选择账号</span>
            </button>
            <div class="warm-step-line ${step===2?'is-on':''}"></div>
            <button type="button" class="warm-step ${step===2?'is-active':''}" onclick="app.setWarmCreateStep(2)">
              <i>2</i><span>养号设置</span>
            </button>
          </div>
        </div>

        <form id="warm-create-form" class="warm-create-form" onsubmit="return false">
          <input type="hidden" name="id" value="${edit?.id||draft?.id||''}">

          <div class="warm-step-pane ${step===1?'is-show':''}" data-step="1">
            <div class="warm-card">
              <div class="warm-card-head">
                <b>任务与账号</b>
                <span class="muted">可多选账号；不选账号时按分组执行</span>
              </div>
              <div class="warm-card-body">
                ${this.field('name','任务名称',taskName,'text',true)}
                ${this.select('groupId','账号分组（未勾选账号时生效）',gs,groupVal)}
                <div class="field full warm-acc-field">
                  <label>指定账号 <span class="muted">已选 <b id="warm-acc-count">${selected.length}</b></span></label>
                  ${this.accountPickToolbarHtml('warm-accounts',{batchHtml:`<button type="button" class="tiny" onclick="app.setWarmAccountPickAll(true)">全选</button><button type="button" class="tiny" onclick="app.setWarmAccountPickAll(false)">清空</button><button type="button" class="tiny" onclick="app.invertWarmAccountPick()">反选</button>`})}
                  <div id="warm-accounts" class="account-pick-grid"></div>
                </div>
              </div>
            </div>
          </div>

          <div class="warm-step-pane ${step===2?'is-show':''}" data-step="2">
            <div class="warm-card">
              <div class="warm-card-head"><b>搜索</b><span class="muted">按搜索词在 TikTok 视频结果中刷视频互动</span></div>
              <div class="warm-card-body">
                <div class="field full">
                  <label>搜索词</label>
                  <div id="warm-search-terms" class="warm-term-tags" aria-label="搜索词标签"></div>
                  <input type="hidden" name="searchTerms" id="warm-search-terms-value" value="${this.esc(termList.join('\n'))}">
                </div>
                <div class="field full">
                  <label>搜索类型</label>
                  <div class="warm-search-type-fixed"><span class="chip is-fixed">视频</span><span class="muted">仅支持视频搜索</span></div>
                  <input type="hidden" name="searchType" value="video">
                </div>
              </div>
            </div>

            <div class="warm-card">
              <div class="warm-card-head"><b>互动概率</b><span class="muted">保存时按概率固化到执行计划（均分关键词、指定视频点赞/评论）</span></div>
              <div class="warm-card-body warm-rate-grid">
                ${this.rateField('followRate','关注概率',val('followRate',p.followRate??10))}
                ${this.rateField('likeRate','点赞概率',val('likeRate',p.likeRate??30))}
                ${this.rateField('favoriteRate','收藏概率',val('favoriteRate',p.favoriteRate??10))}
                ${this.rateField('viewCommentRate','评论概率',val('viewCommentRate',p.viewCommentRate??20))}
                ${this.rateField('commentLikeRate','评论点赞概率',val('commentLikeRate',p.commentLikeRate??20))}
              </div>
            </div>

            <div class="warm-card">
              <div class="warm-card-head"><b>评论内容</b><span class="muted">上方选分类，下方选模板；固定可多选轮换，AI 单选一条</span></div>
              <div class="warm-card-body warm-comment-body">
                <div class="warm-comment-cats" role="tablist" aria-label="评论分类">
                  <label class="warm-comment-cat ${commentMode==='fixed'?'is-on':''}">
                    <input type="radio" name="commentMode" value="fixed" ${commentMode==='fixed'?'checked':''} onchange="app.setWarmCommentMode('fixed')">
                    <b>固定评论</b>
                    <small>多选轮换</small>
                  </label>
                  <label class="warm-comment-cat ${commentMode==='ai'?'is-on':''}">
                    <input type="radio" name="commentMode" value="ai" ${commentMode==='ai'?'checked':''} onchange="app.setWarmCommentMode('ai')">
                    <b>AI 英文评论</b>
                    <small>单选生成</small>
                  </label>
                </div>
                <div class="warm-comment-data">
                  <div id="warm-comment-fixed-box" class="warm-comment-tpl-box" ${commentMode==='fixed'?'':'hidden'}>
                    <div class="muted warm-comment-hint">勾选「固定文案」评论模板，发评时随机一条</div>
                    <div id="warm-comment-fixed-list" class="warm-comment-tpl-list">${this.renderWarmCommentTplOptions(fixedTpls,'fixed',fixedIds)}</div>
                  </div>
                  <div id="warm-comment-ai-box" class="warm-comment-tpl-box" ${commentMode==='ai'?'':'hidden'}>
                    <div class="muted warm-comment-hint">选择一条「AI 提示词」评论模板，按视频生成英文评论</div>
                    <div id="warm-comment-ai-list" class="warm-comment-tpl-list">${this.renderWarmCommentTplOptions(aiTpls,'ai',aiId?[aiId]:[])}</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="warm-card">
              <div class="warm-card-head"><b>数量与节奏</b><span class="muted">刷视频量、停留时间与并发</span></div>
              <div class="warm-card-body warm-grid-3">
                ${this.field('videoCountMin','刷视频数量(最小)',val('videoCountMin',p.videoCountMin??10),'number',true)}
                ${this.field('videoCountMax','刷视频数量(最大)',val('videoCountMax',p.videoCountMax??10),'number',true)}
                ${this.field('commentPages','看评论页数',val('commentPages',p.commentPages??3),'number')}
                ${this.field('staySecondsMin','停留时间(秒)最小',val('staySecondsMin',p.staySecondsMin??10),'number',true)}
                ${this.field('staySecondsMax','停留时间(秒)最大',val('staySecondsMax',p.staySecondsMax??20),'number',true)}
                ${this.field('threadCount','并发线程(1-3)',val('threadCount',p.threadCount??1),'number')}
          ${this.field('scheduledAt','定时启动（可空）',scheduled,'datetime-local')}
                <div class="field full"><label class="warm-check-line"><input type="checkbox" name="diagnoseAfterWarm" value="1" ${diag?'checked':''}> 养号结束后诊断账号（Studio Account Check 截图入库）</label></div>
                <div class="field full"><label class="warm-check-line"><input type="checkbox" name="recurring" value="1" ${recurring?'checked':''} onchange="app.toggleWarmRecurringFields()"> 常态化养号（结束后按间隔自动重新入队）</label></div>
                <div class="field ${recurring?'':'hidden'}" id="warm-recurring-days-field">
                  <label>几天重复一次</label>
                  <input class="input" type="number" name="recurringDays" min="1" max="365" value="${this.esc(String(recurringDays))}" placeholder="例如 1">
                  <div class="muted" style="margin-top:4px;font-size:12px">需 crontab 挂载：<code>php artisan warm:recurring</code>。到期后将已成功/失败的任务重置为排队，并挂到账号当前进行中的总任务（没有则新建）。</div>
                </div>
              </div>
            </div>
          </div>

          <div class="warm-create-footer">
            ${step===1?`
              <button class="ghost warm-foot-btn" type="button" onclick="app.closeWarmCreate()"><span class="warm-ico">✕</span>取消</button>
              <div class="warm-foot-spacer"></div>
              <button class="primary warm-foot-btn" type="button" onclick="app.setWarmCreateStep(2)">下一步：养号设置 →</button>
            `:`
              <button class="primary warm-foot-btn" type="button" onclick="app.submitWarmTask(true)"><span class="warm-ico">✓</span>${edit?'保存并启动':'创建并启动'}</button>
              <button class="ghost warm-foot-btn" type="button" onclick="app.submitWarmTask(false)"><span class="warm-ico">✓</span>${edit?'仅保存':'创建为草稿'}</button>
              <button class="ghost warm-foot-btn" type="button" onclick="app.closeWarmCreate()"><span class="warm-ico">✕</span>取消</button>
            `}
          </div>
        </form>
      </div>`;
      this.fillWarmAccounts(accounts, selected);
      this.renderWarmSearchTermTags(termList);
      this.setWarmCommentMode(commentMode);
    },
    warmTplContent(t, preferMode){
      const mode=t?.contentMode||preferMode||'fixed';
      const c=String(t?.content||'').trim();
      if(c)return c;
      if(mode==='ai')return String(t?.aiPrompt||t?.ai_prompt||'').trim();
      return String(t?.fixedText||t?.fixed_text||'').trim();
    },
    renderWarmCommentTplOptions(items, mode, selectedIds){
      const list=Array.isArray(items)?items:[];
      const selected=new Set((selectedIds||[]).map(Number).filter(Boolean));
      if(!list.length){
        const tip=mode==='ai'
          ?'暂无 AI 提示词评论模板，请先在「消息模板」新建内容类型为「AI 提示词」的评论'
          :'暂无固定文案评论模板，请先在「消息模板」新建内容类型为「固定文案」的评论';
        return `<div class="warm-comment-empty">${tip}</div>`;
      }
      if(mode==='ai'){
        return list.map(t=>{
          const id=Number(t.id);
          const prompt=this.warmTplContent(t,'ai');
          const preview=prompt.length>120?prompt.slice(0,120)+'…':prompt;
          return `<label class="warm-comment-tpl ${selected.has(id)?'is-on':''}">
            <input type="radio" name="commentAiTemplateId" value="${id}" ${selected.has(id)?'checked':''} onchange="app.markWarmCommentTpl(this)">
            <span class="warm-comment-tpl-body">
              <b>${this.esc(t.name||('模板 #'+id))}</b>
              <small>${this.esc(preview||'（无内容）')}</small>
            </span>
          </label>`;
        }).join('');
      }
      return list.map(t=>{
        const id=Number(t.id);
        const text=this.warmTplContent(t,'fixed');
        const preview=text.length>80?text.slice(0,80)+'…':text;
        return `<label class="warm-comment-tpl ${selected.has(id)?'is-on':''}">
          <input type="checkbox" name="commentTemplateIds" value="${id}" ${selected.has(id)?'checked':''} onchange="app.markWarmCommentTpl(this)">
          <span class="warm-comment-tpl-body">
            <b>${this.esc(t.name||('模板 #'+id))}</b>
            <small>${this.esc(preview||'（无内容）')}</small>
          </span>
        </label>`;
      }).join('');
    },
    setWarmCommentMode(mode){
      const m=mode==='ai'?'ai':'fixed';
      const fixedBox=document.querySelector('#warm-comment-fixed-box');
      const aiBox=document.querySelector('#warm-comment-ai-box');
      if(fixedBox)fixedBox.hidden=m!=='fixed';
      if(aiBox)aiBox.hidden=m!=='ai';
      document.querySelectorAll('input[name=commentMode]').forEach(el=>{el.checked=el.value===m});
      document.querySelectorAll('.warm-comment-cat').forEach(el=>{
        const input=el.querySelector('input[name=commentMode]');
        el.classList.toggle('is-on',!!(input&&input.value===m&&input.checked));
      });
    },
    markWarmCommentTpl(el){
      if(!el)return;
      const label=el.closest('.warm-comment-tpl');
      if(!label)return;
      if(el.type==='radio'){
        document.querySelectorAll('#warm-comment-ai-list .warm-comment-tpl').forEach(n=>n.classList.remove('is-on'));
        label.classList.add('is-on');
      }else{
        label.classList.toggle('is-on',!!el.checked);
      }
    },
    collectWarmCommentPayload(){
      const form=document.querySelector('#warm-create-form');
      const mode=(form?.querySelector('input[name=commentMode]:checked')?.value||'fixed')==='ai'?'ai':'fixed';
      const tpls=this._warmCommentTemplates||[];
      const byId=Object.fromEntries(tpls.map(t=>[Number(t.id),t]));
      if(mode==='ai'){
        const aiId=Number(form?.querySelector('input[name=commentAiTemplateId]:checked')?.value||0)||0;
        const row=byId[aiId];
        const prompt=this.warmTplContent(row,'ai');
        return {
          commentMode:'ai',
          commentTemplateIds:[],
          commentAiTemplateId:aiId,
          commentTexts:[],
          commentAiPrompt:prompt,
          commentText:'Nice video, loved it!',
        };
      }
      const ids=[...document.querySelectorAll('#warm-comment-fixed-list input[name=commentTemplateIds]:checked')]
        .map(el=>Number(el.value)).filter(Boolean);
      const texts=ids.map(id=>this.warmTplContent(byId[id],'fixed')).filter(Boolean);
      return {
        commentMode:'fixed',
        commentTemplateIds:ids,
        commentAiTemplateId:0,
        commentTexts:texts.length?texts:['很棒的视频，点赞'],
        commentAiPrompt:'',
        commentText:texts[0]||'很棒的视频，点赞',
      };
    },
    async submitWarmTask(autoStart){
      if(!this.canWarmTasks()){this.toast('当前角色无权管理养号任务',true);return}
      this.captureWarmCreateDraft?.();
      const form=document.querySelector('#warm-create-form');
      if(!form)return;
      if(!(await this.ensureBitOnline('自动养号')))return;
      const fd=new FormData(form);
      const d=Object.fromEntries(fd.entries());
      const draft=this._warmCreateDraft||{};
      const ids=this.selectedWarmAccountIds();
      const picked=ids.length?ids:(draft.accountIds||[]).map(Number).filter(Boolean);
      const searchTermsList=this.syncWarmSearchTermsValue();
      const searchTerms=searchTermsList.join('\n');
      if(!searchTerms){
        this.warmCreateStep=2;
        this.patchWarmCreateChrome?.(2);
        this.toast('请添加搜索词',true);
        return;
      }
      const groupRaw=d.groupId||draft.groupId||'';
      if(!picked.length&&!groupRaw){this.toast('请指定账号或选择账号分组',true);this.warmCreateStep=1;this.patchWarmCreateChrome?.(1);return}
      const num=(k,def)=>Number((d[k]!=null&&d[k]!==''?d[k]:draft[k])??def);
      const commentPayload=this.collectWarmCommentPayload();
      if(commentPayload.commentMode==='ai'&&!commentPayload.commentAiTemplateId&&!commentPayload.commentAiPrompt){
        this.warmCreateStep=2;
        this.patchWarmCreateChrome?.(2);
        this.toast('请选择一条 AI 评论模板',true);
        return;
      }
      if(commentPayload.commentMode==='fixed'&&!(commentPayload.commentTemplateIds||[]).length){
        this.warmCreateStep=2;
        this.patchWarmCreateChrome?.(2);
        this.toast('请至少勾选一条固定评论模板',true);
        return;
      }
      const payload={
        accountIds:picked.length?picked:undefined,
        searchType:'video',
        searchTerms,
        matchKeywords:'',
        videoCountMin:num('videoCountMin',10),
        videoCountMax:num('videoCountMax',10),
        followRate:num('followRate',0),
        likeRate:num('likeRate',0),
        favoriteRate:num('favoriteRate',0),
        viewCommentRate:num('viewCommentRate',0),
        commentRate:num('viewCommentRate',0),
        commentPages:num('commentPages',0),
        commentLikeRate:num('commentLikeRate',0),
        staySecondsMin:num('staySecondsMin',10),
        staySecondsMax:num('staySecondsMax',20),
        threadCount:num('threadCount',1),
        diagnoseAfterWarm:!!(form.querySelector('[name=diagnoseAfterWarm]')?.checked??draft.diagnoseAfterWarm),
        recurring:!!(form.querySelector('[name=recurring]')?.checked??draft.recurring),
        recurringDays:Math.max(1,Math.min(365,Number(form.querySelector('[name=recurringDays]')?.value||draft.recurringDays||1)||1)),
        ...commentPayload,
      };
      const prevPayload=this._warmEditSnapshot?.payload||{};
      if(payload.recurring){
        if(draft.recurringLastRunAt||prevPayload.recurringLastRunAt){
          payload.recurringLastRunAt=draft.recurringLastRunAt||prevPayload.recurringLastRunAt;
        }
        if(draft.recurringCycle!=null||prevPayload.recurringCycle!=null){
          payload.recurringCycle=Number(draft.recurringCycle??prevPayload.recurringCycle)||0;
        }
      }
      let totalCount=picked.length;
      const groupId=(!picked.length&&groupRaw)?Number(groupRaw):null;
      if(!totalCount&&groupId){
        totalCount=(this.groups||[]).find(g=>Number(g.id)===groupId)?.member_count
          ||(await this.api(`/accounts?pageSize=1&groupId=${groupId}`).catch(()=>({}))).total
          ||0;
      }
      const scheduledRaw=d.scheduledAt||draft.scheduledAt||'';
      const body={
        name:d.name||draft.name||'自动养号',
        type:'warm',
        groupId,
        totalCount:Number(totalCount)||0,
        scheduledAt:scheduledRaw?new Date(scheduledRaw).toISOString():null,
        payload,
      };
      try{
        const id=Number(d.id||draft.id||0);
        let taskId=id;
        if(id){
          await this.api(`/tasks/${id}`,{method:'PUT',body:JSON.stringify(body)});
          this.toast('养号任务已保存');
        }else{
          const created=await this.api('/tasks',{method:'POST',body:JSON.stringify(body)});
          taskId=created.id;
          this.toast(`养号任务 #${taskId} 已创建`);
        }
        if(autoStart&&taskId){
          await this.api(`/tasks/${taskId}/start`,{method:'POST'});
          this.toast(`养号任务 #${taskId} 已加入队列`);
        }
        this.warmPane='list';
        this.warmCreateStep=1;
        this.warmEditId=null;
        this._warmEditSnapshot=null;
        this._warmCreateDraft=null;
        this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    /** @deprecated 养号已抽离到独立页面，保留空实现防旧入口报错 */
    async warmAccountsModal(){
      this.toast('请从「账号池管理 → 自动养号」创建养号任务');
      this.openWarmCreate();
    },
  };
  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages["warm"] = true;
})();
