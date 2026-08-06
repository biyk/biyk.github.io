export default {
    name: 'Б1.4.2 Счётчики строк — первая колонка листов без дублей',
    requiresGapi: true,
    async run(ctx) {
        if (!ctx.testId) return { passed: false, details: 'Нет копии (Б1.3 не выполнился)' };
        const copyId = ctx.testId;
        console.log('[Б1.4.2] Проверяю первые колонки копии:', copyId);

        const tabs = ['real_life_tasks', 'task_executions', 'real_life_hero', 'real_life_rewards', 'rewards_history'];
        const problems = [];
        for (const tab of tabs) {
            const r = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: copyId, range: tab + '!A:A' });
            const values = (r.result.values || []).slice(1).map(v => v[0]).filter(v => v !== undefined && v !== null && v !== '');
            const dups = [...new Set(values.filter((v, i) => values.indexOf(v) !== i))];
            console.log(`[Б1.4.2] «${tab}»: строк данных=${values.length}, дублей в первой колонке=${dups.length}`);
            if (dups.length) problems.push(`${tab}: ${dups.slice(0, 5).join(', ')}`);
        }

        const ok = problems.length === 0;
        console.log('[Б1.4.2] Итог: ok=', ok);
        return {
            passed: ok,
            details: ok
                ? 'Первые колонки всех 5 листов без дублей'
                : 'Дубли в первой колонке: ' + problems.join('; ')
        };
    }
};
