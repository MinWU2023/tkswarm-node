const { chromium } = require('playwright-core');
const { BitBrowserProvider } = require('./bit-browser-provider');
const { inspectTikTokSession } = require('./cdp-client');
const { inspectPage, capture, classify } = require('../automation-guard');
const { db } = require('../../db');
const { waitForSlot } = require('../action-rate-limit');

async function connectAccount(accountId, url) {
  const account=db.prepare('SELECT id,username,browser_profile_id FROM accounts WHERE id=?').get(accountId);
  if(!account) throw new Error('账号不存在');
  if(!account.browser_profile_id) throw new Error('账号尚未绑定浏览器环境');
  const provider=new BitBrowserProvider(); const opened=await provider.open(account.browser_profile_id);
  if(!opened?.ws) throw new Error('比特浏览器未返回 CDP 地址');
  const browser=await chromium.connectOverCDP(opened.ws,{timeout:30000});
  const context=browser.contexts()[0]; const page=context.pages().find(p=>/tiktok\.com/i.test(p.url()))||context.pages()[0]||await context.newPage();
  await page.bringToFront().catch(()=>{});
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  // TikTok Studio hydrates its upload surface asynchronously. Do not inspect
  // once after 2.5s and declare failure; manual clicking may work later.
  await page.waitForTimeout(5000);
  return {account,provider,browser,page,ws:opened.ws};
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
async function prepareMessage(accountId, content, recipient='') {
  const wait=waitForSlot(`message:${accountId}`,3000); if(wait) await new Promise(resolve=>setTimeout(resolve,wait));
  const connection=await connectAccount(accountId,'https://www.tiktok.com/messages'); let keepOpen=false; try {
    const session=await inspectTikTokSession(connection.ws); if(!session.loggedIn) throw new Error('当前浏览器没有有效 TikTok 登录状态');
    const before=await capture(connection.page,accountId,'message','before'); const security=await inspectPage(connection.page);
    if(security.blocked){keepOpen=true;return {status:'security_paused',reason:security.reason,screenshot:before,manualRequired:true};}
    if(recipient){const recipientInput=connection.page.locator('input').first(); await recipientInput.fill(recipient).catch(()=>{});}
    const editor=connection.page.locator('textarea,[contenteditable="true"]').last(); if(await editor.count()===0)throw new Error('未找到消息输入控件'); await editor.fill(content).catch(async()=>{await editor.click();await connection.page.keyboard.type(content)});
    const prepared=await capture(connection.page,accountId,'message','prepared'); const after=await inspectPage(connection.page);
    if(after.blocked){keepOpen=true;return {status:'security_paused',reason:after.reason,screenshot:prepared,manualRequired:true};}
    keepOpen=true; return {status:'manual_required',manualRequired:true,screenshot:prepared,recipient,contentLength:String(content).length};
  } finally { if(!keepOpen) await closeConnection(connection); }
}

async function preparePublish(accountId, materialId, title='', caption='') {
  const wait=waitForSlot(`publish:${accountId}`,3000); if(wait) await new Promise(resolve=>setTimeout(resolve,wait));
  const material=db.prepare('SELECT id,name,file_path,file_name,mime_type,size_bytes,status FROM materials WHERE id=?').get(materialId);
  if(!material) throw new Error('素材不存在'); if(material.status!=='ready') throw new Error('素材状态不可用');
  const connection=await connectAccount(accountId,'https://www.tiktok.com/upload'); let keepOpen=false; try {
    const session=await inspectTikTokSession(connection.ws); if(!session.loggedIn) throw new Error('当前浏览器没有有效 TikTok 登录状态');
    const before=await capture(connection.page,accountId,'publish','before'); const security=await inspectPage(connection.page);
    if(security.blocked){keepOpen=true;return {status:'security_paused',reason:security.reason,screenshot:before,manualRequired:true};}
    let fileSelected=false; let input=await findFileInput(connection.page, 1000);
    if(!input){
      await activateUploadSurface(connection.page);
      input=await findFileInput(connection.page, 10000);
    }
    if(!input){
      const uploadLink=connection.page.getByRole('link',{name:/^Upload$/i}).first();
      if(await uploadLink.count()){ await uploadLink.click().catch(()=>{}); await connection.page.waitForTimeout(3500); }
      input=await findFileInput(connection.page, 5000);
    }
    if(!input){
      const uploadButton=connection.page.getByRole('button',{name:/^Upload$/i}).first();
      if(await uploadButton.count()){
        const chooserPromise=connection.page.waitForEvent('filechooser',{timeout:7000}).catch(()=>null);
        await uploadButton.click().catch(()=>{}); const chooser=await chooserPromise;
        if(chooser){await chooser.setFiles(material.file_path);fileSelected=true;await connection.page.waitForTimeout(2000);}
      }
      input=await findFileInput(connection.page, 5000);
    }
    if(!input && !fileSelected){
      await connection.page.goto('https://www.tiktok.com/tiktokstudio/upload',{waitUntil:'domcontentloaded',timeout:60000}).catch(()=>{}); await connection.page.waitForTimeout(4000);
      input=await findFileInput(connection.page, 10000);
    }
    if(!input){
      const info=await inspectPage(connection.page); const dom=await connection.page.evaluate(()=>({title:document.title,inputs:[...document.querySelectorAll('input')].map(x=>({type:x.type,accept:x.accept,placeholder:x.placeholder})).slice(0,20),buttons:[...document.querySelectorAll('button,[role=button]')].map(x=>(x.innerText||x.getAttribute('aria-label')||'').trim()).filter(Boolean).slice(0,30),text:(document.body?.innerText||'').replace(/\\s+/g,' ').slice(0,500)})).catch(()=>({}));
      throw new Error(`未找到视频上传控件（当前页面：${info.url||connection.page.url()}；标题：${dom.title||'-'}；输入框：${dom.inputs?.length||0}；按钮：${(dom.buttons||[]).join('|').slice(0,240)}；文本：${dom.text||'-'})`);
    }
    if(!fileSelected){await input.setInputFiles(material.file_path);} await connection.page.waitForTimeout(4000);
    const textareas=connection.page.locator('textarea'); if(title||caption) await textareas.first().fill(`${title}${title&&caption?'\n':''}${caption}`).catch(()=>{});
    const prepared=await capture(connection.page,accountId,'publish','prepared'); const after=await inspectPage(connection.page);
    if(after.blocked){keepOpen=true;return {status:'security_paused',reason:after.reason,screenshot:prepared,manualRequired:true};}
    keepOpen=true; return {status:'manual_required',manualRequired:true,screenshot:prepared,material:{id:material.id,name:material.name,fileName:material.file_name}};
  } finally { if(!keepOpen) await closeConnection(connection); }
}
module.exports={preparePublish,prepareMessage,closeConnection,classify};
