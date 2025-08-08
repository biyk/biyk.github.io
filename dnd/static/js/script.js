import {checkForConfigUpdates, checkVersion, getConfig, getInit, sendData} from './script/api.js';
import {
    createNumberedIcon,
    exportImportStorageHandler,
    loadSettingsToLocalStorage,
    processPolygons,
    toggleAdminMode,
    updateInfoBar
} from './script/helpers.js';
import {checkTab} from './tabs.js';
import {createMarkers, drowMarker, initializeMarkerMenu, updateMarkers, initializeSelectionMode} from './marker.js';
import {Settings} from './settings.js';
import {
    createMainPolygon,
    createPolygons,
    setPolygonClickability,
    toggleMainPolygonVisibility,
    updateMainPolygon
} from './script/poligons.js'
import {SlideMenu} from './script/makrer.js'
import {Inventory} from './script/inventory.js'
import {Spells} from './spells.js'
import {Drive, GoogleSheetDB, spreadsheetId, Table} from "./db/google.js";
import {loadAmbienceRadios} from "./ambience.js";
import {loadMaps} from "./map.js";
import {EventDisplay, MyEvents} from "./events.js";

class MapManager {
    constructor() {
        this.mapName = ""; // Имя карты
        this.mainPolygon = null; // Главный полигон
        this.map = null; // Карта
        this.polygons = []; // Массив для полигонов
        this.polygonPoints = []; // Точки текущего полигона
        this.polygonMarkers = []; // Маркеры точек полигона
        this.markerCount = 0; // Счётчик маркеров
        this.drawingMode = false; // Режим рисования
        this.lastUpdated = 0; // Последняя временная метка
        this.admin_mode = window.admin_mode || false; // Админ-режим
        this.config = {};
        this.SlideMenu = {};
        this.selectedIcon = null;
        this.points = new Map();
        this.events = new EventDisplay();
        this.measure = {};
        this.settings = null;
        this.Listner = document.body;
        this.logger = new MyEvents();
    }

    async initMap() {
        await this.doAuth();

        const init = await getInit();
        if (!init) return console.error('no init');

        this.mapName = init.map;
        const config = await getConfig(this.mapName);

        if (!config) return console.error('no config');
        this.config = config;
        this.lastUpdated = config.lastUpdated;
        this.measure = config.measure;
        this.initializeMap(config);
        this.createPolygons(config);
        this.createMarkers(config);
        this.setDrawButtonHandler();
        this.setReverseButtonHandler(config);
        this.setMapEventHandlers();
        this.initializeMarkerMenu();
        this.updateInfoBar(config);
        this.settings = new Settings(config.settings);
        this.drawGrid();
        this.Inventory = new Inventory();
        this.Spells = new Spells();
        await loadAmbienceRadios.call(this);
        await loadMaps.call(this);
        
        // Инициализируем режим выделения маркеров
        initializeSelectionMode();

        this.checkConfig();
    }

    async doAuth() {
        this.logger.start('Авторизация')

        let api = window.GoogleSheetDB || new GoogleSheetDB();
        await api.waitGoogle();
        let callbackLoadData = async () => {
            let drive = new Drive();
            let auth_code = parseInt(localStorage.getItem('auth_code'));

            let configs = await drive.find(`name = "player_${auth_code}.json"`);
            let driveConfigId;
            if (configs.length > 0) {
                driveConfigId = configs[0].id;
            } else {
                let file = await drive.createEmptyFile(`player_${auth_code}.json`);

                let player = {};
                if (auth_code) {
                    player.auth_code = auth_code
                }
                await drive.upload(file, JSON.stringify(player))
                driveConfigId = file;
            }
            let player = await drive.download(driveConfigId);
            if (player.auth_code) {
                localStorage.setItem('auth_code', player.auth_code);
            }

            location.reload();
        }
        let authButton = document.getElementById('auth');
        let settingsButton = document.getElementById('settings');

        if (authButton) {
            let expired = api.expired();
            let auth_code = parseInt(localStorage.getItem('auth_code'));

            if (auth_code && !expired) {
                settingsButton.style.display = 'block';
                authButton.style.display = 'none';
            } else {
                settingsButton.style.display = 'none';
                authButton.style.display = 'block';
            }
            authButton.addEventListener('click', async (e) => {
                let auth_code = parseInt(localStorage.getItem('auth_code'));
                if (!auth_code){
                    auth_code = prompt('Enter auth code');
                    localStorage.setItem('auth_code', auth_code);
                }
                await api.handleAuthClick(callbackLoadData);
            });
        }
        if (settingsButton) {
            settingsButton.addEventListener('click', async (e) => {
                loadSettingsToLocalStorage.call(this);
            });
        }
        this.logger.stop('Авторизация')
    }
    checkConfig() {
        setTimeout(async () => {
            this.logger.start('checkConfig')
            await this.checkForConfigUpdates();
            checkVersion();
            this.checkConfig();
            this.logger.stop('checkConfig')
        }, 7000);
    }

