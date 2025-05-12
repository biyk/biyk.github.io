// Функция для получения начальной конфигурации
import {setAudio, updateInfoBar} from "./helpers.js";
import {GoogleSheetDB, spreadsheetId, Table} from "../db/google.js";

async function checkData(data) {
    let api = window.GoogleSheetDB || new GoogleSheetDB();
    await api.waitGoogle();
    let mapTable = await getMapTable();
    let exist = await mapTable.exist();
    if (!exist){
        await mapTable.createList()
    }
    const response = await fetch(`static/json/default.json`);
    let result = null;
    if (response.ok) {
        result = await response.json();
        for (let code in result) {
            if (!data[code]) {
                if (typeof result[code] == 'object') {
                    await mapTable.addRow({code, value: JSON.stringify(result[code])})
                } else {
                    await mapTable.addRow({code, value: result[code]})
                }
            }
        }
    } else {
        console.error(`Error get map config for ${mapName}`);
    }
    return result;
}

export async function getInit() {
    logger.start('getInit')

    let api = window.GoogleSheetDB || new GoogleSheetDB();
    await api.waitRead();
    let configTable = new Table({
        list: 'CONFIG',
        spreadsheetId: spreadsheetId
    });
    let data = await configTable.getAll({formated: true});
    let mapTable = await getMapTable();

    let mapData = await mapTable.getAll({formated: true});

    if (window.admin_mode){
        await checkData(mapData);
    }
    logger.stop('getInit')
    return data;
}

// Функция для получения конфигурации карты по имени
export async function getConfig() {
    let mapTable = await getMapTable();
    return await mapTable.getAll({caching: true, formated: true});
}

export async function sendData(type = 'polygons') {
    if (!window.admin_mode) {
        return true;
    }
    console.log('sendData', type);
    let api = window.GoogleSheetDB || new GoogleSheetDB();
    await api.waitWrite();

    const polygonsData = this.polygons.map(polygon => ({
        points: polygon.points,
        code: polygon.code,
        isVisible: polygon.layer.isVisible,
    }));
    const markerData = Array.from(this.points.values()).map(point => {
        point.settings.latlng = point._latlng
        return {
            settings: point.settings,
        };
    });
    const center = this.map.getCenter();
    const zoomLevel = this.map.getZoom();
    const body = {mapName: this.mapName};
    switch (type) {
        case 'polygons':
            body.polygons = polygonsData;
            body.mainPolygon = this.mainPolygon ? {points: this.mainPolygon.getLatLngs()} : null;
            break;
        case 'markers':
            body.markers = markerData;
            break;
        case 'measure':
            body.measure = this.measure;
            break;
        case 'settings':
            body.settings = this.settings;
            break;
        case 'mapState':
            body.mapState = {
                center: {lat: center.lat, lng: center.lng},
                zoom: zoomLevel,
            };
            break;
    }
    let mapTable = await getMapTable();
    await mapTable.updateRowByCode(type, {code: type, value: body[type]});


}

export async function checkForConfigUpdates() {
    if (window.admin_mode) return;
    let mapTable = await getMapTable();
    const config = await mapTable.getAll({formated: true});

    if (config.active=='0') return location.reload(true)
    if (config) {
        console.debug(config);
        this.lastUpdated = config.lastUpdated;
        this.createPolygons(config);
        setAudio(config);

        if (typeof startCountdown !== 'undefined') startCountdown(config.init?.timer);
        if (typeof updateSkullColor !== 'undefined') updateSkullColor(config.init.rating);
        if (typeof updateInfoBar !== 'undefined') updateInfoBar(config);
        this.measurePoints = config.measure.points;
        this.settings.updateSettings(config.settings);
        this.map.setView([config.mapState.center.lat, config.mapState.center.lng], config.mapState.zoom);
        this.drawGrid();
        this.updateMarkers(config)
    }
}

/**
 *
 * @param map
 * @returns {Promise<Table>}
 */
export async function getMapTable(map = null) {

    let configTable = new Table({
        list: 'CONFIG',
        spreadsheetId: spreadsheetId
    });
    let config = await configTable.getAll({caching: true, formated: true});
    let keysTable = new Table({
        list: 'KEYS',
        spreadsheetId: spreadsheetId
    });
    let keys = await keysTable.getAll({caching: true, formated: true});
    return new Table({
        list: map || config.map,
        spreadsheetId: keys.maps
    });
}

export async function getPlayerTable() {
    let keysTable = new Table({
        list: 'KEYS',
        spreadsheetId: spreadsheetId
    });
    let keys = await keysTable.getAll({caching: true, formated: true});
    return new Table({
        list: localStorage.getItem('auth_code'),
        spreadsheetId: keys.players
    });
}