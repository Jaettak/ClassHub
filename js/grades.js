// 성적 관리: 시험별 점수 기록, 추이 그래프, 과목별 평균
const Grades = (() => {
  const EXAMS = ['중간고사', '기말고사', '수행평가', '모의고사', '기타'];
  const filters = { grade: '', sem: '' };

  const load = () => Store.get('grades', []);
  const save = (l) => Store.set('grades', l);
  const pct = (g) => (g.full > 0 ? (g.score / g.full) * 100 : 0);
  const avgOf = (arr) => (arr.length ? arr.reduce((a, g) => a + pct(g), 0) / arr.length : 0);
  const fmt = (n) => (Math.round(n * 10) / 10).toString();
  const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));

  const groupKey = (g) => `${g.grade}|${g.semester}|${EXAMS.indexOf(g.exam)}`;
  const groupLabel = (g) => `${g.grade}학년 ${g.semester}학기 ${g.exam}`;

  function filtered() {
    return load().filter((g) => (!filters.grade || String(g.grade) === filters.grade) && (!filters.sem || String(g.semester) === filters.sem));
  }

  function edit(g, after) {
    const isNew = !g.id;
    const grade = h('select', null, [1, 2, 3].map((n) => h('option', { value: n, selected: String(n) === String(g.grade) }, `${n}학년`)));
    const sem = h('select', null, [1, 2].map((n) => h('option', { value: n, selected: String(n) === String(g.semester) }, `${n}학기`)));
    const exam = h('select', null, EXAMS.map((x) => h('option', { value: x, selected: x === g.exam }, x)));
    const subject = App.subjectField('과목', g.subject || '');
    const score = h('input', { type: 'number', step: 'any', min: 0, value: g.score ?? '', placeholder: '내 점수' });
    const full = h('input', { type: 'number', step: 'any', min: 1, value: g.full ?? 100, placeholder: '만점' });
    const rank = h('input', { type: 'number', min: 1, max: 9, value: g.rank ?? '', placeholder: '1~9' });
    const avg = h('input', { type: 'number', step: 'any', min: 0, value: g.avg ?? '', placeholder: '반 평균' });
    const memo = h('textarea', { rows: 2, placeholder: '틀린 이유, 다음에 고칠 점 등', value: g.memo || '' });

    const m = App.modal({
      title: isNew ? '성적 추가' : '성적 수정',
      body: [
        h('div', { class: 'row3' }, App.field('학년', grade), App.field('학기', sem), App.field('시험', exam)),
        subject.el,
        h('div', { class: 'row2' }, App.field('점수 *', score), App.field('만점', full)),
        h('div', { class: 'row2' }, App.field('등급 (선택)', rank), App.field('평균 (선택)', avg)),
        App.field('메모 (선택)', memo),
      ],
      footer: [
        !isNew ? h('button', { class: 'btn danger', type: 'button', onclick: () => {
          if (!confirm('이 성적을 삭제할까요?')) return;
          save(load().filter((x) => x.id !== g.id)); m.close(); after();
        } }, '삭제') : null,
        h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, '취소'),
        h('button', { class: 'btn primary', type: 'button', onclick: submit }, '저장'),
      ],
    });
    function submit() {
      const s = subject.value();
      if (!s) { App.toast('과목을 선택하거나 입력해 주세요.'); return; }
      const sc = num(score.value);
      const fl = num(full.value) || 100;
      if (sc == null || sc < 0) { App.toast('점수를 입력해 주세요.'); score.focus(); return; }
      if (sc > fl) { App.toast('점수가 만점보다 커요.'); score.focus(); return; }
      const rec = { id: g.id || uid(), grade: Number(grade.value), semester: Number(sem.value), exam: exam.value, subject: s, score: sc, full: fl,
        rank: num(rank.value), avg: num(avg.value), memo: memo.value.trim(), created: g.created || Date.now() };
      const list = load().filter((x) => x.id !== rec.id);
      list.push(rec);
      save(list);
      m.close();
      after();
    }
  }

  // 시험별 평균(%) 꺾은선
  function trend(groups) {
    const n = groups.length;
    const W = Math.max(360, n * 84 + 60); const H = 210;
    const L = 38; const T = 20; const B = 38; const Rr = 18;
    const vals = groups.map((x) => x.avg);
    const lo = Math.max(0, Math.floor((Math.min(...vals) - 10) / 10) * 10);
    const hi = 100;
    const X = (i) => (n === 1 ? (W + L - Rr) / 2 : L + (i * (W - L - Rr)) / (n - 1));
    const Y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
    const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'gr-svg', role: 'img', 'aria-label': '시험별 평균 점수 추이' });
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const v = lo + ((hi - lo) * i) / ticks;
      svg.append(sv('line', { x1: L, x2: W - Rr, y1: Y(v), y2: Y(v), stroke: '#e4eaf7', 'stroke-width': 1 }),
        sv('text', { x: L - 6, y: Y(v), class: 'gr-ax', 'text-anchor': 'end', 'dominant-baseline': 'central' }, Math.round(v)));
    }
    if (n > 1) svg.append(sv('polyline', { points: groups.map((x, i) => `${X(i)},${Y(x.avg)}`).join(' '), fill: 'none', stroke: '#ff6f91', 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    groups.forEach((x, i) => {
      svg.append(sv('circle', { cx: X(i), cy: Y(x.avg), r: 5, fill: '#fff', stroke: '#ff6f91', 'stroke-width': 3 }, sv('title', null, `${x.label}: ${fmt(x.avg)}%`)),
        sv('text', { x: X(i), y: Y(x.avg) - 11, class: 'gr-val', 'text-anchor': 'middle' }, fmt(x.avg)),
        sv('text', { x: X(i), y: H - 20, class: 'gr-ax', 'text-anchor': 'middle' }, `${x.g}-${x.s}`),
        sv('text', { x: X(i), y: H - 6, class: 'gr-ax', 'text-anchor': 'middle' }, x.exam.slice(0, 4)));
    });
    return svg;
  }

  function render(root) {
    const body = h('div', { class: 'gr-body' });
    const stat = h('div', { class: 'stat' });

    const redraw = () => {
      const all = load();
      const list = filtered();
      body.replaceChildren();
      stat.replaceChildren(h('span', { class: 'pill' }, `기록 ${list.length}개`));
      if (!list.length) {
        body.append(h('div', { class: 'empty-box' }, all.length ? '조건에 맞는 성적이 없어요.' : '아직 기록한 성적이 없어요.'));
        return;
      }

      // 시험별 묶음
      const map = new Map();
      list.forEach((g) => { const k = groupKey(g); if (!map.has(k)) map.set(k, { g: g.grade, s: g.semester, exam: g.exam, label: groupLabel(g), items: [] }); map.get(k).items.push(g); });
      const groups = [...map.values()].sort((a, b) => a.g - b.g || a.s - b.s || EXAMS.indexOf(a.exam) - EXAMS.indexOf(b.exam));
      groups.forEach((x) => { x.avg = avgOf(x.items); x.items.sort((a, b) => a.subject.localeCompare(b.subject, 'ko')); });

      // 과목별 평균
      const bySubj = new Map();
      list.forEach((g) => { if (!bySubj.has(g.subject)) bySubj.set(g.subject, []); bySubj.get(g.subject).push(g); });
      const subj = [...bySubj.entries()].map(([name, arr]) => ({ name, avg: avgOf(arr), n: arr.length })).sort((a, b) => b.avg - a.avg);
      const last = groups[groups.length - 1];

      stat.append(
        h('span', { class: 'pill', style: { '--c': '#ff6f91' } }, `전체 평균 ${fmt(avgOf(list))}%`),
        h('span', { class: 'pill', style: { '--c': '#35c27a' } }, `최고 과목 ${subj[0].name}`),
        h('span', { class: 'pill', style: { '--c': '#4f8cff' } }, `최근 ${last.exam} ${fmt(last.avg)}%`));

      body.append(
        h('div', { class: 'gr-top' },
          h('section', { class: 'gr-card' }, h('h3', null, '시험별 평균 추이'), h('div', { class: 'gr-chart' }, trend(groups))),
          h('section', { class: 'gr-card' }, h('h3', null, '과목별 평균'),
            h('div', { class: 'gr-bars' }, subj.map((s) => h('div', { class: 'gr-bar', style: { '--c': colorFor(s.name) }, title: `${s.name} · ${s.n}회` },
              h('span', { class: 'gb-n' }, s.name), h('span', { class: 'gb-t' }, h('i', { style: { width: Math.max(2, Math.min(100, s.avg)) + '%' } })), h('b', null, fmt(s.avg))))))),
        ...groups.slice().reverse().map((gr) => h('section', { class: 'gr-card' },
          h('h3', null, gr.label, h('small', null, ` 평균 ${fmt(gr.avg)}%`)),
          h('div', { class: 'gr-scroll' }, h('table', { class: 'gr-table' },
            h('thead', null, h('tr', null, ['과목', '점수', '백분율', '등급', '평균 대비', '메모'].map((t) => h('th', null, t)))),
            h('tbody', null, gr.items.map((g) => {
              const diff = g.avg != null ? g.score - g.avg : null;
              const open = () => edit(g, redraw);
              return h('tr', { tabIndex: 0, onclick: open, onkeydown: (e) => { if (e.key === 'Enter') open(); } },
                h('td', null, h('i', { class: 'gr-dot', style: { background: colorFor(g.subject) } }), g.subject),
                h('td', null, `${fmt(g.score)} / ${fmt(g.full)}`),
                h('td', null, `${fmt(pct(g))}%`),
                h('td', null, g.rank != null ? `${g.rank}등급` : '-'),
                h('td', { class: diff == null ? '' : diff >= 0 ? 'up' : 'down' }, diff == null ? '-' : `${diff >= 0 ? '+' : ''}${fmt(diff)}`),
                h('td', { class: 'gr-memo' }, g.memo || ''));
            })))))));
    };

    const sel = (key, opts) => h('select', { onchange: (e) => { filters[key] = e.target.value; redraw(); } },
      opts.map(([v, l]) => h('option', { value: v, selected: filters[key] === v }, l)));

    root.append(h('section', { class: 'panel' },
      h('div', { class: 'title-row' },
        h('h1', { class: 'page-title' }, '성적 관리'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => edit({ grade: Number(filters.grade) || 1, semester: Number(filters.sem) || 1, exam: '중간고사', full: 100 }, redraw) }, '＋ 성적 추가')),
      stat,
      h('div', { class: 'filters' },
        sel('grade', [['', '모든 학년'], ['1', '1학년'], ['2', '2학년'], ['3', '3학년']]),
        sel('sem', [['', '모든 학기'], ['1', '1학기'], ['2', '2학기']])),
      body));
    redraw();
  }

  return { render };
})();

App.registerView('grades', { label: '성적 관리', icon: 'grades', render: Grades.render });
