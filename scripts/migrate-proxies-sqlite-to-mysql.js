/**
 * 一次性：从本地 SQLite(tkswarm.db) 导入 proxies（及 proxy 分组）到 MySQL。
 * 用法: node scripts/migrate-proxies-sqlite-to-mysql.js
 */
const fs = require('node:fs');
const path = require('node:path');
const initSqlJs = require('sql.js');
const mysql = require('mysql2/promise');

const root = path.resolve(__dirname, '..');
const sqlitePath = path.join(root, 'data', 'tkswarm.db');
const repoRoot = path.resolve(root, '..');

// 与 PHP SecretStore 默认路径对齐：项目根 data/.secret-key
const phpKeyPath = path.join(repoRoot, 'data', '.secret-key');
const nodeKeyPath = path.join(root, 'data', '.secret-key');

function loadMysqlConfig() {
  const env = {
    host: process.env.MYSQL_HOST,
    port: process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : undefined,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  };
  if (env.host && env.user && env.database && env.password !== undefined) {
    return {
      host: env.host,
      port: env.port || 3306,
      user: env.user,
      password: env.password,
      database: env.database,
    };
  }
  const apiDb = path.join(repoRoot, 'tkswarm-api', 'config', 'database.php');
  const text = fs.readFileSync(apiDb, 'utf8');
  const grab = (k, def = '') => {
    const m = text.match(new RegExp(`'${k}'\\s*=>\\s*'([^']*)'`));
    return m ? m[1] : def;
  };
  return {
    host: env.host || grab('host', '127.0.0.1'),
    port: env.port || Number(grab('port', '3306')) || 3306,
    user: env.user || grab('username', 'root'),
    password: env.password !== undefined ? env.password : grab('password', ''),
    database: env.database || grab('database', 'tkswarm-api'),
  };
}

function ensurePhpKey() {
  fs.mkdirSync(path.dirname(phpKeyPath), { recursive: true });
  if (!fs.existsSync(phpKeyPath) && fs.existsSync(nodeKeyPath)) {
    fs.copyFileSync(nodeKeyPath, phpKeyPath);
    console.log('[INFO] 已复制 Node 密钥到', phpKeyPath);
  }
  if (!fs.existsSync(phpKeyPath)) {
    throw new Error(`缺少密钥文件：${phpKeyPath}（或 ${nodeKeyPath}）`);
  }
  // 让 secret-store 用 PHP 同一把钥匙重加密
  process.env.SECRET_KEY_PATH = phpKeyPath;
}

