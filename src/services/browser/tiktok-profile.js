/**
 * TikTok 资料同步 / 编辑资料 浏览器封装
 * 同步资料流程：个人中心 → 编辑资料 → 填入信息 → 保存提交 → 回写本地
 */
const { chromium } = require('playwright-core');
const { BitBrowserProvider } = require('./bit-browser-provider');
const { inspectTikTokSession, pageLooksLoggedOut, pageLooksLoggedIn } = require('./cdp-client');
const { capture } = require('../automation-guard');
const dataStore = require('../data-store');
const phpApi = require('../php-api');
const { isHeadless } = require('./headless');

function numberFromText(value) {
  const text = String(value || '').replace(/,/g, '').trim().toUpperCase();
  const match = text.match(/([0-9]+(?:\.[0-9]+)?)([KMB])?/);
  if (!match) return null;
  const multiplier = { K: 1e3, M: 1e6, B: 1e9 }[match[2]] || 1;
  return Math.round(Number(match[1]) * multiplier);
}

function extractStat(text, labels) {
  for (const label of labels) {
    // "Followers 12" / "粉丝 12"
    let match = String(text || '').match(new RegExp(`(${label})\\s*([0-9][0-9,.]*\\s*[KMB]?)`, 'i'));
    if (match) return numberFromText(match[2]);
    // "12 Followers" / "12 粉丝"（个人主页常见）
    match = String(text || '').match(new RegExp(`([0-9][0-9,.]*\\s*[KMB]?)\\s*(${label})\\b`, 'i'));
    if (match) return numberFromText(match[1]);
  }
  return null;
}

async function loadAccount(accountId) {
  const bundle = await dataStore.getAccountBundle(accountId);
  if (!bundle) throw new Error('账号不存在');
  return {
    id: bundle.id,
    username: bundle.username,
    nickname: String(bundle.nickname || '').trim(),
    profileBio: String(bundle.profile_bio || bundle.profileBio || '').trim(),
    profileAvatar: String(bundle.profile_avatar || bundle.profileAvatar || '').trim(),
    browser_profile_id: bundle.browser_profile_id,
  };
}

async function openBitPage(account, action = 'profile') {
  if (!account.browser_profile_id) throw new Error('账号尚未绑定浏览器环境');
  const provider = new BitBrowserProvider();
  const opened = await provider.open(account.browser_profile_id, { headless: isHeadless(action) });
  if (!opened?.ws) throw new Error('比特浏览器未返回 CDP WebSocket 地址');
  const browser = await chromium.connectOverCDP(opened.ws, { timeout: 30000 });
  const context = browser.contexts()[0];
  const page = context.pages().find((item) => /tiktok\.com/i.test(item.url()))
    || context.pages()[0]
    || await context.newPage();
  await page.bringToFront().catch(() => {});
  return { provider, browser, page, ws: opened.ws };
}

async function closeBitPage(session, account) {
  if (!session) return;
  if (session.browser) await session.browser.close().catch(() => {});
  if (session.provider && account?.browser_profile_id) {
    let keep = false;
    try {
      const { shouldKeepBrowserOpen } = require('../session-context');
      keep = shouldKeepBrowserOpen();
    } catch { /* ignore */ }
    if (!keep) await session.provider.close(account.browser_profile_id).catch(() => {});
  }
}

/**
 * 编辑资料弹框内操作：只改 Name / Bio / Logo，绝不改 Username。
 * Logo：头像右下角编辑图标 → filechooser / input[type=file]
 */

async function waitBrief(page, ms = 200) {
  await page.waitForTimeout(ms).catch(() => {});
}

/** React controlled input：用原生 value setter 触发 input/change */
async function setReactInputValue(locator, value) {
  const el = locator.first();
  if (!(await el.count().catch(() => 0))) return false;
  if (!(await el.isVisible().catch(() => false))) return false;
  await el.click({ timeout: 5000 }).catch(() => {});
  const ok = await el.evaluate((node, next) => {
    const tag = (node.tagName || '').toLowerCase();
    const proto =
      tag === 'textarea'
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    const fire = (type) => {
      node.dispatchEvent(new Event(type, { bubbles: true }));
      try {
        node.dispatchEvent(new InputEvent(type, { bubbles: true, data: String(next ?? ''), inputType: 'insertText' }));
      } catch (_) {}
    };
    node.focus();
    if (setter) setter.call(node, '');
    else node.value = '';
    fire('input');
    if (setter) setter.call(node, String(next ?? ''));
    else node.value = String(next ?? '');
    fire('input');
    node.dispatchEvent(new Event('change', { bubbles: true }));
    try {
      node.blur();
    } catch (_) {}
    return String(node.value ?? '') === String(next ?? '');
  }, String(value ?? '')).catch(() => false);

  if (!ok) {
    await el.fill(String(value ?? '')).catch(async () => {
      await el.press('Control+A').catch(() => {});
      await el.type(String(value ?? ''), { delay: 15 }).catch(() => {});
    });
  }
  const cur = await el.inputValue().catch(async () => (await el.textContent().catch(() => '')) || '');
  return String(cur).trim() === String(value ?? '').trim()
    || String(cur).includes(String(value ?? '').trim());
}

function fieldMeta(attrs = {}) {
  return `${attrs.e2e || ''} ${attrs.name || ''} ${attrs.placeholder || ''} ${attrs.aria || ''} ${attrs.id || ''}`.toLowerCase();
}

function looksLikeUsername(meta) {
  return /username|unique.?id|user.?name|edit-profile-username|@/.test(meta);
}

function looksLikeName(meta) {
  if (looksLikeUsername(meta)) return false;
  return /edit-profile-name|nickname|display.?name|(^|[^a-z])name([^a-z]|$)|昵称|名字/.test(meta);
}

function looksLikeBio(meta, tag = '') {
  return /bio|签名|简介|desc|edit-profile-bio/.test(meta) || tag === 'textarea';
}

