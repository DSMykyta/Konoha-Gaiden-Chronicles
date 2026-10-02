const fs=require('fs'),vm=require('vm'),assert=require('assert');const {parseHTML}=require('linkedom');
const project=require('path').resolve(__dirname,'../public')+'/';
const original=JSON.parse(fs.readFileSync(project+'data.json'));const sleep=()=>new Promise(r=>setTimeout(r,25));
async function check(width,height){
 const {window}=parseHTML(fs.readFileSync(project+'index.html','utf8')),doc=window.document,canvas=doc.getElementById('timeline'),outer=doc.getElementById('canvas');
 const nativeMatches=window.Element.prototype.matches;
 window.Element.prototype.matches=function(selector){return selector===':hover'?this.dataset.testHovered==='true':nativeMatches.call(this,selector);};
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return this.getAttribute('data-test-value')||this.querySelector('option')?.value||'';},set(value){this.setAttribute('data-test-value',value);},configurable:true});window.innerWidth=width;window.innerHeight=height;Object.defineProperty(doc.getElementById('continuity'),'value',{value:'main',writable:true});Object.defineProperties(canvas,{clientWidth:{value:width},clientHeight:{value:height}});Object.defineProperties(outer,{clientWidth:{value:width},clientHeight:{value:height}});outer.scrollTop=0;window.location={search:''};window.matchMedia=()=>({matches:width>=600});
 let snapshot=structuredClone(original),version=snapshot.revision;
 const ctx=vm.createContext({window,document:doc,console,URLSearchParams,setTimeout,clearTimeout,fetch:async url=>({ok:true,json:async()=>url.startsWith('version')?{revision:version}:structuredClone(snapshot)}),requestAnimationFrame:cb=>setTimeout(cb,0),cancelAnimationFrame:clearTimeout,setInterval:()=>0,ResizeObserver:class{observe(){}}});
 for(const file of [...doc.querySelectorAll('script[src]')].map(el=>el.getAttribute('src').split('?')[0]))vm.runInContext(fs.readFileSync(project+file,'utf8'),ctx);await sleep();
 const click=q=>{const el=doc.querySelector(q);assert(el,'Missing '+q);el.dispatchEvent(new window.Event('click',{bubbles:true}));};
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
 click('[data-profile="c-naruto"]');assert(!doc.getElementById('profileDialog').hidden);assert(doc.getElementById('profileDialog').hasAttribute('open'));assert(doc.querySelectorAll('[role="tab"]').length>=1);assert(doc.querySelector('.profile-layout'));assert(doc.querySelector('.profile-visual'));assert(doc.querySelector('.profile-details'));const firstProfileTab=doc.querySelector('[data-profile-version]');click('[data-profile-version="'+firstProfileTab.dataset.profileVersion+'"]');assert(doc.querySelector('[data-profile-version="'+firstProfileTab.dataset.profileVersion+'"]').getAttribute('aria-selected')==='true');assert(doc.getElementById('profileContent').textContent.includes('У хронології'));const narutoProfileText=doc.getElementById('profileContent').textContent;for(const heading of ['Зовнішність','Риси характеру','Цілі','Здібності','Стосунки','Спорядження'])assert(narutoProfileText.includes(heading),'Missing Naruto profile section: '+heading);assert(doc.querySelector('.profile-image'));click('#closeProfile');assert(doc.getElementById('profileDialog').hidden);
 // Focus preserves selection but draws one gently curved lane and only local guests.
 click('.thread-hit[data-character="c-raido"]');await sleep();assert.equal(run('focusedCharacter'),'c-raido');assert.equal(run('selected.size'),count);assert(!doc.getElementById('focusBar').hidden);assert(run("graphNodes.every(p=>p.group.some(e=>e.tracks.includes('c-raido')))"));assert.equal(canvas.querySelectorAll('.thread').length,1);assert.equal(canvas.querySelector('.thread').dataset.character,'c-raido');assert(canvas.querySelector('.focus-guest-entry'));assert(run('Math.max(...graphNodes.map(node=>node.y))-Math.min(...graphNodes.map(node=>node.y))<=16'));
 run("navigateEvent('ev-y0-0624-jonin-nominate-teams')");await sleep();assert(doc.querySelector('#cardContent h2').textContent.includes('Райдо'));const current=run('anchorEvent');click('#focusNext');await sleep();const next=run('anchorEvent');assert.notEqual(next,current);assert(run('eventMap.get(anchorEvent).tracks.includes(focusedCharacter)'));click('#focusPrevious');await sleep();assert.equal(run('anchorEvent'),current);
 // A visual screenshot may exist above the title; candidates stay hidden.
 snapshot.media=[{id:'fixture',event_id:current,status:'candidate',src:'media/test.png',alt:'Fixture',locator:'test',source_id:'src-anime-20-23'}];snapshot.revision='test-update';version=snapshot.revision;await run('refreshData()');assert.equal(run('data.revision'),'test-update');assert.equal(run('selected.size'),count);assert.equal(run('focusedCharacter'),'c-raido');assert.equal(doc.querySelectorAll('.event-gallery').length,0);
 snapshot.media[0].status='published';snapshot.revision='test-published';version=snapshot.revision;await run('refreshData()');assert.equal(doc.querySelectorAll('.event-gallery img').length,1);assert(doc.getElementById('cardContent').innerHTML.indexOf('event-gallery')<doc.getElementById('cardContent').innerHTML.indexOf('<h2>'));
 click('#clearFocus');await sleep();assert.equal(run('focusedCharacter'),null);assert(doc.getElementById('focusBar').hidden);
 // First/last event buttons are disabled, and card movement respects selection.
 click('[data-team="team-8"]');await sleep();assert.equal(run('selected.size'),4);run("navigateEvent(orderedScenes().flatMap(s=>s.group).filter(e=>e.day!==null&&relevant(e))[0].id)");assert(doc.querySelector('[data-step-event="-1"]').disabled);click('[data-step-event="1"]');await sleep();assert(run('relevant(eventMap.get(anchorEvent))'));

 // Chosen lines persist at month and week scales.
 click('[data-team="team-7"]');run('zoom=16;center=160;render()');assert.equal(run('selected.size'),4);assert([...canvas.querySelectorAll('.thread')].every(path=>run('selected.has("'+path.dataset.character+'")')));run('zoom=32;render()');assert.equal(run('selected.size'),4);assert([...canvas.querySelectorAll('.thread')].every(path=>run('selected.has("'+path.dataset.character+'")')));
 // Semantic zoom: day -> moments, week -> scenes, month -> episodes, year -> arcs.
 // Singleton containers collapse visually without changing the underlying hierarchy.
 run('selected=new Set(selectable().map(e=>e.id));zoom=365;center=21.5;render()');
 assert.equal(run('semanticLevel()'),'moment');const dayMoment=canvas.querySelector('[data-event="ev-y0-0122-team7-announced"]');assert(dayMoment);assert(dayMoment.classList.contains('moment-node'));assert(dayMoment.querySelector('circle.mark'));assert.equal(canvas.querySelectorAll('[data-scene="sc-y0-0122-academy-announcements"]').length,0);
 click('[data-event="ev-y0-0122-team7-announced"]');assert.equal(doc.querySelector('.card-kind').textContent,'МОМЕНТ');assert(doc.querySelector('.card-meta-line').textContent.includes('Рік 0'));run('closeCard()');

 run('zoom=zoomModes.week;center=21.5;render()');assert.equal(run('semanticLevel()'),'scene');
 // The classroom remains a scene because it groups multiple moments. The one-moment exterior scene collapses to its moment.
 assert.equal(canvas.querySelectorAll('[data-scene="sc-y0-0122-academy-announcements"]').length,1);
 assert.equal(canvas.querySelectorAll('[data-scene="sc-y0-0122-academy-exterior-jonin"]').length,0);
 assert(canvas.querySelector('[data-event="ev-y0-0122-three-jonin-wait-outside"]').classList.contains('moment-node'));
 const classroomCount=snapshot.events.filter(e=>e.scene_id==='sc-y0-0122-academy-announcements').length;const hub=run('graphNodes.find(p=>p.id==="sc-y0-0122-academy-announcements")');assert.equal(hub.kind,'scene');assert.equal(hub.childCount,classroomCount);assert(hub.cast.includes('c-iruka'));assert(hub.cast.includes('c-naruto'));
 const exterior=run('graphNodes.find(p=>p.id==="ev-y0-0122-three-jonin-wait-outside")');assert.equal(exterior.kind,'moment');assert.equal(hub.x,exterior.x);assert.notEqual(hub.y,exterior.y);assert(!hub.cast.includes('c-raido'));assert(exterior.cast.includes('c-raido'));assert(!exterior.cast.includes('c-kita'));
 // Every line physically present in a scene meets its common hub exactly.
 for(const id of hub.cast){const paths=[...canvas.querySelectorAll('.thread[data-character="'+id+'"]')];assert(paths.some(path=>path.getAttribute('d').includes(hub.x.toFixed(2)+','+hub.y.toFixed(2))),id+' does not reach scene hub');}
 click('[data-scene="sc-y0-0122-academy-announcements"]');assert.equal(run('pinnedNodeId'),'sc-y0-0122-academy-announcements');assert.equal(doc.querySelector('.card-kind').textContent,'СЦЕНА');assert.equal(doc.querySelectorAll('.scene-actions li').length,classroomCount);assert(doc.querySelector('#cardContent h2').textContent.includes('класі'));
 // Hovering another node cannot replace a clicked/pinned card.
 if(width>=600){const other=canvas.querySelector('[data-event="ev-y0-0122-three-jonin-wait-outside"]'),hoverPinned=new window.Event('pointerover',{bubbles:true});Object.defineProperty(hoverPinned,'pointerType',{value:'mouse'});other.dispatchEvent(hoverPinned);assert.equal(run('focusId'),'sc-y0-0122-academy-announcements');assert.equal(run('pinnedNodeId'),'sc-y0-0122-academy-announcements');}
 assert.equal(doc.querySelectorAll('.scene-context,.card-open-scene').length,0);run("readScene('sc-y0-0122-academy-announcements',$('cardContent'))");assert(!doc.getElementById('sceneDialog').hidden);assert.equal(doc.querySelectorAll('[data-scene-action]').length,classroomCount);assert(!doc.getElementById('sceneContent').textContent.includes('Асума, Куренай і Райдо чекають'));
 click('[data-scene-event="ev-y0-0122-team7-announced"]');await sleep();assert(doc.getElementById('sceneDialog').hidden);assert.equal(run('focusId'),'ev-y0-0122-team7-announced');assert.equal(run('pinnedNodeId'),'ev-y0-0122-team7-announced');assert.equal(doc.querySelector('.card-kind').textContent,'МОМЕНТ');assert(doc.querySelector('#cardContent h2').textContent.includes('Команду 7'));
 assert.equal(doc.querySelector('[data-step-event="-1"]').getAttribute('title'),'Назад');assert.equal(doc.querySelector('[data-step-event="1"]').getAttribute('title'),'Далі');assert.equal(doc.querySelectorAll('.event-navigation').length,0);assert.equal(doc.querySelectorAll('.card-top .card-arrow').length,2);
 click('[data-parent-kind="scene"]');assert.equal(doc.querySelector('.card-kind').textContent,'СЦЕНА');run("readScene('sc-y0-0122-academy-announcements',$('cardContent'))");click('#closeScene');assert(doc.getElementById('sceneDialog').hidden);

 // At month scale the classroom assignment sequence is one episode; the one-scene/one-moment jōnin episode still collapses to its moment.
 run('closeCard();zoom=zoomModes.month;center=21.5;render()');assert.equal(run('semanticLevel()'),'episode');
 const formationEpisode=run('graphNodes.find(p=>p.rawId==="ep-y0-team-formation")');const joninCollapsed=run('graphNodes.find(p=>p.id==="ev-y0-0122-three-jonin-wait-outside")');assert(formationEpisode);assert(joninCollapsed);assert.equal(formationEpisode.kind,'episode');assert.equal(formationEpisode.childCount,3);assert.deepEqual(Array.from(formationEpisode.sourceSceneIds),['sc-y0-0122-accidental-kiss','sc-y0-0122-academy-announcements','sc-y0-0122-academy-waiting']);assert.equal(joninCollapsed.kind,'moment');
 run('center=22.5;render()');const raidoEpisode=run('graphNodes.find(p=>p.rawId==="ep-y0-raido-evaluation")');assert(raidoEpisode);assert.equal(raidoEpisode.kind,'episode');assert.equal(raidoEpisode.childCount,4);const raidoNode=canvas.querySelector('[data-event="episode:ep-y0-raido-evaluation"]');assert(raidoNode.classList.contains('episode-node'));assert(raidoNode.querySelector('circle.mark'));click('[data-event="episode:ep-y0-raido-evaluation"]');assert.equal(doc.querySelector('.card-kind').textContent,'ЕПІЗОД');

 run('closeCard();zoom=zoomModes.year;render()');assert.equal(run('semanticLevel()'),'arc');const arcNode=canvas.querySelector('[data-event="arc:arc-y0-genin-formation"]');assert(arcNode);assert(arcNode.classList.contains('arc-node'));assert(arcNode.querySelector('ellipse.mark'));click('[data-event="arc:arc-y0-genin-formation"]');assert.equal(doc.querySelector('.card-kind').textContent,'АРКА');
 // Refresh updates every hierarchy level and clears obsolete child previews.
 click('#eventCard [data-story-episode="ep-y0-team-formation"]');assert.equal(run('HierarchyPreview.size'),1);
 const arc=snapshot.arcs.find(arc=>arc.id==='arc-y0-genin-formation');arc.title='Оновлена арка';snapshot.revision='test-story-update';version=snapshot.revision;await run('refreshData()');
 assert.equal(doc.querySelector('#cardContent h2').textContent,arc.title);assert.equal(run('HierarchyPreview.size'),0);assert.equal(run('pinnedNodeId'),'arc:arc-y0-genin-formation');
 run("navigateScene('sc-y0-0122-academy-exterior-jonin')");snapshot.revision='test-singleton-refresh';version=snapshot.revision;await run('refreshData()');assert(!doc.getElementById('eventCard').hidden);assert.equal(doc.querySelector('.card-kind').textContent,'СЦЕНА');assert.equal(run('cardSelection.id'),'sc-y0-0122-academy-exterior-jonin');
 const beforeRemoval=structuredClone(snapshot);run("navigateScene('sc-y0-0122-academy-announcements')");snapshot.events=snapshot.events.filter(event=>event.scene_id!=='sc-y0-0122-academy-announcements');snapshot.revision='test-remove-scene';version=snapshot.revision;await run('refreshData()');assert(doc.getElementById('eventCard').hidden);assert.equal(run('pinnedNodeId'),null);
 snapshot=beforeRemoval;snapshot.revision='test-restore-scene';version=snapshot.revision;await run('refreshData()');
 run('closeCard()');

 // Desktop hover opens complete scene data without a click.
 run('zoom=zoomModes.week;center=21.5;render()');await sleep();const sceneNode=doc.querySelector('[data-scene="sc-y0-0122-academy-announcements"]');
 sceneNode.dataset.testHovered='true';const hover=new window.Event('pointerover',{bubbles:true});Object.defineProperty(hover,'pointerType',{value:width>=600?'mouse':'touch'});sceneNode.querySelector('.scene-count').dispatchEvent(hover);
 assert(doc.getElementById('eventCard').hidden,'Hover must wait before opening');await new Promise(r=>setTimeout(r,280));
 assert.equal(doc.getElementById('eventCard').hidden,width<=760||height<520);
 if(width>760&&height>=520){assert.equal(doc.querySelectorAll('.scene-actions .scene-action-title').length,classroomCount);assert(sceneNode.classList.contains('is-open'));assert.equal(run('pinnedNodeId'),null);assert(doc.querySelector('.thread[data-character="c-naruto"]').classList.contains('is-scene-member'));assert(doc.querySelector('.thread[data-character="c-raido"]').classList.contains('is-scene-muted'));sceneNode.dispatchEvent(new window.Event('pointerout',{bubbles:true}));doc.getElementById('eventCard').dispatchEvent(new window.Event('pointerenter'));await new Promise(r=>setTimeout(r,350));assert(!doc.getElementById('eventCard').hidden);doc.getElementById('eventCard').dispatchEvent(new window.Event('pointerleave'));await new Promise(r=>setTimeout(r,350));assert(doc.getElementById('eventCard').hidden);}
 else{sceneNode.dispatchEvent(new window.Event('click',{bubbles:true}));assert(!doc.getElementById('eventCard').hidden);}
 // Characters not yet introduced do not draw unrelated lanes through early scenes.
 assert(!canvas.querySelector('.thread[data-character="c-genma"]'));assert(canvas.querySelector('.thread[data-character="c-naruto"]'));assert(parseFloat(canvas.style.height)>=height);
 // After hit-area separation, every physical cast member still reaches the mark
 // exactly, including aggregate nodes at identical display times.
 for(const mode of ['year','month','week','day']){
  run('closeCard();zoom=zoomModes.'+mode+';center=21.5;render()');
  const missing=run(`graphNodes.flatMap(p=>p.cast.filter(id=>{const paths=[...document.querySelectorAll('.thread[data-character="'+id+'"]')];return !paths.some(path=>path.getAttribute('d').includes(p.x.toFixed(2)+','+p.y.toFixed(2)));}).map(character=>({node:p.id,character})))`);
  assert.equal(missing.length,0,mode+' floating nodes: '+JSON.stringify(missing));
 }
 console.log('PASS',width,height,'all/none, names, focus, event navigation, day backgrounds, age tabs, gallery, live refresh');
}
(async()=>{await check(1440,900);await check(375,760);await check(812,375)})().catch(e=>{console.error(e);process.exitCode=1});
