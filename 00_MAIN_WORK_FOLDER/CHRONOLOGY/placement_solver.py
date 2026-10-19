#!/usr/bin/env python3
"""Read-only chronology audit and tentative date placement.

Requires PyYAML, already used by validate_timeline.py. When installed,
Google OR-Tools CP-SAT can find a globally consistent tentative scenario.
This tool NEVER edits the canonical chronology.
"""
from __future__ import annotations
import argparse
from collections import defaultdict
import json
from pathlib import Path
import sys
import yaml

MONTHS=(31,28,31,30,31,30,31,31,30,31,30,31)
PHYSICAL={"physical","physical_hidden"}
ALIAS={"c-guy":"c-might-guy"}

def read(path):
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {}

def number(date):
    if not isinstance(date,dict):
        return None
    y,m,d=(date.get(k) for k in ("year","month","day"))
    if not all(type(v) is int for v in (y,m,d)) or y<1 or not 1<=m<=12 or not 1<=d<=MONTHS[m-1]:
        raise ValueError("Invalid project date: "+str(date))
    era=date.get("era","after_founding")
    if era not in ("after_founding","before_founding"):
        raise ValueError("Unknown era "+str(era))
    return ((y-1)*365 if era=="after_founding" else -y*365)+sum(MONTHS[:m-1])+d-1

def display(day):
    if day is None:
        return "невідомо"
    before=day<0
    if before:
        year=(-day-1)//365+1
        within=day+year*365
    else:
        year,within=divmod(day,365)
        year+=1
    month=1
    for length in MONTHS:
        if within<length: break
        within-=length
        month+=1
    return f"{within+1:02d}.{month:02d}.{year}"+(" до заснування Конохи" if before else "")

def norm(actor):
    return ALIAS.get(actor,actor)

def cast(scene, substitute=None, event_overrides=None):
    # Mirror SITE/scripts/naruto-variants.mjs for physical involvement.
    # Source scenes retain the original anime cast, but the published
    # working continuity uses the explicit non-Naruto editorial variant.
    event_overrides=event_overrides or {}
    out=set()
    for event in scene.get("events") or []:
        override=event_overrides.get(event["id"],{})
        present=set()
        for p in event.get("involvement") or []:
            actor=p.get("entity_id")
            if substitute and actor=="c-naruto":
                actor=substitute
            if actor and p.get("mode") in PHYSICAL and p.get("role")!="mentioned":
                present.add(norm(actor))
        present-=set(map(norm,override.get("remove_entities") or []))
        present.update(map(norm,override.get("add_entities") or []))
        out.update(present)
    out.update(norm(substitute if substitute and p.get("entity_id")=="c-naruto" else p["entity_id"])
               for p in scene.get("presence") or []
               if p.get("entity_id") and p.get("review")=="accepted")
    return out

def country(loc,geography):
    kinds={**(geography.get("kinds") or {}),
           **{r["id"]:r.get("kind") for r in geography.get("regions") or []}}
    parents=geography.get("parents") or {}
    equivalents=geography.get("equivalents") or {}
    seen=set()
    while loc and loc not in seen:
        if kinds.get(loc)=="country": return loc
        seen.add(loc)
        loc=equivalents.get(loc) or parents.get(loc)
    return None

def local_konoha(loc,entities):
    seen=set()
    while loc and loc not in seen:
        if loc=="loc-konohagakure": return True
        seen.add(loc)
        loc=entities.get(loc,{}).get("parent_id")
    return False

