const { connectAccount, closeConnection } = require('../tiktok-actions');
const phpApi = require('../../php-api');
const { publish: liveLog } = require('../../live-log');

const HOME_URL = 'https://www.tiktok.com/';

const SELECTORS = {
  usersTab: [
    '[data-e2e="search-user"]',
    '[data-e2e="tab-search_user"]',
    '[data-e2e="search-tab-user"]',
    'a[href*="/search/user"]',
  ],
  searchUserItem: [
    'div[class*="DivSearchUserItemContainer"]',
    'div[class*="DivSearchItemContainer"]',
    'a.link-a11y-focus[href*="/@"]',
    '[data-e2e="search-user-item"]',
    '[data-e2e="search-user-info"]',
    'a[href*="/@"]',
  ],
  commentOpen: [
    '[data-e2e="browse-comment-icon"]',
    'button[data-e2e="browse-comment-icon"]',
    '[data-e2e="comment-icon"]',
    '[data-e2e="video-comment-icon"]',
    'button[aria-label*="Comment" i]',
    'button[aria-label*="comment" i]',
    'button[aria-label*="评论"]',
  ],
  commentPanelReady: [
    '[data-e2e="comment-list"]',
    '[data-e2e="comment-item"]',
    '[data-e2e="comment-level-1"]',
    '[data-e2e="comment-input"]',
    '[class*="DivCommentListContainer"]',
    '[class*="DivCommentContainer"]',
    '[class*="CommentItem"]',
    '[placeholder*="Add comment" i]',
    '[placeholder*="添加评论"]',
  ],
  commentItem: [
    '[data-e2e="comment-item"]',
    '[data-e2e="comment-level-1"]',
    'div[class*="CommentItem"]',
    'div[class*="DivCommentObjectWrapper"]',
  ],
};

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function humanPause(baseMs, spread = 0.3) {
  const b = Math.max(0, Number(baseMs) || 0);
  const delta = b * spread * (Math.random() * 2 - 1);
  return delay(Math.max(0, Math.round(b + delta)));
}

const { parseMetricCount } = require('./parse-metric-count');

function absUrl(href) {
  const u = String(href || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u.split('?')[0];
  if (u.startsWith('//')) return `https:${u.split('?')[0]}`;
  if (u.startsWith('/')) return `https://www.tiktok.com${u.split('?')[0]}`;
  return u;
}

function profileUrlFromUsername(username) {
  const u = String(username || '').replace(/^@+/, '').trim();
  return u ? `https://www.tiktok.com/@${u}` : '';
}

async function firstVisible(page, selectors, timeoutMs = 8000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    for (const sel of selectors) {
      try {
        const loc = page.locator(sel).first();
        if (await loc.count() && await loc.isVisible().catch(() => false)) {
          return loc;
        }
      } catch { /* next */ }
    }
    await humanPause(400, 0.2);
  }
  return null;
}

/**
 * 页面跳转：跳前停顿 + 跳后落稳，降低风控。
 * settleMs 默认约 4s（可传 afterMs 覆盖）。
 */
async function safeGoto(connection, url, {
  accountId = 0,
  label = 'navigate',
  beforeMs = 2000,
  afterMs = 4000,
} = {}) {
  let page = connection?.page;
  if (!page) throw new Error('no page');
  liveLog(`AI拓客 ${label}: ${url}`, 'info', { accountId });
  await humanPause(beforeMs, 0.2);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(async () => {
    await page.evaluate((u) => { window.location.assign(u); }, url).catch(() => {});
    await humanPause(3000, 0.2);
  });
  await humanPause(afterMs, 0.2);
  return page;
}

async function searchUsersPage(connection, keyword, accountId) {
  const q = encodeURIComponent(String(keyword || '').trim());
  const url = `https://www.tiktok.com/search/user?q=${q}`;
  const page = await safeGoto(connection, url, { accountId, label: '用户搜索', afterMs: 4500 });
  const tab = await firstVisible(page, SELECTORS.usersTab, 6000);
  if (tab) {
    await tab.click({ timeout: 5000 }).catch(() => tab.click({ force: true }).catch(() => {}));
    await humanPause(2500, 0.2);
  }
  return page;
}

/**
 * 下滑加载更多。
 * 默认：每屏内容看完后再滚，间隔 5s（防封）；搜索等场景可传更短 pauseMs。
 * settleFirst：首轮滚动前先等一页内容落稳。
 */
async function scrollLoadMore(page, { rounds = 6, pauseMs = 5000, settleFirst = true } = {}) {
  if (settleFirst) {
    await humanPause(Math.min(pauseMs, 3000), 0.15);
  }
  for (let i = 0; i < rounds; i += 1) {
    await page.mouse.wheel(0, 900).catch(() => {});
    await page.keyboard.press('End').catch(() => {});
    // 下一屏前固定等待（略抖动），主页刷视频用 5s
    await humanPause(pauseMs, 0.12);
  }
}

async function reportProgress(leadId, progress, stats) {
  if (!leadId) return;
  await phpApi.post(`/node/ai-leads/${leadId}/progress`, {
    progress,
    stats: stats || undefined,
  }).catch(() => {});
}

async function saveCreator(leadId, accountId, user) {
  return phpApi.post(`/node/ai-leads/${leadId}/creators`, {
    accountId,
    ...user,
  });
}

async function saveVideo(leadId, accountId, video) {
  return phpApi.post(`/node/ai-leads/${leadId}/videos`, {
    accountId,
    ...video,
  });
}

async function filterCommentsViaAi(comments, filterPrompt) {
  if (!comments?.length) return [];
  try {
    const res = await phpApi.post('/node/ai-leads/filter-comments', {
      comments,
      prompt: filterPrompt || '',
    });
    const list = res?.comments || res?.data?.comments || res?.data?.data?.comments || [];
    return Array.isArray(list) ? list : [];
  } catch (err) {
    liveLog(`AI拓客 AI筛选失败: ${err?.message || err}`, 'warn');
    return [];
  }
}

async function saveMatchedComments(leadId, videoId, comments) {
  return phpApi.post(`/node/ai-leads/${leadId}/comments`, {
    videoId,
    comments,
    aiPass: true,
  });
}

async function finishLead(leadId, success, result) {
  await phpApi.post(`/node/ai-leads/${leadId}/finish`, { success, result }).catch(() => {});
}

module.exports = {
  HOME_URL,
  SELECTORS,
  delay,
  humanPause,
  parseMetricCount,
  parseCount: parseMetricCount,
  absUrl,
  profileUrlFromUsername,
  connectAccount,
  closeConnection,
  firstVisible,
  safeGoto,
  searchUsersPage,
  scrollLoadMore,
  reportProgress,
  saveCreator,
  saveVideo,
  filterCommentsViaAi,
  saveMatchedComments,
  finishLead,
  liveLog,
};
