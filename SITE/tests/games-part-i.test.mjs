import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import YAML from 'yaml';
const root=path.resolve('../KONOHA_GAIDEN_ARCS_ZIGRANE_POV_V3/CHRONOLOGY/data');
const load=file=>YAML.parse(fs.readFileSync(path.join(root,file),'utf8'));
const anchors=new Map(load('time-anchors.yaml').anchors.map(a=>[a.id,a.date]));
const allScenes=fs.readdirSync(path.join(root,'scenes')).filter(f=>f.endsWith('.yaml')).map(f=>load('scenes/'+f));
const scenes=allScenes.filter(s=>s.id.startsWith('sc-games-'));
const byId=new Map(allScenes.map(s=>[s.id,s]));
const scene=key=>scenes.find(s=>s.id==='sc-games-'+key);
const months=[31,28,31,30,31,30,31,31,30,31,30,31];
const absoluteDay=s=>{const a=anchors.get(s.placement?.anchor_id);return a? a.year*365+months.slice(0,a.month-1).reduce((a,b)=>a+b,0)+a.day-1+(s.placement.day_offset||0):null;};
const date=s=>{const a=anchors.get(s.placement.anchor_id);return a.year*10000+a.month*100+a.day;};
const cast=s=>s.events.flatMap(e=>e.involvement.map(i=>i.entity_id));
const physical=s=>s.events.flatMap(e=>e.involvement.filter(i=>i.mode==='physical').map(i=>i.entity_id));
const text=s=>s.events.map(e=>e.text).join(' ');
const links=load('links.yaml').links.filter(l=>l.id.startsWith('lnk-games-')||l.id.startsWith('lnk-logic-'));
const parts={dawn:0,morning:1,noon:2,afternoon:3,evening:4,night:5};
const linked=(a,b)=>links.some(l=>l.a===a.id&&l.b===b.id&&l.kind==='before');
test('imported games stop at Part I and respect the Hokage transitions',()=>{
 assert(scenes.length>=123);
 for(const s of scenes){
  const d=date(s);assert(d<=1216&&anchors.get(s.placement.anchor_id).year===0,s.id);
  assert(!(cast(s).includes('c-hiruzen')&&d>801),s.id+' Hiruzen after his death');
  assert(!(cast(s).includes('c-tsunade')&&d<902),s.id+' Tsunade before returning');
  assert(s.events.every(e=>e.text.length>90&&e.origin==='P'));
 }
});
test('escort, closed departure and long-mission bases preserve the causal order',()=>{
 assert.equal(date(scene('kakashi-team9-assigned')),920);
 assert.equal(date(scene('kakashi-team9-return')),922);
 assert.equal(scene('kakashi-team9-return').day_part,'morning');
 assert.equal(date(scene('t9-sealed-order')),926);
 assert(date(scene('t9-base2-scout'))>date(scene('t9-sealed-order')));
 assert(date(scene('t9-base18-entry'))>date(scene('t9-base2-scout')));
 const before=links.find(l=>l.a===scene('kakashi-daiki-fight').id);
 assert.equal(before.b,scene('kakashi-mines-memory').id);
 assert(!cast(scene('kakashi-mines-izakaya')).includes('c-shizune'));
 assert(cast(scene('kakashi-nobari-gathering')).includes('c-kurenai'));
 assert(!cast(scene('kakashi-nobari-gathering')).includes('c-shikaku'));
});

test('all audited before links agree with days, day parts and reader order',()=>{
 for(const l of links){
  const a=byId.get(l.a),b=byId.get(l.b);assert(a&&b,l.id);
  const da=absoluteDay(a),db=absoluteDay(b);assert(da!==null&&db!==null,l.id);
  assert(da<=db,`${l.id}: ${a.id} comes after ${b.id}`);
  if(da===db&&a.day_part&&b.day_part){
   assert(parts[a.day_part]<=parts[b.day_part],`${l.id}: reversed parts of day`);
   if(a.day_part===b.day_part&&a.episode_id===b.episode_id)assert(a.display_rank<b.display_rank,`${l.id}: reversed reader order`);
  }
 }
 const episodes=load('episodes.yaml').episodes.filter(e=>e.id.startsWith('ep-games-'));
 for(const ep of episodes){
  const members=scenes.filter(s=>s.episode_id===ep.id).sort((a,b)=>a.display_rank-b.display_rank);
  for(let i=1;i<members.length;i++)assert(absoluteDay(members[i-1])<=absoluteDay(members[i]),ep.id+' reader order');
 }
});

test('Kiba is an existing friend and the notebook is only handed over after burns',()=>{
 const evaluation=byId.get('sc-y0-0123-team9-field9'),friend=scene('t9-kiba-food');
 assert(linked(evaluation,friend));assert.equal(evaluation.day_part,'noon');assert.equal(friend.day_part,'afternoon');
 assert(physical(friend).includes('c-akamaru'));
 assert(!/знайомиться|початок дружби|перше знайомство/.test(friend.title));
 const shown=scene('t9-nobari-notebook'),burn=scene('t9-burn-attempt'),given=scene('t9-burn-notebook'),regular=scene('t9-regular-medical');
 assert.match(shown.title,/показує/);assert.match(given.title,/передає|віддає/);
 assert(absoluteDay(shown)<absoluteDay(burn));assert(linked(burn,given));assert(linked(given,regular));
 assert.match(text(shown),/прибирає|повертає|шаф/);
});

