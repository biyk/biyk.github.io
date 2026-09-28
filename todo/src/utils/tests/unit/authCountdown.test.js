import { describe, it, expect } from 'vitest';
import { authLeftSeconds, formatAuthLeft } from '../../auth.js';

// google.js пишет в localStorage gapi_token_expires абсолютный unix-time (в секундах)
// протухания access-токена: JSON.stringify(getTime() + resp.expires_in) → «1790000000».
describe('authLeftSeconds', () => {
    it('считает остаток в секундах от абсолютного времени истечения', () => {
        expect(authLeftSeconds('1000', 940)).toBe(60);
    });

    it('округляет вниз до нуля, когда доступ уже протух', () => {
        expect(authLeftSeconds('1000', 1200)).toBe(0);
    });

    it('пустое/мусорное значение даёт null (токена ещё нет)', () => {
        expect(authLeftSeconds(null, 1000)).toBeNull();
        expect(authLeftSeconds('', 1000)).toBeNull();
        expect(authLeftSeconds('abc', 1000)).toBeNull();
        expect(authLeftSeconds('0', 1000)).toBeNull();
    });

    it('текущее время можно не передавать — берётся Date.now()', () => {
        const nowSec = Math.floor(Date.now() / 1000);
        expect(authLeftSeconds(String(nowSec + 120))).toBeLessThanOrEqual(120);
        expect(authLeftSeconds(String(nowSec + 120))).toBeGreaterThan(110);
    });
});

describe('formatAuthLeft', () => {
    it('минуты:секунды с ведущими нулями', () => {
        expect(formatAuthLeft(String(1_000_000_000 + 3252), 1_000_000_000)).toBe('54:12');
        expect(formatAuthLeft(String(1_000_000_000 + 60), 1_000_000_000)).toBe('01:00');
        expect(formatAuthLeft(String(1_000_000_000 + 5), 1_000_000_000)).toBe('00:05');
    });

    it('ноль — это «00:00», а не пустота', () => {
        expect(formatAuthLeft('1000', 1000)).toBe('00:00');
        expect(formatAuthLeft('1000', 5000)).toBe('00:00');
    });

    it('часы и больше — с префиксом часов', () => {
        expect(formatAuthLeft(String(1_000_000_000 + 3600), 1_000_000_000)).toBe('1:00:00');
        expect(formatAuthLeft(String(1_000_000_000 + 7384), 1_000_000_000)).toBe('2:03:04');
    });

    it('без токена даёт null (показывает «нет доступа» на уровне UI)', () => {
        expect(formatAuthLeft(null, 1000)).toBeNull();
    });
});
