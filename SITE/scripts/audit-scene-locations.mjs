// Review-only report. A missing scene location is never replaced by a guess.
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
const dir=path.resolve(import.meta.dirname,'../../00_MAIN_WORK_FOLDER/CHRONOLOGY/data/scenes');
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.yaml')).sort();
const compact=s=>String(s||'').replace(/\s+/g,' ').slice(0,210);
const all=[];
for(const file of files){
 const scene=YAML.parse(fs.readFileSync(path.join(dir,file),'utf8'));
 if(scene.location_id!==null&&scene.location_id!==undefined&&scene.location_id!=='')continue;
 all.push({file,id:scene.id,status:scene.state,title:compact(scene.title),
  description:compact(scene.description),firstEvent:compact(scene.events?.[0]?.text||scene.events?.[0]?.title)});
}
if(process.argv.includes('--json'))console.log(JSON.stringify({count:all.length,unresolved:all},null,2));
else {console.log('Scenes without location:',all.length);for(const s of all)console.log([s.file,s.status,s.title,s.description,s.firstEvent].join(' | '));}
