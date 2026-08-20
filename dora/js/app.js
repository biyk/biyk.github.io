window.App = window.App || {};

App.Config = {
  ZOOM_MIN: 0.25,
  ZOOM_MAX: 3,
  ZOOM_STEP: 0.25
};

let _zoom = 1;
const SPREADSHEET_ID = '1Tr_FN9yu4CIdBqA4V99qOLCNe0boNkw8ZCmhWcYWqG4';

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

    if (!window.version) window.version = '1.0.0';

    import('../../dnd/static/js/db/google.js').then(function(imports) {
      var GoogleSheetDB = imports.GoogleSheetDB;
      App._gsdb = new GoogleSheetDB();
      App._gsdb.waitGoogle().then(function() {
        _updateGDriveBtn();
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
    'gdrive-export': () => _handleGDriveExport(),
    'gdrive-import': () => _handleGDriveImport(),
  };
  return map[action] || null;
}

function _handleReset() {
  if (!confirm('Очистить все данные? Это действие необратимо.')) return;
  App.DataStore.reset(true);
  App.PanelManager.showDefault();
  App.SearchManager.clear();
}

function _updateGDriveBtn() {
  const btn = document.getElementById('gdrive-auth-btn');
  if (!btn) return;
  if (!window.gapi || !gapi.client) {
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

function _handleGDriveAuth() {
  if (window.gapi && gapi.client && gapi.client.getToken()) {
    var token = gapi.client.getToken();
    if (token) {
      google.accounts.oauth2.revoke(token.access_token);
      gapi.client.setToken('');
    }
    localStorage.removeItem('gapi_token');
    localStorage.removeItem('gapi_token_expires');
    _updateGDriveBtn();
    return;
  }
  document.getElementById('authorize_button').click();
  setTimeout(function() { _updateGDriveBtn(); }, 2000);
}

function _handleGDriveExport() {
  if (!window.gapi || !gapi.client || !gapi.client.getToken()) {
    document.getElementById('authorize_button').click();
    setTimeout(function() { _handleGDriveExport(); }, 2000);
    return;
  }
  _doSheetsExport();
}

async function _doSheetsExport() {
  if (!confirm('Сохранить текущие данные на Google Таблицу?')) return;
  try {
    var json = App.DataStore.exportData().replace(/[\r\n]+/g, ' ');
    var resp = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'dora!A:B'
    });
    var values = resp.result.values || [];
    var rowIndex = -1;
    for (var i = 0; i < values.length; i++) {
      if (values[i][0] === 'plan') { rowIndex = i + 1; break; }
    }
    if (rowIndex > 0) {
      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'dora!A' + rowIndex + ':B' + rowIndex,
        valueInputOption: 'RAW',
        resource: { values: [['plan', json]] }
      });
    } else {
      await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'dora!A:B',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: { values: [['plan', json]] }
      });
    }
    alert('Данные сохранены на Google Таблицу');
  } catch (err) {
    console.error('[Sheets] export error:', err);
    alert('Ошибка сохранения: ' + (err.message || 'неизвестная'));
  }
}

function _handleGDriveImport() {
  if (!window.gapi || !gapi.client || !gapi.client.getToken()) {
    document.getElementById('authorize_button').click();
    setTimeout(function() { _handleGDriveImport(); }, 2000);
    return;
  }
  _doSheetsImport();
}

async function _doSheetsImport() {
  if (!confirm('Загрузить данные с Google Таблицы? Текущие данные будут заменены.')) return;
  try {
    var resp = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'dora!A:B'
    });
    var values = resp.result.values || [];
    var content = null;
    for (var i = 0; i < values.length; i++) {
      if (values[i][0] === 'plan') { content = values[i][1]; break; }
    }
    if (!content) throw new Error('Запись "plan" не найдена');
    var result = App.DataStore.importData(content);
    if (result.ok) {
      App.PanelManager.showDefault();
      App.SearchManager.clear();
      alert('Данные загружены с Google Таблицы');
    } else {
      alert('Ошибка: ' + result.error);
    }
  } catch (err) {
    console.error('[Sheets] import error:', err);
    alert('Ошибка загрузки: ' + (err.message || 'неизвестная'));
  }
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
  _updateGDriveBtn();
}

document.addEventListener('DOMContentLoaded', App.init);
