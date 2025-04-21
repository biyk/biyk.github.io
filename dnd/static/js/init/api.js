export async function loadInitiativeData() {
    fetch("/api/config/init")
        .then(response => {
            if (!response.ok) throw new Error(`Ошибка загрузки: ${response.status}`);
            return response.json();
        })
        .then(data => {
            this.currentRound = data.round || 0;
            this.currentCharacterIndex = data.try || 0;
            this.charactersData = data.all || [];
            this.displayInfoBlocks();
            this.displayCharacters();
            this.fillParentSelect()
        })
        .catch(error => console.error("Ошибка при загрузке данных:", error));
}

// Функция для отправки данных на сервер
export  function  sendInit() {
    const dataToSend = {
        round: this.currentRound,
        try: this.currentCharacterIndex,
        all: this.charactersData,
        rating: this.rating,
        next: this.nextCharacterIndex,
        fighting: this.fighting,
    };
    fetch("/api/config/init", {
        method: "POST",
        headers: { "Content-Type": "application/json;charset=UTF-8" },
        body: JSON.stringify(dataToSend)
    }).catch(error => console.error("Ошибка при отправке данных:", error));
}
export async function infoCharacter(name) {
    // Поиск персонажа
    const clear_name = name.replace(/[0-9]/g, '').trim();
    const response = await fetch(`/api/data/monsters/html?name=${encodeURIComponent(clear_name)}`);
    const text = await response.text();

    // Создание попапа
    const popup = document.createElement('div');
    popup.className = 'popup-overlay';

    popup.innerHTML = `
        <div class="popup-content">
            <div class="popup-text">${text}</div>
            <button class="popup-close-btn">OK</button>
        </div>
    `;

    // Добавляем попап на страницу
    document.body.appendChild(popup);

    // Закрытие попапа при клике на кнопку
    popup.querySelector('.popup-close-btn').addEventListener('click', () => {
        document.body.removeChild(popup);
    });
}
