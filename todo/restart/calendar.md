# calendar.md — «Заполнить календарь» из Python поверх **нашей** Google Таблицы

Агент работает с той же таблицей, что и браузер: `spreadsheetId` `1-EZE8HvpQbuyKjAmkyPe6042XeN7kR62ffckDSZasMg`, Google Calendar пользователя. Сценарий: пользователь нажал кнопку «Заполнить календарь» (видна только в фильтре «Сейчас»).

---

## 0. Что делает «Заполнить календарь» (правильное понимание)

Кнопка **автопланирует задачи на оставшуюся часть сегодня**. Она расставляет события в свободные окна календаря по приоритету, ничего не спрашивая у пользователя.

Ключевое отличие от четырёх других команд (`start.md` / `stop.md` / `pause.md` / `delete.md`):

**⚠ Эта команда НИЧЕГО не пишет в Google Таблицы.** Ни в `real_life_tasks`, ни в `task_executions`, ни в `real_life_hero`. Единственная мутация — серия `events.insert` в Calendar.

Что она делает за кадром мутаций:

1. Перечитывает все задачи из `real_life_tasks` (через `initTodos` — в JS; Python читает напрямую).
2. Перечитывает события календаря на сегодня.
3. Фильтрует задачи: только просроченные/на сегодня (`task_date < now_ms`), у которых ненулевая длительность (`task_time > 0`).
4. Сортирует их по приоритету (см. §4).
5. Считает свободные окна в календаре: от «сейчас» до 23:00, шаг не короче 15 минут.
6. Для каждой задачи в порядке приоритета:
   - пропускает, если для неё сегодня **уже** есть событие (идемпотентность);
   - пропускает, если в календаре уже стоит конфликтующая задача из `excludes` (см. §7);
   - ищет **первое** свободное окно, достаточное по длительности;
   - создаёт событие с `start = начало окна`, `end = start + task_time`;
   - «съедает» окно: сдвигает его начало или удаляет, если остаток < 15 мин.

Никакого начисления награды, никаких отметок «сделано», никаких изменений в листе задач.

---

## 1. Когда показывается кнопка

```html
<button v-if="selectedFilter==='calendar'" @click="setTaskToCalendar">
    Заполнить календарь
</button>
```

Виден только в фильтре «Сейчас». Пользователь в момент нажатия, как правило, уже видит, что на сегодня спланировано мало или вообще ничего — и хочет «разложить всё по окнам».

Python-клиенту фильтр не важен — кнопка в UI это просто триггер; сам алгоритм (§2) применим в любом состоянии.

---

## 2. Формальный алгоритм

```
setTaskToCalendar():
    1. tasks_all  = sheets.read_real_life_tasks()       # полный лист
    2. now_ms     = int(time.time() * 1000)
    3. now_local  = datetime.now(Europe/Samara)

    4. today_tasks = [t for t in tasks_all
                        if 'task_title' not in t.task_title
                        and int(t.task_date or 0) < now_ms]
       # примечание: «task_date < now» — единственный критерий «пора»

    5. todays_events = calendar.events.list(
                            timeMin = сегодня 00:00 local,
                            timeMax = сегодня 23:59:59 local)

    6. today_tasks.sort(key=lambda t: taskSort(t, now_local))
       # см. §4

    7. free_slots = compute_free_slots(todays_events,
                                       work_start=now_local,
                                       work_end =сегодня 23:00,
                                       min_slot_minutes=15)
       # см. §5

    8. for task in today_tasks:
         duration = int(task.task_time or 0)
         if duration == 0:
             continue
         slot_idx = first i where free_slots[i].duration >= duration
         if slot_idx is None:
             continue
         slot = free_slots[slot_idx]

         if any(task.task_uuid in (e.description or '') for e in todays_events):
             continue    # уже запланирована (или уже выполнена) — пропускаем

         if any((e.description or '') and e.description in (task.excludes or '')
                for e in todays_events):
             continue    # конфликт по excludes — «не сегодня»

         end_dt = slot.start + duration*60_000 мс
         event  = make_event(task, slot, end_dt)         # см. §8
         calendar.events.insert(body=event)

         rest = slot.duration - duration
         if rest < 15:
             free_slots.pop(slot_idx)
         else:
             free_slots[slot_idx].start    = end_dt
             free_slots[slot_idx].duration = rest

    9. # финальный refresh — в JS это listEvents(store); в Python не нужно
```

Порядок итераций по `today_tasks` важен: приоритетные получают «лучшие» (ранние) слоты. Если первая попавшаяся длинная задача съест окно, короткая потом может не влезть.

