# done.md — «Отметить выполненной» (✅) из Python поверх **нашей** Google Таблицы

Агент работает с той же таблицей, что и браузер: `spreadsheetId` `1-EZE8HvpQbuyKjAmkyPe6042XeN7kR62ffckDSZasMg`, Google Calendar пользователя. Сценарий: нажатие ✅ — задача **не запущена** (`start_date == 0`), и пользователь говорит «сделал, просто без таймера».

---

## 0. Что делает ✅ (правильное понимание)

✅ = «засчитать выполнение с длительностью **по плану**». Таймер не использовался → фактической длительности нет → считаем, что задача заняла ровно столько, сколько было обещано (`task_time`).

Весь цикл выполнения — **тот же самый**, что у ⏹ (см. [`stop.md`](file:///C:/Users/b5/Desktop/Программирование/biyk.github.io/todo/restart/stop.md)):

- Событие-галочка `colorId=7` в Calendar.
- Пересчёт `task_date` по `repeat_mode`.
- Начисление награды и апдейт `hero_money`.
- Одна новая строка в `task_executions`.
- `number_of_executions += 1`, `last_execution = now_ms`, `start_date = 0`, `task_finish_date = 0`.

Отличий ровно **три** (см. §2).

---

## 1. Почему ✅ и ⏹ — это одна и та же функция

В JS-исходнике (`TodoList.vue:214`) — один метод `toggleTodo(todo)`, вызываемый из двух мест шаблона:

```html
<span v-if="todo.start_date == 0" class="done" @click.stop="toggleTodo(todo)">✅</span>
<span v-else class="done">
    <button @click.stop="toggleTodo(todo)">⏹</button>
</span>
```

Развилка происходит **внутри** метода, в самом верху:

```js
let start_date = parseInt(task.start_date)
task.completed = true;
if (start_date) {
    // ⏹-ветка: считаем elapsed, усредняем task_time
    const minutesSpent = Math.ceil((Date.now() - start_date) / 60000);
    task.task_time = Math.ceil((Number(task.task_time) + minutesSpent) / 2);
    task.minutesSpent = minutesSpent;
    task.start_date = 0;
} else {
    // ✅-ветка: НЕ меняем task_time, НЕ ставим minutesSpent
}
const timeSpent = task.minutesSpent ?? task.task_time;   // ← вот здесь разница
```

Всё, что идёт ниже (`endDate`, `startDate`, event, `makeTaskDone`, награда, журнал), — общее.

---

## 2. Три отличия ✅ от ⏹

| Что | ✅ (start_date == 0) | ⏹ (start_date != 0) |
|---|---|---|
| A. Колонка B (`task_time`) после операции | **не меняется** | `ceil((old + elapsed_min) / 2)` |
| B. Длительность события в Calendar | `old_task_time` минут | `elapsed_minutes` минут |
| C. `execution_time` в новой строке `task_executions` | `old_task_time` | `elapsed_minutes` |

Из отличий B и C автоматически следует:

- **Награда** `money_reward = timeSpent · avg / 2 · date_mode` — для ✅ всегда по плану, для ⏹ — по факту.
- **`task_finish_date` на выходе** у обеих веток = `0` (в `makeTaskDone`).
- **Все прочие колонки** (`task_sort`, `start_date`, `task_date`, `repeat_index`, `break_multiplier`, `money_reward`, `number_of_executions`, `last_execution`) ведут себя **идентично** ⏹.

Если вы уже реализовали `stop_task.py` из `stop.md`, переход на `done_task.py` — это удаление блока «если запущена → считаем elapsed». Ничего больше менять не надо.

---

## 3. Когда ✅ реально показывается (для понимания UX)

- `!todo.completed` — галочки-события `colorId=7` на сегодня нет.
- `!isBusy(task_uuid)` — нет активного процесса.
- `start_date == 0` — задача не запущена.
- Редактор описания закрыт.

Для Python-клиента это важно в одном месте: если задача **уже завершена** (галочка есть) или **в работе** (`start_date != 0`) — ✅ на неё жать «нельзя», но код `toggleTodo` отработает корректно и в этом случае (это тот же метод, что для ⏹). Т.е. Python-реализация ✅ **технически** принимает и `start_date != 0` — тогда она эквивалентна ⏹.

**Рекомендация:** в `done_task.py` проверяйте `start_date != 0` и бросайте `RuntimeError('задача запущена — ожидается ⏹, а не ✅')`. Это защитит от случайного двойного нажатия (сначала ▶️, потом ✅) и заставит вызывающую сторону различать команды.

---

## 4. Что пишем в `real_life_tasks` — полный список

`values.update` на `A<row>:T<row>`. Изменяются те же колонки, что у ⏹, **кроме B**:

| Кол. | Поле | Что становится |
|---|---|---|
| B | `task_time` | **без изменений** (в отличие от ⏹) |
| E | `task_sort` | `old − 0.02` **только** если галочка новая (как у ⏹) |
| G | `start_date` | `0` (уже было `0`, остаётся `0`) |
| H | `task_date` | по `repeat_mode` (как у ⏹, см. `stop.md §5`) |
| I | `repeat_index` | `repeat_real` (как у ⏹), минус 0.1 если галочка новая |
| M | `money_reward` | `old_task_time * avg / 2 * date_mode` |
| N | `break_multiplier` | `old + 1` если галочка новая |
| O | `task_finish_date` | `0` |
| P | `number_of_executions` | `old + 1` |
| T | `last_execution` | `now_ms` |

Ключевое отличие от `stop.md §2`: колонки **B** и **G** не меняются (G и так `0`), и **B** остаётся «плановым».

---

## 5. Что пишем в `task_executions` — одна append-строка

```
A execution_id      UUID v4 (новый)
B execution_date    str(now_ms)
C execution_time    str(old_task_time)          ← не elapsed_minutes!
D gained_gold       str(money_reward)
E task_title        row[COLS['task_title']]
F task_id           task_uuid
G task_date         now_local.strftime('%d.%m.%Y')
```

Если `repeat_mode == '5'` — append пропускается (как и везде).

---

## 6. `real_life_hero`

`hero_money += money_reward`. Пропускаем при `repeat_mode == '5'`.

---

## 7. Google Calendar

Та же операция, что у ⏹ (`stop.md §2.4`), но с длительностью `timeSpent = old_task_time`:

```python
end_dt   = datetime.now(LOCAL_TZ)
start_dt = end_dt - timedelta(minutes=old_task_time)
body = {
    'summary':     task_title,
    'description': task_uuid,
    'colorId':     '7',
    'start': {'dateTime': start_dt.isoformat(), 'timeZone': str(LOCAL_TZ)},
    'end':   {'dateTime': end_dt.isoformat(),   'timeZone': str(LOCAL_TZ)},
}
if existed:
    body['summary'] = existed['summary']
    cal.events().update(calendarId='primary', eventId=existed['id'], body=body).execute()
else:
    cal.events().insert(calendarId='primary', body=body).execute()
```

---

## 8. Формулы (полный блок — ради самодостаточности документа)

```python
now_ms    = int(time.time() * 1000)
now_local = datetime.now(LOCAL_TZ)

# ✅-специфика: elapsed НЕ считаем, timeSpent = старый план
old_task_time = int(row[COLS['task_time']] or 0)
time_spent    = old_task_time                     # ← единственная «своя» величина
new_task_time = old_task_time                     # колонку B не трогаем

# Повтор: repeat_real
task_date_for_calc = int(row[COLS['last_execution']] or 0) or int(row[COLS['task_date']] or 0)
days_since_scheduled = (now_ms - task_date_for_calc) / 86_400_000
old_repeat_index = float(row[COLS['repeat_index']] or 1) or 1.0
repeat_real = (old_repeat_index + days_since_scheduled) * 0.9 / 2
if event_was_new:
    repeat_real -= 0.1

# Новый task_date — по repeat_mode (см. stop.md §5 / pause.md §3)
new_task_date_ms = next_task_date_by_mode(
    repeat_mode, repeat_real, row[COLS['repeat_days_of_week']], now_local)

# Награда — по ПЛАНУ, а не по факту
avg = calc_average_discipline(sh_exec, now_local) or 1.0
date_mode = float(row[COLS['date_mode']] or 'nan')
money = time_spent * avg / 2                       # ≠ ⏹: там elapsed_min
if math.isfinite(date_mode):
    money *= date_mode
if not math.isfinite(money):
    money = 0.0
```

Всё остальное (`repeat_days_of_week`, `break_multiplier`, `task_sort`, `number_of_executions`) — как в ⏹.

---

## 9. Порядок операций

Идентичен `stop.md §8`, 5 вызовов:

```
1. Calendar.events.list              (найти существующее сегодня)
2. Calendar.events.insert/update     (галочка colorId=7, длительность = old_task_time)
3. Sheets values.update A<row>:T<row>  (финальная строка real_life_tasks; колонка B НЕ меняется)
4. Sheets values.append task_executions  — только если repeat_mode != '5'
5. Sheets values.update real_life_hero!B<row> — только если repeat_mode != '5'
```

---

## 10. Полный рабочий пример (gspread + google-api-python-client)

Начинается с `stop_task.py` из `stop.md §9`, с тремя правками (помечены `# ✅`):

```python
"""done_task.py — эквивалент клика ✅ из Python (задача не запущена)."""
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
    data = sh.get_values(); ui = COLS['task_uuid']
    for off, r in enumerate(data[1:], start=2):
        r = (r + [''] * 20)[:20]
        if r[ui] == task_uuid:
            return off, r
    raise LookupError(f'task_uuid={task_uuid} не найден')

def today_events(cal):
    now = datetime.now(LOCAL_TZ)
    return cal.events().list(
        calendarId='primary',
        timeMin=now.replace(hour=0,  minute=0,  second=0,  microsecond=0).isoformat(),
        timeMax=now.replace(hour=23, minute=59, second=59, microsecond=0).isoformat(),
        showDeleted=False, singleEvents=True, orderBy='startTime',
    ).execute().get('items', [])

def upsert_done_event(cal, task_uuid, task_title, time_spent_minutes):
    existed = next((e for e in today_events(cal)
                    if task_uuid in (e.get('description') or '')), None)
    end_dt   = datetime.now(LOCAL_TZ)
    start_dt = end_dt - timedelta(minutes=time_spent_minutes)
    body = {
        'summary': task_title, 'description': task_uuid, 'colorId': DONE_COLOR,
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

def next_task_date(mode, ri_new, mask, now_local):
    if mode == '0':
        d = (now_local + timedelta(days=1)).date()
    elif mode == '1':
        y, m = divmod(now_local.month, 12); m += 1
        d = datetime(y + (m > 12), (m - 1) % 12 + 1, now_local.day).date()
    elif mode == '2':
        d = datetime(now_local.year + 1, now_local.month, now_local.day).date()
    elif mode in ('5', '6'):
        return _now_ms() + int(round(ri_new * 86_400_000))
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
    """См. pause.md §5."""
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


def done_task(task_uuid: str) -> dict:
    now_ms    = _now_ms()
    now_local = datetime.now(LOCAL_TZ)

    sh_tasks = open_sheet(SHEET_TASKS)
    sh_exec  = open_sheet(SHEET_EXECUTIONS)
    sh_hero  = open_sheet(SHEET_HERO)
    cal      = open_calendar()

    row_idx, row = find_task_row(sh_tasks, task_uuid)
    start_date = _int(row[COLS['start_date']])
    if start_date != 0:                            # ✅
        raise RuntimeError('задача запущена — ожидается ⏹, а не ✅')

    time_spent = _int(row[COLS['task_time']])      # ✅: план, не факт
    new_time   = time_spent                        # ✅: колонку B не трогаем

    was_new = upsert_done_event(cal, task_uuid,
                                row[COLS['task_title']], time_spent)

    tdfc  = _int(row[COLS['last_execution']]) or _int(row[COLS['task_date']])
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
    money = time_spent * avg / 2                   # ✅: time_spent = план
    if math.isfinite(dm): money *= dm
    if not math.isfinite(money): money = 0.0

    out = list(row)
    # out[COLS['task_time']] НЕ трогаем             # ✅
    out[COLS['start_date']]           = '0'
    out[COLS['task_date']]            = str(td_new)
    out[COLS['repeat_index']]         = str(ri_new)
    out[COLS['money_reward']]         = str(money)
    out[COLS['task_finish_date']]     = '0'
    out[COLS['number_of_executions']] = str(_int(row[COLS['number_of_executions']]) + 1)
    out[COLS['last_execution']]       = str(now_ms)
    if was_new:
        out[COLS['break_multiplier']] = str(_float(row[COLS['break_multiplier']]) + 1)
        out[COLS['task_sort']]        = str(_float(row[COLS['task_sort']]) - 0.02)

    sh_tasks.update(range_name=f'A{row_idx}:T{row_idx}', values=[out])

    if mode != '5':
        sh_exec.append_row([
            str(uuidlib.uuid4()), str(now_ms), str(time_spent),   # ✅
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
        'task_uuid': task_uuid, 'row': row_idx,
        'time_spent_planned': time_spent,
        'money_reward': money, 'new_task_date_ms': td_new,
        'event_was_new': was_new,
    }


if __name__ == '__main__':
    import sys, json
    print(json.dumps(done_task(sys.argv[1]), ensure_ascii=False, indent=2))
```

Запуск:

```
python done_task.py 6a1c2d3e-...-...-...
```

---

## 11. Чеклист принятия

После ✅ на задаче с `start_date == 0`:

- [ ] **`task_time (B)` не изменилось** — это главное отличие от ⏹.
- [ ] `real_life_tasks` — изменились только колонки E (опционально), G (уже 0), H, I, M, N (опционально), O, P, T.
- [ ] `start_date (G) == 0`.
- [ ] `task_finish_date (O) == 0` (в отличие от ⏸ с его «1»/`elapsed_ms`).
- [ ] `task_date (H)` — в будущем, по `repeat_mode`.
- [ ] `number_of_executions (P)` += 1.
- [ ] `last_execution (T) ≈ now_ms`.
- [ ] `money_reward (M)` > 0 (если не `repeat_mode='5'`) — и **соответствует плану**, а не факту: `old_task_time * avg / 2 * date_mode`.
- [ ] `task_executions` — ровно одна новая строка (кроме `repeat_mode='5'`), с `execution_time == old_task_time` (не elapsed!).
- [ ] `real_life_hero!hero_money` += `money_reward` (кроме `repeat_mode='5'`).
- [ ] В Calendar на сегодня есть событие с `description == task_uuid`, `colorId == '7'`, длительностью `old_task_time` минут, **заканчивающееся ровно в момент ✅** (`end ≈ now_ms`).
- [ ] Повторный ✅ на той же задаче (без F5) → задача «уже завершена» и в JS, и в Python — но в Python всё равно **сработает**, т.к. `start_date` остался 0. Если хотите строгую семантику «только один раз в день» — перед шагом 3 перечитайте события и сверьте, что `event_was_new == True`; иначе выходите с кодом 409.

---

## 12. Особенности, о которых забывают

1. **Событие в Calendar оканчивается «в момент нажатия»**, а начинается `old_task_time` минут назад. Если нажали ✅ в 09:00, событие займёт интервал 08:30–09:00 (при плане в 30 минут). Это может **пересечься** с реальным автозапланированным событием (`calendar.md`), которое стоит на 09:00–09:30. Google так и покажет — два события подряд. Не страшно, но непривычно.
2. **✅ не имеет «защиты от дурака» в JS.** Можно жать ✅ подряд много раз — каждый клик создаст новую строку в `task_executions` и новую начисленную награду (через `updateEvent`, т.к. ивент уже есть). В Python — проверяйте состояние перед записью.
3. **`task_finish_date = 0` на выходе** — значит, следующий ▶️ не будет back-date'ить таймер. Это и правильно: ✅ не «останавливает» незапущенную задачу.
4. **Колонка B остаётся старой** — усреднение плана/факта при ✅ не происходит, «обещание» не корректируется. Если задача регулярно выполняется быстрее/медленнее, план будет устаревать; это лечится только через ⏹ с реальным таймером.

---

## 13. Гонки с JS-клиентом

См. `stop.md §12` — полностью применимо.

Отличия:

- `hero_money` — общий contention; см. `pause.md §12`. Специфики у ✅ нет.
- Между `events.list` и `events.insert/update` пользователь в JS может нажать ⏸/⏹. Тогда ивент поменяется два раза, и награды тоже будет две. Защита в Python: `with_for_update`-аналог в Sheets невозможен; единственный способ — «замок» в виде отдельной ячейки-флага в таблице или договорённость «пока Python работает — JS-вкладку не трогаем».

---

## 14. Сравнение четырёх «завершающих» команд

| | ✅ (этот документ) | ⏹ (`stop.md`) | ⏸ (`pause.md`) | ⓧ (`delete.md`) |
|---|---|---|---|---|
| Требует `start_date == 0` | да | нет | нет | нет |
| `elapsed_minutes` | не считаем | `ceil((now-start)/60000)` | то же | не считаем |
| `timeSpent` | `old task_time` | `elapsed_min` | `elapsed_min` | (не используется) |
| Колонка B (`task_time`) | не меняется | `avg(old, elapsed)` | `avg(old, elapsed)` | не меняется |
| Колонка T (`last_execution`) | `now_ms` | `now_ms` | `now_ms` | **не меняется** |
| `money_reward` | по плану | по факту | по факту | (расчёт, но не выплачивается) |
| Hero payout | да | да | да | нет |
| `task_executions.append` | да | да | да | нет |
| Calendar insert/update | да (colorId=7) | да | да | нет |
| Calendar delete | нет | нет | нет | **да**, если ивент был |
| `task_finish_date` на выходе | 0 | 0 | 1 (или `elapsed_ms`) | 0 |
| Новый `task_date` | по `repeat_mode` | по `repeat_mode` | по `repeat_mode` | всегда «завтра» |
| `repeat_index` | `repeat_real` (−0.1, если новый ивент) | то же | то же | `old + 1` (+0.1, если удаляли ивент) |

---

## 15. Одной фразой

`done_task.py` = `stop_task.py` минус блок «если `start_date != 0` → считать `elapsed` и менять `task_time`», и с инвертированной проверкой на входе (`start_date != 0 → 409`). Всё остальное — идентично.
