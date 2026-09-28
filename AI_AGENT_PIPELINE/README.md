# AI_AGENT_PIPELINE

Це ручний багаточатовий пайплайн для роботи з прозою без копіювання великих промптів.

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
9. записує timestamped report у GitHub.

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
│   ├── K0.md
│   ├── 01.md ... 24.md
│   ├── D1.md ... D3.md
│   ├── A1.md ... A5.md
│   ├── W1.md ... W7.md
│   └── O1.md
├── EDITING/
│   ├── INDEX.md
│   ├── _COMMON.md
│   ├── 01.md ... 31.md
│   ├── D1.md
│   ├── K0.md
│   ├── A1.md ... A4.md
│   └── O1.md
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

## Timestamp — обов'язковий у назвах створюваних report-файлів і run-папок

Використовуй локальний час **Europe/Kyiv**.

Формат suffix:

```text
__YYYY-MM-DD_HH-mm-ss_KYIV
```

Приклад run-папки:

```text
EDITING-a1b2c3d4-01__2026-09-28_22-47-31_KYIV/
```

Приклад report-файла:

```text
04__2026-09-28_22-53-08_KYIV.md
```

Timestamp означає **момент створення конкретного файла/папки**, не час початку всієї розмови.

Стабільні службові файли, які мають бути унікальними ключами, timestamp не отримують:
- `CURRENT_EDITING.md`;
- `CURRENT_WRITING.md`;
- `RUN.md`;
- `CLAIMS/<PIPELINE>/<task-id>.md`.

Причина: `CURRENT`, `RUN` і `CLAIM` — адресні/lock-файли, а не історичні звіти.

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
            ├── 01__2026-09-28_22-48-01_KYIV.md
            ├── 02__2026-09-28_22-48-19_KYIV.md
            └── 04__2026-09-28_22-53-08_KYIV.md
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
3. Для визначення виконаного task ID бери частину імені **до першого `__YYYY-MM-DD_`**.
   Наприклад `04__2026-09-28_22-53-08_KYIV.md` = task `04`.
4. Якщо для task є кілька timestamped reports/retry — найновішим вважається report з найбільшим timestamp у назві.
5. Прочитай активні `CLAIMS`.
6. Перевір `required_reports`, `forbidden_reports` і `stage_gate`.
7. Візьми перший runnable task за `AUTO DISPATCH ORDER` в INDEX.
8. Перед виконанням зарезервуй його через CLAIM.
9. Після успішного claim ще раз перевір, чи інший worker не встиг створити готовий report.
10. Виконай task.
11. Запиши timestamped report.
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
8. Створює report:
   `<ID>__<creation-timestamp>_KYIV.md`.
9. У чат повертає коротко: ID, статус, шлях до report.

## Як залежний task знаходить required report

Наприклад `required_reports: ["04"]`.

Шукай у поточному run:

```text
EDITING/04__*.md
```

або відповідно `WRITING/04__*.md`.

Якщо знайдено кілька:
1. відкинь report зі статусом не `COMPLETE`;
2. серед COMPLETE бери найновіший за timestamp у filename;
3. якщо це retry, він може бути новішим за первинний report і має пріоритет.

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
- Created at: `YYYY-MM-DD HH:mm:ss Europe/Kyiv`
- Initial blob SHA: `<sha>`
- Target blob SHA at execution: `<sha>`
- Task file: `AI_AGENT_PIPELINE/<PIPELINE>/<ID>.md`
- Input reports: `...`
- Status: COMPLETE
```

## Retry

Не перезаписуй готовий report.

При повторі створюй новий timestamped report:

```text
04__retry-01__2026-09-28_23-10-42_KYIV.md
04__retry-02__2026-09-28_23-18-03_KYIV.md
```

Для визначення task ID retry-файл усе одно належить task `04`.

## EDITING

Дивись `AI_AGENT_PIPELINE/EDITING/INDEX.md`.

Важливо:
- 01–27 + D1 — незалежні;
- K0 — контекстний незалежний;
- A/28/O — залежні;
- після 28 існує EDIT GATE;
- 29–30 запускаються свіжими після реальних правок;
- O1 — останній основний оркестратор;
- 31 — тільки явною командою, не auto-dispatch.

## WRITING

Дивись `AI_AGENT_PIPELINE/WRITING/INDEX.md`.

Важливо:
- K0 перший;
- 01–24 незалежні між собою, але читають K0;
- D1–D3 не є обов'язковими auto-задачами;
- A/W/O працюють за залежностями;
- повнотекстова гілка: `W3 → W4 → W5 → W6 → W7 → O1`.

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
Арка 12. Виконай EDITING/A1.
```

Якщо не всі required inputs готові, не створюй фінальний report A1 і не намагайся замінити відсутні звіти власним аналізом.

Поверни:

```text
WAITING_FOR_REPORTS
Task: EDITING/A1
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
