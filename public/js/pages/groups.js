(function () {
  if (!window.app) throw new Error('app-core must load before pages/groups.js');
  const __methods = {
    async renderGroups(opts={}){
      const still=typeof opts.still==='function'?opts.still:()=>this.view==='groups';
      await this.ensureGroups();
      if(!still())return;
      const type=this.groupType||'account';
      const tabs=(this.meta?.groupTypes||[]).filter(x=>['account','proxy','message'].includes(x.code));
      const tabList=tabs.length?tabs:[{code:'account',label:'账号分组'},{code:'proxy',label:'代理分组'},{code:'message',label:'消息分组'}];
      const label=this.groupTypeLabel(type);
      const pack=this.groupTablePack(type);
      document.querySelector('#content').innerHTML=`<div class="panel">
        <div class="group-tabs">${tabList.map(t=>`<button class="${type===t.code?'active':''}" onclick="app.switchGroupType('${t.code}')">${this.esc(t.label)}</button>`).join('')}</div>
        <div class="toolbar"><span class="muted">${this.esc(label)}独立管理，不会与其他资源类型混用。</span>
          <div style="display:flex;gap:8px">${this.canPermission('group.manage')?`<button class="primary" onclick="app.groupModal('${type}')">+ 添加${this.esc(label)}</button>`:''}${type==='account'&&this.canPermission('group.manage')?`<button class="ghost" onclick="app.groupModal('account')">+ 添加一级分组</button>`:''}</div>
        </div>
        ${pack.html}
        ${UI.pager(pack,'groupPage')}
      </div>`;
    },
    switchGroupType(type){this.groupType=type;this.groupPage=1;this.refresh()},
    groupTablePack(type){
      const short=this.groupTypeLabel(type,true),full=this.groupTypeLabel(type);
      let rows=this.groups.filter(x=>x.type===type);
      if(type==='account'){
        const roots=rows.filter(x=>!x.parent_id);
        const kids=rows.filter(x=>x.parent_id);
        const ordered=[];
        for(const r of roots){
          ordered.push({...r, _depth:0});
          for(const c of kids.filter(k=>Number(k.parent_id)===Number(r.id))) ordered.push({...c, _depth:1});
        }
        for(const c of kids){ if(!ordered.some(o=>Number(o.id)===Number(c.id))) ordered.push({...c,_depth:1}); }
        rows=ordered;
      }
      const pack=UI.paginateLocal(rows,this.groupPage||1,20);
      this.groupPage=pack.page;
      const html=pack.items.length?`<table><thead><tr><th>分组名称</th><th>层级</th><th>资源类型</th><th>资源数量</th><th>说明</th><th>创建时间</th><th>操作</th></tr></thead><tbody>${pack.items.map(x=>`<tr><td><b>${x._depth?('　└ '+this.esc(x.name)):this.esc(x.name)}</b></td><td>${x.parent_id?'公司子组':'一级分组'}</td><td>${this.esc(short)}</td><td>${x.member_count||0}</td><td>${this.esc(x.description||'-')}</td><td>${x.created_at}</td><td><button class="tiny" onclick="app.editGroup(${x.id})">编辑</button>${type==='account'&&!x.parent_id?`<button class="tiny" onclick="app.groupModal('account',{parent_id:${x.id}})">加子组</button>`:''}<button class="tiny danger" onclick="app.remove('/groups/${x.id}','${this.esc(full)}')">删除</button></td></tr>`).join('')}</tbody></table>`:`<div class="empty">还没有${this.esc(full)}</div>`;
      return {...pack,html};
    },
    groupTable(type){return this.groupTablePack(type).html},
    editGroup(id){const x=this.groups.find(item=>item.id===id);if(x)this.groupModal(x.type,x)},
    groupModal(type=this.groupType,x={}){
      if(!this.canPermission('group.manage')){this.toast('当前角色无权管理分组',true);return}
      const label=this.groupTypeLabel(type,true);
      const parents=(this.groups||[]).filter(g=>g.type==='account'&&!g.parent_id&&Number(g.id)!==Number(x.id));
      const parentField=type==='account'
        ? this.select('parentId','上级分组（空=一级；选中后为公司子组）',parents,x.parent_id||'')
        : '';
      this.modal(x.id?`编辑${label}分组`:`添加${label}分组`,`<div class="form-grid"><input type="hidden" name="id" value="${x.id||''}"><input type="hidden" name="type" value="${type}">${this.field('name','分组名称',x.name||'', 'text',true)}${parentField}<div class="field"><label>资源类型</label><input class="input" value="${this.esc(this.groupTypeLabel(type))}" disabled></div>${this.field('description','说明',x.description||'', 'textarea')}${type==='account'?`<div class="field full"><div class="muted">账号可挂到公司子组；点一级分组筛选时会包含其下全部子公司账号。</div></div>`:''}</div>`,async d=>{
        const id=d.id;delete d.id;
        if(type==='account'){
          d.parentId=d.parentId?Number(d.parentId):null;
        } else {
          delete d.parentId;
        }
        await this.api(id?`/groups/${id}`:'/groups',{method:id?'PUT':'POST',body:JSON.stringify(d)});
        this.toast(id?'分组已更新':'分组已添加');
        this.closeModal();
        await this.loadRefs();
        this.refresh();
      });
    },
  };
  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages["groups"] = true;
})();
