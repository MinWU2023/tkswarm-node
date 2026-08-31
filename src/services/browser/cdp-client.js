const WebSocket = require('ws');

function command(wsUrl, method, params = {}, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    const id = 1;
    const timer = setTimeout(() => {
      socket.terminate();
      reject(new Error(`CDP 命令超时：${method}`));
    }, timeoutMs);

    socket.once('open', () => socket.send(JSON.stringify({ id, method, params })));
    socket.on('message', raw => {
      let message;
      try { message = JSON.parse(raw.toString()); } catch { return; }
      if (message.id !== id) return;
      clearTimeout(timer);
      socket.close();
      if (message.error) reject(new Error(message.error.message || `CDP 命令失败：${method}`));
      else resolve(message.result || {});
    });
    socket.once('error', error => {
      clearTimeout(timer);
      reject(new Error(`无法连接浏览器 CDP：${error.message}`));
    });
  });
}

async function inspectTikTokSession(wsUrl) {
  const result = await command(wsUrl, 'Storage.getCookies');
  const cookies = (result.cookies || []).filter(cookie => /(^|\.)tiktok\.com$/i.test(cookie.domain.replace(/^\./, '')));
  const names = new Set(cookies.map(cookie => cookie.name));
  const evidence = ['sessionid', 'sessionid_ss', 'sid_tt', 'sid_guard', 'uid_tt'].filter(name => names.has(name));
  const loggedIn = names.has('sessionid') || names.has('sessionid_ss');
  return {
    loggedIn,
    cookieCount: cookies.length,
    evidence,
    checkedAt: new Date().toISOString(),
  };
}

module.exports = { command, inspectTikTokSession };
