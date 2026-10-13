const phpApi = require('./php-api');
const { syncVideos } = require('./browser/tiktok-data');
const { preparePublish, prepareMessage, connectAccount, closeConnection, forceCloseBrowserProfile } = require('./browser/tiktok-actions');
const { assertPublishGate, loadGate } = require('./account-gates');
const { fullLogin, closeSession } = require('./browser/tiktok-login');
const { publish: liveLog } = require('./live-log');
const executorHub = require('./executor-hub');
const { runWithSession, getSession } = require('./session-context');
const { inspectTikTokSession } = require('./browser/cdp-client');
const os = require('node:os');

/** Concurrent work batches = concurrent Bit browser windows */
const MAX_CONCURRENT_BATCHES = 3;
let activeBatchCount = 0;
let claiming = false;
/** Stable workerId (no pid) so restart can release/resume leases */
const WORKER_ID = `node-${os.hostname()}`;

/** Manual test locks: `batch:1` | `item:8`  also skips PHP CK gate */
const testingLocal = new Set();
function isManualTest() {
  return Boolean(getSession()?.test) || testingLocal.size > 0;
}

/** Pushed to frontend, waiting for /api/executor/run */
const pendingOffers = new Map(); // batchId -> { batch, at, ownerId }
const OFFER_TTL_MS = 45000;
/** Locally executing batch ids */
const runningLocal = new Set();

async function executePhpTask(task) {
  const type = task.type;
  const accounts = Array.isArray(task.accounts) ? task.accounts : [];
  const payload = task.payload || {};
  liveLog(`Task #${task.id} ${task.name || type}, accounts ${accounts.length}`, 'info', { taskId: task.id });

  let success = 0;
  let fail = 0;
  for (const acc of accounts) {
    const accountId = Number(acc.id || acc.accountId);
    try {
      if (type === 'publish') await assertPublishGate(accountId, payload.pushChannel || 'bit');
      let result;
      if (type === 'profile' || type === 'pull_stats') {
        const { pullStudioStats } = require('./browser/tiktok-studio-stats');
        result = await pullStudioStats(accountId);
      } else if (type === 'sync') {
        result = await syncVideos(accountId);
      } else if (type === 'publish') {
        const materialId = Number(acc.materialId || acc.material_id || payload.materialId);
        result = await preparePublish(accountId, materialId, payload.publishTitle || '', payload.publishCaption || '', {
          autoPublish: !payload.manualConfirm,
        });
        if (result?.status === 'security_paused' || result?.status === 'manual_required') {
          await phpApi.post(`/node/tasks/${task.id}/account-result`, {
            accountId,
            status: 'skipped',
            result,
            errorMessage: result.reason || result.status,
          });
          continue;
        }
        if (result?.status !== 'published') throw new Error(result?.error || `publish incomplete: ${result?.status}`);
        if (materialId > 0) {
          await phpApi.post(`/node/materials/${materialId}/mark-published`, {
            accountId,
            deleteAfterPublish: !!payload.deleteAfterPublish,
            videoId: result?.videoId || result?.video_id || '',
            videoUrl: result?.videoUrl || result?.video_url || '',
          }).catch((err) => {
            liveLog(`Mark material published failed: ${err.message}`, 'warn', { accountId, materialId });
          });
          result = {
            ...(result || {}),
            materialId,
            accountId,
            videoId: result?.videoId || result?.video_id || '',
            videoUrl: result?.videoUrl || result?.video_url || '',
          };
        }
      } else if (type === 'message') {
        result = await prepareMessage(accountId, payload.content || payload.publishCaption || '', payload.recipient || '');
      } else if (type === 'dm_sync') {
        const { syncAccountDm } = require('./browser/tiktok-dm-sync');
        result = await syncAccountDm(accountId, payload);
      } else if (type === 'warm') {
        const { runWarmAccount } = require('./browser/tiktok-warm');
        liveLog(`Task #${task.id} warm account#${accountId}`, 'info', { taskId: task.id, accountId });
        result = await runWarmAccount(accountId, payload);
      } else {
        throw new Error(`unsupported task type (php mode): ${type}`);
      }
      await phpApi.post(`/node/tasks/${task.id}/account-result`, {
        accountId,
        status: 'success',
        result,
      });
      success += 1;
    } catch (error) {
      fail += 1;
      await phpApi.post(`/node/tasks/${task.id}/account-result`, {
        accountId,
        status: 'failed',
        errorMessage: error.message,
      }).catch(() => {});
      liveLog(`Task #${task.id} account#${accountId} failed: ${error.message}`, 'error', { taskId: task.id });
    }
  }
  await phpApi.post(`/node/tasks/${task.id}/finish`, { success, fail });
  liveLog(`Task #${task.id} done: ok ${success}, fail ${fail}`, 'info', { taskId: task.id });
}

