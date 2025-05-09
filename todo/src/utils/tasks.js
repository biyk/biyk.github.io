export function makeTaskDone(task, store){

    let {
        repeat_days_of_week,
        repeat_index,
        repeat_mode,
        start_date,
        task_finish_date
    } = task[0];
    repeat_index = parseInt(repeat_index);
    const now = new Date();

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
            break;
    }

    const updatedTask = {
        ...task[0],
        start_date: start_date,
        task_finish_date: task_finish_date
    };
    let hero = { ...store.getters["hero/getHero"] }; // создаем копию объекта
    hero.hero_money = parseInt(hero.hero_money) + parseInt(task[0].money_reward);

    store.dispatch("todos/updateTodo", updatedTask);
    store.dispatch("hero/updateHero", hero);
}