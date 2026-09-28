# pause.md — «Пауза» (⏸) из Python поверх **нашей** Google Таблицы

Агент работает с той же таблицей, что и браузер: `spreadsheetId` `1-EZE8HvpQbuyKjAmkyPe6042XeN7kR62ffckDSZasMg`, Google Calendar пользователя. Никакой своей БД. Все форматы и семантика — как в JS-клиенте.

Сценарий: нажатие кнопки ⏸ на запущенной задаче (`start_date != 0`).

---

## 0. Что делает ⏸ (дословно)

В исходном JS-приложении пауза — это **полное засчитывание выполнения + остановка таймера**. Не «приостановить и продолжить позже», а «зафиксировать сколько длилось, начислить награду, перепланировать следующее выполнение, обнулить `start_date`».

Шаги, которые должны произойти (все обязательны, иначе UI «поедет»):

1. Вычислить `elapsed_minutes` = сколько задача реально была в работе (округление вверх).
2. Пересчитать плановую длительность `task_time` как среднее арифметическое (округление вверх) между прежним планом и фактом.
3. Создать/обновить событие-«галочку» в Google Calendar на сегодня (цвет `7`) — это то, по чему UI считает задачу выполненной.
4. Если события-галочки на сегодня **не было** до паузы — это первое выполнение за день: дополнительно «наказать» задачу (`break_multiplier += 1`, `repeat_index -= 0.1`, `task_sort -= 0.02`), чтобы она поднялась в приоритете на будущее.
5. Засчитать выполнение — **пересоздать задачу по `repeat_mode`**: сдвинуть `task_date` на следующее срабатывание, обновить `repeat_index`, инкрементировать `number_of_executions`, выставить `last_execution`, начислить награду.
6. Начислить `money_reward` → добавить в `real_life_hero!hero_money`.
7. Записать одну строку в `task_executions` (журнал выполнений).
8. **Финальный штрих паузы** (собственно то, что отличает ⏸ от ✅): заглушить «выполнена»-флаг. JS пишет `task_finish_date = 1, start_date = 0`. Формально это баг (см. §9); правильный вариант — `task_finish_date = elapsed_ms`.

**Чем ⏸ отличается от ✅ (кнопки «завершить»):**

| Действие | ✅ (без старта) | ✅ (из состояния «в работе») | ⏸ (из состояния «в работе») |
|---|---|---|---|
| `elapsed_minutes` не считаем | ✔ (start_date=0) | ✘ | ✘ |
| Пишем событие colorId=7 | ✔ | ✔ | ✔ |
| Начисляем награду | ✔ (по `task_time`) | ✔ (по `elapsed_minutes`) | ✔ (по `elapsed_minutes`) |
| `task_date` уходит на след. цикл | ✔ | ✔ | ✔ |
| `start_date` после операции | 0 | 0 | 0 |
| `task_finish_date` после операции | 0 | 0 | **elapsed_ms** (в JS — 1) |

Т.е. ⏸ = «✅ от работающей задачи» + «запомнить длительность, чтобы следующий ▶️ продолжил таймер».

---

## 1. Схема затронутых листов

