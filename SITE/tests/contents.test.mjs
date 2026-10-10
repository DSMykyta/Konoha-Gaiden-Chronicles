import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../public/contents-panel.js',import.meta.url),'utf8');
const contents=vm.runInNewContext(source+';ChronologyContents');

test('contents sort actual dated scenes and parents, not YAML registration order',()=>{
  const scenes=[
    {id:'later',position:20,group:[{id:'m2',title:'Later moment'}]},
    {id:'earlier',position:5,group:[{id:'m1',title:'Early moment'}]},
    {id:'unrelated',position:10,group:[{id:'m3',title:'Other moment'}]}
  ];
  const sm=new Map([['later',{title:'Later scene',episode_id:'e1'}],['earlier',{title:'Early scene',episode_id:'e1'}],['unrelated',{title:'Other scene',episode_id:'e2'}]]);
  const em=new Map([['e1',{id:'e1',title:'E1',arc_id:'a1'}],['e2',{id:'e2',title:'E2',arc_id:'a2'}]]);
  const am=new Map([['a1',{id:'a1',title:'Arc 1'}],['a2',{id:'a2',title:'Arc 2'}]]);
  const tree=contents.buildTree(scenes,sm,em,am);
  assert.equal(tree[0].id,'a1');
  assert.equal(tree[0].start,5);
  assert.equal(tree[0].end,20);
  assert.equal(tree[0].children[0].children[0].id,'earlier');
  assert.equal(tree[0].children[0].children[1].id,'later');
  assert.equal(tree[1].id,'a2');
});
test('scenes without an episode remain findable in an alternate-structure group',()=>{
  const scenes=[{id:'solo',position:8,group:[{id:'event',title:'Solo event'}]}];
  const tree=contents.buildTree(scenes,new Map(),new Map(),new Map());
  assert.equal(tree[0].kind,'group');
  assert.equal(tree[0].children[0].children[0].id,'solo');
  assert.equal(tree[0].children[0].children[0].children[0].id,'event');
});


test('moments inside a scene retain source rank rather than alphabetical order',()=>{
 const scenes=[{id:'s',position:10.4,group:[{id:'first',title:'Я — перший'},{id:'second',title:'А — другий'}]}];
 const sm=new Map([['s',{title:'Scene',episode_id:'e'}]]),em=new Map([['e',{id:'e',title:'Episode',arc_id:'a'}]]),am=new Map([['a',{id:'a',title:'Arc'}]]);
 const leaves=contents.buildTree(scenes,sm,em,am)[0].children[0].children[0].children;
 assert.deepEqual(leaves.map(x=>x.id),['first','second']);
});


test('undated D-rank missions appear before Tazuna and not after Sasuke departure',()=>{
 const scenes=[
  {id:'post-sasuke',position:80,group:[{id:'departure',title:'Naruto leaves'}]},
  {id:'tazuna',position:20,group:[{id:'tora-returned',title:'Tora returned'}]},
  {id:'tora',position:null,day:null,group:[{id:'tora-caught',title:'Tora found'}]},
  {id:'d-ranks',position:null,day:null,group:[{id:'simple-errands',title:'Earlier D-ranks'}]}
 ];
 const sm=new Map([
  ['post-sasuke',{title:'After Sasuke',episode_id:'post'}],
  ['tazuna',{title:'Tazuna',episode_id:'waves'}],
  ['tora',{title:'Tora capture',episode_id:'tora-ep'}],
  ['d-ranks',{title:'D-rank missions',episode_id:'d-ep'}]
 ]);
 const em=new Map([
  ['post',{id:'post',title:'Post Sasuke',arc_id:'late'}],
  ['waves',{id:'waves',title:'Waves',arc_id:'waves-arc'}],
  ['tora-ep',{id:'tora-ep',title:'Tora',arc_id:'early'}],
  ['d-ep',{id:'d-ep',title:'D-rank',arc_id:'early'}]
 ]);
 const am=new Map([
  ['late',{id:'late',title:'Late arc'}],
  ['waves-arc',{id:'waves-arc',title:'Waves arc'}],
  ['early',{id:'early',title:'Early arc'}]
 ]);
 const accepted=(a,b)=>({a,b,kind:'before',review:'accepted'});
 const relations=[
  accepted('d-ranks','tora'),
  accepted('tora','tora-returned')
 ];
 const tree=contents.buildTree(scenes,sm,em,am,null,relations);
 assert.deepEqual(Array.from(tree.map(x=>x.id)),['early','waves-arc','late']);
 const early=tree[0];
 assert(!Number.isFinite(early.start),'Narrative ordering must not invent an event date');
 assert(Number.isFinite(early.orderPosition));
 assert(early.orderPosition<tree[1].orderPosition);
 assert.equal(early.children[0].id,'d-ep');
 assert.equal(early.children[1].id,'tora-ep');
 assert(!Number.isFinite(early.children[0].children[0].start));
});

test('unrelated undated events stay unplaced; pending links do not imply chronology',()=>{
 const scenes=[
  {id:'known',position:12,group:[{id:'known-event',title:'Known'}]},
  {id:'unknown',position:null,day:null,group:[{id:'unknown-event',title:'Unknown'}]}
 ];
 const sm=new Map([['known',{episode_id:'ek'}],['unknown',{episode_id:'eu'}]]);
 const em=new Map([['ek',{id:'ek',arc_id:'ak'}],['eu',{id:'eu',arc_id:'au'}]]);
 const am=new Map([['ak',{id:'ak',title:'Known arc'}],['au',{id:'au',title:'Unknown arc'}]]);
 const pending=[{a:'unknown-event',b:'known-event',kind:'before',review:'pending'}];
 const tree=contents.buildTree(scenes,sm,em,am,null,pending);
 assert.deepEqual(Array.from(tree.map(x=>x.id)),['ak','au']);
 assert.equal(tree[1].orderPosition,Infinity);
 assert(!Number.isFinite(tree[1].start));
});
