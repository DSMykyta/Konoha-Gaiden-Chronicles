import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const cache=vm.runInNewContext(fs.readFileSync(new URL('../public/timeline-pan-cache.js',import.meta.url),'utf8')+';TimelinePanCache');
const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');

test('a small pan retains identical layout and yields only a camera translation',()=>{
 const base=cache.frame({lo:30,hi:50,maxAxis:200,width:1000,height:700,zoom:12,dayPx:46,breaks:[]});
 assert(base.coverLo<30&&base.coverHi>50);
 const pan=cache.reuse(base,{lo:35,hi:55,width:1000,height:700,zoom:12,breaks:[]});
 assert(pan);
 assert.equal(pan.shift,-230);
 assert.equal(cache.reuse(base,{lo:60,hi:80,width:1000,height:700,zoom:12,breaks:[]}),null);
 assert.equal(cache.reuse(base,{lo:35,hi:55,width:375,height:700,zoom:12,breaks:[]}),null);
 assert.equal(cache.reuse(base,{lo:35,hi:55,width:1000,height:700,zoom:13,breaks:[]}),null);
 assert.equal(cache.reuse(base,{lo:35,hi:55,width:1000,height:720,zoom:12,breaks:[]}),null);
});

test('crossing a compressed time gap triggers a new geometry layout',()=>{
 const breaks=[{axis:49,size:20},{axis:90,size:8}];
 const base=cache.frame({lo:35,hi:55,maxAxis:120,width:1200,height:750,zoom:20,dayPx:42,breaks});
 assert(base.breakKey.includes('49:20'));
 assert(cache.reuse(base,{lo:36,hi:56,width:1200,height:750,zoom:20,breaks}));
 assert.equal(cache.reuse(base,{lo:50,hi:70,width:1200,height:750,zoom:20,breaks}),null,
   'the gap leaving the viewport changes its pixel allocation');
 assert.equal(cache.reuse(base,{lo:70,hi:90,width:1200,height:750,zoom:20,breaks}),null);
});

test('cached camera changes SVG viewBox without touching its children',()=>{
 const start=app.indexOf('function updatePanChrome(');
 const end=app.indexOf('function schedule(){',start);
 assert(start>=0&&end>start,'the camera fast path must be reachable');
 const attributes=new Map(),calls=[],elements={
  canvas:{clientWidth:1000,clientHeight:700},
  timeline:{setAttribute:(key,value)=>attributes.set('timeline:'+key,value),replaceChildren:()=>calls.push('svg-replaced')},
  timeAxis:{setAttribute:(key,value)=>attributes.set('axis:'+key,value),replaceChildren:()=>calls.push('axis-replaced')},
  eventCard:{hidden:true},
  timelineEmpty:{hidden:true},
  periodLabel:{textContent:''},dateInputLabel:{textContent:''},
  previous:{disabled:false},next:{disabled:false}
 };
 const frame=cache.frame({lo:30,hi:50,maxAxis:200,width:1000,height:700,zoom:12,dayPx:46,breaks:[]});
 Object.assign(frame,{
  nodes:[{id:'before',day:34,x:140,y:180},{id:'inside',day:42,x:450,y:200},{id:'later',day:54,x:900,y:220}],
  numbered:false,svgHeight:700,lineCount:2,availableCount:2,
  scale:{px:day=>day*46}
 });
 const env={
  data:{calendar:{view_days:365}},panFrame:frame,graphNodes:[],
  center:45,paintedCenter:40,zoom:12,hoverCard:false,
  TimelinePanCache:cache,uiTimers:{cancel(){}},$:(id)=>elements[id],
  document:{querySelectorAll:()=>[]},
  range:()=>[35,55],axisBreaks:()=>[],axisLength:()=>200,
  dayToAxis:day=>day,axisToDay:day=>day,
  yearText:()=> 'Рік Конохи',dateText:day=>String(day),
  currentZoomMode:()=> 'month',renderEraHeading:()=>{},
  previewPan:()=>calls.push('clear-preview'),
  updateFocusBar:()=>calls.push('focus-chrome'),
  cloudRenderer:{pan:value=>calls.push(['cloud-pan',value])},
  uiTimers:{cancel(){}}
 };
 const result=vm.runInNewContext(app.slice(start,end)+';applyBufferedPan()',env);
 assert.equal(result,true);
 assert.equal(attributes.get('timeline:viewBox'),'230 0 1000 700');
 assert.equal(attributes.get('axis:viewBox'),'230 0 1000 40');
 assert.deepEqual(Array.from(env.graphNodes,node=>node.id),['inside','later']);
 assert.equal(env.graphNodes[0].x,220);
 assert.equal(env.paintedCenter,45);
 assert(calls.some(call=>Array.isArray(call)&&call[0]==='cloud-pan'&&call[1]===-230));
 assert(!calls.includes('svg-replaced')&&!calls.includes('axis-replaced'));
});
