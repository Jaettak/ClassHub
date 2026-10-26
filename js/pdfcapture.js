// PDF 캡처: PDF에서 영역을 드래그해 잘라내고, 그 위에 글을 쓰거나 타이핑한다
const PdfCapture = (() => {
  const st = { doc: null, name: '', page: 1, zoom: 1, select: true, token: 0, task: null };
  if (typeof pdfjsLib !== 'undefined') pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';

  const captures = () => Store.get('captures', []);

  // ---------- 이미지 편집기 ----------
  function openEditor(rec, after) {
    const img = new Image();
    const canvas = h('canvas', { class: 'ed-canvas' });
    const wrap = h('div', { class: 'ed-wrap' }, canvas);
    const ctx = canvas.getContext('2d');
    const ann = JSON.parse(JSON.stringify(rec.ann || []));
    const tool = { name: 'pen', color: '#e53935', size: 4 };
    let cur = null;
    let ta = null;

    const K = () => Math.min(4, Math.max(1, canvas.width / 700));
    const fontPx = (s) => (s * 3 + 10) * K();

    function drawAnn(a) {
      if (a.t === 'pen') {
        ctx.strokeStyle = a.c;
        ctx.lineWidth = a.s * K();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        a.p.forEach((pt, i) => (i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1])));
        if (a.p.length === 1) ctx.lineTo(a.p[0][0] + 0.01, a.p[0][1]);
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
    function redraw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      ann.forEach(drawAnn);
    }
    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      return [(e.clientX - r.left) * canvas.width / r.width, (e.clientY - r.top) * canvas.height / r.height];
    };

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
      cur = { t: 'pen', c: tool.color, s: tool.size, p: [[x, y]] };
      drawAnn(cur);
    });
    canvas.addEventListener('pointermove', (e) => {
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
      const last = cur.p[cur.p.length - 1];
      cur.p.push([x, y]);
      ctx.strokeStyle = cur.c;
      ctx.lineWidth = cur.s * K();
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(last[0], last[1]);
      ctx.lineTo(x, y);
      ctx.stroke();
    });
    const endStroke = () => {
      if (mv) { skipClick = moved; mv = null; canvas.style.cursor = 'move'; setTimeout(() => { skipClick = false; }, 0); return; }
      if (cur) { ann.push(cur); cur = null; }
    };
    canvas.addEventListener('pointerup', endStroke);
    canvas.addEventListener('pointercancel', endStroke);

    const title = h('input', { type: 'text', value: rec.title || '', placeholder: '제목 (예: 수학 3번 오답)', maxLength: 60 });
    const subject = App.subjectField('과목', rec.subject || '', { empty: '과목 선택 안 함' });
    const memo = h('textarea', { rows: 3, placeholder: '틀린 이유, 개념 정리, 다음에 할 일 등', value: rec.memo || '' });

    const toolBtns = {};
    const setTool = (n) => {
      commitText();
      tool.name = n;
      Object.entries(toolBtns).forEach(([k, b]) => b.classList.toggle('on', k === n));
      canvas.style.cursor = n === 'text' ? 'text' : 'crosshair';
    };
    toolBtns.pen = h('button', { type: 'button', class: 'btn tool on', onclick: () => setTool('pen') }, '펜');
    toolBtns.text = h('button', { type: 'button', class: 'btn tool', title: '빈 곳을 누르면 새 글자, 글자를 끌면 이동, 글자를 누르면 수정', onclick: () => setTool('text') }, '글자');
    const color = h('input', { type: 'color', value: tool.color, 'aria-label': '색상', oninput: (e) => { tool.color = e.target.value; } });
    const quick = ['#e53935', '#1e66f5', '#2e9e5b', '#111111', '#ff9800'].map((c) => h('button', { type: 'button', class: 'sw', style: { background: c }, 'aria-label': c,
      onclick: () => { tool.color = c; color.value = c; } }));
    const size = h('input', { type: 'range', min: 1, max: 12, value: tool.size, 'aria-label': '굵기·글자 크기', oninput: (e) => { tool.size = Number(e.target.value); } });
    const bar = h('div', { class: 'ed-tools' },
      toolBtns.pen, toolBtns.text, color, quick, h('label', { class: 'size' }, '크기', size),
      h('button', { type: 'button', class: 'btn', onclick: () => { commitText(); ann.pop(); redraw(); } }, '되돌리기'),
      h('button', { type: 'button', class: 'btn ghost', onclick: () => { if (ann.length && confirm('쓴 내용을 모두 지울까요?')) { commitText(); ann.length = 0; redraw(); } } }, '모두 지우기'));

    const flatten = () => { commitText(); redraw(); return canvas.toDataURL('image/png'); };

    async function saveIt() {
      const id = rec.id || uid();
      const flat = flatten();
      try {
        await Store.putImg(id, { flat, base: rec.base });
      } catch (e) {
        App.toast('이미지를 저장하지 못했어요. 저장 공간을 확인해 주세요.');
        return;
      }
      const list = captures().filter((c) => c.id !== id);
      list.unshift({ id, title: title.value.trim() || '제목 없음', subject: subject.value(), memo: memo.value.trim(), ann, created: rec.created || Date.now() });
      Store.set('captures', list);
      m.close();
      App.toast('저장했어요!');
      after();
    }

    const m = App.modal({
      title: rec.id ? '오답 편집' : '오답 정리하기',
      wide: true,
      body: [bar, wrap, h('div', { class: 'row2' }, App.field('제목', title), subject.el), App.field('메모', memo)],
      footer: [
        h('button', { class: 'btn', type: 'button', onclick: () => App.download(`${title.value.trim() || '오답'}.png`, flatten()) }, 'PNG로 저장'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, '취소'),
        h('button', { class: 'btn primary', type: 'button', onclick: saveIt }, '저장'),
      ],
    });
    canvas.style.cursor = 'crosshair';
    img.onload = () => { canvas.width = img.naturalWidth; canvas.height = img.naturalHeight; redraw(); };
    img.src = rec.base;
  }

  // ---------- PDF 보기 ----------
  function render(root) {
    const pageInput = h('input', { type: 'number', class: 'pg-input', min: 1, value: 1, 'aria-label': '이동할 페이지 번호' });
    const pageTotal = h('span', { class: 'pg' }, '/ 0');
    const pageLabel = h('span', { class: 'pg-box' }, pageInput, pageTotal);
    const fileInput = h('input', { type: 'file', accept: 'application/pdf,.pdf', hidden: true });
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

    let subjFilter = '';
    function drawGallery() {
      const all = captures();
      const subjects = [...new Set(all.map((c) => c.subject).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
      if (subjFilter && !subjects.includes(subjFilter)) subjFilter = '';
      const list = all.filter((c) => !subjFilter || c.subject === subjFilter);
      gallery.replaceChildren(h('div', { class: 'gal-head' },
        h('h2', null, `내 오답노트 ${all.length}개`),
        subjects.length ? h('div', { class: 'chips filter-chips' }, ['', ...subjects].map((s) => h('button', { type: 'button', class: 'fchip' + (s === subjFilter ? ' on' : ''),
          onclick: () => { subjFilter = s; drawGallery(); } }, s || '전체'))) : null));
      if (!list.length) { gallery.append(h('div', { class: 'empty-box' }, all.length ? '이 과목의 오답이 없어요.' : 'PDF를 열어 틀린 문제를 드래그로 잘라내 보세요. 정리한 오답이 여기에 모여요.')); return; }
      const grid = h('div', { class: 'cap-grid' });
      list.forEach((c) => {
        const im = h('img', { alt: c.title, loading: 'lazy' });
        Store.getImg(c.id).then((o) => { if (o) im.src = o.flat; });
        const open = async () => {
          const o = await Store.getImg(c.id);
          if (!o) return App.toast('이미지를 찾을 수 없어요.');
          openEditor({ ...c, base: o.base }, drawGallery);
        };
        grid.append(h('article', { class: 'cap' },
          h('button', { type: 'button', class: 'cap-img', onclick: open, 'aria-label': `${c.title} 편집` }, im),
          h('div', { class: 'cap-info' },
            h('b', null, c.title), c.subject ? h('span', { class: 'badge' }, c.subject) : null,
            c.memo ? h('p', null, c.memo) : null),
          h('div', { class: 'cap-btns' },
            h('button', { type: 'button', class: 'btn', onclick: open }, '편집'),
            h('button', { type: 'button', class: 'btn', onclick: async () => { const o = await Store.getImg(c.id); if (o) App.download(`${c.title}.png`, o.flat); } }, '저장'),
            h('button', { type: 'button', class: 'btn danger', onclick: async () => {
              if (!confirm('이 캡처를 삭제할까요?')) return;
              await Store.delImg(c.id);
              Store.set('captures', captures().filter((x) => x.id !== c.id));
              drawGallery();
            } }, '삭제'))));
      });
      gallery.append(grid);
    }

    dropTarget.append(
      h('div', { class: 'title-row' },
        h('h1', { class: 'page-title' }, '오답노트'),
        h('button', { type: 'button', class: 'btn primary', onclick: () => fileInput.click() }, '＋ PDF 열어서 오답 추가')),
      fileInput, dropzone, pdfSection, gallery);
    root.append(dropTarget);
    drawStage();
    drawGallery();
  }

  return { render };
})();

App.registerView('wrong', { label: '오답노트', icon: 'wrong', render: PdfCapture.render });
