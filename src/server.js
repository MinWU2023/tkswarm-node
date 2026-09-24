const path = require('node:path');
const http = require('node:http');
const express = require('express');
const cors = require('cors');
const pinoHttp = require('pino-http');
const { WebSocketServer } = require('ws');
const { dataPath, dbAvailable, dbError, dataSource, apiBase, mode } = require('./runtime');
const { ok, fail } = require('./http');
const { attach } = require('./services/live-log');
const { attachChat } = require('./services/chat-hub');
const { notFound, errorHandler } = require('./middleware/error-handler');
const phpApi = require('./services/php-api');

const app = express();
const server = http.createServer(app);
const port = Number(process.env.TKSWARM_PORT || 8999);
const host = process.env.TKSWARM_HOST || '127.0.0.1';

app.disable('x-powered-by');
app.use(pinoHttp({ quietReqLogger: process.env.NODE_ENV === 'test' }));
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));

// 鉴权由 PHP 负责；本机只转发 Bearer 给 PHP API
app.use((req, res, next) => phpApi.runWithRequest(req, () => next()));

app.get('/api/health', (req, res) => ok(res, {
  name: 'TkSwarm Rebuild',
  version: '0.3.0',
  uptimeSeconds: Math.round(process.uptime()),
  database: dataPath,
  dbAvailable: Boolean(dbAvailable),
  dbError: dbAvailable ? null : (dbError || 'offline'),
  dataSource,
  apiBase: phpApi.loadApiBase() || apiBase,
  mode,
  time: new Date().toISOString(),
}));

app.get('/api/system/info', (req, res) => ok(res, {
  name: 'TkSwarm Node',
  mode,
  dataSource,
  apiBase: phpApi.loadApiBase() || apiBase,
  bitHint: 'http://127.0.0.1:54345',
  online: true,
}));

// —— 本机能力（比特 / 文件）——
app.use('/api/browser', require('./routes/browser'));
app.use('/api/audio', require('./routes/audio'));
const uploads = require('./routes/uploads');
app.use('/api/uploads', uploads.router);
app.use('/uploads', express.static(uploads.uploadDir));

app.post('/api/accounts/monitor/run', async (req, res) => {
  try {
    const { runAccountMonitor } = require('./services/account-monitor');
    const result = await runAccountMonitor();
    return ok(res, result, '监控已执行');
  } catch (e) {
    return fail(res, e.message || '监控失败', 422);
  }
});

app.post('/api/chat/messages/bit-send', async (req, res) => {
  try {
    const { bitSend } = require('./services/bit-send');
    const result = await bitSend(req.body || {});
    return ok(res, result, '已通过比特发送');
  } catch (e) {
    return fail(res, e.message || '发送失败', 422);
  }
});

app.post('/api/tasks/:id/items/:itemId/resume-publish', async (req, res) => {
  try {
    const { resumePublishViaPhp } = require('./services/task-bridge');
    const data = await resumePublishViaPhp(Number(req.params.id), Number(req.params.itemId));
    return ok(res, data, '已继续发布');
  } catch (e) {
    return fail(res, e.message || '继续发布失败', 422);
  }
});

app.post('/api/tasks/:id/items/:itemId/confirm-published', async (req, res) => {
  try {
    const data = await phpApi.post(`/node/tasks/${req.params.id}/items/${req.params.itemId}/confirm-published`, req.body || {});
    return ok(res, data, '已确认发布');
  } catch (e) {
    return fail(res, e.message || '确认失败', 422);
  }
});

const publicDir = path.resolve(__dirname, '../public');
app.use(express.static(publicDir));
app.get('*path', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  return res.sendFile(path.join(publicDir, 'index.html'));
});
app.use(notFound);
app.use(errorHandler);

const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (socket) => {
  attach(socket);
  attachChat(socket);
  socket.send(JSON.stringify({ type: 'connected', data: { time: new Date().toISOString(), mode: 'php-only' } }));
  socket.on('message', (raw) => {
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return socket.send(JSON.stringify({ type: 'error', message: '消息必须是 JSON' })); }
    if (message.type === 'ping') socket.send(JSON.stringify({ type: 'pong', data: { time: new Date().toISOString() } }));
    if (message.type === 'heartbeat') socket.send(JSON.stringify({ type: 'heartbeat', data: { time: new Date().toISOString() } }));
  });
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`[ERROR] 端口 ${host}:${port} 已被占用。请先关闭已有的 TkSwarm 进程，或设置 TKSWARM_PORT 使用其他端口。`);
  } else {
    console.error('[ERROR] 服务启动失败:', err);
  }
  process.exit(1);
});

server.listen(port, host, () => {
  try {
    const { startTaskRunner } = require('./services/task-runner');
    startTaskRunner();
  } catch (e) {
    console.warn('[WARN] task-runner:', e.message);
  }
  try {
    const { startAccountMonitor } = require('./services/account-monitor');
    startAccountMonitor();
  } catch (e) {
    console.warn('[WARN] account-monitor:', e.message);
  }
  console.log(`TkSwarm Rebuild running at http://${host}:${port}`);
  console.log(`Data: ${dataPath} | mode=${mode}`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  wss.clients.forEach((client) => client.close(1001, 'server shutdown'));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
