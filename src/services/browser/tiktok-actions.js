const { chromium } = require('playwright-core');
const { BitBrowserProvider } = require('./bit-browser-provider');
const { inspectTikTokSession } = require('./cdp-client');
const { inspectPage, capture, classify } = require('../automation-guard');
const dataStore = require('../data-store');
const phpApi = require('../php-api');
const { waitForSlot } = require('../action-rate-limit');
const { isHeadless } = require('./headless');

/** 发布成功后立刻回写素材状态/账号/平台 video_id（所有发布入口统一走这里） */
async function markMaterialPublishedCallback(accountId, materialId, extra = {}) {
  const mid = Number(materialId || 0);
  const aid = Number(accountId || 0);
  if (mid < 1) {
    console.error('[mark-published] skip: missing materialId', { accountId: aid, materialId: mid });
    return { ok: false, error: 'missing materialId' };
  }
  const body = {
    accountId: aid,
    deleteAfterPublish: !!extra.deleteAfterPublish,
    videoId: String(extra.videoId || extra.video_id || ''),
    videoUrl: String(extra.videoUrl || extra.video_url || ''),
  };
  const attempts = [
    { path: `/node/materials/${mid}/mark-published`, method: 'post', body },
    { path: `/materials/${mid}/mark-published`, method: 'post', body },
  ];
  console.log('[mark-published] calling', { materialId: mid, apiBase: phpApi.loadApiBase?.() || '', ...body });
  let lastErr = null;
  for (const at of attempts) {
    try {
      const data = await phpApi.post(at.path, at.body);
      console.log('[mark-published] ok via', at.path, data);
      try {
        const { publish: liveLog } = require('../live-log');
        liveLog(
          `Material #${mid} marked published (account #${aid}${body.videoId ? `, video ${body.videoId}` : ''})`,
          'info',
          { accountId: aid, materialId: mid, videoId: body.videoId }
        );
      } catch { /* ignore */ }
      writeMarkPublishedDebug({ ok: true, path: at.path, materialId: mid, accountId: aid, data });
      return { ok: true, data, path: at.path };
    } catch (err) {
      lastErr = err;
      console.error('[mark-published] fail via', at.path, err.message, err.status || '', err.payload || '');
    }
  }
  // 最后兜底：PUT 更新（线上若已部署 update 的 publish 字段）
  try {
    const mat = await phpApi.get(`/node/materials/${mid}`).catch(() => null);
    const data = await phpApi.put(`/materials/${mid}`, {
      name: mat?.name || `material-${mid}`,
      filePath: mat?.file_path || mat?.filePath || '',
      fileName: mat?.file_name || mat?.fileName || '',
      mimeType: mat?.mime_type || mat?.mimeType || 'video/mp4',
      sizeBytes: mat?.size_bytes || mat?.sizeBytes || 0,
      description: mat?.description || '',
      tags: mat?.tags || '',
      status: mat?.status || 'ready',
      shareTitle: mat?.share_title || mat?.shareTitle || '',
      shareCaption: mat?.share_caption || mat?.shareCaption || '',
      publishStatus: 'published',
      publishAccountId: aid,
      platformVideoId: body.videoId,
      platformVideoUrl: body.videoUrl,
      videoId: body.videoId,
      videoUrl: body.videoUrl,
    });
    console.log('[mark-published] ok via PUT /materials', data);
    writeMarkPublishedDebug({ ok: true, path: `PUT /materials/${mid}`, materialId: mid, accountId: aid, data });
    return { ok: true, data, path: `PUT /materials/${mid}` };
  } catch (err) {
    lastErr = err;
    console.error('[mark-published] PUT fallback FAILED', err.message, err.payload || '');
  }
  writeMarkPublishedDebug({
    ok: false,
    materialId: mid,
    accountId: aid,
    error: lastErr?.message || 'unknown',
    status: lastErr?.status,
    payload: lastErr?.payload,
    apiBase: (() => { try { return require('../php-api').loadApiBase(); } catch { return ''; } })(),
  });
  try {
    const { publish: liveLog } = require('../live-log');
    liveLog(`Mark material #${mid} FAILED: ${lastErr?.message || 'unknown'}`, 'error', { accountId: aid, materialId: mid });
  } catch { /* ignore */ }
  return { ok: false, error: lastErr?.message || 'mark-published failed' };
}

function writeMarkPublishedDebug(info) {
  try {
    const fs = require('node:fs');
    const path = require('node:path');
    const dir = path.resolve(__dirname, '../../data');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'last-mark-published.json'),
      JSON.stringify({ at: new Date().toISOString(), ...info }, null, 2),
      'utf8'
    );
  } catch { /* ignore */ }
}
async function connectAccount(accountId, url, action = 'publish', options = {}) {
  const { getSessionProfileId } = require('../session-context');
  const bundle = await dataStore.getAccountBundle(accountId);
  if (!bundle) throw new Error('账号不存在');
  // 优先用会话租约环境（多环境池），再回落到账号主环境
  const profileId = String(
    options.browserProfileId
    || options.profileId
    || getSessionProfileId()
    || bundle.browser_profile_id
    || ''
  );
  if (!profileId) throw new Error('账号尚未绑定浏览器环境');
  const account = {
    id: bundle.id,
    username: bundle.username,
    browser_profile_id: profileId,
  };
  const provider = new BitBrowserProvider();
  const opened = await provider.open(profileId, { headless: isHeadless(action) });
  if (!opened?.ws) throw new Error('比特浏览器未返回 CDP 地址');
  const browser = await chromium.connectOverCDP(opened.ws, { timeout: 30000 });
  const context = browser.contexts()[0] || await browser.newContext();
  let page = context.pages().find((p) => /tiktokstudio\/upload/i.test(p.url() || ''))
    || context.pages().find((p) => /tiktok\.com/i.test(p.url() || ''))
    || context.pages()[0]
    || await context.newPage();
  await page.bringToFront().catch(() => {});
  if (url) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (/tiktokstudio\/upload/i.test(url)) {
      await page.getByText(/Select video/i).first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(1500);
    } else {
      await page.waitForTimeout(5000);
    }
  } else {
    await page.waitForTimeout(1500);
  }
  return { account, provider, browser, page, context, ws: opened.ws };
}
/**
 * 断开 Playwright CDP；默认同时关闭比特窗口。
 * 总任务 keepBrowser 会话内仅断 CDP，不 browser/close，等整批结束再关。
 * options.force=true 强制关掉比特（总任务 finally 用）。
 */
async function closeConnection(connection, options = {}) {
  if (!connection) return;
  await connection.browser?.close?.().catch(() => {});
  const profileId = String(connection.account?.browser_profile_id || '');
  if (!profileId) return;
  const force = options.force === true;
  if (!force) {
    try {
      const { shouldKeepBrowserOpen } = require('../session-context');
      if (shouldKeepBrowserOpen()) return;
    } catch { /* ignore */ }
  }
  const provider = connection.provider || new BitBrowserProvider();
  await provider.close(profileId).catch(() => {});
}

/** 强制关闭比特环境窗口（无视 keepBrowser） */
async function forceCloseBrowserProfile(profileId) {
  const id = String(profileId || '');
  if (!id) return;
  const provider = new BitBrowserProvider();
  await provider.close(id).catch(() => {});
}

async function findFileInput(page, waitMs = 15000) {
  const end = Date.now() + waitMs;
  while (Date.now() < end) {
    const frames = [page.mainFrame(), ...page.frames().filter((f) => f !== page.mainFrame())];
    for (const frame of frames) {
      for (const sel of [
        'input[type="file"][accept*="video"]',
        'input[type="file"][accept*="mp4"]',
        'input[type="file"]',
      ]) {
        const loc = frame.locator(sel).first();
        if (await loc.count().catch(() => 0)) return loc;
      }
    }
    // Shadow DOM / late-mounted inputs
    const handle = await page.evaluateHandle(() => {
      const walk = (root, out = []) => {
        root.querySelectorAll?.('input[type="file"]')?.forEach((n) => out.push(n));
        root.querySelectorAll?.('*')?.forEach((n) => {
          if (n.shadowRoot) walk(n.shadowRoot, out);
        });
        return out;
      };
      const list = walk(document);
      const prefer = list.find((n) => /video|mp4|webm/i.test(String(n.accept || ''))) || list[0];
      return prefer || null;
    }).catch(() => null);
    const el = handle?.asElement?.();
    if (el) return el;
    await page.waitForTimeout(400);
  }
  return null;
}

async function waitStudioUploadReady(page, timeoutMs = 30000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const url = page.url() || '';
    if (!/tiktokstudio\/upload|tiktok\.com\/upload/i.test(url)) {
      await page.goto('https://www.tiktok.com/tiktokstudio/upload', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      }).catch(() => {});
      await page.waitForTimeout(2000);
    }
    const ready = await page.getByText(/Select video to upload|选择视频|上传视频/i).first()
      .isVisible()
      .catch(() => false);
    const btn = await page.locator('button, [role="button"]').filter({ hasText: /^Select video$/i }).first()
      .isVisible()
      .catch(() => false);
    if (ready || btn) return true;
    await page.waitForTimeout(800);
  }
  return false;
}

