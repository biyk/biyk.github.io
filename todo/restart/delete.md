# delete.md — «Пропустить итерацию» (ⓧ) из Python поверх **нашей** Google Таблицы

Агент работает с той же таблицей, что и браузер: `spreadsheetId` `1-EZE8HvpQbuyKjAmkyPe6042XeN7kR62ffckDSZasMg`, Google Calendar пользователя. Сценарий: нажатие кнопки ⓧ (подсказка в UI — «Нет возможности, нет сил сделать»).

---

## 0. Что делает ⓧ (правильное понимание)

**ⓧ НЕ удаляет задачу из таблицы.** Строка в `real_life_tasks` остаётся на месте, и задача появится в следующем цикле. Настоящий смысл кнопки — «пропустить текущую итерацию без награды, перенести на завтра».

Что происходит фактически:

1. Задача **переносится на завтра** (`task_date = завтра 00:00:00.001 Samara`) — независимо от её `repeat_mode`. Даже если она была «ежемесячная» или «ежегодная», ⓧ сбрасывает её на «завтра».
2. Интервал повторения **увеличивается на 1 день** (`repeat_index += 1`) — мягкий штраф за пропуск. Если следующая итерация планировалась через 1 день, теперь — через 2.
3. Если на сегодня у задачи **уже стояла** галочка ✅ в Calendar (`colorId=7`), то:
   - событие-галочка **удаляется** из Calendar (`events.delete`);
   - `break_multiplier -= 0.1` (маленькая поблажка за то, что «сначала сделал, потом раздумал»);
   - к `repeat_index` дополнительно `+ 0.1` (итого `+1.1` сверху старого).
4. Таймер гасится: `start_date = 0`, `task_finish_date = 0` — ⓧ работает и по запущенной задаче, и по не запущенной.
5. Счётчик `number_of_executions` **всё равно увеличивается на 1** — формально «цикл истрачен».
6. `last_execution` **не обновляется** — остаётся прежним (ⓧ не считается выполнением).
7. Награда **не начисляется**, `task_executions` **не пополняется** — в отличие от ✅/⏹/⏸.
8. Колонка M (`money_reward`) **всё равно перезаписывается** расчётным значением (`task_time * avg / 2 * date_mode`), но в `hero_money` это не попадает. Это особенность JS-кода — воспроизводим 1-в-1, чтобы UI не «поплыл».

**Отличие от ✅/⏹/⏸ одной строкой:** ⓧ переносит на **завтра**, независимо от режима повтора, **не платит награду**, **не пишет журнал**, и **не трогает `last_execution`**.

---

## 1. Когда показывается кнопка ⓧ

Из шаблона:

```html
<span v-if="selectedFilter==='calendar'"
      class="delete"
      @click.stop="deleteTodo(todo)"
      title="Нет возможности, нет сил сделать">ⓧ</span>
```

Условия видимости:
1. Пользователь в фильтре **«Сейчас»** (`selectedFilter === 'calendar'`). В «Сегодня / Завтра / Все» кнопки ⓧ нет.
2. `!todo.completed` — на сегодня ещё нет события-галочки colorId=7 (см. `start.md §2`).
3. `!isBusy(task_uuid)` — нет активного busy-лока.
4. Редактор описания закрыт (`visiblePopover !== task_uuid`).

Python-клиенту эти условия не важны — они только про UI. Но они объясняют, почему **ⓧ на уже-выполненной сегодня задаче в JS невозможна из интерфейса**. Исключение — гонка: если в другой вкладке задачу только что отметили, а здесь ещё не обновили список. В этом случае Python обязан корректно обработать «галочка уже есть → удаляем её + бонусные модификаторы» (см. §4).

---

## 2. Что пишем в `real_life_tasks`

`values.update` на диапазон `A<row>:T<row>` (full-row). Колонки:

