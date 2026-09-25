# Naruto Timeline v10 schema

## Principle
One row = one historical event. v9 remains unchanged and is the migration source.

## Columns
- Year — project year.
- Date — DD.MM.
- DayPart — dawn / morning / noon / afternoon / evening / night / late_night / unknown.
- ExactTime — only when the source explicitly gives a clock time.
- Order — ordering inside one date. Base step: 100. Insertions may use any integer between existing values.
- EventID — stable identifier independent of date and Order. Never renumber because chronology changes.
- Track — migration lineage from v9: World / NARUTO / T9LM. This is not a source type.
- Origin — single origin of the event.
- Title — short display title.
- Event — full event text.
- Characters — semicolon-separated normalized character IDs/names.
- Teams — semicolon-separated normalized teams.
- Location — location; blank until verified.
- Arc — arc/story block when explicitly recoverable.
- Continuity — main / alt.
- DateCertainty — exact / derived / approximate / inherited_v9.
- Reference — source references preserved from v9.
- Review — fields that need manual audit after migration.

## Origin codes
- M — manga-origin event. Anime adaptation or later repetition does not change M.
- A — anime-original material accepted into the main historical line.
- F — filler.
- R — unique historical material first revealed in a later retrospective/flashback. Repetition of an existing manga event remains M.
- G — game.
- O — OVA / special.
- V — movie/film.
- N — novel.
- P — project roleplay event.
- D — databook / official guide fact. Added because v9 already contains databook-derived facts.

## Rules
1. Never combine multiple origins into one value merely because the same event was adapted or repeated elsewhere.
2. If manga and roleplay events happen on the same date, they are separate rows.
3. Unknown part of day stays unknown; do not invent morning/evening.
4. ExactTime is populated only from explicit source time.
5. Order is not an EventID and may change.
6. EventID remains stable after edits.
7. Retrospective material gets R only when the retrospective contributes a genuinely new historical event/detail.
8. ALT is kept separately in Continuity rather than encoded into Origin.
9. Characters/Teams/Location are metadata for generating timeline lanes; events are not duplicated per character.
10. v10 is the editable structured source for the future site; v9 remains preserved as migration baseline.

## Migration status
This first pass automatically split v9 cells on explicit bullet separators and preserved source-column lineage. Rows marked in Review require manual cleanup, especially day-part, entity tags, and legacy adaptation notes.
