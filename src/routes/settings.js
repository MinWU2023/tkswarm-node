const express = require('express');
const { z } = require('zod');
const { db } = require('../db');
const { ok } = require('../http');

const router = express.Router();
const defaults = {
  browserType: 'bit',
  browserApiUrl: 'http://127.0.0.1:54345',
  useSystemProxy: true,
  messageSyncInterval: 10,
  language: 'zh-CN',
};

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const stored = Object.fromEntries(rows.map(row => {
    try { return [row.key, JSON.parse(row.value)]; } catch { return [row.key, row.value]; }
  }));
  return ok(res, { ...defaults, ...stored });
});

router.put('/', (req, res) => {
  const body = z.record(z.string(), z.unknown()).parse(req.body);
  const upsert = db.prepare(`INSERT INTO settings (key,value) VALUES (?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`);
  db.transaction(() => Object.entries(body).forEach(([key, value]) => upsert.run(key, JSON.stringify(value))))();
  return ok(res, body, '设置已保存');
});

module.exports = router;
