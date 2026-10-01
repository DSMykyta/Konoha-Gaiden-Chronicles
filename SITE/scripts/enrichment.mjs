import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const boundaryEventId=value=>typeof value==='string'?value.replace(/\.(?:start|end)$/,''):null;

export function loadEnrichment({source, relative, project, entities, events, sourceIds}) {
 const root=path.join(source,relative),knownEntities=new Set(entities.map(e=>e.id)),knownEvents=new Set(events.map(e=>e.id)),eventMap=new Map(events.map(e=>[e.id,e]));
 const readOptional=(file,fallback)=>fs.existsSync(path.join(root,file))?YAML.parse(fs.readFileSync(path.join(root,file),'utf8')):fallback;
 const media=readOptional('event-media.yaml',{media:[]}).media||[];
 const legacyProfiles=readOptional('character-profiles.yaml',{profiles:[]}).profiles||[];
 const abilityRows=readOptional('abilities.yaml',{abilities:[]}).abilities||[];
 const abilityMap=new Map();
 for(const ability of abilityRows){
  if(!ability?.id||abilityMap.has(ability.id))throw Error('Missing/duplicate ability ID');
  abilityMap.set(ability.id,ability);
 }
 const outDir=path.join(project,'public','media');fs.rmSync(outDir,{recursive:true,force:true});
 const asset=value=>{
  if(!value)return null;
  if(/^https:\/\//.test(value)){new URL(value);return value;}
  if(value.startsWith('/')||value.includes('\\')||value.split('/').includes('..'))throw Error('Unsafe media path: '+value);
  if(!value.startsWith('media/')||!/^.+\.(png|jpe?g|webp|avif)$/i.test(value))throw Error('Media must be an image under CHRONOLOGY/data/media: '+value);
  const src=path.join(root,value);if(!fs.existsSync(src))throw Error('Missing media asset: '+value);
  const dst=path.join(project,'public',value);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(src,dst);return value;
 };
 const mediaIds=new Set();
 for(const item of media){
  if(!item.id||mediaIds.has(item.id))throw Error('Missing/duplicate media ID');mediaIds.add(item.id);
  if(!knownEvents.has(item.event_id))throw Error('Unknown media event: '+item.event_id);
  if(!sourceIds.has(item.source_id))throw Error('Unknown media source: '+item.source_id);
  if(!item.alt||!item.locator||!item.src)throw Error('Media requires src, alt and locator: '+item.id);
  item.src=asset(item.src);
 }

 const temporalDir=path.join(root,'character-profiles');
 const temporalProfiles=[];
 const compiledTemporal=[];
 if(fs.existsSync(temporalDir)){
  const files=fs.readdirSync(temporalDir).filter(file=>/\.ya?ml$/i.test(file)).sort();
  const temporalEntityIds=new Set();
  for(const file of files){
   const doc=YAML.parse(fs.readFileSync(path.join(temporalDir,file),'utf8'))||{};
   if(doc.schema_version!==2)throw Error('Temporal profile schema_version must be 2: '+file);
   if(!doc.entity_id||!knownEntities.has(doc.entity_id)||temporalEntityIds.has(doc.entity_id))throw Error('Unknown/duplicate temporal profile: '+doc.entity_id);
   temporalEntityIds.add(doc.entity_id);
   const states=doc.states||[];
   if(!states.length)throw Error('Temporal profile requires states: '+doc.entity_id);
   const stateIds=new Set(),facts=new Map(),abilities=new Map(),relationships=new Map();
   let summary=null,image=null,imageAlt=null,appearance={},traits=[],goals=[],equipment=[],sections=[],knowledge={};
   const versions=[];
   const runtimeStates=[];
   for(const state of states){
    if(!state?.id||stateIds.has(state.id))throw Error('Missing/duplicate temporal profile state: '+doc.entity_id);stateIds.add(state.id);
    if(!state.label)throw Error('Temporal profile state label required: '+state.id);
    if(state.age!==undefined&&(!Number.isInteger(state.age)||state.age<0))throw Error('Invalid temporal profile age: '+state.id);
    for(const ref of [state.from,state.to]){
     const eventId=boundaryEventId(ref);
     if(ref&&(!eventId||!knownEvents.has(eventId)))throw Error('Unknown temporal profile event boundary: '+ref);
    }
    if(state.summary!==undefined)summary=state.summary;
    if(state.image!==undefined)image=asset(state.image);
    if(state.image_alt!==undefined)imageAlt=state.image_alt;
    if(state.knowledge!==undefined)knowledge={...knowledge,...clone(state.knowledge)};
    for(const [key,value] of Object.entries(state.facts?.set||{})){
     const object=value&&typeof value==='object'&&!Array.isArray(value)?value:{value};
     facts.set(key,{key,label:object.label||key,value:object.value??''});
    }
    for(const key of state.facts?.remove||[])facts.delete(key);
    if(state.appearance?.set)appearance={...appearance,...clone(state.appearance.set)};
    for(const key of state.appearance?.remove||[])delete appearance[key];
    const personality=state.personality?.set;
    if(personality&&personality.core_traits!==undefined)traits=clone(personality.core_traits)||[];
    const drives=state.drives?.set;
    if(drives&&drives.goals!==undefined)goals=(clone(drives.goals)||[]).map(goal=>typeof goal==='string'?goal:goal?.text).filter(Boolean);
    for(const [id,value] of Object.entries(state.abilities?.upsert||{})){
     if(abilityMap.size&&!abilityMap.has(id))throw Error('Unknown ability in temporal profile: '+id);
     const registry=abilityMap.get(id)||{};
     abilities.set(id,{id,name:value?.name||registry.name||id,...clone(value)});
    }
    for(const id of state.abilities?.remove||[])abilities.delete(id);
    for(const [entityId,value] of Object.entries(state.relationships?.upsert||{})){
     if(!knownEntities.has(entityId))throw Error('Unknown relationship entity in temporal profile: '+entityId);
     relationships.set(entityId,{entity_id:entityId,...clone(value)});
    }
    for(const entityId of state.relationships?.remove||[])relationships.delete(entityId);
    if(state.equipment?.set!==undefined)equipment=clone(state.equipment.set)||[];
    for(const value of state.equipment?.add||[])if(!equipment.includes(value))equipment.push(clone(value));
    if(state.equipment?.remove?.length)equipment=equipment.filter(value=>!state.equipment.remove.includes(value));
    if(Array.isArray(state.sections))sections=clone(state.sections);
    else if(state.sections?.set!==undefined)sections=clone(state.sections.set)||[];
    const parentDisplay=state.knowledge?.family?.parents?.display_value||knowledge?.family?.parents?.display_value;
    if(parentDisplay)facts.set('parents',{key:'parents',label:'Батьки',value:parentDisplay});
    const legacyAppearance={};
    for(const key of ['hair','eyes','features','clothing'])if(appearance[key]!==undefined&&appearance[key]!==null)legacyAppearance[key]=appearance[key];
    const version={
     id:state.id,label:state.label,age:state.age,period_id:state.period_id,
     image,image_alt:imageAlt,summary,
     facts:[...facts.values()].map(clone),appearance:legacyAppearance,
     traits:clone(traits),goals:clone(goals),abilities:[...abilities.values()].map(clone),relationships:[...relationships.values()].map(clone),equipment:clone(equipment),sections:clone(sections)
    };
    versions.push(version);
    const fromId=boundaryEventId(state.from),toId=boundaryEventId(state.to);
    runtimeStates.push({...clone(state),from_day:fromId?(eventMap.get(fromId)?.day??null):null,to_day:toId?(eventMap.get(toId)?.day??null):null});
   }
   compiledTemporal.push({entity_id:doc.entity_id,display_name:doc.display?.name||doc.display_name||doc.entity_id,versions});
   temporalProfiles.push({...clone(doc),states:runtimeStates});
  }
 }

 const profiles=legacyProfiles.map(clone);
 for(const temporal of compiledTemporal){
  const index=profiles.findIndex(profile=>profile.entity_id===temporal.entity_id);
  if(index>=0)profiles[index]=temporal;else profiles.push(temporal);
 }
 const profileIds=new Set();
 for(const profile of profiles){
  if(!knownEntities.has(profile.entity_id)||profileIds.has(profile.entity_id))throw Error('Unknown/duplicate profile: '+profile.entity_id);profileIds.add(profile.entity_id);
  const versionIds=new Set();
  for(const version of profile.versions||[]){
   if(!version.id||versionIds.has(version.id))throw Error('Missing/duplicate profile version');versionIds.add(version.id);
   if(!version.label)throw Error('Profile version label required');
   if(version.age!==undefined&&(!Number.isInteger(version.age)||version.age<0))throw Error('Invalid profile age');
   version.image=asset(version.image);
  }
 }
 return {media,profiles,abilities:abilityRows,character_profiles_v2:temporalProfiles};
}
