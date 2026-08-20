window.App = window.App || {};

App.Ruler = (() => {
  const RULER_SIZE = 40;
  const MINOR_HEIGHT = 6;
  const MAJOR_HEIGHT = 14;
  const W = 5000;
  const H = 3500;

  let _svg = null;
  let _g = null;
  let _enabled = true;

  function _metersLabel(meters) {
    if (meters === 0) return '0';
    return meters % 1 === 0 ? `${meters}m` : `${meters.toFixed(1)}`;
  }

  function _draw() {
    if (!_svg || !_g) return;
    _g.innerHTML = '';
    if (!_enabled) return;

    const { createSvgElement: el } = App.utils;
    const pxPerMeter = App.DataStore.getScale();
    const majorStep = pxPerMeter;
    const minorStep = pxPerMeter / 10;

    // Background
    _g.appendChild(el('rect', { x: 0, y: 0, width: RULER_SIZE, height: RULER_SIZE, fill: '#1e2a3a', stroke: '#2a3a4a', 'stroke-width': '1', 'vector-effect': 'non-scaling-stroke' }));
    _g.appendChild(el('rect', { x: RULER_SIZE, y: 0, width: W - RULER_SIZE, height: RULER_SIZE, fill: '#1e2a3a', stroke: '#2a3a4a', 'stroke-width': '1', 'vector-effect': 'non-scaling-stroke' }));
    _g.appendChild(el('rect', { x: 0, y: RULER_SIZE, width: RULER_SIZE, height: H - RULER_SIZE, fill: '#1e2a3a', stroke: '#2a3a4a', 'stroke-width': '1', 'vector-effect': 'non-scaling-stroke' }));

    // Corner label
    const label = el('text', { x: RULER_SIZE / 2, y: RULER_SIZE / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#667', 'font-size': '11', 'font-family': 'sans-serif' });
    label.textContent = 'm';
    _g.appendChild(label);

    // Horizontal ruler
    for (let px = 0; px <= W - RULER_SIZE; px += minorStep) {
      const x = RULER_SIZE + px;
      const isMajor = Math.abs(px % majorStep) < 0.01 || Math.abs(px % majorStep - majorStep) < 0.01;
      const tick = el('line', { x1: x, y1: 0, x2: x, y2: isMajor ? MAJOR_HEIGHT : MINOR_HEIGHT, stroke: isMajor ? '#8899aa' : '#445566', 'stroke-width': isMajor ? '1.5' : '0.8', 'vector-effect': 'non-scaling-stroke' });
      _g.appendChild(tick);
      if (isMajor) {
        const txt = el('text', { x, y: RULER_SIZE - 2, 'text-anchor': 'middle', fill: '#8899aa', 'font-size': '10', 'font-family': 'sans-serif' });
        txt.textContent = _metersLabel(px / pxPerMeter);
        _g.appendChild(txt);
      }
    }

    // Vertical ruler
    for (let px = 0; px <= H - RULER_SIZE; px += minorStep) {
      const y = RULER_SIZE + px;
      const isMajor = Math.abs(px % majorStep) < 0.01 || Math.abs(px % majorStep - majorStep) < 0.01;
      const tick = el('line', { x1: 0, y1: y, x2: isMajor ? MAJOR_HEIGHT : MINOR_HEIGHT, y2: y, stroke: isMajor ? '#8899aa' : '#445566', 'stroke-width': isMajor ? '1.5' : '0.8', 'vector-effect': 'non-scaling-stroke' });
      _g.appendChild(tick);
      if (isMajor) {
        const txt = el('text', { x: RULER_SIZE - 2, y, 'text-anchor': 'end', 'dominant-baseline': 'central', fill: '#8899aa', 'font-size': '10', 'font-family': 'sans-serif' });
        txt.textContent = _metersLabel(px / pxPerMeter);
        _g.appendChild(txt);
      }
    }
  }

  return {
    init(svg) {
      _svg = svg;
      _g = App.utils.createSvgElement('g', { class: 'ruler-layer' });
      _svg.appendChild(_g);
      App.EventBus.on('data:changed', _draw);
    },
    render() { _draw(); },
    enable() { _enabled = true; _draw(); },
    disable() { _enabled = false; _draw(); },
    getRulerSize() { return RULER_SIZE; }
  };
})();
