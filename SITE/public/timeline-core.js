'use strict';
const TimelineCore = {
  ordered(events) { return [...events].sort((a,b) => (a.day ?? Infinity)-(b.day ?? Infinity) || (a.display_rank||0)-(b.display_rank||0) || a.id.localeCompare(b.id)); },
  selectable(entities, events) { const ids=new Set(events.flatMap(e=>e.tracks)); return entities.filter(e=>['person','animal'].includes(e.kind)&&ids.has(e.id)); },
  fullName(entity, profile) { return profile?.display_name || entity?.aliases?.find(a=>/^[А-ЯІЇЄҐ]/.test(a)&&a.split(/\s+/).length>1) || entity?.name || entity?.id || ''; },
  scenes(events) {
    const grouped=new Map();
    for(const e of this.ordered(events)){if(!grouped.has(e.scene_id))grouped.set(e.scene_id,[]);grouped.get(e.scene_id).push(e);}
    const days=new Map();
    return [...grouped].map(([id,group])=>({id,group,day:group[0].day})).map(s=>{if(!days.has(s.day))days.set(s.day,[]);days.get(s.day).push(s);return s;}).map(s=>({...s,position:s.day===null?null:s.day+.08+.84*(days.get(s.day).indexOf(s)+.5)/days.get(s.day).length}));
  },
  navigation(events, currentId, day) {
    const list=this.ordered(events.filter(e=>e.day!==null));
    const index=list.findIndex(e=>e.id===currentId);
    if(index>=0)return {previous:list[index-1]||null,next:list[index+1]||null,index,total:list.length};
    const nextIndex=list.findIndex(e=>e.day>=day);
    return {previous:nextIndex===-1?list.at(-1)||null:list[nextIndex-1]||null,next:nextIndex===-1?null:list[nextIndex],index:-1,total:list.length};
  }
};
if(typeof module!=='undefined')module.exports=TimelineCore;
