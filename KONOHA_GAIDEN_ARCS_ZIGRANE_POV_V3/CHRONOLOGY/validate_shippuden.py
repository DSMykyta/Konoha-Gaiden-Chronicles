#!/usr/bin/env python3
# Перевірка реєстрів, покриття, посилань і спрямованих before-зв’язків.
import pathlib,yaml,json,collections
B=pathlib.Path(__file__).resolve().parent;R=B.parents[1];D=B/'data';load=lambda n:yaml.safe_load((D/(n+'.yaml')).read_text());S={p.stem:yaml.safe_load(p.read_text()) for p in (D/'scenes').glob('*.yaml')};N={k:v for k,v in S.items() if k.startswith('sc-s2-')};errors=[];idsets={}
for name,key in [('entities','entities'),('entities','memberships'),('arcs','arcs'),('episodes','episodes'),('sources','sources'),('sources','evidence'),('time-anchors','anchors'),('links','links')]:
 arr=load(name)[key];ids=[x.get('id')for x in arr];dups=[k for k,v in collections.Counter(ids).items()if v>1];
 if dups:errors.append(('duplicates',name,key,dups))
 idsets[key]=set(ids)
E={e['id']:s for s in S.values() for e in s.get('events',[])};nodes={**S,**E};anchors={x['id']:x.get('date')for x in load('time-anchors')['anchors']};periods={x['id']for x in load('timeline-periods')['periods']}
for s in N.values():
 for k,v in [('episodes',s['episode_id']),('entities',s.get('location_id'))]:
  if v and v not in idsets[k]:errors.append(('missing',s['id'],k,v))
 for k in ['anchor_id','end_anchor_id']:
  v=(s.get('placement')or{}).get(k)
  if v and v not in idsets['anchors']:errors.append(('missing anchor',s['id'],v))
 for e in s['events']:
  for i in e['involvement']:
   if i['entity_id']not in idsets['entities']:errors.append(('actor',e['id'],i['entity_id']))
  for v in e['evidence_ids']:
   if v not in idsets['evidence']:errors.append(('evidence',e['id'],v))
 for p in s.get('presence',[]):
  if p['entity_id']not in idsets['entities']:errors.append(('presence actor',s['id'],p['entity_id']))
for s in load('sources')['sources']:
 if s['id'].startswith(('src-s2-','src-subtitle-')) and s.get('path') and not (R/s['path']).is_file():errors.append(('file',s['id'],s['path']))
for e in load('sources')['evidence']:
 if e['id'].startswith('evd-s2-'):
  for v in [e.get('source_id')]+e.get('source_ids',[]):
   if v and v not in idsets['sources']:errors.append(('source',e['id'],v))
for a in load('arcs')['arcs']:
 if a['id'].startswith('arc-s2-')and a['period_id']not in periods:errors.append(('period',a['id'],a['period_id']))
C=json.loads((B/'SHIPPUDEN_COVERAGE.json').read_text())
for r in C['episodes']:
 if r['episode']<=256 and not r['scene_ids']:errors.append(('coverage gap',r['episode']))
 for v in r['scene_ids']:
  if v not in S:errors.append(('coverage id',r['episode'],v))
def day(s):
 p=s.get('placement')or{};d=anchors.get(p.get('anchor_id'))
 if d:return (d['year']-1)*365+sum([31,28,31,30,31,30,31,31,30,31,30,31][:d['month']-1])+d['day']-1+p.get('day_offset',0)
G=collections.defaultdict(list)
for l in load('links')['links']+[l for s in S.values() for l in s.get('relations',[])]:
 if l.get('kind')!='before':continue
 a=l['a'].rsplit('.',1)[0]if l['a'].endswith(('.start','.end'))else l['a'];b=l['b'].rsplit('.',1)[0]if l['b'].endswith(('.start','.end'))else l['b'];G[a].append(b)
 if l['id'].startswith('lnk-s2-'):
  if a not in nodes or b not in nodes:errors.append(('link node',l['id'],a,b));continue
  x=day(nodes[a]);y=day(nodes[b])
  if x is not None and y is not None and x>y:errors.append(('reversed link',l['id']))
color={}
def dfs(n):
 if color.get(n)==1:errors.append(('cycle',n));return
 if color.get(n)==2:return
 color[n]=1
 for v in G[n]:dfs(v)
 color[n]=2
for n in list(G):dfs(n)
print(json.dumps({'new_scenes':len(N),'new_moments':sum(len(s['events'])for s in N.values()),'undated_new_scenes':sum(not s.get('placement')for s in N.values()),'all_scenes':len(S),'errors':errors},ensure_ascii=False,indent=2))
raise SystemExit(bool(errors))
