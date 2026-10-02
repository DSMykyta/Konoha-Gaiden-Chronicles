import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createLocalServer} from '../scripts/serve.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'):'playwright'));
const server=createLocalServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote']});
const output=process.env.BROWSER_SCREENSHOTS;if(output)await fs.mkdir(output,{recursive:true});
try{
 for(const [width,height] of [[320,700],[375,812],[812,375],[768,1024],[1440,900],[2000,1100]]){
  const page=await browser.newPage({viewport:{width,height},hasTouch:width<=760,isMobile:width<=760,reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'networkidle'});
  await page.evaluate(()=>navigateStory('episode','ep-y0-team9-introduction'));
  await page.locator('#eventCard [data-expand-map-kind="episode"]').click();
  assert.deepEqual(await page.evaluate(()=>graphNodes.map(n=>n.id).sort()),['sc-y0-0122-dango-shop','sc-y0-0122-kita-home-night']);
  assert.equal(await page.locator('[data-story-region="episode:ep-y0-team9-introduction"]').count(),1);
  assert(await page.locator('.node-title').count()>0);
  if(output)await page.screenshot({path:path.join(output,`story-map-${width}-${height}.png`),animations:'disabled'});
  await page.locator('[data-event="sc-y0-0122-dango-shop"] .node-surface').click();
  await page.locator('#eventCard [data-expand-map-kind="scene"]').click();
  assert.equal(await page.evaluate(()=>graphNodes.length),3);
  assert(await page.evaluate(()=>graphNodes.every(n=>n.kind==='moment'&&n.sourceSceneIds[0]==='sc-y0-0122-dango-shop')));
  const first=page.locator('[data-event="ev-y0-0122-dango-sharing"] .mark');await first.click();
  assert.equal(await page.evaluate(()=>pinnedNodeId),'ev-y0-0122-dango-sharing');await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>pinnedNodeId),'ev-y0-0122-dango-sharing');
  await page.locator('#eventCard [data-close-card]').click();
  const metrics=await page.evaluate(()=>{
   const violations=[];
   for(const node of graphNodes){const element=document.querySelector(`[data-event="${node.id}"]`);
    for(const text of element.querySelectorAll('.node-title,.node-meta')){const box=text.getBBox();if(box.width>node.label.width+2||box.x<node.bounds.x||box.x+box.width>node.bounds.x+node.bounds.width+2)violations.push({id:node.id,text:text.textContent,label:node.label.width,actual:box.width,measured:StoryMapMeasure(text.textContent)*13/12,font:getComputedStyle(text).font});}
   }
   return {violations,overflow:document.documentElement.scrollWidth>innerWidth};
  });assert.deepEqual(metrics.violations,[],'A real font escaped its reserved title box');assert.equal(metrics.overflow,false);
  if(output)await page.screenshot({path:path.join(output,`story-moments-${width}-${height}.png`),animations:'disabled'});
  await page.locator('#mapUp').click();assert.equal(await page.evaluate(()=>mapScope.kind),'episode');assert.equal(await page.evaluate(()=>graphNodes.length),2);
  await page.locator('#mapUp').click();assert.equal(await page.evaluate(()=>mapScope.kind),'arc');assert.equal(await page.evaluate(()=>graphNodes.length),2);
  await page.locator('#mapUp').click();assert.equal(await page.evaluate(()=>mapScope),null);
  await page.evaluate(()=>navigateStory('episode','ep-y0-kita-home-after-formation'));assert.equal(await page.locator('#eventCard h2').textContent(),'Перший день Команди 9');
  await page.evaluate(()=>expandMap('arc','arc-y0-team9-raido-evaluation'));assert.equal(await page.evaluate(()=>graphNodes.length),2);
  await page.evaluate(()=>{setFocus('c-sora');zoom=zoomModes.day;center=21.5;render();});
  assert.equal(await page.locator('.thread').count(),1);
  assert(await page.evaluate(()=>[...document.querySelectorAll('.focus-guest-entry')].some(path=>path.dataset.sharedNodes.split(' ').length>1)),'Neighboring guest appearances became independent stubs');
  // All levels around the densest source days keep names and distinct hit boxes.
  const violations=await page.evaluate(()=>{
   setFocus('c-sora');const counts=new Map();datedEvents().forEach(e=>counts.set(e.day,(counts.get(e.day)||0)+1));const days=[21,...[...counts].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([day])=>day)],violations=[];
   for(const day of days)for(const mode of ['year','month','week','day']){
    mapScope=null;zoom=zoomModes[mode];center=dayToAxis(day+.5);$('canvas').scrollTop=0;render();
    const nodes=graphNodes;
    for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
     const a=nodes[i].bounds,b=nodes[j].bounds;if(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y)violations.push(`${mode}:${day}:${nodes[i].id}`);
    }
    if(nodes.some(n=>!n.label.lines.length||!Number.isFinite(n.x+n.y)))violations.push('Missing label');
   }
   return violations;
  });assert.deepEqual(violations,[]);assert.deepEqual(errors,[]);
  console.log(`PASS story map ${width}×${height}: real labels, nested membership, map expansion, touch pin, named return, old IDs, continuous guests and dense dates`);await page.close();
 }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
