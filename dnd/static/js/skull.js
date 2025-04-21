let flashingInterval;

function updateSkullColor(color=3) {
    const skull = document.getElementById('skull');
    clearInterval(flashingInterval); // Очистка предыдущего интервала
    function flashColors() {
        const colors = ['green', 'yellow', 'red', 'blue', 'purple'];
        let index = 0;

        flashingInterval = setInterval(() => {
            skull.style.color = colors[index];
            index = (index + 1) % colors.length;
        }, 500); // Изменение цвета каждые 500 миллисекунд
    }

    switch (color) {
        case 0:
            skull.style.color = 'green';
            break;
        case 1:
            skull.style.color = 'yellow';
            break;
        case 2:
            skull.style.color = 'red';
            break;
        case 3:
            flashColors();
            break;
        default:
            skull.style.color = 'black'; // По умолчанию
    }
}

