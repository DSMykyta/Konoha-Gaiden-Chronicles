# Chronology data v10

This directory is the authoritative structured chronology source defined by `../Naruto_Timeline_Architecture_UA.md`.

- `entities.yaml` — people, animals, teams, organizations, locations, memberships.
- `sources.yaml` — sources and evidence locators.
- `time-anchors.yaml` — project calendar anchors and placement certainty.
- `scenes/` — scenes, events, physical presence intervals, local temporal relations.
- `links.yaml` — relations across scenes.
- `redirects.yaml` — legacy v10 ID migration/redirect information.
- `migration-ledger.tsv` — every legacy flat-v10 row and its migration status.

The flat `Naruto_Timeline_Year_0_v10.tsv` is no longer the authoritative editable model. Its frozen migration snapshot is kept under `../archive/`.

Current benchmark migration:
- 22.01: team announcements, classroom waiting, Team 7 rooftop, Team 9 dango, Kita home.
- 24.09: Kiba/Sakon/Ukon branch, Shikamaru/Tayuya branch, Kimimaro branch, Orochimaru body-transfer scene, Valley of the End.

Unknown cross-branch order is intentionally not invented. `display_rank` controls presentation only.

Migration discipline:
- `imported-v10.yaml` preserves every legacy record verbatim inside `data/`.
- Migrated scene files replace only rows listed in `redirects.yaml`.
- Rows with `pending` status remain available but are not yet treated as fully reviewed scene data.
- Missing cross-scene `before` links are intentional unknowns, not implicit simultaneity.
