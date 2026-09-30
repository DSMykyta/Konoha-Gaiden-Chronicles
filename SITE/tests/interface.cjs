const fs=require('fs'),vm=require('vm'),assert=require('assert');const {parseHTML}=require('linkedom');
const project=require('path').resolve(__dirname,'../public')+'/';
const original=JSON.parse(fs.readFileSync(project+'data.json'));const sleep=()=>new Promise(r=>setTimeout(r,25));
async function check(width,height){
 const {window}=parseHTML(fs.readFileSync(project+'index.html','utf8')),doc=window.document,canvas=doc.getElementById('timeline'),outer=doc.getElementById('canvas');
 Object.defineProperty(doc.getElementById('continuity'),'value',{value:'main',writable:true});Object.defineProperties(canvas,{clientWidth:{value:width},clientHeight:{value:height}});Object.defineProperties(outer,{clientWidth:{value:width},clientHeight:{value:height}});outer.scrollTop=0;window.location={search:''};window.matchMedia=()=>({matches:width>=600});
 let snapshot=structuredClone(original),version=snapshot.revision;
 const ctx=vm.createContext({window,document:doc,console,URLSearchParams,setTimeout,clearTimeout,fetch:async url=>({ok:true,json:async()=>url.startsWith('version')?{revision:version}:structuredClone(snapshot)}),requestAnimationFrame:cb=>setTimeout(cb,0),cancelAnimationFrame:clearTimeout,setInterval:()=>0,ResizeObserver:class{observe(){}}});
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
 click('.thread-hit[data-character="c-raido"]');await sleep();assert.equal(run('focusedCharacter'),'c-raido');assert.equal(run('selected.size'),count);assert(!doc.getElementById('focusBar').hidden);assert([...canvas.querySelectorAll('.node')].every(el=>run(`sceneEvents(${JSON.stringify(el.dataset.scene)}).some(e=>e.tracks.includes('c-raido'))`)));assert([...canvas.querySelectorAll('.thread')].some(p=>p.getAttribute('opacity')==='.12'));
 run("navigateEvent('ev-y0-0624-jonin-nominate-teams')");await sleep();assert(doc.querySelector('#cardContent h2').textContent.includes('Райдо'));const current=run('anchorEvent');click('#focusNext');await sleep();const next=run('anchorEvent');assert.notEqual(next,current);assert(run('eventMap.get(anchorEvent).tracks.includes(focusedCharacter)'));click('#focusPrevious');await sleep();assert.equal(run('anchorEvent'),current);
 // A visual screenshot may exist above the title; candidates stay hidden.
 snapshot.media=[{id:'fixture',event_id:current,status:'candidate',src:'media/test.png',alt:'Fixture',locator:'test',source_id:'src-anime-20-23'}];snapshot.revision='test-update';version=snapshot.revision;await run('refreshData()');assert.equal(run('data.revision'),'test-update');assert.equal(run('selected.size'),count);assert.equal(run('focusedCharacter'),'c-raido');assert.equal(doc.querySelectorAll('.event-gallery').length,0);
 snapshot.media[0].status='published';snapshot.revision='test-published';version=snapshot.revision;await run('refreshData()');assert.equal(doc.querySelectorAll('.event-gallery img').length,1);assert(doc.getElementById('cardContent').innerHTML.indexOf('event-gallery')<doc.getElementById('cardContent').innerHTML.indexOf('<h2>'));
 click('#clearFocus');await sleep();assert.equal(run('focusedCharacter'),null);assert(doc.getElementById('focusBar').hidden);
 // First/last event buttons are disabled, and card movement respects selection.
 click('[data-team="team-8"]');await sleep();assert.equal(run('selected.size'),4);run("navigateEvent(orderedScenes().flatMap(s=>s.group).filter(e=>e.day!==null&&relevant(e))[0].id)");assert(doc.querySelector('[data-step-event="-1"]').disabled);click('[data-step-event="1"]');await sleep();assert(run('relevant(eventMap.get(anchorEvent))'));

 // Chosen lines persist when there are no events in the displayed date range.
 click('[data-team="team-7"]');run('zoom=16;center=160;render()');assert.equal(canvas.querySelectorAll('.thread').length,4);assert.equal(canvas.querySelectorAll('.node').length,0);run('zoom=32;render()');assert.equal(canvas.querySelectorAll('.thread').length,4);
 // The classroom and academy exterior are separate scene hubs, including all actions.
 run('selected=new Set(selectable().map(e=>e.id));zoom=365;center=21.5;render()');
 assert.equal(canvas.querySelectorAll('[data-scene="sc-y0-0122-academy-announcements"]').length,1);
 assert.equal(canvas.querySelectorAll('[data-scene="sc-y0-0122-academy-exterior-jonin"]').length,1);
 const hub=run('graphNodes.find(p=>p.id==="sc-y0-0122-academy-announcements")');assert.equal(hub.group.length,6);assert(hub.cast.includes('c-iruka'));assert(hub.cast.includes('c-naruto'));
 // Every line physically present in a scene meets its common hub exactly.
 for(const id of hub.cast){const path=canvas.querySelector('.thread[data-character="'+id+'"]').getAttribute('d');assert(path.includes(hub.x.toFixed(2)+','+hub.y.toFixed(2)),id+' does not reach scene hub');}
 click('[data-scene="sc-y0-0122-academy-announcements"]');assert.equal(doc.querySelectorAll('.scene-actions li').length,6);assert(doc.querySelector('#cardContent h2').textContent.includes('класі'));
 click('[data-open-scene="sc-y0-0122-academy-announcements"]');assert(!doc.getElementById('sceneDialog').hidden);assert.equal(doc.querySelectorAll('[data-scene-action]').length,6);assert(!doc.getElementById('sceneContent').textContent.includes('Асума, Куренай і Райдо чекають'));
 click('[data-scene-event="ev-y0-0122-team7-announced"]');await sleep();assert(doc.getElementById('sceneDialog').hidden);assert.equal(run('focusId'),'sc-y0-0122-academy-announcements');assert(doc.querySelector('#cardContent h2').textContent.includes('Команду 7'));
 assert.equal(doc.querySelector('[data-step-event="-1"]').getAttribute('title'),'Назад');assert.equal(doc.querySelector('[data-step-event="1"]').getAttribute('title'),'Далі');assert.equal(doc.querySelectorAll('.event-navigation').length,0);assert.equal(doc.querySelectorAll('.card-top .card-arrow').length,2);
 click('[data-open-scene]');click('#closeScene');assert(doc.getElementById('sceneDialog').hidden);

 // Desktop hover opens complete data without a click, including the number hit target.
 run('closeCard();zoom=365;center=21.5;render()');await sleep();const sceneNode=doc.querySelector('[data-scene="sc-y0-0122-academy-announcements"]');
 const hover=new window.Event('pointerover',{bubbles:true});Object.defineProperty(hover,'pointerType',{value:width>=600?'mouse':'touch'});sceneNode.querySelector('.scene-count').dispatchEvent(hover);
 assert.equal(doc.getElementById('eventCard').hidden,width<600);
 if(width>=600){assert(doc.querySelector('.scene-actions p').textContent.includes('вікна класу'));assert(sceneNode.classList.contains('is-open'));assert(doc.querySelector('.thread[data-character="c-naruto"]').classList.contains('is-scene-member'));assert(doc.querySelector('.thread[data-character="c-raido"]').classList.contains('is-scene-muted'));sceneNode.dispatchEvent(new window.Event('pointerleave'));doc.getElementById('eventCard').dispatchEvent(new window.Event('pointerenter'));await new Promise(r=>setTimeout(r,350));assert(!doc.getElementById('eventCard').hidden);doc.getElementById('eventCard').dispatchEvent(new window.Event('pointerleave'));await new Promise(r=>setTimeout(r,350));assert(doc.getElementById('eventCard').hidden);}
 else{sceneNode.dispatchEvent(new window.Event('click'));assert(!doc.getElementById('eventCard').hidden);}
 // Characters not yet introduced do not draw unrelated lanes through early scenes.
 assert(!canvas.querySelector('.thread[data-character="c-genma"]'));assert(canvas.querySelector('.thread[data-character="c-naruto"]'));assert.equal(canvas.style.height,height+'px');
 console.log('PASS',width,height,'all/none, names, focus, event navigation, day backgrounds, age tabs, gallery, live refresh');
}
(async()=>{await check(1440,900);await check(375,760);await check(812,375)})().catch(e=>{console.error(e);process.exitCode=1});
