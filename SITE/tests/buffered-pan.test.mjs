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

test('crossing a compressed gap retains geometry until overscan is exhausted',()=>{
 const breaks=[{axis:49,size:20},{axis:90,size:8}];
 const base=cache.frame({lo:35,hi:55,maxAxis:120,width:1200,height:750,zoom:20,dayPx:42,breaks},2);
 for(const lo of [36,49,50,69,70])
  assert(cache.reuse(base,{lo,hi:lo+20,width:1200,height:750,zoom:20,breaks}));
 assert.equal(cache.reuse(base,{lo:76,hi:96,width:1200,height:750,zoom:20,breaks}),null);
});

test('calendar gaps cannot change positions beyond the camera translation',()=>{
 const first=app.indexOf('function makeTimeScale('),last=app.indexOf('function svg(',first);
 assert(first>=0&&last>first);
 const env={axisBreaks:()=>[{axis:40,size:20,from:40,to:60,omitted:20}],
  dayToAxis:d=>d<=40?d:d<60?40:d-20,
  chronologyBreaks:()=>[{from:40,to:60}]};
 const scale=vm.runInNewContext(app.slice(first,last)+';makeTimeScale',env);
 const a=scale(19,39,48,904,[]),b=scale(21,41,48,904,[]);
 assert.equal(a.dayPx,b.dayPx);
 assert(Math.abs(a.axisPx(30)-b.axisPx(30)-2*a.dayPx)<1e-8);
 assert(Math.abs((a.axisPx(35)-a.axisPx(30))-(b.axisPx(35)-b.axisPx(30)))<1e-8);
 assert.equal(b.px(40),b.px(60));
 assert.equal(b.hidden(50),true);
 assert.equal(b.hidden(61),false);
 assert.match(app,/const renderedBreaks=axisBreaks\(\)\.filter\(gap=>gap\.axis>=buffered\.coverLo&&gap\.axis<=buffered\.coverHi\)/);
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
  periodLabel:{textContent:''},periodButton:{setAttribute(){}},dateInputLabel:{textContent:''},
  previous:{disabled:false},next:{disabled:false}
 };
 const frame=cache.frame({lo:30,hi:50,maxAxis:200,width:1000,height:700,zoom:12,dayPx:46,breaks:[]});
 Object.assign(frame,{
  nodes:[{id:'before',day:34,x:140,y:180},{id:'inside',day:42,x:450,y:200},{id:'later',day:54,x:900,y:220}],
  numbered:false,svgHeight:700,lineCount:2,availableCount:2,
  scale:{px:day=>day*46}
 });
 const env={
  data:{calendar:{view_days:365}},panFrame:frame,graphNodes:[],graphLabels:[],
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


test('prefetched offscreen marks cannot steal keyboard focus',()=>{
 const start=app.indexOf('function syncBufferedTabStops(');
 const end=app.indexOf('function applyBufferedPan(){',start);
 assert(start>=0&&end>start);
 const make=id=>({
  dataset:{event:id},
  classList:{contains:()=>false},
  tabindex:null,
  setAttribute(key,value){if(key==='tabindex')this.tabindex=value;}
 });
 const inside=make('inside'),prefetched=make('prefetched');
 const ctx={
  graphNodes:[{id:'inside'}],
  graphLabels:[],
  document:{querySelectorAll:selector=>selector==='#timeline .node'?[inside,prefetched]:[]},
  $:()=>({clientWidth:800})
 };
 vm.runInNewContext(app.slice(start,end)+';syncBufferedTabStops()',ctx);
 assert.equal(inside.tabindex,'0');
 assert.equal(prefetched.tabindex,'-1');
 ctx.graphNodes=[{id:'prefetched'}]; // Camera moves without recreating the nodes.
 vm.runInNewContext(app.slice(start,end)+';syncBufferedTabStops()',ctx);
 assert.equal(inside.tabindex,'-1');
 assert.equal(prefetched.tabindex,'0');
});
