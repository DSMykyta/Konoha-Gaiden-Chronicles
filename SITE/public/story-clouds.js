'use strict';
const StoryClouds = {
 hash(value){let hash=2166136261;for(const char of String(value||'')){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return hash>>>0;},
 palette(kind,key){
  const base=this.hash(key)%360,shift=kind==='episode'?52:kind==='scene'?18:0,hue=(base+shift)%360;
  if(kind==='episode')return {top:`hsla(${hue},55%,92%,.76)`,bottom:`hsla(${hue},50%,94%,.48)`,stroke:`hsla(${hue},28%,68%,.38)`,alpha:.54};
  if(kind==='scene')return {top:`hsla(${hue},62%,89%,.82)`,bottom:`hsla(${hue},55%,92%,.58)`,stroke:`hsla(${hue},32%,64%,.44)`,alpha:.68};
  return {top:`hsla(${hue},72%,86%,.92)`,bottom:`hsla(${hue},64%,89%,.78)`,stroke:`hsla(${hue},38%,60%,.52)`,alpha:.84};
 },
 groups(nodes,level,sceneMap,episodeMap){
  if(level==='arc')return [];
  const buckets=new Map(),rank={episode:0,scene:1,moment:2};
  const add=(kind,id,node,parentId=null)=>{
   if(!id)return;
   const key=kind+':'+id;
   if(!buckets.has(key)){
    const meta=kind==='scene'?sceneMap.get(id):kind==='episode'?episodeMap.get(id):null;
    const episodeId=kind==='scene'?(meta?.episode_id||parentId):kind==='episode'?id:parentId;
    buckets.set(key,{key,kind,id,parentId:kind==='scene'?episodeId:null,title:meta?.title||node.title,parentTitle:episodeMap.get(episodeId)?.title||'',nodes:[]});
   }
   buckets.get(key).nodes.push({id:node.id,x:node.x,y:node.y});
  };
  for(const node of nodes){
   const sceneId=node.scene?.id||node.sourceSceneIds?.[0]||null;
   const episodeIds=node.kind==='episode'?[node.rawId]:(node.sourceEpisodeIds||[node.scene?.episode_id]).filter(Boolean);
   const episodeId=episodeIds[0]||null;
   if(level==='moment')add('moment',node.id,node,episodeId);
   if(level==='moment'||level==='scene')add('scene',sceneId,node,episodeId);
   for(const id of episodeIds)add('episode',id,node);
  }
  return [...buckets.values()]
   .sort((a,b)=>rank[a.kind]-rank[b.kind]||a.key.localeCompare(b.key))
   .map(group=>({...group,parts:group.nodes.length?[group.nodes]:[]}));
 },
 // Kept as a small public helper for tests/compatibility. A story group is now
 // intentionally one continuous visual region instead of distance-split islands.
 parts(points){return points.length?[points.slice()]:[];},
 labels(groups,nodes,width,top){
  const labels=[],overlap=(a,b)=>Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
  const wrap=(text,limit)=>{
   const words=text.split(/\s+/),lines=[];let line='';
   for(const word of words){if(line&&line.length+word.length+1>limit){lines.push(line);line=word;}else line+=(line?' ':'')+word;}
   if(line)lines.push(line);
   return lines.length>2?[lines[0],lines[1].slice(0,limit-1)+'…']:lines;
  };
  const visible=groups.filter(g=>g.kind!=='moment').sort((a,b)=>b.nodes.length-a.nodes.length||(a.kind==='scene'?-1:1));
  for(const group of visible){
   const part=group.parts[0];if(!part?.length)continue;
   const xs=part.map(n=>n.x),ys=part.map(n=>n.y),middle=xs.reduce((a,b)=>a+b,0)/xs.length,labelWidth=width<600?Math.min(160,(width-44)/2):214,lines=wrap(group.title,Math.floor(labelWidth/6.2)),height=18+lines.length*17;
   const positions=[],minY=Math.min(...ys),maxY=Math.max(...ys),middleY=(minY+maxY)/2;
   const xPositions=[middle-labelWidth/2,Math.min(...xs)-labelWidth-24,Math.max(...xs)+24,16,width-labelWidth-16];
   for(let y=top;y<=Math.max(maxY+240,top+visible.length*34);y+=14)for(const x of xPositions){
    const p={x:Math.max(16,Math.min(width-labelWidth-16,x)),y,width:labelWidth,height};
    if(nodes.some(n=>{const radius=n.kind==='moment'?9:n.kind==='scene'?13:18;return overlap(p,{x:n.x-radius,y:n.y-radius,width:radius*2,height:radius*2});}))continue;
    if(labels.some(l=>overlap(p,{...l,x:l.x-6,y:l.y-9,width:l.width+12,height:l.height+18})))continue;
    positions.push(p);
   }
   const score=p=>Math.min(...part.map(n=>Math.hypot(Math.max(p.x-n.x,0,n.x-p.x-p.width),Math.max(p.y-n.y,0,n.y-p.y-p.height))))+Math.abs(p.x+labelWidth/2-middle)*.1+Math.abs(p.y+height/2-middleY)*.05;
   const position=positions.sort((a,b)=>score(a)-score(b))[0]||{x:16,y:Math.max(top,...labels.map(l=>l.y+l.height))+20,width:labelWidth,height};
   const anchor=part.reduce((nearest,n)=>Math.hypot(n.x-(position.x+labelWidth/2),n.y-(position.y+height/2))<Math.hypot(nearest.x-(position.x+labelWidth/2),nearest.y-(position.y+height/2))?n:nearest,part[0]);
   labels.push({...position,anchor,key:group.key,kind:group.kind,id:group.id,parentId:group.parentId,title:group.title,parentTitle:group.parentTitle,lines,count:group.nodes.length});
  }
  return labels;
 },
 bridgePoints(points,radius,kind){
  if(kind==='moment'||points.length<2)return [];
  const ordered=points.slice().sort((a,b)=>a.x-b.x||a.y-b.y),bridges=[],spacing=kind==='episode'?radius*.72:radius*.62;
  for(let i=1;i<ordered.length;i++){
   const a=ordered[i-1],b=ordered[i],distance=Math.hypot(b.x-a.x,b.y-a.y),steps=Math.max(0,Math.ceil(distance/spacing)-1),seed=this.hash(a.id+'>'+b.id);
   for(let step=1;step<=steps;step++){
    const t=step/(steps+1),curve=Math.sin(Math.PI*t)*Math.sin((seed%628)/100)*Math.min(radius*.12,distance*.035);
    bridges.push({id:`${a.id}>${b.id}:${step}`,x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t+curve});
   }
  }
  return bridges;
 },
 influences(points,radius,phase=0,kind='moment'){
  const balls=[],anchors=[...points,...this.bridgePoints(points,radius,kind)];
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
 contours(points,foreign=[],radius=34,phase=0,step=8,kind='moment'){
  if(!points.length)return [];
  const padding=radius*2.4,left=Math.floor((Math.min(...points.map(p=>p.x))-padding)/step)*step,top=Math.floor((Math.min(...points.map(p=>p.y))-padding)/step)*step,right=Math.ceil((Math.max(...points.map(p=>p.x))+padding)/step)*step,bottom=Math.ceil((Math.max(...points.map(p=>p.y))+padding)/step)*step;
  const columns=Math.round((right-left)/step)+1,rows=Math.round((bottom-top)/step)+1,values=new Float32Array(columns*rows),balls=this.influences(points,radius,phase,kind),masks=foreign.filter(n=>n.x>=left-20&&n.x<=right+20&&n.y>=top-20&&n.y<=bottom+20);
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
  const context=canvas?.getContext?.('2d');if(!context)return {update(){},scroll(){}};
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)'),contrast=window.matchMedia('(prefers-contrast: more)'),transparency=window.matchMedia('(prefers-reduced-transparency: reduce)');
  let state={groups:[],nodes:[],width:0,height:0,scrollTop:0,paused:false},frame=null,last=0,phase=0;
  const stop=()=>{if(frame!==null)cancelAnimationFrame(frame);frame=null;};
  const draw=()=>{
   const dpr=Math.min(window.devicePixelRatio||1,2),width=Math.round(state.width*dpr),height=Math.round(state.height*dpr);
   if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
   context.setTransform(dpr,0,0,dpr,0,-state.scrollTop*dpr);context.clearRect(0,state.scrollTop,state.width,state.height);
   for(const group of state.groups){
    const own=new Set(group.nodes.map(n=>n.id)),foreign=group.kind==='moment'?state.nodes.filter(n=>!own.has(n.id)):[],radius=group.kind==='episode'?70:group.kind==='scene'?48:25,colors=StoryClouds.palette(group.kind,group.key);
    for(const part of group.parts){
     const minY=Math.min(...part.map(n=>n.y))-radius*2.4,maxY=Math.max(...part.map(n=>n.y))+radius*2.4;
     if(maxY<state.scrollTop||minY>state.scrollTop+state.height)continue;
     const contours=StoryClouds.contours(part,foreign,radius,phase,group.kind==='moment'?6:8,group.kind),path=new Path2D();
     for(const loop of contours){const last=loop.at(-1),first=loop[0];path.moveTo((last.x+first.x)/2,(last.y+first.y)/2);loop.forEach((p,i)=>{const next=loop[(i+1)%loop.length];path.quadraticCurveTo(p.x,p.y,(p.x+next.x)/2,(p.y+next.y)/2);});path.closePath();}
     const gradient=context.createLinearGradient(0,minY,0,maxY);gradient.addColorStop(0,colors.top);gradient.addColorStop(1,colors.bottom);
     context.globalAlpha=colors.alpha;context.fillStyle=contrast.matches?'rgba(222,224,228,.82)':gradient;context.fill(path,'evenodd');
     context.strokeStyle=contrast.matches?'#858b94':colors.stroke;context.lineWidth=group.kind==='moment'?.8:1;context.stroke(path);
     context.save();context.translate(0,-1);context.globalAlpha=group.kind==='moment'?.55:.4;context.strokeStyle='rgba(255,255,255,.9)';context.stroke(path);context.restore();
    }
   }
   context.globalAlpha=1;
  };
  const animate=time=>{
   frame=null;if(document.visibilityState==='hidden'||motion.matches||transparency.matches||state.paused||!state.groups.length)return;
   if(time-last>=100){phase=time/14000;draw();last=time;}frame=requestAnimationFrame(animate);
  };
  const resume=()=>{stop();draw();if(!motion.matches&&!transparency.matches&&!state.paused&&document.visibilityState!=='hidden'&&state.groups.length)frame=requestAnimationFrame(animate);};
  for(const preference of [motion,contrast,transparency])preference.addEventListener?.('change',resume);
  document.addEventListener('visibilitychange',resume);
  return {update(next){state={...state,...next};if(motion.matches||transparency.matches)phase=0;resume();},scroll(scrollTop){state.scrollTop=scrollTop;draw();}};
 }
};
if(typeof module!=='undefined')module.exports=StoryClouds;

// Strands are shaped by their own participation anchors only. Unrelated story
// nodes must not bend a line and visually imply that the character was there.
if(typeof TimelineCore!=='undefined')TimelineCore.avoid=(route)=>route;