| Кол. | Поле | Что становится | Когда |
|---|---|---|---|
| B | `task_time` | **без изменений** | всегда |
| E | `task_sort` | **без изменений** | всегда (штраф `-0.02` на ⓧ не накладывается — это только для «✅ без ранее существовавшего ивента») |
| G | `start_date` | `0` | всегда |
| H | `task_date` | `tomorrow_local_midnight + 1мс` (Europe/Samara) | всегда |
| I | `repeat_index` | `old + 1` (всегда), **плюс** `+ 0.1` если была галочка | см. §5.2 |
| M | `money_reward` | `task_time * avg / 2 * date_mode` (расчёт; **не** начисляется герою) | всегда |
| N | `break_multiplier` | **без изменений**, **минус** `0.1` если была галочка | см. §5.3 |
| O | `task_finish_date` | `0` | всегда |
| P | `number_of_executions` | `old + 1` | всегда |
| T | `last_execution` | **без изменений** (в отличие от ✅/⏹/⏸) | всегда |

Остальные колонки (A, C, D, F, J, K, L, Q, R, S) — сохраняются как есть.

---

## 3. Calendar

**Только одна операция — `events.delete`.** Никаких `insert`/`update`.

1. `events.list` за сегодня (см. `start.md §7`), фильтр `task_uuid in description`.
2. Если нашлось ≥ 1 — `events.delete(calendarId='primary', eventId=<первого>)`.
3. Если 0 — пропускаем удаление, но **всё равно** идём в Sheets.

JS делает `deleteEvent(exist[0])` — удаляет только **первое** найденное. Дубликаты (крайне редки) остаются висеть. Воспроизводим 1-в-1: не удаляем «все», а только первое.

---

## 4. Что **не** происходит

- **`task_executions`** — ни одной новой строки. В `makeTaskDone` при `deleted=1` стоит ранний `return` до `logExecuteTask`.
- **`real_life_hero!hero_money`** — не меняется. Аналогично, до `store.dispatch("hero/updateHero", ...)` дело не доходит.
- **Создание/обновление Calendar-события** — не происходит.
- **`repeat_mode == '5'`** специально обрабатывать **не нужно** — на г награды и так нет ни для какого режима.

---

## 5. Формулы и порядок

### 5.1. Вход

```python
now_ms = int(time.time() * 1000)
now_local = datetime.now(LOCAL_TZ)

row_idx, row = find_task_row(sh_tasks, task_uuid)   # start.md §4
task_time   = int(row[COLS['task_time']]  or 0)
repeat_mode = row[COLS['repeat_mode']]
old_ri      = float(row[COLS['repeat_index']] or 1)
old_bm      = float(row[COLS['break_multiplier']] or 0)
old_sort    = float(row[COLS['task_sort']] or 0)
old_noe     = int(row[COLS['number_of_executions']] or 0)
old_le      = int(row[COLS['last_execution']] or 0)      # сохраняем как есть
date_mode   = float(row[COLS['date_mode']] or 'nan')
```

`start_date` на входе **не проверяется** — ⓧ работает из любого состояния (в JS так). Если задача была запущена, ⓧ остановит её (`start_date = 0` на выходе) без засчитывания `elapsed`.

### 5.2. `repeat_index` — два последовательных изменения

Смотрим на JS: `deleteTodo` **до** вызова `makeTaskDone` делает `task.repeat_index = toNumber(task.repeat_index) + 0.1` (если была галочка). Потом `makeTaskDone` внутри делает `if (deleted) repeat_index += 1`.

Итог:
```python
if event_existed:
    ri_new = old_ri + 0.1 + 1.0        # 1.1 сверху старого
else:
    ri_new = old_ri + 1.0
```

### 5.3. `break_multiplier`

```python
bm_new = (old_bm - 0.1) if event_existed else old_bm
```

Только при удалении существующей галочки. Иначе — без изменений.

### 5.4. `task_date` — всегда «завтра 00:00:00.001» локально

