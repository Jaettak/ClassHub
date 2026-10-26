// 브라우저 저장소(IndexedDB). 실패하면 localStorage로 대체한다.
const Store = (() => {
  const DB_NAME = 'classhub-db';
  const LS = 'classhub:';
  let db = null;
  let cache = {};

  function open() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('no idb'));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('kv');
        req.result.createObjectStore('img');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('blocked'));
    });
  }

  const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const txDone = (tx) => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });

  async function readAll(storeName) {
    const out = {};
    await new Promise((resolve, reject) => {
      const r = db.transaction(storeName).objectStore(storeName).openCursor();
      r.onsuccess = () => {
        const c = r.result;
        if (c) { out[c.key] = c.value; c.continue(); } else resolve();
      };
      r.onerror = () => reject(r.error);
    });
    return out;
  }

  function lsRead() {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith(LS + 'kv:')) {
        try { out[k.slice(LS.length + 3)] = JSON.parse(localStorage.getItem(k)); } catch (e) { /* 무시 */ }
      }
    }
    return out;
  }

  return {
    async init() {
      try {
        db = await open();
        cache = await readAll('kv');
      } catch (e) {
        db = null;
        try { cache = lsRead(); } catch (e2) { cache = {}; }
      }
    },
    get(key, def) {
      return cache[key] === undefined ? def : cache[key];
    },
    set(key, value) {
      cache[key] = value;
      if (db) {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(value, key);
        txDone(tx).catch(() => App.toast('저장에 실패했어요. 저장 공간을 확인해 주세요.'));
      } else {
        try { localStorage.setItem(LS + 'kv:' + key, JSON.stringify(value)); } catch (e) { App.toast('저장에 실패했어요.'); }
      }
    },
    async putImg(id, obj) {
      if (db) {
        const tx = db.transaction('img', 'readwrite');
        tx.objectStore('img').put(obj, id);
        await txDone(tx);
      } else {
        localStorage.setItem(LS + 'img:' + id, JSON.stringify(obj));
      }
    },
    async getImg(id) {
      if (db) return (await reqP(db.transaction('img').objectStore('img').get(id))) || null;
      try { return JSON.parse(localStorage.getItem(LS + 'img:' + id)); } catch (e) { return null; }
    },
    async delImg(id) {
      if (db) {
        const tx = db.transaction('img', 'readwrite');
        tx.objectStore('img').delete(id);
        await txDone(tx);
      } else {
        localStorage.removeItem(LS + 'img:' + id);
      }
    },
    async exportAll() {
      let img = {};
      if (db) img = await readAll('img');
      else {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k.startsWith(LS + 'img:')) img[k.slice(LS.length + 4)] = JSON.parse(localStorage.getItem(k));
        }
      }
      return { app: 'ClassHub', version: 1, exportedAt: new Date().toISOString(), kv: cache, img };
    },
    async importAll(data) {
      if (!data || data.app !== 'ClassHub' || typeof data.kv !== 'object') throw new Error('ClassHub 백업 파일이 아니에요.');
      const kv = data.kv;
      const img = data.img || {};
      if (db) {
        const tx = db.transaction(['kv', 'img'], 'readwrite');
        tx.objectStore('kv').clear();
        tx.objectStore('img').clear();
        Object.keys(kv).forEach((k) => tx.objectStore('kv').put(kv[k], k));
        Object.keys(img).forEach((k) => tx.objectStore('img').put(img[k], k));
        await txDone(tx);
      } else {
        Object.keys(kv).forEach((k) => localStorage.setItem(LS + 'kv:' + k, JSON.stringify(kv[k])));
        Object.keys(img).forEach((k) => localStorage.setItem(LS + 'img:' + k, JSON.stringify(img[k])));
      }
      cache = kv;
    },
  };
})();
