(function () {
  if (!window.app) throw new Error('app-core must load before pages/youtubeAccounts.js');
  const __methods = {
    youtubeAuthBadge(r) {
      if (r.authorized && r.tokenValid) return '<span class="badge online">已授权</span>';
      if (r.authorized) return '<span class="badge paused">需刷新</span>';
      if (String(r.status) === 'authorizing') return '<span class="badge checking">授权中</span>';
      if (String(r.status) === 'error') return '<span class="badge error">异常</span>';
      return '<span class="badge offline">未授权</span>';
    },
    async loadYoutubeCompanyOptions() {
      try {
        if (typeof this.loadAccountCompanyOptions === 'function') {
          return await this.loadAccountCompanyOptions();
        }
        const pack = await this.api('/auth/account-filter-options');
        return Array.isArray(pack?.companies) ? pack.companies : [];
      } catch {
        return [];
      }
    },
    youtubeCompanySelectHtml(companies, curCompanyId, opts = {}) {
      const blank = opts.blankLabel || '不绑定企业';
      const name = opts.name || 'companyId';
      const optsHtml = [
        `<option value="">${this.esc(blank)}</option>`,
        ...(companies || []).map((c) => {
          const id = String(c.id);
          const label = `${c.name || '-'}${c.industryPath ? ' · ' + c.industryPath : ''}`;
          const sel = String(curCompanyId || '') === id ? ' selected' : '';
          return `<option value="${this.esc(id)}"${sel}>${this.esc(label)}</option>`;
        }),
      ].join('');
      return `<div class="field full"><label>关联企业</label>
        <select class="input" name="${this.esc(name)}">${optsHtml}</select>
        <div class="muted" style="margin-top:6px;font-size:12px">绑定后列表显示企业名；未绑定显示 --</div>
      </div>`;
    },
    async youtubeAccountFormHtml(row = {}) {
      const v = (k) => this.esc(String(row[k] ?? ''));
      const companies = await this.loadYoutubeCompanyOptions();
      const companyField = this.youtubeCompanySelectHtml(companies, row.companyId || row.company_id || '', {
        blankLabel: '不绑定企业',
      });
      return `
        <div class="form-grid">
          <div class="field full"><label>备注名</label>
            <input class="input" name="username" value="${v('username')}" placeholder="便于识别，可空">
          </div>
          <div class="field full"><label>昵称</label>
            <input class="input" name="nickname" value="${v('nickname')}" placeholder="授权后可自动回填频道名">
          </div>
          ${companyField}
          <div class="field full"><label>备注</label>
            <input class="input" name="notes" value="${v('notes')}" placeholder="可选">
          </div>
        </div>`;
    },
    youtubeAccountsQuery() {
      const qs = new URLSearchParams();
      const kw = String(this._ytAccKeyword || '').trim();
      const companyId = Number(this._ytAccCompanyId || 0);
      if (kw) qs.set('keyword', kw);
      if (companyId > 0) qs.set('companyId', String(companyId));
      const s = qs.toString();
      return s ? ('?' + s) : '';
    },
    ytFmtNum(n) {
      const v = Number(n) || 0;
      if (v >= 10000) return (v / 10000).toFixed(v >= 100000 ? 0 : 1) + '万';
      return String(v);
    },
    ytFmtDuration(sec) {
      const s = Math.max(0, Number(sec) || 0);
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const r = s % 60;
      if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
      return `${m}:${String(r).padStart(2, '0')}`;
    },
    toggleYoutubeAccountOps(id, e) {
      e?.stopPropagation?.();
      const target = document.querySelector('#yt-acc-ops-' + id);
      const willShow = target?.classList.contains('hidden');
      document.querySelectorAll('.dropdown-menu').forEach((el) => {
        el.classList.add('hidden');
        if (window.UI) UI.restoreMenu(el);
      });
      if (target && willShow) {
        target.classList.add('ops-menu');
        target.classList.remove('hidden');
        const btn = e?.currentTarget || target.closest('.ops-dropdown')?.querySelector('button');
        if (window.UI) {
          UI.decorate?.(target);
          UI.liftMenu(target, btn, { side: 'left' });
        }
      }
    },
    openYoutubeDataPanel(accountId) {
      if (!(typeof this.canUseYouTubePanel === 'function' && this.canUseYouTubePanel())) {
        this.toast('无权访问 YouTube 数据面板', true);
        return;
      }
      this._ytPanelAccountId = Number(accountId) || 0;
      this._ytPanelVideoId = 0;
      this._ytPanelKeyword = '';
      this._ytPanelPage = 1;
      this.youtubeAccountsPane = 'videos';
      this.navigate('youtubeAccounts', 'videos/' + accountId);
    },
    openYoutubeVideoDetail(accountId, videoId) {
      this._ytPanelAccountId = Number(accountId) || 0;
      this._ytPanelVideoId = Number(videoId) || 0;
      this.youtubeAccountsPane = 'video';
      this.navigate('youtubeAccounts', 'video/' + accountId + '/' + videoId);
    },
    async renderYoutubeAccounts() {
      const pane = this.youtubeAccountsPane || 'list';
      if (pane === 'videos') return this.renderYoutubeAccountVideos();
      if (pane === 'video') return this.renderYoutubeVideoDetail();
      return this.renderYoutubeAccountsList();
    },
    async renderYoutubeAccountsList() {
      const host = document.querySelector('#content');
      if (!host) return;
      document.querySelector('#content')?.classList.remove('chat-mode');
      if (!(typeof this.canUseYouTube === 'function' && this.canUseYouTube())) {
        host.innerHTML = `<div class="panel"><div class="empty">当前账号无权访问 YouTube 账号</div></div>`;
        return;
      }
      try {
        const companies = await this.loadYoutubeCompanyOptions();
        const pack = await this.api('/youtube/accounts' + this.youtubeAccountsQuery());
        const items = Array.isArray(pack?.items) ? pack.items : [];
        this._ytAccItems = items;
        const oauthOk = !!pack?.oauthConfigured;
        const companyFilter = Number(this._ytAccCompanyId || 0);
        const companyFilterOpts = [
          `<option value="0">全部企业</option>`,
          ...companies.map((c) =>
            `<option value="${c.id}" ${companyFilter === Number(c.id) ? 'selected' : ''}>${this.esc(c.name || ('#' + c.id))}</option>`
          ),
        ].join('');
        const rows = items.map((r) => {
          const companyLabel = String(r.companyName || r.company_name || '').trim() || '--';
          const more = [
            `<button type="button" onclick="app.startYoutubeAuth(${r.id})">授权登录</button>`,
          ];
          if (r.authorized) {
            more.push(`<button type="button" onclick="app.refreshYoutubeToken(${r.id})">刷新 Token</button>`);
          }
          if (typeof this.canUseYouTubePanel === 'function' ? this.canUseYouTubePanel() : true) {
            more.push(`<button type="button" onclick="app.openYoutubeDataPanel(${r.id})">数据面板</button>`);
          }
          const moreBtn = `<div class="ops-dropdown yt-acc-ops-dropdown"><button class="tiny" type="button" title="更多" onclick="app.toggleYoutubeAccountOps(${r.id},event)">…</button><div id="yt-acc-ops-${r.id}" class="dropdown-menu ops-menu hidden">${more.join('')}</div></div>`;
          return `
          <tr>
            <td>${r.id}</td>
            <td>${this.esc(r.username || '-')}</td>
            <td>${this.esc(r.nickname || r.channelTitle || '-')}</td>
            <td>${this.esc(companyLabel)}</td>
            <td>${this.esc(r.channelId || '-')}<div class="muted" style="font-size:12px">${this.esc(r.channelCustomUrl || '')}</div></td>
            <td>${this.youtubeAuthBadge(r)}</td>
            <td title="Token刷新 / 最近登录">${this.esc(String(r.tokenRefreshedAt || r.lastLoginAt || r.updatedAt || '-').slice(0, 16))}</td>
            <td class="muted" style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${this.esc(r.lastError || '')}">${this.esc(r.lastError || '-')}</td>
            <td><div class="task-ops-cell yt-acc-ops-cell" style="white-space:nowrap">
              <button class="tiny ghost" type="button" onclick="app.editYoutubeAccount(${r.id})">编辑</button>
              <button class="tiny ghost is-danger" type="button" onclick="app.deleteYoutubeAccount(${r.id})">删除</button>
              ${moreBtn}
            </div></td>
          </tr>`;
        }).join('');
        host.innerHTML = `
          <div class="panel list-panel yt-accounts-page">
            <div class="matrix-action-bar yt-accounts-toolbar">
              <div class="left">
                <span class="muted">账号数据 · YouTube 账号（可关联企业）</span>
                ${oauthOk
                  ? '<span class="badge online">OAuth 已配</span>'
                  : '<span class="badge offline">请先配置 OAuth</span>'}
              </div>
              <div class="right">
                <select class="input tiny yt-acc-filter" id="yt-acc-company"
                  onchange="app._ytAccCompanyId=Number(this.value||0);app.refresh()">
                  ${companyFilterOpts}
                </select>
                <input class="input tiny yt-acc-filter" id="yt-acc-kw" value="${this.esc(this._ytAccKeyword || '')}"
                  placeholder="名称/频道/企业"
                  onkeydown="if(event.key==='Enter'){app._ytAccKeyword=this.value;app.refresh()}">
                <button class="ghost tiny" type="button" onclick="app._ytAccKeyword=(document.querySelector('#yt-acc-kw')||{}).value||'';app.refresh()">搜索</button>
                <button class="primary tiny" type="button" onclick="app.addYoutubeAccount()" ${oauthOk ? '' : 'disabled'}>+ 添加账号</button>
                <button class="ghost tiny" type="button" onclick="app.navigate('youtubeConfig')">OAuth 配置</button>
                <button class="ghost tiny" type="button" onclick="app.refresh()">刷新</button>
              </div>
            </div>
            <table class="ai-lead-table">
              <thead><tr>
                <th>ID</th><th>备注名</th><th>频道</th><th>关联企业</th><th>Channel ID</th><th>授权</th><th>Token刷新</th><th>错误</th><th>操作</th>
              </tr></thead>
              <tbody>${rows || '<tr><td colspan="9" class="empty">暂无账号，请先配置 OAuth 后添加并授权</td></tr>'}</tbody>
            </table>
          </div>`;
      } catch (err) {
        host.innerHTML = `<div class="panel"><div class="empty">加载失败：${this.esc(err.message || '')}</div></div>`;
      }
    },
    async renderYoutubeAccountVideos() {
      const host = document.querySelector('#content');
      if (!host) return;
      const accountId = Number(this._ytPanelAccountId || 0);
      if (!accountId) {
        this.navigate('youtubeAccounts');
        return;
      }
      if (!(typeof this.canUseYouTube === 'function' && this.canUseYouTube())) {
        host.innerHTML = `<div class="panel"><div class="empty">当前账号无权访问</div></div>`;
        return;
      }
      const page = Math.max(1, Number(this._ytPanelPage || 1));
      const keyword = String(this._ytPanelKeyword || '').trim();
      const qs = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (keyword) qs.set('keyword', keyword);
      try {
        const pack = await this.api(`/youtube/accounts/${accountId}/videos?` + qs.toString());
        const acc = pack?.account || {};
        const items = Array.isArray(pack?.items) ? pack.items : [];
        const total = Number(pack?.total || 0);
        const pages = Math.max(1, Number(pack?.pages || 1));
        this._ytPanelPage = Number(pack?.page || page);
        const title = acc.channelTitle || acc.nickname || acc.username || ('账号 #' + accountId);
        const customUrl = String(acc.channelCustomUrl || '').trim();
        const handle = customUrl ? (customUrl.startsWith('@') ? customUrl : '@' + customUrl.replace(/^@/, '')) : '';
        const desc = String(acc.channelDescription || '').trim();
        const descShort = desc.length > 160 ? desc.slice(0, 160) + '…' : desc;
        const syncedAt = String(acc.channelStatsSyncedAt || '').slice(0, 16) || '尚未同步';
        const subLabel = acc.hiddenSubscriberCount ? '已隐藏' : this.ytFmtNum(acc.subscriberCount);
        const avatar = acc.channelThumbUrl
          ? `<img class="yt-ch-avatar" src="${this.esc(acc.channelThumbUrl)}" alt="">`
          : `<div class="yt-ch-avatar yt-ch-avatar--ph">${this.esc((title.replace(/^@/, '').slice(0, 1) || 'Y').toUpperCase())}</div>`;
        const rows = items.map((v) => {
          const thumb = v.thumbnailUrl
            ? `<img src="${this.esc(v.thumbnailUrl)}" alt="" style="width:72px;height:40px;object-fit:cover;border-radius:6px;background:#0f172a">`
            : '<span class="muted">-</span>';
          return `<tr>
            <td>${thumb}</td>
            <td><b>${this.esc(v.title || '-')}</b>
              <div class="muted" style="font-size:12px">${this.esc(v.youtubeVideoId || '')} · ${this.esc(v.privacyStatus || '')}</div>
            </td>
            <td>${this.ytFmtDuration(v.durationSeconds)}</td>
            <td>${this.ytFmtNum(v.viewCount)}</td>
            <td>${this.ytFmtNum(v.likeCount)}</td>
            <td>${this.ytFmtNum(v.commentCount)}</td>
            <td>${this.esc(String(v.publishedAt || '').slice(0, 16) || '-')}</td>
            <td style="white-space:nowrap">
              <button class="tiny ghost" type="button" onclick="app.openYoutubeVideoDetail(${accountId},${v.id})">详情</button>
              ${v.watchUrl ? `<a class="tiny ghost" href="${this.esc(v.watchUrl)}" target="_blank" rel="noopener">打开</a>` : ''}
              <button class="tiny ghost is-danger" type="button" onclick="app.deleteYoutubeVideo(${accountId},${v.id})">删除</button>
            </td>
          </tr>`;
        }).join('');
        host.innerHTML = `
          <div class="panel list-panel yt-accounts-page yt-panel-page">
            <div class="matrix-action-bar yt-accounts-toolbar">
              <div class="left">
                <button class="ghost tiny" type="button" onclick="app.navigate('youtubeAccounts')">← 返回账号</button>
                <span class="muted">数据面板 · ${this.esc(title)}</span>
                ${acc.authorized ? '<span class="badge online">已授权</span>' : '<span class="badge offline">未授权</span>'}
              </div>
              <div class="right">
                <input class="input tiny yt-acc-filter" id="yt-panel-kw" value="${this.esc(keyword)}"
                  placeholder="标题/视频ID"
                  onkeydown="if(event.key==='Enter'){app._ytPanelKeyword=this.value;app._ytPanelPage=1;app.refresh()}">
                <button class="ghost tiny" type="button" onclick="app._ytPanelKeyword=(document.querySelector('#yt-panel-kw')||{}).value||'';app._ytPanelPage=1;app.refresh()">搜索</button>
                <button class="primary tiny" type="button" onclick="app.pullYoutubeAccountVideos(${accountId})" ${acc.authorized ? '' : 'disabled'}>拉取列表</button>
                <button class="ghost tiny" type="button" onclick="app.refresh()">刷新</button>
              </div>
            </div>
            <section class="yt-ch-card">
              <div class="yt-ch-card__main">
                ${avatar}
                <div class="yt-ch-card__info">
                  <div class="yt-ch-card__title-row">
                    <h3 class="yt-ch-card__title">${this.esc(title)}</h3>
                    ${acc.authorized ? '<span class="yt-chip yt-chip--ok">已授权</span>' : '<span class="yt-chip yt-chip--warn">未授权</span>'}
                  </div>
                  <div class="yt-ch-card__meta">
                    ${handle ? `<span>${this.esc(handle)}</span>` : ''}
                    ${acc.channelId ? `<span class="is-mono">${this.esc(acc.channelId)}</span>` : '<span class="muted">暂无 Channel ID</span>'}
                    ${acc.channelCountry ? `<span>${this.esc(acc.channelCountry)}</span>` : ''}
                    ${acc.channelPublishedAt ? `<span>开播 ${this.esc(String(acc.channelPublishedAt).slice(0, 10))}</span>` : ''}
                  </div>
                  ${descShort ? `<p class="yt-ch-card__desc" title="${this.esc(desc)}">${this.esc(descShort)}</p>` : '<p class="yt-ch-card__desc muted">暂无频道简介，点击右侧拉取基础数据</p>'}
                </div>
                <div class="yt-ch-card__actions">
                  <button class="primary tiny" type="button" onclick="app.pullYoutubeAccountStats(${accountId})" ${acc.authorized ? '' : 'disabled'}>拉取基础数据</button>
                  <div class="yt-ch-card__sync muted">同步于 ${this.esc(syncedAt)}</div>
                </div>
              </div>
              <div class="yt-ch-metrics">
                <div class="yt-ch-metric">
                  <em>订阅者</em>
                  <b>${this.esc(String(subLabel))}</b>
                </div>
                <div class="yt-ch-metric">
                  <em>总浏览</em>
                  <b>${this.ytFmtNum(acc.channelViewCount)}</b>
                </div>
                <div class="yt-ch-metric">
                  <em>视频数</em>
                  <b>${this.ytFmtNum(acc.channelVideoCount)}</b>
                </div>
                <div class="yt-ch-metric">
                  <em>本地内容</em>
                  <b>${this.ytFmtNum(total)}</b>
                </div>
              </div>
            </section>
            <table class="ai-lead-table">
              <thead><tr>
                <th>封面</th><th>标题</th><th>时长</th><th>浏览</th><th>点赞</th><th>评论</th><th>发布时间</th><th>操作</th>
              </tr></thead>
              <tbody>${rows || '<tr><td colspan="8" class="empty">暂无内容，点击「拉取列表」从 YouTube 同步</td></tr>'}</tbody>
            </table>
            <div class="pager" style="margin-top:12px">
              <div class="pager-inner">
                <button class="ghost tiny" type="button" ${this._ytPanelPage <= 1 ? 'disabled' : ''}
                  onclick="app._ytPanelPage=Math.max(1,(app._ytPanelPage||1)-1);app.refresh()">上一页</button>
                <span class="muted">${this._ytPanelPage} / ${pages} · 共 ${total}</span>
                <button class="ghost tiny" type="button" ${this._ytPanelPage >= pages ? 'disabled' : ''}
                  onclick="app._ytPanelPage=(app._ytPanelPage||1)+1;app.refresh()">下一页</button>
              </div>
            </div>
          </div>`;
      } catch (err) {
        host.innerHTML = `<div class="panel"><div class="empty">加载失败：${this.esc(err.message || '')}</div>
          <button class="ghost" type="button" onclick="app.navigate('youtubeAccounts')">返回</button></div>`;
      }
    },
    async pullYoutubeAccountStats(accountId) {
      try {
        await this.api(`/youtube/accounts/${accountId}/stats/pull`, {
          method: 'POST',
          body: '{}',
        });
        this.toast('已同步频道基础数据');
        this.refresh();
      } catch (e) {
        this.toast(e.message, true);
      }
    },
    async pullYoutubeAccountVideos(accountId) {
      if (!confirm('从 YouTube 拉取该频道内容列表并更新本地数据？')) return;
      try {
        const r = await this.api(`/youtube/accounts/${accountId}/videos/pull`, {
          method: 'POST',
          body: JSON.stringify({ maxPages: 10 }),
        });
        this.toast(`已同步 ${r?.pulled ?? 0} 条内容`);
        this._ytPanelPage = 1;
        this.refresh();
      } catch (e) {
        this.toast(e.message, true);
      }
    },
    async deleteYoutubeVideo(accountId, videoId, goBack) {
      if (!confirm('确认从 YouTube 删除该视频？此操作不可恢复。')) return;
      try {
        await this.api(`/youtube/accounts/${accountId}/videos/${videoId}`, { method: 'DELETE' });
        this.toast('已删除');
        if (goBack) this.openYoutubeDataPanel(accountId);
        else this.refresh();
      } catch (e) {
        this.toast(e.message, true);
      }
    },
    ytCmtAvatar(name, imgUrl) {
      const label = String(name || 'U').trim() || 'U';
      const initial = this.esc(label.replace(/^@/, '').slice(0, 1).toUpperCase() || 'U');
      if (imgUrl) {
        return `<img class="yt-cmt-avatar" src="${this.esc(imgUrl)}" alt="" onerror="this.classList.add('is-hidden');this.nextElementSibling&&this.nextElementSibling.classList.remove('is-hidden')"><span class="yt-cmt-avatar is-fallback is-hidden">${initial}</span>`;
      }
      return `<span class="yt-cmt-avatar is-fallback">${initial}</span>`;
    },
    ytMetaRows(rows) {
      return (rows || []).map(([k, val, opts]) => {
        const mono = opts && opts.mono ? ' is-mono' : '';
        const block = opts && opts.block ? ' is-block' : '';
        const link = opts && opts.href
          ? `<a href="${this.esc(opts.href)}" target="_blank" rel="noopener">${this.esc(String(val ?? '-'))}</a>`
          : this.esc(String(val ?? '-'));
        return `<div class="yt-meta-row${block}">
          <div class="yt-meta-k">${this.esc(k)}</div>
          <div class="yt-meta-v${mono}">${link}</div>
        </div>`;
      }).join('');
    },
    async renderYoutubeVideoDetail() {
      const host = document.querySelector('#content');
      if (!host) return;
      const accountId = Number(this._ytPanelAccountId || 0);
      const videoId = Number(this._ytPanelVideoId || 0);
      if (!accountId || !videoId) {
        this.navigate('youtubeAccounts');
        return;
      }
      try {
        const [pack, commentsPack] = await Promise.all([
          this.api(`/youtube/accounts/${accountId}/videos/${videoId}?refresh=1`),
          this.api(`/youtube/accounts/${accountId}/videos/${videoId}/comments`).catch(() => ({ items: [] })),
        ]);
        const acc = pack?.account || {};
        const v = pack?.video || {};
        const comments = Array.isArray(commentsPack?.items) ? commentsPack.items : [];
        this._ytVideoDetail = v;
        this._ytVideoComments = comments;
        const channelLabel = acc.channelTitle || acc.nickname || acc.username || ('账号 #' + accountId);
        const privacy = String(v.privacyStatus || '').toLowerCase();
        const privacyTone = privacy === 'public' ? 'ok' : (privacy === 'unlisted' ? 'warn' : 'muted');
        const privacyLabel = privacy === 'public' ? '公开' : (privacy === 'unlisted' ? '不公开列出' : (privacy === 'private' ? '私密' : (v.privacyStatus || '未知')));
        const tags = (v.tags || []).filter(Boolean);
        const tagHtml = tags.length
          ? tags.slice(0, 12).map((t) => `<span class="yt-tag">${this.esc(t)}</span>`).join('')
          : '<span class="muted">无标签</span>';

        const creatorTops = comments.filter((c) => !!c.isCreatorComment);
        const audienceTops = comments.filter((c) => !c.isCreatorComment);
        const renderReply = (r) => `
            <div class="yt-cmt-reply ${r.isCreatorComment ? 'yt-cmt-reply--creator' : ''}">
              ${this.ytCmtAvatar(r.authorDisplayName, r.authorProfileImageUrl)}
              <div class="yt-cmt-main">
                <div class="yt-cmt-head">
                  <b>${this.esc(r.authorDisplayName || '用户')}</b>
                  ${r.isCreatorComment ? '<span class="yt-cmt-tag yt-cmt-tag--creator">创作者</span>' : ''}
                  <span class="muted">${this.esc(String(r.publishedAt || '').slice(0, 16))}</span>
                  <span class="yt-cmt-like">👍 ${this.ytFmtNum(r.likeCount)}</span>
                </div>
                <div class="yt-cmt-body">${this.esc(r.textDisplay || r.textOriginal || '')}</div>
                <div class="yt-cmt-ops">
                  <button class="tiny ghost is-danger" type="button" onclick="app.deleteYoutubeComment(${accountId},${r.id})">删除</button>
                </div>
              </div>
            </div>`;
        const renderTop = (c) => {
          const isCreator = !!c.isCreatorComment;
          const replied = !!c.creatorReplied;
          const autoSt = String(c.autoHandleStatus || '');
          const autoTag = !isCreator && autoSt === 'deleted'
            ? '<span class="yt-cmt-tag yt-cmt-tag--deleted">已自动删除</span>'
            : (!isCreator && autoSt === 'replied'
              ? '<span class="yt-cmt-tag yt-cmt-tag--replied">已自动回复</span>'
              : (!isCreator && autoSt === 'error'
                ? `<span class="yt-cmt-tag yt-cmt-tag--pending" title="${this.esc(c.autoHandleNote || '')}">自动处理失败</span>`
                : ''));
          const statusTag = isCreator
            ? '<span class="yt-cmt-tag yt-cmt-tag--creator">创作者评论</span>'
            : (replied
              ? '<span class="yt-cmt-tag yt-cmt-tag--replied">已回复</span>'
              : '<span class="yt-cmt-tag yt-cmt-tag--pending">未回复</span>');
          const replies = (c.replies || []).map(renderReply).join('');
          return `
            <article class="yt-cmt-card ${isCreator ? 'yt-cmt-card--creator' : 'yt-cmt-card--audience'} ${!isCreator && !replied ? 'is-pending' : ''} ${!isCreator && replied ? 'is-replied' : ''}">
              ${this.ytCmtAvatar(c.authorDisplayName, c.authorProfileImageUrl)}
              <div class="yt-cmt-main">
                <div class="yt-cmt-head">
                  <b>${this.esc(c.authorDisplayName || '用户')}</b>
                  ${statusTag}${autoTag}
                  <span class="muted">${this.esc(String(c.publishedAt || '').slice(0, 16))}</span>
                  <span class="yt-cmt-like">👍 ${this.ytFmtNum(c.likeCount)}</span>
                  ${c.moderationStatus ? `<span class="yt-chip">${this.esc(c.moderationStatus)}</span>` : ''}
                </div>
                <div class="yt-cmt-body">${this.esc(c.textDisplay || c.textOriginal || '')}</div>
                <div class="yt-cmt-ops">
                  ${!isCreator ? `<button class="tiny ghost" type="button" onclick="app.replyYoutubeComment(${accountId},${c.id})">回复</button>` : ''}
                  <button class="tiny ghost is-danger" type="button" onclick="app.deleteYoutubeComment(${accountId},${c.id})">删除</button>
                </div>
                ${replies ? `<div class="yt-cmt-replies">${replies}</div>` : ''}
              </div>
            </article>`;
        };
        const commentHtml = (comments.length
          ? `
            <div class="yt-cmt-section">
              <div class="yt-cmt-section__head">
                <h4>观众评论</h4>
                <span class="muted">${audienceTops.length} 条 · 未回复 ${audienceTops.filter((c) => !c.creatorReplied).length}</span>
              </div>
              <div class="yt-cmt-section__list">
                ${audienceTops.map(renderTop).join('') || '<div class="yt-cmt-empty yt-cmt-empty--sm"><div class="muted">暂无观众顶层评论</div></div>'}
              </div>
            </div>
            <div class="yt-cmt-section">
              <div class="yt-cmt-section__head">
                <h4>创作者评论</h4>
                <span class="muted">${creatorTops.length} 条</span>
              </div>
              <div class="yt-cmt-section__list">
                ${creatorTops.map(renderTop).join('') || '<div class="yt-cmt-empty yt-cmt-empty--sm"><div class="muted">暂无创作者顶层评论</div></div>'}
              </div>
            </div>`
          : `<div class="yt-cmt-empty">
          <div class="yt-cmt-empty__title">暂无评论</div>
          <div class="muted">点击右上角「拉取评论」从 YouTube 同步</div>
        </div>`);

        host.innerHTML = `
          <div class="yt-vd-page">
            <div class="yt-vd-topbar">
              <div class="yt-vd-topbar__left">
                <button class="ghost tiny" type="button" onclick="app.openYoutubeDataPanel(${accountId})">← 返回列表</button>
                <div class="yt-vd-crumb">
                  <span class="yt-vd-crumb__ch">${this.esc(channelLabel)}</span>
                  <span class="yt-vd-crumb__sep">/</span>
                  <span class="yt-vd-crumb__title" title="${this.esc(v.title || '')}">${this.esc(v.title || ('内容 #' + videoId))}</span>
                </div>
              </div>
              <div class="yt-vd-topbar__right">
                ${v.watchUrl ? `<a class="ghost tiny" href="${this.esc(v.watchUrl)}" target="_blank" rel="noopener">YouTube 打开</a>` : ''}
                <button class="ghost tiny" type="button" onclick="app.pullYoutubeVideoComments(${accountId},${videoId})">拉取评论</button>
                <button class="ghost tiny" type="button" onclick="app.refresh()">刷新</button>
                <button class="tiny danger" type="button" onclick="app.deleteYoutubeVideo(${accountId},${videoId},true)">删除视频</button>
              </div>
            </div>

            <section class="yt-vd-hero">
              <div class="yt-vd-hero__media">
                ${v.thumbnailUrl
                  ? `<img src="${this.esc(v.thumbnailUrl)}" alt="">`
                  : `<div class="yt-vd-hero__ph">暂无封面</div>`}
                <span class="yt-vd-duration">${this.esc(this.ytFmtDuration(v.durationSeconds))}</span>
                ${v.watchUrl ? `<a class="yt-vd-play" href="${this.esc(v.watchUrl)}" target="_blank" rel="noopener" title="在 YouTube 打开">▶</a>` : ''}
              </div>
              <div class="yt-vd-hero__body">
                <div class="yt-vd-badges">
                  <span class="yt-chip yt-chip--${privacyTone}">${this.esc(privacyLabel)}</span>
                  ${v.status ? `<span class="yt-chip">${this.esc(v.status)}</span>` : ''}
                  ${v.uploadStatus ? `<span class="yt-chip yt-chip--soft">${this.esc(v.uploadStatus)}</span>` : ''}
                  <span class="yt-chip yt-chip--soft">#${v.id || videoId}</span>
                </div>
                <h2 class="yt-vd-title">${this.esc(v.title || '未命名内容')}</h2>
                <div class="yt-vd-sub">
                  <span>${this.esc(channelLabel)}</span>
                  ${v.publishedAt ? `<span>· 发布 ${this.esc(String(v.publishedAt).slice(0, 16))}</span>` : ''}
                  ${v.youtubeVideoId ? `<span class="is-mono">· ${this.esc(v.youtubeVideoId)}</span>` : ''}
                </div>
                <div class="yt-vd-metrics">
                  <div class="yt-metric"><em>浏览</em><b>${this.ytFmtNum(v.viewCount)}</b></div>
                  <div class="yt-metric"><em>点赞</em><b>${this.ytFmtNum(v.likeCount)}</b></div>
                  <div class="yt-metric"><em>评论</em><b>${this.ytFmtNum(v.commentCount)}</b></div>
                  <div class="yt-metric"><em>收藏</em><b>${this.ytFmtNum(v.favoriteCount)}</b></div>
                </div>
                <div class="yt-vd-desc">
                  <div class="yt-vd-desc__label">描述</div>
                  <div class="yt-vd-desc__text">${this.esc(v.description || '暂无描述')}</div>
                </div>
                <div class="yt-vd-tags">${tagHtml}</div>
              </div>
            </section>

            <div class="yt-vd-layout">
              <div class="yt-vd-col-main">
                <section class="yt-vd-card">
                  <header class="yt-vd-card__head"><h3>内容信息</h3></header>
                  <div class="yt-meta-grid">
                    ${this.ytMetaRows([
                      ['本地 ID', v.id],
                      ['YouTube Video ID', v.youtubeVideoId, { mono: true }],
                      ['频道 ID', v.channelId, { mono: true }],
                      ['分类', v.categoryId || '-'],
                      ['时长', this.ytFmtDuration(v.durationSeconds) + (v.durationIso ? ` (${v.durationIso})` : '')],
                      ['可嵌入', v.embeddable ? '是' : '否'],
                      ['面向儿童', v.madeForKids ? '是' : '否'],
                      ['定时发布', v.publishAt || '-'],
                      ['最近同步', v.lastSyncedAt || '-'],
                      ['创建时间', v.createdAt || '-'],
                      ['更新时间', v.updatedAt || '-'],
                      ['观看链接', v.watchUrl || '-', v.watchUrl ? { href: v.watchUrl, mono: true } : { mono: true }],
                    ])}
                  </div>
                </section>
              </div>
              <aside class="yt-vd-col-side">
                <section class="yt-vd-card yt-vd-card--comments">
                  <header class="yt-vd-card__head">
                    <div>
                      <h3>评论</h3>
                      <p class="muted">共 ${comments.length} 条顶层评论</p>
                    </div>
                    <button class="ghost tiny" type="button" onclick="app.pullYoutubeVideoComments(${accountId},${videoId})">同步</button>
                  </header>
                  <div class="yt-cmt-list">${commentHtml}</div>
                </section>
              </aside>
            </div>
          </div>`;
      } catch (err) {
        host.innerHTML = `<div class="panel"><div class="empty">加载失败：${this.esc(err.message || '')}</div>
          <button class="ghost" type="button" onclick="app.openYoutubeDataPanel(${accountId})">返回</button></div>`;
      }
    },
    async pullYoutubeVideoComments(accountId, videoId) {
      try {
        const r = await this.api(`/youtube/accounts/${accountId}/videos/${videoId}/comments/pull`, {
          method: 'POST',
          body: JSON.stringify({ maxPages: 5, fetchAllReplies: true }),
        });
        this.toast(`已同步评论 ${r?.comments ?? 0} / 回复 ${r?.replies ?? 0}`);
        this.refresh();
      } catch (e) {
        this.toast(e.message, true);
      }
    },
    ytFindCommentById(commentId) {
      const id = Number(commentId) || 0;
      const list = Array.isArray(this._ytVideoComments) ? this._ytVideoComments : [];
      for (const c of list) {
        if (Number(c.id) === id) return c;
        const replies = Array.isArray(c.replies) ? c.replies : [];
        for (const r of replies) {
          if (Number(r.id) === id) return { ...r, _parent: c };
        }
      }
      return null;
    },
    youtubeReplyModalHtml(comment, opts = {}) {
      const c = comment || {};
      const author = c.authorDisplayName || '用户';
      const text = c.textDisplay || c.textOriginal || '';
      const templates = Array.isArray(opts.templates) ? opts.templates : [];
      const selectedId = Number(opts.templateId || 0);
      const tplOpts = [
        `<option value="0">默认：YouTube 评论回复</option>`,
        ...templates.map((t) => {
          const id = Number(t.id);
          const label = `${t.name || t.code || ('#' + id)}${t.isBuiltin ? '（内置）' : ''}`;
          return `<option value="${id}" ${selectedId === id ? 'selected' : ''}>${this.esc(label)}</option>`;
        }),
      ].join('');
      return `
        <div class="yt-reply-modal">
          <div class="yt-reply-modal__origin">
            <div class="yt-reply-modal__origin-head">
              ${this.ytCmtAvatar(author, c.authorProfileImageUrl)}
              <div>
                <div class="yt-reply-modal__author">${this.esc(author)}</div>
                <div class="muted" style="font-size:12px">${this.esc(String(c.publishedAt || '').slice(0, 16) || '')}</div>
              </div>
            </div>
            <div class="yt-reply-modal__origin-body">${this.esc(text)}</div>
          </div>
          <div class="form-grid yt-reply-modal__form">
            <div class="field full">
              <label>AI 提示词模板</label>
              <div class="yt-reply-modal__tpl-row">
                <select class="input" name="templateId" id="yt-reply-tpl">${tplOpts}</select>
                <button class="primary tiny" type="button" id="yt-reply-ai-btn">AI 生成</button>
              </div>
              <div class="muted" style="margin-top:6px;font-size:12px">使用设置中的「YouTube 评论回复」提示词；也可自行改下方内容后发送</div>
            </div>
            <div class="field full">
              <label>回复内容 <span class="req">*</span></label>
              <textarea class="input" name="text" id="yt-reply-text" rows="6" placeholder="可手动输入，或点击「AI 生成」后编辑" data-rule="required|min:1">${this.esc(opts.draft || '')}</textarea>
              <div class="yt-reply-modal__meta">
                <span class="muted" id="yt-reply-ai-status"></span>
                <span class="muted" id="yt-reply-count">0 字</span>
              </div>
            </div>
          </div>
        </div>`;
    },
    bindYoutubeReplyModal(accountId, commentId) {
      const ta = document.querySelector('#yt-reply-text');
      const count = document.querySelector('#yt-reply-count');
      const syncCount = () => {
        if (count && ta) count.textContent = `${String(ta.value || '').trim().length} 字`;
      };
      ta?.addEventListener('input', syncCount);
      syncCount();
      const btn = document.querySelector('#yt-reply-ai-btn');
      if (!btn || btn._bound) return;
      btn._bound = true;
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await this.generateYoutubeCommentReplyDraft(accountId, commentId);
      });
    },
    async generateYoutubeCommentReplyDraft(accountId, commentId) {
      const btn = document.querySelector('#yt-reply-ai-btn');
      const status = document.querySelector('#yt-reply-ai-status');
      const ta = document.querySelector('#yt-reply-text');
      const tpl = document.querySelector('#yt-reply-tpl');
      if (btn) {
        btn.disabled = true;
        btn.textContent = '生成中…';
      }
      if (status) status.textContent = 'AI 正在生成…';
      try {
        const templateId = Number(tpl?.value || 0);
        const pack = await this.api(`/youtube/accounts/${accountId}/comments/${commentId}/ai-reply`, {
          method: 'POST',
          body: JSON.stringify({
            templateId: templateId > 0 ? templateId : undefined,
            templateCode: 'youtube_comment_reply',
          }),
        });
        const reply = String(pack?.reply || '').trim();
        if (!reply) throw new Error('AI 未返回内容');
        if (ta) {
          ta.value = reply;
          ta.dispatchEvent(new Event('input'));
          ta.focus();
        }
        const model = pack?.model ? ` · ${pack.model}` : '';
        if (status) status.textContent = `已生成${model}，可继续编辑`;
        this.toast('已生成回复草稿');
      } catch (e) {
        if (status) status.textContent = '';
        this.toast(e.message || 'AI 生成失败', true);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'AI 生成';
        }
      }
    },
    async loadYoutubeReplyPromptTemplates() {
      try {
        const pack = await this.api('/ai-prompt-templates?category=youtube');
        const items = Array.isArray(pack?.items) ? pack.items : [];
        return items.filter((t) => t.enabled !== false);
      } catch (_) {
        return [];
      }
    },
    async replyYoutubeComment(accountId, commentId) {
      const comment = this.ytFindCommentById(commentId);
      if (!comment) {
        this.toast('评论不存在或已刷新，请重新打开详情', true);
        return;
      }
      const templates = await this.loadYoutubeReplyPromptTemplates();
      const defaultTpl = templates.find((t) => t.code === 'youtube_comment_reply') || templates[0];
      this.modal(
        '回复 YouTube 评论',
        this.youtubeReplyModalHtml(comment, {
          templates,
          templateId: defaultTpl?.id || 0,
        }),
        async (data) => {
          const body = String(data.text || document.querySelector('#yt-reply-text')?.value || '').trim();
          if (!body) throw new Error('回复不能为空');
          await this.api(`/youtube/accounts/${accountId}/comments/${commentId}/reply`, {
            method: 'POST',
            body: JSON.stringify({ text: body }),
          });
          this.toast('已回复');
        },
        false,
        { wide: true, submitText: '发送回复' }
      );
      setTimeout(() => this.bindYoutubeReplyModal(accountId, commentId), 0);
    },
    async deleteYoutubeComment(accountId, commentId) {
      if (!confirm('确认删除该评论？')) return;
      try {
        await this.api(`/youtube/accounts/${accountId}/comments/${commentId}`, { method: 'DELETE' });
        this.toast('已删除评论');
        this.refresh();
      } catch (e) {
        this.toast(e.message, true);
      }
    },
    async addYoutubeAccount() {
      if (!(typeof this.canUseYouTube === 'function' && this.canUseYouTube())) { this.toast('无权操作', true); return; }
      const formHtml = await this.youtubeAccountFormHtml();
      this.modal('添加 YouTube 账号', formHtml, async (data) => {
        const companyId = data.companyId === '' || data.companyId == null ? '' : data.companyId;
        await this.api('/youtube/accounts', {
          method: 'POST',
          body: JSON.stringify({
            username: data.username || '',
            nickname: data.nickname || '',
            notes: data.notes || '',
            companyId,
          }),
        });
        this.closeModal();
        this.toast('已添加，请在「…」中点「授权登录」');
        this.refresh();
      });
    },
    async editYoutubeAccount(id) {
      if (!(typeof this.canUseYouTube === 'function' && this.canUseYouTube())) { this.toast('无权操作', true); return; }
      const row = (this._ytAccItems || []).find((x) => Number(x.id) === Number(id));
      if (!row) { this.toast('未找到账号，请刷新后重试', true); return; }
      const formHtml = await this.youtubeAccountFormHtml(row);
      this.modal('编辑 YouTube 账号 #' + id, formHtml, async (data) => {
        await this.api('/youtube/accounts/' + id, {
          method: 'PUT',
          body: JSON.stringify({
            username: data.username || '',
            nickname: data.nickname || '',
            notes: data.notes || '',
            companyId: data.companyId === '' || data.companyId == null ? '' : data.companyId,
          }),
        });
        this.closeModal();
        this.toast('已保存');
        this.refresh();
      });
    },
    async startYoutubeAuth(id) {
      if (!(typeof this.canUseYouTube === 'function' && this.canUseYouTube())) { this.toast('无权操作', true); return; }
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
