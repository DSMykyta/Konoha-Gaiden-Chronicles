import assert from 'node:assert/strict';
import {createModel,buildGeometry} from '../core.mjs';
const scene={id:'room',continuity_id:'main',placement:{anchor_id:'day'},events:[{id:'a',title:'a',display_rank:999,involvement:[{entity_id:'one',role:'focus',mode:'physical'}]},{id:'b',title:'b',display_rank:1,involvement:[{entity_id:'ghost',role:'mention',mode:'mentioned'}]},{id:'c',title:'c'}],relations:[{kind:'before',a:'a',b:'c'},{kind:'before',a:'b',b:'c'}],presence:[{entity_id:'witness',from:'room.start',to:'room.end'}]};
const bundle={documents:{scene,anchors:{anchors:[{id:'day',date:{year:0,month:1,day:1}}]},entities:{entities:[{id:'one',name:'One'},{id:'witness',name:'Witness'},{id:'ghost',name:'Ghost'}]}}};
const m=createModel(bundle);assert(m.before('a','c'));assert(!m.before('a','b'));assert(!m.before('b','a'));assert(m.records.get('b').physical.has('witness'));assert(!m.records.get('b').physical.has('ghost'));assert(m.records.get('a').position<m.records.get('c').position);
const overview=buildGeometry(m,m.events,{start:0,end:1,span:1000,cross:500,zoom:1});const close=buildGeometry(m,m.events,{start:0,end:1,span:1000,cross:500,zoom:8});assert(overview.spacing<close.spacing);assert(overview.spacing*(overview.ids.length-1)<=10.001);
const copy=structuredClone(bundle);copy.documents.scene.events.forEach(e=>{e.title='Different language';e.text='Unrelated prose';e.display_rank=-123;});const n=createModel(copy);assert.deepEqual(m.events.map(e=>e.position),n.events.map(e=>e.position));
const cycle=structuredClone(bundle);cycle.documents.scene.relations.push({kind:'before',a:'c',b:'a'});assert.throws(()=>createModel(cycle),/цикл/);
console.log('PASS: partial order, presence, mentions, dense zoom, content independence, cycle detection');
