import fs from 'node:fs';
import vm from 'node:vm';

/* Run after npm --prefix SITE run build.
   Checks story provenance before the Chunin exam without inventing
   manga evidence or overwriting the user's roleplay text. */
const read=name=>fs.readFileSync(new URL(name,import.meta.url),'utf8');
const StoryLayers=vm.runInNewContext(read('../public/story-layers.js')+';StoryLayers');
const data=JSON.parse(read('../public/data.json'));
const arcMap=new Map(data.arcs.map(a=>[a.id,a])),byScene=new Map();
for(const event of data.events){
 if(!byScene.has(event.scene_id))byScene.set(event.scene_id,[]);
 byScene.get(event.scene_id).push(event);
}
const year=data.calendar.current_year;
const early=data.scenes.filter(scene=>scene.date?.year===year&&scene.date?.month<=6&&scene.state!=='inactive');
const canonMask={canon:true,filler:false,sources:false,project:false},issues=[],review=[];
const projectNames=/Кіт[ауіи]|Рен[ау]?|Сор[аиу]|Хаяші|Команд[а-яії]+ 9/u;
let count=0;
for(const scene of early){
 const events=byScene.get(scene.id)||[],arc=arcMap.get(scene.arc_id);
 const canonical=events.filter(e=>StoryLayers.classify(e,arc?.kind)==='canon');
 for(const event of events){
  count++;
  const layer=StoryLayers.classify(event,arc?.kind);
  if(layer===null)review.push('Нерозмічений момент: '+event.id);
  if(layer==='canon'){
   const participants=(event.physical||[]).filter(id=>['c-kita','c-ren','c-sora'].includes(id));
   if(participants.length)issues.push('Авторські учасники в канонічному моменті: '+event.id+' / '+participants.join(', '));
   for(const field of ['title','text','prose']){
    const value=StoryLayers.compose(event[field]||'',canonMask);
    if(projectNames.test(value))issues.push('Авторський текст у каноні: '+event.id+'.'+field);
   }
  }
  if(event.origin==='A'&&!event.layer&&arc?.kind==='canonical')
   review.push('Аніме-момент в основній арці без окремого доказу манґи: '+event.id);
 }
 if(canonical.length){
  const clean=StoryLayers.compose(scene.description||'',canonMask);
  if(projectNames.test(clean))issues.push('Сцена містить авторський опис у каноні: '+scene.id);
 }
}
const getId=event=>event.id;
const all=StoryLayers.select(data.events.filter(e=>e.continuity==='main'&&e.scene_state!=='inactive'),StoryLayers.ALL,e=>arcMap.get(e.arc_id)?.kind);
const counts={};
for(const key of StoryLayers.keys)counts[key]=StoryLayers.select(all,Object.fromEntries(StoryLayers.keys.map(k=>[k,k===key])),e=>arcMap.get(e.arc_id)?.kind).length;
console.log('До іспиту ('+year+', січень–червень): '+early.length+' сцен, '+count+' моментів.');
console.log('Активні шари всієї хронології: '+JSON.stringify(counts));
console.log('Помилки змішаних канонічних записів: '+issues.length);
for(const issue of issues.slice(0,80))console.log('  ПОМИЛКА '+issue);
console.log('Пункти для подальшої редакторської перевірки: '+review.length);
for(const item of review.slice(0,30))console.log('  АУДИТ '+item);
if(process.argv.includes('--strict')&&issues.length)process.exitCode=1;