```python
tomorrow = (now_local + timedelta(days=1)).date()
dt = datetime.combine(tomorrow, dtime(0, 0, 1), tzinfo=LOCAL_TZ)
td_new = int(dt.timestamp() * 1000)
```

`repeat_mode` игнорируется. Даже если был `'1'` (месяц) или `'2'` (год) — всё равно на завтра.

### 5.5. Расчёт награды (для колонки M)

JS делает это всегда, даже под `deleted=1` (см. `tasks.js:288-301` — `money_reward` считается до раннего `return`), и пишет в `updatedTask.money_reward`. Воспроизводим:

```python
avg = calc_average_discipline(sh_exec, now_local) or 1.0
minutes_spent = task_time                      # deleted-ветка, elapsed не считаем
money = minutes_spent * avg / 2
if math.isfinite(date_mode):
    money *= date_mode
if not math.isfinite(money):
    money = 0.0
```

Это значение идёт **только** в колонку M. Ни в `task_executions`, ни в `hero_money` — не пишем.

### 5.6. `number_of_executions` и `last_execution`

```python
new_noe = old_noe + 1
new_le  = old_le                     # НЕ обновляется на ⓧ
```

### 5.7. `task_finish_date`, `start_date`

```python
new_start_date = 0
new_finish_date = 0
```

---

## 6. Порядок операций (важен)

```
1. Calendar.events.list             — проверить, есть ли галочка на сегодня
2. Calendar.events.delete           — только если нашлось (первое)
3. Sheets values.update A<row>:T<row> — финальный снапшот real_life_tasks
```

Никаких `append` в `task_executions`, никаких правок `real_life_hero`.

Если шаг 2 упал — шаг 3 **не** делаем (в JS ошибка `deleteEvent` ловится, но `makeTaskDone` всё равно идёт — однако мы воспроизводим «безопасную» версию, где несогласованное состояние хуже).

`throttle(1000)` в JS защищает от двойного клика на 1 секунду. В Python эмулируем так: перед шагом 3 перечитать строку и проверить, что `task_date` ещё не стал «завтрашним». Иначе это гонка / повторный клик — пропустить.

---

## 7. Сборка финальной строки

```python
out = list(row)                                    # 20 значений, '' где пусто
out[COLS['start_date']]         = '0'
out[COLS['task_date']]          = str(td_new)
out[COLS['repeat_index']]       = str(ri_new)
out[COLS['money_reward']]       = str(money)
out[COLS['break_multiplier']]   = str(bm_new)
out[COLS['task_finish_date']]   = '0'
out[COLS['number_of_executions']] = str(new_noe)
# task_time, task_sort, last_execution, и все прочие — НЕ трогаем
```

Сравнение с `stop.md`: колонки B, E, T **не** меняются. Колонки M и P меняются так же. Колонка H — всегда «завтра». Колонка I — другая формула (`old+1` или `old+1.1` вместо `repeat_real`).

---

## 8. Полный рабочий пример (gspread + google-api-python-client)

