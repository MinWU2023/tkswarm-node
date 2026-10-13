/**
 * TikTok Studio 数据拉取：总览（粉丝/获赞/视频等）+ Key metrics Last 28 days 日序列入库
 */
const { chromium } = require('playwright-core');
const { BitBrowserProvider } = require('./bit-browser-provider');
const { inspectTikTokSession } = require('./cdp-client');
const dataStore = require('../data-store');
const { isHeadless } = require('./headless');
const { publish: liveLog } = require('../live-log');

function num(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).trim().replace(/,/g, '').toUpperCase();
  const m = s.match(/^([+-]?[0-9]*\.?[0-9]+)\s*([KMB])?/);
  if (!m) return 0;
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[m[2]] || 1;
  return Math.round(Number(m[1]) * mult * 10000) / 10000;
}

function dateKey(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const y = x.getUTCFullYear();
  const m = String(x.getUTCMonth() + 1).padStart(2, '0');
  const day = String(x.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function last28DateKeys(end = new Date()) {
  const keys = [];
  const base = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()));
  for (let i = 27; i >= 0; i -= 1) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() - i);
    keys.push(dateKey(d));
  }
  return keys;
}

function emptyDay(metricDate) {
  return {
    metricDate,
    videoViews: 0,
    profileViews: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    estRewards: 0,
  };
}

/** 从接口 JSON 里尽量抽出按日序列 */
function extractSeriesFromJson(payload, out) {
  const walk = (node, depth = 0) => {
    if (!node || depth > 10) return;
    if (Array.isArray(node)) {
      // [{date, value}] / [{day, video_views}]
      if (node.length && typeof node[0] === 'object') {
        const sample = node[0];
        const dateField = ['date', 'day', 'metric_date', 'stat_date', 'time', 'timestamp', 'dt']
          .find((k) => sample && sample[k] != null);
        if (dateField) {
          for (const row of node) {
            let dk = '';
            const raw = row[dateField];
            if (typeof raw === 'number') dk = dateKey(new Date(raw > 1e12 ? raw : raw * 1000));
            else dk = dateKey(raw) || String(raw || '').slice(0, 10);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dk)) continue;
            const slot = out.days.get(dk) || emptyDay(dk);
            const pick = (...keys) => {
              for (const k of keys) {
                if (row[k] != null) return num(row[k]);
              }
              return null;
            };
            const vv = pick('video_views', 'videoViews', 'vv', 'views', 'value', 'count');
            const pv = pick('profile_views', 'profileViews', 'pv');
            const lk = pick('likes', 'like_count', 'likes_count');
            const cm = pick('comments', 'comment_count', 'comments_count');
            const sh = pick('shares', 'share_count', 'shares_count');
            const er = pick('est_rewards', 'estimated_rewards', 'rewards', 'revenue');
            // 单指标序列：用外层 metric 名区分较难，累加 value 到 videoViews 作为兜底由调用方再分
            if (vv != null) slot.videoViews = Math.max(slot.videoViews, vv);
            if (pv != null) slot.profileViews = Math.max(slot.profileViews, pv);
            if (lk != null) slot.likes = Math.max(slot.likes, lk);
            if (cm != null) slot.comments = Math.max(slot.comments, cm);
            if (sh != null) slot.shares = Math.max(slot.shares, sh);
            if (er != null) slot.estRewards = Math.max(slot.estRewards, er);
            out.days.set(dk, slot);
          }
        }
      }
      node.forEach((x) => walk(x, depth + 1));
      return;
    }
    if (typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (/series|trend|points|time_series|daily|histogram|graph/i.test(k)) walk(v, depth + 1);
        else if (typeof v === 'object') walk(v, depth + 1);
      }
    }
  };
  walk(payload);
}

