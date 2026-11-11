/**
 * 账号主页作品同步（「最近同步视频」数据来源）
 * ---------------------------------------------------------------------------
 * 数据从 https://www.tiktok.com/@{username} 主页作品网格抓取。
 *
 * 之前的问题：
 *   1) 只抓页面当前渲染出来的链接，主页是滚动懒加载的，一屏之外的作品抓不到，
 *      甚至连「一屏展示的」都会漏（首屏渲染晚于固定 2.5s 等待时命令已经执行完）；
 *   2) 置顶位 / 推荐位会让同一作品出现多个链接，靠 href 收链接会重复；
 *   3) 只增不删，主页删掉的作品一直残留在库里。
 *
 * 现在的做法：
 *   1) 先等作品网格真正出现，再循环滚动到底（有上限），每一步收集一次；
 *   2) 用 /@用户名/video/数字ID 精确匹配本号作品，按数字 ID 去重；
 *   3) 抓取结束后把本次同步到的主页作品 ID 一起回传，PHP 侧清掉库里
 *      本次没出现的旧行（只清主页同步来源的行，不误删发布回写的行）。
 */

/** 主页作品链接选择器：只要本号 /video/ 或 /photo/，排除推荐位上别人的作品 */
function buildProfileItemSelector() {
  return 'a[href*="/video/"], a[href*="/photo/"]';
}

/**
 * 从页面收集一次作品：只收 URL 里 @用户名 属于本号、且 ID 为纯数字的。
 * @returns {Promise<Array<{videoId:string, videoUrl:string, description:string, thumbnailUrl:string}>>}
 */
