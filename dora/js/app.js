window.App = window.App || {};

App.Config = {
  ZOOM_MIN: 0.25,
  ZOOM_MAX: 3,
  ZOOM_STEP: 0.25
};

let _zoom = 1;
const SPREADSHEET_ID = '1Tr_FN9yu4CIdBqA4V99qOLCNe0boNkw8ZCmhWcYWqG4';
let _gsReady = false;

App.getZoom = () => _zoom;

App.setZoom = (z) => {
  _zoom = App.utils.clamp(z, App.Config.ZOOM_MIN, App.Config.ZOOM_MAX);
  _zoom = Math.round(_zoom / 0.05) * 0.05;
  App.Renderer.setZoom(_zoom);
  document.getElementById('zoom-level').textContent = `${Math.round(_zoom * 100)}%`;
};

App.zoomIn = () => App.setZoom(_zoom + App.Config.ZOOM_STEP);
App.zoomOut = () => App.setZoom(_zoom - App.Config.ZOOM_STEP);

App.init = () => {
  try {
    App.EventBus.clear();
    App.DataStore.init();

    const svg = document.getElementById('plan');
    if (!svg) { console.error('[App] SVG not found'); return; }

    App.Ruler.init(svg);
    App.Renderer.init(svg);
    App.GuideManager.init(svg);
    App.DragManager.init(svg);
    App.SearchManager.init('#searchInput');
    App.ModalManager.init();
    App.PanelManager.init();

    App.EventBus.on('plan:listChanged', _refreshPlanSelect);
    App.EventBus.on('plan:switched', _onPlanSwitched);
    App.EventBus.on('plan:renamed', _onPlanRenamed);
    App.EventBus.on('plan:deleted', _onPlanDeleted);
    _refreshPlanSelect();
    _bindPlanSelect();

    if (!window.version) window.version = '1.0.0';

    import('../../dnd/static/js/db/google.js').then(function(imports) {
      var GoogleSheetDB = imports.GoogleSheetDB;
      App._gsdb = new GoogleSheetDB();
      App._gsdb.waitGoogle().then(async function() {
        _gsReady = true;
        // При запуске (если есть токен) подгружаем облачную версию:
        // облако — источник истины, локальная копия на этом устройстве перезаписывается.
        _refreshAuthButton();
        await _doSheetsImport(true);
        if (localStorage.getItem('dora_unsynced')) _showSyncError();
        App.EventBus.on('data:changed', _debouncedExport);
      });
      // Таймер GoogleSheetDB диспатчит doAuth при истечении токена — тихо продлеваем,
      // но только если пользователь ранее авторизовался (не дёргаем попапом анонимов)
      document.body.addEventListener('doAuth', function() {
        if (localStorage.getItem('gapi_token')) {
          _renewAuth().then(function(ok) {
            if (ok) {
              _doSheetsImport(true);
            } else {
              // Тихий рефреш не вышел (нет живой сессии/refresh) — показываем баннер,
              // клик по нему даёт user-gesture и право открыть consent-попап.
              _showSyncBanner();
            }
            _refreshAuthButton();
          });
        } else {
          _refreshAuthButton();
        }
      });
    }).catch(function(err) { console.warn('[App] Google API:', err); });

    App.PanelManager.showDefault();

    const wrap = App.utils.createSvgElement('g', { class: 'plan-wrap' });
    const toMove = svg.querySelectorAll('.ruler-layer, .plan-content, .guide-layer');
    toMove.forEach(g => wrap.appendChild(g));
    svg.insertBefore(wrap, svg.firstChild);
    App.Renderer.setZoomGroup(wrap);

    App.setZoom(1);
    App.Renderer.render();

    _bindToolbar();
    _defineGlobals();

    console.log('[App] initialized');
  } catch (e) {
    console.error('[App] init error:', e);
  }
};

let _exportTimer = null;
function _debouncedExport() {
  if (_exportSuppress) return;
  clearTimeout(_exportTimer);
  _exportTimer = setTimeout(function() { _doSheetsExport(); }, 1000);
}

