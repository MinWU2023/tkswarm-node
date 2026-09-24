const { chromium } = require('playwright-core');
const { BitBrowserProvider } = require('./bit-browser-provider');
const { inspectTikTokSession } = require('./cdp-client');
const { inspectPage, capture, classify } = require('../automation-guard');
const dataStore = require('../data-store');
const phpApi = require('../php-api');
const { waitForSlot } = require('../action-rate-limit');
const { isHeadless } = require('./headless');

async function connectAccount(accountId, url, action = 'publish') {
  const bundle = await dataStore.getAccountBundle(accountId);
  if (!bundle) throw new Error('账号不存在');
  if (!bundle.browser_profile_id) throw new Error('账号尚未绑定浏览器环境');
  const account = {
    id: bundle.id,
    username: bundle.username,
    browser_profile_id: bundle.browser_profile_id,
  };
  const provider = new BitBrowserProvider();
  const opened = await provider.open(account.browser_profile_id, { headless: isHeadless(action) });
  if (!opened?.ws) throw new Error('比特浏览器未返回 CDP 地址');
  const browser = await chromium.connectOverCDP(opened.ws, { timeout: 30000 });
  const context = browser.contexts()[0];
  const page = context.pages().find((p) => /tiktok\.com/i.test(p.url())) || context.pages()[0] || await context.newPage();
  await page.bringToFront().catch(() => {});
  if (url) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
  } else {
    await page.waitForTimeout(1500);
  }
  return { account, provider, browser, page, ws: opened.ws };
}
async function closeConnection(connection){if(!connection)return;await connection.browser.close().catch(()=>{});await connection.provider.close(connection.account.browser_profile_id).catch(()=>{});}

async function findFileInput(page, waitMs = 15000) {
  const end = Date.now() + waitMs;
  while (Date.now() < end) {
    const pages = [page, ...page.frames().filter(frame => frame !== page.mainFrame())];
    for (const target of pages) {
      const input = target.locator('input[type="file"]').first();
      if (await input.count().catch(() => 0)) return input;
    }
    await page.waitForTimeout(500);
  }
  return null;
}

async function activateUploadSurface(page) {
  const labels = /^(?:Upload|Select video|Select video to upload|上传视频|选择视频)$/i;
  const candidates = [
    page.getByRole('button', { name: labels }).first(),
    page.getByRole('link', { name: labels }).first(),
    page.getByText(labels).first(),
  ];
  for (const candidate of candidates) {
    if (await candidate.count().catch(() => 0) && await candidate.isVisible().catch(() => false)) {
      await candidate.scrollIntoViewIfNeeded().catch(() => {});
      await candidate.click().catch(() => {});
      await page.waitForTimeout(1000);
      return true;
    }
  }
  return false;
}

async function readSetting(key, fallback) {
  try {
    return await dataStore.getSetting(key, fallback);
  } catch {
    return fallback;
  }
}

async function loadMaterial(materialId) {
  const fs = require('node:fs');
  const path = require('node:path');
  const os = require('node:os');
  let material;
  try {
    material = await phpApi.get(`/node/materials/${materialId}`);
  } catch (e) {
    throw new Error(e.message || '素材不存在');
  }
  if (!material) throw new Error('素材不存在');
  const localPath = material.file_path || material.filePath || '';
  if (localPath && fs.existsSync(localPath)) {
    material.file_path = localPath;
    material.filePath = localPath;
    return material;
  }
  const downloadUrl = material.downloadUrl || material.download_url || `/api/materials/${materialId}/stream`;
  const ext = path.extname(material.file_name || material.fileName || '.mp4') || '.mp4';
  const tmpDir = path.join(os.tmpdir(), 'tkswarm-materials');
  fs.mkdirSync(tmpDir, { recursive: true });
  const dest = path.join(tmpDir, `m-${materialId}-${Date.now()}${ext}`);
  await phpApi.download(downloadUrl, dest);
  material.file_path = dest;
  material.filePath = dest;
  return material;
}

