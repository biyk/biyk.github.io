import {exit, sleep} from './func.js'
import {showTab} from '../tabs.js'
import {getConfig} from "../script/api.js";

export async function map(sleeper) {
    let myExit = async (text) => {
        await fetch('/api/test/end');
        exit(text);
    }

    //бэкап конфига json
    showTab('map')
    await fetch('/api/test/start');
    let manager = window.mapManager;

    console.log("=== передвижение локации ===");
    await sleep(sleeper);
    await (async () => {
        let test_poligon = manager.config.polygons[1];
        let code = test_poligon.code;
        if (!code){
            await myExit("✗ Коды полигонов не заданы");
        }
        const response = await fetch(`/api/test/polygon/${code}`);
        const data = await response.json();
        if (data.status==='success'){
            const isVisible = test_poligon.isVisible
            manager.map.setView([data.centroid[0], data.centroid[1]],manager.config.maxLevel);
            await fetch(`/api/test/click`);
            await sleep(sleeper+300);
            console.log(isVisible,  window.mapManager.polygons[1])
            if(isVisible!==window.mapManager.config.polygons[1].isVisible){
                console.log("✓ Видимость полигона изменена");
            } else {
                await myExit("✗ Полигон не изменил видимость");
            }
        }
    })();

    //рисование полигона
    console.log("=== Проверка рисования полигона ===");
    await sleep(sleeper);
    await (async () => {
        //Удаляем все полигоны
        console.log("=== удаление полигонов ===");
        window.mapManager.createPolygons([]);
        if(window.mapManager.polygons.length===0){
            console.log("✓ полигоны удалены");
        } else {
            await myExit("✗ ошибка удаления полигонов");
        }

        //рисуем полигон
        console.log("=== рисуем полигон ===");
        const drawButton = document.getElementById('draw-button');
        drawButton.click();
        if(window.mapManager.drawingMode){
            console.log("✓ Режим рисования активирован");
        } else {
            await myExit("✗ ошибка перехода в режим рисования");
        }
        const moves = [[-50, 0],[0, -50],[50, 0]];

        for (const move of moves) {
            await fetch(`/api/test/click`);
            window.mapManager.map.panBy(move);
        }
        await fetch(`/api/test/click`);

        drawButton.click();
        await sleep(sleeper);
        //проверить что полигон работает и кликается

        if (1 ){
            let test_poligon = manager.config.polygons[0];

            if (1){
                const isVisible = test_poligon.isVisible
                window.mapManager.map.panBy([-25,25]);
                await sleep(sleeper);
                await fetch(`/api/test/click`);
                await sleep(sleeper+300);

                if(isVisible!==window.mapManager.config.polygons[0].isVisible){
                    console.log("✓ Видимость полигона изменена");
                } else {
                    await myExit("✗ Полигон не изменил видимость");
                }
            }
        }

        //проверить работу черного полигона

    })();

    await fetch('/api/test/end');
}