// Тихое продление токена (prompt:'' — попап только если Google потребует интеракцию).
// Общий Promise: параллельные вызовы ждут один и тот же запрос токена.
// Таймаут: попап могли заблокировать или проигнорировать — не висим вечно.
const RENEW_TIMEOUT_MS = 90000;
let _authPromise = null;
function _renewAuth() {
  if (_authPromise) return _authPromise;
  _authPromise = new Promise(function(resolve) {
    var tc = App._gsdb && App._gsdb.tokenClient;
    if (!tc || !window.google || !window.gapi || !gapi.client) {
      _authPromise = null;
      return resolve(false);
    }
    var settled = false;
    var prev = tc.callback;
    function settle(ok) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      tc.callback = prev;
      _authPromise = null;
      resolve(ok);
    }
    var timer = setTimeout(function() { settle(false); }, RENEW_TIMEOUT_MS);
    tc.callback = function(resp) {
      if (!resp || resp.error) return settle(false);
      try {
        if (resp.access_token && gapi.client && gapi.client.setToken) {
          var cur = gapi.client.getToken();
          gapi.client.setToken(Object.assign({}, cur || {}, {
            access_token: resp.access_token,
            expires_in: resp.expires_in,
            scope: resp.scope,
            token_type: resp.token_type
          }));
        }
        localStorage.setItem('gapi_token', JSON.stringify(gapi.client.getToken()));
        localStorage.setItem('gapi_token_expires',
          JSON.stringify(App._gsdb.getTime() + (resp.expires_in || 3600)));
        // offline-консент отдаёт refresh_token один раз; при тихих продлениях его нет —
        // уже сохранённый маркер затирать нельзя, иначе потеряется право на рефреш
        if (resp.refresh_token != null) {
          localStorage.setItem('gapi_token_refresh', JSON.stringify(resp.refresh_token));
          localStorage.setItem('gapi_token_refresh_exp',
            JSON.stringify(App._gsdb.getTime() + (resp.refresh_expires_in != null ? resp.refresh_expires_in : 7 * 86400)));
        }
      } catch (e) { /* ignore */ }
      settle(true);
    };
    tc.requestAccessToken({ prompt: '' });
  });
  return _authPromise;
}

// Баннер «восстановить синхронизацию»: клик даёт user-gesture,
// поэтому попап авторизации не блокируется браузером
function _showSyncBanner() {
  var b = document.getElementById('dora-sync-banner');
  if (!b) {
    b = document.createElement('button');
    b.id = 'dora-sync-banner';
    b.className = 'sync-banner';
    b.textContent = '☁ Вход Google истёк — нажмите, чтобы восстановить синхронизацию';
    b.addEventListener('click', function() {
      _doAuthRestore().then(function(ok) {
        if (ok) {
          b.classList.remove('visible');
          _doSheetsExport();
        }
      });
    });
    document.body.appendChild(b);
  }
  b.classList.add('visible');
}

// Восстановление авторизации по действию пользователя: живая сессия — тихий рефреш;
// нет сессии — явный consent-попап (жест пользователя разрешает его открыть).
function _doAuthRestore() {
  return new Promise(function(resolve) {
    if (!window.gapi || !gapi.client || !App._gsdb) return resolve(false);
    if (App._gsdb.hasRefreshSession()) {
      _renewAuth().then(function(ok) {
        if (ok) _doSheetsImport(true);
        resolve(ok);
      });
    } else {
      var ab = document.getElementById('authorize_button');
      if (ab) {
        ab.click();
        resolve(true);
      } else {
        resolve(false);
      }
    }
  });
}

function _hideSyncBanner() {
  var b = document.getElementById('dora-sync-banner');
  if (b) b.classList.remove('visible');
}

// Индикатор ⚠️ рядом с кнопкой входа: горит, пока есть непушенные изменения
// (любая ошибка сохранения), клик — повторить выгрузку
function _showSyncError() {
  var el = document.getElementById('sync-error-btn');
  if (el) el.style.display = '';
}
function _hideSyncError() {
  var el = document.getElementById('sync-error-btn');
  if (el) el.style.display = 'none';
}

