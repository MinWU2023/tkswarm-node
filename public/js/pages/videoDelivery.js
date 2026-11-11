(function () {
  if (!window.app) throw new Error('app-core must load before pages/videoDelivery.js');

  const AUDIT_OPTS = [
    ['', '全部状态'],
    ['approved', '通过'],
    ['rejected', '停用'],
  ];

  const VERSION_OPTS = [
    ['standard', '标准版'],
    ['pro', '专业版'],
    ['enterprise', '企业版'],
  ];

  const ORDER_STATUS_OPTS = [
    ['', '全部状态'],
    ['pending', '待处理'],
    ['processing', '制作中'],
    ['completed', '已完成'],
    ['cancelled', '已取消'],
  ];

  const __methods = {
    canVideoDeliveryView() {
      return this.canView('videoDelivery')
        || this.canPermission('publish.video_delivery.view')
        || this.canPermission('publish.video_delivery')
        || this.canPermission('publish.materials.view')
        || this.canPermission('publish.materials')
        || this.canPermission('publish.tasks')
        || this.canPermission('matrix.publish');
    },
    canVideoDeliveryWrite() {
      return this.canPermission('publish.video_delivery.update')
        || this.canPermission('publish.video_delivery')
        || this.canPermission('publish.materials.update')
        || this.canPermission('publish.materials.create')
        || this.canPermission('publish.materials')
        || this.canPermission('publish.tasks')
        || this.canPermission('rbac.manage');
    },
    videoDeliveryClientIdFromSubview() {
      const sv = String(this.subview || '').replace(/^\/+/, '');
      const m = sv.match(/^(?:client\/)?(\d+)/);
      return m ? Number(m[1]) : 0;
    },
    videoDeliveryAuditBadge(status) {
      const st = String(status || 'approved');
      if (st === 'approved' || st === '通过' || st === 'pass' || st === '1') return '<span class="badge success vd-audit">通过</span>';
      if (st === 'pending' || st === '待审核' || st === 'review') return '<span class="badge warn vd-audit">待审核</span>';
      if (st === 'rejected' || st === '拒绝' || st === 'deny' || st === '0' || st === '停用') return '<span class="badge muted vd-audit">停用</span>';
      return `<span class="badge muted vd-audit">${this.esc(st)}</span>`;
    },
    videoDeliveryOrderStatusBadge(status, label) {
      const st = String(status || 'completed');
      const text = this.esc(label || st);
      if (st === 'completed') return `<span class="badge success">${text}</span>`;
      if (st === 'processing') return `<span class="badge online">${text}</span>`;
      if (st === 'pending') return `<span class="badge warn">${text}</span>`;
      if (st === 'cancelled') return `<span class="badge muted">${text}</span>`;
      return `<span class="badge muted">${text}</span>`;
    },
    videoDeliveryFmtTime(v) {
      const s = String(v || '').trim();
      if (!s) return '<span class="muted">-</span>';
      return `<span class="vd-time">${this.esc(s.slice(0, 19).replace('T', ' '))}</span>`;
    },
    videoDeliveryFmtDate(v) {
      const s = String(v || '').trim();
      return s ? s.slice(0, 10) : '';
    },
    videoDeliveryApiFileUrl(fileId, kind) {
      const base = typeof window.getTkswarmApiBase === 'function'
        ? window.getTkswarmApiBase()
        : (window.TKSWARM_API_BASE ?? window.__TKSWARM_CONFIG__?.defaultApiBase ?? '');
      const token = this.authToken || localStorage.getItem('tkswarm_token') || '';
      const path = `/video-delivery-files/${Number(fileId)}/${kind === 'download' ? 'download' : 'stream'}`;
      const qs = token ? `?token=${encodeURIComponent(token)}` : '';
      // 走 app.api 同源相对路径：前端用 a[href] 时拼完整 apiBase
      const root = String(base || '').replace(/\/$/, '');
      return root ? `${root}/api${path}${qs}` : `/api${path}${qs}`;
    },
    /** 预览专用：仅 GitHub/CDN（cdnUrl 优先），无则返回空 */
    videoDeliveryGithubPlayUrl(file) {
      if (!file || typeof file !== 'object') return '';
      return String(file.playUrl || file.cdnUrl || file.cdn_url
        || file.githubAssetUrl || file.github_asset_url || '').trim();
    },
    async renderVideoDelivery() {
      const host = document.querySelector('#content');
      if (!host) return;
      host.classList.remove('chat-mode');
      if (!this.canVideoDeliveryView()) {
        host.innerHTML = `<div class="panel"><div class="empty">当前角色无权查看视频交付</div></div>`;
        return;
      }
      const clientId = this.videoDeliveryClientIdFromSubview();
      if (clientId > 0) {
        this.videoDeliveryClientId = clientId;
        return this.renderVideoDeliveryDetail(clientId);
      }
      return this.renderVideoDeliveryList();
    },
    async renderVideoDeliveryList() {
      const host = document.querySelector('#content');
      if (!host) return;
      this.videoDeliveryDetailHead = null;
      const page = this.videoDeliveryPage || 1;
      const keyword = String(this.videoDeliveryKeyword || '').trim();
      const audit = String(this.videoDeliveryAudit || '');
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(this.videoDeliveryPageSize || 20),
      });
      if (keyword) qs.set('keyword', keyword);
      if (audit) qs.set('auditStatus', audit);

      let pack;
      try {
        pack = await this.api('/video-delivery-clients?' + qs.toString());
      } catch (e) {
        host.innerHTML = `<div class="panel"><div class="empty">加载失败：${this.esc(e.message || '')}</div></div>`;
        return;
      }
      const rows = pack.items || [];
      const total = pack.total || 0;
      const stats = pack.stats || {};
      const pagerHtml = UI.pager(
        { page: pack.page || 1, pages: pack.pages || 1, total, pageSize: pack.pageSize || 20 },
        'videoDeliveryPage',
        { pageSize: pack.pageSize || 20 }
      );
      const auditOpts = AUDIT_OPTS.map(([v, lab]) =>
        `<option value="${this.esc(v)}" ${audit === v ? 'selected' : ''}>${this.esc(lab)}</option>`
      ).join('');

      host.innerHTML = `<div class="ind-page vd-page">
        <div class="ind-hero panel vd-hero">
          <div class="ind-hero__text">
            <h2 class="ind-hero__title">视频交付</h2>
            <p class="ind-hero__desc">仅展示「企业客户」角色管理用户及其关联企业；点击「视频」进入定制视频工作台。</p>
          </div>
          <div class="ind-hero__stats">
            <div class="ind-stat"><b>${Number(stats.total ?? total)}</b><span>企业客户</span></div>
            <div class="ind-stat ind-stat--l1"><b>${Number(stats.approved || 0)}</b><span>已通过</span></div>
          </div>
        </div>
        <div class="panel ind-panel vd-panel">
          <div class="toolbar ind-toolbar vd-toolbar">
            <div class="ind-filters">
              <input class="input vd-search" id="vd-keyword" placeholder="账户名称 / 企业名称 / 手机号" value="${this.esc(keyword)}" onkeydown="if(event.key==='Enter')app.searchVideoDelivery()">
              <select class="input" id="vd-audit">${auditOpts}</select>
              <button class="primary" type="button" onclick="app.searchVideoDelivery()">查询</button>
              <button class="ghost" type="button" onclick="app.resetVideoDeliveryFilters()">重置</button>
            </div>
            <div class="ind-actions">
              <span class="muted">共 ${total} 位企业客户</span>
              <button class="ghost" type="button" onclick="app.refresh()">刷新</button>
            </div>
          </div>
          <div class="table-container ind-table-wrap vd-table-wrap">
            ${rows.length ? `<table class="ind-table vd-table"><thead><tr>
              <th style="width:72px">ID</th>
              <th>账户名称</th>
              <th>LinkedIn公司名称</th>
              <th>手机号</th>
              <th style="width:96px">审核状态</th>
              <th style="width:100px">可用积分</th>
              <th style="width:168px">注册时间</th>
              <th style="width:168px">最后登录时间</th>
              <th style="min-width:220px">操作</th>
            </tr></thead><tbody>${rows.map((c) => this.videoDeliveryRowHtml(c)).join('')}</tbody></table>`
              : `<div class="empty ind-empty vd-empty"><p>暂无企业客户</p><span class="muted">请先在「权限管理 → 管理用户」中创建企业客户角色账号并关联企业</span></div>`}
          </div>
          ${pagerHtml}
        </div>
      </div>`;
    },
    videoDeliveryRowHtml(c) {
      const id = Number(c.id || c.adminUserId || 0);
      const name = this.esc(c.accountName || c.nickname || c.username || '-');
      const company = this.esc(c.linkedinCompany || c.companyName || '-');
      const phone = this.esc(c.phone || '-');
      const points = Number(c.points || 0).toLocaleString();
      const canWrite = this.canVideoDeliveryWrite();
      const userHint = c.username ? `<div class="muted" style="font-size:11px">@${this.esc(c.username)}</div>` : '';
      return `<tr class="ind-row vd-row" data-vd-id="${id}">
        <td><b class="vd-id">#${id}</b></td>
        <td><b class="vd-name">${name}</b>${userHint}</td>
        <td><span class="vd-company" title="${company}">${company}</span></td>
        <td>${phone}</td>
        <td>${this.videoDeliveryAuditBadge(c.auditStatus)}</td>
        <td><b class="vd-points-cell">${points}</b></td>
        <td>${this.videoDeliveryFmtTime(c.registeredAt)}</td>
        <td>${this.videoDeliveryFmtTime(c.lastLoginAt)}</td>
        <td class="ind-ops vd-ops">
          <button class="tiny primary vd-btn-video" type="button" onclick="app.openVideoDeliveryVideos(${id})">视频</button>
          <button class="tiny ghost vd-btn-auth" type="button" onclick="app.openVideoDeliveryAuth(${id})">授权</button>
          ${canWrite ? `<button class="tiny ghost vd-btn-recharge-row" type="button" onclick="app.rechargeVideoDeliveryPoints(${id})">积分充值</button>` : ''}
          <button class="tiny ghost" type="button" onclick="app.openVideoDeliveryPointRecords(${id})">积分记录</button>
        </td>
      </tr>`;
    },
    searchVideoDelivery() {
      this.videoDeliveryKeyword = document.querySelector('#vd-keyword')?.value?.trim() || '';
      this.videoDeliveryAudit = document.querySelector('#vd-audit')?.value || '';
      this.videoDeliveryPage = 1;
      this.refresh();
    },
    resetVideoDeliveryFilters() {
      this.videoDeliveryKeyword = '';
      this.videoDeliveryAudit = '';
      this.videoDeliveryPage = 1;
      this.refresh();
    },
    openVideoDeliveryVideos(clientId) {
      const id = Number(clientId || 0);
      if (!id) return;
      this.videoDeliveryClientId = id;
      this.videoDeliveryOrderPage = 1;
      this.videoDeliveryOrderKeyword = '';
      this.videoDeliveryOrderStatus = '';
      this.videoDeliveryOrderVersion = '';
      this.navigate('videoDelivery', String(id));
    },
    backVideoDeliveryList() {
      this.videoDeliveryClientId = 0;
      this.videoDeliveryDetailHead = null;
      this.navigate('videoDelivery', '');
    },
    async renderVideoDeliveryDetail(clientId) {
      const host = document.querySelector('#content');
      if (!host) return;
      const id = Number(clientId || this.videoDeliveryClientId || 0);
      if (!id) return this.renderVideoDeliveryList();

      const page = this.videoDeliveryOrderPage || 1;
      const keyword = String(this.videoDeliveryOrderKeyword || '').trim();
      const status = String(this.videoDeliveryOrderStatus || '');
      const version = String(this.videoDeliveryOrderVersion || '');
      const qs = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (keyword) qs.set('keyword', keyword);
      if (status) qs.set('status', status);
      if (version) qs.set('serviceVersion', version);

      let pack;
      try {
        pack = await this.api(`/video-delivery-clients/${id}/orders?` + qs.toString());
      } catch (e) {
        host.innerHTML = `<div class="panel"><div class="empty">加载失败：${this.esc(e.message || '')}</div>
          <div style="text-align:center;padding-bottom:20px"><button class="ghost" type="button" onclick="app.backVideoDeliveryList()">返回客户列表</button></div></div>`;
        return;
      }

      const client = pack.client || {};
      const rows = pack.items || [];
      const total = pack.total || 0;
      const canWrite = this.canVideoDeliveryWrite();
      const metaTitle = [
        client.linkedinCompany || client.companyName,
        client.accountName || client.nickname || client.username,
        client.phone,
      ].filter(Boolean).join(' / ');
      const curVersion = String(client.serviceVersion || 'standard');
      const filterVersion = VERSION_OPTS.map(([v, lab]) =>
        `<option value="${v}" ${version === v ? 'selected' : ''}>${lab}</option>`
      ).join('');
      const statusSelect = ORDER_STATUS_OPTS.map(([v, lab]) =>
        `<option value="${this.esc(v)}" ${status === v ? 'selected' : ''}>${this.esc(lab)}</option>`
      ).join('');
      const pagerHtml = UI.pager(
        { page: pack.page || 1, pages: pack.pages || 1, total, pageSize: pack.pageSize || 20 },
        'videoDeliveryOrderPage',
        { pageSize: 20 }
      );

      this.videoDeliveryDetailHead = {
        title: '客户定制视频',
        desc: metaTitle || ('客户 #' + id),
        points: Number(client.points || 0),
        client,
      };

      const svcVersionOpts = VERSION_OPTS.map(([v, lab]) =>
        `<option value="${v}" ${curVersion === v ? 'selected' : ''}>${lab}</option>`
      ).join('');
      const authStartVal = this.esc(this.videoDeliveryFmtDate(client.authStart));
      const authEndVal = this.esc(this.videoDeliveryFmtDate(client.authEnd));

      host.innerHTML = `<div class="ind-page vd-page vd-detail-page">
        <div class="vd-detail-toolbar">
          <button class="ghost tiny" type="button" onclick="app.backVideoDeliveryList()">← 返回客户列表</button>
          <span class="muted vd-detail-points">可用积分 <b id="vd-detail-points-val">${Number(client.points || 0).toLocaleString()}</b></span>
          ${canWrite ? `<button class="tiny ghost" type="button" onclick="app.openVideoDeliveryAuth(${id})">授权 / Token</button>` : ''}
        </div>

        <div class="vd-service-bar panel">
          <div class="vd-service-bar__item">
            <label for="vd-svc-version">服务版本</label>
            <select class="input" id="vd-svc-version" ${canWrite ? '' : 'disabled'}
              onchange="app.autoSaveVideoDeliveryService(${id})">${svcVersionOpts}</select>
          </div>
          <div class="vd-service-bar__item">
            <label for="vd-auth-start">服务开始</label>
            <input class="input" type="date" id="vd-auth-start" value="${authStartVal}" ${canWrite ? '' : 'disabled'}
              onchange="app.autoSaveVideoDeliveryService(${id})">
          </div>
          <div class="vd-service-bar__item">
            <label for="vd-auth-end">服务结束</label>
            <input class="input" type="date" id="vd-auth-end" value="${authEndVal}" ${canWrite ? '' : 'disabled'}
              onchange="app.autoSaveVideoDeliveryService(${id})">
          </div>
          <div class="vd-service-bar__hint muted" id="vd-service-save-hint">
            ${client.authorized ? '服务有效' : '未授权 / 已过期'} · 修改后自动保存
          </div>
        </div>

        <div class="vd-orders-filters-bar">
          <div class="vd-orders-filters">
            <div class="vd-filter-field">
              <label for="vd-order-version">筛选版本</label>
              <select class="input" id="vd-order-version">
                <option value="">全部版本</option>
                ${filterVersion}
              </select>
            </div>
            <div class="vd-filter-field">
              <label for="vd-order-status">状态</label>
              <select class="input" id="vd-order-status">${statusSelect}</select>
            </div>
            <div class="vd-filter-field vd-filter-field--grow">
              <label for="vd-order-keyword">视频标题</label>
              <input class="input" id="vd-order-keyword" placeholder="请输入视频标题" value="${this.esc(keyword)}" onkeydown="if(event.key==='Enter')app.searchVideoDeliveryOrders()">
            </div>
            <button class="primary vd-btn-search" type="button" onclick="app.searchVideoDeliveryOrders()">搜索</button>
            ${canWrite ? `<button class="primary vd-btn-upload" type="button" onclick="app.openVideoDeliveryUpload(${id})">上传视频</button>` : ''}
          </div>
        </div>

        <div class="panel ind-panel vd-orders-panel">
          <div class="table-container ind-table-wrap vd-orders-wrap">
            ${rows.length ? `<table class="ind-table vd-orders-table"><thead><tr>
              <th style="min-width:140px">标题</th>
              <th style="min-width:220px">要求</th>
              <th style="width:110px">消耗积分</th>
              <th style="width:88px">状态</th>
              <th style="width:110px">交付文件</th>
              <th style="width:90px">备注</th>
              <th style="width:100px">下载</th>
              <th style="width:120px">创建时间</th>
              <th style="width:150px">操作</th>
            </tr></thead><tbody>${rows.map((o) => this.videoDeliveryOrderRowHtml(o, canWrite)).join('')}</tbody></table>`
              : `<div class="empty ind-empty"><p>暂无定制视频</p><span class="muted">${canWrite ? '点击「上传视频」创建交付单' : '暂无数据'}</span></div>`}
          </div>
          ${pagerHtml}
        </div>
      </div>`;
    },
    videoDeliveryOrderRowHtml(o, canWrite) {
      const id = Number(o.id || 0);
      const fileCount = Number(o.fileCount || (o.files || []).length || 0);
      const noteCount = Array.isArray(o.notes) ? o.notes.length : 0;
      const isCustomer = String(o.source || '') === 'customer';
      const reqTitle = [o.requirements || '', o.cloudDriveInfo ? ('网盘：' + o.cloudDriveInfo) : '']
        .filter(Boolean).join('\n');
      const cloudHtml = o.cloudDriveInfo
        ? `<div class="vd-cloud muted" title="${this.esc(o.cloudDriveInfo)}">网盘：${this.esc(String(o.cloudDriveInfo).slice(0, 80))}${String(o.cloudDriveInfo).length > 80 ? '…' : ''}</div>`
        : '';
      return `<tr class="vd-order-row" data-order-id="${id}">
        <td>
          <b class="vd-order-title">${this.esc(o.title || '-')}</b>
          <div class="muted vd-order-id">#${id}${isCustomer ? ' · <span class="vd-src-customer">客户需求</span>' : ''}</div>
        </td>
        <td>
          <div class="vd-req" title="${this.esc(reqTitle)}">${this.esc(o.requirements || '-')}</div>
          ${cloudHtml}
        </td>
        <td>
          <div class="vd-settle">${this.esc(o.settleType || '按次结算')}</div>
          <b class="vd-cost">${Number(o.pointsCost || 0)}</b>
        </td>
        <td>${this.videoDeliveryOrderStatusBadge(o.status, o.statusLabel)}</td>
        <td>
          <button class="tiny primary vd-btn-files" type="button" onclick="app.openVideoDeliveryFilesModal(${id})">
            交付文件${fileCount ? `<span class="vd-file-count">${fileCount}</span>` : ''}
          </button>
        </td>
        <td class="vd-notes-cell">
          <span class="muted">${noteCount ? `${noteCount} 条` : '无'}</span>
        </td>
        <td>
          <div class="vd-dl-count"><b>${Number(o.downloadCount || 0)}</b> 次</div>
          <button class="tiny ghost" type="button" onclick="app.openVideoDeliveryDownloadRecords(${id})">下载记录</button>
        </td>
        <td>${this.videoDeliveryFmtTime(o.createdAt)}</td>
        <td>
          <div class="vd-order-ops">
            <button class="tiny ghost" type="button" onclick="app.openVideoDeliveryOrderDetail(${id})">详情</button>
            ${canWrite
              ? `<button class="tiny primary" type="button" onclick="app.openVideoDeliveryOrderEdit(${id})">编辑</button>`
              : ''}
          </div>
        </td>
      </tr>`;
    },
    searchVideoDeliveryOrders() {
      this.videoDeliveryOrderKeyword = document.querySelector('#vd-order-keyword')?.value?.trim() || '';
      this.videoDeliveryOrderStatus = document.querySelector('#vd-order-status')?.value || '';
      this.videoDeliveryOrderVersion = document.querySelector('#vd-order-version')?.value || '';
      this.videoDeliveryOrderPage = 1;
      this.refresh();
    },
    videoDeliveryShouhuzhePanelHtml(client = {}) {
      const exists = !!client.shouhuzheExists;
      const ops = String(client.shouhuzheOperatorName || '').trim();
      const matchName = String(client.shouhuzheCompanyName || '').trim();
      const matchId = String(client.shouhuzheCompanyId || '').trim();
      const synced = String(client.shouhuzheSyncedAt || '').slice(0, 19).replace('T', ' ');
      const err = String(client.shouhuzheLastError || '').trim();
      const statusBadge = exists
        ? '<span class="vd-shz-badge vd-shz-badge--ok">已创建</span>'
        : '<span class="vd-shz-badge vd-shz-badge--miss">未创建</span>';
      return `
        <section class="vd-shz-card" id="vd-shz-panel" data-client-id="${Number(client.id || 0)}">
          <div class="vd-shz-card__head">
            <div class="vd-shz-card__title">
              <span class="vd-shz-card__icon" aria-hidden="true">◈</span>
              <div>
                <div class="vd-shz-card__label">守护者企业</div>
                <div class="vd-shz-card__sub muted">按企业名称查询是否已创建及关联运营</div>
              </div>
            </div>
            <button class="ghost tiny vd-shz-refresh" type="button" id="vd-shz-refresh"
              onclick="app.refreshVideoDeliveryShouhuzheCompany(${Number(client.id || 0)})">刷新</button>
          </div>
          <div class="vd-shz-card__grid">
            <div class="vd-shz-item">
              <div class="vd-shz-item__k">是否创建</div>
              <div class="vd-shz-item__v" id="vd-shz-exists">${statusBadge}</div>
            </div>
            <div class="vd-shz-item">
              <div class="vd-shz-item__k">关联运营用户</div>
              <div class="vd-shz-item__v" id="vd-shz-ops">${ops ? this.esc(ops) : '<span class="muted">未关联</span>'}</div>
            </div>
            <div class="vd-shz-item vd-shz-item--wide">
              <div class="vd-shz-item__k">匹配企业</div>
              <div class="vd-shz-item__v" id="vd-shz-match">${
                matchName
                  ? `${this.esc(matchName)}${matchId ? ` <span class="vd-shz-id">#${this.esc(matchId)}</span>` : ''}`
                  : '<span class="muted">暂无匹配</span>'
              }</div>
            </div>
          </div>
          <div class="vd-shz-card__foot muted" id="vd-shz-foot">
            ${synced ? `最近同步 ${this.esc(synced)}` : '尚未同步'}
            ${err ? ` · <span class="vd-shz-err">${this.esc(err)}</span>` : ''}
          </div>
        </section>`;
    },
    patchVideoDeliveryShouhuzhePanel(client = {}) {
      const panel = document.querySelector('#vd-shz-panel');
      if (!panel) return;
      const wrap = document.createElement('div');
      wrap.innerHTML = this.videoDeliveryShouhuzhePanelHtml(client);
      const next = wrap.firstElementChild;
      if (next) panel.replaceWith(next);
    },
    async syncVideoDeliveryShouhuzheCompany(clientId, { force = false, silent = false } = {}) {
      const id = Number(clientId || 0);
      if (!id) return null;
      const btn = document.querySelector('#vd-shz-refresh');
      if (btn) {
        btn.disabled = true;
        btn.textContent = force ? '刷新中…' : '同步中…';
      }
      try {
        const pack = await this.api(`/video-delivery-clients/${id}/shouhuzhe-company`, {
          method: 'POST',
          body: JSON.stringify({ force: !!force }),
        });
        const client = pack?.client || pack;
        if (client) this.patchVideoDeliveryShouhuzhePanel(client);
        if (!silent) this.toast(pack?.message || '守护者企业信息已更新');
        return client;
      } catch (e) {
        try {
          const fresh = await this.api(`/video-delivery-clients/${id}`);
          if (fresh) this.patchVideoDeliveryShouhuzhePanel(fresh);
        } catch (_) {}
        if (!silent) this.toast(e.message || '守护者企业查询失败', true);
        return null;
      } finally {
        const b = document.querySelector('#vd-shz-refresh');
        if (b) {
          b.disabled = false;
          b.textContent = '刷新';
        }
      }
    },
    async refreshVideoDeliveryShouhuzheCompany(clientId) {
      return this.syncVideoDeliveryShouhuzheCompany(clientId, { force: true, silent: false });
    },
    async openVideoDeliveryAuth(clientId) {
      const id = Number(clientId || 0);
      if (!id) return;
      let client;
      try {
        client = await this.api(`/video-delivery-clients/${id}`);
      } catch (e) {
        this.toast(e.message || '加载授权信息失败', true);
        return;
      }
      const canWrite = this.canVideoDeliveryWrite();
      const authStart = this.videoDeliveryFmtDate(client.authStart);
      const authEnd = this.videoDeliveryFmtDate(client.authEnd);
      const curVersion = String(client.serviceVersion || 'standard');
      const versionOpts = VERSION_OPTS.map(([v, lab]) =>
        `<option value="${v}" ${curVersion === v ? 'selected' : ''}>${lab}</option>`
      ).join('');
      const authBadge = client.authorized
        ? '<span class="badge success">视频积分已授权</span>'
        : '<span class="badge warn">未授权 / 已过期</span>';
      const titleName = client.accountName || client.nickname || client.username || ('客户 #' + id);
      this.modal(`授权 · ${titleName}`, `
        <div class="vd-auth-modal">
          <div class="vd-auth-modal__head">
            <div>
              <div class="vd-auth-modal__name">${this.esc(titleName)}</div>
              <div class="muted">${this.esc(client.linkedinCompany || client.companyName || '')}</div>
            </div>
            ${authBadge}
          </div>
          ${this.videoDeliveryShouhuzhePanelHtml(client)}
          <div class="vd-auth-form">
            <div class="vd-auth-row">
              <label for="vd-svc-version">服务版本</label>
              <select class="input" id="vd-svc-version" ${canWrite ? '' : 'disabled'}
                onchange="app.autoSaveVideoDeliveryService(${id})">${versionOpts}</select>
            </div>
            <div class="vd-auth-row">
              <label for="vd-auth-start">开始日期</label>
              <input class="input" type="date" id="vd-auth-start" value="${this.esc(authStart)}" ${canWrite ? '' : 'disabled'}
                onchange="app.autoSaveVideoDeliveryService(${id})">
              <label for="vd-auth-end">结束日期</label>
              <input class="input" type="date" id="vd-auth-end" value="${this.esc(authEnd)}" ${canWrite ? '' : 'disabled'}
                onchange="app.autoSaveVideoDeliveryService(${id})">
            </div>
            <div class="vd-auth-row vd-auth-token-row">
              <label for="vd-auth-token">企业授权 Token</label>
              <input class="input vd-token-input" id="vd-auth-token" value="${this.esc(client.authToken || '')}" ${canWrite ? '' : 'readonly'} placeholder="点击生成企业 Token">
            </div>
            <div class="vd-auth-row vd-auth-actions">
              ${canWrite ? `<button class="ghost" type="button" onclick="app.generateVideoDeliveryToken(${id})">生成企业Token</button>` : ''}
              <button class="ghost" type="button" onclick="app.copyVideoDeliveryToken()">复制Token</button>
              <button class="ghost" type="button" onclick="app.fetchVideoDeliveryToken(${id})">获取Token</button>
              <button class="primary vd-btn-check" type="button" onclick="app.checkVideoDeliveryLink(${id})">检测关联</button>
            </div>
            <div class="vd-auth-points muted">
              绑定状态 <b>${client.tokenBound ? '已绑定' : '未绑定'}</b>
              ${client.remoteCompanyName ? ` · ${this.esc(client.remoteCompanyName)}` : ''}
              · 可用积分 <b id="vd-auth-points">${Number(client.points || 0).toLocaleString()}</b>
              · 更新于 ${this.esc((client.pointsUpdatedAt || '-').toString().slice(0, 19).replace('T', ' '))}
            </div>
            ${client.lastTokenError ? `<div class="muted" style="color:#b91c1c;font-size:12px">上次检测：${this.esc(client.lastTokenError)}</div>` : ''}
          </div>
        </div>
      `, async () => {
        if (!canWrite) return;
        await this.saveVideoDeliveryService(id);
      }, false, {
        submitText: '保存授权',
        hideSubmit: !canWrite,
        wide: true,
        onClose: () => {
          if (this.view === 'videoDelivery' && !this.videoDeliveryClientIdFromSubview()) {
            this.refresh();
          }
        },
      });
      // 关联运营为空时自动请求守护者并入库
      if (!String(client.shouhuzheOperatorName || '').trim()) {
        setTimeout(() => {
          this.syncVideoDeliveryShouhuzheCompany(id, { force: false, silent: true });
        }, 40);
      }
    },
    async saveVideoDeliveryService(clientId, opts = {}) {
      if (!this.canVideoDeliveryWrite()) return null;
      const id = Number(clientId || this.videoDeliveryClientId || 0);
      if (!id) return null;
      const silent = !!opts.silent;
      const authStart = document.querySelector('#vd-auth-start')?.value || '';
      const authEnd = document.querySelector('#vd-auth-end')?.value || '';
      if (authStart && authEnd && authEnd < authStart) {
        this.toast('服务结束日期不能早于开始日期', true);
        throw new Error('服务结束日期不能早于开始日期');
      }
      const payload = {
        serviceVersion: document.querySelector('#vd-svc-version')?.value || 'standard',
        authStart,
        authEnd,
      };
      // 仅在授权弹窗有 Token 输入框时才提交，避免详情页自动保存清空 Token
      const tokenEl = document.querySelector('#vd-auth-token');
      if (tokenEl) payload.authToken = tokenEl.value || '';
      try {
        const client = await this.api(`/video-delivery-clients/${id}/service`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        if (!silent) this.toast('授权配置已保存');
        const hint = document.querySelector('#vd-service-save-hint');
        if (hint) {
          const ok = !!(client?.authorized);
          hint.textContent = `${ok ? '服务有效' : '未授权 / 已过期'} · 已自动保存`;
        }
        return client;
      } catch (e) {
        this.toast(e.message, true);
        throw e;
      }
    },
    async autoSaveVideoDeliveryService(clientId) {
      if (!this.canVideoDeliveryWrite()) return;
      const hint = document.querySelector('#vd-service-save-hint');
      if (hint) hint.textContent = '保存中…';
      try {
        await this.saveVideoDeliveryService(clientId, { silent: true });
        this.toast('服务配置已更新', false, 1200);
      } catch (_) {
        if (hint) hint.textContent = '保存失败，请重试';
      }
    },
    async generateVideoDeliveryToken(clientId) {
      if (!this.canVideoDeliveryWrite()) return;
      const id = Number(clientId || this.videoDeliveryClientId || 0);
      try {
        const c = await this.api(`/video-delivery-clients/${id}/token`, { method: 'POST', body: '{}' });
        const el = document.querySelector('#vd-auth-token');
        if (el) el.value = c.authToken || '';
        this.toast('已生成授权 Token');
      } catch (e) {
        this.toast(e.message, true);
      }
    },
    async copyVideoDeliveryToken() {
      const token = document.querySelector('#vd-auth-token')?.value || '';
      if (!token) {
        this.toast('暂无 Token 可复制', true);
        return;
      }
      try {
        await navigator.clipboard.writeText(token);
        this.toast('Token 已复制');
      } catch {
        const el = document.querySelector('#vd-auth-token');
        el?.select?.();
        document.execCommand('copy');
        this.toast('Token 已复制');
      }
    },
    async checkVideoDeliveryLink(clientId) {
      const id = Number(clientId || this.videoDeliveryClientId || 0);
      try {
        if (this.canVideoDeliveryWrite() && document.querySelector('#vd-auth-token')) {
          try { await this.saveVideoDeliveryService(id); } catch (_) { /* ignore */ }
        }
        const r = await this.api(`/video-delivery-clients/${id}/check-link`, { method: 'POST', body: '{}' });
        const c = r.client || {};
        const el = document.querySelector('#vd-auth-points');
        if (el && c.points != null) el.textContent = Number(c.points || 0).toLocaleString();
        this.toast(r.message || (r.ok ? '关联正常' : '检测未通过'), !r.ok);
      } catch (e) {
        this.toast(e.message, true);
      }
    },
    async fetchVideoDeliveryToken(clientId) {
      const id = Number(clientId || this.videoDeliveryClientId || 0);
      try {
        const r = await this.api(`/video-delivery-clients/${id}/token?sync=1`);
        const el = document.querySelector('#vd-auth-token');
        if (el) el.value = r.authToken || '';
        const pts = document.querySelector('#vd-auth-points');
        if (pts && r.points != null) pts.textContent = Number(r.points || 0).toLocaleString();
        this.toast(r.authToken ? '已获取企业 Token' : '尚未生成 Token', !r.authToken);
      } catch (e) {
        this.toast(e.message, true);
      }
    },
    async openVideoDeliveryPointRecords(clientId) {
      const id = Number(clientId || this.videoDeliveryClientId || 0);
      if (!id) return;
      let pack;
      try {
        pack = await this.api(`/video-delivery-clients/${id}/point-records?limit=50`);
      } catch (e) {
        this.toast(e.message || '加载积分记录失败', true);
        return;
      }
      const items = Array.isArray(pack?.items) ? pack.items : [];
      const rows = items.length
        ? items.map((r) => {
          const dir = r.direction === 'recharge' ? '充值' : '扣除';
          const sign = r.direction === 'recharge' ? '+' : '-';
          return `<tr>
            <td>${this.esc(String(r.deductedAt || r.createdAt || '').slice(0, 19).replace('T', ' '))}</td>
            <td>${dir}</td>
            <td><b>${sign}${Number(r.points || 0).toLocaleString()}</b></td>
            <td>${r.balanceAfter != null ? Number(r.balanceAfter).toLocaleString() : '-'}</td>
            <td>${this.esc(r.title || (r.orderId ? ('#' + r.orderId) : '-'))}</td>
            <td>${this.esc(r.source || '-')}</td>
            <td>${this.esc(r.operatorName || '-')}</td>
          </tr>`;
        }).join('')
        : '<tr><td colspan="7" class="muted" style="text-align:center;padding:18px">暂无积分记录</td></tr>';
      this.modal('积分记录 #' + id, `
        <div class="table-wrap" style="max-height:420px;overflow:auto">
          <table class="table compact">
            <thead><tr>
              <th>时间</th><th>类型</th><th>积分</th><th>余额</th><th>标题/单号</th><th>来源</th><th>操作人</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `, null, false, { hideSubmit: true, wide: true });
    },
    async rechargeVideoDeliveryPoints(clientId) {
      if (!this.canVideoDeliveryWrite()) return;
      const id = Number(clientId || this.videoDeliveryClientId || 0);
      if (!id) return;
      let client;
      try {
        client = await this.api(`/video-delivery-clients/${id}`);
      } catch (e) {
        this.toast(e.message || '加载客户积分失败', true);
        return;
      }
      const cur = Number(client.points || 0);
      const titleName = client.accountName || client.nickname || client.username || ('客户 #' + id);
      const company = client.linkedinCompany || client.companyName || '';
      const updatedAt = String(client.pointsUpdatedAt || '-').slice(0, 19).replace('T', ' ');
      const bound = !!client.tokenBound;
      const quicks = [100, 500, 1000, 5000, -100, -500];

      this.modal('积分充值', `
        <div class="vd-recharge">
          <div class="vd-recharge__hero">
            <div class="vd-recharge__hero-text">
              <div class="vd-recharge__label">当前可用积分（远程同步）</div>
              <div class="vd-recharge__balance" id="vd-recharge-cur">${cur.toLocaleString()}</div>
              <div class="vd-recharge__meta muted">${this.esc(titleName)}${company ? ' · ' + this.esc(company) : ''}</div>
              <div class="vd-recharge__meta muted">Token ${bound ? '已绑定' : '未绑定'} · 更新于 ${this.esc(updatedAt)}</div>
            </div>
            <div class="vd-recharge__hero-icon" aria-hidden="true">◈</div>
          </div>
          <div class="vd-recharge__body">
            <p class="vd-recharge__hint">对接守护者充值接口：打开支付页完成充值后，点「同步余额」拉取最新积分。</p>
            <div class="vd-recharge__actions" style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 14px">
              <button type="button" class="primary" id="vd-recharge-remote">打开守护者充值页</button>
              <button type="button" class="ghost" id="vd-recharge-sync">同步余额</button>
            </div>
            <details>
              <summary class="muted" style="cursor:pointer">本地调账（应急）</summary>
              <label class="vd-recharge__field-label" for="vd-recharge-amount" style="margin-top:10px">调账数量</label>
              <div class="vd-recharge__input-wrap">
                <input class="input vd-recharge__input" id="vd-recharge-amount" name="amount" type="number" step="1" value="1000" placeholder="正数增加，负数扣减" autocomplete="off">
                <span class="vd-recharge__unit">积分</span>
              </div>
              <div class="vd-recharge__quicks" id="vd-recharge-quicks">
                ${quicks.map((n) => `<button type="button" class="vd-recharge__chip${n < 0 ? ' is-deduct' : ''}" data-amt="${n}">${n > 0 ? '+' : ''}${n.toLocaleString()}</button>`).join('')}
              </div>
              <div class="vd-recharge__preview">
                <span>调账后本地余额</span>
                <b id="vd-recharge-next">${(cur + 1000).toLocaleString()}</b>
              </div>
            </details>
          </div>
        </div>
      `, async () => {
        const amount = Number(document.querySelector('#vd-recharge-amount')?.value);
        if (!Number.isFinite(amount) || amount === 0) {
          this.toast('请输入非零数字，或使用上方远程充值', true);
          throw new Error('请输入非零数字');
        }
        await this.api(`/video-delivery-clients/${id}/recharge`, {
          method: 'POST',
          body: JSON.stringify({ mode: 'local', amount }),
        });
        this.toast(amount > 0 ? `本地已增加 ${amount.toLocaleString()} 积分` : `本地已扣减 ${Math.abs(amount).toLocaleString()} 积分`);
        this.refresh();
      }, false, {
        submitText: '确认本地调账',
        loadingTitle: '正在调账',
        loadingDesc: '正在更新本地积分记录…',
      });

      const syncPreview = () => {
        const amount = Number(document.querySelector('#vd-recharge-amount')?.value || 0);
        const next = Math.max(0, cur + (Number.isFinite(amount) ? amount : 0));
        const el = document.querySelector('#vd-recharge-next');
        if (el) {
          el.textContent = next.toLocaleString();
          el.classList.toggle('is-up', amount > 0);
          el.classList.toggle('is-down', amount < 0);
        }
      };
      requestAnimationFrame(() => {
        const input = document.querySelector('#vd-recharge-amount');
        input?.addEventListener('input', syncPreview);
        document.querySelector('#vd-recharge-quicks')?.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-amt]');
          if (!btn || !input) return;
          input.value = btn.getAttribute('data-amt') || '0';
          syncPreview();
        });
        document.querySelector('#vd-recharge-remote')?.addEventListener('click', async () => {
          try {
            const r = await this.api(`/video-delivery-clients/${id}/recharge`, {
              method: 'POST',
              body: JSON.stringify({ mode: 'payment' }),
            });
            const url = r.loginUrl || r.login_url;
            if (!url) {
              this.toast('未返回充值地址', true);
              return;
            }
            window.open(url, '_blank', 'noopener');
            this.toast('已打开守护者充值页');
            const c = r.client;
            if (c?.points != null) {
              const bal = document.querySelector('#vd-recharge-cur');
              if (bal) bal.textContent = Number(c.points).toLocaleString();
            }
          } catch (e) {
            this.toast(e.message || '打开充值页失败', true);
          }
        });
        document.querySelector('#vd-recharge-sync')?.addEventListener('click', async () => {
          try {
            const c = await this.api(`/video-delivery-clients/${id}/recharge`, {
              method: 'POST',
              body: JSON.stringify({ mode: 'sync' }),
            });
            const bal = document.querySelector('#vd-recharge-cur');
            if (bal) bal.textContent = Number(c.points || 0).toLocaleString();
            this.toast('已同步远程积分');
            this.refresh();
          } catch (e) {
            this.toast(e.message || '同步失败', true);
          }
        });
        syncPreview();
        const box = document.querySelector('#modal');
        if (box && window.UI) UI.decorate(box);
      });
    },
    async loadVideoDeliverySettleTypes() {
      try {
        const pack = await this.api('/video-delivery-types?enabled=1');
        const items = Array.isArray(pack?.items) ? pack.items : [];
        this._vdSettleTypes = items;
        this._vdPointsMultiplier = Number(pack?.pointsMultiplier || 50);
        return items;
      } catch (e) {
        this._vdSettleTypes = [];
        this.toast(e.message || '加载交付类型失败', true);
        return [];
      }
    },
    findVideoDeliverySettleType(code) {
      return (this._vdSettleTypes || []).find((t) => String(t.code) === String(code)) || null;
    },
    setVideoDeliveryUploadBlockReason(msg, isDanger = true) {
      const bar = document.querySelector('#vd-upload-submit-block');
      if (!bar) return;
      const text = String(msg || '').trim();
      if (!text) {
        bar.classList.add('hidden');
        bar.textContent = '';
        return;
      }
      bar.classList.remove('hidden');
      bar.classList.toggle('is-danger', !!isDanger);
      bar.classList.toggle('is-ok', !isDanger);
      bar.textContent = text;
    },
    setVideoDeliveryGithubProgress(opts = {}) {
      let host = document.querySelector('#vd-github-progress');
      if (!host) {
        const pane = document.querySelector('.vd-upload-files-pane');
        if (!pane) return;
        host = document.createElement('div');
        host.id = 'vd-github-progress';
        host.className = 'vd-github-progress hidden';
        pane.appendChild(host);
      }
      if (opts.hide) {
        host.classList.add('hidden');
        host.innerHTML = '';
        return;
      }
      const total = Math.max(1, Number(opts.total || 1));
      const current = Math.max(0, Number(opts.current || 0));
      const pct = Math.max(0, Math.min(100, Number(opts.percent != null ? opts.percent : Math.round((current / total) * 100))));
      const title = opts.title || '正在上传到 GitHub';
      const meta = opts.meta || '';
      host.classList.remove('hidden', 'is-error', 'is-done');
      if (opts.error) host.classList.add('is-error');
      if (opts.done) host.classList.add('is-done');
      const results = Array.isArray(opts.results) ? opts.results : [];
      const resultsHtml = results.length
        ? `<div class="vd-github-progress__results">${results.map((r) => {
            const playUrl = String(r.playUrl || r.cdnUrl || r.githubAssetUrl || '').trim();
            const name = r.name || ('素材 #' + (r.id || ''));
            const nameEnc = encodeURIComponent(String(name || ''));
            const playEnc = encodeURIComponent(playUrl);
            const mid = Number(r.id || 0);
            const viewBtn = playUrl
              ? `<button class="tiny primary" type="button" onclick="app.previewVideoDeliveryMaterial(decodeURIComponent('${nameEnc}'),decodeURIComponent('${playEnc}'))">查看</button>
                 <a class="tiny ghost" href="${this.esc(playUrl)}" target="_blank" rel="noopener">打开链接</a>`
              : (mid
                ? `<button class="tiny ghost" type="button" onclick="app.previewLocalMaterial&&app.previewLocalMaterial(${mid})">查看</button>`
                : '');
            return `<div class="vd-github-progress__row">
              <span class="vd-github-progress__name" title="${this.esc(name)}">${this.esc(name)}</span>
              <span class="vd-github-progress__ops">${viewBtn}</span>
            </div>`;
          }).join('')}</div>`
        : '';
      host.innerHTML = `
        <div class="vd-github-progress__title">${this.esc(title)}</div>
        <div class="vd-github-progress__bar" aria-hidden="true"><i style="width:${pct}%"></i></div>
        <div class="vd-github-progress__meta">${this.esc(meta || (`${current}/${total} · ${pct}%`))}</div>
        ${resultsHtml}`;
    },
    previewVideoDeliveryMaterial(name, remoteUrl) {
      const url = String(remoteUrl || '').trim();
      if (!url) {
        this.toast('暂无 GitHub/CDN 链接', true);
        return;
      }
      this.previewVideoDeliveryFile(0, name || '查看视频', url);
    },
    setVideoDeliveryModalSubmitting(busy, label) {
      const btn = document.querySelector('#modal .modal-foot button[type=submit]');
      if (!btn) return;
      if (busy) {
        btn.disabled = true;
        if (label) btn.dataset._vdLabel = btn.textContent || '';
        if (label) btn.textContent = label;
      } else {
        btn.disabled = false;
        if (btn.dataset._vdLabel) {
          btn.textContent = btn.dataset._vdLabel;
          delete btn.dataset._vdLabel;
        }
      }
    },
    /** 依次确保素材有 GitHub/CDN 链接（接口侧已有则直接跳过），全部完成才允许保存 */
    async ensureVideoDeliveryGithubUploads(materialIds) {
      const ids = [...new Set((materialIds || []).map(Number).filter(Boolean))];
      if (!ids.length) return [];
      const owned = typeof this.ownedMaterials === 'function' ? this.ownedMaterials() : (this.materials || []);
      const items = ids.map((id) => {
        const m = owned.find((x) => Number(x.id) === id) || {};
        return {
          id,
          name: m.name || m.fileName || m.file_name || ('素材 #' + id),
        };
      });
      this.setVideoDeliveryModalSubmitting(true, '上传中…');
      const results = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        this.setVideoDeliveryGithubProgress({
          current: i,
          total: items.length,
          percent: Math.round((i / items.length) * 100),
          title: `GitHub 上传（${i + 1}/${items.length}）`,
          meta: item.name,
        });
        try {
          const uploaded = await this.api(`/materials/${item.id}/github-upload`, {
            method: 'POST',
            body: '{}',
          });
          if (Array.isArray(this.materials) && uploaded?.id) {
            const idx = this.materials.findIndex((x) => Number(x.id) === Number(uploaded.id));
            if (idx >= 0) this.materials[idx] = Object.assign({}, this.materials[idx], uploaded);
          }
          const playUrl = String(uploaded?.playUrl || uploaded?.cdnUrl || uploaded?.cdn_url
            || uploaded?.githubAssetUrl || uploaded?.github_asset_url || '').trim();
          results.push({
            id: Number(uploaded?.id || item.id),
            name: uploaded?.name || item.name,
            playUrl,
          });
        } catch (e) {
          this.setVideoDeliveryGithubProgress({
            error: true,
            current: i,
            total: items.length,
            percent: Math.round((i / items.length) * 100),
            title: 'GitHub 上传失败',
            meta: `${item.name}：${e.message || '未知错误'}`,
          });
          this.setVideoDeliveryModalSubmitting(false);
          throw e;
        }
        this.setVideoDeliveryGithubProgress({
          current: i + 1,
          total: items.length,
          percent: Math.round(((i + 1) / items.length) * 100),
          title: `进度 ${i + 1}/${items.length}`,
          meta: item.name,
        });
      }
      this.setVideoDeliveryGithubProgress({
        done: true,
        current: items.length,
        total: items.length,
        percent: 100,
        title: 'GitHub 就绪',
        meta: `共 ${items.length} 个素材，可保存交付`,
        results,
      });
      this.setVideoDeliveryModalSubmitting(false);
      return ids;
    },
    syncVideoDeliveryUploadQuote() {
      const sel = document.querySelector('#modal-form [name="settleType"]');
      const costEl = document.querySelector('#modal-form [name="pointsCost"]');
      const hint = document.querySelector('#vd-upload-cost-hint');
      const balEl = document.querySelector('#vd-upload-balance');
      const submitBtn = document.querySelector('#modal .modal-foot button[type=submit]');
      const type = this.findVideoDeliverySettleType(sel?.value || '');
      const materialIds = typeof this.selectedMaterialPickerIds === 'function'
        ? this.selectedMaterialPickerIds('vd-upload-mat-field')
        : [];
      const qty = Math.max(1, materialIds.length || 1);
      const balance = Number(this._vdUploadBalance || 0);
      if (balEl) balEl.textContent = String(balance);
      if (!type) {
        if (costEl) {
          costEl.value = '0';
          costEl.readOnly = true;
        }
        if (hint) {
          hint.textContent = '请选择结算类型';
          hint.classList.add('is-danger');
        }
        if (submitBtn) submitBtn.disabled = true;
        this.setVideoDeliveryUploadBlockReason('提交已禁用：请先在上方选择「结算视频类型」');
        return { pointsCost: 0, ok: false };
      }
      let pointsCost = 0;
      let manual = !type.priced;
      if (type.priced) {
        const unit = Number(type.unitPrice || 0);
        pointsCost = type.perItem ? unit * qty : unit;
        if (costEl) {
          costEl.value = String(pointsCost);
          costEl.readOnly = true;
        }
        if (hint) {
          hint.textContent = type.perItem
            ? `单价 ${unit} × ${qty}（素材数）= ${pointsCost}（配置分 ${type.points} × 倍率 ${this._vdPointsMultiplier || 50}）`
            : `固定 ${pointsCost}（配置分 ${type.points} × 倍率 ${this._vdPointsMultiplier || 50}）`;
        }
      } else {
        pointsCost = Math.max(0, Number(costEl?.value || 0));
        if (costEl) costEl.readOnly = false;
        if (hint) hint.textContent = '该类型需手工填写消耗积分';
      }
      const insufficient = pointsCost > balance;
      if (hint && insufficient) {
        hint.textContent = `余额偏低：需 ${pointsCost}，余额 ${balance}（客户确认时才会扣积分）`;
        hint.classList.add('is-danger');
      } else if (hint) {
        hint.classList.remove('is-danger');
      }
      if (submitBtn) submitBtn.disabled = !sel?.value;
      this.setVideoDeliveryUploadBlockReason(
        insufficient
          ? `可提交：预计 ${pointsCost} 积分，当前余额 ${balance}（确认交付时扣除）`
          : `可提交：预计 ${pointsCost} 积分，客户确认后扣除（余额 ${balance}）`,
        false
      );
      return { pointsCost, ok: !!sel?.value, quantity: qty, manual };
    },
    async openVideoDeliveryUpload(clientId) {
      if (!this.canVideoDeliveryWrite()) {
        this.toast('当前角色无权上传', true);
        return;
      }
      if (typeof this.materialPickerFieldHtml !== 'function') {
        this.toast('素材选择组件未加载，请刷新后重试', true);
        return;
      }
      const id = Number(clientId || this.videoDeliveryClientId || 0);
      const version = document.querySelector('#vd-svc-version')?.value || 'standard';
      const head = this.videoDeliveryDetailHead || {};
      this._vdUploadBalance = Number(head.points ?? head.client?.points ?? 0);
      // 始终再拉一次客户积分，避免余额过期或详情未带 points
      try {
        const client = await this.api(`/video-delivery-clients/${id}`);
        this._vdUploadBalance = Number(client?.points || 0);
        if (this.videoDeliveryDetailHead) {
          this.videoDeliveryDetailHead.points = this._vdUploadBalance;
          this.videoDeliveryDetailHead.client = client;
        }
      } catch (_) { /* ignore */ }
      const types = await this.loadVideoDeliverySettleTypes();
      if (!types.length) {
        this.toast('暂无可用交付类型，请先在「开发管理 → 视频交付类型」配置', true);
        return;
      }
      const settleOpts = [
        `<option value="" disabled selected>请选择结算视频类型</option>`,
        ...types.map((t) => {
          const price = t.priced ? `${Number(t.unitPrice)} ${t.unit || ''}`.trim() : '手工计价';
          const lab = `${t.title}（${price}）`;
          return `<option value="${this.esc(t.code)}">${this.esc(lab)}</option>`;
        }),
      ].join('');
      const matField = this.materialPickerFieldHtml({
        fieldId: 'vd-upload-mat-field',
        name: 'materialIds',
        multiple: true,
        max: 0,
        selectedIds: [],
      });
      this.modal('上传视频', `
        <div class="vd-upload-layout vd-upload-layout--stack">
          <div class="vd-upload-form-pane">
            <div class="vd-upload-grid">
              <div class="field">
                <label>视频标题</label>
                <input class="input" name="title" type="text" placeholder="请输入视频标题" required>
              </div>
              <div class="field">
                <label>结算视频类型</label>
                <select class="input" name="settleType" required>${settleOpts}</select>
              </div>
              <div class="field">
                <label>消耗积分 <span class="muted">（余额 <b id="vd-upload-balance">${Number(this._vdUploadBalance || 0)}</b>）</span></label>
                <input class="input" name="pointsCost" type="number" min="0" step="1" value="0" readonly>
                <div class="form-hint" id="vd-upload-cost-hint">请选择结算类型</div>
              </div>
              <div class="field full">
                <label>交付说明</label>
                <textarea class="input" name="requirements" rows="3" placeholder="可填写交付说明"></textarea>
              </div>
              <div class="field">
                <label>积分说明</label>
                <textarea class="input" name="pointsNote" rows="3" placeholder="可填写本次扣除积分说明"></textarea>
              </div>
              <div class="field">
                <label>内部备注</label>
                <textarea class="input" name="internalNote" rows="3" placeholder="可填写内部备注，系统会自动追加时间和账号"></textarea>
              </div>
            </div>
            <input type="hidden" name="serviceVersion" value="${this.esc(version)}">
            <input type="hidden" name="status" value="completed">
          </div>
          <div class="vd-upload-files-pane">
            <div class="vd-upload-files-head">
              <b>交付视频</b>
              <span class="muted">从视频素材库多选；保存前依次上传到 GitHub（已有链接跳过），上传完成才可保存</span>
            </div>
            ${matField}
            <div id="vd-upload-submit-block" class="vd-upload-submit-block hidden" aria-live="polite"></div>
          </div>
        </div>
      `, async () => {
        const title = document.querySelector('#modal-form [name="title"]')?.value?.trim() || '';
        if (!title) {
          this.toast('请填写视频标题', true);
          throw new Error('请填写视频标题');
        }
        const settleType = document.querySelector('#modal-form [name="settleType"]')?.value?.trim() || '';
        if (!settleType) {
          this.toast('请选择结算视频类型', true);
          throw new Error('请选择结算视频类型');
        }
        const materialIds = typeof this.selectedMaterialPickerIds === 'function'
          ? this.selectedMaterialPickerIds('vd-upload-mat-field')
          : [];
        if (!materialIds.length) {
          this.toast('请至少选择一个视频素材', true);
          throw new Error('请至少选择一个视频素材');
        }
        const quote = this.syncVideoDeliveryUploadQuote();
        try {
          await this.ensureVideoDeliveryGithubUploads(materialIds);
        } catch (e) {
          this.toast(e.message || 'GitHub 上传失败，无法保存', true);
          throw e;
        }
        const requirements = document.querySelector('#modal-form [name="requirements"]')?.value?.trim() || '';
        const pointsNote = document.querySelector('#modal-form [name="pointsNote"]')?.value?.trim() || '';
        const internalNote = document.querySelector('#modal-form [name="internalNote"]')?.value?.trim() || '';
        let reqText = requirements;
        if (pointsNote) {
          reqText = reqText ? `${reqText}\n积分说明：${pointsNote}` : `积分说明：${pointsNote}`;
        }
        this.setVideoDeliveryModalSubmitting(true, '保存中…');
        try {
          const order = await this.api(`/video-delivery-clients/${id}/orders`, {
            method: 'POST',
            body: JSON.stringify({
              title,
              requirements: reqText,
              serviceVersion: document.querySelector('#modal-form [name="serviceVersion"]')?.value || version,
              status: 'completed',
              settleType,
              pointsCost: Number(quote.pointsCost || 0),
              quantity: Number(quote.quantity || materialIds.length || 1),
              materialIds,
            }),
          });
          const orderId = Number(order?.id || 0);
          if (internalNote && orderId) {
            try {
              await this.api(`/video-delivery-orders/${orderId}/notes`, {
                method: 'POST',
                body: JSON.stringify({ content: internalNote }),
              });
            } catch (_) { /* ignore */ }
          }
          this.toast('提交成功');
        } catch (e) {
          this.setVideoDeliveryModalSubmitting(false);
          throw e;
        }
      }, true, {
        submitText: '提交',
        wide: true,
        // 不打全屏 loading，避免挡住弹框内 GitHub 上传进度
        skipLoading: true,
        onClose: () => {
          document.querySelector('#modal')?.classList.remove('vd-upload-modal');
        },
      });
      document.querySelector('#modal')?.classList.add('vd-upload-modal');
      requestAnimationFrame(() => {
        const box = document.querySelector('#modal-form');
        if (box && window.UI) UI.decorate(box);
        const settle = document.querySelector('#modal-form [name="settleType"]');
        const cost = document.querySelector('#modal-form [name="pointsCost"]');
        settle?.addEventListener('change', () => this.syncVideoDeliveryUploadQuote());
        cost?.addEventListener('input', () => this.syncVideoDeliveryUploadQuote());
        // 素材选择变化时重算（卡片勾选会触发 change/click）
        document.querySelector('#vd-upload-mat-field')?.addEventListener('click', () => {
          setTimeout(() => this.syncVideoDeliveryUploadQuote(), 0);
        });
        this.syncVideoDeliveryUploadQuote();
      });
    },
    async fetchVideoDeliveryOrder(orderId) {
      const pack = await this.api(`/video-delivery-orders/${orderId}`);
      return {
        order: pack?.order || pack || null,
        client: pack?.client || null,
      };
    },
    async openVideoDeliveryOrderDetail(orderId) {
      const id = Number(orderId || 0);
      let order;
      try {
        const pack = await this.fetchVideoDeliveryOrder(id);
        order = pack.order;
      } catch (e) {
        this.toast(e.message, true);
        return;
      }
      if (!order) {
        this.toast('订单不存在', true);
        return;
      }
      const notes = Array.isArray(order.notes) ? order.notes : [];
      const files = Array.isArray(order.files) ? order.files : [];
      const assets = Array.isArray(order.assets) ? order.assets : [];
      const media = assets.length ? assets : files;
      const notesHtml = notes.length
        ? `<div class="vd-detail-notes">${notes.map((n) =>
            `<div class="vd-note-item">
              <span class="vd-note-time">${this.esc((n.createdAt || '').slice(0, 16).replace('T', ' '))}</span>
              <span class="vd-note-author">${this.esc(n.authorName || '')}</span>
              <div class="vd-note-body">${this.esc(n.content || '')}</div>
            </div>`
          ).join('')}</div>`
        : '<div class="muted">暂无内部备注</div>';
      const filesHtml = media.length
        ? `<div class="vd-files-grid">${media.map((f) => {
            const fid = Number(f.fileId || f.id || 0);
            const name = f.name || f.fileName || ('#' + fid);
            const playUrl = this.videoDeliveryGithubPlayUrl(f);
            const nameEnc = encodeURIComponent(String(name || ''));
            const playEnc = encodeURIComponent(playUrl);
            const actions = [];
            if (playUrl) {
              actions.push(`<button class="tiny primary" type="button" onclick="app.previewVideoDeliveryFile(${fid},decodeURIComponent('${nameEnc}'),decodeURIComponent('${playEnc}'))">查看视频</button>`);
              actions.push(`<a class="tiny ghost" href="${this.esc(playUrl)}" target="_blank" rel="noopener">查看链接</a>`);
            } else {
              actions.push(`<button class="tiny ghost" type="button" disabled title="暂无 GitHub/CDN 链接">待上传 GitHub</button>`);
            }
            if (fid) {
              actions.push(`<button class="tiny ghost" type="button" onclick="app.openVideoDeliveryFilesModal(${id})">全部文件</button>`);
            }
            const linkHint = playUrl
              ? `<div class="vd-file-link" title="${this.esc(playUrl)}"><a href="${this.esc(playUrl)}" target="_blank" rel="noopener">${this.esc(playUrl.length > 72 ? (playUrl.slice(0, 72) + '…') : playUrl)}</a></div>`
              : '<div class="vd-file-link muted">暂无 GitHub/CDN 链接</div>';
            return `<div class="vd-file-card">
              <div class="vd-file-card__icon">${f.isVideo ? '▶' : '📄'}</div>
              <div class="vd-file-card__meta">
                <b title="${this.esc(name)}">${this.esc(name)}</b>
                <span class="muted">${this.esc(f.fileName || '')} · ${this.formatFileSize(f.sizeBytes || 0)}${playUrl ? ' · GitHub' : ''}</span>
                ${linkHint}
              </div>
              <div class="vd-file-card__actions">${actions.join('')}</div>
            </div>`;
          }).join('')}</div>`
        : '<div class="muted">暂无交付文件</div>';
      this.modal('交付详情 #' + id, `
        <div class="vd-order-detail">
          <div class="vd-detail-grid">
            <div class="vd-detail-item"><label>标题</label><div>${this.esc(order.title || '-')}</div></div>
            <div class="vd-detail-item"><label>来源</label><div>${this.esc(order.sourceLabel || (order.source === 'customer' ? '客户需求' : '运营交付'))}</div></div>
            <div class="vd-detail-item"><label>需求类型</label><div>${this.esc(order.settleType || '-')}</div></div>
            <div class="vd-detail-item"><label>消耗积分</label><div><b>${Number(order.pointsCost || 0)}</b></div></div>
            <div class="vd-detail-item"><label>状态</label><div>${this.videoDeliveryOrderStatusBadge(order.status, order.statusLabel)}</div></div>
            <div class="vd-detail-item"><label>确认状态</label><div>${this.esc(order.customerConfirmStatusLabel || order.customerConfirmStatus || '-')}</div></div>
            <div class="vd-detail-item"><label>创建时间</label><div>${this.videoDeliveryFmtTime(order.createdAt)}</div></div>
            <div class="vd-detail-item"><label>交付时间</label><div>${this.videoDeliveryFmtTime(order.deliveredAt)}</div></div>
            <div class="vd-detail-item full"><label>视频要求</label><div class="vd-pre">${this.esc(order.requirements || '-')}</div></div>
            <div class="vd-detail-item full"><label>网盘信息</label><div class="vd-pre">${this.esc(order.cloudDriveInfo || '-')}</div></div>
            <div class="vd-detail-item full"><label>交付文件（${media.length}）</label>${filesHtml}</div>
            <div class="vd-detail-item full"><label>内部备注（${notes.length}）</label>${notesHtml}</div>
          </div>
        </div>
      `, async () => {}, false, { hideSubmit: true, wide: true });
    },
    async openVideoDeliveryOrderEdit(orderId) {
      if (!this.canVideoDeliveryWrite()) {
        this.toast('当前角色无权编辑', true);
        return;
      }
      if (typeof this.materialPickerFieldHtml !== 'function') {
        this.toast('素材选择组件未加载，请刷新后重试', true);
        return;
      }
      const id = Number(orderId || 0);
      let order;
      let client;
      try {
        const pack = await this.fetchVideoDeliveryOrder(id);
        order = pack.order;
        client = pack.client;
      } catch (e) {
        this.toast(e.message, true);
        return;
      }
      if (!order) {
        this.toast('订单不存在', true);
        return;
      }
      this._vdUploadBalance = Number(client?.points ?? this.videoDeliveryDetailHead?.points ?? 0);
      const types = await this.loadVideoDeliverySettleTypes();
      const curCode = String(order.settleTypeCode || '');
      const settleOpts = [
        `<option value="" disabled>请选择结算视频类型</option>`,
        ...types.map((t) => {
          const price = t.priced ? `${Number(t.unitPrice)} ${t.unit || ''}`.trim() : '手工计价';
          const sel = t.code === curCode ? ' selected' : '';
          return `<option value="${this.esc(t.code)}"${sel}>${this.esc(t.title)}（${this.esc(price)}）</option>`;
        }),
      ].join('');
      // 历史类型不在启用列表时补一项
      const hasCur = types.some((t) => t.code === curCode);
      const settleOptsFinal = (!hasCur && curCode)
        ? settleOpts + `<option value="${this.esc(curCode)}" selected>${this.esc(order.settleType || curCode)}</option>`
        : settleOpts;
      const statusOpts = ORDER_STATUS_OPTS.filter(([v]) => v !== '').map(([v, lab]) =>
        `<option value="${this.esc(v)}"${String(order.status) === v ? ' selected' : ''}>${this.esc(lab)}</option>`
      ).join('');
      const existingIds = (Array.isArray(order.assets) ? order.assets : [])
        .map((a) => Number(a.materialId || 0))
        .filter(Boolean);
      const matField = this.materialPickerFieldHtml({
        fieldId: 'vd-edit-mat-field',
        name: 'materialIds',
        multiple: true,
        max: 0,
        selectedIds: existingIds,
      });
      const notes = Array.isArray(order.notes) ? order.notes : [];
      const notesPreview = notes.length
        ? `<div class="vd-notes-list vd-edit-notes">${notes.slice(0, 5).map((n) =>
            `<div class="vd-note-item"><span class="vd-note-time">${this.esc((n.createdAt || '').slice(0, 16).replace('T', ' '))}</span>
              <span class="vd-note-author">${this.esc(n.authorName || '')}</span>
              <span class="vd-note-body">${this.esc(n.content || '')}</span></div>`
          ).join('')}</div>`
        : '<div class="muted">暂无备注</div>';
      this.modal('编辑交付 #' + id, `
        <div class="vd-upload-layout vd-upload-layout--stack">
          <div class="vd-upload-form-pane">
            <div class="vd-upload-grid">
              <div class="field">
                <label>视频标题</label>
                <input class="input" name="title" type="text" value="${this.esc(order.title || '')}" required>
              </div>
              <div class="field">
                <label>结算视频类型</label>
                <select class="input" name="settleType" required>${settleOptsFinal}</select>
              </div>
              <div class="field">
                <label>状态</label>
                <select class="input" name="status">${statusOpts}</select>
              </div>
              <div class="field">
                <label>消耗积分 <span class="muted">（余额 <b id="vd-upload-balance">${Number(this._vdUploadBalance || 0)}</b>）</span></label>
                <input class="input" name="pointsCost" type="number" min="0" step="1" value="${Number(order.pointsCost || 0)}">
                <div class="form-hint" id="vd-upload-cost-hint">按类型自动计价；手工类型可改</div>
              </div>
              <div class="field full">
                <label>视频要求 / 交付说明</label>
                <div class="vd-pre vd-readonly">${this.esc(order.requirements || '-')}</div>
              </div>
              <div class="field full">
                <label>网盘信息</label>
                <div class="vd-pre vd-readonly">${this.esc(order.cloudDriveInfo || '-')}</div>
              </div>
              <div class="field full">
                <label>追加内部备注</label>
                <textarea class="input" name="internalNote" rows="2" placeholder="可填写本次编辑备注（可选）"></textarea>
                ${notesPreview}
              </div>
            </div>
          </div>
          <div class="vd-upload-files-pane">
            <div class="vd-upload-files-head">
              <b>交付视频</b>
              <span class="muted">可增选视频素材；保存前依次上传到 GitHub（已有链接跳过），全部完成后才可保存。积分在客户确认时扣除</span>
            </div>
            ${matField}
            <div id="vd-upload-submit-block" class="vd-upload-submit-block hidden" aria-live="polite"></div>
          </div>
        </div>
      `, async () => {
        const title = document.querySelector('#modal-form [name="title"]')?.value?.trim() || '';
        if (!title) {
          this.toast('请填写视频标题', true);
          throw new Error('请填写视频标题');
        }
        const settleType = document.querySelector('#modal-form [name="settleType"]')?.value?.trim() || '';
        if (!settleType) {
          this.toast('请选择结算视频类型', true);
          throw new Error('请选择结算视频类型');
        }
        const status = document.querySelector('#modal-form [name="status"]')?.value || order.status || 'pending';
        const materialIds = typeof this.selectedMaterialPickerIds === 'function'
          ? this.selectedMaterialPickerIds('vd-edit-mat-field')
          : [];
        const quote = this.syncVideoDeliveryUploadQuote();
        if (materialIds.length) {
          try {
            await this.ensureVideoDeliveryGithubUploads(materialIds);
          } catch (e) {
            this.toast(e.message || 'GitHub 上传失败，无法保存', true);
            throw e;
          }
        }
        this.setVideoDeliveryModalSubmitting(true, '保存中…');
        try {
          await this.api(`/video-delivery-orders/${id}`, {
            method: 'PUT',
            body: JSON.stringify({
              title,
              settleType,
              status,
              pointsCost: Number(document.querySelector('#modal-form [name="pointsCost"]')?.value || quote.pointsCost || 0),
              quantity: Number(quote.quantity || Math.max(1, materialIds.length || 1)),
              materialIds,
              internalNote: document.querySelector('#modal-form [name="internalNote"]')?.value?.trim() || '',
            }),
          });
          this.toast('已保存');
        } catch (e) {
          this.setVideoDeliveryModalSubmitting(false);
          throw e;
        }
      }, true, {
        submitText: '保存',
        wide: true,
        // 不打全屏 loading，避免挡住弹框内 GitHub 上传进度
        skipLoading: true,
        onClose: () => {
          if (this._vdQuoteFnBackup) {
            this.syncVideoDeliveryUploadQuote = this._vdQuoteFnBackup;
            this._vdQuoteFnBackup = null;
          }
          document.querySelector('#modal')?.classList.remove('vd-upload-modal');
        },
      });
      document.querySelector('#modal')?.classList.add('vd-upload-modal');
      requestAnimationFrame(() => {
        const box = document.querySelector('#modal-form');
        if (box && window.UI) UI.decorate(box);
        const prevStatus = String(order.status || '');
        this._vdQuoteFnBackup = this.syncVideoDeliveryUploadQuote.bind(this);
        const runQuote = () => {
          const sel = document.querySelector('#modal-form [name="settleType"]');
          const costEl = document.querySelector('#modal-form [name="pointsCost"]');
          const hint = document.querySelector('#vd-upload-cost-hint');
          const balEl = document.querySelector('#vd-upload-balance');
          const submitBtn = document.querySelector('#modal .modal-foot button[type=submit]');
          const type = this.findVideoDeliverySettleType(sel?.value || '');
          const materialIds = typeof this.selectedMaterialPickerIds === 'function'
            ? this.selectedMaterialPickerIds('vd-edit-mat-field')
            : [];
          const qty = Math.max(1, materialIds.length || 1);
          const balance = Number(this._vdUploadBalance || 0);
          if (balEl) balEl.textContent = String(balance);
          let pointsCost = 0;
          let manual = true;
          if (type && type.priced) {
            const unit = Number(type.unitPrice || 0);
            pointsCost = type.perItem ? unit * qty : unit;
            if (costEl) {
              costEl.value = String(pointsCost);
              costEl.readOnly = true;
            }
            if (hint) {
              hint.classList.remove('is-danger');
              hint.textContent = type.perItem
                ? `单价 ${unit} × ${qty} = ${pointsCost}`
                : `固定 ${pointsCost}`;
            }
            manual = false;
          } else {
            pointsCost = Math.max(0, Number(costEl?.value || 0));
            if (costEl) costEl.readOnly = false;
            if (hint) {
              hint.classList.remove('is-danger');
              hint.textContent = type ? '该类型需手工填写消耗积分' : '可手工填写积分';
            }
          }
          const insufficient = pointsCost > balance;
          if (insufficient && hint) {
            hint.textContent = `余额偏低：需 ${pointsCost}，余额 ${balance}（客户确认时扣积分）`;
            hint.classList.add('is-danger');
          }
          if (submitBtn) submitBtn.disabled = false;
          this.setVideoDeliveryUploadBlockReason(
            `可保存：预计 ${pointsCost} 积分，客户确认后扣除（余额 ${balance}）`,
            false
          );
          return { pointsCost, ok: true, quantity: qty, manual };
        };
        this.syncVideoDeliveryUploadQuote = runQuote;
        document.querySelector('#modal-form [name="settleType"]')?.addEventListener('change', runQuote);
        document.querySelector('#modal-form [name="pointsCost"]')?.addEventListener('input', runQuote);
        document.querySelector('#modal-form [name="status"]')?.addEventListener('change', runQuote);
        document.querySelector('#vd-edit-mat-field')?.addEventListener('click', () => setTimeout(runQuote, 0));
        runQuote();
      });
    },
    async openVideoDeliveryFilesModal(orderId) {
      const id = Number(orderId || 0);
      let pack;
      try {
        pack = await this.api(`/video-delivery-orders/${id}/files`);
      } catch (e) {
        this.toast(e.message, true);
        return;
      }
      const files = pack.files || [];
      const title = pack.title || ('订单 #' + id);
      const body = files.length
        ? `<div class="vd-files-modal">
            <div class="vd-files-modal__head">
              <b>${this.esc(title)}</b>
              <span class="muted">共 ${files.length} 个交付文件</span>
            </div>
            <div class="vd-files-grid">${files.map((f) => {
              const isVideo = !!f.isVideo;
              const playUrl = this.videoDeliveryGithubPlayUrl(f);
              const downloadUrl = playUrl || this.videoDeliveryApiFileUrl(f.id, 'download');
              const nameEnc = encodeURIComponent(String(f.name || ''));
              const playEnc = encodeURIComponent(playUrl);
              const previewBtn = playUrl
                ? (isVideo
                  ? `<button class="tiny primary" type="button" onclick="app.previewVideoDeliveryFile(${Number(f.id)},decodeURIComponent('${nameEnc}'),decodeURIComponent('${playEnc}'))">查看视频</button>`
                  : `<a class="tiny primary" href="${this.esc(playUrl)}" target="_blank" rel="noopener">查看文件</a>`)
                : `<button class="tiny ghost" type="button" disabled title="暂无 GitHub/CDN 链接">待上传 GitHub</button>`;
              return `<div class="vd-file-card">
                <div class="vd-file-card__icon">${isVideo ? '▶' : '📄'}</div>
                <div class="vd-file-card__meta">
                  <b title="${this.esc(f.name)}">${this.esc(f.name)}</b>
                  <span class="muted">${this.esc(f.fileName || '')} · ${this.formatFileSize(f.sizeBytes || 0)}${playUrl ? ' · GitHub' : ''}</span>
                  ${playUrl
                    ? `<div class="vd-file-link" title="${this.esc(playUrl)}"><a href="${this.esc(playUrl)}" target="_blank" rel="noopener">${this.esc(playUrl.length > 72 ? (playUrl.slice(0, 72) + '…') : playUrl)}</a></div>`
                    : '<div class="vd-file-link muted">暂无 GitHub/CDN 链接</div>'}
                </div>
                <div class="vd-file-card__actions">
                  ${previewBtn}
                  ${playUrl
                    ? `<a class="tiny ghost" href="${this.esc(playUrl)}" target="_blank" rel="noopener">查看链接</a>`
                    : ''}
                  <a class="tiny ghost" href="${this.esc(downloadUrl)}" target="_blank" rel="noopener" onclick="setTimeout(()=>app.refresh(),800)">下载文件</a>
                </div>
              </div>`;
            }).join('')}</div>
          </div>`
        : `<div class="empty">暂无交付文件</div>`;
      this.modal('交付文件', body, async () => {}, false, { hideSubmit: true, wide: true });
    },
    previewVideoDeliveryFile(fileId, name, remoteUrl) {
      const remote = String(remoteUrl || '').trim();
      if (!remote) {
        this.toast('暂无 GitHub/CDN 链接，无法预览', true);
        return;
      }
      this.modal(name || '查看视频', `
        <div class="vd-preview-wrap">
          <video class="vd-preview-video" controls autoplay src="${this.esc(remote)}"></video>
        </div>
      `, async () => {}, false, { hideSubmit: true, wide: true });
    },
    async openVideoDeliveryDownloadRecords(orderId) {
      const id = Number(orderId || 0);
      let pack;
      try {
        pack = await this.api(`/video-delivery-orders/${id}/downloads`);
      } catch (e) {
        this.toast(e.message, true);
        return;
      }
      const items = pack.items || [];
      const body = items.length
        ? `<div class="vd-dl-modal"><table class="ind-table"><thead><tr><th>时间</th><th>操作人</th><th>文件ID</th></tr></thead>
            <tbody>${items.map((r) => `<tr>
              <td>${this.videoDeliveryFmtTime(r.createdAt)}</td>
              <td>${this.esc(r.operatorName || '-')}</td>
              <td>${r.fileId ? '#' + r.fileId : '-'}</td>
            </tr>`).join('')}</tbody></table></div>`
        : `<div class="empty">暂无下载记录（累计 ${Number(pack.downloadCount || 0)} 次）</div>`;
      this.modal('下载记录', body, async () => {}, false, { hideSubmit: true, wide: true });
    },
  };

  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages.videoDelivery = true;
})();
