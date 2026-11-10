(function () {
  if (!window.app) throw new Error('app-core must load before pages/videoDeliveryTypes.js');

  const UNIT_OPTS = [
    '',
    '积分 / 张',
    '积分 / 条',
    '积分 / 次',
    '积分 / 套',
    '积分/10秒',
  ];

  const __methods = {
    canManageVideoDeliveryTypes() {
      if (!this.authEnabled) return true;
      return typeof this.canLoginPermission === 'function'
        ? this.canLoginPermission('system.video_delivery_types')
        : (!!this.authIsSuper || Number(this.authLoginUser?.roleId || this.authLoginUser?.role_id || 0) === 1);
    },
    videoDeliveryTypeFormHtml(row = {}, guideGroups = []) {
      const v = (k, d = '') => this.esc(String(row[k] ?? d));
      const groups = Array.isArray(guideGroups) ? guideGroups : [];
      const groupOpts = [
        `<option value="">无分组</option>`,
        ...groups.map((g) => {
          const code = String(g.code || '');
          const sel = String(row.guideGroup || '') === code ? ' selected' : '';
          return `<option value="${this.esc(code)}"${sel}>${this.esc(g.label || code)}</option>`;
        }),
      ].join('');
      const unitOpts = UNIT_OPTS.map((u) => {
        const sel = String(row.unit || '') === u ? ' selected' : '';
        return `<option value="${this.esc(u)}"${sel}>${u ? this.esc(u) : '无（手工填积分）'}</option>`;
      }).join('');
      const pricedHint = row.points == null || row.points === ''
        ? '留空表示「其他/交付」等手工计价类型'
        : `配置分 ${Number(row.points || 0)} × 倍率 = 实际单价`;
      return `
        <div class="form-grid">
          <div class="field"><label>类型编码 *</label>
            <input class="input" name="code" value="${v('code')}" placeholder="英文 key，如 cover" ${row.id ? 'readonly' : 'required'}>
            <div class="form-hint">稳定英文 key，写入订单 settle_type；创建后不可改</div>
          </div>
          <div class="field"><label>排序</label>
            <input class="input" name="sortOrder" type="number" min="0" value="${Number(row.sortOrder || 0)}">
          </div>
          <div class="field full"><label>标题 *</label>
            <input class="input" name="title" value="${v('title')}" required placeholder="展示标题">
          </div>
          <div class="field full"><label>结算标题</label>
            <input class="input" name="settlementTitle" value="${v('settlementTitle', row.title || '')}" placeholder="结算单显示名，默认同标题">
          </div>
          <div class="field full"><label>说明</label>
            <textarea class="input" name="description" rows="2" placeholder="客户侧积分说明文案">${v('description')}</textarea>
          </div>
          <div class="field"><label>配置分（× 倍率）</label>
            <input class="input" name="points" type="number" min="0" step="1" value="${row.points == null || row.points === '' ? '' : Number(row.points)}" placeholder="留空=手工积分">
            <div class="form-hint">${this.esc(pricedHint)}</div>
          </div>
          <div class="field"><label>计价单位</label>
            <select class="input" name="unit">${unitOpts}</select>
          </div>
          <div class="field"><label>说明分组</label>
            <select class="input" name="guideGroup">${groupOpts}</select>
          </div>
          <div class="field"><label>启用</label>
            <select class="input" name="enabled">
              <option value="1"${row.enabled === false ? '' : ' selected'}>启用</option>
              <option value="0"${row.enabled === false ? ' selected' : ''}>停用</option>
            </select>
          </div>
        </div>`;
    },
    async renderVideoDeliveryTypes() {
      const host = document.querySelector('#content');
      if (!host) return;
      document.querySelector('#content')?.classList.remove('chat-mode');
      if (!this.canManageVideoDeliveryTypes()) {
        host.innerHTML = `<div class="panel"><div class="empty">当前账号无权访问视频交付类型（需要权限节点：system.video_delivery_types）</div></div>`;
        return;
      }
      try {
        const pack = await this.api('/video-delivery-types');
        const items = Array.isArray(pack?.items) ? pack.items : [];
        const mul = Number(pack?.pointsMultiplier || 50);
        this._vdTypeItems = items;
        this._vdTypeGuideGroups = Array.isArray(pack?.guideGroups) ? pack.guideGroups : [];
        this._vdTypeMultiplier = mul;
        const groupLabel = (code) => {
          const hit = (this._vdTypeGuideGroups || []).find((g) => g.code === code);
          return hit ? hit.label : (code || '-');
        };
        const rows = items.map((r) => {
          const unitPrice = r.unitPrice == null ? null : Number(r.unitPrice);
          const pointsCell = unitPrice == null
            ? `<span class="muted">手工</span>`
            : `<b>${unitPrice}</b><div class="muted" style="font-size:12px">配置 ${Number(r.points || 0)} × ${mul}</div>`;
          return `
          <tr>
            <td>${r.id}</td>
            <td><code>${this.esc(r.code)}</code></td>
            <td>${this.esc(r.title)}<div class="muted" style="font-size:12px">${this.esc(r.settlementTitle || '')}</div></td>
            <td>${pointsCell}</td>
            <td>${this.esc(r.unit || '-')}</td>
            <td>${this.esc(groupLabel(r.guideGroup))}</td>
            <td>${Number(r.sortOrder || 0)}</td>
            <td>${r.enabled ? '<span class="badge online">启用</span>' : '<span class="badge offline">停用</span>'}</td>
            <td style="white-space:nowrap">
              <button class="tiny ghost" type="button" onclick="app.editVideoDeliveryType(${r.id})">编辑</button>
              <button class="tiny ghost is-danger" type="button" onclick="app.deleteVideoDeliveryType(${r.id})">删除</button>
            </td>
          </tr>`;
        }).join('');
        host.innerHTML = `
          <div class="panel list-panel">
            <div class="matrix-action-bar">
              <div class="left"><span class="muted">开发管理 · 视频交付类型（实际积分 = 配置分 × 倍率 <b>${mul}</b>）</span></div>
              <div class="right" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                <label class="muted" style="display:flex;align-items:center;gap:6px">
                  积分倍率
                  <input class="input" id="vd-type-mul" type="number" min="1" step="1" value="${mul}" style="width:88px">
                </label>
                <button class="ghost tiny" type="button" onclick="app.saveVideoDeliveryTypeMultiplier()">保存倍率</button>
                <button class="primary tiny" type="button" onclick="app.addVideoDeliveryType()">+ 添加类型</button>
                <button class="ghost tiny" type="button" onclick="app.refresh()">刷新</button>
              </div>
            </div>
            <table class="ai-lead-table">
              <thead><tr>
                <th>ID</th><th>编码</th><th>标题</th><th>实际单价</th><th>单位</th><th>分组</th><th>排序</th><th>状态</th><th>操作</th>
              </tr></thead>
              <tbody>${rows || '<tr><td colspan="9" class="empty">暂无数据</td></tr>'}</tbody>
            </table>
          </div>`;
      } catch (err) {
        host.innerHTML = `<div class="panel"><div class="empty">加载失败：${this.esc(err.message || '')}</div></div>`;
      }
    },
    async saveVideoDeliveryTypeMultiplier() {
      const mul = Number(document.querySelector('#vd-type-mul')?.value || 50);
      if (!Number.isFinite(mul) || mul < 1) {
        this.toast('倍率须 ≥ 1', true);
        return;
      }
      try {
        await this.api('/video-delivery-types/settings', {
          method: 'PUT',
          body: JSON.stringify({ pointsMultiplier: Math.floor(mul) }),
        });
        this.toast('倍率已保存');
        this.refresh();
      } catch (e) {
        this.toast(e.message, true);
      }
    },
    addVideoDeliveryType() {
      this.modal(
        '添加视频交付类型',
        this.videoDeliveryTypeFormHtml({ enabled: true, sortOrder: 0 }, this._vdTypeGuideGroups),
        async (data) => {
          const payload = this.normalizeVideoDeliveryTypeForm(data);
          await this.api('/video-delivery-types', { method: 'POST', body: JSON.stringify(payload) });
          this.closeModal();
          this.toast('已添加');
          this.refresh();
        }
      );
    },
    editVideoDeliveryType(id) {
      const row = (this._vdTypeItems || []).find((r) => Number(r.id) === Number(id));
      if (!row) return;
      this.modal(
        '编辑视频交付类型',
        this.videoDeliveryTypeFormHtml(row, this._vdTypeGuideGroups),
        async (data) => {
          const payload = this.normalizeVideoDeliveryTypeForm(data);
          delete payload.code;
          await this.api('/video-delivery-types/' + id, { method: 'PUT', body: JSON.stringify(payload) });
          this.closeModal();
          this.toast('已保存');
          this.refresh();
        }
      );
    },
    normalizeVideoDeliveryTypeForm(data) {
      const pointsRaw = data.points;
      const points = pointsRaw === '' || pointsRaw == null ? null : Number(pointsRaw);
      return {
        code: String(data.code || '').trim(),
        title: String(data.title || '').trim(),
        settlementTitle: String(data.settlementTitle || '').trim(),
        description: String(data.description || '').trim(),
        points: Number.isFinite(points) ? points : null,
        unit: String(data.unit || '').trim(),
        guideGroup: String(data.guideGroup || '').trim() || null,
        sortOrder: Number(data.sortOrder || 0),
        enabled: String(data.enabled) !== '0',
      };
    },
    async deleteVideoDeliveryType(id) {
      if (!confirm('确认删除该类型？已有订单不受影响，但新上传将无法再选此编码。')) return;
      try {
        await this.api('/video-delivery-types/' + id, { method: 'DELETE' });
        this.toast('已删除');
        this.refresh();
      } catch (e) {
        this.toast(e.message, true);
      }
    },
  };

  Object.assign(window.app, __methods);
})();
