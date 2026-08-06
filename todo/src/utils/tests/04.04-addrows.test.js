import {Table} from "../../../../dnd/static/js/db/google.js";
import {generateUUIDv4} from "../../utils/uuid.js";

export default {
    name: 'Б1.4.4 addRows без дублей',
    requiresGapi: true,
    async run(ctx) {
        if (!ctx.testId) return { passed: false, details: 'Нет копии (Б1.3 не выполнился)' };
        const table = new Table({ spreadsheetId: ctx.testId, list: 'real_life_tasks' });

        const ts = Date.now();
        const titles = [0, 1, 2, 3, 4].map(i => `test-addrows-${ts}-${i}`);
        console.log('[Б1.4.4] Добавляю пакет из', titles.length, 'задач');
        await table.addRows(titles.map(t => ({ task_title: t, task_time: '1', task_uuid: generateUUIDv4() })));

        const rows = await table.getAll({ formated: true, format: 'orm' });
        const bad = titles.filter(t => rows.filter(r => r.task_title === t).length !== 1);
        console.log('[Б1.4.4] Некорректных названий:', bad.length);
        return {
            passed: bad.length === 0,
            details: bad.length === 0
                ? `Все ${titles.length} задач добавлены по одному разу`
                : `Проблемы: ${bad.join(', ')}`
        };
    }
};
