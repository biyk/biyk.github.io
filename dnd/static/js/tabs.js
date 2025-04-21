// Функция для отображения выбранной вкладки
export function showTab(tabId) {
    // Скрываем все вкладки и деактивируем кнопки
    document.querySelectorAll('.tab-content').forEach(function(tab) {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-button').forEach(function(button) {
        button.classList.remove('active');
    });

    // Показываем выбранную вкладку и активируем кнопку
    document.getElementById(tabId).classList.add('active');
    document.getElementById(tabId+'-controls')?.classList.add('active');
    location.hash = tabId
}

export function checkTab() {
    let tabId = window.location.hash.replace('#','');
    if (document.getElementById(tabId)){
        showTab(tabId);
    }
}

window.showTab = showTab;