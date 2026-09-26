// Content-independent timeline model. Names, prose and display_rank never set time.
export const list = value => Array.isArray(value) ? value : [];
export const baseId = id => String(id || '').replace(/\.(start|end)$/, '');
export const hash = s => [...String(s)].reduce((h,c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
export const color = id => `hsl(${hash(id) % 360} 48% ${61 + (hash(id) % 4)}%)`;
export const label = entity => entity?.aliases?.find(x => /[а-яіїєґ]/i.test(x)) || entity?.name || entity?.title || entity?.id || '';

// The legacy exporter over-indented mapping siblings after sequence entries.
// Repair only this unambiguous serialization defect, in memory; keep source bytes.
export function normalizeIndent(text) {
  const lines = text.split('\n'); let changes = 0;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(\s*)- (\w+):.*$/);
    if (!match) continue;
    const n = match[1].length; let end = i + 1;
    while (end < lines.length && (!lines[end].trim() || lines[end].match(/^ */)[0].length > n)) end++;
    if (i + 1 < end && new RegExp(`^ {${n+4}}\\w[^:]*:`).test(lines[i+1])) {
      for (let j = i + 1; j < end; j++) if (lines[j].startsWith('  ')) lines[j] = lines[j].slice(2);
      changes++;
    }
  }
  return {text: lines.join('\n'), changes};
}

export function parseFiles(raw, load) {
  const documents = {}, diagnostics = [];
  for (const [path, text] of Object.entries(raw)) {
    if (!/\.ya?ml$/i.test(path)) continue;
    try { documents[path] = load(text); }
    catch (original) {
      const fixed = normalizeIndent(text);
      if (!fixed.changes) throw new Error(`${path}: ${original.message}`);
      try { documents[path] = load(fixed.text); }
      catch (error) { throw new Error(`${path}: ${error.message}`); }
      diagnostics.push({path, type:'indentation', changes:fixed.changes});
    }
  }
  return {documents, raw, diagnostics};
}

