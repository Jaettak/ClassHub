// 기존 동기 get/set 인터페이스와 계정별 로컬 저장소.
const Store = (() => {
  const DB = 'classhub-db', LS = 'classhub:';
  let db, legacy = {}, cache = {}, account = null, listener = null;
  const clone = (v) => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  const req = (r) => new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  const done = (tx) => new Promise((ok, no) => { tx.oncomplete = ok; tx.onerror = () => no(tx.error); tx.onabort = () => no(tx.error); });
  const kvName = () => account ? 'accountKv' : 'kv';
  const imgName = () => account ? 'accountImg' : 'img';
  const keyFor = (key) => account ? account + ':' + key : key;
  const lsPrefix = (image = false) => LS + (account ? (image ? 'accountImg:' : 'account:') + account + ':' : image ? 'img:' : 'kv:');
  function open() {
    return new Promise((ok, no) => {
      if (!window.indexedDB) return no(new Error('no idb'));
      const r = indexedDB.open(DB, 2);
      r.onupgradeneeded = () => { for (const n of ['kv', 'img', 'accountKv', 'accountImg']) if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n); };
      r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); r.onblocked = () => no(new Error('blocked'));
    });
  }
  async function readAll(name, prefix = '') {
    const out = {};
    await new Promise((ok, no) => {
      const r = db.transaction(name).objectStore(name).openCursor();
      r.onsuccess = () => { const c = r.result; if (!c) return ok(); if (String(c.key).startsWith(prefix)) out[String(c.key).slice(prefix.length)] = c.value; c.continue(); };
      r.onerror = () => no(r.error);
    });
    return out;
  }
  function readLS(prefix) {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(prefix)) try { out[k.slice(prefix.length)] = JSON.parse(localStorage.getItem(k)); } catch (_) {} }
    return out;
  }
  function write(key, value) {
    if (db) { const tx = db.transaction(kvName(), 'readwrite'); tx.objectStore(kvName()).put(clone(value), keyFor(key)); done(tx).catch(() => App.toast('로컬 저장에 실패했어요.')); }
    else try { localStorage.setItem(lsPrefix() + key, JSON.stringify(value)); } catch (_) { App.toast('로컬 저장에 실패했어요.'); }
  }
  async function images() { return db ? readAll(imgName(), account ? account + ':' : '') : readLS(lsPrefix(true)); }
  async function replaceImages(data) {
    if (db) {
      const prefix = account ? account + ':' : '', old = await readAll(imgName(), prefix);
      const tx = db.transaction(imgName(), 'readwrite'), os = tx.objectStore(imgName());
      for (const k of Object.keys(old)) os.delete(prefix + k);
      for (const [k, v] of Object.entries(data)) os.put(v, prefix + k);
      await done(tx);
    } else { const prefix = lsPrefix(true); for (const k of Object.keys(readLS(prefix))) localStorage.removeItem(prefix + k); for (const [k, v] of Object.entries(data)) localStorage.setItem(prefix + k, JSON.stringify(v)); }
  }
  async function replace(data, notify) {
    const before = cache; cache = clone(data);
    if (db) {
      const prefix = account ? account + ':' : '';
      const old = await readAll(kvName(), prefix);
      const tx = db.transaction(kvName(), 'readwrite'), os = tx.objectStore(kvName());
      for (const k of Object.keys(old)) os.delete(prefix + k);
      for (const [k, v] of Object.entries(cache)) os.put(clone(v), prefix + k);
      await done(tx);
    } else { const prefix = lsPrefix(); for (const k of Object.keys(readLS(prefix))) localStorage.removeItem(prefix + k); for (const [k, v] of Object.entries(cache)) localStorage.setItem(prefix + k, JSON.stringify(v)); }
    if (!account) legacy = clone(cache);
    if (notify && listener) for (const k of new Set([...Object.keys(before), ...Object.keys(cache)])) if (JSON.stringify(before[k]) !== JSON.stringify(cache[k])) listener(k, clone(before[k]), clone(cache[k]));
  }
  return {
    async init() { try { db = await open(); legacy = await readAll('kv'); } catch (_) { db = null; try { legacy = readLS(LS + 'kv:'); } catch (_) {} } cache = clone(legacy); },
    get(key, def) { return clone(cache[key] === undefined ? def : cache[key]); },
    set(key, value) { const before = clone(cache[key]); cache[key] = clone(value); write(key, value); if (!account) legacy[key] = clone(value); if (account && listener) listener(key, before, clone(value)); },
    legacyData() { return clone(legacy); },
    hasLegacyData() { return Object.keys(legacy).length > 0; },
    async useAccount(uid) { account = uid; cache = db ? await readAll('accountKv', uid + ':') : readLS(lsPrefix()); },
    leaveAccount() { account = null; cache = {}; listener = null; },
    accountId() { return account; },
    async clearAccountTextCache() {
      if (!account) return;
      const keep = cache.captures;
      await replace(keep === undefined ? {} : { captures: keep }, false);
    },
    observe(fn) { listener = fn; },
    applyRemote(key, value) {
      if (!account) return;
      if (value === undefined) {
        delete cache[key];
        if (db) { const tx = db.transaction(kvName(), 'readwrite'); tx.objectStore(kvName()).delete(keyFor(key)); }
        else localStorage.removeItem(lsPrefix() + key);
      } else { cache[key] = clone(value); write(key, value); }
    },
    async putImg(id, value) { if (db) { const tx = db.transaction(imgName(), 'readwrite'); tx.objectStore(imgName()).put(value, keyFor(id)); await done(tx); } else localStorage.setItem(lsPrefix(true) + id, JSON.stringify(value)); },
    async getImg(id) { if (db) return (await req(db.transaction(imgName()).objectStore(imgName()).get(keyFor(id)))) || null; try { return JSON.parse(localStorage.getItem(lsPrefix(true) + id)); } catch (_) { return null; } },
    async delImg(id) { if (db) { const tx = db.transaction(imgName(), 'readwrite'); tx.objectStore(imgName()).delete(keyFor(id)); await done(tx); } else localStorage.removeItem(lsPrefix(true) + id); },
    async exportAll() { return { app: 'ClassHub', version: 1, exportedAt: new Date().toISOString(), kv: clone(cache), img: await images() }; },
    async importAll(data) { if (!data || data.app !== 'ClassHub' || !data.kv || typeof data.kv !== 'object' || Array.isArray(data.kv)) throw new Error('ClassHub 백업 파일이 아니에요.'); await replace(data.kv, true); await replaceImages(data.img || {}); },
    async copyLegacyImages() { if (!account) throw new Error('로그인해 주세요.'); const uid = account; account = null; const oldImages = await images(); account = uid; await replaceImages({ ...oldImages, ...(await images()) }); },
  };
})();
