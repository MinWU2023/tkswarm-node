(function () {
  if (!window.app) throw new Error('app-core must load before pages/aiLeadClues.js');

  const DM_STATUS_META = {
    none: { label: '未私信', tone: 'muted' },
    pending: { label: '待发送', tone: 'warn' },
    sent: { label: '已发送', tone: 'success' },
    failed: { label: '失败', tone: 'error' },
    skipped: { label: '已跳过', tone: 'muted' },
  };

  const DEFAULT_EXPORT_FIELDS = [
    'nickname', 'username', 'profileUrl', 'keywords', 'industryLabel', 'intentScore',
    'dmStatusLabel', 'accountUsername', 'createdAt',
  ];

  const __methods = {
    defaultAiLeadClueExportFields() {
      return DEFAULT_EXPORT_FIELDS.slice();
    },
    aiLeadClueDmBadge(status) {
      const st = String(status || 'none');
      const m = DM_STATUS_META[st] || { label: st, tone: 'muted' };
      return `<span class="badge ${this.esc(m.tone)} ai-clue-dm-badge">${this.esc(m.label)}</span>`;
    },
    aiLeadClueScoreBadge(score) {
      const n = Math.max(0, Math.min(10, Number(score) || 0));
      let tone = 'muted';
      if (n >= 8) tone = 'success';
      else if (n >= 5) tone = 'online';
      else if (n >= 3) tone = 'warn';
      return `<span class="ai-clue-score badge ${tone}" title="意向评级">${n}<span class="ai-clue-score-max">/10</span></span>`;
    },
    async renderAiLeadClues() {
      const host = document.querySelector('#content');
      if (!host) return;
      if (!this.canAiLeads?.()) {
        host.innerHTML = `<div class="panel"><div class="empty">当前角色无权查看 AI 线索</div></div>`;
        return;
      }

      const page = this.aiLeadCluesPage || 1;
      const kw = this.aiLeadCluesKeyword || '';
      const dmStatus = this.aiLeadCluesDmStatus || '';
      const sourceType = this.aiLeadCluesSourceType || '';
      const minScore = this.aiLeadCluesMinScore || '';
      const leadId = this.aiLeadCluesLeadId || '';
      const industryId = this.aiLeadCluesIndustryId || '';

      const q = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (kw) q.set('keyword', kw);
      if (dmStatus) q.set('dmStatus', dmStatus);
      if (sourceType) q.set('sourceType', sourceType);
      if (minScore) q.set('minScore', String(minScore));
      if (leadId) q.set('leadId', String(leadId));
      if (industryId) q.set('industryId', String(industryId));

      try {
        const pack = await this.api('/ai-lead-clues?' + q.toString());
        this.aiLeadCluesPage = pack.page || page;
        this._aiLeadClueExportFieldsMeta = pack.exportFields || [];
        const items = pack.items || [];
        const dmOpts = (pack.dmStatuses || []).map((x) =>
          `<option value="${this.esc(x.code)}" ${dmStatus === x.code ? 'selected' : ''}>${this.esc(x.label)}</option>`
        ).join('');
        const srcOpts = (pack.sourceTypes || []).map((x) =>
          `<option value="${this.esc(x.code)}" ${sourceType === x.code ? 'selected' : ''}>${this.esc(x.label)}</option>`
        ).join('');

        const sum = pack.summary || {};
        const totalN = sum.total != null ? sum.total : (pack.total || 0);
        const sentN = sum.sent != null ? sum.sent : items.filter((x) => x.dmStatus === 'sent').length;
        const failN = sum.failed != null ? sum.failed : items.filter((x) => x.dmStatus === 'failed').length;
        const pendingN = sum.pending != null ? sum.pending : items.filter((x) => x.dmStatus === 'none' || x.dmStatus === 'pending').length;

        host.innerHTML = `<div class="ai-clue-page">
          <div class="ai-clue-hero panel">
            <div class="ai-clue-hero__text">
              <h2 class="ai-clue-hero__title">拓客线索</h2>
              <p class="ai-clue-hero__desc">汇总 AI 拓客筛选出的意向用户与评论，统一管理私信状态与关联账号。</p>
            </div>
            <div class="ai-clue-hero__stats">
              <div class="ai-clue-stat"><b>${totalN}</b><span>线索总数</span></div>
              <div class="ai-clue-stat ai-clue-stat--ok"><b>${sentN}</b><span>已发送</span></div>
              <div class="ai-clue-stat ai-clue-stat--warn"><b>${pendingN}</b><span>待处理</span></div>
              <div class="ai-clue-stat ai-clue-stat--bad"><b>${failN}</b><span>失败</span></div>
            </div>
          </div>

          <div class="panel ai-clue-panel">
            <div class="toolbar ai-clue-toolbar">
              <div class="ai-clue-filters">
                <input class="input" id="ai-clue-keyword" placeholder="昵称 / 用户名 / 关键词 / 评论" value="${this.esc(kw)}" onkeydown="if(event.key==='Enter')app.searchAiLeadClues()">
                <select class="input" id="ai-clue-dm-status"><option value="">全部私信状态</option>${dmOpts}</select>
                <select class="input" id="ai-clue-source"><option value="">全部类型</option>${srcOpts}</select>
                ${typeof this.industryFilterOptionsHtml === 'function' ? this.industryFilterOptionsHtml(pack.industries || [], industryId, 'ai-clue-industry') : ''}
                <input class="input" id="ai-clue-min-score" type="number" min="0" max="10" placeholder="最低评级" value="${this.esc(minScore)}" style="width:100px">
                <input class="input" id="ai-clue-lead-id" type="number" min="0" placeholder="任务ID" value="${this.esc(leadId)}" style="width:100px">
                <button class="primary" type="button" onclick="app.searchAiLeadClues()">查询</button>
                <button class="ghost" type="button" onclick="app.resetAiLeadClueFilters()">重置</button>
              </div>
              <div class="ai-clue-actions">
                ${this.canEditAiLeads?.()?`<div class="dropdown">
                  <button class="ghost" type="button" onclick="app.toggleAiLeadClueBatchMenu(event)">批量操作 <span class="btn-arrow-down">▾</span></button>
                  <div id="ai-clue-batch-menu" class="dropdown-menu align-left hidden">
                    <button type="button" onclick="app.openAiLeadClueBatchShare()">抄送</button>
                  </div>
                </div>
                <button class="ghost" type="button" onclick="app.openAiLeadClueExport()">导出</button>`:''}
                <button class="ghost" type="button" onclick="app.navigate('aiLeads','clue_data')">拓客结果</button>
                <button class="ghost" type="button" onclick="app.navigate('aiLeads','list')">AI 拓客</button>
                <button class="primary" type="button" onclick="app.refresh()">刷新</button>
              </div>
            </div>

            <div id="ai-clue-batch-bar" class="ai-clue-batch-bar hidden">
              <span>已选 <b id="ai-clue-selected-count">0</b> 条线索</span>
              ${this.canEditAiLeads?.()?`<button class="primary tiny" type="button" onclick="app.openAiLeadClueBatchShare()">批量抄送</button>`:''}
              <button class="ghost tiny" type="button" onclick="app.clearAiLeadClueSelection()">取消选择</button>
            </div>
            <div class="table-container ai-clue-table-wrap">
              ${items.length ? `<table class="ai-clue-table"><thead><tr>
                <th style="width:44px"><input type="checkbox" id="ai-clue-check-all" title="全选本页" onchange="app.toggleAllAiLeadClues(this.checked)"></th>
                <th>用户</th><th>主页</th><th>行业</th><th>关键词</th><th>评级</th><th>抄送</th><th>私信状态</th><th>关联账号</th><th>时间</th><th style="width:240px">操作</th>
              </tr></thead><tbody>
                ${items.map((row) => this.aiLeadClueRowHtml(row)).join('')}
              </tbody></table>` : `<div class="empty ai-clue-empty">
                <div class="ai-clue-empty__icon" aria-hidden="true">◇</div>
                <p>暂无线索数据</p>
                <span class="muted">运行 AI 拓客任务后，意向用户与评论将出现在此处</span>
              </div>`}
            </div>
            ${UI.pager({ page: pack.page, pages: pack.pages, total: pack.total, pageSize: pack.pageSize }, 'aiLeadCluesPage')}
          </div>
        </div>`;
      } catch (e) {
        host.innerHTML = `<div class="panel"><div class="empty">加载失败：${this.esc(e.message)}</div></div>`;
      }
    },
    aiLeadClueRowHtml(row) {
      const nick = row.nickname || row.username || '-';
      const uname = row.username ? `@${String(row.username).replace(/^@+/, '')}` : '';
      const profile = row.profileUrl || '';
      const kw = String(row.keywords || '').split(/[\r\n,，;；]+/)[0] || row.keywords || '-';
      const indHtml = typeof this.industryTagHtml === 'function'
        ? this.industryTagHtml(row.industryLabel || row.industry?.label || '')
        : this.esc(row.industryLabel || '-');
      const acc = row.accountId
        ? `#${row.accountId} ${this.esc(row.accountUsername || row.accountNickname || '')}`
        : '<span class="muted">未指定</span>';
      const errTip = row.errorMessage ? ` title="${this.esc(row.errorMessage)}"` : '';
      const changeBtn = row.canChangeAccount
        ? `<button class="tiny ghost ai-clue-btn-change" type="button" onclick='app.openAiLeadClueChangeAccount(${JSON.stringify(row.clueKey)})'>更换关联账号</button>`
        : '';
      const canShare = row.canShare !== false;
      const sharedN = Number(row.sharedUserCount || 0);
      const shareBadge = sharedN > 0
        ? `<span class="ai-clue-share-tag" title="已抄送给 ${sharedN} 位客户">${sharedN} 人</span>`
        : '<span class="muted">-</span>';
      const shareBtn = canShare
        ? `<button class="tiny ghost" type="button" onclick='app.openAiLeadClueBatchShare(${JSON.stringify([row.clueKey])})'>抄送</button>`
        : '';
      const checkHtml = canShare
        ? `<input type="checkbox" class="ai-clue-check" value="${this.esc(row.clueKey)}" onchange="app.syncAiLeadClueSelection()">`
        : `<input type="checkbox" disabled title="无权抄送">`;
      return `<tr class="ai-clue-row" data-key="${this.esc(row.clueKey)}" data-source="${this.esc(row.sourceType || '')}">
        <td>${checkHtml}</td>
        <td>
          <div class="ai-clue-user">
            <span class="ai-clue-user__avatar">${(nick || '?').slice(0, 1).toUpperCase()}</span>
            <div>
              <b>${this.esc(nick)}</b>
              ${uname ? `<div class="muted ai-clue-user__uname">${this.esc(uname)}</div>` : ''}
              <span class="ai-clue-type-tag">${this.esc(row.sourceTypeLabel || '')}</span>
            </div>
          </div>
        </td>
        <td>${profile ? `<a class="ai-clue-link" href="${this.esc(profile)}" target="_blank" rel="noopener">打开主页</a>` : '-'}</td>
        <td>${indHtml}</td>
        <td><span class="ai-clue-kw">${this.esc(kw)}</span></td>
        <td>${this.aiLeadClueScoreBadge(row.intentScore)}</td>
        <td>${shareBadge}</td>
        <td${errTip}>${this.aiLeadClueDmBadge(row.dmStatus)}${row.errorMessage ? `<div class="muted ai-clue-err">${this.esc(String(row.errorMessage).slice(0, 40))}</div>` : ''}</td>
        <td>${acc}</td>
        <td><span class="muted">${this.esc(row.createdAt || '')}</span></td>
        <td class="ai-clue-ops">
          ${shareBtn}
          ${changeBtn}
          <button class="tiny primary" type="button" onclick='app.openAiLeadClueDetail(${JSON.stringify(row.clueKey)})'>详情</button>
        </td>
      </tr>`;
    },
    toggleAiLeadClueBatchMenu(e) {
      e?.stopPropagation?.();
      this.toggleToolbarDropdown('#ai-clue-batch-menu', e);
    },
    getSelectedAiLeadClueKeys() {
      return [...document.querySelectorAll('.ai-clue-check:checked')].map((el) => String(el.value || '').trim()).filter(Boolean);
    },
    syncAiLeadClueSelection() {
      const keys = this.getSelectedAiLeadClueKeys();
      const bar = document.querySelector('#ai-clue-batch-bar');
      const countEl = document.querySelector('#ai-clue-selected-count');
      const allEl = document.querySelector('#ai-clue-check-all');
      const checks = [...document.querySelectorAll('.ai-clue-check:not(:disabled)')];
      if (countEl) countEl.textContent = String(keys.length);
      if (bar) bar.classList.toggle('hidden', keys.length === 0);
      if (allEl && checks.length) {
        allEl.checked = keys.length > 0 && keys.length === checks.length;
        allEl.indeterminate = keys.length > 0 && keys.length < checks.length;
      }
    },
    toggleAllAiLeadClues(checked) {
      document.querySelectorAll('.ai-clue-check:not(:disabled)').forEach((el) => { el.checked = !!checked; });
      this.syncAiLeadClueSelection();
    },
    clearAiLeadClueSelection() {
      document.querySelectorAll('.ai-clue-check, #ai-clue-check-all').forEach((el) => {
        el.checked = false;
        el.indeterminate = false;
      });
      this.syncAiLeadClueSelection();
    },
    async openAiLeadClueBatchShare(presetKeys) {
      if (!this.canEditAiLeads?.()) { this.toast('当前角色无权抄送线索', true); return; }
      document.querySelector('#ai-clue-batch-menu')?.classList.add('hidden');
      const clueKeys = Array.isArray(presetKeys) && presetKeys.length
        ? presetKeys.map((k) => String(k || '').trim()).filter(Boolean)
        : this.getSelectedAiLeadClueKeys();
      if (!clueKeys.length) {
        this.toast('请先勾选要抄送的线索', true);
        return;
      }
      const commentCount = clueKeys.filter((k) => String(k).startsWith('c-')).length;
      const creatorCount = clueKeys.length - commentCount;
      try {
        const pack = await this.api('/ai-lead-clues/share-users?roleName=' + encodeURIComponent('企业客户'));
        const role = pack.role;
        const users = pack.items || [];
        if (!role) {
          this.toast('未找到「企业客户」角色，请先在权限管理中创建', true);
          return;
        }
        if (!users.length) {
          this.toast('「企业客户」角色下暂无可用用户', true);
          return;
        }
        const roleLabel = this.esc(role.name || '企业客户');
        const parts = [];
        if (commentCount) parts.push(`${commentCount} 条评论线索`);
        if (creatorCount) parts.push(`${creatorCount} 条用户线索`);
        const heroDesc = `已选 ${clueKeys.length} 条（${parts.join(' + ')}）。抄送后客户可在「拓客结果」/企业后台查看。`;
        const userGrid = `<div class="ai-clue-share-users">${users.map((u) => {
          const label = u.label || u.username || ('#' + u.id);
          const initial = String(label).trim().slice(0, 1).toUpperCase() || '?';
          const sub = u.username && u.username !== label ? u.username : '';
          return `<label class="ai-clue-share-user">
            <input type="checkbox" class="ai-clue-share-user__input" name="shareUserIds" value="${Number(u.id)}" onchange="this.closest('.ai-clue-share-user')?.classList.toggle('is-on', this.checked)">
            <span class="ai-clue-share-user__avatar">${this.esc(initial)}</span>
            <span class="ai-clue-share-user__info">
              <b>${this.esc(label)}</b>
              ${sub ? `<span class="muted">${this.esc(sub)}</span>` : ''}
            </span>
            <span class="ai-clue-share-user__mark" aria-hidden="true"></span>
          </label>`;
        }).join('')}</div>`;
        this.modal('批量抄送', `<div class="ai-clue-share">
          <div class="ai-clue-share__hero">
            <span class="ai-clue-share__badge">已选 ${clueKeys.length} 条线索</span>
            <p class="ai-clue-share__desc">${this.esc(heroDesc)}</p>
          </div>
          <section class="ai-clue-share__section">
            <div class="ai-clue-share__head">
              <div>
                <h4 class="ai-clue-share__title">抄送目标</h4>
                <p class="ai-clue-share__sub">「${roleLabel}」角色下的用户</p>
              </div>
              <div class="ai-clue-share__tools">
                <button type="button" class="tiny ghost" onclick="app.toggleAiLeadClueShareUsers(true)">全选</button>
                <button type="button" class="tiny ghost" onclick="app.toggleAiLeadClueShareUsers(false)">清空</button>
              </div>
            </div>
            ${userGrid}
          </section>
        </div>`, async () => {
          const userIds = [...document.querySelectorAll('.ai-clue-share-users input[name="shareUserIds"]:checked')]
            .map((el) => Number(el.value)).filter(Boolean);
          if (!userIds.length) {
            this.toast('请选择抄送客户', true);
            return;
          }
          const result = await this.api('/ai-lead-clues/batch-share', {
            method: 'POST',
            body: JSON.stringify({
              clueKeys,
              userIds,
              roleName: '企业客户',
            }),
          });
          this.closeModal();
          if (!Array.isArray(presetKeys) || !presetKeys.length) {
            this.clearAiLeadClueSelection();
          }
          const created = Number(result?.created || 0);
          const sharedComments = Number(result?.comments || 0);
          const sharedCreators = Number(result?.creators || 0);
          let msg = `已抄送 ${sharedComments + sharedCreators} 条线索给 ${result?.users || userIds.length} 位客户`;
          if (sharedComments || sharedCreators) {
            const bits = [];
            if (sharedComments) bits.push(`评论 ${sharedComments}`);
            if (sharedCreators) bits.push(`用户 ${sharedCreators}`);
            msg += `（${bits.join('，')}）`;
          }
          if (created) msg += `，新建 ${created} 条共享`;
          this.toast(msg);
          this.refresh();
        }, false, { submitText: '确认抄送' });
        const modalEl = document.querySelector('#modal');
        modalEl?.classList.add('ai-clue-share-modal');
        const prevClose = this._modalOnClose;
        this._modalOnClose = () => {
          modalEl?.classList.remove('ai-clue-share-modal');
          if (typeof prevClose === 'function') prevClose();
        };
      } catch (e) {
        this.toast(e.message, true);
      }
    },
    toggleAiLeadClueShareUsers(checked) {
      document.querySelectorAll('.ai-clue-share-user__input').forEach((el) => {
        el.checked = !!checked;
        el.closest('.ai-clue-share-user')?.classList.toggle('is-on', !!checked);
      });
    },
    searchAiLeadClues() {
      this.aiLeadCluesKeyword = document.querySelector('#ai-clue-keyword')?.value || '';
      this.aiLeadCluesDmStatus = document.querySelector('#ai-clue-dm-status')?.value || '';
      this.aiLeadCluesSourceType = document.querySelector('#ai-clue-source')?.value || '';
      this.aiLeadCluesMinScore = document.querySelector('#ai-clue-min-score')?.value || '';
      this.aiLeadCluesLeadId = document.querySelector('#ai-clue-lead-id')?.value || '';
      this.aiLeadCluesIndustryId = document.querySelector('#ai-clue-industry')?.value || '';
      this.aiLeadCluesPage = 1;
      this.refresh();
    },
    resetAiLeadClueFilters() {
      this.aiLeadCluesKeyword = '';
      this.aiLeadCluesDmStatus = '';
      this.aiLeadCluesSourceType = '';
      this.aiLeadCluesMinScore = '';
      this.aiLeadCluesLeadId = '';
      this.aiLeadCluesIndustryId = '';
      this.aiLeadCluesPage = 1;
      this.refresh();
    },
    async openAiLeadClueDetail(clueKey) {
      const key = String(clueKey || '').trim();
      if (!key) return;
      try {
        const d = await this.api('/ai-lead-clues/' + encodeURIComponent(key));
        const lead = d.lead || {};
        const comment = d.comment || null;
        const creator = d.creator || null;
        const records = d.dmRecords || [];

        const profileBlock = d.profileUrl
          ? `<a href="${this.esc(d.profileUrl)}" target="_blank" rel="noopener" class="ai-clue-link">${this.esc(d.profileUrl)}</a>`
          : '-';

        let extra = '';
        if (comment) {
          extra += `<section class="ai-clue-detail-section">
            <h4>评论内容</h4>
            <div class="ai-clue-detail-quote">${this.esc(comment.commentText || '-')}</div>
            ${comment.commentTextZh ? `<div class="muted ai-clue-detail-sub">译文：${this.esc(comment.commentTextZh)}</div>` : ''}
            ${comment.aiReason ? `<div class="muted ai-clue-detail-sub">AI 原因：${this.esc(comment.aiReason)}</div>` : ''}
            ${comment.videoUrl ? `<div class="ai-clue-detail-sub"><span class="muted">来源视频：</span><a href="${this.esc(comment.videoUrl)}" target="_blank" rel="noopener" class="ai-clue-link">${this.esc(comment.videoName || comment.videoUrl)}</a></div>` : ''}
          </section>`;
        }
        if (creator) {
          extra += `<section class="ai-clue-detail-section">
            <h4>用户资料</h4>
            <div class="ai-clue-detail-grid">
              ${creator.avatar ? `<div class="full"><img src="${this.esc(creator.avatar)}" alt="" style="width:56px;height:56px;border-radius:50%;object-fit:cover"></div>` : ''}
              <div><span class="muted">粉丝</span><b>${Number(creator.followers || 0)}</b></div>
              <div><span class="muted">关注</span><b>${Number(creator.following || 0)}</b></div>
              <div><span class="muted">获赞</span><b>${Number(creator.likes || 0)}</b></div>
              <div><span class="muted">地区</span><b>${this.esc(creator.region || '-')}</b></div>
              ${creator.signature ? `<div class="full"><span class="muted">简介</span><p>${this.esc(creator.signature)}</p></div>` : ''}
            </div>
          </section>`;
        }

        const recRows = records.length
          ? records.map((r) => `<tr>
              <td>#${r.id}</td>
              <td>#${r.accountId} ${this.esc(r.accountUsername || '')}</td>
              <td>${this.aiLeadClueDmBadge(r.status)}</td>
              <td title="${this.esc(r.errorMessage || '')}">${this.esc((r.errorMessage || r.message || '-').slice(0, 60))}</td>
              <td>${this.esc(r.createdAt || '')}</td>
            </tr>`).join('')
          : `<tr><td colspan="5" class="muted">暂无私信记录</td></tr>`;

        const html = `<div class="ai-clue-detail">
          <div class="ai-clue-detail-head">
            <div class="ai-clue-detail-head__main">
              <span class="ai-clue-user__avatar ai-clue-user__avatar--lg">${(d.nickname || d.username || '?').slice(0, 1).toUpperCase()}</span>
              <div>
                <h3>${this.esc(d.nickname || d.username || '未知用户')}</h3>
                <p class="muted">${d.username ? '@' + this.esc(String(d.username).replace(/^@+/, '')) : ''} · ${this.esc(d.sourceTypeLabel || '')}</p>
              </div>
            </div>
            <div class="ai-clue-detail-head__badges">
              ${this.aiLeadClueScoreBadge(d.intentScore)}
              ${this.aiLeadClueDmBadge(d.dmStatus)}
            </div>
          </div>
          <div class="ai-clue-detail-grid ai-clue-detail-meta">
            <div><span class="muted">主页</span>${profileBlock}</div>
            <div><span class="muted">关键词</span><b>${this.esc(d.keywords || '-')}</b></div>
            <div><span class="muted">行业</span><b>${this.esc(d.industryLabel || d.industry?.label || '-')}</b></div>
            <div><span class="muted">关联账号</span><b>${d.accountId ? '#' + d.accountId + ' ' + this.esc(d.accountUsername || '') : '未指定'}</b></div>
            <div><span class="muted">拓客任务</span><a href="javascript:void(0)" onclick="app.openAiLeadDetail(${d.leadId},'comments')">#${d.leadId} ${this.esc(lead.typeLabel || '')}</a></div>
            <div><span class="muted">发现时间</span><b>${this.esc(d.createdAt || '')}</b></div>
            ${d.uuid ? `<div><span class="muted">UUID</span><code>${this.esc(d.uuid)}</code></div>` : ''}
            ${Number(d.sharedUserCount || 0) > 0 ? `<div class="full"><span class="muted">已抄送</span><b>${Number(d.sharedUserCount)} 位客户</b></div>` : ''}
          </div>
          ${extra}
          ${(d.sharedUsers || []).length ? `<section class="ai-clue-detail-section">
            <h4>抄送客户</h4>
            <div class="ai-clue-shared-users">${(d.sharedUsers || []).map((u) =>
              `<span class="ai-clue-share-tag">${this.esc(u.label || u.username || ('#' + u.id))}${u.roleName ? `<small class="muted"> · ${this.esc(u.roleName)}</small>` : ''}</span>`
            ).join('')}</div>
          </section>` : ''}
          <section class="ai-clue-detail-section">
            <h4>私信记录</h4>
            <div class="table-container"><table><thead><tr><th>ID</th><th>账号</th><th>状态</th><th>内容/原因</th><th>时间</th></tr></thead><tbody>${recRows}</tbody></table></div>
          </section>
          <div class="ai-clue-detail-foot">
            ${d.canShare ? `<button type="button" class="ghost" onclick="app.closeModal();app.openAiLeadClueBatchShare(${JSON.stringify([key])})">抄送客户</button>` : ''}
            ${d.canChangeAccount ? `<button type="button" class="ghost" onclick="app.closeModal();app.openAiLeadClueChangeAccount(${JSON.stringify(key)})">更换关联账号</button>` : ''}
            ${d.canChangeAccount && d.username ? `<button type="button" class="primary" onclick="app.closeModal();app.testAiLeadDm(${d.leadId},${JSON.stringify(String(d.username).replace(/^@+/, ''))},${Number(d.accountId) || 0})">重试私信</button>` : ''}
          </div>
        </div>`;

        this.modal('线索详情', html, null, true, { wide: true, hideFooter: true });
        const modalEl = document.querySelector('#modal');
        modalEl?.classList.add('ai-clue-detail-modal');
        const prevClose = this._modalOnClose;
        this._modalOnClose = () => {
          modalEl?.classList.remove('ai-clue-detail-modal');
          if (typeof prevClose === 'function') prevClose();
        };
      } catch (e) {
        this.toast(e.message, true);
      }
    },
    async openAiLeadClueChangeAccount(clueKey) {
      const key = String(clueKey || '').trim();
      if (!key) return;
      try {
        const d = await this.api('/ai-lead-clues/' + encodeURIComponent(key));
        const accounts = d.leadAccounts || [];
        if (!accounts.length) {
          this.toast('该拓客任务未关联可用账号', true);
          return;
        }
        const opts = accounts.map((a) =>
          `<option value="${a.accountId}" ${Number(d.accountId) === Number(a.accountId) ? 'selected' : ''}>#${a.accountId} ${this.esc(a.username || '')} ${a.nickname ? '(' + this.esc(a.nickname) + ')' : ''}</option>`
        ).join('');
        const nick = d.nickname || d.username || '该用户';
        this.modal('更换关联账号', `<div class="ai-clue-change-form">
          <p class="muted" style="margin:0 0 12px">为 <b>${this.esc(nick)}</b> 指定新的私信执行账号。可选择更换后立即入队发送。</p>
          <div class="field full"><label>关联账号</label><select class="input" name="accountId">${opts}</select></div>
          <div class="field full"><label class="check-row"><input type="checkbox" name="sendDm" value="1" checked> 更换后立即入队私信</label></div>
        </div>`, async (data) => {
          const accountId = Number(data.accountId || 0);
          if (!accountId) {
            this.toast('请选择账号', true);
            return;
          }
          const pack = await this.api('/ai-lead-clues/' + encodeURIComponent(key) + '/account', {
            method: 'PATCH',
            body: JSON.stringify({
              accountId,
              sendDm: data.sendDm === '1' || data.sendDm === true || data.sendDm === 'on',
            }),
          });
          this.closeModal();
          this.toast('已更换关联账号');
          if (pack?.needPoll && typeof this.kickAiLeadExecutorPoll === 'function') {
            await this.kickAiLeadExecutorPoll(pack);
          }
          this.refresh();
        }, false, { submitText: '确认更换', wide: true });
      } catch (e) {
        this.toast(e.message, true);
      }
    },
    defaultAiLeadClueIoFields() {
      const meta = this._aiLeadClueExportFieldsMeta?.length
        ? this._aiLeadClueExportFieldsMeta
        : DEFAULT_EXPORT_FIELDS.map((code) => ({ code, label: code, defaultOn: true }));
      return meta.map((x) => ({
        key: x.code,
        label: x.label || x.code,
        on: x.defaultOn !== false,
      }));
    },
    collectAiLeadClueExportForm() {
      const fields = (this.aiLeadClueIoFields || []).map((x, i) => {
        const on = !!document.querySelector(`.ai-clue-field-on[data-idx="${i}"]`)?.checked;
        const label = document.querySelector(`.ai-clue-field-label[data-idx="${i}"]`)?.value ?? x.label;
        return { ...x, on, label: String(label || x.key).trim() || x.key };
      });
      this.aiLeadClueIoFields = fields;
      return fields;
    },
    moveAiLeadClueIoField(idx, dir) {
      const list = (this.aiLeadClueIoFields || this.defaultAiLeadClueIoFields()).slice();
      const i = Number(idx);
      const j = i + Number(dir || 0);
      if (i < 0 || j < 0 || i >= list.length || j >= list.length) return;
      this.collectAiLeadClueExportForm();
      const next = this.aiLeadClueIoFields.slice();
      const t = next[i];
      next[i] = next[j];
      next[j] = t;
      this.aiLeadClueIoFields = next;
      this.openAiLeadClueExport();
    },
    resetAiLeadClueExportFields() {
      this.aiLeadClueIoFields = this.defaultAiLeadClueIoFields();
      this.openAiLeadClueExport();
    },
    openAiLeadClueExport() {
      if (!this.canEditAiLeads?.()) { this.toast('当前角色无权导出线索', true); return; }
      if (!Array.isArray(this.aiLeadClueIoFields) || !this.aiLeadClueIoFields.length) {
        this.aiLeadClueIoFields = this.defaultAiLeadClueIoFields();
      }
      const fields = this.aiLeadClueIoFields;
      const rows = fields.map((x, i) => `<tr>
        <td class="ai-clue-export-order">
          <button type="button" class="icon-btn" title="上移" onclick="app.moveAiLeadClueIoField(${i},-1)" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="icon-btn" title="下移" onclick="app.moveAiLeadClueIoField(${i},1)" ${i === fields.length - 1 ? 'disabled' : ''}>↓</button>
        </td>
        <td><input type="checkbox" class="ai-clue-field-on" data-idx="${i}" ${x.on ? 'checked' : ''}></td>
        <td><code>${this.esc(x.key)}</code><span class="muted"> · ${this.esc((this._aiLeadClueExportFieldsMeta || []).find((m) => m.code === x.key)?.label || x.key)}</span></td>
        <td><input class="input ai-clue-field-label" data-idx="${i}" value="${this.esc(x.label || '')}" style="width:100%;max-width:280px"></td>
      </tr>`).join('');

      this.modal('导出 AI 线索', `<div class="ai-clue-export">
        <p class="muted">按当前筛选条件导出（最多 10000 条）。勾选要导出的字段，用 ↑↓ 调整列顺序，可自定义 CSV 表头名。</p>
        <div class="table-container task-io-fields-table" style="margin:12px 0 14px">
          <table class="ai-clue-export-table"><thead><tr>
            <th style="width:72px">排序</th><th style="width:56px">导出</th><th>字段</th><th>表头名</th>
          </tr></thead><tbody>${rows}</tbody></table>
        </div>
        <div class="action-bar">
          <button type="button" class="ghost" onclick="app.resetAiLeadClueExportFields()">恢复默认字段</button>
        </div>
      </div>`, async () => {
        await this.submitAiLeadClueExport();
      }, false, { submitText: '导出 CSV', wide: true });
    },
    async submitAiLeadClueExport() {
      const fields = this.collectAiLeadClueExportForm().filter((x) => x.on);
      if (!fields.length) {
        this.toast('请至少勾选一个导出字段', true);
        return;
      }
      const headers = {};
      fields.forEach((x) => { headers[x.key] = x.label; });
      const q = new URLSearchParams();
      q.set('fields', fields.map((x) => x.key).join(','));
      q.set('headers', JSON.stringify(headers));
      if (this.aiLeadCluesKeyword) q.set('keyword', this.aiLeadCluesKeyword);
      if (this.aiLeadCluesDmStatus) q.set('dmStatus', this.aiLeadCluesDmStatus);
      if (this.aiLeadCluesSourceType) q.set('sourceType', this.aiLeadCluesSourceType);
      if (this.aiLeadCluesMinScore) q.set('minScore', String(this.aiLeadCluesMinScore));
      if (this.aiLeadCluesLeadId) q.set('leadId', String(this.aiLeadCluesLeadId));
      if (this.aiLeadCluesIndustryId) q.set('industryId', String(this.aiLeadCluesIndustryId));
      try {
        const headers = {};
        if (this.authToken) headers.Authorization = 'Bearer ' + this.authToken;
        const acting = this.getActingAsId?.();
        if (acting) headers['X-Acting-As'] = String(acting);
        const base = window.TKSWARM_API_BASE || '';
        const r = await fetch(base + '/api/ai-lead-clues/export.csv?' + q.toString(), { headers });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.message || '导出失败');
        }
        const text = await r.text();
        if (!String(text || '').trim()) {
          this.toast('没有可导出的线索', true);
          return;
        }
        const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ai-lead-clues.csv';
        a.click();
        URL.revokeObjectURL(url);
        this.closeModal();
        this.toast('导出成功');
      } catch (e) {
        this.toast(e.message, true);
      }
    },
  };

  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages.aiLeadClues = true;
})();
