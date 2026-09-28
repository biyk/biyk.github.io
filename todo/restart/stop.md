# stop.md — «Стоп / завершить» (⏹) из Python поверх **нашей** Google Таблицы

Агент работает с той же таблицей, что и браузер: `spreadsheetId` `1-EZE8HvpQbuyKjAmkyPe6042XeN7kR62ffckDSZasMg`, Google Calendar пользователя. Сценарий: пользователь нажал ⏹ на **запущенной** задаче (⏹ виден только когда `start_date != 0`).

---

## 0. Что делает ⏹ (дословно)

⏹ = канонический способ засчитать выполнение (без попытки «заморозить» таймер). После ⏹:

1. Фиксируется `elapsed_minutes` = сколько задача была в работе (округление вверх).
2. Плановая длительность `task_time` становится средним между старым планом и фактом.
3. На сегодня в Google Calendar создаётся (или обновляется) событие-«галочка» с `colorId=7` — по нему JS-клиент определяет, что задача уже закрыта.
4. Если такой галочки до ⏹ не было — применяются «штрафные» правки (`break_multiplier +1`, `repeat_index -0.1`, `task_sort -0.02`), т.к. пользователь не уложился в план.
5. Задача **перепланируется** на следующее срабатывание по `repeat_mode` (завтра / через месяц / по дням недели / и т.п.).
6. `number_of_executions += 1`, `last_execution = now_ms`, `money_reward` пересчитан.
7. Начисляется награда: `real_life_hero!hero_money += money_reward` (если `repeat_mode != '5'`).
8. В `task_executions` добавляется ровно **одна** строка (если `repeat_mode != '5'`).
9. `start_date = 0` — таймер остановлен.
10. `task_finish_date = 0` — задача **не** ждёт resume. В отличие от ⏸, здесь никакого «замороженного elapsed» нет: следующая итерация задачи — чистый лист.

---

## 1. ⏹ vs ✅ vs ⏸ — три кнопки одной веткой

Все три вызывают один и тот же JS-метод `toggleTodo` (`TodoList.vue:214-309`) либо его обёртку `pauseTask`. Различаются только **состоянием, из которого нажимаются**, и **финальным значением колонки O** (`task_finish_date`):

| Кнопка | Виден при | `start_date` до | `task_finish_date` после | Смысл |
|---|---|---|---|---|
| ✅ | `start_date == 0` | 0 | **0** | «Сделал без таймера» — elapsed не считаем, `timeSpent = task_time` (старый план) |
| ⏹ | `start_date != 0` | > 0 | **0** | «Остановил и засчитал» — elapsed считаем, `task_time` усредняем |
| ⏸ | `start_date != 0` | > 0 | **1** (JS-баг; правильно было бы `elapsed_ms`) | То же, что ⏹, **плюс** попытка «заморозить» таймер для resume |

С точки зрения Python-клиента:

- **✅ и ⏹ различаются только значением `start_date` на входе.** Оба пишут `task_finish_date = 0`. Ветка ✅ не трогает колонку B (`task_time`) и не вычисляет `elapsed_minutes`.
- **⏸ = ⏹ + одна дополнительная запись `task_finish_date = 1`** (которая по сути баг; см. `pause.md` §9).

