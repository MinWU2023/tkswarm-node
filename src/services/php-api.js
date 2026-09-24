const { AsyncLocalStorage } = require('node:async_hooks');
const fs = require('node:fs');
const path = require('node:path');

const als = new AsyncLocalStorage();
const root = path.resolve(__dirname, '../..');
let cachedAuth = '';

function loadApiBase() {
  if (process.env.TKSWARM_API_BASE) {
    return String(process.env.TKSWARM_API_BASE).replace(/\/+$/, '');
  }
  const files = [
    path.join(root, 'data', 'api.json'),
    path.join(root, 'config', 'api.json'),
  ];
  for (const file of files) {
    try {
      if (!fs.existsSync(file)) continue;
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (j?.apiBase) return String(j.apiBase).replace(/\/+$/, '');
    } catch { /* ignore */ }
  }
  return 'http://tkswarm-api.dyyweb.com';
}

function loadStaticToken() {
  if (process.env.TKSWARM_API_TOKEN) return String(process.env.TKSWARM_API_TOKEN);
  const files = [
    path.join(root, 'data', 'api.json'),
    path.join(root, 'config', 'api.json'),
  ];
  for (const file of files) {
    try {
      if (!fs.existsSync(file)) continue;
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (j?.token) return String(j.token);
    } catch { /* ignore */ }
  }
  return '';
}

function runWithRequest(req, next) {
  const auth = String(req.headers.authorization || '');
  if (auth) cachedAuth = auth;
  const ctx = {
    auth,
    actingAs: String(req.headers['x-acting-as'] || ''),
  };
  return als.run(ctx, () => next());
}

function setAuthToken(token) {
  const value = token ? `Bearer ${String(token).replace(/^Bearer\s+/i, '')}` : '';
  cachedAuth = value;
  const cur = als.getStore();
  if (cur) cur.auth = value;
}

function resolveAuth(ctx) {
  if (ctx.auth) return ctx.auth;
  if (cachedAuth) return cachedAuth;
  const staticToken = loadStaticToken();
  return staticToken ? `Bearer ${staticToken.replace(/^Bearer\s+/i, '')}` : '';
}

async function request(method, apiPath, body) {
  const base = loadApiBase();
  const ctx = als.getStore() || {};
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  const auth = resolveAuth(ctx);
  if (auth) headers.Authorization = auth;
  if (ctx.actingAs) headers['X-Acting-As'] = ctx.actingAs;

  const res = await fetch(`${base}/api${apiPath}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({ success: false, message: 'PHP API 响应无效' }));
  if (!res.ok || !json.success) {
    const err = new Error(json.message || `PHP API ${res.status}`);
    err.status = res.status;
    err.payload = json;
    throw err;
  }
  return json.data;
}

/** 下载二进制（素材流等），路径可为 /api/... 或相对 /materials/... */
async function download(apiPath, destFile) {
  const base = loadApiBase();
  const ctx = als.getStore() || {};
  const headers = { Accept: '*/*' };
  const auth = resolveAuth(ctx);
  if (auth) headers.Authorization = auth;
  if (ctx.actingAs) headers['X-Acting-As'] = ctx.actingAs;
  let url = String(apiPath || '');
  if (!url.startsWith('http')) {
    if (url.startsWith('/api/')) url = `${base}${url}`;
    else if (url.startsWith('/')) url = `${base}${url.startsWith('/api') ? url : `/api${url}`}`;
    else url = `${base}/api/${url}`;
  }
  const res = await fetch(url, { method: 'GET', headers });
  if (!res.ok) throw new Error(`下载失败 HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (destFile) {
    fs.mkdirSync(path.dirname(destFile), { recursive: true });
    fs.writeFileSync(destFile, buf);
  }
  return buf;
}

const get = (p) => request('GET', p);
const post = (p, body) => request('POST', p, body || {});
const put = (p, body) => request('PUT', p, body || {});
const patch = (p, body) => request('PATCH', p, body || {});

module.exports = {
  loadApiBase,
  runWithRequest,
  setAuthToken,
  request,
  download,
  get,
  post,
  put,
  patch,
};
