import {Table} from "../../../../dnd/static/js/db/google.js";
import {generateUUIDv4} from "../../utils/uuid.js";

export default {
    name: 'Б1.4.8 Кэш колонок по кастомному id (фикс #16)',
    requiresGapi: true,
    async run(ctx) {
        if (!ctx.testId) return { passed: false, details: 'Нет копии (Б1.3 не выполнился)' };
        const settings = ctx.$store.getters["settings/allSettings"];
        const s = settings.find(x => x.code === "spreadsheetId");
        if (!s) return { passed: false, details: 'spreadsheetId не найден' };
        const origId = s.value;

        const seedKey = origId + '/real_life_tasks/columns';
        console.log('[Б1.4.8] Подкладываю чужой кэш колонок под id оригинала:', origId);
        sessionStorage.setItem(seedKey, JSON.stringify(['wrong_col_a', 'wrong_col_b', 'wrong_col_c', 'wrong_col_d', 'wrong_col_e']));
        try {
            const table = new Table({ spreadsheetId: ctx.testId, list: 'real_life_tasks' });
            const title = 'test-customid-' + Date.now();
            console.log('[Б1.4.8] Добавляю задачу в копию:', ctx.testId);
            await table.addRow({ task_title: title, task_time: '5', task_uuid: generateUUIDv4() });

            const rows = await table.getAll({ formated: true, format: 'orm' });
            const matches = rows.filter(r => r.task_title === title);
            console.log('[Б1.4.8] Строк по своим колонкам:', matches.length);
            return {
                passed: matches.length === 1,
                details: matches.length === 1
                    ? 'Строка легла по колонкам копии, чужой кэш не помешал'
                    : `Найдено ${matches.length} строк — кэш оригинала повлиял`
            };
        } finally {
            sessionStorage.removeItem(seedKey);
        }
    }
};
