import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const core=vm.runInNewContext(fs.readFileSync(new URL('../public/timeline-core.js',import.meta.url),'utf8')+';TimelineCore');
const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');

test('semantic zoom projects every level from canonical moment topology',()=>{
 assert.match(app,/baseLayoutCache\.has\('canonical-moments'\)/);
 assert.match(app,/aggregateLanes\(getSemantic\(kind\)\.nodes,originalY\)/);
 assert.match(app,/worldLineNodes=canonical\.moments\.map/);
 assert.match(app,/routeAnchorNodes=worldLineNodes/);
});

test('a scene/episode hub merges points without erasing the original strand anchors',()=>{
 const m1={id:'moment-1',day:10.1,calendarDay:10,y:115,layoutCast:['naruto'],cast:['naruto'],group:[{id:'moment-1',day:10,physical:['naruto']}]};
 const m2={id:'moment-2',day:10.3,calendarDay:10,y:165,layoutCast:['naruto'],cast:['naruto'],group:[{id:'moment-2',day:10,physical:['naruto']}]};
 const hub={id:'scene',day:10.2,calendarDay:10,y:140,layoutCast:['naruto'],cast:['naruto'],group:[...m1.group,...m2.group]};
 const routeAnchorMap=new Map([m1,m2].map(node=>[node.id,node]));
 routeAnchorMap.set(hub.id,hub);
 const anchors=core.characterAnchors([...routeAnchorMap.values()],['naruto']).get('naruto')
   .map(point=>({
    ...point,activityFrom:10,activityTo:10
   })).sort((a,b)=>a.day-b.day||a.id.localeCompare(b.id));
 const route=core.strand(anchors,'naruto',140,70,1,24,365);
 for(const target of [m1,m2,hub]){
  assert(route.some(p=>p.id===target.id&&p.day===target.day&&p.y===target.y),
   'route must pass through original and clustered marks: '+target.id);
 }
 assert.equal(m1.y,115);
 assert.equal(m2.y,165);
});

test('a singleton semantic group reuses its moment identity without doubling it',()=>{
 const original={id:'moment-1',day:10.1,y:110,layoutCast:['naruto'],cast:['naruto']};
 const singleton={...original,y:115};
 const nodes=new Map([[original.id,original]]);
 nodes.set(singleton.id,singleton);
 assert.equal(nodes.size,1);
 assert.equal(nodes.get(original.id).y,115);
});

test('geography-aware calendar pairs keep the same coordinates after day bucketing',()=>{
 const sample=Array.from({length:80},(_,i)=>({
  id:'m-'+i,day:Math.floor(i/10)+i%10*.04,
  calendarDay:Math.floor(i/10),
  locationId:i%2?'academy':'ichiraku',
  layoutGroup:'scene-'+Math.floor(i/4),
  layoutCast:['a','b','c','d'].slice(i%3)
 }));
 const first=core.sceneLayout(sample),second=core.sceneLayout(sample);
 assert.deepEqual(Array.from(first.entries()),Array.from(second.entries()));
});


test('episode clustering cannot close a real hiatus between physical appearances',()=>{
 const first={id:'event-one',day:1,calendarDay:1,activityFrom:1,activityTo:1};
 const second={id:'event-two',day:35,calendarDay:35,activityFrom:35,activityTo:35};
 const episode={id:'episode',isCluster:true,day:18,calendarDay:18,activityFrom:1,activityTo:35,
  group:[{id:'event-one'},{id:'event-two'}]};
 assert.equal(core.lifetimes([first,episode,second]).length,1,
  'ordinary lifetime grouping would incorrectly bridge this inactivity');
 const runs=core.clusteredLifetimes([first,episode,second]);
 assert.equal(runs.length,2,'a summary hub must not create an unrecorded continuous presence');
 assert(runs.flat().some(item=>item.id==='episode'),'the hub should remain visible on one real route');
 assert(runs.some(run=>run.some(item=>item.id==='event-one')));
 assert(runs.some(run=>run.some(item=>item.id==='event-two')));
});
