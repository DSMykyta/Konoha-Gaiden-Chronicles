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