    initializeMap(config) {
        const image = `static/images/${config.image}`;
        const {width, height, maxLevel, minLevel, orgLevel} = config;

        const tileWidth = 256 * Math.pow(2, orgLevel);
        const radius = tileWidth / 2 / Math.PI;
        const rx = width - tileWidth / 2;
        const ry = -height + tileWidth / 2;
        const west = -180;
        const east = (180 / Math.PI) * (rx / radius);
        const north = 85.05;
        const south = (360 / Math.PI) * (Math.atan(Math.exp(ry / radius)) - Math.PI / 4);
        const bounds = [[south, west], [north, east]];

        const mapOptions = {
            maxBounds: bounds,
            zoomControl: this.admin_mode,
            //dragging: this.admin_mode,
            scrollWheelZoom: this.admin_mode,
            doubleClickZoom: this.admin_mode,
            touchZoom: this.admin_mode,
            keyboard: this.admin_mode,
        };

        this.map = L.map('map', mapOptions);
        L.tileLayer(image + '/{z}-{x}-{y}.jpg', {
            maxZoom: maxLevel,
            minZoom: minLevel,
            noWrap: true,
            bounds: bounds,
            attribution: '<a href="https://github.com/oliverheilig/LeafletPano">LeafletPano</a>',
        }).addTo(this.map);

        this.map.setView([config.mapState.center.lat, config.mapState.center.lng], config.mapState.zoom);
    }

    createPolygons(config) {
        createPolygons.call(this, config)
    }

    createMarkers(config) {
        createMarkers.call(this, config)
    }

    createPolygonClickHandler(polygonLayer) {
        if (this.admin_mode) {
            return (e) => {
                if (e.originalEvent.ctrlKey) {
                    this.map.removeLayer(polygonLayer);
                    this.polygons = this.polygons.filter(p => p.layer !== polygonLayer);
                    this.sendData('polygons');
                } else {
                    polygonLayer.isVisible = !polygonLayer.isVisible;
                    polygonLayer.setStyle({
                        fillOpacity: polygonLayer.isVisible ? 1.0 : 0.0,
                        opacity: polygonLayer.isVisible ? 1.0 : 0.0,
                    });
                    console.log(polygonLayer);
                    this.sendData('polygons');
                }
            };
        }
    }

    async sendData(type = false) {
        await sendData.call(this, type);
    }

    setDrawButtonHandler() {
        const drawButton = document.getElementById('draw-button');
        if (!drawButton) return;

        drawButton.addEventListener('click', async (e) => {
            e.preventDefault();
            this.drawingMode = !this.drawingMode;
            drawButton.textContent = this.drawingMode ? "Finish Drawing" : "Draw Polygon";

            if (this.drawingMode) {
                this.setPolygonsOpacity(0.6);
                this.setPolygonClickability(false);
            } else {
                this.setPolygonsOpacity(1.0);
                this.setPolygonClickability(true);

                if (this.polygonPoints.length > 2) {
                    this.createNewPolygon();
                    await this.sendData('polygons');
                } else if (this.polygonPoints.length == 2) {
                    this.polygonMarkers.forEach(marker => this.map.removeLayer(marker));
                    this.measure.points = this.polygonPoints;
                    this.measure.ft = window.prompt('Сколько футов выделено?', 5);
                    await this.calculateDistanceAndDraw()
                } else {

                }
            }
        });
    }

    setReverseButtonHandler(config) {
        const reverseButton = document.getElementById('reverse-button');
        if (reverseButton) {
            reverseButton.addEventListener('click', () => {
                if (this.mainPolygon) {
                    this.updateMainPolygon(config);
                    this.toggleMainPolygonVisibility();
                } else {
                    this.createMainPolygon(config);
                }
            });
        }
    }

