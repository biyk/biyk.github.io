const textarea = document.getElementById('dynamic-text');
const aiData = document.getElementById('dynamic-ai');
import {Table, spreadsheetId, GoogleSheetDB, API_KEY} from "./db/google.js";


// Загружаем данные при загрузке страницы
let api = window.GoogleSheetDB || new GoogleSheetDB({
    callback: loadData,
});

let table;

// Функция debounce, которая задерживает выполнение функции
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout); // Очищаем предыдущий таймер
        timeout = setTimeout(() => func.apply(this, args), delay); // Устанавливаем новый таймер
    };
}

// Функция отправки данных
async function sendData(i) {
    let text = {
        2: textarea.value,
        3: aiData.value,
    }[i]
    await table.updateRow(i, { text });
}
const debounseTimer = 1500
// Обернутые версии с заданным индексом
const debouncedSendData2 = debounce(() => sendData(2), debounseTimer);
const debouncedSendData3 = debounce(() => sendData(3), debounseTimer);

// Подписка на события
textarea.addEventListener('input', debouncedSendData2);
aiData.addEventListener('input', debouncedSendData3);


// Функция для загрузки данных при старте
async function loadData() {
    table = new Table({
        spreadsheetId: spreadsheetId,
        list: 'DM',
        api
    });

    let values = await table.getRow(2);
    textarea.value = values;

    values = await table.getRow(3);
    aiData.value = values;
}




