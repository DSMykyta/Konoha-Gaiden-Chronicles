# AI_AGENT_PIPELINE

Це ручний багаточатовий пайплайн для роботи з прозою без копіювання великих промптів.

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

Кожне завдання — окремий файл. Великі master-файли не використовуються як runtime-промпти.

## Мінімальна команда

```text
Файл: <repo-relative-path>
Виконай EDITING/04
```

або:

```text
Файл: <repo-relative-path>
Виконай WRITING/07
```

Цього достатньо.

## Що робить worker-чат

1. Відкриває цільовий файл і фіксує його поточний Git blob SHA.
2. Відкриває рівно один task-файл:
   - `EDITING/04` → `AI_AGENT_PIPELINE/EDITING/04.md`;
   - `WRITING/W3` → `AI_AGENT_PIPELINE/WRITING/W3.md`.
3. Читає `_COMMON.md` відповідного pipeline.
4. Виконує routing front matter:
   - `execution`;
   - `required_reports`;
   - `optional_reports`;
   - `forbidden_reports`;
   - `stage_gate`.
5. Якщо required report відсутній — не вигадує його зміст, а повертає `BLOCKED`.
6. Виконує PROMPT.
7. Записує результат у REPORTS поточного run.
8. У чат повертає короткий статус і шлях записаного файла.

## SOLO проти DEPENDENT

### SOLO
Не відкривати REPORTS взагалі. Це критично для незалежності.

### SOLO_CONTEXT
REPORTS заборонені, але бриф дозволяє первинні файли/Git/контекст.

### ISOLATED_AFTER_K0
Використовує тільки `K0` / SOURCE PACK. Звіти інших незалежних творчих агентів заборонені.

### DEPENDENT*
Читає тільки `required_reports` і, за потреби, `optional_reports` з task-файла.

Routing не дозволяє самовільно розширювати контекст.

## Run: одна кампанія, навіть якщо текст змінюється

Звіти зберігаються не просто за поточним SHA, а за **run-id**:

```text
AI_AGENT_PIPELINE/REPORTS/
└── <target-key>/
    ├── CURRENT_EDITING.md
    ├── CURRENT_WRITING.md
    └── <run-id>/
        ├── RUN.md
        ├── EDITING/
        │   ├── 01.md
        │   ├── A1.md
        │   └── O1.md
        └── WRITING/
            ├── K0.md
            ├── 07.md
            ├── W3.md
            └── O1.md
```

### Створення run

Якщо для pipeline немає активного `CURRENT_<PIPELINE>.md`, перший worker:

1. бере SHA початкової версії цільового файла;
2. створює `run-id = <PIPELINE>-<sha8>-01`;
3. якщо такий run уже існує — збільшує суфікс `-02`, `-03` тощо;
4. створює `RUN.md`;
5. створює/оновлює `CURRENT_EDITING.md` або `CURRENT_WRITING.md`.

Якщо два workers одночасно спробували ініціалізувати run і один отримав конфлікт — другий перечитує CURRENT і приєднується до вже створеного run.

### Чому run не змінюється після правок

Початкова аналітика може бути зроблена на SHA-A, потім текст відредаговано до SHA-B, після чого №29/30 працюють уже з SHA-B. Це все одна редакторська кампанія.

Тому **кожний report записує власний `target_blob_sha_at_execution`**, але лишається в одному run.

## Формат RUN.md

```markdown
# RUN

- Pipeline: EDITING
- Target: `<repo-relative-path>`
- Run ID: `EDITING-a1b2c3d4-01`
- Initial blob SHA: `<full-sha>`
- Status: OPEN
```

O1 після завершення ставить `Status: COMPLETE`. Наступний leaf/solo запуск на цьому target створює новий run. Для EDITING/31 дозволено використати щойно завершений current run після O1.

## Заголовок кожного report

```markdown
# <PIPELINE>/<ID> — <назва>

- Target: `<repo-relative-path>`
- Run ID: `<run-id>`
- Initial blob SHA: `<sha>`
- Target blob SHA at execution: `<sha>`
- Task file: `AI_AGENT_PIPELINE/<PIPELINE>/<ID>.md`
- Input reports: `...`
- Status: COMPLETE
```

Далі — тільки результат брифу.

## Якщо report уже існує

- `Status: COMPLETE` → не перезаписувати без команди `retry` / `повтори`.
- Повтор → `<ID>__retry-01.md`, потім `retry-02` тощо.
- `BLOCKED` не вважається виконаною задачею.

## EDITING

Дивись `AI_AGENT_PIPELINE/EDITING/INDEX.md`.

Ключова незалежність:
- №01–27 + D1 — SOLO;
- K0 — SOLO_CONTEXT;
- №29–30 — SOLO_POST_EDIT;
- арбітри/O1 читають лише явно визначені результати.

## WRITING

Дивись `AI_AGENT_PIPELINE/WRITING/INDEX.md`.

Ключова незалежність:
- K0 створює SOURCE PACK;
- №01–24 незалежні між собою і бачать лише K0;
- D1–D3 перевіряють конкретні контекстні питання;
- A/W/O етапи збирають результати за routing.
- Повнотекстові редактори йдуть послідовно: `W3 → W4 → W5 → W6 → W7 → O1`.

## Не редагувати цільовий файл без прямого дозволу

Аналізатор або арбітр пише report. Він не змінює літературний файл, якщо користувач прямо не наказав внести правки або сам task-файл явно не є письменницьким/редакторським етапом, який має повернути нову прозу.
