(function () {
  if (!window.app) throw new Error('app-core must load before pages/youtubeSync.js');
  const __methods = {
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
      if (!m.uploadable && !m.hasCdn && !m.hasLocalFile) parts.push('<span class="yt-chip yt-chip--miss">无文件</span>');
      return parts.join('');
    },
    openYoutubeSyncCreate() {
      if (!(typeof this.canUseYouTube === 'function' && this.canUseYouTube())) { this.toast('无权创建', true); return; }
      this.youtubeSyncPane = 'create';
      this._ytCreate = { tiktokAccountId: 0, materialIds: [], youtubeAccountIds: [], privacy: 'unlisted', name: '', matPage: 1, matKeyword: '' };
      this.navigate('youtubeSync', 'create');
    },
    closeYoutubeSyncCreate() {
      this.youtubeSyncPane = 'list';
      this.navigate('youtubeSync', 'list');
    },
    async renderYoutubeSync() {
      if (!(typeof this.canUseYouTube === 'function' && this.canUseYouTube())) {
        return this.renderPageDenied('当前账号无权访问 Youtube发布');
      }
      document.querySelector('#content')?.classList.remove('chat-mode');
      const pane = this.youtubeSyncPane || 'list';
      if (pane === 'create') return this.renderYoutubeSyncCreate();
      return this.renderYoutubeSyncList();
    },
    async renderYoutubeSyncList() {
      const host = document.querySelector('#content');
      if (!host) return;
      const page = Math.max(1, Number(this._ytSyncTaskPage || 1));
      const status = String(this._ytSyncTaskStatus || '');
      try {
        const qs = new URLSearchParams({ page: String(page), pageSize: '20' });
        if (status) qs.set('status', status);
        const pack = await this.api('/youtube/publish-tasks?' + qs.toString());
        const tasks = Array.isArray(pack?.items) ? pack.items : [];
        const pages = Math.max(1, Number(pack?.pages || 1));
        const rows = tasks.map((t) => `
          <tr>
            <td class="yt-col-id">${t.id}</td>
            <td>
              <div class="yt-cell-title">${this.esc(t.name || t.title || '-')}</div>
              <div class="yt-cell-sub">${this.esc(t.title || '')}${t.materialId ? ' · 素材 #' + t.materialId : ''}</div>
            </td>
            <td>
              <div class="yt-cell-title">${this.esc(t.tiktokAccountLabel || (t.tiktokAccountId ? ('#' + t.tiktokAccountId) : '-'))}</div>
            </td>
            <td>
              <div class="yt-cell-title">#${t.accountId} ${this.esc(t.channelTitle || '')}</div>
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
            <td class="yt-col-time">${this.esc(String(t.createdAt || '').slice(0, 16))}</td>
            <td class="yt-col-ops">
              ${t.status === 'pending' || t.status === 'failed' || t.status === 'draft'
                ? `<button class="tiny ghost" type="button" onclick="app.runYoutubePublishTask(${t.id})">立即执行</button>`
                : ''}
            </td>
          </tr>`).join('');

        const statusOpts = [
          ['', '全部状态'], ['pending', '待执行'], ['running', '上传中'],
          ['completed', '完成'], ['failed', '失败'],
        ];
        host.innerHTML = `
          <div class="panel list-panel yt-sync-page">
            <div class="yt-sync-hero">
              <div class="yt-sync-hero__text">
                <div class="yt-sync-hero__kicker">视频向导 · Youtube发布</div>
                <div class="yt-sync-hero__desc">创建任务后由计划任务 <code>youtube:publish-dispatch</code> 自动上传；也可手动「立即执行」</div>
              </div>
              <div class="yt-sync-hero__actions">
                <button class="primary tiny" type="button" onclick="app.openYoutubeSyncCreate()">创建任务</button>
                <button class="ghost tiny" type="button" onclick="app.navigate('youtubeAccounts')">YouTube 账号</button>
                <button class="ghost tiny" type="button" onclick="app.refresh()">刷新</button>
              </div>
            </div>
            <section class="yt-card yt-card--tasks">
              <div class="yt-card__head">
                <div class="yt-card__title">发布任务</div>
                <div class="yt-card__tools">
                  <select class="input yt-search" style="width:140px"
                    onchange="app._ytSyncTaskStatus=this.value;app._ytSyncTaskPage=1;app.refresh()">
                    ${statusOpts.map(([v, l]) => `<option value="${v}" ${status === v ? 'selected' : ''}>${l}</option>`).join('')}
                  </select>
                  <div class="yt-pager">
                    <button class="ghost tiny" type="button" ${page <= 1 ? 'disabled' : ''}
                      onclick="app._ytSyncTaskPage=Math.max(1,(app._ytSyncTaskPage||1)-1);app.refresh()">上一页</button>
                    <span class="yt-pager__meta">${page}/${pages} · 共 ${Number(pack?.total || 0)}</span>
                    <button class="ghost tiny" type="button" ${page >= pages ? 'disabled' : ''}
                      onclick="app._ytSyncTaskPage=(app._ytSyncTaskPage||1)+1;app.refresh()">下一页</button>
                  </div>
                </div>
              </div>
              <div class="yt-table-wrap">
                <table class="yt-table">
                  <thead>
                    <tr>
                      <th class="yt-col-id">ID</th>
                      <th>任务 / 标题</th>
                      <th>TikTok 账号</th>
                      <th>YouTube 频道</th>
                      <th>状态</th>
                      <th>YouTube</th>
                      <th>错误</th>
                      <th class="yt-col-time">创建时间</th>
                      <th class="yt-col-ops"></th>
                    </tr>
                  </thead>
                  <tbody>${rows || '<tr><td colspan="9" class="yt-empty-row">暂无任务，点击右上角「创建任务」</td></tr>'}</tbody>
                </table>
              </div>
            </section>
          </div>`;
      } catch (err) {
        host.innerHTML = `<div class="panel"><div class="empty">加载失败：${this.esc(err.message || '')}</div></div>`;
      }
    },
    async renderYoutubeSyncCreate() {
      const host = document.querySelector('#content');
      if (!host) return;
      const draft = this._ytCreate || (this._ytCreate = {
        tiktokAccountId: 0, materialIds: [], youtubeAccountIds: [], privacy: 'unlisted', name: '', matPage: 1, matKeyword: '',
      });
      const tiktokId = Number(draft.tiktokAccountId || 0);
      const matPage = Math.max(1, Number(draft.matPage || 1));
      const matKw = String(draft.matKeyword || '');
      const selectedMats = new Set((draft.materialIds || []).map(Number));
      const selectedYts = new Set((draft.youtubeAccountIds || []).map(Number));

      try {
        const reqs = [
          this.api('/youtube/sync/tiktok-accounts'),
          this.api('/youtube/accounts'),
        ];
        if (tiktokId > 0) {
          reqs.push(this.api(
            '/youtube/sync/materials?page=' + matPage + '&pageSize=20&publishAccountId=' + tiktokId
            + '&keyword=' + encodeURIComponent(matKw)
          ));
        }
        const packs = await Promise.all(reqs);
        const tiktokAccounts = Array.isArray(packs[0]?.items) ? packs[0].items : [];
        const ytAccounts = Array.isArray(packs[1]?.items) ? packs[1].items : [];
        const matPack = tiktokId > 0 ? (packs[2] || {}) : { items: [], total: 0, pages: 1 };
        const materials = Array.isArray(matPack?.items) ? matPack.items : [];
        const matPages = Math.max(1, Number(matPack?.pages || 1));
        this._ytCreateTiktokAccounts = tiktokAccounts;
        this._ytCreateYtAccounts = ytAccounts;

        const ttOpts = [
          `<option value="0">请选择 TikTok 账号</option>`,
          ...tiktokAccounts.map((a) =>
            `<option value="${a.id}" ${tiktokId === Number(a.id) ? 'selected' : ''}>${this.esc(a.label)} · ${a.videoCount} 个视频</option>`
          ),
        ].join('');

        const matRows = materials.map((m) => {
          const ok = !!m.uploadable || m.hasCdn || m.hasLocalFile;
          const checked = selectedMats.has(Number(m.id)) ? ' checked' : '';
          return `<tr class="${ok ? '' : 'is-disabled'}">
            <td class="yt-col-check"><input type="checkbox" data-yt-mat="${m.id}"${checked}${ok ? '' : ' disabled'}
              onchange="app.ytCreateRemember()"></td>
            <td class="yt-col-id">${m.id}</td>
            <td>
              <div class="yt-cell-title">${this.esc(m.title || m.name || '-')}</div>
              <div class="yt-cell-sub">${this.esc(m.caption || m.fileName || m.platformVideoId || '')}</div>
            </td>
            <td class="yt-col-src">${this.ytSourceBadges(m)}</td>
            <td class="yt-col-num">${this.ytFmtSize(m.sizeBytes)}</td>
            <td class="yt-col-time">${this.esc(String(m.postedAt || m.createdAt || '').slice(0, 16))}</td>
          </tr>`;
        }).join('');

        const ytRows = ytAccounts.map((a) => {
          const ok = !!a.authorized;
          const checked = selectedYts.has(Number(a.id)) ? ' checked' : '';
          const label = a.channelTitle || a.nickname || a.username || '未命名';
          return `<label class="yt-acc-item ${ok ? '' : 'is-disabled'}">
            <input type="checkbox" data-yt-acc="${a.id}"${checked}${ok ? '' : ' disabled'} onchange="app.ytCreateRemember()">
            <span class="yt-acc-item__body">
              <span class="yt-acc-item__name">${this.esc(label)}</span>
              <span class="yt-acc-item__meta">#${a.id}${a.channelId ? ' · ' + this.esc(a.channelId) : ''}</span>
            </span>
            ${ok ? '<span class="yt-chip yt-chip--cdn">已授权</span>' : '<span class="yt-chip yt-chip--miss">未授权</span>'}
          </label>`;
        }).join('') || '<div class="yt-empty">暂无已授权 YouTube 账号</div>';

        host.innerHTML = `
          <div class="panel list-panel yt-sync-page">
            <div class="yt-sync-hero">
              <div class="yt-sync-hero__text">
                <div class="yt-sync-hero__kicker">创建 Youtube 发布任务</div>
                <div class="yt-sync-hero__desc">选 TikTok 账号 → 勾选已发布视频 → 选 YouTube 频道 → 入库待计划任务上传</div>
              </div>
              <div class="yt-sync-hero__actions">
                <button class="ghost tiny" type="button" onclick="app.closeYoutubeSyncCreate()">返回列表</button>
              </div>
            </div>

            <div class="yt-create-steps">
              <div class="yt-step is-done"><span class="yt-step__n">1</span> TikTok 账号</div>
              <div class="yt-step ${tiktokId ? 'is-done' : ''}"><span class="yt-step__n">2</span> 选择视频</div>
              <div class="yt-step"><span class="yt-step__n">3</span> YouTube 频道</div>
            </div>

            <div class="yt-sync-layout">
              <section class="yt-card yt-card--materials">
                <div class="yt-card__head">
                  <div class="yt-card__title">TikTok 已发布视频
                    <span class="yt-card__count">已选 ${selectedMats.size}</span>
                  </div>
                  <div class="yt-card__tools">
                    <select class="input yt-search" id="yt-create-tt" style="width:220px"
                      onchange="app.ytCreateChangeTikTok(this.value)">
                      ${ttOpts}
                    </select>
                    ${tiktokId ? `
                    <input class="input yt-search" id="yt-create-mat-kw" value="${this.esc(matKw)}" placeholder="搜索视频"
                      onkeydown="if(event.key==='Enter'){app.ytCreateRemember();app._ytCreate.matKeyword=this.value;app._ytCreate.matPage=1;app.renderYoutubeSyncCreate()}">
                    <div class="yt-pager">
                      <button class="ghost tiny" type="button" ${matPage <= 1 ? 'disabled' : ''}
                        onclick="app.ytCreateRemember();app._ytCreate.matPage=Math.max(1,(app._ytCreate.matPage||1)-1);app.renderYoutubeSyncCreate()">上一页</button>
                      <span class="yt-pager__meta">${matPage}/${matPages}</span>
                      <button class="ghost tiny" type="button" ${matPage >= matPages ? 'disabled' : ''}
                        onclick="app.ytCreateRemember();app._ytCreate.matPage=(app._ytCreate.matPage||1)+1;app.renderYoutubeSyncCreate()">下一页</button>
                    </div>` : ''}
                  </div>
                </div>
                <div class="yt-table-wrap">
                  ${!tiktokId
                    ? '<div class="yt-empty">请先选择 TikTok 账号</div>'
                    : `<table class="yt-table">
                        <thead><tr>
                          <th class="yt-col-check"></th><th class="yt-col-id">ID</th><th>标题 / 文案</th>
                          <th class="yt-col-src">文件</th><th class="yt-col-num">大小</th><th class="yt-col-time">发布时间</th>
                        </tr></thead>
                        <tbody>${matRows || '<tr><td colspan="6" class="yt-empty-row">该账号暂无已发布且可上传的视频</td></tr>'}</tbody>
                      </table>`}
                </div>
                <div class="yt-card__foot muted">仅列出已发布且具备本地文件或 CDN 的素材，供计划任务上传</div>
              </section>

              <aside class="yt-card yt-card--side">
                <div class="yt-card__head">
                  <div class="yt-card__title">发布到 YouTube
                    <span class="yt-card__count">已选 ${selectedYts.size}</span>
                  </div>
                </div>
                <div class="yt-acc-list">${ytRows}</div>
                <div class="yt-side-form">
                  <label class="yt-field">
                    <span class="yt-field__label">任务名称（可选）</span>
                    <input class="input" id="yt-create-name" value="${this.esc(draft.name || '')}" placeholder="留空则按视频标题生成"
                      onchange="app.ytCreateRemember()">
                  </label>
                  <label class="yt-field">
                    <span class="yt-field__label">可见性</span>
                    <select class="input" id="yt-create-privacy" onchange="app.ytCreateRemember()">
                      <option value="unlisted"${draft.privacy === 'unlisted' ? ' selected' : ''}>不公开列出</option>
                      <option value="private"${draft.privacy === 'private' ? ' selected' : ''}>私有</option>
                      <option value="public"${draft.privacy === 'public' ? ' selected' : ''}>公开</option>
                    </select>
                  </label>
                  <div class="yt-create-hint muted">创建后进入「待执行」，由计划任务自动上传；不会阻塞当前页面。</div>
                  <button class="primary yt-sync-submit" type="button" onclick="app.submitYoutubeSyncCreate()">创建任务</button>
                </div>
              </aside>
            </div>
          </div>`;
      } catch (err) {
        host.innerHTML = `<div class="panel"><div class="empty">加载失败：${this.esc(err.message || '')}</div></div>`;
      }
    },
    ytCreateRemember() {
      const d = this._ytCreate || (this._ytCreate = {});
      d.materialIds = [...document.querySelectorAll('[data-yt-mat]:checked')].map((el) => Number(el.getAttribute('data-yt-mat')));
      d.youtubeAccountIds = [...document.querySelectorAll('[data-yt-acc]:checked')].map((el) => Number(el.getAttribute('data-yt-acc')));
      const priv = document.querySelector('#yt-create-privacy');
      if (priv) d.privacy = priv.value;
      const name = document.querySelector('#yt-create-name');
      if (name) d.name = name.value;
      const kw = document.querySelector('#yt-create-mat-kw');
      if (kw) d.matKeyword = kw.value;
      const tt = document.querySelector('#yt-create-tt');
      if (tt) d.tiktokAccountId = Number(tt.value || 0);
    },
    ytCreateChangeTikTok(id) {
      this.ytCreateRemember();
      this._ytCreate.tiktokAccountId = Number(id || 0);
      this._ytCreate.materialIds = [];
      this._ytCreate.matPage = 1;
      this.renderYoutubeSyncCreate();
    },
    async submitYoutubeSyncCreate() {
      if (!(typeof this.canUseYouTube === 'function' && this.canUseYouTube())) { this.toast('无权操作', true); return; }
      this.ytCreateRemember();
      const d = this._ytCreate || {};
      const tiktokAccountId = Number(d.tiktokAccountId || 0);
      const materialIds = d.materialIds || [];
      const youtubeAccountIds = d.youtubeAccountIds || [];
      if (!tiktokAccountId) { this.toast('请选择 TikTok 账号', true); return; }
      if (!materialIds.length) { this.toast('请至少选择一个已发布视频', true); return; }
      if (!youtubeAccountIds.length) { this.toast('请至少选择一个已授权 YouTube 账号', true); return; }
      try {
        const pack = await this.api('/youtube/sync', {
          method: 'POST',
          body: JSON.stringify({
            tiktokAccountId,
            materialIds,
            youtubeAccountIds,
            privacyStatus: d.privacy || 'unlisted',
            name: d.name || '',
            runNow: false,
            force: false,
          }),
        });
        const msg = `已创建 ${pack?.createdCount || 0} · 跳过 ${pack?.skippedCount || 0} · 失败 ${pack?.errorCount || 0}`;
        this.toast(msg, (pack?.errorCount || 0) > 0 ? 'warn' : false);
        this.closeYoutubeSyncCreate();
      } catch (e) { this.toast(e.message, true); }
    },
    async runYoutubePublishTask(id) {
      if (!confirm('立即执行上传任务 #' + id + '？（通常由计划任务自动执行）')) return;
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
