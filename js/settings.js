// 설정: 학교 정보, NEIS 키, 알레르기, 화면, 백업, 초기화
const Settings = (() => {
  const DEFAULTS = { school: null, grade: '', cls: '', allergies: [], fontScale: 'normal', reduceMotion: false, timerSound: true, uiSound: true, soundVolume: 50, notesAutoTrashDays: 0, homeCardOrder: [], privateLockEnabled: true };
  const SCALE = { small: '15px', normal: '16px', large: '18px' };
  const DEVICE = ['fontScale', 'reduceMotion', 'timerSound', 'uiSound', 'soundVolume'];
  const unlocked = new Set();
  const protectedTabs = new Set(['wrong', 'timetable', 'subjects', 'calendar', 'activities', 'grades', 'meals', 'notes', 'study', 'whiteboard', 'schoolmap', 'timer']);
  const lockTabs = () => get().privateLockTabs || (get().privateLockEnabled === false ? [] : ['activities', 'grades']);
  const protectedTab = (key) => protectedTabs.has(key) && lockTabs().includes(key);
  const locked = (key) => protectedTab(key) && !unlocked.has(key);
  const lock = () => { unlocked.clear(); };
  const bytesToHex = (bytes) => Array.from(bytes, (n) => n.toString(16).padStart(2, '0')).join('');
  async function hashPin(pin, salt) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: Uint8Array.from(salt.match(/../g).map((n) => parseInt(n, 16))), iterations: 160000, hash: 'SHA-256' }, key, 256);
    return bytesToHex(new Uint8Array(bits));
  }
  function unlock(keyOrAfter = () => {}, afterUnlock = () => {}) {
    const key = typeof keyOrAfter === 'string' ? keyOrAfter : null;
    const after = key ? afterUnlock : keyOrAfter;
    if (!crypto?.subtle) return App.toast('이 환경에서는 비밀번호 잠금을 사용할 수 없어요.');
    const s = get();
    const setup = !s.privatePinHash;
    const pin = h('input', { type: 'password', inputMode: 'numeric', autocomplete: 'off', minLength: 4, maxLength: 32, placeholder: setup ? '새 비밀번호 4자 이상' : '비밀번호' });
    const repeat = h('input', { type: 'password', inputMode: 'numeric', autocomplete: 'off', minLength: 4, maxLength: 32, placeholder: '비밀번호 다시 입력' });
    const submit = h('button', { class: 'btn primary', type: 'button', onclick: async () => {
      if (pin.value.length < 4) return App.toast('비밀번호를 4자 이상 입력해 주세요.');
      if (setup && pin.value !== repeat.value) return App.toast('비밀번호가 서로 달라요.');
      const salt = setup ? bytesToHex(crypto.getRandomValues(new Uint8Array(16))) : s.privatePinSalt;
      const hash = await hashPin(pin.value, salt);
      if (!setup && hash !== s.privatePinHash) return App.toast('비밀번호가 맞지 않아요.');
      if (setup) save({ privatePinSalt: salt, privatePinHash: hash });
      if (key) unlocked.add(key);
      m.close(); after();
    } }, setup ? '설정하고 열기' : '열기');
    const m = App.modal({ title: setup ? '잠금 설정' : '잠금 해제',
      body: [h('p', { class: 'hint' }, setup ? '잠근 탭을 열 때 사용할 비밀번호를 설정하세요.' : '잠근 탭을 보려면 비밀번호를 입력하세요.'),
        App.field('비밀번호', pin), setup ? App.field('비밀번호 확인', repeat) : null],
      footer: [h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, '취소'), submit] });
    [pin, repeat].forEach((input) => input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); submit.click(); } }));
    pin.focus();
  }
  const local = () => {
    try {
      const saved = localStorage.getItem('classhub:deviceSettings');
      if (saved) return JSON.parse(saved);
      const legacy = Store.get('settings', {}) || {};
      const snapshot = Object.fromEntries(DEVICE.filter((key) => key !== 'soundVolume' && key in legacy).map((key) => [key, legacy[key]]));
      localStorage.setItem('classhub:deviceSettings', JSON.stringify(snapshot));
      return snapshot;
    } catch (_) { return {}; }
  };

  const get = () => {
    const shared = { ...(Store.get('settings', {}) || {}) };
    DEVICE.forEach((key) => delete shared[key]);
    const result = { ...DEFAULTS, ...shared, ...local() };
    for (const key of ['homeCardOrder', 'enabledTabs', 'privateLockTabs']) if (Array.isArray(result[key])) result[key] = [...new Set(result[key].map((item) => item === 'school' ? 'schoolmap' : item))];
    return result;
  };
  const save = (patch) => {
    const shared = { ...(Store.get('settings', {}) || {}) };
    const device = { ...local() };
    DEVICE.forEach((key) => { if (key in patch) device[key] = patch[key]; delete shared[key]; });
    Object.entries(patch).forEach(([key, value]) => { if (!DEVICE.includes(key)) shared[key] = value; });
    localStorage.setItem('classhub:deviceSettings', JSON.stringify(device));
    Store.set('settings', shared); apply();
  };

  function apply() {
    const s = get();
    const mobile = matchMedia('(max-width: 900px), (max-height: 520px) and (max-width: 950px)').matches;
    document.documentElement.style.fontSize = mobile ? ({ small: '13px', normal: '14px', large: '16px' })[s.fontScale] || '14px' : SCALE[s.fontScale] || SCALE.normal;
    document.body.classList.toggle('reduce-motion', !!s.reduceMotion);
  }
  window.addEventListener('resize', apply);

  function section(title, ...kids) {
    return h('section', { class: 'set-sec' }, h('h4', null, title), ...kids);
  }

  function open(target) {
    const s = get();
    const draft = { ...s, allergies: [...s.allergies] };

    // 학교
    const schoolName = h('b', { class: 'set-school' });
    const grade = h('input', { type: 'number', min: 1, max: 6, value: draft.grade, placeholder: '학년' });
    const cls = h('input', { type: 'number', min: 1, max: 40, value: draft.cls, placeholder: '반' });
    const drawSchool = () => { schoolName.textContent = draft.school ? `${draft.school.name} (${draft.school.region})` : '아직 선택하지 않았어요'; };
    drawSchool();
    const schoolBox = section('내 학교',
      h('div', { class: 'set-row' }, schoolName,
        h('button', { class: 'btn', type: 'button', onclick: () => Neis.pickSchool((sc) => { draft.school = sc; drawSchool(); }) }, '학교 찾기')),
      h('div', { class: 'row2' }, App.field('학년', grade), App.field('반', cls)));

    // 알레르기
    const allergyBox = h('div', { class: 'chips al-chips' });
    const drawAl = () => allergyBox.replaceChildren(...Neis.ALLERGY.map((n, i) => i === 0 ? null : h('button', { type: 'button', class: 'fchip' + (draft.allergies.includes(i) ? ' on' : ''),
      onclick: () => { const k = draft.allergies.indexOf(i); if (k >= 0) draft.allergies.splice(k, 1); else draft.allergies.push(i); drawAl(); } }, `${i} ${n}`)));
    drawAl();
    const alBox = section('내 알레르기', h('div', { class: 'set-row' },
      h('span', { class: 'muted' }, `선택한 알레르기 ${draft.allergies.length}개`),
      h('button', { class: 'btn', type: 'button', onclick: () => {
        const m2 = App.modal({ title: '알레르기 선택', wide: true, body: allergyBox, footer: [
          h('button', { class: 'btn primary', type: 'button', onclick: () => {
            count.textContent = `선택한 알레르기 ${draft.allergies.length}개`; m2.close();
          } }, '선택 완료')] });
      } }, '알레르기 선택') ));
    const count = alBox.querySelector('.muted');

    // 화면
    const scaleSeg = h('div', { class: 'seg' });
    const drawScale = () => scaleSeg.replaceChildren(...[['small', '작게'], ['normal', '보통'], ['large', '크게']].map(([k, l]) => h('button', { type: 'button', class: 'seg-btn' + (draft.fontScale === k ? ' on' : ''),
      onclick: () => { draft.fontScale = k; document.documentElement.style.fontSize = matchMedia('(max-width: 900px), (max-height: 520px) and (max-width: 950px)').matches ? ({ small: '13px', normal: '14px', large: '16px' })[k] : SCALE[k]; drawScale(); } }, l)));
    drawScale();
    const motion = h('input', { type: 'checkbox', checked: !!draft.reduceMotion });
    const sound = h('input', { type: 'checkbox', checked: draft.timerSound !== false });
    const uiSound = h('input', { type: 'checkbox', checked: draft.uiSound !== false });
    const volume = h('input', { type: 'range', min: 0, max: 100, step: 5, value: draft.soundVolume ?? 50, 'aria-label': '소리 크기' });
    const volumeLabel = h('output', null, `${volume.value}%`);
    volume.addEventListener('input', () => { volumeLabel.textContent = `${volume.value}%`; });
    const viewBox = section('화면 설정',
      h('div', { class: 'set-row' }, h('span', null, '글자 크기'), scaleSeg),
      h('label', { class: 'check' }, motion, '애니메이션 효과 줄이기'));
    const soundBox = section('소리 설정',
      h('label', { class: 'check' }, sound, '타이머 끝날 때 소리 내기'),
      h('label', { class: 'check' }, uiSound, '버튼 효과음'),
      h('div', { class: 'set-row' }, h('span', null, '소리 크기'), h('div', { class: 'volume-control' }, volume, volumeLabel)));
    const cleanupDays = h('select', { 'aria-label': '지난 메모 휴지통 이동' },
      [[0, '자동 이동 안 함'], [1, '하루 지난 뒤'], [3, '3일 지난 뒤'], [7, '7일 지난 뒤'], [30, '30일 지난 뒤'], [90, '90일 지난 뒤']].map(([days, label]) => h('option', { value: days, selected: Number(draft.notesAutoTrashDays || 0) === days }, label)));
    const notesBox = section('메모 정리', App.field('날짜가 지난 메모', cleanupDays,
      '설정한 기간이 지나면 연결된 날짜가 있는 메모만 휴지통으로 옮겨요. 휴지통에서 복원할 수 있어요.'));
    const cardNames = [['wrong', '오답노트'], ['timetable', '시간표'], ['subjects', '과목 관리'], ['calendar', '일정 관리'], ['activities', '활동 관리'], ['grades', '성적 관리'], ['meals', '급식'], ['notes', '메모'], ['study', '필기 공간'], ['whiteboard', '화이트보드'], ['schoolmap', '학교 지도'], ['timer', '타이머']];
    const cardOrder = [...cardNames.map(([id]) => id)].sort((a, b) => {
      const order = draft.homeCardOrder || [];
      return (order.indexOf(a) < 0 ? 999 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 999 : order.indexOf(b));
    });
    const cardList = h('div', { class: 'set-card-order' });
    const drawCards = () => cardList.replaceChildren(...cardOrder.map((id, i) => h('div', { class: 'set-card-row' },
      h('span', null, cardNames.find(([key]) => key === id)?.[1] || id),
      h('button', { class: 'btn ghost', type: 'button', disabled: i === 0, 'aria-label': `${id} 위로`, onclick: () => { [cardOrder[i - 1], cardOrder[i]] = [cardOrder[i], cardOrder[i - 1]]; drawCards(); } }, '↑'),
      h('button', { class: 'btn ghost', type: 'button', disabled: i === cardOrder.length - 1, 'aria-label': `${id} 아래로`, onclick: () => { [cardOrder[i + 1], cardOrder[i]] = [cardOrder[i], cardOrder[i + 1]]; drawCards(); } }, '↓'))));
    drawCards();
    const homeBox = section('메인 탭 버튼 순서', h('button', { class: 'btn', type: 'button', onclick: () => {
      drawCards();
      const dialog = App.modal({ title: '메인 탭 버튼 순서', body: cardList, footer: [h('button', { class: 'btn primary', type: 'button', onclick: () => dialog.close() }, '선택 완료')] });
    } }, '버튼 순서 바꾸기'));
    const lockChoices = cardNames.map(([id, label]) => ({ id, input: h('input', { type: 'checkbox', checked: (draft.privateLockTabs || (draft.privateLockEnabled === false ? [] : ['activities', 'grades'])).includes(id) }), label }));
    const lockOptions = h('div', { class: 'set-lock-tabs' }, lockChoices.map(({ input, label }) => h('label', { class: 'check' }, input, label)));
    const lockBox = section('잠금 활성화',
      h('button', { class: 'btn', type: 'button', onclick: () => {
        const dialog = App.modal({ title: '잠금 활성화', body: [lockOptions, h('p', { class: 'hint' }, '잠근 탭의 내용은 홈 미리보기에서도 숨깁니다. 화면 접근용 잠금이며 저장 데이터 암호화는 아닙니다.')], footer: [h('button', { class: 'btn primary', type: 'button', onclick: () => dialog.close() }, '선택 완료')] });
      } }, '잠글 탭 선택'),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => {
        if (!get().privatePinHash) return unlock(() => App.toast('비밀번호를 설정했어요.'));
        unlock(() => {
          const next = h('input', { type: 'password', minLength: 4, maxLength: 32, autocomplete: 'off' });
          const again = h('input', { type: 'password', minLength: 4, maxLength: 32, autocomplete: 'off' });
          const change = App.modal({ title: '비밀번호 변경', body: [App.field('새 비밀번호', next), App.field('다시 입력', again)], footer: [
            h('button', { class: 'btn primary', type: 'button', onclick: async () => {
              if (next.value.length < 4 || next.value !== again.value) return App.toast('새 비밀번호를 4자 이상 똑같이 입력해 주세요.');
              const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
              save({ privatePinSalt: salt, privatePinHash: await hashPin(next.value, salt) });
              change.close(); App.toast('비밀번호를 바꿨어요.');
            } }, '변경') ] });
        });
      } }, draft.privatePinHash ? '비밀번호 변경' : '비밀번호 설정'));
    const enabledChoices = cardNames.map(([id, label]) => ({ id, label, input: h('input', { type: 'checkbox', checked: !Array.isArray(draft.enabledTabs) || draft.enabledTabs.includes(id) }) }));
    const enabledOptions = h('div', { class: 'set-lock-tabs' }, enabledChoices.map(({ input, label }) => h('label', { class: 'check' }, input, label)));
    const enabledBox = section('탭 버튼 표시', h('button', { class: 'btn', type: 'button', onclick: () => {
      const dialog = App.modal({ title: '탭 버튼 표시', body: [enabledOptions, h('p', { class: 'hint' }, '끄면 홈과 상단의 탭 버튼만 숨겨집니다. 저장된 기록은 지워지지 않습니다.')], footer: [h('button', { class: 'btn primary', type: 'button', onclick: () => dialog.close() }, '선택 완료')] });
    } }, '표시할 탭 선택'));
    const versionBox = section('앱 정보', h('p', null, CLASSHUB_VERSION),
      h('p', { class: 'hint' }, '웹·컴퓨터·안드로이드에 공통으로 사용할 다음 버전의 로컬 미리보기입니다.'));

    // 백업
    const backupBox = section('백업',
      h('div', { class: 'set-row set-btns' },
        h('button', { class: 'btn', type: 'button', onclick: App.exportData }, '백업 내보내기'),
        h('button', { class: 'btn', type: 'button', onclick: () => { m.close(); App.importData(true); } }, '백업 합치기'),
        h('button', { class: 'btn', type: 'button', onclick: () => { m.close(); App.importData(); } }, '백업으로 바꾸기')),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => {
        const cutoff = dateStr(new Date(new Date().getFullYear() - 1, new Date().getMonth(), new Date().getDate()));
        const events = Store.get('events', []).filter((e) => !e.repeat && !e.schoolLesson && !e.sourceBreak && (e.dateEnd || e.date) < cutoff && (e.done || e.doneDates?.length));
        const activities = Store.get('activities', []).filter((a) => a.date && a.date < cutoff);
        const notes = Store.get('notes', []).filter((n) => n.deletedAt && (n.dateEnd || n.date) && (n.dateEnd || n.date) < cutoff);
        if (!events.length && !activities.length && !notes.length) return App.toast('1년 지난 보관 대상 기록이 없어요.');
        App.download(`ClassHub-오래된기록-${todayStr()}.json`, new Blob([JSON.stringify({ app: 'ClassHubArchive', exportedAt: new Date().toISOString(), cutoff, events, activities, notes }, null, 2)], { type: 'application/json' }));
        App.toast('기록을 파일로 저장했어요. 원본 기록은 그대로 유지돼요.');
      } }, '1년 지난 기록 JSON으로 보관'),
      h('p', { class: 'hint' }, '완료된 단일 일정, 지난 활동, 휴지통의 날짜 연결 메모만 내보냅니다. 반복 일정과 시간표는 제외하며 앱의 원본은 삭제하지 않습니다.'));

    // 초기화
    const resetBox = section('데이터 초기화',
      h('button', { class: 'btn danger', type: 'button', onclick: async () => {
        if (!confirm('저장된 모든 데이터(오답노트·시간표·일정·활동·성적·메모)가 지워져요. 계속할까요?')) return;
        if ((prompt('정말 지울까요? 아래 칸에 "초기화"라고 입력하세요.') || '').trim() !== '초기화') { App.toast('취소했어요.'); return; }
        await Store.importAll({ app: 'ClassHub', kv: {}, img: {} });
        m.close(); apply(); App.toast('모두 지웠어요.'); App.route();
      } }, '모든 데이터 지우기'));

    const body = h('div', { class: 'set-grid' }, Cloud.accountSection(), schoolBox, alBox, viewBox, soundBox, notesBox, homeBox, enabledBox, lockBox, backupBox, resetBox, versionBox);
    const commit = () => {
      save({ school: draft.school, grade: grade.value.trim(), cls: cls.value.trim(), allergies: draft.allergies.slice().sort((a, b) => a - b),
        fontScale: draft.fontScale, reduceMotion: motion.checked, timerSound: sound.checked, uiSound: uiSound.checked, soundVolume: Number(volume.value), notesAutoTrashDays: Number(cleanupDays.value), homeCardOrder: cardOrder.slice(), enabledTabs: enabledChoices.filter(({ input }) => input.checked).map(({ id }) => id), privateLockTabs: lockChoices.filter(({ input }) => input.checked).map(({ id }) => id), privateLockEnabled: true });
      if (!sound.checked) Timer.stopAlarm();
      m.close(); App.toast('설정을 저장했어요.'); App.route();
    };
    const footer = [
        h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, '닫기'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => {
          if (s.privatePinHash && !unlocked.size && (s.privateLockTabs || (s.privateLockEnabled === false ? [] : ['activities', 'grades'])).some((id) => !lockChoices.find((x) => x.id === id)?.input.checked)) unlock(commit);
          else commit();
        } }, '저장'),
      ];
    const m = target ? { close: () => { location.hash = '#home'; apply(); } } : App.modal({ title: '설정', wide: true, body, footer, onClose: apply });
    if (target) target.append(h('section', { class: 'panel set-page' }, h('h1', { class: 'page-title' }, '설정'), body, h('div', { class: 'set-page-footer' }, footer)));
  }

  return { open, render: (root) => open(root), get, save, apply, locked, protectedTab, lock, unlock };
})();

App.registerView('settings', { label: '설정', icon: 'settings', render: Settings.render });
