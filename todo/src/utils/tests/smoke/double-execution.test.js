import { beforeAll, afterAll, test, expect } from 'vitest'
import { spawn } from 'node:child_process'
import { fileURLToPath, URL } from 'node:url'
import { chromium } from 'playwright'

// Smoke-тест сценария «двойная отметка задачи»:
// загружает собранное приложение (vite preview) в консольном Chromium,
// подменяет gapi и GoogleSheetDB на in-memory заглушки с тестовыми данными,
// и проверяет, что повторные отметки/паузы дают по одной записи и награде (безлимит),
// а busy-лок блокирует только случайный двойной клик в рамках одного действия.

const PORT = 4174
const BASE_URL = `http://localhost:${PORT}/`
const srcDir = fileURLToPath(new URL('../../../', import.meta.url))

const SMOKE_INIT = `
    const now = Date.now();

    const TASKS_HEADER = ['task_title','task_time','task_description','task_uuid','task_sort','task_color','start_date','task_date','repeat_index','repeat_days_of_week','repeat_mode','date_mode','money_reward','break_multiplier','task_finish_date','number_of_executions','excludes','task_before','task_after','last_execution'];
    const EXEC_HEADER = ['execution_id','execution_date','execution_time','gained_gold','task_title','task_id','task_date'];

    window.__smoke = {
        sheets: {
            'test-id::real_life_tasks': {
                header: TASKS_HEADER,
                rows: [[
                    'Глобальные задачи', '30', 'smoke: двойная отметка', 'test-uuid-1',
                    '98.28', '0', '0', String(now), '1', '0', '0', '0', '0', '0',
                    '0', '0', '', '', '', String(now)
                ]]
            },
            'test-id::real_life_hero': {
                header: ['code', 'value'],
                rows: [['hero_money', '100']]
            },
            'test-id::task_executions': {
                header: EXEC_HEADER,
                rows: []
            },
        },
        events: [],
        counts: { values_get: 0, values_append: 0, values_update: 0, events_list: 0, events_insert: 0 },
    };

    const tableValues = (spreadsheetId, list) => {
        const s = window.__smoke.sheets[spreadsheetId + '::' + list];
        return s ? [s.header, ...s.rows] : [];
    };

    window.GoogleSheetDB = new (class {
        async waitGoogle() {}
        expired() { return false; }
        async fetchSheetValues({ spreadsheetId, range }) {
            window.__smoke.counts.values_get++;
            return tableValues(spreadsheetId, String(range).split('!')[0]);
        }
    })();

    window.gapi = {
        client: {
            sheets: {
                spreadsheets: {
                    async get() { return { result: { sheets: [] } }; },
                    async batchUpdate() { return { result: { replies: [] } }; },
                    async create() { return { result: { spreadsheetId: 'test-id' } }; },
                    values: {
                        async get({ spreadsheetId, range }) {
                            window.__smoke.counts.values_get++;
                            const list = String(range).split('!')[0];
                            return { result: { values: tableValues(spreadsheetId, list) } };
                        },
                        async append({ spreadsheetId, range, resource }) {
                            window.__smoke.counts.values_append++;
                            const list = String(range).split('!')[0];
                            const s = window.__smoke.sheets[spreadsheetId + '::' + list];
                            if (s && resource && resource.values) s.rows.push(...resource.values);
                            return { result: { updates: { updatedRows: resource.values.length } } };
                        },
                        async update({ spreadsheetId, range, resource }) {
                            window.__smoke.counts.values_update++;
                            const parts = String(range).split('!');
                            const list = parts[0];
                            const rowNum = parseInt(parts[1].replace(/\\D+/g, ''), 10);
                            const s = window.__smoke.sheets[spreadsheetId + '::' + list];
                            if (s && resource && resource.values && resource.values[0]) {
                                s.rows[rowNum - 2] = resource.values[0];
                            }
                            return { result: { updatedRows: 1 } };
                        }
                    }
                }
            },
            calendar: {
                events: {
                    async list() {
                        window.__smoke.counts.events_list++;
                        return { result: { items: window.__smoke.events } };
                    },
                    async insert({ resource }) {
                        window.__smoke.counts.events_insert++;
                        const ev = Object.assign({}, resource, {
                            id: 'smoke-event-' + window.__smoke.counts.events_insert,
                            status: 'confirmed'
                        });
                        window.__smoke.events.push(ev);
                        return { result: ev };
                    },
                    async update({ eventId, resource }) {
                        const i = window.__smoke.events.findIndex(e => e.id === eventId);
                        if (i !== -1) window.__smoke.events[i] = Object.assign({}, resource, { id: eventId });
                        return { result: {} };
                    },
                    async delete({ eventId }) {
                        const i = window.__smoke.events.findIndex(e => e.id === eventId);
                        if (i !== -1) window.__smoke.events.splice(i, 1);
                        return { result: {} };
                    }
                }
            }
        }
    };

    localStorage.setItem('todo-settings', JSON.stringify([
        { code: 'spreadsheetId', value: 'test-id' }
    ]));
`

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

