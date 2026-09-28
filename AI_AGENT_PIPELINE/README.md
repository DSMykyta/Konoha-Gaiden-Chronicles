# AI_AGENT_PIPELINE

Це ручний багаточатовий пайплайн для роботи з прозою без копіювання великих промптів.

## КРИТИЧНЕ: що означає «Редагування»

Слово `Редагування` у короткій команді користувача означає **pipeline EDITING для аналізу/аудиту**, а НЕ дозвіл редагувати цільовий літературний файл.

До проходження `EDIT GATE`:
- **ЗАБОРОНЕНО** змінювати target-файл;
- **ЗАБОРОНЕНО** обіцяти «внести правки в арку», «відредагувати текст» або формулювати план так, ніби target зараз буде змінено;
- worker може створювати/видаляти тільки службові файли поточного run у `REPORTS/` (`RUN.md`, `CURRENT_*`, `CLAIMS`, reports);
- worker **не змінює** `AI_AGENT_PIPELINE/README.md`, `INDEX.md`, `_COMMON.md` або task-файли під час звичайного runtime-запуску;
- task 01–34 — аналіз/контекст/арбітраж і результати пишуться тільки в REPORTS.

Фактичне редагування target дозволяється лише після `EDIT GATE` і тільки коли користувач прямо наказав застосувати схвалені правки або відповідний етап явно визначений як такий, що змінює текст.

Правильне формулювання worker-а на старті:
`Знайду поточний run, візьму наступну runnable-задачу EDITING, проаналізую target і запишу окремий report. Target не змінюю до EDIT GATE.`


## Найкоротша команда

Користувач не зобов'язаний називати повний шлях до арки або task ID.

Достатньо:

```text
Репозиторій. AI_AGENT_PIPELINE/README. Редагування. Арка 12.
```

або:

```text
AI_AGENT_PIPELINE/README. Написання. Арка 12.
```

Тоді worker **сам**:
1. читає цей README;
2. визначає pipeline;
3. знаходить потрібну арку;
4. знаходить у `REPORTS` найсвіжішу кампанію саме цієї арки;
5. дивиться, які задачі вже виконані або зарезервовані;
6. знаходить наступну runnable-задачу;
7. резервує її;
8. виконує;
9. записує report у GitHub.

Явна команда теж підтримується:

```text
Арка 12. Виконай EDITING/04.
```

Якщо ID задано прямо, не шукай інший «наступний» ID.

## Структура

```text
AI_AGENT_PIPELINE/
├── README.md
├── WRITING/
│   ├── INDEX.md
│   ├── _COMMON.md
│   ├── 01.md
│   └── 02-e.md ... 41-e.md
├── EDITING/
│   ├── INDEX.md
│   ├── _COMMON.md
│   ├── 01.md ... 29.md
│   ├── 30-e.md ... 34-e.md
│   ├── 35.md
│   ├── 36.md
│   ├── 37-e.md
│   └── 38-e.md
└── REPORTS/
    └── README.md
```

Кожне завдання — окремий task-файл.

## Розпізнавання pipeline

- `редагування`, `редактура`, `перевірка`, `editing` → `EDITING`;
- `написання`, `розширення`, `writing` → `WRITING`.

## Як знайти цільовий текст

Якщо користувач пише лише `Арка 12`:

1. Спочатку знайди у `AI_AGENT_PIPELINE/REPORTS/` target-папку, чий `RUN.md` / `CURRENT_<PIPELINE>.md` вказує на цю арку.
2. Поле `Target` у manifest є авторитетним repo-relative path.
3. Якщо report-історії ще немає — знайди актуальний файл арки в самому репозиторії за номером/назвою.
4. Під час пошуку ігноруй:
   - `AI_AGENT_PIPELINE/`;
   - `REPORTS/`;
   - старі аудити;
   - summary/recap/index;
   - похідні копії, якщо є актуальний основний файл.
