/**
 * 回复评论（TikTok Studio）：
 * 1. 打开比特 → 进入 TikTok Studio
 * 2. 侧栏 / URL 进入 Comments
 * 3. 筛选「Not replied / 未回复」
 * 4. 逐条：固定文案 或 AI 提示词模板 + /node/comment-reply/ai 生成后回复
 */
const phpApi = require('../php-api');
const { connectAccount, closeConnection } = require('./tiktok-actions');
const { inspectTikTokSession } = require('./cdp-client');
const { capture } = require('../automation-guard');
const { publish: liveLog } = require('../live-log');
const { clickByTextDeep, dismissOverlays } = require('./tiktok-profile');

const STUDIO_COMMENT_URLS = [
  'https://www.tiktok.com/tiktokstudio/comment?lang=en',
  'https://www.tiktok.com/tiktokstudio/comments?lang=en',
  'https://www.tiktok.com/tiktokstudio/comment',
  'https://www.tiktok.com/tiktokstudio/comments',
];

function log(accountId, msg, level = 'info') {
  liveLog(`CommentReply#${accountId}: ${msg}`, level, { accountId });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function humanPause(ms, jitter = 0.2) {
  const j = Math.max(0, Number(jitter) || 0);
  const delta = ms * j * (Math.random() * 2 - 1);
  await sleep(Math.max(80, Math.round(ms + delta)));
}

async function clickPattern(page, pattern, timeoutMs = 6000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const hit = await clickByTextDeep(page, pattern);
    if (hit) return hit;
    await sleep(350);
  }
  return '';
}

function pickReplyConfig(payload = {}) {
  const mode = String(payload.replyMode || payload.commentMode || 'fixed').toLowerCase() === 'ai' ? 'ai' : 'fixed';
  let texts = [];
  if (Array.isArray(payload.replyTexts)) {
    texts = payload.replyTexts.map((t) => String(t || '').trim()).filter(Boolean);
  }
  if (!texts.length && Array.isArray(payload.commentTexts)) {
    texts = payload.commentTexts.map((t) => String(t || '').trim()).filter(Boolean);
  }
  if (!texts.length && payload.replyText) {
    texts = [String(payload.replyText).trim()].filter(Boolean);
  }
  if (!texts.length) {
    texts = ['Thanks for your comment!'];
  }
  return {
    replyMode: mode,
    replyTexts: texts,
    replyText: texts[0],
    replyAiTemplateId: Number(payload.replyAiTemplateId || payload.commentAiTemplateId || 0) || 0,
    replyAiPrompt: String(payload.replyAiPrompt || payload.commentAiPrompt || '').trim(),
    replyTemplateIds: Array.isArray(payload.replyTemplateIds)
      ? payload.replyTemplateIds.map(Number).filter(Boolean)
      : [],
    maxReplies: Math.max(1, Math.min(50, Number(payload.maxReplies || payload.max_replies || 10))),
  };
}

async function resolveReplyText(cfg, variables = {}) {
  if (cfg.replyMode !== 'ai') {
    const pool = cfg.replyTexts || [];
    if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
    return cfg.replyText || 'Thanks for your comment!';
  }
  const payload = {
    prompt: cfg.replyAiPrompt || '',
    templateId: cfg.replyAiTemplateId || 0,
    variables,
  };
  for (let i = 1; i <= 2; i++) {
    try {
      const data = await phpApi.post('/node/comment-reply/ai', payload);
      const reply = String(data?.reply || data?.comment || '').trim();
      if (reply) return reply;
    } catch (e) {
      if (i === 2) throw e;
    }
    await humanPause(1000, 0.15);
  }
  return '';
}

function isStudioUrl(url) {
  return /tiktok\.com\/tiktokstudio/i.test(String(url || ''));
}

function isStudioCommentsUrl(url) {
  return /tiktokstudio\/comments?/i.test(String(url || ''));
}

