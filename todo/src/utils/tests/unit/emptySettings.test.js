import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calcExecutions, logExecuteTask } from '@/utils/tasks.js';

// Регрессия: TypeError "Cannot read properties of undefined (reading 'value')",
// когда в настройках нет spreadsheetId (пустые настройки пользователя).
describe('guard при пустых настройках (нет spreadsheetId)', () => {
    const store = {
        getters: {
            'settings/allSettings': [],
        },
    };

    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.stubGlobal('window', {
            GoogleSheetDB: {
                waitGoogle: vi.fn().mockResolvedValue(undefined),
            },
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('calcExecutions возвращает нулевой calc-объект без spreadsheetId', async () => {
        const result = await calcExecutions(store);
        expect(result).toEqual({
            today: 0,
            week: 0,
            month: 0,
            averageCalc: 0,
            prevAvg: null,
            today_points: 0,
            h24_time: 0,
        });
    });

    it('logExecuteTask не падает без spreadsheetId', async () => {
        await expect(logExecuteTask({}, store)).resolves.toBeUndefined();
    });
});
