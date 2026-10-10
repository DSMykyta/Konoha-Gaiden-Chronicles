import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const core=vm.runInNewContext(fs.readFileSync(new URL('../public/timeline-core.js',import.meta.url),'utf8')+';TimelineCore');

const nodes=Array.from({length:24},(_,i)=>({
 id:'item-'+i,x:70+(i%8)*3+Math.floor(i/8)*220,y:150+(i%5)*7,
 day:11+Math.floor(i/8)*3+(i%8)*.15,kind:i%6===0?'arc':'scene',
 layoutCast:['hero-'+(i%4)],layoutGroup:'arc-'+(i%5)
})).reverse();

// Baseline coordinates recorded before the distant-pair optimization.
// These are not visual preferences to retune; they guard against accidental
// changes in the same story's lanes, chronology or hit-target separation.
const expectedLanes=[
 -85,-16.8096812,76.68241161,50.01632333,-36.41981798,-73.92936046,
 -0.87975162,73.07462645,37.99845789,-33.18282176,-69.92864378,
 -0.49257149,71.82198717,33.88747271,-34.5428844,-70.27552056,
 1.83989129,74.62158273,34.92808325,-34.07406345,-74.90394958,
 17.8894013,85,24.56638961
];
const expectedSeparated=[
 221.864,138.138,178.337,294.711,248.709,107.261,203.002,157,
 101.55,152.138,192.337,312.719,262.709,125.293,217.002,171,
 174.245,369.658,319.658,291.719,245.717,100.261,200.01,150
];

test('distant-pair pruning preserves every prior lane coordinate',()=>{
 const lanes=core.sceneLayout(nodes);
 nodes.forEach((node,i)=>assert(Math.abs(lanes.get(node.id)-expectedLanes[i])<1e-7,'changed lane for '+node.id));
});

test('sliding overlap window preserves old placement and never changes story time',()=>{
 const original=nodes.map(node=>({...node}));
 const separated=core.separateNodes(nodes,100,320);
 separated.forEach((node,i)=>{
  assert(Math.abs(node.y-expectedSeparated[i])<.00051,'changed placement for '+node.id);
  assert.equal(node.x,original[i].x);
  assert.equal(node.day,original[i].day);
 });
 assert.deepEqual(nodes,original,'the original nodes must remain untouched');
});

test('chronologically distant scene marks require no displacement',()=>{
 const spaced=Array.from({length:1500},(_,i)=>({id:'far-'+i,x:i*80,y:120,day:i*.5,kind:'scene'}));
 const result=core.separateNodes(spaced,80,280);
 result.forEach((node,i)=>{
  assert.equal(node.y,120);
  assert.equal(node.x,spaced[i].x);
 });
});