async function pageLooksLikeStudioComments(page) {
  if (isStudioCommentsUrl(page.url())) return true;
  if (!isStudioUrl(page.url())) return false;
  return page.evaluate(() => {
    const t = (document.body?.innerText || '').slice(0, 12000);
    // Studio Comments 页常见：筛选 Not replied / Replied，以及 Reply 操作
    const hasFilter = /Not replied|未回复|Not Replied|Replied|已回复/i.test(t);
    const hasNav = /\bComments\b|评论管理|评论/.test(t);
    const hasListHint = /Reply|回复|Posted by|评论者|Follower/i.test(t);
    return (hasFilter && hasNav) || (hasFilter && hasListHint);
  }).catch(() => false);
}

/** 进入 TikTok Studio（优先直达，失败再走菜单） */
async function enterStudio(page, accountId) {
  if (isStudioUrl(page.url())) return true;
  await page.goto('https://www.tiktok.com/tiktokstudio?lang=en', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  }).catch(() => {});
  await humanPause(2200, 0.15);
  await dismissOverlays(page).catch(() => {});
  if (isStudioUrl(page.url())) return true;

  // 兜底：个人主页 ≡ → TikTok Studio
  try {
    const { goToPersonalCenter } = require('./tiktok-profile');
    await goToPersonalCenter(page).catch(() => {});
    await humanPause(1200, 0.1);
    const more = page.locator('[data-e2e="more-menu-icon"], button[aria-label*="More" i]').first();
    if (await more.count().catch(() => 0)) {
      await more.click({ timeout: 3000 }).catch(() => {});
      await humanPause(800, 0.1);
    }
    await clickPattern(page, '^TikTok Studio$|^创作者中心$|Creator Center|TikTok\\s*Studio', 5000);
    await humanPause(2200, 0.15);
  } catch (e) {
    log(accountId, `菜单进 Studio 失败: ${e.message || e}`, 'warn');
  }
  return isStudioUrl(page.url());
}

