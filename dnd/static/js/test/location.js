import { exit, sleep } from './func.js';
import {showTab} from '../tabs.js'

export async function location(sleeper) {
    const manager = window.LocationManager;

    showTab('monster-tab')
    await sleep(sleeper);
    // Проверка загрузки основных локаций
    console.log("=== Загрузка основных локаций ===");
    await (async () => {
        await manager.loadMainLocations();
        if (manager.mainLocationSelect.options.length > 0) {
            console.log("✓ Основные локации успешно загружены");
        } else {
            exit("✗ Ошибка при загрузке основных локаций");
        }
    })();

    // Проверка загрузки подлокаций
    console.log("=== Загрузка подлокаций ===");
    await sleep(sleeper);
    await (async () => {
        const mainLocationId = manager.mainLocationSelect.value;
        await manager.loadSubLocations();
        if (manager.subLocationList.children.length > 0) {
            console.log("✓ Подлокации успешно загружены");
        } else {
            exit("✗ Ошибка при загрузке подлокаций для основной локации " + mainLocationId);
        }
    })();

    // Проверка добавления новой локации
    console.log("=== Добавление новой локации ===");
    await sleep(sleeper);
    await (async () => {
        const initialCount = manager.subLocationList.children.length;
        manager.addLocationBtn.click();
        await sleep(sleeper);
        manager.locationNameInput.value = "Тестовая Локация";
        manager.saveLocationBtn.click();
        await sleep(sleeper);
        const newCount = manager.subLocationList.children.length;
        if (newCount > initialCount) {
            console.log("✓ Локация успешно добавлена");
        } else {
            exit("✗ Локация не добавлена");
        }
    })();


    //Открыть тестовую локацию
    console.log("=== Открытие тестовой локации ===");
    await sleep(sleeper);
    await (async () => {
        const locationToOpen = manager.subLocationList.lastElementChild;
        await manager.showEditPopup({
            'ID':locationToOpen.dataset.locationId,
            'name':locationToOpen.querySelector('.location-span').innerText,
        });
        await sleep(sleeper);

        if (manager.editPopup.style.display === 'block') {
            console.log("✓ Локация успешно открыта");
        } else {
            exit("✗ Ошибка при открытии локации");
        }
    })();

    //Открыть тестовую локацию
    console.log("=== Проверка редактирования локации ===");
    await sleep(sleeper);
    await (async () => {
        let locationToOpen = manager.subLocationList.lastElementChild;
        const testText = 'Отредактированная локация'
        manager.editNameInput.value = testText;
        await manager.editLocationName();
        await sleep(sleeper);
        locationToOpen = manager.subLocationList.lastElementChild;
        if (locationToOpen.querySelector('.location-span').innerText===testText) {
            console.log("✓ Локация успешно отредактирована");
        } else {
            exit("✗ Ошибка при Редактировании локации");
        }
    })();


    // Проверка поиска NPC
    console.log("=== Поиск NPC ===");
    await sleep(sleeper);
    await (async () => {
        manager.searchNpcInput.value = "Гоблин"; // Имя NPC, который точно есть в базе
        manager.searchNpcInput.dispatchEvent(new Event('input'));
        await sleep(300 + sleeper);
        if (manager.searchNpcResults.children.length > 0) {
            console.log("✓ Поиск NPC работает");
        } else {
            exit("✗ Ошибка при поиске NPC");
        }
    })();

    // Проверка добавления NPC в локацию
    console.log("=== Добавление NPC в локацию ===");
    await sleep(sleeper);
    await (async () => {
        const initialNpcCount = manager.editNpcList.children.length;
        const firstNpcResult = manager.searchNpcResults.firstElementChild;
        if (firstNpcResult) {
            firstNpcResult.click();
            await sleep(sleeper);
            const newNpcCount = manager.editNpcList.children.length;
            if (newNpcCount > initialNpcCount) {
                console.log("✓ NPC успешно добавлен в локацию");
            } else {
                exit("✗ Ошибка при добавлении NPC в локацию");
            }
        } else {
            exit("✗ Нет доступных NPC для добавления");
        }
    })();

    // Проверка удаления NPC из локации
    console.log("=== Удаление NPC из локации ===");
    await sleep(sleeper);
    await (async () => {
        const initialNpcCount = manager.editNpcList.children.length;
        const firstNpcInList = manager.editNpcList.querySelector('.location-del-npc');
        if (firstNpcInList) {
            firstNpcInList.click();
            await sleep(sleeper);
            const newNpcCount = manager.editNpcList.children.length;
            if (newNpcCount < initialNpcCount) {
                console.log("✓ NPC успешно удален из локации");
            } else {
                exit("✗ Ошибка при удалении NPC из локации");
            }
        } else {
            exit("✗ Нет NPC для удаления");
        }
    })();

    console.log("=== Закрытие попапа редактирования ===");
    await sleep(sleeper);
    await (async () => {
        manager.showEditPopup({ ID: 1, name: "Тестовая Локация" });
        await sleep(sleeper);
        manager.closePopup.click();
        if (manager.editPopup.style.display === 'none') {
            console.log("✓ Попап успешно закрыт");
        } else {
            exit("✗ Попап не закрылся");
        }
    })();

        // Проверка удаления локации
    console.log("=== Удаление локации ===");
    await sleep(sleeper);
    await (async () => {
        const initialCount = manager.subLocationList.children.length;
        const locationToDelete = manager.subLocationList.lastElementChild.dataset.locationId;
        await manager.removeLocation(locationToDelete);
        await sleep(sleeper);
        const newCount = manager.subLocationList.children.length;
        if (newCount < initialCount) {
            console.log("✓ Локация успешно удалена");
        } else {
            exit("✗ Ошибка при удалении локации");
        }
    })();
}