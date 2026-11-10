(() => {
  const methods = {
    openPullComments(opts = {}) {
      this.wizardOpen = false; this.massWizardOpen = false; this.deleteWizardOpen = false; this.commentReplyWizardOpen = false;
      this.pullCommentWizardOpen = false; this.pullCommentWizard = null;
      this.pullVideoListWizardOpen = false; this.pullVideoListWizard = null;
      this.matrixTab = 'pullComments';
      if (!opts.skipRefresh) this.refresh();
    },

    openPullVideoList(opts = {}) {
      this.wizardOpen = false; this.massWizardOpen = false; this.deleteWizardOpen = false; this.commentReplyWizardOpen = false;
      this.pullCommentWizardOpen = false; this.pullCommentWizard = null;
      this.pullVideoListWizardOpen = false; this.pullVideoListWizard = null;
      this.matrixTab = 'pullVideoList';
      if (!opts.skipRefresh) this.refresh();
    },

    openPullCommentWizard(opts = {}) {
      // 与「拉取视频列表」一致：列表页入口直接可创建（旧 canPublishTasksCreate 未实现会导致按钮永不出现）
      this.wizardOpen = false; this.massWizardOpen = false; this.deleteWizardOpen = false; this.commentReplyWizardOpen = false;
      this.pullVideoListWizardOpen = false; this.pullVideoListWizard = null;
      this.pullCommentWizard = {
        name: '',
        browserBackend: this.normalizeTaskBackend?.(opts.browserBackend) || this.defaultTaskBrowserBackend?.() || 'tkswarm',
        materialIds: [],
        materials: [],
        keyword: '',
        origin: '',
        page: 1,
        pages: 1,
        total: 0,
        loading: false,
        submitting: false,
      };
      this.pullCommentWizardOpen = true;
      this.matrixTab = 'pullComments';
      if (!opts.skipRefresh) this.refresh();
    },

    closePullCommentWizard() {
      this.pullCommentWizardOpen = false; this.pullCommentWizard = null;
      this.matrixTab = 'pullComments';
      this.refresh();
    },

    openPullVideoListWizard(opts = {}) {
      this.wizardOpen = false; this.massWizardOpen = false; this.deleteWizardOpen = false; this.commentReplyWizardOpen = false;
      this.pullCommentWizardOpen = false; this.pullCommentWizard = null;
      this.pullVideoListWizard = {
        browserBackend: this.normalizeTaskBackend?.(opts.browserBackend) || this.defaultTaskBrowserBackend?.() || 'tkswarm',
        accountIds: [],
        submitting: false,
      };
      this.pullVideoListWizardOpen = true;
      this.matrixTab = 'pullVideoList';
      if (!opts.skipRefresh) this.refresh();
    },

    closePullVideoListWizard() {
      this.pullVideoListWizardOpen = false; this.pullVideoListWizard = null;
      this.matrixTab = 'pullVideoList';
      this.refresh();
    },

    pullCommentStatusLabel(st) {
      return ({ pending: '待执行', queued: '排队中', running: '执行中', completed: '已完成', success: '成功', failed: '失败', cancelled: '已取消', paused: '已暂停' })[st] || st || '-';
    },

    async renderPullComments(opts = {}) {
      const gen = opts.gen || this._matrixSwitchGen;
      const still = () => gen === this._matrixSwitchGen && this.view === 'publish' && this.matrixTab === 'pullComments';
      if (this.pullCommentWizardOpen) {
        const content = document.querySelector('#content');
        if (content) content.innerHTML = this.matrixTabs('pullComments') + this.pullCommentWizardPanel();
        await this.reloadPullCommentMaterials();
        return;
      }
      const page = this.pullCommentPage || 1;
      const kw = String(this.pullCommentKeyword || '').trim();
      const st = String(this.pullCommentStatus || '').trim();
      let pack = { items: [], total: 0, page: 1, pages: 1 };
      let canPullData = this.canPublishTasksView?.() !== false;
      try {
        pack = await this.api(`/pull-comment-tasks?page=${page}&pageSize=15${kw ? `&keyword=${encodeURIComponent(kw)}` : ''}${st ? `&status=${encodeURIComponent(st)}` : ''}`);
      } catch (_) {
        canPullData = false;
        pack = { items: [], total: 0, page: 1, pages: 1 };
      }
      if (!still()) return;
      const rows = pack.items || [];
      this.pullCommentPage = pack.page || page;
      const cards = rows.map((x) => {
        const total = Math.max(0, Number(x.videoCount || 0));
        const done = Math.max(0, Number(x.doneCount || 0));
        const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
        const nick = x.accountNickname ? ` · ${this.esc(x.accountNickname)}` : '';
        return `<article class="pc-card">
          <header class="pc-card-head">
            <div class="pc-card-title"><span class="pc-card-id">#${x.id}</span><b>${this.esc(x.name || '-')}</b></div>
            ${this.badge(x.status)}
          </header>
          <div class="pc-card-account">@${this.esc(x.accountUsername || x.accountId || '-')}${nick}</div>
          <div class="pc-card-metrics">
            <div><small>视频</small><b>${done}/${total}</b></div>
            <div><small>评论条数</small><b>${Number(x.commentCount || 0)}</b></div>
            <div><small>进度</small><b>${pct}%</b></div>
          </div>
          <div class="pc-progress" aria-hidden="true"><i style="width:${pct}%"></i></div>
          <footer class="pc-card-foot">
            <span class="muted">${this.esc(x.createdAt || '-')}</span>
            <div class="pc-card-ops">
              ${['pending', 'queued', 'running'].includes(x.status) ? `<button class="tiny" type="button" onclick="app.cancelPullCommentTask(${x.id})">取消</button>` : ''}
              <button class="tiny danger" type="button" onclick="app.deletePullCommentTask(${x.id})">删除</button>
            </div>
          </footer>
          ${x.errorMessage ? `<div class="pc-card-error">${this.esc(x.errorMessage)}</div>` : ''}
        </article>`;
      }).join('');
      const html = `<div class="panel pull-comments-panel">
        <div class="pc-hero">
          <div>
            <div class="pc-kicker">视频详情</div>
            <h2>拉取视频详情</h2>
            <p>选择已发布/线上视频后，按账号拆分任务抓取播放、点赞、发布时间与评论。</p>
          </div>
          <div class="pc-hero-actions">
            <button class="primary" type="button" onclick="app.openPullCommentWizard()">创建拉取视频详情</button>
            <button class="ghost" type="button" onclick="app.refresh()">刷新</button>
          </div>
        </div>
        ${canPullData ? `<div class="pc-toolbar">
          <select id="pc-status-filter" class="input" onchange="app.pullCommentStatus=this.value;app.pullCommentPage=1;app.refresh()">
            ${[['','全部状态'],['queued','排队中'],['running','执行中'],['completed','已完成'],['failed','失败'],['cancelled','已取消']].map(([v,n]) => `<option value="${v}" ${st === v ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
          <input id="pc-keyword-filter" class="input" type="search" placeholder="搜索任务名、账号或 ID" value="${this.esc(kw)}" onkeydown="if(event.key==='Enter'){app.pullCommentKeyword=this.value;app.pullCommentPage=1;app.refresh()}">
          <button class="primary" type="button" onclick="app.pullCommentKeyword=document.querySelector('#pc-keyword-filter')?.value||'';app.pullCommentPage=1;app.refresh()">搜索</button>
          <span class="muted pc-count">共 ${Number(pack.total || rows.length)} 条</span>
        </div>
        ${rows.length ? `<div class="pc-card-grid">${cards}</div>` : '<div class="pc-empty"><b>还没有拉取视频详情任务</b><span>点击右上角「创建拉取视频详情」选择已发布/线上视频。</span></div>'}
        ${UI.pager(pack, 'pullCommentPage')}` : '<div class="muted" style="padding:8px 0 0">当前角色暂无查看权限，或接口暂不可用。</div>'}
      </div>`;
      this.mountMatrixPanel(html, 'pullComments', { soft: !!opts.soft });
    },

    async renderPullVideoList(opts = {}) {
      const gen = opts.gen || this._matrixSwitchGen;
      const still = () => gen === this._matrixSwitchGen && this.view === 'publish' && this.matrixTab === 'pullVideoList';
      if (this.pullVideoListWizardOpen) {
        const content = document.querySelector('#content');
        if (content) content.innerHTML = this.matrixTabs('pullVideoList') + this.pullVideoListWizardPanel();
        await this.fillPullVideoListWizardAccounts();
        return;
      }
      const page = this.pullVideoListPage || 1;
      const kw = String(this.pullVideoListKeyword || '').trim();
      const st = String(this.pullVideoListStatus || '').trim();
      const qs = new URLSearchParams({ page: String(page), pageSize: '15', taskType: 'pull_video_list' });
      if (kw) qs.set('keyword', kw);
      if (st) qs.set('status', st);
      let pack = { items: [], total: 0, page: 1, pages: 1 };
      try { pack = await this.api(`/account-work-items?${qs}`); } catch (_) { pack = { items: [], total: 0, page: 1, pages: 1 }; }
      if (!still()) return;
      const rows = pack.items || pack.list || [];
      this.pullVideoListPage = pack.page || page;
      const statusLabel = (s) => this.pullCommentStatusLabel(s);
      const sourceLabel = (raw) => {
        const s = String(raw || '').trim();
        if (!s || s === 'manual') return '手动';
        if (s === 'pull_video_list_wizard' || s === 'wizard') return '向导创建';
        if (s === 'api' || s === 'enqueue') return '接口入队';
        return s.length > 18 ? `${s.slice(0, 16)}…` : s;
      };
      const cards = rows.map((x) => {
        const id = Number(x.id || 0);
        const batchId = Number(x.batchId || x.batch_id || 0);
        const accountId = Number(x.accountId || x.account_id || 0);
        const user = String(x.accountUsername || x.username || accountId || '-').replace(/^@+/, '');
        const nick = x.accountNickname ? ` · ${this.esc(x.accountNickname)}` : '';
        const err = String(x.errorMessage || x.error_message || '').trim();
        let payload = x.payload || {};
        if (typeof payload === 'string') {
          try { payload = JSON.parse(payload) || {}; } catch { payload = {}; }
        }
        const st = String(x.status || '');
        return `<article class="pc-card">
          <header class="pc-card-head">
            <div class="pc-card-title"><span class="pc-card-id">分任务 #${id}</span><b>@${this.esc(user)}</b></div>
            ${this.badge(st)}
          </header>
          <div class="pc-card-account">账号 #${accountId}${nick}</div>
          <div class="pc-card-metrics">
            <div><small>总任务</small><b title="#${batchId || '-'}">#${batchId || '-'}</b></div>
            <div><small>状态</small><b title="${this.esc(statusLabel(st))}">${this.esc(statusLabel(st))}</b></div>
            <div><small>来源</small><b title="${this.esc(String(payload.source || 'manual'))}">${this.esc(sourceLabel(payload.source))}</b></div>
          </div>
          <footer class="pc-card-foot">
            <span class="muted">${this.esc(x.updatedAt || x.updated_at || x.createdAt || x.created_at || '-')}</span>
            <div class="pc-card-ops">${batchId ? `<button class="tiny" type="button" onclick="app.navigate('accountWork','list')">查看总任务</button>` : ''}</div>
          </footer>
          ${err ? `<div class="pc-card-error">${this.esc(err)}</div>` : ''}
        </article>`;
      }).join('');
      const html = `<div class="panel pull-comments-panel pull-video-list-panel">
        <div class="pc-hero">
          <div>
            <div class="pc-kicker">线上视频</div>
            <h2>拉取视频列表</h2>
            <p>从 TikTok Studio 抓取已发布视频封面、标题与链接，入库为线上视频（素材库不显示）。</p>
          </div>
          <div class="pc-hero-actions">
            <button class="primary" type="button" onclick="app.openPullVideoListWizard()">创建拉取视频列表</button>
            <button class="ghost" type="button" onclick="app.refresh()">刷新</button>
          </div>
        </div>
        <div class="pc-toolbar">
          <select id="pvl-status-filter" class="input" onchange="app.pullVideoListStatus=this.value;app.pullVideoListPage=1;app.refresh()">
            ${[['','全部状态'],['pending','待执行'],['running','执行中'],['success','成功'],['failed','失败'],['paused','已暂停'],['cancelled','已取消']].map(([v,n]) => `<option value="${v}" ${st === v ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
          <input id="pvl-keyword-filter" class="input" type="search" placeholder="搜索账号或任务 ID" value="${this.esc(kw)}" onkeydown="if(event.key==='Enter'){app.pullVideoListKeyword=this.value;app.pullVideoListPage=1;app.refresh()}">
          <button class="primary" type="button" onclick="app.pullVideoListKeyword=document.querySelector('#pvl-keyword-filter')?.value||'';app.pullVideoListPage=1;app.refresh()">搜索</button>
          <span class="muted pc-count">共 ${Number(pack.total || rows.length)} 条</span>
        </div>
        ${rows.length ? `<div class="pc-card-grid">${cards}</div>` : '<div class="pc-empty"><b>还没有拉取视频列表任务</b><span>选择账号后创建任务。</span></div>'}
        ${UI.pager(pack, 'pullVideoListPage')}
      </div>`;
      this.mountMatrixPanel(html, 'pullVideoList', { soft: !!opts.soft });
      if (rows.some((x) => ['pending', 'queued', 'running'].includes(String(x.status || '')))) {
        clearInterval(this._pullVideoListRefreshTimer);
        this._pullVideoListRefreshTimer = setInterval(() => {
          if (this.view === 'publish' && this.matrixTab === 'pullVideoList' && !this.pullVideoListWizardOpen) this.renderPullVideoList({ soft: true });
          else clearInterval(this._pullVideoListRefreshTimer);
        }, 4000);
      }
    },

    pullCommentWizardPanel() {
      const w = this.pullCommentWizard || {};
      const selected = new Set((w.materialIds || []).map(Number));
      const rows = w.materials || [];
      const list = rows.map((m) => {
        const id = Number(m.id);
        const on = selected.has(id);
        const cover = m.coverUrl || m.cover_url || '';
        const title = m.shareTitle || m.share_title || m.name || ('#' + id);
        const acc = m.publishAccount || m.publish_account || m.publishAccountName || '-';
        const origin = m.origin === 'online' ? '线上' : '本地已发布';
        const thumb = (m.hasCover || m.has_cover || cover)
          ? `<img src="${this.esc(cover || (this.materialCoverUrl ? this.materialCoverUrl(id) : `/api/materials/${id}/cover`))}" alt="" loading="lazy" decoding="async">`
          : '<div class="empty" style="padding:18px;font-size:12px">无封面</div>';
        return `<label class="pc-mat-card ${on ? 'is-on' : ''}">
          <input type="checkbox" ${on ? 'checked' : ''} onchange="app.togglePullCommentMaterial(${id}, this.checked)">
          <div class="pc-mat-thumb">${thumb}</div>
          <div class="pc-mat-body">
            <b title="${this.esc(title)}">${this.esc(title)}</b>
            <span class="muted">#${id} · ${this.esc(origin)} · ${this.esc(String(acc))}</span>
          </div>
        </label>`;
      }).join('');
      return `<div class="wizard pull-comment-wizard">
        <div class="pc-hero pc-hero-form">
          <div>
            <div class="pc-kicker">新建任务</div>
            <h2>${w.mediaType === 'image' ? '创建拉取图片详情' : '创建拉取视频详情'}</h2>
            <p>${w.mediaType === 'image' ? '勾选已发布/线上图片后提交，系统会按发布账号拆成多条分任务。请先「拉取图片列表」。' : '勾选已发布/线上视频后提交，系统会按发布账号拆成多条分任务。'}</p>
          </div>
          <button class="ghost" type="button" onclick="app.closePullCommentWizard()">返回列表</button>
        </div>
        <div class="pc-form-layout">
          <aside class="pc-form-side">
            <div class="pc-side-block">
              <div class="pc-side-label">筛选</div>
              <select id="pc-origin-filter" class="input" onchange="app.pullCommentWizard.origin=this.value;app.pullCommentWizard.page=1;app.reloadPullCommentMaterials()">
                <option value="" ${!w.origin ? 'selected' : ''}>全部来源</option>
                <option value="online" ${w.origin === 'online' ? 'selected' : ''}>线上视频</option>
                <option value="local" ${w.origin === 'local' ? 'selected' : ''}>本地已发布</option>
              </select>
              <input id="pc-mat-keyword" class="input" type="search" placeholder="搜索标题/账号/ID" value="${this.esc(w.keyword || '')}"
                onkeydown="if(event.key==='Enter'){app.pullCommentWizard.keyword=this.value;app.pullCommentWizard.page=1;app.reloadPullCommentMaterials()}">
              <button class="primary" type="button" style="width:100%;margin-top:8px"
                onclick="app.pullCommentWizard.keyword=document.querySelector('#pc-mat-keyword')?.value||'';app.pullCommentWizard.page=1;app.reloadPullCommentMaterials()">搜索</button>
            </div>
            <div class="pc-side-block">
              <div class="pc-side-label">已选</div>
              <b id="pc-mat-selected-count">${selected.size}</b> 个视频
              <button class="primary" type="button" style="width:100%;margin-top:10px" ${w.submitting ? 'disabled' : ''} onclick="app.submitPullCommentWizard()">创建并入队</button>
            </div>
          </aside>
          <section class="pc-form-main">
            <div class="muted pc-mat-summary">${w.loading ? '加载中…' : `本页 ${rows.length} · 共 ${Number(w.total || 0)}`}</div>
            <div class="pc-mat-grid">${list || '<div class="pc-empty"><b>暂无已发布视频</b><span>请先「拉取视频列表」或发布素材。</span></div>'}</div>
            <div class="pc-mat-pager">
              <button class="ghost" type="button" ${Number(w.page||1)<=1?'disabled':''} onclick="app.pullCommentWizard.page=Math.max(1,(app.pullCommentWizard.page||1)-1);app.reloadPullCommentMaterials()">上一页</button>
              <span class="muted">${Number(w.page||1)} / ${Number(w.pages||1)}</span>
              <button class="ghost" type="button" ${(Number(w.page||1)>=Number(w.pages||1))?'disabled':''} onclick="app.pullCommentWizard.page=(app.pullCommentWizard.page||1)+1;app.reloadPullCommentMaterials()">下一页</button>
            </div>
          </section>
        </div>
      </div>`;
    },

    async reloadPullCommentMaterials() {
      const w = this.pullCommentWizard;
      if (!w) return;
      w.loading = true;
      const box = document.querySelector('.pc-form-main');
      if (box) box.style.opacity = '0.6';
      try {
        const page = Math.max(1, Number(w.page || 1));
        const qs = new URLSearchParams({ page: String(page), pageSize: '24' });
        if (w.keyword) qs.set('keyword', String(w.keyword).trim());
        if (w.origin === 'online' || w.origin === 'local') qs.set('origin', w.origin);
        if (w.mediaType === 'image') qs.set('mediaType', 'image');
        const pack = await this.api(`/pull-comment-tasks/published-materials?${qs}`);
        if (!this.pullCommentWizard) return;
        const items = pack?.items || (Array.isArray(pack) ? pack : []);
        this.pullCommentWizard.materials = items;
        this.pullCommentWizard.total = Number(pack?.total || items.length);
        this.pullCommentWizard.page = Number(pack?.page || page);
        this.pullCommentWizard.pages = Number(pack?.pages || 1);
        this.pullCommentWizard.loading = false;
        const content = document.querySelector('#content');
        if (content && this.pullCommentWizardOpen) {
          content.innerHTML = this.matrixTabs('pullComments') + this.pullCommentWizardPanel();
        }
      } catch (e) {
        if (this.pullCommentWizard) this.pullCommentWizard.loading = false;
        this.toast(e.message || '加载已发布视频失败', true);
        const content = document.querySelector('#content');
        if (content && this.pullCommentWizardOpen) {
          content.innerHTML = this.matrixTabs('pullComments') + this.pullCommentWizardPanel();
        }
      }
    },

    togglePullCommentMaterial(id, checked) {
      const w = this.pullCommentWizard;
      if (!w) return;
      id = Number(id);
      const set = new Set((w.materialIds || []).map(Number));
      if (checked) set.add(id); else set.delete(id);
      w.materialIds = [...set];
      const el = document.querySelector('#pc-mat-selected-count');
      if (el) el.textContent = String(set.size);
      document.querySelectorAll(`.pc-mat-card input[onchange*="(${id}"]`).forEach((inp) => {
        const card = inp.closest('.pc-mat-card');
        if (card) card.classList.toggle('is-on', !!checked);
      });
      // fallback: refresh class by scanning
      document.querySelectorAll('.pc-mat-card').forEach((card) => {
        const inp = card.querySelector('input[type=checkbox]');
        if (!inp) return;
        const mid = Number(String(inp.getAttribute('onchange') || '').match(/(\d+)/)?.[1] || 0);
        if (mid === id) card.classList.toggle('is-on', !!checked);
      });
    },

    async submitPullCommentWizard() {
      const w = this.pullCommentWizard;
      if (!w || w.submitting) return;
      const ids = (w.materialIds || []).map(Number).filter(Boolean);
      if (!ids.length) { this.toast('请至少选择一个视频', true); return; }
      w.submitting = true;
      try {
        const r = await this.api('/pull-comment-tasks', {
          method: 'POST',
          body: JSON.stringify({
            materialIds: ids,
            browserBackend: w.browserBackend || this.defaultTaskBrowserBackend?.() || 'tkswarm',
            name: w.name || '',
          }),
        });
        this.toast(r?.message || `已创建 ${r?.created || ids.length} 个分任务`);
        this.closePullCommentWizard();
      } catch (e) {
        this.toast(e.message || '创建失败', true);
        if (this.pullCommentWizard) this.pullCommentWizard.submitting = false;
      }
    },

    async cancelPullCommentTask(id) {
      if (!(await this.ask('确认取消该拉取视频详情任务？'))) return;
      try {
        await this.api(`/pull-comment-tasks/${id}/cancel`, { method: 'POST', body: '{}' });
        this.toast('已取消');
        this.refresh();
      } catch (e) { this.toast(e.message || '取消失败', true); }
    },

    async deletePullCommentTask(id) {
      if (!(await this.ask('确认删除该任务记录？'))) return;
      try {
        await this.api(`/pull-comment-tasks/${id}`, { method: 'DELETE' });
        this.toast('已删除');
        this.refresh();
      } catch (e) { this.toast(e.message || '删除失败', true); }
    },

    pullVideoListWizardPanel() {
      const w = this.pullVideoListWizard || {};
      return `<div class="wizard pull-video-list-wizard">
        <div class="pc-hero pc-hero-form">
          <div>
            <div class="pc-kicker">线上视频</div>
            <h2>${w.mediaType === 'image' ? '拉取图片列表' : '拉取视频列表'}</h2>
            <p>${w.mediaType === 'image' ? '选择账号后打开 TikTok Studio 内容页，抓取已发布图文作品（/photo/）并入库为线上图片。' : '选择账号后打开 TikTok Studio 内容页，抓取已发布视频并入库为线上视频。'}</p>
          </div>
          <button class="ghost" type="button" onclick="app.closePullVideoListWizard()">返回列表</button>
        </div>
        <div class="form-grid" style="padding:16px">
          <div class="field full"><label>选择账号</label>
            <div id="pvl-accounts" class="account-pick-grid" style="max-height:360px;overflow:auto;border:1px solid #e5e7eb;border-radius:8px;padding:8px"></div>
          </div>
          <div class="field full muted">已选 <b id="pvl-account-count">0</b> 个账号</div>
          <div class="field full">
            <button class="primary" type="button" ${w.submitting ? 'disabled' : ''} onclick="app.submitPullVideoListWizard()">创建并入队</button>
          </div>
        </div>
      </div>`;
    },

    async fillPullVideoListWizardAccounts() {
      const box = document.querySelector('#pvl-accounts');
      if (!box) return;
      try {
        const pack = await this.api('/accounts?pageSize=200');
        const accounts = pack?.items || (Array.isArray(pack) ? pack : []);
        const selected = new Set((this.pullVideoListWizard?.accountIds || []).map(Number));
        box.innerHTML = accounts.length
          ? accounts.map((a) => this.accountPickTagHtml(a, selected, { onclick: "app.togglePullVideoListAccount(this)" })).join('')
          : '<div class="muted">暂无账号</div>';
        this.filterAccountPick?.('pvl-accounts');
        this.syncPullVideoListAccountCount();
      } catch (e) {
        box.innerHTML = `<div class="muted">${this.esc(e.message || '加载账号失败')}</div>`;
      }
    },

    togglePullVideoListAccount(el) {
      this.toggleAccountPickTag?.(el);
      this.syncPullVideoListAccountCount();
    },

    syncPullVideoListAccountCount() {
      const ids = this.selectedAccountPickIds?.('pvl-accounts') || [...document.querySelectorAll('#pvl-accounts .account-pick-tag.is-on')]
        .map((el) => Number(el.getAttribute('data-id')))
        .filter(Boolean);
      if (this.pullVideoListWizard) this.pullVideoListWizard.accountIds = ids;
      const el = document.querySelector('#pvl-account-count');
      if (el) el.textContent = String(ids.length);
    },

    async submitPullVideoListWizard() {
      const w = this.pullVideoListWizard;
      if (!w || w.submitting) return;
      this.syncPullVideoListAccountCount();
      const accountIds = (w.accountIds || []).map(Number).filter(Boolean);
      if (!accountIds.length) { this.toast('请至少选择 1 个账号', true); return; }
      if (!(await this.ask(`确认为 ${accountIds.length} 个账号创建「拉取视频列表」任务？`))) return;
      const be = w.browserBackend || this.defaultTaskBrowserBackend?.() || 'tkswarm';
      if (this.ensureBrowserBackendOnline && !(await this.ensureBrowserBackendOnline(be, '拉取视频列表'))) return;
      w.submitting = true;
      let ok = 0, fail = 0;
      try {
        for (const accountId of accountIds) {
          try {
            await this.api('/pull-video-list/enqueue', {
              method: 'POST',
              body: JSON.stringify({ accountId, payload: { source: w.source || 'pull_video_list_wizard', browserBackend: be, mediaType: w.mediaType || '' } }),
            });
            ok += 1;
          } catch (e) {
            fail += 1;
            this.toast(`账号 #${accountId} 入队失败：${e.message}`, true);
          }
        }
        if (ok) this.toast(`已为 ${ok} 个账号创建拉取视频列表任务${fail ? `，失败 ${fail}` : ''}`);
        this.pullVideoListWizardOpen = false; this.pullVideoListWizard = null;
        this.matrixTab = 'pullVideoList';
        this.refresh();
      } finally {
        if (this.pullVideoListWizard) this.pullVideoListWizard.submitting = false;
      }
    },
  };

  function attach() {
    if (!window.app) { setTimeout(attach, 30); return; }
    Object.assign(window.app, methods);
    window.AppPages = window.AppPages || {};
    window.AppPages.pullVideo = true;
  }
  attach();
})();