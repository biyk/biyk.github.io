window.App = window.App || {};

App.ExportImport = (() => {
  function _download(filename, content, mimeType = 'application/json') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return {
    exportData() {
      const json = App.DataStore.exportData();
      const ts = new Date().toISOString().slice(0, 10);
      _download(`apartment-plan-${ts}.json`, json);
    },

    importData(file) {
      return new Promise((resolve) => {
        if (!file) return resolve({ ok: false, error: 'Файл не выбран' });
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = App.DataStore.importData(e.target.result);
          resolve(result);
        };
        reader.onerror = () => resolve({ ok: false, error: 'Ошибка чтения файла' });
        reader.readAsText(file);
      });
    }
  };
})();
