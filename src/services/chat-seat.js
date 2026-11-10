/**
 * 客服坐席：入队 PHP cs_seat 任务并立即 claim 推送/本机执行。
 */
const phpApi = require('./php-api');
const { publish: liveLog } = require('./live-log');
const { runClaimedBatchDirect, offerSpecificBatch } = require('./task-runner');
const executorHub = require('./executor-hub');

/**
 * @param {{ accountId:number, action:string, friendId?:number, content?:string, translated?:string, maxPerRun?:number }} body
 */
async function enqueueAndRunSeatTask(body = {}) {
  const accountId = Number(body.accountId || body.account_id || 0);
  const action = String(body.action || '').trim().toLowerCase();
  if (!accountId || !action) throw new Error('accountId 与 action 必填');

  let enqueued;
  try {
    enqueued = await phpApi.post('/chat/seat-tasks', {
      accountId,
      action,
      friendId: body.friendId || body.friend_id || 0,
      content: body.content || '',
      translated: body.translated || '',
      maxPerRun: body.maxPerRun || undefined,
    });
  } catch (e) {
    // 业务拒绝（如「今日私信次数已使用完」）直接给客服看原文，不带接口路径后缀
    const bizMsg = e?.status === 422 && typeof e?.payload?.message === 'string' ? e.payload.message.trim() : '';
    if (bizMsg) {
      const err = new Error(bizMsg);
      err.status = 422;
      throw err;
    }
    throw e;
  }
  const batchId = Number(enqueued?.batchId || enqueued?.batch_id || 0);
  const itemId = Number(enqueued?.itemId || enqueued?.item_id || 0);
  if (!batchId || !itemId) {
    throw new Error('入队失败：未返回 batchId/itemId');
  }

  liveLog(
    `客服坐席：账号#${accountId} 动作=${action} 已入队 batch#${batchId} item#${itemId}（服务器浏览器）`,
    'info',
    { accountId, batchId, itemId }
  );

  let run = null;
  try {
    // 有开着的「任务执行」前台则 WSS 推送；否则本机 Node 直跑（linux → 服务器浏览器 EL）
    if (executorHub.hasEnabled()) {
      run = await offerSpecificBatch(batchId);
    } else {
      run = await runClaimedBatchDirect(batchId);
    }
  } catch (e) {
    // 入队已成功：前台可轮询；执行触发失败不抹掉 item
    const msg = String(e.message || e);
    liveLog(
      `客服坐席：batch#${batchId} 触发执行失败（可稍后自动领取）：${msg}`,
      'warn',
      { accountId, batchId, itemId }
    );
    return {
      ...enqueued,
      batchId,
      itemId,
      accountId,
      action,
      triggered: false,
      triggerError: msg,
      message: `已入队 batch#${batchId}，但未能立刻推到服务器浏览器：${msg}`,
    };
  }

  liveLog(
    `客服坐席：batch#${batchId} 已触发执行（${run?.direct ? '本机直跑' : '已推前台/服务器浏览器'}）`,
    'info',
    { accountId, batchId, itemId }
  );

  return {
    ...enqueued,
    batchId,
    itemId,
    accountId,
    action,
    triggered: true,
    run,
  };
}

async function pollSeatItem(itemId, { timeoutMs = 180000, intervalMs = 2500 } = {}) {
  const id = Number(itemId);
  if (!id) throw new Error('缺少 itemId');
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    last = await phpApi.get(`/chat/seat-items/${id}`);
    const st = String(last?.status || '');
    if (['completed', 'failed', 'cancelled', 'paused'].includes(st)) {
      return last;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return last || { itemId: id, status: 'running', errorMessage: '等待超时' };
}

module.exports = { enqueueAndRunSeatTask, pollSeatItem };
