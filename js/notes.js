// 메모: 자유롭게 적는 일반 메모
const Notes = (() => {
  const COLORS = ['#fff4b8', '#ffd9e2', '#d8ecff', '#d9f5e5', '#e8dcff', '#ffe3c2'];
  let q = '';

  const load = () => Store.get('notes', []);
  const save = (l) => Store.set('notes', l);

  function edit(n, after) {
    const isNew = !n.id;
    const title = h('input', { type: 'text', value: n.title || '', placeholder: '제목 (선택)', maxLength: 60 });
    const body = h('textarea', { rows: 9, placeholder: '메모를 적어 보세요', value: n.body || '' });
    const noteDate = h('input', { type: 'date', value: n.date || '' });
    let color = n.color || COLORS[0];
    let pinned = !!n.pinned;
    const swatches = h('div', { class: 'swatches' });
    const drawSw = () => swatches.replaceChildren(...COLORS.map((c) => h('button', { type: 'button', class: 'sw' + (c === color ? ' on' : ''), style: { background: c }, 'aria-label': '색상 선택',
      onclick: () => { color = c; drawSw(); } })));
    drawSw();
    const pin = h('input', { type: 'checkbox', checked: pinned, onchange: () => { pinned = pin.checked; } });
    const m = App.modal({
      title: isNew ? '새 메모' : '메모 수정',
      body: [App.field('제목', title), App.field('내용', body), App.field('연결할 날짜 (선택)', noteDate, '시간이 정해지지 않은 할 일이나 그날의 메모를 일정에서 볼 수 있어요.'), h('div', { class: 'field' }, h('span', null, '색상'), swatches), h('label', { class: 'check' }, pin, '맨 위에 고정')],
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
      const rec = { ...n, id: n.id || uid(), title: title.value.trim(), body: body.value.trim(), date: noteDate.value, color, pinned, updatedAt: Date.now() };
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
      const list = all.filter((n) => !s || `${n.title} ${n.body}`.toLowerCase().includes(s)).sort(sortNotes);
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
        grid.append(h('div', { class: 'empty-box' }, all.length ? '찾는 메모가 없어요.' : '아직 메모가 없어요.'));
        return;
      }
      list.forEach((n, i) => grid.append(h('div', { role: 'button', tabIndex: 0, draggable: true, class: 'nt-card', style: { '--c': n.color },
        onclick: (e) => { if (!e.target.closest('.nt-move')) edit(n, redraw); },
        onkeydown: (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) edit(n, redraw); },
        ondragstart: (e) => { e.dataTransfer.setData('text/plain', n.id); e.dataTransfer.effectAllowed = 'move'; },
        ondragover: (e) => e.preventDefault(),
        ondrop: (e) => { e.preventDefault(); move(e.dataTransfer.getData('text/plain'), n.id); } },
        h('div', { class: 'nt-top' }, h('h4', null, n.title || '제목 없음'), n.pinned ? h('span', { class: 'badge' }, '고정') : null),
        n.body ? h('p', null, n.body) : null,
        h('small', null, n.date ? `일정 ${n.date}` : new Date(n.updatedAt).toLocaleDateString('ko-KR')),
        h('span', { class: 'nt-move' },
          h('button', { type: 'button', 'aria-label': `${n.title || '메모'} 위로`, disabled: i === 0, onclick: (e) => { e.stopPropagation(); move(n.id, list[i - 1].id); } }, '↑'),
          h('button', { type: 'button', 'aria-label': `${n.title || '메모'} 아래로`, disabled: i === list.length - 1, onclick: (e) => { e.stopPropagation(); move(n.id, list[i + 1].id); } }, '↓')))));
    };
    root.append(h('section', { class: 'panel' },
      h('div', { class: 'title-row' },
        h('h1', { class: 'page-title' }, '메모'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => edit({}, redraw) }, '＋ 새 메모')),
      h('div', { class: 'filters' }, h('input', { type: 'search', placeholder: '메모 검색', value: q, oninput: (e) => { q = e.target.value; redraw(); } })),
      grid));
    redraw();
  }

  return { render, edit, forDate: (ds) => load().filter((n) => n.date === ds), openForDate: (ds, after) => edit({ date: ds }, after) };
})();

App.registerView('notes', { label: '메모', icon: 'notes', render: Notes.render });