async function clickSelectVideoTriggers(page) {
  const exactBtn = page.locator('button').filter({ hasText: /^Select video$/i }).first();
  if (await exactBtn.count().catch(() => 0) && await exactBtn.isVisible().catch(() => false)) {
    return exactBtn;
  }
  const labels = /Select video|Select video to upload|Upload video|选择视频|上传视频|选择文件/i;
  const candidates = [
    page.getByRole('button', { name: labels }),
    page.locator('button').filter({ hasText: labels }),
    page.locator('[role="button"]').filter({ hasText: labels }),
    page.locator('div[class*="upload" i] button').filter({ hasText: labels }),
    page.getByText(/^Select video$/i),
  ];
  for (const loc of candidates) {
    const el = loc.first();
    if (!(await el.count().catch(() => 0))) continue;
    if (!(await el.isVisible().catch(() => false))) continue;
    await el.scrollIntoViewIfNeeded().catch(() => {});
    return el;
  }
  // Drop zone itself
  const zone = page.getByText(/Or drag and drop it here|拖放到此处/i).first();
  if (await zone.count().catch(() => 0) && await zone.isVisible().catch(() => false)) {
    return zone;
  }
  return null;
}

async function setInputFilesSafe(target, filePath) {
  if (!target) return false;
  try {
    if (typeof target.setInputFiles === 'function') {
      await target.setInputFiles(filePath);
      return true;
    }
  } catch (e) {
    // ElementHandle vs Locator differences
  }
  try {
    await target.setInputFiles(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Select local video on TikTok Studio upload page. */
async function selectVideoFile(page, filePath, log = () => {}) {
  const fs = require('node:fs');
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`素材文件不存在或不可读：${filePath || '(空路径)'}`);
  }
  const size = fs.statSync(filePath).size;
  if (size < 1024) throw new Error(`素材文件过小（${size} bytes），可能下载失败：${filePath}`);

  log(`upload page: wait Studio ready (${page.url()})`);
  await waitStudioUploadReady(page, 45000);

  // Switch Videos tab
  const videosTab = page.getByRole('tab', { name: /^Videos$/i }).or(page.getByText(/^Videos$/i)).first();
  if (await videosTab.isVisible().catch(() => false)) {
    await videosTab.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  // A) Prefer filechooser + red Select video button (matches current Studio UI)
  const trigger = await clickSelectVideoTriggers(page);
  if (trigger) {
    log('upload: click Select video + filechooser');
    try {
      const chooserPromise = page.waitForEvent('filechooser', { timeout: 15000 });
      await trigger.click({ timeout: 10000, force: true });
      const chooser = await chooserPromise;
      await chooser.setFiles(filePath);
      log('upload: file set via filechooser');
      return { method: 'chooser' };
    } catch (e) {
      log(`upload: filechooser path failed: ${e.message}`);
    }
  } else {
    log('upload: Select video button not found yet');
  }

  // B) Hidden / shadow file input
  log('upload: try direct input[type=file]');
  let input = await findFileInput(page, 8000);
  if (input && await setInputFilesSafe(input, filePath)) {
    log('upload: file set via input');
    return { method: 'input' };
  }

  // C) Force-create chooser by dispatching click on any upload CTA via JS + filechooser
  log('upload: JS click Select video');
  const chooserPromise = page.waitForEvent('filechooser', { timeout: 12000 }).catch(() => null);
  await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('button, [role="button"], div, span, a, label')];
    const el = nodes.find((n) => /^Select video$/i.test((n.innerText || n.textContent || '').trim()));
    if (el) {
      el.scrollIntoView({ block: 'center' });
      el.click();
      return true;
    }
    const any = nodes.find((n) => /Select video to upload|选择视频/i.test((n.innerText || '').trim()));
    if (any) {
      any.click();
      return true;
    }
    return false;
  }).catch(() => false);
  const chooser = await chooserPromise;
  if (chooser) {
    await chooser.setFiles(filePath);
    log('upload: file set via JS click chooser');
    return { method: 'js-chooser' };
  }

  // D) Last try: deep input again after click
  input = await findFileInput(page, 6000);
  if (input && await setInputFilesSafe(input, filePath)) {
    log('upload: file set via input after click');
    return { method: 'input-after-click' };
  }

  const dump = await page.evaluate(() => ({
    url: location.href,
    buttons: [...document.querySelectorAll('button,[role=button]')]
      .map((x) => (x.innerText || x.getAttribute('aria-label') || '').trim())
      .filter(Boolean)
      .slice(0, 40),
    fileInputs: [...document.querySelectorAll('input[type=file]')].map((x) => ({
      accept: x.accept,
      id: x.id,
      cls: x.className,
    })),
    text: (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 400),
  })).catch(() => ({}));
  throw new Error(
    `未能触发 Select video / 选择文件。url=${dump.url || page.url()} buttons=${(dump.buttons || []).join('|').slice(0, 200)} inputs=${dump.fileInputs?.length || 0}`
  );
}

/** Wait until leave select-video splash and editor/post controls appear. */
async function waitUploadEditorReady(page, timeoutMs = 180000, log = () => {}) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    await dismissPublishDialogs(page, log);
    const selectSplash = await page.getByText(/Select video to upload/i).first().isVisible().catch(() => false);
    const hasCaption = await page.locator('textarea, [contenteditable="true"]').first().count().catch(() => 0);
    const hasPost = await page.getByRole('button', { name: /^(Post|Publish|发布|投稿)$/i }).first()
      .isVisible()
      .catch(() => false);
    const editing = await page.getByText(/Add description|Describe your video|添加描述|作品描述|封面|Cover|Split|编辑/i).first()
      .isVisible()
      .catch(() => false);
    const uploading = await page.getByText(/Uploading|Processing|上传中|处理中/i).first()
      .isVisible()
      .catch(() => false);
    if (uploading) {
      log('upload: still processing…');
    }
    if ((!selectSplash && (hasCaption > 0 || hasPost || editing)) || (hasPost && hasCaption > 0)) {
      return true;
    }
    await page.waitForTimeout(1500);
  }
  return false;
}

async function readSetting(key, fallback) {
  try {
    return await dataStore.getSetting(key, fallback);
  } catch {
    return fallback;
  }
}

async function loadMaterial(materialId) {
  const fs = require('node:fs');
  const path = require('node:path');
  const os = require('node:os');
  let material;
  try {
    material = await phpApi.get(`/node/materials/${materialId}`);
  } catch (e) {
    throw new Error(e.message || '素材不存在');
  }
  if (!material) throw new Error('素材不存在');
  const localPath = material.file_path || material.filePath || '';
  if (localPath && fs.existsSync(localPath)) {
    material.file_path = localPath;
    material.filePath = localPath;
    return material;
  }
  const downloadUrl = material.downloadUrl || material.download_url || `/api/materials/${materialId}/stream`;
  const ext = path.extname(material.file_name || material.fileName || '.mp4') || '.mp4';
  const tmpDir = path.join(os.tmpdir(), 'tkswarm-materials');
  fs.mkdirSync(tmpDir, { recursive: true });
  const dest = path.join(tmpDir, `m-${materialId}-${Date.now()}${ext}`);
  await phpApi.download(downloadUrl, dest);
  material.file_path = dest;
  material.filePath = dest;
  return material;
}

/** Click a button even if a dim mask intercepts pointer events. */
async function forceClick(locator, label, log = () => {}) {
  if (!(await locator.count().catch(() => 0))) return false;
  // Prefer visible; still force-click if attached (mask may cover it)
  const attached = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  }).catch(() => false);
  if (!attached && !(await locator.isVisible().catch(() => false))) return false;
  if (await locator.isDisabled().catch(() => false)) return false;
  await locator.click({ timeout: 5000, force: true }).catch(async () => {
    await locator.evaluate((el) => el.click()).catch(() => null);
  });
  log(`dialog: clicked ${label}`);
  return true;
}

/**
 * Remove orphan full-screen dim layers that block clicks after a modal was dismissed
 * without leaving Cancel/close. Prefer Escape first; only strip inert backdrops.
 */
