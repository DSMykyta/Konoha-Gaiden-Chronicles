import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const heading=vm.runInNewContext(fs.readFileSync(new URL('../public/era-heading.js',import.meta.url),'utf8')+';TimelineEraHeading');
const periods=[
 {id:'teams',label:'Епоха нових команд',order:1,calendar_era:'after_founding',from_year:61},
 {id:'fifth',label:'Доба П’ятої Хокаґе',order:2,calendar_era:'after_founding',from_year:62},
 {id:'akatsuki',label:'Епоха Акацукі',order:3,calendar_era:'after_founding',from_year:64},
];
const segments=heading.segments(periods,{current_year:61,view_start_year:61,days_per_year:365});

test('the incoming epoch pushes the pinned name at the calendar boundary and reverses exactly',()=>{
 const at=left=>heading.layout(segments,left,day=>(day-left)*10,200,600);
 assert.equal(at(300)[0].x,0);
 assert.equal(at(350).length,2);
 assert.equal(at(350)[0].x,-66);
 assert.equal(at(350)[1].x,150);
 assert.equal(at(365)[0].id,'fifth');assert.equal(at(365)[0].x,0);
 assert.equal(at(364)[0].id,'teams');assert.equal(at(364)[0].x,-206);
 assert.equal(at(350)[0].x,-66);
 assert.equal(at(300)[0].x,0);
 // January of year 63 keeps the same era. Only year 64 starts the next one.
 assert.equal(at(730)[0].id,'fifth');assert.equal(at(1095)[0].id,'akatsuki');
});

test('a dated boundary inside a year overrides the coarse year estimate',()=>{
 const within=heading.segments([periods[0],{...periods[1],from_year:61,boundary_date:{year:61,month:7,day:1}}],{current_year:61,days_per_year:365});
 assert.equal(within[1].start,181);
 const layout=day=>heading.layout(within,day,d=>(d-day)*10,200,600);
 assert.equal(layout(180)[0].id,'teams');assert.equal(layout(181)[0].id,'fifth');
});

test('reduced motion keeps a single stationary, readable epoch name',()=>{
 const rows=heading.layout(segments,364,day=>(day-364)*10,200,600,true);
 assert.equal(rows.length,1);assert.equal(rows[0].x,0);assert.equal(rows[0].id,'teams');
 const next=heading.layout(segments,365,()=>0,200,600,true);
 assert.equal(next[0].id,'fifth');assert.equal(next[0].x,0);
});