function _bindToolbar() {
  document.querySelectorAll('[data-action]').forEach(el => {
    const action = el.getAttribute('data-action');
    const handler = _resolveAction(action);
    if (handler) el.addEventListener('click', handler);
  });
}

function _resolveAction(action) {
  const map = {
    'add-room':      () => App.ModalManager.showAddRoom(),
    'add-object':    () => App.ModalManager.showAddObject(),
    'guide-h':       () => App.GuideManager.addHorizontal(),
    'guide-v':       () => App.GuideManager.addVertical(),
    'guide-clear':   () => App.GuideManager.clearAll(),
    'zoom-in':       () => App.zoomIn(),
    'zoom-out':      () => App.zoomOut(),
    'export':        () => App.ExportImport.exportData(),
    'import':        () => document.getElementById('importFile').click(),
    'search-clear':  () => App.SearchManager.clear(),
    'gdrive-auth':   () => _handleGDriveAuth(),
    'retry-sync':    () => _doSheetsExport(),
    'add-plan':      () => App.ModalManager.showAddPlan(),
    'manage-plans':  () => App.ModalManager.showManagePlans(),
  };
  return map[action] || null;
}

function _handleGDriveAuth() {
  var token = (window.gapi && gapi.client) ? gapi.client.getToken() : null;
  if (token && App._gsdb && !App._gsdb.expired()) {
    // Валидный доступ — кнопка работает как «Выйти»
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken('');
    localStorage.removeItem('gapi_token');
    localStorage.removeItem('gapi_token_expires');
    localStorage.removeItem('gapi_token_refresh');
    localStorage.removeItem('gapi_token_refresh_exp');
    _refreshAuthButton();
    return;
  }
  // Токена нет/протух, но живая сессия (refresh-маркер) есть — тихо продлеваем
  // без повторного согласия
  if (App._gsdb && App._gsdb.hasRefreshSession()) {
    _renewAuth().then(function(ok) {
      if (ok) _doSheetsImport(true);
      _refreshAuthButton();
    });
    return;
  }
  // Первичная (повторная после смерти сессии) авторизация через consent-попап
  document.getElementById('authorize_button').click();
}

// Кнопка «Войти/Выйти» отражает реальное состояние авторизации:
// валидный доступ ИЛИ живая offline-сессия — «Выйти», иначе — «Войти».
function _refreshAuthButton() {
  var btn = document.getElementById('gdrive-auth-btn');
  if (!btn) return;
  var loggedIn = !!(App._gsdb && App._gsdb.hasRefreshSession());
  btn.textContent = loggedIn ? '🔓 Выйти' : '🔐 Войти';
  btn.title = loggedIn ? 'Выйти из Google' : 'Вход Google';
}

async function _fetchPlanData() {
  var resp = await gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'dora!A:Z'
  });
  var values = resp.result.values || [];
  // Строка 1 листа — всегда заголовок key|value, данные начинаются со строки 2.
  // План может быть разбит на чанки по 49K в колонках B..Z (ограничение Google
  // Sheets — 50K символов на ячейку) — собираем их обратно в одну строку.
  var header = (values.length && values[0][0] === 'key') ? values[0] : ['key', 'value'];
  var rows = values.length ? values.slice(1) : [];
  rows = rows.map(function(r) {
    return [r[0] || '', (r.slice(1).join('') || '')];
  });
  return { header: [header[0] || 'key', header[1] || 'value'], rows: rows };
}

// Валидный документ плана? Защита от случайных значений в колонке B
// (посторонние ключи листа не должны становиться квартирами).
function _isPlanDoc(text) {
  if (!text) return false;
  try {
    var o = JSON.parse(text);
    return !!(o && Array.isArray(o.rooms) && Array.isArray(o.objects));
  } catch (e) { return false; }
}