async function collectProfileVideos(page, uname) {
  // handle 必须有值：一旦为空，下面的 owner 过滤会整段跳过，
  // 把推荐位/侧栏/信息流里别人的作品也收进来 —— 这就是之前抓到「主页上没有的视频」的原因。
  const want = String(uname || '').replace(/^@+/, '').trim().toLowerCase();
  if (!want) return [];

  const rows = await page.evaluate((handle) => {
    const want = String(handle || '').toLowerCase();
    if (!want) return [];
    const out = [];
    const seen = new Set();
    const anchors = document.querySelectorAll('a[href*="/video/"], a[href*="/photo/"]');
    for (const a of anchors) {
      const href = String(a.href || '');
      const idMatch = href.match(/\/(?:video|photo)\/(\d{8,})/);
      if (!idMatch) continue;
      const handleMatch = href.match(/tiktok\.com\/@([^/?#]+)/i);
      if (!handleMatch) continue;
      const owner = decodeURIComponent(handleMatch[1] || '').toLowerCase();
      // 推荐位、侧栏「猜你喜欢」里是别人的作品，必须排掉
      if (owner !== want) continue;
      // 链接里必须是 /@本号/(video|photo)/id 这种归属本号的形式
      if (!new RegExp(`/@${want.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(?:video|photo)/`, 'i').test(href)) continue;
      const videoId = idMatch[1];
      if (seen.has(videoId)) continue;
      seen.add(videoId);
      const img = a.querySelector('img');
      const text = String(
        a.getAttribute('aria-label')
        || (img && img.getAttribute('alt'))
        || a.innerText
        || ''
      ).replace(/\s+/g, ' ').trim();
      out.push({
        videoId,
        videoUrl: `https://www.tiktok.com/@${owner}/video/${videoId}`,
        description: text.slice(0, 1000),
        thumbnailUrl: (img && (img.currentSrc || img.src)) || '',
      });
    }
    return out;
  }, want).catch(() => []);

  // page.evaluate 里已经按 ID 去重；这里再兜一次，防止同一 ID 大小写/编码差异
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    const id = String(row.videoId || '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      videoId: id,
      videoUrl: String(row.videoUrl || ''),
      description: String(row.description || ''),
      thumbnailUrl: String(row.thumbnailUrl || ''),
    });
  }
  return out;
}

/** 等主页作品网格出现（首屏渲染晚于固定 sleep 会漏抓） */
async function waitForProfileGrid(page, timeoutMs = 20000) {
  const deadline = Date.now() + Math.max(3000, Number(timeoutMs) || 20000);
  while (Date.now() < deadline) {
    if (page.isClosed?.()) return false;
    const count = await page.evaluate(() => document.querySelectorAll('a[href*="/video/"]').length).catch(() => 0);
    if (count > 0) return true;
    await page.waitForTimeout(600).catch(() => {});
  }
  return false;
}

/**
 * 滚动主页加载更多作品。主页作品区是懒加载，不滚动只能拿到首屏那几条。
 * 连续若干轮没有新增就停，避免无限滚。
 */
async function scrollProfileToLoad(page, collected, uname, { maxScrolls = 25, idleRounds = 3 } = {}) {
  if (!String(uname || '').trim()) return 0;
  let idle = 0;
  const before = collected.size;
  for (let i = 0; i < maxScrolls; i += 1) {
    if (page.isClosed?.()) break;
    const prevSize = collected.size;
    await page.evaluate(() => {
      // 主页作品区滚动容器不稳定，直接滚窗口最稳
      window.scrollTo(0, document.body.scrollHeight);
    }).catch(() => {});
    await page.waitForTimeout(900).catch(() => {});
    const rows = await collectProfileVideos(page, uname);
    for (const row of rows) collected.set(row.videoId, row);
    if (collected.size === prevSize) {
      idle += 1;
      if (idle >= idleRounds) break;
      // 到底了再补一次小步滚动，触发懒加载观察器
      await page.evaluate(() => window.scrollBy(0, 600)).catch(() => {});
      await page.waitForTimeout(500).catch(() => {});
    } else {
      idle = 0;
    }
  }
  return collected.size - before;
}

async function syncVideos(accountId, limit = 100) {
  const account = await loadAccount(accountId);
  const { connectAccount, closeConnection } = require('./tiktok-actions');
  const profileUrl = `https://www.tiktok.com/@${encodeURIComponent(account.username || '')}`;
  const max = Math.min(500, Math.max(1, Number(limit) || 100));
  const connection = await connectAccount(accountId, profileUrl, 'sync');
  try {
    const page = connection.page;
    const uname = String(account.username || '').replace(/^@+/, '').trim();
    // handle 未知时不能抓：会把主页信息流里别人的作品当成自己的写进库
    if (!uname) throw new Error('账号用户名为空，无法同步主页视频');

    // 确认真的在主页上，避免在信息流/推荐页抓取
    const wantUrl = `tiktok.com/@${uname.toLowerCase()}`;
    const onProfile = await page.evaluate((u) => String(location.href || '').toLowerCase().includes(u), wantUrl).catch(() => false);
    if (!onProfile) {
      await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
      await page.waitForTimeout(1200).catch(() => {});
    }

    // 先处理验证码/风控，再等网格渲染出来
    await page.waitForTimeout(1500).catch(() => {});
    try {
      const { solveRotateCaptchaIfPresent } = require('./nocaptchaai');
      await solveRotateCaptchaIfPresent(page, { accountId });
    } catch { /* ignore */ }
    await waitForProfileGrid(page, 20000);

    // 首屏必收一次（这就是「一屏展示的」那批）
    const collected = new Map();
    for (const row of await collectProfileVideos(page, uname)) collected.set(row.videoId, row);

    // 再滚动加载，直到没有新增或达到上限
    if (collected.size < max) {
      await scrollProfileToLoad(page, collected, uname, { maxScrolls: Math.min(30, Math.ceil(max / 6) + 6) });
    }

    const deduped = [...collected.values()].slice(0, max);
    // 主页同步采用「全量替换」：PHP 收到后先清空该账号旧记录再整批写入，
    // 这样库里永远只有本次主页抓到的作品，不会残留旧行或重复行。
    await dataStore.tiktokSync(account.id, { videos: deduped, replaceProfileVideos: true });
    return { accountId: account.id, count: deduped.length, items: deduped };
  } finally {
    await closeConnection(connection).catch(() => {});
  }
}