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
  const expected = String(value ?? '');
  if (!expected) return false;
  // Skip rewrite when already correct — repeated fills can trip TikTok's attempt limit.
  if ((await locator.inputValue().catch(() => '')) === expected) return true;
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.click({ timeout: 5000 }).catch(() => {});
  await locator.fill('').catch(() => {});
  await locator.fill(expected).catch(() => {});
  if ((await locator.inputValue().catch(() => '')) === expected) return true;

  // TikTok uses React controlled inputs; Playwright fill() alone often does not stick.
  const viaNative = await locator.evaluate((el, v) => {
    const proto = el instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, v);
    else el.value = v;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: v, inputType: 'insertText' }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return el.value === v;
  }, expected).catch(() => false);
  if (viaNative || (await locator.inputValue().catch(() => '')) === expected) return true;

  // Last resort: type characters. Never press Enter (that submits the login form).
  await locator.press('ControlOrMeta+A').catch(() => {});
  await locator.pressSequentially(expected, { delay: 25 }).catch(() => {});
  return (await locator.inputValue().catch(() => '')) === expected;
}

async function fillTotpCode(page, selectors, code) {
  // Prefer the labeled 6-digit field TikTok shows on 2-step verification.
  const preferred = page.getByPlaceholder(/Enter 6-digit code|6-digit code|验证码/i).first();
  if (await preferred.count() && await preferred.isVisible().catch(() => false)) {
    if (await fillAndVerify(preferred, code)) return true;
  }
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
  return fillAndVerify(visible[0], code);
}

const TOTP_INPUT_SELECTORS = [
  'input[autocomplete="one-time-code"]',
  'input[placeholder="Enter 6-digit code"]',
  'input[placeholder*="6-digit"]',
  'input[placeholder*="6 digit"]',
  'input[placeholder*="code"]',
  'input[placeholder*="Code"]',
  'input[placeholder*="验证码"]',
  'input[name*="code"]',
  'input[inputmode="numeric"]',
  'input[type="tel"]',
];