async function listEditInputs(page) {
  return page.evaluate(() => {
    const root = document.querySelector('[role="dialog"]')
      || document.querySelector('[class*="DivEditProfileContainer"]')
      || document.querySelector('[class*="edit-profile"]')
      || document.body;
    const nodes = Array.from(root.querySelectorAll('input, textarea'));
    return nodes.map((el, index) => {
      const rect = el.getBoundingClientRect();
      return {
        index,
        tag: el.tagName.toLowerCase(),
        type: (el.getAttribute('type') || '').toLowerCase(),
        e2e: el.getAttribute('data-e2e') || '',
        name: el.getAttribute('name') || '',
        id: el.id || '',
        placeholder: el.getAttribute('placeholder') || '',
        aria: el.getAttribute('aria-label') || '',
        value: el.value || '',
        visible: !!(rect.width && rect.height && el.offsetParent !== null),
      };
    }).filter((x) => x.visible && x.type !== 'hidden' && x.type !== 'file');
  }).catch(() => []);
}

/** Name 是否因 7 天限制变成只读文案（非 input） */
async function isNameFieldEditable(page) {
  const dialog = page.locator('[role="dialog"]').first();
  const scope = (await dialog.count().catch(() => 0)) ? dialog : page;

  const byE2e = scope.locator('input[data-e2e="edit-profile-name-input"]').first();
  if (await byE2e.count().catch(() => 0)) {
    const visible = await byE2e.isVisible().catch(() => false);
    const disabled = await byE2e.isDisabled().catch(() => true);
    const readonly = await byE2e.getAttribute('readonly').catch(() => null);
    if (visible && !disabled && readonly == null) return { editable: true, locator: byE2e };
    return { editable: false, reason: 'name-input-locked' };
  }

  return page.evaluate(() => {
    const visible = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
    };
    const isUsernameish = (t) => /username|用户名|handle|@/.test(String(t || '').toLowerCase());
    const isNameLabel = (t) => {
      const x = String(t || '').trim().toLowerCase();
      if (!x || isUsernameish(x) || x.length > 24) return false;
      return x === 'name' || x === 'nickname' || x === 'display name'
        || x === '昵称' || x === '名字' || x === '名称';
    };
    const root = document.querySelector('[role="dialog"]')
      || document.querySelector('[class*="DivEditProfileContainer"]')
      || document.body;
    const labels = Array.from(root.querySelectorAll('label, span, div, p, strong, b'));
    for (const n of labels) {
      if (!visible(n)) continue;
      const t = (n.textContent || '').trim();
      if (!isNameLabel(t)) continue;
      if (n.closest('button, a, [role="button"]')) continue;
      let row = n.parentElement;
      for (let d = 0; d < 6 && row; d++) {
        const inputs = [...row.querySelectorAll('input:not([type="hidden"]):not([type="file"]), textarea')]
          .filter((el) => visible(el) && !n.contains(el));
        for (const el of inputs) {
          const meta = `${el.getAttribute('data-e2e') || ''} ${el.getAttribute('name') || ''} ${el.getAttribute('aria-label') || ''}`.toLowerCase();
          if (isUsernameish(meta) || /bio|简介/.test(meta)) continue;
          if (el.disabled || el.readOnly) continue;
          return { editable: true };
        }
        const rowText = (row.innerText || '').replace(/\s+/g, ' ');
        if (/nickname can only be changed|can change it again after|每\s*7\s*天|天后/i.test(rowText)) {
          return { editable: false, reason: 'cooldown' };
        }
        row = row.parentElement;
      }
    }
    const body = (root.innerText || '');
    if (/nickname can only be changed|can change it again after|每\s*7\s*天/i.test(body)) {
      return { editable: false, reason: 'cooldown' };
    }
    return { editable: false, reason: 'no-name-input' };
  }).catch(() => ({ editable: false, reason: 'probe-failed' }));
}

/**
 * 仅当 Name 是可编辑 input 时才填写；7 天限制变成只读文案时直接跳过，不强填。
 */
async function fillNameInEditModal(page, value, log = () => {}) {
  if (!value) return false;

  const state = await isNameFieldEditable(page);
  if (!state.editable) {
    log(`name: skip (not an editable input${state.reason ? `, ${state.reason}` : ''})`);
    return false;
  }

  const byE2e = page.locator('input[data-e2e="edit-profile-name-input"]').first();
  if (await byE2e.count().catch(() => 0) && await byE2e.isVisible().catch(() => false)) {
    if (await byE2e.isDisabled().catch(() => true)) {
      log('name: skip (input disabled)');
      return false;
    }
    if (await setReactInputValue(byE2e, value)) {
      log('name: filled via data-e2e');
      return true;
    }
  }

  const byLabel = page.getByLabel(/^Name$/i).first();
  if (await byLabel.count().catch(() => 0) && await byLabel.isVisible().catch(() => false)) {
    const tag = await byLabel.evaluate((el) => (el.tagName || '').toLowerCase()).catch(() => '');
    if (tag === 'input' || tag === 'textarea') {
      const disabled = await byLabel.isDisabled().catch(() => true);
      const readonly = await byLabel.getAttribute('readonly').catch(() => null);
      if (!disabled && readonly == null) {
        const meta = fieldMeta({
          e2e: await byLabel.getAttribute('data-e2e').catch(() => ''),
          name: await byLabel.getAttribute('name').catch(() => ''),
          placeholder: await byLabel.getAttribute('placeholder').catch(() => ''),
          aria: await byLabel.getAttribute('aria-label').catch(() => ''),
        });
        if (!looksLikeUsername(meta) && (await setReactInputValue(byLabel, value))) {
          log('name: filled via label');
          return true;
        }
      }
    }
  }

  const handle = await page.evaluateHandle(() => {
    const visible = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
    };
    const isUsernameish = (t) => /username|用户名|handle|@/.test(String(t || '').toLowerCase());
    const isNameLabel = (t) => {
      const x = String(t || '').trim().toLowerCase();
      if (!x || isUsernameish(x) || x.length > 24) return false;
      return x === 'name' || x === 'nickname' || x === 'display name'
        || x === '昵称' || x === '名字' || x === '名称';
    };
    const dialog = document.querySelector('[role="dialog"]')
      || document.querySelector('[class*="DivEditProfileContainer"]')
      || document.querySelector('[class*="edit-profile"]')
      || document.body;
    const labels = Array.from(dialog.querySelectorAll('label, span, div, p, strong, b'));
    for (const n of labels) {
      if (!visible(n)) continue;
      const t = (n.textContent || '').trim();
      if (!isNameLabel(t)) continue;
      if (n.closest('button, a, [role="button"]')) continue;
      if (n.tagName === 'LABEL' && n.htmlFor) {
        const byFor = document.getElementById(n.htmlFor);
        if (byFor && visible(byFor) && !byFor.disabled && !byFor.readOnly
          && !isUsernameish(byFor.getAttribute('data-e2e') || '')) {
          return byFor;
        }
      }
      let row = n.parentElement;
      for (let i = 0; i < 6 && row; i++) {
        const inputs = [...row.querySelectorAll('input:not([type="hidden"]):not([type="file"]), textarea')]
          .filter((el) => visible(el) && !n.contains(el) && !el.disabled && !el.readOnly);
        for (const el of inputs) {
          const meta = `${el.getAttribute('data-e2e') || ''} ${el.getAttribute('name') || ''} ${el.getAttribute('aria-label') || ''}`.toLowerCase();
          if (isUsernameish(meta) || /bio|简介/.test(meta)) continue;
          return el;
        }
        row = row.parentElement;
      }
    }
    return null;
  });

  const el = handle.asElement?.() || null;
  if (el) {
    const filled = await el.evaluate((node, next) => {
      if (node.disabled || node.readOnly) return false;
      const tag = (node.tagName || '').toLowerCase();
      if (tag !== 'input' && tag !== 'textarea') return false;
      const proto = tag === 'textarea'
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      node.focus();
      if (setter) setter.call(node, '');
      else node.value = '';
      node.dispatchEvent(new Event('input', { bubbles: true }));
      if (setter) setter.call(node, String(next ?? ''));
      else node.value = String(next ?? '');
      node.dispatchEvent(new Event('input', { bubbles: true }));
      node.dispatchEvent(new Event('change', { bubbles: true }));
      return String(node.value ?? '') === String(next ?? '');
    }, String(value)).catch(() => false);
    if (filled) {
      log('name: filled via nearby input');
      return true;
    }
  }

  log('name: skip (no editable Name input found)');
  return false;
}

