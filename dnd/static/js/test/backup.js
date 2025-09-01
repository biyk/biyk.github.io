import {sleep} from './func.js'

export async function backup(sleeper) {
    console.log("=== Тест создания бэкапа Google таблицы ===");
    
    try {
        // Проверяем, что Google API инициализирован
        if (!window.GoogleSheetDB) {
            throw new Error("Google API не инициализирован");
        }
        
        console.log("✓ Google API доступен");
        
        // Ждем инициализации Google API
        await window.GoogleSheetDB.waitGoogle();
        console.log("✓ Google API инициализирован");
        
        // Создаем бэкап
        const backupId = await window.createBackup();
        
        if (backupId) {
            console.log("✓ Бэкап создан успешно");
            console.log(`ID бэкапа: ${backupId}`);
            
            // Проверяем, что бэкап действительно существует
            const response = await gapi.client.sheets.spreadsheets.get({
                spreadsheetId: backupId,
                fields: 'properties.title'
            });
            
            if (response.result && response.result.properties.title) {
                console.log(`✓ Бэкап доступен: ${response.result.properties.title}`);
            } else {
                throw new Error("Бэкап не найден после создания");
            }
        } else {
            throw new Error("Бэкап не был создан");
        }
        
        console.log("=== Тест бэкапа завершен успешно ===");
        
    } catch (error) {
        console.error("✗ Ошибка в тесте бэкапа:", error);
        throw error;
    }
}

