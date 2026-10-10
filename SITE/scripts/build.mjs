import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import YAML from 'yaml';
import {loadEnrichment} from './enrichment.mjs';
import {validateHierarchy} from './hierarchy.mjs';
import {validateCalendar,dayInYear} from './calendar.mjs';
import {validateMissionWindows} from './mission-windows.mjs';
const project=path.resolve(import.meta.dirname,'..');
const relative='KONOHA_GAIDEN_ARCS_ZIGRANE_POV_V3/CHRONOLOGY/data';
// Vercel builds current repository data. There is no browser GitHub token or write endpoint.
let source=process.env.CHRONOLOGY_SOURCE_ROOT||path.resolve(project,'..');
if(!fs.existsSync(path.join(source,relative))){
 source=path.join('/tmp','konoha-chronology-'+process.pid);
 execFileSync('git',['clone','--depth','1','--filter=blob:none','--sparse','https://github.com/DSMykyta/Konoha-Gaiden-Chronicles.git',source],{stdio:'inherit'});
 execFileSync('git',['-C',source,'sparse-checkout','set',relative],{stdio:'inherit'});
}
const p=path.join(source,relative),repairs=[];
function read(file){return YAML.parse(fs.readFileSync(path.join(p,file),'utf8'));}
const entities=read('entities.yaml'),geography=read('geography.yaml'),anchors=new Map(read('time-anchors.yaml').anchors.map(a=>[a.id,a])),lengths=[31,28,31,30,31,30,31,31,30,31,30,31];
const {calendar:calendarSource,periods}=read('timeline-periods.yaml');
const datedYears=[...anchors.values()].filter(a=>a.date).map(a=>a.date.year);
const firstYear=Math.min(calendarSource.current_year,...datedYears),lastYear=Math.max(calendarSource.current_year,...datedYears);
const calendar={...calendarSource,view_start_year:firstYear,view_end_year:lastYear,view_days:(lastYear-firstYear+1)*calendarSource.days_per_year};
validateCalendar(calendar,periods,[...anchors.values()]);
const anchorCalendar=read('time-anchors.yaml').calendar;
if(anchorCalendar.id!==calendar.id||anchorCalendar.current_year!==calendar.current_year||anchorCalendar.days_per_year!==calendar.days_per_year)throw Error('Calendar registries disagree');
const episodes=read('episodes.yaml').episodes||[],arcs=read('arcs.yaml').arcs||[];
if(new Set(episodes.map(e=>e.id)).size!==episodes.length)throw new Error('Duplicate episode IDs');
if(new Set(arcs.map(a=>a.id)).size!==arcs.length)throw new Error('Duplicate arc IDs');
const episodeMap=new Map(episodes.map(e=>[e.id,e])),arcMap=new Map(arcs.map(a=>[a.id,a]));
for(const episode of episodes)if(!episode.arc_id||!arcMap.has(episode.arc_id))throw new Error('Unknown arc for episode '+episode.id+': '+episode.arc_id);
const sourceScenes=fs.readdirSync(path.join(p,'scenes')).filter(f=>f.endsWith('.yaml')).sort().map(file=>({file,scene:read('scenes/'+file)}));
validateHierarchy({arcs,episodes,scenes:sourceScenes.map(x=>x.scene),periods});
const scenes=[],events=[];
for(const {file,scene:s} of sourceScenes){
 const a=anchors.get(s.placement?.anchor_id),date=a?.date,episode=s.episode_id?episodeMap.get(s.episode_id):null;
 if(s.episode_id&&!episode)throw new Error('Unknown episode '+s.episode_id+' in '+file);
 if(episode&&(episode.continuity_id||'main')!==(s.continuity_id||'main'))throw new Error('Episode continuity mismatch in '+file);
 const day=date?dayInYear(date,s.placement.day_offset||0,calendar,lengths):null;
 const dateStatus=a?.placement_status||'unknown',arcId=episode?.arc_id||null,sourceContinuity=s.continuity_id||'main';
 scenes.push({...s,source_continuity_id:sourceContinuity,continuity_id:'main',arc_id:arcId,day,date,date_status:dateStatus,file});
 for(const e of s.events||[]){const physical=(e.involvement||[]).filter(i=>['physical','physical_hidden'].includes(i.mode)&&i.role!=='mentioned').map(i=>i.entity_id),tracks=(e.involvement||[]).filter(i=>i.role!=='mentioned'&&i.mode!=='remote').map(i=>i.entity_id);events.push({...e,layer:e.layer||s.layer||null,scene_id:s.id,scene_title:s.title,episode_id:s.episode_id||null,arc_id:arcId,day,date_status:dateStatus,continuity:'main',source_continuity:sourceContinuity,scene_state:s.state,review:s.review||{},location_id:s.location_id,physical,tracks,file});}
}
const episodeViews=episodes.map(episode=>{const members=scenes.filter(s=>s.episode_id===episode.id&&s.state!=='inactive').sort((a,b)=>a.display_rank!==undefined&&b.display_rank!==undefined&&a.display_rank!==b.display_rank?a.display_rank-b.display_rank:0),dated=members.map(s=>s.day).filter(d=>d!==null);return {...episode,source_continuity_id:episode.continuity_id||'main',continuity_id:'main',scene_ids:members.map(s=>s.id),day_start:dated.length?Math.min(...dated):null,day_end:dated.length?Math.max(...dated):null};});
const arcViews=arcs.map(arc=>{const members=episodeViews.filter(e=>e.arc_id===arc.id),dated=members.flatMap(e=>[e.day_start,e.day_end]).filter(d=>d!==null);return {...arc,source_continuity_id:arc.continuity_id||'main',continuity_id:'main',episode_ids:members.map(e=>e.id),day_start:dated.length?Math.min(...dated):null,day_end:dated.length?Math.max(...dated):null};});
if(new Set(events.map(e=>e.id)).size!==events.length)throw new Error('Duplicate event IDs');
const known=new Set(entities.entities.map(e=>e.id));for(const e of events)for(const id of e.tracks)if(!known.has(id))throw new Error('Unknown entity '+id);
// Geographic topology is deliberately separate from storyline YAML. Unknown
// countries are retained as review items instead of being assigned a guess.
const locationIds=new Set(entities.entities.filter(e=>e.kind==='location').map(e=>e.id));
const geographicIds=new Set([...locationIds,...(geography.regions||[]).map(region=>region.id)]);
if(geographicIds.size!==locationIds.size+(geography.regions||[]).length)throw new Error('Duplicate geographic region ID');
for(const id of Object.keys(geography.kinds||{}))if(!geographicIds.has(id))throw new Error('Unknown location kind: '+id);
for(const [id,parent] of Object.entries(geography.parents||{}))
 if(!geographicIds.has(id)||!geographicIds.has(parent))throw new Error('Unknown geography parent: '+id+' / '+parent);
