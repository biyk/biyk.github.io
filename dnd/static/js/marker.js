import {getRandomColor} from "./script/helpers.js";
import {GoogleSheetDB, ORM, spreadsheetId, Table} from "./db/google.js";

// Глобальные переменные для выделения маркеров
let selectionMode = false;
let selectedMarkers = new Set();
let isDraggingSelection = false;
let dragOffset = null;

export function drowMarker(data) {
    //console.log(data);
    let id = data.id  || new Date().getTime();
    const marker = L.marker(data.latlng, {
        icon: L.divIcon({
            className: 'custom-marker',
            html: `<span class="custom-marker-number" >${data.selectedIcon.number || ''}</span>
                    <div style="${data.style}" data-id="${id}">${data.selectedIcon.emoji}</div>`,
        }),
        draggable: window.admin_mode //|| parseInt(id) === parseInt(localStorage.getItem('auth_code'))
    }).addTo(this.map);
    let backgroundColor = data.backgroundColor || data.selectedIcon.backgroundColor || getRandomColor();
    let text = data.text ?? '';
    let style = data.style ?? '';
    //console.log(data);
    if (window.admin_mode){
        marker.bindPopup(`
               <button onclick="window.mapManager.removeMarker(${id})">Remove</button>
               <button onclick="window.mapManager.toggleMarker(${id})">Toggle</button>
               <textarea style="width: 300px;" onchange="window.mapManager.changeMarkerText(${id}, this)">${text}</textarea>
               <textarea style="width: 300px;" onchange="window.mapManager.changeMarkerStyles(${id}, this)">${style}</textarea>
           `);
    }
    marker._icon.style.opacity = data.show ? 1 : (window.admin_mode) ? 0.5: 0;
    marker._icon.style.backgroundColor = backgroundColor;
    marker.settings = {
        latlng: data.latlng,
        selectedIcon: data.selectedIcon,
        text: text,
        backgroundColor: backgroundColor,
        draggable: true,
        show: !!data.show,
        id: id,
    }
    
    // Добавляем обработчики для выделения
    marker.on('dragend', (e) => {
        if (!isDraggingSelection) {
            document.body.dispatchEvent(new CustomEvent('update_config', {detail: {type: 'markers'}}));
        }
    })
    
    // Обработчик клика для выделения/снятия выделения
    marker.on('click', (e) => {
        if (selectionMode) {
            e.originalEvent.stopPropagation();
            toggleMarkerSelection(id, marker);
        }
    });
    
    // Обработчик начала перетаскивания для выделенных маркеров
    marker.on('dragstart', (e) => {
        if (selectedMarkers.has(id) && selectedMarkers.size > 1) {
            isDraggingSelection = true;
            const markerLatLng = marker.getLatLng();
            dragOffset = {
                lat: markerLatLng.lat,
                lng: markerLatLng.lng
            };
        }
    });
    
    // Обработчик окончания перетаскивания для выделенных маркеров
    marker.on('dragend', (e) => {
        if (isDraggingSelection) {
            isDraggingSelection = false;
            dragOffset = null;
            // Сохраняем изменения всех выделенных маркеров
            selectedMarkers.forEach(markerId => {
                const selectedMarker = window.mapManager.points.get(markerId);
                if (selectedMarker) {
                    selectedMarker.settings.latlng = selectedMarker.getLatLng();
                }
            });
            document.body.dispatchEvent(new CustomEvent('update_config', {detail: {type: 'markers'}}));
        }
    });
    
    // Обработчик перетаскивания для выделенных маркеров
    marker.on('drag', (e) => {
        if (isDraggingSelection && selectedMarkers.size > 1) {
            const currentLatLng = marker.getLatLng();
            const deltaLat = currentLatLng.lat - dragOffset.lat;
            const deltaLng = currentLatLng.lng - dragOffset.lng;
            
            // Перемещаем все выделенные маркеры
            selectedMarkers.forEach(markerId => {
                if (markerId !== id) {
                    const otherMarker = window.mapManager.points.get(markerId);
                    if (otherMarker) {
                        const otherLatLng = otherMarker.getLatLng();
                        otherMarker.setLatLng([
                            otherLatLng.lat + deltaLat,
                            otherLatLng.lng + deltaLng
                        ]);
                    }
                }
            });
            
            dragOffset = {
                lat: currentLatLng.lat,
                lng: currentLatLng.lng
            };
        }
    });
    
    marker.on('popupopen', (e) => {
        let popup = marker._popup._contentNode.getElementsByTagName('textarea')[0];
        popup.style.height = popup.scrollHeight + 'px'
    })
    this.points.set(id, marker);
}

