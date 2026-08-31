const { db } = require('../db');
const { syncProfile, syncVideos } = require('./browser/tiktok-data');

let busy = false;
let timer;
function setting(key, fallback) { const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key); if (!row) return fallback; try { return JSON.parse(row.value); } catch { return fallback; } }
function event(taskId, message, level = 'info') { db.prepare('INSERT INTO task_events(task_id,level,message) VALUES (?,?,?)').run(taskId, level, message); }
function accountsFor(task) {
  const params = { limit: task.total_count > 0 ? task.total_count : 200, taskId: task.id };
  let where = task.group_id ? 'WHERE a.enabled=1 AND a.group_id=@groupId' : 'WHERE a.enabled=1';
  if (task.group_id) params.groupId = task.group_id;
  let payload = {}; try { payload = JSON.parse(task.payload || '{}'); } catch {}
  if (payload.onlyFailed) where += " AND EXISTS (SELECT 1 FROM task_runs fr WHERE fr.task_id=@taskId AND fr.account_id=a.id AND fr.status='failed')";
  return db.prepare(`SELECT a.id FROM accounts a ${where} ORDER BY a.id ASC LIMIT @limit`).all(params);
}
function timeout(ms) { return new Promise((_, reject) => setTimeout(() => reject(new Error(`账号处理超时（${ms} 秒）`)), ms * 1000)); }
async function processAccount(task, account, timeoutSeconds) {
  event(task.id, `开始处理账号 #${account.id}`);
  const run = db.prepare("INSERT INTO task_runs(task_id,account_id,status) VALUES (?,?,'running')").run(task.id, account.id);
  try {
    const work = task.type === 'profile' ? syncProfile(account.id) : task.type === 'sync' ? syncProfile(account.id).then(() => syncVideos(account.id)) : Promise.reject(new Error(`任务类型“${task.type}”的执行器尚未启用`));
    await Promise.race([work, timeout(timeoutSeconds)]);
    db.prepare("UPDATE task_runs SET status='success',finished_at=CURRENT_TIMESTAMP WHERE id=?").run(run.lastInsertRowid);
    db.prepare("INSERT INTO task_action_results(task_id,account_id,action_type,status,result_json) VALUES (?,?,?,?,?)").run(task.id,account.id,task.type,'success',JSON.stringify({runId:run.lastInsertRowid}));
    event(task.id, `账号 #${account.id} 处理成功`);
    db.prepare('UPDATE tasks SET success_count=success_count+1,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(task.id);
  } catch (error) {
    db.prepare("UPDATE task_runs SET status='failed',error_message=?,finished_at=CURRENT_TIMESTAMP WHERE id=?").run(error.message, run.lastInsertRowid);
    db.prepare("INSERT INTO task_action_results(task_id,account_id,action_type,status,result_json,error_message) VALUES (?,?,?,?,?,?)").run(task.id,account.id,task.type,'failed','{}',error.message);
    event(task.id, `账号 #${account.id} 处理失败：${error.message}`, 'error');
    db.prepare('UPDATE tasks SET fail_count=fail_count+1,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(task.id);
    console.error(JSON.stringify({ taskId: task.id, accountId: account.id, error: error.message }));
  }
}
async function execute(task) {
  const accounts = accountsFor(task);
  const concurrency = Math.min(3, Math.max(1, Number(setting('taskConcurrency', 1)) || 1));
  const timeoutSeconds = Math.min(600, Math.max(30, Number(setting('taskAccountTimeout', 180)) || 180));
  event(task.id, `任务开始执行，共 ${accounts.length} 个账号，并发数 ${concurrency}，单账号超时 ${timeoutSeconds} 秒`);
  db.prepare("UPDATE tasks SET total_count=?,success_count=0,fail_count=0,status='running',started_at=COALESCE(started_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP WHERE id=?").run(accounts.length, task.id);
  for (let i = 0; i < accounts.length; i += concurrency) {
    const current = db.prepare('SELECT status FROM tasks WHERE id=?').get(task.id);
    if (!current || current.status === 'paused' || current.status === 'cancelled') return;
    await Promise.all(accounts.slice(i, i + concurrency).map(account => processAccount(task, account, timeoutSeconds)));
  }
  const final = db.prepare('SELECT status,fail_count FROM tasks WHERE id=?').get(task.id);
  if (final && !['paused','cancelled'].includes(final.status)) {
    db.prepare("UPDATE tasks SET status=?,finished_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(final.fail_count ? 'failed' : 'completed', task.id);
    event(task.id, final.fail_count ? '任务执行完成，但存在失败账号' : '任务全部执行成功', final.fail_count ? 'warn' : 'info');
  }
}
async function tick() {
  if (busy) return;
  const task = db.prepare("SELECT * FROM tasks WHERE status='queued' AND (scheduled_at IS NULL OR scheduled_at <= CURRENT_TIMESTAMP) ORDER BY id ASC LIMIT 1").get();
  if (!task) return;
  busy = true;
  try { await execute(task); } catch (error) { db.prepare("UPDATE tasks SET status='failed',fail_count=fail_count+1,finished_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(task.id); event(task.id, `任务异常终止：${error.message}`, 'error'); } finally { busy = false; }
}
function recoverInterruptedTasks() {
  const rows = db.prepare("SELECT id FROM tasks WHERE status='running'").all();
  if (!rows.length) return;
  const recover = db.transaction(() => rows.forEach(row => {
    db.prepare("UPDATE task_runs SET status='skipped',error_message='服务重启，任务已恢复到队列',finished_at=CURRENT_TIMESTAMP WHERE task_id=? AND status='running'").run(row.id);
    db.prepare("UPDATE tasks SET status='queued',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(row.id);
    event(row.id, '检测到服务重启，任务已恢复到队列', 'warn');
  }));
  recover();
}
function startTaskRunner() { if (timer) return; recoverInterruptedTasks(); timer = setInterval(() => tick().catch(error => console.error(error.message)), 1500); timer.unref?.(); tick().catch(error => console.error(error.message)); }
module.exports = { startTaskRunner };