async function clearStuckPublishMask(page, log = () => {}) {
  // Never Escape while a publish confirm is on screen — that cancels Post now / Turn on
  const confirmLive = await page.evaluate(() => {
    const t = String(document.body?.innerText || '');
    return /Continue to post|Turn on automatic content checks|copyright check is incomplete/i.test(t)
      || !!Array.from(document.querySelectorAll('button,[role="button"]')).find((b) => /^(Post now|Turn on)$/i.test(String(b.innerText || '').trim()));
  }).catch(() => false);
  if (confirmLive) return 0;

  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(250);

  // Close (X) only on leftover dialogs that are NOT publish confirms
  const junkDialog = page.locator('[role="dialog"]').filter({
    hasNotText: /Continue to post|automatic content checks|Post now|Turn on/i,
  }).first();
  if (await junkDialog.count().catch(() => 0) && await junkDialog.isVisible().catch(() => false)) {
    const closeBtn = junkDialog.locator(
      'button[aria-label*="Close" i], button[aria-label*="关闭" i], [class*="close" i]'
    ).first();
    if (await closeBtn.count().catch(() => 0)) {
      await closeBtn.click({ force: true, timeout: 2000 }).catch(() => {});
    }
  }

  const removed = await page.evaluate(() => {
    let n = 0;
    const vw = window.innerWidth || 1;
    const vh = window.innerHeight || 1;
    const nodes = Array.from(document.querySelectorAll('body *'));
    for (const el of nodes) {
      if (!(el instanceof HTMLElement)) continue;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      if (style.position !== 'fixed' && style.position !== 'absolute') continue;
      const r = el.getBoundingClientRect();
      if (r.width < vw * 0.85 || r.height < vh * 0.85) continue;
      const text = String(el.innerText || '').replace(/\s+/g, ' ').trim();
      // Keep real confirm dialogs
      if (/Continue to post|Turn on automatic content checks|Post now|copyright check is incomplete/i.test(text)) {
        continue;
      }
      const buttons = el.querySelectorAll('button, [role="button"]');
      const actionable = Array.from(buttons).filter((b) => {
        const t = String(b.innerText || b.getAttribute('aria-label') || '').trim();
        return t && !/^x$/i.test(t);
      });
      // Orphan dim mask: covers viewport, no real actions (or only close)
      const bg = style.backgroundColor || '';
      const z = Number.parseInt(style.zIndex, 10) || 0;
      const looksMask = z >= 50 || /rgba?\(\s*0,\s*0,\s*0/i.test(bg) || style.backdropFilter !== 'none';
      if (!looksMask) continue;
      if (actionable.length > 1) continue;
      if (text.length > 80 && actionable.length > 0) continue;
      el.style.pointerEvents = 'none';
      el.style.opacity = '0';
      el.setAttribute('data-tkswarm-mask-cleared', '1');
      // Detach pure backdrops with almost no content
      if (text.length < 40 && actionable.length === 0) {
        el.remove();
        n += 1;
      } else {
        n += 1;
      }
    }
    return n;
  }).catch(() => 0);

  if (removed > 0) log(`dialog: cleared stuck mask x${removed}`);
  return removed;
}

/**
 * Auto-dismiss Studio publish modals if present.
 * - "Turn on automatic content checks?" → Turn on
 * - "Continue to post?" → Post now (critical)
 * Never click Cancel. Uses force click to pierce dim layers.
 */
async function dismissPublishDialogs(page, log = () => {}) {
  const clicked = [];
  const tryLabels = async (patterns, label) => {
    for (const re of patterns) {
      const byRole = page.getByRole('button', { name: re }).first();
      if (await forceClick(byRole, label, log)) {
        clicked.push(label);
        await page.waitForTimeout(500);
        return true;
      }
      const byText = page.locator('button, [role="button"]').filter({ hasText: re }).first();
      if (await forceClick(byText, label, log)) {
        clicked.push(label);
        await page.waitForTimeout(500);
        return true;
      }
    }
    // Deep click in frames / non-button nodes
    const hit = await page.evaluate((src) => {
      const rx = new RegExp(src, 'i');
      const nodes = Array.from(document.querySelectorAll('button, [role="button"], div[role="button"]'));
      for (const el of nodes) {
        const text = String(el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!rx.test(text) || text.length > 24) continue;
        el.click();
        return text;
      }
      return '';
    }, patterns[0].source || String(patterns[0])).catch(() => '');
    if (hit) {
      clicked.push(label);
      log(`dialog: clicked ${label} (deep)`);
      await page.waitForTimeout(500);
      return true;
    }
    return false;
  };

  const body = await page.evaluate(() => (document.body?.innerText || '').slice(0, 12000)).catch(() => '');
  const blob = String(body || '').replace(/\s+/g, ' ');

  // Prefer Post now confirmation first (publish gate)
  if (/Continue to post|copyright check is incomplete|Post now|继续发布|版权检测未完成/i.test(blob)
    || await page.getByRole('button', { name: /^Post now$/i }).count().catch(() => 0)) {
    if (await tryLabels([/^Post now$/i, /^立即发布$/, /^继续发布$/], 'Post now')) {
      await clearStuckPublishMask(page, log);
      return clicked;
    }
  }

  // Content-check opt-in modal (strict title — avoid matching page "Music copyright check" toggle)
  if (/Turn on automatic content checks|automatic content checks\?/i.test(blob)
    || (/Content check lite/i.test(blob) && /Turn on/i.test(blob) && /Cancel/i.test(blob))) {
    if (await tryLabels([/^Turn on$/i, /^Enable$/i, /^开启$/, /^启用$/], 'Turn on')) {
      await clearStuckPublishMask(page, log);
      return clicked;
    }
  }

  // Visible Post now even if body text snapshot missed it
  if (await tryLabels([/^Post now$/i], 'Post now')) {
    await clearStuckPublishMask(page, log);
    return clicked;
  }

  // If dim mask remains with no actionable dialog, clear it
  const hasPostNow = await page.getByRole('button', { name: /^Post now$/i }).count().catch(() => 0);
  const hasTurnOn = await page.getByRole('button', { name: /^Turn on$/i }).count().catch(() => 0);
  if (!hasPostNow && !hasTurnOn) {
    await clearStuckPublishMask(page, log);
  }

  return clicked;
}

/** Wait copyright scan idle, or keep confirming Post now while checking. */
async function settleCopyrightAndConfirms(page, timeoutMs = 60000, log = () => {}) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    await dismissPublishDialogs(page, log);
    const checking = await page.getByText(/Checking in progress|still checking your video|This will take about|检测中|正在检查/i)
      .first()
      .isVisible()
      .catch(() => false);
    const postNowVisible = await page.getByRole('button', { name: /^Post now$/i }).first()
      .isVisible()
      .catch(() => false);
    if (postNowVisible) {
      await forceClick(page.getByRole('button', { name: /^Post now$/i }).first(), 'Post now', log);
      await page.waitForTimeout(800);
      continue;
    }
    if (!checking) {
      await clearStuckPublishMask(page, log);
      return true;
    }
    // Checking under a stuck dim layer — peel mask so Post/Post now stay clickable
    await clearStuckPublishMask(page, log);
    log('copyright: checking in progress…');
    await page.waitForTimeout(2000);
  }
  await clearStuckPublishMask(page, log);
  return false;
}

async function clickPostButton(page, log = () => {}) {
  await clearStuckPublishMask(page, log);
  // Prefer main Post/Publish; Post now is confirm dialog
  const namePatterns = [
    /^Post$/i, /^Publish$/i, /^发布$/, /^投稿$/, /^发布视频$/,
  ];
  const targets = [page, ...page.frames().filter((frame) => frame !== page.mainFrame())];
  for (const target of targets) {
    for (const pattern of namePatterns) {
      const button = target.getByRole('button', { name: pattern }).first();
      if (await forceClick(button, 'Post', log)) return true;
    }
    for (const selector of [
      'button[data-e2e="post_video_button"]',
      'button[data-e2e="publish-button"]',
      '[data-e2e="post_video_button"]',
    ]) {
      const button = target.locator(selector).first();
      if (await forceClick(button, 'Post', log)) return true;
    }
  }
  for (const target of targets) {
    const byText = target.locator('button, [role="button"]').filter({ hasText: /^(Post|Publish|发布|投稿)$/i }).first();
    if (await forceClick(byText, 'Post', log)) return true;
  }
  return false;
}

/**
 * After primary Post: hammer confirm dialogs, clear mask, retry Post if still on upload.
 */
async function drivePublishConfirmations(page, timeoutMs = 120000, log = () => {}) {
  const end = Date.now() + timeoutMs;
  let postRetries = 0;
  while (Date.now() < end) {
    await dismissPublishDialogs(page, log);
    await settleCopyrightAndConfirms(page, Math.min(20000, end - Date.now()), log);

    const url = page.url() || '';
    if (/tiktok\.com\/(@|content|tiktokstudio\/content)/i.test(url) && !/upload/i.test(url)) {
      const vid = (url.match(/\/video\/(\d+)/) || [])[1] || '';
      return { status: 'published', via: 'url', videoId: vid, videoUrl: vid ? url.split('?')[0] : '' };
    }
    const text = await page.evaluate(() => (document.body?.innerText || '').slice(0, 8000)).catch(() => '');
    if (/uploaded successfully|posted successfully|your video was (uploaded|posted)|发布成功|已发布|上传成功|视频已发布/i.test(text)
      && !/Checking in progress|being uploaded|Uploading/i.test(text)) {
      return { status: 'published', via: 'text' };
    }

    const postNow = page.getByRole('button', { name: /^Post now$/i }).first();
    if (await postNow.count().catch(() => 0)) {
      await forceClick(postNow, 'Post now', log);
      await page.waitForTimeout(1000);
      continue;
    }

    // Still on upload editor with mask / no confirm → clear mask and re-hit Post (max 3)
    if (/upload/i.test(url) && postRetries < 3) {
      const checking = /Checking in progress/i.test(text);
      if (!checking) {
        await clearStuckPublishMask(page, log);
        const again = await clickPostButton(page, log);
        if (again) {
          postRetries += 1;
          log(`post re-clicked (#${postRetries}) after mask clear`);
          await page.waitForTimeout(1000);
          continue;
        }
      }
    }

    const security = await inspectPage(page);
    if (security.blocked) return { status: 'security_paused', reason: security.reason };
    await page.waitForTimeout(1500);
  }
  return { status: 'timeout' };
}