// Функция переключения выделения маркера
function toggleMarkerSelection(id, marker) {
    if (selectedMarkers.has(id)) {
        selectedMarkers.delete(id);
        marker._icon.classList.remove('selected-marker');
    } else {
        selectedMarkers.add(id);
        marker._icon.classList.add('selected-marker');
    }
    updateSelectionDisplay();
}

// Функция обновления отображения выделения
function updateSelectionDisplay() {
    // Обновляем счетчик выделенных маркеров
    const selectionCounter = document.getElementById('selection-counter');
    if (selectionCounter) {
        selectionCounter.textContent = selectedMarkers.size;
    }
}

// Функция очистки выделения
function clearSelection() {
    selectedMarkers.forEach(id => {
        const marker = window.mapManager.points.get(id);
        if (marker) {
            marker._icon.classList.remove('selected-marker');
        }
    });
    selectedMarkers.clear();
    updateSelectionDisplay();
}

// Функция инициализации режима выделения
export function initializeSelectionMode() {
    // Добавляем обработчики клавиатуры
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Control' || e.key === 'Ctrl') {
            selectionMode = true;
            document.body.classList.add('selection-mode');
            showSelectionUI();
            
            // Закрываем все открытые попапы при входе в режим выделения
            window.mapManager.points.forEach((marker) => {
                if (marker.isPopupOpen()) {
                    marker.closePopup();
                }
            });
        }
    });
    
    document.addEventListener('keyup', (e) => {
        if (e.key === 'Control' || e.key === 'Ctrl') {
            selectionMode = false;
            document.body.classList.remove('selection-mode');
            hideSelectionUI();
            clearSelection();
        }
    });
    
    // Обработчик клика по карте для снятия выделения
    window.mapManager.map.on('click', (e) => {
        if (selectionMode && !e.originalEvent.target.closest('.custom-marker')) {
            clearSelection();
        }
    });
}

// Функция показа UI выделения
function showSelectionUI() {
    let ui = document.getElementById('selection-ui');
    if (!ui) {
        ui = document.createElement('div');
        ui.id = 'selection-ui';
        ui.className = 'selection-ui';
        ui.innerHTML = `
            <div class="selection-info">
                <span>Режим выделения активен</span>
                <span id="selection-counter">0</span> маркеров выделено
            </div>
            <div class="selection-controls">
                <button id="clear-selection">Очистить выделение</button>
                <button id="delete-selected">Удалить выделенные</button>
            </div>
        `;
        document.body.appendChild(ui);
        
        // Обработчики кнопок
        document.getElementById('clear-selection').addEventListener('click', clearSelection);
        document.getElementById('delete-selected').addEventListener('click', deleteSelectedMarkers);
    }
    ui.style.display = 'block';
}

// Функция скрытия UI выделения
function hideSelectionUI() {
    const ui = document.getElementById('selection-ui');
    if (ui) {
        ui.style.display = 'none';
    }
}

// Функция удаления выделенных маркеров
function deleteSelectedMarkers() {
    if (selectedMarkers.size === 0) return;
    
    if (confirm(`Удалить ${selectedMarkers.size} выделенных маркеров?`)) {
        selectedMarkers.forEach(id => {
            window.mapManager.removeMarker(id);
        });
        selectedMarkers.clear();
        updateSelectionDisplay();
    }
}

export function createMarkers(config){
    if (config.markers){
        config.markers.forEach(markerData => {
            let settings = markerData.settings;
            this.drowMarker({
                id: settings.id,
                selectedIcon: settings.selectedIcon,
                latlng: settings.latlng,
                backgroundColor: settings.backgroundColor,
                show: settings.show,
                style: settings.style,
                text: settings.text,
            })
        });
    }
}

export function updateMarkers(config){
    // Создаем Set с ID маркеров из конфигурации для быстрого поиска
    const configMarkerIds = new Set(config.markers.map(markerData => markerData.settings.id));
    
    // Удаляем маркеры, которых нет в конфигурации
    this.points.forEach((marker, id) => {
        if (!configMarkerIds.has(id)) {
            marker.remove(); // Удаляем маркер с карты
            this.points.delete(id); // Удаляем из коллекции
        }
    });
    
    // Обновляем или создаем маркеры из конфигурации
    config.markers.forEach(markerData => {
        try {
            let id = markerData.settings.id;
            let marker = this.points.get(id);
            
            // Если маркер не существует, создаем его
            if (!marker) {
                this.drowMarker({
                    id: markerData.settings.id,
                    selectedIcon: markerData.settings.selectedIcon,
                    latlng: markerData.settings.latlng,
                    backgroundColor: markerData.settings.backgroundColor,
                    show: markerData.settings.show,
                    style: markerData.settings.style,
                    text: markerData.settings.text,
                });
                return; // Выходим, так как маркер только что создан
            }
            
            let show = markerData.settings.show
            marker.settings.show = show;
            marker.setLatLng([
                markerData.settings.latlng.lat,
                markerData.settings.latlng.lng,
            ])
            marker._icon.style.opacity = show ? 1 : (window.admin_mode) ? 0.5: 0;
        } catch (error) {
            console.log(markerData,error);
        }
  
    });
}

