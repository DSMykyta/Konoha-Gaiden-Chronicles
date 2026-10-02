import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import YAML from 'yaml';
const root=path.resolve('../KONOHA_GAIDEN_ARCS_ZIGRANE_POV_V3/CHRONOLOGY/data');
const load=file=>YAML.parse(fs.readFileSync(path.join(root,file),'utf8'));
const anchors=new Map(load('time-anchors.yaml').anchors.map(a=>[a.id,a.date]));
const scenes=fs.readdirSync(path.join(root,'scenes')).filter(f=>f.startsWith('sc-games-')).map(f=>load('scenes/'+f));
const scene=key=>scenes.find(s=>s.id==='sc-games-'+key);
const date=s=>{const a=anchors.get(s.placement.anchor_id);return a.year*10000+a.month*100+a.day;};
const cast=s=>s.events.flatMap(e=>e.involvement.map(i=>i.entity_id));
test('imported games stop at Part I and respect the Hokage transitions',()=>{
 assert(scenes.length>=100);
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
 const links=load('links.yaml').links.filter(l=>l.id.startsWith('lnk-games-'));
 const byId=new Map(scenes.map(s=>[s.id,s]));
 for(const l of links)assert(date(byId.get(l.a))<=date(byId.get(l.b)),l.id);
 const before=links.find(l=>l.a===scene('kakashi-daiki-fight').id);
 assert.equal(before.b,scene('kakashi-mines-memory').id);
 assert(!cast(scene('kakashi-mines-izakaya')).includes('c-shizune'));
 assert(cast(scene('kakashi-nobari-gathering')).includes('c-kurenai'));
 assert(!cast(scene('kakashi-nobari-gathering')).includes('c-shikaku'));
});