async function selectLast28Days(page, log) {
  // 已是 Last 28 days
  const current = page.getByText(/^Last 28 days$/i).first();
  if (await current.isVisible().catch(() => false)) {
    // 可能是下拉按钮本身
    const nearby = page.locator('button, [role="button"], [role="combobox"]').filter({ hasText: /Last 28 days/i }).first();
    if (await nearby.count().catch(() => 0)) {
      log('analytics: already Last 28 days');
      return true;
    }
  }

  // 打开时间范围下拉
  const triggers = [
    page.getByRole('button', { name: /Last \d+ days|Last 7 days|Yesterday|Today|自定义|近/i }),
    page.locator('button, [role="button"], [role="combobox"]').filter({ hasText: /Last \d+ days|Yesterday|Today|28/i }),
  ];
  for (const t of triggers) {
    const btn = t.first();
    if (!(await btn.count().catch(() => 0)) || !(await btn.isVisible().catch(() => false))) continue;
    await btn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(600);
    const opt = page.getByRole('option', { name: /Last 28 days/i })
      .or(page.locator('[role="menuitem"], li, div, span').filter({ hasText: /^Last 28 days$/i }))
      .first();
    if (await opt.count().catch(() => 0) && await opt.isVisible().catch(() => false)) {
      await opt.click({ force: true }).catch(() => {});
      log('analytics: selected Last 28 days');
      await page.waitForTimeout(2000);
      return true;
    }
  }

  // 文案点击
  const hit = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('button, [role="button"], [role="option"], li, div, span')];
    const open = nodes.find((n) => /Last \d+ days|Yesterday|Today/i.test((n.innerText || '').trim()) && n.innerText.trim().length < 40);
    if (open) open.click();
    return !!open;
  }).catch(() => false);
  if (hit) {
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const n = [...document.querySelectorAll('button, [role="option"], li, div, span')]
        .find((el) => /^Last 28 days$/i.test((el.innerText || '').trim()));
      if (n) n.click();
    }).catch(() => {});
    await page.waitForTimeout(2000);
    log('analytics: selected Last 28 days (js)');
    return true;
  }
  log('analytics: Last 28 days control not found (may already be default)');
  return false;
}

async function scrapeOverviewDom(page) {
  return page.evaluate(() => {
    const text = (document.body?.innerText || '').replace(/\s+/g, ' ');
    const pick = (labels) => {
      for (const label of labels) {
        const re = new RegExp(`${label}\\s*([0-9][0-9,.]*\\s*[KMB]?)`, 'i');
        const m = text.match(re);
        if (m) return m[1];
        const re2 = new RegExp(`([0-9][0-9,.]*\\s*[KMB]?)\\s*${label}\\b`, 'i');
        const m2 = text.match(re2);
        if (m2) return m2[1];
      }
      return null;
    };
    const keyMetric = (label) => {
      // "Video views 0 0 (--)" 卡片
      const re = new RegExp(`${label}\\s*\\$?([0-9][0-9,.]*\\s*[KMB]?)`, 'i');
      const m = text.match(re);
      return m ? m[1] : null;
    };
    return {
      handle: (document.querySelector('h1, [class*="UserName"], [data-e2e="user-title"]')?.textContent || '').trim(),
      followers: pick(['Followers', '粉丝']),
      following: pick(['Following', '关注']),
      likesTotal: pick(['Likes', '获赞']),
      videos: pick(['Videos', '视频']),
      videoViews: keyMetric('Video views|视频播放'),
      profileViews: keyMetric('Profile views|主页浏览'),
      likesPeriod: keyMetric('Likes|点赞'),
      comments: keyMetric('Comments|评论'),
      shares: keyMetric('Shares|分享|转发'),
      estRewards: keyMetric('Est\\.?\\s*rewards|预估收益'),
      rawSnippet: text.slice(0, 1500),
    };
  }).catch(() => ({}));
}

async function scrapeKeyMetricsCards(page) {
  return page.evaluate(() => {
    const out = {};
    const cards = [...document.querySelectorAll('button, [role="tab"], div, section')];
    const map = [
      [/video\s*views/i, 'videoViews'],
      [/profile\s*views/i, 'profileViews'],
      [/^likes$/i, 'likes'],
      [/comments/i, 'comments'],
      [/shares/i, 'shares'],
      [/est\.?\s*rewards|rewards/i, 'estRewards'],
    ];
    for (const el of cards) {
      const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
      if (!t || t.length > 80) continue;
      for (const [re, key] of map) {
        if (!re.test(t.split(' ')[0] + ' ' + (t.split('\n')[0] || '')) && !re.test(t)) continue;
        // 取第一个数字
        const m = t.match(/\$?\s*([0-9][0-9,.]*)/);
        if (m && out[key] == null) out[key] = m[1];
      }
    }
    // 更稳：按行解析 Key metrics 区块
    const body = (document.body?.innerText || '').split('\n').map((x) => x.trim()).filter(Boolean);
    for (let i = 0; i < body.length; i++) {
      const line = body[i];
      const next = body[i + 1] || '';
      const pair = (label, key) => {
        if (new RegExp(`^${label}$`, 'i').test(line) && /^\$?[0-9]/.test(next) && out[key] == null) {
          out[key] = next.replace(/[^\d.]/g, '') || next;
        }
      };
      pair('Video views', 'videoViews');
      pair('Profile views', 'profileViews');
      pair('Likes', 'likes');
      pair('Comments', 'comments');
      pair('Shares', 'shares');
      pair('Est. rewards', 'estRewards');
    }
    return out;
  }).catch(() => ({}));
}

/**
 * 拉取 Studio 数据并入库（先删该账号原 28 天日数据再写入）
 */
