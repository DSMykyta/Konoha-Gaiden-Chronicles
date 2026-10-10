import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../public/timeline-flow.js',import.meta.url),'utf8');
const flow=vm.runInNewContext(source+';TimelineFlow');
const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');

test('all three semantic boundaries interpolate with no position jump',()=>{
 for(const boundary of flow.boundaries){
  const hi=boundary.pivot*Math.exp(.36),lo=boundary.pivot*Math.exp(-.36);
  assert(flow.state(hi+1e-5).t===0);
  assert(flow.state(lo).t>0.999999);
  let last=0;
  for(let i=0;i<=24;i++){
   const z=Math.exp(Math.log(hi)+(Math.log(lo)-Math.log(hi))*i/24);
   const state=flow.state(z);
   assert.equal(state.fine,boundary.fine);
   assert.equal(state.coarse,boundary.coarse);
   assert(state.t>=last,'compression must always progress while zooming out');
   last=state.t;
  }
  assert(Math.abs(flow.lerp(12,81,last)-81)<1e-6);
 }
});

test('arc pairs touch before merging and never collide across remote lanes',()=>{
 const nodes=(d)=>[{id:'arc-a',kind:'arc',day:21,x:0,y:150},
  {id:'arc-b',kind:'arc',day:21.1,x:d,y:150}];
 assert.equal(flow.clusterArcs(nodes(200)).length,0);
 assert.equal(flow.clusterArcs(nodes(76)).length,0);
 const barely=flow.clusterArcs(nodes(75.99))[0];
 assert(barely&&barely.strength<.0001,'first contact must not jump');
 const near=flow.clusterArcs(nodes(38))[0];
 assert(near.strength>barely.strength&&near.strength<1);
 assert(flow.clusterArcs(nodes(20))[0].strength===1);
 assert.equal(flow.clusterArcs([{id:'a',kind:'arc',x:0,y:0,day:1},
  {id:'b',kind:'arc',x:0,y:210,day:1}]).length,0);
});

test('cursor-anchored scaling keeps the same time beneath the pointer',()=>{
 for(const x of [60,200,500,850,940]){
  const pad=48,width=1000,total=365,nextZoom=40,pivot=176.41;
  const center=flow.zoomCenter({pivot,position:x,width,pad,total,nextZoom});
  const left=center-total/(2*nextZoom),right=center+total/(2*nextZoom);
  const actual=left+(x-pad)/(width-2*pad)*(right-left);
  assert(Math.abs(actual-pivot)<1e-8);
 }
});

test('mouse wheel zoom, keyboard pan and live pinch use the same camera',()=>{
 assert.match(app,/const factor=Math\.exp\(-clamp\(delta,-500,500\)\*\.0018\)/);
 assert.match(app,/if\(e\.shiftKey&&!e\.ctrlKey&&!e\.metaKey\)/);
 assert.match(app,/zoomAtScreen\(zoom\*factor,x\)/);
 assert.match(app,/pinch\.startZoom\*distance\/pinch\.distance/);
 assert.match(app,/TimelineFlow\.zoomCenter\(/);
 assert.match(app,/drag\.center-dx/);
 assert.match(app,/\{passive:false\}/);
});
