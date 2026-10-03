# Structured chronology

This directory is the authoritative structured chronology source defined by `../Naruto_Timeline_Architecture_UA.md`.

- `entities.yaml` — people, animals, teams, organizations, locations, memberships.
- `sources.yaml` — sources and evidence locators.
- `time-anchors.yaml` — project calendar anchors and placement certainty.
- `arcs.yaml` — story arcs, continuity, era (`period_id`), editorial type (`kind`).
- `episodes.yaml` — coherent narrative lines, each referencing one arc.
- `timeline-periods.yaml` — configured calendar eras.

Calendar years count from Konoha's founding (year 1); the active dataset is year 61. Historical ranges are explicitly marked as project reconstruction. Dates before the founding use `era: before_founding` with positive year numbers. See `../CALENDAR_UA.md` for sources, uncertainty, same-year era boundaries and the migration from legacy year 0.

`../TIME_SLIP_UA.md` records the «Мандрівні артисти» arc, separate traveller profiles and past-only source scope. `../AUTUMN_PLACEMENT_UA.md` documents resolved participant conflicts and the subsequent mission schedule into January of year 62. All these dates are project working dates.
- `scenes/` — scenes, events, physical presence intervals, local temporal relations.
- `links.yaml` — relations across scenes.
- `redirects.yaml` — legacy v10 ID migration/redirect information.
- `migration-ledger.tsv` — every legacy flat-v10 row and its migration status.

The flat `Naruto_Timeline_Year_0_v10.tsv` is no longer the authoritative editable model. Its frozen migration snapshot is kept under `../archive/`.

Current benchmark migration:
- 22.01: team announcements, classroom waiting, Team 7 rooftop, Team 9 dango.
- 23.01: Team 7 and Team 9 tests; Kiba meets Kita after Raido's evaluation; evening Ichiraku; mentor reports; Kita's home scene closes the day.
- 24.09: Kiba/Sakon/Ukon branch, Shikamaru/Tayuya branch, Kimimaro branch, Orochimaru body-transfer scene, Valley of the End.

Unknown cross-branch order is intentionally not invented. `display_rank` controls presentation only.

Migration discipline:
- `imported-v10.yaml` preserves every legacy record verbatim inside `data/`.
- Migrated scene files replace only rows listed in `redirects.yaml`.
- Rows with `pending` status remain available but are not yet treated as fully reviewed scene data.
- Missing cross-scene `before` links are intentional unknowns, not implicit simultaneity.


Hierarchy is **moment → scene → episode → arc**. The source stores only child-to-parent references: `scene.episode_id` and `episode.arc_id`. Derived `scene_ids`, `episode_ids`, date ranges and `scene.arc_id` exist only in the built site data. Every scene has a parent, including draft and inactive records; inactive scenes do not contribute displayed children or date ranges.

An episode follows one narrative line. Independent parallel actions are separate episodes even on the same day. A change of setting creates a scene; one coherent goal may span several scenes. Author arcs coexist with canonical arcs in `main`; source continuities remain separate. Calendar-shooting stories belong to the timeskip era, which must be configured before their dates can be published.

Validation: `python validate_timeline.py` from `CHRONOLOGY/`. Site validation: `npm --prefix SITE test` from repository root. Validators check references and continuity; editorial review is still needed to decide whether a narrative line is coherent.

`mission-windows.yaml` — чинні робочі резерви дороги, участі й відновлення після відходу Саске; збірка перевіряє їх проти фізичної присутності в усіх активних датованих сценах. Підстави — `../POST_SASUKE_SCHEDULE_UA.md`.
