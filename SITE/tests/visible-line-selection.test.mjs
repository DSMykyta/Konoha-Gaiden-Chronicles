import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');

test('disabled-layer characters stay selected internally but are not counted as visible lines',()=>{
 const begin=app.indexOf('function activeLineIds(){');
 const end=app.indexOf('function color(id){',begin);
 assert(begin>=0&&end>begin,'Active line selector must be available');
 const available=[{id:'canon'},{id:'project'}];
 const selected=new Set(['canon','project']);
 const context={selectable:()=>available,selected};
 const ids=vm.runInNewContext(app.slice(begin,end)+';activeLineIds',context);
 assert.deepEqual(Array.from(ids()),['canon','project']);
 available.pop(); // Turn off project layer without deleting its selection.
 assert.deepEqual(Array.from(ids()),['canon']);
 assert(selected.has('project'),'layer filtering must not destroy saved selections');
 available.shift();
 assert.deepEqual(Array.from(ids()),[]);
 assert(selected.has('canon'));
});

test('empty timeline points to story filters when no character is available',()=>{
 assert(app.includes("if(!selectable().length){togglePanel('periodPanel');return;}"));
 assert(app.includes("if(!activeLineIds().length){selected=new Set(selectable().map(e=>e.id));selectionChanged();return;}"));
 assert(app.includes("'Змінити шари'"));
 assert(app.includes("Лінії · ${ids.length}"));
});
