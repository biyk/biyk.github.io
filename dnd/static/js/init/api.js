import {GoogleSheetDB, ORM, spreadsheetId, Table} from "../db/google.js";
import {getMapTable} from "../script/api.js";

export async function loadInitiativeData() {
    let api = window.GoogleSheetDB || new GoogleSheetDB();
    await api.waitGoogle();
    let mapTable = await getMapTable();

    let data_ = await mapTable.getAll({formated: true});
    let init = data_.init;
    this.currentRound = parseInt(init.round) || 0;
    this.currentCharacterIndex = parseInt(init.try)  || 0;
    this.charactersData = init.all || [];
    this.timer = parseInt(init.timer)  || 0;
    this.displayInfoBlocks();
    this.displayCharacters();
    this.fillParentSelect();

}

// Функция для отправки данных на сервер
export async function sendInit() {

    const dataToSend = {
        round: this.currentRound,
        try: this.currentCharacterIndex,
        all: this.charactersData,
        rating: this.rating,
        next: this.nextCharacterIndex,
        fighting: this.fighting,
        timer: this.timer,
    };

    let api = window.GoogleSheetDB || new GoogleSheetDB();
    await api.waitGoogle();
    let mapTable = await getMapTable();
    await mapTable.updateRowByCode('init', {value: dataToSend});
}

export async function infoCharacter(name) {
    // Поиск персонажа
    const clear_name = name.replace(/[0-9]/g, '').trim();


    let keysTable = new Table({
        list: 'KEYS',
        spreadsheetId: spreadsheetId
    });
    let keys = await keysTable.getAll({formated: true, caching: true});
    let beastTable = new Table({
        list: 'BEASTS',
        spreadsheetId: keys.external
    });
    const data = await beastTable.getAll({caching: true});
    let _data = new ORM(data[0]);

    const result = data.filter(item => {
        let formated = _data.getFormated(item);
        return formated.name === clear_name
    });

    let npc = _data.getFormated(result[0]);

    const text = npc.html;

    // Создание попапа
    const popup = document.createElement('div');
    popup.className = 'popup-overlay';

    popup.innerHTML = `
        <div class="popup-content">
            <div class="popup-text">${text}</div>
            <button class="popup-close-btn">OK</button>
        </div>
    `;

    // Добавляем попап на страницу
    document.body.appendChild(popup);

    // Закрытие попапа при клике на кнопку
    popup.querySelector('.popup-close-btn').addEventListener('click', () => {
        document.body.removeChild(popup);
    });
}
