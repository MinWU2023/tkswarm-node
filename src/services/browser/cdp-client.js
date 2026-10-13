const WebSocket = require('ws');

function command(wsUrl, method, params = {}, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    const id = 1;
    const timer = setTimeout(() => {
      socket.terminate();
      reject(new Error(`CDP 命令超时：${method}`));
    }, timeoutMs);

    socket.once('open', () => socket.send(JSON.stringify({ id, method, params })));
    socket.on('message', raw => {
      let message;
      try { message = JSON.parse(raw.toString()); } catch { return; }
      if (message.id !== id) return;
      clearTimeout(timer);
      socket.close();
      if (message.error) reject(new Error(message.error.message || `CDP 命令失败：${method}`));
      else resolve(message.result || {});
    });
    socket.once('error', error => {
      clearTimeout(timer);
      reject(new Error(`无法连接浏览器 CDP：${error.message}`));
    });
  });
}

/**
 * 仅看 Cookie 不够：过期/失效的 sessionid 仍会留在本地，但页面已显示 Log in。
 * 有 page 时必须用页面态交叉验证。
 */
async function pageLooksLoggedOut(page) {
  if (!page || page.isClosed?.()) return false;
  try {
    const url = String(page.url() || '');
    if (/tiktok\.com\/login/i.test(url)) return true;

    const body = String(await page.locator('body').innerText().catch(() => '') || '');
    // 登录方式弹窗 / 登录墙（用户截图里的那种）
    if (/Log in to TikTok|登录到 TikTok|登录 TikTok/i.test(body)) return true;
    if (/Use QR code|使用二维码/i.test(body) && /Use phone or email|Use phone\s*\/\s*email|使用手机号/i.test(body)) return true;
    if (/Don['’]t have an account\?\s*Sign up|还没有账号？\s*注册/i.test(body)) return true;

    const topLogin = page.locator('[data-e2e="top-login-button"]').first();
    if (await topLogin.count() && await topLogin.isVisible().catch(() => false)) return true;

    // 登录表单提交钮（含 disabled）出现即视为登录墙
    const formLogin = page.locator('[data-e2e="login-button"]').first();
    if (await formLogin.count() && await formLogin.isVisible().catch(() => false)) return true;

    const loginControls = [
      page.getByRole('button', { name: /^(Log in|登录|Sign in)$/i }).first(),
      page.getByRole('link', { name: /^(Log in|登录|Sign in)$/i }).first(),
      page.locator('button, a').filter({ hasText: /^(Log in|登录)$/i }).first(),
    ];
    for (const loc of loginControls) {
      if (await loc.count() && await loc.isVisible().catch(() => false)) return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/** TikTok Studio 后台壳（上传/内容管理）没有主站 profile 图标，单独识别 */
async function pageLooksLikeStudioAuthed(page) {
  if (!page || page.isClosed?.()) return false;
  try {
    const url = String(page.url() || '');
    if (!/tiktokstudio/i.test(url)) return false;
    if (await pageLooksLoggedOut(page)) return false;
    // 能看到 Studio 上传/侧栏，匿名用户通常会被踢去登录页
    const markers = [
      page.getByText(/Select video to upload|Select video|Or drag and drop/i).first(),
      page.getByRole('tab', { name: /^(Videos|Photos)$/i }).first(),
      page.getByText(/TikTok Studio/i).first(),
      page.locator('a[href*="tiktokstudio"]').first(),
    ];
    for (const loc of markers) {
      if (await loc.count().catch(() => 0) && await loc.isVisible().catch(() => false)) return true;
    }
    // URL 已在 studio 且无登录墙，也视为已登录壳
    return /tiktokstudio\/(upload|content|analytics|home|comments?)/i.test(url);
  } catch {
    return false;
  }
}

/** 只有页面明确像已登录（有个人入口且无登录墙）才算已登录 */
async function pageLooksLoggedIn(page) {
  if (!page || page.isClosed?.()) return false;
  if (await pageLooksLoggedOut(page)) return false;
  try {
    if (await pageLooksLikeStudioAuthed(page)) return true;
    const markers = [
      page.locator('[data-e2e="nav-profile"]').first(),
      page.locator('[data-e2e="profile-icon"]').first(),
      page.locator('[data-e2e="top-profile-icon"]').first(),
      page.locator('a[href*="/@"]').first(),
      page.locator('[data-e2e="user-avatar"], [data-e2e="avatar"]').first(),
    ];
    for (const loc of markers) {
      if (await loc.count() && await loc.isVisible().catch(() => false)) return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

async function inspectTikTokSession(wsUrl, page = null) {
  const result = await command(wsUrl, 'Storage.getCookies');
  const now = Date.now() / 1000;
  const cookies = (result.cookies || []).filter((cookie) => {
    const domain = String(cookie.domain || '').replace(/^\./, '');
    if (!/(^|\.)tiktok\.com$/i.test(domain)) return false;
    // 过期 Cookie 不算有效登录
    if (cookie.expires && cookie.expires > 0 && cookie.expires < now) return false;
    if (!cookie.value || String(cookie.value).trim() === '') return false;
    return true;
  });
  const names = new Set(cookies.map((cookie) => cookie.name));
  const evidence = ['sessionid', 'sessionid_ss', 'sid_tt', 'sid_guard', 'uid_tt', 'tt_chain_token'].filter((name) => names.has(name));
  const hasSessionCookie = names.has('sessionid') || names.has('sessionid_ss') || evidence.length >= 2;

  let uiLoggedOut = false;
  let uiLoggedIn = false;
  let studioAuthed = false;
  if (page) {
    uiLoggedOut = await pageLooksLoggedOut(page);
    studioAuthed = !uiLoggedOut && await pageLooksLikeStudioAuthed(page);
    uiLoggedIn = !uiLoggedOut && (studioAuthed || await pageLooksLoggedIn(page));
  }

  // 有登录墙 → 未登录
  // 有 page 时：页面像已登录（含 Studio 上传页）即可；Cookie 作辅助
  // Studio 上传页往往没有主站 profile 图标，不能要求 uiLoggedIn 依赖 nav-profile
  let loggedIn;
  if (!page) {
    loggedIn = hasSessionCookie;
  } else if (uiLoggedOut) {
    loggedIn = false;
  } else if (studioAuthed) {
    // 已进入 Studio 上传/后台且无登录墙 → 视为已登录（即使用户刚登完 Cookie 枚举偶发不全）
    loggedIn = true;
  } else if (uiLoggedIn && hasSessionCookie) {
    loggedIn = true;
  } else if (hasSessionCookie && !uiLoggedOut) {
    // Cookie 有效且页面无登录墙：宽松通过（避免误杀）
    loggedIn = true;
  } else {
    loggedIn = false;
  }

  return {
    loggedIn,
    hasSessionCookie,
    uiLoggedOut,
    uiLoggedIn,
    studioAuthed,
    cookieCount: cookies.length,
    evidence,
    pageUrl: page ? String(page.url() || '') : '',
    checkedAt: new Date().toISOString(),
  };
}

module.exports = {
  command,
  inspectTikTokSession,
  pageLooksLoggedOut,
  pageLooksLoggedIn,
  pageLooksLikeStudioAuthed,
};
