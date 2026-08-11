// Стабы браузерных глобалов для Node-юнитов, которые конструируют Table.
// Полноценный jsdom не нужен: конструктор Table трогает только
// `gapi.client.sheets` и `sessionStorage` (google.js).
function storageStub() {
    const map = new Map();
    return {
        getItem: (key) => (map.has(key) ? map.get(key) : null),
        setItem: (key, value) => void map.set(key, String(value)),
        removeItem: (key) => void map.delete(key),
        _map: map,
    };
}

if (!globalThis.gapi) {
    globalThis.gapi = { client: { sheets: {} } };
}
if (!globalThis.window) {
    globalThis.window = {};
}
// Подменяем GoogleSheetDB, чтобы конструктор Table не тянул document/gapi-скрипты
if (!globalThis.window.GoogleSheetDB) {
    class StubGoogleSheetDB {}
    globalThis.window.GoogleSheetDB = StubGoogleSheetDB;
}
if (!globalThis.sessionStorage) {
    globalThis.sessionStorage = storageStub();
}
if (!globalThis.localStorage) {
    globalThis.localStorage = storageStub();
}
