/**
 * 前台执行器 HTTP：接单后驱动比特跑总任务；支持手动测试总任务/分任务。
 */
const express = require('express');
const { ok, fail } = require('../http');
const {
  acceptAndRunBatch,
  getExecutorStats,
  resolveMaxConcurrent,
  tick,
  testRunBatch,
  testRunItem,
  offerSpecificBatch,
  runClaimedBatchDirect,
} = require('../services/task-runner');
const executorHub = require('../services/executor-hub');
const serverBrowserQueue = require('../services/server-browser-queue');
const { publish: liveLog } = require('../services/live-log');

const router = express.Router();

function withAuthContext(req, fn) {
  const phpApi = require('../services/php-api');
  const authReq = {
    headers: {
      authorization: String(req.headers.authorization || ''),
      'x-acting-as': String(req.headers['x-acting-as'] || ''),
    },
  };
  // Must return the Promise from fn so AsyncLocalStorage spans awaits.
  return phpApi.runWithRequest(authReq, fn);
}

function startInAuth(req, label, work) {
  setImmediate(() => {
    Promise.resolve()
      .then(() => withAuthContext(req, () => work()))
      .catch((err) => {
        const msg = err?.message || String(err);
        console.error(`[executor/${label}]`, msg);
        liveLog(`${label} 失败：${msg}`, 'error', {});
      });
  });
}

router.get('/status', async (req, res) => {
  try {
    await withAuthContext(req, () => resolveMaxConcurrent());
  } catch { /* use cache/default */ }
  return ok(res, {
    ...getExecutorStats(),
    hubOnline: executorHub.countEnabled(),
    serverBrowserQueue: serverBrowserQueue.stats(),
  });
});

/** 服务器浏览器队列状态 */
router.get('/server-browser-queue', async (_req, res) => {
  return ok(res, serverBrowserQueue.stats());
});

/** 服务器浏览器：强制关停指定总任务（打断本机 + 中心库失败） */
router.post('/server-browser-stop', async (req, res) => {
  try {
    const batchId = Number(req.body?.batchId || req.body?.batch_id || 0);
    if (!batchId) return fail(res, '缺少 batchId', 400);
    const reason = String(req.body?.reason || req.body?.errorMessage || '服务器浏览器手动强制关停');
    const out = await withAuthContext(req, () => serverBrowserQueue.forceStop(batchId, reason));
    return ok(res, out, '已强制关停');
  } catch (error) {
    return fail(res, error.message || '关停失败', 422);
  }
});

/** 服务器浏览器：立刻补位领取（调试/重试后） */
router.post('/server-browser-tick', async (req, res) => {
  try {
    await withAuthContext(req, () => serverBrowserQueue.fillSlots());
    return ok(res, serverBrowserQueue.stats(), '已触发补位');
  } catch (error) {
    return fail(res, error.message || '补位失败', 422);
  }
});

/** 前台收到 work-push 后调用，本机 Node 打开比特执行 */
router.post('/run', async (req, res) => {
  try {
    const batch = req.body?.batch || req.body;
    if (!batch || !batch.id) return fail(res, '缺少 batch', 400);
    startInAuth(req, 'run', () => acceptAndRunBatch(batch));
    return ok(res, { started: true, batchId: Number(batch.id) }, '已开始执行');
  } catch (error) {
    return fail(res, error.message || '执行失败', 422);
  }
});

/** 手动测试总任务：按分任务顺序依次执行 */
router.post('/test-batch', async (req, res) => {
  try {
    const batchId = Number(req.body?.batchId || req.body?.batch_id || req.body?.id || 0);
    if (!batchId) return fail(res, '缺少 batchId', 400);
    startInAuth(req, `test-batch#${batchId}`, () => testRunBatch({ batchId }));
    return ok(res, { started: true, batchId }, '已开始测试总任务');
  } catch (error) {
    return fail(res, error.message || '测试失败', 422);
  }
});

/** 手动测试单个分任务 */
router.post('/test-item', async (req, res) => {
  try {
    const batchId = Number(req.body?.batchId || req.body?.batch_id || 0);
    const itemId = Number(req.body?.itemId || req.body?.item_id || req.body?.id || 0);
    if (!batchId || !itemId) return fail(res, '缺少 batchId 或 itemId', 400);
    startInAuth(req, `test-item#${itemId}`, () => testRunItem({ batchId, itemId }));
    return ok(res, { started: true, batchId, itemId }, '已开始测试分任务');
  } catch (error) {
    return fail(res, error.message || '测试失败', 422);
  }
});

