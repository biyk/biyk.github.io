import {Table} from "../../../../dnd/static/js/db/google.js";
import {generateUUIDv4} from "../../utils/uuid.js";

export default {
    name: 'Б1.4.7 Сериализация записей (фикс #15)',
    requiresGapi: true,
    async run(ctx) {
        if (!ctx.testId) return { passed: false, details: 'Нет копии (Б1.3 не выполнился)' };
        const table = new Table({ spreadsheetId: ctx.testId, list: 'real_life_tasks' });

        const ts = Date.now();
        const titles = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => `test-serial-${ts}-${i}`);
        console.log('[Б1.4.7] Параллельно добавляю', titles.length, 'задач');
        await Promise.all(titles.map(t => table.addRow({ task_title: t, task_time: '1', task_uuid: generateUUIDv4() })));

        const rows = await table.getAll({ formated: true, format: 'orm' });
        const present = titles.filter(t => rows.filter(r => r.task_title === t).length === 1);
        const missing = titles.length - present.length;
        console.log('[Б1.4.7] Записалось', present.length, 'из', titles.length);
        return {
            passed: missing === 0,
            details: missing === 0
                ? `Все ${titles.length} записей сохранены (FIFO без потерь)`
                : `Потеряно записей: ${missing} из ${titles.length}`
        };
    }
};
