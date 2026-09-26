# Timeline renderer

Static, content-independent chronology reader. Serve this directory over HTTP.

- `source-config.json` selects the public source repository, branch and data directory.
- `timeline-data.json` is a complete pinned fallback snapshot, including original source bytes.
- The client checks the configured branch and atomically loads all files from one commit. A failed update retains the last complete dataset and reports the fallback state.
- `core.mjs` builds endpoint constraints and physical presence from structured data. `display_rank`, titles and names never determine time. Unordered events are not treated as simultaneous. Within-day coordinates are a layout, not clock times.
- The six legacy YAML indentation defects are normalized only in parser input. Original bytes remain available in the source inspector.
- Imported pending records are available through All records. They do not invent scene presence or duplicate migrated events.
- Desktop uses a horizontal timeline; <=760px uses vertical geometry. Zoom separates a compact bundle. Reduced-motion preferences stop animation.

Run model checks: `node tests/core.test.mjs`.

Current verification: model tests and JavaScript syntax checks pass. Browser visual verification requires an available browser; the execution environment did not contain one and the browser download failed. Vercel publication was blocked because its connector returned `Tool deploy_to_vercel not found`.
