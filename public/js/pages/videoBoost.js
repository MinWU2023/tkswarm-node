(function () {
  if (!window.app) throw new Error('app-core must load before pages/videoBoost.js');

  const STATUS_META = {
    pending: { label: '待执行', tone: 'muted' },
    running: { label: '进行中', tone: 'online' },
    completed: { label: '已完成', tone: 'success' },
    cancelled: { label: '已取消', tone: 'warn' },
    failed: { label: '失败', tone: 'error' },
  };

  const __methods = {
    canVideoBoost() {
      return this.canPermission('publish.video_boost.view')
        || this.canPermission('publish.video_boost')
        || this.canPermission('publish.video_boost.update');
    },
    canEditVideoBoost() {
      return this.canPermission('publish.video_boost.update')
        || this.canPermission('publish.video_boost')
        || this.canPermission('rbac.manage');
    },
    videoBoostStatusBadge(status) {
      const st = String(status || 'pending');
      const m = STATUS_META[st] || { label: st, tone: 'muted' };
      return `<span class="badge ${m.tone}">${this.esc(m.label)}</span>`;
    },

    async renderVideoBoost() {
      if (!this.canView('videoBoost') && !this.canVideoBoost()) {
        return this.renderPageDenied('当前角色无权查看视频增值');
      }
      document.querySelector('#content')?.classList.remove('chat-mode');
      const pane = this.videoBoostPane || 'list';
      if (pane === 'create' || pane === 'edit') return this.renderVideoBoostForm();
      return this.renderVideoBoostList();
    },

    openVideoBoostCreate() {
      if (!this.canEditVideoBoost()) {
        this.toast('当前角色无权创建视频增值任务', true);
        return;
      }
      this.videoBoostPane = 'create';
      this.videoBoostEditId = null;
      this.navigate('videoBoost', 'create');
    },

    openVideoBoostEdit(id) {
      if (!this.canEditVideoBoost()) {
        this.toast('当前角色无权编辑视频增值任务', true);
        return;
      }
      this.videoBoostPane = 'edit';
      this.videoBoostEditId = Number(id) || null;
      this.navigate('videoBoost', 'edit/' + (Number(id) || 0));
    },

    closeVideoBoostForm() {
      this.videoBoostPane = 'list';
      this.videoBoostEditId = null;
      this.navigate('videoBoost', 'list');
    },

    async renderVideoBoostList() {
      const host = document.querySelector('#content');
      if (!host) return;
      const page = this.videoBoostPage || 1;
      const qs = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (this.videoBoostKeyword) qs.set('keyword', this.videoBoostKeyword);
      if (this.videoBoostStatus) qs.set('status', this.videoBoostStatus);
      let pack = { items: [], total: 0, page: 1, pages: 1, pageSize: 20 };
      try {
        pack = await this.api('/video-boost-tasks?' + qs.toString());
      } catch (e) {
        host.innerHTML = `<div class="panel"><div class="empty">加载失败：${this.esc(e.message || '')}</div></div>`;
        return;
      }
      const rows = pack.items || [];
      const canEdit = this.canEditVideoBoost();
      const statusOpts = [['', '全部状态'], ['pending', '待执行'], ['running', '进行中'], ['completed', '已完成'], ['failed', '失败'], ['cancelled', '已取消']];
      host.innerHTML = `
        <div class="panel af-panel">
          <div class="panel-head">
            <div>
              <b>视频增值</b>
              <span class="muted">选视频 → 按间隔随机排期 → 计划任务推送给创建者名下账号：搜索发布者昵称 → 主页下滑找视频 → 看完 → 点赞 / 评论 / 转发</span>
            </div>
            ${canEdit ? `<button class="primary" type="button" onclick="app.openVideoBoostCreate()">新建视频增值</button>` : ''}
          </div>
          <div class="toolbar">
            <input class="input" placeholder="搜索任务名 / 视频标题 / 发布者" value="${this.esc(this.videoBoostKeyword || '')}" onkeydown="if(event.key==='Enter'){app.videoBoostKeyword=this.value;app.videoBoostPage=1;app.renderVideoBoostList()}">
            <select class="input" onchange="app.videoBoostStatus=this.value;app.videoBoostPage=1;app.renderVideoBoostList()">
              ${statusOpts.map(([v, l]) => `<option value="${v}" ${String(this.videoBoostStatus || '') === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>ID</th><th>任务名</th><th>视频</th><th>发布者</th><th>账号模式</th><th>间隔(分钟)</th><th>进度</th><th>派发</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                ${rows.length ? rows.map((r) => `
                  <tr>
                    <td>#${r.id}</td>
                    <td>${this.esc(r.name)}</td>
                    <td title="${this.esc(r.videoTitle)}">${this.esc((r.videoTitle || '').slice(0, 28))}</td>
                    <td>${this.esc(r.publisherNickname || r.publisherUsername || '-')}</td>
                    <td>${r.accountMode === 'custom' ? `自定义 ${(r.accountIds || []).length}` : `随机 ${r.accountCount}`}</td>
                    <td>${r.minIntervalMinutes} ~ ${r.maxIntervalMinutes}</td>
                    <td>成功 ${r.successCount} / 失败 ${r.failedCount} / 共 ${r.scheduledCount}</td>
                    <td>${r.dispatchEnabled ? '<span class="badge success">开启</span>' : '<span class="badge muted">关闭</span>'}</td>
                    <td>${this.videoBoostStatusBadge(r.status)}</td>
                    <td class="row-actions">
                      ${canEdit && r.canEdit && ['pending', 'running'].includes(r.status) ? `<button class="ghost" onclick="app.openVideoBoostEdit(${r.id})">编辑</button>` : ''}
                      ${canEdit ? `<button class="ghost" onclick="app.toggleVideoBoostDispatch(${r.id}, ${r.dispatchEnabled ? 'false' : 'true'})">${r.dispatchEnabled ? '暂停派发' : '开启派发'}</button>` : ''}
                      ${canEdit && ['pending', 'running'].includes(r.status) ? `<button class="ghost danger" onclick="app.cancelVideoBoostTask(${r.id})">取消</button>` : ''}
                      ${canEdit ? `<button class="ghost danger" onclick="app.deleteVideoBoostTask(${r.id})">删除</button>` : ''}
                    </td>
                  </tr>`).join('') : `<tr><td colspan="10" class="empty">暂无视频增值任务</td></tr>`}
              </tbody>
            </table>
          </div>
          ${UI.pager({ ...pack, items: rows, page: pack.page || page, pages: pack.pages || 1, total: pack.total || 0, pageSize: pack.pageSize || 20 }, 'videoBoostPage')}
        </div>`;
    },

    async toggleVideoBoostDispatch(id, enabled) {
      try {
        await this.api(`/video-boost-tasks/${id}/dispatch`, { method: 'PATCH', body: JSON.stringify({ dispatchEnabled: !!enabled }) });
        this.toast(enabled ? '已开启派发' : '已暂停派发');
        this.renderVideoBoostList();
      } catch (e) {
        this.toast(e.message || '操作失败', true);
      }
    },

    async cancelVideoBoostTask(id) {
      if (!window.confirm('确定取消该视频增值任务？尚未执行的明细将被取消。')) return;
      try {
        await this.api(`/video-boost-tasks/${id}/cancel`, { method: 'POST' });
        this.toast('已取消');
        this.renderVideoBoostList();
      } catch (e) {
        this.toast(e.message || '取消失败', true);
      }
    },

    async deleteVideoBoostTask(id) {
      if (!window.confirm('确定删除该视频增值任务？')) return;
      try {
        await this.api(`/video-boost-tasks/${id}`, { method: 'DELETE' });
        this.toast('已删除');
        this.renderVideoBoostList();
      } catch (e) {
        this.toast(e.message || '删除失败', true);
      }
    },

    videoBoostCoverSrc(id, coverUrl) {
      if (typeof this.materialCoverUrl === 'function') {
        return this.materialCoverUrl(id, coverUrl);
      }
      let path = String(coverUrl || '').trim();
      if (!path || path.startsWith('data:')) path = `/api/materials/${Number(id) || 0}/cover`;
      try {
        const u = new URL(path, window.location.origin);
        if (this.authToken) u.searchParams.set('token', this.authToken);
        const acting = this.getActingAsId?.();
        if (acting) u.searchParams.set('actingAs', String(acting));
        return u.toString();
      } catch (_) {
        return path;
      }
    },
    videoBoostVideoListHtml(items, selectedId) {
      if (!items.length) {
        return `<div class="vb-video-empty"><b>暂无可用视频</b><span>需已发布成功，且有发布账号与视频链接/ID</span></div>`;
      }
      return items.map((x) => {
        const id = Number(x.id || 0);
        const on = Number(selectedId) === id;
        const hasCover = !!(x.coverUrl || x.cover_url || x.hasCover || x.has_cover);
        const coverSrc = hasCover ? this.videoBoostCoverSrc(id, x.coverUrl || x.cover_url || '') : '';
        const thumbStyle = coverSrc
          ? ` style="background-image:url(&quot;${this.esc(coverSrc)}&quot;)"`
          : '';
        const thumbInner = coverSrc ? '' : '<span class="vb-video-ph">无封面</span>';
        const nick = String(x.publisherNickname || '').trim();
        const user = String(x.publisherUsername || '-').trim() || '-';
        const pub = nick ? `@${user} · ${nick}` : `@${user}`;
        return `<label class="vb-video-card${on ? ' is-on' : ''}">
          <input type="radio" name="vbMaterial" value="${id}" data-publisher="${Number(x.publishAccountId) || 0}" ${on ? 'checked' : ''}
            onchange="app.onVbVideoPick(this);document.querySelectorAll('#vb-video-list .vb-video-card').forEach(c=>c.classList.toggle('is-on',!!c.querySelector('input')?.checked))">
          <div class="vb-video-thumb${coverSrc ? ' has-cover' : ''}"${thumbStyle}>
            <span class="vb-video-id">#${id}</span>
            <span class="vb-video-check" aria-hidden="true"></span>
            ${thumbInner}
          </div>
          <div class="vb-video-meta">
            <b title="${this.esc(x.title || '')}">${this.esc(x.title || ('#' + id))}</b>
            <small class="muted" title="${this.esc(pub)}">${this.esc(pub)}</small>
          </div>
        </label>`;
      }).join('');
    },

    async reloadVideoBoostVideos(keyword) {
      const box = document.querySelector('#vb-video-list');
      if (!box) return;
      const selected = Number(document.querySelector('input[name=vbMaterial]:checked')?.value || 0);
      const qs = new URLSearchParams({ pageSize: '50' });
      if (keyword) qs.set('keyword', keyword);
      try {
        const pack = await this.api('/video-boost-tasks/videos?' + qs.toString());
        box.innerHTML = this.videoBoostVideoListHtml(pack.items || [], selected);
      } catch (e) {
        box.innerHTML = `<div class="empty">加载视频失败：${this.esc(e.message || '')}</div>`;
      }
    },

    onVbVideoPick(el) {
      this._vbPublisherAccountId = Number(el?.dataset?.publisher || 0) || 0;
      this.updateVbEligibleHint();
      if (document.querySelector('input[name=vbAccountMode]:checked')?.value === 'custom') {
        this.reloadVbAccountPick([]);
      }
    },

    async updateVbEligibleHint() {
      const hint = document.querySelector('#vb-eligible-hint');
      const materialId = Number(document.querySelector('input[name=vbMaterial]:checked')?.value || 0);
      if (!hint) return;
      if (!materialId) {
        hint.textContent = '请先选择视频';
        return;
      }
      try {
        const r = await this.api('/video-boost-tasks/eligible-count?materialId=' + materialId);
        hint.textContent = `可用执行账号：${r.count}（已排除视频发布账号）`;
        const cnt = document.querySelector('#vb-account-count');
        if (cnt) cnt.max = String(Math.max(1, r.count));
      } catch (e) {
        hint.textContent = '可用账号数获取失败';
      }
    },

    async reloadVbAccountPick(selectedIds) {
      const box = document.querySelector('#vb-accounts');
      if (!box) return;
      const publisherId = Number(this._vbPublisherAccountId || 0);
      await this.initAccountPickToolbar('vb-accounts');
      await this.reloadAccountPick('vb-accounts', {
        selectedIds: selectedIds || [],
        preserveSelection: true,
        emptyText: '筛选条件下无可用执行账号',
        filterFn: (a) => Number(a.id) !== publisherId,
        onLoaded: () => this.updateVbPickHint(),
        tagOpts: { onclick: 'app.toggleAccountPickTag(this);app.updateVbPickHint()' },
      });
      this.updateVbPickHint();
    },

    updateVbPickHint() {
      const hint = document.querySelector('#vb-pick-hint');
      if (!hint) return;
      hint.textContent = `已选 ${this.selectedAccountPickIds('vb-accounts').length} 个账号`;
    },

    setVbAccountMode(mode) {
      const next = mode === 'custom' ? 'custom' : 'random';
      document.querySelectorAll('.vb-acc-cat').forEach((el) => {
        el.classList.toggle('is-on', el.querySelector('input')?.value === next);
      });
      const randomBox = document.querySelector('#vb-random-box');
      const customBox = document.querySelector('#vb-custom-box');
      if (randomBox) randomBox.hidden = next !== 'random';
      if (customBox) customBox.hidden = next !== 'custom';
      if (next === 'custom') this.reloadVbAccountPick(this._vbInitialAccountIds || []);
    },

    async renderVideoBoostForm() {
      const host = document.querySelector('#content');
      if (!host) return;
      if (!this.canEditVideoBoost()) {
        return this.renderPageDenied('当前角色无权编辑视频增值任务');
      }
      const isEdit = this.videoBoostPane === 'edit' && Number(this.videoBoostEditId) > 0;
      host.innerHTML = `<div class="panel"><div class="empty">加载中…</div></div>`;

      let task = null;
      let vids;
      let tpls;
      try {
        if (isEdit) task = await this.api(`/video-boost-tasks/${this.videoBoostEditId}`);
        [vids, tpls] = await Promise.all([
          this.api('/video-boost-tasks/videos?pageSize=50'),
          this.api('/video-boost-tasks/templates'),
        ]);
      } catch (e) {
        host.innerHTML = `<div class="panel"><div class="empty">加载失败：${this.esc(e.message || '')}</div></div>`;
        return;
      }

      const v = {
        name: task?.name || '',
        materialId: task?.materialId || 0,
        accountMode: task?.accountMode || 'random',
        accountIds: task?.accountIds || [],
        accountCount: task?.accountCount || 1,
        templateId: task?.templateId || 0,
        minInterval: task?.minIntervalMinutes ?? 5,
        maxInterval: task?.maxIntervalMinutes ?? 15,
        doLike: task ? task.doLike : true,
        doComment: task ? task.doComment : true,
        doShare: task ? task.doShare : true,
        saveTraffic: task ? task.saveTraffic : true,
        publisherAccountId: task?.publisherAccountId || 0,
      };
      this._vbPublisherAccountId = v.publisherAccountId;
      this._vbInitialAccountIds = v.accountIds;

      const tplItems = tpls.items || [];
      const tplOpts = tplItems.length
        ? tplItems.map((t) => `<option value="${t.id}" ${Number(v.templateId) === t.id ? 'selected' : ''}>${this.esc(t.name)}（${t.contentMode === 'ai' ? 'AI' : '固定'}）</option>`).join('')
        : '<option value="0">暂无「视频增量」模板，请先到消息模板中创建</option>';
      const mode = v.accountMode === 'custom' ? 'custom' : 'random';
      const check = (on) => (on ? 'checked' : '');

      host.innerHTML = `
        <div class="panel af-panel">
          <div class="panel-head">
            <div>
              <b>${isEdit ? '编辑视频增值' : '新建视频增值'}</b>
              <span class="muted">编辑会重新生成明细；已有账号进入执行后不可再编辑</span>
            </div>
            <button class="ghost" type="button" onclick="app.closeVideoBoostForm()">返回列表</button>
          </div>
          <form id="vb-form" onsubmit="event.preventDefault();app.submitVideoBoostForm()">
            <div class="af-card">
              <div class="af-card-head"><b>基础信息</b></div>
              <div class="af-card-body">
                <div class="field full">
                  <label>任务名称</label>
                  <input id="vb-name" class="input" type="text" maxlength="191" placeholder="留空自动生成" value="${this.esc(v.name)}">
                </div>
              </div>
            </div>

            <div class="af-card">
              <div class="af-card-head"><b>选择视频</b><span class="muted">仅显示已发布且有发布账号、视频链接/ID 的素材</span></div>
              <div class="af-card-body af-card-body-target">
                <div class="vb-video-toolbar">
                  <input class="input" type="search" placeholder="搜索视频标题 / 发布者" onkeydown="if(event.key==='Enter'){event.preventDefault();app.reloadVideoBoostVideos(this.value)}">
                </div>
                <div id="vb-video-list" class="vb-video-list">${this.videoBoostVideoListHtml(vids.items || [], v.materialId)}</div>
              </div>
            </div>

            <div class="af-card">
              <div class="af-card-head"><b>执行账号</b><span class="muted">随机或自定义（多选），自动排除视频发布账号</span></div>
              <div class="af-card-body af-card-body-target">
                <div class="af-source-cats">
                  <div class="af-source-cat vb-acc-cat ${mode === 'random' ? 'is-on' : ''}">
                    <label><input type="radio" name="vbAccountMode" value="random" ${mode === 'random' ? 'checked' : ''} onchange="app.setVbAccountMode('random')"> <b>随机账号</b> <small>系统随机抽取数量</small></label>
                  </div>
                  <div class="af-source-cat vb-acc-cat ${mode === 'custom' ? 'is-on' : ''}">
                    <label><input type="radio" name="vbAccountMode" value="custom" ${mode === 'custom' ? 'checked' : ''} onchange="app.setVbAccountMode('custom')"> <b>自定义账号</b> <small>筛选后多选</small></label>
                  </div>
                </div>
                <div id="vb-random-box" ${mode === 'random' ? '' : 'hidden'}>
                  <div class="field">
                    <label>随机账号数量</label>
                    <input id="vb-account-count" class="input" type="number" min="1" step="1" value="${Number(v.accountCount)}">
                  </div>
                  <div class="muted" id="vb-eligible-hint" style="margin-top:6px">${v.materialId ? '' : '请先选择视频'}</div>
                </div>
                <div id="vb-custom-box" ${mode === 'custom' ? '' : 'hidden'}>
                  ${this.accountPickToolbarHtml('vb-accounts', {
                    batchHtml: `<button type="button" class="tiny" onclick="app.setAccountPickAll('vb-accounts',true);app.updateVbPickHint()">全选</button><button type="button" class="tiny" onclick="app.setAccountPickAll('vb-accounts',false);app.updateVbPickHint()">清空</button><button type="button" class="tiny" onclick="app.invertAccountPick('vb-accounts');app.updateVbPickHint()">反选</button>`,
                  }).replace(`onclick="app.searchAccountPick('vb-accounts')"`, `onclick="app.reloadVbAccountPick(app.selectedAccountPickIds('vb-accounts'))"`)}
                  <div id="vb-accounts" class="account-pick-grid" data-list-host></div>
                  <div class="muted" id="vb-pick-hint" style="margin-top:8px">已选 0 个账号</div>
                </div>
              </div>
            </div>

            <div class="af-card">
              <div class="af-card-head"><b>评论模板</b><span class="muted">分类「视频增量」，AI 模板会结合视频标题与描述生成评论</span></div>
              <div class="af-card-body">
                <div class="field full">
                  <label>消息模板</label>
                  <select id="vb-template" class="input">${tplOpts}</select>
                </div>
              </div>
            </div>

            <div class="af-card">
              <div class="af-card-head"><b>执行间隔与动作</b><span class="muted">相邻账号执行时间 = 上一个 + 最小~最大之间的随机分钟</span></div>
              <div class="af-card-body">
                <div class="field">
                  <label>最小间隔(分钟)</label>
                  <input id="vb-min" class="input" type="number" min="0.1" step="0.1" value="${Number(v.minInterval)}">
                </div>
                <div class="field">
                  <label>最大间隔(分钟)</label>
                  <input id="vb-max" class="input" type="number" min="0.1" step="0.1" value="${Number(v.maxInterval)}">
                </div>
                <div class="field full">
                  <label>执行动作（完播后暂停）</label>
                  <div class="vb-actions">
                    <label><input id="vb-like" type="checkbox" ${check(v.doLike)}> 点赞</label>
                    <label><input id="vb-comment" type="checkbox" ${check(v.doComment)}> 评论</label>
                    <label><input id="vb-share" type="checkbox" ${check(v.doShare)}> 转发</label>
                    <label><input id="vb-save-traffic" type="checkbox" ${check(v.saveTraffic)}> 省流量</label>
                  </div>
                </div>
              </div>
            </div>

            <div class="modal-foot">
              <button class="ep-btn ep-btn-primary" type="submit">${isEdit ? '保存并重建明细' : '创建任务'}</button>
            </div>
          </form>
        </div>`;

      if (v.materialId) this.updateVbEligibleHint();
      if (mode === 'custom') await this.reloadVbAccountPick(v.accountIds);
    },

    async submitVideoBoostForm() {
      if (!this.canEditVideoBoost()) {
        this.toast('无权操作', true);
        return;
      }
      const materialId = Number(document.querySelector('input[name=vbMaterial]:checked')?.value || 0);
      const mode = document.querySelector('input[name=vbAccountMode]:checked')?.value === 'custom' ? 'custom' : 'random';
      const body = {
        name: document.querySelector('#vb-name')?.value.trim() || '',
        materialId,
        accountMode: mode,
        accountIds: mode === 'custom' ? this.selectedAccountPickIds('vb-accounts') : [],
        accountCount: Number(document.querySelector('#vb-account-count')?.value || 0),
        templateId: Number(document.querySelector('#vb-template')?.value || 0),
        minIntervalMinutes: Number(document.querySelector('#vb-min')?.value || 0),
        maxIntervalMinutes: Number(document.querySelector('#vb-max')?.value || 0),
        doLike: !!document.querySelector('#vb-like')?.checked,
        doComment: !!document.querySelector('#vb-comment')?.checked,
        doShare: !!document.querySelector('#vb-share')?.checked,
        saveTraffic: !!document.querySelector('#vb-save-traffic')?.checked,
      };
      if (!materialId) {
        this.toast('请选择视频', true);
        return;
      }
      if (!(body.minIntervalMinutes > 0) || !(body.maxIntervalMinutes >= body.minIntervalMinutes)) {
        this.toast('请正确填写最小/最大间隔（最小 > 0 且 ≤ 最大）', true);
        return;
      }
      const editId = Number(this.videoBoostEditId || 0) || 0;
      const isEdit = this.videoBoostPane === 'edit' && editId > 0;
      try {
        if (isEdit) {
          await this.api(`/video-boost-tasks/${editId}`, { method: 'PUT', body: JSON.stringify(body) });
          this.toast('已更新并重建明细');
        } else {
          await this.api('/video-boost-tasks', { method: 'POST', body: JSON.stringify(body) });
          this.toast('已创建视频增值任务');
        }
        this.closeVideoBoostForm();
      } catch (e) {
        this.toast(e.message || '保存失败', true);
      }
    },
  };

  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages.videoBoost = true;
})();
