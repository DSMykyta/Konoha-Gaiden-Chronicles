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

  await page.evaluate(()=>{zoom=zoomModes.day;center=dayToAxis(21.5);render();});
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
