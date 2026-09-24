const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright-core');
const { generateTotp } = require('../totp');
const { BitBrowserProvider } = require('./bit-browser-provider');
const { inspectTikTokSession } = require('./cdp-client');
const dataStore = require('../data-store');
const { publish: liveLog } = require('../live-log');
const { isHeadless } = require('./headless');

const sessions = new Map();
/** @type {Map<string, number>} accountId -> lock startedAt */
const activeLogins = new Map();
const LOGIN_LOCK_TTL_MS = 90_000;
const screenshotDir = path.resolve(__dirname, '../../data/automation');
fs.mkdirSync(screenshotDir, { recursive: true });

function acquireLoginLock(accountId) {
  const lockKey = String(accountId);
  const now = Date.now();
  const startedAt = activeLogins.get(lockKey);
  if (startedAt && (now - startedAt) < LOGIN_LOCK_TTL_MS) {
    const left = Math.max(1, Math.ceil((LOGIN_LOCK_TTL_MS - (now - startedAt)) / 1000));
    throw new Error(`该账号正在执行登录流程，请约 ${left} 秒后再试（勿连点）`);
  }
  activeLogins.set(lockKey, now);
  return lockKey;
}

function releaseLoginLock(lockKey) {
  if (lockKey) activeLogins.delete(lockKey);
}

function withTimeout(promise, ms, message) {
  let timer;
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

async function firstVisible(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.count() && await locator.isVisible().catch(() => false)) return locator;
  }
  return null;
}

async function firstVisibleText(page, texts) {
  for (const text of texts) {
    const locator = page.getByText(text, { exact: true }).first();
    if (await locator.count() && await locator.isVisible().catch(() => false)) return locator;
  }
  return null;
}

async function pageBodyText(page) {
  return page.locator('body').innerText().catch(() => '');
}

/**
 * TikTok's real rate-limit banner is very specific.
 * Do NOT match bare "Try again later" / "稍后再试" — those appear on many
 * unrelated TikTok strings and caused false "Maximum attempts" reports across all accounts.
 */
async function findAttemptLimitMessage(page) {
  const exact = page.getByText(/Maximum number of attempts reached/i).first();
  if (await exact.count() && await exact.isVisible().catch(() => false)) {
    return 'Maximum number of attempts reached';
  }
  const zh = page.getByText(/尝试次数过多|登录尝试次数已达上限|尝试次数已达上限/i).first();
  if (await zh.count() && await zh.isVisible().catch(() => false)) {
    return String(await zh.innerText().catch(() => '尝试次数过多')).trim() || '尝试次数过多';
  }
  const body = await pageBodyText(page);
  if (/Maximum number of attempts reached/i.test(body)) return 'Maximum number of attempts reached';
  if (/尝试次数过多|登录尝试次数已达上限|尝试次数已达上限/i.test(body)) return '尝试次数过多';
  return '';
}

function attemptLimitedResult(account, page, screenshot = '') {
  return {
    accountId: account.id,
    username: account.username,
    filled: false,
    submitted: false,
    captcha: false,
    attemptLimited: true,
    screenshot,
    currentUrl: page.url(),
    pageTitle: '',
    message: 'TikTok 页面显示登录次数已达上限。请关闭该比特环境后换新代理，或新建浏览器环境再试（不要在同一环境内连点）',
  };
}

async function clearTikTokCookiesOnly(context) {
  const cookies = await context.cookies().catch(() => []);
  const keep = (cookies || []).filter((c) => {
    const domain = String(c.domain || '').toLowerCase().replace(/^\./, '');
    return !domain.includes('tiktok');
  });
  await context.clearCookies().catch(() => {});
  if (keep.length) await context.addCookies(keep).catch(() => {});
  for (const p of context.pages().filter((item) => !item.isClosed() && /tiktok\.com/i.test(item.url()))) {
    await p.evaluate(() => {
      try { localStorage.clear(); } catch { /* ignore */ }
      try { sessionStorage.clear(); } catch { /* ignore */ }
    }).catch(() => {});
  }
}

async function fillAndVerify(locator, value) {
  // Skip rewrite when already correct — repeated fills can trip TikTok's attempt limit.
  if ((await locator.inputValue().catch(() => '')) === value) return true;
  await locator.click().catch(() => {});
  await locator.fill(value).catch(() => {});
  if ((await locator.inputValue().catch(() => '')) === value) return true;
  // One gentle fallback only. Never press Enter (that submits the login form).
  await locator.press('ControlOrMeta+A').catch(() => {});
  await locator.pressSequentially(value, { delay: 20 }).catch(() => {});
  return (await locator.inputValue().catch(() => '')) === value;
}

