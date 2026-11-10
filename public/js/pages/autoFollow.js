(function () {
  if (!window.app) throw new Error('app-core must load before pages/autoFollow.js');

  const STATUS_META = {
    pending: { label: '待执行', tone: 'muted' },
    running: { label: '进行中', tone: 'online' },
    completed: { label: '已完成', tone: 'success' },
    cancelled: { label: '已取消', tone: 'warn' },
    failed: { label: '失败', tone: 'error' },
  };

  const ITEM_STATUS = {
    pending: '待执行',
    enqueued: '已入队',
    running: '执行中',
    success: '成功',
    failed: '失败',
    skipped: '已跳过',
    cancelled: '已取消',
  };

  const __methods = {
    canAutoFollow() {
      return this.canPermission('ai.leads')
        || this.canPermission('account.create')
        || this.canPermission('publish.tasks')
        || this.canPermission('account.view');
    },
    canEditAutoFollow() {
      return this.canPermission('ai.leads')
        || this.canPermission('account.create')
        || this.canPermission('publish.tasks')
        || this.canPermission('rbac.manage');
    },
    autoFollowStatusBadge(status) {
      const st = String(status || 'pending');
      const m = STATUS_META[st] || { label: st, tone: 'muted' };
      return `<span class="badge ${m.tone}">${this.esc(m.label)}</span>`;
    },
    async renderAutoFollow() {
      if (!this.canView('autoFollow') && !this.canAutoFollow()) {
        return this.renderPageDenied('当前角色无权查看自动增粉');
      }
      document.querySelector('#content')?.classList.remove('chat-mode');
      const pane = this.autoFollowPane || 'list';
      if (pane === 'create' || pane === 'edit') return this.renderAutoFollowForm();
      return this.renderAutoFollowList();
    },
    openAutoFollowCreate() {
      if (!this.canEditAutoFollow()) {
        this.toast('当前角色无权创建增粉任务', true);
        return;
      }
      this.autoFollowPane = 'create';
      this.autoFollowEditId = null;
      this._autoFollowDraft = null;
      this.navigate('autoFollow', 'create');
    },
    openAutoFollowEdit(id) {
      if (!this.canEditAutoFollow()) {
        this.toast('当前角色无权编辑增粉任务', true);
        return;
      }
      this.autoFollowPane = 'edit';
      this.autoFollowEditId = Number(id) || null;
      this._autoFollowDraft = null;
      this.navigate('autoFollow', 'edit/' + (Number(id) || 0));
    },
    closeAutoFollowForm() {
      this.autoFollowPane = 'list';
      this.autoFollowEditId = null;
      this._autoFollowDraft = null;
      this.navigate('autoFollow', 'list');
    },
    async renderAutoFollowList() {
      const page = this.autoFollowPage || 1;
      const keyword = String(this.autoFollowKeyword || '').trim();
      const status = String(this.autoFollowStatus || '').trim();
      const qs = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (keyword) qs.set('keyword', keyword);
      if (status) qs.set('status', status);
      const pack = await this.api(`/auto-follow-tasks?${qs}`).catch(() => ({ items: [], total: 0, page: 1, pages: 1 }));
      const rows = pack.items || [];
      const statusOpts = [
        ['', '全部状态'],
        ['pending', '待执行'],
        ['running', '进行中'],
        ['completed', '已完成'],
        ['cancelled', '已取消'],
        ['failed', '失败'],
      ];

      document.querySelector('#content').innerHTML = `<div class="panel list-panel auto-follow-panel">
        <div class="matrix-action-bar">
          <div class="left">
            <button class="ghost" type="button" onclick="app.refresh()">刷新</button>
            ${this.canEditAutoFollow() ? `<button class="primary" type="button" onclick="app.openAutoFollowCreate()">创建任务</button>` : ''}
            ${this.canEditAutoFollow() ? `<div class="dropdown" style="display:inline-block">
              <button class="ghost" type="button" onclick="app.toggleAfBatchMenu(event)">批量操作 <span class="btn-arrow-down">▾</span></button>
              <div id="af-batch-menu" class="dropdown-menu align-left hidden">
                <button type="button" onclick="app.batchAutoFollowDispatch(true)">批量开启自动化</button>
                <button type="button" onclick="app.batchAutoFollowDispatch(false)">批量关闭自动化</button>
              </div>
            </div>` : ''}
          </div>
          <div class="right"><span class="muted">按间隔调度系统账号关注目标；可单独/批量关闭自动化，计划任务将不再派发</span></div>
        </div>
        <div class="search-bar task-filter-bar">
          <select id="af-status-filter" class="input" onchange="app.autoFollowStatus=this.value;app.autoFollowPage=1;app.refresh()">
            ${statusOpts.map(([v, n]) => `<option value="${this.esc(v)}" ${status === v ? 'selected' : ''}>${this.esc(n)}</option>`).join('')}
          </select>
          <input id="af-keyword" class="input" type="search" placeholder="任务名 / 目标 / ID" value="${this.esc(keyword)}"
            onkeydown="if(event.key==='Enter'){app.autoFollowKeyword=this.value;app.autoFollowPage=1;app.refresh()}">
          <button class="primary" type="button" onclick="app.autoFollowKeyword=document.querySelector('#af-keyword')?.value||'';app.autoFollowPage=1;app.refresh()">搜索</button>
        </div>
        <div class="table-container">
          <table class="table">
            <thead><tr>
              <th><input type="checkbox" onchange="app.toggleAllAfTasks(this.checked)" title="全选"></th>
              <th>ID</th><th>任务名</th><th>目标</th><th>数量</th><th>间隔(小时)</th><th>进度</th><th>状态</th><th>创建时间</th><th>操作</th>
            </tr></thead>
            <tbody>
              ${rows.length ? rows.map((r) => {
                const dispatchOn = r.dispatchEnabled !== false && r.dispatchEnabled !== 0;
                return `<tr>
                <td><input class="af-task-check" type="checkbox" value="${r.id}" onclick="event.stopPropagation()"></td>
                <td>#${r.id}</td>
                <td>${this.esc(r.name || '-')}</td>
                <td title="${this.esc(r.targetDisplay || '')}">${this.esc(r.targetDisplay || '-')}</td>
                <td>${Number(r.followCount || 0)}</td>
                <td>${Number(r.minIntervalHours || 0)} ~ ${Number(r.maxIntervalHours || 0)}</td>
                <td><span class="muted">成 ${Number(r.successCount || 0)} / 败 ${Number(r.failedCount || 0)} / 计 ${Number(r.scheduledCount || 0)}</span></td>
                <td>
                  ${this.autoFollowStatusBadge(r.status)}
                  ${dispatchOn ? '' : `<span class="badge muted" title="自动化派发已关闭">自动化关</span>`}
                </td>
                <td class="muted">${this.esc(r.createdAt || '')}</td>
                <td class="row-actions">
                  <button type="button" class="ghost" onclick="app.viewAutoFollowDetail(${r.id})">明细</button>
                  ${r.canEdit && this.canEditAutoFollow() ? `<button type="button" class="ghost" onclick="app.openAutoFollowEdit(${r.id})">编辑</button>` : ''}
                  ${this.canEditAutoFollow()
                    ? (dispatchOn
                      ? `<button type="button" class="ghost" onclick="app.patchAutoFollowDispatch(${r.id},false)">关自动化</button>`
                      : `<button type="button" class="ghost" onclick="app.patchAutoFollowDispatch(${r.id},true)">开自动化</button>`)
                    : ''}
                  ${['pending', 'running'].includes(r.status) && this.canEditAutoFollow()
                    ? `<button type="button" class="ghost danger" onclick="app.cancelAutoFollowTask(${r.id})">取消</button>` : ''}
                </td>
              </tr>`;
              }).join('') : `<tr><td colspan="10" class="empty">暂无增粉任务</td></tr>`}
            </tbody>
          </table>
        </div>
        ${UI.pager({ ...pack, items: rows, page: pack.page || page, pages: pack.pages || 1, total: pack.total || 0, pageSize: pack.pageSize || 20 }, 'autoFollowPage')}
      </div>`;
    },
    toggleAllAfTasks(checked) {
      document.querySelectorAll('.af-task-check').forEach((x) => { x.checked = !!checked; });
    },
    toggleAfBatchMenu(event) {
      event?.stopPropagation?.();
      const menu = document.querySelector('#af-batch-menu');
      if (!menu) return;
      const open = menu.classList.contains('hidden');
      document.querySelectorAll('.dropdown-menu').forEach((m) => m.classList.add('hidden'));
      if (open) menu.classList.remove('hidden');
    },
    selectedAfTaskIds() {
      return [...document.querySelectorAll('.af-task-check:checked')].map((x) => Number(x.value)).filter(Boolean);
    },
    async patchAutoFollowDispatch(id, enabled) {
      if (!this.canEditAutoFollow()) {
        this.toast('无权操作', true);
        return;
      }
      const on = !!enabled;
      if (!on && !(await this.ask(`关闭增粉任务 #${id} 的自动化派发？计划任务将不再入队关注，已排队执行中的不受影响。`))) return;
      try {
        const pack = await this.api(`/auto-follow-tasks/${id}/dispatch`, {
          method: 'PATCH',
          body: JSON.stringify({ dispatchEnabled: on }),
        });
        this.toast(pack?.message || (on ? '已开启自动化' : '已关闭自动化'));
        this.refresh();
      } catch (e) {
        this.toast(e.message || '切换失败', true);
      }
    },
    async batchAutoFollowDispatch(enabled) {
      if (!this.canEditAutoFollow()) {
        this.toast('无权操作', true);
        return;
      }
      const ids = this.selectedAfTaskIds();
      if (!ids.length) {
        this.toast('请先勾选任务', true);
        return;
      }
      const on = !!enabled;
      if (!on && !(await this.ask(`确认批量关闭 ${ids.length} 个增粉任务的自动化派发？`))) return;
      try {
        const pack = await this.api('/auto-follow-tasks/batch-dispatch', {
          method: 'POST',
          body: JSON.stringify({ taskIds: ids, dispatchEnabled: on }),
        });
        this.toast(pack?.message || (on ? `已开启 ${pack?.changed || 0} 个` : `已关闭 ${pack?.changed || 0} 个`));
        this.refresh();
      } catch (e) {
        this.toast(e.message || '批量操作失败', true);
      }
    },
    autoFollowDetailItemPageSize: 10,
    normalizeAutoFollowItemPack(raw, page, task) {
      const pageSize = Number(this.autoFollowDetailItemPageSize || 10);
      const curPage = Math.max(1, Number(page) || 1);
      let items = [];
      let total = Number(task?.scheduledCount || 0);
      let pages = 1;
      let packPage = curPage;
      if (Array.isArray(raw)) {
        items = raw;
      } else if (raw && typeof raw === 'object') {
        items = Array.isArray(raw.items) ? raw.items : [];
        total = Number(raw.total ?? raw.itemTotal ?? task?.scheduledCount ?? items.length ?? 0);
        pages = Number(raw.pages ?? raw.itemPages ?? 0) || Math.max(1, Math.ceil(Math.max(total, items.length) / pageSize));
        packPage = Number(raw.page ?? raw.itemPage ?? curPage);
      }
      if (!total && items.length) total = items.length;
      pages = Math.max(1, pages || Math.ceil(total / pageSize) || 1);
      packPage = Math.min(pages, Math.max(1, packPage));
      // 兼容后端一次返回全量明细、未分页的情况
      if (items.length > pageSize && pages <= 1) {
        total = Math.max(total, items.length);
        pages = Math.max(1, Math.ceil(total / pageSize));
        packPage = Math.min(pages, curPage);
        const start = (packPage - 1) * pageSize;
        items = items.slice(start, start + pageSize);
      }
      return { items, total, page: packPage, pages, pageSize };
    },
    autoFollowDetailPagerHtml(pack) {
      const total = Number(pack?.total || 0);
      if (total <= 0) {
        return '<div class="af-detail-pager-empty muted">暂无明细记录</div>';
      }
      const pageSize = Math.max(1, Number(pack.pageSize || this.autoFollowDetailItemPageSize || 10));
      const pages = Math.max(1, Number(pack.pages || Math.ceil(total / pageSize) || 1));
      const page = Math.min(pages, Math.max(1, Number(pack.page || 1)));
      const windowSize = Math.min(5, pages);
      let start = Math.max(1, page - Math.floor(windowSize / 2));
      let end = Math.min(pages, start + windowSize - 1);
      start = Math.max(1, end - windowSize + 1);
      const nums = [];
      for (let i = start; i <= end; i++) nums.push(i);
      const prev = Math.max(1, page - 1);
      const next = Math.min(pages, page + 1);
      const disFirst = page <= 1 ? 'disabled' : '';
      const disLast = page >= pages ? 'disabled' : '';
      const jumpId = 'pager-jump-autoFollowDetailPage';
      return `<div class="pager af-detail-pager" data-page-key="autoFollowDetailPage">
        <div class="pager-inner">
          <button type="button" class="pager-nav" ${disFirst} onclick="app.loadAutoFollowDetailPage(1)" title="首页" aria-label="首页">«</button>
          <button type="button" class="pager-nav" ${disFirst} onclick="app.loadAutoFollowDetailPage(${prev})" title="上一页" aria-label="上一页">‹</button>
          <div class="pager-pages">${nums.map((n) =>
            `<button type="button" class="pager-num ${n === page ? 'is-on' : ''}" onclick="app.loadAutoFollowDetailPage(${n})" ${n === page ? 'aria-current="page"' : ''}>${n}</button>`
          ).join('')}</div>
          <button type="button" class="pager-nav" ${disLast} onclick="app.loadAutoFollowDetailPage(${next})" title="下一页" aria-label="下一页">›</button>
          <button type="button" class="pager-nav" ${disLast} onclick="app.loadAutoFollowDetailPage(${pages})" title="末页" aria-label="末页">»</button>
          <div class="pager-jump">
            <span>跳至</span>
            <input type="number" class="pager-jump-input" id="${jumpId}" min="1" max="${pages}" value="${page}" inputmode="numeric"
              onkeydown="if(event.key==='Enter'){event.preventDefault();app.jumpAutoFollowDetailPage()}">
            <button type="button" class="pager-jump-go" onclick="app.jumpAutoFollowDetailPage()">GO</button>
          </div>
          <div class="pager-meta">共 <b>${total}</b> 条 · 第 <b>${page}</b> / <b>${pages}</b> 页</div>
        </div>
      </div>`;
    },
    jumpAutoFollowDetailPage() {
      const el = document.querySelector('#pager-jump-autoFollowDetailPage');
      let n = Number(el?.value || 1);
      const max = Math.max(1, Number(el?.getAttribute('max') || 1));
      if (!Number.isFinite(n) || n < 1) n = 1;
      if (n > max) n = max;
      if (el) el.value = String(n);
      this.loadAutoFollowDetailPage(n);
    },
    autoFollowItemStatusBadge(status) {
      const map = {
        pending: 'pending',
        enqueued: 'queued',
        running: 'running',
        success: 'success',
        failed: 'failed',
        skipped: 'paused',
        cancelled: 'paused',
      };
      const label = ITEM_STATUS[status] || status || '-';
      return `<span class="badge ${map[status] || 'pending'}">${this.esc(label)}</span>`;
    },
    autoFollowActionPlanSummary(plan) {
      if (!plan || typeof plan !== 'object') return '<span class="muted">-</span>';
      const videos = Array.isArray(plan.videos) ? plan.videos : [];
      const kw = String(plan.searchKeyword || '').trim();
      const head = [
        kw ? `搜「${kw}」` : '',
        `看 ${videos.length || Number(plan.watchVideoCount || 0)} 个视频`,
      ].filter(Boolean).join(' · ');
      if (!videos.length) {
        return `<div class="af-plan-summary"><div class="muted">${this.esc(head || '无主页操作（直接关注）')}</div></div>`;
      }
      const lines = videos.map((v, i) => {
        const parts = [`#${i + 1} 停留 ${Number(v.staySeconds || 0)}s`];
        if (v.like) parts.push('赞');
        if (v.comment) parts.push('评');
        return parts.join(' · ');
      });
      return `<div class="af-plan-summary">
        <div class="af-plan-head">${this.esc(head)}</div>
        <div class="af-plan-videos muted">${lines.map((t) => this.esc(t)).join('；')}</div>
      </div>`;
    },
    autoFollowDetailItemsTableHtml(items) {
      const rows = (items || []).map((it) => `<tr>
        <td>#${it.id}</td>
        <td>${this.esc(it.sourceLabel || ('#' + it.sourceAccountId))}</td>
        <td>${this.esc(it.scheduledAt || '')}</td>
        <td class="af-plan-cell">${this.autoFollowActionPlanSummary(it.actionPlan)}</td>
        <td>${this.autoFollowItemStatusBadge(it.status)}</td>
        <td class="muted">${this.esc(it.executedAt || '-')}</td>
        <td class="muted task-detail-msg">${this.esc(it.errorMessage || '-')}</td>
      </tr>`).join('');
      return `<div class="table-container task-detail-table">
        <table><thead><tr>
          <th>明细ID</th><th>源账号</th><th>计划时间</th><th>主页操作计划</th><th>状态</th><th>执行时间</th><th>错误</th>
        </tr></thead><tbody>${rows || `<tr><td colspan="7" class="empty">暂无明细</td></tr>`}</tbody></table>
      </div>`;
    },
    autoFollowDetailBodyHtml(task, itemPack, page) {
      const pack = this.normalizeAutoFollowItemPack(itemPack, page, task);
      return `<div class="task-detail af-task-detail">
        <div class="task-detail-summary">
          <div class="task-detail-chip"><small>目标</small><b>${this.esc(task.targetDisplay || '-')}</b></div>
          <div class="task-detail-chip"><small>状态</small><b>${this.autoFollowStatusBadge(task.status)}</b></div>
          <div class="task-detail-chip"><small>成功</small><b>${Number(task.successCount || 0)}</b></div>
          <div class="task-detail-chip"><small>失败</small><b>${Number(task.failedCount || 0)}</b></div>
          <div class="task-detail-chip"><small>计划</small><b>${Number(task.scheduledCount || 0)}</b></div>
          <div class="task-detail-chip"><small>间隔</small><b>${Number(task.minIntervalHours || 0)} ~ ${Number(task.maxIntervalHours || 0)} 小时</b></div>
          <div class="task-detail-chip"><small>搜索词</small><b>${this.esc(task.searchKeyword || task.targetUsername || '-')}</b></div>
          <div class="task-detail-chip"><small>观看/停留</small><b>${Number(task.watchVideoCount || 0)} 个 · ${Number(task.staySecondsMin || 0)}~${Number(task.staySecondsMax || 0)}s</b></div>
          <div class="task-detail-chip"><small>赞/评概率</small><b>${Number(task.likeRate || 0)}% / ${Number(task.commentRate || 0)}%</b></div>
        </div>
        <section class="task-detail-section">
          <div class="task-detail-section-head">
            <span class="task-detail-section-title">关注明细</span>
            <span class="muted" style="font-size:12px">每页 ${pack.pageSize} 条 · 含主页操作计划</span>
          </div>
          <div class="task-detail-section-body">
            <div id="af-detail-table">${this.autoFollowDetailItemsTableHtml(pack.items)}</div>
            <div id="af-detail-pager">${this.autoFollowDetailPagerHtml(pack)}</div>
          </div>
        </section>
      </div>`;
    },
    renderAutoFollowDetailContent(task, itemPack, page) {
      const host = document.querySelector('#af-detail-body');
      if (!host) return;
      const pack = this.normalizeAutoFollowItemPack(itemPack, page, task);
      host.innerHTML = this.autoFollowDetailBodyHtml(task, pack, pack.page);
      const tableHost = document.querySelector('#af-detail-table');
      if (tableHost && window.UI) UI.decorate(tableHost);
    },
    async loadAutoFollowDetailPage(page) {
      const id = Number(this._autoFollowDetailId || 0);
      if (!id) return;
      const itemPage = Math.max(1, Number(page) || 1);
      this.autoFollowDetailPage = itemPage;
      const host = document.querySelector('#af-detail-body');
      const tableHost = document.querySelector('#af-detail-table');
      const pagerHost = document.querySelector('#af-detail-pager');
      if (tableHost) {
        tableHost.innerHTML = this.listLoadingHtml({ title: '正在加载明细', desc: '同步增粉明细列表，请稍候…', compact: true });
      } else if (host) {
        host.innerHTML = this.listLoadingHtml({ title: '正在加载明细', desc: '同步增粉明细列表，请稍候…', compact: true });
      }
      if (pagerHost) pagerHost.innerHTML = '';
      const pageSize = Number(this.autoFollowDetailItemPageSize || 10);
      const task = await this.api(`/auto-follow-tasks/${id}?itemPage=${itemPage}&itemPageSize=${pageSize}`).catch(() => null);
      if (!task) {
        this.toast('加载明细失败', true);
        if (host) host.innerHTML = '<div class="empty" style="padding:28px 16px">加载失败</div>';
        return;
      }
      this.renderAutoFollowDetailContent(task, task.items, itemPage);
      const title = document.querySelector('#modal-title');
      if (title) title.textContent = `增粉明细 · #${task.id}`;
    },
    async viewAutoFollowDetail(id, page) {
      const taskId = Number(id) || 0;
      if (!taskId) return;
      this._autoFollowDetailId = taskId;
      const itemPage = Math.max(1, Number(page || this.autoFollowDetailPage || 1));
      this.autoFollowDetailPage = itemPage;
      const pageSize = Number(this.autoFollowDetailItemPageSize || 10);
      const task = await this.api(`/auto-follow-tasks/${taskId}?itemPage=${itemPage}&itemPageSize=${pageSize}`).catch(() => null);
      if (!task) {
        this.toast('任务不存在', true);
        this._autoFollowDetailId = null;
        return;
      }
      const bodyHtml = this.autoFollowDetailBodyHtml(task, task.items, itemPage);
      this.modal(
        `增粉明细 · #${task.id}`,
        `<div id="af-detail-body">${bodyHtml}</div>`,
        () => this.closeModal(),
        false,
        {
          hideSubmit: true,
          wide: true,
          onClose: () => {
            this._autoFollowDetailId = null;
            this.autoFollowDetailPage = 1;
            document.querySelector('#modal')?.classList.remove('af-detail-modal');
          },
        }
      );
      document.querySelector('#modal')?.classList.add('af-detail-modal');
    },
    async cancelAutoFollowTask(id) {
      const ok = await this.ask('确认取消该增粉任务？未入队明细将停止，已入队分任务一并取消。');
      if (!ok) return;
      try {
        await this.api(`/auto-follow-tasks/${id}/cancel`, { method: 'POST' });
        this.toast('已取消');
        this.refresh();
      } catch (e) {
        this.toast(e.message || '取消失败', true);
      }
    },
    afTplContent(t, preferMode) {
      const mode = t?.contentMode || preferMode || 'fixed';
      const c = String(t?.content || '').trim();
      if (c) return c;
      if (mode === 'ai') return String(t?.aiPrompt || t?.ai_prompt || '').trim();
      return String(t?.fixedText || t?.fixed_text || '').trim();
    },
    renderAfCommentTplOptions(items, mode, selectedIds) {
      const list = Array.isArray(items) ? items : [];
      const selected = new Set((selectedIds || []).map(Number).filter(Boolean));
      if (!list.length) {
        const tip = mode === 'ai'
          ? '暂无 AI 提示词评论模板，请先在「消息模板」新建内容类型为「AI 提示词」的评论'
          : '暂无固定文案评论模板，请先在「消息模板」新建内容类型为「固定文案」的评论';
        return `<div class="warm-comment-empty">${tip}</div>`;
      }
      if (mode === 'ai') {
        return list.map((t) => {
          const id = Number(t.id);
          const prompt = this.afTplContent(t, 'ai');
          const preview = prompt.length > 120 ? prompt.slice(0, 120) + '…' : prompt;
          return `<label class="warm-comment-tpl ${selected.has(id) ? 'is-on' : ''}">
            <input type="radio" name="afCommentAiTemplateId" value="${id}" ${selected.has(id) ? 'checked' : ''} onchange="app.markAfCommentTpl(this)">
            <span class="warm-comment-tpl-body">
              <b>${this.esc(t.name || ('模板 #' + id))}</b>
              <small>${this.esc(preview || '（无内容）')}</small>
            </span>
          </label>`;
        }).join('');
      }
      return list.map((t) => {
        const id = Number(t.id);
        const text = this.afTplContent(t, 'fixed');
        const preview = text.length > 80 ? text.slice(0, 80) + '…' : text;
        return `<label class="warm-comment-tpl ${selected.has(id) ? 'is-on' : ''}">
          <input type="checkbox" name="afCommentTemplateIds" value="${id}" ${selected.has(id) ? 'checked' : ''} onchange="app.markAfCommentTpl(this)">
          <span class="warm-comment-tpl-body">
            <b>${this.esc(t.name || ('模板 #' + id))}</b>
            <small>${this.esc(preview || '（无内容）')}</small>
          </span>
        </label>`;
      }).join('');
    },
    setAfCommentMode(mode) {
      const m = mode === 'ai' ? 'ai' : 'fixed';
      const fixedBox = document.querySelector('#af-comment-fixed-box');
      const aiBox = document.querySelector('#af-comment-ai-box');
      if (fixedBox) fixedBox.hidden = m !== 'fixed';
      if (aiBox) aiBox.hidden = m !== 'ai';
      document.querySelectorAll('input[name=afCommentMode]').forEach((el) => { el.checked = el.value === m; });
      document.querySelectorAll('.af-comment-cat').forEach((el) => {
        const input = el.querySelector('input[name=afCommentMode]');
        el.classList.toggle('is-on', !!(input && input.value === m && input.checked));
      });
    },
    markAfCommentTpl(el) {
      if (!el) return;
      const label = el.closest('.warm-comment-tpl');
      if (!label) return;
      if (el.type === 'radio') {
        document.querySelectorAll('#af-comment-ai-list .warm-comment-tpl').forEach((n) => n.classList.remove('is-on'));
        label.classList.add('is-on');
      } else {
        label.classList.toggle('is-on', !!el.checked);
      }
    },
    collectAfCommentPayload() {
      const form = document.querySelector('#af-form');
      const mode = (form?.querySelector('input[name=afCommentMode]:checked')?.value || 'ai') === 'ai' ? 'ai' : 'fixed';
      const tpls = this._afCommentTemplates || [];
      const byId = Object.fromEntries(tpls.map((t) => [Number(t.id), t]));
      if (mode === 'ai') {
        const aiId = Number(form?.querySelector('input[name=afCommentAiTemplateId]:checked')?.value || 0) || 0;
        const row = byId[aiId];
        const prompt = this.afTplContent(row, 'ai');
        return {
          commentMode: 'ai',
          commentTemplateIds: [],
          commentAiTemplateId: aiId,
          commentTexts: [],
          commentAiPrompt: prompt,
          commentText: 'Nice video!',
        };
      }
      const ids = [...document.querySelectorAll('#af-comment-fixed-list input[name=afCommentTemplateIds]:checked')]
        .map((el) => Number(el.value)).filter(Boolean);
      const texts = ids.map((id) => this.afTplContent(byId[id], 'fixed')).filter(Boolean);
      return {
        commentMode: 'fixed',
        commentTemplateIds: ids,
        commentAiTemplateId: 0,
        commentTexts: texts.length ? texts : ['Nice video!'],
        commentAiPrompt: '',
        commentText: texts[0] || 'Nice video!',
      };
    },
    async renderAutoFollowForm() {
      if (!this.canEditAutoFollow()) {
        return this.renderPageDenied('当前角色无权管理增粉任务');
      }
      const editId = Number(this.autoFollowEditId || 0) || 0;
      const isEdit = this.autoFollowPane === 'edit' && editId > 0;
      let draft = this._autoFollowDraft || {
        targetAccountId: 0,
        targetUsername: '',
        targetTiktokUid: '',
        externalTarget: '',
        targetDisplay: '',
        followCount: 1,
        sourceMode: 'random',
        sourceAccountIds: [],
        saveTraffic: true,
        minIntervalHours: 1,
        maxIntervalHours: 2,
        searchKeyword: '',
        staySecondsMin: 8,
        staySecondsMax: 20,
        watchVideoCount: 3,
        likeRate: 40,
        commentRate: 20,
        commentMode: 'ai',
        commentAiTemplateId: 0,
        commentTemplateIds: [],
        eligibleCount: 0,
        eligibleIds: [],
        canEdit: true,
      };

      if (isEdit && !this._autoFollowDraft) {
        const task = await this.api(`/auto-follow-tasks/${editId}`).catch(() => null);
        if (!task) {
          this.toast('任务不存在', true);
          this.closeAutoFollowForm();
          return;
        }
        if (!task.canEdit) {
          this.toast('该任务已有明细入队，不可编辑调度参数', true);
          this.closeAutoFollowForm();
          return;
        }
        draft = {
          targetAccountId: Number(task.targetAccountId || 0),
          targetUsername: String(task.targetUsername || ''),
          targetTiktokUid: String(task.targetTiktokUid || ''),
          externalTarget: '',
          targetDisplay: String(task.targetDisplay || ''),
          followCount: Number(task.followCount || 1),
          sourceMode: 'random',
          sourceAccountIds: [],
          saveTraffic: task.saveTraffic !== false && task.saveTraffic !== 0,
          minIntervalHours: Number(task.minIntervalHours || 1),
          maxIntervalHours: Number(task.maxIntervalHours || 2),
          searchKeyword: String(task.searchKeyword || task.targetUsername || ''),
          staySecondsMin: Number(task.staySecondsMin ?? 8),
          staySecondsMax: Number(task.staySecondsMax ?? 20),
          watchVideoCount: Number(task.watchVideoCount ?? 3),
          likeRate: Number(task.likeRate ?? 40),
          commentRate: Number(task.commentRate ?? 20),
          commentMode: String(task.commentMode || 'ai') === 'fixed' ? 'fixed' : 'ai',
          commentAiTemplateId: Number(task.commentAiTemplateId || 0),
          commentTemplateIds: [],
          eligibleCount: 0,
          eligibleIds: [],
          canEdit: !!task.canEdit,
        };
        this._autoFollowDraft = draft;
      }
      const sourceMode = String(draft.sourceMode || 'random') === 'custom' ? 'custom' : 'random';
      draft.sourceMode = sourceMode;

      let commentTpls = [];
      try {
        const pack = await this.api('/interaction-templates?type=comment');
        commentTpls = (pack.items || []).filter((t) => t.enabled !== 0 && t.enabled !== false);
      } catch (_) {
        commentTpls = [];
      }
      this._afCommentTemplates = commentTpls;
      const fixedTpls = commentTpls.filter((t) => (t.contentMode || 'fixed') === 'fixed');
      const aiTpls = commentTpls.filter((t) => t.contentMode === 'ai');
      const commentMode = String(draft.commentMode || 'ai') === 'fixed' ? 'fixed' : 'ai';
      const aiId = Number(draft.commentAiTemplateId || 0) || 0;
      const fixedIds = (draft.commentTemplateIds || []).map(Number).filter(Boolean);

      document.querySelector('#content').innerHTML = `<div class="panel auto-follow-form-panel">
        <div class="af-form-top">
          <button type="button" class="ghost af-back-btn" onclick="app.closeAutoFollowForm()">← 返回列表</button>
          <div class="af-form-heading">
            <h2>${isEdit ? '编辑增粉任务 #' + editId : '创建任务'}</h2>
            <p>配置搜索进主页、观看视频与关注节奏；生成明细时固化每条主页操作计划</p>
          </div>
        </div>
        <form id="af-form" class="af-form" onsubmit="event.preventDefault();app.submitAutoFollowForm()">
          <div class="af-card">
            <div class="af-card-head">
              <b>被增粉目标</b>
              <span class="muted">系统账号或外部 TikTok 用户，二选一</span>
            </div>
            <div class="af-card-body af-card-body-target">
              <div class="field full">
                <div class="af-target-inline">
                  <div class="af-target-system">
                    <input id="af-target-search" class="input" type="search" placeholder="系统账号：搜索用户名 / 昵称 / ID"
                      oninput="app.searchAutoFollowTargets(this.value)">
                    <span class="muted af-target-picked" id="af-target-picked" title="${this.esc(draft.targetDisplay || '')}">${draft.targetDisplay
                      ? this.esc('已选：' + draft.targetDisplay)
                      : ''}</span>
                    ${draft.targetAccountId ? `<button type="button" id="af-target-clear" class="ghost tiny" onclick="app.clearAutoFollowSystemTarget()">清除</button>` : ''}
                  </div>
                  <span class="af-target-or">或</span>
                  <input id="af-external" class="input af-target-external" name="externalTarget" placeholder="外部 @username 或 UID"
                    value="${this.esc(draft.externalTarget || (draft.targetAccountId ? '' : (draft.targetUsername || draft.targetTiktokUid || '')))}"
                    oninput="app.onAutoFollowTargetChange()">
                </div>
                <div id="af-target-suggest" class="combo-menu af-target-suggest"></div>
                <div class="af-field-hint muted">优先使用左侧系统账号；填写右侧外部标识时按外部目标调度。纯数字 UID 可能无法直接打开主页，建议优先 @用户名</div>
              </div>
            </div>
          </div>
          <div class="af-card">
            <div class="af-card-head">
              <b>调度参数</b>
              <span class="muted">单次任务内各关注动作之间的随机间隔</span>
            </div>
            <div class="af-card-body af-schedule-grid">
              <div class="field">
                <label>增粉数量 <span class="muted" id="af-eligible-hint">（可选上限：计算中…）</span></label>
                <input id="af-count" class="input" type="number" min="1" step="1" value="${Number(draft.followCount || 1)}"
                  oninput="app.onAfFollowCountChange()" required>
              </div>
              <div class="field">
                <label>最小间隔（小时）</label>
                <input id="af-min" class="input" type="number" min="0.01" step="0.01" value="${Number(draft.minIntervalHours || 1)}" required>
              </div>
              <div class="field">
                <label>最大间隔（小时）</label>
                <input id="af-max" class="input" type="number" min="0.01" step="0.01" value="${Number(draft.maxIntervalHours || 2)}" required>
              </div>
              ${this.saveTrafficField(draft.saveTraffic, true)}
            </div>
          </div>
          <div class="af-card">
            <div class="af-card-head">
              <b>粉丝账号</b>
              <span class="muted">随机从全部可用源抽取，或自定义账号池后再按增粉数量抽取</span>
            </div>
            <div class="af-card-body af-card-body-target">
              <div class="field full">
                <div class="warm-comment-cats" role="tablist" aria-label="粉丝账号来源">
                  <label class="warm-comment-cat af-source-cat ${sourceMode === 'random' ? 'is-on' : ''}">
                    <input type="radio" name="afSourceMode" value="random" ${sourceMode === 'random' ? 'checked' : ''} onchange="app.setAfSourceMode('random')">
                    <b>随机</b>
                    <small>全部可用源账号</small>
                  </label>
                  <label class="warm-comment-cat af-source-cat ${sourceMode === 'custom' ? 'is-on' : ''}">
                    <input type="radio" name="afSourceMode" value="custom" ${sourceMode === 'custom' ? 'checked' : ''} onchange="app.setAfSourceMode('custom')">
                    <b>自定义</b>
                    <small>所选须多于增粉数量</small>
                  </label>
                </div>
                <div id="af-source-custom-box" class="af-source-custom-box" ${sourceMode === 'custom' ? '' : 'hidden'}>
                  <div class="muted af-field-hint" style="margin:8px 0 10px">仅展示尚未关注该目标的可用账号；勾选池后系统再从中随机抽取「增粉数量」条明细</div>
                  ${this.accountPickToolbarHtml('af-source-accounts', {
                    batchHtml: `<button type="button" class="tiny" onclick="app.setAccountPickAll('af-source-accounts',true);app.updateAfSourcePickHint()">全选</button><button type="button" class="tiny" onclick="app.setAccountPickAll('af-source-accounts',false);app.updateAfSourcePickHint()">清空</button><button type="button" class="tiny" onclick="app.invertAccountPick('af-source-accounts');app.updateAfSourcePickHint()">反选</button>`,
                  }).replace(
                    `onclick="app.searchAccountPick('af-source-accounts')"`,
                    `onclick="app.reloadAfSourceAccounts()"`
                  )}
                  <div id="af-source-accounts" class="account-pick-grid" data-list-host></div>
                  <div class="muted" id="af-source-pick-hint" style="margin-top:8px">已选 0，须严格大于增粉数量</div>
                </div>
              </div>
            </div>
          </div>
          <div class="af-card">
            <div class="af-card-head">
              <b>主页操作</b>
              <span class="muted">搜索 → Users → 主页看视频 → 关注；生成明细时按概率固化</span>
            </div>
            <div class="af-card-body af-home-grid">
              <div class="field full">
                <label>搜索关键词</label>
                <input id="af-search-keyword" class="input" type="text" maxlength="255"
                  placeholder="默认用目标用户名；小号先搜索再进主页"
                  value="${this.esc(draft.searchKeyword || '')}">
                <div class="af-field-hint muted">留空则使用目标 @用户名。搜不到用户时会直达主页兜底。</div>
              </div>
              <div class="field">
                <label>观看视频数</label>
                <input id="af-watch-count" class="input" type="number" min="0" max="20" step="1" value="${Number(draft.watchVideoCount ?? 3)}">
              </div>
              <div class="field">
                <label>停留时间(秒)最小</label>
                <input id="af-stay-min" class="input" type="number" min="1" max="300" step="1" value="${Number(draft.staySecondsMin ?? 8)}">
              </div>
              <div class="field">
                <label>停留时间(秒)最大</label>
                <input id="af-stay-max" class="input" type="number" min="1" max="300" step="1" value="${Number(draft.staySecondsMax ?? 20)}">
              </div>
              ${this.rateField('afLikeRate', '点赞概率', draft.likeRate ?? 40)}
              ${this.rateField('afCommentRate', '评论概率', draft.commentRate ?? 20)}
            </div>
          </div>
          <div class="af-card">
            <div class="af-card-head">
              <b>评论内容</b>
              <span class="muted">主页视频触发评论时使用；固定可多选轮换，AI 单选一条</span>
            </div>
            <div class="af-card-body af-card-body-target">
              <div class="field full warm-comment-body">
                <div class="warm-comment-cats" role="tablist" aria-label="评论分类">
                  <label class="warm-comment-cat af-comment-cat ${commentMode === 'fixed' ? 'is-on' : ''}">
                    <input type="radio" name="afCommentMode" value="fixed" ${commentMode === 'fixed' ? 'checked' : ''} onchange="app.setAfCommentMode('fixed')">
                    <b>固定评论</b>
                    <small>多选轮换</small>
                  </label>
                  <label class="warm-comment-cat af-comment-cat ${commentMode === 'ai' ? 'is-on' : ''}">
                    <input type="radio" name="afCommentMode" value="ai" ${commentMode === 'ai' ? 'checked' : ''} onchange="app.setAfCommentMode('ai')">
                    <b>AI 英文评论</b>
                    <small>单选生成</small>
                  </label>
                </div>
                <div class="warm-comment-data">
                  <div id="af-comment-fixed-box" class="warm-comment-tpl-box" ${commentMode === 'fixed' ? '' : 'hidden'}>
                    <div class="muted warm-comment-hint">勾选「固定文案」评论模板</div>
                    <div id="af-comment-fixed-list" class="warm-comment-tpl-list">${this.renderAfCommentTplOptions(fixedTpls, 'fixed', fixedIds)}</div>
                  </div>
                  <div id="af-comment-ai-box" class="warm-comment-tpl-box" ${commentMode === 'ai' ? '' : 'hidden'}>
                    <div class="muted warm-comment-hint">选择一条「AI 提示词」评论模板</div>
                    <div id="af-comment-ai-list" class="warm-comment-tpl-list">${this.renderAfCommentTplOptions(aiTpls, 'ai', aiId ? [aiId] : [])}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="af-form-footer">
            <button type="button" class="ghost af-foot-btn" onclick="app.closeAutoFollowForm()">取消</button>
            <button type="submit" class="primary af-foot-btn">${isEdit ? '保存并重建明细' : '创建任务'}</button>
          </div>
        </form>
      </div>`;

      this.setAfCommentMode(commentMode);
      this.setAfSourceMode(sourceMode, { skipReload: true });
      this.refreshAutoFollowEligible();
    },
    setAfSourceMode(mode, opts = {}) {
      const next = String(mode || 'random') === 'custom' ? 'custom' : 'random';
      this._autoFollowDraft = this._autoFollowDraft || {};
      this._autoFollowDraft.sourceMode = next;
      document.querySelectorAll('.af-source-cat').forEach((el) => {
        const on = el.querySelector('input')?.value === next;
        el.classList.toggle('is-on', !!on);
      });
      const box = document.querySelector('#af-source-custom-box');
      if (box) box.hidden = next !== 'custom';
      if (next === 'custom' && !opts.skipReload) {
        this.reloadAfSourceAccounts();
      } else if (next === 'custom') {
        this.updateAfSourcePickHint();
      }
    },
    onAfFollowCountChange() {
      const n = Number(document.querySelector('#af-count')?.value || 0);
      if (this._autoFollowDraft) this._autoFollowDraft.followCount = n;
      this.updateAfSourcePickHint();
    },
    toggleAfSourceAccount(el) {
      this.toggleAccountPickTag(el);
      this.updateAfSourcePickHint();
    },
    updateAfSourcePickHint() {
      const hint = document.querySelector('#af-source-pick-hint');
      if (!hint) return;
      const selected = this.selectedAccountPickIds('af-source-accounts');
      const followCount = Number(document.querySelector('#af-count')?.value || this._autoFollowDraft?.followCount || 0);
      if (this._autoFollowDraft) this._autoFollowDraft.sourceAccountIds = selected;
      const ok = selected.length > followCount;
      hint.textContent = `已选 ${selected.length}，增粉数量 ${followCount}（须严格大于增粉数量${ok ? ' ✓' : ''}）`;
      hint.style.color = ok ? '' : 'var(--danger, #c0392b)';
    },
    async reloadAfSourceAccounts() {
      const box = document.querySelector('#af-source-accounts');
      if (!box) return;
      const draft = this._autoFollowDraft || {};
      const eligibleIds = Array.isArray(draft.eligibleIds) ? draft.eligibleIds.map(Number).filter(Boolean) : [];
      const selectedIds = Array.isArray(draft.sourceAccountIds) ? draft.sourceAccountIds.map(Number).filter(Boolean) : [];
      if (!eligibleIds.length) {
        box.innerHTML = `<div class="muted account-pick-empty" style="padding:12px;grid-column:1/-1">请先选择目标，或当前无可用粉丝账号</div>`;
        this.updateAfSourcePickHint();
        return;
      }
      const idSet = new Set(eligibleIds);
      await this.initAccountPickToolbar('af-source-accounts');
      await this.reloadAccountPick('af-source-accounts', {
        selectedIds,
        preserveSelection: true,
        emptyText: '筛选条件下无可用粉丝账号',
        filterFn: (a) => idSet.has(Number(a.id)),
        tagOpts: { onclick: 'app.toggleAfSourceAccount(this)' },
        onLoaded: () => this.updateAfSourcePickHint(),
      });
      const searchEl = document.querySelector('#af-source-accounts-search');
      if (searchEl) {
        searchEl.onkeydown = (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.reloadAfSourceAccounts();
          }
        };
      }
      this.updateAfSourcePickHint();
    },
    clearAutoFollowSystemTarget() {
      this._autoFollowDraft = this._autoFollowDraft || {};
      this._autoFollowDraft.targetAccountId = 0;
      this._autoFollowDraft.targetDisplay = '';
      this._autoFollowDraft.targetUsername = '';
      this._autoFollowDraft.targetTiktokUid = '';
      this.renderAutoFollowForm();
    },
    searchAutoFollowTargets(keyword) {
      clearTimeout(this._afTargetSearchTimer);
      this._afTargetSearchTimer = setTimeout(() => this._doSearchAutoFollowTargets(keyword), 300);
    },
    async _doSearchAutoFollowTargets(keyword) {
      const box = document.querySelector('#af-target-suggest');
      if (!box) return;
      const kw = String(keyword || '').trim();
      if (!kw) {
        box.innerHTML = '';
        return;
      }
      const pack = await this.api(`/auto-follow-tasks/target-search?keyword=${encodeURIComponent(kw)}&limit=20`).catch(() => ({ items: [] }));
      const items = pack.items || [];
      if (!items.length) {
        box.innerHTML = `<div class="muted" style="padding:8px">无匹配系统账号，可改用右侧外部输入</div>`;
        return;
      }
      const stripAt = (s) => String(s || '').trim().replace(/^@+/, '');
      box.innerHTML = `<div class="combo-list" style="border:1px solid var(--line);border-radius:8px;background:#fff;max-height:220px;overflow:auto">
        ${items.map((a) => {
          const uname = stripAt(a.username || '');
          const jsLabel = this.esc(a.label).replace(/'/g, "\\'");
          const jsUname = this.esc(uname).replace(/'/g, "\\'");
          return `<button type="button" class="combo-item" style="display:block;width:100%;text-align:left;padding:8px 10px;border:0;background:transparent;cursor:pointer"
          onclick="app.pickAutoFollowTarget(${a.id}, '${jsLabel}', '${jsUname}')">${this.esc(a.label)}</button>`;
        }).join('')}
      </div>`;
    },
    syncAutoFollowTargetClearBtn(show) {
      const picked = document.querySelector('#af-target-picked');
      if (!picked?.parentElement) return;
      let btn = document.querySelector('#af-target-clear');
      if (show) {
        if (!btn) {
          btn = document.createElement('button');
          btn.type = 'button';
          btn.id = 'af-target-clear';
          btn.className = 'ghost tiny';
          btn.style.flexShrink = '0';
          btn.textContent = '清除';
          btn.onclick = () => app.clearAutoFollowSystemTarget();
          picked.parentElement.appendChild(btn);
        }
      } else if (btn) {
        btn.remove();
      }
    },
    fillAutoFollowSearchKeyword(username) {
      const uname = String(username || '').trim().replace(/^@+/, '');
      if (!uname) return;
      this._autoFollowDraft = this._autoFollowDraft || {};
      this._autoFollowDraft.searchKeyword = uname;
      this._autoFollowDraft.targetUsername = uname;
      const kwInput = document.querySelector('#af-search-keyword');
      if (kwInput) kwInput.value = uname;
    },
    pickAutoFollowTarget(id, label, username) {
      this._autoFollowDraft = this._autoFollowDraft || {};
      this._autoFollowDraft.targetAccountId = Number(id) || 0;
      this._autoFollowDraft.targetDisplay = String(label || '');
      this._autoFollowDraft.externalTarget = '';
      const uname = String(username || '').trim().replace(/^@+/, '');
      const ext = document.querySelector('#af-external');
      if (ext) ext.value = '';
      const search = document.querySelector('#af-target-search');
      if (search) search.value = '';
      const picked = document.querySelector('#af-target-picked');
      const pickedLabel = '已选：' + (label || ('#' + id));
      if (picked) {
        picked.textContent = pickedLabel;
        picked.title = pickedLabel;
      }
      this.syncAutoFollowTargetClearBtn(true);
      const suggest = document.querySelector('#af-target-suggest');
      if (suggest) suggest.innerHTML = '';
      this.fillAutoFollowSearchKeyword(uname);
      this.refreshAutoFollowEligible();
    },
    onAutoFollowTargetChange() {
      const ext = String(document.querySelector('#af-external')?.value || '').trim();
      if (ext) {
        this._autoFollowDraft = this._autoFollowDraft || {};
        this._autoFollowDraft.targetAccountId = 0;
        this._autoFollowDraft.targetDisplay = '';
        this._autoFollowDraft.externalTarget = ext;
        const picked = document.querySelector('#af-target-picked');
        if (picked) {
          picked.textContent = '';
          picked.removeAttribute('title');
        }
        const search = document.querySelector('#af-target-search');
        if (search) search.value = '';
        this.syncAutoFollowTargetClearBtn(false);
        const suggest = document.querySelector('#af-target-suggest');
        if (suggest) suggest.innerHTML = '';
        // 外部目标：非纯数字 UID 时按登录用户名自动填充搜索关键词
        const uname = ext.replace(/^@+/, '').trim();
        if (uname && !/^\d+$/.test(uname)) {
          this.fillAutoFollowSearchKeyword(uname);
        }
      } else {
        this._autoFollowDraft = this._autoFollowDraft || {};
        this._autoFollowDraft.externalTarget = '';
      }
      this.refreshAutoFollowEligible();
    },
    collectAutoFollowTargetPayload() {
      const draft = this._autoFollowDraft || {};
      const external = String(document.querySelector('#af-external')?.value || draft.externalTarget || '').trim();
      const payload = {};
      if (Number(draft.targetAccountId || 0) > 0 && !external) {
        payload.targetAccountId = Number(draft.targetAccountId);
      } else if (external) {
        payload.externalTarget = external;
      } else if (draft.targetUsername || draft.targetTiktokUid) {
        if (draft.targetUsername) payload.targetUsername = draft.targetUsername;
        if (draft.targetTiktokUid) payload.targetTiktokUid = draft.targetTiktokUid;
      }
      return payload;
    },
    async refreshAutoFollowEligible() {
      const hint = document.querySelector('#af-eligible-hint');
      const payload = this.collectAutoFollowTargetPayload();
      if (!payload.targetAccountId && !payload.externalTarget && !payload.targetUsername && !payload.targetTiktokUid) {
        if (hint) hint.textContent = '（请先选择或填写目标）';
        if (this._autoFollowDraft) {
          this._autoFollowDraft.eligibleCount = 0;
          this._autoFollowDraft.eligibleIds = [];
        }
        if ((this._autoFollowDraft?.sourceMode || 'random') === 'custom') {
          this.reloadAfSourceAccounts();
        }
        return;
      }
      const qs = new URLSearchParams();
      Object.entries(payload).forEach(([k, v]) => qs.set(k, String(v)));
      try {
        const pack = await this.api(`/auto-follow-tasks/eligible-accounts?${qs}`);
        const ids = Array.isArray(pack.ids)
          ? pack.ids.map(Number).filter(Boolean)
          : (pack.items || []).map((x) => Number(x.id)).filter(Boolean);
        const count = Number(pack.count ?? ids.length) || 0;
        if (this._autoFollowDraft) {
          this._autoFollowDraft.eligibleCount = count;
          this._autoFollowDraft.eligibleIds = ids;
          // 去掉已不可用的勾选
          const idSet = new Set(ids);
          this._autoFollowDraft.sourceAccountIds = (this._autoFollowDraft.sourceAccountIds || [])
            .map(Number).filter((id) => idSet.has(id));
        }
        if (hint) hint.textContent = `（可选上限：${count}）`;
        const countInput = document.querySelector('#af-count');
        if (countInput && count > 0) {
          countInput.max = String(count);
          if (Number(countInput.value || 0) > count) countInput.value = String(count);
        }
        if ((this._autoFollowDraft?.sourceMode || 'random') === 'custom') {
          await this.reloadAfSourceAccounts();
        }
      } catch (e) {
        if (hint) hint.textContent = `（${e.message || '无法计算上限'}）`;
        if (this._autoFollowDraft) {
          this._autoFollowDraft.eligibleCount = 0;
          this._autoFollowDraft.eligibleIds = [];
        }
      }
    },
    async submitAutoFollowForm() {
      if (!this.canEditAutoFollow()) {
        this.toast('无权操作', true);
        return;
      }
      const payload = this.collectAutoFollowTargetPayload();
      const followCount = Number(document.querySelector('#af-count')?.value || 0);
      const sourceMode = String(
        document.querySelector('input[name=afSourceMode]:checked')?.value
        || this._autoFollowDraft?.sourceMode
        || 'random'
      ) === 'custom' ? 'custom' : 'random';
      const sourceAccountIds = sourceMode === 'custom'
        ? this.selectedAccountPickIds('af-source-accounts')
        : [];
      const minIntervalHours = Number(document.querySelector('#af-min')?.value || 0);
      const maxIntervalHours = Number(document.querySelector('#af-max')?.value || 0);
      const searchKeyword = String(document.querySelector('#af-search-keyword')?.value || '').trim();
      const watchVideoCount = Number(document.querySelector('#af-watch-count')?.value ?? 3);
      const staySecondsMin = Number(document.querySelector('#af-stay-min')?.value || 8);
      const staySecondsMax = Number(document.querySelector('#af-stay-max')?.value || 20);
      const likeRate = Number(document.querySelector('input[name=afLikeRate]')?.value ?? 40);
      const commentRate = Number(document.querySelector('input[name=afCommentRate]')?.value ?? 20);
      const commentPayload = this.collectAfCommentPayload();

      if (!payload.targetAccountId && !payload.externalTarget && !payload.targetUsername && !payload.targetTiktokUid) {
        this.toast('请选择系统账号或填写外部 TikTok 用户名/UID', true);
        return;
      }
      if (followCount < 1) {
        this.toast('请填写增粉数量', true);
        return;
      }
      if (sourceMode === 'custom') {
        if (!sourceAccountIds.length) {
          this.toast('自定义模式请至少选择粉丝账号', true);
          return;
        }
        if (!(sourceAccountIds.length > followCount)) {
          this.toast(`自定义所选粉丝账号数须大于增粉数量（已选 ${sourceAccountIds.length}，增粉数量 ${followCount}）`, true);
          return;
        }
      }
      if (!(minIntervalHours > 0) || !(maxIntervalHours > 0) || minIntervalHours > maxIntervalHours) {
        this.toast('间隔须满足 0 < 最小 ≤ 最大', true);
        return;
      }
      if (!(staySecondsMin >= 1) || staySecondsMin > staySecondsMax) {
        this.toast('停留时间须满足 1 ≤ 最小 ≤ 最大', true);
        return;
      }
      if (watchVideoCount < 0 || watchVideoCount > 20) {
        this.toast('观看视频数须在 0 ~ 20', true);
        return;
      }
      if (commentRate > 0) {
        if (commentPayload.commentMode === 'ai' && !commentPayload.commentAiTemplateId && !commentPayload.commentAiPrompt) {
          this.toast('请选择一条 AI 评论模板', true);
          return;
        }
        if (commentPayload.commentMode === 'fixed' && !(commentPayload.commentTemplateIds || []).length) {
          this.toast('请至少勾选一条固定评论模板', true);
          return;
        }
      }

      const saveTraffic = this.parseSaveTrafficInput(
        document.querySelector('[name=saveTraffic]')?.value ?? this._autoFollowDraft?.saveTraffic,
        true
      );
      const body = JSON.stringify({
        ...payload,
        followCount,
        sourceMode,
        sourceAccountIds: sourceMode === 'custom' ? sourceAccountIds : undefined,
        saveTraffic,
        minIntervalHours,
        maxIntervalHours,
        searchKeyword,
        watchVideoCount,
        staySecondsMin,
        staySecondsMax,
        likeRate,
        commentRate,
        ...commentPayload,
      });
      const editId = Number(this.autoFollowEditId || 0) || 0;
      const isEdit = this.autoFollowPane === 'edit' && editId > 0;
      try {
        if (isEdit) {
          await this.api(`/auto-follow-tasks/${editId}`, { method: 'PUT', body });
          this.toast('已更新并重建明细');
        } else {
          await this.api('/auto-follow-tasks', { method: 'POST', body });
          this.toast('已创建增粉任务');
        }
        this.closeAutoFollowForm();
      } catch (e) {
        this.toast(e.message || '保存失败', true);
      }
    },
  };

  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages.autoFollow = true;
})();
