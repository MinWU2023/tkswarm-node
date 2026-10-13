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

/**
 * SOCKS5 握手；可选 CONNECT 目标并经隧道取出口 IP（HTTP）。
 * opts.fetchEgress: 握手成功后探测出口 IP
 */
async function socks5HandshakeProbe(proxy, timeoutMs = 8000, opts = {}) {
  const started = Date.now();
  const host = String(proxy.host || '');
  const port = Number(proxy.port);
  const user = String(proxy.username || '');
  const pass = String(proxy.password || '');
  const fetchEgress = opts.fetchEgress === true;
  if (!host || !port) return { available: false, latencyMs: null, detail: 'SOCKS5 信息不完整', egressIp: '' };

  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let buf = Buffer.alloc(0);
    let step = 'greeting';
    let egressIp = '';
    const done = (available, detail) => {
      clearTimeout(timer);
      try { socket.destroy(); } catch { /* ignore */ }
      resolve({
        available,
        latencyMs: available ? Date.now() - started : null,
        detail,
        egressIp,
      });
    };
    const timer = setTimeout(() => done(false, 'SOCKS5 握手超时'), timeoutMs);
    socket.on('error', (err) => done(false, `SOCKS5 连接失败：${err.message || err}`));

    const sendConnect = (domain, dport) => {
      const name = Buffer.from(domain, 'utf8');
      const req = Buffer.alloc(7 + name.length);
      req[0] = 0x05;
      req[1] = 0x01;
      req[2] = 0x00;
      req[3] = 0x03;
      req[4] = name.length;
      name.copy(req, 5);
      req.writeUInt16BE(dport, 5 + name.length);
      socket.write(req);
    };

    const beginConnect = () => {
      if (fetchEgress) {
        step = 'connect-egress';
        sendConnect('api.ipify.org', 80);
      } else {
        step = 'connect-reply';
        sendConnect('www.tiktok.com', 443);
      }
    };

    const parseConnectReply = () => {
      if (buf.length < 4) return null;
      if (buf[0] !== 0x05) {
        done(false, 'SOCKS5 CONNECT 响应异常');
        return null;
      }
      const rep = buf[1];
      const atyp = buf[3];
      let hdr = 4;
      if (atyp === 0x01) hdr += 4 + 2;
      else if (atyp === 0x03) {
        if (buf.length < 5) return null;
        hdr += 1 + buf[4] + 2;
      } else if (atyp === 0x04) hdr += 16 + 2;
      else {
        done(false, 'SOCKS5 不支持地址类型');
        return null;
      }
      if (buf.length < hdr) return null;
      buf = buf.subarray(hdr);
      if (rep !== 0x00) {
        const map = {
          0x01: '总称失败',
          0x02: '规则不允许',
          0x03: '网络不可达',
          0x04: '主机不可达',
          0x05: '连接被拒绝',
          0x06: 'TTL 超时',
          0x07: '不支持命令',
          0x08: '不支持地址类型',
        };
        done(false, `SOCKS5 CONNECT 失败：${map[rep] || `code ${rep}`}`);
        return null;
      }
      return true;
    };

    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      try {
        if (step === 'greeting') {
          if (buf.length < 2) return;
          if (buf[0] !== 0x05) return done(false, '非 SOCKS5 响应');
          const method = buf[1];
          buf = buf.subarray(2);
          if (method === 0xFF) return done(false, 'SOCKS5 拒绝认证方式');
          if (method === 0x02) {
            const u = Buffer.from(user, 'utf8');
            const p = Buffer.from(pass, 'utf8');
            if (u.length > 255 || p.length > 255) return done(false, 'SOCKS5 账密过长');
            const auth = Buffer.alloc(3 + u.length + p.length);
            auth[0] = 0x01;
            auth[1] = u.length;
            u.copy(auth, 2);
            auth[2 + u.length] = p.length;
            p.copy(auth, 3 + u.length);
            step = 'auth';
            socket.write(auth);
            return;
          }
          if (method !== 0x00) return done(false, `SOCKS5 未知认证方式 ${method}`);
          beginConnect();
          return;
        }
        if (step === 'auth') {
          if (buf.length < 2) return;
          const ok = buf[0] === 0x01 && buf[1] === 0x00;
          buf = buf.subarray(2);
          if (!ok) return done(false, 'SOCKS5 用户名/密码认证失败');
          beginConnect();
          return;
        }
        if (step === 'connect-reply') {
          if (parseConnectReply() !== true) return;
          return done(true, 'SOCKS5 握手成功');
        }
        if (step === 'connect-egress') {
          if (parseConnectReply() !== true) return;
          step = 'http-egress';
          socket.write(
            'GET /?format=json HTTP/1.1\r\nHost: api.ipify.org\r\nConnection: close\r\n\r\n'
          );
          return;
        }
        if (step === 'http-egress') {
          const text = buf.toString('utf8');
          const sep = text.indexOf('\r\n\r\n');
          if (sep < 0) return;
          const body = text.slice(sep + 4).trim();
          try {
            const data = JSON.parse(body);
            egressIp = String(data.ip || '').trim();
          } catch {
            const m = body.match(/\b(\d{1,3}(?:\.\d{1,3}){3})\b/);
            egressIp = m ? m[1] : '';
          }
          if (egressIp) return done(true, `SOCKS5 出口 ${egressIp}`);
          return done(true, 'SOCKS5 握手成功（未解析到出口 IP）');
        }
      } catch (e) {
        done(false, `SOCKS5 探测异常：${e.message || e}`);
      }
    });
    socket.on('connect', () => {
      // 有用户名时声明无认证 + 用户名密码；无用户名只声明无认证
      if (user) {
        socket.write(Buffer.from([0x05, 0x02, 0x00, 0x02]));
      } else {
        socket.write(Buffer.from([0x05, 0x01, 0x00]));
      }
    });
  });
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

