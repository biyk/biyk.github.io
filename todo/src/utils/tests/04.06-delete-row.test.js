import {Table} from "../../../../dnd/static/js/db/google.js";
import {generateUUIDv4} from "../../utils/uuid.js";

export default {
    name: 'Б1.4.6 deleteRow — удаляет нужную строку',
    requiresGapi: true,
    async run(ctx) {
        if (!ctx.testId) return { passed: false, details: 'Нет копии (Б1.3 не выполнился)' };
        const table = new Table({ spreadsheetId: ctx.testId, list: 'real_life_tasks' });

        const ts = Date.now();
        const titles = ['test-del-A-' + ts, 'test-del-B-' + ts, 'test-del-C-' + ts];
        console.log('[Б1.4.6] Добавляю 3 задачи');
        await table.addRows(titles.map(t => ({ task_title: t, task_time: '1', task_uuid: generateUUIDv4() })));

        const before = await table.getAll({ formated: true, format: 'orm' });
        const bIdx = before.findIndex(r => r.task_title === titles[1]);
        if (bIdx === -1) return { passed: false, details: 'Строка B не найдена перед удалением' };

        console.log('[Б1.4.6] Удаляю строку', bIdx + 1, titles[1]);
        await table.deleteRow(bIdx + 1);

        const after = await table.getAll({ formated: true, format: 'orm' });
        const a = after.filter(r => r.task_title === titles[0]).length;
        const b = after.filter(r => r.task_title === titles[1]).length;
        const c = after.filter(r => r.task_title === titles[2]).length;
        const count = after.length === before.length - 1;
        console.log('[Б1.4.6] A=', a, 'B=', b, 'C=', c, 'строк стало:', after.length, 'было:', before.length);
        const ok = b === 0 && a === 1 && c === 1 && count;
        return {
            passed: ok,
            details: ok
                ? 'Удалена только средняя строка, остальные целы'
                : `A=${a}, B=${b}, C=${c}, счётчик строк корректен=${count}`
        };
    }
};
