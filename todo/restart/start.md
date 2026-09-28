# start.md — «Запуск задачи» (▶️) из Python поверх **нашей** Google Таблицы

Агент работает с тем же хранилищем, что и браузерное приложение: Google Sheets + Google Calendar. Никакой своей БД. Python-клиент должен писать в те же ячейки и в том же формате, что пишет JS-клиент — иначе UI «поедет».

Сценарий строго один: клик по ▶️. Остальные кнопки — только для контекста.

---

## 0. Что делает ▶️ (дословно)

Нажимая ▶️, пользователь просит систему:
1. Запомнить, с какой секунды задача считается «выполняемой».
2. Больше ничего.

Никаких записей в журнал, никаких списаний золота, никаких событий в календаре. Единственное изменяемое поле строки — **`start_date`** (колонка G листа `real_life_tasks`).

После успешного старта JS-клиент сам перекрасит кнопку в пару «⏸ + ⏹» — ему достаточно, чтобы поле `start_date` в Sheet перестало быть нулём.

---

## 1. Точка подключения

### 1.1. Идентификаторы

| Что | Значение |
|---|---|
| `spreadsheetId` | `1-EZE8HvpQbuyKjAmkyPe6042XeN7kR62ffckDSZasMg` (дефолт в JS; если пользователь менял в Настройках — уточнить актуальный) |
| Имя листа задач | `real_life_tasks` |
| Имя листа журнала | `task_executions` (при старте не трогаем) |
| Имя листа героя | `real_life_hero` (при старте не трогаем) |

### 1.2. Доступ

Нужен OAuth-refresh токен того же Google-аккаунта, что использует JS-приложение (иначе пользователь увидит «чужую» таблицу или получит permission denied). Варианты:

- **Service Account** — просто, но таблицу надо шарить на e-mail сервиса (`...@...iam.gserviceaccount.com`) с правом «Редактор».
- **OAuth user flow + refresh token** — самый честный вариант: пользователь один раз даёт offline-доступ, мы храним `client_id/client_secret/refresh_token` в `.env`.

Библиотека: `gspread` (обёртка) поверх `google-api-python-client`. Ставим:

```
pip install gspread google-auth python-dotenv
```

### 1.3. Как получить `credentials.json` и refresh token (OAuth user flow)

1. Google Cloud Console → новый проект → включить **Google Sheets API**.
2. Credentials → OAuth client ID → Desktop app → скачать `client_secret_*.json`, переименовать в `client.json`.
3. Первый запуск скрипта: `flow.run_console()` (или `run_local_server()`) → пользователь открывает ссылку, логинится, даёт consent → код → мы обмениваем на `{access_token, refresh_token, ...}`.
4. `refresh_token` кладём в `.env`, дальше работает без браузера.

Если используется Service Account — просто `gspread.service_account(filename='service_account.json')` и шаринг листа.

---

## 2. Схема листа `real_life_tasks` — **обязательное соответствие**

Порядок 20 колонок A..T жёстко зафиксирован. JS-ORM (`ORM.getRaw`) сериализует объект в массив именно в этом порядке. Python обязан использовать тот же порядок при любом «полном» обновлении строки и обязан **не трогать** другие колонки.

```
A task_title            строка, человекочитаемый ключ (уникален в пределах листа)
B task_time             целое, минуты. Пустая ячейка = 0
C task_description      строка
D task_uuid             UUID v4, строка. Стабилизатор между Sheet ↔ Calendar
E task_sort             вещественное (в т.ч. отрицательное), вес сортировки
F task_color            строка, css-имя ('blue', 'red', '')
G start_date            целое unix-мс, строкой. '' или '0' → НЕ запущена
H task_date             целое unix-мс, строкой. Когда задача становится доступной
I repeat_index          вещественное (float в тексте), средний интервал повтора в днях
J repeat_days_of_week   строка '1010100' (индекс 0 = воскресенье, как в JS getDay())
K repeat_mode           строка '0'/'1'/'2'/'3'/'5'/'6'
L date_mode             вещественное, множитель награды
M money_reward          вещественное, последняя начисленная награда
N break_multiplier      вещественное, штраф за пропуск
O task_finish_date      целое unix-мс, строкой. 0 = не на паузе; >0 = сколько уже длилась до паузы
P number_of_executions  целое, счётчик
Q excludes              CSV со `task_uuid`
R task_before           строка (зарезервировано)
S task_after            строка (зарезервировано)
T last_execution        целое unix-мс, строкой
```

