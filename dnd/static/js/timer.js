function startCountdown(endTime) {
    window.startTime = new Date().getTime();
    const countdownMinutes = 5; // Укажите длительность таймера в минутах
    window.endTime = endTime * 1000;
    const canvas = document.getElementById('timerCanvas');
    const ctx = canvas.getContext('2d');
    const timerText = document.getElementById('timerText');

    // Настройки для Canvas
    canvas.width = 75;
    canvas.height = 75;
    const radius = canvas.width / 2 - 20;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Устанавливаем текст один раз
    timerText.style.display = 'block';

    function updateTimer() {
        const now = new Date().getTime();
        const remainingTime = Math.max(0, window.endTime - now);
        const totalSeconds = Math.floor(remainingTime / 1000);
        // Вычисляем прогресс таймера
        const percent = remainingTime / (window.endTime - window.startTime);

        // Обновляем текст таймера
        timerText.innerHTML = `${totalSeconds.toString().padStart(2, '0')}`;

        // Очищаем и рисуем круговой таймер
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        ctx.arc(
            centerX,
            centerY,
            radius,
            -Math.PI / 2,
            -Math.PI / 2 - 2 * Math.PI * percent,
            true
        );
        ctx.lineWidth = 30;
        ctx.strokeStyle = 'blue';
        ctx.stroke();

        // Проверка на окончание таймера
        if (remainingTime > 0) {
            timerText.style.display = 'block';
            requestAnimationFrame(updateTimer);
        } else {
            timerText.style.display = 'none';
        }
    }

    // Запускаем таймер
    updateTimer();
}
