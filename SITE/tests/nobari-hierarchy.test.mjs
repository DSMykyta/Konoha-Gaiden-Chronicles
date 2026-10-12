import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync(new URL('../public/data.json',import.meta.url),'utf8'));
const scenes=new Map(data.scenes.map(s=>[s.id,s]));
const episodes=new Map(data.episodes.map(e=>[e.id,e]));
const arcOf=id=>episodes.get(scenes.get(id).episode_id).arc_id;
test('medical mission has its own arc and preserves the original entry IDs',()=>{
 assert.notEqual(arcOf('sc-games-t9-nobari-field'),arcOf('sc-games-t9-anko-order'));
 for(const id of ['sc-games-t9-kurenai-cover','sc-games-t9-nobari-assignment','sc-games-t9-nobari-gate','sc-games-t9-nobari-outbound','sc-games-t9-nobari-field','sc-games-t9-nobari-evacuation','sc-games-t9-nobari-return','sc-games-t9-nobari-debrief'])assert.equal(arcOf(id),'arc-games-t9-nobari-medical-mission');
 const ids=new Set(data.events.map(e=>e.id));
 for(const suffix of ['anko-order','anko-assessment','kurenai-cover','nobari-assignment','nobari-field','nobari-debrief'])assert(ids.has('ev-games-t9-'+suffix+'-1'));
});
test('immediate transfer uses living Hiruzen and precedes the invasion',()=>{
 const failure=scenes.get('sc-games-t9-exam-failure');
 const transfer=scenes.get('sc-games-t9-anko-order');
 assert.equal(transfer.day,failure.day);
 assert.equal(transfer.day_part,'evening');
 assert(transfer.events[0].involvement.some(i=>i.entity_id==='c-hiruzen'&&i.mode==='physical'));
 assert(!transfer.presence.some(p=>['c-koharu','c-homura','c-tsunade'].includes(p.entity_id)));
 assert.equal(scenes.get('sc-games-t9-anko-assessment').day,transfer.day+1);
 assert.equal(scenes.get('sc-games-t9-nobari-assignment').day,transfer.day+2);
 assert(data.links.some(l=>l.a===failure.id&&l.b===transfer.id&&l.kind==='before'));
});
test('injured Team 8 is absent from the assignment and archived training is invisible',()=>{
 const cast=new Set(scenes.get('sc-games-t9-nobari-assignment').presence.map(p=>p.entity_id));
 for(const id of ['c-kurenai','c-asuma','c-nobari'])assert(cast.has(id));
 for(const id of ['c-kiba','c-hinata','c-shino','c-ino','c-shikamaru','c-choji'])assert(!cast.has(id));
 for(const sid of ['sc-games-t9-kurenai-cover','sc-games-t9-nobari-followup-training','sc-games-t9-nobari-followup-lunch']){
  const scene=scenes.get(sid);
  assert.equal(scene.state,'inactive');assert.equal(scene.day,null);
  assert(!episodes.get(scene.episode_id).scene_ids.includes(sid));
 }
});
test('parallel medical work has no fabricated serial order or sleeping witness',()=>{
 const medical=scenes.get('sc-games-t9-nobari-field');
 const streams=new Set(['ev-games-t9-nobari-kita-treatment','ev-games-t9-nobari-sora-analgesia','ev-games-t9-nobari-ren-orderly']);
 for(const link of [...medical.relations,...data.links])assert(!(streams.has(link.a)&&streams.has(link.b)&&link.kind==='before'));
 const result=data.events.find(e=>e.id==='ev-games-t9-nobari-treatment-result');
 assert(!result.physical.includes('c-kita'));
 const talk=data.events.find(e=>e.id==='ev-games-t9-nobari-raido-journal');
 assert(!talk.physical.includes('c-kita'));
});
