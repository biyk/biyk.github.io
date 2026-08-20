window.App = window.App || {};

App.GoogleDrive = (() => {
  const API_KEY = decodeURIComponent(escape(atob('QUl6YVN5QlRUcUJfclNmd3p1VElkRjFnY1E1LVVfX2ZHenJRX3pz')));
  const CLIENT_ID = '21469279904-9vlmm4i93mg88h6qb4ocd2vvs612ai4u.apps.googleusercontent.com';
  const SCOPES = 'https://www.googleapis.com/auth/drive.file';
  const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
  const FILE_NAME = 'imDoraPlan.json';

  let _gapiInited = false;
  let _gisInited = false;
  let _tokenClient = null;

  function _loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.defer = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function _loadScriptOnce(src) {
    const existing = Array.from(document.querySelectorAll('script')).find(s => s.src === src);
    if (existing) return Promise.resolve();
    return _loadScript(src);
  }

  function _gapiLoaded() {
    gapi.load('client', async () => {
      await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [DISCOVERY_DOC],
      });
      const stored = localStorage.getItem('gapi_token');
      if (stored) {
        try { gapi.client.setToken(JSON.parse(stored)); } catch (e) {}
      }
      _gapiInited = true;
      App.EventBus.emit('gdrive:ready');
    });
  }

  function _gisLoaded() {
    _tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: () => {},
    });
    _gisInited = true;
    App.EventBus.emit('gdrive:ready');
  }

  function _waitReady(timeout) {
    timeout = timeout || 10000;
    const t0 = Date.now();
    return new Promise((resolve, reject) => {
      (function check() {
        if (_gapiInited && _gisInited) return resolve();
        if (Date.now() - t0 > timeout) return reject(new Error('Google API init timeout'));
        setTimeout(check, 100);
      })();
    });
  }

  function _prom(gapiCall, argObj) {
    return new Promise((resolve, reject) => {
      gapiCall(argObj).then(resp => {
        if (resp && (resp.status < 200 || resp.status > 299)) reject(resp);
        else resolve(resp);
      }, err => reject(err));
    });
  }

  return {
    init() {
      _loadScriptOnce('https://apis.google.com/js/api.js').then(() => _gapiLoaded());
      _loadScriptOnce('https://accounts.google.com/gsi/client').then(() => _gisLoaded());
    },

    isReady() { return _gapiInited && _gisInited; },

    isAuthorized() {
      if (this.expired()) {
        localStorage.removeItem('gapi_token');
        localStorage.removeItem('gapi_token_expires');
        gapi.client.setToken('');
        return false;
      }
      return !!gapi.client.getToken();
    },

    expired() {
      const exp = parseInt(localStorage.getItem('gapi_token_expires') || '0');
      const now = Math.floor(Date.now() / 1000);
      return exp - now < 10;
    },

    auth(callback) {
      return _waitReady().then(() => {
        return new Promise((resolve, reject) => {
          _tokenClient.callback = (resp) => {
            if (resp.error !== undefined) { reject(resp); return; }
            const token = gapi.client.getToken();
            localStorage.setItem('gapi_token', JSON.stringify(token));
            localStorage.setItem('gapi_token_expires', JSON.stringify(Math.floor(Date.now() / 1000) + resp.expires_in));
            if (callback) callback();
            resolve();
          };
          if (gapi.client.getToken() === null) {
            _tokenClient.requestAccessToken({ prompt: 'consent' });
          } else {
            _tokenClient.requestAccessToken({ prompt: '' });
          }
        });
      });
    },

    signout() {
      const token = gapi.client.getToken();
      if (token) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
      }
      localStorage.removeItem('gapi_token');
      localStorage.removeItem('gapi_token_expires');
    },

    async _findFile(name) {
      const resp = await _prom(gapi.client.drive.files.list, {
        spaces: 'appDataFolder',
        fields: 'files(id, name)',
        pageSize: 10,
        q: `name = '${name.replace(/'/g, "\\'")}' and trashed = false`,
      });
      return resp.result.files || [];
    },

    async upload(fileName, content) {
      await _waitReady();
      const files = await this._findFile(fileName);
      const body = typeof content === 'string' ? content : JSON.stringify(content);

      if (files.length > 0) {
        await _prom(gapi.client.request, {
          path: `/upload/drive/v3/files/${files[0].id}`,
          method: 'PATCH',
          params: { uploadType: 'media' },
          body: body,
        });
        return files[0].id;
      } else {
        const metadata = { name: fileName, parents: ['appDataFolder'] };
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([body], { type: 'application/json' }));
        const resp = await _prom(gapi.client.request, {
          path: '/upload/drive/v3/files',
          method: 'POST',
          params: { uploadType: 'multipart' },
          headers: {},
          body: form,
        });
        return resp.result.id;
      }
    },

    async download(fileName) {
      await _waitReady();
      const files = await this._findFile(fileName);
      if (files.length === 0) throw new Error('Файл не найден: ' + fileName);
      const resp = await _prom(gapi.client.drive.files.get, {
        fileId: files[0].id,
        alt: 'media',
      });
      return resp.result || resp.body;
    },
  };
})();
