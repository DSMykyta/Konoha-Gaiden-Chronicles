import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const core=vm.runInNewContext(fs.readFileSync(new URL('../public/timeline-core.js',import.meta.url),'utf8')+';TimelineCore');

test('busy days stay as wide as quiet days, preserving exact calendar inverses',()=>{
 const scenes=Array.from({length:11},(_,i)=>({id:'s'+i,day:21})).concat({id:'next',day:22});
 const axis=core.timeAxis(scenes);
 assert.equal(axis.dayToAxis(22)-axis.dayToAxis(21),1);
 assert.equal(axis.dayToAxis(23)-axis.dayToAxis(22),1);
 for(const day of [0,17.5,21,21.08,21.5,21.98,22.5,187.5,364.9,365])assert(Math.abs(axis.axisToDay(axis.dayToAxis(day))-day)<1e-8);
 assert(axis.dayToAxis(21.2)<axis.dayToAxis(21.3));
 assert.equal(axis.length,axis.dayToAxis(365));
});

test('equal-width dates retain both sides of compressed gaps and round trip after them',()=>{
 const axis=core.timeAxis([{day:21},{day:21},{day:73},{day:73},{day:200}], [{from:35,to:66,omitted:31},{from:100,to:190,omitted:90}]);
 for(const gap of axis.breaks){assert.equal(axis.dayToAxis(gap.from),axis.dayToAxis(gap.to));assert.equal(axis.axisToDay(gap.axis,'before'),gap.from);assert.equal(axis.axisToDay(gap.axis),gap.to);}
 for(const day of [21.7,73.5,96.4,192.5,200.5,365])assert(Math.abs(axis.axisToDay(axis.dayToAxis(day))-day)<1e-8);
});

test('multi-year time axes preserve year boundaries through dense and compressed days',()=>{
 const axis=core.timeAxis([{day:21},{day:21},{day:365},{day:365},{day:400}],[{from:100,to:350,omitted:250}],.85,730);
 for(const day of [0,21.5,364.9,365,365.8,400,729.9,730])assert(Math.abs(axis.axisToDay(axis.dayToAxis(day))-day)<1e-8);
 assert.equal(axis.length,axis.dayToAxis(730));
 assert.equal(axis.dayToAxis(366)-axis.dayToAxis(365),1);
});

test('all moments of a sequential scene precede the next scene without interleaving',()=>{
 const scenes=[{id:'a',day:21,position:21.2,group:Array.from({length:20},(_,i)=>({id:'a'+i}))},{id:'b',day:21,position:21.3,group:[{id:'b0'},{id:'b1'}]},{id:'observer',day:21,position:21.3,group:[{id:'o'}]},{id:'c',day:21,position:21.7,group:[{id:'c'}]}];
 const positions=core.momentPositions(scenes),a=scenes[0].group.map(event=>positions.get(event.id)),b=scenes[1].group.map(event=>positions.get(event.id));
 assert(a.every((position,i)=>!i||position>a[i-1]));
 assert(Math.max(...a)<Math.min(...b));assert(Math.max(...b)<positions.get('c'));
 assert.equal(positions.get('o'),21.3);
 assert([...positions.values()].every(day=>day>21&&day<22));
});

test('strands reach late-year anchors beyond the former 365-unit canvas limit',()=>{
 const route=core.strand([{id:'a',day:450,y:100},{id:'b',day:500,y:110}],'late',100,100,1,10,600);
 assert.equal(route.at(-1).day,501);
 assert(route.some(point=>point.node&&point.id==='b'&&point.day===500));
 assert(route.every((point,i)=>!i||point.day>=route[i-1].day));
});

test('different story groups can share a character while retaining separate clusters',()=>{
 const nodes=[{id:'a',day:21.1,layoutGroup:'one'},{id:'b',day:21.2,layoutGroup:'one'},{id:'c',day:21.3,layoutGroup:'two'},{id:'d',day:21.4,layoutGroup:'two'}].map(node=>({...node,layoutCast:['shared'],calendarDay:21,locationId:'class'}));
 const before=structuredClone(nodes),y=core.sceneLayout(nodes,[],{},0,100);
 assert(Math.abs(y.get('a')-y.get('b'))<25);assert(Math.abs(y.get('c')-y.get('d'))<25);
 assert(Math.abs(y.get('b')-y.get('c'))>60);
 assert.deepEqual(nodes,before);
 const again=core.sceneLayout(nodes,[],{},0,100);assert.deepEqual(Array.from(again),Array.from(y));
});
