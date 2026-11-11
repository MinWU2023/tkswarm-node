(function () {
  if (!window.app) throw new Error('app-core must load before pages/youtubeSync.js');
  const __methods = {
    canManageYouTube() {
      if (!this.authEnabled) return true;
      if (this.authIsSuper || Number(this.authLoginUser?.roleId || this.authLoginUser?.role_id || 0) === 1) return true;
      if (typeof this.isLoginOpsAdminRole === 'function' && this.isLoginOpsAdminRole()) return true;
      return typeof this.canLoginPermission === 'function'
        ? this.canLoginPermission('system.youtube')
        : false;
    },
    ytFmtSize(n) {
      const b = Number(n) || 0;
      if (b < 1024) return b + ' B';
      if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
      return (b / 1048576).toFixed(1) + ' MB';
    },
    ytTaskBadge(st) {
      const s = String(st || '');
      if (s === 'completed') return '<span class="badge online">完成</span>';
      if (s === 'running') return '<span class="badge checking">上传中</span>';
      if (s === 'failed' || s === 'error') return '<span class="badge error">失败</span>';
      if (s === 'pending' || s === 'draft') return '<span class="badge paused">待执行</span>';
      return `<span class="badge">${this.esc(s || '-')}</span>`;
    },
    async renderYoutubeSync() {
      const host = document.querySelector('#content');
      if (!host) return;
      document.querySelector('#content')?.classList.remove('chat-mode');
      if (!this.canManageYouTube()) {
        host.innerHTML = `<div class="panel"><div class="empty">当前账号无权访问 YouTube 同步发布（需要权限节点：system.youtube）</div></div>`;
        return;
      }
      const matPage = Math.max(1, Number(this._ytSyncMatPage || 1));
      const taskPage = Math.max(1, Number(this._ytSyncTaskPage || 1));
      const matKw = String(this._ytSyncMatKeyword || '');
      const selectedMats = new Set((this._ytSyncSelectedMats || []).map(Number));
      const selectedAccs = new Set((this._ytSyncSelectedAccs || []).map(Number));
      try {
        const [matPack, accPack, taskPack] = await Promise.all([
          this.api('/youtube/sync/materials?page=' + matPage + '&pageSize=20&keyword=' + encodeURIComponent(matKw)),
          this.api('/youtube/accounts'),
          this.api('/youtube/publish-tasks?page=' + taskPage + '&pageSize=20'),
        ]);
        const materials = Array.isArray(matPack?.items) ? matPack.items : [];
        const accounts = Array.isArray(accPack?.items) ? accPack.items : [];
        const tasks = Array.isArray(taskPack?.items) ? taskPack.items : [];
        this._ytSyncMaterials = materials;
        this._ytSyncAccounts = accounts;
        const privacy = this._ytSyncPrivacy || 'unlisted';
        const runNow = this._ytSyncRunNow !== false;
        const force = !!this._ytSyncForce;

        const matRows = materials.map((m) => {
          const ok = m.hasCdn || m.hasLocalFile;
          const checked = selectedMats.has(Number(m.id)) ? ' checked' : '';
          return `<tr>
            <td><input type="checkbox" data-yt-mat="${m.id}"${checked}${ok ? '' : ' disabled'}></td>
            <td>${m.id}</td>
            <td>${this.esc(m.title || m.name || '-')}<div class="muted" style="font-size:12px">${this.esc(m.fileName || '')}</div></td>
            <td>${m.hasCdn ? '<span class="badge online">CDN</span>' : ''}${m.hasLocalFile ? ' <span class="badge">本地</span>' : ''}${ok ? '' : ' <span class="badge offline">无文件</span>'}</td>
            <td>${this.ytFmtSize(m.sizeBytes)}</td>
            <td class="muted">${this.esc(String(m.createdAt || '').slice(0, 16))}</td>
          </tr>`;
        }).join('');

        const accRows = accounts.map((a) => {
          const ok = !!a.authorized;
          const checked = selectedAccs.has(Number(a.id)) ? ' checked' : '';
          return `<label style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border, #e2e8f0)">
            <input type="checkbox" data-yt-acc="${a.id}"${checked}${ok ? '' : ' disabled'}>
            <span>#${a.id} ${this.esc(a.channelTitle || a.nickname || a.username || '未命名')}</span>
            ${ok ? '<span class="badge online">已授权</span>' : '<span class="badge offline">未授权</span>'}
          </label>`;
        }).join('');

        const taskRows = tasks.map((t) => `
          <tr>
            <td>${t.id}</td>
            <td>${this.esc(t.title || t.name || '-')}</td>
            <td>#${t.accountId} ${this.esc(t.channelTitle || '')}</td>
            <td>素材 #${t.materialId || '-'}</td>
            <td>${this.ytTaskBadge(t.status)} <span class="muted">${Number(t.progressPercent || 0)}%</span></td>
            <td>${t.youtubeVideoId
              ? `<a href="https://www.youtube.com/watch?v=${this.esc(t.youtubeVideoId)}" target="_blank" rel="noopener">${this.esc(t.youtubeVideoId)}</a>`
              : '<span class="muted">-</span>'}</td>
            <td class="muted" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${this.esc(t.errorMessage || '')}">${this.esc(t.errorMessage || '-')}</td>
            <td style="white-space:nowrap">
              ${t.status !== 'completed' && t.status !== 'running'
                ? `<button class="tiny ghost" type="button" onclick="app.runYoutubePublishTask(${t.id})">重试</button>`
                : ''}
            </td>
          </tr>`).join('');

        host.innerHTML = `
          <div class="panel list-panel">
            <div class="matrix-action-bar">
              <div class="left"><span class="muted">开发管理 · TikTok 已发布素材 → 多 YouTube 账号同步上传</span></div>
              <div class="right" style="display:flex;gap:8px;flex-wrap:wrap">
                <button class="ghost tiny" type="button" onclick="app.navigate('youtubeAccounts')">账号管理</button>
                <button class="ghost tiny" type="button" onclick="app.refresh()">刷新</button>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:minmax(0,1.4fr) minmax(260px,0.8fr);gap:16px;padding:8px 4px 16px">
              <div>
                <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
                  <strong>选择素材</strong>
                  <input class="input tiny" style="width:180px" id="yt-sync-mat-kw" value="${this.esc(matKw)}" placeholder="搜索素材"
                    onkeydown="if(event.key==='Enter'){app._ytSyncMatKeyword=this.value;app._ytSyncMatPage=1;app.ytSyncRememberSelection();app.refresh()}">
                  <button class="ghost tiny" type="button" onclick="app._ytSyncMatPage=Math.max(1,(app._ytSyncMatPage||1)-1);app.ytSyncRememberSelection();app.refresh()">上一页</button>
                  <span class="muted">${matPage}/${Math.max(1, Number(matPack?.pages || 1))} · 共 ${Number(matPack?.total || 0)}</span>
                  <button class="ghost tiny" type="button" onclick="app._ytSyncMatPage=(app._ytSyncMatPage||1)+1;app.ytSyncRememberSelection();app.refresh()">下一页</button>
                </div>
                <table class="ai-lead-table">
                  <thead><tr><th></th><th>ID</th><th>标题</th><th>来源</th><th>大小</th><th>时间</th></tr></thead>
                  <tbody>${matRows || '<tr><td colspan="6" class="empty">暂无已发布素材</td></tr>'}</tbody>
                </table>
              </div>
              <div>
                <strong>YouTube 账号</strong>
                <div style="margin:8px 0 12px;max-height:280px;overflow:auto">${accRows || '<div class="empty">暂无已授权账号</div>'}</div>
                <div class="form-grid" style="margin-bottom:12px">
                  <div class="field full"><label>可见性</label>
                    <select class="input" id="yt-sync-privacy">
                      <option value="unlisted"${privacy === 'unlisted' ? ' selected' : ''}>不公开列出</option>
                      <option value="private"${privacy === 'private' ? ' selected' : ''}>私有</option>
                      <option value="public"${privacy === 'public' ? ' selected' : ''}>公开</option>
                    </select>
                  </div>
                  <div class="field full">
                    <label><input type="checkbox" id="yt-sync-run-now"${runNow ? ' checked' : ''}> 入队后立即上传</label>
                  </div>
                  <div class="field full">
                    <label><input type="checkbox" id="yt-sync-force"${force ? ' checked' : ''}> 强制重传（忽略已完成/进行中去重）</label>
                  </div>
                </div>
                <button class="primary" type="button" onclick="app.enqueueYoutubeSync()">开始同步</button>
              </div>
            </div>
            <div style="padding:0 4px 16px">
              <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
                <strong>发布任务</strong>
                <button class="ghost tiny" type="button" onclick="app._ytSyncTaskPage=Math.max(1,(app._ytSyncTaskPage||1)-1);app.ytSyncRememberSelection();app.refresh()">上一页</button>
                <span class="muted">${taskPage}/${Math.max(1, Number(taskPack?.pages || 1))} · 共 ${Number(taskPack?.total || 0)}</span>
                <button class="ghost tiny" type="button" onclick="app._ytSyncTaskPage=(app._ytSyncTaskPage||1)+1;app.ytSyncRememberSelection();app.refresh()">下一页</button>
              </div>
              <table class="ai-lead-table">
                <thead><tr><th>ID</th><th>标题</th><th>账号</th><th>素材</th><th>状态</th><th>YouTube</th><th>错误</th><th></th></tr></thead>
                <tbody>${taskRows || '<tr><td colspan="8" class="empty">暂无任务</td></tr>'}</tbody>
              </table>
            </div>
          </div>`;
      } catch (err) {
        host.innerHTML = `<div class="panel"><div class="empty">加载失败：${this.esc(err.message || '')}</div></div>`;
      }
    },
    ytSyncRememberSelection() {
      const mats = [...document.querySelectorAll('[data-yt-mat]:checked')].map((el) => Number(el.getAttribute('data-yt-mat')));
      const accs = [...document.querySelectorAll('[data-yt-acc]:checked')].map((el) => Number(el.getAttribute('data-yt-acc')));
      this._ytSyncSelectedMats = mats;
      this._ytSyncSelectedAccs = accs;
      const priv = document.querySelector('#yt-sync-privacy');
      if (priv) this._ytSyncPrivacy = priv.value;
      const run = document.querySelector('#yt-sync-run-now');
      if (run) this._ytSyncRunNow = !!run.checked;
      const force = document.querySelector('#yt-sync-force');
      if (force) this._ytSyncForce = !!force.checked;
      const kw = document.querySelector('#yt-sync-mat-kw');
      if (kw) this._ytSyncMatKeyword = kw.value;
    },
    async enqueueYoutubeSync() {
      if (!this.canManageYouTube()) { this.toast('无权操作', true); return; }
      this.ytSyncRememberSelection();
      const materialIds = this._ytSyncSelectedMats || [];
      const youtubeAccountIds = this._ytSyncSelectedAccs || [];
      if (!materialIds.length || !youtubeAccountIds.length) {
        this.toast('请至少选择一个素材和一个已授权账号', true);
        return;
      }
      try {
        const pack = await this.api('/youtube/sync', {
          method: 'POST',
          body: JSON.stringify({
            materialIds,
            youtubeAccountIds,
            privacyStatus: this._ytSyncPrivacy || 'unlisted',
            runNow: this._ytSyncRunNow !== false,
            force: !!this._ytSyncForce,
          }),
          timeoutMs: 600000,
        });
        const msg = `创建 ${pack?.createdCount || 0} · 跳过 ${pack?.skippedCount || 0} · 失败 ${pack?.errorCount || 0}`;
        this.toast(msg, (pack?.errorCount || 0) > 0 ? 'warn' : false);
        this._ytSyncTaskPage = 1;
        this.refresh();
      } catch (e) { this.toast(e.message, true); }
    },
    async runYoutubePublishTask(id) {
      if (!confirm('重新执行上传任务 #' + id + '？')) return;
      try {
        await this.api('/youtube/publish-tasks/' + id + '/run', { method: 'POST', body: '{}', timeoutMs: 600000 });
        this.toast('上传完成');
        this.refresh();
      } catch (e) { this.toast(e.message, true); }
    },
  };
  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages.youtubeSync = true;
})();