async function clickPostButton(page) {
  const namePatterns = [
    /^Post$/i, /^Publish$/i, /^Post now$/i, /^发布$/, /^投稿$/, /^发布视频$/,
  ];
  const targets = [page, ...page.frames().filter((frame) => frame !== page.mainFrame())];
  for (const target of targets) {
    for (const pattern of namePatterns) {
      const button = target.getByRole('button', { name: pattern }).first();
      if (await button.count().catch(() => 0) && await button.isVisible().catch(() => false)) {
        const disabled = await button.isDisabled().catch(() => false);
        if (disabled) continue;
        await button.click({ timeout: 8000 });
        return true;
      }
    }
    for (const selector of [
      'button[data-e2e="post_video_button"]',
      'button[data-e2e="publish-button"]',
      '[data-e2e="post_video_button"]',
      'button[class*="post" i]',
    ]) {
      const button = target.locator(selector).first();
      if (!(await button.count().catch(() => 0))) continue;
      if (!(await button.isVisible().catch(() => false))) continue;
      const disabled = await button.isDisabled().catch(() => false);
      if (disabled) continue;
      await button.click({ timeout: 8000 }).catch(() => null);
      return true;
    }
  }
  // 兜底：页面可见文案匹配
  for (const target of targets) {
    const byText = target.locator('button, [role="button"]').filter({ hasText: /^(Post|Publish|Post now|发布|投稿)$/i }).first();
    if (await byText.count().catch(() => 0) && await byText.isVisible().catch(() => false)) {
      const disabled = await byText.isDisabled().catch(() => false);
      if (!disabled) {
        await byText.click({ timeout: 8000 });
        return true;
      }
    }
  }
  return false;
}

async function waitPublishOutcome(page, timeoutMs = 120000) {
  const end = Date.now() + timeoutMs;
  const successText = /uploaded successfully|has been uploaded|posted successfully|your video was (uploaded|posted)|发布成功|已发布|上传成功|视频已发布|作品已发布/i;
  const inProgressText = /being uploaded|uploading|processing|上传中|正在上传|处理中/i;
  while (Date.now() < end) {
    const security = await inspectPage(page);
    if (security.blocked) return { status: 'security_paused', reason: security.reason };
    const url = page.url() || '';
    // 离开上传页进入内容管理/个人页，通常表示已提交
    if (/tiktok\.com\/(@|content|tiktokstudio\/content)/i.test(url) && !/upload/i.test(url)) {
      return { status: 'published', via: 'url' };
    }
    const text = await page.evaluate(() => (document.body?.innerText || '').slice(0, 8000)).catch(() => '');
    if (successText.test(text) && !inProgressText.test(text)) {
      return { status: 'published', via: 'text' };
    }
    if (successText.test(text) && /uploaded successfully|posted successfully|发布成功|已发布|上传成功|视频已发布/i.test(text)) {
      return { status: 'published', via: 'text-strong' };
    }
    await page.waitForTimeout(2000);
  }
  return { status: 'timeout' };
}
async function clickSendButton(page) {
  const names = ['Send', '发送', 'Message'];
  const targets = [page, ...page.frames().filter(frame => frame !== page.mainFrame())];
  for (const target of targets) {
    for (const name of names) {
      const button = target.getByRole('button', { name: new RegExp(`^${name}$`, 'i') }).first();
      if (await button.count().catch(() => 0) && await button.isVisible().catch(() => false)) {
        const disabled = await button.isDisabled().catch(() => false);
        if (disabled) continue;
        await button.click({ timeout: 8000 });
        return true;
      }
    }
  }
  return false;
}

async function fillMessageEditor(page, content) {
  const editors = [
    page.locator('[data-e2e="message-input-area"] [contenteditable="true"]').last(),
    page.locator('[contenteditable="true"]').last(),
    page.locator('textarea').last(),
  ];
  for (const editor of editors) {
    if (!(await editor.count().catch(() => 0))) continue;
    if (!(await editor.isVisible().catch(() => false))) continue;
    await editor.click({ timeout: 5000 }).catch(() => {});
    await editor.fill(content).catch(async () => {
      await page.keyboard.press('Control+A').catch(() => {});
      await page.keyboard.type(content, { delay: 10 });
    });
    return true;
  }
  return false;
}

