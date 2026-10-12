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
test('supporting teams stay at assignment and followup stays after the mission',()=>{
 const assignment=scenes.get('sc-games-t9-nobari-assignment');
 const cast=new Set(assignment.presence.map(p=>p.entity_id));
 for(const id of ['c-kiba','c-hinata','c-shino','c-ino','c-shikamaru','c-choji'])assert(cast.has(id));
 for(const sid of ['sc-games-t9-nobari-outbound','sc-games-t9-nobari-field','sc-games-t9-nobari-return'])for(const p of scenes.get(sid).presence)assert(!['c-kiba','c-hinata','c-shino','c-ino','c-shikamaru','c-choji'].includes(p.entity_id));
 assert(scenes.get('sc-games-t9-nobari-followup-training').day>scenes.get('sc-games-t9-nobari-debrief').day);
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
