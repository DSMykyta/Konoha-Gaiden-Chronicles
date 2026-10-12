import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import YAML from 'yaml';
const data=JSON.parse(fs.readFileSync(new URL('../public/data.json',import.meta.url),'utf8'));
const root=path.resolve(import.meta.dirname,'../../KONOHA_GAIDEN_ARCS_ZIGRANE_POV_V3/CHRONOLOGY');
const plan=JSON.parse(fs.readFileSync(path.join(root,'period-placement.json'),'utf8'));
const participants=s=>new Set(s.events.flatMap(e=>e.involvement.filter(i=>['physical','physical_hidden'].includes(i.mode)&&i.role!=='mentioned').map(i=>i.entity_id)));
const scenes=data.scenes.filter(s=>s.state==='active'&&s.day!==null);
const originShift=(plan.calendar_base_year-data.calendar.view_start_year)*365;
const scene=id=>scenes.find(s=>s.id===id);
const eventDays=new Map(scenes.flatMap(s=>[[s.id,s.day],...s.events.map(e=>[e.id,s.day])]));
const selectedArcs=new Set([...plan.arcs.map(a=>a.arc_id),'arc-time-slip-performers']);

const main=s=>(s.source_continuity_id||'main')==='main';
const local=s=>/^(loc-konohagakure|loc-konoha-|loc-hokage-|loc-academy-|loc-guy-dojo)/.test(s.location_id||'');
const compatibleDay=(a,b)=>local(a)&&local(b)&&a.day===b.day;
test('different missions never put one person in distant locations on one day',()=>{
 const arcs=[...selectedArcs].map(id=>({id,scenes:scenes.filter(s=>s.arc_id===id&&main(s))}));
 for(let i=0;i<arcs.length;i++)for(const b of arcs.slice(i+1)){
  const a=arcs[i];
  for(const s of a.scenes)for(const t of b.scenes.filter(t=>t.day===s.day)){
   const shared=[...participants(s)].filter(id=>participants(t).has(id));
   assert(!shared.length||compatibleDay(s,t),`${a.id} and ${b.id} duplicate ${shared} at ${s.location_id} / ${t.location_id}`);
  }
 }
});

test('no other dated story borrows the same physical participant on a reserved mission day',()=>{
 const reviewed=scenes.filter(s=>selectedArcs.has(s.arc_id)&&main(s));
 const other=scenes.filter(s=>s.day>=272&&main(s)&&!selectedArcs.has(s.arc_id)&&s.arc_id!=='arc-y0-naruto-birthday');
 for(const s of reviewed)for(const t of other.filter(t=>t.day===s.day)){
  const cast=participants(s),common=[...participants(t)].filter(id=>cast.has(id));
  assert(!common.length||compatibleDay(s,t),`${s.id} conflicts with ${t.id}: ${common}`);
 }
});

test('Mizuki’s continuous fight finishes before the next mission and Bikochu follows his defeat',()=>{
 const mizuki=scenes.filter(s=>s.arc_id==='arc-y0-mizuki-return');
 assert.equal(new Set(mizuki.map(s=>s.day)).size,1);assert.equal(mizuki[0].day,281+originShift);
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

test('Kurenai’s social evening precedes her injury and preserves Kakashi’s linked day',()=>{
 const hospital=scene('sc-y0-1006-kurenai-hospital-bikochu-plan');
 const evening=scene('sc-games-kakashi-nobari-gathering');assert(evening.day<hospital.day);
 assert.equal(evening.day,plan.kurenai_social_day+originShift);
 for(const id of ['sc-games-kakashi-rest-order','sc-games-kakashi-forced-rest'])assert.equal(scene(id).day,evening.day);
 const kurosuki=scene('sc-y0-1010-kurosuki-mission-assigned');
 assert.equal(kurosuki.day,plan.arcs.find(a=>a.arc_id==='arc-y0-raiga-ranmaru').start+originShift,'Corrected October mission must match accepted plan date');
 assert.equal(scene('sc-y0-1010-naruto-thirteenth-birthday'),undefined,'Do not invent an unrecorded birthday scene');
});

test('every existing before relation involving moved stories still agrees with their dates',()=>{
 const affected=new Set(scenes.filter(s=>selectedArcs.has(s.arc_id)||s.id==='sc-games-kakashi-nobari-gathering').flatMap(s=>[s.id,...s.events.map(e=>e.id)]));
 for(const link of data.links.filter(l=>l.kind==='before')){
  const a=link.a.replace(/\.(start|end)$/,''),b=link.b.replace(/\.(start|end)$/,'');
  if((affected.has(a)||affected.has(b))&&eventDays.has(a)&&eventDays.has(b))assert(eventDays.get(a)<=eventDays.get(b),link.id);
 }
});

test('the epoch boundary follows the final ramen on December 28 year 61',()=>{
 assert(data.calendar.view_start_year<=61);assert(data.calendar.view_end_year>=62);
 assert.equal(data.calendar.view_days,(data.calendar.view_end_year-data.calendar.view_start_year+1)*365);
 const last=scene('sc-y0-1216-iruka-naruto-last-ramen');assert.equal(last.day,plan.last_ramen_day+originShift);
 assert.deepEqual([last.date.year,last.date.month,last.date.day],[61,12,27]);
 assert.deepEqual(data.periods.find(p=>p.id==='timeskip').boundary_date,{year:61,month:12,day:28});
 const anchors=YAML.parse(fs.readFileSync(path.join(root,'data/time-anchors.yaml'),'utf8')).anchors;
 assert(anchors.filter(a=>a.date).every(a=>Number.isInteger(a.date.year)&&a.date.year>0));
 assert(anchors.filter(a=>a.id.startsWith('ta-autumn-reconciled')).every(a=>a.placement_status==='working'&&a.evidence_ids.includes('evd-autumn-cast-reconciliation')));
});
