// 설정: 학교 정보, NEIS 키, 알레르기, 화면, 백업, 초기화
const Settings = (() => {
  const DEFAULTS = { school: null, grade: '', cls: '', allergies: [], fontScale: 'normal', reduceMotion: false, timerSound: true, soundVolume: 70 };
  const SCALE = { small: '15px', normal: '16px', large: '18px' };

  const get = () => ({ ...DEFAULTS, ...(Store.get('settings', {}) || {}) });
  const save = (patch) => { Store.set('settings', { ...get(), ...patch }); apply(); };

  function apply() {
    const s = get();
    document.documentElement.style.fontSize = SCALE[s.fontScale] || SCALE.normal;
    document.body.classList.toggle('reduce-motion', !!s.reduceMotion);
  }

  function section(title, ...kids) {
    return h('section', { class: 'set-sec' }, h('h4', null, title), ...kids);
  }

  function open() {
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
      onclick: () => { draft.fontScale = k; document.documentElement.style.fontSize = SCALE[k]; drawScale(); } }, l)));
    drawScale();
    const motion = h('input', { type: 'checkbox', checked: !!draft.reduceMotion });
    const sound = h('input', { type: 'checkbox', checked: draft.timerSound !== false });
    const volume = h('input', { type: 'range', min: 0, max: 100, step: 5, value: draft.soundVolume ?? 70, 'aria-label': '소리 크기' });
    const volumeLabel = h('output', null, `${volume.value}%`);
    volume.addEventListener('input', () => { volumeLabel.textContent = `${volume.value}%`; });
    const viewBox = section('화면 설정',
      h('div', { class: 'set-row' }, h('span', null, '글자 크기'), scaleSeg),
      h('label', { class: 'check' }, motion, '애니메이션 효과 줄이기'));
    const soundBox = section('소리 설정',
      h('label', { class: 'check' }, sound, '타이머 끝날 때 소리 내기'),
      h('div', { class: 'set-row' }, h('span', null, '소리 크기'), h('div', { class: 'volume-control' }, volume, volumeLabel)));

    // 백업
    const backupBox = section('백업',
      h('div', { class: 'set-row set-btns' },
        h('button', { class: 'btn', type: 'button', onclick: App.exportData }, '백업 내보내기'),
        h('button', { class: 'btn', type: 'button', onclick: () => { m.close(); App.importData(); } }, '백업 불러오기')));

    // 초기화
    const resetBox = section('데이터 초기화',
      h('button', { class: 'btn danger', type: 'button', onclick: async () => {
        if (!confirm('저장된 모든 데이터(오답노트·시간표·일정·활동·성적·메모)가 지워져요. 계속할까요?')) return;
        if ((prompt('정말 지울까요? 아래 칸에 "초기화"라고 입력하세요.') || '').trim() !== '초기화') { App.toast('취소했어요.'); return; }
        await Store.importAll({ app: 'ClassHub', kv: {}, img: {} });
        m.close(); apply(); App.toast('모두 지웠어요.'); App.route();
      } }, '모든 데이터 지우기'));

    const m = App.modal({
      title: '설정', wide: true,
      body: h('div', { class: 'set-grid' }, schoolBox, alBox, viewBox, soundBox, backupBox, resetBox),
      footer: [
        h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, '닫기'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => {
          save({ school: draft.school, grade: grade.value.trim(), cls: cls.value.trim(), allergies: draft.allergies.slice().sort((a, b) => a - b),
            fontScale: draft.fontScale, reduceMotion: motion.checked, timerSound: sound.checked, soundVolume: Number(volume.value) });
          m.close(); App.toast('설정을 저장했어요.'); App.route();
        } }, '저장'),
      ],
      onClose: apply,
    });
  }

  return { open, get, save, apply };
})();