def load_project(data):
    names=("time-anchors","episodes","entities","links","mission-windows","geography")
    files={name:read(data/(name+".yaml")) for name in names}
    optional=read(data/"naruto-optional.yaml") if (data/"naruto-optional.yaml").exists() else {}
    variants={a["arc_id"]:a["substitute_id"] for a in optional.get("arcs") or []}
    anchors={a["id"]:a for a in files["time-anchors"].get("anchors",[])}
    episodes={e["id"]:e for e in files["episodes"].get("episodes",[])}
    entities={e["id"]:e for e in files["entities"].get("entities",[])}
    mission=files["mission-windows"]
    mission_base=number({"year":mission.get("calendar_base_year",1),"month":1,"day":1})
    scenes={}
    references={}
    for path in sorted((data/"scenes").glob("*.yaml")):
        scene=read(path)
        sid=scene["id"]
        if sid in scenes: raise ValueError("Duplicate scene "+sid)
        anchor=anchors.get((scene.get("placement") or {}).get("anchor_id"),{})
        placement=scene.get("placement") or {}
        day=number(anchor.get("date"))
        if day is not None: day+=placement.get("day_offset") or 0
        if sid in (mission.get("scene_days") or {}):
            day=mission_base+mission["scene_days"][sid]
        episode=episodes.get(scene.get("episode_id"),{})
        arc_id=episode.get("arc_id")
        scenes[sid]={"id":sid,"day":day,"state":scene.get("state"),
                     "arc_id":arc_id,
                     "location":scene.get("location_id"),
                     "cast":cast(scene,variants.get(arc_id),optional.get("event_overrides") if arc_id in variants else None),
                     "relations":scene.get("relations") or [],
                     "continuity":scene.get("continuity_id"),
                     "path":path.relative_to(data).as_posix()}
        references[sid]=sid
        for event in scene.get("events") or []:
            references[event["id"]]=sid
    return scenes,references,files,entities,mission_base

def base_ref(ref):
    ref=str(ref or "")
    for suffix in (".start",".end"):
        if ref.endswith(suffix): return ref[:-len(suffix)]
    return ref

def edges_for(scenes,refs,links,config):
    edges=[]
    missing=[]
    inactive=[]
    relations=list(links.get("links") or [])
    relations.extend(r for s in scenes.values() for r in s["relations"])
    for r in relations:
        if r.get("kind")!="before" or r.get("review")!="accepted":
            continue
        a,b=(refs.get(base_ref(r.get(k))) for k in ("a","b"))
        if not a or not b:
            missing.append(r.get("id","unnamed"))
        elif a!=b and a in scenes and b in scenes:
            edges.append((a,b,0,r.get("id","unnamed")))
        elif a not in scenes or b not in scenes:
            inactive.append(r.get("id","unnamed"))
    for r in config.get("constraints") or []:
        if r.get("review")!="accepted" or r.get("kind")!="min_gap_days":
            continue
        a,b,gap=r.get("a"),r.get("b"),r.get("days")
        if a not in scenes or b not in scenes or type(gap) is not int or gap<0:
            missing.append(r.get("id","unnamed"))
        elif a!=b:
            edges.append((a,b,gap,r.get("id","unnamed")))
    return edges,missing,inactive

def bounds_for(scenes,edges,config):
    requests={}
    issues=[]
    for rec in config.get("windows") or []:
        sid=rec.get("scene_id")
        if sid not in scenes or sid in requests:
            issues.append({"kind":"invalid_window","id":str(sid)})
        else:
            requests[sid]=rec
    bounds={}
    for sid,s in scenes.items():
        if s["day"] is not None:
            bounds[sid]=[s["day"],s["day"]]
        else:
            rec=requests.get(sid,{})
            bounds[sid]=[number(rec.get("not_before")),number(rec.get("not_after"))]
    for iteration in range(len(scenes)+1):
        changed=False
        for a,b,gap,_ in edges:
            la,ua=bounds[a]
            lb,ub=bounds[b]
            if la is not None and (lb is None or la+gap>lb) and scenes[b]["day"] is None:
                bounds[b][0]=la+gap
                changed=True
            if ub is not None and (ua is None or ub-gap<ua) and scenes[a]["day"] is None:
                bounds[a][1]=ub-gap
                changed=True
        if not changed: break
        if iteration==len(scenes):
            issues.append({"kind":"positive_gap_cycle","id":"relative_order"})
    for a,b,gap,rid in edges:
        la,ub=bounds[a][0],bounds[b][1]
        if la is not None and ub is not None and la+gap>ub:
            issues.append({"kind":"before_conflict","id":rid,"a":a,"b":b,
                           "details":f"{display(la)} + {gap} днів > {display(ub)}"})
    for sid,(lo,hi) in bounds.items():
        if lo is not None and hi is not None and lo>hi:
            issues.append({"kind":"empty_window","id":sid,
                           "details":f"{display(lo)} > {display(hi)}"})
    return bounds,requests,issues

