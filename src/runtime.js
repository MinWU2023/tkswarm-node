/**
 * 运行时信息：客服端 Node 无本机数据库，业务数据一律 PHP API。
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(root, 'data');
fs.mkdirSync(dataDir, { recursive: true });

function loadApiBase() {
  if (process.env.TKSWARM_API_BASE) {
    return String(process.env.TKSWARM_API_BASE).replace(/\/+$/, '');
  }
  for (const file of [
    path.join(root, 'data', 'api.json'),
    path.join(root, 'config', 'api.json'),
  ]) {
    try {
      if (!fs.existsSync(file)) continue;
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (j?.apiBase) return String(j.apiBase).replace(/\/+$/, '');
    } catch { /* ignore */ }
  }
  return 'http://tkswarm-api.dyyweb.com';
}

const apiBase = loadApiBase();

module.exports = {
  apiBase,
  dataSource: 'php',
  mode: 'php-only',
  dbAvailable: false,
  dbError: 'php-only',
  dataPath: `php-api://${apiBase.replace(/^https?:\/\//, '')}`,
  dataDir,
};
