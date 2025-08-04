console.log('Content script loaded!');

function initializeScript() {
    console.log('DOM content loaded! (or already loaded)');
    const sendButton = document.getElementById('send2ai');
    const dynamicElement = document.getElementById('dynamic-ai');

    console.log('Looking for elements:');
    console.log('sendButton:', sendButton);
    console.log('dynamicElement:', dynamicElement);

    if (sendButton && dynamicElement) {
        console.log('Both elements found! Adding click listener.');
        sendButton.addEventListener('click', () => {
            const textToSend = dynamicElement.value;
            console.log('Button clicked! Text to send:', textToSend);

            chrome.runtime.sendMessage({ action: 'openChatGPT', text: textToSend });
        });
    } else {
        console.log('One or both elements not found.');
    }
}

// Проверяем, если DOM уже загружен
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeScript);
} else {
    // Иначе, запускаем сразу
    initializeScript();
}



if (window.location.host.includes('chatgpt.com')){
    let intervalCount = 0;

    const interval = setInterval(() => {
        intervalCount++;
        console.log(`INJECTED: Попытка ${intervalCount} найти элементы...`);

        try {
            const textarea = document.getElementById('prompt-textarea');
            let textToInject = localStorage.getItem('my')

            if (textarea && textToInject) {
                clearInterval(interval);
                console.log("INJECTED: Элементы найдены! Выполняем действия.");
                let PROMPT = `Ты — мастер Подземелий и Драконов, помогающий придумать сюжетные повороты и развивать приключение. Тебе предоставлены четыре блока информации:

##ИСТОРИЯ##
Краткое описание предыдущих событий, приключений, выборов и решений персонажей. Это помогает понять их цели, мотивации и возможные связи.

##СЕЙЧАС##
Текущее положение дел. Кто где находится, какие события происходят прямо сейчас в локации и за её пределами. В этом блоке описано, в какой ситуации находятся герои и что происходит вокруг.

##ПРОДОЛЖЕНИЕ##
Целевая локация, событие или миссия, к которой должны прийти персонажи. Это может быть новая локация, тайна, угроза или зацепка, которую нужно раскрыть.

##ЗАМЕЧАНИЯ##
Важная информация, на которую нужно ориентироваться при создании истории. 

##Твоя задача##:
Предложи несколько правдоподобных вариантов развития событий в текущей локации или ситуации, чтобы подтолкнуть персонажей к направлению, заданному в блоке "ПРОДОЛЖЕНИЕ". Это могут быть:

новые события в текущей локации (опасности, встречи, слухи);

поведение NPC, которые направят или спровоцируют героев;

неожиданные последствия предыдущих решений;

внешние изменения в мире, отражающие приближение основной цели.

Ответ должен быть логичным, захватывающим и соответствовать настроению истории.
###Далее: четыре блока информации###`
                // Проверка наличия текста перед вводом
                if (textToInject) {
                    document.getElementById('prompt-textarea').innerHTML = `<p>${PROMPT}</p><p>${textToInject}</p>`;
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    setTimeout(()=>{
                        const submitButton = document.getElementById('composer-submit-button');

                        submitButton.click();
                    }, 50)

                    console.log("INJECTED: Текст введен и кнопка нажата.");
                    localStorage.removeItem('my');
                } else {
                    console.log("INJECTED: Текст для ввода пустой.");
                }
            }
        } catch (e) {
            console.log(e)
        }

        // Останавливаемся после 20 попыток, чтобы не виснуть
        if (intervalCount > 20) {
            clearInterval(interval);
            console.log("INJECTED: Не удалось найти элементы за 20 попыток.");
        }

    }, 500); // Интервал в 500 мс

}
