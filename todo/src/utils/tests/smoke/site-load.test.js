import { beforeAll, afterAll, test, expect } from 'vitest'
import { spawn } from 'node:child_process'
import { fileURLToPath, URL } from 'node:url'
import { chromium } from 'playwright'

const PORT = 4173
const BASE_URL = `http://localhost:${PORT}/`
const srcDir = fileURLToPath(new URL('../../../', import.meta.url))

let server = null
let browser = null

function waitForServer(url, timeoutMs = 30000) {
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve, reject) => {
        const tick = async () => {
            try {
                const res = await fetch(url);
                if (res.ok) return resolve();
            } catch { /* сервер ещё не поднялся */ }
            if (Date.now() > deadline) return reject(new Error(`preview server не поднялся за ${timeoutMs}мс: ${url}`));
            setTimeout(tick, 300);
        };
        tick();
    });
}

beforeAll(async () => {
    server = spawn(process.execPath, [
        fileURLToPath(new URL('../../../node_modules/vite/bin/vite.js', import.meta.url)),
        'preview', '--port', String(PORT), '--strictPort'
    ], { cwd: srcDir, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    server.stdout.on('data', (d) => (log += d));
    server.stderr.on('data', (d) => (log += d));
    server.on('exit', (code) => { if (code && code !== 0) console.error('preview exit', code, log); });
    await waitForServer(BASE_URL);
});

afterAll(async () => {
    if (browser) await browser.close();
    if (server) server.kill();
});

test('сайт загружается без JS-ошибок (ReferenceError/throw) и приложение монтируется', async () => {
    browser = await chromium.launch();
    const page = await browser.newPage();

    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    // Даём приложению время на загрузку модулей и монтирование #app
    await page.waitForTimeout(4000);

    const appChildren = await page.locator('#app').evaluate((el) => el.childElementCount);
    const headerTime = await page.locator('h1').textContent();

    expect(pageErrors, `pageerror:\n${pageErrors.join('\n')}`).toEqual([]);
    // Отфильтровываем ошибки загрузки ресурсов (gapi/скрипты Google могут не доехать) — ловим только JS-ошибки
    const jsErrors = consoleErrors.filter((e) => /(?:ReferenceError|TypeError|SyntaxError|is not defined|before initialization)/.test(e));
    expect(jsErrors, `console errors:\n${jsErrors.join('\n')}`).toEqual([]);
    expect(appChildren).toBeGreaterThan(0);
    // Время в шапке — русская локализация (дд.мм.гггг, чч:мм:сс), а не локаль браузера (en)
    expect(headerTime, `header time: ${headerTime}`).toMatch(/\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}:\d{2}/);
}, 120000);