```python
"""delete_task.py — эквивалент клика ⓧ (пропустить итерацию) из Python."""
import os
import math
import time
from datetime import datetime, timedelta, time as dtime
from zoneinfo import ZoneInfo

import gspread
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

SPREADSHEET_ID = os.environ['SPREADSHEET_ID']
SHEET_TASKS      = 'real_life_tasks'
SHEET_EXECUTIONS = 'task_executions'
LOCAL_TZ         = ZoneInfo('Europe/Samara')

COLS = {
    'task_title': 0, 'task_time': 1, 'task_description': 2, 'task_uuid': 3,
    'task_sort': 4, 'task_color': 5, 'start_date': 6, 'task_date': 7,
    'repeat_index': 8, 'repeat_days_of_week': 9, 'repeat_mode': 10,
    'date_mode': 11, 'money_reward': 12, 'break_multiplier': 13,
    'task_finish_date': 14, 'number_of_executions': 15, 'excludes': 16,
    'task_before': 17, 'task_after': 18, 'last_execution': 19,
}


def _int(v, d=0):
    try:  return int(float(str(v).replace('\u00a0', '').strip() or d))
    except Exception: return d

def _float(v, d=0.0):
    try:  return float(str(v).replace(',', '.').replace('\u00a0', '').strip() or d)
    except Exception: return d

def _now_ms(): return int(time.time() * 1000)


def open_sheet(name):
    gc = gspread.service_account(
        filename=os.environ.get('GOOGLE_APPLICATION_CREDENTIALS', 'service_account.json'))
    return gc.open_by_key(SPREADSHEET_ID).worksheet(name)

def open_calendar():
    creds = Credentials.from_service_account_file(
        os.environ.get('GOOGLE_APPLICATION_CREDENTIALS', 'service_account.json'),
        scopes=['https://www.googleapis.com/auth/calendar'])
    return build('calendar', 'v3', credentials=creds)


def find_task_row(sh, task_uuid):
    data = sh.get_values()
    ui = COLS['task_uuid']
    for off, r in enumerate(data[1:], start=2):
        r = (r + [''] * 20)[:20]
        if r[ui] == task_uuid:
            return off, r
    raise LookupError(f'task_uuid={task_uuid} не найден')


def today_events(cal):
    now = datetime.now(LOCAL_TZ)
    return cal.events().list(
        calendarId='primary',
        timeMin=now.replace(hour=0,    minute=0,  second=0,  microsecond=0).isoformat(),
        timeMax=now.replace(hour=23,   minute=59, second=59, microsecond=0).isoformat(),
        showDeleted=False, singleEvents=True, orderBy='startTime',
    ).execute().get('items', [])


def tomorrow_local_ms(now_local):
    d = (now_local + timedelta(days=1)).date()
    dt = datetime.combine(d, dtime(0, 0, 1), tzinfo=LOCAL_TZ)
    return int(dt.timestamp() * 1000)


def calc_average_discipline(sh_exec, now_local):
    """См. pause.md §5. Здесь — свёрнуто."""
    rows = sh_exec.get_values()
    if not rows: return 1.0
    h = rows[0]
    if 'execution_date' not in h or 'execution_time' not in h: return 1.0
    di, ti = h.index('execution_date'), h.index('execution_time')
    days = {}
    for r in rows[1:]:
        if len(r) <= max(di, ti): continue
        try:
            et = int(float(r[ti])); ed = int(float(r[di]))
        except Exception: continue
        if not et: continue
        k = datetime.fromtimestamp(ed / 1000, LOCAL_TZ).strftime('%Y-%m-%d')
        days[k] = days.get(k, 0) + et
    keys = []
    for i in range(29, -1, -1):
        k = (now_local - timedelta(days=i)).strftime('%Y-%m-%d')
        days.setdefault(k, 0); keys.append(k)
    start, s, c = 1.0, 0, 0
    for i, k in enumerate(keys):
        cur = days[k]
        if i > 0:
            prev = s / c if c else 0
            if cur <= prev * 0.6180339887: start -= 0.01
            elif cur > prev:               start += 0.01
        s += cur; c += 1
    return start


def delete_task(task_uuid: str) -> dict:
    now_local = datetime.now(LOCAL_TZ)

    sh_tasks = open_sheet(SHEET_TASKS)
    sh_exec  = open_sheet(SHEET_EXECUTIONS)
    cal      = open_calendar()

    row_idx, row = find_task_row(sh_tasks, task_uuid)

    # 1. Ищем галочку-событие на сегодня
    existed = next((e for e in today_events(cal)
                    if task_uuid in (e.get('description') or '')), None)
    event_existed = existed is not None

    # 2. Удаляем (только первое, как делает JS)
    if event_existed:
        cal.events().delete(calendarId='primary',
                            eventId=existed['id']).execute()

    # 3. Собираем и пишем финальную строку real_life_tasks
    old_ri  = _float(row[COLS['repeat_index']], default=1.0) or 1.0
    old_bm  = _float(row[COLS['break_multiplier']])
    old_noe = _int(row[COLS['number_of_executions']])
    task_t  = _int(row[COLS['task_time']])
    dm      = _float(row[COLS['date_mode']], default=float('nan'))

    ri_new = old_ri + (0.1 if event_existed else 0.0) + 1.0
    bm_new = old_bm - 0.1 if event_existed else old_bm

    avg   = calc_average_discipline(sh_exec, now_local) or 1.0
    money = task_t * avg / 2
    if math.isfinite(dm): money *= dm
    if not math.isfinite(money): money = 0.0

    td_new = tomorrow_local_ms(now_local)

    out = list(row)
    out[COLS['start_date']]           = '0'
    out[COLS['task_date']]            = str(td_new)
    out[COLS['repeat_index']]         = str(ri_new)
    out[COLS['money_reward']]         = str(money)
    out[COLS['break_multiplier']]     = str(bm_new)
    out[COLS['task_finish_date']]     = '0'
    out[COLS['number_of_executions']] = str(old_noe + 1)
    # task_time, task_sort, last_execution — НЕ трогаем
    sh_tasks.update(range_name=f'A{row_idx}:T{row_idx}', values=[out])

    return {
        'task_uuid': task_uuid,
        'row': row_idx,
        'event_deleted': event_existed,
        'new_task_date_ms': td_new,
        'new_repeat_index': ri_new,
        'money_reward_written_only': money,   # НЕ начислена герою
    }


if __name__ == '__main__':
    import sys, json
    print(json.dumps(delete_task(sys.argv[1]), ensure_ascii=False, indent=2))
```

