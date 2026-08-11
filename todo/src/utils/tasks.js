import {addEvent, getFreeSlots, listEvents, makeEvent} from "@/utils/calendar.js";
import {GoogleSheetDB, Table} from "../../../dnd/static/js/db/google.js";
import {generateUUIDv4} from "@/utils/uuid.js";
import {formatDateTime} from "@/utils/format.js";
import {toNumber} from "@/utils/numbers.js";

export async function logExecuteTask(updatedTask, store) {
    const api = window.GoogleSheetDB || new GoogleSheetDB();
    await api.waitGoogle();

    const settings = store.getters["settings/allSettings"];
    const spreadsheetSetting = settings.find(s => s.code === "spreadsheetId");
    if (!spreadsheetSetting) {
        console.warn("spreadsheetId not found in settings");
        return;
    }

    let table = new Table({
        spreadsheetId: spreadsheetSetting.value,
        list: "task_executions"
    });

    let execution_time = updatedTask.minutesSpent || updatedTask.task_time;
    await table.addRow({
        execution_id: generateUUIDv4(),
        execution_date: new Date().getTime(),
        execution_time: execution_time,
        gained_gold: updatedTask.money_reward,
        task_title: updatedTask.task_title,
        task_id: updatedTask.task_uuid,
        task_date: new Date().toLocaleDateString('ru-RU'),
    })
}

export async function calcExecutions(store){
    const api = window.GoogleSheetDB || new GoogleSheetDB();
    await api.waitGoogle();

    const settings = store.getters["settings/allSettings"];
    const spreadsheetSetting = settings.find(s => s.code === "spreadsheetId");
    if (!spreadsheetSetting) {
        console.warn("spreadsheetId not found in settings");
        return {today: 0, week: 0, month: 0, averageCalc: 0, prevAvg: null, today_points: 0, h24_time: 0};
    }

    let table = new Table({
        spreadsheetId: spreadsheetSetting.value,
        list: "task_executions"
    });

    let list = await table.getAll({formated: true, format: 'orm'});

    let {averageCalc, prevAvg, today_points} = getAverageCalc(list)

    let today_time = 0;
    let week_time = 0;
    let month_time = 0;
    let h24_time = 0;

    let now = new Date();
    let startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    let sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).getTime(); // 7 дней
    let dayAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime(); // 1 день


    // Окно «месяц»: ровно месяц назад от сегодня
    let daysInPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    let startOfMonthWindow = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysInPrevMonth).getTime();

    // Уникальные даты с данными для подсчёта рабочих дней
    let weekDaysWithData = new Set();
    let monthDaysWithData = new Set();

    list.forEach((item) => {
        if (!item.execution_date || !item.execution_time) return;

        let execDate = parseInt(item.execution_date);
        let execution_time = parseInt(item.execution_time);
        // Сегодня
        if (execDate >= startOfToday) {
            today_time += execution_time;
        }

        // Последние 7 дней (включая сегодня)
        if (execDate >= sevenDaysAgo) {
            week_time += execution_time;

            // Добавляем только уникальные дни
            let dayKey = new Date(execDate).toDateString();
            weekDaysWithData.add(dayKey);
        }

        // Месяц назад от сегодня
        if (execDate >= startOfMonthWindow) {
            month_time += execution_time;

            // Добавляем только уникальные дни
            let dayKey = new Date(execDate).toDateString();
            monthDaysWithData.add(dayKey);
        }
        if (execDate >= dayAgo){
            h24_time+=execution_time;
        }
    });

    // Расчёт
    let today = today_time;
    let week = weekDaysWithData.size > 0 ? Math.round(week_time*100 / weekDaysWithData.size)/100 : 0;
    let month = monthDaysWithData.size > 0 ? Math.round(month_time*100 / monthDaysWithData.size)/100 : 0;

    let calc ={ today, week, month , averageCalc, prevAvg, today_points, h24_time};

    store.dispatch("settings/calcSettings", calc)
    return calc

}

