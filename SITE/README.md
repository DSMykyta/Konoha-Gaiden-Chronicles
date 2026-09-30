# Konoha Timeline

Read-only, minimal timeline. Hover a node for its title, click for an anchored card above it. No persistent header, sidebar, event list, editing interface, or write API.

Smooth cubic Bézier paths interpolate each physical participation node. Decorative braid crossings never assert co-presence. Main and alternate continuities are selected independently. Date placement, sources, scene presence and temporal relationships remain in the data.

## Vercel

Connect `DSMykyta/Konoha-Gaiden-Chronicles`, branch `main`. Set Root Directory to `SITE`. Framework Other; the checked-in `vercel.json` specifies `npm ci`, `npm run build`, and output `public`.

The build reads the current authoritative YAML under `KONOHA_GAIDEN_ARCS_ZIGRANE_POV_V3/CHRONOLOGY/data`. If the root-directory checkout lacks parent data, the build retrieves it from the same public repository with sparse Git. No secrets are needed. The build command deliberately runs for changes to chronology, not only UI changes. Each output records the exact source commit.

For local builds, use Node 22+, `npm ci`, then `CHRONOLOGY_SOURCE_ROOT=/absolute/path/to/source npm run build`. Six malformed January 22 YAML serializations are normalized only in memory; the source files are never edited.

`public/data.json` is generated at deployment. It is a snapshot of that source revision, not a live editor or an automatic scheduled refresh. Source changes reach the website through the next Git-triggered deployment.

## Лінії, профілі та фото

Усі персонажі обрані початково. Натискання на лінію вмикає фокус; стрілки ведуть до її попередньої/наступної події. Фото і вікові профілі зберігаються в CHRONOLOGY/data. [Формат і механізм додавання для моделі](docs/MEDIA_AND_PROFILES.md).
