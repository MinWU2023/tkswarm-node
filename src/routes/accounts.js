const express = require('express');
const { z } = require('zod');
const { db } = require('../db');
const { ok, fail, pagination, listResult } = require('../http');
const { encrypt } = require('../services/secret-store');

const router = express.Router();
const optionalId = z.union([z.coerce.number().int().positive(), z.null()]).optional().default(null);
const batchSchema = z.object({
  content: z.string().trim().min(1).max(2_000_000),
  groupId: z.union([z.coerce.number().int().positive(), z.null()]).optional().default(null),
  proxyId: z.union([z.coerce.number().int().positive(), z.null()]).optional().default(null),
  browserType: z.string().trim().min(1).max(30).default('bit'),
  country: z.string().trim().max(50).default(''),
});
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

router.post('/batch-import', (req, res) => {
  const body = batchSchema.parse(req.body);
  const lines = body.content.split(/\r?\n/);
  if (lines.length > 20_000) return fail(res, '单次最多导入 20000 行', 422);

  const insertAccount = db.prepare(`INSERT OR IGNORE INTO accounts
    (username,country,group_id,proxy_id,browser_type,login_status,chat_status,enabled)
    VALUES (@username,@country,@groupId,@proxyId,@browserType,'offline','offline',1)`);
  const insertSecrets = db.prepare(`INSERT INTO account_secrets (account_id,password_encrypted,totp_secret_encrypted)
    VALUES (?,?,?)`);
  const result = { total: 0, imported: 0, duplicates: 0, ignored: 0, errors: [] };

  db.transaction(() => {
    lines.forEach((source, index) => {
      const line = source.trim();
      if (!line || line.startsWith('#')) { result.ignored += 1; return; }
      result.total += 1;
      try {
        const first = line.indexOf('----');
        const last = line.lastIndexOf('----');
        if (first <= 0 || last <= first) throw new Error('格式应为 账号----密码----2FA密钥');
        const username = line.slice(0, first).trim();
        const password = line.slice(first + 4, last);
        const totpSecret = line.slice(last + 4).replace(/\s+/g, '').toUpperCase();
        if (!username || username.length > 100) throw new Error('账号不能为空且不能超过 100 个字符');
        if (!password || password.length > 500) throw new Error('密码不能为空且不能超过 500 个字符');
        if (!/^[A-Z2-7]+=*$/.test(totpSecret) || totpSecret.length < 16 || totpSecret.length > 256) {
          throw new Error('2FA 密钥不是有效的 Base32 格式');
        }
        const account = insertAccount.run({ username, country: body.country, groupId: body.groupId, proxyId: body.proxyId, browserType: body.browserType });
        if (!account.changes) { result.duplicates += 1; return; }
        insertSecrets.run(account.lastInsertRowid, encrypt(password), encrypt(totpSecret));
        result.imported += 1;
      } catch (error) {
        if (result.errors.length < 100) result.errors.push({ line: index + 1, reason: error.message });
      }
    });
  })();

  return ok(res, result, `导入完成：成功 ${result.imported}，重复 ${result.duplicates}，错误 ${result.errors.length}`);
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