function getAverageCalc(list) {
    let totalDays = 30;
    let start = 1;
    const oneDayMs = 24 * 60 * 60 * 1000;
    const now = new Date();
    const daysWorkSheet = {};
    let day_points = {};

    function getDateKey(date) {
        return date.toISOString().split('T')[0];
    }

    // Собираем суммарное время по каждому дню
    list.forEach(item => {
        if (!item.execution_date || !parseInt(item.execution_time)) return;
        let date = new Date(parseInt(item.execution_date));
        if (isNaN(date.getTime())) {
            console.log('Invalid Date', item);
            return;
        }
        const dayKey = getDateKey(date);
        daysWorkSheet[dayKey] = (daysWorkSheet[dayKey] || 0) + parseInt(item.execution_time);
        try {
            const gold = toNumber(item.gained_gold);
            day_points[dayKey] = (day_points[dayKey] || 0) + (isNaN(gold) ? 0 : gold);
        } catch (err) {
            console.error('Ошибка разбора gained_gold — строка пропущена из статистики:', err, { item });
        }
    });

    // Генерируем даты за указанный период (по умолчанию 30 дней)
    const dayKeys = [];
    for (let i = totalDays - 1; i >= 0; i--) {
        const day = new Date(now.getTime() - i * oneDayMs);
        const dayKey = getDateKey(day);
        if (!(dayKey in daysWorkSheet)) {
            daysWorkSheet[dayKey] = 0;
        }
        dayKeys.push(dayKey);
    }

    let cumulativeSum = 0;
    let cumulativeCount = 0;
    let prevAvg = null;

    console.groupCollapsed('averageCalc')
    for (let i = 0; i < dayKeys.length; i++) {
        const currentDayKey = dayKeys[i];
        const currentTime = daysWorkSheet[currentDayKey];

        if (i > 0) {
            prevAvg = cumulativeSum / cumulativeCount;

            let lim = 0.6180339887;
            if (currentTime <= prevAvg * lim) {
                start -= 0.01;
            } else if (currentTime > prevAvg) {
                start += 0.01;
            }
            console.log(`Day: ${currentDayKey}, Current: ${currentTime}, PrevAvg: ${prevAvg.toFixed(2)}, Start: ${start.toFixed(2)}`);

        }

        // обновляем накопительное среднее
        cumulativeSum += currentTime;
        cumulativeCount++;
    }
    console.groupEnd();
    let today_points = day_points[new Date().toISOString().split('T')[0]]
    const averageCalc = start;
    return { averageCalc, prevAvg, today_points };
}


export async function makeTaskDone(task, store, options = {}) {

    let {
        repeat_days_of_week,
        repeat_index,
        repeat_mode,
        task_date,
        task_time,
        minutesSpent,
        break_multiplier,
        number_of_executions,
        last_execution
    } = task;
    minutesSpent = minutesSpent || task_time;
    let {deleted} = options;
    repeat_index = toNumber(repeat_index);

    const now = new Date();
    let task_date4calc = last_execution ? parseInt(last_execution) : parseInt(task_date);
    //разница между запланированной датой и реальной - настоящий индекс выполнения
    let repeat_real = (repeat_index  + (now.getTime() - task_date4calc)/(1000*60*60*24)) * 0.9 / 2;

    if (deleted) {
        repeat_index+=1;
    } else {
        repeat_index = repeat_real;
    }


    switch (repeat_mode) {
        case '0':
            task_date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0).getTime();
            break;
        case '1':
            task_date = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate(), 0, 0, 1, 0).getTime();
            break;
        case '2':
            task_date = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate(), 0, 0, 1, 0).getTime();
            break;
        case '6':
        case '5':
            task_date = new Date().getTime() + Math.round(repeat_index * 24 * 60 * 60 * 1000);
            break;
        case '3':

            // Функция для поиска следующего рабочего дня
            function getNextWorkingDayOffset(repeatDays, currentDay) {
                for (let offset = 1; offset <= 7; offset++) {
                    let dayIndex = (currentDay + offset) % 7;
                    if (repeatDays[dayIndex] === '1') {
                        return offset;
                    }
                }
                return null; // нет рабочих дней
            }

            const currentDay = now.getDay(); // 0 = воскресенье, ..., 6 = суббота
            const repeat_index3 = getNextWorkingDayOffset(repeat_days_of_week, currentDay);
            if (repeat_index3 === null) {
                throw new Error("Нет рабочих дней в расписании");
            }

            // Устанавливаем даты начала и конца задачи
            task_date = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate() + repeat_index3,
                0, 0, 1, 0
            ).getTime();

            break;
        default:
            console.error('Неизвестный repeat_mode — задача не выполнена:', repeat_mode, new Error().stack, { task });
            return;
    }
    if (deleted) {
        task_date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0).getTime();
    } else {
        last_execution = now.getTime();
    }

    number_of_executions++;
    let calc =  store.getters["settings/allCalc"];
    const avg = calc?.averageCalc || 1;

    let money_reward = minutesSpent * avg / 2;
    if (!isFinite(money_reward)) {
        console.error('money_reward = NaN (minutesSpent=%s, averageCalc=%s)', minutesSpent, avg, new Error().stack);
        money_reward = 0;
    }

    const updatedTask = {
        ...task,
        task_date: task_date,
        task_time: task_time,
        repeat_index: repeat_index,
        money_reward: money_reward,
        break_multiplier: break_multiplier,
        task_finish_date: 0,
        start_date:0,
        number_of_executions: number_of_executions,
        last_execution:last_execution
    };

    console.log('updatedTask', updatedTask)

    store.dispatch("todos/updateTodo", updatedTask);


    if (deleted || repeat_mode === '5') return;

    let hero = {...store.getters["hero/getHero"]}; // создаем копию объекта

    hero.hero_money = (parseFloat(hero.hero_money) || 0) + parseFloat(money_reward);

    store.dispatch("hero/updateHero", hero);

    await logExecuteTask(updatedTask, store);
}

