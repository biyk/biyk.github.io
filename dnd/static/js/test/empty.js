import {exit, sleep} from './func.js'
import {showTab} from '../tabs.js'

export async function empty(sleeper) {

    //Тест
    console.log("=== Добавление NPC в локацию ===");
    await sleep(sleeper);
    await (async () => {
        if(1){
            console.log("✓ Тест пройден");
        } else {
            exit("✗ Ошибка тестирования");
        }
    })();


}


