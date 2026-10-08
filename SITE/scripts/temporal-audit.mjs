import fs from 'node:fs';
import vm from 'node:vm';

const file=new URL('../public/data.json',import.meta.url);
if(!fs.existsSync(file)){
 console.error('First build SITE/public/data.json using npm --prefix SITE run build');
 process.exitCode=2;
}else{
 const core=vm.runInNewContext(fs.readFileSync(new URL('../public/timeline-core.js',import.meta.url),'utf8')+';TimelineCore');
 const data=JSON.parse(fs.readFileSync(file,'utf8'));
 const relations=[...(data.links||[]),...(data.scenes||[]).flatMap(s=>s.relations||[])];
 const continuities=[...new Set(data.events.map(e=>e.continuity))];
 let unresolved=0;
 for(const continuity of continuities){
  const events=data.events.filter(e=>e.continuity===continuity&&e.scene_state!=='inactive');
  const world=core.world(events,relations,data.scenes);
  const issues=core.auditTime(world,relations);
  console.log(continuity+': '+events.length+' moments; '+world.scenes.length+' scenes; '+issues.length+' accepted temporal conflicts');
  for(const issue of issues.slice(0,50))console.log('  '+issue.kind+' | '+issue.id+' | '+issue.a+' -> '+issue.b);
  if(issues.length>50)console.log('  ... '+(issues.length-50)+' further conflicts');
  unresolved+=issues.length;
 }
 if(process.argv.includes('--strict')&&unresolved)process.exitCode=1;
}
