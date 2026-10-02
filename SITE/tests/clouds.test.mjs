import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../public/story-clouds.js',import.meta.url),'utf8');
const clouds=vm.runInNewContext(source+';StoryClouds');

const scenes=new Map([
 ['class',{id:'class',episode_id:'formation',title:'Клас Академії'}],
 ['outside',{id:'outside',episode_id:'jonin',title:'Джоніни надворі'}],
 ['raido',{id:'raido',episode_id:'evaluation',title:'Зустріч із Райдо'}]
]);
const episodes=new Map(['formation','jonin','evaluation'].map(id=>[id,{id,title:id}]));
const nodes=[{id:'class-1',x:100,y:240,day:21,scene:scenes.get('class')},{id:'class-2',x:150,y:245,day:21.05,scene:scenes.get('class')},{id:'outside',x:100,y:300,day:21,scene:scenes.get('outside')},{id:'raido',x:240,y:250,day:21.1,scene:scenes.get('raido')}].map(node=>({...node,kind:'moment',group:[{id:node.id}],sourceSceneIds:[node.scene.id],sourceEpisodeIds:[node.scene.episode_id]}));

test('moment scale groups sibling moments without redundant singleton clouds or moving anchors',()=>{
 const original=structuredClone(nodes),groups=clouds.groups(nodes,'moment',scenes,episodes),sceneGroups=groups.filter(g=>g.kind==='scene');
 assert.equal(groups.filter(g=>g.kind==='moment').length,0);
 assert.equal(sceneGroups.length,1);
 assert.equal(groups.filter(g=>g.kind==='episode').length,0);
 const classroom=sceneGroups.find(g=>g.id==='class');
 assert.equal(classroom.parentId,'formation');
 assert.deepEqual(Array.from(classroom.nodes,n=>n.id),['class-1','class-2']);
 assert.equal(classroom.parts.length,1);
 for(const group of groups)for(const point of group.nodes){const originalPoint=nodes.find(n=>n.id===point.id);assert.equal(point.x,originalPoint.x);assert.equal(point.y,originalPoint.y);}
 assert.deepEqual(nodes,original);
 assert.notEqual(clouds.palette('moment','class-1').top,clouds.palette('moment','class-2').top);
});

test('scene scale keeps each scene cloud inside an episode cloud',()=>{
 const groups=clouds.groups(nodes,'scene',scenes,episodes);
 assert.equal(groups.filter(g=>g.kind==='scene').length,1);
 assert.equal(groups.filter(g=>g.kind==='episode').length,0);
 assert.equal(groups.filter(g=>g.kind==='moment').length,0);
 assert.equal(groups.find(g=>g.kind==='scene'&&g.id==='class').nodes.length,2);
 assert.equal(clouds.groups(nodes,'arc',scenes,episodes).length,0);
});

test('all moments of one scene are bridged into one continuous organic cloud',()=>{
 const own=[{id:'a',x:0,y:0},{id:'b',x:64,y:5},{id:'c',x:600,y:0}],foreign=[{id:'foreign',x:32,y:25}],parts=clouds.parts(own);
 assert.equal(parts.length,1);assert.equal(parts[0].length,3);
 assert(clouds.bridgePoints(own,48,'scene').length>0);
 const balls=clouds.influences(own,48,0,'scene');
 for(const point of own)assert(clouds.field(point.x,point.y,balls,foreign)>.62);
 assert.equal(clouds.field(32,25,balls,foreign),0);
 assert(clouds.field(300,0,balls,[])>.62);
 const contours=clouds.contours(own,[],48,0,8,'scene');
 assert.equal(contours.length,1);
 assert(contours[0].length>3&&contours[0].every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
 const before=JSON.stringify(own),animated=clouds.contours(own,[],48,Math.PI/2,8,'scene');
 assert.notEqual(JSON.stringify(animated),JSON.stringify(contours));assert.equal(JSON.stringify(own),before);
});

test('cloud titles preserve anchors, stay near their group and reuse their placement',()=>{
 const points=[{id:'a',kind:'moment',x:130,y:220},{id:'b',kind:'moment',x:190,y:230}],before=structuredClone(points),cache=new Map();
 const groups=[{key:'scene:a',id:'a',kind:'scene',title:'Зустріч у класі',nodes:points}];
 const first=clouds.labels(groups,points,375,150,550,cache),again=clouds.labels(groups,points,375,150,550,cache);
 assert.equal(first.length,1);assert.deepEqual(points,before);
 assert.deepEqual(JSON.parse(JSON.stringify(again)),JSON.parse(JSON.stringify(first)));
 const label=first[0];assert(label.y>=150&&label.y+label.height<=550);assert(label.x>=16&&label.x+label.width<=359);
 assert(Math.abs(label.y-label.anchor.y)<120);
});

test('overfull title placement never moves nodes or extends the map with detached labels',()=>{
 const points=Array.from({length:12},(_,i)=>({id:'p'+i,kind:'scene',x:160,y:200+i*20})),before=structuredClone(points);
 const groups=points.map(point=>({key:point.id,id:point.id,kind:'scene',title:'Назва послідовної сцени',nodes:[point]}));
 const labels=clouds.labels(groups,points,320,160,460);
 assert.deepEqual(points,before);assert(labels.length<groups.length);
 assert(labels.every(label=>label.y>=160&&label.y+label.height<=460));
});
