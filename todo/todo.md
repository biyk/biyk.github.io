# TODO: todo-приложение — найденные проблемы и улучшения

## Дыры в логике (баги)

### 18. Мёртвый код
- `src/store/modules/events.js` — копипаста модуля hero (`initHero`, `getGoogleSheetTable` с `real_life_hero`), не используется.
- `src/App.vue` — скрытая вкладка `v-if="0"`.
- `src/components/Shop.vue` — корзина (cart всегда null).

## Улучшения

### Перф / бандл
- `src/vite.config.js:21` — `minify: false`! Включить minify + vendor-чанк (element-plus/vue отдельно) + автоимпорт Element Plus (`unplugin-vue-components`) вместо полного `import ElementPlus` + `dist/index.css`. Сейчас 2.2 МБ JS + 337 КБ CSS.
- `getSortedTodos()` вызывается 3 раза за рендер (дважды в шаблоне + в `getTotalTime`) — сделать `computed`.

### Надёжность
- Идемпотентность выполнения: не давать деньги повторно за ту же `(task_uuid + день)`.
- Гварды: `spreadsheetId` не найден, `averageCalc` ещё не посчитан, `repeat_index`/`gained_gold` отсутствуют.
- Хелпер `toNumber` для `parseFloat(x.toString().replace(',', '.'))` (повторяется в 8+ местах).
- `Vuex strict: true` — поймает прямые мутации объекта из стейта (сейчас есть, напр. `TodoList.vue:144-156`).
- Убрать `console.log/groupCollapsed` из проде (в `getAverageCalc` каждый вызов пишет ~30 строк).

### Архитектура
- Импорт `../../../dnd/static/js/db/google.js` связывает todo с чужим проектом — вынести слой в общий модуль/пакет.
- Двойной источник версии: инлайн `0.2.72` в `index.html` перетирается `version.js` (0.5.39) — оставить один.
- `package-lock.json` в `.gitignore` — лучше коммитить для воспроизводимости.
- `lang="en"` в `index.html` при русском интерфейсе → `lang="ru"`.
- После `TodoNew.addRow` и покупок в `Shop` — `dispatch("todos/initTodos")` / `hero/initHero`.

## Приоритеты

Сначала чинить:
1. **13** — UTC/локальное время в слотах
