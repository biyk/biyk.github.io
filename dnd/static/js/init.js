import {calculateEncounterData, debounce, createEditableSpan} from './init/func.js';
import {displayInfoBlocks, displayCurrentAndNextTurn, fillEditForm} from './init/display.js';
import {loadInitiativeData, sendInit, infoCharacter} from './init/api.js';
import {ORM, spreadsheetId, Table} from "./db/google.js";

class InitiativeManager {
    constructor() {
        this.currentCharacterIndex = 0;
        this.currentRound = 1;
        this.charactersData = [];
        this.rating = 0;
        this.nextCharacterIndex = 0;

        // Привязка обработчиков событий
        this.addEventListeners();
        this.fillParentSelect();
    }

    // Функция для загрузки данных из JSON-файла
    loadInitiativeData() {
        loadInitiativeData.call(this);
    }

    displayInfoBlocks() {
        displayInfoBlocks.call(this);
    }

    // Функция для отправки данных на сервер
    async sendInit() {
        await sendInit.call(this);
    }

    async displayCharactersAndSendInit() {
        this.displayCharacters();
        await this.sendInit();
    }

    // Универсальная функция для обновления свойств персонажа
    async updateCharacterProperty(index, property, value) {
        this.charactersData[index][property] = value;
        await this.displayCharactersAndSendInit();
    }

    async updateCharacterPropertyHp(index, property, value) {
        this.charactersData[index][property] = this.charactersData[index][property] - value;
        await this.displayCharactersAndSendInit();
    }

    async updateCharacterPropertyInit(index, property, value) {
        while (!this.isUniqueInitiative(value)) {
            value = (parseFloat(value) + 0.1).toFixed(1);
        }
        this.charactersData[index][property] = value;
        await this.displayCharactersAndSendInit();
    }

    // Переход к следующему персонажу
    async nextTurn() {
        let characters = this.charactersData.sort((a, b) => parseFloat(b.init) - parseFloat(a.init));
        let _characters = characters;

        if (this.currentRound === 0) {
            characters = characters.filter(character => character.surprise === "true");
        }
        let prev = characters.filter(character => parseFloat(character.init) === this.currentCharacterIndex)[0] || _characters[0];
        let next = characters.filter(character => parseFloat(character.init) < this.currentCharacterIndex)[0] || _characters[0];
        let round_time = next.parent_name ? 30 : 60;

        if (next && prev && prev.npc==='false'&& next.npc==='false') {
            this.timer = Math.max(Math.floor(Date.now() / 1000) , this.timer) + round_time;
        } else {
            this.timer = Math.floor(Date.now() / 1000) + round_time;
        }

        this.currentCharacterIndex = next.init;
        if (next.init === characters[0].init) {
            this.currentRound++;
        }
        this.fighting = true;
        await this.displayCharactersAndSendInit();
    }

    // Переход к предыдущему персонажу
    async prevTurn() {
        let characters = this.charactersData.sort((a, b) => parseFloat(b.init) - parseFloat(a.init));

        if (this.currentRound === 0) {
            characters = characters.filter(character => character.surprise === "true");
        }

        let currentIndex = characters.findIndex(character => parseFloat(character.init) === parseFloat(this.currentCharacterIndex));

        if (currentIndex === 0) {
            this.currentCharacterIndex = characters[characters.length - 1].init;
            this.currentRound = Math.max(0, this.currentRound - 1);
        } else {
            this.currentCharacterIndex = characters[currentIndex - 1].init;
        }

        await this.displayCharactersAndSendInit();
    }


    // Модифицированная функция для отображения строк персонажей с подсветкой текущего
    displayCharacters() {
        const container = document.getElementById('characters-container');
        container.innerHTML = '';

        let {encounterDifficulty} = calculateEncounterData(this.charactersData);
        document.getElementById('battle-rating').textContent = encounterDifficulty;
        this.rating = encounterDifficulty;
        const characters = this.charactersData.sort((a, b) => parseFloat(b.init) - parseFloat(a.init));

        characters.forEach((character, index) => {
            const row = document.createElement('div');
            row.classList.add('character-row');

            if (parseInt(character.init) === this.currentCharacterIndex) row.classList.add('current-turn');
            row.classList.add(character.npc === 'true' ? 'character-npc' : 'character-player');

            const nameSpan = createEditableSpan(`Имя: ${character.name}`, "name", index, this.updateCharacterProperty.bind(this));
            const initSpan = createEditableSpan(`Init: ${character.init}`, "init", index, this.updateCharacterPropertyInit.bind(this));
            const cdSpan = createEditableSpan(`КД: ${character.cd}`, "cd", index, this.updateCharacterProperty.bind(this));
            const hpSpan = createEditableSpan(`HP: ${character.hp_now}`, "hp_now", index, this.updateCharacterPropertyHp.bind(this), `/ ${character.hp_max}`);
            const expSpanTitle = character.npc === 'true' ? 'DNG' : 'LVL';
            const expSpan = createEditableSpan(`${expSpanTitle}: ${character.exp}`, "exp", index, this.updateCharacterProperty.bind(this));

            const surpriseLabel = this.createCheckbox("Sur", character.surprise, index, 'surprise');
            const npcLabel = this.createCheckbox("НПС", character.npc, index, 'npc');

            const deleteButton = document.createElement('button');
            deleteButton.textContent = '-';
            deleteButton.onclick = async () => await this.deleteCharacter(index);

            const healButton = document.createElement('button');
            healButton.textContent = '+';
            healButton.onclick = () => this.healCharacter(index);

            const infoButton = document.createElement('button');
            infoButton.textContent = 'i';
            infoButton.classList.add('js-info');
            infoButton.onclick = () => this.infoCharacter(character.name);

            row.append(nameSpan, initSpan, cdSpan, hpSpan, surpriseLabel, npcLabel, expSpan, deleteButton, healButton, infoButton);
            container.appendChild(row);
        });

        displayCurrentAndNextTurn(this);
    }

