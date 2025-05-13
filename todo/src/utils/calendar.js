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

export function makeEvent(task, slot,endDate) {
    return {
        summary: task.task_title,
        description: task.task_uuid,
        colorId:7,
        start: {
            dateTime: slot.start,
            timeZone: 'Europe/Samara',
        },
        end: {
            dateTime: endDate.toISOString(),
            timeZone: 'Europe/Samara',
        },
    }
}

export async function updateEvent(event) {
    await gapi.client.calendar.events.update({
        calendarId: 'primary',
        eventId: event.id,
        resource:event
    });
    console.log('Событие обновлено:', event.summary);

}

export function getFreeSlots(events, options={}) {
    if (!Array.isArray(events)) return [];
    let workEnd = '23:00', minSlotMinutes = 15;
    let now = new Date();

    let hours = String(now.getHours()).padStart(2, '0');
    let minutes = String(now.getMinutes()).padStart(2, '0');

    let workStart = `${hours}:${minutes}`;
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