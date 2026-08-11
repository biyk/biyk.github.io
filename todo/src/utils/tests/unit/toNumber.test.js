import { describe, it, expect } from 'vitest';
import { toNumber } from '../../numbers.js';

describe('toNumber', () => {
    it('запятая как десятичный разделитель', () => {
        expect(toNumber('1,5')).toBe(1.5);
        expect(toNumber('12,75')).toBe(12.75);
    });

    it('точка и строка с пробелами', () => {
        expect(toNumber('1.5')).toBe(1.5);
        expect(toNumber(' 12,75 ')).toBe(12.75);
    });

    it('число как есть', () => {
        expect(toNumber(42)).toBe(42);
        expect(toNumber(-3.14)).toBe(-3.14);
    });

    it('undefined/null дают NaN без throw', () => {
        expect(Number.isNaN(toNumber(undefined))).toBe(true);
        expect(Number.isNaN(toNumber(null))).toBe(true);
    });

    it('мусор даёт NaN без throw', () => {
        expect(Number.isNaN(toNumber('abc'))).toBe(true);
        expect(Number.isNaN(toNumber(''))).toBe(true);
    });
});
