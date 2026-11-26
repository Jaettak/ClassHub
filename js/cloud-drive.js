// Google Drive의 앱 전용 폴더에 이미지 데이터만 저장한다. PDF와 학교 자료 원본은 제외한다.
const CloudDrive = (() => {
  const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
  const API = 'https://www.googleapis.com/drive/v3/files';
  const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
  const PREFIX = 'classhub-media-';
  let uid = null, token = null, files = new Map(), pending = {}, revisions = {}, busy = false, indexed = false;
  const key = (part) => `classhub:drive:${part}:${uid}`;
  const nameFor = (id) => `${PREFIX}${encodeURIComponent(id)}.json`;
  const idFor = (name) => { try { return decodeURIComponent(name.slice(PREFIX.length, -5)); } catch (_) { return ''; } };
  const enabled = () => !!uid && localStorage.getItem(key('enabled')) === '1';
  // school- 접두사는 학교 자료 원본이고, school-floor-만 지도 사진이므로 허용한다.
  // 오답 이미지는 메타데이터보다 먼저 저장될 수 있어 나머지 이미지 키를 허용한다.
  const eligible = (id) => id.startsWith('school-floor-') || !id.startsWith('school-');
  const saveState = () => {
    if (!uid) return;
    localStorage.setItem(key('pending'), JSON.stringify(pending));
    localStorage.setItem(key('revisions'), JSON.stringify(revisions));
  };
  function accountChanged(nextUid) {
    uid = nextUid; token = null; indexed = false; files = new Map(); busy = false;
    try { pending = JSON.parse(localStorage.getItem(key('pending')) || '{}'); } catch (_) { pending = {}; }
    try { revisions = JSON.parse(localStorage.getItem(key('revisions')) || '{}'); } catch (_) { revisions = {}; }
  }
  function disconnect() { uid = null; token = null; indexed = false; files = new Map(); pending = {}; revisions = {}; }
  async function request(url, options = {}) {
    if (!token) throw new Error('Google Drive를 다시 연결해 주세요.');
    const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
    if (response.status === 401) { token = null; throw new Error('Google Drive 연결이 만료됐어요. 다시 연결해 주세요.'); }
    if (!response.ok) {
      let detail = '';
      try { detail = (await response.json()).error?.message || ''; } catch (_) {}
      throw new Error(response.status === 403 ? 'Google Drive API 사용 권한을 확인해 주세요.' : `Drive 오류 ${response.status}${detail ? ': ' + detail : ''}`);
    }
    return response;
  }
  async function listFiles() {
    files = new Map();
    let page = '';
    do {
      const params = new URLSearchParams({ spaces: 'appDataFolder', fields: 'nextPageToken,files(id,name,modifiedTime)', pageSize: '1000' });
      if (page) params.set('pageToken', page);
      const data = await (await request(`${API}?${params}`)).json();
      for (const file of data.files || []) if (file.name?.startsWith(PREFIX) && file.name.endsWith('.json')) files.set(idFor(file.name), file);
      page = data.nextPageToken || '';
    } while (page);
    indexed = true;
  }
  async function upload(id, value) {
    const body = JSON.stringify(value);
    const current = files.get(id);
    let response;
    if (new Blob([body]).size > 4 * 1024 * 1024) {
      const metadata = current ? {} : { name: nameFor(id), parents: ['appDataFolder'], mimeType: 'application/json' };
      const start = await request(`${UPLOAD}${current ? '/' + encodeURIComponent(current.id) : ''}?uploadType=resumable&fields=id,name,modifiedTime`, {
        method: current ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Upload-Content-Type': 'application/json' },
        body: JSON.stringify(metadata),
      });
      const location = start.headers.get('Location');
      if (!location) throw new Error('Drive 업로드 주소를 받지 못했어요.');
      response = await request(location, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body });
    } else if (current) response = await request(`${UPLOAD}/${encodeURIComponent(current.id)}?uploadType=media&fields=id,name,modifiedTime`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body,
    });
    else {
      const boundary = `classhub_${crypto.randomUUID().replace(/-/g, '')}`;
      const blob = new Blob([
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
        JSON.stringify({ name: nameFor(id), parents: ['appDataFolder'], mimeType: 'application/json' }),
        `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n`, body, `\r\n--${boundary}--`,
      ], { type: `multipart/related; boundary=${boundary}` });
      response = await request(`${UPLOAD}?uploadType=multipart&fields=id,name,modifiedTime`, { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob });
    }
    const file = await response.json();
    files.set(id, { ...current, ...file, name: nameFor(id) });
    revisions[id] = file.modifiedTime || new Date().toISOString();
  }
  async function pull(id, local) {
    if (!token || !enabled() || !eligible(id)) return local;
    if (!indexed) await listFiles();
    const file = files.get(id);
    if (!file || pending[id]) return local;
    if (local && revisions[id] && Date.parse(file.modifiedTime) <= Date.parse(revisions[id]) + 1000) return local;
    const value = await (await request(`${API}/${encodeURIComponent(file.id)}?alt=media`)).json();
    if (!value || typeof value !== 'object') return local;
    await Store.putImg(id, value, true);
    revisions[id] = file.modifiedTime || new Date().toISOString(); saveState();
    return value;
  }
  async function read(id, local) {
    if (!token || !enabled()) return local;
    try { return await pull(id, local); }
    catch (error) { if (!local) App.toast(error.message); return local; }
  }
  function changed(id, deleted) {
    if (!enabled() || !eligible(id)) return;
    pending[id] = deleted ? 'delete' : 'upload';
    saveState(); flush();
  }
  async function flush() {
    if (busy || !token || !enabled() || !navigator.onLine) return;
    busy = true;
    try {
      if (!indexed) await listFiles();
      for (const [id, action] of Object.entries(pending)) {
        if (!token || !navigator.onLine) break;
        if (action === 'delete') {
          const file = files.get(id);
          if (file) await request(`${API}/${encodeURIComponent(file.id)}`, { method: 'DELETE' });
          files.delete(id); delete revisions[id];
        } else {
          const value = await Store.getLocalImg(id);
          if (value) await upload(id, value);
        }
        if (pending[id] === action) delete pending[id];
        saveState();
      }
    } catch (error) { App.toast(error.message); }
    finally { busy = false; }
  }
  async function connect() {
    if (!Cloud.user || Cloud.user.uid !== uid) throw new Error('Google 계정으로 먼저 로그인해 주세요.');
    if (typeof location !== 'undefined' && location.protocol === 'file:') throw new Error('로컬 파일 미리보기에서는 Drive를 연결할 수 없어요. 배포된 ClassHub 웹사이트에서 연결해 주세요.');
    let accessToken;
    if (window.Capacitor?.isNativePlatform?.()) {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.addScope(SCOPE);
      const result = await Cloud.user.reauthenticateWithPopup(provider);
      accessToken = firebase.auth.GoogleAuthProvider.credentialFromResult(result)?.accessToken;
    } else {
      const oauth = window.google?.accounts?.oauth2;
      const clientId = window.CLASSHUB_FIREBASE_CONFIG?.googleOAuthClientId;
      if (!oauth || !clientId) throw new Error('Google 연결 기능을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
      // Firebase 리디렉션 핸들러를 거치지 않아 브라우저의 저장소 분리에도 영향을 받지 않는다.
      const response = await new Promise((resolve, reject) => {
        const client = oauth.initTokenClient({
          client_id: clientId,
          scope: `openid ${SCOPE}`,
          login_hint: Cloud.user.providerData.find((item) => item.providerId === 'google.com')?.uid || Cloud.user.email,
          callback: resolve,
          error_callback: () => reject(new Error('Google 연결 창이 닫혔거나 열리지 않았어요.')),
        });
        client.requestAccessToken({ prompt: 'consent' });
      });
      if (response.error) throw new Error(response.error_description || response.error);
      if (!response.access_token || !oauth.hasGrantedAllScopes(response, SCOPE)) throw new Error('Drive 사용 권한을 받지 못했어요.');
      const identityResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${response.access_token}` },
      });
      if (!identityResponse.ok) throw new Error('연결된 Google 계정을 확인하지 못했어요.');
      const identity = await identityResponse.json();
      const googleUid = Cloud.user.providerData.find((item) => item.providerId === 'google.com')?.uid;
      if (!googleUid || identity.sub !== googleUid) throw new Error('ClassHub에 로그인한 Google 계정으로 Drive를 연결해 주세요.');
      accessToken = response.access_token;
    }
    if (!accessToken) throw new Error('Drive 사용 권한을 받지 못했어요.');
    token = accessToken;
    await listFiles();
    localStorage.setItem(key('enabled'), '1');
    for (const id of await Store.imageIds()) if (eligible(id) && !files.has(id) && !pending[id]) pending[id] = 'upload';
    saveState(); await flush();
  }
  function settingsSection() {
    const status = h('p', { class: 'muted' }, !enabled() ? 'Drive 연결 전'
      : token ? `Drive 연결됨 · 업로드 대기 ${Object.keys(pending).length}개` : 'Drive 연결을 다시 눌러 주세요. 이 기기의 파일은 그대로 보관됩니다.');
    const button = h('button', { class: 'btn', type: 'button', onclick: async () => {
      button.disabled = true; status.textContent = 'Google Drive에 연결하는 중…';
      const waiting = setTimeout(() => { status.textContent = '인증 화면이 하얗게 멈췄다면 창을 닫고 다시 시도해 주세요. 연결이 끝나지 않았습니다.'; }, 30000);
      try { await connect(); status.textContent = `Drive 연결됨 · 업로드 대기 ${Object.keys(pending).length}개`; }
      catch (error) { status.textContent = `${error.message || 'Drive 연결에 실패했어요.'}${error.code ? ` (${error.code})` : ''}`; }
      clearTimeout(waiting);
      button.disabled = false;
    } }, token ? 'Drive 동기화 다시 확인' : 'Google Drive 연결');
    return h('div', { class: 'cloud-drive-settings' },
      h('p', { class: 'hint' }, 'Drive를 연결하면 메모 사진·오답 이미지·필기·화이트보드·학교 지도 사진을 다른 기기에서 가져옵니다. PDF 원본과 학교 자료 원본은 업로드하지 않습니다. 글 기록은 계정 동기화를 사용합니다.'),
      h('div', { class: 'set-row set-btns' }, button, status));
  }
  window.addEventListener('online', flush);
  return { accountChanged, disconnect, changed, read, connect, settingsSection };
})();
