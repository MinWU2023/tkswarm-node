const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const root = path.resolve(__dirname, '..');
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(root, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.join(dataDir, 'tkswarm.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

function seed() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM groups').get().count;
  if (count > 0) return;

  const insert = db.prepare('INSERT INTO groups (name, type, description) VALUES (?, ?, ?)');
  const transaction = db.transaction(() => {
    insert.run('默认账号组', 'account', '新账号的默认分组');
    insert.run('默认代理组', 'proxy', '新代理的默认分组');
    insert.run('默认消息组', 'message', '消息模板默认分组');
  });
  transaction();
}

seed();

module.exports = { db, dbPath };
