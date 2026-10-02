# Konoha Timeline

Read-only chronology atlas. A compact glass masthead contains scale, character lines, search, and period controls. The legend distinguishes moments, scenes, episodes, and arcs. Hover a node for 260 ms to open a temporary card; click to pin it immediately. Pinning preserves the card position and graph scroll. Cards fit beside the node, or above/below it on tablet widths. The card header remains fixed while its body scrolls. Compact windows use explicit activation so the card cannot cover its trigger before a click. All hierarchy levels share a cascade: desktop shows neighboring panels, while compact screens show the deepest panel. Every moment, scene, and episode has a named upward button with its parent title. Returning through a cascade restores the existing parent, its scroll, and keyboard focus; direct entries follow their authoritative scene → episode → arc IDs, including singleton containers. The close button ends the entire reading session; Escape steps back one panel. Short landscape windows give reading panels the viewport height. Phones and short landscape windows open at week scale; other windows open at month scale. Search also opens with `/`. Character profiles use native dialogs. Native popovers handle the filter panels. No editing interface or write API.

The map lays out story regions and title boxes before placing character strands. Names and child counts appear directly on the canvas. Arc → episode → scene → moment membership comes from authoritative source IDs; singleton scenes and episodes keep their types. Parent regions contain their own children and reserve header space. Independent branches use the available horizontal and vertical space without permanent character rows. Long titles wrap and truncate visually, while the reading card and accessible label retain the full title. Dense maps show a labeled parent instead of overlapping descendants. Calendar scale and story detail are independent: a narrow week view can show arcs, while an expanded scene shows its moments. The year overview uses explicitly named calendar periods and lists real arcs when opened.

Each aggregate card offers “Розгорнути … на мапі”. Expansion limits the canvas to that parent's children, fits its recorded calendar range, and adds a named return above the map. Phone title lists start collapsed so the map has room; the “Події” control opens the list. Direct moment navigation reveals its scene on the map while preserving reading navigation. Search, delayed hover, stable pinning, parent reading controls, cascades, and keyboard behavior share the existing interaction controller. Escape follows the reading cascade; the map keeps its own named return control.

Smooth cubic Bézier paths use the same final anchors as the visible marks. Scene and episode connections represent participation across the group, without asserting that every character met simultaneously. Physical appearances determine connections; mentions do not. Title masks protect labels and unrelated marks. Inactive strands fade between distant appearances. Character focus keeps one gently curved continuous strand; guests sharing neighboring moments form a continuous local run with faded ends. Decorative crossings do not assert co-presence. Accepted `before` links determine same-day scene order; unspecified order remains a display convention. Moment display intervals stay within their own scene and never invent precise hours. Main and alternate continuities remain independent.

The reviewed January fragment groups the school day under “День розподілу в Академії” and the dango shop plus Kita's evening at home under “Перший день Команди 9”. That episode and Raido's evaluation belong to “Становлення Команди 9”. All scene IDs, moment IDs, text, and physical involvement are preserved. Removed episode and arc entry IDs resolve through validated `redirect_ids` on their surviving parent.

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

`public/data.json` is generated at deployment. It is a snapshot of that source revision, not a live editor or an automatic scheduled refresh. Automatic Git deployments are disabled in `vercel.json`; publishing a commit requires an explicit deployment of that revision.

## Лінії, профілі та фото

Усі персонажі обрані початково. Натискання на лінію вмикає одну суцільну, злегка вигнуту сюжетну лінію; інші учасники мають лише короткі входи біля її вузлів. Стрілки ведуть до попередньої/наступної події персонажа. Фото і вікові профілі зберігаються в CHRONOLOGY/data. [Формат і механізм додавання для моделі](docs/MEDIA_AND_PROFILES.md).

## Interface design and verification

Cool gray surfaces, translucent glass controls, Manrope controls, and Lora reading headings. Fonts and their OFL licenses are included under `public/fonts`; the interface does not request Google Fonts. Fields receive a single focus outline around their complete wrapper. Transient previews share a 260 ms open delay and a 240 ms close delay. Leaving, Escape, zooming, replacing content, and losing window focus cancel pending work. Panel coordinates never animate; button presses and row highlights use brief feedback. Reduced transparency, increased contrast, unsupported backdrop filters, keyboard input, and reduced motion have appropriate fallbacks. Material guidance: [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/materials).

`story-layout.js` measures and reserves titles, packs nested regions, and returns shared geometry for labels, marks and strands. `story-map.css` styles those regions and the explicit map context. The source-derived SVG contours stay still between actions. Scrolling requires no geometry animation; selection and fixed story focus update region palettes. `story-clouds.js` retains palette and contour helpers for compatibility. Font loading invalidates text measurements. The bottom title navigation follows the displayed story level, keeps keyed controls, and preserves focus and scroll between redraws. Fixed title focus limits reading navigation to its events.

Character event cards scroll vertically. Explicit previous/next controls and horizontal swiping move between cards; the wheel is not intercepted. Empty selection, empty date ranges, failed searches, and invalid dates have clear recovery actions. Calendar intervals, scene order, and base graph layouts are cached and invalidated on data or continuity changes.

Run `npm --prefix SITE run check` and `npm --prefix SITE test`. Interface tests cover desktop, phone, and landscape layouts, live data refresh, all semantic scales, and exact connections between physical cast strands and their displayed nodes. Layout tests cover real dense dates, title collisions, exact parent containment, foreign-child exclusion, singleton types and noninterleaving moment intervals. Source tests cover editorial regrouping and old IDs. Cloud helper tests remain in place. The local server is checked for matching assets and uncached responses. The browser regression suite covers delayed-open cancellation, tooltips, stable pinning, all cascade levels, parent navigation, profiles, readers, search, keyboard input, reduced motion and unchanged cloud geometry at 1440×900, 375×812, 320×700, 812×375, 768×1024 and 2000×1100.

```sh
npx --prefix SITE playwright install chromium
npm --prefix SITE run test:browser
```

For an existing browser installation, set `CHROMIUM_EXECUTABLE_PATH`. Set `BROWSER_SCREENSHOTS` to save review images.

`interaction-core.js` owns cancellation and panel geometry. `hierarchy-preview.js` owns the cascade; `selection-focus.js` and `story-label-scale.js` update selection explicitly. Styles live in the corresponding CSS files. Modules are declared once in `index.html`; no dynamic script injection, application-function replacement, or document-wide mutation observer is used.

Лінії згасають під час тривалої перерви персонажа або великого проміжку на екрані й з’являються перед наступною участю. Фокус показує всю лінію. Річний огляд зібраний у вузьку смугу; наближення поступово розкриває її. Дати й фізичні вузли залишаються точними, чужі лінії плавно зникають біля вузлів інших історій.

На телефоні моменти мають номери, які відповідають читабельному списку внизу. Список показує дату, назву сцени та кнопку «Читати»; його можна згорнути. Рівень назв слідує за масштабом: арка, епізод, сцена, момент.

The additional map browser suite checks real font bounds, explicit arc/episode/scene expansion, named map return, old entry IDs, touch pinning, continuous guests and dense dates at the same six viewport sizes.
