/**
 * 在「已登录的 TkSwarm Node 控制台」DevTools Console 整段粘贴执行。
 *
 * 会删除：
 * A) 中心库：全部环境绑定行、环境包 .tgz、账号上的环境 ID 列
 * B) 本机：自研 / Linux / 比特 全部浏览器环境实体（含 userdata）
 *
 * 额度：本机清完后 used=0，上限仍是每人 300。
 * 确认词：WIPE-ALL-ENVS
 */
(async () => {
  const CONFIRM = 'WIPE-ALL-ENVS';
  if (!window.app || typeof window.app.api !== 'function') {
    throw new Error('请在 TkSwarm 控制台页面（已登录）执行');
  }
  const word = window.prompt(
    `危险不可恢复！\n` +
      `1) 删除中心库全部环境绑定 + 环境包文件\n` +
      `2) 删除本机全部浏览器环境数据\n` +
      `3) 用户环境额度 used 归零（上限 300）\n\n` +
      `输入 ${CONFIRM} 继续：`,
  );
  if (word !== CONFIRM) {
    console.log('[wipe] 已取消');
    return;
  }

  const api = (path, options) => window.app.api(path, options);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = (...a) => console.log('[wipe]', ...a);

  // —— A) 中心库环境数据（绑定 + 包文件）——
  log('清空中心库环境数据…');
  let center = null;
  try {
    center = await api('/admin/browser-envs/wipe-all', {
      method: 'POST',
      body: JSON.stringify({ confirm: 'WIPE-ALL-ENV-DATA' }),
    });
    log('中心库已清空', center);
  } catch (e) {
    log('中心库清空失败，回退为逐账号解绑：', e.message || e);
    const accountIds = [];
    let page = 1;
    for (;;) {
      const pack = await api(`/accounts?page=${page}&pageSize=200`);
      const items = pack?.items || [];
      for (const a of items) {
        const id = Number(a.id);
        if (id > 0) accountIds.push(id);
      }
      const total = Number(pack?.total ?? accountIds.length);
      if (!items.length || accountIds.length >= total || page > 500) break;
      page += 1;
    }
    let unbindOk = 0;
    for (const id of accountIds) {
      try {
        await api('/browser/unbind', {
          method: 'POST',
          body: JSON.stringify({ accountId: id, clear: true, profileId: '' }),
        });
        unbindOk += 1;
      } catch { /* continue */ }
    }
    center = { fallbackUnbind: unbindOk, accounts: accountIds.length };
    log('回退解绑完成', center);
  }

  // —— B) 本机环境实体 ——
  const backends = ['tkswarm', 'linux', 'bit'];
  const deleteSummary = {};
  for (const be of backends) {
    deleteSummary[be] = { listed: 0, deleted: 0, blocked: 0, failed: 0 };
    let profiles = [];
    try {
      const d = await api(`/browser/profiles?pageSize=500&browserBackend=${encodeURIComponent(be)}`);
      profiles = (d?.items || []).map((x) => String(x.id || '').trim()).filter(Boolean);
    } catch (e) {
      log(`列出 ${be} 失败：`, e.message || e);
      continue;
    }
    deleteSummary[be].listed = profiles.length;
    log(`${be}: 删除 ${profiles.length} 个环境…`);
    for (let i = 0; i < profiles.length; i += 80) {
      const ids = profiles.slice(i, i + 80);
      try {
        const r = await api('/browser/profiles/batch-delete', {
          method: 'POST',
          body: JSON.stringify({ profileIds: ids, browserBackend: be }),
        });
        deleteSummary[be].deleted += Number(r?.deleted || 0);
        deleteSummary[be].blocked += Number(r?.blocked || 0);
        deleteSummary[be].failed += Number(r?.failed || 0);
      } catch {
        deleteSummary[be].failed += ids.length;
      }
      await sleep(100);
    }
    log(`${be}:`, deleteSummary[be]);
  }

  const result = { center, deleteSummary };
  window.__TK_WIPE_ENV_RESULT__ = result;
  console.log('[wipe] 完成', result);
  alert(
    `环境数据已清\n` +
      `中心：绑定行 ${center?.envRows ?? '-'}，包文件 ${center?.packFiles ?? '-'}+${center?.packDirCleared ?? 0}\n` +
      backends.map((be) => `${be} 删 ${deleteSummary[be]?.deleted || 0}/${deleteSummary[be]?.listed || 0}`).join('\n') +
      `\n额度 used=0 → 剩余 300`,
  );
  return result;
})().catch((e) => {
  console.error('[wipe] 失败', e);
  alert(`执行失败：${e.message || e}`);
});