---

## 3. Фильтр «что подлежит автопланированию»

Три условия (JS, `tasks.js:363-378`):

1. **Не технический ряд.** `task_title.includes('task_title')` исключает заголовочную/служебную строку листа (иногда JS-ORM её подтягивает). В Python: строка, у которой `task_title == 'task_title'` (первая строка данных под шапкой, если она не была вырезана).
2. **Срок наступил.** `int(task.task_date) < now_ms`. Просроченные (`task_date` в прошлом) тоже попадают — они должны «догнять».
3. **Длительность ненулевая.** `int(task.task_time) > 0` проверяется уже внутри цикла (§2, шаг 8).

Всё остальное (цвет, режим повтора, `completed`) — не важно.

> **Важно:** автопланирование игнорирует, была ли задача уже выполнена сегодня. «Уже выполнена» отсеивается только через `exist` — «в календаре на сегодня есть событие с этой `task_uuid`». Если задача выполнена, но событие удалили (ⓧ), её снова поставят в календарь.

---

## 4. Приоритет: `taskSort`

```python
def taskSort(task, now_local):
    """Как в JS: task.task_sort - daysDiff(task_date) * break_multiplier"""
    task_date_ms = int(task['task_date'] or 0)
    dt = datetime.fromtimestamp(task_date_ms / 1000, tz=LOCAL_TZ)
    days_diff = math.floor((now_local - dt).total_seconds() / 86400)
    return float(task['task_sort'] or 0) - days_diff * float(task['break_multiplier'] or 0)
```

Порядок: **меньшее значение → раньше планируется**.

Разбор:
- Ручной `task_sort` (колонка E) — базовый приоритет; меньше = важнее.
- `days_diff` — сколько дней назад задача стала просроченной; отрицательный множитель толкает «давно висящие» задачи вверх.
- `break_multiplier` — «штраф за пропуски», §0 в `delete.md`. Чем он больше, тем агрессивнее просроченная задача лезет наверх.

Нюанс: `daysDiff` в JS использует `now - new Date(timestamp)` и `Math.floor` — т.е. «сколько полных суток назад». Для задач, назначенных на сегодня (будущее в рамках того же дня), `days_diff = -1` в JS (округление вниз отрицательного числа). Это может дать парадокс: задача, у которой `task_date` чуть в будущем, получает лёгкий «антиштраф» и уезжает вниз списка. Воспроизводим 1-в-1.

---

## 5. Свободные слоты

JS-функция `getFreeSlots` (`calendar.js:124-181`). Параметры:

| Что | Значение |
|---|---|
| Начало рабочего окна | **момент вызова**, округлённый вниз до минуты (`HH:MM` текущего локального времени) |
| Конец рабочего окна | `23:00` локально (`Europe/Samara`) |
| Минимальная длина слота | 15 минут |

Алгоритм:

```python
def compute_free_slots(events, now_local, min_slot=15, work_end_hour=23):
    day_start = now_local.replace(second=0, microsecond=0)
    day_end   = now_local.replace(hour=work_end_hour, minute=0,
                                  second=0, microsecond=0)
    if day_end <= day_start:
        return []

    busy = sorted(
        ((datetime.fromisoformat(e['start']['dateTime'].replace('Z','+00:00')).astimezone(LOCAL_TZ),
          datetime.fromisoformat(e['end']  ['dateTime'].replace('Z','+00:00')).astimezone(LOCAL_TZ))
         for e in events if 'start' in e and 'dateTime' in e['start']),
        key=lambda s: s[0])

    free = []
    cursor = day_start
    for b_start, b_end in busy:
        if b_start > cursor:
            gap = (b_start - cursor).total_seconds() / 60
            if gap >= min_slot:
                free.append({'start': cursor, 'end': b_start, 'duration': gap})
        cursor = max(cursor, b_end)
    if cursor < day_end:
        gap = (day_end - cursor).total_seconds() / 60
        if gap >= min_slot:
            free.append({'start': cursor, 'end': day_end, 'duration': gap})
    return free
```

Округление: `duration` — дробное число минут (float). JS делает `(slot.start - cursor) / 60000`, тоже float. Сравнения `>= duration` работают с float — воспроизводим.

---

## 6. Как выбирается слот

`free_slots.findIndex(s => s.duration >= task_time)` — **первое** окно, в которое задача влезает. Не «самое маленькое подходящее», не «самое позднее» — именно первое сверху.

Это может приводить к тому, что одна длинная задача съест раннее большое окно, а последующие короткие поедут в мелкие хвосты. Осознанное упрощение JS.