// Чтение листа dora с сохранением РЕАЛЬНЫХ позиций строк.
// values.get сжимает пустые строки, поэтому для точечной записи без сдвига
// соседних квартир читаем сетку через spreadsheets.get с includeGridData.
// Возвращает { sheetTitle, rowCount, rows: [{ a, b }] } — rows[i] отвечает сетке
// строки i (0 = заголовок), пустые строки сохраняются как { a: '', b: '' }.
async function _readGridRows() {
  var resp = await gapi.client.sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    ranges: ['dora!A1:Z1000'],
    includeGridData: true
  });
  var sheet = (resp.result.sheets || []).find(function(s) {
    return s.properties && s.properties.title === 'dora';
  });
  if (!sheet) throw new Error('[Sheets] Лист dora не найден');
  var grid = (sheet.data && sheet.data[0]) || {};
  var gp = (sheet.properties && sheet.properties.gridProperties) || {};
  function cellStr(c) {
    if (!c) return '';
    if (c.formattedValue != null) return String(c.formattedValue);
    var u = c.userEnteredValue;
    if (u && u.stringValue != null) return String(u.stringValue);
    return '';
  }
  var rows = (grid.rowData || []).map(function(rd) {
    var vals = (rd && rd.values) || [];
    var a = cellStr(vals[0]);
    var b = '';
    for (var i = 1; i < vals.length; i++) b += cellStr(vals[i]);
    return { a: a, b: b };
  });
  return { sheetTitle: sheet.properties.title, rowCount: gp.rowCount || 1000, rows: rows };
}

function _isPlanEmpty(doc) {
  return !doc || ((!doc.rooms || !doc.rooms.length) && (!doc.objects || !doc.objects.length));
}

// ОБЛАКО — источник истины. Точечная запись: меняем ТОЛЬКО строку активного плана,
// соседние квартиры/строки не перезаписываем (никаких полных перезаписей блока A:B).
async function _writePlanRow(keyName, json) {
  var g = await _readGridRows();
  var idx = -1;
  for (var i = 1; i < g.rows.length; i++) {
    if (g.rows[i].a === keyName) { idx = i; break; }
  }
  if (idx >= 0) {
    // Обновление существующей строки: разбиваем JSON на чанки по 49K
    const CHUNK_SIZE = 49000;
    const chunks = [];
    for (let i = 0; i < json.length; i += CHUNK_SIZE) {
      chunks.push(json.slice(i, i + CHUNK_SIZE));
    }
    // Собираем массив значений для столбцов B, C, D, ... Z
    var rowValues = [];
    for (let i = 0; i < 26; i++) {
      rowValues.push(i < chunks.length ? chunks[i] : '');
    }
    var firstCol = 'B';
    var lastCol = String.fromCharCode(66 + chunks.length - 1); // B + count - 1
    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: g.sheetTitle + '!' + firstCol + (idx + 1) + ':' + lastCol + (idx + 1),
      valueInputOption: 'RAW',
      resource: { values: [rowValues] }
    });
    return;
  }
  // Добавление новой строки (приложение)
  await gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: g.sheetTitle + '!B',  // Новый ряд начинается с B
    valueInputOption: 'RAW',
    resource: { values: [[keyName, json]] }
  });
  return;
}

// Точечная правка имени квартиры в колонке A (без перезаписи блока).
async function _renamePlanRow(oldName, newName) {
  var g = await _readGridRows();
  for (var i = 1; i < g.rows.length; i++) {
    if (g.rows[i].a === oldName) {
      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: g.sheetTitle + '!A' + (i + 1),
        valueInputOption: 'RAW',
        resource: { values: [[newName]] }
      });
      return;
    }
  }
}

// Точечное удаление строки квартиры: зачищаем ТОЛЬКО её A:Z (включая чанки), соседей не трогаем
// и не сдвигаем (пустая строка-пробел безопаснее, чем перезапись всего блока).
async function _deletePlanRow(name) {
  var g = await _readGridRows();
  for (var i = 1; i < g.rows.length; i++) {
    if (g.rows[i].a === name) {
      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: g.sheetTitle + '!A' + (i + 1) + ':Z' + (i + 1),
        valueInputOption: 'RAW',
        resource: { values: [['', '']] }
      });
      return;
    }
  }
}