export function initializeMarkerMenu(){
    const sidebar = document.createElement('div');
    sidebar.classList.add('marker-menu', 'side-menu');
    this.menu = sidebar;
    const list = document.createElement('ul');
    
    // Создаем кнопки для каждой иконки
    this.points.forEach((data,id) => {
        let icon = data.settings.selectedIcon
        const point_div = document.createElement('div');
        const button = document.createElement('button');
        const save = document.createElement('button');
        const input_icon = document.createElement('input');
        const input_name = document.createElement('input');
        const input_number = document.createElement('input');
        input_icon.style.width = '100px';
        input_number.style.width = '30px';
        save.innerHTML = 'Save';
        save.value = id;
        button.dataset.id = id;
        button.classList.add('point-button', 'js-go-to-point');
        save.classList.add('point-button');
        button.innerHTML = data.settings.selectedIcon.emoji;
        input_icon.value = data.settings.selectedIcon.emoji;
        button.style.backgroundColor = data.settings.backgroundColor;
        input_name.value = data.settings.selectedIcon.name;
        input_number.value = data.settings.selectedIcon.number ?? '';
        point_div.appendChild(input_icon);
        point_div.appendChild(input_name);
        point_div.appendChild(input_number);
        point_div.appendChild(button);
        point_div.appendChild(save);
        button.addEventListener('click', () => {
            let id = data.settings.id;
            let point = this.points.get(id);
            let latlng = point.settings.latlng;
            navigator.clipboard.writeText(data.settings.backgroundColor)
            this.map.setView([latlng.lat, latlng.lng]);
        });
        save.addEventListener('click', () => {
            let id = data.settings.id;
            let point = this.points.get(id);
            let icon = document.querySelector(`[data-id='${id}'].js-go-to-point`);
            let new_icon = input_icon.value;
            icon.innerHTML = new_icon;
            point.settings.selectedIcon.emoji = new_icon;
            point.settings.selectedIcon.name = input_name.value;
            point.settings.selectedIcon.number = input_number.value;
            document.body.dispatchEvent(new CustomEvent('update_config', {detail: {type: 'markers'}}));
        });
        list.appendChild(point_div);
    });
    
    // Форма добавления нового маркера
    let adding = document.createElement('div');
    let add_input = document.createElement('input');
    let add_name = document.createElement('input');
    let add_number = document.createElement('input');
    let add_color = document.createElement('input');
    let add_button = document.createElement('button');
    let color = getRandomColor();
    add_color.value = color;
    add_color.style.backgroundColor = color;
    add_color.addEventListener('keyup', ()=>{
        add_color.style.backgroundColor = add_color.value;
    });
    add_input.style.width = '100px';
    add_number.style.width = '30px';
    add_button.innerHTML = `Добавить`;
    add_button.addEventListener('click', () => {
        this.selectedIcon = {
            name: add_name.value,
            number: add_number.value,
            emoji: add_input.value,
            backgroundColor: add_color.value
        }; // Запоминаем выбранную иконку
        sidebar.style.display = 'none'; // Скрываем сайдбар
        this.setPolygonClickability(false);
    });
    adding.appendChild(add_button);
    adding.appendChild(add_input);
    adding.appendChild(add_name);
    adding.appendChild(add_number);
    adding.appendChild(add_color);
    list.appendChild(adding);
    
    // Форма добавления маркеров из других карт
    let addFromMapsDiv = document.createElement('div');
    addFromMapsDiv.innerHTML = `
        <h4>Добавить маркер из другой карты</h4>
        <div class="map-selection">
            <label>Выберите карту: 
                <select id="marker-map-select">
                    <option value="">Выберите карту...</option>
                </select>
            </label>
        </div>
        <div class="marker-selection" id="marker-selection" style="display: none;">
            <label>Выберите маркер: 
                <select id="marker-select">
                    <option value="">Выберите маркер...</option>
                </select>
            </label>
            <button id="add-marker-from-map-button" class="add-button">[+] Добавить</button>
        </div>
    `;
    list.appendChild(addFromMapsDiv);
    
    sidebar.appendChild(list);
    document.body.appendChild(sidebar);
}

