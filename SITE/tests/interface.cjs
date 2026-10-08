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
 assert(/\b61\b/.test(doc.getElementById('periodLabel').textContent),doc.getElementById('periodLabel').textContent);
 assert.equal(doc.querySelectorAll('#eraList li').length,original.periods.length);
 assert.equal(doc.querySelector('#eraList [aria-current="true"] span').textContent,'Епоха нових команд');
 assert(!/Naruto|Boruto|Наруто|Боруто/.test(doc.getElementById('eraList').textContent));
 assert.equal(doc.querySelector('.timeline-key'),null);
 assert.equal(doc.getElementById('eraHeading').getAttribute('aria-label'),'Епоха нових команд');
 assert.equal(doc.querySelector('#eraHeadingTrack [data-era="part-i"]').textContent,'Епоха нових команд');
 assert(doc.getElementById('eventCard').hidden);assert(doc.getElementById('profileDialog').hidden);assert(doc.getElementById('focusBar').hidden);
 const count=run('selectable().length');assert.equal(doc.querySelectorAll('.character input:checked').length,count);assert(count>6);
 assert(canvas.querySelectorAll('.day-band').length);for(const band of canvas.querySelectorAll('.day-band'))assert.equal(Number(band.getAttribute('data-day'))%2,1);
 for(const path of canvas.querySelectorAll('.thread')){assert(path.getAttribute('d').includes(' C'));assert(!path.getAttribute('d').includes('NaN'));assert(!path.getAttribute('d').includes('L'));}
 assert(doc.querySelector('[data-focus-character="c-naruto"]').textContent==='Наруто Узумакі');
 // Mass selection affects the complete roster, even while filtered.
 doc.getElementById('characterSearch').value='Наруто';doc.getElementById('characterSearch').dispatchEvent(new window.Event('input'));click('#deselectAll');await sleep();assert.equal(run('selected.size'),0);assert.equal(canvas.querySelectorAll('.node').length,0);click('#selectAll');await sleep();assert.equal(run('selected.size'),count);doc.getElementById('characterSearch').value='';doc.getElementById('characterSearch').dispatchEvent(new window.Event('input'));
 // Native profile modal, age-specific content and keyboard tabs.
 click('[data-profile="c-naruto"]');assert(!doc.getElementById('profileDialog').hidden);assert(doc.getElementById('profileDialog').hasAttribute('open'));assert(doc.querySelectorAll('[role="tab"]').length>=1);assert(doc.querySelector('.profile-layout'));assert(doc.querySelector('.profile-visual'));assert(doc.querySelector('.profile-details'));const firstProfileTab=doc.querySelector('[data-profile-version]');click('[data-profile-version="'+firstProfileTab.dataset.profileVersion+'"]');assert(doc.querySelector('[data-profile-version="'+firstProfileTab.dataset.profileVersion+'"]').getAttribute('aria-selected')==='true');assert(doc.getElementById('profileContent').textContent.includes('У хронології'));const narutoProfileText=doc.getElementById('profileContent').textContent;for(const heading of ['Зовнішність','Риси характеру','Цілі','Здібності','Стосунки','Спорядження'])assert(narutoProfileText.includes(heading),'Missing Naruto profile section: '+heading);assert(doc.querySelector('.profile-image'));click('#closeProfile');assert(doc.getElementById('profileDialog').hidden);
 // Separate traveller profiles expose the in-world cover without naming Sasuke.
 click('[data-profile="c-unnamed-travelling-performer"]');
 assert.equal(doc.getElementById('profileTitle').textContent,'Невідомий мандрівний артист');
 assert(!/Саске|Sasuke/.test(doc.getElementById('profileContent').textContent));
 assert(doc.getElementById('profileContent').textContent.includes('ім’я не назване'));
 click('#closeProfile');
 click('[data-profile="c-boruto"]');
 assert.equal(doc.getElementById('profileTitle').textContent,'Боруто Узумакі');
 assert(doc.getElementById('profileContent').textContent.includes('справжнє ім’я'));
 click('#closeProfile');
 // Focus preserves the original node coordinates and curves, with local guests.
 const unfocusedY=new Map(run('graphNodes.map(node=>[node.id,node.y])'));
 const originalNodes=[...canvas.querySelectorAll('.node')],originalStrands=[...canvas.querySelectorAll('.thread')],originalCurves=originalStrands.map(path=>path.getAttribute('d'));
 const raidoHit=canvas.querySelector('.thread-hit[data-character="c-raido"]');assert.equal(raidoHit.dataset.tooltip,'Райдо Наміаші');
 if(width>=600){
  const lineHover=new window.Event('pointerover',{bubbles:true});Object.defineProperty(lineHover,'pointerType',{value:'mouse'});raidoHit.dispatchEvent(lineHover);
  assert(canvas.querySelector('.thread[data-character="c-raido"].is-character-hover-active'));
  assert(canvas.querySelector('.thread[data-character="c-naruto"].is-character-hover-muted'));
  raidoHit.dispatchEvent(new window.Event('pointerout',{bubbles:true}));
 }
 click('.thread-hit[data-character="c-raido"]');await sleep();assert.equal(run('focusedCharacter'),'c-raido');assert.equal(run('selected.size'),count);assert(!doc.getElementById('focusBar').hidden);
 assert.deepEqual([...canvas.querySelectorAll('.node')],originalNodes,'Focus replaced nodes');assert.deepEqual([...canvas.querySelectorAll('.thread')],originalStrands,'Focus replaced strands');
 assert.deepEqual(originalStrands.map(path=>path.getAttribute('d')),originalCurves,'Focus changed curves or gaps');
 const continuous=canvas.querySelector('.thread-focus-continuous[data-character="c-raido"].is-line-focus-main');assert(continuous);assert(!continuous.classList.contains('is-line-focus-hidden'));assert.equal(canvas.querySelector('.focus-guest-entry'),null);
 for(const path of originalStrands){const own=path.dataset.character==='c-raido',connected=path.dataset.companions.split(' ').includes('c-raido');assert.equal(path.classList.contains('is-line-focus-hidden'),own||!connected);if(!own&&connected){assert.equal(path.getAttribute('stroke'),'url(#'+path.dataset.focusGradient+')');const stops=[...doc.getElementById(path.dataset.focusGradient).children];assert(stops.some(stop=>Number(stop.getAttribute('stop-opacity'))===0));assert(stops.some(stop=>Number(stop.getAttribute('stop-opacity'))>0));}}
 const focusedNodes=new Set(run('graphNodes.filter(node=>node.cast.includes("c-raido")).map(node=>node.id)'));
 for(const cutout of canvas.querySelectorAll('mask [data-node-id]'))assert.equal(cutout.classList.contains('is-line-focus-hidden'),!focusedNodes.has(cutout.dataset.nodeId),'A hidden node left a false gap in a line');
 for(const point of run('graphNodes'))assert.equal(point.y,unfocusedY.get(point.id),'Focus flattened a story curve');
 run("navigateEvent('ev-y0-0624-jonin-nominate-teams')");await sleep();assert(doc.querySelector('#cardContent h2').textContent.includes('Райдо'));const current=run('anchorEvent');click('#focusNext');await sleep();const next=run('anchorEvent');assert.notEqual(next,current);assert(run('eventMap.get(anchorEvent).tracks.includes(focusedCharacter)'));click('#focusPrevious');await sleep();assert.equal(run('anchorEvent'),current);
 // A visual screenshot may exist above the title; candidates stay hidden.
 snapshot.media=[{id:'fixture',event_id:current,status:'candidate',src:'media/test.png',alt:'Fixture',locator:'test',source_id:'src-anime-20-23'}];snapshot.revision='test-update';version=snapshot.revision;await run('refreshData()');assert.equal(run('data.revision'),'test-update');assert.equal(run('selected.size'),count);assert.equal(run('focusedCharacter'),'c-raido');assert.equal(doc.querySelectorAll('.event-gallery').length,0);
 snapshot.media[0].status='published';snapshot.revision='test-published';version=snapshot.revision;await run('refreshData()');assert.equal(doc.querySelectorAll('.event-gallery img').length,1);assert(doc.getElementById('cardContent').innerHTML.indexOf('event-gallery')<doc.getElementById('cardContent').innerHTML.indexOf('<h2>'));
 click('#clearFocus');await sleep();assert.equal(run('focusedCharacter'),null);assert(doc.getElementById('focusBar').hidden);assert.equal(canvas.querySelectorAll('mask .is-line-focus-hidden').length,0);
 for(const path of canvas.querySelectorAll('.thread'))assert.equal(path.getAttribute('stroke'),path.dataset.restStroke,'Clearing focus changed the ordinary strand paint');
 assert([...canvas.querySelectorAll('.thread-focus-continuous')].every(path=>path.classList.contains('is-line-focus-hidden')));
 // A focused character spans its absences and the calendar hatch, while the
 // normal runs remain separate and return unchanged when the focus closes.
 run('zoom=zoomModes.year;center=axisLength()/2;render()');
 const soraRuns=[...canvas.querySelectorAll('.thread[data-character="c-sora"]')],soraD=soraRuns.map(path=>path.getAttribute('d'));
 assert(soraRuns.length>1);run('setFocus("c-sora")');
 const soraContinuous=canvas.querySelector('.thread-focus-continuous[data-character="c-sora"]');assert(!soraContinuous.classList.contains('is-line-focus-hidden'));assert(Number(soraContinuous.dataset.runCount)>1);
 const allMainStops=[...doc.getElementById('strand-continuous-c-sora').children].map(stop=>Number(stop.getAttribute('stop-opacity')));assert.deepEqual(allMainStops,[0,1,1,0]);
 assert.equal(canvas.querySelectorAll('.thread-focus-continuous.is-line-focus-main').length,1);assert.deepEqual(soraRuns.map(path=>path.getAttribute('d')),soraD);
 const calendarGap=canvas.querySelector('.time-break');if(calendarGap)assert(calendarGap.compareDocumentPosition(soraContinuous)&4,'The calendar hatch covered the focused line');
 run('setFocus("c-sora")');assert.deepEqual(soraRuns.map(path=>path.getAttribute('d')),soraD);
 // First/last event buttons are disabled, and card movement respects selection.
 click('[data-team="team-8"]');await sleep();assert.equal(run('selected.size'),4);run("navigateEvent(chronologicalMoments().filter(relevant)[0].id)");assert(doc.querySelector('[data-step-event="-1"]').disabled);click('[data-step-event="1"]');await sleep();assert(run('relevant(eventMap.get(anchorEvent))'));

 // Chosen lines persist at month and week scales.
 click('[data-team="team-7"]');run('zoom=16;center=160;render()');assert.equal(run('selected.size'),4);assert([...canvas.querySelectorAll('.thread')].every(path=>run('selected.has("'+path.dataset.character+'")')));run('zoom=32;render()');assert.equal(run('selected.size'),4);assert([...canvas.querySelectorAll('.thread')].every(path=>run('selected.has("'+path.dataset.character+'")')));
 // Semantic zoom: day -> moments, week -> scenes, month -> episodes, year -> arcs.
 // Singleton containers collapse visually without changing the underlying hierarchy.
 run('selected=new Set(selectable().map(e=>e.id));navigateEvent("ev-y0-0122-team7-announced");closeCard()');
 assert.equal(run('semanticLevel()'),'moment');const dayMoment=canvas.querySelector('[data-event="ev-y0-0122-team7-announced"]');assert(dayMoment);assert(dayMoment.classList.contains('moment-node'));assert(dayMoment.querySelector('circle.mark'));assert.equal(canvas.querySelectorAll('[data-scene="sc-y0-0122-academy-announcements"]').length,0);
 click('[data-event="ev-y0-0122-team7-announced"]');assert.equal(doc.querySelector('#eventCard .card-kind').textContent,'МОМЕНТ');assert(doc.querySelector('#eventCard .card-meta-line').textContent.includes('22 січня 61'));run('closeCard()');

 run('zoom=zoomModes.week;center=dayToAxis(21.5);render()');assert.equal(run('semanticLevel()'),'scene');
 // The classroom remains a scene because it groups multiple moments. The one-moment exterior scene collapses to its moment.
 assert.equal(canvas.querySelectorAll('[data-scene="sc-y0-0122-academy-announcements"]').length,1);
 assert.equal(canvas.querySelectorAll('[data-scene="sc-y0-0122-academy-exterior-jonin"]').length,0);
 assert(canvas.querySelector('[data-event="ev-y0-0122-three-jonin-wait-outside"]').classList.contains('moment-node'));
 const classroomCount=snapshot.events.filter(e=>e.scene_id==='sc-y0-0122-academy-announcements').length;const hub=run('graphNodes.find(p=>p.id==="sc-y0-0122-academy-announcements")');assert.equal(hub.kind,'scene');assert.equal(hub.childCount,classroomCount);assert(hub.cast.includes('c-iruka'));assert(hub.cast.includes('c-naruto'));
 const exterior=run('graphNodes.find(p=>p.id==="ev-y0-0122-three-jonin-wait-outside")');assert.equal(exterior.kind,'moment');assert.equal(hub.x,exterior.x);assert.notEqual(hub.y,exterior.y);assert(!hub.cast.includes('c-raido'));assert(exterior.cast.includes('c-raido'));assert(!exterior.cast.includes('c-kita'));
 // Every line physically present in a scene meets its common hub exactly.
 for(const id of hub.cast){const paths=[...canvas.querySelectorAll('.thread[data-character="'+id+'"]')];assert(paths.some(path=>path.getAttribute('d').includes(hub.x.toFixed(2)+','+hub.y.toFixed(2))),id+' does not reach scene hub');}
 click('[data-scene="sc-y0-0122-academy-announcements"]');assert.equal(run('pinnedNodeId'),'sc-y0-0122-academy-announcements');assert.equal(doc.querySelector('#eventCard .card-kind').textContent,'СЦЕНА');assert.equal(doc.querySelectorAll('.scene-actions li').length,classroomCount);assert(doc.querySelector('#cardContent h2').textContent.includes('класі'));
 // Hovering another node cannot replace a clicked/pinned card.
 if(width>=600){const other=canvas.querySelector('[data-event="ev-y0-0122-three-jonin-wait-outside"]'),hoverPinned=new window.Event('pointerover',{bubbles:true});Object.defineProperty(hoverPinned,'pointerType',{value:'mouse'});other.dispatchEvent(hoverPinned);assert.equal(run('focusId'),'sc-y0-0122-academy-announcements');assert.equal(run('pinnedNodeId'),'sc-y0-0122-academy-announcements');}
 assert.equal(doc.querySelectorAll('.scene-context,.card-open-scene').length,0);run("readScene('sc-y0-0122-academy-announcements',$('cardContent'))");assert(!doc.getElementById('sceneDialog').hidden);assert.equal(doc.querySelectorAll('[data-scene-action]').length,classroomCount);assert(!doc.getElementById('sceneContent').textContent.includes('Асума, Куренай і Райдо чекають'));
 click('[data-scene-event="ev-y0-0122-team7-announced"]');await sleep();assert(doc.getElementById('sceneDialog').hidden);assert.equal(run('focusId'),'ev-y0-0122-team7-announced');assert.equal(run('pinnedNodeId'),'ev-y0-0122-team7-announced');assert.equal(doc.querySelector('#eventCard .card-kind').textContent,'МОМЕНТ');assert(doc.querySelector('#cardContent h2').textContent.includes('Команду 7'));
 assert.equal(doc.querySelector('[data-step-event="-1"]').getAttribute('title'),'Попередній момент');assert.equal(doc.querySelector('[data-step-event="1"]').getAttribute('title'),'Наступний момент');assert.equal(doc.querySelectorAll('.event-navigation').length,0);assert.equal(doc.querySelectorAll('.card-top .card-arrow').length,2);
 click('[data-parent-kind="scene"]');assert.equal(doc.querySelector('#eventCard .card-kind').textContent,'СЦЕНА');run("readScene('sc-y0-0122-academy-announcements',$('cardContent'))");click('#closeScene');assert(doc.getElementById('sceneDialog').hidden);

 // At month scale the classroom assignment sequence is one episode; the one-scene/one-moment jōnin episode still collapses to its moment.
 run('closeCard();zoom=zoomModes.month;center=dayToAxis(21.5);render()');assert.equal(run('semanticLevel()'),'episode');
 const formationEpisode=run('graphNodes.find(p=>p.rawId==="ep-y0-team-formation")');const joninCollapsed=run('graphNodes.find(p=>p.id==="ev-y0-0122-three-jonin-wait-outside")');assert(formationEpisode);assert(joninCollapsed);assert.equal(formationEpisode.kind,'episode');assert(formationEpisode.childCount>=5,'Team formation should keep its original classroom scenes');assert.equal(formationEpisode.childCount,formationEpisode.sourceSceneIds.length);for(const id of ['sc-y0-0122-accidental-kiss','sc-y0-0122-academy-announcements','sc-y0-0122-sakura-searches-sasuke','sc-y0-0122-naruto-impersonates-sasuke','sc-y0-0122-academy-waiting'])assert(formationEpisode.sourceSceneIds.includes(id),'Missing classroom source scene '+id);assert.equal(joninCollapsed.kind,'moment');
 run('center=dayToAxis(22.5);render()');const raidoEpisode=run('graphNodes.find(p=>p.rawId==="ep-y0-raido-evaluation")');assert(raidoEpisode);assert.equal(raidoEpisode.kind,'episode');assert.equal(raidoEpisode.childCount,4);const raidoNode=canvas.querySelector('[data-event="episode:ep-y0-raido-evaluation"]');assert(raidoNode.classList.contains('episode-node'));assert(raidoNode.querySelector('circle.mark'));click('[data-event="episode:ep-y0-raido-evaluation"]');assert.equal(doc.querySelector('#eventCard .card-kind').textContent,'ЕПІЗОД');

 run('closeCard();zoom=zoomModes.year;render()');assert.equal(run('semanticLevel()'),'arc');const arcNode=canvas.querySelector('[data-event="arc:arc-y0-genin-formation"]');assert(arcNode);assert(arcNode.classList.contains('arc-node'));assert(arcNode.querySelector('ellipse.mark'));click('[data-event="arc:arc-y0-genin-formation"]');assert.equal(doc.querySelector('#eventCard .card-kind').textContent,'АРКА');
 // Cascades have no redundant parent bar and restore parent content/scroll.
 assert.equal(doc.querySelector('#eventCard .story-parent-button'),null);
 click('#eventCard [data-story-episode="ep-y0-team-formation"]');
 const episodePanel=doc.querySelector('[data-hierarchy-depth="0"]');
 assert(!episodePanel.querySelector('.story-parent-button'));assert(!episodePanel.querySelector('.story-panel-header [data-back-hierarchy]'));
 episodePanel.querySelector('.preview-scroll').scrollTop=37;
 click('[data-hierarchy-depth="0"] [data-story-scene="sc-y0-0122-academy-announcements"]');
 assert(!doc.querySelector('[data-hierarchy-depth="1"] .story-parent-button'));
 click('[data-hierarchy-depth="1"] [data-scene-preview="ev-y0-0122-team7-announced"]');
 assert(!doc.querySelector('[data-hierarchy-depth="2"] .story-parent-button'));
 click('[data-hierarchy-depth="2"] [data-back-hierarchy]');assert.equal(run('HierarchyPreview.size'),2);
 click('[data-hierarchy-depth="1"] [data-back-hierarchy]');assert.equal(run('HierarchyPreview.size'),1);
 assert.equal(doc.querySelector('[data-hierarchy-depth="0"]'),episodePanel);assert.equal(episodePanel.querySelector('.preview-scroll').scrollTop,37);
 click('[data-hierarchy-depth="0"] [data-back-hierarchy]');assert.equal(run('HierarchyPreview.size'),0);assert(!doc.getElementById('eventCard').inert);
 click('#eventCard [data-story-episode="ep-y0-team-formation"]');click('[data-hierarchy-depth="0"] [data-close-hierarchy]');
 assert(doc.getElementById('eventCard').hidden);assert.equal(run('HierarchyPreview.size'),0);assert.equal(run('pinnedNodeId'),null);
 run("navigateStory('arc','arc-y0-genin-formation')");
 // Refresh updates every hierarchy level and clears obsolete child previews.
 click('#eventCard [data-story-episode="ep-y0-team-formation"]');assert.equal(run('HierarchyPreview.size'),1);
 const arc=snapshot.arcs.find(arc=>arc.id==='arc-y0-genin-formation');arc.title='Оновлена арка';snapshot.revision='test-story-update';version=snapshot.revision;await run('refreshData()');
 assert.equal(doc.querySelector('#cardContent h2').textContent,arc.title);assert.equal(run('HierarchyPreview.size'),0);assert.equal(run('pinnedNodeId'),'arc:arc-y0-genin-formation');
 run("navigateScene('sc-y0-0122-academy-exterior-jonin')");snapshot.revision='test-singleton-refresh';version=snapshot.revision;await run('refreshData()');assert(!doc.getElementById('eventCard').hidden);assert.equal(doc.querySelector('#eventCard .card-kind').textContent,'СЦЕНА');assert.equal(run('cardSelection.id'),'sc-y0-0122-academy-exterior-jonin');
 const beforeRemoval=structuredClone(snapshot);run("navigateScene('sc-y0-0122-academy-announcements')");snapshot.events=snapshot.events.filter(event=>event.scene_id!=='sc-y0-0122-academy-announcements');snapshot.revision='test-remove-scene';version=snapshot.revision;await run('refreshData()');assert(doc.getElementById('eventCard').hidden);assert.equal(run('pinnedNodeId'),null);
 snapshot=beforeRemoval;snapshot.revision='test-restore-scene';version=snapshot.revision;await run('refreshData()');
 run('closeCard()');

 // Desktop hover opens complete scene data without a click.
 run('zoom=zoomModes.week;center=dayToAxis(21.5);render()');await sleep();const sceneNode=doc.querySelector('[data-scene="sc-y0-0122-academy-announcements"]');
 sceneNode.dataset.testHovered='true';const hover=new window.Event('pointerover',{bubbles:true});Object.defineProperty(hover,'pointerType',{value:width>=600?'mouse':'touch'});sceneNode.querySelector('.scene-count').dispatchEvent(hover);
 assert(doc.getElementById('eventCard').hidden,'Hover must wait before opening');await new Promise(r=>setTimeout(r,280));
 assert.equal(doc.getElementById('eventCard').hidden,width<=760||height<520);
 if(width>760&&height>=520){assert.equal(doc.querySelectorAll('.scene-actions .scene-action-title').length,classroomCount);assert(sceneNode.classList.contains('is-open'));assert.equal(run('pinnedNodeId'),null);assert(doc.querySelector('.thread[data-character="c-naruto"]').classList.contains('is-scene-member'));assert(!doc.querySelector('.thread[data-character="c-raido"]').classList.contains('is-scene-muted'),'Hover hid unrelated strands');sceneNode.dispatchEvent(new window.Event('pointerout',{bubbles:true}));doc.getElementById('eventCard').dispatchEvent(new window.Event('pointerenter'));await new Promise(r=>setTimeout(r,350));assert(!doc.getElementById('eventCard').hidden);doc.getElementById('eventCard').dispatchEvent(new window.Event('pointerleave'));await new Promise(r=>setTimeout(r,350));assert(doc.getElementById('eventCard').hidden);}
 else{sceneNode.dispatchEvent(new window.Event('click',{bubbles:true}));assert(!doc.getElementById('eventCard').hidden);}

 // The transparent hit area and visible mark are one logical hover target.
 if(width>760&&height>=520){
  run('closeCard()');
  const hit=canvas.querySelector('.node-hit[data-node-id="sc-y0-0122-academy-announcements"]');
  const mark=canvas.querySelector('[data-event="sc-y0-0122-academy-announcements"]');
  hit.dataset.testHovered='true';
  const enterHit=new window.Event('pointerover',{bubbles:true});Object.defineProperty(enterHit,'pointerType',{value:'mouse'});hit.dispatchEvent(enterHit);
  hit.dataset.testHovered='false';mark.dataset.testHovered='true';
  const leaveHit=new window.Event('pointerout',{bubbles:true});Object.defineProperty(leaveHit,'relatedTarget',{value:mark});hit.dispatchEvent(leaveHit);
  const enterMark=new window.Event('pointerover',{bubbles:true});Object.defineProperties(enterMark,{pointerType:{value:'mouse'},relatedTarget:{value:hit}});mark.dispatchEvent(enterMark);
  await new Promise(resolve=>setTimeout(resolve,280));
  assert(!doc.getElementById('eventCard').hidden,'Moving from the hit area to the mark lost hover');
  assert.equal(doc.getElementById('cardContent').querySelector('.story-parent-button'),null);
  assert(doc.getElementById('cardParent').querySelector('[data-parent-kind="episode"]'));
  assert.equal(mark,canvas.querySelector('[data-event="sc-y0-0122-academy-announcements"]'),'Hover rebuilt the map');
  run('closeCard()');
 }

 // Characters not yet introduced do not draw unrelated lanes through early scenes.
 assert(!canvas.querySelector('.thread[data-character="c-genma"]'));assert(canvas.querySelector('.thread[data-character="c-naruto"]'));assert(parseFloat(canvas.style.height)>=height);
 // After hit-area separation, every physical cast member still reaches the mark
 // exactly, including aggregate nodes at identical display times.
 for(const mode of ['year','month','week','day']){
  run('closeCard();zoom=zoomModes.'+mode+';center=dayToAxis(21.5);render()');
  const missing=run(`graphNodes.flatMap(p=>p.cast.filter(id=>{const paths=[...document.querySelectorAll('.thread[data-character="'+id+'"]')];return !paths.some(path=>path.getAttribute('d').includes(p.x.toFixed(2)+','+p.y.toFixed(2)));}).map(character=>({node:p.id,character})))`);
  assert.equal(missing.length,0,mode+' floating nodes: '+JSON.stringify(missing));
 }
 // Reading a title changes neither the map topology nor the view; redraw and
 // small pans keep Y anchors fixed. Going from an episode to its arc keeps lines.
 // Limit this interaction fixture to Team 7 so unrelated new scenes cannot
 // legitimately crowd every cloud label out of the short landscape viewport.
 run('closeCard();selected=new Set(teams["team-7"]);zoom=zoomModes.week;center=dayToAxis(21.5);render()');
 const geometry=run('JSON.stringify(graphNodes.map(node=>[node.id,node.x,node.y]))'),view=run('JSON.stringify([zoom,center])');
 assert(canvas.querySelector('.cloud-label'),'The map has no readable group name');
 click('.cloud-label');assert(!doc.getElementById('eventCard').hidden);
 assert.equal(run('JSON.stringify(graphNodes.map(node=>[node.id,node.x,node.y]))'),geometry);
 assert.equal(run('JSON.stringify([zoom,center])'),view);
 run('closeCard();render()');assert.equal(run('JSON.stringify(graphNodes.map(node=>[node.id,node.x,node.y]))'),geometry);
 // Contents replaces the bottom strip, retaining all four reading levels.
 assert.equal(doc.getElementById('storyTitleScale'),null);
 assert.equal(doc.getElementById('storyTitleLevel'),null);
 const contents=doc.getElementById('contentsTree');
 const branches=[['arc','arc-y0-genin-formation'],['episode','ep-y0-team-formation'],['scene','sc-y0-0122-academy-announcements']];
 for(const [kind,id] of [['arc','arc-y0-genin-formation'],['episode','ep-y0-team-formation'],['scene','sc-y0-0122-academy-announcements'],['moment','ev-y0-0122-team7-announced']]){
   click('#contentsButton');
   assert(!doc.getElementById('contentsPanel').hidden);
   for(const [k,pid] of branches){
     if(k===kind)break;
     const detail=contents.querySelector('details[data-contents-key="'+k+':'+pid+'"]');
     assert(detail,'Missing contents parent '+k+':'+pid);
     if(!detail.open)detail.querySelector('summary').dispatchEvent(new window.Event('click',{bubbles:true,cancelable:true}));
   }
   const btn=contents.querySelector('[data-contents-kind="'+kind+'"][data-contents-id="'+id+'"]');
   assert(btn,'Missing contents reader '+kind+':'+id);
   btn.dispatchEvent(new window.Event('click',{bubbles:true}));
   assert.equal(run('cardSelection.kind'),kind);
   assert.equal(run('cardSelection.id'),id);
   run('closeCard()');
 }
 const yBefore=run('new Map(graphNodes.map(node=>[node.id,node.y]))');
 run('center+=.02;render()');for(const node of run('graphNodes'))if(yBefore.has(node.id))assert.equal(node.y,yBefore.get(node.id));
 assert(doc.querySelector('#timeAxis .time-axis-line'));assert(doc.querySelector('#timeAxis text'));
 run("navigateStory('episode','ep-y0-team-formation')");click('#eventCard [data-parent-kind="arc"]');
 assert.equal(doc.querySelector('#eventCard .card-kind').textContent,'АРКА');assert(run('graphNodes.length>0'));assert(canvas.querySelector('.thread'));assert(doc.getElementById('timelineEmpty').hidden);
 const arcGeometry=run('JSON.stringify(graphNodes.map(node=>[node.id,node.x,node.y]))');run('closeCard();render()');assert.equal(run('JSON.stringify(graphNodes.map(node=>[node.id,node.x,node.y]))'),arcGeometry);
 run("navigateStory('episode',[...episodeMap.values()].find(episode=>episode.arc_id==='arc-y0-scroll-of-seals').id)");click('#eventCard [data-parent-kind="arc"]');
 assert.equal(doc.querySelector('#cardContent h2').textContent,'Наруто і Сувій Печатей');assert(run("graphNodes.some(node=>node.rawId==='arc-y0-scroll-of-seals')"));assert(canvas.querySelector('.thread'));assert(doc.getElementById('timelineEmpty').hidden);run('closeCard()');
 // Fitting the year must remember the story date for the next detail view.
 run('setZoom(zoomModes.week)');await sleep();assert(run('axisToDay(center)<31'),'Year-to-week zoom jumped away from the January story');assert(run('graphNodes.length>0'));
 run('zoom=zoomModes.week;center=dayToAxis(21.5);render();setZoom(zoomModes.year)');await sleep();run('setZoom(zoomModes.week)');await sleep();assert(Math.abs(run('axisToDay(center)')-21.5)<1e-8);
 // An explicit wheel pivot uses the visible year center, not the remembered date.
 run('zoom=zoomModes.year;center=dayToAxis(21.5);render()');const pivot=run('dayToAxis(73.5)'),fraction=run('dayToAxis(73.5)/axisLength()');run('setZoom(zoomModes.month,'+pivot+')');await sleep();const bounds=run('range()');assert(Math.abs((pivot-bounds[0])/(bounds[1]-bounds[0])-fraction)<1e-8);
 const moments=run("semanticNodes('moment',orderedScenes())");
 for(const scene of run('orderedScenes()')){if(scene.day===null)continue;const members=moments.filter(node=>node.scene?.id===scene.id);assert(members.every(node=>node.day>scene.day&&node.day<scene.day+1));}
 // Enhanced search is the only renderer; readers open their own hierarchy level.
 run('closeCard();zoom=zoomModes.week;center=dayToAxis(21.5);render()');
 const query=doc.getElementById('eventSearch'),searchType=kind=>click('[data-search-type="'+kind+'"]');
 const fillQuery=value=>{query.value=value;query.dispatchEvent(new window.Event('input'));};
 click('#searchButton');fillQuery('Наруто');searchType('person');
 assert.equal(doc.querySelector('[data-search-event]'),null,'Legacy search flashed over enhanced results');
 const searchMap=run('JSON.stringify(graphNodes.map(node=>[node.id,node.x,node.y]))'),searchView=run('JSON.stringify([zoom,center])');
 click('[data-search-kind="person"][data-search-id="c-naruto"]');assert(!doc.getElementById('profileDialog').hidden);
 assert.equal(run('focusedCharacter'),null,'Opening a dossier focused the line');assert.equal(run('JSON.stringify(graphNodes.map(node=>[node.id,node.x,node.y]))'),searchMap);assert.equal(run('JSON.stringify([zoom,center])'),searchView);
 assert(doc.querySelector('#openCharacterEvents'));doc.getElementById('profileDialog').scrollTop=400;click('#closeProfile');
 click('#searchButton');fillQuery('Сора');searchType('person');click('[data-search-kind="person"][data-search-id="c-sora"]');
 assert.equal(doc.getElementById('profileDialog').scrollTop,0);assert(!doc.getElementById('profileTabs').hidden);assert.equal(doc.querySelectorAll('[data-profile-version]').length,5);
 const twelveText=doc.getElementById('profileContent').textContent;doc.getElementById('profileDialog').scrollTop=400;click('[data-profile-version="sora-13"]');
 assert.equal(run('profileVersion'),'sora-13');assert.equal(doc.getElementById('profileDialog').scrollTop,0);assert.notEqual(doc.getElementById('profileContent').textContent,twelveText);assert(doc.getElementById('profileContent').textContent.includes('польова тактикиня'));assert.equal(doc.querySelector('[data-profile-version="sora-13"]').getAttribute('aria-selected'),'true');
 const firstTab=doc.querySelector('[data-profile-version="sora-13"]'),tabKey=new window.Event('keydown');Object.defineProperty(tabKey,'key',{value:'ArrowRight'});firstTab.dispatchEvent(tabKey);assert.equal(run('profileVersion'),'sora-14');
 const soraEvents=run('characterTimelineEvents("c-sora")').length;click('#openCharacterEvents');assert(!doc.getElementById('characterEventsDialog').hidden);assert.equal(doc.querySelectorAll('.character-event-card').length,soraEvents);
 const soraEventButton=doc.querySelector('[data-character-timeline-event]'),soraEvent=soraEventButton.dataset.characterTimelineEvent;click('[data-character-timeline-event="'+soraEvent+'"]');
 assert(doc.getElementById('characterEventsDialog').hidden);assert(doc.getElementById('profileDialog').hidden);assert.equal(run('anchorEvent'),soraEvent);run('closeCard()');
 click('#searchButton');click('#clearSearchFilters');fillQuery('Оголошення команд');searchType('scene');
 click('[data-search-kind="scene"][data-search-id="sc-y0-0122-academy-announcements"]');assert.equal(run('cardSelection.kind'),'scene');assert.equal(run('cardSelection.id'),'sc-y0-0122-academy-announcements');assert(doc.getElementById('sceneDialog').hidden);run('closeCard()');
 click('#searchButton');click('#clearSearchFilters');searchType('moment');doc.getElementById('searchPerson').value='c-raido';doc.getElementById('searchPerson').dispatchEvent(new window.Event('change'));
 const filtered=run('TimelineSearchEnhanced.searchDocs("").items');assert(filtered.length>0);assert(filtered.every(item=>item.kind==='moment'&&item.personIds.includes('c-raido')));
 doc.getElementById('searchDate').value='31.02';doc.getElementById('searchDate').dispatchEvent(new window.Event('input'));assert(doc.getElementById('searchSummary').textContent.includes('Дата не розпізнана'));assert.equal(doc.querySelector('[data-search-kind]'),null);
 click('#clearSearchFilters');fillQuery('какаш');searchType('person');assert(doc.querySelector('[data-search-kind="person"][data-search-id="c-kakashi"]'));click('#clearSearchFilters');run('closePanels()');
 // Exercise the actual DOM renderer with a second populated year, in both
 // directions. This fixture changes the view metadata, not repository scenes.
 run('closeCard();closePanels();const multi=JSON.parse(JSON.stringify(data));multi.calendar.view_end_year=62;multi.calendar.view_days=730;ingest(multi);');
 window.matchMedia=()=>({matches:false});
 const eraBoundary=run('TimelineEraHeading.segments(data.periods,data.calendar).find(p=>p.id==="timeskip").start');
 const beforeEra=eraBoundary-15;
 run(`renderEraHeading(${beforeEra},day=>10*(day-${beforeEra}))`);
 assert.equal(doc.querySelectorAll('#eraHeadingTrack span').length,2);
 assert.match(doc.querySelector('#eraHeadingTrack [data-era="part-i"]').style.transform,/-/);
 assert(doc.querySelector('#eraHeadingTrack [data-era="timeskip"]'));
 run('renderEraHeading(365,day=>10*(day-365))');
 assert.equal(doc.getElementById('eraHeading').dataset.era,'part-i');
 run(`renderEraHeading(${eraBoundary},day=>10*(day-${eraBoundary}))`);
 assert.equal(doc.getElementById('eraHeading').dataset.era,'timeskip');
 assert.equal(doc.querySelectorAll('#eraHeadingTrack span').length,1);
 assert.equal(doc.querySelector('#eraHeadingTrack span').style.transform,'translate3d(0px,0,0)');
 assert.equal(run('date(365).year'),62);assert.equal(run('date(365).d'),1);
 run(`renderEraHeading(${beforeEra},day=>10*(day-${beforeEra}))`);
 assert.equal(doc.getElementById('eraHeading').dataset.era,'part-i');
 window.matchMedia=()=>({matches:true});
 run(`renderEraHeading(${eraBoundary-1},day=>10*(day-${eraBoundary-1}))`);
 assert.equal(doc.querySelectorAll('#eraHeadingTrack span').length,1);
 assert.equal(doc.querySelector('#eraHeadingTrack span').style.transform,'translate3d(0px,0,0)');
 console.log('PASS',width,height,'all/none, names, focus, event navigation, day backgrounds, age tabs, gallery, live refresh, reversible epoch heading');
}
(async()=>{await check(1440,900);await check(375,760);await check(812,375)})().catch(e=>{console.error(e);process.exitCode=1});
