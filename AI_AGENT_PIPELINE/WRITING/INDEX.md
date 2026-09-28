# WRITING prompt index

Кожний бриф лежить в окремому файлі `<ID>.md`.

Команда:
```text
Файл: <repo-relative-path>
Виконай WRITING/07
```

означає: прочитати `AI_AGENT_PIPELINE/WRITING/07.md`, виконати його routing і записати результат у REPORTS поточного run.

| ID | Тип запуску | Required REPORTS |
|---|---|---|
| K0 | SOLO_CONTEXT | — |
| 01 | ISOLATED_AFTER_K0 | K0 |
| 02 | ISOLATED_AFTER_K0 | K0 |
| 03 | ISOLATED_AFTER_K0 | K0 |
| 04 | ISOLATED_AFTER_K0 | K0 |
| 05 | ISOLATED_AFTER_K0 | K0 |
| 06 | ISOLATED_AFTER_K0 | K0 |
| 07 | ISOLATED_AFTER_K0 | K0 |
| 08 | ISOLATED_AFTER_K0 | K0 |
| 09 | ISOLATED_AFTER_K0 | K0 |
| 10 | ISOLATED_AFTER_K0 | K0 |
| 11 | ISOLATED_AFTER_K0 | K0 |
| 12 | ISOLATED_AFTER_K0 | K0 |
| 13 | ISOLATED_AFTER_K0 | K0 |
| 14 | ISOLATED_AFTER_K0 | K0 |
| 15 | ISOLATED_AFTER_K0 | K0 |
| 16 | ISOLATED_AFTER_K0 | K0 |
| 17 | ISOLATED_AFTER_K0 | K0 |
| 18 | ISOLATED_AFTER_K0 | K0 |
| 19 | ISOLATED_AFTER_K0 | K0 |
| 20 | ISOLATED_AFTER_K0 | K0 |
| 21 | ISOLATED_AFTER_K0 | K0 |
| 22 | ISOLATED_AFTER_K0 | K0 |
| 23 | ISOLATED_AFTER_K0 | K0 |
| 24 | ISOLATED_AFTER_K0 | K0 |
| D1 | DEPENDENT_CONTEXT_CHECK | K0 |
| D2 | DEPENDENT_CONTEXT_CHECK | K0 |
| D3 | DEPENDENT_CONTEXT_CHECK | K0 |
| A1 | DEPENDENT_RED_TEAM | K0, 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24 |
| A2 | DEPENDENT_RED_TEAM | K0, 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24 |
| A3 | DEPENDENT_RED_TEAM | K0, 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24 |
| A4 | DEPENDENT_ARBITER | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24 |
| A5 | DEPENDENT_ARBITER | K0, A1, A2, A3, A4 |
| W1 | DEPENDENT_ARCHITECT | K0, A1, A2, A3, A4, A5 |
| W2 | DEPENDENT_AUDIT | W1 |
| W3 | DEPENDENT_WRITER | K0, W1, W2, 24 |
| W4 | DEPENDENT_EDITOR | W3, K0 |
| W5 | DEPENDENT_EDITOR | W4, W1 |
| W6 | DEPENDENT_EDITOR | W5 |
| W7 | DEPENDENT_EDITOR | W6, K0, W1 |
| O1 | DEPENDENT_ORCHESTRATOR | K0, 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, A1, A2, A3, A4, A5, W1, W2, W3, W4, W5, W6, W7 |

## Значення

- **SOLO_CONTEXT** — K0 працює з джерелом/Git/доступним авторським контекстом, без REPORTS.
- **ISOLATED_AFTER_K0** — №01–24 бачать K0/SOURCE PACK, але не бачать один одного.
- **DEPENDENT_CONTEXT_CHECK** — D1–D3 отримують K0 і лише релевантні пропозиції 01–24 як питання для перевірки.
- **DEPENDENT*** — читає лише зазначені required/optional результати.
- Якщо required REPORT відсутній — `BLOCKED`.

## Редакторський ланцюг

Після W3 повнотекстові проходи виконуються послідовно:
`W3 → W4 → W5 → W6 → W7 → O1`.

Це routing-рішення потрібне, щоб не створювати чотири паралельні несумісні версії повного тексту.
