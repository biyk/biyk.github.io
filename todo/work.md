# WORK: сетевые ошибки чтения не должны стирать данные

Баг (todo.md, пункт 1): **Чтение не должно возвращать `[]` при ошибке сети.**

## Диагноз (подтверждено кодом)

1. `fetchSheetValues` (google.js:854-891): на ошибке сети `catch` возвращает `data = []`; на пустом ответе тоже `[]`.
2. `getAll` (google.js:285-306): `[]` — truthy → `columns[list] = undefined`, `setCodes([])` чистит коды и `sessionStorage`, кэш перезаписывается. Всё это выглядит как «успешное чтение».
3. `initTodos` (todos.js:89-94): `new ORM(undefined)` не падает (`columns = []`), `map` по `[]` → `commit("SET_TODOS", [])` → стейт и `localStorage['todo-list']` затёрты.
   - Триггеры: `taskAgent` (раз в ~60с), `finally` в `toggleTodo`, `mounted`.
4. То же самое у `initHero` (hero.js:59-66): ошибка → `SET_HERO({})` + перезапись `localStorage['hero-list']`.

## Нюанс: почему `getAll` НЕ может вернуть `null`

`google.js` — общий модуль (dnd + todo). У `getAll` ~46 вызовов, включая `dnd/`:
- `init.js:287` — `new ORM(data[0])`
- `spells.js:83` — `data.filter(...)`
- `script.js:437` — `keys.maps`

Если `getAll` вернёт `null` — там будут TypeError. Поэтому:

- `fetchSheetValues` → **`null`** на ошибке/пустоте (ядро фикса).
- `getAll` → не трогает `columns`/`codes`/кэш, но возвращает **`[]`** (контракт массива для всех вызовов).
- `initTodos`/`initHero` → различают «ошибку» по `!list || !list.length` (у `real_life_tasks`/`real_life_hero` заголовок есть всегда) и **возвращаются, не коммитя `SET_*`**.

## Тесты (TDD: сначала тесты, потом код)

### 1. Юнит `utils/tests/unit/network-error.test.js` (offline, vitest, без gapi)
Стаб `window.GoogleSheetDB` с `fetchSheetValues` (как в `_globals.js`). Кейсы:
- `fetchSheetValues` → `null`: `getAll()` возвращает `[]` (массив, не `null` — не ломает dnd-вызовы).
- `getAll` НЕ трогает: `table.columns['list']`, `table.codes`, ключи `sessionStorage` `<sid>/<list>/columns` и `/codes` (предзаполняем и проверяем, что не перезаписаны).
- `getAll({formated:true})` на ошибке возвращает `[]` без throw.
- `getRow` возвращает `[]` (не `null`) — совместимость с textarea.js.
- `getColumns` не падает при `null` (guard `values && values.length > 0`).

### 2. Юнит `utils/tests/unit/initTodos-network-error.test.js`
Реальные `actions.initTodos`/`initHero` с фейковыми `commit`/`rootGetters`; стаб `window.GoogleSheetDB` → `fetchSheetValues: () => null`. Кейсы:
- Сид в `localStorage['todo-list']`; после `initTodos` — **`SET_TODOS` не вызван, состояние и localStorage не тронуты, без throw** (до фикса: коммит `[]` или перезапись localStorage).
- Аналогично для `hero/initHero` (`hero-list`).
- Сэнети-кейс: при успешном чтении `initTodos` по-прежнему коммитит строки (без регрессии).

### 3. Смоук `utils/tests/smoke/network-error.test.js` (опционально, end-to-end)
После первой загрузки заставить стаб `values.get` режектиться и дёрнуть `initTodos` — проверить, что задачи на экране и `localStorage['todo-list']` не пуст. Дорого (~30с).

## Правки кода

- `dnd/static/js/db/google.js`:
  - `fetchSheetValues`: ошибка/пустота → `null` вместо `[]`.
  - `getAll`: `return response || [];` (columns/codes/кэш не трогаем при null).
  - `getRow`: `return await this.api.fetchSheetValues(...) || [];`.
  - `getColumns`: guard `values && values.length > 0`.
- `todo/src/store/modules/todos.js`: guard в `initTodos`.
- `todo/src/store/modules/hero.js`: guard в `initHero`.

## Вопросы по скоупу

- Делаем ли смоук-тест (п.3) или ограничиваемся юнитами (п.1-2)?
- events.js содержит копию `initHero` с `SET_HERO` (вероятно не используется) — чинить только если нужно.

## Порядок работы (TDD)

1. Написать юнит-тесты (п.1-2), убедиться что падают на текущем коде.
2. Внести правки кода.
3. `npm test` + `npm run build`.
4. Обновить `todo.md`/`TESTING.md`.
