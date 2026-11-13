(function () {
  if (!window.app) throw new Error('app-core must load before pages/accountWizard.js');

  const ITEM_STATUS = {
    pending: { label: '待执行', tone: 'muted' },
    running: { label: '执行中', tone: 'online' },
    success: { label: '成功', tone: 'success' },
    failed: { label: '失败', tone: 'error' },
    paused: { label: '已暂停', tone: 'warn' },
    cancelled: { label: '已取消', tone: 'warn' },
    skipped: { label: '已跳过', tone: 'muted' },
  };

  const KIND_META = {
    pull_stats: {
      kicker: '账号数据',
      title: '拉取数据',
      desc: '从 TikTok Studio / 个人页抓取粉丝、赞与视频等账号指标，写入本地并挂到账号总任务。',
      createLabel: '创建拉取任务',
      emptyTitle: '还没有拉取数据任务',
      emptyHint: '选择账号后创建任务，由本机浏览器执行器拉取 Studio 数据。',
      taskType: 'pull_stats',
    },
    modify_profile: {
      kicker: '账号资料',
      title: '修改资料',
      desc: '批量或单账号修改 Username / 昵称 / 签名 / 头像，保存后写入系统并入队浏览器提交。',
      createLabel: '创建修改资料',
      emptyTitle: '还没有修改资料任务',
      emptyHint: '选择账号并填写要改的资料项，系统会创建分任务由本机浏览器逐项提交。',
      taskType: 'modify_profile',
    },
    account_videos: {
      kicker: '账号内容',
      title: '账号视频',
      desc: '查看「拉取视频列表」同步到本账号的线上视频，支持详情与截图记录。',
      createLabel: '',
      emptyTitle: '还没有视频',
      emptyHint: '请先在 AI 矩阵中对该账号执行「拉取视频列表」。',
      taskType: '',
    },
  };

  const __methods = {
    // 拉取数据 / 修改资料：菜单 public，全角色可查看与创建（与拉取视频列表一致）
    canAccountWizardView() {
      return true;
    },
    canAccountWizardCreate() {
      return true;
    },
    awItemStatusBadge(status) {
      const st = String(status || 'pending');
      const m = ITEM_STATUS[st] || { label: st, tone: 'muted' };
      return `<span class="badge ${m.tone}">${this.esc(m.label)}</span>`;
    },
    awKind() {
      const sv = String(this.subview || this.accountWizardKind || '');
      if (sv === 'modify_profile' || sv === 'create_modify_profile' || sv.startsWith('edit_modify_profile')) {
        return 'modify_profile';
      }
      if (sv === 'account_videos' || sv === 'account-videos' || sv === 'videos') {
        return 'account_videos';
      }
      const k = String(this.accountWizardKind || 'pull_stats');
      if (k === 'modify_profile') return 'modify_profile';
      if (k === 'account_videos') return 'account_videos';
      return 'pull_stats';
    },
    awMeta() {
      return KIND_META[this.awKind()] || KIND_META.pull_stats;
    },
    syncAccountWizardFromSubview(subview) {
      const sv = String(subview != null ? subview : (this.subview || ''));
      if (sv === 'modify_profile' || sv === 'create_modify_profile' || sv.startsWith('edit_modify_profile')) {
        this.accountWizardKind = 'modify_profile';
        if (sv === 'create_modify_profile') {
          this.accountWizardPane = 'create';
          this.accountWizardEditId = null;
        } else if (sv.startsWith('edit_modify_profile')) {
          const id = Number(sv.replace(/^edit_modify_profile\/?/, '') || 0) || null;
          this.accountWizardPane = 'edit';
          this.accountWizardEditId = id;
        } else {
          this.accountWizardPane = 'list';
          this.accountWizardEditId = null;
          this._awDraft = null;
        }
        return;
      }
      if (sv === 'account_videos' || sv === 'account-videos' || sv === 'videos') {
        this.accountWizardKind = 'account_videos';
        this.accountWizardPane = 'videos';
        this.accountWizardEditId = null;
        this._awDraft = null;
        return;
      }
      if (sv === 'create_pull_stats' || sv === 'create') {
        this.accountWizardKind = 'pull_stats';
        this.accountWizardPane = 'create';
        this.accountWizardEditId = null;
        if (!this._awDraft) {
          this._awDraft = { accountIds: [], browserBackend: this.defaultTaskBrowserBackend?.() || 'tkswarm', saveTraffic: true };
        }
        return;
      }
      this.accountWizardKind = 'pull_stats';
      this.accountWizardPane = 'list';
      this.accountWizardEditId = null;
      this._awDraft = null;
    },
    async renderAccountWizard(opts = {}) {
      if (!this.canView('accountWizard') && !this.canAccountWizardView()) {
        return this.renderPageDenied('当前角色无权查看账号向导');
      }
      document.querySelector('#content')?.classList.remove('chat-mode');
      // 以 hash/subview 为准，避免同 view 切叶子时仍停在「拉取数据」
      this.syncAccountWizardFromSubview(this.subview);
      if (this.accountWizardRefreshTimer) {
        clearInterval(this.accountWizardRefreshTimer);
        this.accountWizardRefreshTimer = null;
      }
      const pane = this.accountWizardPane || 'list';
      if (pane === 'videos' || this.awKind() === 'account_videos') {
        return this.renderAccountVideosPage(opts);
      }
      if (pane === 'create' || pane === 'edit') {
        return this.awKind() === 'modify_profile'
          ? this.renderModifyProfileWizard()
          : this.renderPullStatsWizard();
      }
      return this.renderAccountWizardList(opts);
    },
    openPullStatsWizard() {
      if (!this.canAccountWizardCreate()) {
        this.toast('当前角色无权创建拉取任务', true);
        return;
      }
      this.accountWizardKind = 'pull_stats';
      this.accountWizardPane = 'create';
      this.accountWizardEditId = null;
      this._awDraft = { accountIds: [], browserBackend: this.defaultTaskBrowserBackend?.() || 'tkswarm', saveTraffic: true };
      this.navigate('accountWizard', 'create_pull_stats');
    },
    openModifyProfileWizard(editItem) {
      if (!this.canAccountWizardCreate()) {
        this.toast('当前角色无权创建修改资料任务', true);
        return;
      }
      this.accountWizardKind = 'modify_profile';
      this.accountWizardPane = editItem ? 'edit' : 'create';
      this.accountWizardEditId = editItem ? Number(editItem.id) || null : null;
      const p = editItem?.payload || {};
      this._awDraft = {
        accountIds: editItem?.accountId ? [Number(editItem.accountId)] : [],
        username: String(p.username || '').replace(/^@+/, ''),
        nickname: String(p.nickname || ''),
        signature: String(p.signature || p.bio || ''),
        avatarUrl: String(p.avatarUrl || p.avatarPath || ''),
        browserBackend: this.defaultTaskBrowserBackend?.() || 'tkswarm',
        saveTraffic: p.saveTraffic !== false && p.saveTraffic !== 0 && p.saveTraffic !== 'false',
        editBatchId: editItem ? Number(editItem.batchId || editItem.batch_id || 0) : 0,
      };
      this.navigate('accountWizard', editItem ? `edit_modify_profile/${editItem.id}` : 'create_modify_profile');
    },
    closeAccountWizardForm() {
      const kind = this.awKind();
      this.accountWizardPane = kind === 'account_videos' ? 'videos' : 'list';
      this.accountWizardEditId = null;
      this._awDraft = null;
      const leaf = kind === 'modify_profile'
        ? 'modify_profile'
        : (kind === 'account_videos' ? 'account_videos' : 'pull_stats');
      this.navigate('accountWizard', leaf);
    },
    async renderAccountWizardList(opts = {}) {
      const still = typeof opts.still === 'function' ? opts.still : () => this.view === 'accountWizard';
      const meta = this.awMeta();
      const kind = this.awKind();
      const page = this.accountWizardPage || 1;
      const keyword = String(this.accountWizardKeyword || '').trim();
      const status = String(this.accountWizardStatus || '').trim();
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: '15',
        taskType: meta.taskType,
      });
      if (keyword) qs.set('keyword', keyword);
      if (status) qs.set('status', status);
      const pack = await this.api(`/account-work-items?${qs}`).catch(() => ({ items: [], total: 0, page: 1, pages: 1 }));
      if (!still()) return;
      const rows = pack.items || pack.list || [];
      this._awItemsCache = rows;
      this.accountWizardPage = pack.page || page;
      const statusOpts = [
        ['', '全部状态'],
        ['pending', '待执行'],
        ['running', '执行中'],
        ['success', '成功'],
        ['failed', '失败'],
        ['paused', '已暂停'],
        ['cancelled', '已取消'],
      ];
      const cards = rows.map((x) => this.awItemCardHtml(x, kind)).join('');
      const html = `<div class="panel pull-comments-panel aw-wizard-panel">
        <div class="pc-hero" style="margin-bottom:16px;border:1px solid var(--border,#e2e8f0);border-radius:12px;padding:16px 18px;background:linear-gradient(135deg,#f8fafc 0%,#eef6ff 100%)">
          <div>
            <div class="pc-kicker">${this.esc(meta.kicker)}</div>
            <h2>${this.esc(meta.title)}</h2>
            <p>${this.esc(meta.desc)}</p>
          </div>
          <div class="pc-hero-actions">
            ${this.canAccountWizardCreate() ? `<button class="primary" type="button" onclick="app.${kind === 'modify_profile' ? 'openModifyProfileWizard()' : 'openPullStatsWizard()'}">${this.esc(meta.createLabel)}</button>` : ''}
            <button class="ghost" type="button" onclick="app.refresh()">刷新</button>
          </div>
        </div>
        <div class="pc-toolbar">
          <select id="aw-status-filter" class="input" onchange="app.accountWizardStatus=this.value;app.accountWizardPage=1;app.refresh()">
            ${statusOpts.map(([v, n]) => `<option value="${this.esc(v)}" ${status === v ? 'selected' : ''}>${this.esc(n)}</option>`).join('')}
          </select>
          <input id="aw-keyword-filter" class="input" type="search" placeholder="搜索账号、分任务 ID 或总任务 ID" value="${this.esc(keyword)}"
            onkeydown="if(event.key==='Enter'){app.accountWizardKeyword=this.value;app.accountWizardPage=1;app.refresh()}">
          <button class="primary" type="button" onclick="app.accountWizardKeyword=document.querySelector('#aw-keyword-filter')?.value||'';app.accountWizardPage=1;app.refresh()">搜索</button>
          <span class="muted pc-count">共 ${Number(pack.total || rows.length)} 条</span>
        </div>
        ${rows.length ? `<div class="pc-card-grid">${cards}</div>` : `<div class="pc-empty"><b>${this.esc(meta.emptyTitle)}</b><span>${this.esc(meta.emptyHint)}</span></div>`}
        ${UI.pager(pack, 'accountWizardPage')}
      </div>`;
      document.querySelector('#content').innerHTML = html;
      if (rows.some((x) => ['pending', 'running'].includes(String(x.status || '')))) {
        this.accountWizardRefreshTimer = setInterval(() => {
          if (this.view === 'accountWizard' && this.accountWizardPane === 'list') this.renderAccountWizard({ soft: true });
          else clearInterval(this.accountWizardRefreshTimer);
        }, 4000);
      }
    },
    awItemCardHtml(x, kind) {
      const id = Number(x.id || 0);
      const batchId = Number(x.batchId || x.batch_id || 0);
      const accountId = Number(x.accountId || x.account_id || 0);
      const user = String(x.accountUsername || x.username || accountId || '-').replace(/^@+/, '');
      const nick = x.accountNickname ? ` · ${this.esc(x.accountNickname)}` : '';
      const err = String(x.errorMessage || x.error_message || '').trim();
      const payload = x.payload || {};
      let metrics = '';
      if (kind === 'modify_profile') {
        const bits = [];
        if (payload.username) bits.push(`用户名 ${this.esc(String(payload.username).replace(/^@+/, ''))}`);
        if (payload.nickname) bits.push(`昵称 ${this.esc(payload.nickname)}`);
        if (payload.signature || payload.bio) bits.push('签名');
        if (payload.avatarUrl || payload.avatarPath) bits.push('头像');
        metrics = `<div class="pc-card-metrics"><div class="full"><small>变更项</small><b>${bits.length ? bits.join(' · ') : '重推资料'}</b></div></div>`;
      } else {
        metrics = `<div class="pc-card-metrics">
          <div><small>总任务</small><b>#${batchId || '-'}</b></div>
          <div><small>账号</small><b>#${accountId || '-'}</b></div>
          <div><small>来源</small><b>${this.esc(payload.source || 'manual')}</b></div>
        </div>`;
      }
      const canEdit = kind === 'modify_profile' && ['pending', 'failed', 'paused', 'cancelled'].includes(String(x.status || ''));
      const canPause = ['pending', 'running'].includes(String(x.status || ''));
      const canReset = ['failed', 'paused', 'cancelled', 'success'].includes(String(x.status || ''));
      return `<article class="pc-card">
        <header class="pc-card-head">
          <div class="pc-card-title">
            <span class="pc-card-id">#${id}</span>
            <b>@${this.esc(user)}</b>
          </div>
          ${this.awItemStatusBadge(x.status)}
        </header>
        <div class="pc-card-account">账号 #${accountId}${nick} · 总任务 #${batchId || '-'}</div>
        ${metrics}
        <footer class="pc-card-foot">
          <span class="muted">${this.esc(x.createdAt || x.created_at || '-')}</span>
          <div class="pc-card-ops">
            ${canEdit ? `<button class="tiny" type="button" onclick="app.editAwModifyProfileItem(${id})">编辑</button>` : ''}
            ${canPause && batchId ? `<button class="tiny" type="button" onclick="app.awPauseItem(${batchId},${id})">暂停</button>` : ''}
            ${canReset && batchId ? `<button class="tiny" type="button" onclick="app.awResetItem(${batchId},${id})">重置</button>` : ''}
            ${batchId ? `<button class="tiny ghost" type="button" onclick="app.awOpenLogs(${batchId},${id})">日志</button>` : ''}
          </div>
        </footer>
        ${err ? `<div class="pc-card-error">${this.esc(err)}</div>` : ''}
      </article>`;
    },
    editAwModifyProfileItem(id) {
      const item = (this._awItemsCache || []).find((x) => Number(x.id) === Number(id));
      if (!item) { this.toast('任务不存在或已刷新，请重试', true); return; }
      this.openModifyProfileWizard({
        id: Number(item.id),
        accountId: Number(item.accountId || item.account_id || 0),
        batchId: Number(item.batchId || item.batch_id || 0),
        payload: item.payload || {},
        status: item.status,
      });
    },
    async awPauseItem(batchId, itemId) {
      try {
        await this.api(`/account-work-batches/${batchId}/items/${itemId}/pause`, { method: 'POST', body: '{}' });
        this.toast('已暂停');
        this.refresh();
      } catch (e) { this.toast(e.message, true); }
    },
    async awResetItem(batchId, itemId) {
      if (!(await this.ask(`重置分任务 #${itemId} 为待执行？`))) return;
      try {
        await this.api(`/account-work-batches/${batchId}/items/${itemId}/reset`, { method: 'POST', body: '{}' });
        this.toast('已重置');
        this.refresh();
      } catch (e) { this.toast(e.message, true); }
    },
    async awOpenLogs(batchId, itemId) {
      if (typeof this.openAccountWorkItemLogs === 'function') {
        return this.openAccountWorkItemLogs(batchId, itemId);
      }
      try {
        const pack = await this.api(`/account-work-batches/${batchId}/items/${itemId}/logs?limit=200`);
        const rows = pack.items || [];
        const body = rows.length
          ? `<div class="table-container"><table><thead><tr><th>时间</th><th>级别</th><th>内容</th></tr></thead><tbody>${
            rows.map((l) => `<tr><td>${this.esc(l.created_at || l.createdAt || '-')}</td><td>${this.esc(l.level || '-')}</td><td>${this.esc(l.message || '')}</td></tr>`).join('')
          }</tbody></table></div>`
          : '<div class="empty">暂无执行日志</div>';
        this.modal(`分任务日志 #${itemId}`, body, async () => {}, false, { hideSubmit: true, wide: true });
      } catch (e) { this.toast(e.message, true); }
    },
    async renderPullStatsWizard() {
      const w = this._awDraft || { accountIds: [] };
      this._awDraft = w;
      const html = `<div class="wizard pull-video-list-wizard">
        <div class="pc-hero pc-hero-form">
          <div>
            <div class="pc-kicker">账号数据</div>
            <h2>创建拉取数据</h2>
            <p>勾选一个或多个账号，每个账号创建 1 条「拉取数据」分任务，由本机执行器打开 Studio 拉取指标。</p>
          </div>
          <button class="ghost" type="button" onclick="app.closeAccountWizardForm()">返回列表</button>
        </div>
        <div class="pc-form-layout">
          <aside class="pc-form-side">
            <div class="pc-side-block">
              <div class="pc-side-label">执行通道</div>
              ${this.selectBrowserBackendField?.('browserBackend', w.browserBackend || this.defaultTaskBrowserBackend?.() || 'tkswarm') || ''}
              ${typeof this.saveTrafficField === 'function' ? this.saveTrafficField(w.saveTraffic, true) : ''}
            </div>
            <div class="pc-side-block">
              <div class="pc-side-label">已选账号</div>
              <div class="pc-selected-num" id="aw-acc-count">${(w.accountIds || []).length}</div>
              <p class="muted">每个账号独立入队，互不影响。</p>
            </div>
          </aside>
          <section class="pc-form-main">
            <div class="field full">
              <label>选择账号</label>
              ${this.accountPickToolbarHtml('aw-pull-accounts', {
                batchHtml: `<button type="button" class="tiny" onclick="app.setAccountPickAll('aw-pull-accounts',true);app.syncAwAccountCount('aw-pull-accounts')">全选</button><button type="button" class="tiny" onclick="app.setAccountPickAll('aw-pull-accounts',false);app.syncAwAccountCount('aw-pull-accounts')">清空</button>`,
              })}
              <div id="aw-pull-accounts" class="account-pick-grid"></div>
            </div>
          </section>
        </div>
        <div class="pc-form-foot">
          <button class="ghost" type="button" onclick="app.closeAccountWizardForm()">取消</button>
          <button class="primary" type="button" onclick="app.submitPullStatsWizard()">创建并入队</button>
        </div>
      </div>`;
      document.querySelector('#content').innerHTML = html;
      await this.reloadAccountPick('aw-pull-accounts', { selectedIds: w.accountIds || [] });
      const box = document.querySelector('#aw-pull-accounts');
      if (box && !box._awBound) {
        box._awBound = true;
        box.addEventListener('change', () => this.syncAwAccountCount('aw-pull-accounts'));
      }
      this.syncAwAccountCount('aw-pull-accounts');
    },
    syncAwAccountCount(boxId) {
      const ids = this.selectedAccountPickIds?.(boxId) || [];
      if (this._awDraft) this._awDraft.accountIds = ids;
      const el = document.querySelector('#aw-acc-count');
      if (el) el.textContent = String(ids.length);
    },
    async submitPullStatsWizard() {
      const w = this._awDraft;
      if (!w || w.submitting) return;
      this.syncAwAccountCount('aw-pull-accounts');
      const accountIds = (w.accountIds || []).map(Number).filter(Boolean);
      if (!accountIds.length) { this.toast('请至少选择 1 个账号', true); return; }
      const be = this.normalizeTaskBackend?.(document.querySelector('[name=browserBackend]')?.value || w.browserBackend) || w.browserBackend;
      w.browserBackend = be;
      w.saveTraffic = typeof this.parseSaveTrafficInput === 'function'
        ? this.parseSaveTrafficInput(document.querySelector('[name=saveTraffic]')?.value, true)
        : false;
      if (!(await this.ask(`确认为 ${accountIds.length} 个账号创建「拉取数据」任务？`))) return;
      if (typeof this.ensureBrowserBackendOnline === 'function') {
        if (!(await this.ensureBrowserBackendOnline(be, '拉取数据'))) return;
      } else if (typeof this.ensureBitOnline === 'function') {
        if (!(await this.ensureBitOnline('拉取数据'))) return;
      }
      w.submitting = true;
      try {
        let ok = 0; let fail = 0;
        for (const accountId of accountIds) {
          try {
            await this.api('/account-wizard/enqueue', {
              method: 'POST',
              body: JSON.stringify({
                accountId,
                taskType: 'pull_stats',
                payload: { source: 'account_wizard', browserBackend: be, accountId, saveTraffic: !!w.saveTraffic },
              }),
            });
            ok += 1;
          } catch (e) {
            fail += 1;
            this.toast(`账号 #${accountId} 入队失败：${e.message}`, true);
          }
        }
        if (ok) this.toast(`已为 ${ok} 个账号创建拉取任务${fail ? `，失败 ${fail}` : ''}`);
        this.closeAccountWizardForm();
      } finally {
        if (this._awDraft) this._awDraft.submitting = false;
      }
    },
    async renderModifyProfileWizard() {
      let w = this._awDraft;
      if (!w) {
        w = { accountIds: [], browserBackend: this.defaultTaskBrowserBackend?.() || 'tkswarm' };
        this._awDraft = w;
      }
      const editing = !!this.accountWizardEditId;
      if (editing && !(w.accountIds || []).length) {
        const cached = (this._awItemsCache || []).find((x) => Number(x.id) === Number(this.accountWizardEditId));
        if (cached) {
          w.accountIds = [Number(cached.accountId || cached.account_id || 0)].filter(Boolean);
          w.editBatchId = Number(cached.batchId || cached.batch_id || 0);
          const p = cached.payload || {};
          w.username = String(p.username || '').replace(/^@+/, '');
          w.nickname = String(p.nickname || '');
          w.signature = String(p.signature || p.bio || '');
          w.avatarUrl = String(p.avatarUrl || p.avatarPath || '');
        } else {
          try {
            const pack = await this.api(`/account-work-items?taskType=modify_profile&page=1&pageSize=50&keyword=${this.accountWizardEditId}`);
            const hit = (pack.items || []).find((x) => Number(x.id) === Number(this.accountWizardEditId));
            if (hit) {
              w.accountIds = [Number(hit.accountId || hit.account_id || 0)].filter(Boolean);
              w.editBatchId = Number(hit.batchId || hit.batch_id || 0);
              const p = hit.payload || {};
              w.username = String(p.username || '').replace(/^@+/, '');
              w.nickname = String(p.nickname || '');
              w.signature = String(p.signature || p.bio || '');
              w.avatarUrl = String(p.avatarUrl || p.avatarPath || '');
            }
          } catch { /* ignore */ }
        }
      }
      let nickDisabled = false;
      let nickHint = '';
      let nickChangedAt = '-';
      let prevUsername = String(w.username || '');
      let prevName = String(w.nickname || '');
      let prevBio = String(w.signature || '');
      let prevAvatar = String(w.avatarUrl || '');
      const singleId = (w.accountIds || [])[0];
      if (singleId && (editing || (w.accountIds || []).length === 1)) {
        try {
          const acc = await this.api(`/accounts/${singleId}`) || {};
          prevUsername = prevUsername || String(acc.username || '').replace(/^@+/, '');
          prevName = w.nickname != null && w.nickname !== '' ? prevName : String(acc.nickname || '');
          prevBio = w.signature != null && w.signature !== '' ? prevBio : String(acc.profile_bio || acc.profileBio || '');
          prevAvatar = w.avatarUrl || String(acc.profile_avatar || acc.profileAvatar || '');
          const cool = this.nicknameCooldownInfo?.(acc.nickname_changed_at || acc.nicknameChangedAt) || { locked: false, hint: '' };
          nickDisabled = !!cool.locked;
          nickHint = cool.hint || '';
          nickChangedAt = this.fmtProfileTime?.(acc.nickname_changed_at || acc.nicknameChangedAt) || '-';
          w._prevUsername = prevUsername;
          w._prevName = String(acc.nickname || '');
          w._prevBio = String(acc.profile_bio || acc.profileBio || '');
          w._prevAvatar = String(acc.profile_avatar || acc.profileAvatar || '');
          w._nickDisabled = nickDisabled;
        } catch { /* ignore */ }
      }
      const bioLen = Array.from(prevBio).length;
      const nickField = nickDisabled
        ? `<div class="field"><label>昵称 Name（可选）</label>
            <input class="input" name="nickname" type="text" value="${this.esc(prevName)}" disabled readonly style="background:#f0f2f5;color:#a8abb2;cursor:not-allowed">
            <div class="muted" style="margin-top:6px;color:#c0392b">${this.esc(nickHint)}</div>
            <div class="muted" style="margin-top:4px">上次修改成功：${this.esc(nickChangedAt)}</div>
          </div>`
        : this.field('nickname', '昵称 Name（可选）', prevName);
      const html = `<div class="wizard pull-comment-wizard">
        <div class="pc-hero pc-hero-form">
          <div>
            <div class="pc-kicker">${editing ? '编辑分任务' : '新建任务'}</div>
            <h2>${editing ? `编辑修改资料 #${this.accountWizardEditId}` : '创建修改资料'}</h2>
            <p>${editing ? '保存后重新入队该账号的修改资料任务。' : '可多选账号批量写入相同资料；昵称受 TikTok 7 天冷却限制。'}</p>
          </div>
          <button class="ghost" type="button" onclick="app.closeAccountWizardForm()">返回列表</button>
        </div>
        <div class="pc-form-layout">
          <aside class="pc-form-side">
            <div class="pc-side-block">
              <div class="pc-side-label">已选账号</div>
              <div class="pc-selected-num" id="aw-acc-count">${(w.accountIds || []).length}</div>
              <p class="muted">${editing ? '编辑模式仅处理原账号。' : '多账号时共用下方表单内容。'}</p>
            </div>
            <div class="pc-side-block">
              <div class="pc-side-label">省流</div>
              ${typeof this.saveTrafficField === 'function' ? this.saveTrafficField(w.saveTraffic, true) : ''}
            </div>
            <div class="pc-side-block">
              <div class="pc-side-label">说明</div>
              <p class="muted" style="font-size:12px;line-height:1.5">保存会先写入系统资料设置，再创建「修改资料」分任务；Username 被占用时自动恢复原名。</p>
            </div>
          </aside>
          <section class="pc-form-main">
            ${editing ? '' : `<div class="field full">
              <label>选择账号</label>
              ${this.accountPickToolbarHtml('aw-profile-accounts', {
                batchHtml: `<button type="button" class="tiny" onclick="app.setAccountPickAll('aw-profile-accounts',true);app.syncAwAccountCount('aw-profile-accounts')">全选</button><button type="button" class="tiny" onclick="app.setAccountPickAll('aw-profile-accounts',false);app.syncAwAccountCount('aw-profile-accounts')">清空</button>`,
              })}
              <div id="aw-profile-accounts" class="account-pick-grid"></div>
            </div>`}
            <div class="form-grid" style="margin-top:12px">
              ${this.field('username', '账号名称 Username（可选）', prevUsername)}
              ${nickField}
              <div class="field full">
                <label>签名 Bio（可选）</label>
                <div class="muted field-hint" style="display:block;margin:0 0 6px">不得超过 80 个字符</div>
                <textarea class="input" name="signature" id="aw-profile-bio" rows="3" maxlength="80">${this.esc(prevBio)}</textarea>
                <div class="muted" id="aw-profile-bio-count" style="margin-top:6px;text-align:right">${bioLen}/80</div>
              </div>
              ${this.imageField('avatarUrl', '头像（可选）', prevAvatar, false, {
                allowVideo: false,
                minImage: 20,
                accept: 'image/jpeg,image/jpg,image/png,.jpg,.jpeg,.png',
                pickLabel: '选择图片',
                dropText: '拖拽 JPG/PNG 到此处，或使用按钮选择。',
                hint: '建议比例 1:1（最低 20×20px），仅支持 JPG / PNG',
              })}
            </div>
          </section>
        </div>
        <div class="pc-form-foot">
          <button class="ghost" type="button" onclick="app.closeAccountWizardForm()">取消</button>
          <button class="primary" type="button" onclick="app.submitModifyProfileWizard()">${editing ? '保存并重新入队' : '创建并入队'}</button>
        </div>
      </div>`;
      document.querySelector('#content').innerHTML = html;
      if (!editing) {
        await this.reloadAccountPick('aw-profile-accounts', { selectedIds: w.accountIds || [] });
        const box = document.querySelector('#aw-profile-accounts');
        if (box && !box._awBound) {
          box._awBound = true;
          box.addEventListener('change', () => this.syncAwAccountCount('aw-profile-accounts'));
        }
        this.syncAwAccountCount('aw-profile-accounts');
      }
      const bioInput = document.querySelector('#aw-profile-bio');
      const bioCount = document.querySelector('#aw-profile-bio-count');
      if (bioInput && bioCount) {
        const sync = () => {
          const n = Array.from(String(bioInput.value || '')).length;
          bioCount.textContent = `${n}/80`;
          bioCount.style.color = n > 80 ? '#dc2626' : '';
        };
        bioInput.addEventListener('input', sync);
        sync();
      }
      if (window.UI) UI.decorate(document.querySelector('#content'));
    },
    async submitModifyProfileWizard() {
      const w = this._awDraft;
      if (!w || w.submitting) return;
      if (!this.accountWizardEditId) this.syncAwAccountCount('aw-profile-accounts');
      const accountIds = (w.accountIds || []).map(Number).filter(Boolean);
      if (!accountIds.length) { this.toast('请至少选择 1 个账号', true); return; }
      const username = String(document.querySelector('[name=username]')?.value || '').replace(/^@+/, '').trim();
      const nicknameEl = document.querySelector('[name=nickname]');
      const nickname = nicknameEl && !nicknameEl.disabled ? String(nicknameEl.value || '').trim() : '';
      const signature = String(document.querySelector('[name=signature]')?.value || document.querySelector('#aw-profile-bio')?.value || '').trim();
      if (Array.from(signature).length > 80) { this.toast('签名 Bio 不得超过 80 个字符', true); return; }
      const avatarUrl = String(document.querySelector('[name=avatarUrl]')?.value || '').split(',').map((s) => s.trim()).filter(Boolean)[0] || '';
      if (!username && !nickname && !signature && !avatarUrl) {
        this.toast('请至少填写一项资料', true);
        return;
      }
      if (!(await this.ask(`确认为 ${accountIds.length} 个账号${this.accountWizardEditId ? '重新入队' : '创建'}「修改资料」任务？`))) return;
      if (typeof this.ensureBitOnline === 'function' && !(await this.ensureBitOnline('修改资料'))) return;
      w.submitting = true;
      try {
        let ok = 0; let fail = 0;
        for (const accountId of accountIds) {
          try {
            let acc = {};
            try { acc = await this.api(`/accounts/${accountId}`) || {}; } catch { /* ignore */ }
            const prevUsername = String(acc.username || '').replace(/^@+/, '').trim();
            const prevName = String(acc.nickname || '').trim();
            const nextUsername = username || prevUsername;
            const cool = this.nicknameCooldownInfo?.(acc.nickname_changed_at || acc.nicknameChangedAt) || { locked: false };
            const nickDisabled = !!cool.locked;
            const body = { signature, avatarUrl };
            if (nextUsername) body.username = nextUsername;
            if (nickname && !nickDisabled) body.nickname = nickname;
            const saveTraffic = typeof this.parseSaveTrafficInput === 'function'
              ? this.parseSaveTrafficInput(document.querySelector('[name=saveTraffic]')?.value, true)
              : false;
            const payload = {
              username: nextUsername,
              originalUsername: prevUsername,
              nickname: nickDisabled ? '' : nickname,
              originalNickname: prevName,
              signature,
              avatarUrl,
              avatarPath: avatarUrl,
              source: 'account_wizard',
              applyProfileSettings: true,
              profileSettings: body,
              saveTraffic: !!saveTraffic,
            };
            if (nickDisabled) payload.skipNickname = true;
            if (this.accountWizardEditId && w.editBatchId) {
              try {
                await this.api(`/account-work-batches/${w.editBatchId}/items/${this.accountWizardEditId}/pause`, { method: 'POST', body: '{}' });
              } catch { /* ignore */ }
            }
            // 全角色入队（含系统资料写入），不走 account.work 写权限
            await this.api('/account-wizard/enqueue', {
              method: 'POST',
              body: JSON.stringify({ accountId, taskType: 'modify_profile', payload }),
            });
            ok += 1;
          } catch (e) {
            fail += 1;
            this.toast(`账号 #${accountId} 失败：${e.message}`, true);
          }
        }
        if (ok) this.toast(`已为 ${ok} 个账号入队修改资料${fail ? `，失败 ${fail}` : ''}`);
        this.closeAccountWizardForm();
      } finally {
        if (this._awDraft) this._awDraft.submitting = false;
      }
    },

    // ─── 账号视频 ───────────────────────────────────────────────
    avFmtCount(n) {
      const v = Number(n) || 0;
      if (v >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
      if (v >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
      return String(v);
    },
    async ensureAvAccountOptions(force = false) {
      if (!force && Array.isArray(this._avAccountOptions) && this._avAccountOptions.length) {
        return this._avAccountOptions;
      }
      // /accounts 单页最多 200：必须分页拉全，否则下拉账号不全
      let items = [];
      if (typeof this.loadAccountsForPicker === 'function') {
        items = await this.loadAccountsForPicker({ pageSize: 200 }).catch(() => []);
      } else {
        const pack = await this.api('/accounts?page=1&pageSize=200').catch(() => ({ items: [] }));
        items = pack.items || pack.list || [];
      }
      this._avAccountOptions = (items || []).map((a) => ({
        id: Number(a.id),
        username: String(a.username || '').replace(/^@+/, ''),
        nickname: String(a.nickname || ''),
        groupName: String(a.group_name || a.groupName || ''),
        accountType: String(a.account_type || a.accountType || 'main'),
      })).filter((a) => a.id > 0);
      return this._avAccountOptions;
    },
    async renderAccountVideosPage(opts = {}) {
      const still = typeof opts.still === 'function' ? opts.still : () => this.view === 'accountWizard' && this.awKind() === 'account_videos';
      const meta = this.awMeta();
      // soft 刷新可复用缓存；手动刷新 / 首次进入强制重拉
      const allAvAccounts = await this.ensureAvAccountOptions(!opts.soft).catch(() => []);
      if (!still()) return;
      const avType = String(this.accountVideosType || '');
      const accounts = avType ? allAvAccounts.filter((a) => a.accountType === avType) : allAvAccounts;

      let accountId = Number(this.accountVideosAccountId || 0);
      if (accountId && avType && !accounts.some((a) => a.id === accountId)) accountId = 0;
      if (!accountId && accounts.length) {
        accountId = Number(accounts[0].id);
        this.accountVideosAccountId = accountId;
      }
      const page = Math.max(1, Number(this.accountVideosPage || 1));
      const keyword = String(this.accountVideosKeyword || '').trim();

      let pack = { items: [], total: 0, page: 1, pages: 1, username: '', nickname: '' };
      if (accountId > 0) {
        const qs = new URLSearchParams({ page: String(page), pageSize: '24' });
        if (keyword) qs.set('keyword', keyword);
        pack = await this.api(`/accounts/${accountId}/online-videos?${qs}`).catch((e) => {
          this.toast(e.message || '加载视频失败', true);
          return { items: [], total: 0, page: 1, pages: 1 };
        });
        if (!still()) return;
      }
      const rows = pack.items || [];
      this._avVideosCache = rows;
      this.accountVideosPage = Number(pack.page || page);
      const accLabel = pack.username
        ? `@${pack.username}${pack.nickname ? ' · ' + pack.nickname : ''}`
        : (accounts.find((a) => a.id === accountId)
          ? `@${accounts.find((a) => a.id === accountId).username}`
          : '未选择账号');

      const cards = rows.map((v) => this.avVideoCardHtml(v, accountId)).join('');
      const accOpts = accounts.map((a) => {
        const bits = [`@${a.username || a.id}`];
        if (a.nickname) bits.push(a.nickname);
        if (a.groupName) bits.push(a.groupName);
        bits.push(`#${a.id}`);
        return `<option value="${a.id}" ${a.id === accountId ? 'selected' : ''}>${this.esc(bits.join(' · '))}</option>`;
      }).join('');

      const html = `<div class="panel av-panel">
        <div class="av-hero">
          <div>
            <div class="av-kicker">${this.esc(meta.kicker)}</div>
            <h2>${this.esc(meta.title)}</h2>
            <p>${this.esc(meta.desc)}</p>
          </div>
          <button class="ghost" type="button" onclick="app.refresh()">刷新</button>
        </div>
        <div class="av-toolbar">
          <div class="av-field">
            <label>账号类型</label>
            ${this.accountTypeFilterSelectHtml('av-account-type', avType, 'onchange="app.accountVideosType=this.value;app.accountVideosAccountId=0;app.accountVideosPage=1;app.refresh()"')}
          </div>
          <div class="av-field">
            <label>选择账号（共 ${accounts.length} 个）</label>
            <select id="av-account-select" class="input" onchange="app.onAvAccountChange(this.value)">
              <option value="">请选择账号</option>
              ${accOpts}
            </select>
          </div>
          <div class="av-field av-grow">
            <label>搜索</label>
            <div class="av-search-row">
              <input id="av-keyword" class="input" type="search" placeholder="标题 / 视频 ID / 链接"
                value="${this.esc(keyword)}"
                onkeydown="if(event.key==='Enter'){app.accountVideosKeyword=this.value;app.accountVideosPage=1;app.refresh()}">
              <button class="primary" type="button"
                onclick="app.accountVideosKeyword=document.querySelector('#av-keyword')?.value||'';app.accountVideosPage=1;app.refresh()">搜索</button>
            </div>
          </div>
          <div class="av-meta">
            <span class="av-acc-chip">${this.esc(accLabel)}</span>
            <span class="muted">共 ${Number(pack.total || rows.length)} 条</span>
          </div>
        </div>
        ${!accountId
          ? '<div class="av-empty"><b>请先选择账号</b><span>选择后将加载该账号已拉取的线上视频。</span></div>'
          : (rows.length
            ? `<div class="av-grid">${cards}</div>`
            : `<div class="av-empty"><b>${this.esc(meta.emptyTitle)}</b><span>${this.esc(meta.emptyHint)}</span></div>`)}
        ${accountId && rows.length ? UI.pager({
          page: Number(pack.page || 1),
          pages: Number(pack.pages || 1),
          total: Number(pack.total || 0),
        }, 'accountVideosPage') : ''}
      </div>`;
      document.querySelector('#content').innerHTML = html;
    },
    onAvAccountChange(val) {
      this.accountVideosAccountId = Number(val) || 0;
      this.accountVideosPage = 1;
      this.refresh();
    },
    avVideoCardHtml(v, accountId) {
      const vid = String(v.videoId || '');
      const title = String(v.title || '未命名视频');
      const cover = String(v.coverUrl || '');
      const shots = Number(v.screenshotCount || 0);
      const thumb = cover
        ? `<img src="${this.esc(cover)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
        : '<div class="av-thumb-empty">无封面</div>';
      return `<article class="av-card">
        <div class="av-thumb">${thumb}</div>
        <div class="av-card-body">
          <h3 title="${this.esc(title)}">${this.esc(title)}</h3>
          <div class="av-id">ID ${this.esc(vid || '-')}</div>
          <div class="av-stats">
            <span><i>播放</i><b>${this.esc(this.avFmtCount(v.views))}</b></span>
            <span><i>点赞</i><b>${this.esc(this.avFmtCount(v.likes))}</b></span>
            <span><i>评论</i><b>${this.esc(this.avFmtCount(v.comments))}</b></span>
            <span><i>截图</i><b>${shots}</b></span>
          </div>
          <div class="av-card-ops">
            <button class="tiny av-op av-op-detail" type="button" onclick='app.openAvVideoDetail(${Number(accountId)},${JSON.stringify(vid)})'>详情</button>
            <button class="tiny av-op av-op-shots" type="button" onclick='app.openAvScreenshots(${Number(accountId)},${JSON.stringify(vid)})'>截图记录${shots ? ` (${shots})` : ''}</button>
            ${v.videoUrl ? `<a class="tiny av-op av-op-link" href="${this.esc(v.videoUrl)}" target="_blank" rel="noopener noreferrer">打开链接</a>` : `<button class="tiny av-op av-op-link" type="button" disabled title="暂无链接">打开链接</button>`}
          </div>
        </div>
      </article>`;
    },
    avFindCachedVideo(videoId) {
      return (this._avVideosCache || []).find((x) => String(x.videoId) === String(videoId)) || null;
    },
    openAvVideoDetail(accountId, videoId) {
      const v = this.avFindCachedVideo(videoId) || { videoId, title: '视频 ' + videoId };
      const cover = String(v.coverUrl || '');
      const thumb = cover
        ? `<img class="av-detail-cover" src="${this.esc(cover)}" alt="" referrerpolicy="no-referrer">`
        : '<div class="av-detail-cover av-thumb-empty">无封面</div>';
      const body = `<div class="av-detail">
        <div class="av-detail-media">${thumb}</div>
        <div class="av-detail-info">
          <div class="av-detail-row"><label>标题</label><div>${this.esc(v.title || '-')}</div></div>
          <div class="av-detail-row"><label>视频 ID</label><div class="mono">${this.esc(v.videoId || '-')}</div></div>
          <div class="av-detail-row"><label>链接</label><div>${v.videoUrl ? `<a href="${this.esc(v.videoUrl)}" target="_blank" rel="noopener">${this.esc(v.videoUrl)}</a>` : '-'}</div></div>
          <div class="av-detail-metrics">
            <div><small>播放</small><b>${this.esc(this.avFmtCount(v.views))}</b></div>
            <div><small>点赞</small><b>${this.esc(this.avFmtCount(v.likes))}</b></div>
            <div><small>评论</small><b>${this.esc(this.avFmtCount(v.comments))}</b></div>
            <div><small>截图</small><b>${Number(v.screenshotCount || 0)}</b></div>
          </div>
          <div class="av-detail-row"><label>发布时间</label><div>${this.esc(v.postedAt || '-')}</div></div>
          <div class="av-detail-row"><label>来源</label><div>${this.esc(v.origin || '-')}</div></div>
          <div class="av-detail-row"><label>更新时间</label><div>${this.esc(v.updatedAt || '-')}</div></div>
          ${v.shareCaption ? `<div class="av-detail-row"><label>文案</label><div class="av-caption">${this.esc(v.shareCaption)}</div></div>` : ''}
          <div class="av-detail-actions">
            <button class="primary" type="button" onclick='app.closeModal();app.openAvScreenshots(${Number(accountId)},${JSON.stringify(String(videoId))})'>查看截图记录</button>
          </div>
        </div>
      </div>`;
      this.modal('视频详情', body, async () => {}, false, { hideSubmit: true, wide: true });
    },
    async openAvScreenshots(accountId, videoId) {
      const aid = Number(accountId);
      const vid = String(videoId || '');
      if (!aid || !vid) {
        this.toast('缺少账号或视频 ID', true);
        return;
      }
      this.modal('截图记录', `<div class="av-shots-loading">${UI.listLoadingHtml ? UI.listLoadingHtml({ title: '加载截图', desc: '正在读取截图记录…' }) : '加载中…'}</div>`, async () => {}, false, { hideSubmit: true, wide: true });
      try {
        const pack = await this.api(`/accounts/${aid}/tiktok-videos/${encodeURIComponent(vid)}/screenshots?withBase64=1&limit=5`);
        const items = pack.items || [];
        const v = this.avFindCachedVideo(vid);
        const title = v?.title ? this.esc(v.title) : this.esc(vid);
        let gallery;
        if (!items.length) {
          gallery = `<div class="av-empty av-empty-sm"><b>暂无截图</b><span>对该账号执行「拉取视频列表」后，会自动打开详情并保存截图（每视频保留最新 5 条）。</span></div>`;
        } else {
          gallery = `<div class="av-shots-grid">${items.map((s, i) => {
            const src = String(s.screenshotBase64 || '');
            const when = this.esc(s.createdAt || '-');
            const srcLabel = this.esc(s.source || 'studio_detail');
            return `<figure class="av-shot">
              <button type="button" class="av-shot-btn" onclick='app.previewAvShot(${JSON.stringify(src)}, ${JSON.stringify(when)})' title="放大预览">
                ${src ? `<img src="${this.esc(src)}" alt="截图 ${i + 1}" loading="lazy">` : '<div class="av-thumb-empty">无图</div>'}
              </button>
              <figcaption>
                <span>#${i + 1} · ${srcLabel}</span>
                <time>${when}</time>
              </figcaption>
            </figure>`;
          }).join('')}</div>`;
        }
        const body = `<div class="av-shots">
          <div class="av-shots-head">
            <div>
              <div class="av-kicker">视频截图</div>
              <h3 title="${title}">${title}</h3>
              <p class="muted">视频 ID ${this.esc(vid)} · 最多保留 5 条最新记录</p>
            </div>
          </div>
          ${gallery}
        </div>`;
        const box = document.querySelector('#modal-body');
        if (box) {
          const titleEl = document.querySelector('#modal-title');
          if (titleEl) titleEl.textContent = '截图记录';
          box.innerHTML = body;
        } else {
          this.modal('截图记录', body, async () => {}, false, { hideSubmit: true, wide: true });
        }
      } catch (e) {
        this.closeModal();
        this.toast(e.message || '加载截图失败', true);
      }
    },
    previewAvShot(src, when) {
      if (!src) return;
      const body = `<div class="av-shot-preview">
        <img src="${this.esc(src)}" alt="截图预览">
        <div class="muted" style="margin-top:10px;text-align:center">${this.esc(when || '')}</div>
      </div>`;
      this.modal('截图预览', body, async () => {}, false, { hideSubmit: true, wide: true });
    },
  };

  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages.accountWizard = true;
})();