async function _doSheetsExport(_retried) {
  if (!_gsReady || !window.gapi || !gapi.client) return;
  try {
    if (!gapi.client.getToken()) {
      // Токена нет (истёк/не авторизован) — тихо продлеваем и продолжаем
      if (!(await _renewAuth())) {
        localStorage.setItem('dora_unsynced', '1');
        _showSyncBanner();
        _showSyncError();
        return;
      }
    }
    var keyName = App.DataStore.getActivePlanName();
    if (!keyName) return;
    var json = App.DataStore.exportData().replace(/[\r\n]+/g, ' ');
    // Облако — источник истины: не пушим локальное состояние, если оно не валидный
    // план. Пустая/поломанная локальная копия НЕ должна затирать данные в таблице.
    if (!_isPlanDoc(json)) return;

    // Грубый конфликт «локальная копия пуста, а облако наполнено»: облако побеждает.
    // Устройство с очищенным/несозданным локальным состоянием не может обнулить БД.
    var localDoc = JSON.parse(json);
    if (_isPlanEmpty(localDoc)) {
      var g = await _readGridRows();
      var cloudRow = null;
      for (var i = 1; i < g.rows.length; i++) {
        if (g.rows[i].a === keyName) { cloudRow = g.rows[i]; break; }
      }
      if (cloudRow && cloudRow.b && _isPlanDoc(cloudRow.b)) {
        var cloudDoc = JSON.parse(cloudRow.b);
        if (!_isPlanEmpty(cloudDoc)) {
          console.warn('[Sheets] конфликт: облачная строка «' + keyName + '» наполнена, локальный план пуст — облако побеждает, экспорт отменён');
          await _importActiveRow({ header: ['key', 'value'], rows: [[keyName, cloudRow.b]] }, true);
          localStorage.removeItem('dora_unsynced');
          _hideSyncBanner();
          _hideSyncError();
          return;
        }
      }
    }

    await _writePlanRow(keyName, json);
    localStorage.removeItem('dora_unsynced');
    _hideSyncBanner();
    _hideSyncError();
  } catch (err) {
    if (App.utils.isAuthError(err)) {
      // Токен протух между проверкой и записью — продлеваем и ретраим один раз
      if (!_retried && await _renewAuth()) return _doSheetsExport(true);
      localStorage.setItem('dora_unsynced', '1');
      _showSyncBanner();
      _showSyncError();
    } else {
      // Сетевой сбой и прочее — изменения не ушли, держим индикатор до успеха
      console.warn('[Sheets] auto-export error:', err);
      localStorage.setItem('dora_unsynced', '1');
      _showSyncError();
    }
  }
}

async function _doSheetsImport(silent) {
  if (!_gsReady || !window.gapi || !gapi.client || !gapi.client.getToken()) return;
  try {
    var data = await _fetchPlanData();
    // Квартирами считаем только строки данных с валидным планом в колонке B
    var names = data.rows
      .filter(function(r) { return r && r[0] && _isPlanDoc(r[1]); })
      .map(function(r) { return r[0]; });
    App.DataStore.registerCloudPlans(names);
    await _importActiveRow(data, silent);
    // Облако — источник истины: отметку «есть неслитые правки» снимаем
    localStorage.removeItem('dora_unsynced');
    _hideSyncError();
  } catch (err) {
    console.warn('[Sheets] auto-import error:', err);
  }
}

// Импорт облачной строки активного плана: облако перезаписывает локальную копию.
// data: { header, rows } из _fetchPlanData(). Не сливает — cloud wins.
async function _importActiveRow(data, silent) {
  var keyName = App.DataStore.getActivePlanName();
  if (!keyName) return;
  var cloudContent = null;
  for (var i = 0; i < data.rows.length; i++) {
    if (data.rows[i][0] === keyName) { cloudContent = data.rows[i][1]; break; }
  }
  if (!cloudContent) return;
  if (!_isPlanDoc(cloudContent)) return;
  var wasSuppressed = _exportSuppress;
  _exportSuppress = true;
  var res = App.DataStore.importData(cloudContent);
  if (res.ok) {
    App.Renderer.render();
    App.GuideManager._render && App.GuideManager._render();
  } else if (!silent) {
    alert('Ошибка загрузки из Google Sheets: ' + res.error);
  }
  _exportSuppress = wasSuppressed;
}

