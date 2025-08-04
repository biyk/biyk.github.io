chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("BG: Сообщение получено от content.js:", request.action);

    if (request.action === 'openChatGPT') {
        const text = request.text;
        console.log("BG: Действие - открыть ChatGPT. Текст:", text);

        chrome.tabs.create({ url: 'https://chatgpt.com/' }, (newTab) => {
            console.log("BG: Новая вкладка создана, ID:", newTab.id);

            const listener = (tabId, changeInfo) => {
                console.log(`BG: Вкладка ${tabId} обновляется. Статус: ${changeInfo.status}`);

                if (tabId === newTab.id && changeInfo.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    console.log("BG: Вкладка полностью загружена. Запускаем скрипт.");

                    chrome.scripting.executeScript({
                        target: { tabId: newTab.id },
                        func: (textFromArgs) => {
                            window.localStorage.setItem('my', textFromArgs);
                        },
                        args: [text] // Передаем текст как аргумент
                    });
                }
            };
            chrome.tabs.onUpdated.addListener(listener);
        });
    }
});