async function lookupCountryByIp(ip) {
  const addr = String(ip || '').trim();
  if (!addr || !/^\d{1,3}(\.\d{1,3}){3}$/.test(addr)) return '';
  const { fetch } = require('undici');
  const endpoints = [
    {
      url: `http://ip-api.com/json/${encodeURIComponent(addr)}?fields=status,country,countryCode`,
      parse: (d) => (d?.status === 'success' ? (d.countryCode || d.country) : ''),
    },
    {
      url: `https://ipapi.co/${encodeURIComponent(addr)}/json/`,
      parse: (d) => (d?.error ? '' : (d.country_code || d.country)),
    },
    {
      url: `https://ipwho.is/${encodeURIComponent(addr)}`,
      parse: (d) => (d?.success === false ? '' : (d.country_code || d.country)),
    },
  ];
  for (const ep of endpoints) {
    try {
      const response = await fetch(ep.url, { signal: AbortSignal.timeout(6000) });
      if (!response.ok) continue;
      const data = await response.json();
      const code = String(ep.parse(data) || '').trim();
      if (code) return code;
    } catch {
      /* try next */
    }
  }
  return '';
}

async function loadProxyForProbe(proxyId) {
  try {
    const bundle = await phpApi.get(`/node/proxies/${proxyId}/bundle`);
    if (bundle?.host && bundle?.port) {
      return {
        id: bundle.id,
        protocol: bundle.protocol,
        host: bundle.host,
        port: bundle.port,
        username: bundle.username || '',
        password: bundle.password || '',
      };
    }
  } catch {
    /* fall through */
  }
  // 兼容旧接口：列表无密码，仅能做 TCP / 主机 IP 国家
  const page = await phpApi.get(`/proxies?page=1&pageSize=500`);
  const proxy = (page?.items || []).find((p) => Number(p.id) === Number(proxyId));
  if (!proxy) throw new Error('代理不存在');
  return {
    id: proxy.id,
    protocol: proxy.protocol,
    host: proxy.host,
    port: proxy.port,
    username: proxy.username || '',
    password: proxy.password || '',
  };
}

