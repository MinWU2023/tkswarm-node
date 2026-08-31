const express = require('express');
const { z } = require('zod');
const { db } = require('../db');
const { ok, fail, pagination, listResult } = require('../http');

const router = express.Router();
const schema = z.object({
  name: z.string().trim().min(1).max(150),
  type: z.enum(['publish', 'message', 'sync', 'profile']),
  groupId: z.union([z.coerce.number().int().positive(), z.null()]).optional().default(null),
  totalCount: z.coerce.number().int().min(0).default(0),
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional().default(null),
  payload: z.record(z.string(), z.unknown()).default({}),
});

router.post('/batch-retry', (req, res) => {
  const ids = Array.isArray(req.body?.taskIds) ? [...new Set(req.body.taskIds.map(Number).filter(Number.isInteger))].slice(0, 100) : [];
  if (!ids.length) return fail(res, '请选择失败任务', 400);
  const placeholders = ids.map(() => '?').join(',');
  const result = db.prepare(`UPDATE tasks SET status='queued', payload=json_set(CASE WHEN json_valid(payload) THEN payload ELSE '{}' END, '$.onlyFailed', 1), finished_at=NULL, updated_at=CURRENT_TIMESTAMP WHERE id IN (${placeholders}) AND status='failed' AND type IN ('sync','profile')`).run(...ids);
  db.prepare(`INSERT INTO task_events(task_id,level,message) SELECT id,'info','失败账号已批量重新进入队列' FROM tasks WHERE id IN (${placeholders}) AND status='queued'`).run(...ids);
  return ok(res, { requested: ids.length, changed: result.changes }, '批量重试已提交');
});

router.post('/batch-action', (req, res) => {
  const ids = Array.isArray(req.body?.taskIds) ? [...new Set(req.body.taskIds.map(Number).filter(Number.isInteger))].slice(0, 100) : [];
  const action = req.body?.action;
  if (!ids.length) return fail(res, '请选择任务', 400);
  if (!['start', 'pause', 'cancel'].includes(action)) return fail(res, '不支持的批量操作', 400);
  const placeholders = ids.map(() => '?').join(',');
  const allowed = action === 'start' ? ['draft','paused','failed'] : action === 'pause' ? ['queued','running'] : ['queued','running','paused'];
  const statusPlaceholders = allowed.map(() => '?').join(',');
  const supported = action === 'start' ? " AND type IN ('sync','profile')" : '';
  const result = db.prepare(`UPDATE tasks SET status=?, finished_at=${action === 'cancel' ? 'CURRENT_TIMESTAMP' : 'NULL'}, updated_at=CURRENT_TIMESTAMP WHERE id IN (${placeholders}) AND status IN (${statusPlaceholders})${supported}`)
    .run(action === 'start' ? 'queued' : action === 'pause' ? 'paused' : 'cancelled', ...ids, ...allowed);
  if (action === 'cancel') db.prepare(`UPDATE task_runs SET status='skipped',error_message='任务被批量取消',finished_at=CURRENT_TIMESTAMP WHERE task_id IN (${placeholders}) AND status='running'`).run(...ids);
  db.prepare(`INSERT INTO task_events(task_id,level,message) SELECT id,?,? FROM tasks WHERE id IN (${placeholders})`).run(action === 'cancel' ? 'warn' : 'info', `任务已批量${action === 'start' ? '启动' : action === 'pause' ? '暂停' : '取消'}`, ...ids);
  return ok(res, { requested: ids.length, changed: result.changes }, '批量操作完成');
});

router.get('/', (req, res) => {
  const { page, pageSize, offset } = pagination(req.query);
  const filters = [];
  const params = {};
  if (req.query.type) { filters.push('t.type=@type'); params.type = req.query.type; }
  if (req.query.status) { filters.push('t.status=@status'); params.status = req.query.status; }
  const where = filters.length ? ` WHERE ${filters.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) count FROM tasks t${where}`).get(params).count;
  const rows = db.prepare(`SELECT t.*, g.name group_name FROM tasks t LEFT JOIN groups g ON g.id=t.group_id${where} ORDER BY t.id DESC LIMIT @pageSize OFFSET @offset`)
    .all({ ...params, pageSize, offset }).map(row => ({ ...row, payload: JSON.parse(row.payload || '{}') }));
  return ok(res, listResult(rows, total, page, pageSize));
});

router.post('/', (req, res) => {
  const b = schema.parse(req.body);
  const result = db.prepare(`INSERT INTO tasks (name,type,group_id,total_count,scheduled_at,payload)
    VALUES (@name,@type,@groupId,@totalCount,@scheduledAt,@payload)`).run({ ...b, payload: JSON.stringify(b.payload) });
  return ok(res, { id: result.lastInsertRowid, ...b, status: 'draft' }, '任务已创建', 201);
});

