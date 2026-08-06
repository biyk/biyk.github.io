export default {
    name: 'Б1.6 Уборка копии',
    requiresGapi: true,
    async run(ctx) {
        if (!ctx.testId) return { passed: false, details: 'Нечего убирать (Б1.3 не выполнился)' };
        const copyId = ctx.testId;
        console.log('[Б1.6] Убираю копию:', copyId);

        let existed = false;
        try {
            const info = await gapi.client.drive.files.get({ fileId: copyId });
            existed = !!info.result.id;
            console.log('[Б1.6] До удаления копия существует:', existed);
        } catch (e) {
            console.error('[Б1.6] Ошибка проверки существования:', e);
        }

        console.log('[Б1.6] Удаляю копию:', copyId);
        try {
            await gapi.client.drive.files.delete({ fileId: copyId });
            console.log('[Б1.6] Запрос удаления отправлен');
        } catch (e) {
            console.error('[Б1.6] Ошибка удаления:', e);
        }

        let gone = true;
        try {
            await gapi.client.drive.files.get({ fileId: copyId });
            gone = false;
            console.log('[Б1.6] Копия всё ещё существует (проблема)');
        } catch (e) {
            console.log('[Б1.6] Копия удалена, get вернул ошибку:', e.status || (e.result && e.result.error && e.result.error.code) || e);
        }

        const missingId = 'nonexistent_' + Date.now();
        let delErr = null;
        console.log('[Б1.6] Удаляю несуществующий файл:', missingId);
        try {
            await gapi.client.drive.files.delete({ fileId: missingId });
            console.log('[Б1.6] Несуществующий файл удалился без ошибки');
        } catch (e) {
            delErr = e;
            console.log('[Б1.6] Несуществующий файл вернул ошибку: status=', e.status, 'code=', e.result && e.result.error && e.result.error.code);
        }

        const isNotFound = delErr && (delErr.status === 404 || (delErr.result && delErr.result.error && delErr.result.error.code === 404));
        const noUnexpectedError = delErr === null || isNotFound;
        const ok = existed && gone && noUnexpectedError;
        console.log('[Б1.6] Итог: existed=', existed, 'gone=', gone, 'noUnexpectedError=', noUnexpectedError);

        return {
            passed: ok,
            details: ok
                ? 'Копия удалена; удаление несуществующей вернуло 404/ничего'
                : `existed=${existed}, gone=${gone}, неожиданная ошибка при удалении несуществующей: ${delErr ? (delErr.status || delErr.message) : 'нет'}`
        };
    }
};