Строка 1 листа — заголовки (буквально `task_title | task_time | ...`). Данные начинаются со строки 2.

**Важно про форматирование чисел:** в Sheet всё хранится строками. JS читает через `parseInt(...)`, поэтому:

- `'1738742400000'` → валидно.
- `''` (пусто) → `parseInt('') = NaN`, в UI трактуется как 0.
- `'1 738 742 400 000'` (с пробелами) → сломает парсер JS. Python должен писать **без разделителей**, plain ASCII digits.
- `'1.7e12'` — тоже сломает. Не использовать экспоненциальную нотацию.

Пишите: `str(int(value))`. Никогда — `str(float)` с `.0` на конце в колонках-мс.

---

## 3. Формула старта

Та же, что в JS-приложении:

```
now_ms     = int(time.time() * 1000)
task_finish_date = int(cell_O or 0)
new_start_date   = now_ms - task_finish_date   # если task_finish_date > 0
new_start_date   = now_ms                      # иначе
```

Логика: если до этого была пауза с корректно сохранённой длительностью (колонка O), resume продолжается «с того же места». Иначе — свежий старт.

Никакого другого поля не меняется.

---

## 4. Как найти строку нужной задачи

В JS-приложении поиск идёт по **колонке A** (`task_title`) — это «primary key» листа.

Есть три способа, от плохого к хорошему:

### 4.1. (Плохо) Искать по `task_uuid`
`task_uuid` — колонка D. Её JS использует как идентификатор в Vuex/localStorage, а **не** как ключ строки в Sheet. Если у двух задач одинаковый `task_title`, это редкость (уникальность не enforced), но `task_uuid` тем более уникален. Искать по D можно, но тогда надо читать лист шире (`A:T` или сразу `D:D`). Это нормально.

### 4.2. (Хорошо) Найти номер строки по `task_title` через `batchGet` колонки A

```python
def find_row_index_by_title(sh, title: str) -> int | None:
    """Возвращает 1-based номер строки в Sheet или None."""
    col = sh.col_values(1)                # столбец A, включая заголовок
    for i, v in enumerate(col, start=1): # i=1 — заголовок
        if i == 1:
            continue
        if v == title:
            return i
    return None
```

`sh.col_values(1)` делает один HTTP-запрос на `A:A`. Быстро.

### 4.3. (Лучше) Искать по `task_uuid` сразу с валидацией

```python
def find_row_by_uuid(sh, uuid: str) -> tuple[int, list[str]] | None:
    rows = sh.get_values()                # весь лист A:T
    header, data = rows[0], rows[1:]
    idx = header.index('task_uuid')       # = 3
    for offset, row in enumerate(data):
        if len(row) > idx and row[idx] == uuid:
            return (offset + 2, row)      # +2 = 1-based + заголовок
    return None
```

Этот подход предпочтительнее: `task_uuid` уникален по смыслу, `task_title` — человекочитаемый и потенциально конфликтующий.

> Но если вам нужно писать ровно туда же, куда пишет JS-клиент, ориентируйтесь на **A: `task_title`**. Иначе два клиента будут создавать разные строки. Практический компромисс: найти по uuid → прочитать `task_title` → обновлять по `task_title`.

---

## 5. Как писать результат

Есть два варианта. Рекомендую **A**.

### Вариант A — точечное обновление одной ячейки (рекомендуется)

Меняется только колонка G. Ничего не затирается, параллельные изменения других колонок не теряются.

```python
def start_task(sh, row_idx: int, new_start_ms: int) -> None:
    sh.update(
        range_name=f'G{row_idx}',
        values=[[str(new_start_ms)]],
    )
```

Это один HTTP-вызов `spreadsheets.values.update` на диапазон `real_life_tasks!G<row>`.

### Вариант B — полная перезапись строки A:T (как делает JS)

Делать только если вы **сначала прочитали всю текущую строку**, поменяли в списке одно значение и записали обратно. Иначе — потеряете гонки с JS-клиентом.

