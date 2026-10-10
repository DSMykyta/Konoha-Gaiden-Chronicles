import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync(new URL('../public/data.json', import.meta.url), 'utf8'));
const byId = id => {
 const event = data.events.find(item => item.id === id);
 assert(event, 'Missing moment: ' + id);
 return event;
};

// Provenance and continuity belong to metadata. A timeline moment must tell
// the reader what happened, not how an editor classified two adaptations.
const provenanceOnly = /^(?:Новела подає|Новельна версія|Альтернативна версія|Окрема новельна розв’язка)|\b(?:події не змішуються з OVA|це не друга окрема канонічна місія)\b/i;

test('moment descriptions do not use known provenance-only placeholders', () => {
 for (const event of data.events.filter(e => e.scene_state !== 'inactive')) {
  assert(!provenanceOnly.test(event.text || ''), 'Editorial placeholder in ' + event.id);
 }
});

test('Waterfall novel has concrete events separate from OVA provenance', () => {
 const siege = data.scenes.find(s => s.id === 'sc-alt-y0-0905-waterfall-novel-siege');
 const ending = data.scenes.find(s => s.id === 'sc-alt-y0-0906-waterfall-novel-ending');
 assert(siege && ending);
 for (const scene of [siege, ending]) {
  assert.equal(scene.source_continuity_id, 'alt-waterfall-novel');
  assert.equal(scene.review.text, 'partial');
  assert(!/Новельна версія/.test(scene.title));
  assert(scene.events.length >= 3);
  for (const event of scene.events) {
   assert.equal(event.origin, 'N');
   assert(event.text.length > 90, 'Brief or empty narrative: ' + event.id);
   assert(event.evidence_ids.includes('evd-novel-waterfall'));
  }
 }
 assert(byId('ev-alt-y0-0905-senji-bargains-suien').physical.includes('c-senji'));
 assert(byId('ev-alt-y0-0906-kakashi-detains-suien-allies').physical.includes('c-kakashi'));
 assert(data.entities.some(entity => entity.id === 'c-senji'));
});
