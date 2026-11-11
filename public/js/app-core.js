const app = {
  view: 'accounts', meta: null, groups: [], proxies: [], materials: [], templates: [], groupType: 'account', taskRefreshTimer: null, warmRefreshTimer: null, accountWorkRefreshTimer: null, warmPane: 'list', warmPage: 1, warmKeyword: '', warmStatusFilter: '', warmEditId: null, aiLeadsPane: 'list', aiLeadsPage: 1, aiLeadsKeyword: '', aiLeadsStatus: '', aiLeadsEditId: null, aiLeadsDetailId: null, aiLeadsDetailTab: 'accounts', autoFollowPane: 'list', autoFollowPage: 1, autoFollowKeyword: '', autoFollowStatus: '', autoFollowEditId: null, aiLeadCluesPage: 1, aiLeadCluesKeyword: '', aiLeadCluesDmStatus: '', aiLeadCluesSourceType: '', aiLeadCluesMinScore: '', aiLeadCluesLeadId: '', aiLeadCluesIndustryId: '', aiLeadClueIoFields: null, aiLeadClueDataPage: 1, aiLeadClueDataKeyword: '', aiLeadClueDataMinScore: '', aiLeadClueDataLeadId: '', aiLeadClueDataIndustryId: '', msgTplType: 'comment', msgTplKeyword: '', accountWorkPage: 1, accountWorkKeyword: '', accountWorkStatus: '', accountWorkAccountId: '', accountWizardKind: 'pull_stats', accountWizardPane: 'list', accountWizardPage: 1, accountWizardKeyword: '', accountWizardStatus: '', accountWizardEditId: null, accountWizardRefreshTimer: null, accountPane: 'list', accountIoTab: 'export', accountGroupId: '', accountCapcut: '', accountSession: '', accountPage: 1, accountKeyword: '', accountStatus: '', proxyGroupId: '', proxyPage: 1, proxyPane: 'list', proxyIoTab: 'export', proxyKeyword: '', proxyStatus: '', materialPage: 1, materialKeyword: '', materialStatus: '', materialPublishStatus: '', materialTags: '', uidPage: 1, agentPage: 1, templatePage: 1, taskPage: 1, massPage: 1, groupPage: 1, rbacPermPage: 1, rbacRolePage: 1, rbacRoleKeyword: '', rbacRoleStatus: '', rbacUserPage: 1, rbacUserKeyword: '', rbacUserStatus: '', rbacLogPage: 1, rbacLogKeyword: '', rbacMenuPage: 1, rbacMenuKeyword: '', rbacMenuVisible: '', countryDataPane: 'list', countryDataEditId: null, countryDataPage: 1, countryDataKeyword: '', countryDataEnabledFilter: '', industryDataPane: 'list', industryDataEditId: null, industryDataParentId: null, industryDataPage: 1, industryDataKeyword: '', industryDataLevel: '', helpDocPage: 1, helpCatPage: 1, helpDocsTab: 'docs', helpDocsCatId: '', helpDocKeyword: '', helpDocStatus: '', helpCatKeyword: '', ticketPage: 1, ticketStatus: '', ticketKeyword: '', versionPage: 1, versionKeyword: '', versionChannel: '', versionStatus: '', browserPage: 1, matrixTab: 'tasks', wizardOpen: false, wizardStep: 1, wizard: {}, massWizardOpen: false, mass: {step:1,massChannel:'bit'}, uidGroupId: '', uidKeyword: '', chatPane: 'workbench',
  chatAccountId: null, chatFriendId: null, chatFriendTab: 'dm', chatFilter: 'all', chatKeyword: '', chatSearchKeyword: '', chatSearchResultsHtml: '', _chatSearchTmp: null, scriptGroupId: '', chatTranslateOn: false, _chatTranslateCache: {}, _chatLastMessages: [],
  agentId: null, agentForm: null, agentKeyword: '', agentTab: 'basic', testChat: [],
  titles: {accounts:['账号管理','维护 TikTok 账号、分组与浏览器环境'],groups:['分组管理','账号分组与公司子组的增删改查'],warm:['自动养号','按任务创建养号配置，批量执行刷互动养号'],msgTemplates:['消息模板','评论 / 回复评论 / 私信 / 回复私信：每条为固定文案或 AI 提示词'],accountWork:['矩阵任务','按账号查看会话总任务与子任务，支持展开与暂停'],accountWizard:['账号向导','养号、拉取账号数据、修改资料与账号视频'],aiLeads:['拓客任务','配置拓客规则、关联账号与私信明细'],aiLeadClues:['拓客线索','查看拓客跑出的意向用户与评论，支持换号与导出'],aiLeadClueData:['拓客结果','查看共享给当前账号的评论线索，含行业筛选'],autoFollow:['增粉任务','选择被增粉账号与数量，按间隔调度系统账号关注'],videoBoost:['视频增值','选择已发布视频，按间隔排期让账号搜索发布者、观看后点赞、评论、转发'],videoDelivery:['视频交付','企业客户定制视频：授权、积分、上传与交付文件'],proxies:['代理IP','管理代理池并检测连通性'],registerEnvs:['注册环境','先选代理建环境，在环境里完成注册，再发布为正式账号'],agent:['AI智能体','选择开放平台与模型，配置语言风格'],publish:['AI矩阵','创建并执行视频发布任务'],chat:['客服聊天','多账号聚合私信'],uids:['UID好友','客服群发目标 UID 池，按分组导入与维护'],logs:['实时操作日志','WebSocket 实时链路与系统级动作事件流'],rbac:['权限管理','权限节点、角色、管理员与审计菜单'],'rbac.country_data':['国家数据','ISO 国家中英文名称列表，支持增删改与种子导入'],'rbac.industry_data':['行业数据','外贸行业四级分类树，支持增删改与种子导入'],'rbac.company_data':['企业数据','管理企业信息，与行业分类及管理用户绑定'],settings:['基础设置','配置浏览器、任务、发布确认与翻译'],versions:['版本控制','上传与管理客服客户端代码包，供 EXE 下载安装'],helpDocs:['帮助文档','维护客户端帮助分类与文档内容'],tickets:['工单处理','查看并回复客服客户端提交的工单反馈'],envInstallers:['环境安装包','管理 Node / 自研浏览器等本机环境安装包'],aiPlatform:['AI开放平台','配置国内外 AI 平台与多套开发密钥，启用全局调用配置'],aiPromptTemplates:['AI提示词模板','维护提示词模板，支持不同模板的 {{变量}} 占位与渲染预览'],aiCallLogs:['AI记录','查看 AI 平台调用日志：平台、配置、用户、操作、体积与请求响应'],smtpConfig:['SMTP 配置','系统发信 SMTP（仅超级管理员）'],nocaptchaKeys:['NoCaptchaAI密钥','管理 NoCaptchaAI 验证码识别密钥，同一时间仅启用一个'],videoDeliveryTypes:['视频交付类型','配置视频交付结算类型与积分倍率（配置分×倍率=实际积分）'],youtubeConfig:['YouTube 开发配置','全局 YouTube OAuth 客户端（clientId / secret / redirect）'],youtubeAccounts:['YouTube 账号','多频道 OAuth 授权与 refresh_token 持久化'],youtubeSync:['Youtube发布','将 TikTok 已发布素材同步上传到多个 YouTube 账号'],dmWeightConfig:['日私信权重','按视频激活天数配置系统默认日私信次数（仅超级管理员）'],system:['系统管理','基础设置、开发管理、AI开放平台、帮助与工单']},
  async api(path, options={}) {
    let apiBase = typeof window.getTkswarmApiBase === 'function'
      ? window.getTkswarmApiBase()
      : (window.TKSWARM_API_BASE ?? window.__TKSWARM_CONFIG__?.defaultApiBase ?? 'http://tkswarm-api.dyyweb.com');
    // 仅比特自动化 / 本机能力走同源 Node；其余走 apiBase（本机为空串时由 Node 代理至 PHP）
    // 坐席 seat-tasks / seat-items 必须打本机 Node：入队后立刻 claim 并推服务器浏览器
    const useLocalNode = /^\/(browser|system|audio|uploads|executor|local-materials)(\/|$)/.test(path)
      || /^\/accounts\/monitor\/run$/.test(path)
      || /^\/chat\/messages\/bit-send(\/|$)/.test(path)
      || /^\/chat\/seat-(tasks|items)(\/|$)/.test(path)
      || /\/items\/\d+\/(resume-publish|confirm-published)$/.test(path);
    if (useLocalNode) apiBase = '';
    const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const isBlob = typeof Blob !== 'undefined' && options.body instanceof Blob;
    const isBuf = typeof ArrayBuffer !== 'undefined' && options.body instanceof ArrayBuffer;
    const isParams = typeof URLSearchParams !== 'undefined' && options.body instanceof URLSearchParams;
    const isView = typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' && ArrayBuffer.isView(options.body);
    let body = options.body;
    // 纯对象必须 JSON.stringify；禁止把对象交给 fetch（会变成 "[object Object]"）
    if (body != null && !isForm && !isBlob && !isBuf && !isParams && !isView && typeof body === 'object') {
      try { body = JSON.stringify(body); }
      catch (serErr) { throw new Error('请求体无法序列化为 JSON：' + (serErr.message || '')); }
    }
    if (typeof body === 'string' && body === '[object Object]') {
      throw new Error('请求体序列化失败，请按 Ctrl+F5 强制刷新后重试');
    }
    const headers = isForm ? { ...(options.headers || {}) } : { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (this.authToken) headers.Authorization = 'Bearer ' + this.authToken;
    const authPublic = /^\/auth\/(login|setup|captcha)$/.test(path);
    const actingAs = this.getActingAsId();
    // 本机 Node 路由也会转发 PHP（如 /executor/offer-batch → claim-one），必须带上切换身份
    if (actingAs && !authPublic) headers['X-Acting-As'] = String(actingAs);
    const timeoutMs = Number(options.timeoutMs);
    const waitMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 25000;
    let r;
    try {
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => { try { ctrl.abort(); } catch {} }, waitMs) : null;
      try {
        // 不要 {...options} 展开，避免 options.body 对象再次覆盖已序列化的 body
        const init = {
          method: options.method || (body != null ? 'POST' : 'GET'),
          headers,
          signal: options.signal || (ctrl && ctrl.signal),
        };
        if (body !== undefined) init.body = body;
        r = await fetch(apiBase + '/api' + path, init);
      } finally {
        if (timer) clearTimeout(timer);
      }
    } catch (netErr) {
      if (netErr && (netErr.name === 'AbortError' || /aborted/i.test(String(netErr.message || '')))) {
        throw new Error('接口超时 (' + Math.round(waitMs / 1000) + 's)：' + path);
      }
      // 业务接口不再静默降级到本机 Node，避免误打 127.0.0.1
      if (useLocalNode) {
        throw new Error(`网络连接失败: ${netErr.message || 'Failed to fetch'}`);
      }
      const apiLabel = apiBase || (typeof location !== 'undefined' ? location.origin : '本机 Node');
      throw new Error(`连接接口 (${apiLabel}) 失败: ${netErr.message || 'Failed to fetch'}。请确认 Node 已启动、PHP 站点可访问`);
    }

    const raw = await r.text();
    let j;
    try { j = JSON.parse(raw); } catch {
      const hint = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 180);
      throw new Error(hint ? `接口返回非 JSON：${hint}` : '响应无效');
    }
    if (r.status === 401) {
      // 如果已经在登录界面，直接抛出业务错误，不要隐藏/重建登录窗口导致消息一闪而过
      if (document.body.classList.contains('in-auth-mode') || document.querySelector('#auth-gate')) {
        throw new Error(j.message || '用户名或密码错误');
      }
      this.authToken = '';
      localStorage.removeItem('tkswarm_token');
      this.showLoginGate(j.message || '请先登录');
      throw new Error(j.message || '未登录');
    }
    if (!r.ok || !j.success) {
      const msg = j.message || '请求失败';
      if (/not valid JSON|\[object Object\]/i.test(String(msg))) {
        throw new Error('请求格式异常，请按 Ctrl+F5 强制刷新页面后重试');
      }
      throw new Error(msg);
    }
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
  async ensureBitOnline(actionLabel='该操作',backend=''){
    const want=String(backend||'').toLowerCase();
    // 指定后端时走该后端自己的地址/Token 校验
    if(want==='tkswarm'||want==='linux'||want==='bit'){
      const be=this.normalizeTaskBackend(want==='linux'?'linux':want, want==='linux');
      return this.ensureBrowserBackendOnline(be==='linux'?'linux':be,actionLabel);
    }
    // 未指定：比特 UI 隐藏时默认校验自研浏览器
    if(!this.bitBrowserUiEnabled()){
      return this.ensureBrowserBackendOnline(this.defaultTaskBrowserBackend(),actionLabel);
    }
    try{
      const st=await this.api('/browser/status');
      if(st?.online){this._bitOnlineAt=Date.now();if(st.autoFixedUrl)this.toast(`已自动修正浏览器 API 地址为 ${st.autoFixedUrl}`,false,4000);return st}
      // 全局探测失败但任一端在线：放行，账号实际后端由任务侧按账号解析
      const av=st?.availableBackends||{};
      if(av.bit||av.tkswarm){this._bitOnlineAt=Date.now();return {...st,online:true}}
      const label=st?.providerLabel||'本地浏览器';
      const tip=(st?.message||'请先启动本地浏览器并确认 API')+`（当前：${st?.apiUrl||'http://127.0.0.1:54345'}）。`;
      this.toast((actionLabel||'该操作')+'需要'+label+'在线。'+tip,true,5000);return null
    }catch(e){this.toast((actionLabel||'该操作')+'前检测本地浏览器失败：'+(e.message||'未连接'),true,5000);return null}
  },
  async ensureNodeOnline(actionLabel='该操作'){const ok=await this.probeNodeOnline();if(ok)return ok;this.toast((actionLabel||'该操作')+'需要本机 Node 在线（发布/群发/养号/粉丝同步由 Node 执行）。',true);return null},
  async probeNodeOnline(){try{const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),2500);const r=await fetch('/api/system/info',{signal:ctrl.signal,headers:this.authToken?{Authorization:'Bearer '+this.authToken}:{}});clearTimeout(t);if(!r.ok)return null;const j=await r.json().catch(()=>({}));if(j&&j.success===false)return null;this._nodeOnlineAt=Date.now();return j.data||j||{online:true}}catch{return null}},
  nodeOwnedTaskHint(status,type){const nodeTypes=['publish','message','warm','sync_fans','dm_sync','sync','profile'];if(status==='queued'&&nodeTypes.includes(type))return ' <span class="muted" title="等待本机 Node task-runner">·等待本机Node</span>';return ''},
  setPage(key,page){
    const n=Math.max(1,Number(page)||1);
    if(key==='materialPickerPage'){
      this.setMaterialPickerPage?.(n);
      return;
    }
    if(key==='autoFollowDetailPage'){
      this.autoFollowDetailPage=n;
      this.loadAutoFollowDetailPage?.(n);
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
      if (!e.target.closest?.('#hv-bell-wrap')) {
        document.querySelector('#hv-bell-panel')?.classList.add('hidden');
        document.querySelector('#hv-bell-btn')?.classList.remove('active');
      }
      if (window.UI) UI.syncMenus();
    });
    this.liveLogs=[];
    this.authToken=localStorage.getItem('tkswarm_token')||'';
    this.clockTimezone='Asia/Shanghai';
    this.clockCountryCode='CN';
    this.clockCountryName='中国';
    this.bindClockCountryPicker();
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
        this.syncBrowserAuthToken(loginToken).catch(()=>{});
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
      const wantLogin=location.hash==='#login'||params.has('login')||path.endsWith('/login');
      if(wantLogin){
        if(this.authToken){
          try{
            const st=await this.api('/auth/status');
            if(st.authEnabled&&st.authenticated){
              const hash=location.hash&&location.hash!=='#login'?location.hash:'#/accounts';
              location.replace('/'+hash);
              return false;
            }
          }catch{}
        }
        this.showLoginGate();
        return false;
      }
    }

    this.prepareNavbarPending();
    const ready=await this.ensureAuth();
    if(!ready)return false;
    this.syncBrowserAuthToken().catch(()=>{});
    this.connectLiveLogs();
    await Promise.all([this.loadMeta(), this.loadRefs(), this.loadNavigationMenus()]);
    try{
      const st=await this.api('/settings');
      this.notificationSound=st.notificationSound||'chime';
      this.notificationSync=st.notificationSync!==false;
      this.applyClockPreference(st);
    }catch{}
    // 首屏路由由 TkRouter.start 根据 location.hash 负责
    return true;
  },
  prepareNavbarPending(){
    const nav=document.querySelector('#nav');
    if(!nav)return;
    nav.classList.add('nav-pending');
    nav.innerHTML='';
  },
  async loadNavigationMenus(){
    this.prepareNavbarPending();
    try{
      const tree=await this.api('/menus/tree');
      this.navTree=Array.isArray(tree)?tree:[];
      this.renderNavbarMenu(this.navTree);
    }catch(err){
      console.warn('Failed to load menu tree from database', err);
      this.navTree=[];
      const nav=document.querySelector('#nav');
      if(nav){
        nav.classList.remove('nav-pending');
        nav.innerHTML='<div class="nav-empty muted" style="padding:12px 16px;font-size:13px">菜单加载失败</div>';
      }
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
    if(/营销|拓客|aiLeads|增粉|autoFollow/i.test(t)||v==='aiLeads'||v==='autoFollow')return 'sparkles';
    if(/矩阵|发布|视频|素材/.test(t)||v==='publish'||v==='materials')return 'video';
    if(/客服|聊天|会话/.test(t)||v==='chat')return 'message';
    if(/权限|角色|审计/.test(t)||v==='rbac')return 'shield';
    if(/系统管理|设置|版本|工单|帮助|安装包|开放平台|AI平台|提示词|AI记录|SMTP|日私信|YouTube 开发/.test(t)||v==='settings'||v==='versions'||v==='helpDocs'||v==='tickets'||v==='envInstallers'||v==='aiPlatform'||v==='aiPromptTemplates'||v==='aiCallLogs'||v==='smtpConfig'||v==='dmWeightConfig'||v==='nocaptchaKeys'||v==='videoDeliveryTypes'||v==='youtubeConfig')return 'settings';
    if(/Youtube发布|YouTube 账号|youtubeAccounts|youtubeSync/i.test(t)||v==='youtubeAccounts'||v==='youtubeSync')return 'youtube';
    if(/日志/.test(t)||v==='logs')return 'file-text';
    if(/分组/.test(t)||v==='groups')return 'folder';
    if(/养号|warm/i.test(t)||v==='warm')return 'activity';
    if(/消息模板|msgTemplates/i.test(t)||v==='msgTemplates')return 'message';
    if(/矩阵任务|accountWork/i.test(t)||v==='accountWork')return 'list';
    if(/账号向导|accountWizard|拉取数据|修改资料|账号视频/i.test(t)||v==='accountWizard')return 'users';
    if(/账号视频|account_videos|film/i.test(t))return 'film';
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
  hasMenuPermissionMode(){
    if(!this.authEnabled)return false;
    const list=this.authPermissions||[];
    if(list.includes('*')||list.includes('admin'))return true;
    return list.some(c=>String(c||'').startsWith('menu.'));
  },
  canMenuItem(item){
    if(!item||this.isRemovedNavItem(item))return false;
    // SMTP / 日私信权重：仅登录超管可见（不受身份切换影响）；鉴权关闭时放开便于本地调试
    if(String(item.view||'')==='smtpConfig'||String(item.view||'')==='dmWeightConfig'){
      if(!this.authEnabled)return true;
      return !!this.authIsSuper || Number(this.authLoginUser?.roleId||this.authLoginUser?.role_id||0)===1;
    }
    // NoCaptchaAI：按登录账号权限节点 system.nocaptcha（不受身份切换影响）
    if(String(item.view||'')==='nocaptchaKeys'){
      if(!this.authEnabled)return true;
      return this.canLoginPermission('system.nocaptcha');
    }
    // 视频交付类型：按登录账号权限节点 system.video_delivery_types（不受身份切换影响）
    if(String(item.view||'')==='videoDeliveryTypes'){
      if(!this.authEnabled)return true;
      return this.canLoginPermission('system.video_delivery_types');
    }
    // YouTube 开发配置：仅超管 / 运营管理 / system.youtube
    if(String(item.view||'')==='youtubeConfig'){
      return typeof this.canConfigYouTube==='function'?this.canConfigYouTube():false;
    }
    // YouTube 账号 / 发布：超管 / 运营管理 / 运营专员 / 企业客户
    if(['youtubeAccounts','youtubeSync'].includes(String(item.view||''))){
      return typeof this.canUseYouTube==='function'?this.canUseYouTube():false;
    }
    if(!this.authEnabled)return true;
    const list=this.authPermissions||[];
    if(list.includes('*')||list.includes('admin'))return true;
    const code=String(item.permissionCode||item.permission_code||'').trim();
    if(code==='*'||code.toLowerCase()==='public')return true;
    // 拉取视频列表：全角色可进（与菜单 permission_code=public 对齐，防止旧缓存无 public 时被拦）
    const sv=String(item.subview||'');
    if(String(item.view||'')==='publish'&&(sv==='pull_video_list'||sv==='create_pull_video_list'))return true;
    // 账号向导·拉取数据 / 修改资料 / 账号视频：全角色开放（与菜单 permission_code=public 对齐）
    if(String(item.view||'')==='accountWizard'&&(
      sv==='pull_stats'||sv==='modify_profile'||sv==='account_videos'
      ||sv==='create_pull_stats'||sv==='create_modify_profile'||sv.startsWith('edit_modify_profile')
    )){
      return true;
    }
    if(!this.hasMenuPermissionMode())return this.canView(item.view||'');
    if(!code)return false;
    return this.canPermission(code);
  },
  walkNavTree(nodes, fn){
    for(const n of (Array.isArray(nodes)?nodes:[])){
      if(fn(n)===true)return true;
      if(this.walkNavTree(n.children||[], fn))return true;
    }
    return false;
  },
  findFirstAccessibleRoute(nodes){
    let best=null;
    const walk=(list)=>{
      (list||[]).forEach((n)=>{
        const children=n.children||[];
        if(children.length)walk(children);
        else if(!best&&this.canMenuItem(n)&&String(n.view||'')){
          best={view:String(n.view),subview:String(n.subview||'')};
        }
      });
    };
    walk(Array.isArray(nodes)?nodes:[]);
    if(best)return best;
    walk=(list)=>{
      (list||[]).forEach((n)=>{
        if(!best&&this.canMenuItem(n)&&String(n.view||'')){
          best={view:String(n.view),subview:String(n.subview||'')};
        }
        if(n.children?.length)walk(n.children);
      });
    };
    walk(Array.isArray(nodes)?nodes:[]);
    return best;
  },
  firstAccessibleRoute(){
    const route=this.findFirstAccessibleRoute(this.navTree||[]);
    if(route)return route;
    if(!this.authEnabled||this.authPermissions?.includes?.('*'))return {view:'accounts',subview:''};
    return null;
  },
  hasAccessibleMenuForView(view){
    const v=String(view||'');
    if(!v)return false;
    return this.walkNavTree(this.navTree||[], (n)=>String(n.view||'')===v&&this.canMenuItem(n));
  },
  findNavItem(view,subview,nodes){
    const sv=String(subview||'');
    // 同一 view/subview 可能有父+子多级节点：优先返回最深叶子，避免父级无权限误拦子级入口
    let best=null;
    let bestDepth=-1;
    const walk=(list,depth)=>{
      for(const n of (Array.isArray(list)?list:[])){
        if(String(n.view||'')===String(view||'')&&String(n.subview||'')===sv){
          if(depth>=bestDepth){best=n;bestDepth=depth}
        }
        if(n.children?.length)walk(n.children,depth+1);
      }
    };
    walk(nodes,0);
    return best;
  },
  /** 菜单权限：任一同路由节点可访问即放行（账号中心父级与「账号列表」叶子常共用 accounts/list） */
  canNavigateMenu(view,subview){
    if(!this.authEnabled)return true;
    const list=this.authPermissions||[];
    if(list.includes('*')||list.includes('admin'))return true;
    const v=String(view||'');
    let sv=String(subview||'');
    // 账号中心：空 subview 与 list 等价
    if(v==='accounts'&&(sv===''||sv==='list'))sv='list';
    const candidates=sv?[sv]:[''];
    if(v==='accounts'&&sv==='list')candidates.push('');
    if(this.hasMenuPermissionMode()){
      let allowed=false;
      this.walkNavTree(this.navTree||[],(n)=>{
        const nv=String(n.view||'');
        const ns=String(n.subview||'');
        if(nv!==v)return;
        if(candidates.includes(ns)||(v==='accounts'&&(ns===''||ns==='list')&&(sv===''||sv==='list'))){
          if(this.canMenuItem(n)){allowed=true;return true}
        }
      });
      if(allowed)return true;
      // 浏览器/导入导出等子页：只要账号中心任一入口可访问即可进入
      if(v==='accounts'&&['browser','io','import','export','batch_browser','monitor_config','monitor_run','monitor_log','monitor_result'].includes(sv)){
        return this.hasAccessibleMenuForView('accounts');
      }
      // 拉取视频列表：全角色可进
      if(v==='publish'&&(sv==='pull_video_list'||sv==='create_pull_video_list'||sv==='pull_video_list_wizard'))return true;
      // 账号向导·拉取数据 / 修改资料 / 账号视频：全角色可进（含创建/编辑子路径）
      if(v==='accountWizard'&&(
        sv===''||sv==='pull_stats'||sv==='modify_profile'||sv==='account_videos'
        ||sv==='create_pull_stats'||sv==='create_modify_profile'
        ||sv.startsWith('edit_modify_profile')
      ))return true;
      // 视频交付客户详情：只要「视频交付」菜单可进，数字 / client/{id} 子路径放行
      if(v==='videoDelivery'&&(sv===''||/^(?:client\/)?\d+$/.test(sv))){
        return this.hasAccessibleMenuForView('videoDelivery');
      }
      // 视频增值：新建 / 编辑子路径（菜单只登记了 list），「视频增值」菜单可进即放行
      if(v==='videoBoost'&&(sv===''||sv==='list'||sv==='create'||sv==='edit'||/^edit\/\d+$/.test(sv))){
        return this.hasAccessibleMenuForView('videoBoost');
      }
      // YouTube 账号数据面板 / 内容详情：菜单只登记空 subview，子路径放行
      if(v==='youtubeAccounts'&&(sv===''||sv==='list'||sv==='videos'||sv.startsWith('videos/')||sv.startsWith('video/'))){
        if(this.hasAccessibleMenuForView('youtubeAccounts'))return true;
        return typeof this.canUseYouTube==='function'?this.canUseYouTube():false;
      }
      if(v==='youtubeSync'&&(sv===''||sv==='list'||sv==='create')){
        if(this.hasAccessibleMenuForView('youtubeSync'))return true;
        return typeof this.canUseYouTube==='function'?this.canUseYouTube():false;
      }
      return false;
    }
    if(!this.canView(view))return false;
    if(!sv||(v==='accounts'&&sv==='list'))return true;
    const item=this.findNavItem(view,sv,this.navTree||[]);
    return item?this.canMenuItem(item):true;
  },
  filterNavTree(nodes){
    return (Array.isArray(nodes)?nodes:[]).filter(n=>!this.isRemovedNavItem(n)).map(n=>{
      const children=this.filterNavTree(n.children||[]);
      return {...n, children};
    }).filter(n=>{
      const children=n.children||[];
      return this.canMenuItem(n)||children.length>0;
    });
  },
  renderNavbarMenu(tree){
    const nav=document.querySelector('#nav');
    if(!nav)return;
    tree=this.filterNavTree(tree);
    nav.classList.remove('nav-pending');
    if(!tree.length){
      nav.innerHTML='<div class="nav-empty muted" style="padding:12px 16px;font-size:13px">当前角色暂无可访问菜单</div>';
      return;
    }
    nav.innerHTML=tree.map(root=>{
      const hasLvl2=root.children&&root.children.length>0;
      const rootActive=this.view===root.view
        ||(root.view==='accounts'&&['groups','proxies','registerEnvs','youtubeAccounts'].includes(this.view))
        ||(root.view==='publish'&&['warm','accountWork','accountWizard','youtubeSync','videoBoost'].includes(this.view))
        ||(root.view==='agent'&&['msgTemplates'].includes(this.view))
        ||(root.view==='aiLeads'&&this.view==='autoFollow')
        ||(root.view==='settings'&&['versions','helpDocs','tickets','envInstallers','aiPlatform','aiPromptTemplates','aiCallLogs','smtpConfig','dmWeightConfig','nocaptchaKeys','videoDeliveryTypes','youtubeConfig'].includes(this.view));
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
  /** 各国唯一 IANA 时区（code 唯一、tz 互不相同） */
  clockCountryList(){
    return [
      {code:'CN',name:'中国',tz:'Asia/Shanghai'},
      {code:'TW',name:'中国台湾',tz:'Asia/Taipei'},
      {code:'HK',name:'中国香港',tz:'Asia/Hong_Kong'},
      {code:'MO',name:'中国澳门',tz:'Asia/Macau'},
      {code:'JP',name:'日本',tz:'Asia/Tokyo'},
      {code:'KR',name:'韩国',tz:'Asia/Seoul'},
      {code:'KP',name:'朝鲜',tz:'Asia/Pyongyang'},
      {code:'MN',name:'蒙古',tz:'Asia/Ulaanbaatar'},
      {code:'VN',name:'越南',tz:'Asia/Ho_Chi_Minh'},
      {code:'TH',name:'泰国',tz:'Asia/Bangkok'},
      {code:'MY',name:'马来西亚',tz:'Asia/Kuala_Lumpur'},
      {code:'SG',name:'新加坡',tz:'Asia/Singapore'},
      {code:'ID',name:'印度尼西亚',tz:'Asia/Jakarta'},
      {code:'PH',name:'菲律宾',tz:'Asia/Manila'},
      {code:'KH',name:'柬埔寨',tz:'Asia/Phnom_Penh'},
      {code:'LA',name:'老挝',tz:'Asia/Vientiane'},
      {code:'MM',name:'缅甸',tz:'Asia/Yangon'},
      {code:'BN',name:'文莱',tz:'Asia/Brunei'},
      {code:'IN',name:'印度',tz:'Asia/Kolkata'},
      {code:'PK',name:'巴基斯坦',tz:'Asia/Karachi'},
      {code:'BD',name:'孟加拉国',tz:'Asia/Dhaka'},
      {code:'LK',name:'斯里兰卡',tz:'Asia/Colombo'},
      {code:'NP',name:'尼泊尔',tz:'Asia/Kathmandu'},
      {code:'AF',name:'阿富汗',tz:'Asia/Kabul'},
      {code:'IR',name:'伊朗',tz:'Asia/Tehran'},
      {code:'IQ',name:'伊拉克',tz:'Asia/Baghdad'},
      {code:'SA',name:'沙特阿拉伯',tz:'Asia/Riyadh'},
      {code:'AE',name:'阿联酋',tz:'Asia/Dubai'},
      {code:'QA',name:'卡塔尔',tz:'Asia/Qatar'},
      {code:'KW',name:'科威特',tz:'Asia/Kuwait'},
      {code:'BH',name:'巴林',tz:'Asia/Bahrain'},
      {code:'OM',name:'阿曼',tz:'Asia/Muscat'},
      {code:'IL',name:'以色列',tz:'Asia/Jerusalem'},
      {code:'TR',name:'土耳其',tz:'Europe/Istanbul'},
      {code:'RU',name:'俄罗斯',tz:'Europe/Moscow'},
      {code:'KZ',name:'哈萨克斯坦',tz:'Asia/Almaty'},
      {code:'UZ',name:'乌兹别克斯坦',tz:'Asia/Tashkent'},
      {code:'GB',name:'英国',tz:'Europe/London'},
      {code:'IE',name:'爱尔兰',tz:'Europe/Dublin'},
      {code:'FR',name:'法国',tz:'Europe/Paris'},
      {code:'DE',name:'德国',tz:'Europe/Berlin'},
      {code:'IT',name:'意大利',tz:'Europe/Rome'},
      {code:'ES',name:'西班牙',tz:'Europe/Madrid'},
      {code:'PT',name:'葡萄牙',tz:'Europe/Lisbon'},
      {code:'NL',name:'荷兰',tz:'Europe/Amsterdam'},
      {code:'BE',name:'比利时',tz:'Europe/Brussels'},
      {code:'CH',name:'瑞士',tz:'Europe/Zurich'},
      {code:'AT',name:'奥地利',tz:'Europe/Vienna'},
      {code:'PL',name:'波兰',tz:'Europe/Warsaw'},
      {code:'CZ',name:'捷克',tz:'Europe/Prague'},
      {code:'SE',name:'瑞典',tz:'Europe/Stockholm'},
      {code:'NO',name:'挪威',tz:'Europe/Oslo'},
      {code:'DK',name:'丹麦',tz:'Europe/Copenhagen'},
      {code:'FI',name:'芬兰',tz:'Europe/Helsinki'},
      {code:'GR',name:'希腊',tz:'Europe/Athens'},
      {code:'RO',name:'罗马尼亚',tz:'Europe/Bucharest'},
      {code:'HU',name:'匈牙利',tz:'Europe/Budapest'},
      {code:'UA',name:'乌克兰',tz:'Europe/Kyiv'},
      {code:'US',name:'美国',tz:'America/New_York'},
      {code:'CA',name:'加拿大',tz:'America/Toronto'},
      {code:'MX',name:'墨西哥',tz:'America/Mexico_City'},
      {code:'BR',name:'巴西',tz:'America/Sao_Paulo'},
      {code:'AR',name:'阿根廷',tz:'America/Argentina/Buenos_Aires'},
      {code:'CL',name:'智利',tz:'America/Santiago'},
      {code:'CO',name:'哥伦比亚',tz:'America/Bogota'},
      {code:'PE',name:'秘鲁',tz:'America/Lima'},
      {code:'VE',name:'委内瑞拉',tz:'America/Caracas'},
      {code:'AU',name:'澳大利亚',tz:'Australia/Sydney'},
      {code:'NZ',name:'新西兰',tz:'Pacific/Auckland'},
      {code:'FJ',name:'斐济',tz:'Pacific/Fiji'},
      {code:'EG',name:'埃及',tz:'Africa/Cairo'},
      {code:'ZA',name:'南非',tz:'Africa/Johannesburg'},
      {code:'NG',name:'尼日利亚',tz:'Africa/Lagos'},
      {code:'KE',name:'肯尼亚',tz:'Africa/Nairobi'},
      {code:'MA',name:'摩洛哥',tz:'Africa/Casablanca'},
      {code:'ET',name:'埃塞俄比亚',tz:'Africa/Addis_Ababa'},
    ];
  },
  findClockCountry(codeOrTz){
    const list=this.clockCountryList();
    const key=String(codeOrTz||'').trim();
    return list.find(c=>c.code===key)||list.find(c=>c.tz===key)||list.find(c=>c.name===key)||null;
  },
  applyClockPreference(st={}){
    const byCode=this.findClockCountry(st.clockCountryCode);
    const byTz=this.findClockCountry(st.clockTimezone);
    const hit=byCode||byTz||this.findClockCountry('CN');
    this.clockCountryCode=hit.code;
    this.clockCountryName=st.clockCountryName||hit.name;
    this.clockTimezone=hit.tz;
    this.tickClock();
  },
  bindClockCountryPicker(){
    if(this._clockPickerBound)return;
    this._clockPickerBound=true;
    document.addEventListener('click',e=>{
      const icon=e.target?.closest?.('#clock .clock-icon');
      if(!icon)return;
      e.preventDefault();
      e.stopPropagation();
      this.openClockCountryPicker();
    });
  },
  openClockCountryPicker(){
    const list=this.clockCountryList();
    const cur=this.clockCountryCode||'CN';
    const cards=list.map(c=>{
      const active=c.code===cur?'is-active':'';
      const city=(c.tz.split('/').pop()||c.tz).replace(/_/g,' ');
      return `<button type="button" class="clock-country-card ${active}" data-ui-icon="off" data-code="${this.esc(c.code)}" data-search="${this.esc((c.name+' '+c.code+' '+c.tz).toLowerCase())}" title="${this.esc(c.name+' · '+c.tz)}" onclick="app.selectClockCountry('${this.esc(c.code)}')">
        <span class="clock-country-card-top">
          <span class="clock-country-card-name">${this.esc(c.name)}</span>
          <span class="clock-country-card-code">${this.esc(c.code)}</span>
        </span>
        <span class="clock-country-card-live" data-tz="${this.esc(c.tz)}">--:--:--</span>
        <span class="clock-country-card-tz">${this.esc(city)}</span>
      </button>`;
    }).join('');
    const body=`<div class="clock-country-picker">
      <div class="clock-country-picker-hint muted">选择国家后，顶栏时钟显示该国电子时钟；每位登录用户单独保存。</div>
      <input class="input clock-country-search" type="search" placeholder="搜索国家 / 时区 / 代码" oninput="app.filterClockCountryPicker(this.value)">
      <div class="clock-country-grid" id="clock-country-grid">${cards}</div>
    </div>`;
    this.modal('选择时钟国家',body,async()=>{},false,{hideSubmit:true,wide:true,onClose:()=>{
      if(this._clockPickerPreviewTimer){clearInterval(this._clockPickerPreviewTimer);this._clockPickerPreviewTimer=null}
    }});
    const tickPreview=()=>{
      const now=new Date();
      document.querySelectorAll('#clock-country-grid .clock-country-card-live').forEach(el=>{
        const tz=el.getAttribute('data-tz');
        try{el.textContent=now.toLocaleTimeString('zh-CN',{timeZone:tz,hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'})}
        catch{el.textContent='--:--:--'}
      });
    };
    tickPreview();
    if(this._clockPickerPreviewTimer)clearInterval(this._clockPickerPreviewTimer);
    this._clockPickerPreviewTimer=setInterval(tickPreview,1000);
  },
  filterClockCountryPicker(q){
    const needle=String(q||'').trim().toLowerCase();
    document.querySelectorAll('#clock-country-grid .clock-country-card').forEach(btn=>{
      const hay=btn.getAttribute('data-search')||(btn.textContent||'').toLowerCase();
      btn.classList.toggle('is-hidden',!!needle&&!hay.includes(needle));
    });
  },
  async selectClockCountry(code){
    const hit=this.findClockCountry(code)||this.findClockCountry('CN');
    this.clockCountryCode=hit.code;
    this.clockCountryName=hit.name;
    this.clockTimezone=hit.tz;
    this.tickClock();
    this.closeModal();
    try{
      await this.api('/settings',{method:'PUT',body:JSON.stringify({
        clockTimezone:hit.tz,
        clockCountryCode:hit.code,
        clockCountryName:hit.name,
      })});
      this.toast(`时钟已切换为 ${hit.name}`);
    }catch(err){
      this.toast(err.message||'时钟偏好保存失败',true);
    }
  },
  /** 把 datetime-local 墙钟按指定 IANA 时区解释为 UTC 毫秒 */
  wallTimeInZoneToUtcMs(localStr,timeZone){
    const m=String(localStr||'').trim().match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
    if(!m)return NaN;
    const y=+m[1],mo=+m[2]-1,d=+m[3],h=+m[4],mi=+m[5],s=+(m[6]||0);
    const desired=Date.UTC(y,mo,d,h,mi,s);
    let utc=desired;
    const fmt=new Intl.DateTimeFormat('en-US',{
      timeZone:timeZone||'Asia/Shanghai',
      year:'numeric',month:'2-digit',day:'2-digit',
      hour:'2-digit',minute:'2-digit',second:'2-digit',
      hourCycle:'h23',
    });
    for(let i=0;i<4;i++){
      const parts={};
      for(const p of fmt.formatToParts(new Date(utc))){
        if(p.type!=='literal') parts[p.type]=p.value;
      }
      let hour=parseInt(parts.hour,10);
      if(hour===24) hour=0;
      const got=Date.UTC(+parts.year,+parts.month-1,+parts.day,hour,+parts.minute,+parts.second);
      const diff=desired-got;
      utc+=diff;
      if(!diff) break;
    }
    return utc;
  },
  formatWallInZone(ms,timeZone){
    if(!Number.isFinite(ms))return '';
    const fmt=new Intl.DateTimeFormat('en-CA',{
      timeZone:timeZone||'Asia/Shanghai',
      year:'numeric',month:'2-digit',day:'2-digit',
      hour:'2-digit',minute:'2-digit',second:'2-digit',
      hourCycle:'h23',
    });
    const parts={};
    for(const p of fmt.formatToParts(new Date(ms))){
      if(p.type!=='literal') parts[p.type]=p.value;
    }
    let hour=String(parts.hour||'00');
    if(hour==='24') hour='00';
    const pad=v=>String(v).padStart(2,'0');
    return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(hour)}:${pad(parts.minute)}:${pad(parts.second||'00')}`;
  },
  normalizeScheduleLocalInput(localStr){
    const m=String(localStr||'').trim().match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})(?::(\d{2}))?/);
    if(!m)return '';
    return `${m[1]} ${m[2]}:${m[3]||'00'}`;
  },
  timezoneForCountryCode(codeOrName){
    const raw=String(codeOrName||'').trim();
    if(!raw) return this.findClockCountry('CN');
    if(typeof this.resolveCountryIsoCode==='function'){
      const iso=this.resolveCountryIsoCode(raw);
      const hit=iso&&this.findClockCountry(iso);
      if(hit) return hit;
    }
    return this.findClockCountry(raw)||this.findClockCountry('CN');
  },
  /**
   * 账号当地墙钟 → 中国（Asia/Shanghai）执行时间
   * @returns {{localAt:string,chinaAt:string,chinaIso:string,tz:string,countryCode:string,countryName:string,utcMs:number}|null}
   */
  convertLocalScheduleToChina(localStr,countryOrCode){
    const localAt=this.normalizeScheduleLocalInput(localStr);
    if(!localAt)return null;
    const hit=this.timezoneForCountryCode(countryOrCode);
    const tz=hit?.tz||'Asia/Shanghai';
    const utcMs=this.wallTimeInZoneToUtcMs(localAt.replace(' ','T'),tz);
    if(!Number.isFinite(utcMs))return null;
    const chinaAt=this.formatWallInZone(utcMs,'Asia/Shanghai');
    const chinaIso=`${chinaAt.replace(' ','T')}+08:00`;
    return {
      localAt,
      chinaAt,
      chinaIso,
      tz,
      countryCode:hit?.code||'CN',
      countryName:hit?.name||(typeof this.countryDisplayLabel==='function'?this.countryDisplayLabel(countryOrCode):String(countryOrCode||'中国'))||'中国',
      utcMs,
    };
  },
  accountCountryValue(account){
    if(!account)return '';
    return String(account.account_country||account.country||account.proxy_country||'').trim();
  },
  rememberAccountsForSchedule(accounts){
    if(!this._scheduleAccountMap) this._scheduleAccountMap=new Map();
    (accounts||[]).forEach(a=>{
      const id=Number(a?.id);
      if(id) this._scheduleAccountMap.set(id,a);
    });
  },
  async lookupAccountsForSchedule(ids){
    const want=[...new Set((ids||[]).map(Number).filter(Boolean))];
    if(!want.length)return [];
    if(!this._scheduleAccountMap) this._scheduleAccountMap=new Map();
    const missing=want.filter(id=>!this._scheduleAccountMap.has(id));
    if(missing.length){
      try{
        const pack=await this.api(`/accounts?pageSize=${Math.min(200,Math.max(missing.length,50))}&ids=${missing.join(',')}`);
        this.rememberAccountsForSchedule(pack.items||[]);
      }catch{
        try{
          const pack=await this.api('/accounts?pageSize=200');
          this.rememberAccountsForSchedule(pack.items||[]);
        }catch{}
      }
    }
    return want.map(id=>this._scheduleAccountMap.get(id)||{id,country:''});
  },
  buildSchedulePayloadFields(conv){
    if(!conv)return {};
    return {
      scheduleLocalAt:conv.localAt,
      scheduleCountry:conv.countryName,
      scheduleCountryCode:conv.countryCode,
      scheduleTimezone:conv.tz,
      scheduleChinaAt:conv.chinaAt,
    };
  },
  /** 当地墙钟 + 账号列表 → 中国执行时间与 payload 字段 */
  async resolveTaskScheduleFromLocal(localStr,accountIds){
    if(!localStr)return {scheduledAt:null,scheduleFields:{}};
    if(typeof this.ensureCountryOptions==='function'){
      try{await this.ensureCountryOptions()}catch{}
    }
    const accs=await this.lookupAccountsForSchedule(accountIds||[]);
    const country=this.accountCountryValue(accs[0]);
    const conv=this.convertLocalScheduleToChina(localStr,country||'CN');
    if(!conv)return {scheduledAt:null,scheduleFields:{}};
    const fields=this.buildSchedulePayloadFields(conv);
    // 逐账号明细：账号所在国家当地时间 + 对应中国时间（多账号跨国家时各自折算）
    fields.scheduleItems=accs.map(a=>{
      const c=this.convertLocalScheduleToChina(localStr,this.accountCountryValue(a)||'CN');
      return c?{accountId:Number(a.id)||0,username:a.username||'',country:c.countryName,countryCode:c.countryCode,timezone:c.tz,localAt:c.localAt,chinaAt:c.chinaAt}:null;
    }).filter(Boolean);
    return {scheduledAt:conv.chinaIso,scheduleFields:fields};
  },
  /** 任务列表/详情：当地定时 + 中国时间 */
  taskScheduleCellHtml(x){
    const p=x?.payload||{};
    const localAt=p.scheduleLocalAt||'';
    const country=p.scheduleCountry||p.scheduleCountryCode||'';
    const china=p.scheduleChinaAt||x?.scheduled_at||'';
    if(!localAt&&!china)return '<span class="muted">立即</span>';
    if(localAt&&country){
      return `<div class="task-schedule-cell"><div class="task-schedule-local">${this.esc(country)} ${this.esc(localAt)}</div><div class="task-schedule-china muted">中国 ${this.esc(china)}</div></div>`;
    }
    if(localAt){
      return `<div class="task-schedule-cell"><div class="task-schedule-local">${this.esc(localAt)}</div><div class="task-schedule-china muted">中国 ${this.esc(china||'-')}</div></div>`;
    }
    return `<span class="muted">${this.esc(china||'立即')}</span>`;
  },
  scheduleLocalInputValue(taskOrPayload,fallbackScheduledAt=''){
    const p=taskOrPayload?.payload||taskOrPayload||{};
    if(p.scheduleLocalAt)return String(p.scheduleLocalAt).replace(' ','T').slice(0,16);
    const raw=fallbackScheduledAt||taskOrPayload?.scheduled_at||p.scheduleChinaAt||'';
    if(!raw)return '';
    // 已是墙钟或 +08:00：直接取片段，禁止 toISOString（会变成 UTC）
    const m=String(raw).trim().match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})/);
    if(m)return `${m[1]}T${m[2]}`;
    try{
      const ms=new Date(raw).getTime();
      if(!Number.isFinite(ms))return '';
      return this.formatWallInZone(ms,'Asia/Shanghai').replace(' ','T').slice(0,16);
    }catch{return ''}
  },
  /** 定时发布时间字段：日历旁列表图标，预览各国折算中国时间 */
  scheduleAtFieldHtml(name,label,value='',opts={}){
    const preview=opts.preview||'wizard';
    const hint=opts.hint||'填写的是账号所在国家当地时间；实际入队按折算后的中国（Asia/Shanghai）时间执行。';
    const full=opts.full===false?'':' full';
    const listSvg=`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`;
    return `<div class="field schedule-tz-field${full}">
      <label>${this.esc(label)}</label>
      <div class="schedule-tz-input-row">
        <input class="input" name="${this.esc(name)}" type="datetime-local" value="${this.esc(value||'')}" placeholder="请输入${this.esc(label)}...">
        <button type="button" class="schedule-tz-preview-btn" data-ui-icon="off" title="查看各国对应中国时间" aria-label="查看各国对应中国时间" onclick="app.openPublishSchedulePreview('${this.esc(preview)}')">${listSvg}</button>
      </div>
      <div class="muted schedule-tz-hint">${this.esc(hint)}</div>
      <div class="field-error"></div>
    </div>`;
  },
  collectPublishScheduleAccountIds(source='wizard'){
    if(source==='wizard'){
      const w=this.wizard||{};
      if(this.wizardIsOrdered?.(w)){
        return [...new Set((w.pairs||[]).map(p=>Number(p.accountId)).filter(Boolean))];
      }
      const fromPick=this.selectedAccountPickIds?.('wizard-accounts')||[];
      const fromState=(w.accountIds||[]).map(Number).filter(Boolean);
      return [...new Set([...(fromPick.length?fromPick:fromState)])];
    }
    if(source==='task-modal'){
      const sel=[...(document.querySelector('#modal [name="accountIds"]')?.selectedOptions||[])].map(o=>Number(o.value)).filter(Boolean);
      return sel.length?sel:(this.selectedAccountPickIds?.('task-modal-accounts')||[]);
    }
    if(source==='material'){
      const v=Number(document.querySelector('#modal [name="accountId"]')?.value||0);
      return v?[v]:[];
    }
    if(source==='mass'){
      const fromPick=this.selectedAccountPickIds?.('mass-accounts')||[];
      const fromState=(this.mass?.accountIds||[]).map(Number).filter(Boolean);
      return [...new Set([...(fromPick.length?fromPick:fromState)])];
    }
    if(source==='warm'){
      const fromPick=typeof this.selectedWarmAccountIds==='function'?this.selectedWarmAccountIds():[];
      const fromDraft=(this._warmCreateDraft?.accountIds||this._warmEditSnapshot?.payload?.accountIds||[]).map(Number).filter(Boolean);
      return [...new Set([...(fromPick.length?fromPick:fromDraft)])];
    }
    return [];
  },
  async openPublishSchedulePreview(source='wizard'){
    const localStr=document.querySelector(`[name="scheduledAt"]`)?.value
      ||document.querySelector('#modal [name="scheduledAt"]')?.value
      ||document.querySelector('#warm-create-form [name="scheduledAt"]')?.value
      ||'';
    if(!localStr){this.toast('请先选择定时时间',true);return}
    const ids=this.collectPublishScheduleAccountIds(source);
    if(!ids.length){this.toast('请先选择账号',true);return}
    if(typeof this.ensureCountryOptions==='function'){
      try{await this.ensureCountryOptions()}catch{}
    }
    const accounts=await this.lookupAccountsForSchedule(ids);
    const rows=[];
    const seen=new Set();
    for(const a of accounts){
      const countryRaw=this.accountCountryValue(a);
      const conv=this.convertLocalScheduleToChina(localStr,countryRaw||'CN');
      if(!conv)continue;
      const key=`${conv.countryCode}|${conv.chinaAt}`;
      if(seen.has(key)){
        const hit=rows.find(r=>r.key===key);
        if(hit){hit.count+=1;hit.accounts.push(a.username||('#'+a.id));}
        continue;
      }
      seen.add(key);
      rows.push({
        key,
        country:conv.countryName,
        code:conv.countryCode,
        tz:conv.tz,
        localAt:conv.localAt,
        chinaAt:conv.chinaAt,
        count:1,
        accounts:[a.username||('#'+a.id)],
        missing:!countryRaw,
      });
    }
    if(!rows.length){this.toast('无法折算时区，请检查账号国家',true);return}
    const localNorm=this.normalizeScheduleLocalInput(localStr);
    const body=`<div class="schedule-tz-preview tk-modal-panel">
      <div class="schedule-tz-banner">
        <div class="schedule-tz-banner-kicker">当地定时</div>
        <div class="schedule-tz-banner-time">${this.esc(localNorm)}</div>
        <div class="schedule-tz-banner-desc">按下表账号国家折算为中国时间；实际入队 / 执行以中国时间为准。</div>
      </div>
      <div class="table-container schedule-tz-table">
        <table>
          <thead><tr><th>国家</th><th>账号当地时间</th><th>中国时间</th><th>时区</th><th>账号数</th></tr></thead>
          <tbody>${rows.map(r=>`<tr>
            <td>
              <div class="schedule-tz-country">${this.esc(r.country)}${r.missing?'<span class="schedule-tz-tag">未设·按中国</span>':''}</div>
              <div class="schedule-tz-accounts">${this.esc((r.accounts||[]).slice(0,3).join('、'))}${(r.accounts||[]).length>3?'…':''}</div>
            </td>
            <td><code class="schedule-tz-code">${this.esc(r.localAt)}</code></td>
            <td><span class="schedule-tz-china">${this.esc(r.chinaAt)}</span></td>
            <td><code class="schedule-tz-code is-tz">${this.esc(r.tz)}</code></td>
            <td><span class="schedule-tz-count">${r.count}</span></td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
    this.modal('各国对应中国时间',body,async()=>{},false,{hideSubmit:true,wide:true});
  },
  tickClock(){
    const el=document.querySelector('#clock');
    if(!el)return;
    try {
      const now = new Date();
      const tz = this.clockTimezone || 'Asia/Shanghai';
      const country = this.esc(this.clockCountryName || this.findClockCountry(this.clockCountryCode)?.name || '中国');
      const timeStr = now.toLocaleTimeString('zh-CN', { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateParts = new Intl.DateTimeFormat('zh-CN', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(now);
      const partMap = {};
      dateParts.forEach(p => { partMap[p.type] = p.value; });
      const dateStr = `${partMap.year || now.getFullYear()}-${partMap.month || ('0' + (now.getMonth() + 1)).slice(-2)}-${partMap.day || ('0' + now.getDate()).slice(-2)}`;
      const weekday = partMap.weekday || ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];
      el.innerHTML = `
        <button type="button" class="clock-icon" title="选择国家时钟" aria-label="选择国家时钟">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        </button>
        <div class="clock-stacked">
          <div class="clock-time-line">
            <span class="clock-time">${timeStr}</span>
            <span class="clock-weekday">${weekday}</span>
          </div>
          <div class="clock-date-line">
            <span class="clock-date">${dateStr}</span>
            <span class="clock-zone">${country}</span>
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
  loginRoleName(){
    return String(this.authLoginUser?.role||'').trim();
  },
  isLoginEnterpriseRole(){
    return this.loginRoleName()==='企业客户';
  },
  isLoginOperatorRole(){
    return this.loginRoleName().includes('运营专员');
  },
  isLoginOpsAdminRole(){
    return this.loginRoleName().includes('运营管理');
  },
  /** YouTube 开发配置：超管 / 运营管理 / system.youtube */
  canConfigYouTube(){
    if(!this.authEnabled)return true;
    if(this.authIsSuper||Number(this.authLoginUser?.roleId||this.authLoginUser?.role_id||0)===1)return true;
    if(typeof this.isLoginOpsAdminRole==='function'&&this.isLoginOpsAdminRole())return true;
    return typeof this.canLoginPermission==='function'&&this.canLoginPermission('system.youtube');
  },
  /** YouTube 账号与发布：超管 / 运营管理 / 运营专员 / 企业客户 / 权限节点 */
  canUseYouTube(){
    if(!this.authEnabled)return true;
    if(this.authIsSuper||Number(this.authLoginUser?.roleId||this.authLoginUser?.role_id||0)===1)return true;
    if(typeof this.isLoginOpsAdminRole==='function'&&this.isLoginOpsAdminRole())return true;
    if(typeof this.isLoginOperatorRole==='function'&&this.isLoginOperatorRole())return true;
    const rn=this.loginRoleName();
    if(rn.includes('企业客户'))return true;
    if(typeof this.canLoginPermission==='function'){
      if(this.canLoginPermission('system.youtube.use')||this.canLoginPermission('system.youtube.panel')||this.canLoginPermission('system.youtube')||this.canLoginPermission('youtube.manage'))return true;
      if(this.canLoginPermission('menu.781')||this.canLoginPermission('menu.782')||this.canLoginPermission('menu.783'))return true;
    }
    return false;
  },
  /** YouTube 数据面板：超管 / 运营管理 / 运营专员 / system.youtube.panel */
  canUseYouTubePanel(){
    if(!this.authEnabled)return true;
    if(this.authIsSuper||Number(this.authLoginUser?.roleId||this.authLoginUser?.role_id||0)===1)return true;
    if(typeof this.isLoginOpsAdminRole==='function'&&this.isLoginOpsAdminRole())return true;
    if(typeof this.isLoginOperatorRole==='function'&&this.isLoginOperatorRole())return true;
    if(typeof this.canLoginPermission==='function'){
      if(this.canLoginPermission('system.youtube.panel')||this.canLoginPermission('system.youtube.use')||this.canLoginPermission('youtube.manage')||this.canLoginPermission('menu.781'))return true;
    }
    return false;
  },
  isEnterpriseCustomerRole(){
    return String(this.authUser?.role||'').trim()==='企业客户';
  },
  isOperatorRole(){
    return String(this.authUser?.role||'').includes('运营专员');
  },
  canManageProxyGroups(){
    if(this.isOperatorRole())return false;
    return this.canAnyPermission('group.manage','group.create','group.update','group.delete');
  },
  canCreateAccounts(){
    if(this.isOperatorRole())return false;
    return this.canPermission('account.create');
  },
  canImportAccounts(){
    if(this.isOperatorRole())return false;
    return this.canPermission('account.import');
  },
  canExportAccounts(){
    if(this.isOperatorRole())return false;
    return this.canAnyPermission('account.export','account.view','account.create');
  },
  canBatchModifyAccounts(){
    if(this.isOperatorRole())return false;
    return this.canEditAccounts();
  },
  canEditAccounts(){
    if(this.isEnterpriseCustomerRole())return false;
    if(this.isOperatorRole())return this.canPermission('account.view');
    return this.canPermission('account.update');
  },
  isOpsAdminRole(){
    return String(this.authUser?.role||'').includes('运营管理');
  },
  effectiveRoleName(){
    return String(this.authUser?.role||'').trim();
  },
  /** 当前有效身份是否为超级管理员（含超管切到本人时） */
  isEffectiveSuperRole(){
    const roleId=Number(this.authUser?.roleId||this.authUser?.role_id||0);
    if(roleId===1)return true;
    return this.effectiveRoleName().includes('超级管理员');
  },
  /** 右下角任务执行开关 / 任务列表：按当前切换后的有效身份显示，非登录身份 */
  canShowExecutorControls(){
    if(this.isEffectiveSuperRole())return false;
    if(this.isEnterpriseCustomerRole())return false;
    return true;
  },
  canToggleExecutor(){
    return this.canShowExecutorControls();
  },
  canSwitchScope(){
    if(this.isLoginEnterpriseRole()||this.isLoginOperatorRole())return false;
    if(this.authIsSuper||this.isLoginOpsAdminRole())return true;
    return (this.authChildren||[]).length>0;
  },
  async ensureAuth(){try{const st=await this.api('/auth/status');this.authEnabled=!!st.authEnabled;this.authLoginUser=st.loginUser||st.user;this.authUser=st.user;this.authPermissions=Array.isArray(st.user?.permissions)?st.user.permissions:(Array.isArray(st.permissions)?st.permissions:[]);this.authChildren=Array.isArray(st.children)?st.children:[];this.authIsSuper=!!(st.isSuper||st.loginUser?.isSuper);this.authActingAs=st.actingAs||null;const want=this.getActingAsId();if(want&&!st.actingAs){localStorage.removeItem('tkswarm_acting_as')}if(this.isLoginEnterpriseRole()||this.isLoginOperatorRole()){localStorage.removeItem('tkswarm_acting_as');if(this.isExecutorEnabled())localStorage.setItem('tkswarm_executor_enabled','0')}if(!this.canShowExecutorControls()&&this.isExecutorEnabled())localStorage.setItem('tkswarm_executor_enabled','0');if(st.needsSetup){this.showSetupGate();return false}if(st.authEnabled&&!st.authenticated){this.showLoginGate();return false}this.hideAuthGate();this.renderUserChip();this.renderScopeSwitcher();return true}catch(e){this.toast(e.message,true);return true}},
  renderScopeSwitcher(){
    let box=document.querySelector('#scope-switcher');
    if(!box){
      box=document.createElement('div');
      box.id='scope-switcher';
      box.className='scope-switcher';
      document.body.appendChild(box);
    }
    const self=this.authLoginUser||this.authUser;
    const children=this.authChildren||[];
    const acting=this.authActingAs;
    const actingId=this.getActingAsId();
    const isEnterprise=this.isEnterpriseCustomerRole();
    const isLoginOpsAdmin=this.isLoginOpsAdminRole();
    const showScope=this.canSwitchScope()&&!!(self&&self.id);
    const showExecutor=this.canShowExecutorControls();
    const execOn=showExecutor&&this.isExecutorEnabled();
    if(isEnterprise&&!showScope&&!showExecutor){
      box.classList.add('hidden');
      box.innerHTML='';
      this.executorEnabled=false;
      this.syncExecutorWsStatus();
      return;
    }
    box.classList.remove('hidden');

    const selfLabel=this.esc((self&&(self.nickname||self.username))||'本人');
    const currentLabel=acting
      ? `当前 · ${this.esc((this.authUser?.nickname||this.authUser?.username)||acting.nickname||acting.username)}`
      : `本人 · ${selfLabel}`;
    const childBtns=children.map(c=>{
      const active=actingId&&Number(actingId)===Number(c.id)?'active':'';
      return `<button type="button" class="scope-item ${active}" onclick="app.switchActingAs(${c.id})"><b>${this.esc(c.nickname||c.username)}</b><span>@${this.esc(c.username)}</span></button>`;
    }).join('');
    const superExtra=(this.authIsSuper||isLoginOpsAdmin)
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
          <b>本人数据</b>
          <span>${selfLabel}</span>
        </button>
        ${childBtns?`<div class="scope-section">子级账号</div>${childBtns}`:''}
        ${superExtra}
      </div>`:'';

    const executorBtn=showExecutor?`
          <button type="button" class="executor-toggle ${execOn?'is-on':''}" id="executor-toggle-btn"
            onclick="app.toggleExecutorEnabled()" title="${execOn?'任务执行中：点击关闭':'已关闭：点击开启任务执行'}">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              ${execOn
                ? '<rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/>'
                : '<polygon points="7 4 20 12 7 20 7 4"/>'}
            </svg>
          </button>`:'';
    const workListBtn=showExecutor?`
          <button type="button" class="scope-tool-btn" id="scope-work-list-btn"
            onclick="app.navigate('accountWork')" title="打开矩阵任务列表">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </button>`:'';
    box.innerHTML=`
      <div class="scope-dock">
        ${(executorBtn||workListBtn)?`<div class="scope-dock-tools">${executorBtn}${workListBtn}</div>`:''}
        ${scopeBtn}
      </div>
      ${scopePanel}`;
    if((this.authIsSuper||isLoginOpsAdmin)&&showScope) this.loadScopeUserOptions();
    this.syncExecutorWsStatus();
  },
  isExecutorEnabled(){
    return localStorage.getItem('tkswarm_executor_enabled')==='1';
  },
  setExecutorEnabled(on){
    if(!this.canToggleExecutor()){
      localStorage.setItem('tkswarm_executor_enabled','0');
      this.executorEnabled=false;
      this.syncExecutorWsStatus();
      return;
    }
    localStorage.setItem('tkswarm_executor_enabled', on?'1':'0');
    this.executorEnabled=!!on;
    this.syncExecutorWsStatus();
    this.renderScopeSwitcher();
    this.toast(on?'已开启任务执行：将通过 WSS 接收任务并调用本地浏览器执行':'已关闭任务执行：不再接单');
    if(on) this.api('/executor/poll',{method:'POST',body:'{}'}).catch(()=>{});
  },
  toggleExecutorEnabled(){
    this.setExecutorEnabled(!this.isExecutorEnabled());
  },
  /** 任务执行/推送的数据归属：切换身份后为被切换用户，否则为当前有效用户 */
  getExecutorScopeOwnerId(){
    const acting=this.getActingAsId();
    if(acting)return Number(acting);
    return Number(this.authUser?.id||this.authLoginUser?.id||0);
  },
  syncExecutorWsStatus(){
    const on=this.isExecutorEnabled();
    this.executorEnabled=on;
    if(this.ws&&this.ws.readyState===1){
      const loginId=Number(this.authLoginUser?.id||this.authUser?.id||0);
      const actingAs=this.getActingAsId()||'';
      const ownerId=this.getExecutorScopeOwnerId();
      this.ws.send(JSON.stringify({
        type:'executor-status',
        enabled:on,
        userId:loginId,
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
  /** 自研浏览器本机任务并发上限（基础设置 taskConcurrency，默认 6，范围 3–20） */
  async getTaskConcurrencyLimit(){
    const now=Date.now();
    if(this._taskConcurrencyCached!=null&&this._taskConcurrencyCachedAt&&(now-this._taskConcurrencyCachedAt)<30000){
      return this._taskConcurrencyCached;
    }
    let n=6;
    try{
      const st=await this.api('/settings');
      n=Number(st?.taskConcurrency??6);
    }catch(_){
      try{
        const stats=await this.api('/executor/status');
        n=Number(stats?.maxConcurrent??6);
      }catch(__){ n=6; }
    }
    if(!Number.isFinite(n)) n=6;
    n=Math.min(20,Math.max(3,Math.floor(n)));
    this._taskConcurrencyCached=n;
    this._taskConcurrencyCachedAt=now;
    return n;
  },
  async handleWorkPush(payload){
    const batch=payload?.batch||payload;
    if(!batch||!batch.id)return;
    if(!this.isExecutorEnabled()){
      this.toast(`收到任务 #${batch.id} 但执行已关闭，已忽略`,true);
      return;
    }
    const scopeOwner=this.getExecutorScopeOwnerId();
    const batchOwner=Number(batch.owner_id||batch.ownerId||payload?.ownerId||0);
    if(batchOwner>0&&scopeOwner>0&&batchOwner!==scopeOwner){
      this.toast(`收到任务 #${batch.id} 但不属于当前身份(owner ${batchOwner}≠${scopeOwner})，已忽略`,true);
      return;
    }
    const batchId=Number(batch.id);
    this._executorBatchIds=this._executorBatchIds||[];
    if(this._executorBatchIds.includes(batchId))return;
    // 本机并发：读基础设置 taskConcurrency（默认 6，3–20）；已满则忽略此次推送（Node 侧也会按槽位控制）
    const maxConc=await this.getTaskConcurrencyLimit();
    if((this._executorRunning||0)>=maxConc){
      this.toast(`收到任务 #${batchId}，但本机已满 ${maxConc} 路执行中，稍后再领`,true);
      return;
    }
    const acc=batch.account||{};
    const taskLabel=String(payload?.taskLabel||batch.task_label||batch.taskLabel||'').trim();
    const labelPart=taskLabel?` · ${taskLabel}`:'';
    this.toast(`收到任务 #${batchId}${labelPart} · ${acc.username||('账号#'+(batch.account_id||''))}，正在调浏览器执行…`);
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
      const rows=await this.api('/auth/switchable-users');
      this._scopeUsers=Array.isArray(rows)?rows:[];
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
  waitUiPaint(){
    return new Promise((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  },
  showScopeSwitchLoading(text,desc){
    if(window.UI)UI.loading(true,text||'正在切换身份',desc||'正在加载菜单与权限…',{plain:true});
  },
  hideScopeSwitchLoading(){
    if(window.UI)UI.loading(false);
  },
  async switchActingAs(userId){
    if(this._scopeSwitching)return;
    this._scopeSwitching=true;
    const panel=document.querySelector('#scope-panel');
    if(panel)panel.classList.add('hidden');
    const sidePanel=document.querySelector('#account-sidebar-owner-panel');
    if(sidePanel)sidePanel.classList.add('hidden');
    this.showScopeSwitchLoading();
    const loginId=Number(this.authLoginUser?.id||0);
    try{
      if(userId==null||userId===''||userId===0){
        localStorage.removeItem('tkswarm_acting_as');
        localStorage.removeItem('tkswarm_switch_from');
      }else{
        localStorage.setItem('tkswarm_acting_as', String(userId));
        if(loginId>0)localStorage.setItem('tkswarm_switch_from', String(loginId));
      }
      await this.ensureAuth();
      await Promise.all([this.loadRefs({force:true}), this.loadNavigationMenus()]);
      if(!this.canNavigateMenu(this.view,this.subview)){
        const route=this.firstAccessibleRoute();
        if(route)await this.navigate(route.view,route.subview||'');
        else await this.refresh();
      }else{
        await this.refresh();
      }
      await this.waitUiPaint();
      this.renderScopeSwitcher();
      this.syncExecutorWsStatus();
      if(this.isExecutorEnabled?.()){
        this.api('/executor/poll',{method:'POST',body:'{}'}).catch(()=>{});
      }
      const label=this.authActingAs
        ? `已切换到子账号：${this.authActingAs.nickname||this.authActingAs.username}`
        : '已回到本人数据';
      this.toast(label);
    }catch(e){
      this.toast(e.message||'切换失败',true);
    }finally{
      this._scopeSwitching=false;
      this.hideScopeSwitchLoading();
    }
  },
  /** 与后端 PermissionCatalog::aliases 对齐 */
  permissionAliases(code){
    const c=String(code||'');
    const map={
      'matrix.publish':['publish.tasks','publish.tasks.view','publish.tasks.create'],
      'matrix.mass':['publish.mass','publish.mass.view','publish.mass.create'],
      // 粗粒度仅兼容旧码；细节点不得反向满足粗粒度
      'publish.tasks':['matrix.publish'],
      'publish.mass':['matrix.mass'],
      'publish.tasks.view':['publish.tasks','matrix.publish','publish.mass','warm.tasks'],
      'publish.tasks.create':['publish.tasks','matrix.publish'],
      'publish.tasks.update':['publish.tasks','matrix.publish'],
      'publish.tasks.delete':['publish.tasks','matrix.publish'],
      'publish.mass.view':['publish.mass','matrix.mass','publish.tasks'],
      'publish.mass.create':['publish.mass','matrix.mass'],
      'publish.mass.update':['publish.mass','matrix.mass'],
      'publish.mass.delete':['publish.mass','matrix.mass'],
      'warm.tasks':['publish.tasks','matrix.publish','account.create'],
      'warm.view':['warm.tasks','publish.tasks'],
      'warm.create':['warm.tasks'],
      'warm.update':['warm.tasks'],
      'warm.delete':['warm.tasks'],
      'publish.materials':['publish.tasks','matrix.publish'],
      'publish.materials.view':['publish.materials','publish.tasks'],
      'publish.materials.create':['publish.materials'],
      'publish.materials.update':['publish.materials'],
      'publish.materials.delete':['publish.materials'],
      'account.import':['account.create'],
      'account.update':['account.create'],
      'proxy.import':['proxy.create'],
      'proxy.update':['proxy.create'],
      'proxy.delete':['proxy.create'],
      'group.view':['group.manage','account.view'],
      'group.create':['group.manage'],
      'group.update':['group.manage'],
      'group.delete':['group.manage'],
      'group.assign':[],
      'group.manage':[],
      'account.work':['account.work.pause','account.work.delete','account.work.reset','account.create','publish.tasks','matrix.publish'],
      'account.work.pause':['account.work','account.create','publish.tasks','matrix.publish'],
      'account.work.delete':['account.work','account.create','publish.tasks','matrix.publish'],
      'account.work.reset':['account.work','account.create','publish.tasks','matrix.publish'],
      'account.msg_template':['account.msg_template.comment','account.msg_template.dm'],
      'account.msg_template.comment':['account.msg_template','chat.manage','account.create','publish.tasks'],
      'account.msg_template.dm':['account.msg_template','chat.manage','account.create','publish.tasks'],
      'account.export':['account.view','account.create'],
      'logs.view':['account.view','rbac.manage','rbac.logs.view','rbac.log'],
      'agent.view':['agent.manage','agent.create','agent.update'],
      'agent.manage':[],
      'agent.create':['agent.manage'],
      'agent.update':['agent.manage'],
      'agent.delete':['agent.manage'],
      'system.view':['rbac.manage','system.versions','system.help','system.tickets','system.settings.view','system.settings.update'],
      'system.settings.view':['system.view','rbac.manage'],
      'system.settings.update':['system.view','rbac.manage'],
      'chat.view':['chat.manage','chat.send'],
      'chat.update':['chat.manage'],
      'chat.manage':[],
      'ai.leads':[],
      'ai.leads.view':['ai.leads'],
      'ai.leads.create':['ai.leads'],
      'ai.leads.update':['ai.leads'],
      'ai.leads.delete':['ai.leads'],
      'rbac.manage':[],
      'rbac.log':['rbac.logs.view','rbac.manage'],
      'rbac.logs.view':['rbac.log','rbac.manage'],
      'rbac.logs.clear':['rbac.manage'],
      'rbac.users.view':['rbac.manage','rbac.users.create','rbac.users.update'],
      'rbac.users.create':['rbac.manage'],
      'rbac.users.update':['rbac.manage'],
      'rbac.users.delete':['rbac.manage'],
      // 自研浏览器额度：不挂 rbac.manage；超管凭 * 命中，也可显式授权
      'rbac.users.browser_quota':[],
      'rbac.roles.view':['rbac.manage','rbac.roles.create','rbac.roles.update'],
      'rbac.roles.create':['rbac.manage'],
      'rbac.roles.update':['rbac.manage'],
      'rbac.roles.delete':['rbac.manage'],
      'rbac.permissions.view':['rbac.manage','rbac.permissions.create','rbac.permissions.update'],
      'rbac.permissions.create':['rbac.manage'],
      'rbac.permissions.update':['rbac.manage'],
      'rbac.permissions.delete':['rbac.manage'],
      'rbac.menus.view':['rbac.manage','rbac.menus.update'],
      'rbac.menus.update':['rbac.manage'],
      'rbac.country_data':['rbac.manage'],
      'rbac.country_data.view':['rbac.country_data','rbac.manage','rbac.country_data.create','rbac.country_data.update'],
      'rbac.country_data.create':['rbac.country_data','rbac.manage'],
      'rbac.country_data.update':['rbac.country_data','rbac.manage'],
      'rbac.country_data.delete':['rbac.country_data','rbac.manage'],
      'rbac.industry_data':['rbac.manage'],
      'rbac.industry_data.view':['rbac.industry_data','rbac.manage','rbac.industry_data.create','rbac.industry_data.update'],
      'rbac.industry_data.create':['rbac.industry_data','rbac.manage'],
      'rbac.industry_data.update':['rbac.industry_data','rbac.manage'],
      'rbac.industry_data.delete':['rbac.industry_data','rbac.manage'],
      'rbac.company_data':['rbac.manage','rbac.industry_data'],
      'rbac.company_data.view':['rbac.company_data','rbac.manage','rbac.company_data.create','rbac.company_data.update'],
      'rbac.company_data.create':['rbac.company_data','rbac.manage'],
      'rbac.company_data.update':['rbac.company_data','rbac.manage'],
      'rbac.company_data.delete':['rbac.company_data','rbac.manage'],
      'system.youtube':[],
      'system.youtube.use':['system.youtube','youtube.manage','system.youtube.panel','menu.781','menu.782','menu.783'],
      'system.youtube.panel':['system.youtube.use','youtube.manage','menu.781'],
      'youtube.manage':['system.youtube.use','system.youtube.panel'],
    };
    return map[c]||[];
  },
  /** 资源 CRUD 快捷判断：view / create / update / delete */
  canCrud(resource,action){
    const a=String(action||'view');
    const r=String(resource||'');
    if(!r)return false;
    return this.canPermission(`${r}.${a}`);
  },
  canPermission(code){
    if(!this.authEnabled)return true;
    if(!code)return true;
    const list=this.authPermissions||[];
    if(list.includes('*')||list.includes('admin'))return true;
    if(!list.length)return String(this.authUser?.role||'').toLowerCase()==='admin';
    if(list.includes(code))return true;
    return this.permissionAliases(code).some((alt)=>list.includes(alt));
  },
  /** 按登录账号权限判断（不受身份切换影响） */
  canLoginPermission(code){
    if(!this.authEnabled)return true;
    if(!code)return true;
    if(this.authIsSuper||Number(this.authLoginUser?.roleId||this.authLoginUser?.role_id||0)===1)return true;
    const list=Array.isArray(this.authLoginUser?.permissions)?this.authLoginUser.permissions:(this.authPermissions||[]);
    if(list.includes('*')||list.includes('admin'))return true;
    if(list.includes(code))return true;
    return this.permissionAliases(code).some((alt)=>list.includes(alt));
  },
  canAnyPermission(...codes){
    return codes.flat().some((c)=>this.canPermission(c));
  },
  renderPageDenied(msg='当前角色无权访问此页面'){
    const host=document.querySelector('#content');
    if(host) host.innerHTML=`<div class="panel"><div class="empty">${this.esc(msg)}</div></div>`;
    return false;
  },
  ensurePageAccess(ok,msg){
    if(ok) return true;
    return this.renderPageDenied(msg);
  },
  permNormModule(mod){
    const m=String(mod||'system');
    return m==='matrix'?'publish':m;
  },
  permModuleLabel(mod){
    const m=this.permNormModule(mod);
    const hit=(this.meta?.permModules||[]).find(x=>x.code===m);
    return hit?.label||m;
  },
  permSubgroupPairs(){
    return this.dictPairs(this.meta?.permSubgroups, [
      ['account.view','账号·列表'],['account.create','账号·添加'],['account.update','账号·编辑'],
      ['account.delete','账号·删除'],['account.import','账号·导入'],['account.export','账号·导出'],
      ['account.work','矩阵任务'],['account.msg_template','消息模板'],
      ['proxy.view','代理·列表'],['proxy.create','代理·添加'],['proxy.update','代理·编辑'],['proxy.delete','代理·删除'],
      ['group.view','分组·列表'],['group.create','分组·添加'],['group.update','分组·编辑'],['group.delete','分组·删除'],['group.assign','分组·分配用户'],
      ['publish.tasks','发布任务'],['publish.mass','群发任务'],['publish.materials','素材管理'],
      ['warm.tasks','养号任务'],['chat.manage','客服管理'],['chat.send','客服发送'],
      ['agent.view','智能体查看'],['agent.manage','智能体管理'],['ai.leads','AI拓客'],
      ['rbac.users','管理用户'],['rbac.roles','用户角色'],['rbac.permissions','权限节点'],
      ['rbac.logs','操作日志'],['rbac.menus','后台菜单'],
      ['rbac.country_data','国家数据'],['rbac.industry_data','行业数据'],['rbac.company_data','企业数据'],
      ['rbac.manage','角色权限(总控)'],['logs.view','实时日志'],
      ['menu.visible','菜单节点'],['system.view','系统设置'],
    ]);
  },
  permSubgroupKey(code){
    const c=String(code||'');
    if(c.startsWith('menu.')) return 'menu.visible';
    // rbac.users.view → rbac.users；publish.tasks.create → publish.tasks
    const m=c.match(/^(rbac\.(?:users|roles|permissions|logs|menus|country_data|industry_data|company_data)|publish\.(?:tasks|mass|materials)|warm|account\.work|account\.msg_template|ai\.leads|agent|system\.settings)\./);
    if(m) return m[1]==='warm'?'warm.tasks':(m[1]==='agent'?'agent.manage':(m[1]==='system.settings'?'system.view':m[1]));
    const parts=c.split('.');
    if(parts.length<=2) return c;
    return parts.slice(0,2).join('.');
  },
  permSubgroupLabel(key){
    const k=String(key||'');
    const hit=(this.meta?.permSubgroups||[]).find(x=>x.code===k);
    if(hit) return hit.label;
    const fb=Object.fromEntries(this.permSubgroupPairs());
    return fb[k]||k;
  },
  canView(view){
    if(!this.authEnabled)return true;
    const list=this.authPermissions||[];
    if(list.includes('*')||list.includes('admin'))return true;
    if(this.hasMenuPermissionMode())return this.hasAccessibleMenuForView(view);
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
    return this.dictPairs(this.meta?.permModules, [
      ['account','账号中心'],['proxy','代理IP'],['publish','矩阵发布'],['chat','客服聚合'],
      ['agent','AI智能体'],['ai','AI营销'],['group','业务分组'],['logs','操作日志'],
      ['rbac','权限管理'],['system','系统管理'],['menu','菜单可见性'],
    ]);
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
  tkswarmBrowserLabel(){return '第一页自研浏览器'},
  tkswarmLinuxBrowserLabel(){return '第一页自研浏览器 Linux'},
  /** 比特浏览器相关 UI 暂隐（任务选择 / 设置 / 环境绑定） */
  bitBrowserUiEnabled(){return false},
  defaultTaskBrowserBackend(){return this.bitBrowserUiEnabled()?'bit':'tkswarm'},
  browserTypePairs(){
    const rows=(this.meta?.browserTypes||[]).filter(x=>x.ready!==false);
    const fallback=this.bitBrowserUiEnabled()
      ?[['bit','比特浏览器'],['tkswarm',this.tkswarmBrowserLabel()]]
      :[['tkswarm',this.tkswarmBrowserLabel()]];
    const base=this.dictPairs(rows, fallback);
    // Linux 服务器浏览器只跑 AI 拓客 / 客服坐席；与桌面共用 EL 环境包，缺包等待本机推送，不手动绑定。
    let out=base.filter(([v])=>String(v).toLowerCase()!=='linux');
    if(!this.bitBrowserUiEnabled())out=out.filter(([v])=>String(v).toLowerCase()!=='bit');
    const has=code=>out.some(([v])=>String(v)===code);
    if(!has('tkswarm'))out.push(['tkswarm',this.tkswarmBrowserLabel()]);
    return out;
  },
  /** 创建任务时选择本地浏览器后端（比特 UI 隐藏时仅自研） */
  browserBackendTaskPairs(){
    if(!this.bitBrowserUiEnabled())return [['tkswarm',this.tkswarmBrowserLabel()]];
    return [['bit','比特浏览器'],['tkswarm',this.tkswarmBrowserLabel()]];
  },
  /** 允许服务器浏览器（Linux）的任务：AI 拓客 / 客服坐席，其它任务不允许选 */
  browserBackendTaskPairsWithServer(){
    return [...this.browserBackendTaskPairs(),['linux',this.tkswarmLinuxBrowserLabel()+'（服务器）']];
  },
  browserBackendTaskLabel(code){
    const v=String(code||this.defaultTaskBrowserBackend()).toLowerCase();
    if(v==='linux')return this.tkswarmLinuxBrowserLabel();
    if(v==='tkswarm')return this.tkswarmBrowserLabel();
    return this.bitBrowserUiEnabled()?'比特浏览器':this.tkswarmBrowserLabel();
  },
  /** 归一化任务浏览器后端；allowServer=false 时 linux 降回默认本地后端 */
  normalizeTaskBackend(value,allowServer=false){
    const def=this.defaultTaskBrowserBackend();
    const s=String(value==null||value===''?def:value).toLowerCase().trim();
    if(s==='linux'||s==='tkswarm-linux'||s==='tkswarm-linuxbrowse')return allowServer?'linux':def;
    if(s==='tkswarm')return 'tkswarm';
    if(s==='bit')return this.bitBrowserUiEnabled()?'bit':def;
    return def;
  },
  selectBrowserBackendField(name,value,hint,opts={}){
    const allowServer=opts.server===true;
    const v=this.normalizeTaskBackend(value,allowServer);
    const tip=hint||'账号需在对应浏览器中已绑定环境；执行时按此选择打开窗口';
    const pairs=allowServer?this.browserBackendTaskPairsWithServer():this.browserBackendTaskPairs();
    // 比特 UI 已隐藏且仅自研可选时：不展示下拉，避免再看到「比特浏览器」
    if(pairs.length<=1){
      const only=pairs[0]||['tkswarm',this.tkswarmBrowserLabel()];
      const code=only[0];
      const label=only[1];
      return `<div class="field"><label>执行浏览器</label>
        <input type="hidden" name="${this.esc(name)}" value="${this.esc(code)}">
        <div class="input" style="display:flex;align-items:center;background:#f8fafc">${this.esc(label)}</div>
      </div><div class="field full"><div class="muted">${this.esc(tip)}</div></div>`;
    }
    return `${this.selectRaw(name,'执行浏览器',pairs,v)}<div class="field full"><div class="muted">${this.esc(tip)}</div></div>`;
  },
  async ensureBrowserBackendOnline(backend,actionLabel='该操作',opts={}){
    const raw=String(backend||'').toLowerCase();
    const want=this.normalizeTaskBackend(raw,true)==='linux'?'linux':this.normalizeTaskBackend(raw);
    // 刚探测过且在线的后端短时间内直接复用，省掉开窗前的这次往返（连续开窗时最明显）
    const ttl=Number(opts.ttlMs||8000);
    const cache=this._backendOnlineCache||(this._backendOnlineCache={});
    const hit=cache[want];
    if(!opts.fresh&&hit&&hit.online&&Date.now()-hit.at<ttl)return {...hit.st,_taskBrowserBackend:want};
    // 直接按目标后端探测：用该后端自己的 URL / Token，不受全局配置与端口影响
    try{
      const st=await this.api(`/browser/status?browserBackend=${encodeURIComponent(want)}`);
      if(st?.online&&st?.bitLoggedIn!==false){
        this._bitOnlineAt=Date.now();
        cache[want]={online:true,at:Date.now(),st};
        return {...st,_taskBrowserBackend:want};
      }
      cache[want]={online:false,at:Date.now()};
      const label=st?.providerLabel||this.browserBackendTaskLabel(want);
      this.toast(`${actionLabel}需要【${label}】在线：${st?.message||'请先启动该客户端并开启本地 API'}（当前：${st?.apiUrl||'-'}）`,true,7000);
      return null;
    }catch(e){
      cache[want]={online:false,at:Date.now()};
      this.toast(`${actionLabel}前检测【${this.browserBackendTaskLabel(want)}】失败：${e.message||'未连接'}`,true,7000);
      return null;
    }
  },
  taskStatusPairs(){return this.dictPairs(this.meta?.taskStatuses, [['draft','草稿'],['queued','排队中'],['running','运行中'],['paused','已暂停'],['completed','已完成'],['failed','失败'],['cancelled','已取消']])},
  massTargetPairs(){return this.dictPairs(this.meta?.massTargets, [['imported','导入好友'],['new','新好友'],['unreplied','未回复好友'],['followers','粉丝/互关'],['fixed','固定对象']])},
  massChannelMeta(code){return (this.meta?.massChannels||[]).find(x=>x.code===code)||null},
  /** 群发通道选项：比特 UI 隐藏时仅自研 */
  massChannelPairs(){
    const rows=this.meta?.massChannels||[];
    let pairs=this.dictPairs(rows,[['tkswarm',this.tkswarmBrowserLabel()]]);
    if(!this.bitBrowserUiEnabled())pairs=pairs.filter(([v])=>String(v).toLowerCase()!=='bit');
    if(!pairs.length)pairs=[['tkswarm',this.tkswarmBrowserLabel()]];
    return pairs;
  },
  defaultMassChannel(){
    const pairs=this.massChannelPairs();
    const def=this.defaultTaskBrowserBackend();
    if(pairs.some(([v])=>v===def))return def;
    return pairs[0]?.[0]||'tkswarm';
  },
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
    this.mountHumanVerifyBell(box);
    if(this.authUser){
      const username = this.esc(this.authUser.username || 'Admin');
      const role = this.esc(this.authUser.role || '管理员');
      const actingHint=this.authActingAs&&this.authLoginUser
        ?`<span class="user-acting-hint" title="登录账号：${this.esc(this.authLoginUser.username||'')}">切换中</span>`
        :'';
      const initial = (this.authUser.username || 'A').slice(0, 1).toUpperCase();

      const userMenuWrapper = document.createElement('div');
      userMenuWrapper.className = 'user-dropdown-wrap';
      userMenuWrapper.id = 'user-dropdown-wrap';
      userMenuWrapper.innerHTML = `
        <button type="button" class="user-trigger-btn" id="user-menu-trigger" aria-haspopup="true" aria-expanded="false">
          <div class="user-avatar-badge">${initial}</div>
          <div class="user-name-role">
            <span class="user-name">${username}${actingHint}</span>
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
  mountHumanVerifyBell(box){
    if(!box)return;
    let wrap=document.querySelector('#hv-bell-wrap');
    if(wrap&&wrap.parentElement!==box){
      wrap.remove();
      wrap=null;
    }
    if(!wrap){
      wrap=document.createElement('div');
      wrap.className='hv-bell-wrap';
      wrap.id='hv-bell-wrap';
      wrap.innerHTML=`
        <button type="button" class="hv-bell-btn" id="hv-bell-btn" aria-label="人工验证通知" title="人工验证通知">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <span class="hv-bell-badge hidden" id="hv-bell-badge">0</span>
        </button>
        <div class="hv-bell-panel hidden" id="hv-bell-panel">
          <div class="hv-bell-head">
            <b>人工验证</b>
            <button type="button" class="ghost tiny" id="hv-bell-refresh">刷新</button>
          </div>
          <div class="hv-bell-list" id="hv-bell-list"><div class="hv-bell-empty">暂无待处理验证</div></div>
        </div>`;
      box.appendChild(wrap);
      const btn=wrap.querySelector('#hv-bell-btn');
      const panel=wrap.querySelector('#hv-bell-panel');
      btn.onclick=(e)=>{
        e.stopPropagation();
        const willShow=panel.classList.contains('hidden');
        document.querySelectorAll('.user-dropdown-menu,.hv-bell-panel').forEach(el=>el.classList.add('hidden'));
        document.querySelector('#user-menu-trigger')?.classList.remove('active');
        if(willShow){
          panel.classList.remove('hidden');
          btn.classList.add('active');
          void this.refreshHumanVerifyNotices(true);
        }else{
          btn.classList.remove('active');
        }
      };
      wrap.querySelector('#hv-bell-refresh').onclick=(e)=>{
        e.stopPropagation();
        void this.refreshHumanVerifyNotices(true);
      };
    }else if(!wrap.parentElement){
      box.appendChild(wrap);
    }
    if(!this._hvPollStarted){
      this._hvPollStarted=true;
      this.humanVerifyItems=this.humanVerifyItems||[];
      void this.refreshHumanVerifyNotices(false);
      setInterval(()=>void this.refreshHumanVerifyNotices(false),20000);
    }else{
      this.renderHumanVerifyBell();
    }
  },
  async refreshHumanVerifyNotices(force){
    if(!this.authToken&&this.authEnabled)return;
    try{
      const data=await this.api('/human-verify/pending?limit=30');
      const items=Array.isArray(data?.items)?data.items:(Array.isArray(data)?data:[]);
      const prev=Number(this.humanVerifyCount||0);
      this.humanVerifyItems=items;
      this.humanVerifyCount=Number(data?.count??items.length)||0;
      this.renderHumanVerifyBell();
      if(force!==false&&this.humanVerifyCount>prev){
        this.playTipSound();
        this.notifyDesktopHumanVerify(items[0]);
      }
    }catch{
      /* 无权限/未登录时静默 */
    }
  },
  renderHumanVerifyBell(){
    const badge=document.querySelector('#hv-bell-badge');
    const btn=document.querySelector('#hv-bell-btn');
    const list=document.querySelector('#hv-bell-list');
    const n=Number(this.humanVerifyCount||0);
    if(badge){
      if(n>0){
        badge.textContent=n>99?'99+':String(n);
        badge.classList.remove('hidden');
      }else{
        badge.classList.add('hidden');
      }
    }
    if(btn)btn.classList.toggle('has-alert',n>0);
    if(!list)return;
    const items=this.humanVerifyItems||[];
    if(!items.length){
      list.innerHTML='<div class="hv-bell-empty">暂无待处理验证</div>';
      return;
    }
    const taskLabel=(t)=>{
      const map={publish:'发布',warm:'养号',message:'私信',dm_reply:'私信回复',ai_lead:'AI拓客',ai_lead_dm:'AI私信',auto_follow:'增粉',video_boost:'视频增值',modify_profile:'改资料',comment_reply:'回评',pull_stats:'拉数据',pull_comments:'拉评论'};
      return map[t]||t||'任务';
    };
    list.innerHTML=items.map(it=>{
      const acc=this.esc(it.accountUsername||it.accountNickname||(`#${it.accountId||''}`));
      const reason=this.esc(it.reason||'需要人工完成 TikTok 验证');
      const meta=`账号 ${acc} · ${this.esc(taskLabel(it.taskType))} · 总任务#${it.batchId||'-'} 分任务#${it.itemId||'-'}`;
      return `<div class="hv-bell-item" data-id="${it.id}">
        <div class="hv-bell-item-main">
          <b>${reason}</b>
          <small>${meta}</small>
        </div>
        <div class="hv-bell-item-actions">
          <button type="button" class="primary tiny" onclick="app.resolveHumanVerify(${it.id},'resume')">已完成验证，恢复</button>
          <button type="button" class="ghost tiny" onclick="app.resolveHumanVerify(${it.id},'dismiss')">忽略</button>
        </div>
      </div>`;
    }).join('');
  },
  async resolveHumanVerify(id,action){
    try{
      await this.api(`/human-verify/${id}/resolve`,{method:'POST',body:JSON.stringify({action:action||'resume'})});
      this.toast(action==='dismiss'?'已忽略':'已确认，任务将继续执行');
      await this.refreshHumanVerifyNotices(false);
      if(this.view==='accountWork'||this.view==='tasks')await this.refresh?.();
    }catch(e){this.toast(e.message||'操作失败',true)}
  },
  onHumanVerifyPush(data){
    const row=data&&typeof data==='object'?data:null;
    if(!row)return;
    this.humanVerifyItems=this.humanVerifyItems||[];
    const id=Number(row.id||0);
    if(id>0&&!this.humanVerifyItems.some(x=>Number(x.id)===id)){
      this.humanVerifyItems.unshift(row);
    }
    this.humanVerifyCount=Math.max(Number(this.humanVerifyCount||0),this.humanVerifyItems.length,id>0?1:0);
    if(row.status==='pending'||!row.status){
      this.humanVerifyCount=Math.max(this.humanVerifyCount,1);
    }
    this.renderHumanVerifyBell();
    this.playTipSound();
    this.notifyDesktopHumanVerify(row);
    this.toast(`需要人工验证：账号 #${row.accountId||'?'} ${row.reason||''}`.slice(0,80),true);
  },
  notifyDesktopHumanVerify(row){
    try{
      if(typeof Notification==='undefined')return;
      const title='TkSwarm · 需要人工验证';
      const body=`账号 #${row?.accountId||'?'}：${row?.reason||'请在浏览器完成滑块/人机验证后点恢复'}`;
      const show=()=>{try{new Notification(title,{body:String(body).slice(0,120),tag:'hv-'+(row?.id||Date.now())})}catch{}};
      if(Notification.permission==='granted')show();
      else if(Notification.permission!=='denied')Notification.requestPermission().then(p=>{if(p==='granted')show()});
    }catch{}
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
      localStorage.removeItem('tkswarm_acting_as');
      localStorage.removeItem('tkswarm_switch_from');
      this.syncBrowserAuthToken(r.token).catch(()=>{});

      // 不可依赖 location.replace 同 hash（退出后常已是 #/accounts，不会触发刷新）
      setTimeout(() => {
        this.enterAppAfterAuth().catch((err) => {
          console.error(err);
          this.toast(err?.message || '登录后加载失败，请刷新页面', true);
        });
      }, 200);
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
      localStorage.removeItem('tkswarm_acting_as');
      localStorage.removeItem('tkswarm_switch_from');
      this.syncBrowserAuthToken(r.token).catch(()=>{});
      setTimeout(() => {
        this.enterAppAfterAuth().catch((err) => {
          console.error(err);
          this.toast(err?.message || '初始化后加载失败，请刷新页面', true);
        });
      }, 200);
    } catch (e) {
      this.toast(e.message || '初始化失败', true);
      if(submitBtn){
        submitBtn.disabled = false;
        submitBtn.classList.remove('btn-loading');
        submitBtn.innerHTML = '创建并登录';
      }
    }
  },
  async syncBrowserAuthToken(token){
    const t=String(token||this.authToken||'').trim();
    if(!t)return;
    try{
      await this.api('/browser/sync-auth-token',{method:'POST',body:JSON.stringify({token:t})});
    }catch{}
  },
  /**
   * 登录/初始化成功后进入后台：刷新鉴权态、顶栏菜单、用户信息与首屏路由。
   * 不能只用 location.replace 同 hash —— 退出后 URL 常已是 #/accounts，不会触发页面重建。
   */
  async enterAppAfterAuth(){
    this.hideAuthGate();
    this.prepareNavbarPending();
    const ready=await this.ensureAuth();
    if(!ready)return false;
    this.syncBrowserAuthToken().catch(()=>{});
    try{if(this.ws&&this.ws.readyState<=1)this.ws.close()}catch{}
    this.connectLiveLogs();
    await Promise.all([this.loadMeta(),this.loadRefs({force:true}),this.loadNavigationMenus()]);
    try{
      const st=await this.api('/settings');
      this.notificationSound=st.notificationSound||'chime';
      this.notificationSync=st.notificationSync!==false;
      this.applyClockPreference(st);
    }catch{}

    const router=window.TkRouter;
    let view='accounts';
    let subview='';
    const parsed=typeof router?.parseHash==='function'?router.parseHash():{view:'accounts',subview:'',login:false};
    if(parsed.login||!parsed.view||!this.canNavigateMenu(parsed.view,parsed.subview||'')){
      const first=this.firstAccessibleRoute?.();
      if(first){view=first.view;subview=first.subview||''}
    }else{
      view=parsed.view;
      subview=parsed.subview||'';
    }
    const nextHash=typeof router?.toHash==='function'?router.toHash(view,subview):(`#/${view}${subview?'/'+subview:''}`);
    if(location.hash!==nextHash)history.replaceState(null,'',nextHash);
    if(typeof router?.applyRoute==='function')await router.applyRoute(view,subview);
    else if(typeof this.navigate==='function')await this.navigate(view,subview);
    return true;
  },
  async logout(){
    try{await this.api('/auth/logout',{method:'POST'})}catch{}
    this.authToken='';
    this.authUser=null;
    this.authLoginUser=null;
    this.authPermissions=[];
    this.authChildren=[];
    this.navTree=[];
    localStorage.removeItem('tkswarm_token');
    localStorage.removeItem('tkswarm_acting_as');
    localStorage.removeItem('tkswarm_switch_from');
    // 先清顶栏，再整页重载登录门；避免仅清 token 时旧菜单残留一帧
    this.prepareNavbarPending();
    try{this.renderUserChip()}catch{}
    location.reload();
  },
  async loadRefs(opts={}){
    const force=!!opts.force;
    const ttl=Math.max(5000, Number(opts.ttl)||30000);
    if(!force&&this._refsAt&&(Date.now()-this._refsAt)<ttl&&Array.isArray(this.groups))return;
    // 启动/刷新只先拉 1 页代理，避免代理库过大时卡死首屏；后台补全
    const [groups,proxyCatalog,materials,templates]=await Promise.all([
      this.api('/groups'),
      this.loadProxyCatalog({force:true,maxPages:1}).catch(()=>this.proxyCatalog||[]),
      // 分页瘦身列表：不带 cover_base64，避免启动/切页被素材封面拖死
      this.api('/materials?page=1&pageSize=24'),
      this.api('/message-templates')
    ]);
    this.groups=groups;
    // proxyCatalog 供账号编辑等下拉；勿与代理列表页的 this.proxies（当前页）混用
    this.proxyCatalog=proxyCatalog;
    this.materials=this.ownedMaterials(Array.isArray(materials)?materials:(materials?.items||[]));this.templates=templates;
    this._refsAt=Date.now();
    if(!this._proxyCatalogWarming){
      this._proxyCatalogWarming=true;
      Promise.resolve(this.loadProxyCatalog({force:true})).catch(()=>{}).finally(()=>{this._proxyCatalogWarming=false});
    }
  },
  /** 当前有效身份（切换子账号时用被切换用户） */
  effectiveOwnerId(){
    const acting=Number(this.getActingAsId()||0);
    if(acting>0)return acting;
    return Number(this.authUser?.id||0);
  },
  /** 代理是否按归属用户隔离：仅企业客户；其他角色使用公共代理池 */
  isEnterpriseProxyOwner(ownerId,opts={}){
    const oid=Number(ownerId||0);
    if(oid<=0)return false;
    const targets=opts.targets||this._accountAssignTargets||[];
    const hit=targets.find((u)=>Number(u.id)===oid);
    if(hit){
      return hit.roleType==='enterprise'||String(hit.roleName||'').includes('企业客户');
    }
    const eff=Number(this.effectiveOwnerId()||0);
    if(oid===eff&&(this.isEnterpriseCustomerRole()||this.isLoginEnterpriseRole()))return true;
    return false;
  },
  /**
   * 账号编辑/批量绑定代理时决定是否传 ownerId。
   * 非企业客户 → null（走公共池 + DataScope 默认范围）；企业客户 → 其 user id。
   */
  proxyCatalogOwnerFilter(opts={}){
    const targets=opts.targets||this._accountAssignTargets||[];
    const explicit=opts.ownerId!=null&&opts.ownerId!==''?Number(opts.ownerId):0;
    const ownerIds=Array.isArray(opts.ownerIds)
      ?[...new Set(opts.ownerIds.map((x)=>Number(x)).filter((id)=>id>0))]
      :[];
    if(explicit>0){
      return this.isEnterpriseProxyOwner(explicit,{targets})?explicit:null;
    }
    if(ownerIds.length===1){
      return this.isEnterpriseProxyOwner(ownerIds[0],{targets})?ownerIds[0]:null;
    }
    if(opts.useCurrentUser){
      const cur=Number(this.effectiveOwnerId()||0);
      return this.isEnterpriseProxyOwner(cur,{targets})?cur:null;
    }
    return null;
  },
  async ensureProxyCatalogForAccounts(opts={}){
    const ownerId=this.proxyCatalogOwnerFilter(opts);
    const loadOpts={...opts};
    if(ownerId>0)loadOpts.ownerId=ownerId;
    else delete loadOpts.ownerId;
    return this.ensureProxyCatalog(loadOpts);
  },
  proxyCatalogScopeHint(ownerFilter,count){
    if(ownerFilter>0){
      return `代理列表仅显示该企业客户专属代理（${count} 条）`;
    }
    return `代理为公共池（${count} 条），选择国家后按国家名匹配`;
  },
  /** 素材库归属：仅当前登录用户（不受身份切换影响） */
  loginOwnerId(){
    return Number(this.authUser?.id||0);
  },
  ownedMaterials(list){
    const oid=this.loginOwnerId();
    const src=Array.isArray(list)?list:(this.materials||[]);
    if(oid<=0)return [];
    return src.filter((m)=>Number(m.ownerId??m.owner_id??0)===oid);
  },
  /** 当前有效身份创建的分组（账号/代理/消息等） */
  ownedGroups(type){
    const oid=Number(this.effectiveOwnerId()||0);
    return (this.groups||[]).filter((g)=>{
      if(type&&g.type!==type)return false;
      if(oid<=0)return false;
      return Number(g.owner_id||0)===oid;
    });
  },
  groupSidebarAddBtn(type,allowed){
    if(!allowed)return '';
    const t=String(type||'account');
    const label=t==='proxy'?'新建代理分组':'新建账号分组';
    return `<button class="group-add-btn" type="button" title="${label}" aria-label="${label}" onclick="app.groupModal('${this.esc(t)}')">+</button>`;
  },
  invalidateProxyCatalog(){
    this._proxyCatalogCache={};
    this._proxyCatalogAt=0;
    this._proxyCatalogOwnerId=null;
    this.proxyCatalog=[];
  },
  /**
   * 拉取代理库全量（分页合并，上限 API pageSize=500）。
   * opts.ownerId：仅企业客户专属代理时传入；否则走公共池 + DataScope。
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
    const maxPages=Math.max(1, Math.min(40, Number(opts.maxPages)||40));
    const ownerQs=ownerId>0?`&ownerId=${ownerId}`:'';
    while(items.length<total&&page<=maxPages){
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
  /** 账号编辑 / 分配代理等下拉选项（来自代理库全量；默认隐藏不可用，keepId/keepIds 可保留当前已绑定） */
  proxySelectItems(list,opts={}){
    const src=Array.isArray(list)&&list.length
      ?list
      :((Array.isArray(this.proxyCatalog)&&this.proxyCatalog.length)
        ?this.proxyCatalog
        :(Array.isArray(this.proxies)?this.proxies:[]));
    const keep=new Set();
    const keepOne=opts.keepId!=null&&opts.keepId!==''?Number(opts.keepId):0;
    if(keepOne>0)keep.add(keepOne);
    (Array.isArray(opts.keepIds)?opts.keepIds:[]).forEach((id)=>{
      const n=Number(id);
      if(n>0)keep.add(n);
    });
    const statusLabel=(st)=>{
      const s=String(st||'').toLowerCase();
      if(s==='available')return '可用';
      if(s==='unavailable')return '不可用';
      if(s==='unchecked'||!s)return '未检测';
      return String(st);
    };
    return src.filter((p)=>{
      const st=String(p.status||'').toLowerCase();
      if(st!=='unavailable')return true;
      return keep.has(Number(p.id));
    }).map(p=>{
      const host=p.host||'';
      const port=p.port?`:${p.port}`:'';
      const country=p.country?` · ${p.country}`:'';
      const stRaw=String(p.status||'').toLowerCase();
      const st=stRaw&&stRaw!=='unchecked'?` · ${statusLabel(stRaw)}`:'';
      const lat=Number(p.latency_ms);
      const speed=Number.isFinite(lat)&&lat>0?` · ${lat}ms`:'';
      const bindCount=Number(p.account_bind_count??p.bindCount??0);
      const remaining=Math.max(0,3-bindCount);
      const label=typeof this.proxyCountryLabel==='function'?this.proxyCountryLabel(p.country):String(p.country||'');
      const countryLabel=label&&label!==String(p.country||'').trim()?` · ${label}`:(country?` · ${p.country}`:'');
      return {
        id:p.id,
        country:String(p.country||'').trim(),
        status:String(p.status||''),
        latency_ms:p.latency_ms??null,
        bindCount,
        remaining,
        name:`${p.name||host} · ${host}${port}${countryLabel}${st}${speed} · 余${remaining}/3`,
      };
    });
  },
  /** 代理国家去重列表（用于代理下拉左侧的国家筛选） */
  proxyCountries(items){
    return [...new Set((items||[]).map(p=>String(p.country||'').trim()).filter(Boolean))]
      .sort((a,b)=>a.localeCompare(b,'zh'));
  },
  proxyCountryLabel(value){
    const v=String(value||'').trim();
    if(!v)return '';
    return typeof this.countryDisplayLabel==='function'?this.countryDisplayLabel(v):v;
  },
  /** 国家筛选 + 代理下拉（同一行，左国家右代理）。国家下拉不带 name，不会随表单提交 */
  proxyPickerField(label,items,value='',prefix=[['','未选择']]){
    const countries=this.proxyCountries(items);
    const sel=value!=null&&value!==''?String(value):'';
    const opts=prefix.map(([v,n])=>`<option value="${this.esc(v)}" ${sel===String(v)?'selected':''}>${this.esc(n)}</option>`)
      .concat((items||[]).map(p=>`<option value="${this.esc(String(p.id))}" ${sel===String(p.id)?'selected':''}>${this.esc(p.name)}</option>`)).join('');
    const cOpts=['<option value="">全部国家</option>'].concat(countries.map(c=>`<option value="${this.esc(c)}">${this.esc(this.proxyCountryLabel(c))}</option>`)).join('');
    return `<div class="field full proxy-picker"><label>${label}</label>`
      +`<div class="proxy-picker-row" style="display:flex;gap:8px;align-items:center">`
      +`<select data-proxy-country title="按代理国家筛选" style="flex:0 0 34%;min-width:0">${cOpts}</select>`
      +`<select name="proxyId" style="flex:1 1 auto;min-width:0">${opts}</select>`
      +`</div><div class="muted proxy-picker-count" style="margin-top:4px;font-size:12px"></div></div>`;
  },
  /** 绑定国家筛选联动：items 为全量代理，prefix 为代理下拉顶部固定项 */
  bindProxyPicker(root,items,prefix=[['','未选择']]){
    const wrap=(root||document).querySelector('.proxy-picker');
    if(!wrap)return;
    wrap._items=items||[];
    wrap._prefix=prefix;
    const csel=wrap.querySelector('select[data-proxy-country]');
    if(csel)csel.addEventListener('change',()=>this.renderProxyPickerOptions(wrap));
    this.renderProxyPickerOptions(wrap);
  },
  renderProxyPickerOptions(wrap,keepValue){
    const csel=wrap.querySelector('select[data-proxy-country]');
    const psel=wrap.querySelector('select[name="proxyId"]');
    if(!psel)return;
    const country=csel?String(csel.value||''):'';
    const prev=keepValue!==undefined?String(keepValue||''):String(psel.value||'');
    const all=wrap._items||[];
    const list=country?all.filter(p=>String(p.country||'').trim()===country):all;
    const prefix=wrap._prefix||[['','未选择']];
    psel.innerHTML=prefix.map(([v,n])=>`<option value="${this.esc(v)}">${this.esc(n)}</option>`).join('')
      +list.map(p=>`<option value="${this.esc(String(p.id))}">${this.esc(p.name)}</option>`).join('');
    psel.value=[...psel.options].some(o=>o.value===prev)?prev:'';
    const cnt=wrap.querySelector('.proxy-picker-count');
    if(cnt)cnt.textContent=country?`${country}：${list.length} 条代理（共 ${all.length} 条）`:`全部国家：${all.length} 条代理`;
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
    const list=await this.ensureProxyCatalogForAccounts({
      force:true,
      ownerId:ownerId,
      useCurrentUser:!ownerId,
    });
    const items=this.proxySelectItems(list,{keepId:prev?Number(prev):0});
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
    const all=this.ownedGroups('account');
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
  /** 任务选号：运营专员用户筛选（超管、运营管理） */
  canAccountPickOperatorFilter(){
    return !!(this.authIsSuper||(typeof this.isOpsAdminRole==='function'&&this.isOpsAdminRole()));
  },
  /** 任务选号：四级行业筛选（非企业客户） */
  canAccountPickIndustryFilter(){
    return !(typeof this.isEnterpriseCustomerRole==='function'&&this.isEnterpriseCustomerRole());
  },
  accountPickIndustryPrefix(boxId){
    return `${boxId}-industry`;
  },
  accountPickFilterParams(boxId){
    const groupEl=document.querySelector(`#${boxId}-group-filter`);
    const searchEl=document.querySelector(`#${boxId}-search`);
    const ownerEl=document.querySelector(`#${boxId}-owner-filter`);
    const groupId=String(groupEl?.value||'').trim();
    const keyword=String(searchEl?.value||'').trim();
    const ownerId=ownerEl?String(ownerEl.value||'').trim():'';
    let industryId='';
    if(this.canAccountPickIndustryFilter()&&typeof this.getIndustryCascadeValue==='function'){
      const v=Number(this.getIndustryCascadeValue(this.accountPickIndustryPrefix(boxId))||0);
      if(v>0)industryId=String(v);
    }
    return {groupId,keyword,ownerId,industryId};
  },
  buildAccountsQueryString(filters={}){
    const q=new URLSearchParams();
    const pageSize=Math.min(200,Math.max(1,Number(filters.pageSize)||200));
    q.set('pageSize',String(pageSize));
    if(filters.page)q.set('page',String(filters.page));
    if(filters.keyword)q.set('keyword',filters.keyword);
    const gid=String(filters.groupId||'').trim();
    if(gid==='none'||gid==='0')q.set('groupId','none');
    else if(gid)q.set('groupId',gid);
    if(filters.ownerId&&this.canAccountPickOperatorFilter())q.set('ownerId',String(filters.ownerId));
    if(filters.industryId&&this.canAccountPickIndustryFilter())q.set('industryId',String(filters.industryId));
    return q.toString();
  },
  async loadAccountsForPicker(filters={}){
    const pageSize=Math.min(200,Math.max(1,Number(filters.pageSize)||200));
    let page=1;
    let items=[];
    let total=Infinity;
    while(items.length<total&&page<=50){
      const qs=this.buildAccountsQueryString({...filters,page,pageSize});
      const d=await this.api(`/accounts?${qs}`);
      const chunk=Array.isArray(d?.items)?d.items:[];
      total=Number(d?.total??chunk.length);
      items=items.concat(chunk);
      if(!chunk.length||chunk.length<pageSize)break;
      page+=1;
    }
    return items;
  },
  /**
   * 选账号工具栏：分组（自己的）+ 行业 + 运营用户 + 关键词 + 查询
   * boxId 对应账号网格 id（如 mass-accounts）
   */
  accountPickToolbarHtml(boxId, opts={}){
    const gs=this.accountGroupFlatOptions();
    const groupOpts=`<option value="">全部分组</option><option value="none">未分组</option>${gs.map(g=>`<option value="${g.id}">${this.esc(g.name)}</option>`).join('')}`;
    const batch=opts.batchHtml||'';
    const industryPrefix=this.accountPickIndustryPrefix(boxId);
    const showIndustry=this.canAccountPickIndustryFilter();
    const showOwner=this.canAccountPickOperatorFilter();
    const industryBlock=showIndustry
      ?`<div class="account-pick-industry" id="${boxId}-industry-wrap">${typeof this.industryCascadeHtml==='function'?this.industryCascadeHtml(industryPrefix,''):''}</div>`
      :'';
    const ownerBlock=showOwner
      ?`<select class="input account-pick-owner" id="${boxId}-owner-filter" title="运营专员用户"><option value="">全部运营用户</option></select>`
      :'';
    return `<div class="account-pick-toolbar account-pick-toolbar--filters">
      <div class="account-pick-filters-row">
        <select class="input account-pick-group" id="${boxId}-group-filter" title="按分组筛选">${groupOpts}</select>
        ${industryBlock}
        ${ownerBlock}
        <input class="input account-pick-search" id="${boxId}-search" type="search" placeholder="搜索账号 ID / 用户名 / 昵称" value="${this.esc(opts.keyword||'')}">
        <button type="button" class="primary tiny account-pick-query" onclick="app.searchAccountPick('${boxId}')">查询</button>
        ${batch?`<div class="account-pick-batch">${batch}</div>`:''}
        <span class="muted account-pick-hint" id="${boxId}-search-hint"></span>
      </div>
    </div>`;
  },
  async initAccountPickToolbar(boxId, opts={}){
    const industryPrefix=this.accountPickIndustryPrefix(boxId);
    if(this.canAccountPickIndustryFilter()&&typeof this.bindIndustryCascade==='function'){
      await this.bindIndustryCascade(industryPrefix,Number(opts.industryId||0));
    }
    if(this.canAccountPickOperatorFilter()){
      const sel=document.querySelector(`#${boxId}-owner-filter`);
      if(sel){
        try{
          const pack=await this.api('/auth/account-filter-options');
          const users=Array.isArray(pack.users)?pack.users:[];
          const cur=String(opts.ownerId||'');
          sel.innerHTML=`<option value="">全部运营用户</option>${users.map(u=>{
            const label=`${u.nickname||u.username} · @${u.username}${u.role_name?`（${u.role_name}）`:''}`;
            return `<option value="${u.id}" ${cur&&String(u.id)===cur?'selected':''}>${this.esc(label)}</option>`;
          }).join('')}`;
        }catch{/* ignore */}
      }
    }
    const searchEl=document.querySelector(`#${boxId}-search`);
    if(searchEl){
      searchEl.onkeydown=(e)=>{
        if(e.key==='Enter'){e.preventDefault();this.searchAccountPick(boxId,opts);}
      };
    }
  },
  async reloadAccountPick(boxId, opts={}){
    const box=document.querySelector('#'+boxId);
    if(!box)return [];
    const filters={...this.accountPickFilterParams(boxId),...opts.filters};
    const selected=opts.selected instanceof Set
      ?opts.selected
      :new Set((opts.selectedIds||opts.selected||[]).map(Number));
    const preserveSelection=opts.preserveSelection!==false;
    if(preserveSelection){
      this.selectedAccountPickIds(boxId).forEach(id=>selected.add(id));
    }
    box.innerHTML=this.listLoadingHtml({ title:'正在加载账号', desc:'同步可选账号列表，请稍候…', compact:true });
    try{
      let accounts=await this.loadAccountsForPicker(filters);
      if(typeof opts.filterFn==='function')accounts=accounts.filter(opts.filterFn);
      this.rememberAccountsForSchedule?.(accounts);
      const tagHtmlFn=opts.tagHtmlFn||((a,s)=>this.accountPickTagHtml(a,s,opts.tagOpts||{}));
      const emptyText=opts.emptyText||'暂无账号';
      box.innerHTML=accounts.length
        ?accounts.map(a=>tagHtmlFn(a,selected)).join('')
        :`<div class="muted account-pick-empty" style="padding:12px;grid-column:1/-1">${this.esc(emptyText)}</div>`;
      const hint=document.querySelector(`#${boxId}-search-hint`);
      if(hint)hint.textContent=accounts.length?`共 ${accounts.length} 个`:'';
      if(typeof opts.onLoaded==='function')opts.onLoaded(accounts);
      return accounts;
    }catch(e){
      box.innerHTML=`<div class="muted account-pick-empty" style="padding:12px;grid-column:1/-1">${this.esc(e.message||'加载账号失败')}</div>`;
      return [];
    }
  },
  searchAccountPick(boxId, opts={}){
    return this.reloadAccountPick(boxId,opts);
  },
  /** 紧凑数字：128600 → 128.6K */
  formatCompactCount(n){
    const v=Number(n)||0;
    if(v>=1e6)return `${(v/1e6).toFixed(v%1e6===0?0:1).replace(/\.0$/,'')}M`;
    if(v>=1e3)return `${(v/1e3).toFixed(v%1e3===0?0:1).replace(/\.0$/,'')}K`;
    return String(Math.max(0,Math.floor(v)));
  },
  /** 选账号卡片空值统一占位 */
  accountPickEmpty(v){
    const s=String(v??'').trim();
    if(!s||s==='-'||s==='—'||s==='- / -'||s==='-- / --')return '--';
    return s;
  },
  /** 选账号卡片时间展示 */
  formatAccountPickTime(raw){
    const s=String(raw||'').trim();
    if(!s)return '--';
    const m=s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
    if(m)return `${m[1]} ${m[2]}`;
    if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
    return s.slice(0,16).replace('T',' ');
  },
  /** 选账号卡片计数：无关联数据时显示 --；有资料/视频同步痕迹时 0 也展示 */
  formatAccountPickCount(raw, synced){
    if(raw==null||raw==='')return synced?'0':'--';
    const n=Number(raw);
    if(!Number.isFinite(n))return synced?'0':'--';
    if(!synced&&n<=0)return '--';
    return this.formatCompactCount(n);
  },
  accountPickIcon(kind){
    const common='class="apt-ico" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
    const map={
      doc:`<svg ${common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>`,
      stack:`<svg ${common}><rect x="3" y="4" width="18" height="4" rx="1"/><rect x="3" y="10" width="18" height="4" rx="1"/><rect x="3" y="16" width="18" height="4" rx="1"/></svg>`,
      pin:`<svg ${common}><path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>`,
      globe:`<svg ${common}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>`,
      user:`<svg ${common}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
      shield:`<svg ${common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
      chat:`<svg ${common}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
      check:`<svg ${common}><path d="M20 6 9 17l-5-5"/></svg>`,
      info:`<svg ${common}><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    };
    return map[kind]||'';
  },
  /** 账号选择信息卡（含 data-group，供分组筛选） */
  rememberWizardAccounts(accounts){
    if(!this._wizardAccountById)this._wizardAccountById=new Map();
    const list=[];
    (accounts||[]).forEach(a=>{
      const id=Number(a?.id);
      if(!id)return;
      this._wizardAccountById.set(id,a);
      list.push(a);
    });
    this.rememberAccountsForSchedule?.(list);
    const merged=[...this._wizardAccountById.values()];
    this._wizardAccountsCache=merged;
    return merged;
  },
  wizardAccountRecord(id){
    const n=Number(id);
    if(!n)return null;
    return this._wizardAccountById?.get(n)
      ||(this._wizardAccountsCache||[]).find(x=>Number(x.id)===n)
      ||this._scheduleAccountMap?.get(n)
      ||null;
  },
  /** 发布组合等只读展示：复用选择账号 Card 视觉，精简为基础信息 */
  accountPairCardHtml(a,opts={}){
    const id=Number(a?.id||opts.id||0);
    const uname=String(a?.username||a?.nickname||opts.username||(id?('#'+id):'--'));
    const avatar=String(a?.profile_avatar||a?.avatar_url||'').trim();
    const initial=this.esc(String(a?.nickname||uname||'?').trim().charAt(0).toUpperCase()||'?');
    const avatarHtml=avatar
      ?`<img class="apt-avatar" src="${this.esc(avatar)}" alt="" onerror="this.outerHTML='<div class=&quot;apt-avatar apt-avatar-ph&quot;>${initial}</div>'">`
      :`<div class="apt-avatar apt-avatar-ph">${initial}</div>`;
    const countryRaw=String(a?.account_country||a?.country||'').trim();
    const countryLabel=countryRaw
      ?(typeof this.countryDisplayLabel==='function'?this.countryDisplayLabel(countryRaw):countryRaw)
      :'';
    const profileSynced=!!String(a?.profile_synced_at||'').trim()||Number(a?.has_tiktok_profile)===1;
    const videoSynced=!!String(a?.last_video_at||'').trim()||Number(a?.has_published_videos)===1||Number(a?.videos_count||a?.videos||0)>0;
    const followers=this.formatAccountPickCount(a?.followers_count??a?.followers, profileSynced);
    const videos=this.formatAccountPickCount(a?.videos_count??a?.videos, profileSynced||videoSynced);
    const countryText=this.accountPickEmpty(countryLabel);
    const nick=String(a?.nickname||'').trim();
    const groupName=String(a?.group_name||'').trim();
    const banned=String(a?.account_status||'')==='banned'||Number(a?.enabled)===0;
    return `<div class="account-pick-tag apt-card apt-pair-card is-on${banned?' is-abnormal':''}" data-id="${id}" title="#${id} ${this.esc(uname)}">
      <div class="apt-head">
        ${avatarHtml}
        <span class="apt-id">#${id||'--'}</span>
        <span class="apt-name" title="${this.esc(uname)}">${this.esc(uname||'--')}</span>
      </div>
      <div class="apt-sec">
        <div class="apt-sec-title">基础信息</div>
        <div class="apt-grid">
          <div class="apt-cell">
            <div class="apt-label">${this.accountPickIcon('user')}<span>昵称</span></div>
            <div class="apt-value">${this.esc(nick||'--')}</div>
          </div>
          <div class="apt-cell">
            <div class="apt-label">${this.accountPickIcon('globe')}<span>国家</span></div>
            <div class="apt-value">${this.esc(countryText)}</div>
          </div>
          <div class="apt-cell">
            <div class="apt-label">${this.accountPickIcon('stack')}<span>粉丝 / 视频</span></div>
            <div class="apt-value">${this.esc(followers)} · ${this.esc(videos)}</div>
          </div>
          <div class="apt-cell">
            <div class="apt-label">${this.accountPickIcon('pin')}<span>分组</span></div>
            <div class="apt-value">${this.esc(groupName||'未分组')}</div>
          </div>
        </div>
      </div>
    </div>`;
  },
  accountPickTagHtml(a, selected, opts={}){
    const id=Number(a.id);
    const on=selected instanceof Set?selected.has(id):!!selected;
    const uname=String(a.username||'');
    const gid=a.group_id!=null&&a.group_id!==''?String(a.group_id):'';
    const onclick=opts.onclick||`app.toggleAccountPickTag(this)`;
    const avatar=String(a.profile_avatar||a.avatar_url||'').trim();
    const initial=this.esc(String(a.nickname||uname||'?').trim().charAt(0).toUpperCase()||'?');
    const avatarHtml=avatar
      ?`<img class="apt-avatar" src="${this.esc(avatar)}" alt="" onerror="this.outerHTML='<div class=&quot;apt-avatar apt-avatar-ph&quot;>${initial}</div>'">`
      :`<div class="apt-avatar apt-avatar-ph">${initial}</div>`;
    const countryRaw=String(a.account_country||a.country||'').trim();
    const countryLabel=countryRaw
      ?(typeof this.countryDisplayLabel==='function'?this.countryDisplayLabel(countryRaw):countryRaw)
      :'';
    // 有资料行 / 全库发布记录 / 同步痕迹 / 计数 >0 时，才把 0 当作真实数值；否则显示 --
    const profileSynced=!!String(a.profile_synced_at||'').trim()||Number(a.has_tiktok_profile)===1;
    const videoSynced=!!String(a.last_video_at||'').trim()||Number(a.has_published_videos)===1||Number(a.videos_count||a.videos||0)>0;
    const followers=this.formatAccountPickCount(a.followers_count??a.followers, profileSynced);
    const videos=this.formatAccountPickCount(a.videos_count??a.videos, profileSynced||videoSynced);
    const lastVideo=this.accountPickEmpty(this.formatAccountPickTime(a.last_video_at||a.profile_synced_at||''));
    const activatedRaw=this.formatAccountPickTime(a.first_video_published_at||a.created_at||'');
    const activated=this.accountPickEmpty(activatedRaw==='--'?activatedRaw:activatedRaw.slice(0,10));
    const countryText=this.accountPickEmpty(countryLabel);
    const dmUsed=Math.max(0,Number(a.dm_used||0));
    const dmLimit=Math.max(0,Number(a.dm_limit||0));
    const dmQuotaText=dmLimit>0
      ?`${dmUsed} / ${dmLimit}`
      :(dmUsed>0?`${dmUsed} / --`:'--');
    const banned=String(a.account_status||'')==='banned'||Number(a.enabled)===0;
    const dmExhausted=dmLimit>0&&dmUsed>=dmLimit;
    const dmOk=!banned&&!dmExhausted;
    const dmStatusText=banned?'异常':(dmExhausted?'已满':'正常');
    const dmPct=dmLimit>0?Math.min(100,Math.round((dmUsed/dmLimit)*100)):(dmOk?12:100);
    const tip=banned
      ?'异常账号自动暂停私信'
      :(dmExhausted?'今日私信配额已用尽':'异常账号自动暂停私信');
    const tipEnd=dmOk?'可继续发送':(dmExhausted?'请明日再试':'已暂停');
    const readonly=!!opts.readonly;
    const wrapAttrs=readonly
      ?`class="account-pick-tag apt-card is-on${banned?' is-abnormal':''}" data-id="${id}" title="#${id} ${this.esc(uname)}"`
      :`role="button" tabindex="0" class="account-pick-tag apt-card ${on?'is-on':''}${banned?' is-abnormal':''}" data-id="${id}" data-name="${this.esc(uname)}" data-group="${this.esc(gid)}" onclick="${onclick}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${onclick}}" title="#${id} ${this.esc(uname)}"`;
    return `<div ${wrapAttrs}>
      <div class="apt-head">
        ${avatarHtml}
        <span class="apt-id">#${id}</span>
        <span class="apt-name" title="${this.esc(uname)}">${this.esc(uname||'--')}</span>
      </div>
      <div class="apt-sec">
        <div class="apt-sec-title">视频概览</div>
        <div class="apt-grid">
          <div class="apt-cell">
            <div class="apt-label">${this.accountPickIcon('doc')}<span>视频最后更新时间</span></div>
            <div class="apt-value">${this.esc(lastVideo)}</div>
          </div>
          <div class="apt-cell">
            <div class="apt-label">${this.accountPickIcon('stack')}<span>视频数</span></div>
            <div class="apt-value">${this.esc(videos)}</div>
          </div>
        </div>
      </div>
      <div class="apt-sec">
        <div class="apt-sec-title">账号信息</div>
        <div class="apt-grid">
          <div class="apt-cell">
            <div class="apt-label">${this.accountPickIcon('globe')}<span>国家</span></div>
            <div class="apt-value">${this.esc(countryText)}</div>
          </div>
          <div class="apt-cell">
            <div class="apt-label">${this.accountPickIcon('user')}<span>粉丝数</span></div>
            <div class="apt-value">${this.esc(followers)}</div>
          </div>
          <div class="apt-cell">
            <div class="apt-label">${this.accountPickIcon('shield')}<span>激活时间</span></div>
            <div class="apt-value">${this.esc(activated)}</div>
          </div>
        </div>
      </div>
      <div class="apt-sec">
        <div class="apt-sec-title">私信监测</div>
        <div class="apt-grid">
          <div class="apt-cell">
            <div class="apt-label">${this.accountPickIcon('chat')}<span>私信配额</span></div>
            <div class="apt-value">${this.esc(dmQuotaText)}</div>
          </div>
          <div class="apt-cell">
            <div class="apt-label">${this.accountPickIcon('check')}<span>私信状态</span></div>
            <div class="apt-value"><span class="apt-status ${dmOk?'is-ok':'is-bad'}">${this.esc(dmStatusText)}</span></div>
          </div>
        </div>
      </div>
      <div class="apt-foot">
        <div class="apt-tip">${this.accountPickIcon('info')}<span>${this.esc(tip)}</span></div>
        <div class="apt-progress-row">
          <div class="apt-progress"><i style="width:${dmPct}%"></i></div>
          <span class="apt-tip-end">${this.esc(tipEnd)}</span>
        </div>
      </div>
    </div>`;
  },
  /** 通用账号标签点选（发布向导可覆盖以加入数量限制） */
  toggleAccountPickTag(el){
    if(!el||el.classList.contains('is-filtered-out'))return;
    el.classList.toggle('is-on');
  },
  /** @deprecated 任务选号已改为服务端筛选；保留兼容旧调用 */
  filterAccountPick(boxId){
    return this.searchAccountPick(boxId);
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
    const loader=window.UI
      ? UI.listLoadingHtml({ title:'正在加载页面', desc:'拉取列表与权限数据，请稍候…', fill:true })
      : `<div class="tk-list-loading is-fill" role="status"><div class="tk-list-loading-card"><div class="muted">正在加载页面…</div></div></div>`;
    content.innerHTML=`${head}<div class="panel page-shell-loading" data-page-shell="${this.esc(view)}" style="margin:0;min-height:calc(100vh - 160px);display:flex;align-items:stretch;padding:0;overflow:hidden">${loader}</div>`;
  },
  listLoadingHtml(opts){
    return window.UI ? UI.listLoadingHtml(opts||{}) : '<div class="muted" style="padding:48px;text-align:center">加载中…</div>';
  },
  paintListLoading(root, opts){
    return window.UI ? UI.paintListLoading(root, opts||{}) : 0;
  },
  pageRenderStill(view, gen){
    return ()=>this.view===view&&this._navGen===gen;
  },
  syncNavActive(view){
    const curSub=String(this.subview||'');
    document.querySelectorAll('#nav [data-view]').forEach(b=>{
      const bv=b.dataset.view;
      const on=bv===view
        ||(bv==='settings'&&['versions','helpDocs','tickets','envInstallers','aiPlatform','aiPromptTemplates','aiCallLogs','smtpConfig','dmWeightConfig','nocaptchaKeys','videoDeliveryTypes','youtubeConfig'].includes(view))
        ||(bv==='accounts'&&['groups','proxies','registerEnvs','youtubeAccounts'].includes(view))
        ||(bv==='publish'&&['warm','accountWork','accountWizard','youtubeSync','videoBoost'].includes(view))
        ||(bv==='agent'&&['msgTemplates'].includes(view))
        ||(bv==='aiLeads'&&view==='autoFollow');
      b.classList.toggle('active', on);
    });
    // 叶子：按 view+subview 精确高亮（账号向导下拉取数据/修改资料/账号视频共用 view）
    const awWant=curSub.startsWith('edit_modify_profile')||curSub==='create_modify_profile'||curSub==='modify_profile'
      ?'modify_profile'
      :(curSub==='account_videos'||curSub==='account-videos'||curSub==='videos'
        ?'account_videos'
        :(curSub==='create_pull_stats'||curSub==='pull_stats'||curSub===''?'pull_stats':curSub));
    document.querySelectorAll('#nav .nav-leaf-btn[data-nav-view], #nav .nav-sub-btn[data-nav-view]').forEach(b=>{
      if(b.classList.contains('nav-root-btn'))return;
      const bv=b.getAttribute('data-nav-view')||'';
      const bs=String(b.getAttribute('data-nav-sub')||'');
      let on=false;
      if(bv===view){
        if(view==='accountWizard'){
          // 二级「账号向导」本身不抢叶子高亮
          if(b.classList.contains('nav-sub-btn'))on=false;
          else on=bs===awWant;
        }else{
          on=bs===curSub||(!bs&&!curSub);
        }
      }
      b.classList.toggle('active', on);
      b.classList.toggle('is-current', on);
    });
    document.querySelectorAll('.nav-item-root').forEach(el=>{
      const btn=el.querySelector('.nav-root-btn');
      const rootView=btn?.getAttribute('data-nav-view')||'';
      const isCur=rootView===view
        ||(rootView==='settings'&&['versions','helpDocs','tickets','envInstallers','aiPlatform','aiPromptTemplates','aiCallLogs','smtpConfig','dmWeightConfig','nocaptchaKeys','videoDeliveryTypes','youtubeConfig'].includes(view))
        ||(rootView==='accounts'&&['groups','proxies','registerEnvs','youtubeAccounts'].includes(view))
        ||(rootView==='publish'&&['warm','accountWork','accountWizard','youtubeSync','videoBoost'].includes(view))
        ||(rootView==='agent'&&['msgTemplates'].includes(view))
        ||(rootView==='aiLeads'&&view==='autoFollow')
        ||(el.querySelector(`[data-nav-view="${view}"]`)!=null);
      el.classList.toggle('active',isCur);
      btn?.classList.toggle('active',isCur);
    });
  },
  async navigate(view, subview=''){
    if(!this.canNavigateMenu(view,subview)){
      this.toast('当前角色无权访问该菜单',true);
      return;
    }
    if(!this.hasMenuPermissionMode()&&!this.canView(view)){
      this.toast('当前角色无权访问该模块',true);
      return;
    }
    if(view!=='chat')this.stopChatSyncTimer?.();
    const prevView=this.view;
    const prevSub=String(this.subview||'');
    subview=String(subview||'');

    // 账号向导：同页切换拉取数据 / 修改资料（避免权限/缓存导致点了叶子内容不换）
    if(view==='accountWizard'&&prevView==='accountWizard'){
      if(this.accountWizardRefreshTimer){clearInterval(this.accountWizardRefreshTimer);this.accountWizardRefreshTimer=null}
      if(subview==='warm'){return this.navigate('warm','list')}
      this.view='accountWizard';
      this.subview=subview;
      if(typeof this.syncAccountWizardFromSubview==='function')this.syncAccountWizardFromSubview(subview);
      else{
        if(subview==='account_videos'||subview==='account-videos'||subview==='videos'){
          this.accountWizardKind='account_videos';this.accountWizardPane='videos';
        }else{
          this.accountWizardKind=(subview==='modify_profile'||subview==='create_modify_profile'||subview.startsWith('edit_modify_profile'))?'modify_profile':'pull_stats';
          this.accountWizardPane=(subview==='create_pull_stats'||subview==='create_modify_profile'||subview.startsWith('edit_modify_profile'))?(subview.startsWith('edit')?'edit':'create'):'list';
        }
      }
      this.syncNavActive('accountWizard');
      const [awTitle]=this.viewPageMeta('accountWizard');
      if(awTitle) document.title=`${awTitle} - TKSwarm`;
      // 同页切叶子必须抬 gen，避免旧列表响应盖住新页
      const gen=++this._navGen;
      await this.refresh({navGen:gen,skipListLoading:prevSub===subview});
      return;
    }

    // AI矩阵内部 Tab：已在 publish 页时走软切换，避免整页 invalidate+重绘
    if(view==='publish'&&prevView==='publish'&&typeof this.switchMatrix==='function'){
      const softMap={
        '':'tasks',tasks:'tasks',list:'tasks',mass:'tasks',
        customer_tasks:'customerTasks',customerTasks:'customerTasks',
        materials:'materials',material:'materials',
        material_import:'materialImport',folder_materials:'materialImport',import:'materialImport',
        // 拉取视频列表 / 拉取视频详情：独立页，互不叠层
        pull_comments:'pullComments',
        pull_video_detail:'pullComments',
        pull_video_list:'pullVideoList',
      };
      if(Object.prototype.hasOwnProperty.call(softMap,subview)){
        const contentEl=document.querySelector('#content');
        const stuckShell=!!contentEl?.querySelector?.('.page-shell-loading');
        const matrixReady=!!(contentEl?.querySelector?.('#matrix-body')&&contentEl?.querySelector?.('.matrix-tabs'));
        // 刷新后仍停在加载壳 / 矩阵壳未就绪：禁止软切，走下方整页 refresh
        if(!stuckShell&&matrixReady){
          this.view='publish';
          this.subview=subview;
          this.wizardOpen=false;
          this.massWizardOpen=false;
          this.deleteWizardOpen=false;
          this.commentReplyWizardOpen=false;
          this.pullCommentWizardOpen=false;
          this.pullVideoListWizardOpen=false;
          this.imagePublishWizardOpen=false;
          this.imageDeleteWizardOpen=false;
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
          await this.switchMatrix(tab);
          return;
        }
      }
    }

    this.view=view;
    this.subview=subview;

    // 根据 subview 精确定位并激活视图内 Tab / 操作
    if(view==='accounts'){
      if(subview==='browser')this.accountPane='browser';
      else if(subview==='batch_browser'){this.accountPane='browser';setTimeout(()=>this.batchCreateBrowserModal(),120)}
      else if(subview==='import'||subview==='io'||subview==='export'){this.accountPane='io';this.accountIoTab=subview==='import'?'import':'export';if(!Array.isArray(this.accountIoFields)||!this.accountIoFields.length)this.accountIoFields=this.defaultAccountIoFields()}
      else if(subview==='qr'){this.accountPane='list';this.toast('扫码登录功能已移除',true)}
      else if(subview==='monitor_config'){this.accountPane='list';setTimeout(()=>{if(!this.canPermission('account.create')){this.toast('当前角色无权修改监控配置',true);return}this.monitorModal()},120)}
      else if(subview==='monitor_run'){this.accountPane='list';setTimeout(()=>{if(!this.canPermission('account.create')){this.toast('当前角色无权执行账号同步',true);return}this.runAccountMonitor()},120)}
      else if(subview==='monitor_log'||subview==='monitor_result'){this.accountPane='list';setTimeout(()=>this.showMonitorResult(),120)}
      else this.accountPane='list'; // '' / list / 其它：直链也必须落到账号列表，不能空白
    } else if(view==='warm'){
      if(subview==='create'||subview==='create_warm'){this.warmPane='create';this.warmEditId=null}
      else {this.warmPane='list';this.warmEditId=null}
    } else if(view==='accountWizard'){
      if(this.accountWizardRefreshTimer){clearInterval(this.accountWizardRefreshTimer);this.accountWizardRefreshTimer=null}
      const sv=String(subview||'');
      if(sv==='warm'){return this.navigate('warm','list')}
      if(typeof this.syncAccountWizardFromSubview==='function')this.syncAccountWizardFromSubview(sv);
      else {
        if(sv==='modify_profile'||sv==='create_modify_profile'||sv.startsWith('edit_modify_profile')){
          this.accountWizardKind='modify_profile';
          this.accountWizardPane=sv==='create_modify_profile'?'create':(sv.startsWith('edit_modify_profile')?'edit':'list');
        } else if(sv==='account_videos'||sv==='account-videos'||sv==='videos'){
          this.accountWizardKind='account_videos';this.accountWizardPane='videos';
        } else if(sv==='create_pull_stats'||sv==='create'){
          this.accountWizardKind='pull_stats';this.accountWizardPane='create';
        } else {
          this.accountWizardKind='pull_stats';this.accountWizardPane='list';
        }
      }
    } else if(view==='aiLeads'){
      if(subview==='clues'){this.aiLeadsPane='clues';this.aiLeadsEditId=null;this.aiLeadsDetailId=null}
      else if(subview==='clue_data'){this.aiLeadsPane='clue_data';this.aiLeadsEditId=null;this.aiLeadsDetailId=null}
      else if(subview==='create'){this.aiLeadsPane='create';this.aiLeadsEditId=null;this.aiLeadsDetailId=null}
      else if(subview==='detail'||subview.startsWith('detail/')){
        const parts=String(subview).replace(/^detail\/?/,'').split('/').filter(Boolean);
        const id=Number(parts[0]||0)||0;
        const tab=parts[1]||'accounts';
        this.aiLeadsPane='detail';this.aiLeadsDetailId=id||null;
        this.aiLeadsDetailTab=['accounts','creators','logs','records','daily'].includes(tab)?tab:'accounts';
      } else {this.aiLeadsPane='list';this.aiLeadsEditId=null;this.aiLeadsDetailId=null;this.aiLeadsDetailTab='accounts'}
    } else if(view==='videoBoost'){
      if(subview==='create'){this.videoBoostPane='create';this.videoBoostEditId=null}
      else if(subview==='edit'||subview.startsWith('edit/')){
        const id=Number(String(subview).replace(/^edit\/?/,'')||0)||0;
        this.videoBoostPane='edit';this.videoBoostEditId=id||null;
      } else {this.videoBoostPane='list';this.videoBoostEditId=null}
    } else if(view==='youtubeSync'){
      if(subview==='create'){this.youtubeSyncPane='create'}
      else {this.youtubeSyncPane='list'}
    } else if(view==='youtubeAccounts'){
      // 必须先匹配 videos/，否则 videos/1 会被 video/ 前缀误伤
      if(subview.startsWith('videos/')||subview==='videos'){
        const aid=Number(String(subview).replace(/^videos\/?/,'')||0)||0;
        this.youtubeAccountsPane='videos';
        this._ytPanelAccountId=aid;
        this._ytPanelVideoId=0;
      } else if(subview.startsWith('video/')){
        const parts=String(subview).replace(/^video\/?/,'').split('/').filter(Boolean);
        this.youtubeAccountsPane='video';
        this._ytPanelAccountId=Number(parts[0]||0)||0;
        this._ytPanelVideoId=Number(parts[1]||0)||0;
      } else {
        this.youtubeAccountsPane='list';
        this._ytPanelAccountId=0;
        this._ytPanelVideoId=0;
      }
    } else if(view==='autoFollow'){
      if(subview==='create'){this.autoFollowPane='create';this.autoFollowEditId=null;this._autoFollowDraft=null}
      else if(subview==='edit'||subview.startsWith('edit/')){
        const id=Number(String(subview).replace(/^edit\/?/,'')||0)||0;
        this.autoFollowPane='edit';this.autoFollowEditId=id||null;this._autoFollowDraft=null;
      } else {this.autoFollowPane='list';this.autoFollowEditId=null;this._autoFollowDraft=null}
    } else if(view==='proxies'){
      if(subview==='import'||subview==='io'){
        this.proxyPane='io';
        this.proxyIoTab=subview==='import'?'import':'export';
        if(!Array.isArray(this.proxyIoFields)||!this.proxyIoFields.length)this.proxyIoFields=this.defaultProxyIoFields();
      } else {
        this.proxyPane='list';
        if(subview==='create')setTimeout(()=>{if(!this.canCreateProxies()){this.toast('当前角色无权添加代理',true);return}this.proxyModal()},120);
        else if(subview==='batch_test')setTimeout(()=>{if(!this.canTestProxies()){this.toast('当前角色无权检测代理',true);return}this.batchTestProxies()},120);
        else if(subview==='fetch_cloud')setTimeout(()=>{if(!this.canCreateProxies()){this.toast('当前角色无权拉取代理',true);return}this.fetchProxyModal()},120);
      }
    } else if(view==='groups'){
      // 分组管理页：默认账号分组，可切代理/消息
      if(['account','proxy','message','uid'].includes(subview)) this.groupType=subview;
      else this.groupType=this.groupType||'account';
    } else if(view==='agent'){
      if(subview==='create')setTimeout(()=>this.addAgent(),120);
    } else if(view==='publish'){
      clearTimeout(this._matrixSoftTimer);
      if(!(subview==='create_publish_images'||subview==='image_wizard'))this.imagePublishWizardOpen=false;
      if(subview!=='create_delete_images')this.imageDeleteWizardOpen=false;
      // 不再整表清空缓存；仅目标 Tab 在数据变更时由业务侧 invalidate
      if(subview==='tasks'||subview===''||subview==='list'){this.matrixTab='tasks';this.taskTypeFilter='';this.taskModeFilter='';this.wizardOpen=false;this.massWizardOpen=false;this.deleteWizardOpen=false;this.commentReplyWizardOpen=false;}
      else if(subview==='create_delete_images'){this.wizardOpen=false;this.massWizardOpen=false;this.deleteWizardOpen=false;this.commentReplyWizardOpen=false;this.pullCommentWizardOpen=false;this.pullVideoListWizardOpen=false;this.imagePublishWizardOpen=false;if(typeof this.openImageDeleteWizard==='function')this.openImageDeleteWizard({skipRefresh:true});else{this.matrixTab='tasks'}}
      else if(subview==='create_publish_images'||subview==='image_wizard'){this.wizardOpen=false;this.massWizardOpen=false;this.deleteWizardOpen=false;this.commentReplyWizardOpen=false;this.pullCommentWizardOpen=false;this.pullVideoListWizardOpen=false;if(typeof this.openImagePublishWizard==='function')this.openImagePublishWizard({skipRefresh:true});else{this.matrixTab='tasks'}}
      else if(subview==='create_publish'||subview==='random'){this.deleteWizardOpen=false;this.commentReplyWizardOpen=false;this.imagePublishWizardOpen=false;this.openPublishWizard('random',{skipRefresh:true});}
      else if(subview==='create_ordered'||subview==='create_mass'||subview==='ordered'){this.deleteWizardOpen=false;this.commentReplyWizardOpen=false;this.openPublishWizard('ordered',{skipRefresh:true});}
      else if(subview==='mass'){this.matrixTab='tasks';this.taskTypeFilter='publish';this.taskModeFilter='ordered';this.wizardOpen=false;this.massWizardOpen=false;this.deleteWizardOpen=false;this.commentReplyWizardOpen=false;}
      else if(subview==='create_independent'||subview==='independent'){this.deleteWizardOpen=false;this.commentReplyWizardOpen=false;this.openPublishWizard('independent',{skipRefresh:true});}
      else if(subview==='delete_wizard'||subview==='create_delete'||subview==='delete'){this.wizardOpen=false;this.massWizardOpen=false;this.commentReplyWizardOpen=false;this.openDeleteWizard({skipRefresh:true});}
      else if(subview==='create_comment_reply_images'){this.wizardOpen=false;this.massWizardOpen=false;this.deleteWizardOpen=false;this.pullCommentWizardOpen=false;this.pullVideoListWizardOpen=false;this.openCommentReplyWizard({skipRefresh:true});if(this.commentReplyWizard){this.commentReplyWizard.source='comment_reply_images_wizard';this.commentReplyWizard.mediaType='image'}}
      else if(subview==='pull_image_details'){this.wizardOpen=false;this.massWizardOpen=false;this.deleteWizardOpen=false;this.commentReplyWizardOpen=false;this.pullVideoListWizardOpen=false;this.openPullCommentWizard({skipRefresh:true});if(this.pullCommentWizard)this.pullCommentWizard.mediaType='image'}
      else if(subview==='pull_image_list'){this.wizardOpen=false;this.massWizardOpen=false;this.deleteWizardOpen=false;this.commentReplyWizardOpen=false;this.pullCommentWizardOpen=false;this.openPullVideoListWizard({skipRefresh:true});if(this.pullVideoListWizard){this.pullVideoListWizard.mediaType='image';this.pullVideoListWizard.source='pull_image_list_wizard'}}
      else if(subview==='comment_reply_wizard'||subview==='create_comment_reply'||subview==='comment_reply'){this.wizardOpen=false;this.massWizardOpen=false;this.deleteWizardOpen=false;this.pullCommentWizardOpen=false;this.openCommentReplyWizard({skipRefresh:true});}
      else if(subview==='pull_comments'||subview==='pull_video_detail'){this.wizardOpen=false;this.massWizardOpen=false;this.deleteWizardOpen=false;this.commentReplyWizardOpen=false;this.pullVideoListWizardOpen=false;this.openPullComments({skipRefresh:true});}
      else if(subview==='pull_video_list'){this.wizardOpen=false;this.massWizardOpen=false;this.deleteWizardOpen=false;this.commentReplyWizardOpen=false;this.pullCommentWizardOpen=false;this.pullVideoListWizardOpen=false;this.openPullVideoList({skipRefresh:true});}
      else if(subview==='create_pull_video_list'||subview==='pull_video_list_wizard'){this.wizardOpen=false;this.massWizardOpen=false;this.deleteWizardOpen=false;this.commentReplyWizardOpen=false;this.openPullVideoListWizard({skipRefresh:true});}
      else if(subview==='create_pull_comments'||subview==='pull_comment_wizard'){this.wizardOpen=false;this.massWizardOpen=false;this.deleteWizardOpen=false;this.commentReplyWizardOpen=false;this.pullVideoListWizardOpen=false;this.openPullCommentWizard({skipRefresh:true});}
      else if(subview==='customer_tasks'||subview==='customerTasks'){this.matrixTab='customerTasks';this.wizardOpen=false;this.massWizardOpen=false;this.deleteWizardOpen=false;this.commentReplyWizardOpen=false;this.pullCommentWizardOpen=false;}
      else if(subview==='materials'||subview==='material'){this.matrixTab='materials';this.wizardOpen=false;this.massWizardOpen=false;this.deleteWizardOpen=false;this.commentReplyWizardOpen=false;this.pullCommentWizardOpen=false;}
      else if(subview.startsWith('material_detail')||subview.startsWith('material-detail')){
        const mid=Number(String(subview).split(/[/:]/)[1]||0)||0;
        this.wizardOpen=false;this.massWizardOpen=false;this.deleteWizardOpen=false;this.commentReplyWizardOpen=false;this.pullCommentWizardOpen=false;
        if(mid)this.openMaterialDetail(mid); else {this.matrixTab='materials'}
      }
      else if(subview==='material_import'||subview==='folder_materials'||subview==='import'){this.matrixTab='materialImport';this.wizardOpen=false;this.massWizardOpen=false;this.deleteWizardOpen=false;this.commentReplyWizardOpen=false;this.pullCommentWizardOpen=false;}
      else if(subview==='uids'||subview==='uid'){return this.navigate('chat','uids')}
      else {this.matrixTab='tasks';this.wizardOpen=false;this.massWizardOpen=false;this.deleteWizardOpen=false;this.commentReplyWizardOpen=false;this.pullCommentWizardOpen=false;}
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
      if(subview==='country_data'){
        this.subview='country_data';
        this.countryDataPane='list';
        this.countryDataEditId=null;
      } else if(subview==='industry_data'){
        this.subview='industry_data';
        this.industryDataPane='list';
        this.industryDataEditId=null;
        this.industryDataParentId=null;
      } else if(subview==='company_data'){
        this.subview='company_data';
        this.industryDataPane='list';
        this.industryDataEditId=null;
        this.industryDataParentId=null;
      } else {
        this.industryDataPane='list';
        this.industryDataEditId=null;
        this.industryDataParentId=null;
        this.subview = subview || 'permissions';
      }
    } else if(view==='settings'){
      if(subview==='login_gate'){
        this.showLoginGate('系统鉴权设置');
        return;
      }
      if(['browser','message','task','backup','env','password'].includes(subview)){
        this.settingsSection=subview;
        setTimeout(()=>this.scrollSettings(this.settingsSection),150);
      } else if(subview==='clock'){
        this.settingsSection='browser';
        setTimeout(()=>this.scrollSettings('browser'),150);
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
      const metaKey=(view==='chat'&&this.chatPane==='uids')?'uids':(view==='aiLeads'&&this.aiLeadsPane==='clues')?'aiLeadClues':(view==='aiLeads'&&this.aiLeadsPane==='clue_data')?'aiLeadClueData':view;
      const [pageTitle]=this.viewPageMeta(metaKey);
      if(pageTitle) document.title=`${pageTitle} - TKSwarm`;
    }

    // 跨页：优先复用 router 已画好的壳与 _navGen；同页刷新另起代次且不闪壳
    let gen=this._navGen||0;
    if(prevView!==view){
      const contentEl=document.querySelector('#content');
      const shell=contentEl?.querySelector?.('.page-shell-loading');
      const shellView=shell?.getAttribute('data-page-shell')||'';
      // router.demotePublishShell 可能已把 page-shell 换成矩阵壳；此时不能因「找不到 page-shell」再画回整页加载
      const matrixReady=view==='publish'&&!!(contentEl?.querySelector?.('#matrix-body')&&contentEl?.querySelector?.('.matrix-tabs'));
      if(shellView!==view && !matrixReady){
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
    if(view==='accountWizard')return '';
    if(view==='chat'&&(this.chatPane||'workbench')!=='uids')return '';
    if(view==='aiLeads'&&(this.aiLeadsPane==='clues'||this.aiLeadsPane==='clue_data'||this.aiLeadsPane==='list'||this.aiLeadsPane==='detail'))return '';
    if(view==='rbac'&&(this.subview==='country_data'||this.subview==='industry_data'||this.subview==='company_data'))return '';
    // 视频交付·客户详情：顶栏显示「客户定制视频」+ 企业/账号信息
    if(view==='videoDelivery'&&this.videoDeliveryDetailHead){
      const t=String(this.videoDeliveryDetailHead.title||'客户定制视频');
      const d=String(this.videoDeliveryDetailHead.desc||'');
      return `<div class="page-head"><div><h1>${this.esc(t)}</h1><p>${this.esc(d)}</p></div></div>`;
    }
    if(view==='youtubeAccounts'&&this.youtubeAccountsPane==='videos'){
      return `<div class="page-head"><div><h1>YouTube 数据面板</h1><p>频道内容列表：拉取、删除，查看浏览/点赞/评论</p></div></div>`;
    }
    if(view==='youtubeAccounts'&&this.youtubeAccountsPane==='video'){
      return `<div class="page-head"><div><h1>YouTube 内容详情</h1><p>字段信息与评论：可拉取、删除、回复</p></div></div>`;
    }
    const metaKey=(view==='chat'&&this.chatPane==='uids')?'uids':(view==='aiLeads'&&this.aiLeadsPane==='clues')?'aiLeadClues':(view==='aiLeads'&&this.aiLeadsPane==='clue_data')?'aiLeadClueData':view;
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

      // 拉数前立刻拆掉整页加载壳，避免接口慢/挂起时永久停在「正在加载页面」
      const content=document.querySelector('#content');
      try{
        if(content){
          if(this.view==='publish' && typeof this.ensureMatrixShell==='function'){
            const body=this.ensureMatrixShell(this.matrixTab||'tasks');
            if(body && (!body.children.length || body.querySelector('.page-shell-loading,.matrix-loading-panel,.tk-list-loading'))){
              body.innerHTML=this.listLoadingHtml({ title:opts.loadingTitle||'正在加载数据', desc:opts.loadingDesc||'同步列表中，请稍候…', fill:true });
            }
          }else if(content.querySelector('.page-shell-loading') && !opts.skipListLoading){
            const shell=content.querySelector('.page-shell-loading');
            if(shell){ shell.classList.remove('page-shell-loading'); shell.classList.add('is-page-loading'); }
            this.paintListLoading(content,{ title:opts.loadingTitle||'正在加载数据', desc:opts.loadingDesc||'同步列表中，请稍候…' });
          }else if(!content.querySelector('.page-shell-loading')&&!opts.skipListLoading){
            this.paintListLoading(content,{ title:opts.loadingTitle||'正在加载数据', desc:opts.loadingDesc||'同步列表中，请稍候…' });
          }
        }
        const renderTimeoutMs=Number(opts.renderTimeoutMs)||45000;
        let renderTimer=null;
        try{
          await Promise.race([
            renderFn.call(this,{...opts,still}),
            new Promise((_,rej)=>{renderTimer=setTimeout(()=>rej(new Error('页面渲染超时 ('+Math.round(renderTimeoutMs/1000)+'s)，请重试')), renderTimeoutMs)})
          ]);
        }finally{
          if(renderTimer)clearTimeout(renderTimer);
        }
      }finally{ /* no innerHTML monkey-patch */ }
      if(!still())return;
      const head=this.pageHead(this.view);
      const el=document.querySelector('#content');
      if(head&&el&&!el.querySelector('.page-head'))el.insertAdjacentHTML('afterbegin',head);
      // 渲染成功后清掉残留整页加载壳，避免刷新后永久转圈
      el?.querySelectorAll?.('.page-shell-loading')?.forEach((n)=>{
        if(el.querySelector('#matrix-body')||el.querySelector('.panel:not(.page-shell-loading)'))n.remove();
      });
      if(window.UI&&el&&!el.querySelector('#matrix-body'))UI.decorate(el);
    }catch(e){
      if(!still())return;
      this.toast(e.message,true);
      const el=document.querySelector('#content');
      const failMsg=String(e.message||'请重试');
      const markFail=(node)=>{
        if(!node)return;
        node.classList.add('is-fail');
        const tip=node.querySelector('.loader-text span')||node.querySelector('.muted');
        if(tip) tip.textContent='加载失败：'+failMsg;
        const title=node.querySelector('.loader-text b');
        if(title) title.textContent='加载失败';
      };
      const shell=el?.querySelector('.page-shell-loading');
      if(shell){
        shell.classList.add('is-fail');
        markFail(shell.querySelector('.tk-list-loading')||shell);
      }else{
        el?.querySelectorAll('.tk-list-loading').forEach(markFail);
      }
    }
  },
  connectLiveLogs(){try{const wsBase=(window.__TKSWARM_CONFIG__&&typeof window.__TKSWARM_CONFIG__.getWsBase==='function')?window.__TKSWARM_CONFIG__.getWsBase():(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`);const ws=new WebSocket(wsBase);this.ws=ws;ws.onopen=()=>{this.syncExecutorWsStatus()};ws.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.type==='operation-log'){this.liveLogs.unshift(m.data);this.liveLogs=this.liveLogs.slice(0,500);if(typeof this.renderLiveLogs==='function')this.renderLiveLogs()}if(m.type==='work-push'){this.handleWorkPush(m.data||{})}if(m.type==='work-done'){this.onExecutorWorkDone(m.data||{})}if(m.type==='executor-ack'||m.type==='executor-hub'){const on=!!(m.data&&(m.data.enabled!=null?m.data.enabled:this.isExecutorEnabled()));const btn=document.querySelector('#executor-toggle-btn');if(btn)btn.classList.toggle('is-on',this.isExecutorEnabled());void on}if(m.type==='human-verify'){this.onHumanVerifyPush(m.data||{})}if(m.type==='new_message'){this.playTipSound()}if(['account_status','new_message','friend_status','friend_msg_read_status','message_status'].includes(m.type)&&this.view==='chat'){this.refresh()}}catch{}};ws.onclose=()=>setTimeout(()=>this.connectLiveLogs(),3000);setInterval(()=>{if(this.ws&&this.ws.readyState===1){this.ws.send(JSON.stringify({type:'heartbeat'}));this.syncExecutorWsStatus()}},25000)}catch{}},
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
      if(window.UI){
        UI.decorate(target);
        UI.liftMenu(target, btn, {align:'left'});
      }
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
  /** 设置表单控件（SMTP 等页不依赖 settings.js 也能用） */
  settingsInput(name,value='',type='text',required=false){return `<input class="input" name="${name}" type="${type}" value="${this.esc(value)}" ${required?'required':''}>`},
  settingsSelect(name,items,value){return `<select name="${name}">${(items||[]).map(([v,n])=>`<option value="${v}" ${String(v)===String(value)?'selected':''}>${n}</option>`).join('')}</select>`},
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
  imageField(name,label,value='',multiple=false,opts={}){
    const urls=String(value||'').split(',').filter(Boolean);
    const allowVideo=!!opts.allowVideo;
    const accept=opts.accept||(allowVideo?'image/jpeg,image/png,image/jpg,image/webp,image/gif,video/mp4':'.jpg,.jpeg,.png,.webp,.gif,image/*');
    const pickLabel=opts.pickLabel||(allowVideo?'选择图片/视频':'选择图片');
    const dropText=opts.dropText||(allowVideo?'拖拽图片或视频到此处，或使用按钮选择。':'拖拽图片到此处，或使用按钮选择。悬停可预览。');
    const hint=opts.hint?`<div class="muted field-hint" style="display:block;margin:0 0 8px;line-height:1.5">${this.esc(opts.hint)}</div>`:'';
    const maxVideoSec=Number(opts.maxVideoSec||6);
    const minImage=Number(opts.minImage||0);
    const listHtml=urls.map(url=>{
      const isVid=/\.mp4($|\?)/i.test(url);
      return isVid
        ?`<div class="uploader-item is-video"><video src="${this.esc(url)}" muted playsinline></video><button type="button" class="danger" data-url="${this.esc(url)}">×</button></div>`
        :`<div class="uploader-item"><img src="${this.esc(url)}" alt=""><button type="button" class="danger" data-url="${this.esc(url)}">×</button></div>`;
    }).join('');
    return `<div class="field full"><label>${label}</label>${hint}<div class="uploader" data-multiple="${multiple?'true':'false'}" data-allow-video="${allowVideo?'true':'false'}" data-max-video-sec="${maxVideoSec}" data-min-image="${minImage}"><input type="file" accept="${this.esc(accept)}" ${multiple?'multiple':''} hidden><input type="hidden" name="${name}" value="${this.esc(urls.join(','))}"><div class="uploader-drop"><span>${this.esc(dropText)}</span><button type="button" class="primary" data-pick>${this.esc(pickLabel)}</button></div><div class="uploader-list">${listHtml}</div></div><div class="field-error"></div></div>`;
  },
  select(name,label,items,value=''){return `<div class="field"><label>${label}</label><select name="${name}"><option value="">未选择</option>${items.map(x=>`<option value="${x.id}" ${String(value)===String(x.id)?'selected':''}>${this.esc(x.name)}</option>`).join('')}</select></div>`},
  selectRaw(name,label,items,value){return `<div class="field"><label>${label}</label><select name="${name}">${items.map(([v,n])=>`<option value="${v}" ${v===value?'selected':''}>${n}</option>`).join('')}</select></div>`},
  /** 省流模式开关：拦截图片/视频/音频/字体/广告等。defaultOn=true 时新建默认开启 */
  saveTrafficField(value, defaultOn=false){
    const raw=value;
    let on=!!defaultOn;
    if(raw!==undefined&&raw!==null&&raw!==''){
      if(typeof raw==='boolean')on=raw;
      else if(typeof raw==='number')on=raw!==0;
      else{
        const s=String(raw).trim().toLowerCase();
        if(['1','true','yes','on','开启'].includes(s))on=true;
        else if(['0','false','no','off','关闭'].includes(s))on=false;
      }
    }
    return this.selectRaw('saveTraffic','省流模式',[['false','关闭'],['true','开启']],on?'true':'false')
      +`<div class="field full"><div class="muted">开启后拦截网页图片、视频、音频、字体、SVG 图标与广告资源；人机验证弹框内的图片/拼图会自动放行，不影响人工验证</div></div>`;
  },
  parseSaveTrafficInput(raw, defaultOn=false){
    if(raw===undefined||raw===null||raw==='')return !!defaultOn;
    if(typeof raw==='boolean')return raw;
    if(typeof raw==='number')return raw!==0;
    const s=String(raw).trim().toLowerCase();
    if(['1','true','yes','on','开启'].includes(s))return true;
    if(['0','false','no','off','关闭'].includes(s))return false;
    return !!defaultOn;
  },
  multiSelect(name,label,items,values=[]){const rows=name==='materialIds'?this.ownedMaterials(items):items;return `<div class="field full"><label>${label}</label><select name="${name}" multiple size="4">${rows.length?rows.map(x=>`<option value="${x.id}" ${values.map(Number).includes(Number(x.id))?'selected':''}>${this.esc(x.name)}</option>`).join(''):'<option disabled>暂无素材</option>'}</select></div>`},
  toggleModalFullscreen(force){
    if(window.UI)UI.toggleDialogFullscreen('#modal',force);
  },
  /** 表单提交：全屏加载 → 成功停留 1s → after（回列表并刷新） */
  async runFormSubmit(work,opts={}){
    const title=opts.title||'正在提交';
    const desc=opts.desc||'请稍候，正在保存数据…';
    const successTitle=opts.successTitle||'提交成功';
    const successDesc=opts.successDesc||'即将返回列表并刷新数据…';
    const skipLoading=!!(opts.skipLoading||opts.silent||opts.noLoading);
    const delayMs=opts.delayMs==null?(skipLoading?0:1000):Number(opts.delayMs);
    if(!skipLoading&&window.UI)UI.loading(true,title,desc,{mode:'submit'});
    try{
      const result=await work();
      if(!skipLoading){
        if(window.UI)UI.loading(true,successTitle,successDesc,{mode:'success'});
        if(delayMs>0)await new Promise(r=>setTimeout(r,delayMs));
        if(window.UI)UI.loading(false);
      }
      if(typeof opts.after==='function')await opts.after(result);
      return result;
    }catch(e){
      if(!skipLoading&&window.UI)UI.loading(false);
      throw e;
    }
  },
  _beginSubmitNavDefer(){
    if(this._submitNavDeferDepth){
      this._submitNavDeferDepth+=1;
      return this._submitNavBag;
    }
    this._submitNavDeferDepth=1;
    const bag={closeModal:false,refresh:false,refreshOpts:null,navigate:null};
    this._submitNavBag=bag;
    this._submitNavOrig={
      closeModal:this.closeModal,
      refresh:this.refresh,
      navigate:this.navigate,
    };
    this.closeModal=()=>{bag.closeModal=true};
    this.refresh=(o)=>{bag.refresh=true;bag.refreshOpts=o||{}};
    this.navigate=(view,subview='')=>{bag.navigate={view,subview:subview||''}};
    return bag;
  },
  _endSubmitNavDefer(){
    this._submitNavDeferDepth=Math.max(0,(this._submitNavDeferDepth||1)-1);
    if(this._submitNavDeferDepth>0)return;
    const orig=this._submitNavOrig;
    if(orig){
      this.closeModal=orig.closeModal;
      this.refresh=orig.refresh;
      this.navigate=orig.navigate;
    }
    this._submitNavOrig=null;
  },
  async _flushSubmitNavDefer(bag){
    if(!bag)return;
    if(bag.closeModal)this.closeModal();
    if(bag.navigate)await this.navigate(bag.navigate.view,bag.navigate.subview);
    else if(bag.refresh)await this.refresh(bag.refreshOpts||{});
  },
  modal(title,body,submit,raw=false,opts={}){
    const modal=document.querySelector('#modal');
    if(!modal)return;
    if(window.UI)UI.resetDialogFullscreen(modal);
    const foot=modal.querySelector('.modal-foot');
    const head=modal.querySelector('.modal-head');
    const submitBtn=foot?.querySelector('button[type=submit]');
    const hideSubmit=!!opts.hideSubmit;
    const bare=!!opts.bare;
    document.querySelector('#modal-title').textContent=title;
    document.querySelector('#modal-body').innerHTML=body;
    modal.classList.remove('hidden');
    modal.classList.toggle('detail-modal',!!opts.wide);
    modal.classList.toggle('bare-modal',bare);
    if(head)head.classList.toggle('hidden',bare);
    if(foot)foot.classList.toggle('hidden',!!opts.hideFooter||hideSubmit||bare);
    if(submitBtn){
      submitBtn.textContent=opts.submitText||'保存';
      submitBtn.className='ep-btn ep-btn-primary';
      submitBtn.classList.toggle('hidden',hideSubmit||bare);
    }
    this._modalOnClose=opts.onClose||null;
    requestAnimationFrame(()=>modal.classList.add('is-visible'));
    if(window.UI)UI.decorate(modal);
    const form=document.querySelector('#modal-form');
    form.onsubmit=async e=>{
      e.preventDefault();
      if(opts.hideFooter||hideSubmit){this.closeModal();return}
      const invalid=UI.validate(e.target);
      if(invalid){this.toast(invalid,true);return}
      const data=new FormData(e.target);
      try{
        await this.runFormSubmit(async()=>{
          const bag=this._beginSubmitNavDefer();
          try{
            await submit(raw?data:Object.fromEntries(data));
          }finally{
            this._endSubmitNavDefer();
          }
          return bag;
        },{
          title:opts.loadingTitle||'正在提交',
          desc:opts.loadingDesc||'请稍候，正在保存数据…',
          successTitle:opts.successTitle||'提交成功',
          successDesc:opts.successDesc||'即将返回列表并刷新数据…',
          skipLoading:!!(opts.skipLoading||opts.silent||opts.noLoading),
          delayMs:opts.delayMs,
          after:async(bag)=>{
            if(bag&&(bag.closeModal||bag.refresh||bag.navigate))await this._flushSubmitNavDefer(bag);
            else{this.closeModal();await this.refresh()}
          },
        });
      }catch(err){
        this.toast(err.message,true);
      }
    };
  },
  closeModal(){
    const modal=document.querySelector('#modal');
    modal?.classList.remove('is-visible');
    if(window.UI)UI.resetDialogFullscreen(modal);
    setTimeout(()=>{
      modal?.classList.add('hidden');
      modal?.classList.remove('detail-modal');
      modal?.classList.remove('bare-modal');
      modal?.classList.remove('dialog-fullscreen');
      modal?.querySelector('.modal-head')?.classList.remove('hidden');
      modal?.querySelector('.modal-foot')?.classList.remove('hidden');
      const submitBtn=modal?.querySelector('button[type=submit]');
      if(submitBtn){submitBtn.classList.remove('hidden');submitBtn.textContent='保存';submitBtn.className='ep-btn ep-btn-primary'}
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
  async remove(path,name){
    if(!(await this.ask(`确定删除这个${name}吗？`)))return;
    try{
      await this.runFormSubmit(async()=>{
        await this.api(path,{method:'DELETE'});
        this.toast(`${name}已删除`);
        if(String(path).includes('/groups')&&typeof this.invalidateAccountGroupsCache==='function')this.invalidateAccountGroupsCache();
        await this.loadRefs();
      },{
        title:'正在删除',
        desc:`请稍候，正在删除${name}…`,
        successTitle:'删除成功',
        successDesc:'即将刷新列表…',
        after:async()=>{await this.refresh()},
      });
    }catch(e){this.toast(e.message,true)}
  }
};

window.app = app;
window.AppPages = window.AppPages || {};
