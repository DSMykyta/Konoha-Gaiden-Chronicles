import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const core=vm.runInNewContext(
 fs.readFileSync(new URL('../public/timeline-core.js',import.meta.url),'utf8')+';TimelineCore'
);
const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');

const team7=['naruto','sasuke','sakura','kakashi'];
const team9=['kita','ren','sora','raido'];
const sites={
 relation(a,b){
  return {grade:a===b?0:a==='far-country'||b==='far-country'?4:2};
 }
};
const scene=(name,cast,location,offset)=>Array.from({length:4},(_,i)=>({
 id:name+'-'+i,day:21+offset+i*.008,calendarDay:21,
 layoutGroup:name,locationId:location,layoutCast:cast
}));

test('vertical geography uses the actual canvas height instead of a 150px stripe',()=>{
 assert.match(app,/amplitude=clamp\(\(flowBottom-flowTop\)\*\.47,24,360\)/);
 assert.match(app,/const mid=\(flowTop\+flowBottom\)\/2/);
 assert.match(app,/TimelineCore\.spreadLanePosition\(canonical\.lanes\.get\(p\.id\)\|\|0\)/);
 const points=[-.92,-.5,-.1,0,.1,.5,.92];
 const mapped=points.map(value=>core.spreadLanePosition(value));
 for(let i=1;i<mapped.length;i++)assert(mapped[i]>mapped[i-1],'lane order must never flip');
 assert.equal(mapped[3],0);
 assert(mapped[4]>.1&&mapped[2]<-.1,'nearby independent streams must get more room');
 assert(mapped.every(value=>Math.abs(value)<=1),'expansion stays within the available canvas');
});

test('one traveling team keeps a continuous corridor between nearby places',()=>{
 const first=scene('field9',team9,'training-ground',.0),
  second=scene('ravine',team9,'training-ravine',.09);
 const original=new Map([...first.map(p=>[p.id,-.72]),...second.map(p=>[p.id,.72])]);
 const fixed=core.stabilizeSequences([...first,...second],original,sites);
 const a=fixed.get(first[0].id),b=fixed.get(second[0].id);
 assert(Math.abs(a-b)<.35,'same physical team must not make a screen-wide jump');
 assert.equal(fixed.get(first[0].id),fixed.get(first[3].id));
 assert.equal(fixed.get(second[0].id),fixed.get(second[3].id));
});

test('different teams do not become the same river merely because they share one day',()=>{
 const seven=scene('seven',team7,'training-ground',0),
  nine=scene('nine',team9,'training-ground',.05);
 const original=new Map([...seven.map(p=>[p.id,-.6]),...nine.map(p=>[p.id,.6])]);
 const fixed=core.stabilizeSequences([...seven,...nine],original,sites);
 assert.equal(fixed.get(seven[0].id),-.6);
 assert.equal(fixed.get(nine[0].id),.6);
});

test('confirmed separate countries retain distinct geography even for one crew',()=>{
 const home=scene('home',team9,'training-ground',0),
  abroad=scene('abroad',team9,'far-country',.08);
 const original=new Map([...home.map(p=>[p.id,-.7]),...abroad.map(p=>[p.id,.7])]);
 const fixed=core.stabilizeSequences([...home,...abroad],original,sites);
 assert.equal(fixed.get(home[0].id),-.7);
 assert.equal(fixed.get(abroad[0].id),.7);
});

test('a mixed team meeting does not permanently glue both teams together',()=>{
 const joint=scene('joint',[...team7,...team9],'training-ground',0),
  seven=scene('seven',team7,'training-ground',.07),
  nine=scene('nine',team9,'training-ground',.14);
 const original=new Map([...joint.map(p=>[p.id,0]),
  ...seven.map(p=>[p.id,-.65]),...nine.map(p=>[p.id,.65])]);
 const fixed=core.stabilizeSequences([...joint,...seven,...nine],original,sites);
 assert(fixed.get(seven[0].id)<-.35);
 assert(fixed.get(nine[0].id)>.35);
});

test('monotone river bends do not stop at every recorded event',()=>{
 const anchors=[
  {id:'a',day:10,y:120},
  {id:'b',day:13,y:140},
  {id:'c',day:16,y:160}
 ];
 const route=core.strand(anchors,'steady-river',145,80,.25,100);
 const at=route.findIndex(p=>p.id==='b');
 assert(at>0);
 assert(core.slopes(route)[at]>0,'middle of a steady ascent must keep its tangent');
 assert.equal(core.curveY(route,13),140,'line must still pass through the moment');
 for(let x=10;x<=16;x+=.25)assert(Number.isFinite(core.curveY(route,x)));
});

test('stable character channels replace random per-segment left/right bends',()=>{
 const nodes=[{id:'first',day:10,y:140},{id:'last',day:20,y:140}];
 const a=core.strand(nodes,'person-a',140,90,1,70);
 const again=core.strand(nodes,'person-a',140,90,1,70);
 const b=core.strand(nodes,'person-b',140,90,1,70);
 assert.deepEqual(Array.from(a,p=>({day:p.day,y:p.y})),Array.from(again,p=>({day:p.day,y:p.y})));
 assert.notEqual(core.curveY(a,15),core.curveY(b,15));
 assert.equal(core.curveY(a,10),140);
 assert.equal(core.curveY(a,20),140);
});
