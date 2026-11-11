(function () {
  if (!window.app) throw new Error('app-core must load before pages/youtubeAccounts.js');
  const __methods = {
    canManageYouTube() {
      if (!this.authEnabled) return true;
      if (this.authIsSuper || Number(this.authLoginUser?.roleId || this.authLoginUser?.role_id || 0) === 1) return true;
      if (typeof this.isLoginOpsAdminRole === 'function' && this.isLoginOpsAdminRole()) return true;
      return typeof this.canLoginPermission === 'function'
        ? this.canLoginPermission('system.youtube')
        : false;
    },
    youtubeAuthBadge(r) {
      if (r.authorized && r.tokenValid) return '<span class="badge online">已授权</span>';
      if (r.authorized) return '<span class="badge paused">需刷新</span>';
      if (String(r.status) === 'authorizing') return '<span class="badge checking">授权中</span>';
      if (String(r.status) === 'error') return '<span class="badge error">异常</span>';
      return '<span class="badge offline">未授权</span>';
    },
    youtubeAccountFormHtml(row = {}) {
      const v = (k) => this.esc(String(row[k] ?? ''));
      return `
        <div class="form-grid">
          <div class="field full"><label>备注名</label>
            <input class="input" name="username" value="${v('username')}" placeholder="便于识别，可空">
          </div>
          <div class="field full"><label>昵称</label>
            <input class="input" name="nickname" value="${v('nickname')}" placeholder="授权后可自动回填频道名">
          </div>
          <div class="field full"><label>备注</label>
            <input class="input" name="notes" value="${v('notes')}" placeholder="可选">
          </div>
        </div>`;
    },
    async renderYoutubeAccounts() {
      const host = document.querySelector('#content');
      if (!host) return;
      document.querySelector('#content')?.classList.remove('chat-mode');
      if (!this.canManageYouTube()) {
        host.innerHTML = `<div class="panel"><div class="empty">当前账号无权访问 YouTube 账号（需要权限节点：system.youtube）</div></div>`;
        return;
      }
      try {
        const kw = encodeURIComponent(this._ytAccKeyword || '');
        const pack = await this.api('/youtube/accounts' + (kw ? '?keyword=' + kw : ''));
        const items = Array.isArray(pack?.items) ? pack.items : [];
        this._ytAccItems = items;
        const oauthOk = !!pack?.oauthConfigured;
        const rows = items.map((r) => `
          <tr>
            <td>${r.id}</td>
            <td>${this.esc(r.username || '-')}</td>
            <td>${this.esc(r.nickname || r.channelTitle || '-')}</td>
            <td>${this.esc(r.channelId || '-')}<div class="muted" style="font-size:12px">${this.esc(r.channelCustomUrl || '')}</div></td>
            <td>${this.youtubeAuthBadge(r)}</td>
            <td>${this.esc(r.lastLoginAt || r.updatedAt || '-')}</td>
            <td class="muted" style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${this.esc(r.lastError || '')}">${this.esc(r.lastError || '-')}</td>
            <td style="white-space:nowrap">
              <button class="tiny" type="button" onclick="app.startYoutubeAuth(${r.id})">授权登录</button>
              ${r.authorized ? `<button class="tiny ghost" type="button" onclick="app.refreshYoutubeToken(${r.id})">刷新 Token</button>` : ''}
              <button class="tiny ghost is-danger" type="button" onclick="app.deleteYoutubeAccount(${r.id})">删除</button>
            </td>
          </tr>`).join('');
        host.innerHTML = `
          <div class="panel list-panel">
            <div class="matrix-action-bar">
              <div class="left">
                <span class="muted">开发管理 · YouTube 账号（OAuth 离线授权，持久化 refresh_token）</span>
                ${oauthOk
                  ? '<span class="badge online" style="margin-left:8px">OAuth 已配</span>'
                  : '<span class="badge offline" style="margin-left:8px">请先配置 OAuth</span>'}
              </div>
              <div class="right" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                <input class="input tiny" style="width:160px" id="yt-acc-kw" value="${this.esc(this._ytAccKeyword || '')}" placeholder="搜索" onkeydown="if(event.key==='Enter'){app._ytAccKeyword=this.value;app.refresh()}">
                <button class="primary tiny" type="button" onclick="app.addYoutubeAccount()" ${oauthOk ? '' : 'disabled'}>+ 添加账号</button>
                <button class="ghost tiny" type="button" onclick="app.navigate('youtubeConfig')">OAuth 配置</button>
                <button class="ghost tiny" type="button" onclick="app.refresh()">刷新</button>
              </div>
            </div>
            <table class="ai-lead-table">
              <thead><tr>
                <th>ID</th><th>备注名</th><th>频道</th><th>Channel ID</th><th>授权</th><th>最近</th><th>错误</th><th>操作</th>
              </tr></thead>
              <tbody>${rows || '<tr><td colspan="8" class="empty">暂无账号，请先配置 OAuth 后添加并授权</td></tr>'}</tbody>
            </table>
          </div>`;
      } catch (err) {
        host.innerHTML = `<div class="panel"><div class="empty">加载失败：${this.esc(err.message || '')}</div></div>`;
      }
    },
    addYoutubeAccount() {
      if (!this.canManageYouTube()) { this.toast('无权操作', true); return; }
      this.modal('添加 YouTube 账号', this.youtubeAccountFormHtml(), async (data) => {
        await this.api('/youtube/accounts', { method: 'POST', body: JSON.stringify(data) });
        this.closeModal();
        this.toast('已添加，请点击「授权登录」');
        this.refresh();
      });
    },
    async startYoutubeAuth(id) {
      if (!this.canManageYouTube()) { this.toast('无权操作', true); return; }
      try {
        const pack = await this.api('/youtube/accounts/' + id + '/auth', { method: 'POST', body: '{}' });
        const url = pack?.authUrl || '';
        if (!url) { this.toast('未返回授权链接', true); return; }
        window.open(url, '_blank', 'noopener,noreferrer');
        this.toast('已打开 Google 授权页，完成后请刷新本列表');
        this.refresh();
      } catch (e) { this.toast(e.message, true); }
    },
    async refreshYoutubeToken(id) {
      try {
        await this.api('/youtube/accounts/' + id + '/refresh-token', { method: 'POST', body: '{}' });
        this.toast('已刷新 Token / 频道信息');
        this.refresh();
      } catch (e) { this.toast(e.message, true); }
    },
    async deleteYoutubeAccount(id) {
      if (!confirm('确认删除 YouTube 账号 #' + id + '？')) return;
      try {
        await this.api('/youtube/accounts/' + id, { method: 'DELETE' });
        this.toast('已删除');
        this.refresh();
      } catch (e) { this.toast(e.message, true); }
    },
  };
  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages.youtubeAccounts = true;
})();