test('weapons, private practice and medical duty use the actual people and locations',()=>{
 const weapons=scene('t9-isshin-weapons');assert.equal(weapons.location_id,'loc-training-ground-9');assert(physical(weapons).includes('c-isshin'));
 assert(linked(scene('t9-loaned-blades'),weapons));
 assert.deepEqual(new Set(physical(scene('t9-asuma-first-fire'))),new Set(['c-kita','c-asuma']));
 const blink=physical(scene('t9-squirrel-blink'));assert(blink.includes('c-ino')&&blink.includes('c-shikamaru')&&blink.includes('c-choji'));assert(!blink.includes('c-ren')&&!blink.includes('c-sora'));
 assert.equal(scene('t9-nobari-field').location_id,'loc-team9-medical-post');
 assert.deepEqual(new Set(physical(scene('t9-anko-flowers'))),new Set(['c-kita','c-anko']));
 assert.deepEqual(new Set(physical(scene('t9-tanigawa-family'))),new Set(['c-kita','c-ren','c-isshin']));
});

test('human swaps and the bottle retain their source meanings',()=>{
 assert(absoluteDay(scene('t9-b4-drill'))<absoluteDay(scene('t9-farm-swap')));
 assert.match(text(scene('t9-b4-drill')),/Рен/);assert(!/вперше підміняє людину/.test(scene('t9-farm-swap').title));
 assert(linked(scene('t9-touno-overtime'),scene('t9-asuma-fear')));
 const bottle=scene('t9-first-bottle');assert.equal(date(bottle),825);assert.equal(bottle.day_part,'evening');
 assert.match(text(bottle),/пам’ят|підтрим/);assert(linked(bottle,scene('t9-bottle-lost')));
 for(const s of scenes)assert(!/просторов(ий|ого) якір|прив’язаний предмет|пляшк[^.]*умов[^.]*блінк/.test(text(s)),s.id+' invented bottle mechanism');
});

test('Kakashi does not repeatedly meet colleagues or know Yumiko prematurely',()=>{
 assert(!/вперше|знайомиться/.test(scene('kakashi-first-mikata').title));
 assert(physical(scene('kakashi-first-mikata')).includes('c-ibiki'));
 assert.match(text(scene('kakashi-salmon')),/оплачує/);assert(!/вже оплачен/.test(text(scene('kakashi-salmon'))));assert.equal(scene('kakashi-salmon').day_part,'evening');
 assert.match(text(scene('kakashi-yumiko-sakura')),/імені.*ще не/);
 assert(absoluteDay(scene('kakashi-yumiko-asks-sakura'))<absoluteDay(scene('kakashi-yumiko-name')));
 assert.equal(scene('kakashi-yumiko-balcony').location_id,'loc-yumiko-balcony');assert(!physical(scene('kakashi-yumiko-balcony')).includes('c-shikaku'));
 assert.equal(scene('kakashi-shikaku-advice').location_id,'loc-nara-residence');
 assert.match(text(scene('kakashi-forced-rest')),/справжня клерк|власні документи/);
 assert(linked(scene('kakashi-rest-order'),scene('kakashi-forced-rest')));
});

test('escort training precedes client and the Valley report follows the rescue',()=>{
 assert(linked(scene('kakashi-team9-ninken'),scene('kakashi-team9-client')));
 assert.equal(scene('kakashi-team9-ninken').location_id,'loc-training-ground-3');
 assert(scene('kakashi-team9-ninken').display_rank<scene('kakashi-team9-client').display_rank);
 assert(absoluteDay(scene('kakashi-valley-report'))>=absoluteDay(byId.get('sc-y0-0925-kakashi-finds-naruto')));
 assert(!cast(scene('kakashi-team9-inn')).includes('c-escort-official'));
});

test('long mission includes the overnight watch, records and aftermath of Base 18',()=>{
 assert(linked(scene('t9-base2-watch'),scene('t9-base2-scout')));
 assert(absoluteDay(scene('t9-base2-watch'))<absoluteDay(scene('t9-base2-scout')));
 assert(!/сенсорна помилка/.test(text(scene('t9-base2-scout'))));
 assert.equal(scene('t9-base2-road-rest').location_id,'loc-oto-base2');
 assert(!physical(scene('t9-base2-cleanup')).includes('c-sora'));
 assert(linked(scene('t9-base18-destroyed'),scene('t9-base18-plums')));
 assert.equal(scene('t9-base18-plums').location_id,'loc-base18-riverbank');
 assert.match(scene('t9-base18-plums').title,/Рен ділиться.*Кітою/);
 assert.equal(scene('t9-base18-settlement').location_id,'loc-long-mission-settlement');
});
