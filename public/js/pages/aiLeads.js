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
    { code: 'creators', label: '视频创作者' },
    { code: 'videos', label: '视频' },
    { code: 'comments', label: '评论' },
    { code: 'logs', label: '记录' },
    { code: 'records', label: '私信记录' },
  ];

  const RUN_STATUS = {
    idle: '空闲',
    queued: '已入队',
    running: '执行中',
    scrape_done: '待发私信',
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
    aiLeadRunBadge(runStatus) {
      const rs = String(runStatus || 'idle');
      if (rs === 'idle') return '';
      const map = {
        queued: { label: '已入队', tone: 'warn' },
        running: { label: '执行中', tone: 'online' },
        scrape_done: { label: '待发私信', tone: 'warn' },
        done: { label: '已完成', tone: 'success' },
        failed: { label: '失败', tone: 'error' },
      };
      const m = map[rs] || { label: RUN_STATUS[rs] || rs, tone: 'muted' };
      return `<span class="badge ${m.tone} ai-lead-run-badge">${this.esc(m.label)}</span>`;
    },
    aiLeadTypeChip(type) {
      const t = this.normalizeAiLeadType(type);
      const label = this.aiLeadTypeLabel(t);
      return `<span class="ai-lead-type-chip ai-lead-type-chip--${t}">${this.esc(label)}</span>`;
    },
    aiLeadKwTag(kw) {
      const raw = String(kw || '').trim();
      const short = raw.split(/[\r\n,，;；]+/)[0] || raw;
      if (!short) return '<span class="muted">-</span>';
      return `<span class="ai-lead-kw" title="${this.esc(raw)}">${this.esc(short.length > 28 ? short.slice(0, 28) + '…' : short)}</span>`;
    },
    aiLeadMetricCell(label, value, sub) {
      return `<div class="ai-lead-metric-cell">
        <span class="ai-lead-metric-cell__label">${this.esc(label)}</span>
        <b class="ai-lead-metric-cell__val">${this.esc(String(value))}</b>
        ${sub ? `<span class="ai-lead-metric-cell__sub muted">${this.esc(sub)}</span>` : ''}
      </div>`;
    },
    aiLeadDetailTabCounts(d, ctx) {
      const { accounts, creators, videos, comments, logs, records } = ctx;
      const leadComments = (comments || []).filter((c) => c.aiPass).length;
      return {
        progress: 0,
        accounts: (accounts || []).length,
        creators: (creators || []).length,
        videos: (videos || []).length,
        comments: leadComments || Number(d.leadCommentCount || 0),
        logs: (logs || []).length,
        records: (records || []).length,
      };
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
      if (this.aiLeadsPane === 'clues') {
        if (typeof this.renderAiLeadClues === 'function') return this.renderAiLeadClues();
        throw new Error('AI线索模块未加载');
      }
      if (this.aiLeadsPane === 'clue_data') {
        if (typeof this.renderAiLeadClueData === 'function') return this.renderAiLeadClueData();
        throw new Error('线索数据模块未加载，请刷新页面');
      }
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
        const activeN = items.filter((x) => x.status === 'active').length;
        const runningN = items.filter((x) => x.runStatus === 'running' || x.runStatus === 'queued').length;
        const draftN = items.filter((x) => x.status === 'draft').length;
        host.innerHTML = `<div class="ai-lead-page">
          <div class="ai-lead-hero panel">
            <div class="ai-lead-hero__text">
              <h2 class="ai-lead-hero__title">AI 拓客任务</h2>
              <p class="ai-lead-hero__desc">配置关键词与互动下限，自动抓取意向用户、AI 筛选评论；私信按账号视频激活权重独立调度推送。</p>
            </div>
            <div class="ai-lead-hero__stats">
              <div class="ai-lead-stat"><b>${pack.total || 0}</b><span>任务总数</span></div>
              <div class="ai-lead-stat ai-lead-stat--ok"><b>${activeN}</b><span>本页进行中</span></div>
              <div class="ai-lead-stat ai-lead-stat--run"><b>${runningN}</b><span>本页执行中</span></div>
              <div class="ai-lead-stat ai-lead-stat--muted"><b>${draftN}</b><span>本页草稿</span></div>
            </div>
          </div>
          <div class="panel ai-lead-panel">
            <div class="toolbar ai-lead-toolbar">
              <div class="ai-lead-filters">
                <select id="ai-leads-status" class="input" title="状态">
                  <option value="">全部状态</option>
                  ${statuses.map((s) => `<option value="${this.esc(s.code)}" ${status === s.code ? 'selected' : ''}>${this.esc(s.label)}</option>`).join('')}
                </select>
                <input id="ai-leads-keyword" class="input" type="search" placeholder="关键词 / 类型 / ID" value="${this.esc(kw)}" onkeydown="if(event.key==='Enter')app.searchAiLeads()">
                <button class="primary" type="button" onclick="app.searchAiLeads()">搜索</button>
                <button class="ghost" type="button" onclick="app.resetAiLeadFilters()">重置</button>
              </div>
              <div class="ai-lead-actions">
                ${canEdit ? `<button class="primary" type="button" onclick="app.openAiLeadCreate()">创建拓客任务</button>` : ''}
                ${canEdit ? `<button class="ghost" type="button" onclick="app.openAiLeadWeightSettings()">私信权重</button>` : ''}
                <button class="ghost" type="button" onclick="app.navigate('aiLeads','clues')">AI 线索</button>
                <button class="ghost" type="button" onclick="app.navigate('aiLeads','clue_data')">拓客结果</button>
                <button class="ghost" type="button" onclick="app.refresh()">刷新</button>
              </div>
            </div>
            <div class="table-container ai-lead-table-wrap">${this.aiLeadTableHtml(items, canEdit)}</div>
            ${UI.pager({ page: pack.page, pages: pack.pages, total: pack.total, pageSize: pack.pageSize }, 'aiLeadsPage')}
          </div>
        </div>`;
      } catch (e) {
        host.innerHTML = `<div class="panel"><div class="empty">加载失败：${this.esc(e.message)}</div></div>`;
      }
    },
    aiLeadTableHtml(rows, canEdit) {
      if (!rows.length) {
        return `<div class="empty ai-lead-empty">
          <div class="ai-lead-empty__icon" aria-hidden="true">✦</div>
          <p>还没有拓客任务</p>
          <span class="muted">${canEdit ? '点击「创建拓客任务」开始配置规则与关联账号' : '请联系管理员创建任务'}</span>
        </div>`;
      }
      return `<table class="ai-lead-table"><thead><tr>
        <th>任务</th><th>行业</th><th>关键词</th><th>互动下限</th><th>数据概览</th><th>状态</th><th>时间</th><th style="min-width:200px">操作</th>
      </tr></thead><tbody>${rows.map((x) => this.aiLeadRowHtml(x, canEdit)).join('')}</tbody></table>`;
    },
    aiLeadRowHtml(x, canEdit) {
      const st = x.stats || {};
      const dmProg = x.dmProgress || {};
      const creators = Number(st.creators ?? x.creatorCount ?? 0);
      const leads = Number(st.leads ?? x.leadCommentCount ?? 0);
      const dms = Number(st.dmsSent ?? dmProg.dmsSent ?? x.recordCount ?? 0);
      const dmsPending = Number(st.dmsPending ?? dmProg.dmsPending ?? 0);
      const dmsNeed = Number(st.dmsNeeded ?? 0) || (dms + dmsPending);
      const miss = Number(st.accountsMissing ?? 0);
      const scrapeDone = String(x.progress?.phase || '') === 'scrape_done' || (x.status === 'active' && dmsPending > 0 && String(x.runStatus || '') === 'idle');
      const countTip = st.summary
        || `用户 ${creators} · 意向 ${leads} · 私信 ${dms}${dmsNeed ? '/' + dmsNeed : ''}${dmsPending ? ' · 待发 ' + dmsPending : ''}${miss ? ' · 缺号 ' + miss : ''}`;
      const dmPct = dmsNeed > 0 ? Math.min(100, Math.round((dms / dmsNeed) * 100)) : 0;
      return `<tr class="ai-lead-row">
        <td>
          <div class="ai-lead-row__task">
            <span class="ai-lead-row__id">#${x.id}</span>
            ${this.aiLeadTypeChip(x.type)}
          </div>
        </td>
        <td>${typeof this.industryTagHtml === 'function' ? this.industryTagHtml(x.industry?.label || x.industryLabel || '') : this.esc(x.industry?.label || '-')}</td>
        <td>${this.aiLeadKwTag(x.keywords)}</td>
        <td>
          <div class="ai-lead-limits">
            <span title="粉丝下限">关 <b>${Number(x.limitFollows || 0)}</b></span>
            <span title="获赞下限">赞 <b>${Number(x.limitLikes || 0)}</b></span>
            <span title="播放下限">看 <b>${Number(x.limitLook || 0)}</b></span>
          </div>
        </td>
        <td title="${this.esc(countTip)}">
          <div class="ai-lead-data-pills">
            <span class="ai-lead-pill">用户 <b>${creators}</b></span>
            <span class="ai-lead-pill ai-lead-pill--lead">意向 <b>${leads}</b></span>
            <span class="ai-lead-pill ai-lead-pill--dm">私信 <b>${dms}${dmsNeed ? '/' + dmsNeed : ''}</b></span>
            ${dmsPending > 0 ? `<span class="ai-lead-pill ai-lead-pill--warn">待发 <b>${dmsPending}</b></span>` : ''}
          </div>
          ${dmsNeed > 0 ? `<div class="ai-lead-progress" aria-hidden="true"><i style="width:${dmPct}%"></i></div>` : ''}
          <div class="ai-lead-row__meta muted">${Number(x.accountCount || 0)} 账号${miss ? ` · 缺号 ${miss}` : ''}${scrapeDone ? ' · 私信调度中' : ''}</div>
        </td>
        <td>
          <div class="ai-lead-status-stack">
            ${this.aiLeadStatusBadge(x.status)}
            ${scrapeDone ? `<span class="badge warn ai-lead-run-badge">待发私信</span>` : this.aiLeadRunBadge(x.runStatus)}
            ${x.dmDispatchEnabled === false || x.dmDispatchEnabled === 0
              ? `<span class="badge muted ai-lead-run-badge" title="私信派发已关闭">私信关</span>`
              : ''}
          </div>
        </td>
        <td><span class="muted ai-lead-time">${this.esc(x.createdAt || '')}</span></td>
        <td class="ai-lead-ops">
          <div class="ops-dropdown" style="display:inline-block">
            <button class="tiny primary" type="button" onclick="app.toggleAiLeadDetailMenu(${x.id},event)">明细 <span class="btn-arrow-down">▾</span></button>
            <div id="ai-lead-detail-menu-${x.id}" class="dropdown-menu ops-menu align-left hidden">
              ${DETAIL_TABS.map((t) => `<button type="button" onclick="app.openAiLeadDetail(${x.id},'${t.code}')">${this.esc(t.label)}</button>`).join('')}
            </div>
          </div>
          ${canEdit ? `<button class="tiny ghost" type="button" onclick="app.openAiLeadCreate(${x.id})">编辑</button>` : ''}
          ${canEdit && x.status === 'draft' ? `<button class="tiny" type="button" onclick="app.patchAiLeadStatus(${x.id},'active')">启用</button>` : ''}
          ${canEdit && x.status === 'active' ? `<button class="tiny" type="button" onclick="app.repushAiLead(${x.id})">重推</button><button class="tiny" type="button" onclick="app.patchAiLeadStatus(${x.id},'paused')">暂停</button>` : ''}
          ${canEdit && x.status === 'paused' ? `<button class="tiny" type="button" onclick="app.patchAiLeadStatus(${x.id},'active')">恢复</button>` : ''}
          ${canEdit ? (x.dmDispatchEnabled === false || x.dmDispatchEnabled === 0
            ? `<button class="tiny" type="button" onclick="app.patchAiLeadDmDispatch(${x.id},true)">开私信</button>`
            : `<button class="tiny ghost" type="button" onclick="app.patchAiLeadDmDispatch(${x.id},false)">关私信</button>`) : ''}
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
    async closeAiLeadProfiles(profileIds = []) {
      const ids = [...new Set((profileIds || []).map((x) => String(x || '').trim()).filter(Boolean))];
      if (!ids.length) return;
      await Promise.all(ids.map((pid) =>
        this.api(`/browser/profiles/${encodeURIComponent(pid)}/close`, { method: 'POST', body: '{}' })
          .catch(() => null)
      ));
    },
    async kickAiLeadExecutorPoll(pack, opts = {}) {
      const direct = !!opts.direct;
      const schedule = pack?.schedule || null;
      const scheduleMsg = String(pack?.scheduleMessage || '').trim();
      const bid = Number(
        schedule?.batch_id || schedule?.batchId || pack?.batchId || pack?.batch_id || 0
      );
      const closeProfiles = pack?.closeProfiles || schedule?.close_profiles || [];
      const needPush = !!pack?.needPoll
        || (schedule && !schedule.skipped)
        || (schedule && schedule.reason === 'already_queued');

      // 重新推送 / 中止：先打断本机流水线并关旧窗，再领取新任务
      const abortLeadId = Number(
        pack?.id || pack?.leadId || schedule?.lead_id || schedule?.leadId || 0
      );
      // 手动测试/重试私信：不 abort（会留下 aborted 标记导致立刻「任务已暂停」）
      if (!direct && (abortLeadId || closeProfiles.length)) {
        await this.api('/executor/abort-ai-lead', {
          method: 'POST',
          body: JSON.stringify({
            leadId: abortLeadId,
            profileIds: closeProfiles,
            reason: '用户重新推送：终止旧任务',
          }),
        }).catch(() => null);
      }
      if (closeProfiles.length) {
        await this.closeAiLeadProfiles(closeProfiles);
        await new Promise((r) => setTimeout(r, 800));
      }

      if (schedule?.skipped && schedule.reason === 'no_eligible_account') {
        this.toast(scheduleMsg || '无可用账号（需绑定浏览器环境 + 代理）', true);
        return;
      }
      if (schedule?.skipped && schedule.reason === 'error') {
        this.toast(scheduleMsg || ('入队失败：' + (schedule.error || '')), true);
        return;
      }
      if (schedule?.skipped && schedule.reason === 'aborted') {
        if (scheduleMsg) this.toast(scheduleMsg);
        return;
      }
      if (!needPush) {
        if (scheduleMsg) this.toast(scheduleMsg);
        else if (schedule?.reason) this.toast(`拓客未推送：${schedule.reason}`, true);
        else this.toast('拓客已更新，但未触发任务推送', true);
        return;
      }

      if (direct) {
        if (bid <= 0) {
          this.toast(scheduleMsg || '私信任务已入队，但未拿到 batch，请稍后重试', true);
          return;
        }
        let lastErr = null;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            await this.api('/executor/run-batch', {
              method: 'POST',
              body: JSON.stringify({ batchId: bid }),
            });
            this.toast(scheduleMsg || `已开始执行私信 · batch#${bid}`);
            return;
          } catch (e) {
            lastErr = e;
            await new Promise((r) => setTimeout(r, 1200));
          }
        }
        this.toast(lastErr?.message || `执行 batch#${bid} 失败，请确认本机 Node 在运行`, true);
        return;
      }

      if (!this.isExecutorEnabled?.()) {
        this.toast('拓客已入队，但前台「任务执行」未开启，请先打开后再启用', true);
        return;
      }
      if (!this.ws || this.ws.readyState !== 1) {
        this.toast('WebSocket 未连接，无法推送任务；请刷新页面后确认本机 Node 在运行', true);
      }
      this.syncExecutorWsStatus?.();
      if (bid > 0) {
        // 关窗后环境需一点时间变 idle，定点领取失败则短暂重试
        let lastErr = null;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            const out = await this.api('/executor/offer-batch', {
              method: 'POST',
              body: JSON.stringify({ batchId: bid }),
            });
            const label = out?.taskLabel || 'AI拓客';
            if (out?.direct) {
              this.toast(`已开始执行 ${label} · batch#${bid}`);
            } else {
              this.toast(`已 WSS 推送 ${label} · batch#${bid}`);
            }
            return;
          } catch (e) {
            lastErr = e;
            await new Promise((r) => setTimeout(r, 1200));
          }
        }
        // WSS 推送失败：改为本机 Node 直接领取执行（与测试私信一致）
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            await this.api('/executor/run-batch', {
              method: 'POST',
              body: JSON.stringify({ batchId: bid }),
            });
            this.toast(`WSS 推送失败，已改为本机直接执行 · batch#${bid}`);
            return;
          } catch (e) {
            lastErr = e;
            await new Promise((r) => setTimeout(r, 1200));
          }
        }
        await this.api('/executor/poll', { method: 'POST', body: '{}' }).catch(() => {});
        const deferMsg = lastErr?.message || '';
        if (/等待浏览器环境|env_busy|general_running|环境忙碌/i.test(deferMsg)) {
          this.toast('AI拓客已推送，正在等待浏览器环境空闲（不抢占常规任务）');
          return;
        }
        this.toast(deferMsg || `定点推送失败，已尝试通用领取 batch#${bid}`, true);
        return;
      }
      await this.api('/executor/poll', { method: 'POST', body: '{}' }).catch(() => {});
      this.toast(scheduleMsg || 'AI拓客已入队，正在领取推送…');
    },
    async patchAiLeadDmDispatch(id, enabled) {
      const on = !!enabled;
      if (!on && !(await this.ask(`关闭任务 #${id} 的私信派发？将取消队列中待发/执行中的私信，抓取不受影响。`))) return;
      try {
        const pack = await this.api('/ai-leads/' + id + '/dm-dispatch', {
          method: 'PATCH',
          body: JSON.stringify({ dmDispatchEnabled: on }),
        });
        this.toast(pack?.message || (on ? '已开启私信派发' : '已关闭私信派发'));
        this.refresh();
      } catch (e) {
        this.toast(e.message || '切换失败', true);
      }
    },
    async patchAiLeadStatus(id, status, extra = {}) {
      try {
        const pack = await this.api('/ai-leads/' + id + '/status', {
          method: 'PATCH',
          body: JSON.stringify({
            status,
            clearData: !!extra.clearData,
            forceRestart: !!extra.forceRestart,
          }),
        });
        if (status === 'active') {
          await this.kickAiLeadExecutorPoll(pack || {});
        } else {
          const profiles = pack?.closeProfiles || pack?.schedule?.close_profiles || [];
          // 先打断本机 Node 流水线并强制关窗，再走通用 close（双保险）
          await this.api('/executor/abort-ai-lead', {
            method: 'POST',
            body: JSON.stringify({
              leadId: Number(id),
              profileIds: profiles,
              reason: status === 'paused' ? '任务已暂停' : '任务已停用',
            }),
          }).catch(() => null);
          if (profiles.length) await this.closeAiLeadProfiles(profiles);
          this.toast(pack?.message || pack?.scheduleMessage || '状态已更新');
        }
        this.refresh();
      } catch (e) {
        this.toast(e.message, true);
      }
    },
    /**
     * 独立跑私信逻辑（不抓取）。
     * @param {number} leadId
     * @param {string} [username] 指定对方（记录行「重试」）
     * @param {number} [accountId] 指定关联账号
     */
    async testAiLeadDm(leadId, username = '', accountId = 0) {
      const id = Number(leadId || 0);
      if (!id) return;
      const user = String(username || '').replace(/^@+/, '').trim();
      const isRetry = !!user;
      if (!isRetry) {
        const tip = '将独立测试私信（最多 3 条意向用户，先开主页再发信）。确认入队？';
        if (!(await this.ask(tip))) return;
      } else {
        const retryBe = this.normalizeTaskBackend(this._aiLeadDetail?.browserBackend || document.querySelector('[name=browserBackend]')?.value || this.defaultTaskBrowserBackend(),true);
        if (!(await this.ensureBrowserBackendOnline(retryBe, '重试私信'))) return;
        this.toast(`正在重试 @${user}，即将打开浏览器环境…`);
      }
      const testBe = this.normalizeTaskBackend(this._aiLeadDetail?.browserBackend || document.querySelector('[name=browserBackend]')?.value || this.defaultTaskBrowserBackend(),true);
      if (!isRetry && !(await this.ensureBrowserBackendOnline(testBe, '测试私信'))) return;
      try {
        const body = {
          username: user,
          accountId: Number(accountId || 0) || 0,
          limit: user ? 1 : 3,
          force: isRetry,
        };
        const pack = await this.api('/ai-leads/' + id + '/test-dm', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        await this.kickAiLeadExecutorPoll({
          ...(pack || {}),
          leadId: id,
          needPoll: true,
          scheduleMessage: isRetry
            ? `重试 @${user} 已入队，正在打开浏览器…`
            : (pack?.message || '私信测试已入队，正在打开浏览器…'),
        }, { direct: true });
        // 重试后立即刷新记录行；全量测试稍后再刷
        const delay = isRetry ? 800 : 2500;
        setTimeout(() => {
          if (this.aiLeadDetailId === id) this.openAiLeadDetail(id, 'records');
          else this.refresh();
        }, delay);
      } catch (e) {
        this.toast(e.message || '私信测试入队失败', true);
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
          <div class="ai-lead-repush">
            <div class="ai-lead-repush__hero">
              <span class="ai-lead-repush__badge"><i class="ai-lead-repush__badge-dot"></i>AI 拓客 #${Number(id) || ''}</span>
              <h3 class="ai-lead-repush__title">选择推送方式</h3>
              <p class="ai-lead-repush__desc">任务配置与关联账号不会改动。</p>
            </div>
            <div class="ai-lead-repush__grid">
              <div class="ai-lead-repush__opt ai-lead-repush__opt--keep" role="button" tabindex="0" data-choice="keep">
                <span class="ai-lead-repush__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 12a9 9 0 0 1 15.5-6.4"/><path d="M21 3v6h-6"/><path d="M21 12a9 9 0 0 1-15.5 6.4"/><path d="M3 21v-6h6"/>
                  </svg>
                </span>
                <span class="ai-lead-repush__opt-body">
                  <strong class="ai-lead-repush__opt-title">保留数据</strong>
                  <span class="ai-lead-repush__opt-sub">不清空，继续补抓</span>
                </span>
              </div>
              <div class="ai-lead-repush__opt ai-lead-repush__opt--wipe" role="button" tabindex="0" data-choice="clear">
                <span class="ai-lead-repush__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                  </svg>
                </span>
                <span class="ai-lead-repush__opt-body">
                  <strong class="ai-lead-repush__opt-title">清除重开</strong>
                  <span class="ai-lead-repush__opt-sub">清空明细后重跑</span>
                </span>
              </div>
            </div>
          </div>`;
        this.modal('重新推送', html, async () => {}, false, {
          hideSubmit: true,
          hideFooter: true,
          onClose: () => finish(null),
        });
        // 紧凑弹框：限制宽度，避免走 detail-modal 的零内边距样式
        document.querySelector('#modal')?.classList.add('ai-lead-repush-modal');
        const prevClose = this._modalOnClose;
        this._modalOnClose = () => {
          document.querySelector('#modal')?.classList.remove('ai-lead-repush-modal');
          if (typeof prevClose === 'function') prevClose();
        };
        const body = document.querySelector('#modal-body');
        const bind = (el) => {
          const go = () => {
            const choice = el.getAttribute('data-choice') === 'clear' ? 'clear' : 'keep';
            finish(choice);
            this.closeModal();
          };
          el.addEventListener('click', go);
          el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              go();
            }
          });
        };
        body?.querySelectorAll('[data-choice]').forEach(bind);
      });
    },
    async repushAiLead(id) {
      const choice = await this.askAiLeadRepushClear(id);
      if (choice == null) return;
      // 强制终止旧环境/进程后重新入队
      await this.patchAiLeadStatus(id, 'active', {
        clearData: choice === 'clear',
        forceRestart: true,
      });
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
      // 草稿按任务 id 区分：换任务时不能沿用上一个任务的旧草稿（否则执行浏览器会显示旧值）
      if (this._aiLeadDraftId !== editId) draft = null;
      if (!draft) {
        draft = {
          type: 'user',
          limitFollows: 20,
          limitLikes: 50,
          limitLook: 100,
          keywords: '',
          dmMessage: '',
          dmDispatchEnabled: true,
          saveTraffic: true,
          status: 'draft',
          accountIds: [],
          scrapeAccountId: 0,
          industryId: 0,
          sharedUserIds: [],
        };
        if (editId) {
          try {
            const d = await this.api('/ai-leads/' + editId);
            draft = {
              type: this.normalizeAiLeadType(d.type),
              limitFollows: d.limitFollows ?? 20,
              limitLikes: d.limitLikes ?? 50,
              limitLook: d.limitLook ?? 100,
              browserBackend: this.normalizeTaskBackend(d.browserBackend || d.browser_backend || this.defaultTaskBrowserBackend(), true),
              keywords: d.keywords || '',
              dmMessage: d.dmMessage || '',
              dmDispatchEnabled: d.dmDispatchEnabled !== false && d.dmDispatchEnabled !== 0,
              saveTraffic: d.saveTraffic !== false && d.saveTraffic !== 0,
              status: d.status || 'draft',
              accountIds: (d.accounts || []).map((a) => Number(a.accountId)).filter(Boolean),
              scrapeAccountId: Number(d.scrapeAccountId || 0),
              industryId: Number(d.industryId || d.industry?.id || 0),
              sharedUserIds: Array.isArray(d.sharedUserIds) ? d.sharedUserIds.map(Number).filter(Boolean) : [],
            };
          } catch (e) {
            this.toast(e.message, true);
            this.closeAiLeadCreate();
            return;
          }
        }
        this._aiLeadDraft = draft;
        this._aiLeadDraftId = editId;
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
          ${this.selectBrowserBackendField('browserBackend', draft.browserBackend || this.defaultTaskBrowserBackend(), '查数据与私信将使用所选浏览器打开账号环境；选「服务器浏览器」时须已有桌面自研环境包（EL 同核），缺包或登录未同步会等待本机推送',{server:true})}
          ${this.saveTrafficField(draft.saveTraffic, true)}
          <div class="field"><label>拓客类型</label>
            <select class="input" name="type" onchange="app.onAiLeadTypeChange && app.onAiLeadTypeChange()">
              <option value="user" ${draft.type === 'user' ? 'selected' : ''}>按用户</option>
              <option value="video" ${draft.type === 'video' ? 'selected' : ''}>按视频</option>
            </select>
            <div class="muted" id="ai-lead-type-hint" style="margin-top:4px;font-size:12px">${
              draft.type === 'video'
                ? '按视频：搜索 Videos → 滚动筛选播放量 → 合格视频入库 → 逐一打开抓创作者/评论 → AI 筛选（私信由计划任务独立推送）'
                : '按用户：搜索 Users → 粉丝/获赞筛选 → 主页视频 → 抓评论 → AI 筛选（私信由计划任务独立推送）'
            }</div>
          </div>
          <div class="field"><label>状态</label>
            <select class="input" name="status">${statusOpts.map(([v, n]) => `<option value="${v}" ${draft.status === v ? 'selected' : ''}>${this.esc(n)}</option>`).join('')}</select>
          </div>
          <div class="field"><label>关注下限 <span class="muted">创作者粉丝</span></label>
            <input class="input" name="limitFollows" type="number" min="0" value="${Number(draft.limitFollows) || 0}">
          </div>
          <div class="field"><label>点赞下限 <span class="muted">创作者获赞</span></label>
            <input class="input" name="limitLikes" type="number" min="0" value="${Number(draft.limitLikes) || 0}">
          </div>
          <div class="field"><label>浏览下限 <span class="muted">视频播放量</span></label>
            <input class="input" name="limitLook" type="number" min="0" value="${Number(draft.limitLook) || 0}">
          </div>
          <div class="field"><label>关键词</label>
            <input class="input" name="keywords" type="text" value="${this.esc(String(draft.keywords||'').split(/[\r\n,，;；]+/)[0]||'')}" placeholder="仅填写一个关键词" maxlength="200" required>
          </div>
          <div class="field full">
            <label>行业分类 <span class="req">*</span> <span class="muted">四级联动，选至最细一级；后续评论将关联该行业</span></label>
            ${typeof this.industryCascadeHtml === 'function' ? this.industryCascadeHtml('ai-lead-industry', draft.industryId) : '<div class="muted">行业模块未加载</div>'}
          </div>
          <div class="field full">
            <label>私信文案兜底 <span class="muted">默认由 AI 按评论生成开场白；AI 失败时用此处文案。日私信次数按账号视频激活权重（见「私信权重」）。可用 ${'{{username}}'} / ${'{{nickname}}'} / ${'{{comment}}'}</span></label>
            <textarea class="input" name="dmMessage" rows="3" placeholder="留空则使用系统默认兜底文案">${this.esc(draft.dmMessage || '')}</textarea>
          </div>
          <div class="field full">
            <label class="check-line" style="display:flex;align-items:flex-start;gap:8px;cursor:pointer">
              <input type="checkbox" name="dmDispatchEnabled" value="1" ${draft.dmDispatchEnabled !== false ? 'checked' : ''} style="margin-top:3px">
              <span>允许私信派发 <span class="muted">关闭后 cron（ai-lead:dm-dispatch）不再为本任务入队；可与任务暂停独立使用。紧急全停见后台「快捷操作」</span></span>
            </label>
          </div>
          <div class="field full">
            <label>关联账号 <span class="muted">用于私信意向用户；仅显示已绑定浏览器环境且已绑定代理的账号（日额度按视频激活权重）</span></label>
            ${this.accountPickToolbarHtml('ai-lead-accounts', {
              batchHtml: `<button type="button" class="tiny" onclick="app.setAiLeadAccountPickAll(true)">全选</button><button type="button" class="tiny" onclick="app.setAiLeadAccountPickAll(false)">清空</button><button type="button" class="tiny" onclick="app.invertAiLeadAccountPick()">反选</button>`,
            })}
            <div id="ai-lead-accounts" class="account-pick-grid"></div>
          </div>
          <div class="field full ai-lead-scrape-field">
            <label>查数据账号 <span class="muted">用于打开本地浏览器抓取用户/视频/评论，选中后自动检测环境与代理</span></label>
            <div class="ai-lead-scrape-row">
              <select class="input" name="scrapeAccountId" id="ai-lead-scrape-account" onchange="app.onAiLeadScrapeAccountChange()">
                <option value="">请先选择关联账号</option>
              </select>
              <button type="button" class="tiny" id="ai-lead-scrape-recheck" onclick="app.onAiLeadScrapeAccountChange(true)">重新检测</button>
            </div>
            <div id="ai-lead-scrape-check" class="ai-lead-scrape-check muted">未检测</div>
          </div>
          <div class="field full">
            <label>线索共享用户 <span class="muted">共享后可在「拓客结果」页查看对应评论线索</span></label>
            <div id="ai-lead-shared-users" class="ind-shared-users"></div>
          </div>
        </form>
      </div>`;
      await this.fillAiLeadAccounts(draft.accountIds || [], draft.scrapeAccountId || 0);
      if (typeof this.bindIndustryCascade === 'function') {
        await this.bindIndustryCascade('ai-lead-industry', draft.industryId || 0);
      }
      await this.fillAiLeadSharedUsers(draft.sharedUserIds || []);
    },
    async fillAiLeadSharedUsers(selectedIds) {
      const box = document.querySelector('#ai-lead-shared-users');
      if (!box) return;
      try {
        const users = await this.api('/admin-users?pageSize=200');
        const items = (users.items || users || []).filter((u) => Number(u.status ?? 1) === 1);
        const sel = new Set((selectedIds || []).map(Number));
        box.innerHTML = items.length
          ? `<div class="ind-shared-users__grid">${items.map((u) => {
            const id = Number(u.id);
            const label = (u.username || u.nickname || ('#' + id));
            return `<label class="ind-shared-users__item"><input type="checkbox" name="sharedUserIds" value="${id}" ${sel.has(id) ? 'checked' : ''}> ${this.esc(label)}</label>`;
          }).join('')}</div>`
          : '<span class="muted">暂无可用管理员</span>';
      } catch (e) {
        box.innerHTML = `<span class="muted">加载用户失败：${this.esc(e.message)}</span>`;
      }
    },
    isAiLeadEligibleAccount(a) {
      const profile = String(a?.browser_profile_id || a?.browserProfileId || '').trim();
      const proxyId = Number(a?.proxy_id ?? a?.proxyId ?? 0);
      return !!profile && proxyId > 0;
    },
    async fillAiLeadAccounts(selectedIds, scrapeAccountId = 0) {
      const ids = [...(selectedIds || [])];
      if (scrapeAccountId) ids.push(Number(scrapeAccountId));
      await this.initAccountPickToolbar('ai-lead-accounts');
      const accounts = await this.reloadAccountPick('ai-lead-accounts', {
        selectedIds: ids,
        filterFn: (a) => this.isAiLeadEligibleAccount(a),
        tagHtmlFn: (a, s) => this.accountPickTagHtml(a, s, { onclick: 'app.toggleAiLeadAccountPickTag(this)' }),
        emptyText: '暂无可用账号（需同时绑定浏览器环境与代理）',
        onLoaded: () => this.syncAiLeadScrapeAccountOptions(Number(scrapeAccountId) || 0),
      });
      this._aiLeadAccountsCache = accounts || [];
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
    onAiLeadTypeChange() {
      const sel = document.querySelector('#ai-lead-form select[name="type"]');
      const hint = document.querySelector('#ai-lead-type-hint');
      if (!hint) return;
      const t = String(sel?.value || 'user');
      hint.textContent = t === 'video'
        ? '按视频：搜索 Videos → 滚动筛选播放量 → 合格视频入库 → 逐一打开抓创作者/评论 → AI 筛选（私信由计划任务独立推送）'
        : '按用户：搜索 Users → 粉丝/获赞筛选 → 主页视频 → 抓评论 → AI 筛选（私信由计划任务独立推送）';
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
      tip.textContent = '正在检测本地浏览器环境与代理…';
      if (btn) btn.disabled = true;
      try {
        const checkBe = this.normalizeTaskBackend(document.querySelector('#ai-lead-form [name=browserBackend]')?.value || this.defaultTaskBrowserBackend(),true);
        if (!(await this.ensureBrowserBackendOnline?.(checkBe, '检测查数据账号'))) {
          tip.className = 'ai-lead-scrape-check bad';
          tip.textContent = '所选浏览器未在线，无法提交';
          return;
        }
        // 必须带上所选浏览器后端：选「服务器浏览器」时不能按账号默认后端去连
        const r = await this.api(`/browser/accounts/${accountId}/env-check`, { method: 'POST', body: JSON.stringify({ browserBackend: checkBe }) });
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
      const browserBackend = this.normalizeTaskBackend(fd.get('browserBackend') || this.defaultTaskBrowserBackend(),true);
      if (!(await this.ensureBrowserBackendOnline(browserBackend, 'AI拓客'))) return;
      const body = {
        type: this.normalizeAiLeadType(fd.get('type')),
        status: String(fd.get('status') || 'draft'),
        browserBackend,
        limitFollows: Number(fd.get('limitFollows') || 0),
        limitLikes: Number(fd.get('limitLikes') || 0),
        limitLook: Number(fd.get('limitLook') || 0),
        keywords: String(fd.get('keywords') || '').trim().split(/[\r\n,，;；]+/)[0] || '',
        dmMessage: String(fd.get('dmMessage') || '').trim(),
        dmDispatchEnabled: !!form.querySelector('[name="dmDispatchEnabled"]')?.checked,
        saveTraffic: this.parseSaveTrafficInput(fd.get('saveTraffic'), true),
        accountIds: this.selectedAccountPickIds('ai-lead-accounts'),
        scrapeAccountId,
        industryId: typeof this.getIndustryCascadeValue === 'function'
          ? this.getIndustryCascadeValue('ai-lead-industry')
          : Number(document.querySelector('#ai-lead-industry-value')?.value || 0),
        sharedUserIds: Array.from(document.querySelectorAll('#ai-lead-shared-users input[name="sharedUserIds"]:checked')).map((el) => Number(el.value)).filter(Boolean),
      };
      if (!body.industryId) {
        this.toast('请选择行业分类', true);
        return;
      }
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
        const kwMain = kw ? (kw.split(/[\r\n,，;；]+/)[0] || kw) : '-';
        const tabCounts = this.aiLeadDetailTabCounts(d, { accounts, creators, videos, comments, logs, records });
        const dmsSent = stats.dmsSent != null ? stats.dmsSent : records.length;
        const dmsNeed = stats.dmsNeeded || records.length;
        host.innerHTML = `<div class="ai-lead-detail-page">
          <div class="ai-lead-detail-hero panel">
            <div class="ai-lead-detail-hero__top">
              <div class="ai-lead-detail-hero__main">
                <span class="ai-lead-detail-hero__id">#${d.id}</span>
                <div>
                  <h2 class="ai-lead-detail-hero__title">${this.esc(kwMain)}</h2>
                  <p class="ai-lead-detail-hero__sub">${this.aiLeadTypeChip(d.type)} · ${this.aiLeadKwTag(kw)}</p>
                </div>
              </div>
              <div class="ai-lead-detail-hero__badges">
                ${this.aiLeadStatusBadge(d.status)}
                ${this.aiLeadRunBadge(d.runStatus)}
                ${d.dmDispatchEnabled === false || d.dmDispatchEnabled === 0
                  ? `<span class="badge muted">私信派发关</span>`
                  : `<span class="badge ok">私信派发开</span>`}
              </div>
            </div>
            <div class="ai-lead-detail-metrics">
              ${this.aiLeadMetricCell('粉丝下限', d.limitFollows || 0)}
              ${this.aiLeadMetricCell('获赞下限', d.limitLikes || 0)}
              ${this.aiLeadMetricCell('播放下限', d.limitLook || 0)}
              ${this.aiLeadMetricCell('关联账号', accounts.length, stats.accountsMissing ? `缺 ${stats.accountsMissing}` : '')}
              ${this.aiLeadMetricCell('意向评论', d.leadCommentCount || 0)}
              ${this.aiLeadMetricCell('私信进度', `${dmsSent}/${dmsNeed || 0}`)}
            </div>
            ${stats.summary ? `<div class="ai-lead-detail-summary">${this.esc(stats.summary)}</div>` : ''}
            <div class="ai-lead-detail-hero__actions">
              <button class="ghost" type="button" onclick="app.closeAiLeadDetail()">返回列表</button>
              <button class="ghost" type="button" onclick="app.navigate('aiLeads','clues')">AI 线索</button>
              ${canEdit ? `<button class="ghost" type="button" onclick="app.openAiLeadCreate(${d.id})">编辑任务</button>` : ''}
              ${canEdit && d.status === 'active' ? `<button class="ghost" type="button" onclick="app.repushAiLead(${d.id})">重新推送</button>` : ''}
              ${canEdit ? (d.dmDispatchEnabled === false || d.dmDispatchEnabled === 0
                ? `<button class="ghost" type="button" onclick="app.patchAiLeadDmDispatch(${d.id},true)">开启私信派发</button>`
                : `<button class="ghost" type="button" onclick="app.patchAiLeadDmDispatch(${d.id},false)">关闭私信派发</button>`) : ''}
              <button class="primary" type="button" onclick="app.refresh()">刷新</button>
            </div>
          </div>
          <div class="panel ai-lead-detail-panel">
            <div class="ai-lead-tabs" role="tablist" aria-label="明细分类">
              ${DETAIL_TABS.map((t) => {
                const n = tabCounts[t.code] || 0;
                return `<button type="button" class="ai-lead-tab ${tab === t.code ? 'is-active' : ''}" onclick="app.switchAiLeadDetailTab('${t.code}')">
                  ${this.esc(t.label)}${n > 0 && t.code !== 'progress' ? `<span class="ai-lead-tab-count">${n}</span>` : ''}
                </button>`;
              }).join('')}
            </div>
            <div class="ai-lead-tab-body">
              ${this.aiLeadDetailTabHtml(tab, d, { canEdit, accounts, creators, videos, comments, logs, records, daily, stats, progress })}
            </div>
          </div>
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
        const dmProg = d.dmProgress || {};
        const dmsPending = Number(dmProg.dmsPending ?? stats.dmsPending ?? 0);
        const dmsSent = Number(dmProg.dmsSent ?? stats.dmsSent ?? 0);
        const dmsNeeded = Number(dmProg.dmsNeeded ?? stats.dmsNeeded ?? (dmsSent + dmsPending));
        const scrapeCards = [
          ['抓取用户', stats.creators || creators.length, ''],
          ['视频', stats.videos || videos.length, ''],
          ['评论', stats.comments || comments.length, ''],
          ['意向', stats.leads || d.leadCommentCount || 0, 'ai-lead-stat--ok'],
        ].map(([label, val, cls]) => `<div class="ai-lead-mini-stat ${cls}"><b>${val}</b><span>${label}</span></div>`).join('');
        const dmCards = [
          ['已私信', `${dmsSent}/${dmsNeeded || '-'}`, ''],
          ['待发', dmsPending, dmsPending ? 'ai-lead-stat--warn' : ''],
          ['失败', stats.dmsFailed || 0, 'ai-lead-stat--bad'],
          ['跳过', stats.dmsSkipped || 0, ''],
        ].map(([label, val, cls]) => `<div class="ai-lead-mini-stat ${cls}"><b>${this.esc(String(val))}</b><span>${this.esc(label)}</span></div>`).join('');
        const phaseHint = phase === 'scrape_done' || (dmsPending > 0 && d.status === 'active')
          ? '<p class="muted" style="margin:0 0 12px">线索抓取已完成，私信由 <code>ai-lead:dm-dispatch</code> 计划任务按账号权重与间隔独立推送。</p>'
          : '';
        return `<div class="ai-lead-section">
          <div class="ai-lead-chips">
            <span class="chip">运行 ${this.esc(RUN_STATUS[d.runStatus] || d.runStatus || '-')}</span>
            <span class="chip">阶段 ${this.esc(phase === 'scrape_done' ? '抓取完成·待发私信' : phase)}</span>
            ${d.lastRunAt ? `<span class="chip">上次 ${this.esc(d.lastRunAt)}</span>` : ''}
          </div>
          ${phaseHint}
          <h4 class="ai-lead-section-title">抓取进度</h4>
          <div class="ai-lead-mini-stats">${scrapeCards}</div>
          <h4 class="ai-lead-section-title">私信进度（独立调度）</h4>
          <div class="ai-lead-mini-stats">${dmCards}</div>
          <h4 class="ai-lead-section-title">原始进度 JSON</h4>
          <pre class="ai-lead-code">${this.esc(JSON.stringify(progress, null, 2) || '{}')}</pre>
        </div>`;
      }
      if (tab === 'creators') {
        return `<div class="ai-lead-section">
          <div class="ai-lead-section-head">
            <div><h4 class="ai-lead-section-title" style="margin:0">视频创作者</h4><span class="muted">通过视频或用户搜索入库的创作者；评论线索见「意向评论」</span></div>
            ${canEdit ? `<button class="tiny primary" type="button" onclick="app.openAiLeadCreatorForm(${d.id})">添加创作者</button>` : ''}
          </div>
          <div class="table-container ai-lead-table-wrap">${creators.length ? `<table class="ai-lead-table"><thead><tr><th>头像</th><th>用户</th><th>意向度</th><th>粉丝</th><th>获赞</th><th>地区</th><th>来源账号</th><th>状态</th><th>时间</th></tr></thead><tbody>
            ${creators.map((c) => `<tr>
              <td>${c.avatar ? `<img src="${this.esc(c.avatar)}" alt="" style="width:36px;height:36px;object-fit:cover;border-radius:50%">` : '-'}</td>
              <td><b>${this.esc(c.username || '-')}</b>${c.nickname ? `<div class="muted">${this.esc(c.nickname)}</div>` : ''}${c.profileUrl ? `<div><a href="${this.esc(c.profileUrl)}" target="_blank" rel="noopener">主页</a></div>` : ''}${c.uuid ? `<div class="muted">${this.esc(c.uuid)}</div>` : ''}</td>
              <td><b>${Number(c.intentScore || 0)}</b><span class="muted">/10</span></td>
              <td>${Number(c.followers || 0)}</td>
              <td>${Number(c.likes || 0)}</td>
              <td>${this.esc(c.region || '-')}</td>
              <td>${c.accountId ? `#${c.accountId} ${this.esc(c.accountUsername || '')}` : '-'}</td>
              <td>${this.esc(c.statusLabel || CREATOR_STATUS[c.status] || c.status)}</td>
              <td>${this.esc(c.createdAt || '')}</td>
            </tr>`).join('')}
          </tbody></table>` : '<div class="empty ai-lead-empty-inline">暂无创作者</div>'}</div></div>`;
      }
      if (tab === 'videos') {
        return `<div class="ai-lead-section">
          <div class="ai-lead-section-head"><div><h4 class="ai-lead-section-title" style="margin:0">抓取视频</h4><span class="muted">符合播放量等条件的视频</span></div></div>
          <div class="table-container ai-lead-table-wrap">${videos.length ? `<table class="ai-lead-table"><thead><tr><th>ID</th><th>封面</th><th>创作者</th><th>名称</th><th>浏览量</th><th>点赞</th><th>地址</th><th>时间</th></tr></thead><tbody>
            ${videos.map((v) => `<tr>
              <td>#${v.id}</td>
              <td>${v.videoCover ? `<img src="${this.esc(v.videoCover)}" alt="" style="width:48px;height:48px;object-fit:cover;border-radius:6px">` : '-'}</td>
              <td>${this.esc(v.creatorUsername || '-')}${v.creatorNickname ? `<div class="muted">${this.esc(v.creatorNickname)}</div>` : ''}</td>
              <td>${this.esc(v.videoName || '-')}</td>
              <td>${Number(v.views || 0)}</td>
              <td>${Number(v.likes || 0)}</td>
              <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.videoUrl ? `<a href="${this.esc(v.videoUrl)}" target="_blank" rel="noopener">${this.esc(v.videoUrl)}</a>` : '-'}</td>
              <td>${this.esc(v.createdAt || '')}</td>
            </tr>`).join('')}
          </tbody></table>` : '<div class="empty ai-lead-empty-inline">暂无抓取视频</div>'}</div></div>`;
      }
      if (tab === 'comments') {
        const leads = (comments || []).filter((c) => c.aiPass)
          .slice()
          .sort((a, b) => Number(b.intentScore || 0) - Number(a.intentScore || 0));
        return `<div class="ai-lead-section">
          <div class="ai-lead-section-head"><div><h4 class="ai-lead-section-title" style="margin:0">意向评论</h4><span class="muted">AI 筛选命中 · 按意向度排序</span></div>
            <button class="tiny ghost" type="button" onclick="app.navigate('aiLeads','clues')">在 AI 线索中查看</button>
          </div>
          <div class="table-container ai-lead-table-wrap">${leads.length ? `<table class="ai-lead-table"><thead><tr><th>意向度</th><th>用户</th><th>评论</th><th>中文</th><th>视频</th><th>原因</th><th>时间</th></tr></thead><tbody>
            ${leads.map((c) => `<tr>
              <td><span class="ai-clue-score badge ${Number(c.intentScore || 0) >= 8 ? 'success' : Number(c.intentScore || 0) >= 5 ? 'online' : 'muted'}">${Number(c.intentScore || 0)}<span class="ai-clue-score-max">/10</span></span></td>
              <td><b>${this.esc(c.username || '-')}</b>${c.nickname ? `<div class="muted">${this.esc(c.nickname)}</div>` : ''}${c.profileUrl ? `<div><a href="${this.esc(c.profileUrl)}" target="_blank" rel="noopener">主页</a></div>` : ''}</td>
              <td title="${this.esc(c.commentText || '')}">${this.esc((c.commentText || '').slice(0, 80) || '-')}</td>
              <td title="${this.esc(c.commentTextZh || '')}">${this.esc((c.commentTextZh || '').slice(0, 80) || '-')}</td>
              <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.videoUrl ? `<a href="${this.esc(c.videoUrl)}" target="_blank" rel="noopener">${this.esc(c.videoName || c.videoUrl)}</a>` : '-'}</td>
              <td>${this.esc(c.aiReason || '-')}</td>
              <td>${this.esc(c.createdAt || '')}</td>
            </tr>`).join('')}
          </tbody></table>` : '<div class="empty ai-lead-empty-inline">暂无评论</div>'}</div></div>`;
      }
      if (tab === 'logs') {
        return `<div class="ai-lead-section">
          <div class="ai-lead-section-head">
            <div><h4 class="ai-lead-section-title" style="margin:0">视频记录</h4><span class="muted">手动或历史视频日志</span></div>
            ${canEdit ? `<button class="tiny primary" type="button" onclick="app.openAiLeadLogForm(${d.id})">添加记录</button>` : ''}
          </div>
          <div class="table-container ai-lead-table-wrap">${logs.length ? `<table class="ai-lead-table"><thead><tr><th>ID</th><th>封面</th><th>名称</th><th>地址</th><th>评论</th><th>时间</th></tr></thead><tbody>
            ${logs.map((g) => `<tr>
              <td>#${g.id}</td>
              <td>${g.videoCover ? `<img src="${this.esc(g.videoCover)}" alt="" style="width:48px;height:48px;object-fit:cover;border-radius:6px">` : '-'}</td>
              <td>${this.esc(g.videoName || '-')}</td>
              <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${this.esc(g.videoUrl || '')}">${g.videoUrl ? `<a href="${this.esc(g.videoUrl)}" target="_blank" rel="noopener">${this.esc(g.videoUrl)}</a>` : '-'}</td>
              <td>${this.esc((g.comment || '').slice(0, 80) || '-')}</td>
              <td>${this.esc(g.createdAt || '')}</td>
            </tr>`).join('')}
          </tbody></table>` : '<div class="empty ai-lead-empty-inline">暂无记录</div>'}</div></div>`;
      }
      if (tab === 'records') {
        const dmMeta = { pending: 'warn', sent: 'success', failed: 'error', skipped: 'muted' };
        return `<div class="ai-lead-section">
          <div class="ai-lead-section-head">
            <div><h4 class="ai-lead-section-title" style="margin:0">私信记录</h4><span class="muted">先开主页再发信 · 独立私信逻辑</span></div>
            <div class="ai-lead-section-actions">
              ${canEdit ? `<button class="tiny ghost" type="button" onclick="app.testAiLeadDm(${d.id})">测试私信</button>` : ''}
              ${canEdit ? `<button class="tiny primary" type="button" onclick="app.openAiLeadRecordForm(${d.id})">添加记录</button>` : ''}
            </div>
          </div>
          <div class="table-container ai-lead-table-wrap">${records.length ? `<table class="ai-lead-table"><thead><tr><th>ID</th><th>账号</th><th>对方</th><th>内容</th><th>状态</th><th>失败原因</th><th>时间</th><th>操作</th></tr></thead><tbody>
            ${records.map((r) => {
              const err = String(r.errorMessage || '').trim()
                || ((r.status === 'failed' || r.status === 'skipped')
                  ? (String(r.message || '').match(/\[([^\]]+)\]\s*$/) || [])[1] || ''
                  : '');
              const uname = String(r.username || '').replace(/^@+/, '');
              const st = String(r.status || 'pending');
              return `<tr>
              <td>#${r.id}</td>
              <td><span class="ai-lead-account-tag">#${r.accountId}</span> ${this.esc(r.accountUsername || '')}</td>
              <td><b>${this.esc(r.username || '-')}</b>${r.uuid ? `<div class="muted">${this.esc(r.uuid)}</div>` : ''}</td>
              <td title="${this.esc(r.message || '')}">${this.esc((r.message || '').replace(/\n\[[^\]]*\]\s*$/, '').slice(0, 60) || '-')}</td>
              <td><span class="badge ${dmMeta[st] || 'muted'}">${this.esc(r.statusLabel || RECORD_STATUS[st] || st)}</span></td>
              <td class="${err ? 'ai-lead-err-cell' : ''}" title="${this.esc(err)}">${err ? this.esc(err.slice(0, 80)) : '-'}</td>
              <td><span class="muted">${this.esc(r.createdAt || '')}</span></td>
              <td>${canEdit && uname ? `<button class="tiny primary" type="button" onclick='app.testAiLeadDm(${d.id},${JSON.stringify(uname)},${Number(r.accountId) || 0})'>重试</button>` : '-'}</td>
            </tr>`;
            }).join('')}
          </tbody></table>` : `<div class="empty ai-lead-empty-inline">暂无私信记录${canEdit ? ' · 可点「测试私信」对意向用户试跑' : ''}</div>`}</div></div>`;
      }
      // 关联账号：附带日私信次数（今日 / 累计）
      const todayKey = (() => {
        const n = new Date();
        const y = n.getFullYear();
        const m = String(n.getMonth() + 1).padStart(2, '0');
        const day = String(n.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      })();
      const dailyByAccount = new Map();
      (daily || []).forEach((x) => {
        const aid = Number(x.accountId || 0);
        if (!aid) return;
        const cur = dailyByAccount.get(aid) || { today: 0, total: 0, lastDate: '' };
        const times = Number(x.times || 0);
        cur.total += times;
        const date = String(x.date || '').slice(0, 10);
        if (date === todayKey) cur.today += times;
        if (!cur.lastDate || date > cur.lastDate) cur.lastDate = date;
        dailyByAccount.set(aid, cur);
      });
      return `<div class="ai-lead-section">
        <div class="ai-lead-section-head"><div><h4 class="ai-lead-section-title" style="margin:0">关联账号</h4><span class="muted">查数据 / 私信执行账号 · 含视频激活权重与日额度</span></div></div>
        <div class="table-container ai-lead-table-wrap">${accounts.length ? `<table class="ai-lead-table"><thead><tr>
          <th>账号</th><th>用户名</th><th>激活天</th><th>日额度</th><th>今日已用</th><th>间隔(秒)</th><th>可发</th><th>登录</th>
        </tr></thead><tbody>
          ${accounts.map((a) => {
            const w = a.dmWeight || {};
            const dm = dailyByAccount.get(Number(a.accountId)) || { today: 0, total: 0, lastDate: '' };
            const used = Number(w.usedToday ?? dm.today ?? 0);
            const limit = Number(w.dailyLimit ?? 0);
            const loginSt = String(a.loginStatus || '');
            const loginBadge = loginSt === 'online' ? 'success' : loginSt === 'expired' ? 'error' : 'muted';
            const canSend = w.canSendNow ? 'success' : 'muted';
            const canLabel = w.canSendNow ? '是' : (w.blockReason || '否');
            const actDays = w.activationDays != null ? String(w.activationDays) : (w.firstVideoPublishedAt ? '0' : '-');
            const interval = w.dmIntervalMinSec && w.dmIntervalMaxSec
              ? `${w.dmIntervalMinSec}~${w.dmIntervalMaxSec}` : '600~1800';
            return `<tr>
              <td><span class="ai-lead-account-tag">#${a.accountId}</span></td>
              <td><b>${this.esc(a.username || '-')}</b>${canEdit ? `<div><button type="button" class="tiny ghost" onclick="app.openAccountDmInterval(${a.accountId})">改间隔</button></div>` : ''}</td>
              <td>${this.esc(actDays)}</td>
              <td><b>${limit || '-'}</b></td>
              <td><b class="ai-lead-dm-today">${used}</b></td>
              <td><span class="muted">${this.esc(interval)}</span></td>
              <td><span class="badge ${canSend}" title="${this.esc(w.nextAvailableAt || w.blockReason || '')}">${this.esc(canLabel)}</span></td>
              <td><span class="badge ${loginBadge}">${this.esc(loginSt || '-')}</span></td>
            </tr>`;
          }).join('')}
        </tbody></table>` : '<div class="empty ai-lead-empty-inline">未关联账号</div>'}</div></div>`;
    },
    async openAiLeadWeightSettings() {
      if (!this.canEditAiLeads()) {
        this.toast('无权限', true);
        return;
      }
      try {
        const pack = await this.api('/ai-leads/video-weight-tiers');
        const tiers = Array.isArray(pack?.tiers) ? pack.tiers : [];
        const defaults = pack?.defaults || [];
        const minDef = pack?.defaultIntervalMinSec ?? 600;
        const maxDef = pack?.defaultIntervalMaxSec ?? 1800;
        const rows = (tiers.length ? tiers : defaults).map((t, i) => {
          const days = Number(t.days ?? 0);
          const lim = Number(t.dailyDmLimit ?? t.daily_dm_limit ?? 1);
          return `<tr data-idx="${i}">
            <td><input class="input" type="number" min="0" name="tierDays" value="${days}" style="width:80px"></td>
            <td><input class="input" type="number" min="1" name="tierLimit" value="${lim}" style="width:80px"></td>
          </tr>`;
        }).join('');
        this.modal('私信权重设置', `<div class="form-grid">
          <p class="muted full">按账号<strong>视频激活天数</strong>（首次发视频成功日起算）决定日私信额度。未发视频账号默认 1 条/天。</p>
          <div class="field full">
            <label>权重阶梯（激活天数 ≥ → 日私信次数）</label>
            <table class="ai-lead-table"><thead><tr><th>激活天数 ≥</th><th>日私信</th></tr></thead>
            <tbody id="ai-lead-weight-rows">${rows}</tbody></table>
            <button type="button" class="tiny" onclick="app.addAiLeadWeightRow()">+ 添加阶梯</button>
          </div>
          <p class="muted full">默认私信间隔：${minDef}～${maxDef} 秒；可在任务明细「关联账号」中为单个账号修改。</p>
        </div>`, async () => {
          const tbody = document.querySelector('#ai-lead-weight-rows');
          const out = [];
          tbody?.querySelectorAll('tr').forEach((tr) => {
            const days = Number(tr.querySelector('[name=tierDays]')?.value || 0);
            const dailyDmLimit = Number(tr.querySelector('[name=tierLimit]')?.value || 1);
            out.push({ days, dailyDmLimit });
          });
          await this.api('/ai-leads/video-weight-tiers', {
            method: 'PUT',
            body: JSON.stringify({ tiers: out }),
          });
          this.toast('权重已保存');
          this.closeModal();
        }, false, { submitText: '保存', wide: true });
      } catch (e) {
        this.toast(e.message || '加载失败', true);
      }
    },
    addAiLeadWeightRow() {
      const tbody = document.querySelector('#ai-lead-weight-rows');
      if (!tbody) return;
      const i = tbody.querySelectorAll('tr').length;
      const tr = document.createElement('tr');
      tr.dataset.idx = String(i);
      tr.innerHTML = `<td><input class="input" type="number" min="0" name="tierDays" value="0" style="width:80px"></td>
        <td><input class="input" type="number" min="1" name="tierLimit" value="1" style="width:80px"></td>`;
      tbody.appendChild(tr);
    },
    openAccountDmInterval(accountId) {
      if (!this.canEditAiLeads()) return;
      const d = this._aiLeadDetail || {};
      const acc = (d.accounts || []).find((a) => Number(a.accountId) === Number(accountId));
      const w = acc?.dmWeight || {};
      const minV = Number(w.dmIntervalMinSec || 600);
      const maxV = Number(w.dmIntervalMaxSec || 1800);
      this.modal(`账号 #${accountId} 私信间隔`, `<div class="form-grid">
        <div class="field"><label>最小间隔（秒）</label><input class="input" type="number" min="120" name="dmIntervalMinSec" value="${minV}"></div>
        <div class="field"><label>最大间隔（秒）</label><input class="input" type="number" min="120" name="dmIntervalMaxSec" value="${maxV}"></div>
        <p class="muted full">同一账号两次成功私信之间会在最小～最大秒数内随机等待。</p>
      </div>`, async (data) => {
        await this.api(`/accounts/${accountId}/dm-settings`, {
          method: 'PUT',
          body: JSON.stringify({
            dmIntervalMinSec: Number(data.dmIntervalMinSec || 600),
            dmIntervalMaxSec: Number(data.dmIntervalMaxSec || 1800),
          }),
        });
        this.toast('间隔已保存');
        this.closeModal();
        this.refresh();
      }, false, { submitText: '保存' });
    },
    openAiLeadLogForm(leadId) {
      this.modal('添加记录', `<div class="form-grid">
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
        <div class="field"><label>关联记录</label><select class="input" name="leadLogId">${logOpts}</select></div>
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
      this.modal('添加创作者', `<div class="form-grid">
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

