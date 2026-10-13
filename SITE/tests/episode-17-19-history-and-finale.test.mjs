import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import YAML from 'yaml';

const root = new URL('../../00_MAIN_WORK_FOLDER/CHRONOLOGY/data/', import.meta.url);
const read = path => YAML.parse(fs.readFileSync(new URL(path, root), 'utf8'));
const scene = name => read('scenes/' + name + '.yaml');
const sources = read('sources.yaml');
const entities = new Set(read('entities.yaml').entities.map(e=>e.id));
const episodes = new Set(read('episodes.yaml').episodes.map(e=>e.id));
const links = read('links.yaml').links;
const evidences = new Set(sources.evidence.map(e=>e.id));
const event = (sc,id) => {
  const ev=sc.events.find(e=>e.id===id);
  assert(ev, 'Missing canonical event '+id);
  return ev;
};

test('Naruto 17–19 primary subtitle sources and Shippuden 265 contrast are registered',()=>{
  for(const n of [17,18,19]){
    const id='src-subtitle-naruto-'+String(n).padStart(3,'0');
    assert(sources.sources.some(s=>s.id===id && s.path.endsWith('Naruto - '+String(n).padStart(3,'0')+'.srt')));
    assert(sources.evidence.some(e=>e.source_id===id && /\d\d:\d\d/.test(e.locator)));
  }
  assert(evidences.has('evd-sub-shippuden-265-waves-retro'));
});

test('Haku childhood, recruitment and Zabuza coup are separate undated physical historical moments',()=>{
  const items=[
    ['sc-prewaves-haku-bloodline-tragedy','ev-prewaves-haku-loses-family','loc-land-water'],
    ['sc-prewaves-zabuza-finds-haku','ev-prewaves-zabuza-recruits-haku','loc-land-water'],
    ['sc-prewaves-zabuza-failed-coup','ev-prewaves-zabuza-failed-mizukage-coup','loc-kirigakure']
  ];
  for(const [file,id,loc] of items){
    const s=scene(file);
    assert.equal(s.placement,null,file+' must not be given an invented calendar date');
    assert.equal(s.review.time,'unknown');
    assert.equal(s.location_id,loc);
    assert(episodes.has(s.episode_id));
    assert.equal(s.events.length,1,'Do not split one major action into micro-actions');
    const e=event(s,id);
    assert.equal(e.origin,'A');
    assert(e.evidence_ids.length);
    for(const source of e.evidence_ids)assert(evidences.has(source),source);
    for(const p of e.involvement)assert(entities.has(p.entity_id),p.entity_id);
    assert(!e.involvement.some(p=>p.entity_id==='c-kakashi' && p.mode==='physical'),'Kakashi narrates history, he was not at its scene');
  }
  const family=scene('sc-prewaves-haku-bloodline-tragedy');
  assert(event(family,'ev-prewaves-haku-loses-family').involvement.some(p=>p.entity_id==='c-haku-father'&&p.mode==='physical'));
  assert(event(family,'ev-prewaves-haku-loses-family').involvement.some(p=>p.entity_id==='c-haku-mother'&&p.mode==='physical'));
});

test('historical causality is linked without invented coup vs Haku recruitment ordering',()=>{
  const ordered = new Set(links.filter(l=>l.kind==='before' && l.review==='accepted').map(l=>l.a+'>'+l.b));
  for(const [a,b] of [
    ['ev-prewaves-haku-loses-family','ev-prewaves-zabuza-recruits-haku'],
    ['ev-prewaves-zabuza-recruits-haku','ev-y0-0328-naruto-meets-haku-herbs'],
    ['ev-prewaves-zabuza-kiri-graduation','ev-prewaves-zabuza-failed-mizukage-coup'],
    ['ev-prewaves-zabuza-failed-mizukage-coup','ev-prewaves-gato-demands-zabuza'],
    ['ev-y0-0330-inari-asks-villagers','ev-y0-0330-villagers-drive-off-mercenaries']
  ])assert(ordered.has(a+'>'+b),a+' before '+b);
  assert(!ordered.has('ev-prewaves-zabuza-recruits-haku>ev-prewaves-zabuza-failed-mizukage-coup'));
  assert(!ordered.has('ev-prewaves-zabuza-failed-mizukage-coup>ev-prewaves-zabuza-recruits-haku'));
});

test('Naruto 19 ORIGINAL: villagers repel mercenaries before Kakashi carries Zabuza to Haku',()=>{
  const battle=scene('sc-y0-0330-bridge-final-battle');
  const crowd=event(battle,'ev-y0-0330-villagers-drive-off-mercenaries');
  const dying=event(battle,'ev-y0-0330-zabuza-dies-by-haku');
  assert(crowd.display_rank<dying.display_rank);
  assert(crowd.evidence_ids.includes('evd-sub-ep19-villagers-and-last-wish'));
  assert(dying.evidence_ids.includes('evd-sub-ep19-villagers-and-last-wish'));
  assert(dying.text.includes('Какаші'));
  assert(dying.text.includes('перенести'));
  assert(dying.involvement.some(x=>x.entity_id==='c-kakashi'&&x.mode==='physical'));
  assert(!dying.evidence_ids.includes('evd-sub-shippuden-265-waves-retro'),'Later retelling must not overwrite the original');
  assert(battle.relations.some(x=>x.id==='rel-sub-19-villagers-before-zabuza-last-wish'&&x.kind==='before'&&x.a===crowd.id&&x.b===dying.id&&x.review==='accepted'));
  assert(!battle.relations.some(x=>x.kind==='before'&&x.a===dying.id&&x.b===crowd.id),'Obsolete reversed order');
  assert.equal(battle.placement.anchor_id,'ta-y0-0330');
  assert.equal(battle.location_id,'loc-great-naruto-bridge');
});

test('bridge account is distinct from physical Haku childhood and no duplicate major moments',()=>{
  const battle=scene('sc-y0-0330-bridge-final-battle');
  const ids=battle.events.map(e=>e.id);
  assert.equal(ids.length,new Set(ids).size);
  const memory=event(battle,'ev-y0-0330-haku-explains-past');
  assert(memory.involvement.some(p=>p.entity_id==='c-haku'&&p.mode==='physical'));
  assert(memory.involvement.some(p=>p.entity_id==='c-naruto'&&p.mode==='physical'));
  assert(!memory.involvement.some(p=>['c-haku-father','c-haku-mother'].includes(p.entity_id)&&p.mode==='physical'));
  assert(memory.evidence_ids.includes('evd-sub-ep17-haku-childhood'));
  assert(event(battle,'ev-y0-0330-kakashi-summons-tracking-ninken').evidence_ids.includes('evd-sub-ep17-coup-dogs'));
});

test('farewell, burial and legacy working timeline preserved with original sources',()=>{
  const burial=scene('sc-y0-0330-zabuza-haku-burial');
  assert.equal(burial.placement.anchor_id,'ta-y0-0330');
  assert(event(burial,'ev-y0-0330-zabuza-haku-buried').evidence_ids.includes('evd-sub-ep19-burial-farewell'));
  const bridge=scene('sc-y0-0413-bridge-complete');
  assert.equal(bridge.placement.anchor_id,'ta-y0-0413');
  assert(event(bridge,'ev-y0-0413-team7-says-farewell').evidence_ids.includes('evd-sub-ep19-burial-farewell'));
  assert(event(bridge,'ev-y0-0413-bridge-named-after-naruto').evidence_ids.includes('evd-sub-ep19-burial-farewell'));
});