def mission_conflict(scene,day,mission,mission_base,entities):
    sid=scene["id"]
    if (scene["arc_id"] or "").startswith("arc-alt-") or sid in set(mission.get("neutral_scene_ids") or []):
        return None
    for w in mission.get("arcs") or []:
        arc=w.get("arc_id","")
        if arc.startswith("arc-alt-") or arc==scene["arc_id"]:
            continue
        if not mission_base+w["occupied_start"]<=day<=mission_base+w["occupied_end"]:
            continue
        shared=scene["cast"] & set(map(norm,w.get("actors") or []))
        if not shared: continue
        if w.get("route")=="" and day>mission_base+w["end"] and local_konoha(scene["location"],entities):
            continue
        return {"arc":arc,"actors":sorted(shared)}
    return None

def optimize(proposals,edges,scenes):
    try:
        from ortools.sat.python import cp_model
    except ImportError:
        return {"engine":"interval-propagation","status":"OR-Tools unavailable","assignments":{}}
    eligible=[p for p in proposals if p.get("status")=="candidate" and p.get("days")]
    if not eligible:
        return {"engine":"OR-Tools CP-SAT","status":"no bounded candidates","assignments":{}}
    model=cp_model.CpModel()
    vars={p["scene_id"]:model.new_int_var_from_domain(
          cp_model.Domain.from_values(p["days"]),p["scene_id"]) for p in eligible}
    for a,b,gap,_ in edges:
        left=vars.get(a,scenes[a]["day"])
        right=vars.get(b,scenes[b]["day"])
        if left is not None and right is not None:
            model.add(left+gap<=right)
    deviations=[]
    for p in eligible:
        preferred=p.get("preferred")
        if preferred is None: continue
        max_distance=max(abs(d-preferred) for d in p["days"])
        diff=model.new_int_var(0,max_distance,"difference-"+p["scene_id"])
        model.add_abs_equality(diff,vars[p["scene_id"]]-preferred)
        deviations.append(diff)
    if deviations: model.minimize(sum(deviations))
    solver=cp_model.CpSolver()
    solver.parameters.max_time_in_seconds=5.0
    solver.parameters.num_search_workers=1
    status=solver.solve(model)
    if status not in (cp_model.OPTIMAL,cp_model.FEASIBLE):
        return {"engine":"OR-Tools CP-SAT","status":"infeasible or unknown","assignments":{}}
    return {"engine":"OR-Tools CP-SAT","status":"feasible",
            "assignments":{sid:int(solver.value(v)) for sid,v in vars.items()}}

