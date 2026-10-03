// Working reservations include travel and recovery absent from plotted scenes.
const identity=id=>id==='c-guy'?'c-might-guy':id;
export function physicalParticipants(scene){
 return new Set((scene.events||[]).flatMap(e=>(e.involvement||[])
  .filter(i=>['physical','physical_hidden'].includes(i.mode)&&i.role!=='mentioned')
  .map(i=>identity(i.entity_id))));
}
export function validateMissionWindows(plan,scenes,entities=[]){
 const active=scenes.filter(s=>s.state==='active'&&s.day!==null);
 const byId=new Map(active.map(s=>[s.id,s]));
 const entityMap=new Map(entities.map(e=>[e.id,e]));
 const neutral=new Set(plan.neutral_scene_ids||[]);
 const fail=message=>{throw new Error('Mission calendar: '+message);};
 for(const [id,day] of Object.entries(plan.scene_days)){
  if(!byId.has(id)||byId.get(id).day!==day)fail('stale scene placement '+id);
 }
 for(const w of plan.arcs){
  if(!(w.occupied_start<=w.start&&w.start<=w.end&&w.end<=w.occupied_end))fail('invalid range '+w.arc_id);
  if(w.occupied_end!==w.end+w.return_days+w.rest_days)fail('invalid return/recovery '+w.arc_id);
  const cast=new Set(w.actors.map(identity));
  for(const id of w.scene_ids){
   const s=byId.get(id);
   if(!s||s.arc_id!==w.arc_id||s.day<w.start||s.day>w.end)fail('scene outside its mission '+id);
  }
  for(const s of active){
   if(s.arc_id===w.arc_id||neutral.has(s.id)||s.day<w.occupied_start||s.day>w.occupied_end)continue;
   const common=[...physicalParticipants(s)].filter(id=>cast.has(id));
   if(common.length)fail(`${s.id} borrows ${common.join(', ')} during ${w.arc_id}, including travel/recovery`);
  }
 }
 for(let i=0;i<plan.arcs.length;i++)for(const b of plan.arcs.slice(i+1)){
  const a=plan.arcs[i],shared=b.actors.map(identity).filter(id=>a.actors.map(identity).includes(id));
  if(shared.length&&a.occupied_start<=b.occupied_end&&b.occupied_start<=a.occupied_end)fail(`${a.arc_id} overlaps ${b.arc_id}: ${shared}`);
 }
 function local(location){
  const seen=new Set();while(location&&!seen.has(location)){
   if(location==='loc-konohagakure')return true;
   seen.add(location);location=entityMap.get(location)?.parent_id;
  }return false;
 }
 for(const c of plan.constraints||[])for(const s of active){
  if(s.day<c.start||s.day>c.end||(c.allow_scene_ids||[]).includes(s.id)||neutral.has(s.id))continue;
  const cast=physicalParticipants(s);if(!c.actors.map(identity).some(id=>cast.has(id)))continue;
  // Local preparation does not block ordinary daily life in the village.
  const newAssignment=plan.arcs.some(w=>w.arc_id===s.arc_id&&w.actors.map(identity).some(id=>c.actors.map(identity).includes(id)));
  if(!local(s.location_id)||(c.kind!=='local_preparation'&&newAssignment))fail(`${s.id} violates ${c.id}`);
 }
}
