/** Validate source parents before computing any UI aggregates. */
export function validateHierarchy({arcs,episodes,scenes,periods}) {
 const registry=(items,label)=>{
  const map=new Map();
  for(const item of items){
   if(!item.id||map.has(item.id))throw new Error(`Missing or duplicate ${label} ID: ${item.id}`);
   if(label!=='period'&&(!item.title||!item.continuity_id))throw new Error(`Missing ${label} metadata: ${item.id}`);
   map.set(item.id,item);
  }
  return map;
 };
 const arcMap=registry(arcs,'arc'),episodeMap=registry(episodes,'episode'),periodMap=registry(periods,'period');
 const sceneMap=registry(scenes,'scene'),allIds=new Set();
 for(const items of [arcs,episodes,scenes])for(const item of items){
  if(allIds.has(item.id))throw new Error(`ID reused across hierarchy: ${item.id}`);allIds.add(item.id);
 }
 const episodeMembers=new Set(),arcMembers=new Set();
 for(const arc of arcs){
  if(!periodMap.has(arc.period_id))throw new Error(`Unknown period for arc ${arc.id}: ${arc.period_id}`);
  if(!['canonical','adaptation','project','alternate'].includes(arc.kind))throw new Error(`Unknown arc kind: ${arc.id}`);
  if('episode_ids' in arc)throw new Error(`Derived episode_ids in source arc: ${arc.id}`);
 }
 for(const episode of episodes){
  const arc=arcMap.get(episode.arc_id);
  if(!arc)throw new Error(`Unknown arc for episode ${episode.id}: ${episode.arc_id}`);
  if(arc.continuity_id!==episode.continuity_id)throw new Error(`Arc continuity mismatch: ${episode.id}`);
  if('scene_ids' in episode)throw new Error(`Derived scene_ids in source episode: ${episode.id}`);
  arcMembers.add(arc.id);
 }
 for(const scene of sceneMap.values()){
  const episode=episodeMap.get(scene.episode_id);
  if(!episode)throw new Error(`Missing or unknown episode for scene ${scene.id}: ${scene.episode_id}`);
  if(episode.continuity_id!==scene.continuity_id)throw new Error(`Episode continuity mismatch: ${scene.id}`);
  if('arc_id' in scene)throw new Error(`Redundant arc_id in source scene: ${scene.id}`);
  episodeMembers.add(episode.id);
 }
 for(const e of episodes)if(!episodeMembers.has(e.id))throw new Error(`Empty episode: ${e.id}`);
 for(const a of arcs)if(!arcMembers.has(a.id))throw new Error(`Empty arc: ${a.id}`);
}
