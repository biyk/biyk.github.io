# WORK: замена GoogleDrive.js на общий google.js

## Суть

Общий `dnd/static/js/db/google.js` уже содержит всё что нужно:
- `GoogleSheetDB` — auth (gapi+gis), token management, те же API key/Client ID
- `Drive` class — `upload(fileId, content)`, `download(fileId)`, `find(query)`, `createEmptyFile()`, `deleteFile()` — полный CRUD для Drive файлов
- Скоупы уже включают `drive` + `sheets` + `calendar`
- Дискавери доки уже включают Drive v3

Дора дублирует 184 строки auth/upload/download в `GoogleDrive.js` — те же API key, тот же паттерн gapi+gis.

## Файлы под правку

### 1. `dora/tests.html`
- Убрать `<script src="js/io/GoogleDrive.js">` (строка 30) — файл будет удалён
- Удалить группу тестов 15 (строки 482–497, `App.GoogleDrive` interface) — Google integration тестируется вручную в браузере

### 2. `dora/index.html`
- Добавить скрытые кнопки в конец `<body>` перед закрывающим `</body>`:
  ```html
  <button id="authorize_button" style="display:none;"></button>
  <button id="signout_button" style="display:none;"></button>
  ```
- Убрать `<script src="js/io/GoogleDrive.js">` (строка 83)
- Оставить `<script src="js/app.js">` БЕЗ `type="module"` (см. Совместимость модулей)

### 3. `dora/js/app.js` (~20 строк правок)
- В `App.init()`: заменить `App.GoogleDrive.init()` на dynamic import:
  ```js
  import('../../dnd/static/js/db/google.js').then(({ GoogleSheetDB, Drive }) => {
    new GoogleSheetDB();
    App.Drive = new Drive();
    _updateGDriveBtn();
  }).catch(err => console.warn('[App] Google API:', err));
  ```
- `_handleGDriveAuth()`: программный клик `document.getElementById('authorize_button').click()`
- `_handleGDriveExport()`: `App.Drive.find(...)` → `App.Drive.upload(fileId, json)` или `App.Drive.createEmptyFile(...)` → `App.Drive.upload()`
- `_handleGDriveImport()`: `App.Drive.find(...)` → `App.Drive.download(fileId)`
- `_updateGDriveBtn()`: проверять через `gapi.client.getToken()`

### 4. `dora/js/io/GoogleDrive.js` → УДАЛИТЬ

### 5. НЕ ТРОГАТЬ
- `DataStore.js` — localStorage остаётся основным хранилищем (офлайн-first), Drive только для export/import
- Все остальные dora-скрипты — IIFE на `window.App`, модульность app.js не затрагивает

## Flow

```
Авторизация:
  GoogleSheetDB constructor → gapi+gis → привязка к authorize_button
  Клик «Войти» → programmatic click → OAuth → токен в localStorage

Экспорт:
  drive.find("name='imDoraPlan.json' and trashed=false")
  → есть: drive.upload(fileId, json)
  → нет:  drive.createEmptyFile(...) → drive.upload(newId, json)

Импорт:
  drive.find(...) → drive.download(fileId) → DataStore.importData(content)

Офлайн:
  localStorage — primary (как сейчас)
  Drive — только по кнопке (manual export/import)
```

## Совместимость модулей

**Проблема:** `tests.html` загружает `app.js` как обычный `<script>` (строка 34). Если сделать `app.js` модулем (`<script type="module">`), `tests.html` сломается — модули не работают как обычные скрипты.

**Решение:** dynamic `import()` внутри обычного `app.js`:
- `app.js` остаётся обычным `<script>` — `tests.html` работает без изменений
- Google API грузится асинхронно в фоне, приложение работает оффлайн без задержек
- Нет timing-проблем (DOMContentLoaded + module deferred)
- Динамический import работает в любом современном браузере

**Совместимость с existing кодом:**
- `GoogleSheetDB` constructor ищет `document.getElementById('authorize_button')` — кнопки уже в DOM (добавлены в index.html)
- `GoogleSheetDB` привязывает `authorize_button.onclick` к自己 `handleAuthClick` — dora's toolbar кнопка триггерит это программно
- Token storage keys (`gapi_token`, `gapi_token_expires`) совпадают с текущими — миграция не нужна

