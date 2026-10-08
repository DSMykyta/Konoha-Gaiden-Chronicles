import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createLocalServer } from '../scripts/serve.mjs';

const server=createLocalServer();
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
try {
 for (const viewport of [{width:1440,height:900},{width:375,height:812}]) {
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'networkidle'});
  async function monitor(rootId) {
   await page.evaluate(rootId=>{
    window.__searchChanges=0;
    window.__searchMonitor?.disconnect();
    window.__searchMonitor=new MutationObserver(records=>{
     window.__searchChanges+=records.reduce((sum,record)=>sum+record.addedNodes.length+record.removedNodes.length,0);
    });
    window.__searchMonitor.observe(document.getElementById(rootId),{childList:true,subtree:true});
   },rootId);
  }
  const changes=()=>page.evaluate(()=>window.__searchChanges);
  await page.locator('#searchButton').click();
  await monitor('searchResults');
  const search=page.locator('#eventSearch');
  await search.pressSequentially('Наруто',{delay:45});
  assert.equal(await changes(),0,'Search should not rebuild results between keystrokes');
  await page.waitForTimeout(230);
  assert((await changes())>0,'Search should render after the typing pause');
  await page.evaluate(()=>window.__searchChanges=0);
  await search.pressSequentially(' Райдо',{delay:15});
  assert.equal(await changes(),0,'New query should wait for debounce');
  await search.press('Enter');
  assert((await changes())>0,'Enter must search immediately');
  await page.evaluate(()=>window.__searchChanges=0);
  await search.fill('');
  assert((await changes())>0,'Explicit clear must update immediately');
  await page.evaluate(()=>window.__searchChanges=0);
  await search.evaluate(input=>{
   input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
   input.value='Какаші';
   input.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));
  });
  await page.waitForTimeout(220);
  assert.equal(await changes(),0,'IME composition must not search');
  await search.evaluate(input=>input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})));
  assert.equal(await changes(),0,'IME commit follows the same pause');
  await page.waitForTimeout(220);
  assert((await changes())>0,'IME confirmed text should search after pause');
  await page.locator('#contentsButton').click();
  await monitor('contentsTree');
  const contents=page.locator('#contentsQuery');
  await contents.pressSequentially('Іспит',{delay:45});
  assert.equal(await changes(),0,'Contents must not rebuild between keystrokes');
  await page.waitForTimeout(230);
  assert((await changes())>0,'Contents should filter after pause');
  await page.evaluate(()=>window.__searchChanges=0);
  await contents.pressSequentially(' додатковий',{delay:5});
  assert.equal(await changes(),0,'Contents query should wait');
  await contents.press('Enter');
  assert((await changes())>0,'Contents Enter must filter immediately');
  assert.deepEqual(errors,[]);
  console.log('Search debounce verified at',viewport.width+'×'+viewport.height);
  await page.close();
 }
} finally {await browser.close();server.close();}
