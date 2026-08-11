import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import TodoList from '@/components/TodoList.vue';

const mocks = vi.hoisted(() => ({
    makeTaskDone: vi.fn(),
    calcExecutions: vi.fn(),
    listEvents: vi.fn(),
    addEvent: vi.fn(),
    updateEvent: vi.fn(),
    deleteEvent: vi.fn(),
}));

vi.mock('@/utils/tasks.js', () => ({
    makeTaskDone: mocks.makeTaskDone,
    calcExecutions: mocks.calcExecutions,
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

// Регрессия: двойной клик по ✅/⏹ давал двойную награду — кнопка не блокировалась,
// т.к. мгновенная мутация completed в стейте была убрана рефактором под Vuex strict.
function makeTodo(overrides = {}) {
    return {
        task_uuid: 'uuid-test-1',
        task_title: 'Тестовая задача',
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

// flush без setTimeout (fake-timers не дают сработать реальному setTimeout из flushPromises)
async function flushMicrotasks() {
    for (let i = 0; i < 30; i++) {
        await Promise.resolve();
    }
}

async function mountList(todos) {
    mocks.listEvents.mockResolvedValue([]);
    mocks.calcExecutions.mockResolvedValue({ today: 0, week: 0, month: 0, averageCalc: 0, prevAvg: 0, today_points: 0, h24_time: 0 });
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

describe('busy-лок в TodoList', () => {
    it('повторный клик по ✅ не вызывает двойное выполнение, кнопки скрыты на время работы', async () => {
        const todo = makeTodo();
        const { wrapper } = await mountList([todo]);

        let resolveDone;
        mocks.makeTaskDone.mockReturnValue(new Promise((r) => { resolveDone = r; }));

        const doneBtn = wrapper.find('.done');
        expect(doneBtn.exists()).toBe(true);

        await doneBtn.trigger('click');
        await wrapper.vm.$nextTick();

        // кнопки заблокированы, пока задача выполняется
        expect(wrapper.find('.buttons').exists()).toBe(false);

        // повторный клик (прямой вызов метода) игнорируется
        await wrapper.vm.toggleTodo(todo);
        await wrapper.vm.$nextTick();

        expect(mocks.addEvent).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(300);
        await flushMicrotasks();
        expect(mocks.makeTaskDone).toHaveBeenCalledTimes(1);

        // после завершения блокировка снимается
        resolveDone();
        await flushMicrotasks();
        await wrapper.vm.$nextTick();
        expect(wrapper.find('.buttons').exists()).toBe(true);
    });

    it('блокировка снимается даже при ошибке выполнения', async () => {
        const todo = makeTodo();
        const { wrapper } = await mountList([todo]);

        mocks.makeTaskDone.mockRejectedValue(new Error('boom'));
        vi.spyOn(console, 'error').mockImplementation(() => {});

        await wrapper.find('.done').trigger('click');
        await wrapper.vm.$nextTick();
        expect(wrapper.find('.buttons').exists()).toBe(false);

        vi.advanceTimersByTime(300);
        await flushMicrotasks();
        await wrapper.vm.$nextTick();
        expect(wrapper.find('.buttons').exists()).toBe(true);
    });

    it('двойная пауза: toggleTodo выполняется один раз, finish_date пишется один раз', async () => {
        const todo = makeTodo({ start_date: Date.now(), task_finish_date: 0 });
        const { wrapper, store } = await mountList([todo]);

        let resolveDone;
        mocks.makeTaskDone.mockReturnValue(new Promise((r) => { resolveDone = r; }));

        await wrapper.vm.pauseTask(todo);
        await wrapper.vm.pauseTask(todo);
        await wrapper.vm.$nextTick();

        expect(mocks.addEvent).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(600);
        await flushMicrotasks();

        const updateDispatches = store.dispatch.mock.calls.filter(c => c[0] === 'todos/updateTodo');
        expect(updateDispatches.length).toBe(1);

        expect(mocks.makeTaskDone).toHaveBeenCalledTimes(1);

        resolveDone();
        await flushMicrotasks();
        await wrapper.vm.$nextTick();
        expect(wrapper.find('.buttons').exists()).toBe(true);
    });

    it('повторная отметка уже выполненной задачи (событие colorId=7) выполняется снова (безлимит)', async () => {
        const todo = makeTodo();
        const { wrapper } = await mountList([todo]);

        mocks.listEvents.mockResolvedValue([
            { id: 'ev1', summary: todo.task_title, description: todo.task_uuid, colorId: '7' },
        ]);

        const started = await wrapper.vm.toggleTodo(todo);
        await wrapper.vm.$nextTick();

        // задача выполняется повторно — существующее событие обновляется, дубль-события нет
        expect(started).toBe(true);
        expect(mocks.addEvent).not.toHaveBeenCalled();
        expect(mocks.updateEvent).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(300);
        await flushMicrotasks();
        expect(mocks.makeTaskDone).toHaveBeenCalledTimes(1);

        // после завершения блокировка снимается, кнопки снова доступны
        await wrapper.vm.$nextTick();
        expect(wrapper.find('.buttons').exists()).toBe(true);
    });

    it('пауза запущенной задачи, уже выполненной сегодня (colorId=7): задача завершается повторно, событие обновляется', async () => {
        const todo = makeTodo({ start_date: Date.now(), task_finish_date: 0 });
        const { wrapper } = await mountList([todo]);

        mocks.listEvents.mockResolvedValue([
            { id: 'ev1', summary: todo.task_title, description: todo.task_uuid, colorId: '7' },
        ]);

        await wrapper.vm.pauseTask(todo);
        await wrapper.vm.$nextTick();

        // останавливать запущенную задачу можно — существующее событие colorId=7 обновляется
        expect(mocks.addEvent).not.toHaveBeenCalled();
        expect(mocks.updateEvent).toHaveBeenCalledTimes(1);

        // makeTaskDone вызывается повторно (безлимит: каждая пауза = фиксация с наградой)
        vi.advanceTimersByTime(300);
        await flushMicrotasks();
        expect(mocks.makeTaskDone).toHaveBeenCalledTimes(1);

        // пауза добивает finish_date=1/start_date=0 (таймер остановлен) — ровно одна запись
        vi.advanceTimersByTime(600);
        await flushMicrotasks();
        const updateDispatches = wrapper.vm.$store.dispatch.mock.calls.filter(c => c[0] === 'todos/updateTodo');
        expect(updateDispatches.length).toBe(1);
        const lastUpdate = updateDispatches[0][1];
        expect(lastUpdate.task_finish_date).toBe(1);
        expect(lastUpdate.start_date).toBe(0);
    });
});
