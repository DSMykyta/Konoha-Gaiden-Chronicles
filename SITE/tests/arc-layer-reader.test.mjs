import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const start=app.indexOf('function storyPoint(kind,id){');
const end=app.indexOf('function navigateStory(kind,id){',start);
assert(start>=0&&end>start,'The arc reader must expose its story-point builder');
const storyPointSource=app.slice(start,end);

function fixture(activeSceneIds){
 const allScenes=[
  {id:'scene-canon',day:10,position:10,group:[{id:'canon-event',physical:['naruto']}]},
  {id:'scene-project',day:20,position:20,group:[{id:'project-event',physical:['ren']}]},
  {id:'scene-second-canon',day:30,position:30,group:[{id:'second-canon-event',physical:['sakura']}]}
 ];
 const env={
  arcMap:new Map([['arc', {id:'arc',title:'Test arc',redirect_ids:['old-arc']}]]),
  episodeMap:new Map([
   ['ep-canon',{id:'ep-canon',arc_id:'arc',title:'Canon'}],
   ['ep-project',{id:'ep-project',arc_id:'arc',title:'Project'}],
   ['ep-second-canon',{id:'ep-second-canon',arc_id:'arc',title:'Second canon'}]
  ]),
  sceneMap:new Map([
   ['scene-canon',{episode_id:'ep-canon'}],
   ['scene-project',{episode_id:'ep-project'}],
   ['scene-second-canon',{episode_id:'ep-second-canon'}]
  ]),
  orderedScenes:()=>allScenes.filter(scene=>activeSceneIds.includes(scene.id)),
  storyNodeCast:group=>[...new Set(group.flatMap(event=>event.physical||[]))],
  selected:new Set(['naruto','ren','sakura'])
 };
 return vm.runInNewContext(storyPointSource+';storyPoint',env);
}

test('arc readers show only enabled episodes, including in counts and navigation',()=>{
 const storyPoint=fixture(['scene-canon','scene-second-canon']);
 const arc=storyPoint('arc','arc');
 assert(arc);
 assert.deepEqual(Array.from(arc.sourceEpisodeIds),['ep-canon','ep-second-canon']);
 assert.equal(arc.childCount,2);
 assert.equal(arc.group.length,2);
 assert.deepEqual(Array.from(arc.group,event=>event.id),['canon-event','second-canon-event']);
 assert.equal(storyPoint('episode','ep-project'),null,'a filtered-out episode cannot be navigated to');
});

test('readers retain registry order with every layer active',()=>{
 const storyPoint=fixture(['scene-canon','scene-project','scene-second-canon']);
 const arc=storyPoint('arc','old-arc');
 assert.deepEqual(Array.from(arc.sourceEpisodeIds),['ep-canon','ep-project','ep-second-canon']);
 assert.equal(arc.rawId,'arc');
 assert.equal(arc.childCount,3);
});

test('a completely filtered arc does not produce an empty reader',()=>{
 const storyPoint=fixture([]);
 assert.equal(storyPoint('arc','arc'),null);
});
