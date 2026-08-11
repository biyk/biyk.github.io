export function formatDateTime(date = new Date()) {
    return new Date(date).toLocaleString('ru-RU');
}
