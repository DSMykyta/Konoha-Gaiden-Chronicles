import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const script=fs.readFileSync(new URL('../public/story-layers.js',import.meta.url),'utf8');
const layers=vm.runInNewContext(script+';StoryLayers');

test('inline project fragments leave intact canonical narrative',()=>{
 const prose='Ірука оголосив Команду 7.\n\n[[project|Кіта нахилився до Кіби.]]\n\nІрука продовжив.';
 assert.equal(layers.compose(prose,{naruto:true,official:false,project:false}),'Ірука оголосив Команду 7.\n\nІрука продовжив.');
 assert(layers.compose(prose).includes('Кіта нахилився'));
});
test('three source layers can be combined independently',()=>{
 const s='[[naruto|Манґа.]] [[official|Аніме-доповнення.]] [[project|Авторська дія.]]';
 assert.equal(layers.compose(s,{naruto:true,official:false,project:false}),'Манґа.');
 assert.equal(layers.compose(s,{naruto:false,official:true,project:false}),'Аніме-доповнення.');
 assert.equal(layers.compose(s,{naruto:false,official:false,project:true}),'Авторська дія.');
 assert.equal(layers.compose(s,{naruto:false,official:false,project:false}),'');
 assert.equal(layers.compose(s),'Манґа. Аніме-доповнення. Авторська дія.');
});
test('broken or nested conditional blocks fail rather than leak',()=>{
 for(const s of ['[[team9|Текст]]','[[project|не закрито','[[project|тут [[official|там]]]]'])assert.throws(()=>layers.compose(s));
});
test('anime origin A is ambiguous until source comparison',()=>{
 assert.equal(layers.classify({origin:'A'}),null);
 assert.equal(layers.classify({origin:'M'}),'canon');
 assert.equal(layers.classify({origin:'P'}),'project');
 assert.equal(layers.classify({origin:'F'}),'filler');
 assert.equal(layers.classify({origin:'A',layer:'naruto'}),'canon');
 assert.equal(layers.classify({origin:'A',layer:'official'}),'sources');
 assert.equal(layers.classify({origin:'M',layer:'team9'}),'project');
});
test('Naruto-only school scene excludes Kita prose without deleting Team 7',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('../public/data.json',import.meta.url),'utf8'));
 const e=data.events.find(e=>e.id==='ev-y0-0122-team7-announced'),scene=data.scenes.find(s=>s.id==='sc-y0-0122-academy-announcements');
 assert(e&&scene);assert.equal(e.origin,'M');assert(e.prose.includes('[[project|'));
 const clean=layers.compose(e.prose,{naruto:true,official:false,project:false});
 assert(clean.includes('— Команда сім.'));assert(!clean.includes('Кіта'));assert(layers.compose(e.prose).includes('Кіта нахилився'));
 const summary=layers.compose(scene.description,{naruto:true,official:false,project:false});
 assert(summary.includes('Ірука'));assert(!/Кіта|Рен і Сора|Команд[ауи] 9/.test(summary));
});
test('the browser loads the layer parser before the main renderer',()=>{
 const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 assert(html.indexOf('story-layers.js')>=0);assert(html.indexOf('story-layers.js')<html.indexOf('app.js?v='));
 const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 assert(app.includes('StoryLayers.compose'));
});

test('unchecked layers never leak unclassified moments into restricted views',()=>{
 const unknown=[{id:'unknown',origin:'?'}];
 assert.equal(layers.select(unknown,{canon:true,filler:true,sources:true,project:true}).length,1);
 assert.equal(layers.select(unknown,{canon:true,filler:false,sources:false,project:false}).length,0);
 assert.equal(layers.select(unknown,{canon:false,filler:false,sources:false,project:false}).length,0);
});
test('original manga and project overlays can be independently hidden',()=>{
 const entries=[{id:'canon',origin:'M'},{id:'filler',origin:'F'},{id:'extra',origin:'O'},{id:'project',origin:'P'}];
 const canonOnly=layers.select(entries,{canon:true,filler:false,sources:false,project:false});
 assert.deepEqual(canonOnly.map(e=>e.id),['canon']);
 const projectOnly=layers.select(entries,{canon:false,filler:false,sources:false,project:true});
 assert.deepEqual(projectOnly.map(e=>e.id),['project']);
});
