(function () {
  if (!window.app) throw new Error('app-core must load before pages/aiLeadClueData.js');

  const __methods = {
    canAiLeadClueData() {
      return this.canNavigateMenu?.('aiLeads', 'clue_data')
        || this.canAiLeads?.()
        || this.canPermission('ai.leads');
    },
    async renderAiLeadClueData() {
      const host = document.querySelector('#content');
      if (!host) return;
      if (!this.canAiLeadClueData()) {
        host.innerHTML = `<div class="panel"><div class="empty">当前角色无权查看线索数据</div></div>`;
        return;
      }

      const page = this.aiLeadClueDataPage || 1;
      const kw = this.aiLeadClueDataKeyword || '';
      const minScore = this.aiLeadClueDataMinScore || '';
      const leadId = this.aiLeadClueDataLeadId || '';

      const q = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (kw) q.set('keyword', kw);
      if (minScore) q.set('minScore', String(minScore));
      if (leadId) q.set('leadId', String(leadId));

      try {
        const pack = await this.api('/ai-lead-clue-data?' + q.toString());
        this.aiLeadClueDataPage = pack.page || page;
        const items = pack.items || [];
        const totalN = pack.summary?.total != null ? pack.summary.total : (pack.total || 0);

        host.innerHTML = `<div class="ai-clue-page ai-clue-data-page">
          <div class="ai-clue-hero panel ai-clue-data-hero">
            <div class="ai-clue-hero__text">
              <h2 class="ai-clue-hero__title">拓客结果</h2>
              <p class="ai-clue-hero__desc">查看共享给您的评论线索，按意向评级筛选，不含私信与账号信息。</p>
            </div>
            <div class="ai-clue-hero__stats">
              <div class="ai-clue-stat"><b>${totalN}</b><span>可见线索</span></div>
              <div class="ai-clue-stat ai-clue-stat--ok"><b>${items.filter((x) => Number(x.intentScore) >= 8).length}</b><span>高意向</span></div>
            </div>
          </div>

          <div class="panel ai-clue-panel">
            <div class="toolbar ai-clue-toolbar">
              <div class="ai-clue-filters">
                <input class="input" id="ai-clue-data-keyword" placeholder="昵称 / 用户名 / 关键词 / 评论" value="${this.esc(kw)}" onkeydown="if(event.key==='Enter')app.searchAiLeadClueData()">
                <input class="input" id="ai-clue-data-min-score" type="number" min="0" max="10" placeholder="最低评级" value="${this.esc(minScore)}" style="width:100px">
                <input class="input" id="ai-clue-data-lead-id" type="number" min="0" placeholder="任务ID" value="${this.esc(leadId)}" style="width:100px">
                <button class="primary" type="button" onclick="app.searchAiLeadClueData()">查询</button>
                <button class="ghost" type="button" onclick="app.resetAiLeadClueDataFilters()">重置</button>
              </div>
              <div class="ai-clue-actions">
                <button class="primary" type="button" onclick="app.refresh()">刷新</button>
              </div>
            </div>

            <div class="table-container ai-clue-table-wrap">
              ${items.length ? `<table class="ai-clue-table ai-clue-data-table"><thead><tr>
                <th>用户</th><th>主页</th><th>行业</th><th>关键词</th><th>评级</th><th>评论摘要</th><th style="width:120px">操作</th>
              </tr></thead><tbody>
                ${items.map((row) => this.aiLeadClueDataRowHtml(row)).join('')}
              </tbody></table>` : `<div class="empty ai-clue-empty">
                <div class="ai-clue-empty__icon" aria-hidden="true">◇</div>
                <p>暂无共享线索</p>
                <span class="muted">拓客任务配置共享用户后，通过的评论线索将出现在此处</span>
              </div>`}
            </div>
            ${UI.pager({ page: pack.page, pages: pack.pages, total: pack.total, pageSize: pack.pageSize }, 'aiLeadClueDataPage')}
          </div>
        </div>`;
      } catch (e) {
        host.innerHTML = `<div class="panel"><div class="empty">加载失败：${this.esc(e.message)}</div></div>`;
      }
    },
    aiLeadClueDataRowHtml(row) {
      const nick = row.nickname || row.username || '-';
      const uname = row.username ? `@${String(row.username).replace(/^@+/, '')}` : '';
      const profile = row.profileUrl || '';
      const kw = String(row.keywords || '').split(/[\r\n,，;；]+/)[0] || row.keywords || '-';
      const commentPreview = String(row.commentText || row.commentTextZh || '').slice(0, 48);
      const indHtml = typeof this.industryTagHtml === 'function'
        ? this.industryTagHtml(row.industryLabel || row.industry?.label || '')
        : this.esc(row.industryLabel || '-');
      return `<tr class="ai-clue-row" data-key="${this.esc(row.clueKey)}">
        <td>
          <div class="ai-clue-user">
            <span class="ai-clue-user__avatar">${(nick || '?').slice(0, 1).toUpperCase()}</span>
            <div>
              <b>${this.esc(nick)}</b>
              ${uname ? `<div class="muted ai-clue-user__uname">${this.esc(uname)}</div>` : ''}
            </div>
          </div>
        </td>
        <td>${profile ? `<a class="ai-clue-link" href="${this.esc(profile)}" target="_blank" rel="noopener">打开主页</a>` : '-'}</td>
        <td>${indHtml}</td>
        <td><span class="ai-clue-kw">${this.esc(kw)}</span></td>
        <td>${this.aiLeadClueScoreBadge(row.intentScore)}</td>
        <td><span class="ai-clue-comment-preview" title="${this.esc(row.commentText || '')}">${this.esc(commentPreview || '-')}${commentPreview.length >= 48 ? '…' : ''}</span></td>
        <td class="ai-clue-ops">
          <button class="tiny primary" type="button" onclick='app.openAiLeadClueDataDetail(${JSON.stringify(row.clueKey)})'>详情</button>
        </td>
      </tr>`;
    },
    searchAiLeadClueData() {
      this.aiLeadClueDataKeyword = document.querySelector('#ai-clue-data-keyword')?.value || '';
      this.aiLeadClueDataMinScore = document.querySelector('#ai-clue-data-min-score')?.value || '';
      this.aiLeadClueDataLeadId = document.querySelector('#ai-clue-data-lead-id')?.value || '';
      this.aiLeadClueDataPage = 1;
      this.refresh();
    },
    resetAiLeadClueDataFilters() {
      this.aiLeadClueDataKeyword = '';
      this.aiLeadClueDataMinScore = '';
      this.aiLeadClueDataLeadId = '';
      this.aiLeadClueDataPage = 1;
      this.refresh();
    },
    async openAiLeadClueDataDetail(clueKey) {
      const key = String(clueKey || '').trim();
      if (!key) return;
      try {
        const d = await this.api('/ai-lead-clue-data/' + encodeURIComponent(key));
        const comment = d.comment || null;
        const profileBlock = d.profileUrl
          ? `<a href="${this.esc(d.profileUrl)}" target="_blank" rel="noopener" class="ai-clue-link">${this.esc(d.profileUrl)}</a>`
          : '-';
        const indLabel = d.industryLabel || d.industry?.label || '-';
        let extra = '';
        if (comment) {
          extra = `<section class="ai-clue-detail-section">
            <h4>评论内容</h4>
            <div class="ai-clue-detail-quote">${this.esc(comment.commentText || '-')}</div>
            ${comment.commentTextZh ? `<div class="muted ai-clue-detail-sub">译文：${this.esc(comment.commentTextZh)}</div>` : ''}
            ${comment.aiReason ? `<div class="muted ai-clue-detail-sub">AI 原因：${this.esc(comment.aiReason)}</div>` : ''}
            ${comment.videoUrl ? `<div class="ai-clue-detail-sub"><span class="muted">来源视频：</span><a href="${this.esc(comment.videoUrl)}" target="_blank" rel="noopener" class="ai-clue-link">${this.esc(comment.videoName || comment.videoUrl)}</a></div>` : ''}
          </section>`;
        }
        const html = `<div class="ai-clue-detail ai-clue-data-detail">
          <div class="ai-clue-detail-head">
            <div class="ai-clue-detail-head__main">
              <span class="ai-clue-user__avatar ai-clue-user__avatar--lg">${(d.nickname || d.username || '?').slice(0, 1).toUpperCase()}</span>
              <div>
                <h3>${this.esc(d.nickname || d.username || '未知用户')}</h3>
                <p class="muted">${d.username ? '@' + this.esc(String(d.username).replace(/^@+/, '')) : ''}</p>
              </div>
            </div>
            <div class="ai-clue-detail-head__badges">${this.aiLeadClueScoreBadge(d.intentScore)}</div>
          </div>
          <div class="ai-clue-detail-grid ai-clue-detail-meta">
            <div><span class="muted">主页</span>${profileBlock}</div>
            <div><span class="muted">行业</span><b>${this.esc(indLabel)}</b></div>
            <div><span class="muted">关键词</span><b>${this.esc(d.keywords || '-')}</b></div>
            <div><span class="muted">拓客任务</span><b>#${d.leadId || '-'}</b></div>
          </div>
          ${extra}
        </div>`;
        this.modal('线索详情', html, null, true, { wide: true, hideFooter: true });
        document.querySelector('#modal')?.classList.add('ai-clue-detail-modal');
      } catch (e) {
        this.toast(e.message, true);
      }
    },
  };

  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages.aiLeadClueData = true;
})();
