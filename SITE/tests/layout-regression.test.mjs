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

// Lane baseline updated for the imported capsule hierarchy weights (5.6 for
// parent grouping, 1.6 for character continuity). These fixed coordinates
// guard deterministic placement; collision separation retains its old baseline.
const expectedLanes=[
 -85,22.817760513817518,85,11.470874419860015,-41.646034242792894,-75.76648762339603,
 29.426382918197525,78.93624851701536,7.164053384477384,-40.29620188224944,-73.0975848016566,
 29.98483808042554,77.63252693777878,3.9608289861828414,-41.22142023122551,-72.84877764906325,
 32.804976200701745,78.66310941814058,2.64074030653388,-41.002723750688695,-74.45368294667325,
 43.522638308497655,81.75565714302147,-5.277994191936376
];
const expectedSeparated=[
 221.864,138.138,178.337,294.711,248.709,107.261,203.002,157,
 101.55,152.138,192.337,312.719,262.709,125.293,217.002,171,
 174.245,369.658,319.658,291.719,245.717,100.261,200.01,150
];

test('capsule hierarchy weights retain deterministic lane coordinates',()=>{
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

test('vertical geography is not artificially squeezed at year zoom',()=>{
 const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const start=app.indexOf('const originalY=baseLayoutCache.get(geometryKey)');
 const end=app.indexOf('const fine=getSemantic(',start);
 assert(start>=0&&end>start);
 const fragment=app.slice(start,end);
 assert.doesNotMatch(fragment,/spreadY|Math\\.log\\(Math\\.max\\(1,semanticZoom\\)\\)/,
  'camera zoom must not contract the vertical geography field');
 assert(fragment.includes('return baseLayoutCache.get(key).get(p.id)??mid;'));
});
