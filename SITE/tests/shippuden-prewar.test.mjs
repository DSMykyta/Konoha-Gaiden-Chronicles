import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import YAML from 'yaml';
import {validateShippudenPrewar} from '../scripts/shippuden-prewar.mjs';
const root=path.resolve(import.meta.dirname,'../../00_MAIN_WORK_FOLDER/CHRONOLOGY');
const read=(file)=>YAML.parse(fs.readFileSync(path.join(root,'data',file),'utf8'));
const data=JSON.parse(fs.readFileSync(new URL('../public/data.json',import.meta.url),'utf8'));
const plan=read('shippuden-placement.yaml');
const coverage=JSON.parse(fs.readFileSync(path.join(root,'SHIPPUDEN_COVERAGE.json'),'utf8'));

test('prewar travel, recovery and source intervals remain consistent across the expanded calendar',()=>{
 assert.equal(plan.reservations.find(r=>r.id==='naruto-jiraiya-timeskip').start,'62-12-28');
 assert.equal(validateShippudenPrewar(plan,data.scenes,data.links).reservations,8);
 const borrowed={...data.scenes.find(s=>s.id==='sc-s2-kiba-kakashi-training'),date:{year:67,month:9,day:29}};
 assert.throws(()=>validateShippudenPrewar(plan,[...data.scenes.filter(s=>s.id!==borrowed.id),borrowed],data.links),/borrows c-kakashi/);
});
test('every prewar source episode has an existing scene without claiming a full audit',()=>{
 const scenes=new Set(data.scenes.map(s=>s.id));
 for(const row of coverage.episodes){
  if(row.episode<=256){assert(row.scene_ids.length,`episode ${row.episode}`);assert(['represented_not_full_audit','recap_reused'].includes(row.status));}
  for(const id of row.scene_ids)assert(scenes.has(id),id);
 }
});
test('chakra echoes, counterpart Sakura and transformed sacrifices do not create duplicate physical people',()=>{
 for(const id of ['sc-s2-minato-seal-appearance','sc-s2-kushina-chakra-story']){
  const scene=read('scenes/'+id+'.yaml');assert.equal(scene.presence.length,0);assert(scene.events.every(e=>e.involvement.every(i=>!['physical','physical_hidden'].includes(i.mode))));
 }
 const entities=read('entities.yaml').entities;
 assert.equal(entities.find(e=>e.id==='c-rtn-sakura').representation_of,'c-sakura');
 assert(entities.find(e=>e.id==='c-mukade-sacrifice'));assert(entities.find(e=>e.id==='c-mukade'));
 const substitute=read('scenes/sc-s2-itachi-substitute.yaml');assert(substitute.presence.some(p=>p.entity_id==='c-yura'));assert(!substitute.presence.some(p=>p.entity_id==='c-itachi'));
});
test('Will of Fire subtitles and missing Bonds subtitles have distinct source identities',()=>{
 const sources=read('sources.yaml').sources;
 const fire=sources.find(s=>s.id==='src-subtitle-movie-fire'),bonds=sources.find(s=>s.id==='src-bonds-synopsis-web');
 assert.match(fire.path,/The Will of Fire/);assert.match(bonds.locator_status,/subtitles_missing/);assert(!sources.some(s=>s.id==='src-subtitle-movie-bonds'));
 const films=data.scenes.filter(s=>s.id.startsWith('sc-s2-')&&(s.source_continuity_id||'').startsWith('movie-'));assert(films.length>50);assert(films.every(s=>s.events.every(e=>e.layer==='sources'||e.origin==='F')));
});
