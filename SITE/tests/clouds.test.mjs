import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const clouds=vm.runInNewContext(fs.readFileSync(new URL('../public/story-clouds.js',import.meta.url),'utf8')+';StoryClouds');

const scenes=new Map([
 ['class',{id:'class',episode_id:'formation',title:'Клас Академії'}],
 ['outside',{id:'outside',episode_id:'jonin',title:'Джоніни надворі'}],
 ['raido',{id:'raido',episode_id:'evaluation',title:'Зустріч із Райдо'}]
]);
const episodes=new Map(['formation','jonin','evaluation'].map(id=>[id,{id,title:id}]));
const nodes=[{id:'class-1',x:100,y:240,day:21,scene:scenes.get('class')},{id:'class-2',x:150,y:245,day:21.05,scene:scenes.get('class')},{id:'outside',x:100,y:300,day:21,scene:scenes.get('outside')},{id:'raido',x:240,y:250,day:21.1,scene:scenes.get('raido')}].map(node=>({...node,kind:'moment',sourceEpisodeIds:[node.scene.episode_id]}));

test('cloud ownership separates simultaneous scenes and leaves every data coordinate unchanged',()=>{
 const original=structuredClone(nodes),groups=clouds.groups(nodes,'moment',scenes,episodes),sceneGroups=groups.filter(g=>g.kind==='scene');
 assert.equal(sceneGroups.length,3);assert.equal(groups.filter(g=>g.kind==='episode').length,3);
 const classroom=sceneGroups.find(g=>g.id==='class');assert.equal(classroom.parentId,'formation');assert.deepEqual(Array.from(classroom.nodes,n=>n.id),['class-1','class-2']);
 assert.equal(sceneGroups.find(g=>g.id==='outside').parentId,'jonin');assert.equal(sceneGroups.find(g=>g.id==='raido').parentId,'evaluation');
 for(const group of groups)for(const point of group.nodes){const original=nodes.find(n=>n.id===point.id);assert.equal(point.x,original.x);assert.equal(point.y,original.y);}
 assert.deepEqual(nodes,original);
});

test('scene scale groups visible scene anchors under their episode without rearranging the graph',()=>{
 const groups=clouds.groups(nodes,'scene',scenes,episodes);assert.equal(groups.length,3);assert(groups.every(g=>g.kind==='episode'&&!g.faint));
 assert.equal(groups.find(g=>g.id==='formation').nodes.length,2);assert.equal(clouds.groups(nodes,'arc',scenes,episodes).length,0);
});

test('distant parts do not fill an empty span and foreign markers remain outside their cloud',()=>{
 const own=[{id:'a',x:0,y:0},{id:'b',x:64,y:0},{id:'c',x:600,y:0}],foreign=[{id:'foreign',x:32,y:25}],parts=clouds.parts(own);
 assert.equal(parts.length,2);assert.equal(parts[0].length,2);
 const balls=clouds.influences(own,34);
 for(const point of own)assert(clouds.field(point.x,point.y,balls,foreign)>.62);
 assert.equal(clouds.field(32,25,balls,foreign),0);assert(clouds.field(300,0,balls,foreign)<.01);
 const contours=parts.flatMap(part=>clouds.contours(part,foreign));assert(contours.length>=2);assert(contours.every(loop=>loop.length>3&&loop.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))));
 const before=JSON.stringify(own),animated=clouds.contours(parts[0],foreign,34,Math.PI/2);assert.notEqual(JSON.stringify(animated),JSON.stringify(clouds.contours(parts[0],foreign,34,0)));assert.equal(JSON.stringify(own),before);
});
