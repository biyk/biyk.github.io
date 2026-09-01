window.App = window.App || {};

App.DataStore = (() => {
  const STORAGE_KEY = 'apartmentPlan';
  const PLANS_KEY = 'apartmentPlans';
  const ACTIVE_KEY = 'apartmentPlanActive';
  let _data = null;
  let _plans = [{ id: 'plan', name: 'plan' }];
  let _activeId = 'plan';

  function _keyFor(id) {
    return id === 'plan' ? STORAGE_KEY : STORAGE_KEY + ':' + id;
  }

  function _loadRegistry() {
    try {
      const raw = localStorage.getItem(PLANS_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length && arr.every(p => p && p.id && p.name)) {
          _plans = arr;
          return;
        }
      }
    } catch (e) { console.warn('[DataStore] corrupt plans registry'); }
    _plans = [{ id: 'plan', name: 'plan' }];
  }

  function _saveRegistry() {
    try { localStorage.setItem(PLANS_KEY, JSON.stringify(_plans)); } catch (e) { console.warn('[DataStore] save registry failed:', e); }
  }

  function _saveActiveId() {
    try { localStorage.setItem(ACTIVE_KEY, _activeId); } catch (e) {}
  }

  function _emptyDoc() {
    return { scale: 100, rooms: [], objects: [], guides: [] };
  }

  function _validate() {
    if (!_data) return false;
    if (!Array.isArray(_data.rooms)) _data.rooms = [];
    if (!Array.isArray(_data.objects)) _data.objects = [];
    if (!Array.isArray(_data.guides)) _data.guides = [];
    if (typeof _data.scale !== 'number' || _data.scale <= 0) _data.scale = 100;

    // Миграция старых данных: containers -> вложенные объекты
    const migrated = [];
    _data.objects.forEach(o => {
      if (!Array.isArray(o.items)) o.items = [];
      if (Array.isArray(o.containers) && o.containers.length > 0) {
        o.containers.forEach(c => {
          migrated.push({
            id: App.utils.generateId('o'),
            name: (c && c.name) || 'Без названия',
            roomId: o.roomId || null,
            parentId: o.id,
            x: 0, y: 0, w: 10, h: 10,
            color: '#4a90d9',
            items: (c && Array.isArray(c.items)) ? c.items : []
          });
        });
      }
      delete o.containers;
    });
    if (migrated.length) _data.objects = _data.objects.concat(migrated);

    const ids = new Set();
    _data.objects.forEach(o => {
      if (!Array.isArray(o.items)) o.items = [];
      if (o.id === undefined || o.id === null) o.id = App.utils.generateId('o');
      ids.add(o.id);
    });
    // Миграция старых данных + защита от битых ссылок на родителя
    _data.objects.forEach(o => {
      if (!('parentId' in o)) o.parentId = null;
      if (o.parentId !== null && o.parentId !== undefined && !ids.has(o.parentId)) o.parentId = null;
      if (o.parentId === undefined) o.parentId = null;
    });
    // Защита от циклов: обрываем цепочки, зацикливающиеся до null
    const findById = id => _data.objects.find(o => o.id === id);
    _data.objects.forEach(o => {
      let cur = o;
      const localSeen = new Set();
      while (cur && cur.parentId) {
        if (localSeen.has(cur.id)) {
          cur.parentId = null;
          break;
        }
        localSeen.add(cur.id);
        cur = findById(cur.parentId);
        if (!cur) break;
      }
    });
    return true;
  }

  function _persist() {
    try { localStorage.setItem(_keyFor(_activeId), JSON.stringify(_data)); } catch (e) { console.warn('[DataStore] save failed:', e); }
  }

  return {
    init() {
      _loadRegistry();
      _activeId = localStorage.getItem(ACTIVE_KEY) || _plans[0].id;
      if (!_plans.some(p => p.id === _activeId)) _activeId = _plans[0].id;
      try {
        const raw = localStorage.getItem(_keyFor(_activeId));
        if (raw) {
          _data = JSON.parse(raw);
          _validate();
          _saveActiveId();
          return;
        }
      } catch (e) { console.warn('[DataStore] corrupt data, using empty'); }
      // Нет демо-данных: новое устройство стартует с пустого плана,
      // настоящие данные подгружаются из облака (см. _doSheetsImport в app.js)
      _data = _emptyDoc();
      _persist();
      _saveActiveId();
    },

    listPlans() { return App.utils.deepClone(_plans); },
    getActivePlanId() { return _activeId; },
    getActivePlanName() {
      const p = _plans.find(x => x.id === _activeId);
      return p ? p.name : '';
    },

    createPlan(name) {
      const n = String(name || '').trim();
      if (!n) return false;
      if (_plans.some(p => p.name.toLowerCase() === n.toLowerCase())) return false;
      _persist();
      const entry = { id: App.utils.generateId('plan'), name: n };
      _plans.push(entry);
      _saveRegistry();
      _activeId = entry.id;
      _saveActiveId();
      _data = _emptyDoc();
      _persist();
      App.EventBus.emit('plan:created', Object.assign({}, entry));
      App.EventBus.emit('plan:listChanged');
      App.EventBus.emit('plan:switched', Object.assign({}, entry));
      App.EventBus.emit('data:changed', { source: 'plan:created' });
      return Object.assign({}, entry);
    },

    switchPlan(id) {
      const target = _plans.find(p => p.id === id);
      if (!target || id === _activeId) return false;
      _persist();
      _activeId = id;
      try {
        const raw = localStorage.getItem(_keyFor(id));
        _data = raw ? JSON.parse(raw) : _emptyDoc();
      } catch (e) { _data = _emptyDoc(); }
      _validate();
      _saveActiveId();
      App.EventBus.emit('plan:switched', { id: target.id, name: target.name });
      App.EventBus.emit('data:changed', { source: 'plan:switched' });
      return true;
    },

    renamePlan(id, newName) {
      const p = _plans.find(x => x.id === id);
      if (!p) return false;
      const n = String(newName || '').trim();
      if (!n) return false;
      if (_plans.some(x => x.id !== id && x.name.toLowerCase() === n.toLowerCase())) return false;
      const oldName = p.name;
      p.name = n;
      _saveRegistry();
      App.EventBus.emit('plan:renamed', { id, oldName, name: n });
      App.EventBus.emit('plan:listChanged');
      return true;
    },

    deletePlan(id) {
      const idx = _plans.findIndex(p => p.id === id);
      if (idx === -1) return false;
      if (_plans.length === 1) return false;
      const removed = _plans.splice(idx, 1)[0];
      _saveRegistry();
      try { localStorage.removeItem(_keyFor(id)); } catch (e) {}
      let switchedTo = null;
      if (id === _activeId) {
        _activeId = _plans[0].id;
        _saveActiveId();
        try {
          const raw = localStorage.getItem(_keyFor(_activeId));
          _data = raw ? JSON.parse(raw) : _emptyDoc();
        } catch (e) { _data = _emptyDoc(); }
        _validate();
        switchedTo = { id: _activeId, name: this.getActivePlanName() };
      }
      App.EventBus.emit('plan:deleted', { id: removed.id, name: removed.name });
      App.EventBus.emit('plan:listChanged');
      if (switchedTo) {
        App.EventBus.emit('plan:switched', switchedTo);
        App.EventBus.emit('data:changed', { source: 'plan:deleted' });
      }
      return true;
    },

    registerCloudPlans(names) {
      let added = 0;
      (Array.isArray(names) ? names : []).forEach(n => {
        if (typeof n !== 'string') return;
        const t = n.trim();
        if (!t) return;
        if (_plans.some(p => p.name.toLowerCase() === t.toLowerCase())) return;
        _plans.push({ id: App.utils.generateId('plan'), name: t });
        added++;
      });
      if (added) {
        _saveRegistry();
        App.EventBus.emit('plan:listChanged');
      }
      return added;
    },

    getData() { return _data; },
    getRooms() { return _data.rooms; },
    getObjects() { return _data.objects; },
    getGuides() { return _data.guides; },
    getScale() { return _data.scale; },

    getObject(id) { return _data.objects.find(o => o.id === id) || null; },

    getChildren(parentId) { return _data.objects.filter(o => o.parentId === parentId); },

    getRootObjects() { return _data.objects.filter(o => !o.parentId); },

    getAncestors(id) {
      const res = [];
      const seen = new Set();
      let cur = _data.objects.find(o => o.id === id);
      while (cur && cur.parentId && !seen.has(cur.id)) {
        seen.add(cur.id);
        cur = _data.objects.find(o => o.id === cur.parentId);
        if (cur) res.unshift(cur);
      }
      return res;
    },

    getRootAncestor(id) {
      let cur = _data.objects.find(o => o.id === id);
      if (!cur) return null;
      const seen = new Set();
      while (cur.parentId && !seen.has(cur.id)) {
        seen.add(cur.id);
        cur = _data.objects.find(o => o.id === cur.parentId);
        if (!cur) return null;
      }
      return cur;
    },

    isDescendant(maybeChildId, maybeAncestorId) {
      let cur = _data.objects.find(o => o.id === maybeChildId);
      const seen = new Set();
      while (cur && cur.parentId && !seen.has(cur.id)) {
        seen.add(cur.id);
        cur = _data.objects.find(o => o.id === cur.parentId);
        if (cur && cur.id === maybeAncestorId) return true;
      }
      return false;
    },

    getObjectTotalItems(id) {
      const obj = _data.objects.find(o => o.id === id);
      if (!obj) return 0;
      let total = (obj.items ? obj.items.length : 0);
      _data.objects.forEach(o => { if (o.parentId === id) total += this.getObjectTotalItems(o.id); });
      return total;
    },

    isObjectEmpty(id) {
      const obj = _data.objects.find(o => o.id === id);
      if (!obj) return true;
      return _data.objects.every(o => o.parentId !== id)
        && (!obj.items || obj.items.length === 0);
    },

    save() { _persist(); App.EventBus.emit('data:changed', { source: 'save' }); },

    addRoom(room) {
      if (!room || !room.name) return false;
      const entry = {
        id: App.utils.generateId('r'),
        name: room.name.trim(),
        x: App.utils.clamp(+room.x || 0, 0, 2000),
        y: App.utils.clamp(+room.y || 0, 0, 2000),
        w: App.utils.clamp(+room.w || 200, 20, 2000),
        h: App.utils.clamp(+room.h || 200, 20, 2000),
      };
      _data.rooms.push(entry);
      _persist();
      App.EventBus.emit('room:added', entry);
      App.EventBus.emit('data:changed', { source: 'room:added' });
      return entry;
    },

    updateRoom(id, props) {
      const room = _data.rooms.find(r => r.id === id);
      if (!room) return false;
      if (props.name !== undefined) room.name = String(props.name).trim() || room.name;
      if (props.x !== undefined) room.x = App.utils.clamp(+props.x, 0, 2000);
      if (props.y !== undefined) room.y = App.utils.clamp(+props.y, 0, 2000);
      if (props.w !== undefined) room.w = App.utils.clamp(+props.w, 20, 2000);
      if (props.h !== undefined) room.h = App.utils.clamp(+props.h, 20, 2000);
      _persist();
      App.EventBus.emit('room:updated', { id, room });
      App.EventBus.emit('data:changed', { source: 'room:updated' });
      return true;
    },

    deleteRoom(id) {
      const idx = _data.rooms.findIndex(r => r.id === id);
      if (idx === -1) return false;
      // Preserve objects; they become independent after room removal
      _data.rooms.splice(idx, 1);
      _persist();
      App.EventBus.emit('room:deleted', id);
      App.EventBus.emit('data:changed', { source: 'room:deleted' });
      return true;
    },

    addObject(obj) {
      if (!obj || !obj.name) return false;
      let roomId = obj.roomId || null;
      let parentId = obj.parentId || null;
      const rx = +obj.x || 0, ry = +obj.y || 0, rw = +obj.w || 60, rh = +obj.h || 40;
      if (parentId) {
        const parent = _data.objects.find(o => o.id === parentId);
        if (!parent) parentId = null;
        else roomId = parent.roomId || null;
      }
      if (!roomId && !parentId) {
        const cx = rx + rw / 2, cy = ry + rh / 2;
        const room = _data.rooms.find(r => cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h);
        if (room) roomId = room.id;
      }
      const entry = {
        id: App.utils.generateId('o'),
        name: obj.name.trim(),
        roomId: roomId,
        parentId: parentId,
        x: App.utils.clamp(rx, 0, 2000),
        y: App.utils.clamp(ry, 0, 2000),
        w: App.utils.clamp(rw, 10, 1000),
        h: App.utils.clamp(rh, 10, 1000),
        color: obj.color || App.utils.nextColor(),
        items: []
      };
      _data.objects.push(entry);
      _persist();
      App.EventBus.emit('object:added', entry);
      App.EventBus.emit('data:changed', { source: 'object:added' });
      return entry;
    },

    updateObject(id, props) {
      const obj = _data.objects.find(o => o.id === id);
      if (!obj) return false;
      if (props.name !== undefined) obj.name = String(props.name).trim() || obj.name;
      if (props.roomId !== undefined && _data.rooms.some(r => r.id === props.roomId)) obj.roomId = props.roomId;
      if (props.x !== undefined) obj.x = App.utils.clamp(+props.x, 0, 2000);
      if (props.y !== undefined) obj.y = App.utils.clamp(+props.y, 0, 2000);
      if (props.w !== undefined) obj.w = App.utils.clamp(+props.w, 10, 1000);
      if (props.h !== undefined) obj.h = App.utils.clamp(+props.h, 10, 1000);
      if (props.color !== undefined) obj.color = props.color;
      _persist();
      App.EventBus.emit('object:updated', { id, obj });
      App.EventBus.emit('data:changed', { source: 'object:updated' });
      return true;
    },

    moveObject(id, x, y) {
      const obj = _data.objects.find(o => o.id === id);
      if (!obj) return false;
      obj.x = App.utils.clamp(Math.round(x), 0, 2000);
      obj.y = App.utils.clamp(Math.round(y), 0, 2000);
      // Вложенные объекты не имеют собственной геометрии — комнату не пересчитываем
      if (obj.parentId) return true;
      // Определяем комнату по центру объекта
      const cx = obj.x + obj.w / 2, cy = obj.y + obj.h / 2;
      const room = _data.rooms.find(r => cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h);
      obj.roomId = room ? room.id : null;
      _persist();
      return true;
    },

    moveRoom(id, x, y) {
      const room = _data.rooms.find(r => r.id === id);
      if (!room) return false;
      const dx = Math.round(x) - room.x;
      const dy = Math.round(y) - room.y;
      room.x = App.utils.clamp(Math.round(x), 0, 2000);
      room.y = App.utils.clamp(Math.round(y), 0, 2000);
      // Objects are independent; no longer moved with rooms
      _persist();
      return true;
    },

    deleteObject(id) {
      const obj = _data.objects.find(o => o.id === id);
      if (!obj) return false;
      // Удалять можно только пустые объекты (без вложенных объектов и предметов)
      const hasChildren = _data.objects.some(o => o.parentId === id);
      if (hasChildren || (obj.items && obj.items.length > 0)) return false;
      const idx = _data.objects.findIndex(o => o.id === id);
      if (idx === -1) return false;
      _data.objects.splice(idx, 1);
      _persist();
      App.EventBus.emit('object:deleted', id);
      App.EventBus.emit('data:changed', { source: 'object:deleted' });
      return true;
    },

    moveObjectInto(objectId, newParentId) {
      const obj = _data.objects.find(o => o.id === objectId);
      if (!obj) return false;
      if (newParentId) {
        if (newParentId === objectId) return false;
        // Цикл: нельзя вложить в своего же потомка
        if (this.isDescendant(newParentId, objectId)) return false;
        const parent = _data.objects.find(o => o.id === newParentId);
        if (!parent) return false;
        obj.parentId = newParentId;
        obj.roomId = parent.roomId || null;
      } else {
        // Сделать независимым: комнату пересчитываем по координатам
        obj.parentId = null;
        const cx = obj.x + obj.w / 2, cy = obj.y + obj.h / 2;
        const room = _data.rooms.find(r => cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h);
        obj.roomId = room ? room.id : null;
      }
      _persist();
      App.EventBus.emit('object:updated', { id: objectId, obj });
      App.EventBus.emit('data:changed', { source: 'object:move' });
      return true;
    },

    addObjectItem(objectId, itemName) {
      const obj = _data.objects.find(o => o.id === objectId);
      if (!obj || !itemName || !itemName.trim()) return false;
      obj.items.push(itemName.trim());
      _persist();
      App.EventBus.emit('item:added', { objectId, item: itemName.trim() });
      App.EventBus.emit('data:changed', { source: 'item:added' });
      return true;
    },

    renameObjectItem(objectId, itemIndex, newName) {
      const obj = _data.objects.find(o => o.id === objectId);
      if (!obj || itemIndex < 0 || itemIndex >= obj.items.length) return false;
      if (!newName || !newName.trim()) return false;
      obj.items[itemIndex] = newName.trim();
      _persist();
      App.EventBus.emit('item:updated', { objectId, itemIndex, item: obj.items[itemIndex] });
      App.EventBus.emit('data:changed', { source: 'item:updated' });
      return true;
    },

    removeObjectItem(objectId, itemIndex) {
      const obj = _data.objects.find(o => o.id === objectId);
      if (!obj || itemIndex < 0 || itemIndex >= obj.items.length) return false;
      const removed = obj.items.splice(itemIndex, 1)[0];
      _persist();
      App.EventBus.emit('item:removed', { objectId, item: removed });
      App.EventBus.emit('data:changed', { source: 'item:removed' });
      return true;
    },

    // Перенос предмета из одного объекта в другой
    moveItem(fromObjectId, fromIndex, toObjectId) {
      if (fromObjectId === toObjectId) return false;
      const src = _data.objects.find(o => o.id === fromObjectId);
      const dst = _data.objects.find(o => o.id === toObjectId);
      if (!src || !dst) return false;
      if (!Number.isInteger(fromIndex) || fromIndex < 0 || fromIndex >= src.items.length) return false;
      const item = src.items.splice(fromIndex, 1)[0];
      dst.items.push(item);
      _persist();
      App.EventBus.emit('item:moved', { fromObjectId, toObjectId, item });
      App.EventBus.emit('data:changed', { source: 'item:moved' });
      return true;
    },

    addGuide(orientation, position) {
      const entry = { id: App.utils.generateId('g'), orientation, position: Math.round(position) };
      _data.guides.push(entry);
      _persist();
      App.EventBus.emit('guide:added', entry);
      App.EventBus.emit('data:changed', { source: 'guide:added' });
      return entry;
    },

    updateGuide(id, position) {
      const guide = _data.guides.find(g => g.id === id);
      if (!guide) return false;
      guide.position = Math.round(position);
      _persist();
      App.EventBus.emit('guide:updated', { id, guide });
      App.EventBus.emit('data:changed', { source: 'guide:updated' });
      return true;
    },

    removeGuide(id) {
      const idx = _data.guides.findIndex(g => g.id === id);
      if (idx === -1) return false;
      _data.guides.splice(idx, 1);
      _persist();
      App.EventBus.emit('guide:removed', id);
      App.EventBus.emit('data:changed', { source: 'guide:removed' });
      return true;
    },

    clearAllGuides() {
      _data.guides = [];
      _persist();
      App.EventBus.emit('guide:removed', 'all');
      App.EventBus.emit('data:changed', { source: 'guide:clear' });
    },

    reset(toDefault = true) {
      // Демо-данных нет: сброс всегда очищает план (toDefault сохранён для совместимости вызова)
      _data = { scale: 100, rooms: [], objects: [], guides: [] };
      _persist();
      App.EventBus.emit('data:reset');
      App.EventBus.emit('data:changed', { source: 'reset' });
    },

    importData(raw) {
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed.rooms) || !Array.isArray(parsed.objects)) return { ok: false, error: 'Неверный формат: отсутствуют rooms или objects' };
        _data = parsed;
        _validate();
        _persist();
        App.EventBus.emit('data:imported');
        App.EventBus.emit('data:changed', { source: 'import' });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: `Ошибка парсинга: ${e.message}` };
      }
    },

    exportData() {
      return JSON.stringify(_data, null, 2);
    }
  };
})();