Если вы делаете только ⏹ и ✅ — вам не нужно возиться с «заморозкой» таймера. Если делаете ⏸ — см. [`pause.md`](file:///C:/Users/b5/Desktop/Программирование/biyk.github.io/todo/restart/pause.md).

Настоящий документ покрывает **⏹**. Ветка ✅ отличается двумя строками; они помечены в §7.

---

## 2. Схема затронутых мест

### 2.1. `real_life_tasks` — full-row update `A<row>:T<row>`

Колонки, которые **изменяются** при ⏹ (из запущенной задачи):

| Кол. | Поле | Становится |
|---|---|---|
| B | `task_time` | `ceil((old + elapsed_minutes) / 2)` |
| E | `task_sort` | `old − 0.02` (только если галочка новая) |
| G | `start_date` | `0` |
| H | `task_date` | по `repeat_mode` (см. §5) |
| I | `repeat_index` | `repeat_real` (см. §4.2), минус 0.1 если галочка новая |
| M | `money_reward` | новая начисленная сумма (см. §6) |
| N | `break_multiplier` | `old + 1` (только если галочка новая) |
| O | `task_finish_date` | **`0`** (ключевое отличие от ⏸) |
| P | `number_of_executions` | `old + 1` |
| T | `last_execution` | `now_ms` |

Остальные 10 (A, C, D, F, J, K, L, Q, R, S) — **не трогать** (переписать теми же значениями, что были).

Полная расшифровка колонок — в [`start.md` §2](file:///C:/Users/b5/Desktop/Программирование/biyk.github.io/todo/restart/start.md#2-схема-листа-real_life_tasks--обязательное-соответствие).

### 2.2. `task_executions` — append одной строки A..G

```
A execution_id      UUID v4 (новый)
B execution_date    unix-мс, str(now_ms)
C execution_time    elapsed_minutes (int) для ⏹ / old task_time для ✅
D gained_gold       money_reward (float)
E task_title        из колонки A задачи
F task_id           = task_uuid задачи (колонка D)
G task_date         строка 'DD.MM.YYYY' (локаль ru-RU)
```

**Не** добавляем, если `repeat_mode == '5'` (см. §6).

### 2.3. `real_life_hero` — update строки `code = 'hero_money'`

`value = float(old_value) + money_reward`. Строку искать по колонке A; если её нет — append.

**Не** обновляем, если `repeat_mode == '5'`.

### 2.4. Google Calendar — событие-галочка на сегодня

Та же структура, что в `pause.md §1.4`. `timeZone: 'Europe/Samara'`. `colorId: '7'`. `description = task_uuid`. `start = now − timeSpent*60_000`, `end = now`.

`timeSpent` в минутах для ⏹ = `elapsed_minutes`; для ✅ (без старта) = старый `task_time` (т.е. «если бы пользователь отработал ровно по плану»).

---

## 3. Найти задачу и проверить состояние

```python
row_idx, row = find_task_row(sh_tasks, task_uuid)   # см. start.md §4
start_date_ms = int(row[COLS['start_date']] or 0)

# ⏹ имеет смысл только из «работающего» состояния:
if start_date_ms == 0:
    raise RuntimeError('задача не запущена — это должен быть клик ✅, а не ⏹')
```

Если вы реализуете заодно и ✅ — уберите эту проверку; единственное отличие ветки — `elapsed_minutes = None` и `timeSpent = old_task_time`.

---

## 4. Формулы

### 4.1. `elapsed_minutes` и новый `task_time`

```python
now_ms = int(time.time() * 1000)
duration_ms = now_ms - start_date_ms
elapsed_minutes = math.ceil(duration_ms / 60_000)          # всегда вверх

old_task_time = int(row[COLS['task_time']] or 0)
new_task_time = math.ceil((old_task_time + elapsed_minutes) / 2)
```

### 4.2. `repeat_real` (новый `repeat_index`)

```python
task_date_for_calc = int(row[COLS['last_execution']] or 0) or int(row[COLS['task_date']] or 0)
days_since_scheduled = (now_ms - task_date_for_calc) / 86_400_000
old_repeat_index = float(row[COLS['repeat_index']] or 1) or 1.0

repeat_real = (old_repeat_index + days_since_scheduled) * 0.9 / 2
# ↓ если галочка новая (см. §7):
if event_was_new:
    repeat_real -= 0.1
```

---

## 5. Новый `task_date` по `repeat_mode`

Полная реализация — в [`pause.md` §3.1–3.2](file:///C:/Users/b5/Desktop/Программирование/biyk.github.io/todo/restart/pause.md#31-new_task_date-by-repeat_mode). Здесь — только таблица:

| `repeat_mode` (колонка K) | Новый `task_date` (колонка H) |
|---|---|
| `'0'` | послезавтрашняя полночь + 1 мс (локально `Europe/Samara`) |
| `'1'` | та же дата через месяц |
| `'2'` | та же дата через год |
| `'3'` | ближайший день с `'1'` в `repeat_days_of_week` (индекс 0 = вс) |
| `'5'` / `'6'` | `now_ms + round(repeat_real * 86_400_000)` |
| иное | **ничего не пишем**, ошибка |

**Важно:** `repeat_index`, который участвует в `'5'/'6'`, — **уже обновлённый** `repeat_real`, а не старый.

---

## 6. Награда

```python
avg = calc_average_discipline(...) or 1.0        # см. pause.md §5
date_mode = float(row[COLS['date_mode']] or 'nan')
money = elapsed_minutes * avg / 2                # для ✅ (без старта) → old_task_time * avg / 2
if math.isfinite(date_mode):
    money *= date_mode
if not math.isfinite(money):
    money = 0.0
```

При `repeat_mode == '5'`:
- колонку M (`money_reward`) **всё равно пишем** (в JS так);
- `real_life_hero!hero_money` **не** начисляем;
- `task_executions` **не** пополняем.

---

## 7. Ключевое: был ли ивент-галочка на сегодня

Определяет «штрафные» модификаторы (§4.2) и способ работы с Calendar.

```python
ev_list = today_events(calendar)                 # timeMin/timeMax = сегодня локально
existed = next((e for e in ev_list
                if task_uuid in (e.get('description') or '')),
               None)
event_was_new = existed is None

if event_was_new:
    calendar.events().insert(calendarId='primary', body=resource).execute()
else:
    resource['id'] = existed['id']
    resource['summary'] = existed['summary']     # сохраняем исходный summary
    calendar.events().update(calendarId='primary',
                             eventId=existed['id'], body=resource).execute()
```

Если `event_was_new == True` — дополнительно:
```python
new_break_multiplier = float(row[COLS['break_multiplier']] or 0) + 1
new_task_sort        = float(row[COLS['task_sort']] or 0) - 0.02
# repeat_index -= 0.1 уже в §4.2
```
Иначе эти колонки остаются прежними.

---

## 8. Порядок операций и один full-row update

В JS пауза/стоп делают **два** обновления `real_life_tasks` (сначала `makeTaskDone`, потом — в случае паузы — «дописывающий» `updateRowByCode`). Для ⏹ второго обновления нет, т.к. `makeTaskDone` сам ставит `task_finish_date = 0`. Python укладывается в **один** `values.update` на `A<row>:T<row>`:

```
1. Calendar.events.list           (найти существующее сегодня)
2. Calendar.events.insert/update  (галочка colorId=7)
3. Sheets values.update           (real_life_tasks A<row>:T<row>, финальный снапшот)
4. Sheets values.append           (task_executions A1:G1)     — только если repeat_mode != '5'
5. Sheets values.update           (real_life_hero B<row>)     — только если repeat_mode != '5'
```

Гарантировать порядок обязательно: если шаг 2 упал, шаги 3–5 делать нельзя (в JS тоже есть этот контракт — при ошибке `addEvent`/`updateEvent` `toggleTodo` бросает в `catch`, и `makeTaskDone` уже не вызывается).

Сборка финального снапшота:

```python
def build_final_row(row, task_uuid, now_ms, elapsed_minutes, new_task_time,
                    repeat_mode, repeat_real, new_task_date_ms, money,
                    event_was_new):
    out = list(row)                                    # копируем 20 ячеек как строки
    out[COLS['task_time']]            = str(new_task_time)
    out[COLS['start_date']]           = '0'
    out[COLS['task_date']]            = str(new_task_date_ms)
    out[COLS['repeat_index']]         = str(repeat_real)
    out[COLS['money_reward']]         = str(money)
    out[COLS['task_finish_date']]     = '0'            # ← КЛЮЧЕВОЕ ОТЛИЧИЕ ОТ ⏸
    out[COLS['number_of_executions']] = str(
        int(row[COLS['number_of_executions']] or 0) + 1)
    out[COLS['last_execution']]       = str(now_ms)
    if event_was_new:
        out[COLS['break_multiplier']] = str(float(row[COLS['break_multiplier']] or 0) + 1)
        out[COLS['task_sort']]        = str(float(row[COLS['task_sort']] or 0) - 0.02)
    return out
```

---

## 9. Полный рабочий пример (gspread + google-api-python-client)

```python
"""stop_task.py — эквивалент клика ⏹ из Python."""
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
SHEET_TASKS      = 'real_life_tasks'
SHEET_EXECUTIONS = 'task_executions'
SHEET_HERO       = 'real_life_hero'
LOCAL_TZ         = ZoneInfo('Europe/Samara')
DONE_COLOR       = '7'

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


def upsert_done_event(cal, task_uuid, task_title, time_spent_minutes):
    existed = next((e for e in today_events(cal)
                    if task_uuid in (e.get('description') or '')), None)
    end_dt = datetime.now(LOCAL_TZ)
    start_dt = end_dt - timedelta(minutes=time_spent_minutes)
    body = {
        'summary': task_title,
        'description': task_uuid,
        'colorId': DONE_COLOR,
        'start': {'dateTime': start_dt.isoformat(), 'timeZone': str(LOCAL_TZ)},
        'end':   {'dateTime': end_dt.isoformat(),   'timeZone': str(LOCAL_TZ)},
    }
    if existed:
        body['summary'] = existed['summary']
        cal.events().update(calendarId='primary',
                            eventId=existed['id'], body=body).execute()
        return False
    cal.events().insert(calendarId='primary', body=body).execute()
    return True


def next_task_date(mode, repeat_index_new, mask, now_local):
    if mode == '0':
        d = (now_local + timedelta(days=1)).date()
    elif mode == '1':
        y, m = divmod(now_local.month, 12); m += 1
        d = datetime(y + (m > 12), (m - 1) % 12 + 1, now_local.day).date()
    elif mode == '2':
        d = datetime(now_local.year + 1, now_local.month, now_local.day).date()
    elif mode in ('5', '6'):
        return _now_ms() + int(round(repeat_index_new * 86_400_000))
    elif mode == '3':
        js_day = (now_local.weekday() + 6) % 7
        for o in range(1, 8):
            if (mask or '0' * 7)[(js_day + o) % 7] == '1':
                d = (now_local + timedelta(days=o)).date(); break
        else:
            raise RuntimeError('нет рабочих дней')
    else:
        raise RuntimeError(f'неизвестный repeat_mode: {mode}')
    dt = datetime.combine(d, dtime(0, 0, 1), tzinfo=LOCAL_TZ)
    return int(dt.timestamp() * 1000)


def calc_average_discipline(sh_exec, now_local):
    rows = sh_exec.get_values()
    if not rows: return 1.0
    h = rows[0]; di, ti = h.index('execution_date'), h.index('execution_time')
    days = {}
    for r in rows[1:]:
        if len(r) <= max(di, ti): continue
        try:
            et = int(float(r[ti])); ed = int(float(r[di]))
        except Exception: continue
        if not et: continue
        key = datetime.fromtimestamp(ed / 1000, LOCAL_TZ).strftime('%Y-%m-%d')
        days[key] = days.get(key, 0) + et
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


def stop_task(task_uuid: str) -> dict:
    now_ms = _now_ms()
    now_local = datetime.now(LOCAL_TZ)

    sh_tasks = open_sheet(SHEET_TASKS)
    sh_exec  = open_sheet(SHEET_EXECUTIONS)
    sh_hero  = open_sheet(SHEET_HERO)
    cal      = open_calendar()

    row_idx, row = find_task_row(sh_tasks, task_uuid)
    start_date = _int(row[COLS['start_date']])
    if start_date == 0:
        raise RuntimeError('задача не запущена — ожидается ⏹, а не ✅')

    elapsed_min = math.ceil((now_ms - start_date) / 60_000)
    old_time    = _int(row[COLS['task_time']])
    new_time    = math.ceil((old_time + elapsed_min) / 2)

    was_new = upsert_done_event(cal, task_uuid,
                                row[COLS['task_title']], elapsed_min)

    tdfc = _int(row[COLS['last_execution']]) or _int(row[COLS['task_date']])
    days_since = (now_ms - tdfc) / 86_400_000
    old_ri = _float(row[COLS['repeat_index']], default=1.0) or 1.0
    ri_new = (old_ri + days_since) * 0.9 / 2
    if was_new:
        ri_new -= 0.1

    mode = row[COLS['repeat_mode']]
    td_new = next_task_date(mode, ri_new,
                            row[COLS['repeat_days_of_week']], now_local)

    avg = calc_average_discipline(sh_exec, now_local) or 1.0
    dm  = _float(row[COLS['date_mode']], default=float('nan'))
    money = elapsed_min * avg / 2
    if math.isfinite(dm): money *= dm
    if not math.isfinite(money): money = 0.0

    # Финальная строка real_life_tasks
    out = list(row)
    out[COLS['task_time']]            = str(new_time)
    out[COLS['start_date']]           = '0'
    out[COLS['task_date']]            = str(td_new)
    out[COLS['repeat_index']]         = str(ri_new)
    out[COLS['money_reward']]         = str(money)
    out[COLS['task_finish_date']]     = '0'                  # ← стоп, не пауза
    out[COLS['number_of_executions']] = str(_int(row[COLS['number_of_executions']]) + 1)
    out[COLS['last_execution']]       = str(now_ms)
    if was_new:
        out[COLS['break_multiplier']] = str(_float(row[COLS['break_multiplier']]) + 1)
        out[COLS['task_sort']]        = str(_float(row[COLS['task_sort']]) - 0.02)

    sh_tasks.update(range_name=f'A{row_idx}:T{row_idx}', values=[out])

    if mode != '5':
        sh_exec.append_row([
            str(uuidlib.uuid4()), str(now_ms), str(elapsed_min),
            str(money), row[COLS['task_title']], task_uuid,
            now_local.strftime('%d.%m.%Y'),
        ], value_input_option='RAW')

        hero = sh_hero.get_values()
        idx = next((i for i, r in enumerate(hero[1:], start=2)
                    if r and r[0] == 'hero_money'), None)
        old_money = _float(hero[idx - 1][1]) if idx else 0.0
        new_money = old_money + money
        if idx:
            sh_hero.update(range_name=f'B{idx}', values=[[str(new_money)]])
        else:
            sh_hero.append_row(['hero_money', str(new_money)],
                               value_input_option='RAW')

    return {
        'task_uuid': task_uuid,
        'row': row_idx,
        'elapsed_minutes': elapsed_min,
        'money_reward': money,
        'new_task_date_ms': td_new,
        'event_was_new': was_new,
    }


if __name__ == '__main__':
    import sys, json
    print(json.dumps(stop_task(sys.argv[1]), ensure_ascii=False, indent=2))
```

Запуск:

```
python stop_task.py 6a1c2d3e-...-...-...
```

---

## 10. Ветка ✅ (без старта) — как модифицировать §9

Если в том же скрипте захотите обрабатывать и клик ✅ по не-запущенной задаче:

```python
start_date = _int(row[COLS['start_date']])
if start_date == 0:
    # ✅-ветка: elapsed не считаем, timeSpent = старый task_time
    elapsed_min = None
    time_spent  = _int(row[COLS['task_time']])
    new_time    = _int(row[COLS['task_time']])       # колонку B не трогаем
else:
    # ⏹-ветка, как в §9
    elapsed_min = math.ceil((now_ms - start_date) / 60_000)
    time_spent  = elapsed_min
    new_time    = math.ceil((_int(row[COLS['task_time']]) + elapsed_min) / 2)
```

Дальше всюду использовать `time_spent` вместо `elapsed_min`, и в `out[COLS['task_time']]` писать `str(new_time)`. Всё остальное (Calendar, repeat_real, task_date, reward, exec log, hero) — идентично.

---

## 11. Чеклист принятия

После ⏹ на задаче с `task_uuid`, `start_date > 0`:

- [ ] `real_life_tasks` — в найденной строке изменились **только** колонки B, E (опционально), G, H, I, M, N (опционально), O, P, T; остальные 10 идентичны.
- [ ] `start_date (G) == 0`.
- [ ] **`task_finish_date (O) == 0`** — это то, что отличает ⏹ от ⏸.
- [ ] `task_date (H)` — в будущем, согласно `repeat_mode` (для `'0'`: завтра 00:00:00.001 Samara).
- [ ] `number_of_executions (P)` увеличилось на 1.
- [ ] `last_execution (T) ≈ now_ms`.
- [ ] `money_reward (M)` > 0 (при `repeat_mode != '5'` — ровно столько же, сколько в `gained_gold` новой строки `task_executions`).
- [ ] `task_executions` — ровно **одна** новая строка (кроме `repeat_mode='5'`).
- [ ] `real_life_hero!hero_money` увеличен на `money_reward` (кроме `repeat_mode='5'`).
- [ ] В Calendar на сегодня есть событие с `description == task_uuid`, `colorId == '7'`, `end ≈ now_ms`, `start ≈ end − elapsed_min * 60000`.
- [ ] Повторный клик ⏹ на той же задаче в течение этой же секунды → `409`/ошибка (`start_date == 0` на входе).

---

## 12. Гонки с JS-клиентом

См. [`start.md §8`](file:///C:/Users/b5/Desktop/Программирование/biyk.github.io/todo/restart/start.md#8-гонки-с-js-клиентом-обязательно-прочитать) и [`pause.md §12`](file:///C:/Users/b5/Desktop/Программирование/biyk.github.io/todo/restart/pause.md#12-гонки-с-js-клиентом). Специфика ⏹:

- Если в JS-вкладке открыт список и агент успел `initTodos` между шагами 2 и 3 (после Calendar, до Sheets), пользователь может **в эту же секунду** нажать ⏸ на другой задаче, которая начнёт `updateRowByCode` своей задачи. Это безопасно (разные строки).
- Если пользователь **в той же вкладке** быстро кликнет ⏹ дважды — JS блокирует через `busyUuids`. Python-клиент **не** видит этот лок, поэтому обязан перед записью перечитать `start_date` и выйти, если он уже `0`.
- **`hero_money` — общая клетка**. Если Python и JS параллельно начисляют награду за разные задачи, один из них затрёт другого. Единственная защита: перечитать `hero_money` **непосредственно перед** `values.update B<row>`, и не кэшировать. Идеальной защиты нет (Sheets не имеет CAS-операций).

---

## 13. Избегаемые баги JS

1. Двойная запись в `task_executions` при быстром двойном клике — у JS есть `busyUuids`-лок только в рантайме одной вкладки. Python: перечитайте `start_date` прямо перед записью.
2. `money_reward = NaN`, если `averageCalc` не посчитан. Python: дефолт `1.0`.
3. `task_finish_date` случайно остаётся `1` после паузы (см. `pause.md §9`). В ⏹ этого быть не должно — явно пишем `'0'`.
4. `listEvents` в JS фильтрует «сегодня» по **локальному** поясу клиента. Если сервер Python в UTC — получите другие границы. Явно используйте `Europe/Samara` (см. `LOCAL_TZ` в §9).
5. `updateRowByCode` в JS делает полную перезапись строки из кэша. Python: всегда перечитывайте строку через `get_values()` **до** того, как слепить `out = list(row)`. Иначе потеряете чужие правки.

---

## 14. Одной таблицей: что куда писать

| Шаг | Куда | Операция | Данные |
|---|---|---|---|
| 1 | Calendar | `events.list` today | фильтр `task_uuid in description` |
| 2a | Calendar | `events.insert` (если не найдено) | `{summary, description, colorId:7, start, end}` |
| 2b | Calendar | `events.update` (если найдено) | то же + `id`; `summary` сохраняем исходный |
| 3 | `real_life_tasks` | `values.update` `A<row>:T<row>` | вся строка; **O = '0'** |
| 4 | `task_executions` | `values.append` `A1:G1` | 7 значений. Пропустить, если `repeat_mode='5'` |
| 5 | `real_life_hero` | `values.update` `B<row>` | `hero_money += money_reward`. Пропустить, если `repeat_mode='5'` |

Тот же каркас, что у `pause.md`, только **колонка O ставится в 0, а не в 1/elapsed_ms**. Всё остальное идентично.
