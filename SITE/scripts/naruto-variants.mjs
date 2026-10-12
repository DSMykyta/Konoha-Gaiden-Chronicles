// Explicit editorial alternative: Naruto is absent in B/V arcs by default.
// Original anime moments and character involvement are retained losslessly.
const clone=value=>JSON.parse(JSON.stringify(value));
const replaceName=(text,name)=>typeof text==='string'?text.replace(/Нарутові|Нарутом|Наруту|Наруто|Naruto/g,name)
 .replaceAll(name+' й '+name,name).replaceAll(name+', '+name,name)
 .replaceAll(name+' та '+name,name):text;
export function adaptNarutoScene(original,policy,eventOverrides={},sceneOverrides={}){
 if(!policy)return original;
 const scene=clone(original),name=policy.substitute_name,id=policy.substitute_id;
 scene.naruto_original={title:scene.title,description:scene.description??null};
 scene.naruto_variant='without_naruto';
 scene.title=sceneOverrides[scene.id]?.title||replaceName(scene.title,name);
 if(scene.description!==undefined)scene.description=replaceName(scene.description,name);
 for(const e of scene.events||[]){
  e.naruto_original={title:e.title,text:e.text,involvement:clone(e.involvement||[])};
  e.naruto_variant='without_naruto';
  e.title=replaceName(e.title,name);
  e.text=replaceName(e.text,name);
  let changed=false;
  e.involvement=(e.involvement||[]).map(i=>{
   if(i.entity_id!=='c-naruto')return i;
   changed=true;return {...i,entity_id:id};
  });
  const override=eventOverrides[e.id];
  if(override){
   if(override.title)e.title=override.title;
   if(override.text)e.text=override.text;
   if(override.remove_entities)e.involvement=e.involvement.filter(i=>!override.remove_entities.includes(i.entity_id));
   for(const extra of override.add_entities||[])if(!e.involvement.some(i=>i.entity_id===extra))e.involvement.push({entity_id:extra,role:'participant',mode:'physical'});
  }
  const seen=new Set();
  e.involvement=e.involvement.filter(i=>{const key=i.entity_id+':'+i.mode;if(seen.has(key))return false;seen.add(key);return true});
  if(e.involvement.some(i=>i.entity_id==='c-naruto'))throw Error('Naruto remains in alternate moment: '+e.id);
  if(/Наруто|Naruto/.test(e.title+' '+e.text))throw Error('Naruto remains in alternate prose: '+e.id);
  if(/Ґамабунт/.test(e.title+' '+e.text))throw Error('Gamabunta needs manual rewrite: '+e.id);
 }
 if(/Наруто|Naruto/.test(scene.title+' '+(scene.description||'')))throw Error('Naruto remains in alternate scene: '+scene.id);
 return scene;
}
export function originalParticipants(involvement){
 const physical=(involvement||[]).filter(i=>['physical','physical_hidden'].includes(i.mode)&&i.role!=='mentioned').map(i=>i.entity_id);
 const tracks=(involvement||[]).filter(i=>i.role!=='mentioned'&&i.mode!=='remote').map(i=>i.entity_id);
 return {physical,tracks};
}
