(function () {
  if (!window.app) throw new Error('app-core must load before pages/youtubeConfig.js');
  const __methods = {
    canManageYouTube() {
      if (!this.authEnabled) return true;
      if (this.authIsSuper || Number(this.authLoginUser?.roleId || this.authLoginUser?.role_id || 0) === 1) return true;
      if (typeof this.isLoginOpsAdminRole === 'function' && this.isLoginOpsAdminRole()) return true;
      return typeof this.canLoginPermission === 'function'
        ? this.canLoginPermission('system.youtube')
        : false;
    },
    async renderYoutubeConfig() {
      const host = document.querySelector('#content');
      if (!host) return;
      document.querySelector('#content')?.classList.remove('chat-mode');
      if (!this.canManageYouTube()) {
        host.innerHTML = `<div class="panel"><div class="empty">当前账号无权访问 YouTube 开发配置（需要权限节点：system.youtube）</div></div>`;
        return;
      }
      try {
        const pack = await this.api('/youtube/oauth-config');
        const st = pack.config || {};
        const configured = !!pack.configured;
        const callbackPath = pack.callbackPath || '/api/youtube/oauth/callback';
        const scopesDefault = Array.isArray(pack.defaultScopes) ? pack.defaultScopes.join(' ') : '';
        host.innerHTML = `
          <div class="panel list-panel">
            <div class="matrix-action-bar">
              <div class="left">
                <span class="muted">开发管理 · YouTube OAuth 客户端（全局一份，账号授权时复用）</span>
                ${configured
                  ? '<span class="badge online" style="margin-left:8px">已配置</span>'
                  : '<span class="badge offline" style="margin-left:8px">未完成配置</span>'}
              </div>
              <div class="right"><button class="ghost tiny" type="button" onclick="app.refresh()">刷新</button></div>
            </div>
            <form id="youtube-oauth-form" class="settings-form settings-form--full" style="width:100%;max-width:none;padding:8px 4px 24px;box-sizing:border-box">
              <div class="settings-card" style="border:none;box-shadow:none;padding:0;width:100%">
                ${this.formRow('Client ID', this.settingsInput('youtube.oauth.clientId', st['youtube.oauth.clientId'] || ''), 'Google Cloud OAuth 2.0 客户端 ID')}
                ${this.formRow('Client Secret', this.settingsInput('youtube.oauth.clientSecret', '', 'password'), '留空表示不修改已保存密钥；首次必填')}
                ${this.formRow('Redirect URI', this.settingsInput('youtube.oauth.redirectUri', st['youtube.oauth.redirectUri'] || ''), '须与 Google Console 一致，例如 https://你的API域名' + callbackPath)}
                ${this.formRow('Scopes', this.settingsInput('youtube.oauth.scopes', st['youtube.oauth.scopes'] || scopesDefault), '空格分隔；留空保存时用默认上传权限')}
                <div class="form-hint" style="margin:8px 0 16px">
                  配置写入系统表 <code>settings</code>（键名 youtube.oauth.*）。回调路径：<code>${this.esc(callbackPath)}</code>。
                  授权成功后会持久化 <code>refresh_token</code>，后续上传无需再登录浏览器。
                </div>
                <div class="action-bar" style="gap:8px;flex-wrap:wrap">
                  <button class="primary" type="submit">保存配置</button>
                  <button class="ghost" type="button" onclick="app.navigate('youtubeAccounts')">前往账号授权</button>
                </div>
              </div>
            </form>
          </div>`;
        document.querySelector('#youtube-oauth-form').onsubmit = async (e) => {
          e.preventDefault();
          if (!this.canManageYouTube()) { this.toast('无权保存', true); return; }
          const d = Object.fromEntries(new FormData(e.target));
          if (!d['youtube.oauth.clientSecret'] || d['youtube.oauth.clientSecret'] === '******') {
            delete d['youtube.oauth.clientSecret'];
          }
          try {
            await this.api('/youtube/oauth-config', { method: 'PUT', body: JSON.stringify(d) });
            this.toast('YouTube OAuth 配置已保存');
            this.refresh();
          } catch (err) { this.toast(err.message, true); }
        };
      } catch (err) {
        host.innerHTML = `<div class="panel"><div class="empty">加载失败：${this.esc(err.message || '')}</div></div>`;
      }
    },
  };
  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages.youtubeConfig = true;
})();
