const clients = new Set();

function attachChat(socket) {
  clients.add(socket);
  socket.on('close', () => clients.delete(socket));
}

function broadcast(type, data = {}) {
  const raw = JSON.stringify({ type, data, time: new Date().toISOString() });
  for (const socket of clients) {
    if (socket.readyState === 1) socket.send(raw);
  }
}

module.exports = { attachChat, broadcast };
