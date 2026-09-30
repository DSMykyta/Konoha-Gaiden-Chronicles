const fs=require('fs'),vm=require('vm'),assert=require('assert');const {parseHTML}=require('linkedom');
const project=require('path').resolve(__dirname,'../public')+'/';
const original=JSON.parse(fs.readFileSync(project+'data.json'));const sleep=()=>new Promise(r=>setTimeout(r,25));
async function check(width,height){
 const {window}=parseHTML(fs.readFileSync(project+'index.html','utf8')),doc=window.document,canvas=doc.getElementById('timeline'),outer=doc.getElementById('canvas');
 Object.defineProperty(doc.getElementById('continuity'),'value',{value:'main',writable:true});Object.defineProperties(canvas,{clientWidth:{value:width},clientHeight:{value:height}});Object.defineProperties(outer,{clientWidth:{value:width},clientHeight:{value:height}});outer.scrollTop=0;window.location={search:''};
 let snapshot=structuredClone(original),version=snapshot.revision;
 const ctx=vm.createContext({window,document:doc,console,URLSearchParams,fetch:async url=>({ok:true,json:async()=>url.startsWith('version')?{revision:version}:structuredClone(snapshot)}),requestAnimationFrame:cb=>setTimeout(cb,0),cancelAnimationFrame:clearTimeout,setInterval:()=>0,ResizeObserver:class{observe(){}}});
 for(const file of ['timeline-core.js','relations.js','app.js'])vm.runInContext(fs.readFileSync(project+file,'utf8'),ctx);await sleep();
 const click=q=>{const el=doc.querySelector(q);assert(el,'Missing '+q);el.dispatchEvent(new window.Event('click'));};
 const run=s=>vm.runInContext(s,ctx);
 assert(doc.getElementById('error').hidden,doc.getElementById('error').textContent);
 assert(doc.getElementById('eventCard').hidden);assert(doc.getElementById('profileDialog').hidden);assert(doc.getElementById('focusBar').hidden);
 const count=run('selectable().length');assert.equal(doc.querySelectorAll('.character input:checked').length,count);assert(count>6);
 assert(canvas.querySelectorAll('.day-band').length);for(const band of canvas.querySelectorAll('.day-band'))assert.equal(Number(band.getAttribute('data-day'))%2,1);
 for(const path of canvas.querySelectorAll('.thread')){assert(path.getAttribute('d').includes(' C'));assert(!path.getAttribute('d').includes('NaN'));assert(!path.getAttribute('d').includes('L'));}
 assert(doc.querySelector('[data-focus-character="c-naruto"]').textContent==='Наруто Узумакі');
 // Mass selection affects the complete roster, even while filtered.
 doc.getElementById('characterSearch').value='Наруто';doc.getElementById('characterSearch').dispatchEvent(new window.Event('input'));click('#deselectAll');await sleep();assert.equal(run('selected.size'),0);assert.equal(canvas.querySelectorAll('.node').length,0);click('#selectAll');await sleep();assert.equal(run('selected.size'),count);doc.getElementById('characterSearch').value='';doc.getElementById('characterSearch').dispatchEvent(new window.Event('input'));
 // Native profile modal, age-specific content and keyboard tabs.
 click('[data-profile="c-naruto"]');assert(!doc.getElementById('profileDialog').hidden);assert(doc.getElementById('profileDialog').hasAttribute('open'));assert.equal(doc.querySelectorAll('[role="tab"]').length,2);click('[data-profile-version="naruto-15"]');assert(doc.getElementById('profileContent').textContent.includes('15 років'));assert(doc.querySelector('[data-profile-version="naruto-15"]').getAttribute('aria-selected')==='true');click('#closeProfile');assert(doc.getElementById('profileDialog').hidden);
 // Focus is a separate state: selected characters remain selected, other lines dim.
 click('.thread-hit[data-character="c-raido"]');await sleep();assert.equal(run('focusedCharacter'),'c-raido');assert.equal(run('selected.size'),count);assert(!doc.getElementById('focusBar').hidden);assert([...canvas.querySelectorAll('.node')].every(el=>run(`eventMap.get(${JSON.stringify(el.dataset.event)}).tracks.includes('c-raido')`)));assert([...canvas.querySelectorAll('.thread')].some(p=>p.getAttribute('opacity')==='.12'));
 run("navigateEvent('ev-y0-0624-jonin-nominate-teams')");await sleep();assert(doc.querySelector('#cardContent h2').textContent.includes('Райдо'));const current=run('anchorEvent');click('#focusNext');await sleep();const next=run('anchorEvent');assert.notEqual(next,current);assert(run('eventMap.get(anchorEvent).tracks.includes(focusedCharacter)'));click('#focusPrevious');await sleep();assert.equal(run('anchorEvent'),current);
 // A visual screenshot may exist above the title; candidates stay hidden.
 snapshot.media=[{id:'fixture',event_id:current,status:'candidate',src:'media/test.png',alt:'Fixture',locator:'test',source_id:'src-anime-20-23'}];snapshot.revision='test-update';version=snapshot.revision;await run('refreshData()');assert.equal(run('data.revision'),'test-update');assert.equal(run('selected.size'),count);assert.equal(run('focusedCharacter'),'c-raido');assert.equal(doc.querySelectorAll('.event-gallery').length,0);
 snapshot.media[0].status='published';snapshot.revision='test-published';version=snapshot.revision;await run('refreshData()');assert.equal(doc.querySelectorAll('.event-gallery img').length,1);assert(doc.getElementById('cardContent').innerHTML.indexOf('event-gallery')<doc.getElementById('cardContent').innerHTML.indexOf('<h2>'));
 click('#clearFocus');await sleep();assert.equal(run('focusedCharacter'),null);assert(doc.getElementById('focusBar').hidden);
 // First/last event buttons are disabled, and card movement respects selection.
 click('[data-team="team-8"]');await sleep();assert.equal(run('selected.size'),4);run("navigateEvent(TimelineCore.ordered(navigationEvents().filter(e=>e.day!==null))[0].id)");assert(doc.querySelector('[data-step-event="-1"]').disabled);click('[data-step-event="1"]');await sleep();assert(run('relevant(eventMap.get(anchorEvent))'));
 console.log('PASS',width,height,'all/none, names, focus, event navigation, day backgrounds, age tabs, gallery, live refresh');
}
(async()=>{await check(1440,900);await check(375,760);await check(812,375)})().catch(e=>{console.error(e);process.exitCode=1});
