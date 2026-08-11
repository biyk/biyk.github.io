import {makeTaskDone} from "../tasks.js";
import {setCalendarTestMode} from "../calendar.js";
import {Table} from "../../../../dnd/static/js/db/google.js";

// Сценарий: двойной клик / двойная пауза запускает makeTaskDone дважды.
// Безлимит: каждая пауза = фиксация с наградой, поэтому записей и награды РОВНО две.
// Прогоняется против тестовой копии: на время теста приложение переключается на testId.
export default {
    name: '05.13 Двойное выполнение за день — награда и запись за каждую паузу',
    requiresGapi: true,
    async run(ctx) {
        if (!ctx.testId) return { passed: false, details: 'Нет копии (03 не выполнился)' };

        const store = ctx.$store;
        const originalSettings = store.getters["settings/allSettings"];
        const originalCalc = store.getters["settings/allCalc"];

        const task = {
            task_uuid: 'test-double-' + Date.now(),
            task_title: 'Двойное выполнение ' + Date.now(),
            task_time: 30,
            minutesSpent: 30,
            repeat_index: '1',
            repeat_mode: '0',
            task_sort: '0',
            break_multiplier: 0,
            task_date: Date.now(),
            last_execution: Date.now(),
            start_date: 0,
            task_finish_date: 0,
            number_of_executions: 0,
            money_reward: 0,
            task_description: '',
        };

        setCalendarTestMode(true);
        try {
            // направляем все записи приложения в тестовую копию
            const swapped = originalSettings.map(s => s.code === 'spreadsheetId' ? {...s, value: ctx.testId} : s);
            if (!swapped.some(s => s.code === 'spreadsheetId')) {
                swapped.push({ code: 'spreadsheetId', value: ctx.testId });
            }
            await store.dispatch('settings/setSettings', swapped);
            await store.dispatch('settings/calcSettings', { averageCalc: 2, today: 0, week: 0, month: 0, prevAvg: 0, today_points: 0, h24_time: 0 });

            // задача должна лежать в копии (updateRowByCode пишет по task_title)
            const tasksTable = new Table({ spreadsheetId: ctx.testId, list: 'real_life_tasks' });
            await tasksTable.addRow(task);

            await store.dispatch('todos/initTodos');
            await store.dispatch('hero/initHero');

            const heroBefore = parseFloat(store.getters["hero/getHero"].hero_money) || 0;

            // двойное выполнение — как при двойном клике/двойной паузе
            await makeTaskDone(task, store);
            await makeTaskDone(task, store);

            const exTable = new Table({ spreadsheetId: ctx.testId, list: 'task_executions' });
            const exList = await exTable.getAll({ formated: true, format: 'orm' });
            const mine = exList.filter(r => r.task_id === task.task_uuid);
            const heroAfter = parseFloat(store.getters["hero/getHero"].hero_money) || 0;

            const rewardDelta = heroAfter - heroBefore;
            const ok = mine.length === 2 && Math.round(rewardDelta) === 60;
            return {
                passed: ok,
                details: ok
                    ? `Записей выполнения: ${mine.length}, награда +${rewardDelta} (ожидалось 2 и +60)`
                    : `Записей: ${mine.length}, награда: ${rewardDelta} (ожидалось 2 и +60)`
            };
        } finally {
            try {
                await store.dispatch('settings/setSettings', originalSettings);
                await store.dispatch('settings/calcSettings', originalCalc);
                setCalendarTestMode(false);
                await store.dispatch('todos/initTodos');
                await store.dispatch('hero/initHero');
            } catch (e) {
                console.error('Ошибка восстановления после 05.13:', e);
            }
        }
    }
};