export function createModel(bundle) {
  const docs = bundle.documents || {}, entities = new Map(), anchors = new Map();
  const scenes = [], sources = new Map(), evidence = new Map(), memberships = [], relations = [], staging = [], redirects = [];
  let calendar = {month_lengths:[31,28,31,30,31,30,31,31,30,31,30,31],year_zero_days:365};
  for (const [path, d] of Object.entries(docs)) {
    if (!d || typeof d !== 'object') continue;
    for (const e of list(d.entities)) entities.set(e.id,e);
    for (const a of list(d.anchors)) anchors.set(a.id,a);
    for (const s of list(d.sources)) sources.set(s.id,s);
    for (const e of list(d.evidence)) evidence.set(e.id,e);
    memberships.push(...list(d.memberships)); relations.push(...list(d.links));
    redirects.push(...list(d.redirects)); staging.push(...list(d.records));
    if (d.calendar) calendar = d.calendar;
    if (d.id && Array.isArray(d.events)) {scenes.push({...d, file:path}); relations.push(...list(d.relations));}
  }
  const lengths = calendar.month_lengths || [31,28,31,30,31,30,31,31,30,31,30,31];
  const yearLength = lengths.reduce((a,b)=>a+b,0);
  const ordinal = date => date && Number.isFinite(+date.year) && date.month && date.day
    ? +date.year * yearLength + lengths.slice(0,date.month-1).reduce((a,b)=>a+b,0) + +date.day - 1 : null;
  function dateAt(day) {
    const year = Math.floor(day/yearLength); let left = day-year*yearLength, month=1;
    while (left >= lengths[month-1] && month < lengths.length) left-=lengths[month++-1];
    return {year,month,day:Math.floor(left)+1};
  }
  const anchorDay = (id, seen=new Set()) => {
    if (seen.has(id)) return null; seen.add(id); const a=anchors.get(id); if(!a) return null;
    if (a.date) return ordinal(a.date);
    const other = a.anchor_id || a.relative_to;
    const value = other ? anchorDay(other,seen) : null;
    return value == null ? null : value + +(a.day_offset||0);
  };
  const placementDay = placement => {
    if (!placement) return null;
    if (placement.date) return ordinal(placement.date);
    const value=anchorDay(placement.anchor_id);
    return value==null?null:value+ +(placement.day_offset||0);
  };
  const events=[], records=new Map(), sceneMap=new Map(), issues=[];
  for (const s of scenes) {
    if(records.has(s.id)) throw Error(`Duplicate ID: ${s.id}`);
    s.day=placementDay(s.placement); sceneMap.set(s.id,s);records.set(s.id,s);
    for(const original of s.events) {
      if(records.has(original.id)) throw Error(`Duplicate ID: ${original.id}`);
      const e={...original,scene:s,day:original.placement?placementDay(original.placement):s.day};
      events.push(e);records.set(e.id,e);
    }
  }
  const nodes = [], index = new Map(), edges=[];
  for(const id of records.keys()) for(const part of ['start','end']) {index.set(`${id}.${part}`,nodes.length);nodes.push(`${id}.${part}`);}
  function add(a,b,w=0,source=null) {
    if(!index.has(a)||!index.has(b)) {issues.push({type:'unresolved_relation',a,b,source});return;}
    edges.push([index.get(a),index.get(b),w,source]);
  }
  const end=(id,part)=>/\.(start|end)$/.test(id)?id:`${id}.${part}`;
  for(const [id,r] of records) add(`${id}.start`,`${id}.end`,r.scene?1:0);
  for(const e of events) {add(`${e.scene.id}.start`,`${e.id}.start`);add(`${e.id}.end`,`${e.scene.id}.end`);}
  for(const r of relations) {
    if(!r.a||!r.b) {issues.push({type:'unresolved_relation',source:r});continue;}
    const as=end(r.a,'start'), ae=end(r.a,'end'), bs=end(r.b,'start'), be=end(r.b,'end');
    switch(r.kind) {
      case 'before': add(ae,bs,1,r.id);break;
      case 'after': add(be,as,1,r.id);break;
      case 'within': add(bs,as,0,r.id);add(ae,be,0,r.id);break;
      case 'contains': add(as,bs,0,r.id);add(be,ae,0,r.id);break;
      case 'intersects': case 'overlaps': add(as,be,0,r.id);add(bs,ae,0,r.id);break;
      case 'meets': add(ae,bs,0,r.id);add(bs,ae,0,r.id);break;
      case 'simultaneous': case 'equals':
        add(as,bs,0,r.id);add(bs,as,0,r.id);add(ae,be,0,r.id);add(be,ae,0,r.id);break;
      case 'observes': case 'causes': case 'related': break;
      default: issues.push({type:'unhandled_relation',source:r});
    }
  }
  const distance=Array(nodes.length).fill(0);
  for(let pass=0;pass<=nodes.length;pass++) {
    let changed=false;
    for(const [a,b,w] of edges) if(distance[b]<distance[a]+w) {distance[b]=distance[a]+w;changed=true;}
    if(!changed) break;
    if(pass===nodes.length) throw Error('Часові зв’язки містять суперечливий цикл.');
  }
  const adjacency=nodes.map(()=>[]);
  edges.forEach(([a,b])=>adjacency[a].push(b));
  const reachCache=new Map();
  function reaches(a,b) {
    const ai=index.get(a),bi=index.get(b); if(ai==null||bi==null)return false;
    if(ai===bi)return true;
    if(!reachCache.has(ai)) {
      const seen=new Set([ai]),stack=[ai];
      while(stack.length) for(const n of adjacency[stack.pop()])if(!seen.has(n)){seen.add(n);stack.push(n);}
      reachCache.set(ai,seen);
    }
    return reachCache.get(ai).has(bi);
  }
  const before=(a,b)=>reaches(`${baseId(a)}.end`,`${baseId(b)}.start`);
  const days=new Map();
  for(const e of events) {
    e.physical=new Set(list(e.involvement).filter(i=>i.mode==='physical').map(i=>i.entity_id));
    e.active=new Set(list(e.involvement).filter(i=>i.mode==='physical' && ['focus','participant','active'].includes(i.role)).map(i=>i.entity_id));
    e.mentioned=new Set(list(e.involvement).filter(i=>i.mode!=='physical').map(i=>i.entity_id));
    for(const p of list(e.scene.presence)) {
      if(p.mode && p.mode!=='physical')continue;
      if(p.from&&p.to&&reaches(end(p.from,'start'),`${e.id}.start`)&&reaches(`${e.id}.end`,end(p.to,'end')))e.physical.add(p.entity_id);
    }
    e.rank=distance[index.get(`${e.id}.start`)];
    if(e.day!=null){if(!days.has(e.day))days.set(e.day,[]);days.get(e.day).push(e);}
  }
  // An interval is a layout constraint, not a made-up clock time.
  for(const [day, es] of days) {
    const min=Math.min(...es.map(e=>e.rank)),max=Math.max(...es.map(e=>e.rank))+1;
    const latest=new Map(es.map(e=>[e.id,max-1]));
    for(let pass=0;pass<es.length;pass++)for(const a of es)for(const b of es)if(a!==b&&before(a.id,b.id))latest.set(a.id,Math.min(latest.get(a.id),latest.get(b.id)-1));
    for(const e of es) {
      e.early=(e.rank-min)/(max-min+1);e.late=Math.max(e.early,(latest.get(e.id)-min)/(max-min+1));
      e.position=day+0.1+0.8*(e.early+e.late)/2;
      e.uncertain=es.some(other=>other!==e&&!before(e.id,other.id)&&!before(other.id,e.id));
    }
  }
  const pending=staging.filter(x=>x.migration_status==='pending');
  return {bundle,entities,anchors,scenes,sceneMap,events,records,memberships,relations,sources,evidence,staging,pending,redirects,days,issues,calendar,dateAt,ordinal,reaches,before};
}

