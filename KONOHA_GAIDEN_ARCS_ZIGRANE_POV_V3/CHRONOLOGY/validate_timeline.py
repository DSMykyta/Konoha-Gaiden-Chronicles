#!/usr/bin/env python3
from pathlib import Path
from collections import defaultdict
import csv, sys, yaml

ROOT=Path(__file__).resolve().parent
DATA=ROOT/"data"
VALID_ORIGINS={"M","A","F","R","G","O","V","N","P","D"}
errors=[]

def load(path):
    with path.open("r",encoding="utf-8") as f:
        return yaml.safe_load(f)

def base_ref(ref):
    if not isinstance(ref,str): return ref
    return ref[:-6] if ref.endswith(".start") else (ref[:-4] if ref.endswith(".end") else ref)

entities=load(DATA/"entities.yaml")
sources=load(DATA/"sources.yaml")
anchors=load(DATA/"time-anchors.yaml")
links=load(DATA/"links.yaml")
redirects=load(DATA/"redirects.yaml")

entity_ids=set()
for x in entities.get("entities",[]):
    if x["id"] in entity_ids: errors.append(f"duplicate entity {x['id']}")
    entity_ids.add(x["id"])

evidence_ids={x["id"] for x in sources.get("evidence",[])}
anchor_ids={x["id"] for x in anchors.get("anchors",[])}

scene_ids=set(); event_ids=set(); global_ids=set(entity_ids)|evidence_ids|anchor_ids
before_edges=[]
scenes=[]

for path in sorted((DATA/"scenes").glob("*.yaml")):
    s=load(path); scenes.append((path,s))
    sid=s["id"]
    if sid in scene_ids: errors.append(f"duplicate scene {sid}")
    scene_ids.add(sid); global_ids.add(sid)
    loc=s.get("location_id")
    if loc is not None and loc not in entity_ids: errors.append(f"{sid}: unknown location {loc}")
    anchor=s.get("placement",{}).get("anchor_id")
    if anchor and anchor not in anchor_ids: errors.append(f"{sid}: unknown anchor {anchor}")
    local={sid}
    for e in s.get("events",[]):
        eid=e["id"]
        if eid in event_ids: errors.append(f"duplicate event {eid}")
        event_ids.add(eid); global_ids.add(eid); local.add(eid)
        if e.get("origin") not in VALID_ORIGINS: errors.append(f"{eid}: invalid origin {e.get('origin')}")
        for inv in e.get("involvement",[]):
            ent=inv.get("entity_id")
            if ent not in entity_ids: errors.append(f"{eid}: unknown entity {ent}")
        for team in e.get("focus_teams",[]):
            if team not in entity_ids: errors.append(f"{eid}: unknown focus team {team}")
        for evid in e.get("evidence_ids",[]):
            if evid not in evidence_ids: errors.append(f"{eid}: unknown evidence {evid}")
    for p in s.get("presence",[]):
        if p.get("entity_id") not in entity_ids: errors.append(f"{p.get('id')}: unknown entity {p.get('entity_id')}")
        for evid in p.get("evidence_ids",[]):
            if evid not in evidence_ids: errors.append(f"{p.get('id')}: unknown evidence {evid}")
        for k in ("from","to"):
            if base_ref(p.get(k)) not in local: errors.append(f"{p.get('id')}: {k} outside scene: {p.get(k)}")
    for r in s.get("relations",[]):
        if base_ref(r.get("a")) not in local or base_ref(r.get("b")) not in local:
            errors.append(f"{r.get('id')}: non-local relation")
        if r.get("kind")=="before": before_edges.append((base_ref(r["a"]),base_ref(r["b"])))

known=scene_ids|event_ids
for l in links.get("links",[]):
    if base_ref(l.get("a")) not in known: errors.append(f"{l.get('id')}: unknown a {l.get('a')}")
    if base_ref(l.get("b")) not in known: errors.append(f"{l.get('id')}: unknown b {l.get('b')}")
    if l.get("kind")=="before": before_edges.append((base_ref(l["a"]),base_ref(l["b"])))
    for evid in l.get("evidence_ids",[]):
        if evid not in evidence_ids: errors.append(f"{l.get('id')}: unknown evidence {evid}")

for m in entities.get("memberships",[]):
    if m.get("entity_id") not in entity_ids: errors.append(f"{m.get('id')}: unknown member entity")
    if m.get("group_id") not in entity_ids: errors.append(f"{m.get('id')}: unknown group")
    for k in ("from","to"):
        if m.get(k) and base_ref(m[k]) not in known:
            errors.append(f"{m.get('id')}: unknown membership boundary {m[k]}")

for r in redirects.get("redirects",[]):
    for rid in r.get("replacement_ids",[]):
        if rid not in event_ids and rid not in scene_ids:
            errors.append(f"{r.get('legacy_id')}: unknown replacement {rid}")

# Detect simple cycles in explicit before graph. This does not infer overlap or interval arithmetic.
adj=defaultdict(list)
for a,b in before_edges: adj[a].append(b)
state={}
def visit(n,stack):
    if state.get(n)==1:
        errors.append("before-cycle: "+" -> ".join(stack+[n])); return
    if state.get(n)==2: return
    state[n]=1
    for m in adj[n]: visit(m,stack+[n])
    state[n]=2
for n in list(adj): visit(n,[])

# Migration ledger must contain every old ID once.
with (DATA/"migration-ledger.tsv").open("r",encoding="utf-8",newline="") as f:
    lr=list(csv.DictReader(f,delimiter="\t"))
legacy=[r["LegacyEventID"] for r in lr]
if len(legacy)!=len(set(legacy)): errors.append("duplicate LegacyEventID in migration-ledger.tsv")
if len(legacy)!=346: errors.append(f"migration ledger has {len(legacy)} rows; expected 346")

if errors:
    print("\n".join(errors)); sys.exit(1)
print(f"OK: {len(scene_ids)} scenes, {len(event_ids)} events, {len(entity_ids)} entities, {len(legacy)} legacy rows tracked")
