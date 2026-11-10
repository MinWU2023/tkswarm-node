/**
 * 冒烟：环境包 format / 同步模块加载 / 无云包回退语义（不依赖真实浏览器与 PHP）。
 * 运行：node scripts/smoke-env-pack-sync.js
 */
const assert = require('node:assert');
const path = require('node:path');

const desktopBackup = require(path.resolve(__dirname, '../../tkswarm-browses/src/browser/profile-backup'));
const linuxBackup = require(path.resolve(__dirname, '../../tkswarm-linuxbrowse/src/browser/profile-backup'));
const sync = require('../src/services/browser/env-pack-sync');

assert.strictEqual(desktopBackup.FORMAT, 'tkswarm-browser-profile');
assert.strictEqual(linuxBackup.FORMAT, 'tkswarm-browser-profile');
assert.strictEqual(typeof sync.ensureLocalEnvHydrated, 'function');
assert.strictEqual(typeof sync.pushLocalEnvPack, 'function');
assert.strictEqual(typeof sync.prepareEnvForOpen, 'function');
assert.ok(sync.supportsPackSync({ backendId: 'tkswarm' }));
assert.ok(sync.supportsPackSync({ backendId: 'linux' }));
assert.ok(!sync.supportsPackSync({ backendId: 'bit' }));

(async () => {
  const miss = await sync.ensureLocalEnvHydrated('', { provider: { backendId: 'tkswarm' } });
  assert.strictEqual(miss.hydrated, false);

  const unsupported = await sync.ensureLocalEnvHydrated('abc', {
    provider: { backendId: 'bit', detail: async () => null },
  });
  assert.strictEqual(unsupported.reason, 'backend-unsupported');

  const already = await sync.ensureLocalEnvHydrated('abc123', {
    provider: {
      backendId: 'tkswarm',
      detail: async () => ({ id: 'abc123', name: 'x' }),
    },
  });
  assert.strictEqual(already.reason, 'already-local');
  assert.strictEqual(already.hydrated, false);

  console.log('smoke-env-pack-sync: ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