/** Studio → Comments */
async function openStudioComments(page, accountId) {
  if (await pageLooksLikeStudioComments(page)) return true;

  for (const url of STUDIO_COMMENT_URLS) {
    log(accountId, `打开 Studio Comments ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await humanPause(2200, 0.15);
    await dismissOverlays(page).catch(() => {});
    for (let i = 0; i < 12; i++) {
      if (await pageLooksLikeStudioComments(page)) return true;
      await humanPause(450, 0.1);
    }
  }

  // 侧栏点 Comments
  log(accountId, 'URL 未直达，尝试侧栏 Comments');
  if (!isStudioUrl(page.url())) {
    await enterStudio(page, accountId);
  }
  const hit = await clickPattern(
    page,
    '^Comments$|^评论$|^评论管理$|Comment management',
    8000
  );
  if (hit) {
    await humanPause(2200, 0.15);
    if (await pageLooksLikeStudioComments(page)) return true;
  }
  return pageLooksLikeStudioComments(page);
}

/**
 * Studio 顶部筛选是下拉：「All comments」→ 打开后选「Not replied」
 */
async function filterNotReplied(page, accountId) {
  const filterLabel = await page.evaluate(() => {
    const visible = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return r.width > 20 && r.height > 12 && st.visibility !== 'hidden' && st.display !== 'none';
    };
    const nodes = [...document.querySelectorAll('button, div[role="button"], [class*="Select" i], span, div')];
    for (const el of nodes) {
      if (!visible(el)) continue;
      const t = String(el.textContent || '').replace(/\s+/g, ' ').trim();
      if (/^(Not replied|未回复)$/i.test(t)) return 'already:' + t;
      if (/^(All comments|全部评论)$/i.test(t)) return 'open:' + t;
      if (/^All comments|^全部评论/i.test(t) && t.length < 40) return 'open:' + t;
    }
    return '';
  }).catch(() => '');

  if (String(filterLabel).startsWith('already:')) {
    log(accountId, '已在「未回复」筛选');
    return true;
  }

  // 点开 All comments 下拉
  let opened = false;
  try {
    const allBtn = page.getByText(/^(All comments|全部评论)$/i).first();
    if (await allBtn.count() && await allBtn.isVisible().catch(() => false)) {
      await allBtn.click({ timeout: 4000 });
      opened = true;
    }
  } catch { /* fall through */ }
  if (!opened) {
    opened = !!(await clickPattern(page, '^All comments$|^全部评论$', 4000));
  }
  await humanPause(500, 0.1);

  // 菜单项：Not replied / 未回复
  let hit = '';
  try {
    const opt = page.getByRole('option', { name: /^(Not replied|未回复|Not Replied)$/i }).first();
    if (await opt.count() && await opt.isVisible().catch(() => false)) {
      await opt.click({ timeout: 3000 });
      hit = 'option';
    }
  } catch { /* ignore */ }
  if (!hit) {
    try {
      const item = page.getByText(/^(Not replied|未回复|Not Replied)$/i).first();
      if (await item.count() && await item.isVisible().catch(() => false)) {
        await item.click({ timeout: 3000 });
        hit = 'text';
      }
    } catch { /* ignore */ }
  }
  if (!hit) {
    hit = await page.evaluate(() => {
      const visible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const st = getComputedStyle(el);
        return r.width > 4 && r.height > 4 && st.visibility !== 'hidden' && st.display !== 'none';
      };
      for (const el of document.querySelectorAll('li, [role="option"], [role="menuitem"], button, div, span')) {
        if (!visible(el)) continue;
        const t = String(el.textContent || '').replace(/\s+/g, ' ').trim();
        if (/^(Not replied|未回复|Not Replied)$/i.test(t)) {
          el.click();
          return t;
        }
      }
      return '';
    }).catch(() => '');
  }

  await humanPause(1600, 0.15);
  if (hit) {
    log(accountId, `已筛选未回复 (${hit})`);
    return true;
  }
  log(accountId, '未点到「Not replied」，改为处理当前列表里带 Reply 的评论', 'warn');
  // 关掉可能打开的下拉
  await page.keyboard.press('Escape').catch(() => {});
  return false;
}

/**
 * 标记「一级且未回复」的评论卡片。
 * - 跳过嵌套回复（含 ▸ / Reply to / 明显缩进）
 * - 跳过已有回复的一级评论（View N replies）
 * - 只点一级卡片上的 Reply，避免套娃
 */
async function markUnrepliedRows(page, limit = 20) {
  return page.evaluate((max) => {
    document.querySelectorAll('[data-tk-cr-row]').forEach((n) => n.removeAttribute('data-tk-cr-row'));
    const visible = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return r.width > 4 && r.height > 4 && st.visibility !== 'hidden' && st.display !== 'none'
        && Number(st.opacity || 1) > 0.1;
    };
    const textOf = (el) => String(el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();

    /** 是否为二级及以下回复行 */
    const isNestedReplyRow = (row) => {
      const t = textOf(row);
      // Studio 嵌套：A Creator ▸ B
      if (/▸|►|›/.test(t)) return true;
      if (/Reply to\s|回复\s*@|回复了/i.test(t)) return true;
      const cls = `${row.className || ''} ${row.getAttribute('data-e2e') || ''}`.toLowerCase();
      if (/reply-item|comment-reply|sub-comment|nested|level-2|level2/.test(cls)) return true;
      return false;
    };

    /** 在节点及邻近兄弟/父级中找「已有回复」信号 */
    const hasReplySignalIn = (el) => {
      if (!el) return false;
      const t = textOf(el);
      if (/View\s+\d+\s+replies?/i.test(t)) return true;
      if (/Hide\s+\d+\s+replies?/i.test(t)) return true;
      if (/查看\s*\d+\s*条回复|收起\s*\d+\s*条回复|已有\s*\d+\s*条回复|\d+\s*条回复/i.test(t)) return true;
      if (/▸|►/.test(t) && /Creator|创作者/i.test(t)) return true;
      return false;
    };

    /**
     * 一级评论是否已被创作者回复过：
     * View N replies / 展开的嵌套 ▸ / 卡片下方邻近区域的回复入口
     */
    const alreadyHasReplies = (row) => {
      if (hasReplySignalIn(row)) return true;
      // 卡片内嵌套回复块
      if ([...row.querySelectorAll('*')].some((n) => {
        if (!visible(n) || n === row) return false;
        const s = textOf(n);
        if (s.length > 200) return false;
        return /▸|►/.test(s);
      })) return true;

      // 「View 2 replies」常在卡片外下一层兄弟节点
      const rowBox = row.getBoundingClientRect();
      const near = [];
      let p = row.parentElement;
      for (let depth = 0; p && depth < 3; depth++) {
        near.push(p);
        [...p.children].forEach((c) => near.push(c));
        p = p.parentElement;
      }
      for (const el of near) {
        if (!el || el === row || !visible(el)) continue;
        if (row.contains(el)) continue;
        const b = el.getBoundingClientRect();
        // 仅看紧挨在下方、同一列附近的节点
        if (b.top < rowBox.bottom - 8) continue;
        if (b.top > rowBox.bottom + 140) continue;
        if (Math.abs(b.left - rowBox.left) > 80) continue;
        if (hasReplySignalIn(el)) return true;
        const st = textOf(el);
        if (/▸|►/.test(st) && st.length < 180) return true;
      }

      // 同一卡片内出现 2 个以上 Reply 操作，说明已展开子回复
      const replyBtns = [...row.querySelectorAll('button, a, span, div, p')].filter((el) => {
        if (!visible(el)) return false;
        return /^(Reply|回复)$/i.test(textOf(el));
      });
      if (replyBtns.length >= 2) return true;

      return false;
    };

    const replyNodes = [...document.querySelectorAll('button, a, span, div, p')]
      .filter(visible)
      .filter((el) => {
        if (el.getAttribute('data-tk-cr-done') === '1') return false;
        if (el.closest('[data-tk-cr-done="1"]')) return false;
        const t = textOf(el);
        if (!/^(Reply|回复)$/i.test(t)) return false;
        const childHas = [...el.querySelectorAll('button, a, span, div')].some((c) => /^(Reply|回复)$/i.test(textOf(c)));
        return !childHas;
      });

    // 先收集候选行，再按 left 找「最左一档」作为一级评论基准
    const candidates = [];
    for (const btn of replyNodes) {
      let row = btn;
      for (let i = 0; i < 10 && row; i++) {
        row = row.parentElement;
        if (!row || !visible(row)) continue;
        const t = textOf(row);
        const hasReply = /\bReply\b|回复/.test(t);
        const hasDelete = /\bDelete\b|删除/.test(t);
        const r = row.getBoundingClientRect();
        if (hasReply && hasDelete && r.height >= 60 && r.height <= 600 && r.width >= 200) {
          break;
        }
        if (i === 9) row = btn.parentElement;
      }
      if (!row || candidates.includes(row)) continue;
      if (row.closest('nav, aside')) continue;
      if (row.getAttribute('data-tk-cr-done') === '1') continue;
      candidates.push(row);
    }

    if (!candidates.length) return 0;

    const minLeft = Math.min(...candidates.map((r) => r.getBoundingClientRect().left));
    const rows = [];
    let skippedNested = 0;
    let skippedReplied = 0;
    for (const row of candidates) {
      const left = row.getBoundingClientRect().left;
      // 比最左一级明显更靠右 → 嵌套
      if (left - minLeft > 28 || isNestedReplyRow(row)) {
        skippedNested += 1;
        continue;
      }
      if (alreadyHasReplies(row)) {
        skippedReplied += 1;
        continue;
      }
      rows.push(row);
      if (rows.length >= max) break;
    }

    rows.forEach((row, i) => row.setAttribute('data-tk-cr-row', String(i)));
    return { count: rows.length, skippedNested, skippedReplied };
  }, limit).catch(() => ({ count: 0, skippedNested: 0, skippedReplied: 0 }));
}

async function readRowMeta(page, index) {
  return page.evaluate((idx) => {
    const row = document.querySelector(`[data-tk-cr-row="${idx}"]`);
    if (!row) return { comment_text: '', author: '', video_desc: '' };
    const textOf = (el) => String(el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();

    // 用户名：优先链接
    let author = '';
    const authorEl = row.querySelector('a[href*="/@"]');
    if (authorEl) author = textOf(authorEl).replace(/^@/, '');

    // 评论文案：去掉用户名、Creator、时间、操作、视频 id
    let raw = textOf(row);
    raw = raw
      .replace(/\bCreator\b/gi, ' ')
      .replace(/\b\d+\s*[smhd]\s*ago\b/gi, ' ')
      .replace(/\b\d+\s*(秒|分钟|小时|天)前\b/gi, ' ')
      .replace(/\b(Reply|回复|Delete|删除|Like|赞|Hide|隐藏|Translate|翻译)\b/gi, ' ')
      .replace(/\bm-\d+-\d+\b/gi, ' ')
      .replace(/\b\d+\b/g, ' ') // 点赞数等
      .replace(/\s+/g, ' ')
      .trim();
    if (author) {
      raw = raw.replace(new RegExp(`^@?${author.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i'), '').trim();
    }
    // 若仍太长，取中间较短段落
    if (raw.length > 180) raw = raw.slice(0, 180);

    return {
      comment_text: raw.slice(0, 400),
      author: author.slice(0, 80),
      video_desc: '',
    };
  }, index).catch(() => ({ comment_text: '', author: '', video_desc: '' }));
}

