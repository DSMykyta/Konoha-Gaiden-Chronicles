import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import YAML from 'yaml';
import {validateCalendar,dayInYear} from '../scripts/calendar.mjs';
const root='../KONOHA_GAIDEN_ARCS_ZIGRANE_POV_V3/CHRONOLOGY/data/';
const load=file=>YAML.parse(fs.readFileSync(root+file,'utf8'));
const {calendar,periods}=load('timeline-periods.yaml'),anchors=load('time-anchors.yaml').anchors;
const lengths=[31,28,31,30,31,30,31,31,30,31,30,31];

test('positive founding years preserve the January team formation day and event references',()=>{
 validateCalendar(calendar,periods,anchors);
 assert.equal(calendar.current_year,61);
 const formation=anchors.find(a=>a.id==='ta-team-formation');
 assert.deepEqual(formation.date,{year:61,month:1,day:22});
 assert.equal(dayInYear(formation.date,0,calendar,lengths),21);
 assert.equal(dayInYear({year:61,month:12,day:31},0,calendar,lengths),364);
 assert(anchors.filter(a=>a.date&&!a.id.startsWith('ta-autumn-reconciled-')).every(a=>a.date.year===61));
 assert(anchors.some(a=>a.id.startsWith('ta-autumn-reconciled-62-')&&a.date.year===62));
 const built=JSON.parse(fs.readFileSync('public/data.json','utf8'));
 const event=built.events.find(e=>e.id==='ev-y0-0122-team7-announced');
 assert.equal(event.day,21);
 assert.equal(built.scenes.find(s=>s.id===event.scene_id).date.year,61);
});

test('Kakashi wartime and Nine-Tails phases belong to separate historical eras',()=>{
 const get=id=>periods.find(p=>p.id===id);
 assert(get('third-shinobi-war').to_year<get('fourth-hokage').from_year);
 assert.equal(get('nine-tails-crisis').from_year,49);
 assert.equal(calendar.current_year-get('nine-tails-crisis').from_year,12);
 assert.equal(get('two-blue-vortex').from_year-get('altered-history').from_year,3);
 assert(periods.every(p=>!/(Naruto|Boruto|Наруто|Боруто)/.test(p.label)));
 const before={id:'ancient',label:'Ancient',calendar_era:'before_founding',from_year:100,to_year:1};
 validateCalendar(calendar,[before],[]);
 assert.throws(()=>validateCalendar(calendar,[{...before,from_year:-100}],[]),/Invalid era year/);
 assert.throws(()=>validateCalendar(calendar,periods,[{id:'zero',date:{year:0}}]),/Invalid anchor year/);
 assert.throws(()=>validateCalendar(calendar,[{...get('part-i'),boundary_date:{year:61,month:13,day:1}}],[]),/Invalid era boundary date/);
});

test('invalid dates and years cannot silently fold into the current year',()=>{
 assert.throws(()=>dayInYear({year:62,month:1,day:22},0,calendar,lengths),/outside active calendar year/);
 assert.throws(()=>dayInYear({year:61,month:2,day:29},0,calendar,lengths),/Invalid calendar date/);
 assert.throws(()=>dayInYear({year:61,month:12,day:31},1,calendar,lengths),/out of bounds/);
});

test('populated additional years expand the canvas without changing existing days',()=>{
 const multi={...calendar,view_start_year:61,view_end_year:62,view_days:730};
 assert.equal(dayInYear({year:61,month:1,day:22},0,multi,lengths),21);
 assert.equal(dayInYear({year:62,month:1,day:1},0,multi,lengths),365);
 assert.equal(dayInYear({year:62,month:12,day:31},0,multi,lengths),729);
});
