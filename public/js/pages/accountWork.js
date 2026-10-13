(function () {
  if (!window.app) throw new Error('app-core must load before pages/accountWork.js');

  const TYPE_LABELS = {
    modify_profile: '修改资料',
    publish: '发布视频',
    delete_video: '删除视频',
    comment_reply: '回复评论',
    dm_reply: '回复私信',
    message: '私信',
    ai_lead: 'AI拓客',
    warm: '养号',
    diagnose: '账号诊断',
    dm_sync: '私信同步',
    pull_stats: '拉取数据',
    sync_fans: '同步粉丝',
    sync: '同步视频',
    profile: '拉取数据',
  };

  const __methods = {
    workTypeLabel(type) {
      return TYPE_LABELS[type] || type || '-';
    },
    async renderAccountWork(opts = {}) {
      const still = typeof opts.still === 'function' ? opts.still : () => this.view === 'accountWork';
      const soft = !!opts.soft;
      document.querySelector('#content').classList.remove('chat-mode');
      if (!soft && this.accountWorkRefreshTimer) {
        clearInterval(this.accountWorkRefreshTimer);
        this.accountWorkRefreshTimer = null;
      }

      const page = this.accountWorkPage || 1;
      const status = this.accountWorkStatus || '';
      const accountId = this.accountWorkAccountId || '';
      const keyword = String(this.accountWorkKeyword || '').trim();
      const createdFrom = String(this.accountWorkCreatedFrom || '').trim();
      const createdTo = String(this.accountWorkCreatedTo || '').trim();
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: '20',
      });
      if (status) qs.set('status', status);
      if (accountId) qs.set('accountId', String(accountId));
      if (keyword) qs.set('keyword', keyword);
      if (createdFrom) qs.set('createdFrom', createdFrom);
      if (createdTo) qs.set('createdTo', createdTo);

      const [pack, accountsPack] = await Promise.all([
        this.api(`/account-work-batches?${qs.toString()}`).catch(() => ({ list: [], items: [], total: 0, page: 1, pages: 1 })),
        soft
          ? Promise.resolve({ items: this._accountWorkAccountsCache || [] })
          : this.api('/accounts?page=1&pageSize=200').catch(() => ({ items: [] })),
      ]);
      if (!still()) return;

      const rows = pack.list || pack.items || [];
      const accounts = accountsPack.items || [];
      if (!soft) this._accountWorkAccountsCache = accounts;
      this._accountWorkExpanded = this._accountWorkExpanded || {};
      this._accountWorkItemsCache = this._accountWorkItemsCache || {};

      // Soft poll: update batch cells in place; keep expanded item rows (no full DOM wipe).
      if (soft && document.querySelector('.account-work-panel .aw-table')) {
        // DOM 已有子任务行 ⇒ 视为展开（修复 soft patch 后按钮仍显示「展开」、且不再拉全量子任务）
        document.querySelectorAll('tr.aw-batch-row[data-batch-id]').forEach((tr) => {
          const bid = Number(tr.getAttribute('data-batch-id'));
          if (!bid) return;
          if (document.querySelector(`tr.aw-item-row[data-batch-id="${bid}"]`)) {
            this._accountWorkExpanded[bid] = true;
          }
        });
        this.patchAccountWorkBatches(rows);
        const expandedIds = Object.keys(this._accountWorkExpanded).filter((id) => this._accountWorkExpanded[id]);
        // 串行刷新，避免多个 quiet remount 交错清掉刚插入的行
        (async () => {
          for (const id of expandedIds) {
            if (!rows.some((r) => String(r.id) === String(id))) continue;
            try { await this.refreshAccountWorkItemsQuiet(Number(id)); } catch { /* ignore */ }
          }
        })();
        this.ensureAccountWorkPoll(rows);
        return;
      }

      const statusOpts = [
        ['', '全部状态'],
        ['pending', '待执行'],
        ['running', '执行中'],
        ['paused', '已暂停'],
        ['completed', '已完成'],
        ['failed', '失败'],
        ['cancelled', '已取消'],
        ['deleted', '已删除'],
      ];
      const accountOpts = [['', '全部账号'], ...accounts.map((a) => [String(a.id), `${a.username || ('#' + a.id)}`])];

      document.querySelector('#content').innerHTML = `<div class="panel list-panel account-work-panel">
        <div class="matrix-action-bar">
          <div class="left">
            <button class="ghost" type="button" onclick="app.refresh()">刷新</button>
            <button class="ghost" type="button" onclick="app.expandAllAccountWork(true)">全部展开</button>
            <button class="ghost" type="button" onclick="app.expandAllAccountWork(false)">全部收起</button>
          </div>
          <div class="right"><span class="muted">总任务 = 一次比特登录会话；子任务顺序：登录→改资料→发布→删视频→回评→回私信→养号→诊断→登出</span></div>
        </div>
        <div class="search-bar task-filter-bar">
          <select id="aw-account-filter" class="input" title="按账号筛选">${accountOpts.map(([v, n]) => `<option value="${this.esc(v)}" ${String(accountId) === String(v) ? 'selected' : ''}>${this.esc(n)}</option>`).join('')}</select>
          <select id="aw-status-filter" class="input" title="总任务状态">${statusOpts.map(([v, n]) => `<option value="${this.esc(v)}" ${status === v ? 'selected' : ''}>${this.esc(n)}</option>`).join('')}</select>
          <input id="aw-created-from" class="input" type="date" title="创建时间起" value="${this.esc(createdFrom)}" aria-label="创建时间起">
          <span class="muted" style="align-self:center">至</span>
          <input id="aw-created-to" class="input" type="date" title="创建时间止" value="${this.esc(createdTo)}" aria-label="创建时间止">
          <input id="aw-keyword-filter" class="input" type="search" placeholder="账号名 / 账号ID / 总任务ID" value="${this.esc(keyword)}" onkeydown="if(event.key==='Enter')app.searchAccountWork()">
          <button class="primary" type="button" onclick="app.searchAccountWork()">搜索</button>
          <button class="ghost" type="button" onclick="app.resetAccountWorkFilters()">清空筛选</button>
        </div>
        <div class="table-container aw-table-scroll">${this.accountWorkTable(rows)}</div>
        ${UI.pager({ ...pack, items: rows, page: pack.page || page, pages: pack.pages || 1, total: pack.total || 0, pageSize: pack.pageSize || 20 }, 'accountWorkPage')}
      </div>`;

      const expandedIds = Object.keys(this._accountWorkExpanded).filter((id) => this._accountWorkExpanded[id]);
      for (const id of expandedIds) {
        if (rows.some((r) => String(r.id) === String(id))) {
          // 全量重绘后必须强制拉子任务，避免陈旧 cache 少渲染
          this.loadAccountWorkItems(Number(id), true).catch(() => {});
        }
      }

      this.ensureAccountWorkPoll(rows);
    },

    ensureAccountWorkPoll(rows) {
      const need = (rows || []).some((x) => ['pending', 'running', 'paused'].includes(x.status));
      if (!need) {
        if (this.accountWorkRefreshTimer) {
          clearInterval(this.accountWorkRefreshTimer);
          this.accountWorkRefreshTimer = null;
        }
        return;
      }
      if (this.accountWorkRefreshTimer) return;
      this.accountWorkRefreshTimer = setInterval(() => {
        if (this.view !== 'accountWork') {
          clearInterval(this.accountWorkRefreshTimer);
          this.accountWorkRefreshTimer = null;
          return;
        }
        // 确认框/弹层打开时不要刷表，避免冲掉点击与确认
        if (document.querySelector('#confirm-mask:not(.hidden), #modal-mask:not(.hidden), .modal-mask:not(.hidden)')) {
          return;
        }
        this.renderAccountWork({ soft: true }).catch(() => {});
      }, 5000);
    },

    patchAccountWorkBatches(rows) {
      const seen = new Set();
      let missing = false;
      for (const x of rows || []) {
        const id = Number(x.id);
        seen.add(String(id));
        const tr = document.querySelector(`tr.aw-batch-row[data-batch-id="${id}"]`);
        if (!tr) {
          missing = true;
          continue;
        }
        const liveTotal = (x.item_count != null && x.item_count !== '') ? x.item_count : x.item_total;
        const sig = `${x.status}|${liveTotal}|${x.item_success}|${x.item_fail}|${x.pending_count}|${x.paused_count}|${x.started_at}|${x.finished_at}`;
        if (tr.dataset.awSig === sig) continue;
        const tmp = document.createElement('tbody');
        tmp.innerHTML = this.accountWorkBatchRow(x);
        const next = tmp.firstElementChild;
        if (!next) continue;
        // 按展开状态重绘行内容（展开/收起文案与 ▾/▸ 一致），不拆掉后续子任务行
        tr.innerHTML = next.innerHTML;
        tr.dataset.awSig = sig;
      }
      const domIds = [...document.querySelectorAll('tr.aw-batch-row[data-batch-id]')].map((el) => el.getAttribute('data-batch-id'));
      const extra = domIds.some((id) => !seen.has(String(id)));
      if (missing || extra || domIds.length !== seen.size) {
        this.renderAccountWork({ soft: false }).catch(() => {});
      }
    },

    searchAccountWork() {
      this.accountWorkAccountId = String(document.querySelector('#aw-account-filter')?.value || '').trim();
      this.accountWorkStatus = String(document.querySelector('#aw-status-filter')?.value || '').trim();
      this.accountWorkKeyword = String(document.querySelector('#aw-keyword-filter')?.value || '').trim();
      this.accountWorkCreatedFrom = String(document.querySelector('#aw-created-from')?.value || '').trim();
      this.accountWorkCreatedTo = String(document.querySelector('#aw-created-to')?.value || '').trim();
      this.accountWorkPage = 1;
      this.refresh();
    },

    resetAccountWorkFilters() {
      this.accountWorkAccountId = '';
      this.accountWorkStatus = '';
      this.accountWorkKeyword = '';
      this.accountWorkCreatedFrom = '';
      this.accountWorkCreatedTo = '';
      this.accountWorkPage = 1;
      this.refresh();
    },

    expandAllAccountWork(open) {
      const rows = document.querySelectorAll('tr.aw-batch-row[data-batch-id]');
      rows.forEach((tr) => {
        const id = Number(tr.getAttribute('data-batch-id'));
        if (!id) return;
        this._accountWorkExpanded[id] = !!open;
        const fold = tr.querySelector('.aw-fold');
        const foldBtn = tr.querySelector('.task-ops-cell button.ghost');
        if (open) {
          if (fold) fold.textContent = '▾';
          if (foldBtn) foldBtn.textContent = '收起';
          this.loadAccountWorkItems(id, true);
        } else {
          this.clearAccountWorkItems(id);
          if (fold) fold.textContent = '▸';
          if (foldBtn) foldBtn.textContent = '展开';
        }
      });
    },

    accountWorkTable(rows) {
      if (!rows.length) return '<div class="empty">暂无账号会话总任务。发布/养号/私信等入队后会自动挂到这里。</div>';
      return `<table class="aw-table"><thead><tr>
        <th style="width:36px"></th>
        <th>总任务</th><th>账号</th><th>进度</th><th>状态</th><th>开始/结束</th><th>操作</th>
      </tr></thead><tbody>${rows.map((x) => this.accountWorkBatchRow(x)).join('')}</tbody></table>`;
    },

    accountWorkBatchRow(x) {
      const id = Number(x.id);
      const expanded = !!(this._accountWorkExpanded && (this._accountWorkExpanded[id] || this._accountWorkExpanded[String(id)]));
      // 优先用实时 COUNT(item_count)；item_total 冗余字段偶发偏大，会出现「显示 9 条却只列出 7」
      // 已展开且本地 cache 有完整列表时，以 cache 长度为准（避免 soft poll 用旧 item_total）
      const cachedLen = (this._accountWorkItemsCache && this._accountWorkItemsCache[id])
        ? this._accountWorkItemsCache[id].length
        : null;
      let total = (x.item_count != null && x.item_count !== '')
        ? Number(x.item_count)
        : Number(x.item_total || 0);
      if (expanded && cachedLen != null && cachedLen > 0) {
        total = cachedLen;
      }
      const ok = Number(x.item_success || 0);
      const fail = Number(x.item_fail || 0);
      const pending = Number(x.pending_count || 0);
      const paused = Number(x.paused_count || 0);
      const done = ok + fail;
      const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
      const canPause = ['pending', 'running'].includes(x.status);
      const canResume = x.status === 'paused';
      const canDelete = x.status !== 'deleted' && !x.deleted_at;
      const canReset = canDelete;
      const ops = [];
      if (canPause) ops.push(`<button class="tiny" type="button" onclick="app.pauseAccountWorkBatch(${id})">暂停</button>`);
      if (canResume) ops.push(`<button class="tiny primary" type="button" onclick="app.resumeAccountWorkBatch(${id})">恢复</button>`);
      if (canReset) ops.push(`<button class="tiny warn" type="button" onclick="app.resetAccountWorkBatch(${id})">重置</button>`);
      if (canDelete) ops.push(`<button class="tiny danger" type="button" onclick="app.deleteAccountWorkBatch(${id})">删除</button>`);
      if (canDelete) ops.push(`<button class="tiny info" type="button" onclick="app.testAccountWorkBatch(${id})">测试</button>`);
      ops.push(`<button class="tiny ghost" type="button" onclick="app.toggleAccountWorkBatch(${id})">${expanded ? '收起' : '展开'}</button>`);

      return `<tr class="aw-batch-row" data-batch-id="${id}">
        <td><button type="button" class="aw-fold tiny ghost" title="展开/收起" onclick="app.toggleAccountWorkBatch(${id})">${expanded ? '▾' : '▸'}</button></td>
        <td><b>#${id}</b><div class="muted">子任务 ${total} · 待执行 ${pending}${paused ? ` · 暂停 ${paused}` : ''}</div><div class="muted">创建 ${this.esc(String(x.created_at || '-').slice(0, 16))}</div></td>
        <td><b>${this.esc(x.username || '-')}</b><div class="muted">账号 #${x.account_id || '-'}</div></td>
        <td><div class="progress"><i style="width:${pct}%"></i></div><span class="muted">${ok}/${total}${fail ? ` · 失败 ${fail}` : ''}</span></td>
        <td>${this.badge(x.status)}</td>
        <td><div class="muted">${this.esc(x.started_at || '-')}</div><div class="muted">${this.esc(x.finished_at || '')}</div></td>
        <td><div class="task-ops-cell">${ops.join('')}</div></td>
      </tr>`;
    },

    workItemStatusBadge(status) {
      const map = {
        pending: '待执行',
        running: '执行中',
        paused: '已暂停',
        completed: '已完成',
        failed: '失败',
        skipped: '已跳过',
        cancelled: '已取消',
      };
      const key = String(status || '');
      return `<span class="badge ${this.esc(key)}">${map[key] || this.esc(key) || '-'}</span>`;
    },

    async toggleAccountWorkBatch(id) {
      this._accountWorkExpanded = this._accountWorkExpanded || {};
      const open = !this._accountWorkExpanded[id];
      this._accountWorkExpanded[id] = open;
      const batchTr = document.querySelector(`tr.aw-batch-row[data-batch-id="${id}"]`);
      const fold = batchTr?.querySelector('.aw-fold');
      const foldBtn = batchTr?.querySelector('.task-ops-cell button.ghost');
      this.clearAccountWorkItems(id);
      if (!open) {
        if (fold) fold.textContent = '▸';
        if (foldBtn) foldBtn.textContent = '展开';
        return;
      }
      if (fold) fold.textContent = '▾';
      if (foldBtn) foldBtn.textContent = '收起';
      await this.loadAccountWorkItems(id, true);
    },

    async loadAccountWorkItems(id, force) {
      this._accountWorkItemsCache = this._accountWorkItemsCache || {};
      let batchRow = document.querySelector(`tr.aw-batch-row[data-batch-id="${id}"]`);
      if (!batchRow) return;

      if (!force && this._accountWorkItemsCache[id]) {
        this.mountAccountWorkItems(id, this._accountWorkItemsCache[id]);
        return;
      }

      this.clearAccountWorkItems(id);
      batchRow.insertAdjacentHTML(
        'afterend',
        `<tr class="aw-item-row aw-item-loading" data-batch-id="${id}"><td></td><td colspan="6"><div class="muted aw-item-indent">加载子任务中…</div></td></tr>`
      );
      this._accountWorkLoadGen = this._accountWorkLoadGen || {};
      this._accountWorkLoadGen[id] = (this._accountWorkLoadGen[id] || 0) + 1;
      const myGen = this._accountWorkLoadGen[id];
      try {
        const pack = await this.api(`/account-work-batches/${id}/items`);
        if (myGen !== this._accountWorkLoadGen[id]) return;
        const items = Array.isArray(pack?.items) ? pack.items : [];
        this._accountWorkItemsCache[id] = items;
        if (!(this._accountWorkExpanded && this._accountWorkExpanded[id])) {
          this.clearAccountWorkItems(id);
          return;
        }
        this.mountAccountWorkItems(id, items);
        this.syncAccountWorkBatchSummary(id, items.length, pack?.batch);
      } catch (e) {
        if (myGen !== this._accountWorkLoadGen[id]) return;
        if (!(this._accountWorkExpanded && this._accountWorkExpanded[id])) {
          this.clearAccountWorkItems(id);
          return;
        }
        batchRow = document.querySelector(`tr.aw-batch-row[data-batch-id="${id}"]`);
        if (!batchRow || !batchRow.isConnected) return;
        this.clearAccountWorkItems(id);
        batchRow.insertAdjacentHTML(
          'afterend',
          `<tr class="aw-item-row" data-batch-id="${id}"><td></td><td colspan="6"><div class="empty aw-item-indent">${this.esc(e.message || '加载失败')}</div></td></tr>`
        );
      }
    },

    /** Poll refresh for expanded items: no loading flash, re-query DOM after await. */
    async refreshAccountWorkItemsQuiet(id) {
      if (!(this._accountWorkExpanded && this._accountWorkExpanded[id])) return;
      try {
        const pack = await this.api(`/account-work-batches/${id}/items`);
        const items = Array.isArray(pack?.items) ? pack.items : [];
        this._accountWorkItemsCache = this._accountWorkItemsCache || {};
        const sig = (arr) => (arr || []).map((x) => `${x.id}:${x.status}:${x.finished_at || ''}:${x.error_message || ''}`).join('|');
        const domCount = document.querySelectorAll(`tr.aw-item-row[data-batch-id="${id}"]:not(.aw-item-loading):not(.aw-item-foot)`).length;
        const prev = this._accountWorkItemsCache[id];
        const unchanged = sig(items) === sig(prev)
          && domCount === items.length
          && items.length > 0;
        this._accountWorkItemsCache[id] = items;
        if (unchanged) {
          this.syncAccountWorkBatchSummary(id, items.length, pack?.batch);
          return;
        }
        if (!(this._accountWorkExpanded && this._accountWorkExpanded[id])) return;
        this.mountAccountWorkItems(id, items);
        this.syncAccountWorkBatchSummary(id, items.length, pack?.batch);
      } catch {
        /* keep existing rows on poll failure */
      }
    },

    clearAccountWorkItems(batchId) {
      document.querySelectorAll(`tr.aw-item-row[data-batch-id="${batchId}"]`).forEach((el) => el.remove());
    },

    /** 逐条 DOM 插入，避免多 tr 字符串 insertAdjacentHTML 被浏览器吞行 */
    mountAccountWorkItems(batchId, items) {
      const batchRow = document.querySelector(`tr.aw-batch-row[data-batch-id="${batchId}"]`);
      if (!batchRow || !batchRow.isConnected) return;
      this.clearAccountWorkItems(batchId);
      if (!items.length) {
        batchRow.insertAdjacentHTML(
          'afterend',
          `<tr class="aw-item-row" data-batch-id="${batchId}"><td></td><td colspan="6"><div class="muted aw-item-indent">该总任务暂无子任务</div></td></tr>`
        );
        return;
      }
      // 新→旧：按 id 降序逐条 after 插入
      const sorted = [...items].sort((a, b) => Number(b.id) - Number(a.id));
      let ref = batchRow;
      const tbody = document.createElement('tbody');
      for (const it of sorted) {
        tbody.innerHTML = this.accountWorkItemRowHtml(batchId, it);
        const tr = tbody.firstElementChild;
        if (!tr) continue;
        ref.after(tr);
        ref = tr;
      }
      // 底部汇总行，避免「以为没加载全」
      const foot = document.createElement('tbody');
      foot.innerHTML = `<tr class="aw-item-row aw-item-foot" data-batch-id="${batchId}"><td></td><td colspan="6"><div class="muted aw-item-indent">已展开 ${sorted.length} 条子任务</div></td></tr>`;
      if (foot.firstElementChild) ref.after(foot.firstElementChild);

      const mounted = document.querySelectorAll(`tr.aw-item-row[data-batch-id="${batchId}"]:not(.aw-item-loading):not(.aw-item-foot)`).length;
      if (mounted !== sorted.length) {
        console.warn(`[accountWork] batch #${batchId} mounted ${mounted}/${sorted.length}, retry html join`);
        this.clearAccountWorkItems(batchId);
        batchRow.insertAdjacentHTML('afterend', sorted.map((it) => this.accountWorkItemRowHtml(batchId, it)).join('')
          + `<tr class="aw-item-row aw-item-foot" data-batch-id="${batchId}"><td></td><td colspan="6"><div class="muted aw-item-indent">已展开 ${sorted.length} 条子任务</div></td></tr>`);
      }
      // 展开后滚到汇总行，避免底部子任务落在隐藏滚动区域外被误以为「没显示」
      const footEl = document.querySelector(`tr.aw-item-foot[data-batch-id="${batchId}"]`);
      const scroller = document.querySelector('.account-work-panel .aw-table-scroll');
      if (footEl && scroller) {
        try { footEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch { /* ignore */ }
      }
    },

    syncAccountWorkBatchSummary(batchId, liveCount, batch) {
      const tr = document.querySelector(`tr.aw-batch-row[data-batch-id="${batchId}"]`);
      if (!tr) return;
      const pending = batch && batch.pending_count != null
        ? Number(batch.pending_count)
        : liveCount;
      const pausedN = batch && batch.paused_count != null
        ? Number(batch.paused_count)
        : 0;
      const meta = tr.children[1]?.querySelector('.muted');
      if (meta && liveCount >= 0) {
        meta.textContent = `子任务 ${liveCount} · 待执行 ${pending}${pausedN ? ` · 暂停 ${pausedN}` : ''}`;
      }
      const ok = Number(batch?.item_success ?? 0);
      const fail = Number(batch?.item_fail ?? 0);
      const prog = tr.children[3]?.querySelector('.muted');
      if (prog) {
        prog.textContent = `${ok}/${liveCount}${fail ? ` · 失败 ${fail}` : ''}`;
      }
      const bar = tr.children[3]?.querySelector('.progress > i');
      if (bar && liveCount > 0) {
        const done = ok + fail;
        bar.style.width = `${Math.min(100, Math.round((done / liveCount) * 100))}%`;
      }
      tr.dataset.awSig = ''; // 下次 soft poll 用最新汇总重绘
    },

    accountWorkItemRowHtml(batchId, it) {
      const canPause = it.status === 'pending';
      const canResume = it.status === 'paused';
      const ops = [];
      ops.push(`<button class="tiny" type="button" onclick="app.viewAccountWorkItemLogs(${batchId},${it.id})">日志</button>`);
      if (canPause) ops.push(`<button class="tiny" type="button" onclick="app.pauseAccountWorkItem(${batchId},${it.id})">暂停</button>`);
      if (canResume) ops.push(`<button class="tiny primary" type="button" onclick="app.resumeAccountWorkItem(${batchId},${it.id})">恢复</button>`);
      ops.push(`<button class="tiny warn" type="button" onclick="app.resetAccountWorkItem(${batchId},${it.id})">重置</button>`);
      if (it.status !== 'cancelled') {
        ops.push(`<button class="tiny info" type="button" onclick="app.testAccountWorkItem(${batchId},${it.id})">测试</button>`);
      }
      const err = it.error_message
        ? `<div class="muted" style="color:#c0392b">${this.esc(String(it.error_message).slice(0, 80))}</div>`
        : '';
      const typeLabel = this.workTypeLabel(it.task_type);
      return `<tr class="aw-item-row" data-batch-id="${batchId}" data-item-id="${it.id}">
          <td><span class="aw-item-marker" aria-hidden="true"></span></td>
          <td><div class="aw-item-indent"><b>#${it.id}</b><div class="muted">${this.esc(typeLabel)}</div></div></td>
          <td><div class="aw-item-indent"><b>${this.esc(typeLabel)}</b><div class="muted">${it.task_ref_id ? `关联任务 #${it.task_ref_id}` : '子任务'}</div></div></td>
          <td><span class="muted">P${it.priority || 0} · #${it.seq || 0}</span></td>
          <td>${this.workItemStatusBadge(it.status)}${err}</td>
          <td><div class="muted">${this.esc(it.started_at || it.created_at || '-')}</div><div class="muted">${this.esc(it.finished_at || '')}</div></td>
          <td><div class="task-ops-cell">${ops.join('') || '<span class="muted">-</span>'}</div></td>
        </tr>`;
    },

    async pauseAccountWorkBatch(id) {
      if (!(await this.ask('暂停后该账号会话将停止领取新的子任务，确认？'))) return;
      try {
        await this.api(`/account-work-batches/${id}/pause`, { method: 'POST', body: '{}' });
        this.toast('总任务已暂停');
        delete (this._accountWorkItemsCache || {})[id];
        this.refresh();
      } catch (e) { this.toast(e.message, true); }
    },

    async resumeAccountWorkBatch(id) {
      try {
        await this.api(`/account-work-batches/${id}/resume`, { method: 'POST', body: '{}' });
        this.toast('总任务已恢复，将重新排队执行');
        delete (this._accountWorkItemsCache || {})[id];
        this.refresh();
      } catch (e) { this.toast(e.message, true); }
    },

    async resetAccountWorkBatch(id) {
      if (!(await this.ask(
        `确认重置总任务 #${id}？\n将把该总任务下全部子任务状态改回「待执行」，并清除执行结果/错误，总任务也会重新排队。此操作不可撤销。`,
        'warn'
      ))) return;
      try {
        await this.api(`/account-work-batches/${id}/reset`, { method: 'POST', body: '{}' });
        this.toast(`总任务 #${id} 已重置为待执行`);
        delete (this._accountWorkItemsCache || {})[id];
        this.refresh();
      } catch (e) { this.toast(e.message, true); }
    },

    async deleteAccountWorkBatch(id) {
      if (!(await this.ask('确认软删除该总任务？未执行的子任务将取消，且不会再被领取执行（记录仍可筛选「已删除」查看）。'))) return;
      try {
        await this.api(`/account-work-batches/${id}/delete`, { method: 'POST', body: '{}' });
        this.toast('总任务已删除');
        delete (this._accountWorkItemsCache || {})[id];
        if (this._accountWorkExpanded) delete this._accountWorkExpanded[id];
        this.refresh();
      } catch (e) { this.toast(e.message, true); }
    },

    async pauseAccountWorkItem(batchId, itemId) {
      try {
        await this.api(`/account-work-batches/${batchId}/items/${itemId}/pause`, { method: 'POST', body: '{}' });
        this.toast('子任务已暂停');
        delete (this._accountWorkItemsCache || {})[batchId];
        await this.loadAccountWorkItems(batchId, true);
      } catch (e) { this.toast(e.message, true); }
    },

    async resumeAccountWorkItem(batchId, itemId) {
      try {
        await this.api(`/account-work-batches/${batchId}/items/${itemId}/resume`, { method: 'POST', body: '{}' });
        this.toast('子任务已恢复');
        delete (this._accountWorkItemsCache || {})[batchId];
        await this.loadAccountWorkItems(batchId, true);
        this.refresh();
      } catch (e) { this.toast(e.message, true); }
    },

    async resetAccountWorkItem(batchId, itemId) {
      if (!(await this.ask(
        `确认重置子任务 #${itemId}？\n仅将该子任务与所属总任务 #${batchId} 改回「待执行」，其它子任务状态不变。`,
        'warn'
      ))) return;
      try {
        await this.api(`/account-work-batches/${batchId}/items/${itemId}/reset`, { method: 'POST', body: '{}' });
        this.toast(`子任务 #${itemId} 已重置为待执行`);
        delete (this._accountWorkItemsCache || {})[batchId];
        await this.loadAccountWorkItems(batchId, true);
        this.refresh();
      } catch (e) { this.toast(e.message, true); }
    },

    async testAccountWorkBatch(id) {
      this.toast('正在检测比特…', 'info', 1500);
      if (!(await this.ensureBitOnline('测试总任务'))) return;
      if (!(await this.ask(`确认测试总任务 #${id}？将按分任务顺序依次打开比特执行（跳过已取消）。`))) return;
      try {
        this.toast(`正在启动总任务 #${id} 测试…`, 'info');
        await this.api('/executor/test-batch', {
          method: 'POST',
          body: JSON.stringify({ batchId: Number(id) }),
        });
        this.toast(`总任务 #${id} 已开始测试，请看实时日志与比特窗口`);
      } catch (e) { this.toast(e.message || '测试失败', true); }
    },

    async testAccountWorkItem(batchId, itemId) {
      this.toast('正在检测比特…', 'info', 1500);
      if (!(await this.ensureBitOnline('测试分任务'))) return;
      if (!(await this.ask(`确认测试分任务 #${itemId}？将打开比特浏览器执行该分任务。`))) return;
      try {
        this.toast(`正在启动分任务 #${itemId} 测试…`, 'info');
        await this.api('/executor/test-item', {
          method: 'POST',
          body: JSON.stringify({ batchId: Number(batchId), itemId: Number(itemId) }),
        });
        this.toast(`分任务 #${itemId} 已开始测试，请看实时日志与比特窗口`);
      } catch (e) { this.toast(e.message || '测试失败', true); }
    },

    async viewAccountWorkItemLogs(batchId, itemId) {
      try {
        const pack = await this.api(`/account-work-batches/${batchId}/items/${itemId}/logs?limit=300`);
        const rows = pack.items || [];
        const typeLabel = this.workTypeLabel(pack.taskType || '');
        const levelClass = (lv) => {
          const l = String(lv || 'info').toLowerCase();
          if (l === 'error') return 'danger';
          if (l === 'warn' || l === 'warning') return 'warn';
          if (l === 'success') return 'online';
          return 'pending';
        };
        const body = rows.length
          ? `<div class="table-container" style="max-height:min(60vh,480px);overflow:auto">
              <table>
                <thead><tr><th style="width:150px">时间</th><th style="width:72px">级别</th><th>内容</th></tr></thead>
                <tbody>${rows.map((r) => `
                  <tr>
                    <td class="muted">${this.esc(String(r.created_at || '-').slice(0, 19))}</td>
                    <td><span class="badge ${levelClass(r.level)}">${this.esc(r.level || 'info')}</span></td>
                    <td style="white-space:pre-wrap;word-break:break-word">${this.esc(r.message || '')}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>
            <div class="muted" style="margin-top:8px">共 ${rows.length} 条 · 执行过程实时写入</div>`
          : `<div class="empty" style="padding:28px;text-align:center">暂无执行日志（子任务开始执行后才会写入）</div>`;
        this.modal(
          `子任务日志 #${itemId} · ${typeLabel}`,
          body,
          async () => { this.closeModal(); },
          false,
          { hideSubmit: true, wide: true }
        );
      } catch (e) {
        this.toast(e.message || '加载日志失败', true);
      }
    },
  };

  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages.accountWork = true;
})();
