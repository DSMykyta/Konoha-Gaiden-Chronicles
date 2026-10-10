import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

test('drag-to-pinch gesture reuses compositor pan until release without rebuilding the SVG', () => {
  const app = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const begin = app.indexOf(" const canvas=$('timeline'),touches=new Map();let drag=null,pinch=null;");
  const finish = app.indexOf("  new ResizeObserver(schedule).observe($('canvas'));", begin);
  assert(begin >= 0 && finish > begin, 'gesture controller must remain discoverable');

  const listeners = new Map(), calls = [], frame = {scrollTop:0, clientWidth:375};
  const canvas = {
    clientWidth:375,
    style:{},
    classList:{add(){},remove(){}},
    getBoundingClientRect(){return {left:0};},
    setPointerCapture(){},
    addEventListener(kind, handler){listeners.set(kind, handler);}
  };
  const elements = {canvas:frame, timeline:canvas, timeAxis:{style:{}}, storyClouds:{style:{}}};
  const state = {
    $: id => elements[id], center:50, paintedCenter:50, zoom:12,
    wheelPreview:false, clamp:(n,a,b)=>Math.max(a,Math.min(n,b)),
    clampAxisCenter:n=>n, axisLength:()=>365,
    uiTimers:{cancel(){}}, previewPan:n=>calls.push(['preview',n]),
    render:()=>calls.push(['render']), setZoom:(z,p)=>calls.push(['zoom',z,p]),
    schedule:()=>calls.push(['commit'])
  };
  const gesture=vm.runInNewContext(app.slice(begin,finish)+';({get drag(){return drag},get pinch(){return pinch}})',state);
  const pointer=(pointerId,x,y)=>({pointerId,clientX:x,clientY:y,target:{closest(){return null;}}});
  listeners.get('pointerdown')(pointer(1,100,420));
  listeners.get('pointermove')(pointer(1,130,420));
  assert(gesture.drag.moved,'initial drag should move the timeline');
  const priorCenter=state.center;
  listeners.get('pointerdown')(pointer(2,200,420));
  assert(gesture.pinch,'second finger should begin pinch');
  assert.notEqual(gesture.pinch.basePan,0,'prior pan must survive pinch transition');
  assert(!calls.some(([kind])=>kind==='render'),'second finger must not rebuild SVG');

  listeners.get('pointermove')(pointer(2,245,420));
  assert.match(canvas.style.transform,/translate3d\\(.+px,0,0\\) scaleX\\(/);
  assert.equal(state.center,priorCenter,'pinch preview must not alter committed pan center');
  assert(!calls.some(([kind])=>kind==='render'),'pinch motion must remain compositor-only');

  listeners.get('pointerup')(pointer(2,245,420));
  assert(calls.some(([kind])=>kind==='zoom'),'release must apply final zoom');
  assert(calls.some(([kind])=>kind==='commit'),'drag portion must still be committed');
  assert(!calls.some(([kind])=>kind==='render'),'no synchronous SVG rebuild during gesture');
});
