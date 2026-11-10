const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const phpApi = require('../services/php-api');

const FORWARD_REQ_HEADERS = [
  'authorization',
  'content-type',
  'x-acting-as',
  'accept',
  'accept-language',
  'range',
  'if-none-match',
  'if-modified-since',
];

const FORWARD_RES_HEADERS = [
  'content-type',
  'content-length',
  'content-disposition',
  'cache-control',
  'etag',
  'last-modified',
  'accept-ranges',
  'content-range',
  'location',
];

function buildTargetUrl(req) {
  const base = String(phpApi.loadApiBase() || '').replace(/\/+$/, '');
  if (!base) return null;
  return `${base}${req.originalUrl}`;
}

function pickRequestHeaders(req) {
  const out = { accept: 'application/json' };
  for (const key of FORWARD_REQ_HEADERS) {
    const val = req.headers[key];
    if (val) out[key] = val;
  }
  return out;
}

function writeResponseHeaders(res, upstream) {
  for (const key of FORWARD_RES_HEADERS) {
    const val = upstream.headers.get(key);
    if (val) res.setHeader(key, val);
  }
}

async function readRequestBody(req) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return undefined;
  const type = String(req.headers['content-type'] || '');
  if (type.includes('application/json')) {
    if (req.body === undefined || req.body === null) return undefined;
    return JSON.stringify(req.body);
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return undefined;
  return Buffer.concat(chunks);
}

async function proxyToPhp(req, res) {
  const targetUrl = buildTargetUrl(req);
  if (!targetUrl) {
    res.status(502).json({ success: false, message: '未配置 PHP API 地址（TKSWARM_API_BASE）' });
    return;
  }

  const headers = pickRequestHeaders(req);
  const body = await readRequestBody(req);
  const upstream = await fetch(targetUrl, {
    method: req.method,
    headers,
    body,
    redirect: 'manual',
  });

  writeResponseHeaders(res, upstream);
  res.status(upstream.status);
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  if (!upstream.body) {
    res.end();
    return;
  }
  await pipeline(Readable.fromWeb(upstream.body), res);
}

function describeFetchError(err) {
  const cause = err?.cause || err;
  const code = cause?.code || err?.code || '';
  const detail = cause?.message || err?.message || 'upstream error';
  if (code === 'UND_ERR_CONNECT_TIMEOUT' || /timeout/i.test(String(detail))) {
    return `连接超时（检查 TKSWARM_API_BASE 与服务器 80/443 是否可达）`;
  }
  if (code === 'ECONNREFUSED') return `连接被拒绝（${detail}）`;
  if (code === 'ENOTFOUND') return `域名解析失败（${detail}）`;
  if (code === 'CERT_HAS_EXPIRED' || /certificate/i.test(String(detail))) {
    return `HTTPS 证书异常（${detail}）`;
  }
  return detail;
}

function phpApiProxy(req, res, next) {
  if (!req.path.startsWith('/api/')) return next();
  proxyToPhp(req, res).catch((err) => {
    const base = String(phpApi.loadApiBase() || '').replace(/\/+$/, '') || '(未配置)';
    const detail = describeFetchError(err);
    console.error('[php-api-proxy]', req.method, req.originalUrl, '->', base, err?.cause || err);
    if (!res.headersSent) {
      res.status(502).json({
        success: false,
        message: `PHP API 代理失败: ${detail}（目标 ${base}）`,
      });
    } else {
      res.end();
    }
  });
}

module.exports = { phpApiProxy };
