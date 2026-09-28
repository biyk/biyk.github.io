// Остаток авторизации Google. Источник — localStorage['gapi_token_expires'], который
// пишет google.js при консенте/тихом рефреше: JSON.stringify(getTime() + expires_in),
// то есть абсолютный unix-time в секундах. Здесь только чтение и форматирование —
// саму авторизацию не трогаем.
export function authLeftSeconds(expiresRaw, nowSec = Math.floor(Date.now() / 1000)) {
    const expires = parseInt(expiresRaw, 10);
    if (!Number.isFinite(expires) || expires <= 0) return null; // токена ещё нет
    return Math.max(0, expires - nowSec);
}

function pad(value) {
    return String(value).padStart(2, '0');
}

// чч:мм:сс, если осталось больше часа; иначе мм:сс
export function formatAuthLeft(expiresRaw, nowSec = Math.floor(Date.now() / 1000)) {
    const left = authLeftSeconds(expiresRaw, nowSec);
    if (left === null) return null;
    const hours = Math.floor(left / 3600);
    const minutes = Math.floor((left % 3600) / 60);
    const seconds = left % 60;
    return hours > 0
        ? `${hours}:${pad(minutes)}:${pad(seconds)}`
        : `${pad(minutes)}:${pad(seconds)}`;
}
