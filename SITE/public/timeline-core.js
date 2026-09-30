'use strict';
const TimelineCore = {
  ordered(events) { return [...events].sort((a,b) => (a.day ?? Infinity)-(b.day ?? Infinity) || (a.display_rank||0)-(b.display_rank||0) || a.id.localeCompare(b.id)); },
  selectable(entities, events) { const ids=new Set(events.flatMap(e=>e.tracks)); return entities.filter(e=>['person','animal'].includes(e.kind)&&ids.has(e.id)); },
  fullName(entity, profile) { return profile?.display_name || entity?.aliases?.find(a=>/^[А-ЯІЇЄҐ]/.test(a)&&a.split(/\s+/).length>1) || entity?.name || entity?.id || ''; },
  navigation(events, currentId, day) {
    const list=this.ordered(events.filter(e=>e.day!==null));
    const index=list.findIndex(e=>e.id===currentId);
    if(index>=0)return {previous:list[index-1]||null,next:list[index+1]||null,index,total:list.length};
    const nextIndex=list.findIndex(e=>e.day>=day);
    return {previous:nextIndex===-1?list.at(-1)||null:list[nextIndex-1]||null,next:nextIndex===-1?null:list[nextIndex],index:-1,total:list.length};
  }
};
if(typeof module!=='undefined')module.exports=TimelineCore;
