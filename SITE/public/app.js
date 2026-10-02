'use strict';
const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
const UI_VERSION='20261002-parent-navigation-1';
const uiTimers=TimelineInteractions.scheduler();
let tooltipController=null,hoveredNodeId=null,cardPlacement=null,cardSelection=null;
const months=['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'],gen=['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];
const lengths=[31,28,31,30,31,30,31,31,30,31,30,31],starts=lengths.map((_,i)=>lengths.slice(0,i).reduce((a,b)=>a+b,0));
const palette=['#3f80cf','#cb833e','#7462bc','#ba6487','#358b96','#7d9953','#b89442','#6687b5','#ab7cba','#67877d','#b97a73','#8b91a1'];
const defaults=['c-naruto','c-sasuke','c-sakura','c-kita','c-ren','c-sora'],teams={'team-7':['c-naruto','c-sasuke','c-sakura','c-kakashi'],'team-8':['c-hinata','c-kiba','c-shino','c-kurenai'],'team-9':['c-kita','c-ren','c-sora','c-raido']};
const origins={M:'Манґа',A:'Аніме',F:'Філер',P:'Історія проєкту',R:'Ретроспектива',V:'Фільм',N:'Новела',G:'Гра',O:'Інше'},modes={internal:'внутрішній простір',memory:'спогад',manifested:'проявлення',reanimated:'Едо Тенсей'};
const zoomModes={year:1,month:12,week:365/7,day:365};
function currentZoomMode(){return Object.entries(zoomModes).reduce((best,[mode,value])=>Math.abs(Math.log(zoom/value))<best.distance?{mode,distance:Math.abs(Math.log(zoom/value))}:best,{mode:'year',distance:Infinity}).mode;}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
let data,entityMap,eventMap,sceneMap,episodeMap,arcMap,evidenceMap,sourceMap,profileMap,selected=new Set(),focusedCharacter=null,profileEntity=null,profileVersion=null,profileReturnFocus=null,characterEventsEntity=null,characterEventsReturnFocus=null,sceneId=null,sceneReturnFocus=null,zoom=12,center=21.5,continuity='main',focusId=null,anchorEvent=null,graphNodes=[],raf=null,searchLimit=30;
function date(day){if(day===null)return null;day=clamp(Math.floor(day),0,364);const m=starts.findLastIndex(s=>s<=day);return {d:day-starts[m]+1,m};}
function dateText(day,long=false){const a=date(day);return a?(long?`${a.d} ${gen[a.m]}`:`${String(a.d).padStart(2,'0')}.${String(a.m+1).padStart(2,'0')}`):'Без установленої дати';}
function name(id){const e=entityMap.get(id);return e?.aliases?.find(a=>/[А-Яа-яІіЇїЄєҐґ]/.test(a))||e?.name||id||'Місце не встановлено';}
function fullName(id){return TimelineCore.fullName(entityMap.get(id),profileMap?.get(id));}
function selectable(){return TimelineCore.selectable(data.entities,events());}
function color(id){return palette[[...entityMap.keys()].indexOf(id)%palette.length]||'#8797ac';}
let cachedData=null,cachedContinuity=null,cachedEvents=[],cachedDated=[],cachedScenes=null,cachedRelations=null,cachedBreaks=null;
const layoutCache=new Map(),baseLayoutCache=new Map();
function events(){
 if(cachedData!==data||cachedContinuity!==continuity){
  cachedData=data;cachedContinuity=continuity;
  cachedEvents=data.events.filter(e=>e.continuity===continuity&&e.scene_state!=='inactive');
  cachedDated=cachedEvents.filter(e=>e.day!==null);cachedScenes=null;cachedRelations=null;cachedBreaks=null;layoutCache.clear();baseLayoutCache.clear();
 }
 return cachedEvents;
}
function datedEvents(){events();return cachedDated;}
function relevant(e){return e.tracks.some(id=>selected.has(id));}
function sceneEvents(id){return TimelineCore.ordered(events().filter(e=>e.scene_id===id));}
function sceneCast(scene,group){return [...new Set([...(scene?.presence||[]).filter(p=>!p.mode||['physical','physical_hidden'].includes(p.mode)).map(p=>p.entity_id),...group.flatMap(e=>e.physical)])];}
function actionCount(n){return `${n} ${n%100>=11&&n%100<=14?'дій':n%10===1?'дія':n%10>=2&&n%10<=4?'дії':'дій'}`;}
function navigationEvents(){return events().filter(e=>(focusedCharacter?e.tracks.includes(focusedCharacter):relevant(e))&&StoryTitleScale.allows(e));}
function chronologyRelations(){events();return cachedRelations??= [...data.links,...data.scenes.flatMap(s=>s.relations||[])];}
function orderedScenes(){events();return cachedScenes??= TimelineCore.scenes(events(),chronologyRelations(),data.scenes);}
function semanticLevel(){
 if(zoom>=Math.sqrt(zoomModes.day*zoomModes.week))return 'moment';
 if(zoom>=Math.sqrt(zoomModes.week*zoomModes.month))return 'scene';
 if(zoom>=Math.sqrt(zoomModes.month*zoomModes.year))return 'episode';
 return 'arc';
}
function storyNodeCast(group){return [...new Set(group.flatMap(e=>e.physical||[]))];}
function semanticNodes(level,allScenes){
 const makeMoment=(s,e,day=s.position,episodeId=sceneMap.get(s.id)?.episode_id||null)=>{const scene=sceneMap.get(s.id),layoutCast=[...new Set(e.physical||[])];return {id:e.id,kind:'moment',title:e.title,scene,group:[e],day,calendarDay:s.day,cast:layoutCast.filter(id=>selected.has(id)),layoutCast,locationId:e.location_id||scene?.location_id||null,childCount:1,sourceSceneIds:[s.id],sourceEpisodeIds:episodeId?[episodeId]:[]};};
 const makeScene=(s,episodeId=sceneMap.get(s.id)?.episode_id||null)=>{const scene=sceneMap.get(s.id),layoutCast=sceneCast(scene,s.group);return {id:s.id,kind:'scene',title:scene?.title||s.group[0]?.scene_title||s.id,scene,group:s.group,day:s.position,calendarDay:s.day,cast:layoutCast.filter(id=>selected.has(id)),layoutCast,locationId:scene?.location_id||null,childCount:s.group.length,sourceSceneIds:[s.id],sourceEpisodeIds:episodeId?[episodeId]:[]};};
 const collapseScene=(s,episodeId=null)=>s.group.length===1?makeMoment(s,s.group[0],s.position,episodeId||sceneMap.get(s.id)?.episode_id||null):makeScene(s,episodeId||sceneMap.get(s.id)?.episode_id||null);
 if(level==='moment'){
  const result=[];
  for(const s of allScenes){
   const count=s.group.length,spread=Math.min(.055,.36/Math.max(2,count));
   s.group.forEach((e,i)=>result.push(makeMoment(s,e,clamp(s.position+(i-(count-1)/2)*spread,s.day+.02,s.day+.98))));
  }
  return result;
 }
 if(level==='scene')return allScenes.map(s=>collapseScene(s));
 const episodeBuckets=new Map();
 for(const s of allScenes){
  const scene=sceneMap.get(s.id),episodeId=scene?.episode_id||'scene:'+s.id;
  if(!episodeBuckets.has(episodeId))episodeBuckets.set(episodeId,[]);
  episodeBuckets.get(episodeId).push(s);
 }
 const episodeAggregates=[...episodeBuckets].map(([id,scenes])=>{
  const meta=episodeMap.get(id)||null,group=scenes.flatMap(s=>s.group),layoutCast=storyNodeCast(group),days=scenes.map(s=>s.position),sourceSceneIds=scenes.map(s=>s.id);
  return {id:'episode:'+id,rawId:id,kind:'episode',title:meta?.title||sceneMap.get(scenes[0].id)?.title||id,story:meta,group,day:(Math.min(...days)+Math.max(...days))/2,calendarDay:scenes[0].day,cast:layoutCast.filter(x=>selected.has(x)),layoutCast,locationId:null,childCount:scenes.length,sourceSceneIds,sourceEpisodeIds:meta?[id]:[],scenes};
 });
 if(level==='episode')return episodeAggregates.map(ep=>{
  if(ep.scenes.length!==1)return ep;
  return collapseScene(ep.scenes[0],ep.story?ep.rawId:null);
 });
 const arcBuckets=new Map();
 for(const ep of episodeAggregates){
  const arcId=ep.story?.arc_id;
  if(!arcId||!arcMap.has(arcId))continue;
  if(!arcBuckets.has(arcId))arcBuckets.set(arcId,[]);
  arcBuckets.get(arcId).push(ep);
 }
 return [...arcBuckets].map(([id,episodes])=>{
  const meta=arcMap.get(id)||null,group=episodes.flatMap(e=>e.group),layoutCast=storyNodeCast(group),days=episodes.map(e=>e.day);
  return {id:'arc:'+id,rawId:id,kind:'arc',title:meta?.title||episodes[0].title,story:meta,group,day:(Math.min(...days)+Math.max(...days))/2,calendarDay:Math.floor(Math.min(...days)),cast:layoutCast.filter(x=>selected.has(x)),layoutCast,locationId:null,childCount:episodes.length,sourceSceneIds:[...new Set(episodes.flatMap(e=>e.sourceSceneIds))],sourceEpisodeIds:[...new Set(episodes.flatMap(e=>e.sourceEpisodeIds))]};
 });
}
function semanticOwner(nodes){
 const owner={};
 for(const node of nodes){
  for(const e of node.group)owner[e.id]=node.id;
  for(const id of node.sourceSceneIds||[])owner[id]=node.id;
  for(const id of node.sourceEpisodeIds||[])owner[id]=node.id;
 }
 return owner;
}
function nav(){const allowed=new Set(navigationEvents().map(e=>e.id)),list=orderedScenes().flatMap(s=>s.group).filter(e=>e.day!==null&&allowed.has(e.id)),i=list.findIndex(e=>e.id===anchorEvent),currentDay=axisToDay(center),next=list.findIndex(e=>e.day>=Math.floor(currentDay));return {previous:i>=0?list[i-1]||null:next<0?list.at(-1)||null:list[next-1]||null,next:i>=0?list[i+1]||null:next<0?null:list[next],index:i,total:list.length};}
function stepEvent(direction){const target=nav()[direction<0?'previous':'next'];if(target)navigateEvent(target.id);}
function setFocus(id){StoryTitleScale.clear();focusedCharacter=focusedCharacter===id?null:id;if(focusedCharacter)selected.add(id);closeCard();closePanels();$('canvas').scrollTop=0;renderCharacters();render();}
function updateFocusBar(){const bar=$('focusBar');bar.hidden=!focusedCharacter;if(!focusedCharacter)return;const n=nav();$('focusName').textContent=fullName(focusedCharacter);$('focusPosition').textContent=n.index>=0?`${n.index+1} / ${n.total}`:`${n.total} подій`;$('focusPrevious').disabled=!n.previous;$('focusNext').disabled=!n.next;}
function selectionChanged(){StoryTitleScale.clear();if(focusedCharacter&&!selected.has(focusedCharacter))focusedCharacter=null;closeCard();renderCharacters();render();}
const TIME_GAP_THRESHOLD=14,TIME_GAP_EDGE=7,TIME_BREAK_PX=14;
function chronologyBreaks(dated=datedEvents()){
 if(dated===datedEvents()&&cachedBreaks)return cachedBreaks;
 const days=[...new Set(dated.map(e=>Math.floor(e.day)))].sort((a,b)=>a-b),breaks=[];
 for(let i=1;i<days.length;i++){
  const previous=days[i-1],next=days[i];
  if(next-previous<=TIME_GAP_THRESHOLD)continue;
  const from=previous+TIME_GAP_EDGE,to=next-TIME_GAP_EDGE;
  if(to>from)breaks.push({previous,next,from,to,omitted:to-from});
 }
 if(dated===datedEvents())cachedBreaks=breaks;
 return breaks;
}
function axisBreaks(dated=datedEvents()){
 let removed=0;
 return chronologyBreaks(dated).map(b=>{
  const axis=b.from-removed;
  removed+=b.omitted;
  return {...b,axis};
 });
}
function dayToAxis(day,dated=datedEvents()){
 let value=day;
 for(const b of chronologyBreaks(dated)){
  if(day>=b.to)value-=b.omitted;
  else if(day>b.from){value-=day-b.from;break;}
  else break;
 }
 return value;
}
function axisToDay(value,side='after',dated=datedEvents()){
 let removed=0;
 for(const b of chronologyBreaks(dated)){
  const axis=b.from-removed;
  if(value<axis)return value+removed;
  if(Math.abs(value-axis)<1e-7)return side==='before'?b.from:b.to;
  removed+=b.omitted;
 }
 return value+removed;
}
function axisLength(){return data?dayToAxis(365):365;}
function clampAxisCenter(value,z=zoom){
 const total=axisLength(),half=182.5/z;
 return total<=half*2?total/2:clamp(value,half,total-half);
}
function range(){
 const total=axisLength(),half=182.5/zoom;
 if(total<=half*2)return [0,total];
 const c=clampAxisCenter(center);
 return [c-half,c+half];
}
function makeTimeScale(lo,hi,pad,plot,dated){
 const breaks=axisBreaks(dated).filter(b=>b.axis>=lo&&b.axis<=hi),count=breaks.length;
 const span=Math.max(.001,hi-lo),breakPx=count?Math.min(TIME_BREAK_PX,plot/Math.max(3,count*3)):0;
 const dayPx=Math.max(.001,(plot-breakPx*count)/span);
 const axisPx=value=>{
  let extra=0;
  for(const b of breaks){if(b.axis<value)extra+=breakPx;else break;}
  return pad+(value-lo)*dayPx+extra;
 };
 const px=day=>{
  const value=dayToAxis(day,dated);
  let extra=0;
  for(const b of breaks){
   if(day>=b.to){extra+=breakPx;continue;}
   if(day>b.from){extra+=breakPx*clamp((day-b.from)/Math.max(.001,b.omitted),0,1);}
   break;
  }
  return pad+(value-lo)*dayPx+extra;
 };
 return {
  breaks:breaks.map(b=>({...b,viewFrom:b.from,viewTo:b.to})),
  breakPx,dayPx,px,axisPx,
  hidden:day=>chronologyBreaks(dated).some(b=>day>b.from&&day<b.to)
 };
}
function svg(tag,attrs,parent=$('timeline')){const e=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));parent.append(e);return e;}
function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(render);}
let hoverCard=false,pinnedNodeId=null,cardReturnFocus=null,graphClouds=[],cloudRenderer=null;
function readingActive(){return !!pinnedNodeId&&!$('eventCard').hidden||['sceneDialog','profileDialog','characterEventsDialog'].some(id=>!$(id).hidden);}
function syncReadingState(){cloudRenderer?.setPaused(readingActive());}
function cancelHoverClose(){uiTimers.cancel('card-close');}
function deferHoverClose(){if(hoverCard&&!pinnedNodeId)uiTimers.defer('card-close',TimelineInteractions.CLOSE_DELAY,()=>{if(hoverCard&&!pinnedNodeId)closeCard();});}
function canHover(e){return e.pointerType!=='touch'&&(!window.matchMedia||window.matchMedia('(any-hover: hover)').matches);}
function paintNodes(){
 const p=graphNodes.find(p=>p.id===focusId);
 document.querySelectorAll('.node').forEach(g=>{g.classList.toggle('is-open',g.dataset.event===focusId);g.classList.toggle('is-pinned',g.dataset.event===pinnedNodeId);});
 document.querySelectorAll('.node-hit').forEach(hit=>hit.classList.toggle('is-pinned',hit.dataset.nodeId===pinnedNodeId));
 document.querySelectorAll('.thread').forEach(line=>{const member=!!p&&p.cast.includes(line.dataset.character);line.classList.toggle('is-scene-member',member);line.classList.toggle('is-scene-muted',!!p&&!member);});
 SelectionFocus.update();
}
function pinOpenCard(){
 uiTimers.cancel('node-open');cancelHoverClose();hoveredNodeId=null;
 if(!focusId||$('eventCard').hidden)return;
 if(!pinnedNodeId)rememberCardFocus();
 pinnedNodeId=focusId;hoverCard=false;syncReadingState();paintNodes();
}
function openNode(p,pin=false){
 if(!p)return;
 cancelHoverClose();uiTimers.cancel('node-open');
 if(!pin&&(pinnedNodeId||$('canvas').clientWidth<=760||$('canvas').clientHeight<520))return;
 if(focusId===p.id&&!$('eventCard').hidden){if(pin)pinOpenCard();return;}
 rememberCardFocus();closePanels();HierarchyPreview.clear();
 hoverCard=!pin;pinnedNodeId=pin?p.id:null;focusId=p.id;anchorEvent=p.kind==='moment'?p.group[0]?.id:null;
 if(p.kind==='moment')showEvent(p.group[0]);else if(p.kind==='scene')showSceneCard(p.scene,p.group);else showStoryGroup(p);
 positionCard(p);syncReadingState();tooltipController?.hide();paintNodes();updateFocusBar();if(pin)focusReadingCard();
}
function nodeHover(event){
 const target=event.target.closest?.('.node,.node-hit');if(!target||!canHover(event))return;
 const id=target.dataset.event||target.dataset.nodeId,previous=event.relatedTarget?.closest?.('.node,.node-hit');
 if(previous&&(previous.dataset.event||previous.dataset.nodeId)===id)return;
 cancelHoverClose();if(pinnedNodeId)return;
 hoveredNodeId=id;
 uiTimers.defer('node-open',TimelineInteractions.OPEN_DELAY,()=>{
  if(hoveredNodeId===id&&target.isConnected&&!pinnedNodeId&&TimelineInteractions.hovered(target))openNode(graphNodes.find(p=>p.id===id));
 });
}
function nodeLeave(event){
 const target=event.target.closest?.('.node,.node-hit');if(!target)return;
 const id=target.dataset.event||target.dataset.nodeId,next=event.relatedTarget?.closest?.('.node,.node-hit');
 if(next&&(next.dataset.event||next.dataset.nodeId)===id)return;
 if(hoveredNodeId===id){hoveredNodeId=null;uiTimers.cancel('node-open');}
 deferHoverClose();
}
function headerBottom(){return document.querySelector('.masthead')?.getBoundingClientRect?.().bottom||(($('canvas').clientWidth||1000)<480?144:($('canvas').clientWidth||1000)<=1240?118:64);}
function readingBounds(){const viewport=$('canvas').clientHeight||700,top=headerBottom()+(focusedCharacter?96:44);return {top,height:Math.max(120,Math.min(580,viewport-top-100))};}
function revealReadingNode(){
 const p=graphNodes.find(n=>n.id===focusId);if(!p)return;
 const canvas=$('canvas'),bottom=(canvas.clientHeight||700)-132,top=headerBottom()+40;
 if(p.y-canvas.scrollTop>bottom)canvas.scrollTop=Math.max(0,p.y-bottom);
 else if(p.y-canvas.scrollTop<top)canvas.scrollTop=Math.max(0,p.y-top);
 positionCard(p);
}
function setCardContent(html){
 const contentKey=cardSelection?`${cardSelection.kind}:${cardSelection.id}`:'';
 HierarchyPreview.clear();const container=$('cardContent'),oldScroll=$('cardScroll'),scrollTop=container.dataset.contentKey===contentKey?oldScroll.scrollTop:0;
 const source=document.createElement('div');source.innerHTML=html;
 const header=source.querySelector('.card-top');$('cardHeader').replaceChildren(...(header?[header]:[]));
 $('cardScroll').replaceChildren(...source.childNodes);$('cardScroll').scrollTop=scrollTop;container.dataset.contentKey=contentKey;
 $('eventCard').hidden=false;$('eventCard').classList.add('story-panel');tooltipController?.refresh();
}
function rememberCardFocus(){
 const active=document.activeElement;
 if(!active||active.closest('.story-panel'))return;
 const panel=active.closest('.panel');cardReturnFocus=panel?$(panel.id.replace('Panel','Button')):active;
}
function focusReadingCard(){
 if(document.documentElement.dataset.input==='keyboard')$('cardContent').querySelector('.card-top button:not(:disabled)')?.focus();
}
function closeCard(restoreFocus=false){
 uiTimers.cancel('node-open');hoveredNodeId=null;cancelHoverClose();HierarchyPreview.clear();
 hoverCard=false;pinnedNodeId=null;focusId=null;anchorEvent=null;cardSelection=null;cardPlacement=null;
 $('eventCard').hidden=true;syncReadingState();tooltipController?.hide();paintNodes();updateFocusBar();
 if(restoreFocus){const id=cardReturnFocus?.dataset?.event,target=id?[...document.querySelectorAll('.node')].find(n=>n.dataset.event===id):cardReturnFocus;if(target?.isConnected)target.focus({preventScroll:true});}
 cardReturnFocus=null;
}
function setZoom(value,pivot=center){
 uiTimers.cancel('node-open');hoveredNodeId=null;if(hoverCard)closeCard();
 const old=zoom;zoom=clamp(value,1,730);center=clampAxisCenter(pivot+(center-pivot)*old/zoom);tooltipController?.hide();schedule();
}
function closePanels(except){
 for(const id of ['linesPanel','searchPanel','periodPanel'])if(id!==except){
  const panel=$(id);
  if(panel.hidePopover&&!panel.hidden)panel.hidePopover();
  panel.hidden=true;$(id.replace('Panel','Button')).setAttribute('aria-expanded','false');
 }
}
function togglePanel(id){
 const panel=$(id),opening=panel.hidden;closePanels(id);
 if(!opening){closePanels();return;}
 panel.hidden=false;$(id.replace('Panel','Button')).setAttribute('aria-expanded','true');
 closeCard();
 if(panel.showPopover)panel.showPopover();
 else panel.querySelector('input')?.focus();
}
function renderCharacters(){
 const counts=new Map();events().forEach(e=>e.tracks.forEach(id=>counts.set(id,(counts.get(id)||0)+1)));const q=$('characterSearch').value.toLowerCase().trim();
 $('characterList').innerHTML=selectable().filter(e=>(fullName(e.id)+' '+e.name+' '+(e.aliases||[]).join(' ')).toLowerCase().includes(q)).sort((a,b)=>(defaults.includes(b.id)-defaults.includes(a.id))||fullName(a.id).localeCompare(fullName(b.id),'uk')).map(e=>`<div class="character ${focusedCharacter===e.id?'is-focused':''}"><label class="character-check"><input type="checkbox" value="${esc(e.id)}" aria-label="Показати лінію ${esc(fullName(e.id))}" ${selected.has(e.id)?'checked':''}><span class="swatch" style="background:${color(e.id)}"></span></label><button class="character-name" data-focus-character="${esc(e.id)}" aria-pressed="${focusedCharacter===e.id}" title="Зосередитися на лінії">${esc(fullName(e.id))}</button><span class="count" aria-label="${counts.get(e.id)} подій">${counts.get(e.id)}</span><button class="profile-arrow" data-profile="${esc(e.id)}" aria-label="Профіль: ${esc(fullName(e.id))}" title="Відкрити профіль"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button></div>`).join('')||'<div class="empty"><p>Персонажа не знайдено.</p><button class="secondary-button" data-reset-character-search>Очистити пошук</button></div>';
 $('characterList').querySelectorAll('input').forEach(i=>i.addEventListener('change',()=>{i.checked?selected.add(i.value):selected.delete(i.value);selectionChanged();}));
 $('characterList').querySelectorAll('[data-focus-character]').forEach(b=>b.addEventListener('click',()=>setFocus(b.dataset.focusCharacter)));
 $('characterList').querySelectorAll('[data-profile]').forEach(b=>b.addEventListener('click',()=>openProfile(b.dataset.profile,b)));
 const all=selectable();$('selectAll').disabled=all.every(e=>selected.has(e.id));$('deselectAll').disabled=!selected.size;
 $('characterList').querySelector('[data-reset-character-search]')?.addEventListener('click',()=>{$('characterSearch').value='';renderCharacters();$('characterSearch').focus();});
 document.querySelectorAll('[data-team]').forEach(b=>{const ids=teams[b.dataset.team];b.setAttribute('aria-pressed',String(selected.size===ids.length&&ids.every(id=>selected.has(id))));});
 SelectionFocus.update();tooltipController?.refresh();
}
// Cubic Hermite interpolation produces C1-continuous Bézier paths; event anchors are exact.
function smoothPath(points){
 if(points.length<2)return '';const slopes=TimelineCore.slopes(points,'x');
 let d=`M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],h=(b.x-a.x)/3;d+=` C${(a.x+h).toFixed(2)},${(a.y+slopes[i-1]*h).toFixed(2)} ${(b.x-h).toFixed(2)},${(b.y-slopes[i]*h).toFixed(2)} ${b.x.toFixed(2)},${b.y.toFixed(2)}`;}
 return d;
}
function render(){
 if(!data)return;
 uiTimers.cancel('node-open');hoveredNodeId=null;if(hoverCard)closeCard();
 const canvas=$('canvas'),timeline=$('timeline'),axis=$('timeAxis'),w=canvas.clientWidth||timeline.clientWidth||1000,viewport=canvas.clientHeight||700,pad=w<600?22:48,[lo,hi]=range(),plot=w-2*pad;
 const chrome=headerBottom();document.documentElement.style.setProperty('--legend-top',(chrome+4)+'px');document.documentElement.style.setProperty('--panel-top',(chrome+12)+'px');document.documentElement.style.setProperty('--focus-top',(chrome+44)+'px');
 const allEvents=datedEvents(),ids=[...selected].sort((a,b)=>(defaults.indexOf(a)>=0?defaults.indexOf(a):99)-(defaults.indexOf(b)>=0?defaults.indexOf(b):99)||fullName(a).localeCompare(fullName(b),'uk'));
 let h=viewport;
 const phoneReader=w<=760&&viewport>=520,readerHeight=phoneReader?(document.documentElement.classList.contains('story-reader-collapsed')?56:Math.min(viewport*.34,264)):76;
 const n=ids.length,overview=zoom<3,spread=clamp(Math.log(zoom)/Math.log(zoomModes.month),0,1),compactRadius=clamp(plot/180,3,7),arcRadius=compactRadius+(16-compactRadius)*spread,mid=phoneReader?(headerBottom()+44+viewport-readerHeight-56)/2:viewport*(viewport<520?.5:.59),amplitude=clamp((viewport-readerHeight-144)*.25,24,150)*(.08+.92*spread),level=semanticLevel();
 axis.style.width=w+'px';axis.setAttribute('viewBox',`0 0 ${w} 40`);
 const timeScale=makeTimeScale(lo,hi,pad,plot,allEvents),px=timeScale.px,pxAxis=timeScale.axisPx,loDay=axisToDay(lo,'before',allEvents),hiDay=axisToDay(hi,'after',allEvents),allScenes=orderedScenes().filter(s=>s.day!==null);
 const baseNodes=semanticNodes(level,allScenes).filter(p=>p.day!==null).map(p=>({...p,x:px(p.day)})),owner=semanticOwner(baseNodes),layoutKey=`${level}:${viewport}:${w}:${zoom}:${amplitude}:${readerHeight}`;
 if(!layoutCache.has(layoutKey)){
  if(layoutCache.size>=8)layoutCache.clear();
  const baseKey=level;
  if(!baseLayoutCache.has(baseKey)){
   if(baseLayoutCache.size>=8)baseLayoutCache.clear();
   baseLayoutCache.set(baseKey,TimelineCore.sceneLayout(baseNodes,chronologyRelations(),owner,0,1));
  }
  const baseY=baseLayoutCache.get(baseKey),fullTop=viewport<520?104:w<=760?headerBottom()+44:166,fullBottom=Math.max(fullTop+80,viewport-readerHeight-56),top=(mid-28)*(1-spread)+fullTop*spread,bottom=(mid+28)*(1-spread)+fullBottom*spread,compactClearance=compactRadius*2-4,clearance=compactClearance+(46-compactClearance)*spread;
  const separated=TimelineCore.separateNodes(baseNodes.map(p=>({...p,x:dayToAxis(p.day,allEvents)*plot/(hi-lo),y:mid+(baseY.get(p.id)||0)*amplitude})),top,bottom,clearance);
  layoutCache.set(layoutKey,new Map(separated.map(p=>[p.id,p.y])));
 }
 const nodeY=layoutCache.get(layoutKey);
 let globalNodes=baseNodes.map(p=>({...p,y:focusedCharacter&&p.group.some(e=>e.tracks.includes(focusedCharacter))?mid+clamp(((nodeY.get(p.id)??mid)-mid)*.045,-8,8):nodeY.get(p.id)??mid}));
 const linked=(p,id)=>p.cast.includes(id)||(id===focusedCharacter&&p.group.some(e=>e.tracks.includes(id)));
 graphNodes=globalNodes.filter(p=>{const a=dayToAxis(p.day,allEvents);return a>=lo&&a<hi&&p.group.some(e=>focusedCharacter?e.tracks.includes(focusedCharacter):relevant(e));});
 const numbered=phoneReader&&level==='moment';
 graphNodes.sort((a,b)=>a.day-b.day||a.id.localeCompare(b.id));
 graphNodes.forEach((node,index)=>{node.number=numbered?index+1:null;});
 const reading=readingActive();
 graphClouds=StoryClouds.groups(graphNodes,level,sceneMap,episodeMap);
 h=Math.max(viewport,...graphNodes.map(p=>p.y+156));
 timeline.style.height=h+'px';timeline.setAttribute('viewBox',`0 0 ${w} ${h}`);
 timeline.replaceChildren();axis.replaceChildren();$('linesCount').textContent=`Лінії · ${selected.size}`;
 // Alternating calendar days, including empty days. Long empty spans are omitted
 // after retaining one calendar week on each side of the nearest events.
 if(timeScale.dayPx>=2)for(let day=Math.floor(loDay);day<Math.ceil(hiDay);day++){const a=dayToAxis(day+.5,allEvents);if(day%2===1&&a>=lo&&a<hi&&!timeScale.hidden(day+.5))svg('rect',{x:clamp(px(day),0,w),y:0,width:Math.max(0,clamp(px(day+1),0,w)-clamp(px(day),0,w)),height:h,class:'day-band','data-day':day});}
 if(!cloudRenderer)cloudRenderer=StoryClouds.create($('storyClouds'));
 cloudRenderer.update({groups:graphClouds,nodes:graphNodes,width:w,height:viewport,scrollTop:canvas.scrollTop,paused:reading});
 const centerDay=axisToDay(center,'after',allEvents),activeMode=currentZoomMode(),label=overview?'Рік 0':activeMode==='day'?`${dateText(centerDay,true)} · Рік 0`:`${dateText(loDay)} — ${dateText(Math.max(loDay,hiDay-.01))} · Рік 0`;$('periodLabel').textContent=label;
 document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===activeMode)));
 document.querySelectorAll('[data-level]').forEach(e=>e.setAttribute('aria-current',String(e.dataset.level===level)));
 $('previous').disabled=lo<=.001;$('next').disabled=hi>=axisLength()-.001;
 $('zoomOut').disabled=zoom<=1;$('zoomIn').disabled=zoom>=730;
 const ticks=zoom<8?starts.map((d,i)=>({day:d,text:months[i].slice(0,3)})):Array.from({length:Math.max(0,Math.ceil(hiDay)-Math.floor(loDay)+1)},(_,i)=>({day:Math.floor(loDay)+i,text:dateText(Math.floor(loDay)+i)}));
 const visibleTicks=ticks.filter(t=>{const a=dayToAxis(t.day,allEvents);return a>=lo&&a<hi&&!timeScale.hidden(t.day);}),step=zoom<8?1:Math.max(1,Math.ceil(visibleTicks.length/(plot/75)));
 visibleTicks.forEach((t,i)=>{if(i%step)return;svg('line',{x1:px(t.day),x2:px(t.day),y1:5,y2:10,stroke:'#bfcbdc'},axis);const txt=svg('text',{x:px(t.day),y:28,'text-anchor':'middle'},axis);txt.textContent=t.text;});
 timeScale.breaks.forEach(b=>{const x1=px(b.viewFrom),x2=px(b.viewTo),mid=(x1+x2)/2,g=svg('g',{class:'axis-break','aria-hidden':'true'},axis);svg('rect',{x:x1-1,y:0,width:Math.max(2,x2-x1+2),height:40,class:'time-break-axis-mask'},g);svg('path',{d:`M${mid-5} 15 l4 -9 M${mid+1} 15 l4 -9`,class:'time-break-axis-slash'},g);});
 const labelPositions=[],defs=svg('defs',{}),pixelsPerDay=plot/(hi-lo),lead=Math.min(4,72/pixelsPerDay);
 const halo=svg('radialGradient',{id:'strand-node-halo'},defs);
 for(const [offset,value] of [[0,'black'],[.72,'black'],[1,'white']])svg('stop',{offset,'stop-color':value},halo);
 if(timeScale.breaks.length){const pattern=svg('pattern',{id:'time-break-hatch',width:8,height:8,patternUnits:'userSpaceOnUse'},defs);svg('path',{d:'M-2 8 L8 -2 M4 10 L10 4',class:'time-break-hatch-line'},pattern);}
 ids.forEach(id=>{
  if(focusedCharacter&&id!==focusedCharacter)return;
  const anchors=globalNodes.filter(p=>linked(p,id)).map(p=>{const activity=p.group.filter(e=>e.physical?.includes(id));return {day:dayToAxis(p.day,allEvents),calendarDay:p.calendarDay,activityFrom:Math.min(...(activity.length?activity:p.group).map(e=>e.day)),activityTo:Math.max(...(activity.length?activity:p.group).map(e=>e.day)),y:p.y,id:p.id};}).sort((a,b)=>a.day-b.day||a.id.localeCompare(b.id));
  if(!anchors.length||anchors[0].day-lead>hi||anchors.at(-1).day+lead<lo)return;
  const lifetimes=focusedCharacter===id?[anchors]:TimelineCore.lifetimes(anchors,{pixelsPerDay,maxBridge:Math.min(480,plot*.6)});
  const runs=lifetimes.filter(run=>run[0].day-lead<=hi&&run.at(-1).day+lead>=lo),routes=runs.map(run=>TimelineCore.strand(run,id,mid,focusedCharacter?30:amplitude,lead,pixelsPerDay));
  if(!routes.length)return;
  const coordinates=routes.map(route=>route.map(p=>({x:pxAxis(p.day),y:p.y,node:p.node,flat:p.flat}))),samples=coordinates.map(route=>route.map(p=>({...p,day:p.x}))),paths=coordinates.map(smoothPath);
  const foreign=graphNodes.filter(p=>!linked(p,id)&&samples.some(route=>p.x>=route[0].day&&p.x<=route.at(-1).day&&Math.abs(TimelineCore.curveY(route,p.x)-p.y)<(p.kind==='arc'?arcRadius:19)+7));
  let mask=null;
  if(foreign.length){
   const maskId='strand-clearance-'+id,cutout=svg('mask',{id:maskId,maskUnits:'userSpaceOnUse',x:0,y:0,width:w,height:h},defs);
   svg('rect',{x:0,y:0,width:w,height:h,fill:'white'},cutout);
   foreign.forEach(p=>svg('ellipse',{cx:p.x,cy:p.y,rx:p.kind==='arc'?arcRadius+3:p.kind==='moment'?(numbered?17:13):19,ry:p.kind==='arc'?arcRadius*.58+3:p.kind==='moment'?(numbered?17:13):19,fill:'url(#strand-node-halo)','data-node-id':p.id},cutout));
   mask=`url(#${maskId})`;
  }
  routes.forEach((route,index)=>{
   const run=runs[index],gradientId=`strand-${id}-${index}`,span=Math.max(.001,route.at(-1).day-route[0].day),gradient=svg('linearGradient',{id:gradientId,gradientUnits:'userSpaceOnUse',x1:pxAxis(route[0].day),x2:pxAxis(route.at(-1).day),y1:0,y2:0},defs);
   for(const [offset,opacity] of [[0,0],[(run[0].day-route[0].day)/span,1],[(run.at(-1).day-route[0].day)/span,1],[1,0]])svg('stop',{offset,'stop-color':color(id),'stop-opacity':opacity},gradient);
   svg('path',{d:paths[index],class:'thread',stroke:`url(#${gradientId})`,'stroke-width':id===focusedCharacter?3:overview?1.5:n>24?1.2:2.1,opacity:focusedCharacter?'1':n>24?'.35':'.85','data-character':id,'data-first-axis':run[0].day,'data-last-axis':run.at(-1).day,...(mask?{mask}:{})});
  });
  const hit=svg('path',{d:paths.join(' '),class:'thread-hit',stroke:'transparent','stroke-width':14,role:'button',tabindex:overview&&n>20&&!focusedCharacter?-1:0,'aria-label':`Зосередитися: ${fullName(id)}`,'aria-pressed':id===focusedCharacter,'data-character':id,...(mask?{mask}:{})});
  hit.addEventListener('click',()=>setFocus(id));hit.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setFocus(id);}});
  if(!overview&&(focusedCharacter?id===focusedCharacter:n<=18)){
   const route=routes[0];
   const labelDay=Math.max(lo,route[0].day),labelX=pxAxis(labelDay),actualY=TimelineCore.curveY(route,labelDay);let labelY=actualY-12;while(labelPositions.some(y=>Math.abs(y-labelY)<16))labelY-=16;labelPositions.push(labelY);
   if(Math.abs(labelY-(actualY-12))>1)svg('line',{x1:labelX+2,x2:labelX+2,y1:actualY-3,y2:labelY+3,stroke:color(id),'stroke-width':.6,opacity:.5});
   const text=svg('text',{x:labelX+6,y:labelY,class:'line-label',role:'button',tabindex:0,'data-character':id,'aria-label':`Зосередитися: ${fullName(id)}`,style:`fill:color-mix(in srgb,${color(id)} 60%,#272f2b);font-size:12px`});text.textContent=name(id);text.addEventListener('click',()=>setFocus(id));text.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setFocus(id);}});
  }
 });
 timeScale.breaks.forEach(b=>{
  const x1=px(b.viewFrom),x2=px(b.viewTo),width=Math.max(1,x2-x1),g=svg('g',{class:'time-break','aria-hidden':'true'});
  const title=svg('title',{},g);title.textContent=`Пропущено ${Math.max(1,Math.round(b.omitted))} дн. між ${dateText(b.previous,true)} і ${dateText(b.next,true)}`;
  svg('rect',{x:x1,y:0,width,height:h,class:'time-break-mask'},g);
  svg('rect',{x:x1,y:0,width,height:h,class:'time-break-hatch'},g);
  svg('line',{x1,x2:x1,y1:0,y2:h,class:'time-break-edge'},g);
  svg('line',{x1:x2,x2,y1:0,y2:h,class:'time-break-edge'},g);
 });
 if(focusedCharacter){
  const guests=svg('g',{class:'focus-guest-layer','aria-hidden':'true'});
  graphNodes.forEach(node=>{
   const ids=[...new Set(node.group.flatMap(event=>event.physical?.length?event.physical:event.tracks||[]))].filter(id=>id!==focusedCharacter&&entityMap.has(id));
   ids.forEach((id,index)=>{
    const tier=Math.floor(index/2),reach=16+18*spread,x=node.x-reach-Math.min(4+6*spread,tier*2),y=node.y+(index%2===0?-1:1)*(6+12*spread+Math.min(tier*2,4+6*spread)),gradientId=`focus-guest-${node.id.replace(/[^a-z0-9_-]/gi,'_')}-${id}`;
    const gradient=svg('linearGradient',{id:gradientId,gradientUnits:'userSpaceOnUse',x1:x,x2:node.x,y1:y,y2:node.y},defs);
    svg('stop',{offset:0,'stop-color':color(id),'stop-opacity':0},gradient);svg('stop',{offset:1,'stop-color':color(id),'stop-opacity':'.82'},gradient);
    svg('path',{class:'focus-guest-entry','data-character':id,'data-node-id':node.id,stroke:`url(#${gradientId})`,d:`M${x.toFixed(2)},${y.toFixed(2)} C${(node.x-reach*.7).toFixed(2)},${y.toFixed(2)} ${(node.x-reach*.45).toFixed(2)},${node.y.toFixed(2)} ${node.x.toFixed(2)},${node.y.toFixed(2)}`},guests);
   });
  });
 }
 // Large touch targets stay below every visible mark. A neighboring transparent
 // target can never intercept a tap directly on another node's visible center.
 const hitLayer=svg('g',{'aria-hidden':'true'});
 graphNodes.forEach(p=>{
  const hit=svg(p.kind==='arc'?'ellipse':'circle',{class:'node-hit','data-node-id':p.id,cx:p.x,cy:p.y,...(p.kind==='arc'?{rx:12+12*spread,ry:10+12*spread}:{r:22})},hitLayer);
 });
 graphNodes.forEach(p=>{
  const kindLabel={moment:'Момент',scene:'Сцена',episode:'Епізод',arc:'Арка'}[p.kind]||'Вузол',label=`${kindLabel}: ${p.title}${p.kind==='moment'||p.kind==='arc'?'':` · ${p.childCount}`}`,g=svg('g',{class:'node '+p.kind+'-node'+(focusId===p.id?' is-open':'')+(pinnedNodeId===p.id?' is-pinned':''),tabindex:0,role:'button','aria-label':label,'aria-haspopup':'dialog','data-event':p.id,'data-scene':p.kind==='scene'?(p.scene?.id||''):''});
  if(p.kind==='arc'){
   svg('ellipse',{class:'mark',cx:p.x,cy:p.y,rx:arcRadius,ry:arcRadius*.58},g);
  }else{
   const radius=p.kind==='moment'?(numbered?11:5):p.kind==='scene'?9:11;
   svg('circle',{class:'mark',cx:p.x,cy:p.y,r:radius},g);
   if(p.kind==='scene'||p.kind==='episode'){const count=svg('text',{class:'scene-count',x:p.x,y:p.y+3,'text-anchor':'middle'},g);count.textContent=p.childCount>99?'99+':p.childCount;}
   if(p.number){const number=svg('text',{class:'moment-number',x:p.x,y:p.y+3.5,'text-anchor':'middle','aria-hidden':'true'},g);number.textContent=p.number;}
  }
 });
 $('timelineEmpty').hidden=graphNodes.length>0;
 if(!graphNodes.length){
  $('emptyTitle').textContent=selected.size?'У цьому періоді немає подій':'Обери лінії персонажів';
  $('emptyDescription').textContent=selected.size?'Перейди до найближчої події обраних персонажів.':'Їхні події з’являться на хронології.';
  $('emptyAction').textContent=selected.size?'До найближчої події':'Обрати всіх';
 }
 if(!$('eventCard').hidden){const a=graphNodes.find(p=>p.id===focusId);if(a)positionCard(a);else HierarchyPreview.layout();}
 paintNodes();updateFocusBar();StoryTitleScale.update();tooltipController?.refresh();
}
function positionCard(point){
 const canvas=$('canvas'),w=canvas.clientWidth||1000,h=canvas.clientHeight||700,bounds=readingBounds();
 cardPlacement=TimelineInteractions.cardLayout(w,point.x,point.y-canvas.scrollTop,bounds.top,h-116);
 $('eventCard').hidden=false;HierarchyPreview.layout();
}
function bindCard(){HierarchyPreview.bind($('cardContent'));}
function storyParent(kind,id){
 let target=null;
 if(kind==='moment'){const scene=eventMap.get(id)?.scene_id;if(scene)target={kind:'scene',id:scene};}
 if(kind==='scene'){const episode=sceneMap.get(id)?.episode_id;if(episode)target={kind:'episode',id:episode};}
 if(kind==='episode'){const arc=episodeMap.get(id)?.arc_id;if(arc)target={kind:'arc',id:arc};}
 if(!target)return null;
 const meta=({scene:sceneMap,episode:episodeMap,arc:arcMap})[target.kind].get(target.id);
 return meta?{...target,title:meta.title}:null;
}
function parentControl(kind,id,hierarchy=false){
 const target=storyParent(kind,id);if(!target)return '';
 const label={scene:'До сцени',episode:'До епізоду',arc:'До арки'}[target.kind];
 return `<button class="story-parent-button" ${hierarchy?'data-back-hierarchy':`data-parent-kind="${target.kind}" data-parent-id="${esc(target.id)}"`} aria-label="${esc(label+': '+target.title)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg><span class="story-parent-label"><span>${label}</span><span class="story-parent-title">${esc(target.title)}</span></span></button>`;
}
function storyPanelHeader(kind,dateOrRange,hasYear,id,actions='',hierarchy=false){
 return `<div class="${hierarchy?'story-panel-header':'card-top'}">${parentControl(kind,id,hierarchy)}<div class="story-panel-meta">${cardMetaLine(kind,dateOrRange,hasYear)}<div class="card-top-actions">${actions}<button class="close" ${hierarchy?'data-close-hierarchy':'data-close-card'} aria-label="Закрити читання" data-tooltip="Закрити читання">×</button></div></div></div>`;
}
function storyPoint(kind,id){
 const meta=(kind==='arc'?arcMap:episodeMap).get(id);if(!meta)return null;
 const episodeIds=kind==='arc'?[...episodeMap.values()].filter(ep=>ep.arc_id===id).map(ep=>ep.id):[id],members=new Set(episodeIds);
 const scenes=orderedScenes().filter(scene=>members.has(sceneMap.get(scene.id)?.episode_id));if(!scenes.length)return null;
 const group=scenes.flatMap(scene=>scene.group),positions=scenes.map(scene=>scene.position).filter(Number.isFinite),layoutCast=storyNodeCast(group);
 return {id:kind+':'+id,rawId:id,kind,title:meta.title,story:meta,group,day:positions.length?(Math.min(...positions)+Math.max(...positions))/2:null,calendarDay:scenes[0].day,cast:layoutCast.filter(id=>selected.has(id)),layoutCast,childCount:kind==='arc'?episodeIds.length:scenes.length,sourceSceneIds:scenes.map(scene=>scene.id),sourceEpisodeIds:episodeIds,scenes};
}
function navigateStory(kind,id){
 const point=storyPoint(kind,id);if(!point||!prepareNavigation(point.group[0]))return;
 zoom=kind==='arc'?zoomModes.year:zoomModes.month;if(point.day!==null)center=clampAxisCenter(dayToAxis(point.day));
 focusId=point.id;pinnedNodeId=point.id;anchorEvent=null;showStoryGroup(point);render();
 const node=graphNodes.find(node=>node.id===point.id)||graphNodes.find(node=>node.group.some(e=>point.group.some(member=>member.id===e.id)));
 if(node)positionCard(node);else positionCard({x:($('canvas').clientWidth||1000)/2,y:($('canvas').clientHeight||700)*.6});focusReadingCard();
}
function cardKindLabel(kind){return ({moment:'МОМЕНТ',scene:'СЦЕНА',episode:'ЕПІЗОД',arc:'АРКА'})[kind]||String(kind||'').toUpperCase();}
function cardMetaLine(kind,dateOrRange,hasYear=true){return `<span class="card-meta-line"><strong class="card-kind">${esc(cardKindLabel(kind))}</strong><span aria-hidden="true"> · </span><span>${esc(dateOrRange)}</span>${hasYear?'<span aria-hidden="true"> · </span><span>Рік 0</span>':''}</span>`;}
function cardTop(day,navigation,kind='moment',id=null){
 const navKind=kind==='scene'?'scene':'event';
 const arrow=(direction,label)=>`<button class="card-arrow" data-step-${navKind}="${direction}" aria-label="${label}" title="${label}" ${navigation[direction<0?'previous':'next']?'':'disabled'}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${direction<0?'m14 6-6 6 6 6':'m10 6 6 6-6 6'}"/></svg></button>`;
 const actions=`<nav class="card-arrows" aria-label="Перехід між ${kind==='scene'?'сценами':'моментами'}">${arrow(-1,kind==='scene'?'Попередня сцена':'Попередній момент')}${arrow(1,kind==='scene'?'Наступна сцена':'Наступний момент')}</nav>`;
 return storyPanelHeader(kind,day===null?'Без установленої дати':dateText(day,true),day!==null,id,actions);
}
function sceneNavigation(id){const allowed=new Set(navigationEvents().map(e=>e.id)),list=orderedScenes().filter(s=>s.group.some(e=>allowed.has(e.id))),i=list.findIndex(s=>s.id===id);return {previous:list[i-1]||null,next:list[i+1]||null};}
function stepScene(direction){const id=sceneMap.has(focusId)?focusId:eventMap.get(focusId)?.scene_id,target=sceneNavigation(id)[direction<0?'previous':'next'];if(target)navigateScene(target.id);}
function navigateScene(id){
 const group=sceneEvents(id),e=group.find(e=>focusedCharacter?e.tracks.includes(focusedCharacter):relevant(e))||group[0];if(!prepareNavigation(e))return;
 if(e.day!==null){zoom=zoomModes.week;center=clampAxisCenter(dayToAxis(e.day+.5));}
 focusId=group.length===1?e.id:id;pinnedNodeId=focusId;anchorEvent=null;showSceneCard(sceneMap.get(id),group);$('eventCard').hidden=false;render();revealReadingNode();focusReadingCard();
}
function sceneCardBody(scene,group){
 const cast=sceneCast(scene,group);
 return `<h2>${esc(scene.title)}</h2>${cast.length?`<div class="people scene-people">${cast.map(id=>`<button class="person" style="--person-color:${color(id)}" data-event-focus-character="${esc(id)}" aria-label="Зосередитися на лінії ${esc(name(id))}" data-tooltip="Зосередитися на лінії">${esc(name(id))}</button>`).join('')}</div>`:''}<ol class="scene-actions">${group.map(e=>`<li data-scene-preview="${esc(e.id)}"><button class="scene-action-title" aria-haspopup="dialog" aria-label="Переглянути дію: ${esc(e.title)}">${esc(e.title)}</button></li>`).join('')}</ol>`;
}
function showSceneCard(scene,group){
 cardSelection={kind:'scene',id:scene.id,events:group};setCardContent(`${cardTop(group[0].day,sceneNavigation(scene.id),'scene',scene.id)}${sceneCardBody(scene,group)}`);bindCard();
}
function eventGallery(e){
 const photos=(data.media||[]).filter(m=>m.event_id===e.id&&m.status==='published').sort((a,b)=>(a.order||0)-(b.order||0));
 return photos.length?`<div class="event-gallery">${photos.map(m=>`<figure><img src="${esc(m.src)}" alt="${esc(m.alt)}" loading="lazy" decoding="async" width="${Number(m.width)||640}" height="${Number(m.height)||360}"><figcaption>${esc(m.caption||m.alt)}<small>${esc(m.locator)}${m.coverage==='canonical_part'?' · Канонічна частина події':''}</small></figcaption></figure>`).join('')}</div>`:'';
}
function readScene(id,trigger){if(!sceneMap.has(id))return;pinOpenCard();uiTimers.cancel('node-open');HierarchyPreview.dismissTransient();tooltipController?.hide();cancelHoverClose();sceneId=id;sceneReturnFocus=trigger;renderScene();const dialog=$('sceneDialog');dialog.hidden=false;if(!dialog.open){if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');}syncReadingState();$('closeScene').focus();}
function closeScene(){const dialog=$('sceneDialog');if(dialog.hidden)return;if(dialog.close)dialog.close();else dialog.removeAttribute('open');dialog.hidden=true;sceneId=null;syncReadingState();sceneReturnFocus?.focus();sceneReturnFocus=null;}
function renderScene(){
 const scene=sceneMap.get(sceneId);if(!scene){closeScene();return;}const group=sceneEvents(sceneId),cast=sceneCast(scene,group);
 $('sceneTitle').textContent=scene.title;$('sceneMeta').textContent=`${dateText(scene.day,true)} · ${name(scene.location_id)} · ${actionCount(group.length)}`;
 $('sceneContent').innerHTML=`${cast.length?`<div class="people scene-cast">${cast.map(id=>`<button class="person" style="--person-color:${color(id)}" data-scene-focus-character="${esc(id)}" aria-label="Зосередитися на лінії ${esc(fullName(id))}" title="Зосередитися на лінії">${esc(fullName(id))}</button>`).join('')}</div>`:''}<ol class="scene-story">${group.map(e=>`<li data-scene-action="${esc(e.id)}">${eventGallery(e)}<h3><button data-scene-event="${esc(e.id)}">${esc(e.title)} <span aria-hidden="true">↗</span></button></h3><p>${esc(e.text)}</p></li>`).join('')}</ol>`;
 $('sceneContent').querySelectorAll('[data-scene-event]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.sceneEvent;closeScene();navigateEvent(id);}));
 $('sceneContent').querySelectorAll('[data-scene-focus-character]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.sceneFocusCharacter;closeScene();if(focusedCharacter!==id)setFocus(id);}));
}
function storyCardBody(point){
 const children=point.kind==='arc'
  ?(point.sourceEpisodeIds||[]).map(id=>{const episode=episodeMap.get(id);return episode?{id,title:episode.title}:null;}).filter(Boolean)
  :(point.sourceSceneIds||[]).map(id=>{const scene=sceneMap.get(id);return scene&&sceneEvents(id).length?{id,title:scene.title}:null;}).filter(Boolean);
 return `<h2>${esc(point.title)}</h2>${point.story?.description?`<p class="event-text">${esc(point.story.description)}</p>`:''}<p class="scene-location">${point.kind==='arc'?`${point.childCount} епізодів`:`${point.childCount} сцен`} · ${point.group.length} моментів</p><div class="story-children">${children.map(child=>`<button class="result" ${point.kind==='arc'?`data-story-episode="${esc(child.id)}"`:`data-story-scene="${esc(child.id)}"`}><strong>${esc(child.title)}</strong></button>`).join('')}</div>`;
}
function showStoryGroup(point){
 const days=point.group.map(e=>e.day).filter(Number.isFinite),start=days.length?Math.min(...days):null,end=days.length?Math.max(...days):null,range=start===null?'Без установленої дати':start===end?dateText(start,true):`${dateText(start,true)} — ${dateText(end,true)}`;
 cardSelection={kind:point.kind,id:point.rawId,events:point.group};
 setCardContent(`${storyPanelHeader(point.kind,range,start!==null,point.rawId)}${storyCardBody(point)}`);bindCard();
}
function eventSupplementHtml(e,relationAttribute){
 const scene=sceneMap.get(e.scene_id);
 const repo='https://github.com/DSMykyta/Konoha-Gaiden-Chronicles/blob/';
 const evidence=(e.evidence_ids||[]).map(id=>{const ev=evidenceMap.get(id),source=sourceMap.get(ev?.source_id);if(!ev)return `<p>${esc(id)}</p>`;const locator=typeof ev.locator==='string'?ev.locator:JSON.stringify(ev.locator||'');return `<div class="evidence">${source?.path?`<a href="${repo}${encodeURIComponent(source.revision||data.revision)}/${source.path.split('/').map(encodeURIComponent).join('/')}" target="_blank" rel="noopener">${esc(source.title)}</a>`:`<p>${esc(source?.title||id)}</p>`}<p>${esc(locator)}</p></div>`;}).join('');
 const rel=[...(scene.relations||[]),...data.links].filter(r=>(r.a===e.id||r.b===e.id)&&['before','meets','intersects','same_span','observes'].includes(r.kind));
 const relations=rel.map(r=>{const d=describeRelation(r,e.id),other=eventMap.get(d.otherId),sc=sceneMap.get(d.otherId);return `<div class="relation"><span>${esc(d.label)}:</span>${other?`<button class="text-button" ${relationAttribute}="${esc(other.id)}">${esc(other.title)}${r.review!=='accepted'?' · потребує перевірки':''}</button>`:`<span>${esc(sc?.title||d.otherId)}</span>`}</div>`;}).join('');
 const sceneCast=[...new Set((scene.presence||[]).map(p=>p.entity_id))];
 return `${relations?`<details class="disclosure"><summary>Часові зв’язки</summary>${relations}</details>`:''}<details class="disclosure"><summary>Сцена та присутність</summary><p>${esc(e.scene_title)} · ${esc(name(e.location_id))}</p>${sceneCast.length?`<p>Присутні в різні моменти сцени: ${sceneCast.map(id=>esc(name(id))).join(', ')}.</p>`:''}<p>Точна година не встановлена. Положення вузлів у межах дня показує порядок відображення, а не доведену одночасність.</p></details><details class="disclosure"><summary>Джерела</summary>${evidence||'<p>Джерела не позначено.</p>'}<a href="${repo}${data.revision}/${data.base}/scenes/${encodeURIComponent(e.file)}" target="_blank" rel="noopener">Запис сцени</a></details>`;
}
function eventDetailsHtml(e,relationAttribute='data-card-event',showDetails=false){
 const physical=e.involvement.filter(i=>e.physical.includes(i.entity_id)),special=e.involvement.filter(i=>modes[i.mode]),mentioned=e.involvement.filter(i=>i.role==='mentioned'||i.mode==='remote');
 return `${eventGallery(e)}<h2>${esc(e.title)}</h2><p class="event-text">${esc(e.text)}</p><div class="people">${physical.map(i=>`<button class="person" style="--person-color:${color(i.entity_id)}" data-event-focus-character="${esc(i.entity_id)}" aria-label="Зосередитися на лінії ${esc(name(i.entity_id))}" title="Зосередитися на лінії">${esc(name(i.entity_id))}</button>`).join('')}</div><p class="card-meta">${esc(origins[e.origin]||e.origin)}${e.date_status!=='established'&&e.day!==null?' · Робоча дата':''}${e.scene_state!=='active'?' · Чернетка':''}</p>${special.length?`<p class="card-meta">${special.map(i=>`${esc(name(i.entity_id))} (${modes[i.mode]})`).join(', ')}</p>`:''}${mentioned.length?`<p class="card-meta">Згадки / віддалена дія: ${mentioned.map(i=>esc(name(i.entity_id))).join(', ')}</p>`:''}${showDetails?eventSupplementHtml(e,relationAttribute):''}`;
}
function showEvent(e){
 cardSelection={kind:'moment',id:e.id,events:[e]};const navigation=nav();
 setCardContent(`${cardTop(e.day,navigation,'moment',e.id)}${eventDetailsHtml(e,'data-card-event')}`);
 bindCard();
}
function prepareNavigation(e){
 if(!e)return false;rememberCardFocus();uiTimers.cancel('node-open');hoveredNodeId=null;cancelHoverClose();HierarchyPreview.clear();hoverCard=false;
 if(!StoryTitleScale.allows(e))StoryTitleScale.clear();
 if(focusedCharacter&&!e.tracks.includes(focusedCharacter))focusedCharacter=null;
 continuity=e.continuity;$('continuity').value=continuity;if(!relevant(e))e.tracks.forEach(id=>selected.add(id));renderCharacters();closePanels();return true;
}
function navigateEvent(id){
 const e=eventMap.get(id);if(!prepareNavigation(e))return;
 if(e.day!==null){zoom=365;center=clampAxisCenter(dayToAxis(e.day+.5));}
 pinnedNodeId=e.id;focusId=e.id;anchorEvent=e.id;showEvent(e);$('eventCard').hidden=false;render();
 const anchor=graphNodes.find(p=>p.id===e.id);if(anchor)revealReadingNode();else positionCard({x:($('canvas').clientWidth||1000)/2,y:($('canvas').clientHeight||700)*.7});updateFocusBar();focusReadingCard();
}
function search(){
 const q=$('eventSearch').value.trim().toLowerCase(),found=orderedScenes().flatMap(s=>s.group).filter(e=>!q||(e.title+' '+e.text).toLowerCase().includes(q));
 $('searchSummary').textContent=q?`Знайдено: ${found.length}`:`${found.length} подій · у порядку хронології`;
 $('searchResults').innerHTML=found.slice(0,searchLimit).map(e=>`<button class="result" data-search-event="${esc(e.id)}"><span>${esc(e.title)}<span class="result-context">${esc(e.scene_title)}</span></span><small>${dateText(e.day)}</small></button>`).join('')||'<div class="empty"><p>Подій не знайдено. Спробуй коротший запит.</p><button class="secondary-button" data-reset-event-search>Очистити пошук</button></div>';
 $('searchResults').querySelectorAll('[data-search-event]').forEach(b=>b.addEventListener('click',()=>navigateEvent(b.dataset.searchEvent)));
 $('searchResults').querySelector('[data-reset-event-search]')?.addEventListener('click',()=>{$('eventSearch').value='';searchLimit=30;search();$('eventSearch').focus();});
 $('moreResults').hidden=found.length<=searchLimit;
}
function openProfile(id,trigger){if(!entityMap.has(id))return;uiTimers.cancel('node-open');HierarchyPreview.dismissTransient();if(hoverCard)closeCard();tooltipController?.hide();profileEntity=id;profileVersion=null;profileReturnFocus=trigger;renderProfile();const dialog=$('profileDialog');dialog.hidden=false;if(!dialog.open){if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');}syncReadingState();$('closeProfile').focus();}
function closeProfile(){const dialog=$('profileDialog');if(dialog.hidden)return;if(dialog.close)dialog.close();else dialog.removeAttribute('open');dialog.hidden=true;profileEntity=null;syncReadingState();profileReturnFocus?.focus();profileReturnFocus=null;}
function characterTimelineEvents(id){
 return orderedScenes().flatMap(s=>s.group).filter(e=>e.tracks.includes(id));
}
function openCharacterEvents(id,trigger){
 if(!entityMap.has(id))return;
 uiTimers.cancel('node-open');HierarchyPreview.dismissTransient();if(hoverCard)closeCard();tooltipController?.hide();
 characterEventsEntity=id;characterEventsReturnFocus=trigger;
 renderCharacterEvents();
 const dialog=$('characterEventsDialog'),track=$('characterEventsTrack');
 dialog.hidden=false;if(!dialog.open){if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');}
 syncReadingState();
 uiTimers.defer('character-reader-open',0,()=>{if(dialog.hidden||characterEventsEntity!==id)return;track.scrollLeft=0;updateCharacterReader();$('closeCharacterEvents').focus();});
}
function renderCharacterEvents(preservePosition=false){
 const id=characterEventsEntity,track=$('characterEventsTrack'),oldCard=preservePosition?track.querySelectorAll('.character-event-card')[Math.round(track.scrollLeft/characterReaderStep())]:null;
 const oldEvent=oldCard?.dataset.characterEvent,oldScroll=oldCard?.scrollTop||0;
 const list=characterTimelineEvents(id),dated=list.filter(e=>e.day!==null);
 $('characterEventsTitle').textContent=fullName(id);
 $('characterEventsMeta').textContent=`${list.length} подій${dated.length?` · ${dateText(dated[0].day)} — ${dateText(dated.at(-1).day)}`:''}`;
 track.innerHTML=list.length?list.map((e,index)=>`<article class="character-event-card" data-character-event="${esc(e.id)}"><div class="character-event-top"><span class="card-date">${esc(dateText(e.day,true))}${e.day!==null?' · Рік 0':''}</span><span class="character-event-index">${index+1} / ${list.length}</span></div>${eventDetailsHtml(e,'data-character-timeline-event',true)}</article>`).join(''):'<p class="empty">Подій персонажа не знайдено.</p>';
 track.querySelectorAll('[data-character-timeline-event]').forEach(b=>b.addEventListener('click',()=>{closeCharacterEvents();closeProfile();navigateEvent(b.dataset.characterTimelineEvent);}));
 track.querySelectorAll('[data-event-focus-character]').forEach(b=>b.addEventListener('click',()=>{const target=b.dataset.eventFocusCharacter;closeCharacterEvents();closeProfile();if(focusedCharacter!==target)setFocus(target);}));
 if(preservePosition){const cards=[...track.querySelectorAll('.character-event-card')],index=Math.max(0,cards.findIndex(card=>card.dataset.characterEvent===oldEvent));track.scrollLeft=index*characterReaderStep();if(cards[index])cards[index].scrollTop=oldScroll;updateCharacterReader();}
}
function characterReaderStep(){
 const track=$('characterEventsTrack'),card=track.querySelector('.character-event-card');
 if(!card)return 1;
 return card.getBoundingClientRect().width+(parseFloat(getComputedStyle(track).columnGap)||0);
}
function updateCharacterReader(){
 const track=$('characterEventsTrack'),total=track.querySelectorAll('.character-event-card').length,index=Math.min(Math.max(0,total-1),Math.round(track.scrollLeft/characterReaderStep()));
 $('characterEventPosition').textContent=total?`${index+1} / ${total}`:'0 / 0';
 $('characterEventPrevious').disabled=index===0;$('characterEventNext').disabled=index>=total-1;
}
function moveCharacterReader(direction){
 const track=$('characterEventsTrack'),step=characterReaderStep(),index=Math.round(track.scrollLeft/step);
 track.scrollTo({left:(index+direction)*step,behavior:'instant'});
 updateCharacterReader();
}
function closeCharacterEvents(){
 uiTimers.cancel('character-reader-open');
 const dialog=$('characterEventsDialog');if(dialog.hidden)return;
 if(dialog.close)dialog.close();else dialog.removeAttribute('open');
 dialog.hidden=true;characterEventsEntity=null;syncReadingState();const target=characterEventsReturnFocus;characterEventsReturnFocus=null;target?.focus();
}
function mergedProfileVersion(versions,index){
 const mergeKeyed=(base,delta,key)=>{
  if(delta===undefined)return base||[];
  const out=[...(base||[])],positions=new Map(out.map((item,i)=>[key(item),i]));
  for(const item of delta||[]){const k=key(item);if(positions.has(k)&&item&&typeof item==='object'&&!Array.isArray(item)){const i=positions.get(k);out[i]={...out[i],...item};}else if(!positions.has(k)){positions.set(k,out.length);out.push(item);}}
  return out;
 };
 let merged={};
 for(let i=0;i<=index;i++){
  const v=versions[i]||{};
  merged={
   ...merged,...v,
   appearance:v.appearance===undefined?merged.appearance:{...(merged.appearance||{}),...(v.appearance||{})},
   facts:mergeKeyed(merged.facts,v.facts,item=>item?.key||item?.label||''),
   abilities:mergeKeyed(merged.abilities,v.abilities,item=>item?.name||item?.label||''),
   relationships:mergeKeyed(merged.relationships,v.relationships,item=>item?.entity_id||item?.name||item?.label||''),
   sections:mergeKeyed(merged.sections,v.sections,item=>item?.title||''),
   traits:v.traits===undefined?merged.traits:v.traits,
   goals:v.goals===undefined?merged.goals:v.goals,
   equipment:v.equipment===undefined?merged.equipment:v.equipment
  };
 }
 return merged;
}
function renderProfile(){
 const entity=entityMap.get(profileEntity);if(!entity){closeProfile();return;}const profile=profileMap.get(profileEntity),versions=profile?.versions?.length?profile.versions:[{id:'general',label:'Профіль'}];if(!versions.some(v=>v.id===profileVersion))profileVersion=versions[0].id;
 const versionIndex=versions.findIndex(v=>v.id===profileVersion),version=mergedProfileVersion(versions,versionIndex),associated=TimelineCore.ordered(events().filter(e=>e.tracks.includes(profileEntity))),dated=associated.filter(e=>e.day!==null),memberships=(data.memberships||[]).filter(m=>m.entity_id===profileEntity||m.person_id===profileEntity||m.member_id===profileEntity);
 $('profileTitle').textContent=fullName(profileEntity);$('profileTabs').innerHTML=versions.map(v=>`<button id="tab-${esc(v.id)}" role="tab" aria-selected="${v.id===profileVersion}" aria-controls="profileContent" tabindex="${v.id===profileVersion?0:-1}" data-profile-version="${esc(v.id)}">${esc(v.label)}</button>`).join('');$('profileContent').setAttribute('aria-labelledby','tab-'+version.id);
 const paragraphs=text=>String(text||'').split(/\n\s*\n/).filter(Boolean).map(p=>`<p>${esc(p)}</p>`).join('');
 const listSection=(title,items)=>items?.length?`<section class="profile-section"><h3>${esc(title)}</h3><ul class="profile-list">${items.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></section>`:'';
 const appearanceLabels={hair:'Волосся',eyes:'Очі',features:'Особливості',clothing:'Одяг'};
 const appearance=version.appearance&&Object.keys(version.appearance).length?`<section class="profile-section"><h3>Зовнішність</h3><dl class="profile-facts profile-compact-facts">${Object.entries(version.appearance).map(([key,value])=>`<div><dt>${esc(appearanceLabels[key]||key)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl></section>`:'';
 const abilities=(version.abilities||[]).length?`<section class="profile-section"><h3>Здібності</h3><div class="profile-entry-list">${version.abilities.map(item=>`<div class="profile-entry"><strong>${esc(item.name||item.label||'')}</strong>${item.status?`<span>${esc(item.status)}</span>`:''}</div>`).join('')}</div></section>`:'';
 const relationships=(version.relationships||[]).length?`<section class="profile-section"><h3>Стосунки</h3><div class="profile-entry-list">${version.relationships.map(item=>`<div class="profile-entry profile-relationship"><strong>${esc(item.entity_id?name(item.entity_id):(item.name||''))}</strong>${item.label?`<span>${esc(item.label)}</span>`:''}</div>`).join('')}</div></section>`:'';
 const hasProfileData=version.summary||(version.facts||[]).length||version.appearance||(version.traits||[]).length||(version.goals||[]).length||(version.abilities||[]).length||(version.relationships||[]).length||(version.equipment||[]).length||(version.sections||[]).length;
 const portrait=version.image?`<img class="profile-image" src="${esc(version.image)}" alt="${esc(version.image_alt||fullName(profileEntity))}" loading="lazy">`:`<div class="profile-image profile-image-empty" role="img" aria-label="Фото для ${esc(version.label)} ще не додано"><span>Фото</span><small>${esc(version.label)}</small></div>`;
 const info=`${version.summary?`<section class="profile-summary">${paragraphs(version.summary)}</section>`:!hasProfileData?'<p class="empty">Профіль цього віку ще не заповнений.</p>':''}${(version.facts||[]).length?`<dl class="profile-facts">${version.facts.map(f=>`<div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join('')}</dl>`:''}${appearance}${listSection('Риси характеру',version.traits)}${listSection('Цілі',version.goals)}${abilities}${relationships}${listSection('Спорядження',version.equipment)}${(version.sections||[]).map(section=>`<section class="profile-section"><h3>${esc(section.title)}</h3>${paragraphs(section.text)}</section>`).join('')}<section class="profile-section profile-chronology"><h3>У хронології</h3>${memberships.length?`<p>${memberships.map(m=>esc(name(m.team_id||m.group_id))).join(', ')}</p>`:''}<div class="profile-actions"><button id="followCharacter" class="profile-follow">Зосередитися на лінії</button><button id="openCharacterEvents" class="profile-follow profile-timeline-button">${associated.length} подій</button></div></section>`;
 $('profileContent').innerHTML=`<div class="profile-layout"><aside class="profile-visual">${portrait}<p class="profile-age">${esc(version.label||(version.age!==undefined?version.age+' років':'Профіль'))}</p></aside><div class="profile-details">${info}</div></div>`;
 $('profileTabs').querySelectorAll('[data-profile-version]').forEach((b,i)=>{b.addEventListener('click',()=>{profileVersion=b.dataset.profileVersion;renderProfile();$('profileTabs').querySelector('[aria-selected="true"]').focus();});b.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const index=e.key==='Home'?0:e.key==='End'?versions.length-1:(i+(e.key==='ArrowRight'?1:-1)+versions.length)%versions.length;profileVersion=versions[index].id;renderProfile();$('profileTabs').querySelector('[aria-selected="true"]').focus();});});
 $('openCharacterEvents').addEventListener('click',e=>openCharacterEvents(profileEntity,e.currentTarget));
 $('followCharacter').addEventListener('click',()=>{const id=profileEntity;closeProfile();if(focusedCharacter===id){closePanels();render();}else setFocus(id);});
 ProfileTechniques.decorate();
}
function ingest(next,initial=false){
 const calendarCenter=data?axisToDay(center):center,wasAll=data&&selectable().every(e=>selected.has(e.id));
 data=next;entityMap=new Map(data.entities.map(e=>[e.id,e]));eventMap=new Map(data.events.map(e=>[e.id,e]));sceneMap=new Map(data.scenes.map(s=>[s.id,s]));episodeMap=new Map((data.episodes||[]).map(e=>[e.id,e]));arcMap=new Map((data.arcs||[]).map(a=>[a.id,a]));evidenceMap=new Map(data.sources.evidence.map(e=>[e.id,e]));sourceMap=new Map(data.sources.sources.map(s=>[s.id,s]));profileMap=new Map((data.profiles||[]).map(p=>[p.entity_id,p]));
 if(initial||wasAll)selected=new Set(selectable().map(e=>e.id));else selected=new Set([...selected].filter(id=>entityMap.has(id)));if(focusedCharacter&&!entityMap.has(focusedCharacter))focusedCharacter=null;if(anchorEvent&&!eventMap.has(anchorEvent))closeCard();
 center=clampAxisCenter(dayToAxis(calendarCenter));
 $('revision').textContent=`Дані: ${data.revision.slice(0,8)}`;$('sourceLink').href=`https://github.com/DSMykyta/Konoha-Gaiden-Chronicles/tree/${data.revision}/${data.base}`;
}
let refreshing=false;
function refreshOpenCard(){
 if($('eventCard').hidden||!cardSelection)return;
 const {kind,id}=cardSelection;
 if(kind==='moment'){const event=events().find(event=>event.id===id);if(event)showEvent(event);else closeCard();return;}
 const scene=kind==='scene'?sceneMap.get(id):null,group=scene?sceneEvents(scene.id):[];
 if(scene&&group.length){showSceneCard(scene,group);return;}
 const point=kind==='arc'||kind==='episode'?storyPoint(kind,id):null;
 if(point)showStoryGroup(point);else closeCard();
}
async function refreshData(){
 if(refreshing||document.visibilityState==='hidden'||window.__TIMELINE_DATA__)return;refreshing=true;
 try{
  const v=await fetch(`version.json?t=${Date.now()}`,{cache:'no-store'});if(!v.ok)return;
  const version=await v.json();if(version.revision===data.revision)return;
  const response=await fetch(`data.json?v=${encodeURIComponent(version.revision)}`,{cache:'no-store'});if(!response.ok)return;
  ingest(await response.json());renderCharacters();search();refreshOpenCard();
  if(profileEntity)renderProfile();if(sceneId)renderScene();
  if(characterEventsEntity){if(entityMap.has(characterEventsEntity))renderCharacterEvents(true);else closeCharacterEvents();}
  render();
 }catch{}finally{refreshing=false;}
}
function ensureInterface(){
 const required=['canvas','timeline','storyClouds','periodLabel','emptyAction','searchSummary','characterEventPrevious','characterEventNext','characterEventPosition','cardHeader','cardScroll'];
 if(required.every(id=>$(id)))return true;
 if(window.location.href&&window.location.protocol!=='file:'&&window.location.replace){
  const url=new URL(window.location.href);
  if(url.searchParams.get('_ui')!==UI_VERSION){url.searchParams.set('_ui',UI_VERSION);window.location.replace(url.href);return false;}
 }
 throw new Error('Сторінка і скрипти мають різні версії. Онови репозиторій і перезавантаж сторінку через Ctrl + F5.');
}
async function init(){
 try{if(!ensureInterface())return;const response=window.__TIMELINE_DATA__?{ok:true,json:async()=>window.__TIMELINE_DATA__}:await fetch(`data.json?t=${Date.now()}`,{cache:'no-store'});if(!response.ok)throw new Error('Не вдалося завантажити хронологію.');if(($('canvas').clientWidth||window.innerWidth||1000)<600||($('canvas').clientHeight||window.innerHeight||700)<520)zoom=zoomModes.week;ingest(await response.json(),true);$('status').hidden=true;
 const names={'alt-shippuden-469':'Альтернатива · обличчя Какаші','alt-movie-land-of-snow':'Альтернатива · Країна Снігу'};[...new Set(data.events.map(e=>e.continuity))].filter(c=>c!=='main').forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=names[c]||c;$('continuity').append(o);});
 for(const id of ['lines','search','period'])$(id+'Button').addEventListener('click',()=>{togglePanel(id+'Panel');if(id==='search')search();});document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>{closePanels();}));
 for(const id of ['linesPanel','searchPanel','periodPanel'])$(id).addEventListener('toggle',e=>{
  if(e.newState==='closed'&&!$(id).matches?.(':popover-open')){$(id).hidden=true;$(id.replace('Panel','Button')).setAttribute('aria-expanded','false');}
 });
 $('emptyAction').addEventListener('click',()=>{
  if(!selected.size){selected=new Set(selectable().map(e=>e.id));selectionChanged();return;}
  const nearest=navigationEvents().filter(e=>e.day!==null).sort((a,b)=>Math.abs(dayToAxis(a.day)-center)-Math.abs(dayToAxis(b.day)-center))[0];
  if(nearest)navigateEvent(nearest.id);
 });
 $('characterSearch').addEventListener('input',renderCharacters);$('selectAll').addEventListener('click',()=>{selected=new Set(selectable().map(e=>e.id));selectionChanged();});$('deselectAll').addEventListener('click',()=>{selected.clear();selectionChanged();});document.querySelectorAll('[data-team]').forEach(b=>b.addEventListener('click',()=>{selected=new Set(teams[b.dataset.team]);focusedCharacter=null;selectionChanged();}));
 $('eventSearch').addEventListener('input',()=>{searchLimit=30;search();});$('moreResults').addEventListener('click',()=>{searchLimit+=30;search();});
 $('continuity').addEventListener('change',()=>{const calendarCenter=axisToDay(center);continuity=$('continuity').value;center=clampAxisCenter(dayToAxis(calendarCenter));focusedCharacter=null;selected=new Set(selectable().map(e=>e.id));selectionChanged();search();});
 $('closeCharacterEvents').addEventListener('click',closeCharacterEvents);
 $('characterEventsDialog').addEventListener('cancel',e=>{e.preventDefault();closeCharacterEvents();});
 $('characterEventPrevious').addEventListener('click',()=>moveCharacterReader(-1));
 $('characterEventNext').addEventListener('click',()=>moveCharacterReader(1));
 $('characterEventsTrack').addEventListener('scroll',updateCharacterReader,{passive:true});
 $('dateForm').addEventListener('submit',e=>{e.preventDefault();const m=$('dateInput').value.trim().match(/^(\d{1,2})[./](\d{1,2})$/);if(!m||+m[2]<1||+m[2]>12||+m[1]<1||+m[1]>lengths[+m[2]-1]){$('dateError').textContent='Введи дійсну дату у форматі 22.01.';$('dateError').hidden=false;$('dateInput').setAttribute('aria-invalid','true');return;}$('dateError').hidden=true;$('dateInput').removeAttribute('aria-invalid');zoom=365;center=clampAxisCenter(dayToAxis(starts[+m[2]-1]+(+m[1]-1)+.5));closePanels();closeCard();schedule();});
 document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setZoom(zoomModes[b.dataset.mode])));$('zoomIn').addEventListener('click',()=>setZoom(zoom*2));$('zoomOut').addEventListener('click',()=>setZoom(zoom/2));$('fit').addEventListener('click',()=>setZoom(zoomModes.year));
 for(const [id,s] of [['previous',-1],['next',1]])$(id).addEventListener('click',()=>{closeCard();const mode=currentZoomMode(),preset=zoomModes[mode],isPreset=Math.abs(Math.log(zoom/preset))<.03,step=isPreset?365/preset:365/zoom*.7;center=clampAxisCenter(center+s*step);schedule();});
 document.addEventListener('keydown',e=>{
  document.documentElement.dataset.input='keyboard';
  if(e.key==='Escape'){
   uiTimers.cancel('node-open');hoveredNodeId=null;tooltipController?.hide();
   if(!$('sceneDialog').hidden){e.preventDefault();closeScene();return;}
   if(!$('characterEventsDialog').hidden){e.preventDefault();closeCharacterEvents();return;}
   if(!$('profileDialog').hidden){e.preventDefault();closeProfile();return;}
   if(HierarchyPreview.escape()){e.preventDefault();return;}
   const openPanel=['linesPanel','searchPanel','periodPanel'].find(id=>!$(id).hidden);
   if(openPanel){e.preventDefault();closePanels();$(openPanel.replace('Panel','Button')).focus();return;}
   if(!$('eventCard').hidden){closeCard(true);return;}
   if(StoryTitleScale.escape()){e.preventDefault();return;}
   if(focusedCharacter){setFocus(focusedCharacter);}
  }
  if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.target.closest('input,textarea,select,[contenteditable="true"]')&&document.querySelector('dialog[open]')===null){e.preventDefault();if($('searchPanel').hidden)togglePanel('searchPanel');$('eventSearch').focus();search();}
 });
 document.addEventListener('pointerdown',e=>{
  document.documentElement.dataset.input='pointer';uiTimers.cancel('node-open');hoveredNodeId=null;
  if(!e.target.closest('.panel,.tools,.period,.scene-dialog'))closePanels();
  if(!e.target.closest('.event-card,.event-preview,.node,.node-hit,.thread-hit,.line-label,.focus-bar,.profile-dialog,.character-events-dialog,.scene-dialog,.time-controls,.panel,.tools,.period'))closeCard();
 });
 tooltipController=TimelineInteractions.tooltips(document,uiTimers);SelectionFocus.bind();
 $('cardContent').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-close-card'))closeCard(true);
  else if(b.dataset.parentKind){if(b.dataset.parentKind==='scene')navigateScene(b.dataset.parentId);else navigateStory(b.dataset.parentKind,b.dataset.parentId);}
  else if(b.dataset.stepEvent)stepEvent(+b.dataset.stepEvent);
  else if(b.dataset.stepScene)stepScene(+b.dataset.stepScene);
  else if(b.dataset.eventFocusCharacter){if(focusedCharacter!==b.dataset.eventFocusCharacter)setFocus(b.dataset.eventFocusCharacter);}
  else if(b.dataset.cardEvent)navigateEvent(b.dataset.cardEvent);
 });
 const canvas=$('timeline'),touches=new Map();let drag=null,pinch=null;
 canvas.addEventListener('pointerover',nodeHover);canvas.addEventListener('pointerout',nodeLeave);
 canvas.addEventListener('click',e=>{const target=e.target.closest('.node,.node-hit');if(target)openNode(graphNodes.find(p=>p.id===(target.dataset.event||target.dataset.nodeId)),true);});
 canvas.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const target=e.target.closest('.node');if(target){e.preventDefault();openNode(graphNodes.find(p=>p.id===target.dataset.event),true);}});
 canvas.addEventListener('wheel',e=>{e.preventDefault();const box=canvas.getBoundingClientRect(),pad=box.width<600?22:48,t=clamp((e.clientX-box.left-pad)/(box.width-pad*2),0,1),[lo,hi]=range();setZoom(zoom*Math.exp(-clamp(e.deltaY,-100,100)*.007),lo+t*(hi-lo));},{passive:false});
 canvas.addEventListener('pointerdown',e=>{if(e.target.closest('.node,.node-hit,.thread-hit,.line-label'))return;touches.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);if(touches.size===1){drag={x:e.clientX,y:e.clientY,center,scroll:$('canvas').scrollTop};canvas.classList.add('dragging');}else if(touches.size===2){const a=[...touches.values()];pinch={distance:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),zoom};drag=null;}});
 canvas.addEventListener('pointermove',e=>{if(!touches.has(e.pointerId))return;touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pinch&&touches.size===2){const a=[...touches.values()];setZoom(pinch.zoom*Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)/Math.max(1,pinch.distance));}else if(drag){$('canvas').scrollTop=drag.scroll-(e.clientY-drag.y);const pad=canvas.clientWidth<600?22:48;center=clampAxisCenter(drag.center-(e.clientX-drag.x)/Math.max(1,canvas.clientWidth-pad*2)*365/zoom);schedule();}});
 const end=e=>{touches.delete(e.pointerId);drag=null;pinch=null;canvas.classList.remove('dragging');};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);new ResizeObserver(schedule).observe($('canvas'));
 $('canvas').addEventListener('scroll',()=>{tooltipController?.hide();cloudRenderer?.scroll($('canvas').scrollTop);const p=graphNodes.find(p=>p.id===focusId);if(p&&!$('eventCard').hidden)positionCard(p);},{passive:true});
 $('focusPrevious').addEventListener('click',()=>stepEvent(-1));$('focusNext').addEventListener('click',()=>stepEvent(1));$('focusName').addEventListener('click',()=>openProfile(focusedCharacter,$('focusName')));$('clearFocus').addEventListener('click',()=>setFocus(focusedCharacter));
 $('eventCard').addEventListener('pointerenter',HierarchyPreview.keep);$('eventCard').addEventListener('pointerleave',e=>HierarchyPreview.leave(e,0));
 const dismissTransient=()=>{uiTimers.cancel('node-open');hoveredNodeId=null;tooltipController?.hide();HierarchyPreview.dismissTransient();StoryTitleScale.dismissTransient();if(hoverCard)closeCard();};
 window.addEventListener('blur',dismissTransient);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')dismissTransient();});
 $('closeScene').addEventListener('click',closeScene);$('sceneDialog').addEventListener('cancel',e=>{e.preventDefault();closeScene();});
 $('closeProfile').addEventListener('click',closeProfile);$('profileDialog').addEventListener('cancel',e=>{e.preventDefault();closeProfile();});$('profileDialog').addEventListener('click',e=>{if(e.target===$('profileDialog')){const b=$('profileDialog').getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)closeProfile();}});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='hidden')refreshData();});window.addEventListener('focus',refreshData);setInterval(refreshData,60000);
 renderCharacters();render();const params=new URLSearchParams(window.location.search);if(entityMap.has(params.get('character')))setFocus(params.get('character'));if(eventMap.has(params.get('event')))navigateEvent(params.get('event'));
 }catch(e){if($('status'))$('status').hidden=true;if($('error')){$('error').textContent=e.message;$('error').hidden=false;}console.error(e);}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
