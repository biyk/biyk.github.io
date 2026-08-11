import { describe, it, expect } from 'vitest';
import { ORM } from '../../../../../dnd/static/js/db/google.js';

describe('ORM', () => {
    const columns = ['code', 'value', 'task_time'];

    it('getFormated возвращает объект по колонкам', () => {
        const orm = new ORM(columns);
        expect(orm.getFormated(['a', 'b', 'c'])).toEqual({
            code: 'a',
            value: 'b',
            task_time: 'c',
        });
    });

    it('getFormated на строке короче колонок даёт undefined без throw', () => {
        const orm = new ORM(columns);
        const row = orm.getFormated(['a']);
        expect(row.code).toBe('a');
        expect(row.value).toBeUndefined();
        expect(row.task_time).toBeUndefined();
    });

    it('getRaw сериализует объект в value как JSON', () => {
        const orm = new ORM(['code', 'value']);
        const raw = orm.getRaw({ code: 'x', value: { a: 1 } });
        expect(raw[0]).toBe('x');
        expect(raw[1]).toBe('{"a":1}');
    });

    it('getRaw режет value длиннее 49000 символов на чанки', () => {
        const orm = new ORM(['code', 'value']);
        const big = 'x'.repeat(100000);
        const raw = orm.getRaw({ code: 'x', value: big });
        expect(raw[0]).toBe('x');
        expect(raw.length).toBe(1 + Math.ceil(100000 / 49000));
        expect(raw.slice(1).join('')).toBe(big);
    });

    it('round-trip getRaw -> getFormated сохраняет значение', () => {
        const orm = new ORM(['code', 'value']);
        const data = { code: 'hero_money', value: '42.5' };
        expect(orm.getFormated(orm.getRaw(data))).toEqual(data);
    });

    // Баг: при columns=undefined getFormated падает (todo.md Уст.2 / тест 04.13)
    it.todo('getFormated не падает при columns=undefined (Уст.2)');
});
