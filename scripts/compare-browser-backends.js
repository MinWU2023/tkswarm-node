#!/usr/bin/env node
/**
 * Phase D 双轨对比：对同一套本地 API 分别以 bit / tkswarm 配置探测，
 * 并可选跑 create → open(headless) → close 生命周期（需对应后端在线）。
 *
 * 用法：
 *   node scripts/compare-browser-backends.js
 *   node scripts/compare-browser-backends.js --url http://127.0.0.1:54345
 *   node scripts/compare-browser-backends.js --lifecycle   # 含 open/close（需登录且可开 Chrome）
 *
 * 输出 JSON 报告到 stdout，并写 data/browser-backend-compare-*.json
 */
const fs = require('node:fs');
const path = require('node:path');

process.chdir(path.join(__dirname, '..'));

const args = process.argv.slice(2);
const urlIdx = args.indexOf('--url');
const baseUrl = urlIdx >= 0 && args[urlIdx + 1]
  ? args[urlIdx + 1]
  : 'http://127.0.0.1:54345';
const doLifecycle = args.includes('--lifecycle');

function writeLocalSetting(key, value) {
  const file = path.resolve(__dirname, '../data/local-settings.json');
  const j = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) || {} : {};
  j[key] = value;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(j, null, 2));
}

async function probeHealth(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(`${url.replace(/\/+$/, '')}/health`, {
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

async function runBackend(backend) {
  const {
    getProviderAsync,
    clearBackendCache,
    detectFromHealth,
    labelFor,
  } = require('../src/services/browser/providers');

  writeLocalSetting('browserApiUrl', baseUrl);
  writeLocalSetting('browserBackend', backend);
  clearBackendCache();

  const row = {
    backend,
    label: labelFor(backend === 'auto' ? 'auto' : backend),
    healthOk: false,
    detected: '',
    listOk: false,
    listCount: 0,
    createOk: false,
    openOk: false,
    closeOk: false,
    deleteOk: false,
    errors: [],
    ms: {},
  };

  const t0 = Date.now();
  const health = await probeHealth(baseUrl);
  row.ms.health = Date.now() - t0;
  row.healthOk = !!health.ok;
  if (!health.ok) {
    row.errors.push(health.error || `HTTP ${health.status}`);
    return row;
  }
  const payload = health.json?.data || health.json || {};
  row.detected = detectFromHealth(payload);
  row.provider = payload.provider || '';
  row.loggedIn = !!payload.loggedIn;

  let provider;
  try {
    provider = await getProviderAsync(backend);
    row.providerBackendId = provider.backendId;
    row.providerLabel = provider.backendLabel;
  } catch (e) {
    row.errors.push('getProvider: ' + e.message);
    return row;
  }

  const tList = Date.now();
  try {
    const list = await provider.profiles(0, 10);
    row.listOk = true;
    row.listCount = Number(list?.totalNum ?? list?.list?.length ?? 0);
  } catch (e) {
    row.errors.push('list: ' + e.message);
  }
  row.ms.list = Date.now() - tList;

  if (!doLifecycle) return row;

  let profileId = '';
  const tCreate = Date.now();
  try {
    const created = await provider.create({
      name: `compare-${backend}-${Date.now()}`,
      remark: 'dual-track-compare',
      proxyType: 'noproxy',
    });
    profileId = String(created?.id || '');
    row.createOk = !!profileId;
    if (!profileId) row.errors.push('create: no id');
  } catch (e) {
    row.errors.push('create: ' + e.message);
  }
  row.ms.create = Date.now() - tCreate;

  if (profileId) {
    const tOpen = Date.now();
    try {
      const opened = await provider.open(profileId, { headless: true });
      row.openOk = !!(opened?.ws || opened?.http);
      if (!row.openOk) row.errors.push('open: no ws');
    } catch (e) {
      row.errors.push('open: ' + e.message);
    }
    row.ms.open = Date.now() - tOpen;

    const tClose = Date.now();
    try {
      await provider.close(profileId);
      row.closeOk = true;
    } catch (e) {
      row.errors.push('close: ' + e.message);
    }
    row.ms.close = Date.now() - tClose;

    try {
      await provider.delete(profileId);
      row.deleteOk = true;
    } catch (e) {
      row.errors.push('delete: ' + e.message);
    }
  }

  return row;
}

function score(row) {
  let n = 0;
  if (row.healthOk) n += 1;
  if (row.listOk) n += 1;
  if (!doLifecycle) return n;
  if (row.createOk) n += 1;
  if (row.openOk) n += 1;
  if (row.closeOk) n += 1;
  return n;
}

async function main() {
  console.log('Compare backends at', baseUrl, doLifecycle ? '(with lifecycle)' : '(health+list only)');
  const health = await probeHealth(baseUrl);
  if (!health.ok) {
    console.error('API unreachable:', health.error || health.status);
    console.error('请先启动比特或第一页自研浏览器');
    process.exit(2);
  }

  const report = {
    at: new Date().toISOString(),
    baseUrl,
    lifecycle: doLifecycle,
    liveProvider: (health.json?.data || health.json || {}).provider || '',
    results: [],
  };

  // auto + 强制 bit + 强制 tkswarm（同一端口只能有一个进程，对比的是「识别与 Provider 路径」）
  for (const backend of ['auto', 'bit', 'tkswarm']) {
    const row = await runBackend(backend);
    row.score = score(row);
    report.results.push(row);
    console.log(
      `[${row.backend}] health=${row.healthOk} list=${row.listOk} `
      + (doLifecycle ? `create=${row.createOk} open=${row.openOk} close=${row.closeOk} ` : '')
      + `detected=${row.detected} score=${row.score}`
      + (row.errors.length ? ` errors=${row.errors.join('; ')}` : '')
    );
  }

  const outDir = path.resolve(__dirname, '../data');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `browser-backend-compare-${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log('\nReport saved:', outFile);
  console.log(JSON.stringify(report, null, 2));

  const auto = report.results.find((r) => r.backend === 'auto');
  if (auto && !auto.healthOk) process.exit(1);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
