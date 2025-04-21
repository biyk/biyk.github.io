import {exit, sleep} from './func.js'
import {showTab} from '../tabs.js'

export async function npc(sleeper) {
    const manager = window.NpcManager;
    //Тест
    console.log("=== Поиск шаблона NPC ===");
    await sleep(sleeper);
    await (async () => {
        manager.searchNpcInput.value = "Гоблин"
        manager.searchNpcInput.dispatchEvent(new Event('input'));
        await sleep(sleeper + 300);
        const firstNpcResult = manager.searchNpcResults.firstElementChild;
        firstNpcResult.click()
        await sleep(sleeper);
        if(manager.npcCd.value && manager.npcName.value){
            console.log("✓ Поиск НПС отработал");
        } else {
            exit("✗ Поиск НПС не отработал");
        }
    })();

    await sleep(sleeper);
    await (async () => {
        let count = document.querySelectorAll(".npc-item").length;
        manager.addNpcButton.click()
        await sleep(sleeper);

        if (count <  document.querySelectorAll(".npc-item").length){
            console.log("✓ НПС добавлен");
        } else {
            exit("✗ НПС не добавлен");
        }
    })();

    await sleep(sleeper);
    await (async () => {
        let info = document.querySelector(".npc-item:last-child .js-edit-npc");
        info.click()
        await sleep(sleeper);
        //проверить что форма изменилась.
        if (manager.npcName.value !== ''){
            console.log("✓ информация об НПС добавлена в форму");
        } else {
            exit("✗ информация об НПС не добавлена в форму");
        }
        // отредактировать форму
        let testName = 'Тестовый персонаж. Удалить';
        manager.npcName.value = testName;
        manager.updateNpcButton.click();
        await sleep(sleeper);

        // проверить что изменения применились
        let name = document.querySelector(".npc-item:last-child .js-npc-name").innerText;
        if (name === testName){
            console.log("✓ НПС Отредактирован");
        } else {
            exit("✗ НПС не отредактирован");
        }
    })();

    //Удаление НПС
    await sleep(sleeper);
    await (async () => {
        const count = document.querySelectorAll(".npc-item").length;
        let del = document.querySelector(".npc-item:last-child .delete-btn");
        del.click()
        await sleep(sleeper);
        //проверить что форма изменилась.
        if (count > document.querySelectorAll(".npc-item").length){
            console.log("✓ НПС Удален");
        } else {
            exit("✗ ошибка удаления НПС");
        }
    })();

}