    createNewPolygon() {
        const polygonLayer = L.polygon(this.polygonPoints, {
            color: 'black',
            fillColor: 'black',
            fillOpacity: 1.0,
            weight: 1,
        }).addTo(this.map);

        polygonLayer.isVisible = true;
        polygonLayer.clickHandler = this.createPolygonClickHandler(polygonLayer);
        polygonLayer.on('click', polygonLayer.clickHandler);

        this.polygons.push({
            layer: polygonLayer,
            points: this.polygonPoints,
            code: md5(new Date()),
            isVisible: polygonLayer.isVisible || false,
        });

        this.polygonMarkers.forEach(marker => this.map.removeLayer(marker));
        this.polygonMarkers = [];
        this.polygonPoints = [];
        this.markerCount = 0;
        //TODO поправить пересечения
        this.polygons = (processPolygons(this.polygons));
    }

    toggleMainPolygonVisibility() {
        toggleMainPolygonVisibility.call(this);
    }

    createMainPolygon(config) {
        createMainPolygon.call(this, config)
    }

    updateMainPolygon(config) {
        updateMainPolygon.call(this, config);
    }

    async checkForConfigUpdates() {
        await checkForConfigUpdates.call(this);
    }

    updateMarkers(config) {
        updateMarkers.call(this, config);
    }

    setPolygonsOpacity(opacity) {
        this.polygons.forEach(polygon => polygon.layer.setStyle({fillOpacity: opacity, opacity: opacity}));
    }

    setPolygonClickability(clickable) {
        setPolygonClickability.call(this, clickable)
    }

    setMapEventHandlers() {
        this.map.on('zoomend', async () => {
            this.sendData('mapState');
        });

        this.map.on('movestart', () => {
            document.getElementById('map').style.opacity = '0';
        });
        this.map.on('moveend', async () => {
            this.sendData('mapState');
            document.getElementById('map').style.opacity = '1';

        });

        this.map.on('click', async (e) => {
            this.lastClick = e.latlng;
            if (this.drawingMode) {
                this.markerCount += 1;
                this.polygonPoints.push([e.latlng.lat, e.latlng.lng]);

                const marker = L.marker([e.latlng.lat, e.latlng.lng], {
                    icon: createNumberedIcon(this.markerCount),
                    draggable: true
                }).addTo(this.map);
                this.polygonMarkers.push(marker);
            }
            if (this.selectedIcon) {
                // Размещаем маркер с выбранной иконкой
                let markerData = {
                    latlng: e.latlng,
                    selectedIcon: this.selectedIcon
                };
                
                // Если есть дополнительные данные маркера (из импорта), добавляем их
                if (this.selectedMarkerData) {
                    markerData.backgroundColor = this.selectedMarkerData.backgroundColor;
                    markerData.text = this.selectedMarkerData.text;
                    markerData.style = this.selectedMarkerData.style;
                    markerData.show = this.selectedMarkerData.show;
                }
                
                this.drowMarker(markerData);
                
                // Сбрасываем выбранную иконку и данные маркера
                this.selectedIcon = null;
                this.selectedMarkerData = null;
                document.querySelector('.marker-menu').style.display = 'block'; // Показываем сайдбар

                this.setPolygonClickability(true);
                await this.sendData('markers');
            }

        });

        this.map.whenReady(this.whenReady);

        let markerButton = document.getElementById('marker-button');
        if (markerButton) {
            markerButton.addEventListener('click', (e) => {
                const sidebar = document.querySelector('.marker-menu');
                sidebar.style.right = sidebar.style.right === '0px' ? '-33%' : '0px';
                // Загружаем список карт при открытии меню маркеров
                this.loadMapsList();
            })
        }

        // Добавляем обработчики событий для новой функциональности маркеров
        // Используем делегирование событий, так как элементы создаются динамически
        document.addEventListener('change', (e) => {
            if (e.target.id === 'marker-map-select') {
                this.loadMarkersFromMap(e.target.value);
            }
        });
        
        document.addEventListener('click', (e) => {
            if (e.target.id === 'add-marker-from-map-button') {
                this.addMarkerFromMap();
            }
        });


        document.body.addEventListener('update_config', async (e) => {
            let type = e.detail?.type;
            if (type) {
                await this.sendData(type);
            } else {
                await this.sendData('polygons');
            }
        });

        document.body.addEventListener('admin_mode', (e) => {
            this.toggleAdminMode();
        });

        document.body.addEventListener('doAuth', (e) => {
            this.doAuth();
        });


        let sync = document.getElementById('google_sync');

        sync && sync.addEventListener('click', async () => {
            let api = window.GoogleSheetDB || new GoogleSheetDB();
            await api.waitGoogle();
            let configTable = new Table({
                list: 'CONFIG',
                spreadsheetId: spreadsheetId
            });
            let keysTable = new Table({
                list: 'KEYS',
                spreadsheetId: spreadsheetId
            });
            let keys = await keysTable.getAll({formated: true});

            let mapTable = new Table({
                list: this.config.image,
                spreadsheetId: keys.maps
            });

            await mapTable.createList();
            for (let code in this.config) {
                //await mapTable.updateRowByCode(code, {code, value: this.config[code]})
            }

            let bTable = new Table({
                list: 'BEASTS',
                spreadsheetId: keys.external
            });
            await bTable.createList(['code', 'name', 'armor_class', 'hit_points', 'hit_dice', 'challenge_rating', 'experience', 'html']);
            let b = await responce.json();


            for (let e of b) {
                e.code = e.url;
            }
            await bTable.addRows(b);

        });

        exportImportStorageHandler();
    }