async function fillBioInEditModal(page, value) {
  if (!value) return false;
  const byE2e = page.locator('textarea[data-e2e="edit-profile-bio-input"]').first();
  if (await byE2e.count().catch(() => 0) && await byE2e.isVisible().catch(() => false)) {
    if (await setReactInputValue(byE2e, value)) return true;
  }
  const byLabel = page.getByLabel(/^Bio$/i).first();
  if (await byLabel.count().catch(() => 0) && await byLabel.isVisible().catch(() => false)) {
    if (await setReactInputValue(byLabel, value)) return true;
  }
  const area = page.locator('[role="dialog"] textarea, textarea[placeholder*="Bio" i]').first();
  if (await area.count().catch(() => 0) && await area.isVisible().catch(() => false)) {
    if (await setReactInputValue(area, value)) return true;
  }
  return false;
}

/**
 * 在 Edit profile 弹层内找图片 file input（含隐藏 / accept 过滤）。
 */
async function findAvatarFileInput(page, waitMs = 3000) {
  const end = Date.now() + waitMs;
  const selectors = [
    '[role="dialog"] input[type="file"][accept*="image"]',
    '[role="dialog"] input[type="file"][accept*="jpg"]',
    '[role="dialog"] input[type="file"][accept*="png"]',
    '[role="dialog"] input[type="file"]',
    'input[type="file"][accept*="image"]',
    'input[type="file"][accept*="jpg"]',
    'input[type="file"]',
  ];
  while (Date.now() < end) {
    for (const sel of selectors) {
      const loc = page.locator(sel).first();
      if (await loc.count().catch(() => 0)) return loc;
    }
    // Shadow / late mount
    const handle = await page.evaluateHandle(() => {
      const walk = (root, out = []) => {
        root.querySelectorAll?.('input[type="file"]')?.forEach((n) => out.push(n));
        root.querySelectorAll?.('*')?.forEach((el) => {
          if (el.shadowRoot) walk(el.shadowRoot, out);
        });
        return out;
      };
      const dialog = document.querySelector('[role="dialog"]') || document.body;
      const inputs = walk(dialog);
      const prefer = inputs.find((i) => /image|jpg|jpeg|png|webp/i.test(i.getAttribute('accept') || ''))
        || inputs[0];
      return prefer || null;
    }).catch(() => null);
    const el = handle?.asElement?.() || null;
    if (el) return el;
    await waitBrief(page, 250);
  }
  return null;
}

/**
 * 定位 Profile photo 右下角铅笔（支持字母头像，无 img）。
 * 返回 ElementHandle 或 null。
 */