def investigate(data,config=None):
    config=config or {"windows":[],"constraints":[]}
    scenes,refs,files,entities,mission_base=load_project(data)
    active={sid:s for sid,s in scenes.items() if s["state"]=="active"}
    mission=files["mission-windows"]
    edges,missing,inactive_refs=edges_for(active,refs,files["links"],config)
    bounds,requests,issues=bounds_for(active,edges,config)
    for sid,s in active.items():
        if s["day"] is None: continue
        conflict=mission_conflict(s,s["day"],mission,mission_base,entities)
        if conflict:
            issues.append({"kind":"mission_conflict","id":sid,"with":conflict["arc"],
                           "details":", ".join(conflict["actors"])+" / "+display(s["day"])})
    missions=[m for m in mission.get("arcs") or []
              if not m.get("arc_id","").startswith("arc-alt-")]
    for i,a in enumerate(missions):
        for b in missions[i+1:]:
            shared=set(map(norm,a.get("actors") or [])) & set(map(norm,b.get("actors") or []))
            if shared and a["occupied_start"]<=b["occupied_end"] and b["occupied_start"]<=a["occupied_end"]:
                issues.append({"kind":"mission_overlap","id":a["arc_id"],"with":b["arc_id"],
                               "details":", ".join(sorted(shared))})
    appearances=defaultdict(list)
    parallel=defaultdict(list)
    for sid,s in active.items():
        day=s["day"]
        if day is None or (s["arc_id"] or "").startswith("arc-alt-"): continue
        parallel[day].append(sid)
        location_country=country(s["location"],files["geography"])
        if location_country:
            for actor in s["cast"]:
                appearances[(day,actor)].append((sid,location_country,s["continuity"]))
    suspected=[]
    cross_continuities=[]
    for (day,actor),records in appearances.items():
        by_continuity=defaultdict(list)
        for sid,country_id,continuity in records:
            by_continuity[continuity].append((sid,country_id))
        for continuity,group in by_continuity.items():
            countries=sorted({country_id for _,country_id in group})
            if len(countries)>1:
                suspected.append({"day":day,"actor":actor,"continuity":continuity,
                                  "countries":countries,"scenes":sorted({sid for sid,_ in group})})
        all_countries={country_id for _,country_id,_ in records}
        if len(all_countries)>1 and len(by_continuity)>1:
            cross_continuities.append({"day":day,"actor":actor,
                                      "continuities":sorted(map(str,by_continuity)),
                                      "scenes":sorted({sid for sid,_,_ in records})})
    parallel_days=sum(1 for ids in parallel.values() if len(ids)>1 and
                      any(not(active[a]["cast"] & active[b]["cast"])
                          for i,a in enumerate(ids) for b in ids[i+1:]))
    proposals=[]
    for sid,s in active.items():
        if s["day"] is not None: continue
        lo,hi=bounds[sid]
        if lo is None or hi is None or lo>hi: continue
        if hi-lo>365:
            proposals.append({"scene_id":sid,"window":[lo,hi],"status":"too_wide"})
            continue
        days=[day for day in range(lo,hi+1)
              if not mission_conflict(s,day,mission,mission_base,entities)]
        preferred=number(requests.get(sid,{}).get("preferred"))
        if preferred is not None: days.sort(key=lambda d:(abs(d-preferred),d))
        proposals.append({"scene_id":sid,"window":[lo,hi],
                          "status":"candidate" if days else "blocked",
                          "count":len(days),"preferred":preferred,
                          "suggested":days[0] if days and (preferred is not None or len(days)==1) else None,
                          "alternatives":days[:3],"days":days})
    optimizer=optimize(proposals,edges,active)
    for proposal in proposals:
        chosen=optimizer["assignments"].get(proposal["scene_id"])
        if chosen is not None and (proposal.get("preferred") is not None or proposal.get("count")==1):
            proposal["suggested"]=chosen
        proposal.pop("days",None)
    return {"statistics":{
              "all_scenes":len(scenes),"active_scenes":len(active),
              "dated_active":sum(s["day"] is not None for s in active.values()),
              "undated_active":sum(s["day"] is None for s in active.values()),
              "accepted_before_edges":len(edges),"parallel_days":parallel_days,
              "unknown_accepted_references":len(missing),
              "inactive_relation_references":len(inactive_refs)},
            "optimizer":optimizer if optimizer["status"]!="feasible" else {
                **optimizer,"assignments":{
                  k:v for k,v in optimizer["assignments"].items()
                  if any(p["scene_id"]==k and p.get("suggested") is not None for p in proposals)}},
            "issues":issues,"suspected_travel":sorted(suspected,key=lambda x:(x["day"],x["actor"])),
            "cross_continuity":sorted(cross_continuities,key=lambda x:(x["day"],x["actor"])),
            "unknown_refs":missing,"inactive_refs":inactive_refs,"proposals":proposals,
            "no_finite_window":sum(s["day"] is None and
                                   (bounds[sid][0] is None or bounds[sid][1] is None)
                                   for sid,s in active.items())}

