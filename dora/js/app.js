window.App = window.App || {};

App.Config = {
  ZOOM_MIN: 0.25,
  ZOOM_MAX: 3,
  ZOOM_STEP: 0.25
};

let _zoom = 1;

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
    App.GoogleDrive.init();

    App.PanelManager.showDefault();

    // Wrap ruler, plan, guides in a single zoom group; resize handles stay outside
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
  if (App.GoogleDrive.isAuthorized()) {
    btn.textContent = '☁ Выйти';
    btn.title = 'Выйти из Google';
  } else {
    btn.textContent = '☁ Войти';
    btn.title = 'Авторизация Google';
  }
}

function _handleGDriveAuth() {
  if (App.GoogleDrive.isAuthorized()) {
    App.GoogleDrive.signout();
    _updateGDriveBtn();
    return;
  }
  App.GoogleDrive.auth(() => { _updateGDriveBtn(); });
}

function _handleGDriveExport() {
  if (!App.GoogleDrive.isAuthorized()) {
    App.GoogleDrive.auth().then(() => {
      _updateGDriveBtn();
      _doGDriveExport();
    });
    return;
  }
  _doGDriveExport();
}

function _doGDriveExport() {
  if (!confirm('Сохранить текущие данные на Google Диск?')) return;
  const json = App.DataStore.exportData();
  App.GoogleDrive.upload('imDoraPlan.json', json).then(() => {
    alert('Данные сохранены на Google Диск');
  }).catch(err => {
    console.error('[GDrive] export error:', err);
    alert('Ошибка сохранения: ' + (err.message || err.statusText || 'неизвестная'));
  });
}

function _handleGDriveImport() {
  if (!App.GoogleDrive.isAuthorized()) {
    App.GoogleDrive.auth().then(() => {
      _updateGDriveBtn();
      _doGDriveImport();
    });
    return;
  }
  _doGDriveImport();
}

function _doGDriveImport() {
  if (!confirm('Загрузить данные с Google Диска? Текущие данные будут заменены.')) return;
  App.GoogleDrive.download('imDoraPlan.json').then(content => {
    const result = App.DataStore.importData(typeof content === 'string' ? content : JSON.stringify(content));
    if (result.ok) {
      App.PanelManager.showDefault();
      App.SearchManager.clear();
      alert('Данные загружены с Google Диска');
    } else {
      alert('Ошибка: ' + result.error);
    }
  }).catch(err => {
    console.error('[GDrive] import error:', err);
    alert('Ошибка загрузки: ' + (err.message || err.statusText || 'неизвестная'));
  });
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
  App.EventBus.on('gdrive:ready', _updateGDriveBtn);
  _updateGDriveBtn();
}

document.addEventListener('DOMContentLoaded', App.init);
