# Konoha Timeline

Read-only chronology atlas. A compact glass masthead contains scale, character lines, search, and period controls. The legend distinguishes moments, scenes, episodes, and arcs. Hover a node for 260 ms to open a temporary card; click to pin it immediately. Pinning preserves the card position and graph scroll. Cards fit beside the node, or above/below it on tablet widths. The card header remains fixed while its body scrolls. Compact windows use explicit activation so the card cannot cover its trigger before a click. All hierarchy levels share a cascade. Compact screens show the deepest panel and restore its parent when closed. Phones and short landscape windows open at week scale; other windows open at month scale. Search also opens with `/`; Escape dismisses one surface at a time. Character profiles use native dialogs. Native popovers handle the filter panels. No editing interface or write API.

Smooth cubic Bézier paths converge at shared scene nodes. Each character's strand fades in shortly before its first recorded scene, follows its own scene anchors without a fixed row, and fades out after its last record; these ends do not imply birth or death. Hovering highlights the scene's physical cast and dims other strands. A scene is grouped only by its authoritative YAML ID, never by a shared date or location. Scene numbers count moments; episode numbers count scenes. Year, month, week, and day scales display arcs, episodes, scenes, and moments respectively, collapsing singleton containers. Scene cards list action titles; individual action previews show text and available images. Dense nodes separate vertically without changing their time coordinate; the strands use those same final anchors. If the vertical room is exhausted, the canvas grows and can be panned vertically. Large touch targets sit below all visible marks so neighboring targets cannot intercept a tap on another mark. Accepted `before` links determine same-day scene order; unspecified order remains a display convention. Line convergence means presence at different moments of the scene, without asserting that everyone met simultaneously. Decorative crossings never assert co-presence. Main and alternate continuities are selected independently.

Accepted event-to-scene `observes` links align distinct same-day scene nodes in the same display window. The nodes retain separate physical casts; alignment does not establish an exact hour.

## Local launch

From the repository root, with Node 22 or newer:

```sh
npm --prefix SITE ci
npm --prefix SITE start
```

Open <http://localhost:4173>. `start` builds the current chronology and then serves `SITE/public` without caching. After pulling updates, restart the server. Use `npm --prefix SITE start -- --port 4174` if the default port is occupied.

The HTML versions its scripts and stylesheet together. If an older cached HTML page loads a newer script, the script requests fresh HTML once before binding controls. A persistent mismatch displays a clear recovery message instead of a null-element exception.

## Vercel

Connect `DSMykyta/Konoha-Gaiden-Chronicles`, branch `main`. Set Root Directory to `SITE`. Framework Other; the checked-in `vercel.json` specifies `npm ci`, `npm run build`, and output `public`.

The build reads the current authoritative YAML under `KONOHA_GAIDEN_ARCS_ZIGRANE_POV_V3/CHRONOLOGY/data`. If the root-directory checkout lacks parent data, the build retrieves it from the same public repository with sparse Git. No secrets are needed. The build command deliberately runs for changes to chronology, not only UI changes. Each output records the exact source commit.

For local builds, use Node 22+, `npm ci`, then `CHRONOLOGY_SOURCE_ROOT=/absolute/path/to/source npm run build`. The source files are never edited by the build.

`public/data.json` is generated at deployment. It is a snapshot of that source revision, not a live editor or an automatic scheduled refresh. Source changes reach the website through the next Git-triggered deployment.

## Лінії, профілі та фото

Усі персонажі обрані початково. Натискання на лінію вмикає одну пряму сюжетну лінію; інші учасники мають лише короткі входи біля її вузлів. Стрілки ведуть до попередньої/наступної події персонажа. Фото і вікові профілі зберігаються в CHRONOLOGY/data. [Формат і механізм додавання для моделі](docs/MEDIA_AND_PROFILES.md).

## Interface design and verification

Cool gray surfaces, translucent glass controls, Manrope controls, and Lora reading headings. Fonts and their OFL licenses are included under `public/fonts`; the interface does not request Google Fonts. Fields receive a single focus outline around their complete wrapper. Transient previews share a 260 ms open delay and a 240 ms close delay. Leaving, Escape, zooming, replacing content, and losing window focus cancel pending work. Panel coordinates never animate; button presses and row highlights use brief feedback. Reduced transparency, increased contrast, unsupported backdrop filters, keyboard input, and reduced motion have appropriate fallbacks. Material guidance: [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/materials).

At scene scale, episode clouds surround the visible scene anchors. At moment scale, scene clouds become prominent and episode clouds recede. The bottom title strip shows the chosen moment, scene, or episode names. Its keyed controls survive redraws, keeping focus and horizontal scroll stable. A fixed title focus limits event/scene navigation to its own events. Each cloud uses authoritative IDs, never shared dates, locations, or cast. A Canvas metaball layer computes organic contours around the existing SVG coordinates; clouds do not arrange nodes into rows or change character paths. Widely separated parts form separate patches, and unrelated markers receive clear space around them. Palette changes and scrolling reuse contour geometry. The contour radii vary by less than two pixels at ten frames per second. Motion pauses while reading, when the page is hidden, and under reduced-motion or reduced-transparency preferences. Nodes, lines, and text remain still.

Character event cards scroll vertically. Explicit previous/next controls and horizontal swiping move between cards; the wheel is not intercepted. Empty selection, empty date ranges, failed searches, and invalid dates have clear recovery actions. Calendar intervals, scene order, and base graph layouts are cached and invalidated on data or continuity changes.

Run `npm --prefix SITE run check` and `npm --prefix SITE test`. Interface tests cover desktop, phone, and landscape layouts, live data refresh, all semantic scales, and exact connections between physical cast strands and their displayed nodes. Cloud tests cover scene/episode ownership, unchanged coordinates, distant parts, and excluded foreign markers. The local server is checked for matching assets and uncached responses. The browser regression suite covers delayed-open cancellation, tooltips, stable pinning, all cascade levels, parent navigation, profiles, readers, search, keyboard input, reduced motion and unchanged cloud geometry at 1440×900, 375×812, 320×700, 812×375, 768×1024 and 2000×1100.

```sh
npx --prefix SITE playwright install chromium
npm --prefix SITE run test:browser
```

For an existing browser installation, set `CHROMIUM_EXECUTABLE_PATH`. Set `BROWSER_SCREENSHOTS` to save review images.

`interaction-core.js` owns cancellation and panel geometry. `hierarchy-preview.js` owns the cascade; `selection-focus.js` and `story-label-scale.js` update selection explicitly. Styles live in the corresponding CSS files. Modules are declared once in `index.html`; no dynamic script injection, application-function replacement, or document-wide mutation observer is used.
