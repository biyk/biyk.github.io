const textarea = document.getElementById('dynamic-text');
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
async function sendData() {
    await table.updateRow(2,{text: textarea.value});
}

// Создаем обертку sendData с дебаунсом на 500 мс
const debouncedSendData = debounce(sendData, 500);

// Вызываем debouncedSendData при каждом событии 'input'
textarea.addEventListener('input', debouncedSendData);

// Функция для загрузки данных при старте
async function loadData() {
    table = new Table({
        spreadsheetId: spreadsheetId,
        list: 'DM',
        api
    });

    let values = await table.getRow(2);
    textarea.value = values;
}




