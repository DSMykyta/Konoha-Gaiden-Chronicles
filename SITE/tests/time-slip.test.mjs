import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import YAML from 'yaml';

const data=JSON.parse(fs.readFileSync(new URL('../public/data.json',import.meta.url),'utf8'));
const root=path.resolve(import.meta.dirname,'../../KONOHA_GAIDEN_ARCS_ZIGRANE_POV_V3/CHRONOLOGY/data');
const load=file=>YAML.parse(fs.readFileSync(path.join(root,file),'utf8'));
const traveler='c-unnamed-travelling-performer';
const scenes=data.scenes.filter(s=>s.arc_id==='arc-time-slip-performers');
const moments=data.events.filter(e=>e.arc_id==='arc-time-slip-performers');
const event=id=>moments.find(e=>e.id===id);
const day=id=>event(id)?.day??scenes.find(s=>s.id===id)?.day;

test('Time Slip publishes only the past and uses the reconstructed founding calendar',()=>{
 const arc=data.arcs.find(a=>a.id==='arc-time-slip-performers');
 assert.equal(arc.title,'Мандрівні артисти');assert.equal(arc.period_id,'part-i');
 assert.deepEqual(arc.episode_ids.map(id=>data.episodes.find(e=>e.id===id).source_episode),[129,130,131,132,133,134,135,136]);
 assert.equal(moments.length,95);
 for(const scene of scenes){
  assert.equal(scene.date.year,61);assert.equal(scene.date_status,'working');
  assert(scene.day>=272&&scene.day<=278,scene.id);
 }
 assert.equal(arc.day_start,272);assert.equal(arc.day_end,278);
 assert.equal(event('ev-time-slip-136-past-exit').day,278);
 assert(!moments.some(e=>/могил|дорослий Наруто|доросла Сакура/.test(e.title)));
});

test('the unnamed traveller has his own profile and never joins young Sasuke’s physical line',()=>{
 const entity=data.entities.find(e=>e.id===traveler);
 assert.equal(entity.representation_of,'c-sasuke');
 assert(!/Саске|Sasuke/.test([entity.name,...entity.aliases].join(' ')));
 const profile=data.profiles.find(p=>p.entity_id===traveler);
 assert.equal(profile.display_name,'Невідомий мандрівний артист');
 assert(!/Саске|Sasuke/.test(JSON.stringify(profile)));
 assert(data.profiles.some(p=>p.entity_id==='c-boruto'&&p.display_name==='Боруто Узумакі'));
 for(const e of moments){assert(!e.physical.includes('c-sasuke'),e.id);assert(!e.tracks.includes('c-sasuke'),e.id);}
 for(const id of ['c-boruto',traveler]){
  const state=data.character_profiles_v2.find(p=>p.entity_id===id).states[0];
  assert.equal(state.from,'ev-time-slip-129-arrival.start');assert.equal(state.to,'ev-time-slip-136-past-exit.end');
  assert.equal(state.from_day,272);assert.equal(state.to_day,278);
  const line=moments.filter(e=>e.tracks.includes(id));
  assert(line.some(e=>e.id==='ev-time-slip-136-past-exit'));
  assert(!line.some(e=>e.day>state.to_day||e.id==='ev-time-slip-136-hyuga-find'));
 }
});

test('continuations and the exit from the past respect causality without repeating recaps',()=>{
 assert.equal(day('sc-time-slip-132-jiraiya-question'),day('sc-time-slip-133-identity-agreement'));
 assert.equal(moments.filter(e=>e.title==='Джирая питає про Саске Учіху').length,1);
 for(const ep of [133,134,135]){
  const epScenes=scenes.filter(s=>s.episode_id===`ep-time-slip-${ep}`);
  // The opening of 133 continues the previous evening; its battle is on 04.10.
  for(const s of epScenes.filter(s=>!s.id.endsWith('identity-agreement')))assert.equal(s.day,276,s.id);
 }
 const links=data.links.filter(l=>l.id.startsWith('lnk-time-slip-'));
 for(const link of links.filter(l=>l.a.startsWith('sc-time-slip')||l.a.startsWith('ev-time-slip')))assert(day(link.a)<=day(link.b),link.id);
 assert(links.some(l=>l.a==='ev-time-slip-136-past-exit'&&l.b==='ev-time-slip-136-hyuga-find'));
 assert.equal(scenes.find(s=>s.id==='sc-time-slip-136-memory-erasure').events.at(-1).id,'ev-time-slip-136-sharingan-erasure');
 const ep136=scenes.filter(s=>s.episode_id==='ep-time-slip-136').sort((a,b)=>a.display_rank-b.display_rank);
 assert(ep136.findIndex(s=>s.id.endsWith('departure'))<ep136.findIndex(s=>s.id.endsWith('hyuga-discovery')));
});

test('conflicting autumn missions move while independent Team 8 scenes and the birthday stay fixed',()=>{
 for(const [id,month,date] of [
  ['sc-y0-0930-team8-hot-springs-training',9,30],
  ['sc-y0-1001-mizuki-prison-break',10,9],
  ['sc-y0-1004-powered-mizuki-battle',10,9],
  ['sc-y0-1005-animal-district-four-warriors',11,4],
  ['sc-y0-1006-tsunade-approves-bikochu',10,12],
  ['sc-y0-1010-naruto-thirteenth-birthday',10,10],
 ]){const s=data.scenes.find(s=>s.id===id);assert.deepEqual([s.date.year,s.date.month,s.date.day],[61,month,date],id);}
});

test('new evidence points to available transcript files and the editorial date decision',()=>{
 const sources=new Map(data.sources.sources.map(s=>[s.id,s]));
 const evidence=new Map(data.sources.evidence.map(e=>[e.id,e]));
 for(const e of moments)for(const id of e.evidence_ids){
  const source=sources.get(evidence.get(id).source_id);assert(source);
  if(source.path)assert(fs.existsSync(path.resolve(root,'../../..',source.path)),source.path);
 }
 assert(fs.existsSync(path.resolve(root,'../TIME_SLIP_UA.md')));
 const anchors=load('time-anchors.yaml').anchors.filter(a=>a.id.startsWith('ta-time-slip-'));
 assert(anchors.every(a=>a.basis==='project_decision'&&a.evidence_ids.includes('evd-time-slip-working-placement')));
});