```python
def start_task_full_row(sh, row_idx: int, new_start_ms: int) -> None:
    current = sh.row_values(row_idx)                 # A:T (20 значений, '' где пусто)
    current[6] = str(new_start_ms)                   # G = индекс 6
    # ВНИМАНИЕ: JS-ORM пишет 20 значений. Если строка короче — дополнить ''
    while len(current) < 20:
        current.append('')
    current = current[:20]
    sh.update(range_name=f'A{row_idx}:T{row_idx}', values=[current])
```

**Не используйте** `sh.update([current_row])` без диапазона — gspread перезапишет лист с A1.

### Почему A предпочтительнее

JS-клиент перезаписывает **всю** строку на каждое изменение (см. §8 «Гонки»). Если Python начал день с «прочитал → подумал → перезаписал всё», он может вернуть в Sheet устаревшее состояние колонок, изменённых JS в другой вкладке между чтением и записью. Точечный update одной ячейки лишает нас этого класса багов.

---

## 6. Полный рабочий пример (gspread)

```python
"""start_task.py — клик по ▶️ из Python.

.env:
  GOOGLE_APPLICATION_CREDENTIALS=service_account.json
  # или для OAuth user flow:
  # CLIENT_SECRET_FILE=client.json
  # REFRESH_TOKEN=...
  SPREADSHEET_ID=1-EZE8HvpQbuyKjAmkyPe6042XeN7kR62ffckDSZasMg
"""
import os
import time
import gspread

SHEET_NAME = 'real_life_tasks'
COL_START_DATE = 'G'        # start_date
COL_TASK_FINISH_DATE = 'O'  # task_finish_date


def open_sheet() -> gspread.Worksheet:
    gc = gspread.service_account(
        filename=os.environ.get('GOOGLE_APPLICATION_CREDENTIALS', 'service_account.json')
    )
    ss = gc.open_by_key(os.environ['SPREADSHEET_ID'])
    return ss.worksheet(SHEET_NAME)


def find_row_by_uuid(sh: gspread.Worksheet, task_uuid: str) -> int:
    """Возвращает 1-based номер строки или raises LookupError."""
    data = sh.get_values()
    if not data:
        raise LookupError('лист пуст')
    header = data[0]
    try:
        uuid_idx = header.index('task_uuid')
    except ValueError:
        raise LookupError('нет колонки task_uuid')
    for offset, row in enumerate(data[1:], start=2):
        if len(row) > uuid_idx and row[uuid_idx] == task_uuid:
            return offset
    raise LookupError(f'uuid {task_uuid} не найден')


def read_int_cell(sh: gspread.Worksheet, row_idx: int, column: str) -> int:
    val = sh.acell(f'{column}{row_idx}').value or ''
    val = val.strip().replace('\u00a0', '')   # NBSP иногда прилетает
    if not val:
        return 0
    try:
        return int(float(val))                # допускаем '1738742400000.0'
    except ValueError:
        return 0


def start_task(task_uuid: str) -> int:
    """Эквивалент клика ▶️. Возвращает новый start_date (unix-мс)."""
    sh = open_sheet()
    row_idx = find_row_by_uuid(sh, task_uuid)

    # Проверяем что задача ещё не запущена (иначе это уже повторный клик)
    current_start = read_int_cell(sh, row_idx, COL_START_DATE)
    if current_start != 0:
        raise RuntimeError(f'задача уже запущена с {current_start}')

    finish = read_int_cell(sh, row_idx, COL_TASK_FINISH_DATE)
    new_start = int(time.time() * 1000) - finish   # finish==0 → просто now

    # Точечное обновление единственной ячейки G<row>
    sh.update(range_name=f'{COL_START_DATE}{row_idx}', values=[[str(new_start)]])
    return new_start


if __name__ == '__main__':
    import sys
    print(start_task(sys.argv[1]))
```

Запуск:

```
python start_task.py 6a1c2d3e-...-...-...
```

---

## 7. Чеклист принятия

После запуска скрипта открыть браузер с JS-приложением:

- [ ] JS после следующего `initTodos` (агент в JS подтягивает раз в минуту, либо принудительно F5) показывает задачу как «в работе» — кнопка ▶️ пропала, видны ⏸/⏹.
- [ ] Таймер «минут в работе» показывает значение, равное `(now - new_start) / 60000` — т.е. если resume без паузы, ~0; если resume с паузой, ~`task_finish_date/60000`.
- [ ] В самом листе `real_life_tasks` **изменилась ровно одна ячейка** (G). Все остальные 19 ячеек строки идентичны тем, что были до запуска Python.
- [ ] В листе `task_executions` — ни одной новой строки.
- [ ] В листе `real_life_hero` (`hero_money`) — никаких изменений.
- [ ] В Google Calendar — ни одного нового/изменённого события.

