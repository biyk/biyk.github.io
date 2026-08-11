import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getFreeSlots } from '../../calendar.js';

const DAY = '2026-08-11';

describe('getFreeSlots', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(`${DAY}T09:30:00`));
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    function event(start, end) {
        return {
            start: { dateTime: new Date(start).toISOString() },
            end: { dateTime: new Date(end).toISOString() },
        };
    }

    it('без событий — один слот с текущего момента до 23:00', () => {
        const slots = getFreeSlots([]);
        expect(slots.length).toBe(1);
        expect(slots[0].start).toBe(new Date(`${DAY}T09:30:00`).toISOString());
        expect(slots[0].end).toBe(new Date(`${DAY}T23:00:00`).toISOString());
        expect(slots[0].duration).toBe(13.5 * 60);
    });

    it('событие делит день на два слота', () => {
        const slots = getFreeSlots([event(`${DAY}T12:00:00`, `${DAY}T13:00:00`)]);
        expect(slots.length).toBe(2);
        expect(slots[0].end).toBe(new Date(`${DAY}T12:00:00`).toISOString());
        expect(slots[1].start).toBe(new Date(`${DAY}T13:00:00`).toISOString());
        expect(slots[0].duration).toBe(2.5 * 60);
        expect(slots[1].duration).toBe(10 * 60);
    });

    it('события встык не создают пустых слотов', () => {
        const slots = getFreeSlots([
            event(`${DAY}T10:00:00`, `${DAY}T11:00:00`),
            event(`${DAY}T11:00:00`, `${DAY}T12:00:00`),
        ]);
        expect(slots.length).toBe(2);
        expect(slots[0].end).toBe(new Date(`${DAY}T10:00:00`).toISOString());
        expect(slots[1].start).toBe(new Date(`${DAY}T12:00:00`).toISOString());
    });

    it('слоты короче 15 минут отбрасываются', () => {
        const slots = getFreeSlots([event(`${DAY}T09:38:00`, `${DAY}T09:40:00`)]);
        expect(slots.length).toBe(1);
        expect(slots[0].start).toBe(new Date(`${DAY}T09:40:00`).toISOString());
    });

    // Баги: невалидные даты и all-day события (todo.md Уст.12 / тест 04.14)
    it.todo('невалидные даты событий не ломают расчёт слотов (Уст.12)');
    it.todo('all-day события (date без dateTime) учитываются в локальной таймзоне (Уст.12)');
});