async function findAvatarPencil(page) {
  // 常见 data-e2e / aria
  for (const sel of [
    '[role="dialog"] [data-e2e="edit-profile-avatar-icon"]',
    '[role="dialog"] [data-e2e*="edit-profile-photo"]',
    '[role="dialog"] [data-e2e*="avatar-upload"]',
    '[role="dialog"] [data-e2e*="edit-avatar"]',
    '[role="dialog"] button[aria-label*="Edit profile photo" i]',
    '[role="dialog"] button[aria-label*="Change photo" i]',
    '[role="dialog"] button[aria-label*="Upload" i]',
    '[role="dialog"] label[for]',
  ]) {
    const loc = page.locator(sel).first();
    if (await loc.count().catch(() => 0) && await loc.isVisible().catch(() => false)) {
      return loc.elementHandle();
    }
  }

  return page.evaluateHandle(() => {
    const visible = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
    };
    const root = document.querySelector('[role="dialog"]')
      || document.querySelector('[class*="DivEditProfileContainer"]')
      || document.querySelector('[class*="edit-profile"]')
      || document.body;

    const attrHit = [...root.querySelectorAll('button, [role="button"], label, span, div, a')].find((el) => {
      if (!visible(el)) return false;
      const key = `${el.getAttribute('data-e2e') || ''} ${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''}`.toLowerCase();
      return /edit-profile-photo|edit-avatar|edit.?photo|change.?photo|edit.?avatar|upload.?photo|upload.?avatar|编辑头像|上传头像|更换头像|更换照片/.test(key)
        || (/avatar|photo|profile/.test(key) && /edit|upload|change|pencil/.test(key));
    });
    if (attrHit) return attrHit.closest('button, [role="button"], label, a') || attrHit;

    // Profile photo 区块
    const texts = [...root.querySelectorAll('span, div, p, label, h1, h2, h3, strong')].filter((n) => {
      if (!visible(n)) return false;
      const t = (n.textContent || '').trim();
      return /^Profile photo$/i.test(t) || /^头像$/i.test(t) || /^照片$/i.test(t) || /^Profile picture$/i.test(t);
    });

    const scoreCandidate = (c, ir) => {
      const cr = c.getBoundingClientRect();
      if (cr.width > 72 || cr.height > 72 || cr.width < 6 || cr.height < 6) return -1;
      const cx = cr.left + cr.width / 2;
      const cy = cr.top + cr.height / 2;
      const nearRight = cx >= ir.left + ir.width * 0.35;
      const nearBottom = cy >= ir.top + ir.height * 0.35;
      const dist = Math.hypot(cx - ir.right, cy - ir.bottom);
      if (!(dist < 120 || (nearRight && nearBottom))) return -1;
      const label = `${c.getAttribute('aria-label') || ''} ${c.getAttribute('data-e2e') || ''} ${c.className || ''}`.toLowerCase();
      let score = 10;
      if (/edit|upload|change|photo|camera|pencil|编辑|上传|更换|相机/.test(label)) score += 40;
      if (c.querySelector('svg') || c.tagName === 'svg' || c.querySelector('path')) score += 25;
      if (nearRight && nearBottom) score += 30;
      if (dist < 56) score += 20;
      // 小圆按钮（铅笔常见 24–40px）
      if (cr.width >= 18 && cr.width <= 44 && cr.height >= 18 && cr.height <= 44) score += 15;
      return score;
    };

    const findNearAvatar = (area) => {
      // 圆形头像：img / 字母占位 / Avatar 容器
      const avatars = [
        ...area.querySelectorAll('img'),
        ...area.querySelectorAll('[class*="Avatar"], [class*="avatar"], [class*="AvatarWrapper"]'),
        ...area.querySelectorAll('div, span'),
      ].filter((el) => {
        if (!visible(el)) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 48 || r.height < 48 || r.width > 220 || r.height > 220) return false;
        // 近似圆形
        if (Math.abs(r.width - r.height) > 24) return false;
        return true;
      });
      let best = null;
      let bestScore = -1;
      for (const av of avatars) {
        const ir = av.getBoundingClientRect();
        const pool = [
          ...area.querySelectorAll('button, [role="button"], label, span, div, a, svg'),
        ].filter(visible);
        for (const c of pool) {
          if (c === av || (av.contains && av.contains(c) && c !== av)) continue;
          const score = scoreCandidate(c, ir);
          if (score > bestScore) {
            bestScore = score;
            best = c.closest('button, [role="button"], label, a') || c;
          }
        }
      }
      return best;
    };

    for (const t of texts) {
      let row = t.parentElement;
      for (let i = 0; i < 6 && row; i++) {
        const hit = findNearAvatar(row);
        if (hit) return hit;
        row = row.parentElement;
      }
    }

    // 弹层上半区域：找带 svg 的小圆按钮（铅笔）
    const dialogBox = root.getBoundingClientRect();
    const topBtns = [...root.querySelectorAll('button, [role="button"], label, span, div')].filter((b) => {
      if (!visible(b)) return false;
      const r = b.getBoundingClientRect();
      if (r.top < dialogBox.top || r.top > dialogBox.top + 280) return false;
      if (r.width < 16 || r.width > 48 || r.height < 16 || r.height > 48) return false;
      return !!(b.querySelector('svg') || b.tagName === 'svg' || /edit|pencil|camera|upload/i.test(b.getAttribute('aria-label') || ''));
    });
    // 偏好更靠右下的
    topBtns.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return (br.left + br.top) - (ar.left + ar.top);
    });
    return topBtns[0] || null;
  });
}

/**
 * Logo：点头像右下角编辑图标 → 用 Playwright filechooser / setInputFiles（同视频上传）。
 * 禁止在没有 filechooser 监听时点击铅笔，否则会弹出系统「打开」对话框无法接管。
 */
