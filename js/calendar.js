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
    if (!e.repeat) return e.date === ds;
    if (ds < e.date || (e.repeat.until && ds > e.repeat.until) || (e.skip || []).includes(ds)) return false;
    const base = parseDate(e.date);
    const d = parseDate(ds);
    if (e.repeat.type === 'daily') return true;
    if (e.repeat.type === 'weekly') return (e.repeat.days && e.repeat.days.length ? e.repeat.days : [base.getDay()]).includes(d.getDay());
    if (e.repeat.type === 'monthly') return Math.min(base.getDate(), new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()) === d.getDate();
    return false;
  }
  const isDone = (e, ds) => (e.repeat ? (e.doneDates || []).includes(ds) : !!e.done);
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
    if (e.repeat) {
      const s = new Set(e.doneDates || []);
      if (val) s.add(ds); else s.delete(ds);
      e.doneDates = [...s];
    } else e.done = !!val;
    saveEvents(list);
  }

  const byDate = (ds) => [...events().filter((e) => occursOn(e, ds)).map((e) => occ(e, ds)),
    ...Timetable.calendarLessons(parseDate(ds)).map((e) => ({ ...e, memo: getLessonNote(e) }))].sort(sortFn);

  // 오늘 이후 일정(반복 포함, 약 반년 치)
  function eventsFrom(ds, limit, opts) {
    const hideDone = opts && opts.hideDone;
    const out = [];
    const list = events();
    list.filter((e) => !e.repeat && e.date >= ds).forEach((e) => out.push(occ(e, e.date)));
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
  const ckBtn = (ev, redraw, small) => ev.schoolLesson ? null : h('button', { type: 'button', class: 'ck' + (ev.done ? ' on' : '') + (small ? ' sm' : ''), role: 'checkbox', 'aria-checked': String(!!ev.done),
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
    const start = h('input', { type: 'time', value: src.start });
    const end = h('input', { type: 'time', value: src.end });
    const memo = h('textarea', { rows: 3, placeholder: '장소, 준비물, 메모 등', value: src.memo || '' });
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
    };
    typeSel.addEventListener('change', syncRep);
    syncRep();

    const m = App.modal({
      title: isNew ? '일정 추가' : '일정 수정',
      body: [
        App.field('제목', title),
        dateField,
        h('div', { class: 'row2' }, App.field('시작', start), App.field('끝', end)),
        App.field('반복 (학원 등)', typeSel),
        dayField,
        untilField,
        App.field('메모 (선택)', memo),
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
      if (!date.value) { App.toast('날짜를 선택해 주세요.'); return; }
      if (!start.value) { App.toast('시작 시간을 선택해 주세요.'); return; }
      if (typeSel.value === 'weekly' && rDays.size === 0) { App.toast('반복할 요일을 하나 이상 선택해 주세요.'); return; }
      if (typeSel.value && until.value && until.value < date.value) { App.toast('반복 끝 날짜가 시작 날짜보다 빨라요.'); return; }
      let e = end.value || start.value;
      if (e < start.value) e = start.value;
      const rec = { ...(base || {}), id: src.id || uid(), date: date.value, start: start.value, end: e, title: t, memo: memo.value.trim(), color };
      if (typeSel.value) {
        const days = typeSel.value === 'weekly' ? [...rDays].sort((a, b) => a - b) : [];
        rec.repeat = { type: typeSel.value, days: typeSel.value === 'weekly' && !days.length ? [parseDate(rec.date).getDay()] : days, until: until.value };
        if (!base || !base.repeat) { rec.doneDates = rec.done ? [rec.date] : []; delete rec.done; }
      } else {
        if (base && base.repeat) rec.done = false;
        delete rec.repeat; delete rec.skip; delete rec.doneDates;
      }
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
    if (ev.schoolLesson) {
      const note = h('textarea', { rows: 5, placeholder: '이 날짜의 수업에 대한 준비물, 과제, 메모 등을 기록하세요.', value: getLessonNote(ev) });
      const m = App.modal({ title: ev.title,
        body: h('div', { class: 'ev-detail', style: { '--c': ev.color } },
          h('p', null, `${ev.date} · ${ev.start} ~ ${ev.end}`),
          ev.teacher ? h('p', null, `선생님: ${ev.teacher}`) : null,
          App.field('이 날 수업 메모', note)),
        footer: [
          h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, '닫기'),
          h('button', { class: 'btn primary', type: 'button', onclick: () => {
            saveLessonNote(ev, note.value); m.close(); after(); App.toast('수업 메모를 저장했어요.');
          } }, '메모 저장')],
      });
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
        ev.rep ? h('div', { class: 'ed-row' }, h('span', { class: 'ed-k' }, '반복'), h('span', null, repDesc(ev))) : null,
        spent ? h('div', { class: 'ed-row' }, h('span', { class: 'ed-k' }, '공부'), h('span', null, `타이머로 ${fmtMin(spent)} 했어요`)) : null,
        h('div', { class: 'ed-row top' }, h('span', { class: 'ed-k' }, '메모'),
          ev.memo ? h('p', { class: 'ed-memo' }, ev.memo) : h('p', { class: 'muted' }, '적어 둔 메모가 없어요.')),
        h('label', { class: 'check ed-done' }, chk, '완료했어요')),
      footer: [
        h('button', { class: 'btn danger', type: 'button', onclick: () => removeEvent(ev, after, m.close) }, '삭제'),

        h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, '닫기'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => { m.close(); editEvent(ev, after); } }, '수정'),
      ],
    });
  }

  // ---------- 시간표형 보기(주간·하루) : 일정 없는 시간대는 접는다 ----------
  function timeline(days, o, redraw) {
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
        days.map((d) => h('div', { class: 'tl-lcell' }, Timetable.lessonsFor(d).map((l) => h('span', { class: 'chip', style: { '--c': colorFor(l.subject) }, title: l.teacher ? `${l.subject} · ${l.teacher}` : l.subject }, `${l.period} ${l.subject}`))))));
    }

    segs.forEach((sg) => {
      if (sg.gap) {
        root.append(h('button', { type: 'button', class: 'tl-gap', onclick: () => { opened.add(sg.a); redraw(); } },
          `${pad(sg.a)}:00 ~ ${pad(sg.b)}:00 · 일정 없음 · 눌러서 펼치기`));
        return;
      }
      const labels = h('div', { class: 'tl-times' }, Array.from({ length: sg.b - sg.a }, (_, i) => h('div', { class: 'tl-t', style: { height: HP + 'px' } }, `${pad(sg.a + i)}:00`)));
      const cols = days.map((d, ci) => {
        const ds = dateStr(d);
        const col = h('div', { class: 'tl-col' + (ds === today ? ' today' : ''), style: { height: (sg.b - sg.a) * HP + 'px' },
          onclick: (e) => {
            if (e.target !== col) return;
            const hr = Math.min(sg.b - 1, sg.a + Math.floor((e.clientY - col.getBoundingClientRect().top) / HP));
            editEvent(blank(ds, hr), redraw);
          } });
        per[ci].filter((x) => { const sh = Math.floor(x.s / 60); return sh >= sg.a && sh < sg.b; }).forEach((x) => {
          const hgt = Math.max(22, (x.f - x.s) / 60 * HP - 2);
          const open = () => showEvent(x.e, redraw);
          col.append(h('div', { role: 'button', tabIndex: 0, class: 'tl-ev' + (o.big ? ' big' : '') + (x.e.done ? ' done' : ''),
            style: { '--c': x.e.color, top: (x.s - sg.a * 60) / 60 * HP + 'px', height: hgt + 'px', left: `calc(${x.lane / x.n * 100}% + 1px)`, width: `calc(${100 / x.n}% - 3px)` },
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
    const evs = layout(byDate(ds));
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
      const fs = L > 1 ? 11 : 13;
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

    const doneN = evs.filter((x) => x.e.done).length;
    svg.append(
      sv('text', { x: C, y: C - 14, class: 'pie-c1', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, `${d.getMonth() + 1}월 ${d.getDate()}일`),
      sv('text', { x: C, y: C + 14, class: 'pie-c2', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, `${WEEK[d.getDay()]}요일`),
      sv('text', { x: C, y: C + 36, class: 'pie-c3', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, evs.length ? `일정 ${evs.length}개 · 완료 ${doneN}` : '일정 없음'));
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
    const unit = { month: '달', week: '주', day: '날' }[mode];

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
    const pieBtn = () => h('button', { class: 'btn ghost pie-toggle', type: 'button', 'aria-expanded': pieOpen(), onclick: () => { Store.set('calPieOpen', !pieOpen()); draw(); } }, pieOpen() ? '⌃ 접기' : '⌄ 펼치기');
    const head = (label, ...extra) => h('div', { class: 'cal-head' },
      h('div', { class: 'cal-nav' },
        modeTabs(),
        h('button', { class: 'btn', type: 'button', disabled: !canMove(-1), onclick: () => go(target(-1)), 'aria-label': `이전 ${unit}` }, '◀'),
        label,
        h('button', { class: 'btn', type: 'button', disabled: !canMove(1), onclick: () => go(target(1)), 'aria-label': `다음 ${unit}` }, '▶'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => go(new Date()) }, mode === 'month' ? '이번 달' : mode === 'week' ? '이번 주' : '오늘')),
      h('div', { class: 'cal-act' }, addBtn(), ...extra));

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

    const drawDay = () => {
      const lessons = Timetable.lessonsFor(focus);
      const evs = byDate(dateStr(focus));
      const open = pieOpen();
      const label = h('b', { class: 'cal-label' }, longDate(focus));
      const legend = evs.length
        ? h('ul', { class: 'pie-legend' }, evs.map((e) => h('li', { class: e.done ? 'done' : '' },
          ckBtn(e, drawDay, true),
          h('button', { type: 'button', class: 'lg-main', style: { '--c': e.color }, onclick: () => showEvent(e, drawDay) },
            h('i', null), h('span', { class: 'lg-t' }, range(e)), h('b', null, e.rep ? `↻ ${e.title}` : e.title)))))
        : null;
      const pieCard = open
        ? h('div', { class: 'pie-card' }, h('div', { class: 'pie-card-head' }, h('b', null, '하루 일정 원 그래프'), pieBtn()), pie(focus, drawDay), legend)
        : h('div', { class: 'pie-card slim' },
          h('span', { class: 'pie-slim-t' }, '하루 일정 원 그래프'), pieBtn());
      panel.replaceChildren(
        h('h1', { class: 'page-title' }, '일정 관리'),
        head(label, foldBtn()),
        h('div', { class: 'day-layout' + (open ? '' : ' folded') },
          pieCard,
          h('div', { class: 'day-side' },
            lessons.length ? h('div', { class: 'day-lessons' }, h('b', null, '수업 '), lessons.map((l) => h('span', { class: 'chip', style: { '--c': colorFor(l.subject) }, title: l.teacher || '' }, `${l.period} ${l.subject}`))) : null,
            timeline([focus], { big: true }, drawDay))));
    };

    draw = () => { (mode === 'week' ? drawWeek : mode === 'day' ? drawDay : drawMonth)(); };
    draw();
    root.append(panel);
  }

  return { render, byDate, eventsFrom, setDone, isDone, repDesc, homePie: (date) => pie(date || new Date(), () => App.refresh()) };
})();

App.registerView('calendar', { label: '일정 관리', icon: 'calendar', render: Calendar.render });
