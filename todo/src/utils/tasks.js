export function makeTaskDone(task, store){

    let {
        repeat_index,
        repeat_mode,
        start_date,
        task_finish_date
    } = task[0];
    repeat_index = parseInt(repeat_index);
    const now = new Date();

    switch(repeat_mode) {
        case '1':
            start_date = (new Date()).getTime() + 1000*30*24*60*60;
            task_finish_date = (new Date()).getTime() + 1000*31*24*60*60;
            break;
        case '0':
            start_date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0).getTime();;
            task_finish_date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 0, 0).getTime();
            break;
        case '6':
            start_date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + repeat_index, 0, 0, 1, 0).getTime();;
            task_finish_date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + repeat_index, 23, 59, 0, 0).getTime();
            break;
        default:
            console.log(task[0])
            return;
    }

    const updatedTask = {
        ...task[0],
        start_date: start_date,
        task_finish_date: task_finish_date
    };
    store.dispatch("todos/updateTodo", updatedTask);
}