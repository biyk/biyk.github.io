import {init} from "./test/init.js";
import {empty} from "./test/empty.js";
import {tab} from "./test/tab.js";
import {location} from "./test/location.js";
import {npc} from "./test/npc.js";
import {map} from "./test/map.js";
const sleeper = 200;

// Объект с функциями
const tests = { empty, tab, init, location, npc, map};

export async function test(testing = 'all') {
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

window.test = test;