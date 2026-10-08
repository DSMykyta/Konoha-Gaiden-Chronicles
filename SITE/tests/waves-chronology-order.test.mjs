import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const core=vm.runInNewContext(fs.readFileSync(new URL('../public/timeline-core.js',import.meta.url),'utf8')+';TimelineCore');

test('the home-rescue branch fits between two bridge moments',()=>{
 const events=[{id:'bridge-start',scene_id:'bridge',day:10,display_rank:100},{id:'bridge-finish',scene_id:'bridge',day:10,display_rank:900},{id:'rescue',scene_id:'home',day:10,display_rank:100}];
 const rels=[{kind:'before',review:'accepted',a:'rescue',b:'bridge-finish'},{kind:'before',review:'accepted',a:'bridge-start',b:'rescue'}];
 const scenes=core.scenes(events,rels,[{id:'bridge',display_rank:100},{id:'home',display_rank:200}]);
 const pos=core.momentPositions(scenes,rels);
 assert(pos.get('bridge-start')<pos.get('rescue'));
 assert(pos.get('rescue')<pos.get('bridge-finish'));
});

test('a whole-scene relation still orders distinct scenes',()=>{
 const events=[{id:'a1',scene_id:'a',day:10,display_rank:100},{id:'b1',scene_id:'b',day:10,display_rank:100}];
 const rel=[{kind:'before',review:'accepted',a:'a',b:'b'}];
 const scenes=core.scenes(events,rel),pos=core.momentPositions(scenes,rel);
 assert(pos.get('a1')<pos.get('b1'));
});

test('actual Waves chronology respects interwoven accepted dependencies',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('../public/data.json',import.meta.url),'utf8'));
 const relations=[...data.links,...data.scenes.flatMap(s=>s.relations||[])];
 const scenes=core.scenes(data.events.filter(e=>e.day!==null),relations,data.scenes),pos=core.momentPositions(scenes,relations);
 for(const [a,b] of [
  ['ev-y0-0330-naruto-rescues-inari-tsunami','ev-y0-0330-naruto-arrives-with-shuriken'],
  ['ev-y0-0330-inari-asks-villagers','ev-y0-0330-inari-finds-supporters'],
  ['ev-y0-0330-inari-finds-supporters','ev-y0-0330-villagers-drive-off-mercenaries'],
  ['ev-y0-0330-haku-sacrifices-self','ev-y0-0330-gato-arrives']
 ]){
  assert(pos.has(a)&&pos.has(b),a+' or '+b+' absent');
  assert(pos.get(a)<pos.get(b),a+' must precede '+b);
 }
});
