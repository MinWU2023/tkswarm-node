const { chromium } = require('playwright-core');
const { BitBrowserProvider } = require('./bit-browser-provider');
const { db } = require('../../db');

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

async function syncProfile(accountId) {
  const account = db.prepare('SELECT id, username, browser_profile_id FROM accounts WHERE id=?').get(accountId);
  if (!account) throw new Error('账号不存在');
  if (!account.browser_profile_id) throw new Error('账号尚未绑定浏览器环境');
  const provider = new BitBrowserProvider();
  let browser;
  try {
    const opened = await provider.open(account.browser_profile_id);
    if (!opened?.ws) throw new Error('比特浏览器未返回 CDP WebSocket 地址');
    browser = await chromium.connectOverCDP(opened.ws, { timeout: 30000 });
    const context = browser.contexts()[0];
    const page = context.pages().find(item => /tiktok\.com/i.test(item.url())) || context.pages()[0] || await context.newPage();
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
    db.prepare(`INSERT INTO tiktok_profiles
      (account_id,handle,display_name,bio,avatar_url,followers_count,following_count,likes_count,videos_count,verified,source_url,last_synced_at,sync_status,sync_error,updated_at)
      VALUES (@accountId,@handle,@displayName,@bio,@avatarUrl,@followersCount,@followingCount,@likesCount,@videosCount,@verified,@sourceUrl,CURRENT_TIMESTAMP,'success','',CURRENT_TIMESTAMP)
      ON CONFLICT(account_id) DO UPDATE SET handle=@handle,display_name=@displayName,bio=@bio,avatar_url=@avatarUrl,
      followers_count=@followersCount,following_count=@followingCount,likes_count=@likesCount,videos_count=@videosCount,
      verified=@verified,source_url=@sourceUrl,last_synced_at=CURRENT_TIMESTAMP,sync_status='success',sync_error='',updated_at=CURRENT_TIMESTAMP`).run(profile);
    return profile;
  } catch (error) {
    db.prepare(`INSERT INTO tiktok_profiles(account_id,sync_status,sync_error,last_synced_at)
      VALUES (?, 'failed', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(account_id) DO UPDATE SET sync_status='failed',sync_error=?,last_synced_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP`)
      .run(account.id, error.message, error.message);
    throw error;
  } finally {
    if (browser) await browser.close().catch(() => {});
    await provider.close(account.browser_profile_id).catch(() => {});
  }
}

function getProfile(accountId) {
  return db.prepare('SELECT * FROM tiktok_profiles WHERE account_id=?').get(accountId) || null;
}

module.exports = { syncProfile, getProfile };
