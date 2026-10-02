import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateHierarchy} from '../scripts/hierarchy.mjs';
const fixture=()=>({periods:[{id:'part-i'}],arcs:[{id:'a',title:'Arc',continuity_id:'main',period_id:'part-i',kind:'canonical'}],episodes:[{id:'e',title:'Episode',continuity_id:'main',arc_id:'a'}],scenes:[{id:'s',title:'Scene',continuity_id:'main',episode_id:'e'}]});
test('complete hierarchy accepts one-scene episodes',()=>validateHierarchy(fixture()));
test('old entry IDs can redirect to one surviving story parent',()=>{const x=fixture();x.episodes[0].redirect_ids=['old-episode'];validateHierarchy(x);});
test('story redirects cannot shadow existing IDs or point to two parents',()=>{
 const x=fixture();x.episodes[0].redirect_ids=['s'];assert.throws(()=>validateHierarchy(x),/Ambiguous story redirect/);
 x.episodes[0].redirect_ids=['old'];x.arcs[0].redirect_ids=['old'];assert.throws(()=>validateHierarchy(x),/Ambiguous story redirect/);
});
for(const [name,edit,pattern] of [
 ['orphan scene',x=>delete x.scenes[0].episode_id,/unknown episode/],
 ['unknown arc',x=>x.episodes[0].arc_id='missing',/Unknown arc/],
 ['cross-continuity scene',x=>x.scenes[0].continuity_id='alternate',/Episode continuity mismatch/],
 ['cross-continuity episode',x=>x.episodes[0].continuity_id='alternate',/Arc continuity mismatch/],
 ['unknown era',x=>x.arcs[0].period_id='timeskip',/Unknown period/],
 ['duplicate ID',x=>x.episodes.push({...x.episodes[0]}),/duplicate episode/],
 ['unused episode',x=>x.episodes.push({...x.episodes[0],id:'unused'}),/Empty episode/],
 ['source child lists',x=>x.episodes[0].scene_ids=['s'],/Derived scene_ids/],
 ['redundant scene arc',x=>x.scenes[0].arc_id='a',/Redundant arc_id/]
])test(name,()=>{const x=fixture();edit(x);assert.throws(()=>validateHierarchy(x),pattern);});
const data=JSON.parse(fs.readFileSync(new URL('../public/data.json',import.meta.url),'utf8'));
test('independent classroom and examination branches remain separate',()=>{
 const scenes=new Map(data.scenes.map(s=>[s.id,s]));
 const formation=scenes.get('sc-y0-0122-academy-announcements').episode_id;
 for(const id of ['sc-y0-0122-academy-exterior-jonin','sc-y0-0122-team10-lunch'])assert.notEqual(scenes.get(id).episode_id,formation);
 assert.notEqual(scenes.get('sc-y0-0706-kakashi-seals-sasuke').episode_id,scenes.get('sc-y0-0706-preliminary-matches').episode_id);
 assert.notEqual(scenes.get('sc-y0-0701-anko-reviews-suna-record').episode_id,scenes.get('sc-y0-0701-gaara-first-tower').episode_id);
});
test('inactive source scenes are retained but do not count as displayed children',()=>{
 assert.equal(data.scenes.find(s=>s.id==='sc-y0-0924-valley-end').state,'inactive');
 assert(!data.episodes.find(e=>e.id==='ep-y0-valley-of-end').scene_ids.includes('sc-y0-0924-valley-end'));
});
test('all displayed source scenes are reachable through an arc',()=>{
 const arcs=new Map(data.arcs.map(a=>[a.id,a])),eps=new Map(data.episodes.map(e=>[e.id,e]));
 for(const scene of data.scenes.filter(s=>s.state!=='inactive')){
  const ep=eps.get(scene.episode_id);assert(ep);assert(ep.scene_ids.includes(scene.id));
  const arc=arcs.get(ep.arc_id);assert(arc);assert(arc.episode_ids.includes(ep.id));
 }
});

test('school day and first day of Team 9 retain scenes and old entry IDs',()=>{
 const ep=data.episodes.find(e=>e.id==='ep-y0-team-formation');
 assert.equal(ep.scene_ids.length,5);
 for(const id of ['sc-y0-0122-naruto-impersonates-sasuke','sc-y0-0122-sakura-searches-sasuke'])assert(ep.scene_ids.includes(id));
 const first=data.episodes.find(e=>e.id==='ep-y0-team9-introduction');
 assert.deepEqual(first.scene_ids,['sc-y0-0122-dango-shop','sc-y0-0122-kita-home-night']);
 assert(first.redirect_ids.includes('ep-y0-kita-home-after-formation'));
 const moments=new Set(data.events.filter(e=>first.scene_ids.includes(e.scene_id)).map(e=>e.id));
 for(const id of ['ev-y0-0122-dango-sharing','ev-y0-0122-dango-introductions','ev-y0-0122-raido-assigns-field8','ev-y0-0122-nobari-returns','ev-y0-0122-kita-talks-with-mother','ev-y0-0122-nobari-gives-kita-gloves','ev-y0-0122-kita-cries'])assert(moments.has(id),'Missing first-day moment '+id);
 const arc=data.arcs.find(a=>a.id==='arc-y0-team9-first-day');
 assert(arc.episode_ids.includes('ep-y0-raido-evaluation'));
 assert(arc.redirect_ids.includes('arc-y0-team9-raido-evaluation'));
});