async function setAvatarInEditModal(page, filePath, log = () => {}) {
  if (!filePath) return false;
  const fs = require('node:fs');
  if (!fs.existsSync(filePath)) throw new Error(`头像文件不存在：${filePath}`);

  const setFiles = async (target) => {
    if (!target) return false;
    try {
      if (typeof target.setInputFiles === 'function') {
        await target.setInputFiles(filePath);
        return true;
      }
    } catch (_) {}
    try {
      await target.setFiles?.(filePath);
      return true;
    } catch (_) {}
    try {
      await target.setInputFiles(filePath);
      return true;
    } catch (_) {}
    return false;
  };

  // A) 已有 input：直接 setInputFiles，不点铅笔（避免系统对话框）
  log('avatar: try direct input[type=file]');
  let input = await findAvatarFileInput(page, 2500);
  if (input && await setFiles(input)) {
    log('avatar: set via existing input');
    await waitBrief(page, 1200);
    await confirmAvatarCrop(page);
    return true;
  }

  // B) 先挂 filechooser，再点铅笔（与视频上传同一套）
  log('avatar: locate pencil + filechooser');
  const pencilHandle = await findAvatarPencil(page);
  const pencilEl = pencilHandle?.asElement?.() || (pencilHandle?.click ? pencilHandle : null);

  if (pencilEl) {
    try {
      const chooserPromise = page.waitForEvent('filechooser', { timeout: 15000 });
      await pencilEl.click({ timeout: 8000, force: true }).catch(async () => {
        await page.evaluate((el) => el.click(), pencilEl).catch(() => {});
      });
      const chooser = await chooserPromise;
      await chooser.setFiles(filePath);
      log('avatar: set via filechooser');
      await waitBrief(page, 1200);
      await confirmAvatarCrop(page);
      return true;
    } catch (e) {
      log(`avatar: filechooser failed: ${e.message || e}`);
      // 绝不在无监听时再点铅笔（会弹出系统「打开」框）
    }
  } else {
    log('avatar: pencil not found');
  }

  // C) JS 点击 Profile photo 区小按钮 + filechooser（仍必须先监听）
  log('avatar: JS click pencil + filechooser');
  try {
    const chooserPromise = page.waitForEvent('filechooser', { timeout: 12000 });
    const clicked = await page.evaluate(() => {
      const root = document.querySelector('[role="dialog"]') || document.body;
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      // 优先 aria / data-e2e
      let el = [...root.querySelectorAll('button, [role="button"], label')].find((n) => {
        if (!visible(n)) return false;
        const key = `${n.getAttribute('aria-label') || ''} ${n.getAttribute('data-e2e') || ''}`.toLowerCase();
        return /photo|avatar|upload|edit|pencil|头像|上传/.test(key);
      });
      if (!el) {
        const title = [...root.querySelectorAll('*')].find((n) => /^Profile photo$/i.test((n.textContent || '').trim()));
        const area = title?.closest('div') || root;
        const av = [...area.querySelectorAll('img, div, span')].find((n) => {
          const r = n.getBoundingClientRect();
          return r.width >= 64 && r.width <= 200 && Math.abs(r.width - r.height) < 20;
        });
        if (av) {
          const ir = av.getBoundingClientRect();
          el = [...area.querySelectorAll('button, [role="button"], span, div')].find((n) => {
            if (!visible(n) || !n.querySelector?.('svg')) return false;
            const r = n.getBoundingClientRect();
            if (r.width > 48 || r.height > 48) return false;
            return r.left >= ir.left + ir.width * 0.3 && r.top >= ir.top + ir.height * 0.3;
          });
        }
      }
      if (!el) return false;
      el.scrollIntoView({ block: 'center', inline: 'center' });
      el.click();
      return true;
    });
    if (clicked) {
      const chooser = await chooserPromise;
      await chooser.setFiles(filePath);
      log('avatar: set via JS filechooser');
      await waitBrief(page, 1200);
      await confirmAvatarCrop(page);
      return true;
    }
    // 取消挂起的 wait，避免泄漏
    await chooserPromise.catch(() => null);
  } catch (e) {
    log(`avatar: JS filechooser failed: ${e.message || e}`);
  }

  // D) 点击后再找 input（部分 UI 点击后才挂载 input，且不走系统对话框）
  input = await findAvatarFileInput(page, 6000);
  if (input && await setFiles(input)) {
    log('avatar: set via input after pencil attempt');
    await waitBrief(page, 1200);
    await confirmAvatarCrop(page);
    return true;
  }

  log('avatar: all strategies failed');
  return false;
}

async function confirmAvatarCrop(page) {
  // 只点裁剪/预览确认，避开 Edit profile 底部 Save
  for (let i = 0; i < 8; i += 1) {
    const cropDialog = page.locator('[role="dialog"]').filter({
      hasText: /crop|preview|调整|裁剪|预览|Drag to reposition|拖动/i,
    }).first();
    const hasCrop = await cropDialog.count().catch(() => 0) && await cropDialog.isVisible().catch(() => false);
    const scope = hasCrop ? cropDialog : page;

    for (const name of ['Apply', '应用', 'Done', '完成', 'Confirm', '确认', 'OK']) {
      const apply = scope.getByRole('button', { name: new RegExp(`^${name}$`, 'i') }).first();
      if (!(await apply.count().catch(() => 0))) continue;
      if (!(await apply.isVisible().catch(() => false))) continue;
      // 无裁剪层时不要点到主弹框 Save
      if (!hasCrop && /^(Save|保存)$/i.test(name)) continue;
      await apply.click({ timeout: 5000, force: true }).catch(() => {});
      await waitBrief(page, 800);
      return true;
    }
    await waitBrief(page, 400);
  }
  return false;
}

async function fillProfileField(page, labels, value) {
  const wantBio = (labels || []).some((x) => /bio|签名|简介/i.test(x));
  if (wantBio) return fillBioInEditModal(page, value);
  return fillNameInEditModal(page, value);
}


async function clickProfileSave(page) {
  const dialog = page.locator('[role="dialog"]').first();
  const scopes = [];
  if (await dialog.count().catch(() => 0)) scopes.push(dialog);
  scopes.push(page);

  for (const scope of scopes) {
    // 弹框底部 Save（可能需滚动）
    await scope.evaluate((el) => { el.scrollTop = el.scrollHeight; }).catch(() => {});
    await page.waitForTimeout(300);
    for (const name of ['Save', '保存', 'Done', '完成', 'Confirm', '确认']) {
      const button = scope.getByRole('button', { name: new RegExp(`^${name}$`, 'i') }).first();
      if (await button.count().catch(() => 0) && await button.isVisible().catch(() => false)) {
        const disabled = await button.isDisabled().catch(() => false);
        if (disabled) continue;
        await button.click({ timeout: 8000 });
        return true;
      }
    }
    const textBtn = scope.getByText(/^(Save|保存)$/i).first();
    if (await textBtn.count().catch(() => 0) && await textBtn.isVisible().catch(() => false)) {
      await textBtn.click({ timeout: 8000 }).catch(() => {});
      return true;
    }
  }
  return false;
}

/** 在已打开的 Edit profile 弹框中写入 Name/Bio/头像（不改 Username） */
async function applyEditProfileChanges(page, { nickname = '', bio = '', avatarPath = '' } = {}, log = () => {}) {
  let changed = false;
  let nameSkipped = false;
  if (nickname) {
    const nameOk = await fillNameInEditModal(page, nickname, log);
    if (nameOk) changed = true;
    else nameSkipped = true; // 7 天限制 / 非输入框 → 跳过，不视为整单失败
  }
  if (bio) changed = (await fillBioInEditModal(page, bio)) || changed;
  if (avatarPath) {
    const ok = await setAvatarInEditModal(page, avatarPath, log);
    if (!ok) {
      throw new Error('头像/Logo 上传失败：未能通过自动化选择图片。若桌面弹出了系统「打开」对话框请先点取消，然后重试同步资料');
    }
    changed = true;
  }
  // 仅想改 Name 且当前不可改：不算失败，让调用方知道跳过
  if (!changed && nameSkipped && !bio && !avatarPath) {
    log('name: locked — nothing else to sync');
    return 'name_locked';
  }
  return changed;
}

