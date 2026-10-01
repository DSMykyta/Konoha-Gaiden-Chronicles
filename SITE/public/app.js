'use strict';
const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
const UI_VERSION='20261001-glass-1';
const months=['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'],gen=['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];
const lengths=[31,28,31,30,31,30,31,31,30,31,30,31],starts=lengths.map((_,i)=>lengths.slice(0,i).reduce((a,b)=>a+b,0));
const palette=['#3f80cf','#cb833e','#7462bc','#ba6487','#358b96','#7d9953','#b89442','#6687b5','#ab7cba','#67877d','#b97a73','#8b91a1'];
const defaults=['c-naruto','c-sasuke','c-sakura','c-kita','c-ren','c-sora'],teams={'team-7':['c-naruto','c-sasuke','c-sakura','c-kakashi'],'team-8':['c-hinata','c-kiba','c-shino','c-kurenai'],'team-9':['c-kita','c-ren','c-sora','c-raido']};
const origins={M:'Манґа',A:'Аніме',F:'Філер',P:'Історія проєкту',R:'Ретроспектива',V:'Фільм',N:'Новела',G:'Гра',O:'Інше'},modes={internal:'внутрішній простір',memory:'спогад',manifested:'проявлення',reanimated:'Едо Тенсей'};
const zoomModes={year:1,month:12,week:365/7,day:365};
function currentZoomMode(){return Object.entries(zoomModes).reduce((best,[mode,value])=>Math.abs(Math.log(zoom/value))<best.distance?{mode,distance:Math.abs(Math.log(zoom/value))}:best,{mode:'year',distance:Infinity}).mode;}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
let data,entityMap,eventMap,sceneMap,episodeMap,arcMap,evidenceMap,sourceMap,profileMap,selected=new Set(),focusedCharacter=null,profileEntity=null,profileVersion=null,profileReturnFocus=null,characterEventsEntity=null,characterEventsReturnFocus=null,sceneId=null,sceneReturnFocus=null,zoom=12,center=21.5,continuity='main',focusId=null,anchorDay=null,anchorEvent=null,graphNodes=[],raf=null,searchLimit=30;
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
function navigationEvents(){return events().filter(e=>focusedCharacter?e.tracks.includes(focusedCharacter):relevant(e));}
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
function nav(){const list=orderedScenes().flatMap(s=>s.group).filter(e=>e.day!==null&&(focusedCharacter?e.tracks.includes(focusedCharacter):relevant(e))),i=list.findIndex(e=>e.id===anchorEvent),currentDay=axisToDay(center),next=list.findIndex(e=>e.day>=Math.floor(currentDay));return {previous:i>=0?list[i-1]||null:next<0?list.at(-1)||null:list[next-1]||null,next:i>=0?list[i+1]||null:next<0?null:list[next],index:i,total:list.length};}
function stepEvent(direction){const target=nav()[direction<0?'previous':'next'];if(target)navigateEvent(target.id);}
function setFocus(id){focusedCharacter=focusedCharacter===id?null:id;if(focusedCharacter)selected.add(id);closeCard();closePanels();$('canvas').scrollTop=0;renderCharacters();render();}
function updateFocusBar(){const bar=$('focusBar');bar.hidden=!focusedCharacter;if(!focusedCharacter)return;const n=nav();$('focusName').textContent=fullName(focusedCharacter);$('focusPosition').textContent=n.index>=0?`${n.index+1} / ${n.total}`:`${n.total} подій`;$('focusPrevious').disabled=!n.previous;$('focusNext').disabled=!n.next;}
function selectionChanged(){if(focusedCharacter&&!selected.has(focusedCharacter))focusedCharacter=null;closeCard();renderCharacters();render();}
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
let hoverCloseTimer=null,hoverCard=false,pinnedNodeId=null,cardReturnFocus=null,readingScrollTop=null,graphClouds=[],cloudRenderer=null;
let previewEventId=null,previewPinned=false,previewCloseTimer=null;
function cancelHoverClose(){clearTimeout(hoverCloseTimer);hoverCloseTimer=null;}
function deferHoverClose(){cancelHoverClose();if(hoverCard&&!pinnedNodeId)hoverCloseTimer=setTimeout(()=>{if(hoverCard&&!pinnedNodeId)closeCard();},320);}
function canHover(e){return e.pointerType!=='touch'&&(!window.matchMedia||window.matchMedia('(any-hover: hover)').matches);}
function paintNodes(){const p=graphNodes.find(p=>p.id===focusId);document.querySelectorAll('.node').forEach(g=>{const active=g.dataset.event===focusId;g.classList.toggle('is-open',active);g.classList.toggle('is-pinned',g.dataset.event===pinnedNodeId);});document.querySelectorAll('.node-hit').forEach(hit=>hit.classList.toggle('is-pinned',hit.dataset.nodeId===pinnedNodeId));document.querySelectorAll('.thread').forEach(line=>{const member=!!p&&p.cast.includes(line.dataset.character);line.classList.toggle('is-scene-member',member);line.classList.toggle('is-scene-muted',!!p&&!member);});}
function openNode(p,pin=false){
 cancelHoverClose();
 if(!pin){
  const canvas=$('canvas'),w=canvas.clientWidth||1000,h=canvas.clientHeight||700;
  const headerBottom=document.querySelector('.masthead')?.getBoundingClientRect?.().bottom||(w<760?112:86);
  // A hover card must leave its trigger visible and clickable. Compact windows
  // use explicit activation because the reading surface docks over the graph.
  if(pinnedNodeId||w<760||h<520||p.y-canvas.scrollTop-18-headerBottom-12<180)return;
 }
 if(pin){if(readingScrollTop===null)readingScrollTop=$('canvas').scrollTop;rememberCardFocus();pinnedNodeId=p.id;}
 if(focusId===p.id&&!$('eventCard').hidden){hoverCard=!pin;if(pin){render();revealReadingNode();focusReadingCard();}paintNodes();return;}
 closePanels();hoverCard=!pin;focusId=p.id;anchorDay=p.day;anchorEvent=p.kind==='moment'?p.group[0]?.id:null;
 if(p.kind==='moment')showEvent(p.group[0]);else if(p.kind==='scene')showSceneCard(p.scene,p.group);else showStoryGroup(p);
 $('eventCard').hidden=false;if(pin){render();revealReadingNode();}else positionCard(p);$('hoverTip').hidden=true;paintNodes();updateFocusBar();if(pin)focusReadingCard();
}
function headerBottom(){return document.querySelector('.masthead')?.getBoundingClientRect?.().bottom||(($('canvas').clientWidth||1000)<480?144:($('canvas').clientWidth||1000)<=1240?118:64);}
function readingBounds(){const viewport=$('canvas').clientHeight||700,top=headerBottom()+(focusedCharacter?96:44);return {top,height:Math.max(120,Math.min(580,viewport-top-100))};}
function showCloudCaptions(){
 const canvas=$('canvas'),reading=!!pinnedNodeId&&!$('eventCard').hidden,bounds=readingBounds(),top=canvas.scrollTop+(reading?bounds.top+bounds.height+12:headerBottom()+36),bottom=canvas.scrollTop+(canvas.clientHeight||700)-52;
 document.querySelectorAll('.cloud-label').forEach(label=>{const y=Number(label.dataset.captionY),height=Number(label.dataset.captionHeight);label.style.visibility=y<top||y+height>bottom?'hidden':'visible';});
}
function revealReadingNode(){const p=graphNodes.find(n=>n.id===focusId);if(!p)return;const canvas=$('canvas'),target=(canvas.clientHeight||700)-64;canvas.scrollTop=Math.max(0,p.y-target);positionCard(p);}
function setCardContent(html){
 $('eventCard').hidden=false;const container=$('cardContent');container.innerHTML=html;
 const top=container.querySelector('.card-top'),header=document.createElement('div'),scroll=document.createElement('div');header.id='cardHeader';scroll.id='cardScroll';if(top)header.append(top);while(container.firstChild)scroll.append(container.firstChild);container.replaceChildren(header,scroll);
}
function rememberCardFocus(){
 const active=document.activeElement;
 if(!active||$('eventCard').contains(active))return;
 const panel=active.closest('.panel');cardReturnFocus=panel?$(panel.id.replace('Panel','Button')):active;
}
function focusReadingCard(){
 if(document.documentElement.dataset.input==='keyboard')$('cardContent').querySelector('.card-top button:not(:disabled)')?.focus();
}
function closeCard(restoreFocus=false){
 const wasReading=readingScrollTop!==null;
 cancelHoverClose();closeEventPreview(true);hoverCard=false;pinnedNodeId=null;focusId=null;anchorDay=null;anchorEvent=null;$('eventCard').hidden=true;$('hoverTip').hidden=true;paintNodes();updateFocusBar();
 if(restoreFocus){
  const id=cardReturnFocus?.dataset?.event,target=id?[...document.querySelectorAll('.node')].find(n=>n.dataset.event===id):cardReturnFocus;
  if(target?.isConnected)target.focus();
 }
 cardReturnFocus=null;
 if(wasReading){$('canvas').scrollTop=readingScrollTop;readingScrollTop=null;schedule();}
}
function setZoom(value,pivot=center){const old=zoom;zoom=clamp(value,1,730);center=pivot+(center-pivot)*old/zoom;center=clampAxisCenter(center);$('hoverTip').hidden=true;schedule();}
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
}
// Cubic Hermite interpolation produces C1-continuous Bézier paths; event anchors are exact.
function smoothPath(points){
 if(points.length<2)return '';const slopes=points.map((p,i)=>{if(p.node||p.flat)return 0;const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];return b.x===a.x?0:(b.y-a.y)/(b.x-a.x);});
 let d=`M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],h=(b.x-a.x)/3;d+=` C${(a.x+h).toFixed(2)},${(a.y+slopes[i-1]*h).toFixed(2)} ${(b.x-h).toFixed(2)},${(b.y-slopes[i]*h).toFixed(2)} ${b.x.toFixed(2)},${b.y.toFixed(2)}`;}
 return d;
}
function render(){
 if(!data)return;
 const canvas=$('canvas'),timeline=$('timeline'),axis=$('timeAxis'),w=canvas.clientWidth||timeline.clientWidth||1000,viewport=canvas.clientHeight||700,pad=w<600?22:48,[lo,hi]=range(),plot=w-2*pad;
 const chrome=headerBottom();document.documentElement.style.setProperty('--legend-top',(chrome+4)+'px');document.documentElement.style.setProperty('--panel-top',(chrome+12)+'px');document.documentElement.style.setProperty('--focus-top',(chrome+44)+'px');
 const allEvents=datedEvents(),ids=[...selected].sort((a,b)=>(defaults.indexOf(a)>=0?defaults.indexOf(a):99)-(defaults.indexOf(b)>=0?defaults.indexOf(b):99)||fullName(a).localeCompare(fullName(b),'uk'));
 let h=viewport;
 const n=ids.length,overview=zoom<3,mid=viewport*(viewport<520?.5:.59),amplitude=clamp((viewport-220)*.25,24,150)*(overview?.08:1),level=semanticLevel();
 axis.style.width=w+'px';axis.setAttribute('viewBox',`0 0 ${w} 40`);
 const timeScale=makeTimeScale(lo,hi,pad,plot,allEvents),px=timeScale.px,pxAxis=timeScale.axisPx,loDay=axisToDay(lo,'before',allEvents),hiDay=axisToDay(hi,'after',allEvents),allScenes=orderedScenes().filter(s=>s.day!==null);
 const baseNodes=semanticNodes(level,allScenes).filter(p=>p.day!==null).map(p=>({...p,x:px(p.day)})),owner=semanticOwner(baseNodes),layoutKey=`${level}:${viewport}:${w}:${zoom}:${amplitude}`;
 if(!layoutCache.has(layoutKey)){
  if(layoutCache.size>=8)layoutCache.clear();
  const baseKey=`${level}:${viewport}:${amplitude}`;
  if(!baseLayoutCache.has(baseKey)){
   if(baseLayoutCache.size>=8)baseLayoutCache.clear();
   baseLayoutCache.set(baseKey,TimelineCore.sceneLayout(baseNodes,chronologyRelations(),owner,mid,amplitude));
  }
  const baseY=baseLayoutCache.get(baseKey),top=viewport<520?104:w<760?180:166,bottom=Math.max(top+80,viewport-156);
  const separated=TimelineCore.separateNodes(baseNodes.map(p=>({...p,x:dayToAxis(p.day,allEvents)*plot/(hi-lo),y:baseY.get(p.id)??mid})),top,bottom);
  layoutCache.set(layoutKey,new Map(separated.map(p=>[p.id,p.y])));
 }
 const nodeY=layoutCache.get(layoutKey);
 let globalNodes=baseNodes.map(p=>({...p,y:nodeY.get(p.id)??mid}));
 const linked=(p,id)=>p.cast.includes(id)||(id===focusedCharacter&&p.group.some(e=>e.tracks.includes(id)));
 graphNodes=globalNodes.filter(p=>{const a=dayToAxis(p.day,allEvents);return a>=lo&&a<hi&&p.group.some(e=>focusedCharacter?e.tracks.includes(focusedCharacter):relevant(e));});
 const reading=!!pinnedNodeId&&!$('eventCard').hidden,bounds=readingBounds(),readingTop=bounds.top+bounds.height+36;
 if(reading&&graphNodes.length){
  const offset=Math.max(0,readingTop-Math.min(...graphNodes.map(p=>p.y)));
  globalNodes=globalNodes.map(p=>({...p,y:p.y+offset}));graphNodes=graphNodes.map(p=>({...p,y:p.y+offset}));
 }
 graphClouds=StoryClouds.groups(graphNodes,level,sceneMap,episodeMap);
 const cloudLabels=StoryClouds.labels(graphClouds,graphNodes,w,chrome+38);
 h=Math.max(viewport,...graphNodes.map(p=>p.y+156),...cloudLabels.map(label=>label.y+label.height+60));
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
 const labelPositions=[],defs=svg('defs',{}),lead=clamp((hi-lo)*.18,.08,4);
 if(timeScale.breaks.length){const pattern=svg('pattern',{id:'time-break-hatch',width:8,height:8,patternUnits:'userSpaceOnUse'},defs);svg('path',{d:'M-2 8 L8 -2 M4 10 L10 4',class:'time-break-hatch-line'},pattern);}
 ids.forEach(id=>{
  const anchors=globalNodes.filter(p=>linked(p,id)).map(p=>({day:dayToAxis(p.day,allEvents),y:p.y,id:p.id})).sort((a,b)=>a.day-b.day||a.id.localeCompare(b.id));
  if(!anchors.length||anchors[0].day-lead>hi||anchors.at(-1).day+lead<lo)return;
  const blockers=graphNodes.filter(p=>!linked(p,id)).map(p=>({...p,day:dayToAxis(p.day,allEvents)}));
  const route=TimelineCore.avoid(TimelineCore.strand(anchors,id,mid,amplitude,lead,plot/(hi-lo)),blockers,id,30);
  const coordinates=route.map(p=>({x:pxAxis(p.day),y:p.y,node:p.node,flat:p.flat}));
  const d=smoothPath(coordinates),dim=focusedCharacter&&focusedCharacter!==id;
  const gradient=svg('linearGradient',{id:'strand-'+id,gradientUnits:'userSpaceOnUse',x1:pxAxis(route[0].day),x2:pxAxis(route.at(-1).day),y1:0,y2:0},defs),fade=Math.min(.45,lead*.65/Math.max(.001,route.at(-1).day-route[0].day));
  for(const [offset,opacity] of [[0,0],[fade,1],[1-fade,1],[1,0]])svg('stop',{offset,'stop-color':color(id),'stop-opacity':opacity},gradient);
  svg('path',{d,class:'thread',stroke:`url(#strand-${id})`,'stroke-width':id===focusedCharacter?3:overview?1.5:n>24?1.2:2.1,opacity:dim?'.12':n>24?'.35':'.85','data-character':id});
  const hit=svg('path',{d,class:'thread-hit',stroke:'transparent','stroke-width':14,role:'button',tabindex:overview&&n>20?-1:0,'aria-label':`Зосередитися: ${fullName(id)}`,'aria-pressed':id===focusedCharacter,'data-character':id});
  hit.addEventListener('click',()=>setFocus(id));hit.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setFocus(id);}});
  if(!overview&&(focusedCharacter?id===focusedCharacter:n<=18)){
   const labelDay=Math.max(lo,route[0].day),labelX=pxAxis(labelDay),actualY=TimelineCore.curveY(route,labelDay);let labelY=actualY-12;while(labelPositions.some(y=>Math.abs(y-labelY)<16))labelY-=16;labelPositions.push(labelY);
   if(Math.abs(labelY-(actualY-12))>1)svg('line',{x1:labelX+2,x2:labelX+2,y1:actualY-3,y2:labelY+3,stroke:color(id),'stroke-width':.6,opacity:.5});
   const text=svg('text',{x:labelX+6,y:labelY,class:'line-label',role:'button',tabindex:0,'aria-label':`Зосередитися: ${fullName(id)}`,style:`fill:color-mix(in srgb,${color(id)} 60%,#272f2b);font-size:12px`});text.textContent=name(id);text.addEventListener('click',()=>setFocus(id));text.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setFocus(id);}});
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
 cloudLabels.forEach(label=>{
  const g=svg('g',{class:'cloud-label','data-cloud-kind':label.kind,'data-cloud-id':label.id,'data-cloud-parent':label.parentId||'','data-caption-y':label.y,'data-caption-height':label.height,'aria-hidden':'true'});
  const lx=clamp(label.anchor.x,label.x,label.x+label.width),ly=clamp(label.anchor.y,label.y,label.y+label.height);
  if(Math.hypot(lx-label.anchor.x,ly-label.anchor.y)>24)svg('line',{x1:lx,y1:ly,x2:label.anchor.x,y2:label.anchor.y,class:'cloud-guide'},g);
  svg('title',{},g).textContent=(label.parentTitle?label.parentTitle+' · ':'')+label.title;
  const parent=label.kind==='scene'?'Епізод · '+(label.parentTitle||'Не встановлено'):'ЕПІЗОД';
  const limit=Math.floor(label.width/5.3);svg('text',{x:label.x,y:label.y+11,class:'cloud-parent'},g).textContent=parent.length>limit?parent.slice(0,limit-1)+'…':parent;
  label.lines.forEach((line,i)=>svg('text',{x:label.x,y:label.y+29+i*17,class:'cloud-title'},g).textContent=line);
 });
 // Large touch targets stay below every visible mark. A neighboring transparent
 // target can never intercept a tap directly on another node's visible center.
 const hitLayer=svg('g',{'aria-hidden':'true'});
 graphNodes.forEach(p=>{
  const hit=svg(p.kind==='arc'?'ellipse':'circle',{class:'node-hit','data-node-id':p.id,cx:p.x,cy:p.y,...(p.kind==='arc'?{rx:24,ry:22}:{r:22})},hitLayer);
  hit.addEventListener('click',()=>openNode(p,true));
  hit.addEventListener('pointerenter',e=>{if(canHover(e))openNode(p);});hit.addEventListener('pointerleave',deferHoverClose);
 });
 graphNodes.forEach(p=>{
  const kindLabel={moment:'Момент',scene:'Сцена',episode:'Епізод',arc:'Арка'}[p.kind]||'Вузол',label=`${kindLabel}: ${p.title}${p.kind==='moment'||p.kind==='arc'?'':` · ${p.childCount}`}`,g=svg('g',{class:'node '+p.kind+'-node'+(focusId===p.id?' is-open':'')+(pinnedNodeId===p.id?' is-pinned':''),tabindex:0,role:'button','aria-label':label,'aria-haspopup':'dialog','data-event':p.id,'data-scene':p.kind==='scene'?(p.scene?.id||''):''});
  if(p.kind==='arc'){
   svg('ellipse',{class:'mark',cx:p.x,cy:p.y,rx:16,ry:9},g);
  }else{
   const radius=p.kind==='moment'?5:p.kind==='scene'?9:11;
   svg('circle',{class:'mark',cx:p.x,cy:p.y,r:radius},g);
   if(p.kind==='scene'||p.kind==='episode'){const count=svg('text',{class:'scene-count',x:p.x,y:p.y+3,'text-anchor':'middle'},g);count.textContent=p.childCount>99?'99+':p.childCount;}
  }
  g.addEventListener('click',()=>openNode(p,true));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openNode(p,true);}});
  g.addEventListener('pointerenter',e=>{if(canHover(e))openNode(p);});g.addEventListener('pointerover',e=>{if(canHover(e)&&!g.contains(e.relatedTarget))openNode(p);});g.addEventListener('pointerleave',deferHoverClose);
 });
 $('timelineEmpty').hidden=graphNodes.length>0;
 if(!graphNodes.length){
  $('emptyTitle').textContent=selected.size?'У цьому періоді немає подій':'Обери лінії персонажів';
  $('emptyDescription').textContent=selected.size?'Перейди до найближчої події обраних персонажів.':'Їхні події з’являться на хронології.';
  $('emptyAction').textContent=selected.size?'До найближчої події':'Обрати всіх';
 }
 if(!$('eventCard').hidden){const a=graphNodes.find(p=>p.id===focusId);if(a)positionCard(a);else{pinnedNodeId=null;hoverCard=false;focusId=null;$('eventCard').hidden=true;}}
 paintNodes();updateFocusBar();showCloudCaptions();
}
function positionCard(point){
 const card=$('eventCard'),canvas=$('canvas'),w=canvas.clientWidth||1000,width=Math.min(600,w-24),left=clamp(point.x,width/2+12,w-width/2-12),bounds=readingBounds();
 card.hidden=false;card.style.left=left+'px';card.style.width=width+'px';card.dataset.placement='reading';card.style.top=bounds.top+'px';
 const room=pinnedNodeId?bounds.height:Math.max(120,point.y-canvas.scrollTop-bounds.top-18);card.style.setProperty('--card-height',Math.min(bounds.height,room)+'px');
 positionEventPreview();
}
function ensureEventPreview(){
 let preview=$('eventPreview');if(preview)return preview;
 preview=document.createElement('aside');preview.id='eventPreview';preview.className='event-preview';preview.hidden=true;preview.setAttribute('role','dialog');preview.setAttribute('aria-label','Опис події');preview.innerHTML='<div id="eventPreviewContent"></div>';document.body.append(preview);
 preview.addEventListener('pointerenter',()=>{clearTimeout(previewCloseTimer);cancelHoverClose();});
 preview.addEventListener('pointerleave',()=>{if(!previewPinned)scheduleEventPreviewClose();deferHoverClose();});
 return preview;
}
function scheduleEventPreviewClose(){
 clearTimeout(previewCloseTimer);if(previewPinned)return;
 previewCloseTimer=setTimeout(()=>closeEventPreview(),180);
}
function closeEventPreview(force=false){
 if(previewPinned&&!force)return;
 const returnId=previewEventId;
 clearTimeout(previewCloseTimer);previewCloseTimer=null;previewEventId=null;previewPinned=false;
 const preview=$('eventPreview');if(preview){preview.classList.remove('is-visible');preview.hidden=true;}
 $('eventCard').removeAttribute('data-preview-open');
 document.querySelectorAll('.scene-actions li.is-preview-active').forEach(li=>li.classList.remove('is-preview-active'));
 if(force&&returnId&&document.documentElement.dataset.input==='keyboard'){
  [...$('cardContent').querySelectorAll('[data-scene-preview]')].find(li=>li.dataset.scenePreview===returnId)?.querySelector('button')?.focus();
 }
}
function positionEventPreview(){
 const preview=$('eventPreview'),card=$('eventCard');if(!preview||preview.hidden||card.hidden)return;
 const gap=12,vw=document.documentElement.clientWidth||window.innerWidth,vh=document.documentElement.clientHeight||window.innerHeight;
 const cardRect=card.getBoundingClientRect(),width=Math.min(390,vw-24);
 preview.style.width=width+'px';preview.style.maxHeight=Math.max(160,vh-24)+'px';
 const rightSpace=vw-cardRect.right-gap,leftSpace=cardRect.left-gap;
 const side=rightSpace>=width||rightSpace>=leftSpace?'right':'left';
 preview.dataset.side=side;
 let left=side==='right'?cardRect.right+gap:cardRect.left-gap-width;
 left=clamp(left,12,Math.max(12,vw-width-12));
 preview.style.left=left+'px';
 const overlay=Math.max(rightSpace,leftSpace)<width;
 $('eventCard').setAttribute('data-preview-open',String(overlay));
 preview.dataset.overlay=String(overlay);
 if(overlay){
  preview.style.width=cardRect.width+'px';preview.style.left=cardRect.left+'px';preview.style.top=cardRect.top+'px';preview.style.maxHeight=cardRect.height+'px';
 }else{
  const top=document.querySelector('.masthead')?.getBoundingClientRect?.().bottom||86,bottom=vh-132;
  const previewHeight=Math.min(preview.scrollHeight||480,Math.max(120,bottom-top-12));
  preview.style.maxHeight=Math.max(120,bottom-top-12)+'px';preview.style.top=clamp(cardRect.top,top+12,Math.max(top+12,bottom-previewHeight))+'px';
 }
}
function bindEventPreview(){
 const preview=ensureEventPreview(),content=$('eventPreviewContent');
 content.querySelectorAll('[data-close-preview]').forEach(b=>b.addEventListener('click',()=>closeEventPreview(true)));
 content.querySelectorAll('[data-preview-event]').forEach(b=>b.addEventListener('click',()=>showEventPreview(b.dataset.previewEvent,true)));
 content.querySelectorAll('[data-event-focus-character]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.eventFocusCharacter;if(focusedCharacter!==id)setFocus(id);}));
 content.querySelectorAll('[data-open-scene]').forEach(b=>b.addEventListener('click',()=>openScene(b.dataset.openScene,b)));
}
function bindSceneActionPreviews(){
 $('cardContent').querySelectorAll('[data-scene-preview]').forEach(li=>{
  const id=li.dataset.scenePreview;
  li.addEventListener('pointerenter',e=>{
   clearTimeout(previewCloseTimer);
   if(!canHover(e))return;
   const box=$('eventCard').getBoundingClientRect(),vw=document.documentElement.clientWidth||window.innerWidth;
   if(Math.max(box.left-12,vw-box.right-12)>=Math.min(390,vw-24))showEventPreview(id,false);
  });
  li.addEventListener('pointerleave',scheduleEventPreviewClose);
  li.addEventListener('click',()=>showEventPreview(id,true));
 });
}
function bindCard(){
 $('cardContent').querySelectorAll('[data-card-event]').forEach(b=>b.addEventListener('click',()=>navigateEvent(b.dataset.cardEvent)));
 $('cardContent').querySelectorAll('[data-story-episode]').forEach(b=>b.addEventListener('click',()=>navigateEpisodeLevel(b.dataset.storyEpisode)));
 $('cardContent').querySelectorAll('[data-story-scene]').forEach(b=>b.addEventListener('click',()=>navigateSceneLevel(b.dataset.storyScene)));
 $('cardContent').querySelectorAll('[data-step-event]').forEach(b=>b.addEventListener('click',()=>stepEvent(+b.dataset.stepEvent)));
 $('cardContent').querySelectorAll('[data-event-focus-character]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.eventFocusCharacter;if(focusedCharacter!==id)setFocus(id);}));
 $('cardContent').querySelectorAll('[data-close-card]').forEach(b=>b.addEventListener('click',()=>closeCard(true)));
 $('cardContent').querySelectorAll('[data-open-scene]').forEach(b=>b.addEventListener('click',()=>openScene(b.dataset.openScene,b)));
 $('cardContent').querySelectorAll('[data-step-scene]').forEach(b=>b.addEventListener('click',()=>stepScene(+b.dataset.stepScene)));
}
function navigateEpisodeLevel(id){
 const episode=episodeMap.get(id);if(!episode)return;const scenes=(episode.scene_ids||[]).map(id=>sceneMap.get(id)).filter(Boolean),days=scenes.map(s=>s.day).filter(d=>d!==null);
 zoom=zoomModes.month;if(days.length)center=clampAxisCenter(dayToAxis((Math.min(...days)+Math.max(...days))/2+.5));closeCard();render();const node=graphNodes.find(p=>(p.kind==='episode'&&p.rawId===id)||(p.sourceEpisodeIds||[]).includes(id));if(node)openNode(node,true);
}
function navigateSceneLevel(id){
 const scene=sceneMap.get(id);if(!scene||scene.day===null)return;zoom=zoomModes.week;center=clampAxisCenter(dayToAxis(scene.day+.5));closeCard();render();const node=graphNodes.find(p=>(p.kind==='scene'&&p.id===id)||(p.sourceSceneIds||[]).includes(id));if(node)openNode(node,true);
}
function cardKindLabel(kind){return ({moment:'МОМЕНТ',scene:'СЦЕНА',episode:'ЕПІЗОД',arc:'АРКА'})[kind]||String(kind||'').toUpperCase();}
function cardMetaLine(kind,dateOrRange,hasYear=true){return `<span class="card-meta-line"><strong class="card-kind">${esc(cardKindLabel(kind))}</strong><span aria-hidden="true"> · </span><span>${esc(dateOrRange)}</span>${hasYear?'<span aria-hidden="true"> · </span><span>Рік 0</span>':''}</span>`;}
function cardTop(day,navigation,kind='moment',openSceneId=null){
 const navKind=kind==='scene'?'scene':'event';
 const arrow=(direction,label)=>`<button class="card-arrow" data-step-${navKind}="${direction}" aria-label="${label}" title="${label}" ${navigation[direction<0?'previous':'next']?'':'disabled'}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${direction<0?'m14 6-6 6 6 6':'m10 6 6 6-6 6'}"/></svg></button>`;
 const openScene=openSceneId?`<button class="card-open-scene" data-open-scene="${esc(openSceneId)}" aria-label="Читати сцену цілком" data-tooltip="Читати сцену цілком"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M10 7h7v7"/></svg></button>`:'';
 return `<div class="card-top">${cardMetaLine(kind,day===null?'Без установленої дати':dateText(day,true),day!==null)}<div class="card-top-actions">${openScene}<nav class="card-arrows" aria-label="Перехід між ${kind==='scene'?'сценами':'моментами'}">${arrow(-1,'Назад')}${arrow(1,'Далі')}</nav><button class="close" data-close-card aria-label="Закрити" title="Закрити">×</button></div></div>`;
}
function sceneNavigation(id){const list=orderedScenes().filter(s=>s.group.some(e=>focusedCharacter?e.tracks.includes(focusedCharacter):relevant(e))),i=list.findIndex(s=>s.id===id);return {previous:list[i-1]||null,next:list[i+1]||null};}
function stepScene(direction){const id=sceneMap.has(focusId)?focusId:eventMap.get(focusId)?.scene_id,target=sceneNavigation(id)[direction<0?'previous':'next'];if(target)navigateScene(target.id);}
function navigateScene(id){
 const group=sceneEvents(id),e=group.find(e=>focusedCharacter?e.tracks.includes(focusedCharacter):relevant(e))||group[0];if(!prepareNavigation(e))return;
 if(e.day!==null){zoom=zoomModes.week;center=clampAxisCenter(dayToAxis(e.day+.5));}
 focusId=group.length===1?e.id:id;pinnedNodeId=focusId;anchorEvent=null;showSceneCard(sceneMap.get(id),group);$('eventCard').hidden=false;render();revealReadingNode();focusReadingCard();
}
function showSceneCard(scene,group){
 closeEventPreview(true);
 const cast=sceneCast(scene,group);
 setCardContent(`${cardTop(group[0].day,sceneNavigation(scene.id),'scene',scene.id)}<h2>${esc(scene.title)}</h2><p class="scene-location">${esc(name(scene.location_id))} · ${actionCount(group.length)}</p>${cast.length?`<div class="people scene-people">${cast.map(id=>`<button class="person" data-event-focus-character="${esc(id)}" aria-label="Зосередитися на лінії ${esc(name(id))}" title="Зосередитися на лінії"><span class="swatch" style="background:${color(id)}"></span>${esc(name(id))}</button>`).join('')}</div>`:''}<ol class="scene-actions">${group.map(e=>`<li data-scene-preview="${esc(e.id)}"><div>${eventGallery(e)}<button class="scene-action-title" aria-haspopup="dialog" aria-label="Переглянути дію: ${esc(e.title)}">${esc(e.title)}</button></div></li>`).join('')}</ol>`);
 bindCard();bindSceneActionPreviews();
}
function eventGallery(e){
 const photos=(data.media||[]).filter(m=>m.event_id===e.id&&m.status==='published').sort((a,b)=>(a.order||0)-(b.order||0));
 return photos.length?`<div class="event-gallery">${photos.map(m=>`<figure><img src="${esc(m.src)}" alt="${esc(m.alt)}" loading="lazy" decoding="async" width="${Number(m.width)||640}" height="${Number(m.height)||360}"><figcaption>${esc(m.caption||m.alt)}<small>${esc(m.locator)}${m.coverage==='canonical_part'?' · Канонічна частина події':''}</small></figcaption></figure>`).join('')}</div>`:'';
}
function openScene(id,trigger){cancelHoverClose();hoverCard=false;if(!sceneMap.has(id))return;sceneId=id;sceneReturnFocus=trigger;renderScene();const dialog=$('sceneDialog');dialog.hidden=false;if(!dialog.open){if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');}$('closeScene').focus();}
function closeScene(){const dialog=$('sceneDialog');if(dialog.hidden)return;if(dialog.close)dialog.close();else dialog.removeAttribute('open');dialog.hidden=true;sceneId=null;sceneReturnFocus?.focus();}
function renderScene(){
 const scene=sceneMap.get(sceneId);if(!scene){closeScene();return;}const group=sceneEvents(sceneId),cast=sceneCast(scene,group);
 $('sceneTitle').textContent=scene.title;$('sceneMeta').textContent=`${dateText(scene.day,true)} · ${name(scene.location_id)} · ${actionCount(group.length)}`;
 $('sceneContent').innerHTML=`${cast.length?`<div class="people scene-cast">${cast.map(id=>`<button class="person" data-scene-focus-character="${esc(id)}" aria-label="Зосередитися на лінії ${esc(fullName(id))}" title="Зосередитися на лінії"><span class="swatch" style="background:${color(id)}"></span>${esc(fullName(id))}</button>`).join('')}</div>`:''}<ol class="scene-story">${group.map(e=>`<li data-scene-action="${esc(e.id)}">${eventGallery(e)}<h3><button data-scene-event="${esc(e.id)}">${esc(e.title)} <span aria-hidden="true">↗</span></button></h3><p>${esc(e.text)}</p></li>`).join('')}</ol>`;
 $('sceneContent').querySelectorAll('[data-scene-event]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.sceneEvent;closeScene();navigateEvent(id);}));
 $('sceneContent').querySelectorAll('[data-scene-focus-character]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.sceneFocusCharacter;closeScene();if(focusedCharacter!==id)setFocus(id);}));
}
function showGroup(group){$('cardContent').innerHTML=`<div class="card-top"><span class="card-date">${dateText(group[0].day,true)} · ${group.length} моментів</span><button class="close" data-close-card aria-label="Закрити">×</button></div>${group.map(e=>`<button class="result" data-card-event="${esc(e.id)}">${esc(e.title)}</button>`).join('')}`;bindCard();}
function showStoryGroup(point){
 const kind=point.kind==='arc'?'Арка':'Епізод',days=point.group.map(e=>e.day).filter(d=>d!==null),start=days.length?Math.min(...days):null,end=days.length?Math.max(...days):null,range=start===null?'Без установленої дати':start===end?dateText(start,true):`${dateText(start,true)} — ${dateText(end,true)}`;
 const children=point.kind==='arc'
  ?(point.sourceEpisodeIds||[]).map(id=>{const episode=episodeMap.get(id),count=(episode?.scene_ids||[]).length;return episode?{id,title:episode.title,meta:`${count} ${count===1?'сцена':'сцен'}`}:null;}).filter(Boolean)
  :(point.sourceSceneIds||[]).map(id=>{const scene=sceneMap.get(id),group=sceneEvents(id);return scene&&group.length?{id,title:scene.title,meta:actionCount(group.length)}:null;}).filter(Boolean);
 setCardContent(`<div class="card-top">${cardMetaLine(point.kind,range,start!==null)}<button class="close" data-close-card aria-label="Закрити" title="Закрити">×</button></div><h2>${esc(point.title)}</h2>${point.story?.description?`<p class="event-text">${esc(point.story.description)}</p>`:''}<p class="scene-location">${point.kind==='arc'?`${point.childCount} епізодів`:`${point.childCount} сцен`} · ${point.group.length} моментів</p><div class="story-children">${children.map(child=>`<button class="result" ${point.kind==='arc'?`data-story-episode="${esc(child.id)}"`:`data-story-scene="${esc(child.id)}"`}><strong>${esc(child.title)}</strong><small>${esc(child.meta)}</small></button>`).join('')}</div>`);
 bindCard();
}
function eventDetailsHtml(e,relationAttribute='data-card-event',showSceneContext=true){
 const scene=sceneMap.get(e.scene_id),physical=e.involvement.filter(i=>e.physical.includes(i.entity_id)),special=e.involvement.filter(i=>modes[i.mode]),mentioned=e.involvement.filter(i=>i.role==='mentioned'||i.mode==='remote');
 const repo='https://github.com/DSMykyta/Konoha-Gaiden-Chronicles/blob/';
 const evidence=(e.evidence_ids||[]).map(id=>{const ev=evidenceMap.get(id),source=sourceMap.get(ev?.source_id);if(!ev)return `<p>${esc(id)}</p>`;const locator=typeof ev.locator==='string'?ev.locator:JSON.stringify(ev.locator||'');return `<div class="evidence">${source?.path?`<a href="${repo}${encodeURIComponent(source.revision||data.revision)}/${source.path.split('/').map(encodeURIComponent).join('/')}" target="_blank" rel="noopener">${esc(source.title)}</a>`:`<p>${esc(source?.title||id)}</p>`}<p>${esc(locator)}</p></div>`;}).join('');
 const rel=[...(scene.relations||[]),...data.links].filter(r=>(r.a===e.id||r.b===e.id)&&['before','meets','intersects','same_span','observes'].includes(r.kind));
 const relations=rel.map(r=>{const d=describeRelation(r,e.id),other=eventMap.get(d.otherId),sc=sceneMap.get(d.otherId);return `<div class="relation"><span>${esc(d.label)}:</span>${other?`<button class="text-button" ${relationAttribute}="${esc(other.id)}">${esc(other.title)}${r.review!=='accepted'?' · потребує перевірки':''}</button>`:`<span>${esc(sc?.title||d.otherId)}</span>`}</div>`;}).join('');
 const sceneCast=[...new Set((scene.presence||[]).map(p=>p.entity_id))];
 return `${eventGallery(e)}<h2>${esc(e.title)}</h2>${showSceneContext?`<button class="scene-context" data-open-scene="${esc(scene.id)}" title="Читати сцену цілком"><span>Сцена · ${sceneEvents(scene.id).length} дій</span>${esc(scene.title)} <span aria-hidden="true">↗</span></button>`:''}<p class="event-text">${esc(e.text)}</p><div class="people">${physical.map(i=>`<button class="person" data-event-focus-character="${esc(i.entity_id)}" aria-label="Зосередитися на лінії ${esc(name(i.entity_id))}" title="Зосередитися на лінії"><span class="swatch" style="background:${color(i.entity_id)}"></span>${esc(name(i.entity_id))}</button>`).join('')}</div><p class="card-meta">${esc(origins[e.origin]||e.origin)}${e.date_status!=='established'&&e.day!==null?' · Робоча дата':''}${e.scene_state!=='active'?' · Чернетка':''}</p>${special.length?`<p class="card-meta">${special.map(i=>`${esc(name(i.entity_id))} (${modes[i.mode]})`).join(', ')}</p>`:''}${mentioned.length?`<p class="card-meta">Згадки / віддалена дія: ${mentioned.map(i=>esc(name(i.entity_id))).join(', ')}</p>`:''}${relations?`<details class="disclosure"><summary>Часові зв’язки</summary>${relations}</details>`:''}<details class="disclosure"><summary>Сцена та присутність</summary><p>${esc(e.scene_title)} · ${esc(name(e.location_id))}</p>${sceneCast.length?`<p>Присутні в різні моменти сцени: ${sceneCast.map(id=>esc(name(id))).join(', ')}.</p>`:''}<p>Точна година не встановлена. Положення вузлів у межах дня показує порядок відображення, а не доведену одночасність.</p></details><details class="disclosure"><summary>Джерела</summary>${evidence||'<p>Джерела не позначено.</p>'}<a href="${repo}${data.revision}/${data.base}/scenes/${encodeURIComponent(e.file)}" target="_blank" rel="noopener">Запис сцени</a></details>`;
}
function showEvent(e){
 const navigation=nav();
 setCardContent(`${cardTop(e.day,navigation,'moment')}${eventDetailsHtml(e,'data-card-event')}`);
 bindCard();
}
function showEventPreview(id,pin=false){
 const e=eventMap.get(id);if(!e)return;
 if(previewPinned&&!pin&&previewEventId!==id)return;
 const preview=ensureEventPreview();
 previewEventId=id;if(pin){previewPinned=true;cancelHoverClose();if(focusId&&!pinnedNodeId)pinnedNodeId=focusId;hoverCard=false;paintNodes();}
 $('eventPreviewContent').innerHTML=`<div class="preview-top"><button class="preview-back" data-close-preview aria-label="Повернутися до сцени">‹ До сцени</button>${cardMetaLine('moment',e.day===null?'Без установленої дати':dateText(e.day,true),e.day!==null)}</div>${eventDetailsHtml(e,'data-preview-event',false)}`;
 preview.hidden=false;
 document.querySelectorAll('.scene-actions li').forEach(li=>li.classList.toggle('is-preview-active',li.dataset.scenePreview===id));
 positionEventPreview();bindEventPreview();
 preview.classList.add('is-visible');
 if(pin&&document.documentElement.dataset.input==='keyboard')$('eventPreviewContent').querySelector('[data-close-preview]')?.focus();
}
function prepareNavigation(e){
 if(!e)return false;rememberCardFocus();cancelHoverClose();closeEventPreview(true);hoverCard=false;
 if(readingScrollTop===null)readingScrollTop=$('canvas').scrollTop;
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
function openProfile(id,trigger){if(!entityMap.has(id))return;profileEntity=id;profileVersion=null;profileReturnFocus=trigger;renderProfile();const dialog=$('profileDialog');dialog.hidden=false;if(!dialog.open){if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');}$('closeProfile').focus();}
function closeProfile(){const dialog=$('profileDialog');if(dialog.hidden)return;if(dialog.close)dialog.close();else dialog.removeAttribute('open');dialog.hidden=true;profileEntity=null;profileReturnFocus?.focus();}
function characterTimelineEvents(id){
 return orderedScenes().flatMap(s=>s.group).filter(e=>e.tracks.includes(id));
}
function openCharacterEvents(id,trigger){
 if(!entityMap.has(id))return;
 characterEventsEntity=id;characterEventsReturnFocus=trigger;
 const list=characterTimelineEvents(id),dated=list.filter(e=>e.day!==null),dialog=$('characterEventsDialog'),track=$('characterEventsTrack');
 $('characterEventsTitle').textContent=fullName(id);
 $('characterEventsMeta').textContent=`${list.length} подій${dated.length?` · ${dateText(dated[0].day)} — ${dateText(dated.at(-1).day)}`:''}`;
 track.innerHTML=list.length?list.map((e,index)=>`<article class="character-event-card" data-character-event="${esc(e.id)}"><div class="character-event-top"><span class="card-date">${esc(dateText(e.day,true))}${e.day!==null?' · Рік 0':''}</span><span class="character-event-index">${index+1} / ${list.length}</span></div>${eventDetailsHtml(e,'data-character-timeline-event')}</article>`).join(''):'<p class="empty">Подій персонажа не знайдено.</p>';
 track.querySelectorAll('[data-character-timeline-event]').forEach(b=>b.addEventListener('click',()=>{closeCharacterEvents();closeProfile();navigateEvent(b.dataset.characterTimelineEvent);}));
 track.querySelectorAll('[data-event-focus-character]').forEach(b=>b.addEventListener('click',()=>{const target=b.dataset.eventFocusCharacter;closeCharacterEvents();closeProfile();if(focusedCharacter!==target)setFocus(target);}));
 track.querySelectorAll('[data-open-scene]').forEach(b=>b.addEventListener('click',()=>{const scene=b.dataset.openScene;closeCharacterEvents();openScene(scene,b);}));
 dialog.hidden=false;if(!dialog.open){if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');}
 requestAnimationFrame(()=>{track.scrollLeft=0;updateCharacterReader();$('closeCharacterEvents').focus();});
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
 const dialog=$('characterEventsDialog');if(dialog.hidden)return;
 if(dialog.close)dialog.close();else dialog.removeAttribute('open');
 dialog.hidden=true;characterEventsEntity=null;const target=characterEventsReturnFocus;characterEventsReturnFocus=null;target?.focus();
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
 const entity=entityMap.get(profileEntity);if(!entity)return;const profile=profileMap.get(profileEntity),versions=profile?.versions?.length?profile.versions:[{id:'general',label:'Профіль'}];if(!versions.some(v=>v.id===profileVersion))profileVersion=versions[0].id;
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
}
function ingest(next,initial=false){
 const calendarCenter=data?axisToDay(center):center,wasAll=data&&selectable().every(e=>selected.has(e.id));
 data=next;entityMap=new Map(data.entities.map(e=>[e.id,e]));eventMap=new Map(data.events.map(e=>[e.id,e]));sceneMap=new Map(data.scenes.map(s=>[s.id,s]));episodeMap=new Map((data.episodes||[]).map(e=>[e.id,e]));arcMap=new Map((data.arcs||[]).map(a=>[a.id,a]));evidenceMap=new Map(data.sources.evidence.map(e=>[e.id,e]));sourceMap=new Map(data.sources.sources.map(s=>[s.id,s]));profileMap=new Map((data.profiles||[]).map(p=>[p.entity_id,p]));
 if(initial||wasAll)selected=new Set(selectable().map(e=>e.id));else selected=new Set([...selected].filter(id=>entityMap.has(id)));if(focusedCharacter&&!entityMap.has(focusedCharacter))focusedCharacter=null;if(anchorEvent&&!eventMap.has(anchorEvent))closeCard();
 center=clampAxisCenter(dayToAxis(calendarCenter));
 $('revision').textContent=`Дані: ${data.revision.slice(0,8)}`;$('sourceLink').href=`https://github.com/DSMykyta/Konoha-Gaiden-Chronicles/tree/${data.revision}/${data.base}`;
}
let refreshing=false;
async function refreshData(){
 if(refreshing||document.visibilityState==='hidden'||window.__TIMELINE_DATA__)return;refreshing=true;
 try{const v=await fetch(`version.json?t=${Date.now()}`,{cache:'no-store'});if(!v.ok)return;const version=await v.json();if(version.revision===data.revision)return;const response=await fetch(`data.json?v=${encodeURIComponent(version.revision)}`,{cache:'no-store'});if(!response.ok)return;const next=await response.json();ingest(next);renderCharacters();search();if(anchorEvent&&eventMap.has(anchorEvent)&&!$('eventCard').hidden)showEvent(eventMap.get(anchorEvent));if(profileEntity)renderProfile();if(sceneId)renderScene();if(!anchorEvent&&sceneMap.has(focusId)&&!$('eventCard').hidden)showSceneCard(sceneMap.get(focusId),sceneEvents(focusId));render();}catch{}finally{refreshing=false;}
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
   if(!$('sceneDialog').hidden){e.preventDefault();closeScene();return;}
   if(!$('characterEventsDialog').hidden){e.preventDefault();closeCharacterEvents();return;}
   if(!$('profileDialog').hidden){e.preventDefault();closeProfile();return;}
   if($('eventPreview')&&!$('eventPreview').hidden){e.preventDefault();closeEventPreview(true);return;}
   const openPanel=['linesPanel','searchPanel','periodPanel'].find(id=>!$(id).hidden);
   if(openPanel){e.preventDefault();closePanels();$(openPanel.replace('Panel','Button')).focus();return;}
   if(!$('eventCard').hidden){closeCard(true);return;}
   if(focusedCharacter){focusedCharacter=null;renderCharacters();render();}
  }
  if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.target.closest('input,textarea,select,[contenteditable="true"]')&&document.querySelector('dialog[open]')===null){e.preventDefault();if($('searchPanel').hidden)togglePanel('searchPanel');$('eventSearch').focus();search();}
 });
 document.addEventListener('pointerdown',e=>{
  document.documentElement.dataset.input='pointer';
  if(!e.target.closest('.panel,.tools,.period,.scene-dialog'))closePanels();
  if(!e.target.closest('.event-card,.event-preview,.node,.node-hit,.thread-hit,.line-label,.focus-bar,.profile-dialog,.character-events-dialog,.scene-dialog,.time-controls,.panel,.tools,.period'))closeCard();
 });
 const canvas=$('timeline'),touches=new Map();let drag=null,pinch=null;
 canvas.addEventListener('wheel',e=>{e.preventDefault();const box=canvas.getBoundingClientRect(),pad=box.width<600?22:48,t=clamp((e.clientX-box.left-pad)/(box.width-pad*2),0,1),[lo,hi]=range();setZoom(zoom*Math.exp(-clamp(e.deltaY,-100,100)*.007),lo+t*(hi-lo));},{passive:false});
 canvas.addEventListener('pointerdown',e=>{if(e.target.closest('.node,.node-hit,.thread-hit,.line-label'))return;touches.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);if(touches.size===1){drag={x:e.clientX,y:e.clientY,center,scroll:$('canvas').scrollTop};canvas.classList.add('dragging');}else if(touches.size===2){const a=[...touches.values()];pinch={distance:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),zoom};drag=null;}});
 canvas.addEventListener('pointermove',e=>{if(!touches.has(e.pointerId))return;touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pinch&&touches.size===2){const a=[...touches.values()];setZoom(pinch.zoom*Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)/Math.max(1,pinch.distance));}else if(drag){$('canvas').scrollTop=drag.scroll-(e.clientY-drag.y);const pad=canvas.clientWidth<600?22:48;center=clampAxisCenter(drag.center-(e.clientX-drag.x)/Math.max(1,canvas.clientWidth-pad*2)*365/zoom);schedule();}});
 const end=e=>{touches.delete(e.pointerId);drag=null;pinch=null;canvas.classList.remove('dragging');};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);new ResizeObserver(schedule).observe($('canvas'));
 $('canvas').addEventListener('scroll',()=>{$('hoverTip').hidden=true;cloudRenderer?.scroll($('canvas').scrollTop);showCloudCaptions();const p=graphNodes.find(p=>p.id===focusId);if(p&&!$('eventCard').hidden)positionCard(p);},{passive:true});
 $('focusPrevious').addEventListener('click',()=>stepEvent(-1));$('focusNext').addEventListener('click',()=>stepEvent(1));$('focusName').addEventListener('click',()=>openProfile(focusedCharacter,$('focusName')));$('clearFocus').addEventListener('click',()=>{focusedCharacter=null;closeCard();renderCharacters();render();});
 $('eventCard').addEventListener('pointerenter',cancelHoverClose);$('eventCard').addEventListener('pointerleave',deferHoverClose);
 $('closeScene').addEventListener('click',closeScene);$('sceneDialog').addEventListener('cancel',e=>{e.preventDefault();closeScene();});
 $('closeProfile').addEventListener('click',closeProfile);$('profileDialog').addEventListener('cancel',e=>{e.preventDefault();closeProfile();});$('profileDialog').addEventListener('click',e=>{if(e.target===$('profileDialog')){const b=$('profileDialog').getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)closeProfile();}});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='hidden')refreshData();});window.addEventListener('focus',refreshData);setInterval(refreshData,60000);
 renderCharacters();render();const params=new URLSearchParams(window.location.search);if(entityMap.has(params.get('character')))setFocus(params.get('character'));if(eventMap.has(params.get('event')))navigateEvent(params.get('event'));
 }catch(e){if($('status'))$('status').hidden=true;if($('error')){$('error').textContent=e.message;$('error').hidden=false;}console.error(e);}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
