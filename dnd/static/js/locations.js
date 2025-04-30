import { debounce } from './init/func.js';
import { loadMainLocations, loadSubLocations } from './locations/api.js';

export class LocationManager {
    constructor() {
        const el = id => document.getElementById(id);
        this.apiUrl = '/api/data/location';
        this.mainLocationSelect = el('main-location');
        this.subLocationList = el('sub-locations');
        this.addLocationBtn = el('add-location-btn');
        this.addLocationForm = el('add-location-form');
        this.locationNameInput = el('location-name');
        this.saveLocationBtn = el('save-location');
        this.cancelLocationBtn = el('cancel-location');
        this.editPopup = el('edit-popup');
        this.closePopup = el('close-popup');
        this.editNameInput = el('edit-name');
        this.editNpcList = el('npc-list2');
        this.searchNpcInput = el('loc-npc-input');
        this.searchNpcResults = el('npc-search-results');
        this.currentEditingLocationId = null;
        this.init();
    }

    async init() {
        //await this.loadMainLocations();
        this.mainLocationSelect.addEventListener('change', () => this.loadSubLocations());
        this.addLocationBtn.addEventListener('click', () => this.toggleForm(true));
        this.saveLocationBtn.addEventListener('click', () => this.addNewLocation());
        this.cancelLocationBtn.addEventListener('click', () => this.toggleForm(false));
        this.searchNpcInput.addEventListener('input', debounce(() => this.searchNpc(), 300));
        this.editNameInput.addEventListener('keyup', debounce(() => this.editLocationName(), 300));//
        this.closePopup.addEventListener('click', () => this.hideEditPopup());
        this.mainLocationSelect.dispatchEvent(new Event('change'));
    }

    async loadMainLocations() {
        //await loadMainLocations.call(this);
    }

    hideEditPopup() {
        this.editPopup.style.display = 'none';
        this.currentEditingLocationId = null;
    }

    async loadSubLocations() {
        //await loadSubLocations.call(this);
    }

    async removeLocation(location) {
        try {


        } catch (error) {
            console.error('Ошибка при удалении локации:', error);
        }
    }

    toggleForm(show) {
        this.addLocationForm.style.display = show ? 'block' : 'none';
    }

    async addNewLocation() {
        const name = this.locationNameInput.value.trim();
        if (!name) return console.error('Введите название локации');
        try {


            if (response.ok) {
                this.toggleForm(false);
                this.locationNameInput.value = '';
                await this.loadSubLocations();
            } else {
                console.error('Ошибка при добавлении локации');
            }
        } catch (error) {
            console.error('Ошибка при добавлении локации:', error);
        }
    }

    async showEditPopup(location) {
        this.currentEditingLocationId = location.ID;
        this.editPopup.style.display = 'block';
        this.editNameInput.value = location.name;
        this.editNameInput.dataset.id = location.ID;
        await this.loadNpcs(location.ID);
    }

    async loadNpcs(locationId) {
        try {

            const data = await response.json();
            this.editNpcList.innerHTML = data?.length
                ? data.map(npc => `
                    <li>
                        <span>${npc.name}</span>
                        <span class="location-del-npc" onclick="window.LocationManager.updateNpcInLocation(${npc.id}, 'remove')">X</span>
                        <span class="move-npc-btn" onclick="window.LocationManager.showLocationSelect(${npc.id})">➡</span>
                        <select class="npc-location-select hidden" data-npc-id="${npc.id}" onchange="window.LocationManager.moveNpcToNewLocation(${npc.id}, this.value)">
                            <option>Выберите локацию</option>
                            ${Array.from(this.subLocationList.children).map(loc => `<option value="${loc.dataset.locationId}">${loc.querySelector('.location-span').innerText}</option>`).join('')}
                        </select>
                    </li>`).join('')
                : '';
        } catch (error) {
            console.error('Ошибка загрузки персонажей:', error);
        }
    }

    async searchNpc() {
        const query = this.searchNpcInput.value.trim();
        if (!query) return (this.searchNpcResults.innerHTML = '');
        try {

            const data = await response.json();
            this.searchNpcResults.innerHTML = data?.length
                ? data.map(npc => `<li data-monster-id="${npc.id}" onclick="window.LocationManager.updateNpcInLocation(${npc.id}, 'add')">${npc.name}</li>`).join('')
                : '';
        } catch (error) {
            console.error('Ошибка поиска персонажей:', error);
        }
    }

    async updateNpcInLocation(monsterId, action) {
        if (!this.currentEditingLocationId) return;
        const url = `/api/data/locations/npc/${action}`;
        try {


            if (response.ok) {
                await this.loadNpcs(this.currentEditingLocationId);
                console.info(`Персонаж ${action === 'add' ? 'добавлен' : 'удален'} успешно`);
            } else {
                console.error(`Ошибка при ${action === 'add' ? 'добавлении' : 'удалении'} персонажа`);
            }
        } catch (error) {
            console.error(`Ошибка при ${action === 'add' ? 'добавлении' : 'удалении'} персонажа:`, error);
        }
    }

    showLocationSelect(npcId) {
        const select = document.querySelector(`.npc-location-select[data-npc-id="${npcId}"]`);
        select.classList.toggle('hidden');
    }

    async moveNpcToNewLocation(npcId, newLocationId) {
        try {
            // Удаление из текущей локации





            await this.loadNpcs(this.currentEditingLocationId);
            console.info('Персонаж успешно перемещен');
        } catch (error) {
            console.error('Ошибка перемещения персонажа:', error);
        }
    }

    async editLocationName() {
        const name = this.editNameInput.value.trim();
        const location = this.editNameInput.dataset.id;
        try {


            response.ok ? await this.loadSubLocations() : console.error('Ошибка при удалении локации');
        } catch (error) {
            console.error('Ошибка при удалении локации:', error);
        }
    }
}

window.LocationManager = new LocationManager();
