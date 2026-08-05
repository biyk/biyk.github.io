# TODO: todo-приложение — найденные проблемы и улучшения

## Дыры в логике (баги)

### 5. Деньги = NaN при первом запуске
- Файл: `src/utils/tasks.js:261`
- `money_reward = minutesSpent * calc.averageCalc / 2` — пока `calcExecutions` не отработал, `averageCalc` = `undefined` → `NaN` уходит в героя и в таблицу.
- Исправление: дефолт `calc.averageCalc || 1`.

### 6. Неизвестный `repeat_mode` — тихий no-op
- Файл: `src/utils/tasks.js:248-250`
- `default: return` происходит ДО `updateTodo` — задача не сохраняется как выполненная, денег нет, ошибки нет.
- Исправление: кидать ошибку или откатываться на case `'0'`.

### 7. Повторное ✅ на выполненной задаче = повторные деньги
- Файл: `src/components/TodoList.vue:180-190`
- Если событие уже `colorId='7'`, ветка `if` не срабатывает → `addEvent` создаёт дубль события и `makeTaskDone` выдаёт деньги ещё раз.
- Исправление: блокировать повторное завершение (флаг/проверка, что задача уже выполнена сегодня).

### 8. Магазин позволяет уйти в минус
- Файл: `src/components/Shop.vue:77-113`
- Кнопка только краснеет, но `buyProduct` не проверяет `balance < 0`.
- Исправление: `if (balance < 0) return;` (и сообщение пользователю).

### 9. `updateRowByCode(название, ...)` почти наверняка не обновляет, а добавляет строки
- Файлы: `src/store/modules/todos.js:110`, `src/components/Shop.vue:111-112`
- Коды-ключи строятся по ПЕРВОЙ колонке (`google.js:310-317`, `codes[e[0]] = i`), а `TodoNew` пишет первой колонкой `task_uuid`. Значит `codes[название]` = `undefined` → `id = NaN` → `addRow()` вместо `updateRow`. Таблица замусоривается дублями при каждом выполнении/покупке.
- Проверить структуру листов; обновлять по фактическому ключу первой колонки.

### 10. Запись в read-only computed `todos`
- Файл: `src/components/TodoList.vue:194, 303`
- `this.todos = this.$store.getters['todos/getTodos']` пишет в computed `todos` (строки 84-86) — read-only, в Vue 3 no-op + предупреждение в dev. Реактивность работает через computed, правки мёртвые.
- Исправление: удалить строки 194 и 303.

### 11. Новая задача не появляется в списке
- Файл: `src/components/TodoNew.vue:38-53`
- После `addRow` нет `initTodos`, плюс `getAll` кэширует 10 сек.
- Исправление: `dispatch("todos/initTodos")` после добавления.

### 12. Настройки не уходят в Drive
- Файл: `src/components/Settings.vue:80-90, 135-149`
- Блок `if (0)` мёртв, `driveConfigId` никогда не заполняется → `this.driveConfigId && ...` всегда false.
- Последствие: `spreadsheetId` только в localStorage; после очистки storage `settings.find(...).value` кидает TypeError и приложение рассыпается.
- Исправление: включить синхронизацию с Drive или добавить гвард на отсутствие `spreadsheetId`.

### 13. `getFreeSlots` смешивает UTC и локальное время
- Файл: `src/utils/calendar.js:83-88`
- Дата дня из `toISOString()` (UTC), часы — локальные. В Самаре (+4) с 00:00 до 04:00 ночью слоты считаются для вчерашнего дня.
- Исправление: дату брать из локального времени; TZ вынести в конфиг (сейчас захардкожены `+04:00` и `Europe/Samara`).

### 14. Выполненные задачи не скрываются
- Файл: `src/components/TodoList.vue:122`
- `start < end_today || colorId !== '7'` — задача с прошлой датой и цветом 7 (выполнена) попадает в фильтр «calendar».
- Исправление: фильтровать по `colorId === '7'` в первую очередь.

### 15. Сериализация записей в Sheets не работает
- Файл: `dnd/static/js/db/google.js:178-198, 122-126`
- `updateRow` вызывает `this.waitSending()` без `await` (строка 183), а флаг `sending` на инстансе `Table`, но каждый вызов делает `new Table(...)`.
- Последствие: параллельные записи не блокируются → потеря/перетирание данных.
- Исправление: мьютекс записи на уровне модуля + `await waitSending()`.

### 16. Кэш колонок по хардкод-спредшиту
- Файл: `dnd/static/js/db/google.js:106, 362`
- `sessionStorage.getItem(spreadsheetId + '/' + ...)` использует константу, а не `this.spreadsheetId` → при кастомной таблице подставляются колонки дефолтной.
- Исправление: использовать `this.spreadsheetId`.

### 17. `Cache.js` сломан и не используется
- Файл: `src/utils/cache.js`
- `try { ... } finally { this.value = null }` — `finally` всегда затирает значение, `get()` всегда вернёт null.
- Решение: удалить (класс нигде не используется).

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
1. **9** — замусоривание таблицы
2. **5** — NaN-деньги / падение статистики
3. **7** — двойные деньги
4. **8** — минус в магазине
5. **12** — потеря настроек
