import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const root=new URL('../public/',import.meta.url),data=JSON.parse(fs.readFileSync(new URL('data.json',root),'utf8'));
const sceneMap=new Map(data.scenes.map(s=>[s.id,s])),episodeMap=new Map(data.episodes.map(e=>[e.id,e])),arcMap=new Map(data.arcs.map(a=>[a.id,a]));
const app=fs.readFileSync(new URL('app.js',root),'utf8'),context=vm.createContext({sceneMap,episodeMap,arcMap,selected:new Set(data.entities.map(e=>e.id))});
const layout=vm.runInContext(fs.readFileSync(new URL('story-layout.js',root),'utf8')+';StoryLayout',context);
const core=vm.runInContext(fs.readFileSync(new URL('timeline-core.js',root),'utf8')+';TimelineCore',context);
vm.runInContext(app.slice(app.indexOf('function sceneCast'),app.indexOf('function actionCount'))+app.slice(app.indexOf('function storyNodeCast'),app.indexOf('function semanticOwner')),context);
const scenes=core.scenes(data.events.filter(e=>e.continuity==='main'&&e.scene_state!=='inactive'),[...data.links,...data.scenes.flatMap(s=>s.relations||[])],data.scenes).filter(s=>s.day!==null);
const makeNodes=(level,members)=>{context.members=members;return vm.runInContext(`semanticNodes('${level}',members)`,context);};
const inside=(a,b)=>a.x>=b.x-.01&&a.y>=b.y-.01&&a.x+a.width<=b.x+b.width+.01&&a.y+a.height<=b.y+b.height+.01;
const overlaps=(a,b)=>Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>.01&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>.01;

test('moments stay within the ordered scene interval, including the dense school day',()=>{
 const nodes=makeNodes('moment',scenes);
 for(const day of new Set(scenes.map(s=>s.day))){
  const onDay=scenes.filter(s=>s.day===day).sort((a,b)=>a.position-b.position);
  for(let i=1;i<onDay.length;i++){
   const a=onDay[i-1],b=onDay[i];if(a.position===b.position)continue;
   assert(Math.max(...nodes.filter(n=>n.sourceSceneIds[0]===a.id).map(n=>n.day))<Math.min(...nodes.filter(n=>n.sourceSceneIds[0]===b.id).map(n=>n.day)),`${a.id} interleaves with ${b.id}`);
  }
 }
});
test('single-child containers keep their authoritative type and parent IDs',()=>{
 const exterior=scenes.filter(s=>s.id==='sc-y0-0122-academy-exterior-jonin');
 assert.equal(makeNodes('scene',exterior)[0].kind,'scene');
 assert.equal(makeNodes('episode',exterior)[0].kind,'episode');
 assert.equal(makeNodes('arc',exterior)[0].kind,'arc');
});
for(const width of [320,375,812,1440])test(`reserved labels and source children fit nested regions at ${width}px`,()=>{
 const days=[21,...[...new Set(scenes.map(s=>s.day))].sort((a,b)=>scenes.filter(s=>s.day===b).length-scenes.filter(s=>s.day===a).length).slice(0,3)];
 for(const day of new Set(days)){
  const members=scenes.filter(s=>s.day===day),nodes=makeNodes('moment',members).map(node=>({...node,x:40+(node.day-day)*(width-80)}));
  const result=layout.layout(nodes,{width,top:180,level:'moment',sceneMap,episodeMap,arcMap});
  assert.equal(result.nodes.length,nodes.length);const registry=new Map(result.regions.map(r=>[r.key,r]));
  for(const node of result.nodes){
   assert(Number.isFinite(node.x)&&Number.isFinite(node.y));assert(node.label.lines.length);
   assert(node.bounds.x>=0&&node.bounds.x+node.bounds.width<=width);
   assert(inside(node.bounds,registry.get(node.parentKey).bounds),`${node.id} escapes its scene`);
   assert.equal(node.parentKey,'scene:'+node.sourceSceneIds[0]);
  }
  for(let i=0;i<result.nodes.length;i++)for(let j=i+1;j<result.nodes.length;j++)assert(!overlaps(result.nodes[i].bounds,result.nodes[j].bounds),'Visible title boxes overlap');
  for(const region of result.regions){
   if(region.parentKey)assert(inside(region.bounds,registry.get(region.parentKey).bounds),`${region.key} escapes its parent`);
   const own=new Set(region.nodes.map(n=>n.id));
   for(const node of result.nodes)assert.equal(inside(node.bounds,region.bounds),own.has(node.id),`${region.key} contains a foreign child ${node.id}`);
  }
 }
});
test('expanding the first day of Team 9 reveals its two scenes and six preserved moments',()=>{
 const members=scenes.filter(s=>sceneMap.get(s.id).episode_id==='ep-y0-team9-introduction'),nodes=makeNodes('scene',members).map(n=>({...n,x:80+(n.day-21)*250}));
 const result=layout.layout(nodes,{width:375,level:'scene',sceneMap,episodeMap,arcMap,scope:{kind:'episode',id:'ep-y0-team9-introduction'}});
 assert.equal(result.nodes.length,2);assert.equal(result.regions.length,1);
 assert.equal(result.regions[0].kind,'episode');assert.equal(result.regions[0].title,'Перший день Команди 9');
 assert.equal(result.nodes.reduce((sum,n)=>sum+n.group.length,0),6);
});
