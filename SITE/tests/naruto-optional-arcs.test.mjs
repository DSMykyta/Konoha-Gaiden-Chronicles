import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const project='../00_MAIN_WORK_FOLDER/CHRONOLOGY/data/';
const source=JSON.parse(fs.readFileSync(project+'naruto-optional.yaml','utf8'));
const data=JSON.parse(fs.readFileSync('public/data.json','utf8'));
const NarutoArcToggle=vm.runInNewContext(fs.readFileSync('public/naruto-variant-toggle.js','utf8')+';NarutoArcToggle');
test('Naruto-free default is enforced across all fourteen B/V arcs and every moment',()=>{
 assert.equal(source.arcs.length,14);
 for(const setting of source.arcs){
  const arc=data.arcs.find(x=>x.id===setting.arc_id);
  assert(arc?.naruto_optional,setting.arc_id);
  const events=data.events.filter(x=>x.arc_id===setting.arc_id);
  assert(events.length,setting.arc_id);
  for(const event of events){
   assert(event.naruto_original,setting.arc_id+' '+event.id);
   assert(!event.involvement.some(i=>i.entity_id==='c-naruto'),event.id);
   assert(!event.physical.includes('c-naruto'),event.id);
   assert(!event.tracks.includes('c-naruto'),event.id);
   assert(!/Наруто|Naruto/.test(event.title+' '+event.text),event.id);
  }
  for(const episode of data.episodes.filter(x=>x.arc_id===setting.arc_id)){
   assert(!/Наруто|Naruto/.test(episode.title),episode.id);
  }
  for(const scene of data.scenes.filter(x=>x.arc_id===setting.arc_id)){
   assert(!/Наруто|Naruto/.test(scene.title+' '+(scene.description||'')),scene.id);
  }
 }
});
test('the per-arc switch restores original scenes, names and physical Naruto, without touching other arcs',()=>{
 const arc='arc-y0-yakumo-kurenai',scene=data.scenes.find(s=>s.arc_id===arc);
 const e=data.events.find(e=>e.arc_id===arc&&e.naruto_original.involvement.some(i=>i.entity_id==='c-naruto'));
 const originalText=e.naruto_original.text,absentText=e.text,other=data.events.find(x=>x.arc_id!==arc);
 const otherText=other.text;
 assert(e&&!e.physical.includes('c-naruto'));
 const ep=data.episodes.find(ep=>ep.arc_id===arc&&/Наруто/.test(ep.naruto_original?.title||''));
 NarutoArcToggle.set(data,arc,true);
 if(ep)assert.equal(ep.title,ep.naruto_original.title);
 assert.equal(e.text,originalText);
 assert(e.physical.includes('c-naruto'));
 assert.equal(scene.title,scene.naruto_original.title);
 NarutoArcToggle.set(data,arc,false);
 assert.equal(e.text,absentText);
 assert(!e.physical.includes('c-naruto'));
 assert.equal(other.text,otherText);
});
test('calendar decisions are exact, episodes follow working dates and last ramen is in year 62',()=>{
 const plan=JSON.parse(fs.readFileSync(project.replace('/data/','/')+'period-placement.json','utf8'));
 const start=data.calendar.view_start_year;
 for(const [id,day] of Object.entries(plan.scene_days)){
  const scene=data.scenes.find(s=>s.id===id);
  if(!scene)continue;
  assert.equal(scene.day,(plan.calendar_base_year-start)*365+day,id);
 }
 const ramen=data.scenes.find(s=>s.id==='sc-y0-1216-iruka-naruto-last-ramen');
 assert.equal(ramen.date.year,62);
 assert.equal(ramen.date.month,12);
 assert.equal(ramen.date.day,27);
});
