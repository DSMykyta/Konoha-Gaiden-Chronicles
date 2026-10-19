'use strict';
// Flat, calendar-aware interval capsules. Pure geometry; no story mutation.
const TimelineCapsules = {
 hash(id){let h=2166136261;for(const c of String(id||'unassigned'))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;},
 palette(id){
  // One deterministic identity color per ARC, regardless of the current zoom.
  const hue=this.hash(id)%360;
  return {solid:`hsl(${hue} 65% 45%)`,soft:`hsl(${hue} 65% 45% / .16)`,middle:`hsl(${hue} 65% 45% / .24)`,strong:`hsl(${hue} 65% 45% / .32)`};
 },
 arcId(node,scenes,episodes){
  if(node.kind==='arc')return node.rawId||node.id.replace(/^arc:/,'');
  if(node.kind==='episode')return node.story?.arc_id||episodes.get(node.rawId)?.arc_id||null;
  const scene=node.scene||scenes.get(node.scene_id)||scenes.get(node.sourceSceneIds?.[0]);
  return episodes.get(scene?.episode_id)?.arc_id||null;
 },
 // The primary X-axis is never changed here. Minimum touch width is a visual
 // affordance, not evidence that a one-moment scene lasted that many minutes.
 bounds(node,px,dayToAxis,minWidths={scene:44,episode:62,arc:82}){
  const from=node.spanStart,to=node.spanEnd;
  const hasSpan=Number.isFinite(from)&&Number.isFinite(to)&&to>from;
  const rawWidth=hasSpan?Math.max(0,px(dayToAxis(to))-px(dayToAxis(from))):0;
  const minWidth=minWidths[node.kind]||36,width=Math.max(minWidth,rawWidth);
  const startX=hasSpan?px(dayToAxis(from)):node.x;
  const endX=hasSpan?px(dayToAxis(to)):node.x;
  const centerX=hasSpan?(startX+endX)/2:node.x,half=width/2;
  const height=node.kind==='arc'?40:node.kind==='episode'?32:node.kind==='scene'?26:18;
  return {x:centerX-half,y:node.y-height/2,width,height,rx:Math.min(height/2,13),
   timeStatus:hasSpan?(rawWidth>=minWidth?'projected-interval':'visual-minimum'):'point-or-unresolved'};
 },
 // Day scale keeps every one-moment scene as a capsule behind its moment dot.
 sceneBackdrop(scene,positions,px,dayToAxis){
  const items=scene.group.map(event=>positions.get(event.id)).filter(Boolean);
  if(!items.length)return null;
  const xs=items.map(p=>p.x),ys=items.map(p=>p.y);
  const from=scene.spanStart,to=scene.spanEnd,calendarWidth=Number.isFinite(from)&&Number.isFinite(to)&&to>from
   ?Math.max(0,px(dayToAxis(to))-px(dayToAxis(from))):0;
  const width=Math.max(44,Math.max(...xs)-Math.min(...xs)+24,calendarWidth+16);
  return {x:(Math.min(...xs)+Math.max(...xs)-width)/2,y:ys.reduce((s,y)=>s+y,0)/ys.length-13,width,height:26,rx:12};
 },
 // Only scene pairs from the same EPISODE may get an interval connector.
 // A before link is ordering evidence, not proof of an uninterrupted activity:
 // connectors are short, local, and never jump across a large calendar gap.
 sceneConnections(nodes,sceneMap,episodes,boundsById,relations=[]){
  const byEpisode=new Map();
  for(const node of nodes){
   if(node.kind!=='scene')continue;
   const ep=node.scene?.episode_id||sceneMap.get(node.id)?.episode_id;
   if(!ep)continue;
   if(!byEpisode.has(ep))byEpisode.set(ep,[]);
   byEpisode.get(ep).push(node);
  }
  const before=new Set(relations.filter(r=>r.review==='accepted'&&r.kind==='before').map(r=>r.a+'>'+r.b));
  const result=[];
  for(const [episode,items] of byEpisode){
   items.sort((a,b)=>a.day-b.day||a.id.localeCompare(b.id));
   for(let i=0;i<items.length-1;i++){
    const a=items[i],b=items[i+1],r1=boundsById.get(a.id),r2=boundsById.get(b.id);
    if(!r1||!r2)continue;
    const gap=r2.x-(r1.x+r1.width),maxGap=16;
    if(gap>maxGap||gap< -r1.width*.65)continue;
    // Broad or unresolved geographic assignments are not proof of physical
    // adjacency. Require accepted precise scene-level location reviews.
    const placeA=a.scene||sceneMap.get(a.id),placeB=b.scene||sceneMap.get(b.id);
    const samePlace=!!a.locationId&&a.locationId===b.locationId&&
     placeA?.review?.location==='accepted'&&placeB?.review?.location==='accepted';
    const linked=before.has(a.id+'>'+b.id);
    // A shared episode alone is not evidence for a solid join between
    // unrelated subplots; same place or an accepted direct link is required.
    if(!samePlace&&!linked)continue;
    const from={x:r1.x+r1.width,y:r1.y+r1.height/2};
    const to={x:r2.x,y:r2.y+r2.height/2};
    result.push({episode,arcId:episodes.get(episode)?.arc_id,from,to,
     mode:samePlace?'joined':'branch',evidence:linked?'before':'same-place'});
   }
  }
  return result;
 }
};
if(typeof module!=='undefined')module.exports=TimelineCapsules;