---

## 7. `excludes` — «не сегодня, если…»

Колонка Q `real_life_tasks.excludes` — CSV со `task_uuid` задач, с которыми данная **не должна** соседствовать в один день.

JS-проверка (`tasks.js:405-411`):
```js
let excluded = today_events.filter((e) => {
    return task.excludes?.includes(e.description)
});
if (excluded?.length) continue;
```

Буквально: подстрока `e.description` (uuid другой задачи) ищется в строке `task.excludes`. Если найдено — текущая задача **не планируется сегодня**, слот для неё не тратится.

Python-эквивалент:
```python
excludes_csv = task.get('excludes') or ''
if any((e.get('description') or '') and e['description'] in excludes_csv
       for e in todays_events):
    continue
```

Осторожно: в JS это `String.includes`, **не** `Array.includes`. Т.е. если `excludes` содержит строку `"aaaa-bbbb,cccc-dddd"`, и `e.description == "aaaa"`, то JS сочтёт конфликт (совпадение подстроки). В Python `in` ведёт себя так же. Если хочется честного CSV-поиска — разбивайте `excludes.split(',')` и сравнивайте множества; но тогда вы **отойдёте** от поведения JS и получите расхождения UI/бота.

---

## 8. Формат создаваемого события

JS-функция `makeEvent`:

```python
def make_event(task, slot, end_dt):
    return {
        'summary':     task['task_title'],
        'description': task['task_uuid'],
        # colorId НЕ ставим — Google назначит дефолтный
        # (цвет 7 = «сделано» появится только после ⏹/⏸/✅)
        'start': {
            'dateTime': slot['start'].astimezone().isoformat(),
            'timeZone': 'Europe/Samara',
        },
        'end': {
            'dateTime': end_dt.astimezone().isoformat(),
            'timeZone': 'Europe/Samara',
        },
    }
```

`description` — **ровно** `task_uuid`, без разделителей, без переносов. В JS потом `event.description.split('\n')` используется в `getSortedTodos` для «мульти-uuid»-событий, но сюда автопланирование пишет только один uuid.

**`colorId` не выставляется намеренно.** Это отличает автозапланированные события от завершённых (`colorId='7'` — см. `stop.md §2.4`). Если пометить их «7», UI сочтёт их уже выполненными и уберёт из активного списка — сломается весь цикл.

---

## 9. Идемпотентность

Алгоритм можно вызывать много раз в день, последствия:

- Повторный вызов **не создаёт дублей**: проверка «уже есть событие с этим uuid» (§2, шаг 8) отфильтрует уже-запланированные задачи.
- Если пользователь между вызовами что-то добавил в календарь руками, новые слоты пересчитаются, и оставшиеся задачи встанут по-другому.
- Удалить запланированное автопланированием событие — просто. Никаких «откатов» в Sheets нет.

---

## 10. Полный рабочий пример (gspread + google-api-python-client)

