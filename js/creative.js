// 과목별 필기와 자유 화이트보드. 그림은 현재 기기에 저장한다.
const Creative = (() => {
  let backHandler = null;
  function board(root, key, afterSave = () => {}) {
    const canvas = h('canvas', { class: 'creative-canvas', width: 2200, height: 1400 });
    const ctx = canvas.getContext('2d');
    const color = h('input', { type: 'color', value: '#233654', 'aria-label': '펜 색' });
    const background = h('input', { type: 'color', value: '#ffffff', 'aria-label': '배경 색' });
    const size = h('input', { type: 'range', min: 2, max: 50, value: 8, 'aria-label': '펜 굵기' });
    const opacity = h('input', { type: 'range', min: 5, max: 100, value: 100, 'aria-label': '펜 불투명도' });
    const boardWidth = h('input', { type: 'number', min: 400, max: 4000, step: 100, value: canvas.width, 'aria-label': '그림 너비' });
    const boardHeight = h('input', { type: 'number', min: 300, max: 4000, step: 100, value: canvas.height, 'aria-label': '그림 높이' });
    let mode = '펜';
    const modeButtons = {};
    const shapePicker = DrawTools.shapePicker((key) => setMode(key));
    function setMode(key) {
      mode = DrawTools.labels[key];
      Object.entries(modeButtons).forEach(([name, button]) => button.classList.toggle('on', name === key));
      shapePicker.main.classList.toggle('on', shapePicker.choices.includes(key));
      canvas.style.cursor = key === 'select' ? 'default' : 'crosshair';
      if (key !== 'select') { selection = null; selectedPatch = null; frame.hide(); }
    }
    for (const key of Object.keys(DrawTools.labels).filter((key) => !shapePicker.choices.includes(key))) modeButtons[key] = DrawTools.button(key, () => setMode(key));
    modeButtons.pen.classList.add('on');
    let strokes = [], active = null, undone = [], clearPending = false, selection = null, clipboard = null, selectedPatch = null;
    const images = new Map();
    let fillCache = null, fillCount = 0, fillTail = null, fillBackground = '';
    const invalidateFill = () => { fillCache = null; fillCount = 0; fillTail = null; };
    const rememberFill = (count, tail) => {
      if (!fillCache || fillCache.width !== canvas.width || fillCache.height !== canvas.height) fillCache = document.createElement('canvas');
      fillCache.width = canvas.width; fillCache.height = canvas.height;
      fillCache.getContext('2d').drawImage(canvas, 0, 0);
      fillCount = count; fillTail = tail; fillBackground = background.value;
    };
    const draw = (showSelection = true) => {
      const cached = fillCache && fillCache.width === canvas.width && fillCache.height === canvas.height && fillBackground === background.value && strokes[fillCount - 1] === fillTail;
      if (cached) ctx.drawImage(fillCache, 0, 0);
      else { ctx.fillStyle = background.value; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      const rendered = strokes.concat(active ? [active] : []);
      for (let i = cached ? fillCount : 0; i < rendered.length; i++) {
        const s = rendered[i];
        const [a, b] = [s.points[0], s.points.at(-1)]; if (!a || !b) continue;
        if (s.tool === '채우기') { DrawTools.floodFill(ctx, a[0], a[1], s.color, s.alpha ?? 1); if (i < strokes.length) rememberFill(i + 1, s); continue; }
        DrawTools.drawWithSymmetry(ctx, s.symmetry, () => {
        if (s.tool === '덮기') { ctx.fillStyle = background.value; ctx.fillRect(a[0], a[1], b[0], b[1]); return; }
        if (s.tool === '붙이기') {
          if (!images.has(s.data)) { const image = new Image(); images.set(s.data, image); image.onload = () => { invalidateFill(); draw(); }; image.src = s.data; }
          const image = images.get(s.data); if (image.complete && image.naturalWidth) {
            ctx.save(); ctx.translate(a[0] + b[0] / 2, a[1] + b[1] / 2); ctx.rotate(s.angle || 0); ctx.drawImage(image, -b[0] / 2, -b[1] / 2, b[0], b[1]); ctx.restore();
          }
          return;
        }
        if (s.tool === '글자') { ctx.fillStyle = s.color; const font = Math.max(16, s.size * 5); ctx.font = `bold ${font}px sans-serif`; s.text.split('\n').forEach((line, i) => ctx.fillText(line, a[0], a[1] + i * font * 1.3)); return; }
        ctx.strokeStyle = s.tool === '지우개' ? background.value : s.color;
        ctx.globalAlpha = s.alpha ?? (s.tool === '마커' ? .3 : 1);
        ctx.lineWidth = s.size; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
        if (['펜', '마커', '지우개'].includes(s.tool)) DrawTools.smoothPath(ctx, s.points);
        if (s.tool === '직선') { ctx.moveTo(...a); ctx.lineTo(...b); }
        if (s.tool === '사각형') ctx.rect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
        if (s.tool === '삼각형') { ctx.moveTo((a[0] + b[0]) / 2, a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(a[0], b[1]); ctx.closePath(); }
        if (s.tool === '타원') ctx.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.max(.1, Math.abs(a[0] - b[0]) / 2), Math.max(.1, Math.abs(a[1] - b[1]) / 2), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        });
      }
      if (showSelection && selection?.start) { ctx.save(); ctx.setLineDash([10, 6]); ctx.strokeStyle = '#2874e4'; ctx.lineWidth = 2; ctx.strokeRect(selection.x, selection.y, selection.w, selection.h); ctx.restore(); }
    };
    const pos = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * canvas.width / r.width, (e.clientY - r.top) * canvas.height / r.height]; };
    const wrap = h('div', { class: 'creative-wrap' }, canvas);
    const guides = DrawTools.guideControls(wrap, canvas);
    const touchPointers = new Set();
    const capture = () => {
      if (!selection) return null;
      if (selectedPatch) return { data: selectedPatch.data, width: selectedPatch.points[1][0], height: selectedPatch.points[1][1] };
      draw(false);
      const copy = document.createElement('canvas'); copy.width = Math.ceil(selection.w); copy.height = Math.ceil(selection.h);
      copy.getContext('2d').drawImage(canvas, selection.x, selection.y, selection.w, selection.h, 0, 0, copy.width, copy.height);
      return { data: copy.toDataURL('image/png'), width: copy.width, height: copy.height };
    };
    const promote = () => {
      if (selectedPatch) return selectedPatch;
      const copied = capture(); if (!copied) return null;
      const group = uid();
      invalidateFill();
      strokes.push({ tool: '덮기', points: [[selection.x, selection.y], [selection.w, selection.h]], group });
      selectedPatch = { tool: '붙이기', data: copied.data, points: [[selection.x, selection.y], [copied.width, copied.height]], angle: 0, group };
      strokes.push(selectedPatch); undone = []; return selectedPatch;
    };
    const frame = DrawTools.selectionFrame(wrap, canvas,
      (dx, dy, start) => { const patch = promote(); if (!patch) return; patch.points[0] = [start.x + dx, start.y + dy]; selection = { ...start, x: patch.points[0][0], y: patch.points[0][1] }; draw(); frame.show(selection); },
      (angle, start) => { const patch = promote(); if (!patch) return; patch.angle = (start.angle || 0) + angle; selection = { ...start, angle: patch.angle }; draw(); frame.show(selection); },
      (dw, dh, start) => { const patch = promote(); if (!patch) return; patch.points[1] = [Math.max(10, start.w + dw), Math.max(10, start.h + dh)]; selection = { ...start, w: patch.points[1][0], h: patch.points[1][1] }; draw(); frame.show(selection); });
    const selectButton = (label, action) => h('button', { class: 'btn', type: 'button', onclick: () => {
      if (action === 'paste') {
        if (!clipboard) return App.toast('먼저 영역을 복사하세요.');
        const x = selection ? selection.x + 24 : (canvas.width - clipboard.width) / 2;
        const y = selection ? selection.y + 24 : (canvas.height - clipboard.height) / 2;
        selectedPatch = { tool: '붙이기', data: clipboard.data, points: [[x, y], [clipboard.width, clipboard.height]], angle: 0 };
        strokes.push(selectedPatch); selection = { x, y, w: clipboard.width, h: clipboard.height, angle: 0 };
        undone = []; setMode('select'); draw(); frame.show(selection); return;
      }
      if (!selection || selection.w < 2 || selection.h < 2) return App.toast('먼저 영역을 드래그해 선택하세요.');
      if (action === 'copy' || action === 'cut') clipboard = capture();
      if (action === 'cut' || action === 'delete') {
        invalidateFill();
        if (selectedPatch) strokes = strokes.filter((stroke) => stroke !== selectedPatch);
        else strokes.push({ tool: '덮기', points: [[selection.x, selection.y], [selection.w, selection.h]] });
        selectedPatch = null; undone = []; draw();
        if (action === 'delete') { selection = null; frame.hide(); } else frame.show(selection);
      } else App.toast('영역을 복사했어요. 붙여넣기를 누르세요.');
    } }, label);
    const selectionActions = h('div', { class: 'draw-selection-actions', hidden: true }, selectButton('복사', 'copy'), selectButton('붙여넣기', 'paste'), selectButton('잘라내기', 'cut'), selectButton('선택 삭제', 'delete'));
    frame.setActions(selectionActions);
    const resizeBoard = () => {
      const w = Math.max(400, Math.min(4000, Number(boardWidth.value) || canvas.width));
      const h = Math.max(300, Math.min(4000, Number(boardHeight.value) || canvas.height));
      if (w === canvas.width && h === canvas.height) return;
      const sx = w / canvas.width, sy = h / canvas.height;
      strokes = strokes.map((stroke) => ({ ...stroke, ...(Number.isFinite(stroke.size) ? { size: stroke.size * Math.min(sx, sy) } : {}), points: stroke.points.map(([x, y]) => [x * sx, y * sy]) }));
      canvas.width = w; canvas.height = h; boardWidth.value = w; boardHeight.value = h;
      invalidateFill(); selection = null; selectedPatch = null; frame.hide(); undone = []; draw();
    };
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') { touchPointers.add(e.pointerId); if (touchPointers.size > 1) { active = null; selection = null; frame.hide(); draw(); return; } }
      if (mode === '선택') { const [x, y] = pos(e); selectedPatch = null; selection = { x, y, w: 0, h: 0, start: [x, y] }; frame.hide(); canvas.setPointerCapture(e.pointerId); draw(); return; }
      selection = null; selectedPatch = null; frame.hide();
      if (mode === '스포이드') { draw(false); const [x, y] = pos(e), pixel = ctx.getImageData(Math.max(0, Math.min(canvas.width - 1, Math.floor(x))), Math.max(0, Math.min(canvas.height - 1, Math.floor(y))), 1, 1).data; color.value = '#' + [...pixel].slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join(''); setMode('pen'); return; }
      if (mode === '채우기') { strokes.push({ tool: '채우기', color: color.value, alpha: Number(opacity.value) / 100, points: [pos(e)] }); undone = []; draw(); return; }
      if (mode === '글자') {
        const point = pos(e), r = canvas.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
        const input = h('textarea', { class: 'creative-text', rows: 2, placeholder: '글자를 입력하세요' });
        input.style.left = `${r.left - wr.left + e.clientX - r.left}px`;
        input.style.top = `${r.top - wr.top + e.clientY - r.top}px`;
        input.addEventListener('blur', () => { const value = input.value.trim(); input.remove(); if (value) { strokes.push({ tool: '글자', color: color.value, size: Number(size.value), points: [point], text: value }); undone = []; draw(); } });
        wrap.append(input); input.focus(); return;
      }
      active = { tool: mode, color: color.value, size: Number(size.value), alpha: Number(opacity.value) / 100 * (mode === '마커' ? .3 : 1), symmetry: guides.symmetry(), points: [pos(e)] }; canvas.setPointerCapture(e.pointerId); draw();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (touchPointers.size > 1) return;
      if (mode === '선택' && selection?.start) { const [x, y] = pos(e), [sx, sy] = selection.start; Object.assign(selection, { x: Math.min(x, sx), y: Math.min(y, sy), w: Math.abs(x - sx), h: Math.abs(y - sy) }); draw(); return; }
      if (!active) return;
      if (guides.rulerOn() && ['펜', '마커'].includes(active.tool)) {
        active.points.push(guides.project(active.points[0], pos(e)));
        if (active.symmetry) draw();
        else DrawTools.liveSegment(ctx, active.points, active.color, active.size, active.alpha);
        return;
      }
      if (['펜', '마커', '지우개'].includes(active.tool)) {
        active.points.push(pos(e));
        if (active.symmetry) draw(); else DrawTools.liveSegment(ctx, active.points, active.tool === '지우개' ? background.value : active.color, active.size, active.alpha);
      } else { active.points[1] = pos(e); draw(); }
    });
    canvas.addEventListener('pointerup', (e) => { touchPointers.delete(e.pointerId); if (selection?.start) { delete selection.start; if (selection.w < 2 || selection.h < 2) { selection = null; frame.hide(); } else frame.show(selection); draw(); } });
    canvas.addEventListener('pointerup', () => { if (!active) return; strokes.push(active); undone = []; active = null; draw(); });
    canvas.addEventListener('pointercancel', (e) => { touchPointers.delete(e.pointerId); active = null; selection = null; draw(); });
    const readyImage = async () => { await Promise.all([...images.values()].map((image) => image.decode().catch(() => {}))); draw(false); };
    const save = async () => { await readyImage(); await Store.putImg(key, { data: canvas.toDataURL('image/png'), strokes, background: background.value, pixelWidth: canvas.width, pixelHeight: canvas.height }); afterSave(); App.toast('그림을 이 기기에 저장했어요.'); };
    const load = async () => { const old = await Store.getImg(key); if (old?.strokes) {
      if (old.pixelWidth && old.pixelHeight) { canvas.width = old.pixelWidth; canvas.height = old.pixelHeight; boardWidth.value = canvas.width; boardHeight.value = canvas.height; }
      const scale = canvas.width / (old.pixelWidth || 1100);
      strokes = old.strokes.map((stroke) => scale === 1 ? stroke : { ...stroke, size: stroke.size * scale, points: stroke.points.map(([x, y]) => [x * scale, y * scale]) });
      background.value = old.background || '#ffffff'; draw();
    } else if (old?.data) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height); img.src = old.data; } else draw(); };
    root.append(h('div', { class: 'creative-tools' },
      h('div', { class: 'draw-toolbar-row' }, h('div', { class: 'draw-tool-buttons' }, Object.values(modeButtons), shapePicker.el), DrawTools.zoomControls(wrap, canvas)),
      h('div', { class: 'draw-toolbar-row' }, guides.el),
      h('div', { class: 'draw-toolbar-row' },
      h('label', { class: 'creative-color-label' }, '펜 색', color),
      h('label', { class: 'creative-color-label' }, '굵기', size),
      h('label', { class: 'creative-color-label' }, '불투명도', opacity),
      h('label', { class: 'creative-color-label' }, '보드 색', background),
      h('label', { class: 'creative-size-label' }, '너비', boardWidth),
      h('label', { class: 'creative-size-label' }, '높이', boardHeight),
      h('button', { class: 'btn', type: 'button', onclick: resizeBoard }, '크기 적용')),
      h('div', { class: 'draw-toolbar-row' },
      h('button', { class: 'btn', type: 'button', 'aria-label': '이전', title: '이전', onclick: () => { if (clearPending && undone.at(-1)?.clear) { strokes = undone.at(-1).clear.slice(); clearPending = false; } else if (strokes.length) { const last = strokes.pop(), batch = [last]; if (last.group && strokes.at(-1)?.group === last.group) batch.unshift(strokes.pop()); undone.push(batch); selection = null; selectedPatch = null; frame.hide(); } draw(); } }, sv('svg', { viewBox: '0 0 24 24', class: 'draw-history-icon', 'aria-hidden': 'true' }, sv('path', { d: 'M9 7 4 12l5 5M4 12h10a6 6 0 0 1 6 6', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))),
      h('button', { class: 'btn', type: 'button', 'aria-label': '이후', title: '이후', onclick: () => { if (undone.length) { const next = undone.pop(); if (next.clear) { strokes = []; clearPending = false; } else strokes.push(...next); } draw(); } }, sv('svg', { viewBox: '0 0 24 24', class: 'draw-history-icon', 'aria-hidden': 'true' }, sv('path', { d: 'm15 7 5 5-5 5m5-5H10a6 6 0 0 0-6 6', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => { if (!strokes.length) return; undone = [{ clear: strokes.slice() }]; clearPending = true; strokes = []; selection = null; selectedPatch = null; frame.hide(); draw(); } }, '모두 지우기'),
      h('button', { class: 'btn primary', type: 'button', onclick: save }, '그림 저장'),
      h('button', { class: 'btn', type: 'button', onclick: async () => { await readyImage(); App.download('ClassHub-그림.png', canvas.toDataURL('image/png')); } }, 'PNG 받기'))),
      wrap);
    background.addEventListener('input', () => { invalidateFill(); draw(); });
    load();
  }
  function whiteboard(root) {
    const list = () => Store.get('whiteboards', []);
    const saveList = (items) => Store.set('whiteboards', items);
    const area = h('div', { hidden: true });
    const entry = h('div', { class: 'creative-entry' });
    const enter = () => { entry.hidden = true; area.hidden = false; backHandler = () => { area.hidden = true; entry.hidden = false; backHandler = null; }; };
    const back = h('button', { class: 'btn ghost', type: 'button', onclick: () => backHandler?.() }, '← 선택 화면');
    const saved = h('div', { class: 'study-list' });
    const showSaved = () => {
      area.replaceChildren(back, saved);
      saved.replaceChildren(...list().filter((item) => !item.deletedAt).map((item) => {
        const content = h('div', { class: 'saved-board-content' });
        const details = h('details', { class: 'panel saved-board', ontoggle: () => {
          if (details.open && !content.childElementCount) {
            const title = h('input', { type: 'text', value: item.title, 'aria-label': '보드 이름' });
            const drawing = h('div');
            content.append(App.field('이름', title), drawing,
              h('button', { class: 'btn danger', type: 'button', onclick: () => { saveList(list().map((x) => x.id === item.id ? { ...x, deletedAt: Date.now() } : x)); showSaved(); } }, '휴지통'));
            board(drawing, 'board-' + item.id, () => { saveList(list().map((x) => x.id === item.id ? { ...x, title: title.value.trim() || item.title, updatedAt: Date.now() } : x)); details.querySelector('summary').textContent = title.value.trim() || item.title; });
          }
        } }, h('summary', null, item.title), content);
        return details;
      }));
    };
    const open = (item = null) => {
      const id = item?.id || uid();
      const title = h('input', { type: 'text', value: item?.title || '', placeholder: '보드 이름' });
      const drawing = h('div');
      area.replaceChildren(back, App.field('이름', title), drawing);
      board(drawing, 'board-' + id, () => { saveList([{ id, title: title.value.trim() || '이름 없는 보드', updatedAt: Date.now() }, ...list().filter((x) => x.id !== id)]); });
    };
    const openTrash = () => {
      const deleted = list().filter((item) => item.deletedAt);
      const m = App.modal({ title: '화이트보드 휴지통', body: deleted.length ? h('div', { class: 'creative-trash-list' }, deleted.map((item) => h('div', { class: 'creative-trash-row' },
        h('b', null, item.title),
        h('button', { class: 'btn', type: 'button', onclick: () => { saveList(list().map((x) => x.id === item.id ? { ...x, deletedAt: null } : x)); m.close(); showSaved(); openTrash(); } }, '복원'),
        h('button', { class: 'btn danger', type: 'button', onclick: async () => { if (!confirm('영구 삭제할까요?')) return; await Store.delImg('board-' + item.id); saveList(list().filter((x) => x.id !== item.id)); m.close(); openTrash(); } }, '영구 삭제')))) : h('p', { class: 'muted' }, '휴지통이 비어 있어요.'),
        footer: deleted.length ? [h('button', { class: 'btn danger', type: 'button', onclick: async () => { if (!confirm('휴지통을 비울까요?')) return; for (const item of deleted) await Store.delImg('board-' + item.id); saveList(list().filter((x) => !x.deletedAt)); m.close(); openTrash(); } }, '휴지통 비우기')] : null });
    };
    root.append(h('section', { class: 'panel' }, h('div', { class: 'title-row' }, h('h1', { class: 'page-title' }, '화이트보드'), h('button', { class: 'trash-icon-btn', type: 'button', title: '화이트보드 휴지통', 'aria-label': '화이트보드 휴지통', onclick: openTrash }, icon('trash'))),
      entry, area));
    entry.append(
      h('button', { class: 'creative-entry-card', type: 'button', onclick: () => { enter(); showSaved(); } }, icon('whiteboard'), h('b', null, '저장한 보드'), h('span', null, '그림을 다시 열고 관리해요.')),
      h('button', { class: 'creative-entry-card', type: 'button', onclick: () => { enter(); open(); } }, icon('whiteboard'), h('b', null, '새 보드'), h('span', null, '빈 보드에서 바로 시작해요.')));
  }
  function study(root) {
    const pages = () => Store.get('studyPages', []);
    const savePages = (items) => Store.set('studyPages', items);
    const list = h('div', { class: 'study-list' });
    const editor = h('div', { class: 'study-editor' });
    const entry = h('div', { class: 'creative-entry' });
    const returnToEntry = () => { list.hidden = true; editor.hidden = true; entry.hidden = false; backHandler = null; };
    const back = h('button', { class: 'btn ghost', type: 'button', onclick: returnToEntry }, '← 선택 화면');
    const listBack = h('button', { class: 'btn ghost', type: 'button', onclick: returnToEntry }, '← 선택 화면');
    const draw = () => {
      const groups = new Map();
      pages().filter((p) => !p.deletedAt).forEach((p) => {
        const subject = p.subject || '미분류', unit = p.unit || '단원 없음';
        if (!groups.has(subject)) groups.set(subject, new Map());
        if (!groups.get(subject).has(unit)) groups.get(subject).set(unit, []);
        groups.get(subject).get(unit).push(p);
      });
      list.replaceChildren(listBack, ...[...groups].map(([subject, units]) => h('details', { class: 'study-group', open: true },
        h('summary', null, subject), [...units].map(([unit, items]) => h('details', { class: 'study-unit', open: true },
          h('summary', null, unit), items.map((p) => h('button', { class: 'btn', type: 'button', onclick: () => open(p) }, p.title)))))));
    };
    const open = (page = null) => {
      list.hidden = true; editor.hidden = false; entry.hidden = true; backHandler = returnToEntry;
      const id = page?.id || uid();
      const subject = h('input', { type: 'text', value: page?.subject || '', placeholder: '과목' });
      const unit = h('input', { type: 'text', value: page?.unit || '', placeholder: '단원' });
      const title = h('input', { type: 'text', value: page?.title || '', placeholder: '제목' });
      const body = h('textarea', { rows: 12, placeholder: '필기 내용을 입력하세요', value: page?.body || '' });
      const drawing = h('div');
      editor.replaceChildren(back, h('div', { class: 'row3' }, App.field('과목', subject), App.field('단원', unit), App.field('제목', title)), App.field('내용', body),
        h('div', { class: 'set-row' }, h('button', { class: 'btn primary', type: 'button', onclick: () => {
          if (!subject.value.trim() || !title.value.trim()) return App.toast('과목과 제목을 입력해 주세요.');
          savePages([{ id, subject: subject.value.trim(), unit: unit.value.trim(), title: title.value.trim(), body: body.value, updatedAt: Date.now() }, ...pages().filter((p) => p.id !== id)]);
          draw(); App.toast('필기를 저장했어요.');
        } }, '필기 저장'), page ? h('button', { class: 'btn danger', type: 'button', onclick: () => { savePages(pages().map((p) => p.id === id ? { ...p, deletedAt: Date.now() } : p)); editor.replaceChildren(); editor.hidden = true; list.hidden = false; draw(); } }, '휴지통') : null),
        h('h3', null, '그림 필기'), drawing);
      board(drawing, 'study-' + id);
    };
    const savedView = () => { editor.replaceChildren(); editor.hidden = true; entry.hidden = true; list.hidden = false; backHandler = returnToEntry; draw(); };
    const openTrash = () => {
      const deleted = pages().filter((p) => p.deletedAt);
      const m = App.modal({ title: '필기 휴지통', body: deleted.length ? h('div', { class: 'creative-trash-list' }, deleted.map((p) => h('div', { class: 'creative-trash-row' }, h('b', null, p.title),
        h('button', { class: 'btn', type: 'button', onclick: () => { savePages(pages().map((x) => x.id === p.id ? { ...x, deletedAt: null } : x)); m.close(); draw(); openTrash(); } }, '복원'),
        h('button', { class: 'btn danger', type: 'button', onclick: async () => { if (!confirm('영구 삭제할까요?')) return; await Store.delImg('study-' + p.id); savePages(pages().filter((x) => x.id !== p.id)); m.close(); draw(); openTrash(); } }, '영구 삭제')))) : h('p', { class: 'muted' }, '휴지통이 비어 있어요.'),
        footer: deleted.length ? [h('button', { class: 'btn danger', type: 'button', onclick: async () => { if (!confirm('휴지통을 비울까요?')) return; for (const p of deleted) await Store.delImg('study-' + p.id); savePages(pages().filter((p) => !p.deletedAt)); m.close(); draw(); openTrash(); } }, '휴지통 비우기')] : null });
    };
    root.append(h('section', { class: 'panel' }, h('div', { class: 'title-row' }, h('h1', { class: 'page-title' }, '필기 공간'), h('button', { class: 'trash-icon-btn', type: 'button', title: '필기 휴지통', 'aria-label': '필기 휴지통', onclick: openTrash }, icon('trash'))),
      entry, list, editor));
    entry.append(
      h('button', { class: 'creative-entry-card', type: 'button', onclick: savedView }, icon('study'), h('b', null, '저장한 필기'), h('span', null, '과목과 단원별로 찾아봐요.')),
      h('button', { class: 'creative-entry-card', type: 'button', onclick: () => { entry.hidden = true; list.hidden = true; editor.hidden = false; open(); } }, icon('study'), h('b', null, '새 필기'), h('span', null, '글과 그림으로 정리해요.')));
    list.hidden = true; editor.hidden = true;
    draw();
  }
  return { whiteboard, study, back: () => { if (!backHandler) return false; backHandler(); return true; }, resetBack: () => { backHandler = null; } };
})();
App.registerView('whiteboard', { label: '화이트보드', icon: 'whiteboard', render: Creative.whiteboard });
App.registerView('study', { label: '필기 공간', icon: 'study', render: Creative.study });
