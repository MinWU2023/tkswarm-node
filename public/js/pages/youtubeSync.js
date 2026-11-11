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
      if (s === 'completed') return '<span class="yt-badge yt-badge--ok">完成</span>';
      if (s === 'running') return '<span class="yt-badge yt-badge--run">上传中</span>';
      if (s === 'failed' || s === 'error') return '<span class="yt-badge yt-badge--err">失败</span>';
      if (s === 'pending' || s === 'draft') return '<span class="yt-badge yt-badge--wait">待执行</span>';
      return `<span class="yt-badge">${this.esc(s || '-')}</span>`;
    },
    ytSourceBadges(m) {
      const parts = [];
      if (m.hasCdn) parts.push('<span class="yt-chip yt-chip--cdn">CDN</span>');
      if (m.hasLocalFile) parts.push('<span class="yt-chip yt-chip--local">本地</span>');
      if (!m.hasCdn && !m.hasLocalFile) parts.push('<span class="yt-chip yt-chip--miss">无文件</span>');
      return parts.join('');
    },
    async renderYoutubeSync() {
      const host = document.querySelector('#content');
      if (!host) return;
      document.querySelector('#content')?.classList.remove('chat-mode');
      if (!this.canManageYouTube()) {
        host.innerHTML = `<div class="panel"><div class="empty">当前账号无权访问 Youtube发布（需要权限节点：system.youtube）</div></div>`;
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
        const matPages = Math.max(1, Number(matPack?.pages || 1));
        const taskPages = Math.max(1, Number(taskPack?.pages || 1));
        const selMatCount = selectedMats.size;
        const selAccCount = [...selectedAccs].filter((id) => {
          const a = accounts.find((x) => Number(x.id) === Number(id));
          return a && a.authorized;
        }).length;

        const matRows = materials.map((m) => {
          const ok = m.hasCdn || m.hasLocalFile;
          const checked = selectedMats.has(Number(m.id)) ? ' checked' : '';
          return `<tr class="${ok ? '' : 'is-disabled'}">
            <td class="yt-col-check"><input type="checkbox" data-yt-mat="${m.id}"${checked}${ok ? '' : ' disabled'}></td>
            <td class="yt-col-id">${m.id}</td>
            <td>
              <div class="yt-cell-title">${this.esc(m.title || m.name || '-')}</div>
              <div class="yt-cell-sub">${this.esc(m.fileName || '')}</div>
            </td>
            <td class="yt-col-src">${this.ytSourceBadges(m)}</td>
            <td class="yt-col-num">${this.ytFmtSize(m.sizeBytes)}</td>
            <td class="yt-col-time">${this.esc(String(m.createdAt || '').slice(0, 16))}</td>
          </tr>`;
        }).join('');

        const authAccounts = accounts.filter((a) => a.authorized);
        const otherAccounts = accounts.filter((a) => !a.authorized);
        const renderAcc = (a) => {
          const ok = !!a.authorized;
          const checked = selectedAccs.has(Number(a.id)) ? ' checked' : '';
          const label = a.channelTitle || a.nickname || a.username || '未命名';
          return `<label class="yt-acc-item ${ok ? '' : 'is-disabled'}">
            <input type="checkbox" data-yt-acc="${a.id}"${checked}${ok ? '' : ' disabled'}>
            <span class="yt-acc-item__body">
              <span class="yt-acc-item__name">${this.esc(label)}</span>
              <span class="yt-acc-item__meta">#${a.id}${a.channelId ? ' · ' + this.esc(a.channelId) : ''}</span>
            </span>
            ${ok ? '<span class="yt-chip yt-chip--cdn">已授权</span>' : '<span class="yt-chip yt-chip--miss">未授权</span>'}
          </label>`;
        };
        const accRows = [
          ...authAccounts.map(renderAcc),
          ...otherAccounts.map(renderAcc),
        ].join('') || '<div class="yt-empty">暂无 YouTube 账号，请先到账号中心添加并授权</div>';

        const taskRows = tasks.map((t) => `
          <tr>
            <td class="yt-col-id">${t.id}</td>
            <td>
              <div class="yt-cell-title">${this.esc(t.title || t.name || '-')}</div>
              <div class="yt-cell-sub">素材 #${t.materialId || '-'}</div>
            </td>
            <td>
              <div class="yt-cell-title">#${t.accountId}</div>
              <div class="yt-cell-sub">${this.esc(t.channelTitle || '')}</div>
            </td>
            <td>
              <div class="yt-status-line">${this.ytTaskBadge(t.status)}
                <span class="yt-progress">${Number(t.progressPercent || 0)}%</span>
              </div>
            </td>
            <td>${t.youtubeVideoId
              ? `<a class="yt-link" href="https://www.youtube.com/watch?v=${this.esc(t.youtubeVideoId)}" target="_blank" rel="noopener">${this.esc(t.youtubeVideoId)}</a>`
              : '<span class="muted">-</span>'}</td>
            <td class="yt-col-err" title="${this.esc(t.errorMessage || '')}">${this.esc(t.errorMessage || '-')}</td>
            <td class="yt-col-ops">
              ${t.status !== 'completed' && t.status !== 'running'
                ? `<button class="tiny ghost" type="button" onclick="app.runYoutubePublishTask(${t.id})">重试</button>`
                : ''}
            </td>
          </tr>`).join('');

        host.innerHTML = `
          <div class="panel list-panel yt-sync-page">
            <div class="yt-sync-hero">
              <div class="yt-sync-hero__text">
                <div class="yt-sync-hero__kicker">视频向导 · Youtube发布</div>
                <div class="yt-sync-hero__desc">选择 TikTok 已发布素材与多个已授权频道，一键同步上传</div>
              </div>
              <div class="yt-sync-hero__actions">
                <button class="ghost tiny" type="button" onclick="app.navigate('youtubeAccounts')">YouTube 账号</button>
                <button class="ghost tiny" type="button" onclick="app.refresh()">刷新</button>
              </div>
            </div>

            <div class="yt-sync-layout">
              <section class="yt-card yt-card--materials">
                <div class="yt-card__head">
                  <div class="yt-card__title">选择素材
                    <span class="yt-card__count">已选 ${selMatCount}</span>
                  </div>
                  <div class="yt-card__tools">
                    <input class="input yt-search" id="yt-sync-mat-kw" value="${this.esc(matKw)}" placeholder="搜索标题 / 文件名"
                      onkeydown="if(event.key==='Enter'){app._ytSyncMatKeyword=this.value;app._ytSyncMatPage=1;app.ytSyncRememberSelection();app.refresh()}">
                    <div class="yt-pager">
                      <button class="ghost tiny" type="button" ${matPage <= 1 ? 'disabled' : ''}
                        onclick="app._ytSyncMatPage=Math.max(1,(app._ytSyncMatPage||1)-1);app.ytSyncRememberSelection();app.refresh()">上一页</button>
                      <span class="yt-pager__meta">${matPage}/${matPages}</span>
                      <button class="ghost tiny" type="button" ${matPage >= matPages ? 'disabled' : ''}
                        onclick="app._ytSyncMatPage=(app._ytSyncMatPage||1)+1;app.ytSyncRememberSelection();app.refresh()">下一页</button>
                    </div>
                  </div>
                </div>
                <div class="yt-table-wrap">
                  <table class="yt-table">
                    <thead>
                      <tr>
                        <th class="yt-col-check"></th>
                        <th class="yt-col-id">ID</th>
                        <th>标题</th>
                        <th class="yt-col-src">来源</th>
                        <th class="yt-col-num">大小</th>
                        <th class="yt-col-time">时间</th>
                      </tr>
                    </thead>
                    <tbody>${matRows || '<tr><td colspan="6" class="yt-empty-row">暂无已发布素材</td></tr>'}</tbody>
                  </table>
                </div>
                <div class="yt-card__foot muted">共 ${Number(matPack?.total || 0)} 条 · 仅显示已发布且可上传的素材</div>
              </section>

              <aside class="yt-card yt-card--side">
                <div class="yt-card__head">
                  <div class="yt-card__title">发布到频道
                    <span class="yt-card__count">已选 ${selAccCount}</span>
                  </div>
                </div>
                <div class="yt-acc-list">${accRows}</div>
                <div class="yt-side-form">
                  <label class="yt-field">
                    <span class="yt-field__label">可见性</span>
                    <select class="input" id="yt-sync-privacy">
                      <option value="unlisted"${privacy === 'unlisted' ? ' selected' : ''}>不公开列出</option>
                      <option value="private"${privacy === 'private' ? ' selected' : ''}>私有</option>
                      <option value="public"${privacy === 'public' ? ' selected' : ''}>公开</option>
                    </select>
                  </label>
                  <label class="yt-check">
                    <input type="checkbox" id="yt-sync-run-now"${runNow ? ' checked' : ''}>
                    <span>入队后立即上传</span>
                  </label>
                  <label class="yt-check">
                    <input type="checkbox" id="yt-sync-force"${force ? ' checked' : ''}>
                    <span>强制重传（忽略去重）</span>
                  </label>
                  <button class="primary yt-sync-submit" type="button" onclick="app.enqueueYoutubeSync()">开始发布</button>
                </div>
              </aside>
            </div>

            <section class="yt-card yt-card--tasks">
              <div class="yt-card__head">
                <div class="yt-card__title">发布任务</div>
                <div class="yt-pager">
                  <button class="ghost tiny" type="button" ${taskPage <= 1 ? 'disabled' : ''}
                    onclick="app._ytSyncTaskPage=Math.max(1,(app._ytSyncTaskPage||1)-1);app.ytSyncRememberSelection();app.refresh()">上一页</button>
                  <span class="yt-pager__meta">${taskPage}/${taskPages} · 共 ${Number(taskPack?.total || 0)}</span>
                  <button class="ghost tiny" type="button" ${taskPage >= taskPages ? 'disabled' : ''}
                    onclick="app._ytSyncTaskPage=(app._ytSyncTaskPage||1)+1;app.ytSyncRememberSelection();app.refresh()">下一页</button>
                </div>
              </div>
              <div class="yt-table-wrap">
                <table class="yt-table">
                  <thead>
                    <tr>
                      <th class="yt-col-id">ID</th>
                      <th>标题 / 素材</th>
                      <th>频道</th>
                      <th>状态</th>
                      <th>YouTube</th>
                      <th>错误</th>
                      <th class="yt-col-ops"></th>
                    </tr>
                  </thead>
                  <tbody>${taskRows || '<tr><td colspan="7" class="yt-empty-row">暂无发布任务</td></tr>'}</tbody>
                </table>
              </div>
            </section>
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
