'use strict';
// Flat semantic capsules. The X axis is always the existing timeline calendar.
// Geography affects Y / connections; it never changes timestamps.
const IntervalCapsules={
 hash(text){let h=2166136261;for(const c of String(text||'unassigned'))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;},
 color(arcId){
  const hue=this.hash(arcId||'unassigned')%360;
  return {fill:`hsl(${hue},58%,80%)`,stroke:`hsl(${hue},43%,39%)`,dot:`hsl(${hue},65%,46%)`};
 },
 arcFor(node,sceneMap,episodeMap){
  if(node.arcId)return node.arcId;
  if(node.kind==='arc')return node.rawId||node.id.replace(/^arc:/,'');
  const sceneId=node.scene?.id||node.sourceSceneIds?.[0];
  const episodeId=node.kind==='episode'?(node.rawId||node.id.replace(/^episode:/,'')):node.scene?.episode_id||node.sourceEpisodeIds?.[0]||sceneMap?.get(sceneId)?.episode_id;
  return episodeMap?.get(episodeId)?.arc_id||null;
 },
 // Use explicit times when available, rather than making intervals wider
 // just because they contain more moments. A minimum is only a hit/display size.
 rect(node,px,level){
  const start=Number.isFinite(node.spanStart)?node.spanStart:node.day;
  const end=Number.isFinite(node.spanEnd)?node.spanEnd:node.day;
  const offset=node.x-px(node.day);
  const left=Math.min(px(start),px(end))+offset,right=Math.max(px(start),px(end))+offset;
  const minimum=level==='arc'?12:level==='episode'?18:level==='scene'?16:8;
  // Springs change only screen-space geometry. The true source span stays
  // constant, and endpoints return exactly to calendar time after the morph.
  const raw=Math.max(0,Math.min(1,node.capsuleScale??1));
  const spring=Math.max(0,Math.min(1,raw+Math.sin(Math.PI*raw)*Math.sin(4*Math.PI*raw)*.055));
  const width=Math.max(minimum,(right-left)*spring);
  const center=(left+right)/2*spring+node.x*(1-spring);
  const height=level==='arc'?35:level==='episode'?29:24;
  return {x:center-width/2,y:node.y-height/2,width,height,
   estimated:(right-left)<minimum,from:start,to:end};
 },
 build(nodes,level,sceneMap,episodeMap,geography,px,opacity=1){
  let groups=new Map();
  if(level==='moment'){
   for(const n of nodes){
    if(n.kind!=='moment')continue;
    const id=n.sourceSceneIds?.[0]||n.scene?.id;
    if(!id)continue;
    if(!groups.has(id))groups.set(id,[]);
    groups.get(id).push(n);
   }
   // One narrative scene may physically visit several Academy rooms.
   // At moment zoom draw separate same-scene location segments rather than
   // assigning the entire scene a fictitious single location.
   const split=new Map();
   for(const [sceneId,members] of groups){
    const sites=new Set(members.map(n=>n.locationId).filter(Boolean));
    if(sites.size<=1){split.set(sceneId,members);continue;}
    for(const n of members){
     const key=sceneId+'@'+(n.locationId||'unknown');
     if(!split.has(key))split.set(key,[]);
     split.get(key).push(n);
    }
   }
   groups=split;
  }else{
   for(const n of nodes)if(n.kind===level)groups.set(n.id,[n]);
  }
  const capsules=[];
  for(const [id,members] of groups){
   if(!members.length)continue;
   const first=members[0],sceneId=level==='moment'?first.sourceSceneIds?.[0]||id:id,
    meta=level==='moment'?sceneMap.get(sceneId):first.scene;
   const episodeId=level==='moment'?meta?.episode_id:
    level==='scene'?first.scene?.episode_id||first.sourceEpisodeIds?.[0]:
    level==='episode'?first.rawId||first.id.replace(/^episode:/,''):null;
   const arcId=level==='arc'?(first.rawId||first.id.replace(/^arc:/,'')):episodeMap.get(episodeId)?.arc_id||this.arcFor(first,sceneMap,episodeMap);
   const base=level==='moment'?{
    ...first,day:members.reduce((s,n)=>s+n.day,0)/members.length,
    x:members.reduce((s,n)=>s+n.x,0)/members.length,
    y:members.reduce((s,n)=>s+n.y,0)/members.length,
    spanStart:Math.min(...members.map(n=>Number.isFinite(n.spanStart)?n.spanStart:n.day)),
    spanEnd:Math.max(...members.map(n=>Number.isFinite(n.spanEnd)?n.spanEnd:n.day)),
    capsuleScale:first.capsuleScale
   }:first;
   const kind=level==='moment'?'scene':level;
   const rect=this.rect(base,px,kind);
   const locationId=level==='moment'?meta?.location_id||first.locationId||null:
    level==='scene'?first.locationId:null;
   const locationIds=level==='episode'?(first.group?.length?
    first.group.map(event=>event.location_id||sceneMap.get(event.scene_id||first.sourceSceneIds?.[0])?.location_id||null):
    (first.sourceSceneIds||[]).map(sceneId=>sceneMap.get(sceneId)?.location_id||null)):[locationId];
   capsules.push({...rect,id:level==='moment'?id:first.id,kind,arcId,episodeId,
    locationId,locationIds,colors:this.color(arcId),opacity:(first.opacity??1)*opacity,
    momentIds:members.flatMap(n=>n.group||[]).map(e=>e.id)});
  }
  // Only siblings may be joined. Different episodes never touch merely
  // because a character continues into the next story.
  const links=[];
  const compatible=(a,b)=>a.locationIds.length&&b.locationIds.length&&
   a.locationIds.every(from=>from&&b.locationIds.every(to=>{
    if(!to)return false;
    const grade=geography?.relation(from,to)?.grade;
    return Number.isFinite(grade)&&grade<=2;
   }));
  if(level==='scene'||level==='moment'){
   const byEpisode=new Map();
   for(const c of capsules){
    if(!c.episodeId)continue;
    if(!byEpisode.has(c.episodeId))byEpisode.set(c.episodeId,[]);
    byEpisode.get(c.episodeId).push(c);
   }
   for(const siblings of byEpisode.values()){
    const sorted=siblings.sort((a,b)=>a.from-b.from||a.x-b.x||a.id.localeCompare(b.id));
    for(let i=1;i<sorted.length;i++){
     const b=sorted[i];
     let winner=null,score=Infinity;
     for(let j=0;j<i;j++){
      const a=sorted[j],timeGap=Math.max(0,b.from-a.to),gapPx=Math.abs(b.x-(a.x+a.width));
      if(b.from<a.from-1e-8||timeGap>1.25||!compatible(a,b))continue;
      const grade=geography?.relation(a.locationId,b.locationId)?.grade;
      const proximity=grade===null||grade===undefined?2:grade;
      const value=gapPx+Math.abs((a.y+a.height/2)-(b.y+b.height/2))*.45+proximity*18;
      if(value<score){winner=a;score=value;}
     }
     if(!winner)continue;
     const ax=winner.x+winner.width,ay=winner.y+winner.height/2;
     const bx=b.x,by=b.y+b.height/2;
     // A long hiatus remains a gap, not a fictional continuous scene.
     const distance=Math.hypot(bx-ax,by-ay);
     if(distance>180)continue;
     links.push({from:winner.id,to:b.id,x1:ax,y1:ay,x2:bx,y2:by,
      stroke:b.colors.stroke,opacity:Math.min(winner.opacity,b.opacity)});
    }
   }
  }
  if(level==='episode'){
   // Episodes of an arc may approach one another during zoom, but do not
   // acquire a bridge across an unrecorded interval.
   const byArc=new Map();
   for(const c of capsules){if(!c.arcId)continue;if(!byArc.has(c.arcId))byArc.set(c.arcId,[]);byArc.get(c.arcId).push(c);}
   for(const group of byArc.values()){
    group.sort((a,b)=>a.from-b.from||a.id.localeCompare(b.id));
    for(let i=1;i<group.length;i++){
     const a=group[i-1],b=group[i],gap=Math.max(0,b.x-(a.x+a.width));
     if(gap>26||b.from-a.to>1.05||!compatible(a,b)||Math.hypot(b.x-a.x-a.width,b.y+b.height/2-a.y-a.height/2)>180)continue;
     links.push({from:a.id,to:b.id,x1:a.x+a.width,y1:a.y+a.height/2,x2:b.x,y2:b.y+b.height/2,
      stroke:b.colors.stroke,opacity:Math.min(a.opacity,b.opacity)});
    }
   }
  }
  return {capsules,links};
 }
};
if(typeof module!=='undefined')module.exports=IntervalCapsules;
