// 로고와 같은 둥글고 납작한 스타일의 아이콘 (직접 그린 SVG)
const ICONS = {
  study: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="9" y="8" width="46" height="49" rx="11" fill="#6555ca"/><path d="M19 8v49" stroke="#4432a5" stroke-width="6"/><path d="M28 20h18M28 30h14M28 40h18" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="m41 50 10-16 6 4-10 16-7 3z" fill="#ffd675"/></svg>',
  whiteboard: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="5" y="8" width="54" height="43" rx="10" fill="#aab6c9"/><rect x="11" y="14" width="42" height="31" rx="5" fill="#fff"/><path d="M17 36 29 23l9 8 8-7" fill="none" stroke="#8391a8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 52h16M32 51v7" stroke="#78879e" stroke-width="4" stroke-linecap="round"/></svg>',
  school: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M23 5h18v17h16v37H7V22h16Z" fill="#3e91d1"/><path d="M23 5h18v17H23Z" fill="#2873b4"/><path d="M7 22h50" stroke="#1d679f" stroke-width="4"/><circle cx="32" cy="14" r="6" fill="#fff"/><path d="M32 10v4l3 2" fill="none" stroke="#246399" stroke-width="1.7" stroke-linecap="round"/><path d="M26 59V43a6 6 0 0 1 12 0v16" fill="#fff"/><g fill="#dff5ff"><rect x="12" y="29" width="8" height="9" rx="1"/><rect x="44" y="29" width="8" height="9" rx="1"/><rect x="12" y="44" width="8" height="9" rx="1"/><rect x="44" y="44" width="8" height="9" rx="1"/></g></svg>',
  schoolmap: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M5 14q0-5 5-6l14-4 17 6 13-4q5-1 5 5v39q0 4-5 6l-14 4-17-6-13 4q-5 1-5-5Z" fill="#c99664"/><path d="M23 5v48M41 10v49" fill="none" stroke="#f3dfc2" stroke-width="4"/><path d="M39 32a8 8 0 1 1 16 0c0 6-8 14-8 14s-8-8-8-14Z" fill="#d94745"/><circle cx="47" cy="32" r="2.7" fill="#fff"/></svg>',
  subjects: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="9" y="7" width="46" height="50" rx="11" fill="#b376c6"/><rect x="16" y="16" width="32" height="9" rx="4" fill="#fff"/><rect x="16" y="29" width="32" height="9" rx="4" fill="#f9d4ff"/><rect x="16" y="42" width="23" height="9" rx="4" fill="#fff"/><circle cx="48" cy="47" r="6" fill="#ffd778"/></svg>',
  wrong: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="9" y="5" width="46" height="54" rx="12" fill="#2f6bff"/><path d="M23 5H21A12 12 0 0 0 9 17V47A12 12 0 0 0 21 59H23Z" fill="#1d4fd8"/><rect x="21" y="11" width="29" height="42" rx="8" fill="#fff"/><circle cx="35.5" cy="25" r="6.5" fill="none" stroke="#2eb86a" stroke-width="4.5"/><path d="M29.5 36.5 41.5 48.5M41.5 36.5 29.5 48.5" stroke="#ff7a1a" stroke-width="4.5" stroke-linecap="round"/></svg>',
  timetable: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="6" y="9" width="52" height="46" rx="12" fill="#2eb86a"/><path d="M6 21A12 12 0 0 1 18 9H46A12 12 0 0 1 58 21V24H6Z" fill="#1c9a54"/><rect x="12" y="29" width="11" height="10" rx="3.5" fill="#fff"/><rect x="26.5" y="29" width="11" height="10" rx="3.5" fill="#ffd36b"/><rect x="41" y="29" width="11" height="10" rx="3.5" fill="#fff"/><rect x="12" y="42" width="11" height="8" rx="3.5" fill="#fff"/><rect x="26.5" y="42" width="11" height="8" rx="3.5" fill="#fff"/><rect x="41" y="42" width="11" height="8" rx="3.5" fill="#9fd3ff"/></svg>',
  calendar: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="11" width="50" height="46" rx="12" fill="#ff9a1f"/><path d="M11 24H53V45A8 8 0 0 1 45 53H19A8 8 0 0 1 11 45Z" fill="#fff"/><rect x="18" y="4" width="7" height="14" rx="3.5" fill="#c4600b"/><rect x="39" y="4" width="7" height="14" rx="3.5" fill="#c4600b"/><g fill="#cfd7ea"><circle cx="20" cy="33" r="2.8"/><circle cx="32" cy="33" r="2.8"/><circle cx="44" cy="33" r="2.8"/><circle cx="20" cy="44" r="2.8"/><circle cx="32" cy="44" r="2.8"/></g><circle cx="44" cy="44" r="4.2" fill="#ff9a1f"/></svg>',
  activities: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="10" y="8" width="44" height="52" rx="12" fill="#8f64ff"/><rect x="16" y="16" width="32" height="38" rx="7" fill="#fff"/><rect x="22" y="3" width="20" height="12" rx="6" fill="#6a3fd6"/><path d="M21 27 27 33 39 20" fill="none" stroke="#2eb86a" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><rect x="21" y="39" width="22" height="4" rx="2" fill="#d8dde8"/><rect x="21" y="46" width="15" height="4" rx="2" fill="#d8dde8"/></svg>',
  home: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="13" y="28" width="38" height="31" rx="7" fill="#2f6bff"/><rect x="26" y="40" width="12" height="19" rx="4" fill="#fff"/><path d="M32 5 4.5 28.5A3 3 0 0 0 6.5 34H57.5A3 3 0 0 0 59.5 28.5Z" fill="#ff9a1f"/></svg>',
  grades: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="7" width="50" height="50" rx="14" fill="#ff6f91"/><rect x="14" y="14" width="36" height="36" rx="9" fill="#fff"/><rect x="19" y="33" width="8" height="12" rx="3" fill="#ffb22e"/><rect x="30" y="26" width="8" height="19" rx="3" fill="#2eb86a"/><rect x="41" y="19" width="6" height="26" rx="3" fill="#2f6bff"/></svg>',
  meals: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="6" y="10" width="52" height="46" rx="13" fill="#18bfd1"/><path d="M6 23A13 13 0 0 1 19 10H45A13 13 0 0 1 58 23V25H6Z" fill="#0e9db0"/><rect x="12" y="30" width="18" height="21" rx="6" fill="#fff"/><rect x="34" y="30" width="18" height="10" rx="5" fill="#ffd36b"/><rect x="34" y="42" width="18" height="9" rx="4.5" fill="#8fe3ae"/></svg>',
  notes: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="8" y="6" width="48" height="52" rx="13" fill="#ffc93c"/><path d="M36 58V49A9 9 0 0 1 45 40H56Z" fill="#e0a500"/><rect x="16" y="17" width="32" height="5" rx="2.5" fill="#fff"/><rect x="16" y="27" width="32" height="5" rx="2.5" fill="#fff"/><rect x="16" y="37" width="16" height="5" rx="2.5" fill="#fff"/></svg>',
  timer: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="11" y="12" width="42" height="46" rx="14" fill="#4bb7dc"/><circle cx="32" cy="35" r="17" fill="#fff"/><path d="M32 23V35L40 40" fill="none" stroke="#228daf" stroke-width="4.5" stroke-linecap="round"/><rect x="25" y="5" width="14" height="9" rx="4" fill="#ffd25b"/><circle cx="32" cy="35" r="3" fill="#32a5cc"/></svg>',
  trash: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="14" y="17" width="36" height="40" rx="8" fill="#9ca4b0"/><path d="M11 15h42" stroke="#727d8b" stroke-width="6" stroke-linecap="round"/><rect x="24" y="7" width="16" height="8" rx="4" fill="#727d8b"/><path d="M26 27v20M38 27v20" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>',
  settings: '<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="#8a97b8"><rect x="27.5" y="4" width="9" height="16" rx="3.5"/><rect x="27.5" y="4" width="9" height="16" rx="3.5" transform="rotate(45 32 32)"/><rect x="27.5" y="4" width="9" height="16" rx="3.5" transform="rotate(90 32 32)"/><rect x="27.5" y="4" width="9" height="16" rx="3.5" transform="rotate(135 32 32)"/><rect x="27.5" y="4" width="9" height="16" rx="3.5" transform="rotate(180 32 32)"/><rect x="27.5" y="4" width="9" height="16" rx="3.5" transform="rotate(225 32 32)"/><rect x="27.5" y="4" width="9" height="16" rx="3.5" transform="rotate(270 32 32)"/><rect x="27.5" y="4" width="9" height="16" rx="3.5" transform="rotate(315 32 32)"/><circle cx="32" cy="32" r="21"/></g><circle cx="32" cy="32" r="9" fill="#fff"/></svg>',
  books: '<svg viewBox="200 235 850 610" aria-hidden="true"><defs><clipPath id="ci-b"><rect x="295" y="250" width="725" height="220" rx="62"/></clipPath><clipPath id="ci-g"><rect x="250" y="468" width="730" height="170" rx="52"/></clipPath><clipPath id="ci-o"><rect x="215" y="637" width="823" height="195" rx="62"/></clipPath></defs>' +
    '<g class="bk b3"><g clip-path="url(#ci-o)"><rect x="215" y="637" width="823" height="195" fill="#ff9a1f"/><ellipse cx="300" cy="735" rx="110" ry="110" fill="#ffae1a"/><rect x="318" y="637" width="62" height="195" fill="#ff7a1a"/></g><rect x="628" y="678" width="380" height="117" rx="40" fill="#fff"/><rect x="672" y="713" width="278" height="17" rx="8" fill="#d9dde3"/><rect x="672" y="750" width="278" height="17" rx="8" fill="#d9dde3"/></g>' +
    '<g class="bk b2"><g clip-path="url(#ci-g)"><rect x="250" y="468" width="730" height="170" fill="#27b560"/><ellipse cx="330" cy="553" rx="85" ry="86" fill="#43bf68"/><rect x="345" y="468" width="52" height="170" fill="#1c8a47"/></g><rect x="632" y="505" width="330" height="105" rx="36" fill="#fff"/><rect x="672" y="538" width="236" height="16" rx="8" fill="#d9dde3"/><rect x="672" y="570" width="236" height="16" rx="8" fill="#d9dde3"/></g>' +
    '<g class="bk b1"><g clip-path="url(#ci-b)"><rect x="295" y="250" width="725" height="220" fill="#0a56d6"/><ellipse cx="395" cy="360" rx="100" ry="112" fill="#0a72ff"/></g><rect x="567" y="296" width="440" height="136" rx="42" fill="#fff"/><rect x="612" y="338" width="184" height="20" rx="10" fill="#d9dde3"/><rect x="612" y="381" width="184" height="20" rx="10" fill="#d9dde3"/><path d="M815 343H915V470L865 450 815 470Z" fill="#e53935" stroke="#fff" stroke-width="14" stroke-linejoin="round" paint-order="stroke"/></g></svg>',
};

