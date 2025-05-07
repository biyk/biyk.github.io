let intervalId = null;

export function startTaskAgent(store) {
    if (intervalId) return; // агент уже работает

    intervalId = setInterval(() => {
        const todos = store.getters['todos/getTodos'];
        const now = new Date();

        todos.forEach(todo => {
            // 🧠 Пример условия:TODO если задача просрочена — перенести на следующий период
            if (todo.task_finish_date) {
                //в цикле пока дата завершения не будет больше текущей даты
                if (todo.task_finish_date < now.getTime()) {
                    //console.log("Обрабатываем просроченную задачу:", todo.task_title);
                    //накидываем штраф
                    //меняем коэффициент
                    //переносим на следующий период
                }
            }

            // 🔁 Здесь можно добавлять другие условия/действия
        });
    }, 60 * 1000); // раз в минуту
}

export function stopTaskAgent() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        console.log("[Агент] Остановлен.");
    }
}