async function probeProxyObject(proxy, opts = {}) {
  if (!proxy?.host || !proxy?.port) throw new Error('代理信息不完整');
  const wantCountry = opts.detectCountry !== false;
  const strictSocks = opts.strictSocks === true;
  const proto = String(proxy.protocol || '').toLowerCase();
  const isSocks = proto === 'socks5' || proto === 'socks' || proto === 'socks5h';
  const hasCreds = Boolean(String(proxy.username || '') && String(proxy.password || ''));

  const tcp = await tcpProbe(proxy, opts.tcpTimeoutMs || 5000);

  if (isSocks) {
    let socks = { available: false, latencyMs: null, detail: '', egressIp: '' };
    if (tcp.available) {
      socks = await socks5HandshakeProbe(proxy, opts.socksTimeoutMs || (wantCountry ? 12000 : 5000), {
        fetchEgress: wantCountry,
      });
    }

    let country = '';
    if (wantCountry && tcp.available) {
      const ipForGeo = socks.egressIp
        || (/^\d{1,3}(\.\d{1,3}){3}$/.test(String(proxy.host || '')) ? String(proxy.host) : '');
      if (ipForGeo) country = await lookupCountryByIp(ipForGeo);
    }

    // 有用户名却无密码时的「认证失败」多为列表未带密，不当作硬失败
    const authFail = /认证失败|拒绝认证|非 SOCKS5/i.test(String(socks.detail || ''));
    const missingPassAuthFail = authFail && String(proxy.username || '') && !String(proxy.password || '');
    const hardFail = !tcp.available || (authFail && !missingPassAuthFail && hasCreds);
    const available = strictSocks
      ? Boolean(tcp.available && socks.available)
      : Boolean(tcp.available);

    const detailParts = [];
    if (!tcp.available) {
      detailParts.push('端口不可连接');
    } else if (socks.available) {
      detailParts.push(socks.egressIp ? `SOCKS5 出口 ${socks.egressIp}` : 'SOCKS5 握手成功');
    } else if (missingPassAuthFail) {
      detailParts.push('端口可连接（缺少代理密码，已跳过 SOCKS 鉴权校验）');
    } else if (/超时/i.test(String(socks.detail || ''))) {
      detailParts.push('端口可连接（SOCKS 握手超时，交由比特实际验证）');
    } else if (socks.detail) {
      detailParts.push(`端口可连接（${socks.detail}）`);
    } else {
      detailParts.push('端口可连接');
    }
    if (country) detailParts.push(`国家 ${country}`);

    return {
      available,
      hardFail,
      softWarning: Boolean(tcp.available && !socks.available && !hardFail),
      latencyMs: socks.latencyMs || tcp.latencyMs,
      egressIp: socks.egressIp || '',
      country,
      detail: detailParts.join(' · '),
    };
  }

  let egress = { egressIp: '', detail: '' };
  if (tcp.available) egress = await egressProbe(proxy);
  const reallyAvailable = Boolean(tcp.available && egress.egressIp);

  let country = '';
  if (wantCountry) {
    const ipForGeo = egress.egressIp || (/^\d{1,3}(\.\d{1,3}){3}$/.test(String(proxy.host || '')) ? String(proxy.host) : '');
    if (ipForGeo) country = await lookupCountryByIp(ipForGeo);
  }

  const detailParts = [];
  if (reallyAvailable) {
    detailParts.push(egress.egressIp ? `出口 IP ${egress.egressIp}` : '端口可连接');
    if (country) detailParts.push(`国家 ${country}`);
  } else {
    detailParts.push(egress.detail || (tcp.available ? '出口探测失败' : '连接失败'));
  }

  return {
    available: reallyAvailable,
    hardFail: !reallyAvailable,
    softWarning: false,
    latencyMs: egress.latencyMs || tcp.latencyMs,
    egressIp: egress.egressIp || '',
    country,
    detail: detailParts.join(' · '),
  };
}

async function testProxyReal(proxyId, opts = {}) {
  const proxy = await loadProxyForProbe(proxyId);
  const result = await probeProxyObject(proxy, opts);
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

async function batchDetectCountries(proxyIds) {
  const ids = [...new Set(proxyIds.map(Number).filter(Number.isInteger))];
  const results = [];
  let updated = 0;
  for (const id of ids) {
    try {
      const result = await testProxyReal(id, { detectCountry: true });
      if (result.country) updated += 1;
      results.push({ id, ...result });
    } catch (error) {
      results.push({ id, available: false, country: '', detail: error.message });
    }
  }
  return {
    total: ids.length,
    updated,
    available: results.filter((x) => x.available).length,
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
  batchDetectCountries,
  lookupCountryByIp,
  fetchCloudProxies,
  proxyUrl,
};
