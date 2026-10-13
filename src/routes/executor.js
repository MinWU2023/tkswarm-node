/**
 * 前台执行器 HTTP：接单后驱动比特跑总任务；支持手动测试总任务/分任务。
 */
const express = require('express');
const { ok, fail } = require('../http');
const {
  acceptAndRunBatch,
  getExecutorStats,
  tick,
  testRunBatch,
  testRunItem,
  offerSpecificBatch,
} = require('../services/task-runner');
const executorHub = require('../services/executor-hub');
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
        liveLog(`${label} failed: ${msg}`, 'error', {});
      });
  });
}

router.get('/status', (req, res) => {
  return ok(res, {
    ...getExecutorStats(),
    hubOnline: executorHub.countEnabled(),
  });
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

module.exports = router;
