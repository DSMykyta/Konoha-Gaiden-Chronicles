# REPORTS

У цій папці зберігаються всі результати агентних кампаній.

Стандарт:

```text
REPORTS/<target-key>/<run-id>/<PIPELINE>/<task-id>.md
```

Поруч із run:
- `RUN.md` — маніфест кампанії;
- `CURRENT_EDITING.md` / `CURRENT_WRITING.md` на рівень вище — покажчик на активний або останній run.

## Головне правило

Run прив'язаний до **кампанії**, а не до незмінності файла.

Тому:
- `Initial blob SHA` фіксує версію, з якої кампанія почалась;
- кожний report має `Target blob SHA at execution`;
- після редактури №29/30 можуть мати інший SHA, але зберігаються в тому самому editing run.

## Залежні задачі

Task-файл сам містить:
- `required_reports`;
- `optional_reports`;
- `forbidden_reports`.

Worker читає звіти лише з поточного run і лише з дозволеного pipeline/task routing.

Якщо required report відсутній — записувати/повертати `BLOCKED`, не симулювати чужий результат.