Запуск:

```
python delete_task.py 6a1c2d3e-...-...-...
```

---

## 9. Чеклист принятия

После ⓧ на задаче с `task_uuid`:

- [ ] Строка задачи **на месте** в `real_life_tasks` (ⓧ НЕ удаляет ряд).
- [ ] Изменились **только** G, H, I, M, N (опционально), O, P. Остальные 13 колонок — байт-в-байт прежние, включая B (`task_time`), E (`task_sort`), T (`last_execution`).
- [ ] `start_date (G) == 0`, `task_finish_date (O) == 0` — таймер остановлен, resume невозможен.
- [ ] `task_date (H)` = «завтра 00:00:00.001» в `Europe/Samara`.
- [ ] `repeat_index (I)` = `old + 1` (или `old + 1.1`, если удаляли галочку).
- [ ] `break_multiplier (N)` = `old − 0.1`, если удаляли галочку; иначе = `old`.
- [ ] `number_of_executions (P)` = `old + 1`.
- [ ] **`last_execution (T)` не изменился.**
- [ ] `money_reward (M)` = `task_time * avg / 2 * date_mode` — колонка обновилась, **но** `real_life_hero!hero_money` остался прежним.
- [ ] В `task_executions` — **ни одной новой строки** с `task_id == task_uuid` после этого вызова.
- [ ] В Calendar на сегодня **нет** события с `description` ⊇ `task_uuid`, даже если было.
- [ ] Повторный ⓧ на той же задаче через < 1 с не должен удваивать штраф (в JS — `throttle(1000)`; в Python см. §6).

---

## 10. Гонки с JS-клиентом