/** 关闭 Cookie / 提示遮罩，避免挡住编辑按钮 */
async function dismissOverlays(page) {
  const labels = [
    /^(Accept all|Accept|Allow all|I agree|Got it|OK|Agree|允许全部|同意|接受|知道了)$/i,
    /Accept cookies|接受 Cookie/i,
  ];
  for (const re of labels) {
    const btn = page.getByRole('button', { name: re }).first();
    if (await btn.count().catch(() => 0) && await btn.isVisible().catch(() => false)) {
      await btn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
  }
}

/** 在页面及 iframe 内按文案点击（含非 button 节点） */
async function clickByTextDeep(page, pattern) {
  const frames = [page, ...page.frames().filter((f) => f !== page.mainFrame())];
  for (const frame of frames) {
    const hit = await frame.evaluate((src) => {
      const rx = new RegExp(src, 'i');
      const nodes = Array.from(document.querySelectorAll('button, a, div[role="button"], span, div, p'));
      for (const el of nodes) {
        const text = String(el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text || text.length > 40) continue;
        if (!rx.test(text)) continue;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) continue;
        el.click();
        return text;
      }
      return '';
    }, pattern).catch(() => '');
    if (hit) {
      await page.waitForTimeout(1500);
      return hit;
    }
  }
  return '';
}

async function waitForEditForm(page, timeoutMs = 12000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const dialog = page.locator('[role="dialog"]').filter({ hasText: /Edit profile|编辑资料/i }).first();
    if (await dialog.count().catch(() => 0) && await dialog.isVisible().catch(() => false)) {
      const hasFields = await dialog.locator('input, textarea').count().catch(() => 0);
      if (hasFields > 0) return true;
    }
    const vals = await readProfileFormValues(page);
    const hasInput = await page.locator([
      'input[data-e2e="edit-profile-name-input"]',
      'textarea[data-e2e="edit-profile-bio-input"]',
      '[role="dialog"] input',
      '[role="dialog"] textarea',
    ].join(', ')).count().catch(() => 0);
    if (hasInput || profileFormFilled(vals)) return true;
    await page.waitForTimeout(400);
  }
  return false;
}

/** 进入本人个人中心（Profile） */
async function goToPersonalCenter(page, handle) {
  await dismissOverlays(page);

  // 优先点导航「个人中心 / Profile」
  const navCandidates = [
    page.locator('[data-e2e="nav-profile"]').first(),
    page.locator('[data-e2e="profile-icon"]').first(),
    page.locator('a[href*="/@"][data-e2e*="profile" i]').first(),
    page.getByRole('link', { name: /^(Profile|个人中心|我|Me)$/i }).first(),
    page.getByRole('button', { name: /^(Profile|个人中心|我|Me)$/i }).first(),
  ];
  for (const candidate of navCandidates) {
    if (await candidate.count().catch(() => 0) && await candidate.isVisible().catch(() => false)) {
      await candidate.click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(2500);
      await dismissOverlays(page);
      if (new RegExp(`tiktok\\.com/@${handle}`, 'i').test(page.url()) || /tiktok\.com\/@/i.test(page.url())) {
        return true;
      }
    }
  }

  // 右上角头像 → View profile
  const avatarSelectors = [
    '[data-e2e="nav-profile"] img',
    '[data-e2e="top-login-avatar"]',
    '[data-e2e="top-login-avatar"] img',
    'header [class*="Avatar"] img',
    'button[aria-label*="profile" i] img',
  ];
  for (const sel of avatarSelectors) {
    const avatar = page.locator(sel).first();
    if (!(await avatar.count().catch(() => 0)) || !(await avatar.isVisible().catch(() => false))) continue;
    await avatar.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(800);
    const viewHit = await clickByTextDeep(page, 'View profile|查看主页|查看资料|个人主页|^Profile$');
    if (viewHit || /tiktok\.com\/@/i.test(page.url())) {
      await page.waitForTimeout(2000);
      return true;
    }
  }

  // 兜底：直接打开本人主页（强制 en 便于匹配 Edit profile）
  const urls = [
    `https://www.tiktok.com/@${encodeURIComponent(handle)}?lang=en`,
    `https://www.tiktok.com/@${encodeURIComponent(handle)}?lang=zh-Hans`,
    `https://www.tiktok.com/@${encodeURIComponent(handle)}`,
  ];
  for (const url of urls) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2800);
    await dismissOverlays(page);
    if (/tiktok\.com\/@/i.test(page.url())) return true;
  }
  return false;
}

/** 尝试点击个人主页上的 Edit profile 按钮，打开编辑弹框 */
async function tryClickEditEntry(page) {
  // 截图中的主按钮：个人主页统计下方的 “Edit profile”
  const exact = [
    page.locator('[data-e2e="edit-profile-enter"]').first(),
    page.getByRole('button', { name: /^Edit profile$/i }).first(),
    page.getByRole('button', { name: /^编辑资料$/i }).first(),
    page.locator('button').filter({ hasText: /^Edit profile$/i }).first(),
    page.locator('button').filter({ hasText: /^编辑资料$/i }).first(),
  ];
  for (const el of exact) {
    if (await el.count().catch(() => 0) && await el.isVisible().catch(() => false)) {
      await el.scrollIntoViewIfNeeded().catch(() => {});
      await el.click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(1200);
      if (await waitForEditForm(page, 8000)) return true;
    }
  }

  const textHit = await clickByTextDeep(page, '^Edit profile$|^编辑资料$');
  if (textHit && await waitForEditForm(page, 8000)) return true;
  return false;
}

/** 在个人中心打开「编辑资料」弹框 */
async function openEditProfile(page, handle) {
  await dismissOverlays(page);

  // 直接打开本人主页（与用户截图一致）
  await page.goto(`https://www.tiktok.com/@${encodeURIComponent(handle)}?lang=en`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  }).catch(() => {});
  await page.waitForTimeout(2800);
  await dismissOverlays(page);

  if (await tryClickEditEntry(page)) return true;

  await page.mouse.wheel(0, 300).catch(() => {});
  await page.waitForTimeout(800);
  if (await tryClickEditEntry(page)) return true;

  // 导航栏进个人中心再点
  await goToPersonalCenter(page, handle).catch(() => {});
  await page.waitForTimeout(1500);
  return tryClickEditEntry(page);
}

