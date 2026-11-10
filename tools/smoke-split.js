const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'public');

const srv = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(root, p.replace(/^\//, ''));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    res.end('no');
    return;
  }
  const ext = path.extname(file);
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
  res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

srv.listen(0, async () => {
  const port = srv.address().port;
  const base = 'http://127.0.0.1:' + port;
  const paths = [
    '/index.html',
    '/js/app-core.js',
    '/js/router.js',
    '/js/pages/accounts.js',
    '/js/pages/logs.js',
    '/js/pages/publish.js',
    '/js/pages/groups.js',
    '/material-picker.js',
    '/ui.js',
    '/config.js'
  ];
  let failed = false;
  for (const p of paths) {
    const r = await fetch(base + p);
    if (!r.ok) {
      console.error('FAIL', p, r.status);
      failed = true;
    } else {
      console.log('OK', p, (await r.text()).length);
    }
  }

  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    URL,
    URLSearchParams,
    AbortController,
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          authEnabled: false,
          authenticated: true,
          user: null,
          permissions: [],
          children: []
        }
      }),
      arrayBuffer: async () => new ArrayBuffer(0)
    })
  };
  sandbox.global = sandbox;
  sandbox.window = sandbox;
  sandbox.document = {
    querySelector: () => null,
    querySelectorAll: () => [],
    body: {
      classList: { contains: () => false, add() {}, remove() {} },
      appendChild() {}
    },
    addEventListener() {},
    createElement: () => ({
      setAttribute() {},
      appendChild() {},
      style: {},
      classList: { add() {}, remove() {}, contains: () => false },
      dataset: {}
    })
  };
  sandbox.location = {
    hash: '#/accounts',
    protocol: 'http:',
    host: '127.0.0.1',
    hostname: '127.0.0.1',
    pathname: '/',
    search: '',
    href: 'http://127.0.0.1/',
    replace() {}
  };
  sandbox.history = { replaceState() {} };
  sandbox.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  sandbox.WebSocket = function () {
    this.send = () => {};
    this.close = () => {};
  };
  sandbox.UI = {
    notify() {},
    confirm: async () => true,
    validate: () => null,
    decorate() {},
    restorePopups() {},
    restoreMenu() {},
    syncMenus() {},
    paginateLocal: (a) => ({ items: a || [], page: 1, pages: 1 })
  };
  sandbox.__TKSWARM_CONFIG__ = { defaultApiBase: '', getWsBase: () => 'ws://x' };

  try {
    const code =
      fs.readFileSync(path.join(root, 'config.js'), 'utf8') +
      '\n' +
      fs.readFileSync(path.join(root, 'js/app-core.js'), 'utf8') +
      '\n' +
      fs.readFileSync(path.join(root, 'js/router.js'), 'utf8') +
      '\nTkRouter.patchApp();\nif (!window.app || !window.app.api) throw new Error("no app");\nif (typeof window.app.navigate !== "function") throw new Error("no navigate");\nconsole.log("BOOT_OK");\n';
    vm.runInNewContext(code, sandbox, { timeout: 5000 });
  } catch (e) {
    console.error('BOOT_FAIL', e && e.message);
    failed = true;
  }

  // Index should not reference monolith
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  if (/src="\/app\.js/.test(html)) {
    console.error('FAIL index still loads /app.js');
    failed = true;
  } else {
    console.log('OK index uses app-core+router');
  }

  srv.close();
  process.exit(failed ? 1 : 0);
});