    whenReady() {
        checkTab();
        this.SlideMenu = new SlideMenu();
        this.SlideMenu.initializeMapMarkers(this.map);
    }

    drowMarker(data) {
        drowMarker.call(this, data);
    }

    removeMarker(index) {
        const marker = this.points.get(index);
        if (marker) {
            window.mapManager.map.removeLayer(marker);
            this.points.delete(index);
            // Отправляем событие обновления конфигурации после удаления маркера
            this.Listner.dispatchEvent(new CustomEvent('update_config', {detail: {type: 'markers'}}));
        }
    }

    toggleMarker(index) {
        const marker = this.points.get(index);
        if (marker) {
            marker.settings.show = !marker.settings.show
            marker._icon.style.opacity = marker.settings.show ? 1 : (admin_mode) ? 0.5 : 0;
            this.Listner.dispatchEvent(new CustomEvent('update_config', {detail: {type: 'markers'}}));
        }
    }

    updateInfoBar(data) {
        updateInfoBar(data);
    }

    initializeMarkerMenu() {
        initializeMarkerMenu.call(this)
        // Загружаем список карт при инициализации меню маркеров
        this.loadMapsList();
    }

    // Метод для загрузки списка карт
    async loadMapsList() {
        try {
            const mapSelect = document.getElementById('marker-map-select');
            if (!mapSelect) return;
            
            mapSelect.innerHTML = '<option value="">Выберите карту...</option>';
            
            let api = window.GoogleSheetDB || new GoogleSheetDB();
            await api.waitGoogle();
            
            let keysTable = new Table({
                list: 'KEYS',
                spreadsheetId: spreadsheetId
            });
            let keys = await keysTable.getAll({formated: true, caching: 10});
            
            let mapsTable = new Table({
                list: 'MAPS',
                spreadsheetId: keys.maps
            });
            
            let lists = await mapsTable.getLists();
            
            lists.forEach((item) => {
                let title = item.properties.title;
                let option = document.createElement('option');
                option.value = title;
                option.textContent = title;
                mapSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Ошибка при загрузке списка карт:', error);
        }
    }

    // Метод для загрузки маркеров из выбранной карты
    async loadMarkersFromMap(mapName) {
        try {
            const markerSelect = document.getElementById('marker-select');
            const markerSelection = document.getElementById('marker-selection');
            
            if (!mapName) {
                markerSelection.style.display = 'none';
                return;
            }
            
            markerSelect.innerHTML = '<option value="">Выберите маркер...</option>';
            
            let api = window.GoogleSheetDB || new GoogleSheetDB();
            await api.waitGoogle();
            
            let keysTable = new Table({
                list: 'KEYS',
                spreadsheetId: spreadsheetId
            });
            let keys = await keysTable.getAll({formated: true, caching: 10});
            
            let mapTable = new Table({
                list: mapName,
                spreadsheetId: keys.maps
            });
            
            let data = await mapTable.getAll({formated: true});
            let markers = data.markers;
            
            if (markers && markers.length > 0) {
                markers.forEach((markerData) => {
                    let settings = markerData.settings;
                    let option = document.createElement('option');
                    option.value = JSON.stringify(settings);
                    option.textContent = `${settings.selectedIcon.emoji} ${settings.selectedIcon.name || 'Маркер'} (${settings.selectedIcon.number || '№'})`;
                    markerSelect.appendChild(option);
                });
                markerSelection.style.display = 'block';
            } else {
                markerSelection.style.display = 'none';
            }
        } catch (error) {
            console.error('Ошибка при загрузке маркеров из карты:', error);
            document.getElementById('marker-selection').style.display = 'none';
        }
    }

    // Метод для добавления маркера из другой карты
    async addMarkerFromMap() {
        const markerSelect = document.getElementById('marker-select');
        const selectedValue = markerSelect.value;
        
        if (!selectedValue) {
            alert('Пожалуйста, выберите маркер');
            return;
        }
        
        try {
            const markerSettings = JSON.parse(selectedValue);
            
            // Создаем новый маркер с теми же настройками
            const newMarker = {
                selectedIcon: markerSettings.selectedIcon,
                backgroundColor: markerSettings.backgroundColor,
                text: markerSettings.text || '',
                style: markerSettings.style || '',
                show: true
            };
            
            // Устанавливаем выбранную иконку для размещения
            this.selectedIcon = newMarker.selectedIcon;
            this.selectedMarkerData = newMarker;
            
            // Скрываем меню маркеров
            document.querySelector('.marker-menu').style.display = 'none';
            
            // Отключаем кликабельность полигонов для размещения маркера
            this.setPolygonClickability(false);
            
            console.log('Маркер выбран для размещения:', newMarker);
        } catch (error) {
            console.error('Ошибка при добавлении маркера:', error);
            alert('Ошибка при добавлении маркера');
        }
    }

    // Функция для расчета расстояния, добавления маркеров, линии и сетки
    async calculateDistanceAndDraw() {
        let points = this.measure.points;
        if (points.length !== 2) {
            console.error('The function requires exactly two points.');
            return;
        }

        const [point1, point2] = points;

        // Добавление маркеров в точки
        L.marker(point1).addTo(this.map);
        L.marker(point2).addTo(this.map);

        // Вычисление расстояния между точками
        const distance = this.map.distance(point1, point2);
        console.log('Point 1:', point1);
        console.log('Point 2:', point2);
        console.log('Distance (meters):', distance);
        await this.sendData('measure');
        // Рисование сетки
        this.drawGrid();
    }

    // Функция для рисования сетки
    drawGrid() {
        if (this.gridLayer) this.map.removeLayer(this.gridLayer);
        let points = this.measure.points;
        if (points.length !== 2 || !this.settings.show_grid) return;

        const bounds = this.map.getBounds();
        const map = this.map;

        // Определение двух точек и расчёт расстояния между ними в пикселях
        const point1 = map.project([points[0][0], points[0][1]]);
        const point2 = map.project([points[1][0], points[1][1]]);
        const cell_per_step = parseInt(this.measure.ft) / 5
        const stepPixels = Math.sqrt(
            Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2)
        ) / cell_per_step;

        // Определение начальных и конечных точек в пикселях
        const topLeft = map.project(bounds.getNorthWest());
        const bottomRight = map.project(bounds.getSouthEast());

        const lines = [];
        const lines_count = 100
        // Горизонтальные линии
        for (let y = point1.y - lines_count * stepPixels; y <= bottomRight.y; y += stepPixels) {
            const start = map.unproject([topLeft.x, y]);
            const end = map.unproject([bottomRight.x, y]);
            lines.push(L.polyline([
                [start.lat, start.lng],
                [end.lat, end.lng]
            ], {color: 'blue', weight: 1}));
        }

        // Вертикальные линии
        for (let x = point1.x - lines_count * stepPixels; x <= bottomRight.x; x += stepPixels) {
            const start = map.unproject([x, topLeft.y]);
            const end = map.unproject([x, bottomRight.y]);
            lines.push(L.polyline([
                [start.lat, start.lng],
                [end.lat, end.lng]
            ], {color: 'blue', weight: 1}));
        }

        this.gridLayer = L.layerGroup(lines).addTo(map);
    }

    changeMarkerText(id, textarea) {
        const marker = this.points.get(id);
        if (marker) {
            marker.settings.text = textarea.value;
            this.Listner.dispatchEvent(new CustomEvent('update_config', {detail: {type: 'markers'}}));
        }
    }
    changeMarkerStyles(id, textarea) {
        const marker = this.points.get(id);
        if (marker) {
            marker.settings.style = textarea.value;
            this.Listner.dispatchEvent(new CustomEvent('update_config', {detail: {type: 'markers'}}));
        }
    }

    toggleAdminMode() {
        toggleAdminMode.call(this)
    }
}

const mapManager = new MapManager();
window.mapManager = mapManager;
mapManager.initMap();
