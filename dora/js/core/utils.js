window.App = window.App || {};

App.utils = (() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function generateId(prefix = 'id') {
    const buf = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    return `${prefix}_${buf}`;
  }

  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  function roundTo(val, step) {
    return Math.round(val / step) * step;
  }

  function isNear(a, b, threshold = 8) {
    return Math.abs(a - b) <= threshold;
  }

  function createSvgElement(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }

  function svgPointFromEvent(svg, e) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function throttle(fn, delay) {
    let last = 0;
    return (...args) => {
      const now = Date.now();
      if (now - last >= delay) { last = now; fn(...args); }
    };
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(str));
    return d.innerHTML;
  }

  const COLORS = ['#4a90d9', '#e94560', '#4fc3f7', '#66bb6a', '#ffa726', '#ab47bc', '#ef5350', '#26c6da', '#8d6e63', '#78909c'];
  let _colorIdx = 0;
  function nextColor() { const c = COLORS[_colorIdx % COLORS.length]; _colorIdx++; return c; }

  return { generateId, clamp, roundTo, isNear, createSvgElement, svgPointFromEvent, deepClone, throttle, escapeHtml, nextColor, COLORS };
})();
