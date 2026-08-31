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

router.post('/:id/start', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id=?').get(req.params.id);
  if (!task) return fail(res, '任务不存在', 404);
  if (!['draft', 'paused', 'failed'].includes(task.status)) return fail(res, `当前状态 ${task.status} 不允许启动`, 409);
  db.prepare("UPDATE tasks SET status='queued', started_at=COALESCE(started_at,CURRENT_TIMESTAMP), updated_at=CURRENT_TIMESTAMP WHERE id=?").run(task.id);
  return ok(res, null, '任务已进入队列；自动化执行器将在后续阶段接入');
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
