const express = require('express');
const { z } = require('zod');
const { db } = require('../db');
const { ok, fail } = require('../http');

const router = express.Router();
const schema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(['account', 'proxy', 'message', 'uid']),
  description: z.string().trim().max(300).default(''),
});

router.get('/', (req, res) => {
  const type = req.query.type;
  const rows = type
    ? db.prepare('SELECT * FROM groups WHERE type = ? ORDER BY id DESC').all(type)
    : db.prepare('SELECT * FROM groups ORDER BY type, id DESC').all();
  return ok(res, rows);
});

router.post('/', (req, res) => {
  const body = schema.parse(req.body);
  const result = db.prepare('INSERT INTO groups (name, type, description) VALUES (@name, @type, @description)').run(body);
  return ok(res, db.prepare('SELECT * FROM groups WHERE id = ?').get(result.lastInsertRowid), '分组已创建', 201);
});

router.put('/:id', (req, res) => {
  const body = schema.parse(req.body);
  const result = db.prepare(`UPDATE groups SET name=@name, type=@type, description=@description, updated_at=CURRENT_TIMESTAMP WHERE id=@id`)
    .run({ ...body, id: req.params.id });
  if (!result.changes) return fail(res, '分组不存在', 404);
  return ok(res, db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id), '分组已更新');
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM groups WHERE id = ?').run(req.params.id);
  if (!result.changes) return fail(res, '分组不存在', 404);
  return ok(res, null, '分组已删除');
});

module.exports = router;
