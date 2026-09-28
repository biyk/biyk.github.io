import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Дочерние компоненты и фоновый агент в этом тесте не нужны — проверяем только обвязку отсчёта в App.vue
vi.mock('@/components/TodoList.vue', () => ({ default: { name: 'TodoList' } }));
vi.mock('@/components/TodoNew.vue', () => ({ default: { name: 'TodoNew' } }));
vi.mock('@/components/Settings.vue', () => ({ default: { name: 'Settings' } }));
vi.mock('@/components/Shop.vue', () => ({ default: { name: 'Shop' } }));
vi.mock('@/agents/taskAgent.js', () => ({ startTaskAgent: vi.fn(), stopTaskAgent: vi.fn() }));
vi.mock('@/utils/tasks.js', () => ({ calcExecutions: vi.fn().mockResolvedValue({}) }));

import App from '@/App.vue';

// google.js пишет в localStorage gapi_token_expires абсолютный unix-time (в секундах)
const NOW_MS = new Date('2026-09-28T12:00:00Z').getTime();
const NOW_SEC = Math.floor(NOW_MS / 1000);

function makeVm() {
    return {
        signoutLabel: null,
        $store: { dispatch: vi.fn() },
        renderAuthCountdown: App.methods.renderAuthCountdown,
    };
}

function makeButton(label = '') {
    const button = document.createElement('button');
    button.id = 'signout_button';
    button.textContent = label;
    document.body.appendChild(button);
    return button;
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);
    localStorage.removeItem('gapi_token_expires');
});

afterEach(() => {
    vi.useRealTimers();
    localStorage.removeItem('gapi_token_expires');
    document.body.innerHTML = '';
    vi.restoreAllMocks();
});

describe('отсчёт остатка авторизации в кнопке Sign Out (App.vue)', () => {
    it('показывает остаток в минутах и секундах, сохраняя подпись кнопки', () => {
        const button = makeButton();
        localStorage.setItem('gapi_token_expires', String(NOW_SEC + 3252));

        makeVm().renderAuthCountdown();

        expect(button.textContent).toBe('54:12');
    });

    it('тикает раз в секунду после монтирования и останавливается при размонтировании', async () => {
        const button = makeButton();
        const vm = makeVm();
        localStorage.setItem('gapi_token_expires', String(NOW_SEC + 120));

        await App.mounted.call(vm);
        expect(button.textContent).toBe('02:00');

        vi.advanceTimersByTime(1000);
        expect(button.textContent).toBe('01:59');

        App.beforeUnmount.call(vm);
        vi.advanceTimersByTime(5000);
        expect(button.textContent).toBe('01:59');
    });

    it('перечитывает localStorage: google.js продлил токен — цифра растёт', async () => {
        const button = makeButton();
        const vm = makeVm();
        localStorage.setItem('gapi_token_expires', String(NOW_SEC + 120));

        await App.mounted.call(vm);
        localStorage.setItem('gapi_token_expires', String(NOW_SEC + 3600));
        vi.advanceTimersByTime(1000);

        expect(button.textContent).toBe('59:59');
    });

    it('повторный рендер не наращивает цифру к цифре', () => {
        const button = makeButton();
        const vm = makeVm();
        localStorage.setItem('gapi_token_expires', String(NOW_SEC + 3252));

        vm.renderAuthCountdown();
        vi.setSystemTime((NOW_SEC + 60) * 1000);
        vm.renderAuthCountdown();

        expect(button.textContent).toBe('53:12');
    });

    it('протухший токен — нули', () => {
        const button = makeButton();
        localStorage.setItem('gapi_token_expires', String(NOW_SEC - 60));

        makeVm().renderAuthCountdown();

        expect(button.textContent).toBe('00:00');
    });

    it('без токена — только исходная надпись кнопки', () => {
        const button = makeButton();

        makeVm().renderAuthCountdown();

        expect(button.textContent).toBe('');
    });

    it('нет кнопки — не падает', () => {
        localStorage.setItem('gapi_token_expires', String(NOW_SEC + 120));

        expect(() => makeVm().renderAuthCountdown()).not.toThrow();
    });
});
