/**
 * AI拓客 · 按视频类型（逻辑待定，独立分线）
 */
const { finishLead, liveLog } = require('./pipeline-base');

async function runVideoPipeline(accountId, payload) {
  const leadId = Number(payload.leadId || payload.lead_id || 0);
  liveLog(`AI拓客 #${leadId} 按视频类型尚未实现 account#${accountId}`, 'warn', { leadId, accountId });
  await finishLead(leadId, false, { error: '按视频拓客逻辑尚未实现' });
  throw new Error('按视频拓客逻辑尚未实现，请使用「按用户」类型或等待后续版本');
}

module.exports = { runVideoPipeline };
