'use strict';
/* Chronological story contents, separate from the time axis and map. */
const ChronologyContents = (() => {
  const LABEL={arc:'Арка',episode:'Епізод',scene:'Сцена',moment:'Момент',group:'Розділ'};
  const html = text => String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const position = value => Number.isFinite(value)?value:Infinity;
  // A scene may have a known narrative order but no calendar date. Keep its
  // actual start unknown, while sorting it against accepted before-relations.
  const order = (a,b) => position(a.orderPosition)-position(b.orderPosition)||(a.kind==='moment'&&b.kind==='moment'?(a.sourceIndex??Infinity)-(b.sourceIndex??Infinity):0)||a.title.localeCompare(b.title,'uk');
  function relativePositions(scenes,relations=[]) {
    const dated=new Map(),eventScene=new Map(),active=new Set();
    for(const scene of scenes){
      active.add(scene.id);
      if(Number.isFinite(scene.position))dated.set(scene.id,scene.position);
      for(const event of scene.group||[])eventScene.set(event.id,scene.id);
    }
    const edges=[];
    for(const relation of relations){
      if(relation.kind!=='before'||relation.review!=='accepted')continue;
      const a=eventScene.get(relation.a)||relation.a,b=eventScene.get(relation.b)||relation.b;
      if(a!==b&&active.has(a)&&active.has(b))edges.push([a,b]);
    }
    // Bounds propagate across undated chains without assigning any date.
    // A tiny offset affects order in Contents only, never the timeline axis.
    const step=0.001,upper=new Map(dated),lower=new Map(dated);
    for(let i=0;i<scenes.length&&edges.length;i++){
      let changed=false;
      for(const [a,b] of edges){
        if(!dated.has(a)&&upper.has(b)){
          const v=upper.get(b)-step;
          if(!upper.has(a)||v<upper.get(a)){upper.set(a,v);changed=true;}
        }
        if(!dated.has(b)&&lower.has(a)){
          const v=lower.get(a)+step;
          if(!lower.has(b)||v>lower.get(b)){lower.set(b,v);changed=true;}
        }
      }
      if(!changed)break;
    }
    const result=new Map();
    for(const scene of scenes){
      if(dated.has(scene.id))continue;
      const before=upper.get(scene.id),after=lower.get(scene.id);
      if(before===undefined&&after===undefined)continue;
      if(before!==undefined&&after!==undefined&&after>=before)continue;
      result.set(scene.id,{
        orderPosition:before!==undefined&&after!==undefined?(before+after)/2:before??after,
        beforeBoundary:before===undefined?null:before,
        afterBoundary:after===undefined?null:after
      });
    }
    return result;
  }
  let roots=[],visible=new Map(),expanded=new Set(),initialized=false;
  const SEARCH_IDLE_MS=180;
  let queryTimer=null,composing=false;
  function cancelQueryTimer(){if(queryTimer!==null)clearTimeout(queryTimer);queryTimer=null;}
  function scheduleQuery(){
    if(composing)return;
    cancelQueryTimer();
    const query=document.getElementById('contentsQuery');
    if(!query?.value.trim()){render();return;}
    queryTimer=setTimeout(()=>{queryTimer=null;render();},SEARCH_IDLE_MS);
  }

  function buildTree(scenes,sceneMap,episodeMap,arcMap,momentPositions=null,relations=[]) {
    const arcs=new Map(),episodes=new Map(),relative=relativePositions(scenes,relations);
    const make=(kind,id,title,start=Infinity)=>({kind,id,title,start,end:start,orderPosition:start,beforeBoundary:null,afterBoundary:null,children:[]});
    for(const scene of scenes){
      if(!scene.group?.length)continue;
      const sm=sceneMap.get(scene.id),em=episodeMap.get(sm?.episode_id),am=arcMap.get(em?.arc_id);
      const ak=am?.id||'misc';
      if(!arcs.has(ak))arcs.set(ak,make(am?'arc':'group',ak,am?.title||'Інші сцени'));
      const ek=ak+'/'+(em?.id||scene.id);
      if(!episodes.has(ek)){
        const ep=make(em?'episode':'group',em?.id||'misc:'+scene.id,em?.title||'Окрема сцена');
        episodes.set(ek,ep);arcs.get(ak).children.push(ep);
      }
      const day=Number.isFinite(scene.position)?scene.position:position(scene.day);
      const sn=make('scene',scene.id,sm?.title||scene.group[0]?.scene_title||scene.id,day);
      const hint=relative.get(scene.id);
      if(!Number.isFinite(day)&&hint)Object.assign(sn,hint);
      sn.children=scene.group.map((e,i)=>{
        const moment=make('moment',e.id,e.title,momentPositions?.get(e.id)??day);
        if(!Number.isFinite(day)&&hint)Object.assign(moment,hint);
        return {...moment,sourceIndex:i};
      });
      episodes.get(ek).children.push(sn);
    }
    const finalize=n=>{
      n.children.forEach(finalize);n.children.sort(order);
      if(n.children.length){
        n.start=Math.min(...n.children.map(c=>position(c.start)));
        n.end=Math.max(...n.children.map(c=>Number.isFinite(c.end)?c.end:-Infinity));
        n.orderPosition=Math.min(...n.children.map(c=>position(c.orderPosition)));
        if(!Number.isFinite(n.start)){
          const before=n.children.map(c=>c.beforeBoundary).filter(Number.isFinite);
          const after=n.children.map(c=>c.afterBoundary).filter(Number.isFinite);
          n.beforeBoundary=before.length?Math.min(...before):null;
          n.afterBoundary=after.length?Math.max(...after):null;
        }
      }
      return n;
    };
    return [...arcs.values()].map(finalize).sort(order);
  }
  const key=n=>n.kind+':'+n.id;
  function span(n){
    if(!Number.isFinite(n.start)){
      if(Number.isFinite(n.beforeBoundary)&&Number.isFinite(n.afterBoundary))return 'Дата невідома · між '+dateText(n.afterBoundary,true)+' і '+dateText(n.beforeBoundary,true);
      if(Number.isFinite(n.beforeBoundary))return 'Дата невідома · до '+dateText(n.beforeBoundary,true);
      if(Number.isFinite(n.afterBoundary))return 'Дата невідома · після '+dateText(n.afterBoundary,true);
      return 'Дата невідома';
    }
    const from=dateText(n.start,true),to=dateText(n.end,true);
    return from===to?from:from+' — '+to;
  }
  function filter(n,q,matched=false){
    if(!q)return n;
    const own=n.title.toLocaleLowerCase('uk').includes(q);
    const children=n.children.map(c=>filter(c,q,matched||own)).filter(Boolean);
    return own||matched||children.length?{...n,children}:null;
  }
  function draw(n,depth=0,force=false) {
    const k=key(n),opened=n.children.length&&(force||expanded.has(k));
    const label='<span class="contents-copy"><span class="contents-name">'+html(n.title)+'</span><small>'+LABEL[n.kind]+' · '+html(span(n))+'</small></span>';
    const read=n.kind==='group'?'':'<button type="button" class="contents-read" data-contents-kind="'+html(n.kind)+'" data-contents-id="'+html(n.id)+'" aria-label="Читати: '+html(n.title)+'">Читати</button>';
    if(!n.children.length)return '<div class="contents-entry contents-leaf" data-depth="'+depth+'"><div class="contents-leaf-label">'+label+'</div>'+read+'</div>';
    return '<div class="contents-entry" data-depth="'+depth+'"><details class="contents-branch" data-contents-key="'+html(k)+'" '+(opened?'open':'')+'><summary>'+label+'<span class="contents-count">'+n.children.length+'</span></summary><div class="contents-children">'+(opened?n.children.map(c=>draw(c,depth+1,force)).join(''):'')+'</div></details>'+read+'</div>';
  }
  function render(){
    cancelQueryTimer();
    const panel=document.getElementById('contentsPanel');
    if(!initialized||!panel||panel.hidden)return;
    roots=buildTree(orderedScenes(),sceneMap,episodeMap,arcMap,worldChronology().moments,chronologyRelations());
    const q=document.getElementById('contentsQuery').value.trim().toLocaleLowerCase('uk');
    const filtered=roots.map(n=>filter(n,q)).filter(Boolean);
    visible=new Map();
    const visit=n=>{visible.set(key(n),n);n.children.forEach(visit);};
    filtered.forEach(visit);
    document.getElementById('contentsSummary').textContent=q?'Знайдено розділів: '+filtered.length:roots.length+' арок і розділів · за початком подій';
    document.getElementById('contentsTree').innerHTML=filtered.length?filtered.map(n=>draw(n,0,!!q)).join(''):'<p class="contents-empty">Збігів немає. Спробуй іншу назву.</p>';
  }
  function init(){
    if(initialized)return;initialized=true;
    const panel=document.getElementById('contentsPanel'),tree=document.getElementById('contentsTree');
    const query=document.getElementById('contentsQuery');
    query.addEventListener('input',scheduleQuery);
    query.addEventListener('compositionstart',()=>{composing=true;cancelQueryTimer();});
    query.addEventListener('compositionend',()=>{composing=false;scheduleQuery();});
    query.addEventListener('keydown',event=>{
      if(event.key==='Enter'&&!event.isComposing&&!composing){event.preventDefault();render();}
    });
    tree.addEventListener('click',e=>{
      const summary=e.target.closest?.('summary');
      if(!summary || !tree.contains(summary))return;
      const details=summary.parentElement;
      if(!details.matches('details[data-contents-key]'))return;
      e.preventDefault();
      const k=details.dataset.contentsKey;
      if(details.open){details.open=false;expanded.delete(k);return;}
      details.open=true;expanded.add(k);
      const n=visible.get(k),target=details.querySelector('.contents-children');
      if(n&&target&&!target.childElementCount)
        target.innerHTML=n.children.map(c=>draw(c,Number(details.parentElement.dataset.depth)+1)).join('');
    });
    tree.addEventListener('click',e=>{
      const b=e.target.closest?.('[data-contents-kind]');if(!b)return;
      const kind=b.dataset.contentsKind,id=b.dataset.contentsId;
      closePanels();
      if(kind==='arc'||kind==='episode')navigateStory(kind,id);
      else if(kind==='scene')navigateScene(id);
      else if(kind==='moment')navigateEvent(id);
    });
    panel.addEventListener('toggle',e=>{if(e.newState==='open')render();else cancelQueryTimer();});
  }
  return {init,render,buildTree};
})();
