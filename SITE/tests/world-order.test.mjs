import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const core=vm.runInNewContext(
 fs.readFileSync(new URL('../public/timeline-core.js',import.meta.url),'utf8')+';TimelineCore'
);
const event=(id,scene_id,rank,day=21)=>({id,scene_id,display_rank:rank,day});
const rel=(kind,a,b,id=kind+':'+a+':'+b)=>({id,kind,a,b,review:'accepted'});

test('the world model drives moment X and derived scene spans from a single solution',()=>{
 const events=[
  event('iruka','class',50),event('kita-sees','class',100),
  event('team9','class',400),event('jonin','outside',100)
 ];
 const relations=[
  rel('before','iruka','kita-sees'),rel('before','kita-sees','team9'),
  rel('observes','kita-sees','outside')
 ];
 const world=core.world(events,relations,[
  {id:'class',display_rank:200},{id:'outside',display_rank:100}
 ]);
 const classroom=world.scenes.find(s=>s.id==='class');
 const exterior=world.scenes.find(s=>s.id==='outside');
 assert.equal(world.moments.get('kita-sees'),world.moments.get('jonin'));
 assert.equal(classroom.position,world.moments.get('kita-sees'));
 assert.equal(exterior.position,world.moments.get('jonin'));
 assert(classroom.spanStart<world.moments.get('kita-sees'));
 assert(classroom.spanEnd>world.moments.get('kita-sees'));
 assert.equal(exterior.spanStart,exterior.spanEnd);
 assert.equal(core.auditTime(world,relations).length,0);
});

test('Waves: a parallel home rescue stays inside a long-running bridge scene',()=>{
 const events=[
  event('bridge-attack','bridge',100),event('bridge-end','bridge',800),
  event('house-attacked','home',100),event('naruto-rescues','home',200)
 ];
 const relations=[
  rel('before','bridge-attack','naruto-rescues'),
  rel('before','house-attacked','naruto-rescues'),
  rel('before','naruto-rescues','bridge-end')
 ];
 const world=core.world(events,relations);
 const bridge=world.scenes.find(s=>s.id==='bridge');
 assert(bridge.spanStart<world.moments.get('naruto-rescues'));
 assert(world.moments.get('naruto-rescues')<bridge.spanEnd);
 assert(bridge.position>=bridge.spanStart&&bridge.position<=bridge.spanEnd);
 assert.equal(core.auditTime(world,relations).length,0);
});

test('scroll, Hokage search and confrontation do not inherit ranks across scenes',()=>{
 const events=[
  event('exam','academy',100),event('theft','office',100),
  event('search','hokage',100),event('confrontation','forest',100)
 ];
 const relations=[
  rel('before','exam','theft'),rel('before','theft','search'),
  rel('before','search','confrontation')
 ];
 const world=core.world(events,relations);
 assert.deepEqual(Array.from(world.orderedMoments,e=>e.id),[
  'exam','theft','search','confrontation'
 ]);
 assert.equal(core.auditTime(world,relations).length,0);
});

test('an accepted cyclic before contradiction is diagnosed, not claimed verified',()=>{
 const events=[event('first','scene',100),event('second','scene',200)];
 const relations=[
  rel('before','first','second','forward'),
  rel('before','second','first','reversed')
 ];
 const world=core.world(events,relations);
 const issues=core.auditTime(world,relations);
 assert(issues.some(issue=>issue.kind==='before_conflict'));
 assert(issues.some(issue=>issue.id==='forward'||issue.id==='reversed'));
});

test('explicit same_span is synchronized without merging distinct nodes',()=>{
 const events=[event('class','a',100),event('yard','b',100)];
 const links=[rel('same_span','class','yard')];
 const world=core.world(events,links);
 assert.equal(world.moments.get('class'),world.moments.get('yard'));
 assert.notEqual(world.scenes.find(s=>s.id==='a').id,world.scenes.find(s=>s.id==='b').id);
 assert.equal(core.auditTime(world,links).length,0);
});
