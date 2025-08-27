import {init} from "./test/init.js";
import {empty} from "./test/empty.js";
import {tab} from "./test/tab.js";
import {location} from "./test/location.js";
import {npc} from "./test/npc.js";
import {map} from "./test/map.js";
import {backup} from "./test/backup.js";
import {createBackupBeforeTests} from "./test/backupRunner.js";
const sleeper = 2000;

// Объект с функциями
const tests = { empty, tab, init, location, npc, map, backup};

// createBackupBeforeTests перенесен в ./test/backupRunner.js

export async function test(testing = 'all') {

    // Создаем бэкап перед запуском тестов
    await createBackupBeforeTests();
    console.log("=== Начало тестирования ===");

    if (testing === 'all') {
        await empty(sleeper);
        await tab(sleeper);
        await init(sleeper);
        await location(sleeper);
        await npc(sleeper);
        await map(sleeper);
    } else if (typeof tests[testing] === 'function') {
        // Вызываем функцию из объекта tests
        await tests[testing](sleeper);
    } else {
        console.error(`Function "${testing}" does not exist.`);
    }
    
    console.info("=== Тестирование завершено ===");
}

/**
 * Экспортируем функцию создания бэкапа для использования отдельно
 */
export {createBackupBeforeTests as createBackup};

window.test = test;
window.createBackup = createBackupBeforeTests;