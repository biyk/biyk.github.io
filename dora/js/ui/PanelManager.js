window.App = window.App || {};

App.PanelManager = (() => {
  let _defaultEl = null;
  let _contentEl = null;
  let _selectedObjectId = null;
  let _selectedRoomId = null;
  let _searchQuery = '';
  let _searchMatchedItems = {};

  function _showDefault() {
    if (_defaultEl) _defaultEl.style.display = 'block';
    if (_contentEl) _contentEl.style.display = 'none';
    _selectedObjectId = null;
    _selectedRoomId = null;
    App.EventBus.emit('selection:clear');
  }

  function _isSearchMatch(name) {
    if (!_searchQuery) return false;
    return name.toLowerCase().includes(_searchQuery.toLowerCase());
  }

  function _buildObjectPanel(obj) {
    const room = App.DataStore.getRooms().find(r => r.id === obj.roomId);
    const itemsTotal = App.DataStore.getObjectTotalItems(obj.id);
    const children = App.DataStore.getChildren(obj.id);
    const ancestors = App.DataStore.getAncestors(obj.id);
    const hlClass = _isSearchMatch(obj.name) ? ' search-highlight' : '';
    const matchedItems = _searchMatchedItems[obj.id] || new Set();

    // Хлебные крошки
    let html = `<div class="breadcrumbs">`;
    html += `<span class="crumb" onclick="App.PanelManager.showDefault()">🏠 План</span>`;
    ancestors.forEach(a => {
      html += `<span class="crumb-sep">→</span><span class="crumb" onclick="App.PanelManager.showObject('${a.id}')">${App.utils.escapeHtml(a.name)}</span>`;
    });
    html += `<span class="crumb-sep">→</span><span class="crumb crumb-current">${App.utils.escapeHtml(obj.name)}</span>`;
    html += `</div>`;

    html += `<h3 class="${hlClass}">📦 ${obj.name}</h3>`;
    html += `<div class="meta">Комната: ${room ? room.name : '—'} · ${children.length} влож. · ${itemsTotal} вещей</div>`;

    // Вложенные объекты
    if (children.length > 0) {
      html += `<div class="container-block">
        <h4>📦 Внутри объекта</h4>`;
      children.forEach(child => {
        const cItems = App.DataStore.getObjectTotalItems(child.id);
        const childHl = _isSearchMatch(child.name) ? ' search-highlight' : '';
        html += `<div class="item-row">
          <span class="item-name${childHl}" onclick="App.PanelManager.showObject('${child.id}')">▸ ${App.utils.escapeHtml(child.name)}</span>
          <span class="meta">${cItems} вещей</span>
        </div>`;
      });
      html += `</div>`;
    }

    // Предметы объекта
    if (obj.items && obj.items.length > 0) {
      html += `<div class="container-block">
        <h4>📎 Предметы</h4>`;
      obj.items.forEach((item, i) => {
        const itemHl = matchedItems.has(item) ? ' search-highlight' : '';
        html += `<div class="item-row">
          <span class="item-name${itemHl}" title="Переименовать" onclick="App.PanelManager._renameObjectItem('${obj.id}',${i})">· ${App.utils.escapeHtml(item)}</span>
          <button class="btn-icon" onclick="App.DataStore.removeObjectItem('${obj.id}',${i})" title="Удалить">✕</button>
        </div>`;
      });
      html += `</div>`;
    }

    html += `<button class="panel-btn" onclick="App.PanelManager._addObjectItem('${obj.id}')">+ Предмет</button>`;
    html += `<button class="panel-btn" onclick="App.PanelManager._addNestedObject('${obj.id}')">📦 + Объект внутрь</button>`;
    html += `<button class="panel-btn" onclick="App.PanelManager._initMoveObject('${obj.id}')">${obj.parentId ? '📥 Переместить в другой объект' : '📥 Положить в объект'}</button>`;
    html += `<button class="panel-btn" onclick="App.ModalManager.showEditObject('${obj.id}')">✏ Редактировать</button>`;
    html += `<button class="panel-btn panel-btn-danger" onclick="App.PanelManager._deleteObject('${obj.id}')">🗑 Удалить объект</button>`;

    return html;
  }

  function _buildRoomPanel(room) {
    const roomObjects = App.DataStore.getRootObjects().filter(o => o.roomId === room.id);

    let html = `<h3>🏠 ${room.name}</h3>`;
    html += `<div class="meta">Объектов: ${roomObjects.length}</div>`;

    roomObjects.forEach(obj => {
      const count = App.DataStore.getObjectTotalItems(obj.id);
      const childCount = App.DataStore.getChildren(obj.id).length;
      const objHl = _isSearchMatch(obj.name) ? ' search-highlight' : '';
      html += `<div class="container-block clickable${objHl}" onclick="App.PanelManager.showObject('${obj.id}')">
        <h4 style="color:#e94560">📦 ${obj.name}</h4>
        <div class="meta">${childCount > 0 ? childCount + ' влож., ' : ''}${count} вещей</div>
      </div>`;
    });

    if (roomObjects.length === 0) {
      html += `<div class="empty-msg">В этой комнате нет объектов</div>`;
    }

    html += `<button class="panel-btn" onclick="App.ModalManager.showAddObject('${room.id}')">+ Объект</button>`;
    html += `<button class="panel-btn" onclick="App.ModalManager.showEditRoom('${room.id}')">✏ Редактировать</button>`;
    html += `<button class="panel-btn panel-btn-danger" onclick="App.PanelManager._deleteRoom('${room.id}')">🗑 Удалить комнату</button>`;

    return html;
  }

  function _addObjectItem(objectId) {
    const name = prompt('Название предмета:');
    if (name && name.trim()) {
      App.DataStore.addObjectItem(objectId, name.trim());
      this.showObject(objectId);
    }
  }

  function _addNestedObject(objectId) {
    const name = prompt('Название объекта:');
    if (name && name.trim()) {
      const child = App.DataStore.addObject({ name: name.trim(), parentId: objectId });
      if (child) this.showObject(child.id);
    }
  }

  function _initMoveObject(objectId) {
    App.ModalManager.showMoveObject(objectId);
  }

  function _renameObjectItem(objectId, itemIndex) {
    const obj = App.DataStore.getObjects().find(o => o.id === objectId);
    if (!obj) return;
    const item = obj.items[itemIndex];
    if (item === undefined) return;
    const name = prompt('Название предмета:', item);
    if (name && name.trim()) {
      App.DataStore.renameObjectItem(objectId, itemIndex, name.trim());
      this.showObject(objectId);
    }
  }

  function _deleteObject(id) {
    if (!App.DataStore.isObjectEmpty(id)) {
      alert('Нельзя удалить: сначала удалите содержимое (вложенные объекты и предметы).');
      return;
    }
    if (!confirm('Удалить объект?')) return;
    const wasSelected = _selectedObjectId === id;
    App.DataStore.deleteObject(id);
    if (wasSelected) _showDefault();
    else this.refresh();
  }

  function _deleteRoom(id) {
    const objs = App.DataStore.getObjects().filter(o => o.roomId === id);
    if (objs.length > 0 && !confirm(`В комнате ${objs.length} объектов. Удалить всё?`)) return;
    App.DataStore.deleteRoom(id);
    _showDefault();
  }

  return {
    init() {
      _defaultEl = document.getElementById('panel-default');
      _contentEl = document.getElementById('panel-content');

      App.EventBus.on('search:results', ({ query, results }) => {
        _searchQuery = query || '';
        _searchMatchedItems = {};
        if (results && results.length > 0) {
          results.forEach(r => {
            if (r.matchedItems && r.matchedItems.length > 0) {
              _searchMatchedItems[r.object.id] = new Set(r.matchedItems);
            }
          });
          const first = results[0].object;
          this.showObject(first.id);
        } else {
          if (_selectedObjectId) this.refresh();
        }
      });

      App.EventBus.on('search:clear', () => {
        _searchQuery = '';
        _searchMatchedItems = {};
        if (_selectedObjectId) this.refresh();
      });
    },

    showDefault() { _showDefault(); },

    showObject(id) {
      const obj = App.DataStore.getObjects().find(o => o.id === id);
      if (!obj) return;
      _selectedObjectId = id;
      _selectedRoomId = null;
      if (_defaultEl) _defaultEl.style.display = 'none';
      if (_contentEl) {
        _contentEl.style.display = 'block';
        _contentEl.innerHTML = _buildObjectPanel(obj);
      }
      App.EventBus.emit('selection:object', id);
    },

    showRoom(id) {
      const room = App.DataStore.getRooms().find(r => r.id === id);
      if (!room) return;
      _selectedRoomId = id;
      _selectedObjectId = null;
      if (_defaultEl) _defaultEl.style.display = 'none';
      if (_contentEl) {
        _contentEl.style.display = 'block';
        _contentEl.innerHTML = _buildRoomPanel(room);
      }
      App.EventBus.emit('selection:room', id);
    },

    getSelectedObjectId() { return _selectedObjectId; },
    getSelectedRoomId() { return _selectedRoomId; },

    refresh() {
      if (_selectedObjectId) this.showObject(_selectedObjectId);
      else if (_selectedRoomId) this.showRoom(_selectedRoomId);
      else _showDefault();
    },

    _addObjectItem,
    _addNestedObject,
    _initMoveObject,
    _renameObjectItem,
    _deleteObject,
    _deleteRoom
  };
})();
