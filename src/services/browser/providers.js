const { BitBrowserProvider } = require('./bit-browser-provider');

const PROVIDERS = {
  bit: { id: 'bit', name: '比特浏览器', ready: true },
  adspower: { id: 'adspower', name: 'AdsPower', ready: false },
  vmlogin: { id: 'vmlogin', name: 'VMLogin', ready: false },
  playwright: { id: 'playwright', name: 'Playwright', ready: false },
};

function listProviders() {
  return Object.values(PROVIDERS);
}

function getProvider(type = 'bit') {
  const key = String(type || 'bit').toLowerCase();
  const meta = PROVIDERS[key] || PROVIDERS.bit;
  if (!meta.ready) throw new Error(`${meta.name} 正在开发中，当前仅支持比特浏览器`);
  if (key === 'bit') return new BitBrowserProvider();
  throw new Error(`未知浏览器类型：${type}`);
}

module.exports = { listProviders, getProvider, PROVIDERS };
