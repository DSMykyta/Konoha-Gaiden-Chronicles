import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import YAML from 'yaml';

const core=vm.runInNewContext(
 fs.readFileSync(new URL('../public/timeline-core.js',import.meta.url),'utf8')+';TimelineCore'
);
const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const team7=['naruto','sasuke','sakura','kakashi'],team9=['kita','ren','sora','raido'];
const moments=(cast,prefix,location='loc-academy-classroom')=>
 Array.from({length:18},(_,i)=>({
  id:prefix+'-'+i,kind:'moment',day:22+i*.014,calendarDay:22,
  layoutGroup:prefix+Math.floor(i/4),locationId:location,layoutCast:cast
 }));
const maxHop=(nodes,lanes)=>Math.max(...nodes.slice(1).map((node,i)=>
 Math.abs(lanes.get(node.id)-lanes.get(nodes[i].id))*145
));

test('old collision pass produced zigzags for one continuous team',()=>{
 const nodes=moments(team7,'team7');
 const raw=core.sceneLayout(nodes,[],{},0,1);
 const previous=core.separateNodes(nodes.map(p=>({...p,x:p.day*780,y:510+raw.get(p.id)*145})),166,740,46);
 const oldHop=Math.max(...previous.slice(1).map((p,i)=>Math.abs(p.y-previous[i].y)));
 const stabilized=core.stabilizeSequences(nodes,raw);
 assert(oldHop>40,'fixture must reproduce the sawtooth');
 assert(maxHop(nodes,stabilized)<10,'Team 7 should retain a gently flowing lane');
});

test('two teams remain separate while each examination sequence is smooth',()=>{
 const seven=moments(team7,'team7'),nine=moments(team9,'team9');
 const all=seven.flatMap((p,i)=>[p,nine[i]]);
 const stable=core.stabilizeSequences(all,core.sceneLayout(all,[],{},0,1));
 const mean=list=>list.reduce((sum,p)=>sum+stable.get(p.id),0)/list.length;
 assert(Math.abs(mean(seven)-mean(nine))*145>65,'Team 7 and Team 9 must not merge');
 assert(maxHop(seven,stable)<12);
 assert(maxHop(nine,stable)<12);
});

test('movement into a distant country must not be flattened',()=>{
 const home=moments(team7,'home','loc-academy-classroom');
 const away=moments(team7,'away','loc-land-of-snow');
 const raw=new Map([...home.map(p=>[p.id,-.7]),...away.map(p=>[p.id,.7])]);
 const fixed=core.stabilizeSequences([...home,...away],raw);
 assert.equal(fixed.get(home[0].id),-.7);
 assert.equal(fixed.get(away[0].id),.7);
});

test('unlocated scenes cannot be conflated as one physical location',()=>{
 const a=moments(team7,'unknown-a',null),b=moments(team7,'unknown-b',null);
 const raw=new Map([...a.map(p=>[p.id,-.8]),...b.map(p=>[p.id,.8])]);
 const fixed=core.stabilizeSequences([...a,...b],raw);
 assert(fixed.get(a[0].id)<0&&fixed.get(b[0].id)>0);
});

test('render uses stable source lanes rather than fictitious screen collisions',()=>{
 assert(app.includes('TimelineCore.stabilizeSequences(moments,solved,geographyAtlas)'));
 assert(!app.includes('TimelineCore.separateNodes(canonical.moments'));
 assert(app.includes('canonical.lanes.get(p.id)'));
 assert(app.includes('const worldLineNodes=canonical.moments.map'));
});


test('real bell test and Team 9 field, ravine, catacombs flow without sawtooth bends',()=>{
 const folder=new URL('../../KONOHA_GAIDEN_ARCS_ZIGRANE_POV_V3/CHRONOLOGY/data/scenes/',import.meta.url);
 const filenames=[
  'sc-y0-0123-team7-bell-test.yaml',
  'sc-y0-0123-field8-observation.yaml',
  'sc-y0-0123-team9-field9.yaml',
  'sc-y0-0123-team9-ravine.yaml',
  'sc-y0-0123-team9-catacombs.yaml'
 ];
 const stages=filenames.map((filename,sceneIndex)=>{
  const scene=YAML.parse(fs.readFileSync(new URL(filename,folder),'utf8'));
  return scene.events.map((event,i)=>({
   id:event.id,kind:'moment',
   day:22+sceneIndex*.045+i*.003,calendarDay:22,
   locationId:event.location_id||scene.location_id||null,
   layoutGroup:scene.id,
   layoutCast:(event.involvement||[]).filter(person=>person.mode==='physical')
    .map(person=>person.entity_id)
  }));
 });
 const all=stages.flat();
 const lanes=core.stabilizeSequences(all,core.sceneLayout(all,[],{},0,1));
 for(const [index,stage] of stages.entries()){
  const jumps=stage.slice(1).map((node,i)=>
   Math.abs(lanes.get(node.id)-lanes.get(stage[i].id))*145);
  assert(Math.max(0,...jumps)<15,'zigzag within '+filenames[index]);
 }
 const team9Stages=stages.slice(1),means=team9Stages.map(stage=>
  stage.reduce((sum,node)=>sum+lanes.get(node.id),0)/stage.length
 );
 const moves=means.slice(1).map((n,i)=>Math.abs(n-means[i])*145);
 assert(Math.max(...moves)<25,'Team 9 is one moving party across its four real trial locations');
});
