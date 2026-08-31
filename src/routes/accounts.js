const express = require('express');
const { z } = require('zod');
const { db } = require('../db');
const { ok, fail, pagination, listResult } = require('../http');

const router = express.Router();
const optionalId = z.union([z.coerce.number().int().positive(), z.null()]).optional().default(null);
const schema = z.object({
  username: z.string().trim().min(1).max(100),
  nickname: z.string().trim().max(100).default(''),
  country: z.string().trim().max(50).default(''),
  groupId: optionalId,
  proxyId: optionalId,
  browserType: z.string().trim().min(1).max(30).default('bit'),
  browserProfileId: z.string().trim().max(150).default(''),
  loginStatus: z.enum(['offline', 'online', 'expired', 'checking']).default('offline'),
  chatStatus: z.enum(['offline', 'online', 'error']).default('offline'),
  enabled: z.boolean().default(true),
  notes: z.string().trim().max(500).default(''),
});

const selectSql = `
  SELECT a.*, g.name AS group_name, p.name AS proxy_name,
         CASE WHEN p.host IS NULL THEN '' ELSE p.protocol || '://' || p.host || ':' || p.port END AS proxy_address
  FROM accounts a
  LEFT JOIN groups g ON g.id = a.group_id
  LEFT JOIN proxies p ON p.id = a.proxy_id`;

router.get('/', (req, res) => {
  const { page, pageSize, offset } = pagination(req.query);
  const filters = [];
  const params = {};
  if (req.query.keyword) {
    filters.push('(a.username LIKE @keyword OR a.nickname LIKE @keyword)');
    params.keyword = `%${req.query.keyword}%`;
  }
  if (req.query.groupId) { filters.push('a.group_id = @groupId'); params.groupId = req.query.groupId; }
  if (req.query.status) { filters.push('a.login_status = @status'); params.status = req.query.status; }
  const where = filters.length ? ` WHERE ${filters.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) count FROM accounts a${where}`).get(params).count;
  const rows = db.prepare(`${selectSql}${where} ORDER BY a.id DESC LIMIT @pageSize OFFSET @offset`)
    .all({ ...params, pageSize, offset });
  return ok(res, listResult(rows, total, page, pageSize));
});

router.get('/:id', (req, res) => {
  const row = db.prepare(`${selectSql} WHERE a.id = ?`).get(req.params.id);
  return row ? ok(res, row) : fail(res, '账号不存在', 404);
});

router.post('/', (req, res) => {
  const b = schema.parse(req.body);
  const result = db.prepare(`
    INSERT INTO accounts (username,nickname,country,group_id,proxy_id,browser_type,browser_profile_id,login_status,chat_status,enabled,notes)
    VALUES (@username,@nickname,@country,@groupId,@proxyId,@browserType,@browserProfileId,@loginStatus,@chatStatus,@enabled,@notes)
  `).run({ ...b, enabled: b.enabled ? 1 : 0 });
  return ok(res, db.prepare(`${selectSql} WHERE a.id = ?`).get(result.lastInsertRowid), '账号已创建', 201);
});

router.put('/:id', (req, res) => {
  const b = schema.parse(req.body);
  const result = db.prepare(`
    UPDATE accounts SET username=@username,nickname=@nickname,country=@country,group_id=@groupId,proxy_id=@proxyId,
      browser_type=@browserType,browser_profile_id=@browserProfileId,login_status=@loginStatus,chat_status=@chatStatus,
      enabled=@enabled,notes=@notes,updated_at=CURRENT_TIMESTAMP WHERE id=@id
  `).run({ ...b, enabled: b.enabled ? 1 : 0, id: req.params.id });
  if (!result.changes) return fail(res, '账号不存在', 404);
  return ok(res, db.prepare(`${selectSql} WHERE a.id = ?`).get(req.params.id), '账号已更新');
});

router.patch('/:id/status', (req, res) => {
  const body = z.object({ loginStatus: z.enum(['offline', 'online', 'expired', 'checking']) }).parse(req.body);
  const result = db.prepare('UPDATE accounts SET login_status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(body.loginStatus, req.params.id);
  if (!result.changes) return fail(res, '账号不存在', 404);
  return ok(res, null, '账号状态已更新');
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
  if (!result.changes) return fail(res, '账号不存在', 404);
  return ok(res, null, '账号已删除');
});

module.exports = router;
