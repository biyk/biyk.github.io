window.App = window.App || {};

App.Renderer = (() => {
  let _svg = null;
  let _planContent = null;
  let _handlesGroup = null;
  let _zoomGroup = null;
  let _searchMatchIds = new Set();

  function _render() {
    if (!_svg || !_planContent) return;
    _planContent.innerHTML = '';
    _handlesGroup.innerHTML = '';

    const { createSvgElement: el } = App.utils;
    const data = App.DataStore.getData();

    // Rooms
    data.rooms.forEach(room => {
      const rect = el('rect', {
        x: room.x, y: room.y, width: room.w, height: room.h,
        fill: '#e0e0e0', stroke: '#555', 'stroke-width': 2,
        'vector-effect': 'non-scaling-stroke',
        rx: 4, ry: 4, class: 'room-bg',
        'data-draggable': room.id,
        'data-dtype': 'room'
      });
      rect.addEventListener('click', () => App.PanelManager.showRoom(room.id));
      _planContent.appendChild(rect);

      const label = el('text', {
        x: room.x + room.w / 2, y: room.y + room.h / 2,
        class: 'room-label'
      });
      label.textContent = room.name;
      _planContent.appendChild(label);
    });

    // Objects (только корневые — вложенные отображаются в панели)
    App.DataStore.getRootObjects().forEach(obj => {
      const isHighlighted = _searchMatchIds.has(obj.id);
      const g = el('g', { class: 'object-group' });
      g.addEventListener('click', () => App.PanelManager.showObject(obj.id));

      const rect = el('rect', {
        x: obj.x, y: obj.y, width: obj.w, height: obj.h,
        fill: obj.color || '#4a90d9', stroke: '#2c3e50', 'stroke-width': 2,
        'vector-effect': 'non-scaling-stroke',
        rx: 3, ry: 3, class: `object-rect${isHighlighted ? ' search-match' : ''}`,
        'data-draggable': obj.id,
        'data-dtype': 'object'
      });

      g.appendChild(rect);

      const nameText = el('text', {
        x: obj.x + 5, y: obj.y + 16,
        fill: '#fff', class: 'object-text', 'font-weight': 'bold'
      });
      nameText.textContent = obj.name.length > 16 ? obj.name.slice(0, 14) + '..' : obj.name;
      g.appendChild(nameText);

      const childCount = App.DataStore.getChildren(obj.id).length;
      const itemCount = App.DataStore.getObjectTotalItems(obj.id);
      const infoText = el('text', {
        x: obj.x + 5, y: obj.y + 30,
        fill: 'rgba(255,255,255,0.7)', class: 'object-text', 'font-size': '10'
      });
      const parts = [];
      if (childCount > 0) parts.push(`${childCount} влож.`);
      parts.push(`${itemCount} вещей`);
      infoText.textContent = parts.join(' · ');
      g.appendChild(infoText);

      _planContent.appendChild(g);
    });

    // Resize handles on selected element (outside plan-content, not scaled)
    const selObjId = App.PanelManager.getSelectedObjectId();
    const selRoomId = App.PanelManager.getSelectedRoomId();
    if (selObjId) {
      const obj = App.DataStore.getObject(selObjId);
      if (obj && !obj.parentId) _drawHandles(obj, selObjId, 'object');
    } else if (selRoomId) {
      const room = data.rooms.find(r => r.id === selRoomId);
      if (room) _drawHandles(room, selRoomId, 'room');
    }

    // Overlay layers
    try { App.Ruler.render(); } catch (e) { /* */ }
    try { App.GuideManager.render(); } catch (e) { /* */ }
  }

  function _drawHandles(target, id, type) {
    const { createSvgElement: el } = App.utils;
    const { x, y, w, h } = target;
    const z = App.getZoom();
    const s = 8;
    const hh = s / 2;
    const cursors = {
      nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize',
      e: 'e-resize', se: 'se-resize', s: 's-resize',
      sw: 'sw-resize', w: 'w-resize'
    };

    const pts = [
      { n: 'nw', cx: (x - hh) * z, cy: (y - hh) * z },
      { n: 'n',  cx: (x + w/2 - hh) * z, cy: (y - hh) * z },
      { n: 'ne', cx: (x + w - hh) * z, cy: (y - hh) * z },
      { n: 'e',  cx: (x + w - hh) * z, cy: (y + h/2 - hh) * z },
      { n: 'se', cx: (x + w - hh) * z, cy: (y + h - hh) * z },
      { n: 's',  cx: (x + w/2 - hh) * z, cy: (y + h - hh) * z },
      { n: 'sw', cx: (x - hh) * z, cy: (y + h - hh) * z },
      { n: 'w',  cx: (x - hh) * z, cy: (y + h/2 - hh) * z },
    ];

    pts.forEach(p => {
      const handle = el('rect', {
        x: p.cx, y: p.cy, width: s, height: s,
        fill: '#fff', stroke: '#e94560', 'stroke-width': 2, rx: 1, ry: 1,
        'data-resize': p.n,
        'data-resize-target': id,
        'data-resize-type': type,
        style: 'cursor:' + cursors[p.n]
      });
      _handlesGroup.appendChild(handle);
    });
  }

  return {
    init(svgElement) {
      _svg = svgElement;

      _planContent = App.utils.createSvgElement('g', { class: 'plan-content' });
      _svg.appendChild(_planContent);

      _handlesGroup = App.utils.createSvgElement('g', { class: 'resize-layer' });
      _svg.appendChild(_handlesGroup);

      App.EventBus.on('data:changed', () => {
        _searchMatchIds.clear();
        _render();
      });

      App.EventBus.on('search:results', ({ results }) => {
        _searchMatchIds.clear();
        if (results && results.length > 0) {
          results.forEach(r => {
            const root = App.DataStore.getRootAncestor(r.object.id);
            if (root) _searchMatchIds.add(root.id);
          });
        }
        _render();
      });

      App.EventBus.on('search:clear', () => {
        _searchMatchIds.clear();
        _render();
      });

      App.EventBus.on('drag:moving', _render);
    },

    render() { _render(); },

    setZoomGroup(g) { _zoomGroup = g; },
    setZoom(z) {
      if (_zoomGroup) _zoomGroup.setAttribute('transform', `scale(${z})`);
    },

    highlightObjects(ids) {
      _searchMatchIds = new Set(ids);
      _render();
    }
  };
})();
