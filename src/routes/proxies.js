const express = require('express');
const net = require('node:net');
const { z } = require('zod');
const { db } = require('../db');
const { ok, fail, pagination, listResult } = require('../http');

const router = express.Router();
const schema = z.object({
  name: z.string().trim().min(1).max(100),
  protocol: z.enum(['http', 'https', 'socks5']).default('http'),
  host: z.string().trim().min(1).max(255),
  port: z.coerce.number().int().min(1).max(65535),
  username: z.string().trim().max(100).default(''),
  password: z.string().max(200).default(''),
  country: z.string().trim().max(50).default(''),
  groupId: z.union([z.coerce.number().int().positive(), z.null()]).optional().default(null),
});

router.get('/', (req, res) => {
  const { page, pageSize, offset } = pagination(req.query);
  const filters = [];
  const params = {};
  if (req.query.keyword) { filters.push('(p.name LIKE @keyword OR p.host LIKE @keyword)'); params.keyword = `%${req.query.keyword}%`; }
  if (req.query.status) { filters.push('p.status = @status'); params.status = req.query.status; }
  const where = filters.length ? ` WHERE ${filters.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) count FROM proxies p${where}`).get(params).count;
  const rows = db.prepare(`SELECT p.*, g.name group_name FROM proxies p LEFT JOIN groups g ON g.id=p.group_id${where} ORDER BY p.id DESC LIMIT @pageSize OFFSET @offset`)
    .all({ ...params, pageSize, offset }).map(({ password, ...row }) => ({ ...row, hasPassword: Boolean(password) }));
  return ok(res, listResult(rows, total, page, pageSize));
});

router.post('/', (req, res) => {
  const b = schema.parse(req.body);
  const result = db.prepare(`INSERT INTO proxies (name,protocol,host,port,username,password,country,group_id)
    VALUES (@name,@protocol,@host,@port,@username,@password,@country,@groupId)`).run(b);
  return ok(res, { id: result.lastInsertRowid, ...b, password: undefined }, '代理已创建', 201);
});

router.put('/:id', (req, res) => {
  const b = schema.parse(req.body);
  const result = db.prepare(`UPDATE proxies SET name=@name,protocol=@protocol,host=@host,port=@port,username=@username,
    password=@password,country=@country,group_id=@groupId,updated_at=CURRENT_TIMESTAMP WHERE id=@id`).run({ ...b, id: req.params.id });
  if (!result.changes) return fail(res, '代理不存在', 404);
  return ok(res, null, '代理已更新');
});

router.post('/:id/test', async (req, res) => {
  const proxy = db.prepare('SELECT * FROM proxies WHERE id = ?').get(req.params.id);
  if (!proxy) return fail(res, '代理不存在', 404);
  const started = Date.now();
  const available = await new Promise((resolve) => {
    const socket = net.createConnection({ host: proxy.host, port: proxy.port });
    const timer = setTimeout(() => { socket.destroy(); resolve(false); }, 5000);
    socket.once('connect', () => { clearTimeout(timer); socket.destroy(); resolve(true); });
    socket.once('error', () => { clearTimeout(timer); resolve(false); });
  });
  const latency = available ? Date.now() - started : null;
  db.prepare(`UPDATE proxies SET status=?, latency_ms=?, last_checked_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(available ? 'available' : 'unavailable', latency, proxy.id);
  return ok(res, { available, latencyMs: latency }, available ? '代理端口可连接' : '代理端口连接失败');
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM proxies WHERE id = ?').run(req.params.id);
  if (!result.changes) return fail(res, '代理不存在', 404);
  return ok(res, null, '代理已删除');
});

module.exports = router;
