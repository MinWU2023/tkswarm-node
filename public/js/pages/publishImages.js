(() => {
  const MAX_IMAGES = 35;
  const MAX_STYLES = 5;
  const UPLOAD_BATCH = 9;
  // [传给 AI 的英文风格, 显示用中文]
  const MUSIC_STYLES = [
    ['Pop', '流行'], ['Hip-Hop', '嘻哈'], ['Rap', '说唱'], ['R&B', 'R&B'], ['Rock', '摇滚'],
    ['EDM', '电子舞曲'], ['Electronic', '电子'], ['House', 'House'], ['Techno', 'Techno'], ['Trap', 'Trap'],
    ['Phonk', 'Phonk'], ['Lo-fi', 'Lo-fi'], ['Chill', '放松'], ['Ambient', '氛围'], ['Jazz', '爵士'],
    ['Classical', '古典'], ['Piano', '钢琴'], ['Guitar', '吉他'], ['Acoustic', '原声'], ['Folk', '民谣'],
    ['Country', '乡村'], ['Indie', '独立'], ['Latin', '拉丁'], ['Reggaeton', '雷鬼顿'], ['Reggae', '雷鬼'],
    ['K-Pop', '韩流'], ['J-Pop', '日系'], ['Afrobeats', '非洲节拍'], ['Funk', '放克'], ['Soul', '灵魂乐'],
    ['Disco', '迪斯科'], ['Dance', '舞曲'], ['Cinematic', '电影感'], ['Epic', '史诗'], ['Dark', '暗黑'],
    ['Dreamy', '梦幻'], ['Romantic', '浪漫'], ['Sad', '伤感'], ['Happy', '快乐'], ['Upbeat', '欢快'],
    ['Energetic', '热血'], ['Relaxing', '舒缓'], ['Motivational', '励志'], ['Funny', '搞笑'], ['Nostalgic', '怀旧'],
    ['Retro', '复古'], ['Vlog', 'Vlog'], ['Trending', '热门'], ['Instrumental', '纯音乐'], ['Remix', '混音'],
    ['Slowed', '慢速'], ['Sped Up', '加速'],
  ];

  const methods = {
    openImagePublishWizard(opts = {}) {
      this.wizardOpen = false; this.massWizardOpen = false; this.deleteWizardOpen = false; this.commentReplyWizardOpen = false;
      this.pullCommentWizardOpen = false; this.pullVideoListWizardOpen = false;
      this.imageDeleteWizardOpen = false;
      this._imageWizardFiles = [];
      this.imagePublishWizard = {
        accountIds: [],
        name: '',
        title: '',
        description: '',
        keywords: '',
        musicStyles: [],
        saveTraffic: true,
        submitting: false,
      };
      this.imagePublishWizardOpen = true;
      this.matrixTab = 'tasks';
      if (!opts.skipRefresh) this.refresh();
    },

    closeImagePublishWizard() {
      (this._imageWizardFiles || []).forEach((x) => { try { URL.revokeObjectURL(x.preview); } catch (_) { /* ignore */ } });
      this._imageWizardFiles = [];
      this.imagePublishWizardOpen = false;
      this.imagePublishWizard = null;
      this.matrixTab = 'tasks';
      this.refresh();
    },

    imageWizardPreviewsHtml() {
      const list = this._imageWizardFiles || [];
      if (!list.length) return '<div class="muted" style="padding:8px 0">尚未选择图片</div>';
      return list.map((x, i) => `<div style="position:relative;width:96px;height:96px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
        <img src="${x.preview}" alt="" style="width:100%;height:100%;object-fit:cover">
        <span style="position:absolute;left:4px;top:4px;background:rgba(0,0,0,.55);color:#fff;border-radius:4px;padding:0 5px;font-size:11px">${i + 1}</span>
        <button type="button" title="移除" onclick="app.removeImageWizardFile(${i})" style="position:absolute;right:2px;top:2px;border:0;border-radius:50%;width:20px;height:20px;line-height:18px;cursor:pointer;background:rgba(0,0,0,.6);color:#fff">×</button>
      </div>`).join('');
    },

    refreshImageWizardMeta() {
      const w = this.imagePublishWizard;
      const box = document.querySelector('#iw-previews');
      if (box) box.innerHTML = this.imageWizardPreviewsHtml();
      const c = document.querySelector('#iw-image-count');
      if (c) c.textContent = String((this._imageWizardFiles || []).length);
      const s = document.querySelector('#iw-style-count');
      if (s) s.textContent = String((w?.musicStyles || []).length);
    },

    onImageWizardFiles(input) {
      const picked = [...(input?.files || [])];
      if (input) input.value = '';
      if (!picked.length) return;
      const list = this._imageWizardFiles || (this._imageWizardFiles = []);
      let skipped = 0;
      for (const f of picked) {
        if (!/^image\//i.test(f.type || '') || !/\.(png|jpe?g|webp|gif)$/i.test(f.name || '')) { skipped += 1; continue; }
        if (f.size > 20 * 1024 * 1024) { skipped += 1; continue; }
        if (list.some((x) => x.file.name === f.name && x.file.size === f.size && x.file.lastModified === f.lastModified)) continue;
        if (list.length >= MAX_IMAGES) { this.toast(`图片最多 ${MAX_IMAGES} 张，多余的已忽略`, true); break; }
        list.push({ file: f, preview: URL.createObjectURL(f) });
      }
      if (skipped) this.toast(`已跳过 ${skipped} 个不支持或超过 20MB 的文件`, true);
      this.refreshImageWizardMeta();
    },

    removeImageWizardFile(i) {
      const list = this._imageWizardFiles || [];
      const [gone] = list.splice(Number(i), 1);
      if (gone) { try { URL.revokeObjectURL(gone.preview); } catch (_) { /* ignore */ } }
      this.refreshImageWizardMeta();
    },

    clearImageWizardFiles() {
      (this._imageWizardFiles || []).forEach((x) => { try { URL.revokeObjectURL(x.preview); } catch (_) { /* ignore */ } });
      this._imageWizardFiles = [];
      this.refreshImageWizardMeta();
    },

    syncImageWizardField(key, value) {
      if (!this.imagePublishWizard) return;
      this.imagePublishWizard[key] = value;
    },

    toggleImageMusicStyle(el) {
      const w = this.imagePublishWizard;
      if (!w || !el) return;
      const val = el.getAttribute('data-style');
      const cur = new Set(w.musicStyles || []);
      if (cur.has(val)) cur.delete(val);
      else {
        if (cur.size >= MAX_STYLES) { this.toast(`音乐风格最多选 ${MAX_STYLES} 个`, true); return; }
        cur.add(val);
      }
      w.musicStyles = [...cur];
      document.querySelectorAll('#iw-styles .iw-style-tag').forEach((n) => {
        n.classList.toggle('is-on', cur.has(n.getAttribute('data-style')));
      });
      this.refreshImageWizardMeta();
    },

    pickImageWizardAccount(el) {
      if (!el || el.classList.contains('is-filtered-out')) return;
      const was = el.classList.contains('is-on');
      document.querySelectorAll('#iw-accounts .account-pick-tag.is-on').forEach((n) => n.classList.remove('is-on'));
      if (!was) el.classList.add('is-on');
      this.syncImageWizardAccount();
    },

    syncImageWizardAccount() {
      const ids = (this.selectedAccountPickIds?.('iw-accounts')
        || [...document.querySelectorAll('#iw-accounts .account-pick-tag.is-on')].map((n) => Number(n.getAttribute('data-id'))).filter(Boolean)).slice(0, 1);
      if (this.imagePublishWizard) this.imagePublishWizard.accountIds = ids;
      const el = document.querySelector('#iw-account-hint');
      if (el) el.textContent = ids.length ? `已选账号 #${ids[0]}` : '尚未选择账号（只能选 1 个）';
    },

    imagePublishWizardPanel() {
      const w = this.imagePublishWizard || {};
      const on = new Set(w.musicStyles || []);
      const styleTags = MUSIC_STYLES.map(([v, cn]) => `<button type="button" class="tiny iw-style-tag ${on.has(v) ? 'is-on' : ''}" data-style="${this.esc(v)}" onclick="app.toggleImageMusicStyle(this)" style="margin:3px;padding:4px 10px;border-radius:14px;border:1px solid #d1d5db;cursor:pointer">${this.esc(v)}${v === cn ? '' : ' · ' + this.esc(cn)}</button>`).join('');
      return `<div class="wizard image-publish-wizard">
        <style>.iw-style-tag.is-on{background:#2563eb;color:#fff;border-color:#2563eb}</style>
        <div class="pc-hero pc-hero-form">
          <div>
            <div class="pc-kicker">图片向导</div>
            <h2>发布图片</h2>
            <p>独立发布：选 1 个账号，批量选择本地图片（最多 ${MAX_IMAGES} 张），填写标题、描述、关键词，并勾选音乐风格，由 AI 从 TikTok 音乐列表中挑选最合适的一首。</p>
          </div>
          <button class="ghost" type="button" onclick="app.closeImagePublishWizard()">返回列表</button>
        </div>
        <div class="form-grid" style="padding:16px">
          <div class="field full"><label>任务名称（可选，留空自动生成）</label>
            <input class="input" type="text" value="${this.esc(w.name || '')}" oninput="app.syncImageWizardField('name',this.value)"></div>
          <div class="field full"><label>发布账号（单选）</label>
            <div id="iw-accounts" class="account-pick-grid" style="max-height:300px;overflow:auto;border:1px solid #e5e7eb;border-radius:8px;padding:8px"></div>
            <div class="muted" id="iw-account-hint" style="margin-top:6px">尚未选择账号（只能选 1 个）</div></div>
          <div class="field full"><label>本地图片（已选 <b id="iw-image-count">${(this._imageWizardFiles || []).length}</b> / ${MAX_IMAGES}，单张 ≤20MB，支持 JPG/PNG/WEBP）</label>
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
              <input type="file" id="iw-file-input" accept="image/png,image/jpeg,image/webp" multiple style="display:none" onchange="app.onImageWizardFiles(this)">
              <button class="primary tiny" type="button" onclick="document.querySelector('#iw-file-input').click()">选择图片</button>
              <button class="ghost tiny" type="button" onclick="app.clearImageWizardFiles()">清空</button>
            </div>
            <div id="iw-previews" style="display:flex;flex-wrap:wrap;gap:8px">${this.imageWizardPreviewsHtml()}</div></div>
          <div class="field full"><label>发布标题</label>
            <input class="input" type="text" maxlength="90" value="${this.esc(w.title || '')}" oninput="app.syncImageWizardField('title',this.value)"></div>
          <div class="field full"><label>发布描述</label>
            <textarea class="input" rows="4" oninput="app.syncImageWizardField('description',this.value)">${this.esc(w.description || '')}</textarea></div>
          <div class="field full"><label>发布关键词（作为话题 #，多个用空格或逗号分隔）</label>
            <input class="input" type="text" placeholder="例如：travel, vlog, fyp" value="${this.esc(w.keywords || '')}" oninput="app.syncImageWizardField('keywords',this.value)"></div>
          <div class="field full"><label>音乐类型（已选 <b id="iw-style-count">${on.size}</b> / ${MAX_STYLES}，AI 将按这些标签挑选音乐；不选则不添加音乐）</label>
            <div id="iw-styles" style="border:1px solid #e5e7eb;border-radius:8px;padding:6px">${styleTags}</div></div>
          <div class="field full"><label><input type="checkbox" ${w.saveTraffic !== false ? 'checked' : ''} onchange="app.syncImageWizardField('saveTraffic',this.checked)"> 省流量模式</label></div>
          <div class="field full">
            <button class="primary" type="button" ${w.submitting ? 'disabled' : ''} onclick="app.submitImagePublishWizard()">创建并入队</button>
          </div>
        </div>
      </div>`;
    },

    async fillImageWizardAccounts() {
      const box = document.querySelector('#iw-accounts');
      if (!box) return;
      try {
        const pack = await this.api('/accounts?pageSize=200');
        const accounts = pack?.items || (Array.isArray(pack) ? pack : []);
        const selected = new Set((this.imagePublishWizard?.accountIds || []).map(Number));
        box.innerHTML = accounts.length
          ? accounts.map((a) => this.accountPickTagHtml(a, selected, { onclick: 'app.pickImageWizardAccount(this)' })).join('')
          : '<div class="muted">暂无账号</div>';
        this.syncImageWizardAccount();
      } catch (e) {
        box.innerHTML = `<div class="muted">${this.esc(e.message || '加载账号失败')}</div>`;
      }
    },

    async renderImagePublishWizard() {
      const content = document.querySelector('#content');
      if (!content) return;
      content.innerHTML = this.matrixTabs('tasks') + this.imagePublishWizardPanel();
      await this.fillImageWizardAccounts();
    },

    async submitImagePublishWizard() {
      const w = this.imagePublishWizard;
      if (!w || w.submitting) return;
      this.syncImageWizardAccount();
      const accountId = Number((w.accountIds || [])[0] || 0);
      const files = (this._imageWizardFiles || []).map((x) => x.file);
      if (!accountId) { this.toast('请选择 1 个发布账号', true); return; }
      if (!files.length) { this.toast('请至少选择 1 张图片', true); return; }
      if (files.length > MAX_IMAGES) { this.toast(`图片最多 ${MAX_IMAGES} 张`, true); return; }
      if ((w.musicStyles || []).length > MAX_STYLES) { this.toast(`音乐风格最多选 ${MAX_STYLES} 个`, true); return; }
      if (!String(w.title || '').trim() && !String(w.description || '').trim()) { this.toast('请填写发布标题或描述', true); return; }
      w.submitting = true;
      try {
        // 1) 分批上传到 Node 本机上传目录（单次请求上限 9 张，按顺序保持图片次序）
        const urls = [];
        for (let i = 0; i < files.length; i += UPLOAD_BATCH) {
          const fd = new FormData();
          files.slice(i, i + UPLOAD_BATCH).forEach((f) => fd.append('files', f, f.name));
          this.toast(`正在上传图片 ${Math.min(i + UPLOAD_BATCH, files.length)}/${files.length}…`);
          const up = await this.api('/uploads/images', { method: 'POST', body: fd });
          const items = up?.items || [];
          items.forEach((it) => { if (it?.url) urls.push(it.url); });
        }
        if (urls.length !== files.length) throw new Error(`图片上传不完整（${urls.length}/${files.length}），请重试`);
        // 2) 创建任务（独立发布：1 账号 / 1 个任务）并入队
        const payload = {
          pushChannel: this.defaultTaskBrowserBackend?.() || 'tkswarm',
          accountIds: [accountId],
          images: urls,
          publishTitle: String(w.title || '').trim(),
          publishCaption: String(w.description || '').trim(),
          publishDescription: String(w.description || '').trim(),
          keywords: String(w.keywords || '').trim(),
          hashtags: String(w.keywords || '').trim(),
          musicStyles: [...(w.musicStyles || [])],
          publishMode: 'independent',
          saveTraffic: w.saveTraffic !== false,
          source: 'image_wizard',
        };
        const sch = await this.resolveTaskScheduleFromLocal('', [accountId]);
        Object.assign(payload, sch.scheduleFields || {});
        const stamp = new Date().toLocaleString('zh-CN', { hour12: false }).replace(/[\/:\s]+/g, '');
        const name = String(w.name || '').trim() || `图片发布-${accountId}-${stamp}`;
        const created = await this.api('/tasks', {
          method: 'POST',
          body: JSON.stringify({ name, type: 'publish_images', groupId: null, totalCount: 1, scheduledAt: sch.scheduledAt || null, payload }),
        });
        await this.api('/tasks/' + created.id + '/start', { method: 'POST' });
        this.toast('图片发布任务已创建并进入队列');
        (this._imageWizardFiles || []).forEach((x) => { try { URL.revokeObjectURL(x.preview); } catch (_) { /* ignore */ } });
        this._imageWizardFiles = [];
        this.imagePublishWizardOpen = false;
        this.imagePublishWizard = null;
        this.matrixTab = 'tasks';
        this.taskTypeFilter = 'publish_images';
        this.refresh();
      } catch (e) {
        this.toast(e.message || '创建失败', true);
        if (this.imagePublishWizard) this.imagePublishWizard.submitting = false;
      }
    },

    /* ========== 图片删除向导（与视频删除一致：选账号 → 选已发布图片 → 提交删除任务） ========== */
    openImageDeleteWizard(opts = {}) {
      if (typeof this.canPermission === 'function' && !this.canPermission('publish.tasks')) { this.toast('当前角色无权创建删除任务', true); return; }
      this.wizardOpen = false; this.massWizardOpen = false; this.deleteWizardOpen = false; this.commentReplyWizardOpen = false;
      this.pullCommentWizardOpen = false; this.pullVideoListWizardOpen = false; this.imagePublishWizardOpen = false;
      this.imageDeleteWizard = {
        step: 1, saveTraffic: false, accountIds: [], rows: [], selectedKeys: new Set(),
        loading: false, loadError: '', submitting: false,
      };
      this.imageDeleteWizardOpen = true;
      this.matrixTab = 'tasks';
      if (!opts.skipRefresh) this.refresh();
    },

    closeImageDeleteWizard() {
      this.imageDeleteWizardOpen = false;
      this.imageDeleteWizard = null;
      this.matrixTab = 'tasks';
      this.refresh();
    },

    imageDeleteWizardPanel() {
      const w = this.imageDeleteWizard || { step: 1 };
      const step = Number(w.step || 1);
      const labels = ['选择账号', '选择图片作品', '确认删除'];
      return `<div class="wizard">
        <div class="toolbar" style="margin:0 0 12px"><div><b>图片删除向导</b><span class="muted" style="margin-left:8px">按账号加载本系统已发布成功的图片作品，多选后挂入删除任务</span></div></div>
        <div class="wizard-steps">${labels.map((n, i) => `<span class="${i + 1 === step ? 'on' : ''}">${i + 1} ${n}</span>`).join('')}</div>
        <div class="shell-note" style="margin:0 0 12px">图片作品没有平台 video_id，执行时进入 Studio 内容列表，用<b>发布标题</b>滚动查找，再 ⋯ → Delete → 确认。仅列出由「发布图片」任务发布成功的作品。</div>
        <div id="image-delete-wizard-body">${this.imageDeleteWizardBody(step, w)}</div>
        <div class="toolbar" style="margin-top:16px">
          <button class="ghost" type="button" onclick="app.closeImageDeleteWizard()">取消</button>
          <div>
            ${step > 1 ? '<button class="ghost" type="button" onclick="app.imageDeleteWizardPrev()">上一步</button> ' : ''}
            ${step < 3 ? '<button class="primary" type="button" onclick="app.imageDeleteWizardNext()">下一步</button>' : `<button class="primary" type="button" ${w.submitting ? 'disabled' : ''} onclick="app.imageDeleteWizardSubmit()">创建删除任务</button>`}
          </div>
        </div>
      </div>`;
    },

    imageDeleteWizardBody(step, w) {
      const sel = w.selectedKeys instanceof Set ? w.selectedKeys : new Set(w.selectedKeys || []);
      if (step === 1) {
        return `<div class="form-grid">
          ${this.saveTrafficField(w.saveTraffic, false)}<div class="field full"><label>选择账号</label>
          ${this.accountPickToolbarHtml('image-delete-accounts', { batchHtml: `<button type="button" class="tiny" onclick="app.setAccountPickAll('image-delete-accounts',true)">全选</button><button type="button" class="tiny" onclick="app.setAccountPickAll('image-delete-accounts',false)">清空</button><button type="button" class="tiny" onclick="app.invertAccountPick('image-delete-accounts')">反选</button>` })}
          <div id="image-delete-accounts" class="account-pick-grid"></div>
        </div></div>`;
      }
      if (step === 2) {
        if (w.loading) return '<div class="empty" style="padding:48px 24px">正在加载所选账号已发布的图片作品…</div>';
        const rows = w.rows || [];
        return `<div>
          <div class="matrix-action-bar" style="margin-bottom:10px"><div class="left">
            <button type="button" class="ghost" onclick="app.imageDeleteLoadRows()">刷新列表</button>
            <button type="button" class="tiny" onclick="app.imageDeleteSelectAll(true)">全选</button>
            <button type="button" class="tiny" onclick="app.imageDeleteSelectAll(false)">清空</button>
            <span class="muted">已选 ${sel.size} / 共 ${rows.length} 条</span>
          </div></div>
          ${w.loadError ? `<div class="shell-note" style="margin:0 0 10px;color:#b45309">${this.esc(w.loadError)}</div>` : ''}
          ${!rows.length ? '<div class="empty" style="padding:36px 20px;line-height:1.7">所选账号暂无已发布成功的图片作品。<br><span class="muted">只有通过「发布图片」任务发布成功的作品才会出现在这里。</span></div>' : `
          <div class="table-container"><table><thead><tr>
            <th style="width:40px"></th><th>账号</th><th>首图</th><th>发布标题(搜索用)</th><th>图片数</th><th>发布时间</th>
          </tr></thead><tbody>${rows.map((r) => `<tr>
            <td><input type="checkbox" data-idw-key="${this.esc(r.key)}" ${sel.has(r.key) ? 'checked' : ''} onchange='app.toggleImageDeleteRow(${JSON.stringify(String(r.key))}, this.checked)'></td>
            <td>#${r.accountId} · ${this.esc(r.accountName || '-')}</td>
            <td>${r.thumb ? `<img src="${this.esc(r.thumb)}" alt="" style="width:48px;height:48px;object-fit:cover;border-radius:4px">` : '—'}</td>
            <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${this.esc(r.title)}">${this.esc(r.title)}</td>
            <td>${r.imageCount || '-'}</td>
            <td>${this.esc(r.publishedAt || '-')}</td>
          </tr>`).join('')}</tbody></table></div>`}
        </div>`;
      }
      const picked = (w.rows || []).filter((r) => sel.has(r.key));
      const byAcc = {};
      picked.forEach((r) => { byAcc[r.accountId] = (byAcc[r.accountId] || 0) + 1; });
      return `<div class="data-meta">将为 <b>${Object.keys(byAcc).length}</b> 个账号挂入删除分任务，共 <b>${picked.length}</b> 条图片作品。<br>
        ${Object.entries(byAcc).map(([aid, n]) => `账号 #${aid}：${n} 条`).join('<br>') || '未选择'}
        <br><br>执行时进入 Studio 内容列表，用<strong>发布标题</strong>滚动查找后 ⋯ → Delete → 确认。</div>`;
    },

    async fillImageDeleteWizardAccounts() {
      const box = document.querySelector('#image-delete-accounts');
      if (!box) return;
      try {
        const accounts = (await this.api('/accounts?pageSize=200')).items || [];
        this._imageDeleteAccountsCache = accounts;
        const selected = new Set((this.imageDeleteWizard?.accountIds || []).map(Number));
        box.innerHTML = accounts.length
          ? accounts.map((a) => this.accountPickTagHtml(a, selected)).join('')
          : '<div class="muted account-pick-empty" style="padding:12px;grid-column:1/-1">暂无账号</div>';
        this.filterAccountPick?.('image-delete-accounts');
      } catch (e) {
        box.innerHTML = `<div class="muted">${this.esc(e.message || '加载账号失败')}</div>`;
      }
    },

    async renderImageDeleteWizard() {
      const content = document.querySelector('#content');
      if (!content) return;
      content.innerHTML = this.matrixTabs('tasks') + this.imageDeleteWizardPanel();
      if (Number(this.imageDeleteWizard?.step || 1) === 1) await this.fillImageDeleteWizardAccounts();
    },

    syncImageDeleteSelectionFromDom() {
      const w = this.imageDeleteWizard; if (!w) return;
      if (!(w.selectedKeys instanceof Set)) w.selectedKeys = new Set(w.selectedKeys || []);
      document.querySelectorAll('#image-delete-wizard-body input[type="checkbox"][data-idw-key]').forEach((el) => {
        const k = el.getAttribute('data-idw-key');
        if (!k) return;
        if (el.checked) w.selectedKeys.add(k); else w.selectedKeys.delete(k);
      });
    },

    toggleImageDeleteRow(key, on) {
      const w = this.imageDeleteWizard; if (!w) return;
      if (!(w.selectedKeys instanceof Set)) w.selectedKeys = new Set(w.selectedKeys || []);
      key = String(key || '');
      if (!key) return;
      if (on) w.selectedKeys.add(key); else w.selectedKeys.delete(key);
      const body = document.querySelector('#image-delete-wizard-body');
      if (body) body.innerHTML = this.imageDeleteWizardBody(2, w);
    },

    imageDeleteSelectAll(all) {
      const w = this.imageDeleteWizard; if (!w) return;
      w.selectedKeys = new Set();
      if (all) (w.rows || []).forEach((r) => w.selectedKeys.add(String(r.key)));
      const body = document.querySelector('#image-delete-wizard-body');
      if (body) body.innerHTML = this.imageDeleteWizardBody(2, w);
    },

    async imageDeleteLoadRows() {
      const w = this.imageDeleteWizard; if (!w) return;
      const ids = (w.accountIds || []).map(Number).filter(Boolean);
      w.loading = true; w.loadError = '';
      await this.renderImageDeleteWizard();
      const accMap = new Map((this._imageDeleteAccountsCache || []).map((a) => [Number(a.id), a]));
      const rows = [];
      let failed = 0;
      for (const accountId of ids) {
        try {
          const pack = await this.api(`/account-work-items?taskType=publish_images&status=completed&accountId=${accountId}&page=1&pageSize=100`);
          const items = pack?.items || pack?.list || [];
          for (const it of items) {
            const p = it.payload || {};
            const title = String(p.publishTitle || p.publishCaption || p.publishDescription || '').trim();
            if (!title) continue;
            const acc = accMap.get(accountId) || {};
            const imgs = Array.isArray(p.images) ? p.images : [];
            rows.push({
              key: `item:${it.id}`,
              itemId: Number(it.id),
              accountId,
              accountName: it.accountUsername || acc.username || acc.nickname || ('#' + accountId),
              title,
              description: String(p.publishDescription || p.publishCaption || '').trim(),
              imageCount: imgs.length,
              thumb: imgs[0] ? String(imgs[0].url || imgs[0]) : '',
              publishedAt: String(it.updatedAt || it.updated_at || it.createdAt || ''),
            });
          }
        } catch (_) { failed += 1; }
      }
      w.rows = rows;
      w.loadError = failed ? `有 ${failed} 个账号加载失败` : '';
      const valid = new Set(rows.map((r) => r.key));
      w.selectedKeys = new Set([...(w.selectedKeys || [])].filter((k) => valid.has(k)));
      w.loading = false;
      await this.renderImageDeleteWizard();
    },

    async imageDeleteWizardNext() {
      const w = this.imageDeleteWizard; if (!w) return;
      if (w.step === 1) {
        w.saveTraffic = this.parseSaveTrafficInput(document.querySelector('[name=saveTraffic]')?.value, false);
        w.accountIds = this.selectedAccountPickIds('image-delete-accounts');
        if (!w.accountIds.length) { this.toast('请至少选择一个账号', true); return; }
        w.step = 2; w.selectedKeys = new Set(); w.rows = [];
        await this.imageDeleteLoadRows();
        return;
      }
      if (w.step === 2) {
        if (w.loading) { this.toast('列表加载中，请稍候', true); return; }
        this.syncImageDeleteSelectionFromDom();
        if (!(w.rows || []).some((r) => w.selectedKeys.has(r.key))) { this.toast('请至少勾选一条图片作品', true); return; }
        w.step = 3;
        await this.renderImageDeleteWizard();
      }
    },

    async imageDeleteWizardPrev() {
      const w = this.imageDeleteWizard; if (!w) return;
      if (w.step === 2) this.syncImageDeleteSelectionFromDom();
      w.step = Math.max(1, w.step - 1);
      w.loading = false;
      await this.renderImageDeleteWizard();
    },

    async imageDeleteWizardSubmit() {
      const w = this.imageDeleteWizard; if (!w || w.submitting) return;
      const sel = w.selectedKeys instanceof Set ? w.selectedKeys : new Set(w.selectedKeys || []);
      const picked = (w.rows || []).filter((r) => sel.has(String(r.key)));
      if (!picked.length) { this.toast('请至少勾选一条图片作品', true); return; }
      if (!(await this.ask(`确认将 ${picked.length} 条图片作品加入删除任务？将打开浏览器环境在 TikTok 上删除。`))) return;
      if (typeof this.ensureBitOnline === 'function' && !(await this.ensureBitOnline('删除图片'))) return;
      w.submitting = true;
      const byAcc = new Map();
      picked.forEach((r) => {
        if (!byAcc.has(r.accountId)) byAcc.set(r.accountId, []);
        byAcc.get(r.accountId).push(r);
      });
      let ok = 0, fail = 0;
      for (const [accountId, list] of byAcc.entries()) {
        try {
          await this.api('/account-work-batches/enqueue', {
            method: 'POST',
            body: JSON.stringify({
              accountId: Number(accountId),
              taskType: 'delete_video',
              payload: {
                source: 'image_delete_wizard',
                accountId: Number(accountId),
                videoIds: [],
                items: list.map((x) => ({
                  videoId: '', videoUrl: '', materialId: 0, materialName: '',
                  shareTitle: x.title, publishTitle: x.title, description: x.description || '',
                  searchTitle: x.title,
                })),
                saveTraffic: !!w.saveTraffic,
              },
            }),
          });
          ok += 1;
        } catch (e) { fail += 1; this.toast(`账号 #${accountId} 入队失败：${e.message}`, true); }
      }
      if (ok) this.toast(`已为 ${ok} 个账号创建图片删除分任务${fail ? `，失败 ${fail}` : ''}`);
      this.imageDeleteWizardOpen = false; this.imageDeleteWizard = null;
      if (ok) this.navigate('accountWork', 'list');
      else this.refresh();
    },
  };

  function attach() {
    if (!window.app) { setTimeout(attach, 30); return; }
    Object.assign(window.app, methods);
    window.AppPages = window.AppPages || {};
    window.AppPages.publishImages = true;
  }
  attach();
})();
