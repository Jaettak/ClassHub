// 시간표 관리: 내 시간표 + 친구 시간표, 기본 5일 x 6교시, 교시/요일 추가·삭제, 학교 시간표(NEIS) 불러오기
const Timetable = (() => {
  const DEFAULT = () => ({ days: ['월', '화', '수', '목', '금'], periods: 6, periodTimes: Array.from({ length: 6 }, () => ({ start: '', end: '' })), cells: Array.from({ length: 5 }, () => Array(6).fill(null)) });
  let activeId = 'me';

  const friends = () => Store.get('ttFriends', []);
  function loadMe() {
    const t = Store.get('timetable', null);
    return t && Array.isArray(t.days) ? t : DEFAULT();
  }
  // 지금 보고 있는 시간표와 그 저장 방법
  function current() {
    if (activeId !== 'me') {
      const arr = friends();
      const f = arr.find((x) => x.id === activeId);
      if (f) return { t: f, save: () => Store.set('ttFriends', arr), friend: f };
      activeId = 'me';
    }
    const t = loadMe();
    return { t, save: () => Store.set('timetable', t) };
  }

  // 예전 시간표 데이터에도 안전하게 교시별 시간 설정을 덧붙인다.
  function timesFor(t, index) {
    const v = (Array.isArray(t.periodTimes) && t.periodTimes[index]) || {};
    return { start: v.start || '', end: v.end || '' };
  }
  function validTimes(t, index) {
    const v = timesFor(t, index);
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(v.start) &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(v.end) && v.start < v.end ? v : null;
  }

  // 홈·달력에서 쓰는 특정 날짜의 내 수업 목록
  function lessonsFor(date) {
    const t = loadMe();
    const col = t.days.indexOf(WEEK[date.getDay()]);
    if (col < 0) return [];
    const out = [];
    t.cells[col].forEach((c, i) => { if (c && c.subject) out.push({ period: i + 1, subject: c.subject, teacher: c.teacher || '', ...timesFor(t, i) }); });
    return out;
  }

  // 실제 일정 목록에 복사하지 않고, 조회할 때 수업을 생성한다.
  // 따라서 교시 시간/과목 변경은 즉시 달력에 반영되고 기존 개인 일정은 유지된다.
  function calendarLessons(date) {
    const t = loadMe();
    const col = t.days.indexOf(WEEK[date.getDay()]);
    if (col < 0 || !Array.isArray(t.cells[col])) return [];
    const ds = dateStr(date);
    return t.cells[col].flatMap((c, i) => {
      const times = validTimes(t, i);
      if (!c || !c.subject || !times) return [];
      return [{ id: `class-${col}-${i}`, date: ds, start: times.start, end: times.end,
        title: `${c.subject} (${i + 1}교시)`, subject: c.subject, period: i + 1,
        teacher: c.teacher || '', color: colorFor(c.subject), schoolLesson: true, done: false }];
    });
  }

  function openPeriodTimes(t, save, done) {
    const draft = Array.from({ length: t.periods }, (_, i) => timesFor(t, i));
    const inputs = draft.map((x, i) => {
      const start = h('input', { type: 'time', value: x.start, 'aria-label': `${i + 1}교시 시작 시간` });
      const end = h('input', { type: 'time', value: x.end, 'aria-label': `${i + 1}교시 종료 시간` });
      return { start, end, row: h('div', { class: 'tt-period-time-row' },
        h('strong', null, `${i + 1}교시`), start, h('span', null, '~'), end) };
    });
    const m = App.modal({ title: '교시별 수업 시간', wide: true,
      body: [h('p', { class: 'hint' }, '각 교시의 시작·종료 시간을 입력하면 내 시간표의 수업이 일정 관리의 주간·하루·원 그래프에 자동 표시돼요. 비워둔 교시는 일정에 나타나지 않아요.'),
        h('div', { class: 'tt-period-times' }, inputs.map((x) => x.row))],
      footer: [h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, '취소'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => {
          const next = inputs.map(({ start, end }) => ({ start: start.value, end: end.value }));
          for (let i = 0; i < next.length; i++) {
            const { start, end } = next[i];
            if ((!start && end) || (start && !end) || (start && end && start >= end)) {
              App.toast(`${i + 1}교시의 시작·종료 시간을 올바르게 입력해 주세요.`);
              return;
            }
          }
          t.periodTimes = next;
          save(); m.close(); done(); App.toast('교시별 시간을 저장했어요. 일정 관리에 자동 반영돼요.');
        } }, '저장')],
    });
  }

  function editCell(t, save, d, p, done) {
    const cur = t.cells[d][p] || { subject: '', teacher: '' };
    const subject = App.subjectField('과목', cur.subject);
    const teacher = h('input', { type: 'text', value: cur.teacher || '', placeholder: '예: 김하늘', maxLength: 20 });
    const picker = h('input', { type: 'color', value: colorFor(cur.subject || ''), 'aria-label': '과목 색상 선택' });
    const swatches = h('div', { class: 'tt-color-swatches' }, PALETTE.map((hex) =>
      h('button', { type: 'button', class: 'tt-swatch', style: { background: hex }, title: hex,
        'aria-label': `${hex} 색상`, onclick: () => { picker.value = hex; } })));
    const colorControls = h('div', { class: 'tt-color-edit' }, picker, swatches);
    function updatePicker(name) { picker.value = colorFor(name); }
    function storeColor(name) {
      if (!name) return;
      const colors = { ...Store.get('subjectColors', {}) };
      colors[name] = picker.value;
      Store.set('subjectColors', colors);
    }

    // 같은 과목을 전에 적은 적이 있으면 선생님 이름을 채워 준다
    subject.onPick((s) => {
      updatePicker(s);
      if (teacher.value.trim() || !s) return;
      for (const col of t.cells) for (const c of col) if (c && c.subject === s && c.teacher) { teacher.value = c.teacher; return; }
    });
    const m = App.modal({
      title: `${t.days[d]}요일 ${p + 1}교시`,
      body: [subject.el, App.field('선생님 (선택)', teacher), App.field('과목 색상', colorControls)],
      footer: [
        cur.subject ? h('button', { class: 'btn danger', type: 'button', onclick: () => { t.cells[d][p] = null; save(); m.close(); done(); } }, '지우기') : null,
        h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, '취소'),
        h('button', { class: 'btn primary', type: 'button', onclick: submit }, '저장'),
      ],
    });
    function submit() {
      const s = subject.value();
      t.cells[d][p] = s ? { subject: s, teacher: teacher.value.trim() } : null;
      if (s) storeColor(s);
      save();
      m.close();
      done();
    }
    m.el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') submit(); });
  }

  // 과목명이 길면 글자를 줄이고, 너무 길면 앞부분만 보여준다
  const MAX_CHARS = 12;
  function fitName(name) {
    const n = [...name];
    const shown = n.length > MAX_CHARS ? n.slice(0, MAX_CHARS - 1).join('') + '…' : name;
    const size = n.length <= 4 ? 1 : n.length <= 6 ? 0.86 : n.length <= 8 ? 0.74 : 0.64;
    return { shown, size };
  }

  // 이번 주(주말이면 다음 주) 월~금 범위
  function schoolWeek() {
    const n = new Date();
    const shift = n.getDay() === 0 || n.getDay() === 6 ? 7 : 0;
    const mon = new Date(n.getFullYear(), n.getMonth(), n.getDate() - ((n.getDay() + 6) % 7) + shift);
    return [mon, new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 4)];
  }

  function importFromSchool(t, save, done) {
    const s = Settings.get();
    let school = s.school;
    const info = h('p', { class: 'hint' });
    const grade = h('input', { type: 'number', min: 1, max: 6, value: s.grade || '', placeholder: '학년' });
    const cls = h('input', { type: 'number', min: 1, max: 40, value: s.cls || '', placeholder: '반' });
    const nameEl = h('b', { class: 'set-school' });
    const drawName = () => { nameEl.textContent = school ? `${school.name} (${school.region})` : '학교를 선택해 주세요'; };
    drawName();
    const go = h('button', { class: 'btn primary', type: 'button', onclick: run }, '불러오기');
    const m = App.modal({
      title: '학교 시간표 불러오기',
      body: [
        h('div', { class: 'set-row' }, nameEl, h('button', { class: 'btn', type: 'button', onclick: () => Neis.pickSchool((sc) => { school = sc; drawName(); }) }, '학교 찾기')),
        h('div', { class: 'row2' }, App.field('학년', grade), App.field('반', cls)),
        h('p', { class: 'hint' }, '이번 주 학급 시간표를 NEIS(공식)에서 가져와 지금 시간표를 덮어써요. 고등학교는 선택과목이 반마다 달라 내 시간표와 다를 수 있으니, 불러온 뒤 직접 고쳐 주세요.'),
        info,
      ],
      footer: [h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, '취소'), go],
    });
    async function run() {
      if (!school) { info.textContent = '학교를 먼저 선택해 주세요.'; return; }
      if (!grade.value || !cls.value) { info.textContent = '학년과 반을 입력해 주세요.'; return; }
      if (t.cells.some((col) => col.some(Boolean)) && !confirm('지금 시간표가 불러온 내용으로 바뀌어요. 계속할까요?')) return;
      go.disabled = true;
      info.textContent = '불러오는 중…';
      try {
        const [from, to] = schoolWeek();
        const rows = await Neis.timetable(school, grade.value, cls.value, from, to);
        if (!rows.length) { info.textContent = '시간표를 찾지 못했어요. 학년·반을 확인하거나 방학·휴업 기간인지 확인해 주세요.'; go.disabled = false; return; }
        const dayOf = (r) => WEEK[parseDate(r.date).getDay()];
        const days = [...new Set(rows.map(dayOf))].sort((a, b) => '월화수목금토일'.indexOf(a) - '월화수목금토일'.indexOf(b));
        const periods = Math.min(14, Math.max(1, ...rows.map((r) => r.period)));
        const cells = days.map(() => Array(periods).fill(null));
        rows.forEach((r) => {
          if (r.period >= 1 && r.period <= periods) cells[days.indexOf(dayOf(r))][r.period - 1] = { subject: r.subject, teacher: '' };
        });
        t.days = days; t.periods = periods; t.cells = cells;
        t.periodTimes = Array.from({ length: periods }, (_, i) => timesFor(t, i));
        save();
        m.close();
        App.toast(`${school.name} ${grade.value}학년 ${cls.value}반 시간표를 불러왔어요.`);
        done();
      } catch (e) { info.textContent = e.message; go.disabled = false; }
    }
  }

  function render(root) {
    const wrap = h('div', { class: 'tt-wrap' });

    function openSubjectColors() {
      const names = new Set();
      for (const col of loadMe().cells) for (const c of col) if (c && c.subject) names.add(c.subject.trim());
      for (const friend of friends()) for (const col of friend.cells) for (const c of col) if (c && c.subject) names.add(c.subject.trim());
      const existing = Store.get('subjectColors', {});
      Object.keys(existing).forEach((name) => names.add(name));
      if (!names.size) return App.toast('먼저 시간표에 과목을 등록해 주세요.');
      const edits = [...names].sort((a, b) => a.localeCompare(b, 'ko')).map((name) => {
        const input = h('input', { type: 'color', value: colorFor(name), 'aria-label': `${name} 색상` });
        const auto = h('input', { type: 'checkbox', checked: !Object.prototype.hasOwnProperty.call(existing, name) });
        const line = h('div', { class: 'tt-subject-color-row' }, h('strong', null, name), input,
          h('label', { class: 'tt-auto-label' }, auto, '자동 색상'));
        auto.addEventListener('change', () => { input.disabled = auto.checked; if (auto.checked) {
          let hash = 0;
          for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
          input.value = PALETTE[hash % PALETTE.length];
        } });
        input.disabled = auto.checked;
        return { name, input, auto, line };
      });
      const m = App.modal({ title: '과목별 색상 설정',
        body: [h('p', { class: 'hint' }, '과목 색상을 바꾸면 같은 과목이 시간표·홈·일정 관리·성적 분석에 동일하게 표시돼요.'),
          h('div', { class: 'tt-color-list' }, edits.map((item) => item.line))],
        footer: [h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, '취소'),
          h('button', { class: 'btn primary', type: 'button', onclick: () => {
            const colors = { ...Store.get('subjectColors', {}) };
            for (const { name, input, auto } of edits) {
              if (auto.checked) delete colors[name]; else colors[name] = input.value;
            }
            Store.set('subjectColors', colors);
            m.close(); draw(); App.toast('과목 색상을 저장했어요.');
          } }, '저장')],
      });
    }


    function draw() {
      const { t, save, friend } = current();
      const today = t.days.indexOf(WEEK[new Date().getDay()]);
      wrap.replaceChildren();

      const tabs = h('div', { class: 'tt-tabs' },
        h('button', { type: 'button', class: 'fchip' + (activeId === 'me' ? ' on' : ''), onclick: () => { activeId = 'me'; draw(); } }, '나'),
        friends().map((f) => h('button', { type: 'button', class: 'fchip' + (activeId === f.id ? ' on' : ''), onclick: () => { activeId = f.id; draw(); } }, f.name)),
        h('button', { type: 'button', class: 'fchip add', onclick: addFriend }, '＋ 친구'));

      const head = h('tr', null, h('th', { class: 'corner' }, ''),
        t.days.map((dn, d) => h('th', { class: d === today ? 'today' : '' },
          h('span', null, dn),
          h('button', { class: 'x', type: 'button', title: `${dn}요일 삭제`, onclick: () => removeDay(d) }, '×'))));
      const rows = [];
      for (let p = 0; p < t.periods; p++) {
        rows.push(h('tr', null,
          h('th', { class: 'period' }, h('span', null, `${p + 1}교시`),
            h('small', { class: 'tt-period-time' }, validTimes(t, p) ? `${timesFor(t, p).start}~${timesFor(t, p).end}` : '시간 미설정'),
            h('button', { class: 'x', type: 'button', title: `${p + 1}교시 삭제`, onclick: () => removePeriod(p) }, '×')),
          t.days.map((dn, d) => {
            const c = t.cells[d][p];
            const td = h('td', { class: 'slot' + (d === today ? ' today' : '') + (c ? ' filled' : ''), tabIndex: 0,
              onclick: () => editCell(t, save, d, p, draw),
              onkeydown: (e) => { if (e.key === 'Enter') editCell(t, save, d, p, draw); } });
            if (c) {
              td.style.setProperty('--c', colorFor(c.subject));
              const f = fitName(c.subject);
              td.title = c.teacher ? `${c.subject} · ${c.teacher}` : c.subject;
              td.append(h('b', { style: { fontSize: f.size + 'em' } }, f.shown));
              if (c.teacher) td.append(h('small', null, c.teacher));
            } else td.append(h('span', { class: 'plus' }, '+'));
            return td;
          })));
      }
      wrap.append(
        tabs,
        h('div', { class: 'tt-tools' },
          h('button', { class: 'btn primary', type: 'button', onclick: addPeriod }, '＋ 교시'),
          h('button', { class: 'btn', type: 'button', onclick: addDay }, '＋ 요일'),
          h('button', { class: 'btn', type: 'button', onclick: () => openPeriodTimes(t, save, draw) }, '⏰ 교시별 시간 설정'),
          h('button', { class: 'btn', type: 'button', onclick: openSubjectColors }, '🎨 과목별 색상'),
          h('button', { class: 'btn', type: 'button', onclick: () => importFromSchool(t, save, draw) }, '학교 시간표 불러오기'),
          h('button', { class: 'btn ghost', type: 'button', onclick: reset }, '기본값으로'),
          friend ? h('button', { class: 'btn ghost', type: 'button', onclick: renameFriend }, '이름 바꾸기') : null,
          friend ? h('button', { class: 'btn danger', type: 'button', onclick: removeFriend }, '이 친구 삭제') : null),
        friend ? h('p', { class: 'hint' }, `${friend.name}의 시간표예요. 친구 시간표는 홈·달력의 수업 표시에는 쓰이지 않아요.`) : null,
        h('div', { class: 'tt-scroll' }, h('table', { class: 'tt' }, h('thead', null, head), h('tbody', null, rows))));

      function addPeriod() {
        if (t.periods >= 14) return App.toast('교시는 최대 14개까지예요.');
        t.periods++;
        t.cells.forEach((col) => col.push(null));
        if (!Array.isArray(t.periodTimes)) t.periodTimes = [];
        t.periodTimes.push({ start: '', end: '' });
        save(); draw();
      }
      function addDay() {
        const name = (prompt('추가할 요일 이름을 입력하세요 (예: 토)', t.days.includes('토') ? '일' : '토') || '').trim();
        if (!name) return;
        if (t.days.includes(name)) return App.toast('이미 있는 요일이에요.');
        if (t.days.length >= 7) return App.toast('요일은 최대 7개까지예요.');
        t.days.push(name);
        t.cells.push(Array(t.periods).fill(null));
        save(); draw();
      }
      function removeDay(d) {
        if (t.days.length <= 1) return App.toast('요일은 최소 1개가 필요해요.');
        if (t.cells[d].some(Boolean) && !confirm(`${t.days[d]}요일의 수업이 모두 지워져요. 삭제할까요?`)) return;
        t.days.splice(d, 1);
        t.cells.splice(d, 1);
        save(); draw();
      }
      function removePeriod(p) {
        if (t.periods <= 1) return App.toast('교시는 최소 1개가 필요해요.');
        if (t.cells.some((col) => col[p]) && !confirm(`${p + 1}교시의 수업이 모두 지워져요. 삭제할까요?`)) return;
        t.periods--;
        t.cells.forEach((col) => col.splice(p, 1));
        if (Array.isArray(t.periodTimes)) t.periodTimes.splice(p, 1);
        save(); draw();
      }
      function reset() {
        if (!confirm('이 시간표를 모두 지우고 기본값으로 되돌릴까요?')) return;
        const d = DEFAULT();
        t.days = d.days; t.periods = d.periods; t.cells = d.cells; t.periodTimes = d.periodTimes;
        save(); draw();
      }
      function renameFriend() {
        const name = (prompt('친구 이름', friend.name) || '').trim();
        if (!name) return;
        friend.name = name.slice(0, 12);
        save(); draw();
      }
      function removeFriend() {
        if (!confirm(`${friend.name}의 시간표를 삭제할까요?`)) return;
        Store.set('ttFriends', friends().filter((x) => x.id !== friend.id));
        activeId = 'me'; draw();
      }
    }

    function addFriend() {
      const name = (prompt('친구 이름을 입력하세요') || '').trim();
      if (!name) return;
      const arr = friends();
      if (arr.length >= 12) return App.toast('친구 시간표는 최대 12개까지예요.');
      const f = { id: uid(), name: name.slice(0, 12), ...DEFAULT() };
      arr.push(f);
      Store.set('ttFriends', arr);
      activeId = f.id;
      draw();
    }

    draw();
    root.append(h('section', { class: 'panel' }, h('h1', { class: 'page-title' }, '시간표'), wrap));
  }

  return { render, lessonsFor, calendarLessons };
})();

App.registerView('timetable', { label: '시간표', icon: 'timetable', render: Timetable.render });