    createCheckbox(labelText, isChecked, index, property) {
        const label = document.createElement('label');
        label.innerHTML = `${labelText}: <input type="checkbox" ${isChecked === "true" ? "checked" : ""} />`;
        label.querySelector("input").onchange = (e) => {
            this.updateCharacterProperty(index, property, e.target.checked ? 'true' : 'false');
        };
        return label;
    }

    // Функция сброса инициативы
    async resetInitiative() {
        this.charactersData.forEach((character) => (character.init = '0'));
        this.currentRound = 1;
        this.fighting = false;
        await this.displayCharactersAndSendInit();
    }

    // Функция восстановления здоровья
    async healCharacter(index) {
        this.charactersData[index].hp_now = this.charactersData[index].hp_max;
        await this.displayCharactersAndSendInit();
    }

    // Функция удаления персонажа
    async deleteCharacter(index) {
        this.charactersData.splice(index, 1);
        await this.displayCharactersAndSendInit();
    }

    // Метод для переключения видимости формы добавления персонажа
    toggleAddCharacterForm() {
        const form = document.getElementById('add-character-form');
        form.style.display = form.style.display === 'none' || form.style.display === '' ? 'grid' : 'none';
    }

    // Метод проверки уникальности инициативы
    isUniqueInitiative(init) {
        return !this.charactersData.some(character => parseFloat(character.init) === parseFloat(init));
    }

    // Метод добавления нового персонажа
    async addCharacter() {
        let init = document.getElementById('new-init').value;
        const name = document.getElementById('new-name').value;
        const cd = document.getElementById('new-cd').value;
        const hpNow = document.getElementById('new-hp-now').value;
        const hpMax = document.getElementById('new-hp-max').value;
        const surprise = document.getElementById('new-surprise').checked;
        const npc = document.getElementById('new-npc').checked;
        const exp = document.getElementById('new-experience').value;
        const count = document.getElementById('new-count').value;
        const parent = document.getElementById('new-parent').value;
        let parent_name = '';
        // Проверяем уникальность инициативы
        if (parent) {
            init = parent - 0.01;

            this.charactersData.forEach((character) => {
                if (character.init === parent) {
                    parent_name = character.name;
                }

            });
        } else {
            while (!this.isUniqueInitiative(init)) {
                init = (parseFloat(init) + 0.1).toFixed(1);
            }
        }

        for (let i = 0; i < count; i++) {
            const _name = (count > 1 ? name + ' ' + (i + 1) : name)
            const newCharacter = {
                init: init,
                name: _name,
                cd: cd,
                hp_now: hpNow,
                hp_max: hpMax,
                exp: exp,
                parent_name: parent_name,
                surprise: surprise ? "true" : "false",
                npc: npc ? "true" : "false"
            };

            this.charactersData.push(newCharacter);
        }

        this.toggleAddCharacterForm();
        await this.displayCharactersAndSendInit();
    }

    // Метод для заполнения формы редактирования данными
    fillEditForm(data) {
        fillEditForm(data);
    }

    // Добавление обработчиков событий
    addEventListeners() {
        if (typeof document !== "undefined") {
            document.querySelector(".toggle-form-button.reset").addEventListener("click", this.resetInitiative.bind(this));
            document.querySelector(".toggle-form-button.next").addEventListener("click", this.nextTurn.bind(this));
            document.querySelector(".toggle-form-button.prev").addEventListener("click", this.prevTurn.bind(this));
            document.querySelector(".toggle-form-button.add").addEventListener("click", this.toggleAddCharacterForm.bind(this)); // Новый обработчик
            document.getElementById('add-character-button').addEventListener("click", this.addCharacter.bind(this)); // Обработчик добавления персонажа

            // Изменяем обработчик для списка монстров
            document.getElementById('npc-input').addEventListener(
                'input',
                debounce(async () => {
                    const npcList = document.getElementById('npc-list');
                    const input = document.getElementById('npc-input'); // Получаем input элемент
                    const query = input.value.trim();
                    if (query.length === 0) {
                        npcList.innerHTML = '';
                        return;
                    }
                    try {
                        const clear_name = query.replace(/[0-9]/g, '').trim();


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
                            return formated.name.includes(clear_name)
                        });
                        console.log(result);
                        npcList.innerHTML = result.map((npc, index) => {
                            let _npc = _data.getFormated(npc);
                            let safeJson = JSON.stringify(_npc).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
                            return `<li data-index="${index}" data-json='${safeJson}'>${_npc.name}</li>`;
                        }).join('');

                        // Добавляем обработчики клика для каждого элемента списка
                        Array.from(npcList.querySelectorAll('li')).forEach(li => {
                            li.addEventListener('click', (event) => {
                                const npcData = JSON.parse(event.target.getAttribute('data-json'));
                                initiativeManager.fillEditForm(npcData); // Вызываем метод заполнения формы
                            });
                        });
                    } catch (error) {
                        console.error('Error:', error);
                        npcList.innerHTML = '<li>Error loading NPCs</li>';
                    }
                }, 300) // Задержка 300 мс
            );

        }
    }

    infoCharacter(name) {
        infoCharacter(name);
    }

    fillParentSelect() {
        let select = document.getElementById('new-parent');
        this.charactersData.forEach((character) => {
            let option = document.createElement('option');
            option.text = character.name;
            option.value = character.init;
            select.appendChild(option);
        });

    }
}

// Инициализация и запуск
const initiativeManager = new InitiativeManager();
window.initiativeManager = initiativeManager;
initiativeManager.loadInitiativeData();
export {InitiativeManager};