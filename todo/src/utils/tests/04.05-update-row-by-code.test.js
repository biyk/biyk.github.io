import {Table} from "../../../../dnd/static/js/db/google.js";

export default {
    name: 'Б1.4.5 updateRowByCode — обновляет, не добавляет (фикс #9)',
    requiresGapi: true,
    async run(ctx) {
        if (!ctx.testId) return { passed: false, details: 'Нет копии (Б1.3 не выполнился)' };
        const table = new Table({ spreadsheetId: ctx.testId, list: 'real_life_hero' });

        const code = 'test-code-' + Date.now();
        console.log('[Б1.4.5] Добавляю строку hero:', code, '= 1');
        await table.addRow({ code, value: '1' });

        console.log('[Б1.4.5] updateRowByCode:', code, '→ 2');
        const updated = await table.updateRowByCode(code, { code, value: '2' });

        const rows = await table.getAll({ formated: true, format: 'orm' });
        const matches = rows.filter(r => r.code === code);
        console.log('[Б1.4.5] Найдено строк:', matches.length, 'значение:', matches.length ? matches[0].value : '-');
        const ok = updated === true && matches.length === 1 && String(matches[0].value) === '2';
        return {
            passed: ok,
            details: ok
                ? `Строка обновлена, дублей нет (${code} = 2)`
                : `updated=${updated}, строк=${matches.length}, value=${matches.length ? matches[0].value : '-'}`
        };
    }
};
