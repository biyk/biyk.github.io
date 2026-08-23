window.App = window.App || {};

App.ModalManager = (() => {
  let _overlay = null;
  let _content = null;

  function _createDefault() {
    _overlay = document.getElementById('modal-overlay');
    _content = document.getElementById('modal-content');
    if (!_overlay || !_content) {
      _overlay = document.createElement('div');
      _overlay.id = 'modal-overlay';
      _overlay.className = 'modal-overlay';
      _overlay.style.display = 'none';
      _overlay.addEventListener('click', (e) => { if (e.target === _overlay) close(); });
      document.body.appendChild(_overlay);
      _content = document.createElement('div');
      _content.id = 'modal-content';
      _content.className = 'modal';
      _overlay.appendChild(_content);
    }
  }

  function _inputVal(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }

  function _setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  function close() {
    if (_overlay) _overlay.style.display = 'none';
    if (_content) _content.innerHTML = '';
    App.EventBus.emit('modal:closed');
  }

  function show(html) {
    if (!_content) _createDefault();
    _content.innerHTML = html;
    _overlay.style.display = 'flex';
    App.EventBus.emit('modal:opened');
  }

  function _buildRoomForm(data) {
    const isEdit = !!data;
    return `
      <h2>${isEdit ? '✏ Редактировать комнату' : '➕ Добавить комнату'}</h2>
      <label>Название комнаты</label>
      <input type="text" id="modal-name" placeholder="Например: Гостиная" value="${isEdit ? data.name : ''}">
      <label>Координаты и размеры (X, Y, Ширина, Высота)</label>
      <div class="modal-grid">
        <input type="number" id="modal-x" placeholder="X" value="${isEdit ? data.x : '50'}">
        <input type="number" id="modal-y" placeholder="Y" value="${isEdit ? data.y : '50'}">
        <input type="number" id="modal-w" placeholder="Ширина" value="${isEdit ? data.w : '300'}">
        <input type="number" id="modal-h" placeholder="Высота" value="${isEdit ? data.h : '200'}">
      </div>
      <div class="modal-buttons">
        <button class="btn-primary" onclick="App.ModalManager._submitRoom(${isEdit ? `'${data.id}'` : 'null'})">${isEdit ? 'Сохранить' : 'Создать'}</button>
        <button class="btn-cancel" onclick="App.ModalManager._close()">Отмена</button>
      </div>
    `;
  }

  function _buildObjectForm(editObj) {
    const rooms = App.DataStore.getRooms();
    const roomOpts = rooms.map(r =>
      `<option value="${r.id}" ${editObj && editObj.roomId === r.id ? 'selected' : ''}>${r.name}</option>`
    ).join('') || '<option value="">— нет комнат —</option>';

    const isEdit = !!editObj;
    const colors = App.utils.COLORS.map((c, i) =>
      `<div class="color-swatch ${(!editObj && i === 0) || (editObj && editObj.color === c) ? 'active' : ''}"
           style="background:${c}"
           data-color="${c}"
           onclick="App.ModalManager._pickColor(this)"></div>`
    ).join('');

    return `
      <h2>${isEdit ? '✏ Редактировать объект' : '📦 Добавить объект'}</h2>
      <label>Название</label>
      <input type="text" id="modal-name" placeholder="Например: Стеллаж" value="${isEdit ? editObj.name : ''}">
      <label>Комната</label>
      <select id="modal-room">${roomOpts}</select>
      <label>Координаты и размеры</label>
      <div class="modal-grid">
        <input type="number" id="modal-x" placeholder="X" value="${isEdit ? editObj.x : '100'}">
        <input type="number" id="modal-y" placeholder="Y" value="${isEdit ? editObj.y : '100'}">
        <input type="number" id="modal-w" placeholder="Ширина" value="${isEdit ? editObj.w : '80'}">
        <input type="number" id="modal-h" placeholder="Высота" value="${isEdit ? editObj.h : '40'}">
      </div>
      <label>Цвет</label>
      <div class="color-picker" id="color-picker">${colors}</div>
      <input type="hidden" id="modal-color" value="${isEdit ? editObj.color : App.utils.COLORS[0]}">
      <div class="modal-buttons">
        <button class="btn-primary" onclick="App.ModalManager._submitObject(${isEdit ? `'${editObj.id}'` : 'null'})">${isEdit ? 'Сохранить' : 'Создать'}</button>
        <button class="btn-cancel" onclick="App.ModalManager._close()">Отмена</button>
      </div>
    `;
  }

  function _pickColor(el) {
    document.querySelectorAll('#color-picker .color-swatch').forEach(d => d.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('modal-color').value = el.getAttribute('data-color');
  }

  function _submitRoom(editId) {
    const name = _inputVal('modal-name').trim();
    const x = +_inputVal('modal-x');
    const y = +_inputVal('modal-y');
    const w = +_inputVal('modal-w');
    const h = +_inputVal('modal-h');
    if (!name) { alert('Введите название комнаты'); return; }
    if (editId) {
      App.DataStore.updateRoom(editId, { name, x, y, w, h });
    } else {
      App.DataStore.addRoom({ name, x, y, w, h });
    }
    close();
  }

  function _submitObject(editId) {
    const name = _inputVal('modal-name').trim();
    const roomId = _inputVal('modal-room');
    const x = +_inputVal('modal-x');
    const y = +_inputVal('modal-y');
    const w = +_inputVal('modal-w');
    const h = +_inputVal('modal-h');
    const color = _inputVal('modal-color');
    if (!name) { alert('Введите название объекта'); return; }
    if (!roomId) { alert('Выберите комнату'); return; }
    if (editId) {
      App.DataStore.updateObject(editId, { name, roomId, x, y, w, h, color });
    } else {
      App.DataStore.addObject({ name, roomId, x, y, w, h, color });
    }
    close();
  }

  function showAddRoom() { show(_buildRoomForm(null)); }
  function showEditRoom(id) {
    const room = App.DataStore.getRooms().find(r => r.id === id);
    if (room) show(_buildRoomForm(room));
  }

  function showAddObject(prefillRoomId) {
    const form = _buildObjectForm(null);
    show(form);
    if (prefillRoomId) {
      const sel = document.getElementById('modal-room');
      if (sel) sel.value = prefillRoomId;
    }
  }

  function showEditObject(id) {
    const obj = App.DataStore.getObjects().find(o => o.id === id);
    if (obj) show(_buildObjectForm(obj));
  }

  function _buildMoveObjectForm(objectId) {
    const obj = App.DataStore.getObject(objectId);
    if (!obj) return '';

    const objects = App.DataStore.getObjects()
      .filter(o => o.id !== objectId && !App.DataStore.isDescendant(o.id, objectId));
    const validIds = new Set(objects.map(o => o.id));

    let opts = obj.parentId ? '<option value="">Сделать независимым (на план)</option>' : '';

    function _addObjectOptions(parentId, depth) {
      const children = objects.filter(o => o.parentId === parentId && validIds.has(o.id));
      children.forEach(o => {
        const indent = '\u00a0\u00a0'.repeat(depth);
        opts += `<option value="${o.id}">${indent}${depth > 0 ? '└ ' : ''}${App.utils.escapeHtml(o.name)}</option>`;
        _addObjectOptions(o.id, depth + 1);
      });
    }

    const rooms = App.DataStore.getRooms();
    rooms.forEach(room => {
      const roomObjs = objects.filter(o => o.parentId === null && o.roomId === room.id);
      if (roomObjs.length === 0) return;
      opts += `<option value="" disabled>── ${App.utils.escapeHtml(room.name)} ──</option>`;
      roomObjs.forEach(o => {
        opts += `<option value="${o.id}">${App.utils.escapeHtml(o.name)}</option>`;
        _addObjectOptions(o.id, 1);
      });
    });

    return `
      <h2>📥 ${obj.parentId ? 'Переместить объект' : 'Положить в объект'}</h2>
      <label>Текущий объект: ${App.utils.escapeHtml(obj.name)}</label>
      <label>Куда положить</label>
      <select id="modal-target-object">${opts}</select>
      <div class="modal-buttons">
        <button class="btn-primary" onclick="App.ModalManager._submitMoveObject('${objectId}')">Переместить</button>
        <button class="btn-cancel" onclick="App.ModalManager._close()">Отмена</button>
      </div>
    `;
  }

  function _submitMoveObject(objectId) {
    const obj = App.DataStore.getObject(objectId);
    if (!obj) return;
    const targetId = document.getElementById('modal-target-object').value;
    if (!targetId && !obj.parentId) return;
    if (App.DataStore.moveObjectInto(objectId, targetId || null)) {
      close();
      App.PanelManager.refresh();
    } else {
      alert('Не удалось переместить объект');
    }
  }

  function showMoveObject(objectId) {
    const html = _buildMoveObjectForm(objectId);
    if (html) show(html);
  }

  function _buildAddPlanForm() {
    return `
      <h2>🏠 Новая квартира</h2>
      <label>Название квартиры</label>
      <input type="text" id="modal-name" placeholder="Например: Дача">
      <div class="modal-buttons">
        <button class="btn-primary" onclick="App.ModalManager._submitAddPlan()">Создать</button>
        <button class="btn-cancel" onclick="App.ModalManager._close()">Отмена</button>
      </div>
    `;
  }

  function showAddPlan() {
    show(_buildAddPlanForm());
    const inp = document.getElementById('modal-name');
    if (inp) inp.focus();
  }

  function _submitAddPlan() {
    const name = _inputVal('modal-name').trim();
    if (!name) { alert('Введите название квартиры'); return; }
    const res = App.DataStore.createPlan(name);
    if (!res) { alert('Квартира с таким названием уже существует'); return; }
    close();
  }

  function _buildManagePlansForm() {
    const active = App.DataStore.getActivePlanId();
    const rows = App.DataStore.listPlans().map(p => `
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;">${App.utils.escapeHtml(p.name)}${p.id === active ? ' <em style="color:#4fc3f7;">— текущая</em>' : ''}</span>
        <button onclick="App.ModalManager.showRenamePlan('${p.id}')" title="Переименовать">✏</button>
        <button class="btn-danger" onclick="App.ModalManager._submitDeletePlan('${p.id}')" title="Удалить">🗑</button>
      </div>
    `).join('');
    return `
      <h2>⚙ Квартиры</h2>
      ${rows}
      <div class="modal-buttons">
        <button class="btn-cancel" onclick="App.ModalManager._close()">Закрыть</button>
      </div>
    `;
  }

  function showManagePlans() { show(_buildManagePlansForm()); }

  function showRenamePlan(id) {
    const p = App.DataStore.listPlans().find(x => x.id === id);
    if (!p) return;
    show(`
      <h2>✏ Переименовать квартиру</h2>
      <label>Новое название</label>
      <input type="text" id="modal-name" value="${App.utils.escapeHtml(p.name)}">
      <div class="modal-buttons">
        <button class="btn-primary" onclick="App.ModalManager._submitRenamePlan('${id}')">Сохранить</button>
        <button class="btn-cancel" onclick="App.ModalManager._close()">Отмена</button>
      </div>
    `);
  }

  function _submitRenamePlan(id) {
    const name = _inputVal('modal-name').trim();
    if (!name) { alert('Введите название'); return; }
    if (!App.DataStore.renamePlan(id, name)) { alert('Не удалось переименовать: возможно, такое имя уже занято'); return; }
    showManagePlans();
  }

  function _submitDeletePlan(id) {
    const p = App.DataStore.listPlans().find(x => x.id === id);
    if (!p) return;
    if (!confirm(`Удалить квартиру «${p.name}» вместе со всеми её данными?`)) return;
    if (!App.DataStore.deletePlan(id)) { alert('Нельзя удалить последнюю квартиру'); return; }
    showManagePlans();
  }

  return {
    init() {
      _createDefault();
    },

    show,
    close,
    _close: close,

    showAddRoom,
    showEditRoom,
    showAddObject,
    showEditObject,
    showMoveObject,

    showAddPlan,
    showManagePlans,
    showRenamePlan,

    _submitRoom,
    _submitObject,
    _pickColor,
    _submitMoveObject,
    _submitAddPlan,
    _submitRenamePlan,
    _submitDeletePlan
  };
})();
