import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import YAML from 'yaml';
import {loadEnrichment} from '../scripts/enrichment.mjs';

const relative='KONOHA_GAIDEN_ARCS_ZIGRANE_POV_V3/CHRONOLOGY/data';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN3sAAAAASUVORK5CYII=','base64');
function fixture(){
 const source=fs.mkdtempSync(path.join(os.tmpdir(),'konoha-media-test-')),root=path.join(source,relative),project=path.join(source,'SITE');fs.mkdirSync(path.join(root,'scenes'),{recursive:true});fs.mkdirSync(path.join(project,'public'),{recursive:true});
 const write=(file,data)=>fs.writeFileSync(path.join(root,file),YAML.stringify(data));
 write('event-media.yaml',{schema_version:1,media:[]});write('character-profiles.yaml',{schema_version:1,profiles:[]});write('sources.yaml',{sources:[{id:'src-test',type:'anime'}],evidence:[{id:'evd-test',source_id:'src-test'}]});write('scenes/scene.yaml',{id:'sc-test',events:[{id:'ev-test',title:'Test',text:'Test event',evidence_ids:['evd-test']}]});
 return {source,root,project,write,cleanup:()=>fs.rmSync(source,{recursive:true,force:true})};
}
test('image registration is exact, deduplicated, initially unpublished and then copied during build',()=>{
 const f=fixture();try{
  const input=path.join(f.source,'input.png');fs.writeFileSync(input,png);
  const run=(...args)=>execFileSync(process.execPath,[path.resolve('scripts/media.mjs'),...args],{env:{...process.env,CHRONOLOGY_SOURCE_ROOT:f.source},encoding:'utf8',stdio:['pipe','pipe','pipe']});
  assert.throws(()=>run('attach','--event','missing','--source','src-test','--input',input,'--locator','ep 1, 00:01','--alt','Frame'));
  const args=['attach','--event','ev-test','--source','src-test','--input',input,'--locator','ep 1, 00:01','--alt','Frame'];
  const item=JSON.parse(run(...args));assert.equal(item.status,'candidate');assert(fs.existsSync(path.join(f.root,item.src)));run(...args);assert.equal(YAML.parse(fs.readFileSync(path.join(f.root,'event-media.yaml'),'utf8')).media.length,1);
  assert.throws(()=>run('publish','--id',item.id));run('publish','--id',item.id,'--verified');
  const result=loadEnrichment({source:f.source,relative,project:f.project,entities:[{id:'c-test'}],events:[{id:'ev-test'}],sourceIds:new Set(['src-test'])});assert.equal(result.media[0].status,'published');assert.deepEqual(fs.readFileSync(path.join(f.project,'public',item.src)),png);
 }finally{f.cleanup();}
});
test('a wrong event, missing asset, unknown source and path traversal fail the build',()=>{
 const f=fixture();try{
  const options={source:f.source,relative,project:f.project,entities:[],events:[{id:'ev-test'}],sourceIds:new Set(['src-test'])};
  const item={id:'img-test',event_id:'wrong',src:'media/a.png',alt:'Frame',locator:'ep1 00:01',source_id:'src-test'};
  f.write('event-media.yaml',{media:[item]});assert.throws(()=>loadEnrichment(options),/Unknown media event/);
  item.event_id='ev-test';f.write('event-media.yaml',{media:[item]});assert.throws(()=>loadEnrichment(options),/Missing media asset/);
  item.src='media/../secret.png';f.write('event-media.yaml',{media:[item]});assert.throws(()=>loadEnrichment(options),/Unsafe media path/);
  item.source_id='unknown';f.write('event-media.yaml',{media:[item]});assert.throws(()=>loadEnrichment(options),/Unknown media source/);
 }finally{f.cleanup();}
});
test('profile versions retain distinct ages and reject duplicate version IDs',()=>{
 const f=fixture();try{
  const profile={entity_id:'c-test',versions:[{id:'age12',label:'12 років',age:12,summary:'A'},{id:'age15',label:'15 років',age:15,summary:'B'}]};f.write('character-profiles.yaml',{profiles:[profile]});
  const options={source:f.source,relative,project:f.project,entities:[{id:'c-test'}],events:[],sourceIds:new Set()};
  assert.deepEqual(loadEnrichment(options).profiles[0].versions.map(v=>v.age),[12,15]);profile.versions[1].id='age12';f.write('character-profiles.yaml',{profiles:[profile]});assert.throws(()=>loadEnrichment(options),/duplicate profile version/);
 }finally{f.cleanup();}
});
