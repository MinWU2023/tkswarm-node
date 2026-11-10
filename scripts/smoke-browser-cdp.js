#!/usr/bin/env node
/**
 * P0 验收 dry-run：getProvider → create → open → Playwright CDP → about:blank → close
 * 不需要 TikTok 账号；需本机浏览器 API 在线且已登录。
 *
 * 用法：
 *   node scripts/smoke-browser-cdp.js
 *   node scripts/smoke-browser-cdp.js --url http://127.0.0.1:54345
 */
const path = require('node:path');
const fs = require('node:fs');

process.chdir(path.join(__dirname, '..'));

const args = process.argv.slice(2);
const urlIdx = args.indexOf('--url');
const baseUrl = urlIdx >= 0 && args[urlIdx + 1]
  ? args[urlIdx + 1]
  : 'http://127.0.0.1:54345';

function writeLocalSetting(key, value) {
  const file = path.resolve(__dirname, '../data/local-settings.json');
  const j = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) || {} : {};
  j[key] = value;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(j, null, 2));
}

function log(ok, step, detail = '') {
  console.log(`[${ok ? 'OK' : 'FAIL'}] ${step}${detail ? ' — ' + detail : ''}`);
}

async function main() {
  let failures = 0;
  const fail = (step, d) => { failures += 1; log(false, step, d); };

  writeLocalSetting('browserApiUrl', baseUrl);
  writeLocalSetting('browserBackend', 'auto');

  const { getProviderAsync, clearBackendCache } = require('../src/services/browser/providers');
  clearBackendCache();

  let provider;
  try {
    provider = await getProviderAsync('auto');
    log(true, 'provider', `${provider.backendId} / ${provider.backendLabel}`);
  } catch (e) {
    fail('provider', e.message);
    process.exit(1);
  }

  try {
    const health = await provider.health();
    log(true, 'health', JSON.stringify(health));
  } catch (e) {
    fail('health', e.message);
    console.error('请先启动并登录本地浏览器 API:', baseUrl);
    process.exit(2);
  }

  let profileId = '';
  try {
    const created = await provider.create({
      name: `cdp-smoke-${Date.now()}`,
      remark: 'smoke-browser-cdp',
      language: 'en-US',
    });
    profileId = String(created?.id || '');
    if (!profileId) fail('create', JSON.stringify(created));
    else log(true, 'create', profileId);
  } catch (e) {
    fail('create', e.message);
    process.exit(1);
  }

  let ws = '';
  try {
    const opened = await provider.open(profileId, { headless: true });
    ws = String(opened?.ws || '');
    if (!ws) fail('open', JSON.stringify(opened));
    else log(true, 'open', ws.slice(0, 60));
  } catch (e) {
    fail('open', e.message);
  }

  if (ws) {
    try {
      const { chromium } = require('playwright-core');
      const browser = await chromium.connectOverCDP(ws);
      const context = browser.contexts()[0] || await browser.newContext();
      const page = context.pages()[0] || await context.newPage();
      await page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 15000 });
      const title = await page.title().catch(() => '');
      const ua = await page.evaluate(() => navigator.userAgent).catch(() => '');
      log(true, 'cdp navigate', `title=${title || '(blank)'} ua=${String(ua).slice(0, 48)}…`);
      await browser.close().catch(() => {});
    } catch (e) {
      fail('cdp', e.message);
    }
  }

  try {
    await provider.close(profileId);
    log(true, 'close');
  } catch (e) {
    fail('close', e.message);
  }

  try {
    await provider.delete(profileId);
    log(true, 'delete');
  } catch (e) {
    fail('delete', e.message);
  }

  console.log(failures ? `\nCDP smoke FAILED (${failures})` : '\nCDP smoke OK');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