async function openReplyOnRow(page, index) {
  // 只点一级卡片自身操作栏的 Reply，跳过嵌套子回复上的 Reply
  const clicked = await page.evaluate((idx) => {
    const row = document.querySelector(`[data-tk-cr-row="${idx}"]`);
    if (!row) return '';
    const textOf = (el) => String(el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return r.width > 4 && r.height > 4 && st.visibility !== 'hidden' && st.display !== 'none';
    };
    const inNested = (el) => {
      let n = el;
      while (n && n !== row) {
        const t = textOf(n);
        if (/▸|►|→/.test(t) && t.length < 160) return true;
        const cls = `${n.className || ''}`.toLowerCase();
        if (/reply-item|sub-comment|nested|level-2/.test(cls)) return true;
        // 缩进明显大于一级卡片
        if (n.getBoundingClientRect().left - row.getBoundingClientRect().left > 36) return true;
        n = n.parentElement;
      }
      return false;
    };

    const nodes = [...row.querySelectorAll('button, a, span, div, p')].filter(visible);
    // 取最靠上的一级 Reply（通常是主评论操作栏）
    const replies = nodes.filter((el) => {
      if (!/^(Reply|回复)$/i.test(textOf(el))) return false;
      if (inNested(el)) return false;
      return true;
    });
    replies.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    const target = replies[0];
    if (!target) return '';
    target.scrollIntoView({ block: 'center', inline: 'nearest' });
    target.click();
    return 'reply';
  }, index).catch(() => '');

  if (clicked) {
    await humanPause(700, 0.15);
    return true;
  }

  try {
    const row = page.locator(`[data-tk-cr-row="${index}"]`).first();
    // 用 first()：只点卡片内第一个 Reply（一级）
    const reply = row.getByText(/^(Reply|回复)$/i).first();
    if (await reply.count()) {
      await reply.click({ timeout: 4000 });
      await humanPause(700, 0.15);
      return true;
    }
  } catch { /* ignore */ }

  return false;
}

