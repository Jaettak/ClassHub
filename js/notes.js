// 메모: 자유롭게 적는 일반 메모
const Notes = (() => {
  const COLORS = ['#fff4b8', '#ffd9e2', '#d8ecff', '#d9f5e5', '#e8dcff', '#ffe3c2'];
  let q = '';

  const load = () => Store.get('notes', []);
  const save = (l) => Store.set('notes', l);
  const folders = () => Store.get('noteFolders', []);
  const active = () => load().filter((n) => !n.deletedAt);
  const imageKey = (noteId, imageId) => `note-${noteId}-${imageId}`;
  const removeImages = async (note) => { for (const image of note.images || []) await Store.delImg(imageKey(note.id, image.id)); };
  const galleryPhoto = (noteId, photo, data = '') => {
    const image = h('img', { alt: photo.name || '메모 사진', loading: 'lazy' });
    if (data) image.src = data;
    else Store.getImg(imageKey(noteId, photo.id)).then((saved) => { if (saved?.data) image.src = saved.data; });
    return image;
  };
  let selectedFolder = '*';
  let sortMode = localStorage.getItem('classhub-note-sort') || 'manual';
  function cleanupExpired() {
    const days = Number(Settings.get().notesAutoTrashDays || 0);
    if (!Number.isInteger(days) || days < 1) return;
    const cutoff = dateStr(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - days));
    let changed = false;
    const next = load().map((n) => {
      const lastDate = n.dates?.length ? [...n.dates].sort().at(-1) : n.dateEnd || n.date;
      if (!n.deletedAt && !n.autoTrashExempt && lastDate && lastDate < cutoff) { changed = true; return { ...n, deletedAt: Date.now() }; }
      return n;
    });
    if (changed) save(next);
  }

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
    const photos = n.images?.length ? h('div', { class: 'nt-photo-gallery' }, n.images.map((photo) => galleryPhoto(n.id, photo))) : null;
    const m = App.modal({ title: n.title || '메모',
      body: h('div', { class: 'nt-detail' },
        n.body ? h('p', null, n.body) : null,
        photos,
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
    const photos = (n.images || []).map((photo) => ({ ...photo }));
    const photoList = h('div', { class: 'nt-photo-gallery' });
    const fileInput = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
    const cameraInput = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
    const renderPhotos = () => photoList.replaceChildren(...photos.map((photo) => h('div', { class: 'nt-photo-item' },
      galleryPhoto(n.id, photo, photo.data),
      h('button', { class: 'nt-photo-remove', type: 'button', 'aria-label': `${photo.name || '사진'} 제거`, onclick: () => { photos.splice(photos.indexOf(photo), 1); renderPhotos(); } }, '×'))));
    const addFiles = async (files) => {
      for (const file of [...files]) {
        if (!file.type.startsWith('image/') || file.size > 12 * 1024 * 1024) { App.toast('12MB 이하 사진 파일을 선택해 주세요.'); continue; }
        if (photos.length >= 12) { App.toast('메모 한 개에 사진은 최대 12장까지 넣을 수 있어요.'); break; }
        const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
        photos.push({ id: uid(), name: file.name || '사진', type: file.type, data });
      }
      renderPhotos();
    };
    [fileInput, cameraInput].forEach((input) => input.addEventListener('change', () => { addFiles(input.files).catch(() => App.toast('사진을 읽지 못했어요.')); input.value = ''; }));
    renderPhotos();
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
    let color = n.color || folders().find((f) => f.id === (n.folderId || selectedFolder))?.color || COLORS[active().length % COLORS.length];
    let pinned = !!n.pinned;
    const swatches = h('div', { class: 'swatches' });
    const drawSw = () => swatches.replaceChildren(...COLORS.map((c) => h('button', { type: 'button', class: 'sw' + (c === color ? ' on' : ''), style: { background: c }, 'aria-label': '색상 선택',
      onclick: () => { color = c; drawSw(); } })));
    drawSw();
    folder.addEventListener('change', () => {
      const folderColor = folders().find((f) => f.id === folder.value)?.color;
      if (folderColor) { color = folderColor; drawSw(); }
    });
    const pin = h('input', { type: 'checkbox', checked: pinned, onchange: () => { pinned = pin.checked; } });
    const m = App.modal({
      title: isNew ? '새 메모' : '메모 수정',
      body: [App.field('제목', title), App.field('내용', body),
        h('div', { class: 'field' }, h('span', null, '사진'), h('div', { class: 'set-row set-btns' },
          h('button', { class: 'btn', type: 'button', onclick: () => fileInput.click() }, '사진 파일·갤러리에서 추가'),
          h('button', { class: 'btn', type: 'button', onclick: () => cameraInput.click() }, '사진 찍기')),
          fileInput, cameraInput, photoList),
        App.field('보관함', folder), App.field('날짜 연결', mode), singleField, endField, manyField, h('div', { class: 'field' }, h('span', null, '색상'), swatches), h('label', { class: 'check' }, pin, '맨 위에 고정')],
      footer: [
        h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, '취소'),
        h('button', { class: 'btn primary', type: 'button', onclick: submit }, '저장'),
      ],
    });
    async function submit() {
      if (!title.value.trim() && !body.value.trim() && !photos.length) { App.toast('내용이나 사진을 넣어 주세요.'); body.focus(); return; }
      if (mode.value === 'one' && !noteDate.value || mode.value === 'range' && (!noteDate.value || !endDate.value || endDate.value < noteDate.value) || mode.value === 'many' && !selectedDates.size)
        return App.toast('연결할 날짜를 확인해 주세요.');
      const rec = { ...n, id: n.id || uid(), title: title.value.trim(), body: body.value.trim(), folderId: folder.value,
        date: ['one', 'range'].includes(mode.value) ? noteDate.value : '', dateEnd: mode.value === 'range' ? endDate.value : '',
        dates: mode.value === 'many' ? [...selectedDates].sort() : [], color, pinned, createdAt: n.createdAt || Date.now(), updatedAt: Date.now(),
        images: photos.map(({ id, name, type }) => ({ id, name, type })) };
      try { for (const photo of photos.filter((item) => item.data)) await Store.putImg(imageKey(rec.id, photo.id), { data: photo.data, type: photo.type, name: photo.name }); }
      catch (_) { return App.toast('사진 저장에 실패했어요. 다시 시도해 주세요.'); }
      const list = load().filter((x) => x.id !== rec.id);
      list.push(rec);
      save(list);
      for (const old of n.images || []) if (!photos.some((photo) => photo.id === old.id)) Store.delImg(imageKey(rec.id, old.id));
      m.close();
      after();
    }
    setTimeout(() => (isNew ? body : title).focus(), 50);
  }

  function render(root) {
    cleanupExpired();
    let viewMode = Store.get('notesViewMode', 'cards');
    const grid = h('div', { class: 'nt-grid' });
    const folderBar = h('div', { class: 'nt-folders' });
    let move = () => {}, dragId = '', dropIntent = null, insertionLine = null, suppressClickUntil = 0;
    const clearIntent = () => {
      insertionLine?.remove(); insertionLine = null; dropIntent = null;
      grid.querySelectorAll('.drop-swap').forEach((node) => node.classList.remove('drop-swap'));
    };
    const hit = (x, y, sourceId) => {
      const point = document.elementFromPoint(x, y);
      if (!point || !grid.contains(point)) return null;
      const direct = point.closest('.nt-card[data-note-id]');
      if (direct?.dataset.noteId === sourceId) return null;
      if (direct) {
        const r = direct.getBoundingClientRect();
        const rx = (x - r.left) / r.width, ry = (y - r.top) / r.height;
        const edges = viewMode === 'list'
          ? [{ distance: ry, placement: 'before', axis: 'horizontal' }, { distance: 1 - ry, placement: 'after', axis: 'horizontal' }]
          : [{ distance: rx, placement: 'before', axis: 'vertical' }, { distance: 1 - rx, placement: 'after', axis: 'vertical' },
            { distance: ry, placement: 'before', axis: 'horizontal' }, { distance: 1 - ry, placement: 'after', axis: 'horizontal' }];
        const nearest = edges.sort((a, b) => a.distance - b.distance)[0];
        return nearest.distance < .19 ? { target: direct, placement: nearest.placement, axis: nearest.axis }
          : { target: direct, placement: 'swap' };
      }
      return [...grid.querySelectorAll('.nt-card[data-note-id]')].filter((card) => card.dataset.noteId !== sourceId)
        .flatMap((card) => {
          const r = card.getBoundingClientRect();
          const horizontal = viewMode === 'list';
          return ['before', 'after'].map((placement) => {
            const edge = horizontal ? placement === 'before' ? r.top : r.bottom : placement === 'before' ? r.left : r.right;
            const distance = horizontal ? Math.hypot(y - edge, Math.max(r.left - x, 0, x - r.right))
              : Math.hypot(x - edge, Math.max(r.top - y, 0, y - r.bottom));
            return { target: card, placement, axis: horizontal ? 'horizontal' : 'vertical', distance };
          });
        }).sort((a, b) => a.distance - b.distance)[0] || null;
    };
    const showIntent = (intent) => {
      clearIntent();
      if (!intent) return;
      dropIntent = intent;
      if (intent.placement === 'swap') { intent.target.classList.add('drop-swap'); return; }
      const r = intent.target.getBoundingClientRect();
      insertionLine = h('div', { class: 'nt-drop-insertion', style: intent.axis === 'vertical'
        ? { left: `${intent.placement === 'before' ? r.left - 4 : r.right + 1}px`, top: `${r.top}px`, width: '4px', height: `${r.height}px` }
        : { left: `${r.left}px`, top: `${intent.placement === 'before' ? r.top - 4 : r.bottom + 1}px`, width: `${r.width}px`, height: '4px' } });
      document.body.append(insertionLine);
    };
    grid.addEventListener('dragover', (event) => {
      if (!dragId) return;
      const intent = hit(event.clientX, event.clientY, dragId);
      if (intent) { event.preventDefault(); showIntent(intent); }
    });
    grid.addEventListener('drop', (event) => {
      if (!dragId) return;
      event.preventDefault();
      const intent = hit(event.clientX, event.clientY, dragId) || dropIntent;
      const source = dragId; dragId = ''; clearIntent();
      if (intent) move(source, intent.target.dataset.noteId, intent.placement);
    });
    const redraw = () => {
      grid.classList.toggle('list', viewMode === 'list');
      const all = active();
      const s = q.trim().toLowerCase();
      const sortNotes = (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
        (sortMode === 'date-asc' ? String(a.date || a.dates?.[0] || '').localeCompare(String(b.date || b.dates?.[0] || '')) : 0) ||
        (sortMode === 'date-desc' ? String(b.date || b.dates?.[0] || '').localeCompare(String(a.date || a.dates?.[0] || '')) : 0) ||
        (sortMode === 'created-asc' ? (a.createdAt || a.created || a.updatedAt || 0) - (b.createdAt || b.created || b.updatedAt || 0) : 0) ||
        (sortMode === 'created-desc' ? (b.createdAt || b.created || b.updatedAt || 0) - (a.createdAt || a.created || a.updatedAt || 0) : 0) ||
        (sortMode === 'folder' ? String(folders().find((f) => f.id === a.folderId)?.name || '').localeCompare(String(folders().find((f) => f.id === b.folderId)?.name || ''), 'ko') : 0) ||
        (sortMode === 'name' ? String(a.title || '').localeCompare(String(b.title || ''), 'ko') : 0) ||
        (sortMode === 'recent' ? (b.updatedAt || 0) - (a.updatedAt || 0) : 0) ||
        (Number.isFinite(a.sortOrder) && Number.isFinite(b.sortOrder) ? a.sortOrder - b.sortOrder : (b.updatedAt || 0) - (a.updatedAt || 0));
      const list = all.filter((n) => (selectedFolder === '*' || (n.folderId || '') === selectedFolder) &&
        (!s || `${n.title} ${n.body}`.toLowerCase().includes(s))).sort(sortNotes);
      move = (id, targetId, placement) => {
        const ids = list.map((note) => note.id);
        const from = ids.indexOf(id), to = ids.indexOf(targetId);
        if (from < 0 || to < 0 || from === to) return;
        if (placement === 'swap') [ids[from], ids[to]] = [ids[to], ids[from]];
        else {
          ids.splice(from, 1);
          const target = ids.indexOf(targetId);
          ids.splice(target + (placement === 'after' ? 1 : 0), 0, id);
        }
        const saved = load();
        const byId = new Map(saved.map((note) => [note.id, note]));
        const visible = new Set(ids);
        const pinnedSlots = list.map((note) => !!note.pinned);
        let nextVisible = 0;
        const ordered = saved.filter((note) => !note.deletedAt).sort(sortNotes).map((note) => {
          if (!visible.has(note.id)) return note;
          const changed = byId.get(ids[nextVisible]);
          changed.pinned = pinnedSlots[nextVisible++];
          return changed;
        });
        ordered.forEach((note, index) => { note.sortOrder = index; });
        sortMode = 'manual'; localStorage.setItem('classhub-note-sort', sortMode);
        const sortSelect = root.querySelector('[aria-label="메모 정렬"]'); if (sortSelect) sortSelect.value = sortMode;
        save(saved); redraw();
      };
      const folderSelect = h('select', { class: 'nt-folder-select', 'aria-label': '메모 보관함 선택', onchange: (e) => { selectedFolder = e.currentTarget.value; redraw(); },
        ondragover: (e) => { if (selectedFolder !== '*') e.preventDefault(); },
        ondrop: (e) => { if (selectedFolder === '*') return; e.preventDefault();
          const noteId = e.dataTransfer.getData('text/plain');
          if (!noteId) return;
          save(load().map((n) => n.id === noteId ? { ...n, folderId: selectedFolder, updatedAt: Date.now() } : n));
          redraw(); App.toast('보관함에 넣었어요.');
        } }, [['*', '전체'], ['', '기본 보관함'], ...folders().map((f) => [f.id, f.name])].map(([id, name]) => h('option', { value: id, selected: selectedFolder === id }, name)));
      folderBar.replaceChildren(
        folderSelect,
        ...(selectedFolder && selectedFolder !== '*' ? [h('button', { class: 'nt-folder-manage', type: 'button', onclick: manageFolder }, '보관함 관리')] : []));
      grid.replaceChildren();
      if (!list.length) {
        grid.append(h('div', { class: 'empty-box' }, all.length ? '표시할 메모가 없어요.' : '아직 메모가 없어요.'));
        return;
      }
      const groupedMode = sortMode === 'date-group';
      const display = [];
      if (groupedMode) {
        const groups = new Map();
        list.forEach((note) => {
          const dates = note.dates?.length ? [...new Set(note.dates)].sort() : [note.date || ''];
          dates.forEach((date) => { if (!groups.has(date)) groups.set(date, []); groups.get(date).push(note); });
        });
        [...groups.keys()].sort((a, b) => !a ? 1 : !b ? -1 : a.localeCompare(b)).forEach((date) => {
          const target = h('div', { class: 'nt-date-cards nt-grid' + (viewMode === 'list' ? ' list' : '') });
          grid.append(h('details', { class: 'nt-date-group', open: true },
            h('summary', null, `${date || '날짜 없음'} · ${groups.get(date).length}개`), target));
          groups.get(date).forEach((note) => display.push({ n: note, target }));
        });
      } else list.forEach((n) => display.push({ n, target: grid }));
      display.forEach(({ n, target }) => {
        let touchDrag = null, ghost = null;
        const card = h('div', { role: 'button', tabIndex: 0, draggable: !groupedMode, class: 'nt-card', 'data-note-id': n.id, style: { '--c': n.color },
        onclick: (e) => { if (Date.now() < suppressClickUntil || e.target.closest('.nt-delete')) return; show(n, redraw); },
        onkeydown: (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) show(n, redraw); },
        ondragstart: (e) => { if (groupedMode) return e.preventDefault(); dragId = n.id; e.dataTransfer.setData('text/plain', n.id); e.dataTransfer.effectAllowed = 'move'; },
        ondragend: () => { dragId = ''; clearIntent(); } },
        h('div', { class: 'nt-top' },
          h('h4', null, n.title || '제목 없음'), n.pinned ? h('span', { class: 'badge' }, '고정') : null,
          viewMode === 'list' ? null : h('button', { class: 'nt-delete', type: 'button', title: '휴지통으로 이동', 'aria-label': `${n.title || '메모'} 휴지통으로 이동`, onclick: (e) => { e.stopPropagation(); trash(n.id, redraw); } }, '×')),
        n.body && viewMode !== 'list' ? h('p', null, n.body) : null,
        h('small', null, n.dates?.length ? `${n.dates.length}개 날짜` : n.dateEnd ? `${n.date} ~ ${n.dateEnd}` : n.date ? `일정 ${n.date}` : new Date(n.updatedAt).toLocaleDateString('ko-KR')));
        const cancelTouchDrag = () => {
          if (touchDrag?.timer) clearTimeout(touchDrag.timer);
          ghost?.remove(); ghost = null; touchDrag = null;
          card.classList.remove('dragging'); clearIntent();
        };
        card.addEventListener('touchstart', (event) => {
          if (groupedMode || event.touches.length !== 1 || event.target.closest('.nt-delete')) return;
          const touch = event.touches[0];
          touchDrag = { x: touch.clientX, y: touch.clientY, timer: setTimeout(() => {
            if (!touchDrag || !card.isConnected) return;
            ghost = card.cloneNode(true); ghost.classList.add('nt-drag-ghost'); document.body.append(ghost);
            ghost.style.left = `${touchDrag.x}px`; ghost.style.top = `${touchDrag.y}px`;
            card.classList.add('dragging'); suppressClickUntil = Date.now() + 400;
          }, 350) };
        });
        card.addEventListener('touchmove', (event) => {
          if (!touchDrag) return;
          const touch = event.touches[0]; if (!touch) return;
          if (!ghost) {
            if (Math.hypot(touch.clientX - touchDrag.x, touch.clientY - touchDrag.y) > 8) cancelTouchDrag();
            return;
          }
          event.preventDefault();
          ghost.style.left = `${touch.clientX}px`; ghost.style.top = `${touch.clientY}px`;
          showIntent(hit(touch.clientX, touch.clientY, n.id));
        }, { passive: false });
        card.addEventListener('touchend', (event) => {
          const touch = event.changedTouches[0];
          const intent = ghost && touch ? hit(touch.clientX, touch.clientY, n.id) || dropIntent : null;
          if (ghost) suppressClickUntil = Date.now() + 400;
          cancelTouchDrag();
          if (intent) move(n.id, intent.target.dataset.noteId, intent.placement);
        });
        card.addEventListener('touchcancel', cancelTouchDrag);
        target.append(viewMode === 'list' ? h('div', { class: 'nt-list-row' }, card,
          h('button', { class: 'nt-list-delete', type: 'button', title: '휴지통으로 이동', 'aria-label': `${n.title || '메모'} 휴지통으로 이동`, onclick: () => trash(n.id, redraw) }, '×')) : card);
      });
    };
    function addFolder() {
      const name = h('input', { type: 'text', maxLength: 30, placeholder: '보관함 이름' });
      const color = h('input', { type: 'color', value: COLORS[0], 'aria-label': '보관함 색상' });
      const m = App.modal({ title: '새 메모 보관함', body: [App.field('이름', name), App.field('보관함 색상', color)], footer: [
        h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, '취소'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => {
          if (!name.value.trim()) return App.toast('이름을 입력해 주세요.');
          const id = uid();
          Store.set('noteFolders', [...folders(), { id, name: name.value.trim(), color: color.value }]);
          selectedFolder = id; m.close(); redraw();
        } }, '만들기') ] });
      name.focus();
    }
    function manageFolder() {
      const current = folders().find((f) => f.id === selectedFolder);
      if (!current) return;
      const name = h('input', { type: 'text', value: current.name, maxLength: 30 });
      const color = h('input', { type: 'color', value: current.color || COLORS[0], 'aria-label': '보관함 색상' });
      const m = App.modal({ title: '보관함 관리', body: [App.field('이름', name), App.field('보관함 색상', color),
        h('button', { class: 'btn', type: 'button', onclick: async () => {
          if (!await App.confirm(`이 보관함의 메모 색을 모두 ${color.value}로 바꿀까요?`)) return;
          save(load().map((n) => n.folderId === current.id ? { ...n, color: color.value, updatedAt: Date.now() } : n));
          Store.set('noteFolders', folders().map((f) => f.id === current.id ? { ...f, color: color.value } : f));
          m.close(); redraw(); App.toast('보관함 메모의 색을 바꿨어요.');
        } }, '이 보관함 메모 색 모두 바꾸기')], footer: [
        h('button', { class: 'btn danger', type: 'button', onclick: async () => {
          if (!await App.confirm('보관함을 지울까요? 안의 메모는 기본 보관함으로 이동해요.')) return;
          Store.set('noteFolders', folders().filter((f) => f.id !== current.id));
          save(load().map((n) => n.folderId === current.id ? { ...n, folderId: '' } : n));
          selectedFolder = ''; m.close(); redraw();
        } }, '보관함 삭제'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, '취소'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => {
          if (!name.value.trim()) return App.toast('이름을 입력해 주세요.');
          Store.set('noteFolders', folders().map((f) => f.id === current.id ? { ...f, name: name.value.trim(), color: color.value } : f));
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
            if (note) { delete note.deletedAt; note.autoTrashExempt = true; save(records); }
            m.close(); redraw(); openTrash();
          } }, '복원'),
          h('button', { class: 'btn danger', type: 'button', onclick: async () => {
            if (!await App.confirm('이 메모를 영구 삭제할까요?')) return;
            await removeImages(n);
            save(load().filter((x) => x.id !== n.id)); m.close(); redraw(); openTrash();
          } }, '영구 삭제'))))
        : h('p', { class: 'muted' }, '휴지통이 비어 있어요.'),
        footer: list.length ? [h('button', { class: 'btn danger', type: 'button', onclick: async () => {
          if (!await App.confirm(`휴지통의 메모 ${list.length}개를 모두 영구 삭제할까요?`)) return;
          for (const note of list) await removeImages(note);
          save(load().filter((n) => !n.deletedAt)); m.close(); redraw(); App.toast('휴지통을 비웠어요.');
        } }, '휴지통 비우기')] : null });
    }
    async function removeCompleted() {
      const count = active().filter((n) => n.done).length;
      if (!count || !await App.confirm(`예전에 완료 표시한 메모 ${count}개를 휴지통으로 옮길까요?`)) return;
      const now = Date.now();
      save(load().map((n) => n.done && !n.deletedAt ? { ...n, deletedAt: now, updatedAt: now } : n));
      redraw(); App.toast(`${count}개를 휴지통으로 옮겼어요.`);
    }
    async function removeAllNotes() {
      const count = active().length;
      if (!count || !await App.confirm(`메모 ${count}개를 모두 휴지통으로 옮길까요?`)) return;
      const now = Date.now();
      save(load().map((n) => n.deletedAt ? n : { ...n, deletedAt: now, updatedAt: now }));
      redraw(); App.toast(`${count}개를 휴지통으로 옮겼어요.`);
    }
    root.append(h('section', { class: 'panel' },
      h('div', { class: 'title-row' },
        h('h1', { class: 'page-title' }, '메모'),
        h('div', { class: 'nt-actions' },
          h('button', { class: 'btn', type: 'button', onclick: addFolder }, '＋ 보관함'),
          h('button', { class: 'btn primary', type: 'button', onclick: () => edit({}, redraw) }, '＋ 새 메모'),
          h('button', { class: 'btn ghost', type: 'button', onclick: removeAllNotes }, '전체 삭제'),
          h('button', { class: 'trash-icon-btn', type: 'button', onclick: openTrash, title: '메모 휴지통', 'aria-label': '메모 휴지통' }, icon('trash')))),
      active().some((n) => n.done) ? h('button', { class: 'btn ghost nt-legacy-done', type: 'button', onclick: removeCompleted }, '완료 표시된 메모 한꺼번에 삭제') : null,
      folderBar,
      h('div', { class: 'nt-view-switch', role: 'group', 'aria-label': '메모 보기 방식' },
        ...[['cards', '네모 보기'], ['list', '줄 보기']].map(([mode, label]) => h('button', { class: 'btn' + (viewMode === mode ? ' on' : ''), type: 'button', 'aria-pressed': String(viewMode === mode), onclick: () => { viewMode = mode; Store.set('notesViewMode', mode); App.refresh(); } }, label))),
      h('div', { class: 'filters' }, h('input', { type: 'search', placeholder: '메모 검색', value: q, oninput: (e) => { q = e.target.value; redraw(); } }),
        h('select', { 'aria-label': '메모 정렬', onchange: (e) => { sortMode = e.target.value; localStorage.setItem('classhub-note-sort', sortMode); redraw(); } },
          [['manual', '직접 정렬'], ['recent', '최근 수정순'], ['created-desc', '작성 최근순'], ['created-asc', '작성 오래된순'], ['date-asc', '연결 날짜 빠른순'], ['date-desc', '연결 날짜 늦은순'], ['date-group', '연결 날짜별 묶기'], ['folder', '보관함순'], ['name', '이름순']].map(([value, label]) => h('option', { value, selected: sortMode === value }, label)))),
      grid));
    redraw();
  }

  return { render, edit, show, forDate: (ds) => active().filter((n) => n.date === ds || (n.date && n.dateEnd && n.date <= ds && ds <= n.dateEnd) || n.dates?.includes(ds)), openForDate: (ds, after) => edit({ date: ds }, after) };
})();

App.registerView('notes', { label: '메모', icon: 'notes', render: Notes.render });