```python
"""fill_calendar.py — «Заполнить календарь» из Python."""
import os
import math
import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import gspread
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

SPREADSHEET_ID = os.environ['SPREADSHEET_ID']
SHEET_TASKS    = 'real_life_tasks'
LOCAL_TZ       = ZoneInfo('Europe/Samara')
MIN_SLOT_MIN   = 15
WORK_END_HOUR  = 23

COLS = {
    'task_title': 0, 'task_time': 1, 'task_description': 2, 'task_uuid': 3,
    'task_sort': 4, 'task_color': 5, 'start_date': 6, 'task_date': 7,
    'repeat_index': 8, 'repeat_days_of_week': 9, 'repeat_mode': 10,
    'date_mode': 11, 'money_reward': 12, 'break_multiplier': 13,
    'task_finish_date': 14, 'number_of_executions': 15, 'excludes': 16,
    'task_before': 17, 'task_after': 18, 'last_execution': 19,
}


def _int(v, d=0):
    try:  return int(float(str(v).strip() or d))
    except Exception: return d

def _float(v, d=0.0):
    try:  return float(str(v).replace(',', '.').strip() or d)
    except Exception: return d


def open_sheet(name):
    gc = gspread.service_account(
        filename=os.environ.get('GOOGLE_APPLICATION_CREDENTIALS', 'service_account.json'))
    return gc.open_by_key(SPREADSHEET_ID).worksheet(name)

def open_calendar():
    creds = Credentials.from_service_account_file(
        os.environ.get('GOOGLE_APPLICATION_CREDENTIALS', 'service_account.json'),
        scopes=['https://www.googleapis.com/auth/calendar'])
    return build('calendar', 'v3', credentials=creds)


def read_tasks(sh):
    data = sh.get_values()
    if not data: return []
    header = data[0]
    out = []
    for r in data[1:]:
        r = (r + [''] * 20)[:20]
        t = {name: r[i] for name, i in COLS.items()}
        out.append(t)
    return out


def today_events(cal):
    now = datetime.now(LOCAL_TZ)
    body = cal.events().list(
        calendarId='primary',
        timeMin=now.replace(hour=0,  minute=0,  second=0,  microsecond=0).isoformat(),
        timeMax=now.replace(hour=23, minute=59, second=59, microsecond=0).isoformat(),
        showDeleted=False, singleEvents=True, orderBy='startTime',
    ).execute()
    return body.get('items', [])


def task_sort_key(task, now_local):
    td_ms = _int(task['task_date'])
    if not td_ms:
        days = 0
    else:
        td = datetime.fromtimestamp(td_ms / 1000, LOCAL_TZ)
        days = math.floor((now_local - td).total_seconds() / 86400)
    return _float(task['task_sort']) - days * _float(task['break_multiplier'])


def compute_free_slots(events, now_local):
    day_start = now_local.replace(second=0, microsecond=0)
    day_end   = now_local.replace(hour=WORK_END_HOUR, minute=0,
                                  second=0, microsecond=0)
    if day_end <= day_start: return []

    def parse(dt_str):
        # Google присылает ISO8601 с offset
        return datetime.fromisoformat(dt_str.replace('Z', '+00:00')).astimezone(LOCAL_TZ)

    busy = []
    for e in events:
        try:
            s = parse(e['start']['dateTime']); en = parse(e['end']['dateTime'])
            busy.append((s, en))
        except (KeyError, TypeError):
            continue
    busy.sort(key=lambda x: x[0])

    free = []; cursor = day_start
    for s, en in busy:
        if s > cursor:
            gap = (s - cursor).total_seconds() / 60
            if gap >= MIN_SLOT_MIN:
                free.append({'start': cursor, 'duration': gap})
        cursor = max(cursor, en)
    if cursor < day_end:
        gap = (day_end - cursor).total_seconds() / 60
        if gap >= MIN_SLOT_MIN:
            free.append({'start': cursor, 'duration': gap})
    return free


def make_event(task, slot_start, slot_end):
    return {
        'summary':     task['task_title'],
        'description': task['task_uuid'],
        'start': {'dateTime': slot_start.isoformat(), 'timeZone': str(LOCAL_TZ)},
        'end':   {'dateTime': slot_end.isoformat(),   'timeZone': str(LOCAL_TZ)},
    }


def fill_calendar(dry_run: bool = False) -> list:
    now_ms    = int(time.time() * 1000)
    now_local = datetime.now(LOCAL_TZ)

    sh  = open_sheet(SHEET_TASKS)
    cal = open_calendar()

    all_tasks = read_tasks(sh)
    todays    = today_events(cal)

    # 1) фильтр «на сегодня и просроченные»
    candidates = [t for t in all_tasks
                  if 'task_title' not in (t['task_title'] or '')
                  and _int(t['task_date']) < now_ms]

    # 2) приоритетная сортировка
    candidates.sort(key=lambda t: task_sort_key(t, now_local))

    # 3) свободные окна
    free = compute_free_slots(todays, now_local)

    placed = []
    for task in candidates:
        duration = _int(task['task_time'])
        if duration <= 0:
            continue

        # уже запланирована сегодня?
        if any(task['task_uuid'] in (e.get('description') or '') for e in todays):
            continue

        # конфликт по excludes?
        excl = task.get('excludes') or ''
        if excl and any((e.get('description') or '') and e['description'] in excl
                        for e in todays):
            continue

        # первое подходящее окно
        slot_idx = next((i for i, s in enumerate(free) if s['duration'] >= duration),
                        None)
        if slot_idx is None:
            continue
        slot = free[slot_idx]
        start_dt = slot['start']
        end_dt   = start_dt + timedelta(minutes=duration)

        body = make_event(task, start_dt, end_dt)
        if not dry_run:
            cal.events().insert(calendarId='primary', body=body).execute()

        placed.append({
            'task_uuid': task['task_uuid'],
            'title':     task['task_title'],
            'start':     start_dt.isoformat(),
            'end':       end_dt.isoformat(),
        })

        # съедаем окно
        rest = slot['duration'] - duration
        if rest < MIN_SLOT_MIN:
            free.pop(slot_idx)
        else:
            free[slot_idx] = {'start': end_dt, 'duration': rest}

    return placed


if __name__ == '__main__':
    import json
    res = fill_calendar(dry_run='--dry' in __import__('sys').argv)
    print(json.dumps(res, ensure_ascii=False, indent=2))
```