### 1.1. `real_life_tasks` — 20 колонок A..T
Полный перечень в [`start.md`](file:///C:/Users/b5/Desktop/Программирование/biyk.github.io/todo/restart/start.md#2-схема-листа-real_life_tasks--обязательное-соответствие). При паузе **изменяются**:

| Кол. | Поле | Что становится |
|---|---|---|
| B | `task_time` | `ceil((old_task_time + elapsed_minutes) / 2)` |
| E | `task_sort` | `old - 0.02` (только если событие-галочка добавилась впервые за день) |
| G | `start_date` | `0` |
| H | `task_date` | новый, по `repeat_mode` (см. §4) |
| I | `repeat_index` | `repeat_real` (см. §3), и дополнительно `-0.1` если галочка новая |
| M | `money_reward` | новая начисленная сумма (§5) |
| N | `break_multiplier` | `old + 1` (только если галочка новая) |
| O | `task_finish_date` | **elapsed_ms** (правильно) или `1` (как в JS — баг, см. §9) |
| P | `number_of_executions` | `old + 1` |
| T | `last_execution` | `now_ms` |

Остальные колонки (A, C, D, F, J, K, L, Q, R, S) — **не менять**.

### 1.2. `task_executions` — 7 колонок A..G, append

Шапка (из теста `04-headers-sheet.test.js`):
```
A execution_id      UUID v4 — новый, не task_uuid
B execution_date    unix-мс current
C execution_time    минуты (то же, что elapsed_minutes / old_task_time при старте=0)
D gained_gold       money_reward из §5 (float, plain digits)
E task_title        строка
F task_id           = real_life_tasks.task_uuid (D)
G task_date         строка 'DD.MM.YYYY' по локали ru-RU (см. §6)
```

При паузе **добавляется ровно одна** строка. Не обновляем, не ищем существующую.

### 1.3. `real_life_hero` — 2 колонки A..B, update-by-code

`code = 'hero_money'`, `value = old_value + money_reward` (float, plain digits). Искать строку по колонке A. Если строки нет — добавить (append).

### 1.4. Google Calendar — событие-«галочка»

Форма события:
```json
{
  "summary":     "<task_title>",
  "description": "<task_uuid>",
  "colorId":     "7",
  "start": { "dateTime": "<ISO>", "timeZone": "Europe/Samara" },
  "end":   { "dateTime": "<ISO>", "timeZone": "Europe/Samara" }
}
```

Правило поиска существующего: **на сегодня**, `description.includes(task_uuid)`. Если найдено — `events.update` (сохраняя `id` и `summary` найденного); если нет — `events.insert`.

Время `end` = текущий момент (когда нажали ⏸). Время `start` = `end - timeSpent * 60_000` мс, где `timeSpent` в минутах (из §2).

---

## 2. Вычисление `elapsed_minutes`

```python
now_ms = int(time.time() * 1000)
start_date_ms = int(row_G or 0)
if start_date_ms == 0:
    elapsed_minutes = int(row_B or 0)          # пауза «без старта» (не наш случай)
else:
    duration_ms = now_ms - start_date_ms
    elapsed_minutes = math.ceil(duration_ms / 60000)   # всегда вверх
```

JS использует `Math.ceil` — воспроизводим. Дробные минуты округляются **в большую** сторону. `elapsed_minutes` может быть 0, если ⏸ нажали через < 1 мс после ▶️ (граничный случай).

**Новый `task_time`:**
```python
old_task_time = int(row_B or 0)
new_task_time = math.ceil((old_task_time + elapsed_minutes) / 2)
```

---

## 3. Новая «длительность цикла» `repeat_real` и перенос `task_date`

JS-код (см. `makeTaskDone` в `tasks.js`):

```python
# task_date для расчёта «насколько просрочили» — берём last_execution, если он есть,
# иначе текущий task_date:
task_date_for_calc = int(row_T or 0) or int(row_H or 0)
now_ms = int(time.time() * 1000)
old_repeat_index = float(row_I or 1)

days_since_scheduled = (now_ms - task_date_for_calc) / 86_400_000
repeat_real = (old_repeat_index + days_since_scheduled) * 0.9 / 2
```

Если **события-галочки не было** до этой паузы (см. §7), то дополнительно:
```python
repeat_real   -= 0.1     # в JS: task.repeat_index = toNumber(...) - 0.1
```

### 3.1. `new_task_date` по `repeat_mode`

`repeat_mode = row_K` (строка). Варианты (JS-код):

| mode | Что происходит | Python |
|---|---|---|
| `'0'` | следующий день, 00:00:00.001 локального времени | `tomorrow_00 = datetime.combine(now.date() + timedelta(days=1), time(0,0,1)) * local_tz` |
| `'1'` | тот же день через месяц | `same_dt.replace(month=month+1, day=day)` — вручную переносить через конец месяца |
| `'2'` | тот же день через год | аналогично, с високосными |
| `'3'` | ближайший «рабочий» день из `repeat_days_of_week` | см. §3.2 |
| `'5'` / `'6'` | `now_ms + round(repeat_index_новый * 86400000)` | — |
| иное | ошибка, **ничего не писать** | — |

Все `*_date` поля — unix-мс **локального полдня**, приведённого к UTC-эпохе. JS делает `new Date(y, m, d, 0, 0, 1, 0).getTime()` — это **локальный** полночь+1мс. Python-клиент обязан делать то же самое в **том же часовом поясе, что и пользователь JS** (`Europe/Samara`, см. §1.4). Иначе задачи уедут на сутки.

```python
from datetime import datetime, timedelta, time
from zoneinfo import ZoneInfo

LOCAL_TZ = ZoneInfo('Europe/Samara')

def ms_local_midnight_plus_1(dt_local_date) -> int:
    """Как new Date(y,m,d,0,0,1,0).getTime() в JS для локальной даты."""
    dt = datetime.combine(dt_local_date, time(0, 0, 1), tzinfo=LOCAL_TZ)
    return int(dt.timestamp() * 1000)
```

### 3.2. `repeat_days_of_week` (mode='3')

Строка `'1010100'`. Индекс 0 = **воскресенье** (как `getDay()` в JS), индекс 6 = суббота. Ищем ближайший будущий день с `'1'`:

```python
def next_working_day_offset(mask: str, current_weekday_py: int) -> int | None:
    """current_weekday_py: Python's date.weekday() (0=Пн..6=Вс) — конвертируем."""
    js_day = (current_weekday_py + 6) % 7                # Python Пн=0 → JS Пн=1
    for offset in range(1, 8):
        day = (js_day + offset) % 7
        if mask[day] == '1':
            return offset
    return None
```

Если `None` — не менять `task_date`, в JS это брошенное исключение; в Python — raise.

---

## 4. Формула награды

```python
avg = averageCalc(store) or 1.0     # см. §5
date_mode = float(row_L or 'nan')
money_reward = elapsed_minutes * avg / 2
if math.isfinite(date_mode):
    money_reward *= date_mode
if not math.isfinite(money_reward):
    money_reward = 0.0
```

`money_reward` пишется:
- в колонку M `real_life_tasks`;
- в `real_life_hero!hero_money` (через `+=`);
- в колонку D `task_executions.gained_gold`.

**Исключение** (важно!): если `repeat_mode === '5'` — награда **не начисляется** и в `task_executions` **не пишется**. Это режим «фоновая задача без награды». В нашем сценарии паузы: если `repeat_mode == '5'` — пропускаем шаги §1.2 (append в `task_executions`) и §1.3 (обновление `hero_money`), но **сам `money_reward` в колонку M всё равно пишем** (значение, которое было до паузы, или только что посчитанное — как в JS; на UI это не сказывается).

---

## 5. `averageCalc` — дисциплина пользователя

Берётся из истории в `task_executions`. JS-клиент пересчитывает его каждые 60 секунд и держит в памяти (не хранит в Sheet). Python-клиент обязан посчитать сам.

Формула (`getAverageCalc` в `tasks.js`):

```python
def calc_average_discipline(executions: list[dict], now_local: datetime) -> float:
    """executions: строки task_executions, разобранные как dict
       с ключами 'execution_date'(unix-мс int) и 'execution_time'(int/float)."""
    total_days = 30
    one_day_ms = 86_400_000
    days_work: dict[str, int] = {}

    for item in executions:
        if not item.get('execution_date') or not item.get('execution_time'):
            continue
        try:
            et = int(item['execution_time'])
        except (TypeError, ValueError):
            continue
        day = datetime.fromtimestamp(int(item['execution_date']) / 1000, LOCAL_TZ)
        key = day.strftime('%Y-%m-%d')                    # ISO-дата как в JS (toISOString)
        days_work[key] = days_work.get(key, 0) + et

    day_keys: list[str] = []
    for i in range(total_days - 1, -1, -1):
        d = now_local - timedelta(days=i)
        key = d.strftime('%Y-%m-%d')
        days_work.setdefault(key, 0)
        day_keys.append(key)

    start = 1.0
    cum_sum = 0
    cum_cnt = 0
    for i, k in enumerate(day_keys):
        cur = days_work[k]
        if i > 0:
            prev_avg = cum_sum / cum_cnt if cum_cnt else 0
            lim = 0.6180339887
            if cur <= prev_avg * lim:
                start -= 0.01
            elif cur > prev_avg:
                start += 0.01
        cum_sum += cur
        cum_cnt += 1
    return start
```

Значение по умолчанию при пустой истории — `1.0`. Если нет возможности/желания читать весь `task_executions` — использовать `avg = 1.0`; награда будет `elapsed_minutes / 2`.

---

## 6. Форматирование дат и чисел

- **Все unix-мс** (B, D, G, H, T в `real_life_tasks`; B в `task_executions`) — пишем как `str(int(value))`, без `.0`, без пробелов, без `e+12`.
- **Дробные** (`repeat_index`, `break_multiplier`, `money_reward`, `task_sort`, `date_mode`) —plain `str(float)`. JS-парсер (`toNumber`) принимает и `12,5` (с запятой), и `12.5`; лучше писать точку.
- **`task_date` в `task_executions`** — не unix-мс, а строка локали `ru-RU`: `'ДД.ММ.ГГГГ'` (например `'25.09.2026'`).
  ```python
  task_date_str = now_local.strftime('%d.%m.%Y')
  ```
- **`gained_gold`** — `str(float(money_reward))`. Если `money_reward` `NaN`/`inf` → `'0'`.

---

## 7. Проверка: было ли уже событие-галочка сегодня

Определяет, делать ли «штрафные» правки (§3) и делать ли `updateEvent` или `addEvent`.

**API-вызов (Calendar v3):**
```
GET /calendar/v3/calendars/primary/events
    ?timeMin=<today 00:00 local ISO>
    &timeMax=<today 23:59:59 local ISO>
    &showDeleted=false
    &singleEvents=true
    &orderBy=startTime
```

Фильтр на клиенте: `event.description is not None and task_uuid in event.description`. JS делает `includes` (подстрока), т.к. `description` может содержать несколько uuid (перенос строки между ними) — воспроизводим.

- Если нашлось ≥ 1 — `updateEvent` первого (сохраняем `id`, оставляем исходный `summary` из события).
- Если 0 — `addEvent` (см. §1.4).

**Важно:** поиск идёт **только по событиям сегодня**. Если на прошлой неделе было событие-галочка с этим `description`, оно не считается.

---

## 8. Порядок запросов (важен!)

JS делает всё подряд, и нам нужно сохранить порядок, иначе UI на секунду покажет несогласованное состояние:

1. **Calendar** `events.list` (найти существующее сегодня).
2. **Calendar** `events.insert` ИЛИ `events.update` с `colorId=7`.
3. **Sheets** `real_life_tasks` — **full-row update** на найденной строке: колонки B, E, G, H, I, M, N, O, P, T (см. §1.1). Остальные колонки — теми же значениями, что были.
4. **Sheets** `task_executions` — `appendRow` (см. §1.2). Пропустить, если `repeat_mode == '5'`.
5. **Sheets** `real_life_hero` — `updateRowByCode('hero_money', {value: new_total})`. Пропустить, если `repeat_mode == '5'`. Перед сложением нужно актуально прочитать `hero_money` (не из старого кэша).
6. **Sheets** `real_life_tasks` — **повторно** обновить ячейки G и O (см. §9 «финальный штрих паузы»). В JS это отдельный `updateRowByCode` через 600 мс; в Python можно сразу вписать корректные `start_date` и `task_finish_date` в шаг 3.

### 8.1. Почему два обновления одной строки

JS не знает заранее, каким получится полный снапшот после `makeTaskDone`, поэтому сначала делает «полное» обновление через `updateRowByCode`, а потом ещё раз — «заглушка паузы». Python может это объединить в один запрос, посчитав **финальные** значения сразу:

```python
final_values = {
    'B': new_task_time,
    'E': new_task_sort,
    'G': 0,                       # start_date
    'H': new_task_date,
    'I': new_repeat_index,
    'M': money_reward,
    'N': new_break_multiplier,
    'O': elapsed_ms,              # ПРАВИЛЬНО; JS пишет 1 (баг, см. §9)
    'P': number_of_executions + 1,
    'T': now_ms,
}
# остальные колонки — текущие значения из строки
```

Один `values.update` на диапазон `A<row>:T<row>` с массивом из 20 значений.

---

## 9. «Финальный штрих» и как делать правильно

В JS сразу после `makeTaskDone` идёт `setTimeout(600, ...)` который пишет `task_finish_date = 1, start_date = 0`. Смысл — обнулить признак «выполнено», чтобы UI снова показал задачу как «остановленную, но с обнулённым таймером».

Проблема: `task_finish_date = 1` мс фактически означает «на паузе на 0.0000167 минут». При следующем ▶️ формула resume даст `start_date = now_ms - 1` — т.е. таймер начнётся с нуля.

**Правильно (рекомендуется в Python-порте):**
- `task_finish_date = elapsed_ms` (то же, что было `start_date`, но «замороженное» в длительности).
- `start_date = 0`.
- Тогда `▶️ → (Date.now() - task_finish_date)` даст корректный back-date, и UI покажет, сколько уже длилась задача до паузы.

Если вы хотите **полностью совместимое** поведение (UI JS-клиента привык к `1`) — пишите `1`. Тогда пауза/резюме фактически обнуляет таймер.

---

## 10. Полный рабочий пример (gspread + google-api-python-client)

```python
"""pause_task.py — эквивалент клика ⏸ из Python."""
import os
import math
import time
import uuid as uuidlib
from datetime import datetime, timedelta, time as dtime
from zoneinfo import ZoneInfo

import gspread
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

SPREADSHEET_ID = os.environ['SPREADSHEET_ID']
SHEET_TASKS        = 'real_life_tasks'
SHEET_EXECUTIONS   = 'task_executions'
SHEET_HERO         = 'real_life_hero'
LOCAL_TZ           = ZoneInfo('Europe/Samara')
DONE_COLOR         = '7'

# Колонки real_life_tasks (0-based индексы)
COLS = {
    'task_title': 0, 'task_time': 1, 'task_description': 2, 'task_uuid': 3,
    'task_sort': 4, 'task_color': 5, 'start_date': 6, 'task_date': 7,
    'repeat_index': 8, 'repeat_days_of_week': 9, 'repeat_mode': 10,
    'date_mode': 11, 'money_reward': 12, 'break_multiplier': 13,
    'task_finish_date': 14, 'number_of_executions': 15, 'excludes': 16,
    'task_before': 17, 'task_after': 18, 'last_execution': 19,
}


def _to_int(v, default=0):
    if v is None or v == '':
        return default
    try:
        return int(float(str(v).replace('\u00a0', '').strip()))
    except (TypeError, ValueError):
        return default


def _to_float(v, default=0.0):
    try:
        return float(str(v).replace(',', '.').replace('\u00a0', '').strip())
    except (TypeError, ValueError):
        return default


def _now_ms():
    return int(time.time() * 1000)


def open_sheet(sheet_name):
    gc = gspread.service_account(
        filename=os.environ.get('GOOGLE_APPLICATION_CREDENTIALS', 'service_account.json'))
    return gc.open_by_key(SPREADSHEET_ID).worksheet(sheet_name)


def open_calendar():
    creds = Credentials.from_service_account_file(
        os.environ.get('GOOGLE_APPLICATION_CREDENTIALS', 'service_account.json'),
        scopes=['https://www.googleapis.com/auth/calendar'])
    return build('calendar', 'v3', credentials=creds)


def find_task_row(sh_tasks, task_uuid: str) -> tuple[int, list[str]]:
    """Возвращает (1-based row_index, [20 значений строки])."""
    data = sh_tasks.get_values()
    header = data[0]
    uuid_idx = COLS['task_uuid']
    for offset, row in enumerate(data[1:], start=2):
        row = (row + [''] * 20)[:20]
        if row[uuid_idx] == task_uuid:
            return offset, row
    raise LookupError(f'task_uuid={task_uuid} не найден')


def today_events(calendar, tz=LOCAL_TZ):
    now = datetime.now(tz)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end   = now.replace(hour=23, minute=59, second=59, microsecond=0)
    body = calendar.events().list(
        calendarId='primary',
        timeMin=start.isoformat(),
        timeMax=end.isoformat(),
        showDeleted=False,
        singleEvents=True,
        orderBy='startTime',
    ).execute()
    return body.get('items', [])


def upsert_done_event(calendar, task_uuid, task_title, elapsed_minutes):
    """Возвращает True, если событие было НОВЫМ (не существовало)."""
    ev_list = today_events(calendar)
    existed = next((e for e in ev_list
                    if task_uuid in (e.get('description') or '')), None)
    end_dt = datetime.now(LOCAL_TZ)
    start_dt = end_dt - timedelta(minutes=elapsed_minutes)

    resource = {
        'summary':     task_title,
        'description': task_uuid,
        'colorId':     DONE_COLOR,
        'start': {'dateTime': start_dt.isoformat(), 'timeZone': str(LOCAL_TZ)},
        'end':   {'dateTime': end_dt.isoformat(),   'timeZone': str(LOCAL_TZ)},
    }
    if existed:
        resource['summary'] = existed['summary']
        calendar.events().update(
            calendarId='primary', eventId=existed['id'],
            body=resource).execute()
        return False
    calendar.events().insert(calendarId='primary', body=resource).execute()
    return True


def calc_average_discipline(sh_exec, now_local):
    rows = sh_exec.get_values()
    if not rows:
        return 1.0
    header = rows[0]
    idx_date = header.index('execution_date')
    idx_time = header.index('execution_time')
    days = {}
    for r in rows[1:]:
        if len(r) <= max(idx_date, idx_time):
            continue
        try:
            et = int(float(r[idx_time]))
            ed = int(float(r[idx_date]))
        except (TypeError, ValueError):
            continue
        if not et:
            continue
        key = datetime.fromtimestamp(ed / 1000, LOCAL_TZ).strftime('%Y-%m-%d')
        days[key] = days.get(key, 0) + et

    keys = []
    for i in range(29, -1, -1):
        d = (now_local - timedelta(days=i)).strftime('%Y-%m-%d')
        days.setdefault(d, 0)
        keys.append(d)

    start = 1.0
    s = 0
    c = 0
    for i, k in enumerate(keys):
        cur = days[k]
        if i > 0:
            prev = s / c if c else 0
            if cur <= prev * 0.6180339887:
                start -= 0.01
            elif cur > prev:
                start += 0.01
        s += cur
        c += 1
    return start


def next_task_date_by_mode(repeat_mode, repeat_index_new, row_repeat_days, now_local):
    if repeat_mode == '0':
        d = (now_local + timedelta(days=1)).date()
    elif repeat_mode == '1':
        y, m = now_local.year + (now_local.month // 12), now_local.month % 12 + 1
        d = datetime(y, m, now_local.day).date()
    elif repeat_mode == '2':
        d = datetime(now_local.year + 1, now_local.month, now_local.day).date()
    elif repeat_mode in ('5', '6'):
        return _now_ms() + int(round(repeat_index_new * 86_400_000))
    elif repeat_mode == '3':
        mask = row_repeat_days or '0000000'
        py_wd = now_local.weekday()
        js_day = (py_wd + 6) % 7
        offset = None
        for o in range(1, 8):
            if mask[(js_day + o) % 7] == '1':
                offset = o
                break
        if offset is None:
            raise RuntimeError('нет рабочих дней в repeat_days_of_week')
        d = (now_local + timedelta(days=offset)).date()
    else:
        raise RuntimeError(f'неизвестный repeat_mode: {repeat_mode}')
    dt = datetime.combine(d, dtime(0, 0, 1), tzinfo=LOCAL_TZ)
    return int(dt.timestamp() * 1000)


def pause_task(task_uuid: str) -> dict:
    now_ms = _now_ms()
    now_local = datetime.now(LOCAL_TZ)

    sh_tasks = open_sheet(SHEET_TASKS)
    sh_exec  = open_sheet(SHEET_EXECUTIONS)
    sh_hero  = open_sheet(SHEET_HERO)
    calendar = open_calendar()

    row_idx, row = find_task_row(sh_tasks, task_uuid)
    start_date   = _to_int(row[COLS['start_date']])
    if start_date == 0:
        raise RuntimeError('задача не запущена — пауза не имеет смысла')

    elapsed_ms      = now_ms - start_date
    elapsed_minutes = max(0, math.ceil(elapsed_ms / 60000))
    old_task_time   = _to_int(row[COLS['task_time']])
    new_task_time   = math.ceil((old_task_time + elapsed_minutes) / 2)

    new_event = upsert_done_event(calendar, task_uuid, row[COLS['task_title']], elapsed_minutes)

    task_date_for_calc = _to_int(row[COLS['last_execution']]) or _to_int(row[COLS['task_date']])
    days_since = (now_ms - task_date_for_calc) / 86_400_000
    old_repeat = _to_float(row[COLS['repeat_index']], default=1.0) or 1.0
    repeat_real = (old_repeat + days_since) * 0.9 / 2
    if new_event:
        repeat_real -= 0.1

    old_sort   = _to_float(row[COLS['task_sort']])
    old_break  = _to_float(row[COLS['break_multiplier']])
    new_sort   = old_sort - 0.02 if new_event else old_sort
    new_break  = old_break + 1   if new_event else old_break

    repeat_mode = row[COLS['repeat_mode']]
    task_date_new = next_task_date_by_mode(
        repeat_mode, repeat_real, row[COLS['repeat_days_of_week']], now_local)

    # Награда
    avg = calc_average_discipline(sh_exec, now_local) or 1.0
    date_mode_raw = _to_float(row[COLS['date_mode']], default=float('nan'))
    money = elapsed_minutes * avg / 2
    if math.isfinite(date_mode_raw):
        money *= date_mode_raw
    if not math.isfinite(money):
        money = 0.0

    # Финальная строка real_life_tasks
    new_row = list(row)
    new_row[COLS['task_time']]          = str(new_task_time)
    new_row[COLS['task_sort']]          = str(new_sort)
    new_row[COLS['start_date']]         = '0'
    new_row[COLS['task_date']]          = str(task_date_new)
    new_row[COLS['repeat_index']]       = str(repeat_real)
    new_row[COLS['money_reward']]       = str(money)
    new_row[COLS['break_multiplier']]   = str(new_break)
    new_row[COLS['task_finish_date']]   = str(elapsed_ms)        # ПРАВИЛЬНО (JS пишет 1)
    new_row[COLS['number_of_executions']] = str(_to_int(row[COLS['number_of_executions']]) + 1)
    new_row[COLS['last_execution']]     = str(now_ms)
    sh_hero_range = None

    sh_tasks.update(range_name=f'A{row_idx}:T{row_idx}', values=[new_row])

    # Журнал и герой — только если repeat_mode != '5'
    if repeat_mode != '5':
        exec_row = [
            str(uuidlib.uuid4()),        # execution_id
            str(now_ms),                 # execution_date
            str(elapsed_minutes),        # execution_time
            str(money),                  # gained_gold
            row[COLS['task_title']],     # task_title
            task_uuid,                   # task_id
            now_local.strftime('%d.%m.%Y'),  # task_date (ru-RU)
        ]
        sh_exec.append_row(exec_row, value_input_option='RAW')

        # hero_money: find + update (или append)
        hero_data = sh_hero.get_values()
        idx = None
        for i, r in enumerate(hero_data[1:], start=2):
            if r and r[0] == 'hero_money':
                idx = i
                break
        old_hero_money = _to_float(hero_data[idx - 1][1]) if idx else 0.0
        new_hero_money = old_hero_money + money
        if idx:
            sh_hero.update(range_name=f'B{idx}', values=[[str(new_hero_money)]])
        else:
            sh_hero.append_row(['hero_money', str(new_hero_money)], value_input_option='RAW')

    return {
        'task_uuid': task_uuid,
        'row': row_idx,
        'elapsed_minutes': elapsed_minutes,
        'money_reward': money,
        'new_task_date_ms': task_date_new,
        'event_was_new': new_event,
    }


if __name__ == '__main__':
    import sys, json
    print(json.dumps(pause_task(sys.argv[1]), ensure_ascii=False, indent=2))
```

Запуск:

```
python pause_task.py 6a1c2d3e-...-...-...
```

---

## 11. Чеклист принятия

После ⏸ в Sheet и Calendar:

- [ ] В `real_life_tasks` в найденной строке изменились **только** колонки B, E (опц.), G, H, I, M, N (опц.), O, P, T. Остальные 10 — байт-в-байт прежние.
- [ ] `start_date (G) == 0` — задача больше не «в работе».
- [ ] `task_finish_date (O) == elapsed_ms` (или `1`, если сознательно совместимы с JS).
- [ ] `task_date (H)` — в будущем, согласно `repeat_mode`.
- [ ] `number_of_executions (P)` увеличился на 1.
- [ ] `last_execution (T) ≈ now_ms` (±1 с).
- [ ] В `task_executions` добавлена **ровно одна** новая строка (кроме `repeat_mode='5'`).
- [ ] `real_life_hero!hero_money` вырос на `money_reward` (тот же, что в колонке M и `gained_gold` новой строки `task_executions`).
- [ ] В Calendar на сегодня есть событие с `description` = `task_uuid`, `colorId=7`, `end ≈ now`, `start ≈ now - elapsed_minutes * 60000`.
- [ ] JS-клиент при ближайшем авто-обновлении (или F5) показывает задачу как «выполненную сегодня» (нет ни ▶️, ни ⏸/⏹ в календарном фильтре) или как «остановленную» (в зависимости от `task_finish_date`).

---

## 12. Гонки с JS-клиентом

См. [`start.md` §8](file:///C:/Users/b5/Desktop/Программирование/biyk.github.io/todo/restart/start.md#8-гонки-с-js-клиентом-обязательно-прочитать). Специфика паузы:

- JS в `toggleTodo` **перезаписывает hero_money** из своего кэша (который обновляется только раз в минуту агентом). Python обновил `hero_money`, а потом пользователь в JS-вкладке нажал ✅ на другой задаче — JS прибавит награду **к старому** `hero_money` и затирает начисление Python.
  Защита: после своего `pause` в Python **заставить** JS перечитать героя. Простейший способ — попросить пользователя F5. Правильный — в JS агенте сократить интервал; но он фиксирован (60 с).
- Пауза содержит **5 мутаций в трёх системах** (Sheets × 3, Calendar × 1). Провал на середине оставляет несогласованное состояние. В Python: оборачивать в `try/except`, при ошибке календаря — **не** писать ни в `task_executions`, ни в `real_life_tasks`. Т.е. сначала Calendar, потом всё остальное (см. §8 порядок).
- Повторный вызов ⏸ на остановленной задаче (`start_date == 0`) — вернуть ошибку, не начинать «выполнение без старта» (JS в этом случае засчитывает выполнение без `elapsed_minutes` — см. §2; это легитимный сценарий «✅», но не ⏸).

---

## 13. Известные баги JS, которые **не надо** переносить

1. `task_finish_date = 1` вместо `elapsed_ms` (см. §9).
2. Двойной клик по ⏸: JS использует `busyUuids`-Set в рантайме, но он не переживает перезагрузку и не синхронизирован между вкладками. В Python — проверяйте `start_date != 0` **непосредственно перед записью** (в том же `get_values`).
3. `updateRowByCode` в JS делает «прочитал из кэша → записал весь снапшот». В Python всегда перечитывайте строку перед записью.
4. `money_reward` = `NaN`, если `calc.averageCalc` не посчитан. В Python: дефолт `1.0`.

---

## 14. Одной таблицей: что куда писать

| Шаг | Куда | Операция | Данные |
|---|---|---|---|
| 1 | Calendar | `events.list` today | фильтр `task_uuid in description` |
| 2a | Calendar | `events.insert` (если не найдено) | `{summary, description, colorId:7, start, end}` |
| 2b | Calendar | `events.update` (если найдено) | то же + `id` найденного |
| 3 | `real_life_tasks` | `values.update` `A<row>:T<row>` | весь ряд, 10 изменённых колонок (см. §1.1) |
| 4 | `task_executions` | `values.append` `A1:G1` | 7 значений (см. §1.2). Пропустить, если `repeat_mode='5'` |
| 5 | `real_life_hero` | `values.update` `B<row>` | `hero_money += money_reward`. Пропустить, если `repeat_mode='5'` |

Всё. Если делаете строго так и только так — UI не поедет.
