/**
 * TikTok 自动养号：搜索 → 刷视频 → 按概率互动
 */
const { connectAccount, closeConnection } = require('./tiktok-actions');
const { capture } = require('../automation-guard');

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function randInt(min, max) {
  const a = Math.min(min, max);
  const b = Math.max(min, max);
  return a + Math.floor(Math.random() * (b - a + 1));
}

function chance(percent) {
  return Math.random() * 100 < Number(percent || 0);
}

function splitTerms(text) {
  return String(text || '')
    .split(/[\r\n,，;；]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildSearchUrl(searchType, term) {
  const q = encodeURIComponent(term);
  switch (searchType) {
    case 'top':
      return `https://www.tiktok.com/search?q=${q}`;
    case 'hashtag': {
      const tag = term.replace(/^#/, '');
      return `https://www.tiktok.com/tag/${encodeURIComponent(tag)}`;
    }
    case 'user': {
      if (term.startsWith('@') || /^[A-Za-z0-9._]+$/.test(term)) {
        const u = term.replace(/^@/, '');
        return `https://www.tiktok.com/@${encodeURIComponent(u)}`;
      }
      return `https://www.tiktok.com/search/user?q=${q}`;
    }
    case 'aweme': {
      const id = term.replace(/\D/g, '') || term;
      return `https://www.tiktok.com/video/${id}`;
    }
    case 'video':
    default:
      return `https://www.tiktok.com/search/video?q=${q}`;
  }
}

async function collectVideoHrefs(page, limit = 40) {
  const hrefs = await page.evaluate((max) => {
    const out = [];
    const seen = new Set();
    const nodes = document.querySelectorAll('a[href*="/video/"]');
    for (const a of nodes) {
      try {
        const u = new URL(a.href, location.origin);
        const m = u.pathname.match(/\/video\/(\d+)/);
        if (!m) continue;
        const key = m[1];
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(u.origin + u.pathname);
        if (out.length >= max) break;
      } catch { /* ignore */ }
    }
    return out;
  }, limit).catch(() => []);
  return hrefs || [];
}

async function pageTextSample(page) {
  return page.evaluate(() => {
    const desc = document.querySelector('[data-e2e="browse-video-desc"], [data-e2e="video-desc"], h1');
    return (desc?.innerText || document.body?.innerText || '').slice(0, 2000);
  }).catch(() => '');
}

function matchesKeywords(text, keywords) {
  if (!keywords.length) return true;
  const lower = String(text || '').toLowerCase();
  return keywords.some((k) => lower.includes(String(k).toLowerCase()));
}

async function clickByPatterns(page, patterns, { timeout = 2500 } = {}) {
  const targets = [page, ...page.frames().filter((f) => f !== page.mainFrame())];
  for (const target of targets) {
    for (const pattern of patterns) {
      try {
        const btn = target.getByRole('button', { name: pattern }).first();
        if (await btn.count() && await btn.isVisible()) {
          await btn.click({ timeout });
          return true;
        }
      } catch { /* continue */ }
      try {
        const el = target.getByText(pattern).first();
        if (await el.count() && await el.isVisible()) {
          await el.click({ timeout });
          return true;
        }
      } catch { /* continue */ }
    }
  }
  return false;
}

async function tryLike(page) {
  return clickByPatterns(page, [/like/i, /^赞$/, /^点赞$/, /^喜歡$/, /^喜欢$/]);
}

async function tryFavorite(page) {
  return clickByPatterns(page, [/favorite/i, /add to favorites/i, /^收藏$/, /^收藏视频$/, /^加入收藏$/]);
}

async function tryFollow(page) {
  return clickByPatterns(page, [/^Follow$/i, /^关注$/, /^追蹤$/, /^追踪$/]);
}

async function openComments(page) {
  const opened = await clickByPatterns(page, [/comment/i, /^评论$/, /^留言$/, /^查看评论$/]);
  if (opened) await delay(800);
  return opened;
}

async function scrollCommentPanel(page, pages) {
  for (let i = 0; i < pages; i++) {
    await page.mouse.wheel(0, 600).catch(() => {});
    await delay(600 + Math.random() * 400);
  }
}

async function likeComments(page, rate) {
  if (!chance(rate)) return 0;
  let liked = 0;
  const hearts = page.locator('[data-e2e*="comment"] [data-e2e*="like"], [data-e2e="comment-like-icon"], button[aria-label*="Like"], button[aria-label*="赞"]');
  const count = Math.min(5, await hearts.count().catch(() => 0));
  for (let i = 0; i < count; i++) {
    if (!chance(rate)) continue;
    try {
      await hearts.nth(i).click({ timeout: 1500 });
      liked += 1;
      await delay(300);
    } catch { /* ignore */ }
  }
  return liked;
}

async function enterFromComment(page) {
  const avatars = page.locator('[data-e2e*="comment"] a[href*="/@"], [data-e2e="comment-avatar"], a[href*="/@"]');
  if (!(await avatars.count().catch(() => 0))) return false;
  try {
    await avatars.first().click({ timeout: 2000 });
    await delay(2000);
    await tryFollow(page);
    await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await delay(1000);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {number} accountId
 * @param {object} cfg warm payload
 */
async function runWarmAccount(accountId, cfg = {}) {
  const searchType = cfg.searchType || 'video';
  const terms = splitTerms(cfg.searchTerms);
  if (!terms.length) throw new Error('缺少搜索词');
  const matchKw = splitTerms(cfg.matchKeywords);
  const videoTarget = randInt(Number(cfg.videoCountMin || 10), Number(cfg.videoCountMax || 10));
  const stayMin = Number(cfg.staySecondsMin || 10);
  const stayMax = Number(cfg.staySecondsMax || 20);
  const commentPages = Number(cfg.commentPages || 0);

  const stats = {
    browsed: 0,
    liked: 0,
    favorited: 0,
    followed: 0,
    commentsOpened: 0,
    commentLiked: 0,
    commentEntered: 0,
    skipped: 0,
    screenshot: '',
  };

  let connection;
  try {
    const term = terms[Math.floor(Math.random() * terms.length)];
    const startUrl = buildSearchUrl(searchType, term);
    connection = await connectAccount(accountId, startUrl, 'warm');
    const { page } = connection;
    await delay(2500);

    let hrefs = [];
    if (searchType === 'aweme') {
      hrefs = [page.url()];
    } else {
      for (let scroll = 0; scroll < 6 && hrefs.length < videoTarget; scroll++) {
        const more = await collectVideoHrefs(page, videoTarget * 2);
        for (const h of more) {
          if (!hrefs.includes(h)) hrefs.push(h);
        }
        await page.mouse.wheel(0, 1200).catch(() => {});
        await delay(1000);
      }
      if (searchType === 'user' && !hrefs.length) {
        // 用户主页可能直接是作品栅格
        hrefs = await collectVideoHrefs(page, videoTarget * 2);
      }
    }

    if (!hrefs.length) {
      stats.screenshot = await capture(page, `warm-empty-${accountId}`).catch(() => '');
      throw new Error('未找到可刷视频，请检查搜索词或登录状态');
    }

    const pick = hrefs.slice(0, Math.min(videoTarget, hrefs.length));
    for (const href of pick) {
      try {
        await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await delay(1500);
        const sample = await pageTextSample(page);
        if (!matchesKeywords(sample, matchKw)) {
          stats.skipped += 1;
          continue;
        }
        stats.browsed += 1;
        await delay(randInt(stayMin, stayMax) * 1000);

        if (chance(cfg.likeRate)) {
          if (await tryLike(page)) stats.liked += 1;
          await delay(400);
        }
        if (chance(cfg.favoriteRate)) {
          if (await tryFavorite(page)) stats.favorited += 1;
          await delay(400);
        }
        if (chance(cfg.followRate)) {
          if (await tryFollow(page)) stats.followed += 1;
          await delay(400);
        }
        if (chance(cfg.viewCommentRate)) {
          if (await openComments(page)) {
            stats.commentsOpened += 1;
            if (commentPages > 0) await scrollCommentPanel(page, commentPages);
            stats.commentLiked += await likeComments(page, cfg.commentLikeRate);
            if (chance(cfg.commentEnterRate)) {
              if (await enterFromComment(page)) stats.commentEntered += 1;
            }
          }
        }
      } catch (e) {
        stats.skipped += 1;
      }
    }

    if (!stats.browsed) {
      stats.screenshot = await capture(page, `warm-no-match-${accountId}`).catch(() => '');
    }
    return { status: 'success', ...stats };
  } finally {
    await closeConnection(connection);
  }
}

module.exports = { runWarmAccount, buildSearchUrl };
