'use strict';
const StoryClouds = {
 groups(nodes,level,sceneMap,episodeMap){
  if(level==='arc'||level==='episode')return [];
  const buckets=new Map(),add=(kind,id,node)=>{
   if(!id)return;
   const key=kind+':'+id;
   if(!buckets.has(key)){
    const meta=(kind==='scene'?sceneMap:episodeMap).get(id),parentId=kind==='scene'?meta?.episode_id:null;
    buckets.set(key,{key,kind,id,parentId,title:meta?.title||node.title,parentTitle:episodeMap.get(parentId)?.title||'',nodes:[],faint:level==='moment'&&kind==='episode'});
   }
   buckets.get(key).nodes.push({id:node.id,x:node.x,y:node.y});
  };
  for(const node of nodes){
   if(level==='moment')add('scene',node.scene?.id,node);
   const ids=node.kind==='episode'?[node.rawId]:node.sourceEpisodeIds||[node.scene?.episode_id];
   for(const id of ids)add('episode',id,node);
  }
  return [...buckets.values()].sort((a,b)=>(a.kind==='episode'?0:1)-(b.kind==='episode'?0:1)).map(group=>({...group,parts:this.parts(group.nodes,group.kind==='scene'?142:190)}));
 },
 parts(points,distance=142){
  const remaining=new Set(points),parts=[];
  while(remaining.size){
   const seed=remaining.values().next().value,part=[seed];remaining.delete(seed);
   for(let i=0;i<part.length;i++)for(const point of remaining)if(Math.hypot(point.x-part[i].x,point.y-part[i].y)<=distance){remaining.delete(point);part.push(point);}
   parts.push(part);
  }
  return parts.sort((a,b)=>b.length-a.length);
 },
 labels(groups,nodes,width,top){
  const labels=[],overlap=(a,b)=>Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
  const wrap=(text,limit)=>{
   const words=text.split(/\s+/),lines=[];let line='';
   for(const word of words){if(line&&line.length+word.length+1>limit){lines.push(line);line=word;}else line+=(line?' ':'')+word;}
   if(line)lines.push(line);
   return lines.length>2?[lines[0],lines[1].slice(0,limit-1)+'…']:lines;
  };
  for(const group of groups.filter(g=>!g.faint).sort((a,b)=>b.nodes.length-a.nodes.length)){
   const part=group.parts[0],xs=part.map(n=>n.x),ys=part.map(n=>n.y),middle=xs.reduce((a,b)=>a+b,0)/xs.length,labelWidth=width<600?Math.min(160,(width-44)/2):214,lines=wrap(group.title,Math.floor(labelWidth/6.2)),height=18+lines.length*17;
   const positions=[],minY=Math.min(...ys),maxY=Math.max(...ys),middleY=(minY+maxY)/2;
   const xPositions=[middle-labelWidth/2,Math.min(...xs)-labelWidth-24,Math.max(...xs)+24,16,width-labelWidth-16];
   // Labels seek real free space. They never push nodes into rows or overlap
   // another caption; dense phone views can extend the scrollable canvas.
   for(let y=top;y<=Math.max(maxY+240,top+groups.length*34);y+=14)for(const x of xPositions){
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
 influences(points,radius,phase=0){
  const balls=[];
  for(const point of points){
   let seed=0;for(const char of point.id)seed=(seed*31+char.charCodeAt(0))>>>0;
   const angle=seed%628/100,breath=Math.sin(phase+angle)*1.6;
   balls.push({x:point.x,y:point.y,radius:radius+breath,weight:1,ripple:angle});
   // Small fixed lobes make an organic contour even around a singleton. Only
   // radii breathe; the data anchors never move.
   for(const offset of [0,2.2,4.5])balls.push({x:point.x+Math.cos(angle+offset)*radius*.54,y:point.y+Math.sin(angle+offset)*radius*.54,radius:radius*.6+breath*.5,weight:.22});
  }
  return balls;
 },
 field(x,y,balls,foreign=[]){
  let value=0;
  for(const ball of balls){const angle=Math.atan2(y-ball.y,x-ball.x),radius=ball.radius*(ball.ripple===undefined?1:1+.075*Math.sin(angle*3+ball.ripple)+.035*Math.cos(angle*5-ball.ripple)),d=((x-ball.x)**2+(y-ball.y)**2)/(radius**2);if(d<12)value+=ball.weight*Math.exp(-d*1.4);}
  // A background cloud cannot imply membership at an unrelated node. Carve
  // a small clear area around foreign markers, without changing their layout.
  for(const node of foreign){const d=((x-node.x)**2+(y-node.y)**2)/400;if(d<1)value=Math.min(value,d*.62);}
  return value;
 },
 contours(points,foreign=[],radius=34,phase=0,step=8){
  if(!points.length)return [];
  const padding=radius*2.4,left=Math.floor((Math.min(...points.map(p=>p.x))-padding)/step)*step,top=Math.floor((Math.min(...points.map(p=>p.y))-padding)/step)*step,right=Math.ceil((Math.max(...points.map(p=>p.x))+padding)/step)*step,bottom=Math.ceil((Math.max(...points.map(p=>p.y))+padding)/step)*step;
  const columns=Math.round((right-left)/step)+1,rows=Math.round((bottom-top)/step)+1,values=new Float32Array(columns*rows),balls=this.influences(points,radius,phase),masks=foreign.filter(n=>n.x>=left-20&&n.x<=right+20&&n.y>=top-20&&n.y<=bottom+20);
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
    const own=new Set(group.nodes.map(n=>n.id)),foreign=state.nodes.filter(n=>!own.has(n.id)),radius=group.kind==='scene'?34:46;
    for(const part of group.parts){
     const minY=Math.min(...part.map(n=>n.y))-radius*2.4,maxY=Math.max(...part.map(n=>n.y))+radius*2.4;
     if(maxY<state.scrollTop||minY>state.scrollTop+state.height)continue;
     const contours=StoryClouds.contours(part,foreign,radius,phase),path=new Path2D();
     for(const loop of contours){const last=loop.at(-1),first=loop[0];path.moveTo((last.x+first.x)/2,(last.y+first.y)/2);loop.forEach((p,i)=>{const next=loop[(i+1)%loop.length];path.quadraticCurveTo(p.x,p.y,(p.x+next.x)/2,(p.y+next.y)/2);});path.closePath();}
     const gradient=context.createLinearGradient(0,minY,0,maxY);gradient.addColorStop(0,'rgba(222,230,241,.68)');gradient.addColorStop(1,'rgba(217,226,238,.32)');
     context.globalAlpha=group.faint?.16:group.kind==='scene'?.85:.72;context.fillStyle=contrast.matches?'rgba(214,220,229,.8)':gradient;context.fill(path,'evenodd');
     context.strokeStyle=contrast.matches?'#8994a5':'rgba(151,167,189,.42)';context.lineWidth=1;context.stroke(path);
     context.save();context.translate(0,-1);context.strokeStyle='rgba(255,255,255,.85)';context.stroke(path);context.restore();
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
