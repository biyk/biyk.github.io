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
            if (ok) _doSheetsImport(true);
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
        localStorage.setItem('gapi_token', JSON.stringify(gapi.client.getToken()));
        localStorage.setItem('gapi_token_expires',
          JSON.stringify(App._gsdb.getTime() + resp.expires_in));
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
      _renewAuth().then(function(ok) {
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
  if (window.gapi && gapi.client && gapi.client.getToken()) {
    var token = gapi.client.getToken();
    if (token) {
      google.accounts.oauth2.revoke(token.access_token);
      gapi.client.setToken('');
    }
    localStorage.removeItem('gapi_token');
    localStorage.removeItem('gapi_token_expires');
    _refreshAuthButton();
    return;
  }
  document.getElementById('authorize_button').click();
}

// Кнопка «Войти/Выйти» отражает реальное состояние авторизации:
// пока токен валиден — «Выйти», иначе — «Войти» (а не всегда «Войти»).
function _refreshAuthButton() {
  var btn = document.getElementById('gdrive-auth-btn');
  if (!btn) return;
  var loggedIn = !!(localStorage.getItem('gapi_token') && App._gsdb && !App._gsdb.expired());
  btn.textContent = loggedIn ? '🔓 Выйти' : '🔐 Войти';
  btn.title = loggedIn ? 'Выйти из Google' : 'Вход Google';
}

async function _fetchPlanData() {
  var resp = await gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'dora!A:B'
  });
  var values = resp.result.values || [];
  // Строка 1 листа — всегда заголовок key|value, данные начинаются со строки 2
  var header = (values.length && values[0][0] === 'key') ? values[0] : ['key', 'value'];
  var rows = values.length ? values.slice(1) : [];
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

// Полная перезапись блока A:B (заголовок + данные) — иммунитет к пустым строкам,
// самовосстановление шапки и никаких опасных deleteDimension по сдвинутым индексам.
async function _writePlanBlock(header, rows) {
  var body = [[(header && header[0]) || 'key', (header && header[1]) || 'value']];
  rows.forEach(function(r) { body.push([r[0] || '', r[1] || '']); });
  await gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'dora!A1:B' + body.length,
    valueInputOption: 'RAW',
    resource: { values: body }
  });
}

// Замена/добавление строки активного плана в облаке (header сохранён в data)
function _upsertRow(data, keyName, json) {
  var rows = data.rows;
  var found = false;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0] === keyName) { rows[i] = [keyName, json]; found = true; break; }
  }
  if (!found) rows.push([keyName, json]);
  return _writePlanBlock(data.header, rows);
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
    var data = await _fetchPlanData();
    await _upsertRow(data, keyName, json);
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
  _fetchPlanData()
    .then(function(data) {
      for (var i = 0; i < data.rows.length; i++) {
        if (data.rows[i][0] === info.oldName) {
          data.rows[i][0] = info.name;
          return _writePlanBlock(data.header, data.rows);
        }
      }
    })
    .catch(function(err) { console.warn('[Sheets] rename sync error:', err); });
}

function _onPlanDeleted(info) {
  if (!_gsReady || !window.gapi || !gapi.client || !gapi.client.getToken()) return;
  _fetchPlanData()
    .then(function(data) {
      var filtered = data.rows.filter(function(r, i) {
        if (r[0] !== info.name) return true;
        // Разрушающая операция — только если в B лежит план или пусто
        if (r[1] && !_isPlanDoc(r[1])) {
          console.warn('[Sheets] delete sync: строка «' + info.name + '» не похожа на план, пропущена');
          return true;
        }
        return false;
      });
      if (filtered.length === data.rows.length) return;
      return _writePlanBlock(data.header, filtered);
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
