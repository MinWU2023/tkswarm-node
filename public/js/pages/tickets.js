(function () {
  if (!window.app) throw new Error('app-core must load before pages/tickets.js');
  const __methods = {
    canViewTickets(){return this.canPermission('system.tickets')||this.canPermission('system.view')||this.canPermission('rbac.manage')},
    canEditTickets(){return this.canPermission('system.tickets')||this.canPermission('rbac.manage')},
    async renderTickets(){
      const host=document.querySelector('#content');
      if(!host)return;
      if(!this.canViewTickets()){
        host.innerHTML=`<div class="panel"><div class="empty">当前角色无权处理工单</div></div>`;
        return;
      }
      const canEdit=this.canEditTickets();
      try{
        const q=this.ticketStatus?`?status=${encodeURIComponent(this.ticketStatus)}`:'';
        const rows=await this.api('/tickets'+q);
        const list=Array.isArray(rows)?rows:[];
        const kw=(this.ticketKeyword||'').trim().toLowerCase();
        const filtered=list.filter(t=>{
          if(!kw)return true;
          return String(t.subject||'').toLowerCase().includes(kw)
            || String(t.ticketNo||'').toLowerCase().includes(kw)
            || String(t.contactName||'').toLowerCase().includes(kw)
            || String(t.content||'').toLowerCase().includes(kw);
        });
        const pack=UI.paginateLocal(filtered,this.ticketPage||1,20);
        this.ticketPage=pack.page;
        const statusLabel={open:'待处理',replied:'已回复',closed:'已关闭',processing:'处理中'};
        const priLabel={low:'低',normal:'普通',high:'高',urgent:'紧急'};
        const st=String(this.ticketStatus||'');
        host.innerHTML=`
          <div class="panel list-panel">
            <div class="matrix-action-bar">
              <div class="left"><span class="muted">共 ${filtered.length} / ${list.length} 条工单 · 来自 TKSwarm Client</span></div>
            </div>
            <div class="search-bar task-filter-bar">
              <select id="ticket-status-filter" class="input" title="工单状态">
                <option value="">全部状态</option>
                <option value="open" ${st==='open'?'selected':''}>待处理</option>
                <option value="processing" ${st==='processing'?'selected':''}>处理中</option>
                <option value="replied" ${st==='replied'?'selected':''}>已回复</option>
                <option value="closed" ${st==='closed'?'selected':''}>已关闭</option>
              </select>
              <input id="ticket-search" class="input" type="search" placeholder="搜索工单号 / 主题 / 联系人" value="${this.esc(this.ticketKeyword||'')}" onkeydown="if(event.key==='Enter')app.searchTickets()">
              <button class="primary" type="button" onclick="app.searchTickets()">查询</button>
              <button class="ghost" type="button" onclick="app.resetTickets()">重置</button>
            </div>
            <div class="table-container">
              <table>
                <thead><tr><th>工单号</th><th>主题</th><th>联系人</th><th>优先级</th><th>状态</th><th>客户端</th><th>提交时间</th><th>操作</th></tr></thead>
                <tbody>
                  ${pack.items.length?pack.items.map(t=>`
                    <tr>
                      <td><b>${this.esc(t.ticketNo||('#'+t.id))}</b></td>
                      <td><b>${this.esc(t.subject)}</b><div class="muted" style="font-size:12px">${this.esc((t.content||'').slice(0,80))}</div></td>
                      <td>${this.esc(t.contactName||'-')}<div class="muted" style="font-size:12px">${this.esc(t.contactPhone||t.contactEmail||'')}</div></td>
                      <td>${this.esc(priLabel[t.priority]||t.priority)}</td>
                      <td>${this.badge(t.status==='open'?'checking':(t.status==='closed'?'offline':'online'))} <span class="muted">${this.esc(statusLabel[t.status]||t.status)}</span></td>
                      <td class="muted">${this.esc([t.clientPlatform,t.clientVersion].filter(Boolean).join(' ')||'-')}</td>
                      <td class="muted">${this.esc(t.createdAt||'-')}</td>
                      <td style="white-space:nowrap">
                        ${canEdit?`<button class="tiny" onclick="app.editTicketModalById(${t.id})">处理</button>
                        <button class="tiny danger" onclick="app.deleteTicket(${t.id},'${this.esc(t.ticketNo||t.id)}')">删除</button>`:'<span class="muted">只读</span>'}
                      </td>
                    </tr>`).join(''):`<tr><td colspan="8"><div class="empty">暂无工单</div></td></tr>`}
                </tbody>
              </table>
            </div>
            ${UI.pager(pack,'ticketPage')}
          </div>`;
      }catch(err){
        host.innerHTML=`<div class="panel list-panel"><div class="empty">加载失败: ${this.esc(err.message)}</div></div>`;
      }
    },
    searchTickets(){
      this.ticketStatus=document.querySelector('#ticket-status-filter')?.value||'';
      this.ticketKeyword=document.querySelector('#ticket-search')?.value?.trim()||'';
      this.ticketPage=1;
      this.refresh();
    },
    resetTickets(){
      this.ticketStatus='';
      this.ticketKeyword='';
      this.ticketPage=1;
      this.refresh();
    },
    editTicketModal(t={}){
      if(!this.canEditTickets()){this.toast('当前角色无权处理工单',true);return}
      this.modal('处理工单 '+this.esc(t.ticketNo||('#'+t.id)),`
        <div class="form-grid">
          <input type="hidden" name="id" value="${t.id||''}">
          <div class="field full"><div class="muted"><b>主题：</b>${this.esc(t.subject||'')}</div>
            <div style="margin-top:8px;white-space:pre-wrap;background:#f8fafc;padding:10px;border-radius:8px">${this.esc(t.content||'')}</div>
            <div class="muted" style="margin-top:8px">联系：${this.esc([t.contactName,t.contactPhone,t.contactEmail].filter(Boolean).join(' / ')||'-')}</div>
          </div>
          ${this.selectRaw('status','状态',[['open','待处理'],['processing','处理中'],['replied','已回复'],['closed','已关闭']],t.status||'open')}
          ${this.selectRaw('priority','优先级',[['low','低'],['normal','普通'],['high','高'],['urgent','紧急']],t.priority||'normal')}
          ${this.field('reply','回复内容',t.reply||'','textarea')}
        </div>
      `,async(d)=>{
        const id=d.id; delete d.id;
        await this.api(`/tickets/${id}`,{method:'PUT',body:JSON.stringify(d)});
        this.toast('工单已更新');
        this.closeModal();
        this.refresh();
      });
    },
    async editTicketModalById(id){
      if(!this.canEditTickets()){this.toast('当前角色无权处理工单',true);return}
      try{
        const t=await this.api(`/tickets/${id}`);
        if(!t){this.toast('工单不存在',true);return;}
        this.editTicketModal(t);
      }catch(e){this.toast(e.message,true);}
    },
    async deleteTicket(id,no){
      if(!this.canEditTickets()){this.toast('当前角色无权删除工单',true);return}
      if(!(await this.ask(`确定删除工单 ${no} 吗？`,'danger')))return;
      try{
        await this.api(`/tickets/${id}`,{method:'DELETE'});
        this.toast('工单已删除');
        this.refresh();
      }catch(e){this.toast(e.message,true);}
    },
  };
  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages["tickets"] = true;
})();
