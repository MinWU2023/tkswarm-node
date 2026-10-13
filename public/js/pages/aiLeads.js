(function () {
  if (!window.app) throw new Error('app-core must load before pages/aiLeads.js');

  const TYPE_META = {
    user: { label: '按用户' },
    video: { label: '按视频' },
  };

  const STATUS_META = {
    draft: { label: '草稿', tone: 'muted' },
    active: { label: '进行中', tone: 'online' },
    paused: { label: '已暂停', tone: 'warn' },
    completed: { label: '已完成', tone: 'success' },
  };

  const RECORD_STATUS = {
    pending: '待发送',
    sent: '已发送',
    failed: '失败',
    skipped: '已跳过',
  };

  const DETAIL_TABS = [
    { code: 'progress', label: '执行进度' },
    { code: 'accounts', label: '关联账号' },
    { code: 'creators', label: 'TK用户' },
    { code: 'videos', label: '视频' },
    { code: 'comments', label: '意向评论' },
    { code: 'logs', label: '视频日志' },
    { code: 'records', label: '私信记录' },
    { code: 'daily', label: '日私信次数' },
  ];

  const RUN_STATUS = {
    idle: '空闲',
    queued: '已入队',
    running: '执行中',
    done: '已完成',
    failed: '失败',
  };

  const CREATOR_STATUS = {
    new: '新发现',
    contacted: '已联系',
    followed: '已关注',
    ignored: '已忽略',
  };

  const __methods = {
    canAiLeads() {
      return this.canPermission('ai.leads')
        || this.canPermission('account.create')
        || this.canPermission('publish.tasks')
        || this.canPermission('account.view');
    },
    canEditAiLeads() {
      return this.canPermission('ai.leads')
        || this.canPermission('account.create')
        || this.canPermission('publish.tasks')
        || this.canPermission('rbac.manage');
    },
    aiLeadStatusBadge(status) {
      const st = String(status || 'draft');
      const m = STATUS_META[st] || { label: st, tone: 'muted' };
      return `<span class="badge ${m.tone}">${this.esc(m.label)}</span>`;
    },
    aiLeadTypeLabel(type) {
      const t = String(type || '');
      if (TYPE_META[t]) return TYPE_META[t].label;
      if (t === 'search' || t === 'comment') return TYPE_META.user.label;
      return t || '-';
    },
    normalizeAiLeadType(type) {
      const t = String(type || '').toLowerCase();
      if (t === 'video') return 'video';
      return 'user';
    },
    async renderAiLeads() {
      if (this.aiLeadsPane === 'create') return this.renderAiLeadCreate();
      if (this.aiLeadsPane === 'detail') return this.renderAiLeadDetail();
      return this.renderAiLeadList();
    },
    openAiLeadCreate(editId) {
      this.aiLeadsPane = 'create';
      this.aiLeadsEditId = editId ? Number(editId) : null;
      this._aiLeadDraft = null;
      this.refresh();
    },
    closeAiLeadCreate() {
      this.aiLeadsPane = 'list';
      this.aiLeadsEditId = null;
      this._aiLeadDraft = null;
      this.refresh();
    },
    openAiLeadDetail(id, tab) {
      const t = DETAIL_TABS.some((x) => x.code === tab) ? tab : 'progress';
      this.aiLeadsPane = 'detail';
      this.aiLeadsDetailId = Number(id);
      this.aiLeadsDetailTab = t;
      document.querySelectorAll('.dropdown-menu').forEach((el) => {
        el.classList.add('hidden');
        if (window.UI) UI.restoreMenu(el);
      });
      this.refresh();
    },
    switchAiLeadDetailTab(tab) {
      if (!DETAIL_TABS.some((x) => x.code === tab)) return;
      this.aiLeadsDetailTab = tab;
      this.refresh();
    },
    closeAiLeadDetail() {
      this.aiLeadsPane = 'list';
      this.aiLeadsDetailId = null;
      this.aiLeadsDetailTab = 'accounts';
      this.refresh();
    },
    toggleAiLeadDetailMenu(id, e) {
      e?.stopPropagation?.();
      const target = document.querySelector('#ai-lead-detail-menu-' + id);
      const willShow = target?.classList.contains('hidden');
      document.querySelectorAll('.dropdown-menu').forEach((el) => {
        el.classList.add('hidden');
        if (window.UI) UI.restoreMenu(el);
      });
      if (target && willShow) {
        target.classList.add('ops-menu');
        target.classList.remove('hidden');
        const btn = e?.currentTarget || target.closest('.ops-dropdown')?.querySelector('button');
        if (window.UI) UI.liftMenu(target, btn, { side: 'left' });
      }
    },
    searchAiLeads() {
      this.aiLeadsKeyword = document.querySelector('#ai-leads-keyword')?.value || '';
      this.aiLeadsStatus = document.querySelector('#ai-leads-status')?.value || '';
      this.aiLeadsPage = 1;
      this.refresh();
    },
    resetAiLeadFilters() {
      this.aiLeadsKeyword = '';
      this.aiLeadsStatus = '';
      this.aiLeadsPage = 1;
      this.refresh();
    },
    async renderAiLeadList() {
      const host = document.querySelector('#content');
      if (!host) return;
      if (!this.canAiLeads()) {
        host.innerHTML = `<div class="panel"><div class="empty">当前角色无权查看 AI 拓客</div></div>`;
        return;
      }
      const page = this.aiLeadsPage || 1;
      const kw = this.aiLeadsKeyword || '';
      const status = this.aiLeadsStatus || '';
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: '15',
        keyword: kw,
        status,
      });
      try {
        const pack = await this.api('/ai-leads?' + qs.toString());
        const items = pack.items || [];
        const canEdit = this.canEditAiLeads();
        const statuses = pack.statuses || Object.keys(STATUS_META).map((code) => ({ code, label: STATUS_META[code].label }));
        this.aiLeadsPage = pack.page || page;
        host.innerHTML = `<div class="panel">
          <div class="matrix-action-bar">
            <div class="left">
              ${canEdit ? `<button class="primary" type="button" onclick="app.openAiLeadCreate()">创建拓客任务</button>` : ''}
              <button class="ghost" type="button" onclick="app.refresh()">刷新</button>
            </div>
            <div class="right"><span class="muted">配置拓客规则与账号；明细中可查看视频日志与私信记录</span></div>
          </div>
          <div class="search-bar task-filter-bar">
            <select id="ai-leads-status" class="input" title="状态">
              <option value="">全部状态</option>
              ${statuses.map((s) => `<option value="${this.esc(s.code)}" ${status === s.code ? 'selected' : ''}>${this.esc(s.label)}</option>`).join('')}
            </select>
            <input id="ai-leads-keyword" class="input" type="search" placeholder="关键词 / 类型 / ID" value="${this.esc(kw)}" onkeydown="if(event.key==='Enter')app.searchAiLeads()">
            <button class="primary" type="button" onclick="app.searchAiLeads()">搜索</button>
            <button class="ghost" type="button" onclick="app.resetAiLeadFilters()">重置</button>
          </div>
          <div class="table-container">${this.aiLeadTableHtml(items, canEdit)}</div>
          ${UI.pager({ page: pack.page, pages: pack.pages, total: pack.total, pageSize: pack.pageSize }, 'aiLeadsPage')}
        </div>`;
      } catch (e) {
        host.innerHTML = `<div class="panel"><div class="empty">加载失败：${this.esc(e.message)}</div></div>`;
      }
    },
    aiLeadTableHtml(rows, canEdit) {
      if (!rows.length) {
        return `<div class="empty">还没有拓客任务${canEdit ? '，点击「创建拓客任务」开始' : ''}</div>`;
      }
      return `<table><thead><tr>
        <th>ID</th><th>类型</th><th>关键词</th><th>下限</th><th>账号</th><th>日志/私信</th><th>状态</th><th>创建时间</th><th>操作</th>
      </tr></thead><tbody>${rows.map((x) => this.aiLeadRowHtml(x, canEdit)).join('')}</tbody></table>`;
    },
    aiLeadRowHtml(x, canEdit) {
      const kw = String(x.keywords || '').replace(/\s+/g, ' ').trim();
      const kwShort = kw.length > 36 ? kw.slice(0, 36) + '…' : kw;
      const limits = `关${x.limitFollows || 0} / 赞${x.limitLikes || 0} / 看${x.limitLook || 0}`;
      return `<tr>
        <td>#${x.id}</td>
        <td><b>${this.esc(x.typeLabel || this.aiLeadTypeLabel(x.type))}</b></td>
        <td title="${this.esc(kw)}">${this.esc(kwShort || '-')}</td>
        <td class="muted">${this.esc(limits)}</td>
        <td>${Number(x.accountCount || 0)}</td>
        <td class="muted">${Number(x.logCount || 0)} / ${Number(x.recordCount || 0)}</td>
        <td>${this.aiLeadStatusBadge(x.status)}</td>
        <td>${this.esc(x.createdAt || '')}</td>
        <td>
          <div class="ops-dropdown" style="display:inline-block">
            <button class="tiny" type="button" onclick="app.toggleAiLeadDetailMenu(${x.id},event)">明细 <span class="btn-arrow-down">▾</span></button>
            <div id="ai-lead-detail-menu-${x.id}" class="dropdown-menu ops-menu align-left hidden">
              ${DETAIL_TABS.map((t) => `<button type="button" onclick="app.openAiLeadDetail(${x.id},'${t.code}')">${this.esc(t.label)}</button>`).join('')}
            </div>
          </div>
          ${canEdit ? `<button class="tiny" type="button" onclick="app.openAiLeadCreate(${x.id})">编辑</button>` : ''}
          ${canEdit && x.status === 'draft' ? `<button class="tiny" type="button" onclick="app.patchAiLeadStatus(${x.id},'active')">启用</button>` : ''}
          ${canEdit && x.status === 'active' ? `<button class="tiny" type="button" onclick="app.repushAiLead(${x.id})">重新推送</button><button class="tiny" type="button" onclick="app.patchAiLeadStatus(${x.id},'paused')">暂停</button>` : ''}
          ${canEdit && x.status === 'paused' ? `<button class="tiny" type="button" onclick="app.patchAiLeadStatus(${x.id},'active')">恢复</button>` : ''}
          ${canEdit ? `<button class="tiny danger" type="button" onclick="app.removeAiLead(${x.id})">删除</button>` : ''}
        </td>
      </tr>`;
    },
    async removeAiLead(id) {
      if (!(await this.ask(`确认删除拓客任务 #${id}？关联账号与视频/私信明细也会删除。`))) return;
      try {
        await this.api('/ai-leads/' + id, { method: 'DELETE' });
        this.toast('已删除');
        this.refresh();
      } catch (e) {
        this.toast(e.message, true);
      }
    },
    async kickAiLeadExecutorPoll(pack) {
      const schedule = pack?.schedule || null;
      const scheduleMsg = String(pack?.scheduleMessage || '').trim();
      const bid = Number(schedule?.batch_id || schedule?.batchId || 0);
      const needPush = !!pack?.needPoll
        || (schedule && !schedule.skipped)
        || (schedule && schedule.reason === 'already_queued');

      if (schedule?.skipped && schedule.reason === 'no_eligible_account') {
        this.toast(scheduleMsg || '无可用账号（需绑定比特环境 + 代理）', true);
        return;
      }
      if (schedule?.skipped && schedule.reason === 'error') {
        this.toast(scheduleMsg || ('入队失败：' + (schedule.error || '')), true);
        return;
      }
      if (!needPush) {
        if (scheduleMsg) this.toast(scheduleMsg);
        return;
      }
      if (!this.isExecutorEnabled?.()) {
        this.toast('拓客已入队，但前台「任务执行」未开启，请先打开后再启用', true);
        return;
      }
      if (!this.ws || this.ws.readyState !== 1) {
        this.toast('WebSocket 未连接，无法推送任务；请刷新页面后确认本机 Node 在运行', true);
        // 仍尝试 HTTP 定点领取，可能在 Node 侧排队
      }
      this.syncExecutorWsStatus?.();
      if (bid > 0) {
        try {
          const out = await this.api('/executor/offer-batch', {
            method: 'POST',
            body: JSON.stringify({ batchId: bid }),
          });
          const label = out?.taskLabel || 'AI拓客';
          this.toast(`已 WSS 推送 ${label} · batch#${bid}`);
          return;
        } catch (e) {
          // 定点失败再走通用 poll
          await this.api('/executor/poll', { method: 'POST', body: '{}' }).catch(() => {});
          this.toast(e.message || `定点推送失败，已尝试通用领取 batch#${bid}`, true);
          return;
        }
      }
      await this.api('/executor/poll', { method: 'POST', body: '{}' }).catch(() => {});
      this.toast(scheduleMsg || 'AI拓客已入队，正在领取推送…');
    },
    async patchAiLeadStatus(id, status, extra = {}) {
      try {
        const pack = await this.api('/ai-leads/' + id + '/status', {
          method: 'PATCH',
          body: JSON.stringify({ status, clearData: !!extra.clearData }),
        });
        if (status === 'active') {
          await this.kickAiLeadExecutorPoll(pack || {});
        } else {
          this.toast('状态已更新');
        }
        this.refresh();
      } catch (e) {
        this.toast(e.message, true);
      }
    },
    /**
     * 重新推送：美观弹框询问是否清除关联数据
     * @returns {Promise<'clear'|'keep'|null>}
     */
    askAiLeadRepushClear(id) {
      return new Promise((resolve) => {
        let settled = false;
        const finish = (v) => {
          if (settled) return;
          settled = true;
          resolve(v);
        };
        const html = `
          <div class="ai-lead-repush-box">
            <div class="ai-lead-repush-hero">
              <div class="ai-lead-repush-badge">AI 拓客 #${Number(id) || ''}</div>
              <h3 class="ai-lead-repush-title">重新推送任务</h3>
              <p class="ai-lead-repush-desc">是否清除本任务已抓取的关联数据后重新开始？不影响任务配置与关联账号。</p>
            </div>
            <div class="ai-lead-repush-cards">
              <button type="button" class="ai-lead-repush-card keep" data-choice="keep">
                <span class="ai-lead-repush-card-icon keep-icon"></span>
                <span class="ai-lead-repush-card-title">保留数据</span>
                <span class="ai-lead-repush-card-sub">创作者 / 视频 / 评论保留，继续推送抓取</span>
              </button>
              <button type="button" class="ai-lead-repush-card clear" data-choice="clear">
                <span class="ai-lead-repush-card-icon clear-icon"></span>
                <span class="ai-lead-repush-card-title">清除并重开</span>
                <span class="ai-lead-repush-card-sub">删除创作者、视频、评论等关联表后重跑</span>
              </button>
            </div>
          </div>`;
        this.modal('重新推送', html, async () => {}, false, {
          hideSubmit: true,
          wide: true,
          onClose: () => finish(null),
        });
        const body = document.querySelector('#modal-body');
        body?.querySelectorAll('[data-choice]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const choice = btn.getAttribute('data-choice') === 'clear' ? 'clear' : 'keep';
            finish(choice);
            this.closeModal();
          });
        });
      });
    },
    async repushAiLead(id) {
      const choice = await this.askAiLeadRepushClear(id);
      if (choice == null) return;
      await this.patchAiLeadStatus(id, 'active', { clearData: choice === 'clear' });
    },
    async renderAiLeadCreate() {
      const host = document.querySelector('#content');
      if (!host) return;
      if (!this.canEditAiLeads()) {
        host.innerHTML = `<div class="panel"><div class="empty">当前角色无权创建/编辑拓客任务</div></div>`;
        return;
      }
      const editId = this.aiLeadsEditId ? Number(this.aiLeadsEditId) : 0;
      let draft = this._aiLeadDraft;
      if (!draft) {
        draft = {
          type: 'user',
          limitFollows: 20,
          limitLikes: 50,
          limitLook: 100,
          keywords: '',
          status: 'draft',
          accountIds: [],
          scrapeAccountId: 0,
        };
        if (editId) {
          try {
            const d = await this.api('/ai-leads/' + editId);
            draft = {
              type: this.normalizeAiLeadType(d.type),
              limitFollows: d.limitFollows ?? 20,
              limitLikes: d.limitLikes ?? 50,
              limitLook: d.limitLook ?? 100,
              keywords: d.keywords || '',
              status: d.status || 'draft',
              accountIds: (d.accounts || []).map((a) => Number(a.accountId)).filter(Boolean),
              scrapeAccountId: Number(d.scrapeAccountId || 0),
            };
          } catch (e) {
            this.toast(e.message, true);
            this.closeAiLeadCreate();
            return;
          }
        }
        this._aiLeadDraft = draft;
      }
      draft.type = this.normalizeAiLeadType(draft.type);
      this._aiLeadScrapeCheckOk = false;
      this._aiLeadScrapeCheckedId = 0;
      const statusOpts = Object.keys(STATUS_META).map((k) => [k, STATUS_META[k].label]);
      host.innerHTML = `<div class="panel">
        <div class="toolbar" style="margin:0 0 12px">
          <div><b>${editId ? '编辑拓客任务 #' + editId : '创建拓客任务'}</b>
            <span class="muted" style="margin-left:8px">配置类型、互动下限、关键词与执行账号</span>
          </div>
          <div>
            <button class="ghost" type="button" onclick="app.closeAiLeadCreate()">返回列表</button>
            <button class="primary" type="button" onclick="app.submitAiLeadForm()">${editId ? '保存' : '创建'}</button>
          </div>
        </div>
        <form id="ai-lead-form" class="form-grid" onsubmit="return false">
          <div class="field"><label>拓客类型</label>
            <select class="input" name="type">
              <option value="user" ${draft.type === 'user' ? 'selected' : ''}>按用户</option>
              <option value="video" ${draft.type === 'video' ? 'selected' : ''}>按视频</option>
            </select>
          </div>
          <div class="field"><label>状态</label>
            <select class="input" name="status">${statusOpts.map(([v, n]) => `<option value="${v}" ${draft.status === v ? 'selected' : ''}>${this.esc(n)}</option>`).join('')}</select>
          </div>
          <div class="field"><label>关注下限</label>
            <input class="input" name="limitFollows" type="number" min="0" value="${Number(draft.limitFollows) || 0}">
          </div>
          <div class="field"><label>点赞下限</label>
            <input class="input" name="limitLikes" type="number" min="0" value="${Number(draft.limitLikes) || 0}">
          </div>
          <div class="field"><label>浏览下限</label>
            <input class="input" name="limitLook" type="number" min="0" value="${Number(draft.limitLook) || 0}">
          </div>
          <div class="field"><label>关键词</label>
            <input class="input" name="keywords" type="text" value="${this.esc(String(draft.keywords||'').split(/[\r\n,，;；]+/)[0]||'')}" placeholder="仅填写一个关键词" maxlength="200" required>
          </div>
          <div class="field full">
            <label>关联账号 <span class="muted">仅显示已绑定浏览器环境且已绑定代理的账号</span></label>
            ${this.accountPickToolbarHtml('ai-lead-accounts', {
              batchHtml: `<button type="button" class="tiny" onclick="app.setAiLeadAccountPickAll(true)">全选</button><button type="button" class="tiny" onclick="app.setAiLeadAccountPickAll(false)">清空</button><button type="button" class="tiny" onclick="app.invertAiLeadAccountPick()">反选</button>`,
            })}
            <div id="ai-lead-accounts" class="account-pick-grid"></div>
          </div>
          <div class="field full ai-lead-scrape-field">
            <label>查数据账号 <span class="muted">用于打开比特浏览器抓取用户/视频/评论，选中后自动检测环境与代理</span></label>
            <div class="ai-lead-scrape-row">
              <select class="input" name="scrapeAccountId" id="ai-lead-scrape-account" onchange="app.onAiLeadScrapeAccountChange()">
                <option value="">请先选择关联账号</option>
              </select>
              <button type="button" class="tiny" id="ai-lead-scrape-recheck" onclick="app.onAiLeadScrapeAccountChange(true)">重新检测</button>
            </div>
            <div id="ai-lead-scrape-check" class="ai-lead-scrape-check muted">未检测</div>
          </div>
        </form>
      </div>`;
      await this.fillAiLeadAccounts(draft.accountIds || [], draft.scrapeAccountId || 0);
    },
    isAiLeadEligibleAccount(a) {
      const profile = String(a?.browser_profile_id || a?.browserProfileId || '').trim();
      const proxyId = Number(a?.proxy_id ?? a?.proxyId ?? 0);
      return !!profile && proxyId > 0;
    },
    async fillAiLeadAccounts(selectedIds, scrapeAccountId = 0) {
      const box = document.querySelector('#ai-lead-accounts');
      if (!box) return;
      try {
        const pack = await this.api('/accounts?pageSize=200');
        const accounts = (pack.items || []).filter((a) => this.isAiLeadEligibleAccount(a));
        this._aiLeadAccountsCache = accounts;
        const selected = new Set((selectedIds || []).map(Number));
        if (scrapeAccountId) selected.add(Number(scrapeAccountId));
        box.innerHTML = accounts.length
          ? accounts.map((a) => this.accountPickTagHtml(a, selected, {
            onclick: 'app.toggleAiLeadAccountPickTag(this)',
          })).join('')
          : '<div class="muted account-pick-empty" style="padding:12px;grid-column:1/-1">暂无可用账号（需同时绑定浏览器环境与代理）</div>';
        this.filterAccountPick('ai-lead-accounts');
        this.syncAiLeadScrapeAccountOptions(Number(scrapeAccountId) || 0);
      } catch (e) {
        box.innerHTML = `<div class="muted account-pick-empty" style="padding:12px;grid-column:1/-1">${this.esc(e.message || '加载账号失败')}</div>`;
      }
    },
    toggleAiLeadAccountPickTag(el) {
      this.toggleAccountPickTag(el);
      this.syncAiLeadScrapeAccountOptions();
    },
    setAiLeadAccountPickAll(all) {
      this.setAccountPickAll('ai-lead-accounts', all);
      this.syncAiLeadScrapeAccountOptions();
    },
    invertAiLeadAccountPick() {
      this.invertAccountPick('ai-lead-accounts');
      this.syncAiLeadScrapeAccountOptions();
    },
    syncAiLeadScrapeAccountOptions(preferId = 0) {
      const sel = document.querySelector('#ai-lead-scrape-account');
      if (!sel) return;
      const ids = this.selectedAccountPickIds('ai-lead-accounts');
      const cache = this._aiLeadAccountsCache || [];
      const byId = new Map(cache.map((a) => [Number(a.id), a]));
      const cur = preferId || Number(sel.value || 0) || 0;
      const keep = cur && ids.includes(cur) ? cur : (ids[0] || 0);
      sel.innerHTML = ids.length
        ? `<option value="">请选择查数据账号</option>` + ids.map((id) => {
          const a = byId.get(id);
          const name = a ? (a.username || ('#' + id)) : ('#' + id);
          return `<option value="${id}" ${id === keep ? 'selected' : ''}>#${id} · ${this.esc(name)}</option>`;
        }).join('')
        : '<option value="">请先选择关联账号</option>';
      if (window.UI) UI.decorate(sel.closest('.field') || sel);
      this._aiLeadScrapeCheckOk = false;
      this._aiLeadScrapeCheckedId = 0;
      const tip = document.querySelector('#ai-lead-scrape-check');
      if (tip) {
        tip.className = 'ai-lead-scrape-check muted';
        tip.textContent = keep ? '请检测该账号环境与代理' : '未选择';
      }
      if (keep) {
        this.onAiLeadScrapeAccountChange();
      }
    },
    async onAiLeadScrapeAccountChange(force = false) {
      const sel = document.querySelector('#ai-lead-scrape-account');
      const tip = document.querySelector('#ai-lead-scrape-check');
      const btn = document.querySelector('#ai-lead-scrape-recheck');
      const accountId = Number(sel?.value || 0);
      this._aiLeadScrapeCheckOk = false;
      this._aiLeadScrapeCheckedId = 0;
      if (!tip) return;
      if (!accountId) {
        tip.className = 'ai-lead-scrape-check muted';
        tip.textContent = '未选择';
        return;
      }
      if (!force && this._aiLeadScrapeChecking === accountId) return;
      this._aiLeadScrapeChecking = accountId;
      tip.className = 'ai-lead-scrape-check checking';
      tip.textContent = '正在检测比特环境与代理…';
      if (btn) btn.disabled = true;
      try {
        if (!(await this.ensureBitOnline?.('检测查数据账号'))) {
          tip.className = 'ai-lead-scrape-check bad';
          tip.textContent = '比特浏览器未在线，无法提交';
          return;
        }
        const r = await this.api(`/browser/accounts/${accountId}/env-check`, { method: 'POST', body: '{}' });
        if (r?.ok) {
          this._aiLeadScrapeCheckOk = true;
          this._aiLeadScrapeCheckedId = accountId;
          tip.className = 'ai-lead-scrape-check ok';
          tip.textContent = r.message || '环境与代理正常，可以提交';
        } else {
          tip.className = 'ai-lead-scrape-check bad';
          tip.textContent = (r?.message || '检测未通过') + '，请修复后再提交';
        }
      } catch (e) {
        tip.className = 'ai-lead-scrape-check bad';
        tip.textContent = (e.message || '检测失败') + '，请修复后再提交';
      } finally {
        if (btn) btn.disabled = false;
        if (this._aiLeadScrapeChecking === accountId) this._aiLeadScrapeChecking = 0;
      }
    },
    async submitAiLeadForm() {
      const form = document.querySelector('#ai-lead-form');
      if (!form) return;
      const fd = new FormData(form);
      const scrapeAccountId = Number(fd.get('scrapeAccountId') || 0);
      const body = {
        type: this.normalizeAiLeadType(fd.get('type')),
        status: String(fd.get('status') || 'draft'),
        limitFollows: Number(fd.get('limitFollows') || 0),
        limitLikes: Number(fd.get('limitLikes') || 0),
        limitLook: Number(fd.get('limitLook') || 0),
        keywords: String(fd.get('keywords') || '').trim().split(/[\r\n,，;；]+/)[0] || '',
        accountIds: this.selectedAccountPickIds('ai-lead-accounts'),
        scrapeAccountId,
      };
      if (!body.keywords) {
        this.toast('请填写一个关键词', true);
        return;
      }
      if (!body.accountIds.length) {
        this.toast('请选择关联账号', true);
        return;
      }
      if (!scrapeAccountId) {
        this.toast('请选择查数据账号', true);
        return;
      }
      if (!body.accountIds.includes(scrapeAccountId)) {
        body.accountIds.push(scrapeAccountId);
      }
      if (!this._aiLeadScrapeCheckOk || this._aiLeadScrapeCheckedId !== scrapeAccountId) {
        this.toast('请先完成查数据账号的环境与代理检测，且结果为正常', true);
        await this.onAiLeadScrapeAccountChange(true);
        if (!this._aiLeadScrapeCheckOk || this._aiLeadScrapeCheckedId !== scrapeAccountId) {
          this.toast('查数据账号检测未通过，无法提交', true);
          return;
        }
      }
      const editId = this.aiLeadsEditId ? Number(this.aiLeadsEditId) : 0;
      try {
        let pack;
        if (editId) {
          pack = await this.api('/ai-leads/' + editId, { method: 'PUT', body: JSON.stringify(body) });
          this.toast('已保存');
        } else {
          pack = await this.api('/ai-leads', { method: 'POST', body: JSON.stringify(body) });
          this.toast('已创建');
        }
        if (body.status === 'active') {
          await this.kickAiLeadExecutorPoll(pack || {});
        }
        this.closeAiLeadCreate();
      } catch (e) {
        this.toast(e.message, true);
      }
    },
    async renderAiLeadDetail() {
      const host = document.querySelector('#content');
      if (!host) return;
      const id = Number(this.aiLeadsDetailId || 0);
      if (!id) {
        this.closeAiLeadDetail();
        return;
      }
      const tab = DETAIL_TABS.some((x) => x.code === this.aiLeadsDetailTab)
        ? this.aiLeadsDetailTab
        : 'accounts';
      this.aiLeadsDetailTab = tab;
      try {
        const d = await this.api('/ai-leads/' + id);
        this._aiLeadDetail = d;
        const canEdit = this.canEditAiLeads();
        const accounts = d.accounts || [];
        const creators = d.creators || [];
        const videos = d.videos || [];
        const comments = d.comments || [];
        const logs = d.logs || [];
        const records = d.records || [];
        const daily = d.daily || [];
        const stats = d.stats || {};
        const progress = d.progress || {};
        const kw = String(d.keywords || '').trim();
        const tabLabel = (DETAIL_TABS.find((x) => x.code === tab) || {}).label || '';
        host.innerHTML = `<div class="panel">
          <div class="toolbar" style="margin:0 0 12px">
            <div>
              <b>拓客明细 #${d.id}</b>
              <span style="margin-left:8px">${this.aiLeadStatusBadge(d.status)}</span>
              <span class="muted" style="margin-left:8px">${this.esc(d.typeLabel || this.aiLeadTypeLabel(d.type))} · ${this.esc(tabLabel)}</span>
            </div>
            <div>
              <button class="ghost" type="button" onclick="app.closeAiLeadDetail()">返回列表</button>
              ${canEdit ? `<button class="ghost" type="button" onclick="app.openAiLeadCreate(${d.id})">编辑</button>` : ''}
              <button class="primary" type="button" onclick="app.refresh()">刷新</button>
            </div>
          </div>
          <div class="data-meta" style="margin-bottom:12px">
            下限：关注 <b>${d.limitFollows || 0}</b> · 点赞 <b>${d.limitLikes || 0}</b> · 浏览 <b>${d.limitLook || 0}</b>
            · 关键词：${kw ? this.esc(kw.split(/[\r\n,，;；]+/)[0] || kw) : '-'}
            · 执行 ${this.esc(RUN_STATUS[d.runStatus] || d.runStatus || '-')}
            · 账号 ${accounts.length} · TK用户 ${creators.length} · 视频 ${videos.length || logs.length} · 意向 ${d.leadCommentCount || 0} · 私信 ${records.length}
          </div>
          <div class="tk-data-view-switch" style="margin:0 0 14px" role="tablist" aria-label="明细分类">
            ${DETAIL_TABS.map((t) => `<button type="button" class="${tab === t.code ? 'is-active' : ''}" onclick="app.switchAiLeadDetailTab('${t.code}')">${this.esc(t.label)}</button>`).join('')}
          </div>
          ${this.aiLeadDetailTabHtml(tab, d, { canEdit, accounts, creators, videos, comments, logs, records, daily, stats, progress })}
        </div>`;
      } catch (e) {
        host.innerHTML = `<div class="panel"><div class="empty">加载明细失败：${this.esc(e.message)}</div>
          <button class="ghost" type="button" onclick="app.closeAiLeadDetail()">返回列表</button></div>`;
      }
    },
    aiLeadDetailTabHtml(tab, d, ctx) {
      const { canEdit, accounts, creators, videos, comments, logs, records, daily, stats, progress } = ctx;
      if (tab === 'progress') {
        const phase = String(progress.phase || '-');
        const statLine = [
          ['用户', stats.creators || creators.length],
          ['视频', stats.videos || videos.length],
          ['评论', stats.comments || comments.length],
          ['意向', stats.leads || d.leadCommentCount || 0],
        ].map(([k, v]) => `${k} <b>${v}</b>`).join(' · ');
        return `<div class="task-detail-summary" style="margin-bottom:12px">
            <span class="chip">运行 ${this.esc(RUN_STATUS[d.runStatus] || d.runStatus || '-')}</span>
            <span class="chip">阶段 ${this.esc(phase)}</span>
            ${d.lastRunAt ? `<span class="chip">上次 ${this.esc(d.lastRunAt)}</span>` : ''}
          </div>
          <div class="data-meta" style="margin-bottom:12px">${statLine}</div>
          <pre class="code-block" style="max-height:240px;overflow:auto;font-size:12px">${this.esc(JSON.stringify(progress, null, 2) || '{}')}</pre>`;
      }
      if (tab === 'creators') {
        return `<div class="toolbar" style="margin:0 0 8px">
            <div><b>TK用户</b> <span class="muted">ai_lead_creators</span></div>
            ${canEdit ? `<button class="tiny primary" type="button" onclick="app.openAiLeadCreatorForm(${d.id})">添加用户</button>` : ''}
          </div>
          <div class="table-container">${creators.length ? `<table><thead><tr><th>头像</th><th>用户</th><th>粉丝</th><th>地区</th><th>来源账号</th><th>状态</th><th>时间</th></tr></thead><tbody>
            ${creators.map((c) => `<tr>
              <td>${c.avatar ? `<img src="${this.esc(c.avatar)}" alt="" style="width:36px;height:36px;object-fit:cover;border-radius:50%">` : '-'}</td>
              <td><b>${this.esc(c.username || '-')}</b>${c.nickname ? `<div class="muted">${this.esc(c.nickname)}</div>` : ''}${c.profileUrl ? `<div><a href="${this.esc(c.profileUrl)}" target="_blank" rel="noopener">主页</a></div>` : ''}${c.uuid ? `<div class="muted">${this.esc(c.uuid)}</div>` : ''}</td>
              <td>${Number(c.followers || 0)}</td>
              <td>${this.esc(c.region || '-')}</td>
              <td>${c.accountId ? `#${c.accountId} ${this.esc(c.accountUsername || '')}` : '-'}</td>
              <td>${this.esc(c.statusLabel || CREATOR_STATUS[c.status] || c.status)}</td>
              <td>${this.esc(c.createdAt || '')}</td>
            </tr>`).join('')}
          </tbody></table>` : '<div class="empty" style="padding:16px">暂无 TK 用户</div>'}</div>`;
      }
      if (tab === 'videos') {
        return `<div class="toolbar" style="margin:0 0 8px"><div><b>抓取视频</b> <span class="muted">ai_lead_videos</span></div></div>
          <div class="table-container">${videos.length ? `<table><thead><tr><th>ID</th><th>封面</th><th>创作者</th><th>名称</th><th>点赞</th><th>地址</th><th>时间</th></tr></thead><tbody>
            ${videos.map((v) => `<tr>
              <td>#${v.id}</td>
              <td>${v.videoCover ? `<img src="${this.esc(v.videoCover)}" alt="" style="width:48px;height:48px;object-fit:cover;border-radius:6px">` : '-'}</td>
              <td>${this.esc(v.creatorUsername || '-')}${v.creatorNickname ? `<div class="muted">${this.esc(v.creatorNickname)}</div>` : ''}</td>
              <td>${this.esc(v.videoName || '-')}</td>
              <td>${Number(v.likes || 0)}</td>
              <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.videoUrl ? `<a href="${this.esc(v.videoUrl)}" target="_blank" rel="noopener">${this.esc(v.videoUrl)}</a>` : '-'}</td>
              <td>${this.esc(v.createdAt || '')}</td>
            </tr>`).join('')}
          </tbody></table>` : '<div class="empty" style="padding:16px">暂无抓取视频</div>'}</div>`;
      }
      if (tab === 'comments') {
        const leads = (comments || []).filter((c) => c.aiPass);
        return `<div class="toolbar" style="margin:0 0 8px"><div><b>意向评论</b> <span class="muted">AI 筛选命中</span></div></div>
          <div class="table-container">${leads.length ? `<table><thead><tr><th>用户</th><th>评论</th><th>视频</th><th>原因</th><th>时间</th></tr></thead><tbody>
            ${leads.map((c) => `<tr>
              <td><b>${this.esc(c.username || '-')}</b>${c.nickname ? `<div class="muted">${this.esc(c.nickname)}</div>` : ''}${c.profileUrl ? `<div><a href="${this.esc(c.profileUrl)}" target="_blank" rel="noopener">主页</a></div>` : ''}</td>
              <td title="${this.esc(c.commentText || '')}">${this.esc((c.commentText || '').slice(0, 80) || '-')}</td>
              <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.videoUrl ? `<a href="${this.esc(c.videoUrl)}" target="_blank" rel="noopener">${this.esc(c.videoName || c.videoUrl)}</a>` : '-'}</td>
              <td>${this.esc(c.aiReason || '-')}</td>
              <td>${this.esc(c.createdAt || '')}</td>
            </tr>`).join('')}
          </tbody></table>` : '<div class="empty" style="padding:16px">暂无 AI 命中评论</div>'}</div>`;
      }
      if (tab === 'logs') {
        return `<div class="toolbar" style="margin:0 0 8px">
            <div><b>视频日志</b></div>
            ${canEdit ? `<button class="tiny primary" type="button" onclick="app.openAiLeadLogForm(${d.id})">添加视频</button>` : ''}
          </div>
          <div class="table-container">${logs.length ? `<table><thead><tr><th>ID</th><th>封面</th><th>名称</th><th>地址</th><th>评论</th><th>时间</th></tr></thead><tbody>
            ${logs.map((g) => `<tr>
              <td>#${g.id}</td>
              <td>${g.videoCover ? `<img src="${this.esc(g.videoCover)}" alt="" style="width:48px;height:48px;object-fit:cover;border-radius:6px">` : '-'}</td>
              <td>${this.esc(g.videoName || '-')}</td>
              <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${this.esc(g.videoUrl || '')}">${g.videoUrl ? `<a href="${this.esc(g.videoUrl)}" target="_blank" rel="noopener">${this.esc(g.videoUrl)}</a>` : '-'}</td>
              <td>${this.esc((g.comment || '').slice(0, 80) || '-')}</td>
              <td>${this.esc(g.createdAt || '')}</td>
            </tr>`).join('')}
          </tbody></table>` : '<div class="empty" style="padding:16px">暂无视频日志</div>'}</div>`;
      }
      if (tab === 'records') {
        return `<div class="toolbar" style="margin:0 0 8px">
            <div><b>私信记录</b></div>
            ${canEdit ? `<button class="tiny primary" type="button" onclick="app.openAiLeadRecordForm(${d.id})">添加记录</button>` : ''}
          </div>
          <div class="table-container">${records.length ? `<table><thead><tr><th>ID</th><th>账号</th><th>日志</th><th>对方</th><th>内容</th><th>状态</th><th>时间</th></tr></thead><tbody>
            ${records.map((r) => `<tr>
              <td>#${r.id}</td>
              <td>#${r.accountId} ${this.esc(r.accountUsername || '')}</td>
              <td>${r.leadLogId ? '#' + r.leadLogId : '-'}</td>
              <td>${this.esc(r.username || '-')} ${r.uuid ? `<span class="muted">(${this.esc(r.uuid)})</span>` : ''}</td>
              <td title="${this.esc(r.message || '')}">${this.esc((r.message || '').slice(0, 60) || '-')}</td>
              <td>${this.esc(r.statusLabel || RECORD_STATUS[r.status] || r.status)}</td>
              <td>${this.esc(r.createdAt || '')}</td>
            </tr>`).join('')}
          </tbody></table>` : '<div class="empty" style="padding:16px">暂无私信记录</div>'}</div>`;
      }
      if (tab === 'daily') {
        return `<div class="toolbar" style="margin:0 0 8px"><div><b>账号日私信次数</b></div></div>
          <div class="table-container">${daily.length ? `<table><thead><tr><th>日期</th><th>账号</th><th>次数</th></tr></thead><tbody>
            ${daily.map((x) => `<tr><td>${this.esc(x.date || '')}</td><td>#${x.accountId} ${this.esc(x.accountUsername || '')}</td><td>${Number(x.times || 0)}</td></tr>`).join('')}
          </tbody></table>` : '<div class="empty" style="padding:16px">暂无日统计</div>'}</div>`;
      }
      return `<div class="toolbar" style="margin:0 0 8px"><div><b>关联账号</b></div></div>
        <div class="table-container">${accounts.length ? `<table><thead><tr><th>账号ID</th><th>用户名</th><th>昵称</th><th>登录</th></tr></thead><tbody>
          ${accounts.map((a) => `<tr><td>#${a.accountId}</td><td>${this.esc(a.username || '-')}</td><td>${this.esc(a.nickname || '-')}</td><td>${this.esc(a.loginStatus || '-')}</td></tr>`).join('')}
        </tbody></table>` : '<div class="empty" style="padding:16px">未关联账号</div>'}</div>`;
    },
    openAiLeadLogForm(leadId) {
      this.modal('添加视频日志', `<div class="form-grid">
        <div class="field full"><label>视频名称</label><input class="input" name="videoName" placeholder="可选"></div>
        <div class="field full"><label>视频地址</label><input class="input" name="videoUrl" placeholder="https://..."></div>
        <div class="field full"><label>封面地址</label><input class="input" name="videoCover" placeholder="可选"></div>
        <div class="field full"><label>评论内容</label><textarea class="input" name="comment" rows="3" placeholder="可选"></textarea></div>
      </div>`, async (data) => {
        await this.api('/ai-leads/' + leadId + '/logs', {
          method: 'POST',
          body: JSON.stringify({
            videoName: data.videoName || '',
            videoUrl: data.videoUrl || '',
            videoCover: data.videoCover || '',
            comment: data.comment || '',
          }),
        });
        this.toast('已添加');
        this.closeModal();
        this.refresh();
      }, false, { submitText: '添加' });
    },
    openAiLeadRecordForm(leadId) {
      const d = this._aiLeadDetail || {};
      const accounts = d.accounts || [];
      const logs = d.logs || [];
      if (!accounts.length) {
        this.toast('请先关联账号', true);
        return;
      }
      const accOpts = accounts.map((a) => `<option value="${a.accountId}">#${a.accountId} ${this.esc(a.username || '')}</option>`).join('');
      const logOpts = `<option value="0">无关联视频</option>` + logs.map((g) => `<option value="${g.id}">#${g.id} ${this.esc(g.videoName || g.videoUrl || '')}</option>`).join('');
      const stOpts = Object.keys(RECORD_STATUS).map((k) => `<option value="${k}">${RECORD_STATUS[k]}</option>`).join('');
      this.modal('添加私信记录', `<div class="form-grid">
        <div class="field"><label>执行账号</label><select class="input" name="accountId">${accOpts}</select></div>
        <div class="field"><label>关联视频日志</label><select class="input" name="leadLogId">${logOpts}</select></div>
        <div class="field"><label>对方用户名</label><input class="input" name="username"></div>
        <div class="field"><label>对方 UUID</label><input class="input" name="uuid"></div>
        <div class="field full"><label>私信内容</label><textarea class="input" name="message" rows="3"></textarea></div>
        <div class="field"><label>状态</label><select class="input" name="status">${stOpts}</select></div>
      </div>`, async (data) => {
        await this.api('/ai-leads/' + leadId + '/records', {
          method: 'POST',
          body: JSON.stringify({
            accountId: Number(data.accountId || 0),
            leadLogId: Number(data.leadLogId || 0),
            username: data.username || '',
            uuid: data.uuid || '',
            message: data.message || '',
            status: data.status || 'pending',
          }),
        });
        this.toast('已添加');
        this.closeModal();
        this.refresh();
      }, false, { submitText: '添加', wide: true });
    },
    openAiLeadCreatorForm(leadId) {
      const d = this._aiLeadDetail || {};
      const accounts = d.accounts || [];
      const logs = d.logs || [];
      const accOpts = `<option value="0">未指定</option>` + accounts.map((a) => `<option value="${a.accountId}">#${a.accountId} ${this.esc(a.username || '')}</option>`).join('');
      const logOpts = `<option value="0">无关联视频</option>` + logs.map((g) => `<option value="${g.id}">#${g.id} ${this.esc(g.videoName || g.videoUrl || '')}</option>`).join('');
      const stOpts = Object.keys(CREATOR_STATUS).map((k) => `<option value="${k}">${CREATOR_STATUS[k]}</option>`).join('');
      this.modal('添加 TK 用户', `<div class="form-grid">
        <div class="field"><label>用户名</label><input class="input" name="username" placeholder="TikTok username"></div>
        <div class="field"><label>UUID</label><input class="input" name="uuid" placeholder="可选，留空则按用户名生成"></div>
        <div class="field"><label>昵称</label><input class="input" name="nickname"></div>
        <div class="field"><label>地区</label><input class="input" name="region"></div>
        <div class="field full"><label>头像地址</label><input class="input" name="avatar" placeholder="https://..."></div>
        <div class="field full"><label>主页链接</label><input class="input" name="profileUrl" placeholder="https://www.tiktok.com/@..."></div>
        <div class="field full"><label>简介</label><textarea class="input" name="signature" rows="2"></textarea></div>
        <div class="field"><label>粉丝数</label><input class="input" name="followers" type="number" min="0" value="0"></div>
        <div class="field"><label>关注数</label><input class="input" name="following" type="number" min="0" value="0"></div>
        <div class="field"><label>获赞数</label><input class="input" name="likes" type="number" min="0" value="0"></div>
        <div class="field"><label>状态</label><select class="input" name="status">${stOpts}</select></div>
        <div class="field"><label>发现账号</label><select class="input" name="accountId">${accOpts}</select></div>
        <div class="field"><label>来源视频</label><select class="input" name="leadLogId">${logOpts}</select></div>
      </div>`, async (data) => {
        await this.api('/ai-leads/' + leadId + '/creators', {
          method: 'POST',
          body: JSON.stringify({
            username: data.username || '',
            uuid: data.uuid || '',
            nickname: data.nickname || '',
            avatar: data.avatar || '',
            profileUrl: data.profileUrl || '',
            signature: data.signature || '',
            followers: Number(data.followers || 0),
            following: Number(data.following || 0),
            likes: Number(data.likes || 0),
            region: data.region || '',
            status: data.status || 'new',
            accountId: Number(data.accountId || 0),
            leadLogId: Number(data.leadLogId || 0),
          }),
        });
        this.toast('已保存');
        this.closeModal();
        this.refresh();
      }, false, { submitText: '保存', wide: true });
    },
  };

  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages.aiLeads = true;
})();

