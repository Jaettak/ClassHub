// 성적 관리: 시험별 점수 기록, 추이 그래프, 과목별 평균
const Grades = (() => {
  const EXAMS = ['중간고사', '기말고사', '수행평가', '모의고사', '기타'];
  const filters = { grade: '', sem: '', q: '', subject: '', family: '', chart: 'course', chartExam: '', order: 'high', mode: 'school', term: '' };

  const load = () => Store.get('grades', []);
  const save = (l) => Store.set('grades', l);
  const pct = (g) => (g.full > 0 ? (g.score / g.full) * 100 : 0);
  const isMock = (g) => g.recordType === 'mockExam' || /모의고사/.test(g.exam || '');
  const category = (g) => isMock(g) ? 'mock' : g.recordType === 'courseResult' || /학기말|학기 성적/.test(g.exam || '') ? 'course'
    : /수행/.test([g.category, g.assessmentName, g.exam].join(' ')) ? 'assessment' : 'exam';
  const avgOf = (arr) => (arr.length ? arr.reduce((a, g) => a + pct(g), 0) / arr.length : 0);
  const fmt = (n) => (Math.round(n * 10) / 10).toString();
  const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));
  const rankOf = (g) => num(g.rank ?? g.sourceDetails?.rankGrade ?? g.sourceDetails?.gradeLevel ?? g.sourceDetails?.gradeRank ?? g.sourceDetails?.['석차등급']);

  const groupKey = (g) => `${g.schoolYear || ''}|${g.grade}|${g.semester}|${g.exam}|${g.recordType || ''}|${g.examDate || ''}`;
  const groupLabel = (g) => `${g.schoolYear ? `${g.schoolYear}학년도 ` : ''}${g.grade ? `${g.grade}학년 ` : ''}${g.semester ? `${g.semester}학기 ` : ''}${g.recordType === 'courseResult' ? '학기 성적' : g.exam || '시험'}${g.recordType === 'assessment' ? ' · 평가 항목' : ''}${g.examDate ? ` (${g.examDate})` : ''}`;

  function filtered() {
    const q = filters.q.trim().toLowerCase();
    return load().filter((g) => (!filters.grade || String(g.grade) === filters.grade) && (!filters.sem || String(g.semester) === filters.sem)
      && (!filters.subject || g.subject === filters.subject)
      && (!filters.family || Curriculum2022.familyFor(g.subject) === filters.family)
      && (!q || String(g.subject || '').toLowerCase().includes(q)));
  }

  function edit(g, after) {
    const isNew = !g.id;
    const grade = h('select', null, [1, 2, 3].map((n) => h('option', { value: n, selected: String(n) === String(g.grade) }, `${n}학년`)));
    const sem = h('select', null, [1, 2].map((n) => h('option', { value: n, selected: String(n) === String(g.semester) }, `${n}학기`)));
    const exam = h('select', null, EXAMS.map((x) => h('option', { value: x, selected: x === g.exam }, x)));
    const subject = App.subjectField('과목', g.subject || '');
    const score = h('input', { type: 'number', step: 'any', min: 0, value: g.score ?? '', placeholder: '내 점수' });
    const full = h('input', { type: 'number', step: 'any', min: 1, value: g.full ?? 100, placeholder: '만점' });
    const rank = h('input', { type: 'number', min: 1, max: 9, value: rankOf(g) ?? '', placeholder: '1~9' });
    const avg = h('input', { type: 'number', step: 'any', min: 0, value: g.avg ?? '', placeholder: '반 평균' });
    const examDate = h('input', { type: 'date', value: g.examDate || '' });
    const optional = (key, placeholder, max) => h('input', { type: 'number', step: 'any', min: 0, ...(max ? { max } : {}), value: g[key] ?? '', placeholder });
    const classRank = optional('classRank', '석차');
    const jointRank = optional('jointRank', '동석차 인원');
    const studentCount = optional('studentCount', '수강자 수');
    const stdDev = optional('stdDev', '표준편차');
    const achievement = h('select', null, [['', '선택 안 함'], ...'ABCDE'.split('').map((x) => [x, x])].map(([value, label]) => h('option', { value, selected: (g.achievement || '') === value }, label)));
    const achievementRate = optional('achievementRate', '내 성취도 비율', 100);
    const schoolRates = Object.fromEntries('ABCDE'.split('').map((x) => [x, optional('rate' + x, x + ' 비율', 100)]));
    const standardScore = optional('standardScore', '표준점수');
    const percentile = optional('percentile', '백분위', 100);
    const mockRank = optional('mockRank', '전국 석차');
    const mockParticipants = optional('mockParticipants', '응시자 수');
    const mockRates = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i + 1, optional('mockRate' + (i + 1), (i + 1) + '등급 비율', 100)]));
    const schoolFields = h('div', { class: 'gr-extra' },
      h('div', { class: 'row2' }, App.field('석차', classRank), App.field('동석차 인원', jointRank)),
      h('div', { class: 'row2' }, App.field('수강자 수', studentCount), App.field('표준편차', stdDev)),
      h('div', { class: 'row2' }, App.field('성취도', achievement), App.field('내 성취도 비율 (%)', achievementRate)),
      h('details', { class: 'gr-rates' }, h('summary', null, '성취도별 비율 입력'), h('div', { class: 'gr-rate-grid' }, ...Object.entries(schoolRates).map(([name, input]) => App.field(name + ' (%)', input)))));
    const mockFields = h('div', { class: 'gr-extra' },
      h('div', { class: 'row2' }, App.field('표준점수', standardScore), App.field('백분위 (%)', percentile)),
      h('div', { class: 'row2' }, App.field('전국 석차', mockRank), App.field('응시자 수', mockParticipants)),
      h('details', { class: 'gr-rates' }, h('summary', null, '등급별 비율 입력'), h('div', { class: 'gr-rate-grid' }, ...Object.entries(mockRates).map(([name, input]) => App.field(name + '등급 (%)', input)))));
    const drawExamFields = () => { schoolFields.hidden = exam.value === '모의고사'; mockFields.hidden = exam.value !== '모의고사'; };
    exam.addEventListener('change', drawExamFields); drawExamFields();
    const memo = h('textarea', { rows: 2, placeholder: '틀린 이유, 다음에 고칠 점 등', value: g.memo || '' });

    const m = App.modal({
      title: isNew ? '성적 추가' : '성적 수정',
      body: [
        h('div', { class: 'row3' }, App.field('학년', grade), App.field('학기', sem), App.field('시험', exam)),
        App.field('시험 날짜 (선택)', examDate),
        subject.el,
        h('div', { class: 'row2' }, App.field('점수 *', score), App.field('만점', full)),
        h('div', { class: 'row2' }, App.field('등급 (선택)', rank), App.field('평균 (선택)', avg)),
        schoolFields, mockFields,
        App.field('메모 (선택)', memo),
        g.sourceDetails ? h('details', { class: 'school-source-detail' }, h('summary', null, '가져온 성적표 원문과 추가 항목'), h('pre', null, JSON.stringify(g.sourceDetails, null, 2))) : null,
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
      const rateValues = [...Object.values(schoolRates), ...Object.values(mockRates), achievementRate, percentile].map((input) => num(input.value)).filter((value) => value != null);
      if (rateValues.some((value) => value < 0 || value > 100)) { App.toast('비율과 백분위는 0~100 사이로 입력해 주세요.'); return; }
      const rec = { ...g, id: g.id || uid(), grade: Number(grade.value), semester: Number(sem.value), exam: exam.value, subject: s, score: sc, full: fl,
        examDate: examDate.value, rank: num(rank.value), avg: num(avg.value), memo: memo.value.trim(), created: g.created || Date.now(),
        classRank: num(classRank.value), jointRank: num(jointRank.value), studentCount: num(studentCount.value), stdDev: num(stdDev.value),
        achievement: achievement.value, achievementRate: num(achievementRate.value),
        standardScore: num(standardScore.value), percentile: num(percentile.value), mockRank: num(mockRank.value), mockParticipants: num(mockParticipants.value),
        ...Object.fromEntries(Object.entries(schoolRates).map(([name, input]) => ['rate' + name, num(input.value)])),
        ...Object.fromEntries(Object.entries(mockRates).map(([name, input]) => ['mockRate' + name, num(input.value)])) };
      const list = load().filter((x) => x.id !== rec.id);
      list.push(rec);
      save(list);
      m.close();
      after();
    }
  }

  function view(g, after) {
    const field = (label, value) => value == null || value === '' ? null : h('div', { class: 'gr-view-field' }, h('small', null, label), h('strong', null, String(value)));
    const details = [field('과목', g.subject), field('시험', groupLabel(g)), field('점수', `${fmt(g.score)} / ${fmt(g.full)}점`),
      field('학교 평균', g.avg == null ? null : `${fmt(g.avg)}점`), field('등급', rankOf(g) == null ? null : `${rankOf(g)}등급`),
      field('성취도', g.achievement), field('석차', g.classRank), field('동석차 인원', g.jointRank),
      field('수강자 수', g.studentCount), field('표준점수', g.standardScore), field('백분위', g.percentile == null ? null : `${g.percentile}%`),
      field('메모', g.memo)].filter(Boolean);
    const dialog = App.modal({ title: g.subject || '성적 보기', wide: true, body: h('div', { class: 'gr-view-grid' }, details),
      footer: [h('button', { class: 'btn primary', type: 'button', onclick: () => { dialog.close(); edit(g, after); } }, '수정')] });
  }

  // 선택한 종류의 원점수만 표시한다.
  function trend(records, expanded = false, measuredHeight = null) {
    const n = records.length;
    if (!n) return h('p', { class: 'muted' }, '그래프로 볼 점수 기록이 없어요.');
    const W = expanded ? 820 : 600; const H = expanded ? 300 : measuredHeight || 220;
    const L = 42; const T = 26; const B = 58; const Rr = 28;
    const hi = Math.max(10, ...records.map((g) => Number(g.full) || Number(g.score) || 0));
    const X = (i) => (n === 1 ? (W + L - Rr) / 2 : L + (i * (W - L - Rr)) / (n - 1));
    const Y = (v) => T + (H - T - B) * (1 - v / hi);
    const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'gr-svg', role: 'img', 'aria-label': '선택한 성적의 원점수 추이' });
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const v = (hi * i) / ticks;
      svg.append(sv('line', { x1: L, x2: W - Rr, y1: Y(v), y2: Y(v), stroke: '#e4eaf7', 'stroke-width': 1 }),
        sv('text', { x: L - 6, y: Y(v), class: 'gr-ax', 'text-anchor': 'end', 'dominant-baseline': 'central' }, Math.round(v)));
    }
    if (n > 1) svg.append(sv('polyline', { points: records.map((g, i) => `${X(i)},${Y(g.score)}`).join(' '), fill: 'none', stroke: '#ff6f91', 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    const labelEvery = Math.max(1, Math.ceil(n / (expanded ? 10 : 6)));
    records.forEach((g, i) => {
      const pointX = X(i), pointY = Y(g.score);
      const labelLeft = pointX - 13 >= L + 30;
      svg.append(sv('circle', { cx: X(i), cy: Y(g.score), r: 5, fill: '#fff', stroke: '#ff6f91', 'stroke-width': 3 }, sv('title', null, `${g.subject} · ${groupLabel(g)}: ${fmt(g.score)} / ${fmt(g.full)}점`)),
        i % labelEvery === 0 || i === n - 1 ? sv('text', { x: labelLeft ? pointX - 13 : pointX + 13, y: pointY < T + 20 ? pointY + 17 : pointY - 9,
          class: 'gr-val', 'text-anchor': labelLeft ? 'end' : 'start' }, fmt(g.score)) : null,
        i % labelEvery === 0 || i === n - 1 ? sv('text', { x: X(i), y: H - 24, class: 'gr-ax', 'text-anchor': 'middle' }, `${g.grade || '—'}-${g.semester || '—'}`) : null,
        i % labelEvery === 0 || i === n - 1 ? sv('text', { x: X(i), y: H - 7, class: 'gr-ax', 'text-anchor': 'middle' }, (category(g) === 'course' ? '학기말' : g.exam || '시험').slice(0, 7)) : null);
    });
    return svg;
  }

  function gradeChart(records) {
    const rows = records.filter((g) => category(g) === 'course');
    const termKey = (g) => `${g.schoolYear || ''}|${g.grade || ''}|${g.semester || ''}`;
    const terms = [...new Set(rows.map(termKey))].sort((a, b) => a.localeCompare(b, 'ko', { numeric: true }));
    if (!terms.length) return h('p', { class: 'muted' }, '학기말 성적 기록이 없어요.');
    if (!terms.includes(filters.term)) filters.term = terms.at(-1);
    const tabs = h('div', { class: 'gr-term-tabs' });
    const content = h('div', { class: 'gr-distribution' });
    const panel = (title, labels, values, color) => {
      const max = Math.max(1, ...values);
      return h('section', { class: 'gr-dist-panel' }, h('h4', null, title), ...labels.map((label, i) => h('div', { class: 'gr-dist-row' },
        h('b', null, label), h('span', { class: 'gr-dist-track' }, h('i', { style: { width: `${values[i]/max*100}%`, background: color } })), h('strong', null, `${values[i]}개`))),
        values.every((value) => value === 0) ? h('p', { class: 'muted' }, title === '등급' ? '이 학기에 석차등급이 기록되지 않았어요.' : '이 학기에 성취도 기록이 없어요.') : null);
    };
    const draw = () => {
      tabs.replaceChildren(...terms.map((key) => {
        const sample = rows.find((g) => termKey(g) === key);
        const label = `${sample.schoolYear ? `${sample.schoolYear} · ` : ''}${sample.grade || '—'}학년 ${sample.semester || '—'}학기`;
        return h('button', { class: `seg-btn${filters.term === key ? ' on' : ''}`, type: 'button', onclick: () => { filters.term = key; draw(); } }, label);
      }));
      const termRows = rows.filter((g) => termKey(g) === filters.term);
      const counts = (labels, pick) => labels.map((label) => termRows.filter((g) => String(pick(g) ?? '').toUpperCase() === label).length);
      content.replaceChildren(panel('성취도', ['A', 'B', 'C', 'D', 'E'], counts(['A', 'B', 'C', 'D', 'E'], (g) => g.achievement), '#8a75d7'),
        panel('등급', ['1', '2', '3', '4', '5'], counts(['1', '2', '3', '4', '5'], rankOf), '#668de8'));
    };
    draw();
    return h('div', null, tabs, content);
  }

  function render(root) {
    root.append(SchoolData.tools('grades'));
    const body = h('div', { class: 'gr-body' });
    const stat = h('div', { class: 'stat' });
    let graphResize = null;
    const orderKey = (g) => `${g.examDate || ''}|${g.schoolYear || ''}|${g.grade || ''}|${g.semester || ''}|${g.created || 0}`;
    const familyOrder = (name) => { const i = Curriculum2022.families.indexOf(name); return i < 0 ? 999 : i; };
    const chartRowsFor = (rows) => rows.filter((g) => category(g) === (filters.mode === 'mock' ? 'mock' : filters.chart)
      && (filters.mode === 'mock' || filters.chart !== 'exam' || !filters.chartExam || g.exam === filters.chartExam)).sort((a, b) => orderKey(a).localeCompare(orderKey(b)));
    const combinedTrend = (rows) => {
      const groups = new Map();
      rows.forEach((g) => {
        const key = filters.mode === 'mock' ? `${g.examDate || g.schoolYear || ''}|${g.exam || '모의고사'}`
          : filters.chart === 'course' ? `${g.schoolYear || ''}|${g.grade || ''}|${g.semester || ''}`
            : `${g.schoolYear || ''}|${g.grade || ''}|${g.semester || ''}|${g.exam || '고사'}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(g);
      });
      return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, group]) => ({
        subject: '전체 평균', grade: group[0].grade, semester: group[0].semester,
        exam: filters.mode === 'mock' ? group[0].exam || '모의고사' : filters.chart === 'course' ? '학기말' : group[0].exam,
        score: group.reduce((sum, g) => sum+Number(g.score || 0), 0)/group.length,
        full: group.reduce((sum, g) => sum+Number(g.full || 100), 0)/group.length,
        examDate: group[0].examDate || '', schoolYear: group[0].schoolYear || '', groupKey: key,
      }));
    };
    const redraw = () => {
      graphResize?.disconnect(); graphResize = null;
      const all = load();
      const allMode = all.filter((g) => isMock(g) === (filters.mode === 'mock'));
      const list = filtered().filter((g) => isMock(g) === (filters.mode === 'mock'));
      stat.replaceChildren(h('span', { class: 'pill' }, `기록 ${list.length}개`));
      body.replaceChildren();
      if (!allMode.length) { body.append(h('div', { class: 'empty-box' }, all.length ? '이 탭에 기록한 성적이 없어요.' : '아직 기록한 성적이 없어요.')); return; }
      if (!list.length) body.append(h('div', { class: 'empty-box' }, '선택한 조건에 맞는 성적이 없어요. 아래 교과군·과목 목록에서 다른 기록을 볼 수 있어요.'));
      const subjects = [...new Set(allMode.map((g) => g.subject || '과목 없음'))];
      const families = [...new Set(subjects.map((name) => Curriculum2022.familyFor(name)))].sort((a, b) => familyOrder(a) - familyOrder(b) || a.localeCompare(b, 'ko'));
      const focused = filters.subject ? list.filter((g) => g.subject === filters.subject) : [];
      const selectedRows = focused.length ? focused : filters.family ? list.filter((g) => Curriculum2022.familyFor(g.subject) === filters.family) : [];
      if (filters.mode === 'school' && filters.subject) {
        filters.chart = 'exam'; chartFilter.value = 'exam'; chartFilter.hidden = true;
        filters.chartExam = ''; chartExamFilter.value = '';
      } else chartFilter.hidden = filters.mode === 'mock';
      chartExamFilter.hidden = filters.mode === 'mock' || !!filters.subject || filters.chart !== 'exam';
      const chartRows = chartRowsFor(focused);
      const summaryRows = chartRowsFor(selectedRows.length ? selectedRows : list);
      const graphRows = focused.length ? chartRows : combinedTrend(summaryRows);
      const barRows = focused.length ? chartRows.slice() : [...new Set(summaryRows.map((g) => g.subject))].map((name) => {
        const rows = summaryRows.filter((g) => g.subject === name);
        return { subject: name, exam: '평균', score: rows.reduce((sum, g) => sum + Number(g.score || 0), 0) / rows.length,
          full: rows.reduce((sum, g) => sum + Number(g.full || 100), 0) / rows.length };
      });
      const assessmentRows = focused.filter((g) => category(g) === 'assessment');
      if (filters.order === 'high' || filters.order === 'low') barRows.sort((a, b) => (filters.order === 'high' ? -1 : 1)*(Number(a.score)-Number(b.score)));
      const scoreAvg = (rows) => rows.length ? `${fmt(rows.reduce((sum, g) => sum + Number(g.score || 0), 0) / rows.length)}점` : '—';
      const bars = (rows) => h('div', { class: 'gr-bars' }, rows.length ? rows.map((g) => h('div', { class: 'gr-bar', style: { '--c': colorFor(g.subject) } },
        h('span', { class: 'gb-n' }, focused.length ? g.assessmentName || g.exam || '평가' : `${g.subject} · ${g.exam || '학기 성적'}`), h('span', { class: 'gb-t' }, h('i', { style: { width: `${Math.max(0, Math.min(100, pct(g)))}%` } })),
        h('b', null, `${fmt(g.score)} / ${fmt(g.full)}점`))) : h('p', { class: 'muted' }, '선택한 기준의 기록이 없어요.'));
      if (focused.length) body.append(h('section', { class: 'gr-card gr-focus' }, h('h3', null, `${filters.subject} 한눈에 보기`),
        filters.mode === 'mock' ? h('div', { class: 'gr-focus-grid' },
          h('div', null, h('small', null, '원점수 평균'), h('strong', null, scoreAvg(focused))),
          h('div', null, h('small', null, '표준점수 평균'), h('strong', null, (() => { const scores = focused.map((g) => num(g.standardScore)).filter((n) => n != null); return scores.length ? fmt(scores.reduce((a, b) => a+b, 0)/scores.length) : '—'; })())),
          h('div', null, h('small', null, '백분위 평균'), h('strong', null, (() => { const scores = focused.map((g) => num(g.percentile)).filter((n) => n != null); return scores.length ? fmt(scores.reduce((a, b) => a+b, 0)/scores.length) : '—'; })())),
          h('div', null, h('small', null, '최근 등급'), h('strong', null, focused.slice().sort((a, b) => orderKey(b).localeCompare(orderKey(a)))[0]?.rank ?? '—'))) : h('div', { class: 'gr-focus-grid' },
          h('div', null, h('small', null, '학기말 원점수'), h('strong', null, (() => { const latest = focused.filter((g) => category(g) === 'course').sort((a, b) => orderKey(b).localeCompare(orderKey(a)))[0]; return latest ? `${fmt(latest.score)} / ${fmt(latest.full)}점` : '—'; })())),
          h('div', null, h('small', null, '고사 평균 점수'), h('strong', null, scoreAvg(focused.filter((g) => category(g) === 'exam')))),
          h('div', null, h('small', null, '학기말 등수'), h('strong', null, (() => { const g = focused.filter((row) => category(row) === 'course').sort((a, b) => orderKey(b).localeCompare(orderKey(a)))[0]; return g?.classRank == null ? '—' : `${g.classRank}위${g.jointRank == null ? '' : ` · 동석차 ${g.jointRank}명`}`; })())),
          h('div', null, h('small', null, '학기말 성취도'), h('strong', null, focused.filter((g) => category(g) === 'course').sort((a, b) => orderKey(b).localeCompare(orderKey(a)))[0]?.achievement || '—'))),
        filters.mode === 'school' ? (() => {
          const latest = focused.filter((g) => category(g) === 'course').sort((a, b) => orderKey(b).localeCompare(orderKey(a)))[0];
          if (!latest) return null;
          const rates = 'ABCDE'.split('').map((label) => [label, num(latest['rate'+label] ?? latest.achievementDistribution?.[label])]).filter(([, value]) => value != null);
          return h('div', { class: 'gr-achievement-rates' }, h('h4', null, '학기말 성취도 비율'), rates.length
            ? h('div', { class: 'gr-bars' }, rates.map(([label, value]) => h('div', { class: 'gr-bar' }, h('b', null, label), h('span', { class: 'gb-t' }, h('i', { style: { width: `${Math.max(0, Math.min(100, value))}%`, background: '#8a75d7' } })), h('strong', null, `${fmt(value)}%`))))
            : h('p', { class: 'muted' }, '이 과목의 성취도 비율 기록이 없어요.'));
        })() : null));
      if (list.length) {
        const overview = h('div', { class: `gr-overview${focused.length && filters.mode === 'school' && !chartRows.length ? ' gr-no-trend' : ''}` },
        focused.length && filters.mode === 'school' ? h('section', { class: 'gr-card gr-score-split' }, h('h3', null, '고사별 점수'), bars(barRows),
          h('h3', null, '수행평가별 점수'), bars(assessmentRows))
          : h('section', { class: 'gr-card' }, h('h3', null, '과목별 점수'), h('p', { class: 'hint' }, `${filters.family || '전체 과목'}의 과목별 평균 점수`), bars(barRows)),
        focused.length && filters.mode === 'school' && !chartRows.length ? null : h('section', { class: 'gr-card' }, h('div', { class: 'title-row' }, h('h3', null, filters.mode === 'mock' ? '모의고사 추이' : filters.chart === 'course' ? '학기말 추이' : '고사별 추이'),
          h('button', { class: 'btn ghost', type: 'button', onclick: () => App.modal({ title: '점수 추이 확대', wide: true, body: trend(graphRows, true) }) }, '확대')),
          h('div', { class: 'gr-chart' }, trend(graphRows))),
        filters.mode === 'school' ? h('section', { class: 'gr-card gr-grade-chart' }, h('h3', null, '학기별 등급·성취도'), gradeChart(allMode)) : null);
        body.append(overview);
        const chartHost = overview.querySelector('.gr-chart');
        if (chartHost && graphRows.length && typeof ResizeObserver !== 'undefined') {
          const scoreCard = overview.firstElementChild, chartCard = chartHost.closest('.gr-card');
          let measured = '';
          const fitTrend = () => {
            if (!chartHost.isConnected) return;
            const width = chartHost.clientWidth, leftHeight = scoreCard.getBoundingClientRect().height;
            if (!width || !leftHeight) return;
            const next = `${width}|${leftHeight}`;
            if (next === measured) return;
            measured = next;
            const heading = chartCard.querySelector('.title-row')?.getBoundingClientRect().height || 36;
            const stacked = matchMedia('(max-width: 720px)').matches;
            const cardHeight = stacked ? 300 : Math.max(235, Math.min(570, leftHeight));
            const targetHeight = Math.max(180, Math.min(500, cardHeight - heading - 32));
            chartCard.style.height = `${cardHeight}px`;
            chartHost.style.height = `${targetHeight}px`;
            chartHost.replaceChildren(trend(graphRows, false, targetHeight * 600 / width));
          };
          graphResize = new ResizeObserver(fitTrend);
          graphResize.observe(scoreCard);
          requestAnimationFrame(fitTrend);
        }
      }
      const record = (g) => h('button', { class: 'gr-result-open', type: 'button', onclick: () => view(g, redraw) },
        h('b', null, groupLabel(g)), h('span', null, `${fmt(g.score)} / ${fmt(g.full)}점`),
        h('small', null, isMock(g) ? `등급 ${g.rank ?? '—'} · 표준점수 ${g.standardScore ?? '—'} · 백분위 ${g.percentile ?? '—'}`
          : `학교 평균 ${g.avg == null ? '—' : `${fmt(g.avg)}점`} · 등급 ${g.rank ?? '—'} · 성취도 ${g.achievement || '—'}`));
      families.forEach((family) => {
        const names = subjects.filter((name) => Curriculum2022.familyFor(name) === family).sort((a, b) => a.localeCompare(b, 'ko', { numeric: true }));
        body.append(h('details', { class: 'gr-card gr-family', open: family === filters.family || !!filters.subject && names.includes(filters.subject), ontoggle: (event) => {
          if (!event.currentTarget.open && event.currentTarget.isConnected) event.currentTarget.querySelectorAll('.gr-subject-group').forEach((detail) => { detail.open = false; });
        } },
          h('summary', null, family, ` · ${names.length}과목`),
          ...names.map((name) => h('details', { class: 'gr-subject-group', open: name === filters.subject },
            h('summary', null, h('i', { class: 'gr-dot', style: { background: colorFor(name) } }), name),
            h('button', { class: 'btn ghost', type: 'button', onclick: () => { filters.family = family; filters.subject = name; familyFilter.value = family; subjectFilter.value = name; redraw(); } }, '이 과목 그래프 보기'),
            ...allMode.filter((g) => g.subject === name).sort((a, b) => filters.order === 'low' ? Number(a.score)-Number(b.score) : Number(b.score)-Number(a.score)).map(record)))));
      });
    };

    const sel = (key, opts) => h('select', { onchange: (e) => { filters[key] = e.target.value; redraw(); } },
      opts.map(([v, l]) => h('option', { value: v, selected: filters[key] === v }, l)));

    const subjectFilter = sel('subject', [['', '모든 과목'], ...[...new Set(load().map((g) => g.subject))].sort((a, b) => a.localeCompare(b, 'ko')).map((name) => [name, name])]);
    const familyFilter = sel('family', [['', '모든 교과군'], ...Curriculum2022.families.map((name) => [name, name])]);
    subjectFilter.addEventListener('change', () => { if (filters.subject && filters.family && Curriculum2022.familyFor(filters.subject) !== filters.family) { filters.family = ''; familyFilter.value = ''; redraw(); } });
    const chartExamFilter = sel('chartExam', [['', '모든 고사'], ...[...new Set(load().filter((g) => category(g) === 'exam').map((g) => g.exam))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'ko')).map((name) => [name, name])]);
    chartExamFilter.hidden = filters.chart !== 'exam' || filters.mode === 'mock';
    const chartFilter = h('select', { 'aria-label': '그래프 종류', onchange: (event) => { filters.chart = event.target.value; chartExamFilter.hidden = filters.chart !== 'exam'; redraw(); } },
      [['course', '학기말 그래프'], ['exam', '고사별 그래프']].map(([value, label]) => h('option', { value, selected: filters.chart === value }, label)));
    const modeTabs = h('div', { class: 'seg gr-mode-tabs' }, [['school', '내신'], ['mock', '모의고사']].map(([value, label]) => h('button', { class: `seg-btn${filters.mode === value ? ' on' : ''}`, type: 'button', onclick: () => {
      filters.mode = value; modeTabs.querySelectorAll('button').forEach((button) => button.classList.toggle('on', button.textContent === label)); chartFilter.hidden = value === 'mock'; chartExamFilter.hidden = value === 'mock' || filters.chart !== 'exam'; redraw();
    } }, label)));
    const search = h('input', { type: 'search', 'aria-label': '과목 검색', placeholder: '과목 이름 검색', value: filters.q, oninput: (e) => { filters.q = e.target.value; redraw(); } });
    root.append(h('section', { class: 'panel' },
      h('div', { class: 'title-row' },
        h('h1', { class: 'page-title' }, '성적 관리'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => edit({ grade: Number(filters.grade) || 1, semester: Number(filters.sem) || 1, exam: filters.mode === 'mock' ? '모의고사' : '중간고사', full: 100 }, redraw) }, '＋ 성적 추가')),
      stat,
      h('div', { class: 'gr-mode-row' }, modeTabs, search),
      h('div', { class: 'filters gr-filters' },
        sel('grade', [['', '모든 학년'], ['1', '1학년'], ['2', '2학년'], ['3', '3학년']]),
        sel('sem', [['', '모든 학기'], ['1', '1학기'], ['2', '2학기']]),
        familyFilter,
        subjectFilter,
        chartFilter,
        chartExamFilter,
        sel('order', [['high', '점수 높은순'], ['low', '점수 낮은순']])),
      body));
    redraw();
    const extras = Store.get('schoolReportExtras', []);
    if (extras.length) root.append(h('details', { class: 'school-import-tools' }, h('summary', null, `점수가 없는 성적표 기록 ${extras.length}개`),
      h('div', { class: 'school-source-list' }, extras.map((item) => h('details', { class: 'school-source-detail' },
        h('summary', null, `${item.subject || '과목 없음'} · ${item.exam || ''}`), h('pre', null, JSON.stringify(item.sourceDetails, null, 2)))))));
  }

  return { render };
})();

App.registerView('grades', { label: '성적 관리', icon: 'grades', render: Grades.render });
