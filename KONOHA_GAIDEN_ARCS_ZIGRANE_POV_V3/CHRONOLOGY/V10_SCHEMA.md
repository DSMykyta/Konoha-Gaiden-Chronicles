# Naruto Timeline v10 — structured model

The authoritative v10 chronology is now the structured dataset under `CHRONOLOGY/data/`, governed by `Naruto_Timeline_Architecture_UA.md`.

The old flat TSV is preserved as an import/export artifact, not as the editable source of truth:
- frozen snapshot: `archive/Naruto_Timeline_Year_0_v10_import.tsv`
- verbatim staging copy of every legacy row: `data/imported-v10.yaml`
- one migration status per legacy ID: `data/migration-ledger.tsv`
- legacy redirects/splits: `data/redirects.yaml`

Core rules:
1. One historical event is stored once.
2. Scenes have locations and contain events, presence intervals and local temporal constraints.
3. Physical presence is separate from focus, mention, remote effect and portrayal.
4. `display_rank` is only presentation order. It never proves chronology.
5. Unknown relative order is represented by absence of a `before` relation; it is not encoded as simultaneity or an `unordered` fact.
6. Date anchors can move related scenes without changing event IDs.
7. Each event has one `Origin`: M / A / F / R / G / O / V / N / P / D.
8. Adaptations and repeated tellings attach as evidence/supporting sources instead of duplicating the historical event.
9. Legacy content is never silently deleted: each old ID is pending, migrated, merged, superseded or partial.
10. Generated site indexes and TSV exports must be rebuilt from `data/`; they are not independently editable.

Current benchmark migrations:
- 22.01 — classroom formation/waiting, Team 7 and Team 9 branches, background presence.
- 24.09 — parallel Sasuke Recovery branches and Valley of the End without invented cross-branch order.

Run `python CHRONOLOGY/validate_timeline.py` before treating a structured-data revision as valid.
