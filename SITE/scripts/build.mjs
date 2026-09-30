import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import YAML from 'yaml';
import {loadEnrichment} from './enrichment.mjs';
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
function read(file){const text=fs.readFileSync(path.join(p,file),'utf8');try{return YAML.parse(text);}catch(error){if(!file.startsWith('scenes/sc-y0-0122-'))throw error;const repaired=text.split('\n').map(line=>{const n=line.length-line.trimStart().length;return ' '.repeat(Math.max(0,n-(n>=6?2:0)-(n>=12?2:0)))+line.trimStart();}).join('\n');const data=YAML.parse(repaired);repairs.push(file);return data;}}
const entities=read('entities.yaml'),anchors=new Map(read('time-anchors.yaml').anchors.map(a=>[a.id,a])),lengths=[31,28,31,30,31,30,31,31,30,31,30,31];
const scenes=[],events=[];
for(const file of fs.readdirSync(path.join(p,'scenes')).filter(f=>f.endsWith('.yaml')).sort()){
 const s=read('scenes/'+file),a=anchors.get(s.placement?.anchor_id),date=a?.date;
 if(date&&date.year!==0)throw new Error('Only project year zero is configured');
 const day=date?lengths.slice(0,date.month-1).reduce((a,b)=>a+b,0)+date.day-1+(s.placement.day_offset||0):null;
 if(day!==null&&(day<0||day>=365))throw new Error('Calendar placement out of bounds');
 const dateStatus=a?.placement_status||'unknown';scenes.push({...s,day,date,date_status:dateStatus,file});
 for(const e of s.events||[]){const physical=(e.involvement||[]).filter(i=>['physical','physical_hidden'].includes(i.mode)&&i.role!=='mentioned').map(i=>i.entity_id),tracks=(e.involvement||[]).filter(i=>i.role!=='mentioned'&&i.mode!=='remote').map(i=>i.entity_id);events.push({...e,scene_id:s.id,scene_title:s.title,day,date_status:dateStatus,continuity:s.continuity_id||'main',scene_state:s.state,review:s.review||{},location_id:s.location_id,physical,tracks,file});}
}
if(new Set(events.map(e=>e.id)).size!==events.length)throw new Error('Duplicate event IDs');
const known=new Set(entities.entities.map(e=>e.id));for(const e of events)for(const id of e.tracks)if(!known.has(id))throw new Error('Unknown entity '+id);
let revision=process.env.VERCEL_GIT_COMMIT_SHA;try{revision=execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim();}catch{if(!revision)throw new Error('Source revision is required');}
const sources=read('sources.yaml');
const enrichment=loadEnrichment({source,relative,project,entities:entities.entities,events,sourceIds:new Set(sources.sources.map(s=>s.id))});
const output={...enrichment,revision,base:relative,entities:entities.entities,memberships:entities.memberships||[],scenes,events,sources,links:read('links.yaml').links||[],repairs};
fs.writeFileSync(path.join(project,'public','data.json'),JSON.stringify(output));
fs.writeFileSync(path.join(project,'public','version.json'),JSON.stringify({revision}));
console.log(`Built ${scenes.length} scenes and ${events.length} events from ${revision}.`);
