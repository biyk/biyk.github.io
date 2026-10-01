import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Фикстура для замотанного Table.getAll — строки журнала task_executions (orm-объекты).
let mockExecRows = [];

vi.mock('../../../../../dnd/static/js/db/google.js', () => ({
    GoogleSheetDB: class {
        async waitGoogle() {}
    },
    Table: class {
        constructor() {}
        async getAll() { return mockExecRows; }
    },
    ORM: class {
        constructor() {}
        getFormated(x) { return x; }
    },
}));

import { sumExecutedMinutesToday } from '@/utils/tasks.js';

// Регрессия фичи: при «✅ завершено»/«⏹ стоп» по задаче, которая была на паузе,
// в task_time пишется суммарное время по всем сегментам, зафиксированным за сегодня.
// Источник — журнал task_executions (каждая пауза дописывает свою строку execution_time).
describe('sumExecutedMinutesToday', () => {
    const store = {
        getters: {
            'settings/allSettings': [{ code: 'spreadsheetId', value: 'sid' }],
        },
    };

    const dayStart = (d = new Date()) =>
        new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

    beforeEach(() => {
        mockExecRows = [];
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.stubGlobal('window', {
            GoogleSheetDB: { waitGoogle: vi.fn().mockResolvedValue(undefined) },
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('суммирует execution_time только по своему uuid и только за сегодня', async () => {
        const now = Date.now();
        const yesterday = dayStart() - 24 * 60 * 60 * 1000;
        mockExecRows = [
            { task_id: 'u1', execution_date: String(now), execution_time: '30' },
            { task_id: 'u1', execution_date: String(now), execution_time: '20' },
            { task_id: 'u2', execution_date: String(now), execution_time: '99' },       // чужая задача
            { task_id: 'u1', execution_date: String(yesterday), execution_time: '50' }, // не сегодня
            { task_id: 'u1', execution_date: String(now), execution_time: '' },         // мусор
        ];

        expect(await sumExecutedMinutesToday(store, 'u1')).toBe(50); // 30 + 20
    });

    it('даёт 0, когда за сегодня по задаче нет записей', async () => {
        mockExecRows = [
            { task_id: 'u1', execution_date: String(dayStart() - 24 * 60 * 60 * 1000), execution_time: '40' },
        ];
        expect(await sumExecutedMinutesToday(store, 'u1')).toBe(0);
    });

    it('даёт 0 без spreadsheetId (пустые настройки)', async () => {
        const emptyStore = { getters: { 'settings/allSettings': [] } };
        expect(await sumExecutedMinutesToday(emptyStore, 'u1')).toBe(0);
    });
});
