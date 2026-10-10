import fs from 'node:fs';
import vm from 'node:vm';
import YAML from 'yaml';
import test from 'node:test';
import assert from 'node:assert/strict';

const root=new URL('../../KONOHA_GAIDEN_ARCS_ZIGRANE_POV_V3/CHRONOLOGY/data/',import.meta.url);
const parse=name=>YAML.parse(fs.readFileSync(new URL(name,root),'utf8'));
const entities=parse('entities.yaml').entities;
const topology=parse('geography.yaml');
const atlas=vm.runInNewContext(fs.readFileSync(new URL('../public/timeline-geography.js',import.meta.url),'utf8')+';GeographyAtlas');
const core=vm.runInNewContext(fs.readFileSync(new URL('../public/timeline-core.js',import.meta.url),'utf8')+';TimelineCore');
const geography=atlas.create(entities,topology);

test('geographic hierarchy models rooms, village, country and separate countries',()=>{
 assert.equal(geography.relation('loc-academy-classroom','loc-academy-staff-room').scope,'same_building');
 assert.equal(geography.relation('loc-ichiraku','loc-hokage-residence').scope,'same_settlement');
 assert.equal(geography.relation('loc-konohagakure','loc-tanzaku').scope,'same_country');
 assert.equal(geography.relation('loc-konohagakure','loc-sunagakure').scope,'different_countries');
 assert.equal(geography.relation('loc-konohagakure','loc-land-of-snow').scope,'different_countries');
 assert.equal(geography.relation('loc-ichiraku','loc-tazuna-home').scope,'different_countries');
 assert.equal(geography.relation('loc-valley-end','loc-valley-of-end').scope,'same_site');
 assert.equal(geography.relation('loc-konohagakure','loc-inn').scope,'unknown');
 assert.equal(geography.relation('loc-konohagakure','loc-road-fire-waves').scope,'unknown');
 assert.equal(geography.resolve('loc-inn').country,null,'unknown inns must never default to Konoha');
});

test('known separate countries push simultaneous streams farther apart',()=>{
 const make=(a,b)=>[
  {id:'a',day:11.4,calendarDay:11,locationId:a,layoutCast:['person-a'],layoutGroup:'scene-a'},
  {id:'b',day:11.47,calendarDay:11,locationId:b,layoutCast:['person-b'],layoutGroup:'scene-b'}
 ];
 const close=core.sceneLayout(make('loc-ichiraku','loc-hokage-residence'),[],{},0,1,geography);
 const far=core.sceneLayout(make('loc-konohagakure','loc-land-of-snow'),[],{},0,1,geography);
 const gap=lanes=>Math.abs(lanes.get('a')-lanes.get('b'));
 assert(gap(far)>gap(close)+.3,'different countries need visibly wider bundles');
});

test('unknown locations are review items, not fictitious travel violations',()=>{
 const records=[
  {id:'one',scene_id:'s1',day:22,location_id:'loc-konohagakure',physical:['naruto']},
  {id:'two',scene_id:'s2',day:22,location_id:'loc-land-of-snow',physical:['naruto']},
  {id:'three',scene_id:'s3',day:22,location_id:'loc-inn',physical:['naruto']},
  {id:'four',scene_id:'s4',day:22,location_id:'loc-road-fire-waves',physical:['naruto']}
 ];
 const flags=geography.movementFlags(records);
 assert.equal(flags.length,1);
 assert.equal(flags[0].severity,'review');
 assert.deepEqual(Array.from(flags[0].countries),['loc-land-of-fire','loc-land-of-snow']);
 const audit=geography.audit(records,[{location_id:'loc-inn'},{location_id:'loc-konohagakure'},{location_id:null}]);
 assert(audit.unresolved.some(item=>item.id==='loc-inn'));
 assert(audit.unresolved.some(item=>item.id==='(missing)'));
 assert(!audit.unresolved.some(item=>item.id==='loc-konohagakure'));
});

test('semantic zoom projects existing moment locations without re-solving geometry',()=>{
 const momentLanes=new Map([['m1',-.75],['m2',-.25],['m3',.6],['m4',.9]]);
 const moments=[{id:'m1',group:[{id:'m1'}]},{id:'m2',group:[{id:'m2'}]},{id:'m3',group:[{id:'m3'}]},{id:'m4',group:[{id:'m4'}]}];
 const sceneA={id:'scene-a',group:[{id:'m1'},{id:'m2'}]};
 const sceneB={id:'scene-b',group:[{id:'m3'},{id:'m4'}]};
 const episode={id:'episode-1',group:[...sceneA.group,...sceneB.group]};
 const projectedMoments=core.aggregateLanes(moments,momentLanes);
 const projectedScenes=core.aggregateLanes([sceneA,sceneB],momentLanes);
 const projectedEpisodes=core.aggregateLanes([episode],momentLanes);
 assert.equal(projectedMoments.get('m1'),momentLanes.get('m1'));
 assert.equal(projectedScenes.get('scene-a'),-.5);
 assert.equal(projectedScenes.get('scene-b'),.75);
 assert.equal(projectedEpisodes.get('episode-1'),.125);
 assert.equal(momentLanes.get('m1'),-.75,'underlying strand lanes must stay unchanged');
});
