window.App = window.App || {};

App.SearchManager = (() => {
  let _inputEl = null;
  let _lastQuery = '';

  function _findMatches(query) {
    const q = query.toLowerCase().trim();
    if (!q) return [];

    const results = [];
    App.DataStore.getObjects().forEach(obj => {
      const matchedItems = (obj.items || []).filter(item => item.toLowerCase().includes(q));
      const nameMatch = obj.name.toLowerCase().includes(q);
      if (nameMatch || matchedItems.length > 0) {
        results.push({ object: obj, matchedItems, nameMatch });
      }
    });
    return results;
  }

  function _performSearch(query) {
    _lastQuery = query;
    App.EventBus.emit('search:before', query);

    if (!query.trim()) {
      App.EventBus.emit('search:results', { query, results: [] });
      App.EventBus.emit('search:clear');
      return;
    }

    const results = _findMatches(query);
    App.EventBus.emit('search:results', { query, results });

    if (results.length > 0) {
      App.EventBus.emit('search:select', results[0].object.id);
    }
  }

  return {
    init(inputSelector) {
      _inputEl = document.querySelector(inputSelector);
      if (!_inputEl) return;

      _inputEl.addEventListener('input', App.utils.throttle((e) => {
        _performSearch(e.target.value);
      }, 150));

      _inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { this.clear(); if (_inputEl) _inputEl.blur(); }
      });
    },

    getQuery() { return _lastQuery; },
    clear() {
      _lastQuery = '';
      if (_inputEl) _inputEl.value = '';
      App.EventBus.emit('search:clear');
    },

    performSearch(query) { _performSearch(query); },
    findMatches(query) { return _findMatches(query); }
  };
})();
