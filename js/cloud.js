// Firebase 인증 및 레코드 단위 Firestore 동기화. PDF 캡처와 이미지는 로컬 전용.
const Cloud = (() => {
  const ARRAY_KEYS = new Set(['events', 'activities', 'grades', 'notes', 'ttFriends', 'timerLog']);
  const MAP_KEYS = new Set(['lessonDayNotes', 'subjectColors']);
  const LOCAL_KEYS = new Set(['captures']);
  const keys = ['timetable', 'ttFriends', 'subjectColors', 'events', 'lessonDayNotes', 'eventSavedColors', 'activities', 'grades', 'notes', 'settings', 'mealSchool', 'timer', 'timerLog', 'homeSideMode', 'weekLessonsVisible', 'calPieOpen'];
  let auth, firestore, user = null, unsubscribe = null, ready = false, configured = false, syncing = false, remote = {}, queue = [], loaded = false;
  let refreshTimer = null;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const opKey = (key, id) => key + '|' + id;
  const docId = (key, id) => key + '__' + encodeURIComponent(String(id));
  const outboxKey = () => 'classhub:outbox:' + user.uid;
  const arrayId = (key, item, index) => key === 'timerLog' ? String(item.at || index) : String(item.id || index);
  function entries(key, value) {
    if (ARRAY_KEYS.has(key)) return new Map((value || []).map((v, i) => [arrayId(key, v, i), { value: v, order: i }]));
    if (MAP_KEYS.has(key)) return new Map(Object.entries(value || {}).map(([id, v]) => [id, { value: v }]));
    return new Map([['value', { value: value === undefined ? null : value }]]);
  }
  function diff(key, before, after) {
    if (LOCAL_KEYS.has(key) || !keys.includes(key)) return [];
    const a = entries(key, before), b = entries(key, after), out = [];
    for (const [id, value] of b) if (!a.has(id) || !same(a.get(id).value, value.value)) out.push({ key, id, ...value, deleted: false });
    for (const id of a.keys()) if (!b.has(id)) out.push({ key, id, deleted: true });
    return out;
  }
  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      if (ready && !document.body.classList.contains('modal-open')) { Settings.apply(); App.refresh(); }
    }, 120);
  }
  function saveQueue() {
    try { localStorage.setItem(outboxKey(), JSON.stringify(queue)); }
    catch (_) { App.toast('동기화 대기 목록 저장에 실패했어요. 백업을 내려받아 주세요.'); }
  }
  function enqueue(changes) {
    if (!user || !changes.length) return;
    for (const op of changes) {
      const i = queue.findIndex((x) => opKey(x.key, x.id) === opKey(op.key, op.id));
      if (i >= 0) queue.splice(i, 1);
      queue.push({ ...op, token: Date.now() + ':' + Math.random() });
    }
    saveQueue(); flush();
  }
  async function flush() {
    if (syncing || !user || !loaded || !navigator.onLine) return;
    syncing = true;
    while (queue.length && user) {
      const op = queue[0], uid = user.uid;
      try {
        await firestore.collection('users').doc(uid).collection('records').doc(docId(op.key, op.id)).set({
          key: op.key, id: op.id, value: op.deleted ? null : op.value, order: op.order ?? 0,
          deleted: !!op.deleted, updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        if (!user || user.uid !== uid) break;
        if (queue[0]?.token === op.token) queue.shift();
        saveQueue();
      } catch (e) { App.toast('클라우드 저장 대기 중: ' + (e.code || e.message)); break; }
    }
    syncing = false;
  }
  function buildRemote(snapshot) {
    const byKey = {};
    snapshot.forEach((doc) => {
      const d = doc.data();
      if (!keys.includes(d.key) || d.deleted) return;
      (byKey[d.key] ||= []).push(d);
    });
    const result = {};
    for (const key of keys) {
      const list = byKey[key] || [];
      if (ARRAY_KEYS.has(key)) result[key] = list.sort((a, b) => (a.order || 0) - (b.order || 0) || a.id.localeCompare(b.id)).map((d) => d.value);
      else if (MAP_KEYS.has(key)) result[key] = Object.fromEntries(list.map((d) => [d.id, d.value]));
      else if (list.length) result[key] = list[0].value;
    }
    return result;
  }
  function overlay(key, base) {
    const pending = queue.filter((x) => x.key === key);
    if (!pending.length) return base;
    if (ARRAY_KEYS.has(key) || MAP_KEYS.has(key)) {
      const map = entries(key, base);
      for (const op of pending) { if (op.deleted) map.delete(op.id); else map.set(op.id, { value: op.value, order: op.order || 0 }); }
      return ARRAY_KEYS.has(key) ? [...map.entries()].sort((a, b) => (a[1].order || 0) - (b[1].order || 0)).map(([, v]) => v.value) : Object.fromEntries([...map].map(([id, v]) => [id, v.value]));
    }
    return pending[pending.length - 1].value;
  }
  function receive(snapshot) {
    if (!user) return;
    // 웹 SDK의 메모리 캐시가 비어 있어도 계정별 로컬 기록은 보존한다.
    if (snapshot.metadata.fromCache) {
      if (!ready) Timer.init();
      ready = true; scheduleRefresh();
      return;
    }
    remote = buildRemote(snapshot);
    loaded = true;
    for (const key of keys) {
      const value = overlay(key, remote[key]);
      if ((value !== undefined || loaded) && !same(Store.get(key, undefined), value)) Store.applyRemote(key, value);
    }
    if (!ready) Timer.init();
    ready = true; scheduleRefresh(); flush();
  }
  function showGate(message = '') {
    const root = document.getElementById('app'); root.replaceChildren(); root.className = 'auth-gate';
    const email = h('input', { type: 'email', autocomplete: 'email', placeholder: '이메일' });
    const password = h('input', { type: 'password', autocomplete: 'current-password', placeholder: '비밀번호' });
    const status = h('p', { class: 'muted', role: 'status' }, message);
    const run = async (fn) => { status.textContent = '연결 중…'; try { await fn(); } catch (e) { status.textContent = e.message || '로그인에 실패했어요.'; } };
    root.append(h('div', { class: 'auth-card' },
      h('img', { src: 'assets/logo.svg', alt: '' }), h('h1', null, 'ClassHub'),
      h('p', null, '내 기록을 모든 기기에서 이어서 사용해요.'),
      h('button', { class: 'btn primary', type: 'button', onclick: () => run(() => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())) }, 'Google로 로그인'),
      App.field('이메일', email), App.field('비밀번호', password),
      h('div', { class: 'auth-actions' },
        h('button', { class: 'btn primary', type: 'button', onclick: () => run(() => auth.signInWithEmailAndPassword(email.value.trim(), password.value)) }, '로그인'),
        h('button', { class: 'btn', type: 'button', onclick: () => run(() => auth.createUserWithEmailAndPassword(email.value.trim(), password.value)) }, '계정 만들기')),
      status));
  }
  async function signedIn(next) {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    if (user) {
      Timer.suspend();
      if (!queue.length) await Store.clearAccountTextCache();
      Store.leaveAccount(); queue = []; remote = {}; ready = false; loaded = false;
    }
    user = next;
    if (!next) { showGate(); return; }
    showGate('기록을 불러오는 중…');
    await Store.useAccount(next.uid);
    try { queue = JSON.parse(localStorage.getItem(outboxKey()) || '[]'); } catch (_) { queue = []; }
    Store.observe((key, before, after) => enqueue(diff(key, before, after)));
    unsubscribe = firestore.collection('users').doc(next.uid).collection('records').onSnapshot(
      { includeMetadataChanges: true }, (snapshot) => { if (user?.uid === next.uid) receive(snapshot); },
      (e) => showGate('데이터 연결 오류: ' + (e.message || e.code)));
    setTimeout(() => { if (user === next && !ready) { ready = true; App.route(); } }, 7000);
  }
  async function init() {
    const c = window.CLASSHUB_FIREBASE_CONFIG || {};
    configured = !!(c.apiKey && c.authDomain && c.projectId && c.appId);
    if (!configured) return;
    try {
      for (const name of ['firebase-app-compat', 'firebase-auth-compat', 'firebase-firestore-compat']) await new Promise((ok, no) => {
        const script = document.createElement('script'); script.src = 'https://www.gstatic.com/firebasejs/13.1.0/' + name + '.js';
        script.onload = ok; script.onerror = no; document.head.append(script);
      });
    } catch (_) { showGate('Firebase SDK를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.'); return; }
    firebase.initializeApp(c); auth = firebase.auth(); firestore = firebase.firestore();
    auth.onAuthStateChanged((next) => signedIn(next).catch((e) => showGate(e.message)));
    window.addEventListener('online', flush);
  }
  async function migrate() {
    if (!user) return;
    if (!loaded) { App.toast('클라우드 연결 후 다시 시도해 주세요.'); return; }
    const legacy = Store.legacyData();
    if (localStorage.getItem('classhub:migrated:' + user.uid) === '1') { App.toast('이 계정으로 이전 기록을 이미 가져왔어요.'); return; }
    if (!Object.keys(legacy).length) { App.toast('이전할 로컬 기록이 없어요.'); return; }
    if (!confirm('이 브라우저의 기존 기록을 현재 계정에 복사할까요? 클라우드에 이미 있는 같은 항목은 유지합니다. 기존 로컬 기록도 보존합니다.')) return;
    const current = await Store.exportAll();
    const merged = { ...legacy, ...current.kv };
    for (const key of ARRAY_KEYS) {
      const old = legacy[key] || [], now = current.kv[key] || [];
      const ids = new Set(now.map((v, i) => arrayId(key, v, i)));
      merged[key] = now.concat(old.filter((v, i) => !ids.has(arrayId(key, v, i))));
    }
    for (const key of MAP_KEYS) merged[key] = { ...(legacy[key] || {}), ...(current.kv[key] || {}) };
    merged.captures = (current.kv.captures || []).length ? current.kv.captures : (legacy.captures || []);
    await Store.copyLegacyImages();
    for (const [key, value] of Object.entries(merged)) Store.set(key, value);
    localStorage.setItem('classhub:migrated:' + user.uid, '1');
    App.toast('기존 기록을 계정에 복사했어요.'); App.refresh();
  }
  function accountSection() {
    if (!configured || !user) return null;
    return h('section', { class: 'set-sec' }, h('h4', null, '계정과 동기화'),
      h('p', null, user.email || 'Google 계정'),
      h('p', { class: 'muted' }, loaded ? queue.length ? '저장 대기 ' + queue.length + '건' : '클라우드 연결됨' : '오프라인 또는 연결 중'),
      h('p', { class: 'muted' }, 'PDF 오답 이미지는 이 기기에만 저장됩니다.'),
      h('div', { class: 'set-row set-btns' },
        h('button', { class: 'btn', type: 'button', onclick: migrate }, '이 브라우저의 기존 기록 가져오기'),
        h('button', { class: 'btn', type: 'button', onclick: () => auth.signOut() }, '로그아웃')));
  }
  return { init, showGate, accountSection, get configured() { return configured; }, get ready() { return !configured || ready; }, get user() { return user; } };
})();
