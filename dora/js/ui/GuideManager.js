window.App = window.App || {};

App.GuideManager = (() => {
  const RULER_ZONE = 40;
  const HIT_WIDTH = 14;
  const W = 5000;
  const H = 3500;

  let _svg = null;
  let _g = null;
  let _dragState = null;
  let _selectedGuideId = null;
  let _pendingGuideOrientation = null;

  function _render() {
    if (!_svg || !_g) return;
    _g.innerHTML = '';
    const guides = App.DataStore.getGuides();
    const { createSvgElement: el } = App.utils;

    guides.forEach(g => {
      const isH = g.orientation === 'horizontal';
      const color = isH ? '#ff6b6b' : '#4fc3f7';

      // Invisible wide line for hit detection
      const hitLine = el('line', {
        x1: isH ? 0 : g.position, y1: isH ? g.position : 0,
        x2: isH ? W : g.position, y2: isH ? g.position : H,
        stroke: 'transparent', 'stroke-width': String(HIT_WIDTH),
        'pointer-events': 'stroke',
        cursor: isH ? 'ns-resize' : 'ew-resize'
      });
      hitLine.addEventListener('mousedown', (e) => _onDragStart(e, g.id));
      _g.appendChild(hitLine);

      // Visible thin line on top
      const visLine = el('line', {
        x1: isH ? 0 : g.position, y1: isH ? g.position : 0,
        x2: isH ? W : g.position, y2: isH ? g.position : H,
        stroke: color, 'stroke-width': '1.5', 'stroke-dasharray': '6,4',
        'stroke-opacity': _selectedGuideId === g.id ? '1' : '0.85',
        'vector-effect': 'non-scaling-stroke',
        'pointer-events': 'none'
      });
      _g.appendChild(visLine);

      if (_selectedGuideId === g.id) {
        const cx = isH ? 50 : g.position;
        const cy = isH ? g.position : 50;
        const circle = el('circle', { cx, cy, r: 8, fill: color, opacity: '0.6', cursor: 'pointer' });
        circle.addEventListener('click', () => _removeGuide(g.id));
        _g.appendChild(circle);
      }
    });
  }

  function _onDragStart(e, guideId) {
    e.stopPropagation();
    _selectedGuideId = guideId;
    _render();

    const guide = App.DataStore.getGuides().find(g => g.id === guideId);
    if (!guide) return;

    _dragState = { id: guideId, orientation: guide.orientation };

    const onMove = (ev) => {
      if (!_dragState) return;
      ev.preventDefault();
      const p = App.utils.svgPointFromEvent(_svg, ev);
      const zoom = App.getZoom();
      const isH = _dragState.orientation === 'horizontal';
      const limit = isH ? H : W;
      const newPos = isH
        ? App.utils.clamp(Math.round(p.y / zoom), 0, limit)
        : App.utils.clamp(Math.round(p.x / zoom), 0, limit);

      if (newPos <= RULER_ZONE) {
        _removeGuide(_dragState.id);
        _dragState = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        return;
      }

      App.DataStore.updateGuide(_dragState.id, newPos);
      _render();
    };

    const onUp = () => {
      _dragState = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function _removeGuide(id) {
    App.DataStore.removeGuide(id);
    if (_selectedGuideId === id) _selectedGuideId = null;
    _render();
  }

  function _addGuideDefault(orientation) {
    _pendingGuideOrientation = orientation;
    document.getElementById('plan').style.cursor = orientation === 'horizontal' ? 'ns-resize' : 'ew-resize';
  }

  function _handleCanvasClick(e) {
    if (!_pendingGuideOrientation) return;
    if (e.target.closest('[data-draggable]') || e.target.closest('.resize-layer')) return;
    const svg = document.getElementById('plan');
    const p = App.utils.svgPointFromEvent(svg, e);
    const zoom = App.getZoom();
    let pos;
    if (_pendingGuideOrientation === 'horizontal') {
      pos = Math.round(p.y / zoom);
    } else {
      pos = Math.round(p.x / zoom);
    }
    const limit = _pendingGuideOrientation === 'horizontal' ? H : W;
    pos = App.utils.clamp(pos, 0, limit);
    const entry = App.DataStore.addGuide(_pendingGuideOrientation, pos);
    _pendingGuideOrientation = null;
    svg.style.cursor = '';
    _render();
  }

  function _onKeyDown(e) {
    if (e.key === 'Escape' && _pendingGuideOrientation) {
      _pendingGuideOrientation = null;
      const svg = document.getElementById('plan');
      if (svg) svg.style.cursor = '';
    }
  }

  return {
    init(svg) {
      _svg = svg;
      _g = App.utils.createSvgElement('g', { class: 'guide-layer' });
      _svg.appendChild(_g);
      App.EventBus.on('guide:added', _render);
      App.EventBus.on('guide:removed', _render);
      App.EventBus.on('guide:updated', _render);
      App.EventBus.on('data:changed', _render);
      _svg.addEventListener('click', _handleCanvasClick);
      document.addEventListener('keydown', _onKeyDown);
    },
    render() { _render(); },
    addHorizontal() { _addGuideDefault('horizontal'); },
    addVertical() { _addGuideDefault('vertical'); },
    clearSelection() { _selectedGuideId = null; _render(); },
    clearAll() {
      App.DataStore.clearAllGuides();
      _selectedGuideId = null;
      _render();
    },
    cancelPending() {
      _pendingGuideOrientation = null;
      const svg = document.getElementById('plan');
      if (svg) svg.style.cursor = '';
    },
    getSnapPositions() {
      const positions = { x: [], y: [] };
      App.DataStore.getGuides().forEach(g => {
        if (g.orientation === 'horizontal') positions.y.push(g.position);
        else positions.x.push(g.position);
      });
      return positions;
    }
  };
})();
