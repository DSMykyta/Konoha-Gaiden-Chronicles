# Konoha Timeline

Read-only chronology atlas. A compact glass masthead contains scale, character lines, search, and period controls. The legend distinguishes moments, scenes, episodes, and arcs. Hover a node for 260 ms to open a temporary card; click to pin it immediately. Pinning preserves the card position and graph scroll. Cards fit beside the node, or above/below it on tablet widths. The card header remains fixed while its body scrolls. Compact windows use explicit activation so the card cannot cover its trigger before a click. All hierarchy levels share a cascade: desktop shows neighboring panels, while compact screens show the deepest panel. Desktop hover cascades use a directional safe triangle to keep the active child panel while the pointer crosses adjacent rows; resting on another row opens that row instead. Click, touch, and keyboard navigation remain explicit. Every moment, scene, and episode has a named upward button with its parent title. Returning through a cascade restores the existing parent, its scroll, and keyboard focus; direct entries follow their authoritative scene → episode → arc IDs, including singleton containers. The close button ends the entire reading session; Escape steps back one panel. Short landscape windows give reading panels the viewport height. Phones and short landscape windows open at week scale; other windows open at month scale. Search also opens with `/`. Character profiles use native dialogs. Native popovers handle the filter panels. No editing interface or write API.

Smooth cubic Bézier paths converge at shared scene nodes. Each character's strand fades in shortly before its first recorded scene, follows its own scene anchors without a fixed row, and fades out after its last record; these ends do not imply birth or death. Hovering highlights the scene's physical cast and dims other strands. A scene is grouped only by its authoritative YAML ID, never by a shared date or location. Scene numbers count moments; episode numbers count scenes. Year, month, week, and day scales display arcs, episodes, scenes, and moments respectively, collapsing singleton containers. Scene cards list action titles; individual action previews show text and available images. Dense calendar days receive a fixed width based on their scene count. Consecutive scenes and their moments occupy separate chronological intervals. Widths depend on the source continuity, never the selected cast, reader state or visible window. Within-day positions express scene order, not invented hours. Day zoom can show a portion of a dense day; panning reveals the adjoining scenes. The previous/next preset controls still move by calendar day, week or month. Dense nodes separate vertically without changing their time coordinate; the strands use those same final anchors. If the vertical room is exhausted, the canvas grows and can be panned vertically. Large touch targets sit below all visible marks so neighboring targets cannot intercept a tap on another mark. Accepted `before` links determine same-day scene order; unspecified order remains a display convention. Line convergence means presence at different moments of the scene, without asserting that everyone met simultaneously. Decorative crossings never assert co-presence. All enabled story continuities are displayed together on the shared timeline by default; the four provenance layers control visibility, while the original source continuity IDs remain available as metadata.

Accepted event-to-scene `observes` links align distinct same-day scene nodes in the same display window. The nodes retain separate physical casts; alignment does not establish an exact hour.

## Story layers / Шари історії

All four layers are enabled by default: **Канон** (`canon`), **Філери** (`filler`), **Додаткові джерела** (`sources`), and **Розширення** (`project`). **Розширення** means the author's own stories regardless of their origin or format. All enabled layers are displayed together on a shared timeline; the original source and continuity metadata are preserved.

Картки арок та їхні лічильники показують **лише епізоди, у яких залишилися видимі події**. Вимкнені шари не створюють порожніх переходів до прихованих епізодів. Пошук використовує той самий набір активних подій, незалежно від вихідного continuity ID.

## Відкладені функції: повноекранне читання сцени

**Статус: на паузі — в розробці / в роздумах.** Старий діалог «Сцена цілком» та його обробники прибрано з інтерфейсу. Ідею окремого повноекранного читання збережено для майбутнього проєктування; зараз це **не чинна функція**. Сцени та моменти читаються через звичайні картки та ієрархію змісту. Стару реалізацію не відновлювати без окремого узгодження UX.

## Вибір ліній і фокус

Галочки у «Лініях персонажів» задають **набір видимих ліній** — дві або більше можуть залишатися вибраними. Натискання на лінію чи ім'я персонажа задає **один активний фокус**, не змінюючи набір галочок. Повторне натискання прибирає фокус; вибір іншої лінії перемикає його. Старий список «Історична лінія» прибрано: він не був ні вибором персонажів, ні чотирма шарами історії. Події з різними вихідними continuity відображаються разом відповідно до шарів; їхні continuity ID лишаються в даних.

Вибір персонажів зі схованих шарів зберігається, щоб після повторного ввімкнення шару лінії повернулися. Водночас лічильник «Лінії» та порожні стани рахують **лише персонажів, доступних у ввімкнених шарах**. Коли жодної лінії немає, порожній екран пропонує обрати персонажів або змінити шари замість бездіяльного переходу до події.

## Local launch

From the repository root, with Node 22 or newer:

```sh
npm --prefix SITE ci
npm --prefix SITE start
```

Open <http://localhost:4173>. `start` builds the current chronology and then serves `SITE/public` without caching. After pulling updates, restart the server. Use `npm --prefix SITE start -- --port 4174` if the default port is occupied.

