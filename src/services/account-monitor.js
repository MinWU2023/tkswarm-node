const phpApi = require('./php-api');
const dataStore = require('./data-store');
const { syncProfile, syncVideos } = require('./browser/tiktok-data');

let running = false;

async function runAccountMonitor() {
  let cfg = {};
  try {
    cfg = await phpApi.get('/node/monitor/config') || {};
  } catch {
    cfg = {};
  }
  let accountIds = Array.isArray(cfg.accountIds) ? cfg.accountIds.map(Number).filter(Boolean) : [];
  if (!accountIds.length) {
    try {
      const page = await phpApi.get('/accounts?page=1&pageSize=50');
      accountIds = (page?.items || [])
        .filter((a) => a.browser_profile_id && a.enabled !== 0)
        .map((a) => Number(a.id));
    } catch {
      accountIds = [];
    }
  }
  const result = { total: accountIds.length, profile: 0, videos: 0, failed: 0, errors: [] };
  for (const id of accountIds) {
    try {
      if (cfg.syncProfile !== false && cfg.sync_profile !== 0) {
        await syncProfile(id);
        result.profile += 1;
      }
      if (cfg.syncVideos || cfg.sync_videos) {
        const synced = await syncVideos(id, 30);
        result.videos += synced.count || 0;
      }
    } catch (error) {
      result.failed += 1;
      if (result.errors.length < 20) result.errors.push({ id, reason: error.message });
    }
  }
  await dataStore.saveMonitorResult(result).catch(() => {});
  return result;
}

function startAccountMonitor() {
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    phpApi.get('/node/monitor/config')
      .then(async (cfg) => {
        if (!cfg?.enabled) return;
        const interval = Math.max(1, Number(cfg.intervalMinutes || cfg.interval_minutes || 60));
        const last = cfg.lastRunAt || cfg.last_run_at;
        if (last) {
          const elapsed = Date.now() - new Date(last).getTime();
          if (elapsed < interval * 60_000) return;
        }
        await runAccountMonitor();
      })
      .catch((error) => console.error('account monitor', error.message))
      .finally(() => { running = false; });
  }, 60_000);
  timer.unref?.();
}

module.exports = { runAccountMonitor, startAccountMonitor };
