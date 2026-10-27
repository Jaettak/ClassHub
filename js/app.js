// 공용 도구, 모달, 알림, 화면 전환
const WEEK = '일월화수목금토';
const pad = (n) => String(n).padStart(2, '0');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => dateStr(new Date());
const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const PALETTE = ['#4f8cff', '#35c27a', '#ff9f2e', '#ff6f91', '#a276ff', '#18bfd1', '#f2c230', '#ff7a59'];

function colorFor(text) {
  const name = String(text || '').trim();
  // 사용자 지정 과목 색상은 시간표·홈·일정 관리·성적 분석에 공통 적용한다.
  const custom = Store.get('subjectColors', {});
  if (custom && Object.prototype.hasOwnProperty.call(custom, name) && /^#[0-9a-fA-F]{6}$/.test(custom[name])) return custom[name];
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
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

const App = (() => {
  const views = {};
  const ORDER = ['home', 'wrong', 'timetable', 'calendar', 'activities', 'grades', 'meals', 'notes', 'timer'];
  let current = null;
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

  // 모달: { title, body, footer, wide, full, onClose }
  function modal(opts) {
    const closeBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': '닫기', onclick: () => api.close() }, '✕');
    const box = h('div', { class: 'modal' + (opts.wide ? ' wide' : '') + (opts.full ? ' full' : ''), role: 'dialog' },
      h('div', { class: 'modal-head' }, h('h3', null, opts.title || ''), closeBtn),
      h('div', { class: 'modal-body' }, opts.body),
      opts.footer ? h('div', { class: 'modal-foot' }, opts.footer) : null);
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
      },
    };
    modalStack.push(api);
    document.body.classList.add('modal-open');
    document.body.append(back);
    return api;
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalStack.length) modalStack[modalStack.length - 1].close();
  });

  function field(label, input, hint) {
    return h('label', { class: 'field' }, h('span', null, label), input, hint ? h('small', null, hint) : null);
  }

  // 이전에 입력한 과목 목록 (시간표 + 오답노트)
  function knownSubjects() {
    const set = new Set();
    const tt = Store.get('timetable', null);
    if (tt && tt.cells) tt.cells.forEach((col) => col.forEach((c) => { if (c && c.subject) set.add(c.subject); }));
    Store.get('ttFriends', []).forEach((f) => f.cells.forEach((col) => col.forEach((c) => { if (c && c.subject) set.add(c.subject); })));
    Store.get('captures', []).forEach((c) => { if (c.subject) set.add(c.subject); });
    Store.get('grades', []).forEach((g) => { if (g.subject) set.add(g.subject); });
    return [...set].sort((a, b) => a.localeCompare(b, 'ko'));
  }

  // 기존 과목 선택 또는 새 과목 직접 입력. { el, value(), onPick(fn) }
  function subjectField(label, value, opts = {}) {
    const NEW = '__new__';
    const list = knownSubjects();
    if (value && !list.includes(value)) list.push(value);
    const text = h('input', { type: 'text', placeholder: '새 과목 이름', maxLength: 20 });
    const sel = h('select', { 'aria-label': label }, [
      h('option', { value: '' }, opts.empty || '과목 선택'),
      list.map((s) => h('option', { value: s, selected: s === value }, s)),
      h('option', { value: NEW }, '＋ 새 과목 추가'),
    ]);
    const picks = [];
    const sync = () => {
      text.hidden = sel.value !== NEW;
      if (!text.hidden) text.focus();
      picks.forEach((fn) => fn(sel.value === NEW ? '' : sel.value));
    };
    sel.addEventListener('change', sync);
    text.hidden = true;
    if (!list.length) { sel.value = NEW; text.hidden = false; }
    return {
      el: field(label, h('div', { class: 'subj' }, sel, text)),
      value: () => (sel.value === NEW ? text.value.trim() : sel.value),
      onPick: (fn) => picks.push(fn),
    };
  }

  function navTabs(active) {
    return h('nav', { class: 'tabs' }, ORDER.filter((n) => views[n]).map((n) => h('a', { href: '#' + n, class: n === active ? 'active' : '' },
      h('span', { class: 'tab-ico' }, icon(views[n].icon)), h('span', { class: 'tab-txt' }, views[n].label))));
  }

  function route() {
    if (Cloud.configured && !Cloud.ready) { Cloud.showGate(); return; }
    const name = (location.hash || '#home').slice(1);
    const view = views[name] || views.home;
    const key = views[name] ? name : 'home';
    current = key;
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
            h('span', { class: 'brand-name' }, 'Class', h('b', null, 'Hub'))),
          navTabs(key)),
        page);
      view.render(page);
    }
    window.scrollTo(0, 0);
  }

  function refresh() { route(); }

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

  function importData() {
    const input = h('input', { type: 'file', accept: '.json,application/json' });
    input.addEventListener('change', async () => {
      const f = input.files[0];
      if (!f) return;
      if (!confirm('지금 저장된 내용이 백업 파일 내용으로 바뀌어요. 계속할까요?')) return;
      try {
        await Store.importAll(JSON.parse(await f.text()));
        toast('불러왔어요!');
        refresh();
      } catch (e) {
        toast(e.message || '불러오지 못했어요.');
      }
    });
    input.click();
  }

  const openSettings = () => Settings.open();
  const api = { views, registerView, toast, modal, field, subjectField, route, refresh, download, exportData, importData, openSettings, get current() { return current; } };
  return api;
})();
