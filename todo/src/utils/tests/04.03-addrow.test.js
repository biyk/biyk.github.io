import {Table} from "../../../../dnd/static/js/db/google.js";
import {generateUUIDv4} from "../../utils/uuid.js";

export default {
    name: 'Б1.4.3 addRow без дублей',
    requiresGapi: true,
    async run(ctx) {
        if (!ctx.testId) return { passed: false, details: 'Нет копии (Б1.3 не выполнился)' };
        const table = new Table({ spreadsheetId: ctx.testId, list: 'real_life_tasks' });

        const title = 'test-addrow-' + Date.now();
        console.log('[Б1.4.3] Добавляю задачу:', title);
        await table.addRow({ task_title: title, task_time: '1', task_uuid: generateUUIDv4() });

        const rows = await table.getAll({ formated: true, format: 'orm' });
        const matches = rows.filter(r => r.task_title === title);
        console.log('[Б1.4.3] Строк с этим названием:', matches.length);
        return {
            passed: matches.length === 1,
            details: matches.length === 1
                ? `Строка добавлена один раз (${title})`
                : `Найдено ${matches.length} строк вместо 1`
        };
    }
};
