import {Drive, spreadsheetId, Table} from '../db/google.js'

export async function createBackupBeforeTests() {
    try {
        console.log('=== Подготовка бэкапов всех таблиц ===');

        if (window.GoogleSheetDB) {
            await window.GoogleSheetDB.waitGoogle();
        }

        const allSpreadsheetIds = new Set([spreadsheetId]);

        try {
            console.log('=== Поиск связанных таблиц в листе KEYS ===');
            const keysTable = new Table({ list: 'KEYS', spreadsheetId });
            const keys = await keysTable.getAll({ formated: true, caching: 10 });
            for (const value of Object.values(keys || {})) {
                if (typeof value === 'string' && /^[a-zA-Z0-9-_]{20,}$/.test(value)) {
                    allSpreadsheetIds.add(value);
                }
            }
        } catch (e) {
            console.warn('Не удалось получить список связанных таблиц из KEYS:', e);
        }

        const drive = new Drive();

        console.log(`Нужно сделать бэкапы для таблиц: ${allSpreadsheetIds.size}`);
        const idsArray = Array.from(allSpreadsheetIds);

        // Запускаем строго последовательно, чтобы дождаться всех вложенных запросов
        const results = [];
        for (const sid of idsArray) {
            const id = await drive.createSpreadsheetBackup(sid); // Дожидаемся здесь
            console.log(`✓ Бэкап таблицы ${sid} → ${id}`);
            results.push({ source: sid, backup: id });
        }

        console.log('✓ Все бэкапы успешно созданы');
        return results;

    } catch (error) {
        console.error('✗ Ошибка при создании бэкапа:', error);
        throw error;
    }
}


