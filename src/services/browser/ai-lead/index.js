const { runUserPipeline } = require('./user-pipeline');
const { runVideoPipeline } = require('./video-pipeline');
const { liveLog } = require('./pipeline-base');

/**
 * AI拓客入口：按 type 分线
 * @param {number} accountId
 * @param {object} payload
 */
async function runAiLead(accountId, payload = {}) {
  const type = String(payload.type || 'user').toLowerCase();
  if (type === 'video') {
    return runVideoPipeline(accountId, payload);
  }
  return runUserPipeline(accountId, payload);
}

module.exports = {
  runAiLead,
  runUserPipeline,
  runVideoPipeline,
};
