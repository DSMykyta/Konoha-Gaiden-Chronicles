import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../public/liquid-body.js',import.meta.url),'utf8');
const liquid=vm.runInNewContext(source+';LiquidBody',{
 LiquidNodes:{radius:kind=>({moment:7,scene:11,episode:15,arc:20,'arc-cluster':24})[kind]}
});
const drop=(id,events,x,radius)=>({id,events,x,y:90,radius,kind:radius===11?'scene':'moment',group:events.map(id=>({id}))});

test('small related droplets merge into one body rather than crossfading',()=>{
 const old=[drop('a',['a'],10,7),drop('b',['b'],42,7)];
 const parent=drop('scene',['a','b'],26,11);
 const motion=liquid.plan(old,[parent]);
 assert.equal(motion.length,3);
 assert.equal(motion.filter(p=>p.to.radius===0).length,2);
 assert.equal(motion.find(p=>p.id==='scene').from.radius,0);
 assert.equal(liquid.groups(motion).length,1);
 assert(motion.every(p=>p.to.x===26));
});
test('zooming into parent reverses the same liquid body into two children',()=>{
 const motion=liquid.plan([drop('scene',['a','b'],26,11)],[drop('a',['a'],10,7),drop('b',['b'],42,7)]);
 assert.equal(motion.length,3);
 assert.equal(liquid.groups(motion).length,1);
 assert.equal(motion.filter(p=>p.from.radius===0).length,2);
});
test('unrelated neighboring story droplets cannot merge because they are close',()=>{
 const a=drop('one',['one'],10,7),b=drop('two',['two'],11,7);
 const motion=liquid.plan([a],[b]);
 assert.equal(motion.length,1);
 assert.equal(motion[0].from.radius,7);
 assert.equal(liquid.groups([{events:['one']},{events:['two']}]).length,2);
});
test('capsule branch replaces liquid paint but retains accessible SVG nodes',()=>{
 const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
 const clouds=fs.readFileSync(new URL('../public/story-clouds.js',import.meta.url),'utf8');
 assert(html.indexOf('liquid-body.js?v=')>html.indexOf('liquid-nodes.js?v='));
 assert(html.indexOf('liquid-body.js?v=')<html.indexOf('app.js?v='));
 assert(!app.includes('LiquidBody.update(timeline,renderNodes,zoom)'));
 assert(app.includes('IntervalCapsules.build('));
 assert(html.indexOf('interval-capsules.js?v=')<html.indexOf('app.js?v='));
 assert(app.includes('LiquidBody.visibility()'));
 assert.match(app,/cloudRenderer\.update\(\{groups:\[\],flowBridges:\[\]/);
 assert.match(css,/#timeline\.has-liquid-body \.node \.liquid-depth/);
 assert(clouds.includes("if(group.kind==='arc')continue;"));
 assert(css.includes('.semantic-capsule-layer'));
});
