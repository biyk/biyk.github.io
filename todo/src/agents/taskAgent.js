import {listEvents} from "@/utils/calendar.js";
import {GoogleSheetDB} from "../../../dnd/static/js/db/google.js";

let intervalId = null;

export function startTaskAgent(store) {
    if (intervalId) return; // агент уже работает

    intervalId = setInterval(async () => {
        const api = window.GoogleSheetDB || new GoogleSheetDB();
        if  (!api.expired()){
            store.dispatch("todos/initTodos");
            const todos = store.getters['todos/getTodos'];
            await listEvents(store);
        }

        const now = new Date();

    }, 60 * 1000); // раз в минуту
}

export function stopTaskAgent() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        console.log("[Агент] Остановлен.");
    }
}
