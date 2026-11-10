(function () {
  if (!window.app) throw new Error('app-core must load before pages/settings.js');
  const __methods = {
    canEditSettings(){return this.canPermission('system.view')||this.canPermission('rbac.manage')},
    async renderSettings(){
      if(!this.canView('settings')&&!this.canAnyPermission('system.view','rbac.manage')) return this.renderPageDenied('当前角色无权查看系统设置');
      document.querySelector('#content').classList.remove('chat-mode');
      const [st,sys,auth,browser,linuxBrowsersPack]=await Promise.all([
        this.api('/settings'),
        this.api('/system/info'),
        this.api('/auth/status'),
        this.api('/browser/status').catch(()=>({online:false,message:'无法检测'})),
        this.api('/node/linux-browsers').catch(()=>({items:[]})),
      ]);
      this.notificationSound=st.notificationSound||'chime';
      this.notificationSync=st.notificationSync!==false;
      const sec=this.settingsSection||'browser';
      const linuxItems=Array.isArray(linuxBrowsersPack?.items)?linuxBrowsersPack.items:[];
      const curLinuxUrl=String(st.linuxBrowserApiUrl||'').replace(/\/+$/,'');
      const linuxSelectPairs=[['','请选择已检测成功的服务器浏览器']].concat(
        linuxItems.map((it)=>[String(it.browserApiUrl||''), String(it.label||it.name||it.browserApiUrl||'')])
      );
      if(curLinuxUrl && !linuxSelectPairs.some(([v])=>v===curLinuxUrl)){
        linuxSelectPairs.push([curLinuxUrl, `当前已保存（待重新检测）：${curLinuxUrl}`]);
      }
      // 多国时钟已移至顶栏时钟图标选择，按用户单独保存，设置页不再展示
      const menu=this.opt('settingsSections',[['env','接口与开发环境'],['browser','浏览器设置'],['message','消息设置'],['task','任务与无头'],['backup','备份与鉴权'],['password','修改账号密码']]);
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
                <span class="muted">浏览器自动化由本机 Node 处理；业务数据走接口域名</span>
              </div>
              ${this.formRow('接口域名 (API Base)', `<input class="input" id="custom-api-base" value="${this.esc(window.TKSWARM_API_BASE||'')}" placeholder="http://tkswarm-api.dyyweb.com">`, '业务数据一律走此线上域名；禁止填 127.0.0.1。仅 /browser、/system、WebSocket 走本机 Node')}
              ${this.formRow('WebSocket 地址', `<input class="input" id="custom-ws-base" value="${this.esc(localStorage.getItem('tkswarm_custom_ws_base')||'')}" placeholder="例如 ws://127.0.0.1:8999/ws">`, '用于实时操作日志与消息推送（本机 Node）')}
              <div class="modal-foot">
                <button class="primary" type="button" onclick="app.saveEnvConfig()">应用并刷新页面</button>
              </div>
            </div>
  
            <div id="section-browser" class="settings-card">
              <div class="settings-header"><h2 class="settings-title">浏览器设置</h2>
                <div class="action-bar" style="margin:0">
                  <button class="ghost" type="button" onclick="app.testBrowserConnection()">测试连接</button>
                  ${this.canEditSettings()?`<button class="ghost" type="button" onclick="app.detectTkSwarmBrowser()">检测第一页自研浏览器 / Linux</button>`:''}
                  ${this.bitBrowserUiEnabled?.()?`<button class="ghost" type="button" onclick="app.rollbackBrowserToBit()">一键回滚比特</button>
                  <button class="ghost" type="button" onclick="app.openBitDownload()">下载比特浏览器</button>`:''}
                  ${this.canPermission('account.create')?`<button class="danger" type="button" onclick="app.deleteBrowsersFromSettings()">删除浏览器环境</button>`:''}
                </div>
              </div>
              ${/* 暂隐：browserType 未参与运行时，账号用各自 browser_type */''}
              ${this.formRow('窗口模式',this.settingsSelect('browserWindowMode',this.browserWindowPairs(),st.browserWindowMode||'visible'),'显示：能看到浏览器操作过程，方便排错；隐藏：后台静默跑，适合正式批量发布')}
              ${this.formRow('浏览器后端',this.settingsSelect('browserBackend',this.bitBrowserUiEnabled?.()?[['auto','自动探测'],['bit','比特浏览器'],['tkswarm','第一页自研浏览器']]:[['auto','自动探测'],['tkswarm','第一页自研浏览器']],(st.browserBackend==='bit'&&!(this.bitBrowserUiEnabled?.()))?'tkswarm':(st.browserBackend||'auto')),this.bitBrowserUiEnabled?.()?'auto：按 health 识别桌面 / Linux / 比特；强制指定后仍走同一套兼容协议':'auto：按 health 识别桌面 / Linux；也可强制指定第一页自研浏览器')}
              ${this.formRow('主 API 地址',this.settingsInput('browserApiUrl',st.browserApiUrl),this.browserStatusHint(browser))}
              ${this.bitBrowserUiEnabled?.()?this.formRow('比特专用 URL',this.settingsInput('bitBrowserApiUrl',st.bitBrowserApiUrl||''),'可选；与自研同时开时改一端端口并填此地址，空则用主 API'):''}
              ${this.formRow('第一页自研浏览器专用 URL',this.settingsInput('tkswarmBrowserApiUrl',st.tkswarmBrowserApiUrl||''),'可选；桌面/Linux 专用基址，空则用主 API（可填远程机房）')}
              ${this.bitBrowserUiEnabled?.()?this.formRow('API Token',this.settingsInput('browserApiToken','','password'),'比特浏览器专用；留空则不修改已保存 Token'):''}
              ${this.formRow('第一页自研浏览器专用 Token',this.settingsInput('tkswarmBrowserApiToken','','password'),'务必留空：本机自研/Linux 已登录即可打开共用环境。填了会带 Bearer，A/B 换人后容易 Login out。仅远程无桌面登录的机器才手动填')}
              ${this.formRow('服务器浏览器(Linux)',this.settingsSelect('linuxBrowserApiUrl',linuxSelectPairs,curLinuxUrl||''),linuxItems.length?`从运营后台「SSH服务器」中选择已健康检测成功的实例（共 ${linuxItems.length} 台）；仅 AI 拓客与客服坐席；强制 Electron（EL）核，与桌面自研共用环境包`:'暂无可用服务器。请管理员在运营后台 → SSH服务器 添加主机、部署并检测成功后再选')}
              ${this.formRow('服务器浏览器(Linux) Token',this.settingsInput('linuxBrowserApiToken','','password'),'Linux 客户端 API Token；留空则不修改已保存值')}
              ${this.formRow('云代理 API',this.settingsInput('cloudProxyApiUrl',st.cloudProxyApiUrl||''),'可选，用于拉取云代理列表')}
              <div class="field full"><div class="muted" style="margin:0 0 8px">${this.bitBrowserUiEnabled?.()?'兼容：比特、<b>第一页自研浏览器</b>、<b>第一页自研浏览器 Linux（EL）</b>。':'当前主推：<b>第一页自研浏览器</b> / <b>第一页自研浏览器 Linux（EL）</b>。'}默认同端口 54345 只跑其一；真·并行请分端口并填专用 URL。「检测」识别 Linux/桌面并切到 tkswarm。Linux 禁止 Chrome 回退。</div></div>
              <div class="field full"><div class="muted" style="margin:0 0 8px;padding:8px 10px;background:var(--surface-2,#f6f7f9);border-radius:6px">坐席/拓客：Node 指向 Linux Browser（EL）+ Token；缺环境包或登录态不同步时任务会退回排队等待本机推送。日常无头；有头扫码用 VNC。</div></div>
              <div class="modal-foot">${this.canPermission('system.view')||this.canPermission('rbac.manage')?`<button class="primary" type="submit">保存设置</button>`:'<span class="muted">当前角色无权保存</span>'}</div>
            </div>
  
            <div id="section-message" class="settings-card">
              <div class="settings-header"><h2 class="settings-title">消息设置</h2>
                <button class="ghost" type="button" onclick="app.previewTipSound()">试听提示音</button>
              </div>
              <div class="field full"><div class="muted" style="margin:0 0 12px">消息模板对应 <b>TikTok 私信</b>。私信同步：API 优先拉 IM；失败可 <b>Bit 拦截/爬取</b>。失败标记 unsupported，不写假消息。</div></div>
              ${this.formRow('启用私信话术',this.settingsSelect('dmTemplateEnabled',[['true','开启'],['false','关闭']],String(st.dmTemplateEnabled)!=='false'?'true':'false'),'关闭后群发与客服将禁用话术选择，仅可手填内容')}
              ${this.formRow('私信同步',this.settingsSelect('privateMessageSync',[['true','开启'],['false','关闭']],String(st.privateMessageSync)!=='false'?'true':'false'),'开启后由调度按间隔入队 dm_sync（需本机 Node）')}
              ${this.formRow('同步间隔（分钟）',this.settingsInput('messageSyncInterval',st.messageSyncInterval??10,'number'),'1–60 分钟；旧版若曾按秒保存，保存时会自动折算')}
              ${this.formRow('私信模式',this.settingsSelect('messageSyncMode',[['api','API优先'],['browser','仅浏览器']],st.messageSyncMode||'api'),'API：CK HTTP 探测；失败可按下方开关降级到浏览器打开 /messages。浏览器：只走本地浏览器拦截/爬取')}
              ${this.bitBrowserUiEnabled?.()?this.formRow('API失败降级Bit',this.settingsSelect('dmSyncBitFallback',[['true','开启'],['false','关闭']],String(st.dmSyncBitFallback)!=='false'?'true':'false'),'HTTP IM 失败时用比特环境拦截真实 XHR 或 DOM 只读爬取；仍失败标记 unsupported，不写假消息'):this.formRow('API失败降级浏览器',this.settingsSelect('dmSyncBitFallback',[['true','开启'],['false','关闭']],String(st.dmSyncBitFallback)!=='false'?'true':'false'),'HTTP IM 失败时用本地浏览器环境拦截真实 XHR 或 DOM 只读爬取；仍失败标记 unsupported，不写假消息')}
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
                ${this.formRow('粉丝同步上限',this.settingsInput('fansSyncMaxPerRun',st.fansSyncMaxPerRun||500,'number'),'单次浏览器拉粉丝列表最多条数（50–2000）')}
              </details>
              <div class="modal-foot">${this.canPermission('system.view')||this.canPermission('rbac.manage')?`<button class="primary" type="submit">保存设置</button>`:'<span class="muted">当前角色无权保存</span>'}</div>
            </div>
  
            <div id="section-task" class="settings-card">
              <div class="settings-header"><h2 class="settings-title">任务与无头</h2></div>
              ${this.formRow('自研浏览器任务并发',this.settingsInput('taskConcurrency',st.taskConcurrency??6,'number'),'本机同时执行的自研浏览器任务路数（3–20，默认 6）。按当前登录用户独立保存，保存后对任务执行立即生效')}
              ${this.formRow('发布人工确认',this.settingsSelect('publishManualConfirm',[['false','关闭（自动发布）'],['true','开启（填好后停手）']],String(st.publishManualConfirm)==='true'?'true':'false'))}
              ${this.formRow('窗口模式（总开关）',this.settingsSelect('browserWindowMode',this.browserWindowPairs(),st.browserWindowMode||'visible'),'与「浏览器设置」里同一项，改任意一处都会生效')}
              <div class="field full"><div class="muted" style="margin:4px 0 8px">以下分项仅在窗口模式选「按分项开关」时生效：</div></div>
              ${this.formRow('登录无头',this.settingsSelect('headlessLogin',[['false','关闭'],['true','开启']],String(st.headlessLogin)==='true'?'true':'false'))}
              ${this.formRow('发布无头',this.settingsSelect('headlessPublish',[['false','关闭'],['true','开启']],String(st.headlessPublish)==='true'?'true':'false'))}
              ${this.formRow('私信无头',this.settingsSelect('headlessMessage',[['false','关闭'],['true','开启']],String(st.headlessMessage)==='true'?'true':'false'))}
              ${this.formRow('资料无头',this.settingsSelect('headlessProfile',[['false','关闭'],['true','开启']],String(st.headlessProfile)==='true'?'true':'false'))}
              ${this.formRow('扫码无头',this.settingsSelect('headlessScan',[['false','关闭'],['true','开启']],String(st.headlessScan)==='true'?'true':'false'))}
              <div class="modal-foot">${this.canPermission('system.view')||this.canPermission('rbac.manage')?`<button class="primary" type="submit">保存设置</button>`:'<span class="muted">当前角色无权保存</span>'}</div>
            </div>
  
            <div id="section-backup" class="settings-card">
              <div class="settings-header"><h2 class="settings-title">备份与鉴权</h2><span class="muted">库体积 ${Math.round((sys.databaseSize||0)/1024)} KB</span></div>
              ${this.formRow('本地登录',this.settingsSelect('authEnabled',[['false','关闭'],['true','开启']],String(st.authEnabled)==='true'||auth.authEnabled?'true':'false'),'开启后接口需登录')}
              <div class="action-bar">
                ${this.canPermission('system.view')||this.canPermission('rbac.manage')?`<button class="primary" type="button" onclick="app.createBackup()">立即备份</button>
                <label class="ghost" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;cursor:pointer">恢复备份<input type="file" accept=".sql,.json" hidden onchange="app.restoreBackup(this)"></label>`:'<span class="muted">当前角色无权备份</span>'}
              </div>
              <div class="form-hint" style="margin:8px 0 12px">恢复后请运行 close.bat，再 start.bat。密钥：${this.esc(sys.secretKeyPath||'')}</div>
              ${(sys.backups||[]).length?`<div class="table-container"><table><thead><tr><th>备份</th><th>大小</th><th>时间</th><th>操作</th></tr></thead><tbody>${sys.backups.map(b=>`<tr><td>${this.esc(b.name)}</td><td>${Math.round(b.size/1024)} KB</td><td>${this.esc(b.mtime)}</td><td><a class="tiny" href="${b.download}">下载</a></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty" style="padding:24px">还没有备份</div>'}
              <div class="modal-foot">${this.canPermission('system.view')||this.canPermission('rbac.manage')?`<button class="primary" type="submit">保存设置</button>`:'<span class="muted">当前角色无权保存</span>'}</div>
            </div>
  
            <div id="section-password" class="settings-card">
              <div class="settings-header"><h2 class="settings-title">修改账号密码</h2><span class="muted">仅影响当前登录管理员</span></div>
              ${auth.user?`<div class="form-grid">${this.field('oldPassword','原密码','','password')}${this.field('newPassword','新密码','','password')}<div class="field full"><div class="muted">新密码建议不少于 6 位；更新后无需重新登录。</div></div><div class="field"><button class="primary" type="button" onclick="app.changeAuthPassword()">更新密码</button></div></div>`:`<div class="shell-note">当前未开启本地鉴权或未登录管理员，无法修改密码。请先在「备份与鉴权」开启鉴权并登录。</div><div class="action-bar" style="margin-top:12px"><button class="ghost" type="button" onclick="app.scrollSettings('backup')">前往备份与鉴权</button></div>`}
            </div>
          </form>
        </div>
      </div>`;
      document.querySelector('#settings-form').onsubmit=async e=>{
        e.preventDefault();
        if(!this.canEditSettings()){this.toast('当前角色无权修改设置',true);return}
        const d=Object.fromEntries(new FormData(e.target));
        delete d.oldPassword; delete d.newPassword;
        ['messageSyncInterval','notificationInterval','fansSyncMaxPerRun','taskConcurrency','translationQuota','translationUsed'].forEach(k=>d[k]=Number(d[k]||0));
        d.messageSyncInterval=Math.min(60,Math.max(1,d.messageSyncInterval||10));
        d.notificationInterval=Math.min(60,Math.max(1,d.notificationInterval||1));
        d.fansSyncMaxPerRun=Math.min(2000,Math.max(50,d.fansSyncMaxPerRun||500));
        d.taskConcurrency=Math.min(20,Math.max(3,d.taskConcurrency||6));
        d.publishManualConfirm=d.publishManualConfirm==='true';
        ['authEnabled','headlessLogin','headlessPublish','headlessMessage','headlessProfile','headlessScan','headlessCapcut','privateMessageSync','notificationSync','translationOnReceive','dmTemplateEnabled','dmSyncBitFallback'].forEach(k=>d[k]=d[k]==='true');
        if(!d.browserApiToken)delete d.browserApiToken;
        if(!d.tkswarmBrowserApiToken)delete d.tkswarmBrowserApiToken;
        if(!d.linuxBrowserApiToken)delete d.linuxBrowserApiToken;
        if(!d.translationApiKey)delete d.translationApiKey;
        // SMTP 已迁至「开发管理 → SMTP 配置」，基础设置不再提交 smtp.*
        Object.keys(d).forEach((k)=>{ if(String(k).startsWith('smtp.')) delete d[k]; });
        await this.api('/settings',{method:'PUT',body:JSON.stringify(d)});
        // Provider 读本机 local-settings：浏览器键再同步一份
        try{
          const local={
            browserApiUrl:d.browserApiUrl,
            browserBackend:d.browserBackend,
            bitBrowserApiUrl:d.bitBrowserApiUrl||'',
            tkswarmBrowserApiUrl:d.tkswarmBrowserApiUrl||'',
            linuxBrowserApiUrl:d.linuxBrowserApiUrl||'',
            taskConcurrency:d.taskConcurrency,
          };
          if(d.browserApiToken) local.browserApiToken=d.browserApiToken;
          if(d.tkswarmBrowserApiToken) local.tkswarmBrowserApiToken=d.tkswarmBrowserApiToken;
          if(d.linuxBrowserApiToken) local.linuxBrowserApiToken=d.linuxBrowserApiToken;
          await this.api('/browser/local-settings',{method:'POST',body:JSON.stringify(local)});
        }catch(_){ /* PHP 已保存即可 */ }
        this.notificationSound=d.notificationSound||'chime';
        this.notificationSync=d.notificationSync!==false;
        this.messageSyncInterval=d.messageSyncInterval;
        this.notificationInterval=d.notificationInterval;
        this._taskConcurrencyCached=d.taskConcurrency;
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
      const keys=['env','browser','message','task','backup','password'];
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
    browserStatusHint(browser){
      if(!browser) return '当前：未检测';
      const label=browser.providerLabel
        ||(browser.providerId==='tkswarm-linuxbrowse'||browser.health?.provider==='tkswarm-linuxbrowse'?'第一页自研浏览器 Linux':null)
        ||(browser.provider==='tkswarm'?'第一页自研浏览器':(this.bitBrowserUiEnabled?.()?'比特浏览器':'本地浏览器'));
      const extra=[];
      if(browser.online&&browser.health){
        if(browser.health.runningWindows!=null) extra.push(`窗口 ${browser.health.runningWindows}/${browser.health.maxConcurrent||'?'}`);
        if(browser.health.platform) extra.push(browser.health.platform);
        if(browser.health.hostId) extra.push('host '+browser.health.hostId);
      }
      if(browser.online) return `当前：已连接 · ${label}${extra.length?' · '+extra.join(' · '):''} · ${this.esc(browser.apiUrl||'')}`;
      return `当前：未连接 · ${this.esc(browser.message||'')}`;
    },
    async testBrowserConnection(){
      try{
        const r=await this.api('/browser/status');
        const label=r.providerLabel||(r.health?.provider==='tkswarm-linuxbrowse'?'第一页自研浏览器 Linux':null)||(r.provider==='tkswarm'?'第一页自研浏览器':(this.bitBrowserUiEnabled?.()?'比特浏览器':'本地浏览器'));
        this.toast(r.online?`${label} 已连接：${r.message||'ok'}`:(r.message||'未连接'),!r.online);
        this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    /**
     * 一键检测第一页自研浏览器桌面 / Linux：保留已填远程 URL，空或本机则默认 54345。
     */
    async detectTkSwarmBrowser(){
      if(!this.canEditSettings()){this.toast('当前角色无权修改浏览器设置',true);return}
      try{
        const form=document.querySelector('#settings-form');
        const urlInput=form?.querySelector('[name="browserApiUrl"]');
        const current=String(urlInput?.value||'').trim();
        const defaultUrl='http://127.0.0.1:54345';
        // 已填远程地址时不覆盖；仅空或本机占位时写默认
        if(!current){
          if(urlInput) urlInput.value=defaultUrl;
          try{
            await this.api('/settings',{method:'POST',body:JSON.stringify({browserApiUrl:defaultUrl})});
          }catch(_){ /* ignore */ }
        }else if(/localhost|127\.0\.0\.1/i.test(current)){
          try{
            await this.api('/settings',{method:'POST',body:JSON.stringify({browserApiUrl:current})});
          }catch(_){ /* ignore */ }
        }else{
          // 远程 Linux：先把当前 URL 落盘再探测
          try{
            await this.api('/settings',{method:'POST',body:JSON.stringify({browserApiUrl:current})});
          }catch(_){ /* ignore */ }
        }
        const r=await this.api('/browser/status');
        const hp=String(r.health?.provider||r.providerId||'').toLowerCase();
        const isTk=r.provider==='tkswarm'||hp==='tkswarm-browses'||hp==='tkswarm-linuxbrowse'||/tkswarm/i.test(String(r.providerLabel||''));
        if(r.online&&isTk){
          const be=form?.querySelector('[name="browserBackend"]');
          if(be) be.value='tkswarm';
          const url=urlInput?.value||current||defaultUrl;
          try{await this.api('/settings',{method:'POST',body:JSON.stringify({browserApiUrl:url,browserBackend:'tkswarm'})})}catch(_){}
          const label=r.providerLabel||(hp==='tkswarm-linuxbrowse'?'第一页自研浏览器 Linux':'第一页自研浏览器');
          const win=r.health?.runningWindows!=null?` · 窗口 ${r.health.runningWindows}/${r.health.maxConcurrent||'?'}`:'';
          const host=r.health?.hostId?` · host ${r.health.hostId}`:'';
          this.toast(`${label} 已就绪${win}${host} · ${r.apiUrl||url}`);
          this.refresh();
          return;
        }
        if(r.online&&r.provider==='bit'){
          this.toast('当前连到的是比特浏览器。要用第一页自研浏览器 / Linux，请改 API 地址并启动对应服务后重测。');
          this.refresh();
          return;
        }
        if(!r.online&&/login\s*out|请先.*登录|token/i.test(String(r.message||''))){
          const linuxish=/linux|tkswarm-linuxbrowse/i.test(String(r.providerLabel||'')+String(r.health?.provider||'')+String(urlInput?.value||''));
          this.toast(linuxish
            ?'Linux Browser API 已通，但未登录：请在 Web 控制台登录并把 Token 填入上方 API Token'
            :'本地 API 已运行，但未登录：请打开第一页自研浏览器桌面端登录，或填入 Token 后再测',true);
          this.refresh();
          return;
        }
        this.toast(r.message||'未检测到第一页自研浏览器 / Linux，请确认服务已启动且 API 地址正确',true);
        this.refresh();
      }catch(e){this.toast(e.message||'检测失败',true)}
    },
    async rollbackBrowserToBit(){
      if(!this.canEditSettings()){this.toast('当前角色无权修改浏览器设置',true);return}
      try{
        if(!(await this.ask('确认将浏览器后端强制切回「比特浏览器」？保存后立即生效（auto 探测暂停）。'))) return;
        const form=document.querySelector('#settings-form');
        const be=form?.querySelector('[name="browserBackend"]');
        if(be) be.value='bit';
        await this.api('/settings',{method:'POST',body:JSON.stringify({browserBackend:'bit'})});
        this.toast('已回滚：浏览器后端 = 比特浏览器');
        this.refresh();
      }catch(e){this.toast(e.message||'回滚失败',true)}
    },
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
  };
  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages["settings"] = true;
})();
