import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const StoryLayers=vm.runInNewContext(fs.readFileSync(new URL('../public/story-layers.js',import.meta.url),'utf8')+';StoryLayers');
const data=JSON.parse(fs.readFileSync(new URL('../public/data.json',import.meta.url),'utf8'));
const core=vm.runInNewContext(fs.readFileSync(new URL('../public/timeline-core.js',import.meta.url),'utf8')+';TimelineCore');
const events=data.events.filter(e=>e.continuity==='main'&&e.scene_state!=='inactive');
const arcs=new Map(data.arcs.map(a=>[a.id,a]));
const mode=state=>StoryLayers.select(events,state,e=>arcs.get(e.arc_id)?.kind);
const only=key=>Object.fromEntries(StoryLayers.keys.map(k=>[k,k===key]));
const id=id=>events.find(e=>e.id===id);
const scene=id=>data.scenes.find(s=>s.id===id);
test('four independent layers begin enabled',()=>{
 assert.deepEqual(Array.from(StoryLayers.keys),['canon','filler','sources','project']);
 assert.deepEqual(Object.values(StoryLayers.ALL),[true,true,true,true]);
 assert.equal(mode(only('canon')).some(e=>e.id==='ev-y0-0119-naruto-studies-scroll'),true);
});
test('project-only arcs and cross-layer moments never mix ownership',()=>{
 const manga=id('ev-y0-0315-hiruzen-assigns-tazuna');
 const project=id('ev-y0-0315-team9-witnesses-tazuna-mission');
 assert(manga&&project);assert.equal(manga.origin,'M');assert.equal(project.origin,'P');
 assert.equal(manga.scene_id,project.scene_id);
 assert(['c-kita','c-ren','c-sora','c-raido'].every(name=>!manga.physical.includes(name)));
 assert(['c-kita','c-ren','c-sora','c-raido'].every(name=>project.physical.includes(name)));
 assert(mode(only('canon')).some(e=>e.id===manga.id));
 assert(!mode(only('canon')).some(e=>e.id===project.id));
 assert(!mode(only('project')).some(e=>e.id===manga.id));
 assert(mode(only('project')).some(e=>e.id===project.id));
});
test('Academy narration removes all project-only assertions from canon mode',()=>{
 const s=scene('sc-y0-0122-academy-waiting'),e=id('ev-y0-0122-team7-announced');
 assert(s&&e);
 const actual=StoryLayers.compose(s.description,only('canon'));
 assert(!/Кіта|Райдо|Рен|Сора|Команд[ауи] 9/.test(actual));
 assert(!StoryLayers.compose(e.prose,only('canon')).includes('Кіта'));
 assert(StoryLayers.compose(s.description,StoryLayers.ALL).includes('Райдо'));
});
test('three source categories have independent examples before Chunin exams',()=>{
 const material=data.events.find(e=>e.origin==='O'&&e.scene_id==='sc-y0-0124-red-clover');
 const retrospective=data.events.find(e=>e.origin==='R'&&e.scene_id==='sc-y0-0125-nekomata-mission');
 const team9=data.events.find(e=>e.origin==='P'&&e.scene_id==='sc-y0-0123-team9-field9');
 assert(material&&retrospective&&team9);
 assert.equal(StoryLayers.classify(material,arcs.get(material.arc_id)?.kind),'sources');
 assert.equal(StoryLayers.classify(retrospective,arcs.get(retrospective.arc_id)?.kind),'filler');
 assert.equal(StoryLayers.classify(team9,arcs.get(team9.arc_id)?.kind),'project');
 for(const [key,event] of [['sources',material],['filler',retrospective],['project',team9]]){
  assert(mode(only(key)).some(e=>e.id===event.id));
  assert(!mode(only('canon')).some(e=>e.id===event.id));
 }
});
test('filtering before world time removes empty scenes and projects without moving fixed dates',()=>{
 const canon=mode(only('canon')),project=mode(only('project'));
 const cm=core.world(canon,[],data.scenes),pm=core.world(project,[],data.scenes);
 assert(cm.scenes.some(s=>s.id==='sc-y0-0315-tazuna-assignment'));
 assert(!cm.scenes.some(s=>s.id==='sc-y0-0123-team9-field9'));
 assert(pm.scenes.some(s=>s.id==='sc-y0-0123-team9-field9'));
 assert(!pm.scenes.some(s=>s.id==='sc-y0-0119-graduation-exam'));
});
test('turning off every checkbox shows zero moments, not unknown source leakage',()=>{
 assert.equal(mode({canon:false,filler:false,sources:false,project:false}).length,0);
});
test('site controls and readers share one layer mask',()=>{
 const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const search=fs.readFileSync(new URL('../public/search-enhanced.js',import.meta.url),'utf8');
 for(const key of StoryLayers.keys)assert(html.includes('value="'+key+'" checked'));
 assert(app.includes('StoryLayers.select('));
 assert(app.includes('StoryLayers.compose(e.text,storyLayers)'));
 assert(search.includes('StoryLayers.mask(storyLayers)'));
 assert(search.includes('StoryLayers.compose(event.text,storyLayers)'));
});
