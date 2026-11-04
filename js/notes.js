// 메모: 자유롭게 적는 일반 메모
const Notes = (() => {
  const COLORS = ['#fff4b8', '#ffd9e2', '#d8ecff', '#d9f5e5', '#e8dcff', '#ffe3c2'];
  let q = '';

  const load = () => Store.get('notes', []);
  const save = (l) => Store.set('notes', l);
  const folders = () => Store.get('noteFolders', []);
  const active = () => load().filter((n) => !n.deletedAt);
  let selectedFolder = '*';

  function trash(id, after = () => {}) {
    const list = load();
    const note = list.find((x) => x.id === id);
    if (!note) return;
    note.deletedAt = Date.now();
    note.updatedAt = note.deletedAt;
    save(list); after();
    App.toast('메모를 휴지통으로 옮겼어요.');
  }

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
        n.folderId ? h('small', null, `보관함 · ${folders().find((f) => f.id === n.folderId)?.name || '기본 보관함'}`) : null),
      footer: [
        h('button', { class: 'btn danger', type: 'button', onclick: () => { m.close(); trash(n.id, after); } }, '휴지통으로 이동'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, '닫기'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => { m.close(); edit(n, after); } }, '수정'),
      ] });
  }

  function edit(n, after) {
    const isNew = !n.id;
    const title = h('input', { type: 'text', value: n.title || '', placeholder: '제목 (선택)', maxLength: 60 });
    const body = h('textarea', { rows: 9, placeholder: '메모를 적어 보세요', value: n.body || '' });
    const folder = h('select', { 'aria-label': '메모 보관함' },
      h('option', { value: '' }, '기본 보관함'),
      folders().map((f) => h('option', { value: f.id, selected: f.id === (n.folderId || (selectedFolder === '*' ? '' : selectedFolder)) }, f.name)));
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
      body: [App.field('제목', title), App.field('내용', body), App.field('보관함', folder), App.field('날짜 연결', mode), singleField, endField, manyField, h('div', { class: 'field' }, h('span', null, '색상'), swatches), h('label', { class: 'check' }, pin, '맨 위에 고정')],
      footer: [
        h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, '취소'),
        h('button', { class: 'btn primary', type: 'button', onclick: submit }, '저장'),
      ],
    });
    function submit() {
      if (!title.value.trim() && !body.value.trim()) { App.toast('내용을 적어 주세요.'); body.focus(); return; }
      if (mode.value === 'one' && !noteDate.value || mode.value === 'range' && (!noteDate.value || !endDate.value || endDate.value < noteDate.value) || mode.value === 'many' && !selectedDates.size)
        return App.toast('연결할 날짜를 확인해 주세요.');
      const rec = { ...n, id: n.id || uid(), title: title.value.trim(), body: body.value.trim(), folderId: folder.value,
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
    let viewMode = Store.get('notesViewMode', 'cards');
    const grid = h('div', { class: 'nt-grid' });
    const folderBar = h('div', { class: 'nt-folders' });
    const redraw = () => {
      grid.classList.toggle('list', viewMode === 'list');
      const all = active();
      const s = q.trim().toLowerCase();
      const sortNotes = (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
        (Number.isFinite(a.sortOrder) && Number.isFinite(b.sortOrder) ? a.sortOrder - b.sortOrder : b.updatedAt - a.updatedAt);
      const list = all.filter((n) => (selectedFolder === '*' || (n.folderId || '') === selectedFolder) &&
        (!s || `${n.title} ${n.body}`.toLowerCase().includes(s))).sort(sortNotes);
      const move = (id, targetId) => {
        const ordered = load().sort(sortNotes);
        const from = ordered.findIndex((x) => x.id === id), to = ordered.findIndex((x) => x.id === targetId);
        if (from < 0 || to < 0 || from === to) return;
        const targetPinned = ordered[to].pinned;
        const [item] = ordered.splice(from, 1);
        item.pinned = targetPinned;
        item.folderId = ordered[to]?.folderId || '';
        ordered.splice(to, 0, item);
        ordered.forEach((x, i) => { x.sortOrder = i; });
        save(ordered); redraw();
      };
      const folderButton = (id, name) => h('button', { class: 'nt-folder' + (selectedFolder === id ? ' on' : ''), type: 'button',
        onclick: () => { selectedFolder = id; redraw(); },
        ondragover: (e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); },
        ondragleave: (e) => e.currentTarget.classList.remove('drag-over'),
        ondrop: (e) => { e.preventDefault(); e.currentTarget.classList.remove('drag-over');
          const noteId = e.dataTransfer.getData('text/plain');
          if (!noteId) return;
          save(load().map((n) => n.id === noteId ? { ...n, folderId: id, updatedAt: Date.now() } : n));
          selectedFolder = id; redraw(); App.toast(`${name}에 넣었어요.`);
        } }, name);
      folderBar.replaceChildren(
        h('button', { class: 'nt-folder' + (selectedFolder === '*' ? ' on' : ''), type: 'button', onclick: () => { selectedFolder = '*'; redraw(); } }, '전체'),
        folderButton('', '기본 보관함'),
        ...folders().map((f) => folderButton(f.id, f.name)),
        ...(selectedFolder && selectedFolder !== '*' ? [h('button', { class: 'nt-folder-manage', type: 'button', onclick: manageFolder }, '보관함 관리')] : []));
      grid.replaceChildren();
      if (!list.length) {
        grid.append(h('div', { class: 'empty-box' }, all.length ? '표시할 메모가 없어요.' : '아직 메모가 없어요.'));
        return;
      }
      list.forEach((n) => {
        const card = h('div', { role: 'button', tabIndex: 0, draggable: true, class: 'nt-card', style: { '--c': n.color },
        onclick: (e) => { if (!e.target.closest('.nt-delete')) show(n, redraw); },
        onkeydown: (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) show(n, redraw); },
        ondragstart: (e) => { e.dataTransfer.setData('text/plain', n.id); e.dataTransfer.effectAllowed = 'move'; },
        ondragover: (e) => e.preventDefault(),
        ondrop: (e) => { e.preventDefault(); move(e.dataTransfer.getData('text/plain'), n.id); } },
        h('div', { class: 'nt-top' },
          h('h4', null, n.title || '제목 없음'), n.pinned ? h('span', { class: 'badge' }, '고정') : null,
          viewMode === 'list' ? null : h('button', { class: 'nt-delete', type: 'button', title: '휴지통으로 이동', 'aria-label': `${n.title || '메모'} 휴지통으로 이동`, onclick: (e) => { e.stopPropagation(); trash(n.id, redraw); } }, '×')),
        n.body ? h('p', null, n.body) : null,
        h('small', null, n.dates?.length ? `${n.dates.length}개 날짜` : n.dateEnd ? `${n.date} ~ ${n.dateEnd}` : n.date ? `일정 ${n.date}` : new Date(n.updatedAt).toLocaleDateString('ko-KR')));
        grid.append(viewMode === 'list' ? h('div', { class: 'nt-list-row' }, card,
          h('button', { class: 'nt-list-delete', type: 'button', title: '휴지통으로 이동', 'aria-label': `${n.title || '메모'} 휴지통으로 이동`, onclick: () => trash(n.id, redraw) }, '×')) : card);
      });
    };
    function addFolder() {
      const name = h('input', { type: 'text', maxLength: 30, placeholder: '보관함 이름' });
      const m = App.modal({ title: '새 메모 보관함', body: App.field('이름', name), footer: [
        h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, '취소'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => {
          if (!name.value.trim()) return App.toast('이름을 입력해 주세요.');
          const id = uid();
          Store.set('noteFolders', [...folders(), { id, name: name.value.trim() }]);
          selectedFolder = id; m.close(); redraw();
        } }, '만들기') ] });
      name.focus();
    }
    function manageFolder() {
      const current = folders().find((f) => f.id === selectedFolder);
      if (!current) return;
      const name = h('input', { type: 'text', value: current.name, maxLength: 30 });
      const m = App.modal({ title: '보관함 관리', body: App.field('이름', name), footer: [
        h('button', { class: 'btn danger', type: 'button', onclick: () => {
          if (!confirm('보관함을 지울까요? 안의 메모는 기본 보관함으로 이동해요.')) return;
          Store.set('noteFolders', folders().filter((f) => f.id !== current.id));
          save(load().map((n) => n.folderId === current.id ? { ...n, folderId: '' } : n));
          selectedFolder = ''; m.close(); redraw();
        } }, '보관함 삭제'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, '취소'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => {
          if (!name.value.trim()) return App.toast('이름을 입력해 주세요.');
          Store.set('noteFolders', folders().map((f) => f.id === current.id ? { ...f, name: name.value.trim() } : f));
          m.close(); redraw();
        } }, '이름 저장') ] });
      name.focus();
    }
    function openTrash() {
      const list = load().filter((n) => n.deletedAt).sort((a, b) => b.deletedAt - a.deletedAt);
      const m = App.modal({ title: '메모 휴지통', body: list.length
        ? h('div', { class: 'nt-trash-list' }, list.map((n) => h('div', { class: 'nt-trash-item' },
          h('span', null, n.title || n.body || '제목 없음'),
          h('button', { class: 'btn ghost', type: 'button', onclick: () => {
            const records = load(); const note = records.find((x) => x.id === n.id);
            if (note) { delete note.deletedAt; save(records); }
            m.close(); redraw(); openTrash();
          } }, '복원'),
          h('button', { class: 'btn danger', type: 'button', onclick: () => {
            if (!confirm('이 메모를 영구 삭제할까요?')) return;
            save(load().filter((x) => x.id !== n.id)); m.close(); redraw(); openTrash();
          } }, '영구 삭제'))))
        : h('p', { class: 'muted' }, '휴지통이 비어 있어요.'),
        footer: list.length ? [h('button', { class: 'btn danger', type: 'button', onclick: () => {
          if (!confirm(`휴지통의 메모 ${list.length}개를 모두 영구 삭제할까요?`)) return;
          save(load().filter((n) => !n.deletedAt)); m.close(); redraw(); App.toast('휴지통을 비웠어요.');
        } }, '휴지통 비우기')] : null });
    }
    function removeCompleted() {
      const count = active().filter((n) => n.done).length;
      if (!count || !confirm(`예전에 완료 표시한 메모 ${count}개를 휴지통으로 옮길까요?`)) return;
      const now = Date.now();
      save(load().map((n) => n.done && !n.deletedAt ? { ...n, deletedAt: now, updatedAt: now } : n));
      redraw(); App.toast(`${count}개를 휴지통으로 옮겼어요.`);
    }
    root.append(h('section', { class: 'panel' },
      h('div', { class: 'title-row' },
        h('h1', { class: 'page-title' }, '메모'),
        h('div', { class: 'nt-actions' },
          h('button', { class: 'btn', type: 'button', onclick: addFolder }, '＋ 보관함'),
          h('button', { class: 'btn ghost', type: 'button', onclick: openTrash }, '휴지통'),
          h('button', { class: 'btn primary', type: 'button', onclick: () => edit({}, redraw) }, '＋ 새 메모'))),
      active().some((n) => n.done) ? h('button', { class: 'btn ghost nt-legacy-done', type: 'button', onclick: removeCompleted }, '완료 표시된 메모 한꺼번에 삭제') : null,
      folderBar,
      h('div', { class: 'nt-view-switch', role: 'group', 'aria-label': '메모 보기 방식' },
        ...[['cards', '네모 보기'], ['list', '줄 보기']].map(([mode, label]) => h('button', { class: 'btn' + (viewMode === mode ? ' on' : ''), type: 'button', 'aria-pressed': String(viewMode === mode), onclick: () => { viewMode = mode; Store.set('notesViewMode', mode); App.refresh(); } }, label))),
      h('div', { class: 'filters' }, h('input', { type: 'search', placeholder: '메모 검색', value: q, oninput: (e) => { q = e.target.value; redraw(); } })),
      grid));
    redraw();
  }

  return { render, edit, show, forDate: (ds) => active().filter((n) => n.date === ds || (n.date && n.dateEnd && n.date <= ds && ds <= n.dateEnd) || n.dates?.includes(ds)), openForDate: (ds, after) => edit({ date: ds }, after) };
})();

App.registerView('notes', { label: '메모', icon: 'notes', render: Notes.render });
