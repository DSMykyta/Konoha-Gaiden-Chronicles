'use strict';
const TimelineCore = {
  ordered(events) { return [...events].sort((a,b) => (a.day ?? Infinity)-(b.day ?? Infinity) || (a.display_rank||0)-(b.display_rank||0) || a.id.localeCompare(b.id)); },
  selectable(entities, events) { const ids=new Set(events.flatMap(e=>e.tracks)); return entities.filter(e=>['person','animal'].includes(e.kind)&&ids.has(e.id)); },
  fullName(entity, profile) { return profile?.display_name || entity?.aliases?.find(a=>/^[А-ЯІЇЄҐ]/.test(a)&&a.split(/\s+/).length>1) || entity?.name || entity?.id || ''; },
  scenes(events,relations=[],sceneMeta=[]) {
    const grouped=new Map(),meta=new Map(sceneMeta.map(s=>[s.id,s]));
    for(const e of this.ordered(events)){if(!grouped.has(e.scene_id))grouped.set(e.scene_id,[]);grouped.get(e.scene_id).push(e);}
    const days=new Map();
    for(const [id,group] of grouped){const day=group[0].day;if(!days.has(day))days.set(day,[]);days.get(day).push({id,group,day,dayPart:meta.get(id)?.day_part||null});}
    const owner=new Map(events.map(e=>[e.id,e.scene_id])),result=[],dayPartRank={dawn:10,morning:20,noon:30,midday:30,afternoon:40,evening:50};
    for(const [day,list] of days){
      const ids=new Set(list.map(s=>s.id)),edges=new Map(list.map(s=>[s.id,new Set()])),incoming=new Map(list.map(s=>[s.id,0])),soft=[];
      for(const r of relations){if(r.kind!=='before')continue;const a=owner.get(r.a)||r.a,b=owner.get(r.b)||r.b;if(a===b||!ids.has(a)||!ids.has(b))continue;if(r.review==='accepted'){if(edges.get(a).has(b))continue;edges.get(a).add(b);incoming.set(b,incoming.get(b)+1);}else soft.push([a,b]);}
      const remaining=[...list],sorted=[];
      while(remaining.length){
        const candidates=remaining.filter(s=>incoming.get(s.id)===0);
        if(!candidates.length){sorted.push(...remaining);break;}
        let pool=candidates;
        const softTargets=new Set(soft.filter(([a,b])=>candidates.some(s=>s.id===a)&&candidates.some(s=>s.id===b)).map(([,b])=>b));
        const preferred=candidates.filter(s=>!softTargets.has(s.id));if(preferred.length)pool=preferred;
        pool.sort((a,b)=>{const ar=dayPartRank[a.dayPart],br=dayPartRank[b.dayPart];return ar!==undefined&&br!==undefined&&ar!==br?ar-br:remaining.indexOf(a)-remaining.indexOf(b);});
        const s=pool[0],i=remaining.findIndex(x=>x.id===s.id);remaining.splice(i,1);sorted.push(s);for(const b of edges.get(s.id))incoming.set(b,incoming.get(b)-1);
      }
      sorted.forEach((s,i)=>result.push({...s,position:day===null?null:day+.08+.84*(i+.5)/sorted.length}));
    }
    // An accepted observation places two distinct scenes in the same display window.
    // It does not merge their casts or assert an exact hour.
    const sceneById=new Map(result.map(s=>[s.id,s]));
    for(const r of relations){if(r.kind!=='observes'||r.review!=='accepted'||!owner.has(r.a))continue;const a=sceneById.get(owner.get(r.a)),b=sceneById.get(r.b);if(a&&b&&a.id!==b.id&&a.day!==null&&a.day===b.day)b.position=a.position;}
    return result.sort((a,b)=>(a.position??Infinity)-(b.position??Infinity));
  },
  seed(id) { let value=2166136261;for(const c of id){value=Math.imul(value^c.charCodeAt(0),16777619);}return (value>>>0)/4294967296; },
  strand(anchors,id,middle,amplitude,lead=1) {
    if(!anchors.length)return [];
    // Fade into the first recorded scene, then connect scenes directly.
    const first=anchors[0],last=anchors.at(-1),ends=[{day:Math.max(0,first.day-lead),y:first.y+(this.seed(id+'start')-.5)*amplitude*.65,id:'start'},...anchors.map(p=>({...p,node:true})),{day:Math.min(365,last.day+lead),y:last.y+(this.seed(id+'end')-.5)*amplitude*.65,id:'end'}],points=[];
    for(let i=0;i<ends.length-1;i++){
      const a=ends[i],b=ends[i+1];points.push(a);
      if(b.day-a.day<1e-8)continue;
      const steps=Math.max(1,Math.ceil((b.day-a.day)/24));
      for(let j=0;j<steps;j++){const t=(j+.5)/steps,offset=(this.seed(id+':'+a.id+':'+b.id+':'+j)-.5)*amplitude*.65;points.push({day:a.day+(b.day-a.day)*t,y:a.y+(b.y-a.y)*t+offset});}
    }
    points.push(ends.at(-1));return points.filter((p,i,a)=>!i||p.day>a[i-1].day);
  },
  curveY(points,day) {
    if(day<=points[0].day)return points[0].y;if(day>=points.at(-1).day)return points.at(-1).y;
    const slope=i=>{if(points[i].node||points[i].flat)return 0;const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];return b.day===a.day?0:(b.y-a.y)/(b.day-a.day);};
    const i=Math.max(0,points.findIndex(p=>p.day>=day)-1),a=points[i],b=points[i+1]||a,span=b.day-a.day;if(!span)return a.y;
    const t=Math.max(0,Math.min(1,(day-a.day)/span));return (2*t**3-3*t*t+1)*a.y+(t**3-2*t*t+t)*span*slope(i)+(-2*t**3+3*t*t)*b.y+(t**3-t*t)*span*slope(i+1);
  },
  avoid(points,nodes,id,clearance) {
    const route=[...points];
    for(const p of nodes){if(p.day<route[0].day||p.day>route.at(-1).day)continue;const y=this.curveY(route,p.day),delta=y-p.y;if(Math.abs(delta)>=clearance)continue;
      const side=Math.abs(delta)>1?Math.sign(delta):this.seed(id+':'+p.id)<.5?-1:1;
      const bend={day:p.day,y:p.y+side*(clearance+8),flat:true};
      const i=route.findIndex(a=>Math.abs(a.day-p.day)<1e-8);if(i>=0){if(!route[i].node)route[i]=bend;}else route.push(bend);route.sort((a,b)=>a.day-b.day);
    }
    return route;
  },
  navigation(events, currentId, day,relations=[]) {
    const dated=events.filter(e=>e.day!==null),list=relations.length?this.scenes(dated,relations).flatMap(s=>s.group):this.ordered(dated);
    const index=list.findIndex(e=>e.id===currentId);
    if(index>=0)return {previous:list[index-1]||null,next:list[index+1]||null,index,total:list.length};
    const nextIndex=list.findIndex(e=>e.day>=day);
    return {previous:nextIndex===-1?list.at(-1)||null:list[nextIndex-1]||null,next:nextIndex===-1?null:list[nextIndex],index:-1,total:list.length};
  }
};
if(typeof module!=='undefined')module.exports=TimelineCore;
