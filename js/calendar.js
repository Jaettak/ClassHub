// 전체 달력: 월간 · 주간 · 하루(원 그래프 포함), 2030년까지 / 완료 표시 · 반복 일정 · 타이머
const Calendar = (() => {
  const MIN_Y = 2020;
  const MAX_Y = 2030;
  const COLORS = ['#4f8cff', '#35c27a', '#ff9f2e', '#ff6f91', '#a276ff', '#18bfd1'];
  const HP = 48; // 한 시간 높이(px)
  const REPEATS = [['', '반복 안 함'], ['daily', '매일'], ['weekly', '매주 (요일 선택)']];

  let mode = 'month';
  let focus = new Date();
  const weekLessonsVisible = () => Store.get('weekLessonsVisible', true) !== false;
  let collapse = true; // 일정 없는 시간대를 접어서 보여 준다
  const opened = new Set(); // 눌러서 펼친 빈 시간대

  const toMin = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  const weekStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
  const clampDate = (d) => {
    if (d.getFullYear() < MIN_Y) return new Date(MIN_Y, 0, 1);
    if (d.getFullYear() > MAX_Y) return new Date(MAX_Y, 11, 31);
    return d;
  };
  const longDate = (d) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})`;
  const range = (e) => (e.start === e.end ? e.start : `${e.start}–${e.end}`);
  const blank = (ds, hr) => ({ date: ds, start: `${pad(hr)}:00`, end: hr >= 23 ? '23:59' : `${pad(hr + 1)}:00`, color: COLORS[0] });
  const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ''}` : `${m}분`);

  const events = () => Store.get('events', []);
  const saveEvents = (list) => Store.set('events', list);
  const exams = () => Store.get('examPeriods', []);
  const examForDate = (ds) => exams().find((exam) => exam.start <= ds && ds <= exam.end);
  const examLessonsFor = (ds) => {
    const exam = examForDate(ds);
    return (exam?.days?.[ds] || []).filter((row) => row.subject).map((row, i) => ({
      id: `exam-${exam.id}-${ds}-${i}`, date: ds, start: row.start || '09:00', end: row.end || row.start || '09:00',
      title: `${row.subject} (${row.period || i + 1}교시)`, displayTitle: row.subject, subject: row.subject,
      period: Number(row.period || i + 1), room: row.room || '', color: colorFor(row.subject),
      schoolLesson: true, examLesson: true, checkable: false, done: false, memo: ''
    }));
  };
  const nextExam = () => exams().filter((e) => e.end >= todayStr()).sort((a, b) => a.start.localeCompare(b.start))[0] || null;
  const lessonNoteKey = (ev) => `${ev.date}|${ev.id}`;
  const getLessonNote = (ev) => Store.get('lessonDayNotes', {})[lessonNoteKey(ev)] || '';
  function saveLessonNote(ev, value) {
    const notes = { ...Store.get('lessonDayNotes', {}) };
    if (value.trim()) notes[lessonNoteKey(ev)] = value.trim();
    else delete notes[lessonNoteKey(ev)];
    Store.set('lessonDayNotes', notes);
  }
  const savedColors = () => Store.get('eventSavedColors', []).filter((v) => /^#[0-9a-fA-F]{6}$/.test(v)).slice(0, 5);
  function saveFavoriteColor(c) {
    let arr = savedColors().filter((v) => v.toLowerCase() !== c.toLowerCase());
    arr.push(c);
    arr = arr.slice(-5);
    Store.set('eventSavedColors', arr);
  }

  // ---------- 반복 · 완료 ----------
  function occursOn(e, ds) {
    if (Array.isArray(e.dates) && e.dates.length) return e.dates.includes(ds);
    if (e.dateEnd && !e.repeat) return e.date <= ds && ds <= e.dateEnd;
    if (!e.repeat) return e.date === ds;
    if (ds < e.date || (e.repeat.until && ds > e.repeat.until) || (e.skip || []).includes(ds)) return false;
    const base = parseDate(e.date);
    const d = parseDate(ds);
    if (e.repeat.type === 'daily') return true;
    if (e.repeat.type === 'weekly') return (e.repeat.days && e.repeat.days.length ? e.repeat.days : [base.getDay()]).includes(d.getDay());
    if (e.repeat.type === 'monthly') return Math.min(base.getDate(), new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()) === d.getDate();
    return false;
  }
  const isDone = (e, ds) => (e.repeat || e.dateEnd || e.dates?.length ? (e.doneDates || []).includes(ds) : !!e.done);
  const occ = (e, ds) => ({ ...e, date: ds, baseDate: e.date, done: isDone(e, ds), rep: !!e.repeat });
  const sortFn = (a, b) => (a.date + a.start).localeCompare(b.date + b.start) || a.title.localeCompare(b.title);

  function repDesc(e) {
    const r = e.repeat;
    if (!r) return '';
    let s = r.type === 'daily' ? '매일' : r.type === 'weekly' ? `매주 ${(r.days && r.days.length ? r.days : [parseDate(e.baseDate || e.date).getDay()]).map((d) => WEEK[d]).join('·')}` : `매달 ${parseDate(e.baseDate || e.date).getDate()}일`;
    if (r.until) s += ` (${r.until.replace(/-/g, '.')}까지)`;
    return s;
  }

  function setDone(id, ds, val) {
    const list = events();
    const e = list.find((x) => x.id === id);
    if (!e) return;
    if (e.repeat || e.dateEnd || e.dates?.length) {
      const s = new Set(e.doneDates || []);
      if (val) s.add(ds); else s.delete(ds);
      e.doneDates = [...s];
    } else e.done = !!val;
    saveEvents(list);
  }

  const byDate = (ds) => {
    const exam = examForDate(ds);
    const day = events().filter((e) => occursOn(e, ds) && !(exam && (e.schoolLesson || e.sourceBreak))).map((e) => occ(e, ds));
    return [...day, ...examLessonsFor(ds)].sort(sortFn);
  };

  function manageExams(after = () => {}) {
    const body = h('div', { class: 'exam-list' });
    const drawList = () => body.replaceChildren(...(exams().length ? exams().map((exam) => h('div', { class: 'exam-list-row' },
      h('span', null, `${exam.title} · ${exam.start} ~ ${exam.end}`),
      h('button', { class: 'btn', type: 'button', onclick: () => editExam(exam, () => { drawList(); after(); }) }, '수정'),
      h('button', { class: 'btn danger', type: 'button', onclick: () => {
        if (!confirm(`${exam.title} 시험기간을 삭제할까요?`)) return;
        Store.set('examPeriods', exams().filter((x) => x.id !== exam.id)); drawList(); after();
      } }, '삭제'))) : [h('p', { class: 'muted' }, '등록된 시험기간이 없어요.') ]));
    drawList();
    App.modal({ title: '시험기간 관리', wide: true, body, footer: [h('button', { class: 'btn primary', type: 'button', onclick: () => editExam(null, () => { drawList(); after(); }) }, '＋ 시험기간') ] });
  }

  function editExam(source, after) {
    const title = h('input', { type: 'text', value: source?.title || '', placeholder: '예: 1학기 중간고사', maxLength: 50 });
    const start = h('input', { type: 'date', value: source?.start || todayStr() });
    const end = h('input', { type: 'date', value: source?.end || source?.start || todayStr() });
    const daysBox = h('div', { class: 'exam-days' });
    const dateRows = new Map();
    const addRow = (ds, row = {}) => {
      const period = h('input', { type: 'number', min: 1, max: 14, value: row.period || dateRows.get(ds).length + 1, 'aria-label': '교시' });
      const subject = h('input', { type: 'text', value: row.subject || '', placeholder: '과목', maxLength: 40, 'aria-label': '시험 과목' });
      const room = h('input', { type: 'text', value: row.room || '', placeholder: '교실', maxLength: 40, 'aria-label': '교실' });
      const slot = Store.get('timetable', {})?.periodTimes?.[Number(period.value) - 1] || {};
      const time = validExamTime(row.start || slot.start || ''), endTime = validExamTime(row.end || slot.end || '');
      const begin = h('input', { type: 'time', value: time, 'aria-label': '시작 시간' });
      const finish = h('input', { type: 'time', value: endTime, 'aria-label': '끝 시간' });
      const line = h('div', { class: 'exam-subject-row' }, period, subject, room, begin, finish,
        h('button', { class: 'btn ghost', type: 'button', 'aria-label': '이 시험 과목 삭제', onclick: () => { line.remove(); dateRows.set(ds, dateRows.get(ds).filter((x) => x.line !== line)); } }, '×'));
      dateRows.get(ds).push({ line, period, subject, room, begin, finish });
      daysBox.querySelector(`[data-date="${ds}"] .exam-subjects`).append(line);
    };
    const drawDays = () => {
      const draft = Object.fromEntries([...dateRows].map(([ds, rows]) => [ds, rows.map((r) => ({
        period: r.period.value, subject: r.subject.value, room: r.room.value, start: r.begin.value, end: r.finish.value
      }))]));
      daysBox.replaceChildren(); dateRows.clear();
      if (!start.value || !end.value || end.value < start.value) return;
      const a = parseDate(start.value), b = parseDate(end.value);
      const count = Math.round((b - a) / 86400000) + 1;
      if (count > 30) { daysBox.append(h('p', { class: 'muted' }, '시험기간은 한 번에 30일까지 입력할 수 있어요.')); return; }
      for (let i = 0; i < count; i++) {
        const d = new Date(a.getFullYear(), a.getMonth(), a.getDate() + i), ds = dateStr(d);
        dateRows.set(ds, []);
        daysBox.append(h('section', { class: 'exam-day', 'data-date': ds },
          h('div', { class: 'title-row' }, h('b', null, `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})`),
            h('button', { class: 'btn ghost', type: 'button', onclick: () => addRow(ds) }, '＋ 과목')),
          h('div', { class: 'exam-subjects' })));
        (draft[ds] || source?.days?.[ds] || []).forEach((row) => addRow(ds, row));
      }
    };
    start.addEventListener('change', drawDays); end.addEventListener('change', drawDays); drawDays();
    const m = App.modal({ title: source ? '시험기간 수정' : '시험기간 추가', wide: true,
      body: [App.field('이름', title), h('div', { class: 'row2' }, App.field('시작 날짜', start), App.field('끝 날짜', end)),
        h('p', { class: 'hint' }, '날짜별 과목·교시·교실·시간을 입력하세요. 시험일에는 이 시간표가 평소 수업 대신 표시돼요.'), daysBox],
      footer: [h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, '취소'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => {
          if (!title.value.trim() || !start.value || !end.value || end.value < start.value || dateRows.size > 30 || !dateRows.size) return App.toast('시험 이름과 기간을 확인해 주세요.');
          if (exams().some((x) => x.id !== source?.id && x.start <= end.value && x.end >= start.value)) return App.toast('다른 시험기간과 날짜가 겹쳐요.');
          const days = {};
          for (const [ds, rows] of dateRows) {
            days[ds] = rows.filter((r) => r.subject.value.trim()).map((r) => ({ period: Number(r.period.value), subject: r.subject.value.trim(), room: r.room.value.trim(), start: r.begin.value, end: r.finish.value }));
            if (days[ds].some((r) => !r.period || r.period < 1 || !r.start || !r.end || r.end <= r.start)) return App.toast(`${ds} 과목의 교시와 시간을 확인해 주세요.`);
          }
          const exam = { id: source?.id || uid(), title: title.value.trim(), start: start.value, end: end.value, days };
          Store.set('examPeriods', [...exams().filter((x) => x.id !== exam.id), exam]);
          m.close(); after(); App.toast('시험기간을 저장했어요.');
        } }, '저장') ] });
  }
  const validExamTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : '';

  // 오늘 이후 일정(반복 포함, 약 반년 치)
  function eventsFrom(ds, limit, opts) {
    const hideDone = opts && opts.hideDone;
    const out = [];
    const list = events();
    list.filter((e) => !e.repeat && !e.dateEnd && !e.dates?.length && e.date >= ds).forEach((e) => out.push(occ(e, e.date)));
    list.filter((e) => !e.repeat && (e.dateEnd || e.dates?.length)).forEach((e) => {
      const start = parseDate(ds);
      for (let i = 0; i < 180; i++) {
        const d = dateStr(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
        if (occursOn(e, d)) out.push(occ(e, d));
      }
    });
    const reps = list.filter((e) => e.repeat);
    if (reps.length) {
      const start = parseDate(ds);
      for (let i = 0; i < 180; i++) {
        const d = dateStr(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
        reps.forEach((e) => { if (occursOn(e, d)) out.push(occ(e, d)); });
      }
    }
    const res = out.filter((e) => !(hideDone && e.done)).sort(sortFn);
    return limit ? res.slice(0, limit) : res;
  }

  // 완료 체크 동그라미
  const ckBtn = (ev, redraw, small) => ev.checkable === false ? null : h('button', { type: 'button', class: 'ck' + (ev.done ? ' on' : '') + (small ? ' sm' : ''), role: 'checkbox', 'aria-checked': String(!!ev.done),
    'aria-label': `${ev.title} 완료 표시`, title: ev.done ? '완료 취소' : '완료로 표시',
    onclick: (e) => { e.stopPropagation(); setDone(ev.id, ev.date, !ev.done); redraw(); } }, ev.done ? '✓' : '');

  // 겹치는 일정은 나란히(줄) 배치
  function layout(list) {
    const evs = list.map((e) => { const s = toMin(e.start); return { e, s, f: Math.min(1440, Math.max(toMin(e.end), s + 30)) }; });
    const lanes = [];
    evs.forEach((x) => {
      let i = lanes.findIndex((end) => end <= x.s);
      if (i < 0) { i = lanes.length; lanes.push(0); }
      lanes[i] = x.f; x.lane = i;
    });
    evs.forEach((x) => { x.n = Math.max(...evs.filter((y) => y.s < x.f && y.f > x.s).map((y) => y.lane)) + 1; });
    return evs;
  }

  // ---------- 삭제 ----------
  function removeEvent(ev, after, closeParent) {
    const base = events().find((x) => x.id === ev.id);
    if (!base) return;
    const finish = () => { if (closeParent) closeParent(); after(); };
    if (!base.repeat && (base.dateEnd || base.dates?.length)) {
      const m = App.modal({ title: '여러 날 일정 삭제', body: h('p', null, '이 날짜만 지우거나 여러 날 일정을 모두 지울 수 있어요.'), footer: [
        h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, '취소'),
        h('button', { class: 'btn', type: 'button', onclick: () => {
          const days = base.dates?.length ? base.dates : [];
          if (!days.length) {
            const a = parseDate(base.date), count = Math.round((parseDate(base.dateEnd) - a) / 86400000) + 1;
            for (let i = 0; i < count; i++) days.push(dateStr(new Date(a.getFullYear(), a.getMonth(), a.getDate() + i)));
          }
          const remaining = days.filter((d) => d !== ev.date);
          const list = events().filter((x) => x.id !== base.id);
          if (remaining.length) list.push({ ...base, date: remaining[0], dates: remaining, dateEnd: '' });
          saveEvents(list); m.close(); finish();
        } }, '이 날짜만 삭제'),
        h('button', { class: 'btn danger', type: 'button', onclick: () => { saveEvents(events().filter((x) => x.id !== base.id)); m.close(); finish(); } }, '모든 날짜 삭제')
      ] });
      return;
    }
    if (!base.repeat) {
      if (!confirm('이 일정을 삭제할까요?')) return;
      saveEvents(events().filter((x) => x.id !== ev.id));
      finish();
      return;
    }
    const m = App.modal({
      title: '반복 일정 삭제',
      body: h('p', null, `"${base.title}"은(는) 반복 일정이에요. 어떻게 지울까요?`),
      footer: [
        h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, '취소'),
        h('button', { class: 'btn', type: 'button', onclick: () => {
          const list = events();
          const b = list.find((x) => x.id === ev.id);
          b.skip = [...(b.skip || []), ev.date];
          saveEvents(list); m.close(); finish();
        } }, `${ev.date.slice(5).replace('-', '/')}만 삭제`),
        h('button', { class: 'btn danger', type: 'button', onclick: () => { saveEvents(events().filter((x) => x.id !== ev.id)); m.close(); finish(); } }, '전체 삭제'),
      ],
    });
  }

  // ---------- 일정 입력·수정 ----------
  function editEvent(ev, after) {
    const base = ev.id ? events().find((x) => x.id === ev.id) : null;
    const src = base || ev;
    const isNew = !base;
    const title = h('input', { type: 'text', value: src.title || '', placeholder: '예: 수학 수행평가', maxLength: 60 });
    const date = h('input', { type: 'date', value: src.date, min: `${MIN_Y}-01-01`, max: `${MAX_Y}-12-31` });
    const dateEnd = h('input', { type: 'date', value: src.dateEnd || '' });
    const extraDate = h('input', { type: 'date' });
    const selectedDates = new Set(src.dates || []);
    const dateMode = h('select', { 'aria-label': '일정 날짜 방식' },
      [['one', '하루'], ['range', '연속된 여러 날'], ['many', '여러 날짜 선택']].map(([v, label]) => h('option', { value: v, selected: v === (src.dates?.length ? 'many' : src.dateEnd ? 'range' : 'one') }, label)));
    const dateList = h('div', { class: 'nt-dates' });
    const drawDateList = () => dateList.replaceChildren(...[...selectedDates].sort().map((ds) => h('button', { class: 'fchip', type: 'button', onclick: () => { selectedDates.delete(ds); drawDateList(); } }, `${ds} ×`)));
    const rangeField = App.field('마지막 날짜', dateEnd);
    const manyField = h('div', { class: 'field' }, h('span', null, '날짜 추가'), h('div', { class: 'set-row' }, extraDate,
      h('button', { class: 'btn', type: 'button', onclick: () => { if (extraDate.value) { selectedDates.add(extraDate.value); extraDate.value = ''; drawDateList(); } } }, '＋ 추가')), dateList);
    drawDateList();
    const start = h('input', { type: 'time', value: src.start });
    const end = h('input', { type: 'time', value: src.end });
    const memo = h('textarea', { rows: 3, placeholder: '장소, 준비물, 메모 등', value: src.memo || '' });
    const room = h('input', { type: 'text', value: src.room || '', placeholder: '예: 과학실 (이 날짜에만 적용)', maxLength: 40 });
    const checkable = h('input', { type: 'checkbox', checked: src.checkable !== false });
    let color = src.color || COLORS[0];
    const swatches = h('div', { class: 'swatches' });
    const customPicker = h('input', { type: 'color', value: color, class: 'event-color-picker', 'aria-label': '원하는 일정 색상 선택', onchange: () => { color = customPicker.value; drawSw(); } });
    const favoriteBox = h('div', { class: 'event-color-favorites' });
    const drawSw = () => {
      swatches.replaceChildren(...COLORS.map((c) => h('button', { type: 'button', class: 'sw' + (c === color ? ' on' : ''), style: { background: c }, 'aria-label': '색상 선택',
        onclick: () => { color = c; customPicker.value = c; drawSw(); } })));
      favoriteBox.replaceChildren(...savedColors().map((c) => h('button', { type: 'button', class: 'sw' + (c === color ? ' on' : ''), style: { background: c }, title: `저장 색상 ${c}`,
        onclick: () => { color = c; customPicker.value = c; drawSw(); } })));
    };
    const favoriteAdd = h('button', { type: 'button', class: 'btn ghost', onclick: () => { saveFavoriteColor(color); drawSw(); App.toast('색상을 저장했어요. (최대 5개)'); } }, '현재 색상 저장');
    drawSw();

    const rep = src.repeat || {};
    const rDays = new Set(rep.days && rep.days.length ? rep.days : [parseDate(src.date).getDay()]);
    const typeSel = h('select', { 'aria-label': '반복' }, REPEATS.map(([v, l]) => h('option', { value: v, selected: v === (rep.type || '') }, l)));
    const dayBox = h('div', { class: 'chips wd' });
    const drawDays = () => dayBox.replaceChildren(...[...WEEK].map((w, i) => h('button', { type: 'button', class: 'fchip' + (rDays.has(i) ? ' on' : ''),
      onclick: () => { if (rDays.has(i)) rDays.delete(i); else rDays.add(i); drawDays(); } }, w)));
    drawDays();
    const until = h('input', { type: 'date', value: rep.until || '', min: `${MIN_Y}-01-01`, max: `${MAX_Y}-12-31` });
    const weekdays = h('button', { class: 'btn ghost', type: 'button', onclick: () => {
      rDays.clear(); [1, 2, 3, 4, 5].forEach((d) => rDays.add(d)); drawDays();
    } }, '평일 선택');
    const allDays = h('button', { class: 'btn ghost', type: 'button', onclick: () => {
      rDays.clear(); [0, 1, 2, 3, 4, 5, 6].forEach((d) => rDays.add(d)); drawDays();
    } }, '전체 선택');
    const dayField = App.field('반복할 요일 선택', h('div', null, dayBox, h('div', { class: 'tt-repeat-presets' }, weekdays, allDays)),
      '여러 요일을 선택할 수 있어요. 예: 월·수·금');
    const untilField = App.field('반복 끝 날짜 (선택)', until);
    const dateField = App.field('날짜', date);
    const syncRep = () => {
      const t = typeSel.value;
      dayField.hidden = t !== 'weekly';
      untilField.hidden = !t;
      dateField.querySelector('span').textContent = t ? '시작 날짜' : '날짜';
      dateMode.disabled = !!t;
      rangeField.hidden = !!t || dateMode.value !== 'range';
      manyField.hidden = !!t || dateMode.value !== 'many';
      dateField.hidden = !t && dateMode.value === 'many';
    };
    typeSel.addEventListener('change', syncRep);
    dateMode.addEventListener('change', syncRep);
    syncRep();

    const m = App.modal({
      title: isNew ? '일정 추가' : '일정 수정',
      body: [
        App.field('제목', title),
        dateField,
        App.field('날짜 선택', dateMode), rangeField, manyField,
        h('div', { class: 'row2' }, App.field('시작', start), App.field('끝', end)),
        App.field('반복 (학원 등)', typeSel),
        dayField,
        untilField,
        App.field('메모 (선택)', memo),
        src.schoolLesson ? App.field('이 날의 교실 (선택)', room) : null,
        h('label', { class: 'check' }, checkable, '완료 체크박스 사용'),
        h('div', { class: 'field' }, h('span', null, '색상'), swatches,
          h('div', { class: 'event-custom-colors' }, customPicker, favoriteAdd),
          h('span', { class: 'hint' }, '저장한 색상 (최대 5개)'), favoriteBox),
        !isNew && src.repeat ? h('p', { class: 'hint' }, '반복 일정을 고치면 모든 날짜에 적용돼요.') : null,
      ],
      footer: [
        !isNew ? h('button', { class: 'btn danger', type: 'button', onclick: () => removeEvent(ev, after, m.close) }, '삭제') : null,
        h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, '취소'),
        h('button', { class: 'btn primary', type: 'button', onclick: submit }, '저장'),
      ],
    });
    function submit() {
      const t = title.value.trim();
      if (!t) { App.toast('제목을 입력해 주세요.'); title.focus(); return; }
      if (dateMode.value !== 'many' && !date.value || dateMode.value === 'many' && !selectedDates.size) { App.toast('날짜를 선택해 주세요.'); return; }
      if (!typeSel.value && dateMode.value === 'range' && (!dateEnd.value || dateEnd.value < date.value)) return App.toast('마지막 날짜를 확인해 주세요.');
      if (!start.value) { App.toast('시작 시간을 선택해 주세요.'); return; }
      if (typeSel.value === 'weekly' && rDays.size === 0) { App.toast('반복할 요일을 하나 이상 선택해 주세요.'); return; }
      if (typeSel.value && until.value && until.value < date.value) { App.toast('반복 끝 날짜가 시작 날짜보다 빨라요.'); return; }
      let e = end.value || start.value;
      if (e < start.value) e = start.value;
      const rec = { ...(base || {}), id: src.id || uid(), date: dateMode.value === 'many' && !typeSel.value ? [...selectedDates].sort()[0] : date.value, start: start.value, end: e, title: t, memo: memo.value.trim(), room: src.schoolLesson ? room.value.trim() : src.room || '', color, checkable: checkable.checked };
      if (typeSel.value) {
        const days = typeSel.value === 'weekly' ? [...rDays].sort((a, b) => a - b) : [];
        rec.repeat = { type: typeSel.value, days: typeSel.value === 'weekly' && !days.length ? [parseDate(rec.date).getDay()] : days, until: until.value };
        if (!base || !base.repeat) { rec.doneDates = rec.done ? [rec.date] : []; delete rec.done; }
      } else {
        if (base && base.repeat) rec.done = false;
        delete rec.repeat; delete rec.skip; delete rec.doneDates;
        rec.dateEnd = dateMode.value === 'range' ? dateEnd.value : '';
        rec.dates = dateMode.value === 'many' ? [...selectedDates].sort() : [];
        if (rec.dateEnd || rec.dates.length) {
          rec.doneDates = base?.doneDates || (base?.done ? [base.date] : []);
          delete rec.done;
        }
      }
      if (typeSel.value) { delete rec.dateEnd; delete rec.dates; }
      const list = events().filter((x) => x.id !== rec.id);
      list.push(rec);
      saveEvents(list);
      m.close();
      after();
    }
    setTimeout(() => title.focus(), 50);
  }

  // ---------- 일정 자세히 보기 ----------
  function showEvent(ev, after) {
    if (ev.examLesson) {
      const m = App.modal({ title: ev.displayTitle || ev.title, body: h('div', { class: 'ev-detail' },
        h('p', null, `${ev.date} · ${ev.period}교시 · ${range(ev)}`),
        ev.room ? h('p', null, `교실: ${ev.room}`) : null),
        footer: [h('button', { class: 'btn primary', type: 'button', onclick: () => { m.close(); manageExams(after); } }, '시험 시간표 수정')] });
      return;
    }
    const d = parseDate(ev.date);
    const mins = toMin(ev.end) - toMin(ev.start);
    const spent = window.Timer ? Timer.spent(ev.id, ev.date) : 0;
    const chk = h('input', { type: 'checkbox', checked: !!ev.done, onchange: () => { ev.done = chk.checked; setDone(ev.id, ev.date, chk.checked); after(); } });
    const m = App.modal({
      title: ev.title,
      body: h('div', { class: 'ev-detail', style: { '--c': ev.color } },
        h('div', { class: 'ed-row' }, h('i', { class: 'ed-dot' }), h('b', null, longDate(d))),
        h('div', { class: 'ed-row' }, h('span', { class: 'ed-k' }, '시간'), h('span', null, range(ev) + (mins > 0 ? ` (${fmtMin(mins)})` : ''))),
        ev.room ? h('div', { class: 'ed-row' }, h('span', { class: 'ed-k' }, '교실'), h('span', null, ev.room)) : null,
        ev.rep ? h('div', { class: 'ed-row' }, h('span', { class: 'ed-k' }, '반복'), h('span', null, repDesc(ev))) : null,
        spent ? h('div', { class: 'ed-row' }, h('span', { class: 'ed-k' }, '공부'), h('span', null, `타이머로 ${fmtMin(spent)} 했어요`)) : null,
        h('div', { class: 'ed-row top' }, h('span', { class: 'ed-k' }, '메모'),
          ev.memo ? h('p', { class: 'ed-memo' }, ev.memo) : h('p', { class: 'muted' }, '적어 둔 메모가 없어요.')),
        ev.checkable !== false ? h('label', { class: 'check ed-done' }, chk, '완료했어요') : null),
      footer: [
        h('button', { class: 'btn danger', type: 'button', onclick: () => removeEvent(ev, after, m.close) }, '삭제'),

        h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, '닫기'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => { m.close(); editEvent(ev, after); } }, '수정'),
      ],
    });
  }

  // ---------- 시간표형 보기(주간·하루) : 일정 없는 시간대는 접는다 ----------
  function timeline(days, o, redraw) {
    const hourPx = matchMedia('(max-width: 640px)').matches ? 38 : HP;
    const today = todayStr();
    const per = days.map((d) => layout(byDate(dateStr(d))));
    const used = new Set();
    per.flat().forEach((x) => {
      const sh = Math.floor(x.s / 60);
      const eh = Math.min(23, Math.max(sh, Math.ceil(x.f / 60) - 1));
      for (let k = sh; k <= eh; k++) used.add(k);
    });
    if (!used.size) for (let k = 8; k < 20; k++) used.add(k);

    const segs = [];
    for (let k = 0; k < 24;) {
      const u = used.has(k);
      let j = k;
      while (j < 24 && used.has(j) === u) j++;
      segs.push({ a: k, b: j, gap: !u && collapse && j - k >= 2 && !opened.has(k) });
      k = j;
    }

    const root = h('div', { class: 'tl', style: { '--n': days.length } });
    if (o.head) {
      root.append(h('div', { class: 'tl-row tl-head' }, h('div', { class: 'tl-corner' }),
        days.map((d) => h('button', { type: 'button', class: 'tl-dh' + (dateStr(d) === today ? ' today' : '') + (d.getDay() === 0 ? ' sun' : '') + (d.getDay() === 6 ? ' sat' : ''),
          onclick: () => { focus = d; mode = 'day'; opened.clear(); draw(); } }, h('span', null, WEEK[d.getDay()]), h('b', null, d.getDate())))));
      root.append(h('div', { class: 'week-lesson-toggle' },
        h('button', { class: 'btn ghost', type: 'button', 'aria-expanded': String(weekLessonsVisible()), onclick: () => {
          Store.set('weekLessonsVisible', !weekLessonsVisible());
          redraw();
        } }, weekLessonsVisible() ? '수업 목록 접기 ⌃' : '수업 목록 펼치기 ⌄')));
      if (weekLessonsVisible()) root.append(h('div', { class: 'tl-row tl-lessons' }, h('div', { class: 'tl-corner' }, '수업'),
        days.map((d) => h('div', { class: 'tl-lcell' }, Timetable.lessonsFor(d).map((l) => h('button', { class: 'chip', type: 'button', style: { '--c': colorFor(l.subject) }, title: l.teacher ? `${l.displayTitle} · ${l.teacher}` : l.displayTitle, onclick: () => showEvent(l, redraw) }, `${l.period} ${l.displayTitle}`))))));
      root.append(h('div', { class: 'tl-row tl-week-notes' }, h('div', { class: 'tl-corner' }, '메모'),
        days.map((d) => h('div', { class: 'tl-lcell' },
          h('button', { class: 'btn ghost', type: 'button', onclick: () => {
            const ds = dateStr(d), notes = Notes.forDate(ds);
            App.modal({ title: `${ds} 메모`, body: notes.length ? h('div', { class: 'nt-completed' }, notes.map((n) => h('button', { class: 'btn ghost', style: { background: n.color || '#fff4b8' }, type: 'button', onclick: () => Notes.show(n, redraw) }, n.title || n.body))) : h('p', { class: 'muted' }, '이 날의 메모가 없어요.'),
              footer: [h('button', { class: 'btn primary', type: 'button', onclick: () => Notes.openForDate(ds, redraw) }, '＋ 메모')] });
          } }, `메모 ${Notes.forDate(dateStr(d)).length}`)))));
    }

    segs.forEach((sg) => {
      if (sg.gap) {
        root.append(h('button', { type: 'button', class: 'tl-gap', onclick: () => { opened.add(sg.a); redraw(); } },
          `${pad(sg.a)}:00 ~ ${pad(sg.b)}:00 · 일정 없음 · 눌러서 펼치기`));
        return;
      }
      const labels = h('div', { class: 'tl-times' }, Array.from({ length: sg.b - sg.a }, (_, i) => h('div', { class: 'tl-t', style: { height: hourPx + 'px' } }, `${pad(sg.a + i)}:00`)));
      const cols = days.map((d, ci) => {
        const ds = dateStr(d);
        const col = h('div', { class: 'tl-col' + (ds === today ? ' today' : ''), style: { height: (sg.b - sg.a) * hourPx + 'px' },
          onclick: (e) => {
            if (e.target !== col) return;
            const hr = Math.min(sg.b - 1, sg.a + Math.floor((e.clientY - col.getBoundingClientRect().top) / hourPx));
            editEvent(blank(ds, hr), redraw);
          } });
        per[ci].filter((x) => { const sh = Math.floor(x.s / 60); return sh >= sg.a && sh < sg.b; }).forEach((x) => {
          const hgt = Math.max(22, (x.f - x.s) / 60 * hourPx - 2);
          const open = () => showEvent(x.e, redraw);
          col.append(h('div', { role: 'button', tabIndex: 0, class: 'tl-ev' + (o.big ? ' big' : '') + (x.e.done ? ' done' : ''),
            style: { '--c': x.e.color, top: (x.s - sg.a * 60) / 60 * hourPx + 'px', height: hgt + 'px', left: `calc(${x.lane / x.n * 100}% + 1px)`, width: `calc(${100 / x.n}% - 3px)` },
            title: `${range(x.e)} ${x.e.title}`, onclick: open, onkeydown: (e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(); } } },
          ckBtn(x.e, redraw, true),
          h('b', null, x.e.schoolLesson ? `수업 · ${x.e.title}` : x.e.rep ? `↻ ${x.e.title}` : x.e.title), h('small', null, range(x.e)),
          o.big && x.e.memo && hgt >= 70 ? h('em', null, x.e.memo) : null));
        });
        return col;
      });
      root.append(h('div', { class: 'tl-seg' }, labels, cols));
    });
    return root;
  }

  // ---------- 하루 원 그래프 (방학 생활계획표처럼) ----------
  function pie(d, redraw) {
    const ds = dateStr(d);
    const evs = layout(byDate(ds).filter((e) => !e.schoolLesson && !e.sourceBreak));
    const C = 210; const R = 168; const r = 80;
    const L = Math.min(4, Math.max(1, ...evs.map((x) => x.lane + 1)));
    const w = (R - r) / L;
    const ang = (min) => min / 1440 * Math.PI * 2 - Math.PI / 2;
    const P = (rad, a) => [C + rad * Math.cos(a), C + rad * Math.sin(a)];
    const f = (n) => n.toFixed(2);
    const arc = (a0, a1, ro, ri) => {
      if (a1 - a0 >= Math.PI * 2 - 0.002) a1 = a0 + Math.PI * 2 - 0.002;
      const big = a1 - a0 > Math.PI ? 1 : 0;
      const [x0, y0] = P(ro, a0); const [x1, y1] = P(ro, a1); const [x2, y2] = P(ri, a1); const [x3, y3] = P(ri, a0);
      return `M${f(x0)} ${f(y0)}A${ro} ${ro} 0 ${big} 1 ${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}A${ri} ${ri} 0 ${big} 0 ${f(x3)} ${f(y3)}Z`;
    };

    const svg = sv('svg', { viewBox: '0 0 420 420', class: 'pie-svg', role: 'img', 'aria-label': `${longDate(d)} 하루 일정 원 그래프` });
    svg.append(sv('circle', { cx: C, cy: C, r: (R + r) / 2, fill: 'none', stroke: '#eef2fb', 'stroke-width': R - r }));
    for (let k = 0; k < 24; k++) {
      const a = ang(k * 60);
      const [x0, y0] = P(r, a); const [x1, y1] = P(R, a);
      svg.append(sv('line', { x1: f(x0), y1: f(y0), x2: f(x1), y2: f(y1), stroke: k % 6 === 0 ? '#c9d4ee' : '#fff', 'stroke-width': k % 6 === 0 ? 2 : 1.5 }));
    }
    for (let k = 0; k < 24; k += 3) {
      const [x, y] = P(R + 17, ang(k * 60));
      svg.append(sv('text', { x: f(x), y: f(y), class: 'pie-hr', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, `${k}시`));
    }

    evs.forEach((x) => {
      const lane = Math.min(x.lane, L - 1);
      const ro = R - lane * w;
      const ri = ro - w + (L > 1 ? 1.5 : 0);
      const a0 = ang(x.s); const a1 = ang(x.f);
      svg.append(sv('path', { d: arc(a0, a1, ro, ri), fill: x.e.color, 'fill-opacity': x.e.done ? 0.38 : 1, stroke: '#fff', 'stroke-width': 2, class: 'pie-sec', tabindex: 0, role: 'button', 'aria-label': `${range(x.e)} ${x.e.title}${x.e.done ? ' (완료)' : ''}`,
        onclick: () => showEvent(x.e, redraw), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showEvent(x.e, redraw); } } },
      sv('title', null, `${range(x.e)} ${x.e.title}`)));
    });
    // 글자는 조각 위에서 바깥 방향으로 쓴다
    evs.forEach((x) => {
      const lane = Math.min(x.lane, L - 1);
      const ro = R - lane * w;
      const ri = ro - w;
      const rm = (ro + ri) / 2;
      const arcLength = (ang(x.f) - ang(x.s)) * rm;
      const fs = Math.max(8, Math.min(L > 1 ? 11 : 14, Math.floor(arcLength / 2.4)));
      const mid = (ang(x.s) + ang(x.f)) / 2;
      if ((ang(x.f) - ang(x.s)) * rm < fs + 4) return;
      const max = Math.max(1, Math.floor((ro - ri - 6) / fs));
      const t = x.e.title.length > max ? x.e.title.slice(0, Math.max(1, max - 1)) + '…' : x.e.title;
      const [tx, ty] = P(rm, mid);
      let deg = mid * 180 / Math.PI;
      if (Math.cos(mid) < 0) deg += 180;
      svg.append(sv('text', { class: 'pie-lbl', transform: `translate(${f(tx)} ${f(ty)}) rotate(${f(deg)})`, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': fs, stroke: x.e.color, opacity: x.e.done ? 0.7 : 1 }, t));
    });

    if (ds === todayStr()) {
      const n = new Date();
      const a = ang(n.getHours() * 60 + n.getMinutes());
      const [x0, y0] = P(r - 8, a); const [x1, y1] = P(R + 4, a);
      svg.append(sv('line', { x1: f(x0), y1: f(y0), x2: f(x1), y2: f(y1), class: 'pie-now' }));
      svg.append(sv('circle', { cx: f(x0), cy: f(y0), r: 5, class: 'pie-now-dot' }));
    }

    const doneN = evs.filter((x) => x.e.checkable !== false && x.e.done).length;
    svg.append(
      sv('text', { x: C, y: C - 14, class: 'pie-c1', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, `${d.getMonth() + 1}월 ${d.getDate()}일`),
      sv('text', { x: C, y: C + 14, class: 'pie-c2', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, ds === todayStr() ? `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}` : `${WEEK[d.getDay()]}요일`),
      sv('text', { x: C, y: C + 36, class: 'pie-c3', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, evs.length ? `일정 ${evs.length}개 · 완료 ${doneN}` : '일정 없음'));
    return svg;
  }

  // 가로로 긴 홈 북마크에서는 24시간을 반원에 펼쳐 표시한다.
  function semiPie(d, redraw) {
    const ds = dateStr(d), evs = layout(byDate(ds).filter((e) => !e.schoolLesson && !e.sourceBreak));
    const C = 210, Y = 205, outer = 162, inner = 96;
    const angle = (minutes) => Math.PI + Math.max(0, Math.min(1440, minutes)) / 1440 * Math.PI;
    const point = (radius, a) => [C + radius * Math.cos(a), Y + radius * Math.sin(a)];
    const f = (n) => n.toFixed(2);
    const svg = sv('svg', { viewBox: '18 0 384 228', class: 'home-semi-svg', role: 'img', 'aria-label': `${longDate(d)} 반원 일정표` });
    const baseRadius = (outer + inner) / 2;
    svg.append(sv('path', { d: `M${C - baseRadius} ${Y} A${baseRadius} ${baseRadius} 0 0 1 ${C + baseRadius} ${Y}`, fill: 'none', stroke: '#edf2fb', 'stroke-width': outer - inner }));
    for (let k = 0; k <= 24; k += 6) {
      const [x, y] = point(outer + 23, angle(k * 60));
      svg.append(sv('text', { x: f(x), y: f(y), class: 'pie-hr', 'text-anchor': 'middle' }, `${k}시`));
    }
    const lanes = Math.min(4, Math.max(1, ...evs.map((x) => x.lane + 1)));
    const band = (outer - inner) / lanes;
    evs.forEach((x) => {
      const ro = outer - Math.min(x.lane, lanes - 1) * band, ri = ro - band + 1;
      const a0 = angle(x.s), a1 = angle(x.f);
      const [x0, y0] = point(ro, a0), [x1, y1] = point(ro, a1), [x2, y2] = point(ri, a1), [x3, y3] = point(ri, a0);
      svg.append(sv('path', { d: `M${f(x0)} ${f(y0)} A${f(ro)} ${f(ro)} 0 0 1 ${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)} A${f(ri)} ${f(ri)} 0 0 0 ${f(x3)} ${f(y3)} Z`,
        fill: x.e.color, class: 'pie-sec', role: 'button', tabindex: 0, 'aria-label': `${range(x.e)} ${x.e.title}`, onclick: () => showEvent(x.e, redraw), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showEvent(x.e, redraw); } } }, sv('title', null, `${range(x.e)} ${x.e.title}`)));
    });
    if (ds === todayStr()) {
      const now = new Date(), a = angle(now.getHours() * 60 + now.getMinutes());
      const [x0, y0] = point(inner - 8, a), [x1, y1] = point(outer + 3, a);
      svg.append(sv('line', { x1: f(x0), y1: f(y0), x2: f(x1), y2: f(y1), class: 'pie-now' }), sv('circle', { cx: f(x1), cy: f(y1), r: 6, class: 'pie-now-dot' }));
      svg.append(sv('text', { x: C, y: Y - 20, class: 'pie-c1', 'text-anchor': 'middle' }, `${pad(now.getHours())}:${pad(now.getMinutes())}`));
    } else svg.append(sv('text', { x: C, y: Y - 20, class: 'pie-c1', 'text-anchor': 'middle' }, `${d.getMonth() + 1}월 ${d.getDate()}일`));
    svg.append(sv('text', { x: C, y: Y + 2, class: 'pie-c3', 'text-anchor': 'middle' }, `${evs.length}개 일정`));
    return svg;
  }

  // ---------- 화면 ----------
  let draw = () => {};

  function render(root) {
    focus = clampDate(focus);
    const panel = h('section', { class: 'panel' });

    const go = (d, m) => { focus = clampDate(d); if (m) mode = m; opened.clear(); draw(); };
    const modeTabs = () => h('div', { class: 'seg', role: 'tablist' },
      [['month', '월간'], ['week', '주간'], ['day', '하루']].map(([k, l]) => h('button', { type: 'button', class: 'seg-btn' + (mode === k ? ' on' : ''),
        onclick: () => { mode = k; opened.clear(); draw(); } }, l)));

    const target = (n) => {
      if (mode === 'month') {
        const t = new Date(focus.getFullYear(), focus.getMonth() + n, 1);
        const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
        return new Date(t.getFullYear(), t.getMonth(), Math.min(focus.getDate(), last));
      }
      return new Date(focus.getFullYear(), focus.getMonth(), focus.getDate() + n * (mode === 'week' ? 7 : 1));
    };
    const canMove = (n) => { const y = target(n).getFullYear(); return y >= MIN_Y && y <= MAX_Y; };
    const unit = () => ({ month: '달', week: '주', day: '날' })[mode];

    const addBtn = () => h('button', { class: 'btn primary', type: 'button', onclick: () => {
      const ds = mode === 'day' ? dateStr(focus) : todayStr();
      editEvent(blank(ds, ds === todayStr() ? Math.min(23, new Date().getHours()) : 9), draw);
    } }, '＋ 일정');
    const foldBtn = () => {
      const folded = collapse && !opened.size;
      return h('button', { class: 'btn ghost', type: 'button', onclick: () => {
        if (!collapse) collapse = true; else if (opened.size) opened.clear(); else collapse = false;
        draw();
      } }, folded ? '빈 시간 펼치기' : '빈 시간 접기');
    };
    const pieOpen = () => Store.get('calPieOpen', true) !== false;
    const pieBtn = () => h('button', { class: 'btn ghost pie-toggle', type: 'button', 'aria-expanded': pieOpen(), onclick: () => { Store.set('calPieOpen', !pieOpen()); draw(); } }, pieOpen() ? '접기' : '펼치기');
    const head = (label, ...extra) => h('div', { class: 'cal-head' },
      h('div', { class: 'cal-nav' },
        modeTabs(),
        h('button', { class: 'btn', type: 'button', disabled: !canMove(-1), onclick: () => go(target(-1)), 'aria-label': `이전 ${unit()}` }, '◀'),
        label,
        h('button', { class: 'btn', type: 'button', disabled: !canMove(1), onclick: () => go(target(1)), 'aria-label': `다음 ${unit()}` }, '▶'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => go(new Date()) }, mode === 'month' ? '이번 달' : mode === 'week' ? '이번 주' : '오늘')),
      h('div', { class: 'cal-act' }, h('button', { class: 'btn', type: 'button', onclick: () => manageExams(draw) }, '시험기간'), addBtn(), ...extra));

    const drawMonth = () => {
      const y = focus.getFullYear(); const mo = focus.getMonth();
      const first = new Date(y, mo, 1);
      const days = new Date(y, mo + 1, 0).getDate();
      const lead = first.getDay();
      const today = todayStr();
      const setYM = (ny, nm) => { const last = new Date(ny, nm + 1, 0).getDate(); go(new Date(ny, nm, Math.min(focus.getDate(), last))); };
      const yearSel = h('select', { 'aria-label': '연도', onchange: (e) => setYM(Number(e.target.value), mo) },
        Array.from({ length: MAX_Y - MIN_Y + 1 }, (_, i) => MIN_Y + i).map((v) => h('option', { value: v, selected: v === y }, `${v}년`)));
      const monthSel = h('select', { 'aria-label': '월', onchange: (e) => setYM(y, Number(e.target.value)) },
        Array.from({ length: 12 }, (_, i) => h('option', { value: i, selected: i === mo }, `${i + 1}월`)));

      const cells = [];
      for (let i = 0; i < lead; i++) cells.push(h('div', { class: 'day empty' }));
      for (let dd = 1; dd <= days; dd++) {
        const ds = `${y}-${pad(mo + 1)}-${pad(dd)}`;
        const wd = (lead + dd - 1) % 7;
        const evs = byDate(ds);
        const open = () => go(new Date(y, mo, dd), 'day');
        cells.push(h('div', { class: 'day' + (ds === today ? ' today' : '') + (wd === 0 ? ' sun' : '') + (wd === 6 ? ' sat' : ''), role: 'button', tabIndex: 0,
          'aria-label': `${mo + 1}월 ${dd}일 자세히 보기`, onclick: open, onkeydown: (e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(); } } },
        h('span', { class: 'num' }, dd),
        h('span', { class: 'evs' },
          evs.slice(0, 3).map((e) => h('span', { class: 'mini' + (e.done ? ' done' : ''), style: { '--c': e.color }, title: `${range(e)} ${e.title}`,
            onclick: (ev) => { ev.stopPropagation(); showEvent(e, draw); } }, ckBtn(e, draw, true), h('span', { class: 'mt' }, e.title))),
          evs.length > 3 ? h('span', { class: 'more' }, `+${evs.length - 3}`) : null),
        evs.length ? h('span', { class: 'dots' }, evs.slice(0, 4).map((e) => h('i', { style: { background: e.color, opacity: e.done ? 0.35 : 1 } }))) : null));
      }
      panel.replaceChildren(
        h('h1', { class: 'page-title' }, '일정 관리'),
        head(h('span', { class: 'ym' }, yearSel, monthSel)),
        h('div', { class: 'cal-grid' },
          [...WEEK].map((w, i) => h('div', { class: 'dow' + (i === 0 ? ' sun' : '') + (i === 6 ? ' sat' : '') }, w)),
          cells));
    };

    const drawWeek = () => {
      const ws = weekStart(focus);
      const days = Array.from({ length: 7 }, (_, i) => new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + i));
      const last = days[6];
      const label = h('b', { class: 'cal-label' }, `${ws.getFullYear()}년 ${ws.getMonth() + 1}월 ${ws.getDate()}일 ~ ${last.getMonth() + 1}월 ${last.getDate()}일`);
      panel.replaceChildren(
        h('h1', { class: 'page-title' }, '일정 관리'),
        head(label, foldBtn()),
        h('div', { class: 'wk-scroll' }, timeline(days, { head: true }, drawWeek)));
    };

    let dayHeightObserver;
    const drawDay = () => {
      const lessons = Timetable.lessonsFor(focus);
      const ds = dateStr(focus);
      const evs = byDate(ds);
      const dayNotes = Notes.forDate(ds);
      const open = pieOpen();
      const label = h('b', { class: 'cal-label' }, longDate(focus));
      const pieEvents = evs.filter((e) => !e.schoolLesson && !e.sourceBreak);
      const legend = pieEvents.length
        ? h('ul', { class: 'pie-legend' }, pieEvents.map((e) => h('li', { class: e.done ? 'done' : '' },
          ckBtn(e, drawDay, true),
          h('button', { type: 'button', class: 'lg-main', style: { '--c': e.color }, onclick: () => showEvent(e, drawDay) },
            h('i', null), h('span', { class: 'lg-t' }, range(e)), h('b', null, e.rep ? `↻ ${e.title}` : e.title)))))
        : null;
      const pieCard = open
        ? h('div', { class: 'pie-card' }, h('div', { class: 'pie-card-head' }, h('b', null, '하루 일정 원 그래프'), pieBtn()), pie(focus, drawDay), legend)
        : h('div', { class: 'pie-card slim' },
          h('span', { class: 'pie-slim-t' }, '하루 일정 원 그래프'), pieBtn());
      dayHeightObserver?.disconnect();
      const dayLayout = h('div', { class: 'day-layout' + (open ? '' : ' folded') },
        pieCard,
        h('div', { class: 'day-side' },
          Timer.totalForDate(ds) ? h('p', { class: 'day-study-time' }, `이 날 기록한 공부 시간 · ${Timer.totalForDate(ds)}분`) : null,
          lessons.length ? h('div', { class: 'day-lessons' }, h('b', null, '수업 '), lessons.map((l) => h('button', { class: 'chip', type: 'button', style: { '--c': colorFor(l.subject) }, title: l.teacher || '', onclick: () => showEvent(l, drawDay) }, `${l.period} ${l.displayTitle}`))) : null,
          h('section', { class: 'cal-day-notes' },
            h('div', { class: 'title-row' }, h('b', null, '이 날의 메모'), h('button', { class: 'btn ghost', type: 'button', onclick: () => Notes.openForDate(ds, drawDay) }, '＋ 메모')),
            dayNotes.length ? dayNotes.map((n) => h('button', { class: 'cal-note', type: 'button', style: { '--c': n.color }, onclick: () => Notes.show(n, drawDay) },
              h('b', null, n.title || '제목 없음'), h('span', null, n.body || ''))) : h('p', { class: 'muted' }, '시간이 정해지지 않은 메모가 없어요.')),
          timeline([focus], { big: true }, drawDay)));
      panel.replaceChildren(
        h('h1', { class: 'page-title' }, '일정 관리'),
        head(label, foldBtn()),
        dayLayout);
      if (open) {
        dayHeightObserver = new ResizeObserver(() => {
          if (dayLayout.isConnected) dayLayout.style.setProperty('--day-pie-height', `${pieCard.getBoundingClientRect().height}px`);
          else dayHeightObserver?.disconnect();
        });
        dayHeightObserver.observe(pieCard);
      }
    };

    draw = () => { (mode === 'week' ? drawWeek : mode === 'day' ? drawDay : drawMonth)(); };
    draw();
    root.append(panel, SchoolData.tools('calendar'));
  }

  return { render, byDate, eventsFrom, setDone, isDone, repDesc, showEvent, examForDate, examLessonsFor, nextExam, manageExams, homePie: (date) => pie(date || new Date(), () => App.refresh()), homeSemi: (date) => semiPie(date || new Date(), () => App.refresh()) };
})();

App.registerView('calendar', { label: '일정 관리', icon: 'calendar', render: Calendar.render });
