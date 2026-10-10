import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const core=vm.runInNewContext(fs.readFileSync(new URL('../public/timeline-core.js',import.meta.url),'utf8')+';TimelineCore');

test('character routes are computed once and reused by future virtual windows',()=>{
 const start=app.indexOf(' ids.forEach(id=>{',app.indexOf('function render(){'));
 const end=app.indexOf('  const coordinates=routes.map(',start);
 assert(start>=0&&end>start);
 const fragment=app.slice(start,end);
 const one={id:'one',day:10,calendarDay:10,y:155,group:[{day:10,physical:['hero']}]};
 const two={id:'two',day:14,calendarDay:14,y:175,group:[{day:14,physical:['hero']}]};
 const cache=new Map(),observed=[];
 const env={
  ids:['hero'],nodesByCharacter:new Map([['hero',[one,two]]]),
  globalNodes:[one,two],strandRouteCache:cache,
  layoutKey:'scene:700:1200:12:125:0',lead:2,pixelsPerDay:40,
  mid:400,amplitude:125,TimelineCore:core,dayToAxis:day=>day,
  axisLength:()=>365,allEvents:[],buffered:{coverLo:5,coverHi:20},observed
 };
 const evaluate=vm.runInNewContext('(function(){'+fragment+'observed.push({anchors,lifetimes,routes}); });})',env);
 let calls=0;
 const original=core.strand;
 core.strand=function(...args){calls++;return original.apply(this,args);};
 try {
  evaluate();
  const initial=calls;
  assert(initial>0,'the initial geometry must actually be prepared');
  env.buffered={coverLo:10,coverHi:23};
  evaluate();
  assert.equal(calls,initial,'switching the camera window must not recompute the curves');
  assert.equal(cache.size,1);
  assert.equal(observed[0].routes[0],observed[1].routes[0],'same exact route object must be reused');
 } finally {core.strand=original;}
});

test('new source data invalidates cached routes and pan frame',()=>{
 assert(app.includes('semanticNodeCache.clear();strandRouteCache.clear();panFrame=null;'));
});
