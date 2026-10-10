import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createLocalServer} from '../scripts/serve.mjs';
const server=createLocalServer();
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
try {
 for(const viewport of [{width:1440,height:900},{width:375,height:812}]){
  const page=await browser.newPage({viewport});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'networkidle'});
  await page.evaluate(()=>{
    zoom=zoomModes.month;center=dayToAxis(95);render();
    window.__timelineMutations=0;
    window.__timelineObs=new MutationObserver(changes=>{
      window.__timelineMutations+=changes.reduce((total,c)=>total+c.addedNodes.length+c.removedNodes.length,0);
    });
    window.__timelineObs.observe(document.getElementById('timeline'),{childList:true});
  });
  const before=await page.evaluate(()=>({center,zoom,viewBox:$('timeline').getAttribute('viewBox')}));
  const x=viewport.width<600?35:135, y=viewport.width<600?340:680;
  await page.mouse.move(x,y);
  await page.mouse.wheel(0,150);
  const whileScrolling=await page.evaluate(()=>({center,zoom,transform:document.getElementById('timeline').style.transform,mutations:window.__timelineMutations}));
  assert.equal(whileScrolling.zoom,before.zoom,'wheel must not zoom');
  assert(whileScrolling.center>before.center,'wheel down goes later in time');
  assert.equal(whileScrolling.mutations,0,'wheel preview must not rebuild SVG');
  assert.match(whileScrolling.transform,/translate3d/,'wheel scroll should preview on compositor');
  const shortPanReusable=await page.evaluate(()=>{const [lo,hi]=range();return !!TimelinePanCache.reuse(panFrame,{lo,hi,width:$('canvas').clientWidth,height:$('canvas').clientHeight,zoom,breaks:axisBreaks()});});
  await page.waitForTimeout(1050);
  const after=await page.evaluate(()=>({center,zoom,transform:$('timeline').style.transform,viewBox:$('timeline').getAttribute('viewBox'),mutations:window.__timelineMutations}));
  assert.equal(after.mutations===0,shortPanReusable,'the SVG rebuild policy must match camera-cache validity');
  if(shortPanReusable)assert.notEqual(after.viewBox,before.viewBox,'a reused frame must move its viewBox');
  assert.equal(after.transform,'','preview transform must reset');
  assert.equal(after.zoom,before.zoom);
  await page.mouse.wheel(0,-150);
  await page.waitForTimeout(450);
  const reversed=await page.evaluate(()=>({center,zoom}));
  assert(Math.abs(reversed.center-before.center)<0.001,'reverse scroll should restore current date');
  // A succession of wheel movements must NOT rebuild the SVG at each pause.
  // The last movement starts the quiet-period timer anew.
  await page.evaluate(()=>window.__timelineMutations=0);
  for(let pulse=0;pulse<3;pulse++){await page.mouse.wheel(0,24);await page.waitForTimeout(185);}
  const burst=await page.evaluate(()=>window.__timelineMutations);
  assert.equal(burst,0,'short wheel pauses must not rebuild clouds and SVG between pulses');
  await page.waitForTimeout(550);
  const settled=await page.evaluate(()=>({mutations:window.__timelineMutations,viewBox:$('timeline').getAttribute('viewBox')}));
  assert.equal(settled.mutations,0,'short wheel bursts within overscan must not replace SVG children');
  assert.notEqual(settled.viewBox,before.viewBox,'the finished gesture must move the cached camera');
  await page.evaluate(()=>{zoom=1;center=clampAxisCenter(center);render()});
  await page.waitForTimeout(200);
  await page.evaluate(()=>window.__timelineMutations=0);
  await page.mouse.wheel(0,120);
  await page.waitForTimeout(280);
  const atEdge=await page.evaluate(()=>({center,zoom,mutations:window.__timelineMutations}));
  assert.equal(atEdge.zoom,1);
  assert.equal(atEdge.mutations,0,'no wasted redraw when entire timeline fits');
  await page.evaluate(()=>{zoom=zoomModes.month;center=dayToAxis(95);render();});
  await page.waitForTimeout(300);
  await page.evaluate(()=>window.__timelineMutations=0);
  await page.mouse.move(x,y);await page.mouse.down();
  for(let i=0;i<20;i++)await page.mouse.move(x+i*7,y);
  const drag=await page.evaluate(()=>({center,mutations:window.__timelineMutations}));
  assert.equal(drag.mutations,0,'drag must also avoid SVG rebuilds while moving');
  await page.mouse.up();await page.waitForTimeout(280);
  const committed=await page.evaluate(()=>({mutations:window.__timelineMutations,transform:$('timeline').style.transform,viewBox:$('timeline').getAttribute('viewBox')}));
  assert.equal(committed.mutations,0,'short drag must reuse the already-built line geometry');
  assert.notEqual(committed.viewBox,before.viewBox,'drag release must commit a camera translation');
  assert.equal(committed.transform,'');
  // Explicitly crossing the buffered interval is the one legitimate reason
  // to rebuild the virtualized SVG.
  await page.evaluate(()=>{
    const target=Math.min(axisLength(),panFrame.coverHi+(panFrame.hi-panFrame.lo)*.3);
    center=clampAxisCenter(target);
    window.__timelineMutations=0;schedule();
  });
  await page.waitForTimeout(200);
  assert((await page.evaluate(()=>window.__timelineMutations))>0,'leaving overscan must rebuild the next graph window');
  assert.deepEqual(errors,[]);
  console.log('Buffered wheel + drag:',viewport.width+'×'+viewport.height,'passed; pan reuses SVG, buffer crossing rebuilds once');
  await page.close();
 }
} finally {await browser.close();server.close();}
