/**
 * 原生 JS 对话框（alert / confirm / prompt / beforeunload）兜底
 * ---------------------------------------------------------------------------
 * 问题现象：
 *   ProtocolError: Protocol error (Page.handleJavaScriptDialog): No dialog is showing
 *   at Dialog.close → DialogManager.dialogDidOpen → crPage.onDialog
 *   进程直接退出（Node 默认把未处理的 Promise 拒绝当成致命错误）。
 *
 * 原因：
 *   页面没有注册 dialog 监听时，Playwright 内部会自己去 accept/close 对话框；
 *   如果对话框在同一瞬间被页面自身关掉（TikTok 的验证弹框、跳转前的 beforeunload
 *   都会这样），内部的 handleJavaScriptDialog 就会抛「No dialog is showing」，
 *   而这个 Promise 没人 catch。
 *
 * 做法：
 *   每个页面主动注册 dialog 监听，全程 try/catch 吞掉协议竞态错误，
 *   让 Playwright 不再走它自己那条没有保护的处理路径。
 *   本模块绝不抛错，也绝不影响页面逻辑。
 */
const { publish: liveLog } = require('../live-log');

let loggedOnce = false;

/**
 * @param {import('playwright-core').Page} page
 * @param {{accountId?:number, tag?:string}} ctx
 */
function attachDialogGuard(page, ctx = {}) {
  if (!page || typeof page.on !== 'function') return page;
  if (page.__tkDialogGuard) return page;
  page.__tkDialogGuard = true;

  const accountId = Number(ctx.accountId || page.__tkAccountId || 0) || 0;

  try {
    page.on('dialog', (dialog) => {
      // 整个处理过程包在 async IIFE + catch 里：任何异常都不允许冒泡成未处理拒绝
      (async () => {
        try {
          const type = String(dialog.type?.() || 'dialog');
          let message = '';
          try { message = String(dialog.message?.() || '').slice(0, 200); } catch { /* ignore */ }
          if (!loggedOnce || type !== 'beforeunload') {
            liveLog(
              `账号 #${accountId}：页面弹出 ${type} 对话框${message ? `（${message}）` : ''}，已自动确认`,
              'info',
              { accountId }
            );
            loggedOnce = true;
          } else if (type === 'beforeunload') {
            liveLog(`账号 #${accountId}：页面离开确认框已自动接受`, 'info', { accountId });
          }
          // 一律接受：beforeunload 接受才会真正跳转；confirm 接受相当于「确定」，
          // 与原先 Playwright 默认 dismiss 相比更贴近真实用户操作，避免流程卡住。
          await dialog.accept();
        } catch (e) {
          // 「No dialog is showing」等竞态：对话框已被页面自己关掉，忽略即可
          const msg = String(e?.message || e || '');
          if (!/No dialog is showing|Target closed|Session closed|has been closed/i.test(msg)) {
            try {
              liveLog(`账号 #${accountId}：对话框处理异常（已忽略）：${msg}`, 'warn', { accountId });
            } catch { /* ignore */ }
          }
        }
      })().catch(() => {});
    });
  } catch { /* ignore */ }

  return page;
}

module.exports = { attachDialogGuard };
