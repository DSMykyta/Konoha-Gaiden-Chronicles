import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createLocalServer} from './serve.mjs';

const folder=path.resolve(import.meta.dirname,'../tmp/capsule-screenshots');
await fs.mkdir(folder,{recursive:true});
const server=createLocalServer();
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const base='http://127.0.0.1:'+server.address().port;
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];
 page.on('pageerror',err=>errors.push(err.message));
 await page.goto(base,{waitUntil:'networkidle'});
 await page.waitForSelector('#timeline .node');
 for(const [name,mode,selector] of [
  ['day','day','[data-scene-capsule="sc-y0-0122-academy-announcements"]'],
  ['week','week','[data-event="sc-y0-0122-academy-announcements"] rect.mark'],
  ['month','month','[data-event="episode:ep-y0-team-formation"] rect.mark'],
  ['year','year','[data-event="arc:arc-y0-genin-formation"] rect.mark']
 ]){
  await page.evaluate(mode=>{
   selected=new Set(['c-naruto','c-shikamaru','c-kita','c-ren','c-sora','c-raido']);
   focusedCharacter=null;
   zoom=zoomModes[mode];
   center=dayToAxis((62-data.calendar.view_start_year)*365+21.5);
   render();
  },mode);
  await page.waitForTimeout(180);
  const visible=await page.locator(selector).count();
  assert(visible>0,mode+' capsule missing: '+selector);
  assert.equal(await page.locator('.arc-cluster-node').count(),0,'Different arcs merged');
  await page.screenshot({path:path.join(folder,name+'.png'),fullPage:false});
 }
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{
  zoom=zoomModes.day;
  center=dayToAxis((62-data.calendar.view_start_year)*365+21.5);
  render();
 });
 await page.waitForTimeout(180);
 await page.screenshot({path:path.join(folder,'mobile-day.png'),fullPage:false});
 assert.equal(errors.length,0,errors.join('; '));
 console.log('Capsule browser smoke passed. Screenshots in '+folder);
}finally{
 if(browser)await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
