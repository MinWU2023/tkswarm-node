const { chromium } = require('playwright-core');
const { BitBrowserProvider } = require('./bit-browser-provider');
const dataStore = require('../data-store');
const phpApi = require('../php-api');
const { isHeadless } = require('./headless');
const { syncProfile } = require('./tiktok-profile');

async function loadAccount(accountId) {
  const bundle = await dataStore.getAccountBundle(accountId);
  if (!bundle) throw new Error('账号不存在');
  return {
    id: bundle.id,
    username: bundle.username,
    browser_profile_id: bundle.browser_profile_id,
  };
}

async function syncVideos(accountId, limit = 100) {
  const account = await loadAccount(accountId);
  if (!account.browser_profile_id) throw new Error('账号尚未绑定浏览器环境');
  const provider = new BitBrowserProvider();
  let browser;
  try {
    const opened = await provider.open(account.browser_profile_id, { headless: isHeadless('sync') });
    if (!opened?.ws) throw new Error('比特浏览器未返回 CDP WebSocket 地址');
    browser = await chromium.connectOverCDP(opened.ws, { timeout: 30000 });
    const context = browser.contexts()[0];
    const page = context.pages().find((item) => /tiktok\.com/i.test(item.url())) || context.pages()[0] || await context.newPage();
    await page.goto(`https://www.tiktok.com/@${encodeURIComponent(account.username)}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500);
    const links = await page.locator(`a[href*="/@${account.username}/video/"]`).evaluateAll((els, max) => els.slice(0, max).map((el) => ({
      url: el.href, text: (el.innerText || el.getAttribute('aria-label') || '').trim(),
      image: el.querySelector('img')?.src || '',
    })), Math.min(100, Math.max(1, Number(limit) || 100)));
    const items = links.map((item) => {
      const match = item.url.match(/\/video\/(\d+)/);
      return match ? { videoId: match[1], videoUrl: item.url, description: item.text.slice(0, 1000), thumbnailUrl: item.image } : null;
    }).filter(Boolean);

    await dataStore.tiktokSync(account.id, { videos: items });
    return { accountId: account.id, count: items.length, items };
  } finally {
    if (browser) await browser.close().catch(() => {});
    let keep = false;
    try {
      const { shouldKeepBrowserOpen } = require('../session-context');
      keep = shouldKeepBrowserOpen();
    } catch { /* ignore */ }
    if (!keep) await provider.close(account.browser_profile_id).catch(() => {});
  }
}

async function getProfile(accountId) {
  try {
    return await phpApi.get(`/accounts/${accountId}/tiktok-profile`);
  } catch {
    return null;
  }
}

async function getVideos(accountId) {
  try {
    const data = await phpApi.get(`/accounts/${accountId}/tiktok-videos`);
    return Array.isArray(data) ? data : (data?.items || []);
  } catch {
    return [];
  }
}

async function getStats(accountId) {
  try {
    const data = await phpApi.get(`/accounts/${accountId}/tiktok-stats`);
    if (Array.isArray(data)) return { snapshots: data, daily28: [] };
    return {
      snapshots: data?.snapshots || data?.items || [],
      daily28: data?.daily28 || [],
    };
  } catch {
    return { snapshots: [], daily28: [] };
  }
}

module.exports = { syncProfile, getProfile, syncVideos, getVideos, getStats };
