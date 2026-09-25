# Naruto Timeline v10 schema

## Core model
One row = one historical event. A date may have 1 row or 20+ rows. v9 remains unchanged.

## Columns
- Year — project year.
- Date — DD.MM.
- DayPart — dawn / morning / noon / afternoon / evening / night / late_night / unknown.
- ExactTime — only when explicitly stated by a source.
- Order — order inside one date. Base step = 100. Insertions may use any integer between existing values.
- EventID — permanent event identifier. Once v10 migration is finalized, never renumber it because date/order/text changes.
- Track — lineage of the migrated v9 column: World / NARUTO / T9LM. It is not the event origin.
- Origin — exactly one origin code for the event itself.
- Title — short site label.
- Event — event description.
- Characters — normalized semicolon-separated characters participating in / directly described by the event.
- Teams — normalized semicolon-separated teams.
- Location — normalized location when safely inferable.
- Arc — explicit arc/story block when recoverable.
- Continuity — main / alt.
- DateCertainty — exact / derived / approximate / inherited_v9.
- Reference — primary source reference(s) carried by the event.
- SupportingSources — adaptations, repetitions, or parallel tellings that do not create a second historical event.
- Review — migration fields requiring manual audit.

## Origin codes
- M — manga-origin event.
- A — genuinely new anime-original material accepted into the main historical line.
- F — filler.
- R — genuinely new historical material first revealed in a later retrospective/flashback.
- G — game.
- O — OVA / special.
- V — movie/film.
- N — genuinely new novel-origin event.
- P — project roleplay event.
- D — databook / official guide fact.

## Provenance rules
1. One event has one Origin.
2. A manga event adapted in anime remains M.
3. A manga event repeated in a Shippūden flashback remains M.
4. A later flashback that reveals a genuinely new historical scene is a separate R event.
5. A novelization that merely retells a manga event is stored in SupportingSources, not as a second N event.
6. Anime/novel adaptation notes that merely retell an existing event are stored in SupportingSources.
7. Different events on the same date (for example M and P) remain separate rows.
8. ALT belongs in Continuity, not in Origin.

## Time rules
1. Never invent a part of day.
2. Unknown stays unknown.
3. ExactTime is populated only from explicit clock time.
4. Order uses 100, 200, 300... by default.
5. Order can be edited without changing EventID.
6. DateCertainty records whether the v10 date is exact, derived, approximate, or simply inherited from v9.

## Site rules enabled by this schema
- Character/team lanes are generated from metadata; events are not duplicated into physical character columns.
- One event can belong to many characters and teams.
- Source colors/animated gradients key from Origin.
- SupportingSources can be shown in hover/detail cards without producing duplicate timeline nodes.
- Zoom can cluster multiple rows from one day while preserving their individual EventIDs.

## Current migration status
This is an automated structural migration from v9 followed by provenance cleanup. Review markers intentionally remain where day-part, entities, or other metadata still need manual verification.
