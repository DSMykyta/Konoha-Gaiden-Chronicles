'use strict';

// Membership comes from source IDs. Packing reserves titles before routing strands.
const StoryLayout = (() => {
 const kinds={arc:'Арка',episode:'Епізод',scene:'Сцена',moment:'Момент',period:'Період'};
 const forms={arc:['арка','арки','арк'],episode:['епізод','епізоди','епізодів'],scene:['сцена','сцени','сцен'],moment:['момент','моменти','моментів']};
 function count(n,kind){const f=forms[kind]||forms.moment;return `${n} ${n%100>=11&&n%100<=14?f[2]:n%10===1?f[0]:n%10>=2&&n%10<=4?f[1]:f[2]}`;}
 function wrap(text,width,measure,max=3){
  const words=String(text).split(/\s+/),lines=[];let line='';
  for(const word of words){
   if(line&&measure(line+' '+word)>width){lines.push(line);line=word;}else line+=(line?' ':'')+word;
  }
  if(line)lines.push(line);
  const clipped=lines.length>max;lines.length=Math.min(max,lines.length);
  for(let i=0;i<lines.length;i++)if(measure(lines[i])>width||clipped&&i===max-1){let value=lines[i];while(value&&measure(value+'…')>width)value=value.slice(0,-1);lines[i]=value+'…';}
  return lines;
 }
 const intersectX=(a,b,gap=12)=>a.x<b.x+b.width+gap&&b.x<a.x+a.width+gap;
 function pack(items,top=0,gap=14){
  const placed=[];
  for(const item of items){
   const blockers=placed.filter(other=>intersectX(item,other,gap));
   const candidates=[top,...blockers.map(other=>other.y+other.height+gap)];
   let y=top;
   for(const candidate of candidates.sort((a,b)=>a-b)){
    if(blockers.every(other=>candidate+item.height+gap<=other.y||candidate>=other.y+other.height+gap)){y=candidate;break;}
   }
   item.y=y;placed.push(item);
  }
  return placed;
 }
 function layout(input,{width,top=150,level,sceneMap,episodeMap,arcMap,scope=null,measure=text=>text.length*6.6,overview=false}){
  const phone=width<=760,pad=phone?12:24,gutter=12,spacing=input.length>1?Math.min(...input.slice(1).map((node,i)=>node.x-input[i].x)):width-pad*2;
  const leafWidth=overview?Math.min(172,spacing-18):Math.min(phone?230:218,width-pad*2-72);
  const leaf=node=>{
   const depth=overview?0:scope?1:({episode:1,scene:2,moment:3}[level]||0),safe=pad+depth*gutter+4;
   const anchorX=Math.max(safe+18,Math.min(width-safe-18,node.x));
   const availableRight=width-safe-anchorX+14,availableLeft=anchorX-safe+14;
   const right=overview||availableRight>=availableLeft;
   const size=Math.min(Math.max(104,leafWidth),overview?availableRight:Math.max(availableRight,availableLeft));
   const x=right?anchorX-14:anchorX-size+14;
   const titleLines=wrap(node.title,size-48,measure,overview?2:3);
   const meta=node.kind==='period'?`${count(node.arcCount,'arc')} · ${count(node.episodeCount,'episode')}`:node.kind==='moment'?'':count(node.childCount,{arc:'episode',episode:'scene',scene:'moment'}[node.kind]);
   const metaLines=meta?wrap(meta,size-48,text=>measure(text)*.84,overview?2:1):[];
   const height=22+titleLines.length*17+metaLines.length*14;
   return {node,x,width:size,height,y:0,anchorX,right,titleLines,meta,metaLines,children:null};
  };
  const root={children:[],kind:null},registry=new Map();
  const container=(kind,id,parent)=>{
   const key=kind+':'+id;
   if(registry.has(key))return registry.get(key);
   const meta=({arc:arcMap,episode:episodeMap,scene:sceneMap})[kind]?.get(id);
   const group={key,kind,id,title:meta?.title||id,children:[],y:0};
   registry.set(key,group);parent.children.push(group);return group;
  };
  for(const node of input){
   let parent=root;
   const sceneId=node.sourceSceneIds?.[0],episodeId=node.kind==='episode'?node.rawId:node.sourceEpisodeIds?.[0],arcId=episodeMap.get(episodeId)?.arc_id;
   if(!overview&&node.kind!=='arc'){
    if((!scope||scope.kind==='arc')&&arcId)parent=container('arc',arcId,parent);
    if(['scene','moment'].includes(node.kind)&&episodeId&&scope?.kind!=='scene')parent=container('episode',episodeId,parent);
    if(node.kind==='moment'&&sceneId)parent=container('scene',sceneId,parent);
   }
   parent.children.push(leaf(node));
  }
  function prepare(item){
   if(!item.children)return;
   item.children.forEach(prepare);
   item.children.sort((a,b)=>(a.day??a.node?.day??0)-(b.day??b.node?.day??0));
   item.day=Math.min(...item.children.map(child=>child.day??child.node.day));
   const xs=item.children.map(child=>child.x),ends=item.children.map(child=>child.x+child.width);
   item.x=Math.max(pad,Math.min(...xs)-gutter);
   item.width=Math.min(width-pad,item.x+Math.max(156,Math.max(...ends)-item.x+gutter))-item.x;
   item.titleLines=wrap(item.title,item.width-28,measure,2);
   const descendants=item.children.flatMap(child=>child.node?[child.node]:child.descendants);
   item.descendants=descendants;
   const ids=new Set(descendants.flatMap(node=>item.kind==='arc'?node.sourceEpisodeIds:item.kind==='episode'?node.sourceSceneIds:node.group.map(e=>e.id)));
   item.meta=count(ids.size,{arc:'episode',episode:'scene',scene:'moment'}[item.kind]);
   item.header=35+item.titleLines.length*17;
   pack(item.children,item.header+10);
   item.height=Math.max(...item.children.map(child=>child.y+child.height))+gutter;
  }
  root.children.forEach(prepare);
  // Spatial groups retain the horizontal chronology. Independent branches can
  // sit beside one another; they are never forced into permanent character rows.
  root.children.sort((a,b)=>(a.day??a.node.day)-(b.day??b.node.day));
  pack(root.children,top,overview?10:22);
  const nodes=[],regions=[];
  function flatten(item,offset=0,parentKey=null){
   const y=offset+item.y;
   if(item.node){
    const labelX=item.right?item.x+30:item.x+10;
    nodes.push({...item.node,x:item.anchorX,y:y+item.height/2,label:{x:labelX,y:y+18,width:item.width-42,height:item.height,lines:item.titleLines,meta:item.meta,metaLines:item.metaLines},bounds:{x:item.x,y,width:item.width,height:item.height},parentKey});
   }else{
    regions.push({key:item.key,kind:item.kind,id:item.id,title:item.title,parentKey,titleLines:item.titleLines,meta:item.meta,bounds:{x:item.x,y,width:item.width,height:item.height},nodes:item.descendants.map(node=>({id:node.id}))});
    item.children.forEach(child=>flatten(child,y,item.key));
   }
  }
  root.children.forEach(item=>flatten(item));
  const bottom=Math.max(top,...root.children.map(item=>item.y+item.height));
  return {nodes,regions,height:bottom+100,kinds,count};
 }
 // A rounded, asymmetric contour follows reserved story bounds, including labels.
 function outline({x,y,width:w,height:h}){
  const r=Math.min(30,w*.14,h*.18);
  return `M${x+r},${y} C${x+w*.38},${y-3} ${x+w*.7},${y+2} ${x+w-r},${y} Q${x+w},${y} ${x+w},${y+r} C${x+w+3},${y+h*.35} ${x+w-2},${y+h*.72} ${x+w},${y+h-r} Q${x+w},${y+h} ${x+w-r},${y+h} C${x+w*.6},${y+h+3} ${x+w*.3},${y+h-1} ${x+r},${y+h} Q${x},${y+h} ${x},${y+h-r} C${x-2},${y+h*.7} ${x+2},${y+h*.3} ${x},${y+r} Q${x},${y} ${x+r},${y} Z`;
 }
 return {layout,wrap,count,kinds,outline,pack};
})();
if(typeof module!=='undefined')module.exports=StoryLayout;