async function findReplyInput(page) {
  // Studio 点 Reply 后出现：placeholder = "Reply to comment"
  const sels = [
    '[placeholder="Reply to comment"]',
    '[placeholder*="Reply to comment" i]',
    '[placeholder*="回复评论" i]',
    '[placeholder*="回复" i]',
    '[data-e2e="comment-input"] [contenteditable="true"]',
    '[data-e2e="comment-input"]',
    'textarea[placeholder*="Reply" i]',
    'div[contenteditable="true"][placeholder*="Reply" i]',
    'div[contenteditable="true"][data-placeholder*="Reply" i]',
  ];
  for (const sel of sels) {
    const el = page.locator(sel).last();
    try {
      if (!(await el.count()) || !(await el.isVisible().catch(() => false))) continue;
      const box = await el.boundingBox().catch(() => null);
      if (box && box.width >= 60 && box.height >= 14) return el;
      if (!box) return el;
    } catch { /* next */ }
  }
  // 兜底：当前焦点已是输入框
  const focused = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    return tag === 'textarea' || tag === 'input' || el.isContentEditable;
  }).catch(() => false);
  if (focused) return page.locator(':focus').first();
  return null;
}

async function fillReplyInput(page, text) {
  const value = String(text || '');
  if (!value) return false;
  let el = await findReplyInput(page);
  if (!el) {
    await humanPause(800, 0.1);
    el = await findReplyInput(page);
  }
  if (!el) return false;
  await el.scrollIntoViewIfNeeded().catch(() => {});
  await el.click({ timeout: 3000 }).catch(() => {});
  await humanPause(250, 0.1);
  await page.keyboard.press('Control+A').catch(() => {});
  const inserted = await page.evaluate((v) => {
    const active = document.activeElement;
    if (!active) return false;
    if (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT') {
      const proto = active.tagName === 'TEXTAREA'
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) setter.call(active, v);
      else active.value = v;
      active.dispatchEvent(new Event('input', { bubbles: true }));
      active.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    if (active.getAttribute('contenteditable') === 'true' || active.isContentEditable) {
      try {
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, v);
      } catch {
        active.textContent = v;
      }
      active.dispatchEvent(new InputEvent('input', { bubbles: true, data: v, inputType: 'insertText' }));
      return true;
    }
    return false;
  }, value).catch(() => false);

  if (!inserted) {
    await page.keyboard.type(value, { delay: randInt(18, 40) });
  }
  return true;
}

