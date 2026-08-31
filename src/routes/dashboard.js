const express = require('express');
const { db } = require('../db');
const { ok } = require('../http');

const router = express.Router();

router.get('/stats', (req, res) => {
  const stats = {
    accounts: db.prepare('SELECT COUNT(*) count FROM accounts').get().count,
    onlineAccounts: db.prepare("SELECT COUNT(*) count FROM accounts WHERE login_status = 'online'").get().count,
    proxies: db.prepare('SELECT COUNT(*) count FROM proxies').get().count,
    availableProxies: db.prepare("SELECT COUNT(*) count FROM proxies WHERE status = 'available'").get().count,
    tasks: db.prepare('SELECT COUNT(*) count FROM tasks').get().count,
    runningTasks: db.prepare("SELECT COUNT(*) count FROM tasks WHERE status IN ('queued','running')").get().count,
  };
  return ok(res, stats);
});

router.get('/activity', (req, res) => {
  const tasks = db.prepare(`
    SELECT id, name, type, status, success_count, fail_count, total_count, created_at, updated_at
    FROM tasks ORDER BY updated_at DESC LIMIT 8
  `).all();
  return ok(res, tasks);
});

module.exports = router;
