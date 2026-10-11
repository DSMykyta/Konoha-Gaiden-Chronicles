import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const first=app.indexOf('let suppressedAxisDateTick=null;');
const last=app.indexOf('function syncBufferedTabStops(',first);
assert(first>=0&&last>first,'The fixed-axis date helper must exist');

function fixture(){
 const make=()=>({
  style:{display:'none'},attributes:{},textContent:'',isConnected:true,classes:new Set(),
  setAttribute(k,v){this.attributes[k]=String(v);},
  removeAttribute(k){delete this.attributes[k];},
  getAttribute(k){return this.attributes[k]||null;},
  get classList(){
   const s=this.classes;
   return {add:k=>s.add(k),remove:k=>s.delete(k),contains:k=>s.has(k)};
  }
 });
 const label=make(),backing=make(),day20=make(),day21=make();
 const native=new Map([['20',day20],['21',day21]]);
 const axis={querySelector(selector){
  const match=/^\[data-date="(\d+)"\]$/.exec(selector);
  return native.get(match?.[1])||null;
 }};
 const elements={stickyDayLabel:label,stickyDayBacking:backing,timeAxis:axis};
 const context={
  data:{calendar:{view_days:365}},Math,Number,
  $:id=>elements[id],axisToDay:value=>value,
  dateText:day=>String(day+1).padStart(2,'0')+'.01'
 };
 vm.createContext(context);
 vm.runInContext(app.slice(first,last),context);
 const sync=(lo,shift,scale,width=1000)=>vm.runInContext(
  'syncStickyDay('+lo+','+shift+',{px:day=>48+(day-20)*'+scale+'},'+width+')',context
 );
 return {sync,label,backing,day20,day21};
}

test('the original label remains fixed to the actual day boundary when that boundary is visible',()=>{
 const {sync,label}=fixture();
 sync(20,0,900);
 assert.equal(label.style.display,'none');
});

test('at deep zoom a date is fixed at the left while the day continues offscreen',()=>{
 const {sync,label,backing,day20}=fixture();
 sync(20.4,-360,900);
 assert.equal(label.textContent,'21.01');
 assert.equal(label.attributes['data-sticky-day'],'20');
 assert.equal(label.style.display,'');
 // SVG camera is shifted -360: screen x = world x - 360.
 assert.equal(+label.attributes.x-360,54);
 assert.equal(backing.style.display,'');
 assert(day20.classes.has('is-sticky-suppressed'));
});

test('the next day pushes the pinned label aside instead of overlapping it',()=>{
 const {sync,label}=fixture();
 sync(20.4,-360,900);
 const fixedScreenX=+label.attributes.x-360;
 sync(20.98,-882,900);
 assert(+label.attributes.x-882<fixedScreenX);
});

test('when the boundary is crossed, the label switches to the next day and releases the previous tick',()=>{
 const {sync,label,day20,day21}=fixture();
 sync(20.4,-360,900);
 sync(21,-900,900);
 assert.equal(label.style.display,'none');
 assert.equal(day20.classes.has('is-sticky-suppressed'),false);
 sync(21.3,-1170,900);
 assert.equal(label.textContent,'22.01');
 assert.equal(label.attributes['data-sticky-day'],'21');
 assert.equal(day21.classes.has('is-sticky-suppressed'),true);
});

test('ordinary zoom never pins the date, including after a detail view',()=>{
 const {sync,label,day20}=fixture();
 sync(20.4,-360,900);
 sync(20.4,-36,90);
 assert.equal(label.style.display,'none');
 assert.equal(day20.classes.has('is-sticky-suppressed'),false);
});

test('on a phone the sticky date stays near the left plot edge',()=>{
 const {sync,label}=fixture();
 // Mobile viewport 375px; the normal plot begins at x=22 instead of x=48.
 // This zoom exposes less than one calendar day at a time.
 sync(20.4,-132,330,375);
 // The mock scale itself starts at desktop x=48. The sticky date is
 // correctly positioned by the real mobile plot padding instead.
 assert.equal(label.style.display,'');
 assert.equal(+label.attributes.x-132,28);
});

test('the helper is wired into both full redraws and the cached pan camera',()=>{
 assert.match(app,/timeline\.replaceChildren\(frame\);axisElement\.replaceChildren\(axis\);\s*syncStickyDay\(lo,0,timeScale,w\)/);
 assert.match(app,/function updatePanChrome\([\s\S]*?syncStickyDay\(lo,shift,panFrame\.scale,/);
 assert.match(app,/svg\('text',\{id:'stickyDayLabel'/);
});