5. Якщо кандидатів кілька і REPORTS не розв'язує неоднозначність — не вгадуй; поверни короткий список кандидатів.

## Іменування задач і звітів

Суфікс `-e` означає: task має `required_reports` і потребує інших report-файлів перед стартом.

Приклади:

```text
29.md       # незалежний task
30-e.md     # залежний task
37-e.md     # залежний фінальний оркестратор
```

Task-файл, CLAIM і report використовують один і той самий ID:
`30-e.md → CLAIMS/.../30-e.md → REPORTS/.../30-e.md`.

Час створення не записується в назву report-файла або metadata report.

Повторний запуск:

```text
30-e__retry-01.md
30-e__retry-02.md
```

Run-папка може зберігати свій timestamp для розрізнення окремих кампаній.

## Run: одна кампанія

Стандарт:

```text
AI_AGENT_PIPELINE/REPORTS/
└── <target-key>/
    ├── CURRENT_EDITING.md
    ├── CURRENT_WRITING.md
    └── EDITING-a1b2c3d4-01__2026-09-28_22-47-31_KYIV/
        ├── RUN.md
        ├── CLAIMS/
        │   └── EDITING/
        │       └── 04.md
        └── EDITING/
            ├── 01.md
            ├── 02.md
            └── 04.md
```

### Як знайти актуальний run

1. Відкрий `CURRENT_<PIPELINE>.md` для знайденого target.
2. Якщо він веде на run з `Status: OPEN` — використовуй його.
3. Якщо CURRENT відсутній/зламаний — переглянь run-папки **цього target** і вибери найсвіжішу папку потрібного pipeline за timestamp у назві, у якої `RUN.md` має `Status: OPEN`.
4. Якщо відкритого run немає — створи новий.
5. Не бери run іншої арки лише тому, що він новіший.

### Створення нового run

1. Зафіксуй SHA початкової версії target.
2. Створи base ID: `<PIPELINE>-<sha8>-01`.
3. Якщо base ID уже використовувався — збільш `-02`, `-03`...
4. Додай timestamp створення папки:
   `<base-id>__YYYY-MM-DD_HH-mm-ss_KYIV`.
5. Створи `RUN.md`.
6. Онови `CURRENT_<PIPELINE>.md`.

Один run залишається тією самою кампанією, навіть якщо сам текст у процесі був відредагований і його blob SHA змінився.

## Автоматичний dispatcher: «виконай наступне»

Коли користувач не називає task ID:

1. Прочитай `INDEX.md` відповідного pipeline.
2. Прочитай імена report-файлів у поточному run.
3. Для визначення виконаного task ID дивись на базове ім'я файла: `04.md` = task `04`; `30-e.md` = task `30-e`; `30-e__retry-02.md` теж належить task `30-e`.
4. Якщо існують retry-файли, найновішим результатом task вважай retry з найбільшим номером.
5. Прочитай активні `CLAIMS`.
6. Перевір `required_reports`, `forbidden_reports` і `stage_gate`.
7. Візьми перший runnable task за `AUTO DISPATCH ORDER` в INDEX.
8. Перед виконанням зарезервуй його через CLAIM.
9. Після успішного claim ще раз перевір, чи інший worker не встиг створити готовий report.
10. Виконай task.
11. Запиши report.
12. Видали свій CLAIM.

Тому однакова команда в кількох чатах:

```text
AI_AGENT_PIPELINE/README. Редагування. Арка 12.
```

має роздати їм різні наступні доступні задачі.

## CLAIMS — захист від дублювання

Перед виконанням автоматично вибраного task створи:

```text
AI_AGENT_PIPELINE/REPORTS/<target-key>/<run-folder>/CLAIMS/<PIPELINE>/<task-id>.md
```

CLAIM **навмисно без timestamp**.

```markdown
# CLAIM

- Target: `<repo-relative-path>`
- Run: `<run-folder>`
- Pipeline: `EDITING|WRITING`
- Task ID: `<id>`
- Target blob SHA at claim: `<sha>`
- Claimed at: `YYYY-MM-DD HH:mm:ss Europe/Kyiv`
- Status: CLAIMED
```