async function pullStudioStats(accountId, options = {}) {
  const account = await dataStore.getAccountBundle(accountId);
  if (!account) throw new Error('账号不存在');
  if (!account.browser_profile_id) throw new Error('账号尚未绑定浏览器环境');

  const log = (msg) => liveLog(`PullStats#${accountId}: ${msg}`, 'info', { accountId });
  const provider = new BitBrowserProvider();
  let browser;
  const apiHits = [];
  const daysMap = new Map();

  try {
    const opened = await provider.open(account.browser_profile_id, { headless: isHeadless('sync') });
    if (!opened?.ws) throw new Error('比特浏览器未返回 CDP 地址');
    browser = await chromium.connectOverCDP(opened.ws, { timeout: 30000 });
    const context = browser.contexts()[0] || await browser.newContext();
    let page = context.pages().find((p) => /tiktok\.com/i.test(p.url() || ''))
      || context.pages()[0]
      || await context.newPage();
    await page.bringToFront().catch(() => {});

    page.on('response', async (res) => {
      try {
        const url = res.url();
        if (!/insight|analytics|metric|statistic|creator\/|tiktokstudio\/api|data\/overview|key.?metric/i.test(url)) return;
        if (!/json|javascript|text/i.test(res.headers()['content-type'] || 'json')) return;
        const json = await res.json().catch(() => null);
        if (json) {
          apiHits.push(url);
          extractSeriesFromJson(json, { days: daysMap });
        }
      } catch { /* ignore */ }
    });

    const session = await inspectTikTokSession(opened.ws, page).catch(() => null);
    if (session && session.loggedIn === false) {
      throw new Error('当前浏览器没有有效 TikTok 登录状态，请先登录');
    }

    const urls = [
      options.analyticsUrl || 'https://www.tiktok.com/tiktokstudio/analytics?lang=en',
      'https://www.tiktok.com/tiktokstudio?lang=en',
    ];
    for (const url of urls) {
      log(`goto ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(3500);
      if (/tiktokstudio/i.test(page.url() || '')) break;
    }

    await selectLast28Days(page, log);
    await page.waitForTimeout(2500);

    const overview = await scrapeOverviewDom(page);
    const cards = await scrapeKeyMetricsCards(page);
    log(`overview followers=${overview.followers} likes=${overview.likesTotal} videos=${overview.videos}`);
    log(`cards views=${cards.videoViews} comments=${cards.comments} shares=${cards.shares} apiHits=${apiHits.length} dayPts=${daysMap.size}`);

    // 补全 28 天骨架；有序列则填入
    const keys = last28DateKeys();
    const daily = keys.map((dk) => {
      const hit = daysMap.get(dk);
      if (hit) return { ...emptyDay(dk), ...hit, metricDate: dk };
      return emptyDay(dk);
    });

    // 若无日序列，把周期总量记在最后一天（并保持其余为 0），避免丢数
    const period = {
      videoViews: num(cards.videoViews ?? overview.videoViews),
      profileViews: num(cards.profileViews ?? overview.profileViews),
      likes: num(cards.likes ?? overview.likesPeriod),
      comments: num(cards.comments ?? overview.comments),
      shares: num(cards.shares ?? overview.shares),
      estRewards: num(cards.estRewards ?? overview.estRewards),
    };
    const hasSeries = [...daysMap.values()].some((d) => d.videoViews || d.likes || d.comments || d.shares || d.profileViews);
    if (!hasSeries) {
      const last = daily[daily.length - 1];
      Object.assign(last, period, { metricDate: last.metricDate });
      log('analytics: no daily series from API — stored period totals on last day');
    }

    const profile = {
      handle: overview.handle || account.username || '',
      displayName: account.nickname || '',
      followers: num(overview.followers),
      following: num(overview.following),
      likes: num(overview.likesTotal),
      videos: num(overview.videos),
      comments: period.comments,
      shares: period.shares,
      periodVideoViews: period.videoViews,
      periodProfileViews: period.profileViews,
      periodLikes: period.likes,
      periodComments: period.comments,
      periodShares: period.shares,
      periodEstRewards: period.estRewards,
    };

    await dataStore.tiktokAnalyticsSync(account.id, {
      profile,
      period,
      daily,
      rangeDays: 28,
    });

    log(`saved profile + ${daily.length} daily rows`);
    return {
      status: 'ok',
      accountId: Number(account.id),
      profile,
      period,
      dailyCount: daily.length,
      hasSeries,
      message: 'Studio 数据已拉取入库（已替换原 28 天数据）',
    };
  } finally {
    try {
      if (browser) await browser.close().catch(() => {});
    } catch { /* ignore */ }
  }
}

module.exports = { pullStudioStats, last28DateKeys };