## Пропущенные моменты (обнаружены при ревью)

### 1. Мёртвый `gdrive:ready` listener
`app.js:182` — `App.EventBus.on('gdrive:ready', _updateGDriveBtn)` в `_defineGlobals()`. Новый `GoogleSheetDB` **не** эмитит `gdrive:ready` на `App.EventBus`. Строка удалить.

### 2. Guard в `_updateGDriveBtn()`
`app.js:183` — `_updateGDriveBtn()` вызывается синхронно в `_defineGlobals()`, до завершения async-загрузки Google API. Если внутри `gapi.client.getToken()` — упадёт (gapi ещё не загружен). Нужна guard-проверка:
```js
function _updateGDriveBtn() {
  const btn = document.getElementById('gdrive-auth-btn');
  if (!btn) return;
  if (!App.Drive || !window.gapi || !gapi.client) {
    btn.textContent = '☁ Войти';
    btn.title = 'Авторизация Google';
    return;
  }
  const token = gapi.client.getToken();
  if (token && token.access_token) {
    btn.textContent = '☁ Выйти';
    btn.title = 'Выйти из Google';
  } else {
    btn.textContent = '☁ Войти';
    btn.title = 'Авторизация Google';
  }
}
```

### 3. Авторизация: callback-мост
Текущий `_handleGDriveExport/Import` вызывает `App.GoogleDrive.auth().then(...)`. У `GoogleSheetDB` нет метода `auth()` который возвращает Promise. Авторизация запускается через клик по `authorize_button`, результат приходит в callback токен-клиента.

**Решение:** после клика по `authorize_button`, поллинг `gapi.client.getToken()` с `setTimeout`:
```js
function _waitForAuth(timeout = 10000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    (function check() {
      const token = window.gapi && gapi.client && gapi.client.getToken();
      if (token && token.access_token) return resolve(token);
      if (Date.now() - t0 > timeout) return reject(new Error('Auth timeout'));
      setTimeout(check, 200);
    })();
  });
}
```
Тогда `_handleGDriveExport`:
```js
function _handleGDriveExport() {
  if (!App.Drive || !window.gapi || !gapi.client || !gapi.client.getToken()) {
    document.getElementById('authorize_button').click();
    _waitForAuth().then(_doGDriveExport).catch(err => {
      alert('Авторизация не завершена: ' + err.message);
    });
    return;
  }
  _doGDriveExport();
}
```

### 4. GoogleSheetDB `setInterval` (стр. 700-714)
Помимо проверки токена, конструктор:
- Обновляет `signout_button.textContent` оставшимся временем — безвредно
- Ищет `document.querySelector('[onclick="showTab(\'settings-tab\')"]')` — нет в dora, просто null
- Диспатчит `doAuth` на `document.body` при истечении токена — dora на этот event не подписана, безвредно
- Устанавливает `window.GoogleSheetDB = this` — не конфликтует с чем-либо в dora

**Вывод:** побочные эффекты конструктора безвредны для dora, ничего额外ного делать не нужно.

## Порядок работы

1. Обновить `tests.html`: убрать скрипт GoogleDrive.js + удалить группу тестов 15
2. Обновить `index.html`: добавить скрытые кнопки, убрать скрипт GoogleDrive.js
3. Обновить `app.js`: dynamic import + удалить `gdrive:ready` listener + guard в `_updateGDriveBtn()` + `_waitForAuth()` + правки handlers
4. Удалить `GoogleDrive.js`
5. Запустить в браузере: авторизоваться → экспортировать → импортировать → проверить

## Риски

- `GoogleSheetDB` constructor запускает `setInterval` для проверки токена — безвредно, но логирует в консоль
- Constructor привязывает `authorize_button.onclick` к自己 — dora's кнопка должна триггерить программно
- Дополнительные discovery docs (Sheets, Calendar) загружаются — незначительный оверхед
- `Drive` class `find()` ищет в `appDataFolder` — совпадает с текущим поведением `GoogleDrive.js`
- `_waitForAuth()` поллинг добавляет до 100ms задержку перед экспортом/импортом — незаметно для пользователя
