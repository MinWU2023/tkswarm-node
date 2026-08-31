const express = require('express');
const fs = require('node:fs');
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

router.get('/export.csv', (req, res) => {
  const filters = []; const params = {};
  if (req.query.type) { filters.push('t.type=@type'); params.type=req.query.type; }
  if (req.query.status) { filters.push('t.status=@status'); params.status=req.query.status; }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT t.id,t.name,t.type,t.status,t.total_count,t.success_count,t.fail_count,t.scheduled_at,t.started_at,t.finished_at,t.created_at,g.name group_name FROM tasks t LEFT JOIN groups g ON g.id=t.group_id ${where} ORDER BY t.id DESC`).all(params);
  const esc = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = ['ID,任务名称,类型,状态,分组,总数,成功,失败,计划时间,开始时间,结束时间,创建时间', ...rows.map(r => [r.id,r.name,r.type,r.status,r.group_name,r.total_count,r.success_count,r.fail_count,r.scheduled_at,r.started_at,r.finished_at,r.created_at].map(esc).join(','))].join('\r\n');
  res.setHeader('Content-Type','text/csv; charset=utf-8'); res.setHeader('Content-Disposition','attachment; filename="tkswarm-tasks.csv"'); return res.send('\ufeff'+csv);
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
  const supported = action === 'start' ? " AND type IN ('sync','profile','publish','message')" : '';
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

router.post('/:id/preflight', (req, res) => {
  const task = db.prepare('SELECT id,type,payload,group_id,total_count FROM tasks WHERE id=?').get(req.params.id);
  if (!task) return fail(res, '任务不存在', 404);
  let payload = {}; try { payload = JSON.parse(task.payload || '{}'); } catch { payload = {}; }
  const issues = [];
  const accountCount = task.group_id ? db.prepare('SELECT COUNT(*) count FROM accounts WHERE enabled=1 AND group_id=?').get(task.group_id).count : db.prepare('SELECT COUNT(*) count FROM accounts WHERE enabled=1').get().count;
  if (!accountCount) issues.push('没有符合条件的启用账号');
  if (task.total_count > 0 && accountCount < task.total_count) issues.push(`目标账号不足：需要 ${task.total_count} 个，当前只有 ${accountCount} 个`);
  if (task.group_id) { const group=db.prepare('SELECT type FROM groups WHERE id=?').get(task.group_id); if (!group) issues.push('账号分组不存在'); else if (group.type !== 'account') issues.push('任务目标分组不是账号分组'); }
  const boundCount = task.group_id ? db.prepare('SELECT COUNT(*) count FROM accounts WHERE enabled=1 AND group_id=? AND browser_profile_id IS NOT NULL AND browser_profile_id<>\'\'').get(task.group_id).count : db.prepare("SELECT COUNT(*) count FROM accounts WHERE enabled=1 AND browser_profile_id IS NOT NULL AND browser_profile_id<>''").get().count;
  if (['sync','profile','publish','message'].includes(task.type) && boundCount < Math.min(accountCount, task.total_count > 0 ? task.total_count : accountCount)) issues.push(`有 ${accountCount-boundCount} 个启用账号未绑定浏览器环境`);
  const materialIds = Array.isArray(payload.materialIds) ? payload.materialIds.map(Number).filter(Number.isInteger) : [];
  if (task.type === 'publish' && !materialIds.length) issues.push('视频发布任务未关联素材');
  if (materialIds.length) {
    const materials = db.prepare(`SELECT id,name,file_path,status FROM materials WHERE id IN (${materialIds.map(() => '?').join(',')})`).all(...materialIds);
    for (const m of materials) { if (m.status !== 'ready') issues.push(`素材“${m.name}”状态不是可用`); if (!m.file_path || !fs.existsSync(m.file_path)) issues.push(`素材“${m.name}”文件不存在`); }
    if (materials.length !== materialIds.length) issues.push('部分关联素材不存在');
  }
  if (task.type === 'message') { if (!payload.templateId) issues.push('消息任务未关联模板'); else { const t=db.prepare('SELECT enabled FROM message_templates WHERE id=?').get(payload.templateId); if (!t) issues.push('关联消息模板不存在'); else if (!t.enabled) issues.push('关联消息模板已停用'); } }
  return ok(res, { canRun: issues.length === 0, issues });
});

router.post('/:id/message-preview', (req,res)=>{
  const task=db.prepare('SELECT id,type,payload FROM tasks WHERE id=?').get(req.params.id); if(!task)return fail(res,'任务不存在',404); if(task.type!=='message')return fail(res,'只有消息任务支持内容预览',400);
  let payload={};try{payload=JSON.parse(task.payload||'{}')}catch{}; const template=payload.templateId?db.prepare('SELECT name,content,variables,enabled FROM message_templates WHERE id=?').get(payload.templateId):null; if(!template)return fail(res,'消息模板不存在',404);
  const variables=req.body&&typeof req.body.variables==='object'&&req.body.variables?req.body.variables:{}; const rendered=template.content.replace(/\{\{?\s*([a-zA-Z0-9_]+)\s*\}?\}/g,(_,key)=>variables[key]===undefined?`{${key}}`:String(variables[key])); return ok(res,{template:template.name,enabled:Boolean(template.enabled),variables,content:rendered},'消息内容预览生成');
});

router.post('/:id/prepare', (req, res) => {
  const task = db.prepare('SELECT id,name,type,status,total_count FROM tasks WHERE id=?').get(req.params.id);
  if (!task) return fail(res, '任务不存在', 404);
  if (!['publish','message'].includes(task.type)) return fail(res, '只有发布或消息任务需要准备', 400);
  let payload={}; try { payload=JSON.parse(db.prepare('SELECT payload FROM tasks WHERE id=?').get(task.id).payload||'{}'); } catch {}
  const materialIds=Array.isArray(payload.materialIds)?payload.materialIds.map(Number).filter(Number.isInteger):[];
  const materials=materialIds.length?db.prepare(`SELECT id,name,file_name,mime_type,size_bytes,status FROM materials WHERE id IN (${materialIds.map(()=>'?').join(',')})`).all(...materialIds):[];
  const template=payload.templateId?db.prepare('SELECT id,name,enabled FROM message_templates WHERE id=?').get(payload.templateId):null;
  const plan={requiresManualConfirmation:true,materials,template,title:payload.publishTitle||'',content:payload.publishCaption||''};
  const saved=db.prepare('INSERT INTO task_plans(task_id,plan_json) VALUES (?,?)').run(task.id,JSON.stringify(plan));
  db.prepare("INSERT INTO task_events(task_id,level,message) VALUES (?, 'info', ?)").run(task.id, `${task.type==='publish'?'视频发布':'消息发送'}执行方案已生成，等待人工确认`);
  return ok(res,{id:saved.lastInsertRowid,task,plan},'执行方案已生成，实际操作前需要人工确认');
});

router.get('/:id/plans', (req,res)=>{const task=db.prepare('SELECT id FROM tasks WHERE id=?').get(req.params.id);if(!task)return fail(res,'任务不存在',404);return ok(res,db.prepare('SELECT id,status,plan_json,created_at,confirmed_at FROM task_plans WHERE task_id=? ORDER BY id DESC').all(task.id).map(x=>({...x,plan:JSON.parse(x.plan_json||'{}'),plan_json:undefined})));});
router.post('/:id/plans/:planId/confirm', (req,res)=>{const plan=db.prepare('SELECT * FROM task_plans WHERE id=? AND task_id=?').get(req.params.planId,req.params.id);if(!plan)return fail(res,'执行方案不存在',404);if(plan.status!=='prepared')return fail(res,'执行方案当前不能确认',409);db.prepare("UPDATE task_plans SET status='confirmed',confirmed_at=CURRENT_TIMESTAMP WHERE id=?").run(plan.id);db.prepare("INSERT INTO task_events(task_id,level,message) VALUES (?, 'info', '执行方案已人工确认，但实际执行仍受执行器状态保护')").run(req.params.id);return ok(res,{id:plan.id,status:'confirmed'},'方案已确认，等待对应执行器接入');});

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

router.get('/:id/results.csv', (req,res)=>{const task=db.prepare('SELECT id FROM tasks WHERE id=?').get(req.params.id);if(!task)return fail(res,'任务不存在',404);const rows=db.prepare('SELECT r.id,a.username,r.action_type,r.status,r.error_message,r.created_at FROM task_action_results r JOIN accounts a ON a.id=r.account_id WHERE r.task_id=? ORDER BY r.id').all(task.id);const esc=v=>`"${String(v??'').replace(/"/g,'""')}"`;const csv=['ID,账号,动作类型,状态,错误信息,时间',...rows.map(r=>[r.id,r.username,r.action_type,r.status,r.error_message,r.created_at].map(esc).join(','))].join('\\r\\n');res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="task-results.csv"');return res.send('\\ufeff'+csv);});

