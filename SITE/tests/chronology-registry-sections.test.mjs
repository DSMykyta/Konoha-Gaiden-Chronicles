import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import YAML from 'yaml';

const root=new URL('../../00_MAIN_WORK_FOLDER/CHRONOLOGY/data/',import.meta.url);
const read=p=>YAML.parse(fs.readFileSync(new URL(p,root),'utf8'));

test('newly sourced people and locations are entities, never team memberships',()=>{
  const data=read('entities.yaml');
  const names=['c-pochi','c-akane','loc-kirigakure','loc-land-water','c-haku-father','c-haku-mother'];
  const eids=new Set(data.entities.map(e=>e.id));
  const mids=new Set((data.memberships||[]).map(m=>m.id));
  for(const id of names){
    assert(eids.has(id),'Entity missing from entities: '+id);
    assert(!mids.has(id),'Entity incorrectly stored as a team membership: '+id);
  }
  assert(data.entities.some(e=>e.id==='loc-land-water'&&e.kind==='location'));
  assert(data.entities.some(e=>e.id==='c-haku-father'&&e.kind==='person'));
});

test('new chronology relations are in active links, not inert notes',()=>{
  const data=read('links.yaml');
  const active=new Set(data.links.map(l=>l.id));
  const expected=[
    'lnk-prewaves-dranks-before-tora-capture',
    'lnk-episode3-kakashi-apartment-before-class',
    'lnk-kaiza-rescues-inari-before-flood',
    'lnk-kaiza-flood-before-execution',
    'lnk-kaiza-execution-before-dinner-story',
    'lnk-zabuza-bloody-mist-before-first-encounter',
    'lnk-haku-childhood-before-recruitment',
    'lnk-haku-recruitment-before-forest',
    'lnk-zabuza-academy-before-coup',
    'lnk-zabuza-coup-before-gato',
    'lnk-inari-asks-before-arriving-bridge',
    'lnk-kaiza-tragedy-before-inari-protects-mother'
  ];
  const nonLinks=(data.notes||[]).filter(n=>typeof n==='object'&&n).map(n=>n.id);
  for(const id of expected){
    assert(active.has(id),'Relation missing from links: '+id);
    assert(!nonLinks.includes(id),'Active relation remains in notes: '+id);
  }
});
