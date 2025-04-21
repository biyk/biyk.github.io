import { debounce } from './init/func.js';
import { NpcApi } from './api/npc.js';

export class NpcManager {
    constructor() {
        const el = id => document.getElementById(id);
        this.apiUrl = '/api/data/location';
        // Ссылки на элементы
        this.searchNpcInput = el('npc-template-search');
        this.searchNpcResults = el('template-npc-search-results');
        this.addNpcButton = el('add-npc-button');
        this.updateNpcButton = el('update-npc-button');
        this.npcCd = el('npc-kd');
        this.npcId = el('npc-id');
        this.npcName = el('npc-name');
        this.npcHp = el('npc-health');
        this.npcTemplate = el('npc-template');
        this.npcForm = el('npc-form');
        this.monsters = new Map();
        //this.NpcApi = new NpcApi();
        this.init();
    }

    async init() {
        this.searchNpcInput.addEventListener('input', debounce(() => this.searchNpc(), 300));
        this.addNpcButton.addEventListener('click', this.addNpcAction.bind(this));
        this.updateNpcButton.addEventListener('click', this.updateNpcAction.bind(this));
        //await this.loadNpc()
    }

    async loadNpc() {
        this.NpcList = await this.NpcApi.getNpc();
        this.DisplayNpcList();
    }

    async addNpcAction() {
        await this.editNpcAction('add');
        this.npcForm.reset()
    }
    updateNpcAction (){
        this.addNpcButton.classList.remove('hidden');
        this.updateNpcButton.classList.add('hidden');

        this.editNpcAction('update').then(r => this.npcForm.reset())
    }

    async editNpcAction(action='add') {
        try {
            const response = await fetch('/api/data/npc/'+action, {
                method: 'POST',
                body: new FormData(this.npcForm)
            });
            if (!response.ok) throw new Error('Ошибка при отправке формы');
            const { message } = await response.json();
            console.info(message);
            await this.loadNpc();
        } catch (error) {
            alert('Произошла ошибка: ' + error.message);
        }
    }

    async searchNpc() {
        const query = this.searchNpcInput.value.trim();
        if (!query) {
            this.searchNpcResults.innerHTML = '';
            return;
        }
        try {
            const response = await fetch(`/api/data/monsters/json?name=${encodeURIComponent(query)}`);
            const data = await response.json();
            this.monsters = new Map(data.map(npc => [npc.id, npc]));
            this.searchNpcResults.innerHTML = data.length
                ? data.map(npc => `<li data-monster-id="${npc.id}" onclick="window.NpcManager.useTemplate(${npc.id})">${npc.name}</li>`).join('')
                : '';
        } catch (error) {
            console.error('Ошибка поиска персонажей:', error);
        }
    }

    useTemplate(monsterId) {
        const npc = this.monsters.get(monsterId);
        if (npc) {
            this.npcCd.value = npc.armor_class || '';
            this.npcName.value = npc.name || '';
            this.npcHp.value = npc.hit_points || '';
            this.npcTemplate.value = npc.name || '';
        } else {
            console.error(`Шаблон NPC с ID ${monsterId} не найден`);
        }
    }

    DisplayNpcList() {
        const npcListContent = document.getElementById('npc-list-content'); // Получаем блок для отображения списка
        if (!npcListContent) {
            console.error('Элемент npc-list-content не найден');
            return;
        }

        npcListContent.innerHTML = ''; // Очищаем содержимое перед обновлением

        if (!this.NpcList || this.NpcList.length === 0) {
            npcListContent.innerHTML = '<p>Список NPC пуст.</p>';
            return;
        }

        this.NpcList.forEach(npc => {
            const npcItem = document.createElement('div');
            npcItem.classList.add('npc-item');

            npcItem.innerHTML = `
                <div class="npc-details">
                    <p onclick="window.initiativeManager.infoCharacter('${npc.template}')">
                    <strong>Имя:</strong><span  class="js-npc-name">${npc.name}</span>
                    </p>
                    <p><strong>HP:</strong> ${npc.hp}</p>
                    <p><strong>CD:</strong> ${npc.cd || 'N/A'}</p>
                    <p><button class="js-edit-npc" onclick="window.NpcManager.editNpc('${npc.id}')">i</button></p>
                </div>
                <button class="delete-btn" data-id="${npc.id}">Удалить</button>
            `;

            npcListContent.appendChild(npcItem);
        });

        // Добавляем обработчики событий для кнопок удаления
        npcListContent.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', event => {
                const npcId = event.target.getAttribute('data-id');
                this.deleteNpc(npcId);
            });
        });
    }

    async deleteNpc(npcId) {
        try {
            const response = await fetch(`/api/data/npc/delete/${npcId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Ошибка удаления персонажа');
            this.NpcList = this.NpcList.filter(npc => npc.id !== parseInt(npcId, 10)); // Обновляем локальный список
            this.DisplayNpcList(); // Перерисовываем список
        } catch (error) {
            alert('Не удалось удалить персонажа: ' + error.message);
        }
    }

    editNpc(id) {
        // Ищем NPC в списке
        const npc = this.NpcList.find(npc => npc.id === parseInt(id, 10));

        if (!npc) {
            console.error(`NPC с ID ${id} не найден`);
            return;
        }

        // Заполняем форму данными NPC
        this.npcCd.value = npc.cd || '';
        this.npcName.value = npc.name || '';
        this.npcHp.value = npc.hp || '';
        this.npcTemplate.value = npc.template || '';
        this.npcId.value = npc.id || '';
        document.getElementById('npc-custom-text').value = npc.text || '';

        // Переключаем видимость кнопок
        this.addNpcButton.classList.add('hidden');
        this.updateNpcButton.classList.remove('hidden');

    }
}

window.NpcManager = new NpcManager();