test('двойная отметка задачи в UI: двойной клик = одна запись, повторные отметки/паузы = по одной записи и награде', async () => {
    browser = await chromium.launch();
    const page = await browser.newPage();

    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.addInitScript(SMOKE_INIT);

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    // Монтирование + calcExecutions (пустая task_executions вырождает averageCalc в 0.71)
    await page.waitForTimeout(4000);

    // Переключаем фильтр на «Все», чтобы задача с start_date=0 стала видна
    await page.locator('.el-radio-group .el-radio-button', { hasText: 'Все' }).click();

    const done = page.locator('.task .done');
    await done.first().waitFor({ state: 'visible', timeout: 10000 });

    const h1Before = await page.locator('h1').textContent();
    expect(h1Before, `h1: ${h1Before}`).toContain('100');

    // Быстрый двойной клик по ✅ (два клика в одном тике — второй блокируется busy-локом)
    await page.evaluate(() => {
        const el = document.querySelector('.task .done');
        el.click();
        el.click();
    });

    // Ждём завершения цепочки: setTimeout(300) + makeTaskDone + calcExecutions + initTodos
    await page.waitForTimeout(5000);

    // Часть A: первый клик отработал ровно один раз
    let snap = await page.evaluate(() => ({
        eventsInsert: window.__smoke.counts.events_insert,
        events: window.__smoke.events.length,
        eventColor: window.__smoke.events[0] ? window.__smoke.events[0].colorId : null,
        executions: window.__smoke.sheets['test-id::task_executions'].rows.length,
        execRow: window.__smoke.sheets['test-id::task_executions'].rows[0] || [],
        hero: window.__smoke.sheets['test-id::real_life_hero'].rows,
    }));

    expect(snap.eventsInsert).toBe(1);
    expect(snap.events).toBe(1);
    expect(snap.eventColor).toBe('7');
    expect(snap.executions).toBe(1);
    expect(snap.execRow[5]).toBe('test-uuid-1');

    // Награда = минуты * среднее / 2 (с пустой task_executions averageCalc вырождается в 0.71).
    // Инвариант: начислено ровно столько, сколько записано в строке выполнения, к hero прибавилось один раз.
    const gold = Number(snap.execRow[3]);
    expect(gold).toBeGreaterThan(0);
    expect(snap.hero[0][0]).toBe('hero_money');
    expect(Math.abs(Number(snap.hero[0][1]) - (100 + gold))).toBeLessThan(0.0001);

    const h1AfterFirst = await page.locator('h1').textContent();
    const moneyInH1 = (text) => (text.match(/(\d+)\s*\(/)?.[1] || '').trim();
    const expectedMoney = String(Math.round(parseFloat(Number(snap.hero[0][1]))));
    expect(moneyInH1(h1AfterFirst), `h1: ${h1AfterFirst}`).toBe(expectedMoney);
    expect(moneyInH1(h1AfterFirst)).not.toBe(moneyInH1(h1Before));

    // Часть B: поле не «заблокировалось» — кнопка снова видна (completed не хранится в таблице),
    // пользователь отмечает задачу ещё раз. Безлимит: каждая отметка = новая запись + награда.
    await done.first().click();

    await page.waitForTimeout(5000);

    snap = await page.evaluate(() => ({
        eventsInsert: window.__smoke.counts.events_insert,
        events: window.__smoke.events.length,
        executions: window.__smoke.sheets['test-id::task_executions'].rows.length,
        hero: window.__smoke.sheets['test-id::real_life_hero'].rows,
        execRows: window.__smoke.sheets['test-id::task_executions'].rows,
        taskExecCount: window.__smoke.sheets['test-id::real_life_tasks'].rows[0][15],
    }));

    // событие не дублируется (обновляется существующее), но выполнение и награда прибавляются
    expect(snap.eventsInsert).toBe(1);
    expect(snap.events).toBe(1);
    expect(snap.executions).toBe(2);
    expect(Number(snap.taskExecCount)).toBe(2);

    // hero = 100 + сумма всех gained_gold записанных выполнений
    const totalGoldB = snap.execRows.reduce((s, r) => s + Number(r[3]), 0);
    expect(Math.abs(Number(snap.hero[0][1]) - (100 + totalGoldB))).toBeLessThan(0.0001);

    const h1AfterSecond = await page.locator('h1').textContent();
    expect(moneyInH1(h1AfterSecond), `h1: ${h1AfterSecond}`).toBe(String(Math.round(100 + totalGoldB)));

    // Часть C: пользователь снова запускает задачу (▶️), таймер идёт, затем жмёт ⏸.
    // Пауза = очередная фиксация с наградой (безлимит), событие обновляется, а не дублируется.
    await page.locator('.task .start').click();
    await page.waitForTimeout(1200); // даём таймеру пойти

    // кнопка стала ⏸ (задача запущена)
    await page.locator('.task .pause').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('.task .pause').click();

    // завершение (300мс) + пауза-таймер (600мс) + записи
    await page.waitForTimeout(5000);

    snap = await page.evaluate(() => {
        const taskRow = window.__smoke.sheets['test-id::real_life_tasks'].rows[0] || [];
        return {
            eventsInsert: window.__smoke.counts.events_insert,
            events: window.__smoke.events.length,
            executions: window.__smoke.sheets['test-id::task_executions'].rows.length,
            hero: window.__smoke.sheets['test-id::real_life_hero'].rows,
            execRows: window.__smoke.sheets['test-id::task_executions'].rows,
            taskStartDate: taskRow[6],
            taskFinishDate: taskRow[14],
            executionsCount: taskRow[15],
        };
    });

    // задача остановлена: таймер сброшен (start_date=0), пауза добила finish_date=1
    expect(String(snap.taskStartDate)).toBe('0');
    expect(String(snap.taskFinishDate)).toBe('1');
    // выполнение засчитано (номер увеличился)...
    expect(Number(snap.executionsCount)).toBe(3);
    // ...событие обновляется, но не дублируется; каждая пауза = новая запись и награда
    expect(snap.eventsInsert).toBe(1);
    expect(snap.events).toBe(1);
    expect(snap.executions).toBe(3);

    const totalGoldC = snap.execRows.reduce((s, r) => s + Number(r[3]), 0);
    expect(Math.abs(Number(snap.hero[0][1]) - (100 + totalGoldC))).toBeLessThan(0.0001);

    const h1AfterPause = await page.locator('h1').textContent();
    expect(moneyInH1(h1AfterPause), `h1: ${h1AfterPause}`).toBe(String(Math.round(100 + totalGoldC)));

    expect(pageErrors, `pageerror:\n${pageErrors.join('\n')}`).toEqual([]);
    const jsErrors = consoleErrors.filter((e) => /(?:ReferenceError|TypeError|SyntaxError|is not defined|before initialization|\[vuex\] do not mutate vuex store state)/i.test(e));
    expect(jsErrors, `console errors:\n${jsErrors.join('\n')}`).toEqual([]);
}, 120000);
