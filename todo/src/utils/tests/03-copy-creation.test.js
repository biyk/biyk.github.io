export default {
    name: 'Б1.3 Создание копии таблицы',
    requiresGapi: true,
    async run(ctx) {
        const settings = ctx.$store.getters["settings/allSettings"];
        const s = settings.find(x => x.code === "spreadsheetId");
        if (!s) return { passed: false, details: 'spreadsheetId не найден в настройках' };

        console.log('[Б1.3] Исходная таблица:', s.value);

        const name = 'todo-test-copy-' + Date.now();
        console.log('[Б1.3] Создаю копию, имя:', name);
        const resp = await gapi.client.drive.files.copy({ fileId: s.value, name });
        const copyId = resp.result.id;
        console.log('[Б1.3] Копия создана, id:', copyId);
        ctx.setTestId(copyId);

        let exists = false;
        try {
            const info = await gapi.client.drive.files.get({ fileId: copyId });
            exists = !!info.result.id;
            console.log('[Б1.3] Проверка существования: exists=', exists, 'name=', info.result.name);
        } catch (e) {
            console.error('[Б1.3] Ошибка проверки существования:', e);
        }

        const ok = !!copyId && copyId !== s.value && exists;
        console.log('[Б1.3] Итог: ok=', ok);
        return {
            passed: ok,
            details: ok
                ? `Копия ${copyId} создана из ${s.value} и существует`
                : `copyId=${copyId}, существует=${exists}`
        };
    }
};
