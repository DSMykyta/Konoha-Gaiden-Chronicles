import {physicalParticipants} from './mission-windows.mjs';
const lengths=[31,28,31,30,31,30,31,31,30,31,30,31];
export function storyDay(value){
 const d=typeof value==='string'?Object.fromEntries(value.split('-').map(Number).map((n,i)=>[['year','month','day'][i],n])):value;
 return (d.year-1)*365+lengths.slice(0,d.month-1).reduce((a,b)=>a+b,0)+d.day-1;
}
export function validateShippudenPrewar(plan,scenes,links=[]){
 const main=scenes.filter(s=>s.state==='active'&&s.date&&(s.source_continuity_id??s.continuity_id)==='main');
 const byId=new Map(scenes.map(s=>[s.id,s]));
 const fail=message=>{throw Error('Shippuden prewar: '+message);};
 for(const w of plan.reservations){
  const start=storyDay(w.start),end=storyDay(w.end),actors=new Set(w.actors),allowed=new Set(w.allow_scene_ids||[]);
  if(start>end)fail('reversed reservation '+w.id);
  for(const s of main){
   const day=storyDay(s.date)+(s.placement?.day_offset||0);
   if(day<start||day>end||(w.allow_arc_ids||[]).includes(s.arc_id)||allowed.has(s.id))continue;
   const shared=[...physicalParticipants(s)].filter(id=>actors.has(id));
   if(shared.length)fail(`${s.id} borrows ${shared} during ${w.id}`);
  }
 }
 for(const c of plan.intervals){
  const a=byId.get(c.from),b=byId.get(c.to);
  if(!a?.date||!b?.date)fail('missing interval endpoint '+c.id);
  const days=storyDay(b.date)-storyDay(a.date);
  if((c.days!==undefined&&days!==c.days)||(c.min_days!==undefined&&days<c.min_days))fail(`wrong interval ${c.id}: ${days}`);
 }
 const nodes=new Map(main.flatMap(s=>[[s.id,s],...s.events.map(e=>[e.id,s])]));
 for(const l of links.filter(l=>l.id.startsWith('lnk-s2-')&&l.kind==='before')){
  const a=nodes.get(l.a.replace(/\.(start|end)$/,'')),b=nodes.get(l.b.replace(/\.(start|end)$/, ''));
  if(a&&b&&storyDay(a.date)>storyDay(b.date))fail('reversed dated link '+l.id);
 }
 return {reservations:plan.reservations.length,intervals:plan.intervals.length,scope:'main continuity; declared reservations and relative source cues only'};
}
