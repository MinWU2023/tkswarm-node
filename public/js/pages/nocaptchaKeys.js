(function () {
  if (!window.app) throw new Error('app-core must load before pages/nocaptchaKeys.js');
  const REGISTER_URL = 'https://nocaptchaai.com/';
  const TEMP_MAIL_URL = 'https://10minutemail.one/zh#google_vignette';
  const DEFAULT_DAILY_LIMIT = 200;
  const DEFAULT_VALID_DAYS = 30;
  const __methods = {
    canManageNocaptchaKeys(){
      if(!this.authEnabled)return true;
      return typeof this.canLoginPermission==='function'
        ? this.canLoginPermission('system.nocaptcha')
        : (!!this.authIsSuper || Number(this.authLoginUser?.roleId||this.authLoginUser?.role_id||0)===1);
    },
    nocaptchaTutorialHtml(){
      return `
        <div class="settings-card" style="margin:0 0 12px;padding:12px 16px">
          <strong>旋转验证识别说明（已默认启用本地 Canvas 极坐标像素匹配 · 零成本免 Key）</strong>
          <ol style="margin:8px 0 0 18px;line-height:1.9">
            <li><b>本地自研极坐标匹配（默认首选，免费无限次、毫秒级）</b>：自研浏览器与服务器浏览器内置全部任务已默认启用本地 Canvas 同心圆交界像素匹配 + 动态滑轨角度标定，无需配置任何第三方 Key 即可自动过旋转验证码。</li>
            <li><b>备用第三方密钥池（可选兜底）</b>：如需启用 NoCaptchaAI 作为极端情况下的备用兜底（环境变量 <code>TKSWARM_ENABLE_NOCAPTCHAAI_FALLBACK=1</code>），可在下方维护密钥池。</li>
            <li>打开临时邮箱页面获取一个临时邮箱：<a href="${TEMP_MAIL_URL}" target="_blank" rel="noopener noreferrer">${TEMP_MAIL_URL}</a>，前往 <a href="${REGISTER_URL}" target="_blank" rel="noopener noreferrer">${REGISTER_URL}</a> 注册。</li>
            <li><b>日限 ${DEFAULT_DAILY_LIMIT} 自动轮换 & 30 天报废</b>：每个免费账号每天允许使用 ${DEFAULT_DAILY_LIMIT} 次；计划任务 <code>nocaptcha:daily-reset</code> 每日零点自动重置未到期账号额度，超过 ${DEFAULT_VALID_DAYS} 天的账号自动标记「已报废」且不可再启用。</li>
          </ol>
        </div>`;
    },
    nocaptchaFormHtml(row={}){
      const v=(k)=>this.esc(String(row[k]??''));
      const scrapped=Number(row.isScrapped)===1;
      const quotaLimit=Number(row.quotaLimit||DEFAULT_DAILY_LIMIT);
      const validDays=Number(row.validDays||DEFAULT_VALID_DAYS);
      return `
        <div class="form-grid">
          <div class="field full"><label>邮箱</label><input class="input" name="email" type="text" value="${v('email')}" placeholder="注册邮箱"></div>
          <div class="field full"><label>账号</label><input class="input" name="username" value="${v('username')}" placeholder="账号"></div>
          <div class="field full"><label>密码</label><input class="input" name="password" value="${v('password')}" placeholder="密码"></div>
          <div class="field full"><label>密钥 *</label><input class="input" name="apiKey" value="${v('apiKey')}" placeholder="nocap_..." required></div>
          <div class="field full"><label>启用状态</label>
            <select class="input" name="status" ${scrapped?'disabled':''}>
              ${scrapped?'':`<option value="1"${Number(row.status)===1?' selected':''}>启用</option>`}
              <option value="0"${scrapped||Number(row.status)!==1?' selected':''}>不启用</option>
            </select>
            <div class="form-hint">${scrapped?'该账号已报废，不可再启用。':'选择「启用」会自动关闭其他已启用的密钥。'}</div>
          </div>
          <div class="field full"><label>今日额度状态</label>
            <select class="input" name="isExhausted" ${scrapped?'disabled':''}>
              <option value="0"${Number(row.isExhausted)===1?'':' selected'}>今日可用（未满）</option>
              <option value="1"${Number(row.isExhausted)===1?' selected':''}>今日已满（切下一个账号）</option>
            </select>
            <div class="form-hint">新添加默认「今日可用」；达到每日上限后次日由计划任务自动重置。</div>
          </div>
          <div class="field"><label>今日已用次数</label><input class="input" name="usedCount" type="number" min="0" value="${Number(row.usedCount||0)}" ${scrapped?'disabled':''}></div>
          <div class="field"><label>每日额度上限</label><input class="input" name="quotaLimit" type="number" min="1" value="${quotaLimit}" ${scrapped?'disabled':''}></div>
          <div class="field full"><label>免费支持天数（超期自动报废）</label><input class="input" name="validDays" type="number" min="1" value="${validDays}" ${scrapped?'disabled':''}></div>
        </div>`;
    },
    nocaptchaStatusBadge(r){
      if(Number(r.isScrapped)===1){
        return '<span class="badge error">已报废</span>';
      }
      if(Number(r.isExhausted)===1){
        return '<span class="badge paused">今日已满</span>';
      }
      return '<span class="badge online">今日可用</span>';
    },
    nocaptchaValidityCell(r){
      const validDays=Number(r.validDays||DEFAULT_VALID_DAYS);
      const expDate=String(r.expiresAt||'').slice(0,10)||'-';
      if(Number(r.isScrapped)===1){
        return `<span class="muted">超${validDays}天已报废</span><div class="muted" style="font-size:12px">到期 ${this.esc(expDate)}</div>`;
      }
      const remDays=Number(r.remainingDays??validDays);
      return `剩余 <b>${remDays}</b> / ${validDays} 天<div class="muted" style="font-size:12px">到期 ${this.esc(expDate)}</div>`;
    },
    async renderNocaptchaKeys(){
      const host=document.querySelector('#content');
      if(!host)return;
      document.querySelector('#content')?.classList.remove('chat-mode');
      if(!this.canManageNocaptchaKeys()){
        host.innerHTML=`<div class="panel"><div class="empty">当前账号无权访问 NoCaptchaAI 密钥（需要权限节点：system.nocaptcha）</div></div>`;
        return;
      }
      try{
        const pack=await this.api('/nocaptcha-keys');
        const items=Array.isArray(pack?.items)?pack.items:[];
        this._nocaptchaItems=items;
        const rows=items.map(r=>{
          const scrapped=Number(r.isScrapped)===1;
          const exhausted=Number(r.isExhausted)===1;
          const enabled=Number(r.status)===1 && !scrapped;
          const used=Number(r.usedCount||0);
          const limit=Number(r.quotaLimit||DEFAULT_DAILY_LIMIT);
          const rem=scrapped?0:Number(r.remainingCount??Math.max(0,limit-used));
          const totalUsed=Number(r.totalUsedCount??used);
          const opsHtml=scrapped
            ? `<span class="muted" style="font-size:12px;margin-right:6px">不可再启用</span>
               <button class="tiny ghost is-danger" type="button" onclick="app.deleteNocaptchaKey(${r.id})">删除</button>`
            : `${enabled
                ? `<button class="tiny ghost" type="button" onclick="app.disableNocaptchaKey(${r.id})">停用</button>`
                : (exhausted
                  ? ''
                  : `<button class="tiny" type="button" onclick="app.enableNocaptchaKey(${r.id})">启用</button>`)}
               ${exhausted
                ? `<button class="tiny ghost" type="button" onclick="app.markNocaptchaAvailable(${r.id})">重置今日</button>`
                : `<button class="tiny ghost" type="button" onclick="app.markNocaptchaExhausted(${r.id})">标记今日满</button>`}
               <button class="tiny ghost" type="button" onclick="app.editNocaptchaKey(${r.id})">编辑</button>
               <button class="tiny ghost is-danger" type="button" onclick="app.scrapNocaptchaKey(${r.id})">报废</button>
               <button class="tiny ghost is-danger" type="button" onclick="app.deleteNocaptchaKey(${r.id})">删除</button>`;
          return `
          <tr>
            <td>${r.id}</td>
            <td>${this.esc(r.email)}</td>
            <td>${this.esc(r.username)}</td>
            <td><span class="nc-secret" data-secret="${this.esc(r.password)}">••••••</span></td>
            <td><span class="nc-secret" data-secret="${this.esc(r.apiKey)}">••••••</span></td>
            <td>${enabled
              ? '<span class="badge online">启用</span>'
              : '<span class="badge offline">不启用</span>'}</td>
            <td>${this.nocaptchaStatusBadge(r)}</td>
            <td>${used} / ${limit}<div class="muted" style="font-size:12px">今日剩 ${rem} · 累计 ${totalUsed}</div></td>
            <td>${this.nocaptchaValidityCell(r)}</td>
            <td>${this.esc(r.updatedAt||'')}</td>
            <td style="white-space:nowrap">${opsHtml}</td>
          </tr>`;
        }).join('');
        host.innerHTML=`
          <div class="panel list-panel">
            <div class="matrix-action-bar">
              <div class="left"><span class="muted">开发管理 · NoCaptchaAI 密钥（日限 ${DEFAULT_DAILY_LIMIT} 自动切号 · 次日计划任务重置 · 超 ${DEFAULT_VALID_DAYS} 天报废）</span></div>
              <div class="right" style="display:flex;gap:8px;flex-wrap:wrap">
                <button class="primary tiny" type="button" onclick="app.addNocaptchaKey()">+ 添加</button>
                <button class="ghost tiny" type="button" onclick="app.runNocaptchaDailyReset()">次日重置/报废检测</button>
                <button class="ghost tiny" type="button" id="nc-toggle-secret" onclick="app.toggleNocaptchaSecrets()">显示密码/密钥</button>
                <button class="ghost tiny" type="button" onclick="app.refresh()">刷新</button>
              </div>
            </div>
            ${this.nocaptchaTutorialHtml()}
            <table class="ai-lead-table">
              <thead><tr><th>ID</th><th>邮箱</th><th>账号</th><th>密码</th><th>密钥</th><th>状态</th><th>额度状态</th><th>今日用量</th><th>30天有效期</th><th>更新时间</th><th>操作</th></tr></thead>
              <tbody>${rows||'<tr><td colspan="11" class="empty">暂无数据，点击右上角「添加」</td></tr>'}</tbody>
            </table>
          </div>`;
        this._nocaptchaShown=false;
      }catch(err){
        host.innerHTML=`<div class="panel"><div class="empty">加载失败：${this.esc(err.message||'')}</div></div>`;
      }
    },
    toggleNocaptchaSecrets(){
      this._nocaptchaShown=!this._nocaptchaShown;
      document.querySelectorAll('.nc-secret').forEach(el=>{
        el.textContent=this._nocaptchaShown?(el.dataset.secret||''):'••••••';
      });
      const btn=document.querySelector('#nc-toggle-secret');
      if(btn)btn.textContent=this._nocaptchaShown?'隐藏密码/密钥':'显示密码/密钥';
    },
    addNocaptchaKey(){
      const hasActive=(this._nocaptchaItems||[]).some(r=>Number(r.status)===1 && !Number(r.isScrapped) && !Number(r.isExhausted));
      this.modal('添加 NoCaptchaAI 密钥',this.nocaptchaFormHtml({
        status:hasActive?0:1,
        isExhausted:0,
        usedCount:0,
        quotaLimit:DEFAULT_DAILY_LIMIT,
        validDays:DEFAULT_VALID_DAYS,
      }),async(data)=>{
        await this.api('/nocaptcha-keys',{method:'POST',body:JSON.stringify(data)});
        this.closeModal();
        this.toast('已添加');
        this.refresh();
      });
    },
    editNocaptchaKey(id){
      const row=(this._nocaptchaItems||[]).find(r=>Number(r.id)===Number(id));
      if(!row)return;
      if(Number(row.isScrapped)===1){
        this.toast('已报废密钥不可编辑或再次启用',true);
        return;
      }
      this.modal('编辑 NoCaptchaAI 密钥',this.nocaptchaFormHtml(row),async(data)=>{
        await this.api('/nocaptcha-keys/'+id,{method:'PUT',body:JSON.stringify(data)});
        this.closeModal();
        this.toast('已保存');
        this.refresh();
      });
    },
    async enableNocaptchaKey(id){
      try{
        await this.api('/nocaptcha-keys/'+id+'/enable',{method:'POST',body:'{}'});
        this.toast('已启用，其他密钥已关闭');
        this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    async markNocaptchaExhausted(id){
      if(!confirm('确认将该账号标记为今日额度已满？系统将自动启用下一个可用账号，次日计划任务会自动重置。'))return;
      try{
        const res=await this.api('/nocaptcha-keys/'+id+'/mark-exhausted',{method:'POST',body:'{}'});
        this.toast(res?.switchedTo?'已标记今日已满，已自动切换账号':'已标记今日已满（暂无其他可用账号）');
        this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    async markNocaptchaAvailable(id){
      try{
        await this.api('/nocaptcha-keys/'+id+'/mark-available',{method:'POST',body:JSON.stringify({resetUsage:true})});
        this.toast('已重置今日可用状态');
        this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    async scrapNocaptchaKey(id){
      if(!confirm('确认将该账号永久标记报废？报废后将不可再启用，并自动切换到其他可用账号。'))return;
      try{
        const res=await this.api('/nocaptcha-keys/'+id+'/scrap',{method:'POST',body:'{}'});
        this.toast(res?.switchedTo?'已标记报废，已自动切换账号':'已标记报废（不可再启用）');
        this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    async runNocaptchaDailyReset(){
      if(!confirm('立即执行「每日额度重置 + 超30天自动报废检测」？未满30天的账号今日已用次数将归零。'))return;
      try{
        const res=await this.api('/nocaptcha-keys/daily-reset',{method:'POST',body:'{}'});
        this.toast(`重置 ${Number(res?.resetCount||0)} 个账号，报废 ${Number(res?.scrappedCount||0)} 个超期账号`);
        this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    async disableNocaptchaKey(id){
      try{
        await this.api('/nocaptcha-keys/'+id+'/disable',{method:'POST',body:'{}'});
        this.toast('已停用');
        this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
    async deleteNocaptchaKey(id){
      if(!confirm('确认删除该密钥？'))return;
      try{
        await this.api('/nocaptcha-keys/'+id,{method:'DELETE'});
        this.toast('已删除');
        this.refresh();
      }catch(e){this.toast(e.message,true)}
    },
  };
  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages.nocaptchaKeys = true;
})();