/** 读取编辑资料弹框中的 Name / Bio（忽略 Username） */
async function readProfileFormValues(page) {
  const result = { nickname: '', bio: '' };
  const nameEl = page.locator('input[data-e2e="edit-profile-name-input"]').first();
  if (await nameEl.count().catch(() => 0) && await nameEl.isVisible().catch(() => false)) {
    result.nickname = String(await nameEl.inputValue().catch(() => '') || '').trim();
  } else {
    const byLabel = page.getByLabel(/^Name$/i).first();
    if (await byLabel.count().catch(() => 0) && await byLabel.isVisible().catch(() => false)) {
      const meta = fieldMeta({
        e2e: await byLabel.getAttribute('data-e2e').catch(() => ''),
        name: await byLabel.getAttribute('name').catch(() => ''),
      });
      if (!looksLikeUsername(meta)) {
        result.nickname = String(await byLabel.inputValue().catch(() => '') || '').trim();
      }
    }
  }
  const bioEl = page.locator('textarea[data-e2e="edit-profile-bio-input"], [role="dialog"] textarea').first();
  if (await bioEl.count().catch(() => 0) && await bioEl.isVisible().catch(() => false)) {
    result.bio = String(await bioEl.inputValue().catch(() => '') || '').trim();
  }
  return result;
}

function profileFormFilled(fields) {
  return Boolean(String(fields?.nickname || '').trim() || String(fields?.bio || '').trim());
}

/** 从个人主页 DOM 读取 Following / Followers / Likes / Videos */
async function scrapeProfileStatsFromDom(page) {
  return page.evaluate(() => {
    const parseNum = (raw) => {
      const text = String(raw || '').replace(/,/g, '').trim().toUpperCase();
      const m = text.match(/([0-9]+(?:\.[0-9]+)?)([KMB])?/);
      if (!m) return null;
      const mul = { K: 1e3, M: 1e6, B: 1e9 }[m[2]] || 1;
      return Math.round(Number(m[1]) * mul);
    };
    const pick = (sels) => {
      for (const sel of sels) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const n = parseNum(el.getAttribute('title') || el.textContent || '');
        if (n != null) return n;
      }
      return null;
    };
    const following = pick([
      '[data-e2e="following-count"]',
      'strong[data-e2e="following-count"]',
      'a[href*="/following"] strong',
      'a[href*="/following"] [title]',
    ]);
    const followers = pick([
      '[data-e2e="followers-count"]',
      'strong[data-e2e="followers-count"]',
      'a[href*="/followers"] strong',
      'a[href*="/followers"] [title]',
    ]);
    const likes = pick([
      '[data-e2e="likes-count"]',
      'strong[data-e2e="likes-count"]',
      '[data-e2e="like-count"]',
    ]);

    let videos = null;
    const tabNodes = Array.from(document.querySelectorAll('[data-e2e*="tab"], [role="tab"], a, span, div, strong, p'));
    for (const n of tabNodes) {
      const t = String(n.textContent || '').replace(/\s+/g, ' ').trim();
      if (!t || t.length > 40) continue;
      const m = t.match(/^(?:Videos|视频|作品)\s*([0-9][0-9,.]*\s*[KMB]?)$/i)
        || t.match(/^([0-9][0-9,.]*\s*[KMB]?)\s*(?:Videos|视频|作品)$/i);
      if (m) {
        videos = parseNum(m[1]);
        if (videos != null) break;
      }
    }
    if (videos == null) {
      const grid = document.querySelectorAll(
        '[data-e2e="user-post-item"], [data-e2e="user-post-item-list"] a[href*="/video/"], a[href*="/video/"]'
      );
      if (grid.length) videos = grid.length;
    }

    const body = (document.body?.innerText || '').slice(0, 4000);
    const fromBody = (label) => {
      const m1 = body.match(new RegExp(`([0-9][0-9,.]*\\s*[KMB]?)\\s*(?:${label})\\b`, 'i'));
      if (m1) return parseNum(m1[1]);
      const m2 = body.match(new RegExp(`(?:${label})\\s*([0-9][0-9,.]*\\s*[KMB]?)`, 'i'));
      if (m2) return parseNum(m2[1]);
      return null;
    };

    return {
      followingCount: following ?? fromBody('Following|关注'),
      followersCount: followers ?? fromBody('Followers|粉丝|关注者'),
      likesCount: likes ?? fromBody('Likes|赞|获赞'),
      videosCount: videos,
      displayName: (document.querySelector('h1, [data-e2e="user-title"]')?.textContent || '').trim(),
      bio: (document.querySelector('[data-e2e="user-bio"], h2')?.textContent || '').trim(),
      avatarUrl: document.querySelector('[data-e2e="user-avatar"] img, img')?.getAttribute('src') || '',
    };
  }).catch(() => ({}));
}

/** 公开主页抓取资料与粉丝等统计 */
async function scrapePublicProfile(page, account) {
  const body = await page.locator('body').innerText().catch(() => '');
  if (/log in|登录|sign up/i.test(body) && !/followers|关注者|Following|粉丝/i.test(body)) {
    throw new Error('当前浏览器没有有效 TikTok 登录状态');
  }
  const dom = await scrapeProfileStatsFromDom(page);
  const profile = {
    accountId: account.id,
    handle: account.username,
    displayName: String(dom.displayName || '').trim(),
    bio: String(dom.bio || '').trim(),
    avatarUrl: String(dom.avatarUrl || '').trim(),
    followersCount: dom.followersCount ?? extractStat(body, ['followers', '粉丝', '关注者']),
    followingCount: dom.followingCount ?? extractStat(body, ['following', '关注']),
    likesCount: dom.likesCount ?? extractStat(body, ['likes', '赞', '获赞']),
    videosCount: dom.videosCount ?? extractStat(body, ['videos', '视频', '作品']),
    verified: /verified|已认证/i.test(body) ? 1 : 0,
    sourceUrl: page.url(),
  };
  if (!profile.displayName) {
    const title = await page.title().catch(() => '');
    profile.displayName = title.replace(/\s*\|\s*TikTok.*$/i, '').trim() || account.username;
  }
  if (!profile.avatarUrl) {
    profile.avatarUrl = await page.locator('img').first().getAttribute('src').catch(() => '') || '';
  }
  return profile;
}

