// Функция для загрузки радиобаттонов и отправки данных на сервер
import {GoogleSheetDB, spreadsheetId, Table} from "./db/google.js";
import {getMapTable} from "./script/api.js";

export async function loadAmbienceRadios() {
    try {
        let api = window.GoogleSheetDB || new GoogleSheetDB();
        await api.waitGoogle();
        let ambienceTable = new Table({
            list: 'AMBIENCE',
            spreadsheetId: spreadsheetId
        });

        let data = await ambienceTable.getAll({formated:true});
        let ambience = this.config.ambience;

        const container = document.getElementById('ambience-tab');
        Object.entries(data).filter(([key, value]) => key!='code')
            .forEach(([key, value]) => {
                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = 'ambience';
                radio.value = key;
                radio.id = `radio-${key}`;
                radio.checked = key===ambience;
                const label = document.createElement('label');
                label.htmlFor = `radio-${key}`;
                label.textContent = value;
                // Добавляем радио-кнопку и метку в контейнер
                if (container){
                    container.appendChild(radio);
                    container.appendChild(label);
                }

                // Добавляем обработчик для отправки значения на сервер при выборе радио-кнопки
                radio.addEventListener('change', async () => {
                    let mapTable = await getMapTable();

                    try {
                        await mapTable.updateRowByCode('ambience', {value: radio.value});

                        console.log(`Отправлено значение: ${radio.value}`);
                    } catch (error) {
                        console.error('Ошибка при отправке:', error);
                    }
                });
            });
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
    }
}

