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
 for(const a of anchors){assert.equal(core.curveY(route,a.day),a.y);const left=(a.y-core.curveY(route,a.day-1e-7))/1e-7,right=(core.curveY(route,a.day+1e-7)-a.y)/1e-7;assert(Math.abs(left-right)<.001);}
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

test('a character strand reaches distinct scenes that share a display time',()=>{
 const anchors=[{id:'a',day:10,y:140},{id:'b',day:10,y:190},{id:'c',day:20,y:160}];
 const route=core.avoid(core.strand(anchors,'one',180,80),[{id:'unrelated',day:10,y:165}],'one',30);
 for(const a of anchors)assert(route.some(p=>p.node&&p.id===a.id&&p.day===a.day&&p.y===a.y));
 assert(route.every((p,i)=>!i||p.day>=route[i-1].day));
});

test('dense scene nodes retain time coordinates and have independently tappable centers',()=>{
 const nodes=Array.from({length:6},(_,i)=>({id:'scene-'+i,kind:'scene',x:100+i*3,y:240+i,day:21}));
 const separated=core.separateNodes(nodes,80,500);
 assert.equal(separated.length,nodes.length);
 for(let i=0;i<separated.length;i++){
  const a=separated[i];assert.equal(a.x,nodes[i].x);assert.equal(a.day,nodes[i].day);assert(a.y>=80&&a.y<=500);
  for(const b of separated.slice(i+1))assert(Math.hypot(a.x-b.x,a.y-b.y)>=44,'44px hit areas overlap');
 }
 assert.deepEqual(nodes.map(n=>n.y),[240,241,242,243,244,245]);
});

test('a short viewport extends the canvas instead of stacking scene markers',()=>{
 const nodes=Array.from({length:12},(_,i)=>({id:'scene-'+i,kind:'scene',x:100,y:150,day:21}));
 const separated=core.separateNodes(nodes,100,190);
 assert(separated.some(n=>n.y>190));
 for(let i=0;i<separated.length;i++)for(const b of separated.slice(i+1))assert(Math.abs(separated[i].y-b.y)>=24);
 assert(separated.every(n=>n.x===100&&n.day===21));
});

test('inactive strands fade between appearances even across a compressed calendar gap',()=>{
 const anchors=[{day:10,calendarDay:10},{day:11,calendarDay:60},{day:12,calendarDay:61}];
 const runs=core.lifetimes(anchors,{pixelsPerDay:10});
 assert.deepEqual(Array.from(runs,run=>Array.from(run,a=>a.calendarDay)),[[10],[60,61]]);
 const aggregate=[{day:10,activityFrom:10,activityTo:59},{day:11,activityFrom:60,activityTo:61}];
 assert.equal(core.lifetimes(aggregate,{pixelsPerDay:10}).length,1);
});

test('zoom separates distant appearances while preserving equal-time physical anchors',()=>{
 const anchors=[{day:10,y:10},{day:10,y:20},{day:20,y:30}];
 assert.equal(core.lifetimes(anchors,{pixelsPerDay:20}).length,1);
 const runs=core.lifetimes(anchors,{pixelsPerDay:100});
 assert.equal(runs.length,2);assert.equal(runs[0].length,2);
});

test('shape-preserving slopes pass smoothly through anchors without overshoot',()=>{
 const points=[{day:0,y:0,node:true},{day:1,y:8,node:true},{day:10,y:10,node:true},{day:11,y:30,node:true}];
 assert(core.slopes(points)[1]>0);
 for(let i=1;i<points.length;i++)for(let t=0;t<=1;t+=.05){
  const y=core.curveY(points,points[i-1].day+(points[i].day-points[i-1].day)*t);
  assert(y>=points[i-1].y-1e-8&&y<=points[i].y+1e-8);
 }
});

test('long spans have bounded drift and a bounded number of controls',()=>{
 const route=core.strand([{id:'a',day:10,y:100},{id:'b',day:300,y:100}],'one',100,150,1,1000);
 assert(route.length<=7);
 assert(route.every(point=>Math.abs(point.y-100)<=6));
});
