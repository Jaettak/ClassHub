// 공용 도구, 모달, 알림, 화면 전환
const WEEK = '일월화수목금토';
const pad = (n) => String(n).padStart(2, '0');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => dateStr(new Date());
const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const PALETTE = ['#4f8cff', '#35c27a', '#ff9f2e', '#ff6f91', '#a276ff', '#18bfd1', '#f2c230', '#ff7a59'];
const CLASSHUB_VERSION = 'v2.11.0';

function colorFor(text) {
  const name = String(text || '').trim();
  if (!name) return PALETTE[0];
  // 사용자 지정 과목 색상은 시간표·홈·일정 관리·성적 분석에 공통 적용한다.
  const custom = Store.get('subjectColors', {});
  if (custom && Object.prototype.hasOwnProperty.call(custom, name) && /^#[0-9a-fA-F]{6}$/.test(custom[name])) return custom[name];
  if (name === '자습') return '#8b95a5';
  const auto = Store.get('subjectAutoColors', {});
  if (auto[name]) return auto[name];
  const used = new Set([...Object.values(custom || {}), ...Object.values(auto)].map((c) => String(c).toLowerCase()));
  const hex = (h, s, l) => {
    const f = (n) => {
      const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };
  const candidates = [...PALETTE, ...Array.from({ length: 72 }, (_, i) => hex((i * 137.508) % 360, .68, i % 3 === 0 ? .46 : .57))];
  const picked = candidates.find((c) => !used.has(c.toLowerCase())) || PALETTE[0];
  Store.set('subjectAutoColors', { ...auto, [name]: picked });
  return picked;
}

function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) e.style.setProperty(sk, sv); else e.style[sk] = sv; }
    }
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'for') e.htmlFor = v;
    else if (k in e && k !== 'list') e[k] = v;
    else e.setAttribute(k, v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(c));
  }
  if (tag === 'input' && ['date', 'time', 'color'].includes(e.type) && typeof ClassHubPicker !== 'undefined') ClassHubPicker.enhance(e);
  if (tag === 'select' && typeof ClassHubPicker !== 'undefined') ClassHubPicker.enhanceSelect(e);
  return e;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function sv(tag, attrs, ...kids) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
  }
  kids.flat().forEach((c) => { if (c != null) e.append(c.nodeType ? c : document.createTextNode(c)); });
  return e;
}