async function clickReplySend(page) {
  const sels = [
    '[data-e2e="comment-post"]',
    'button[data-e2e="comment-post"]',
    '[data-e2e="comment-post-button"]',
    'button[aria-label*="Post" i]',
    'button[aria-label*="Send" i]',
    'button[aria-label*="发布"]',
    'button[aria-label*="发送"]',
  ];
  for (const sel of sels) {
    const el = page.locator(sel).last();
    try {
      if ((await el.count()) && (await el.isVisible().catch(() => false))) {
        await el.click({ timeout: 2000 });
        return true;
      }
    } catch { /* next */ }
  }
  // Studio 常见：输入后按 Enter 发送
  await page.keyboard.press('Enter').catch(() => {});
  await humanPause(600, 0.1);
  // 若输入框已清空，视为发送成功
  const cleared = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return true;
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      return !String(el.value || '').trim();
    }
    if (el.isContentEditable) return !String(el.textContent || '').trim();
    return false;
  }).catch(() => false);
  if (cleared) return true;

  const byText = await clickPattern(page, '^Post$|^Publish$|^Send$|^发送$|^发布$', 2000);
  return !!byText;
}

async function markRowDone(page, index) {
  await page.evaluate((idx) => {
    const row = document.querySelector(`[data-tk-cr-row="${idx}"]`);
    if (row) {
      row.setAttribute('data-tk-cr-done', '1');
      row.removeAttribute('data-tk-cr-row');
    }
  }, index).catch(() => {});
}