Запуск:

```
python fill_calendar.py            # реальная вставка событий
python fill_calendar.py --dry      # только показать, что встало бы
```

---

## 11. Чеклист принятия

До и после вызова:

- [ ] `real_life_tasks` — **ни одной изменённой ячейки**. (Проверяется снимком листа до/после.)
- [ ] `task_executions` — **ни одной новой строки**.
- [ ] `real_life_hero` — `hero_money` не изменился.
- [ ] В Calendar на сегодня добавились N событий, где N = число, возвращённое `fill_calendar()`.
- [ ] Каждое новое событие имеет `description = <task_uuid>`, `summary = <task_title>`, **без `colorId`** (или с дефолтным).
- [ ] Суммарная длительность новых событий ≤ доступного окна «сейчас → 23:00».
- [ ] Новые события **не пересекаются** ни между собой, ни с уже существовавшими.
- [ ] Повторный вызов сразу после первого → `N = 0`, новых событий нет (идемпотентность).
- [ ] Задачи с `task_time = 0` или пустым не появляются в календаре.
- [ ] Задачи с непустым `excludes`, чьи uuid уже стоят в календаре, **не** запланированы.
- [ ] Просроченные сильно (`task_date << now`) и с высоким `break_multiplier` встают **раньше** свежих.

---

## 12. Гонки и параллельность

- **Между `events.list` и `events.insert`** пользователь или другой агент может занять нужное окно. Python этого не увидит и поставит событие поверх. Google Calendar не запрещает пересекающиеся события — они просто наложатся. Защита: `events.insert` с параметром `sendUpdates='none'` и предварительный `events.list` ещё раз прямо перед вставкой. Либо — принимать как есть (в JS тоже нет защиты).
- **Параллельный запуск из двух мест** (два термина / cron + ручной клик) породит **дубли** событий, потому что «уже запланирована?» проверяется по списку из начала. Чтобы этого избежать — перечитывать `todays_events` перед каждой вставкой, либо ставить локальный advisory lock (файл-лок).
- **Чтение листа в шаге 1** устаревает, если JS-агент в браузере прямо сейчас что-то пишет в `real_life_tasks`. Это не страшно — автопланирование не делает write-back. Максимум — поставит в календарь задачу, которую только что удалили (или наоборот, не поставит ту, которую только что разблокировали).

---

## 13. Избегаемые ловушки

1. **`workStart = now`, не полночь.** Если запустить в 22:50, окно — 10 минут, и ни одна задача с `task_time > 10` не встанет.
2. **`workEnd = 23:00`, а не 23:59.** Полчаса «в никуда» — сознательное ограничение JS.
3. **`minSlot = 15`** — это и минимальный размер «дырки», и минимальный остаток при «съедании». Если задача 25 мин, а окно 35 мин — встанет, но остаток 10 мин **удаляется**, а не оставляется.
4. **Сортировка в JS `all.sort(...)` мутирует массив в Vuex** — баг. В Python не воспроизводим; работаем с копиями.
5. **`description.includes(uuid)`** — подстрочный поиск. Дублируются ложные срабатывания, если один uuid — подстрока другого (в валидном UUID v4 это невозможно, но при портировании на другой формат — учтите).
6. **`task.excludes.includes(event.description)`** — аналогично, подстрока. Если в `excludes` перечислены uuid без пробелов и переносов, ложных срабатываний нет. Если с переносами — возможны.
7. **Событие-галочка `colorId='7'`** (см. `stop.md`) тоже попадает в `todays_events` и потому «уже запланирована» срабатывает на выполненную задачу. Т.е. после ✅ автопланирование не переставит её — правильно.
8. **`events.list` возвращает только «не удалённые» (showDeleted=false).** Если событие было удалено, но не уничтожено окончательно, оно не помешает автопланированию поставить новое.

---

## 14. Сводка: что трогает команда

| Система | Операция | Объём |
|---|---|---|
| `real_life_tasks` | — | ничего |
| `task_executions` | — | ничего |
| `real_life_hero` | — | ничего |
| Google Calendar | `events.list` (today) | 1 вызов |
| Google Calendar | `events.insert` | от 0 до N вызовов |

Только чтение листа и только запись в календарь. Это единственная команда из пяти, которая **не** изменяет Google Таблицу.
