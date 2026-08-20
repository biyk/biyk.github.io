window.App = window.App || {};

App.EventBus = (() => {
  const _listeners = {};
  let _idCounter = 0;

  const _ensure = (event) => {
    if (!_listeners[event]) _listeners[event] = new Map();
  };

  return {
    on(event, callback) {
      if (typeof callback !== 'function') return () => {};
      _ensure(event);
      const id = ++_idCounter;
      _listeners[event].set(id, callback);
      return () => _listeners[event].delete(id);
    },

    once(event, callback) {
      const wrapper = (data) => {
        callback(data);
        this.off(event, wrapper);
      };
      return this.on(event, wrapper);
    },

    off(event, callback) {
      if (!_listeners[event]) return;
      if (callback) {
        for (const [id, fn] of _listeners[event]) {
          if (fn === callback) { _listeners[event].delete(id); break; }
        }
      } else {
        delete _listeners[event];
      }
    },

    emit(event, data) {
      if (!_listeners[event]) return;
      for (const fn of _listeners[event].values()) {
        try { fn(data); } catch (e) { console.warn(`[EventBus] ${event}:`, e); }
      }
    },

    clear() {
      Object.keys(_listeners).forEach(k => delete _listeners[k]);
    }
  };
})();
