import './_globals.js';
import { describe, it, expect } from 'vitest';
import { Table } from '../../../../../dnd/static/js/db/google.js';

function makeTable() {
    return new Table({ spreadsheetId: 'test-spreadsheet', list: 'test_list' });
}

describe('Table.formatData', () => {
    it('простые значения: code -> value', () => {
        const t = makeTable();
        expect(
            t.formatData([
                ['task_time', '15'],
                ['money_reward', '7'],
            ]),
        ).toEqual({ task_time: '15', money_reward: '7' });
    });

    it('value, начинающийся с { или [, собирается из чанков как JSON', () => {
        const t = makeTable();
        const chunked = [['desc', '{"a"', ':1}']];
        expect(t.formatData(chunked)).toEqual({ desc: { a: 1 } });
    });

    // Баги: битые строки роняют formatData (todo.md Уст.3 / тест 04.12)
    it.todo('formatData не падает на строке без значения (Уст.3)');
    it.todo('formatData не падает на битом JSON в value (Уст.3)');
});
