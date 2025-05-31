// Функция для отображения выбранной вкладки
export function showTab(tabId, options={}) {
    let {sidebar, width} = options;

    let activeTab = document.querySelectorAll('.tab-content.active');
    if (activeTab.length>2){//карта и кнопки внизу... их наверное нужно убратьт
        tabId = sidebar;
        sidebar = null;
    }
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

    if (sidebar){
        document.getElementById(sidebar).classList.add('active');
        document.getElementById(sidebar+'-controls')?.classList.add('active');
        document.getElementsByClassName('admin-menu')[0].style.right = '0px'
        document.getElementsByClassName('admin-menu')[0].style.width = width
    } else {
        document.getElementsByClassName('admin-menu')[0].style.right = ''
        document.getElementsByClassName('admin-menu')[0].style.width = ''
        location.hash = tabId;
    }
}

export function checkTab() {
    let tabId = window.location.hash.replace('#','');
    if (document.getElementById(tabId)){
        showTab(tabId);
    }
}

window.showTab = showTab;