export function taskSort(task){
    const now = new Date();
    const daysDiff = (timestamp) => {
        const diff = now - new Date(timestamp);
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    };
    return task.task_sort - daysDiff(parseInt(task.task_date)) * task.break_multiplier
}

export async function  setTaskCompleted(){
    this.$store.dispatch("todos/initTodos");
    const now = new Date();
    //получаем список дел на сегодня
    let today_events = await listEvents();
    today_events.forEach((event)=>{
        let task_uuid = event.description;
        let todos = this.$store.getters["todos/getTodos"];
        const task = todos.filter(todo => todo.task_uuid === task_uuid);
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate() , now.getHours(), now.getMinutes(), 0, 0).getTime();

        if (task.length && (task[0].task_date < today) && (new Date(event.start.dateTime)).getTime() < today){
            makeTaskDone(task, this.$store);
        }
    });
}


export async function setTaskToCalendar() {
    //получаем список задач на сегодня
    this.$store.dispatch("todos/initTodos");

    //список всех задач
    let all = this.$store.getters["todos/getTodos"].sort((a, b) => a.task_sort - b.task_sort);
    const now = new Date();
    //const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 0, 0).getTime();
    const today = now.getTime();

    //список задач которые можно было бы сделать сегодня
    let today_tasks = all.filter(todo => {
        if (todo.task_title === 'task_title') return false;
        const start = todo.task_date;
        return start < today;
    });

    //получаем список дел на сегодня из календаря
    let today_events = await listEvents();
    today_tasks = today_tasks.sort((a, b) => {
        return taskSort(a) - taskSort(b)
    });

    //записываем в свободные места календаря события
    let freeSlots = getFreeSlots(today_events);

    async function scheduleTasks() {
        console.groupCollapsed('add Events');
        for (const task of today_tasks) {
            let duration = task.task_time;
            if (!duration || duration === '0') continue;
            //поиск свободного слота под задачу
            let slotIndex = freeSlots.findIndex(slot => slot.duration >= duration);
            if (slotIndex === -1) continue; // нет подходящего слота

            let slot = freeSlots[slotIndex];
            let exist = today_events.filter((e) => {
                return e.description?.includes(task.task_uuid)
            });

            if (exist?.length) continue;

            let excluded = today_events.filter((e) => {
                return task.excludes?.includes(e.description)
            });
            if (excluded?.length) {
                console.log('Не сегодня:', task);
                continue;
            }
            //добавление события в календарь
            const endDate = new Date(new Date(slot.start).getTime() + duration * 60 * 1000);
            const event = makeEvent(task, slot, endDate);


            await addEvent(event);
            //добавляем задачу в список today_tasks

            // обновление или удаление слота
            const updatedDuration = slot.duration - duration;
            if (updatedDuration < 15) {
                //удалить слот
                freeSlots.splice(slotIndex, 1);
            } else {
                //обновить слот
                freeSlots[slotIndex].start = endDate.toISOString();
                freeSlots[slotIndex].duration = updatedDuration;
            }
        }
        console.groupEnd();

    }

    await scheduleTasks();
    await listEvents(this.$store);
}

export function taskDate(date){
    date = parseInt(date)
    return formatDateTime(date)
}
