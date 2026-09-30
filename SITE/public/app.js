'use strict';
const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
const months=['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'],gen=['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];
const lengths=[31,28,31,30,31,30,31,31,30,31,30,31],starts=lengths.map((_,i)=>lengths.slice(0,i).reduce((a,b)=>a+b,0));
const palette=['#3f80cf','#cb833e','#7462bc','#ba6487','#358b96','#7d9953','#b89442','#6687b5','#ab7cba','#67877d','#b97a73','#8b91a1'];
const defaults=['c-naruto','c-sasuke','c-sakura','c-kita','c-ren','c-sora'],teams={'team-7':['c-naruto','c-sasuke','c-sakura','c-kakashi'],'team-8':['c-hinata','c-kiba','c-shino','c-kurenai'],'team-9':['c-kita','c-ren','c-sora','c-raido']};
const origins={M:'Манґа',A:'Аніме',F:'Філер',P:'Історія проєкту',R:'Ретроспектива',V:'Фільм',N:'Новела',G:'Гра',O:'Інше'},modes={internal:'внутрішній простір',memory:'спогад',manifested:'проявлення',reanimated:'Едо Тенсей'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
let data,entityMap,eventMap,sceneMap,evidenceMap,sourceMap,profileMap,selected=new Set(),focusedCharacter=null,profileEntity=null,profileVersion=null,profileReturnFocus=null,zoom=12,center=21.5,continuity='main',focusId=null,anchorDay=null,anchorEvent=null,graphNodes=[],raf=null,searchLimit=30;
function date(day){if(day===null)return null;day=clamp(Math.floor(day),0,364);const m=starts.findLastIndex(s=>s<=day);return {d:day-starts[m]+1,m};}
function dateText(day,long=false){const a=date(day);return a?(long?`${a.d} ${gen[a.m]}`:`${String(a.d).padStart(2,'0')}.${String(a.m+1).padStart(2,'0')}`):'Без установленої дати';}
function name(id){const e=entityMap.get(id);return e?.aliases?.find(a=>/[А-Яа-яІіЇїЄєҐґ]/.test(a))||e?.name||id||'Місце не встановлено';}
function fullName(id){return TimelineCore.fullName(entityMap.get(id),profileMap?.get(id));}
function selectable(){return TimelineCore.selectable(data.entities,events());}
function color(id){return palette[[...entityMap.keys()].indexOf(id)%palette.length]||'#8797ac';}
function events(){return data.events.filter(e=>e.continuity===continuity&&e.scene_state!=='inactive');}
function relevant(e){return e.tracks.some(id=>selected.has(id));}
function navigationEvents(){return events().filter(e=>focusedCharacter?e.tracks.includes(focusedCharacter):relevant(e));}
function nav(){return TimelineCore.navigation(navigationEvents(),anchorEvent,Math.floor(center));}
function stepEvent(direction){const target=nav()[direction<0?'previous':'next'];if(target)navigateEvent(target.id);}
function setFocus(id){focusedCharacter=focusedCharacter===id?null:id;if(focusedCharacter)selected.add(id);closeCard();closePanels();$('canvas').scrollTop=0;renderCharacters();render();}
function updateFocusBar(){const bar=$('focusBar');bar.hidden=!focusedCharacter;if(!focusedCharacter)return;const n=nav();$('focusName').textContent=fullName(focusedCharacter);$('focusPosition').textContent=n.index>=0?`${n.index+1} / ${n.total}`:`${n.total} подій`;$('focusPrevious').disabled=!n.previous;$('focusNext').disabled=!n.next;}
function selectionChanged(){if(focusedCharacter&&!selected.has(focusedCharacter))focusedCharacter=null;closeCard();renderCharacters();render();}
function range(){return [Math.max(0,center-182.5/zoom),Math.min(365,center+182.5/zoom)];}
function svg(tag,attrs,parent=$('timeline')){const e=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));parent.append(e);return e;}
function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(render);}
function closeCard(){focusId=null;anchorDay=null;anchorEvent=null;$('eventCard').hidden=true;$('hoverTip').hidden=true;schedule();}
function setZoom(value,pivot=center){const old=zoom;zoom=clamp(value,1,730);center=pivot+(center-pivot)*old/zoom;center=clamp(center,182.5/zoom,365-182.5/zoom);$('hoverTip').hidden=true;schedule();}
function closePanels(except){for(const id of ['linesPanel','searchPanel','periodPanel'])if(id!==except){$(id).hidden=true;$(id.replace('Panel','Button')).setAttribute('aria-expanded','false');}}
function togglePanel(id){const opening=$(id).hidden;closePanels(id);$(id).hidden=!opening;$(id.replace('Panel','Button')).setAttribute('aria-expanded',String(opening));if(opening){$('eventCard').hidden=true;$('hoverTip').hidden=true;const input=$(id).querySelector('input');if(input)input.focus();}}
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
 if(points.length<2)return '';const slopes=points.map((p,i)=>{if(p.node)return 0;const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];return b.x===a.x?0:(b.y-a.y)/(b.x-a.x);});
 let d=`M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],h=(b.x-a.x)/3;d+=` C${(a.x+h).toFixed(2)},${(a.y+slopes[i-1]*h).toFixed(2)} ${(b.x-h).toFixed(2)},${(b.y-slopes[i]*h).toFixed(2)} ${b.x.toFixed(2)},${b.y.toFixed(2)}`;}
 return d;
}
function render(){
 if(!data)return;
 const canvas=$('canvas'),timeline=$('timeline'),axis=$('timeAxis'),w=canvas.clientWidth||timeline.clientWidth||1000,viewport=canvas.clientHeight||700,pad=w<600?22:48,[lo,hi]=range(),plot=w-2*pad;
 const list=TimelineCore.ordered(events().filter(e=>e.day!==null&&relevant(e))),visible=list.filter(e=>e.day+1>lo&&e.day<hi);
 const active=new Set(visible.flatMap(e=>e.tracks));if(focusedCharacter)active.add(focusedCharacter);
 const ids=[...selected].filter(id=>zoom<3||active.has(id)).sort((a,b)=>(a===focusedCharacter?-1:b===focusedCharacter?1:0)||(defaults.indexOf(a)>=0?defaults.indexOf(a):99)-(defaults.indexOf(b)>=0?defaults.indexOf(b):99)||fullName(a).localeCompare(fullName(b),'uk'));
 const n=ids.length,overview=zoom<3,h=overview||focusedCharacter?viewport:Math.max(viewport,220+Math.max(0,n-1)*40),mid=focusedCharacter?viewport*.58:overview?viewport*.57:110+(h-220)/2;
 timeline.style.height=h+'px';timeline.setAttribute('viewBox',`0 0 ${w} ${h}`);axis.setAttribute('viewBox',`0 0 ${w} 40`);
 const px=day=>pad+(day-lo)/(hi-lo)*plot,spread=clamp(Math.log2(zoom)*14,0,60),gap=overview?0:focusedCharacter?Math.min(26,(viewport-220)/Math.max(1,n-1)):Math.min(40,(h-220)/Math.max(1,n-1));
 const row=id=>focusedCharacter?(id===focusedCharacter?mid:mid+(ids.indexOf(id)-n/2)*gap):mid+(ids.indexOf(id)-(n-1)/2)*gap;
 const base=(id,day)=>row(id)+Math.sin((day-center)/(zoom>50?1.5:9)+ids.indexOf(id)*Math.PI*2/Math.max(1,n))*(overview?10:7);
 const byDay=new Map();list.forEach(e=>{if(!byDay.has(e.day))byDay.set(e.day,[]);byDay.get(e.day).push(e);});
 const detailed=zoom>=8;
 graphNodes=detailed?visible.filter(e=>!focusedCharacter||e.tracks.includes(focusedCharacter)).map(e=>{const a=byDay.get(e.day),slot=a.indexOf(e),day=e.day+.08+.84*(slot+.5)/a.length,cast=e.physical.filter(id=>ids.includes(id));return {id:e.id,e,day,x:px(day),cast,y:focusedCharacter?base(focusedCharacter,day):cast.length?cast.reduce((sum,id)=>sum+base(id,day),0)/cast.length:mid};}).filter(p=>p.x>=pad-10&&p.x<=w-pad+10):[...byDay].filter(([d,a])=>d+1>lo&&d<hi&&(!focusedCharacter||a.some(e=>e.tracks.includes(focusedCharacter)))).map(([day,a])=>({id:'day-'+day,day:day+.5,x:px(day+.5),y:mid,cast:[],group:focusedCharacter?a.filter(e=>e.tracks.includes(focusedCharacter)):a}));
 timeline.replaceChildren();axis.replaceChildren();$('linesCount').textContent=`Лінії · ${selected.size}`;
 // Alternating calendar days, including empty days; boundaries use actual day values.
 if(plot/(hi-lo)>=2)for(let day=Math.floor(lo);day<Math.ceil(hi);day++){if(day%2===1)svg('rect',{x:clamp(px(day),0,w),y:0,width:Math.max(0,clamp(px(day+1),0,w)-clamp(px(day),0,w)),height:h,class:'day-band','data-day':day});}
 const label=overview?'Рік 0':zoom<50?`${dateText(lo)} — ${dateText(hi-.01)} · Рік 0`:`${dateText(center,true)} · Рік 0`;$('periodButton').textContent=label;
 document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===(overview?'year':zoom<50?'month':'day'))));
 const ticks=zoom<8?starts.map((d,i)=>({day:d,text:months[i].slice(0,3)})):Array.from({length:Math.ceil(hi)-Math.floor(lo)+1},(_,i)=>({day:Math.floor(lo)+i,text:dateText(Math.floor(lo)+i)})),step=zoom<8?1:Math.max(1,Math.ceil(ticks.length/(plot/75)));
 ticks.forEach((t,i)=>{if(t.day<lo||t.day>=hi||i%step)return;svg('line',{x1:px(t.day),x2:px(t.day),y1:5,y2:10,stroke:'#bfcbdc'},axis);const txt=svg('text',{x:px(t.day),y:28,'text-anchor':'middle'},axis);txt.textContent=t.text;});
 ids.forEach(id=>{
  const anchors=detailed?graphNodes.filter(p=>p.cast.includes(id)||(id===focusedCharacter&&p.e.tracks.includes(id))):[];
  const xs=[pad,w-pad,...Array.from({length:Math.ceil(plot/18)},(_,i)=>pad+i*18),...anchors.map(a=>a.x)].sort((a,b)=>a-b).filter((v,i,a)=>v<=w-pad&&(i===0||v-a[i-1]>.01));
  const coordinates=xs.map(x=>{const day=lo+(x-pad)/plot*(hi-lo);let y=base(id,day),nearest=null;for(const a of anchors)if(!nearest||Math.abs(a.x-x)<Math.abs(nearest.x-x))nearest=a;let isNode=false;
   if(nearest){const r=Math.min(48,plot*.06),distance=Math.abs(nearest.x-x);if(distance<r){const weight=(1+Math.cos(distance/r*Math.PI))/2;y=y*(1-weight)+nearest.y*weight;}isNode=distance<.01;}
   return {x,y,node:isNode};});
  const d=smoothPath(coordinates),dim=focusedCharacter&&focusedCharacter!==id,thread=svg('path',{d,class:'thread',stroke:color(id),'stroke-width':id===focusedCharacter?3:overview?2:2.1,opacity:dim?'.12':'.85','data-character':id});
  const hit=svg('path',{d,class:'thread-hit',stroke:'transparent','stroke-width':14,role:'button',tabindex:overview&&n>20?-1:0,'aria-label':`Зосередитися: ${fullName(id)}`,'aria-pressed':id===focusedCharacter,'data-character':id});
  hit.addEventListener('click',()=>setFocus(id));hit.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setFocus(id);}});
  if(!overview&&(!focusedCharacter||id===focusedCharacter)){const text=svg('text',{x:pad+3,y:base(id,lo)-12,class:'line-label',role:'button',tabindex:0,'aria-label':`Зосередитися: ${fullName(id)}`,style:`fill:${color(id)};font-size:12px`});text.textContent=name(id);text.addEventListener('click',()=>setFocus(id));text.addEventListener('keydown',e=>{if(e.key==='Enter'){setFocus(id);}});}
 });
 graphNodes.forEach(p=>{
  const label=p.e?p.e.title:`${p.group[0].title}${p.group.length>1?` · ще ${p.group.length-1}`:''}`,g=svg('g',{class:'node',tabindex:0,role:'button','aria-label':label,'aria-haspopup':'dialog','data-event':p.id});
  svg('circle',{class:'target',cx:p.x,cy:p.y,r:12},g);svg('circle',{class:'mark',cx:p.x,cy:p.y,r:focusId===p.id?6:4,fill:focusId===p.id?'#365d92':'#fbfcfe',stroke:p.cast.length===1?color(p.cast[0]):'#889eb9','stroke-width':1.5},g);
  const open=()=>{closePanels();focusId=p.id;anchorDay=p.day;anchorEvent=p.e?.id||null;p.e?showEvent(p.e):showGroup(p.group);positionCard(p);$('hoverTip').hidden=true;schedule();};
  g.addEventListener('click',open);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
  g.addEventListener('pointerenter',()=>{if(focusId===p.id&&!$('eventCard').hidden)return;const tip=$('hoverTip');tip.textContent=label;tip.style.left=clamp(p.x,Math.min(165,w/2),Math.max(w-165,w/2))+'px';tip.style.top=(p.y-canvas.scrollTop-16)+'px';tip.hidden=false;});g.addEventListener('pointerleave',()=>{$('hoverTip').hidden=true;});
 });
 if(!graphNodes.length){const t=svg('text',{x:w/2,y:mid,'text-anchor':'middle'});t.textContent=selected.size?'У цьому проміжку немає подій обраних ліній':'Обери персонажів у меню «Лінії»';}
 if(!$('eventCard').hidden){const a=graphNodes.find(p=>p.id===focusId);if(a)positionCard(a);else $('eventCard').hidden=true;}
 updateFocusBar();
}
function positionCard(point){const card=$('eventCard'),canvas=$('canvas'),w=canvas.clientWidth||1000,y=point.y-canvas.scrollTop,width=Math.min(360,w-24),left=clamp(point.x,width/2+12,w-width/2-12);card.hidden=false;card.style.left=left+'px';card.style.top=(y-16)+'px';card.style.setProperty('--tail-x',(point.x-left+width/2)+'px');card.style.setProperty('--card-height',Math.max(70,Math.min(520,y-32))+'px');}
function bindCard(){
 $('cardContent').querySelectorAll('[data-card-event]').forEach(b=>b.addEventListener('click',()=>navigateEvent(b.dataset.cardEvent)));
 $('cardContent').querySelectorAll('[data-step-event]').forEach(b=>b.addEventListener('click',()=>stepEvent(+b.dataset.stepEvent)));
 $('cardContent').querySelectorAll('[data-profile]').forEach(b=>b.addEventListener('click',()=>openProfile(b.dataset.profile,b)));
 $('cardContent').querySelectorAll('[data-close-card]').forEach(b=>b.addEventListener('click',closeCard));
}
function showGroup(group){$('cardContent').innerHTML=`<div class="card-top"><span class="card-date">${dateText(group[0].day,true)} · ${group.length} подій</span><button class="close" data-close-card aria-label="Закрити">×</button></div>${group.map(e=>`<button class="result" data-card-event="${esc(e.id)}">${esc(e.title)}</button>`).join('')}`;bindCard();}
function showEvent(e){
 const scene=sceneMap.get(e.scene_id),physical=e.involvement.filter(i=>e.physical.includes(i.entity_id)),special=e.involvement.filter(i=>modes[i.mode]),mentioned=e.involvement.filter(i=>i.role==='mentioned'||i.mode==='remote');
 const repo='https://github.com/DSMykyta/Konoha-Gaiden-Chronicles/blob/';
 const evidence=(e.evidence_ids||[]).map(id=>{const ev=evidenceMap.get(id),s=sourceMap.get(ev?.source_id);if(!ev)return `<p>${esc(id)}</p>`;const locator=typeof ev.locator==='string'?ev.locator:JSON.stringify(ev.locator||'');return `<div class="evidence">${s?.path?`<a href="${repo}${encodeURIComponent(s.revision||data.revision)}/${s.path.split('/').map(encodeURIComponent).join('/')}" target="_blank" rel="noopener">${esc(s.title)}</a>`:`<p>${esc(s?.title||id)}</p>`}<p>${esc(locator)}</p></div>`;}).join('');
 const rel=[...(scene.relations||[]),...data.links].filter(r=>(r.a===e.id||r.b===e.id)&&['before','meets','intersects','same_span','observes'].includes(r.kind));
 const relations=rel.map(r=>{const d=describeRelation(r,e.id),other=eventMap.get(d.otherId),sc=sceneMap.get(d.otherId);return `<div class="relation"><span>${esc(d.label)}:</span>${other?`<button class="text-button" data-card-event="${esc(other.id)}">${esc(other.title)}${r.review!=='accepted'?' · потребує перевірки':''}</button>`:`<span>${esc(sc?.title||d.otherId)}</span>`}</div>`;}).join('');
 const sceneCast=[...new Set((scene.presence||[]).map(p=>p.entity_id))],navigation=nav();
 const photos=(data.media||[]).filter(m=>m.event_id===e.id&&m.status==='published').sort((a,b)=>(a.order||0)-(b.order||0));
 const gallery=photos.length?`<div class="event-gallery">${photos.map(m=>`<figure><img src="${esc(m.src)}" alt="${esc(m.alt)}" loading="lazy" decoding="async" width="${Number(m.width)||640}" height="${Number(m.height)||360}"><figcaption>${esc(m.caption||m.alt)}<small>${esc(m.locator)}${m.coverage==='canonical_part'?' · Канонічна частина події':''}</small></figcaption></figure>`).join('')}</div>`:'';
 $('cardContent').innerHTML=`<div class="card-top"><span class="card-date">${esc(dateText(e.day,true))} ${e.day!==null?'· Рік 0':''}</span><button class="close" data-close-card aria-label="Закрити подію">×</button></div>${gallery}<h2>${esc(e.title)}</h2><p class="event-text">${esc(e.text)}</p><div class="people">${physical.map(i=>`<button class="person" data-profile="${esc(i.entity_id)}"><span class="swatch" style="background:${color(i.entity_id)}"></span>${esc(name(i.entity_id))}</button>`).join('')}</div><p class="card-meta">${esc(origins[e.origin]||e.origin)}${e.date_status!=='established'&&e.day!==null?' · Робоча дата':''}${e.scene_state!=='active'?' · Чернетка':''}</p>${special.length?`<p class="card-meta">${special.map(i=>`${esc(name(i.entity_id))} (${modes[i.mode]})`).join(', ')}</p>`:''}${mentioned.length?`<p class="card-meta">Згадки / віддалена дія: ${mentioned.map(i=>esc(name(i.entity_id))).join(', ')}</p>`:''}${relations?`<details class="disclosure"><summary>Часові зв’язки</summary>${relations}</details>`:''}<details class="disclosure"><summary>Сцена та присутність</summary><p>${esc(e.scene_title)} · ${esc(name(e.location_id))}</p>${sceneCast.length?`<p>Присутні в різні моменти сцени: ${sceneCast.map(id=>esc(name(id))).join(', ')}.</p>`:''}<p>Точна година не встановлена. Положення вузлів у межах дня показує порядок відображення, а не доведену одночасність.</p></details><details class="disclosure"><summary>Джерела</summary>${evidence||'<p>Джерела не позначено.</p>'}<a href="${repo}${data.revision}/${data.base}/scenes/${encodeURIComponent(e.file)}" target="_blank" rel="noopener">Запис сцени</a></details><nav class="event-navigation" aria-label="Перехід між подіями"><button data-step-event="-1" ${navigation.previous?'':'disabled'} aria-label="Попередня подія">‹ Попередня</button><button data-step-event="1" ${navigation.next?'':'disabled'} aria-label="Наступна подія">Наступна ›</button></nav>`;
 bindCard();
}
function navigateEvent(id){const e=eventMap.get(id);if(!e)return;if(focusedCharacter&&!e.tracks.includes(focusedCharacter))focusedCharacter=null;continuity=e.continuity;$('continuity').value=continuity;if(!relevant(e))e.tracks.forEach(id=>selected.add(id));renderCharacters();closePanels();if(e.day!==null){zoom=365;center=clamp(e.day+.5,.5,364.5);}focusId=e.id;anchorEvent=e.id;showEvent(e);render();const anchor=graphNodes.find(p=>p.id===e.id);if(anchor){$('canvas').scrollTop=Math.max(0,anchor.y-($('canvas').clientHeight||700)*.7);positionCard(anchor);}else positionCard({x:($('canvas').clientWidth||1000)/2,y:($('canvas').clientHeight||700)*.7});updateFocusBar();}
function search(){const q=$('eventSearch').value.trim().toLowerCase();const found=events().filter(e=>!q||(e.title+' '+e.text).toLowerCase().includes(q));$('searchResults').innerHTML=found.slice(0,searchLimit).map(e=>`<button class="result" data-search-event="${esc(e.id)}">${esc(e.title)}<small>${dateText(e.day)}</small></button>`).join('')||'<p class="empty">Подій не знайдено.</p>';$('searchResults').querySelectorAll('[data-search-event]').forEach(b=>b.addEventListener('click',()=>navigateEvent(b.dataset.searchEvent)));$('moreResults').hidden=found.length<=searchLimit;}
function openProfile(id,trigger){if(!entityMap.has(id))return;profileEntity=id;profileVersion=null;profileReturnFocus=trigger;renderProfile();const dialog=$('profileDialog');dialog.hidden=false;if(!dialog.open){if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');}$('closeProfile').focus();}
function closeProfile(){const dialog=$('profileDialog');if(dialog.hidden)return;if(dialog.close)dialog.close();else dialog.removeAttribute('open');dialog.hidden=true;profileEntity=null;profileReturnFocus?.focus();}
function renderProfile(){
 const entity=entityMap.get(profileEntity);if(!entity)return;const profile=profileMap.get(profileEntity),versions=profile?.versions?.length?profile.versions:[{id:'general',label:'Профіль'}];if(!versions.some(v=>v.id===profileVersion))profileVersion=versions[0].id;
 const version=versions.find(v=>v.id===profileVersion),associated=TimelineCore.ordered(events().filter(e=>e.tracks.includes(profileEntity))),dated=associated.filter(e=>e.day!==null),memberships=(data.memberships||[]).filter(m=>m.entity_id===profileEntity||m.person_id===profileEntity||m.member_id===profileEntity);
 $('profileTitle').textContent=fullName(profileEntity);$('profileTabs').innerHTML=versions.map(v=>`<button id="tab-${esc(v.id)}" role="tab" aria-selected="${v.id===profileVersion}" aria-controls="profileContent" tabindex="${v.id===profileVersion?0:-1}" data-profile-version="${esc(v.id)}">${esc(v.label)}</button>`).join('');$('profileContent').setAttribute('aria-labelledby','tab-'+version.id);
 const paragraphs=text=>String(text||'').split(/\n\s*\n/).filter(Boolean).map(p=>`<p>${esc(p)}</p>`).join('');
 $('profileContent').innerHTML=`${version.image?`<img class="profile-image" src="${esc(version.image)}" alt="${esc(version.image_alt||fullName(profileEntity))}" loading="lazy">`:''}${version.age!==undefined?`<p class="profile-age">${version.age} років</p>`:''}${version.summary?paragraphs(version.summary):'<p class="empty">Профіль цього віку ще не заповнений.</p>'}${(version.facts||[]).length?`<dl class="profile-facts">${version.facts.map(f=>`<div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join('')}</dl>`:''}${(version.sections||[]).map(section=>`<section class="profile-section"><h3>${esc(section.title)}</h3>${paragraphs(section.text)}</section>`).join('')}<section class="profile-section"><h3>У хронології</h3><p>${associated.length} подій${dated.length?` · ${dateText(dated[0].day)} — ${dateText(dated.at(-1).day)}`:''}</p>${memberships.length?`<p>${memberships.map(m=>esc(name(m.team_id||m.group_id))).join(', ')}</p>`:''}<button id="followCharacter" class="profile-follow">Зосередитися на лінії</button></section>`;
 $('profileTabs').querySelectorAll('[data-profile-version]').forEach((b,i)=>{b.addEventListener('click',()=>{profileVersion=b.dataset.profileVersion;renderProfile();$('profileTabs').querySelector('[aria-selected="true"]').focus();});b.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const index=e.key==='Home'?0:e.key==='End'?versions.length-1:(i+(e.key==='ArrowRight'?1:-1)+versions.length)%versions.length;profileVersion=versions[index].id;renderProfile();$('profileTabs').querySelector('[aria-selected="true"]').focus();});});
 $('followCharacter').addEventListener('click',()=>{const id=profileEntity;closeProfile();if(focusedCharacter===id){closePanels();render();}else setFocus(id);});
}
function ingest(next,initial=false){
 const wasAll=data&&selectable().every(e=>selected.has(e.id));
 data=next;entityMap=new Map(data.entities.map(e=>[e.id,e]));eventMap=new Map(data.events.map(e=>[e.id,e]));sceneMap=new Map(data.scenes.map(s=>[s.id,s]));evidenceMap=new Map(data.sources.evidence.map(e=>[e.id,e]));sourceMap=new Map(data.sources.sources.map(s=>[s.id,s]));profileMap=new Map((data.profiles||[]).map(p=>[p.entity_id,p]));
 if(initial||wasAll)selected=new Set(selectable().map(e=>e.id));else selected=new Set([...selected].filter(id=>entityMap.has(id)));if(focusedCharacter&&!entityMap.has(focusedCharacter))focusedCharacter=null;if(anchorEvent&&!eventMap.has(anchorEvent))closeCard();
 $('revision').textContent=`Дані: ${data.revision.slice(0,8)}`;$('sourceLink').href=`https://github.com/DSMykyta/Konoha-Gaiden-Chronicles/tree/${data.revision}/${data.base}`;
}
let refreshing=false;
async function refreshData(){
 if(refreshing||document.visibilityState==='hidden'||window.__TIMELINE_DATA__)return;refreshing=true;
 try{const v=await fetch(`version.json?t=${Date.now()}`,{cache:'no-store'});if(!v.ok)return;const version=await v.json();if(version.revision===data.revision)return;const response=await fetch(`data.json?v=${encodeURIComponent(version.revision)}`,{cache:'no-store'});if(!response.ok)return;const next=await response.json();ingest(next);renderCharacters();search();if(anchorEvent&&eventMap.has(anchorEvent)&&!$('eventCard').hidden)showEvent(eventMap.get(anchorEvent));if(profileEntity)renderProfile();render();}catch{}finally{refreshing=false;}
}
async function init(){
 try{const response=window.__TIMELINE_DATA__?{ok:true,json:async()=>window.__TIMELINE_DATA__}:await fetch(`data.json?t=${Date.now()}`,{cache:'no-store'});if(!response.ok)throw new Error('Не вдалося завантажити хронологію.');ingest(await response.json(),true);$('status').hidden=true;
 const names={'alt-shippuden-469':'Альтернатива · обличчя Какаші','alt-movie-land-of-snow':'Альтернатива · Країна Снігу'};[...new Set(data.events.map(e=>e.continuity))].filter(c=>c!=='main').forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=names[c]||c;$('continuity').append(o);});
 for(const id of ['lines','search','period'])$(id+'Button').addEventListener('click',()=>{togglePanel(id+'Panel');if(id==='search')search();});document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>{closePanels();}));
 $('characterSearch').addEventListener('input',renderCharacters);$('selectAll').addEventListener('click',()=>{selected=new Set(selectable().map(e=>e.id));selectionChanged();});$('deselectAll').addEventListener('click',()=>{selected.clear();selectionChanged();});document.querySelectorAll('[data-team]').forEach(b=>b.addEventListener('click',()=>{selected=new Set(teams[b.dataset.team]);focusedCharacter=null;selectionChanged();}));
 $('eventSearch').addEventListener('input',()=>{searchLimit=30;search();});$('moreResults').addEventListener('click',()=>{searchLimit+=30;search();});
 $('continuity').addEventListener('change',()=>{continuity=$('continuity').value;focusedCharacter=null;selected=new Set(selectable().map(e=>e.id));selectionChanged();search();});
 $('dateForm').addEventListener('submit',e=>{e.preventDefault();const m=$('dateInput').value.trim().match(/^(\d{1,2})[./](\d{1,2})$/);if(!m||+m[2]<1||+m[2]>12||+m[1]<1||+m[1]>lengths[+m[2]-1]){$('dateError').textContent='Введи дату у форматі 22.01.';$('dateError').hidden=false;return;}$('dateError').hidden=true;zoom=365;center=starts[+m[2]-1]+(+m[1]-1)+.5;closePanels();closeCard();});
 document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setZoom({year:1,month:12,day:365}[b.dataset.mode])));$('zoomIn').addEventListener('click',()=>setZoom(zoom*2));$('zoomOut').addEventListener('click',()=>setZoom(zoom/2));$('fit').addEventListener('click',()=>setZoom(1));
 for(const [id,s] of [['previous',-1],['next',1]])$(id).addEventListener('click',()=>{closeCard();center=clamp(center+s*365/zoom*.7,182.5/zoom,365-182.5/zoom);schedule();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('profileDialog').hidden){e.preventDefault();closeProfile();return;}closePanels();closeCard();if(focusedCharacter){focusedCharacter=null;render();}}});document.addEventListener('pointerdown',e=>{if(!e.target.closest('.panel,.tools,.period'))closePanels();if(!e.target.closest('.event-card,.node,.thread-hit,.line-label,.focus-bar,.profile-dialog,.time-controls,.panel,.tools,.period'))closeCard();});
 const canvas=$('timeline'),touches=new Map();let drag=null,pinch=null;
 canvas.addEventListener('wheel',e=>{e.preventDefault();const box=canvas.getBoundingClientRect(),pad=box.width<600?22:48,t=clamp((e.clientX-box.left-pad)/(box.width-pad*2),0,1),[lo,hi]=range();setZoom(zoom*Math.exp(-clamp(e.deltaY,-100,100)*.007),lo+t*(hi-lo));},{passive:false});
 canvas.addEventListener('pointerdown',e=>{if(e.target.closest('.node,.thread-hit,.line-label'))return;touches.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);if(touches.size===1){drag={x:e.clientX,y:e.clientY,center,scroll:$('canvas').scrollTop};canvas.classList.add('dragging');}else if(touches.size===2){const a=[...touches.values()];pinch={distance:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),zoom};drag=null;}});
 canvas.addEventListener('pointermove',e=>{if(!touches.has(e.pointerId))return;touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pinch&&touches.size===2){const a=[...touches.values()];setZoom(pinch.zoom*Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)/Math.max(1,pinch.distance));}else if(drag){$('canvas').scrollTop=drag.scroll-(e.clientY-drag.y);center=clamp(drag.center-(e.clientX-drag.x)/(canvas.clientWidth-96)*365/zoom,182.5/zoom,365-182.5/zoom);schedule();}});
 const end=e=>{touches.delete(e.pointerId);drag=null;pinch=null;canvas.classList.remove('dragging');};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);new ResizeObserver(schedule).observe($('canvas'));
 $('canvas').addEventListener('scroll',()=>{$('hoverTip').hidden=true;const p=graphNodes.find(p=>p.id===focusId);if(p&&!$('eventCard').hidden)positionCard(p);},{passive:true});
 $('focusPrevious').addEventListener('click',()=>stepEvent(-1));$('focusNext').addEventListener('click',()=>stepEvent(1));$('focusName').addEventListener('click',()=>openProfile(focusedCharacter,$('focusName')));$('clearFocus').addEventListener('click',()=>{focusedCharacter=null;closeCard();renderCharacters();render();});
 $('closeProfile').addEventListener('click',closeProfile);$('profileDialog').addEventListener('cancel',e=>{e.preventDefault();closeProfile();});$('profileDialog').addEventListener('click',e=>{if(e.target===$('profileDialog')){const b=$('profileDialog').getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)closeProfile();}});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='hidden')refreshData();});window.addEventListener('focus',refreshData);setInterval(refreshData,60000);
 renderCharacters();render();const params=new URLSearchParams(window.location.search);if(entityMap.has(params.get('character')))setFocus(params.get('character'));if(eventMap.has(params.get('event')))navigateEvent(params.get('event'));
 }catch(e){$('status').hidden=true;$('error').textContent=e.message;$('error').hidden=false;}
}
init();
