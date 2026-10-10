import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import YAML from 'yaml';

const base = new URL('../../KONOHA_GAIDEN_ARCS_ZIGRANE_POV_V3/CHRONOLOGY/data/', import.meta.url);
const read = relative => YAML.parse(fs.readFileSync(new URL(relative, base), 'utf8'));
const scene = read('scenes/sc-y0-0122-kakashi-checks-naruto-milk.yaml');
const imported = read('scenes/sc-y0-0122-kakashi-preparation-retro.yaml');
const episode = read('episodes.yaml').episodes.find(e => e.id === 'ep-y0-kakashi-inspects-naruto-home');
const sources = read('sources.yaml');
const links = read('links.yaml').links;

test('original Naruto 003 has its own dated-to-working-day canonical apartment scene', () => {
 assert(episode, 'Missing episode for the previously omitted original scene');
 assert.equal(episode.arc_id, 'arc-y0-genin-formation');
 assert.equal(scene.episode_id, episode.id);
 assert.equal(scene.location_id, 'loc-naruto-apartment');
 assert.equal(scene.placement.anchor_id, 'ta-team-formation');
 assert.equal(scene.review.time, 'partial', 'No unverified precise time');
 assert.equal(scene.events.length, 1, 'A coherent episode, not micro-events');
 const event = scene.events[0];
 assert.equal(event.origin, 'A');
 assert(event.involvement.some(x => x.entity_id === 'c-kakashi' && x.mode === 'physical'));
 assert(event.involvement.some(x => x.entity_id === 'c-hiruzen' && x.mode === 'physical'));
 assert(event.involvement.some(x => x.entity_id === 'c-naruto' && x.mode === 'remote'));
 assert(event.evidence_ids.includes('evd-sub-ep3-kakashi-milk'));
 assert(event.evidence_ids.includes('evd-narutopedia-ep3-kakashi-milk'));
 const ids = new Set(sources.evidence.map(e => e.id));
 for (const id of event.evidence_ids) assert(ids.has(id), 'Missing evidence: ' + id);
});

test('retrospective drafts stay separated from the original canonical version', () => {
 assert.equal(imported.layer, 'project');
 assert.equal(imported.state, 'draft');
 assert.equal(imported.review.text, 'imported');
 assert.equal(scene.events[0].origin, 'A');
 assert(!scene.events[0].evidence_ids.includes('evd-v10-22jan-retro'));
 assert(links.some(x =>
  x.kind === 'before' &&
  x.review === 'accepted' &&
  x.a === 'ev-y0-0122-kakashi-discovers-spoiled-milk' &&
  x.b === 'ev-y0-0122-kakashi-arrives'
 ));
});

test('episode 002 motive and Fourth Hokage wish remain part of meaningful moments', () => {
 const lesson = read('scenes/sc-y0-0121-konohamaru-training.yaml');
 const rooftop = read('scenes/sc-y0-0121-hiruzen-iruka-rooftop.yaml');
 const training = lesson.events.find(x => x.id === 'ev-y0-0121-konohamaru-practises-transformation');
 const identity = lesson.events.find(x => x.id === 'ev-y0-0121-konohamaru-explains-goal');
 const heroWish = rooftop.events.find(x => x.id === 'ev-y0-0121-hiruzen-explains-fear');
 assert(training.text.includes('невдач'));
 assert(identity.text.includes('онука Третього'));
 assert(heroWish.text.includes('Четвертий Хокаґе'));
 assert(training.evidence_ids.includes('evd-sub-ep2-konohamaru-training'));
 assert(identity.evidence_ids.includes('evd-sub-ep2-konohamaru-identity'));
 assert(heroWish.evidence_ids.includes('evd-sub-ep2-hiruzen-fourth-wish'));
});
