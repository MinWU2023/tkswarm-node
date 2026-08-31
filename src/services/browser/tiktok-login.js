const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright-core');
const { decrypt } = require('../secret-store');
const { generateTotp } = require('../totp');
const { BitBrowserProvider } = require('./bit-browser-provider');
const { db } = require('../../db');

const sessions = new Map();
const screenshotDir = path.resolve(__dirname, '../../data/automation');
fs.mkdirSync(screenshotDir, { recursive: true });

async function firstVisible(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.count() && await locator.isVisible().catch(() => false)) return locator;
  }
  return null;
}

async function getSession(profileId, provider) {
  const existing = sessions.get(profileId);
  if (existing) return existing;
  const opened = await provider.open(profileId);
  if (!opened?.ws) throw new Error('比特浏览器未返回 CDP WebSocket 地址');
  const browser = await chromium.connectOverCDP(opened.ws, { timeout: 30000 });
  const context = browser.contexts()[0] || await browser.newContext();
  const page = context.pages()[0] || await context.newPage();
  const session = { browser, context, page, profileId };
  sessions.set(profileId, session);
  return session;
}

async function loginAssist(accountId, { autoSubmit = false, submitAfterTotp = true } = {}) {
  const account = db.prepare(`SELECT id, username, browser_profile_id, login_status FROM accounts WHERE id=?`).get(accountId);
  if (!account) throw new Error('账号不存在');
  if (!account.browser_profile_id) throw new Error('账号尚未绑定浏览器环境');
  const secret = db.prepare('SELECT password_encrypted, totp_secret_encrypted FROM account_secrets WHERE account_id=?').get(accountId);
  if (!secret?.password_encrypted) throw new Error('账号没有已保存的加密密码，请重新导入账号凭据');

  const password = decrypt(secret.password_encrypted);
  const totpSecret = secret.totp_secret_encrypted ? decrypt(secret.totp_secret_encrypted) : '';
  const provider = new BitBrowserProvider();
  db.prepare("UPDATE accounts SET login_status='checking', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(accountId);
  const session = await getSession(account.browser_profile_id, provider);
  const { page } = session;
  const totpSelectors = [
    'input[autocomplete="one-time-code"]', 'input[placeholder="Enter 6-digit code"]',
    'input[name*="code"]', 'input[placeholder*="code"]', 'input[placeholder*="Code"]',
    'input[placeholder*="验证码"]',
  ];

  // If the user is already looking at TikTok's 2-step page, continue that step
  // instead of navigating back to the username/password page.
  if (/\/login\/2sv\//i.test(page.url())) {
    const currentTotp = await firstVisible(page, totpSelectors);
    if (!currentTotp) throw new Error('当前处于 TikTok 2-step 页面，但未找到 2FA 输入框');
    const code = generateTotp(totpSecret).code;
    await currentTotp.fill(code);
    const next = await firstVisible(page, ['button[type="submit"]', 'button:has-text("Next")', 'button:has-text("下一步")']);
    if (next) { await next.click(); await page.waitForTimeout(2500); }
    return {
      accountId, username: account.username, filled: true, submitted: Boolean(next),
      twoFactorRequired: true, totpFilled: true, captcha: false, screenshot: '',
      currentUrl: page.url(), pageTitle: await page.title(), message: '已在 2-step 页面填入并提交 TOTP 验证码',
    };
  }

  await page.goto('https://www.tiktok.com/login/phone-or-email/email', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);
  const hasCaptcha = async () => /(captcha|验证码|verify you are human|人机验证|滑块|security check)/i.test(await page.locator('body').innerText().catch(() => ''));
  let captcha = await hasCaptcha();
  let screenshot = '';
  if (captcha) {
    screenshot = path.join(screenshotDir, `login-${accountId}-${Date.now()}.png`);
    await page.screenshot({ path: screenshot, fullPage: false }).catch(() => {});
  }

  const usernameInput = await firstVisible(page, [
    'input[name="username"]', 'input[autocomplete="username"]', 'input[placeholder*="Email"]',
    'input[placeholder*="email"]', 'input[placeholder*="Username"]', 'input[placeholder*="用户名"]',
  ]);
  const passwordInput = await firstVisible(page, ['input[type="password"]', 'input[autocomplete="current-password"]']);
  if (!usernameInput || !passwordInput) {
    db.prepare("UPDATE accounts SET login_status='offline', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(accountId);
    return { accountId, username: account.username, filled: false, submitted: false, captcha, screenshot, currentUrl: page.url(), pageTitle: await page.title(), message: '未找到登录表单，请在浏览器中人工确认页面状态' };
  }
  await usernameInput.fill(account.username);
  await passwordInput.fill(password);
  let totpFilled = false;
  if (totpSecret) {
    const totpInput = await firstVisible(page, [
      'input[autocomplete="one-time-code"]', 'input[placeholder="Enter 6-digit code"]', 'input[name*="code"]', 'input[placeholder*="code"]',
      'input[placeholder*="Code"]', 'input[placeholder*="验证码"]',
    ]);
    if (totpInput) {
      await totpInput.fill(generateTotp(totpSecret).code);
      totpFilled = true;
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
      for (let i = 0; i < 12; i += 1) {
        await page.waitForTimeout(500);
        if (await hasCaptcha()) { captcha = true; break; }
        const nextTotp = await firstVisible(page, [
          'input[autocomplete="one-time-code"]', 'input[placeholder="Enter 6-digit code"]', 'input[name*="code"]', 'input[placeholder*="code"]',
          'input[placeholder*="Code"]', 'input[placeholder*="验证码"]',
        ]);
        if (nextTotp) {
          twoFactorRequired = true;
          if (!totpFilled && totpSecret) {
            await nextTotp.fill(generateTotp(totpSecret).code);
            totpFilled = true;
          }
          if (totpFilled && submitAfterTotp && !captcha) {
            const nextButton = await firstVisible(page, ['button[type="submit"]', 'button:has-text("Log in")', 'button:has-text("登录")', 'button:has-text("Verify")', 'button:has-text("验证")']);
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
  const result = { accountId, username: account.username, filled: true, submitted, twoFactorRequired, totpFilled, captcha, screenshot, currentUrl: page.url(), pageTitle: await page.title(), message: captcha ? '检测到安全验证，已暂停自动提交，请人工处理' : (totpFilled ? '账号、密码和下一步 TOTP 验证码已填充' : (submitted ? '已提交登录表单，请稍后检测登录状态' : '账号和密码已填充，请在浏览器中确认并提交')) };
  if (!submitted) db.prepare("UPDATE accounts SET login_status='checking', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(accountId);
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
