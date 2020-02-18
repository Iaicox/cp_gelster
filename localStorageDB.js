(function () {
    var indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
    if (!indexedDB) {
        console.error('indexDB not supported');
        return;
    }
    var db,
        keyValue = {
            k: '',
            v: ''
        },
        request = indexedDB.open('projects', 1);
    
    request.onsuccess = function (evt) {
        db = this.result;
    };
    request.onerror = function (event) {
        console.error('indexedDB request error');
        console.log(event);
    };

    request.onupgradeneeded = function (event) {
        db = null;
        var store = event.target.result.createObjectStore('projects', {
            keyPath: 'k'
        });

        store.transaction.oncomplete = function (e) {
            db = e.target.db;
        };
    };

    function getValue(key, callback) {
        if (!db) {
            setTimeout(function () {
                getValue(key, callback);
            }, 100);
            return;
        }
        db.transaction('projects').objectStore('projects').get(key).onsuccess = function (event) {
            var result = (event.target.result && event.target.result.v) || null;
            callback(result);
        };
    }

    function delKey(key) {
        if (!db) {
            setTimeout(function () {
                delKey(key);
            }, 100);
            return;
        }
        db.transaction("projects", "readwrite").objectStore("projects").delete(key);
    }
    
    window['obj_db'] = {
        get: getValue,
        del: delKey,
        set: function (key, value) {
            keyValue.k = key;
            keyValue.v = value;
            db.transaction('projects', 'readwrite').objectStore('projects').put(keyValue);
        }
    }
})();
