export default {
    name: 'Б1.4.1 Шапки листов в копии',
    requiresGapi: true,
    async run(ctx) {
        if (!ctx.testId) return { passed: false, details: 'Нет копии (Б1.3 не выполнился)' };
        const copyId = ctx.testId;
        console.log('[Б1.4.1] Работаю с копией:', copyId);

        const expectedTabs = ['real_life_tasks', 'task_executions', 'real_life_hero', 'real_life_rewards', 'rewards_history'];
        const expectedHeaders = {
            real_life_tasks: ['task_title', 'task_time', 'task_description', 'task_uuid', 'task_sort', 'task_color', 'start_date', 'task_date', 'repeat_index', 'repeat_days_of_week', 'repeat_mode', 'date_mode', 'money_reward', 'break_multiplier', 'task_finish_date', 'number_of_executions', 'excludes', 'task_before', 'task_after', 'last_execution'],
            task_executions: ['execution_id', 'execution_date', 'execution_time', 'gained_gold', 'task_title', 'task_id', 'task_date'],
            real_life_hero: ['code', 'value'],
            real_life_rewards: ['reward_title', 'reward_cost', 'reward_id', 'inventory_items', 'reward_done', 'max_number_of_claims', 'reward_mode', 'reward_favorite', 'reward_cost_step', 'reward_description'],
            rewards_history: ['item_id', 'claim_date', 'gold_spent', 'reward_title', 'reward_id'],
        };

        const meta = await gapi.client.sheets.spreadsheets.get({ spreadsheetId: copyId });
        const tabs = new Set(meta.result.sheets.map(x => x.properties.title));
        console.log('[Б1.4.1] Листы в копии:', Array.from(tabs));

        const missingTabs = expectedTabs.filter(t => !tabs.has(t));
        console.log('[Б1.4.1] Отсутствующие листы:', missingTabs.length ? missingTabs : 'нет');

        const missingHeaders = [];
        for (const tab of expectedTabs) {
            const r = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: copyId, range: tab + '!1:1' });
            const headers = (r.result.values && r.result.values[0]) || [];
            console.log(`[Б1.4.1] Шапка «${tab}»:`, headers);
            const missing = (expectedHeaders[tab] || []).filter(h => !headers.includes(h));
            if (missing.length) missingHeaders.push(`${tab}: ${missing.join(', ')}`);
        }
        console.log('[Б1.4.1] Отсутствующие шапки:', missingHeaders.length ? missingHeaders : 'нет');

        const ok = missingTabs.length === 0 && missingHeaders.length === 0;
        console.log('[Б1.4.1] Итог: ok=', ok);
        return {
            passed: ok,
            details: ok
                ? 'Все 5 листов и их шапки на месте'
                : `нет листов: ${missingTabs.join(', ') || '—'}; нет шапок: ${missingHeaders.join('; ') || '—'}`
        };
    }
};
