import {listEvents} from "../../utils/calendar.js";

export default {
    name: 'Б1.4.9 Calendar: список событий',
    requiresGapi: true,
    async run() {
        console.log('[Б1.4.9] Загружаю события на сегодня');
        const events = await listEvents();
        console.log('[Б1.4.9] Событий:', events.length);
        return {
            passed: Array.isArray(events),
            details: Array.isArray(events)
                ? `Сегодняшние события загружены (${events.length})`
                : 'Ошибка загрузки событий'
        };
    }
};