async function ensureAccountLogin(account) {
  const accountId = Number(account?.id || 0);
  if (!accountId) return;
  const batchId = Number(getSession()?.batchId || 0);
  const loginStatus = String(account.login_status || '');
  const hasSession = Boolean(account.has_session);
  if (loginStatus === 'online' || hasSession) {
    liveLog(`Account#${accountId} session ok, skip login`, 'info', { accountId, batchId });
    return;
  }
  liveLog(`Account#${accountId} needs login`, 'info', { accountId, batchId });
  await fullLogin(accountId);
}

async function executeWorkItem(item) {
  const type = item.task_type;
  const accountId = Number(item.account_id);
  const payload = item.payload || {};
  const taskId = Number(item.task_ref_id || 0);
  const batchId = Number(item.batch_id || getSession()?.batchId || 0);
  const itemId = Number(item.id || 0);
  const logCtx = { accountId, batchId, itemId, taskId };

  if (type === 'modify_profile') {
    const { modifyTikTokProfile } = require('./browser/tiktok-actions');
    const result = await modifyTikTokProfile(accountId, {
      nickname: payload.nickname || payload.displayName || '',
      signature: payload.signature || payload.bio || '',
      avatarPath: payload.avatarPath || payload.avatar_path || '',
      avatarUrl: payload.avatarUrl || payload.avatar_url || '',
    });
    if (result?.status && result.status !== 'ok') {
      throw new Error(result.error || 'modify profile failed');
    }
    return { status: 'completed', result };
  }

  if (type === 'publish') {
    const isTest = isManualTest();
    if (!isTest) {
      await assertPublishGate(accountId, payload.pushChannel || 'bit');
    } else {
      // Manual test: ignore PHP login_status/CK; Bit page session is checked in preparePublish.
      const gate = await loadGate(accountId);
      if (!gate.ok) throw new Error(gate.reason);
      if (gate.account?.account_status === 'banned') throw new Error('account banned, cannot publish');
    }
    const materialId = Number(payload.materialId || payload.material_id || 0);
    if (!materialId) throw new Error('publish item missing materialId');
    console.log('[publish] start', { accountId, materialId, isTest, manualConfirm: !!payload.manualConfirm });
    const result = await preparePublish(
      accountId,
      materialId,
      payload.publishTitle || '',
      payload.publishCaption || '',
      {
        autoPublish: !payload.manualConfirm,
        // ?????????????keepBrowser ????????? CDP
        keepOpen: isTest,
        deleteAfterPublish: !!payload.deleteAfterPublish,
      }
    );
    console.log('[publish] prepare result', {
      accountId,
      materialId,
      status: result?.status,
      videoId: result?.videoId || '',
    });
    if (result?.status === 'security_paused' || result?.status === 'manual_required') {
      // ???????????? Post????? mark-published???????????????
      liveLog(
        `Publish skipped (${result.status}) material #${materialId}  no mark-published until auto/resume success`,
        'warn',
        { accountId, materialId }
      );
      return { status: 'skipped', result, errorMessage: result.reason || result.status };
    }
    if (result?.status !== 'published') {
      throw new Error(result?.error || `publish incomplete: ${result?.status}`);
    }
    // preparePublish ?????? mark-published
    return {
      status: 'completed',
      result: {
        ...(result && typeof result === 'object' ? result : {}),
        materialId,
        accountId,
        deleteAfterPublish: !!payload.deleteAfterPublish,
        videoId: result?.videoId || '',
        videoUrl: result?.videoUrl || '',
      },
    };
  }

  if (type === 'message' || type === 'dm_reply') {
    const result = await prepareMessage(
      accountId,
      payload.content || payload.publishCaption || payload.reply || '',
      payload.recipient || payload.toUser || ''
    );
    return { status: 'completed', result };
  }

  if (type === 'dm_sync') {
    const { syncAccountDm } = require('./browser/tiktok-dm-sync');
    const result = await syncAccountDm(accountId, payload);
    return { status: 'completed', result };
  }

  if (type === 'warm') {
    const { runWarmAccount } = require('./browser/tiktok-warm');
    liveLog(
      `Account#${accountId} warm start (plan videos=${Number(payload?.executionPlan?.videoTotal || 0) || 'auto'})`,
      'info',
      { accountId, itemId: item.id, taskId }
    );
    const result = await runWarmAccount(accountId, payload);
    liveLog(
      `Account#${accountId} warm done browsed=${result?.browsed || 0} liked=${result?.liked || 0} commented=${result?.commented || 0}`,
      'info',
      { accountId, itemId: item.id, taskId }
    );
    return { status: 'completed', result };
  }

  if (type === 'ai_lead') {
    const { runAiLead } = require('./browser/ai-lead');
    liveLog(
      `Account#${accountId} AI?? start lead#${Number(payload?.leadId || taskId || 0)} type=${payload?.type || 'user'}`,
      'info',
      { accountId, itemId: item.id, taskId }
    );
    const result = await runAiLead(accountId, payload);
    liveLog(
      `Account#${accountId} AI?? done creators=${result?.creators || 0} leads=${result?.leads || 0}`,
      'info',
      { accountId, itemId: item.id, taskId }
    );
    return { status: 'completed', result };
  }

  if (type === 'diagnose') {
    const { runAccountDiagnose } = require('./browser/tiktok-diagnose');
    liveLog(
      `Account#${accountId} diagnose: Profile -> Studio -> Account Check`,
      'info',
      { accountId, itemId: item.id, source: payload.source || 'manual' }
    );
    const result = await runAccountDiagnose(accountId, {
      source: payload.source || 'manual',
    });
    if (result?.status && result.status !== 'ok') {
      throw new Error(result.error || 'diagnose failed');
    }
    return { status: 'completed', result };
  }

  if (type === 'pull_stats' || type === 'profile') {
    const { pullStudioStats } = require('./browser/tiktok-studio-stats');
    const result = await pullStudioStats(accountId, payload || {});
    if (result?.status && result.status !== 'ok') {
      throw new Error(result.error || result.message || 'pull stats failed');
    }
    return { status: 'completed', result };
  }

  if (type === 'sync') {
    let result = await syncVideos(accountId);
    return { status: 'completed', result };
  }

  if (type === 'delete_video') {
    const { batchDeleteTikTokVideos, deleteTikTokVideo } = require('./browser/tiktok-actions');
    const items = Array.isArray(payload.items) ? payload.items : [];
    const videoIds = Array.isArray(payload.videoIds)
      ? payload.videoIds
      : (payload.videoId ? [payload.videoId] : items.map((x) => x.videoId || x.video_id).filter(Boolean));
    let result;
    if (videoIds.length === 0 && (payload.keepLatest != null || payload.keep_latest != null)) {
      result = await batchDeleteTikTokVideos([accountId], {
        keepLatest: payload.keepLatest ?? payload.keep_latest,
        threads: 1,
      });
    } else if (videoIds.length > 1 || items.length > 1) {
      const out = [];
      const list = items.length
        ? items
        : videoIds.map((videoId) => ({ videoId, videoUrl: payload.videoUrl || payload.video_url || '' }));
      for (const it of list) {
        out.push(await deleteTikTokVideo(accountId, {
          videoId: it.videoId || it.video_id || '',
          videoUrl: it.videoUrl || it.video_url || '',
          materialId: it.materialId || it.material_id || 0,
          materialName: it.materialName || it.material_name || '',
          shareTitle: it.shareTitle || it.share_title || '',
          publishTitle: it.publishTitle || it.publish_title || '',
          description: it.description || '',
          searchTitle: it.searchTitle || it.publishTitle || it.shareTitle || it.materialName || '',
        }));
      }
      result = { items: out, deleted: out.filter((x) => x.status === 'ok').length };
    } else {
      const one = items[0] || {};
      result = await deleteTikTokVideo(accountId, {
        videoId: videoIds[0] || one.videoId || one.video_id || '',
        videoUrl: payload.videoUrl || payload.video_url || one.videoUrl || '',
        materialId: payload.materialId || one.materialId || one.material_id || 0,
        materialName: payload.materialName || one.materialName || one.material_name || '',
        shareTitle: payload.shareTitle || one.shareTitle || one.share_title || '',
        publishTitle: payload.publishTitle || one.publishTitle || one.publish_title || '',
        description: payload.description || one.description || '',
        searchTitle: payload.searchTitle || one.searchTitle || payload.publishTitle || one.publishTitle || payload.shareTitle || one.shareTitle || payload.materialName || one.materialName || '',
      });
      if (result?.status && result.status !== 'ok') {
        throw new Error(result.error || 'delete video failed');
      }
    }
    return { status: 'completed', result };
  }

  if (type === 'comment_reply') {
    const { runCommentReply } = require('./browser/tiktok-comment-reply');
    liveLog(
      `Account#${accountId} comment_reply start (max=${Number(payload.maxReplies || payload.max_replies || 10)}, mode=${payload.replyMode || payload.commentMode || 'fixed'})`,
      'info',
      logCtx
    );
    const result = await runCommentReply(accountId, payload || {});
    liveLog(
      `Account#${accountId} comment_reply done replied=${result?.replied || 0} videos=${result?.videosVisited || 0}`,
      'info',
      logCtx
    );
    if (result?.status && result.status !== 'ok' && result.status !== 'completed') {
      throw new Error(result.error || 'comment reply failed');
    }
    return { status: 'completed', result };
  }

  if (type === 'sync_fans') {
    throw new Error('sync_fans executor not implemented');
  }

  throw new Error(`unsupported work item type: ${type}${taskId ? ` (task#${taskId})` : ''}`);
}

async function executeWorkBatch(batch) {
  const batchId = Number(batch.id);
  const account = batch.account || {};
  const accountId = Number(batch.account_id || account.id);
  const profileId = String(batch.browser_profile_id || account.browser_profile_id || '');
  if (profileId) account.browser_profile_id = profileId;

  // keepBrowser????????????????????????????
  return runWithSession({ browserProfileId: profileId, batchId, accountId, keepBrowser: true }, async () => {
    liveLog(
      `Start batch #${batchId} account#${accountId} (${account.username || ''}) env ${profileId ? `${profileId.slice(0, 8)}` : 'none'} (keep browser until batch done)`,
      'info',
      { accountId, batchId, profileId }
    );

    let success = 0;
    let fail = 0;
    let emptyRounds = 0;
    const heartbeatTimer = setInterval(() => {
      phpApi.post(`/node/work-batches/${batchId}/heartbeat`, {
        workerId: WORKER_ID,
        leaseSeconds: 300,
      }).catch(() => {});
    }, 60000);
    heartbeatTimer.unref?.();

    try {
      if (!profileId) {
        throw new Error('no Bit browser env for this account');
      }

      liveLog(`Opening Bit env ${profileId.slice(0, 8)} (stay open for whole batch)`, 'info', { accountId, batchId, profileId });
      const boot = await connectAccount(accountId, null, 'warm', { browserProfileId: profileId });
      // ?? CDP???????
      await closeConnection(boot).catch(() => {});

      await ensureAccountLogin(account);

      for (;;) {
        let processed = 0;
        for (;;) {
          const item = await phpApi.post(`/node/work-batches/${batchId}/claim-item`, {
            workerId: WORKER_ID,
          });
          if (!item || !item.id) break;
          processed += 1;
          emptyRounds = 0;

          liveLog(
            `Batch#${batchId} item#${item.id} ${item.task_type}`,
            'info',
            { accountId, batchId, itemId: item.id }
          );

          try {
            const out = await executeWorkItem(item);
            await phpApi.post(`/node/work-batches/${batchId}/items/${item.id}/result`, {
              workerId: WORKER_ID,
              status: out.status || 'completed',
              result: out.result || {},
              errorMessage: out.errorMessage || '',
            });
            if ((out.status || 'completed') === 'completed') success += 1;
          } catch (error) {
            fail += 1;
            await phpApi.post(`/node/work-batches/${batchId}/items/${item.id}/result`, {
              workerId: WORKER_ID,
              status: 'failed',
              errorMessage: error.message,
            }).catch(() => {});
            liveLog(
              `Batch#${batchId} item#${item.id} failed: ${error.message}`,
              'error',
              { accountId, batchId, itemId: item.id }
            );
          }
        }

        let finished;
        try {
          finished = await phpApi.post(`/node/work-batches/${batchId}/finish`, {
            workerId: WORKER_ID,
          });
        } catch (finishErr) {
          liveLog(`Batch#${batchId} finish failed: ${finishErr.message}, releasing`, 'warn', { batchId });
          await releaseOfferedBatch(batchId, finishErr.message || 'finish failed');
          break;
        }

        if (finished?.status === 'paused' || finished?.status === 'cancelled') {
          liveLog(
            `Batch #${batchId} ${finished.status}: ok ${success}, fail ${fail}`,
            'info',
            { accountId, batchId }
          );
          break;
        }
        if (finished?.has_more) {
          if (processed === 0) {
            emptyRounds += 1;
            if (emptyRounds >= 3) {
              liveLog(`Batch#${batchId} cannot claim items, releasing`, 'warn', { batchId });
              await releaseOfferedBatch(batchId, 'cannot claim items');
              break;
            }
            await new Promise((r) => setTimeout(r, 500));
          }
          continue;
        }
        liveLog(
          `Batch #${batchId} done: ok ${success}, fail ${fail}, status ${finished?.status || ''}`,
          'info',
          { accountId, batchId }
        );
        break;
      }
    } catch (error) {
      liveLog(`Batch #${batchId} error: ${error.message}`, 'error', { accountId, batchId });
      await releaseOfferedBatch(batchId, error.message || 'execute error').catch(() => {});
      throw error;
    } finally {
      clearInterval(heartbeatTimer);
      if (profileId) {
        liveLog(`Closing Bit env ${profileId.slice(0, 8)} (batch #${batchId} finished)`, 'info', { accountId, batchId, profileId });
        try {
          await closeSession(profileId);
        } catch {
          /* ignore */
        }
        try {
          await forceCloseBrowserProfile(profileId);
        } catch {
          /* ignore */
        }
      }
    }
  });
}

async function releaseOfferedBatch(batchId, reason = 'frontend did not accept') {
  executorHub.clearOfferedEverywhere(batchId);
  try {
    await phpApi.post(`/node/work-batches/${batchId}/release`, {
      workerId: WORKER_ID,
    });
  } catch { /* ignore */ }
  liveLog(`Batch #${batchId} released to queue: ${reason}`, 'warn', { batchId });
}

async function offerBatchToFrontend(batch, reasonTag = 'push') {
  if (!batch || !batch.id) return false;
  const id = Number(batch.id);
  if (pendingOffers.has(id) || runningLocal.has(id)) return false;

  const push = executorHub.pushWork(batch);
  if (!push?.ok) {
    await releaseOfferedBatch(id, push?.reason || 'no matching online executor');
    return false;
  }

  pendingOffers.set(id, { batch, at: Date.now(), ownerId: Number(batch.owner_id || 0) });
  const taskLabel = String(batch.task_label || batch.taskLabel || '');
  liveLog(
    `${reasonTag} batch #${id}${taskLabel ? ` [${taskLabel}]` : ''} (account#${batch.account_id || batch.account?.id || ''} owner#${batch.owner_id || '-'})`,
    'info',
    { batchId: id, accountId: batch.account_id, ownerId: batch.owner_id, taskLabel }
  );
  executorHub.broadcastExecutorStatus({ lastPushedBatchId: id });
  return true;
}

function cleanupStaleOffers() {
  const now = Date.now();
  for (const [id, offer] of pendingOffers) {
    if (now - offer.at > OFFER_TTL_MS) {
      pendingOffers.delete(id);
      releaseOfferedBatch(id, 'offer TTL timeout');
    }
  }
}

async function acceptAndRunBatch(batch) {
  const batchId = Number(batch?.id || 0);
  if (!batchId) throw new Error('missing batchId');
  if (runningLocal.has(batchId)) {
    return { ok: true, batchId, already: true };
  }
  const offer = pendingOffers.get(batchId);
  const payload = offer?.batch || batch;
  pendingOffers.delete(batchId);

  if (activeBatchCount >= MAX_CONCURRENT_BATCHES) {
    await releaseOfferedBatch(batchId, `concurrent full (max ${MAX_CONCURRENT_BATCHES})`);
    throw new Error(`concurrent full (max ${MAX_CONCURRENT_BATCHES})`);
  }

  activeBatchCount += 1;
  runningLocal.add(batchId);
  try {
    await phpApi.post(`/node/work-batches/${batchId}/mark-executing`, {
      workerId: WORKER_ID,
    }).catch(() => {});
    await executeWorkBatch(payload);
    executorHub.notifyWorkDone(batchId, { status: 'completed' });
    return { ok: true, batchId };
  } catch (err) {
    executorHub.notifyWorkDone(batchId, { status: 'failed', error: err.message });
    throw err;
  } finally {
    runningLocal.delete(batchId);
    activeBatchCount = Math.max(0, activeBatchCount - 1);
    executorHub.clearOfferedEverywhere(batchId);
  }
}

/**
 * Claim by current logged-in owner; fill free Bit slots only (max 3).
 * Do not push while offered/executing occupy slots.
 */
async function tick() {
  if (claiming) return;
  claiming = true;
  try {
    cleanupStaleOffers();

    await phpApi.post('/node/work-batches/reclaim', {
      workerId: WORKER_ID,
    }).catch(() => null);

    const clients = executorHub.listEnabledClients();
    if (!clients.length) return;

    const freeSlots = () => MAX_CONCURRENT_BATCHES - activeBatchCount - pendingOffers.size;

    // Only re-offer orphans with push_status=offered (executing excluded by PHP)
    if (freeSlots() > 0) {
      const reclaim = await phpApi.post('/node/work-batches/reclaim', {
        workerId: WORKER_ID,
      }).catch(() => null);
      const orphans = Array.isArray(reclaim?.claimed) ? reclaim.claimed : [];
      for (const batch of orphans) {
        if (freeSlots() <= 0) break;
        await offerBatchToFrontend(batch, 're-offer');
      }
    }

    for (const client of clients) {
      while (freeSlots() > 0) {
        const batch = await phpApi.runWithRequest(
          {
            headers: {
              authorization: client.token ? `Bearer ${client.token}` : '',
              'x-acting-as': client.actingAs || '',
            },
          },
          () => phpApi.post('/node/work-batches/claim', {
            workerId: WORKER_ID,
            leaseSeconds: 300,
            ownerId: client.ownerId,
          })
        ).catch((e) => {
          if (!/404|empty|no pending/i.test(e.message || '')) {
            console.error('[task-runner] claim', e.message);
          }
          return null;
        });

        if (!batch || !batch.id) break;

        const batchOwner = Number(batch.owner_id || 0);
        if (batchOwner > 0 && batchOwner !== Number(client.ownerId)) {
          await releaseOfferedBatch(batch.id, `owner mismatch (batch=${batchOwner}, client=${client.ownerId})`);
          break;
        }

        const ok = await offerBatchToFrontend(batch);
        if (!ok) break;
      }
    }
  } finally {
    claiming = false;
  }
}

function startTaskRunner() {
  const timer = setInterval(() => { tick(); }, 5000);
  timer.unref?.();
  console.log(`[INFO] task-runner: WSS push mode (max ${MAX_CONCURRENT_BATCHES} slots; owner-scoped; need executor ON)`);
}

function getExecutorStats() {
  return {
    maxConcurrent: MAX_CONCURRENT_BATCHES,
    activeBatchCount,
    pendingOffers: pendingOffers.size,
    onlineExecutors: executorHub.countEnabled(),
    workerId: WORKER_ID,
  };
}

async function loadBatchPack(batchId) {
  const pack = await phpApi.get(`/account-work-batches/${batchId}/items`);
  if (!pack?.batch) throw new Error(`batch #${batchId} not found`);
  return pack;
}

async function resolveProfileId(accountId, batch) {
  const fromBatch = String(batch?.browser_profile_id || '');
  if (fromBatch) return fromBatch;
  const bundle = await phpApi.get(`/node/accounts/${accountId}/bundle`).catch(() => null);
  return String(bundle?.browser_profile_id || '');
}

/** For manual test: prefer live Bit TikTok session; sync PHP status; only then one-click login. */
async function ensureTestAccountReady(accountId, profileId, hint = {}) {
  const dataStore = require('./data-store');
  const bundle = await phpApi.get(`/node/accounts/${accountId}/bundle`).catch(() => null);
  const account = {
    id: accountId,
    username: hint.username || bundle?.username || '',
    browser_profile_id: profileId || String(bundle?.browser_profile_id || ''),
    login_status: String(bundle?.login_status || 'offline'),
    has_session: Boolean(bundle?.has_session || bundle?.cookie),
  };
  if (!account.browser_profile_id) throw new Error('account has no Bit browser env');

  // User may already be logged in inside Bit while PHP still says offline.
  // Probe via CDP but do NOT provider.close  keep Bit window open.
  try {
    liveLog(`Test account#${accountId}: probe Bit TikTok session`, 'info', { accountId });
    const boot = await connectAccount(accountId, 'https://www.tiktok.com/', 'warm', {
      browserProfileId: account.browser_profile_id,
    });
    try {
      const session = await inspectTikTokSession(boot.ws, boot.page);
      if (session?.loggedIn) {
        await dataStore.updateLoginStatus(accountId, 'online').catch(() => {});
        liveLog(`Test account#${accountId}: Bit already logged in, synced online`, 'info', { accountId });
        account.login_status = 'online';
        account.has_session = true;
        return account;
      }
    } finally {
      await boot.browser?.close?.().catch(() => {});
    }
  } catch (probeErr) {
    liveLog(`Test account#${accountId}: Bit probe failed: ${probeErr.message}`, 'warn', { accountId });
  }

  if (account.login_status === 'online' || account.has_session) {
    return account;
  }

  liveLog(`Test account#${accountId} offline, start one-click login`, 'info', { accountId });
  const login = await fullLogin(accountId);
  if (!(login?.loginOk || login?.alreadyLoggedIn)) {
    throw new Error(login?.message || 'login incomplete: click Login on account list first');
  }
  account.login_status = 'online';
  account.has_session = true;
  return account;
}

/** Manual test: open Bit and run one item (no WSS claim). */
async function testRunItem({ batchId, itemId }) {
  const key = `item:${itemId}`;
  if (testingLocal.has(key) || testingLocal.has(`batch:${batchId}`)) {
    throw new Error('this task is already running a test');
  }
  testingLocal.add(key);
  try {
    const pack = await loadBatchPack(batchId);
    const item = (pack.items || []).find((x) => Number(x.id) === Number(itemId));
    if (!item) throw new Error(`item #${itemId} not found`);
    if (item.status === 'cancelled') throw new Error('cancelled item cannot be tested');

    const accountId = Number(item.account_id || pack.batch.account_id);
    const profileId = await resolveProfileId(accountId, pack.batch);
    if (!profileId) throw new Error('account has no Bit browser env');

    liveLog(`Test item #${itemId} ${item.task_type} (batch #${batchId})`, 'info', {
      batchId, itemId, accountId,
    });

    return runWithSession({ browserProfileId: profileId, batchId, accountId, test: true }, async () => {
      await ensureTestAccountReady(accountId, profileId, { username: pack.batch.username || '' });
      const out = await executeWorkItem(item);
      liveLog(
        `Test item #${itemId} done: ${out.status || 'completed'}`,
        out.status === 'failed' ? 'error' : 'info',
        { batchId, itemId, accountId }
      );
      return {
        ok: true,
        batchId: Number(batchId),
        itemId: Number(itemId),
        taskType: item.task_type,
        status: out.status || 'completed',
        result: out.result || null,
        errorMessage: out.errorMessage || '',
      };
    });
  } finally {
    testingLocal.delete(key);
  }
}

/** Manual test: open Bit and run batch items in priority/seq order. */
async function testRunBatch({ batchId }) {
  const key = `batch:${batchId}`;
  if (testingLocal.has(key)) {
    throw new Error('this batch is already running a test');
  }
  testingLocal.add(key);
  try {
    const pack = await loadBatchPack(batchId);
    const batch = pack.batch;
    const items = (pack.items || [])
      .filter((x) => x.status !== 'cancelled' && x.status !== 'deleted')
      .slice()
      .sort((a, b) => {
        const p = Number(a.priority || 0) - Number(b.priority || 0);
        if (p !== 0) return p;
        const seq = Number(a.seq || 0) - Number(b.seq || 0);
        if (seq !== 0) return seq;
        return Number(a.id) - Number(b.id);
      });
    if (!items.length) throw new Error('batch has no testable items');

    const accountId = Number(batch.account_id);
    const profileId = await resolveProfileId(accountId, batch);
    if (!profileId) throw new Error('account has no Bit browser env');

    liveLog(`Test batch #${batchId}, ${items.length} items`, 'info', { batchId, accountId });

    return runWithSession({ browserProfileId: profileId, batchId, accountId, test: true }, async () => {
      await ensureTestAccountReady(accountId, profileId, { username: batch.username || '' });
      const results = [];
      let success = 0;
      let fail = 0;
      for (const item of items) {
        liveLog(`Test run item #${item.id} ${item.task_type}`, 'info', {
          batchId, itemId: item.id, accountId,
        });
        try {
          const out = await executeWorkItem(item);
          const status = out.status || 'completed';
          if (status === 'completed') success += 1;
          else if (status === 'failed') fail += 1;
          results.push({
            itemId: Number(item.id),
            taskType: item.task_type,
            status,
            errorMessage: out.errorMessage || '',
          });
        } catch (error) {
          fail += 1;
          results.push({
            itemId: Number(item.id),
            taskType: item.task_type,
            status: 'failed',
            errorMessage: error.message || 'failed',
          });
          liveLog(`Test item #${item.id} failed: ${error.message}`, 'error', {
            batchId, itemId: item.id, accountId,
          });
        }
      }
      liveLog(`Test batch #${batchId} done: ok ${success}, fail ${fail}`, 'info', { batchId, accountId });
      return {
        ok: true,
        batchId: Number(batchId),
        total: items.length,
        success,
        fail,
        results,
      };
    });
  } finally {
    testingLocal.delete(key);
  }
}

/**
 * ????? WSS ???? batch?AI????????
 */
async function offerSpecificBatch(batchId) {
  const id = Number(batchId || 0);
  if (!id) throw new Error('?? batchId');
  if (!executorHub.hasEnabled()) {
    throw new Error('????????????');
  }
  const batch = await phpApi.post('/node/work-batches/claim-one', {
    batchId: id,
    workerId: WORKER_ID,
    leaseSeconds: 300,
  });
  if (!batch || !batch.id) {
    throw new Error('????? batch???????????');
  }
  const ok = await offerBatchToFrontend(batch, 'offer-one');
  if (!ok) {
    throw new Error('WSS ????????????????');
  }
  return { ok: true, batchId: Number(batch.id), taskLabel: batch.task_label || '' };
}

module.exports = {
  startTaskRunner,
  tick,
  WORKER_ID,
  MAX_CONCURRENT_BATCHES,
  acceptAndRunBatch,
  getExecutorStats,
  executeWorkBatch,
  executeWorkItem,
  executePhpTask,
  testRunBatch,
  testRunItem,
  offerSpecificBatch,
};
