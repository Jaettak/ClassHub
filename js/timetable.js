// 시간표 관리: 내 시간표 + 친구 시간표, 기본 5일 x 6교시, 교시/요일 추가·삭제
const Timetable = (() => {
  const DEFAULT = () => ({ days: ['월', '화', '수', '목', '금'], periods: 6, periodTimes: Array.from({ length: 6 }, () => ({ start: '', end: '' })), lunch: null, cells: Array.from({ length: 5 }, () => Array(6).fill(null)) });
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
    const ds = dateStr(date);
    const rows = typeof Calendar !== 'undefined' ? Calendar.byDate(ds) : Store.get('events', []).filter((e) => e.date === ds);
    return rows.filter((e) => e.schoolLesson)
      .sort((a, b) => a.start.localeCompare(b.start))
      .map((e) => ({ ...e, period: e.period, subject: e.subject || e.title, displayTitle: e.title.replace(/\s*\(\d+교시\)$/, ''), teacher: e.teacher || '' }));
  }

  // 수업은 기간 적용 시 실제 일정으로 저장한다. 기존 조회용 가상 수업은 생성하지 않는다.
  function calendarLessons(date) {
    return lessonsFor(date);
  }

  function applyPeriod(t, done) {
    const start = h('input', { type: 'date', value: todayStr(), min: '2020-01-01', max: '2030-12-31' });
    const end = h('input', { type: 'date', value: dateStr(new Date(new Date().getFullYear(), new Date().getMonth() + 4, new Date().getDate())), min: '2020-01-01', max: '2030-12-31' });
    const name = h('input', { type: 'text', value: `${new Date().getFullYear()}년 시간표`, maxLength: 40 });
    const m = App.modal({ title: '시간표 적용 기간', body: [
      App.field('기간 이름', name), h('div', { class: 'row2' }, App.field('시작 날짜', start), App.field('끝 날짜', end)),
      h('p', { class: 'hint' }, '이 기간의 수업을 실제 일정으로 추가해요. 이후 각 날짜의 수업을 자유롭게 수정하거나 삭제할 수 있고, 시간표를 바꿔도 이미 추가한 일정은 바뀌지 않아요. 시간을 설정하지 않은 교시는 추가하지 않아요.')],
      footer: [h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, '취소'),
        h('button', { class: 'btn primary', type: 'button', onclick: apply }, '기간 일정에 추가')],
    });
    function apply() {
      if (!start.value || !end.value || end.value < start.value) return App.toast('적용 기간을 확인해 주세요.');
      if (Store.get('timetableTerms', []).some((saved) => saved.start <= end.value && saved.end >= start.value))
        return App.toast('이미 적용한 기간과 겹쳐요. 해당 날짜의 수업은 일정 관리에서 수정해 주세요.');
      const a = parseDate(start.value), b = parseDate(end.value);
      const days = Math.round((b - a) / 86400000) + 1;
      if (days > 370) return App.toast('한 번에 최대 370일까지 적용할 수 있어요.');
      const term = { id: uid(), name: name.value.trim() || '시간표', start: start.value, end: end.value, timetable: JSON.parse(JSON.stringify(t)) };
      const list = Store.get('events', []);
      const oldLessonNotes = Store.get('lessonDayNotes', {});
      const occupied = new Set(list.filter((e) => e.schoolLesson).map((e) => `${e.date}|${e.period}`));
      let added = 0;
      for (let i = 0; i < days; i++) {
        const d = new Date(a.getFullYear(), a.getMonth(), a.getDate() + i), ds = dateStr(d);
        const col = t.days.indexOf(WEEK[d.getDay()]);
        if (col < 0 || !Array.isArray(t.cells[col])) continue;
        t.cells[col].forEach((c, p) => {
          const time = validTimes(t, p), slot = `${ds}|${p + 1}`;
          if (!c?.subject || !time || occupied.has(slot)) return;
          list.push({ id: uid(), date: ds, start: time.start, end: time.end, title: `${c.subject} (${p + 1}교시)`,
            subject: c.subject, period: p + 1, teacher: c.teacher || Store.get('subjectTeachers', {})[c.subject]?.[0] || '', room: c.room || Store.get('subjectRooms', {})[c.subject] || '', color: colorFor(c.subject),
            memo: oldLessonNotes[`${ds}|class-${col}-${p}`] || '',
            schoolLesson: true, checkable: false, sourceTerm: term.id, done: false });
          occupied.add(slot); added++;
        });
        if (t.lunch?.start && t.lunch?.end && !list.some((e) => e.date === ds && e.sourceBreak === 'lunch')) {
          list.push({ id: uid(), date: ds, start: t.lunch.start, end: t.lunch.end,
            title: '점심시간', memo: '', color: '#65768e', checkable: false, sourceTerm: term.id, sourceBreak: 'lunch', done: false });
          added++;
        }
      }
      if (!added) return App.toast('추가할 수업이 없어요. 교시별 시간을 확인해 주세요.');
      Store.set('timetableTerms', [...Store.get('timetableTerms', []), term]);
      Store.set('events', list);
      m.close(); done(); App.toast(`${added}개 수업을 일정에 추가했어요.`);
    }
  }

  function openPeriodTimes(t, save, done) {
    const draft = Array.from({ length: t.periods }, (_, i) => timesFor(t, i));
    const inputs = draft.map((x, i) => {
      const start = h('input', { type: 'time', value: x.start, 'aria-label': `${i + 1}교시 시작 시간` });
      const end = h('input', { type: 'time', value: x.end, 'aria-label': `${i + 1}교시 종료 시간` });
      return { start, end, row: h('div', { class: 'tt-period-time-row' },
        h('strong', null, `${i + 1}교시`), start, h('span', null, '~'), end) };
    });
    const autoStart = h('input', { type: 'time', value: t.autoTime?.start || inputs[0]?.start.value || '09:00' });
    const classLength = h('input', { type: 'number', min: 1, max: 180, value: t.autoTime?.lesson ?? 50 });
    const breakLength = h('input', { type: 'number', min: 0, max: 120, value: t.autoTime?.rest ?? 10 });
    const lunchAfter = h('input', { type: 'number', min: 0, max: t.periods, value: t.autoTime?.after ?? t.lunch?.afterPeriod ?? Math.min(4, t.periods) });
    const lunchLength = h('input', { type: 'number', min: 0, max: 180, value: t.autoTime?.lunch ?? (t.lunch ? Math.max(0, (Number(t.lunch.end.slice(0, 2)) * 60 + Number(t.lunch.end.slice(3))) - (Number(t.lunch.start.slice(0, 2)) * 60 + Number(t.lunch.start.slice(3)))) : 60) });
    let autoLunch = null;
    let autoUsed = false;
    const autoFill = () => {
      const [hh, mm] = autoStart.value.split(':').map(Number);
      const lesson = Number(classLength.value), rest = Number(breakLength.value), lunch = Number(lunchLength.value), after = Number(lunchAfter.value);
      if (!autoStart.value || ![lesson, rest, lunch, after].every(Number.isFinite) || lesson < 1 || rest < 0 || lunch < 0 || after < 0 || after > t.periods) return App.toast('자동 입력 시간을 확인해 주세요.');
      if (hh * 60 + mm + t.periods * lesson + Math.max(0, t.periods - 1) * rest + (after ? lunch : 0) >= 1440) return App.toast('마지막 수업이 자정을 넘어요. 시간을 줄여 주세요.');
      autoUsed = true;
      const time = (n) => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;
      let minute = hh * 60 + mm;
      inputs.forEach(({ start, end }, i) => {
        if (minute + lesson >= 1440) return;
        start.value = time(minute); end.value = time(minute + lesson); minute += lesson;
        if (i + 1 === after && lunch) minute += lunch; else minute += rest;
      });
      if (after && lunch) {
        const before = inputs[after - 1].end.value;
        autoLunch = { afterPeriod: after, start: before, end: time(Number(before.slice(0, 2)) * 60 + Number(before.slice(3)) + lunch) };
      } else autoLunch = null;
    };
    const m = App.modal({ title: '교시별 수업 시간', wide: true,
      body: [h('p', { class: 'hint' }, '각 교시의 시작·종료 시간을 정한 뒤 “기간 일정에 추가” 버튼을 누르면 해당 기간의 수업이 일정에 저장돼요. 비워둔 교시는 추가되지 않아요.'),
        h('div', { class: 'tt-auto-time' }, h('b', null, '자동 입력'),
          h('div', { class: 'row2' }, App.field('첫 수업 시작', autoStart), App.field('수업 시간(분)', classLength)),
          h('div', { class: 'row2' }, App.field('쉬는 시간(분)', breakLength), App.field('점심 시간(분)', lunchLength)),
          App.field('점심은 몇 교시 뒤 (0이면 없음)', lunchAfter),
          h('button', { class: 'btn', type: 'button', onclick: autoFill }, '아래 교시 시간 자동 채우기')),
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
          if (autoUsed) {
            t.lunch = autoLunch;
            t.autoTime = { start: autoStart.value, lesson: Number(classLength.value), rest: Number(breakLength.value), lunch: Number(lunchLength.value), after: Number(lunchAfter.value) };
          } else if (next.some((time, index) => time.start !== draft[index].start || time.end !== draft[index].end)) t.autoTime = null;
          save(); m.close(); done(); App.toast('교시별 시간을 저장했어요. 기간을 지정해 일정에 추가해 주세요.');
        } }, '저장')],
    });
  }

  function editCell(t, save, d, p, done) {
    const cur = t.cells[d][p] || { subject: '', teacher: '' };
    const subject = App.subjectField('과목', cur.subject);
    const teacher = h('input', { type: 'text', value: cur.teacher || Store.get('subjectTeachers', {})[cur.subject]?.[0] || '', placeholder: '직접 입력', maxLength: 20 });
    const room = h('input', { type: 'text', value: cur.room || Store.get('subjectRooms', {})[cur.subject] || '', placeholder: '직접 입력', maxLength: 40 });
    const teacherChoices = h('select', { 'aria-label': '저장한 선생님 선택', onchange: (event) => { if (event.currentTarget.value) teacher.value = event.currentTarget.value; } });
    const roomChoices = h('select', { 'aria-label': '저장한 교실 선택', onchange: (event) => { if (event.currentTarget.value) room.value = event.currentTarget.value; } });
    const refreshChoices = (name) => {
      const teachers = Store.get('subjectTeachers', {})[name] || [];
      const rooms = [...new Set([...(Store.get('subjectRoomOptions', {})[name] || []), ...(Store.get('subjectRooms', {})[name] ? [Store.get('subjectRooms', {})[name]] : [])])];
      teacherChoices.replaceChildren(h('option', { value: '' }, '저장한 선생님 선택'), ...teachers.map((value) => h('option', { value }, value)));
      roomChoices.replaceChildren(h('option', { value: '' }, '저장한 교실 선택'), ...rooms.map((value) => h('option', { value }, value)));
      teacherChoices.hidden = !teachers.length;
      roomChoices.hidden = !rooms.length;
    };
    refreshChoices(cur.subject);
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

    subject.onPick((s) => {
      updatePicker(s);
      refreshChoices(s);
      room.value = Store.get('subjectRooms', {})[s] || '';
      teacher.value = Store.get('subjectTeachers', {})[s]?.[0] || '';
    });
    const m = App.modal({
      title: `${t.days[d]}요일 ${p + 1}교시`,
      body: [subject.el, App.field('선생님 (선택)', h('div', { class: 'tt-saved-choice' }, teacherChoices, teacher)), App.field('교실 (선택)', h('div', { class: 'tt-saved-choice' }, roomChoices, room)), App.field('과목 색상', colorControls)],
      footer: [
        cur.subject ? h('button', { class: 'btn danger', type: 'button', onclick: () => { t.cells[d][p] = null; save(); m.close(); done(); } }, '지우기') : null,
        h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, '취소'),
        h('button', { class: 'btn primary', type: 'button', onclick: submit }, '저장'),
      ],
    });
    function submit() {
      const s = subject.value();
      t.cells[d][p] = s ? { subject: s, teacher: teacher.value.trim(), room: room.value.trim() } : null;
      if (s) {
        storeColor(s);
        const roomName = room.value.trim();
        if (roomName) {
          const roomOptions = Store.get('subjectRoomOptions', {});
          Store.set('subjectRoomOptions', { ...roomOptions, [s]: [...new Set([...(roomOptions[s] || []), roomName])] });
          const defaults = Store.get('subjectRooms', {});
          if (!defaults[s]) Store.set('subjectRooms', { ...defaults, [s]: roomName });
        }
        const teachers = Store.get('subjectTeachers', {}), name = teacher.value.trim();
        if (name) Store.set('subjectTeachers', { ...teachers, [s]: [...new Set([...(teachers[s] || []), name])] });
      }
      save();
      m.close();
      done();
    }
    m.el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') submit(); });
  }

  function editLunch(t, save, done) {
    const after = h('input', { type: 'number', min: 1, max: t.periods, value: t.lunch?.afterPeriod || Math.min(4, t.periods) });
    const start = h('input', { type: 'time', value: t.lunch?.start || '' });
    const end = h('input', { type: 'time', value: t.lunch?.end || '' });
    const m = App.modal({ title: '점심시간 설정', body: [App.field('몇 교시 뒤', after), h('div', { class: 'row2' }, App.field('시작', start), App.field('끝', end))],
      footer: [h('button', { class: 'btn ghost', type: 'button', onclick: () => { t.lunch = null; save(); m.close(); done(); } }, '점심시간 제거'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => {
          if (!start.value || !end.value || start.value >= end.value || Number(after.value) < 1 || Number(after.value) > t.periods) return App.toast('점심시간을 확인해 주세요.');
          t.lunch = { afterPeriod: Number(after.value), start: start.value, end: end.value }; save(); m.close(); done();
        } }, '저장')],
    });
  }

  function showTerm(term) {
    const snap = term.timetable;
    const rows = Array.from({ length: snap.periods }, (_, p) => h('tr', null,
      h('th', null, `${p + 1}교시`, h('small', null, `${timesFor(snap, p).start}~${timesFor(snap, p).end}`)),
      snap.days.map((_, d) => h('td', null, snap.cells[d]?.[p]?.subject || ''))));
    App.modal({ title: term.name, wide: true, body: [
      h('p', { class: 'hint' }, `${term.start} ~ ${term.end}에 추가한 시간표예요. 날짜별 수업 변경은 일정 관리에서 확인해 주세요.`),
      h('div', { class: 'tt-scroll' }, h('table', { class: 'tt' },
        h('thead', null, h('tr', null, h('th', null, '교시'), snap.days.map((d) => h('th', null, d)))),
        h('tbody', null, rows)))],
    });
  }

  // 과목명이 길면 글자를 줄이고, 너무 길면 앞부분만 보여준다
  const MAX_CHARS = 12;
  function fitName(name) {
    const n = [...name];
    const shown = n.length > MAX_CHARS ? n.slice(0, MAX_CHARS - 1).join('') + '…' : name;
    const size = n.length <= 4 ? 1 : n.length <= 6 ? 0.86 : n.length <= 8 ? 0.74 : 0.64;
    return { shown, size };
  }

  function render(root) {
    const wrap = h('div', { class: 'tt-wrap' });

    function askName(title, initial, onSave) {
      const input = h('input', { type: 'text', value: initial, maxLength: 12, placeholder: '이름' });
      const m = App.modal({ title, body: App.field('이름', input), footer: [
        h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, '취소'),
        h('button', { class: 'btn primary', type: 'button', onclick: submit }, '저장'),
      ] });
      function submit() {
        const name = input.value.trim();
        if (!name) return App.toast('이름을 입력해 주세요.');
        m.close(); onSave(name.slice(0, 12));
      }
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
      setTimeout(() => input.focus(), 50);
    }

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
      const m = App.modal({ title: '과목 관리',
        body: [h('p', { class: 'hint' }, '과목 색상을 바꾸면 같은 과목이 시간표·홈·일정 관리·성적 분석에 동일하게 표시돼요.'),
          h('div', { class: 'tt-color-list' }, edits.map((item) => {
            const room = h('input', { type: 'text', value: Store.get('subjectRooms', {})[item.name] || '', placeholder: '기본 교실', maxLength: 40, 'aria-label': `${item.name} 기본 교실` });
            const remove = h('button', { class: 'btn danger', type: 'button', onclick: () => {
              if (!confirm(`${item.name} 과목을 현재 시간표에서 지울까요? 이미 일정에 추가된 과거 수업은 유지돼요.`)) return;
              remove.closest('.tt-subject-manage').remove();
              item.deleted = true;
            } }, '과목 삭제');
            item.room = room;
            return h('div', { class: 'tt-subject-manage' }, item.line, room, remove);
          }))],
        footer: [h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, '취소'),
          h('button', { class: 'btn primary', type: 'button', onclick: () => {
            const colors = { ...Store.get('subjectColors', {}) };
            const rooms = { ...Store.get('subjectRooms', {}) };
            for (const { name, input, auto, room, deleted } of edits) {
              if (deleted) { delete colors[name]; delete rooms[name]; continue; }
              if (auto.checked) delete colors[name]; else colors[name] = input.value;
              rooms[name] = room.value.trim();
            }
            Store.set('subjectColors', colors);
            Store.set('subjectRooms', rooms);
            if (edits.some((item) => item.deleted)) {
              const tt = loadMe();
              tt.cells.forEach((col) => col.forEach((cell, i) => { if (edits.some((item) => item.deleted && cell?.subject === item.name)) col[i] = null; }));
              Store.set('timetable', tt);
            }
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
              const teacherName = c.teacher || Store.get('subjectTeachers', {})[c.subject]?.[0] || '';
              const roomName = c.room || Store.get('subjectRooms', {})[c.subject] || '';
              td.title = [c.subject, teacherName, roomName].filter(Boolean).join(' · ');
              td.append(h('b', { style: { fontSize: f.size + 'em' } }, f.shown));
              if (teacherName || roomName) td.append(h('small', { class: 'tt-cell-meta' }, [teacherName, roomName].filter(Boolean).join(' · ')));
            } else td.append(h('span', { class: 'plus' }, '+'));
            return td;
          })));
        if (t.lunch?.afterPeriod === p + 1) rows.push(h('tr', { class: 'tt-lunch-row' },
          h('th', { class: 'period' }, '점심시간', h('small', { class: 'tt-period-time' }, `${t.lunch.start}~${t.lunch.end}`)),
          t.days.map(() => h('td', null, '식사 및 휴식'))));
      }
      wrap.append(...[
        tabs,
        h('div', { class: 'tt-tools' },
          h('button', { class: 'btn primary', type: 'button', onclick: addPeriod }, '＋ 교시'),
          h('button', { class: 'btn', type: 'button', onclick: addDay }, '＋ 요일'),
          h('button', { class: 'btn', type: 'button', onclick: () => openPeriodTimes(t, save, draw) }, '교시별 시간 설정'),
          h('button', { class: 'btn', type: 'button', onclick: () => editLunch(t, save, draw) }, '점심시간 설정'),
          !friend ? h('button', { class: 'btn primary', type: 'button', onclick: () => applyPeriod(t, draw) }, '기간 일정에 추가') : null,
          h('button', { class: 'btn ghost', type: 'button', onclick: reset }, '기본값으로'),
          friend ? h('button', { class: 'btn ghost', type: 'button', onclick: renameFriend }, '이름 바꾸기') : null,
          friend ? h('button', { class: 'btn danger', type: 'button', onclick: removeFriend }, '이 친구 삭제') : null),
        friend ? h('details', { class: 'context-help' }, h('summary', null, '도움말'), h('div', null, `${friend.name}의 시간표예요. 친구 시간표는 홈·달력의 수업 표시에는 쓰이지 않아요.`)) : null,
        h('div', { class: 'tt-scroll' }, h('table', { class: 'tt' }, h('thead', null, head), h('tbody', null, rows))),
        !friend && Store.get('timetableTerms', []).length ? h('div', { class: 'tt-term-list' },
          h('b', null, '적용한 기간'), Store.get('timetableTerms', []).map((term) => h('button', { class: 'btn ghost', type: 'button', onclick: () => showTerm(term) }, `${term.name} · ${term.start} ~ ${term.end}`))) : null].filter(Boolean));

      function addPeriod() {
        if (t.periods >= 14) return App.toast('교시는 최대 14개까지예요.');
        const nextIndex = t.periods;
        t.periods++;
        t.cells.forEach((col) => col.push(null));
        if (!Array.isArray(t.periodTimes)) t.periodTimes = [];
        let nextTime = { start: '', end: '' };
        if (t.autoTime?.start) {
          const rule = t.autoTime;
          let minute = Number(rule.start.slice(0, 2)) * 60 + Number(rule.start.slice(3));
          for (let i = 0; i < nextIndex; i++) minute += rule.lesson + (i + 1 === rule.after ? rule.lunch : rule.rest);
          const end = minute + rule.lesson;
          if (Number.isFinite(end) && end < 1440) {
            const time = (n) => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;
            nextTime = { start: time(minute), end: time(end) };
          }
        }
        t.periodTimes.push(nextTime);
        save(); draw();
      }
      function addDay() {
        if (t.days.length >= 7) return App.toast('요일은 최대 7개까지예요.');
        askName('요일 추가', t.days.includes('토') ? '일' : '토', (name) => {
          if (t.days.includes(name)) return App.toast('이미 있는 요일이에요.');
          t.days.push(name);
          t.cells.push(Array(t.periods).fill(null));
          save(); draw();
        });
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
        t.days = d.days; t.periods = d.periods; t.cells = d.cells; t.periodTimes = d.periodTimes; t.lunch = null;
        save(); draw();
      }
      function renameFriend() {
        askName('친구 이름 바꾸기', friend.name, (name) => { friend.name = name; save(); draw(); });
      }
      function removeFriend() {
        if (!confirm(`${friend.name}의 시간표를 삭제할까요?`)) return;
        Store.set('ttFriends', friends().filter((x) => x.id !== friend.id));
        activeId = 'me'; draw();
      }
    }

    function addFriend() {
      if (friends().length >= 12) return App.toast('친구 시간표는 최대 12개까지예요.');
      askName('친구 시간표 추가', '', (name) => {
        const arr = friends();
        const f = { id: uid(), name, ...DEFAULT() };
        arr.push(f);
        Store.set('ttFriends', arr);
        activeId = f.id;
        draw();
      });
    }

    draw();
    root.append(h('section', { class: 'panel' }, h('h1', { class: 'page-title' }, '시간표'), wrap), SchoolData.tools('timetable', draw, () => activeId));
  }

  return { render, lessonsFor, calendarLessons };
})();

App.registerView('timetable', { label: '시간표', icon: 'timetable', render: Timetable.render });
