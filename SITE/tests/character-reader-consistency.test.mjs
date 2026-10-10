import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const core=vm.runInNewContext(fs.readFileSync(new URL('../public/timeline-core.js',import.meta.url),'utf8')+';TimelineCore');
const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');

test('anchor index exactly matches per-character scan, including duplicate cast IDs',()=>{
 const nodes=Array.from({length:120},(_,i)=>({
  id:'node-'+i,cast:i%6===0?['a','a','c']:i%4===0?['b','c']:['a','b']
 }));
 const ids=['a','b','c','missing'];
 const indexed=core.characterAnchors(nodes,ids);
 for(const id of ids){
  const expected=nodes.filter(node=>node.cast.includes(id)).map(node=>node.id);
  assert.deepEqual(Array.from(indexed.get(id),node=>node.id),expected);
 }
});

test('character event reader includes undated records and matches profile counter',()=>{
 const begin=app.indexOf('function characterTimelineEvents(id){');
 const end=app.indexOf('function openCharacterEvents(',begin);
 assert(begin>=0&&end>begin,'Character event reader helper must be present');
 assert(app.includes('associated=characterTimelineEvents(profileEntity)'),'profile counter and reader must use the same event list');
 const dated={id:'dated',day:22,tracks:['hero']};
 const undated={id:'undated',day:null,tracks:['hero']};
 const unrelated={id:'unrelated',day:23,tracks:['other']};
 const context={
  chronologicalMoments:()=>[dated,unrelated],
  events:()=>[dated,undated,unrelated],
  TimelineCore:core
 };
 const get=vm.runInNewContext(app.slice(begin,end)+';characterTimelineEvents',context);
 assert.deepEqual(Array.from(get('hero'),event=>event.id),['dated','undated']);
 assert.deepEqual(Array.from(get('other'),event=>event.id),['unrelated']);
 assert.deepEqual(Array.from(get('absent'),event=>event.id),[]);
});