export function filterEvents(model, filters={}) {
  const selected=new Set(filters.entities||[]);
  return model.events.filter(e=>{
    if(filters.continuity&&e.scene.continuity_id!==filters.continuity)return false;
    if(filters.origin&&e.origin!==filters.origin)return false;
    if(filters.location&&e.scene.location_id!==filters.location)return false;
    if(filters.team&&!list(e.focus_teams).includes(filters.team))return false;
    if(filters.source&&!list(e.evidence_ids).some(id=>model.evidence.get(id)?.source_id===filters.source))return false;
    if(selected.size&&!([...e.physical,...e.mentioned].some(id=>selected.has(id))))return false;
    return true;
  });
}

export function buildGeometry(model, events, {start,end,span,cross,zoom=1,vertical=false,only=new Set()}) {
  const dated=events.filter(e=>e.day!=null), visible=dated.filter(e=>e.day+1>=start&&e.day<=end);
  const ids=[...new Set(dated.flatMap(e=>[...e.physical]))].filter(id=>!only.size||only.has(id)).sort();
  // Stable, content-independent character ordering, tightened by co-presence.
  const order=new Map(ids.map((id,i)=>[id,i]));
  for(let pass=0;pass<3;pass++) {
    const totals=new Map(ids.map(id=>[id,[order.get(id),1]]));
    for(const e of dated) {
      const ps=[...e.physical].filter(id=>order.has(id));
      if(!ps.length)continue;const avg=ps.reduce((s,id)=>s+order.get(id),0)/ps.length;
      for(const id of ps){const v=totals.get(id);v[0]+=avg;v[1]++;}
    }
    ids.sort((a,b)=>totals.get(a)[0]/totals.get(a)[1]-totals.get(b)[0]/totals.get(b)[1]||a.localeCompare(b));
    ids.forEach((id,i)=>order.set(id,i));
  }
  const detail=Math.min(1,Math.max(0,Math.log2(zoom)/3));
  const available=Math.min(vertical?cross-100:cross-170,vertical?205:310);
  const spacing=ids.length<2?0:(10+Math.max(0,available-10)*detail)/Math.max(ids.length-1,1);
  const center=cross/2, natural=id=>center+(order.get(id)-(ids.length-1)/2)*spacing;
  const project=t=>(t-start)/(end-start)*span;
  const points=new Map(ids.map(id=>[id,[]])), positions=[];
  for(const e of dated) {
    const ps=[...e.physical].filter(id=>order.has(id)).sort((a,b)=>order.get(a)-order.get(b));
    const centroid=ps.length?ps.reduce((sum,id)=>sum+natural(id),0)/ps.length:center;
    // Same scene is a spatial bundle, never a background block or time ordering.
    const sceneMembers=[...new Set(events.filter(x=>x.scene.id===e.scene.id).flatMap(x=>[...x.physical]))].filter(id=>order.has(id));
    const groupCenter=sceneMembers.length?sceneMembers.reduce((sum,id)=>sum+natural(id),0)/sceneMembers.length:centroid;
    const x=project(e.position);
    const nodeY=groupCenter*.75+centroid*.25;
    ps.forEach((id,i)=>{
      const y=detail>0?nodeY+(i-(ps.length-1)/2)*Math.min(3.3,spacing*.38):natural(id);
      points.get(id).push({x,y,event:e});
    });
    positions.push({event:e,x,y:nodeY,participants:ps});
  }
  const segments=[];
  for(const [id,ps] of points) {
    ps.sort((a,b)=>a.x-b.x||a.y-b.y);
    for(let i=0;i<ps.length;i++) {
      const p=ps[i],prev=ps[i-1];
      if(prev&&p.x>prev.x+.01) {
        const connected=model.before(prev.event.id,p.event.id)||prev.event.day<p.event.day;
        // Continuity connectors do not pass through unrelated event nodes.
        if(connected)segments.push({id,a:prev,b:p,continuity:prev.event.scene.id!==p.event.scene.id});
        else segments.push({id,a:{x:p.x-9,y:p.y},b:{x:p.x+9,y:p.y},uncertain:true});
      } else segments.push({id,a:{x:p.x-11,y:p.y},b:{x:p.x+11,y:p.y},uncertain:true});
    }
  }
  // Cluster only screen-near nodes. A cluster is navigable and retains every event.
  const clusters=[];
  for(const p of positions.filter(p=>p.x>=-24&&p.x<=span+24).sort((a,b)=>a.x-b.x||a.y-b.y)) {
    let c=clusters.find(c=>Math.abs(c.x-p.x)<(detail<.35?21:17)&&Math.abs(c.y-p.y)<(detail<.35?25:15));
    if(c){c.items.push(p);c.x=c.items.reduce((s,i)=>s+i.x,0)/c.items.length;c.y=c.items.reduce((s,i)=>s+i.y,0)/c.items.length;}
    else clusters.push({x:p.x,y:p.y,items:[p]});
  }
  return {ids,segments:segments.filter(s=>Math.max(s.a.x,s.b.x)>=-40&&Math.min(s.a.x,s.b.x)<=span+40),clusters,positions,detail,spacing,visible};
}

export function pathFor(segment, time=0, vertical=false) {
  const {a,b,id}=segment,dx=b.x-a.x;
  const wave=Math.sin(time*.0006+(hash(id)%30))*Math.min(2,Math.max(0,dx*.02));
  const point=(x,y)=>vertical?`${y.toFixed(2)},${x.toFixed(2)}`:`${x.toFixed(2)},${y.toFixed(2)}`;
  return `M${point(a.x,a.y)} C${point(a.x+dx*.42,a.y+wave)} ${point(b.x-dx*.42,b.y-wave)} ${point(b.x,b.y)}`;
}