function helpIcon() {
  return sv('svg', { class: 'help-icon', viewBox: '0 0 24 24', 'aria-hidden': 'true' },
    sv('circle', { cx: 12, cy: 12, r: 10, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6 }),
    sv('g', { transform: 'translate(12 12) scale(.84) translate(-12 -12)' },
      sv('path', { d: 'M9.25 9.25a2.85 2.85 0 1 1 4.45 2.35c-1.2.83-1.7 1.25-1.7 2.7', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
      sv('circle', { cx: 12, cy: 17.45, r: 1.05, fill: 'currentColor' })));
}

const App = (() => {
  const views = {};
  const ORDER = ['home', 'grades', 'calendar', 'notes', 'timetable', 'meals', 'timer', 'wrong', 'study', 'activities', 'subjects', 'whiteboard', 'schoolmap', 'settings'];
  let current = null;
  let expandedNavHeight = 0;
  const modalStack = [];

  function registerView(name, def) {
    views[name] = def;
  }

  let toastTimer = null;
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  }

  function contextualHelp(container) {
    container.querySelectorAll('p.hint').forEach((hint) => {
      if (!hint.textContent.trim()) return;
      const help = h('details', { class: 'context-help' },
        h('summary', null, helpIcon(), '도움말'), h('div', null, ...Array.from(hint.childNodes)));
      hint.replaceWith(help);
    });
  }

  // 모달: { title, body, footer, wide, full, onClose }
  function modal(opts) {
    const closeBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': '닫기', onclick: () => api.close() }, '✕');
    const box = h('div', { class: 'modal' + (opts.wide ? ' wide' : '') + (opts.full ? ' full' : ''), role: 'dialog' },
      h('div', { class: 'modal-head' }, h('h3', null, opts.title || ''), closeBtn),
      h('div', { class: 'modal-body' }, opts.body),
      opts.footer ? h('div', { class: 'modal-foot' }, opts.footer) : null);
    contextualHelp(box);
    const back = h('div', { class: 'modal-back' }, box);
    back.style.zIndex = 100 + modalStack.length * 10;
    const api = {
      el: box,
      back,
      close() {
        const i = modalStack.indexOf(api);
        if (i < 0) return;
        modalStack.splice(i, 1);
        back.remove();
        if (!modalStack.length) document.body.classList.remove('modal-open');
        if (opts.onClose) opts.onClose();
        if (!modalStack.length) document.dispatchEvent(new Event('classhub:modal-closed'));
      },
    };
    modalStack.push(api);
    document.body.classList.add('modal-open');
    document.body.append(back);
    return api;
  }

  function confirmAction(message) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (accepted) => {
        if (settled) return;
        settled = true;
        dialog.close();
        resolve(accepted);
      };
      const dialog = modal({ title: '확인', body: h('p', { class: 'confirm-message' }, message),
        footer: [h('button', { class: 'btn ghost', type: 'button', onclick: () => finish(false) }, '취소'),
          h('button', { class: 'btn danger', type: 'button', onclick: () => finish(true) }, '확인')],
        onClose: () => { if (!settled) { settled = true; resolve(false); } } });
      dialog.back.classList.add('confirm-dialog');
    });
  }

  function askText(message, initial = '') {
    return new Promise((resolve) => {
      let settled = false;
      const input = h('input', { type: 'text', value: initial, autocomplete: 'off' });
      const finish = (value) => {
        if (settled) return;
        settled = true;
        dialog.close();
        resolve(value);
      };
      const dialog = modal({ title: '입력', body: h('div', { class: 'confirm-text' }, h('label', null, message, input)),
        footer: [h('button', { class: 'btn ghost', type: 'button', onclick: () => finish(null) }, '취소'),
          h('button', { class: 'btn primary', type: 'button', onclick: () => finish(input.value) }, '확인')],
        onClose: () => { if (!settled) { settled = true; resolve(null); } } });
      dialog.back.classList.add('confirm-dialog');
      input.addEventListener('keydown', (event) => { if (event.key === 'Enter') finish(input.value); });
      input.focus();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalStack.length) modalStack[modalStack.length - 1].close();
  });

  function field(label, input, hint) {
    return h('div', { class: 'field' }, h('label', { class: 'field-label' }, h('span', null, label), input),
      hint ? h('details', { class: 'context-help' }, h('summary', null, helpIcon(), '도움말'), h('div', null, hint)) : null);
  }

  // 이전에 입력한 과목 목록 (시간표 + 오답노트)
  function knownSubjects() {
    const set = new Set();
    Store.get('subjectCatalog', []).forEach((name) => set.add(name));
    const tt = Store.get('timetable', null);
    if (tt && tt.cells) tt.cells.forEach((col) => col.forEach((c) => { if (c && c.subject) set.add(c.subject); }));
    Store.get('ttFriends', []).forEach((f) => f.cells.forEach((col) => col.forEach((c) => { if (c && c.subject) set.add(c.subject); })));
    Store.get('captures', []).forEach((c) => { if (c.subject) set.add(c.subject); });
    Store.get('grades', []).forEach((g) => { if (g.subject) set.add(g.subject); });
    const hidden = new Set(Store.get('hiddenSubjects', []));
    return [...set].filter((name) => !hidden.has(name)).sort((a, b) => a.localeCompare(b, 'ko'));
  }

  // 기존 과목 선택 또는 새 과목 직접 입력. { el, value(), onPick(fn) }
  function subjectField(label, value, opts = {}) {
    const picks = [];
    const text = h('input', { type: 'text', value: value || '', placeholder: opts.empty || '과목 이름', maxLength: 50, readOnly: !!opts.managedOnly, 'aria-label': label });
    const notify = () => picks.forEach((fn) => fn(text.value.trim()));
    text.addEventListener('change', notify);
    const choose = h('button', { class: 'btn', type: 'button', onclick: () => Subjects.choose(text.value, (name) => { text.value = name; notify(); }) }, '과목 선택');
    const official = h('button', { class: 'btn ghost', type: 'button', onclick: () => Curriculum2022.pick((row) => {
      text.value = row.name;
      Store.set('subjectCatalog', [...new Set([...Store.get('subjectCatalog', []), row.name])].sort((a, b) => a.localeCompare(b, 'ko')));
      Store.set('hiddenSubjects', Store.get('hiddenSubjects', []).filter((name) => name !== row.name));
      notify();
    }) }, '공식 과목 찾기');
    return {
      el: field(label, h('div', { class: 'subj subject-field-controls' }, choose, text, opts.managedOnly ? null : official)),
      value: () => text.value.trim(),
      onPick: (fn) => picks.push(fn),
    };
  }

  function navTabs(active) {
    const enabled = Settings.get().enabledTabs;
    const order = Settings.get().tabOrder || [];
    const names = ORDER.filter((n) => views[n] && n !== 'home' && n !== 'settings' && (!Array.isArray(enabled) || enabled.includes(n)))
      .sort((a, b) => (order.indexOf(a) < 0 ? 999 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 999 : order.indexOf(b)));
    const layout = (className, max, minRows) => {
      const count = names.length, rows = Math.min(count, Math.max(minRows, Math.ceil(count / max))) || 0;
      let index = 0;
      return h('div', { class: 'nav-layout ' + className }, Array.from({ length: rows }, (_, row) => {
        const size = Math.floor(count / rows) + (row < count % rows ? 1 : 0);
        const cells = names.slice(index, index += size);
        return h('div', { class: 'nav-row', style: { '--row-count': size } }, cells.map((n) => h('a', { href: '#' + n, class: n === active ? 'active' : '', 'aria-label': views[n].label, title: views[n].label },
          h('span', { class: 'tab-ico' }, icon(views[n].icon)), h('span', { class: 'tab-txt' }, views[n].label))));
      }));
    };
    return h('nav', { class: 'tabs' }, layout('desktop', 7, 2), layout('tablet', 5, 2), layout('phone', 6, 2));
  }

  const HELP = {
    wrong: 'PDF 캡처, 사진, 손그림, 글 또는 문제 번호로 오답을 정리할 수 있어요. 원본과 이미지는 이 브라우저에 저장돼요.',
    timetable: '교시와 과목을 정한 뒤 적용 기간을 선택해 일정에 추가하세요. 추가한 수업은 일정에서 날짜별로 수정할 수 있어요.',
    calendar: '월·주·일 화면을 오가며 일정을 확인하세요. 여러 날짜 일정과 시험기간, 날짜별 메모를 입력할 수 있어요.',
    activities: '학교 활동과 기록할 내용을 모아 관리할 수 있어요.',
    grades: '과목별 시험 점수를 기록하고 성적 변화를 확인할 수 있어요.',
    meals: '학교를 선택해 급식을 확인하세요. 별을 누른 메뉴는 같은 음식이 다시 나올 때 표시돼요.',
    notes: '메모를 보관함별로 정리하고 드래그해 순서를 바꿀 수 있어요. 삭제한 메모는 휴지통에서 복원할 수 있어요.',
    timer: '타이머와 스톱워치로 공부 시간을 기록하세요. 스톱워치 구간 기록은 최근 기록에서 펼쳐 볼 수 있어요.',
    settings: '학교, 화면, 소리, 메모 정리, 홈 탭 순서와 개인 정보 잠금을 설정할 수 있어요.',
    schoolmap: '층별 학교 지도를 보고 마커와 장소 이름을 관리하세요. 원본 파일은 이 기기에 저장돼요.',
    study: '과목·단원별 텍스트와 그림 필기를 저장하세요. 그림은 이 기기에 저장돼요.',
    whiteboard: '펜과 도형으로 자유롭게 그리고 그림을 이 기기에 저장하세요.',
    subjects: '과목 이름, 색상과 기본 교실을 관리하세요. 과목을 지워도 과거 일정은 유지됩니다.',
  };

  function route() {
    const previousView = current;
    const previousScroll = window.scrollY;
    Store.purgeExpiredTrash().catch(() => {});
    if (Cloud.configured && !Cloud.ready) { Cloud.showGate(); return; }
    const name = (location.hash || '#home').slice(1);
    const view = views[name] || views.home;
    const key = views[name] ? name : 'home';
    if (current && current !== key && Settings.protectedTab(current)) Settings.lock();
    if (current && current !== key && typeof Creative !== 'undefined') Creative.resetBack();
    current = key;
    if (!Timer.active()) document.title = `ClassHub - 학교생활 통합 관리 · ${CLASSHUB_VERSION}`;
    const app = document.getElementById('app');
    app.replaceChildren();
    app.className = 'view-' + key;
    if (key === 'home') {
      view.render(app);
    } else {
      const page = h('main', { class: 'page' });
      app.append(
        h('header', { class: 'topbar' },
          h('a', { class: 'brand', href: '#home', 'aria-label': '홈으로' },
            h('span', { class: 'brand-mark' }, icon('books')),
            h('span', { class: 'brand-name', 'aria-label': 'ClassHub' },
              [...'Class'].map((letter, i) => h('span', { style: { '--i': i }, 'aria-hidden': 'true' }, letter)),
              [...'Hub'].map((letter, i) => h('b', { style: { '--i': i + 5 }, 'aria-hidden': 'true' }, letter)))),
          h('button', { class: 'nav-fold', type: 'button', 'aria-label': '탭 메뉴 접기 또는 펼치기', onclick: () => {
            const bar = document.querySelector('.topbar');
            bar.getAnimations().forEach((animation) => animation.cancel());
            if (document.body.classList.contains('nav-collapsed')) {
              document.body.classList.remove('nav-collapsed');
              const page = app.querySelector('.page');
              const height = bar.getBoundingClientRect().height;
              const basePadding = Number(app.dataset.navBasePadding || 22);
              if (page && app.classList.contains('short-view')) {
                const pageAnimation = page.animate([{ paddingTop: `${basePadding + expandedNavHeight}px` }, { paddingTop: `${basePadding}px` }], { duration: 290, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' });
                pageAnimation.onfinish = () => { page.style.paddingTop = ''; pageAnimation.cancel(); };
              }
              const animation = bar.animate([
                { transform: `translateY(-${height}px)`, marginBottom: `-${height}px` },
                { transform: 'translateY(0)', marginBottom: '0px' }
              ], { duration: 290, easing: 'cubic-bezier(.22,1,.36,1)' });
            } else {
              const height = bar.getBoundingClientRect().height;
              expandedNavHeight = height;
              const page = app.querySelector('.page');
              app.classList.toggle('short-view', !!page && page.scrollHeight + height < innerHeight - 50);
              app.style.setProperty('--nav-spacer', `${height}px`);
              if (page && app.classList.contains('short-view')) {
                const basePadding = parseFloat(getComputedStyle(page).paddingTop) || 22;
                app.dataset.navBasePadding = String(basePadding);
                app.style.setProperty('--nav-base-pad', `${basePadding}px`);
                const pageAnimation = page.animate([{ paddingTop: `${basePadding}px` }, { paddingTop: `${basePadding + height}px` }], { duration: 290, easing: 'cubic-bezier(.55,0,.82,.35)', fill: 'forwards' });
                pageAnimation.onfinish = () => { page.style.paddingTop = `${basePadding + height}px`; pageAnimation.cancel(); };
              }
              const animation = bar.animate([
                { transform: 'translateY(0)', marginBottom: '0px' },
                { transform: `translateY(-${height}px)`, marginBottom: `-${height}px` }
              ], { duration: 290, easing: 'cubic-bezier(.55,0,.82,.35)', fill: 'forwards' });
              animation.onfinish = () => { document.body.classList.add('nav-collapsed'); animation.cancel(); };
            }
          } }),
          navTabs(key),
          h('button', { class: 'top-settings', type: 'button', onclick: openSettings, title: '설정', 'aria-label': '설정 열기' }, icon('settings'))),
        page);
      const header = app.querySelector('.topbar');
      let swipeStart = null;
      header.addEventListener('touchstart', (event) => {
        if (!matchMedia('(max-width: 640px)').matches || event.touches.length !== 1) return;
        swipeStart = event.touches[0].clientY;
      }, { passive: true });
      header.addEventListener('touchend', (event) => {
        if (swipeStart === null || !matchMedia('(max-width: 640px)').matches) return;
        const distance = event.changedTouches[0].clientY - swipeStart;
        swipeStart = null;
        if ((distance < -55 && !document.body.classList.contains('nav-collapsed')) ||
            (distance > 55 && document.body.classList.contains('nav-collapsed'))) {
          event.preventDefault();
          header.querySelector('.nav-fold')?.click();
        }
      }, { passive: false });
      if (Settings.locked(key)) page.append(h('section', { class: 'panel private-gate' },
        h('h1', { class: 'page-title' }, `${view.label} 잠금`),
        h('p', null, '개인 기록을 보려면 비밀번호를 입력하세요.'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => Settings.unlock(key, route) }, '잠금 해제')));
      else view.render(page);
      contextualHelp(page);
      page.prepend(h('div', { class: 'view-help-row' }, h('button', { class: 'view-help', type: 'button', 'aria-label': `${view.label} 도움말`, onclick: () => modal({ title: `${view.label} 도움말`, body: h('p', { class: 'help-copy' }, HELP[key] || '') }) }, helpIcon())));
      requestAnimationFrame(() => {
        if (!page.isConnected) return;
        const barHeight = app.querySelector('.topbar')?.getBoundingClientRect().height || expandedNavHeight;
        if (barHeight) expandedNavHeight = barHeight;
        const basePadding = parseFloat(getComputedStyle(page).paddingTop) || 22;
        app.style.setProperty('--nav-base-pad', `${basePadding}px`);
        app.classList.toggle('short-view', page.scrollHeight + barHeight < innerHeight - 50);
        app.style.setProperty('--nav-spacer', `${barHeight}px`);
      });
    }
    window.scrollTo(0, previousView === key ? previousScroll : 0);
  }

  function refresh() { route(); }

  window.ClassHubBack = () => {
    if (modalStack.length) { modalStack[modalStack.length - 1].close(); return true; }
    if (typeof Creative !== 'undefined' && Creative.back()) return true;
    if (location.hash !== '#home') { location.hash = '#home'; return true; }
    return false;
  };

  function download(filename, blobOrUrl) {
    const url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
    const a = h('a', { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    if (typeof blobOrUrl !== 'string') setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function exportData() {
    const data = await Store.exportAll();
    download(`ClassHub-백업-${todayStr()}.json`, new Blob([JSON.stringify(data)], { type: 'application/json' }));
    toast('백업 파일을 저장했어요.');
  }

  function importData(merge = false) {
    const input = h('input', { type: 'file', accept: '.json,application/json' });
    input.addEventListener('change', async () => {
      const f = input.files[0];
      if (!f) return;
      if (!await App.confirm(merge ? '백업에만 있는 기록을 현재 기록에 추가할까요? 같은 항목은 현재 기록을 유지해요.' : '지금 저장된 내용이 백업 파일 내용으로 바뀌어요. 계속할까요?')) return;
      try {
        const data = JSON.parse(await f.text());
        if (merge) await Store.mergeAll(data);
        else await Store.importAll(data);
        toast(merge ? '백업 기록을 합쳤어요.' : '불러왔어요!');
        refresh();
      } catch (e) {
        toast(e.message || '불러오지 못했어요.');
      }
    });
    input.click();
  }

  const openSettings = () => Settings.open();
  const api = { views, registerView, toast, modal, confirm: confirmAction, askText, field, subjectField, route, refresh, download, exportData, importData, openSettings, get current() { return current; } };
  return api;
})();

// 손가락을 떼지 않아도 안쪽 목록의 끝에서 바깥 화면으로 스크롤을 이어 간다.
(() => {
  let gesture = null;
  const scrollable = (start) => {
    for (let el = start instanceof Element ? start : start?.parentElement; el && el !== document.body; el = el.parentElement) {
      if (/auto|scroll|overlay/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 1) return el;
    }
    return null;
  };
  const passRemainder = (inner, delta) => {
    let remaining = delta;
    for (let node = inner; node && Math.abs(remaining) > .5; node = scrollable(node.parentElement)) {
      const before = node.scrollTop;
      node.scrollTop = Math.max(0, Math.min(node.scrollHeight - node.clientHeight, before + remaining));
      remaining -= node.scrollTop - before;
    }
    if (Math.abs(remaining) > .5 && !document.body.classList.contains('modal-open')) window.scrollBy(0, remaining);
  };
  document.addEventListener('wheel', (event) => {
    if (event.defaultPrevented || event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX) ||
        !(event.target instanceof Element) || event.target.closest('.school-photo-scroll.zoomed')) return;
    const inner = scrollable(event.target);
    if (!inner) return;
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? inner.clientHeight : 1);
    const available = delta > 0 ? inner.scrollHeight - inner.clientHeight - inner.scrollTop : inner.scrollTop;
    if (available + .5 >= Math.abs(delta)) return;
    if (event.cancelable) event.preventDefault();
    passRemainder(inner, delta);
  }, { passive: false });
  document.addEventListener('touchstart', (event) => {
    gesture = null;
    if (event.touches.length !== 1 || !(event.target instanceof Element) ||
        event.target.closest('canvas, .school-photo-scroll.zoomed, .ch-color-square, .ch-color-hue')) return;
    const inner = scrollable(event.target);
    if (!inner) return;
    gesture = { inner, x: event.touches[0].clientX, y: event.touches[0].clientY };
  }, { passive: true });
  document.addEventListener('touchmove', (event) => {
    if (!gesture || event.touches.length !== 1 || !gesture.inner.isConnected ||
        event.target.closest?.('.set-preview-tile.dragging, .home-card.dragging')) return;
    const touch = event.touches[0];
    const dx = touch.clientX - gesture.x, dy = gesture.y - touch.clientY;
    gesture.x = touch.clientX; gesture.y = touch.clientY;
    if (Math.abs(dy) < 1 || Math.abs(dy) <= Math.abs(dx)) return;
    const inner = gesture.inner, max = inner.scrollHeight - inner.clientHeight;
    const available = dy > 0 ? max - inner.scrollTop : inner.scrollTop;
    if (available + .5 >= Math.abs(dy) || !event.cancelable) return;
    event.preventDefault();
    passRemainder(inner, dy);
  }, { passive: false });
  document.addEventListener('touchend', (event) => { if (!event.touches.length) gesture = null; }, { passive: true });
  document.addEventListener('touchcancel', () => { gesture = null; }, { passive: true });
})();