for(const [id,parent] of Object.entries(geography.equivalents||{}))
 if(!locationIds.has(id)||!geographicIds.has(parent))throw new Error('Unknown equivalent location: '+id);
for(const id of Object.keys(geography.spatial||{}))if(!locationIds.has(id))throw new Error('Unknown spatial location: '+id);
const geographicUnknown=scenes.filter(scene=>scene.state!=='inactive'&&(!scene.location_id||!locationIds.has(scene.location_id)));
if(geographicUnknown.length)console.warn('Geography: '+geographicUnknown.length+' scenes lack a known location; retained as unknown, not assigned a country.');

validateMissionWindows(read('mission-windows.yaml'),scenes,entities.entities);
let revision=process.env.VERCEL_GIT_COMMIT_SHA;try{revision=execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim();}catch{if(!revision)throw new Error('Source revision is required');}
const sources=read('sources.yaml');
const enrichment=loadEnrichment({source,relative,project,entities:entities.entities,events,sourceIds:new Set(sources.sources.map(s=>s.id))});
const output={...enrichment,revision,base:relative,calendar,periods,entities:entities.entities,memberships:entities.memberships||[],arcs:arcViews,episodes:episodeViews,scenes,events,geography,sources,links:read('links.yaml').links||[],repairs};
fs.writeFileSync(path.join(project,'public','data.json'),JSON.stringify(output));
fs.writeFileSync(path.join(project,'public','version.json'),JSON.stringify({revision}));
console.log(`Built ${arcViews.length} arcs, ${episodeViews.length} episodes, ${scenes.length} scenes and ${events.length} moments from ${revision}.`);