/** 发布成功后尽量解析平台 video_id（URL / 页面链接 / Studio 内容页） */
async function resolvePublishedVideoMeta(page, username = '', log = () => {}) {
  const pickFromUrl = (u) => {
    const m = String(u || '').match(/\/video\/(\d+)/);
    if (!m) return null;
    return { videoId: m[1], videoUrl: String(u).split('?')[0] };
  };
  let hit = pickFromUrl(page.url() || '');
  if (hit) return hit;

  try {
    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll('a[href*="/video/"]')]
        .map((a) => a.href || '')
        .filter(Boolean)
    ).catch(() => []);
    for (const h of hrefs) {
      hit = pickFromUrl(h);
      if (hit) return hit;
    }
  } catch { /* ignore */ }

  const user = String(username || '').replace(/^@/, '').trim();
  const candidates = [
    user ? `https://www.tiktok.com/@${encodeURIComponent(user)}` : '',
    'https://www.tiktok.com/tiktokstudio/content',
    'https://www.tiktok.com/tiktokstudio/content?tab=video',
  ].filter(Boolean);

  for (const target of candidates) {
    try {
      log(`resolve videoId via ${target}`);
      await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
      await page.waitForTimeout(2500);
      hit = pickFromUrl(page.url() || '');
      if (hit) return hit;
      const hrefs = await page.evaluate((uname) => {
        const all = [...document.querySelectorAll('a[href*="/video/"]')].map((a) => a.href || '');
        if (!uname) return all;
        const prefer = all.filter((h) => h.includes(`/@${uname}/video/`));
        return prefer.length ? prefer : all;
      }, user).catch(() => []);
      for (const h of hrefs) {
        hit = pickFromUrl(h);
        if (hit) return hit;
      }
    } catch (e) {
      log(`resolve videoId skip: ${e.message || e}`);
    }
  }
  return { videoId: '', videoUrl: '' };
}

async function waitPublishOutcome(page, timeoutMs = 120000, log = () => {}) {
  return drivePublishConfirmations(page, timeoutMs, log);
}
async function clickSendButton(page) {
  const names = ['Send', '发送', 'Message'];
  const targets = [page, ...page.frames().filter(frame => frame !== page.mainFrame())];
  for (const target of targets) {
    for (const name of names) {
      const button = target.getByRole('button', { name: new RegExp(`^${name}$`, 'i') }).first();
      if (await button.count().catch(() => 0) && await button.isVisible().catch(() => false)) {
        const disabled = await button.isDisabled().catch(() => false);
        if (disabled) continue;
        await button.click({ timeout: 8000 });
        return true;
      }
    }
  }
  return false;
}

async function fillMessageEditor(page, content) {
  const editors = [
    page.locator('[data-e2e="message-input-area"] [contenteditable="true"]').last(),
    page.locator('[contenteditable="true"]').last(),
    page.locator('textarea').last(),
  ];
  for (const editor of editors) {
    if (!(await editor.count().catch(() => 0))) continue;
    if (!(await editor.isVisible().catch(() => false))) continue;
    await editor.click({ timeout: 5000 }).catch(() => {});
    await editor.fill(content).catch(async () => {
      await page.keyboard.press('Control+A').catch(() => {});
      await page.keyboard.type(content, { delay: 10 });
    });
    return true;
  }
  return false;
}

