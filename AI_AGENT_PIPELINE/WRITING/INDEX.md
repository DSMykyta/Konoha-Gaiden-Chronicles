# WRITING prompt index

Кожний бриф лежить в окремому файлі `<ID>.md`.

## Суфікс `-e`

Якщо task має хоча б один `required_report`, його ID і filename мають суфікс `-e`.

Тому в WRITING:
- `01.md` — незалежний Source Pack;
- `02-e.md … 41-e.md` — задачі, які потребують уже створених report-файлів.

| ID | Тип запуску | Required REPORTS |
|---|---|---|
| 01 | SOLO_CONTEXT | — |
| 02-e | ISOLATED_AFTER_01 | 01 |
| 03-e | ISOLATED_AFTER_01 | 01 |
| 04-e | ISOLATED_AFTER_01 | 01 |
| 05-e | ISOLATED_AFTER_01 | 01 |
| 06-e | ISOLATED_AFTER_01 | 01 |
| 07-e | ISOLATED_AFTER_01 | 01 |
| 08-e | ISOLATED_AFTER_01 | 01 |
| 09-e | ISOLATED_AFTER_01 | 01 |
| 10-e | ISOLATED_AFTER_01 | 01 |
| 11-e | ISOLATED_AFTER_01 | 01 |
| 12-e | ISOLATED_AFTER_01 | 01 |
| 13-e | ISOLATED_AFTER_01 | 01 |
| 14-e | ISOLATED_AFTER_01 | 01 |
| 15-e | ISOLATED_AFTER_01 | 01 |
| 16-e | ISOLATED_AFTER_01 | 01 |
| 17-e | ISOLATED_AFTER_01 | 01 |
| 18-e | ISOLATED_AFTER_01 | 01 |
| 19-e | ISOLATED_AFTER_01 | 01 |
| 20-e | ISOLATED_AFTER_01 | 01 |
| 21-e | ISOLATED_AFTER_01 | 01 |
| 22-e | ISOLATED_AFTER_01 | 01 |
| 23-e | ISOLATED_AFTER_01 | 01 |
| 24-e | ISOLATED_AFTER_01 | 01 |
| 25-e | ISOLATED_AFTER_01 | 01 |
| 26-e | DEPENDENT_CONTEXT_CHECK | 01, 02-e, 03-e, 04-e, 05-e, 06-e, 07-e, 08-e, 09-e, 10-e, 11-e, 12-e, 13-e, 14-e, 15-e, 16-e, 17-e, 18-e, 19-e, 20-e, 21-e, 22-e, 23-e, 24-e, 25-e |
| 27-e | DEPENDENT_CONTEXT_CHECK | 01, 02-e, 03-e, 04-e, 05-e, 06-e, 07-e, 08-e, 09-e, 10-e, 11-e, 12-e, 13-e, 14-e, 15-e, 16-e, 17-e, 18-e, 19-e, 20-e, 21-e, 22-e, 23-e, 24-e, 25-e |
| 28-e | DEPENDENT_CONTEXT_CHECK | 01, 02-e, 03-e, 04-e, 05-e, 06-e, 07-e, 08-e, 09-e, 10-e, 11-e, 12-e, 13-e, 14-e, 15-e, 16-e, 17-e, 18-e, 19-e, 20-e, 21-e, 22-e, 23-e, 24-e, 25-e |
| 29-e | DEPENDENT_RED_TEAM | 01, 02-e, 03-e, 04-e, 05-e, 06-e, 07-e, 08-e, 09-e, 10-e, 11-e, 12-e, 13-e, 14-e, 15-e, 16-e, 17-e, 18-e, 19-e, 20-e, 21-e, 22-e, 23-e, 24-e, 25-e, 26-e, 27-e, 28-e |
| 30-e | DEPENDENT_RED_TEAM | 01, 02-e, 03-e, 04-e, 05-e, 06-e, 07-e, 08-e, 09-e, 10-e, 11-e, 12-e, 13-e, 14-e, 15-e, 16-e, 17-e, 18-e, 19-e, 20-e, 21-e, 22-e, 23-e, 24-e, 25-e, 26-e, 27-e, 28-e |
| 31-e | DEPENDENT_RED_TEAM | 01, 02-e, 03-e, 04-e, 05-e, 06-e, 07-e, 08-e, 09-e, 10-e, 11-e, 12-e, 13-e, 14-e, 15-e, 16-e, 17-e, 18-e, 19-e, 20-e, 21-e, 22-e, 23-e, 24-e, 25-e, 26-e, 27-e, 28-e |
| 32-e | DEPENDENT_ARBITER | 01, 02-e, 03-e, 04-e, 05-e, 06-e, 07-e, 08-e, 09-e, 10-e, 11-e, 12-e, 13-e, 14-e, 15-e, 16-e, 17-e, 18-e, 19-e, 20-e, 21-e, 22-e, 23-e, 24-e, 25-e, 26-e, 27-e, 28-e |
| 33-e | DEPENDENT_ARBITER | 01, 29-e, 30-e, 31-e, 32-e |
| 34-e | DEPENDENT_ARCHITECT | 01, 29-e, 30-e, 31-e, 32-e, 33-e |
| 35-e | DEPENDENT_AUDIT | 34-e |
| 36-e | DEPENDENT_WRITER | 01, 25-e, 34-e, 35-e |
| 37-e | DEPENDENT_EDITOR | 01, 36-e |
| 38-e | DEPENDENT_EDITOR | 34-e, 37-e |
| 39-e | DEPENDENT_EDITOR | 38-e |
| 40-e | DEPENDENT_EDITOR | 01, 34-e, 39-e |
| 41-e | DEPENDENT_ORCHESTRATOR | 01, 02-e, 03-e, 04-e, 05-e, 06-e, 07-e, 08-e, 09-e, 10-e, 11-e, 12-e, 13-e, 14-e, 15-e, 16-e, 17-e, 18-e, 19-e, 20-e, 21-e, 22-e, 23-e, 24-e, 25-e, 26-e, 27-e, 28-e, 29-e, 30-e, 31-e, 32-e, 33-e, 34-e, 35-e, 36-e, 37-e, 38-e, 39-e, 40-e |

## AUTO DISPATCH ORDER

```text
01
→ 02-e → 03-e → ... → 25-e
→ 26-e → 27-e → 28-e
→ 29-e → 30-e → 31-e → 32-e → 33-e
→ 34-e → 35-e → 36-e → 37-e → 38-e → 39-e → 40-e
→ 41-e
```

Кілька чатів можуть паралельно брати runnable задачі через CLAIMS. Суфікс `-e` не означає «послідовно чекати попередній номер»; він означає лише: перед стартом перевір `required_reports`.

Фінальний основний report WRITING = `41-e.md`.
