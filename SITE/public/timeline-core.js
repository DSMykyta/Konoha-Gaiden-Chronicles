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
  sceneLayout(nodes,relations=[],owner={},middle=0,amplitude=100) {
    if(!nodes.length)return new Map();
    const byId=new Map(nodes.map(n=>[n.id,n])),edges=new Map(nodes.map(n=>[n.id,new Map()])),baseRef=ref=>typeof ref==='string'?(ref.endsWith('.start')?ref.slice(0,-6):ref.endsWith('.end')?ref.slice(0,-4):ref):ref;
    const sceneOf=ref=>{const id=baseRef(ref);return owner[id]||id;};
    const connect=(a,b,w)=>{if(a===b||!byId.has(a)||!byId.has(b))return;edges.get(a).set(b,(edges.get(a).get(b)||0)+w);edges.get(b).set(a,(edges.get(b).get(a)||0)+w);};
    // Character continuity is the primary "story gravity": consecutive scenes sharing a
    // physical character want to stay on the same visual stream.
    const byCharacter=new Map();
    for(const n of nodes)for(const id of n.layoutCast||[]){if(!byCharacter.has(id))byCharacter.set(id,[]);byCharacter.get(id).push(n);}
    for(const list of byCharacter.values()){
      list.sort((a,b)=>a.day-b.day||a.id.localeCompare(b.id));
      for(let i=1;i<list.length;i++){const a=list[i-1],b=list[i],distance=Math.max(.05,b.day-a.day),w=2.8/Math.sqrt(1+distance*.18);connect(a.id,b.id,w);}
    }
    // Explicit chronology and cross-scene observations add extra gravity without
    // changing X/time. Accepted observations/intersections are strongest.
    for(const r of relations){
      const a=sceneOf(r.a),b=sceneOf(r.b);if(a===b)continue;
      let w=0;
      if(r.review==='accepted')w=r.kind==='observes'||r.kind==='intersects'?5:r.kind==='before'?2.4:0;
      else if(r.kind==='before')w=.8;
      if(w)connect(a,b,w);
    }
    const sorted=[...nodes].sort((a,b)=>a.day-b.day||a.id.localeCompare(b.id)),y=new Map();
    for(const n of sorted){
      const prior=[...edges.get(n.id)].map(([id,w])=>[byId.get(id),w]).filter(([m])=>m&&m.day<=n.day&&y.has(m.id));
      if(prior.length){const total=prior.reduce((s,[,w])=>s+w,0);y.set(n.id,prior.reduce((s,[m,w])=>s+y.get(m.id)*w,0)/total+(this.seed(n.id+'lane')-.5)*.035);}
      else y.set(n.id,(this.seed(n.id+'lane')-.5)*1.35);
    }
    // One-dimensional force relaxation. Connected story streams attract; unrelated
    // scenes that occupy the same time window repel, so branches split and can later
    // converge again when their casts meet.
    for(let pass=0;pass<72;pass++){
      const delta=new Map(nodes.map(n=>[n.id,0]));
      for(const n of nodes){
        for(const [otherId,w] of edges.get(n.id)){if(n.id>otherId)continue;const d=(y.get(otherId)-y.get(n.id))*.018*Math.min(6,w);delta.set(n.id,delta.get(n.id)+d);delta.set(otherId,delta.get(otherId)-d);}
      }
      for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
        const a=nodes[i],b=nodes[j],time=Math.abs(a.day-b.day);if(time>1.15)continue;
        const shared=(a.layoutCast||[]).some(id=>(b.layoutCast||[]).includes(id)),linked=edges.get(a.id).has(b.id);
        const wanted=shared||linked?.12:.34,dy=y.get(b.id)-y.get(a.id),distance=Math.abs(dy);
        if(distance>=wanted)continue;
        const direction=distance>.008?Math.sign(dy):(this.seed(a.id+'|'+b.id)<.5?-1:1),strength=(wanted-distance)*(shared||linked?.018:.045)*(1-time/1.2);
        delta.set(a.id,delta.get(a.id)-direction*strength);delta.set(b.id,delta.get(b.id)+direction*strength);
      }
      for(const n of nodes)y.set(n.id,Math.max(-1,Math.min(1,y.get(n.id)+delta.get(n.id))));
    }
    // Strong lane continuity: same calendar day + same physical location + a large
    // cast overlap is one continuing story stream even if another scene branches
    // between them. Keep those scenes on practically the same horizontal lane.
    for(let pass=0;pass<4;pass++){
      for(let i=0;i<sorted.length;i++)for(let j=i+1;j<sorted.length;j++){
        const a=sorted[i],b=sorted[j];
        if(a.calendarDay!==b.calendarDay||!a.locationId||a.locationId!==b.locationId)continue;
        const ac=a.layoutCast||[],bc=b.layoutCast||[];if(!ac.length||!bc.length)continue;
        const shared=ac.filter(id=>bc.includes(id)).length,overlap=shared/Math.min(ac.length,bc.length);
        if(shared<3||overlap<.55)continue;
        const mean=(y.get(a.id)+y.get(b.id))/2;
        y.set(a.id,mean);y.set(b.id,mean);
      }
    }
    // Normalize only enough to use the available vertical field; preserve relative
    // proximity so a connected branch still reads as one stream.
    const values=[...y.values()],lo=Math.min(...values),hi=Math.max(...values),span=Math.max(.55,hi-lo);
    const out=new Map();
    for(const n of nodes){const normalized=(y.get(n.id)-(lo+hi)/2)/span*1.7;out.set(n.id,middle+Math.max(-.92,Math.min(.92,normalized))*amplitude);}
    return out;
  },
  strand(anchors,id,middle,amplitude,lead=1,pixelsPerDay=24) {
    if(!anchors.length)return [];
    // Fade into the first recorded scene, then connect scenes directly. Organic
    // wandering is based on visible horizontal room: close nodes stay clean,
    // while long spans get a broad, low-frequency drift instead of a sharp hump.
    const first=anchors[0],last=anchors.at(-1),ends=[{day:Math.max(0,first.day-lead),y:first.y+(this.seed(id+'start')-.5)*amplitude*.65,id:'start'},...anchors.map(p=>({...p,node:true})),{day:Math.min(365,last.day+lead),y:last.y+(this.seed(id+'end')-.5)*amplitude*.65,id:'end'}],points=[];
    for(let i=0;i<ends.length-1;i++){
      const a=ends[i],b=ends[i+1],gap=b.day-a.day;points.push(a);
      if(gap<1e-8)continue;
      const pixelGap=gap*Math.max(1,pixelsPerDay),wander=Math.max(0,Math.min(1,(pixelGap-90)/260));
      if(!wander)continue;
      const controls=Math.max(1,Math.ceil(pixelGap/180)-1);
      const primary=(this.seed(id+':'+a.id+':'+b.id+':drift')-.5)*amplitude*.48*wander;
      const secondary=(this.seed(id+':'+a.id+':'+b.id+':wave')-.5)*amplitude*.18*wander;
      for(let j=1;j<=controls;j++){
        const t=j/(controls+1),envelope=Math.sin(Math.PI*t),offset=envelope*(primary+secondary*Math.sin(Math.PI*2*t));
        points.push({day:a.day+gap*t,y:a.y+(b.y-a.y)*t+offset});
      }
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
