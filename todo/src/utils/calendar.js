import {GoogleSheetDB} from "../../../dnd/static/js/db/google.js";

export async function listEvents(store=false) {
    const api = window.GoogleSheetDB || new GoogleSheetDB();
    await api.waitGoogle();
    const today = new Date();
    const start = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const end = new Date(today.setHours(23, 59, 59, 999)).toISOString();

    let response = await gapi.client.calendar.events.list({
        calendarId: 'primary',
        timeMin: start,
        timeMax: end,
        showDeleted: false,
        singleEvents: true,
        orderBy: 'startTime'
    });

    const events = response.result.items;
    if (events.length > 0) {
        events.forEach(event => {
            const start = event.start.dateTime || event.start.date;
            const end = event.start.dateTime || event.start.date;
            //console.log(event.summary);
        });
    } else {
        console.log('Событий на сегодня нет.');
    }
    if (store){
        store.dispatch("events/setEvents", events);
    }
    return events;

}

export async function addEvent(event) {
    await gapi.client.calendar.events.insert({
        calendarId: 'primary',
        resource: event,
    });
    console.log('Событие добавлено:', event.summary);

}

export async function updateEvent(event) {
    await gapi.client.calendar.events.update({
        calendarId: 'primary',
        eventId: event.id,
        resource:event
    });
    console.log('Событие обновлено:', event.summary);

}

export function getFreeSlots(events, workStart = '00:00', workEnd = '23:00', minSlotMinutes = 15) {
    if (!Array.isArray(events)) return [];

    const day = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
    const toDateTime = (timeStr) => new Date(`${day}T${timeStr}:00`);

    const startOfDay = toDateTime(workStart);
    const endOfDay = toDateTime(workEnd);

    // Преобразуем события в отрезки времени
    const busySlots = events.map(e => ({
        start: new Date(e.start.dateTime || e.start.date),
        end: new Date(e.end.dateTime || e.end.date)
    }));

    // Сортировка по началу события
    busySlots.sort((a, b) => a.start - b.start);

    const freeSlots = [];
    let cursor = new Date(startOfDay);

    for (const slot of busySlots) {
        if (slot.start > cursor) {
            const diff = (slot.start - cursor) / 60000; // в минутах
            if (diff >= minSlotMinutes) {
                freeSlots.push({
                    start: cursor.toISOString(),
                    end: slot.start.toISOString(),
                    duration: diff
                });
            }
        }
        // Продвигаем курсор вперёд, если событие закончилось позже текущего курсора
        if (slot.end > cursor) {
            cursor = new Date(slot.end);
        }
    }

    // Добавляем промежуток после последнего события до конца дня
    if (cursor < endOfDay) {
        const diff = (endOfDay - cursor) / 60000;
        if (diff >= minSlotMinutes) {
            freeSlots.push({
                start: cursor.toISOString(),
                end: endOfDay.toISOString(),
                duration: diff
            });
        }
    }

    return freeSlots;
}