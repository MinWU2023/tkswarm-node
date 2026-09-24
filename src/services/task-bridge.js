const phpApi = require('./php-api');
const { preparePublish, resumePublish } = require('./browser/tiktok-actions');

async function resumePublishViaPhp(taskId, itemId) {
  const item = await phpApi.get(`/node/tasks/${taskId}/items/${itemId}`);
  if (!item) throw new Error('子任务不存在');
  if (item.status === 'success') throw new Error('该子任务已发布成功');
  await phpApi.post(`/node/tasks/${taskId}/items/${itemId}/status`, { status: 'publishing' });
  try {
    const result = await resumePublish(Number(item.account_id || item.accountId), {
      materialId: Number(item.material_id || item.materialId),
      title: item.title || '',
      caption: item.caption || '',
    });
    await phpApi.post(`/node/tasks/${taskId}/items/${itemId}/result`, {
      status: result?.status === 'published' ? 'success' : (result?.status || 'failed'),
      result,
      errorMessage: result?.error || '',
    });
    return result;
  } catch (e) {
    await phpApi.post(`/node/tasks/${taskId}/items/${itemId}/result`, {
      status: 'failed',
      errorMessage: e.message,
    }).catch(() => {});
    throw e;
  }
}

async function claimNextTask() {
  return phpApi.post('/node/tasks/claim', {});
}

async function reportTaskAccountResult(taskId, accountId, payload) {
  return phpApi.post(`/node/tasks/${taskId}/account-result`, { accountId, ...payload });
}

async function finishTask(taskId, payload) {
  return phpApi.post(`/node/tasks/${taskId}/finish`, payload || {});
}

async function getMaterial(id) {
  return phpApi.get(`/node/materials/${id}`);
}

module.exports = {
  resumePublishViaPhp,
  claimNextTask,
  reportTaskAccountResult,
  finishTask,
  getMaterial,
  preparePublish,
};
