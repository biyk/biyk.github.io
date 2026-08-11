import { describe, it, expect } from 'vitest';
import { formatDateTime } from '../../format.js';

describe('formatDateTime', () => {
    it('форматирует дату в русской локали: дд.мм.гггг, чч:мм:сс', () => {
        expect(formatDateTime(new Date(2026, 7, 11, 15, 30, 0))).toBe('11.08.2026, 15:30:00');
    });

    it('принимает timestamp', () => {
        const ts = new Date(2026, 0, 2, 9, 5, 7).getTime();
        expect(formatDateTime(ts)).toBe('02.01.2026, 09:05:07');
    });

    it('без аргумента — текущее время в русской локали', () => {
        expect(formatDateTime()).toMatch(/\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}:\d{2}/);
    });

    it('NaN даёт "Invalid Date" без throw', () => {
        expect(formatDateTime(NaN)).toContain('Invalid Date');
    });
});
