import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import YAML from 'yaml';

const base=new URL('../../KONOHA_GAIDEN_ARCS_ZIGRANE_POV_V3/CHRONOLOGY/data/',import.meta.url);
const read=path=>YAML.parse(fs.readFileSync(new URL(path,base),'utf8'));
const scenes=[
 'sc-y0-0122-team7-rooftop.yaml',
 'sc-y0-0123-team7-bell-test.yaml',
 'sc-prewaves-tora-capture.yaml',
 'sc-y0-0315-team7-departs-konoha.yaml',
 'sc-y0-0316-demon-brothers.yaml',
 'sc-y0-0317-wave-crossing.yaml',
 'sc-y0-0317-arrival-waves.yaml',
 'sc-y0-0318-zabuza-first-battle.yaml'
].map(name=>read('scenes/'+name));
const allEvents=scenes.flatMap(s=>s.events);
const getEvent=id=>{
 const event=allEvents.find(e=>e.id===id);
 assert(event,'Missing event: '+id);
 return event;
};
const evidence=read('sources.yaml').evidence;
const evidenceIds=new Set(evidence.map(e=>e.id));

test('episodes 4–5 remain meaningful existing moments; no duplicated bell test',()=>{
 const exam=scenes.find(s=>s.id==='sc-y0-0123-team7-bell-test');
 assert.equal(exam.events.length,13);
 assert(getEvent('ev-y0-0123-kakashi-forbids-feeding-naruto').text.includes('найближчі друзі'));
 for(const id of ['ev-y0-0123-team7-shares-food','ev-y0-0123-kakashi-passes-team7'])
  assert(getEvent(id).evidence_ids.includes('evd-sub-ep5-teamwork'));
});

test('episodes 6–7 retain location and character source coverage',()=>{
 assert(getEvent('ev-prewaves-tora-capture').text.includes('правому вусі'));
 assert(getEvent('ev-prewaves-tora-capture').evidence_ids.includes('evd-sub-ep6-tora'));
 assert(getEvent('ev-y0-0315-team7-departs-with-tazuna').evidence_ids.includes('evd-sub-ep6-team7-departs'));
 const wave=getEvent('ev-y0-0317-tazuna-explains-gato-control');
 assert(wave.text.includes('монополію'));
 assert(wave.evidence_ids.includes('evd-sub-ep7-crossing-gato'));
 const zabuza=getEvent('ev-y0-0318-zabuza-attacks');
 assert(zabuza.text.includes('кролика'));
 assert(zabuza.evidence_ids.includes('evd-sub-ep7-rabbit-zabuza'));
 for(const e of [...allEvents])for(const id of e.evidence_ids||[])
  assert(evidenceIds.has(id),'Unknown evidence '+id+' in '+e.id);
});

test('unverified Land of Waves transition dates and Tora date are not silently changed',()=>{
 const arrival=scenes.find(s=>s.id==='sc-y0-0317-arrival-waves');
 const attack=scenes.find(s=>s.id==='sc-y0-0318-zabuza-first-battle');
 const tora=scenes.find(s=>s.id==='sc-prewaves-tora-capture');
 assert.equal(arrival.placement.anchor_id,'ta-y0-0317');
 assert.equal(attack.placement.anchor_id,'ta-y0-0318');
 assert.equal(tora.placement,null);
 assert.equal(tora.review.time,'unknown');
 const audit=fs.readFileSync(new URL('../../KONOHA_GAIDEN_ARCS_ZIGRANE_POV_V3/CHRONOLOGY/SERIES_SOURCE_SYNC_PROGRESS_UA.md',import.meta.url),'utf8');
 assert(audit.includes('календарна невідповідність'));
 assert(audit.includes('ta-y0-0317'));
 assert(audit.includes('ta-y0-0318'));
});
