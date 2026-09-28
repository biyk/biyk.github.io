import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import AuthCountdown from '@/components/AuthCountdown.vue';

// Компонент читает gapi_token_expires (абсолютный unix-time в секундах, как его пишет
// google.js) и раз в секунду пересчитывает остаток авторизации для шапки App.vue.
const NOW_MS = new Date('2026-09-28T12:00:00Z').getTime();
const NOW_SEC = Math.floor(NOW_MS / 1000);

async function mountWithExpires(rawExpires) {
    if (rawExpires === null) {
        localStorage.removeItem('gapi_token_expires');
    } else {
        localStorage.setItem('gapi_token_expires', rawExpires);
    }
    const wrapper = mount(AuthCountdown);
    await wrapper.vm.$nextTick();
    return wrapper;
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);
});

afterEach(() => {
    vi.useRealTimers();
    localStorage.removeItem('gapi_token_expires');
    vi.restoreAllMocks();
});

describe('AuthCountdown', () => {
    it('показывает остаток авторизации в минутах и секундах', async () => {
        const wrapper = await mountWithExpires(String(NOW_SEC + 3252));
        expect(wrapper.text()).toContain('авторизация: 54:12');
    });

    it('тикает раз в секунду', async () => {
        const wrapper = await mountWithExpires(String(NOW_SEC + 3252));
        vi.advanceTimersByTime(1000);
        await wrapper.vm.$nextTick();
        expect(wrapper.text()).toContain('54:11');
        vi.advanceTimersByTime(10_000);
        await wrapper.vm.$nextTick();
        expect(wrapper.text()).toContain('54:01');
    });

    it('протухший доступ — нули и класс expired', async () => {
        const wrapper = await mountWithExpires(String(NOW_SEC - 60));
        expect(wrapper.text()).toContain('00:00');
        expect(wrapper.classes()).toContain('expired');
    });

    it('без токена — «нет доступа» и класс expired', async () => {
        const wrapper = await mountWithExpires(null);
        expect(wrapper.text()).toContain('нет доступа');
        expect(wrapper.classes()).toContain('expired');
    });

    it('видит продление токена на ходу (localStorage обновил google.js)', async () => {
        const wrapper = await mountWithExpires(String(NOW_SEC + 120));
        expect(wrapper.text()).toContain('02:00');
        localStorage.setItem('gapi_token_expires', String(NOW_SEC + 3600));
        vi.advanceTimersByTime(1000); // час тикает: 3600 - 1 = 59:59
        await wrapper.vm.$nextTick();
        expect(wrapper.text()).toContain('59:59');
        expect(wrapper.classes()).not.toContain('expired');
    });

    it('интервал снимается при размонтировании', async () => {
        const wrapper = await mountWithExpires(String(NOW_SEC + 3252));
        const clearSpy = vi.spyOn(global, 'clearInterval');
        wrapper.unmount();
        expect(clearSpy).toHaveBeenCalled();
    });
});
