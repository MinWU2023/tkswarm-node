/**
 * 账号会话执行上下文（AsyncLocalStorage）
 * 用于把 claim 到的比特环境 profileId 传到 connectAccount 等下游。
 *
 * keepBrowser=true：总任务串行执行期间不关闭比特窗口，子任务之间只断 CDP；
 * 总任务结束（或测试模式）再真正 browser/close。
 */
const { AsyncLocalStorage } = require('node:async_hooks');

const als = new AsyncLocalStorage();

function runWithSession(ctx, fn) {
  return als.run(ctx || {}, fn);
}

function getSession() {
  return als.getStore() || null;
}

function getSessionProfileId() {
  const st = als.getStore();
  return String(st?.browserProfileId || st?.profileId || '');
}

/** 总任务全自动：子任务间保持浏览器环境不关 */
function shouldKeepBrowserOpen() {
  const st = als.getStore();
  return Boolean(st?.keepBrowser) && !st?.test;
}

module.exports = {
  runWithSession,
  getSession,
  getSessionProfileId,
  shouldKeepBrowserOpen,
};
