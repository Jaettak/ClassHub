// 메모: 자유롭게 적는 일반 메모
const Notes = (() => {
  const COLORS = ['#fff4b8', '#ffd9e2', '#d8ecff', '#d9f5e5', '#e8dcff', '#ffe3c2'];
  let q = '';

  const load = () => Store.get('notes', []);
  const save = (l) => Store.set('notes', l);

  function setDone(id, done, after = () => {}) {
    const list = load();
    const note = list.find((x) => x.id === id);
    if (!note) return;
    note.done = done;
    note.updatedAt = Date.now();
    save(list);
    after();
  }

  function show(n, after = () => {}) {
    const when = n.dates?.length ? n.dates.join(', ') : n.dateEnd ? `${n.date} ~ ${n.dateEnd}` : n.date;
    const m = App.modal({ title: n.title || '메모',
      body: h('div', { class: 'nt-detail' },
        n.body ? h('p', null, n.body) : null,
        when ? h('small', null, `연결된 날짜 · ${when}`) : null,
        n.done ? h('b', null, '완료한 메모') : null),
      footer: [
        h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, '닫기'),
        h('button', { class: 'btn', type: 'button', onclick: () => { m.close(); setDone(n.id, !n.done, after); } }, n.done ? '완료 취소' : '완료 표시'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => { m.close(); edit(n, after); } }, '수정'),
      ] });
  }

  function edit(n, after) {
    const isNew = !n.id;
    const title = h('input', { type: 'text', value: n.title || '', placeholder: '제목 (선택)', maxLength: 60 });
    const body = h('textarea', { rows: 9, placeholder: '메모를 적어 보세요', value: n.body || '' });
    const noteDate = h('input', { type: 'date', value: n.date || '' });
    const endDate = h('input', { type: 'date', value: n.dateEnd || '' });
    const extraDate = h('input', { type: 'date' });
    const selectedDates = new Set(n.dates || []);
    const mode = h('select', { 'aria-label': '날짜 연결 방식' },
      [['none', '날짜 없음'], ['one', '하루'], ['range', '기간'], ['many', '여러 날짜']].map(([value, label]) =>
        h('option', { value, selected: value === (n.dates?.length ? 'many' : n.dateEnd ? 'range' : n.date ? 'one' : 'none') }, label)));
    const dateList = h('div', { class: 'nt-dates' });
    const drawDates = () => dateList.replaceChildren(...[...selectedDates].sort().map((ds) => h('button', { class: 'fchip', type: 'button', 'aria-label': `${ds} 제거`, onclick: () => { selectedDates.delete(ds); drawDates(); } }, `${ds} ×`)));
    const singleField = App.field('날짜', noteDate);
    const endField = App.field('마지막 날짜', endDate);
    const manyField = h('div', { class: 'field' }, h('span', null, '날짜 추가'), h('div', { class: 'set-row' }, extraDate,
      h('button', { class: 'btn', type: 'button', onclick: () => { if (extraDate.value) { selectedDates.add(extraDate.value); extraDate.value = ''; drawDates(); } } }, '＋ 추가')), dateList);
    const drawMode = () => {
      singleField.hidden = !['one', 'range'].includes(mode.value);
      endField.hidden = mode.value !== 'range';
      manyField.hidden = mode.value !== 'many';
    };
    mode.addEventListener('change', drawMode);
    drawDates(); drawMode();
    let color = n.color || COLORS[0];
    let pinned = !!n.pinned;
    const swatches = h('div', { class: 'swatches' });
    const drawSw = () => swatches.replaceChildren(...COLORS.map((c) => h('button', { type: 'button', class: 'sw' + (c === color ? ' on' : ''), style: { background: c }, 'aria-label': '색상 선택',
      onclick: () => { color = c; drawSw(); } })));
    drawSw();
    const pin = h('input', { type: 'checkbox', checked: pinned, onchange: () => { pinned = pin.checked; } });
    const m = App.modal({
      title: isNew ? '새 메모' : '메모 수정',
      body: [App.field('제목', title), App.field('내용', body), App.field('날짜 연결', mode), singleField, endField, manyField, h('div', { class: 'field' }, h('span', null, '색상'), swatches), h('label', { class: 'check' }, pin, '맨 위에 고정')],
      footer: [
        !isNew ? h('button', { class: 'btn danger', type: 'button', onclick: () => {
          if (!confirm('이 메모를 삭제할까요?')) return;
          save(load().filter((x) => x.id !== n.id)); m.close(); after();
        } }, '삭제') : null,
        h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, '취소'),
        h('button', { class: 'btn primary', type: 'button', onclick: submit }, '저장'),
      ],
    });
    function submit() {
      if (!title.value.trim() && !body.value.trim()) { App.toast('내용을 적어 주세요.'); body.focus(); return; }
      if (mode.value === 'one' && !noteDate.value || mode.value === 'range' && (!noteDate.value || !endDate.value || endDate.value < noteDate.value) || mode.value === 'many' && !selectedDates.size)
        return App.toast('연결할 날짜를 확인해 주세요.');
      const rec = { ...n, id: n.id || uid(), title: title.value.trim(), body: body.value.trim(),
        date: ['one', 'range'].includes(mode.value) ? noteDate.value : '', dateEnd: mode.value === 'range' ? endDate.value : '',
        dates: mode.value === 'many' ? [...selectedDates].sort() : [], color, pinned, updatedAt: Date.now() };
      const list = load().filter((x) => x.id !== rec.id);
      list.push(rec);
      save(list);
      m.close();
      after();
    }
    setTimeout(() => (isNew ? body : title).focus(), 50);
  }

  function render(root) {
    const grid = h('div', { class: 'nt-grid' });
    const redraw = () => {
      const all = load();
      const s = q.trim().toLowerCase();
      const sortNotes = (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
        (Number.isFinite(a.sortOrder) && Number.isFinite(b.sortOrder) ? a.sortOrder - b.sortOrder : b.updatedAt - a.updatedAt);
      const list = all.filter((n) => !n.done && (!s || `${n.title} ${n.body}`.toLowerCase().includes(s))).sort(sortNotes);
      const move = (id, targetId) => {
        const ordered = load().sort(sortNotes);
        const from = ordered.findIndex((x) => x.id === id), to = ordered.findIndex((x) => x.id === targetId);
        if (from < 0 || to < 0 || from === to) return;
        const targetPinned = ordered[to].pinned;
        const [item] = ordered.splice(from, 1);
        item.pinned = targetPinned;
        ordered.splice(to, 0, item);
        ordered.forEach((x, i) => { x.sortOrder = i; });
        save(ordered); redraw();
      };
      grid.replaceChildren();
      if (!list.length) {
        grid.append(h('div', { class: 'empty-box' }, all.length ? '표시할 메모가 없어요.' : '아직 메모가 없어요.'));
        return;
      }
      list.forEach((n) => grid.append(h('div', { role: 'button', tabIndex: 0, draggable: true, class: 'nt-card', style: { '--c': n.color },
        onclick: (e) => { if (!e.target.closest('.nt-check')) show(n, redraw); },
        onkeydown: (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) show(n, redraw); },
        ondragstart: (e) => { e.dataTransfer.setData('text/plain', n.id); e.dataTransfer.effectAllowed = 'move'; },
        ondragover: (e) => e.preventDefault(),
        ondrop: (e) => { e.preventDefault(); move(e.dataTransfer.getData('text/plain'), n.id); } },
        h('div', { class: 'nt-top' },
          h('button', { class: 'nt-check', type: 'button', role: 'checkbox', 'aria-checked': 'false', 'aria-label': `${n.title || '메모'} 완료 표시`, onclick: (e) => { e.stopPropagation(); setDone(n.id, true, redraw); } }),
          h('h4', null, n.title || '제목 없음'), n.pinned ? h('span', { class: 'badge' }, '고정') : null),
        n.body ? h('p', null, n.body) : null,
        h('small', null, n.dates?.length ? `${n.dates.length}개 날짜` : n.dateEnd ? `${n.date} ~ ${n.dateEnd}` : n.date ? `일정 ${n.date}` : new Date(n.updatedAt).toLocaleDateString('ko-KR')))));
    };
    function showCompleted() {
      const completed = load().filter((n) => n.done).sort((a, b) => b.updatedAt - a.updatedAt);
      const m = App.modal({ title: '완료한 메모', body: completed.length
        ? h('div', { class: 'nt-completed' }, completed.map((n) => h('button', { class: 'btn ghost', type: 'button', onclick: () => { m.close(); show(n, redraw); } }, n.title || n.body)))
        : h('p', { class: 'muted' }, '완료한 메모가 없어요.') });
    }
    root.append(h('section', { class: 'panel' },
      h('div', { class: 'title-row' },
        h('h1', { class: 'page-title' }, '메모'),
        h('button', { class: 'btn ghost', type: 'button', onclick: showCompleted }, '완료한 메모 보기'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => edit({}, redraw) }, '＋ 새 메모')),
      h('div', { class: 'filters' }, h('input', { type: 'search', placeholder: '메모 검색', value: q, oninput: (e) => { q = e.target.value; redraw(); } })),
      grid));
    redraw();
  }

  return { render, edit, show, forDate: (ds) => load().filter((n) => n.date === ds || (n.date && n.dateEnd && n.date <= ds && ds <= n.dateEnd) || n.dates?.includes(ds)), openForDate: (ds, after) => edit({ date: ds }, after) };
})();

App.registerView('notes', { label: '메모', icon: 'notes', render: Notes.render });
