'use strict';
// Qualitative geography for a timeline, not guessed map coordinates.
// Unknown, mobile, dream and border sites do not acquire fictional countries.
const GeographyAtlas={
 create(entities,geography={}){
  const places=new Map();
  for(const entity of entities||[])if(entity.kind==='location')
   places.set(entity.id,{id:entity.id,name:entity.name,kind:'place',parent:entity.parent_id||null,spatial:'fixed'});
  for(const region of geography.regions||[]){
   if(places.has(region.id))throw new Error('Duplicate geographic region: '+region.id);
   places.set(region.id,{id:region.id,name:region.name,kind:region.kind||'area',parent:null,spatial:'fixed'});
  }
  for(const [id,kind] of Object.entries(geography.kinds||{})){
   if(!places.has(id))throw new Error('Unknown geographic kind: '+id);
   places.get(id).kind=kind;
  }
  const equivalents=geography.equivalents||{};
  function canonical(id){
   const seen=new Set();
   while(equivalents[id]){
    if(seen.has(id))throw new Error('Geography equivalence cycle: '+id);
    seen.add(id);id=equivalents[id];
   }
   return id;
  }
  for(const [id,target] of Object.entries(equivalents)){
   if(!places.has(id)||!places.has(canonical(target)))throw new Error('Unknown geography equivalent: '+id);
  }
  for(const [id,parent] of Object.entries(geography.parents||{})){
   if(!places.has(id)||!places.has(parent))throw new Error('Unknown geography parent: '+id+' / '+parent);
   const record=places.get(id);
   const original=record.parent;
   // Only accept a refinement of the authoritative hierarchy. A new
   // intermediate building must eventually lead to the original parent.
   if(original&&original!==parent){
    let at=parent,seen=new Set();
    while(at&&at!==original&&!seen.has(at)){
     seen.add(at);at=geography.parents?.[at]||places.get(at)?.parent||null;
    }
    if(at!==original)throw new Error('Geography contradicts source parent: '+id+' / '+original);
   }
   record.parent=parent;
  }
  for(const [id,spatial] of Object.entries(geography.spatial||{})){
   if(!places.has(id))throw new Error('Unknown geography spatial state: '+id);
   places.get(id).spatial=spatial;
  }
  function path(id){
   id=canonical(id);
   const chain=[],seen=new Set();
   while(id){
    if(seen.has(id))throw new Error('Geography parent cycle: '+id);
    seen.add(id);
    const node=places.get(id);
    if(!node)return [];
    chain.push(node);
    id=node.parent?canonical(node.parent):null;
   }
   return chain;
  }
  for(const id of places.keys())path(id); // Validate even unused records.
  const paths=new Map([...places.keys()].map(id=>[id,path(id)]));
  function resolve(id){
   if(!id||!places.has(id))return {id:id||null,state:'unknown',country:null,settlement:null,path:[]};
   const p=paths.get(id);
   const state=p.some(x=>['unspecified','mobile','non_geographic'].includes(x.spatial))?'unlocated':'located';
   const country=p.find(x=>x.kind==='country')||null,settlement=p.find(x=>x.kind==='settlement')||null;
   return {id:canonical(id),state,country:state==='located'?country?.id||null:null,
    settlement:state==='located'?settlement?.id||null:null,path:p.map(x=>x.id)};
  }
  function relation(a,b){
   const one=resolve(a),two=resolve(b);
   if(one.state!=='located'||two.state!=='located')return {grade:null,scope:'unknown'};
   if(one.id===two.id)return {grade:0,scope:'same_site'};
   const bNodes=new Set(two.path),common=paths.get(one.id).find(x=>bNodes.has(x.id));
   if(common){
    if(['room','building'].includes(common.kind))return {grade:1,scope:'same_building'};
    if(common.kind==='settlement')return {grade:2,scope:'same_settlement'};
    if(common.kind==='country')return {grade:3,scope:'same_country'};
    // Conservatively treat the same known non-country area as a locality.
    return {grade:2,scope:'same_area'};
   }
   if(one.country&&two.country&&one.country!==two.country)return {grade:4,scope:'different_countries'};
   return {grade:null,scope:'unknown'};
  }
  function visualSeparation(a,b){
   const result=relation(a,b);
   // Units are relative lane distances, not kilometres. Use only within
   // a near-time pair and keep the force soft, never rigid country rows.
   const values=[
    {wanted:.06,factor:.018},
    {wanted:.11,factor:.028},
    {wanted:.20,factor:.042},
    {wanted:.44,factor:.065},
    {wanted:.87,factor:.12}
   ];
   return result.grade===null?null:{...result,...values[result.grade]};
  }
  function audit(events=[],scenes=[]){
   const counts=new Map(),unknownRefs=new Map();
   for(const scene of scenes){
    const id=scene.location_id||null;
    const r=resolve(id),key=id||'(missing)';
    const old=counts.get(key)||{id:key,scenes:0,unknown:0,country:r.country,state:r.state};
    old.scenes++;if(r.state!=='located'||!r.country)old.unknown++;
    counts.set(key,old);
   }
   for(const event of events)if(event.location_id&&!places.has(event.location_id))
    unknownRefs.set(event.location_id,(unknownRefs.get(event.location_id)||0)+1);
   const unresolved=[...counts.values()].filter(item=>item.unknown)
    .sort((a,b)=>b.unknown-a.unknown||a.id.localeCompare(b.id));
   return {locations:places.size,unresolved,unknownReferences:[...unknownRefs].map(([id,events])=>({id,events}))};
  }
  function movementFlags(events=[]){
   const byCharacter=new Map();
   for(const event of events){
    if(!Number.isFinite(event.day))continue;
    const r=resolve(event.location_id);
    if(r.state!=='located'||!r.country)continue;
    for(const id of new Set(event.physical||[])){
     if(!byCharacter.has(id))byCharacter.set(id,[]);
     byCharacter.get(id).push({id:event.id,scene:event.scene_id,day:event.day,place:event.location_id,country:r.country});
    }
   }
   const flags=[],seen=new Set();
   for(const [character,records] of byCharacter){
    records.sort((a,b)=>a.day-b.day||a.id.localeCompare(b.id));
    const byDay=new Map();
    for(const r of records){
     const day=Math.floor(r.day);if(!byDay.has(day))byDay.set(day,[]);
     byDay.get(day).push(r);
    }
    for(const [day,list] of byDay){
     const countries=new Map();
     for(const r of list)if(!countries.has(r.country))countries.set(r.country,r);
     if(countries.size<2)continue;
     const choices=[...countries.values()];
     for(let i=0;i<choices.length;i++)for(let j=i+1;j<choices.length;j++){
      const a=choices[i],b=choices[j],key=character+'|'+day+'|'+[a.country,b.country].sort().join('|');
      if(seen.has(key))continue;seen.add(key);
      flags.push({character,day,a:a.id,b:b.id,countries:[a.country,b.country],severity:'review',
       reason:'Same calendar day in different confirmed countries; check time order, travel, clones and chronology. Not proof of an error.'});
     }
    }
   }
   return flags;
  }
  return {places,resolve,relation,visualSeparation,audit,movementFlags};
 }
};
if(typeof module!=='undefined')module.exports=GeographyAtlas;
