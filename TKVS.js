// Tiny Key Value Store
// TKVS
function TKVS(dbName, storeName) {

    const promisifyRequest = (request) => {
        return new Promise((resolve, reject) => {
            request.oncomplete = request.onsuccess = () => resolve(request.result);
            request.onabort = request.onerror = () => reject(request.error);
        });
    }

    const request = indexedDB.open(dbName);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    const dbp = promisifyRequest(request);
    const commit = (txMode, callback) => dbp.then((db) => callback(db.transaction(storeName, txMode).objectStore(storeName)));

    // read
         this.get =  (_key) => commit('readonly', (store) => promisifyRequest(store.get(_key)) );
     this.getMany = (_keys) => commit('readonly', (store) => Promise.all(_keys.map((k) => promisifyRequest(store.get(k)))) );
        this.keys =      () => commit('readonly', (store) => promisifyRequest(store.getAllKeys()) );
      this.values =      () => { return this.keys().then(this.getMany);};

    // write
        this.set = (_key,_value) => commit('readwrite', (store) => promisifyRequest(store.put(_value, _key)));
        this.del =        (_key) => commit('readwrite', (store) => promisifyRequest(store.delete(_key)) );
      this.clear =            () => commit('readwrite', (store) => promisifyRequest(store.clear()) );
}
