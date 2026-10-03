import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import YAML from 'yaml';
import {validateMissionWindows,physicalParticipants} from '../scripts/mission-windows.mjs';
const root='../KONOHA_GAIDEN_ARCS_ZIGRANE_POV_V3/CHRONOLOGY/';
const plan=JSON.parse(fs.readFileSync(root+'period-placement.json','utf8'));
const data=JSON.parse(fs.readFileSync('public/data.json','utf8'));
const get=id=>data.scenes.find(s=>s.id===id);

test('source audit and build reservations agree and validate the entire period',()=>{
 assert.deepEqual(plan,YAML.parse(fs.readFileSync(root+'data/mission-windows.yaml','utf8')));
 validateMissionWindows(plan,data.scenes,data.entities);
});
test('a character cannot leave during the previous journey home or recovery',()=>{
 const w=plan.arcs.find(w=>w.arc_id==='arc-y0-bikochu-search');
 for(const day of [w.end+1,w.occupied_end]){
  const forged={id:'sc-early-departure',state:'active',day,arc_id:'other',events:[{involvement:[{entity_id:'c-naruto',role:'participant',mode:'physical'}]}]};
  assert.throws(()=>validateMissionWindows(plan,[...data.scenes,forged],data.entities),/borrows c-naruto/);
  forged.events[0].involvement[0].mode='remote';
  assert.doesNotThrow(()=>validateMissionWindows(plan,[...data.scenes,forged],data.entities));
 }
});
test('Guy aliases cannot bypass occupation and ordinary village life stays compatible with preparation',()=>{
 assert.deepEqual([...physicalParticipants({events:[{involvement:[{entity_id:'c-guy',role:'participant',mode:'physical'}]}]})],['c-might-guy']);
 const w=plan.arcs.find(w=>w.arc_id==='arc-y0-ryudoin');
 const forged={id:'sc-guy-away',state:'active',day:w.start+1,arc_id:'other',events:[{involvement:[{entity_id:'c-guy',role:'participant',mode:'physical'}]}]};
 assert.throws(()=>validateMissionWindows(plan,[...data.scenes,forged],data.entities),/c-might-guy/);
 const c=plan.constraints.find(c=>c.id==='ryudoin-training-week');
 forged.day=c.start;forged.location_id='loc-land-of-moon';
 assert.throws(()=>validateMissionWindows(plan,[...data.scenes,forged],data.entities),/ryudoin-training-week/);
 forged.location_id='loc-konohagakure';
 assert.doesNotThrow(()=>validateMissionWindows(plan,[...data.scenes,forged],data.entities));
});
test('overnight transitions are separate scenes and Moon care has a full fortnight',()=>{
 assert.equal(get('sc-period-postman-morning-mixup').day,get('sc-y0-1102-postman-manuscript-mixup').day+1);
 assert.equal(get('sc-period-genno-morning-alert').day,get('sc-y0-1119-genno-blueprints').day+1);
 assert.equal(get('sc-period-moon-departure').day-get('sc-period-moon-care').day,14);
 const dojo=plan.arcs.find(w=>w.arc_id==='arc-y0-lee-dojo');
 assert.equal(get('sc-y0-1115-lee-dojo-challenge').day-dojo.start,7);
});
test('dated source relations in reviewed scenes preserve order inside a day too',()=>{
 const affected=new Set(Object.keys(plan.scene_days));
 const refs=new Map(data.scenes.flatMap(s=>[[s.id,s],...s.events.map(e=>[e.id,s])]));
 const parts={dawn:0,morning:1,noon:2,midday:2,afternoon:3,evening:4,night:5};
 for(const l of [...data.links,...data.scenes.flatMap(s=>s.relations||[])].filter(l=>l.kind==='before')){
  const a=refs.get(l.a.replace(/\.(start|end)$/,'')),b=refs.get(l.b.replace(/\.(start|end)$/,''));
  if(!a||!b||a.day===null||b.day===null||(!affected.has(a.id)&&!affected.has(b.id)))continue;
  assert(a.day<=b.day,l.id);
  if(a.day===b.day&&parts[a.day_part]!==undefined&&parts[b.day_part]!==undefined)assert(parts[a.day_part]<=parts[b.day_part],l.id);
 }
});
