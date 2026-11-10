/**
 * 计划任务：到了账号的「解封时间」自动把状态从 banned 恢复成 normal。
 *
 * 实现方式：Node 常驻进程内定时调 PHP 的 `POST /api/node/maintenance/restore-bans`，
 * 不依赖外部 crontab；接口本身是幂等的（只处理 ban_until<=NOW() 的记录）。
 */
const dataStore = require('./data-store');
const { publish: liveLog } = require('./live-log');

let timer = null;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const r = await dataStore.restoreExpiredBans();
    const n = Number((r && r.restored) || 0);
    if (n > 0) {
      const msg = `已自动解封 ${n} 个到期账号`;
      console.log(`[ban-restore] ${msg}`);
      liveLog(`封禁恢复：${msg}`, 'info', {});
    }
    const assessed = Array.isArray(r && r.assessed) ? r.assessed : [];
    if (assessed.length) {
      const banned = assessed.filter((x) => x && x.is_banned).length;
      const msg = `AI 复核 ${assessed.length} 个账号（判定封禁 ${banned} 个）`;
      console.log(`[ban-restore] ${msg}`);
      liveLog(`封禁评估：${msg}`, 'info', {});
    }
  } catch (e) {
    console.error(`[ban-restore] 自动解封失败：${e.message}`);
  } finally {
    running = false;
  }
}

function startBanRestoreScheduler(intervalMs = 5 * 60 * 1000) {
  if (timer) return timer;
  const every = Math.max(60000, Number(intervalMs) || 300000);
  const kick = setTimeout(tick, 15000);
  if (kick.unref) kick.unref();
  timer = setInterval(tick, every);
  if (timer.unref) timer.unref();
  console.log('[ban-restore] 计划任务已启动：每 ' + Math.round(every / 60000) + ' 分钟检查一次解封时间');
  return timer;
}

function stopBanRestoreScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = { startBanRestoreScheduler, stopBanRestoreScheduler, tick };
