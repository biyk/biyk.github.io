import {exit, sleep} from './func.js'
export async function tab(sleeper) {

    //Тест
    await sleep(sleeper);
    await (async () => {
        let isTabActive = location.hash.replace('#','')==document.querySelector('.tab-content.active')?.id;
        if(isTabActive){
            console.log("✓ id таба совпадает с хэшем");
        } else {
            exit("✗ id таба не совпадает с хэшем");
        }
    })();

}