Створення claim — атомарна спроба створити новий файл.

- створення успішне → task зарезервований цим worker;
- файл уже існує / conflict → не перезаписувати; перечитати стан і взяти наступний runnable task;
- після запису готового report видалити claim;
- claim без report означає «зайнято» до явної команди `retry` / `звільни claim`.

## Як worker виконує task

1. Відкриває актуальний target і фіксує його поточний blob SHA.
2. Відкриває task-файл `AI_AGENT_PIPELINE/<PIPELINE>/<ID>.md`.
3. Читає `_COMMON.md`.
4. Виконує routing front matter.
5. Читає тільки дозволені required/optional reports.
6. Якщо required report немає — task не runnable; в auto-mode переходить до іншого runnable task. У явно заданому task повертає `BLOCKED`.
7. Виконує PROMPT.
8. Створює report: `<ID>.md`.
9. У чат повертає коротко: ID, статус, шлях до report.

## Як залежний task знаходить required report

Наприклад `required_reports: ["04"]`.

Шукай у поточному run:

```text
EDITING/04.md
```

або відповідно `WRITING/04.md`.

Якщо є retry-файли, використовуй COMPLETE retry з найбільшим номером; якщо retry немає — основний `<ID>.md`.

## Формат RUN.md

```markdown
# RUN

- Pipeline: EDITING
- Target: `<repo-relative-path>`
- Run folder: `EDITING-a1b2c3d4-01__2026-09-28_22-47-31_KYIV`
- Created at: `2026-09-28 22:47:31 Europe/Kyiv`
- Initial blob SHA: `<full-sha>`
- Status: OPEN
```

## Заголовок кожного report

```markdown
# <PIPELINE>/<ID> — <назва>

- Target: `<repo-relative-path>`
- Run: `<run-folder>`
- Initial blob SHA: `<sha>`
- Target blob SHA at execution: `<sha>`
- Task file: `AI_AGENT_PIPELINE/<PIPELINE>/<ID>.md`
- Input reports: `...`
- Status: COMPLETE
```

## Retry

Не перезаписуй готовий report.

При повторі створюй новий report:

```text
04__retry-01.md
04__retry-02.md
```

Для визначення task ID retry-файл усе одно належить task `04`.

## EDITING

Дивись `AI_AGENT_PIPELINE/EDITING/INDEX.md`.

```text
01 → ... → 28 → 29
→ 30-e → 31-e → 32-e → 33-e → 34-e
→ EDIT GATE
→ 35 → 36
→ 37-e
```

`38-e` — лише явний додатковий синтез.

## WRITING

Дивись `AI_AGENT_PIPELINE/WRITING/INDEX.md`.

WRITING використовує `01` і залежні ID `02-e … 41-e`:

```text
01
→ 02-e → ... → 25-e
→ 26-e → 27-e → 28-e
→ 29-e → 30-e → 31-e → 32-e → 33-e
→ 34-e → 35-e → 36-e → 37-e → 38-e → 39-e → 40-e
→ 41-e
```

- 01 — Source Pack / контекст;
- 02-e–25-e — творчі агенти, що потребують 01;
- 26-e–33-e — контекстні/red-team/арбітражні етапи;
- 34-e–40-e — архітектура, драфт і редакторські проходи;
- 41-e — фінальний оркестратор і final handoff.

## Не редагувати target без дозволеного етапу

Аналізатор/арбітр пише report і не змінює літературний файл, якщо користувач прямо не наказав внести правки або task сам є письменницьким/редакторським етапом, який повертає нову прозу.

## WAITING / відсутні залежності

Залежний task **не має права починати змістовну роботу**, доки всі його `required_reports` реально не готові.

