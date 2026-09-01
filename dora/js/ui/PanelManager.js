window.App = window.App || {};

App.PanelManager = (() => {
  let _defaultEl = null;
  let _contentEl = null;
  let _selectedObjectId = null;
  let _selectedRoomId = null;
  let _searchQuery = '';
  let _searchMatchedItems = {};
  let _dnd = null; // { kind: 'item'|'object', objectId, index }

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

    // Хлебные крошки (крошки — цели для перетаскивания)
    let html = `<div class="breadcrumbs">`;
    html += `<span class="crumb" data-drop-root="1" onclick="App.PanelManager.showDefault()">🏠 План</span>`;
    ancestors.forEach(a => {
      html += `<span class="crumb-sep">→</span><span class="crumb" data-drop-object="${a.id}" onclick="App.PanelManager.showObject('${a.id}')">${App.utils.escapeHtml(a.name)}</span>`;
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
        html += `<div class="item-row" draggable="true" data-drag-object="${child.id}" data-drop-object="${child.id}">
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
        html += `<div class="item-row" draggable="true" data-drag-item="${obj.id}:${i}">
          <span class="item-name${itemHl}" title="Переименовать" onclick="App.PanelManager._renameObjectItem('${obj.id}',${i})">· ${App.utils.escapeHtml(item)}</span>
          <button class="btn-icon" onclick="App.ModalManager.showMoveItem('${obj.id}',${i})" title="Переместить в другой объект">→</button>
          <button class="btn-icon" onclick="App.PanelManager._removeObjectItem('${obj.id}',${i})" title="Удалить">✕</button>
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

  function _removeObjectItem(objectId, itemIndex) {
    App.DataStore.removeObjectItem(objectId, itemIndex);
    this.showObject(objectId);
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

  // ===== HTML5 drag&drop в панели =====

  function _dndValidTarget(targetId) {
    if (!_dnd) return false;
    if (_dnd.kind === 'item') return targetId !== _dnd.objectId;
    // объект нельзя вложить в себя или своего потомка
    if (targetId === _dnd.objectId) return false;
    return !App.DataStore.isDescendant(targetId, _dnd.objectId);
  }

  function _onDragStart(e) {
    const itemEl = e.target.closest('[data-drag-item]');
    const objEl = e.target.closest('[data-drag-object]');
    if (itemEl) {
      const [objectId, index] = itemEl.getAttribute('data-drag-item').split(':');
      _dnd = { kind: 'item', objectId, index: Number(index) };
    } else if (objEl) {
      _dnd = { kind: 'object', objectId: objEl.getAttribute('data-drag-object') };
    } else {
      _dnd = null;
      return;
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', _dnd.kind);
    e.target.classList && e.target.classList.add('dragging-src');
  }

  function _onDragOver(e) {
    if (!_dnd) return;
    const t = e.target.closest('[data-drop-object], [data-drop-root]');
    document.querySelectorAll('#panel-content .drop-hover').forEach(el => el.classList.remove('drop-hover'));
    if (!t) return;
    if (t.hasAttribute('data-drop-root')) {
      // на «План» можно бросить только объект (открепить)
      if (_dnd.kind !== 'object') return;
    } else if (!_dndValidTarget(t.getAttribute('data-drop-object'))) {
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    t.classList.add('drop-hover');
  }

  function _onDrop(e) {
    if (!_dnd) return;
    const t = e.target.closest('[data-drop-object], [data-drop-root]');
    if (!t) return;
    e.preventDefault();
    document.querySelectorAll('#panel-content .drop-hover').forEach(el => el.classList.remove('drop-hover'));

    if (t.hasAttribute('data-drop-root')) {
      App.DataStore.moveObjectInto(_dnd.objectId, null);
    } else {
      const targetId = t.getAttribute('data-drop-object');
      if (!_dndValidTarget(targetId)) { _dnd = null; return; }
      if (_dnd.kind === 'item') App.DataStore.moveItem(_dnd.objectId, _dnd.index, targetId);
      else App.DataStore.moveObjectInto(_dnd.objectId, targetId);
    }
    _dnd = null;
    this.refresh();
  }

  function _onDragEnd() {
    _dnd = null;
    document.querySelectorAll('#panel-content .drop-hover, #panel-content .dragging-src')
      .forEach(el => el.classList.remove('drop-hover', 'dragging-src'));
  }

  return {
    init() {
      _defaultEl = document.getElementById('panel-default');
      _contentEl = document.getElementById('panel-content');

      // Делегированные слушатели drag&drop (панель перестраивается при каждом refresh)
      _contentEl.addEventListener('dragstart', _onDragStart);
      _contentEl.addEventListener('dragover', _onDragOver);
      _contentEl.addEventListener('drop', _onDrop);
      _contentEl.addEventListener('dragend', _onDragEnd);

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

    // Активный перетаскиваемый предмет (для drop-обработчика канвы в DragManager)
    getActiveItemDrag() {
      return _dnd && _dnd.kind === 'item' ? { objectId: _dnd.objectId, index: _dnd.index } : null;
    },
    clearItemDrag() { _dnd = null; },

    refresh() {
      if (_selectedObjectId) this.showObject(_selectedObjectId);
      else if (_selectedRoomId) this.showRoom(_selectedRoomId);
      else _showDefault();
    },

    _addObjectItem,
    _removeObjectItem,
    _addNestedObject,
    _initMoveObject,
    _renameObjectItem,
    _deleteObject,
    _deleteRoom
  };
})();
