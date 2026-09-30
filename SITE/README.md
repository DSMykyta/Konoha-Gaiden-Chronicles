# Konoha Timeline

Read-only, minimal timeline. Hover any part of a node, including its action count, for the complete scene card above it. The card stays open while the pointer moves into it. Touch screens open it by tapping; clicking pins a card. No persistent header, sidebar, event list, editing interface, or write API.

Smooth cubic Bézier paths converge at shared scene nodes. Each character's strand fades in shortly before its first recorded scene, follows its own scene anchors without a fixed row, and fades out after its last record; these ends do not imply birth or death. Unrelated paths bend away from scene markers. Hovering highlights the scene's physical cast and dims other strands. A scene is grouped only by its authoritative YAML ID, never by a shared date or location. The number inside a node counts its actions; the card shows their complete text and available images, and “Читати сцену цілком” opens them in a modal. Accepted `before` links determine same-day scene order; unspecified order remains a display convention. Line convergence means presence at different moments of the scene, without asserting that everyone met simultaneously. Decorative crossings never assert co-presence. Main and alternate continuities are selected independently.

## Vercel

Connect `DSMykyta/Konoha-Gaiden-Chronicles`, branch `main`. Set Root Directory to `SITE`. Framework Other; the checked-in `vercel.json` specifies `npm ci`, `npm run build`, and output `public`.

The build reads the current authoritative YAML under `KONOHA_GAIDEN_ARCS_ZIGRANE_POV_V3/CHRONOLOGY/data`. If the root-directory checkout lacks parent data, the build retrieves it from the same public repository with sparse Git. No secrets are needed. The build command deliberately runs for changes to chronology, not only UI changes. Each output records the exact source commit.

For local builds, use Node 22+, `npm ci`, then `CHRONOLOGY_SOURCE_ROOT=/absolute/path/to/source npm run build`. Six malformed January 22 YAML serializations are normalized only in memory; the source files are never edited.

`public/data.json` is generated at deployment. It is a snapshot of that source revision, not a live editor or an automatic scheduled refresh. Source changes reach the website through the next Git-triggered deployment.

## Лінії, профілі та фото

Усі персонажі обрані початково. Натискання на лінію вмикає фокус; стрілки ведуть до її попередньої/наступної події. Фото і вікові профілі зберігаються в CHRONOLOGY/data. [Формат і механізм додавання для моделі](docs/MEDIA_AND_PROFILES.md).
