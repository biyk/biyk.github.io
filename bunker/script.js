const startButton = document.getElementById('startButton');
const image = document.getElementById('image');
const audio = document.getElementById('audio');
const backButton = document.getElementById('backButton');

startButton.addEventListener('click', () => {
    const randomNum = Math.floor(Math.random() * 40) + 1;
	console.log(randomNum);
    const imageUrl = `https://storage.yandexcloud.net/bunker.economicusgame.com/disasters/ru/${randomNum}.png`;
    const audioUrl = `https://storage.yandexcloud.net/bunker.economicusgame.com/disasters/ru/${randomNum}.mp3`;

    image.src = imageUrl;
    audio.src = audioUrl;
    audio.play();

    startButton.style.display = 'none';
    image.style.display = 'block';
    audio.style.display = 'block';
    backButton.style.display = 'block';
});

backButton.addEventListener('click', () => {
    image.src = '';
    audio.pause();
    audio.src = '';

    startButton.style.display = 'block';
    image.style.display = 'none';
    audio.style.display = 'none';
    backButton.style.display = 'none';
});