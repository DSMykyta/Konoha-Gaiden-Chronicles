import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import YAML from 'yaml';

const root = new URL('../../KONOHA_GAIDEN_ARCS_ZIGRANE_POV_V3/CHRONOLOGY/data/', import.meta.url);
const read = filename => YAML.parse(fs.readFileSync(new URL(filename, root), 'utf8'));
const scene = filename => read('scenes/' + filename + '.yaml');
const sources = read('sources.yaml');
const evidenceIds = new Set(sources.evidence.map(e => e.id));
const srtNumbers = [12,13,14,15,16];
const findEvent = (s,id) => {
  const e = s.events.find(x => x.id === id);
  assert(e, 'Missing canonical story event: ' + id);
  return e;
};

test('Naruto 12–16 subtitle sources are registered with locators', () => {
  for (const n of srtNumbers) {
    const sourceId = 'src-subtitle-naruto-' + String(n).padStart(3,'0');
    assert(sources.sources.some(x=>x.id===sourceId && x.path.endsWith('Naruto - '+String(n).padStart(3,'0')+'.srt')));
    assert(sources.evidence.some(x=>x.source_id===sourceId && /\d\d:\d\d/.test(x.locator)));
  }
  assert(sources.evidence.some(e=>e.id==='evd-sub-shippuden-265-waves-retro'));
});

test('Naruto remains at Tazuna home before arriving at the bridge', () => {
  const dep = scene('sc-y0-0329-group-leaves-with-tazuna');
  const leave = findEvent(dep,'ev-y0-0329-group-leaves-naruto-resting');
  assert(leave.involvement.some(x=>x.entity_id==='c-naruto' && x.mode==='remote'));
  assert(!leave.involvement.some(x=>x.entity_id==='c-naruto' && x.mode==='physical'));
  assert(leave.evidence_ids.includes('evd-sub-ep12-bridge-depart'));
  const home = scene('sc-y0-0330-tazuna-home-attack');
  const rescue = findEvent(home,'ev-y0-0330-naruto-rescues-inari-tsunami');
  assert(rescue.involvement.some(x=>x.entity_id==='c-naruto' && x.mode==='physical'));
  assert(rescue.evidence_ids.includes('evd-sub-ep13-home-rescue'));
  assert(rescue.text.includes('кабана'));
  const bridge = scene('sc-y0-0330-bridge-final-battle');
  const arrives = findEvent(bridge,'ev-y0-0330-naruto-arrives-with-shuriken');
  assert(arrives.evidence_ids.includes('evd-sub-ep13-bridge-ice'));
  for(const s of [dep,home,bridge]) assert.equal(s.placement.anchor_id, 'ta-y0-0330');
});

test('battle scenes preserve the existing major moments and correct before-relation for Kakashi injury', () => {
  const bridge = scene('sc-y0-0330-bridge-final-battle');
  const mist = findEvent(bridge,'ev-y0-0330-zabuza-mist-negates-sharingan');
  const cut = findEvent(bridge,'ev-y0-0330-kakashi-cut-protecting-tazuna');
  const awakening = findEvent(bridge,'ev-y0-0330-sasuke-awakens-sharingan');
  const save = findEvent(bridge,'ev-y0-0330-sasuke-protects-naruto');
  const chakra = findEvent(bridge,'ev-y0-0330-naruto-nine-tails-chakra');
  assert(mist.display_rank < cut.display_rank);
  assert(cut.display_rank < awakening.display_rank);
  assert(awakening.display_rank < save.display_rank);
  assert(save.display_rank < chakra.display_rank);
  assert(mist.evidence_ids.includes('evd-sub-ep15-mist-counter'));
  assert(cut.evidence_ids.includes('evd-sub-ep15-mist-counter'));
  assert(cut.evidence_ids.includes('evd-sub-ep16-kakashi-wound'));
  assert(save.evidence_ids.includes('evd-sub-ep16-sharingan-sacrifice'));
  assert(chakra.evidence_ids.includes('evd-sub-ep16-sharingan-sacrifice'));
  const rel = bridge.relations.find(x=>x.id==='rel-sub-15-kakashi-cut-before-16-sasuke-protects');
  assert(rel && rel.kind === 'before' && rel.a===cut.id && rel.b===save.id && rel.review === 'accepted');
  assert(!bridge.relations.some(x=>x.kind==='before' && x.a===save.id && x.b===cut.id && x.review==='accepted'));
  assert.equal(bridge.location_id,'loc-great-naruto-bridge');
  assert.equal(bridge.placement.anchor_id,'ta-y0-0330');
});

test('episode-14 recap is not mistaken for a new fight', () => {
  const bridge = scene('sc-y0-0330-bridge-final-battle');
  const ids=bridge.events.map(x=>x.id);
  assert.equal(ids.length,new Set(ids).size, 'Duplicate plot-event IDs');
  assert(findEvent(bridge,'ev-y0-0330-naruto-enters-ice-mirrors').evidence_ids.includes('evd-sub-ep14-mirror-battle'));
  assert(findEvent(bridge,'ev-y0-0330-haku-traps-sasuke-in-mirrors').evidence_ids.includes('evd-sub-ep13-bridge-ice'));
  const encounter = scene('sc-y0-0328-naruto-meets-haku');
  assert(findEvent(encounter,'ev-y0-0328-haku-strength-for-precious-person').evidence_ids.includes('evd-sub-ep12-haku-forest'));
  assert(!encounter.events.some(x=>x.id==='ev-y0-0330-haku-traps-sasuke-in-mirrors'));
});

test('all newly referenced subtitle evidence has a source in the registry', () => {
  const changed = [
    'sc-waves-home-morning-concern','sc-y0-0328-naruto-meets-haku',
    'sc-y0-0329-tree-training-complete','sc-waves-inari-naruto-dinner',
    'sc-waves-kakashi-comforts-inari','sc-y0-0329-group-leaves-with-tazuna',
    'sc-y0-0330-tazuna-home-attack','sc-y0-0330-bridge-final-battle'
  ];
  for(const name of changed) {
    for(const event of scene(name).events) {
      for(const id of event.evidence_ids ?? []) assert(evidenceIds.has(id), name+' missing '+id);
    }
  }
});
