import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import YAML from 'yaml';

// Deterministic helper: no model credentials, inferred timestamps or changes to scene text.
const project=path.resolve(import.meta.dirname,'..'),root=path.resolve(process.env.CHRONOLOGY_SOURCE_ROOT||path.dirname(project),'KONOHA_GAIDEN_ARCS_ZIGRANE_POV_V3/CHRONOLOGY/data');
const args=process.argv.slice(2),command=args.shift(),options={};
for(let i=0;i<args.length;i++){if(!args[i].startsWith('--'))throw Error('Use --key value');const key=args[i].slice(2);options[key]=args[i+1]&&!args[i+1].startsWith('--')?args[++i]:true;}
const read=file=>YAML.parse(fs.readFileSync(path.join(root,file),'utf8'));
const scenes=fs.readdirSync(path.join(root,'scenes')).filter(f=>f.endsWith('.yaml')).flatMap(file=>{const text=fs.readFileSync(path.join(root,'scenes',file),'utf8');try{return [{file,...YAML.parse(text)}];}catch(error){if(!file.startsWith('sc-y0-0122-'))throw error;const repaired=text.split('\n').map(line=>{const n=line.length-line.trimStart().length;return ' '.repeat(Math.max(0,n-(n>=6?2:0)-(n>=12?2:0)))+line.trimStart();}).join('\n');return [{file,...YAML.parse(repaired)}];}});
const sources=read('sources.yaml'),eventEntries=scenes.flatMap(s=>(s.events||[]).map(e=>({...e,scene_id:s.id,scene_file:s.file})));
const mediaFile=path.join(root,'event-media.yaml'),media=read('event-media.yaml');
function save(){fs.writeFileSync(mediaFile,YAML.stringify(media));}
function event(id){const e=eventEntries.find(e=>e.id===id);if(!e)throw Error('Unknown event_id: '+id);return e;}
function sourceForEvent(e,id){const evidence=sources.evidence.filter(v=>e.evidence_ids?.includes(v.id));const source=sources.sources.find(s=>s.id===id);if(!source||!evidence.some(v=>v.source_id===id))throw Error('Source must be referenced by this event evidence_ids');return source;}
function imageType(bytes){if(bytes.length<12)throw Error('Empty/invalid image');if(bytes[0]===255&&bytes[1]===216)return 'jpg';if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'png';if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'webp';throw Error('Expected actual PNG, JPEG or WebP bytes');}
if(command==='tasks'){
 const candidates=eventEntries.filter(e=>options.event?e.id===options.event:!media.media.some(m=>m.event_id===e.id&&m.status==='published'));
 console.log(JSON.stringify(candidates.slice(0,Number(options.limit)||10).map(e=>({event_id:e.id,title:e.title,text:e.text,scene_file:e.scene_file,project_addition:e.evidence_ids?.some(id=>id.startsWith('evd-project')),evidence:(e.evidence_ids||[]).map(id=>{const evidence=sources.evidence.find(s=>s.id===id);return {evidence,source:sources.sources.find(s=>s.id===evidence?.source_id)};})})),null,2));
}else if(command==='attach'){
 const e=event(options.event),source=sourceForEvent(e,options.source);
 if(!options.alt||!options.locator)throw Error('--alt and exact --locator are required');
 let bytes;
 if(options.video){
  if(!/^\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(options.at||''))throw Error('--at must be HH:MM:SS.mmm');
  bytes=execFileSync('ffmpeg',['-v','error','-ss',options.at,'-i',path.resolve(options.video),'-frames:v','1','-f','image2pipe','-vcodec','mjpeg','pipe:1'],{maxBuffer:16*1024*1024});
 }else if(options.input){bytes=fs.readFileSync(path.resolve(options.input));}
 else if(options.url){
  const url=new URL(options.url);if(url.protocol!=='https:')throw Error('Image URL must use HTTPS');
  const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Image HTTP '+response.status);if(Number(response.headers.get('content-length'))>16*1024*1024)throw Error('Image too large');
  const chunks=[];let total=0;for await(const chunk of response.body){total+=chunk.length;if(total>16*1024*1024)throw Error('Image too large');chunks.push(chunk);}bytes=Buffer.concat(chunks);
 }else throw Error('Provide --input screenshot, --video episode --at timestamp, or --url exact image');
 if(bytes.length>16*1024*1024)throw Error('Image too large');
 const ext=imageType(bytes),hash=crypto.createHash('sha256').update(bytes).digest('hex').slice(0,12),id=`img-${e.id}-${hash}`,src=`media/events/${e.id}/${hash}.${ext}`;
 const existing=media.media.find(m=>m.id===id);if(existing){console.log(JSON.stringify(existing,null,2));process.exit(0);}
 fs.mkdirSync(path.dirname(path.join(root,src)),{recursive:true});fs.writeFileSync(path.join(root,src),bytes);
 const item={id,event_id:e.id,src,alt:options.alt,caption:options.caption||options.alt,source_id:source.id,kind:source.type,locator:options.locator,source_url:options.url||null,coverage:options.coverage||(e.evidence_ids?.some(id=>id.startsWith('evd-project'))?'canonical_part':'event'),status:'candidate',order:Number(options.order)||0};media.media.push(item);save();console.log(JSON.stringify(item,null,2));
}else if(command==='publish'){
 const item=media.media.find(m=>m.id===options.id);if(!item)throw Error('Unknown image ID');if(!options.verified)throw Error('Inspect the frame and event, then pass --verified');event(item.event_id);item.status='published';save();console.log('Published '+item.id);
}else throw Error('Commands: tasks [--event ID] [--limit 10], attach --event ID --source ID --input IMAGE --locator TEXT --alt TEXT, publish --id IMAGE_ID --verified');
