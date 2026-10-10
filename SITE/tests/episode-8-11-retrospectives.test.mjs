import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import YAML from 'yaml';

const root = new URL('../../KONOHA_GAIDEN_ARCS_ZIGRANE_POV_V3/CHRONOLOGY/data/', import.meta.url);
const read = relative => YAML.parse(fs.readFileSync(new URL(relative, root), 'utf8'));
const scene = name => read('scenes/' + name + '.yaml');
const episodes = read('episodes.yaml').episodes;
const links = read('links.yaml').links;
const sourceData = read('sources.yaml');
const evidenceIds = new Set(sourceData.evidence.map(x => x.id));
const entities = new Set(read('entities.yaml').entities.map(x => x.id));

const flashbacks = [
  scene('sc-prewaves-zabuza-kiri-graduation'),
  scene('sc-prewaves-kaiza-rescues-inari'),
  scene('sc-prewaves-kaiza-saves-village-flood'),
  scene('sc-prewaves-kaiza-execution')
];

test('episode 8 and 11 historical actions are real scenes, not new dates on the original battle', () => {
  assert.equal(flashbacks.length, 4);
  for (const item of flashbacks) {
    assert.equal(item.placement, null, item.id);
    assert.equal(item.review.time, 'unknown', item.id);
    assert.equal(item.events.length, 1, 'A dramatic event must not be split into gestures');
    assert(item.location_id);
    assert(episodes.some(e => e.id === item.episode_id && e.arc_id === 'arc-y0-land-of-waves'));
    const e = item.events[0];
    assert.equal(e.origin, 'A');
    for (const ref of e.evidence_ids) assert(evidenceIds.has(ref), 'Unregistered evidence: ' + ref);
    for (const person of e.involvement) assert(entities.has(person.entity_id), 'Unregistered participant: ' + person.entity_id);
    assert(!e.involvement.some(person => person.entity_id === 'c-tazuna' && person.mode === 'physical'));
  }
  const zab = flashbacks[0];
  assert.equal(zab.location_id, 'loc-kirigakure');
  assert(zab.events[0].text.includes('понад сотню'));
  assert(flashbacks[1].events[0].involvement.some(x => x.entity_id === 'c-pochi' && x.mode === 'physical'));
  assert(flashbacks[3].events[0].involvement.some(x => x.entity_id === 'c-inari' && x.mode === 'physical'));
});

test('historical memories are ordered by reliable before-relations only', () => {
  const ids = new Set(links.filter(x => x.kind === 'before' && x.review === 'accepted').map(x => x.a + ' -> ' + x.b));
  const pairs = [
    ['ev-prewaves-kaiza-saves-inari','ev-prewaves-kaiza-stops-flood'],
    ['ev-prewaves-kaiza-stops-flood','ev-prewaves-gato-executes-kaiza'],
    ['ev-prewaves-gato-executes-kaiza','ev-y0-0322-tazuna-tells-kaiza-story'],
    ['ev-prewaves-zabuza-kiri-graduation','ev-y0-0318-zabuza-attacks']
  ];
  for (const [a,b] of pairs) assert(ids.has(a + ' -> ' + b), 'Missing order: ' + a + ' / ' + b);
});

test('episodes 8-11 retain existing present-day action without duplicates', () => {
  const battle = scene('sc-y0-0318-zabuza-first-battle');
  const events = battle.events;
  assert(events.some(e => e.id === 'ev-y0-0318-naruto-reclaims-headband'));
  assert(events.some(e => e.id === 'ev-y0-0318-naruto-sasuke-free-kakashi'));
  assert(events.find(e=>e.id==='ev-y0-0318-naruto-reclaims-headband').evidence_ids.includes('evd-sub-ep8-teamwork'));
  assert(events.find(e=>e.id==='ev-y0-0318-kakashi-defeats-zabuza').evidence_ids.includes('evd-sub-ep9-zabuza-rescue'));
  const hospital=scene('sc-y0-0322-tazuna-home-briefing');
  assert(hospital.events[0].evidence_ids.includes('evd-sub-ep10-haku-recovery'));
  const market=scene('sc-waves-sakura-market');
  assert.equal(market.location_id,'loc-land-waves');
  assert.equal(market.review.location,'partial');
  const dinner=scene('sc-y0-0322-kaiza-dinner');
  assert(dinner.events.some(x=>x.id==='ev-y0-0322-tazuna-tells-kaiza-story'));
  assert(dinner.events.find(x=>x.id==='ev-y0-0322-tazuna-tells-kaiza-story').evidence_ids.includes('evd-sub-ep11-kaiza-past'));
});
