// 业务时间统一东八区（须在任何 Date 格式化之前）
process.env.TZ = process.env.TZ || 'Asia/Shanghai';

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
const { attachExecutor, handleMessage: handleExecutorMessage } = require('./services/executor-hub');
const { notFound, errorHandler } = require('./middleware/error-handler');
const { phpApiProxy } = require('./middleware/php-api-proxy');
const phpApi = require('./services/php-api');
const { nowChinaIso } = require('./utils/china-time');

/**
 * 进程级兜底：浏览器 CDP / Playwright 的偶发协议错误（例如
 * Page.handleJavaScriptDialog: No dialog is showing）会以未处理 Promise 拒绝的形式冒出来，
 * Node 默认直接终止进程 → 表现就是「Server failed to start」。
 * 这里统一记录并忽略，保证服务不被单次浏览器竞态打死。
 */
process.on('unhandledRejection', (reason) => {
  const msg = String((reason && (reason.stack || reason.message)) || reason || '').slice(0, 800);
  console.error('[WARN] 未处理的 Promise 异常（已忽略，服务继续运行）:', msg);
  try { require('./services/live-log').publish(`未处理异常（已忽略）：${msg.slice(0, 300)}`, 'warn'); } catch { /* ignore */ }
});

process.on('uncaughtException', (err) => {
  // 端口占用 / 权限类启动错误仍然要退出，否则会静默半死
  if (err && (err.code === 'EADDRINUSE' || err.code === 'EACCES')) {
    console.error('[ERROR] 服务启动失败:', err);
    process.exit(1);
  }
  const msg = String((err && (err.stack || err.message)) || err || '').slice(0, 800);
  console.error('[WARN] 未捕获异常（已忽略，服务继续运行）:', msg);
  try { require('./services/live-log').publish(`未捕获异常（已忽略）：${msg.slice(0, 300)}`, 'warn'); } catch { /* ignore */ }
});

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
  time: nowChinaIso(),
  timezone: 'Asia/Shanghai',
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
app.use('/api/executor', require('./routes/executor'));
app.use('/api/audio', require('./routes/audio'));
const uploads = require('./routes/uploads');
app.use('/api/uploads', uploads.router);
app.use('/uploads', express.static(uploads.uploadDir));
const materialsLocal = require('./routes/materials-local');
app.use('/api/local-materials', materialsLocal.router);
// 旧前端仍 POST /api/materials/upload：改走本机 ingest，禁止把视频传到 PHP
app.post('/api/materials/upload', (req, res, next) => {
  req.url = '/ingest';
  req.originalUrl = '/api/local-materials/ingest';
  materialsLocal.router(req, res, next);
});
// 线下素材 GitHub 上传：文件在本机，不能交给远程 PHP 读盘
app.post('/api/materials/:id/github-upload', (req, res, next) => {
  const id = encodeURIComponent(String(req.params.id || ''));
  req.url = `/${id}/github-upload`;
  req.originalUrl = `/api/local-materials/${id}/github-upload`;
  materialsLocal.router(req, res, next);
});

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
    // 坐席发信：改为入队服务器浏览器 dm_reply（linux / cs_seat）
    const { enqueueAndRunSeatTask, pollSeatItem } = require('./services/chat-seat');
    const friendId = Number(req.body?.friendId || req.body?.friend_id || 0);
    const content = String(req.body?.content || '').trim();
    if (!friendId || !content) return fail(res, 'friendId 与 content 必填', 422);
    // 需要 accountId：从 PHP context 取
    const ctx = await require('./services/php-api').post('/node/chat/bit-send-context', { friendId });
    const accountId = Number(ctx.accountId || 0);
    if (!accountId) return fail(res, '无法解析账号', 422);
    const enq = await enqueueAndRunSeatTask({
      accountId,
      action: 'send',
      friendId,
      content,
      translated: req.body?.translated || '',
    });
    const done = await pollSeatItem(enq.itemId, { timeoutMs: 120000, intervalMs: 2000 });
    const okSend = String(done?.status || '') === 'completed';
    return ok(res, {
      ok: okSend,
      ...enq,
      status: done?.status,
      result: done?.result,
      reason: done?.errorMessage || '',
    }, okSend ? '已通过服务器浏览器发送' : (done?.errorMessage || '发送未完成'));
  } catch (e) {
    return fail(res, e.message || '发送失败', 422);
  }
});

/** 客服坐席：入队并触发服务器浏览器执行 */
app.post('/api/chat/seat-tasks', async (req, res) => {
  try {
    const { enqueueAndRunSeatTask } = require('./services/chat-seat');
    const data = await enqueueAndRunSeatTask(req.body || {});
    return ok(res, data, '已推送坐席任务到服务器浏览器');
  } catch (e) {
    return fail(res, e.message || '入队失败', 422);
  }
});

app.get('/api/chat/seat-items/:id', async (req, res) => {
  try {
    const phpApi = require('./services/php-api');
    const data = await phpApi.get(`/chat/seat-items/${req.params.id}`);
    return ok(res, data);
  } catch (e) {
    return fail(res, e.message || '查询失败', 422);
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

/** 客户委托发布：下载 CDN/GitHub 视频到本机目录（存在则跳过） */
app.post('/api/tasks/:id/download-video', async (req, res) => {
  try {
    const { downloadCustomerTaskVideo } = require('./services/customer-video-download');
    const downloadDir = String(req.body?.downloadDir || req.body?.download_dir || '').trim();
    if (!downloadDir) return fail(res, '请选择本地下载目录', 422);
    const data = await downloadCustomerTaskVideo(req.params.id, {
      downloadDir,
      saveDirSetting: req.body?.saveDirSetting !== false,
    });
    const msg = data.skipped
      ? (data.localCoverPath ? '本地视频已存在（封面已处理）' : '本地已存在，已跳过下载')
      : (data.localCoverPath ? '视频与封面已下载到本机' : '视频已下载到本机');
    return ok(res, data, msg);
  } catch (e) {
    return fail(res, e.message || '下载视频失败', 422);
  }
});

// 未在本机注册的 /api/* 统一转发至线上 PHP，避免浏览器跨域 / X-Acting-As 被拦
app.use(phpApiProxy);

const publicDir = path.resolve(__dirname, '../public');
app.use(express.static(publicDir, {
  setHeaders(res, filePath) {
    // 开发期避免 JS/CSS/HTML 被强缓存导致旧脚本继续提交错误 body
    if (/\.(js|css|html)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    }
  },
}));
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
  attachExecutor(socket);
  socket.send(JSON.stringify({ type: 'connected', data: { time: nowChinaIso(), mode: 'php-only' } }));
  socket.on('message', (raw) => {
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return socket.send(JSON.stringify({ type: 'error', message: '消息必须是 JSON' })); }
    if (handleExecutorMessage(socket, message)) return;
    if (message.type === 'ping') socket.send(JSON.stringify({ type: 'pong', data: { time: nowChinaIso() } }));
    if (message.type === 'heartbeat') socket.send(JSON.stringify({ type: 'heartbeat', data: { time: nowChinaIso() } }));
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
  try {
    const { startBanRestoreScheduler } = require('./services/ban-restore-scheduler');
    startBanRestoreScheduler();
  } catch (e) {
    console.warn('[WARN] ban-restore:', e.message);
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