// На время загрузки облачной версии при переключении квартиры
// автоэкспорт подавлен, чтобы пустая локальная копия не затёрла данные в таблице.
let _exportSuppress = false;

function _refreshPlanSelect() {
  const sel = document.getElementById('planSelect');
  if (!sel) return;
  const active = App.DataStore.getActivePlanId();
  sel.innerHTML = App.DataStore.listPlans().map(p =>
    `<option value="${p.id}"${p.id === active ? ' selected' : ''}>${App.utils.escapeHtml(p.name)}</option>`
  ).join('');
}

function _bindPlanSelect() {
  const sel = document.getElementById('planSelect');
  if (!sel || sel.dataset.bound) return;
  sel.dataset.bound = '1';
  sel.addEventListener('change', (e) => {
    if (e.target.value) App.DataStore.switchPlan(e.target.value);
  });
}

function _onPlanSwitched() {
  _exportSuppress = true;
  clearTimeout(_exportTimer);
  App.SearchManager.clear();
  App.PanelManager.showDefault();
  App.Renderer.render();
  App.GuideManager._render && App.GuideManager._render();
  if (_gsReady && window.gapi && gapi.client && gapi.client.getToken()) {
    _fetchPlanData()
      .then(function(data) { return _importActiveRow(data, true); })
      .catch(function(err) { console.warn('[Sheets] switch import error:', err); })
      .finally(function() { _exportSuppress = false; });
  } else {
    _exportSuppress = false;
  }
}

function _onPlanRenamed(info) {
  if (!_gsReady || !window.gapi || !gapi.client || !gapi.client.getToken()) return;
  _renamePlanRow(info.oldName, info.name)
    .catch(function(err) { console.warn('[Sheets] rename sync error:', err); });
}

function _onPlanDeleted(info) {
  if (!_gsReady || !window.gapi || !gapi.client || !gapi.client.getToken()) return;
  // Разрушающая операция — удаляем точечно только свою строку. Перед этим
  // проверяем содержимое B: если там не похоже на план — не трогаем (страховка).
  _readGridRows()
    .then(function(g) {
      for (var i = 1; i < g.rows.length; i++) {
        if (g.rows[i].a !== info.name) continue;
        return gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'dora!B' + (i + 1)
        }).then(function(resp) {
          var bVal = (resp.result.values && resp.result.values[0] && resp.result.values[0][0]) || '';
          if (bVal && !_isPlanDoc(bVal)) {
            console.warn('[Sheets] delete sync: строка «' + info.name + '» не похожа на план, пропущена');
            return;
          }
          return _deletePlanRow(info.name);
        });
      }
    })
    .catch(function(err) { console.warn('[Sheets] delete sync error:', err); });
}

function _defineGlobals() {
  window.closeModal = (e) => {
    if (e && e.target !== document.getElementById('modal-overlay')) return;
    App.ModalManager.close();
  };
  window.handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!confirm('Загрузить данные из файла? Текущие данные будут заменены.')) return;
    App.ExportImport.importData(file).then(result => {
      if (result.ok) { App.PanelManager.showDefault(); alert('Данные успешно загружены'); }
      else { alert('Ошибка: ' + result.error); }
    });
    event.target.value = '';
  };
}

// Минимальный хэндл для интеграционных тестов (tests/integration.py)
App._sheetsDebug = {
  isReady: () => _gsReady,
  renewAuth: () => _renewAuth(),
  doExport: (_retried) => _doSheetsExport(_retried),
  doImport: () => _doSheetsImport(true)
};

document.addEventListener('DOMContentLoaded', App.init);