async function openRecipientChat(page, recipient) {
  const handle = String(recipient || '').replace(/^@/, '').trim();
  if (!handle) return false;

  await page.goto(`https://www.tiktok.com/@${encodeURIComponent(handle)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const profileMessage = page.getByRole('button', { name: /^(Message|私信|发私信|Messages)$/i }).first();
  if (await profileMessage.count().catch(() => 0) && await profileMessage.isVisible().catch(() => false)) {
    await profileMessage.click().catch(() => {});
    await page.waitForTimeout(2500);
    if (await page.locator('textarea,[contenteditable="true"]').count().catch(() => 0)) return true;
  }

  await page.goto('https://www.tiktok.com/messages', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const search = page.locator('input[placeholder*="Search"],input[placeholder*="搜索"],input[type="search"]').first();
  if (await search.count().catch(() => 0)) {
    await search.fill(handle).catch(async () => {
      await search.click();
      await page.keyboard.type(handle);
    });
    await page.waitForTimeout(1500);
    const hit = page.getByText(handle, { exact: false }).first();
    if (await hit.count().catch(() => 0)) {
      await hit.click().catch(() => {});
      await page.waitForTimeout(1500);
      return true;
    }
  }
  const newChat = page.getByRole('button', { name: /^(New chat|新建聊天|Compose)$/i }).first();
  if (await newChat.count().catch(() => 0)) {
    await newChat.click().catch(() => {});
    await page.waitForTimeout(1000);
    const composeInput = page.locator('input').first();
    if (await composeInput.count().catch(() => 0)) {
      await composeInput.fill(handle).catch(() => {});
      await page.waitForTimeout(1200);
      const option = page.getByText(handle, { exact: false }).first();
      if (await option.count().catch(() => 0)) await option.click().catch(() => {});
    }
  }
  return Boolean(await page.locator('textarea,[contenteditable="true"]').count().catch(() => 0));
}

async function prepareMessage(accountId, content, recipient = '', options = {}) {
  const wait = waitForSlot(`message:${accountId}`, 3000);
  if (wait) await new Promise(resolve => setTimeout(resolve, wait));
  const autoSend = options.autoSend === true;
  const connection = await connectAccount(accountId, 'https://www.tiktok.com/messages', 'message');
  let keepOpen = false;
  try {
    const session = await inspectTikTokSession(connection.ws);
    if (!session.loggedIn) throw new Error('当前浏览器没有有效 TikTok 登录状态');
    const before = await capture(connection.page, accountId, 'message', 'before');
    const security = await inspectPage(connection.page);
    if (security.blocked) {
      keepOpen = true;
      return { status: 'security_paused', reason: security.reason, screenshot: before, manualRequired: true };
    }
    if (recipient) {
      const opened = await openRecipientChat(connection.page, recipient);
      if (!opened) {
        keepOpen = true;
        return {
          status: 'failed',
          error: `未能打开与 ${recipient} 的会话，请确认用户名正确且账号已登录`,
          screenshot: before,
          recipient,
        };
      }
    }
    const filled = await fillMessageEditor(connection.page, content);
    if (!filled) throw new Error('未找到消息输入控件');
    const prepared = await capture(connection.page, accountId, 'message', 'prepared');
    const after = await inspectPage(connection.page);
    if (after.blocked) {
      keepOpen = true;
      return { status: 'security_paused', reason: after.reason, screenshot: prepared, manualRequired: true };
    }
    if (!autoSend) {
      keepOpen = true;
      return { status: 'manual_required', manualRequired: true, screenshot: prepared, recipient, contentLength: String(content).length };
    }
    const clicked = await clickSendButton(connection.page);
    if (!clicked) {
      await connection.page.keyboard.press('Enter').catch(() => {});
      await connection.page.waitForTimeout(800);
    }
    const sentShot = await capture(connection.page, accountId, 'message', 'sent').catch(() => prepared);
    const blocked = await inspectPage(connection.page);
    if (blocked.blocked) {
      keepOpen = true;
      return { status: 'security_paused', reason: blocked.reason, screenshot: sentShot, manualRequired: true };
    }
    return { status: 'sent', screenshot: sentShot, recipient, contentLength: String(content).length, clicked: clicked || 'enter' };
  } finally {
    if (!keepOpen) await closeConnection(connection);
  }
}

async function sendBitMessageBatch(accountId, items = [], options = {}) {
  const wait = waitForSlot(`message:${accountId}`, 3000);
  if (wait) await new Promise(resolve => setTimeout(resolve, wait));
  const interval = Math.min(60000, Math.max(0, Number(options.interval) || 800));
  const connection = await connectAccount(accountId, 'https://www.tiktok.com/messages', 'message');
  let keepOpen = false;
  const results = [];
  try {
    const session = await inspectTikTokSession(connection.ws);
    if (!session.loggedIn) throw new Error('当前浏览器没有有效 TikTok 登录状态');
    for (const item of items) {
      const recipient = item.recipient || item.uid || item.username || '';
      const content = item.content || '';
      try {
        const security = await inspectPage(connection.page);
        if (security.blocked) {
          keepOpen = true;
          results.push({ ...item, ok: false, status: 'security_paused', reason: security.reason });
          break;
        }
        if (recipient) {
          const opened = await openRecipientChat(connection.page, recipient);
          if (!opened) {
            results.push({ ...item, ok: false, status: 'failed', reason: `未能打开会话：${recipient}` });
            if (interval) await connection.page.waitForTimeout(interval);
            continue;
          }
        }
        const filled = await fillMessageEditor(connection.page, content);
        if (!filled) {
          results.push({ ...item, ok: false, status: 'failed', reason: '未找到消息输入控件' });
          continue;
        }
        let clicked = await clickSendButton(connection.page);
        if (!clicked) {
          await connection.page.keyboard.press('Enter').catch(() => {});
          clicked = true;
        }
        await connection.page.waitForTimeout(800);
        results.push({ ...item, ok: true, status: 'sent', clicked });
      } catch (error) {
        results.push({ ...item, ok: false, status: 'failed', reason: error.message });
      }
      if (interval) await connection.page.waitForTimeout(interval);
    }
    return { results, paused: results.some(row => row.status === 'security_paused') };
  } finally {
    if (!keepOpen) await closeConnection(connection);
  }
}

async function preparePublish(accountId, materialId, title='', caption='', options={}) {
  const wait=waitForSlot(`publish:${accountId}`,3000); if(wait) await new Promise(resolve=>setTimeout(resolve,wait));
  const material=await loadMaterial(materialId);
  if(!material) throw new Error('素材不存在');
  const status = material.status || 'ready';
  if(status!=='ready') throw new Error('素材状态不可用');
  const filePath = material.file_path || material.filePath || '';
  if (!filePath) throw new Error('素材文件路径为空（请确认 PHP 素材可被本机访问）');
  material.file_path = filePath;
  material.file_name = material.file_name || material.fileName || '';
  const autoPublish = options.autoPublish !== undefined ? Boolean(options.autoPublish) : !(await readSetting('publishManualConfirm', false));
  const saveTraffic = Boolean(options.saveTraffic);
  const connection=await connectAccount(accountId,'https://www.tiktok.com/upload','publish'); let keepOpen=false; try {
    const pause = (ms) => connection.page.waitForTimeout(saveTraffic ? Math.min(ms, 1500) : ms);
    const session=await inspectTikTokSession(connection.ws); if(!session.loggedIn) throw new Error('当前浏览器没有有效 TikTok 登录状态');
    const before=saveTraffic?null:await capture(connection.page,accountId,'publish','before'); const security=await inspectPage(connection.page);
    if(security.blocked){keepOpen=true;return {status:'security_paused',reason:security.reason,screenshot:before||'',manualRequired:true};}
    let fileSelected=false; let input=await findFileInput(connection.page, saveTraffic ? 800 : 1000);
    if(!input){
      await activateUploadSurface(connection.page);
      input=await findFileInput(connection.page, saveTraffic ? 6000 : 10000);
    }
    if(!input){
      const uploadLink=connection.page.getByRole('link',{name:/^Upload$/i}).first();
      if(await uploadLink.count()){ await uploadLink.click().catch(()=>{}); await pause(3500); }
      input=await findFileInput(connection.page, saveTraffic ? 3000 : 5000);
    }
    if(!input){
      const uploadButton=connection.page.getByRole('button',{name:/^Upload$/i}).first();
      if(await uploadButton.count()){
        const chooserPromise=connection.page.waitForEvent('filechooser',{timeout:7000}).catch(()=>null);
        await uploadButton.click().catch(()=>{}); const chooser=await chooserPromise;
        if(chooser){await chooser.setFiles(material.file_path);fileSelected=true;await pause(2000);}
      }
      input=await findFileInput(connection.page, saveTraffic ? 3000 : 5000);
    }
    if(!input && !fileSelected){
      await connection.page.goto('https://www.tiktok.com/tiktokstudio/upload',{waitUntil:'domcontentloaded',timeout:60000}).catch(()=>{}); await pause(4000);
      input=await findFileInput(connection.page, saveTraffic ? 6000 : 10000);
    }
    if(!input){
      const info=await inspectPage(connection.page); const dom=await connection.page.evaluate(()=>({title:document.title,inputs:[...document.querySelectorAll('input')].map(x=>({type:x.type,accept:x.accept,placeholder:x.placeholder})).slice(0,20),buttons:[...document.querySelectorAll('button,[role=button]')].map(x=>(x.innerText||x.getAttribute('aria-label')||'').trim()).filter(Boolean).slice(0,30),text:(document.body?.innerText||'').replace(/\s+/g,' ').slice(0,500)})).catch(()=>({}));
      throw new Error(`未找到视频上传控件（当前页面：${info.url||connection.page.url()}；标题：${dom.title||'-'}；输入框：${dom.inputs?.length||0}；按钮：${(dom.buttons||[]).join('|').slice(0,240)}；文本：${dom.text||'-'})`);
    }
    if(!fileSelected){await input.setInputFiles(material.file_path);} await pause(4000);
    const textareas=connection.page.locator('textarea'); if(title||caption) await textareas.first().fill(`${title}${title&&caption?'\n':''}${caption}`).catch(()=>{});
    const prepared=await capture(connection.page,accountId,'publish','prepared'); const after=await inspectPage(connection.page);
    if(after.blocked){keepOpen=true;return {status:'security_paused',reason:after.reason,screenshot:prepared,manualRequired:true};}
    if(!autoPublish){
      keepOpen=true; return {status:'manual_required',manualRequired:true,screenshot:prepared,material:{id:material.id,name:material.name,fileName:material.file_name}};
    }
    const clicked=await clickPostButton(connection.page);
    if(!clicked){
      keepOpen=true;
      return {status:'failed',error:'未找到发布按钮，已保留浏览器页面',screenshot:prepared,material:{id:material.id,name:material.name,fileName:material.file_name}};
    }
    const outcome=await waitPublishOutcome(connection.page, saveTraffic ? 90000 : 120000);
    const shot=saveTraffic?prepared:await capture(connection.page,accountId,'publish','posted').catch(()=>prepared);
    if(outcome.status==='security_paused'){keepOpen=true;return {status:'security_paused',reason:outcome.reason,screenshot:shot,manualRequired:true};}
    if(outcome.status==='published'){return {status:'published',screenshot:shot,material:{id:material.id,name:material.name,fileName:material.file_name}};}
    keepOpen=true;
    return {status:'failed',error:'已点击发布，但未确认成功',screenshot:shot,material:{id:material.id,name:material.name,fileName:material.file_name}};
  } finally { if(!keepOpen) await closeConnection(connection); }
}

async function resumePublish(accountId, options = {}) {
  const wait = waitForSlot(`publish:${accountId}`, 3000);
  if (wait) await new Promise(resolve => setTimeout(resolve, wait));
  const saveTraffic = Boolean(options.saveTraffic);
  const connection = await connectAccount(accountId, '', 'publish');
  let keepOpen = false;
  try {
    const session = await inspectTikTokSession(connection.ws);
    if (!session.loggedIn) throw new Error('当前浏览器没有有效 TikTok 登录状态');
    const url = connection.page.url() || '';
    if (!/upload|tiktokstudio/i.test(url)) {
      await connection.page.goto('https://www.tiktok.com/upload', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      await connection.page.waitForTimeout(saveTraffic ? 2000 : 4000);
    }
    const security = await inspectPage(connection.page);
    if (security.blocked) {
      keepOpen = true;
      return { status: 'security_paused', reason: security.reason, manualRequired: true };
    }
    const clicked = await clickPostButton(connection.page);
    if (!clicked) {
      keepOpen = true;
      const shot = await capture(connection.page, accountId, 'publish', 'resume-miss').catch(() => '');
      return { status: 'failed', error: '未找到发布按钮，请确认页面仍在上传/编辑态', screenshot: shot };
    }
    const outcome = await waitPublishOutcome(connection.page, saveTraffic ? 90000 : 120000);
    const shot = await capture(connection.page, accountId, 'publish', 'resume-posted').catch(() => '');
    if (outcome.status === 'security_paused') {
      keepOpen = true;
      return { status: 'security_paused', reason: outcome.reason, screenshot: shot, manualRequired: true };
    }
    if (outcome.status === 'published') {
      return { status: 'published', screenshot: shot };
    }
    keepOpen = true;
    return { status: 'failed', error: '已点击发布，但未确认成功', screenshot: shot };
  } finally {
    if (!keepOpen) await closeConnection(connection);
  }
}

function pickDistributed(list, index, strategy = 'sequential') {
  if (!Array.isArray(list) || !list.length) return '';
  if (strategy === 'random') return list[Math.floor(Math.random() * list.length)];
  return list[index % list.length];
}

async function fillProfileField(page, labels, value) {
  if (!value && value !== '') return false;
  const targets = [page, ...page.frames().filter((frame) => frame !== page.mainFrame())];
  for (const target of targets) {
    for (const label of labels) {
      const byLabel = target.getByLabel(label, { exact: false }).first();
      if (await byLabel.count().catch(() => 0) && await byLabel.isVisible().catch(() => false)) {
        await byLabel.click({ timeout: 5000 }).catch(() => {});
        await byLabel.fill(String(value)).catch(async () => {
          await page.keyboard.press('Control+A').catch(() => {});
          await page.keyboard.type(String(value), { delay: 8 });
        });
        return true;
      }
    }
    for (const selector of [
      'input[data-e2e="edit-profile-name-input"]',
      'textarea[data-e2e="edit-profile-bio-input"]',
      'input[name*="nick" i]',
      'input[placeholder*="Name" i]',
      'input[placeholder*="昵称" i]',
      'input[placeholder*="名字" i]',
      'textarea[placeholder*="Bio" i]',
      'textarea[placeholder*="签名" i]',
      'textarea[placeholder*="简介" i]',
    ]) {
      const field = target.locator(selector).first();
      if (!(await field.count().catch(() => 0))) continue;
      if (!(await field.isVisible().catch(() => false))) continue;
      const placeholder = ((await field.getAttribute('placeholder').catch(() => '')) || '').toLowerCase();
      const nameAttr = ((await field.getAttribute('name').catch(() => '')) || '').toLowerCase();
      const e2e = ((await field.getAttribute('data-e2e').catch(() => '')) || '').toLowerCase();
      const wantBio = labels.some((x) => /bio|签名|简介/i.test(x));
      const looksBio = /bio|签名|简介|desc/.test(`${placeholder} ${nameAttr} ${e2e}`) || selector.includes('textarea');
      if (wantBio !== looksBio) continue;
      await field.click({ timeout: 5000 }).catch(() => {});
      await field.fill(String(value)).catch(async () => {
        await page.keyboard.press('Control+A').catch(() => {});
        await page.keyboard.type(String(value), { delay: 8 });
      });
      return true;
    }
  }
  return false;
}

async function clickProfileSave(page) {
  const names = ['Save', '保存', 'Done', '完成', 'Confirm', '确认'];
  const targets = [page, ...page.frames().filter((frame) => frame !== page.mainFrame())];
  for (const target of targets) {
    for (const name of names) {
      const button = target.getByRole('button', { name: new RegExp(`^${name}$`, 'i') }).first();
      if (await button.count().catch(() => 0) && await button.isVisible().catch(() => false)) {
        const disabled = await button.isDisabled().catch(() => false);
        if (disabled) continue;
        await button.click({ timeout: 8000 });
        return true;
      }
    }
  }
  return false;
}

/** 通过比特环境打开 TikTok 资料编辑页并修改昵称/签名/头像 */
async function modifyTikTokProfile(accountId, options = {}) {
  const nickname = String(options.nickname || '').trim();
  const signature = String(options.signature || '').trim();
  const avatarPath = String(options.avatarPath || '').trim();
  if (!nickname && !signature && !avatarPath) throw new Error('未指定要修改的昵称、签名或头像');

  const connection = await connectAccount(accountId, null, 'profile');
  let keepOpen = false;
  try {
    const session = await inspectTikTokSession(connection.ws);
    if (!session.loggedIn) throw new Error('当前浏览器没有有效 TikTok 登录状态');
    const handle = connection.account.username;
    await connection.page.goto(`https://www.tiktok.com/@${encodeURIComponent(handle)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await connection.page.waitForTimeout(2500);

    const editCandidates = [
      connection.page.getByRole('button', { name: /Edit profile|编辑资料|Edit Profile/i }).first(),
      connection.page.getByRole('link', { name: /Edit profile|编辑资料/i }).first(),
      connection.page.locator('[data-e2e="edit-profile-enter"]').first(),
      connection.page.locator('button').filter({ hasText: /Edit profile|编辑资料/i }).first(),
    ];
    let editBtn = null;
    for (const candidate of editCandidates) {
      if (await candidate.count().catch(() => 0) && await candidate.isVisible().catch(() => false)) {
        editBtn = candidate;
        break;
      }
    }
    if (!editBtn) {
      // 尝试设置页入口
      await connection.page.goto('https://www.tiktok.com/setting', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      await connection.page.waitForTimeout(2000);
      const settingEdit = connection.page.getByText(/Edit profile|编辑资料|Profile/i).first();
      if (await settingEdit.count().catch(() => 0)) {
        await settingEdit.click().catch(() => {});
        await connection.page.waitForTimeout(1500);
        editBtn = connection.page.getByRole('button', { name: /Edit profile|编辑资料|Save|保存/i }).first();
      }
    }
    if (!editBtn || !(await editBtn.count().catch(() => 0))) {
      keepOpen = true;
      const shot = await capture(connection.page, accountId, 'profile', 'edit-miss').catch(() => '');
      return { status: 'failed', error: '未找到「编辑资料」按钮，请确认已登录本人主页', screenshot: shot };
    }
    await editBtn.click({ timeout: 8000 }).catch(() => {});
    await connection.page.waitForTimeout(1500);

    let changed = false;
    if (nickname) {
      changed = (await fillProfileField(connection.page, ['Nickname', 'Display name', 'Name', '昵称', '名字'], nickname)) || changed;
    }
    if (signature) {
      changed = (await fillProfileField(connection.page, ['Bio', '签名', '简介'], signature)) || changed;
    }
    if (avatarPath) {
      const fs = require('node:fs');
      if (!fs.existsSync(avatarPath)) throw new Error(`头像文件不存在：${avatarPath}`);
      const fileInput = await findFileInput(connection.page, 8000);
      if (fileInput) {
        await fileInput.setInputFiles(avatarPath);
        await connection.page.waitForTimeout(2000);
        changed = true;
      }
    }
    if (!changed) {
      keepOpen = true;
      const shot = await capture(connection.page, accountId, 'profile', 'fields-miss').catch(() => '');
      return { status: 'failed', error: '未找到可编辑的资料字段', screenshot: shot };
    }

    const saved = await clickProfileSave(connection.page);
    if (!saved) {
      keepOpen = true;
      const shot = await capture(connection.page, accountId, 'profile', 'save-miss').catch(() => '');
      return { status: 'failed', error: '已填写资料但未找到保存按钮', screenshot: shot, manualRequired: true };
    }
    await connection.page.waitForTimeout(2000);
    const shot = await capture(connection.page, accountId, 'profile', 'saved').catch(() => '');
    if (nickname) {
      await phpApi.patch(`/accounts/${accountId}/nickname`, { nickname }).catch(() => {});
    }
    return { status: 'ok', nickname, signature: signature || undefined, screenshot: shot };
  } finally {
    if (!keepOpen) await closeConnection(connection);
  }
}

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

