import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import TodoList from '@/components/TodoList.vue';

const mocks = vi.hoisted(() => ({
    makeTaskDone: vi.fn(),
    calcExecutions: vi.fn(),
    sumExecutedMinutesToday: vi.fn(),
    listEvents: vi.fn(),
    addEvent: vi.fn(),
    updateEvent: vi.fn(),
    deleteEvent: vi.fn(),
}));

vi.mock('@/utils/tasks.js', () => ({
    makeTaskDone: mocks.makeTaskDone,
    calcExecutions: mocks.calcExecutions,
    sumExecutedMinutesToday: mocks.sumExecutedMinutesToday,
    setTaskCompleted: vi.fn(),
    setTaskToCalendar: vi.fn(),
    taskDate: vi.fn(() => ''),
    taskSort: vi.fn(() => 0),
}));

vi.mock('@/utils/calendar.js', () => ({
    listEvents: mocks.listEvents,
    addEvent: mocks.addEvent,
    updateEvent: mocks.updateEvent,
    deleteEvent: mocks.deleteEvent,
}));

// Фича: «✅ завершено»/«⏹ стоп» по задаче, которая была на паузе, пишет в task_time
// суммарное время за день (источник — журнал task_executions), а не усреднение плана.
function makeTodo(overrides = {}) {
    return {
        task_uuid: 'uuid-sum-1',
        task_title: 'Контрастный душ',
        task_description: 'описание',
        task_time: 30,
        task_date: Date.now(),
        last_execution: Date.now(),
        repeat_index: '1',
        task_sort: '0',
        break_multiplier: 0,
        start_date: 0,
        task_finish_date: 0,
        completed: false,
        money_reward: 10,
        ...overrides,
    };
}

function makeStore(todos) {
    return {
        getters: {
            'todos/getTodos': todos,
            'events/getEvents': [],
            'settings/allCalc': {
                today: 0, week: 0, month: 0, averageCalc: 0, prevAvg: 0, today_points: 0, h24_time: 0,
            },
            'settings/allSettings': [],
        },
        dispatch: vi.fn().mockResolvedValue(undefined),
        commit: vi.fn(),
    };
}

async function flushMicrotasks() {
    for (let i = 0; i < 30; i++) await Promise.resolve();
}

async function mountList(todos) {
    mocks.listEvents.mockResolvedValue([]);
    mocks.calcExecutions.mockResolvedValue({ today: 0, week: 0, month: 0, averageCalc: 0, prevAvg: 0, today_points: 0, h24_time: 0 });
    mocks.sumExecutedMinutesToday.mockResolvedValue(0);
    const store = makeStore(todos);
    const wrapper = mount(TodoList, {
        props: { filter: 'all' },
        global: {
            mocks: { $store: store },
            stubs: { 'el-radio-group': true, 'el-radio-button': true },
        },
    });
    await flushMicrotasks();
    return { wrapper, store };
}

// Достаём аргументы последнего вызова makeTaskDone: [task, store, options]
const doneCall = () => mocks.makeTaskDone.mock.calls[mocks.makeTaskDone.mock.calls.length - 1];

beforeEach(() => {
    vi.useFakeTimers();
    window.GoogleSheetDB = { expired: () => false, waitGoogle: vi.fn().mockResolvedValue(undefined) };
    vi.clearAllMocks();
    mocks.makeTaskDone.mockResolvedValue({});
});

afterEach(() => {
    vi.useRealTimers();
    delete window.GoogleSheetDB;
    vi.restoreAllMocks();
});

describe('task_time = суммарное время за день (журнал) при done/stop', () => {
    it('✅ завершено по задаче из паузы: task_time = сумма журнала за сегодня, без повторной награды', async () => {
        // была на паузе: start_date=0, task_finish_date != 0
        const todo = makeTodo({ start_date: 0, task_finish_date: 1, task_time: 30 });
        const { wrapper } = await mountList([todo]);
        mocks.sumExecutedMinutesToday.mockResolvedValue(75); // за день уже зафиксировано 75 минут

        await wrapper.vm.toggleTodo(todo, 'done');
        await flushMicrotasks();
        vi.advanceTimersByTime(300);
        await flushMicrotasks();

        expect(mocks.sumExecutedMinutesToday).toHaveBeenCalledWith(expect.anything(), todo.task_uuid);
        const [task, , options] = doneCall();
        expect(task.task_time).toBe(75);
        expect(options && options.skipReward).toBe(true);
    });

    it('⏹ стоп запущенной: task_time = журнал за сегодня + текущий отрезок, награда как обычно', async () => {
        // 20 минут в работе
        const start = Date.now() - 20 * 60 * 1000;
        const todo = makeTodo({ start_date: start, task_finish_date: 0, task_time: 10 });
        const { wrapper } = await mountList([todo]);
        mocks.sumExecutedMinutesToday.mockResolvedValue(40); // раньше было 2 паузы по 20 мин

        await wrapper.vm.toggleTodo(todo, 'stop');
        await flushMicrotasks();
        vi.advanceTimersByTime(300);
        await flushMicrotasks();

        const [task, , options] = doneCall();
        expect(task.task_time).toBe(60);        // 40 (журнал) + 20 (текущий отрезок)
        expect(task.minutesSpent).toBe(20);      // событие/награда/журнал = только текущий отрезок
        expect(options && options.skipReward).toBeFalsy();
    });

    it('⏸ пауза сохраняет прежнее усреднение и НЕ читает журнал', async () => {
        const start = Date.now() - 20 * 60 * 1000;
        const todo = makeTodo({ start_date: start, task_finish_date: 0, task_time: 10 });
        const { wrapper } = await mountList([todo]);
        mocks.sumExecutedMinutesToday.mockResolvedValue(40);

        await wrapper.vm.toggleTodo(todo, 'pause');
        await flushMicrotasks();
        vi.advanceTimersByTime(300);
        await flushMicrotasks();

        const [task, , options] = doneCall();
        expect(task.task_time).toBe(15);        // ceil((10 + 20) / 2) — старое поведение
        expect(task.minutesSpent).toBe(20);
        expect(options && options.skipReward).toBeFalsy();
        expect(mocks.sumExecutedMinutesToday).not.toHaveBeenCalled();
    });

    it('✅ завершено по задаче, которую никогда не запускали: план не трогаем, журнал не читаем', async () => {
        const todo = makeTodo({ start_date: 0, task_finish_date: 0, task_time: 30 });
        const { wrapper } = await mountList([todo]);

        await wrapper.vm.toggleTodo(todo, 'done');
        await flushMicrotasks();
        vi.advanceTimersByTime(300);
        await flushMicrotasks();

        const [task, , options] = doneCall();
        expect(task.task_time).toBe(30);        // осталось значение плана
        expect(options && options.skipReward).toBeFalsy();
        expect(mocks.sumExecutedMinutesToday).not.toHaveBeenCalled();
    });

    it('✅ завершено из паузы при пустом журнале: план не затираем нулём и награду не глушим', async () => {
        const todo = makeTodo({ start_date: 0, task_finish_date: 1, task_time: 30 });
        const { wrapper } = await mountList([todo]);
        mocks.sumExecutedMinutesToday.mockResolvedValue(0);

        await wrapper.vm.toggleTodo(todo, 'done');
        await flushMicrotasks();
        vi.advanceTimersByTime(300);
        await flushMicrotasks();

        const [task, , options] = doneCall();
        expect(task.task_time).toBe(30);        // 0 из журнала не перезаписывает план
        expect(options && options.skipReward).toBeFalsy();
    });
});