async function replyOneRow(page, accountId, cfg, index, stats) {
  const meta = await readRowMeta(page, index);
  let commentText = String(meta.comment_text || '').trim();
  // 再点 Reply 前先留住文案；点开后 DOM 可能变
  if (!commentText) {
    log(accountId, `第 ${index + 1} 条评论文案为空，跳过`, 'warn');
    await markRowDone(page, index);
    return false;
  }
  log(accountId, `准备回复 @${meta.author || '?'}：「${commentText.slice(0, 80)}」`);

  const opened = await openReplyOnRow(page, index);
  if (!opened) {
    log(accountId, `第 ${index + 1} 条无法点击 Reply`, 'warn');
    return false;
  }

  // 等「Reply to comment」输入框出现
  let inputReady = false;
  for (let i = 0; i < 12; i++) {
    if (await findReplyInput(page)) {
      inputReady = true;
      break;
    }
    await humanPause(350, 0.1);
  }
  if (!inputReady) {
    log(accountId, '点击 Reply 后未出现「Reply to comment」输入框', 'warn');
    return false;
  }

  let body = '';
  try {
    if (cfg.replyMode === 'ai') {
      log(accountId, '调用 AI 接口生成回复…');
    }
    body = await resolveReplyText(cfg, {
      comment_text: commentText,
      video_desc: meta.video_desc || '',
      author: meta.author || '',
      nickname: meta.author || '',
      video_url: '',
      video_id: '',
    });
  } catch (e) {
    log(accountId, `生成回复失败: ${e.message || e}`, 'warn');
    await page.keyboard.press('Escape').catch(() => {});
    return false;
  }
  if (!body) {
    log(accountId, '回复文案为空，跳过', 'warn');
    await page.keyboard.press('Escape').catch(() => {});
    return false;
  }
  log(accountId, `回复文案: ${body.slice(0, 80)}`);

  const filled = await fillReplyInput(page, body);
  if (!filled) {
    log(accountId, '未找到 Studio 回复输入框', 'warn');
    return false;
  }
  await humanPause(400, 0.1);
  const sent = await clickReplySend(page);
  if (!sent) {
    log(accountId, '发送失败（按钮/Enter）', 'warn');
    return false;
  }
  await humanPause(1400, 0.2);
  await markRowDone(page, index);
  stats.replied += 1;
  stats.lastReply = body;
  log(accountId, `已回复成功: ${body.slice(0, 60)}`);
  return true;
}

/**
 * @param {number} accountId
 * @param {object} payload
 */
