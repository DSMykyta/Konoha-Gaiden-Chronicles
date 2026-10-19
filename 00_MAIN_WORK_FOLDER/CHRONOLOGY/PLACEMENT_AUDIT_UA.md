# Аудит сюжетної хронології та пошук дат

Технічний звіт за структурованими YAML. Жодну дату або сюжет автоматично не змінено.

## Охоплення

- Усього сцен: 1279; активних: 1273.
- Датованих: 1245; без дати: 28.
- Прийнятих умов порядку: 696.
- Днів з незалежними паралельними подіями: 146.
- Справді невідомих посилань у прийнятих умовах: 0.
- Зв'язків із неактивними сценами, пропущених коректно: 11.
- Рушій: OR-Tools CP-SAT; статус: feasible.

## Підтверджені структурні або календарні суперечності

Знайдено: 0. Перед зміною слід перевірити першоджерело.

- За реалізованими правилами не виявлено; це не повний сюжетний аудит.

## Прийняті зв’язки з невідомими посиланнями

Не враховані у датуванні до перевірки ID:

- Немає.

## Посилання на неактивні сцени

Це відомі ID, але сцени виключені з поточної хронології. Не слід повертати їх до активних лише через зв'язок.

- lnk-logic-after-field9-2
- lnk-logic-medical-mission-1
- lnk-logic-medical-mission-2
- lnk-games-t9-first-skills-1
- lnk-games-t9-first-skills-2
- lnk-games-t9-anko-transfer-2
- lnk-games-t9-anko-transfer-3
- lnk-logic-notebook-learning-2
- lnk-logic-notebook-learning-3
- lnk-nobari-route-nobari-debrief
- lnk-nobari-route-nobari-followup-training

## Можливі географічні колізії — не доведені

Випадків: 9. Різні країни за день не доводять неможливість пересування.

- 04.09.62 c-naruto: geo-land-waterfalls, loc-land-of-tea; сцени sc-y0-0904-aoi-attacks-idate-naruto, sc-y0-0904-waterfall-escort, sc-y0-0904-waterfall-threat-revealed
- 05.09.62 c-naruto: geo-land-waterfalls, loc-land-of-tea; сцени sc-y0-0905-team7-rescues-idate, sc-y0-0905-waterfall-villagers-captured
- 05.09.62 c-sasuke: geo-land-waterfalls, loc-land-of-tea; сцени sc-y0-0905-team7-rescues-idate, sc-y0-0905-waterfall-villagers-captured
- 06.09.62 c-naruto: geo-land-waterfalls, loc-land-of-tea; сцени sc-y0-0906-sasuke-naruto-vs-aoi, sc-y0-0906-waterfall-defense-wins, sc-y0-0906-waterfall-resists-suien
- 06.09.62 c-sasuke: geo-land-waterfalls, loc-land-of-tea; сцени sc-y0-0906-sasuke-naruto-vs-aoi, sc-y0-0906-waterfall-defense-wins, sc-y0-0906-waterfall-resists-suien
- 10.10.62 c-gensho-ryudoin: loc-land-of-fire, loc-land-of-mountain-streams; сцени sc-period-ryudoin-foreign-trap, sc-y0-1118-ryudoin-finale
- 10.10.62 c-jako-ryudoin: loc-land-of-fire, loc-land-of-mountain-streams; сцени sc-period-ryudoin-foreign-trap, sc-y0-1118-ryudoin-finale
- 10.10.62 c-might-guy: loc-land-of-fire, loc-land-of-mountain-streams; сцени sc-period-ryudoin-foreign-trap, sc-y0-1118-ryudoin-finale
- 10.10.62 c-rokkaku-ryudoin: loc-land-of-fire, loc-land-of-mountain-streams; сцени sc-period-ryudoin-foreign-trap, sc-y0-1118-ryudoin-finale

## Різні тяглості джерел (не пряма колізія)

Випадків: 1. Потребують окремого авторського рішення про сумісність.

- 05.09.67 c-naruto: main, movie-prison; сцени sc-s2-power-survivors-letter, sc-s2-prison-solitary

## Не датовані та можливі дати

Без підтверджених двосторонніх меж: 27; дати не вигадуються.

| Сцена | Допустимий інтервал | Висновок |
|---|---|---|
| sc-y0-0701-anko-reviews-suna-record | 02.07.62 — 03.07.62 | можливих днів 2; дата не обрана |

## Межі автоматизації

- Одна дата не означає одну годину: перетини персонажів у той самий день не є автоматичною суперечністю.
- Присутність віддалено або лише у згадці не означає фізичної присутності.
- Географію перевірено тільки для відомих країн; альтернативні арки не зіставляються з основними як тверда колізія.
- Власні історії, що ще не розмічені як сцени, цей інструмент не читав.
- Звіт лише пропонує, не змінює YAML, затверджені дати чи сайт.