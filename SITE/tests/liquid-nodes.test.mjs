import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const liquid=vm.runInNewContext(
 fs.readFileSync(new URL('../public/liquid-nodes.js',import.meta.url),'utf8')+';LiquidNodes'
);

test('all four narrative levels render the same round material with size only as hierarchy',()=>{
 assert.deepEqual(['moment','scene','episode','arc'].map(kind=>liquid.radius(kind)),[7,11,15,20]);
 assert.equal(liquid.radius('arc-cluster'),24);
 assert.equal(liquid.radius('moment',true),11);
});

test('nearby sibling moments make one smooth temporary neck, unrelated moments do not',()=>{
 const a={id:'a',kind:'moment',x:40,y:90,opacity:1};
 const b={id:'b',kind:'moment',x:55,y:93,opacity:1};
 const unrelated={id:'c',kind:'moment',x:49,y:91,opacity:1};
 const original=JSON.stringify([a,b,unrelated]);
 const connections=liquid.connections([a,b,unrelated],[{nodes:[a,b]}]);
 assert.equal(connections.length,1);
 assert.equal(connections[0].a.id,'a');
 assert.equal(connections[0].b.id,'b');
 const path=liquid.neck(connections[0]);
 assert.match(path,/^M.* C.* L.* C.* Z$/);
 assert(!/NaN|Infinity/.test(path));
 assert.equal(JSON.stringify([a,b,unrelated]),original,'optical merger must never change the timeline coordinates');
});

test('faraway droplets do not connect, and a hierarchy transition may form a neck',()=>{
 const fine={id:'fine',kind:'scene',x:120,y:220,opacity:.72};
 const parent={id:'parent',kind:'episode',x:145,y:218,opacity:.72};
 const distant={id:'distant',kind:'scene',x:500,y:220,opacity:1};
 assert.equal(liquid.connections([fine,distant],[{nodes:[fine,distant]}]).length,0);
 const bridges=[{key:'fine',toX:145,toY:218,strength:.8}];
 assert.equal(liquid.connections([fine,parent],[],bridges).length,1);
 assert.equal(liquid.connections([fine,parent],[],[{...bridges[0],strength:0}]).length,0);
});

test('refracted line uses the original smooth curve but bends only within the lens',()=>{
 const route=[{day:0,y:80},{day:100,y:80}],point={id:'lens',kind:'arc',x:50,y:80};
 const original=JSON.stringify(route);
 const curveY=()=>80;
 const d=liquid.refract(route,point,curveY);
 assert.match(d,/^M\d/);
 assert(d.includes(' L'));
 assert(!/NaN|Infinity/.test(d));
 assert.notEqual(d,'');
 assert.equal(liquid.refract(route,{...point,y:200},curveY),'');
 assert.equal(JSON.stringify(route),original);
});

test('inactive/hidden marks do not build physical necks',()=>{
 const a={id:'a',kind:'scene',x:40,y:80,opacity:.02},b={id:'b',kind:'scene',x:52,y:80,opacity:1};
 assert.equal(liquid.connections([a,b],[{nodes:[a,b]}]).length,0);
});