async function batchModifyTikTokProfiles(accountIds, options = {}) {
  const nicknameList = String(options.nicknameList || '')
    .split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const signatureList = String(options.signatureList || '')
    .split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const avatarFolder = String(options.avatarFolder || '').trim();
  const strategy = options.distributionStrategy === 'random' ? 'random' : 'sequential';
  const threads = Math.min(5, Math.max(1, Number(options.threads) || 1));
  const modifyNickname = options.modifyNickname !== false && nicknameList.length > 0;
  const modifySignature = options.modifySignature !== false && signatureList.length > 0;
  const modifyAvatar = options.modifyAvatar === true && avatarFolder;

  const fs = require('node:fs');
  const path = require('node:path');
  let avatars = [];
  if (modifyAvatar) {
    if (!fs.existsSync(avatarFolder) || !fs.statSync(avatarFolder).isDirectory()) {
      throw new Error('头像文件夹不存在或不是目录');
    }
    avatars = fs.readdirSync(avatarFolder)
      .filter((name) => /\.(jpe?g|png|webp|gif)$/i.test(name))
      .map((name) => path.join(avatarFolder, name));
    if (!avatars.length) throw new Error('头像文件夹内没有可用图片');
  }
  if (!modifyNickname && !modifySignature && !modifyAvatar) {
    throw new Error('请至少开启昵称、签名或头像其中一项');
  }

  const items = await runPool(accountIds, threads, async (accountId, index) => {
    try {
      const result = await modifyTikTokProfile(accountId, {
        nickname: modifyNickname ? pickDistributed(nicknameList, index, strategy) : '',
        signature: modifySignature ? pickDistributed(signatureList, index, strategy) : '',
        avatarPath: modifyAvatar ? pickDistributed(avatars, index, strategy) : '',
      });
      return { accountId, ok: result.status === 'ok', ...result };
    } catch (error) {
      return { accountId, ok: false, status: 'failed', error: error.message };
    }
  });
  return {
    items,
    success: items.filter((x) => x.ok).length,
    failed: items.filter((x) => !x.ok).length,
  };
}