См. [`start.md §8`](file:///C:/Users/b5/Desktop/Программирование/biyk.github.io/todo/restart/start.md#8-гонки-с-js-клиентом-обязательно-прочитать). Специфика ⓧ:

- **Между шагами 1 и 2** JS в другой вкладке может **обновить/удалить** то же Calendar-событие. `events.delete` вернёт `410 Gone` — это не страшно, но в Python стоит ловить и не падать.
- **Между шагами 2 и 3** JS может успеть `initTodos + updateRowByCode` своей задачи и вернуть `task_date` обратно (он читает устаревший снапшот). Защита — перечитать строку непосредственно перед записью; если её `task_date` уже равен «завтра 00:00» и `repeat_index` уже больше на 1 — это повторный вызов, пропускаем.
- ⓧ не трогает `hero_money` — значит, **не создаёт contention на этой ячейке** (в отличие от ✅/⏹/⏸).

---

## 11. Известные шероховатости JS, которые мы воспроизводим 1-в-1

1. **`money_reward` перезаписывается, но не начисляется.** Колонка M врёт: «награда была», хотя её не было. Это осознанное поведение JS; в новом проекте лучше **не** трогать M при ⓧ.
   - Для совместимости с существующим JS-UI — пишем. Для чистого Python-порта — можно пропустить.
2. **`repeat_index += 1` работает «поверх» расчёта `repeat_real`.** Т.е. ⓧ игнорирует реальный интервал и просто добавляет день. На длинных циклах (например, «раз в месяц», `repeat_index=30`) это почти незаметно; на коротких (`repeat_index=1`) — превращает в «раз в два дня».
3. **Только первое событие удаляется**, если дубликаты — следующие остаются. В UI JS это не воспроизводится (одна и та же задача не может иметь двух галочек за день), но Python-клиент теоретически может нарваться.
4. **`throttle(1000)`** — не guarantee; это `lodash/throttle` с `trailing: true` по умолчанию, т.е. второй клик в пределах секунды **всё равно** пройдёт, но отложенно. В Python-клиенте лучше явный mutex на `task_uuid`.

---

## 12. Сравнение четырёх кнопок (одной таблицей)

| Что делает | ✅ (не запущена) | ⏹ (запущена) | ⏸ (запущена) | ⓧ (пропустить) |
|---|---|---|---|---|
| `elapsed_minutes` не считает | да | нет | нет | нет (ⓧ не считает elapsed) |
| `task_time = avg(old, elapsed)` | нет | да | да | **нет** (B не трогаем) |
| Calendar event insert/update | да | да | да | **нет** |
| Calendar event delete | нет | нет | нет | **да**, если было |
| `break_multiplier += 1` если ивент новый | да | да | да | нет (ⓧ наоборот, `-0.1` если ивент был) |
| `repeat_index -= 0.1` если ивент новый | да | да | да | нет |
| `task_sort -= 0.02` если ивент новый | да | да | да | **нет** (E не трогаем) |
| `repeat_index = repeat_real` | да | да | да | **нет**, `+= 1` вместо |
| `task_date` по `repeat_mode` | да | да | да | **нет**, всегда «завтра» |
| `number_of_executions += 1` | да | да | да | да |
| `last_execution = now_ms` | да | да | да | **нет** (T не трогаем) |
| `hero_money += money_reward` | да | да | да | **нет** |
| `task_executions.append` | да | да | да | **нет** |
| `start_date = 0` | да | да | да | да |
| `task_finish_date` на выходе | 0 | 0 | 1 (или elapsed_ms — правильно) | **0** |
| Требует `start_date != 0` на входе | нет | да | да | **нет** |

---

## 13. Одной формулой

```
H ← ms(завтра 00:00:00.001 Europe/Samara)
I ← old_I + 1 + (0.1 if existed_event else 0)
N ← old_N − (0.1 if existed_event else 0)
G ← 0; O ← 0; P ← old_P + 1
M ← task_time * averageCalc / 2 * date_mode     (пишется, но не выплачивается)
B, E, T, и остальные 10 колонок — без изменений
Calendar: events.delete(<первое найденное сегодня>)  — если было
task_executions / hero_money / real_life_rewards — НЕ трогаются
```

Всё. Три HTTP-вызова максимум (list, delete, sheets.update), и один «мёртвый» расчёт награды для колонки M.
