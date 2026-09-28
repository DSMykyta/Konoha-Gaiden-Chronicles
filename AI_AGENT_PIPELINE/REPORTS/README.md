# REPORTS

Тут зберігаються результати агентних кампаній.

## Імена

Усі **створювані run-папки** та **історичні report-файли** мають timestamp у кінці назви.

Часова зона: `Europe/Kyiv`.

Suffix:

```text
__YYYY-MM-DD_HH-mm-ss_KYIV
```

Приклади:

```text
EDITING-a1b2c3d4-01__2026-09-28_22-47-31_KYIV/
04__2026-09-28_22-53-08_KYIV.md
A1__2026-09-28_23-41-22_KYIV.md
```

Стабільні pointer/lock-файли без timestamp:
- `CURRENT_EDITING.md`;
- `CURRENT_WRITING.md`;
- `RUN.md`;
- `CLAIMS/<PIPELINE>/<task-id>.md`.

## Стандарт

```text
REPORTS/
└── <target-key>/
    ├── CURRENT_EDITING.md
    ├── CURRENT_WRITING.md
    └── <run-base-id>__<created-timestamp>_KYIV/
        ├── RUN.md
        ├── CLAIMS/
        │   └── <PIPELINE>/
        │       └── <task-id>.md
        ├── EDITING/
        │   └── <task-id>__<created-timestamp>_KYIV.md
        └── WRITING/
            └── <task-id>__<created-timestamp>_KYIV.md
```

## Вибір найсвіжішого

Для потрібного target і pipeline:
1. `CURRENT_<PIPELINE>.md` має пріоритет, якщо веде на OPEN run.
2. Якщо pointer відсутній/зламаний — серед папок цього target бери найновішу OPEN run-папку потрібного pipeline за timestamp у назві.
3. Для конкретного task шукай `<task-id>__*.md`.
4. Якщо є кілька COMPLETE report-файлів, бери найновіший за timestamp у filename.
5. Retry належить тому самому task ID:
   `04__retry-01__<timestamp>.md` → task `04`.

## Автоматичний dispatcher

Коли task ID не задано:
1. знайти target;
2. знайти найсвіжіший OPEN run;
3. прочитати INDEX;
4. зіставити task ID з report filename;
5. перевірити CLAIMS;
6. перевірити dependencies/gates;
7. взяти перший runnable task за AUTO DISPATCH ORDER;
8. створити атомарний claim;
9. виконати;
10. записати timestamped report;
11. видалити claim.

Наявний claim без report означає: task уже взяв інший worker.

## Залежності

Task-файл визначає:
- `required_reports`;
- `optional_reports`;
- `forbidden_reports`;
- `stage_gate`.

Required report вважається готовим лише якщо існує принаймні один відповідний timestamped report зі `Status: COMPLETE`.

Не симулювати відсутній звіт.

## Готовність required report

Файл не вважається готовим лише тому, що його ім'я існує.

Required report = READY тільки коли:
- filename відповідає потрібному task ID;
- розмір > 0;
- є змістовний результат після metadata/header;
- `Status: COMPLETE`;
- target/run збігаються з поточною кампанією.

Інакше статус входу = `NOT_READY`.

Для dependent task:
- хоча б один required = NOT_READY → `WAITING_FOR_REPORTS`;
- не створювати фінальний report dependent task;
- не заповнювати відсутній input власними припущеннями.

Для auto-dispatch:
- якщо є інший runnable task — виконати його;
- якщо runnable tasks немає — `NO_RUNNABLE_TASKS` і список відсутніх/claimed inputs.
