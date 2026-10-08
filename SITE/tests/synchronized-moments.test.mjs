import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const core=vm.runInNewContext(
 fs.readFileSync(new URL('../public/timeline-core.js',import.meta.url),'utf8')+';TimelineCore'
);
const moment=(id,scene_id,display_rank,day=21)=>({id,scene_id,display_rank,day});
const relation=(kind,a,b)=>({kind,a,b,review:'accepted'});

test('Academy: Kita observing Asuma, Kurenai and Raido aligns two independent nodes',()=>{
 const events=[
  moment('iruka','class',50),moment('kita-observes','class',100),
  moment('team-9','class',400),moment('three-jonin','outside',100)
 ];
 const relations=[
  relation('before','iruka','kita-observes'),
  relation('before','kita-observes','team-9'),
  relation('observes','kita-observes','outside')
 ];
 const scenes=core.scenes(events,relations,[
  {id:'class',display_rank:200},{id:'outside',display_rank:100}
 ]);
 const positions=core.momentPositions(scenes,relations);
 assert(positions.get('iruka')<positions.get('kita-observes'));
 assert.equal(positions.get('kita-observes'),positions.get('three-jonin'));
 assert(positions.get('kita-observes')<positions.get('team-9'));
 assert.notEqual(scenes.find(s=>s.id==='class'),scenes.find(s=>s.id==='outside'));
});

test('Land of Waves: rescuing Inari fits between attack and Naruto joining the bridge fight',()=>{
 const events=[
  moment('bridge-attack','bridge',100),moment('bridge-mirrors','bridge',200),
  moment('naruto-arrives','bridge',300),moment('inari-threatened','home',100),
  moment('naruto-rescues','home',200)
 ];
 const relations=[
  relation('before','bridge-attack','naruto-rescues'),
  relation('before','inari-threatened','naruto-rescues'),
  relation('before','naruto-rescues','naruto-arrives')
 ];
 const scenes=core.scenes(events,relations,[
  {id:'home',display_rank:100},{id:'bridge',display_rank:200}
 ]);
 const positions=core.momentPositions(scenes,relations);
 assert(positions.get('bridge-attack')<positions.get('naruto-rescues'));
 assert(positions.get('inari-threatened')<positions.get('naruto-rescues'));
 assert(positions.get('naruto-rescues')<positions.get('naruto-arrives'));
});

test('Scroll of Seals: related scenes in different places obey global before links',()=>{
 const events=[
  moment('failed-exam','exam',100),moment('mizuki-lures','forest',100),
  moment('scroll-stolen','hokage-office',100),moment('search-starts','search',100),
  moment('iruka-finds-naruto','confrontation',100)
 ];
 const links=[
  relation('before','exam','forest'),
  relation('before','forest','hokage-office'),
  relation('before','hokage-office','search'),
  relation('before','search','confrontation')
 ];
 const scenes=core.scenes(events,links),positions=core.momentPositions(scenes,links);
 const ids=events.map(e=>e.id);
 assert(ids.every((id,i)=>i===0||positions.get(ids[i-1])<positions.get(id)));
});

test('accepted source relation outranks a reversed display_rank even within one scene',()=>{
 const events=[moment('rank-100','same',100),moment('rank-200','same',200)];
 const links=[relation('before','rank-200','rank-100')];
 const scenes=core.scenes(events,links),positions=core.momentPositions(scenes,links);
 assert(positions.get('rank-200')<positions.get('rank-100'));
});

test('sharing a date or rank cannot establish simultaneity',()=>{
 const events=[moment('one','a',100),moment('two','b',100)];
 const scenes=core.scenes(events),positions=core.momentPositions(scenes);
 assert.notEqual(positions.get('one'),positions.get('two'));
});

test('explicit same_span aligns two different moments without merging IDs',()=>{
 const events=[moment('a','same',100),moment('b','same',200)];
 const links=[relation('same_span','a','b')];
 const scenes=core.scenes(events,links),positions=core.momentPositions(scenes,links);
 assert.equal(positions.get('a'),positions.get('b'));
 assert.equal(scenes[0].group.length,2);
});

test('original Academy, Scroll and Waves source links render with verified relative order',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('../public/data.json',import.meta.url),'utf8'));
 const relations=[...data.links,...data.scenes.flatMap(s=>s.relations||[])];
 const scenes=core.scenes(data.events.filter(event=>event.day!==null),relations,data.scenes);
 const positions=core.momentPositions(scenes,relations);
 const get=id=>{assert(positions.has(id),'Missing chronological moment '+id);return positions.get(id);};
 assert.equal(get('ev-y0-0122-kita-sees-jonin'),get('ev-y0-0122-three-jonin-wait-outside'));
 for(const [first,second] of [
  ['ev-y0-0122-kita-sees-jonin','ev-y0-0122-team9-announced'],
  ['ev-y0-0119-naruto-steals-scroll','ev-y0-0119-iruka-finds-naruto'],
  ['ev-y0-0330-zabuza-haku-attack-bridge','ev-y0-0330-naruto-rescues-inari-tsunami'],
  ['ev-y0-0330-naruto-rescues-inari-tsunami','ev-y0-0330-naruto-arrives-with-shuriken'],
  ['ev-y0-0330-inari-asks-villagers','ev-y0-0330-inari-finds-supporters'],
  ['ev-y0-0330-inari-finds-supporters','ev-y0-0330-villagers-drive-off-mercenaries']
 ])assert(get(first)<get(second),first+' must precede '+second);
});