The HTML versions its scripts and stylesheet together. If an older cached HTML page loads a newer script, the script requests fresh HTML once before binding controls. A persistent mismatch displays a clear recovery message instead of a null-element exception.

## Vercel

Connect `DSMykyta/Konoha-Gaiden-Chronicles`, branch `main`. Set Root Directory to `SITE`. Framework Other; the checked-in `vercel.json` specifies `npm ci`, `npm run check && npm test` (which runs the build), and output `public`.

The build reads the current authoritative YAML under `KONOHA_GAIDEN_ARCS_ZIGRANE_POV_V3/CHRONOLOGY/data`. If the root-directory checkout lacks parent data, the build retrieves it from the same public repository with sparse Git. No secrets are needed. The build command deliberately runs for changes to chronology, not only UI changes. Each output records the exact source commit.

For local builds, use Node 22+, `npm ci`, then `CHRONOLOGY_SOURCE_ROOT=/absolute/path/to/source npm run build`. The source files are never edited by the build.

`public/data.json` is generated only when a deployment runs. It is a snapshot of the source revision used for that build, not a live editor or an automatic scheduled refresh. Automatic Git-triggered deployments are disabled via `git.deploymentEnabled: false` in `vercel.json` to avoid exhausting the free Vercel plan's deployment allowance. Pushing commits to `main` (including chronology or UI changes) does **not** automatically update the published site. When an update is needed, start a deployment manually and verify that it uses the intended commit.

## Аудит канонічних суперечностей Naruto

[Реєстр суперечностей Naruto й адресний аудит опублікованих записів SITE](docs/NARUTO_CANON_INCONSISTENCIES_UA.md) — 73 питання з міжнародних обговорень і перевірка їхньої застосовності до поточної хронології. У документі окремо зазначено підтверджені технічні ризики (шари, похідні дати, вікові профілі), питання для звіряння за манґою/аніме та майбутні реткони `Shippuden`. **Реєстр не є автоматичним підтвердженням усіх фанатських тверджень і не дозволяє змінювати рольові події без окремого канонічного доказу.**

## Картотека здібностей

Кнопка **Здібності** у верхній панелі відкриває доступ до всіх записів реєстру `CHRONOLOGY/data/abilities.yaml`. Ліворуч розташовано індекс із пошуком за назвою, описом та ID і фільтром за типом. Праворуч — повна картка у стилі архівного талона: моноширинний друк, реєстраційний номер, лінії формуляра й перфорований корінець. Є кнопки наступного/попереднього запису, навігація клавіатурою та мобільний режим.

Картки здібностей усередині досьє персонажів використовують той самий шаблон. Натискання на картку відкриває відповідний запис у картотеці. Пряме посилання на існуючий запис: `/?ability=abl-rasengan`. Відсутні поля не вигадуються: дані, статуси й відомості з профілів залишаються такими, як у вихідних YAML. Це інтерфейс перегляду; він не записує зміни до реєстру.

## Лінії, профілі та фото

Усі персонажі обрані початково. Натискання на лінію вмикає одну суцільну, злегка вигнуту сюжетну лінію; інші учасники мають лише короткі входи біля її вузлів. Стрілки ведуть до попередньої/наступної події персонажа. Фото і вікові профілі зберігаються в CHRONOLOGY/data. [Формат і механізм додавання для моделі](docs/MEDIA_AND_PROFILES.md).

## Interface design and verification

Cool gray surfaces, translucent glass controls, Manrope controls, and Lora reading headings. Fonts and their OFL licenses are included under `public/fonts`; the interface does not request Google Fonts. Fields receive a single focus outline around their complete wrapper. Transient previews share a 260 ms open delay and a 240 ms close delay. Leaving, Escape, zooming, replacing content, and losing window focus cancel pending work. Panel coordinates never animate; button presses and row highlights use brief feedback. Reduced transparency, increased contrast, unsupported backdrop filters, keyboard input, and reduced motion have appropriate fallbacks. Material guidance: [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/materials).

At scene scale, episode clouds surround the visible scene anchors. At moment scale, scene clouds become prominent and episode clouds recede. The chronology uses the whole viewport without a fixed bottom title strip. A Contents button beside Lines and Search opens a separate popover with an expandable arc → episode → scene → moment tree, sorted by each group's earliest dated scene, searchable by story title, and linked directly to the appropriate reading level. Arc date ranges intentionally include preparation and aftermath when those scenes belong to the same arc. Each cloud uses authoritative IDs, never shared dates, locations, or cast. Plain names beside clouds and nodes identify their level and title. Label placement never moves marks, changes the date axis or grows the canvas. Labels that cannot fit locally remain available through the bottom title navigation. Clicking a map name opens its reader in place. Parent navigation returns to real episode/arc nodes and character strands, with no implicit scope filter or synthetic period blocks. A Canvas metaball layer computes organic contours around the existing SVG coordinates; clouds do not arrange nodes into rows or change character paths. Members of one group form a continuous organic contour; singleton containers do not add redundant clouds. Palette changes and scrolling reuse contour geometry. Contours remain still between user actions; there is no recurring geometry animation. Reading, selection, scrolling, and preference changes reuse the cached contours.

