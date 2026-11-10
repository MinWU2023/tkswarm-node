(function () {
  if (!window.app) throw new Error('app-core must load before pages/smtpConfig.js');
  const __methods = {
    canManageSmtpConfig(){
      if(!this.authEnabled)return true;
      // 仅登录超管（不受身份切换影响）
      return !!this.authIsSuper || Number(this.authLoginUser?.roleId||this.authLoginUser?.role_id||0)===1;
    },
    async renderSmtpConfig(){
      const host=document.querySelector('#content');
      if(!host)return;
      document.querySelector('#content')?.classList.remove('chat-mode');
      if(!this.canManageSmtpConfig()){
        host.innerHTML=`<div class="panel"><div class="empty">仅超级管理员可访问 SMTP 配置</div></div>`;
        return;
      }
      try{
        const pack=await this.api('/smtp-config');
        const st=pack.config||{};
        const configured=!!pack.configured;
        host.innerHTML=`
          <div class="panel list-panel">
            <div class="matrix-action-bar">
              <div class="left">
                <span class="muted">开发管理 · 系统发信 SMTP（拉取数据分析报告等）</span>
                ${configured
                  ? '<span class="badge online" style="margin-left:8px">已配置</span>'
                  : '<span class="badge offline" style="margin-left:8px">未完成配置</span>'}
              </div>
              <div class="right"><button class="ghost tiny" type="button" onclick="app.refresh()">刷新</button></div>
            </div>
            <form id="smtp-config-form" class="settings-form settings-form--full" style="width:100%;max-width:none;padding:8px 4px 24px;box-sizing:border-box">
              <div class="settings-card" style="border:none;box-shadow:none;padding:0;width:100%">
                ${this.formRow('SMTP Host',this.settingsInput('smtp.host',st['smtp.host']||''),'如 smtp.exmail.qq.com / smtp.qq.com')}
                ${this.formRow('端口',this.settingsInput('smtp.port',st['smtp.port']||'465'),'SSL 常用 465，STARTTLS 常用 587')}
                ${this.formRow('加密',this.settingsSelect('smtp.encryption',[['ssl','SSL'],['tls','STARTTLS'],['none','无']],st['smtp.encryption']||'ssl'))}
                ${this.formRow('用户名',this.settingsInput('smtp.username',st['smtp.username']||''),'通常为发件邮箱')}
                ${this.formRow('密码 / 授权码',this.settingsInput('smtp.password','','password'),'留空表示不修改已保存密码')}
                ${this.formRow('发件邮箱',this.settingsInput('smtp.from_email',st['smtp.from_email']||''))}
                ${this.formRow('发件人名称',this.settingsInput('smtp.from_name',st['smtp.from_name']||'TkSwarm'))}
                <div class="form-hint" style="margin:8px 0 16px">配置写入系统表 <code>settings</code>（键名 smtp.*），与计划任务发信共用。命令：<code>php artisan plan-task:pull-analysis</code></div>
                <div class="action-bar" style="gap:8px;flex-wrap:wrap">
                  <button class="primary" type="submit">保存配置</button>
                  <button class="ghost" type="button" onclick="app.testSmtpConfig()">发送测试邮件</button>
                </div>
              </div>
            </form>
          </div>`;
        document.querySelector('#smtp-config-form').onsubmit=async (e)=>{
          e.preventDefault();
          if(!this.canManageSmtpConfig()){this.toast('仅超级管理员可保存',true);return}
          const d=Object.fromEntries(new FormData(e.target));
          if(!d['smtp.password']||d['smtp.password']==='******')delete d['smtp.password'];
          try{
            await this.api('/smtp-config',{method:'PUT',body:JSON.stringify(d)});
            this.toast('SMTP 配置已保存');
            this.refresh();
          }catch(err){this.toast(err.message,true)}
        };
      }catch(err){
        host.innerHTML=`<div class="panel"><div class="empty">加载 SMTP 配置失败：${this.esc(err.message||'')}</div></div>`;
      }
    },
    async testSmtpConfig(){
      if(!this.canManageSmtpConfig()){this.toast('仅超级管理员可测试',true);return}
      const to=prompt('测试收件邮箱（留空则尝试当前超管通知邮箱）','')||'';
      try{
        const r=await this.api('/smtp-config/test',{method:'POST',body:JSON.stringify({to:to.trim()})});
        this.toast(r?.message||'测试邮件已发送');
      }catch(e){this.toast(e.message,true)}
    },
  };
  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages.smtpConfig = true;
})();
