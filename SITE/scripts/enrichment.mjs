import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

export function loadEnrichment({source, relative, project, entities, events, sourceIds}) {
 const root=path.join(source,relative),knownEntities=new Set(entities.map(e=>e.id)),knownEvents=new Set(events.map(e=>e.id));
 const readOptional=(file,fallback)=>fs.existsSync(path.join(root,file))?YAML.parse(fs.readFileSync(path.join(root,file),'utf8')):fallback;
 const media=readOptional('event-media.yaml',{media:[]}).media||[];
 const profiles=readOptional('character-profiles.yaml',{profiles:[]}).profiles||[];
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
 return {media,profiles};
}
