import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import YAML from 'yaml';
const data=JSON.parse(fs.readFileSync(new URL('../public/data.json',import.meta.url),'utf8'));
const root=path.resolve(import.meta.dirname,'../../KONOHA_GAIDEN_ARCS_ZIGRANE_POV_V3/CHRONOLOGY');
const plan=JSON.parse(fs.readFileSync(path.join(root,'autumn-placement.json'),'utf8'));
const participants=s=>new Set(s.events.flatMap(e=>e.involvement.filter(i=>['physical','physical_hidden'].includes(i.mode)&&i.role!=='mentioned').map(i=>i.entity_id)));
const scenes=data.scenes.filter(s=>s.state==='active'&&s.day!==null);
const scene=id=>scenes.find(s=>s.id===id);
const eventDays=new Map(scenes.flatMap(s=>[[s.id,s.day],...s.events.map(e=>[e.id,s.day])]));
const selectedArcs=new Set([...plan.arcs.map(a=>a.arc_id),'arc-time-slip-performers']);

test('the published missions have disjoint occupied ranges for shared participants',()=>{
 const arcs=[...selectedArcs].map(id=>({id,scenes:scenes.filter(s=>s.arc_id===id)}));
 for(let i=0;i<arcs.length;i++)for(const b of arcs.slice(i+1)){
  const a=arcs[i],cast=new Set(a.scenes.flatMap(s=>[...participants(s)]));
  const shared=b.scenes.flatMap(s=>[...participants(s)]).filter(id=>cast.has(id));
  if(!shared.length)continue;
  const start=a.scenes.reduce((n,s)=>Math.min(n,s.day),Infinity),end=a.scenes.reduce((n,s)=>Math.max(n,s.day),-Infinity);
  const otherStart=b.scenes.reduce((n,s)=>Math.min(n,s.day),Infinity),otherEnd=b.scenes.reduce((n,s)=>Math.max(n,s.day),-Infinity);
  assert(end<otherStart||otherEnd<start,`${a.id} overlaps ${b.id}: ${[...new Set(shared)]}`);
 }
});

test('no other dated story borrows the same physical participant on a reserved mission day',()=>{
 const reviewed=scenes.filter(s=>selectedArcs.has(s.arc_id));
 const other=scenes.filter(s=>s.day>=272&&!selectedArcs.has(s.arc_id)&&s.arc_id!=='arc-y0-naruto-birthday');
 for(const s of reviewed)for(const t of other.filter(t=>t.day===s.day)){
  const cast=participants(s),common=[...participants(t)].filter(id=>cast.has(id));
  assert.equal(common.length,0,`${s.id} conflicts with ${t.id}: ${common}`);
 }
});

test('Mizuki’s continuous fight finishes before the next mission and Bikochu follows his defeat',()=>{
 const mizuki=scenes.filter(s=>s.arc_id==='arc-y0-mizuki-return');
 assert.equal(new Set(mizuki.map(s=>s.day)).size,1);assert.equal(mizuki[0].day,279);
 assert(mizuki.every(s=>s.day>scene('sc-time-slip-136-departure').day));
 const hospital=scene('sc-y0-1006-kurenai-hospital-bikochu-plan');
 const approval=scene('sc-y0-1006-tsunade-approves-bikochu');
 const waterfall=scene('sc-y0-1006-hinata-waterfall-training');
 const search=scene('sc-y0-1007-bikochu-habitat-search');
 assert(hospital.day>mizuki[0].day);assert.equal(approval.day,hospital.day+1);
 assert.equal(waterfall.day,approval.day+1);assert.equal(waterfall.day_part,'night');
 assert.equal(search.day,waterfall.day+1);
 assert.equal(scene('sc-y0-1008-hinata-protects-team').day,search.day+1);
});

test('Kurenai’s social evening follows the hospital phase and preserves Kakashi’s linked day',()=>{
 const hospital=scene('sc-y0-1006-kurenai-hospital-bikochu-plan');
 const evening=scene('sc-games-kakashi-nobari-gathering');assert(evening.day>hospital.day);
 assert.equal(evening.day,plan.kurenai_social_day);
 for(const id of ['sc-games-kakashi-rest-order','sc-games-kakashi-forced-rest'])assert.equal(scene(id).day,evening.day);
 assert.deepEqual([scene('sc-y0-1010-naruto-thirteenth-birthday').date.year,scene('sc-y0-1010-naruto-thirteenth-birthday').date.month,scene('sc-y0-1010-naruto-thirteenth-birthday').date.day],[61,10,10]);
});

test('every existing before relation involving moved stories still agrees with their dates',()=>{
 const affected=new Set(scenes.filter(s=>selectedArcs.has(s.arc_id)||s.id==='sc-games-kakashi-nobari-gathering').flatMap(s=>[s.id,...s.events.map(e=>e.id)]));
 for(const link of data.links.filter(l=>l.kind==='before')){
  const a=link.a.replace(/\.(start|end)$/,''),b=link.b.replace(/\.(start|end)$/,'');
  if((affected.has(a)||affected.has(b))&&eventDays.has(a)&&eventDays.has(b))assert(eventDays.get(a)<=eventDays.get(b),link.id);
 }
});

test('the calendar crosses into positive year 62 before its within-year epoch transition',()=>{
 assert.equal(data.calendar.view_start_year,61);assert.equal(data.calendar.view_end_year,62);
 assert.equal(data.calendar.view_days,730);
 const last=scene('sc-y0-1216-iruka-naruto-last-ramen');assert.equal(last.day,plan.last_ramen_day);
 assert.deepEqual([last.date.year,last.date.month,last.date.day],[62,1,14]);
 assert.deepEqual(data.periods.find(p=>p.id==='timeskip').boundary_date,{year:62,month:1,day:15});
 const anchors=YAML.parse(fs.readFileSync(path.join(root,'data/time-anchors.yaml'),'utf8')).anchors;
 assert(anchors.filter(a=>a.date).every(a=>Number.isInteger(a.date.year)&&a.date.year>0));
 assert(anchors.filter(a=>a.id.startsWith('ta-autumn-reconciled')).every(a=>a.placement_status==='working'&&a.evidence_ids.includes('evd-autumn-cast-reconciliation')));
});
