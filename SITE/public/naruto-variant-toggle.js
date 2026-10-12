'use strict';
const NarutoArcToggle=(()=>{
 const copy=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
 const cast=involvement=>({
  physical:(involvement||[]).filter(i=>['physical','physical_hidden'].includes(i.mode)&&i.role!=='mentioned').map(i=>i.entity_id),
  tracks:(involvement||[]).filter(i=>i.role!=='mentioned'&&i.mode!=='remote').map(i=>i.entity_id)
 });
 function set(data,arcId,include){
  const arc=(data.arcs||[]).find(a=>a.id===arcId);
  if(!arc?.naruto_optional)throw Error('Naruto option unavailable for '+arcId);
  const scenes=new Map((data.scenes||[]).filter(s=>s.arc_id===arcId).map(s=>[s.id,s]));
  for(const episode of (data.episodes||[]).filter(e=>e.arc_id===arcId&&e.naruto_original)){
   if(!episode.naruto_absent)episode.naruto_absent={title:episode.title};
   episode.title=include?episode.naruto_original.title:episode.naruto_absent.title;
   episode.naruto_variant=include?'with_naruto':'without_naruto';
  }
  for(const scene of scenes.values()){
   if(!scene.naruto_original)continue;
   if(!scene.naruto_absent)scene.naruto_absent=copy({title:scene.title,description:scene.description});
   const variant=include?scene.naruto_original:scene.naruto_absent;
   scene.title=variant.title;
   if(variant.description===undefined||variant.description===null)delete scene.description;else scene.description=variant.description;
   scene.naruto_variant=include?'with_naruto':'without_naruto';
  }
  for(const event of (data.events||[]).filter(e=>e.arc_id===arcId&&e.naruto_original)){
   if(!event.naruto_absent)event.naruto_absent=copy({
    title:event.title,text:event.text,involvement:event.involvement,physical:event.physical,tracks:event.tracks,scene_title:event.scene_title
   });
   if(include){
    const orig=event.naruto_original;
    event.title=orig.title;event.text=orig.text;event.involvement=copy(orig.involvement);
    Object.assign(event,cast(event.involvement));
   }else{
    const alt=event.naruto_absent;
    for(const key of ['title','text','involvement','physical','tracks','scene_title'])event[key]=copy(alt[key]);
   }
   event.scene_title=scenes.get(event.scene_id)?.title||event.scene_title;
   event.naruto_variant=include?'with_naruto':'without_naruto';
  }
  return include;
 }
 return {set,cast};
})();
if(typeof module!=='undefined')module.exports=NarutoArcToggle;
