const phpApi = require('./php-api');
const { syncProfile, syncVideos } = require('./browser/tiktok-data');
const { preparePublish, prepareMessage } = require('./browser/tiktok-actions');
const { assertPublishGate } = require('./account-gates');
const { publish: liveLog } = require('./live-log');

let busy = false;

async function executePhpTask(task) {
  const type = task.type;
  const accounts = Array.isArray(task.accounts) ? task.accounts : [];
  const payload = task.payload || {};
  liveLog(`领取任务 #${task.id} ${task.name || type}，账号 ${accounts.length}`, 'info', { taskId: task.id });

  let success = 0;
  let fail = 0;
  for (const acc of accounts) {
    const accountId = Number(acc.id || acc.accountId);
    try {
      if (type === 'publish') await assertPublishGate(accountId, payload.pushChannel || 'bit');
      let result;
      if (type === 'profile' || type === 'sync') {
        result = await syncProfile(accountId);
        if (type === 'sync') result = await syncVideos(accountId);
      } else if (type === 'publish') {
        const materialId = Number(acc.materialId || acc.material_id || payload.materialId);
        result = await preparePublish(accountId, materialId, payload.publishTitle || '', payload.publishCaption || '', {
          autoPublish: !payload.manualConfirm,
        });
        if (result?.status === 'security_paused' || result?.status === 'manual_required') {
          await phpApi.post(`/node/tasks/${task.id}/account-result`, {
            accountId,
            status: 'skipped',
            result,
            errorMessage: result.reason || result.status,
          });
          continue;
        }
        if (result?.status !== 'published') throw new Error(result?.error || `发布未完成：${result?.status}`);
      } else if (type === 'message') {
        result = await prepareMessage(accountId, payload.content || payload.publishCaption || '', payload.recipient || '');
      } else if (type === 'dm_sync') {
        const { syncAccountDm } = require('./browser/tiktok-dm-sync');
        result = await syncAccountDm(accountId, payload);
      } else {
        throw new Error(`任务类型暂不支持（php 模式）：${type}`);
      }
      await phpApi.post(`/node/tasks/${task.id}/account-result`, {
        accountId,
        status: 'success',
        result,
      });
      success += 1;
    } catch (error) {
      fail += 1;
      await phpApi.post(`/node/tasks/${task.id}/account-result`, {
        accountId,
        status: 'failed',
        errorMessage: error.message,
      }).catch(() => {});
      liveLog(`任务 #${task.id} 账号#${accountId} 失败：${error.message}`, 'error', { taskId: task.id });
    }
  }
  await phpApi.post(`/node/tasks/${task.id}/finish`, { success, fail });
  liveLog(`任务 #${task.id} 结束：成功 ${success}，失败 ${fail}`, 'info', { taskId: task.id });
}

async function tick() {
  if (busy) return;
  busy = true;
  try {
    const task = await phpApi.post('/node/tasks/claim', {});
    if (!task || !task.id) return;
    await executePhpTask(task);
  } catch (error) {
    if (!/暂无|404|empty/i.test(error.message || '')) {
      console.error('[task-runner]', error.message);
    }
  } finally {
    busy = false;
  }
}

function startTaskRunner() {
  const timer = setInterval(() => { tick(); }, 5000);
  timer.unref?.();
  console.log('[INFO] task-runner：PHP 队列模式（每 5s claim）');
}

module.exports = { startTaskRunner, tick };
