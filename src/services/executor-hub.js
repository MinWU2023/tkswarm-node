/**
 * 前台执行器 Hub：
 * - 每个 WSS 客户端绑定登录用户(ownerId) + Token
 * - 只把属于该 owner 的总任务推给对应前台
 * - 按本机并发槽位控制，避免重复推送
 */
const clients = new Map(); // socket -> state

function defaultState() {
  return {
    enabled: false,
    running: 0,
    userId: 0,
    ownerId: 0,
    token: '',
    actingAs: '',
    offeredBatchIds: new Set(),
    lastSeen: Date.now(),
  };
}

function attachExecutor(socket) {
  clients.set(socket, defaultState());
  socket.on('close', () => clients.delete(socket));
}

function handleMessage(socket, message) {
  if (!clients.has(socket)) attachExecutor(socket);
  const st = clients.get(socket);
  st.lastSeen = Date.now();

  if (message.type === 'executor-status' || message.type === 'executor-ready') {
    st.enabled = Boolean(message.enabled ?? message.data?.enabled);
    const userId = Number(message.userId ?? message.data?.userId ?? st.userId ?? 0);
    const actingAs = message.actingAs ?? message.data?.actingAs ?? st.actingAs ?? '';
    const ownerId = Number(
      message.ownerId
      ?? message.data?.ownerId
      ?? actingAs
      ?? userId
      ?? st.ownerId
      ?? 0
    );
    if (userId > 0) st.userId = userId;
    if (ownerId > 0) st.ownerId = ownerId;
    st.actingAs = actingAs === '' || actingAs == null ? '' : String(actingAs);
    const token = String(message.token ?? message.data?.token ?? '').trim();
    if (token) st.token = token.replace(/^Bearer\s+/i, '');

    socket.send(JSON.stringify({
      type: 'executor-ack',
      data: {
        enabled: st.enabled,
        ownerId: st.ownerId,
        userId: st.userId,
        onlineExecutors: countEnabled(),
        time: new Date().toISOString(),
      },
    }));
    return true;
  }

  if (message.type === 'executor-busy') {
    st.running = Math.max(0, Number(message.running || message.data?.running || 0));
    return true;
  }

  return false;
}

function countEnabled() {
  let n = 0;
  for (const [socket, st] of clients) {
    if (st.enabled && socket.readyState === 1) n += 1;
  }
  return n;
}

function hasEnabled() {
  return countEnabled() > 0;
}

/** 所有已开启执行且身份完整的前台 */
function listEnabledClients() {
  const out = [];
  for (const [socket, st] of clients) {
    if (!st.enabled || socket.readyState !== 1) continue;
    if (!st.ownerId || !st.token) continue;
    out.push({ socket, ...st, offeredBatchIds: st.offeredBatchIds });
  }
  return out;
}

function markOffered(socket, batchId) {
  const st = clients.get(socket);
  if (!st) return;
  st.offeredBatchIds.add(Number(batchId));
}

function clearOffered(socket, batchId) {
  const st = clients.get(socket);
  if (!st) return;
  st.offeredBatchIds.delete(Number(batchId));
}

function clearOfferedEverywhere(batchId) {
  const id = Number(batchId);
  for (const [, st] of clients) {
    st.offeredBatchIds.delete(id);
  }
}

/**
 * 只推给 owner 匹配的开启中前台。
 * @returns {{ ok: boolean, socket?: WebSocket, reason?: string }}
 */
function pushWork(batch) {
  const ownerId = Number(batch?.owner_id || batch?.ownerId || 0);
  let best = null;
  let bestLoad = Infinity;

  for (const [socket, st] of clients) {
    if (!st.enabled || socket.readyState !== 1) continue;
    if (!st.ownerId) continue;
    // 必须推给「当前登录身份」对应 owner 的前台
    if (ownerId > 0 && Number(st.ownerId) !== ownerId) continue;
    if (st.offeredBatchIds.has(Number(batch.id))) continue;
    const load = Number(st.running || 0) + st.offeredBatchIds.size;
    if (load < bestLoad) {
      bestLoad = load;
      best = socket;
    }
  }

  if (!best) {
    return { ok: false, reason: ownerId ? `无 owner#${ownerId} 的在线执行前台` : '无在线执行前台' };
  }

  try {
    const taskLabel = String(batch.task_label || batch.taskLabel || '');
    best.send(JSON.stringify({
      type: 'work-push',
      data: {
        batch,
        batchId: batch.id,
        accountId: batch.account_id || batch.account?.id,
        ownerId,
        username: batch.account?.username || '',
        browserProfileId: batch.browser_profile_id || batch.account?.browser_profile_id || '',
        taskLabel,
        time: new Date().toISOString(),
      },
    }));
    markOffered(best, batch.id);
    return { ok: true, socket: best };
  } catch {
    return { ok: false, reason: 'WSS 发送失败' };
  }
}

/** 通知前台某批次执行结束 */
function notifyWorkDone(batchId, extra = {}) {
  const raw = JSON.stringify({
    type: 'work-done',
    data: {
      batchId: Number(batchId),
      time: new Date().toISOString(),
      ...extra,
    },
  });
  clearOfferedEverywhere(batchId);
  for (const [socket, st] of clients) {
    if (!st.enabled || socket.readyState !== 1) continue;
    try { socket.send(raw); } catch { /* ignore */ }
  }
}

function broadcastExecutorStatus(extra = {}) {
  const raw = JSON.stringify({
    type: 'executor-hub',
    data: {
      onlineExecutors: countEnabled(),
      time: new Date().toISOString(),
      ...extra,
    },
  });
  for (const [socket] of clients) {
    if (socket.readyState === 1) {
      try { socket.send(raw); } catch { /* ignore */ }
    }
  }
}

module.exports = {
  attachExecutor,
  handleMessage,
  hasEnabled,
  countEnabled,
  listEnabledClients,
  pushWork,
  clearOffered,
  clearOfferedEverywhere,
  notifyWorkDone,
  broadcastExecutorStatus,
};