async function main() {
  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`找不到 SQLite：${sqlitePath}`);
  }
  ensurePhpKey();
  const { encrypt, decrypt } = require('../src/services/secret-store');

  const SQL = await initSqlJs();
  const file = fs.readFileSync(sqlitePath);
  const db = new SQL.Database(file);

  const tableInfo = db.exec('PRAGMA table_info(proxies)');
  const cols = (tableInfo[0]?.values || []).map((r) => r[1]);
  console.log('[INFO] proxies 列:', cols.join(', '));

  const hasEnc = cols.includes('password_encrypted');
  const hasEgress = cols.includes('egress_ip');

  const proxyRows = db.exec(`
    SELECT id, name, protocol, host, port, username, password,
           ${hasEnc ? 'password_encrypted' : "'' AS password_encrypted"},
           country, group_id, status, latency_ms, last_checked_at
           ${hasEgress ? ', egress_ip' : ", '' AS egress_ip"}
    FROM proxies ORDER BY id
  `);
  const proxies = [];
  if (proxyRows[0]) {
    const names = proxyRows[0].columns;
    for (const values of proxyRows[0].values) {
      const row = {};
      names.forEach((n, i) => { row[n] = values[i]; });
      proxies.push(row);
    }
  }

  const groupRows = db.exec(`SELECT id, name, type, description FROM groups WHERE type='proxy' ORDER BY id`);
  const groups = [];
  if (groupRows[0]) {
    const names = groupRows[0].columns;
    for (const values of groupRows[0].values) {
      const row = {};
      names.forEach((n, i) => { row[n] = values[i]; });
      groups.push(row);
    }
  }

  console.log(`[INFO] SQLite 代理分组 ${groups.length}，代理 ${proxies.length}`);

  const cfg = loadMysqlConfig();
  console.log(`[INFO] MySQL ${cfg.host}:${cfg.port}/${cfg.database}`);
  const conn = await mysql.createConnection(cfg);

  // 确保关键列存在
  const [proxyCols] = await conn.query('SHOW COLUMNS FROM proxies');
  const pcols = new Set(proxyCols.map((c) => c.Field));
  if (!pcols.has('owner_id')) {
    await conn.query('ALTER TABLE proxies ADD COLUMN owner_id INT NULL DEFAULT NULL');
  }
  if (!pcols.has('password_encrypted')) {
    await conn.query('ALTER TABLE proxies ADD COLUMN password_encrypted TEXT NULL');
  }
  if (!pcols.has('egress_ip')) {
    try { await conn.query('ALTER TABLE proxies ADD COLUMN egress_ip VARCHAR(64) NULL'); } catch { /* ignore */ }
  }

  const [groupCols] = await conn.query('SHOW COLUMNS FROM `groups`');
  const gcols = new Set(groupCols.map((c) => c.Field));
  if (!gcols.has('owner_id')) {
    await conn.query('ALTER TABLE `groups` ADD COLUMN owner_id INT NULL DEFAULT NULL');
  }

  // owner：优先超管 id=1
  let ownerId = 1;
  try {
    const [admins] = await conn.query('SELECT id FROM admin_users WHERE status=1 ORDER BY id LIMIT 1');
    if (admins[0]?.id) ownerId = Number(admins[0].id);
  } catch { /* ignore */ }

  const groupIdMap = new Map(); // sqlite group_id -> mysql group_id
  let groupsInserted = 0;
  for (const g of groups) {
    const [exist] = await conn.query(
      'SELECT id FROM `groups` WHERE name=? AND type=? LIMIT 1',
      [g.name, 'proxy']
    );
    if (exist[0]) {
      groupIdMap.set(Number(g.id), Number(exist[0].id));
      continue;
    }
    const [r] = await conn.query(
      'INSERT INTO `groups`(name, type, description, owner_id) VALUES (?,?,?,?)',
      [g.name, 'proxy', g.description || '', ownerId]
    );
    groupIdMap.set(Number(g.id), Number(r.insertId));
    groupsInserted += 1;
  }

  let inserted = 0;
  let skipped = 0;
  let failed = 0;
  const errors = [];

  for (const p of proxies) {
    const protocol = String(p.protocol || 'http').toLowerCase();
    const host = String(p.host || '').trim();
    const port = Number(p.port) || 0;
    const username = String(p.username || '');
    if (!host || port < 1) {
      skipped += 1;
      continue;
    }

    let plain = '';
    if (p.password_encrypted) {
      try { plain = decrypt(String(p.password_encrypted)); } catch { plain = ''; }
    }
    if (!plain && p.password) plain = String(p.password);

    const enc = plain ? encrypt(plain) : '';
    const mysqlGroupId = p.group_id != null && groupIdMap.has(Number(p.group_id))
      ? groupIdMap.get(Number(p.group_id))
      : null;

    try {
      const [dup] = await conn.query(
        'SELECT id FROM proxies WHERE protocol=? AND host=? AND port=? AND username=? LIMIT 1',
        [protocol, host, port, username]
      );
      if (dup[0]) {
        // 更新密码/国家/状态（不重复插入）
        await conn.query(
          `UPDATE proxies SET name=?, password='', password_encrypted=?, country=?, group_id=COALESCE(?, group_id),
           status=?, latency_ms=?, last_checked_at=?, owner_id=COALESCE(owner_id, ?), updated_at=CURRENT_TIMESTAMP
           WHERE id=?`,
          [
            p.name || `${protocol}://${host}:${port}`,
            enc,
            p.country || '',
            mysqlGroupId,
            p.status || 'unchecked',
            p.latency_ms ?? null,
            p.last_checked_at || null,
            ownerId,
            dup[0].id,
          ]
        );
        skipped += 1;
        continue;
      }

      await conn.query(
        `INSERT INTO proxies(name, protocol, host, port, username, password, password_encrypted, country, group_id, status, latency_ms, last_checked_at, owner_id)
         VALUES (?,?,?,?,?,'',?,?,?,?,?,?,?)`,
        [
          p.name || `${protocol}://${host}:${port}`,
          protocol,
          host,
          port,
          username,
          enc,
          p.country || '',
          mysqlGroupId,
          ['unchecked', 'available', 'unavailable'].includes(p.status) ? p.status : 'unchecked',
          p.latency_ms ?? null,
          p.last_checked_at || null,
          ownerId,
        ]
      );
      inserted += 1;
    } catch (e) {
      failed += 1;
      if (errors.length < 15) errors.push(`#${p.id} ${host}:${port} → ${e.message}`);
    }
  }

  const [[{ c: mysqlCount }]] = await conn.query('SELECT COUNT(*) AS c FROM proxies');
  await conn.end();
  db.close();

  console.log(JSON.stringify({
    sqliteProxies: proxies.length,
    sqliteProxyGroups: groups.length,
    groupsInserted,
    proxiesInserted: inserted,
    proxiesUpdatedOrSkipped: skipped,
    failed,
    mysqlProxiesTotal: mysqlCount,
    ownerId,
    errors,
  }, null, 2));
}

main().catch((e) => {
  console.error('[FATAL]', e.message || e);
  process.exit(1);
});
