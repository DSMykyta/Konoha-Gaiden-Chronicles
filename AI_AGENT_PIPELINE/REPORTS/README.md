# REPORTS

Тут зберігаються результати агентних кампаній.

## Імена звітів

Report-файли називаються тільки за ID задачі:

```text
01.md
02.md
A1.md
O1.md
```

Час створення не записується в назву або metadata звіту.

Повторний запуск:

```text
04__retry-01.md
04__retry-02.md
```

Основний report не перезаписується автоматично.

## Структура

```text
REPORTS/
└── <target-key>/
    ├── CURRENT_EDITING.md
    ├── CURRENT_WRITING.md
    └── <run-folder>/
        ├── RUN.md
        ├── CLAIMS/
        │   └── <PIPELINE>/
        │       └── <task-id>.md
        ├── EDITING/
        │   ├── 01.md
        │   ├── 02.md
        │   └── O1.md
        └── WRITING/
            ├── K0.md
            ├── 01.md
            └── O1.md
```

Run-папка може містити timestamp для розрізнення кампаній. Звіти — ні.

## Вибір поточного run

1. `CURRENT_<PIPELINE>.md` має пріоритет, якщо веде на OPEN run.
2. Якщо pointer відсутній або зламаний — серед run-папок цього target бери найсвіжішу OPEN кампанію.
3. Не бери run іншої арки.

## Як визначити виконану задачу

- `04.md` = основний результат task 04.
- `04__retry-01.md`, `04__retry-02.md` = повтори task 04.
- Якщо є кілька COMPLETE retry — використовуй retry з найбільшим номером.
- Якщо retry немає — використовуй основний report.

## Автоматичний dispatcher

Коли task ID не задано:
1. знайти target;
2. знайти поточний OPEN run;
3. прочитати INDEX;
4. перевірити наявні report-файли;
5. перевірити CLAIMS;
6. перевірити dependencies/gates;
7. взяти перший runnable task за AUTO DISPATCH ORDER;
8. створити атомарний claim;
9. виконати;
10. записати report `<task-id>.md`;
11. видалити claim.

Наявний claim без report означає: task уже взяв інший worker.

## Готовність required report

Required report = READY тільки коли:
- файл потрібного ID існує;
- він не порожній;
- містить змістовний результат після metadata/header;
- має `Status: COMPLETE`;
- target/run збігаються з поточною кампанією.

Якщо є retry, для READY використовуй COMPLETE retry з найбільшим номером.

Інакше статус входу = `NOT_READY`.

Для dependent task:
- хоча б один required = NOT_READY → `WAITING_FOR_REPORTS`;
- не створювати фінальний report dependent task;
- не заповнювати відсутній input власними припущеннями.

Для auto-dispatch:
- якщо є інший runnable task — виконати його;
- якщо runnable tasks немає — `NO_RUNNABLE_TASKS` і список відсутніх/claimed inputs.

## Завершений pipeline / final handoff

Наявність COMPLETE `O1.md` означає, що основний pipeline цього run завершено.

Коли новий worker отримує загальну команду:
- якщо O1 відсутній або не COMPLETE → працює за dispatcher;
- якщо O1 COMPLETE → повертає готовий результат користувачу й не створює нового run.

Пріоритет готового файла:
1. файл із поля `Final artifact:` у COMPLETE O1;
2. якщо такого поля/файла немає — сам `O1.md`.

Новий run після COMPLETE O1 створюється тільки за явною командою користувача на новий запуск/retry.


## Дубль запуску

Якщо через паралельний запуск одна задача фактично виконалася двічі на тому самому target/run:
- основний результат лишається `<ID>.md`;
- зайвий повний результат не видаляється, якщо його зміст відрізняється;
- його перейменовують у `<ID>__duplicate-01.md`, далі `duplicate-02` тощо;
- `__duplicate-` файли є архівними й **не використовуються** для required_reports, auto-dispatch або O1, якщо користувач прямо не попросив порівняти дубль.
