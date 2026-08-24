window.App = window.App || {};

App.DragManager = (() => {
  let _svg = null;
  let _state = null;
  const SNAP_THRESHOLD = 8;
  const MIN_W = { object: 10, room: 20 };
  const MIN_H = { object: 10, room: 20 };

  function _snapValue(val, snapPositions) {
    for (const sp of snapPositions) {
      if (App.utils.isNear(val, sp, SNAP_THRESHOLD)) return sp;
    }
    return val;
  }

  function _getResizeInfo(e) {
    const el = e.target.closest('[data-resize]');
    if (!el) return null;
    return {
      handle: el.getAttribute('data-resize'),
      id: el.getAttribute('data-resize-target'),
      type: el.getAttribute('data-resize-type') || 'object'
    };
  }

  // Верхний корневой объект под курсором (кроме перетаскиваемого) — цель для вложения
  function _findDropTarget(px, py) {
    let found = null;
    App.DataStore.getRootObjects().forEach(o => {
      if (_state && o.id === _state.id) return;
      if (px >= o.x && px <= o.x + o.w && py >= o.y && py <= o.y + o.h) found = o.id;
    });
    return found;
  }

  // Подсветка цели после рендера (render пересоздаёт DOM каждый кадр)
  function _applyDropHighlight() {
    if (!_state || !_state.dropTargetId) return;
    const el = _svg.querySelector(`[data-draggable="${_state.dropTargetId}"]`);
    if (el) el.classList.add('drop-target');
  }

  // ===== HTML5 dnd: предмет из панели на объект канвы =====

  function _clearCanvasHighlight() {
    document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
  }

  function _canvasDropEl(e) {
    const el = e.target.closest('[data-draggable]');
    if (!el || el.getAttribute('data-dtype') !== 'object') return null;
    return App.DataStore.getObject(el.getAttribute('data-draggable')) ? el : null;
  }

  function _onCanvasDragOver(e) {
    const dnd = App.PanelManager.getActiveItemDrag && App.PanelManager.getActiveItemDrag();
    _clearCanvasHighlight();
    if (!dnd) return;
    const el = _canvasDropEl(e);
    if (!el || el.getAttribute('data-draggable') === dnd.objectId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    el.classList.add('drop-target');
  }

  function _onCanvasDrop(e) {
    const dnd = App.PanelManager.getActiveItemDrag && App.PanelManager.getActiveItemDrag();
    _clearCanvasHighlight();
    if (!dnd) return;
    const el = _canvasDropEl(e);
    if (!el) return;
    const targetId = el.getAttribute('data-draggable');
    if (targetId === dnd.objectId) return;
    e.preventDefault();
    if (App.DataStore.moveItem(dnd.objectId, dnd.index, targetId)) {
      App.PanelManager.clearItemDrag();
      App.PanelManager.refresh();
      App.EventBus.emit('drag:end', { type: 'item', from: dnd.objectId, to: targetId });
    }
  }

  function _onMouseDown(e) {
    if (e.button !== 0) return;

    // Check resize handle first
    const ri = _getResizeInfo(e);
    if (ri) {
      e.preventDefault();
      let target;
      if (ri.type === 'object') target = App.DataStore.getObjects().find(o => o.id === ri.id);
      else target = App.DataStore.getRooms().find(r => r.id === ri.id);
      if (!target) return;
      const pt = App.utils.svgPointFromEvent(_svg, e);
      _state = { type: ri.type, id: ri.id, handle: ri.handle, resizing: true,
        startX: pt.x, startY: pt.y, origX: target.x, origY: target.y,
        origW: target.w, origH: target.h, moved: false };
      return;
    }

    // Then drag
    const target = e.target.closest('[data-draggable]');
    if (!target) return;
    const id = target.getAttribute('data-draggable');
    const type = target.getAttribute('data-dtype') || 'object';
    if (!id) return;

    e.preventDefault();
    const pt = App.utils.svgPointFromEvent(_svg, e);

    if (type === 'object') {
      const obj = App.DataStore.getObjects().find(o => o.id === id);
      if (!obj) return;
      _state = { type: 'object', id, startX: pt.x, startY: pt.y, origX: obj.x, origY: obj.y, moved: false, resizing: false };
      target.classList.add('dragging');
    } else if (type === 'room') {
      const room = App.DataStore.getRooms().find(r => r.id === id);
      if (!room) return;
      _state = { type: 'room', id, startX: pt.x, startY: pt.y, origX: room.x, origY: room.y, moved: false, resizing: false };
      target.classList.add('dragging');
    }

    if (_state) App.EventBus.emit('drag:start', { type: _state.type, id: _state.id });
  }

  function _onMouseMove(e) {
    if (!_state) return;
    e.preventDefault();

    const pt = App.utils.svgPointFromEvent(_svg, e);
    const z = App.getZoom();
    let dx, dy;
    if (_state.resizing) {
      dx = (pt.x - _state.startX) / z;
      dy = (pt.y - _state.startY) / z;
    } else {
      dx = (pt.x - _state.startX) / z;
      dy = (pt.y - _state.startY) / z;
    }

    // Ignore sub-pixel jitter to avoid destroying click targets
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    _state.moved = true;

    if (_state.resizing) {
      _handleResize(dx, dy);
      return;
    }

    const newX = _state.origX + dx;
    const newY = _state.origY + dy;
    const snap = App.GuideManager.getSnapPositions();
    // Add ruler grid snap: every 1m (100px at scale=100)
    const grid = App.DataStore.getScale();
    for (let p = 0; p <= 5000; p += grid) {
      snap.x.push(p);
      snap.y.push(p);
    }

    if (_state.type === 'object') {
      const obj = App.DataStore.getObjects().find(o => o.id === _state.id);
      if (!obj) return;
      const finalX = _snapValue(newX, snap.x);
      const finalY = _snapValue(newY, snap.y);
      App.DataStore.moveObject(_state.id, finalX, finalY);

      // Определяем комнату по центру объекта и выводим событие
      const cx = obj.x + obj.w / 2;
      const cy = obj.y + obj.h / 2;
      const room = App.DataStore.getRooms().find(r =>
        cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h
      );
      App.EventBus.emit('object:moved', { id: obj.id, name: obj.name, room: room ? room.name : null });
      console.log(`[object:moved] ${obj.name} → ${room ? 'комната: ' + room.name : 'вне комнат'}`);

      // Бросок на другой объект = вложить (цель определяется позицией курсора)
      _state.dropTargetId = _findDropTarget(pt.x / z, pt.y / z);
    } else if (_state.type === 'room') {
      let finalX = newX;
      let finalY = newY;

      if (_state.snapLockedX) {
        if (Math.abs(newX - _state.snapX) > SNAP_THRESHOLD) {
          _state.snapLockedX = false;
        } else {
          finalX = _state.snapX;
        }
      } else {
        const snappedX = _snapValue(newX, snap.x);
        if (snappedX !== newX) {
          _state.snapX = snappedX;
          _state.snapLockedX = true;
          finalX = snappedX;
        }
      }

      if (_state.snapLockedY) {
        if (Math.abs(newY - _state.snapY) > SNAP_THRESHOLD) {
          _state.snapLockedY = false;
        } else {
          finalY = _state.snapY;
        }
      } else {
        const snappedY = _snapValue(newY, snap.y);
        if (snappedY !== newY) {
          _state.snapY = snappedY;
          _state.snapLockedY = true;
          finalY = snappedY;
        }
      }

      App.DataStore.moveRoom(_state.id, finalX, finalY);
    }

    App.EventBus.emit('drag:moving', { type: _state.type, id: _state.id });
    App.Renderer.render();
    _applyDropHighlight();
  }

  function _handleResize(dx, dy) {
    let newX = _state.origX, newY = _state.origY, newW = _state.origW, newH = _state.origH;
    const minW = MIN_W[_state.type] || 10;
    const minH = MIN_H[_state.type] || 10;
    const h = _state.handle;

    if (h.includes('e')) { newW = _state.origW + dx; }
    if (h.includes('w')) { newX = _state.origX + dx; newW = _state.origW - dx; }
    if (h.includes('s')) newH = _state.origH + dy;
    if (h.includes('n')) { newY = _state.origY + dy; newH = _state.origH - dy; }

    if (newW < minW) {
      if (h.includes('w')) newX = _state.origX + _state.origW - minW;
      newW = minW;
    }
    if (newH < minH) {
      if (h.includes('n')) newY = _state.origY + _state.origH - minH;
      newH = minH;
    }

    if (_state.type === 'object') {
      App.DataStore.updateObject(_state.id, { x: Math.round(newX), y: Math.round(newY), w: Math.round(newW), h: Math.round(newH) });
    } else {
      App.DataStore.updateRoom(_state.id, { x: Math.round(newX), y: Math.round(newY), w: Math.round(newW), h: Math.round(newH) });
    }

    App.Renderer.render();
  }

  function _onMouseUp() {
    if (!_state) return;

    document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));

    // Click emulation: mousedown + mouseup with no movement = should open panel
    if (!_state.moved && !_state.resizing) {
      if (_state.type === 'object') App.PanelManager.showObject(_state.id);
      else if (_state.type === 'room') App.PanelManager.showRoom(_state.id);
      _state = null;
      return;
    }

    // Бросок объекта на другой объект — вложить
    if (_state.type === 'object' && !_state.resizing && _state.dropTargetId) {
      const draggedId = _state.id;
      const targetId = _state.dropTargetId;
      _state = null;
      if (App.DataStore.moveObjectInto(draggedId, targetId)) {
        App.PanelManager.refresh();
        App.Renderer.render();
        App.EventBus.emit('drag:end', { type: 'object', id: draggedId, nestedInto: targetId });
      }
      return;
    }

    App.DataStore.save();
    App.EventBus.emit('drag:end', App.utils.deepClone(_state));
    _state = null;
  }

  return {
    init(svg) {
      _svg = svg;
      _svg.addEventListener('mousedown', _onMouseDown);
      document.addEventListener('mousemove', _onMouseMove);
      document.addEventListener('mouseup', _onMouseUp);
      _svg.addEventListener('dragover', _onCanvasDragOver);
      _svg.addEventListener('drop', _onCanvasDrop);
    },

    destroy() {
      _svg.removeEventListener('mousedown', _onMouseDown);
      document.removeEventListener('mousemove', _onMouseMove);
      document.removeEventListener('mouseup', _onMouseUp);
      _svg.removeEventListener('dragover', _onCanvasDragOver);
      _svg.removeEventListener('drop', _onCanvasDrop);
      _state = null;
    }
  };
})();