function icon(name, cls) {
  const s = document.createElement('span');
  s.className = 'ico' + (cls ? ' ' + cls : '');
  s.innerHTML = ICONS[name] || '';
  return s;
}

const DrawTools = (() => {
  const paths = {
    pen: '<path d="m6 24 3-7L23 3l5 5-14 14-8 2Z"/><path d="m19 7 5 5"/>',
    marker: '<path d="m8 21 4-8L22 3l7 7-10 10-8 4-3-3Z"/><path d="M4 28h20"/>',
    select: '<path d="M5 4v22l6-6 5 9 4-2-5-9 8-1Z"/>',
    line: '<path d="M4 27 28 5"/>',
    rect: '<rect x="5" y="7" width="22" height="18" rx="2"/>',
    triangle: '<path d="M16 5 29 26H3Z"/>',
    ellipse: '<ellipse cx="16" cy="16" rx="12" ry="9"/>',
    text: '<path d="M5 7h22M16 7v19M11 26h10"/>',
    eraser: '<path d="m4 20 13-15 11 10-11 13H9l-5-8Z"/><path d="m11 12 11 11"/>'
  };
  const labels = { select: '선택', pen: '펜', marker: '마커', line: '직선', rect: '사각형', triangle: '삼각형', ellipse: '타원', text: '글자', eraser: '지우개' };
  function button(key, onclick) {
    const glyph = h('span', { class: 'draw-tool-icon', 'aria-hidden': 'true' });
    glyph.innerHTML = `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round">${paths[key]}</svg>`;
    return h('button', { type: 'button', class: 'btn tool draw-tool', 'aria-label': labels[key], title: labels[key], onclick }, glyph, h('span', null, labels[key]));
  }
  function shapePicker(onPick) {
    const choices = ['rect', 'triangle', 'ellipse'];
    const popup = h('div', { class: 'draw-shape-menu', hidden: true }, choices.map((key) => button(key, () => { main.firstChild.innerHTML = `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round">${paths[key]}</svg>`; main.lastChild.textContent = labels[key] + ' ▾'; popup.hidden = true; onPick(key); })));
    const main = button('rect', () => { popup.hidden = !popup.hidden; });
    main.lastChild.textContent = '도형 ▾';
    return { el: h('div', { class: 'draw-shape-picker' }, main, popup), main, popup, choices };
  }
  function smoothPath(ctx, points) {
    if (!points.length) return;
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length - 1; i++) {
      const mid = [(points[i][0] + points[i + 1][0]) / 2, (points[i][1] + points[i + 1][1]) / 2];
      ctx.quadraticCurveTo(points[i][0], points[i][1], mid[0], mid[1]);
    }
    if (points.length > 1) ctx.lineTo(...points.at(-1));
    else ctx.lineTo(points[0][0] + .1, points[0][1]);
  }
  function liveSegment(ctx, points, color, width, alpha = 1) {
    if (points.length < 2) return;
    const prev = points.at(-2), now = points.at(-1), before = points.at(-3) || prev;
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.globalAlpha = alpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    ctx.moveTo((before[0] + prev[0]) / 2, (before[1] + prev[1]) / 2);
    ctx.quadraticCurveTo(prev[0], prev[1], (prev[0] + now[0]) / 2, (prev[1] + now[1]) / 2);
    ctx.stroke(); ctx.restore();
  }
  function selectionFrame(wrap, canvas, onMove, onRotate) {
    const move = h('button', { class: 'draw-select-handle move', type: 'button', title: '선택 영역 이동', 'aria-label': '선택 영역 이동' }, '✥');
    const rotate = h('button', { class: 'draw-select-handle rotate', type: 'button', title: '선택 영역 회전', 'aria-label': '선택 영역 회전' }, '↻');
    const frame = h('div', { class: 'draw-select-frame', hidden: true }, move, rotate);
    wrap.append(frame);
    let rect = null, actions = null;
    function show(next) {
      rect = next;
      frame.hidden = !rect;
      if (actions) actions.hidden = !rect;
      if (!rect) return;
      const c = canvas.getBoundingClientRect(), w = wrap.getBoundingClientRect();
      const scaleX = c.width / canvas.width, scaleY = c.height / canvas.height;
      const left = c.left - w.left + wrap.scrollLeft + rect.x * scaleX;
      const top = c.top - w.top + wrap.scrollTop + rect.y * scaleY;
      Object.assign(frame.style, { left: `${left}px`, top: `${top}px`, width: `${rect.w * scaleX}px`, height: `${rect.h * scaleY}px`, transform: `rotate(${rect.angle || 0}rad)` });
      if (actions) {
        const maxLeft = wrap.scrollLeft + wrap.clientWidth - actions.offsetWidth - 8;
        actions.style.left = `${Math.max(wrap.scrollLeft + 8, Math.min(left, maxLeft))}px`;
        actions.style.top = `${top + rect.h * scaleY + 8}px`;
      }
    }
    function bind(handle, kind) {
      handle.addEventListener('pointerdown', (event) => {
        if (!rect) return;
        event.preventDefault(); event.stopPropagation(); handle.setPointerCapture(event.pointerId);
        const start = { ...rect }, sx = event.clientX, sy = event.clientY;
        const c = canvas.getBoundingClientRect(), scaleX = canvas.width / c.width, scaleY = canvas.height / c.height;
        const cx = c.left + (start.x + start.w / 2) / scaleX, cy = c.top + (start.y + start.h / 2) / scaleY;
        const angle0 = Math.atan2(sy - cy, sx - cx);
        const drag = (e) => {
          if (kind === 'move') onMove((e.clientX - sx) * scaleX, (e.clientY - sy) * scaleY, start);
          else onRotate(Math.atan2(e.clientY - cy, e.clientX - cx) - angle0, start);
        };
        const end = () => { handle.removeEventListener('pointermove', drag); handle.removeEventListener('pointerup', end); handle.removeEventListener('pointercancel', end); };
        handle.addEventListener('pointermove', drag); handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
      });
    }
    bind(move, 'move'); bind(rotate, 'rotate');
    const onResize = () => { if (frame.isConnected && rect) show(rect); else if (!frame.isConnected) window.removeEventListener('resize', onResize); };
    window.addEventListener('resize', onResize);
    return { show, hide: () => show(null), setActions: (element) => { actions = element; wrap.append(element); show(rect); } };
  }
  return { button, labels, shapePicker, smoothPath, liveSegment, selectionFrame };
})();
