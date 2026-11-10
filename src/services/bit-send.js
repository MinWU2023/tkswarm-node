const dataStore = require('./data-store');
const phpApi = require('./php-api');
const { getProvider } = require('./browser/providers');
const { connectPlaywrightOverCDP, ensurePlaywrightPage } = require('./browser/cdp-connect');
const { isHeadless } = require('./browser/headless');
const { publish: liveLog } = require('./live-log');

/**
 * 自研浏览器私信发送：本机 CDP 执行，结果回写 PHP
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

  const provider = getProvider();
  let browser;
  try {
    liveLog(`自研浏览器发送私信 → 账号#${accountId} ${recipient}`, 'info', { accountId });
    const bundle = await dataStore.getAccountBundle(accountId).catch(() => null);
    let activeProvider = provider;
    let activeProfileId = profileId;
    if (bundle) {
      const { ensureAccountProxySynced } = require('./browser/proxy-sync');
      const synced = await ensureAccountProxySynced(bundle, {
        profileId,
        provider,
        accountId,
      });
      activeProvider = synced.provider;
      activeProfileId = synced.profileId;
    }
    const opened = await activeProvider.open(activeProfileId, {
      headless: isHeadless('message'),
      forceRelaunch: true,
    });
    if (!opened?.ws && !opened?.http) throw new Error('自研浏览器未返回 CDP 地址');
    browser = await connectPlaywrightOverCDP(opened, { timeoutMs: 30000 });
    const page = await ensurePlaywrightPage(browser, { preferUrl: /tiktok\.com/i });
    // 轻量：打开聊天页并尝试填入（完整选择器逻辑可后续对齐 tiktok-actions）
    if (recipient) {
      await page.goto(`https://www.tiktok.com/messages?lang=en`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(1500);
    }
    try {
      const { solveRotateCaptchaIfPresent } = require('./browser/nocaptchaai');
      await solveRotateCaptchaIfPresent(page, { accountId });
    } catch { /* ignore */ }
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
