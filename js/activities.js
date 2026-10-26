// 활동 관리: 수행평가·자율·동아리·봉사 등을 정리하고 생기부 중복을 확인
const Activities = (() => {
  const TYPES = {
    perf: { label: '수행평가', color: '#4f8cff' },
    auto: { label: '자율 활동', color: '#35c27a' },
    club: { label: '동아리', color: '#a276ff' },
    volunteer: { label: '봉사', color: '#ff6f91' },
    etc: { label: '기타', color: '#ff9f2e' },
  };
  const filters = { q: '', type: '', sem: '', grade: '', cv: '', group: 'sem', order: 'desc' };

  const load = () => Store.get('activities', []);
  const save = (l) => Store.set('activities', l);

  const norm = (s) => String(s || '').toLowerCase().replace(/[\s\-_.,()·]+/g, '');
  function bigrams(s) {
    const set = new Map();
    for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); set.set(g, (set.get(g) || 0) + 1); }
    return set;
  }
  // 이름이 같거나 많이 비슷하면 높은 값을 돌려준다.
  function similarity(a, b) {
    const x = norm(a); const y = norm(b);
    if (!x || !y) return 0;
    if (x === y) return 1;
    if (x.length >= 3 && y.length >= 3 && (x.includes(y) || y.includes(x))) return 0.85;
    const A = bigrams(x); const B = bigrams(y);
    let inter = 0;
    A.forEach((c, g) => { if (B.has(g)) inter += Math.min(c, B.get(g)); });
    const total = Math.max(1, x.length - 1) + Math.max(1, y.length - 1);
    return (2 * inter) / total;
  }
  const similarTo = (title, exceptId) => load().filter((a) => a.id !== exceptId && similarity(a.title, title) >= 0.6);

  function semLabel(a) {
    const parts = [];
    if (a.grade) parts.push(`${a.grade}학년`);
    if (a.semester) parts.push(`${a.semester}학기`);
    return parts.join(' ') || '학기 미지정';
  }

  function edit(act, after) {
    const isNew = !act.id;
    const title = h('input', { type: 'text', value: act.title || '', placeholder: '예: 환경 정화 봉사', maxLength: 80 });
    const type = h('select', null, Object.entries(TYPES).map(([k, v]) => h('option', { value: k, selected: k === act.type }, v.label)));
    const date = h('input', { type: 'date', value: act.id ? (act.date || '') : todayStr() });
    const noDate = h('input', { type: 'checkbox', checked: !!act.id && !act.date });
    date.disabled = noDate.checked;
    noDate.addEventListener('change', () => { date.disabled = noDate.checked; if (!noDate.checked && !date.value) date.value = todayStr(); });
    const dateField = h('div', { class: 'field' },
      h('span', { class: 'field-head' }, '날짜', h('label', { class: 'inline-check' }, noDate, '날짜 표기 안 함')), date);
    const grade = h('select', null, h('option', { value: '' }, '선택 안 함'), [1, 2, 3].map((g) => h('option', { value: g, selected: String(g) === String(act.grade) }, `${g}학년`)));
    const sem = h('select', null, h('option', { value: '' }, '선택 안 함'), [1, 2].map((s) => h('option', { value: s, selected: String(s) === String(act.semester) }, `${s}학기`)));
    const desc = h('textarea', { rows: 4, placeholder: '무엇을 했는지, 맡은 역할, 배운 점 등', value: act.desc || '' });
    const cv = h('textarea', { rows: 4, placeholder: '생기부에 이미 쓴 문장을 붙여 넣어 두면 나중에 같은 내용을 또 쓰지 않을 수 있어요.', value: act.cv || '' });
    const cvDone = h('input', { type: 'checkbox', checked: !!act.cvDone });
    const memo = h('textarea', { rows: 3, placeholder: '다음에 더 깊게 해 보고 싶은 점, 이어갈 아이디어 등', value: act.memo || '' });
    const warn = h('div', { class: 'warn', hidden: true });

    const checkSimilar = () => {
      const sim = title.value.trim().length >= 2 ? similarTo(title.value, act.id) : [];
      warn.hidden = !sim.length;
      warn.replaceChildren(...(sim.length ? [h('b', null, '비슷한 활동이 이미 있어요'),
        ...sim.slice(0, 4).map((s) => h('div', null, `${s.date || '날짜 없음'} · ${s.title}${s.cvDone ? ' (생기부 기록함)' : ''}`))] : []));
    };
    title.addEventListener('input', checkSimilar);
    checkSimilar();

    const m = App.modal({
      title: isNew ? '활동 추가' : '활동 보기·수정',
      wide: true,
      body: [
        App.field('활동명 *', title),
        warn,
        h('div', { class: 'row3' }, App.field('종류', type), dateField),
        h('div', { class: 'row3' }, App.field('학년', grade), App.field('학기', sem)),
        App.field('활동 내용', desc),
        App.field('생기부에 쓴 내용', cv),
        h('label', { class: 'check' }, cvDone, ' 생기부에 기록됐어요'),
        App.field('심화 메모', memo),
      ],
      footer: [
        !isNew ? h('button', { class: 'btn danger', type: 'button', onclick: () => {
          if (!confirm('이 활동을 삭제할까요?')) return;
          save(load().filter((x) => x.id !== act.id));
          m.close(); after();
        } }, '삭제') : null,
        h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, '취소'),
        h('button', { class: 'btn primary', type: 'button', onclick: submit }, '저장'),
      ],
    });
    function submit() {
      const t = title.value.trim();
      if (!t) { App.toast('활동명을 입력해 주세요.'); title.focus(); return; }
      if (!noDate.checked && !date.value) { App.toast('날짜를 선택하거나 “날짜 표기 안 함”을 체크해 주세요.'); return; }
      const sim = similarTo(t, act.id);
      if (sim.length && !confirm(`비슷한 활동이 있어요: "${sim[0].title}" (${sim[0].date || '날짜 없음'})\n그래도 저장할까요?`)) return;
      const rec = {
        id: act.id || uid(), title: t, type: type.value, date: noDate.checked ? '' : date.value,
        grade: grade.value, semester: sem.value, desc: desc.value.trim(), cv: cv.value.trim(),
        cvDone: cvDone.checked, memo: memo.value.trim(), created: act.created || Date.now(),
      };
      const list = load().filter((x) => x.id !== rec.id);
      list.push(rec);
      save(list);
      m.close();
      after();
    }
    setTimeout(() => title.focus(), 50);
  }

  function filtered() {
    const f = filters;
    const q = f.q.trim().toLowerCase();
    let list = load().filter((a) => (!f.type || a.type === f.type) && (!f.sem || String(a.semester) === f.sem)
      && (!f.grade || String(a.grade) === f.grade) && (!f.cv || (f.cv === 'done') === !!a.cvDone)
      && (!q || [a.title, a.desc, a.cv, a.memo].some((s) => String(s || '').toLowerCase().includes(q))));
    const dir = f.order === 'asc' ? 1 : -1;
    list = list.sort((a, b) => {
      if (!a.date || !b.date) return (a.date ? -1 : 0) + (b.date ? 1 : 0) || a.created - b.created;
      return dir * (a.date.localeCompare(b.date) || a.created - b.created);
    });
    return list;
  }

  function card(a, after) {
    const t = TYPES[a.type] || TYPES.etc;
    return h('button', { type: 'button', class: 'act-card', style: { '--c': t.color }, onclick: () => edit(a, after) },
      h('div', { class: 'act-top' },
        h('span', { class: 'badge' }, t.label),
        h('span', { class: 'act-date' }, a.date || '날짜 없음'),
        h('span', { class: 'cv-state ' + (a.cvDone ? 'ok' : 'no') }, a.cvDone ? '생기부 기록함' : '생기부 미기록')),
      h('h4', null, a.title),
      h('div', { class: 'act-sem' }, semLabel(a)),
      a.desc ? h('p', { class: 'act-desc' }, a.desc) : null,
      a.cv ? h('p', { class: 'act-cv' }, h('b', null, '생기부 '), a.cv) : null,
      a.memo ? h('p', { class: 'act-memo' }, h('b', null, '심화 '), a.memo) : null);
  }

  function render(root) {
    const listBox = h('div', { class: 'act-list' });
    const stat = h('div', { class: 'stat' });
    const redraw = () => {
      const all = load();
      const list = filtered();
      stat.replaceChildren(
        h('span', { class: 'pill' }, `전체 ${all.length}개`),
        h('span', { class: 'pill warn-pill' }, `생기부 미기록 ${all.filter((a) => !a.cvDone).length}개`),
        ...Object.entries(TYPES).map(([k, v]) => {
          const n = all.filter((a) => a.type === k).length;
          return n ? h('span', { class: 'pill', style: { '--c': v.color } }, `${v.label} ${n}`) : '';
        }).filter(Boolean));
      listBox.replaceChildren();
      if (!list.length) {
        listBox.append(h('div', { class: 'empty-box' }, all.length ? '조건에 맞는 활동이 없어요.' : '아직 기록한 활동이 없어요.'));
        return;
      }
      if (filters.group === 'none') {
        listBox.append(h('div', { class: 'act-grid' }, list.map((a) => card(a, redraw))));
        return;
      }
      const groups = [];
      const idx = new Map();
      list.forEach((a) => {
        const key = filters.group === 'type' ? (TYPES[a.type] || TYPES.etc).label : semLabel(a);
        if (!idx.has(key)) { idx.set(key, groups.length); groups.push({ key, items: [] }); }
        groups[idx.get(key)].items.push(a);
      });
      groups.forEach((g) => listBox.append(h('section', { class: 'act-group' },
        h('h3', null, g.key, h('small', null, ` ${g.items.length}개`)),
        h('div', { class: 'act-grid' }, g.items.map((a) => card(a, redraw))))));
    };

    const sel = (key, opts) => h('select', { onchange: (e) => { filters[key] = e.target.value; redraw(); } },
      opts.map(([v, l]) => h('option', { value: v, selected: filters[key] === v }, l)));

    root.append(h('section', { class: 'panel' },
      h('div', { class: 'title-row' },
        h('h1', { class: 'page-title' }, '활동 관리'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => edit({ type: 'perf' }, redraw) }, '＋ 활동 추가')),
      stat,
      h('div', { class: 'filters' },
        h('input', { type: 'search', placeholder: '활동명·내용 검색', value: filters.q, oninput: (e) => { filters.q = e.target.value; redraw(); } }),
        sel('type', [['', '모든 종류'], ...Object.entries(TYPES).map(([k, v]) => [k, v.label])]),
        sel('grade', [['', '모든 학년'], ['1', '1학년'], ['2', '2학년'], ['3', '3학년']]),
        sel('sem', [['', '모든 학기'], ['1', '1학기'], ['2', '2학기']]),
        sel('cv', [['', '생기부 전체'], ['done', '기록함'], ['todo', '미기록']]),
        sel('group', [['sem', '학기별'], ['type', '종류별'], ['none', '전체 목록']]),
        sel('order', [['desc', '최신순'], ['asc', '오래된순']])),
      listBox));
    redraw();
  }

  const stats = () => { const all = load(); return { total: all.length, todo: all.filter((a) => !a.cvDone).length }; };
  return { render, stats };
})();

App.registerView('activities', { label: '활동 관리', icon: 'activities', render: Activities.render });
