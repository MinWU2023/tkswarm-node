const { db } = require('../db');
const { syncProfile, syncVideos } = require('./browser/tiktok-data');

let busy = false;
let timer;

function accountsFor(task) {
  const params = { limit: task.total_count > 0 ? task.total_count : 200 };
  let where = task.group_id ? 'WHERE a.enabled=1 AND a.group_id=@groupId' : 'WHERE a.enabled=1';
  if (task.group_id) params.groupId = task.group_id;
  let payload = {};
  try { payload = JSON.parse(task.payload || '{}'); } catch {}
  if (payload.onlyFailed) where += " AND EXISTS (SELECT 1 FROM task_runs fr WHERE fr.task_id=@taskId AND fr.account_id=a.id AND fr.status='failed')";
  params.taskId = task.id;
  return db.prepare(`SELECT a.id FROM accounts a ${where} ORDER BY a.id ASC LIMIT @limit`).all(params);
}

async function execute(task) {
  const accounts = accountsFor(task);
  db.prepare('UPDATE tasks SET total_count=?, success_count=0, fail_count=0, status=\'running\', started_at=COALESCE(started_at,CURRENT_TIMESTAMP), updated_at=CURRENT_TIMESTAMP WHERE id=?').run(accounts.length, task.id);
  for (const account of accounts) {
    const current = db.prepare('SELECT status FROM tasks WHERE id=?').get(task.id);
    if (!current || current.status === 'paused' || current.status === 'cancelled') return;
    const run = db.prepare("INSERT INTO task_runs(task_id,account_id,status) VALUES (?,?,'running')").run(task.id, account.id);
    try {
      if (task.type === 'profile') await syncProfile(account.id);
      else if (task.type === 'sync') { await syncProfile(account.id); await syncVideos(account.id); }
      else throw new Error(`任务类型“${task.type}”的执行器尚未启用`);
      db.prepare("UPDATE task_runs SET status='success',finished_at=CURRENT_TIMESTAMP WHERE id=?").run(run.lastInsertRowid);
      db.prepare('UPDATE tasks SET success_count=success_count+1, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(task.id);
    } catch (error) {
      db.prepare("UPDATE task_runs SET status='failed',error_message=?,finished_at=CURRENT_TIMESTAMP WHERE id=?").run(error.message, run.lastInsertRowid);
      db.prepare('UPDATE tasks SET fail_count=fail_count+1, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(task.id);
      console.error(JSON.stringify({ taskId: task.id, accountId: account.id, error: error.message }));
    }
  }
  const final = db.prepare('SELECT status,total_count,success_count,fail_count FROM tasks WHERE id=?').get(task.id);
  if (final && !['paused', 'cancelled'].includes(final.status)) {
    db.prepare("UPDATE tasks SET status=?, finished_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .run(final.fail_count ? 'failed' : 'completed', task.id);
  }
}

async function tick() {
  if (busy) return;
  const task = db.prepare("SELECT * FROM tasks WHERE status='queued' ORDER BY id ASC LIMIT 1").get();
  if (!task) return;
  busy = true;
  try { await execute(task); } catch (error) {
    db.prepare("UPDATE tasks SET status='failed', fail_count=fail_count+1, finished_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(task.id);
    console.error(JSON.stringify({ taskId: task.id, error: error.message }));
  } finally { busy = false; }
}

function startTaskRunner() {
  if (timer) return;
  timer = setInterval(() => tick().catch(error => console.error(error.message)), 1500);
  timer.unref?.();
  tick().catch(error => console.error(error.message));
}

module.exports = { startTaskRunner };
