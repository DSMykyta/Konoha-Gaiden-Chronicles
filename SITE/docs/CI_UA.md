# CI / CD для Konoha Timeline

## Перед відправленням змін у `main`

Після клонування репозиторію один раз налаштуйте локальну перевірку:

```bash
npm --prefix SITE ci
npm --prefix SITE exec -- playwright install chromium
git config core.hooksPath .githooks
```

Тепер звичайний `git push` спочатку запускає `SITE test:ci`:
перевірку структури, збірку, тести логіки, браузерні тести колеса,
плавності панорамування, фокусу персонажа та пошукового debounce.
Якщо тест завершується з помилкою, Git не відправляє код.

Агент, який використовує локальний Git, **має запускати**
`npm --prefix SITE run test:ci` до створення/відправлення змін.
Хук діє лише після явного `git config core.hooksPath .githooks`.
Прямі коміти через вебінтерфейс або GitHub API **не запускають** локальний хук.

## GitHub Actions

Workflow `.github/workflows/site-tests.yml` перевіряє релевантні
push у `main` та pull request до `main`. Наявність CI сама по собі
не блокує прямі коміти через GitHub API. Для гарантованої заборони
неперевірених змін потрібні GitHub rulesets / захищені гілки з
обов'язковими статусами; такий захист зазвичай працює через PR і може
суперечити прямій роботі лише з `main`.

Подивитися результати: https://github.com/DSMykyta/Konoha-Gaiden-Chronicles/actions

## Публікація сайту

В `SITE/vercel.json` встановлено `git.deploymentEnabled: false`.
GitHub Actions тільки тестує; **жоден крок workflow не деплоїть
Vercel**. Публікація здійснюється окремо після перевірок, вручну.

Успішні тести не гарантують, що будь-який UX-баг відсутній: новий
конкретний збій має отримати окремий відтворюваний регресійний тест.