Если хотя бы один пункт сломался — Python-клиент пишет слишком много.

---

## 8. Гонки с JS-клиентом (обязательно прочитать)

JS-клиент:
- Каждые 60 секунд делает `initTodos` → полное чтение листа в Vuex.
- На **любое** своё изменение делает **full-row update** (см. `updateRowByCode`): пишет все 20 колонок из локального снапшота.

Следствия для Python:

1. **Python пишет между `getAll` и `updateRowByCode` JS-клиента** → при ближайшем изменении в этой же задаче на клиенте JS затирает ячейку G обратно своим снапшотом. Пользователь увидит «я же запустил, а она снова не запущена».
   Защита:
   - После своего `update` делать `listEvents` не нужно, но по возможности подвигать UI на клиенте (пользователь сам нажал F5, либо дождаться 60-секундного агента).
   - Правильнее: **не давать JS-клиенту писать эту же задачу параллельно**. Если вы запускаете из Python — предупредите пользователей/закройте вкладку.
2. **Python читает устаревшую колонку O** → формула resume даст неправильный `start_date`. Поэтому **обязательно** читать колонку O непосредственно перед вычислением `new_start` (не кэшировать), и сразу писать G в том же запросе (`batchUpdate`, see ниже).

### Атомарный вариант «прочитал O → посчитал → записал G» через `batchUpdate`

`spreadsheets.values.batchUpdate` позволяет в одном HTTP-запросе обновить произвольный набор диапазонов. Прочитать в том же запросе нельзя, но можно сделать `RefetchPolicy` минимальным:

```python
def start_task_atomic(sh, row_idx):
    o_g = sh.batch_get([f'O{row_idx}', f'G{row_idx}'])
    finish = int(float((o_g[0][0][0] if o_g[0] else '0') or 0))
    current_start = int(float((o_g[1][0][0] if o_g[1] else '0') or 0))
    if current_start != 0:
        raise RuntimeError('already running')
    new_start = int(time.time() * 1000) - finish
    sh.batch_update([{
        'range': f'G{row_idx}',
        'values': [[str(new_start)]],
    }])
```

Окно гонки сокращается до ~секунды, но не равно нулю. Для 100% защиты нужен `ETag`/условный update, которого в Sheets API v4 нет. Принять это как ограничение.

---

## 9. Известные баги, которые **не надо переносить**

1. В JS `pauseTask` пишет `task_finish_date = 1` (миллисекунда) вместо накопленной длительности → resume фактически обнуляет таймер. В Python **не** повторяйте. Пауза должна писать:
   ```python
   elapsed = now_ms - current_start
   sh.batch_update([
       {'range': f'O{row_idx}', 'values': [[str(elapsed)]]},
       {'range': f'G{row_idx}', 'values': [['0']]},
   ])
   ```
2. В JS `updateRowByCode` пишет всю строку — это потенциальный источник потери данных при конкурентных правках. В Python всегда пишите только нужные ячейки (§5 вариант A).
3. В JS нет защиты от двойного клика ▶️. В Python — проверяйте `current_start != 0` **в том же** `batch_get`, что читаете `O`.

---

## 10. Что НЕ входит в сценарий «▶️»

Не реализовывать, если задача строго «start»:

- Google Calendar (`addEvent/updateEvent/deleteEvent/listEvents`) — не трогаем.
- `task_executions` (журнал выполнений) — не пишем.
- `hero_money` и весь `real_life_hero` — не трогаем.
- Изменение `repeat_index`, `task_date`, `last_execution`, `number_of_executions`, `money_reward` — **не** делаем. Всё это меняется только на «✅ завершить» / «⏹ стоп».
- Написание в `real_life_rewards` / `rewards_history` (листы магазина) — не трогаем.

---

## 11. Одной формулой

```
G<row> ← str( int(time.time()*1000) - (int(O<row>) or 0) )
```

Всё остальное — обвязка: найти `<row>` по `task_uuid`/`task_title`, проверить что `G<row>` было 0, записать, больше ничего не трогать.
