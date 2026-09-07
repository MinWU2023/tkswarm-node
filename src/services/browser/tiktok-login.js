const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright-core');
const { decrypt } = require('../secret-store');
const { generateTotp } = require('../totp');
const { BitBrowserProvider } = require('./bit-browser-provider');
const { inspectTikTokSession } = require('./cdp-client');
const { db } = require('../../db');
const { publish: liveLog } = require('../live-log');

const sessions = new Map();
const activeLogins = new Set();
const screenshotDir = path.resolve(__dirname, '../../data/automation');
fs.mkdirSync(screenshotDir, { recursive: true });

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

async function fillAndVerify(locator, value) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await locator.fill(value).catch(() => {});
    if ((await locator.inputValue().catch(() => '')) !== value) {
      // Some TikTok builds replace the controlled input during the first fill.
      await locator.click().catch(() => {});
      await locator.press('ControlOrMeta+A').catch(() => {});
      await locator.pressSequentially(value, { delay: 15 }).catch(() => {});
    }
    if ((await locator.inputValue().catch(() => '')) === value) {
      await locator.page().waitForTimeout(350);
      if ((await locator.inputValue().catch(() => '')) === value) return true;
    }
  }
  return false;
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
  const candidates = [
    page.getByRole('button', { name: pattern }).first(),
    page.getByRole('link', { name: pattern }).first(),
    page.getByText(pattern).first(),
  ];
  for (const locator of candidates) {
    if (!await locator.count() || !await locator.isVisible().catch(() => false)) continue;
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    await locator.click({ timeout: 5000 }).catch(async () => {
      const clickable = locator.locator('xpath=ancestor-or-self::*[self::button or @role="button" or self::a][1]');
      if (await clickable.count()) await clickable.click({ timeout: 5000 }); else throw new Error('登录方式入口不可点击');
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

async function getSession(profileId, provider) {
  const existing = sessions.get(profileId);
  if (existing && existing.browser.isConnected() && !existing.page.isClosed()) return existing;
  if (existing) { await existing.browser.close().catch(() => {}); sessions.delete(profileId); }
  const opened = await provider.open(profileId);
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
  const lockKey = String(accountId);
  if (activeLogins.has(lockKey)) throw new Error('该账号正在执行登录流程，请勿重复点击');
  activeLogins.add(lockKey);
  liveLog(`账号 #${accountId}：开始登录辅助`,'info',{accountId});
  try {
  const account = db.prepare(`SELECT id, username, browser_profile_id, login_status FROM accounts WHERE id=?`).get(accountId);
  if (!account) throw new Error('账号不存在');
  if (!account.browser_profile_id) throw new Error('账号尚未绑定浏览器环境');
  const secret = db.prepare('SELECT password_encrypted, totp_secret_encrypted FROM account_secrets WHERE account_id=?').get(accountId);
  if (!secret?.password_encrypted) throw new Error('账号没有已保存的加密密码，请重新导入账号凭据');

  const password = decrypt(secret.password_encrypted);
  const totpSecret = secret.totp_secret_encrypted ? decrypt(secret.totp_secret_encrypted) : '';
  const provider = new BitBrowserProvider();
  db.prepare("UPDATE accounts SET login_status='checking', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(accountId);
  liveLog(`账号 #${accountId}：打开绑定浏览器环境`,'info',{accountId});
  const session = await getSession(account.browser_profile_id, provider);
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
  if (existingSession.loggedIn) {
    db.prepare("UPDATE accounts SET login_status='online', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(accountId);
    return { accountId, username: account.username, filled: false, submitted: false, twoFactorRequired: false, totpFilled: false, captcha: false, alreadyLoggedIn: true, screenshot: '', currentUrl: page.url(), pageTitle: await page.title(), message: '检测到已有有效 TikTok 登录状态，无需重复登录' };
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
    const codeVisible = await fillTotpCode(page, totpInputSelectors, token.code);
    if (!codeVisible) throw new Error('已生成 2FA 验证码，但 TikTok 输入框未保持填写状态');
    const preparedScreenshot = path.join(screenshotDir, `login-${accountId}-${Date.now()}-2sv-prepared.png`);
    await page.screenshot({ path: preparedScreenshot, fullPage: false }).catch(() => {});
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
  // Once a TikTok login page is open, never navigate it from login-assist.
  // TikTok submits the form through its SPA/router; a second goto here can
  // race the user's manual Log in click and look like an unexpected refresh.
  if (!/https?:\/\/([^/]+\.)?tiktok\.com\/login(?:\/|\?|$)/i.test(currentUrl)) {
    liveLog(`账号 #${accountId}：打开 TikTok 登录页`,'info',{accountId});
    await page.goto('https://www.tiktok.com/login/phone-or-email/email', { waitUntil: 'domcontentloaded', timeout: 60000 });
  }
  const hasCaptcha = async () => /(captcha|验证码|verify you are human|人机验证|滑块|security check)/i.test(await page.locator('body').innerText().catch(() => ''));
  let captcha = await hasCaptcha();
  // Select the ordinary credential path at most once per page state, then wait
  // for TikTok's SPA navigation/form rendering instead of clicking repeatedly.
  const usernameSelectors = [
    'input[name="username"]', 'input[autocomplete="username"]', 'input[placeholder*="Email"]',
    'input[placeholder*="email"]', 'input[placeholder*="Username"]', 'input[placeholder*="用户名"]',
  ];
  const passwordSelectors = ['input[type="password"]', 'input[autocomplete="current-password"]'];
  for (let i = 0; !captcha && i < 30; i += 1) {
    const usernameReady = await firstVisible(page, usernameSelectors);
    const passwordReady = await firstVisible(page, passwordSelectors);
    if (usernameReady && passwordReady) break;
    const selected = await selectUsernameLogin(page);
    await page.waitForTimeout(selected ? 1000 : 500);
    captcha = await hasCaptcha();
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
    db.prepare("UPDATE accounts SET login_status='offline', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(accountId);
    return { accountId, username: account.username, filled: false, submitted: false, captcha, screenshot, currentUrl: page.url(), pageTitle: await page.title(), message: '未找到登录表单，请在浏览器中人工确认页面状态' };
  }
  let usernameFilled = await fillAndVerify(usernameInput, account.username);
  if (!usernameFilled) {
    // Re-query after a possible React/Vue DOM replacement.
    usernameInput = await firstVisible(page, ['input[name="username"]', 'input[autocomplete="username"]', 'input[type="text"]', 'input:not([type="password"])']);
    usernameFilled = usernameInput ? await fillAndVerify(usernameInput, account.username) : false;
  }
  const passwordFilled = await fillAndVerify(passwordInput, password);
  liveLog(`账号 #${accountId}：用户名${usernameFilled?'已':'未'}填写，密码${passwordFilled?'已':'未'}填写` , usernameFilled && passwordFilled ? 'info' : 'error', { accountId });
  // Capture the actual prepared form for diagnosis without including secret
  // values in API responses or logs.
  if (!usernameFilled || !passwordFilled) {
    db.prepare("UPDATE accounts SET login_status='offline', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(accountId);
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
  if (autoSubmit && !captcha) {
    const button = await firstVisible(page, ['button[type="submit"]', 'button:has-text("Log in")', 'button:has-text("登录")', 'button:has-text("Continue")', 'button:has-text("继续")']);
    if (button) {
      await button.click();
      submitted = true;
      // TikTok may reveal the 2FA field only after the password step is submitted.
      // Wait for the actual 2SV page/input; never generate TOTP on the password page.
      for (let i = 0; i < 80; i += 1) {
        await page.waitForTimeout(500);
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
            const nextButton = await firstVisible(page, ['button[type="submit"]', 'button:has-text("Next")', 'button:has-text("下一步")', 'button:has-text("Log in")', 'button:has-text("登录")', 'button:has-text("Verify")', 'button:has-text("验证")']);
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
  const result = { accountId, username: account.username, filled: true, usernameFilled, passwordFilled, submitted, twoFactorRequired, totpFilled, captcha, screenshot, currentUrl: page.url(), pageTitle: await page.title(), message: captcha ? '检测到安全验证，已暂停自动提交，请人工处理' : (totpFilled ? '账号、密码和下一步 TOTP 验证码已填充' : (submitted ? '已提交登录表单，请稍后检测登录状态' : '账号和密码已填充，请在浏览器中确认并提交')) };
  if (!submitted) db.prepare("UPDATE accounts SET login_status='checking', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(accountId);
  return result;
  } finally {
    liveLog(`账号 #${accountId}：登录辅助结束`,'info',{accountId});
    activeLogins.delete(lockKey);
  }
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