async function runCommentReply(accountId, payload = {}, options = {}) {
  const cfg = pickReplyConfig(payload);
  const keepOpen = !!options.keepOpen;
  const stats = {
    replied: 0,
    scanned: 0,
    maxReplies: cfg.maxReplies,
    replyMode: cfg.replyMode,
    lastReply: '',
    screenshot: '',
    via: 'studio-comments',
  };

  let connection = options.connection || null;
  let owned = false;
  try {
    if (!connection) {
      log(accountId, `打开比特 → Studio Comments · 最多 ${cfg.maxReplies} 条 · 模式 ${cfg.replyMode}`);
      connection = await connectAccount(accountId, null, 'warm');
      owned = true;
      await humanPause(1000, 0.15);
    }
    const page = connection.page;
    const session = await inspectTikTokSession(connection.ws, page).catch(() => null);
    if (session && session.loggedIn === false) {
      stats.screenshot = await capture(page, `comment-reply-nologin-${accountId}`).catch(() => '');
      throw new Error('当前浏览器没有有效 TikTok 登录状态，请先登录后再回复评论');
    }

    const inStudio = await enterStudio(page, accountId);
    if (!inStudio) {
      stats.screenshot = await capture(page, `comment-reply-nostudio-${accountId}`).catch(() => '');
      throw new Error('未能进入 TikTok Studio');
    }

    const opened = await openStudioComments(page, accountId);
    if (!opened) {
      stats.screenshot = await capture(page, `comment-reply-nocomments-${accountId}`).catch(() => '');
      throw new Error('未能打开 TikTok Studio Comments 页');
    }
    log(accountId, `已在 Studio Comments url=${page.url()}`);

    await filterNotReplied(page, accountId);
    await humanPause(1000, 0.15);

    // 诊断：页面上可见的 Reply 文字链数量
    const replyLinkCount = await page.evaluate(() => {
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        const st = getComputedStyle(el);
        return r.width > 4 && r.height > 4 && st.visibility !== 'hidden' && st.display !== 'none';
      };
      return [...document.querySelectorAll('button, a, span, div, p')]
        .filter(visible)
        .filter((el) => /^(Reply|回复)$/i.test(String(el.textContent || '').replace(/\s+/g, ' ').trim()))
        .length;
    }).catch(() => 0);
    log(accountId, `页面可见 Reply 链接约 ${replyLinkCount} 个`);

    // 多轮：每回复一条后重新标记（列表会变化）
    let idleRounds = 0;
    while (stats.replied < cfg.maxReplies && idleRounds < 4) {
      const marked = await markUnrepliedRows(page, Math.min(20, cfg.maxReplies - stats.replied + 2));
      const count = typeof marked === 'number' ? marked : Number(marked?.count || 0);
      const skippedReplied = typeof marked === 'object' ? Number(marked.skippedReplied || 0) : 0;
      const skippedNested = typeof marked === 'object' ? Number(marked.skippedNested || 0) : 0;
      stats.scanned += count;
      if (skippedReplied || skippedNested) {
        log(accountId, `跳过：已回复 ${skippedReplied} · 嵌套 ${skippedNested} · 待回一级 ${count}`);
      }
      if (!count) {
        await page.mouse.wheel(0, randInt(500, 900)).catch(() => {});
        await humanPause(900, 0.15);
        const moreMarked = await markUnrepliedRows(page, Math.min(20, cfg.maxReplies - stats.replied + 2));
        const more = typeof moreMarked === 'number' ? moreMarked : Number(moreMarked?.count || 0);
        if (!more) {
          idleRounds += 1;
          log(accountId, `未找到可回复的一级评论 (idle=${idleRounds})`);
          continue;
        }
      }
      idleRounds = 0;

      const before = stats.replied;
      const ok = await replyOneRow(page, accountId, cfg, 0, stats);
      if (!ok) {
        const alt = await replyOneRow(page, accountId, cfg, 1, stats);
        if (!alt) {
          idleRounds += 1;
          // 标记失败行，避免死循环
          await markRowDone(page, 0);
          await page.mouse.wheel(0, 600).catch(() => {});
          await humanPause(800, 0.15);
        }
      }
      if (stats.replied === before && ok === false) {
        await page.evaluate(() => {
          document.querySelectorAll('[data-tk-cr-row]').forEach((n) => n.removeAttribute('data-tk-cr-row'));
        }).catch(() => {});
      }
      await humanPause(randInt(1000, 2000), 0.2);
    }

    if (!stats.replied) {
      stats.screenshot = await capture(page, `comment-reply-empty-${accountId}`).catch(() => '');
      log(accountId, 'Studio 未回复列表中未成功回复任何评论', 'warn');
    } else {
      log(accountId, `完成 replied=${stats.replied} scanned≈${stats.scanned}`);
    }

    return { status: 'ok', ...stats };
  } finally {
    if (owned && connection && !keepOpen) {
      await closeConnection(connection);
    }
  }
}

module.exports = {
  runCommentReply,
  pickReplyConfig,
  resolveReplyText,
};