Required report вважається готовим тільки якщо:
1. існує файл відповідного task ID у поточному run;
2. файл не порожній;
3. у header є `Status: COMPLETE`;
4. report належить цьому target/run;
5. файл можна прочитати повністю настільки, наскільки це потрібно task.

Якщо хоча б один required report:
- відсутній;
- має 0 байт або лише службовий header без результату;
- має `Status: CLAIMED`, `RUNNING`, `BLOCKED`, `WAITING`, `FAILED`;
- пошкоджений або нечитабельний;

то dependent task **зупиняється до аналізу**.

### Явно викликаний dependent task

Наприклад:

```text
Арка 12. Виконай EDITING/30-e.
```

Якщо не всі required inputs готові, не створюй фінальний report 30-e і не намагайся замінити відсутні звіти власним аналізом.

Поверни:

```text
WAITING_FOR_REPORTS
Task: EDITING/30-e
Готово: <N>/<TOTAL>
Бракує: 07, 13, 22
В роботі/claimed: 18, 19
```

### Auto-dispatch без ID

Якщо користувач написав лише:

```text
AI_AGENT_PIPELINE/README. Редагування. Арка 12.
```

dispatcher спочатку шукає **будь-який runnable task** за AUTO DISPATCH ORDER.

- Якщо є інший незалежний/runnable task — бере його.
- Якщо всі ще невиконані задачі вже CLAIMED або наступні dependent tasks чекають required inputs — нічого не вигадує й повертає:

```text
NO_RUNNABLE_TASKS
Очікуються звіти: <IDs>
В роботі: <IDs>
Наступний залежний етап: <ID>
```

### Повторна перевірка

У звичайному GPT-чаті стан `WAITING_FOR_REPORTS` не означає фоновий процес. Чат сам по собі не прокидається й не опитує GitHub без нового запуску.

При наступному повідомленні користувача на кшталт:

```text
перевір
```

або повторенні короткої команди worker заново читає REPORTS/CLAIMS і, якщо залежності вже готові, продовжує.

Якщо середовище має окрему scheduled/condition-watch automation і користувач її явно увімкнув, така automation може періодично перевіряти GitHub та повідомити, коли всі required reports стануть COMPLETE. Не видавай таку automation за властивість самого відкритого чату.

## COMPLETED RUN — повернути готовий результат

Перед створенням нового run або вибором наступної задачі **обов'язково перевір**, чи для цього target + pipeline уже існує найсвіжіший завершений run.

Run вважається завершеним, якщо фінальний report відповідного pipeline має `Status: COMPLETE` і належить цьому target/run:

- для `EDITING` фінальний основний report = `37-e.md`;
- для `WRITING` фінальний основний report = `41-e.md`;
- `RUN.md` зі `Status: COMPLETE` є додатковим підтвердженням.

### Якщо користувач просить «виконай», але pipeline вже завершений

**Не створюй новий run. Не запускай 01 повторно. Не роби retry автоматично.**

Замість цього:
1. визнач final report за pipeline: `EDITING/37-e.md` або `WRITING/41-e.md`;
2. прочитай його metadata;
3. якщо final report містить поле `Final artifact:` і цей файл існує — поверни користувачу саме цей готовий файл;
4. якщо окремого final artifact немає — поверни сам final report;
5. у чаті дай готовий файл/його вміст або пряме посилання та коротко `PIPELINE_ALREADY_COMPLETE`.

Приклад для EDITING:

```text
PIPELINE_ALREADY_COMPLETE
Target: arc 03 [Грім над Конохою].txt
Final: 37-e.md
```

Після цього поверни файл або посилання на нього.

### Коли дозволено почати новий run

Тільки якщо користувач явно просить щось на кшталт:
- `новий запуск`;
- `запусти заново`;
- `retry pipeline`;
- `нова перевірка після змін`.

Якщо target змінився після завершення попереднього run, але користувач просто просить «виконай», повідом про наявний завершений результат і про те, що current target SHA вже інший; не запускай нову кампанію без прямої вказівки.