async function persistProfile(accountId, profile) {
  await dataStore.tiktokSync(accountId, {
    profile: {
      handle: profile.handle,
      displayName: profile.displayName,
      bio: profile.bio || '',
      avatarUrl: profile.avatarUrl,
      followers: profile.followersCount || 0,
      following: profile.followingCount || 0,
      likes: profile.likesCount || 0,
      videos: profile.videosCount || 0,
    },
    stats: {
      followers: profile.followersCount || 0,
      following: profile.followingCount || 0,
      likes: profile.likesCount || 0,
      videos: profile.videosCount || 0,
    },
  });
}

async function loadStoredProfile(accountId) {
  try {
    return await phpApi.get(`/accounts/${accountId}/tiktok-profile`);
  } catch {
    return null;
  }
}

/**
 * 同步资料 = 把「系统里设置的资料」推送到 TikTok（不是从 TikTok 拉回系统）
 * 流程：读系统 nickname / profile_bio / profile_avatar
 *      → 个人主页 → Edit profile 弹框 → 填 Name/Bio/头像（不改 Username）→ Save
 */
async function syncProfile(accountId, options = {}) {
  const account = await loadAccount(accountId);
  let session;
  let keepOpenOnFail = false;
  try {
    // 仅使用系统侧设置（可被本次 options 覆盖）
    const wantNickname = String(options.nickname || options.displayName || account.nickname || '').trim();
    const wantBio = String(options.signature || options.bio || account.profileBio || '').trim();
    let avatarPath = String(options.avatarPath || options.avatarUrl || account.profileAvatar || '').trim();

    if (!wantNickname && !wantBio && !avatarPath) {
      throw new Error('系统资料为空：请先在「修改资料」里设置昵称/签名/头像，再点同步资料推送到 TikTok');
    }

    let avatarFile = '';
    if (avatarPath) {
      const path = require('node:path');
      const fs = require('node:fs');
      avatarFile = avatarPath;
      const { uploadDir } = require('../../routes/uploads');
      const m = avatarPath.match(/^\/?uploads\/([^/\\]+)$/i)
        || avatarPath.match(/\/uploads\/([^/\\]+)(?:\?|$)/i);
      if (m) avatarFile = path.join(uploadDir, m[1]);
      if (!path.isAbsolute(avatarFile)) avatarFile = path.resolve(process.cwd(), avatarFile);
      if (!fs.existsSync(avatarFile)) throw new Error(`头像文件不存在：${avatarFile}`);
    }

    session = await openBitPage(account, 'profile');
    const { page, ws } = session;
    const { publish: liveLog } = require('../live-log');
    const log = (msg) => liveLog(`SyncProfile#${accountId}: ${msg}`, 'info', { accountId });

    await page.goto('https://www.tiktok.com/foryou?lang=en', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    }).catch(() => {});
    await page.waitForTimeout(2000);
    await dismissOverlays(page);

    if (await pageLooksLoggedOut(page)) {
      keepOpenOnFail = true;
      throw new Error('当前浏览器未登录 TikTok，请先点「登录」完成登录后再同步资料');
    }
    const login = await inspectTikTokSession(ws).catch(() => null);
    if (login && login.loggedIn === false && !(await pageLooksLoggedIn(page))) {
      keepOpenOnFail = true;
      throw new Error('当前浏览器没有有效 TikTok 登录状态，请先登录');
    }

    // 个人主页 → Edit profile
    const opened = await openEditProfile(page, account.username);
    if (!opened) {
      keepOpenOnFail = true;
      const shot = await capture(page, account.id, 'profile', 'edit-miss').catch(() => '');
      throw new Error(`未找到「Edit profile」入口，请确认已登录本人账号${shot ? `（截图：${shot}）` : ''}`);
    }

    if (avatarFile) log(`avatar file: ${avatarFile}`);
    const changed = await applyEditProfileChanges(page, {
      nickname: wantNickname,
      bio: wantBio,
      avatarPath: avatarFile,
    }, log);
    if (changed === 'name_locked') {
      return {
        accountId: account.id,
        handle: account.username,
        pushed: false,
        nameLocked: true,
        message: 'Name 当前受 7 天修改限制（非输入框），已跳过；无其它可同步项',
      };
    }
    if (!changed) {
      keepOpenOnFail = true;
      const shot = await capture(page, account.id, 'profile', 'fields-miss').catch(() => '');
      throw new Error(`未能写入 Bio/头像（Name 若不可改已自动跳过）${shot ? `（截图：${shot}）` : ''}`);
    }

    const saved = await clickProfileSave(page);
    if (!saved) {
      keepOpenOnFail = true;
      throw new Error('资料已填入但未找到 Save，请在比特窗口手动保存');
    }
    await page.waitForTimeout(2500);

    // 回写本地缓存（展示用），系统设置本身已在 accounts 中
    await goToPersonalCenter(page, account.username).catch(() => {});
    const profile = await scrapePublicProfile(page, account).catch(() => ({
      accountId: account.id,
      handle: account.username,
      displayName: wantNickname,
      bio: wantBio,
      avatarUrl: account.profileAvatar || '',
      followersCount: 0,
      followingCount: 0,
      likesCount: 0,
      videosCount: null,
      verified: 0,
      sourceUrl: page.url(),
    }));
    if (wantNickname) profile.displayName = wantNickname;
    if (wantBio) profile.bio = wantBio;
    await persistProfile(account.id, profile).catch(() => {});

    return {
      ...profile,
      pushed: true,
      editOpened: true,
      editSaved: true,
      formNickname: wantNickname,
      formBio: wantBio,
      message: '系统资料已同步到 TikTok',
    };
  } catch (error) {
    await dataStore.tiktokSync(account.id, { error: error.message }).catch(() => {});
    throw error;
  } finally {
    if (!keepOpenOnFail) await closeBitPage(session, account);
  }
}

module.exports = {
  syncProfile,
  fillProfileField,
  fillNameInEditModal,
  fillBioInEditModal,
  setAvatarInEditModal,
  applyEditProfileChanges,
  clickProfileSave,
  openEditProfile,
  goToPersonalCenter,
  dismissOverlays,
  clickByTextDeep,
  readProfileFormValues,
  profileFormFilled,
  scrapePublicProfile,
  persistProfile,
  openBitPage,
  closeBitPage,
  loadAccount,
};