def make_report(result):
    stat=result["statistics"]
    out=["# Аудит сюжетної хронології та пошук дат","",
         "Технічний звіт за структурованими YAML. Жодну дату або сюжет автоматично не змінено.","",
         "## Охоплення","",
         f"- Усього сцен: {stat['all_scenes']}; активних: {stat['active_scenes']}.",
         f"- Датованих: {stat['dated_active']}; без дати: {stat['undated_active']}.",
         f"- Прийнятих умов порядку: {stat['accepted_before_edges']}.",
         f"- Днів з незалежними паралельними подіями: {stat['parallel_days']}.",
         f"- Справді невідомих посилань у прийнятих умовах: {stat['unknown_accepted_references']}.",
         f"- Зв'язків із неактивними сценами, пропущених коректно: {stat['inactive_relation_references']}.",
         f"- Рушій: {result['optimizer']['engine']}; статус: {result['optimizer']['status']}.","",
         "## Підтверджені структурні або календарні суперечності","",
         f"Знайдено: {len(result['issues'])}. Перед зміною слід перевірити першоджерело.",""]
    for issue in result["issues"][:80]:
        out.append("- **"+issue["kind"]+"** "+str(issue.get("id","?"))+
                   " : "+str(issue.get("details",""))+
                   ("; зайнято аркою "+str(issue["with"]) if issue.get("with") else ""))
    if len(result["issues"])>80: out.append("- Інші випадки у JSON-звіті.")
    if not result["issues"]: out.append("- За реалізованими правилами не виявлено; це не повний сюжетний аудит.")
    out.extend(["","## Прийняті зв’язки з невідомими посиланнями","",
                "Не враховані у датуванні до перевірки ID:",""])
    out.extend("- "+str(ref) for ref in result["unknown_refs"][:80])
    if not result["unknown_refs"]: out.append("- Немає.")
    out.extend(["","## Посилання на неактивні сцени","",
                "Це відомі ID, але сцени виключені з поточної хронології. Не слід повертати їх до активних лише через зв'язок.",""])
    out.extend("- "+str(ref) for ref in result["inactive_refs"][:80])
    if not result["inactive_refs"]: out.append("- Немає.")
    out.extend(["","## Можливі географічні колізії — не доведені","",
                f"Випадків: {len(result['suspected_travel'])}. Різні країни за день не доводять неможливість пересування.",""])
    for item in result["suspected_travel"][:60]:
        out.append("- "+display(item["day"])+" "+item["actor"]+": "+", ".join(item["countries"])+
                   "; сцени "+", ".join(item["scenes"][:8]))
    if len(result["suspected_travel"])>60: out.append("- Інші випадки у JSON-звіті.")
    out.extend(["","## Різні тяглості джерел (не пряма колізія)","",
                f"Випадків: {len(result['cross_continuity'])}. Потребують окремого авторського рішення про сумісність.",""])
    for item in result["cross_continuity"][:60]:
        out.append("- "+display(item["day"])+" "+item["actor"]+": "+
                   ", ".join(item["continuities"])+"; сцени "+", ".join(item["scenes"]))
    if not result["cross_continuity"]: out.append("- Немає.")
    out.extend(["","## Не датовані та можливі дати","",
                f"Без підтверджених двосторонніх меж: {result['no_finite_window']}; дати не вигадуються.","",
                "| Сцена | Допустимий інтервал | Висновок |","|---|---|---|"])
    for item in result["proposals"][:80]:
        lo,hi=item["window"]
        if item["status"]=="too_wide": label="надто широкий проміжок"
        elif item["status"]=="blocked": label="усі дні зайняті"
        elif item.get("suggested") is not None: label="попередня пропозиція "+display(item["suggested"])
        else: label="можливих днів "+str(item["count"])+"; дата не обрана"
        out.append("| "+item["scene_id"]+" | "+display(lo)+" — "+display(hi)+" | "+label+" |")
    if not result["proposals"]: out.append("| — | — | Доказових двосторонніх меж немає |")
    if len(result["proposals"])>80: out.append("Решта пропозицій у JSON.")
    out.extend(["","## Межі автоматизації","",
                "- Одна дата не означає одну годину: перетини персонажів у той самий день не є автоматичною суперечністю.",
                "- Присутність віддалено або лише у згадці не означає фізичної присутності.",
                "- Географію перевірено тільки для відомих країн; альтернативні арки не зіставляються з основними як тверда колізія.",
                "- Власні історії, що ще не розмічені як сцени, цей інструмент не читав.",
                "- Звіт лише пропонує, не змінює YAML, затверджені дати чи сайт.",""])
    return "\n".join(out)

def main(argv=None):
    here=Path(__file__).resolve().parent
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data",type=Path,default=here/"data")
    parser.add_argument("--windows",type=Path,default=here/"placement-windows.yaml")
    parser.add_argument("--report",type=Path,default=here/"PLACEMENT_AUDIT_UA.md")
    parser.add_argument("--json",type=Path,default=None)
    parser.add_argument("--strict",action="store_true")
    args=parser.parse_args(argv)
    config=read(args.windows) if args.windows.exists() else {"windows":[],"constraints":[]}
    result=investigate(args.data,config)
    args.report.parent.mkdir(parents=True,exist_ok=True)
    args.report.write_text(make_report(result),encoding="utf-8")
    if args.json:
        args.json.parent.mkdir(parents=True,exist_ok=True)
        args.json.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("Scenes:",result["statistics"]["active_scenes"],
          "issues:",len(result["issues"]),
          "travel-review:",len(result["suspected_travel"]),
          "proposals:",len(result["proposals"]),
          "engine:",result["optimizer"]["engine"])
    print("Report:",args.report)
    return 1 if args.strict and result["issues"] else 0

if __name__=="__main__":
    sys.exit(main())
