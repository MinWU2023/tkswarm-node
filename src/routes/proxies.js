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
const batchSchema = z.object({
  content: z.string().trim().min(1).max(1_000_000),
  defaultProtocol: z.enum(['http', 'https', 'socks5']).default('http'),
  groupId: z.union([z.coerce.number().int().positive(), z.null()]).optional().default(null),
  country: z.string().trim().max(50).default(''),
});

function parseProxyLine(source, defaultProtocol) {
  const line = source.trim();
  if (!line || line.startsWith('#')) return null;

  let protocol = defaultProtocol;
  let host;
  let port;
  let username = '';
  let password = '';

  if (line.includes('://')) {
    let url;
    try { url = new URL(line); } catch { throw new Error('URL 格式不正确'); }
    protocol = url.protocol.replace(':', '').toLowerCase();
    if (!['http', 'https', 'socks5'].includes(protocol)) throw new Error('不支持的代理协议');
    host = url.hostname.replace(/^\[|\]$/g, '');
    port = Number(url.port);
    username = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
  } else if (line.includes('@')) {
    const at = line.lastIndexOf('@');
    const auth = line.slice(0, at).split(':');
    const address = line.slice(at + 1).split(':');
    if (auth.length < 2 || address.length !== 2) throw new Error('认证代理格式应为 用户名:密码@主机:端口');
    username = auth.shift();
    password = auth.join(':');
    [host, port] = address;
  } else {
    const separator = line.includes('|') ? '|' : line.includes(',') ? ',' : ':';
    const parts = line.split(separator).map(value => value.trim());
    if (parts.length === 2) [host, port] = parts;
    else if (parts.length === 4) [host, port, username, password] = parts;
    else throw new Error('支持 主机:端口 或 主机:端口:用户名:密码');
  }

  host = String(host || '').trim();
  port = Number(port);
  if (!host) throw new Error('主机不能为空');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('端口必须在 1-65535 之间');
  if (username.length > 100 || password.length > 200) throw new Error('认证信息过长');
  return { protocol, host, port, username, password };
}

router.get('/', (req, res) => {
  const { page, pageSize, offset } = pagination(req.query);
  const filters = [];
  const params = {};
  if (req.query.keyword) { filters.push('(p.name LIKE @keyword OR p.host LIKE @keyword)'); params.keyword = `%${req.query.keyword}%`; }
  if (req.query.status) { filters.push('p.status = @status'); params.status = req.query.status; }
  if (req.query.groupId === 'none') filters.push('p.group_id IS NULL');
  else if (req.query.groupId) { filters.push('p.group_id = @groupId'); params.groupId = req.query.groupId; }
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

router.post('/batch-import', (req, res) => {
  const body = batchSchema.parse(req.body);
  const lines = body.content.split(/\r?\n/);
  if (lines.length > 10_000) return fail(res, '单次最多导入 10000 行', 422);

  const insert = db.prepare(`INSERT OR IGNORE INTO proxies
    (name,protocol,host,port,username,password,country,group_id)
    VALUES (@name,@protocol,@host,@port,@username,@password,@country,@groupId)`);
  const result = { total: 0, imported: 0, duplicates: 0, ignored: 0, errors: [] };

  db.transaction(() => {
    lines.forEach((source, index) => {
      try {
        const proxy = parseProxyLine(source, body.defaultProtocol);
        if (!proxy) { result.ignored += 1; return; }
        result.total += 1;
        const write = insert.run({
          ...proxy,
          name: `${proxy.host}:${proxy.port}`.slice(0, 100),
          country: body.country,
          groupId: body.groupId,
        });
        if (write.changes) result.imported += 1;
        else result.duplicates += 1;
      } catch (error) {
        result.total += 1;
        if (result.errors.length < 100) result.errors.push({ line: index + 1, reason: error.message });
      }
    });
  })();

  return ok(res, result, `导入完成：成功 ${result.imported}，重复 ${result.duplicates}，错误 ${result.errors.length}`);
});

router.post('/batch-move', (req, res) => {
  const body = z.object({
    proxyIds: z.array(z.coerce.number().int().positive()).min(1).max(1000),
    groupId: z.union([z.coerce.number().int().positive(), z.null()]),
  }).parse(req.body);
  const ids = [...new Set(body.proxyIds)];
  if (body.groupId) {
    const group = db.prepare("SELECT id FROM groups WHERE id=? AND type='proxy'").get(body.groupId);
    if (!group) return fail(res, '目标代理分组不存在', 422);
  }
  const placeholders = ids.map(() => '?').join(',');
  const result = db.prepare(`UPDATE proxies SET group_id=?, updated_at=CURRENT_TIMESTAMP WHERE id IN (${placeholders})`)
    .run(body.groupId, ...ids);
  return ok(res, { requested: ids.length, moved: result.changes, notFound: ids.length - result.changes }, '代理分组已更新');
});

router.post('/batch-delete', (req, res) => {
  const body = z.object({ proxyIds: z.array(z.coerce.number().int().positive()).min(1).max(1000) }).parse(req.body);
  const ids = [...new Set(body.proxyIds)];
  const placeholders = ids.map(() => '?').join(',');
  const existing = db.prepare(`SELECT id FROM proxies WHERE id IN (${placeholders})`).all(...ids).map(row => row.id);
  if (!existing.length) return fail(res, '没有找到要删除的代理', 404);
  const existingPlaceholders = existing.map(() => '?').join(',');
  const affectedAccounts = db.prepare(`SELECT COUNT(*) count FROM accounts WHERE proxy_id IN (${existingPlaceholders})`).get(...existing).count;
  db.prepare(`DELETE FROM proxies WHERE id IN (${existingPlaceholders})`).run(...existing);
  return ok(res, {
    requested: ids.length,
    deleted: existing.length,
    notFound: ids.length - existing.length,
    unboundAccounts: affectedAccounts,
  }, '批量删除完成');
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
