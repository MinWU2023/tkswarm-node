const app = {
  view: 'accounts', meta: null, groups: [], proxies: [], materials: [], templates: [], groupType: 'account', taskRefreshTimer: null, warmRefreshTimer: null, accountWorkRefreshTimer: null, warmPane: 'list', warmPage: 1, warmKeyword: '', warmStatusFilter: '', warmEditId: null, aiLeadsPane: 'list', aiLeadsPage: 1, aiLeadsKeyword: '', aiLeadsStatus: '', aiLeadsEditId: null, aiLeadsDetailId: null, aiLeadsDetailTab: 'accounts', msgTplType: 'comment', msgTplKeyword: '', accountWorkPage: 1, accountWorkKeyword: '', accountWorkStatus: '', accountWorkAccountId: '', accountPane: 'list', accountIoTab: 'export', accountGroupId: '', accountCapcut: '', accountSession: '', accountPage: 1, accountKeyword: '', accountStatus: '', proxyGroupId: '', proxyPage: 1, proxyPane: 'list', proxyIoTab: 'export', proxyKeyword: '', proxyStatus: '', materialPage: 1, materialKeyword: '', materialStatus: '', materialPublishStatus: '', materialTags: '', uidPage: 1, agentPage: 1, templatePage: 1, taskPage: 1, massPage: 1, groupPage: 1, rbacPermPage: 1, rbacRolePage: 1, rbacRoleKeyword: '', rbacRoleStatus: '', rbacUserPage: 1, rbacUserKeyword: '', rbacUserStatus: '', rbacLogPage: 1, rbacLogKeyword: '', rbacMenuPage: 1, rbacMenuKeyword: '', rbacMenuVisible: '', helpDocPage: 1, helpCatPage: 1, helpDocsTab: 'docs', helpDocsCatId: '', helpDocKeyword: '', helpDocStatus: '', helpCatKeyword: '', ticketPage: 1, ticketStatus: '', ticketKeyword: '', versionPage: 1, versionKeyword: '', versionChannel: '', versionStatus: '', browserPage: 1, matrixTab: 'tasks', wizardOpen: false, wizardStep: 1, wizard: {}, massWizardOpen: false, mass: {step:1,massChannel:'bit'}, uidGroupId: '', uidKeyword: '', chatPane: 'workbench',
  chatAccountId: null, chatFriendId: null, chatFilter: 'all', chatKeyword: '', scriptGroupId: '',
  agentId: null, agentForm: null, agentKeyword: '', agentTab: 'basic', testChat: [],
  titles: {accounts:['账号管理','维护 TikTok 账号、分组与浏览器环境'],groups:['分组管理','账号分组与公司子组的增删改查'],warm:['自动养号','按任务创建养号配置，批量执行刷互动养号'],msgTemplates:['消息模板','评论 / 回复评论 / 私信 / 回复私信：每条为固定文案或 AI 提示词'],accountWork:['任务汇总','按账号查看会话总任务与子任务，支持展开与暂停'],aiLeads:['AI拓客','配置拓客规则、关联账号与私信明细'],proxies:['代理IP','管理代理池并检测连通性'],agent:['AI智能体','选择开放平台与模型，配置语言风格'],publish:['AI矩阵','创建并执行视频发布任务'],chat:['客服聊天','多账号聚合私信'],uids:['UID好友','客服群发目标 UID 池，按分组导入与维护'],logs:['实时操作日志','WebSocket 实时链路与系统级动作事件流'],rbac:['权限管理','权限节点、角色、管理员与审计菜单'],settings:['基础设置','配置浏览器、任务、发布确认与翻译'],versions:['版本控制','上传与管理客服客户端代码包，供 EXE 下载安装'],helpDocs:['帮助文档','维护客户端帮助分类与文档内容'],tickets:['工单处理','查看并回复客服客户端提交的工单反馈'],envInstallers:['环境安装包','管理 Node / 比特等本机环境安装包'],aiPlatform:['AI开放平台','配置国内外 AI 平台与多套开发密钥，启用全局调用配置'],aiPromptTemplates:['AI提示词模板','维护提示词模板，支持不同模板的 {{变量}} 占位与渲染预览'],aiCallLogs:['AI记录','查看 AI 平台调用日志：平台、配置、用户、操作、体积与请求响应'],system:['系统管理','基础设置、开发管理、AI开放平台、帮助与工单']},
  async api(path, options={}) {
    let apiBase = window.TKSWARM_API_BASE || window.__TKSWARM_CONFIG__?.defaultApiBase || 'http://tkswarm-api.dyyweb.com';
    // 仅比特自动化 / 本机能力走同源 Node；业务数据一律走线上 PHP
    const useLocalNode = /^\/(browser|system|audio|uploads|executor)(\/|$)/.test(path)
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
  badge(status){const map=this.meta?.statusLabels||{online:'在线',offline:'离线',expired:'已过期',checking:'检查中',connecting:'连接中',available:'可用',unavailable:'不可用',unchecked:'未检测',draft:'草稿',queued:'排队中',running:'运行中',paused:'已暂停',completed:'已完成',failed:'失败',cancelled:'已取消',deleted:'已删除',success:'成功',skipped:'跳过',pending:'待发布',publishing:'发布中',error:'异常'};return `<span class="badge ${status}">${map[status]||this.esc(status)}</span>`},
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
      // 悬停离开收起；移入其他一级菜单可再展开（刚点过的项短时锁定）
      navEl.addEventListener('pointerover',(e)=>{
        const root=e.target.closest&&e.target.closest('.nav-item-root');
        if(root) this.allowNavFlyouts(root);
      });
      navEl.addEventListener('mouseleave',()=>{
        clearTimeout(this._navCloseTimer);
        this._navCloseTimer=setTimeout(()=>this.closeNavFlyouts(),80);
      });
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
    if(/营销|拓客|aiLeads/i.test(t)||v==='aiLeads')return 'sparkles';
    if(/矩阵|发布|视频|素材/.test(t)||v==='publish'||v==='materials')return 'video';
    if(/客服|聊天|会话/.test(t)||v==='chat')return 'message';
    if(/权限|角色|审计/.test(t)||v==='rbac')return 'shield';
    if(/系统管理|设置|版本|工单|帮助|安装包|开放平台|AI平台|提示词|AI记录/.test(t)||v==='settings'||v==='versions'||v==='helpDocs'||v==='tickets'||v==='envInstallers'||v==='aiPlatform'||v==='aiPromptTemplates'||v==='aiCallLogs')return 'settings';
    if(/日志/.test(t)||v==='logs')return 'file-text';
    if(/分组/.test(t)||v==='groups')return 'folder';
    if(/养号|warm/i.test(t)||v==='warm')return 'activity';
    if(/消息模板|msgTemplates/i.test(t)||v==='msgTemplates')return 'message';
    if(/任务汇总|accountWork/i.test(t)||v==='accountWork')return 'list';
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
        ||(root.view==='accounts'&&['warm','groups','accountWork','proxies'].includes(this.view))
        ||(root.view==='agent'&&['msgTemplates'].includes(this.view))
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
    if(window.TkIcons?.createIcons) window.TkIcons.createIcons(nav);
    else if(window.UI?.refreshIcons) window.UI.refreshIcons(nav);
  },
  closeNavFlyouts(lockRoot){
    clearTimeout(this._navCloseTimer);
    const nav=document.querySelector('#nav');
    if(!nav)return;
    nav.classList.add('nav-force-closed');
    nav.querySelectorAll('.nav-item-root').forEach(el=>el.classList.add('nav-force-closed'));
    this._navFlyoutLockRoot=lockRoot||null;
    this._navFlyoutLockUntil=Date.now()+320;
    try{
      const ae=document.activeElement;
      if(ae&&nav.contains(ae)&&typeof ae.blur==='function')ae.blur();
    }catch{}
  },
  allowNavFlyouts(enterRoot){
    clearTimeout(this._navCloseTimer);
    const lockedUntil=this._navFlyoutLockUntil||0;
    if(Date.now()<lockedUntil){
      // 刚点过的同一一级菜单短时不自动再开；移到其他一级菜单可开
      if(!enterRoot)return;
      if(this._navFlyoutLockRoot&&enterRoot===this._navFlyoutLockRoot)return;
    }
    this._navFlyoutLockUntil=0;
    this._navFlyoutLockRoot=null;
    const nav=document.querySelector('#nav');
    if(!nav)return;
    nav.classList.remove('nav-force-closed');
    nav.querySelectorAll('.nav-item-root.nav-force-closed').forEach(el=>el.classList.remove('nav-force-closed'));
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
    // 点选即收起下拉（含 focus-within 残留）
    const lockRoot=event?.target?.closest?.('.nav-item-root')||null;
    this.closeNavFlyouts(lockRoot);
    // 同页矩阵 Tab 软切：不要抬 gen / 清 soft timer，否则会打断缓存命中路径
    const softPublish=view==='publish'&&this.view==='publish'
      &&['','tasks','list','mass','materials','material','material_import','folder_materials','import'].includes(subview);
    if(!softPublish){
      clearTimeout(this._matrixSoftTimer);
      this._matrixSwitchGen=(this._matrixSwitchGen||0)+1;
    }
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
    const children=this.authChildren||[];
    const acting=this.authActingAs;
    const actingId=this.getActingAsId();
    const showScope=!!(self&&self.id&&(this.authIsSuper||children.length>0));
    const execOn=this.isExecutorEnabled();
    box.classList.remove('hidden');

    const selfLabel=this.esc((self&&(self.nickname||self.username))||'本人');
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
    const scopeBtn=showScope?`
      <button type="button" class="scope-trigger" onclick="app.toggleScopePanel()" id="scope-trigger-btn" title="切换数据身份">
        <span class="scope-dot"></span>
        <span class="scope-label">${currentLabel}</span>
        <span class="scope-caret">▴</span>
      </button>`:'';
    const scopePanel=showScope?`
      <div class="scope-panel hidden" id="scope-panel">
        <div class="scope-panel-title">切换数据身份</div>
        <button type="button" class="scope-item ${!actingId?'active':''}" onclick="app.switchActingAs(null)">
          <b>${this.authIsSuper?'查看全部（超管）':'本人数据'}</b>
          <span>${selfLabel}</span>
        </button>
        ${childBtns?`<div class="scope-section">子级账号</div>${childBtns}`:''}
        ${superExtra}
      </div>`:'';

    box.innerHTML=`
      <div class="scope-dock">
        <div class="scope-dock-tools">
          <button type="button" class="executor-toggle ${execOn?'is-on':''}" id="executor-toggle-btn"
            onclick="app.toggleExecutorEnabled()" title="${execOn?'任务执行中：点击关闭':'已关闭：点击开启任务执行'}">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              ${execOn
                ? '<rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/>'
                : '<polygon points="7 4 20 12 7 20 7 4"/>'}
            </svg>
          </button>
          <button type="button" class="scope-tool-btn" id="scope-work-list-btn"
            onclick="app.navigate('accountWork')" title="打开任务汇总列表">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </button>
        </div>
        ${scopeBtn}
      </div>
      ${scopePanel}`;
    if(this.authIsSuper&&showScope) this.loadScopeUserOptions();
    this.syncExecutorWsStatus();
  },
  isExecutorEnabled(){
    return localStorage.getItem('tkswarm_executor_enabled')==='1';
  },
  setExecutorEnabled(on){
    localStorage.setItem('tkswarm_executor_enabled', on?'1':'0');
    this.executorEnabled=!!on;
    this.syncExecutorWsStatus();
    this.renderScopeSwitcher();
    this.toast(on?'已开启任务执行：将通过 WSS 接收任务并调用比特执行':'已关闭任务执行：不再接单');
    if(on) this.api('/executor/poll',{method:'POST',body:'{}'}).catch(()=>{});
  },
  toggleExecutorEnabled(){
    this.setExecutorEnabled(!this.isExecutorEnabled());
  },
  syncExecutorWsStatus(){
    const on=this.isExecutorEnabled();
    this.executorEnabled=on;
    if(this.ws&&this.ws.readyState===1){
      const userId=Number(this.authUser?.id||0);
      const actingAs=this.getActingAsId()||'';
      const ownerId=Number(actingAs||userId||0);
      this.ws.send(JSON.stringify({
        type:'executor-status',
        enabled:on,
        userId,
        ownerId,
        actingAs:actingAs?String(actingAs):'',
        token:this.authToken||'',
      }));
      this.ws.send(JSON.stringify({
        type:'executor-busy',
        running:this._executorRunning||0,
        batchIds:[...(this._executorBatchIds||[])],
      }));
    }
  },
  async handleWorkPush(payload){
    const batch=payload?.batch||payload;
    if(!batch||!batch.id)return;
    if(!this.isExecutorEnabled()){
      this.toast(`收到任务 #${batch.id} 但执行已关闭，已忽略`,true);
      return;
    }
    const batchId=Number(batch.id);
    this._executorBatchIds=this._executorBatchIds||[];
    if(this._executorBatchIds.includes(batchId))return;
    // 本机最多 3 路：已满则忽略此次推送（Node 侧也会按槽位控制）
    if((this._executorRunning||0)>=3){
      this.toast(`收到任务 #${batchId}，但本机已满 3 路执行中，稍后再领`,true);
      return;
    }
    const acc=batch.account||{};
    const taskLabel=String(payload?.taskLabel||batch.task_label||batch.taskLabel||'').trim();
    const labelPart=taskLabel?` · ${taskLabel}`:'';
    this.toast(`收到任务 #${batchId}${labelPart} · ${acc.username||('账号#'+(batch.account_id||''))}，正在调比特执行…`);
    this._executorBatchIds.push(batchId);
    this._executorRunning=(this._executorRunning||0)+1;
    this.syncExecutorWsStatus();
    try{
      await this.api('/executor/run',{method:'POST',body:JSON.stringify({batch})});
      // 真正结束由 Node 回 work-done；这里不提前减计数，避免空槽被重复推送
    }catch(e){
      this.toast(e.message||'启动执行失败',true);
      this._executorBatchIds=this._executorBatchIds.filter((id)=>id!==batchId);
      this._executorRunning=Math.max(0,(this._executorRunning||1)-1);
      this.syncExecutorWsStatus();
    }
  },
  onExecutorWorkDone(data){
    const batchId=Number(data?.batchId||0);
    if(!batchId)return;
    this._executorBatchIds=(this._executorBatchIds||[]).filter((id)=>id!==batchId);
    this._executorRunning=Math.max(0, this._executorBatchIds.length);
    this.syncExecutorWsStatus();
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
    return this.dictPairs(this.meta?.permModules, [['account','账号'],['proxy','代理'],['agent','智能体'],['publish','发布'],['chat','客服'],['rbac','权限'],['system','系统']]);
  },
  languagePairs(includeAuto=true){
    const rows=(this.meta?.languages||[]).filter(x=>includeAuto||x.code!=='auto');
    return this.dictPairs(rows, [['zh','中文'],['en','英文']]);
  },
  uiLanguagePairs(){
    return this.dictPairs(this.meta?.uiLanguages, [['zh-CN','简体中文']]);
  },
  replyTonePairs(){
    return this.dictPairs(this.meta?.replyTones, [
      ['friendly','亲切友好'],['professional','专业稳重'],['humor','幽默风趣'],
      ['casual','口语轻松'],['concise','简洁克制'],
    ]);
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
        <div class="brand"><img class="brand-logo" src="/images/logo.png?v=2" alt="第一页科技 TkSwarm" width="168" height="64"></div>
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
  async loadRefs(opts={}){
    const force=!!opts.force;
    const ttl=Math.max(5000, Number(opts.ttl)||30000);
    if(!force&&this._refsAt&&(Date.now()-this._refsAt)<ttl&&Array.isArray(this.groups))return;
    const [groups,proxyCatalog,materials,templates]=await Promise.all([
      this.api('/groups'),
      this.loadProxyCatalog({force:true}),
      this.api('/materials'),
      this.api('/message-templates')
    ]);
    this.groups=groups;
    // proxyCatalog 供账号编辑等下拉；勿与代理列表页的 this.proxies（当前页）混用
    this.proxyCatalog=proxyCatalog;
    this.materials=materials;this.templates=templates;
    this._refsAt=Date.now();
  },
  /** 当前有效身份（切换子账号时用被切换用户） */
  effectiveOwnerId(){
    const acting=Number(this.getActingAsId()||0);
    if(acting>0)return acting;
    return Number(this.authUser?.id||0);
  },
  invalidateProxyCatalog(){
    this._proxyCatalogCache={};
    this._proxyCatalogAt=0;
    this._proxyCatalogOwnerId=null;
    this.proxyCatalog=[];
  },
  /**
   * 拉取代理库全量（分页合并，上限 API pageSize=500）。
   * opts.ownerId：按归属用户过滤（创建=当前用户；编辑=被编辑账号的 owner）。
   * 与代理管理页当前页 this.proxies 分离，避免编辑账号时只剩 20 条。
   */
  async loadProxyCatalog(opts={}){
    const force=!!opts.force;
    const ttl=Math.max(10000, Number(opts.ttl)||60000);
    const ownerId=opts.ownerId!=null&&opts.ownerId!==''?Number(opts.ownerId):0;
    const cacheKey=ownerId>0?`o:${ownerId}`:'scope';
    this._proxyCatalogCache=this._proxyCatalogCache||{};
    const hit=this._proxyCatalogCache[cacheKey];
    if(!force&&hit&&Array.isArray(hit.items)&&hit.at&&(Date.now()-hit.at)<ttl){
      this.proxyCatalog=hit.items;
      this._proxyCatalogAt=hit.at;
      this._proxyCatalogOwnerId=ownerId||null;
      return hit.items;
    }
    const pageSize=500;
    let page=1;
    let items=[];
    let total=Infinity;
    const ownerQs=ownerId>0?`&ownerId=${ownerId}`:'';
    while(items.length<total&&page<=40){
      const d=await this.api(`/proxies?page=${page}&pageSize=${pageSize}${ownerQs}`);
      const chunk=Array.isArray(d?.items)?d.items:[];
      total=Number(d?.total??chunk.length);
      items=items.concat(chunk);
      if(!chunk.length||chunk.length<pageSize)break;
      page+=1;
    }
    const at=Date.now();
    this._proxyCatalogCache[cacheKey]={items,at};
    this.proxyCatalog=items;
    this._proxyCatalogAt=at;
    this._proxyCatalogOwnerId=ownerId||null;
    return items;
  },
  async ensureProxyCatalog(opts={}){
    try{return await this.loadProxyCatalog(opts);}catch{return this.proxyCatalog||[];}
  },
  /** 账号编辑 / 分配代理等下拉选项（来自代理库全量） */
  proxySelectItems(list){
    const src=Array.isArray(list)&&list.length
      ?list
      :((Array.isArray(this.proxyCatalog)&&this.proxyCatalog.length)
        ?this.proxyCatalog
        :(Array.isArray(this.proxies)?this.proxies:[]));
    return src.map(p=>{
      const host=p.host||'';
      const port=p.port?`:${p.port}`:'';
      const country=p.country?` · ${p.country}`:'';
      const st=p.status&&p.status!=='unchecked'?` · ${p.status}`:'';
      return {id:p.id,name:`${p.name||host} · ${host}${port}${country}${st}`};
    });
  },
  /** 渲染代理 <option> 列表（可保留当前选中） */
  proxySelectOptionsHtml(proxyItems, selectedId){
    const sel=selectedId!=null&&selectedId!==''?String(selectedId):'';
    const opts=['<option value="">不绑定代理</option>'];
    for(const p of proxyItems||[]){
      const id=String(p.id);
      opts.push(`<option value="${this.esc(id)}" ${sel&&sel===id?'selected':''}>${this.esc(p.name)}</option>`);
    }
    return opts.join('');
  },
  async refillProxySelect(selectEl, ownerId, keepSelected){
    if(!selectEl)return;
    const prev=keepSelected?String(selectEl.value||''):'';
    const oid=Number(ownerId||0);
    const list=await this.ensureProxyCatalog({force:true,ownerId:oid>0?oid:this.effectiveOwnerId()});
    const items=this.proxySelectItems(list);
    selectEl.innerHTML=this.proxySelectOptionsHtml(items, prev);
    if(prev&&![...selectEl.options].some(o=>o.value===prev)){
      selectEl.value='';
    }
  },
  /** 仅保证分组可用，避免切页时被 materials/templates 拖死 */
  async ensureGroups(opts={}){
    const ttl=Math.max(5000, Number(opts.ttl)||30000);
    if(!opts.force&&this._groupsAt&&Array.isArray(this.groups)&&(Date.now()-this._groupsAt)<ttl)return this.groups;
    try{
      this.groups=await this.api('/groups');
      this._groupsAt=Date.now();
      this._refsAt=this._refsAt||this._groupsAt;
    }catch(e){
      if(!Array.isArray(this.groups))this.groups=[];
      throw e;
    }
    return this.groups;
  },
  /** 账号分组扁平选项（养号/账号弹窗等共用，不依赖 accounts 页脚本） */
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
  /**
   * 选账号工具栏：左侧分组下拉 + 关键词搜索 + 批量按钮
   * boxId 对应账号网格 id（如 mass-accounts）；搜索框 id 为 `${boxId}-search`
   */
  accountPickToolbarHtml(boxId, opts={}){
    const gs=this.accountGroupFlatOptions();
    const groupOpts=`<option value="">全部分组</option><option value="none">未分组</option>${gs.map(g=>`<option value="${g.id}">${this.esc(g.name)}</option>`).join('')}`;
    const batch=opts.batchHtml||'';
    return `<div class="account-pick-toolbar">
      <select class="input account-pick-group" id="${boxId}-group-filter" title="按分组筛选" onchange="app.filterAccountPick('${boxId}')">${groupOpts}</select>
      <input class="input account-pick-search" id="${boxId}-search" type="search" placeholder="搜索账号 ID 或用户名" oninput="app.filterAccountPick('${boxId}')">
      <span class="muted" id="${boxId}-search-hint"></span>
      <div class="action-bar" style="margin:0">${batch}</div>
    </div>`;
  },
  /** 账号选择标签（含 data-group，供分组筛选） */
  accountPickTagHtml(a, selected, opts={}){
    const id=Number(a.id);
    const on=selected instanceof Set?selected.has(id):!!selected;
    const uname=String(a.username||'');
    const gid=a.group_id!=null&&a.group_id!==''?String(a.group_id):'';
    const onclick=opts.onclick||`app.toggleAccountPickTag(this)`;
    return `<div role="button" tabindex="0" class="account-pick-tag ${on?'is-on':''}" data-id="${id}" data-name="${this.esc(uname)}" data-group="${this.esc(gid)}" onclick="${onclick}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${onclick}}" title="#${id} ${this.esc(uname)}"><span class="apt-id">#${id}</span><span class="apt-name">${this.esc(uname)}</span></div>`;
  },
  /** 通用账号标签点选（发布向导可覆盖以加入数量限制） */
  toggleAccountPickTag(el){
    if(!el||el.classList.contains('is-filtered-out'))return;
    el.classList.toggle('is-on');
  },
  /** 按分组下拉 + 关键词筛选账号选择网格 */
  filterAccountPick(boxId, keyword){
    const box=document.querySelector('#'+boxId);
    if(!box)return;
    const searchEl=document.querySelector('#'+boxId+'-search');
    const groupEl=document.querySelector('#'+boxId+'-group-filter');
    const q=keyword!=null?String(keyword).trim().toLowerCase():String(searchEl?.value||'').trim().toLowerCase();
    const groupVal=String(groupEl?.value||'').trim();
    box.querySelector('.account-pick-empty')?.remove();
    let visible=0;
    box.querySelectorAll('.account-pick-tag').forEach(el=>{
      const id=String(el.getAttribute('data-id')||'');
      const name=String(el.getAttribute('data-name')||'').toLowerCase();
      const g=String(el.getAttribute('data-group')||'');
      const kwHit=!q||id.includes(q)||name.includes(q);
      const groupHit=!groupVal
        ||(groupVal==='none'?(!g||g==='0'):(g===groupVal));
      const hit=kwHit&&groupHit;
      el.classList.toggle('is-filtered-out',!hit);
      if(hit)visible+=1;
    });
    if(!visible){
      const tip=document.createElement('div');
      tip.className='muted account-pick-empty';
      tip.style.cssText='padding:12px;grid-column:1/-1';
      tip.textContent=(q||groupVal)?'没有匹配的账号':'暂无账号';
      box.appendChild(tip);
    }
    const hint=document.querySelector('#'+boxId+'-search-hint');
    if(hint)hint.textContent=(q||groupVal)?`已筛选 ${visible} 个`:'';
  },
  selectedAccountPickIds(boxId){
    return [...document.querySelectorAll('#'+boxId+' .account-pick-tag.is-on')]
      .map(el=>Number(el.getAttribute('data-id')))
      .filter(Boolean);
  },
  setAccountPickAll(boxId, all){
    document.querySelectorAll('#'+boxId+' .account-pick-tag').forEach(el=>{
      if(el.classList.contains('is-filtered-out'))return;
      el.classList.toggle('is-on',!!all);
    });
  },
  invertAccountPick(boxId){
    document.querySelectorAll('#'+boxId+' .account-pick-tag').forEach(el=>{
      if(el.classList.contains('is-filtered-out'))return;
      el.classList.toggle('is-on');
    });
  },
  showPageShell(view){
    const content=document.querySelector('#content');
    if(!content)return;
    content.classList.toggle('chat-mode', view==='chat'&&(this.chatPane||'workbench')!=='uids');
    const head=this.pageHead(view)||'';
    content.innerHTML=`${head}<div class="panel page-shell-loading" data-page-shell="${this.esc(view)}" style="margin:0">
      <div style="padding:72px 24px;text-align:center">
        <div class="ep-spinner" aria-hidden="true" style="margin:0 auto 14px;width:40px;height:40px">
          <svg viewBox="25 25 50 50" width="40" height="40"><circle cx="50" cy="50" r="20" fill="none" stroke-width="4"></circle></svg>
        </div>
        <div class="muted">正在加载页面…</div>
      </div>
    </div>`;
  },
  pageRenderStill(view, gen){
    return ()=>this.view===view&&this._navGen===gen;
  },
  syncNavActive(view){
    document.querySelectorAll('#nav [data-view]').forEach(b=>{
      const bv=b.dataset.view;
      const on=bv===view
        ||(bv==='settings'&&['versions','helpDocs','tickets','envInstallers','aiPlatform','aiPromptTemplates','aiCallLogs'].includes(view))
        ||(bv==='accounts'&&['warm','groups','accountWork','proxies'].includes(view))
        ||(bv==='agent'&&['msgTemplates'].includes(view));
      b.classList.toggle('active', on);
    });
    document.querySelectorAll('.nav-item-root').forEach(el=>{
      const btn=el.querySelector('.nav-root-btn');
      const rootView=btn?.getAttribute('data-nav-view')||'';
      const isCur=rootView===view
        ||(rootView==='settings'&&['versions','helpDocs','tickets','envInstallers','aiPlatform','aiPromptTemplates','aiCallLogs'].includes(view))
        ||(rootView==='accounts'&&['warm','groups','accountWork','proxies'].includes(view))
        ||(rootView==='agent'&&['msgTemplates'].includes(view))
        ||(el.querySelector(`[data-nav-view="${view}"]`)!=null);
      el.classList.toggle('active',isCur);
      btn?.classList.toggle('active',isCur);
    });
  },
  async navigate(view, subview=''){
    if(!this.canView(view)){this.toast('当前角色无权访问该模块',true);return}
    if(view!=='chat')this.stopChatSyncTimer?.();
    const prevView=this.view;
    subview=String(subview||'');

    // AI矩阵内部 Tab：已在 publish 页时走软切换，避免整页 invalidate+重绘
    if(view==='publish'&&prevView==='publish'&&typeof this.switchMatrix==='function'){
      const softMap={
        '':'tasks',tasks:'tasks',list:'tasks',mass:'tasks',
        materials:'materials',material:'materials',
        material_import:'materialImport',folder_materials:'materialImport',import:'materialImport'
      };
      if(Object.prototype.hasOwnProperty.call(softMap,subview)){
        this.view='publish';
        this.wizardOpen=false;
        this.massWizardOpen=false;
        this.deleteWizardOpen=false;
        this.commentReplyWizardOpen=false;
        if(subview==='mass'){this.taskTypeFilter='publish';this.taskModeFilter='ordered'}
        else if(subview==='tasks'||subview===''||subview==='list'){this.taskTypeFilter='';this.taskModeFilter=''}
        this.syncNavActive('publish');
        const [pageTitle]=this.viewPageMeta('publish');
        if(pageTitle) document.title=`${pageTitle} - TKSwarm`;
        const tab=softMap[subview];
        if(tab==='materialImport'){
          this.matrixTab='materialImport';
          await this.refresh({keepMatrixCache:true});
          return;
        }
        this.switchMatrix(tab);
        return;
      }
    }

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
    } else if(view==='aiLeads'){
      if(subview==='create'){this.aiLeadsPane='create';this.aiLeadsEditId=null;this.aiLeadsDetailId=null}
      else if(subview==='detail'||subview.startsWith('detail/')){
        const parts=String(subview).replace(/^detail\/?/,'').split('/').filter(Boolean);
        const id=Number(parts[0]||0)||0;
        const tab=parts[1]||'accounts';
        this.aiLeadsPane='detail';this.aiLeadsDetailId=id||null;
        this.aiLeadsDetailTab=['accounts','creators','logs','records','daily'].includes(tab)?tab:'accounts';
      } else {this.aiLeadsPane='list';this.aiLeadsEditId=null;this.aiLeadsDetailId=null;this.aiLeadsDetailTab='accounts'}
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
    } else if(view==='publish'){
      clearTimeout(this._matrixSoftTimer);
      // 不再整表清空缓存；仅目标 Tab 在数据变更时由业务侧 invalidate
      if(subview==='tasks'||subview===''||subview==='list'){this.matrixTab='tasks';this.taskTypeFilter='';this.taskModeFilter='';this.wizardOpen=false;this.massWizardOpen=false;this.deleteWizardOpen=false;this.commentReplyWizardOpen=false;}
      else if(subview==='create_publish'||subview==='random'){this.deleteWizardOpen=false;this.commentReplyWizardOpen=false;this.openPublishWizard('random',{skipRefresh:true});}
      else if(subview==='create_ordered'||subview==='create_mass'||subview==='ordered'){this.deleteWizardOpen=false;this.commentReplyWizardOpen=false;this.openPublishWizard('ordered',{skipRefresh:true});}
      else if(subview==='mass'){this.matrixTab='tasks';this.taskTypeFilter='publish';this.taskModeFilter='ordered';this.wizardOpen=false;this.massWizardOpen=false;this.deleteWizardOpen=false;this.commentReplyWizardOpen=false;}
      else if(subview==='create_independent'||subview==='independent'){this.deleteWizardOpen=false;this.commentReplyWizardOpen=false;this.openPublishWizard('independent',{skipRefresh:true});}
      else if(subview==='delete_wizard'||subview==='create_delete'||subview==='delete'){this.wizardOpen=false;this.massWizardOpen=false;this.commentReplyWizardOpen=false;this.openDeleteWizard({skipRefresh:true});}
      else if(subview==='comment_reply_wizard'||subview==='create_comment_reply'||subview==='comment_reply'){this.wizardOpen=false;this.massWizardOpen=false;this.deleteWizardOpen=false;this.openCommentReplyWizard({skipRefresh:true});}
      else if(subview==='materials'||subview==='material'){this.matrixTab='materials';this.wizardOpen=false;this.massWizardOpen=false;this.deleteWizardOpen=false;this.commentReplyWizardOpen=false;}
      else if(subview==='material_import'||subview==='folder_materials'||subview==='import'){this.matrixTab='materialImport';this.wizardOpen=false;this.massWizardOpen=false;this.deleteWizardOpen=false;this.commentReplyWizardOpen=false;}
      else if(subview==='uids'||subview==='uid'){return this.navigate('chat','uids')}
      else {this.matrixTab='tasks';this.wizardOpen=false;this.massWizardOpen=false;this.deleteWizardOpen=false;this.commentReplyWizardOpen=false;}
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

    this.syncNavActive(view);

    {
      const metaKey=(view==='chat'&&this.chatPane==='uids')?'uids':view;
      const [pageTitle]=this.viewPageMeta(metaKey);
      if(pageTitle) document.title=`${pageTitle} - TKSwarm`;
    }

    // 跨页：优先复用 router 已画好的壳与 _navGen；同页刷新另起代次且不闪壳
    let gen=this._navGen||0;
    if(prevView!==view){
      const shell=document.querySelector('#content .page-shell-loading');
      const shellView=shell?.getAttribute('data-page-shell')||'';
      if(shellView!==view){
        gen=++this._navGen;
        this.showPageShell(view);
      }
    }else{
      gen=++this._navGen;
    }
    await this.refresh({navGen:gen});
  },
  pageHead(view){
    if(view==='settings')return '';
    if(view==='chat'&&(this.chatPane||'workbench')!=='uids')return '';
    const metaKey=(view==='chat'&&this.chatPane==='uids')?'uids':view;
    const [title,desc]=this.viewPageMeta(metaKey);
    if(!title)return '';
    return `<div class="page-head"><div><h1>${this.esc(title)}</h1><p>${this.esc(desc||'')}</p></div></div>`;
  },
  async refresh(opts={}){
    const view=this.view;
    const gen=opts.navGen!=null?opts.navGen:(this._navGen||0);
    const still=()=>this.view===view&&this._navGen===gen;
    try{
      if(window.UI)UI.restorePopups();
      if(this.view==='publish'&&opts.invalidateMatrix&&typeof this.invalidateMatrixCache==='function'){
        this.invalidateMatrixCache(this.matrixTab);
      }
      const renderName='render'+view[0].toUpperCase()+view.slice(1);
      const renderFn=this[renderName];
      if(typeof renderFn!=='function')throw new Error('页面模块未加载: '+view);

      // 拦截 #content 写入，过期导航的响应不得盖住当前页
      const content=document.querySelector('#content');
      const proto=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
      let guarded=false;
      if(content&&proto&&proto.set){
        guarded=true;
        Object.defineProperty(content,'innerHTML',{
          configurable:true,
          enumerable:true,
          get(){return proto.get.call(this)},
          set(html){if(!still())return;proto.set.call(this,html)}
        });
      }
      try{
        await renderFn.call(this,{...opts,still});
      }finally{
        if(guarded){
          try{delete content.innerHTML}catch{Object.defineProperty(content,'innerHTML',proto)}
        }
      }
      if(!still())return;
      const head=this.pageHead(this.view);
      const el=document.querySelector('#content');
      if(head&&el&&!el.querySelector('.page-head'))el.insertAdjacentHTML('afterbegin',head);
      if(window.UI&&el&&!el.querySelector('#matrix-body'))UI.decorate(el);
    }catch(e){
      if(!still())return;
      this.toast(e.message,true);
      const el=document.querySelector('#content');
      if(el&&el.querySelector('.page-shell-loading')){
        el.querySelector('.page-shell-loading .muted')&&(el.querySelector('.page-shell-loading .muted').textContent='加载失败：'+(e.message||'请重试'));
      }
    }
  },
  connectLiveLogs(){try{const wsBase=(window.__TKSWARM_CONFIG__&&typeof window.__TKSWARM_CONFIG__.getWsBase==='function')?window.__TKSWARM_CONFIG__.getWsBase():(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`);const ws=new WebSocket(wsBase);this.ws=ws;ws.onopen=()=>{this.syncExecutorWsStatus()};ws.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.type==='operation-log'){this.liveLogs.unshift(m.data);this.liveLogs=this.liveLogs.slice(0,500);if(typeof this.renderLiveLogs==='function')this.renderLiveLogs()}if(m.type==='work-push'){this.handleWorkPush(m.data||{})}if(m.type==='work-done'){this.onExecutorWorkDone(m.data||{})}if(m.type==='executor-ack'||m.type==='executor-hub'){const on=!!(m.data&&(m.data.enabled!=null?m.data.enabled:this.isExecutorEnabled()));const btn=document.querySelector('#executor-toggle-btn');if(btn)btn.classList.toggle('is-on',this.isExecutorEnabled());void on}if(m.type==='new_message'){this.playTipSound()}if(['account_status','new_message','friend_status','friend_msg_read_status','message_status'].includes(m.type)&&this.view==='chat'){this.refresh()}}catch{}};ws.onclose=()=>setTimeout(()=>this.connectLiveLogs(),3000);setInterval(()=>{if(this.ws&&this.ws.readyState===1){this.ws.send(JSON.stringify({type:'heartbeat'}));this.syncExecutorWsStatus()}},25000)}catch{}},
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
  async remove(path,name){if(!(await this.ask(`确定删除这个${name}吗？`)))return;try{await this.api(path,{method:'DELETE'});this.toast(`${name}已删除`);await this.loadRefs();this.refresh()}catch(e){this.toast(e.message,true)}}
};

window.app = app;
window.AppPages = window.AppPages || {};