async function isTwoStepVerificationPage(page) {
  if (/\/login\/2sv\//i.test(page.url())) return true;
  const codeInput = await firstVisible(page, TOTP_INPUT_SELECTORS);
  if (!codeInput) return false;
  // Password page must not be mistaken for 2SV.
  if (await firstVisible(page, ['input[type="password"]', 'input[autocomplete="current-password"]'])) return false;
  const text = await pageBodyText(page);
  return /2-step verification|authenticator app|Enter 6-digit code|两步验证|身份验证器|验证器应用/i.test(text);
}

async function fillTwoStepVerification(page, account, totpSecret, submitAfterTotp, run) {
  if (!totpSecret) throw new Error('账号没有已保存的 2FA 密钥，请在「密码/2FA」里补填或重新导入带 2FA 的账号');
  const totpInputSelectors = [...TOTP_INPUT_SELECTORS, 'input[type="text"]', 'input:not([type])'];
  let hasTotpInput = await firstVisible(page, totpInputSelectors);
  for (let i = 0; !hasTotpInput && i < 10; i += 1) {
    assertNotCancelled(run);
    await page.waitForTimeout(400);
    hasTotpInput = await firstVisible(page, totpInputSelectors);
  }
  if (!hasTotpInput) throw new Error('当前处于 TikTok 2-step 页面，但未找到 2FA 输入框');
  let token = generateTotp(totpSecret);
  if (token.validForSeconds <= 8) {
    await page.waitForTimeout((token.validForSeconds + 1) * 1000);
    token = generateTotp(totpSecret);
  }
  assertNotCancelled(run);
  liveLog(`账号 #${account.id}：正在填入 2FA 验证码`,'info',{accountId: account.id});
  const codeVisible = await fillTotpCode(page, totpInputSelectors, token.code);
  if (!codeVisible) throw new Error('已生成 2FA 验证码，但 TikTok 输入框未保持填写状态');
  const preparedScreenshot = path.join(screenshotDir, `login-${account.id}-${Date.now()}-2sv-prepared.png`);
  await page.screenshot({ path: preparedScreenshot, fullPage: false }).catch(() => {});
  const next = submitAfterTotp
    ? await firstVisible(page, ['button[type="submit"]', 'button:has-text("Next")', 'button:has-text("下一步")']) : null;
  if (next) { await next.click(); await page.waitForTimeout(2500); }
  return {
    accountId: account.id, username: account.username, filled: true, submitted: Boolean(next),
    twoFactorRequired: true, totpFilled: true, captcha: false, screenshot: preparedScreenshot,
    currentUrl: page.url(), pageTitle: await page.title(),
    message: next ? '已在 2-step 页面填入并提交 TOTP 验证码' : '已自动填入 2FA 6 位验证码，请手动点击 Next（不会自动点）',
  };
}

async function clickSafeLoginMethod(page, pattern) {
  // Prefer links / method tiles. Never click the credential submit button
  // ("Log in" / "登录") — that counts as a real login attempt on TikTok.
  const candidates = [
    page.getByRole('link', { name: pattern }).first(),
    page.locator('a, div[role="link"], div[tabindex="0"], div[role="button"]').filter({ hasText: pattern }).first(),
    page.getByRole('button', { name: pattern }).first(),
    page.getByText(pattern).first(),
  ];
  for (const locator of candidates) {
    if (!await locator.count() || !await locator.isVisible().catch(() => false)) continue;
    const label = String(await locator.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    if (/^(Log in|登录|Sign in|Next|下一步|Verify|验证)$/i.test(label)) continue;
    if (/^(Continue|继续)$/i.test(label)) continue;
    // Never pick social / QR providers.
    if (/Google|Facebook|Apple|QR|二维码/i.test(label) && !/phone|email|username|手机|邮箱|用户名/i.test(label)) continue;
    const type = await locator.getAttribute('type').catch(() => '');
    if (String(type).toLowerCase() === 'submit') continue;
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    await locator.click({ timeout: 5000 }).catch(async () => {
      const clickable = locator.locator('xpath=ancestor-or-self::*[self::a or self::button or @role="button" or @role="link" or self::div][1]');
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

async function clickPhoneEmailUsernameEntry(page) {
  const exactTexts = [
    'Use phone / email / username',
    'Use phone/email/username',
    '使用手机号 / 邮箱 / 用户名',
    '使用手机号/邮箱/用户名',
    '使用电话 / 邮箱 / 用户名',
  ];
  for (const text of exactTexts) {
    const loc = page.getByText(text, { exact: true }).first();
    if (!await loc.count() || !await loc.isVisible().catch(() => false)) continue;
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    await loc.click({ timeout: 5000 }).catch(async () => {
      const clickable = loc.locator('xpath=ancestor-or-self::*[self::a or self::button or @role="button" or @role="link" or self::div][1]');
      if (await clickable.count()) await clickable.click({ timeout: 5000 });
      else throw new Error('无法点击手机/邮箱/用户名入口');
    });
    return true;
  }
  return clickSafeLoginMethod(page,
    /Use phone\s*\/\s*email\s*\/\s*username|phone\s*\/\s*email\s*\/\s*username|使用.*(?:手机号|电话).*邮箱.*用户名/i);
}

async function hasCredentialForm(page) {
  const passwordReady = await firstVisible(page, ['input[type="password"]', 'input[autocomplete="current-password"]']);
  if (!passwordReady) return false;
  const usernameReady = await firstVisible(page, [
    'input[name="username"]', 'input[autocomplete="username"]',
    'input[placeholder*="Email or username"]', 'input[placeholder*="email or username"]',
    'input[placeholder*="Email"]', 'input[placeholder*="email"]',
    'input[placeholder*="Username"]', 'input[placeholder*="username"]',
    'input[placeholder*="用户名"]', 'input[placeholder*="邮箱"]',
  ]);
  return Boolean(usernameReady);
}

async function isLoginMethodHub(page) {
  if (await hasCredentialForm(page)) return false;
  if (await isTwoStepVerificationPage(page)) return false;
  const text = await pageBodyText(page);
  return /Use phone\s*\/\s*email\s*\/\s*username|使用手机号.*邮箱.*用户名|Continue with Google|Continue with Facebook|Use QR code|使用二维码/i.test(text);
}

async function openEmailCredentialForm(page, accountId) {
  if (await hasCredentialForm(page)) return true;

  // Hub page (QR / Google / Apple / phone-email-username). Prefer a direct
  // deep-link; TikTok often redirects back to the hub, so also click the tile.
  if (await isLoginMethodHub(page) || !/\/login\/phone-or-email\/email/i.test(page.url())) {
    liveLog(`账号 #${accountId}：打开邮箱/用户名登录表单`,'info',{accountId});
    await page.goto('https://www.tiktok.com/login/phone-or-email/email', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(900);
  }
  if (await hasCredentialForm(page)) return true;

  if (await isLoginMethodHub(page) || /tiktok\.com\/login\/?(?:\?|$)/i.test(page.url())) {
    liveLog(`账号 #${accountId}：点击 Use phone / email / username`,'info',{accountId});
    const clicked = await clickPhoneEmailUsernameEntry(page);
    if (clicked) await page.waitForTimeout(1200);
  }
  if (await hasCredentialForm(page)) return true;

  // Intermediate "phone or email" chooser — pick email/username.
  if (/\/login\/phone-or-email\/?(?:\?|$)/i.test(page.url()) || /Log in with (?:email|username)|email\s*(?:or|\/)\s*username/i.test(await pageBodyText(page))) {
    liveLog(`账号 #${accountId}：点击 Log in with email/username`,'info',{accountId});
    const clicked = await clickSafeLoginMethod(page,
      /Log in with (?:email|username)|email\s*(?:or|\/)\s*username|使用.*(?:邮箱|用户名).*登录/i);
    if (clicked) await page.waitForTimeout(1200);
  }
  if (await hasCredentialForm(page)) return true;

  // Last attempt: deep-link again after the hub click path.
  await page.goto('https://www.tiktok.com/login/phone-or-email/email', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(900);
  return hasCredentialForm(page);
}

async function selectUsernameLogin(page) {
  // Only select TikTok's ordinary credential flow. Never select Google,
  // Facebook, Apple, QR code, or another external authentication provider.
  if (await hasCredentialForm(page)) return true;
  if (await isLoginMethodHub(page) || /tiktok\.com\/login\/?(?:\?|$)/i.test(page.url())) {
    const selected = await clickPhoneEmailUsernameEntry(page);
    if (selected) await page.waitForTimeout(1000);
    return selected;
  }
  if (/\/login\/phone-or-email\/?(?:\?|$)/i.test(page.url())) {
    const selected = await clickSafeLoginMethod(page,
      /Log in with (?:email|username)|email\s*(?:or|\/)\s*username|使用.*(?:邮箱|用户名).*登录/i);
    if (selected) await page.waitForTimeout(1000);
    return selected;
  }
  return false;
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
    username: String(bundle.username || '').replace(/^@+/, '').trim(),
    browser_profile_id: bundle.browser_profile_id,
    login_status: bundle.login_status,
  };
  if (!account.username) throw new Error('账号用户名为空，无法填写登录表');

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

  // Handle 2-step FIRST. Never clear cookies / navigate away while the user is
  // already on the authenticator page — that would kill the login session.
  if (await isTwoStepVerificationPage(page)) {
    return fillTwoStepVerification(page, account, totpSecret, submitAfterTotp, run);
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
    if (await isTwoStepVerificationPage(page)) {
      return fillTwoStepVerification(page, account, totpSecret, submitAfterTotp, run);
    }
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

  // Reach the email/username + password form. The generic /login hub
  // (QR / Google / Apple / phone-email-username) is NOT the credential form —
  // staying there was why users only saw "Log in to TikTok" method tiles.
  const currentUrl = page.url();
  liveLog(`账号 #${accountId}：登录辅助选定页面 ${currentUrl}`,'info',{accountId});
  assertNotCancelled(run);
  const openedForm = await openEmailCredentialForm(page, accountId);
  if (!openedForm) {
    await dataStore.updateLoginStatus(accountId, 'offline');
    return {
      accountId, username: account.username, filled: false, submitted: false, captcha: false,
      screenshot: '', currentUrl: page.url(), pageTitle: await page.title().catch(() => ''),
      message: '仍停留在登录方式选择页（QR/Google/Apple）。请手动点「Use phone / email / username」，进入邮箱登录表后再点登录辅助',
    };
  }
  assertNotCancelled(run);
  if (await isTwoStepVerificationPage(page)) {
    return fillTwoStepVerification(page, account, totpSecret, submitAfterTotp, run);
  }
  limitedMsg = await findAttemptLimitMessage(page);
  if (limitedMsg) {
    liveLog(`账号 #${accountId}：登录页仍有限流文案，清理后重开一次`,'warn',{accountId});
    await clearTikTokCookiesOnly(session.context);
    await openEmailCredentialForm(page, accountId);
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
  // Form should already be open; wait briefly if TikTok is still rendering inputs.
  const usernameSelectors = [
    'input[name="username"]', 'input[autocomplete="username"]',
    'input[placeholder*="Email or username"]', 'input[placeholder*="email or username"]',
    'input[placeholder*="Email"]', 'input[placeholder*="email"]',
    'input[placeholder*="Username"]', 'input[placeholder*="username"]',
    'input[placeholder*="用户名"]', 'input[placeholder*="邮箱"]',
  ];
  const passwordSelectors = ['input[type="password"]', 'input[autocomplete="current-password"]'];
  for (let i = 0; !captcha && i < 10; i += 1) {
    assertNotCancelled(run);
    if (await findAttemptLimitMessage(page)) break;
    if (await isTwoStepVerificationPage(page)) {
      return fillTwoStepVerification(page, account, totpSecret, submitAfterTotp, run);
    }
    if (await hasCredentialForm(page)) break;
    if (await isLoginMethodHub(page)) {
      await openEmailCredentialForm(page, accountId);
    } else {
      await selectUsernameLogin(page);
    }
    await page.waitForTimeout(500);
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

  // Prefer inputs inside the password form so we do not fill a header search box.
  const loginForm = page.locator('form').filter({ has: page.locator('input[type="password"]') }).first();
  const inputScope = (await loginForm.count()) ? loginForm : page;
  let usernameInput = await firstVisible(inputScope, usernameSelectors);
  if (!usernameInput) {
    usernameInput = await firstVisible(inputScope, ['input[type="text"]', 'input:not([type])', 'input:not([type="password"])']);
  }
  const passwordInput = await firstVisible(inputScope, passwordSelectors);
  if (!usernameInput || !passwordInput) {
    await dataStore.updateLoginStatus(accountId, 'offline');
    return { accountId, username: account.username, filled: false, submitted: false, captcha, screenshot, currentUrl: page.url(), pageTitle: await page.title(), message: '未找到登录表单，请在浏览器中人工确认页面状态' };
  }
  assertNotCancelled(run);
  liveLog(`账号 #${accountId}：准备填写用户名 ${account.username}`,'info',{accountId});
  let usernameFilled = await fillAndVerify(usernameInput, account.username);
  if (!usernameFilled) {
    // Re-query after a possible React/Vue DOM replacement.
    usernameInput = await firstVisible(inputScope, [...usernameSelectors, 'input[type="text"]', 'input:not([type="password"])']);
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
  let submitted = false;
  let twoFactorRequired = false;
  // Default path never auto-clicks "Log in". After you click Log in and land on
  // 2-step verification, click「登录辅助」again — that pass auto-fills the 6-digit code.
  if (autoSubmit && !captcha && !(await findAttemptLimitMessage(page))) {
    assertNotCancelled(run);
    const button = await firstVisible(page, ['button[type="submit"]', 'button:has-text("Log in")', 'button:has-text("登录")']);
    if (button) {
      await button.click();
      submitted = true;
      for (let i = 0; i < 80; i += 1) {
        assertNotCancelled(run);
        await page.waitForTimeout(500);
        if (await findAttemptLimitMessage(page)) break;
        if (await hasCaptcha()) { captcha = true; break; }
        if (await isTwoStepVerificationPage(page)) {
          twoFactorRequired = true;
          if (totpSecret) {
            const step = await fillTwoStepVerification(page, account, totpSecret, submitAfterTotp, run);
            return { ...step, submitted: true, usernameFilled, passwordFilled };
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
        : (submitted ? '已提交登录表单，请稍后检测登录状态'
          : '账号和密码已填充（未自动点 Log in）。请手动点 Log in；进入 2-step 后再点一次「登录辅助」自动填 6 位验证码')),
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
