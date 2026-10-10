'use strict';
// One continuous semantic stream. Nodes retain their source event IDs while
// their visual anchors flow toward parents; no animation loop changes the data.
const TimelineFlow = {
 levels:['moment','scene','episode','arc'],
 boundaries:[
  {fine:'moment',coarse:'scene',pivot:Math.sqrt(365*(365/7))},
  {fine:'scene',coarse:'episode',pivot:Math.sqrt((365/7)*12)},
  {fine:'episode',coarse:'arc',pivot:Math.sqrt(12)}
 ],
 clamp(t){return Math.max(0,Math.min(1,t));},
 smooth(t){t=this.clamp(t);return t*t*(3-2*t);},
 lerp(a,b,t){return a+(b-a)*t;},
 state(zoom){
  const z=Math.log(Math.max(.001,zoom)),half=.36;
  for(const boundary of this.boundaries){
   const mid=Math.log(boundary.pivot);
   if(z>mid+half)return {fine:boundary.fine,coarse:null,t:0};
   if(z>=mid-half)return {...boundary,t:this.smooth((mid+half-z)/(half*2))};
  }
  return {fine:'arc',coarse:null,t:0};
 },
 // Pick the calendar coordinate physically under the cursor, not the canvas
 // center. When collapsed calendar gaps exist, the caller provides its scale.
 axisUnderPixel(x,scale,lo,hi){
  let a=lo,b=hi;
  for(let i=0;i<22;i++){
   const m=(a+b)/2;
   if(scale.axisPx(m)<x)a=m;else b=m;
  }
  return (a+b)/2;
 },
 zoomCenter({pivot,position,width,pad,total,nextZoom}){
  const plot=Math.max(1,width-2*pad);
  const fraction=this.clamp((position-pad)/plot);
  return pivot+(.5-fraction)*total/nextZoom;
 },
 // Screen-space arc collision, not chronological merging. Related but distant
 // arcs remain separate until their actual marks are close enough to touch.
 clusterArcs(arcs,enter=76,solid=22){
  const ordered=[...arcs].filter(n=>n.kind==='arc').sort((a,b)=>a.day-b.day||a.id.localeCompare(b.id));
  const groups=[],assigned=new Set();
  for(const a of ordered){
   if(assigned.has(a.id))continue;
   const members=[a];assigned.add(a.id);
   for(const b of ordered){
    if(assigned.has(b.id))continue;
    const x=members.reduce((s,n)=>s+n.x,0)/members.length;
    const y=members.reduce((s,n)=>s+n.y,0)/members.length;
    if(Math.hypot(b.x-x,b.y-y)<enter){members.push(b);assigned.add(b.id);}
   }
   if(members.length<2)continue;
   const centroid={x:members.reduce((s,n)=>s+n.x,0)/members.length,
    y:members.reduce((s,n)=>s+n.y,0)/members.length,
    day:members.reduce((s,n)=>s+n.day,0)/members.length};
   // Use pairwise separation, not radius to centroid: at the exact
   // entrance distance the blending factor MUST start at zero.
   const separation=Math.max(...members.flatMap((n,i)=>members.slice(i+1).map(m=>Math.hypot(n.x-m.x,n.y-m.y))));
   const strength=this.smooth((enter-separation)/(enter-solid));
   if(strength<=0)continue;
   groups.push({members,centroid,strength});
  }
  return groups;
 }
};
if(typeof module!=='undefined')module.exports=TimelineFlow;
