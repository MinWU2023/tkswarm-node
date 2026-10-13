(function () {
  if (!window.app) throw new Error('app-core must load before pages/msgTemplates.js');

  const TYPE_META = {
    comment: { label: '评论', desc: '视频下发布的评论文案', tone: 'coral', icon: '💬' },
    comment_reply: { label: '回复评论', desc: '回复他人评论的文案', tone: 'amber', icon: '↩️' },
    dm: { label: '私信', desc: '主动发送的私信开场', tone: 'sky', icon: '✉️' },
    dm_reply: { label: '回复私信', desc: '回复对方私信的文案', tone: 'mint', icon: '💭' },
  };

  const MODE_META = {
    fixed: { label: '固定文案', hint: '直接发送的写死文案' },
    ai: { label: 'AI 提示词', hint: '请求 AI 接口生成正文时使用' },
  };

  const __methods = {
    canMsgTemplates() {
      return this.canPermission('account.msg_template')
        || this.canPermission('account.create')
        || this.canPermission('publish.tasks')
        || this.canPermission('chat.manage')
        || this.canPermission('account.view');
    },
    canEditMsgTemplates() {
      return this.canPermission('account.msg_template')
        || this.canPermission('account.create')
        || this.canPermission('publish.tasks')
        || this.canPermission('chat.manage')
        || this.canPermission('rbac.manage');
    },
    async renderMsgTemplates() {
      const host = document.querySelector('#content');
      if (!host) return;
      if (!this.canMsgTemplates()) {
        host.innerHTML = `<div class="panel"><div class="empty">当前角色无权查看消息模板</div></div>`;
        return;
      }
      const type = this.msgTplType || 'comment';
      const kw = this.msgTplKeyword || '';
      try {
        const pack = await this.api(`/interaction-templates?type=${encodeURIComponent(type)}&keyword=${encodeURIComponent(kw)}`);
        const items = pack.items || [];
        const types = pack.types || Object.keys(TYPE_META).map((code) => ({ code, label: TYPE_META[code].label }));
        const counts = pack.counts || {};
        this._msgTplTypes = types;
        const canEdit = this.canEditMsgTemplates();
        const meta = TYPE_META[type] || { label: type, desc: '', tone: 'sky', icon: '📝' };

        host.innerHTML = `
          <div class="msg-tpl-page">
            <section class="msg-tpl-hero msg-tpl-tone-${meta.tone}">
              <div class="msg-tpl-hero-copy">
                <p class="msg-tpl-kicker">Interaction Copy · AI Prompt</p>
                <h2>消息模板</h2>
                <p class="msg-tpl-lead">每种场景下，<strong>一条模板只选一种内容</strong>：固定文案，或 AI 提示词。需要两种就建两条。</p>
              </div>
              <div class="msg-tpl-hero-actions">
                ${canEdit ? `<button class="primary" type="button" onclick="app.editMsgTemplate()">＋ 新建模板</button>` : ''}
                <button class="ghost" type="button" onclick="app.refresh()">刷新</button>
              </div>
            </section>

            <nav class="msg-tpl-tabs" role="tablist">
              ${types.map((t) => {
                const m = TYPE_META[t.code] || { label: t.label, icon: '📝', tone: 'sky' };
                const on = type === t.code;
                const n = Number(counts[t.code] || 0);
                return `<button type="button" class="msg-tpl-tab ${on ? 'is-on' : ''} msg-tpl-tone-${m.tone}" onclick="app.switchMsgTplType('${this.esc(t.code)}')">
                  <span class="msg-tpl-tab-ico">${m.icon}</span>
                  <span class="msg-tpl-tab-text"><b>${this.esc(m.label || t.label)}</b><small>${n} 条</small></span>
                </button>`;
              }).join('')}
            </nav>

            <div class="msg-tpl-toolbar">
              <div class="msg-tpl-type-hint">
                <span class="msg-tpl-dot msg-tpl-tone-${meta.tone}"></span>
                <div><b>${this.esc(meta.label)}</b><span class="muted"> · ${this.esc(meta.desc)}</span></div>
              </div>
            </div>
            <div class="msg-tpl-search search-bar task-filter-bar">
              <input id="msg-tpl-search" class="input" type="search" placeholder="搜索名称 / 内容" value="${this.esc(kw)}" onkeydown="if(event.key==='Enter')app.searchMsgTemplates()">
              <button class="primary tiny" type="button" onclick="app.searchMsgTemplates()">查询</button>
              <button class="ghost tiny" type="button" onclick="app.resetMsgTplFilters()">重置</button>
            </div>

            <div class="msg-tpl-grid">
              ${items.length ? items.map((t) => this.msgTplCardHtml(t, canEdit)).join('') : `
                <div class="msg-tpl-empty">
                  <div class="msg-tpl-empty-ico">${meta.icon}</div>
                  <h3>暂无「${this.esc(meta.label)}」模板</h3>
                  <p class="muted">创建固定文案模板，或单独创建一条 AI 提示词模板。</p>
                  ${canEdit ? `<button class="primary" type="button" onclick="app.editMsgTemplate()">创建第一条</button>` : ''}
                </div>`}
            </div>
          </div>`;
      } catch (err) {
        host.innerHTML = `<div class="panel"><div class="empty">加载失败：${this.esc(err.message)}</div></div>`;
      }
    },
    msgTplCardHtml(t, canEdit) {
      const m = TYPE_META[t.type] || { tone: 'sky', label: t.typeLabel || t.type };
      const mode = (t.contentMode === 'ai' || t.contentMode === 'fixed')
        ? t.contentMode
        : (String(t.aiPrompt || '').trim() && !String(t.fixedText || '').trim() ? 'ai' : 'fixed');
      const modeMeta = MODE_META[mode] || MODE_META.fixed;
      const content = String(t.content || (mode === 'ai' ? t.aiPrompt : t.fixedText) || '').trim();
      return `<article class="msg-tpl-card msg-tpl-tone-${m.tone}">
        <header class="msg-tpl-card-head">
          <div>
            <h3>${this.esc(t.name || '未命名')}</h3>
            <div class="msg-tpl-card-meta">
              <span class="msg-tpl-pill">${this.esc(t.typeLabel || m.label)}</span>
              <span class="msg-tpl-pill ${mode === 'ai' ? 'is-ai' : 'is-fixed'}">${this.esc(modeMeta.label)}</span>
              ${t.isBuiltin ? '<span class="msg-tpl-pill is-builtin">内置</span>' : ''}
              <span class="msg-tpl-pill ${t.enabled ? 'is-on' : 'is-off'}">${t.enabled ? '启用' : '停用'}</span>
            </div>
          </div>
          <div class="msg-tpl-card-ops">
            ${canEdit ? `
              <button class="tiny" type="button" onclick='app.editMsgTemplate(${JSON.stringify(t)})'>编辑</button>
              <button class="tiny" type="button" onclick="app.toggleMsgTemplate(${t.id},${t.enabled ? 0 : 1})">${t.enabled ? '停用' : '启用'}</button>
              ${!t.isBuiltin ? `<button class="tiny danger" type="button" onclick="app.deleteMsgTemplate(${t.id},'${this.esc(t.name)}')">删除</button>` : ''}
            ` : '<span class="muted">只读</span>'}
          </div>
        </header>
        <div class="msg-tpl-fields">
          <div class="msg-tpl-field">
            <div class="msg-tpl-field-label">
              <span>${this.esc(modeMeta.label)}</span>
              ${content ? `<button class="tiny ghost" type="button" onclick='app.copyText(${JSON.stringify(content)})'>复制</button>` : ''}
            </div>
            <pre class="msg-tpl-pre ${mode === 'ai' ? 'is-prompt' : 'is-fixed'}">${content ? this.esc(content) : '<span class="muted">（未填写）</span>'}</pre>
          </div>
        </div>
        <footer class="msg-tpl-card-foot muted">更新于 ${this.esc(t.updatedAt || '-')}</footer>
      </article>`;
    },
    switchMsgTplType(type) {
      this.msgTplType = type || 'comment';
      this.msgTplKeyword = '';
      this.refresh();
    },
    searchMsgTemplates() {
      this.msgTplKeyword = document.querySelector('#msg-tpl-search')?.value?.trim() || '';
      this.refresh();
    },
    resetMsgTplFilters() {
      this.msgTplKeyword = '';
      this.refresh();
    },
    setMsgTplContentMode(mode) {
      const m = mode === 'ai' ? 'ai' : 'fixed';
      document.querySelectorAll('input[name=contentMode]').forEach((el) => { el.checked = el.value === m; });
      const tip = document.querySelector('#msg-tpl-content-tip');
      const ta = document.querySelector('#msg-tpl-content');
      if (tip) tip.textContent = MODE_META[m].hint;
      if (ta) {
        ta.placeholder = m === 'ai'
          ? '描述角色、输出格式、变量占位如 {{nickname}}'
          : '例如：很棒的视频，点赞';
        ta.rows = m === 'ai' ? 8 : 4;
      }
      const vars = document.querySelector('#msg-tpl-vars-tip');
      if (vars) vars.hidden = m !== 'ai';
    },
    editMsgTemplate(t = null) {
      if (!this.canEditMsgTemplates()) {
        this.toast('当前角色无权维护消息模板', true);
        return;
      }
      const isEdit = !!(t && t.id);
      const curType = (t && t.type) || this.msgTplType || 'comment';
      let curMode = t?.contentMode;
      if (curMode !== 'fixed' && curMode !== 'ai') {
        curMode = (String(t?.aiPrompt || '').trim() && !String(t?.fixedText || '').trim()) ? 'ai' : 'fixed';
      }
      const curContent = String(t?.content || (curMode === 'ai' ? t?.aiPrompt : t?.fixedText) || '');
      const typeOpts = Object.keys(TYPE_META).map((code) => [code, TYPE_META[code].label]);
      this.modal(isEdit ? '编辑消息模板' : '新建消息模板', `
        <div class="msg-tpl-form">
          <input type="hidden" name="id" value="${t?.id || ''}">
          <div class="form-grid">
            ${this.selectRaw('type', '场景类型', typeOpts, curType)}
            ${this.field('name', '模板名称', t?.name || '', 'text', true)}
            ${this.selectRaw('enabled', '状态', [['true', '启用'], ['false', '停用']], t?.enabled === false || t?.enabled === 0 ? 'false' : 'true')}
            ${this.field('sortOrder', '排序（越小越靠前）', t?.sortOrder ?? 0, 'number')}
          </div>
          <div class="msg-tpl-form-block">
            <label><b>内容类型</b><span class="muted">一条模板只能选一种</span></label>
            <div class="msg-tpl-mode-pick" role="radiogroup">
              <label class="msg-tpl-mode-opt"><input type="radio" name="contentMode" value="fixed" ${curMode === 'fixed' ? 'checked' : ''} onchange="app.setMsgTplContentMode('fixed')"> 固定文案</label>
              <label class="msg-tpl-mode-opt"><input type="radio" name="contentMode" value="ai" ${curMode === 'ai' ? 'checked' : ''} onchange="app.setMsgTplContentMode('ai')"> AI 提示词</label>
            </div>
          </div>
          <div class="msg-tpl-form-block ${curMode === 'ai' ? 'is-ai' : ''}">
            <label><b>内容</b><span class="muted" id="msg-tpl-content-tip">${this.esc(MODE_META[curMode].hint)}</span></label>
            <textarea class="input" id="msg-tpl-content" name="content" rows="${curMode === 'ai' ? 8 : 4}" placeholder="${curMode === 'ai' ? '描述角色、输出格式、变量占位如 {{nickname}}' : '例如：很棒的视频，点赞'}">${this.esc(curContent)}</textarea>
            <p class="msg-tpl-form-tip" id="msg-tpl-vars-tip" ${curMode === 'ai' ? '' : 'hidden'}>可用占位：<code>{{video_desc}}</code> <code>{{author}}</code> <code>{{comment_text}}</code> <code>{{nickname}}</code> <code>{{message_text}}</code> <code>{{bio}}</code></p>
          </div>
        </div>
      `, async (d) => {
        const id = d.id;
        const contentMode = (d.contentMode === 'ai') ? 'ai' : 'fixed';
        const body = {
          type: d.type,
          name: d.name,
          contentMode,
          content: d.content || '',
          enabled: d.enabled === 'true' || d.enabled === true,
          sortOrder: Number(d.sortOrder || 0),
        };
        if (!body.name?.trim()) {
          this.toast('请填写模板名称', true);
          return;
        }
        if (!String(body.content).trim()) {
          this.toast(contentMode === 'ai' ? '请填写 AI 提示词' : '请填写固定文案', true);
          return;
        }
        await this.api(id ? `/interaction-templates/${id}` : '/interaction-templates', {
          method: id ? 'PUT' : 'POST',
          body: JSON.stringify(body),
        });
        this.toast(id ? '消息模板已更新' : '消息模板已创建');
        this.closeModal();
        this.msgTplType = body.type;
        this.refresh();
      }, false, { wide: true });
    },
    async toggleMsgTemplate(id, enabled) {
      if (!this.canEditMsgTemplates()) {
        this.toast('无权操作', true);
        return;
      }
      try {
        await this.api(`/interaction-templates/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ enabled: !!enabled }),
        });
        this.toast(enabled ? '已启用' : '已停用');
        this.refresh();
      } catch (e) {
        this.toast(e.message, true);
      }
    },
    async deleteMsgTemplate(id, name) {
      if (!this.canEditMsgTemplates()) {
        this.toast('无权删除', true);
        return;
      }
      if (!(await this.ask(`确定删除模板「${name || id}」吗？`))) return;
      try {
        await this.api(`/interaction-templates/${id}`, { method: 'DELETE' });
        this.toast('已删除');
        this.refresh();
      } catch (e) {
        this.toast(e.message, true);
      }
    },
  };

  Object.assign(window.app, __methods);
  window.AppPages = window.AppPages || {};
  window.AppPages.msgTemplates = true;
})();