/** 手动触发一次领取推送（调试用） */
router.post('/poll', async (req, res) => {
  try {
    await withAuthContext(req, () => tick());
    return ok(res, getExecutorStats(), '已轮询');
  } catch (error) {
    return fail(res, error.message, 422);
  }
});

/** 本机直接执行指定 batch（测试/重试私信等，无需开启「任务执行」） */
router.post('/run-batch', async (req, res) => {
  try {
    const batchId = Number(req.body?.batchId || req.body?.batch_id || 0);
    if (!batchId) return fail(res, '缺少 batchId', 400);
    // 服务器浏览器：同步 await kick（kick 只负责入队/开跑，很快返回），便于 linuxbrowse 确认入队
    // 桌面 WSS 路径：整批可能很长，仍后台 fire-and-forget
    const phpApi = require('../services/php-api');
    const { isServerBrowserBatchScope } = require('../services/browser/server-browser');
    let scope = '';
    try {
      const pack = await withAuthContext(req, () =>
        phpApi.get(`/account-work-batches/${batchId}/items`).catch(() => null)
      );
      scope = String(pack?.batch?.batch_scope || pack?.batch_scope || '');
    } catch { /* ignore */ }
    if (isServerBrowserBatchScope(scope) || scope === 'cs_seat') {
      const out = await withAuthContext(req, () => serverBrowserQueue.kickBatch(batchId));
      return ok(res, out, out?.already ? '已在队列中运行' : (out?.queued ? '已排队等待补位' : '已进入执行队列'));
    }
    startInAuth(req, `run-batch#${batchId}`, () => runClaimedBatchDirect(batchId));
    return ok(res, { started: true, batchId }, '已开始执行');
  } catch (error) {
    return fail(res, error.message || '执行失败', 422);
  }
});

/** 定点推送指定 batch（AI拓客启用后立即推送） */
router.post('/offer-batch', async (req, res) => {
  try {
    const batchId = Number(req.body?.batchId || req.body?.batch_id || 0);
    if (!batchId) return fail(res, '缺少 batchId', 400);
    const out = await withAuthContext(req, () => offerSpecificBatch(batchId));
    return ok(res, out, '已推送');
  } catch (error) {
    return fail(res, error.message || '推送失败', 422);
  }
});

/**
 * 暂停/终止 AI拓客：打断本机正在跑的流水线，并强制关闭指定比特环境。
 * body: { leadId, profileIds?: string[], reason?: string }
 */
router.post('/abort-ai-lead', async (req, res) => {
  try {
    const leadId = Number(req.body?.leadId || req.body?.lead_id || 0);
    const reason = String(req.body?.reason || '任务已暂停');
    const profileIds = Array.isArray(req.body?.profileIds)
      ? req.body.profileIds
      : (Array.isArray(req.body?.closeProfiles) ? req.body.closeProfiles : []);
    const { abortLeadRun } = require('../services/browser/ai-lead/pipeline-base');
    const { forceCloseBrowserProfile } = require('../services/browser/tiktok-actions');

    const closed = new Set();
    if (leadId > 0) {
      const out = await abortLeadRun(leadId, reason);
      for (const p of out.closed || []) closed.add(String(p));
    }
    for (const raw of profileIds) {
      const pid = String(raw || '').trim();
      if (!pid) continue;
      try {
        await forceCloseBrowserProfile(pid);
        closed.add(pid);
      } catch { /* ignore */ }
    }
    liveLog(
      leadId
        ? `AI拓客 #${leadId} 本机中止：关窗 ${closed.size} 个`
        : `本机强制关窗 ${closed.size} 个`,
      'warn',
      { leadId, closed: [...closed] }
    );
    return ok(res, {
      leadId,
      closed: [...closed],
      reason,
    }, closed.size ? '已中止并关闭环境' : '已标记中止');
  } catch (error) {
    return fail(res, error.message || '中止失败', 422);
  }
});

module.exports = router;
