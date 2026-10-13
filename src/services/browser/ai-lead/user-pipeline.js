/**
 * AI拓客 · 按用户类型
 * 搜索 Users → 粉丝筛选 → 打开主页校验点赞 → 抓视频 → 抓评论 → AI 筛选 → 入库
 *
 * 注意：TikTok 搜索 Users 列表通常只有粉丝数，没有获赞数。
 * 列表阶段只按粉丝下限筛；获赞下限在进入主页后校验。
 */
const { parseMetricCount } = require('./parse-metric-count');
// 必须注入 parseMetricCount 本体。parseMetricCountInBrowser 只是一层转发，
// toString 后在页面里会变成「调用不存在/自身」而栈溢出，evaluate 直接空结果。
const PARSE_METRIC_FN = parseMetricCount.toString();

const {
  connectAccount,
  closeConnection,
  absUrl,
  profileUrlFromUsername,
  searchUsersPage,
  scrollLoadMore,
  reportProgress,
  saveCreator,
  saveVideo,
  filterCommentsViaAi,
  saveMatchedComments,
  finishLead,
  safeGoto,
  humanPause,
  firstVisible,
  SELECTORS,
  liveLog,
  delay,
} = require('./pipeline-base');

const MAX_USERS = 30;
const MAX_VIDEOS_PER_USER = 20;
const MAX_COMMENT_ROUNDS = 8;

/**
 * 页面上收集原始用户卡片（未做下限筛选）
 * 适配 TikTok 新版 Users 列表结构：
 *   a.link-a11y-focus[href="/@user"]
 *     > div[class*="DivSearchItemContainer"] / DivSearchUserItemContainer
 *       p(bold)=昵称, p(normal)=username, p+p = "37.1K"+"Followers", p+p = "243.1K"+"Likes"
 */