async function fillTotpCode(page, selectors, code) {
  const candidates = page.locator(selectors.join(', '));
  const visible = [];
  for (let i = 0; i < await candidates.count(); i += 1) {
    const item = candidates.nth(i);
    if (await item.isVisible().catch(() => false)) visible.push(item);
  }
  if (!visible.length) return false;
  if (visible.length === 1) return fillAndVerify(visible[0], code);
  // Some TikTok versions render six separate one-character inputs.
  const boxes = visible.slice(0, 6);
  if (boxes.length >= 6) {
    for (let i = 0; i < 6; i += 1) await fillAndVerify(boxes[i], code[i]);
    await page.waitForTimeout(350);
    const values = await Promise.all(boxes.map(item => item.inputValue().catch(() => '')));
    return values.join('') === code;
  }
  return false;
}

async function clickSafeLoginMethod(page, pattern) {
  // Prefer links / method tiles. Never click the credential submit button
  // ("Log in" / "登录") — that counts as a real login attempt on TikTok.
  const candidates = [
    page.getByRole('link', { name: pattern }).first(),
    page.locator('a, div[role="link"], div[tabindex="0"]').filter({ hasText: pattern }).first(),
    page.getByRole('button', { name: pattern }).first(),
    page.getByText(pattern).first(),
  ];
  for (const locator of candidates) {
    if (!await locator.count() || !await locator.isVisible().catch(() => false)) continue;
    const label = String(await locator.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    if (/^(Log in|登录|Sign in|Next|下一步|Verify|验证)$/i.test(label)) continue;
    if (/^(Continue|继续)$/i.test(label)) continue;
    const type = await locator.getAttribute('type').catch(() => '');
    if (String(type).toLowerCase() === 'submit') continue;
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    await locator.click({ timeout: 5000 }).catch(async () => {
      const clickable = locator.locator('xpath=ancestor-or-self::*[self::a or self::button or @role="button" or @role="link"][1]');
      if (await clickable.count()) {
        const ancestorLabel = String(await clickable.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
        if (/^(Log in|登录|Sign in|Next|下一步)$/i.test(ancestorLabel)) throw new Error('跳过提交按钮');
        await clickable.click({ timeout: 5000 });
      } else throw new Error('登录方式入口不可点击');
    });
    return true;
  }
  return false;
}

async function selectUsernameLogin(page) {
  // Only select TikTok's ordinary credential flow. Never select Google,
  // Facebook, Apple, QR code, or another external authentication provider.
  const credentialReady = await firstVisible(page, [
    'input[name="username"]', 'input[autocomplete="username"]',
    'input[placeholder*="Email"]', 'input[placeholder*="email"]',
    'input[placeholder*="Username"]', 'input[placeholder*="用户名"]',
    'input[type="password"]',
  ]);
  if (credentialReady) return true;
  const url = page.url();
  let selected = false;
  if (/tiktok\.com\/login\/?(?:\?|$)/i.test(url)) {
    selected = await clickSafeLoginMethod(page,
      /(?:Use|Continue with)\s*(?:phone|email|username)|phone\s*\/\s*email\s*\/\s*username|使用.*(?:手机号|邮箱|用户名)/i);
  } else if (/\/login\/phone-or-email\/?(?:\?|$)/i.test(url)) {
    selected = await clickSafeLoginMethod(page,
      /Log in with (?:email|username)|email\s*(?:or|\/)\s*username|使用.*(?:邮箱|用户名).*登录/i);
  }
  if (selected) await page.waitForTimeout(1000);
  return selected;
}

function assertNotCancelled(run) {
  if (run?.cancelled) throw new Error('登录辅助已取消或超时，已停止操作');
}

async function getSession(profileId, provider) {
  const existing = sessions.get(profileId);
  if (existing && existing.browser.isConnected() && !existing.page.isClosed()) return existing;
  if (existing) { await existing.browser.close().catch(() => {}); sessions.delete(profileId); }
  // Reuse an already connected CDP session. Calling BitBrowser open again can
  // reactivate/reload the profile and races the user's manual Log in click.
  const opened = await provider.open(profileId, { headless: isHeadless('login') });
  if (!opened?.ws) throw new Error('比特浏览器未返回 CDP WebSocket 地址');
  const browser = await chromium.connectOverCDP(opened.ws, { timeout: 30000 });
  const context = browser.contexts()[0] || await browser.newContext();
  const openPages = context.pages().filter(item => !item.isClosed());
  let page = openPages.find(item => /tiktok\.com\/login\/2sv\//i.test(item.url()))
    || openPages.find(item => /tiktok\.com/i.test(item.url()))
    || openPages[0];
  if (!page) page = await context.newPage();
  const session = { browser, context, page, profileId, ws: opened.ws };
  sessions.set(profileId, session);
  browser.on('disconnected', () => {
    if (sessions.get(profileId) === session) sessions.delete(profileId);
  });
  return session;
}

async function loginAssist(accountId, { autoSubmit = false, submitAfterTotp = true } = {}) {
  const lockKey = acquireLoginLock(accountId);
  const run = { cancelled: false };
  liveLog(`账号 #${accountId}：开始登录辅助`,'info',{accountId});
  try {
    return await withTimeout(
      runLoginAssist(accountId, { autoSubmit, submitAfterTotp, run }),
      LOGIN_LOCK_TTL_MS,
      '登录辅助超时（90 秒）。请确认比特环境已打开且页面可操作后重试'
    );
  } catch (error) {
    run.cancelled = true;
    throw error;
  } finally {
    liveLog(`账号 #${accountId}：登录辅助结束`,'info',{accountId});
    releaseLoginLock(lockKey);
  }
}

async function runLoginAssist(accountId, { autoSubmit = false, submitAfterTotp = true, run } = {}) {
  const bundle = await dataStore.getAccountBundle(accountId);
  assertNotCancelled(run);
  if (!bundle) throw new Error('账号不存在');
  if (!bundle.browser_profile_id) throw new Error('账号尚未绑定浏览器环境');
  const password = String(bundle.password || '');
  const totpSecret = String(bundle.totp_secret || '');
  if (!password) {
    if (bundle.password_decrypt_failed) {
      throw new Error('账号密码密文无法解密（密钥可能已更换）。请在操作里点「密码/2FA」重新填写 TikTok 密码');
    }
    throw new Error('账号没有可用登录密码。请在操作里点「密码/2FA」补填 TikTok 密码（及 2FA），或重新导入带密码的账号');
  }
  const account = {
    id: bundle.id,
    username: bundle.username,
    browser_profile_id: bundle.browser_profile_id,
    login_status: bundle.login_status,
  };

  const provider = new BitBrowserProvider();
  await dataStore.updateLoginStatus(accountId, 'checking');
  liveLog(`账号 #${accountId}：打开绑定浏览器环境`,'info',{accountId});
  const session = await getSession(account.browser_profile_id, provider);
  assertNotCancelled(run);
  liveLog(`账号 #${accountId}：当前页面 ${session.page.url()}`,'info',{accountId});
  // BitBrowser may add its own workbench tab after the TikTok tab. Always target
  // the active TikTok 2FA/login page rather than relying on the first cached tab.
  const openPages = session.context.pages().filter(item => !item.isClosed());
  const page = openPages.find(item => /tiktok\.com\/login\/2sv\//i.test(item.url()))
    || openPages.find(item => /tiktok\.com/i.test(item.url()))
    || session.page;
  session.page = page;
  await page.bringToFront().catch(() => {});
  // Cookies are stored in the BitBrowser profile, not in TkSwarm memory. Check
  // them before starting a new login so a later click does not log in again.
  const existingSession = await inspectTikTokSession(session.ws);
  assertNotCancelled(run);
  if (existingSession.loggedIn) {
    await dataStore.updateLoginStatus(accountId, 'online');
    return { accountId, username: account.username, filled: false, submitted: false, twoFactorRequired: false, totpFilled: false, captcha: false, alreadyLoggedIn: true, screenshot: '', currentUrl: page.url(), pageTitle: await page.title(), message: '检测到已有有效 TikTok 登录状态，无需重复登录' };
  }

  // If a previous failed attempt left the rate-limit banner on this profile,
  // clear TikTok site data once and open a fresh login page. Do not refuse to
  // navigate — that used to trap every retry on the same error screen.
  let limitedMsg = await findAttemptLimitMessage(page);
  if (limitedMsg) {
    liveLog(`账号 #${accountId}：检测到限流文案，清理 TikTok Cookie 并重新打开登录页`,'warn',{accountId});
    await clearTikTokCookiesOnly(session.context);
    await page.goto('https://www.tiktok.com/login/phone-or-email/email', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1000);
    limitedMsg = await findAttemptLimitMessage(page);
    if (limitedMsg) {
      await dataStore.updateLoginStatus(accountId, 'offline');
      const shot = path.join(screenshotDir, `login-${accountId}-${Date.now()}-limited.png`);
      await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
      const result = attemptLimitedResult(account, page, shot);
      result.pageTitle = await page.title().catch(() => '');
      return result;
    }
  }

  const totpSelectors = [
    'input[autocomplete="one-time-code"]', 'input[placeholder="Enter 6-digit code"]',
    'input[name*="code"]', 'input[placeholder*="code"]', 'input[placeholder*="Code"]',
    'input[placeholder*="验证码"]',
  ];

  // If the user is already looking at TikTok's 2-step page, continue that step
  // instead of navigating back to the username/password page.
  if (/\/login\/2sv\//i.test(page.url())) {
    if (!totpSecret) throw new Error('账号没有已保存的 2FA 密钥，请重新导入账号凭据');
    const totpInputSelectors = [...totpSelectors, 'input[inputmode="numeric"]', 'input[type="tel"]', 'input[type="text"]', 'input:not([type])'];
    const hasTotpInput = await firstVisible(page, totpInputSelectors);
    if (!hasTotpInput) throw new Error('当前处于 TikTok 2-step 页面，但未找到 2FA 输入框');
    let token = generateTotp(totpSecret);
    if (token.validForSeconds <= 8) {
      await page.waitForTimeout((token.validForSeconds + 1) * 1000);
      token = generateTotp(totpSecret);
    }
    assertNotCancelled(run);
    const codeVisible = await fillTotpCode(page, totpInputSelectors, token.code);
    if (!codeVisible) throw new Error('已生成 2FA 验证码，但 TikTok 输入框未保持填写状态');
    const preparedScreenshot = path.join(screenshotDir, `login-${accountId}-${Date.now()}-2sv-prepared.png`);
    await page.screenshot({ path: preparedScreenshot, fullPage: false }).catch(() => {});
    // Never auto-click Next on 2SV unless explicitly requested — clicking when
    // rate-limited or with a stale code burns another attempt.
    const next = submitAfterTotp
      ? await firstVisible(page, ['button[type="submit"]', 'button:has-text("Next")', 'button:has-text("下一步")']) : null;
    if (next) { await next.click(); await page.waitForTimeout(2500); }
    return {
      accountId, username: account.username, filled: true, submitted: Boolean(next),
      twoFactorRequired: true, totpFilled: true, captcha: false, screenshot: preparedScreenshot,
      currentUrl: page.url(), pageTitle: await page.title(),
      message: next ? '已在 2-step 页面填入并提交 TOTP 验证码' : '已在 2-step 页面填入 TOTP 验证码，请确认后点击 Next',
    };
  }

  // Do not navigate on every assist call. If the user is already on TikTok's
  // login page, page.goto would refresh the form and erase a click that is still
  // being processed (or erase credentials already entered by the user).
  const currentUrl = page.url();
  liveLog(`账号 #${accountId}：登录辅助选定页面 ${currentUrl}`,'info',{accountId});
  // Once a TikTok login page is open, never navigate it from login-assist.
  // TikTok submits the form through its SPA/router; a second goto here can
  // race the user's manual Log in click and look like an unexpected refresh.
  if (!/https?:\/\/([^/]+\.)?tiktok\.com\/login(?:\/|\?|$)/i.test(currentUrl)) {
    liveLog(`账号 #${accountId}：当前不是登录页，首次打开 TikTok 登录页`,'info',{accountId});
    await page.goto('https://www.tiktok.com/login/phone-or-email/email', { waitUntil: 'domcontentloaded', timeout: 45000 });
  } else {
    liveLog(`账号 #${accountId}：已在登录页，禁止重新导航或刷新`,'info',{accountId});
  }
  assertNotCancelled(run);
  limitedMsg = await findAttemptLimitMessage(page);
  if (limitedMsg) {
    liveLog(`账号 #${accountId}：登录页仍有限流文案，清理后重开一次`,'warn',{accountId});
    await clearTikTokCookiesOnly(session.context);
    await page.goto('https://www.tiktok.com/login/phone-or-email/email', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1000);
    limitedMsg = await findAttemptLimitMessage(page);
    if (limitedMsg) {
      await dataStore.updateLoginStatus(accountId, 'offline');
      const shot = path.join(screenshotDir, `login-${accountId}-${Date.now()}-limited.png`);
      await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
      const result = attemptLimitedResult(account, page, shot);
      result.pageTitle = await page.title().catch(() => '');
      return result;
    }
  }
  const hasCaptcha = async () => /(captcha|verify you are human|人机验证|滑块|security check)/i.test(await pageBodyText(page));
  let captcha = await hasCaptcha();
  // Select the ordinary credential path at most once, then wait for the form.
  // Repeated clicks on method tiles (or a mis-matched "Log in") burn attempts.
  const usernameSelectors = [
    'input[name="username"]', 'input[autocomplete="username"]', 'input[placeholder*="Email"]',
    'input[placeholder*="email"]', 'input[placeholder*="Username"]', 'input[placeholder*="用户名"]',
  ];
  const passwordSelectors = ['input[type="password"]', 'input[autocomplete="current-password"]'];
  let methodClicked = false;
  for (let i = 0; !captcha && i < 15; i += 1) {
    assertNotCancelled(run);
    if (await findAttemptLimitMessage(page)) break;
    const usernameReady = await firstVisible(page, usernameSelectors);
    const passwordReady = await firstVisible(page, passwordSelectors);
    if (usernameReady && passwordReady) break;
    if (!methodClicked) {
      methodClicked = await selectUsernameLogin(page);
    }
    await page.waitForTimeout(methodClicked ? 700 : 400);
    captcha = await hasCaptcha();
  }
  limitedMsg = await findAttemptLimitMessage(page);
  if (limitedMsg) {
    await dataStore.updateLoginStatus(accountId, 'offline');
    const result = attemptLimitedResult(account, page);
    result.pageTitle = await page.title().catch(() => '');
    return result;
  }
  let screenshot = '';
  if (captcha) {
    screenshot = path.join(screenshotDir, `login-${accountId}-${Date.now()}.png`);
    await page.screenshot({ path: screenshot, fullPage: false }).catch(() => {});
  }

  let usernameInput = await firstVisible(page, [
    'input[name="username"]', 'input[autocomplete="username"]', 'input[placeholder*="Email"]',
    'input[placeholder*="email"]', 'input[placeholder*="Username"]', 'input[placeholder*="用户名"]',
    'input[type="text"]', 'input:not([type])', 'input:not([type="password"])',
  ]);
  const passwordInput = await firstVisible(page, ['input[type="password"]', 'input[autocomplete="current-password"]']);
  if (!usernameInput || !passwordInput) {
    await dataStore.updateLoginStatus(accountId, 'offline');
    return { accountId, username: account.username, filled: false, submitted: false, captcha, screenshot, currentUrl: page.url(), pageTitle: await page.title(), message: '未找到登录表单，请在浏览器中人工确认页面状态' };
  }
  assertNotCancelled(run);
  let usernameFilled = await fillAndVerify(usernameInput, account.username);
  if (!usernameFilled) {
    // Re-query after a possible React/Vue DOM replacement.
    usernameInput = await firstVisible(page, ['input[name="username"]', 'input[autocomplete="username"]', 'input[type="text"]', 'input:not([type="password"])']);
    usernameFilled = usernameInput ? await fillAndVerify(usernameInput, account.username) : false;
  }
  assertNotCancelled(run);
  const passwordFilled = await fillAndVerify(passwordInput, password);
  liveLog(`账号 #${accountId}：用户名${usernameFilled?'已':'未'}填写，密码${passwordFilled?'已':'未'}填写` , usernameFilled && passwordFilled ? 'info' : 'error', { accountId });
  limitedMsg = await findAttemptLimitMessage(page);
  if (limitedMsg) {
    await dataStore.updateLoginStatus(accountId, 'offline');
    const result = attemptLimitedResult(account, page, screenshot);
    result.pageTitle = await page.title().catch(() => '');
    return result;
  }
  // Capture the actual prepared form for diagnosis without including secret
  // values in API responses or logs.
  if (!usernameFilled || !passwordFilled) {
    await dataStore.updateLoginStatus(accountId, 'offline');
    return { accountId, username: account.username, filled: false, submitted: false, twoFactorRequired: false, totpFilled: false, captcha, screenshot, currentUrl: page.url(), pageTitle: await page.title(), message: !usernameFilled ? 'TikTok 用户名输入框未接受填写，请检查页面后重试' : 'TikTok 密码输入框未接受填写，请检查页面后重试' };
  }
  let totpFilled = false;
  if (totpSecret) {
    const totpInputSelectors = [
      'input[autocomplete="one-time-code"]', 'input[placeholder="Enter 6-digit code"]', 'input[name*="code"]', 'input[placeholder*="code"]',
      'input[placeholder*="Code"]', 'input[placeholder*="验证码"]', 'input[inputmode="numeric"]', 'input[type="tel"]',
    ];
    if (await firstVisible(page, totpInputSelectors)) {
      let token = generateTotp(totpSecret);
      if (token.validForSeconds <= 8) {
        await page.waitForTimeout((token.validForSeconds + 1) * 1000);
        token = generateTotp(totpSecret);
      }
      totpFilled = await fillTotpCode(page, totpInputSelectors, token.code);
    }
  }
  let submitted = false;
  let twoFactorRequired = Boolean(totpFilled);
  // Default path never auto-clicks "Log in". Auto-submit is opt-in only and
  // skipped when TikTok already rate-limited this profile.
  if (autoSubmit && !captcha && !(await findAttemptLimitMessage(page))) {
    assertNotCancelled(run);
    const button = await firstVisible(page, ['button[type="submit"]', 'button:has-text("Log in")', 'button:has-text("登录")']);
    if (button) {
      await button.click();
      submitted = true;
      // TikTok may reveal the 2FA field only after the password step is submitted.
      // Wait for the actual 2SV page/input; never generate TOTP on the password page.
      for (let i = 0; i < 80; i += 1) {
        assertNotCancelled(run);
        await page.waitForTimeout(500);
        if (await findAttemptLimitMessage(page)) break;
        if (await hasCaptcha()) { captcha = true; break; }
        const nextTotp = await firstVisible(page, [
          'input[autocomplete="one-time-code"]', 'input[placeholder="Enter 6-digit code"]', 'input[name*="code"]', 'input[placeholder*="code"]',
          'input[placeholder*="Code"]', 'input[placeholder*="验证码"]',
        ]);
        if (nextTotp) {
          twoFactorRequired = true;
          if (!totpFilled && totpSecret) {
            let token = generateTotp(totpSecret);
            if (token.validForSeconds <= 8) {
              await page.waitForTimeout((token.validForSeconds + 1) * 1000);
              token = generateTotp(totpSecret);
            }
            await nextTotp.fill(token.code);
            totpFilled = (await nextTotp.inputValue().catch(() => '')).length === 6;
          }
          if (totpFilled && submitAfterTotp && !captcha) {
            const nextButton = await firstVisible(page, ['button[type="submit"]', 'button:has-text("Next")', 'button:has-text("下一步")', 'button:has-text("Verify")', 'button:has-text("验证")']);
            if (nextButton) { await nextButton.click(); await page.waitForTimeout(2500); }
          }
          break;
        }
      }
    }
  }
  if (captcha && !screenshot) {
    screenshot = path.join(screenshotDir, `login-${accountId}-${Date.now()}.png`);
    await page.screenshot({ path: screenshot, fullPage: false }).catch(() => {});
  }
  const limitedNow = Boolean(await findAttemptLimitMessage(page));
  const result = {
    accountId, username: account.username, filled: true, usernameFilled, passwordFilled, submitted, twoFactorRequired, totpFilled, captcha,
    attemptLimited: limitedNow, screenshot, currentUrl: page.url(), pageTitle: await page.title(),
    message: limitedNow
      ? 'TikTok 页面显示登录次数已达上限。请关闭该比特环境后换新代理，或新建浏览器环境再试'
      : (captcha ? '检测到安全验证，已暂停自动提交，请人工处理'
        : (totpFilled ? '账号、密码和下一步 TOTP 验证码已填充，请手动点击 Next'
          : (submitted ? '已提交登录表单，请稍后检测登录状态'
            : '账号和密码已填充（未自动点击 Log in），请在浏览器中确认后手动点击 Log in'))),
  };
  if (!submitted) await dataStore.updateLoginStatus(accountId, 'checking');
  return result;
}

async function closeSession(profileId) {
  const session = sessions.get(profileId);
  if (session) {
    await session.browser.close().catch(() => {});
    sessions.delete(profileId);
  }
  const provider = new BitBrowserProvider();
  await provider.close(profileId).catch(() => {});
}

module.exports = { loginAssist, closeSession };
