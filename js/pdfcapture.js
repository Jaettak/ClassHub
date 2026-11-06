// PDF 캡처: PDF에서 영역을 드래그해 잘라내고, 그 위에 글을 쓰거나 타이핑한다
const PdfCapture = (() => {
  const st = { doc: null, name: '', page: 1, zoom: 1, select: true, token: 0, task: null };
  if (typeof pdfjsLib !== 'undefined') pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';

  const captures = () => Store.get('captures', []);
  const folders = () => Store.get('captureFolders', []);
  const folderField = (value = '') => h('select', { 'aria-label': '오답 보관함' },
    h('option', { value: '' }, '기본 보관함'), folders().map((folder) => h('option', { value: folder.id, selected: folder.id === value }, folder.name)));

  function addReference(after, record = null) {
    const book = h('input', { type: 'text', value: record?.title || '', placeholder: '예: 수학 문제집 이름', maxLength: 80 });
    const number = h('input', { type: 'text', value: record?.problemNumber || '', placeholder: '예: 32쪽 5번', maxLength: 60 });
    const subject = App.subjectField('과목', record?.subject || '', { empty: '과목 선택 안 함' });
    const folder = folderField(record?.folderId);
    const memo = h('textarea', { rows: 3, placeholder: '나중에 다시 볼 이유 (선택)', value: record?.memo || '' });
    const m = App.modal({ title: record ? '문제 번호 수정' : '문제 번호만 기록', body: [App.field('문제집', book), App.field('문제 번호', number), subject.el, App.field('보관함', folder), App.field('메모', memo)], footer: [
      h('button', { class: 'btn primary', type: 'button', onclick: () => {
        if (!book.value.trim() || !number.value.trim()) return App.toast('문제집과 문제 번호를 입력해 주세요.');
        Store.set('captures', [{ id: record?.id || uid(), title: book.value.trim(), problemNumber: number.value.trim(), subject: subject.value(), folderId: folder.value, memo: memo.value.trim(), sourceType: 'reference', created: record?.created || Date.now() }, ...captures().filter((c) => c.id !== record?.id)]);
        m.close(); after();
      } }, '저장') ] });
  }

  // ---------- 이미지 편집기 ----------
  function openEditor(rec, after) {
    const img = new Image();
    const canvas = h('canvas', { class: 'ed-canvas' });
    const wrap = h('div', { class: 'ed-wrap' }, canvas);
    const ctx = canvas.getContext('2d');
    const ann = JSON.parse(JSON.stringify(rec.ann || []));
    const undone = [];
    const tool = { name: 'pen', color: '#e53935', size: 4 };
    const background = h('input', { type: 'color', value: rec.background || '#ffffff', 'aria-label': '배경색' });
    let cur = null;
    let ta = null;
    let selection = null, clipboard = null, selectedPatch = null;
    const patchImages = new Map();

    const K = () => Math.min(4, Math.max(1, canvas.width / 700));
    const fontPx = (s) => (s * 3 + 10) * K();

    function drawAnn(a) {
      if (['pen', 'marker', 'eraser'].includes(a.t)) {
        ctx.globalAlpha = a.t === 'marker' ? .3 : 1;
        ctx.strokeStyle = a.t === 'eraser' ? background.value : a.c;
        ctx.lineWidth = a.s * K();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        DrawTools.smoothPath(ctx, a.p);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (a.t === 'cover') {
        ctx.fillStyle = background.value; ctx.fillRect(a.x, a.y, a.w, a.h);
      } else if (a.t === 'patch') {
        if (!patchImages.has(a.data)) { const patch = new Image(); patchImages.set(a.data, patch); patch.onload = () => redraw(); patch.src = a.data; }
        const patch = patchImages.get(a.data); if (patch.complete && patch.naturalWidth) {
          ctx.save(); ctx.translate(a.x + a.w / 2, a.y + a.h / 2); ctx.rotate(a.angle || 0); ctx.drawImage(patch, -a.w / 2, -a.h / 2, a.w, a.h); ctx.restore();
        }
      } else if (['line', 'rect', 'triangle', 'ellipse'].includes(a.t)) {
        ctx.strokeStyle = a.c; ctx.lineWidth = a.s * K(); ctx.lineCap = 'round';
        const [x1, y1] = a.p[0], [x2, y2] = a.p[1] || a.p[0];
        ctx.beginPath();
        if (a.t === 'line') { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
        else if (a.t === 'rect') ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
        else if (a.t === 'triangle') { ctx.moveTo((x1 + x2) / 2, y1); ctx.lineTo(x2, y2); ctx.lineTo(x1, y2); ctx.closePath(); }
        else ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.max(0.01, Math.abs(x2 - x1) / 2), Math.max(0.01, Math.abs(y2 - y1) / 2), 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const fs = fontPx(a.s);
        ctx.font = `700 ${fs}px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`;
        ctx.textBaseline = 'top';
        ctx.lineJoin = 'round';
        a.text.split('\n').forEach((line, i) => {
          ctx.lineWidth = fs / 6;
          ctx.strokeStyle = 'rgba(255,255,255,.9)';
          ctx.strokeText(line, a.x, a.y + i * fs * 1.25);
          ctx.fillStyle = a.c;
          ctx.fillText(line, a.x, a.y + i * fs * 1.25);
        });
      }
    }
    function redraw(showSelection = true) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      if (rec.sourceType === 'drawing') { ctx.fillStyle = background.value; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      else if (background.value !== '#ffffff') { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = background.value; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.globalCompositeOperation = 'source-over'; }
      ann.forEach(drawAnn);
      if (showSelection && selection?.start) { ctx.save(); ctx.setLineDash([10, 6]); ctx.strokeStyle = '#2874e4'; ctx.lineWidth = 2 * K(); ctx.strokeRect(selection.x, selection.y, selection.w, selection.h); ctx.restore(); }
    }
    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      return [(e.clientX - r.left) * canvas.width / r.width, (e.clientY - r.top) * canvas.height / r.height];
    };
    const captureSelection = () => {
      if (!selection) return null;
      if (selectedPatch) return { data: selectedPatch.data, w: selectedPatch.w, h: selectedPatch.h };
      redraw(false);
      const copy = document.createElement('canvas'); copy.width = Math.ceil(selection.w); copy.height = Math.ceil(selection.h);
      copy.getContext('2d').drawImage(canvas, selection.x, selection.y, selection.w, selection.h, 0, 0, copy.width, copy.height);
      return { data: copy.toDataURL('image/png'), w: copy.width, h: copy.height };
    };
    const promoteSelection = () => {
      if (selectedPatch) return selectedPatch;
      const copied = captureSelection(); if (!copied) return null;
      const group = uid();
      ann.push({ t: 'cover', x: selection.x, y: selection.y, w: selection.w, h: selection.h, group });
      selectedPatch = { t: 'patch', data: copied.data, x: selection.x, y: selection.y, w: copied.w, h: copied.h, angle: 0, group };
      ann.push(selectedPatch); undone.length = 0; return selectedPatch;
    };
    const frame = DrawTools.selectionFrame(wrap, canvas,
      (dx, dy, start) => { const patch = promoteSelection(); if (!patch) return; patch.x = start.x + dx; patch.y = start.y + dy; selection = { ...start, x: patch.x, y: patch.y }; redraw(); frame.show(selection); },
      (angle, start) => { const patch = promoteSelection(); if (!patch) return; patch.angle = (start.angle || 0) + angle; selection = { ...start, angle: patch.angle }; redraw(); frame.show(selection); });

    function commitText() {
      if (!ta) return;
      const box = ta;
      ta = null;
      const t = box.value.replace(/\s+$/, '');
      const meta = box._meta;
      box.remove();
      if (box._cancel) {
        if (meta.orig) ann.splice(Math.min(meta.idx, ann.length), 0, meta.orig);
      } else if (t) {
        ann.splice(Math.min(meta.idx, ann.length), 0, { t: 'text', x: meta.x, y: meta.y, text: t, c: meta.c, s: meta.s });
        undone.length = 0;
      }
      redraw();
    }
    // 글자 영역 (이동·수정할 글자를 찾는 데 사용)
    function textBox(a) {
      const fs = fontPx(a.s);
      ctx.font = `700 ${fs}px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`;
      const lines = a.text.split('\n');
      const w = Math.max(...lines.map((l) => ctx.measureText(l).width));
      return { x: a.x, y: a.y, w, h: lines.length * fs * 1.25 };
    }
    function hitText(x, y) {
      const pad = 6 * K();
      for (let i = ann.length - 1; i >= 0; i--) {
        const a = ann[i];
        if (a.t !== 'text') continue;
        const b = textBox(a);
        if (x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad) return a;
      }
      return null;
    }
    function openTextBox(x, y, meta, value) {
      commitText();
      const r = canvas.getBoundingClientRect();
      const wr = wrap.getBoundingClientRect();
      const disp = r.width / canvas.width;
      ta = h('textarea', { class: 'ed-text', rows: 1, placeholder: '입력 후 바깥을 누르면 적용', spellcheck: false, value });
      ta._meta = meta;
      ta.style.cssText = `left:${r.left - wr.left + wrap.scrollLeft + x * disp}px;top:${r.top - wr.top + wrap.scrollTop + y * disp}px;font-size:${fontPx(meta.s) * disp}px;color:${meta.c};`;
      const fit = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; ta.style.width = Math.max(120, ta.scrollWidth) + 'px'; };
      ta.addEventListener('input', fit);
      ta.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') { if (meta.orig) ta._cancel = true; else ta.value = ''; commitText(); ev.stopPropagation(); }
      });
      const box = ta;
      ta.addEventListener('blur', () => { if (ta === box) commitText(); });
      wrap.append(ta);
      fit();
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
    function startText(e) {
      const [x, y] = pos(e);
      openTextBox(x, y, { x, y, c: tool.color, s: tool.size, idx: ann.length }, '');
    }
    // 이미 쓴 글자를 눌러 다시 고친다
    function editText(a) {
      const idx = ann.indexOf(a);
      commitText();
      const i = ann.indexOf(a);
      ann.splice(i < 0 ? idx : i, 1);
      redraw();
      tool.color = a.c; tool.size = a.s;
      color.value = a.c; size.value = a.s;
      openTextBox(a.x, a.y, { x: a.x, y: a.y, c: a.c, s: a.s, idx: Math.max(0, i), orig: a }, a.text);
    }

    let mv = null;
    let moved = false;
    let skipClick = false;
    canvas.addEventListener('click', (e) => {
      if (tool.name !== 'text') return;
      if (skipClick) { skipClick = false; return; }
      const [x, y] = pos(e);
      const a = hitText(x, y);
      if (a) editText(a); else startText(e);
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      if (tool.name === 'select') { const [x, y] = pos(e); selectedPatch = null; selection = { x, y, w: 0, h: 0, start: [x, y] }; frame.hide(); canvas.setPointerCapture(e.pointerId); redraw(); return; }
      selection = null; selectedPatch = null; frame.hide();
      if (tool.name === 'text') {
        commitText();
        const [x, y] = pos(e);
        const a = hitText(x, y);
        if (a) {
          mv = { a, dx: x - a.x, dy: y - a.y, sx: x, sy: y };
          moved = false;
          canvas.setPointerCapture(e.pointerId);
          e.preventDefault();
        }
        return;
      }
      commitText();
      canvas.setPointerCapture(e.pointerId);
      const [x, y] = pos(e);
      cur = { t: tool.name, c: tool.color, s: tool.size, p: [[x, y]] };
      drawAnn(cur);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (tool.name === 'select' && selection?.start) { const [x, y] = pos(e), [sx, sy] = selection.start; Object.assign(selection, { x: Math.min(x, sx), y: Math.min(y, sy), w: Math.abs(x - sx), h: Math.abs(y - sy) }); redraw(); return; }
      if (mv) {
        const [x, y] = pos(e);
        if (!moved && Math.hypot(x - mv.sx, y - mv.sy) < 5 * K()) return;
        moved = true;
        mv.a.x = Math.max(0, Math.min(canvas.width - 10, x - mv.dx));
        mv.a.y = Math.max(0, Math.min(canvas.height - 10, y - mv.dy));
        canvas.style.cursor = 'grabbing';
        redraw();
        return;
      }
      if (!cur) {
        if (tool.name === 'text') { const [x, y] = pos(e); canvas.style.cursor = hitText(x, y) ? 'move' : 'text'; }
        return;
      }
      const [x, y] = pos(e);
      if (!['pen', 'marker', 'eraser'].includes(cur.t)) { cur.p[1] = [x, y]; redraw(); drawAnn(cur); return; }
      cur.p.push([x, y]);
      DrawTools.liveSegment(ctx, cur.p, cur.t === 'eraser' ? background.value : cur.c, cur.s * K(), cur.t === 'marker' ? .3 : 1);
    });
    const endStroke = () => {
      if (selection?.start) { delete selection.start; if (selection.w < 2 || selection.h < 2) { selection = null; frame.hide(); } else frame.show(selection); redraw(); return; }
      if (mv) { skipClick = moved; mv = null; canvas.style.cursor = 'move'; setTimeout(() => { skipClick = false; }, 0); return; }
      if (cur) { ann.push(cur); undone.length = 0; cur = null; redraw(); }
    };
    canvas.addEventListener('pointerup', endStroke);
    canvas.addEventListener('pointercancel', endStroke);

    const title = h('input', { type: 'text', value: rec.title || '', placeholder: '제목 (예: 수학 3번 오답)', maxLength: 60 });
    const problemNumber = h('input', { type: 'text', value: rec.problemNumber || '', placeholder: '예: 3번, 12~14번', maxLength: 40 });
    const subject = App.subjectField('과목', rec.subject || '', { empty: '과목 선택 안 함' });
    const folder = folderField(rec.folderId);
    const memo = h('textarea', { rows: 3, placeholder: '틀린 이유, 개념 정리, 다음에 할 일 등', value: rec.memo || '' });

    const toolBtns = {};
    const shapePicker = DrawTools.shapePicker((key) => setTool(key));
    const setTool = (n) => {
      commitText();
      tool.name = n;
      Object.entries(toolBtns).forEach(([k, b]) => b.classList.toggle('on', k === n));
      shapePicker.main.classList.toggle('on', shapePicker.choices.includes(n));
      canvas.style.cursor = n === 'text' ? 'text' : n === 'select' ? 'default' : 'crosshair';
    };
    for (const key of Object.keys(DrawTools.labels).filter((key) => !shapePicker.choices.includes(key))) toolBtns[key] = DrawTools.button(key, () => setTool(key));
    toolBtns.pen.classList.add('on');
    const color = h('input', { type: 'color', value: tool.color, 'aria-label': '색상', oninput: (e) => { tool.color = e.target.value; } });
    const quick = ['#e53935', '#1e66f5', '#2e9e5b', '#111111', '#ff9800'].map((c) => h('button', { type: 'button', class: 'sw', style: { background: c }, 'aria-label': c,
      onclick: () => { tool.color = c; color.value = c; } }));
    const size = h('input', { type: 'range', min: 1, max: 12, value: tool.size, 'aria-label': '굵기·글자 크기', oninput: (e) => { tool.size = Number(e.target.value); } });
    const selectAction = (label, action) => h('button', { class: 'btn', type: 'button', onclick: () => {
      if (action === 'paste') {
        if (!clipboard) return App.toast('먼저 영역을 복사하세요.');
        const x = selection ? selection.x + 24 * K() : (canvas.width - clipboard.w) / 2;
        const y = selection ? selection.y + 24 * K() : (canvas.height - clipboard.h) / 2;
        selectedPatch = { t: 'patch', data: clipboard.data, x, y, w: clipboard.w, h: clipboard.h, angle: 0 };
        ann.push(selectedPatch); selection = { x, y, w: clipboard.w, h: clipboard.h, angle: 0 };
        undone.length = 0; setTool('select'); redraw(); frame.show(selection); return;
      }
      if (!selection || selection.w < 2 || selection.h < 2) return App.toast('먼저 영역을 드래그해 선택하세요.');
      if (action === 'copy' || action === 'cut') clipboard = captureSelection();
      if (action === 'move') { promoteSelection(); redraw(); frame.show(selection); return; }
      if (action === 'cut' || action === 'delete') {
        if (selectedPatch) ann.splice(ann.indexOf(selectedPatch), 1);
        else ann.push({ t: 'cover', x: selection.x, y: selection.y, w: selection.w, h: selection.h });
        selectedPatch = null; selection = null; frame.hide(); undone.length = 0; redraw();
      } else App.toast('영역을 복사했어요. 붙여넣기를 누르세요.');
    } }, label);
    const bar = h('div', { class: 'ed-tools' },
      h('div', { class: 'draw-tool-buttons' }, Object.values(toolBtns), shapePicker.el),
      h('div', { class: 'draw-selection-actions' }, selectAction('옮기기', 'move'), selectAction('복사', 'copy'), selectAction('붙여넣기', 'paste'), selectAction('잘라내기', 'cut'), selectAction('선택 삭제', 'delete')),
      h('label', { class: 'creative-color-label' }, '펜 색', color), quick, h('label', { class: 'size' }, '크기', size),
      h('label', { class: 'creative-color-label' }, '보드 색', background),
      h('button', { type: 'button', class: 'btn', title: '이전', 'aria-label': '이전', onclick: () => { commitText(); if (ann.length) { const last = ann.pop(), batch = [last]; if (last.group && ann.at(-1)?.group === last.group) batch.unshift(ann.pop()); undone.push(batch); selection = null; selectedPatch = null; frame.hide(); } redraw(); } }, '↶'),
      h('button', { type: 'button', class: 'btn', title: '이후', 'aria-label': '이후', onclick: () => { if (undone.length) ann.push(...undone.pop()); redraw(); } }, '↷'),
      h('button', { type: 'button', class: 'btn ghost', onclick: () => { if (ann.length && confirm('쓴 내용을 모두 지울까요?')) { commitText(); ann.length = 0; redraw(); } } }, '모두 지우기'));

    const flatten = async () => { commitText(); await Promise.all([...patchImages.values()].map((image) => image.decode().catch(() => {}))); redraw(false); return canvas.toDataURL('image/png'); };

    async function saveIt() {
      const id = rec.id || uid();
      const flat = await flatten();
      try {
        await Store.putImg(id, { flat, base: rec.base });
      } catch (e) {
        App.toast('이미지를 저장하지 못했어요. 저장 공간을 확인해 주세요.');
        return;
      }
      const list = captures().filter((c) => c.id !== id);
      list.unshift({ id, title: title.value.trim() || problemNumber.value.trim() || '제목 없음', subject: subject.value(), folderId: folder.value, problemNumber: problemNumber.value.trim(), sourceType: rec.sourceType || 'pdf', background: background.value, memo: memo.value.trim(), ann, created: rec.created || Date.now() });
      Store.set('captures', list);
      m.close();
      App.toast('저장했어요!');
      after();
    }

    const m = App.modal({
      title: rec.id ? '오답 편집' : '오답 정리하기',
      wide: true,
      body: [bar, wrap, h('div', { class: 'row2' }, App.field('제목', title), subject.el), App.field('보관함', folder), App.field('문제 번호 (선택)', problemNumber), App.field('메모', memo)],
      footer: [
        h('button', { class: 'btn', type: 'button', onclick: async () => App.download(`${title.value.trim() || '오답'}.png`, await flatten()) }, 'PNG로 저장'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, '취소'),
        h('button', { class: 'btn primary', type: 'button', onclick: saveIt }, '저장'),
      ],
    });
    canvas.style.cursor = 'crosshair';
    img.onload = () => { canvas.width = img.naturalWidth; canvas.height = img.naturalHeight; redraw(); };
    img.src = rec.base;
    background.addEventListener('input', redraw);
  }

  // ---------- PDF 보기 ----------
  function render(root) {
    const pageInput = h('input', { type: 'number', class: 'pg-input', min: 1, value: 1, 'aria-label': '이동할 페이지 번호' });
    const pageTotal = h('span', { class: 'pg' }, '/ 0');
    const pageLabel = h('span', { class: 'pg-box' }, pageInput, pageTotal);
    const fileInput = h('input', { type: 'file', accept: 'application/pdf,.pdf', hidden: true });
    const imageInput = h('input', { type: 'file', accept: 'image/*', hidden: true });
    const cameraInput = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
    const stage = h('div', { class: 'pdf-stage' });
    const gallery = h('section', { class: 'gallery' });
    const canvas = h('canvas', { class: 'pdf-canvas' });
    const layer = h('div', { class: 'sel-layer' });
    const rectEl = h('div', { class: 'sel-rect', hidden: true });
    const actions = h('div', { class: 'sel-actions', hidden: true });
    const pageBox = h('div', { class: 'pdf-page' }, canvas, layer, rectEl, actions);
    let sel = null;

    function setSel(r) {
      sel = r;
      if (!r) { rectEl.hidden = true; actions.hidden = true; return; }
      rectEl.hidden = false;
      Object.assign(rectEl.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
    }
    function showActions() {
      if (!sel) return;
      actions.hidden = false;
      const below = sel.y + sel.h + 52 < pageBox.clientHeight;
      actions.style.left = Math.max(0, Math.min(sel.x, pageBox.clientWidth - 220)) + 'px';
      actions.style.top = (below ? sel.y + sel.h + 8 : Math.max(0, sel.y - 46)) + 'px';
    }

    let drag = null;
    layer.addEventListener('pointerdown', (e) => {
      if (!st.select || e.button > 0) return;
      const r = pageBox.getBoundingClientRect();
      drag = { x: e.clientX - r.left, y: e.clientY - r.top, r };
      layer.setPointerCapture(e.pointerId);
      actions.hidden = true;
      setSel({ x: drag.x, y: drag.y, w: 0, h: 0 });
      e.preventDefault();
    });
    layer.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const cx = Math.max(0, Math.min(drag.r.width, e.clientX - drag.r.left));
      const cy = Math.max(0, Math.min(drag.r.height, e.clientY - drag.r.top));
      setSel({ x: Math.min(drag.x, cx), y: Math.min(drag.y, cy), w: Math.abs(cx - drag.x), h: Math.abs(cy - drag.y) });
    });
    const endDrag = () => {
      if (!drag) return;
      drag = null;
      if (sel && (sel.w < 12 || sel.h < 12)) setSel(null); else showActions();
    };
    layer.addEventListener('pointerup', endDrag);
    layer.addEventListener('pointercancel', endDrag);

    function crop() {
      if (!sel) return;
      const k = canvas.width / pageBox.clientWidth;
      const sw = Math.max(1, Math.round(sel.w * k));
      const sh = Math.max(1, Math.round(sel.h * k));
      const c = document.createElement('canvas');
      c.width = sw; c.height = sh;
      const cx = c.getContext('2d');
      cx.fillStyle = '#fff';
      cx.fillRect(0, 0, sw, sh);
      cx.drawImage(canvas, Math.round(sel.x * k), Math.round(sel.y * k), sw, sh, 0, 0, sw, sh);
      const base = c.toDataURL('image/png');
      setSel(null);
      openEditor({ base, title: st.name ? `${st.name.replace(/\.pdf$/i, '')} p.${st.page}` : '', subject: '', memo: '', ann: [] }, drawGallery);
    }
    actions.append(
      h('button', { type: 'button', class: 'btn primary', onclick: crop }, '이 부분 가져오기'),
      h('button', { type: 'button', class: 'btn ghost', onclick: () => setSel(null) }, '취소'));

    async function renderPage() {
      if (!st.doc) return;
      const my = ++st.token;
      if (st.task) { try { st.task.cancel(); await st.task.promise; } catch (e) { /* 취소됨 */ } }
      const page = await st.doc.getPage(st.page);
      if (my !== st.token) return;
      const base = page.getViewport({ scale: 1 });
      const avail = Math.max(260, stage.clientWidth - 24);
      const css = (avail / base.width) * st.zoom;
      let scale = css * Math.max(2, Math.min(window.devicePixelRatio || 1, 3));
      if (base.width * scale > 3200) scale = 3200 / base.width;
      const vp = page.getViewport({ scale });
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      pageBox.style.width = base.width * css + 'px';
      pageBox.style.height = base.height * css + 'px';
      setSel(null);
      pageInput.value = st.page;
      pageInput.max = st.doc.numPages;
      pageTotal.textContent = `/ ${st.doc.numPages}`;
      const task = page.render({ canvasContext: canvas.getContext('2d'), viewport: vp });
      st.task = task;
      try { await task.promise; } catch (e) { /* 새 렌더링으로 교체됨 */ }
    }

    const dropzone = h('div', { class: 'dropzone', tabIndex: 0, onclick: () => fileInput.click(),
      onkeydown: (e) => { if (e.key === 'Enter') fileInput.click(); } },
    h('b', null, 'PDF 파일을 선택하거나 여기에 끌어다 놓으세요'),
    h('small', null, 'PDF는 저장되지 않고, 잘라낸 이미지만 저장돼요.'));
    const pdfSection = h('div', { class: 'pdf-section' });

    function drawStage() {
      stage.replaceChildren();
      stage.classList.toggle('select-on', st.select);
      pdfSection.hidden = !st.doc;
      dropzone.hidden = !!st.doc;
      if (!st.doc) return;
      stage.append(pageBox);
      renderPage();
    }

    function closePdf() {
      if (!st.doc) return;
      if (!confirm('열어 둔 PDF를 지울까요? (저장한 오답노트는 그대로 남아요)')) return;
      st.token++;
      try { st.doc.destroy(); } catch (e) { /* 무시 */ }
      st.doc = null;
      st.name = '';
      setSel(null);
      drawStage();
    }

    async function openFile(file) {
      if (!file) return;
      if (typeof pdfjsLib === 'undefined') return App.toast('PDF 라이브러리를 불러오지 못했어요.');
      if (!/pdf$/i.test(file.name) && file.type !== 'application/pdf') return App.toast('PDF 파일만 올릴 수 있어요.');
      try {
        const data = new Uint8Array(await file.arrayBuffer());
        if (st.doc) { try { st.doc.destroy(); } catch (e) { /* 무시 */ } }
        st.doc = await pdfjsLib.getDocument({ data }).promise;
        st.name = file.name;
        st.page = 1;
        st.zoom = 1;
        drawStage();
      } catch (e) {
        console.error(e);
        App.toast('PDF를 열지 못했어요. (암호가 걸려 있거나 손상된 파일일 수 있어요)');
      }
    }
    fileInput.addEventListener('change', () => { openFile(fileInput.files[0]); fileInput.value = ''; });
    const blankBase = () => {
      const c = document.createElement('canvas'); c.width = 2200; c.height = 1500;
      const cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height);
      return c.toDataURL('image/png');
    };
    const openImage = (file) => {
      if (!file || !file.type.startsWith('image/')) return App.toast('사진 파일을 선택해 주세요.');
      if (file.size > 25 * 1024 * 1024) return App.toast('25MB 이하 사진을 선택해 주세요.');
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, 2200 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * scale)); c.height = Math.max(1, Math.round(img.naturalHeight * scale));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        openEditor({ base: c.toDataURL('image/jpeg', .85), title: file.name.replace(/\.[^.]+$/, ''), sourceType: 'image', ann: [] }, drawGallery);
      };
      img.onerror = () => { URL.revokeObjectURL(url); App.toast('사진을 열지 못했어요.'); };
      img.src = url;
    };
    imageInput.addEventListener('change', () => { openImage(imageInput.files[0]); imageInput.value = ''; });
    cameraInput.addEventListener('change', () => { openImage(cameraInput.files[0]); cameraInput.value = ''; });
    const dropTarget = h('section', { class: 'panel' });
    dropTarget.addEventListener('dragover', (e) => { e.preventDefault(); dropTarget.classList.add('drag'); });
    dropTarget.addEventListener('dragleave', (e) => { if (e.target === dropTarget) dropTarget.classList.remove('drag'); });
    dropTarget.addEventListener('drop', (e) => { e.preventDefault(); dropTarget.classList.remove('drag'); openFile(e.dataTransfer.files[0]); });

    const go = (n) => { if (!st.doc) return; st.page = Math.min(st.doc.numPages, Math.max(1, n)); renderPage(); };
    pageInput.addEventListener('change', () => {
      const n = Math.round(Number(pageInput.value));
      if (!Number.isFinite(n) || n < 1) { pageInput.value = st.page; return; }
      go(n);
    });
    pageInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') pageInput.blur(); });
    pageInput.addEventListener('focus', () => pageInput.select());
    const zoom = (z) => { st.zoom = Math.min(3, Math.max(0.5, Math.round(z * 100) / 100)); renderPage(); };
    const modeLabel = () => (st.select ? '영역 선택 켜짐' : '스크롤 모드');
    const modeBtn = h('button', { type: 'button', class: 'btn tool' + (st.select ? ' on' : ''), onclick: () => {
      st.select = !st.select;
      modeBtn.classList.toggle('on', st.select);
      modeBtn.textContent = modeLabel();
      stage.classList.toggle('select-on', st.select);
      setSel(null);
    } }, modeLabel());

    const toolbar = h('div', { class: 'pdf-tools' },
      h('button', { type: 'button', class: 'btn', onclick: () => go(st.page - 1), 'aria-label': '이전 쪽' }, '◀'),
      pageLabel,
      h('button', { type: 'button', class: 'btn', onclick: () => go(st.page + 1), 'aria-label': '다음 쪽' }, '▶'),
      h('button', { type: 'button', class: 'btn', onclick: () => zoom(st.zoom - 0.25), 'aria-label': '축소' }, '－'),
      h('button', { type: 'button', class: 'btn', onclick: () => zoom(st.zoom + 0.25), 'aria-label': '확대' }, '＋'),
      modeBtn,
      h('button', { type: 'button', class: 'btn danger', onclick: closePdf }, 'PDF 지우기'));
    pdfSection.append(toolbar, stage);

    let subjFilter = '', folderFilter = '*';
    const addFolder = () => {
      const name = prompt('새 오답 보관함 이름')?.trim();
      if (!name) return;
      Store.set('captureFolders', [...folders(), { id: uid(), name: name.slice(0, 30) }]); drawGallery();
    };
    const manageFolder = () => {
      const current = folders().find((item) => item.id === folderFilter); if (!current) return;
      const name = h('input', { type: 'text', value: current.name, maxLength: 30 });
      const m = App.modal({ title: '오답 보관함 관리', body: App.field('이름', name), footer: [
        h('button', { class: 'btn danger', type: 'button', onclick: () => {
          if (!confirm('보관함을 지울까요? 안의 오답은 기본 보관함으로 이동해요.')) return;
          Store.set('captureFolders', folders().filter((item) => item.id !== current.id));
          Store.set('captures', captures().map((item) => item.folderId === current.id ? { ...item, folderId: '' } : item));
          folderFilter = '*'; m.close(); drawGallery();
        } }, '보관함 삭제'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => {
          if (!name.value.trim()) return; Store.set('captureFolders', folders().map((item) => item.id === current.id ? { ...item, name: name.value.trim() } : item)); m.close(); drawGallery();
        } }, '이름 저장')] });
    };
    const openTrash = () => {
      const list = captures().filter((item) => item.deletedAt);
      const m = App.modal({ title: '오답노트 휴지통', wide: true,
        body: list.length ? h('div', { class: 'cap-trash-list' }, list.map((item) => h('div', { class: 'cap-trash-row' }, h('b', null, item.title),
          h('button', { class: 'btn', type: 'button', onclick: () => { Store.set('captures', captures().map((x) => x.id === item.id ? { ...x, deletedAt: null } : x)); m.close(); drawGallery(); openTrash(); } }, '복원'),
          h('button', { class: 'btn danger', type: 'button', onclick: async () => { if (!confirm('이 오답을 영구 삭제할까요?')) return; await Store.delImg(item.id); Store.set('captures', captures().filter((x) => x.id !== item.id)); m.close(); drawGallery(); openTrash(); } }, '영구 삭제')))) : h('p', { class: 'muted' }, '휴지통이 비어 있어요.'),
        footer: list.length ? [h('button', { class: 'btn danger', type: 'button', onclick: async () => {
          if (!confirm(`휴지통의 오답 ${list.length}개를 모두 영구 삭제할까요?`)) return;
          for (const item of list) await Store.delImg(item.id);
          Store.set('captures', captures().filter((item) => !item.deletedAt)); m.close(); drawGallery();
        } }, '휴지통 비우기')] : [] });
    };
    function drawGallery() {
      const all = captures().filter((c) => !c.deletedAt);
      const subjects = [...new Set(all.map((c) => c.subject).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
      if (subjFilter && !subjects.includes(subjFilter)) subjFilter = '';
      const list = all.filter((c) => (!subjFilter || c.subject === subjFilter) && (folderFilter === '*' || (c.folderId || '') === folderFilter));
      gallery.replaceChildren(h('div', { class: 'gal-head' },
        h('h2', null, `내 오답노트 ${all.length}개`),
        subjects.length ? h('div', { class: 'chips filter-chips' }, ['', ...subjects].map((s) => h('button', { type: 'button', class: 'fchip' + (s === subjFilter ? ' on' : ''),
          onclick: () => { subjFilter = s; drawGallery(); } }, s || '전체'))) : null),
        h('div', { class: 'cap-folder-bar' },
          [['*', '전체'], ['', '기본 보관함'], ...folders().map((item) => [item.id, item.name])].map(([id, name]) => h('button', { class: 'fchip' + (folderFilter === id ? ' on' : ''), type: 'button', onclick: () => { folderFilter = id; drawGallery(); },
            ondragover: (event) => { if (id !== '*') event.preventDefault(); }, ondrop: (event) => { if (id === '*') return; event.preventDefault(); const captureId = event.dataTransfer.getData('text/classhub-capture'); if (!captureId) return; Store.set('captures', captures().map((item) => item.id === captureId ? { ...item, folderId: id } : item)); drawGallery(); } }, name)),
          h('button', { class: 'btn', type: 'button', onclick: addFolder }, '＋ 보관함'),
          folderFilter && folderFilter !== '*' ? h('button', { class: 'btn ghost', type: 'button', onclick: manageFolder }, '보관함 관리') : null,
          h('button', { class: 'btn ghost', type: 'button', onclick: openTrash }, `휴지통 ${captures().length - all.length}`)));
      if (!list.length) { gallery.append(h('div', { class: 'empty-box' }, all.length ? '이 과목의 오답이 없어요.' : 'PDF, 사진, 손그림 또는 문제 번호로 오답을 추가해 보세요.')); return; }
      const grouped = new Map();
      list.forEach((c) => {
        const group = c.subject || '과목 없음';
        if (!grouped.has(group)) grouped.set(group, h('div', { class: 'cap-grid' }));
        const textOnly = c.sourceType === 'reference';
        const im = textOnly ? null : h('img', { alt: c.title, loading: 'lazy' });
        if (im) Store.getImg(c.id).then((o) => { if (o) im.src = o.flat; });
        const open = async () => {
          const o = await Store.getImg(c.id);
          if (!o) return App.toast('이미지를 찾을 수 없어요.');
          openEditor({ ...c, base: o.base }, drawGallery);
        };
        const detail = () => {
          const image = textOnly ? null : h('img', { class: 'cap-detail-image', alt: c.title });
          if (image) Store.getImg(c.id).then((o) => { if (o) image.src = o.flat; });
          const m = App.modal({ title: c.title || '저장한 오답', wide: true,
            body: h('div', { class: 'cap-detail' }, image || h('p', null, '문제집과 번호로 저장한 오답'),
              h('div', { class: 'cap-info' }, c.subject ? h('span', { class: 'badge' }, c.subject) : null,
                c.problemNumber ? h('small', null, `문제 ${c.problemNumber}`) : null,
                c.memo ? h('p', null, c.memo) : null)),
            footer: [
              h('button', { type: 'button', class: 'btn', onclick: () => { m.close(); textOnly ? addReference(drawGallery, c) : open(); } }, '편집'),
              textOnly ? null : h('button', { type: 'button', class: 'btn', onclick: async () => { const o = await Store.getImg(c.id); if (o) App.download(`${c.title}.png`, o.flat); } }, '이미지 저장'),
              h('button', { type: 'button', class: 'btn danger', onclick: () => {
                Store.set('captures', captures().map((x) => x.id === c.id ? { ...x, deletedAt: Date.now() } : x));
                m.close(); drawGallery();
              } }, '휴지통으로 이동')]
          });
        };
        grouped.get(group).append(h('article', { class: 'cap', draggable: true, ondragstart: (event) => event.dataTransfer.setData('text/classhub-capture', c.id) },
          h('button', { class: 'cap-open', type: 'button', onclick: detail, 'aria-label': `${c.title} 자세히 보기` },
            im || h('div', { class: 'cap-text-only' }, '문제집과 번호로 저장한 오답'),
            h('b', null, c.title || '이름 없는 오답'),
            c.problemNumber ? h('small', null, `문제 ${c.problemNumber}`) : null)));
      });
      gallery.append(...[...grouped].sort(([a], [b]) => a.localeCompare(b, 'ko')).map(([name, grid]) => h('section', { class: 'cap-subject-section' }, h('h3', null, name), grid)));
    }

    dropTarget.append(
      h('div', { class: 'title-row' },
        h('h1', { class: 'page-title' }, '오답노트'),
        h('div', { class: 'wrong-add-actions' },
          h('button', { type: 'button', class: 'btn primary', onclick: () => fileInput.click() }, '＋ PDF 열기'),
          h('button', { type: 'button', class: 'btn', onclick: () => imageInput.click() }, '＋ 사진 올리기'),
          h('button', { type: 'button', class: 'btn', onclick: () => cameraInput.click() }, '사진 찍기'),
          h('button', { type: 'button', class: 'btn', onclick: () => openEditor({ base: blankBase(), title: '', sourceType: 'drawing', ann: [] }, drawGallery) }, '직접 그리기'),
          h('button', { type: 'button', class: 'btn ghost', onclick: () => addReference(drawGallery) }, '문제 번호만'))),
      fileInput, imageInput, cameraInput, dropzone, pdfSection, gallery);
    root.append(dropTarget);
    drawStage();
    drawGallery();
  }

  return { render };
})();

App.registerView('wrong', { label: '오답노트', icon: 'wrong', render: PdfCapture.render });