router.put('/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id=?').get(req.params.id);
  if (!task) return fail(res, '任务不存在', 404);
  if (!['draft', 'paused', 'failed'].includes(task.status)) return fail(res, '只有草稿、暂停或失败任务可以编辑', 409);
  const b = schema.parse(req.body);
  db.prepare(`UPDATE tasks SET name=@name,type=@type,group_id=@groupId,total_count=@totalCount,scheduled_at=@scheduledAt,payload=@payload,updated_at=CURRENT_TIMESTAMP WHERE id=@id`)
    .run({ ...b, id: task.id, payload: JSON.stringify(b.payload) });
  db.prepare("INSERT INTO task_events(task_id,level,message) VALUES (?, 'info', '任务配置已更新')").run(task.id);
  return ok(res, { id: task.id, ...b, status: task.status }, '任务已更新');
});

router.get('/:id/preview', (req, res) => {
  const task = db.prepare('SELECT id,name,type,group_id,payload,total_count,scheduled_at,status FROM tasks WHERE id=?').get(req.params.id);
  if (!task) return fail(res, '任务不存在', 404);
  let payload = {}; try { payload = JSON.parse(task.payload || '{}'); } catch {}
  const ids = Array.isArray(payload.materialIds) ? payload.materialIds.map(Number).filter(Number.isInteger) : [];
  const materials = ids.length ? db.prepare(`SELECT id,name,file_name,mime_type,size_bytes,description,tags,status FROM materials WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids) : [];
  const template = payload.templateId ? db.prepare('SELECT id,name,content,variables,enabled FROM message_templates WHERE id=?').get(payload.templateId) : null;
  return ok(res, { task: { ...task, payload: undefined }, payload, materials, template });
});

router.get('/:id/events', (req, res) => {
  const task = db.prepare('SELECT id FROM tasks WHERE id=?').get(req.params.id);
  if (!task) return fail(res, '任务不存在', 404);
  return ok(res, db.prepare('SELECT id,level,message,created_at FROM task_events WHERE task_id=? ORDER BY id DESC LIMIT 200').all(task.id));
});

router.get('/:id/runs', (req, res) => {
  const task = db.prepare('SELECT id FROM tasks WHERE id=?').get(req.params.id);
  if (!task) return fail(res, '任务不存在', 404);
  const rows = db.prepare(`SELECT r.*, a.username FROM task_runs r JOIN accounts a ON a.id=r.account_id WHERE r.task_id=? ORDER BY r.id DESC`).all(task.id);
  return ok(res, rows);
});

router.post('/:id/cancel', (req, res) => {
  const result = db.prepare("UPDATE tasks SET status='cancelled', finished_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('queued','running','paused')").run(req.params.id);
  if (!result.changes) return fail(res, '任务不存在或当前不能取消', 409);
  db.prepare("UPDATE task_runs SET status='skipped', error_message='任务被取消', finished_at=CURRENT_TIMESTAMP WHERE task_id=? AND status='running'").run(req.params.id);
  db.prepare("INSERT INTO task_events(task_id,level,message) VALUES (?, 'warn', '任务已取消')").run(req.params.id);
  return ok(res, null, '任务已取消');
});

router.post('/:id/retry', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id=?').get(req.params.id);
  if (!task) return fail(res, '任务不存在', 404);
  if (task.status !== 'failed') return fail(res, '只有失败任务可以重试', 409);
  if (!['sync', 'profile'].includes(task.type)) return fail(res, '当前任务类型暂不支持自动重试', 409);
  let payload = {};
  try { payload = JSON.parse(task.payload || '{}'); } catch {}
  payload.onlyFailed = true;
  db.prepare("UPDATE tasks SET status='queued', payload=?, finished_at=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .run(JSON.stringify(payload), task.id);
  db.prepare("INSERT INTO task_events(task_id,level,message) VALUES (?, 'info', '失败账号已重新进入队列')").run(task.id);
  return ok(res, null, '失败账号已重新进入队列');
});

router.post('/:id/start', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id=?').get(req.params.id);
  if (!task) return fail(res, '任务不存在', 404);
  if (!['draft', 'paused', 'failed'].includes(task.status)) return fail(res, `当前状态 ${task.status} 不允许启动`, 409);
  if (!['sync', 'profile'].includes(task.type)) return fail(res, `“${task.type}”任务执行器尚未接入，请先使用资料同步任务`, 409);
  db.prepare("UPDATE tasks SET status='queued', started_at=COALESCE(started_at,CURRENT_TIMESTAMP), finished_at=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(task.id);
  db.prepare("INSERT INTO task_events(task_id,level,message) VALUES (?, 'info', '任务已进入队列')").run(task.id);
  return ok(res, null, '任务已进入队列');
});

router.post('/:id/pause', (req, res) => {
  const result = db.prepare("UPDATE tasks SET status='paused', updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('queued','running')").run(req.params.id);
  if (!result.changes) return fail(res, '任务不存在或当前不能暂停', 409);
  return ok(res, null, '任务已暂停');
});

router.delete('/:id', (req, res) => {
  const result = db.prepare("DELETE FROM tasks WHERE id=? AND status NOT IN ('queued','running')").run(req.params.id);
  if (!result.changes) return fail(res, '任务不存在或正在运行', 409);
  return ok(res, null, '任务已删除');
});

module.exports = router;
