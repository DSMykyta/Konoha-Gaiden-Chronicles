'use strict';
// One continuously deforming liquid silhouette. Circles share a metaball
// field only when their underlying source events overlap. No ghost marks,
// crossfades or unrelated visual mergers.
const LiquidBody=(()=>{
 const NS='http://www.w3.org/2000/svg',DURATION=380;
 let state=null,frame=null,lastZoom=null,rootLayer=null;
 const ease=t=>{t=Math.min(1,Math.max(0,t));return t*t*(3-2*t);};
 const datum=n=>({...n,events:(n.group||[]).map(e=>e.id),
  radius:LiquidNodes.radius(n.kind,!!n.numbered)*Math.sqrt(Math.max(0,n.opacity??1))});
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const overlap=(a,b)=>{const set=new Set(a.events||[]);return (b.events||[]).filter(id=>set.has(id)).length;};
 const closest=(a,list)=>{
  let best=null,score=-Infinity;
  for(const b of list){
   const shared=overlap(a,b);if(!shared&&a.id!==b.id)continue;
   const s=(a.id===b.id?1e9:0)+shared*1e4-distance(a,b);
   if(s>score){score=s;best=b;}
  }
  return best;
 };
 function plan(previous,next){
  const old=new Map(previous.map(n=>[n.id,n])),ids=new Set(next.map(n=>n.id));
  const result=[];
  for(const to of next){
   const same=old.get(to.id),ancestor=same||closest(to,previous);
   result.push({id:to.id,visibleId:to.id,events:to.events,
    from:ancestor?{...ancestor,radius:same?ancestor.radius:0}:to,to});
  }
  for(const from of previous){
   if(ids.has(from.id))continue;
   const to=closest(from,next);if(!to)continue;
   result.push({id:from.id,visibleId:to.id,events:from.events,
    from,to:{...to,radius:0}});
  }
  return result;
 }
 function groups(particles){
  const parent=particles.map((_,i)=>i),first=new Map(),find=i=>parent[i]===i?i:(parent[i]=find(parent[i]));
  particles.forEach((p,i)=>{for(const id of p.events||[]){
   if(first.has(id)){const a=find(i),b=find(first.get(id));if(a!==b)parent[b]=a;}
   else first.set(id,i);
  }});
  const result=new Map();
  particles.forEach((p,i)=>{const key=find(i);if(!result.has(key))result.set(key,[]);result.get(key).push(p);});
  return [...result.values()];
 }
 const el=(tag,props={},parent)=>{
  const n=document.createElementNS(NS,tag);
  for(const [k,v] of Object.entries(props))n.setAttribute(k,String(v));
  parent?.appendChild(n);return n;
 };
 function filter(defs){
  const f=el('filter',{id:'liquid-body-union',x:'-30%',y:'-30%',width:'160%',height:'160%',colorInterpolationFilters:'sRGB'},defs);
  el('feGaussianBlur',{in:'SourceAlpha',stdDeviation:'3.8',result:'blur'},f);
  el('feColorMatrix',{in:'blur',type:'matrix',values:'0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 20 -6.8',result:'joined'},f);
  el('feFlood',{'flood-color':'#b8dbea','flood-opacity':'.80',result:'color'},f);
  el('feComposite',{in:'color',in2:'joined',operator:'in',result:'body'},f);
  el('feMorphology',{in:'joined',operator:'dilate',radius:'.9',result:'wide'},f);
  el('feComposite',{in:'wide',in2:'joined',operator:'out',result:'rim'},f);
  el('feFlood',{'flood-color':'#f9fdff','flood-opacity':'.9',result:'highlight'},f);
  el('feComposite',{in:'highlight',in2:'rim',operator:'in',result:'edge'},f);
  const merge=el('feMerge',{},f);
  el('feMergeNode',{in:'body'},merge);el('feMergeNode',{in:'edge'},merge);
 }
 function current(){
  if(!state)return [];
  const t=state.start?ease(((typeof performance!=='undefined'?performance.now():Date.now())-state.start)/DURATION):1;
  return state.particles.map(p=>({...p.to,id:p.id,events:p.events,
   group:p.events.map(id=>({id})),
   x:p.from.x+(p.to.x-p.from.x)*t,y:p.from.y+(p.to.y-p.from.y)*t,
   radius:p.from.radius+(p.to.radius-p.from.radius)*t})).filter(p=>p.radius>.15);
 }
 function visibility(){
  if(!rootLayer?.isConnected||!state)return;
  const nodes=new Map([...document.querySelectorAll('#timeline .node')].map(n=>[n.dataset.event,n]));
  for(const p of state.particles){
   const node=nodes.get(p.visibleId);
   const hidden=!node||['is-line-focus-hidden','is-story-scale-fixed-hidden'].some(c=>node.classList.contains(c));
   const muted=node&&['is-story-scale-hover-muted','is-context-muted'].some(c=>node.classList.contains(c));
   p.element.style.display=hidden?'none':'';
   p.element.style.opacity=muted?'.14':'1';
  }
 }
 function reset(){
  if(frame!==null&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(frame);
  frame=null;state=null;lastZoom=null;rootLayer=null;
 }
 function update(root,nodes,zoom){
  const next=nodes.filter(n=>n.opacity>.012&&Number.isFinite(n.x)&&Number.isFinite(n.y)).map(datum),previous=current();
  if(frame!==null&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(frame);
  frame=null;
  const reduced=typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const moving=previous.length&&lastZoom!==null&&Math.abs(lastZoom-zoom)>1e-7&&!reduced&&typeof performance!=='undefined'&&typeof requestAnimationFrame==='function';
  const particles=moving?plan(previous,next):next.map(n=>({id:n.id,visibleId:n.id,events:n.events,from:n,to:n}));
  lastZoom=zoom;
  const layer=el('g',{class:'liquid-body-layer','aria-hidden':'true'});filter(el('defs',{},layer));
  for(const members of groups(particles)){
   // Each semantic family has a separate filter. Mere proximity does not
   // establish a fictional encounter between unrelated story strands.
   const family=el('g',{class:'liquid-body-group',filter:'url(#liquid-body-union)'},layer);
   for(const p of members)p.element=el('circle',{class:'liquid-body-drop',cx:p.from.x,cy:p.from.y,
    r:Math.max(.01,p.from.radius),fill:'#bddcec','data-liquid-id':p.visibleId},family);
  }
  const first=root.querySelector('.node');
  if(first)root.insertBefore(layer,first);else root.appendChild(layer);
  root.classList.add('has-liquid-body');rootLayer=layer;
  const start=moving?performance.now():0;
  state={particles,start};
  const tick=now=>{
   if(state?.particles!==particles)return;
   const t=moving?ease((now-start)/DURATION):1;
   for(const p of particles){
    p.element.setAttribute('cx',(p.from.x+(p.to.x-p.from.x)*t).toFixed(3));
    p.element.setAttribute('cy',(p.from.y+(p.to.y-p.from.y)*t).toFixed(3));
    p.element.setAttribute('r',Math.max(.01,p.from.radius+(p.to.radius-p.from.radius)*t).toFixed(3));
   }
   visibility();
   if(t<1)frame=requestAnimationFrame(tick);
   else{frame=null;state.start=0;}
  };
  tick(moving?start:0);
 }
 return {update,plan,groups,current,reset,visibility};
})();
if(typeof module!=='undefined')module.exports=LiquidBody;
