import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { taskSort, taskDate } from '../../tasks.js';

describe('taskSort', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 7, 11, 12, 0, 0));
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('штрафует просроченные дни с учётом break_multiplier', () => {
        const now = Date.now();
        const yesterday = now - 24 * 60 * 60 * 1000;
        const task = { task_sort: 100, task_date: yesterday, break_multiplier: 2 };
        expect(taskSort(task)).toBe(100 - 1 * 2);
    });
});

describe('taskDate', () => {
    it('форматирует timestamp в русской локали (дд.мм.гггг, чч:мм:сс)', () => {
        const ts = new Date(2026, 7, 11, 15, 30, 0).getTime();
        expect(taskDate(ts)).toBe('11.08.2026, 15:30:00');
    });

    it('NaN даёт "Invalid Date" без throw', () => {
        expect(taskDate('не число')).toContain('Invalid Date');
    });
});
