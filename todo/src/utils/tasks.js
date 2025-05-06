export function makeTaskDone(task, store){

    let {
        task_uuid,
        repeat_mode,
        start_date,
        task_finish_date
    } = task[0];
    if (repeat_mode==='1'){//ежемесячно
        start_date = (new Date()).getTime() + 1000*30*24*60*60;
        task_finish_date = (new Date()).getTime() + 1000*31*24*60*60;
   }
    if (repeat_mode==='0'){//ежедневно
        const now = new Date();
        start_date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0).getTime();;
        task_finish_date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 0, 0).getTime();
    }

    const updatedTask = {
        ...task[0],
        start_date: start_date,
        task_finish_date: task_finish_date
    };
    store.dispatch("todos/updateTodo", updatedTask);
}