import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const moduleSource=fs.readFileSync(new URL('../public/timeline-capsules.js',import.meta.url),'utf8');
const capsule=vm.runInNewContext(moduleSource+';TimelineCapsules');
const map=new Map([['class',{episode_id:'formation'}],['corridor',{episode_id:'formation'}],['outside',{episode_id:'outside'}]]);
const episodes=new Map([['formation',{arc_id:'arc-formation'}],['outside',{arc_id:'arc-formation'}]]);

test('arc color is stable through arc episode scene and moment',()=>{
 const nodes=[
  {kind:'arc',rawId:'arc-formation'},
  {kind:'episode',story:{arc_id:'arc-formation'}},
  {kind:'scene',scene:map.get('class')},
  {kind:'moment',scene:map.get('class')}
 ];
 const ids=nodes.map(n=>capsule.arcId(n,map,episodes));
 assert.deepEqual(ids,['arc-formation','arc-formation','arc-formation','arc-formation']);
 assert.equal(new Set(ids.map(id=>capsule.palette(id).solid)).size,1);
 assert.notEqual(capsule.palette('arc-formation').solid,capsule.palette('another-arc').solid);
});

test('interval width reflects elapsed time while a one-moment scene remains a capsule',()=>{
 const px=v=>v*60;
 const b=capsule.bounds({kind:'scene',x:330,y:100,spanStart:4,spanEnd:8},px,x=>x);
 assert.equal(b.width,240);
 assert.equal(b.x,210);
 const one=capsule.bounds({kind:'scene',x:330,y:100,spanStart:4,spanEnd:4},px,x=>x);
 assert.equal(one.width,44);
 assert.equal(one.timeStatus,'point-or-unresolved');
 const parent=capsule.bounds({kind:'episode',x:330,y:100,spanStart:1,spanEnd:10},px,x=>x);
 assert.equal(parent.width,540);
});

test('moment zoom draws one-scene capsule even when only one moment exists',()=>{
 const scene={group:[{id:'event'}],spanStart:4,spanEnd:4};
 const projected=new Map([['event',{x:100,y:120}]]);
 const b=capsule.sceneBackdrop(scene,projected,x=>x*50,x=>x);
 assert.equal(b.width,44);
 assert.equal(b.y,107);
});

test('connectors cannot join unrelated episodes or unverified different places',()=>{
 const a={id:'a',kind:'scene',scene:{episode_id:'formation'},locationId:'class',day:10};
 const b={id:'b',kind:'scene',scene:{episode_id:'formation'},locationId:'class',day:11};
 const c={id:'c',kind:'scene',scene:{episode_id:'outside'},locationId:'class',day:12};
 const rects=new Map([[a.id,{x:0,y:0,width:50,height:24}],[b.id,{x:54,y:0,width:50,height:24}],[c.id,{x:108,y:0,width:50,height:24}]]);
 const links=capsule.sceneConnections([a,b,c],map,episodes,rects,[]);
 assert.equal(links.length,1);
 assert.equal(links[0].episode,'formation');
 assert.equal(links[0].mode,'joined');
 assert.equal(links[0].arcId,'arc-formation');
 assert.equal(capsule.sceneConnections([a,{...b,locationId:null}],map,episodes,rects,[]).length,0);
});

test('different locations join only with accepted direct before; long gaps never join',()=>{
 const a={id:'a',kind:'scene',scene:{episode_id:'formation'},locationId:'class',day:10};
 const b={id:'b',kind:'scene',scene:{episode_id:'formation'},locationId:'hall',day:11};
 const boxes=new Map([['a',{x:0,y:0,width:50,height:24}],['b',{x:55,y:30,width:55,height:24}]]);
 const accepted=[{kind:'before',review:'accepted',a:'a',b:'b'}];
 assert.equal(capsule.sceneConnections([a,b],map,episodes,boxes,accepted)[0].mode,'branch');
 assert.equal(capsule.sceneConnections([a,b],map,episodes,boxes,[{...accepted[0],review:'pending'}]).length,0);
 boxes.get('b').x=130;
 assert.equal(capsule.sceneConnections([a,b],map,episodes,boxes,accepted).length,0);
});
