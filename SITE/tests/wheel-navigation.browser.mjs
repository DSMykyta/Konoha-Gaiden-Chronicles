import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createLocalServer} from '../scripts/serve.mjs';

const server=createLocalServer();
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
try{
 for(const viewport of [{width:1440,height:900},{width:375,height:812}]){
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'networkidle'});
  await page.evaluate(()=>{zoom=zoomModes.month;center=dayToAxis(50);render();});
  const x=viewport.width<600?155:390,y=viewport.width<600?460:540;
  // Regression: small camera pans must preserve existing SVG nodes, on phone and desktop.
  // Observe the live DOM across animation frames, not only the final screenshot.
  const stablePan=await page.evaluate(async({x,y})=>{
   const timeline=$('timeline'),axis=$('timeAxis');
   const originalTimelineChild=timeline.firstElementChild,originalAxisChild=axis.firstElementChild;
   let directChildMutations=0;
   const observers=[timeline,axis].map(element=>{
    const observer=new MutationObserver(records=>{
     directChildMutations+=records.filter(record=>record.type==='childList'&&
      (record.addedNodes.length||record.removedNodes.length)).length;
    });
    observer.observe(element,{childList:true});
    return observer;
   });
   const positions=[Number(timeline.getAttribute('viewBox').split(' ')[0])];
   for(let tick=0;tick<5;tick++){
    $('canvas').dispatchEvent(new WheelEvent('wheel',{
     bubbles:true,cancelable:true,shiftKey:true,deltaY:12,clientX:x,clientY:y
    }));
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    positions.push(Number(timeline.getAttribute('viewBox').split(' ')[0]));
   }
   observers.forEach(observer=>observer.disconnect());
   return {
    directChildMutations,
    sameNodes:timeline.firstElementChild===originalTimelineChild&&
     axis.firstElementChild===originalAxisChild,
    positions,
    aligned:Math.abs(Number(timeline.getAttribute('viewBox').split(' ')[0])-
     Number(axis.getAttribute('viewBox').split(' ')[0]))<1e-5
   };
  },{x,y});
  assert.equal(stablePan.directChildMutations,0,'small pans must not rebuild SVG children');
  assert(stablePan.sameNodes,'small pans must retain their original SVG paths');
  assert(stablePan.positions.every((value,index,values)=>index===0||value>values[index-1]),
   'camera must progress smoothly in the direction of each pan tick');
  assert(stablePan.aligned,'calendar axis must follow the same camera as the timeline');

  // One wheel event must preview the same SVG, not discard its DOM paths.
  const cameraPreview=await page.evaluate(({x,y})=>{
   const svg=$('timeline'),original=svg.firstElementChild;
   const wheel=new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:-12,clientX:x,clientY:y});
   $('canvas').dispatchEvent(wheel);
   return {samePath:svg.firstElementChild===original,
    previewVisible:svg.style.transform.includes('scaleX('),previewActive:wheelPreview};
  },{x,y});
  assert(cameraPreview.samePath&&cameraPreview.previewVisible&&cameraPreview.previewActive,
   'a live wheel tick should transform the cached SVG instead of rebuilding it');
  await page.waitForTimeout(260);
  const axisAtPointer=()=>page.evaluate(x=>{
   const width=$('canvas').clientWidth,pad=width<600?22:48,plot=width-2*pad;
   const [lo,hi]=range(),scale=makeTimeScale(lo,hi,pad,plot,datedEvents());
   return TimelineFlow.axisUnderPixel(x,scale,lo,hi);
  },x);
  const before=await page.evaluate(()=>({zoom,center}));
  const pinned=await axisAtPointer();
  await page.mouse.move(x,y);
  await page.mouse.wheel(0,-120);
  await page.waitForTimeout(450);
  const magnified=await page.evaluate(()=>({zoom,center}));
  assert(magnified.zoom>before.zoom,'wheel up must zoom in');
  const anchor=await axisAtPointer();
  assert(Math.abs(anchor-pinned)<1.1,'zoom must preserve the timeline position beneath the cursor');

  await page.mouse.wheel(0,120);
  await page.waitForTimeout(450);
  const restored=await page.evaluate(()=>({zoom,center}));
  assert(Math.abs(restored.zoom-before.zoom)<1e-5,'reversed wheel must restore scale');

  await page.keyboard.down('Shift');
  await page.mouse.wheel(0,120);
  await page.keyboard.up('Shift');
  await page.waitForTimeout(250);
  const panned=await page.evaluate(()=>({zoom,center}));
  assert.equal(panned.zoom,restored.zoom,'Shift + wheel must not zoom');
  assert.notEqual(panned.center,restored.center,'Shift + wheel must move the camera');
  
  await page.mouse.move(x,y);
  await page.mouse.down();
  await page.mouse.move(x+70,y,{steps:8});
  await page.mouse.up();
  await page.waitForTimeout(250);
  const dragged=await page.evaluate(()=>({zoom,center,rendered:$('timeline').querySelectorAll('.node').length,
   dividers:$('timeline').querySelectorAll('.calendar-division').length}));
  assert(dragged.center<panned.center,'dragging right must move camera toward earlier dates');
  assert.equal(dragged.zoom,panned.zoom);
  assert(dragged.dividers>0,'calendar dividers must be present');
  assert(dragged.rendered>0,'source nodes must remain visible');

  await page.evaluate(()=>{
   // The full chronology now starts decades before the main Naruto era.
   // Use an actual dated appearance instead of a hard-coded empty year-one day.
   const appearance=datedEvents().find(e=>Number.isFinite(e.day)&&
    e.tracks.some(id=>selected.has(id)));
   if(!appearance)throw new Error('No selectable dated appearance for day-view smoke test');
   zoom=zoomModes.day;
   center=clampAxisCenter(dayToAxis(appearance.day));
   render();
  });
  const moments=await page.evaluate(()=>$('timeline').querySelectorAll('.moment-node').length);
  assert(moments>0,'day view must preserve individual moments');
  await page.evaluate(()=>{zoom=zoomModes.year;center=clampAxisCenter(center);render();});
  const overview=await page.evaluate(()=>({arcs:$('timeline').querySelectorAll('.arc-node,.arc-cluster-node').length,
   months:$('timeline').querySelectorAll('.calendar-month,.calendar-year').length}));
  assert(overview.arcs>0,'year overview must retain arcs or joint arc marks');
  assert(overview.months>0,'overview must retain year/month boundaries');
  assert.deepEqual(errors,[],'there must be no browser runtime errors');
  console.log('Cursor wheel, drag, calendar dividers:',viewport.width+'×'+viewport.height,'passed');
  await page.close();
 }
}finally{await browser.close();server.close();}
