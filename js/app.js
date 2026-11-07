// 공용 도구, 모달, 알림, 화면 전환
const WEEK = '일월화수목금토';
const pad = (n) => String(n).padStart(2, '0');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => dateStr(new Date());
const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const PALETTE = ['#4f8cff', '#35c27a', '#ff9f2e', '#ff6f91', '#a276ff', '#18bfd1', '#f2c230', '#ff7a59'];
const CLASSHUB_VERSION = 'v2.1.9';

function colorFor(text) {
  const name = String(text || '').trim();
  if (!name) return PALETTE[0];
  // 사용자 지정 과목 색상은 시간표·홈·일정 관리·성적 분석에 공통 적용한다.
  const custom = Store.get('subjectColors', {});
  if (custom && Object.prototype.hasOwnProperty.call(custom, name) && /^#[0-9a-fA-F]{6}$/.test(custom[name])) return custom[name];
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
  const ORDER = ['home', 'wrong', 'timetable', 'subjects', 'calendar', 'activities', 'grades', 'meals', 'notes', 'study', 'whiteboard', 'schoolmap', 'timer', 'settings'];
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

  function contextualHelp(container) {
    container.querySelectorAll('p.hint').forEach((hint) => {
      if (!hint.textContent.trim()) return;
      const help = h('details', { class: 'context-help' },
        h('summary', null, '도움말'), h('div', null, ...Array.from(hint.childNodes)));
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

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalStack.length) modalStack[modalStack.length - 1].close();
  });

  function field(label, input, hint) {
    return h('div', { class: 'field' }, h('label', { class: 'field-label' }, h('span', null, label), input),
      hint ? h('details', { class: 'context-help' }, h('summary', null, '도움말'), h('div', null, hint)) : null);
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
        return h('div', { class: 'nav-row', style: { '--row-count': size } }, cells.map((n) => h('a', { href: '#' + n, class: n === active ? 'active' : '' },
          h('span', { class: 'tab-ico' }, icon(views[n].icon)), h('span', { class: 'tab-txt' }, views[n].label))));
      }));
    };
    return h('nav', { class: 'tabs' }, layout('desktop', 7, 2), layout('tablet', 5, 2), layout('phone', 3, 1));
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
    if (Cloud.configured && !Cloud.ready) { Cloud.showGate(); return; }
    const name = (location.hash || '#home').slice(1);
    const view = views[name] || views.home;
    const key = views[name] ? name : 'home';
    if (current && current !== key && Settings.protectedTab(current)) Settings.lock();
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
            document.body.classList.toggle('nav-collapsed');
          } }),
          navTabs(key),
          h('button', { class: 'top-settings', type: 'button', onclick: openSettings, title: '설정', 'aria-label': '설정 열기' }, icon('settings'))),
        page);
      if (Settings.locked(key)) page.append(h('section', { class: 'panel private-gate' },
        h('h1', { class: 'page-title' }, `${view.label} 잠금`),
        h('p', null, '개인 기록을 보려면 비밀번호를 입력하세요.'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => Settings.unlock(key, route) }, '잠금 해제')));
      else view.render(page);
      contextualHelp(page);
      page.prepend(h('div', { class: 'view-help-row' }, h('button', { class: 'view-help', type: 'button', 'aria-label': `${view.label} 도움말`, onclick: () => modal({ title: `${view.label} 도움말`, body: h('p', { class: 'help-copy' }, HELP[key] || '') }) }, '?')));
    }
    window.scrollTo(0, 0);
  }

  function refresh() { route(); }

  window.ClassHubBack = () => {
    if (modalStack.length) { modalStack[modalStack.length - 1].close(); return true; }
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
      if (!confirm(merge ? '백업에만 있는 기록을 현재 기록에 추가할까요? 같은 항목은 현재 기록을 유지해요.' : '지금 저장된 내용이 백업 파일 내용으로 바뀌어요. 계속할까요?')) return;
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
  const api = { views, registerView, toast, modal, field, subjectField, route, refresh, download, exportData, importData, openSettings, get current() { return current; } };
  return api;
})();

// 주요 선택 동작마다 같은 계열의 짧은 효과음을 낸다.
(() => {
  let audio;
  document.addEventListener('click', (event) => {
    const target = event.target.closest('button, a, [role="button"], summary');
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
  });
})();
