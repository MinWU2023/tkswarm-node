const path = require('node:path');
const http = require('node:http');
const express = require('express');
const cors = require('cors');
const pinoHttp = require('pino-http');
const { WebSocketServer } = require('ws');
const { dbPath } = require('./db');
const { ok } = require('./http');
const { startTaskRunner } = require('./services/task-runner');
const { notFound, errorHandler } = require('./middleware/error-handler');

const app = express();
const server = http.createServer(app);
const port = Number(process.env.TKSWARM_PORT || 8400);
const host = process.env.TKSWARM_HOST || '127.0.0.1';

app.disable('x-powered-by');
app.use(pinoHttp({ quietReqLogger: process.env.NODE_ENV === 'test' }));
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));

app.get('/api/health', (req, res) => ok(res, {
  name: 'TkSwarm Rebuild',
  version: '0.1.0',
  uptimeSeconds: Math.round(process.uptime()),
  database: dbPath,
  time: new Date().toISOString(),
}));

app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/proxies', require('./routes/proxies'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/materials', require('./routes/materials'));
app.use('/api/message-templates', require('./routes/message-templates'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/browser', require('./routes/browser'));

const publicDir = path.resolve(__dirname, '../public');
app.use(express.static(publicDir));
app.get('*path', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  return res.sendFile(path.join(publicDir, 'index.html'));
});
app.use(notFound);
app.use(errorHandler);

const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', socket => {
  socket.send(JSON.stringify({ type: 'connected', data: { time: new Date().toISOString() } }));
  socket.on('message', raw => {
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return socket.send(JSON.stringify({ type: 'error', message: '消息必须是 JSON' })); }
    if (message.type === 'ping') socket.send(JSON.stringify({ type: 'pong', data: { time: new Date().toISOString() } }));
  });
});

server.listen(port, host, () => {
  startTaskRunner();
  console.log(`TkSwarm Rebuild running at http://${host}:${port}`);
  console.log(`Database: ${dbPath}`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  wss.clients.forEach(client => client.close(1001, 'server shutdown'));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
