# Todo-приложение

Приложение-планировщик задач с героем, деньгами, магазином и интеграцией с Google Sheets + Google Calendar. Часть проекта `biyk.github.io` (репозиторий в `/todo`).

## Что умеет

- **Календарь** — список задач на сегодня/сейчас, фильтры, сортировка, таймер выполнения.
- **Задачи** — добавить, старт/пауза/выполнить/удалить, начисление награды `hero_money` по формуле `minutesSpent * averageCalc / 2`, запись исполнений в лист `task_executions`.
- **Магазин** — трата накопленных денег, история в `rewards_history`.
- **Герой** — имя и баланс из листа `real_life_hero`.
- **Статистика** — today/week/month/h24, `averageCalc`/`prevAvg`/`today_points` (кнопка статистики в шапке).
- **Автозаполнение календаря** — задачи расставляются в свободные слоты Google Calendar.
- **Фоновый агент** — синхронизация каждые 60 секунд.
- **Тесты** — встроенный браузерный раннер (кнопка «Тесты» на вкладке «Настройки»).

## Технологии

- Vue 3 + Vue Router (hash history) + Vuex 4
- Element Plus (компоненты автоимпортируются через `unplugin-vue-components`, полный `import ElementPlus` не используется)
- Vite 4 (сборка в `todo/`, см. `vite.config.js`)
- Google Sheets как БД: слой `GoogleSheetDB`/`Table`/`ORM` из `dnd/static/js/db/google.js` (общий с внешним проектом)
- Тесты: Vitest (unit + Playwright smoke)

## Структура

```
todo/src/
├── main.js              # точка входа (Vue, router, store)
├── App.vue              # корневой компонент: вкладки, агент, статистика
├── router.js            # hash-роутер (/#/calendar, /#/new, /#/shop, /#/settings)
├── vite.config.js       # сборка + manualChunks (vue / element-plus) + автоимпорт
├── components/          # TodoList, TodoNew, Shop, Settings
├── store/modules/       # todos, hero, events, settings (Vuex)
├── agents/taskAgent.js  # фоновая синхронизация (60 c)
├── utils/
│   ├── calendar.js      # listEvents/addEvent/updateEvent/deleteEvent/getFreeSlots/makeEvent
│   ├── tasks.js         # makeTaskDone/setTaskToCalendar/setTaskCompleted/calcExecutions/taskSort
│   ├── uuid.js          # generateUUIDv4
│   └── tests/           # браузерный раннер (*.test.js), unit/ (vitest), smoke/ (Playwright)
└── readme.md            # этот файл
```

Сборка выходит в `todo/` (рядом с `index.html`), откуда и деплоится на GitHub Pages.

## Установка

```bash
cd todo/src
npm install
```

## Запуск

| Команда | Назначение |
|---|---|
| `npm run dev` | dev-сервер Vite с HMR |
| `npm run build` | production-сборка в `todo/` |
| `npm run preview` | локальный предпросмотр собранной версии |
| `npm run deploy` | публикация на GitHub Pages (`gh-pages -d dist`) |

## Тесты

| Команда | Что гоняет |
|---|---|
| `npm test` | всё: unit + smoke (последовательно) |
| `npm run test:unit` | unit-тесты Vitest (`utils/tests/unit/*.test.js`) — чистая логика без браузера: ORM, formatData, getFreeSlots, taskSort |
| `npm run test:smoke` | Playwright smoke-тест (`utils/tests/smoke/site-load.test.js`) — headless Chromium грузит собранную версию (`vite preview`) и ловит JS-ошибки на старте |
| `npm run test:watch` | unit-тесты в watch-режиме |

Первый запуск smoke: `npx playwright install chromium` (ставит браузер).

Помимо этого в приложении есть **браузерный раннер** (кнопка «Тесты» в «Настройках»): гоняет `src/utils/tests/*.test.js` против временной копии Google-таблицы, боевые данные не трогаются. Подробности и ручной регресс — в `todo/TESTING.md`.

## Особенности сборки

- **Автоимпорт Element Plus** (`unplugin-vue-components` + `ElementPlusResolver`) — в бандл попадают только используемые компоненты, CSS компонентов собирается отдельно (`element-plus-*.css`).
- **manualChunks** в `vite.config.js`: `vue`-семейство в один чанк, всё остальное из `node_modules` — в `element-plus`. Точный матчинг по имени пакета (не подстрока), чтобы не было циклических импортов между чанками (иначе TDZ-ошибка `Cannot access '…' before initialization`).

## Связанные файлы

- `todo/TESTING.md` — план тестирования и ручной регресс A–K.
- `todo/todo.md` — найденные проблемы и улучшения (надёжность, оффлайн-очередь, архитектура).