## Продуктивність хронології: кеш геометрії та камера

Завантаження даних запускає першу побудову хронології. Первинна геометрія розташування обчислюється **один раз із усіх моментів** для вибраних шарів, з урахуванням географічної близькості. Сцени, епізоди й арки отримують позиції з тієї самої бази моментів (семантичне об’єднання), а не створюють незалежну карту. Лінії зберігають початкові моментні опорні точки; видимі об’єднані вузли додаються як точки проходження маршруту. Екранні Bézier-маршрути кешуються за масштабом і розміром полотна. Зміна персонажа у фокусі не перераховує шляхи. Звичайне пересування часу використовує підготовлене **буферне вікно подій**: SVG-криві, вузли, маски, градієнти та підписи лишаються в DOM, а пересувається тільки SVG `viewBox`. Canvas-хмари отримують горизонтальне зміщення та використовують ті самі кешовані `Path2D`. Прокручування коліщатком не змінює масштаб.

Вихід за межі буферного вікна вимагає побудувати нову порцію **видимих DOM-елементів**, але маршрути персонажів використовуються з кешу, а не розраховуються знову. Під час зміни масштабу, розміру вікна, даних або складу шарів геометрія може бути перерахована — це необхідне для коректної візуалізації. Межі стислих часових проміжків перевіряються: якщо при зсуві змінюється кількість часових розривів у кадрі, система перебудовує часову шкалу, щоб дати не змістилися.

Основні модулі: `timeline-core.js` — хронологія та маршрути, `timeline-pan-cache.js` — умови перевикористання кадру, `app.js` — віртуалізація SVG та камера, `story-clouds.js` — кешована геометрія Canvas.

Географічна модель: `data/geography.yaml` додає країни, населені пункти й будівлі до існуючих `location_id`. `timeline-geography.js` порівнює близькість місць за ієрархією (спільна будівля → населений пункт → країна → різні країни); невідома географія нейтральна. `sceneLayout` м’яко відштовхує одночасні гілки з далеких країн, не змінюючи часу X. Розділ **Період → Географія та невідомі місця** показує неповні локалізації й можливі переміщення між країнами в один день *для ручної перевірки, не як доведену помилку*. Консервативний реєстр невизначених місць: `../KONOHA_GAIDEN_ARCS_ZIGRANE_POV_V3/CHRONOLOGY/GEOGRAPHY_REVIEW_UA.md`.
 Регресійні перевірки: `tests/buffered-pan.test.mjs`, `tests/wheel-navigation.browser.mjs`, `tests/focus-pan.browser.mjs` (`npm run test:focus-pan` після збірки). Перетягування можна почати навіть на вузлі або лінії: рух понад 6 px переміщує камеру, а не натискає вузол і не скидає фокус. Режим виділення сцени/епізоду повторно застосовується після перебудови SVG, тому новий буфер не повинен показувати приховані лінії.

Character event cards scroll vertically. Explicit previous/next controls and horizontal swiping move between cards; the wheel is not intercepted. Режим подій персонажа включає також події без установленої дати (після датованих), тому кількість подій у профілі збігається з читачем. Empty selection, empty date ranges, failed searches, and invalid dates have clear recovery actions. Calendar intervals, scene order, and base graph layouts are cached and invalidated on data or story-layer changes.

Run `npm --prefix SITE run check` and `npm --prefix SITE test`. Interface tests cover desktop, phone, and landscape layouts, live data refresh, all semantic scales, and exact connections between physical cast strands and their displayed nodes. Cloud tests cover scene/episode ownership, unchanged coordinates, distant parts, and excluded foreign markers. The local server is checked for matching assets and uncached responses. The browser regression suite covers delayed-open cancellation, tooltips, stable pinning, all cascade levels, parent navigation, profiles, readers, search, keyboard input, reduced motion and unchanged cloud geometry at 1440×900, 375×812, 320×700, 812×375, 768×1024 and 2000×1100.

```sh
npx --prefix SITE playwright install chromium
npm --prefix SITE run test:browser
```

For an existing browser installation, set `CHROMIUM_EXECUTABLE_PATH`. Set `BROWSER_SCREENSHOTS` to save review images.

`interaction-core.js` owns cancellation and panel geometry. `hierarchy-preview.js` owns the cascade; `selection-focus.js` and `story-label-scale.js` update selection explicitly. Styles live in the corresponding CSS files. Modules are declared once in `index.html`; no dynamic script injection, application-function replacement, or document-wide mutation observer is used.

Лінії згасають під час тривалої перерви персонажа або великого проміжку на екрані й з’являються перед наступною участю. Фокус показує всю лінію. Річний огляд зібраний у вузьку смугу; наближення поступово розкриває її. Дати й фізичні вузли залишаються точними, чужі лінії плавно зникають біля вузлів інших історій.

На телефоні моменти мають номери, які відповідають читабельному списку внизу. Список показує дату, назву сцени та кнопку «Читати»; його можна згорнути. Рівень назв слідує за масштабом: арка, епізод, сцена, момент.
