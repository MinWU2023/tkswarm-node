#!/usr/bin/env node
/**
 * Dual-3：无浏览器依赖的 resolveProfileIdForAccount / 双 ID 选择冒烟。
 *
 *   node scripts/smoke-resolve-profile.js
 */
const path = require('node:path');
const fs = require('node:fs');

process.chdir(path.join(__dirname, '..'));

const {
  resolveProfileIdForAccount,
  resolveAccountBrowser,
  resolveEffectiveBackend,
  normalizeBackendId,
  runWithBrowserBackend,
  activeBackendOverride,
  clearBackendCache,
} = require('../src/services/browser/providers');

let failed = 0;
function assert(cond, msg) {
  if (cond) {
    console.log('[OK]', msg);
  } else {
    failed += 1;
    console.error('[FAIL]', msg);
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
  const bitId = 'bit-profile-aaa';
  const tkId = 'tk-profile-bbb';
  const linuxId = 'linux-profile-ccc';
  const both = {
    browser_profile_id: bitId,
    tkswarm_browser_profile_id: tkId,
    linux_browser_profile_id: linuxId,
  };

  assert(normalizeBackendId('TkSwarm') === 'tkswarm', 'normalizeBackendId tkswarm');
  assert(normalizeBackendId('BIT') === 'bit', 'normalizeBackendId bit');

  assert(
    resolveProfileIdForAccount(both, { browserBackend: 'bit' }) === bitId,
    'bit 后端选主环境 browser_profile_id'
  );
  assert(
    resolveProfileIdForAccount(both, { browserBackend: 'tkswarm' }) === tkId,
    'tkswarm 后端选 tkswarm_browser_profile_id'
  );
  assert(
    resolveProfileIdForAccount(both, { browserBackend: 'linux' }) === linuxId,
    'linux 后端选 linux_browser_profile_id'
  );
  assert(normalizeBackendId('tkswarm-linuxbrowse') === 'linux', 'normalize linuxbrowse → linux');
  assert(
    resolveProfileIdForAccount({ tkswarm_browser_profile_id: tkId }, { browserBackend: 'tkswarm' }) === tkId,
    '仅有 tkswarm 字段时 tkswarm 后端可用'
  );
  assert(
    resolveProfileIdForAccount({ tkswarm_browser_profile_id: tkId }, { browserBackend: 'bit' }) === tkId,
    '仅有 tkswarm 字段时 bit 后端回退到该 ID'
  );
  assert(
    resolveProfileIdForAccount({ browser_profile_id: bitId }, { browserBackend: 'tkswarm' }) === bitId,
    '仅有主字段时 tkswarm 后端回退主 ID'
  );
  assert(
    resolveProfileIdForAccount(both, { browserProfileId: 'forced-xyz' }) === 'forced-xyz',
    '显式 browserProfileId 优先'
  );
  assert(
    resolveProfileIdForAccount({}, { browserBackend: 'tkswarm' }) === '',
    '无绑定时返回空'
  );

  clearBackendCache();
  writeLocalSetting('browserBackend', 'auto');
  assert(
    resolveEffectiveBackend({ ...both, browser_backend: 'bit' }) === 'tkswarm',
    '双绑 + 账号主后端 bit + 全局 auto → 优先自研'
  );
  assert(
    resolveAccountBrowser({ ...both, browser_backend: 'bit' }).profileId === tkId,
    '双绑 + 全局 auto → resolveAccountBrowser 用自研环境 ID'
  );
  writeLocalSetting('browserBackend', 'tkswarm');
  assert(
    resolveEffectiveBackend({ ...both, browser_backend: 'bit' }) === 'tkswarm',
    '双绑 + 全局 tkswarm → 自研'
  );
  writeLocalSetting('browserBackend', 'bit');
  assert(
    resolveEffectiveBackend({ ...both, browser_backend: 'bit' }) === 'tkswarm',
    '双绑 + 全局强制 bit → 仍优先自研'
  );
  assert(
    resolveProfileIdForAccount(both, { browserBackend: 'bit' }) === bitId,
    '显式 browserBackend=bit 时仍用比特 ID'
  );

  clearBackendCache();
  await runWithBrowserBackend('tkswarm', async () => {
    assert(activeBackendOverride() === 'tkswarm', 'ALS runWithBrowserBackend 覆盖为 tkswarm');
    assert(
      resolveProfileIdForAccount(both) === tkId,
      'ALS 覆盖下 resolve 选 tkswarm ID'
    );
  });
  assert(activeBackendOverride() == null, 'ALS 退出后 override 清空');

  if (failed) {
    console.error(`\n${failed} assertion(s) failed`);
    process.exit(1);
  }
  console.log('\nAll resolve-profile smoke checks passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
