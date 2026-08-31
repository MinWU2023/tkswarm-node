const express = require('express');
const { z } = require('zod');
const { db } = require('../db');
const { ok, fail } = require('../http');
const { BitBrowserProvider } = require('../services/browser/bit-browser-provider');

const router = express.Router();

router.get('/status', async (req, res) => {
  const provider = new BitBrowserProvider();
  try {
    const message = await provider.health();
    return ok(res, { online: true, provider: 'bit', apiUrl: provider.baseUrl, message });
  } catch (error) {
    return ok(res, { online: false, provider: 'bit', apiUrl: provider.baseUrl, message: error.message });
  }
});

router.get('/groups', async (req, res) => {
  const provider = new BitBrowserProvider();
  const data = await provider.groups(Number(req.query.page || 0), Math.min(100, Number(req.query.pageSize || 100)));
  return ok(res, data);
});

router.get('/profiles', async (req, res) => {
  const provider = new BitBrowserProvider();
  const data = await provider.profiles(Number(req.query.page || 0), Math.min(100, Number(req.query.pageSize || 100)), String(req.query.keyword || ''));
  const bindings = new Map(db.prepare(`SELECT browser_profile_id, id, username, nickname FROM accounts
    WHERE browser_type='bit' AND browser_profile_id <> ''`).all().map(row => [row.browser_profile_id, row]));
  const list = (data.list || []).map(profile => ({ ...provider.sanitizeProfile(profile), account: bindings.get(profile.id) || null }));
  return ok(res, { page: data.page, pageSize: data.pageSize, total: data.totalNum ?? list.length, items: list });
});

router.post('/profiles/:id/open', async (req, res) => {
  const provider = new BitBrowserProvider();
  const data = await provider.open(req.params.id);
  const safe = data && typeof data === 'object' ? {
    ws: data.ws,
    http: data.http,
    pid: data.pid,
    name: data.name,
    seq: data.seq,
    coreVersion: data.coreVersion,
  } : data;
  return ok(res, safe, '浏览器环境已打开');
});

router.post('/profiles/:id/close', async (req, res) => {
  const provider = new BitBrowserProvider();
  const data = await provider.close(req.params.id);
  return ok(res, data, '浏览器环境已关闭');
});

router.post('/bind', (req, res) => {
  const body = z.object({
    accountId: z.coerce.number().int().positive(),
    profileId: z.string().trim().min(1).max(100),
  }).parse(req.body);
  const occupied = db.prepare(`SELECT id, username FROM accounts WHERE browser_type='bit' AND browser_profile_id=? AND id<>?`)
    .get(body.profileId, body.accountId);
  if (occupied) return fail(res, `该环境已绑定账号 ${occupied.username}`, 409);
  const result = db.prepare(`UPDATE accounts SET browser_type='bit', browser_profile_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(body.profileId, body.accountId);
  if (!result.changes) return fail(res, '账号不存在', 404);
  return ok(res, null, '浏览器环境已绑定');
});

router.post('/unbind', (req, res) => {
  const body = z.object({ accountId: z.coerce.number().int().positive() }).parse(req.body);
  const result = db.prepare("UPDATE accounts SET browser_profile_id='', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(body.accountId);
  if (!result.changes) return fail(res, '账号不存在', 404);
  return ok(res, null, '已解除浏览器环境绑定');
});

module.exports = router;
