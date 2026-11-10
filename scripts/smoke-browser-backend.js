#!/usr/bin/env node
/**
 * Node 双后端冒烟：探测本机浏览器 API health，验证 detectFromHealth / getProviderAsync。
 *
 * 用法（在 tkswarm-node 目录）：
 *   node scripts/smoke-browser-backend.js
 *   node scripts/smoke-browser-backend.js --url http://127.0.0.1:54345
 */
const path = require('node:path');
const fs = require('node:fs');

process.chdir(path.join(__dirname, '..'));

async function probeHealth(baseUrl) {
  const url = `${String(baseUrl).replace(/\/+$/, '')}/health`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: ctrl.signal,
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok || json?.success === true, json, status: res.status };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    clearTimeout(t);
  }
}

function writeLocalSetting(key, value) {
  const file = path.resolve(__dirname, '../data/local-settings.json');
  const j = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) || {} : {};
  j[key] = value;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(j, null, 2));
}

async function main() {
  const args = process.argv.slice(2);
  let baseUrl = 'http://127.0.0.1:54345';
  const i = args.indexOf('--url');
  if (i >= 0 && args[i + 1]) baseUrl = args[i + 1];

  console.log('Probe', baseUrl);
  const health = await probeHealth(baseUrl);
  if (!health.ok) {
    console.log('[FAIL] health unreachable:', health.error || health.status);
    console.log('提示：请先启动比特或第一页自研浏览器（本地 API 54345）后再跑本脚本。');
    process.exit(2);
  }

  const payload = health.json?.data || health.json || {};
  console.log('[OK] health', JSON.stringify(payload));

  const {
    detectFromHealth,
    labelFor,
    getProviderAsync,
    clearBackendCache,
    getCachedBackend,
  } = require('../src/services/browser/providers');

  const detected = detectFromHealth(payload);
  console.log('[OK] detectFromHealth =', detected, `(${labelFor(detected)})`);

  // 临时指向探测地址 + auto，验证工厂缓存
  writeLocalSetting('browserApiUrl', baseUrl);
  writeLocalSetting('browserBackend', 'auto');
  clearBackendCache();

  try {
    const provider = await getProviderAsync('auto');
    const cached = getCachedBackend();
    console.log('[OK] getProviderAsync(auto) backendId=', provider.backendId, 'label=', provider.backendLabel);
    console.log('[OK] cached', JSON.stringify(cached));
    if (detected === 'tkswarm' && provider.backendId !== 'tkswarm') {
      console.log('[FAIL] expected tkswarm provider after health');
      process.exit(1);
    }
    if (detected === 'bit' && provider.backendId !== 'bit') {
      console.log('[WARN] detected bit but provider.backendId=', provider.backendId);
    }
  } catch (e) {
    console.log('[WARN] getProviderAsync:', e.message);
  }

  // 强制 bit / tkswarm 均可构造
  clearBackendCache();
  const pBit = await getProviderAsync('bit');
  const pTk = await getProviderAsync('tkswarm');
  console.log('[OK] force bit →', pBit.backendId, pBit.backendLabel);
  console.log('[OK] force tkswarm →', pTk.backendId, pTk.backendLabel);

  console.log('\nSmoke browser-backend OK');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
