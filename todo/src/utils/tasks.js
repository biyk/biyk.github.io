import {addEvent, getFreeSlots, listEvents, makeEvent} from "@/utils/calendar.js";

export function makeTaskDone(task, store, options={}){

    let {
        repeat_days_of_week,
        repeat_index,
        repeat_mode,
        start_date,
        task_finish_date,
        break_multiplier,
        number_of_executions
    } = task[0];
    let {deleted} = options;
    repeat_index = parseFloat(repeat_index);
    const now = new Date();

    console.log(repeat_mode);
    switch(repeat_mode) {
        case '0':
            start_date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0).getTime();
            task_finish_date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 0, 0).getTime();
            break;
        case '1':
            start_date = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate() , 0, 0, 1, 0).getTime();
            task_finish_date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 0, 0).getTime();
            break;
        case '2':
            start_date = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate() , 0, 0, 1, 0).getTime();
            task_finish_date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 0, 0).getTime();
            break;
        case '6':
            start_date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + repeat_index, 0, 0, 1, 0).getTime();
            task_finish_date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + repeat_index, 23, 59, 0, 0).getTime();
            break;
        case '5':
            start_date = new Date().getTime() + Math.round(repeat_index * 24*60*60*1000);
            task_finish_date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 0, 0).getTime();
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
             start_date = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate() + repeat_index3,
                0, 0, 1, 0
            ).getTime();

            task_finish_date = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate() + repeat_index3,
                23, 59, 0, 0
            ).getTime();
            break;
        default:
            //console.log(task[0])
            return;
    }
    number_of_executions++;
    const updatedTask = {
        ...task[0],
        start_date: start_date,
        break_multiplier: break_multiplier,
        task_finish_date: task_finish_date,
        number_of_executions:number_of_executions
    };
    store.dispatch("todos/updateTodo", updatedTask);

    if (deleted || repeat_mode==='5') return;
    let hero = { ...store.getters["hero/getHero"] }; // создаем копию объекта
    hero.hero_money = parseInt(hero.hero_money) + parseInt(task[0].money_reward);

    store.dispatch("hero/updateHero", hero);
}

export function taskSort(task){
    const now = new Date();
    const daysDiff = (timestamp) => {
        const diff = now - new Date(timestamp);
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    };
    return task.task_sort - daysDiff(parseInt(task.start_date)) * task.break_multiplier
}

export async function setTaskToCalendar() {
    //получаем список задач на сегодня
    this.$store.dispatch("todos/initTodos");

    //список всех задач
    let all = this.$store.getters["todos/getTodos"].sort((a, b) => a.task_sort - b.task_sort);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 0, 0).getTime();

    //список задач которые можно было бы сделать сегодня
    let today_tasks = all.filter(todo => {
        if (todo.task_title === 'task_title') return false;
        const start = todo.start_date;
        return start < today;
    });

    //получаем список дел на сегодня из календаря
    let today_events = await listEvents();
    today_tasks = today_tasks.sort((a, b) => {
        return taskSort(a) - taskSort(b)
    });
    console.log(today_tasks);

    //записываем в свободные места календаря события
    let freeSlots = getFreeSlots(today_events);

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
}

export function taskDate(date){
    date = parseInt(date)
    return (new Date(date)).toLocaleString()
}