async function collectUsersFromFrame(frame) {
  return frame.evaluate((parseFnSource) => {
    const parseMetricCount = eval(`(${parseFnSource})`);

    const skipUser = (u) => {
      const x = String(u || '').toLowerCase();
      return !x || x === 'tiktok' || x.startsWith('http') || x.includes('login') || x.includes('signup');
    };

    /** 从卡片内 p/span 序列解析 Followers / Likes（数字与标签分列） */
    const pickMetricFromLabels = (ps, labelRe) => {
      for (let i = 0; i < ps.length; i += 1) {
        if (!labelRe.test(ps[i])) continue;
        // 标签前一个节点通常是数字
        for (let j = i - 1; j >= Math.max(0, i - 2); j -= 1) {
          const t = ps[j];
          if (/^[\d.,]+\s*[kKmMbB万亿wW]?$/i.test(t)) return t;
        }
      }
      // 兼容 "37.1K Followers" 合在一起
      for (const t of ps) {
        const m = String(t).match(
          new RegExp(
            `([\\d]{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)\\s*([kKmMbB万亿wW])?\\s*(${labelRe.source})`,
            'i'
          )
        );
        if (m) return m[0];
      }
      return '';
    };

    // 新版：整行是 a.link-a11y-focus；旧版可能还有 data-e2e
    const anchors = Array.from(document.querySelectorAll(
      [
        'a.link-a11y-focus[href*="/@"]',
        'a[href*="/@"][class*="link"]',
        'div[class*="DivSearchUserItemContainer"] a[href*="/@"]',
        'div[class*="DivSearchItemContainer"] a[href*="/@"]',
        '[data-e2e="search-user-item"] a[href*="/@"]',
        'a[href*="/@"]',
      ].join(', ')
    ));

    const items = [];
    const seen = new Set();

    for (const anchor of anchors) {
      const href = anchor.getAttribute('href') || '';
      if (/\/video\//i.test(href)) continue;
      const m = href.match(/\/@([^/?#]+)/);
      if (!m) continue;
      let username = m[1];
      try { username = decodeURIComponent(username); } catch { /* keep */ }
      if (skipUser(username) || seen.has(username.toLowerCase())) continue;

      // 卡片根：优先 SearchUserItem / SearchItem 容器
      const root = anchor.querySelector('[class*="DivSearchUserItemContainer"], [class*="DivSearchItemContainer"]')
        || anchor.closest('[class*="DivSearchUserItemContainer"], [class*="DivSearchItemContainer"], [data-e2e="search-user-item"]')
        || anchor;

      // 只取卡片内短文本 p/span，避免 Follow 按钮等干扰
      const ps = Array.from(root.querySelectorAll('p.TUXText, p, span.TUXText, span'))
        .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
        .filter((t) => t && t.length < 64 && t !== '·' && t !== '•' && !/^follow$/i.test(t));

      // 昵称：粗体；用户名：与 href 一致的那一行
      const boldEl = root.querySelector('p.TUXText--weight-bold, p[class*="weight-bold"], strong');
      let nickname = (boldEl?.textContent || '').replace(/\s+/g, ' ').trim();
      const handleEl = Array.from(root.querySelectorAll('p.TUXText--weight-normal, p[class*="weight-normal"], p'))
        .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
        .find((t) => t && t.toLowerCase() === username.toLowerCase());
      if (handleEl) {
        // ok
      }
      if (!nickname || nickname.toLowerCase() === username.toLowerCase()) {
        nickname = ps.find((t) => (
          t.toLowerCase() !== username.toLowerCase()
          && !/^(followers?|likes?|获赞|粉丝)$/i.test(t)
          && !/^[\d.,]+\s*[kKmMbB万亿wW]?$/i.test(t)
        )) || username;
      }

      const followersText = pickMetricFromLabels(ps, /^(followers?|粉丝)$/i);
      const likesText = pickMetricFromLabels(ps, /^(likes?|获赞)$/i);
      if (!followersText && !likesText && ps.length < 2) {
        // 不像用户卡片（可能是顶栏/其它链接）
        continue;
      }

      seen.add(username.toLowerCase());
      const img = root.querySelector('img.user-avatar, img.TUXBaseAvatar-src, .user-avatar-container img, img');
      const pathOnly = href.split('?')[0];
      items.push({
        username,
        nickname: nickname || username,
        avatar: img?.getAttribute('src') || '',
        profileUrl: pathOnly.startsWith('http') ? pathOnly : `https://www.tiktok.com${pathOnly}`,
        followersText,
        likesText,
        followers: parseMetricCount(followersText),
        likes: parseMetricCount(likesText),
        hasLikesOnCard: !!likesText,
      });
    }
    return items;
  }, PARSE_METRIC_FN).catch((err) => {
    console.error('[ai-lead] collectUsersFromFrame failed', err?.message || err);
    return { __error: String(err?.message || err) };
  });
}

async function collectRawUsersFromPage(page) {
  const frames = [page, ...(page.frames?.() || []).filter((f) => f !== page.mainFrame?.())];
  const merged = [];
  const seen = new Set();
  let lastError = '';
  for (const frame of frames) {
    const rows = await collectUsersFromFrame(frame);
    if (rows && rows.__error) {
      lastError = rows.__error;
      continue;
    }
    for (const row of rows || []) {
      const key = String(row.username || '').toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(row);
    }
  }
  if (!merged.length && lastError) {
    liveLog(`AI拓客页面解析异常: ${lastError}`, 'warn');
  }
  return merged;
}

async function dumpSearchPageHint(page) {
  const dump = await page.evaluate(() => ({
    url: location.href,
    atLinks: document.querySelectorAll('a[href*="/@"]').length,
    searchCards: document.querySelectorAll(
      '[class*="DivSearchUserItemContainer"], [class*="DivSearchItemContainer"], a.link-a11y-focus'
    ).length,
    hint: (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 160),
  })).catch((err) => ({ url: '', atLinks: 0, searchCards: 0, hint: String(err?.message || err) }));
  liveLog(
    `AI拓客诊断 url=${dump.url} @链接=${dump.atLinks} 搜索节点=${dump.searchCards} ${dump.hint || ''}`,
    'info'
  );
  return dump;
}

/**
 * 列表筛选：主要按粉丝；卡片上若能读到获赞也一并筛。
 * 返回 { raw, passed, dropped }
 */
function filterUsersByLimits(rawRows, limits) {
  const minFollowers = Number(limits.limitFollows || 0);
  const minLikes = Number(limits.limitLikes || 0);
  const seen = new Set();
  const passed = [];
  const dropped = [];

  for (const row of rawRows || []) {
    const username = String(row.username || '').trim();
    if (!username || seen.has(username.toLowerCase())) continue;
    seen.add(username.toLowerCase());

    const followers = parseMetricCount(row.followersText ?? row.followers);
    const likes = parseMetricCount(row.likesText ?? row.likes);
    const hasLikesOnCard = !!row.hasLikesOnCard || !!row.likesText;

    if (followers < minFollowers) {
      dropped.push({ username, followers, likes, reason: `粉丝${followers}<${minFollowers}` });
      continue;
    }
    // 仅当卡片上确实有获赞数据时才在列表阶段卡获赞；否则留到主页再验
    if (hasLikesOnCard && minLikes > 0 && likes < minLikes) {
      dropped.push({ username, followers, likes, reason: `获赞${likes}<${minLikes}` });
      continue;
    }

    passed.push({
      username,
      nickname: row.nickname || username,
      avatar: row.avatar || '',
      profileUrl: absUrl(row.profileUrl) || profileUrlFromUsername(username),
      followers,
      likes,
      hasLikesOnCard,
      likesPending: !hasLikesOnCard && minLikes > 0,
    });
  }
  return { raw: rawRows || [], passed, dropped };
}

async function waitForUserResults(page, { timeoutMs = 25000 } = {}) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const n = await page.locator(
      [
        'div[class*="DivSearchUserItemContainer"]',
        'div[class*="DivSearchItemContainer"]',
        'a.link-a11y-focus[href*="/@"]',
        '[data-e2e="search-user-item"]',
        'a[href*="/@"]',
      ].join(', ')
    ).count().catch(() => 0);
    if (n >= 1) return true;
    const blocked = await page.evaluate(() => {
      const t = (document.body?.innerText || '').slice(0, 4000);
      return /verify you.?re (a )?human|security check|something went wrong|没有结果|no results|couldn'?t find|unusual traffic/i.test(t);
    }).catch(() => false);
    if (blocked) return false;
    await humanPause(800, 0.2);
  }
  return false;
}

async function scrapeProfileStats(page, username) {
  const profileUrl = profileUrlFromUsername(username);
  await safeGoto({ page }, profileUrl, {
    label: `主页统计 @${username}`,
    beforeMs: 2500,
    afterMs: 4500,
  });
  await humanPause(1500, 0.15);

  const stats = await page.evaluate((parseFnSource) => {
    const parseMetricCount = eval(`(${parseFnSource})`);
    const readByE2e = (sels) => {
      for (const sel of sels) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const t = (el.getAttribute('title') || el.textContent || '').trim();
        if (t) return t;
      }
      return '';
    };
    const followersText = readByE2e([
      '[data-e2e="followers-count"]',
      'strong[data-e2e="followers-count"]',
      '[data-e2e="user-follower-count"]',
    ]);
    const likesText = readByE2e([
      '[data-e2e="likes-count"]',
      'strong[data-e2e="likes-count"]',
      '[data-e2e="user-likes-count"]',
    ]);
    // 兜底扫可见文案
    let followers = parseMetricCount(followersText);
    let likes = parseMetricCount(likesText);
    if (!followers || !likes) {
      const texts = Array.from(document.querySelectorAll('strong, span'))
        .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      for (let i = 0; i < texts.length; i += 1) {
        if (/^(followers?|粉丝)$/i.test(texts[i]) && !followers) {
          followers = parseMetricCount(texts[i - 1] || '');
        }
        if (/^(likes?|获赞)$/i.test(texts[i]) && !likes) {
          likes = parseMetricCount(texts[i - 1] || '');
        }
      }
    }
    const avatar = document.querySelector('img[data-e2e="user-avatar"], span[shape="circle"] img, img')?.getAttribute('src') || '';
    const nickname = (document.querySelector('h1[data-e2e="user-title"], h1, h2')?.textContent || '').trim();
    return { followers, likes, avatar, nickname };
  }, PARSE_METRIC_FN).catch(() => ({ followers: 0, likes: 0, avatar: '', nickname: '' }));

  return stats;
}

async function collectProfileVideoRows(page, minLikes) {
  const videos = await page.evaluate(({ minLike, parseFnSource }) => {
    const parseMetricCount = eval(`(${parseFnSource})`);
    const extractLikesText = (el) => {
      const parts = [];
      const parent = el.closest('div');
      if (parent) parts.push(parent.textContent || '');
      const aria = el.getAttribute('aria-label') || parent?.getAttribute('aria-label') || '';
      if (aria) parts.push(aria);
      for (const text of parts) {
        const m = String(text).match(
          /([\d]{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*([kKmMbB万亿wW])?\s*(likes?|赞|heart|views?)/i
        );
        if (m) return m[0];
        const strong = el.querySelector?.('strong');
        if (strong) return (strong.textContent || '').trim();
      }
      return '';
    };
    const out = [];
    const seen = new Set();
    document.querySelectorAll('a[href*="/video/"]').forEach((a) => {
      const href = a.getAttribute('href') || '';
      if (!href.includes('/video/') || seen.has(href)) return;
      seen.add(href);
      const img = a.querySelector('img');
      const cover = img?.getAttribute('src') || '';
      const title = (a.getAttribute('title') || img?.getAttribute('alt') || a.textContent || '').trim().slice(0, 120);
      const likesText = extractLikesText(a);
      const likes = parseMetricCount(likesText);
      if (likes >= minLike) {
        out.push({
          videoUrl: href.startsWith('http') ? href : `https://www.tiktok.com${href}`,
          videoCover: cover,
          videoName: title,
          likesText,
          likes,
        });
      }
    });
    return out;
  }, { minLike: minLikes, parseFnSource: PARSE_METRIC_FN }).catch(() => []);

  return (videos || [])
    .map((v) => ({
      ...v,
      likes: parseMetricCount(v.likesText ?? v.likes),
    }))
    .filter((v) => v.likes >= minLikes);
}

/**
 * 主页找视频：读完当前屏 → 等 5s → 再下滑；跳转主页后也先落稳。
 */
async function scrapeProfileVideos(page, creatorUsername, minLikes) {
  const cur = page.url() || '';
  const need = profileUrlFromUsername(creatorUsername);
  if (!cur.includes(`/@${creatorUsername}`)) {
    await safeGoto({ page }, need, {
      label: `主页视频 @${creatorUsername}`,
      beforeMs: 2500,
      afterMs: 5000,
    });
  } else {
    await humanPause(3000, 0.15);
  }

  const merged = [];
  const seen = new Set();
  const maxRounds = 6;
  for (let round = 0; round < maxRounds; round += 1) {
    const batch = await collectProfileVideoRows(page, minLikes);
    for (const v of batch) {
      const key = String(v.videoUrl || '').split('?')[0];
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(v);
      if (merged.length >= MAX_VIDEOS_PER_USER) break;
    }
    if (merged.length >= MAX_VIDEOS_PER_USER) break;
    // 当前屏采完后再下滑，固定延迟 5 秒
    liveLog(`AI拓客 @${creatorUsername} 主页视频第${round + 1}屏已采 ${merged.length} 个，5秒后下滑`, 'info');
    await humanPause(5000, 0.08);
    await page.mouse.wheel(0, 1100).catch(() => {});
    await page.keyboard.press('End').catch(() => {});
    await humanPause(1500, 0.15);
  }
  return merged.slice(0, MAX_VIDEOS_PER_USER);
}

/** TikTok 直链 /video/ 常被边缘风控打成 Oops 页 */
async function isOopsOrBlockedPage(page) {
  return page.evaluate(() => {
    const t = (document.body?.innerText || '').slice(0, 2500);
    return /oops!?\s*something went wrong|something went wrong|please contact your administrator|verify you.?re (a )?human|security check|unusual traffic/i.test(t);
  }).catch(() => false);
}

function extractVideoId(videoUrl) {
  const m = String(videoUrl || '').match(/\/video\/(\d+)/);
  return m ? m[1] : '';
}

/**
 * 禁止 page.goto 公开 /video/ 直链（易触发 Oops）。
 * 回到作者主页，点击对应封面进入浏览态。
 */
async function openVideoViaProfileClick(page, videoUrl, creatorUsername) {
  const videoId = extractVideoId(videoUrl);
  const uname = String(creatorUsername || '').replace(/^@+/, '');
  if (!videoId || !uname) return false;

  const profileUrl = profileUrlFromUsername(uname);
  const cur = page.url() || '';
  if (!cur.includes(`/@${uname}`) || /\/video\//i.test(cur) || await isOopsOrBlockedPage(page)) {
    await safeGoto({ page }, profileUrl, {
      label: `回主页开视频 @${uname}`,
      beforeMs: 2500,
      afterMs: 4500,
    });
  } else {
    await humanPause(2500, 0.15);
  }

  // 滚动找封面：每屏找完再等 5s 下滑
  for (let round = 0; round < 10; round += 1) {
    const loc = page.locator(`a[href*="/video/${videoId}"]`).first();
    if (await loc.count().catch(() => 0)) {
      await loc.scrollIntoViewIfNeeded().catch(() => {});
      await humanPause(800, 0.2);
      const box = await loc.boundingBox().catch(() => null);
      if (box) {
        await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45).catch(() => {});
        await humanPause(400, 0.1);
      }
      await loc.click({ timeout: 5000, delay: 60 }).catch(() => loc.click({ force: true }).catch(() => {}));
      await humanPause(3500, 0.2);

      if (await isOopsOrBlockedPage(page)) {
        liveLog(`AI拓客视频风控 Oops（点击后）id=${videoId}`, 'warn');
        await safeGoto({ page }, profileUrl, {
          label: `Oops 后回主页 @${uname}`,
          beforeMs: 2000,
          afterMs: 4500,
        });
        return false;
      }
      // 浏览态或 URL 已含该 videoId 即视为成功
      const url = page.url() || '';
      const browse = await page.locator(
        '[data-e2e="browse-comment-icon"], [data-e2e="browse-like-icon"], [data-e2e="browse-video"], video'
      ).count().catch(() => 0);
      if (url.includes(videoId) || browse > 0) return true;
    }
    await humanPause(5000, 0.08);
    await page.mouse.wheel(0, 1100).catch(() => {});
    await humanPause(1200, 0.15);
  }
  return false;
}

async function ensureCommentPanelOpen(page) {
  const ready = await firstVisible(page, SELECTORS.commentPanelReady, 2500);
  if (ready) return true;

  const openBtn = await firstVisible(page, SELECTORS.commentOpen, 8000);
  if (openBtn) {
    await openBtn.click({ timeout: 5000 }).catch(() => openBtn.click({ force: true }).catch(() => {}));
    await humanPause(1600, 0.2);
  } else {
    // 浏览态偶发没有 data-e2e，用文案点一次
    const byText = page.getByText(/^(Comments|评论|留言)$/i).first();
    if (await byText.count().catch(() => 0)) {
      await byText.click({ timeout: 4000 }).catch(() => {});
      await humanPause(1200, 0.2);
    }
  }

  // 空白侧栏时再点一次评论图标
  let ok = await firstVisible(page, SELECTORS.commentPanelReady, 6000);
  if (!ok) {
    const again = await firstVisible(page, SELECTORS.commentOpen, 3000);
    if (again) {
      await again.click({ force: true }).catch(() => {});
      await humanPause(1500, 0.2);
      ok = await firstVisible(page, SELECTORS.commentPanelReady, 5000);
    }
  }
  return !!ok;
}

async function scrapeVideoComments(page, videoUrl, creatorUsername) {
  const opened = await openVideoViaProfileClick(page, videoUrl, creatorUsername);
  if (!opened) {
    liveLog(`AI拓客跳过视频（无法从主页打开/风控）: ${videoUrl}`, 'warn');
    return [];
  }

  if (await isOopsOrBlockedPage(page)) {
    liveLog(`AI拓客跳过视频（评论页 Oops）: ${videoUrl}`, 'warn');
    return [];
  }

  const panelOk = await ensureCommentPanelOpen(page);
  if (!panelOk) {
    liveLog(`AI拓客评论栏未打开: ${videoUrl}`, 'warn');
  }

  const creator = String(creatorUsername || '').replace(/^@+/, '').toLowerCase();
  const comments = [];
  const seen = new Set();

  for (let round = 0; round < MAX_COMMENT_ROUNDS; round += 1) {
    const batch = await page.evaluate((author) => {
      const out = [];
      const seenLocal = new Set();
      const nodes = document.querySelectorAll(
        [
          '[data-e2e="comment-item"]',
          '[data-e2e="comment-level-1"]',
          'div[class*="CommentItem"]',
          'div[class*="DivCommentObjectWrapper"]',
          'div[class*="DivCommentItemContainer"]',
          '[class*="CommentList"] [class*="DivComment"]',
        ].join(', ')
      );

      const cleanText = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();

      nodes.forEach((node) => {
        const link = node.querySelector('a[href*="/@"]');
        const href = link?.getAttribute('href') || '';
        const um = href.match(/\/@([^/?#]+)/);
        let username = um ? um[1] : '';
        try { username = decodeURIComponent(username); } catch { /* keep */ }
        if (!username) return;
        if (author && username.toLowerCase() === author) return;

        const nicknameEl = node.querySelector(
          '[data-e2e="comment-username"], [data-e2e="comment-user-uniqueid"], a[href*="/@"] span, a[href*="/@"] p, strong'
        );
        let nickname = cleanText(nicknameEl) || username;

        // 评论正文：优先专用节点，避免把用户名/时间拼进正文
        const textEl = node.querySelector(
          [
            '[data-e2e="comment-level-1"]',
            '[data-e2e="comment-level-2"]',
            'span[data-e2e="comment-text"]',
            'p[data-e2e="comment-text"]',
            'span[class*="CommentText"]',
            'p[class*="CommentText"]',
            'div[class*="DivCommentContent"] span',
            'div[class*="DivCommentContent"] p',
          ].join(', ')
        );
        let text = cleanText(textEl);
        if (!text) {
          // 去掉用户名行后再取剩余短文案
          const raw = cleanText(node);
          text = raw
            .replace(nickname, '')
            .replace(username, '')
            .replace(/\b\d+\s*(d|h|m|w|mo|y|天|小时|分钟|周|月|年)\b/gi, '')
            .replace(/\b(Reply|回复|Like|赞)\b/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
        }
        if (!text || text.length < 2) return;
        // 纯表情/过短噪音仍留给 AI，但去掉明显 UI 残片
        if (/^(Reply|回复|View\s+\d+|查看)/i.test(text)) return;

        const key = `${username.toLowerCase()}|${text.slice(0, 60)}`;
        if (seenLocal.has(key)) return;
        seenLocal.add(key);

        out.push({
          username,
          nickname: nickname || username,
          profileUrl: href.startsWith('http') ? href.split('?')[0] : `https://www.tiktok.com${href.split('?')[0]}`,
          comment_text: text.slice(0, 500),
        });
      });
      return out;
    }, creator).catch(() => []);

    let added = 0;
    for (const c of batch || []) {
      const key = `${c.username}:${c.comment_text.slice(0, 40)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      comments.push(c);
      added += 1;
    }
    if (!added && round > 1) break;

    // 评论侧栏内滚动加载更多
    await page.evaluate(() => {
      const box = document.querySelector(
        '[data-e2e="comment-list"], [class*="DivCommentListContainer"], [class*="DivCommentMain"]'
      );
      if (box) {
        box.scrollTop = box.scrollHeight;
        return;
      }
      window.scrollBy(0, 600);
    }).catch(() => {});
    await humanPause(900, 0.2);
  }

  return comments;
}

async function runUserPipeline(accountId, payload) {
  const leadId = Number(payload.leadId || payload.lead_id || 0);
  const keyword = String(payload.keyword || payload.keywords || '').trim();
  const limits = {
    limitFollows: Number(payload.limitFollows || payload.limit_follows || 0),
    limitLikes: Number(payload.limitLikes || payload.limit_likes || 0),
    limitLook: Number(payload.limitLook || payload.limit_look || 0),
  };
  const filterPrompt = String(payload.filterPrompt || payload.filter_prompt || '');

  if (!leadId || !keyword) {
    throw new Error('AI拓客 payload 缺少 leadId 或 keyword');
  }

  let connection = null;
  const stats = { creators: 0, videos: 0, comments: 0, leads: 0, rawUsers: 0, droppedUsers: 0 };

  try {
    liveLog(
      `AI拓客 #${leadId} 按用户开始 account#${accountId} kw=${keyword} 粉丝≥${limits.limitFollows} 获赞≥${limits.limitLikes}`,
      'info',
      { accountId, leadId }
    );
    await reportProgress(leadId, { phase: 'connect', keyword, accountId, limits });

    connection = await connectAccount(accountId);
    let page = connection?.page;
    if (!page) throw new Error('无法连接浏览器');

    await reportProgress(leadId, { phase: 'search_users', keyword });
    page = await searchUsersPage(connection, keyword, accountId);

    const hasResults = await waitForUserResults(page, { timeoutMs: 22000 });
    if (!hasResults) {
      await humanPause(3000, 0.2);
    }
    await scrollLoadMore(page, { rounds: 4, pauseMs: 3500 });

    let raw = await collectRawUsersFromPage(page);
    if (!raw.length) {
      liveLog(`AI拓客 #${leadId} 首轮未解析到用户卡片，继续滚动重试`, 'warn', { leadId });
      await scrollLoadMore(page, { rounds: 5, pauseMs: 4000 });
      await delay(2000);
      raw = await collectRawUsersFromPage(page);
    }
    if (!raw.length) {
      // 再强制点一次 Users Tab
      const tab = await firstVisible(page, SELECTORS.usersTab, 4000);
      if (tab) {
        await tab.click({ force: true }).catch(() => {});
        await humanPause(3000, 0.2);
        await scrollLoadMore(page, { rounds: 4, pauseMs: 4000 });
        raw = await collectRawUsersFromPage(page);
      }
    }

    stats.rawUsers = raw.length;
    let { passed, dropped } = filterUsersByLimits(raw, limits);
    stats.droppedUsers = dropped.length;

    liveLog(
      `AI拓客 #${leadId} 搜索解析 ${raw.length} 个，粉丝筛选后 ${passed.length} 个（丢弃 ${dropped.length}）`,
      passed.length ? 'info' : 'warn',
      { leadId, accountId }
    );
    if (dropped.length && dropped.length <= 8) {
      liveLog(
        `AI拓客丢弃样例: ${dropped.slice(0, 5).map((d) => `@${d.username} ${d.reason}`).join('；')}`,
        'info',
        { leadId }
      );
    }

    if (!raw.length) {
      await dumpSearchPageHint(page);
      throw new Error(
        '搜索页未解析到任何用户卡片（可能未切到 Users、页面未加载或需验证）。浏览器将关闭，请降低风控后重试'
      );
    }
    if (!passed.length) {
      throw new Error(
        `搜索到 ${raw.length} 个用户，但无一满足粉丝≥${limits.limitFollows}`
        + (limits.limitLikes > 0 ? `（列表通常无获赞，获赞≥${limits.limitLikes} 将在主页校验）` : '')
        + '。请调低下限后重试'
      );
    }

    passed = passed.slice(0, MAX_USERS);
    await reportProgress(leadId, {
      phase: 'users_found',
      count: passed.length,
      raw: raw.length,
      dropped: dropped.length,
    }, stats);

    const savedCreators = [];
    for (const user of passed) {
      let finalUser = { ...user };

      // 列表已有粉丝+获赞时直接用；缺获赞或需复核时再进主页
      const needProfile = !user.hasLikesOnCard && (user.likesPending || (limits.limitLikes > 0 && !user.likes));
      if (needProfile || !user.followers) {
        await reportProgress(leadId, { phase: 'verify_profile', creator: user.username }, stats);
        const profile = await scrapeProfileStats(page, user.username);
        const followers = profile.followers || user.followers || 0;
        const likes = profile.likes || user.likes || 0;
        if (followers < limits.limitFollows || likes < limits.limitLikes) {
          liveLog(
            `AI拓客跳过 @${user.username}：主页粉丝=${followers} 获赞=${likes}（需≥${limits.limitFollows}/${limits.limitLikes}）`,
            'info',
            { leadId }
          );
          stats.droppedUsers += 1;
          continue;
        }
        finalUser = {
          ...user,
          followers,
          likes,
          avatar: profile.avatar || user.avatar,
          nickname: profile.nickname || user.nickname,
          likesPending: false,
          hasLikesOnCard: true,
        };
      } else if (user.followers < limits.limitFollows || user.likes < limits.limitLikes) {
        liveLog(
          `AI拓客跳过 @${user.username}：列表粉丝=${user.followers} 获赞=${user.likes}（需≥${limits.limitFollows}/${limits.limitLikes}）`,
          'info',
          { leadId }
        );
        stats.droppedUsers += 1;
        continue;
      }

      const saved = await saveCreator(leadId, accountId, finalUser).catch((e) => {
        liveLog(`保存用户失败 @${finalUser.username}: ${e.message}`, 'warn', { leadId });
        return null;
      });
      const creatorId = Number(saved?.id || saved?.data?.id || 0);
      if (!creatorId && !saved) continue;
      savedCreators.push({ ...finalUser, creatorId });
      stats.creators += 1;
      liveLog(
        `AI拓客入库用户 @${finalUser.username} 粉丝=${finalUser.followers} 获赞=${finalUser.likes}`,
        'info',
        { leadId }
      );
    }

    if (!savedCreators.length) {
      throw new Error(
        `主页校验后无用户满足粉丝≥${limits.limitFollows} 且获赞≥${limits.limitLikes}，请调低下限`
      );
    }

    for (const creator of savedCreators) {
      await reportProgress(leadId, {
        phase: 'scrape_videos',
        creator: creator.username,
      }, stats);

      const videos = await scrapeProfileVideos(page, creator.username, limits.limitLikes);
      stats.videos += videos.length;
      liveLog(`AI拓客 @${creator.username} 合格视频 ${videos.length}`, 'info', { leadId });

      for (const video of videos) {
        const vRes = await saveVideo(leadId, accountId, {
          creatorId: creator.creatorId,
          videoUrl: video.videoUrl,
          videoCover: video.videoCover,
          videoName: video.videoName,
          likes: video.likes,
        }).catch((e) => {
          liveLog(`保存视频失败: ${e.message}`, 'warn', { leadId });
          return null;
        });
        const videoId = Number(vRes?.id || vRes?.data?.id || 0);

        await reportProgress(leadId, {
          phase: 'scrape_comments',
          creator: creator.username,
          videoUrl: video.videoUrl,
        }, stats);

        const rawComments = await scrapeVideoComments(page, video.videoUrl, creator.username);
        stats.comments += rawComments.length;
        liveLog(
          `AI拓客 @${creator.username} 视频评论原始 ${rawComments.length} 条${rawComments[0] ? ` 样例=@${rawComments[0].username}:${String(rawComments[0].comment_text || '').slice(0, 40)}` : ''}`,
          rawComments.length ? 'info' : 'warn',
          { leadId }
        );
        // 下一条仍从主页点封面，避免停留在 /video/ 直链态
        await safeGoto(
          { page },
          profileUrlFromUsername(creator.username),
          {
            accountId,
            label: `评论后回主页 @${creator.username}`,
            beforeMs: 2500,
            afterMs: 4500,
          }
        ).catch(() => {});
        await humanPause(2000, 0.15);
        if (!rawComments.length) continue;

        const matched = await filterCommentsViaAi(rawComments, filterPrompt);
        liveLog(
          `AI拓客 AI筛选 ${rawComments.length}→${matched.length} 条意向`,
          matched.length ? 'info' : 'warn',
          { leadId }
        );
        if (!matched.length) continue;

        await saveMatchedComments(leadId, videoId, matched);
        stats.leads += matched.length;
        liveLog(`AI拓客 命中评论 ${matched.length} 条 video=${video.videoUrl}`, 'info', { leadId });
      }
    }

    await finishLead(leadId, true, stats);
    liveLog(
      `AI拓客 #${leadId} 完成 creators=${stats.creators} videos=${stats.videos} leads=${stats.leads}`,
      'info',
      { leadId, accountId }
    );
    return { status: 'completed', ...stats };
  } catch (error) {
    await finishLead(leadId, false, { error: error.message, ...stats });
    liveLog(`AI拓客 #${leadId} 失败: ${error.message}`, 'error', { leadId, accountId });
    throw error;
  } finally {
    if (connection) {
      await closeConnection(connection).catch(() => {});
    }
  }
}

module.exports = { runUserPipeline };
