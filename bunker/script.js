const startButton = document.getElementById('startButton');
const image = document.getElementById('image');
const audio = document.getElementById('audio');
const backButton = document.getElementById('backButton');
const iframe = document.getElementById('iframe');

const myArray = [
    "https://player.vimeo.com/video/1000318672?&title=0&byline=0&portrait=0",
    "https://player.vimeo.com/video/1001943113?h=820770235e&title=0&byline=0&portrait=0",
    "https://player.vimeo.com/video/1001943155?h=670b7de8f2&title=0&byline=0&portrait=0",
    "https://player.vimeo.com/video/1001943185?h=731973a937&title=0&byline=0&portrait=0",
    "https://player.vimeo.com/video/1001943220?h=fe7101d2e1&title=0&byline=0&portrait=0",
    "https://player.vimeo.com/video/1001943261?h=2548ff9dd9&title=0&byline=0&portrait=0",
    "https://player.vimeo.com/video/1001943306?h=095949bda4&title=0&byline=0&portrait=0",
    "https://player.vimeo.com/video/1001943352?h=c5c3149828&title=0&byline=0&portrait=0",
    "https://player.vimeo.com/video/1001943379?h=b2e79c52cc&title=0&byline=0&portrait=0",
    "https://player.vimeo.com/video/1001943410?h=349a97b50d&title=0&byline=0&portrait=0",
    "https://player.vimeo.com/video/1010548635?h=7405a4c690&title=0&byline=0&portrait=0",
    "https://player.vimeo.com/video/1010548675?h=4dd04511f1&title=0&byline=0&portrait=0",
    "https://player.vimeo.com/video/1010548710?h=b5bd2c48dc&title=0&byline=0&portrait=0",
	"14",
    "https://player.vimeo.com/video/1010548595?h=f81b31d151&title=0&byline=0&portrait=0",
    "https://player.vimeo.com/video/1014382431?h=736b720522&title=0&byline=0&portrait=0",
    "https://player.vimeo.com/video/1014382491?h=f476bf1dc1&title=0&byline=0&portrait=0",
    "https://player.vimeo.com/video/1014382554?h=e4e6a8528f&title=0&byline=0&portrait=0",
	"19",
    "https://player.vimeo.com/video/1014382635?h=003b3595b8&title=0&byline=0&portrait=0",
    "https://player.vimeo.com/video/1019882063?h=dc5830d4b1&title=0&byline=0&portrait=0",
    "https://player.vimeo.com/video/1021078822?h=ce665ba11c&title=0&byline=0&portrait=0",
    "https://player.vimeo.com/video/1021079135?h=233477b0cf&title=0&byline=0&portrait=0",
    "https://player.vimeo.com/video/1021079553?h=1c8a12a004&title=0&byline=0&portrait=0",
    "https://player.vimeo.com/video/1019898719?h=1e2f03591d&title=0&byline=0&portrait=0"
];


function setBynumber(randomNum)
{
	const imageUrl = `https://storage.yandexcloud.net/bunker.economicusgame.com/disasters/ru/${randomNum}.png`;
    const audioUrl = `https://storage.yandexcloud.net/bunker.economicusgame.com/disasters/ru/${randomNum}.mp3`;
	const iframeUrl = myArray[randomNum - 1];

    image.src = imageUrl;
    audio.src = audioUrl;
	iframe.src = iframeUrl;
	
	if (!iframeUrl || iframeUrl.length==0) audio.play();

    startButton.style.display = 'none';
    image.style.display = 'block';
    audio.style.display = 'block';
    backButton.style.display = 'block';
    iframe.style.display = 'block';
}

startButton.addEventListener('click', () => {
    let randomNum = Math.floor(Math.random() * 40) + 1;
	if (randomNum <10) randomNum = '0' + randomNum
	console.log(randomNum);
	setBynumber(randomNum)

});

backButton.addEventListener('click', () => {
    image.src = '';
    audio.pause();
    audio.src = '';

    startButton.style.display = 'block';
    image.style.display = 'none';
    audio.style.display = 'none';
    backButton.style.display = 'none';
    iframe.style.display = 'none';
});