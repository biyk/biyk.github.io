export class WebStorage {
    constructor(dbName = 'WebStorageDB', storeName = 'keyval') {
        this.dbName = dbName;
        this.storeName = storeName;
        this.metaStoreName = 'meta';
        this.version = window.version || '';
        this.dbPromise = this.initDB();
    }

    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
                if (!db.objectStoreNames.contains(this.metaStoreName)) {
                    db.createObjectStore(this.metaStoreName);
                }
            };

            request.onsuccess = async () => {
                const db = request.result;

                try {
                    const storedVersion = await this.getMeta('app_version', db);

                    if (storedVersion !== this.version) {
                        await this.clearAllStores(db);
                        await this.setMeta('app_version', this.version, db);
                    }

                    resolve(db);
                } catch (error) {
                    reject(error);
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    async clearAllStores(db) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction([this.storeName], 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getMeta(key, db) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.metaStoreName, 'readonly');
            const store = tx.objectStore(this.metaStoreName);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result ?? null);
            request.onerror = () => reject(request.error);
        });
    }

    async setMeta(key, value, db) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.metaStoreName, 'readwrite');
            const store = tx.objectStore(this.metaStoreName);
            const request = store.put(value, key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Остальные методы без изменений
    async setItem(key, value) {
        const db = await this.dbPromise;
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.put(value, key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getItem(key) {
        const db = await this.dbPromise;
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result ?? null);
            request.onerror = () => reject(request.error);
        });
    }

    async removeItem(key) {
        const db = await this.dbPromise;
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clear() {
        const db = await this.dbPromise;
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Вспомогательный метод: получить все ключи (если нужно)
    async keys() {
        const db = await this.dbPromise;
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const keys = [];
            const request = store.openCursor();
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    keys.push(cursor.key);
                    cursor.continue();
                } else {
                    resolve(keys);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }
}
