const app = {
  view: 'accounts', meta: null, groups: [], proxies: [], materials: [], templates: [], groupType: 'account', taskRefreshTimer: null, warmRefreshTimer: null, warmPane: 'list', warmPage: 1, warmKeyword: '', warmStatusFilter: '', warmEditId: null, accountPane: 'list', accountIoTab: 'export', accountGroupId: '', accountCapcut: '', accountSession: '', accountPage: 1, accountKeyword: '', accountStatus: '', proxyGroupId: '', proxyPage: 1, proxyPane: 'list', proxyIoTab: 'export', proxyKeyword: '', proxyStatus: '', materialPage: 1, materialKeyword: '', materialStatus: '', materialPublishStatus: '', materialTags: '', uidPage: 1, agentPage: 1, templatePage: 1, taskPage: 1, massPage: 1, groupPage: 1, rbacPermPage: 1, rbacRolePage: 1, rbacRoleKeyword: '', rbacRoleStatus: '', rbacUserPage: 1, rbacUserKeyword: '', rbacUserStatus: '', rbacLogPage: 1, rbacLogKeyword: '', rbacMenuPage: 1, rbacMenuKeyword: '', rbacMenuVisible: '', helpDocPage: 1, helpCatPage: 1, helpDocsTab: 'docs', helpDocsCatId: '', helpDocKeyword: '', helpDocStatus: '', helpCatKeyword: '', ticketPage: 1, ticketStatus: '', ticketKeyword: '', versionPage: 1, versionKeyword: '', versionChannel: '', versionStatus: '', browserPage: 1, matrixTab: 'tasks', wizardOpen: false, wizardStep: 1, wizard: {}, massWizardOpen: false, mass: {step:1,massChannel:'bit'}, uidGroupId: '', uidKeyword: '', chatPane: 'workbench',
  chatAccountId: null, chatFriendId: null, chatFilter: 'all', chatKeyword: '', scriptGroupId: '',
  agentId: null, agentForm: null, agentKeyword: '', agentTab: 'basic', testChat: [],
  titles: {accounts:['账号管理','维护 TikTok 账号、分组与浏览器环境'],groups:['分组管理','账号分组与公司子组的增删改查'],warm:['自动养号','按任务创建养号配置，批量执行刷互动养号'],proxies:['代理IP','管理代理池并检测连通性'],agent:['AI机器人','配置智能体、终止条件与测试聊天'],publish:['AI矩阵','创建并执行视频发布任务'],chat:['客服聊天','多账号聚合私信'],uids:['UID好友','客服群发目标 UID 池，按分组导入与维护'],logs:['实时操作日志','WebSocket 实时链路与系统级动作事件流'],rbac:['权限管理','权限节点、角色、管理员与审计菜单'],settings:['基础设置','配置浏览器、任务、发布确认与翻译'],versions:['版本控制','上传与管理客服客户端代码包，供 EXE 下载安装'],helpDocs:['帮助文档','维护客户端帮助分类与文档内容'],tickets:['工单处理','查看并回复客服客户端提交的工单反馈'],envInstallers:['环境安装包','管理 Node / 比特等本机环境安装包'],aiPlatform:['AI开放平台','配置国内外 AI 平台与多套开发密钥，启用全局调用配置'],aiPromptTemplates:['AI提示词模板','维护提示词模板，支持不同模板的 {{变量}} 占位与渲染预览'],aiCallLogs:['AI记录','查看 AI 平台调用日志：平台、配置、用户、操作、体积与请求响应'],system:['系统管理','基础设置、版本、环境安装包、AI开放平台、帮助与工单']},
  async api(path, options={}) {
    let apiBase = window.TKSWARM_API_BASE || window.__TKSWARM_CONFIG__?.defaultApiBase || 'http://tkswarm-api.dyyweb.com';
    // 仅比特自动化 / 本机能力走同源 Node；业务数据一律走线上 PHP
    const useLocalNode = /^\/(browser|system|audio|uploads)(\/|$)/.test(path)
      || /^\/accounts\/monitor\/run$/.test(path)
      || /^\/chat\/messages\/bit-send(\/|$)/.test(path)
      || /\/items\/\d+\/(resume-publish|confirm-published)$/.test(path);
    if (useLocalNode) apiBase = '';
    const headers=options.body instanceof FormData?{...(options.headers||{})}:{'Content-Type':'application/json',...(options.headers||{})};
    if(this.authToken) headers.Authorization='Bearer '+this.authToken;
    const actingAs = this.getActingAsId();
    if(actingAs && !useLocalNode) headers['X-Acting-As'] = String(actingAs);
    let r;
    try {
      r = await fetch(apiBase+'/api'+path, {...options, headers});
    } catch (netErr) {
      // 业务接口不再静默降级到本机 Node，避免误打 127.0.0.1
      if (useLocalNode) {
        throw new Error(`网络连接失败: ${netErr.message || 'Failed to fetch'}`);
      }
      throw new Error(`连接线上接口 (${apiBase}) 失败: ${netErr.message || 'Failed to fetch'}。请检查跨域、域名与 PHP 站点配置`);
    }

    const j=await r.json().catch(()=>({success:false,message:'响应无效'}));
    if(r.status===401){
      // 如果已经在登录界面，直接抛出业务错误，不要隐藏/重建登录窗口导致消息一闪而过
      if(document.body.classList.contains('in-auth-mode') || document.querySelector('#auth-gate')){
        throw new Error(j.message || '用户名或密码错误');
      }
      this.authToken='';
      localStorage.removeItem('tkswarm_token');
      this.showLoginGate(j.message||'请先登录');
      throw new Error(j.message||'未登录');
    }
    if(!r.ok||!j.success) throw new Error(j.message||'请求失败');
    return j.data;
  },
  esc(v=''){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))},
  badge(status){const map=this.meta?.statusLabels||{online:'在线',offline:'离线',expired:'已过期',checking:'检查中',connecting:'连接中',available:'可用',unavailable:'不可用',unchecked:'未检测',draft:'草稿',queued:'排队中',running:'运行中',paused:'已暂停',completed:'已完成',failed:'失败',cancelled:'已取消',success:'成功',skipped:'跳过',pending:'待发布',publishing:'发布中',error:'异常'};return `<span class="badge ${status}">${map[status]||this.esc(status)}</span>`},
  toast(message,error=false,duration=2000){
    const type=error===true?'error':(typeof error==='string'?error:'success');
    const titles={success:'操作成功',error:'操作失败',warn:'请注意',info:'提示'};
    if(window.UI){
      UI.notify({
        type:titles[type]?type:'info',
        title:titles[type]||'提示',
        message:String(message||''),
        duration:duration||2000
      });
    }
  },
  async ask(message,type='warn'){return UI.confirm({title:type==='error'?'危险操作':'请确认操作',message:String(message||''),type:type==='error'?'error':'warn'})},
  async downloadAuth(url,filename,emptyMsg){const headers={};if(this.authToken)headers.Authorization='Bearer '+this.authToken;const acting=this.getActingAsId();if(acting)headers['X-Acting-As']=String(acting);const r=await fetch(url,{headers});if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.message||'下载失败')}const buf=await r.arrayBuffer();if(!buf.byteLength){this.toast(emptyMsg||'没有可下载内容',true);return false}const blob=new Blob([buf]);const a=document.createElement('a');const href=URL.createObjectURL(blob);a.href=href;a.download=filename||'download.bin';a.click();URL.revokeObjectURL(href);return true},
  async ensureBitOnline(actionLabel='该操作'){try{const st=await this.api('/browser/status');if(st?.online){this._bitOnlineAt=Date.now();return st}const tip=(st?.message||'请先启动比特并确认本地 API')+`（当前：${st?.apiUrl||'http://127.0.0.1:54345'}）。打开主程序后还需在设置中开启本地 API。`;this.toast((actionLabel||'该操作')+'需要比特浏览器在线。'+tip,true,5000);return null}catch(e){this.toast((actionLabel||'该操作')+'前检测比特失败：'+(e.message||'未连接'),true,5000);return null}},
  async ensureNodeOnline(actionLabel='该操作'){const ok=await this.probeNodeOnline();if(ok)return ok;this.toast((actionLabel||'该操作')+'需要本机 Node 在线（发布/群发/养号/粉丝同步由 Node 执行）。',true);return null},
  async probeNodeOnline(){try{const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),2500);const r=await fetch('/api/system/info',{signal:ctrl.signal,headers:this.authToken?{Authorization:'Bearer '+this.authToken}:{}});clearTimeout(t);if(!r.ok)return null;const j=await r.json().catch(()=>({}));if(j&&j.success===false)return null;this._nodeOnlineAt=Date.now();return j.data||j||{online:true}}catch{return null}},
  nodeOwnedTaskHint(status,type){const nodeTypes=['publish','message','warm','sync_fans','dm_sync','sync','profile'];if(status==='queued'&&nodeTypes.includes(type))return ' <span class="muted" title="等待本机 Node task-runner">·等待本机Node</span>';return ''},
  setPage(key,page){
    const n=Math.max(1,Number(page)||1);
    if(key==='materialPickerPage'){
      this.setMaterialPickerPage?.(n);
      return;
    }
    this[key]=n;
    this.refresh();
  },
  jumpPage(key){
    const el=document.querySelector(`#pager-jump-${key}`)||document.querySelector(`.pager[data-page-key="${key}"] .pager-jump-input`);
    let n=Number(el?.value||1);
    const max=Math.max(1,Number(el?.getAttribute('max')||1));
    if(!Number.isFinite(n)||n<1)n=1;
    if(n>max)n=max;
    if(el)el.value=String(n);
    this.setPage(key,n);
  },
  async init(){
    document.addEventListener('click',(e)=>{
      if (e.target.closest?.('.dropdown-menu button, .user-dropdown-menu button')) {
        document.querySelectorAll('.dropdown-menu, .user-dropdown-menu').forEach(el=>{
          el.classList.add('hidden');
          if (window.UI) UI.restoreMenu(el);
        });
        document.querySelector('#user-menu-trigger')?.classList.remove('active');
        return;
      }
      if (!e.target.closest?.('.ops-dropdown, .dropdown, .dropdown-menu.is-lifted')) {
        document.querySelectorAll('.dropdown-menu').forEach(el=>{
          el.classList.add('hidden');
          if (window.UI) UI.restoreMenu(el);
        });
      }
      if (!e.target.closest?.('#user-dropdown-wrap')) {
        document.querySelector('#user-dropdown-panel')?.classList.add('hidden');
        document.querySelector('#user-menu-trigger')?.classList.remove('active');
      }
      if (window.UI) UI.syncMenus();
    });
    this.liveLogs=[];
    this.authToken=localStorage.getItem('tkswarm_token')||'';
    this.tickClock();
    setInterval(()=>this.tickClock(),1000);

    // 顶栏菜单：捕获阶段 mousedown，避免三级飞出层 hover/pointer-events 间隙导致点击穿透
    const navEl=document.querySelector('#nav');
    if(navEl){
      const handleNav=e=>{
        const leaf=e.target.closest&&e.target.closest('[data-nav-view]');
        if(leaf){
          // 只在 mousedown 导航；click 交给防抖吞掉，避免点穿后再点一次
          if(e.type!=='mousedown')return;
          if(e.button!==0)return;
          // 有下级飞出面板的父级（如「视频发布向导」）只展开，不跳转，以免冲掉子菜单
          const wrap=leaf.parentElement;
          const hasKids=!!(wrap&&wrap.querySelector(':scope > .nav-dropdown-lvl2, :scope > .nav-dropdown-lvl3, :scope > .nav-dropdown-lvl4'));
          if(hasKids&&!leaf.classList.contains('nav-root-btn')){
            e.stopPropagation();
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          this.dispatchMenuClick(leaf.getAttribute('data-nav-view')||'', leaf.getAttribute('data-nav-sub')||'', e);
          return;
        }
        if(e.type==='click'){
          const b=e.target.closest&&e.target.closest('[data-view]');
          if(b)this.navigate(b.dataset.view);
        }
      };
      navEl.addEventListener('mousedown', handleNav, true);
      navEl.addEventListener('click', handleNav, true);
      navEl.onclick=null;
    }

    // EXE 启动后通过 ?loginToken= 自动登录
    try{
      const params=new URLSearchParams(location.search||'');
      const loginToken=(params.get('loginToken')||'').trim();
      if(loginToken){
        this.authToken=loginToken;
        localStorage.setItem('tkswarm_token',loginToken);
        params.delete('loginToken');
        const qs=params.toString();
        history.replaceState({},'',location.pathname+(qs?'?'+qs:'')+(location.hash||''));
      }
    }catch{}

    // 支持 URL Hash / 路径直接访问登录页（例如 #login、?login=1 或 /login）
    // 注意：不可用 includes('login')，否则会误伤 loginToken
    {
      const params=new URLSearchParams(location.search||'');
      const path=(location.pathname||'').replace(/\/+$/,'');
      if(location.hash==='#login'||params.has('login')||path.endsWith('/login')){
        this.showLoginGate();
        return false;
      }
    }

    const ready=await this.ensureAuth();
    if(!ready)return false;
    this.connectLiveLogs();
    await Promise.all([this.loadMeta(), this.loadRefs(), this.loadNavigationMenus()]);
    try{
      const st=await this.api('/settings');
      this.notificationSound=st.notificationSound||'chime';
      this.notificationSync=st.notificationSync!==false;
      this.clockTimezone=st.clockTimezone||'Asia/Shanghai';
    }catch{}
    // 首屏路由由 TkRouter.start 根据 location.hash 负责
    return true;
  },
  async loadNavigationMenus(){
    try{
      const tree=await this.api('/menus/tree');
      if(Array.isArray(tree)&&tree.length){
        this.navTree=tree;
        this.renderNavbarMenu(tree);
      }
    }catch(err){
      console.warn('Failed to load menu tree from database, keeping fallback navigation', err);
    }
  },
  navMenuIcon(item){
    const name=String(item?.icon||'').trim()||this.guessNavIcon(item);
    if(window.UI&&typeof UI.icon==='function')return `<span class="nav-ico" aria-hidden="true">${UI.icon(name)}</span>`;
    return `<span class="nav-ico" aria-hidden="true"></span>`;
  },
  guessNavIcon(item){
    const t=String(item?.title||'');
    const v=String(item?.view||'');
    if(/账号|用户/.test(t)||v==='accounts')return 'user';
    if(/代理|网络/.test(t)||v==='proxies')return 'globe';
    if(/机器人|智能体|agent/i.test(t)||v==='agent')return 'bot';
    if(/矩阵|发布|视频|素材/.test(t)||v==='publish'||v==='materials')return 'video';
    if(/客服|聊天|会话/.test(t)||v==='chat')return 'message';
    if(/权限|角色|审计/.test(t)||v==='rbac')return 'shield';
    if(/系统管理|设置|版本|工单|帮助|安装包|开放平台|AI平台|提示词|AI记录/.test(t)||v==='settings'||v==='versions'||v==='helpDocs'||v==='tickets'||v==='envInstallers'||v==='aiPlatform'||v==='aiPromptTemplates'||v==='aiCallLogs')return 'settings';
    if(/日志/.test(t)||v==='logs')return 'file-text';
    if(/分组/.test(t)||v==='groups')return 'folder';
    if(/养号|warm/i.test(t)||v==='warm')return 'activity';
    if(/导入/.test(t))return 'upload';
    if(/导出|下载/.test(t))return 'download';
    if(/列表/.test(t))return 'list';
    if(/新建|创建|添加/.test(t))return 'plus';
    return 'menu';
  },
  isRemovedNavItem(item){
    const t=String(item?.title||'');
    const s=String(item?.subview||'');
    return s==='qr'||t==='扫码登录';
  },
  filterNavTree(nodes){
    return (Array.isArray(nodes)?nodes:[]).filter(n=>!this.isRemovedNavItem(n)).map(n=>{
      const children=this.filterNavTree(n.children||[]);
      return {...n, children};
    });
  },
  renderNavbarMenu(tree){
    const nav=document.querySelector('#nav');
    if(!nav)return;
    tree=this.filterNavTree(tree);
    nav.innerHTML=tree.map(root=>{
      const hasLvl2=root.children&&root.children.length>0;
      const rootActive=this.view===root.view
        ||(root.view==='accounts'&&['warm','groups'].includes(this.view))
        ||(root.view==='settings'&&['versions','helpDocs','tickets','envInstallers','aiPlatform','aiPromptTemplates','aiCallLogs'].includes(this.view));
      return `<div class="nav-item-root ${rootActive?'active':''}" data-root-id="${root.id}">
        <button type="button" class="nav-root-btn ${rootActive?'active':''}" data-nav-view="${this.esc(root.view)}" data-nav-sub="${this.esc(root.subview||'')}" onclick="app.dispatchMenuClick('${this.esc(root.view)}','${this.esc(root.subview||'')}',event)">
          ${this.navMenuIcon(root)}
          <span class="nav-label">${this.esc(root.title)}</span>
          ${hasLvl2?'<span class="nav-arrow">▾</span>':''}
        </button>
        ${hasLvl2?`<div class="nav-dropdown-lvl2">
          ${root.children.map(lvl2=>{
            const hasLvl3=lvl2.children&&lvl2.children.length>0;
            return `<div class="nav-item-lvl2">
              <button type="button" class="nav-sub-btn" data-nav-view="${this.esc(lvl2.view||root.view)}" data-nav-sub="${this.esc(lvl2.subview||'')}" onclick="app.dispatchMenuClick('${this.esc(lvl2.view||root.view)}','${this.esc(lvl2.subview||'')}',event)">
                <span class="sub-title-wrap">${this.navMenuIcon(lvl2)}<span class="nav-label">${this.esc(lvl2.title)}</span></span>
                ${hasLvl3?'<span class="sub-arrow">▸</span>':''}
              </button>
              ${hasLvl3?`<div class="nav-dropdown-lvl3">
                ${lvl2.children.map(lvl3=>{
                  const hasLvl4=lvl3.children&&lvl3.children.length>0;
                  const v3=lvl3.view||lvl2.view||root.view;
                  return `<div class="nav-item-lvl3 ${hasLvl4?'has-children':''}">
                    <button type="button" class="nav-leaf-btn ${hasLvl4?'has-sub':''}" data-nav-view="${this.esc(v3)}" data-nav-sub="${this.esc(lvl3.subview||'')}" onclick="app.dispatchMenuClick('${this.esc(v3)}','${this.esc(lvl3.subview||'')}',event)">
                      <span class="sub-title-wrap">${this.navMenuIcon(lvl3)}<span class="nav-label">${this.esc(lvl3.title)}</span></span>
                      ${hasLvl4?'<span class="sub-arrow">▸</span>':''}
                    </button>
                    ${hasLvl4?`<div class="nav-dropdown-lvl4">
                      ${lvl3.children.map(lvl4=>{
                        const v4=lvl4.view||v3;
                        return `<div class="nav-item-lvl4">
                          <button type="button" class="nav-leaf-btn" data-nav-view="${this.esc(v4)}" data-nav-sub="${this.esc(lvl4.subview||'')}" onclick="app.dispatchMenuClick('${this.esc(v4)}','${this.esc(lvl4.subview||'')}',event)">
                            ${this.navMenuIcon(lvl4)}
                            <span class="nav-label">${this.esc(lvl4.title)}</span>
                          </button>
                        </div>`;
                      }).join('')}
                    </div>`:''}
                  </div>`;
                }).join('')}
              </div>`:''}
            </div>`;
          }).join('')}
        </div>`:''}
      </div>`;
    }).join('');
  },
  dispatchMenuClick(view, subview='', event){
    if(event){try{event.preventDefault();event.stopPropagation()}catch{}}
    view=String(view||'').trim();
    subview=String(subview||'').trim();
    if(!view){console.warn('[nav] empty view', subview);return}
    const key=view+'|'+subview;
    const now=Date.now();
    if(this._navClickKey===key&&(now-(this._navClickAt||0))<450)return;
    this._navClickKey=key;this._navClickAt=now;
    clearTimeout(this._matrixSoftTimer);
    this._matrixSwitchGen=(this._matrixSwitchGen||0)+1;
    this.navigate(view, subview);
  },
  tickClock(){
    const el=document.querySelector('#clock');
    if(!el)return;
    try {
      const now = new Date();
      const tz = this.clockTimezone || 'Asia/Shanghai';
      const timeStr = now.toLocaleTimeString('zh-CN', { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateParts = new Intl.DateTimeFormat('zh-CN', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(now);
      const partMap = {};
      dateParts.forEach(p => { partMap[p.type] = p.value; });
      const dateStr = `${partMap.year || now.getFullYear()}-${partMap.month || ('0' + (now.getMonth() + 1)).slice(-2)}-${partMap.day || ('0' + now.getDate()).slice(-2)}`;
      const weekday = partMap.weekday || ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];
      const zone = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'short' }).formatToParts(now).find(p => p.type === 'timeZoneName')?.value || tz;
      el.innerHTML = `
        <span class="clock-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        </span>
        <div class="clock-stacked">
          <div class="clock-time-line">
            <span class="clock-time">${timeStr}</span>
            <span class="clock-weekday">${weekday}</span>
          </div>
          <div class="clock-date-line">
            <span class="clock-date">${dateStr}</span>
            <span class="clock-zone">${zone}</span>
          </div>
        </div>
      `;
    } catch {
      el.textContent = new Date().toLocaleTimeString('zh-CN');
    }
  },
  getActingAsId(){
    const raw=localStorage.getItem('tkswarm_acting_as')||'';
    if(!raw||raw==='0'||raw==='self')return null;
    const n=Number(raw);
    return Number.isFinite(n)&&n>0?n:null;
  },
  async ensureAuth(){try{const st=await this.api('/auth/status');this.authEnabled=!!st.authEnabled;this.authUser=st.user;this.authPermissions=Array.isArray(st.user?.permissions)?st.user.permissions:(Array.isArray(st.permissions)?st.permissions:[]);this.authChildren=Array.isArray(st.children)?st.children:[];this.authIsSuper=!!(st.isSuper||st.user?.isSuper);this.authActingAs=st.actingAs||null;const want=this.getActingAsId();if(want&&!st.actingAs){localStorage.removeItem('tkswarm_acting_as')}if(st.needsSetup){this.showSetupGate();return false}if(st.authEnabled&&!st.authenticated){this.showLoginGate();return false}this.hideAuthGate();this.renderUserChip();this.renderScopeSwitcher();return true}catch(e){this.toast(e.message,true);return true}},
  renderScopeSwitcher(){
    let box=document.querySelector('#scope-switcher');
    if(!box){
      box=document.createElement('div');
      box.id='scope-switcher';
      box.className='scope-switcher';
      document.body.appendChild(box);
    }
    const self=this.authUser;
    if(!self||!self.id){
      box.classList.add('hidden');
      box.innerHTML='';
      return;
    }
    const children=this.authChildren||[];
    const acting=this.authActingAs;
    const actingId=this.getActingAsId();
    const show=this.authIsSuper||children.length>0;
    if(!show){
      box.classList.add('hidden');
      box.innerHTML='';
      return;
    }
    box.classList.remove('hidden');
    const selfLabel=this.esc(self.nickname||self.username||'本人');
    const currentLabel=acting
      ? `子账号 · ${this.esc(acting.nickname||acting.username)}`
      : (this.authIsSuper ? `全部数据 · ${selfLabel}` : `本人 · ${selfLabel}`);
    const childBtns=children.map(c=>{
      const active=actingId&&Number(actingId)===Number(c.id)?'active':'';
      return `<button type="button" class="scope-item ${active}" onclick="app.switchActingAs(${c.id})"><b>${this.esc(c.nickname||c.username)}</b><span>@${this.esc(c.username)}</span></button>`;
    }).join('');
    const superExtra=this.authIsSuper
      ? `<div class="scope-super"><input type="search" id="scope-user-search" placeholder="搜索管理员切换…" oninput="app.filterScopeUsers(this.value)"><div id="scope-user-list" class="scope-user-list"></div></div>`
      : '';
    box.innerHTML=`
      <button type="button" class="scope-trigger" onclick="app.toggleScopePanel()" id="scope-trigger-btn">
        <span class="scope-dot"></span>
        <span class="scope-label">${currentLabel}</span>
        <span class="scope-caret">▴</span>
      </button>
      <div class="scope-panel hidden" id="scope-panel">
        <div class="scope-panel-title">切换数据身份</div>
        <button type="button" class="scope-item ${!actingId?'active':''}" onclick="app.switchActingAs(null)">
          <b>${this.authIsSuper?'查看全部（超管）':'本人数据'}</b>
          <span>${selfLabel}</span>
        </button>
        ${childBtns?`<div class="scope-section">子级账号</div>${childBtns}`:''}
        ${superExtra}
      </div>`;
    if(this.authIsSuper) this.loadScopeUserOptions();
  },
  toggleScopePanel(){
    const panel=document.querySelector('#scope-panel');
    if(!panel)return;
    panel.classList.toggle('hidden');
  },
  async loadScopeUserOptions(){
    try{
      const pack=await this.api('/admin-users?pageSize=200');
      this._scopeUsers=(pack.items||[]).filter(u=>Number(u.id)!==Number(this.authUser?.id));
      this.filterScopeUsers('');
    }catch(e){
      this._scopeUsers=[];
    }
  },
  filterScopeUsers(kw=''){
    const host=document.querySelector('#scope-user-list');
    if(!host)return;
    const q=String(kw||'').trim().toLowerCase();
    const actingId=this.getActingAsId();
    const rows=(this._scopeUsers||[]).filter(u=>{
      if(!q)return true;
      const hay=`${u.username||''} ${u.nickname||''}`.toLowerCase();
      return hay.includes(q);
    }).slice(0,30);
    host.innerHTML=rows.map(u=>{
      const active=actingId&&Number(actingId)===Number(u.id)?'active':'';
      return `<button type="button" class="scope-item ${active}" onclick="app.switchActingAs(${u.id})"><b>${this.esc(u.nickname||u.username)}</b><span>@${this.esc(u.username)}</span></button>`;
    }).join('')||'<div class="muted" style="padding:8px">无匹配用户</div>';
  },
  async switchActingAs(userId){
    if(userId==null||userId===''||userId===0){
      localStorage.removeItem('tkswarm_acting_as');
    }else{
      localStorage.setItem('tkswarm_acting_as', String(userId));
    }
    const panel=document.querySelector('#scope-panel');
    if(panel)panel.classList.add('hidden');
    try{
      await this.ensureAuth();
      await this.loadRefs();
      this.refresh();
      const label=this.authActingAs
        ? `已切换到子账号：${this.authActingAs.nickname||this.authActingAs.username}`
        : (this.authIsSuper?'已回到超管全量视图':'已回到本人数据');
      this.toast(label);
    }catch(e){
      this.toast(e.message||'切换失败',true);
    }
  },
  canPermission(code){
    if(!this.authEnabled)return true;
    if(!code)return true;
    const list=this.authPermissions||[];
    if(list.includes('*')||list.includes('admin'))return true;
    if(!list.length)return String(this.authUser?.role||'').toLowerCase()==='admin';
    return list.includes(code);
  },
  canView(view){
    if(!this.authEnabled)return true;
    const need=(this.meta?.viewPermissions||{})[view];
    if(!need||!need.length)return true;
    return need.some(c=>this.canPermission(c));
  },
  async loadMeta(){
    try{this.meta=await this.api('/meta')}catch(e){console.warn('loadMeta failed',e);this.meta=this.meta||{viewPermissions:{},statusLabels:{},importFormats:[],taskTypes:{},chatFilters:[],chatEmojis:[]}}
  },
  dictPairs(list, fallback){
    if(Array.isArray(list)&&list.length) return list.map(x=>[x.code,x.label]);
    return fallback||[];
  },
  groupTypeLabel(code, short=false){
    const hit=(this.meta?.groupTypes||[]).find(x=>x.code===code);
    if(hit){
      if(!short) return hit.label;
      return hit.label.replace(/分组$/,'').replace(/\s/g,'')||hit.label;
    }
    const fb={account:short?'账号':'账号分组',proxy:short?'代理':'代理分组',message:short?'消息':'消息分组',uid:short?'UID':'UID 分组'};
    return fb[code]||code;
  },
  loginStatusPairs(){
    return this.dictPairs(this.meta?.accountLoginStatuses, [['offline','离线'],['online','在线'],['expired','已过期']]);
  },
  permModulePairs(){
    return this.dictPairs(this.meta?.permModules, [['account','账号'],['proxy','代理'],['agent','机器人'],['publish','发布'],['chat','客服'],['rbac','权限'],['system','系统']]);
  },
  languagePairs(includeAuto=true){
    const rows=(this.meta?.languages||[]).filter(x=>includeAuto||x.code!=='auto');
    return this.dictPairs(rows, [['zh','中文'],['en','英文']]);
  },
  uiLanguagePairs(){
    return this.dictPairs(this.meta?.uiLanguages, [['zh-CN','简体中文']]);
  },
  replyTonePairs(){
    return this.dictPairs(this.meta?.replyTones, [['friendly','亲切友好'],['professional','专业稳重'],['humor','幽默风趣']]);
  },
  materialStatusPairs(){return this.dictPairs(this.meta?.materialStatuses, [['ready','可用'],['disabled','停用'],['missing','文件缺失']])},
  modelTypePairs(){return this.dictPairs(this.meta?.modelTypes, [['builtin','内置模型'],['custom','自定义 API']])},
  translationModePairs(){return this.dictPairs(this.meta?.translationModes, [['off','关闭'],['basic','普通接口翻译'],['ai','智能翻译']])},
  notificationSoundPairs(){return this.dictPairs(this.meta?.notificationSounds, [['chime','清脆'],['soft','柔和'],['alert','提醒'],['none','关闭']])},
  browserWindowPairs(){return this.dictPairs(this.meta?.browserWindowModes, [['visible','显示窗口（调试）'],['hidden','隐藏窗口（正式运行）'],['auto','按分项开关']])},
  browserTypePairs(){
    const rows=(this.meta?.browserTypes||[]).filter(x=>x.ready!==false);
    return this.dictPairs(rows, [['bit','比特浏览器']]);
  },
  taskStatusPairs(){return this.dictPairs(this.meta?.taskStatuses, [['draft','草稿'],['queued','排队中'],['running','运行中'],['paused','已暂停'],['completed','已完成'],['failed','失败'],['cancelled','已取消']])},
  massTargetPairs(){return this.dictPairs(this.meta?.massTargets, [['imported','导入好友'],['new','新好友'],['unreplied','未回复好友'],['followers','粉丝/互关'],['fixed','固定对象']])},
  massChannelMeta(code){return (this.meta?.massChannels||[]).find(x=>x.code===code)||null},
  opt(key, fallback){return this.dictPairs(this.meta?.[key], fallback)},
  exportFieldItems(){
    const rows=this.meta?.exportFields;
    if(Array.isArray(rows)&&rows.length) return rows.map(x=>[x.code,x.label,x.defaultOn!==false]);
    return [['username','账号',true],['nickname','昵称',true],['country','国家',true],['group','分组',true],['proxy','代理',true],['login','登录',true],['session','会话',true],['capcut','CapCut',true],['status','状态',true],['chat','客服',false],['notes','备注',false]];
  },
  viewPageMeta(view){
    const key=view==='rbac'?('rbac.'+(this.subview||'permissions')):view;
    const fromMeta=this.meta?.viewTitles?.[key]||this.meta?.viewTitles?.[view];
    const fromNav=(this.navTree||[]).find(r=>r.view===view);
    const fb=this.titles?.[view];
    const title=fromMeta?.title||fromNav?.title||fb?.[0]||view;
    const description=fromMeta?.description||fb?.[1]||'';
    return [title, description];
  },

  renderUserChip(){
    const box=document.querySelector('.user-info');
    if(!box)return;
    const clock=box.querySelector('#clock');
    box.innerHTML='';
    if(clock)box.appendChild(clock);
    if(this.authUser){
      const username = this.esc(this.authUser.username || 'Admin');
      const role = this.esc(this.authUser.role || '管理员');
      const initial = (this.authUser.username || 'A').slice(0, 1).toUpperCase();

      const userMenuWrapper = document.createElement('div');
      userMenuWrapper.className = 'user-dropdown-wrap';
      userMenuWrapper.id = 'user-dropdown-wrap';
      userMenuWrapper.innerHTML = `
        <button type="button" class="user-trigger-btn" id="user-menu-trigger" aria-haspopup="true" aria-expanded="false">
          <div class="user-avatar-badge">${initial}</div>
          <div class="user-name-role">
            <span class="user-name">${username}</span>
            <span class="user-role-tag">${role}</span>
          </div>
          <span class="user-arrow-icon">▾</span>
        </button>
        <div class="user-dropdown-menu hidden" id="user-dropdown-panel">
          <div class="user-menu-header">
            <div class="user-header-avatar">${initial}</div>
            <div class="user-header-info">
              <b>${username}</b>
              <small>${role}</small>
            </div>
          </div>
          <div class="user-menu-divider"></div>
          <button type="button" class="user-menu-item" onclick="app.actionAccountSettings()">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            <span>基础设置</span>
          </button>
          ${this.authEnabled && this.authUser?.id ? `<button type="button" class="user-menu-item" onclick="app.actionChangePassword()">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            <span>修改密码</span>
          </button>` : `<button type="button" class="user-menu-item" onclick="app.actionEnableAuthHint()">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            <span>修改密码（需先开启鉴权）</span>
          </button>`}
          <button type="button" class="user-menu-item" onclick="app.actionRefreshPage()">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
            <span>刷新页面</span>
          </button>
          <div class="user-menu-divider"></div>
          ${this.authEnabled && this.authUser?.id ? `<button type="button" class="user-menu-item item-danger" onclick="app.actionLogout()">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            <span>退出登录</span>
          </button>` : `<button type="button" class="user-menu-item" onclick="app.navigate('settings','backup')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            <span>前往开启鉴权</span>
          </button>`}
        </div>
      `;
      box.appendChild(userMenuWrapper);

      const trigger = userMenuWrapper.querySelector('#user-menu-trigger');
      const panel = userMenuWrapper.querySelector('#user-dropdown-panel');
      trigger.onclick = (e) => {
        e.stopPropagation();
        const isHidden = panel.classList.contains('hidden');
        document.querySelectorAll('.user-dropdown-menu').forEach(m => m.classList.add('hidden'));
        if (isHidden) {
          panel.classList.remove('hidden');
          trigger.classList.add('active');
        } else {
          panel.classList.add('hidden');
          trigger.classList.remove('active');
        }
      };
    } else {
      const loginBtn=document.createElement('button');
      loginBtn.className='primary tiny';
      loginBtn.textContent='管理员登录';
      loginBtn.onclick=()=>this.showLoginGate();
      box.appendChild(loginBtn);
      const refresh=document.createElement('button');
      refresh.className='ghost tiny';
      refresh.textContent='刷新';
      refresh.onclick=()=>this.refresh();
      box.appendChild(refresh);
    }
    UI.decorate(box);
  },
  actionAccountSettings(){
    document.querySelector('#user-dropdown-panel')?.classList.add('hidden');
    document.querySelector('#user-menu-trigger')?.classList.remove('active');
    this.navigate('settings', 'browser');
  },
  actionChangePassword(){
    document.querySelector('#user-dropdown-panel')?.classList.add('hidden');
    document.querySelector('#user-menu-trigger')?.classList.remove('active');
    if(!this.authEnabled || !this.authUser?.id){
      this.actionEnableAuthHint();
      return;
    }
    this.openChangePasswordModal();
  },
  actionEnableAuthHint(){
    document.querySelector('#user-dropdown-panel')?.classList.add('hidden');
    document.querySelector('#user-menu-trigger')?.classList.remove('active');
    this.modal('修改密码不可用',`<div class="shell-note">当前未开启本地鉴权，或尚未登录真实管理员账号，无法修改密码。<br>请到「基础设置 → 备份与鉴权」开启鉴权并创建/登录管理员后再改密。</div><div class="action-bar" style="margin-top:12px"><button class="primary" type="button" onclick="app.closeModal();app.navigate('settings','backup')">前往开启鉴权</button></div>`,async()=>{},false,{hideSubmit:true});
  },
  openChangePasswordModal(){
    if(!this.authEnabled || !this.authUser?.id){
      this.actionEnableAuthHint();
      return;
    }
    const html = `
      <div class="form-grid" style="padding: 10px 0;">
        <div class="field full">
          <label>原密码 <span class="req">*</span></label>
          <input class="input" type="password" name="oldPassword" id="pwd-old" data-rule="required|min:1" placeholder="请输入当前密码">
        </div>
        <div class="field full">
          <label>新密码 <span class="req">*</span></label>
          <input class="input" type="password" name="newPassword" id="pwd-new" data-rule="required|min:6" placeholder="请输入至少 6 位新密码">
        </div>
        <div class="field full">
          <label>确认新密码 <span class="req">*</span></label>
          <input class="input" type="password" name="confirmPassword" id="pwd-confirm" data-rule="required|min:6" placeholder="请再次输入新密码">
          <div class="field-error"></div>
        </div>
      </div>
    `;
    this.modal('修改密码', html, async (data) => {
      const oldPassword = data.oldPassword || document.querySelector('#pwd-old')?.value || '';
      const newPassword = data.newPassword || document.querySelector('#pwd-new')?.value || '';
      const confirmPassword = data.confirmPassword || document.querySelector('#pwd-confirm')?.value || '';
      if (newPassword !== confirmPassword) {
        throw new Error('两次输入的新密码不一致');
      }
      await this.api('/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ oldPassword, newPassword })
      });
      this.toast('密码修改成功，请重新登录！', 'success');
      setTimeout(() => this.actionLogout(), 1200);
    });
  },
  actionRefreshPage(){
    document.querySelector('#user-dropdown-panel')?.classList.add('hidden');
    document.querySelector('#user-menu-trigger')?.classList.remove('active');
    this.refresh();
    this.toast('数据与视图已更新', 'success');
  },
  async actionLogout(){
    document.querySelector('#user-dropdown-panel')?.classList.add('hidden');
    document.querySelector('#user-menu-trigger')?.classList.remove('active');
    const ok = await this.ask('确定要退出当前管理员登录吗？', 'warn');
    if (!ok) return;
    this.logout();
  },
  authShell(title,desc,extra){
    return `<div class="auth-split">
      <section class="auth-hero">
        <div class="brand"><span class="logo-mark">Dyy</span><span class="logo-name">TkSwarm</span></div>
        <h1>扬帆出海 · 融通全球</h1>
        <p>跨洋巨轮破浪远航，TikTok 矩阵全域赋能。将全球多账号调度、跨境代理与 AI 创作装载入统一的航海旗舰中台。</p>
        <ul>
          <li>全球航线与多国原生代理池调度</li>
          <li>短视频爆款发布、去重流转与多轨并发</li>
          <li>多账号海外聚合私信与 AI 智能体破冰闭环</li>
        </ul>
      </section>
      <section class="auth-panel">
        <h2>${title}</h2>
        <p class="muted">${desc}</p>
        ${extra}
      </section>
    </div>`;
  },
  showLoginGate(message=''){
    this.hideAuthGate();
    document.body.classList.add('in-auth-mode');
    const el=document.createElement('div');
    el.id='auth-gate';
    el.className='auth-gate';
    const canClose = !this.authEnabled || Boolean(this.authUser);
    const savedUser = localStorage.getItem('tkswarm_remember_user') || '';
    const isRemembered = Boolean(savedUser);

    el.innerHTML=this.authShell(
      '登录控制台',
      this.esc(message||'请使用管理员账号进入系统'),
      `<div class="form-grid">
        <div class="field full">
          <label>用户名 <span class="req">*</span></label>
          <input class="input" id="auth-username" value="${this.esc(savedUser)}" data-rule="required|min:1|max:80" autocomplete="username" placeholder="请输入管理员用户名">
        </div>
        <div class="field full">
          <label>密码 <span class="req">*</span></label>
          <input class="input" id="auth-password" data-rule="required|min:6" type="password" autocomplete="current-password" placeholder="请输入登录密码">
          <div class="field-error"></div>
        </div>
        <div class="field full">
          <label>验证码 <span class="req">*</span></label>
          <div class="field-captcha">
            <input class="input" id="auth-captcha" data-rule="required|min:4|max:4" maxlength="4" placeholder="4位字符" autocomplete="off">
            <div class="captcha-img-box" id="captcha-box" title="点击刷新验证码" onclick="app.refreshCaptcha()">
              <span class="muted" style="font-size:12px">加载中...</span>
            </div>
          </div>
          <div class="field-error"></div>
        </div>
        <div class="field full auth-options-row" style="display:flex!important;justify-content:flex-start!important;align-items:center!important;text-align:left!important;width:100%!important;margin:4px 0 0!important;">
          <label class="auth-checkbox-label" style="display:inline-flex!important;align-items:center!important;justify-content:flex-start!important;flex-direction:row!important;gap:8px!important;cursor:pointer;margin:0!important;padding:0!important;text-align:left!important;width:auto!important;">
            <input type="checkbox" id="auth-remember" ${isRemembered?'checked':''} style="width:16px!important;min-width:16px!important;max-width:16px!important;height:16px!important;margin:0!important;padding:0!important;accent-color:#2563eb!important;cursor:pointer;">
            <span style="display:inline-block!important;text-align:left!important;white-space:nowrap!important;font-size:13.5px;color:#334155;font-weight:500;">记住用户名</span>
          </label>
          <span class="auth-tip" style="font-size:12px;color:#94a3b8;margin-left:auto;text-align:right;">30天内保持会话</span>
        </div>
      </div>
      <div class="modal-foot">
        <button class="primary" id="auth-submit">登录</button>
        ${canClose?'<button type="button" class="info" id="auth-cancel" onclick="app.hideAuthGate()">返回后台</button>':''}
      </div>`
    );
    document.body.appendChild(el);
    UI.decorate(el);
    this.refreshCaptcha();
    el.querySelector('#auth-submit').onclick=()=>this.submitLogin();
    el.querySelector('#auth-password').addEventListener('keydown',e=>{if(e.key==='Enter')this.submitLogin()});
    el.querySelector('#auth-captcha').addEventListener('keydown',e=>{if(e.key==='Enter')this.submitLogin()});
  },
  async refreshCaptcha(){
    const box = document.querySelector('#captcha-box');
    if(!box) return;
    box.innerHTML = '<span class="muted" style="font-size:12px">加载中...</span>';
    try {
      const res = await this.api('/auth/captcha');
      this.currentCaptchaKey = res.captchaKey;
      if(res.rawSvg){
        box.innerHTML = res.rawSvg;
      } else if(res.svg && res.svg.startsWith('<svg')){
        box.innerHTML = res.svg;
      } else if(res.svg){
        box.innerHTML = `<img src="${res.svg}" alt="验证码" />`;
      }
      const capInput = document.querySelector('#auth-captcha');
      if(capInput) capInput.value = '';
    } catch(e) {
      box.innerHTML = `<span style="font-size:11px;color:#ef4444;cursor:pointer">点击重试</span>`;
    }
  },
  showSetupGate(){
    this.hideAuthGate();
    document.body.classList.add('in-auth-mode');
    const el=document.createElement('div');
    el.id='auth-gate';
    el.className='auth-gate';
    el.innerHTML=this.authShell('创建管理员','首次开启鉴权，请设置本地管理员账号',`<div class="form-grid"><div class="field full"><label>用户名 <span class="req">*</span></label><input class="input" id="auth-username" value="admin" data-rule="required|min:1|max:80"></div><div class="field full"><label>密码 <span class="req">*</span></label><input class="input" id="auth-password" data-rule="required|min:6" type="password"><div class="field-error"></div></div></div><div class="modal-foot"><button class="primary" id="auth-submit">创建并登录</button></div>`);
    document.body.appendChild(el);
    UI.decorate(el);
    el.querySelector('#auth-submit').onclick=()=>this.submitSetup();
  },
  hideAuthGate(){
    document.body.classList.remove('in-auth-mode');
    document.querySelector('#auth-gate')?.remove();
  },
  async submitLogin(){
    const form=document.querySelector('#auth-gate');
    const invalid=UI.validate(form);
    if(invalid){
      this.toast(invalid,true);
      return;
    }
    const username=document.querySelector('#auth-username')?.value?.trim();
    const password=document.querySelector('#auth-password')?.value||'';
    const captchaCode=document.querySelector('#auth-captcha')?.value?.trim();
    const rememberMe=Boolean(document.querySelector('#auth-remember')?.checked);
    const submitBtn=document.querySelector('#auth-submit');
    const cancelBtn=document.querySelector('#auth-cancel');
    const usernameInput=document.querySelector('#auth-username');
    const passwordInput=document.querySelector('#auth-password');
    const captchaInput=document.querySelector('#auth-captcha');

    // 1. 登录按钮进入加载动画状态，与表单保持锁定防止重复提交
    let originText = '登录';
    if(submitBtn){
      originText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.classList.add('btn-loading');
      submitBtn.innerHTML = '<span>正在验证凭据...</span>';
    }
    if(cancelBtn) cancelBtn.disabled = true;
    if(usernameInput) usernameInput.disabled = true;
    if(passwordInput) passwordInput.disabled = true;
    if(captchaInput) captchaInput.disabled = true;

    try {
      const r = await this.api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username,
          password,
          captchaKey: this.currentCaptchaKey,
          captchaCode,
          rememberMe
        })
      });

      // 处理“记住我”本地存储
      if(rememberMe){
        localStorage.setItem('tkswarm_remember_user', username);
      } else {
        localStorage.removeItem('tkswarm_remember_user');
      }

      // 成功提示
      this.toast('登录验证成功，欢迎回来！', 'success');
      this.authToken = r.token;
      localStorage.setItem('tkswarm_token', r.token);

      // 延迟 400ms 平滑关闭并进入主控台，让用户清晰看到成功状态
      setTimeout(() => {
        this.hideAuthGate();
        location.reload();
      }, 400);
    } catch (e) {
      // 失败提示
      this.toast(e.message || '登录失败，请检查用户名或密码', true);
      // 刷新验证码，防止重放
      this.refreshCaptcha();

      // 恢复按钮与表单可输入状态
      if(submitBtn){
        submitBtn.disabled = false;
        submitBtn.classList.remove('btn-loading');
        submitBtn.innerHTML = originText || '登录';
      }
      if(cancelBtn) cancelBtn.disabled = false;
      if(usernameInput) usernameInput.disabled = false;
      if(passwordInput) passwordInput.disabled = false;
      if(captchaInput){
        captchaInput.disabled = false;
        captchaInput.value = '';
        captchaInput.focus();
      }
    }
  },
  async submitSetup(){
    const form=document.querySelector('#auth-gate');
    const invalid=UI.validate(form);
    if(invalid){
      this.toast(invalid,true);
      return;
    }
    const username=document.querySelector('#auth-username')?.value?.trim();
    const password=document.querySelector('#auth-password')?.value||'';
    const submitBtn=document.querySelector('#auth-submit');

    if(submitBtn){
      submitBtn.disabled = true;
      submitBtn.classList.add('btn-loading');
      submitBtn.innerHTML = '<span>正在初始化管理员...</span>';
    }

    try {
      const r = await this.api('/auth/setup', {
        method: 'POST',
        body: JSON.stringify({username, password})
      });
      this.toast('管理员账号创建成功！', 'success');
      this.authToken = r.token;
      localStorage.setItem('tkswarm_token', r.token);
      setTimeout(() => {
        this.hideAuthGate();
        location.reload();
      }, 400);
    } catch (e) {
      this.toast(e.message || '初始化失败', true);
      if(submitBtn){
        submitBtn.disabled = false;
        submitBtn.classList.remove('btn-loading');
        submitBtn.innerHTML = '创建并登录';
      }
    }
  },
  async logout(){try{await this.api('/auth/logout',{method:'POST'})}catch{}this.authToken='';localStorage.removeItem('tkswarm_token');localStorage.removeItem('tkswarm_acting_as');location.reload()},
  async loadRefs(){[this.groups,this.proxies,this.materials,this.templates]=await Promise.all([this.api('/groups'),this.api('/proxies?pageSize=100').then(x=>x.items),this.api('/materials'),this.api('/message-templates')])},
  async navigate(view, subview=''){
    if(!this.canView(view)){this.toast('当前角色无权访问该模块',true);return}
    if(view!=='chat')this.stopChatSyncTimer?.();
    this.view=view;

    // 根据 subview 精确定位并激活视图内 Tab / 操作
    if(view==='accounts'){
      if(subview==='browser')this.accountPane='browser';
      else if(subview==='list')this.accountPane='list';
      else if(subview==='import'||subview==='io'||subview==='export'){this.accountPane='io';this.accountIoTab=subview==='import'?'import':'export';if(!Array.isArray(this.accountIoFields)||!this.accountIoFields.length)this.accountIoFields=this.defaultAccountIoFields()}
      else if(subview==='qr'){this.accountPane='list';this.toast('扫码登录功能已移除',true)}
      else if(subview==='batch_browser'){this.accountPane='browser';setTimeout(()=>this.batchCreateBrowserModal(),120)}
      else if(subview==='monitor_config'){this.accountPane='list';setTimeout(()=>{if(!this.canPermission('account.create')){this.toast('当前角色无权修改监控配置',true);return}this.monitorModal()},120)}
      else if(subview==='monitor_run'){this.accountPane='list';setTimeout(()=>{if(!this.canPermission('account.create')){this.toast('当前角色无权执行账号同步',true);return}this.runAccountMonitor()},120)}
      else if(subview==='monitor_log'||subview==='monitor_result'){this.accountPane='list';setTimeout(()=>this.showMonitorResult(),120)}
    } else if(view==='warm'){
      if(subview==='create'||subview==='create_warm'){this.warmPane='create';this.warmEditId=null}
      else {this.warmPane='list';this.warmEditId=null}
    } else if(view==='proxies'){
      if(subview==='import'||subview==='io'){
        this.proxyPane='io';
        this.proxyIoTab=subview==='import'?'import':'export';
        if(!Array.isArray(this.proxyIoFields)||!this.proxyIoFields.length)this.proxyIoFields=this.defaultProxyIoFields();
      } else {
        this.proxyPane='list';
        if(subview==='create')setTimeout(()=>{if(!this.canPermission('proxy.create')){this.toast('当前角色无权添加代理',true);return}this.proxyModal()},120);
        else if(subview==='batch_test')setTimeout(()=>{if(!this.canPermission('proxy.test')){this.toast('当前角色无权检测代理',true);return}this.batchTestProxies()},120);
        else if(subview==='fetch_cloud')setTimeout(()=>{if(!this.canPermission('proxy.create')){this.toast('当前角色无权拉取代理',true);return}this.fetchProxyModal()},120);
      }
    } else if(view==='groups'){
      // 账号池「分组管理」默认只看账号分组；也可切到其他类型
      if(['account','proxy','message','uid'].includes(subview)) this.groupType=subview;
      else this.groupType=this.groupType||'account';
    } else if(view==='agent'){
      if(subview==='create')setTimeout(()=>this.addAgent(),120);
      else if(subview==='template')setTimeout(()=>{if(!this.canPermission('agent.manage')){this.toast('当前角色无权应用机器人模板',true);return}this.openAgentTemplates()},120);
      else if(['basic','model','prompt','terminate','poll'].includes(subview)){
        this.agentTab=subview;
      }
    } else if(view==='publish'){
      clearTimeout(this._matrixSoftTimer);
      this.invalidateMatrixCache();
      if(subview==='tasks'||subview===''||subview==='list'){this.matrixTab='tasks';this.taskTypeFilter='';this.taskModeFilter='';this.wizardOpen=false;this.massWizardOpen=false;}
      else if(subview==='create_publish'||subview==='random'){this.openPublishWizard('random',{skipRefresh:true});}
      else if(subview==='create_ordered'||subview==='create_mass'||subview==='ordered'){this.openPublishWizard('ordered',{skipRefresh:true});}
      else if(subview==='mass'){this.matrixTab='tasks';this.taskTypeFilter='publish';this.taskModeFilter='ordered';this.wizardOpen=false;this.massWizardOpen=false;}
      else if(subview==='create_independent'||subview==='independent'){this.openPublishWizard('independent',{skipRefresh:true});}
      else if(subview==='materials'||subview==='material'){this.matrixTab='materials';this.wizardOpen=false;this.massWizardOpen=false;}
      else if(subview==='material_import'||subview==='folder_materials'||subview==='import'){this.matrixTab='materialImport';this.wizardOpen=false;this.massWizardOpen=false;}
      else if(subview==='uids'||subview==='uid'){return this.navigate('chat','uids')}
      else {this.matrixTab='tasks';this.wizardOpen=false;this.massWizardOpen=false;}
    } else if(view==='chat'){
      if(subview==='uids'||subview==='uid'){this.chatPane='uids'}
      else {
        this.chatPane='workbench';
        if(subview==='batch_connect')setTimeout(()=>{if(!this.canPermission('chat.manage')){this.toast('当前角色无权登录客服',true);return}this.batchChatConnectModal()},150);
        else if(subview==='read_all')setTimeout(()=>this.chatMenuReadAll(),200);
        else if(subview==='templates')setTimeout(()=>{if(!this.canPermission('chat.manage')&&!this.canPermission('publish.mass')){this.toast('当前角色无权管理话术',true);return}this.manageChatTemplates()},200);
        else if(subview==='translate')setTimeout(()=>this.chatMenuTranslate(),200);
        else if(subview==='ai_hosting')setTimeout(()=>{if(!this.canPermission('chat.manage')){this.toast('当前角色无权设置 AI 托管',true);return}this.chatMenuAiHosting()},200);
        else if(subview==='auto_lang'||subview==='auto_check_lang')setTimeout(()=>this.chatMenuAutoLang(),200);
      }
    } else if(view==='rbac'){
      this.subview = subview || 'permissions';
    } else if(view==='settings'){
      if(subview==='login_gate'){
        this.showLoginGate('系统鉴权设置');
        return;
      }
      if(['browser','message','task','clock','backup','env','password'].includes(subview)){
        this.settingsSection=subview;
        setTimeout(()=>this.scrollSettings(this.settingsSection),150);
      } else if(subview==='activation'){
        // 明确不做许可激活：引导到备份与鉴权，避免空滚动
        this.settingsSection='backup';
        setTimeout(()=>{this.toast('本系统不提供激活/续费入口，已打开备份与鉴权');this.scrollSettings('backup')},150);
      }
    } else if(view==='versions'){
      this.subview = subview || '';
    }

    // 更新一级高亮状态
    document.querySelectorAll('#nav [data-view]').forEach(b=>{
      const bv=b.dataset.view;
      const on=bv===view
        ||(bv==='settings'&&['versions','helpDocs','tickets','envInstallers','aiPlatform','aiPromptTemplates','aiCallLogs'].includes(view))
        ||(bv==='accounts'&&['warm','groups'].includes(view));
      b.classList.toggle('active', on);
    });
    document.querySelectorAll('.nav-item-root').forEach(el=>{
      const btn=el.querySelector('.nav-root-btn');
      const rootView=btn?.getAttribute('data-nav-view')||'';
      const isCur=rootView===view
        ||(rootView==='settings'&&['versions','helpDocs','tickets','envInstallers','aiPlatform','aiPromptTemplates','aiCallLogs'].includes(view))
        ||(rootView==='accounts'&&['warm','groups'].includes(view))
        ||(el.querySelector(`[data-nav-view="${view}"]`)!=null);
      el.classList.toggle('active',isCur);
      btn?.classList.toggle('active',isCur);
    });

    {
      const metaKey=(view==='chat'&&this.chatPane==='uids')?'uids':view;
      const [pageTitle]=this.viewPageMeta(metaKey);
      if(pageTitle) document.title=`${pageTitle} - TKSwarm`;
    }
    await this.refresh();
  },
  pageHead(view){
    if(view==='settings')return '';
    if(view==='chat'&&(this.chatPane||'workbench')!=='uids')return '';
    const metaKey=(view==='chat'&&this.chatPane==='uids')?'uids':view;
    const [title,desc]=this.viewPageMeta(metaKey);
    if(!title)return '';
    return `<div class="page-head"><div><h1>${this.esc(title)}</h1><p>${this.esc(desc||'')}</p></div></div>`;
  },
  async refresh(){try{if(window.UI)UI.restorePopups();if(this.view==='publish')this.invalidateMatrixCache(this.matrixTab);await this['render'+this.view[0].toUpperCase()+this.view.slice(1)]();const head=this.pageHead(this.view);const content=document.querySelector('#content');if(head&&content&&!content.querySelector('.page-head'))content.insertAdjacentHTML('afterbegin',head);if(window.UI&&content){const body=content.querySelector('#matrix-body');UI.decorate(body||content)}}catch(e){this.toast(e.message,true)}},
  connectLiveLogs(){try{const wsBase=(window.__TKSWARM_CONFIG__&&typeof window.__TKSWARM_CONFIG__.getWsBase==='function')?window.__TKSWARM_CONFIG__.getWsBase():(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`);const ws=new WebSocket(wsBase);this.ws=ws;ws.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.type==='operation-log'){this.liveLogs.unshift(m.data);this.liveLogs=this.liveLogs.slice(0,500);if(typeof this.renderLiveLogs==='function')this.renderLiveLogs()}if(m.type==='new_message'){this.playTipSound()}if(['account_status','new_message','friend_status','friend_msg_read_status','message_status'].includes(m.type)&&this.view==='chat'){this.refresh()}}catch{}};ws.onclose=()=>setTimeout(()=>this.connectLiveLogs(),3000);setInterval(()=>{if(this.ws&&this.ws.readyState===1)this.ws.send(JSON.stringify({type:'heartbeat'}))},25000)}catch{}},
  stat(label,value,hint,tint){return `<div class="stat" style="--tint:${tint}"><small>${label}</small><strong>${value}</strong><em>${hint}</em></div>`},
  statIco(name){
    const paths={
      users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
      check:'<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
      logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
      ban:'<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
      fans:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
      follow:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
      heart:'<path d="M19.5 12.6 12 20l-7.5-7.4a5 5 0 1 1 7.5-6.6 5 5 0 1 1 7.5 6.6z"/>',
      video:'<rect x="3" y="6" width="12" height="12" rx="2"/><path d="m15 10 6-3v10l-6-3z"/>',
      key:'<circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 8.2-8.2M16 7l3 3M18 5l3 3"/>',
      cut:'<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>'
    };
    return `<span class="stat-ico" aria-hidden="true"><svg viewBox="0 0 24 24">${paths[name]||paths.users}</svg></span>`;
  },
  statChip(kind,label,value,icon,action){const click=action?` onclick="${action}" title="点击处理" style="cursor:pointer"`:'';return `<div class="stat-chip ${kind||''}"${click}><div class="stat-chip-text"><small>${label}</small><b>${value}</b></div>${this.statIco(icon)}</div>`},
  async copyText(text){
    const value=String(text||'');
    if(!value){this.toast('没有可复制内容',true);return}
    try{
      if(navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
      else {
        const ta=document.createElement('textarea');
        ta.value=value;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();
      }
      this.toast('已复制到剪贴板');
    }catch(e){this.toast(e.message||'复制失败',true)}
  },  
  toggleToolbarDropdown(sel, e){
    const target=document.querySelector(sel);
    const willShow=target?.classList.contains('hidden');
    document.querySelectorAll('.dropdown-menu').forEach(el=>{
      el.classList.add('hidden');
      if(window.UI) UI.restoreMenu(el);
    });
    if(target && willShow){
      target.classList.add('align-left');
      target.classList.remove('hidden');
      const btn=e?.currentTarget || target.closest('.dropdown')?.querySelector('button');
      if(window.UI) UI.liftMenu(target, btn, {align:'left'});
    }
  },
  toggleAllProxies(checked){document.querySelectorAll('.proxy-check').forEach(x=>{x.checked=checked});this.bindProxyChecks()},
  parseCsvText(text){
    const raw=String(text||'').replace(/^\uFEFF/,'');
    const lines=raw.split(/\r?\n/).filter(l=>l.trim()!=='');
    if(!lines.length)return {header:[],rows:[]};
    const parseLine=line=>{const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){cur+='"';i++}else q=!q}else if(c===','&&!q){out.push(cur);cur=''}else cur+=c}out.push(cur);return out};
    const header=parseLine(lines[0]).map(x=>x.trim());
    const rows=lines.slice(1).map(parseLine);
    return {header,rows};
  },
  formatBytes(n){
    const x=Number(n||0);
    if(x<1024)return x+' B';
    if(x<1024*1024)return (x/1024).toFixed(1)+' KB';
    return (x/1024/1024).toFixed(1)+' MB';
  },
  playTipSound(){
    if(this.notificationSync===false)return;
    const sound=String(this.notificationSound||'chime').toLowerCase();
    if(sound==='none')return;
    try{
      const Ctx=window.AudioContext||window.webkitAudioContext;
      if(!Ctx)return;
      if(!this._audioCtx)this._audioCtx=new Ctx();
      const ctx=this._audioCtx;
      const freq=sound==='soft'?660:sound==='alert'?1040:880;
      const dur=sound==='alert'?0.36:0.28;
      const osc=ctx.createOscillator();
      const gain=ctx.createGain();
      osc.type='sine';
      osc.frequency.value=freq;
      gain.gain.setValueAtTime(0.0001,ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.22,ctx.currentTime+0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+dur);
      osc.connect(gain);gain.connect(ctx.destination);
      osc.start();osc.stop(ctx.currentTime+dur+0.02);
    }catch{}
  },
  previewTipSound(){const sound=document.querySelector('[name=notificationSound]')?.value||this.notificationSound||'chime';this.notificationSound=sound;this.notificationSync=true;this.playTipSound()},
  formRow(label,control,hint=''){return `<div class="form-row"><div class="form-label">${label}</div><div class="form-content">${control}${hint?`<div class="form-hint">${hint}</div>`:''}</div></div>`},
  richEditor(name,label,value='',placeholder='请输入内容...'){
    return `
      <div class="field full rich-editor-field">
        <label>${label}</label>
        <div class="rich-editor-box" data-rich-for="${name}">
          <div class="rich-toolbar">
            <button type="button" class="rich-btn" data-cmd="bold" title="加粗"><b>B</b></button>
            <button type="button" class="rich-btn" data-cmd="italic" title="斜体"><i>I</i></button>
            <button type="button" class="rich-btn" data-cmd="underline" title="下划线"><u>U</u></button>
            <span class="rich-sep"></span>
            <button type="button" class="rich-btn" data-cmd="insertUnorderedList" title="无序列表">• 列表</button>
            <button type="button" class="rich-btn" data-cmd="insertOrderedList" title="有序列表">1. 列表</button>
            <span class="rich-sep"></span>
            <button type="button" class="rich-btn" data-cmd="justifyLeft" title="左对齐">左</button>
            <button type="button" class="rich-btn" data-cmd="justifyCenter" title="居中">中</button>
            <button type="button" class="rich-btn" data-cmd="justifyRight" title="右对齐">右</button>
            <span class="rich-sep"></span>
            <button type="button" class="rich-btn" data-cmd="removeFormat" title="清除格式">清除</button>
          </div>
          <div class="rich-content" contenteditable="true" data-placeholder="${placeholder}">${value || ''}</div>
          <input type="hidden" name="${name}" value="${this.esc(value)}">
        </div>
      </div>
    `;
  },
  field(name,label,value='',type='text',required=false){const rule=UI.rulesFor(name,type,required);const star=required?' <span class="req">*</span>':'';return `<div class="field ${type==='textarea'?'full':''}"><label>${label}${star}</label>${type==='textarea'?`<textarea class="input" name="${name}" rows="3" data-rule="${rule}" placeholder="请输入${label}...">${this.esc(value)}</textarea>`:`<input class="input" name="${name}" type="${type}" value="${this.esc(value)}" data-rule="${rule}" placeholder="请输入${label}..." ${required?'required':''}>`}<div class="field-error"></div></div>`},
  imageField(name,label,value='',multiple=false){const urls=String(value||'').split(',').filter(Boolean);return `<div class="field full"><label>${label}</label><div class="uploader" data-multiple="${multiple?'true':'false'}"><input type="file" accept="image/*" ${multiple?'multiple':''} hidden><input type="hidden" name="${name}" value="${this.esc(urls.join(','))}"><div class="uploader-drop"><span>拖拽图片到此处，或使用按钮选择。悬停可预览。</span><button type="button" class="primary" data-pick>选择图片</button></div><div class="uploader-list">${urls.map(url=>`<div class="uploader-item"><img src="${this.esc(url)}" alt=""></div>`).join('')}</div></div></div>`},
  select(name,label,items,value=''){return `<div class="field"><label>${label}</label><select name="${name}"><option value="">未选择</option>${items.map(x=>`<option value="${x.id}" ${String(value)===String(x.id)?'selected':''}>${this.esc(x.name)}</option>`).join('')}</select></div>`},
  selectRaw(name,label,items,value){return `<div class="field"><label>${label}</label><select name="${name}">${items.map(([v,n])=>`<option value="${v}" ${v===value?'selected':''}>${n}</option>`).join('')}</select></div>`},
  multiSelect(name,label,items,values=[]){return `<div class="field full"><label>${label}</label><select name="${name}" multiple size="4">${items.length?items.map(x=>`<option value="${x.id}" ${values.map(Number).includes(Number(x.id))?'selected':''}>${this.esc(x.name)}</option>`).join(''):'<option disabled>暂无素材</option>'}</select></div>`},
  modal(title,body,submit,raw=false,opts={}){
    const modal=document.querySelector('#modal');
    if(!modal)return;
    const foot=modal.querySelector('.modal-foot');
    const submitBtn=foot?.querySelector('button[type=submit]');
    const cancelBtn=foot?.querySelector('button[type=button]');
    document.querySelector('#modal-title').textContent=title;
    document.querySelector('#modal-body').innerHTML=body;
    modal.classList.remove('hidden');
    modal.classList.toggle('detail-modal',!!opts.wide);
    if(foot)foot.classList.toggle('hidden',!!opts.hideFooter);
    if(submitBtn){
      submitBtn.textContent=opts.submitText||'保存';
      submitBtn.className='ep-btn ep-btn-primary';
      submitBtn.classList.toggle('hidden',!!opts.hideSubmit);
    }
    if(cancelBtn){
      cancelBtn.textContent=opts.hideSubmit?'关闭':'取消';
      cancelBtn.className='ep-btn ep-btn-default';
    }
    this._modalOnClose=opts.onClose||null;
    requestAnimationFrame(()=>modal.classList.add('is-visible'));
    if(window.UI)UI.decorate(modal);
    const form=document.querySelector('#modal-form');
    form.onsubmit=async e=>{
      e.preventDefault();
      if(opts.hideFooter||opts.hideSubmit){this.closeModal();return}
      const invalid=UI.validate(e.target);
      if(invalid){this.toast(invalid,true);return}
      try{
        UI.loading(true,'正在提交','请稍候，正在保存数据');
        const data=new FormData(e.target);
        await submit(raw?data:Object.fromEntries(data));
      }catch(err){
        this.toast(err.message,true);
      }finally{
        UI.loading(false);
      }
    };
  },
  closeModal(){
    const modal=document.querySelector('#modal');
    modal?.classList.remove('is-visible');
    setTimeout(()=>{
      modal?.classList.add('hidden');
      modal?.classList.remove('detail-modal');
      modal?.querySelector('.modal-foot')?.classList.remove('hidden');
      const submitBtn=modal?.querySelector('button[type=submit]');
      if(submitBtn){submitBtn.classList.remove('hidden');submitBtn.textContent='保存';submitBtn.className='ep-btn ep-btn-primary'}
      const cancelBtn=modal?.querySelector('.modal-foot button[type=button]');
      if(cancelBtn){cancelBtn.textContent='取消';cancelBtn.className='ep-btn ep-btn-default'}
    },160);
    const cb=this._modalOnClose;this._modalOnClose=null;
    if(typeof cb==='function')try{cb()}catch{}
  },
  rateField(name,label,value=0){
    const v=Math.max(0,Math.min(100,Number(value)||0));
    return `<div class="field full warm-rate"><label>${this.esc(label)} <b id="${name}-val">${v}</b>%</label><input type="range" name="${name}" min="0" max="100" step="1" value="${v}" oninput="document.getElementById('${name}-val').textContent=this.value"></div>`;
  },
  formatFileSize(bytes){if(!bytes||bytes<=0)return '0 B';const units=['B','KB','MB','GB'];const i=Math.min(units.length-1,Math.floor(Math.log(bytes)/Math.log(1024)));return (bytes/Math.pow(1024,i)).toFixed(1)+' '+units[i]},
  shuffleIds(list){
    const arr=(list||[]).map(Number).filter(Boolean);
    for(let i=arr.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      const t=arr[i];arr[i]=arr[j];arr[j]=t;
    }
    return arr;
  },
  async remove(path,name){if(!(await this.ask(`确定删除这个${name}吗？`)))return;try{await this.api(path,{method:'DELETE'});this.toast(`${name}已删除`);await this.loadRefs();this.refresh()}catch(e){this.toast(e.message,true)}},
  async renderAccounts(){
    document.querySelector('#content').classList.remove('chat-mode');
    if((this.accountPane||'list')==='io'){await this.renderAccountIo();return}
    const [accStats,d]=await Promise.all([this.api('/accounts/stats'),this.api(`/accounts?page=${this.accountPage||1}&pageSize=20&keyword=${encodeURIComponent(this.accountKeyword||'')}&status=${encodeURIComponent(this.accountStatus||'')}${this.accountGroupId?`&groupId=${this.accountGroupId}`:''}${this.accountCapcut?`&capcut=${this.accountCapcut}`:''}${this.accountSession?`&session=${this.accountSession}`:''}`)]);
    const gs=this.groups.filter(g=>g.type==='account');
    const pane=this.accountPane||'list';
    const hideStats=this.accountStatsHidden;
    const offline=Math.max(0,(accStats.total||0)-(accStats.online||0));
    document.querySelector('#content').innerHTML=`<div class="workspace accounts-workspace">
      <aside class="side-groups account-sidebar">
        <div class="sidebar-header"><h3>账号分组 <span class="count-pill">${gs.length}</span></h3>${this.canPermission('group.manage')?`<button class="primary tiny" onclick="app.groupModal('account')">添加</button>`:''}</div>
        <div class="group-list">
          ${this.accountGroupSidebarHtml(accStats)}
        </div>
      </aside>
      <div class="account-main-wrapper">
        <div class="subtabs"><button class="${pane==='list'?'active':''}" onclick="app.switchAccountPane('list')">账号列表</button><button class="${pane==='browser'?'active':''}" onclick="app.switchAccountPane('browser')">浏览器环境</button></div>
        <div id="account-main"></div>
      </div>
    </div>`;
    if(pane==='browser'){await this.mountBrowser();return}
    document.querySelector('#account-main').innerHTML=`<div class="account-main-panel">
      <div id="account-batch-panel" class="batch-panel hidden">
        <div class="batch-info">已选择 <strong id="account-selected-count">0</strong> 个账号</div>
      </div>
      <div class="account-toolbar">
        <div class="action-buttons">
          <button class="ghost" onclick="app.openAccountIo()">导入导出</button>${this.canPermission('account.create')?`<button class="ghost" onclick="app.accountModal()">添加账号</button>`:''}
          <div class="dropdown"><button class="ghost" type="button" onclick="app.toggleAccountBatchMenu(event)">批量操作 <span class="btn-arrow-down">▾</span></button>
            <div id="account-batch-menu" class="dropdown-menu align-left hidden">
              <button type="button" onclick="app.batchSyncMessages(true)">开启同步标记</button>
              <button type="button" onclick="app.batchSyncMessages(false)">取消同步标记</button>
              <button type="button" onclick="app.batchModifyProfiles()">批量修改</button>
              <button type="button" onclick="app.batchDeleteVideos()">批量删视频</button>
              <button type="button" onclick="app.batchLoginAccounts()">批量登录</button>
              <button type="button" onclick="app.runAccountMonitor()">同步账号资料</button>
              <button type="button" onclick="app.extractFingerprints()">提取指纹</button>
              ${this.canPermission('account.delete')?`<button type="button" onclick="app.deleteBannedAccounts()">删除封号</button>`:''}
              <button type="button" onclick="app.monitorModal()">监控设置</button>
              ${this.canPermission('account.delete')?`<button type="button" class="is-danger" onclick="app.batchDeleteAccounts()">批量删除账号</button>`:''}
            </div>
          </div>
        </div>
        <div class="search-bar">
          <input id="search" class="input" placeholder="搜索账号 / 昵称" value="${this.esc(this.accountKeyword||'')}" onkeydown="if(event.key==='Enter')app.searchAccounts()">
          <select id="account-status"><option value="">登录状态</option>${this.loginStatusPairs().map(([v,n])=>`<option value="${v}" ${this.accountStatus===v?'selected':''}>${this.esc(n)}</option>`).join('')}</select>
          <select id="account-capcut" onchange="app.accountCapcut=this.value;app.accountPage=1;app.refresh()"><option value="">CapCut标记全部</option><option value="1" ${this.accountCapcut==='1'?'selected':''}>本地已标</option><option value="0" ${this.accountCapcut==='0'?'selected':''}>未标记</option></select>
          <select id="account-session" onchange="app.accountSession=this.value;app.accountPage=1;app.refresh()"><option value="">会话全部</option><option value="1" ${this.accountSession==='1'?'selected':''}>有CK</option></select>
          <button class="primary" onclick="app.searchAccounts()">查询</button>
          <button class="info" onclick="app.resetAccountFilters()">重置</button>
        </div>
      </div>
      <div class="stats-panel ${hideStats?'hidden':''}" id="account-stats-panel">
        <div class="stats-panel-head"><h3>账号统计</h3><div class="stats-panel-acts"><button class="tiny" type="button" title="刷新统计" onclick="app.refresh()">刷新</button><button class="tiny" type="button" onclick="app.toggleAccountStats()">${hideStats?'显示统计':'隐藏统计'}</button></div></div>
        <div class="stats-container">
          ${this.statChip('info','账号总数',accStats.total||0,'users')}
          ${this.statChip('ok','已登录',accStats.online||0,'check')}
          ${this.statChip('','未登录',offline,'logout')}
          ${this.statChip('warn','封号数',accStats.banned||0,'ban', Number(accStats.banned)>0 ? 'app.deleteBannedAccounts()' : '')}
          ${this.statChip('fans','总粉丝',accStats.followers||0,'fans')}
          ${this.statChip('','总关注',accStats.following||0,'follow')}
          ${this.statChip('','总获赞',accStats.likes||0,'heart')}
          ${this.statChip('','视频数',accStats.videos||accStats.syncedVideos||0,'video')}
          ${this.statChip('info','有会话CK',accStats.with_session||0,'key')}
          ${this.statChip('info','CapCut本地标',accStats.capcut||0,'cut')}
        </div>
      </div>
      ${hideStats?`<div style="margin-bottom:12px"><button class="tiny" type="button" onclick="app.toggleAccountStats()">显示统计</button></div>`:''}
      <div class="table-container">${this.accountsTable(d.items)}</div>
      ${UI.pager(d,'accountPage')}
    </div>`;
    this.bindAccountChecks();
  },
  toggleAccountStats(){this.accountStatsHidden=!this.accountStatsHidden;this.refresh()},
  bindAccountChecks(){
    const update=()=>{
      const n=document.querySelectorAll('.account-check:checked').length;
      const panel=document.querySelector('#account-batch-panel');
      const count=document.querySelector('#account-selected-count');
      if(count)count.textContent=String(n);
      if(panel)panel.classList.toggle('hidden',n===0);
    };
    document.querySelectorAll('.account-check').forEach(el=>el.addEventListener('change',update));
    update();
  },
  
  filterAccountGroup(id){this.accountGroupId=id?String(id):'';this.accountPage=1;this.accountPane='list';this.refresh()},
  toggleAccountGroupFold(id, ev){
    if(ev){ev.stopPropagation();ev.preventDefault()}
    this.accountGroupFold=this.accountGroupFold||{};
    const k=String(id);
    this.accountGroupFold[k]=!this.accountGroupFold[k];
    this.refresh();
  },
  accountGroupFlatOptions(){
    const all=(this.groups||[]).filter(g=>g.type==='account');
    const roots=all.filter(g=>!g.parent_id);
    const kids=all.filter(g=>g.parent_id);
    const out=[];
    const used=new Set();
    for(const r of roots){
      out.push({id:r.id, name:r.name});
      used.add(Number(r.id));
      for(const c of kids.filter(k=>Number(k.parent_id)===Number(r.id))){
        out.push({id:c.id, name:'　└ '+c.name});
        used.add(Number(c.id));
      }
    }
    for(const g of all){
      if(!used.has(Number(g.id))) out.push({id:g.id, name:g.name});
    }
    return out;
  },
  accountGroupSidebarHtml(accStats){
    const all=(this.groups||[]).filter(g=>g.type==='account');
    const roots=all.filter(g=>!g.parent_id);
    const kids=all.filter(g=>g.parent_id);
    const fold=this.accountGroupFold||{};
    const canManage=this.canPermission('group.manage');
    const item=(g, isChild)=>{
      const active=String(this.accountGroupId)===String(g.id);
      const children=kids.filter(k=>Number(k.parent_id)===Number(g.id));
      const hasKids=!isChild && children.length>0;
      const folded=!!fold[String(g.id)];
      const foldBtn=hasKids?`<span class="group-fold" title="${folded?'展开':'收起'}" onclick="app.toggleAccountGroupFold(${g.id},event)">${folded?'▸':'▾'}</span>`:'';
      const addChild=(!isChild && canManage)?`<span class="group-act" title="添加公司子组" onclick="event.stopPropagation();app.groupModal('account',{parent_id:${g.id}})">+</span>`:'';
      return `<button type="button" class="group-item-modern ${isChild?'is-child':''} ${active?'active':''}" onclick="app.filterAccountGroup(${g.id})">
        <div class="row"><b>${foldBtn}${this.esc(g.name)}</b><span class="group-side-acts"><span class="pool">${isChild?'公司':'账号池'}</span>${canManage?`<span class="group-act" title="编辑" onclick="event.stopPropagation();app.editGroup(${g.id})">改</span>`:''}${canManage?`<span class="group-act danger" title="删除" onclick="event.stopPropagation();app.remove('/groups/${g.id}','账号分组')">删</span>`:''}${addChild}</span></div>
        <div class="row meta"><span>${this.esc((g.created_at||'').slice(0,10)||'')}</span><span>${g.member_count||0}</span></div>
      </button>${hasKids && !folded ? children.map(c=>item(c,true)).join('') : ''}`;
    };
    const rootHtml=roots.map(r=>item(r,false)).join('');
    const orphan=kids.filter(k=>!roots.some(r=>Number(r.id)===Number(k.parent_id)));
    return `<button type="button" class="group-item-modern ${this.accountGroupId?'':'active'}" onclick="app.filterAccountGroup('')"><div class="row"><b>全部账号</b><span class="pool">账号池</span></div><div class="row meta"><span>全部</span><span>${accStats.total||0}</span></div></button>
          ${rootHtml}${orphan.map(c=>item(c,true)).join('')}`;
  },
  switchAccountPane(pane){this.accountPane=pane==='browser'?'browser':'list';this.refresh()},
  async mountBrowser(){const host=document.querySelector('#account-main');const status=await this.api('/browser/status');if(!status.online){host.innerHTML=`<div class="account-main-panel"><div class="empty"><h2>比特浏览器未连接</h2><p>${this.esc(status.message)}</p><p>请启动比特浏览器，并确认本地 API 地址为 ${this.esc(status.apiUrl)}</p><button class="primary" onclick="app.refresh()">重新检测</button></div></div>`;return}const d=await this.api('/browser/profiles?pageSize=500');const pack=UI.paginateLocal(d.items||[],this.browserPage||1,20);this.browserPage=pack.page;host.innerHTML=`<div class="account-main-panel"><div class="toolbar"><span class="muted">创建环境时会自动使用账号绑定的代理。</span><div>${this.canPermission('account.create')?`<button class="primary" onclick="app.batchCreateBrowserModal()">批量创建环境</button>`:''}<div class="dropdown" style="display:inline-block"><button class="ghost" type="button" onclick="app.toggleBrowserBatchMenu(event)">批量操作 <span class="btn-arrow-down">▾</span></button><div id="browser-batch-menu" class="dropdown-menu align-left hidden">${this.canPermission('account.create')?`<button type="button" class="is-danger" onclick="app.batchDeleteBrowser()">批量删除环境</button>`:''}<button type="button" onclick="app.refresh()">同步环境</button></div></div></div></div><div class="table-container">${this.browserTable(pack.items)}</div>${UI.pager(pack,'browserPage')}</div>`},
  accountsTable(rows){
    if(!rows.length)return '<div class="empty">还没有账号</div>';
    const canWrite=this.canPermission('account.create');
    const canDelete=this.canPermission('account.delete');
    const canAssign=this.canAssignAccounts();
    return `<table><thead><tr>
    <th><input type="checkbox" onchange="app.toggleAllAccounts(this.checked)" title="全选"></th>
    <th>账号</th><th>国家</th><th>分组</th><th>代理IP</th><th>登录</th><th>2FA</th><th>指纹</th><th>CK</th><th>CapCut标</th><th>客服</th><th>昵称</th><th>备注</th><th>操作</th>
  </tr></thead><tbody>${rows.map(x=>{
      const more=[];
      if(canAssign)more.push(`<button type="button" onclick="app.batchAssignAccounts([${x.id}])">分配给用户</button>`);
      more.push(`<button type="button" onclick="app.accountSecretsModal(${x.id},'${this.esc(x.username)}')">密码/2FA</button>`);
      more.push(`<button type="button" onclick="app.copyAccountCk(${x.id})">复制CK</button>`);
      more.push(`<button type="button" onclick="app.editAccountSession(${x.id})">修改CK</button>`);
      more.push(`<button type="button" onclick="app.addAccountSocks(${x.id})">添加SOCKS5</button>`);
      if(x.browser_profile_id){
        more.push(`<button type="button" onclick="app.browserAction('${this.esc(x.browser_profile_id)}','open')">打开环境</button>`);
        more.push(`<button type="button" onclick="app.loginAssist(${x.id})">登录辅助</button>`);
      }else{
        more.push(`<button type="button" onclick="app.createAccountBrowser(${x.id})">创建环境</button>`);
      }
      more.push(`<button type="button" onclick="app.checkAccountLogin(${x.id})">检测登录</button>`);
      if(x.login_status==='online'&&x.browser_profile_id)more.push(`<button type="button" onclick="app.chatConnect(${x.id})">登录客服</button>`);
      if(x.login_status==='online'&&!x.capcut_authorized)more.push(`<button type="button" onclick="app.authorizeCapCut(${x.id})">本地标记CapCut</button>`);
      if(x.capcut_authorized)more.push(`<button type="button" onclick="app.revokeCapCut(${x.id})">取消本地CapCut</button>`);
      more.push(`<button type="button" onclick="app.syncTikTokProfile(${x.id})">同步资料</button>`);
      more.push(`<button type="button" onclick="app.modifyAccountProfile(${x.id},'${this.esc(x.username)}')">修改资料</button>`);
      more.push(`<button type="button" onclick="app.syncTikTokVideos(${x.id})">同步视频</button>`);
      more.push(`<button type="button" onclick="app.viewTikTokData(${x.id})">查看数据</button>`);
      more.push(`<button type="button" onclick="app.viewDiagnostics(${x.id})">诊断截图</button>`);
      const editBtn=`<button class="tiny" type="button" title="编辑" onclick='app.accountModal(${JSON.stringify(x)})' ${canWrite?'':'disabled'}>编辑</button>`;
      const delBtn=`<button class="tiny danger" type="button" title="删除" onclick="app.remove('/accounts/${x.id}','账号')" ${canDelete?'':'disabled title="无删除权限"'}>删除</button>`;
      const moreBtn=`<div class="ops-dropdown account-ops-dropdown"><button class="tiny" type="button" title="更多" onclick="app.toggleAccountOps(${x.id},event)">…</button><div id="account-ops-${x.id}" class="dropdown-menu ops-menu hidden">${more.join('')}</div></div>`;
      return `<tr>
    <td><input class="account-check" type="checkbox" value="${x.id}"></td>
    <td><b>${this.esc(x.username)}</b><div class="muted">#${x.id}${x.account_status==='banned'?' · 封号':''}</div></td>
    <td>${this.esc(x.country||'-')}</td>
    <td>${this.esc(x.group_name||'-')}</td>
    <td title="${this.esc(x.proxy_address||'')}">${this.esc((x.proxy_address||'-').slice(0,28))}</td>
    <td>${this.badge(x.login_status)}</td>
    <td>${x.has_totp?'<span class="badge success">已绑定</span>':'<span class="badge">未绑定</span>'}</td>
    <td>${x.has_fingerprint?'<span class="badge success">已有</span>':'<span class="badge">无</span>'}</td>
    <td>${x.has_session||x.session_saved?'<span class="badge success">CK</span>':'<span class="badge">无</span>'}</td>
    <td>${x.capcut_authorized?'<span class="badge online" title="仅本地标记">本地已标</span>':'<span class="badge">未标记</span>'}</td>
    <td>${this.badge(x.chat_status)}</td>
    <td class="nickname-cell" title="点击编辑昵称（仅本系统）" style="cursor:pointer;color:#409eff" onclick="event.stopPropagation();app.editAccountNickname(${x.id},${JSON.stringify(x.username||'')},${JSON.stringify(x.nickname||'')})">${this.esc(x.nickname||'-')}</td>
    <td class="notes-cell" title="点击编辑备注" style="cursor:pointer;color:#409eff" onclick="event.stopPropagation();app.editAccountNotes(${x.id},${JSON.stringify(x.username||'')},${JSON.stringify(x.notes||'')})">${this.esc((x.notes||'-').slice(0,16))}</td>
    <td><div class="task-ops-cell account-ops-cell">${editBtn}${delBtn}${moreBtn}</div></td>
  </tr>`;
    }).join('')}</tbody></table>`;
  },
  toggleAccountOps(id,e){
    e?.stopPropagation?.();
    const target=document.querySelector('#account-ops-'+id);
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
  toggleAllAccounts(checked){document.querySelectorAll('.account-check').forEach(x=>{x.checked=checked});this.bindAccountChecks()},
  async batchDeleteAccounts(){const ids=[...document.querySelectorAll('.account-check:checked')].map(x=>Number(x.value));if(!ids.length){this.toast('请先选择要删除的账号',true);return}if(!(await this.ask(`确定删除选中的 ${ids.length} 个账号吗？账号密码和 2FA 密钥也会被删除；对应的比特浏览器环境不会自动删除。`)))return;try{const r=await this.api('/accounts/batch-delete',{method:'POST',body:JSON.stringify({accountIds:ids})});this.toast(`已删除 ${r.deleted} 个账号`);await this.loadRefs();this.refresh()}catch(e){this.toast(e.message,true)}},
  resetAccountFilters(){this.accountKeyword='';this.accountStatus='';this.accountCapcut='';this.accountSession='';this.accountPage=1;this.refresh()},
  async searchAccounts(){this.accountKeyword=document.querySelector('#search')?.value||'';this.accountStatus=document.querySelector('#account-status')?.value||'';this.accountPage=1;this.refresh()},
  accountModal(x={}){const gs=this.accountGroupFlatOptions();this.modal(x.id?'编辑账号':'添加账号',`<div class="form-grid"><input type="hidden" name="id" value="${x.id||''}">${this.field('username','账号名称',x.username,'text',true)}${this.field('nickname','昵称',x.nickname)}${this.select('groupId','账号分组',gs,x.group_id)}${this.select('proxyId','代理',this.proxies.map(p=>({id:p.id,name:p.name+' · '+p.host})),x.proxy_id)}${this.selectRaw('browserType','浏览器类型',this.browserTypePairs(),x.browser_type||'bit')}${this.field('browserProfileId','环境 ID',x.browser_profile_id)}${this.selectRaw('loginStatus','登录状态',this.loginStatusPairs(),x.login_status||'offline')}${this.selectRaw('dmChannel','私信通道',[['auto','自动（有指纹走 API）'],['api','仅 API'],['browser','仅浏览器']],x.dm_channel||'auto')}${this.field('notes','备注',x.notes,'textarea')}</div>`,async data=>{const id=data.id;delete data.id;data.groupId=data.groupId?Number(data.groupId):null;data.proxyId=data.proxyId?Number(data.proxyId):null;data.chatStatus=x.chat_status||'offline';data.enabled=true;await this.api(id?`/accounts/${id}`:'/accounts',{method:id?'PUT':'POST',body:JSON.stringify(data)});this.toast('账号已保存');this.closeModal();this.refresh()})},
  editAccountNickname(id,username,nickname=''){if(!this.canPermission('account.create')){this.toast('当前角色无权修改昵称',true);return}this.modal('编辑昵称',`<div class="form-grid"><div class="field full"><div class="muted">账号：${this.esc(username||('#'+id))}。仅更新本系统展示昵称，不会改 TikTok。</div></div>${this.field('nickname','昵称',nickname||'')}</div>`,async d=>{await this.api(`/accounts/${id}/nickname`,{method:'PATCH',body:JSON.stringify({nickname:d.nickname||''})});this.toast('昵称已更新');this.closeModal();this.refresh()})},
  editAccountNotes(id,username,notes=''){if(!this.canPermission('account.create')){this.toast('当前角色无权修改备注',true);return}this.modal('编辑备注',`<div class="form-grid"><div class="field full"><div class="muted">账号：${this.esc(username||('#'+id))}</div></div>${this.field('notes','备注',notes||'','textarea')}<div class="field full"><div class="muted">备注仅保存在本系统，不会写入 TikTok。</div></div></div>`,async d=>{await this.api(`/accounts/${id}/notes`,{method:'PATCH',body:JSON.stringify({notes:d.notes||''})});this.toast('备注已更新');this.closeModal();this.refresh()})},
  accountSecretsModal(id,username){this.modal('修改密码和 2FA 密钥',`<div class="form-grid"><div class="field full"><div class="muted">账号：${this.esc(username)}。留空的字段不会修改；已保存的密码和密钥不会显示。</div></div>${this.field('password','新密码','','password')}${this.field('totpSecret','新 2FA 密钥','','password')}<div class="field full"><div class="muted">2FA 密钥必须是 Base32 格式，保存时使用本机 AES-256-GCM 加密。</div></div></div>`,async data=>{if(!data.password&&!data.totpSecret)throw new Error('请至少填写一项');await this.api(`/accounts/${id}/secrets`,{method:'PUT',body:JSON.stringify(data)});this.toast('密码/2FA 密钥已安全更新');this.closeModal()})},
  openAccountIo(tab){
    if(!this.canPermission('account.create')&&tab==='import'){this.toast('当前角色无权导入账号',true);return}
    this.view='accounts';
    this.accountPane='io';
    this.accountIoTab=tab==='import'?'import':'export';
    if(!Array.isArray(this.accountIoFields)||!this.accountIoFields.length)this.accountIoFields=this.defaultAccountIoFields();
    this.refresh();
  },
  closeAccountIo(){this.accountPane='list';this.refresh()},
  switchAccountIoTab(tab){this.accountIoTab=tab==='import'?'import':'export';this.refresh()},
  defaultAccountIoFields(){
    const fromMeta=this.meta?.exportFields;
    if(Array.isArray(fromMeta)&&fromMeta.length){
      return fromMeta.map(x=>({key:x.code,label:x.label||x.code,on:x.defaultOn!==false}));
    }
    return [
      {key:'id',label:'ID',on:false},
      {key:'username',label:'账号',on:true},
      {key:'nickname',label:'昵称',on:true},
      {key:'country',label:'国家',on:true},
      {key:'group',label:'分组',on:true},
      {key:'proxy',label:'代理',on:true},
      {key:'login',label:'登录状态',on:true},
      {key:'session',label:'会话',on:true},
      {key:'capcut',label:'CapCut',on:true},
      {key:'status',label:'账号状态',on:true},
      {key:'chat',label:'客服状态',on:false},
      {key:'notes',label:'备注',on:false},
      {key:'created_at',label:'创建时间',on:false},
      {key:'browser',label:'浏览器环境ID',on:false},
    ];
  },
  async renderAccountIo(){
    document.querySelector('#content').classList.remove('chat-mode');
    const tab=this.accountIoTab||'export';
    if(!Array.isArray(this.accountIoFields)||!this.accountIoFields.length)this.accountIoFields=this.defaultAccountIoFields();
    const f=this.accountIoFilter||{};
    await this.loadRefs();
    if(!this.meta?.importFormats?.length)await this.loadMeta();
    const gs=this.accountGroupFlatOptions();
    document.querySelector('#content').innerHTML=`<div class="panel task-io-panel account-io-panel">
      <div class="task-io-head">
        <button class="ghost" type="button" onclick="app.closeAccountIo()">← 返回账号列表</button>
        <div class="task-io-title-row">
          <b class="task-io-title">导入导出</b>
          <span class="muted">导出可自定义字段与表头；导入使用固定多格式文本模板</span>
        </div>
      </div>
      <div class="subtabs" style="margin-bottom:14px">
        <button type="button" class="${tab==='export'?'active':''}" onclick="app.switchAccountIoTab('export')">导出数据</button>
        <button type="button" class="${tab==='import'?'active':''}" onclick="app.switchAccountIoTab('import')">导入数据</button>
      </div>
      ${tab==='import'?this.accountIoImportBody(gs):this.accountIoExportBody(f,gs)}
    </div>`;
  },
  accountIoExportBody(f,gs){
    f=f||{};
    gs=gs||[];
    const loginOpts=[['','全部登录状态'],...this.loginStatusPairs()];
    const statusOpts=[['','全部账号状态'],['normal','正常'],['banned','封号']];
    const fields=this.accountIoFields||[];
    return `<div class="task-io-export">
      <div class="form-grid task-io-filters">
        <div class="field"><label>关键词</label><input id="aio-keyword" class="input" type="search" placeholder="账号 / 昵称 / 备注" value="${this.esc(f.keyword||'')}"></div>
        <div class="field"><label>登录状态</label><select id="aio-login" class="input">${loginOpts.map(([v,n])=>`<option value="${this.esc(v)}" ${String(f.login||'')===v?'selected':''}>${this.esc(n)}</option>`).join('')}</select></div>
        <div class="field"><label>账号状态</label><select id="aio-status" class="input">${statusOpts.map(([v,n])=>`<option value="${this.esc(v)}" ${String(f.accountStatus||'')===v?'selected':''}>${this.esc(n)}</option>`).join('')}</select></div>
        <div class="field"><label>分组</label><select id="aio-group" class="input"><option value="">全部分组</option><option value="none" ${f.groupId==='none'?'selected':''}>未分组</option>${gs.map(g=>`<option value="${g.id}" ${String(f.groupId||'')===String(g.id)?'selected':''}>${this.esc(g.name)}</option>`).join('')}</select></div>
        <div class="field"><label>国家</label><input id="aio-country" class="input" placeholder="可空" value="${this.esc(f.country||'')}"></div>
        <div class="field"><label>CapCut</label><select id="aio-capcut" class="input"><option value="">全部</option><option value="1" ${f.capcut==='1'?'selected':''}>本地已标</option><option value="0" ${f.capcut==='0'?'selected':''}>未标记</option></select></div>
        <div class="field"><label>会话 CK</label><select id="aio-session" class="input"><option value="">全部</option><option value="1" ${f.session==='1'?'selected':''}>有CK</option></select></div>
        <div class="field"><label>ID 最小</label><input id="aio-id-min" class="input" type="number" min="0" placeholder="可空" value="${this.esc(f.idMin||'')}"></div>
        <div class="field"><label>ID 最大</label><input id="aio-id-max" class="input" type="number" min="0" placeholder="可空" value="${this.esc(f.idMax||'')}"></div>
        <div class="field"><label>仅勾选账号</label><select id="aio-selected-only" class="input"><option value="0">否（按筛选）</option><option value="1" ${f.selectedOnly?'selected':''}>是（列表页勾选）</option></select></div>
        <div class="field"><label>导出格式</label><select id="aio-format" class="input"><option value="csv" ${!f.format||f.format==='csv'?'selected':''}>CSV</option><option value="txt" ${f.format==='txt'?'selected':''}>TXT</option><option value="json" ${f.format==='json'?'selected':''}>JSON</option></select></div>
      </div>
      <div class="field full" style="margin:12px 0 8px"><label>导出字段与表头（勾选并自定义表头名）</label></div>
      <div class="table-container task-io-fields-table" style="margin-bottom:14px">
        <table><thead><tr><th style="width:56px">导出</th><th>字段</th><th>表头名</th></tr></thead>
        <tbody>${fields.map((x,i)=>`<tr>
          <td><input type="checkbox" class="aio-field-on" data-idx="${i}" ${x.on?'checked':''}></td>
          <td><code>${this.esc(x.key)}</code></td>
          <td><input class="input aio-field-label" data-idx="${i}" value="${this.esc(x.label||'')}" style="width:100%;max-width:280px"></td>
        </tr>`).join('')}</tbody></table>
      </div>
      <div class="action-bar">
        <button class="primary" type="button" onclick="app.submitAccountIoExport()">导出</button>
        <button class="ghost" type="button" onclick="app.resetAccountIoExport()">重置筛选与字段</button>
      </div>
    </div>`;
  },
  accountIoImportBody(gs){
    gs=gs||[];
    const pgs=this.groups.filter(g=>g.type==='proxy');
    const proxyItems=this.proxies.map(p=>({id:p.id,name:p.name+' · '+p.host}));
    const formats=this.meta?.importFormats||[{id:'auto',label:'自动识别'}];
    const formatOpts=formats.map(f=>`<option value="${this.esc(f.id)}"${f.id==='auto'?' selected':''}>${this.esc(f.label)}</option>`).join('');
    return `<div class="task-io-import">
      <div class="shell-note" style="margin:0 0 14px">
        <b>固定格式说明：</b>每行一条账号，支持账号----密码、账号----密码----2FA、账号----密码----CK、账号----CK、仅 CK、邮箱----密码----用户名----国家、以及 JSON 行。<br>
        密码与 CK 本地 AES 加密；重复账号自动跳过。可先下载模板对照填写。
      </div>
      <div class="action-bar" style="margin-bottom:12px">
        <button class="primary" type="button" onclick="app.downloadAccountImportTemplate()">下载导入模板</button>
        <label class="ghost" style="display:inline-flex;align-items:center;padding:8px 14px;cursor:pointer;border:1px solid #dcdfe6;border-radius:4px">选择文本文件<input type="file" accept=".txt,.csv,text/plain,text/csv" hidden onchange="app.loadAccountImportFile(this)"></label>
      </div>
      <div class="form-grid">
        <div class="field"><label>账号分组</label><select id="aio-import-group" class="input"><option value="">不指定</option>${gs.map(g=>`<option value="${g.id}">${this.esc(g.name)}</option>`).join('')}</select></div>
        <div class="field"><label>账号格式</label><select id="aio-import-format" class="input">${formatOpts}</select></div>
        <div class="field"><label>代理绑定方式</label><select id="aio-import-proxy-strategy" class="input"><option value="sequential">按代理顺序绑定（推荐）</option><option value="single">全部绑定同一代理</option><option value="none">不绑定代理</option></select></div>
        <div class="field"><label>顺序代理分组</label><select id="aio-import-proxy-group" class="input"><option value="">不指定</option>${pgs.map(g=>`<option value="${g.id}">${this.esc(g.name)}</option>`).join('')}</select></div>
        <div class="field"><label>统一绑定代理</label><select id="aio-import-proxy" class="input"><option value="">不指定</option>${proxyItems.map(p=>`<option value="${p.id}">${this.esc(p.name)}</option>`).join('')}</select></div>
        <div class="field"><label>浏览器类型</label><select id="aio-import-browser" class="input">${this.browserTypePairs().map(([v,n])=>`<option value="${this.esc(v)}" ${v==='bit'?'selected':''}>${this.esc(n)}</option>`).join('')}</select></div>
        <div class="field"><label>国家/地区</label><input id="aio-import-country" class="input" placeholder="可空"></div>
        <div class="field full"><label>账号列表</label><textarea id="aio-import-content" class="input" rows="12" placeholder="每行一条账号，或选择文件自动填入"></textarea></div>
      </div>
      <div class="action-bar" style="margin-top:14px">
        <button class="primary" type="button" onclick="app.submitAccountIoImport()">开始导入</button>
      </div>
      <div id="aio-import-result" class="muted" style="margin-top:12px"></div>
    </div>`;
  },
  collectAccountIoExportForm(){
    const fields=(this.accountIoFields||[]).map((x,i)=>{
      const on=!!document.querySelector(`.aio-field-on[data-idx="${i}"]`)?.checked;
      const label=document.querySelector(`.aio-field-label[data-idx="${i}"]`)?.value ?? x.label;
      return {...x,on,label:String(label||x.key).trim()||x.key};
    });
    this.accountIoFields=fields;
    this.accountIoFilter={
      keyword:document.querySelector('#aio-keyword')?.value||'',
      login:document.querySelector('#aio-login')?.value||'',
      accountStatus:document.querySelector('#aio-status')?.value||'',
      groupId:document.querySelector('#aio-group')?.value||'',
      country:document.querySelector('#aio-country')?.value||'',
      capcut:document.querySelector('#aio-capcut')?.value||'',
      session:document.querySelector('#aio-session')?.value||'',
      idMin:document.querySelector('#aio-id-min')?.value||'',
      idMax:document.querySelector('#aio-id-max')?.value||'',
      selectedOnly:document.querySelector('#aio-selected-only')?.value==='1',
      format:document.querySelector('#aio-format')?.value||'csv',
    };
    return {filter:this.accountIoFilter,fields};
  },
  resetAccountIoExport(){
    this.accountIoFilter={};
    this.accountIoFields=this.defaultAccountIoFields();
    this.refresh();
  },
  async submitAccountIoExport(){
    const {filter,fields}=this.collectAccountIoExportForm();
    const selected=fields.filter(x=>x.on);
    if(!selected.length){this.toast('请至少勾选一个导出字段',true);return}
    const format=filter.format||'csv';
    const q=new URLSearchParams({format,fields:selected.map(x=>x.key).join(',')});
    q.set('headers',JSON.stringify(Object.fromEntries(selected.map(x=>[x.key,x.label]))));
    if(filter.selectedOnly){
      const ids=this.selectedAccountIds?.()||[];
      if(!ids.length){this.toast('请先在账号列表勾选要导出的账号',true);return}
      q.set('ids',ids.join(','));
    }else{
      if(filter.keyword)q.set('keyword',filter.keyword);
      if(filter.login)q.set('status',filter.login);
      if(filter.accountStatus)q.set('accountStatus',filter.accountStatus);
      if(filter.groupId)q.set('groupId',filter.groupId);
      if(filter.country)q.set('country',filter.country);
      if(filter.capcut!=='')q.set('capcut',filter.capcut);
      if(filter.session)q.set('session',filter.session);
      if(filter.idMin)q.set('idMin',filter.idMin);
      if(filter.idMax)q.set('idMax',filter.idMax);
    }
    try{
      const headers=this.authToken?{Authorization:'Bearer '+this.authToken}:{};
      const acting=this.getActingAsId();if(acting)headers['X-Acting-As']=String(acting);
      const base=window.TKSWARM_API_BASE||window.__TKSWARM_CONFIG__?.defaultApiBase||'';
      const r=await fetch(base+'/api/accounts/export?'+q.toString(),{headers});
      if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.message||'导出失败')}
      const text=await r.text();
      if(format==='json'){
        if(!String(text||'').trim()||text.trim()==='[]'){this.toast('没有可导出的账号',true);return}
      }else{
        const lines=String(text||'').split(/\r?\n/).filter(x=>String(x).trim());
        if(lines.length<=(format==='csv'?1:0)){this.toast('没有可导出的账号',true);return}
      }
      const mime=format==='json'?'application/json;charset=utf-8':(format==='csv'?'text/csv;charset=utf-8':'text/plain;charset=utf-8');
      const blob=new Blob([text],{type:mime});
      const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;
      a.download=format==='json'?'accounts-export.json':(format==='csv'?'accounts-export.csv':'accounts-export.txt');
      a.click();URL.revokeObjectURL(url);
      this.toast('账号已导出');
    }catch(e){this.toast(e.message,true)}
  },
  loadAccountImportFile(input){
    const file=input?.files?.[0];if(input)input.value='';
    if(!file)return;
    const reader=new FileReader();
    reader.onload=()=>{const box=document.querySelector('#aio-import-content');if(box)box.value=String(reader.result||'');this.toast(`已读入 ${file.name}`)};
    reader.onerror=()=>this.toast('读取文件失败',true);
    reader.readAsText(file);
  },
  async submitAccountIoImport(){
    if(!this.canPermission('account.create')){this.toast('当前角色无权导入账号',true);return}
    const content=document.querySelector('#aio-import-content')?.value||'';
    if(!String(content).trim()){this.toast('请先粘贴账号列表或选择文件',true);return}
    if(!(await this.ask('将按固定模板导入账号，是否继续？')))return;
    try{
      const r=await this.api('/accounts/batch-import',{method:'POST',body:JSON.stringify({
        content,
        format:document.querySelector('#aio-import-format')?.value||'auto',
        groupId:document.querySelector('#aio-import-group')?.value?Number(document.querySelector('#aio-import-group').value):null,
        proxyStrategy:document.querySelector('#aio-import-proxy-strategy')?.value||'sequential',
        proxyGroupId:document.querySelector('#aio-import-proxy-group')?.value?Number(document.querySelector('#aio-import-proxy-group').value):null,
        proxyId:document.querySelector('#aio-import-proxy')?.value?Number(document.querySelector('#aio-import-proxy').value):null,
        browserType:document.querySelector('#aio-import-browser')?.value||'bit',
        country:document.querySelector('#aio-import-country')?.value||'',
      })});
      const box=document.querySelector('#aio-import-result');
      let message=`成功 ${r.imported||0}，重复 ${r.duplicates||0}，错误 ${(r.errors||[]).length}`;
      if(r.errors?.length)message+=`；首个错误在第 ${r.errors[0].line} 行：${r.errors[0].reason}`;
      if(box)box.textContent=message;
      this.toast(r.imported?`已导入 ${r.imported} 个账号`:message,!r.imported);
      await this.loadRefs();
    }catch(e){this.toast(e.message,true)}
  },

  async batchAccountModal(){return this.openAccountIo('import')},
  downloadAccountImportTemplate(){
    const text=[
      '# TkSwarm 账号导入模板（删除说明行后导入）',
      '# 格式一：账号----密码',
      'demo_user----Passw0rd!',
      '# 格式二：账号----密码----2FA(Base32)',
      'demo_user2----Passw0rd!----JBSWY3DPEHPK3PXP',
      '# 格式三：账号----密码----CK',
      'demo_user3----Passw0rd!----sessionid=xxxxx; sid_tt=yyyyy',
      '# 格式四：账号----CK',
      'demo_user4----sessionid=xxxxx; sid_tt=yyyyy',
      '# 格式五：仅 CK（将自动生成临时用户名）',
      'sessionid=xxxxx; sid_tt=yyyyy',
      '# 格式六：邮箱----密码----用户名----国家',
      'user@mail.com----Passw0rd!----tiktok_name----US',
      '# 格式七：JSON 每行一条',
      '{"username":"json_user","password":"Passw0rd!","country":"US","cookie":"sessionid=xxx"}',
    ].join('\n');
    const blob=new Blob([text],{type:'text/plain;charset=utf-8'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='tkswarm-account-import-template.txt';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
    this.toast('模板已下载');
  },
  async checkAccountLogin(id){if(!(await this.ensureBitOnline('检测登录')))return;this.toast('正在检测 TikTok 登录状态...');try{const a=await this.api(`/accounts/${id}`);if(!a.browser_profile_id){this.toast('账号尚未绑定浏览器环境',true);return}const r=await this.api(`/browser/profiles/${a.browser_profile_id}/tiktok-status`,{method:'POST'});this.toast(r.loggedIn?'TikTok 已登录，状态已保存':'未检测到有效登录会话',!r.loggedIn);this.refresh()}catch(e){this.toast(e.message,true)}},
  async viewDiagnostics(id){try{const files=await this.api(`/browser/accounts/${id}/diagnostics`);this.modal('账号诊断截图',files.length?files.map(f=>`<div class="diagnostic-item"><a href="${f.download}" target="_blank">${this.esc(f.name)}</a></div>`).join(''):'<div class="empty">暂无诊断截图</div>',()=>this.closeModal())}catch(e){this.toast(e.message,true)}},
  async syncTikTokProfile(id){if(!(await this.ensureBitOnline('同步资料')))return;this.toast('正在读取 TikTok 公开资料，请稍候...');try{const r=await this.api(`/browser/accounts/${id}/sync-profile`,{method:'POST'});this.toast(`资料同步完成：${r.displayName||r.handle}`);this.refresh()}catch(e){this.toast(e.message,true)}},
  async syncTikTokVideos(id){if(!(await this.ensureBitOnline('同步视频')))return;this.toast('正在读取 TikTok 视频列表，请稍候...');try{const r=await this.api(`/browser/accounts/${id}/sync-videos`,{method:'POST',body:JSON.stringify({limit:100})});this.toast(`视频同步完成：${r.count} 条`);this.refresh()}catch(e){this.toast(e.message,true)}},
  async viewTikTokData(id){try{const [profile,videos,stats]=await Promise.all([this.api(`/accounts/${id}/tiktok-profile`),this.api(`/accounts/${id}/tiktok-videos`),this.api(`/accounts/${id}/tiktok-stats`)]);const p=profile||{};this.modal('TikTok 账号数据',`<div class="data-summary"><div><small>用户名</small><b>${this.esc(p.handle||'-')}</b></div><div><small>显示名称</small><b>${this.esc(p.display_name||'-')}</b></div><div><small>粉丝</small><b>${p.followers_count??'-'}</b></div><div><small>关注</small><b>${p.following_count??'-'}</b></div><div><small>获赞</small><b>${p.likes_count??'-'}</b></div><div><small>视频</small><b>${videos.length}</b></div></div><div class="data-meta">最后同步：${this.esc(p.last_synced_at||'尚未同步')}</div><div class="action-bar" style="margin:10px 0"><button class="ghost" type="button" onclick="app.syncTikTokProfile(${id}).then(()=>app.viewTikTokData(${id}))">同步资料</button><button class="primary" type="button" onclick="app.syncTikTokVideos(${id}).then(()=>app.viewTikTokData(${id}))">同步视频</button><button class="ghost" type="button" onclick="app.modifyAccountProfile(${id},'${this.esc(p.handle||'')}')">修改资料</button></div><h3>最近同步视频</h3>${videos.length?`<table><thead><tr><th>封面</th><th>视频 ID</th><th>描述</th><th>同步时间</th><th>操作</th></tr></thead><tbody>${videos.slice(0,20).map(v=>`<tr><td>${v.thumbnail_url?`<img src="${this.esc(v.thumbnail_url)}" alt="" style="width:48px;height:64px;object-fit:cover;border-radius:4px">`:'-'}</td><td>${this.esc(v.video_id)}</td><td>${this.esc(v.description||'-')}</td><td>${this.esc(v.last_synced_at)}</td><td><button class="tiny" type="button" onclick='app.previewTikTokVideo(${JSON.stringify({url:String(v.video_url||''),thumb:String(v.thumbnail_url||''),desc:String(v.description||''),id:String(v.video_id||'')})})'>预览</button> <button class="tiny" type="button" onclick='app.copyText(${JSON.stringify(String(v.video_url||''))})'>复制链接</button> <a class="tiny" href="${this.esc(v.video_url)}" target="_blank" rel="noreferrer" style="display:inline-flex;align-items:center">打开</a> <button class="tiny danger" type="button" onclick='app.deleteTikTokVideo(${id},${JSON.stringify(String(v.video_id||''))},${JSON.stringify(String(v.video_url||''))})'>删除</button></td></tr>`).join('')}</tbody></table>`:'<div class="empty">暂无视频数据，请点击上方「同步视频」</div>'}<h3>历史统计（最近 30 次）</h3>${stats.length?`<table><thead><tr><th>时间</th><th>粉丝</th><th>关注</th><th>获赞</th></tr></thead><tbody>${stats.map(s=>`<tr><td>${this.esc(s.captured_at)}</td><td>${s.followers_count??'-'}</td><td>${s.following_count??'-'}</td><td>${s.likes_count??'-'}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">同步资料后会生成统计快照</div>'}`,()=>this.closeModal())}catch(e){this.toast(e.message,true)}},
  previewTikTokVideo(info={}){
    const url=info.url||'';
    const thumb=info.thumb||'';
    const desc=info.desc||'';
    const vid=info.id||'';
    if(!url){this.toast('没有视频链接',true);return}
    this.modal('视频预览',`<div class="form-grid"><div class="field full" style="text-align:center">${thumb?`<img src="${this.esc(thumb)}" alt="cover" style="max-width:100%;max-height:360px;border-radius:8px">`:'<div class="empty">无封面图</div>'}</div><div class="field full"><div class="muted">作品 ID：${this.esc(vid||'-')}<br>${this.esc(desc||'无描述')}<br><br>本地仅缓存作品页链接与封面，未下载可播放的视频文件。可预览封面或到 TikTok 打开原页。</div></div><div class="action-bar"><a class="primary" href="${this.esc(url)}" target="_blank" rel="noreferrer">在新窗口打开</a> <button class="ghost" type="button" onclick='app.copyText(${JSON.stringify(url)})'>复制链接</button> ${thumb?`<a class="ghost" href="${this.esc(thumb)}" download="tiktok-${this.esc(vid||'cover')}.jpg" target="_blank" rel="noreferrer">下载封面</a>`:''}</div></div>`,async()=>{},false,{hideSubmit:true});
  },
  async setAccountStatus(id,status){await this.api(`/accounts/${id}/status`,{method:'PATCH',body:JSON.stringify({loginStatus:status})});this.refresh()},
  selectedAccountIds(){return [...document.querySelectorAll('.account-check:checked')].map(x=>Number(x.value))},
  toggleAccountBatchMenu(e){
    e?.stopPropagation?.();
    this.toggleToolbarDropdown('#account-batch-menu', e);
  },
  async exportAccounts(){return this.openAccountIo('export')},
  editAccountSession(id){this.modal('修改 CK 会话',`<div class="form-grid">${this.field('cookie','Cookie（含 sessionid）','','textarea',true)}${this.field('fingerprint','指纹备注（可选）')}<div class="field full"><div class="muted">CK 将 AES 加密保存，并标记账号为已登录会话。</div></div></div>`,async d=>{await this.api(`/accounts/${id}/session`,{method:'PUT',body:JSON.stringify(d)});this.toast('会话已保存');this.closeModal();this.refresh()})},
  async authorizeCapCut(id){if(!(await this.ask('仅在本系统打标记，不会真正授权 CapCut。继续？')))return;try{await this.api(`/accounts/${id}/capcut-authorize`,{method:'POST'});this.toast('已本地标记 CapCut');this.refresh()}catch(e){this.toast(e.message,true)}},
  async revokeCapCut(id){try{await this.api(`/accounts/${id}/capcut-revoke`,{method:'POST'});this.toast('已取消本地标记');this.refresh()}catch(e){this.toast(e.message,true)}},
  async batchModifyProfiles(){
    const ids=this.selectedAccountIds();
    if(!ids.length){this.toast('请先选择账号',true);return}
    await this.loadRefs();
    const gs=this.accountGroupFlatOptions();
    const proxies=(this.proxies||[]).map(p=>({id:p.id,name:(p.name||p.host)+' · '+p.host+(p.port?':'+p.port:'')}));
    const groupOpts=[['','不修改'],['__clear__','移出分组'],...gs.map(g=>[String(g.id),g.name])];
    const proxyOpts=[['','不修改'],['__clear__','清空代理'],...proxies.map(p=>[String(p.id),p.name])];
    let ownerField='';
    if(this.canAssignAccounts()){
      let targets=[];
      const self=this.authUser;
      if(self?.id)targets.push({id:Number(self.id),label:(self.nickname||self.username)+'（本人） · @'+self.username});
      if(this.authIsSuper){
        try{
          const pack=await this.api('/admin-users?pageSize=200');
          const selfId=Number(self?.id||0);
          for(const u of (pack.items||[])){
            if(Number(u.id)===selfId)continue;
            if(Number(u.status)===0)continue;
            targets.push({id:Number(u.id),label:(u.nickname||u.username)+' · @'+u.username});
          }
        }catch{}
      }else{
        for(const c of (this.authChildren||[])){
          targets.push({id:Number(c.id),label:(c.nickname||c.username)+' · @'+c.username});
        }
      }
      if(targets.length){
        ownerField=this.selectRaw('ownerId','分配用户',[['', '不修改'],...targets.map(t=>[String(t.id),t.label])],'');
      }
    }
    this.modal('批量修改',`<div class="form-grid">
      <div class="field full"><div class="muted">已选 ${ids.length} 个账号。未选择的项不会改动；只有选了对应项才会批量写入。</div></div>
      ${this.selectRaw('groupId','账号分组',groupOpts,'')}
      ${this.selectRaw('proxyId','代理',proxyOpts,'')}
      ${ownerField}
      ${this.selectRaw('enabled','启用状态',[['','不修改'],['1','启用'],['0','禁用']],'')}
      ${this.selectRaw('dmChannel','私信通道',[['','不修改'],['auto','自动'],['api','仅 API'],['browser','仅浏览器']],'')}
      ${this.field('nickname','统一昵称（留空不改）')}
      ${this.field('notes','统一备注（留空不改）','','textarea')}
    </div>`,async d=>{
      const fields={};
      if(d.groupId) fields.groupId = d.groupId==='__clear__' ? null : Number(d.groupId);
      if(d.proxyId) fields.proxyId = d.proxyId==='__clear__' ? null : Number(d.proxyId);
      if(d.ownerId) fields.ownerId = Number(d.ownerId);
      if(d.enabled!==''&&d.enabled!=null) fields.enabled = Number(d.enabled);
      if(d.dmChannel) fields.dmChannel = d.dmChannel;
      if(String(d.nickname||'').trim()) fields.nickname = String(d.nickname).trim();
      if(String(d.notes||'').trim()) fields.notes = String(d.notes).trim();
      if(!Object.keys(fields).length) throw new Error('请至少选择一项要修改的内容');
      const r=await this.api('/accounts/batch-update',{method:'POST',body:JSON.stringify({accountIds:ids,fields})});
      const parts=[];
      if(fields.groupId!==undefined) parts.push('分组');
      if(fields.proxyId!==undefined) parts.push('代理');
      if(fields.ownerId!==undefined) parts.push('归属用户');
      if(fields.enabled!==undefined) parts.push('启用状态');
      if(fields.dmChannel!==undefined) parts.push('私信通道');
      if(fields.nickname!==undefined) parts.push('昵称');
      if(fields.notes!==undefined) parts.push('备注');
      this.toast(`已更新 ${r.updated||ids.length} 个账号（${parts.join('、')}）`);
      this.closeModal();
      await this.loadRefs();
      this.refresh();
    });
  },
  async modifyAccountProfile(id,username){
    this.modal('修改 TikTok 资料',`<div class="form-grid">
      <div class="field full"><div class="muted">账号：${this.esc(username||id)}。将打开比特环境进入「编辑资料」。</div></div>
      ${this.field('nickname','新昵称（可选）')}
      ${this.field('signature','新签名（可选）','','textarea')}
      ${this.field('avatarPath','头像文件路径（可选）')}
    </div>`,async d=>{
      if(!d.nickname&&!d.signature&&!d.avatarPath)throw new Error('请至少填写一项');
      if(!(await this.ensureBitOnline('修改资料')))return;
      this.toast('正在修改平台资料…');
      await this.api(`/browser/accounts/${id}/modify-profile`,{method:'POST',body:JSON.stringify(d)});
      this.toast('资料已提交修改');this.closeModal();this.refresh();
    })
  },
  async batchDeleteVideos(){
    const ids=this.selectedAccountIds();
    if(!ids.length){this.toast('请先选择账号',true);return}
    this.modal('批量删除视频',`<div class="form-grid">
      ${this.selectRaw('mode','执行方式',this.opt('videoDeleteModes',[['platform','比特环境删除 TikTok 视频'],['local','仅清理本地同步记录']]),'platform')}
      ${this.field('keepLatest','保留最新条数','0','number')}
      ${this.field('threads','并发（平台）','1','number')}
      <div class="field full"><div class="muted">已选 ${ids.length} 个账号。平台删除依赖本地已同步的视频列表；建议先「同步视频」。保留数之外的视频才会删除。</div></div>
    </div>`,async d=>{
      const mode=d.mode||'platform';
      const keepLatest=Number(d.keepLatest||0);
      if(mode==='platform'&&!(await this.ensureBitOnline('批量删视频')))return;
      if(mode==='platform'&&!(await this.ask(`确定在 TikTok 上删除超出保留 ${keepLatest} 条的视频吗？此操作不可恢复。`)))return;
      this.toast(mode==='platform'?'正在平台删除视频…':'正在清理本地记录…');
      const r=await this.api('/browser/accounts/batch-delete-videos',{method:'POST',body:JSON.stringify({accountIds:ids,keepLatest,mode,threads:Number(d.threads||1)})});
      if(r.mode==='local')this.toast(`已删除本地记录 ${r.deleted} 条`);
      else this.toast(`平台删视频：成功 ${r.success||r.deleted||0}，失败 ${r.failed||0}`,(r.failed||0)>0);
      this.closeModal();this.refresh();
    })
  },
  async batchDeleteLocalVideos(){return this.batchDeleteVideos()},
  async deleteTikTokVideo(accountId,videoId,videoUrl){
    if(!(await this.ask('确定在 TikTok 上删除该视频吗？')))return;
    try{
      this.toast('正在删除平台视频…');
      await this.api(`/browser/accounts/${accountId}/delete-video`,{method:'POST',body:JSON.stringify({videoId,videoUrl})});
      this.toast('视频已删除');
      await this.viewTikTokData(accountId);
    }catch(e){this.toast(e.message,true)}
  },
  async batchCheckAccountIp(){const ids=this.selectedAccountIds();if(!ids.length){this.toast('请先选择账号',true);return}this.toast('正在批量检测代理出口…');try{const r=await this.api('/browser/accounts/batch-check-ip',{method:'POST',body:JSON.stringify({accountIds:ids})});this.toast(`可用 ${r.available}/${r.items.length}`);this.refresh()}catch(e){this.toast(e.message,true)}},
  async detectProxyCountry(id){
    if(!this.canPermission('proxy.test')&&!this.canPermission('proxy.create')){this.toast('当前角色无权检测代理',true);return}
    this.toast('正在检测国家…');
    try{
      const r=await this.api('/browser/proxies/batch-detect-country',{method:'POST',body:JSON.stringify({proxyIds:[Number(id)]})});
      const item=(r.items||[])[0];
      this.toast(item?.country?`已写入国家 ${item.country}`:(item?.detail||'未能识别国家'),!item?.country);
      await this.loadRefs();this.refresh();
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
      await this.loadRefs();this.refresh();
    }catch(e){this.toast(e.message,true)}
  },
  async monitorModal(){const cfg=await this.api('/accounts/monitor');this.modal('监控账号设置',`<div class="form-grid">${this.selectRaw('enabled','启用定时监控',[['false','关闭'],['true','开启']],cfg.enabled?'true':'false')}${this.field('intervalMinutes','间隔（分钟）',cfg.intervalMinutes||60,'number')}${this.selectRaw('syncProfile','同步资料',[['true','是'],['false','否']],cfg.syncProfile?'true':'false')}${this.selectRaw('syncVideos','同步视频',[['false','否'],['true','是']],cfg.syncVideos?'true':'false')}<div class="field full"><div class="muted">上次运行：${this.esc(cfg.lastRunAt||'尚未运行')}。开启后服务会按间隔自动同步（需已绑定浏览器环境），也可手动点「同步账号资料」。 <button type="button" class="tiny" onclick="app.showMonitorResult()">查看上次结果</button></div></div></div>`,async d=>{d.enabled=d.enabled==='true';d.syncProfile=d.syncProfile==='true';d.syncVideos=d.syncVideos==='true';d.intervalMinutes=Number(d.intervalMinutes||60);d.accountIds=this.selectedAccountIds();await this.api('/accounts/monitor',{method:'PUT',body:JSON.stringify(d)});this.toast('监控配置已保存');this.closeModal()})},
  async runAccountMonitor(){if(!this.canPermission('account.create')){this.toast('当前角色无权执行账号同步',true);return}this.toast('正在执行账号监控同步…');try{const r=await this.api('/accounts/monitor/run',{method:'POST'});const okCount=Number(r.profile||0)+Number(r.videos||0);const failed=Number(r.failed||0);this.toast(okCount||failed?`资料 ${r.profile||0}，视频 ${r.videos||0}，失败 ${failed}`:'没有可同步的账号（需已绑定浏览器环境）',!okCount);this.refresh()}catch(e){this.toast(e.message,true)}},

  async renderBrowser(){const status=await this.api('/browser/status');if(!status.online){document.querySelector('#content').innerHTML=`<div class="panel"><div class="empty"><h2>比特浏览器未连接</h2><p>${this.esc(status.message)}</p><p>请启动比特浏览器，并确认本地 API 地址为 ${this.esc(status.apiUrl)}</p><button class="primary" onclick="app.refresh()">重新检测</button></div></div>`;return}const d=await this.api('/browser/profiles?pageSize=500');const pack=UI.paginateLocal(d.items||[],this.browserPage||1,20);this.browserPage=pack.page;document.querySelector('#content').innerHTML=`<div class="stats">${this.stat('连接状态','在线','比特浏览器 API','#e8f8f1')}${this.stat('环境总数',d.total,'已从本地 API 同步','#eeeafe')}${this.stat('已绑定账号',(d.items||[]).filter(x=>x.account).length,'账号与环境关联','#e7f3ff')}${this.stat('API 地址','54345',status.apiUrl,'#fff6df')}</div><div class="panel"><div class="toolbar"><span class="muted">创建环境时会自动使用账号绑定的代理，并根据国家设置浏览器语言。</span><div>${this.canPermission('account.create')?`<button class="primary" onclick="app.batchCreateBrowserModal()">批量创建环境</button>`:''}<div class="dropdown" style="display:inline-block"><button class="ghost" type="button" onclick="app.toggleBrowserBatchMenu(event)">批量操作 <span class="btn-arrow-down">▾</span></button><div id="browser-batch-menu" class="dropdown-menu align-left hidden">${this.canPermission('account.create')?`<button type="button" class="is-danger" onclick="app.batchDeleteBrowser()">批量删除环境</button>`:''}<button type="button" onclick="app.refresh()">同步环境</button></div></div></div></div>${this.browserTable(pack.items)}${UI.pager(pack,'browserPage')}</div>`},
  browserTable(rows){
    if(!rows.length)return '<div class="empty">还没有浏览器环境</div>';
    const canWrite=this.canPermission('account.create');
    return `<table><thead><tr><th><input type="checkbox" onchange="app.toggleAllBrowser(this.checked)" title="全选当前列表"></th><th>序号</th><th>环境名称</th><th>环境 ID</th><th>代理</th><th>内核</th><th>绑定账号</th><th>操作</th></tr></thead><tbody>${rows.map(x=>{
      const id=this.esc(x.id);
      const more=[
        `<button type="button" onclick="app.checkTikTokStatus('${id}')">检测登录</button>`,
        `<button type="button" onclick="app.browserAction('${id}','open')">打开</button>`,
        `<button type="button" onclick="app.browserAction('${id}','close')">关闭</button>`,
      ];
      const delBtn=`<button class="tiny danger" type="button" title="删除" onclick="app.deleteBrowser('${id}')" ${canWrite?'':'disabled title="无维护权限"'}>删除</button>`;
      const moreBtn=`<div class="ops-dropdown browser-ops-dropdown"><button class="tiny" type="button" title="更多" onclick="app.toggleBrowserOps('${id}',event)">…</button><div id="browser-ops-${id}" class="dropdown-menu ops-menu hidden">${more.join('')}</div></div>`;
      return `<tr><td><input class="browser-check" type="checkbox" value="${id}"></td><td>${x.seq||'-'}</td><td><b>${this.esc(x.name||'-')}</b><div class="muted">${this.esc(x.remark||'')}</div></td><td><span class="muted">${id}</span></td><td>${this.esc(x.proxyType||'-')} ${this.esc(x.host||'')}${x.port?':'+x.port:''}</td><td>${this.esc(x.coreProduct||'-')} ${this.esc(x.coreVersion||'')}</td><td>${x.account?`<b>${this.esc(x.account.username)}</b> <button class="tiny" onclick="app.unbindBrowser(${x.account.id})">解绑</button>`:`<button class="tiny" onclick="app.bindBrowser('${id}')">绑定账号</button>`}</td><td><div class="task-ops-cell browser-ops-cell">${delBtn}${moreBtn}</div></td></tr>`;
    }).join('')}</tbody></table>`;
  },
  toggleBrowserOps(id,e){
    e?.stopPropagation?.();
    const menu=document.getElementById('browser-ops-'+id);
    const willShow=menu?.classList.contains('hidden');
    document.querySelectorAll('.dropdown-menu').forEach(m=>{m.classList.add('hidden');if(window.UI)UI.restoreMenu(m)});
    if(menu && willShow){
      menu.classList.add('ops-menu');
      menu.classList.remove('hidden');
      const btn=e?.currentTarget||menu.closest('.ops-dropdown')?.querySelector('button');
      if(window.UI) UI.liftMenu(menu, btn, {side:'left'});
    }
  },
  toggleBrowserBatchMenu(e){
    e?.stopPropagation?.();
    this.toggleToolbarDropdown('#browser-batch-menu', e);
  },
  toggleAllBrowser(checked){document.querySelectorAll('.browser-check').forEach(x=>{x.checked=checked})},
  async batchDeleteBrowser(){const ids=[...document.querySelectorAll('.browser-check:checked')].map(x=>x.value);if(!ids.length){this.toast('请先选择要删除的浏览器环境',true);return}if(!(await this.ask(`确定删除选中的 ${ids.length} 个浏览器环境吗？已绑定账号的环境会被自动跳过。`)))return;try{const r=await this.api('/browser/profiles/batch-delete',{method:'POST',body:JSON.stringify({profileIds:ids})});let message=`已删除 ${r.deleted} 个环境`;if(r.blocked||r.failed)message+=`，跳过 ${r.blocked}，失败 ${r.failed}`;this.toast(message,Boolean(r.blocked||r.failed));this.refresh()}catch(e){this.toast(e.message,true)}},
  async deleteBrowser(id){if(!(await this.ask('确定删除这个比特浏览器环境吗？此操作不会删除账号。')))return;try{await this.api(`/browser/profiles/${id}`,{method:'DELETE'});this.toast('浏览器环境已删除');this.refresh()}catch(e){this.toast(e.message,true)}}, 
  async bindBrowser(profileId){const d=await this.api('/accounts?pageSize=100');const accounts=d.items.filter(x=>!x.browser_profile_id);if(!accounts.length){this.toast('没有未绑定的账号',true);return}const options=accounts.map(x=>({id:x.id,name:x.username+(x.nickname?' · '+x.nickname:'')}));this.modal('绑定浏览器环境',`<div class="form-grid">${this.select('accountId','选择账号',options)}<div class="field full"><div class="muted">环境 ID：${this.esc(profileId)}</div></div></div>`,async data=>{if(!data.accountId)throw new Error('请选择账号');await this.api('/browser/bind',{method:'POST',body:JSON.stringify({accountId:Number(data.accountId),profileId})});this.toast('环境已绑定');this.closeModal();this.refresh()})},
  async unbindBrowser(accountId){if(!(await this.ask('确定解除这个账号的浏览器环境绑定吗？')))return;await this.api('/browser/unbind',{method:'POST',body:JSON.stringify({accountId})});this.toast('已解除绑定');this.refresh()},
  async batchModifyIp(){
    const ids=this.selectedAccountIds();
    if(!ids.length){this.toast('请先勾选账号',true);return}
    this.modal('批量修改IP',`<div class="form-grid">
      ${this.field('proxyString','代理串','','text',true)}
      <div class="field full"><div class="muted">已选 ${ids.length} 个账号。格式：ip:端口 或 ip:端口:账号:密码。填写「-」可清空代理。</div></div>
    </div>`,async d=>{
      const clear=d.proxyString==='-'||String(d.proxyString||'').toLowerCase()==='none';
      const r=await this.api('/accounts/batch-set-proxy-string',{method:'POST',body:JSON.stringify({accountIds:ids,proxyString:d.proxyString,clear})});
      this.toast(r.cleared?`已清空 ${r.updated} 个账号代理`:`已绑定 ${r.host}:${r.port} 到 ${r.updated} 个账号`);
      this.closeModal();await this.loadRefs();this.refresh();
    })
  },
  async deleteBrowsersFromSettings(){if(!(await this.ask('将删除比特浏览器中未绑定账号的环境。已绑定账号的环境会跳过。继续？')))return;this.toast('正在读取环境列表…');try{const d=await this.api('/browser/profiles?pageSize=500');const ids=(d.items||[]).filter(x=>!x.account).map(x=>String(x.id)).filter(Boolean);if(!ids.length){this.toast('没有可删除的未绑定环境');return}const r=await this.api('/browser/profiles/batch-delete',{method:'POST',body:JSON.stringify({profileIds:ids})});this.toast(`已删除 ${r.deleted}，跳过 ${r.blocked||0}，失败 ${r.failed||0}`,Boolean(r.blocked||r.failed))}catch(e){this.toast(e.message,true)}},
  async assignProxyModal(){const ids=this.selectedAccountIds();const pgs=this.groups.filter(g=>g.type==='proxy');const proxies=this.proxies.map(p=>({id:p.id,name:p.name+' · '+p.host}));if(!ids.length&&!this.accountGroupId){this.toast('请勾选账号，或先选中左侧分组',true);return}this.modal('分配代理',`<div class="form-grid">${ids.length?`<div class="field full"><div class="muted">将按顺序分配给已勾选的 ${ids.length} 个账号。</div></div>`:`<div class="field full"><div class="muted">未勾选账号，将分配给当前分组内的启用账号。</div></div>`}${this.select('proxyGroupId','从代理分组轮询（可空）',pgs)}${this.select('proxyId','或全部绑定同一代理',proxies)}<div class="field full"><div class="muted">两个都留空时，使用全部非失效代理轮询。</div></div></div>`,async d=>{const body={};if(ids.length)body.accountIds=ids;else body.groupId=Number(this.accountGroupId);if(d.proxyGroupId)body.proxyGroupId=Number(d.proxyGroupId);if(d.proxyId)body.proxyId=Number(d.proxyId);const r=await this.api('/accounts/batch-assign-proxy',{method:'POST',body:JSON.stringify(body)});this.toast(r.assigned?`已分配 ${r.assigned} 个账号`:`没有账号被分配`,!r.assigned);this.closeModal();await this.loadRefs();this.refresh()})},
  async batchLoginAccounts(){const ids=this.selectedAccountIds();if(!ids.length&&!this.accountGroupId){this.toast('请勾选账号，或先选中左侧分组',true);return}if(!(await this.ensureBitOnline('批量登录')))return;if(!(await this.ask('将依次打开最多 5 个已绑定环境，只填写登录表，不自动提交。是否继续？')))return;this.toast('正在依次打开登录页，请稍候',false,4000);try{const body=ids.length?{accountIds:ids.slice(0,5)}:{groupId:Number(this.accountGroupId)};const r=await this.api('/browser/accounts/batch-login',{method:'POST',body:JSON.stringify(body)});const fails=(r.items||[]).filter(x=>!x.ok);const first=fails[0];let detail=`已准备 ${r.prepared}，失败 ${r.failed}`;if(first)detail+=`；${first.username||('#'+first.accountId)}：${first.reason||'未知原因'}`;if(fails.some(x=>/未绑定/.test(x.reason||'')))detail+='。请先「创建环境」再登录';if(fails.some(x=>/密码|凭据/.test(x.reason||'')))detail+='。请重新导入带密码的账号';if(fails.some(x=>/Maximum|限制登录|attempts/i.test(x.reason||'')))detail+='。请换代理或等待数小时后再试，勿连点';if(fails.some(x=>/权限不足|无权|拒绝操作/.test(x.reason||'')))detail+='。这是比特窗口权限问题：请用有权限的比特账号登录，或解绑后重新创建环境';this.toast(detail,r.failed>0,r.failed>0?6000:3000);this.refresh()}catch(e){this.toast(e.message,true,6000)}},
  batchMoveAccounts(){const ids=this.selectedAccountIds();if(!ids.length){this.toast('请先勾选账号',true);return}const gs=this.accountGroupFlatOptions();this.modal('转移分组',`<div class="form-grid">${this.select('groupId','目标分组（建议选公司子组）',gs)}<div class="field full"><div class="muted">已选 ${ids.length} 个账号。目标留空表示移出分组。</div></div></div>`,async d=>{await this.api('/accounts/batch-move-group',{method:'POST',body:JSON.stringify({accountIds:ids,groupId:d.groupId?Number(d.groupId):null})});this.toast('分组已更新');this.closeModal();await this.loadRefs();this.refresh()})},
  canAssignAccounts(){return !!(this.authIsSuper||(this.authChildren&&this.authChildren.length))},
  async batchAssignAccounts(presetIds){
    if(!this.canAssignAccounts()){this.toast('当前账号无权分配',true);return}
    const ids=Array.isArray(presetIds)&&presetIds.length?presetIds.map(Number):this.selectedAccountIds();
    if(!ids.length){this.toast('请先勾选要分配的账号',true);return}
    let targets=[];
    const self=this.authUser;
    if(self?.id){
      targets.push({id:Number(self.id),username:self.username,nickname:(self.nickname||self.username)+'（本人）'});
    }
    if(this.authIsSuper){
      try{
        const pack=await this.api('/admin-users?pageSize=200');
        const selfId=Number(self?.id||0);
        for(const u of (pack.items||[])){
          if(Number(u.id)===selfId)continue;
          if(Number(u.status)===0)continue;
          targets.push({id:Number(u.id),username:u.username,nickname:u.nickname||u.username});
        }
      }catch(e){this.toast(e.message,true);return}
    }else{
      for(const c of (this.authChildren||[])){
        targets.push({id:Number(c.id),username:c.username,nickname:c.nickname||c.username});
      }
    }
    if(!targets.length){this.toast('没有可分配的目标用户',true);return}
    const opts=targets.map(t=>[t.id,`${t.nickname} · @${t.username}`]);
    this.modal('分配账号给管理用户',`<div class="form-grid"><div class="field full"><div class="muted">已选 ${ids.length} 个账号。分配后这些账号将归属于目标用户，你在本人视图下将不再看到它们（超管全量视图除外）。</div></div>${this.selectRaw('ownerId','目标管理用户',opts,opts[0]?.[0])}</div>`,async d=>{
      const ownerId=Number(d.ownerId||0);
      if(!ownerId)throw new Error('请选择目标用户');
      const r=await this.api('/accounts/batch-assign-owner',{method:'POST',body:JSON.stringify({accountIds:ids,ownerId})});
      this.toast(r?.ownerName?`已分配 ${r.updated} 个账号给 ${r.ownerName}`:`已分配 ${r.updated||ids.length} 个账号`);
      this.closeModal();
      await this.loadRefs();
      this.refresh();
    });
  },
  async extractFingerprints(){if(!(await this.ensureBitOnline('提取指纹')))return;const ids=this.selectedAccountIds();if(!ids.length&&!this.accountGroupId){this.toast('请勾选账号，或先选中左侧分组',true);return}try{const body=ids.length?{accountIds:ids}:{groupId:Number(this.accountGroupId)};const r=await this.api('/browser/accounts/batch-fingerprint',{method:'POST',body:JSON.stringify(body)});const text=(r.items||[]).map(x=>x.username+'\t'+(x.fingerprint||'未采集')).join('\n');await navigator.clipboard.writeText(text);this.toast(`已复制 ${r.items.length} 条，有指纹 ${r.withFingerprint}${r.harvested?`，新采集 ${r.harvested}`:''}`)}catch(e){this.toast(e.message,true)}},
  async deleteBannedAccounts(){if(!this.canPermission('account.delete')){this.toast('当前角色无权删除账号',true);return}const scope=this.accountGroupId?'当前分组':'全部账号';if(!(await this.ask('删除'+scope+'中状态为封号的账号？此操作不可恢复。')))return;try{const r=await this.api('/accounts/batch-delete-banned',{method:'POST',body:JSON.stringify(this.accountGroupId?{groupId:Number(this.accountGroupId)}:{})});this.toast(r.deleted?`已删除 ${r.deleted} 个封号账号`:'没有可删除的封号账号',!r.deleted);this.refresh()}catch(e){this.toast(e.message,true)}},
  async copyAccountCk(id){try{const r=await this.api(`/accounts/${id}/session`);await navigator.clipboard.writeText(r.cookie||'');this.toast('CK 已复制到剪贴板')}catch(e){this.toast(e.message,true)}},
  addAccountSocks(id){this.modal('添加 SOCKS5',`<div class="form-grid">${this.field('host','主机','','text',true)}${this.field('port','端口','','number',true)}${this.field('username','用户名')}${this.field('password','密码','','password')}${this.field('country','国家/地区')}</div>`,async d=>{d.port=Number(d.port);await this.api(`/accounts/${id}/socks`,{method:'POST',body:JSON.stringify(d)});this.toast('SOCKS5 已绑定');this.closeModal();await this.loadRefs();this.refresh()})},
  async showMonitorResult(){try{const cfg=await this.api('/accounts/monitor');if(!cfg.lastRunAt){this.toast('还没有监控记录',true);return}const r=cfg.lastResult||{};const errors=(r.errors||[]).length?(r.errors||[]).map(e=>`<div>#${this.esc(e.id)} ${this.esc(e.reason||'')}</div>`).join(''):'<div class="muted">无失败明细</div>';this.modal('上次监控结果',`<div class="data-summary"><div><small>时间</small><b>${this.esc(cfg.lastRunAt)}</b></div><div><small>扫描</small><b>${r.total||0}</b></div><div><small>资料</small><b>${r.profile||0}</b></div><div><small>视频</small><b>${r.videos||0}</b></div><div><small>失败</small><b>${r.failed||0}</b></div></div><h3>失败明细</h3>${errors}<div class="muted" style="margin-top:8px">${r.total?'以上为最近一次真实同步结果。':'上次没有可同步账号（需已绑定浏览器环境）。'}</div>`,()=>this.closeModal())}catch(e){this.toast(e.message,true)}},

  async renderAgent(){
    document.querySelector('#content').classList.remove('chat-mode');
    const page=this.agentPage||1;
    const pack=await this.api(`/agents?page=${page}&pageSize=20${this.agentKeyword?`&keyword=${encodeURIComponent(this.agentKeyword)}`:''}`);
    const agents=Array.isArray(pack)?pack:(pack.items||[]);
    const pagerPack=Array.isArray(pack)?UI.paginateLocal(pack,1,Math.max(agents.length,1)):{page:pack.page||1,pages:pack.pages||1,total:pack.total||agents.length,pageSize:pack.pageSize||20,items:agents};
    if(!this.agentId&&agents[0])this.agentId=agents[0].id;
    if(this.agentId&&!agents.some(a=>Number(a.id)===Number(this.agentId)))this.agentId=agents[0]?.id||null;
    if(this.agentId&&(!this.agentForm||Number(this.agentForm.id)!==Number(this.agentId))){
      this.agentForm=await this.api(`/agents/${this.agentId}`);
      this.testChat=[];
    }
    if(!this.agentId)this.agentForm=null;
    const f=this.agentForm||this.emptyAgentForm();
    const tab=this.agentTab||'basic';
    const tabs=this.opt('agentTabs',[['basic','基础信息'],['model','模型配置'],['prompt','对话能力'],['terminate','终止条件'],['poll','号码轮询']]);
    document.querySelector('#content').innerHTML=`<div class="agent-shell">
      <aside class="panel agent-list-panel" style="margin:0">
        <div class="panel-head"><h3>智能体列表 <span class="muted">${pagerPack.total||agents.length}</span></h3>${this.canPermission('agent.manage')?`<button class="primary tiny" onclick="app.addAgent()">添加</button>`:''}</div>
        <div id="agent-batch-panel" class="batch-panel hidden" style="margin:0 0 10px">
          <div class="batch-info">已选 <strong id="agent-selected-count">0</strong></div>
          ${this.canPermission('agent.manage')?`<div class="action-buttons"><button class="danger tiny" type="button" onclick="app.batchDeleteAgents()">批量删除</button></div>`:''}
        </div>
        <div class="filters" style="margin-bottom:10px"><input class="input" id="agent-search" placeholder="搜索智能体..." value="${this.esc(this.agentKeyword||'')}" onkeydown="if(event.key==='Enter')app.searchAgents()"><button class="ghost" onclick="app.searchAgents()">查询</button></div>
        <div class="action-bar">${this.canPermission('agent.manage')?`<button class="tiny" onclick="app.openAgentTemplates()">机器人模板</button>`:''}<button class="tiny" onclick="app.refresh()">刷新列表</button></div>
        <div class="agent-list">${agents.length?agents.map(a=>`<div class="agent-item ${Number(a.id)===Number(this.agentId)?'active':''}" onclick="app.selectAgent(${a.id})"><input class="agent-check" type="checkbox" value="${a.id}" onclick="event.stopPropagation();app.bindAgentChecks()" title="选择"><div class="chat-avatar">${a.avatar?`<img src="${this.esc(a.avatar)}" alt="">`:`<span>${this.esc((a.name||'?')[0])}</span>`}</div><div class="chat-meta"><b>${this.esc(a.name)}</b><small>${this.esc(a.description||'无描述')}</small></div><span class="badge ${a.enabled?'online':'offline'}">${a.enabled?'启用':'禁用'}</span></div>`).join(''):'<div class="shell-note">暂无智能体，点击添加或应用模板</div>'}</div>
        ${UI.pager(pagerPack,'agentPage')}
      </aside>
      <section class="panel agent-config agent-main-wrapper" style="margin:0">
        ${this.agentId?`<div class="panel-head"><div><h3>${this.esc(f.name||'未命名智能体')}</h3><div class="muted">${f.modelType==='custom'?'自定义 API':'内置规则引擎'} · ${f.enabled?'已启用':'已禁用'}</div></div><div>${this.canPermission('agent.manage')?`<button class="tiny" onclick="app.toggleAgentStatus()">${f.enabled?'禁用':'启用'}</button>`:''}<button class="tiny" onclick="app.openTestChat()">测试聊天</button>${this.canPermission('agent.manage')?`<button class="tiny danger" onclick="app.deleteAgent()">删除</button><button class="primary tiny" onclick="app.saveAgent()">保存</button>`:'<span class="muted">当前角色只可查看</span>'}</div></div>
        <div class="subtabs">${tabs.map(([k,n])=>`<button class="${tab===k?'active':''}" onclick="app.setAgentTab('${k}')">${n}</button>`).join('')}</div>
        <div id="agent-form-body" class="config-sections">${this.agentFormBody(tab,f)}</div>
        <div class="toolbar" style="margin-top:14px"><span class="muted">内置模型使用本地规则；自定义模型需真实 API。</span>${this.canPermission('agent.manage')?`<button class="primary" onclick="app.saveAgent()">保存智能体</button>`:''}</div>`
        :'<div class="shell-note">请从左侧选择或创建一个智能体</div>'}
      </section>
    </div>`;
    this.bindAgentChecks();
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
    try{const r=await this.api('/agents/batch-delete',{method:'POST',body:JSON.stringify({ids})});this.toast(`已删除 ${r.deleted}`);if(ids.includes(Number(this.agentId))){this.agentId=null;this.agentForm=null}this.refresh()}catch(e){this.toast(e.message,true)}
  },
  emptyAgentForm(){return{name:'',description:'',avatar:'',enabled:true,modelType:'builtin',modelId:'builtin',apiBase:'',apiKey:'',temperature:0.7,replyTone:'friendly',replyLanguage:'zh',roleInfo:'',mission:'',rules:'',openings:['您好，有什么可以帮您？'],autoOpening:true,successTerminate:{enabled:false,keywords:[],reply:'',match:'contains'},failTerminate:{enabled:false,keywords:[],reply:'',match:'contains'},poll:{enabled:false,resources:[],limit:1,type:'phone'}}},
  agentFormBody(tab,f){
    if(tab==='model')return `<div class="config-section"><div class="config-section-title">模型与接口</div><div class="form-grid">${this.selectRaw('modelType','模型类型',this.modelTypePairs(),f.modelType||'builtin')}${this.field('modelId','模型 ID',f.modelId||'builtin')}${this.field('apiBase','API Base',f.apiBase||'')}${this.field('apiKey','API Key',f.hasApiKey?'******':'','password')}${this.field('temperature','温度参数',f.temperature??0.7,'number')}${this.selectRaw('replyTone','回复语气',this.replyTonePairs(),f.replyTone||'friendly')}${this.selectRaw('replyLanguage','回复语言',this.languagePairs(false),f.replyLanguage||'zh')}</div></div>`;
    if(tab==='prompt')return `<div class="config-section"><div class="config-section-title">角色与话术</div><div class="form-grid">${this.field('roleInfo','角色信息',f.roleInfo||'','textarea')}${this.field('mission','目标任务',f.mission||'','textarea')}${this.field('rules','重要规则',f.rules||'','textarea')}${this.field('openingsText','开场白（每行一条）',(f.openings||[]).join('\n'),'textarea')}${this.selectRaw('autoOpening','自动发送开场白',[['false','关闭'],['true','开启']],f.autoOpening?'true':'false')}</div></div>`;
    if(tab==='terminate')return `<div class="config-section"><div class="config-section-title">成功终止</div><div class="form-grid"><div class="field"><label>启用成功终止</label><select name="successEnabled"><option value="true" ${f.successTerminate?.enabled?'selected':''}>启用</option><option value="false" ${f.successTerminate?.enabled?'':'selected'}>关闭</option></select></div>${this.selectRaw('successMatch','匹配方式',this.opt('keywordMatches',[['contains','包含'],['exact','精确']]),f.successTerminate?.match||'contains')}${this.field('successKeywords','成功关键词（逗号分隔）',(f.successTerminate?.keywords||[]).join(','))}${this.field('successReply','成功终止回复',f.successTerminate?.reply||'','textarea')}</div></div><div class="config-section"><div class="config-section-title">失败终止</div><div class="form-grid"><div class="field"><label>启用失败终止</label><select name="failEnabled"><option value="true" ${f.failTerminate?.enabled?'selected':''}>启用</option><option value="false" ${f.failTerminate?.enabled?'':'selected'}>关闭</option></select></div>${this.selectRaw('failMatch','匹配方式',this.opt('keywordMatches',[['contains','包含'],['exact','精确']]),f.failTerminate?.match||'contains')}${this.field('failKeywords','失败关键词（逗号分隔）',(f.failTerminate?.keywords||[]).join(','))}${this.field('failReply','失败终止回复',f.failTerminate?.reply||'','textarea')}</div></div>`;
    if(tab==='poll')return `<div class="config-section"><div class="config-section-title">号码 / 资源轮询</div><div class="form-grid"><div class="field"><label>启用号码轮询</label><select name="pollEnabled"><option value="true" ${f.poll?.enabled?'selected':''}>启用</option><option value="false" ${f.poll?.enabled?'':'selected'}>关闭</option></select></div>${this.field('pollLimit','每个资源上限',f.poll?.limit||1,'number')}${this.selectRaw('pollType','资源类型',this.opt('pollResources',[['phone','手机号'],['link','链接'],['text','文本']]),f.poll?.type||'phone')}${this.field('pollResources','资源列表（每行一个）',(f.poll?.resources||[]).join('\n'),'textarea')}</div></div>`;
    return `<div class="config-section"><div class="config-section-title">基础资料</div><div class="form-grid">${this.field('name','智能体名称',f.name||'','text',true)}${this.selectRaw('enabled','状态',[['true','启用'],['false','禁用']],f.enabled===false||f.enabled===0?'false':'true')}${this.imageField('avatar','智能体头像',f.avatar||'')}${this.field('description','智能体描述',f.description||'','textarea')}</div></div>`;
  },
  setAgentTab(tab){this.collectAgentForm();this.agentTab=tab;this.refresh()},
  searchAgents(){this.agentKeyword=document.querySelector('#agent-search')?.value||'';this.agentPage=1;this.refresh()},
  async selectAgent(id){this.collectAgentForm();this.agentId=id;this.agentForm=null;this.testChat=[];this.refresh()},
  async addAgent(){if(!this.canPermission('agent.manage')){this.toast('当前角色无权管理智能体',true);return}this.agentForm=this.emptyAgentForm();this.agentForm.name='新智能体 '+new Date().toLocaleTimeString();this.agentId=null;try{const created=await this.api('/agents',{method:'POST',body:JSON.stringify(this.agentForm)});this.agentId=created.id;this.agentForm=created;this.toast('已创建智能体');this.refresh()}catch(e){this.toast(e.message,true)}},
  collectAgentForm(){
    if(!this.agentForm)return;
    const read=name=>document.querySelector(`[name="${name}"]`)?.value;
    if(!document.querySelector('#agent-form-body'))return;
    const tab=this.agentTab||'basic';
    if(tab==='basic'){if(read('name')!=null)this.agentForm.name=read('name');if(read('description')!=null)this.agentForm.description=read('description');if(read('enabled')!=null)this.agentForm.enabled=read('enabled')==='true';if(read('avatar')!=null)this.agentForm.avatar=read('avatar')}
    if(tab==='model'){['modelType','modelId','apiBase','apiKey','replyTone','replyLanguage'].forEach(k=>{if(read(k)!=null)this.agentForm[k]=read(k)});if(read('temperature')!=null)this.agentForm.temperature=Number(read('temperature'))}
    if(tab==='prompt'){['roleInfo','mission','rules'].forEach(k=>{if(read(k)!=null)this.agentForm[k]=read(k)});if(read('openingsText')!=null)this.agentForm.openings=String(read('openingsText')).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(read('autoOpening')!=null)this.agentForm.autoOpening=read('autoOpening')==='true'}
    if(tab==='terminate'){this.agentForm.successTerminate={enabled:read('successEnabled')==='true',keywords:String(read('successKeywords')||'').split(/[,，]/).map(x=>x.trim()).filter(Boolean),reply:read('successReply')||'',match:read('successMatch')||'contains'};this.agentForm.failTerminate={enabled:read('failEnabled')==='true',keywords:String(read('failKeywords')||'').split(/[,，]/).map(x=>x.trim()).filter(Boolean),reply:read('failReply')||'',match:read('failMatch')||'contains'}}
    if(tab==='poll'){this.agentForm.poll={enabled:read('pollEnabled')==='true',limit:Number(read('pollLimit')||1),type:read('pollType')||'phone',resources:String(read('pollResources')||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean)}}
  },
  async saveAgent(){if(!this.agentId){this.toast('请先选择智能体',true);return}this.collectAgentForm();const f=this.agentForm;try{const payload={...f,apiKey:f.apiKey==='******'?undefined:f.apiKey};this.agentForm=await this.api(`/agents/${this.agentId}`,{method:'PUT',body:JSON.stringify(payload)});this.toast('智能体已保存')}catch(e){this.toast(e.message,true)}},
  async toggleAgentStatus(){if(!this.agentId)return;try{this.agentForm=await this.api(`/agents/${this.agentId}/status`,{method:'PATCH',body:JSON.stringify({enabled:!this.agentForm.enabled})});this.toast(this.agentForm.enabled?'已启用':'已禁用');this.refresh()}catch(e){this.toast(e.message,true)}},
  async deleteAgent(){if(!this.agentId)return;if(!(await this.ask('确定删除该智能体吗？')))return;try{await this.api(`/agents/${this.agentId}`,{method:'DELETE'});this.agentId=null;this.agentForm=null;this.toast('已删除');this.refresh()}catch(e){this.toast(e.message,true)}},
  async openAgentTemplates(){if(!this.canPermission('agent.manage')){this.toast('当前角色无权应用机器人模板',true);return}const templates=await this.api('/agents/templates');this.modal('机器人模板',`<div class="template-cards">${templates.map(t=>`<button type="button" class="channel" onclick='app.applyAgentTemplate(${JSON.stringify(t)})'><b>${this.esc(t.name)}</b><span class="muted">${this.esc(t.description)}</span></button>`).join('')}</div>`,async()=>{});document.querySelector('#modal-form button[type=submit]')?.remove()},
  async applyAgentTemplate(t){this.closeModal();const payload={name:t.name+'-'+Date.now().toString().slice(-4),description:t.description,enabled:true,modelType:'builtin',modelId:'builtin',roleInfo:t.roleInfo,mission:t.mission,rules:t.rules,openings:t.openings||[],replyTone:t.replyTone||'friendly',replyLanguage:t.replyLanguage||'zh',successTerminate:{enabled:false,keywords:[],reply:'',match:'contains'},failTerminate:{enabled:false,keywords:[],reply:'',match:'contains'},poll:{enabled:false,resources:[],limit:1}};try{const created=await this.api('/agents',{method:'POST',body:JSON.stringify(payload)});this.agentId=created.id;this.agentForm=created;this.toast('模板已应用');this.refresh()}catch(e){this.toast(e.message,true)}},
  async openTestChat(skipSave=false){if(!this.agentId){this.toast('请先选择智能体',true);return}if(!skipSave&&this.canPermission('agent.manage')){try{this.collectAgentForm();const f=this.agentForm;const payload={...f,apiKey:f.apiKey==='******'?undefined:f.apiKey};this.agentForm=await this.api(`/agents/${this.agentId}`,{method:'PUT',body:JSON.stringify(payload)})}catch(e){this.toast(e.message||'请先保存智能体配置',true);return}}this.testChat=this.testChat||[];const wantOpening=!(this.testChat||[]).length&&(this.agentForm?.autoOpening!==false)&&((this.agentForm?.openings||[]).length>0);this.modal('测试聊天',`<div class="test-chat"><div id="test-chat-thread" class="thread">${this.testChat.length?this.testChat.map(m=>`<div class="bubble ${m.role==='assistant'?'out':''}">${this.esc(m.content)}<span class="time">${m.role==='assistant'?'AI':'我'}${m.source?` · ${m.source}`:''}</span></div>`).join(''):'<div class="shell-note">正在按开场白规则准备…发送消息后将按最新配置回复。</div>'}</div><div class="filters"><input class="input" id="test-chat-input" style="flex:1" placeholder="请输入消息..." onkeydown="if(event.key==='Enter'){event.preventDefault();app.sendTestChat()}"><button type="button" class="primary" onclick="app.sendTestChat()">发送</button></div></div>`,async()=>{});document.querySelector('#modal-form button[type=submit]')?.remove();setTimeout(()=>{const el=document.querySelector('#test-chat-thread');if(el)el.scrollTop=el.scrollHeight},0);if(wantOpening){try{const r=await this.api(`/agents/${this.agentId}/test-chat`,{method:'POST',body:JSON.stringify({opening:true,history:[]})});this.testChat.push({role:'assistant',content:r.reply,source:(r.source||'builtin')+(r.reason?'/'+r.reason:'')});this.openTestChat(true)}catch(e){/* 开场失败不阻断试聊 */}}},
  async sendTestChat(){const input=document.querySelector('#test-chat-input');const content=input?.value?.trim();if(!content){this.toast('请输入消息',true);return}this.testChat.push({role:'user',content});try{const r=await this.api(`/agents/${this.agentId}/test-chat`,{method:'POST',body:JSON.stringify({content,history:this.testChat.slice(0,-1)})});this.testChat.push({role:'assistant',content:r.reply,source:r.source+(r.terminated?`/${r.reason}`:'')});input.value='';this.openTestChat(true)}catch(e){this.testChat.pop();this.toast(e.message,true)}},

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
      if(selected){
        const cfgPack=await this.api(`/ai-platforms/${selected.id}/configs`);
        configs=cfgPack.items||[];
        fields=(cfgPack.platform&&cfgPack.platform.fields)||[];
        this.aiPlatformFields=fields;
        this.aiPlatformSelected=cfgPack.platform||selected;
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
        this.modal('测试结果',`<div class="shell-note"><b>回复</b><pre style="white-space:pre-wrap;margin:8px 0 0">${this.esc(r.reply||'')}</pre><div class="muted" style="margin-top:10px">模型：${this.esc(r.model||'-')} · 平台：${this.esc(r.platform?.name||'-')}</div></div>`,async()=>{});
        document.querySelector('#modal-form button[type=submit]')?.remove();
      }catch(e){this.toast(e.message,true);throw e}
    });
  },

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

  toggleChatMoreMenu(e){
    e?.stopPropagation?.();
    this.toggleToolbarDropdown('#chat-more-menu', e);
  },
  batchChatConnectModal(){const selected=[...document.querySelectorAll('.account-check:checked')].map(x=>Number(x.value));this.modal('批量标记客服在线',`<div class="form-grid">${this.selectRaw('scope','账号范围',this.opt('chatConnectScopes',[['selected','勾选账号'],['online','全部已登录 TikTok']]),'selected')}${this.selectRaw('syncMessages','同步消息标记',[['true','开启'],['false','关闭']],'true')}${this.selectRaw('autoTranslate','自动翻译',[['false','关闭'],['true','开启']],'false')}<div class="field full"><div class="muted">将账号标记为客服在线，并写入会话连接。真实 TikTok 私信同步仍依赖本地会话层。</div></div></div>`,async d=>{let ids=selected;if(d.scope==='online'){const pack=await this.api('/chat/accounts');ids=(pack.items||[]).filter(a=>a.login_status==='online'&&a.browser_profile_id).map(a=>a.id)}if(!ids.length)throw new Error(d.scope==='selected'?'请先勾选账号':'没有可登录的账号');const r=await this.api('/chat/accounts/batch-connect',{method:'POST',body:JSON.stringify({accountIds:ids,syncMessages:d.syncMessages==='true',autoTranslate:d.autoTranslate==='true'})});this.toast(`批量登录成功 ${r.connected}，失败 ${r.failed}`);this.closeModal();this.refresh()})},
  async manageChatTemplates(){
    await this.loadRefs();
    const rows=(this.templates||[]).slice();
    const gs=this.groups.filter(g=>g.type==='message');
    this.modal('管理话术',`<div class="form-grid"><div class="field full"><div class="action-bar" style="margin:0"><button class="primary tiny" type="button" onclick="app.closeModal();app.templateModal()">+ 添加话术</button>${gs.length?'':`<button class="ghost tiny" type="button" onclick="app.closeModal();app.groupModal('message')">先建分类</button>`}</div></div><div class="field full">${rows.length?`<div class="table-container"><table><thead><tr><th>名称</th><th>分类</th><th>内容</th><th></th></tr></thead><tbody>${rows.map(t=>`<tr><td>${this.esc(t.name)}</td><td>${this.esc(t.group_name||'-')}</td><td>${this.esc(String(t.content||'').slice(0,60))}</td><td><button class="tiny" type="button" onclick='app.closeModal();app.templateModal(${JSON.stringify(t)})'>编辑</button> <button class="tiny" type="button" onclick='app.useTemplate(${JSON.stringify(t.content)});app.closeModal()'>使用</button> <button class="tiny danger" type="button" onclick="app.remove('/message-templates/${t.id}','消息模板')">删除</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">还没有话术，点上方添加</div>'}</div></div>`,async()=>{},false,{hideSubmit:true,wide:true});
  },
  async renderUids(opts={}){
    this._uidRenderGen=(this._uidRenderGen||0)+1;
    const gen=opts.gen||this._uidRenderGen;
    const still=()=>this.view==='chat'&&(this.chatPane||'')==='uids'&&gen===this._uidRenderGen;
    const canWrite=this.canPermission('chat.manage')||this.canPermission('publish.mass');
    const canGroup=this.canPermission('group.manage');
    const groups=await this.api('/uids/groups');
    this.uidGroups=groups;
    if(this.uidGroupId&&!groups.some(g=>Number(g.id)===Number(this.uidGroupId)))this.uidGroupId='';
    if(!this.uidGroupId&&groups[0])this.uidGroupId=groups[0].id;
    const kw=encodeURIComponent(this.uidKeyword||'');
    const page=this.uidPage||1;
    const pack=this.uidGroupId
      ?await this.api(`/uids?groupId=${this.uidGroupId}&page=${page}&pageSize=20${kw?`&keyword=${kw}`:''}`)
      :{items:[],stats:{total:0,unused:0,used:0,failed:0},page:1,pages:1,total:0};
    if(!still())return;
    const stats=pack.stats||{};
    const writeBtns=canWrite
      ?`<button type="button" class="ghost" onclick="app.exportUnusedUids()">导出未使用</button>
          <button type="button" class="ghost" onclick="app.dedupeUids()">去重</button>
          <button type="button" class="ghost" onclick="app.cleanupUids('used')">清理已使用</button>
          <button type="button" class="ghost" onclick="app.cleanupUids('failed')">清理失败</button>
          <button type="button" class="ghost" onclick="app.cleanupUids('unused')">清理未使用</button>
          <button type="button" class="ghost" onclick="app.keepUnusedUids()">私信成功去重</button>
          <button type="button" class="danger" onclick="app.clearUidGroup()">按组删除</button>`
      :'<span class="muted">当前角色仅可查看 UID</span>';
    const hasGroup=!!this.uidGroupId;
    const rows=pack.items||[];
    const importBlock=hasGroup
      ?(canWrite
        ?`<div class="uid-import-card">
            <div class="uid-import-head">
              <b>导入 UID</b>
              <span class="muted">每行一个：UID 或 UID----用户名</span>
            </div>
            <textarea id="uid-import" class="input uid-import-textarea" rows="4" placeholder="123456789&#10;987654321----nickname"></textarea>
            <div class="uid-import-actions">
              <select id="uid-import-mode" class="input uid-import-mode">
                <option value="append">追加导入</option>
                <option value="dedupe">去重导入</option>
                <option value="replace">清空后导入</option>
              </select>
              <button type="button" class="primary" onclick="app.importUids()">导入</button>
              <label class="ghost uid-import-file" title="从 TXT 读入后再点导入">导入 TXT<input type="file" accept=".txt,text/plain" hidden onchange="app.importUidFile(this)"></label>
            </div>
          </div>`
        :'<div class="uid-import-card"><div class="muted" style="padding:12px 0">当前角色无权导入 UID</div></div>')
      :'';
    let listBlock='';
    if(!hasGroup){
      listBlock=`<div class="uid-empty-panel"><div class="empty">请先在左侧创建并选择 UID 分组</div></div>`;
    }else if(rows.length){
      listBlock=`<div class="table-container uid-table-wrap"><table><thead><tr><th>UID</th><th>用户名</th><th>状态</th><th>使用时间</th><th>操作</th></tr></thead><tbody>${rows.map(x=>`<tr><td><code class="uid-code">${this.esc(x.uid)}</code></td><td>${this.esc(x.username||'-')}</td><td>${this.badge(x.status==='unused'?'pending':x.status==='used'?'success':x.status)}</td><td class="muted">${this.esc(x.used_at||'-')}</td><td>${canWrite?`<button type="button" class="tiny danger" onclick='app.deleteUidRow(${x.id},${JSON.stringify(x.uid)})'>删除</button>`:'-'}</td></tr>`).join('')}</tbody></table></div>${UI.pager(pack,'uidPage')}`;
    }else if(this.uidKeyword){
      listBlock=`<div class="uid-empty-panel"><div class="empty">没有匹配「${this.esc(this.uidKeyword)}」的 UID</div></div>`;
    }else{
      listBlock='';
    }
    const content=document.querySelector('#content');
    content.classList.remove('chat-mode');
    content.innerHTML=`<div class="workspace uid-workspace">
      <aside class="side-groups uid-sidebar">
        <h3>UID 分组</h3>
        <div class="group-list">${groups.map(g=>`<button type="button" class="${Number(this.uidGroupId)===Number(g.id)?'active':''}" onclick="app.selectUidGroup(${g.id})">
          <div class="row"><b>${this.esc(g.name)}</b>${canGroup?`<span class="group-side-acts"><span class="group-act" title="编辑分组" onclick="event.stopPropagation();app.editUidGroup(${g.id})">改</span><span class="group-act danger" title="删除分组" onclick="event.stopPropagation();app.remove('/groups/${g.id}','UID 分组')">删</span></span>`:''}</div>
          <div class="row meta"><span>${g.unused||0} 未使用</span><span>共 ${g.total||0}</span></div>
        </button>`).join('')||'<div class="muted" style="padding:8px">暂无分组</div>'}</div>
        <button type="button" class="ghost uid-add-group" onclick="app.groupModal('uid')" ${canGroup?'':'disabled title="无分组管理权限"'}>+ 分组</button>
      </aside>
      <div class="panel uid-main-panel">
        <div class="matrix-action-bar uid-action-bar">
          <div class="left">${hasGroup?writeBtns:'<span class="muted">选择左侧分组后可管理 UID</span>'}</div>
          <div class="right"><span class="muted">客服群发目标池 · 按分组维护</span></div>
        </div>
        ${hasGroup?`<div class="search-bar task-filter-bar uid-filter-bar">
          <input id="uid-search" class="input" type="search" placeholder="搜索 UID / 用户名" value="${this.esc(this.uidKeyword||'')}" onkeydown="if(event.key==='Enter')app.searchUids()">
          <button type="button" class="primary" onclick="app.searchUids()">查询</button>
          <button type="button" class="ghost" onclick="app.uidKeyword='';app.uidPage=1;app.refresh()">重置</button>
        </div>
        <div class="stats uid-stats">${this.stat('总数',stats.total||0,'本组 UID','#ecf5ff')}${this.stat('未使用',stats.unused||0,'可分配','#f0f9eb')}${this.stat('已使用',stats.used||0,'群发已消耗','#fdf6ec')}${this.stat('失败',stats.failed||0,'发送失败','#fef0f0')}</div>
        ${importBlock}`:''}
        ${listBlock}
      </div>
    </div>`;
  },selectUidGroup(id){this.uidGroupId=id;this.uidKeyword='';this.uidPage=1;this.refresh()},
  searchUids(){this.uidKeyword=document.querySelector('#uid-search')?.value||'';this.uidPage=1;this.refresh()},
  async importUids(){if(!this.uidGroupId){this.toast('请选择分组',true);return}if(!(this.canPermission('chat.manage')||this.canPermission('publish.mass'))){this.toast('当前角色无权导入 UID',true);return}const content=document.querySelector('#uid-import')?.value||'';const mode=document.querySelector('#uid-import-mode')?.value||'append';if(!content.trim()){this.toast('请粘贴 UID',true);return}if(mode==='replace'&&!(await this.ask('将清空该分组全部 UID 再导入，是否继续？')))return;try{const r=await this.api('/uids/import',{method:'POST',body:JSON.stringify({groupId:Number(this.uidGroupId),content,mode})});this.toast(r.imported?`导入 ${r.imported}，重复 ${r.duplicates}${r.cleared?`，清空 ${r.cleared}`:''}`:`没有新 UID 导入（重复 ${r.duplicates||0}）`,!r.imported);this.refresh()}catch(e){this.toast(e.message,true)}},
  importUidFile(input){const file=input?.files?.[0];if(input)input.value='';if(!file)return;const reader=new FileReader();reader.onload=()=>{const box=document.querySelector('#uid-import');if(box)box.value=String(reader.result||'');this.toast(`已读入 ${file.name}，请选择导入方式后点导入`)};reader.onerror=()=>this.toast('读取文件失败',true);reader.readAsText(file)},
  async exportUnusedUids(){if(!this.uidGroupId){this.toast('请选择分组',true);return}if(!(this.canPermission('chat.manage')||this.canPermission('publish.mass'))){this.toast('当前角色无权导出 UID',true);return}if(!(await this.ask('导出当前分组中未使用的 UID？')))return;try{const headers=this.authToken?{Authorization:'Bearer '+this.authToken}:{};const base=window.TKSWARM_API_BASE||'';const r=await fetch(base+'/api/uids/export?groupId='+this.uidGroupId,{headers});if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.message||'导出失败')}const text=await r.text();if(!String(text||'').trim()){this.toast('没有未使用 UID 可导出',true);return}const blob=new Blob([text],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='unused-uids.txt';a.click();URL.revokeObjectURL(url);this.toast('已导出未使用 UID')}catch(e){this.toast(e.message,true)}},
  async cleanupUids(status){if(!this.uidGroupId){this.toast('请选择分组',true);return}if(!(this.canPermission('chat.manage')||this.canPermission('publish.mass'))){this.toast('当前角色无权清理 UID',true);return}const labels={used:'已使用',failed:'失败',unused:'未使用'};if(!(await this.ask(`确定清理该分组中状态为「${labels[status]||status}」的 UID 吗？`)))return;try{const r=await this.api('/uids/cleanup',{method:'POST',body:JSON.stringify({groupId:Number(this.uidGroupId),status})});this.toast(r.deleted?`已清理 ${r.deleted} 条`:`没有可清理的 UID`,!r.deleted);this.refresh()}catch(e){this.toast(e.message,true)}},
  async keepUnusedUids(){if(!this.uidGroupId){this.toast('请选择分组',true);return}if(!(this.canPermission('chat.manage')||this.canPermission('publish.mass'))){this.toast('当前角色无权操作 UID',true);return}if(!(await this.ask('将删除该分组中已使用/失败的 UID，仅保留未使用。是否继续？')))return;try{const r=await this.api('/uids/keep-unused',{method:'POST',body:JSON.stringify({groupId:Number(this.uidGroupId)})});this.toast(r.deleted?`已去掉 ${r.deleted} 条，剩余未使用 ${r.remaining}`:'没有需要去掉的已使用/失败 UID',!r.deleted);this.refresh()}catch(e){this.toast(e.message,true)}},
  async clearUidGroup(){if(!this.uidGroupId)return;if(!(this.canPermission('chat.manage')||this.canPermission('publish.mass'))){this.toast('当前角色无权清空 UID',true);return}if(!(await this.ask('确定删除该分组下的全部 UID 吗？分组本身会保留。')))return;try{const r=await this.api(`/uids/group/${this.uidGroupId}`,{method:'DELETE'});this.toast(r.deleted?`已删除 ${r.deleted} 条`:'该分组没有 UID 可删',!r.deleted);this.refresh()}catch(e){this.toast(e.message,true)}},
  async renderChat(){
    if((this.chatPane||'workbench')==='uids'){
      this.stopChatSyncTimer?.();
      return this.renderUids();
    }
    document.querySelector('#content').classList.add('chat-mode');
    this.startChatSyncTimer();
    const accountsPack=await this.api('/chat/accounts');
    const accounts=accountsPack.items||[];
    const keywordAcc=this.chatAccountKeyword||'';
    const shownAccounts=keywordAcc?accounts.filter(a=>String(a.username||'').toLowerCase().includes(keywordAcc.toLowerCase())):accounts;
    const mode=this.chatMode||'account';
    let friendsPack={items:[],counts:{},tags:[]}; let messagesPack={items:[],friend:null};
    const friendQuery=`filter=${encodeURIComponent(this.chatFilter||'all')}&keyword=${encodeURIComponent(this.chatKeyword||'')}&tag=${encodeURIComponent(this.chatTag||'')}&pageSize=100`;
    if(mode==='global'){
      friendsPack=await this.api(`/chat/friends?scope=global&${friendQuery}`);
      if(this.chatFriendId&&!friendsPack.items.some(f=>Number(f.id)===Number(this.chatFriendId)))this.chatFriendId=friendsPack.items[0]?.id||null;
      if(!this.chatFriendId&&friendsPack.items[0])this.chatFriendId=friendsPack.items[0].id;
      const picked=friendsPack.items.find(f=>Number(f.id)===Number(this.chatFriendId));
      if(picked)this.chatAccountId=picked.account_id;
    }else if(!this.chatAccountId&&accounts.length)this.chatAccountId=accounts.find(a=>a.connection_status==='online')?.id||accounts[0].id;
    const account=accounts.find(a=>Number(a.id)===Number(this.chatAccountId))||null;
    if(mode!=='global'&&account){
      friendsPack=await this.api(`/chat/friends?accountId=${account.id}&${friendQuery}`);
      if(!this.chatFriendId&&friendsPack.items[0])this.chatFriendId=friendsPack.items[0].id;
      if(this.chatFriendId&&!friendsPack.items.some(f=>Number(f.id)===Number(this.chatFriendId)))this.chatFriendId=friendsPack.items[0]?.id||null;
    }
    if(this.chatFriendId)messagesPack=await this.api(`/chat/messages?friendId=${this.chatFriendId}&pageSize=100`);
    let dmTplOn=true;
    try{const st=await this.api('/settings');dmTplOn=st.dmTemplateEnabled!==false;this.dmTemplateEnabled=dmTplOn}catch{dmTplOn=this.dmTemplateEnabled!==false}
    const scriptGroups=this.groups.filter(g=>g.type==='message');
    const templates=dmTplOn?this.templates.filter(t=>(t.enabled!==0&&t.enabled!==false)&&(!this.scriptGroupId||String(t.group_id)===String(this.scriptGroupId))):[];
    const scriptChips=dmTplOn&&scriptGroups.length?`<button type="button" class="${this.scriptGroupId?'':'active'}" onclick="app.setChatScriptGroup('')">全部</button>`+scriptGroups.map(g=>`<button type="button" class="${String(this.scriptGroupId)===String(g.id)?'active':''}" onclick="app.setChatScriptGroup(${g.id})">${this.esc(g.name)}</button>`).join(''):'';
    const templateButtons=dmTplOn?(templates.length?templates.slice(0,8).map(t=>`<button type="button" onclick='app.useTemplate(${JSON.stringify(t.content)})'>${this.esc(t.name)}</button>`).join(''):'<span class="muted">暂无话术</span>'):'<span class="muted">设置中「启用私信话术」已关闭</span>';
    const filters=(this.meta?.chatFilters||[]).length?this.meta.chatFilters.map(x=>[x.code,x.label]):[['all','全部好友'],['unread','未读消息'],['unreplied','我未回复'],['friendUnreplied','好友未回复'],['new','新好友'],['stranger','陌生人'],['follower','粉丝'],['mutual','互关'],['blocked','已拉黑'],['pinned','已置顶']];
    const counts=friendsPack.counts||{};
    document.querySelector('#content').innerHTML=`<div class="chat-shell">
      <aside class="chat-col">
        <div class="chat-col-head"><h3>账号</h3><div><button class="tiny" onclick="app.batchChatConnect()">批量登录</button><button class="tiny" onclick="app.batchChatDisconnect()">退出</button></div></div>
        <div class="chat-stats"><span>总 <b>${accountsPack.stats?.total||0}</b></span><span>在线 <b>${accountsPack.stats?.online||0}</b></span><span>未读 <b>${accountsPack.stats?.unread||0}</b></span></div>
        <div class="chat-account-search"><input class="input" style="width:100%" placeholder="搜索账号" value="${this.esc(keywordAcc)}" onkeydown="if(event.key==='Enter'){app.chatAccountKeyword=this.value;app.refresh()}"></div>
        <div class="chat-list">${shownAccounts.length?shownAccounts.map(a=>`<div class="chat-account ${Number(a.id)===Number(this.chatAccountId)?'active':''}" onclick="app.selectChatAccount(${a.id})"><div class="chat-avatar">${this.esc((a.username||'?')[0].toUpperCase())}</div><div class="chat-meta"><b>${this.esc(a.username)}${a.unread_count?` <span class="badge failed">${a.unread_count}</span>`:''}</b><small><span class="dot ${a.connection_status==='online'?'on':''}"></span>${a.connection_status==='online'?'客服在线':(a.login_status==='online'?'已登录':'未登录')} · 好友 ${a.friend_count||0}</small></div><div>${a.connection_status==='online'?`<button class="tiny" onclick="event.stopPropagation();app.chatDisconnect(${a.id})">退出</button>`:`<button class="tiny primary" onclick="event.stopPropagation();app.chatConnect(${a.id})">登录</button>`}</div></div>`).join(''):'<div class="shell-note">暂无账号</div>'}</div>
      </aside>
      <aside class="chat-col chat-filter-col">
        <div class="chat-mode-switch">
          <button type="button" class="${mode==='account'?'active':''}" onclick="app.setChatMode('account')">账号模式</button>
          <button type="button" class="${mode==='global'?'active':''}" onclick="app.setChatMode('global')" title="跨账号查看本地会话好友">全局模式</button>
        </div>
        ${mode==='global'?'<div class="shell-note" style="padding:8px 10px;font-size:12px;margin:0 8px 8px">正在查看全部账号的本地好友。点好友会自动切到对应客服账号。</div>':''}
        <div class="filter-section-title">好友筛选</div>
        <div class="filter-sidebar">
          ${filters.map(([k,n])=>`<button type="button" class="filter-item ${(this.chatFilter||'all')===k?'active':''}" onclick="app.setChatFilter('${k}')"><span>${n}</span><span class="count">${counts[k]!=null?counts[k]:'-'}</span></button>`).join('')}
          <div class="filter-section-title">自定义标签 <button class="tiny" type="button" onclick="event.stopPropagation();app.manageChatTags()">管理</button></div>
          ${(friendsPack.customTags||[]).length?(friendsPack.customTags||[]).map(t=>`<button type="button" class="filter-item ${this.chatTag===t.name?'active':''}" onclick="app.setChatTag('${this.esc(t.name)}')"><span>${this.esc(t.name)}</span></button>`).join(''):''}
          ${(friendsPack.tags||[]).filter(t=>!(friendsPack.customTags||[]).some(c=>c.name===t)).length?(friendsPack.tags||[]).filter(t=>!(friendsPack.customTags||[]).some(c=>c.name===t)).map(t=>`<button type="button" class="filter-item ${this.chatTag===t?'active':''}" onclick="app.setChatTag('${this.esc(t)}')"><span>${this.esc(t)}</span></button>`).join(''):''}
          ${!(friendsPack.tags||[]).length&&!(friendsPack.customTags||[]).length?'<div class="shell-note" style="padding:8px;font-size:12px">还没有标签。点「管理」添加，或打开会话后点「标签」。</div>':''}
          ${this.chatTag?'<button type="button" class="tiny" onclick="app.setChatTag(\'\')">清除标签筛选</button>':''}
        </div>
      </aside>
      <aside class="chat-col">
        <div class="chat-col-head"><h3>好友${mode==='global'?' <span class="muted" style="font-weight:400;font-size:12px">· 全局</span>':''}</h3><div>${(mode==='global'||account)?`<button class="tiny" onclick="app.searchChatUser()">搜索用户</button>`:''}${account?`<button class="tiny" onclick="app.addChatFriend()">发起聊天</button><button class="tiny" onclick="app.chatReadAll()">全部已读</button>`:''}</div></div>
        <div class="filters" style="padding:8px 12px;border-bottom:1px solid var(--line)"><input id="chat-friend-search" class="input" style="flex:1" placeholder="${mode==='global'?'搜索全部账号好友':'搜索好友'}" value="${this.esc(this.chatKeyword||'')}" onkeydown="if(event.key==='Enter')app.searchChatFriends()"><button class="ghost" onclick="app.searchChatFriends()">查询</button></div>
        <div class="chat-list">${(mode!=='global'&&!account)?'<div class="shell-note">请先选择账号并登录客服</div>':(friendsPack.items.length?friendsPack.items.map(f=>`<div class="chat-friend ${Number(f.id)===Number(this.chatFriendId)?'active':''}" onclick="app.selectChatFriend(${f.id},${f.account_id})"><div class="chat-avatar">${this.esc(((f.nickname||f.username||'?')[0]||'?').toUpperCase())}</div><div class="chat-meta"><b>${f.is_pinned?'📌 ':''}${this.esc(f.nickname||f.username||f.friend_uid)}${mode==='global'?` <span class="muted">${this.esc(f.account_username||'')}</span>`:''}${(f.tags||[]).length?` <span class="muted">${(f.tags||[]).map(t=>this.esc(t)).join(' ')}</span>`:''}${f.unread_count?` <span class="badge failed">${f.unread_count}</span>`:''}</b><small>${this.esc(f.last_message||'暂无消息')}</small></div></div>`).join(''):'<div class="shell-note">暂无好友</div>')}</div>
      </aside>
      <section class="chat-col">
        <div class="chat-col-head"><div><h3>${messagesPack.friend?this.esc(messagesPack.friend.nickname||messagesPack.friend.username||messagesPack.friend.friend_uid):'会话'}</h3><div class="muted">${messagesPack.friend?`关系：${this.esc(messagesPack.friend.relation)} · UID ${this.esc(messagesPack.friend.friend_uid)}`:''}${account?.ai_hosting?` · AI托管 ${this.esc(account.agent_name||'')}`:''}</div></div><div>${messagesPack.friend?`<button class="tiny" onclick="app.togglePinFriend()">${messagesPack.friend.is_pinned?'取消置顶':'置顶'}</button><button class="tiny" onclick="app.editFriendTags()">标签</button><button class="tiny" onclick="app.blockFriend()">${messagesPack.friend.relation==='blocked'?'取消拉黑':'拉黑'}</button>${this.canPermission('chat.manage')?`<button class="tiny ${account?.ai_hosting?'primary':''}" onclick="app.bindAiHosting()">${account?.ai_hosting?'关闭AI托管':'AI托管'}</button>`:''}<div class="dropdown" style="display:inline-block"><button class="tiny" type="button" onclick="app.toggleChatMoreMenu(event)">更多 <span class="btn-arrow-down">▾</span></button><div id="chat-more-menu" class="dropdown-menu hidden"><button type="button" onclick="app.refreshChatFans()">刷新粉丝</button><button type="button" onclick="app.showChatAccountStats()">账号统计</button><button type="button" onclick="app.writeLocalTestInbound()">写入本地测试消息</button><button type="button" onclick="app.openChatTranslate()">翻译设置</button></div></div>`:''}</div></div>
        ${messagesPack.friend?`<div class="translate-bar"><span>翻译：${messagesPack.friend.translate_in||messagesPack.friend.translate_out?`收${messagesPack.friend.translate_in?'开':'关'} / 发${messagesPack.friend.translate_out?'开':'关'} · 原文 ${this.esc(messagesPack.friend.translate_source||'auto')} → ${this.esc(messagesPack.friend.translate_target||'zh')}`:(account?.auto_translate?'账号级收信翻译':'未开启')}</span><button class="tiny" type="button" onclick="app.openChatTranslate()">设置</button><button class="tiny" type="button" onclick="app.autoCheckChatLang()">自动检测语言</button><button class="tiny" type="button" onclick="app.applyChatTranslate()">应用到其他好友</button><button class="tiny" type="button" onclick="app.clearChatTranslate()">取消翻译</button></div>`:''}
        <div class="thread" id="chat-thread">${messagesPack.items?.length?messagesPack.items.map(m=>`<div class="bubble ${m.direction==='out'?'out':''}">${m.msg_type==='image'?`<img src="${this.esc(m.content)}" alt="图片" style="max-width:220px;border-radius:8px;display:block">`:this.esc(m.content)}<span class="time">${this.esc(m.created_at)} · ${m.direction==='out'?'我':'对方'}${m.translated?` · 译：${this.esc(m.translated)}`:''}</span></div>`).join(''):'<div class="shell-note">选择好友后开始会话。<br>这里是本地会话。没有官方私信接口时，不会写入假的 TikTok 消息。</div>'}</div>
        <div class="composer">
          <div class="composer-toolbar">
            <button class="tiny" type="button" onclick="app.manageChatTemplates()">管理话术</button>
            <button class="tiny" type="button" onclick="app.openChatTranslate()">翻译设置</button>
            <button class="tiny" type="button" onclick="app.openChatEmoji()">表情</button>
            <label class="tiny" style="display:inline-flex;align-items:center;cursor:pointer">图片<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onchange="app.sendChatImage(this)"></label>
          </div>
          <div class="composer-tools"><span class="muted">快捷话术</span><div class="quick-list">${scriptChips}${templateButtons}</div></div>
          <textarea id="chat-input" placeholder="${account?(account.connection_status==='online'?'输入消息…':'请先登录客服聊天'):'请先选择账号'}" ${account&&account.connection_status==='online'&&messagesPack.friend?'':'disabled'}></textarea>
          <div class="toolbar" style="margin:0"><span class="muted">${this.canPermission('chat.send')?'本地发送写入会话；比特发送会打开环境真实投递':'当前角色无发送权限'}</span><div>${this.canPermission('chat.send')?`<button class="ghost" onclick="app.sendChatMessageBit()" ${account&&account.connection_status==='online'&&messagesPack.friend&&account.browser_profile_id?'':'disabled'}>比特发送</button> <button class="primary" onclick="app.sendChatMessage()" ${account&&account.connection_status==='online'&&messagesPack.friend?'':'disabled'}>发送</button>`:`<button class="primary" disabled>无发送权限</button>`}</div></div>
        </div>
      </section>
    </div>`;
    const thread=document.querySelector('#chat-thread'); if(thread)thread.scrollTop=thread.scrollHeight;
  },
  setChatMode(mode){this.chatMode=mode;this.chatFriendId=null;this.chatTag='';this.refresh()},
  setChatTag(tag){this.chatTag=tag||'';this.chatFriendId=null;this.refresh()},
  openChatTranslate(){if(!this.chatFriendId){this.toast('请先选择好友',true);return}this.api(`/chat/messages?friendId=${this.chatFriendId}&pageSize=1`).then(pack=>{const f=pack.friend||{};this.modal('翻译设置',`<div class="form-grid">${this.selectRaw('translateIn','接收翻译',[['false','关闭'],['true','开启']],f.translate_in?'true':'false')}${this.selectRaw('translateOut','发送翻译',[['false','关闭'],['true','开启']],f.translate_out?'true':'false')}${this.selectRaw('translateSource','原文语言',[['auto','自动检测'],['zh','中文'],['en','英文'],['ja','日文'],['ko','韩文'],['es','西班牙文']],f.translate_source||'auto')}${this.selectRaw('translateTarget','目标语言',[['zh','中文'],['en','英文'],['ja','日文'],['ko','韩文'],['es','西班牙文']],f.translate_target||'zh')}<div class="field full"><div class="muted">只对当前好友生效。未配置翻译接口时不会假装翻译成功。也可点「自动检测语言」根据对方近期消息识别原文语言。</div></div><div class="action-bar"><button class="ghost tiny" type="button" onclick="app.autoCheckChatLang(true)">自动检测语言并填入</button></div></div>`,async d=>{await this.api(`/chat/friends/${this.chatFriendId}`,{method:'PATCH',body:JSON.stringify({translateIn:d.translateIn==='true',translateOut:d.translateOut==='true',translateSource:d.translateSource||'auto',translateTarget:d.translateTarget||'zh'})});this.toast('翻译设置已保存');this.closeModal();this.refresh()})}).catch(e=>this.toast(e.message,true))},
  async autoCheckChatLang(fromModal=false){
    if(!this.chatFriendId){this.toast('请先选择好友',true);return}
    this.toast('正在根据对方近期消息检测语言…');
    try{
      const r=await this.api(`/chat/friends/${this.chatFriendId}/auto-check-lang`,{method:'POST',body:JSON.stringify({apply:true})});
      const labels={zh:'中文',en:'英文',ja:'日文',ko:'韩文',es:'西班牙文',other:'其他'};
      const tip=`识别为 ${labels[r.language]||r.language}（${r.method==='ai'?'智能翻译':r.method==='local'?'本地特征':'检测'}）`;
      this.toast(r.note?`${tip} · ${r.note}`:tip);
      if(fromModal){
        const sel=document.querySelector('#modal-form [name=translateSource]');
        if(sel && r.language && r.language!=='other') sel.value=r.language;
      } else {
        this.refresh();
      }
    }catch(e){this.toast(e.message,true)}
  },
  async applyChatTranslate(){if(!this.chatFriendId||!this.chatAccountId){this.toast('请先选择好友',true);return}const pack=await this.api(`/chat/friends?accountId=${this.chatAccountId}&pageSize=200`);const others=(pack.items||[]).filter(f=>Number(f.id)!==Number(this.chatFriendId));if(!others.length){this.toast('没有其他好友可应用',true);return}this.modal('应用到其他好友',`<div class="form-grid"><div class="field full"><div class="muted">把当前好友的收/发翻译设置复制到勾选的好友。</div></div><div class="field full"><label>好友</label><div class="chip-row">${others.map(f=>`<label class="chip"><input type="checkbox" class="apply-friend" value="${f.id}"> ${this.esc(f.nickname||f.username||f.friend_uid)}</label>`).join('')}</div></div></div>`,async()=>{const friendIds=[...document.querySelectorAll('.apply-friend:checked')].map(el=>Number(el.value));if(!friendIds.length)throw new Error('请至少选择一个好友');const r=await this.api(`/chat/friends/${this.chatFriendId}/apply-translate`,{method:'POST',body:JSON.stringify({friendIds})});this.toast(`已应用到 ${r.updated??r.applied??0} 个好友`);this.closeModal();this.refresh()})},
  async clearChatTranslate(){if(!this.chatFriendId){this.toast('请先选择好友',true);return}if(!(await this.ask('取消当前好友的收信和发信翻译？')))return;try{await this.api(`/chat/friends/${this.chatFriendId}`,{method:'PATCH',body:JSON.stringify({clearTranslate:true})});this.toast('已取消翻译');this.refresh()}catch(e){this.toast(e.message,true)}},
  selectChatAccount(id){this.chatAccountId=id;this.chatFriendId=null;this.refresh()},
  selectChatFriend(id,accountId){this.chatFriendId=id;if(accountId)this.chatAccountId=Number(accountId);this.refresh()},
  setChatFilter(filter){this.chatFilter=filter;this.refresh()},
  searchChatFriends(){this.chatKeyword=document.querySelector('#chat-friend-search')?.value||'';this.refresh()},
  async chatConnect(id){try{let autoTranslate=false,syncMessages=true;try{const st=await this.api('/settings');autoTranslate=st.translationOnReceive===true||st.translationMode==='basic'||st.translationMode==='ai'||st.translationMode==='normal';syncMessages=st.privateMessageSync!==false;this.messageSyncInterval=Number(st.messageSyncInterval||10);this.notificationInterval=Number(st.notificationInterval||1);this.notificationSound=st.notificationSound||this.notificationSound;this.notificationSync=st.notificationSync!==false}catch{}await this.api(`/chat/accounts/${id}/connect`,{method:'POST',body:JSON.stringify({autoTranslate,syncMessages})});this.toast('已登录客服聊天');this.chatAccountId=id;this.startChatSyncTimer();this.refresh()}catch(e){this.toast(e.message,true)}},
  startChatSyncTimer(){if(this._chatSyncTimer)clearInterval(this._chatSyncTimer);const mins=Math.min(60,Math.max(1,Number(this.notificationInterval||this.messageSyncInterval||1)||1));const sec=Math.min(300,Math.max(15,mins*60));this._chatSyncTimer=setInterval(()=>{if(this.view==='chat')this.refresh()},sec*1000)},
  async refreshChatFans(){
    if(!this.chatAccountId){this.toast('请先选择账号',true);return}
    if(!(await this.ensureBitOnline('刷新粉丝')))return;
    if(!(await this.ensureNodeOnline('刷新粉丝')))return;
    this.toast('已创建粉丝列表同步任务，请保持本机 Node/比特在线…');
    try{
      const r=await this.api(`/chat/accounts/${this.chatAccountId}/refresh-fans`,{method:'POST'});
      const taskId=r.taskId;
      if(!taskId){this.toast(r.message||'已提交');this.refresh();return}
      const started=Date.now();
      while(Date.now()-started<180000){
        await new Promise(res=>setTimeout(res,2500));
        const st=await this.api(`/chat/accounts/${this.chatAccountId}/refresh-fans/status?taskId=${taskId}`);
        const p=st.progress||{};
        if(st.status==='completed'||st.status==='failed'||st.status==='paused'||st.status==='cancelled'){
          if(st.status==='completed'){
            this.toast(`粉丝同步完成：新增 ${p.added??'-'} / 更新 ${p.updated??'-'} · 本地粉丝好友 ${st.localFollowerFriends||0}`);
          }else{
            this.toast(st.error||`粉丝同步结束：${st.status}`,true);
          }
          this.refresh();
          return;
        }
        if(p.scraped!=null)this.toast(`正在拉取粉丝…已解析 ${p.scraped}`);
      }
      this.toast('同步仍在进行，可稍后在任务列表查看进度', 'warn');
      this.refresh();
    }catch(e){this.toast(e.message,true)}
  },
  stopChatSyncTimer(){if(this._chatSyncTimer){clearInterval(this._chatSyncTimer);this._chatSyncTimer=null}},
  async chatDisconnect(id){try{await this.api(`/chat/accounts/${id}/disconnect`,{method:'POST'});this.toast('已退出客服聊天');this.refresh()}catch(e){this.toast(e.message,true)}},
  async batchChatConnect(){const d=await this.api('/chat/accounts');const ids=(d.items||[]).filter(a=>a.login_status==='online'&&a.browser_profile_id&&a.connection_status!=='online').map(a=>a.id);if(!ids.length){this.toast('没有可登录的账号（需已登录 TikTok 且绑定环境）',true);return}try{const r=await this.api('/chat/accounts/batch-connect',{method:'POST',body:JSON.stringify({accountIds:ids})});this.toast(`批量登录成功 ${r.connected}，失败 ${r.failed}`);this.refresh()}catch(e){this.toast(e.message,true)}},
  async batchChatDisconnect(){const d=await this.api('/chat/accounts');const ids=(d.items||[]).filter(a=>a.connection_status==='online').map(a=>a.id);if(!ids.length){this.toast('当前没有在线客服账号',true);return}if(!(await this.ask(`确定退出全部 ${ids.length} 个在线客服连接？`)))return;try{await this.api('/chat/accounts/batch-disconnect',{method:'POST',body:JSON.stringify({accountIds:ids})});this.toast('已批量退出');this.refresh()}catch(e){this.toast(e.message,true)}},
  async chatReadAll(){if(!this.chatAccountId){this.toast('请先选择客服账号',true);return}try{await this.api(`/chat/accounts/${this.chatAccountId}/read-all`,{method:'POST'});this.toast('全部已读');this.refresh()}catch(e){this.toast(e.message,true)}},
  async chatMenuReadAll(){
    try{
      const pack=await this.api('/chat/accounts');
      const online=(pack.items||[]).filter(a=>a.connection_status==='online');
      if(!online.length){this.toast('请先登录至少一个客服账号，再使用全部已读',true);return}
      if(this.chatAccountId && online.some(a=>Number(a.id)===Number(this.chatAccountId))){
        await this.chatReadAll();
        return;
      }
      if(online.length===1){
        this.chatAccountId=online[0].id;
        await this.chatReadAll();
        return;
      }
      this.modal('全部一键已读',`<div class="form-grid">${this.selectRaw('accountId','选择客服账号',online.map(a=>[a.id,a.username||('账号#'+a.id)]),this.chatAccountId||online[0].id)}<div class="field full"><div class="muted">将对所选账号的本地会话全部标为已读。</div></div></div>`,async d=>{
        this.chatAccountId=Number(d.accountId);
        await this.api(`/chat/accounts/${this.chatAccountId}/read-all`,{method:'POST'});
        this.toast('全部已读');
        this.closeModal();
        this.refresh();
      });
    }catch(e){this.toast(e.message,true)}
  },
  async chatMenuTranslate(){
    if(this.chatFriendId){this.openChatTranslate();return}
    try{
      const pack=await this.api('/chat/accounts');
      const online=(pack.items||[]).filter(a=>a.connection_status==='online');
      if(!online.length){this.toast('请先登录客服并选择好友，再设置翻译',true);return}
      const accountId=this.chatAccountId && online.some(a=>Number(a.id)===Number(this.chatAccountId))?this.chatAccountId:online[0].id;
      this.chatAccountId=accountId;
      const friends=await this.api(`/chat/friends?accountId=${accountId}&pageSize=200`);
      const items=friends.items||[];
      if(!items.length){this.toast('当前账号还没有好友会话，请先发起聊天',true);this.refresh();return}
      this.modal('即时翻译设置',`<div class="form-grid">${this.selectRaw('friendId','选择好友',items.map(f=>[f.id,(f.nickname||f.username||f.friend_uid)]),items[0].id)}<div class="field full"><div class="muted">先选好友，再进入该好友的翻译开关。</div></div></div>`,async d=>{
        this.chatFriendId=Number(d.friendId);
        this.closeModal();
        this.refresh();
        setTimeout(()=>this.openChatTranslate(),80);
      });
    }catch(e){this.toast(e.message,true)}
  },
  async chatMenuAutoLang(){
    if(this.chatFriendId){await this.autoCheckChatLang();return}
    try{
      const pack=await this.api('/chat/accounts');
      const online=(pack.items||[]).filter(a=>a.connection_status==='online');
      if(!online.length){this.toast('请先登录客服并选择好友，再自动检测语言',true);return}
      const accountId=this.chatAccountId && online.some(a=>Number(a.id)===Number(this.chatAccountId))?this.chatAccountId:online[0].id;
      this.chatAccountId=accountId;
      const friends=await this.api(`/chat/friends?accountId=${accountId}&pageSize=200`);
      const items=friends.items||[];
      if(!items.length){this.toast('当前账号还没有好友会话',true);return}
      this.modal('自动检测语言',`<div class="form-grid">${this.selectRaw('friendId','选择好友',items.map(f=>[f.id,(f.nickname||f.username||f.friend_uid)]),items[0].id)}<div class="field full"><div class="muted">将根据该好友近期入站消息识别原文语言；未开启翻译或无消息时会明确提示失败。</div></div></div>`,async d=>{
        this.chatFriendId=Number(d.friendId);
        this.closeModal();
        await this.autoCheckChatLang();
        this.refresh();
      });
    }catch(e){this.toast(e.message,true)}
  },
  async chatMenuAiHosting(){
    if(this.chatAccountId){
      try{
        const pack=await this.api('/chat/accounts');
        const account=(pack.items||[]).find(a=>Number(a.id)===Number(this.chatAccountId));
        if(account?.connection_status==='online'){await this.bindAiHosting();return}
      }catch{}
    }
    try{
      const pack=await this.api('/chat/accounts');
      const online=(pack.items||[]).filter(a=>a.connection_status==='online');
      if(!online.length){this.toast('请先登录客服聊天，再开启 AI 托管',true);return}
      this.modal('AI 客服智能托管',`<div class="form-grid">${this.selectRaw('accountId','选择已登录客服',online.map(a=>[a.id,`${a.username||('账号#'+a.id)}${a.ai_hosting?'（已托管）':''}`]),online[0].id)}<div class="field full"><div class="muted">托管后对本系统本地消息自动回复，不会伪造 TikTok 投递。</div></div></div>`,async d=>{
        this.chatAccountId=Number(d.accountId);
        this.closeModal();
        this.refresh();
        setTimeout(()=>this.bindAiHosting(),80);
      });
    }catch(e){this.toast(e.message,true)}
  },
  addChatFriend(){if(!this.chatAccountId){this.toast('请先选择账号',true);return}this.modal('发起聊天',`<div class="form-grid">${this.field('friendUid','UID / 用户标识','','text',true)}${this.field('username','用户名（可选）')}${this.field('nickname','昵称（可选）')}${this.selectRaw('relation','关系',[['stranger','陌生人'],['follower','粉丝'],['friend','好友'],['mutual','互关']],'stranger')}${this.field('greeting','打招呼内容（可选）','','textarea')}</div>`,async d=>{d.accountId=Number(this.chatAccountId);const friend=await this.api('/chat/friends',{method:'POST',body:JSON.stringify(d)});this.toast('好友已添加');this.chatFriendId=friend.id;this.closeModal();this.refresh()})},
  searchChatUser(){const mode=this.chatMode||'account';if(mode!=='global'&&!this.chatAccountId){this.toast('请先选择账号',true);return}const tip=mode==='global'?'全局模式：先查全部账号的本地好友。加入新会话时需指定客服账号。':'先查本地好友。未命中时可加入本地会话，不会假装已从 TikTok 官方搜到。';this.modal(mode==='global'?'搜索用户（全局）':'搜索用户',`<div class="form-grid"><div class="field full"><label>用户名或 UID</label><div class="filters"><input class="input" id="chat-search-keyword" style="flex:1" placeholder="输入后点查询" onkeydown="if(event.key==='Enter'){event.preventDefault();app.runChatUserSearch()}"><button class="primary" type="button" onclick="app.runChatUserSearch()">查询</button></div></div><div class="field full"><div class="muted">${tip}</div></div><div id="chat-search-results"></div></div>`,async()=>{},false,{hideSubmit:true});},
  async runChatUserSearch(){const keyword=document.querySelector('#chat-search-keyword')?.value?.trim();const box=document.querySelector('#chat-search-results');if(!keyword){this.toast('请输入用户名或 UID',true);return}if(!box)return;box.innerHTML='<div class="muted">查询中…</div>';try{const mode=this.chatMode||'account';const q=mode==='global'?`/chat/search-user?scope=global&keyword=${encodeURIComponent(keyword)}`:`/chat/search-user?accountId=${this.chatAccountId}&keyword=${encodeURIComponent(keyword)}`;const pack=await this.api(q);const rows=(pack.items||[]).map(f=>`<tr><td>${this.esc(f.nickname||f.username||'-')}${mode==='global'?` <span class="muted">${this.esc(f.account_username||'')}</span>`:''}</td><td>${this.esc(f.friend_uid)}</td><td>${this.esc(f.relation)}</td><td><button class="tiny" type="button" onclick="app.selectChatFriend(${f.id},${f.account_id});app.closeModal()">打开</button></td></tr>`).join('');let addHtml='';if(pack.canAdd){if(mode==='global'){const accounts=(await this.api('/chat/accounts')).items||[];const opts=accounts.map(a=>`<option value="${a.id}">${this.esc(a.username||('#'+a.id))}</option>`).join('');addHtml=`<div class="action-bar" style="margin-top:10px;flex-wrap:wrap;gap:8px"><select id="chat-search-add-account" class="input" style="min-width:160px"><option value="">选择客服账号</option>${opts}</select><button class="primary" type="button" onclick='app.addSearchedUser(${JSON.stringify(pack.candidate)},true)'>加入本地会话并打开</button></div>`;}else{addHtml=`<div class="action-bar" style="margin-top:10px"><button class="primary" type="button" onclick='app.addSearchedUser(${JSON.stringify(pack.candidate)})'>加入本地会话并打开</button></div>`;}}box.innerHTML=`${rows?`<div class="table-container"><table><thead><tr><th>用户</th><th>UID</th><th>关系</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="empty">本地没有匹配好友</div>'}${addHtml}`;}catch(e){box.innerHTML='';this.toast(e.message,true)}},
  async addSearchedUser(candidate,pickAccount=false){if(!candidate)return;let accountId=Number(this.chatAccountId);if(pickAccount||!accountId){accountId=Number(document.querySelector('#chat-search-add-account')?.value||0);if(!accountId){this.toast('请选择要加入的客服账号',true);return}}try{const friend=await this.api('/chat/friends',{method:'POST',body:JSON.stringify({accountId,friendUid:candidate.friendUid,username:candidate.username||candidate.friendUid,nickname:candidate.nickname||'',relation:candidate.relation||'stranger'})});this.toast('已加入本地会话');this.chatAccountId=accountId;this.chatFriendId=friend.id;this.closeModal();this.refresh()}catch(e){this.toast(e.message,true)}},
  async showChatAccountStats(){if(!this.chatAccountId){this.toast('请先选择账号',true);return}try{const r=await this.api(`/chat/accounts/${this.chatAccountId}/stats`);const p=r.profile||{};this.modal('账号统计',`<div class="data-summary"><div><small>账号</small><b>${this.esc(r.username)}</b></div><div><small>粉丝</small><b>${p.followers_count??'-'}</b></div><div><small>关注</small><b>${p.following_count??'-'}</b></div><div><small>获赞</small><b>${p.likes_count??'-'}</b></div><div><small>本地好友</small><b>${r.friends?.total||0}</b></div><div><small>未读</small><b>${r.friends?.unread||0}</b></div></div><div class="data-meta">主页上次同步：${this.esc(p.last_synced_at||'尚未同步')}</div>`,()=>{},false,{hideSubmit:true}) }catch(e){this.toast(e.message,true)}},
  async sendChatMessage(){const content=document.querySelector('#chat-input')?.value?.trim();if(!content){this.toast('请输入消息',true);return}if(!this.chatFriendId){this.toast('请选择好友',true);return}try{await this.api('/chat/messages',{method:'POST',body:JSON.stringify({friendId:Number(this.chatFriendId),content})});document.querySelector('#chat-input').value='';this.refresh()}catch(e){this.toast(e.message,true)}},
  async sendChatMessageBit(){const content=document.querySelector('#chat-input')?.value?.trim();if(!content){this.toast('请输入消息',true);return}if(!this.chatFriendId){this.toast('请选择好友',true);return}if(!(await this.ensureBitOnline('比特发送')))return;if(!(await this.ask('将打开比特环境并向该好友发送私信，是否继续？')))return;this.toast('正在通过比特浏览器发送…');try{const r=await this.api('/chat/messages/bit-send',{method:'POST',body:JSON.stringify({friendId:Number(this.chatFriendId),content})});document.querySelector('#chat-input').value='';this.toast(r.ok?'已通过比特发送并写入本地会话':(r.reason||'发送失败'),!r.ok);this.refresh()}catch(e){this.toast(e.message,true)}},
  setChatScriptGroup(id){this.scriptGroupId=id||'';this.refresh()},
  useTemplate(content){if(this.dmTemplateEnabled===false){this.toast('设置中「启用私信话术」已关闭',true);return}const el=document.querySelector('#chat-input');if(!el||el.disabled){this.toast('请先登录客服并选择好友',true);return}el.value=content;el.focus()},
  async togglePinFriend(){if(!this.chatFriendId)return;try{const pack=await this.api(`/chat/messages?friendId=${this.chatFriendId}&pageSize=1`);const pinned=!pack.friend?.is_pinned;if(!(await this.ask(pinned?'置顶仅作用于本系统会话列表，不会同步到 TikTok 收件箱。继续？':'取消本系统置顶？')))return;await this.api(`/chat/friends/${this.chatFriendId}`,{method:'PATCH',body:JSON.stringify({isPinned:pinned})});this.toast(pinned?'已置顶（仅本地）':'已取消置顶');this.refresh()}catch(e){this.toast(e.message,true)}},
  async blockFriend(){if(!this.chatFriendId)return;const pack=await this.api(`/chat/messages?friendId=${this.chatFriendId}&pageSize=1`);const blocked=pack.friend?.relation==='blocked';if(blocked){if(!(await this.ask('取消本系统拉黑标记？（不会操作 TikTok 拉黑状态）')))return;try{await this.api(`/chat/friends/${this.chatFriendId}`,{method:'PATCH',body:JSON.stringify({relation:'stranger'})});this.toast('已取消拉黑（仅本地）');this.refresh()}catch(e){this.toast(e.message,true)}return}if(!(await this.ask('拉黑仅更新本系统会话：之后不能再发本地消息，也不会调用 TikTok 拉黑接口。继续？')))return;try{await this.api(`/chat/friends/${this.chatFriendId}`,{method:'PATCH',body:JSON.stringify({relation:'blocked'})});this.toast('已拉黑（仅本地）');this.refresh()}catch(e){this.toast(e.message,true)}},
  async writeLocalTestInbound(){if(!this.chatFriendId)return;if(!(await this.ask('只会写入本系统本地入站消息，用于测试 AI 回复，不会从 TikTok 拉取。继续？')))return;const content=prompt('测试消息内容');if(!content)return;try{await this.api('/chat/messages/simulate-in',{method:'POST',body:JSON.stringify({friendId:Number(this.chatFriendId),content})});this.toast('已写入本地测试消息');this.refresh()}catch(e){this.toast(e.message,true)}},
  async simulateInbound(){return this.writeLocalTestInbound()},
  async bindAiHosting(){
    if(!this.chatAccountId){this.toast('请先选择账号',true);return}
    const account=(await this.api('/chat/accounts')).items.find(a=>Number(a.id)===Number(this.chatAccountId));
    if(!account){this.toast('账号不存在',true);return}
    if(account.connection_status!=='online'){this.toast('请先登录客服聊天',true);return}
    if(account.ai_hosting){
      try{await this.api(`/chat/accounts/${this.chatAccountId}/ai-hosting`,{method:'POST',body:JSON.stringify({enabled:false})});this.toast('已关闭 AI 托管');this.refresh()}catch(e){this.toast(e.message,true)}
      return;
    }
    const agents=(await this.api('/agents')).filter(a=>a.enabled);
    if(!agents.length){this.toast('请先在 AI 机器人页创建并启用智能体',true);return}
    this.modal('开启 AI 托管',`<div class="form-grid">${this.select('agentId','绑定智能体',agents,account.agent_id||agents[0].id)}${this.selectRaw('autoTranslate','收信自动翻译',[['false','关闭'],['true','开启']],account.auto_translate?'true':'false')}<div class="field full"><div class="muted">托管后，对本系统收到的本地消息（含「写入本地测试消息」）由智能体自动回复到本地会话。不会伪造 TikTok 平台投递成功。</div></div></div>`,async d=>{
      await this.api(`/chat/accounts/${this.chatAccountId}/ai-hosting`,{method:'POST',body:JSON.stringify({enabled:true,agentId:Number(d.agentId),autoTranslate:d.autoTranslate==='true'})});
      this.toast('已开启 AI 托管');this.closeModal();this.refresh();
    });
  },
  async editFriendTags(){if(!this.chatFriendId)return;const [pack,customTags]=await Promise.all([this.api(`/chat/messages?friendId=${this.chatFriendId}&pageSize=1`),this.api('/chat/tags')]);const current=new Set(pack.friend?.tags||[]);const chips=(customTags||[]).map(t=>`<label class="chip"><input type="checkbox" class="friend-tag-check" data-tag="${this.esc(t.name)}" ${current.has(t.name)?'checked':''}> ${this.esc(t.name)}</label>`).join('');this.modal('好友标签',`<div class="form-grid"><div class="field full"><label>预设标签</label><div class="chip-row">${chips||'<span class="muted">暂无预设，可先点左侧「管理」添加</span>'}</div></div>${this.field('tags','额外标签，逗号分隔',[...current].filter(t=>!(customTags||[]).some(c=>c.name===t)).join(','))}<div class="field full"><div class="muted">保存后出现在左侧，可按标签筛选。这是本地标签。</div></div></div>`,async d=>{const picked=[...document.querySelectorAll('.friend-tag-check:checked')].map(el=>el.getAttribute('data-tag')).filter(Boolean);const extra=String(d.tags||'').split(/[,，]/).map(x=>x.trim()).filter(Boolean);const tags=[...new Set([...picked,...extra])];await this.api(`/chat/friends/${this.chatFriendId}`,{method:'PATCH',body:JSON.stringify({tags})});this.toast('标签已保存');this.closeModal();this.refresh()});},
  async manageChatTags(){if(!this.canPermission('chat.manage')&&!this.canPermission('chat.send')){this.toast('当前角色无权管理标签',true);return}const tags=await this.api('/chat/tags');this.modal('管理自定义标签',`<div class="form-grid">${this.field('name','新标签名称')}${this.field('color','颜色（可选）','')}<div class="field full"><div class="action-bar"><button class="primary tiny" type="button" onclick="app.addChatTagFromModal()">添加标签</button></div></div><div class="field full"><div class="muted">标签供好友筛选使用，删除时会从好友上移除该标签名。也可只删除下方已有标签。</div></div><div class="field full">${(tags||[]).length?`<table><thead><tr><th>名称</th><th></th></tr></thead><tbody>${tags.map(t=>`<tr><td>${this.esc(t.name)}</td><td><button class="tiny danger" type="button" onclick="app.deleteChatTag(${t.id})">删除</button></td></tr>`).join('')}</tbody></table>`:'<div class="shell-note">还没有自定义标签</div>'}</div></div>`,async()=>{},false,{hideSubmit:true});},async addChatTagFromModal(){const name=document.querySelector('#modal-form [name=name]')?.value?.trim();const color=document.querySelector('#modal-form [name=color]')?.value?.trim()||'';if(!name){this.toast('请填写标签名称',true);return}try{await this.api('/chat/tags',{method:'POST',body:JSON.stringify({name,color})});this.toast('标签已添加');this.closeModal();this.refresh()}catch(e){this.toast(e.message,true)}},
  async deleteChatTag(id){if(!(await this.ask('删除该标签？好友上的同名标签也会去掉。')))return;try{await this.api('/chat/tags/'+id,{method:'DELETE'});this.toast('标签已删除');this.closeModal();this.refresh()}catch(e){this.toast(e.message,true)}},
  openChatEmoji(){const input=document.querySelector('#chat-input');if(!input||input.disabled){this.toast('请先登录客服并选择好友',true);return}const emojis=(this.meta?.chatEmojis&&this.meta.chatEmojis.length)?this.meta.chatEmojis:['😀','😂','❤️','👍','🙏','🔥','🎉','😭','😍','🤝','✨','😎'];this.modal('插入表情',`<div class="chip-row">${emojis.map(e=>`<button type="button" class="tiny" onclick="app.insertChatText('${e}')">${e}</button>`).join('')}</div>`,async()=>{});document.querySelector('#modal-form button[type=submit]')?.remove()},
  insertChatText(text){const input=document.querySelector('#chat-input');if(!input||input.disabled){this.toast('请先登录客服并选择好友',true);return}input.value=(input.value||'')+text;input.focus();this.closeModal()},
  async sendChatImage(input){const file=input?.files?.[0];if(input)input.value='';if(!file)return;if(!this.canPermission('chat.send')){this.toast('当前角色无发送权限',true);return}if(!this.chatFriendId){this.toast('请选择好友',true);return}if(!this.chatAccountId){this.toast('请先选择客服账号',true);return}try{const fd=new FormData();fd.append('files',file);const uploaded=await this.api('/uploads/images',{method:'POST',body:fd});const url=uploaded.items?.[0]?.url;if(!url)throw new Error('上传没有返回地址');await this.api('/chat/messages',{method:'POST',body:JSON.stringify({friendId:Number(this.chatFriendId),content:url,msgType:'image'})});this.toast('图片已写入会话');this.refresh()}catch(e){this.toast(e.message,true)}},
  async batchChatDisconnectSelected(){const ids=this.selectedAccountIds();if(!ids.length){this.toast('请先勾选账号',true);return}if(!(await this.ask(`确定退出选中的 ${ids.length} 个客服连接？`)))return;try{const r=await this.api('/chat/accounts/batch-disconnect',{method:'POST',body:JSON.stringify({accountIds:ids})});this.toast(`已退出 ${r.closed??ids.length} 个客服`);this.refresh()}catch(e){this.toast(e.message,true)}},
  async batchSyncMessages(enable){const ids=this.selectedAccountIds();if(!ids.length){this.toast('请先勾选账号',true);return}if(!(await this.ask(enable?'仅开启本系统「同步标记」，不会从 TikTok 拉取私信。继续？':'取消本系统同步标记？')))return;try{const r=await this.api('/chat/accounts/batch-sync',{method:'POST',body:JSON.stringify({accountIds:ids,syncMessages:!!enable})});this.toast(enable?`已开启同步标记 ${r.updated}`:`已取消同步标记 ${r.updated}`);this.refresh()}catch(e){this.toast(e.message,true)}},
  async dedupeUids(){if(!this.uidGroupId){this.toast('请选择分组',true);return}if(!(await this.ask('将删除本组重复 UID，只保留最早一条。继续？')))return;try{const r=await this.api('/uids/dedupe',{method:'POST',body:JSON.stringify({groupId:Number(this.uidGroupId)})});this.toast(r.removed?`已去掉 ${r.removed} 条重复`:'没有重复 UID',!r.removed);this.refresh()}catch(e){this.toast(e.message,true)}},
  async deleteUidRow(id,uid){if(!(this.canPermission('chat.manage')||this.canPermission('publish.mass'))){this.toast('当前角色无权删除 UID',true);return}if(!(await this.ask(`删除 UID「${uid||id}」？`)))return;try{await this.api('/uids/'+id,{method:'DELETE'});this.toast('已删除');this.refresh()}catch(e){this.toast(e.message,true)}},
  editUidGroup(id){if(!this.canPermission('group.manage')){this.toast('当前角色无权管理分组',true);return}const g=(this.uidGroups||[]).find(x=>Number(x.id)===Number(id));if(!g){this.toast('分组不存在，请刷新',true);return}this.groupModal('uid',g)},

  async renderGroups(){
    await this.loadRefs();
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

  async renderHelpDocs(){
    const host=document.querySelector('#content');
    if(!host)return;
    if(!this.canPermission('system.help')&&!this.canPermission('system.view')&&!this.canPermission('rbac.manage')){
      host.innerHTML=`<div class="panel"><div class="empty">当前角色无权管理帮助文档</div></div>`;
      return;
    }
    const tab=this.helpDocsTab||'docs';
    try{
      const cats=await this.api('/help-categories');
      const catList=Array.isArray(cats)?cats:[];
      if(tab==='cats'){
        const kw=(this.helpCatKeyword||'').trim().toLowerCase();
        const filtered=catList.filter(c=>{
          if(!kw)return true;
          return String(c.name||'').toLowerCase().includes(kw)||String(c.slug||'').toLowerCase().includes(kw);
        });
        const pack=UI.paginateLocal(filtered,this.helpCatPage||1,20);
        this.helpCatPage=pack.page;
        host.innerHTML=`
          <div class="panel list-panel">
            <div class="matrix-action-bar">
              <div class="left"><span class="muted">共 ${filtered.length} / ${catList.length} 个帮助分类</span></div>
              <div class="right">
                <button class="ghost tiny" type="button" onclick="app.helpDocsTab='docs';app.refresh()">文档列表</button>
                <button class="primary tiny" type="button" onclick="app.editHelpCategoryModal()">新建分类</button>
              </div>
            </div>
            <div class="search-bar task-filter-bar">
              <input id="help-cat-search" class="input" type="search" placeholder="搜索分类名称 / Slug" value="${this.esc(this.helpCatKeyword||'')}" onkeydown="if(event.key==='Enter')app.searchHelpCats()">
              <button class="primary" type="button" onclick="app.searchHelpCats()">查询</button>
              <button class="ghost" type="button" onclick="app.resetHelpCats()">重置</button>
            </div>
            <div class="table-container">
              <table>
                <thead><tr><th>ID</th><th>名称</th><th>Slug</th><th>排序</th><th>可见</th><th>操作</th></tr></thead>
                <tbody>
                  ${pack.items.length?pack.items.map(c=>`
                    <tr>
                      <td><b>#${c.id}</b></td>
                      <td><b>${this.esc(c.name)}</b></td>
                      <td class="muted">${this.esc(c.slug||'-')}</td>
                      <td>${c.sortOrder??c.sort_order??0}</td>
                      <td>${c.visible?'显示':'隐藏'}</td>
                      <td style="white-space:nowrap">
                        <button class="tiny" onclick='app.editHelpCategoryModal(${JSON.stringify(c)})'>编辑</button>
                        <button class="tiny danger" onclick="app.deleteHelpCategory(${c.id},'${this.esc(c.name)}')">删除</button>
                      </td>
                    </tr>`).join(''):`<tr><td colspan="6"><div class="empty">暂无分类</div></td></tr>`}
                </tbody>
              </table>
            </div>
            ${UI.pager(pack,'helpCatPage')}
          </div>`;
        return;
      }
      const q=this.helpDocsCatId?`?category_id=${encodeURIComponent(this.helpDocsCatId)}`:'';
      const docs=await this.api('/help-documents'+q);
      const list=Array.isArray(docs)?docs:[];
      const kw=(this.helpDocKeyword||'').trim().toLowerCase();
      const st=String(this.helpDocStatus||'');
      const filtered=list.filter(d=>{
        if(st && String(d.status||'')!==st)return false;
        if(kw && !String(d.title||'').toLowerCase().includes(kw) && !String(d.summary||'').toLowerCase().includes(kw) && !String(d.categoryName||'').toLowerCase().includes(kw))return false;
        return true;
      });
      const pack=UI.paginateLocal(filtered,this.helpDocPage||1,20);
      this.helpDocPage=pack.page;
      host.innerHTML=`
        <div class="panel list-panel">
          <div class="matrix-action-bar">
            <div class="left"><span class="muted">共 ${filtered.length} / ${list.length} 篇文档 · 发布后客户端可查看</span></div>
            <div class="right">
              <button class="ghost tiny" type="button" onclick="app.helpDocsTab='cats';app.refresh()">管理分类</button>
              <button class="primary tiny" type="button" onclick="app.editHelpDocumentModal()">新建文档</button>
            </div>
          </div>
          <div class="search-bar task-filter-bar">
            <select id="help-doc-cat" class="input" title="分类">
              <option value="">全部分类</option>
              ${catList.map(c=>`<option value="${c.id}" ${String(this.helpDocsCatId)===String(c.id)?'selected':''}>${this.esc(c.name)}</option>`).join('')}
            </select>
            <select id="help-doc-status" class="input" title="状态">
              <option value="">全部状态</option>
              <option value="draft" ${st==='draft'?'selected':''}>草稿</option>
              <option value="published" ${st==='published'?'selected':''}>已发布</option>
            </select>
            <input id="help-doc-search" class="input" type="search" placeholder="搜索标题 / 摘要" value="${this.esc(this.helpDocKeyword||'')}" onkeydown="if(event.key==='Enter')app.searchHelpDocs()">
            <button class="primary" type="button" onclick="app.searchHelpDocs()">查询</button>
            <button class="ghost" type="button" onclick="app.resetHelpDocs()">重置</button>
          </div>
          <div class="table-container">
            <table>
              <thead><tr><th>ID</th><th>标题</th><th>分类</th><th>状态</th><th>排序</th><th>阅读</th><th>更新</th><th>操作</th></tr></thead>
              <tbody>
                ${pack.items.length?pack.items.map(d=>`
                  <tr>
                    <td><b>#${d.id}</b></td>
                    <td><b>${this.esc(d.title)}</b><div class="muted" style="font-size:12px">${this.esc((d.summary||'').slice(0,60))}</div></td>
                    <td>${this.esc(d.categoryName||'-')}</td>
                    <td>${this.badge(d.status==='published'?'online':'checking')} <span class="muted">${this.esc(d.status)}</span></td>
                    <td>${d.sortOrder??0}</td>
                    <td>${d.viewCount??0}</td>
                    <td class="muted">${this.esc(d.updatedAt||'-')}</td>
                    <td style="white-space:nowrap">
                      <button class="tiny" onclick="app.editHelpDocumentModalById(${d.id})">编辑</button>
                      <button class="tiny danger" onclick="app.deleteHelpDocument(${d.id},'${this.esc(d.title)}')">删除</button>
                    </td>
                  </tr>`).join(''):`<tr><td colspan="8"><div class="empty">暂无文档</div></td></tr>`}
              </tbody>
            </table>
          </div>
          ${UI.pager(pack,'helpDocPage')}
        </div>`;
    }catch(err){
      host.innerHTML=`<div class="panel list-panel"><div class="empty">加载失败: ${this.esc(err.message)}</div></div>`;
    }
  },
  searchHelpDocs(){
    this.helpDocsCatId=document.querySelector('#help-doc-cat')?.value||'';
    this.helpDocStatus=document.querySelector('#help-doc-status')?.value||'';
    this.helpDocKeyword=document.querySelector('#help-doc-search')?.value?.trim()||'';
    this.helpDocPage=1;
    this.refresh();
  },
  resetHelpDocs(){
    this.helpDocsCatId='';
    this.helpDocStatus='';
    this.helpDocKeyword='';
    this.helpDocPage=1;
    this.refresh();
  },
  searchHelpCats(){
    this.helpCatKeyword=document.querySelector('#help-cat-search')?.value?.trim()||'';
    this.helpCatPage=1;
    this.refresh();
  },
  resetHelpCats(){
    this.helpCatKeyword='';
    this.helpCatPage=1;
    this.refresh();
  },
  editHelpCategoryModal(c={}){
    this.modal(c.id?'编辑分类':'新建分类',`
      <div class="form-grid">
        <input type="hidden" name="id" value="${c.id||''}">
        ${this.field('name','分类名称',c.name||'','text',true)}
        ${this.field('slug','Slug',c.slug||'')}
        ${this.field('sortOrder','排序',c.sortOrder??c.sort_order??0,'number')}
        ${this.selectRaw('visible','是否可见',[['1','显示'],['0','隐藏']],c.visible===false||c.visible===0?'0':'1')}
      </div>
    `,async(d)=>{
      const id=d.id; delete d.id;
      d.sortOrder=Number(d.sortOrder||0);
      d.visible=d.visible==='1'||d.visible===1||d.visible===true;
      if(id) await this.api(`/help-categories/${id}`,{method:'PUT',body:JSON.stringify(d)});
      else await this.api('/help-categories',{method:'POST',body:JSON.stringify(d)});
      this.toast('分类已保存');
      this.closeModal();
      this.refresh();
    });
  },
  async deleteHelpCategory(id,name){
    if(!(await this.ask(`确定删除分类「${name}」吗？分类下有文档时无法删除。`,'danger')))return;
    try{
      await this.api(`/help-categories/${id}`,{method:'DELETE'});
      this.toast('分类已删除');
      this.refresh();
    }catch(e){this.toast(e.message,true);}
  },
  editHelpDocumentModal(d={}){
    const run=async()=>{
      let cats=[];
      try{cats=await this.api('/help-categories')||[];}catch{}
      const catPairs=(Array.isArray(cats)?cats:[]).map(c=>[String(c.id),c.name]);
      this.modal(d.id?'编辑文档':'新建文档',`
        <div class="form-grid">
          <input type="hidden" name="id" value="${d.id||''}">
          ${this.field('title','标题',d.title||'','text',true)}
          ${this.selectRaw('categoryId','分类',[['0','未分类'],...catPairs],String(d.categoryId||d.category_id||0))}
          ${this.field('summary','摘要',d.summary||'','textarea')}
          ${this.field('content','正文 (支持 Markdown)',d.content||'','textarea')}
          ${this.selectRaw('status','状态',[['draft','草稿'],['published','已发布']],d.status||'draft')}
          ${this.field('sortOrder','排序',d.sortOrder??0,'number')}
        </div>
      `,async(form)=>{
        const id=form.id; delete form.id;
        form.categoryId=Number(form.categoryId||0);
        form.sortOrder=Number(form.sortOrder||0);
        if(id) await this.api(`/help-documents/${id}`,{method:'PUT',body:JSON.stringify(form)});
        else await this.api('/help-documents',{method:'POST',body:JSON.stringify(form)});
        this.toast('文档已保存');
        this.closeModal();
        this.refresh();
      });
    };
    run();
  },
  async editHelpDocumentModalById(id){
    try{
      const rows=await this.api('/help-documents');
      const d=(Array.isArray(rows)?rows:[]).find(x=>Number(x.id)===Number(id));
      if(!d){this.toast('文档不存在',true);return;}
      this.editHelpDocumentModal(d);
    }catch(e){this.toast(e.message,true);}
  },
  async deleteHelpDocument(id,title){
    if(!(await this.ask(`确定删除文档「${title}」吗？`,'danger')))return;
    try{
      await this.api(`/help-documents/${id}`,{method:'DELETE'});
      this.toast('文档已删除');
      this.refresh();
    }catch(e){this.toast(e.message,true);}
  },

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

  toggleProxyBatchMenu(e){
    e?.stopPropagation?.();
    this.toggleToolbarDropdown('#proxy-batch-menu', e);
  },
  async renderProxies(){
    document.querySelector('#content').classList.remove('chat-mode');
    if(this.proxyPane==='io'){await this.renderProxyIo();return}
    await this.loadRefs();
    const gs=this.groups.filter(g=>g.type==='proxy');
    const kw=encodeURIComponent(this.proxyKeyword||'');
    const st=encodeURIComponent(this.proxyStatus||'');
    const d=await this.api(`/proxies?page=${this.proxyPage||1}&pageSize=20&keyword=${kw}&status=${st}${this.proxyGroupId?`&groupId=${encodeURIComponent(this.proxyGroupId)}`:''}`);
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
            <button class="info" onclick="app.resetProxyFilters()">重置</button>
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
  batchMoveProxies(){const ids=this.selectedProxyIds();if(!ids.length){this.toast('请先选择要转移的代理',true);return}const gs=this.groups.filter(g=>g.type==='proxy');this.modal('批量转移代理分组',`<div class="form-grid">${this.select('groupId','目标代理分组',gs)}<div class="field full"><div class="muted">已选择 ${ids.length} 个代理。目标分组留空表示移出分组。</div></div></div>`,async d=>{await this.api('/proxies/batch-move',{method:'POST',body:JSON.stringify({proxyIds:ids,groupId:d.groupId?Number(d.groupId):null})});this.toast(`已转移 ${ids.length} 个代理`);this.closeModal();await this.loadRefs();this.refresh()})},
  async batchDeleteProxies(){const ids=this.selectedProxyIds();if(!ids.length){this.toast('请先选择要删除的代理',true);return}if(!(await this.ask(`确定删除选中的 ${ids.length} 个代理吗？绑定这些代理的账号将自动变为未绑定代理。`)))return;try{const r=await this.api('/proxies/batch-delete',{method:'POST',body:JSON.stringify({proxyIds:ids})});this.toast(`已删除 ${r.deleted} 个代理，解除 ${r.unboundAccounts} 个账号的代理绑定`);await this.loadRefs();this.refresh()}catch(e){this.toast(e.message,true)}},
  openProxyIo(tab){
    if(!this.canPermission('proxy.create')&&tab==='import'){this.toast('当前角色无权导入代理',true);return}
    this.view='proxies';
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
  async renderProxyIo(){
    const tab=this.proxyIoTab||'export';
    if(!Array.isArray(this.proxyIoFields)||!this.proxyIoFields.length)this.proxyIoFields=this.defaultProxyIoFields();
    const f=this.proxyIoFilter||{};
    await this.loadRefs();
    const gs=this.groups.filter(g=>g.type==='proxy');
    document.querySelector('#content').innerHTML=`<div class="panel task-io-panel proxy-io-panel">
      <div class="task-io-head">
        <button class="ghost" type="button" onclick="app.closeProxyIo()">← 返回代理列表</button>
        <div class="task-io-title-row">
          <b class="task-io-title">导入导出</b>
          <span class="muted">导出可自定义字段与表头；导入支持 CSV 模板或文本行格式</span>
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
    f=f||{};
    gs=gs||[];
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
        <button class="primary" type="button" onclick="app.submitProxyIoExport()">导出 CSV</button>
        <button class="ghost" type="button" onclick="app.resetProxyIoExport()">重置筛选与字段</button>
      </div>
    </div>`;
  },
  proxyIoImportBody(gs){
    gs=gs||[];
    const mode=this.proxyIoImportMode||'csv';
    return `<div class="task-io-import">
      <div class="search-bar" style="margin-bottom:14px">
        <button type="button" class="${mode==='csv'?'primary':'ghost'}" onclick="app.proxyIoImportMode='csv';app.refresh()">CSV 模板导入</button>
        <button type="button" class="${mode==='lines'?'primary':'ghost'}" onclick="app.proxyIoImportMode='lines';app.refresh()">文本行导入</button>
      </div>
      ${mode==='lines'?this.proxyIoImportLinesBody(gs):this.proxyIoImportCsvBody(gs)}
    </div>`;
  },
  proxyIoImportCsvBody(gs){
    gs=gs||[];
    return `<div class="shell-note" style="margin:0 0 14px">
        <b>CSV 模板说明：</b>使用下方模板表头；每行一条代理。<br>
        列：<code>protocol,host,port,username,password,name,country,group_name</code>；也可增加 <code>proxy_string</code> 列（host:port:user:pass）。
      </div>
      <div class="action-bar" style="margin-bottom:12px">
        <button class="primary" type="button" onclick="app.downloadProxyImportTemplate()">下载导入模板</button>
        <label class="ghost" style="display:inline-flex;align-items:center;padding:8px 14px;cursor:pointer;border:1px solid #dcdfe6;border-radius:4px">选择 CSV 文件<input type="file" accept=".csv,text/csv,text/plain" hidden onchange="app.loadProxyImportFile(this)"></label>
      </div>
      <div class="form-grid">
        <div class="field"><label>默认协议（行未填时）</label><select id="pio-import-protocol" class="input"><option value="http">HTTP</option><option value="https">HTTPS</option><option value="socks5">SOCKS5</option></select></div>
        <div class="field"><label>默认分组（行未填时）</label><select id="pio-import-group" class="input"><option value="">不指定</option>${gs.map(g=>`<option value="${g.id}">${this.esc(g.name)}</option>`).join('')}</select></div>
        <div class="field"><label>默认国家</label><input id="pio-import-country" class="input" placeholder="可空"></div>
        <div class="field full"><label>CSV 内容</label><textarea id="pio-import-content" class="input" rows="12" placeholder="粘贴 CSV，或选择文件自动填入"></textarea></div>
      </div>
      <div class="action-bar" style="margin-top:14px">
        <button class="primary" type="button" onclick="app.submitProxyIoImport()">开始导入</button>
      </div>
      <div id="pio-import-result" class="muted" style="margin-top:12px"></div>`;
  },
  proxyIoImportLinesBody(gs){
    gs=gs||[];
    return `<div class="shell-note" style="margin:0 0 14px">
        兼容原「批量导入」格式：每行一个代理，支持 host:port、host:port:user:pass、user:pass@host:port、带协议 URL；空行与 # 注释忽略。
      </div>
      <div class="form-grid">
        <div class="field"><label>默认协议</label><select id="pio-lines-protocol" class="input"><option value="http">HTTP</option><option value="https">HTTPS</option><option value="socks5">SOCKS5</option></select></div>
        <div class="field"><label>代理分组</label><select id="pio-lines-group" class="input"><option value="">不指定</option>${gs.map(g=>`<option value="${g.id}">${this.esc(g.name)}</option>`).join('')}</select></div>
        <div class="field"><label>国家/地区</label><input id="pio-lines-country" class="input" placeholder="可空"></div>
        <div class="field full"><label>代理列表</label><textarea id="pio-lines-content" class="input" rows="12" placeholder="每行一个代理"></textarea></div>
      </div>
      <div class="action-bar" style="margin-top:14px">
        <button class="primary" type="button" onclick="app.submitProxyLinesImport()">开始导入</button>
      </div>
      <div id="pio-lines-result" class="muted" style="margin-top:12px"></div>`;
  },
  collectProxyIoExportForm(){
    const fields=(this.proxyIoFields||[]).map((x,i)=>{
      const on=!!document.querySelector(`.pio-field-on[data-idx="${i}"]`)?.checked;
      const label=document.querySelector(`.pio-field-label[data-idx="${i}"]`)?.value ?? x.label;
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
    const q=new URLSearchParams();
    if(filter.keyword)q.set('keyword',filter.keyword);
    if(filter.status)q.set('status',filter.status);
    if(filter.protocol)q.set('protocol',filter.protocol);
    if(filter.groupId)q.set('groupId',filter.groupId);
    if(filter.country)q.set('country',filter.country);
    if(filter.idMin)q.set('idMin',filter.idMin);
    if(filter.idMax)q.set('idMax',filter.idMax);
    if(filter.selectedOnly){
      const ids=this.selectedProxyIds?.()||[];
      if(!ids.length){this.toast('请先在代理列表勾选要导出的代理',true);return}
      q.set('ids',ids.join(','));
    }
    q.set('fields',selected.map(x=>x.key).join(','));
    q.set('headers',JSON.stringify(Object.fromEntries(selected.map(x=>[x.key,x.label]))));
    try{
      const headers=this.authToken?{Authorization:'Bearer '+this.authToken}:{};
      const acting=this.getActingAsId();if(acting)headers['X-Acting-As']=String(acting);
      const base=window.TKSWARM_API_BASE||window.__TKSWARM_CONFIG__?.defaultApiBase||'';
      const r=await fetch(base+'/api/proxies/export.csv?'+q.toString(),{headers});
      if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.message||'导出失败')}
      const text=await r.text();
      const lines=String(text||'').split(/\r?\n/).filter(Boolean);
      if(lines.length<=1){this.toast('没有可导出的代理',true);return}
      const blob=new Blob([text],{type:'text/csv;charset=utf-8'});
      const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='proxies-export.csv';a.click();URL.revokeObjectURL(url);
      this.toast('代理已导出');
    }catch(e){this.toast(e.message,true)}
  },
  async downloadProxyImportTemplate(){
    try{
      const headers={};if(this.authToken)headers.Authorization='Bearer '+this.authToken;
      const acting=this.getActingAsId();if(acting)headers['X-Acting-As']=String(acting);
      const base=window.TKSWARM_API_BASE||window.__TKSWARM_CONFIG__?.defaultApiBase||'';
      const r=await fetch(base+'/api/proxies/import-template.csv',{headers});
      if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.message||'下载失败')}
      const text=await r.text();
      if(!String(text||'').trim()){this.toast('模板为空',true);return}
      const blob=new Blob([text],{type:'text/csv;charset=utf-8'});
      const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='proxy-import-template.csv';a.click();URL.revokeObjectURL(url);
      this.toast('模板已下载');
    }catch(e){this.toast(e.message,true)}
  },
  loadProxyImportFile(input){
    const file=input?.files?.[0];if(input)input.value='';
    if(!file)return;
    const reader=new FileReader();
    reader.onload=()=>{const box=document.querySelector('#pio-import-content');if(box)box.value=String(reader.result||'');this.toast(`已读入 ${file.name}`)};
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
        defaultProtocol:document.querySelector('#pio-import-protocol')?.value||'http',
        groupId:document.querySelector('#pio-import-group')?.value||null,
        country:document.querySelector('#pio-import-country')?.value||'',
      })});
      const box=document.querySelector('#pio-import-result');
      const errHtml=(r.errors||[]).length?`<div class="shell-note" style="margin-top:8px">${(r.errors||[]).slice(0,20).map(e=>this.esc(e)).join('<br>')}</div>`:'';
      if(box)box.innerHTML=`成功 <b>${r.imported||0}</b>，重复 <b>${r.duplicates||0}</b>，错误 <b>${(r.errors||[]).length}</b>${errHtml}`;
      this.toast(r.imported?`已导入 ${r.imported} 条代理`:'没有成功导入的行',!r.imported);
      await this.loadRefs();
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
        groupId:document.querySelector('#pio-lines-group')?.value||null,
        country:document.querySelector('#pio-lines-country')?.value||'',
      })});
      const box=document.querySelector('#pio-lines-result');
      let message=`成功 ${r.imported}，重复 ${r.duplicates}，错误 ${(r.errors||[]).length}`;
      if(r.errors?.length)message+=`；首个错误在第 ${r.errors[0].line} 行：${r.errors[0].reason}`;
      if(box)box.textContent=message;
      this.toast(r.imported?`已导入 ${r.imported} 条`:'没有成功导入',!r.imported);
      await this.loadRefs();
    }catch(e){this.toast(e.message,true)}
  },

  proxyModal(){const gs=this.groups.filter(g=>g.type==='proxy');this.modal('添加代理',`<div class="form-grid">${this.field('name','名称','新代理','text',true)}${this.selectRaw('protocol','协议',(this.meta?.proxyProtocols||[]).length?(this.meta.proxyProtocols.map(x=>[x.code,x.label])):[['http','HTTP'],['https','HTTPS'],['socks5','SOCKS5']],'http')}${this.field('host','主机','', 'text',true)}${this.field('port','端口','', 'number',true)}${this.field('username','用户名')}${this.field('password','密码','', 'password')}${this.field('country','国家/地区')}${this.select('groupId','代理分组',gs)}</div>`,async d=>{d.port=Number(d.port);d.groupId=d.groupId?Number(d.groupId):null;await this.api('/proxies',{method:'POST',body:JSON.stringify(d)});this.toast('代理已添加');this.closeModal();await this.loadRefs();this.refresh()})},
  editProxyAddress(id){if(!this.canPermission('proxy.create')){this.toast('当前角色无权修改代理',true);return}const row=this.proxies.find(p=>Number(p.id)===Number(id));if(!row){this.toast('代理不存在，请刷新',true);return}const cur=row.host+':'+row.port+(row.username?':'+row.username:'');this.modal('修改IP',`<div class="form-grid">${this.field('proxyString','代理地址',cur,'text',true)}<div class="field full"><div class="muted">格式：host:port 或 host:port:user:pass。不填密码则保留原密码。</div></div></div>`,async d=>{const raw=String(d.proxyString||'').trim();const parts=raw.split(':').map(x=>x.trim());if(parts.length<2)throw new Error('格式应为 host:port 或 host:port:user:pass');const host=parts[0];const port=Number(parts[1]);if(!host||!Number.isInteger(port)||port<1||port>65535)throw new Error('端口无效');const body={name:row.name,protocol:row.protocol,host,port,username:parts[2]||row.username||'',country:row.country||'',groupId:row.group_id||null};if(parts.length>=4)body.password=parts.slice(3).join(':');await this.api('/proxies/'+id,{method:'PUT',body:JSON.stringify(body)});this.toast('代理地址已更新');this.closeModal();await this.loadRefs();this.refresh()})},
  editProxyCountry(id,country=''){if(!this.canPermission('proxy.create')){this.toast('当前角色无权修改代理',true);return}this.modal('修改代理国家',`<div class="form-grid"><input type="hidden" name="id" value="${id}">${this.field('country','国家/地区',country||'')}<div class="field full"><div class="muted">账号列表的「国家」会关联显示此字段。也可在批量操作里「检测国家」自动写入。留空表示清除。</div></div></div>`,async d=>{const row=this.proxies.find(p=>Number(p.id)===Number(id));if(!row)throw new Error('代理不存在，请刷新');const body={name:row.name,protocol:row.protocol,host:row.host,port:row.port,username:row.username||'',country:d.country||'',groupId:row.group_id||null};await this.api('/proxies/'+id,{method:'PUT',body:JSON.stringify(body)});this.toast('代理国家已更新');this.closeModal();await this.loadRefs();this.refresh()})},
  editProxyModal(x={}){const gs=this.groups.filter(g=>g.type==='proxy');this.modal('编辑代理',`<div class="form-grid"><input type="hidden" name="id" value="${x.id||''}">${this.field('name','名称',x.name||'','text',true)}${this.selectRaw('protocol','协议',(this.meta?.proxyProtocols||[]).length?(this.meta.proxyProtocols.map(x=>[x.code,x.label])):[['http','HTTP'],['https','HTTPS'],['socks5','SOCKS5']],x.protocol||'http')}${this.field('host','主机',x.host||'','text',true)}${this.field('port','端口',x.port||'','number',true)}${this.field('username','用户名',x.username||'')}${this.field('password','密码（留空不改）','','password')}${this.field('country','国家/地区',x.country||'')}${this.select('groupId','代理分组',gs,x.group_id)}</div>`,async d=>{const id=d.id;delete d.id;d.port=Number(d.port);d.groupId=d.groupId?Number(d.groupId):null;if(!d.password)delete d.password;await this.api('/proxies/'+id,{method:'PUT',body:JSON.stringify(d)});this.toast('代理已更新');this.closeModal();await this.loadRefs();this.refresh()})},
  async copyProxy(id){
    try{
      const r=await this.api('/proxies/export-strings',{method:'POST',body:JSON.stringify({proxyIds:[Number(id)]})});
      const text=r.items?.[0]?.text||r.text||'';
      if(!text){this.toast('代理不存在',true);return}
      try{await navigator.clipboard.writeText(text);this.toast('代理地址已复制')}
      catch{this.toast(text)}
    }catch(e){this.toast(e.message,true)}
  },
  batchImportProxies(){return this.batchProxyModal()},batchProxyModal(){const gs=this.groups.filter(g=>g.type==='proxy');this.modal('批量导入代理',`<div class="form-grid">${this.selectRaw('defaultProtocol','默认协议',(this.meta?.proxyProtocols||[]).length?(this.meta.proxyProtocols.map(x=>[x.code,x.label])):[['http','HTTP'],['https','HTTPS'],['socks5','SOCKS5']],'http')}${this.select('groupId','代理分组',gs)}${this.field('country','国家/地区（可选）')}${this.field('content','代理列表','', 'textarea',true)}<div class="field full"><div class="muted">每行一个，支持：<br>host:port<br>host:port:username:password<br>username:password@host:port<br>http://username:password@host:port<br>也支持竖线或逗号分隔；空行和 # 开头的注释会忽略。</div></div></div>`,async d=>{d.groupId=d.groupId?Number(d.groupId):null;const r=await this.api('/proxies/batch-import',{method:'POST',body:JSON.stringify(d)});let message=`成功 ${r.imported}，重复 ${r.duplicates}，错误 ${r.errors.length}`;if(r.errors.length)message+=`；首个错误在第 ${r.errors[0].line} 行：${r.errors[0].reason}`;this.toast(message,Boolean(r.errors.length));this.closeModal();await this.loadRefs();this.refresh()})},
  async testProxy(id){this.toast('正在检测出口 IP...');const r=await this.api(`/proxies/${id}/test`,{method:'POST'});this.toast(r.available?`${r.detail||'可用'} · ${r.latencyMs||'-'} ms`:(r.detail||'连接失败'),!r.available);await this.loadRefs();this.refresh()},
  async batchTestProxies(){const ids=this.selectedProxyIds();this.toast('正在批量真实检测…');try{const r=await this.api('/proxies/batch-test',{method:'POST',body:JSON.stringify({proxyIds:ids})});this.toast(`可用 ${r.available}，不可用 ${r.unavailable}`);await this.loadRefs();this.refresh()}catch(e){this.toast(e.message,true)}},
  fetchProxyModal(){const gs=this.groups.filter(g=>g.type==='proxy');this.modal('获取代理IP',`<div class="form-grid">${this.select('groupId','写入分组',gs)}${this.field('country','国家代码（如 US）')}${this.field('region','州/省（可选）')}${this.field('city','城市（可选）')}${this.field('count','数量',5,'number')}${this.field('rotateMinutes','轮转分钟（0-120）',0,'number')}<div class="field full"><div class="muted">已配置「云代理 API」时从云端拉取；未配置则明确走本地可用池，不会假装成云端成功。</div></div></div>`,async d=>{d.groupId=d.groupId?Number(d.groupId):null;d.count=Number(d.count||5);d.rotateMinutes=Number(d.rotateMinutes||0);const r=await this.api('/proxies/fetch',{method:'POST',body:JSON.stringify(d)});const source=r.source==='cloud'?'云端':(r.source==='local-pool'?'本地代理池':r.source||'未知');this.toast(`来源：${source} · 已获取 ${r.count} 个`);this.closeModal();await this.loadRefs();this.refresh()})},

  advancedDeleteProxies(){this.modal('高级删除代理',`<div class="form-grid">${this.selectRaw('status','状态',[['','不限'],['unavailable','不可用'],['unchecked','未检测'],['available','可用']],'')}${this.field('country','国家，精确匹配')}${this.field('minUse','使用次数不少于','','number')}<div class="field full"><div class="muted">至少填一个条件。删除后，账号上的这条代理绑定会被清空。</div></div></div>`,async d=>{const body={};if(d.status)body.status=d.status;if(String(d.country||'').trim())body.country=String(d.country).trim();if(d.minUse)body.minUse=Number(d.minUse);const r=await this.api('/proxies/advanced-delete',{method:'POST',body:JSON.stringify(body)});this.toast(r.deleted?`已删除 ${r.deleted} 条`:`没有符合条件的代理可删`,!r.deleted);this.closeModal();await this.loadRefs();this.refresh()})},

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
          ${this.canPermission('publish.tasks')||this.canPermission('publish.mass')?`<div class="dropdown"><button class="primary" type="button" onclick="app.toggleCreatePublishMenu(event)">创建 <span class="btn-arrow-down">▾</span></button><div id="create-publish-menu" class="dropdown-menu align-left hidden">${this.canPermission('publish.tasks')?`<button type="button" onclick="app.openPublishWizard('random')">随机发布</button>`:''}${this.canPermission('publish.tasks')||this.canPermission('publish.mass')?`<button type="button" onclick="app.openPublishWizard('ordered')">群发任务</button>`:''}${this.canPermission('publish.tasks')?`<button type="button" onclick="app.openPublishWizard('independent')">独立发布</button>`:''}</div></div>`:''}
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
    this._matrixTabCache[t]={html,at:Date.now(),key:this.matrixCacheKey(t)};
    // 静默刷新只更新缓存，避免切换后二次整页重绘造成卡顿
    if(opts.soft&&body.children.length&&!body.querySelector('.matrix-loading-panel'))return body;
    body.innerHTML=html;
    if(window.UI)UI.decorate(body);
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
      if(window.UI)UI.decorate(body);
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
  massBody(step,m){if(step===1){const gs=this.groups.filter(g=>g.type==='account');return `<div class="form-grid">${this.select('groupId','账号分组（可选）',gs,m.groupId)}<div class="field full"><label>指定账号</label><div class="account-pick-toolbar"><input class="input account-pick-search" id="mass-accounts-search" type="search" placeholder="搜索账号 ID 或用户名" oninput="app.filterAccountPick('mass-accounts', this.value)"><span class="muted" id="mass-accounts-search-hint"></span><div class="action-bar" style="margin:0"><button type="button" class="tiny" onclick="app.massSelectAccounts(true)">全选</button><button type="button" class="tiny" onclick="app.massSelectAccounts(false)">清空</button><button type="button" class="tiny" onclick="app.massInvertAccounts()">反选</button></div></div><div id="mass-accounts" class="account-pick-grid"></div></div></div>`}if(step===2){const ugs=this.groups.filter(g=>g.type==='uid');return `<div class="form-grid">${this.selectRaw('sendTargetType','发送对象',this.massTargetPairs(),m.sendTargetType||'imported')}${this.select('uidGroupId','UID 分组（导入好友时）',ugs,m.uidGroupId)}${this.field('fixedTargets','固定对象（每行一个 UID）',m.fixedTargets||'','textarea')}<div class="field full"><div class="muted">选「粉丝/互关」前请先在客服台对该账号执行「刷新粉丝」，把 TikTok 粉丝列表写入本地好友。</div></div></div>`}if(step===3){const sgs=this.groups.filter(g=>g.type==='message');const dmOn=this.dmTemplateEnabled!==false;const tpls=dmOn?this.templates.filter(t=>(t.enabled!==0&&t.enabled!==false)&&(!m.scriptGroupId||String(t.group_id)===String(m.scriptGroupId))):[];return `<div class="form-grid">${dmOn?`<div class="field"><label>话术分类</label><select onchange="app.setMassScriptGroup(this.value)"><option value="">全部分类</option>${sgs.map(g=>`<option value="${g.id}" ${String(m.scriptGroupId)===String(g.id)?'selected':''}>${this.esc(g.name)}</option>`).join('')}</select></div>${this.select('templateId','话术模板（可选）',tpls,m.templateId)}`:'<div class="field full"><div class="shell-note">设置中「启用私信话术」已关闭，请直接填写发送内容。</div></div>'}${this.field('content','发送内容（多行则轮换，支持 {{username}}）',m.content||'','textarea')}</div>`}if(step===4)return `<div class="form-grid">${this.field('name','任务名称',m.name||'','text',true)}${this.field('sendInterval','发送间隔（毫秒）',m.sendInterval??800,'number')}${this.field('retryCount','失败重试次数',m.retryCount??1,'number')}${this.field('perAccountLimit','每账号发送上限',m.perAccountLimit??20,'number')}${this.field('scheduledAt','定时开始',m.scheduledAt||'','datetime-local')}</div>`;return `<div class="data-meta"><b>注意：</b>将通过比特浏览器打开环境，尝试真实发送 TikTok 私信。<br>通道：比特浏览器<br>对象：${this.esc(m.sendTargetType||'-')}<br>账号：${(m.accountIds||[]).length||'按分组/全部'}<br>内容：${this.esc((m.content||'').slice(0,80)||'使用话术')}<br>间隔 ${m.sendInterval} ms · 重试 ${m.retryCount} · 每账号 ${m.perAccountLimit}</div>`},
  accountPickTagHtml(a, selected){
    const id=Number(a.id);
    const on=selected.has(id);
    const uname=String(a.username||''); return `<div role="button" tabindex="0" class="account-pick-tag ${on?'is-on':''}" data-id="${id}" data-name="${this.esc(uname)}" onclick="app.toggleAccountPickTag(this)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();app.toggleAccountPickTag(this)}" title="#${id} ${this.esc(uname)}"><span class="apt-id">#${id}</span><span class="apt-name">${this.esc(uname)}</span></div>`;
  },
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
  filterAccountPick(boxId, keyword){const q=String(keyword||'').trim().toLowerCase();const box=document.querySelector('#'+boxId);if(!box)return;box.querySelector('.account-pick-empty')?.remove();let visible=0;box.querySelectorAll('.account-pick-tag').forEach(el=>{const id=String(el.getAttribute('data-id')||'');const name=String(el.getAttribute('data-name')||'').toLowerCase();const hit=!q||id.includes(q)||name.includes(q);el.classList.toggle('is-filtered-out', !hit);el.style.display='';if(hit)visible+=1;});if(!visible){const tip=document.createElement('div');tip.className='muted account-pick-empty';tip.style.cssText='padding:12px;grid-column:1/-1';tip.textContent=q?'没有匹配的账号':'暂无账号';box.appendChild(tip);}const hint=document.querySelector('#'+boxId+'-search-hint');if(hint)hint.textContent=q?`已筛选 ${visible} 个`:'';},
  selectedAccountPickIds(boxId){return [...document.querySelectorAll('#'+boxId+' .account-pick-tag.is-on')].map(el=>Number(el.getAttribute('data-id'))).filter(Boolean);},
  setAccountPickAll(boxId, all){document.querySelectorAll('#'+boxId+' .account-pick-tag').forEach(el=>{if(el.classList.contains('is-filtered-out'))return;el.classList.toggle('is-on', !!all);});},
  invertAccountPick(boxId){document.querySelectorAll('#'+boxId+' .account-pick-tag').forEach(el=>{if(el.classList.contains('is-filtered-out'))return;el.classList.toggle('is-on');});},
  async fillMassAccounts(){const box=document.querySelector('#mass-accounts');if(!box)return;const accounts=(await this.api('/accounts?pageSize=200')).items;const selected=new Set((this.mass.accountIds||[]).map(Number));box.innerHTML=accounts.length?accounts.map(a=>this.accountPickTagHtml(a,selected)).join(''):'<div class="muted account-pick-empty" style="padding:12px;grid-column:1/-1">暂无账号</div>';const kw=document.querySelector('#mass-accounts-search')?.value||'';if(kw)this.filterAccountPick('mass-accounts',kw);},
  massSelectAccounts(all){if(all)this.setAccountPickAll('mass-accounts',true);else document.querySelectorAll('#mass-accounts .account-pick-tag').forEach(el=>el.classList.remove('is-on'));},
  massInvertAccounts(){this.invertAccountPick('mass-accounts');},
  async fillWizardAccounts(){const box=document.querySelector('#wizard-accounts');if(!box)return;const accounts=(await this.api('/accounts?pageSize=200')).items;this._wizardAccountsCache=accounts||[];const selected=new Set((this.wizard.accountIds||[]).map(Number));box.innerHTML=accounts.length?accounts.map(a=>this.accountPickTagHtml(a,selected)).join(''):'<div class="muted account-pick-empty" style="padding:12px;grid-column:1/-1">暂无账号</div>';const kw=document.querySelector('#wizard-accounts-search')?.value||'';if(kw)this.filterAccountPick('wizard-accounts',kw);},
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
    this.modal('选择账号',`<div class="form-grid"><div class="field full"><div class="muted" style="margin-bottom:8px">已加入发布组合的账号不会出现。可多选；确认后与已选视频按顺序自动配对。</div><div class="account-pick-toolbar"><input class="input account-pick-search" id="pair-pick-accounts-search" type="search" placeholder="搜索账号 ID 或用户名" oninput="app.filterAccountPick('pair-pick-accounts', this.value)"><span class="muted" id="pair-pick-accounts-search-hint"></span><div class="action-bar" style="margin:0"><button type="button" class="tiny" onclick="app.setAccountPickAll('pair-pick-accounts',true)">全选</button><button type="button" class="tiny" onclick="app.setAccountPickAll('pair-pick-accounts',false)">清空</button></div></div><div id="pair-pick-accounts" class="account-pick-grid"><div class="muted account-pick-empty" style="padding:12px;grid-column:1/-1">加载中…</div></div></div></div>`,async()=>{
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
    return `<div class="form-grid">${groupField}<div class="field full"><label>${label}</label>${tip}<div class="account-pick-toolbar"><input class="input account-pick-search" id="wizard-accounts-search" type="search" placeholder="搜索账号 ID 或用户名" oninput="app.filterAccountPick('wizard-accounts', this.value)"><span class="muted" id="wizard-accounts-search-hint"></span><div class="action-bar" style="margin:0">${batchBtns}</div></div><div id="wizard-accounts" class="account-pick-grid"></div></div></div>`;
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
    this.massWizardOpen=false;
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

  async renderRbac(){
    document.querySelector('#content').classList.remove('chat-mode');
    const sub = this.subview || 'permissions';
    const note = `<div class="rbac-tip" role="note"><b>权限说明：</b>开启鉴权后，顶栏菜单会按角色裁剪；删除账号、导入、任务写入、RBAC 管理等敏感接口会校验权限码。关闭鉴权时全部放行。</div>`;
    if (sub === 'permissions') { await this.renderRbacPermissions(); document.querySelector('#content')?.insertAdjacentHTML('afterbegin', note); }
    else if (sub === 'roles') { await this.renderRbacRoles(); document.querySelector('#content')?.insertAdjacentHTML('afterbegin', note); }
    else if (sub === 'users') { await this.renderRbacUsers(); document.querySelector('#content')?.insertAdjacentHTML('afterbegin', note); }
    else if (sub === 'logs') { await this.renderRbacLogs(); document.querySelector('#content')?.insertAdjacentHTML('afterbegin', note); }
    else if (sub === 'menus') { await this.renderRbacMenus(); document.querySelector('#content')?.insertAdjacentHTML('afterbegin', note); }
    else if (sub === 'settings') await this.renderSettings();
  },
  async renderRbacPermissions(){
    const host = document.querySelector('#content');
    if (!host) return;
    try {
      const allRows = await this.api('/permissions');
      const curMod = this.rbacPermModuleFilter || 'all';
      const kw = (this.rbacPermKeyword || '').trim().toLowerCase();

      const modPairs=this.permModulePairs();
      const modules = ['all', ...modPairs.map(x=>x[0])];
      const modLabels = Object.fromEntries([['all','全部模块'], ...modPairs]);

      const rows = allRows.filter(r => {
        if (curMod !== 'all' && r.module !== curMod) return false;
        if (kw && !String(r.name).toLowerCase().includes(kw) && !String(r.code).toLowerCase().includes(kw)) return false;
        return true;
      });
      const pack = UI.paginateLocal(rows, this.rbacPermPage || 1, 20);
      this.rbacPermPage = pack.page;

      host.innerHTML = `
        <div class="panel list-panel">
          <div class="matrix-action-bar">
            <div class="left"><span class="muted">共 ${rows.length} / ${allRows.length} 个鉴权节点</span></div>
            <div class="right">
              <button class="primary tiny" type="button" onclick="app.editPermissionModal()">添加权限节点</button>
            </div>
          </div>
          <div class="search-bar task-filter-bar rbac-perm-filter-bar">
            <select id="rbac-perm-module" class="input" title="业务模块" onchange="app.filterRbacPermModule(this.value)">
              ${modules.map(m => {
                const cnt = m === 'all' ? allRows.length : allRows.filter(x => x.module === m).length;
                return `<option value="${this.esc(m)}" ${curMod===m?'selected':''}>${this.esc(modLabels[m]||m)} (${cnt})</option>`;
              }).join('')}
            </select>
            <input id="rbac-perm-search" class="input" type="search" placeholder="搜索节点名称或 Code" value="${this.esc(this.rbacPermKeyword||'')}" onkeydown="if(event.key==='Enter')app.searchRbacPermissions()">
            <button class="primary" type="button" onclick="app.searchRbacPermissions()">查询</button>
            <button class="ghost" type="button" onclick="app.resetRbacPermissions()">重置</button>
          </div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>所属业务模块</th>
                  <th>权限标识符 (Code)</th>
                  <th>权限节点名称</th>
                  <th>排序权重</th>
                  <th>当前状态</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                ${pack.items.length ? pack.items.map(r => `
                  <tr>
                    <td><b>#${r.id}</b></td>
                    <td><span class="badge ${r.module==='account'?'online':r.module==='proxy'?'checking':r.module==='rbac'?'running':'pending'}">${this.esc(r.module)}</span></td>
                    <td><code>${this.esc(r.code)}</code></td>
                    <td><b>${this.esc(r.name)}</b></td>
                    <td>${r.sort_order}</td>
                    <td><span class="badge online">生效中</span></td>
                    <td class="muted">${this.esc((r.created_at || '-').slice(0, 19))}</td>
                    <td>
                      <button class="tiny" onclick='app.editPermissionModal(${JSON.stringify(r)})'>编辑</button>
                      <button class="tiny danger" onclick="app.deletePermission(${r.id},'${this.esc(r.name)}')">删除</button>
                    </td>
                  </tr>
                `).join('') : '<tr><td colspan="8" class="empty" style="text-align:center;padding:36px">未找到匹配的权限节点</td></tr>'}
              </tbody>
            </table>
          </div>
          ${UI.pager(pack,'rbacPermPage')}
        </div>
      `;
    } catch(err) {
      host.innerHTML = `<div class="panel list-panel"><div class="empty">加载权限节点失败: ${this.esc(err.message)}</div></div>`;
    }
  },
  filterRbacPermModule(mod){
    this.rbacPermModuleFilter = mod;
    this.rbacPermPage = 1;
    this.refresh();
  },
  searchRbacPermissions(){
    this.rbacPermModuleFilter = document.querySelector('#rbac-perm-module')?.value || 'all';
    this.rbacPermKeyword = document.querySelector('#rbac-perm-search')?.value?.trim() || '';
    this.rbacPermPage = 1;
    this.refresh();
  },
  resetRbacPermissions(){
    this.rbacPermModuleFilter = 'all';
    this.rbacPermKeyword = '';
    this.rbacPermPage = 1;
    this.refresh();
  },
  editPermissionModal(perm = {}){
    const modules = this.permModulePairs().map(([c,l])=>[c,`${l} (${c})`]);
    this.modal(perm.id ? '编辑权限节点' : '添加权限节点', `
      <div class="form-grid">
        <input type="hidden" name="id" value="${perm.id || ''}">
        ${this.selectRaw('module', '所属业务模块', modules, perm.module || 'account')}
        ${this.field('code', '权限标识符 (Code)', perm.code || '', 'text', true)}
        ${this.field('name', '节点中文名称', perm.name || '', 'text', true)}
        ${this.field('sort_order', '排序权重 (数字越大越靠前)', perm.sort_order || 0, 'number')}
      </div>
    `, async (d) => {
      await this.api('/permissions', { method: 'POST', body: JSON.stringify(d) });
      this.toast('权限节点已保存');
      this.closeModal();
      this.refresh();
    });
  },
  async deletePermission(id, name){
    const ok = await this.ask(`确定要删除权限节点【${name}】吗？`, 'danger');
    if (!ok) return;
    await this.api('/permissions/delete', { method: 'POST', body: JSON.stringify({ id }) });
    this.toast('权限节点已删除');
    this.refresh();
  },

  async renderRbacRoles(){
    const host = document.querySelector('#content');
    if (!host) return;
    try {
      const allRows = await this.api('/roles');
      const raw = Array.isArray(allRows) ? allRows : [];
      const kw = (this.rbacRoleKeyword || '').trim().toLowerCase();
      const st = String(this.rbacRoleStatus || '');
      const filtered = raw.filter(r => {
        if (st !== '' && String(r.status ? 1 : 0) !== st) return false;
        if (kw && !String(r.name||'').toLowerCase().includes(kw) && !String(r.description||'').toLowerCase().includes(kw)) return false;
        return true;
      });
      const pack = UI.paginateLocal(filtered, this.rbacRolePage || 1, 20);
      this.rbacRolePage = pack.page;
      host.innerHTML = `
        <div class="panel list-panel">
          <div class="matrix-action-bar">
            <div class="left"><span class="muted">共 ${filtered.length} / ${raw.length} 个系统角色</span></div>
            <div class="right">
              <button class="primary tiny" type="button" onclick="app.editRoleModal()">新建系统角色</button>
            </div>
          </div>
          <div class="search-bar task-filter-bar">
            <select id="rbac-role-status" class="input" title="角色状态">
              <option value="">全部状态</option>
              <option value="1" ${st==='1'?'selected':''}>正常启用</option>
              <option value="0" ${st==='0'?'selected':''}>停用锁定</option>
            </select>
            <input id="rbac-role-search" class="input" type="search" placeholder="搜索角色名称 / 说明" value="${this.esc(this.rbacRoleKeyword||'')}" onkeydown="if(event.key==='Enter')app.searchRbacRoles()">
            <button class="primary" type="button" onclick="app.searchRbacRoles()">查询</button>
            <button class="ghost" type="button" onclick="app.resetRbacRoles()">重置</button>
          </div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>角色名称</th>
                  <th>说明描述</th>
                  <th>关联成员数</th>
                  <th>已分配权限节点</th>
                  <th>角色状态</th>
                  <th>更新时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                ${pack.items.length ? pack.items.map(r => {
                  let permCount = 0;
                  try {
                    const parsed = JSON.parse(r.permissions || '[]');
                    permCount = parsed.includes('*') ? '全量权限 (*)' : `${parsed.length} 个节点`;
                  } catch { permCount = '-'; }
                  return `
                  <tr>
                    <td><b>#${r.id}</b></td>
                    <td><b>${this.esc(r.name)}</b></td>
                    <td class="muted">${this.esc(r.description || '-')}</td>
                    <td><span class="badge online">${r.user_count || 0} 人</span></td>
                    <td><code>${this.esc(permCount)}</code></td>
                    <td>${this.badge(r.status ? 'online' : 'expired')}</td>
                    <td class="muted">${this.esc((r.updated_at || r.created_at || '-').slice(0, 19))}</td>
                    <td>
                      <button class="tiny" onclick='app.editRoleModal(${JSON.stringify(r)})'>编辑权限</button>
                      ${r.id > 1 ? `<button class="tiny danger" onclick="app.deleteRole(${r.id},'${this.esc(r.name)}')">删除</button>` : ''}
                    </td>
                  </tr>`;
                }).join('') : '<tr><td colspan="8" class="empty" style="text-align:center;padding:36px">未找到匹配的角色</td></tr>'}
              </tbody>
            </table>
          </div>
          ${UI.pager(pack,'rbacRolePage')}
        </div>
      `;
    } catch(err) {
      host.innerHTML = `<div class="panel list-panel"><div class="empty">加载角色失败: ${this.esc(err.message)}</div></div>`;
    }
  },
  searchRbacRoles(){
    this.rbacRoleStatus = document.querySelector('#rbac-role-status')?.value || '';
    this.rbacRoleKeyword = document.querySelector('#rbac-role-search')?.value?.trim() || '';
    this.rbacRolePage = 1;
    this.refresh();
  },
  resetRbacRoles(){
    this.rbacRoleStatus = '';
    this.rbacRoleKeyword = '';
    this.rbacRolePage = 1;
    this.refresh();
  },
  async editRoleModal(role = {}){
    const perms = await this.api('/permissions');
    const selected = role.permissions ? (role.permissions === '["*"]' ? ['*'] : JSON.parse(role.permissions)) : [];
    const isAll = selected.includes('*');

    this.modal(role.id ? '编辑角色权限' : '新建系统角色', `
      <div class="form-grid">
        <input type="hidden" name="id" value="${role.id || ''}">
        ${this.field('name', '角色名称', role.name || '', 'text', true)}
        ${this.field('description', '说明描述', role.description || '', 'text')}
        ${this.selectRaw('status', '角色状态', this.opt('roleStatuses', [['1', '正常启用'], ['0', '停用锁定']]), String(role.status ?? 1))}
        <div class="field full">
          <label>细粒度权限节点分配 (勾选授权)</label>
          <div class="chip-row" style="max-height:280px;overflow-y:auto;padding:8px 0">
            ${perms.map(p => `
              <label class="chip">
                <input type="checkbox" name="permissions[]" value="${p.id}" ${isAll || selected.map(String).includes(String(p.id)) ? 'checked' : ''}>
                <span><b>${this.esc(p.name)}</b> <small class="muted">(${this.esc(p.code)})</small></span>
              </label>
            `).join('')}
          </div>
        </div>
      </div>
    `, async (d) => {
      const checked = [...document.querySelectorAll('#modal-form input[name="permissions[]"]:checked')].map(el => el.value);
      const payload = {
        id: d.id || null,
        name: d.name,
        description: d.description || '',
        status: Number(d.status || 1),
        permissions: checked
      };
      await this.api('/roles', { method: 'POST', body: JSON.stringify(payload) });
      this.toast('角色已保存');
      this.closeModal();
      this.refresh();
    });
  },
  async deleteRole(id, name){
    if (id <= 1) {
      this.toast('超级管理员角色禁止删除', true);
      return;
    }
    const ok = await this.ask(`确定要删除角色【${name}】吗？`, 'danger');
    if (!ok) return;
    await this.api('/roles/delete', { method: 'POST', body: JSON.stringify({ id }) });
    this.toast('角色已删除');
    this.refresh();
  },

  async renderRbacUsers(){
    const host = document.querySelector('#content');
    if (!host) return;
    try {
      const page = this.rbacUserPage || 1;
      const kw = (this.rbacUserKeyword || '').trim();
      const st = String(this.rbacUserStatus || '');
      const qs = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (kw) qs.set('keyword', kw);
      if (st !== '') qs.set('status', st);
      const res = await this.api(`/admin-users?${qs.toString()}`);
      let rows = res.items || [];
      if (st !== '' && !('status' in (res||{}))) {
        rows = rows.filter(u => String(u.status ? 1 : 0) === st);
      }
      const pack = {
        items: rows,
        page: res.page || page,
        pages: res.pages || res.lastPage || Math.max(1, Math.ceil((res.total || rows.length) / (res.pageSize || 20))),
        total: res.total || rows.length,
        pageSize: res.pageSize || 20,
      };
      this.rbacUserPage = pack.page;
      host.innerHTML = `
        <div class="panel list-panel">
          <div class="matrix-action-bar">
            <div class="left"><span class="muted">共 ${pack.total} 个管理员 · 改角色后立即生效</span></div>
            <div class="right">
              <button class="primary tiny" type="button" onclick="app.editAdminUserModal()">添加管理员用户</button>
            </div>
          </div>
          <div class="search-bar task-filter-bar">
            <select id="rbac-user-status" class="input" title="账号状态">
              <option value="">全部状态</option>
              <option value="1" ${st==='1'?'selected':''}>正常启用</option>
              <option value="0" ${st==='0'?'selected':''}>禁用锁定</option>
            </select>
            <input id="rbac-user-search" class="input" type="search" placeholder="搜索用户名 / 昵称" value="${this.esc(this.rbacUserKeyword||'')}" onkeydown="if(event.key==='Enter')app.searchRbacUsers()">
            <button class="primary" type="button" onclick="app.searchRbacUsers()">查询</button>
            <button class="ghost" type="button" onclick="app.resetRbacUsers()">重置</button>
          </div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>登录用户名</th>
                  <th>显示昵称</th>
                  <th>所属系统角色</th>
                  <th>子级</th>
                  <th>账号状态</th>
                  <th>注册时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                ${rows.length ? rows.map(u => `
                  <tr>
                    <td><b>#${u.id}</b></td>
                    <td><b>${this.esc(u.username)}</b></td>
                    <td>${this.esc(u.nickname || '-')}</td>
                    <td><span class="badge ${u.role_id===1?'online':'running'}">${this.esc(u.role_name || (u.role_id===1?'超级管理员':'普通操作员'))}</span></td>
                    <td>${(u.childIds||[]).length ? `<span class="muted">${(u.childIds||[]).length} 个子级</span>` : '<span class="muted">-</span>'}</td>
                    <td>${this.badge(u.status ? 'online' : 'offline')}</td>
                    <td class="muted">${this.esc((u.created_at || '-').slice(0, 19))}</td>
                    <td>
                      <button class="tiny" onclick='app.editAdminUserModal(${JSON.stringify(u)})'>编辑信息</button>
                      ${u.id > 1 ? `<button class="tiny danger" onclick="app.deleteAdminUser(${u.id},'${this.esc(u.username)}')">删除</button>` : ''}
                    </td>
                  </tr>
                `).join('') : '<tr><td colspan="8" class="empty" style="text-align:center;padding:36px">未找到匹配的管理员</td></tr>'}
              </tbody>
            </table>
          </div>
          ${UI.pager(pack,'rbacUserPage')}
        </div>
      `;
    } catch(err) {
      host.innerHTML = `<div class="panel list-panel"><div class="empty">加载管理员列表失败: ${this.esc(err.message)}</div></div>`;
    }
  },
  searchRbacUsers(){
    this.rbacUserStatus = document.querySelector('#rbac-user-status')?.value || '';
    this.rbacUserKeyword = document.querySelector('#rbac-user-search')?.value?.trim() || '';
    this.rbacUserPage = 1;
    this.refresh();
  },
  resetRbacUsers(){
    this.rbacUserStatus = '';
    this.rbacUserKeyword = '';
    this.rbacUserPage = 1;
    this.refresh();
  },
  async editAdminUserModal(user = {}){
    const [roles, usersPack] = await Promise.all([
      this.api('/roles'),
      this.api('/admin-users?pageSize=200')
    ]);
    const allUsers = usersPack.items || [];
    const selfId = Number(user.id || 0);
    const selected = new Set((user.childIds || []).map(Number));
    // 超级管理员（role_id=1）不可成为他人下级
    const childOpts = allUsers.filter(u => Number(u.id) !== selfId && Number(u.role_id) !== 1);
    const childBoxes = childOpts.length
      ? `<div class="field full"><label>子级管理员（可多选）</label><div class="chip-row" style="max-height:180px;overflow:auto;padding:8px;border:1px solid #e2e8f0;border-radius:8px">${childOpts.map(u => {
          const id = Number(u.id);
          const label = this.esc(u.nickname || u.username) + ' · @' + this.esc(u.username);
          return `<label class="chip"><input type="checkbox" name="childId" value="${id}" ${selected.has(id)?'checked':''}> ${label}</label>`;
        }).join('')}</div><div class="muted" style="margin-top:6px">勾选后，该账号可在右下角切换到子账号查看其专属数据。超级管理员不可设为下级。</div></div>`
      : `<div class="field full"><div class="muted">暂无其他管理员可作为子级（超级管理员不可被选）</div></div>`;
    this.modal(user.id ? '编辑管理员账号' : '添加管理用户', `
      <div class="form-grid">
        <input type="hidden" name="id" value="${user.id || ''}">
        ${this.field('username', '登录用户名', user.username || '', 'text', true)}
        ${this.field('nickname', '显示昵称', user.nickname || '', 'text')}
        ${this.field('password', user.id ? '重置登录密码 (留空则保持原密码)' : '初始登录密码', '', 'password', !user.id)}
        ${this.selectRaw('role_id', '所属系统角色', roles.map(r => [r.id, r.name]), user.role_id || 1)}
        ${this.selectRaw('status', '账号状态', this.opt('userStatuses', [['1', '正常启用'], ['0', '禁用锁定']]), String(user.status ?? 1))}
        ${childBoxes}
      </div>
    `, async (d) => {
      const payload = {
        id: d.id ? Number(d.id) : undefined,
        username: d.username,
        nickname: d.nickname,
        password: d.password || '',
        role_id: Number(d.role_id || 1),
        status: Number(d.status ?? 1),
        childIds: [...document.querySelectorAll('#modal-form [name=childId]:checked')].map(x => Number(x.value))
      };
      if (!payload.id) delete payload.id;
      await this.api('/admin-users', { method: 'POST', body: JSON.stringify(payload) });
      this.toast('管理员账号已保存');
      this.closeModal();
      this.refresh();
    });
  },
  async deleteAdminUser(id, username){
    if (id === 1) {
      this.toast('超级管理员账号禁止删除', true);
      return;
    }
    const ok = await this.ask(`确定要删除管理员【${username}】吗？`, 'danger');
    if (!ok) return;
    await this.api('/admin-users/delete', { method: 'POST', body: JSON.stringify({ id }) });
    this.toast('管理员账号已删除');
    this.refresh();
  },

  async renderRbacLogs(){
    const host = document.querySelector('#content');
    if (!host) return;
    try {
      const kw = (this.rbacLogKeyword || '').trim();
      const page = this.rbacLogPage || 1;
      const res = await this.api(`/admin-logs?page=${page}&pageSize=20${kw ? '&keyword=' + encodeURIComponent(kw) : ''}`);
      const rows = res.items || [];
      const pack = {
        items: rows,
        page: res.page || page,
        pages: res.pages || res.lastPage || Math.max(1, Math.ceil((res.total || rows.length) / (res.pageSize || 20))),
        total: res.total || rows.length,
        pageSize: res.pageSize || 20,
      };
      this.rbacLogPage = pack.page;
      host.innerHTML = `
        <div class="panel list-panel">
          <div class="matrix-action-bar">
            <div class="left"><span class="muted">共 ${pack.total} 条审计记录</span></div>
            <div class="right">
              <button class="danger tiny" type="button" onclick="app.clearRbacLogs()">清空所有日志</button>
            </div>
          </div>
          <div class="search-bar task-filter-bar">
            <input id="rbac-log-search" class="input" type="search" placeholder="搜索操作人、路由、动作或 IP" value="${this.esc(this.rbacLogKeyword||'')}" onkeydown="if(event.key==='Enter')app.searchRbacLogs()">
            <button class="primary" type="button" onclick="app.searchRbacLogs()">查询</button>
            <button class="ghost" type="button" onclick="app.resetRbacLogs()">重置</button>
          </div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>操作人员</th>
                  <th>所属模块</th>
                  <th>动作 (Action)</th>
                  <th>请求路由 (Path)</th>
                  <th>客户端 IP</th>
                  <th>记录时间</th>
                </tr>
              </thead>
              <tbody>
                ${rows.length ? rows.map(l => `
                  <tr>
                    <td><b>#${l.id}</b></td>
                    <td><b>${this.esc(l.username || 'System')}</b></td>
                    <td><span class="badge ${l.module==='account'?'online':l.module==='proxy'?'checking':l.module==='rbac'?'running':'pending'}">${this.esc(l.module || 'system')}</span></td>
                    <td><span class="badge online">${this.esc(l.action)}</span></td>
                    <td><code>${this.esc(l.path || '-')}</code></td>
                    <td>${this.esc(l.ip || '-')}</td>
                    <td class="muted">${this.esc((l.created_at || '-').slice(0, 19))}</td>
                  </tr>
                `).join('') : '<tr><td colspan="7" class="empty" style="text-align:center;padding:36px">暂无操作审计日志</td></tr>'}
              </tbody>
            </table>
          </div>
          ${UI.pager(pack,'rbacLogPage')}
        </div>
      `;
    } catch(err) {
      host.innerHTML = `<div class="panel list-panel"><div class="empty">加载操作日志失败: ${this.esc(err.message)}</div></div>`;
    }
  },
  searchRbacLogs(){
    this.rbacLogKeyword = document.querySelector('#rbac-log-search')?.value?.trim() || '';
    this.rbacLogPage = 1;
    this.refresh();
  },
  resetRbacLogs(){
    this.rbacLogKeyword = '';
    this.rbacLogPage = 1;
    this.refresh();
  },
  async clearRbacLogs(){
    const ok = await this.ask('确定要清空所有操作审计日志吗？清空后不可恢复。', 'danger');
    if (!ok) return;
    await this.api('/admin-logs/clear', { method: 'POST' });
    this.toast('操作日志已清空');
    this.refresh();
  },

  async renderRbacMenus(){
    const host = document.querySelector('#content');
    if (!host) return;
    try {
      const allRows = await this.api('/menus');
      const raw = Array.isArray(allRows) ? allRows : [];
      const kw = (this.rbacMenuKeyword || '').trim().toLowerCase();
      const vis = String(this.rbacMenuVisible || '');
      const filtered = raw.filter(m => {
        if (vis !== '' && String(m.visible ? 1 : 0) !== vis) return false;
        if (kw && !String(m.title||'').toLowerCase().includes(kw) && !String(m.view||'').toLowerCase().includes(kw) && !String(m.subview||'').toLowerCase().includes(kw) && !String(m.icon||'').toLowerCase().includes(kw)) return false;
        return true;
      });
      const pack = UI.paginateLocal(filtered, this.rbacMenuPage || 1, 20);
      this.rbacMenuPage = pack.page;
      host.innerHTML = `
        <div class="panel list-panel">
          <div class="matrix-action-bar">
            <div class="left"><span class="muted">共 ${filtered.length} / ${raw.length} 个菜单项</span></div>
            <div class="right">
              <button class="ghost tiny" type="button" onclick="app.refreshMenuTree()">刷新顶部导航</button>
              <button class="primary tiny" type="button" onclick="app.editMenuModal()">添加菜单项</button>
            </div>
          </div>
          <div class="search-bar task-filter-bar">
            <select id="rbac-menu-visible" class="input" title="显示状态">
              <option value="">全部状态</option>
              <option value="1" ${vis==='1'?'selected':''}>显示</option>
              <option value="0" ${vis==='0'?'selected':''}>隐藏</option>
            </select>
            <input id="rbac-menu-search" class="input" type="search" placeholder="搜索标题 / View / Subview / 图标" value="${this.esc(this.rbacMenuKeyword||'')}" onkeydown="if(event.key==='Enter')app.searchRbacMenus()">
            <button class="primary" type="button" onclick="app.searchRbacMenus()">查询</button>
            <button class="ghost" type="button" onclick="app.resetRbacMenus()">重置</button>
          </div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>层级关系</th>
                  <th>菜单标题</th>
                  <th>图标标识</th>
                  <th>对应视图 (View)</th>
                  <th>对应子视图 (Subview)</th>
                  <th>排序权重</th>
                  <th>显示状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                ${pack.items.length ? pack.items.map(m => `
                  <tr>
                    <td><b>#${m.id}</b></td>
                    <td>${m.parent_id ? `#${m.parent_id}` : '<span class="badge running">一级根菜单</span>'}</td>
                    <td><b>${this.esc(m.title)}</b></td>
                    <td><code>${this.esc(m.icon || '-')}</code></td>
                    <td><code>${this.esc(m.view)}</code></td>
                    <td><span class="muted">${this.esc(m.subview || '-')}</span></td>
                    <td>${m.sort_order}</td>
                    <td>${this.badge(m.visible ? 'online' : 'offline')}</td>
                    <td>
                      <button class="tiny" onclick='app.editMenuModal(${JSON.stringify(m)})'>编辑</button>
                      <button class="tiny danger" onclick="app.deleteMenu(${m.id},'${this.esc(m.title)}')">删除</button>
                    </td>
                  </tr>
                `).join('') : '<tr><td colspan="9" class="empty" style="text-align:center;padding:36px">未找到匹配的菜单项</td></tr>'}
              </tbody>
            </table>
          </div>
          ${UI.pager(pack,'rbacMenuPage')}
        </div>
      `;
    } catch(err) {
      host.innerHTML = `<div class="panel list-panel"><div class="empty">加载菜单失败: ${this.esc(err.message)}</div></div>`;
    }
  },
  searchRbacMenus(){
    this.rbacMenuVisible = document.querySelector('#rbac-menu-visible')?.value || '';
    this.rbacMenuKeyword = document.querySelector('#rbac-menu-search')?.value?.trim() || '';
    this.rbacMenuPage = 1;
    this.refresh();
  },
  resetRbacMenus(){
    this.rbacMenuVisible = '';
    this.rbacMenuKeyword = '';
    this.rbacMenuPage = 1;
    this.refresh();
  },
  async editMenuModal(m = {}){
    const allMenus = await this.api('/menus');
    const rootOpts = [['', '一级根菜单 (无上级)'], ...allMenus.filter(x => !m.id || x.id !== m.id).map(x => [x.id, `#${x.id} ${x.title}`])];
    this.modal(m.id ? '编辑菜单项' : '添加后台菜单', `
      <div class="form-grid">
        <input type="hidden" name="id" value="${m.id || ''}">
        ${this.selectRaw('parentId', '上级父级菜单', rootOpts, m.parent_id || '')}
        ${this.field('title', '菜单标题', m.title || '', 'text', true)}
        ${this.field('icon', '图标标识 (Icon Name)', m.icon || '', 'text')}
        ${this.field('view', '对应主视图 (View)', m.view || '', 'text', true)}
        ${this.field('subview', '对应子视图 (Subview)', m.subview || '', 'text')}
        ${this.field('sortOrder', '排序权重 (升序)', m.sort_order || 0, 'number')}
        ${this.selectRaw('visible', '是否可见显示', this.opt('menuVisibilities', [['1', '显示'], ['0', '隐藏']]), String(m.visible ?? 1))}
      </div>
    `, async (d) => {
      d.parentId = d.parentId ? Number(d.parentId) : null;
      d.sortOrder = Number(d.sortOrder || 0);
      d.visible = d.visible === '1';
      if (m.id) {
        await this.api(`/menus/${m.id}`, { method: 'PUT', body: JSON.stringify(d) });
      } else {
        await this.api('/menus', { method: 'POST', body: JSON.stringify(d) });
      }
      this.toast('菜单项已保存');
      this.closeModal();
      await this.loadNavigationMenus();
      this.refresh();
    });
  },
  async deleteMenu(id, title){
    const ok = await this.ask(`确定要删除菜单【${title}】及其关联下级菜单吗？`, 'danger');
    if (!ok) return;
    await this.api(`/menus/${id}`, { method: 'DELETE' });
    this.toast('菜单项已删除');
    await this.loadNavigationMenus();
    this.refresh();
  },
  async refreshMenuTree(){
    await this.loadNavigationMenus();
    this.toast('顶部导航菜单树已刷新');
    this.refresh();
  },

  async renderSettings(){
    document.querySelector('#content').classList.remove('chat-mode');
    const [st,sys,auth,browser]=await Promise.all([this.api('/settings'),this.api('/system/info'),this.api('/auth/status'),this.api('/browser/status').catch(()=>({online:false,message:'无法检测'}))]);
    this.clockTimezone=st.clockTimezone||'Asia/Shanghai';
    this.notificationSound=st.notificationSound||'chime';
    this.notificationSync=st.notificationSync!==false;
    const sec=this.settingsSection||'browser';
    const menu=this.opt('settingsSections',[['env','接口与开发环境'],['browser','浏览器设置'],['message','消息设置'],['task','任务与无头'],['clock','多国时钟'],['backup','备份与鉴权'],['password','修改账号密码']]);
    const now=new Date();
    const fmt=(tz)=>{try{return {time:now.toLocaleTimeString('zh-CN',{timeZone:tz,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}),date:now.toLocaleDateString('zh-CN',{timeZone:tz,weekday:'short',month:'short',day:'numeric'})}}catch{return {time:now.toLocaleTimeString('zh-CN'),date:now.toLocaleDateString('zh-CN')}}};
    const clocks=(Array.isArray(st.clocks)&&st.clocks.length?st.clocks:[{name:'中国 · 上海',tz:'Asia/Shanghai'},{name:'美国 · 纽约',tz:'America/New_York'},{name:'英国 · 伦敦',tz:'Europe/London'}]).map((c,i)=>({...c,cls:i%3===1?'alt':i%3===2?'amber':''}));
    document.querySelector('#content').innerHTML=`<div class="settings-shell">
      <aside class="settings-sidebar">
        <div class="sidebar-header">设置分类</div>
        <div class="settings-menu">${menu.map(([k,n])=>`<button type="button" class="settings-menu-item ${sec===k?'active':''}" data-key="${k}" onclick="app.scrollSettings('${k}')">${n}</button>`).join('')}</div>
      </aside>
      <div class="settings-content">
        <form id="settings-form" class="settings-form">
          <div id="section-env" class="settings-card">
            <div class="settings-header">
              <h2 class="settings-title">接口与开发环境配置</h2>
              <span class="muted">比特自动化由本机 Node 处理；业务数据走接口域名</span>
            </div>
            ${this.formRow('接口域名 (API Base)', `<input class="input" id="custom-api-base" value="${this.esc(window.TKSWARM_API_BASE||'')}" placeholder="http://tkswarm-api.dyyweb.com">`, '业务数据一律走此线上域名；禁止填 127.0.0.1。仅 /browser、/system、WebSocket 走本机 Node')}
            ${this.formRow('WebSocket 地址', `<input class="input" id="custom-ws-base" value="${this.esc(localStorage.getItem('tkswarm_custom_ws_base')||'')}" placeholder="例如 ws://127.0.0.1:8999/ws">`, '用于实时操作日志与消息推送（本机 Node）')}
            <div class="modal-foot">
              <button class="primary" type="button" onclick="app.saveEnvConfig()">应用并刷新页面</button>
            </div>
          </div>

          <div id="section-browser" class="settings-card">
            <div class="settings-header"><h2 class="settings-title">浏览器设置</h2>
              <div class="action-bar" style="margin:0"><button class="ghost" type="button" onclick="app.testBrowserConnection()">测试连接</button><button class="ghost" type="button" onclick="app.openBitDownload()">下载比特浏览器</button>${this.canPermission('account.create')?`<button class="danger" type="button" onclick="app.deleteBrowsersFromSettings()">删除浏览器环境</button>`:''}</div>
            </div>
            ${this.formRow('默认浏览器',this.settingsSelect('browserType',this.browserTypePairs(),st.browserType),'本系统通过比特浏览器打开独立环境，再控制 TikTok 页面')}
            ${this.formRow('窗口模式',this.settingsSelect('browserWindowMode',this.browserWindowPairs(),st.browserWindowMode||'visible'),'显示：能看到浏览器操作过程，方便排错；隐藏：后台静默跑，适合正式批量发布')}
            ${this.formRow('API 地址',this.settingsInput('browserApiUrl',st.browserApiUrl),browser.online?'当前：已连接 · '+this.esc(browser.apiUrl||''):'当前：未连接 · '+this.esc(browser.message||''))}
            ${this.formRow('API Token',this.settingsInput('browserApiToken','','password'),'留空则不修改已保存 Token')}
            ${this.formRow('云代理 API',this.settingsInput('cloudProxyApiUrl',st.cloudProxyApiUrl||''),'可选，用于拉取云代理列表')}
            <div class="modal-foot"><button class="primary" type="submit">保存设置</button></div>
          </div>

          <div id="section-message" class="settings-card">
            <div class="settings-header"><h2 class="settings-title">消息设置</h2>
              <button class="ghost" type="button" onclick="app.previewTipSound()">试听提示音</button>
            </div>
            <div class="field full"><div class="muted" style="margin:0 0 12px">消息模板对应 <b>TikTok 私信</b>。私信同步：API 优先拉 IM；失败可 <b>Bit 拦截/爬取</b>。失败标记 unsupported，不写假消息。</div></div>
            ${this.formRow('启用私信话术',this.settingsSelect('dmTemplateEnabled',[['true','开启'],['false','关闭']],String(st.dmTemplateEnabled)!=='false'?'true':'false'),'关闭后群发与客服将禁用话术选择，仅可手填内容')}
            ${this.formRow('私信同步',this.settingsSelect('privateMessageSync',[['true','开启'],['false','关闭']],String(st.privateMessageSync)!=='false'?'true':'false'),'开启后由调度按间隔入队 dm_sync（需本机 Node）')}
            ${this.formRow('同步间隔（分钟）',this.settingsInput('messageSyncInterval',st.messageSyncInterval??10,'number'),'1–60 分钟；旧版若曾按秒保存，保存时会自动折算')}
            ${this.formRow('私信模式',this.settingsSelect('messageSyncMode',[['api','API优先'],['browser','仅浏览器(Bit)']],st.messageSyncMode||'api'),'API：CK HTTP 探测；失败可降级 Bit。浏览器：只走比特打开 /messages 拦截/爬取')}
            ${this.formRow('API失败降级Bit',this.settingsSelect('dmSyncBitFallback',[['true','开启'],['false','关闭']],String(st.dmSyncBitFallback)!=='false'?'true':'false'),'HTTP IM 失败时用比特环境拦截真实 XHR 或 DOM 只读爬取；仍失败标记 unsupported，不写假消息')}
            <div class="settings-subhead">通知</div>
            ${this.formRow('通知同步',this.settingsSelect('notificationSync',[['true','开启'],['false','关闭']],String(st.notificationSync)!=='false'?'true':'false'),'客服台有新本地消息时提示音')}
            ${this.formRow('通知间隔（分钟）',this.settingsInput('notificationInterval',st.notificationInterval??1,'number'),'客服界面刷新轮询间隔')}
            ${this.formRow('提示音',this.settingsSelect('notificationSound',this.notificationSoundPairs(),st.notificationSound||'chime'))}
            <details class="settings-fold">
              <summary>翻译与高级（点击展开）</summary>
              ${this.formRow('收信自动翻译',this.settingsSelect('translationOnReceive',[['false','关闭'],['true','开启']],String(st.translationOnReceive)==='true'?'true':'false'))}
              ${this.formRow('翻译模式',this.settingsSelect('translationMode',this.translationModePairs(),st.translationMode==='normal'?'basic':(st.translationMode||'off')),'普通接口翻译 / AI 智能翻译（耗配额）；未配置接口时不会假装翻译成功')}
              ${this.formRow('翻译 API',this.settingsInput('translationApiUrl',st.translationApiUrl||''),'普通：带 q/langpair 的翻译 URL；AI：OpenAI 兼容 base（自动拼 /chat/completions）')}
              ${this.formRow('翻译 Key',this.settingsInput('translationApiKey','','password'))}
              ${this.formRow('模型 ID',this.settingsInput('translationModelId',st.translationModelId||'gpt-3.5-turbo'))}
              ${this.formRow('目标语言',this.settingsSelect('translationTarget',this.languagePairs(false),st.translationTarget||'zh'))}
              ${this.formRow('配额 / 已用',`<div style="display:flex;gap:8px;max-width:420px">${this.settingsInput('translationQuota',st.translationQuota||0,'number')}${this.settingsInput('translationUsed',st.translationUsed||0,'number')}</div>`)}
              ${this.formRow('粉丝同步上限',this.settingsInput('fansSyncMaxPerRun',st.fansSyncMaxPerRun||500,'number'),'单次比特拉粉丝列表最多条数（50–2000）')}
            </details>
            <div class="modal-foot"><button class="primary" type="submit">保存设置</button></div>
          </div>

          <div id="section-task" class="settings-card">
            <div class="settings-header"><h2 class="settings-title">任务与无头</h2></div>
            ${this.formRow('任务并发（1-3）',this.settingsInput('taskConcurrency',st.taskConcurrency,'number'))}
            ${this.formRow('单账号超时（秒）',this.settingsInput('taskAccountTimeout',st.taskAccountTimeout,'number'))}
            ${this.formRow('批次间隔（毫秒）',this.settingsInput('taskBatchInterval',st.taskBatchInterval,'number'))}
            ${this.formRow('最大重试次数',this.settingsInput('taskMaxRetries',st.taskMaxRetries,'number'))}
            ${this.formRow('发布人工确认',this.settingsSelect('publishManualConfirm',[['false','关闭（自动发布）'],['true','开启（填好后停手）']],String(st.publishManualConfirm)==='true'?'true':'false'))}
            ${this.formRow('窗口模式（总开关）',this.settingsSelect('browserWindowMode',this.browserWindowPairs(),st.browserWindowMode||'visible'),'与「浏览器设置」里同一项，改任意一处都会生效')}
            <div class="field full"><div class="muted" style="margin:4px 0 8px">以下分项仅在窗口模式选「按分项开关」时生效：</div></div>
            ${this.formRow('登录无头',this.settingsSelect('headlessLogin',[['false','关闭'],['true','开启']],String(st.headlessLogin)==='true'?'true':'false'))}
            ${this.formRow('发布无头',this.settingsSelect('headlessPublish',[['false','关闭'],['true','开启']],String(st.headlessPublish)==='true'?'true':'false'))}
            ${this.formRow('私信无头',this.settingsSelect('headlessMessage',[['false','关闭'],['true','开启']],String(st.headlessMessage)==='true'?'true':'false'))}
            ${this.formRow('资料无头',this.settingsSelect('headlessProfile',[['false','关闭'],['true','开启']],String(st.headlessProfile)==='true'?'true':'false'))}
            ${this.formRow('扫码无头',this.settingsSelect('headlessScan',[['false','关闭'],['true','开启']],String(st.headlessScan)==='true'?'true':'false'))}
            <div class="modal-foot"><button class="primary" type="submit">保存设置</button></div>
          </div>

          <div id="section-clock" class="settings-card">
            <div class="settings-header"><h2 class="settings-title">多国时钟</h2></div>
            ${this.formRow('主时钟时区',this.settingsInput('clockTimezone',st.clockTimezone||'Asia/Shanghai'),'影响顶栏时钟显示')}
            <div class="action-bar" style="margin-bottom:12px"><button class="ghost" type="button" onclick="app.addClock()">添加时钟</button></div>
            <div class="clock-container" id="settings-clocks">${clocks.map((c,i)=>{const t=fmt(c.tz);return `<div class="clock-card ${c.cls}" data-tz="${c.tz}"><div class="clock-time">${t.time}</div><div class="clock-country">${this.esc(c.name)}</div><div class="clock-date">${t.date}</div><button class="tiny danger" type="button" onclick="app.removeClock(${i})">删除</button></div>`}).join('')}</div>
            <div class="modal-foot"><button class="primary" type="submit">保存设置</button></div>
          </div>

          <div id="section-backup" class="settings-card">
            <div class="settings-header"><h2 class="settings-title">备份与鉴权</h2><span class="muted">库体积 ${Math.round((sys.databaseSize||0)/1024)} KB</span></div>
            ${this.formRow('本地登录',this.settingsSelect('authEnabled',[['false','关闭'],['true','开启']],String(st.authEnabled)==='true'||auth.authEnabled?'true':'false'),'开启后接口需登录')}
            <div class="action-bar">
              ${this.canPermission('system.view')||this.canPermission('rbac.manage')?`<button class="primary" type="button" onclick="app.createBackup()">立即备份</button>`:'<span class="muted">当前角色无权备份</span>'}
              <label class="ghost" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;cursor:pointer">恢复备份<input type="file" accept=".sql,.json" hidden onchange="app.restoreBackup(this)"></label>
            </div>
            <div class="form-hint" style="margin:8px 0 12px">恢复后请运行 close.bat，再 start.bat。密钥：${this.esc(sys.secretKeyPath||'')}</div>
            ${(sys.backups||[]).length?`<div class="table-container"><table><thead><tr><th>备份</th><th>大小</th><th>时间</th><th>操作</th></tr></thead><tbody>${sys.backups.map(b=>`<tr><td>${this.esc(b.name)}</td><td>${Math.round(b.size/1024)} KB</td><td>${this.esc(b.mtime)}</td><td><a class="tiny" href="${b.download}">下载</a></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty" style="padding:24px">还没有备份</div>'}
            <div class="modal-foot"><button class="primary" type="submit">保存设置</button></div>
          </div>

          <div id="section-password" class="settings-card">
            <div class="settings-header"><h2 class="settings-title">修改账号密码</h2><span class="muted">仅影响当前登录管理员</span></div>
            ${auth.user?`<div class="form-grid">${this.field('oldPassword','原密码','','password')}${this.field('newPassword','新密码','','password')}<div class="field full"><div class="muted">新密码建议不少于 6 位；更新后无需重新登录。</div></div><div class="field"><button class="primary" type="button" onclick="app.changeAuthPassword()">更新密码</button></div></div>`:`<div class="shell-note">当前未开启本地鉴权或未登录管理员，无法修改密码。请先在「备份与鉴权」开启鉴权并登录。</div><div class="action-bar" style="margin-top:12px"><button class="ghost" type="button" onclick="app.scrollSettings('backup')">前往备份与鉴权</button></div>`}
          </div>
        </form>
      </div>
    </div>`;
    if(this._clockTimer)clearInterval(this._clockTimer);
    this._clockTimer=setInterval(()=>{
      document.querySelectorAll('#settings-clocks .clock-card').forEach(card=>{
        const tz=card.dataset.tz;const t=(()=>{try{const n=new Date();return {time:n.toLocaleTimeString('zh-CN',{timeZone:tz,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}),date:n.toLocaleDateString('zh-CN',{timeZone:tz,weekday:'short',month:'short',day:'numeric'})}}catch{return null}})();
        if(!t)return;card.querySelector('.clock-time').textContent=t.time;card.querySelector('.clock-date').textContent=t.date;
      });
    },1000);
    document.querySelector('#settings-form').onsubmit=async e=>{
      e.preventDefault();
      const d=Object.fromEntries(new FormData(e.target));
      delete d.oldPassword; delete d.newPassword;
      ['messageSyncInterval','notificationInterval','fansSyncMaxPerRun','taskConcurrency','taskAccountTimeout','taskBatchInterval','taskMaxRetries','translationQuota','translationUsed'].forEach(k=>d[k]=Number(d[k]||0));
      d.taskConcurrency=Math.min(3,Math.max(1,d.taskConcurrency||1));
      d.taskAccountTimeout=Math.min(600,Math.max(30,d.taskAccountTimeout||180));
      d.messageSyncInterval=Math.min(60,Math.max(1,d.messageSyncInterval||10));
      d.notificationInterval=Math.min(60,Math.max(1,d.notificationInterval||1));
      d.fansSyncMaxPerRun=Math.min(2000,Math.max(50,d.fansSyncMaxPerRun||500));
      d.publishManualConfirm=d.publishManualConfirm==='true';
      ['authEnabled','headlessLogin','headlessPublish','headlessMessage','headlessProfile','headlessScan','headlessCapcut','privateMessageSync','notificationSync','translationOnReceive','dmTemplateEnabled','dmSyncBitFallback'].forEach(k=>d[k]=d[k]==='true');
      if(!d.browserApiToken)delete d.browserApiToken;
      if(!d.translationApiKey)delete d.translationApiKey;
      await this.api('/settings',{method:'PUT',body:JSON.stringify(d)});
      this.clockTimezone=d.clockTimezone||'Asia/Shanghai';
      this.notificationSound=d.notificationSound||'chime';
      this.notificationSync=d.notificationSync!==false;
      this.messageSyncInterval=d.messageSyncInterval;
      this.notificationInterval=d.notificationInterval;
      this.toast('设置已保存');
      if(d.authEnabled&&!auth.authenticated){location.reload()}
    };
    this.bindSettingsScrollSpy();
  },
  bindSettingsScrollSpy(){
    const scroller=document.querySelector('.settings-content');
    if(!scroller)return;
    if(this._settingsScrollHandler){
      try{this._settingsScrollEl?.removeEventListener('scroll',this._settingsScrollHandler)}catch{}
    }
    const keys=['env','browser','message','task','clock','backup','password'];
    const applyActive=(key)=>{
      if(!key)return;
      if(this.settingsSection!==key) this.settingsSection=key;
      document.querySelectorAll('.settings-menu-item').forEach(el=>el.classList.toggle('active',el.dataset.key===key));
    };
    const sync=()=>{
      if(this._settingsScrollLock)return;
      const line=scroller.getBoundingClientRect().top+64;
      let current=keys[0];
      for(const k of keys){
        const el=document.querySelector('#section-'+k);
        if(!el)continue;
        if(el.getBoundingClientRect().top<=line) current=k;
      }
      applyActive(current);
    };
    this._settingsScrollHandler=()=>{
      if(this._settingsScrollRaf)cancelAnimationFrame(this._settingsScrollRaf);
      this._settingsScrollRaf=requestAnimationFrame(sync);
    };
    this._settingsScrollEl=scroller;
    scroller.addEventListener('scroll',this._settingsScrollHandler,{passive:true});
    sync();
  },
  changeEnvMode(mode){
    const apiInput = document.querySelector('#custom-api-base');
    if(!apiInput)return;
    if(mode === 'production'){
      apiInput.value = '';
    } else if(mode === 'php' || mode === 'local'){
      apiInput.value = 'http://tkswarm-api.dyyweb.com';
    } else if(mode === 'test'){
      apiInput.value = 'http://test-api.tkswarm.com';
    }
  },
  saveEnvConfig(){
    let apiBase = document.querySelector('#custom-api-base')?.value?.trim() || '';
    const wsBase = document.querySelector('#custom-ws-base')?.value?.trim() || '';
    const online = 'http://tkswarm-api.dyyweb.com';
    if(!apiBase || /127\.0\.0\.1|localhost/i.test(apiBase)){
      apiBase = online;
      this.toast('业务接口必须使用线上域名，已自动改为 '+online, 'warn');
    }
    localStorage.setItem('tkswarm_env_mode', 'custom');
    localStorage.setItem('tkswarm_custom_api_base', apiBase.replace(/\/+$/,''));
    if(wsBase) localStorage.setItem('tkswarm_custom_ws_base', wsBase);
    else localStorage.removeItem('tkswarm_custom_ws_base');
    this.toast('环境配置已更新，正在重新加载...');
    setTimeout(()=>location.reload(), 600);
  },
  async testBrowserConnection(){try{const r=await this.api('/browser/status');this.toast(r.online?`比特浏览器已连接：${r.message||'ok'}`:(r.message||'未连接'),!r.online);this.refresh()}catch(e){this.toast(e.message,true)}},
  openBitDownload(){window.open('https://www.bitbrowser.cn/','_blank','noopener')},
  async createBackup(){if(!this.canPermission('system.view')&&!this.canPermission('rbac.manage')){this.toast('当前角色无权备份数据',true);return}try{const r=await this.api('/system/backup',{method:'POST'});this.toast('备份已创建');if(r.download){try{await this.downloadAuth(r.download,(r.download.split('/').pop()||'backup.sql'),'备份文件为空')}catch(err){this.toast('备份已创建，但下载失败：'+err.message,true)}}this.refresh()}catch(e){this.toast(e.message,true)}},
  async restoreBackup(input){if(!this.canPermission('system.view')&&!this.canPermission('rbac.manage')){this.toast('当前角色无权恢复备份',true);input.value='';return}const file=input.files?.[0];if(!file)return;if(!(await this.ask('确定恢复该 MySQL 备份吗？将直接导入当前数据库。'))){input.value='';return}const fd=new FormData();fd.append('file',file);try{const r=await fetch('/api/system/restore',{method:'POST',headers:this.authToken?{Authorization:'Bearer '+this.authToken}:{},body:fd});const j=await r.json();if(!r.ok||!j.success)throw new Error(j.message||'恢复失败');this.toast(j.message||'MySQL 数据已恢复')}catch(e){this.toast(e.message,true)}finally{input.value=''}},
  async changeAuthPassword(){const oldPassword=document.querySelector('[name=oldPassword]')?.value||'';const newPassword=document.querySelector('[name=newPassword]')?.value||'';try{await this.api('/auth/password',{method:'PUT',body:JSON.stringify({oldPassword,newPassword})});this.toast('密码已更新')}catch(e){this.toast(e.message,true)}},

  settingsInput(name,value='',type='text',required=false){return `<input class="input" name="${name}" type="${type}" value="${this.esc(value)}" ${required?'required':''}>`},
  settingsSelect(name,items,value){return `<select name="${name}">${items.map(([v,n])=>`<option value="${v}" ${String(v)===String(value)?'selected':''}>${n}</option>`).join('')}</select>`},
  scrollSettings(key){
    this.settingsSection=key;
    document.querySelectorAll('.settings-menu-item').forEach(el=>el.classList.toggle('active',el.dataset.key===key));
    const scroller=document.querySelector('.settings-content');
    const target=document.querySelector('#section-'+key);
    if(!target)return;
    this._settingsScrollLock=true;
    clearTimeout(this._settingsScrollUnlock);
    if(scroller){
      const y=target.getBoundingClientRect().top-scroller.getBoundingClientRect().top+scroller.scrollTop-8;
      scroller.scrollTo({top:Math.max(0,y),behavior:'smooth'});
    }else{
      target.scrollIntoView({behavior:'smooth',block:'start'});
    }
    this._settingsScrollUnlock=setTimeout(()=>{
      this._settingsScrollLock=false;
      if(this._settingsScrollHandler) this._settingsScrollHandler();
    },520);
  },
  async addClock(){this.modal('添加时钟',`<div class="form-grid">${this.field('name','名称','','text',true)}${this.field('tz','时区','Asia/Tokyo','text',true)}<div class="field full"><div class="muted">时区示例：Asia/Tokyo、Europe/Paris、America/Los_Angeles</div></div></div>`,async d=>{try{new Intl.DateTimeFormat('zh-CN',{timeZone:d.tz}).format(new Date())}catch{throw new Error('时区无效')}const st=await this.api('/settings');const clocks=Array.isArray(st.clocks)?st.clocks.slice():[];clocks.push({name:d.name,tz:d.tz});await this.api('/settings',{method:'PUT',body:JSON.stringify({clocks})});this.toast('时钟已添加');this.closeModal();this.refresh()})},
  async removeClock(index){const st=await this.api('/settings');const clocks=(Array.isArray(st.clocks)?st.clocks:[]).filter((_,i)=>i!==index);if(!clocks.length){this.toast('至少保留一个时钟',true);return}await this.api('/settings',{method:'PUT',body:JSON.stringify({clocks})});this.toast('已删除');this.refresh()},

  async renderTemplates(){const all=await this.api('/message-templates');const rowsAll=Array.isArray(all)?all:(all.items||[]);const pack=UI.paginateLocal(rowsAll,this.templatePage||1,20);this.templatePage=pack.page;const rows=pack.items;let dmOn=true;try{const st=await this.api('/settings');dmOn=st.dmTemplateEnabled!==false}catch{}const canWrite=this.canPermission('chat.manage')||this.canPermission('publish.mass');document.querySelector('#content').innerHTML=`<div class="panel"><div class="toolbar"><span class="muted">话术用于 <b>TikTok 私信</b>客服与群发${dmOn?'':'（设置中「启用私信话术」已关闭）'}。</span>${canWrite?`<button class="primary" onclick="app.templateModal()">+ 添加模板</button>`:'<span class="muted">当前角色无权维护话术</span>'}</div>${rows.length?`<table><thead><tr><th>名称</th><th>分类</th><th>内容</th><th>变量</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows.map(x=>`<tr><td><b>${this.esc(x.name)}</b></td><td>${this.esc(x.group_name||'未分类')}</td><td>${this.esc(x.content.slice(0,100))}</td><td>${this.esc(x.variables||'-')}</td><td>${x.enabled?'启用':'停用'}</td><td>${canWrite?`<button class="tiny" onclick='app.templateModal(${JSON.stringify(x)})'>编辑</button><button class="tiny danger" onclick="app.remove('/message-templates/${x.id}','消息模板')">删除</button>`:'-'}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">还没有消息模板</div>'}${UI.pager(pack,'templatePage')}</div>`},
  templateModal(x={}){if(!this.canPermission('chat.manage')&&!this.canPermission('publish.mass')){this.toast('当前角色无权维护话术',true);return}const gs=this.groups.filter(g=>g.type==='message');this.modal(x.id?'编辑消息模板':'添加消息模板',`<div class="form-grid"><input type="hidden" name="id" value="${x.id||''}">${this.field('name','模板名称',x.name||'', 'text',true)}${this.select('groupId','话术分类',gs,x.group_id||'')}${this.field('variables','变量名（逗号分隔）',x.variables||'username,nickname')}${this.field('content','消息内容',x.content||'','textarea',true)}${this.selectRaw('enabled','状态',this.opt('templateEnabled',[['true','启用'],['false','停用']]),x.enabled===false||x.enabled===0?'false':'true')}</div><div class="shell-note">没有分类时，可先在分组里新建「消息分组」。</div>`,async d=>{const id=d.id;delete d.id;d.groupId=d.groupId?Number(d.groupId):null;await this.api(id?`/message-templates/${id}`:'/message-templates',{method:id?'PUT':'POST',body:JSON.stringify(d)});this.toast(id?'消息模板已更新':'消息模板已创建');this.closeModal();await this.loadRefs();this.refresh()})},

  async renderTickets(){
    const host=document.querySelector('#content');
    if(!host)return;
    if(!this.canPermission('system.tickets')&&!this.canPermission('system.view')&&!this.canPermission('rbac.manage')){
      host.innerHTML=`<div class="panel"><div class="empty">当前角色无权处理工单</div></div>`;
      return;
    }
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
                      <button class="tiny" onclick="app.editTicketModalById(${t.id})">处理</button>
                      <button class="tiny danger" onclick="app.deleteTicket(${t.id},'${this.esc(t.ticketNo||t.id)}')">删除</button>
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
    try{
      const t=await this.api(`/tickets/${id}`);
      if(!t){this.toast('工单不存在',true);return;}
      this.editTicketModal(t);
    }catch(e){this.toast(e.message,true);}
  },
  async deleteTicket(id,no){
    if(!(await this.ask(`确定删除工单 ${no} 吗？`,'danger')))return;
    try{
      await this.api(`/tickets/${id}`,{method:'DELETE'});
      this.toast('工单已删除');
      this.refresh();
    }catch(e){this.toast(e.message,true);}
  },

  async renderVersions(){
    const host=document.querySelector('#content');
    if(!host)return;
    if(!this.canPermission('system.versions')&&!this.canPermission('system.view')&&!this.canPermission('rbac.manage')){
      host.innerHTML=`<div class="panel"><div class="empty">当前角色无权管理客户端版本</div></div>`;
      return;
    }
    try{
      const rows=await this.api('/client-versions');
      const list=Array.isArray(rows)?rows:[];
      const kw=(this.versionKeyword||'').trim().toLowerCase();
      const ch=String(this.versionChannel||'');
      const st=String(this.versionStatus||'');
      const filtered=list.filter(v=>{
        if(ch && String(v.channel||'')!==ch)return false;
        if(st && String(v.status||'')!==st)return false;
        if(kw && !String(v.version||'').toLowerCase().includes(kw) && !String(v.title||'').toLowerCase().includes(kw))return false;
        return true;
      });
      const pack=UI.paginateLocal(filtered,this.versionPage||1,20);
      this.versionPage=pack.page;
      host.innerHTML=`
        <div class="panel list-panel">
          <div class="matrix-action-bar">
            <div class="left"><span class="muted">共 ${filtered.length} / ${list.length} 个版本 · 上传 zip 后发布供 EXE 下载</span></div>
            <div class="right">
              <button class="primary tiny" type="button" onclick="app.editVersionModal()">新建版本</button>
            </div>
          </div>
          <div class="search-bar task-filter-bar">
            <select id="version-channel-filter" class="input" title="通道">
              <option value="">全部通道</option>
              <option value="stable" ${ch==='stable'?'selected':''}>正式 stable</option>
              <option value="beta" ${ch==='beta'?'selected':''}>测试 beta</option>
            </select>
            <select id="version-status-filter" class="input" title="状态">
              <option value="">全部状态</option>
              <option value="draft" ${st==='draft'?'selected':''}>草稿</option>
              <option value="published" ${st==='published'?'selected':''}>已发布</option>
              <option value="archived" ${st==='archived'?'selected':''}>已归档</option>
            </select>
            <input id="version-search" class="input" type="search" placeholder="搜索版本号 / 标题" value="${this.esc(this.versionKeyword||'')}" onkeydown="if(event.key==='Enter')app.searchVersions()">
            <button class="primary" type="button" onclick="app.searchVersions()">查询</button>
            <button class="ghost" type="button" onclick="app.resetVersions()">重置</button>
          </div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>版本号</th>
                  <th>标题</th>
                  <th>通道</th>
                  <th>包大小</th>
                  <th>状态</th>
                  <th>下载次数</th>
                  <th>更新时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                ${pack.items.length?pack.items.map(v=>`
                  <tr>
                    <td><b>#${v.id}</b></td>
                    <td><b>${this.esc(v.version)}</b>${v.is_latest||v.isLatest?' <span class="badge running">最新</span>':''}</td>
                    <td>${this.esc(v.title||'')}</td>
                    <td>${this.esc(v.channel||'stable')}</td>
                    <td>${v.has_file||v.file_size||v.fileSize?this.formatBytes(v.file_size||v.fileSize||0):'<span class="muted">未上传</span>'}</td>
                    <td>${this.badge(v.status==='published'?'online':(v.status==='archived'?'offline':'checking'))} <span class="muted">${this.esc(v.status||'')}</span></td>
                    <td>${v.download_count||v.downloadCount||0}</td>
                    <td class="muted">${this.esc(v.updated_at||'-')}</td>
                    <td style="white-space:nowrap">
                      <button class="tiny" onclick='app.editVersionModal(${JSON.stringify(v)})'>编辑</button>
                      <button class="tiny" onclick="app.uploadVersionPackage(${v.id})">上传包</button>
                      ${v.status!=='published'?`<button class="tiny primary" onclick="app.publishVersion(${v.id})">发布</button>`:''}
                      ${v.status==='published'&&!(v.is_latest||v.isLatest)?`<button class="tiny" onclick="app.setLatestVersion(${v.id})">设为最新</button>`:''}
                      <button class="tiny danger" onclick="app.deleteVersion(${v.id},'${this.esc(v.version)}')">删除</button>
                    </td>
                  </tr>
                `).join(''):`<tr><td colspan="9"><div class="empty">暂无版本，请先新建并上传 zip 代码包</div></td></tr>`}
              </tbody>
            </table>
          </div>
          ${UI.pager(pack,'versionPage')}
        </div>`;
    }catch(err){
      host.innerHTML=`<div class="panel list-panel"><div class="empty">加载版本失败: ${this.esc(err.message)}</div></div>`;
    }
  },
  searchVersions(){
    this.versionChannel=document.querySelector('#version-channel-filter')?.value||'';
    this.versionStatus=document.querySelector('#version-status-filter')?.value||'';
    this.versionKeyword=document.querySelector('#version-search')?.value?.trim()||'';
    this.versionPage=1;
    this.refresh();
  },
  resetVersions(){
    this.versionChannel='';
    this.versionStatus='';
    this.versionKeyword='';
    this.versionPage=1;
    this.refresh();
  },
  editVersionModal(v={}){
    this.modal(v.id?'编辑版本':'新建版本',`
      <div class="form-grid">
        <input type="hidden" name="id" value="${v.id||''}">
        ${this.field('version','版本号',v.version||'','text',true)}
        ${this.field('title','标题',v.title||'','text',true)}
        ${this.selectRaw('channel','发布通道',[['stable','正式 stable'],['beta','测试 beta']],v.channel||'stable')}
        ${this.selectRaw('status','状态',[['draft','草稿'],['published','已发布'],['archived','已归档']],v.status||'draft')}
        ${this.field('description','说明',v.description||'','textarea')}
        <div class="field full"><div class="muted">建议将前端 public + 本机 Node（src/package.json 等）打成 zip 上传。客服 EXE 会下载并解压到本机后启动。</div></div>
      </div>
    `,async(d)=>{
      const id=d.id; delete d.id;
      if(id) await this.api(`/client-versions/${id}`,{method:'PUT',body:JSON.stringify(d)});
      else await this.api('/client-versions',{method:'POST',body:JSON.stringify(d)});
      this.toast('版本已保存');
      this.closeModal();
      this.refresh();
    });
  },
  uploadVersionPackage(id){
    const input=document.createElement('input');
    input.type='file';
    input.accept='.zip,application/zip';
    input.onchange=async()=>{
      const file=input.files?.[0];
      if(!file)return;
      if(!/\.zip$/i.test(file.name)){this.toast('请上传 zip 文件',true);return;}
      const fd=new FormData();
      fd.append('file',file);
      try{
        this.toast('正在上传代码包…');
        await this.api(`/client-versions/${id}/upload`,{method:'POST',body:fd});
        this.toast('代码包已上传');
        this.refresh();
      }catch(e){this.toast(e.message,true);}
    };
    input.click();
  },
  async publishVersion(id){
    if(!(await this.ask('发布后客服客户端即可下载该版本，确认发布？')))return;
    try{
      await this.api(`/client-versions/${id}/publish`,{method:'POST',body:JSON.stringify({})});
      this.toast('版本已发布');
      this.refresh();
    }catch(e){this.toast(e.message,true);}
  },
  async setLatestVersion(id){
    try{
      await this.api(`/client-versions/${id}/latest`,{method:'POST',body:JSON.stringify({})});
      this.toast('已设为最新版本');
      this.refresh();
    }catch(e){this.toast(e.message,true);}
  },
  async deleteVersion(id,version){
    if(!(await this.ask(`确定删除版本 ${version} 及其代码包吗？`,'danger')))return;
    try{
      await this.api(`/client-versions/${id}`,{method:'DELETE'});
      this.toast('版本已删除');
      this.refresh();
    }catch(e){this.toast(e.message,true);}
  },

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
    this.warmEditId=editTask?.id||null;
    this._warmEditSnapshot=editTask||null;
    this.view='warm';
    this.refresh();
  },
  closeWarmCreate(){this.warmPane='list';this.warmEditId=null;this._warmEditSnapshot=null;this.refresh()},
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
    if(['queued','running','completed','failed','cancelled','paused','draft'].includes(x.status)){
      more.push(`<button type="button" onclick="app.taskDetailModal(${x.id})">详情</button>`);
      more.push(`<button type="button" onclick="app.exportTaskResultsCsv(${x.id})">结果 CSV</button>`);
      more.push(`<button type="button" onclick="app.taskPreview(${x.id})">预览</button>`);
      more.push(`<button type="button" onclick="app.preflightTask(${x.id})">执行前检查</button>`);
    }
    if(x.status==='failed')more.push(`<button type="button" onclick="app.retryTask(${x.id})">重试失败</button>`);
    const editBtn=canEdit?`<button class="tiny" type="button" title="编辑" onclick="app.editWarmTask(${x.id})">编辑</button>`:`<button class="tiny" type="button" title="编辑" disabled>编辑</button>`;
    const delBtn=`<button class="tiny danger" type="button" title="删除" onclick="app.remove('/tasks/${x.id}','养号任务')">删除</button>`;
    const moreBtn=more.length?`<div class="ops-dropdown task-ops-dropdown"><button class="tiny" type="button" title="更多" onclick="app.toggleTaskOps(${x.id},event)">…</button><div id="task-ops-${x.id}" class="dropdown-menu ops-menu hidden">${more.join('')}</div></div>`:'';
    return `<tr><td><input class="task-check" type="checkbox" value="${x.id}"></td><td><b>${this.esc(x.name)}</b></td><td>自动养号</td><td>${this.esc(x.group_name||'-')}</td><td><div class="progress"><i style="width:${pct}%"></i></div><span class="muted">${x.success_count}/${x.total_count}</span></td><td>${this.badge(x.status)}${this.nodeOwnedTaskHint(x.status,x.type)}</td><td>${this.esc(x.created_at)}</td><td><div class="task-ops-cell">${editBtn}${delBtn}${moreBtn}</div></td></tr>`;
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
    const p=edit?.payload||{};
    const selected=(p.accountIds||[]).map(Number);
    const accounts=(await this.api('/accounts?pageSize=500').catch(()=>({items:[]}))).items||[];
    const gs=this.accountGroupFlatOptions();
    const searchTypes=[['video','视频'],['top','Top'],['hashtag','Hashtag'],['user','用户主页'],['aweme','指定作品ID']];
    const st=p.searchType||'video';
    const scheduled=edit?.scheduled_at?new Date(edit.scheduled_at).toISOString().slice(0,16):'';
    const terms=Array.isArray(p.searchTerms)?p.searchTerms.join('\n'):(p.searchTerms||'');
    document.querySelector('#content').innerHTML=`<div class="panel warm-create-panel">
      <div class="task-io-head">
        <button class="ghost" type="button" onclick="app.closeWarmCreate()">← 返回养号列表</button>
        <div class="task-io-title-row">
          <b class="task-io-title">${edit?'编辑养号任务':'创建养号任务'}</b>
          <span class="muted">[TK] 自动养号 — 按配置搜索并刷互动；需账号已绑定比特环境且保持登录</span>
        </div>
      </div>
      <form id="warm-create-form" class="form-grid warm-form" onsubmit="return false">
        <input type="hidden" name="id" value="${edit?.id||''}">
        ${this.field('name','任务名称',edit?.name||`自动养号 ${new Date().toLocaleString('zh-CN',{hour12:false})}`,'text',true)}
        <div class="field full"><label>指定账号（可多选，留空则按分组）</label>
          <select name="accountIds" multiple size="8">${accounts.length?accounts.map(a=>`<option value="${a.id}" ${selected.includes(Number(a.id))?'selected':''}>#${a.id} · ${this.esc(a.username)} · ${this.esc(a.group_name||'未分组')}</option>`).join(''):'<option disabled>暂无账号</option>'}</select>
        </div>
        ${this.select('groupId','账号分组（未指定账号时生效）',gs,edit?.group_id||p.groupId||'')}
        ${this.field('searchTerms','搜索词（每行一个，或逗号分隔）',terms,'textarea',true)}
        <div class="field full"><label>搜索类型</label><div class="chip-row">${searchTypes.map(([c,l])=>`<label class="chip"><input type="radio" name="searchType" value="${c}" ${st===c?'checked':''}> ${this.esc(l)}</label>`).join('')}</div></div>
        ${this.rateField('followRate','关注概率(%)',p.followRate??10)}
        ${this.field('videoCountMin','刷视频数量(最小)',p.videoCountMin??10,'number',true)}
        ${this.field('videoCountMax','刷视频数量(最大)',p.videoCountMax??10,'number',true)}
        ${this.rateField('likeRate','点赞概率(%)',p.likeRate??30)}
        ${this.rateField('favoriteRate','收藏概率(%)',p.favoriteRate??10)}
        ${this.rateField('viewCommentRate','看评论概率(%)',p.viewCommentRate??20)}
        ${this.field('commentPages','看评论页数',p.commentPages??3,'number')}
        ${this.rateField('commentLikeRate','评论点赞概率(%)',p.commentLikeRate??20)}
        ${this.rateField('commentEnterRate','评论进入概率(%)',p.commentEnterRate??5)}
        ${this.field('matchKeywords','匹配关键词（命中才互动，可空）',p.matchKeywords||'','textarea')}
        ${this.field('staySecondsMin','视频停留时间(秒)最小',p.staySecondsMin??10,'number',true)}
        ${this.field('staySecondsMax','视频停留时间(秒)最大',p.staySecondsMax??20,'number',true)}
        ${this.field('threadCount','并发线程(1-3)',p.threadCount??1,'number')}
        ${this.field('scheduledAt','定时启动（可空）',scheduled,'datetime-local')}
        <div class="field full action-bar" style="margin-top:8px">
          <button class="primary" type="button" onclick="app.submitWarmTask(true)">${edit?'保存并启动':'创建并启动'}</button>
          <button class="ghost" type="button" onclick="app.submitWarmTask(false)">${edit?'仅保存':'创建为草稿'}</button>
          <button class="ghost" type="button" onclick="app.closeWarmCreate()">取消</button>
        </div>
      </form>
    </div>`;
  },
  async submitWarmTask(autoStart){
    if(!this.canWarmTasks()){this.toast('当前角色无权管理养号任务',true);return}
    const form=document.querySelector('#warm-create-form');
    if(!form)return;
    if(!(await this.ensureBitOnline('自动养号')))return;
    const fd=new FormData(form);
    const d=Object.fromEntries(fd.entries());
    const accountIds=[...form.querySelector('[name="accountIds"]')?.selectedOptions||[]].map(o=>Number(o.value)).filter(Boolean);
    const searchType=(form.querySelector('[name=searchType]:checked')||{}).value||'video';
    const searchTerms=String(d.searchTerms||'').trim();
    if(!searchTerms){this.toast('请填写搜索词',true);return}
    if(!accountIds.length&&!d.groupId){this.toast('请指定账号或选择账号分组',true);return}
    const payload={
      accountIds:accountIds.length?accountIds:undefined,
      searchType,
      searchTerms,
      matchKeywords:d.matchKeywords||'',
      videoCountMin:Number(d.videoCountMin||10),
      videoCountMax:Number(d.videoCountMax||10),
      followRate:Number(d.followRate||0),
      likeRate:Number(d.likeRate||0),
      favoriteRate:Number(d.favoriteRate||0),
      viewCommentRate:Number(d.viewCommentRate||0),
      commentPages:Number(d.commentPages||0),
      commentLikeRate:Number(d.commentLikeRate||0),
      commentEnterRate:Number(d.commentEnterRate||0),
      staySecondsMin:Number(d.staySecondsMin||10),
      staySecondsMax:Number(d.staySecondsMax||20),
      threadCount:Number(d.threadCount||1),
    };
    let totalCount=accountIds.length;
    const groupId=(!accountIds.length&&d.groupId)?Number(d.groupId):null;
    if(!totalCount&&groupId){
      totalCount=(this.groups||[]).find(g=>Number(g.id)===groupId)?.member_count
        ||(await this.api(`/accounts?pageSize=1&groupId=${groupId}`).catch(()=>({}))).total
        ||0;
    }
    const body={
      name:d.name||'自动养号',
      type:'warm',
      groupId,
      totalCount:Number(totalCount)||0,
      scheduledAt:d.scheduledAt?new Date(d.scheduledAt).toISOString():null,
      payload,
    };
    try{
      const id=Number(d.id||0);
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
      this.warmEditId=null;
      this._warmEditSnapshot=null;
      this.refresh();
    }catch(e){this.toast(e.message,true)}
  },
  /** @deprecated 养号已抽离到独立页面，保留空实现防旧入口报错 */
  async warmAccountsModal(){
    this.toast('请从「账号池管理 → 自动养号」创建养号任务');
    this.openWarmCreate();
  },

};

window.app=app;
