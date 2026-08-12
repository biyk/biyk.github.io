import {GoogleSheetDB} from "../../../dnd/static/js/db/google.js";

// Тест-режим: addEvent/updateEvent/deleteEvent — no-op с записью в память,
// listEvents возвращает управляемый список. Нужен для веб-тестов сценариев (05.x),
// чтобы не создавать реальные события в календаре пользователя.
let _testMode = false;
let _testEvents = [];

export function setCalendarTestMode(enabled = true) {
    _testMode = enabled;
    if (enabled) _testEvents = [];
}

export function getTestEvents() {
    return [..._testEvents];
}

export function setTestEvents(events) {
    _testEvents = Array.isArray(events) ? [...events] : [];
}

export async function listEvents(store = false) {
    if (_testMode) {
        if (store) {
            store.dispatch("events/setEvents", [..._testEvents]);
        }
        return [..._testEvents];
    }

    const api = window.GoogleSheetDB || new GoogleSheetDB();
    await api.waitGoogle();

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    const start = `${year}-${month}-${day}T00:00:00`;
    const end = `${year}-${month}-${day}T23:59:59`;

    const offsetMin = -today.getTimezoneOffset();
    const tzOffset = `${offsetMin >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(offsetMin) / 60)).padStart(2, '0')}:${String(Math.abs(offsetMin) % 60).padStart(2, '0')}`;

    let response = await gapi.client.calendar.events.list({
        calendarId: 'primary',
        timeMin: `${start}${tzOffset}`,
        timeMax: `${end}${tzOffset}`,
        showDeleted: false,
        singleEvents: true,
        orderBy: 'startTime'
    });

    const events = response.result.items;
    if (store) {
        store.dispatch("events/setEvents", events);
    }
    return events;
}

export async function addEvent(event) {
    if (_testMode) {
        _testEvents.push({...event});
        console.log('Событие добавлено (тест):', event.summary, { colorId: event.colorId, start: event.start?.dateTime, end: event.end?.dateTime });
        return;
    }
    await gapi.client.calendar.events.insert({
        calendarId: 'primary',
        resource: event,
    });
    console.log('Событие добавлено:', event.summary, { colorId: event.colorId, start: event.start?.dateTime, end: event.end?.dateTime });

}

export function makeEvent(task, slot,endDate) {
    return {
        summary: task.task_title,
        description: task.task_uuid,
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
    if (_testMode) {
        const idx = _testEvents.findIndex(e => e.id === event.id);
        if (idx !== -1) _testEvents[idx] = {...event};
        console.log('Событие обновлено (тест):', event.summary, { eventId: event.id, colorId: event.colorId, start: event.start?.dateTime, end: event.end?.dateTime });
        return;
    }
    await gapi.client.calendar.events.update({
        calendarId: 'primary',
        eventId: event.id,
        resource:event
    });
    console.log('Событие обновлено:', event.summary, { eventId: event.id, colorId: event.colorId, start: event.start?.dateTime, end: event.end?.dateTime });

}

export async function deleteEvent(event) {
    if (_testMode) {
        const idx = _testEvents.findIndex(e => e.id === event.id);
        if (idx !== -1) _testEvents.splice(idx, 1);
        console.log('Событие удалено (тест):', event.summary);
        return;
    }
    try {
        await gapi.client.calendar.events.delete({
            calendarId: 'primary',
            eventId: event.id
        });
        console.log('Событие удалено:', event.summary);
    } catch (error) {
        console.error('Ошибка при удалении события:', error);
    }
}


export function getFreeSlots(events, options={}) {
    if (!Array.isArray(events)) return [];
    let workEnd = '23:00', minSlotMinutes = 15;
    let now = new Date();

    let hours = String(now.getHours()).padStart(2, '0');
    let minutes = String(now.getMinutes()).padStart(2, '0');

    let workStart = `${hours}:${minutes}`;
    const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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