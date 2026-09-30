import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const core=vm.runInNewContext(fs.readFileSync(new URL('../public/timeline-core.js',import.meta.url),'utf8')+';TimelineCore');

test('accepted chronology orders scene hubs and observations align separate scenes',()=>{
 const events=[{id:'d',scene_id:'dango',day:21,display_rank:1},{id:'c',scene_id:'class',day:21,display_rank:2},{id:'w',scene_id:'waiting',day:21,display_rank:3},{id:'x',scene_id:'exterior',day:21,display_rank:4}],relations=[{kind:'before',review:'accepted',a:'class',b:'waiting'},{kind:'before',review:'accepted',a:'w',b:'dango'},{kind:'observes',review:'accepted',a:'c',b:'exterior'},{kind:'before',review:'pending',a:'dango',b:'class'}],scenes=core.scenes(events,relations);
 assert.deepEqual(Array.from(scenes,s=>s.id),['class','exterior','waiting','dango']);assert.equal(scenes[0].position,scenes[1].position);assert(scenes[2].position>scenes[1].position);assert(scenes[3].position>scenes[2].position);assert.equal(scenes[1].group.length,1);
 assert.equal(core.navigation(events,'w',21,relations).next.id,'d');
});

test('scene display_rank is a stable fallback and accepted before still wins',()=>{
 const events=[{id:'a1',scene_id:'alpha',day:21,display_rank:100},{id:'b1',scene_id:'beta',day:21,display_rank:100},{id:'g1',scene_id:'gamma',day:21,display_rank:100}],relations=[{kind:'before',review:'accepted',a:'alpha',b:'beta'}],meta=[{id:'alpha',display_rank:200},{id:'beta',display_rank:100},{id:'gamma',display_rank:150}];
 const scenes=core.scenes(events,relations,meta);
 assert.deepEqual(Array.from(scenes,s=>s.id),['gamma','alpha','beta']);
});

test('a strand starts near its first scene, curves between scenes and ends near its last record',()=>{
 const anchors=[{id:'scene-one',day:20,y:110},{id:'scene-two',day:35,y:220},{id:'scene-three',day:40,y:110}],route=core.strand(anchors,'character',180,80,.25);
 assert.equal(route[0].day,19.75);assert.equal(route.at(-1).day,40.25);
 for(const a of anchors){assert.equal(core.curveY(route,a.day),a.y);const derivative=(core.curveY(route,a.day+1e-7)-core.curveY(route,a.day-1e-7))/2e-7;assert(Math.abs(derivative)<.001);}
 assert(core.curveY(route,27)>110);assert(core.curveY(route,27)<220);
 assert.equal(core.strand([],'not-introduced',180,80).length,0);
});

test('an unrelated scene cannot be mistaken for a shared anchor',()=>{
 const route=core.strand([{id:'own-first',day:10,y:140},{id:'own-last',day:30,y:160}],'other',180,80);
 const y=core.curveY(route,20),unrelated={id:'unrelated-scene',day:20,y},avoiding=core.avoid(route,[unrelated,{id:'outside',day:90,y:150}],'other',30);
 assert(Math.abs(core.curveY(avoiding,20)-y)>=30);
 assert.equal(core.curveY(avoiding,10),140);assert.equal(core.curveY(avoiding,30),160);
 assert(avoiding.every(p=>p.day<=31));
});

test('characters sharing two scenes still have distinguishable curved strands',()=>{
 const anchors=[{id:'a',day:10,y:140},{id:'b',day:20,y:140}],one=core.strand(anchors,'one',180,80),two=core.strand(anchors,'two',180,80);
 assert.notEqual(core.curveY(one,15),140);assert.notEqual(core.curveY(one,15),core.curveY(two,15));
 assert.equal(core.curveY(one,10),core.curveY(two,10));assert.equal(core.curveY(one,20),core.curveY(two,20));
});
