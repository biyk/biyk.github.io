import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeTaskDone } from '@/utils/tasks.js';

// date_mode — модификатор-умножитель награды (см. заметку в шапке листа real_life_tasks):
// итоговое начисление = money_reward × date_mode.
// Положительное значение добавляет монетки, отрицательное — отнимает,
// отсутствующее/некорректное ведёт себя как нейтральная единица.
describe('date_mode как множитель награды в makeTaskDone', () => {
    const BASE_REWARD = 30;
    let dispatch;

    const makeStore = () => ({
        getters: {
            'settings/allSettings': [],
            'settings/allCalc': { averageCalc: 2 },
            'hero/getHero': { hero_money: 100 },
        },
        dispatch,
    });

    const makeTask = (date_mode) => ({
        task_uuid: 'u-date-mode',
        task_title: 'Задача про date_mode',
        task_time: 30,
        minutesSpent: 30,
        repeat_index: '1',
        repeat_mode: '0',
        task_sort: '0',
        break_multiplier: 0,
        task_date: Date.now(),
        start_date: 0,
        task_finish_date: 0,
        number_of_executions: 0,
        money_reward: 7,
        ...(date_mode === undefined ? {} : { date_mode }),
    });

    const updatePayload = () => dispatch.mock.calls.find(([name]) => name === 'todos/updateTodo')?.[1];
    const heroPayload = () => dispatch.mock.calls.find(([name]) => name === 'hero/updateHero')?.[1];

    beforeEach(() => {
        dispatch = vi.fn().mockResolvedValue(undefined);
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
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

    it.each([
        ['нейтральный множитель 1', '1', BASE_REWARD],
        ['бонусный множитель 2', '2', 60],
        ['дробный множитель 1.5', '1.5', 45],
        ['штрафной отрицательный -0.5', '-0.5', -15],
        ['отсутствует — деградация к 1', undefined, BASE_REWARD],
        ['пустая строка — деградация к 1', '', BASE_REWARD],
        ['некорректное значение — деградация к 1', 'abc', BASE_REWARD],
    ])('date_mode %s', async (_name, dateMode, expectedReward) => {
        const store = makeStore();
        await makeTaskDone(makeTask(dateMode), store);

        expect(updatePayload()).toBeDefined();
        expect(updatePayload().money_reward).toBeCloseTo(expectedReward, 6);
        expect(heroPayload()).toBeDefined();
        expect(parseFloat(heroPayload().hero_money)).toBeCloseTo(100 + expectedReward, 6);
    });
});
