const clients = new Set();
function attach(socket) { clients.add(socket); socket.on('close', () => clients.delete(socket)); }
function publish(message, level='info', data={}) {
  const event = { type: 'operation-log', data: { id: Date.now()+Math.random(), time: new Date().toISOString(), level, message, ...data } };
  const raw = JSON.stringify(event);
  for (const socket of clients) if (socket.readyState === 1) socket.send(raw);
}
module.exports = { attach, publish };
