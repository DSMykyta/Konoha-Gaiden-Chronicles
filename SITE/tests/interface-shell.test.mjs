import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const read=file=>fs.readFileSync(new URL('../public/'+file,import.meta.url),'utf8');
const html=read('index.html'),style=read('interface-refinement.css'),app=read('app.js');

test('shell refinement loads after existing styles, without changing the SVG canvas',()=>{
 const position=html.indexOf('interface-refinement.css');
 assert(position>html.indexOf('map-titles.css'),'Refinement CSS must override legacy per-button glass');
 assert(position<html.indexOf('app.js?v='),'Style should load before interface scripts');
 for(const id of ['canvas','timeline','storyClouds','timeAxis','periodButton','linesButton',
  'contentsButton','searchButton','abilitiesButton','storyLayers','eventCard']) {
  assert(html.includes('id="'+id+'"'),'Required graph control missing: '+id);
 }
});

test('period and story filters have a single visible entry point with nondefault layer status',()=>{
 assert.match(html,/id="periodButton"[^>]*aria-controls="periodPanel"/);
 assert.match(html,/id="layerIndicator"[^>]*hidden/);
 assert.match(style,/\.story-layers-open\s*\{\s*display:\s*none/);
 assert.match(app,/\$\('layerIndicator'\)\.hidden=enabledLayerCount===4/);
 assert.match(app,/\$\('layerIndicator'\)\.textContent=enabledLayerCount\+'\/4'/);
 assert.match(app,/togglePanel\('periodPanel'\)/);
});

test('context, dock and scale are distinct; phone dock moves to the bottom',()=>{
 assert.match(html,/<h1 aria-label="Хронологія Конохи">/);
 assert.match(html,/class="identity-short" aria-hidden="true">Коноха/);
 const header=html.slice(html.indexOf('<header class="masthead">'),html.indexOf('</header>')+9);
 assert(!header.includes('time-controls')&&!header.includes('navigation-dock'));
 assert.match(html,/<nav class="tools navigation-dock"/);
 assert.match(style,/\.tools\.navigation-dock\s*\{[\s\S]*?flex-direction:\s*column/);
 assert.match(style,/@media \(max-width:760px\)[\s\S]*?\.tools\.navigation-dock\s*\{[\s\S]*?flex-direction:row/);
 assert.match(style,/\.time-controls\s*\{[\s\S]*?position:fixed/);
});

test('minimal chrome restores actual 44px icon hit areas and opaque reading surfaces',()=>{
 assert.match(style,/flex:\s*0 0 44px;[\s\S]*?min-width:\s*44px;/);
 assert.match(style,/#searchPanel,#cardContent,\.hierarchy-preview-content\s*\{[\s\S]*?background:#fff/);
 assert.match(style,/\.time-axis[\s\S]*?sticky-day-label/);
});

test('help text matches current wheel zoom instead of the removed wheel pan behavior',()=>{
 assert(!html.includes('колесо переміщує час'));
 assert(html.includes('Shift + коліщатко'));
 assert(html.includes('дата закріплюється ліворуч'));
});
