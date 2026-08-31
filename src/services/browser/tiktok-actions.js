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
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000}); await page.waitForTimeout(2500);
  return {account,provider,browser,page,ws:opened.ws};
}
async function closeConnection(connection){if(!connection)return;await connection.browser.close().catch(()=>{});await connection.provider.close(connection.account.browser_profile_id).catch(()=>{});}
async function prepareMessage(accountId, content, recipient='') {
  const wait=waitForSlot(`message:${accountId}`,3000); if(wait) await new Promise(resolve=>setTimeout(resolve,wait));
  const connection=await connectAccount(accountId,'https://www.tiktok.com/messages'); try {
    const session=await inspectTikTokSession(connection.ws); if(!session.loggedIn) throw new Error('当前浏览器没有有效 TikTok 登录状态');
    const before=await capture(connection.page,accountId,'message','before'); const security=await inspectPage(connection.page);
    if(security.blocked)return {status:'security_paused',reason:security.reason,screenshot:before,manualRequired:true};
    if(recipient){const recipientInput=connection.page.locator('input').first(); await recipientInput.fill(recipient).catch(()=>{});}
    const editor=connection.page.locator('textarea,[contenteditable="true"]').last(); if(await editor.count()===0)throw new Error('未找到消息输入控件'); await editor.fill(content).catch(async()=>{await editor.click();await connection.page.keyboard.type(content)});
    const prepared=await capture(connection.page,accountId,'message','prepared'); const after=await inspectPage(connection.page);
    if(after.blocked)return {status:'security_paused',reason:after.reason,screenshot:prepared,manualRequired:true};
    return {status:'manual_required',manualRequired:true,screenshot:prepared,recipient,contentLength:String(content).length};
  } finally { await closeConnection(connection); }
}

async function preparePublish(accountId, materialId, title='', caption='') {
  const wait=waitForSlot(`publish:${accountId}`,3000); if(wait) await new Promise(resolve=>setTimeout(resolve,wait));
  const material=db.prepare('SELECT id,name,file_path,file_name,mime_type,size_bytes,status FROM materials WHERE id=?').get(materialId);
  if(!material) throw new Error('素材不存在'); if(material.status!=='ready') throw new Error('素材状态不可用');
  const connection=await connectAccount(accountId,'https://www.tiktok.com/upload'); try {
    const session=await inspectTikTokSession(connection.ws); if(!session.loggedIn) throw new Error('当前浏览器没有有效 TikTok 登录状态');
    const before=await capture(connection.page,accountId,'publish','before'); const security=await inspectPage(connection.page);
    if(security.blocked)return {status:'security_paused',reason:security.reason,screenshot:before,manualRequired:true};
    const input=connection.page.locator('input[type=file]').first(); if(await input.count()===0)throw new Error('未找到视频上传控件');
    await input.setInputFiles(material.file_path); await connection.page.waitForTimeout(1500);
    const textareas=connection.page.locator('textarea'); if(title||caption) await textareas.first().fill(`${title}${title&&caption?'\n':''}${caption}`).catch(()=>{});
    const prepared=await capture(connection.page,accountId,'publish','prepared'); const after=await inspectPage(connection.page);
    if(after.blocked)return {status:'security_paused',reason:after.reason,screenshot:prepared,manualRequired:true};
    return {status:'manual_required',manualRequired:true,screenshot:prepared,material:{id:material.id,name:material.name,fileName:material.file_name}};
  } finally { await closeConnection(connection); }
}
module.exports={preparePublish,prepareMessage,closeConnection,classify};
