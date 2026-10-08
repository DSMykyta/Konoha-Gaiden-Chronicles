'use strict';
const StoryClouds = {
 hash(value){let hash=2166136261;for(const char of String(value||'')){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return hash>>>0;},
 palette(kind,key){
  const base=this.hash(key)%360,shift=kind==='episode'?52:kind==='scene'?18:0,hue=(base+shift)%360;
  if(kind==='arc')return {top:`hsla(${hue},34%,91%,.37)`,bottom:`hsla(${hue},32%,94%,.24)`,stroke:`hsla(${hue},25%,69%,.22)`,alpha:.40};
  if(kind==='episode')return {top:`hsla(${hue},55%,92%,.76)`,bottom:`hsla(${hue},50%,94%,.48)`,stroke:`hsla(${hue},28%,68%,.38)`,alpha:.54};
  if(kind==='scene')return {top:`hsla(${hue},62%,89%,.82)`,bottom:`hsla(${hue},55%,92%,.58)`,stroke:`hsla(${hue},32%,64%,.44)`,alpha:.68};
  return {top:`hsla(${hue},72%,86%,.92)`,bottom:`hsla(${hue},64%,89%,.78)`,stroke:`hsla(${hue},38%,60%,.52)`,alpha:.84};
 },
 groups(nodes,level,sceneMap,episodeMap,arcMap=new Map()){
  if(level==='arc')return [];
  const buckets=new Map(),rank={arc:-1,episode:0,scene:1,moment:2};
  const add=(kind,id,node,parentId=null)=>{
   if(!id)return;
   const key=kind+':'+id;
   if(!buckets.has(key)){
    const meta=kind==='scene'?sceneMap.get(id):kind==='episode'?episodeMap.get(id):kind==='arc'?arcMap.get(id):null;
    const episodeId=kind==='scene'?(meta?.episode_id||parentId):kind==='episode'?id:parentId;
    buckets.set(key,{key,kind,id,momentIds:new Set(),sceneIds:new Set(),parentId:kind==='scene'?episodeId:null,title:meta?.title||node.title,parentTitle:episodeMap.get(episodeId)?.title||'',nodes:[]});
   }
   const bucket=buckets.get(key);bucket.nodes.push({id:node.id,x:node.x,y:node.y});
   (node.group||[]).forEach(event=>bucket.momentIds.add(event.id));(node.sourceSceneIds||[node.scene?.id]).filter(Boolean).forEach(id=>bucket.sceneIds.add(id));
  };
  for(const node of nodes){
   const sceneId=node.scene?.id||node.sourceSceneIds?.[0]||null;
   const episodeIds=node.kind==='episode'?[node.rawId]:(node.sourceEpisodeIds||[node.scene?.episode_id]).filter(Boolean);
   const episodeId=episodeIds[0]||null;

   if(level==='moment'||level==='scene')add('scene',sceneId,node,episodeId);
   if(level==='moment'||level==='scene')for(const id of episodeIds)add('episode',id,node);
   if(level==='moment'||level==='scene'||level==='episode'){
    const arcIds=[...new Set(episodeIds.map(id=>episodeMap.get(id)?.arc_id).filter(Boolean))];
    for(const id of arcIds)add('arc',id,node);
   }
  }
  return [...buckets.values()]
   .filter(group=>group.kind==='arc'?group.nodes.length>1:group.kind==='episode'?group.sceneIds.size>1:group.momentIds.size>1)
   .sort((a,b)=>rank[a.kind]-rank[b.kind]||a.key.localeCompare(b.key))
   .map(group=>({...group,parts:group.nodes.length?[group.nodes]:[]}));
 },
 // Kept as a small public helper for tests/compatibility. A story group is now
 // intentionally one continuous visual region instead of distance-split islands.
 parts(points){return points.length?[points.slice()]:[];},
 labels(groups,nodes,width,top,bottom=Infinity,previous=new Map(),maxLines=2){
  const labels=[],margin=16,labelWidth=width<600?144:188;
  const overlaps=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
  const wrap=text=>{
   const limit=Math.floor(labelWidth/6.9),words=String(text).split(/\s+/),lines=[];let line='';
   for(const word of words){if(line&&line.length+word.length+1>limit){lines.push(line);line=word;}else line+=(line?' ':'')+word;}
   if(line)lines.push(line);if(lines.length<=maxLines)return lines;return [...lines.slice(0,maxLines-1),lines[maxLines-1].slice(0,limit-1)+'…'];
  };
  for(const group of groups){
   if(!group.nodes.length)continue;
   const lines=wrap(group.title),height=16+lines.length*17,own=group.nodes,old=previous.get(group.key);
   const middleX=own.reduce((sum,node)=>sum+node.x,0)/own.length;
   const anchor=own.find(node=>node.id===old?.anchorId)||own.slice().sort((a,b)=>Math.abs(a.x-middleX)-Math.abs(b.x-middleX)||a.id.localeCompare(b.id))[0];
   const minY=Math.min(...own.map(node=>node.y)),maxY=Math.max(...own.map(node=>node.y));
   const offsets=[...(old?.anchorId===anchor.id?[old]:[]),
    {dx:-labelWidth/2,dy:minY-anchor.y-height-22},
    {dx:-labelWidth/2,dy:maxY-anchor.y+24},
    {dx:26,dy:-height/2},{dx:-labelWidth-26,dy:-height/2},
    {dx:26,dy:-height-26},{dx:-labelWidth-26,dy:26}];
   let position=null;
   for(const offset of offsets){
    const candidate={x:Math.max(margin,Math.min(width-margin-labelWidth,anchor.x+offset.dx)),y:anchor.y+offset.dy,width:labelWidth,height};
    if(candidate.y<top||candidate.y+height>bottom)continue;
    if(nodes.some(node=>overlaps(candidate,{x:node.x-22,y:node.y-22,width:44,height:44})))continue;
    if(labels.some(label=>overlaps(candidate,{x:label.x-8,y:label.y-8,width:label.width+16,height:label.height+16})))continue;
    position=candidate;break;
   }
   // Dense overviews may omit a title. Never move a mark, grow the canvas or
   // send a title into a detached column merely to fit every label.
   if(!position)continue;
   previous.set(group.key,{anchorId:anchor.id,dx:position.x-anchor.x,dy:position.y-anchor.y});
   labels.push({...position,anchor,key:group.key,kind:group.kind,id:group.id,title:group.title,lines});
  }
  return labels;
 },
 bridgePoints(points,radius,kind,minX=-Infinity,maxX=Infinity){
  if(kind==='moment'||points.length<2)return [];
  const ordered=points.slice().sort((a,b)=>a.x-b.x||a.y-b.y),bridges=[],spacing=kind==='arc'?radius*.80:kind==='episode'?radius*.72:radius*.62;
  for(let i=1;i<ordered.length;i++){
   const a=ordered[i-1],b=ordered[i],dx=b.x-a.x,distance=Math.hypot(dx,b.y-a.y);
   if(b.x<minX||a.x>maxX)continue;
   const steps=Math.max(0,Math.ceil(distance/spacing)-1),seed=this.hash(a.id+'>'+b.id);
   if(!steps)continue;
   const first=dx>0?Math.max(1,Math.ceil((minX-a.x)/dx*(steps+1))):1;
   const last=dx>0?Math.min(steps,Math.floor((maxX-a.x)/dx*(steps+1))):steps;
   for(let step=first;step<=last;step++){
    const t=step/(steps+1),curve=Math.sin(Math.PI*t)*Math.sin((seed%628)/100)*Math.min(radius*.12,distance*.035);
    bridges.push({id:`${a.id}>${b.id}:${step}`,x:a.x+dx*t,y:a.y+(b.y-a.y)*t+curve});
   }
  }
  return bridges;
 },
 influences(points,radius,phase=0,kind='moment',extra=null){
  const balls=[],anchors=[...points,...(extra??this.bridgePoints(points,radius,kind))];
  for(const point of anchors){
   let seed=0;for(const char of point.id)seed=(seed*31+char.charCodeAt(0))>>>0;
   const angle=seed%628/100,breath=Math.sin(phase+angle)*(kind==='moment'?1.2:1.6),bridge=String(point.id).includes('>');
   balls.push({x:point.x,y:point.y,radius:radius+(bridge?radius*.08:0)+breath,weight:bridge?.92:1,ripple:angle});
   if(!bridge){
    for(const offset of [0,2.2,4.5])balls.push({x:point.x+Math.cos(angle+offset)*radius*.48,y:point.y+Math.sin(angle+offset)*radius*.48,radius:radius*.58+breath*.5,weight:.2});
   }
  }
  return balls;
 },
 field(x,y,balls,foreign=[]){
  let value=0;
  for(const ball of balls){const angle=Math.atan2(y-ball.y,x-ball.x),radius=ball.radius*(ball.ripple===undefined?1:1+.065*Math.sin(angle*3+ball.ripple)+.03*Math.cos(angle*5-ball.ripple)),d=((x-ball.x)**2+(y-ball.y)**2)/(radius**2);if(d<12)value+=ball.weight*Math.exp(-d*1.4);}
  for(const node of foreign){const d=((x-node.x)**2+(y-node.y)**2)/400;if(d<1)value=Math.min(value,d*.62);}
  return value;
 },
 contours(points,foreign=[],radius=34,phase=0,step=8,kind='moment',extra=null){
  const footprint=extra?[...points,...extra]:points;
  if(!footprint.length)return [];
  const padding=radius*2.4,left=Math.floor((Math.min(...footprint.map(p=>p.x))-padding)/step)*step,top=Math.floor((Math.min(...footprint.map(p=>p.y))-padding)/step)*step,right=Math.ceil((Math.max(...footprint.map(p=>p.x))+padding)/step)*step,bottom=Math.ceil((Math.max(...footprint.map(p=>p.y))+padding)/step)*step;
  const columns=Math.round((right-left)/step)+1,rows=Math.round((bottom-top)/step)+1,values=new Float32Array(columns*rows),balls=this.influences(points,radius,phase,kind,extra),masks=foreign.filter(n=>n.x>=left-20&&n.x<=right+20&&n.y>=top-20&&n.y<=bottom+20);
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++)values[y*columns+x]=this.field(left+x*step,top+y*step,balls,masks);
  const threshold=.62,segments=[],cases=[[],[[3,0]],[[0,1]],[[3,1]],[[1,2]],[[3,0],[1,2]],[[0,2]],[[3,2]],[[2,3]],[[0,2]],[[0,1],[2,3]],[[1,2]],[[1,3]],[[0,1]],[[3,0]],[]];
  for(let y=0;y<rows-1;y++)for(let x=0;x<columns-1;x++){
   const v=[values[y*columns+x],values[y*columns+x+1],values[(y+1)*columns+x+1],values[(y+1)*columns+x]],code=v.reduce((sum,value,i)=>sum+(value>=threshold?1<<i:0),0);if(!code||code===15)continue;
   const corners=[[left+x*step,top+y*step],[left+(x+1)*step,top+y*step],[left+(x+1)*step,top+(y+1)*step],[left+x*step,top+(y+1)*step]],edges=[[0,1],[1,2],[2,3],[3,0]],point=edge=>{const [a,b]=edges[edge],t=(threshold-v[a])/(v[b]-v[a]);return {x:corners[a][0]+(corners[b][0]-corners[a][0])*t,y:corners[a][1]+(corners[b][1]-corners[a][1])*t};};
   let pairs=cases[code];if((code===5||code===10)&&v.reduce((a,b)=>a+b,0)/4>=threshold)pairs=code===5?[[0,1],[2,3]]:[[3,0],[1,2]];
   for(const [a,b] of pairs)segments.push([point(a),point(b)]);
  }
  const key=p=>p.x.toFixed(3)+','+p.y.toFixed(3),links=new Map();
  segments.forEach((segment,i)=>segment.forEach((p,end)=>{const id=key(p);if(!links.has(id))links.set(id,[]);links.get(id).push({i,end});}));
  const used=new Set(),loops=[];
  for(let i=0;i<segments.length;i++){
   if(used.has(i))continue;used.add(i);const loop=[segments[i][0],segments[i][1]],first=key(loop[0]);let current=key(loop[1]);
   while(current!==first){const next=links.get(current)?.find(link=>!used.has(link.i));if(!next)break;used.add(next.i);const p=segments[next.i][1-next.end];loop.push(p);current=key(p);}
   if(current===first&&loop.length>=4)loops.push(loop.slice(0,-1));
  }
  return loops;
 },
 create(canvas){
  const context=canvas?.getContext?.('2d');if(!context)return {update(){},scroll(){},refresh(){},setPaused(){}};
  const contrast=window.matchMedia('(prefers-contrast: more)'),transparency=window.matchMedia('(prefers-reduced-transparency: reduce)');
  let state={groups:[],nodes:[],width:0,height:0,scrollTop:0,paused:false},frame=null;
  // Content/zoom/layout changes alter outlines; panning and vertical scrolling
  // never add/remove members. Cache contours, not merely the previous paint.
  const geometry=new Map(),capacity=180;
  const draw=()=>{
   const dpr=Math.min(window.devicePixelRatio||1,2),width=Math.round(state.width*dpr),height=Math.round(state.height*dpr);
   if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
   context.setTransform(dpr,0,0,dpr,0,-state.scrollTop*dpr);
   context.clearRect(0,state.scrollTop,state.width,state.height);
   for(const group of state.groups){
    const radius=group.kind==='arc'?92:group.kind==='episode'?70:group.kind==='scene'?48:25;
    const margin=radius*3.8;
    const colors=StoryTitleScale.palette(SelectionFocus.palette(StoryClouds.palette(group.kind,group.key),group.kind,group.key),group.kind,group.key);
    // The group contains ALL its nodes, including those offscreen. Clip only
    // contour computation after grouping, so a fourth offscreen moment cannot
    // suddenly create a new cloud as the viewport crosses it.
    for(const part of group.parts){
     if(!part.length)continue;
     const minAllX=Math.min(...part.map(n=>n.x)),maxAllX=Math.max(...part.map(n=>n.x));
     if(maxAllX < -margin||minAllX>state.width+margin)continue;
     const ribbon=group.kind==='arc'||group.kind==='episode'||part.length>14||maxAllX-minAllX>state.width*1.8;
     const minY=Math.min(...part.map(n=>n.y))-radius*(ribbon?1.5:2.4);
     const maxY=Math.max(...part.map(n=>n.y))+radius*(ribbon?1.5:2.4);
     if(maxY<state.scrollTop||minY>state.scrollTop+state.height)continue;
     // Shape-space is relative to the FIRST WORLD X, not the viewport.
     // Panning translates this same cached Path2D. The full 4-point scene
     // outline cannot be replaced by a 3-point outline at the right edge.
     const local=part.map(n=>({...n,x:n.x-minAllX}));
     const signature=group.key+'|'+(ribbon?'ribbon':'organic')+'|'+radius+'|'+local.map(n=>n.id+':'+n.x.toFixed(2)+','+n.y.toFixed(1)).join('|');
     let shape=geometry.get(signature);
     if(!shape){
      const path=new Path2D();
      if(ribbon){
       // Smooth O(N) envelope for arcs, episodes and long scenes.
       const sorted=local.slice().sort((a,b)=>a.x-b.x||a.y-b.y),first=sorted[0];
       path.moveTo(first.x,first.y);
       if(sorted.length===1)path.lineTo(first.x+.01,first.y);
       for(let i=1;i<sorted.length;i++){
        const a=sorted[i-1],b=sorted[i],mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
        path.quadraticCurveTo(a.x,a.y,mx,my);
        if(i===sorted.length-1)path.quadraticCurveTo(b.x,b.y,b.x,b.y);
       }
      }else{
       // Compact scenes use a detailed contour ONCE per zoom/layout, not
       // once per pan. Other branches must not cut holes in this geometry.
       const contours=StoryClouds.contours(local,[],radius,0,6,group.kind);
       for(const loop of contours){
        const last=loop.at(-1),first=loop[0];
        path.moveTo((last.x+first.x)/2,(last.y+first.y)/2);
        loop.forEach((p,i)=>{const next=loop[(i+1)%loop.length];path.quadraticCurveTo(p.x,p.y,(p.x+next.x)/2,(p.y+next.y)/2);});
        path.closePath();
       }
      }
      shape={path};geometry.set(signature,shape);
      if(geometry.size>capacity)geometry.delete(geometry.keys().next().value);
     }
     const path=shape.path,gradient=context.createLinearGradient(0,minY,0,maxY);
     gradient.addColorStop(0,colors.top);gradient.addColorStop(1,colors.bottom);
     context.save();context.translate(minAllX,0);
     context.globalAlpha=colors.alpha;
     if(ribbon){
      context.lineCap='round';context.lineJoin='round';
      context.strokeStyle=contrast.matches?'#858b94':colors.stroke;
      context.lineWidth=2*radius+2;context.stroke(path);
      context.strokeStyle=contrast.matches?'rgba(222,224,228,.82)':gradient;
      context.lineWidth=2*radius;context.stroke(path);
     }else{
      context.fillStyle=contrast.matches?'rgba(222,224,228,.82)':gradient;
      context.fill(path,'evenodd');
      context.strokeStyle=contrast.matches?'#858b94':colors.stroke;
      context.lineWidth=1;context.stroke(path);
     }
     context.restore();}
   }
   context.globalAlpha=1;
  };
  const resume=()=>{if(document.visibilityState!=='hidden')draw();};
  const frameDraw=()=>{
   if(frame!==null)return;
   frame=requestAnimationFrame(()=>{frame=null;resume();});
  };
  for(const preference of [contrast,transparency])preference.addEventListener?.('change',frameDraw);
  document.addEventListener('visibilitychange',frameDraw);
  return {
   update(next){state={...state,...next};if(frame!==null){cancelAnimationFrame(frame);frame=null;}resume();},
   // A scroll event now schedules at most one canvas blit per animation frame.
   // Cached Path2D geometry is reused, without re-running marching squares.
   scroll(scrollTop){if(state.scrollTop===scrollTop)return;state.scrollTop=scrollTop;frameDraw();},
   refresh(){frameDraw();},
   setPaused(paused){state.paused=paused;}
  };
 }
};
if(typeof module!=='undefined')module.exports=StoryClouds;
