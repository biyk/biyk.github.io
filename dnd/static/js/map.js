import {GoogleSheetDB, spreadsheetId, Table} from "./db/google.js";
import {getMapTable} from "./script/api.js";

export async function loadMaps() {
    let selectMap = document.getElementById('settings-map');
    if (!selectMap) return;
    let api = window.GoogleSheetDB || new GoogleSheetDB();
    await api.waitGApi();
    let keysTable = new Table({
        list: 'KEYS'
    });
    let keys = await keysTable.getAll({formated: true, caching: true});
    let mapsTable = new Table({
        spreadsheetId: keys.maps
    });
    let lists = await mapsTable.getLists();
    lists.forEach((item)=>{
        let title = item.properties.title;
        let selected = this.mapName === title?'selected':'';
        selectMap.insertAdjacentHTML('beforeend', `<option ${selected} value="${title}">${title}</option>`);
    });
    selectMap.onchange = async () => {
        let map = selectMap.value
        //деактивируем текущую карту
        let localMap = await getMapTable();
        await localMap.updateRowByCode('active', {value: 0})

        //активируем новую карту
        let nextMap = await getMapTable(map);
        await nextMap.updateRowByCode('active', {value: 1})

        // прописываем конфиге новую карту
        let configTable = new Table({
            list: 'CONFIG',
        });
        await configTable.updateRowByCode('map', {value: map})
    }
}