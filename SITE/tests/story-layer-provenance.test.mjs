import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const data=JSON.parse(fs.readFileSync(new URL('../public/data.json',import.meta.url),'utf8'));
const findScene=id=>{
 const scene=data.scenes.find(scene=>scene.id===id);
 assert(scene,'Missing scene '+id);
 return scene;
};
const findEvent=id=>{
 const event=data.events.find(event=>event.id===id);
 assert(event,'Missing event '+id);
 return event;
};

test('Naruto episode 21 has three manga nominations, not a mislabeled fourth',()=>{
 const scene=findScene('sc-y0-0624-hokage-chunin-meeting');
 const original=findEvent('ev-y0-0624-jonin-nominate-teams');
 const added=findEvent('ev-y0-0624-raido-nominates-team9');
 assert.equal(original.origin,'M');
 assert(!/Райдо|Команду 9/.test(original.text));
 assert(!original.physical.includes('c-raido'));
 assert.deepEqual(Array.from(original.focus_teams),['team-7','team-8','team-10']);
 assert.equal(added.origin,'P');
 assert.equal(added.layer,'team9');
 assert(added.physical.includes('c-raido'));
 assert.equal(original.scene_id,added.scene_id);
 assert(!/Команд[ауи] 9|Райдо/.test(scene.description));
 assert(scene.description_project.includes('Райдо'));
 const canonEventIds=new Set(data.events.filter(e=>e.scene_id===scene.id&&e.layer!=='team9'&&e.origin!=='P').map(e=>e.id));
 assert(canonEventIds.has(original.id));
 assert(!canonEventIds.has(added.id));
});

test('candidate hall contains one manga conversation and one independent Team 9 moment',()=>{
 const scene=findScene('sc-y0-0701-candidate-gathering');
 const original=findEvent('ev-y0-0701-rookie-teams-meet');
 const added=findEvent('ev-y0-0701-team9-joins-chunin-candidates');
 assert.equal(original.origin,'M');
 assert(!original.text.includes('Команда 9'));
 assert(!['c-kita','c-ren','c-sora'].some(id=>original.tracks.includes(id)));
 assert.equal(added.origin,'P');
 assert.equal(added.layer,'team9');
 assert(['c-kita','c-ren','c-sora'].every(id=>added.physical.includes(id)));
 assert.equal(original.scene_id,added.scene_id);
 assert(!scene.description.includes('Команда 9'));
 assert(scene.description_project.includes('Кіта'));
});

test('episode and arc baseline descriptions remain true with project layer disabled',()=>{
 for(const id of ['ep-y0-chunin-nominations','ep-y0-chunin-written-stage']){
  const item=data.episodes.find(item=>item.id===id);
  assert(item,id);
  assert(item.description_project,id+' lacks distinct project addendum');
  assert(!/Команд[ауи] 9|Кіта, Рен/.test(item.description),id+' leaks project statements');
 }
 const arc=data.arcs.find(arc=>arc.id==='arc-y0-chunin-exams');
 assert(arc?.description_project);
 assert(!arc.description.includes('Команда 9'));
});
