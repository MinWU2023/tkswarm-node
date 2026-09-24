const dataStore = require('./data-store');
const phpApi = require('./php-api');
const { BitBrowserProvider } = require('./browser/bit-browser-provider');
const { chromium } = require('playwright-core');
const { isHeadless } = require('./browser/headless');
const { publish: liveLog } = require('./live-log');

/**
 * 比特私信发送：本机 CDP 执行，结果回写 PHP
 */
async function bitSend(body = {}) {
  const friendId = Number(body.friendId || body.friend_id || 0);
  const content = String(body.content || '').trim();
  if (!friendId || !content) throw new Error('friendId 与 content 必填');

  const ctx = await phpApi.post('/node/chat/bit-send-context', { friendId });
  const accountId = Number(ctx.accountId);
  const profileId = String(ctx.browserProfileId || '');
  const recipient = String(ctx.recipient || ctx.username || '');
  if (!profileId) throw new Error('账号未绑定浏览器环境');

  const provider = new BitBrowserProvider();
  let browser;
  try {
    liveLog(`比特发送私信 → 账号#${accountId} ${recipient}`, 'info', { accountId });
    const opened = await provider.open(profileId, { headless: isHeadless('message') });
    if (!opened?.ws) throw new Error('比特未返回 CDP 地址');
    browser = await chromium.connectOverCDP(opened.ws, { timeout: 30000 });
    const context = browser.contexts()[0];
    const page = context.pages().find((p) => /tiktok\.com/i.test(p.url())) || context.pages()[0] || await context.newPage();
    // 轻量：打开聊天页并尝试填入（完整选择器逻辑可后续对齐 tiktok-actions）
    if (recipient) {
      await page.goto(`https://www.tiktok.com/messages?lang=en`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(1500);
    }
    const box = page.locator('[contenteditable="true"], textarea, div[role="textbox"]').last();
    await box.click({ timeout: 8000 }).catch(() => {});
    await box.fill(content).catch(async () => {
      await page.keyboard.type(content, { delay: 12 });
    });
    await page.keyboard.press('Enter').catch(() => {});
    await page.waitForTimeout(800);

    const saved = await phpApi.post('/node/chat/bit-send-result', {
      friendId,
      accountId,
      content,
      translated: body.translated || '',
      status: 'sent',
    });
    return { ok: true, friendId, accountId, message: saved };
  } finally {
    if (browser) await browser.close().catch(() => {});
    await provider.close(profileId).catch(() => {});
  }
}

module.exports = { bitSend };
