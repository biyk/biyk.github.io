const modules = import.meta.glob('./*.test.js', { eager: true });

async function ensureGapi() {
    const start = Date.now();
    while (!gapi.client.drive || !gapi.client.sheets || !gapi.client.calendar) {
        if (Date.now() - start > 10000) throw new Error('Google API (sheets/drive/calendar) не загружен');
        if (!gapi.client.sheets) { try { await gapi.client.load('sheets', 'v4'); } catch (e) {} }
        if (!gapi.client.drive) { try { await gapi.client.load('drive', 'v3'); } catch (e) {} }
        if (!gapi.client.calendar) { try { await gapi.client.load('calendar', 'v3'); } catch (e) {} }
        if (!gapi.client.drive || !gapi.client.sheets || !gapi.client.calendar) await new Promise(r => setTimeout(r, 250));
    }
}

export async function runTests(ctx = {}, onResult = () => {}) {
    let testId = null;
    for (const [path, mod] of Object.entries(modules)) {
        const test = mod.default;
        try {
            if (test.requiresGapi) await ensureGapi();
            console.log(`▶ Запущен тест «${test.name}»`);
            const runCtx = Object.create(ctx);
            runCtx.testId = testId;
            runCtx.setTestId = (id) => { testId = id; };
            const res = await test.run(runCtx);
            console.log(`   Итог: ${res.passed ? '✅' : '❌'} ${res.details}`);
            onResult({ name: test.name, ...res });
        } catch (e) {
            const details = 'Ошибка: ' + (e.message || JSON.stringify(e) || e);
            console.error(`   💥 ${details}`);
            onResult({ name: test.name, passed: false, details });
        }
    }
}
