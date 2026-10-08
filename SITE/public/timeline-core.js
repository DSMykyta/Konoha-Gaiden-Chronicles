'use strict';
const TimelineCore = {
  ordered(events) { return [...events].sort((a,b) => (a.day ?? Infinity)-(b.day ?? Infinity) || (a.display_rank||0)-(b.display_rank||0) || a.id.localeCompare(b.id)); },
  selectable(entities, events) { const ids=new Set(events.flatMap(e=>e.tracks)); return entities.filter(e=>['person','animal'].includes(e.kind)&&ids.has(e.id)); },
  fullName(entity, profile) { return profile?.display_name || entity?.aliases?.find(a=>/^[А-ЯІЇЄҐ]/.test(a)&&a.split(/\s+/).length>1) || entity?.name || entity?.id || ''; },
  scenes(events,relations=[],sceneMeta=[]) {
    const grouped=new Map(),meta=new Map(sceneMeta.map(s=>[s.id,s]));
    for(const e of this.ordered(events)){if(!grouped.has(e.scene_id))grouped.set(e.scene_id,[]);grouped.get(e.scene_id).push(e);}
    const days=new Map();
    for(const [id,group] of grouped){const day=group[0].day;if(!days.has(day))days.set(day,[]);days.get(day).push({id,group,day,dayPart:meta.get(id)?.day_part||null,displayRank:meta.get(id)?.display_rank??null});}
    const owner=new Map(events.map(e=>[e.id,e.scene_id])),result=[],dayPartRank={dawn:10,morning:20,noon:30,midday:30,afternoon:40,evening:50,night:60,late_night:70};
    for(const [day,list] of days){
      const ids=new Set(list.map(s=>s.id)),edges=new Map(list.map(s=>[s.id,new Set()])),incoming=new Map(list.map(s=>[s.id,0])),soft=[];
      for(const r of relations){if(r.kind!=='before')continue;const a=owner.get(r.a)||r.a,b=owner.get(r.b)||r.b;if(a===b||!ids.has(a)||!ids.has(b))continue;
      // Only an end-of-scene -> start-of-scene event link can order
      // both entire scenes. An intermediate event can be interleaved.
      if(owner.has(r.a)&&grouped.get(a)?.at(-1)?.id!==r.a)continue;
      if(owner.has(r.b)&&grouped.get(b)?.[0]?.id!==r.b)continue;
      if(r.review==='accepted'){if(edges.get(a).has(b))continue;edges.get(a).add(b);incoming.set(b,incoming.get(b)+1);}else soft.push([a,b]);}
      const remaining=[...list],sorted=[];
      while(remaining.length){
        const candidates=remaining.filter(s=>incoming.get(s.id)===0);
        if(!candidates.length){sorted.push(...remaining);break;}
        let pool=candidates;
        const softTargets=new Set(soft.filter(([a,b])=>candidates.some(s=>s.id===a)&&candidates.some(s=>s.id===b)).map(([,b])=>b));
        const preferred=candidates.filter(s=>!softTargets.has(s.id));if(preferred.length)pool=preferred;
        pool.sort((a,b)=>{const ar=dayPartRank[a.dayPart],br=dayPartRank[b.dayPart];if(ar!==undefined&&br!==undefined&&ar!==br)return ar-br;if(a.displayRank!==null&&b.displayRank!==null&&a.displayRank!==b.displayRank)return a.displayRank-b.displayRank;return remaining.indexOf(a)-remaining.indexOf(b);});
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
  timeAxis(scenes,breaks=[],spacing=.85,days=365) {
    // A dense calendar day gets more space, once for the whole chronology.
    // Selection, opening a reader, panning and viewport size never change it.
    const counts=new Map();
    for(const scene of scenes)if(Number.isFinite(scene.day))counts.set(Math.floor(scene.day),(counts.get(Math.floor(scene.day))||0)+1);
    const widths=Array.from({length:days},(_,day)=>1+Math.max(0,(counts.get(day)||0)-1)*spacing);
    const prefix=[0];for(const width of widths)prefix.push(prefix.at(-1)+width);
    const weighted=day=>{const whole=Math.max(0,Math.min(days-1,Math.floor(day)));return prefix[whole]+(day-whole)*widths[whole];};
    let removed=0;
    const gaps=breaks.map(gap=>{const size=weighted(gap.to)-weighted(gap.from),axis=weighted(gap.from)-removed;removed+=size;return {...gap,axis,size};});
    const dayToAxis=day=>{let value=weighted(day);for(const gap of gaps){if(day>=gap.to)value-=gap.size;else if(day>gap.from){value-=weighted(day)-weighted(gap.from);break;}else break;}return value;};
    const axisToDay=(axis,side='after')=>{
      let value=axis;
      for(const gap of gaps){if(axis<gap.axis)break;if(Math.abs(axis-gap.axis)<1e-7)return side==='before'?gap.from:gap.to;value+=gap.size;}
      let lo=0,hi=days;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(prefix[mid]<=value)lo=mid;else hi=mid-1;}
      const day=Math.min(days-1,lo);return day+(value-prefix[day])/widths[day];
    };
    return {widths,dayToAxis,axisToDay,breaks:gaps,length:dayToAxis(days)};
  },
  momentPositions(scenes, relations=[]) {
    // An event in a separate story branch can fall between two moments
    // of a longer scene. Never move the entire long scene to satisfy it.
    const days=new Map(),positions=new Map(),owner=new Map(),byId=new Map();
    for(const scene of scenes){
      if(!Number.isFinite(scene.position))continue;
      if(!days.has(scene.day))days.set(scene.day,[]);
      days.get(scene.day).push(scene);
      for(const event of scene.group){owner.set(event.id,scene.id);byId.set(event.id,event);}
    }
    for(const [day,list] of days){
      const source=[...list].sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id));
      const events=source.flatMap(s=>s.group),ids=new Set(events.map(e=>e.id));
      const edges=new Map(events.map(e=>[e.id,new Set()]));
      const incoming=new Map(events.map(e=>[e.id,0]));
      const connect=(a,b)=>{if(!a||!b||a===b||!ids.has(a)||!ids.has(b)||edges.get(a).has(b))return;edges.get(a).add(b);incoming.set(b,incoming.get(b)+1);};
      for(const scene of source)for(let i=1;i<scene.group.length;i++)connect(scene.group[i-1].id,scene.group[i].id);
      const sceneMap=new Map(source.map(s=>[s.id,s]));
      let cross=false;
      for(const r of relations){
        if(r.kind!=='before'||r.review!=='accepted')continue;
        const a=byId.has(r.a)?r.a:sceneMap.get(r.a)?.group.at(-1)?.id;
        const b=byId.has(r.b)?r.b:sceneMap.get(r.b)?.group[0]?.id;
        if(!a||!b||!ids.has(a)||!ids.has(b))continue;
        if(owner.get(a)!==owner.get(b))cross=true;
        connect(a,b);
      }
      if(!cross){
        const slots=[...new Set(source.map(s=>s.position))].sort((a,b)=>a-b);
        for(const scene of source){
          const index=slots.indexOf(scene.position),left=index?(slots[index-1]+scene.position)/2:day+.02,right=index<slots.length-1?(scene.position+slots[index+1])/2:day+.98;
          scene.group.forEach((e,i)=>positions.set(e.id,scene.group.length===1?scene.position:left+(right-left)*(i+.5)/scene.group.length));
        }
        continue;
      }
      const preferred=new Map(events.map((e,i)=>[e.id,i])),remaining=new Set(ids),sorted=[];
      while(remaining.size){
        const ready=[...remaining].filter(id=>incoming.get(id)===0);
        if(!ready.length){
          // Keep deterministic order if imported constraints contradict.
          sorted.push(...[...remaining].sort((a,b)=>preferred.get(a)-preferred.get(b)));
          break;
        }
        ready.sort((a,b)=>preferred.get(a)-preferred.get(b));
        const id=ready[0];remaining.delete(id);sorted.push(id);
        for(const next of edges.get(id))incoming.set(next,incoming.get(next)-1);
      }
      sorted.forEach((id,i)=>positions.set(id,day+.02+.96*(i+.5)/sorted.length));
    }
    return positions;
  },
  separateNodes(nodes,top,bottom,clearance=46) {
    // Time/X stays exact. Separate overlapping hit areas vertically, and use the
    // resulting anchors for both the marks and their character strands.
    const sorted=[...nodes].sort((a,b)=>a.x-b.x||a.id.localeCompare(b.id)),y=new Map(),placed=[];
    for(const n of sorted){
      const wanted=Math.max(top,Math.min(bottom,n.y));let chosen=null;
      const nearby=placed.filter(p=>n.x-p.x<clearance+4);
      for(const spacing of [clearance,40,34,28,26]){
        const intervals=nearby.map(p=>{
          const dx=n.x-p.x,gap=spacing+(n.kind==='arc'||p.kind==='arc'?4:0);
          if(dx>=gap)return null;
          const distance=Math.sqrt(gap*gap-dx*dx),center=y.get(p.id);
          return [center-distance,center+distance];
        }).filter(Boolean);
        const candidates=[wanted,top,bottom,...intervals.flatMap(([a,b])=>[a-.1,b+.1])].filter(v=>v>=top&&v<=bottom&&intervals.every(([a,b])=>v<a||v>b));
        if(candidates.length){chosen=candidates.sort((a,b)=>Math.abs(a-wanted)-Math.abs(b-wanted)||a-b)[0];break;}
      }
      // If the viewport is too short for the local density, grow the scrollable
      // canvas rather than putting a node on top of another visible mark.
      if(chosen===null)chosen=Math.max(bottom+clearance,...nearby.map(p=>y.get(p.id)+clearance+4));
      y.set(n.id,chosen);placed.push(n);
    }
    return nodes.map(n=>({...n,y:y.get(n.id)}));
  },
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
    // The displayed parent adds local grouping without imposing a row or box.
    // Character strands still determine continuity between different groups.
    const byGroup=new Map();
    for(const node of nodes){if(!node.layoutGroup)continue;if(!byGroup.has(node.layoutGroup))byGroup.set(node.layoutGroup,[]);byGroup.get(node.layoutGroup).push(node);}
    for(const list of byGroup.values()){
      list.sort((a,b)=>a.day-b.day||a.id.localeCompare(b.id));
      for(let i=1;i<list.length;i++)connect(list[i-1].id,list[i].id,3.6);
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
    // Build time-neighbor pairs once. Far-away nodes never repel one another,
    // so checking every pair again on each relaxation pass only blocks input.
    const neighbors=[],groupNeighbors=new Map();
    for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
      const a=nodes[i],b=nodes[j],time=Math.abs(a.day-b.day);if(time>1.15)continue;
      const shared=(a.layoutCast||[]).some(id=>(b.layoutCast||[]).includes(id)),linked=edges.get(a.id).has(b.id);
      const separateGroups=a.layoutGroup&&b.layoutGroup&&a.layoutGroup!==b.layoutGroup;
      if(separateGroups){
        const [one,two]=[a.layoutGroup,b.layoutGroup].sort(),key=one+'|'+two,previous=groupNeighbors.get(key);
        if(!previous||time<previous.time)groupNeighbors.set(key,{one,two,time});
      }else neighbors.push({a,b,time,wanted:shared||linked?.12:.34,factor:shared||linked?.018:.045});
    }
    // One-dimensional force relaxation. Connected story streams attract; unrelated
    // scenes that occupy the same time window repel, so branches split and can later
    // converge again when their casts meet.
    for(let pass=0;pass<72;pass++){
      const delta=new Map(nodes.map(n=>[n.id,0]));
      const centers=new Map();
      for(const [id,members] of byGroup){
        const center=members.reduce((sum,node)=>sum+y.get(node.id),0)/members.length;centers.set(id,center);
        for(const node of members)delta.set(node.id,delta.get(node.id)+(center-y.get(node.id))*.1);
      }
      for(const {one,two,time} of groupNeighbors.values()){
        const dy=centers.get(two)-centers.get(one),distance=Math.abs(dy);if(distance>=.52)continue;
        const direction=distance>.008?Math.sign(dy):(this.seed(one+'|'+two)<.5?-1:1),strength=(.52-distance)*.055*(1-time/1.2);
        for(const node of byGroup.get(one))delta.set(node.id,delta.get(node.id)-direction*strength);
        for(const node of byGroup.get(two))delta.set(node.id,delta.get(node.id)+direction*strength);
      }
      for(const n of nodes){
        for(const [otherId,w] of edges.get(n.id)){if(n.id>otherId)continue;const d=(y.get(otherId)-y.get(n.id))*.018*Math.min(6,w);delta.set(n.id,delta.get(n.id)+d);delta.set(otherId,delta.get(otherId)-d);}
      }
      for(const {a,b,time,wanted,factor} of neighbors){
        const dy=y.get(b.id)-y.get(a.id),distance=Math.abs(dy);
        if(distance>=wanted)continue;
        const direction=distance>.008?Math.sign(dy):(this.seed(a.id+'|'+b.id)<.5?-1:1),strength=(wanted-distance)*factor*(1-time/1.2);
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
        if(a.calendarDay!==b.calendarDay||!a.locationId||a.locationId!==b.locationId||(a.layoutGroup&&b.layoutGroup&&a.layoutGroup!==b.layoutGroup))continue;
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
  lifetimes(anchors,{idleDays=14}={}) {
    const runs=[];
    for(const anchor of anchors){
      const previous=runs.at(-1)?.at(-1);
      const inactive=previous?(anchor.activityFrom??anchor.calendarDay??anchor.day)-(previous.activityTo??previous.calendarDay??previous.day):0;
      // Display days can expand within one calendar day. Screen distance and
      // zoom must never turn nearby appearances into an absence from the story.
      if(!previous||inactive>idleDays)runs.push([]);
      runs.at(-1).push(anchor);
    }
    return runs;
  },
  focusStops(start,end,centers,radius,activeStart=start,activeEnd=end) {
    const span=Math.max(.001,end-start),reach=Math.max(1,radius),positions=new Set([start,end,activeStart,activeEnd]);
    for(const center of centers)for(const step of [-1,-.875,-.75,-.5,-.25,0,.25,.5,.75,.875,1])positions.add(Math.max(start,Math.min(end,center+step*reach)));
    const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
    return [...positions].filter(x=>x>=start&&x<=end).sort((a,b)=>a-b).map(x=>{
      const local=Math.max(0,...centers.map(center=>smooth(1-Math.abs(x-center)/reach)));
      const entry=activeStart>start?smooth((x-start)/(activeStart-start)):1,exit=activeEnd<end?smooth((end-x)/(end-activeEnd)):1;
      return {offset:(x-start)/span,opacity:local*entry*exit};
    });
  },
  slopes(points,axis='day') {
    const spans=points.slice(1).map((p,i)=>p[axis]-points[i][axis]),secants=spans.map((span,i)=>span>0?(points[i+1].y-points[i].y)/span:0);
    return points.map((p,i)=>{
      if(p.flat)return 0;
      if(!i)return secants[0]||0;
      if(i===points.length-1)return secants.at(-1)||0;
      const before=secants[i-1],after=secants[i];
      if(spans[i-1]<=0||spans[i]<=0||before*after<=0)return 0;
      const a=2*spans[i]+spans[i-1],b=spans[i]+2*spans[i-1];
      return (a+b)/(a/before+b/after);
    });
  },
  strand(anchors,id,middle,amplitude,lead=1,pixelsPerDay=24,axisLength=365) {
    if(!anchors.length)return [];
    // Recorded nodes determine the curve. Keep decorative drift small and bounded
    // regardless of the distance between appearances or the current zoom.
    const first=anchors[0],last=anchors.at(-1),ends=[{day:Math.max(0,first.day-lead),y:first.y,flat:true,id:'start'},...anchors.map(p=>({...p,node:true,flat:true})),{day:Math.min(axisLength,last.day+lead),y:last.y,flat:true,id:'end'}],points=[];
    for(let i=0;i<ends.length-1;i++){
      const a=ends[i],b=ends[i+1],gap=b.day-a.day;points.push(a);
      if(gap<1e-8)continue;
      const pixelGap=gap*Math.max(1,pixelsPerDay),wander=Math.max(0,Math.min(1,(pixelGap-90)/260));
      if(!wander||!a.node||!b.node)continue;
      const controls=3;
      const primary=(this.seed(id+':'+a.id+':'+b.id+':drift')-.5)*Math.min(24,amplitude*.2)*wander;
      for(let j=1;j<=controls;j++){
        const t=j/(controls+1),ease=t*t*(3-2*t),offset=Math.sin(Math.PI*t)**2*primary;
        points.push({day:a.day+gap*t,y:a.y+(b.y-a.y)*ease+offset});
      }
    }
    // Separate nodes can share a display time. Keep both physical anchors so
    // the strand reaches each mark through a vertical segment at that X.
    points.push(ends.at(-1));return points.filter((p,i,a)=>!i||p.day>=a[i-1].day);
  },
  curveY(points,day) {
    if(day<=points[0].day)return points[0].y;if(day>=points.at(-1).day)return points.at(-1).y;
    const slopes=this.slopes(points);
    const i=Math.max(0,points.findIndex(p=>p.day>=day)-1),a=points[i],b=points[i+1]||a,span=b.day-a.day;if(!span)return a.y;
    const t=Math.max(0,Math.min(1,(day-a.day)/span));return (2*t**3-3*t*t+1)*a.y+(t**3-2*t*t+t)*span*slopes[i]+(-2*t**3+3*t*t)*b.y+(t**3-t*t)*span*slopes[i+1];
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
    const dated=events.filter(e=>e.day!==null),scenes=this.scenes(dated,relations),positions=this.momentPositions(scenes,relations),list=scenes.flatMap(s=>s.group).sort((a,b)=>(positions.get(a.id)??Infinity)-(positions.get(b.id)??Infinity));
    const index=list.findIndex(e=>e.id===currentId);
    if(index>=0)return {previous:list[index-1]||null,next:list[index+1]||null,index,total:list.length};
    const nextIndex=list.findIndex(e=>e.day>=day);
    return {previous:nextIndex===-1?list.at(-1)||null:list[nextIndex-1]||null,next:nextIndex===-1?null:list[nextIndex],index:-1,total:list.length};
  }
};
if(typeof module!=='undefined')module.exports=TimelineCore;
