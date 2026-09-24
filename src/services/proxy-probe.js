const net = require('node:net');
const phpApi = require('./php-api');

function proxyUrl(proxy) {
  const password = proxy.password || '';
  const auth = proxy.username ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(password || '')}@` : '';
  return `${proxy.protocol}://${auth}${proxy.host}:${proxy.port}`;
}

async function tcpProbe(proxy, timeoutMs = 5000) {
  const started = Date.now();
  const available = await new Promise((resolve) => {
    const socket = net.createConnection({ host: proxy.host, port: Number(proxy.port) });
    const timer = setTimeout(() => { socket.destroy(); resolve(false); }, timeoutMs);
    socket.once('connect', () => { clearTimeout(timer); socket.destroy(); resolve(true); });
    socket.once('error', () => { clearTimeout(timer); resolve(false); });
  });
  return { available, latencyMs: available ? Date.now() - started : null };
}

async function egressProbe(proxy) {
  if (!['http', 'https'].includes(String(proxy.protocol || '').toLowerCase())) {
    return { egressIp: '', detail: 'SOCKS5 仅完成端口探测' };
  }
  try {
    const { ProxyAgent, fetch } = require('undici');
    const agent = new ProxyAgent(proxyUrl(proxy));
    const started = Date.now();
    const response = await fetch('https://api.ipify.org?format=json', {
      dispatcher: agent,
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return { egressIp: data.ip || '', latencyMs: Date.now() - started, detail: '出口 IP 探测成功' };
  } catch (error) {
    return { egressIp: '', detail: `出口探测失败：${error.message}` };
  }
}

async function probeProxyObject(proxy) {
  if (!proxy?.host || !proxy?.port) throw new Error('代理信息不完整');
  const tcp = await tcpProbe(proxy);
  let egress = { egressIp: '', detail: '' };
  if (tcp.available) egress = await egressProbe(proxy);
  const reallyAvailable = String(proxy.protocol || '').toLowerCase() === 'socks5'
    ? tcp.available
    : Boolean(tcp.available && egress.egressIp);
  return {
    available: reallyAvailable,
    latencyMs: egress.latencyMs || tcp.latencyMs,
    egressIp: egress.egressIp || '',
    detail: reallyAvailable
      ? (egress.egressIp ? `出口 IP ${egress.egressIp}` : '端口可连接')
      : (egress.detail || '连接失败'),
  };
}

async function testProxyReal(proxyId) {
  // 从账号列表侧已带明文密码；单独测代理时用 PHP 列表字段（无密码则仅 TCP）
  let proxy = null;
  try {
    const page = await phpApi.get(`/proxies?page=1&pageSize=500`);
    proxy = (page?.items || []).find((p) => Number(p.id) === Number(proxyId));
  } catch {
    proxy = null;
  }
  if (!proxy) throw new Error('代理不存在');
  const result = await probeProxyObject({
    id: proxy.id,
    protocol: proxy.protocol,
    host: proxy.host,
    port: proxy.port,
    username: proxy.username,
    password: proxy.password || '',
  });
  await phpApi.post(`/node/proxies/${proxyId}/probe-result`, result).catch(() => {});
  return result;
}

async function batchTestProxies(proxyIds) {
  const ids = [...new Set(proxyIds.map(Number).filter(Number.isInteger))];
  const results = [];
  for (const id of ids) {
    try {
      results.push({ id, ...(await testProxyReal(id)) });
    } catch (error) {
      results.push({ id, available: false, detail: error.message });
    }
  }
  return {
    total: ids.length,
    available: results.filter((x) => x.available).length,
    unavailable: results.filter((x) => !x.available).length,
    items: results,
  };
}

async function fetchCloudProxies() {
  throw new Error('云端取代理请使用 PHP /api/proxies/fetch');
}

module.exports = {
  probeProxyObject,
  testProxyReal,
  batchTestProxies,
  fetchCloudProxies,
  proxyUrl,
};