async function deleteTikTokVideo(accountId, options = {}) {
  const videoId = String(options.videoId || '').trim();
  let videoUrl = String(options.videoUrl || '').trim();
  const connection = await connectAccount(accountId, null, 'profile');
  let keepOpen = false;
  try {
    const session = await inspectTikTokSession(connection.ws);
    if (!session.loggedIn) throw new Error('当前浏览器没有有效 TikTok 登录状态');
    if (!videoUrl) {
      if (!videoId) throw new Error('缺少 videoId 或 videoUrl');
      videoUrl = `https://www.tiktok.com/@${encodeURIComponent(connection.account.username)}/video/${encodeURIComponent(videoId)}`;
    }
    await connection.page.goto(videoUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await connection.page.waitForTimeout(2500);

    const more = connection.page.locator('[data-e2e="video-share-more"],[data-e2e="browse-more"],button[aria-label*="More" i],button[aria-label*="更多"]').first();
    if (await more.count().catch(() => 0) && await more.isVisible().catch(() => false)) {
      await more.click({ timeout: 5000 }).catch(() => {});
      await connection.page.waitForTimeout(800);
    } else {
      const alt = connection.page.getByRole('button', { name: /More|更多|···|…/i }).first();
      if (await alt.count().catch(() => 0)) await alt.click({ timeout: 5000 }).catch(() => {});
      await connection.page.waitForTimeout(800);
    }

    const deleteCandidates = [
      connection.page.getByRole('button', { name: /Delete|删除|Remove/i }).first(),
      connection.page.getByText(/^(Delete|删除)$/i).first(),
      connection.page.locator('[data-e2e*="delete" i]').first(),
    ];
    let deleteBtn = null;
    for (const candidate of deleteCandidates) {
      if (await candidate.count().catch(() => 0) && await candidate.isVisible().catch(() => false)) {
        deleteBtn = candidate;
        break;
      }
    }
    if (!deleteBtn) {
      keepOpen = true;
      const shot = await capture(connection.page, accountId, 'video', 'delete-miss').catch(() => '');
      return { status: 'failed', error: '未找到删除入口（可能非本人视频或页面结构变化）', screenshot: shot };
    }
    await deleteBtn.click({ timeout: 8000 });
    await connection.page.waitForTimeout(800);
    const confirm = connection.page.getByRole('button', { name: /Delete|删除|Confirm|确认|OK/i }).last();
    if (await confirm.count().catch(() => 0) && await confirm.isVisible().catch(() => false)) {
      await confirm.click({ timeout: 8000 }).catch(() => {});
    }
    await connection.page.waitForTimeout(2000);
    const shot = await capture(connection.page, accountId, 'video', 'deleted').catch(() => '');
    if (videoId || videoUrl) {
      await phpApi.post(`/node/accounts/${accountId}/tiktok-videos/delete`, { videoId, videoUrl }).catch(() => {});
    }
    return { status: 'ok', videoId, videoUrl, screenshot: shot };
  } finally {
    if (!keepOpen) await closeConnection(connection);
  }
}

async function batchDeleteTikTokVideos(accountIds, options = {}) {
  const keepLatest = Math.max(0, Number(options.keepLatest) || 0);
  const threads = Math.min(3, Math.max(1, Number(options.threads) || 1));
  const jobs = [];
  for (const accountId of accountIds) {
    let videos = [];
    try {
      videos = await phpApi.get(`/accounts/${accountId}/tiktok-videos`) || [];
    } catch {
      videos = [];
    }
    if (!Array.isArray(videos)) videos = [];
    const remove = videos.slice(keepLatest);
    for (const video of remove) {
      jobs.push({ accountId, video });
    }
  }
  if (!jobs.length) return { items: [], success: 0, failed: 0, deleted: 0 };

  const items = await runPool(jobs, threads, async (job) => {
    try {
      const result = await deleteTikTokVideo(job.accountId, {
        videoId: job.video.video_id || job.video.videoId,
        videoUrl: job.video.video_url || job.video.videoUrl,
      });
      return { accountId: job.accountId, videoId: job.video.video_id || job.video.videoId, ok: result.status === 'ok', ...result };
    } catch (error) {
      return { accountId: job.accountId, videoId: job.video.video_id || job.video.videoId, ok: false, status: 'failed', error: error.message };
    }
  });
  return {
    items,
    success: items.filter((x) => x.ok).length,
    failed: items.filter((x) => !x.ok).length,
    deleted: items.filter((x) => x.ok).length,
  };
}

module.exports = {
  connectAccount,
  preparePublish,
  resumePublish,
  prepareMessage,
  sendBitMessageBatch,
  closeConnection,
  classify,
  modifyTikTokProfile,
  batchModifyTikTokProfiles,
  deleteTikTokVideo,
  batchDeleteTikTokVideos,
};
