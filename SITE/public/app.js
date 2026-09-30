'use strict';
const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
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
function events(){return data.events.filter(e=>e.continuity===continuity&&e.scene_state!=='inactive');}
function relevant(e){return e.tracks.some(id=>selected.has(id));}
function sceneEvents(id){return TimelineCore.ordered(events().filter(e=>e.scene_id===id));}
function sceneCast(scene,group){return [...new Set([...(scene?.presence||[]).filter(p=>!p.mode||['physical','physical_hidden'].includes(p.mode)).map(p=>p.entity_id),...group.flatMap(e=>e.physical)])];}
function actionCount(n){return `${n} ${n%100>=11&&n%100<=14?'дій':n%10===1?'дія':n%10>=2&&n%10<=4?'дії':'дій'}`;}
function navigationEvents(){return events().filter(e=>focusedCharacter?e.tracks.includes(focusedCharacter):relevant(e));}
function chronologyRelations(){return [...data.links,...data.scenes.flatMap(s=>s.relations||[])];}
function orderedScenes(){return TimelineCore.scenes(events(),chronologyRelations(),data.scenes);}
function semanticLevel(){
 if(zoom>=Math.sqrt(zoomModes.day*zoomModes.week))return 'moment';
 if(zoom>=Math.sqrt(zoomModes.week*zoomModes.month))return 'scene';
 if(zoom>=Math.sqrt(zoomModes.month*zoomModes.year))return 'episode';
 return 'arc';
}
function storyNodeCast(group){return [...new Set(group.flatMap(e=>e.physical||[]))];}
function semanticNodes(level,allScenes){
 if(level==='moment'){
  const result=[];
  for(let si=0;si<allScenes.length;si++){
   const s=allScenes[si],scene=sceneMap.get(s.id),count=s.group.length;
   const prev=allScenes[si-1],next=allScenes[si+1],gaps=[
    prev?.day===s.day?s.position-prev.position:null,
    next?.day===s.day?next.position-s.position:null
   ].filter(g=>g>1e-8);
   const nearestGap=gaps.length?Math.min(...gaps):.18;
   // Keep a scene's moments inside its own chronological slot. The old fixed
   // spread could make neighbouring scenes overlap in X, so strand() received
   // anchors out of order and could drop a real event node from the line.
   const spread=Math.min(.055,.36/Math.max(2,count),nearestGap*.72/Math.max(1,count-1));
   s.group.forEach((e,i)=>{
    const day=clamp(s.position+(i-(count-1)/2)*spread,s.day+.02,s.day+.98),layoutCast=[...new Set(e.physical||[])];
    result.push({id:e.id,kind:'moment',title:e.title,scene,group:[e],day,calendarDay:s.day,cast:layoutCast.filter(id=>selected.has(id)),layoutCast,locationId:e.location_id||scene?.location_id||null,childCount:1,sourceSceneIds:[s.id],sourceEpisodeIds:scene?.episode_id?[scene.episode_id]:[]});
   });
  }
  return result;
 }
 if(level==='scene')return allScenes.map(s=>{const scene=sceneMap.get(s.id),layoutCast=sceneCast(scene,s.group);return {id:s.id,kind:'scene',title:scene?.title||s.group[0]?.scene_title||s.id,scene,group:s.group,day:s.position,calendarDay:s.day,cast:layoutCast.filter(id=>selected.has(id)),layoutCast,locationId:scene?.location_id||null,childCount:s.group.length,sourceSceneIds:[s.id],sourceEpisodeIds:scene?.episode_id?[scene.episode_id]:[]};});
 const episodeBuckets=new Map();
 for(const s of allScenes){
  const scene=sceneMap.get(s.id),episodeId=scene?.episode_id||'scene:'+s.id;
  if(!episodeBuckets.has(episodeId))episodeBuckets.set(episodeId,[]);
  episodeBuckets.get(episodeId).push(s);
 }
 const episodeNodes=[...episodeBuckets].map(([id,scenes])=>{
  const meta=episodeMap.get(id)||null,group=scenes.flatMap(s=>s.group),layoutCast=storyNodeCast(group),days=scenes.map(s=>s.position),sourceSceneIds=scenes.map(s=>s.id);
  return {id:'episode:'+id,rawId:id,kind:'episode',title:meta?.title||sceneMap.get(scenes[0].id)?.title||id,story:meta,group,day:(Math.min(...days)+Math.max(...days))/2,calendarDay:scenes[0].day,cast:layoutCast.filter(x=>selected.has(x)),layoutCast,locationId:null,childCount:scenes.length,sourceSceneIds,sourceEpisodeIds:meta?[id]:[]};
 });
 if(level==='episode')return episodeNodes;
 const arcBuckets=new Map();
 for(const ep of episodeNodes){
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
function nav(){const list=orderedScenes().flatMap(s=>s.group).filter(e=>e.day!==null&&(focusedCharacter?e.tracks.includes(focusedCharacter):relevant(e))),i=list.findIndex(e=>e.id===anchorEvent),next=list.findIndex(e=>e.day>=Math.floor(center));return {previous:i>=0?list[i-1]||null:next<0?list.at(-1)||null:list[next-1]||null,next:i>=0?list[i+1]||null:next<0?null:list[next],index:i,total:list.length};}
function stepEvent(direction){const target=nav()[direction<0?'previous':'next'];if(target)navigateEvent(target.id);}
function setFocus(id){focusedCharacter=focusedCharacter===id?null:id;if(focusedCharacter)selected.add(id);closeCard();closePanels();$('canvas').scrollTop=0;renderCharacters();render();}
function updateFocusBar(){const bar=$('focusBar');bar.hidden=!focusedCharacter;if(!focusedCharacter)return;const n=nav();$('focusName').textContent=fullName(focusedCharacter);$('focusPosition').textContent=n.index>=0?`${n.index+1} / ${n.total}`:`${n.total} подій`;$('focusPrevious').disabled=!n.previous;$('focusNext').disabled=!n.next;}
function selectionChanged(){if(focusedCharacter&&!selected.has(focusedCharacter))focusedCharacter=null;closeCard();renderCharacters();render();}
function range(){return [Math.max(0,center-182.5/zoom),Math.min(365,center+182.5/zoom)];}
function svg(tag,attrs,parent=$('timeline')){const e=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));parent.append(e);return e;}
function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(render);}
let hoverCloseTimer=null,hoverCard=false;
let previewEventId=null,previewPinned=false,previewCloseTimer=null;
function cancelHoverClose(){clearTimeout(hoverCloseTimer);hoverCloseTimer=null;}
function deferHoverClose(){cancelHoverClose();if(hoverCard)hoverCloseTimer=setTimeout(()=>{if(hoverCard)closeCard();},320);}
function canHover(e){return e.pointerType!=='touch'&&(!window.matchMedia||window.matchMedia('(any-hover: hover)').matches);}
function paintNodes(){const p=graphNodes.find(p=>p.id===focusId);document.querySelectorAll('.node').forEach(g=>{const active=g.dataset.event===focusId;g.classList.toggle('is-open',active);g.querySelector('.mark')?.setAttribute('fill',active?'#365d92':'#fbfcfe');});document.querySelectorAll('.thread').forEach(line=>{const member=!!p&&p.cast.includes(line.dataset.character);line.classList.toggle('is-scene-member',member);line.classList.toggle('is-scene-muted',!!p&&!member);});}
function openNode(p,pin=false){cancelHoverClose();if(focusId===p.id&&!$('eventCard').hidden){if(pin)hoverCard=false;return;}closePanels();hoverCard=!pin;focusId=p.id;anchorDay=p.day;anchorEvent=p.kind==='moment'?p.group[0]?.id:null;if(p.kind==='moment')showEvent(p.group[0]);else if(p.kind==='scene')showSceneCard(p.scene,p.group);else showStoryGroup(p);positionCard(p);$('hoverTip').hidden=true;paintNodes();updateFocusBar();}
function closeCard(){cancelHoverClose();closeEventPreview(true);hoverCard=false;focusId=null;anchorDay=null;anchorEvent=null;$('eventCard').hidden=true;$('hoverTip').hidden=true;schedule();}
function setZoom(value,pivot=center){const old=zoom;zoom=clamp(value,1,730);center=pivot+(center-pivot)*old/zoom;center=clamp(center,182.5/zoom,365-182.5/zoom);$('hoverTip').hidden=true;schedule();}
function closePanels(except){for(const id of ['linesPanel','searchPanel','periodPanel'])if(id!==except){$(id).hidden=true;$(id.replace('Panel','Button')).setAttribute('aria-expanded','false');}}
function togglePanel(id){const opening=$(id).hidden;closePanels(id);$(id).hidden=!opening;$(id.replace('Panel','Button')).setAttribute('aria-expanded',String(opening));if(opening){closeEventPreview(true);$('eventCard').hidden=true;$('hoverTip').hidden=true;const input=$(id).querySelector('input');if(input)input.focus();}}
function renderCharacters(){
 const counts=new Map();events().forEach(e=>e.tracks.forEach(id=>counts.set(id,(counts.get(id)||0)+1)));const q=$('characterSearch').value.toLowerCase().trim();
 $('characterList').innerHTML=selectable().filter(e=>(fullName(e.id)+' '+e.name+' '+(e.aliases||[]).join(' ')).toLowerCase().includes(q)).sort((a,b)=>(defaults.includes(b.id)-defaults.includes(a.id))||fullName(a.id).localeCompare(fullName(b.id),'uk')).map(e=>`<div class="character ${focusedCharacter===e.id?'is-focused':''}"><label class="character-check"><input type="checkbox" value="${esc(e.id)}" aria-label="Показати лінію ${esc(fullName(e.id))}" ${selected.has(e.id)?'checked':''}><span class="swatch" style="background:${color(e.id)}"></span></label><button class="character-name" data-focus-character="${esc(e.id)}" aria-pressed="${focusedCharacter===e.id}" title="Зосередитися на лінії">${esc(fullName(e.id))}</button><span class="count">${counts.get(e.id)}</span><button class="profile-arrow" data-profile="${esc(e.id)}" aria-label="Профіль: ${esc(fullName(e.id))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button></div>`).join('')||'<p class="empty">Персонажа не знайдено.</p>';
 $('characterList').querySelectorAll('input').forEach(i=>i.addEventListener('change',()=>{i.checked?selected.add(i.value):selected.delete(i.value);selectionChanged();}));
 $('characterList').querySelectorAll('[data-focus-character]').forEach(b=>b.addEventListener('click',()=>setFocus(b.dataset.focusCharacter)));
 $('characterList').querySelectorAll('[data-profile]').forEach(b=>b.addEventListener('click',()=>openProfile(b.dataset.profile,b)));
 const all=selectable();$('selectAll').disabled=all.every(e=>selected.has(e.id));$('deselectAll').disabled=!selected.size;
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
 const allEvents=events().filter(e=>e.day!==null),ids=[...selected].sort((a,b)=>(defaults.indexOf(a)>=0?defaults.indexOf(a):99)-(defaults.indexOf(b)>=0?defaults.indexOf(b):99)||fullName(a).localeCompare(fullName(b),'uk'));
 const n=ids.length,overview=zoom<3,h=viewport,mid=viewport*.59,amplitude=clamp((viewport-220)*.25,24,150)*(overview?.08:1),level=semanticLevel();
 timeline.style.height=h+'px';timeline.setAttribute('viewBox',`0 0 ${w} ${h}`);axis.setAttribute('viewBox',`0 0 ${w} 40`);
 const px=day=>pad+(day-lo)/(hi-lo)*plot,allScenes=orderedScenes().filter(s=>s.day!==null);
 const baseNodes=semanticNodes(level,allScenes).filter(p=>p.day!==null).map(p=>({...p,x:px(p.day)})),owner=semanticOwner(baseNodes),nodeY=TimelineCore.sceneLayout(baseNodes,chronologyRelations(),owner,mid,amplitude);
 const globalNodes=baseNodes.map(p=>({...p,y:nodeY.get(p.id)??mid}));
 const linked=(p,id)=>p.cast.includes(id)||(id===focusedCharacter&&p.group.some(e=>e.tracks.includes(id)));
 graphNodes=globalNodes.filter(p=>p.day>=lo&&p.day<hi&&p.group.some(e=>focusedCharacter?e.tracks.includes(focusedCharacter):relevant(e)));
 timeline.replaceChildren();axis.replaceChildren();$('linesCount').textContent=`Лінії · ${selected.size}`;
 // Alternating calendar days, including empty days; boundaries use actual day values.
 if(plot/(hi-lo)>=2)for(let day=Math.floor(lo);day<Math.ceil(hi);day++){if(day%2===1)svg('rect',{x:clamp(px(day),0,w),y:0,width:Math.max(0,clamp(px(day+1),0,w)-clamp(px(day),0,w)),height:h,class:'day-band','data-day':day});}
 const activeMode=currentZoomMode(),label=overview?'Рік 0':activeMode==='day'?`${dateText(center,true)} · Рік 0`:`${dateText(lo)} — ${dateText(hi-.01)} · Рік 0`;$('periodButton').textContent=label;
 document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===activeMode)));
 const ticks=zoom<8?starts.map((d,i)=>({day:d,text:months[i].slice(0,3)})):Array.from({length:Math.ceil(hi)-Math.floor(lo)+1},(_,i)=>({day:Math.floor(lo)+i,text:dateText(Math.floor(lo)+i)})),step=zoom<8?1:Math.max(1,Math.ceil(ticks.length/(plot/75)));
 ticks.forEach((t,i)=>{if(t.day<lo||t.day>=hi||i%step)return;svg('line',{x1:px(t.day),x2:px(t.day),y1:5,y2:10,stroke:'#bfcbdc'},axis);const txt=svg('text',{x:px(t.day),y:28,'text-anchor':'middle'},axis);txt.textContent=t.text;});
 const labelPositions=[],defs=svg('defs',{}),lead=clamp((hi-lo)*.18,.08,4);
 ids.forEach(id=>{
  const anchors=globalNodes.filter(p=>linked(p,id)).map(p=>({day:p.day,y:p.y,id:p.id})).sort((a,b)=>a.day-b.day||a.id.localeCompare(b.id));
  if(!anchors.length||anchors[0].day-lead>hi||anchors.at(-1).day+lead<lo)return;
  const route=TimelineCore.avoid(TimelineCore.strand(anchors,id,mid,amplitude,lead,plot/(hi-lo)),graphNodes.filter(p=>!linked(p,id)),id,30);
  const coordinates=route.map(p=>({x:px(p.day),y:p.y,node:p.node,flat:p.flat}));
  const d=smoothPath(coordinates),dim=focusedCharacter&&focusedCharacter!==id;
  const gradient=svg('linearGradient',{id:'strand-'+id,gradientUnits:'userSpaceOnUse',x1:px(route[0].day),x2:px(route.at(-1).day),y1:0,y2:0},defs),fade=Math.min(.45,lead*.65/Math.max(.001,route.at(-1).day-route[0].day));
  for(const [offset,opacity] of [[0,0],[fade,1],[1-fade,1],[1,0]])svg('stop',{offset,'stop-color':color(id),'stop-opacity':opacity},gradient);
  svg('path',{d,class:'thread',stroke:`url(#strand-${id})`,'stroke-width':id===focusedCharacter?3:overview?1.5:n>24?1.2:2.1,opacity:dim?'.12':n>24?'.35':'.85','data-character':id});
  const hit=svg('path',{d,class:'thread-hit',stroke:'transparent','stroke-width':14,role:'button',tabindex:overview&&n>20?-1:0,'aria-label':`Зосередитися: ${fullName(id)}`,'aria-pressed':id===focusedCharacter,'data-character':id});
  hit.addEventListener('click',()=>setFocus(id));hit.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setFocus(id);}});
  if(!overview&&(focusedCharacter?id===focusedCharacter:n<=18)){
   const labelDay=Math.max(lo,route[0].day),labelX=px(labelDay),actualY=TimelineCore.curveY(route,labelDay);let labelY=actualY-12;while(labelPositions.some(y=>Math.abs(y-labelY)<16))labelY-=16;labelPositions.push(labelY);
   if(Math.abs(labelY-(actualY-12))>1)svg('line',{x1:labelX+2,x2:labelX+2,y1:actualY-3,y2:labelY+3,stroke:color(id),'stroke-width':.6,opacity:.5});
   const text=svg('text',{x:labelX+6,y:labelY,class:'line-label',role:'button',tabindex:0,'aria-label':`Зосередитися: ${fullName(id)}`,style:`fill:${color(id)};font-size:12px`});text.textContent=name(id);text.addEventListener('click',()=>setFocus(id));text.addEventListener('keydown',e=>{if(e.key==='Enter')setFocus(id);});
  }
 });
 graphNodes.forEach(p=>{
  const kindLabel={moment:'Момент',scene:'Сцена',episode:'Епізод',arc:'Арка'}[p.kind]||'Вузол',label=`${kindLabel}: ${p.title}${p.kind==='moment'?'':` · ${p.childCount}`}`,g=svg('g',{class:'node '+p.kind+'-node'+(focusId===p.id?' is-open':''),tabindex:0,role:'button','aria-label':label,'aria-haspopup':'dialog','data-event':p.id,'data-scene':p.kind==='scene'?(p.scene?.id||''):''});
  svg('circle',{class:'target',cx:p.x,cy:p.y,r:16},g);svg('circle',{class:'mark',cx:p.x,cy:p.y,r:p.kind==='moment'?5:(p.childCount>1?8:5),fill:focusId===p.id?'#365d92':'#fbfcfe',stroke:p.cast.length===1?color(p.cast[0]):'#889eb9','stroke-width':1.5},g);
  if(p.kind!=='moment'&&p.childCount>1){const count=svg('text',{class:'scene-count',x:p.x,y:p.y+3,'text-anchor':'middle',fill:focusId===p.id?'white':'#526981'},g);count.textContent=p.childCount>99?'99+':p.childCount;}
  g.addEventListener('click',()=>openNode(p,true));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openNode(p,true);}});
  g.addEventListener('pointerenter',e=>{if(canHover(e))openNode(p);});g.addEventListener('pointerover',e=>{if(canHover(e)&&!g.contains(e.relatedTarget))openNode(p);});g.addEventListener('pointerleave',deferHoverClose);g.addEventListener('focus',()=>openNode(p));

 });
 if(!selected.size){const t=svg('text',{x:w/2,y:mid,'text-anchor':'middle'});t.textContent='Обери персонажів у меню «Лінії»';}
 if(!$('eventCard').hidden){const a=graphNodes.find(p=>p.id===focusId);if(a)positionCard(a);else $('eventCard').hidden=true;}
 paintNodes();updateFocusBar();
}
function positionCard(point){
 const card=$('eventCard'),canvas=$('canvas'),w=canvas.clientWidth||1000,y=point.y-canvas.scrollTop,width=Math.min(480,w-24),left=clamp(point.x,width/2+12,w-width/2-12);
 card.hidden=false;card.style.left=left+'px';card.style.top=(y-16)+'px';card.style.setProperty('--tail-x',(point.x-left+width/2)+'px');card.style.setProperty('--card-height',Math.max(70,Math.min(520,y-32))+'px');
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
 clearTimeout(previewCloseTimer);previewCloseTimer=null;previewEventId=null;previewPinned=false;
 const preview=$('eventPreview');if(preview){preview.classList.remove('is-visible');preview.hidden=true;}
 document.querySelectorAll('.scene-actions li.is-preview-active').forEach(li=>li.classList.remove('is-preview-active'));
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
 const previewHeight=Math.min(preview.scrollHeight||480,vh-24);
 preview.style.top=clamp(cardRect.top,12,Math.max(12,vh-previewHeight-12))+'px';
}
function bindEventPreview(){
 const preview=ensureEventPreview(),content=$('eventPreviewContent');
 content.querySelectorAll('[data-close-preview]').forEach(b=>b.addEventListener('click',()=>closeEventPreview(true)));
 content.querySelectorAll('[data-preview-event]').forEach(b=>b.addEventListener('click',()=>showEventPreview(b.dataset.previewEvent,true)));
 content.querySelectorAll('[data-event-focus-character]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.eventFocusCharacter;if(focusedCharacter!==id)setFocus(id);}));
 content.querySelectorAll('[data-open-scene]').forEach(b=>b.addEventListener('click',()=>openScene(b.dataset.openScene,b)));
 preview.addEventListener('keydown',e=>{if(e.key==='Escape')closeEventPreview(true);},{once:true});
}
function bindSceneActionPreviews(){
 $('cardContent').querySelectorAll('[data-scene-preview]').forEach(li=>{
  const id=li.dataset.scenePreview;
  li.addEventListener('pointerenter',e=>{clearTimeout(previewCloseTimer);if(canHover(e))showEventPreview(id,false);});
  li.addEventListener('pointerleave',scheduleEventPreviewClose);
  li.addEventListener('focusin',()=>showEventPreview(id,false));
  li.addEventListener('focusout',e=>{if(!li.contains(e.relatedTarget))scheduleEventPreviewClose();});
  li.addEventListener('click',()=>showEventPreview(id,true));
  li.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showEventPreview(id,true);}});
 });
}
function bindCard(){
 $('cardContent').querySelectorAll('[data-card-event]').forEach(b=>b.addEventListener('click',()=>navigateEvent(b.dataset.cardEvent)));
 $('cardContent').querySelectorAll('[data-story-episode]').forEach(b=>b.addEventListener('click',()=>navigateEpisodeLevel(b.dataset.storyEpisode)));
 $('cardContent').querySelectorAll('[data-story-scene]').forEach(b=>b.addEventListener('click',()=>navigateSceneLevel(b.dataset.storyScene)));
 $('cardContent').querySelectorAll('[data-step-event]').forEach(b=>b.addEventListener('click',()=>stepEvent(+b.dataset.stepEvent)));
 $('cardContent').querySelectorAll('[data-event-focus-character]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.eventFocusCharacter;if(focusedCharacter!==id)setFocus(id);}));
 $('cardContent').querySelectorAll('[data-close-card]').forEach(b=>b.addEventListener('click',closeCard));
 $('cardContent').querySelectorAll('[data-open-scene]').forEach(b=>b.addEventListener('click',()=>openScene(b.dataset.openScene,b)));
 $('cardContent').querySelectorAll('[data-step-scene]').forEach(b=>b.addEventListener('click',()=>stepScene(+b.dataset.stepScene)));
}
function navigateEpisodeLevel(id){
 const episode=episodeMap.get(id);if(!episode)return;const scenes=(episode.scene_ids||[]).map(id=>sceneMap.get(id)).filter(Boolean),days=scenes.map(s=>s.day).filter(d=>d!==null);
 if(days.length)center=clamp((Math.min(...days)+Math.max(...days))/2+.5,.5,364.5);zoom=zoomModes.month;closeCard();render();const node=graphNodes.find(p=>p.kind==='episode'&&p.rawId===id);if(node)openNode(node,true);
}
function navigateSceneLevel(id){
 const scene=sceneMap.get(id);if(!scene||scene.day===null)return;center=clamp(scene.day+.5,.5,364.5);zoom=zoomModes.week;closeCard();render();const node=graphNodes.find(p=>p.kind==='scene'&&p.id===id);if(node)openNode(node,true);
}
function cardTop(day,navigation,kind='event',openSceneId=null){
 const arrow=(direction,label)=>`<button class="card-arrow" data-step-${kind}="${direction}" aria-label="${label}" title="${label}" ${navigation[direction<0?'previous':'next']?'':'disabled'}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${direction<0?'m14 6-6 6 6 6':'m10 6 6 6-6 6'}"/></svg></button>`;
 const openScene=openSceneId?`<button class="card-open-scene" data-open-scene="${esc(openSceneId)}" aria-label="Читати сцену цілком" data-tooltip="Читати сцену цілком"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M10 7h7v7"/></svg></button>`:'';
 return `<div class="card-top"><span class="card-date">${esc(dateText(day,true))}${day!==null?' · Рік 0':''}</span><div class="card-top-actions">${openScene}<nav class="card-arrows" aria-label="Перехід між ${kind==='scene'?'сценами':'подіями'}">${arrow(-1,'Назад')}${arrow(1,'Далі')}</nav><button class="close" data-close-card aria-label="Закрити подію" title="Закрити">×</button></div></div>`;
}
function sceneNavigation(id){const list=orderedScenes().filter(s=>s.group.some(e=>focusedCharacter?e.tracks.includes(focusedCharacter):relevant(e))),i=list.findIndex(s=>s.id===id);return {previous:list[i-1]||null,next:list[i+1]||null};}
function stepScene(direction){const target=sceneNavigation(focusId)[direction<0?'previous':'next'];if(target)navigateScene(target.id);}
function navigateScene(id){const group=sceneEvents(id);if(!group.length)return;const e=group.find(e=>focusedCharacter?e.tracks.includes(focusedCharacter):relevant(e))||group[0];navigateEvent(e.id);anchorEvent=null;focusId=id;showSceneCard(sceneMap.get(id),group);render();}
function showSceneCard(scene,group){
 closeEventPreview(true);
 const cast=sceneCast(scene,group);
 $('cardContent').innerHTML=`${cardTop(group[0].day,sceneNavigation(scene.id),'scene',scene.id)}<h2>${esc(scene.title)}</h2><p class="scene-location">${esc(name(scene.location_id))} · ${actionCount(group.length)}</p>${cast.length?`<div class="people scene-people">${cast.map(id=>`<button class="person" data-event-focus-character="${esc(id)}" aria-label="Зосередитися на лінії ${esc(name(id))}" title="Зосередитися на лінії"><span class="swatch" style="background:${color(id)}"></span>${esc(name(id))}</button>`).join('')}</div>`:''}<ol class="scene-actions">${group.map(e=>`<li data-scene-preview="${esc(e.id)}" tabindex="0" role="button" aria-haspopup="dialog" aria-label="Переглянути дію: ${esc(e.title)}"><div>${eventGallery(e)}<div class="scene-action-title">${esc(e.title)}</div></div></li>`).join('')}</ol>`;
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
 $('cardContent').innerHTML=`<div class="card-top"><span class="card-date">${esc(range)} · Рік 0</span><button class="close" data-close-card aria-label="Закрити">×</button></div><p class="card-meta">${kind}</p><h2>${esc(point.title)}</h2>${point.story?.description?`<p class="event-text">${esc(point.story.description)}</p>`:''}<p class="scene-location">${point.kind==='arc'?`${point.childCount} епізодів`:`${point.childCount} сцен`} · ${point.group.length} моментів</p><div class="story-children">${children.map(child=>`<button class="result" ${point.kind==='arc'?`data-story-episode="${esc(child.id)}"`:`data-story-scene="${esc(child.id)}"`}><strong>${esc(child.title)}</strong><small>${esc(child.meta)}</small></button>`).join('')}</div>`;
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
 $('cardContent').innerHTML=`${cardTop(e.day,navigation)}${eventDetailsHtml(e,'data-card-event')}`;
 bindCard();
}
function showEventPreview(id,pin=false){
 const e=eventMap.get(id);if(!e)return;
 if(previewPinned&&!pin&&previewEventId!==id)return;
 const preview=ensureEventPreview();
 previewEventId=id;if(pin)previewPinned=true;
 $('eventPreviewContent').innerHTML=`<div class="preview-top"><span class="card-date">${esc(dateText(e.day,true))}${e.day!==null?' · Рік 0':''}</span><button class="close" data-close-preview aria-label="Закрити опис події" title="Закрити">×</button></div>${eventDetailsHtml(e,'data-preview-event',false)}`;
 preview.hidden=false;
 document.querySelectorAll('.scene-actions li').forEach(li=>li.classList.toggle('is-preview-active',li.dataset.scenePreview===id));
 positionEventPreview();bindEventPreview();
 preview.classList.remove('is-visible');requestAnimationFrame(()=>preview.classList.add('is-visible'));
}
function navigateEvent(id){cancelHoverClose();hoverCard=false;const e=eventMap.get(id);if(!e)return;if(focusedCharacter&&!e.tracks.includes(focusedCharacter))focusedCharacter=null;continuity=e.continuity;$('continuity').value=continuity;if(!relevant(e))e.tracks.forEach(id=>selected.add(id));renderCharacters();closePanels();if(e.day!==null){zoom=365;center=clamp(e.day+.5,.5,364.5);}focusId=e.id;anchorEvent=e.id;showEvent(e);render();const anchor=graphNodes.find(p=>p.id===e.id);if(anchor){$('canvas').scrollTop=Math.max(0,anchor.y-($('canvas').clientHeight||700)*.7);positionCard(anchor);}else positionCard({x:($('canvas').clientWidth||1000)/2,y:($('canvas').clientHeight||700)*.7});updateFocusBar();}
function search(){const q=$('eventSearch').value.trim().toLowerCase();const found=events().filter(e=>!q||(e.title+' '+e.text).toLowerCase().includes(q));$('searchResults').innerHTML=found.slice(0,searchLimit).map(e=>`<button class="result" data-search-event="${esc(e.id)}">${esc(e.title)}<small>${dateText(e.day)}</small></button>`).join('')||'<p class="empty">Подій не знайдено.</p>';$('searchResults').querySelectorAll('[data-search-event]').forEach(b=>b.addEventListener('click',()=>navigateEvent(b.dataset.searchEvent)));$('moreResults').hidden=found.length<=searchLimit;}
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
 track.querySelectorAll('[data-character-timeline-event]').forEach(b=>b.addEventListener('click',()=>{closeCharacterEvents();navigateEvent(b.dataset.characterTimelineEvent);}));
 track.querySelectorAll('[data-event-focus-character]').forEach(b=>b.addEventListener('click',()=>{const target=b.dataset.eventFocusCharacter;closeCharacterEvents();closeProfile();if(focusedCharacter!==target)setFocus(target);}));
 track.querySelectorAll('[data-open-scene]').forEach(b=>b.addEventListener('click',()=>{const scene=b.dataset.openScene;closeCharacterEvents();openScene(scene,b);}));
 dialog.hidden=false;if(!dialog.open){if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');}
 requestAnimationFrame(()=>{track.scrollLeft=0;$('closeCharacterEvents').focus();});
}
function closeCharacterEvents(){
 const dialog=$('characterEventsDialog');if(dialog.hidden)return;
 if(dialog.close)dialog.close();else dialog.removeAttribute('open');
 dialog.hidden=true;characterEventsEntity=null;const target=characterEventsReturnFocus;characterEventsReturnFocus=null;target?.focus();
}
function renderProfile(){
 const entity=entityMap.get(profileEntity);if(!entity)return;const profile=profileMap.get(profileEntity),versions=profile?.versions?.length?profile.versions:[{id:'general',label:'Профіль'}];if(!versions.some(v=>v.id===profileVersion))profileVersion=versions[0].id;
 const version=versions.find(v=>v.id===profileVersion),associated=TimelineCore.ordered(events().filter(e=>e.tracks.includes(profileEntity))),dated=associated.filter(e=>e.day!==null),memberships=(data.memberships||[]).filter(m=>m.entity_id===profileEntity||m.person_id===profileEntity||m.member_id===profileEntity);
 $('profileTitle').textContent=fullName(profileEntity);$('profileTabs').innerHTML=versions.map(v=>`<button id="tab-${esc(v.id)}" role="tab" aria-selected="${v.id===profileVersion}" aria-controls="profileContent" tabindex="${v.id===profileVersion?0:-1}" data-profile-version="${esc(v.id)}">${esc(v.label)}</button>`).join('');$('profileContent').setAttribute('aria-labelledby','tab-'+version.id);
 const paragraphs=text=>String(text||'').split(/\n\s*\n/).filter(Boolean).map(p=>`<p>${esc(p)}</p>`).join('');
 $('profileContent').innerHTML=`${version.image?`<img class="profile-image" src="${esc(version.image)}" alt="${esc(version.image_alt||fullName(profileEntity))}" loading="lazy">`:''}${version.age!==undefined?`<p class="profile-age">${version.age} років</p>`:''}${version.summary?paragraphs(version.summary):'<p class="empty">Профіль цього віку ще не заповнений.</p>'}${(version.facts||[]).length?`<dl class="profile-facts">${version.facts.map(f=>`<div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join('')}</dl>`:''}${(version.sections||[]).map(section=>`<section class="profile-section"><h3>${esc(section.title)}</h3>${paragraphs(section.text)}</section>`).join('')}<section class="profile-section"><h3>У хронології</h3>${memberships.length?`<p>${memberships.map(m=>esc(name(m.team_id||m.group_id))).join(', ')}</p>`:''}<div class="profile-actions"><button id="followCharacter" class="profile-follow">Зосередитися на лінії</button><button id="openCharacterEvents" class="profile-follow profile-timeline-button">${associated.length} подій</button></div></section>`;
 $('profileTabs').querySelectorAll('[data-profile-version]').forEach((b,i)=>{b.addEventListener('click',()=>{profileVersion=b.dataset.profileVersion;renderProfile();$('profileTabs').querySelector('[aria-selected="true"]').focus();});b.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const index=e.key==='Home'?0:e.key==='End'?versions.length-1:(i+(e.key==='ArrowRight'?1:-1)+versions.length)%versions.length;profileVersion=versions[index].id;renderProfile();$('profileTabs').querySelector('[aria-selected="true"]').focus();});});
 $('openCharacterEvents').addEventListener('click',e=>openCharacterEvents(profileEntity,e.currentTarget));
 $('followCharacter').addEventListener('click',()=>{const id=profileEntity;closeProfile();if(focusedCharacter===id){closePanels();render();}else setFocus(id);});
}
function ingest(next,initial=false){
 const wasAll=data&&selectable().every(e=>selected.has(e.id));
 data=next;entityMap=new Map(data.entities.map(e=>[e.id,e]));eventMap=new Map(data.events.map(e=>[e.id,e]));sceneMap=new Map(data.scenes.map(s=>[s.id,s]));episodeMap=new Map((data.episodes||[]).map(e=>[e.id,e]));arcMap=new Map((data.arcs||[]).map(a=>[a.id,a]));evidenceMap=new Map(data.sources.evidence.map(e=>[e.id,e]));sourceMap=new Map(data.sources.sources.map(s=>[s.id,s]));profileMap=new Map((data.profiles||[]).map(p=>[p.entity_id,p]));
 if(initial||wasAll)selected=new Set(selectable().map(e=>e.id));else selected=new Set([...selected].filter(id=>entityMap.has(id)));if(focusedCharacter&&!entityMap.has(focusedCharacter))focusedCharacter=null;if(anchorEvent&&!eventMap.has(anchorEvent))closeCard();
 $('revision').textContent=`Дані: ${data.revision.slice(0,8)}`;$('sourceLink').href=`https://github.com/DSMykyta/Konoha-Gaiden-Chronicles/tree/${data.revision}/${data.base}`;
}
let refreshing=false;
async function refreshData(){
 if(refreshing||document.visibilityState==='hidden'||window.__TIMELINE_DATA__)return;refreshing=true;
 try{const v=await fetch(`version.json?t=${Date.now()}`,{cache:'no-store'});if(!v.ok)return;const version=await v.json();if(version.revision===data.revision)return;const response=await fetch(`data.json?v=${encodeURIComponent(version.revision)}`,{cache:'no-store'});if(!response.ok)return;const next=await response.json();ingest(next);renderCharacters();search();if(anchorEvent&&eventMap.has(anchorEvent)&&!$('eventCard').hidden)showEvent(eventMap.get(anchorEvent));if(profileEntity)renderProfile();if(sceneId)renderScene();if(!anchorEvent&&sceneMap.has(focusId)&&!$('eventCard').hidden)showSceneCard(sceneMap.get(focusId),sceneEvents(focusId));render();}catch{}finally{refreshing=false;}
}
async function init(){
 try{const response=window.__TIMELINE_DATA__?{ok:true,json:async()=>window.__TIMELINE_DATA__}:await fetch(`data.json?t=${Date.now()}`,{cache:'no-store'});if(!response.ok)throw new Error('Не вдалося завантажити хронологію.');ingest(await response.json(),true);$('status').hidden=true;
 const names={'alt-shippuden-469':'Альтернатива · обличчя Какаші','alt-movie-land-of-snow':'Альтернатива · Країна Снігу'};[...new Set(data.events.map(e=>e.continuity))].filter(c=>c!=='main').forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=names[c]||c;$('continuity').append(o);});
 for(const id of ['lines','search','period'])$(id+'Button').addEventListener('click',()=>{togglePanel(id+'Panel');if(id==='search')search();});document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>{closePanels();}));
 $('characterSearch').addEventListener('input',renderCharacters);$('selectAll').addEventListener('click',()=>{selected=new Set(selectable().map(e=>e.id));selectionChanged();});$('deselectAll').addEventListener('click',()=>{selected.clear();selectionChanged();});document.querySelectorAll('[data-team]').forEach(b=>b.addEventListener('click',()=>{selected=new Set(teams[b.dataset.team]);focusedCharacter=null;selectionChanged();}));
 $('eventSearch').addEventListener('input',()=>{searchLimit=30;search();});$('moreResults').addEventListener('click',()=>{searchLimit+=30;search();});
 $('continuity').addEventListener('change',()=>{continuity=$('continuity').value;focusedCharacter=null;selected=new Set(selectable().map(e=>e.id));selectionChanged();search();});
 $('closeCharacterEvents').addEventListener('click',closeCharacterEvents);
 $('characterEventsDialog').addEventListener('cancel',e=>{e.preventDefault();closeCharacterEvents();});
 let characterWheelLocked=false;
 $('characterEventsDialog').addEventListener('wheel',e=>{
  const track=$('characterEventsTrack');if($('characterEventsDialog').hidden||!track)return;
  const dominant=Math.abs(e.deltaY)>=Math.abs(e.deltaX)?e.deltaY:e.deltaX;if(!dominant)return;
  e.preventDefault();
  if(characterWheelLocked)return;
  const card=track.querySelector('.character-event-card');
  const style=getComputedStyle(track),gap=parseFloat(style.columnGap||style.gap)||0;
  const step=(card?.getBoundingClientRect().width||track.clientWidth*.8)+gap;
  characterWheelLocked=true;
  track.scrollTo({left:track.scrollLeft+Math.sign(dominant)*step,behavior:'smooth'});
  setTimeout(()=>{characterWheelLocked=false;},180);
 },{passive:false,capture:true});
 $('dateForm').addEventListener('submit',e=>{e.preventDefault();const m=$('dateInput').value.trim().match(/^(\d{1,2})[./](\d{1,2})$/);if(!m||+m[2]<1||+m[2]>12||+m[1]<1||+m[1]>lengths[+m[2]-1]){$('dateError').textContent='Введи дату у форматі 22.01.';$('dateError').hidden=false;return;}$('dateError').hidden=true;zoom=365;center=starts[+m[2]-1]+(+m[1]-1)+.5;closePanels();closeCard();});
 document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setZoom(zoomModes[b.dataset.mode])));$('zoomIn').addEventListener('click',()=>setZoom(zoom*2));$('zoomOut').addEventListener('click',()=>setZoom(zoom/2));$('fit').addEventListener('click',()=>setZoom(zoomModes.year));
 for(const [id,s] of [['previous',-1],['next',1]])$(id).addEventListener('click',()=>{closeCard();const mode=currentZoomMode(),preset=zoomModes[mode],isPreset=Math.abs(Math.log(zoom/preset))<.03,step=isPreset?365/preset:365/zoom*.7;center=clamp(center+s*step,182.5/zoom,365-182.5/zoom);schedule();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('characterEventsDialog').hidden){e.preventDefault();closeCharacterEvents();return;}if(!$('sceneDialog').hidden){e.preventDefault();closeScene();return;}if(!$('profileDialog').hidden){e.preventDefault();closeProfile();return;}closePanels();closeCard();if(focusedCharacter){focusedCharacter=null;render();}}});document.addEventListener('pointerdown',e=>{if(!e.target.closest('.panel,.tools,.period,.scene-dialog'))closePanels();if(!e.target.closest('.event-card,.event-preview,.node,.thread-hit,.line-label,.focus-bar,.profile-dialog,.character-events-dialog,.scene-dialog,.time-controls,.panel,.tools,.period'))closeCard();});
 const canvas=$('timeline'),touches=new Map();let drag=null,pinch=null;
 canvas.addEventListener('wheel',e=>{e.preventDefault();const box=canvas.getBoundingClientRect(),pad=box.width<600?22:48,t=clamp((e.clientX-box.left-pad)/(box.width-pad*2),0,1),[lo,hi]=range();setZoom(zoom*Math.exp(-clamp(e.deltaY,-100,100)*.007),lo+t*(hi-lo));},{passive:false});
 canvas.addEventListener('pointerdown',e=>{if(e.target.closest('.node,.thread-hit,.line-label'))return;touches.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);if(touches.size===1){drag={x:e.clientX,y:e.clientY,center,scroll:$('canvas').scrollTop};canvas.classList.add('dragging');}else if(touches.size===2){const a=[...touches.values()];pinch={distance:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),zoom};drag=null;}});
 canvas.addEventListener('pointermove',e=>{if(!touches.has(e.pointerId))return;touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pinch&&touches.size===2){const a=[...touches.values()];setZoom(pinch.zoom*Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)/Math.max(1,pinch.distance));}else if(drag){$('canvas').scrollTop=drag.scroll-(e.clientY-drag.y);center=clamp(drag.center-(e.clientX-drag.x)/(canvas.clientWidth-96)*365/zoom,182.5/zoom,365-182.5/zoom);schedule();}});
 const end=e=>{touches.delete(e.pointerId);drag=null;pinch=null;canvas.classList.remove('dragging');};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);new ResizeObserver(schedule).observe($('canvas'));
 $('canvas').addEventListener('scroll',()=>{$('hoverTip').hidden=true;const p=graphNodes.find(p=>p.id===focusId);if(p&&!$('eventCard').hidden)positionCard(p);},{passive:true});
 $('focusPrevious').addEventListener('click',()=>stepEvent(-1));$('focusNext').addEventListener('click',()=>stepEvent(1));$('focusName').addEventListener('click',()=>openProfile(focusedCharacter,$('focusName')));$('clearFocus').addEventListener('click',()=>{focusedCharacter=null;closeCard();renderCharacters();render();});
 $('eventCard').addEventListener('pointerenter',cancelHoverClose);$('eventCard').addEventListener('pointerleave',deferHoverClose);
 $('closeScene').addEventListener('click',closeScene);$('sceneDialog').addEventListener('cancel',e=>{e.preventDefault();closeScene();});
 $('closeProfile').addEventListener('click',closeProfile);$('profileDialog').addEventListener('cancel',e=>{e.preventDefault();closeProfile();});$('profileDialog').addEventListener('click',e=>{if(e.target===$('profileDialog')){const b=$('profileDialog').getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)closeProfile();}});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='hidden')refreshData();});window.addEventListener('focus',refreshData);setInterval(refreshData,60000);
 renderCharacters();render();const params=new URLSearchParams(window.location.search);if(entityMap.has(params.get('character')))setFocus(params.get('character'));if(eventMap.has(params.get('event')))navigateEvent(params.get('event'));
 }catch(e){$('status').hidden=true;$('error').textContent=e.message;$('error').hidden=false;}
}
init();
