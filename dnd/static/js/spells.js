import {debounce} from './init/func.js';
import {displayRes, displaySkills, displaySpells, renderSpellMenu} from './spells/display.js';
import {GoogleSheetDB, ORM, spreadsheetId, Table} from "./db/google.js";


export class Spells {
    constructor() {
        this.auth_code = localStorage.getItem('auth_code');
        this.playersSheet = '';
        this.initEventListeners();
        this.initializeSlesslMenu();
    }


    async getSkills() {
        let api = window.GoogleSheetDB || new GoogleSheetDB();
        await api.waitGoogle();
        return (JSON.parse(localStorage.getItem('skills_' + this.auth_code)) || [])
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    getRes(){
        return (JSON.parse(localStorage.getItem('resourses_' + this.auth_code)) || [])
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    getSpells(){
        return (JSON.parse(localStorage.getItem('spells_' + this.auth_code)) || [])
            .sort((a, b) => b.ac - a.ac);
    }

    displayAll(){
        displaySkills.call(this);
        displaySpells.call(this);
        displayRes.call(this);
    }

    displaySkills(){
        displaySkills.call(this);
    }
    displaySpells(){
        displaySpells.call(this);
    }
    displayRes(){
        displayRes.call(this);
    }

    async infoSkill(skill) {
        const clear_name = skill.text.trim();
        const text = clear_name;

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

    async infoSpell(spell) {
        const clear_name = spell.replace(/[0-9]/g, '').trim();
        let keysTable = new Table({
            list: 'KEYS',
            spreadsheetId: spreadsheetId
        });
        let keys = await keysTable.getAll({formated: true, caching: 10});
        let spellTable = new Table({
            list: 'SPELLS',
            spreadsheetId: keys.external
        });
        const data = await spellTable.getAll({caching: 10});
        let _data = new ORM(data[0]);

        const result = data.filter(item => {
            let formated = _data.getFormated(item);
            return formated.name === clear_name
        });

        const text = _data.getFormated(result[0]).html;

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

    initializeSlesslMenu() {
        let inventoryButton = document.getElementById('spells-button');
        if (inventoryButton) {
            inventoryButton.addEventListener('click', () => {
                this.toggleSlideMenu();
            });
        }

        renderSpellMenu.call(this);
    }

    async addResource(res) {
        const existingItem = this.resourses.find(
            (inventoryItem) => {
                return inventoryItem.name === res.name
            }
        );

        if (existingItem) {
            console.log('заклинание уже добавлено');
        } else {
            this.resourses.push(res);
        }
        await this.saveResourses();
        this.displayRes();
    }

    async addSkill(skill) {
        const existingItem = this.skills.find(
            (inventoryItem) => {
                return inventoryItem.name === skill.name
            }
        );

        if (existingItem) {
            console.log('заклинание уже добавлено');
        } else {
            this.skills.push(skill);
        }
        await this.saveSkills();
        this.displaySkills();
    }

    async removeRes(res) {
        const existingItem = this.resourses.find(
            (inventoryItem) => inventoryItem.name === res.name
        );

        if (existingItem) {
            this.resourses = this.resourses.filter(
                (inventoryItem) => inventoryItem.name !== res.name
            );

            await this.saveResourses();
            this.displayRes();
        } else {
            console.warn(`Item with url ${spell.link} not found in inventory.`);
        }
    }

    async saveSkills() {
        localStorage.setItem(
            `skills_${this.auth_code}`,
            JSON.stringify(this.skills)
        );
        await this.playerTable.updateRowByCode('skills', {code: 'skills', value: JSON.stringify(this.skills)});

    }

    async saveResourses() {
        console.info('saveResourses');
        localStorage.setItem(
            `resourses_${this.auth_code}`,
            JSON.stringify(this.resourses)
        );
        await this.playerTable.updateRowByCode('resourses', {code: 'resourses', value: JSON.stringify(this.resourses)});

    }

    async initEventListeners() {
        document.body.addEventListener('ready_spells', async () => {
            let api = window.GoogleSheetDB || new GoogleSheetDB();
            await api.waitGoogle();
            await this.getPlayersSheet();
            let {resourses, skills, spells} = await this.playerTable?.getAll({formated: true}) || {};
            this.resourses = resourses || [];
            this.skills = skills || [];
            this.spells = spells || [];
            this.displayAll();
            document.getElementById('spell-search').addEventListener(
                'input',
                debounce(async () => {
                    const spellsList = document.getElementById('spell-list');
                    const input = document.getElementById('spell-search'); // Получаем input элемент
                    const query = input.value.trim();
                    if (query.length === 0) {
                        spellsList.innerHTML = '';
                        return;
                    }
                    try {
                        let keysTable = new Table({
                            list: 'KEYS',
                            spreadsheetId: spreadsheetId
                        });
                        let keys = await keysTable.getAll({formated: true, caching: 10});
                        let spellTable = new Table({
                            list: 'SPELLS',
                            spreadsheetId: keys.external
                        });
                        const data = await spellTable.getAll({caching: 10});

                        const result = data.filter(item => {
                            let _data = new ORM(data[0]);
                            let formated = _data.getFormated(item);
                            return formated.name.includes(query)
                        });

                        spellsList.innerHTML = result.map(
                            (npc, index) => {
                                let _data = new ORM(data[0]);
                                let formated = _data.getFormated(npc);
                                delete formated.html;
                                return `<li data-index="${index}" data-json='${JSON.stringify(formated)}'>${formated.name}</li>`}
                        ).join('');
                        // Добавляем обработчики клика для каждого элемента списка
                        Array.from(spellsList.querySelectorAll('li')).forEach(li => {
                            li.addEventListener('click', async (event) => {
                                const spellData = JSON.parse(event.target.getAttribute('data-json'));
                                await this.addSpell(spellData);
                            });
                        });
                    } catch (error) {
                        console.error('Error:', error);
                        spellsList.innerHTML = '<li>Error loading NPCs</li>';
                    }
                }, 300) // Задержка 300 мс
            );
        });
    }

    async addSpell(spell) {
        console.log(this.spells);
        const existingItem = this.spells.find(
            (inventoryItem) => {
                console.log(inventoryItem,spell);
                return inventoryItem.code === spell.code
            }
        );

        if (existingItem) {
            console.log('заклинание уже добавлено');
        } else {
            this.spells.push(spell);
        }
        await this.saveSpells();
        this.displaySpells();
    }

    async saveSpells() {
        localStorage.setItem(
            `spells_${this.auth_code}`,
            JSON.stringify(this.spells)
        );
        await this.playerTable.updateRowByCode('spells', {code: 'spells', value: JSON.stringify(this.spells)});

    }


    async removeSpell(spell) {
        const existingItem = this.spells.find(
            (inventoryItem) => inventoryItem.link === spell.link
        );

        if (existingItem) {
            this.spells = this.spells.filter(
                (inventoryItem) => inventoryItem.link !== spell.link
            );
            await this.saveSpells();
            this.displaySpells();
        } else {
            console.warn(`Item with url ${spell.link} not found in inventory.`);
        }
    }

    async removeSkill(skill) {
        console.log(this.skills);
        const existingItem = this.skills.find(
            (inventoryItem) => inventoryItem.name === skill.name
        );

        if (existingItem) {
            this.skills = this.skills.filter(
                (inventoryItem) => inventoryItem.name !== skill.name
            );
            await this.saveSkills();
            this.displaySkills();
        } else {
            console.warn(`Item with url ${spell.link} not found in inventory.`);
        }
    }

    toggleSlideMenu(){
        const sidebar = document.querySelector('.spells-menu');
        sidebar.style.right = sidebar.style.right === '0px' ? '-100%' : '0px';
    }

    async getPlayersSheet() {//TODO почему-то не работает
        let keysTable = new Table({
            list: 'KEYS',
            spreadsheetId: spreadsheetId
        });
        let keys = await keysTable.getAll({caching: 10, formated:true});
        this.playersSheet = keys.players;
        let auth_code = localStorage.getItem('auth_code');
        if (auth_code) {
            let playerTable = new Table({
                list: localStorage.getItem('auth_code'),
                spreadsheetId: this.playersSheet
            });
            try {
                await playerTable.createList();
            } catch (e) {
                console.error(e);
            }
            this.playerTable = playerTable;
        }

    }
}

