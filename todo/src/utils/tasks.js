import {addEvent, getFreeSlots, listEvents, makeEvent} from "@/utils/calendar.js";

export function makeTaskDone(task, store, options={}){

    let {
        repeat_days_of_week,
        repeat_index,
        repeat_mode,
        task_date,
        task_time,
        task_finish_date,
        completed,
        break_multiplier,
        number_of_executions
    } = task[0];
    let {deleted} = options;
    repeat_index = parseFloat(repeat_index);
    const now = new Date();


    console.log(repeat_mode);
    switch(repeat_mode) {
        case '0':
            task_date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0).getTime();
            break;
        case '1':
            task_date = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate() , 0, 0, 1, 0).getTime();
            break;
        case '2':
            task_date = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate() , 0, 0, 1, 0).getTime();
            break;
        case '6':
            task_date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + repeat_index, 0, 0, 1, 0).getTime();
            break;
        case '5':
            task_date = new Date().getTime() + Math.round(repeat_index * 24*60*60*1000);
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
            //console.log(task[0])
            return;
    }
    if (deleted){
        task_date = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate() , 0, 0, 1, 0).getTime();
    }
    number_of_executions++;
    const updatedTask = {
        ...task[0],
        task_date: task_date,
        task_time: task_time,
        break_multiplier: break_multiplier,
        task_finish_date: 0,
        start_date: 0,
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
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 0, 0).getTime();

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

    await scheduleTasks();
    this.$store.dispatch("todos/initTodos");
}

export function taskDate(date){
    date = parseInt(date)
    return (new Date(date)).toLocaleString()
}