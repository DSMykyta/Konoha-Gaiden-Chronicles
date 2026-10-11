'use strict';
// Pure screen-space geometry. Source chronology, IDs, and strand coordinates never change.
const LiquidNodes = {
 radius(kind,numbered=false) {
  if(kind==='arc-cluster')return 24;
  if(kind==='arc')return 20;
  if(kind==='episode')return 15;
  if(kind==='scene')return 11;
  return numbered?11:7;
 },
 smooth(t){t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);},
 // Only members of the same narrative group, or an explicit zoom parent/child
 // transition, may develop a fluid neck. Unrelated neighboring strands stay separate.
 connections(nodes,groups,transitions=[]){
  const visible=new Map(nodes.filter(n=>n.opacity>.12).map(n=>[n.id,n]));
  const pairs=new Map(),degrees=new Map();
  const add=(a,b,transition=1)=>{
   if(!a||!b||a.id===b.id||transition<.015)return;
   const key=[a.id,b.id].sort().join('|');
   if(pairs.has(key)){pairs.get(key).transition=Math.max(pairs.get(key).transition,transition);return;}
   const rA=this.radius(a.kind,a.numbered),rB=this.radius(b.kind,b.numbered);
   const distance=Math.hypot(a.x-b.x,a.y-b.y);
   const reach=rA+rB+Math.max(7,Math.min(19,Math.min(rA,rB)*1.15));
   if(distance<=.1||distance>=reach)return;
   const contact=this.smooth((reach-distance)/(reach-(rA+rB)*.55));
   if(contact<.012)return;
   pairs.set(key,{a,b,rA,rB,strength:contact*transition,transition});
  };
  for(const group of groups){
   const seen=new Set(),members=[];
   for(const anchor of group.nodes||[]){
    const n=visible.get(anchor.id);
    if(n&&!seen.has(n.id)){seen.add(n.id);members.push(n);}
   }
   members.sort((a,b)=>a.x-b.x||a.y-b.y);
   for(let i=0;i<members.length;i++){
    const a=members[i],limit=a.x+2*this.radius('arc-cluster')+22;
    for(let j=i+1;j<members.length&&members[j].x<limit&&j<i+7;j++)add(a,members[j]);
   }
  }
  // Fine/coarse bridges do not necessarily share a current visible cloud.
  for(const bridge of transitions){
   const a=visible.get(bridge.key);
   if(!a)continue;
   const b=nodes.find(n=>n.id!==a.id&&n.opacity>.12&&Math.hypot(n.x-bridge.toX,n.y-bridge.toY)<.75);
   add(a,b,bridge.strength);
  }
  // Prevent visually solid puddles in dense scenes. Each mark may connect to
  // only the closest three partners, keeping the drawn shape legible.
  return [...pairs.values()].sort((x,y)=>Math.hypot(x.a.x-x.b.x,x.a.y-x.b.y)-Math.hypot(y.a.x-y.b.x,y.a.y-y.b.y))
   .filter(pair=>{
    const a=degrees.get(pair.a.id)||0,b=degrees.get(pair.b.id)||0;
    if(a>=3||b>=3)return false;
    degrees.set(pair.a.id,a+1);degrees.set(pair.b.id,b+1);return true;
   });
 },
 neck(pair){
  const {a,b,rA,rB,strength}=pair,dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy);
  if(dist<.1||strength<.012)return '';
  const ux=dx/dist,uy=dy/dist,nx=-uy,ny=ux;
  const gap=Math.max(2,dist-rA*.68-rB*.68),width=Math.min(rA,rB)*(.15+.46*this.smooth(strength));
  const start={x:a.x+ux*rA*.68,y:a.y+uy*rA*.68};
  const end={x:b.x-ux*rB*.68,y:b.y-uy*rB*.68};
  const wA=Math.min(rA*.76,width*1.12),wB=Math.min(rB*.76,width*.9);
  const f=n=>Number(n.toFixed(3));
  const point=(p,ox,oy)=>`${f(p.x+ox)},${f(p.y+oy)}`;
  const c1={x:start.x+ux*gap*.43,y:start.y+uy*gap*.43},c2={x:end.x-ux*gap*.43,y:end.y-uy*gap*.43};
  return `M${point(start,nx*wA,ny*wA)} C${point(c1,nx*width,ny*width)} ${point(c2,nx*width*.84,ny*width*.84)} ${point(end,nx*wB,ny*wB)} L${point(end,-nx*wB,-ny*wB)} C${point(c2,-nx*width*.84,-ny*width*.84)} ${point(c1,-nx*width,-ny*width)} ${point(start,-nx*wA,-ny*wA)} Z`;
 },
 rim(x,y,r){
  const start=-146*Math.PI/180,end=-35*Math.PI/180;
  const point=angle=>[Number((x+Math.cos(angle)*r*.86).toFixed(3)),Number((y+Math.sin(angle)*r*.86).toFixed(3))];
  const a=point(start),b=point(end);
  return `M${a[0]},${a[1]} A${(r*.86).toFixed(3)},${(r*.86).toFixed(3)} 0 0 1 ${b[0]},${b[1]}`;
 }
};
if(typeof module!=='undefined')module.exports=LiquidNodes;
