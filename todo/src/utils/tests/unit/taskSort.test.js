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
    it('форматирует timestamp в локальную строку', () => {
        const ts = new Date(2026, 7, 11, 15, 30, 0).getTime();
        const s = taskDate(ts);
        expect(s).toMatch(/2026/);
        expect(s).toContain('15:30');
    });

    it('NaN даёт "Invalid Date" без throw', () => {
        expect(taskDate('не число')).toContain('Invalid Date');
    });
});
