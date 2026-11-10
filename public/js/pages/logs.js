(function () {
  if (!window.app) throw new Error('app-core must load before pages/logs.js');
  const __methods = {
    renderLiveLogs(){
      const el=document.querySelector('#live-operation-logs');
      if(!el)return;
      const filter = this.logLevelFilter || 'all';
      const kw = (this.logKeyword || '').trim().toLowerCase();
      const filtered = this.liveLogs.filter(x => {
        if(filter !== 'all' && x.level !== filter) return false;
        if(kw && !(x.message||'').toLowerCase().includes(kw) && !(x.module||'').toLowerCase().includes(kw)) return false;
        return true;
      });
      if(!filtered.length){
        el.innerHTML = '<div class="empty" style="padding:48px 16px">暂无符合条件的实时操作日志…</div>';
        return;
      }
      el.innerHTML = filtered.map((x, idx) => {
        const level = x.level || 'info';
        const timeStr = x.time ? new Date(x.time).toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-';
        const dateStr = x.time ? new Date(x.time).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) : '';
        return `
          <div class="log-stream-row event-${this.esc(level)}">
            <div class="log-row-left">
              <span class="log-index">#${filtered.length - idx}</span>
              <span class="log-tag log-tag-${this.esc(level)}">${this.esc(level.toUpperCase())}</span>
              <span class="log-time">${this.esc(dateStr)} ${this.esc(timeStr)}</span>
            </div>
            <div class="log-msg">${this.esc(x.message || '')}</div>
          </div>
        `;
      }).join('');
    },
    async renderLogs(){
      document.querySelector('#content').classList.remove('chat-mode');
      if(!this.canPermission('logs.view')&&!this.canPermission('account.view')&&!this.canPermission('rbac.manage')&&!this.canPermission('rbac.log')){
        document.querySelector('#content').innerHTML=`<div class="panel"><div class="empty">当前角色无权查看实时操作日志</div></div>`;
        return;
      }
      const filter = this.logLevelFilter || 'all';
      const totalCount = this.liveLogs.length;
  
      document.querySelector('#content').innerHTML = `
        <div class="panel log-standalone-panel" style="margin:0;height:calc(100vh - 64px - 40px);display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden">
          <div class="matrix-action-bar" style="margin-bottom:12px;flex-shrink:0">
            <div class="left">
              <div class="status-tags" style="margin:0">
                <button type="button" class="status-tag ${filter==='all'?'active':''}" onclick="app.setLogLevelFilter('all')">全部日志 <b>${totalCount}</b></button>
                ${(this.meta?.logLevels?.length?this.meta.logLevels:[{code:'info',label:'信息 (INFO)'},{code:'warn',label:'警告 (WARN)'},{code:'error',label:'异常 (ERROR)'}]).map(x=>`<button type="button" class="status-tag ${filter===x.code?'active':''}" onclick="app.setLogLevelFilter('${x.code}')">${this.esc(x.label)} <b>${this.liveLogs.filter(l=>l.level===x.code).length}</b></button>`).join('')}
              </div>
            </div>
            <div class="right" style="display:flex;gap:8px;align-items:center">
              <input class="input" id="log-search-input" placeholder="搜索日志关键词..." value="${this.esc(this.logKeyword||'')}" oninput="app.searchLiveLogs(this.value)" style="width:200px;height:32px;font-size:12px">
              <button class="ghost tiny" onclick="app.clearLiveLogs()">清屏日志</button>
              <button class="ghost tiny" onclick="app.refreshLiveLogSocket()">重连管道</button>
            </div>
          </div>
          <div class="log-stream-header">
            <div class="log-stream-status">
              <span class="live-dot ${this.ws&&this.ws.readyState===1?'online':'connecting'}"></span>
              <b>${this.ws&&this.ws.readyState===1?'WebSocket 链路已连接，正在监听系统动作与群控调度':'通道重连中…'}</b>
            </div>
            <span class="muted">内存环形缓冲区保持最多 500 条实时日志</span>
          </div>
          <div id="live-operation-logs" class="log-stream-container"></div>
        </div>
      `;
      this.renderLiveLogs();
    },
    setLogLevelFilter(level){
      this.logLevelFilter = level;
      this.renderLogs();
    },
    searchLiveLogs(val){
      this.logKeyword = val;
      this.renderLiveLogs();
    },
    clearLiveLogs(){
      this.liveLogs = [];
      this.renderLiveLogs();
      this.toast('实时日志已清屏');
    },
    refreshLiveLogSocket(){
      if(this.ws){
        try{this.ws.close();}catch{}
      }
      this.connectLiveLogs();
      this.renderLogs();
      this.toast('日志通道已重新连接');
    },
    async renderDashboard(){const [s,a]=await Promise.all([this.api('/dashboard/stats'),this.api('/dashboard/activity')]);document.querySelector('#content').innerHTML=`<div class="stats">
      ${this.stat('账号总数',s.accounts,`${s.onlineAccounts} 个在线`,'#eeeafe')}${this.stat('代理资源',s.proxies,`${s.availableProxies} 个可用`,'#e8f8f1')}${this.stat('任务总数',s.tasks,`${s.runningTasks} 个执行中`,'#fff6df')}${this.stat('服务状态','正常','WebSocket 已启用','#e7f3ff')}</div>
      <div class="panel"><div class="panel-head"><h2>实时操作日志</h2><span class="muted">WebSocket 实时</span></div><div id="live-operation-logs" class="task-events" style="max-height:260px;overflow:auto"></div></div><div class="panel"><div class="panel-head"><h2>最近任务</h2><button class="ghost" onclick="app.navigate('tasks')">查看全部</button></div><div class="activity">${a.length?a.map(x=>`<div class="activity-row"><div><b>${this.esc(x.name)}</b><div class="muted">${this.esc(x.type)} · ${this.esc(x.updated_at)}</div></div>${this.badge(x.status)}</div>`).join(''):'<div class="empty">暂无任务，请从任务中心创建</div>'}</div></div>`},
  };
  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages["logs"] = true;
})();
