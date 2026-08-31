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

async function loginAssist(accountId, { autoSubmit = false } = {}) {
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

  await page.goto('https://www.tiktok.com/login/phone-or-email/email', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const captcha = /(captcha|验证码|verify you are human|人机验证|滑块|security check)/i.test(bodyText);
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
      'input[autocomplete="one-time-code"]', 'input[name*="code"]', 'input[placeholder*="code"]',
      'input[placeholder*="Code"]', 'input[placeholder*="验证码"]',
    ]);
    if (totpInput) {
      await totpInput.fill(generateTotp(totpSecret).code);
      totpFilled = true;
    }
  }
  let submitted = false;
  if (autoSubmit && !captcha) {
    const button = await firstVisible(page, ['button[type="submit"]', 'button:has-text("Log in")', 'button:has-text("登录")']);
    if (button) { await button.click(); submitted = true; await page.waitForTimeout(2500); }
  }
  const result = { accountId, username: account.username, filled: true, submitted, totpFilled, captcha, screenshot, currentUrl: page.url(), pageTitle: await page.title(), message: captcha ? '检测到安全验证，已暂停自动提交，请人工处理' : (submitted ? '已提交登录表单，请稍后检测登录状态' : '账号和密码已填充，请在浏览器中确认并提交') };
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