router.get('/:id/results', (req,res)=>{const task=db.prepare('SELECT id FROM tasks WHERE id=?').get(req.params.id);if(!task)return fail(res,'任务不存在',404);return ok(res,db.prepare(`SELECT r.id,r.account_id,a.username,r.action_type,r.status,r.result_json,r.error_message,r.created_at FROM task_action_results r JOIN accounts a ON a.id=r.account_id WHERE r.task_id=? ORDER BY r.id DESC LIMIT 500`).all(task.id).map(x=>({...x,result:JSON.parse(x.result_json||'{}'),result_json:undefined})));});

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
  if (!['sync', 'profile', 'publish', 'message'].includes(task.type)) return fail(res, '当前任务类型不支持自动重试', 409);
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
  if (!['sync', 'profile', 'publish', 'message'].includes(task.type)) return fail(res, `不支持的任务类型：${task.type}`, 409);
  db.prepare("UPDATE tasks SET status='queued', started_at=COALESCE(started_at,CURRENT_TIMESTAMP), finished_at=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(task.id);
  db.prepare("INSERT INTO task_events(task_id,level,message) VALUES (?, 'info', '任务已进入队列')").run(task.id);
  return ok(res, null, '任务已进入队列');
});

router.post('/:id/pause', (req, res) => {
  const result = db.prepare("UPDATE tasks SET status='paused', updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('queued','running')").run(req.params.id);
  if (!result.changes) return fail(res, '任务不存在或当前不能暂停', 409);
  return ok(res, null, '任务已暂停');
});

router.post('/batch-delete', (req, res) => {
  const ids = Array.isArray(req.body?.taskIds) ? [...new Set(req.body.taskIds.map(Number).filter(Number.isInteger))].slice(0, 100) : [];
  if (!ids.length) return fail(res, '请选择任务', 400);
  const placeholders=ids.map(()=>'?').join(',');
  const result=db.prepare(`DELETE FROM tasks WHERE id IN (${placeholders}) AND status NOT IN ('queued','running')`).run(...ids);
  return ok(res,{requested:ids.length,deleted:result.changes,blocked:ids.length-result.changes},'批量删除完成');
});

router.delete('/:id', (req, res) => {
  const result = db.prepare("DELETE FROM tasks WHERE id=? AND status NOT IN ('queued','running')").run(req.params.id);
  if (!result.changes) return fail(res, '任务不存在或正在运行', 409);
  return ok(res, null, '任务已删除');
});

module.exports = router;
