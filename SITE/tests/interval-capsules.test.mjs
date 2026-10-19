import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const capsule=vm.runInNewContext(fs.readFileSync(new URL('../public/interval-capsules.js',import.meta.url),'utf8')+';IntervalCapsules');
const sceneMap=new Map([['class',{id:'class',location_id:'loc-academy-classroom',episode_id:'formation'}],
 ['hall',{id:'hall',location_id:'loc-academy-corridor',episode_id:'formation'}],
 ['dango',{id:'dango',location_id:'loc-dango-shop',episode_id:'team9'}]]);
const episodeMap=new Map([['formation',{id:'formation',arc_id:'genin'}],
 ['team9',{id:'team9',arc_id:'team9arc'}]]);
const px=day=>day*40;
const place={relation:(a,b)=>({grade:a===b?0:a&&b?1:null})};
const scene=(id,day,end,kind='scene')=>({
 id,kind,day,x:px(day),y:id==='hall'?145:100,spanStart:day,spanEnd:end,opacity:1,
 scene:sceneMap.get(id),sourceSceneIds:[id],sourceEpisodeIds:[sceneMap.get(id)?.episode_id]
});
test('an arc determines color of its episode, scene and moments',()=>{
 const color=capsule.color('genin');
 const nodes=[scene('class',10,10.5),scene('hall',10.6,10.9)];
 const result=capsule.build(nodes,'scene',sceneMap,episodeMap,place,px);
 assert.equal(result.capsules.length,2);
 assert(result.capsules.every(row=>row.colors.fill===color.fill));
 assert.notEqual(color.fill,capsule.color('team9arc').fill);
});
test('calendar widths are spans, not narrative word counts',()=>{
 const result=capsule.build([scene('class',10,12)],'scene',sceneMap,episodeMap,place,px);
 const shape=result.capsules[0];
 assert.equal(shape.width,80);
 assert.equal(shape.x,400);
 assert.equal(shape.from,10);
 assert.equal(shape.to,12);
});
test('siblings form geographic branches; different episodes never join',()=>{
 const nodes=[scene('class',10,10.35),scene('hall',10.4,10.65),scene('dango',10.7,11)];
 const result=capsule.build(nodes,'scene',sceneMap,episodeMap,place,px);
 assert(result.links.some(link=>link.from==='class'&&link.to==='hall'));
 assert(!result.links.some(link=>link.to==='dango'||link.from==='dango'));
});
test('a singleton scene stays a capsule at scene zoom',()=>{
 const out=capsule.build([scene('class',10,10)],'scene',sceneMap,episodeMap,place,px);
 assert.equal(out.capsules.length,1);
 assert(out.capsules[0].width>=16);
});
test('day zoom draws one scene capsule around its moment dots',()=>{
 const nodes=[{id:'m1',kind:'moment',day:10.2,x:px(10.2),y:90,opacity:1,
 group:[{id:'m1'}],sourceSceneIds:['class']},
 {id:'m2',kind:'moment',day:10.6,x:px(10.6),y:92,opacity:1,
 group:[{id:'m2'}],sourceSceneIds:['class']}];
 const out=capsule.build(nodes,'moment',sceneMap,episodeMap,place,px);
 assert.equal(out.capsules.length,1);
 assert.deepEqual(Array.from(out.capsules[0].momentIds),['m1','m2']);
 assert(out.capsules[0].width>16);
});
test('the arc level never creates merged groups, even for overlapping arcs',()=>{
 const a={id:'arc:genin',rawId:'genin',kind:'arc',day:10,x:400,y:90,spanStart:9,spanEnd:13,opacity:1};
 const b={id:'arc:team9arc',rawId:'team9arc',kind:'arc',day:10,x:400,y:90,spanStart:9,spanEnd:13,opacity:1};
 const result=capsule.build([a,b],'arc',sceneMap,episodeMap,place,px);
 assert.equal(result.capsules.length,2);
 assert.equal(result.links.length,0);
 assert.notEqual(result.capsules[0].colors.fill,result.capsules[1].colors.fill);
});
