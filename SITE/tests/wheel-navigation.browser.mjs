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
  const whileScrolling=await page.evaluate(()=>({center,zoom}));
  assert.equal(whileScrolling.zoom,before.zoom,'wheel must not zoom');
  assert(whileScrolling.center>before.center,'wheel down goes later in time');
  // Camera movement is committed on the next animation frame, not at idle.
  await page.waitForTimeout(125);
  const during=await page.evaluate(()=>({
    center,zoom,transform:$('timeline').style.transform,
    viewBox:$('timeline').getAttribute('viewBox'),
    mutations:window.__timelineMutations
  }));
  assert.equal(during.transform,'','wheel preview must be committed without waiting for idle');
  assert(during.viewBox!==before.viewBox||during.mutations>0,
    'the next frame must commit camera movement or rebuild the next buffer');
  await page.waitForTimeout(550);
  const after=await page.evaluate(()=>({
    center,zoom,transform:$('timeline').style.transform,
    viewBox:$('timeline').getAttribute('viewBox'),
    mutations:window.__timelineMutations
  }));
  assert.equal(after.mutations,during.mutations,'idle must not cause another SVG rebuild');
  assert.equal(after.viewBox,during.viewBox,'idle must not trigger a second camera commit');
  assert.equal(after.transform,'');
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
  const burstReusable=await page.evaluate(()=>{const [lo,hi]=range();return !!TimelinePanCache.reuse(panFrame,{lo,hi,width:$('canvas').clientWidth,height:$('canvas').clientHeight,zoom,breaks:axisBreaks()});});
  await page.waitForTimeout(550);
  const settled=await page.evaluate(()=>({mutations:window.__timelineMutations,viewBox:$('timeline').getAttribute('viewBox')}));
  assert.equal(settled.mutations,burst,'there must be no rebuild after wheel inactivity');
  if(burstReusable)assert.notEqual(settled.viewBox,before.viewBox,'the finished gesture must move the cached camera');
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
  const dragReusable=await page.evaluate(()=>{const [lo,hi]=range();return !!TimelinePanCache.reuse(panFrame,{lo,hi,width:$('canvas').clientWidth,height:$('canvas').clientHeight,zoom,breaks:axisBreaks()});});
  await page.mouse.up();await page.waitForTimeout(280);
  const committed=await page.evaluate(()=>({mutations:window.__timelineMutations,transform:$('timeline').style.transform,viewBox:$('timeline').getAttribute('viewBox')}));
  assert.equal(committed.mutations===0,dragReusable,'drag release must apply the same buffer policy');
  if(dragReusable)assert.notEqual(committed.viewBox,before.viewBox,'drag release must commit a camera translation');
  assert.equal(committed.transform,'');
  // A tiny pan wholly within a stable time-break window must reuse the same
  // path DOM nodes, not only produce a visually similar graph.
  await page.evaluate(()=>{
    const half=(range()[1]-range()[0])*.002;
    const start=center;
    let shift=half;
    if(!TimelinePanCache.reuse(panFrame,{lo:range()[0]+shift,hi:range()[1]+shift,width:$('canvas').clientWidth,height:$('canvas').clientHeight,zoom,breaks:axisBreaks()}))shift=-half;
    if(!TimelinePanCache.reuse(panFrame,{lo:range()[0]+shift,hi:range()[1]+shift,width:$('canvas').clientWidth,height:$('canvas').clientHeight,zoom,breaks:axisBreaks()})){
      center=dayToAxis(21.5);render();shift=(range()[1]-range()[0])*.002;
    }
    window.__savedThread=$('timeline').querySelector('.thread');
    window.__savedPath=window.__savedThread?.getAttribute('d');
    window.__timelineMutations=0;
    center=clampAxisCenter(center+shift);schedule();
  });
  await page.waitForTimeout(200);
  const stable=await page.evaluate(()=>({
    mutations:window.__timelineMutations,
    threadSame:window.__savedThread?.isConnected,
    pathSame:window.__savedThread?.getAttribute('d')===window.__savedPath
  }));
  assert.equal(stable.mutations,0,'an ordinary tiny pan cannot replace timeline child nodes');
  assert(stable.threadSame&&stable.pathSame,'a camera move must preserve the original SVG curve object');
  // A rapid gesture cannot outrun its virtualized content, even after
  // repeated buffer crossings. The old idle debounce caused blank frames.
  await page.evaluate(()=>{zoom=zoomModes.month;center=dayToAxis(95);render();window.__timelineMutations=0;});
  const liveFrames=[];
  for(let i=0;i<18;i++){
    await page.mouse.wheel(0,105);
    await page.waitForTimeout(65);
    liveFrames.push(await page.evaluate(()=>{
      const [lo,hi]=range();
      return {
        covered:!!panFrame&&lo>=panFrame.coverLo-1e-7&&hi<=panFrame.coverHi+1e-7,
        pending:wheelPreview,
        mutations:window.__timelineMutations,
        center,
        curves:$('timeline').querySelectorAll('.thread,.thread-focus-continuous').length,
        spanning:(()=>{
          const [lo,hi]=range(),days=datedEvents()
            .filter(event=>event.physical?.some(id=>selected.has(id)))
            .map(event=>dayToAxis(event.day));
          return days.length>1&&Math.min(...days)<hi&&Math.max(...days)>lo;
        })()
      };
    }));
  }
  assert(liveFrames.every(frame=>frame.covered),'camera must never outrun its prepared buffer');
  assert(liveFrames.every(frame=>!frame.pending),'each wheel pulse must commit during the gesture');
  assert(liveFrames.some(frame=>frame.mutations>0),'buffer transitions must render while the wheel keeps moving');
  assert(liveFrames.every(frame=>!frame.spanning||frame.curves>0),'an active selected line must survive buffer transitions');
  await page.evaluate(()=>{zoom=zoomModes.month;center=dayToAxis(95);render();});

  // Explicitly crossing the buffered interval is the one legitimate reason
  // to rebuild the virtualized SVG.
  await page.evaluate(()=>{
    const target=Math.min(axisLength(),panFrame.coverHi+(panFrame.hi-panFrame.lo)*.3);
    center=clampAxisCenter(target);
    window.__timelineMutations=0;schedule();
  });
  await page.waitForTimeout(200);
  assert((await page.evaluate(()=>window.__timelineMutations))>0,'leaving overscan must rebuild the next graph window');
  // The new SVG window needs DOM nodes, not a second computation of every
  // character's world-space Bézier route.
  const pathComputations=await page.evaluate(()=>{
    zoom=zoomModes.month;center=dayToAxis(21.5);render();
    let calls=0;const original=TimelineCore.strand;
    TimelineCore.strand=function(...args){calls++;return original.apply(this,args);};
    try {center=dayToAxis(85);render();} finally {TimelineCore.strand=original;}
    return calls;
  });
  assert.equal(pathComputations,0,'switching virtual windows at unchanged zoom must reuse cached character routes');
  assert.deepEqual(errors,[]);
  console.log('Buffered wheel + drag:',viewport.width+'×'+viewport.height,'passed; pan reuses SVG, buffer crossing rebuilds once');
  await page.close();
 }
} finally {await browser.close();server.close();}
