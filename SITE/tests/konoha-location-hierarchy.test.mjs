import fs from 'node:fs';
import vm from 'node:vm';
import YAML from 'yaml';
import test from 'node:test';
import assert from 'node:assert/strict';
const root = new URL('../../00_MAIN_WORK_FOLDER/CHRONOLOGY/data/', import.meta.url);
const parse = file => YAML.parse(fs.readFileSync(new URL(file, root), 'utf8'));
const script = fs.readFileSync(new URL('../public/timeline-geography.js', import.meta.url), 'utf8');
const atlas = vm.runInNewContext(script+';GeographyAtlas');
const map = atlas.create(parse('entities.yaml').entities, parse('geography.yaml'));
test('Academy subdivisions retain their building ancestor', () => {
 for (const id of ['loc-academy-classroom','loc-academy-staff-room','loc-academy-front',
 'loc-academy-swing','loc-chunin-exam-room','loc-team7-rooftop']) {
  assert(map.resolve(id).path.includes('geo-konoha-academy'),id);
 }
 assert.equal(map.relation('loc-academy-classroom','loc-academy-staff-room').scope,'same_building');
});
test('nested archives, homes, shrine, hospital and exam structures', () => {
 for (const [id,p] of [
 ['loc-archive-gate','loc-archive-courtyard'],
 ['loc-yumiko-balcony','loc-yumiko-apartment'],
 ['loc-naka-shrine','loc-uchiha-district'],
 ['loc-naka-shrine-underground-room','loc-naka-shrine'],
 ['loc-hokage-rooftop','loc-hokage-residence'],
 ['loc-hospital-second-floor','loc-konoha-hospital'],
 ['loc-higashi-weapon-workbench','loc-higashi-weapon-shop'],
 ['loc-forest-death-gates','loc-forest-death'],
 ['loc-chunin-finals-stands','loc-chunin-finals-arena']
 ]) assert(map.resolve(id).path.includes(p),id+' should include '+p);
});
test('keep unknown sites and distinct banks without fictional geography', () => {
 for (const id of ['loc-inn','loc-iwa-mercenary-mines','loc-team9-ravine'])
  assert.equal(map.resolve(id).country,null,id);
 assert.notEqual(map.resolve('loc-konoha-bank').id,map.resolve('loc-yamano-bank').id);
 assert.equal(map.resolve('loc-ichiraku').settlement,'loc-konohagakure');
});
