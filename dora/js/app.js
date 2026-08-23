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
      App._gsdb.waitGoogle().then(function() {
        _gsReady = true;
        _doSheetsImport(true);
        App.EventBus.on('data:changed', _debouncedExport);
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
  clearTimeout(_exportTimer);
  _exportTimer = setTimeout(function() { _doSheetsExport(); }, 1000);
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
    'reset':         () => _handleReset(),
    'search-clear':  () => App.SearchManager.clear(),
    'gdrive-auth':   () => _handleGDriveAuth(),
    'add-plan':      () => App.ModalManager.showAddPlan(),
    'manage-plans':  () => App.ModalManager.showManagePlans(),
  };
  return map[action] || null;
}

function _handleReset() {
  if (!confirm('Очистить все данные? Это действие необратимо.')) return;
  App.DataStore.reset(true);
  App.PanelManager.showDefault();
  App.SearchManager.clear();
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
    return;
  }
  document.getElementById('authorize_button').click();
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

async function _doSheetsExport() {
  if (!_gsReady || !window.gapi || !gapi.client || !gapi.client.getToken()) return;
  try {
    var keyName = App.DataStore.getActivePlanName();
    if (!keyName) return;
    var json = App.DataStore.exportData().replace(/[\r\n]+/g, ' ');
    var data = await _fetchPlanData();
    var found = false;
    for (var i = 0; i < data.rows.length; i++) {
      if (data.rows[i][0] === keyName) { data.rows[i] = [keyName, json]; found = true; break; }
    }
    if (!found) data.rows.push([keyName, json]);
    await _writePlanBlock(data.header, data.rows);
  } catch (err) {
    console.warn('[Sheets] auto-export error:', err);
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
    await _importActiveRow(data.rows, silent);
  } catch (err) {
    console.warn('[Sheets] auto-import error:', err);
  }
}

async function _importActiveRow(preFetchedRows, silent) {
  var rows = Array.isArray(preFetchedRows) ? preFetchedRows : (await _fetchPlanData()).rows;
  var keyName = App.DataStore.getActivePlanName();
  var content = null;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0] === keyName) { content = rows[i][1]; break; }
  }
  if (!content) return;
  var result = App.DataStore.importData(content);
  if (result.ok) {
    App.Renderer.render();
    App.GuideManager._render && App.GuideManager._render();
  } else if (!silent) {
    alert('Ошибка импорта из Google Sheets: ' + result.error);
  }
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
    _importActiveRow(null, true)
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

document.addEventListener('DOMContentLoaded', App.init);
