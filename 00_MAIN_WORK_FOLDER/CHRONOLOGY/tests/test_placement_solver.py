"""Regression tests for the non-destructive chronology placement auditor."""
import importlib.util
import tempfile
import unittest
from pathlib import Path
import yaml

FILE=Path(__file__).resolve().parent.parent/"placement_solver.py"
spec=importlib.util.spec_from_file_location("placement_solver",FILE)
solver=importlib.util.module_from_spec(spec)
spec.loader.exec_module(solver)

def save(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(yaml.safe_dump(data,allow_unicode=True,sort_keys=False),encoding="utf-8")

class PlacementTests(unittest.TestCase):
    def setUp(self):
        temp=tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.data=Path(temp.name)/"data"
        self.data.mkdir()
        self.scenes=[]
        self.links=[]
        self.missions=[]

    def scene(self,sid,day=None,actor="c-a",mode="physical",location="loc-konohagakure",arc="arc-a"):
        doc={"id":sid,"episode_id":"ep-"+arc,"state":"active",
             "continuity_id":"main","location_id":location,
             "placement":{"anchor_id":"ta-"+str(day)} if day is not None else None,
             "events":[{"id":"ev-"+sid,"involvement":[
               {"entity_id":actor,"role":"participant","mode":mode}]}]}
        self.scenes.append((sid,doc))
        return doc

    def audit(self,config=None):
        save(self.data/"time-anchors.yaml",{"anchors":[
            {"id":"ta-"+str(d),"date":{"year":62,"month":1,"day":d}} for d in range(1,15)]})
        arcs={s["episode_id"][3:] for _,s in self.scenes}
        save(self.data/"episodes.yaml",{"episodes":[{"id":"ep-"+a,"arc_id":a} for a in sorted(arcs)]})
        save(self.data/"entities.yaml",{"entities":[{"id":"loc-konohagakure"},
            {"id":"loc-land-of-snow"}]})
        save(self.data/"links.yaml",{"links":self.links})
        save(self.data/"mission-windows.yaml",{"calendar_base_year":62,
            "scene_days":{},"arcs":self.missions})
        save(self.data/"geography.yaml",{"kinds":{"loc-konohagakure":"settlement",
            "loc-land-of-snow":"country","loc-land-of-fire":"country"},
            "parents":{"loc-konohagakure":"loc-land-of-fire"}})
        for sid,s in self.scenes: save(self.data/"scenes"/(sid+".yaml"),s)
        return solver.investigate(self.data,config)

    def test_calendar_before_founding(self):
        before={"year":1,"month":12,"day":31,"era":"before_founding"}
        after={"year":1,"month":1,"day":1}
        self.assertEqual(solver.number(before)+1,solver.number(after))
        self.assertEqual(solver.display(solver.number(after)),"01.01.1")

    def test_parallel_independent_stories_are_allowed(self):
        self.scene("a",4,actor="a")
        self.scene("b",4,actor="b",location="loc-land-of-snow")
        result=self.audit()
        self.assertEqual(result["statistics"]["parallel_days"],1)
        self.assertEqual(result["issues"],[])
        self.assertEqual(result["suspected_travel"],[])

    def test_accepted_order_conflict(self):
        self.scene("later",5)
        self.scene("earlier",2)
        self.links=[{"id":"bad","a":"later","b":"earlier","kind":"before","review":"accepted"}]
        self.assertTrue(any(x["kind"]=="before_conflict" for x in self.audit()["issues"]))

    def test_pending_order_is_not_assumed(self):
        self.scene("later",5)
        self.scene("earlier",2)
        self.links=[{"id":"tentative","a":"later","b":"earlier","kind":"before","review":"pending"}]
        self.assertEqual(self.audit()["issues"],[])

    def test_remote_actor_does_not_teleport(self):
        self.scene("a",4,mode="remote")
        self.scene("b",4,location="loc-land-of-snow")
        self.assertEqual(self.audit()["suspected_travel"],[])

    def test_same_day_two_countries_is_review_not_failure(self):
        self.scene("a",4)
        self.scene("b",4,location="loc-land-of-snow")
        result=self.audit()
        self.assertEqual(len(result["suspected_travel"]),1)
        self.assertEqual(result["issues"],[])

    def test_mission_occupation_blocks_participant(self):
        self.scene("other",4,arc="arc-b")
        self.missions=[{"arc_id":"arc-a","start":3,"end":5,
            "occupied_start":3,"occupied_end":6,"actors":["c-a"],
            "route":"long route","return_days":1,"rest_days":0}]
        self.assertTrue(any(x["kind"]=="mission_conflict" for x in self.audit()["issues"]))

    def test_undated_scene_bounded_and_preferred(self):
        self.scene("start",2)
        self.scene("undated",None,arc="arc-b")
        self.scene("end",5)
        self.links=[{"id":"r1","a":"start","b":"undated","kind":"before","review":"accepted"},
                    {"id":"r2","a":"undated","b":"end","kind":"before","review":"accepted"}]
        config={"windows":[{"scene_id":"undated",
              "not_before":{"year":62,"month":1,"day":3},
              "not_after":{"year":62,"month":1,"day":4},
              "preferred":{"year":62,"month":1,"day":4}}]}
        proposal=self.audit(config)["proposals"][0]
        self.assertEqual(proposal["count"],2)
        self.assertEqual(solver.display(proposal["suggested"]),"04.01.62")

    def test_source_naruto_is_replaced_in_published_variant(self):
        self.scene("variant",4,actor="c-naruto",arc="arc-b")
        save(self.data/"naruto-optional.yaml",{
            "arcs":[{"arc_id":"arc-b","substitute_id":"c-shino"}]})
        self.missions=[{"arc_id":"arc-a","start":3,"end":5,
                        "occupied_start":3,"occupied_end":6,
                        "actors":["c-naruto"],"route":"away",
                        "return_days":1,"rest_days":0}]
        self.assertEqual(self.audit()["issues"],[])
        # The replacement is a physical participant, not a missing cast.
        self.missions[0]["actors"]=["c-shino"]
        self.assertTrue(any(x["kind"]=="mission_conflict" for x in self.audit()["issues"]))

    def test_one_sided_bound_does_not_invent_date(self):
        self.scene("past",None)
        self.scene("future",4)
        self.links=[{"id":"past-before","a":"past","b":"future",
                     "kind":"before","review":"accepted"}]
        result=self.audit()
        self.assertEqual(result["proposals"],[])
        self.assertEqual(result["no_finite_window"],1)

    def test_confirmed_minimum_travel_gap(self):
        self.scene("depart",4)
        self.scene("arrive",None,arc="arc-b")
        config={"windows":[{"scene_id":"arrive",
              "not_before":{"year":62,"month":1,"day":4},
              "not_after":{"year":62,"month":1,"day":8}}],
              "constraints":[{"id":"travel","a":"depart","b":"arrive",
                "kind":"min_gap_days","days":3,"review":"accepted"}]}
        proposal=self.audit(config)["proposals"][0]
        self.assertEqual(solver.display(proposal["window"][0]),"07.01.62")
        self.assertEqual(proposal["count"],2)

if __name__=="__main__":
    unittest.main()
