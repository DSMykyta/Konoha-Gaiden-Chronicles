import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const built=JSON.parse(fs.readFileSync(new URL('../public/data.json',import.meta.url),'utf8'));
const epNames=[
 'exam-cohost-plan','kakashi-ame-invitation','second-exam-arrivals',
 'second-exam-written','second-exam-race','gaara-assassination-attempt',
 'demon-desert-start','team8-scroll-pursuit','tenten-ajisai-ruins',
 'tenten-ajisai-rescue','ino-ameno','sakura-saya-puppet',
 'suigetsu-karin-training','gaara-fu-hoichi','neji-saves-jinchuriki',
 'second-exam-promotions'
];

test('Shippuden 394–413 has one distinct timeskip exam arc without duplicated scenes',()=>{
 const arc=built.arcs.find(a=>a.id==='arc-s2-second-chunin-exams');
 assert(arc);
 assert.equal(arc.period_id,'timeskip');
 assert.equal(arc.kind,'adaptation');
 const episodes=built.episodes.filter(e=>e.arc_id===arc.id);
 assert.equal(episodes.length,16);
 assert.deepEqual(new Set(episodes.map(e=>e.id)),new Set(epNames.map(s=>'ep-s2-'+s)));
 for(const episode of episodes){
  assert(episode.scene_ids.length>0,episode.id);
  for(const id of episode.scene_ids){
   const scene=built.scenes.find(s=>s.id===id);
   assert(scene,id);
   assert.equal(scene.episode_id,episode.id);
   assert.equal(scene.source_continuity_id,'main');
   assert.equal(scene.date.year,64);
   assert(scene.events.length>0,id);
   assert(scene.events.every(e=>e.origin==='F'),id);
  }
 }
 assert(!built.episodes.filter(e=>e.arc_id==='arc-s2-timeskip').some(e=>epNames.includes(e.id.replace(/^ep-s2-/,''))));
});

test('OVA tournament has its own provenance, complete structure and explicit order',()=>{
 const arc=built.arcs.find(a=>a.id==='arc-alt-s2-ova-chunin-fire');
 assert(arc);
 assert.equal(arc.source_continuity_id,'alt-ova-chunin-fire');
 assert.equal(arc.kind,'alternate');
 const ep=built.episodes.filter(e=>e.arc_id===arc.id);
 assert.equal(ep.length,4);
 const scenes=built.scenes.filter(s=>s.arc_id===arc.id&&s.state==='active');
 assert.equal(scenes.length,5);
 assert.equal(scenes.flatMap(s=>s.events).length,11);
 for(const scene of scenes){
  assert.equal(scene.source_continuity_id,'alt-ova-chunin-fire');
  assert.deepEqual(scene.date,{year:66,month:9,day:2});
  assert(scene.events.every(e=>e.origin==='O'));
  assert(scene.events.every(e=>e.evidence_ids.every(id=>built.sources.evidence.some(ev=>ev.id===id))));
  assert(scene.events.every(e=>e.involvement.every(p=>p.mode==='physical')));
  assert(ep.some(e=>e.id===scene.episode_id));
 }
 const sorted=[
  'sc-alt-s2-ova-chunin-field','sc-alt-s2-ova-chunin-rules',
  'sc-alt-s2-ova-chunin-fight','sc-alt-s2-ova-chunin-disqualification',
  'sc-alt-s2-ova-chunin-promotion'
 ];
 for(let i=0;i<sorted.length-1;i++){
  assert(built.links.some(l=>l.kind==='before'&&l.a===sorted[i]&&l.b===sorted[i+1]),sorted[i]);
 }
 const locationIds=new Set(built.entities.filter(e=>e.kind==='location').map(e=>e.id));
 assert(locationIds.has('loc-suna-chunin-second-course'));
 assert(locationIds.has('loc-suna-chunin-tournament-arena'));
});

test('Kusagakure insertion gap remains between the two exams, without fabricated scenes',()=>{
 const end=built.scenes.find(s=>s.id==='sc-s2-second-exam-promotions');
 const ova=built.scenes.find(s=>s.id==='sc-alt-s2-ova-chunin-field');
 assert(end && ova);
 assert.deepEqual(end.date,{year:64,month:10,day:20});
 assert.deepEqual(ova.date,{year:66,month:9,day:2});
 assert(end.day<ova.day);
 assert(!built.arcs.some(a=>a.id==='arc-s2-kusagakure-exam-placeholder'));
});
