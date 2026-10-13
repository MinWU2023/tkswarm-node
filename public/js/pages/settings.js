(function () {
  if (!window.app) throw new Error('app-core must load before pages/settings.js');
  const __methods = {
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
              ${/* 暂隐：browserType 未参与运行时，账号用各自 browser_type */''}
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
              ${/* 暂隐：taskConcurrency / taskAccountTimeout / taskBatchInterval / taskMaxRetries 仅入库未读 */''}
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
        ['messageSyncInterval','notificationInterval','fansSyncMaxPerRun','translationQuota','translationUsed'].forEach(k=>d[k]=Number(d[k]||0));
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
  };
  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages["settings"] = true;
})();