// 주요 선택 동작마다 같은 계열의 짧은 효과음을 낸다.
(() => {
  let audio;
  const playSelection = (target) => {
    const settings = Settings.get();
    if (!target || target.disabled || settings.uiSound === false || Number(settings.soundVolume ?? 50) <= 0) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const osc = audio.createOscillator(), gain = audio.createGain(), t = audio.currentTime;
      const select = target.matches('.ck, .nt-check, .ml-mark');
      const navigate = target.matches('a[href^="#"], .bm, .home-card');
      const from = select ? 610 : navigate ? 480 : 540;
      osc.type = 'sine'; osc.frequency.setValueAtTime(from, t); osc.frequency.exponentialRampToValueAtTime(from * (select ? 1.18 : 1.12), t + 0.07);
      gain.gain.setValueAtTime(0.0001, t); gain.gain.exponentialRampToValueAtTime(Math.min(0.113, 0.05625 * Number(settings.soundVolume ?? 50) / 50), t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.105);
      osc.connect(gain); gain.connect(audio.destination); osc.start(t); osc.stop(t + 0.11);
    } catch (_) { /* 소리를 낼 수 없는 브라우저에서는 조용히 동작 */ }
  };
  document.addEventListener('click', (event) => playSelection(event.target.closest('button, a, [role="button"], summary')));
  document.addEventListener('change', (event) => {
    if (event.target.matches('select, input[list]')) playSelection(event.target);
  });
})();
