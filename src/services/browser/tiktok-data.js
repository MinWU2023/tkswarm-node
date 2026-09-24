const { chromium } = require('playwright-core');
const { BitBrowserProvider } = require('./bit-browser-provider');
const dataStore = require('../data-store');
const phpApi = require('../php-api');
const { isHeadless } = require('./headless');

function numberFromText(value) {
  const text = String(value || '').replace(/,/g, '').trim().toUpperCase();
  const match = text.match(/([0-9]+(?:\.[0-9]+)?)([KMB])?/);
  if (!match) return null;
  const multiplier = { K: 1e3, M: 1e6, B: 1e9 }[match[2]] || 1;
  return Math.round(Number(match[1]) * multiplier);
}

function extractStat(text, labels) {
  for (const label of labels) {
    const match = text.match(new RegExp(`(${label})\\s*([0-9][0-9,.]*\\s*[KMB]?)`, 'i'));
    if (match) return numberFromText(match[2]);
  }
  return null;
}

async function loadAccount(accountId) {
  const bundle = await dataStore.getAccountBundle(accountId);
  if (!bundle) throw new Error('账号不存在');
  return {
    id: bundle.id,
    username: bundle.username,
    browser_profile_id: bundle.browser_profile_id,
  };
}

async function syncProfile(accountId) {
  const account = await loadAccount(accountId);
  if (!account.browser_profile_id) throw new Error('账号尚未绑定浏览器环境');
  const provider = new BitBrowserProvider();
  let browser;
  try {
    const opened = await provider.open(account.browser_profile_id, { headless: isHeadless('profile') });
    if (!opened?.ws) throw new Error('比特浏览器未返回 CDP WebSocket 地址');
    browser = await chromium.connectOverCDP(opened.ws, { timeout: 30000 });
    const context = browser.contexts()[0];
    const page = context.pages().find((item) => /tiktok\.com/i.test(item.url())) || context.pages()[0] || await context.newPage();
    const url = `https://www.tiktok.com/@${encodeURIComponent(account.username)}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500);
    const body = await page.locator('body').innerText().catch(() => '');
    if (/log in|登录|sign up/i.test(body) && !/followers|关注者/i.test(body)) throw new Error('当前浏览器没有有效 TikTok 登录状态');
    const profile = {
      accountId: account.id,
      handle: account.username,
      displayName: '',
      bio: '',
      avatarUrl: '',
      followersCount: extractStat(body, ['followers', '粉丝']),
      followingCount: extractStat(body, ['following', '关注']),
      likesCount: extractStat(body, ['likes', '赞']),
      videosCount: null,
      verified: /verified|已认证/i.test(body) ? 1 : 0,
      sourceUrl: page.url(),
    };
    const title = await page.title().catch(() => '');
    profile.displayName = title.replace(/\s*\|\s*TikTok.*$/i, '').trim() || account.username;
    const avatar = await page.locator('img').first().getAttribute('src').catch(() => '');
    profile.avatarUrl = avatar || '';

    await dataStore.tiktokSync(account.id, {
      profile: {
        handle: profile.handle,
        displayName: profile.displayName,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
        followers: profile.followersCount || 0,
        following: profile.followingCount || 0,
        likes: profile.likesCount || 0,
        videos: profile.videosCount || 0,
      },
      stats: {
        followers: profile.followersCount || 0,
        following: profile.followingCount || 0,
        likes: profile.likesCount || 0,
        videos: profile.videosCount || 0,
      },
    });
    return profile;
  } catch (error) {
    await dataStore.tiktokSync(account.id, { error: error.message }).catch(() => {});
    throw error;
  } finally {
    if (browser) await browser.close().catch(() => {});
    await provider.close(account.browser_profile_id).catch(() => {});
  }
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
    await provider.close(account.browser_profile_id).catch(() => {});
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
    return Array.isArray(data) ? data : (data?.items || []);
  } catch {
    return [];
  }
}

module.exports = { syncProfile, getProfile, syncVideos, getVideos, getStats };
