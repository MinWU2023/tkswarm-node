const fs = require('node:fs');
const path = require('node:path');

const SECURITY_PATTERNS = [
  /captcha/i, /verify/i, /verification/i, /人机验证/, /安全验证/, /设备验证/, /滑块/, /slider/i,
  /unusual activity/i, /suspicious/i, /maximum number of attempts/i, /too many attempts/i,
];

function automationDir() {
  const dir = path.resolve(__dirname, '../data/automation');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function inspectPage(page) {
  const url = page.url();
  const body = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
  const inputText = await page.locator('input,button').allTextContents().catch(() => []);
  const text = `${url}\n${body}\n${inputText.join('\n')}`;
  const matched = SECURITY_PATTERNS.find(pattern => pattern.test(text));
  return { blocked: Boolean(matched), reason: matched ? matched.source : '', url };
}

async function capture(page, accountId, action, label = 'state') {
  const dir = automationDir();
  const safeAction = String(action).replace(/[^a-z0-9_-]/gi, '_');
  const file = path.join(dir, `${Date.now()}-account-${accountId}-${safeAction}-${label}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(() => {});
  return file;
}

function classify(text) {
  const value = String(text || '');
  if (SECURITY_PATTERNS.some(pattern => pattern.test(value))) return 'security_paused';
  if (/published|posted|发布成功|已发布|sent|发送成功|已发送/i.test(value)) return 'success';
  if (/failed|error|失败|错误|try again/i.test(value)) return 'failed';
  return 'unknown';
}

module.exports = { inspectPage, capture, classify, SECURITY_PATTERNS };