async function openRecipientChat(page, recipient) {
  const handle = String(recipient || '').replace(/^@/, '').trim();
  if (!handle) return false;

  await page.goto(`https://www.tiktok.com/@${encodeURIComponent(handle)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const profileMessage = page.getByRole('button', { name: /^(Message|私信|发私信|Messages)$/i }).first();
  if (await profileMessage.count().catch(() => 0) && await profileMessage.isVisible().catch(() => false)) {
    await profileMessage.click().catch(() => {});
    await page.waitForTimeout(2500);
    if (await page.locator('textarea,[contenteditable="true"]').count().catch(() => 0)) return true;
  }

  await page.goto('https://www.tiktok.com/messages', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const search = page.locator('input[placeholder*="Search"],input[placeholder*="搜索"],input[type="search"]').first();
  if (await search.count().catch(() => 0)) {
    await search.fill(handle).catch(async () => {
      await search.click();
      await page.keyboard.type(handle);
    });
    await page.waitForTimeout(1500);
    const hit = page.getByText(handle, { exact: false }).first();
    if (await hit.count().catch(() => 0)) {
      await hit.click().catch(() => {});
      await page.waitForTimeout(1500);
      return true;
    }
  }
  const newChat = page.getByRole('button', { name: /^(New chat|新建聊天|Compose)$/i }).first();
  if (await newChat.count().catch(() => 0)) {
    await newChat.click().catch(() => {});
    await page.waitForTimeout(1000);
    const composeInput = page.locator('input').first();
    if (await composeInput.count().catch(() => 0)) {
      await composeInput.fill(handle).catch(() => {});
      await page.waitForTimeout(1200);
      const option = page.getByText(handle, { exact: false }).first();
      if (await option.count().catch(() => 0)) await option.click().catch(() => {});
    }
  }
  return Boolean(await page.locator('textarea,[contenteditable="true"]').count().catch(() => 0));
}

async function prepareMessage(accountId, content, recipient = '', options = {}) {
  const wait = waitForSlot(`message:${accountId}`, 3000);
  if (wait) await new Promise(resolve => setTimeout(resolve, wait));
  const autoSend = options.autoSend === true;
  const connection = await connectAccount(accountId, 'https://www.tiktok.com/messages', 'message');
  let keepOpen = false;
  try {
    const session = await inspectTikTokSession(connection.ws);
    if (!session.loggedIn) throw new Error('当前浏览器没有有效 TikTok 登录状态');
    const before = await capture(connection.page, accountId, 'message', 'before');
    const security = await inspectPage(connection.page);
    if (security.blocked) {
      keepOpen = true;
      return { status: 'security_paused', reason: security.reason, screenshot: before, manualRequired: true };
    }
    if (recipient) {
      const opened = await openRecipientChat(connection.page, recipient);
      if (!opened) {
        keepOpen = true;
        return {
          status: 'failed',
          error: `未能打开与 ${recipient} 的会话，请确认用户名正确且账号已登录`,
          screenshot: before,
          recipient,
        };
      }
    }
    const filled = await fillMessageEditor(connection.page, content);
    if (!filled) throw new Error('未找到消息输入控件');
    const prepared = await capture(connection.page, accountId, 'message', 'prepared');
    const after = await inspectPage(connection.page);
    if (after.blocked) {
      keepOpen = true;
      return { status: 'security_paused', reason: after.reason, screenshot: prepared, manualRequired: true };
    }
    if (!autoSend) {
      keepOpen = true;
      return { status: 'manual_required', manualRequired: true, screenshot: prepared, recipient, contentLength: String(content).length };
    }
    const clicked = await clickSendButton(connection.page);
    if (!clicked) {
      await connection.page.keyboard.press('Enter').catch(() => {});
      await connection.page.waitForTimeout(800);
    }
    const sentShot = await capture(connection.page, accountId, 'message', 'sent').catch(() => prepared);
    const blocked = await inspectPage(connection.page);
    if (blocked.blocked) {
      keepOpen = true;
      return { status: 'security_paused', reason: blocked.reason, screenshot: sentShot, manualRequired: true };
    }
    return { status: 'sent', screenshot: sentShot, recipient, contentLength: String(content).length, clicked: clicked || 'enter' };
  } finally {
    if (!keepOpen) await closeConnection(connection);
  }
}

async function sendBitMessageBatch(accountId, items = [], options = {}) {
  const wait = waitForSlot(`message:${accountId}`, 3000);
  if (wait) await new Promise(resolve => setTimeout(resolve, wait));
  const interval = Math.min(60000, Math.max(0, Number(options.interval) || 800));
  const connection = await connectAccount(accountId, 'https://www.tiktok.com/messages', 'message');
  let keepOpen = false;
  const results = [];
  try {
    const session = await inspectTikTokSession(connection.ws);
    if (!session.loggedIn) throw new Error('当前浏览器没有有效 TikTok 登录状态');
    for (const item of items) {
      const recipient = item.recipient || item.uid || item.username || '';
      const content = item.content || '';
      try {
        const security = await inspectPage(connection.page);
        if (security.blocked) {
          keepOpen = true;
          results.push({ ...item, ok: false, status: 'security_paused', reason: security.reason });
          break;
        }
        if (recipient) {
          const opened = await openRecipientChat(connection.page, recipient);
          if (!opened) {
            results.push({ ...item, ok: false, status: 'failed', reason: `未能打开会话：${recipient}` });
            if (interval) await connection.page.waitForTimeout(interval);
            continue;
          }
        }
        const filled = await fillMessageEditor(connection.page, content);
        if (!filled) {
          results.push({ ...item, ok: false, status: 'failed', reason: '未找到消息输入控件' });
          continue;
        }
        let clicked = await clickSendButton(connection.page);
        if (!clicked) {
          await connection.page.keyboard.press('Enter').catch(() => {});
          clicked = true;
        }
        await connection.page.waitForTimeout(800);
        results.push({ ...item, ok: true, status: 'sent', clicked });
      } catch (error) {
        results.push({ ...item, ok: false, status: 'failed', reason: error.message });
      }
      if (interval) await connection.page.waitForTimeout(interval);
    }
    return { results, paused: results.some(row => row.status === 'security_paused') };
  } finally {
    if (!keepOpen) await closeConnection(connection);
  }
}

async function preparePublish(accountId, materialId, title='', caption='', options={}) {
  const wait=waitForSlot(`publish:${accountId}`,3000); if(wait) await new Promise(resolve=>setTimeout(resolve,wait));
  const material=await loadMaterial(materialId);
  if(!material) throw new Error('素材不存在');
  const status = material.status || 'ready';
  if(status!=='ready') throw new Error('素材状态不可用');
  const filePath = material.file_path || material.filePath || '';
  if (!filePath) throw new Error('素材文件路径为空（请确认 PHP 素材可被本机访问）');
  material.file_path = filePath;
  material.file_name = material.file_name || material.fileName || '';
  // 任务级文案优先；为空则回退到素材自身的分享标题，再回退素材名（与发布弹窗一致）
  const matTitle = String(material.shareTitle || material.share_title || material.name || '').trim();
  const matCaption = String(material.shareCaption || material.share_caption || '').trim();
  title = String(title || '').trim() || matTitle;
  caption = String(caption || '').trim() || matCaption;
  const autoPublish = options.autoPublish !== undefined ? Boolean(options.autoPublish) : !(await readSetting('publishManualConfirm', false));
  const saveTraffic = Boolean(options.saveTraffic);
  const forceKeepOpen = Boolean(options.keepOpen);
  const { publish: liveLog } = require('../live-log');
  const log = (msg) => liveLog(`Publish#${accountId}: ${msg}`, 'info', { accountId, materialId });
  // Studio upload UI: https://www.tiktok.com/tiktokstudio/upload
  const startUrl = options.uploadUrl || 'https://www.tiktok.com/tiktokstudio/upload';
  const connection = await connectAccount(accountId, startUrl, 'publish');
  let keepOpen = false;
  try {
    const pause = (ms) => connection.page.waitForTimeout(saveTraffic ? Math.min(ms, 1500) : ms);
    // Re-focus Studio upload tab (Bit may open extra workbench tabs)
    const pages = connection.browser.contexts()[0]?.pages?.() || connection.context?.pages?.() || [];
    let page = pages.find((p) => /tiktokstudio\/upload/i.test(p.url() || ''))
      || pages.find((p) => /tiktok\.com\/upload/i.test(p.url() || ''))
      || connection.page;
    connection.page = page;
    await page.bringToFront().catch(() => {});
    if (!/tiktokstudio\/upload|tiktok\.com\/upload/i.test(page.url() || '')) {
      log(`goto studio upload from ${page.url()}`);
      await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await pause(3000);
    }
    const session = await inspectTikTokSession(connection.ws, connection.page);
    if (!session.loggedIn) {
      liveLog(
        `Publish#${accountId}: login check fail url=${session.pageUrl} cookie=${session.hasSessionCookie} studio=${session.studioAuthed} out=${session.uiLoggedOut} in=${session.uiLoggedIn} evidence=${(session.evidence || []).join(',')}`,
        'warn',
        { accountId }
      );
      throw new Error(
        `当前浏览器没有有效 TikTok 登录状态（url=${session.pageUrl || '-'} cookie=${session.hasSessionCookie} studio=${!!session.studioAuthed}）。请确认比特窗口已登录且停在 Studio 上传页后重试`
      );
    }
    await require('../data-store').updateLoginStatus(accountId, 'online').catch(() => {});
    const before = saveTraffic ? null : await capture(connection.page, accountId, 'publish', 'before');
    const security = await inspectPage(connection.page);
    if (security.blocked) {
      keepOpen = true;
      return { status: 'security_paused', reason: security.reason, screenshot: before || '', manualRequired: true };
    }

    log(`select video file: ${material.file_name || material.file_path}`);
    const picked = await selectVideoFile(connection.page, material.file_path, log);
    log(`video selected via ${picked.method}`);
    const ready = await waitUploadEditorReady(connection.page, saveTraffic ? 90000 : 180000, log);
    if (!ready) {
      keepOpen = true;
      await capture(connection.page, accountId, 'publish', 'upload-stuck').catch(() => '');
      throw new Error('已选择视频，但未进入编辑/发布页（可能仍在上传处理）。页面已保留');
    }

    const textareas = connection.page.locator('textarea, [contenteditable="true"]');
    if (title || caption) {
      await textareas.first().fill(`${title}${title && caption ? '\n' : ''}${caption}`).catch(() => {});
    }
    const prepared = await capture(connection.page, accountId, 'publish', 'prepared');
    const after = await inspectPage(connection.page);
    if (after.blocked) {
      keepOpen = true;
      return { status: 'security_paused', reason: after.reason, screenshot: prepared, manualRequired: true };
    }
    if (!autoPublish) {
      keepOpen = true;
      console.warn('[publish] autoPublish=false → manual_required, will NOT mark-published until Post succeeds via resume');
      log('autoPublish off: waiting for manual Post / resumePublish');
      return {
        status: 'manual_required',
        manualRequired: true,
        screenshot: prepared,
        material: { id: material.id, name: material.name, fileName: material.file_name },
      };
    }
    // Wait post button enabled; dismiss mid-flow modals; wait copyright scan if already running
    for (let i = 0; i < 40; i += 1) {
      await dismissPublishDialogs(connection.page, log);
      await clearStuckPublishMask(connection.page, log);
      const btn = connection.page.getByRole('button', { name: /^(Post|Publish|发布|投稿)$/i }).first();
      if (await btn.count() && await btn.isVisible().catch(() => false) && !(await btn.isDisabled().catch(() => true))) break;
      await pause(1500);
    }
    await settleCopyrightAndConfirms(connection.page, saveTraffic ? 20000 : 45000, log);
    await clearStuckPublishMask(connection.page, log);
    const clicked = await clickPostButton(connection.page, log);
    if (!clicked) {
      keepOpen = true;
      return {
        status: 'failed',
        error: '未找到发布按钮，已保留浏览器页面',
        screenshot: prepared,
        material: { id: material.id, name: material.name, fileName: material.file_name },
      };
    }
    log('post clicked, confirming dialogs / clearing mask / waiting outcome');
    let outcome = await drivePublishConfirmations(connection.page, saveTraffic ? 90000 : 150000, log);
    const shot = saveTraffic ? prepared : await capture(connection.page, accountId, 'publish', 'posted').catch(() => prepared);
    if (outcome.status === 'security_paused') {
      keepOpen = true;
      return { status: 'security_paused', reason: outcome.reason, screenshot: shot, manualRequired: true };
    }
    if (outcome.status !== 'published') {
      // 页面可能已发成功但文案/URL 未匹配：再解析一次 video_id，有则视为成功
      const meta = await resolvePublishedVideoMeta(
        connection.page,
        connection.account?.username || '',
        log
      ).catch(() => ({ videoId: '', videoUrl: '' }));
      if (meta.videoId) {
        log(`outcome was ${outcome.status}, but found videoId=${meta.videoId} → treat as published`);
        outcome = { status: 'published', via: `recover:${outcome.status}`, videoId: meta.videoId, videoUrl: meta.videoUrl };
      }
    }
    if (outcome.status === 'published') {
      let videoId = outcome.videoId || '';
      let videoUrl = outcome.videoUrl || '';
      if (!videoId) {
        const meta = await resolvePublishedVideoMeta(
          connection.page,
          connection.account?.username || '',
          log
        ).catch(() => ({ videoId: '', videoUrl: '' }));
        videoId = meta.videoId || '';
        videoUrl = meta.videoUrl || '';
        if (videoId) log(`resolved platform videoId=${videoId}`);
        else log('published but platform videoId not found yet');
      }
      const published = {
        status: 'published',
        screenshot: shot,
        material: { id: material.id, name: material.name, fileName: material.file_name },
        videoId,
        videoUrl,
      };
      await markMaterialPublishedCallback(accountId, materialId, {
        videoId,
        videoUrl,
        deleteAfterPublish: !!options.deleteAfterPublish,
      });
      return published;
    }
    keepOpen = true;
    console.error('[publish] not confirmed published', { accountId, materialId, outcome: outcome.status });
    return {
      status: 'failed',
      error: '已点击发布，但未确认成功',
      screenshot: shot,
      material: { id: material.id, name: material.name, fileName: material.file_name },
    };
  } finally {
    if (!keepOpen && !forceKeepOpen) await closeConnection(connection);
  }
}

async function resumePublish(accountId, options = {}) {
  const wait = waitForSlot(`publish:${accountId}`, 3000);
  if (wait) await new Promise(resolve => setTimeout(resolve, wait));
  const saveTraffic = Boolean(options.saveTraffic);
  const connection = await connectAccount(accountId, '', 'publish');
  let keepOpen = false;
  try {
    const session = await inspectTikTokSession(connection.ws);
    if (!session.loggedIn) throw new Error('当前浏览器没有有效 TikTok 登录状态');
    const url = connection.page.url() || '';
    if (!/upload|tiktokstudio/i.test(url)) {
      await connection.page.goto('https://www.tiktok.com/upload', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      await connection.page.waitForTimeout(saveTraffic ? 2000 : 4000);
    }
    const security = await inspectPage(connection.page);
    if (security.blocked) {
      keepOpen = true;
      return { status: 'security_paused', reason: security.reason, manualRequired: true };
    }
    await dismissPublishDialogs(connection.page);
    await clearStuckPublishMask(connection.page);
    const clicked = await clickPostButton(connection.page);
    if (!clicked) {
      keepOpen = true;
      const shot = await capture(connection.page, accountId, 'publish', 'resume-miss').catch(() => '');
      return { status: 'failed', error: '未找到发布按钮，请确认页面仍在上传/编辑态', screenshot: shot };
    }
    const outcome = await drivePublishConfirmations(connection.page, saveTraffic ? 90000 : 150000);
    const shot = await capture(connection.page, accountId, 'publish', 'resume-posted').catch(() => '');
    if (outcome.status === 'security_paused') {
      keepOpen = true;
      return { status: 'security_paused', reason: outcome.reason, screenshot: shot, manualRequired: true };
    }
    if (outcome.status === 'published') {
      let videoId = outcome.videoId || '';
      let videoUrl = outcome.videoUrl || '';
      if (!videoId) {
        const meta = await resolvePublishedVideoMeta(
          connection.page,
          connection.account?.username || '',
          (m) => console.log(`resumePublish: ${m}`)
        ).catch(() => ({ videoId: '', videoUrl: '' }));
        videoId = meta.videoId || '';
        videoUrl = meta.videoUrl || '';
      }
      const published = { status: 'published', screenshot: shot, videoId, videoUrl };
      const mid = Number(options.materialId || options.material_id || 0);
      if (mid > 0) {
        await markMaterialPublishedCallback(accountId, mid, {
          videoId,
          videoUrl,
          deleteAfterPublish: !!options.deleteAfterPublish,
        });
      } else {
        console.warn('[mark-published] resumePublish missing materialId, skip material callback');
      }
      return published;
    }
    keepOpen = true;
    return { status: 'failed', error: '已点击发布，但未确认成功', screenshot: shot };
  } finally {
    if (!keepOpen) await closeConnection(connection);
  }
}

const {
  fillProfileField,
  clickProfileSave,
  openEditProfile,
  applyEditProfileChanges,
} = require('./tiktok-profile');

function pickDistributed(list, index, strategy = 'sequential') {
  if (!Array.isArray(list) || !list.length) return '';
  if (strategy === 'random') return list[Math.floor(Math.random() * list.length)];
  return list[index % list.length];
}

/** 通过比特环境打开 TikTok 资料编辑页并修改昵称/签名/头像 */
async function modifyTikTokProfile(accountId, options = {}) {
  const nickname = String(options.nickname || '').trim();
  const signature = String(options.signature || '').trim();
  let avatarPath = String(options.avatarPath || options.avatarUrl || '').trim();
  if (!nickname && !signature && !avatarPath) throw new Error('未指定要修改的昵称、签名或头像');

  if (avatarPath) {
    const path = require('node:path');
    const fs = require('node:fs');
    const { uploadDir } = require('../../routes/uploads');
    // 上传接口返回 /uploads/xxx.jpg → 解析为本地绝对路径
    const m = avatarPath.match(/^\/?uploads\/([^/\\]+)$/i)
      || avatarPath.match(/\/uploads\/([^/\\]+)(?:\?|$)/i);
    if (m) {
      avatarPath = path.join(uploadDir, m[1]);
    }
    if (!path.isAbsolute(avatarPath)) {
      avatarPath = path.resolve(process.cwd(), avatarPath);
    }
    if (!fs.existsSync(avatarPath)) throw new Error(`头像文件不存在：${avatarPath}`);
  }

  const connection = await connectAccount(accountId, null, 'profile');
  let keepOpen = false;
  try {
    const session = await inspectTikTokSession(connection.ws);
    if (!session.loggedIn) throw new Error('当前浏览器没有有效 TikTok 登录状态');
    const handle = connection.account.username;
    const opened = await openEditProfile(connection.page, handle);
    if (!opened) {
      keepOpen = true;
      const shot = await capture(connection.page, accountId, 'profile', 'edit-miss').catch(() => '');
      return { status: 'failed', error: '未找到「编辑资料」按钮，请确认已登录本人主页', screenshot: shot };
    }

    let changed = false;
    const { publish: liveLog } = require('../live-log');
    const log = (msg) => liveLog(`Profile#${accountId}: ${msg}`, 'info', { accountId });
    changed = await applyEditProfileChanges(connection.page, {
      nickname,
      bio: signature,
      avatarPath,
    }, log);
    if (changed === 'name_locked') {
      return {
        status: 'ok',
        nameLocked: true,
        nickname,
        message: 'Name 当前受 7 天修改限制（非输入框），已跳过',
      };
    }
    if (!changed) {
      keepOpen = true;
      const shot = await capture(connection.page, accountId, 'profile', 'fields-miss').catch(() => '');
      return { status: 'failed', error: '未找到可编辑的 Bio / 头像字段（Name 若不可改已自动跳过）', screenshot: shot };
    }

    const saved = await clickProfileSave(connection.page);
    if (!saved) {
      keepOpen = true;
      const shot = await capture(connection.page, accountId, 'profile', 'save-miss').catch(() => '');
      return { status: 'failed', error: '已填写资料但未找到保存按钮', screenshot: shot, manualRequired: true };
    }
    await connection.page.waitForTimeout(2000);
    const shot = await capture(connection.page, accountId, 'profile', 'saved').catch(() => '');
    if (nickname) {
      await phpApi.patch(`/accounts/${accountId}/nickname`, { nickname }).catch(() => {});
    }
    return { status: 'ok', nickname, signature: signature || undefined, screenshot: shot };
  } finally {
    if (!keepOpen) await closeConnection(connection);
  }
}

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

async function batchModifyTikTokProfiles(accountIds, options = {}) {
  const nicknameList = String(options.nicknameList || '')
    .split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const signatureList = String(options.signatureList || '')
    .split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const avatarFolder = String(options.avatarFolder || '').trim();
  const strategy = options.distributionStrategy === 'random' ? 'random' : 'sequential';
  const threads = Math.min(5, Math.max(1, Number(options.threads) || 1));
  const modifyNickname = options.modifyNickname !== false && nicknameList.length > 0;
  const modifySignature = options.modifySignature !== false && signatureList.length > 0;
  const modifyAvatar = options.modifyAvatar === true && avatarFolder;

  const fs = require('node:fs');
  const path = require('node:path');
  let avatars = [];
  if (modifyAvatar) {
    if (!fs.existsSync(avatarFolder) || !fs.statSync(avatarFolder).isDirectory()) {
      throw new Error('头像文件夹不存在或不是目录');
    }
    avatars = fs.readdirSync(avatarFolder)
      .filter((name) => /\.(jpe?g|png|webp|gif)$/i.test(name))
      .map((name) => path.join(avatarFolder, name));
    if (!avatars.length) throw new Error('头像文件夹内没有可用图片');
  }
  if (!modifyNickname && !modifySignature && !modifyAvatar) {
    throw new Error('请至少开启昵称、签名或头像其中一项');
  }

  const items = await runPool(accountIds, threads, async (accountId, index) => {
    try {
      const result = await modifyTikTokProfile(accountId, {
        nickname: modifyNickname ? pickDistributed(nicknameList, index, strategy) : '',
        signature: modifySignature ? pickDistributed(signatureList, index, strategy) : '',
        avatarPath: modifyAvatar ? pickDistributed(avatars, index, strategy) : '',
      });
      return { accountId, ok: result.status === 'ok', ...result };
    } catch (error) {
      return { accountId, ok: false, status: 'failed', error: error.message };
    }
  });
  return {
    items,
    success: items.filter((x) => x.ok).length,
    failed: items.filter((x) => !x.ok).length,
  };
}

/** 在 Studio DOM（含 shadow / iframe）里找搜索框并打标 */
async function markStudioSearchInput(page) {
  const frames = [page.mainFrame(), ...page.frames().filter((f) => f !== page.mainFrame())];
  let last = { ok: false, url: page.url(), placeholders: [] };
  for (const frame of frames) {
    const ok = await frame.evaluate(() => {
      const walk = (root, out = []) => {
        root.querySelectorAll?.('input, textarea').forEach((n) => out.push(n));
        root.querySelectorAll?.('*').forEach((n) => {
          if (n.shadowRoot) walk(n.shadowRoot, out);
        });
        return out;
      };
      document.querySelectorAll('[data-tk-studio-search]').forEach((n) => n.removeAttribute('data-tk-studio-search'));
      const inputs = walk(document);
      const score = (el) => {
        const ph = `${el.getAttribute('placeholder') || ''} ${el.getAttribute('aria-label') || ''} ${el.getAttribute('name') || ''} ${el.className || ''}`;
        let s = 0;
        if (/Search for post description/i.test(ph)) s += 100;
        if (/search.*post|post.*description|搜索.*(作品|描述|标题)/i.test(ph)) s += 50;
        if (/search|搜索/i.test(ph)) s += 20;
        if (el.type === 'search') s += 10;
        if (el.offsetParent === null && el.getClientRects().length === 0) s -= 30;
        return s;
      };
      inputs.sort((a, b) => score(b) - score(a));
      const best = inputs.find((el) => score(el) > 0);
      if (!best) {
        return {
          ok: false,
          url: location.href,
          placeholders: inputs.slice(0, 12).map((el) => el.getAttribute('placeholder') || el.getAttribute('aria-label') || el.type || ''),
        };
      }
      best.setAttribute('data-tk-studio-search', '1');
      try { best.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch { /* ignore */ }
      return {
        ok: true,
        url: location.href,
        placeholder: best.getAttribute('placeholder') || best.getAttribute('aria-label') || '',
      };
    }).catch(() => null);
    if (ok?.ok) return ok;
    if (ok) last = ok;
  }
  return last;
}

/** 按标题/ID 在当前列表里标记匹配行（可不搜索，滚动查找） */
async function markStudioContentRow(page, needle) {
  const n = String(needle || '').trim();
  if (!n) return false;
  return page.evaluate((text) => {
    document.querySelectorAll('[data-tk-del-row]').forEach((el) => el.removeAttribute('data-tk-del-row'));
    const rows = [...document.querySelectorAll('tr, [role="row"], [class*="Row"], [class*="row"], li, [class*="Item"], [class*="item"], [class*="card" i], [class*="Card"]')];
    for (const row of rows) {
      const t = (row.innerText || '').replace(/\s+/g, ' ');
      if (!t.includes(text)) continue;
      if (/^Posts|Privacy|Views|Likes|Comments|Actions/i.test(t) && t.length < 100) continue;
      // 行里最好有操作按钮痕迹
      row.setAttribute('data-tk-del-row', '1');
      try { row.scrollIntoView({ block: 'center' }); } catch { /* ignore */ }
      return true;
    }
    const any = [...document.querySelectorAll('div, span, a, p, strong, b')].find((el) => {
      const t = (el.textContent || '').trim();
      return t === text || (t.includes(text) && t.length < 220);
    });
    if (!any) return false;
    const row = any.closest('tr, [role="row"], [class*="Row"], [class*="row"], li, [class*="Item"], [class*="item"], [class*="card" i], [class*="Card"]')
      || any.parentElement;
    if (!row) return false;
    row.setAttribute('data-tk-del-row', '1');
    try { row.scrollIntoView({ block: 'center' }); } catch { /* ignore */ }
    return true;
  }, n).catch(() => false);
}

/**
 * 与发布一致：Studio 列表显示的「作品名」= 发布时填入的标题。
 * 发布表单默认：shareTitle || material.name；禁止用同步描述里的 videoplayback 等垃圾串。
 */
function isJunkPublishTitle(raw) {
  let t = String(raw || '').trim();
  if (!t) return true;
  t = t.split(/\r?\n/).map((s) => s.trim()).find(Boolean) || '';
  if (!t) return true;
  if (/^\d{8,}$/.test(t)) return true;
  const base = t.replace(/\.[a-z0-9]{2,5}$/i, '').trim();
  if (/^(videoplayback|untitled|no title|tiktok|video|null|undefined|none|n\/a)$/i.test(t)) return true;
  if (/^(videoplayback|untitled|no title|tiktok|video|null|undefined|none|n\/a)$/i.test(base)) return true;
  return false;
}

function normalizePublishTitle(raw) {
  if (isJunkPublishTitle(raw)) return '';
  return String(raw || '').trim().split(/\r?\n/).map((s) => s.trim()).find(Boolean) || '';
}

/** 与发布弹窗同一套：分享标题 → 素材名 → 文件名（去垃圾） */
function titleFromMaterial(mat) {
  if (!mat || typeof mat !== 'object') return '';
  return normalizePublishTitle(
    mat.shareTitle
    || mat.share_title
    || mat.name
    || mat.fileName
    || mat.file_name
    || ''
  );
}

/** 解析 Studio 搜索用的发布标题（与发布字段一致，绝不用 video_id / videoplayback） */
async function resolveDeletePublishTitle(accountId, options = {}) {
  const pickTitle = (...vals) => {
    for (const v of vals) {
      const t = normalizePublishTitle(v);
      if (t) return t;
    }
    return '';
  };

  // 1) 入队时明确带的发布标题 / 素材名（description 最后且需过垃圾过滤）
  let title = pickTitle(
    options.publishTitle,
    options.publish_title,
    options.shareTitle,
    options.share_title,
    options.materialName,
    options.material_name,
    options.searchTitle,
    options.title,
    options.description
  );
  if (title) return { title, source: 'payload' };

  const mid = Number(options.materialId || options.material_id || 0);
  const videoId = String(options.videoId || options.video_id || '').trim();
  const idFromUrl = String(options.videoUrl || options.video_url || '').match(/\/video\/(\d+)/)?.[1] || '';
  const targetId = videoId || idFromUrl;

  // 2) 按 materialId 取素材（与发布同一字段）
  if (mid > 0) {
    const mat = await phpApi.get(`/node/materials/${mid}`).catch(() => phpApi.get(`/materials/${mid}`).catch(() => null));
    title = titleFromMaterial(mat);
    if (title) return { title, source: `material#${mid}` };
  }

  // 3) 该账号已发布素材：按 platform_video_id 精确匹配
  try {
    const pack = await phpApi.get(`/materials?publishAccountId=${Number(accountId) || 0}&publishStatus=published`).catch(() => null);
    const items = Array.isArray(pack) ? pack : (pack?.items || []);
    let mat = null;
    if (targetId) {
      mat = items.find((m) => String(m.platformVideoId || m.platform_video_id || '').trim() === targetId) || null;
    }
    if (!mat && mid > 0) {
      mat = items.find((m) => Number(m.id) === mid) || null;
    }
    title = titleFromMaterial(mat);
    if (title) return { title, source: `materials-by-account#${mat?.id || '?'}` };
  } catch { /* ignore */ }

  // 4) 全库按 platform_video_id
  if (targetId) {
    try {
      const pack = await phpApi.get('/materials').catch(() => null);
      const items = Array.isArray(pack) ? pack : (pack?.items || []);
      const mat = items.find((m) => String(m.platformVideoId || m.platform_video_id || '').trim() === targetId) || null;
      title = titleFromMaterial(mat);
      if (title) return { title, source: `materials-by-video#${mat?.id || '?'}` };
    } catch { /* ignore */ }
  }

  // 5) 最后才用同步描述，且必须不是 videoplayback 之类
  if (targetId) {
    try {
      const videos = await phpApi.get(`/accounts/${accountId}/tiktok-videos`).catch(() => []);
      const list = Array.isArray(videos) ? videos : (videos?.items || []);
      const hit = list.find((v) => String(v.video_id || v.videoId || '').trim() === targetId);
      title = pickTitle(hit?.description);
      if (title) return { title, source: 'tiktok_videos.description' };
    } catch { /* ignore */ }
  }

  return { title: '', source: 'none' };
}

/** Studio 内容列表：用「发布标题」搜索 → 三点 → Delete → 确认。禁止用 video_id 搜索，禁止打开公开直链。 */
async function deleteTikTokVideo(accountId, options = {}) {
  const videoId = String(options.videoId || options.video_id || '').trim();
  let videoUrl = String(options.videoUrl || options.video_url || '').trim();
  const idFromUrl = videoUrl.match(/\/video\/(\d+)/)?.[1] || '';
  const targetId = videoId || idFromUrl; // 仅用于删库回写，绝不用于 Studio 搜索

  const resolved = await resolveDeletePublishTitle(accountId, options);
  const title = String(resolved.title || '').trim();
  const firstLine = title.split(/\r?\n/).map((s) => s.trim()).find(Boolean) || '';
  const searchTerms = [...new Set([firstLine, title].filter(Boolean))];
  if (!searchTerms.length) {
    throw new Error(
      `缺少发布标题（分享标题/素材名），无法在 Studio 搜索。videoId=${targetId || '-'} materialId=${options.materialId || options.material_id || 0}。请重新从删除向导勾选（需带发布标题），或先同步视频/确认素材已回写平台ID。`
    );
  }

  const connection = await connectAccount(accountId, null, 'profile');
  let keepOpen = false;
  const log = (msg) => {
    try {
      const { publish: liveLog } = require('../live-log');
      liveLog(`[delete-video] #${accountId} ${msg}`, 'info', { accountId, videoId: targetId, title: firstLine });
    } catch { /* ignore */ }
    console.log(`[delete-video] #${accountId}`, msg);
  };
  log(`publish title="${firstLine}" via ${resolved.source}`);

  try {
    const session = await inspectTikTokSession(connection.ws);
    if (!session.loggedIn) throw new Error('当前浏览器没有有效 TikTok 登录状态');
    const page = connection.page;

    // 只进 Studio 作品列表（强制英文 UI，便于匹配文案），绝不 goto 公开 /video/ 直链
    const studioUrls = [
      'https://www.tiktok.com/tiktokstudio/content?lang=en',
      'https://www.tiktok.com/tiktokstudio/content?tab=video&lang=en',
      'https://www.tiktok.com/tiktokstudio/content',
    ];
    let listReady = false;
    for (const studioUrl of studioUrls) {
      log(`open studio list ${studioUrl}`);
      await page.goto(studioUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      // SPA 等列表头出现
      for (let i = 0; i < 20; i++) {
        const ready = await page.evaluate(() => {
          const t = (document.body?.innerText || '').slice(0, 8000);
          return /Posts\s*\(Created on\)|Search for post description|Views[\s\S]{0,40}Likes|Privacy/i.test(t)
            || !!document.querySelector('input[placeholder*="Search" i], input[placeholder*="搜索"]');
        }).catch(() => false);
        if (ready) {
          listReady = true;
          break;
        }
        await page.waitForTimeout(500);
      }
      if (listReady) break;
    }
    log(`studio url=${page.url()} ready=${listReady}; search by publish title="${firstLine}"`);

    let boxMarked = await markStudioSearchInput(page);
    if (!boxMarked.ok) {
      await page.waitForTimeout(2500);
      boxMarked = await markStudioSearchInput(page);
    }

    let matchedTerm = '';
    if (boxMarked.ok) {
      const box = page.locator('[data-tk-studio-search="1"]').first();
      log(`search box ok: ${boxMarked.placeholder || '(no placeholder)'}`);
      for (const term of searchTerms) {
        log(`search publish title: ${term}`);
        await box.click({ timeout: 8000 }).catch(() => {});
        await box.fill('').catch(() => {});
        await box.fill(term).catch(async () => {
          await page.keyboard.type(term, { delay: 20 });
        });
        await page.keyboard.press('Enter').catch(() => {});
        await page.waitForTimeout(2200);
        if (await markStudioContentRow(page, term)) {
          matchedTerm = term;
          break;
        }
      }
    } else {
      log(`search box miss placeholders=${JSON.stringify(boxMarked.placeholders || [])}; fallback scroll list by title`);
    }

    // 无搜索框或搜索没命中：直接在列表里按发布标题滚找（仍不用 video_id）
    if (!matchedTerm) {
      for (const term of searchTerms) {
        for (let round = 0; round < 10; round++) {
          if (await markStudioContentRow(page, term)) {
            matchedTerm = term;
            break;
          }
          await page.mouse.wheel(0, 1200).catch(() => {});
          await page.waitForTimeout(700);
        }
        if (matchedTerm) break;
      }
    }

    if (!matchedTerm) {
      keepOpen = true;
      const shot = await capture(page, accountId, 'video', 'studio-row-miss').catch(() => '');
      const ph = (boxMarked.placeholders || []).filter(Boolean).slice(0, 6).join(' | ');
      return {
        status: 'failed',
        error: `Studio 未按发布标题找到视频「${firstLine}」${boxMarked.ok ? '' : `；搜索框未识别${ph ? `，页内输入框: ${ph}` : ''}`}。当前页: ${(page.url() || '').slice(0, 120)}`,
        via: 'studio-list',
        screenshot: shot,
      };
    }

    log(`matched row by publish title "${matchedTerm}", open ⋯ menu`);
    const row = page.locator('[data-tk-del-row="1"]').first();
    const moreBtn = row.locator(
      'button[aria-label*="More" i], button[aria-label*="更多"], button:has-text("···"), button:has-text("…"), button:has-text("...")'
    ).last();
    if (await moreBtn.count().catch(() => 0)) {
      await moreBtn.click({ timeout: 8000 });
    } else {
      const actionBtns = row.locator('button, [role="button"]');
      const n = await actionBtns.count().catch(() => 0);
      if (n < 1) {
        keepOpen = true;
        const shot = await capture(page, accountId, 'video', 'more-miss').catch(() => '');
        return { status: 'failed', error: '找到视频行但未找到「⋯」更多按钮', via: 'studio-list', screenshot: shot };
      }
      await actionBtns.nth(n - 1).click({ timeout: 8000 });
    }
    await page.waitForTimeout(900);

    log('click menu Delete');
    let menuDelete = null;
    const menuCandidates = [
      page.getByRole('menuitem', { name: /^Delete$|^删除$/i }).first(),
      page.locator('[role="menu"] [role="menuitem"]').filter({ hasText: /^Delete$|^删除$/i }).first(),
      page.locator('[role="menu"]').getByText(/^Delete$|^删除$/i).first(),
      page.getByText(/^Delete$/).last(),
      page.getByText(/^删除$/).last(),
    ];
    for (const c of menuCandidates) {
      if (await c.count().catch(() => 0) && await c.isVisible().catch(() => false)) {
        menuDelete = c;
        break;
      }
    }
    if (!menuDelete) {
      keepOpen = true;
      const shot = await capture(page, accountId, 'video', 'menu-delete-miss').catch(() => '');
      return { status: 'failed', error: '已点⋯但未出现 Delete/删除', via: 'studio-list', screenshot: shot };
    }
    await menuDelete.click({ timeout: 8000 });
    await page.waitForTimeout(1000);

    log('confirm Delete post?');
    const dialogCandidates = [
      page.getByRole('dialog').filter({ hasText: /Delete post|删除作品|删除帖子|Recently deleted/i }).first(),
      page.locator('[role="dialog"]').filter({ hasText: /Delete post|删除/i }).first(),
      page.locator('[class*="Modal"], [class*="modal"], [class*="Dialog"]').filter({ hasText: /Delete post|删除/i }).first(),
    ];
    let dialog = null;
    for (const c of dialogCandidates) {
      if (await c.count().catch(() => 0) && await c.isVisible().catch(() => false)) {
        dialog = c;
        break;
      }
    }

    let confirmBtn = null;
    if (dialog) {
      confirmBtn = dialog.getByRole('button', { name: /^Delete$|^删除$/i }).first();
      if (!(await confirmBtn.count().catch(() => 0))) {
        confirmBtn = dialog.locator('button').filter({ hasText: /^Delete$|^删除$/i }).first();
      }
    }
    if (!confirmBtn || !(await confirmBtn.count().catch(() => 0))) {
      confirmBtn = page.getByRole('button', { name: /^Delete$/i }).last();
    }
    if (!(await confirmBtn.count().catch(() => 0))) {
      keepOpen = true;
      const shot = await capture(page, accountId, 'video', 'confirm-miss').catch(() => '');
      return { status: 'failed', error: '未出现「Delete post?」确认弹框', via: 'studio-list', screenshot: shot };
    }
    await confirmBtn.click({ timeout: 8000 });
    await page.waitForTimeout(2200);

    const shot = await capture(page, accountId, 'video', 'deleted').catch(() => '');
    if (targetId || videoUrl) {
      await phpApi.post(`/node/accounts/${accountId}/tiktok-videos/delete`, { videoId: targetId, videoUrl }).catch(() => {});
    }
    return {
      status: 'ok',
      videoId: targetId,
      videoUrl,
      title: matchedTerm,
      via: boxMarked.ok ? 'studio-search-delete' : 'studio-scroll-delete',
      screenshot: shot,
    };
  } finally {
    if (!keepOpen) await closeConnection(connection);
  }
}

async function batchDeleteTikTokVideos(accountIds, options = {}) {
  const keepLatest = Math.max(0, Number(options.keepLatest) || 0);
  const threads = Math.min(3, Math.max(1, Number(options.threads) || 1));
  const jobs = [];
  for (const accountId of accountIds) {
    let videos = [];
    try {
      videos = await phpApi.get(`/accounts/${accountId}/tiktok-videos`) || [];
    } catch {
      videos = [];
    }
    if (!Array.isArray(videos)) videos = [];
    const remove = videos.slice(keepLatest);
    for (const video of remove) {
      jobs.push({ accountId, video });
    }
  }
  if (!jobs.length) return { items: [], success: 0, failed: 0, deleted: 0 };

  const items = await runPool(jobs, threads, async (job) => {
    try {
      const result = await deleteTikTokVideo(job.accountId, {
        videoId: job.video.video_id || job.video.videoId,
        videoUrl: job.video.video_url || job.video.videoUrl,
        description: job.video.description || '',
        // 批量删也只按发布描述/标题搜，绝不用 video_id
        publishTitle: String(job.video.description || '').split(/\r?\n/).map((s) => s.trim()).find(Boolean) || '',
        searchTitle: String(job.video.description || '').split(/\r?\n/).map((s) => s.trim()).find(Boolean) || '',
      });
      return { accountId: job.accountId, videoId: job.video.video_id || job.video.videoId, ok: result.status === 'ok', ...result };
    } catch (error) {
      return { accountId: job.accountId, videoId: job.video.video_id || job.video.videoId, ok: false, status: 'failed', error: error.message };
    }
  });
  return {
    items,
    success: items.filter((x) => x.ok).length,
    failed: items.filter((x) => !x.ok).length,
    deleted: items.filter((x) => x.ok).length,
  };
}

module.exports = {
  connectAccount,
  preparePublish,
  resumePublish,
  prepareMessage,
  sendBitMessageBatch,
  closeConnection,
  forceCloseBrowserProfile,
  classify,
  modifyTikTokProfile,
  batchModifyTikTokProfiles,
  deleteTikTokVideo,
  batchDeleteTikTokVideos,
  markMaterialPublishedCallback,
};
