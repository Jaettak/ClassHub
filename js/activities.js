// 활동·출결·생기부 기록을 성격에 맞게 나누어 보여 준다.
const Activities = (() => {
  const TYPES = {
    perf: { label: '수행평가', color: '#4f8cff' },
    auto: { label: '자율 활동', color: '#35c27a' },
    club: { label: '동아리', color: '#a276ff' },
    volunteer: { label: '봉사', color: '#ff6f91' },
    career: { label: '진로 활동', color: '#18bfd1' },
    reading: { label: '독서', color: '#d09347' },
    etc: { label: '기타', color: '#ff9f2e' },
  };
  const filters = { q: '', type: '', sem: '', grade: '', cv: '', group: 'curriculum', order: 'desc', view: 'activities' };

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
  const recordKind = (a) => a.recordType || a.sourceDetails?.recordType || '';
  const viewFor = (a) => recordKind(a) === 'attendance' ? 'attendance' : recordKind(a) === 'award' ? 'awards'
    : ['narrative', 'courseRecord', 'completion'].includes(recordKind(a)) ? 'source' : 'activities';
  const colorRules = () => Store.get('activityColorRules', { mode: 'type', type: {}, family: {}, subject: {} });
  const borderColor = (a) => {
    const rules = colorRules(), family = Curriculum2022.familyFor(a.subject), type = TYPES[a.type] ? a.type : 'etc';
    return (rules.mode === 'subject' && rules.subject?.[a.subject]) || (rules.mode !== 'type' && rules.family?.[family]) || rules.type?.[type] || TYPES[type].color;
  };
  const subjectsOf = (a) => Array.isArray(a.subjects) && a.subjects.length ? a.subjects.filter(Boolean) : a.subject ? [a.subject] : [];
  const typeLabel = (a) => a.sourceSchoolImport && a.type === 'perf' && !/수행평가|수행 평가/.test([a.title, a.desc, a.sourceDetails?.type, a.sourceDetails?.assessmentName].join(' '))
    ? '종류 미확인' : (TYPES[a.type] || TYPES.etc).label;

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
    const subject = App.subjectField('관련 과목 추가', '', { empty: '과목 선택' });
    const subjects = [...new Set(subjectsOf(act))];
    const subjectPicks = h('div', { class: 'act-subject-picks' });
    const drawSubjects = () => subjectPicks.replaceChildren(...subjects.map((name) => h('button', { class: 'btn ghost', type: 'button', onclick: () => { subjects.splice(subjects.indexOf(name), 1); drawSubjects(); } }, `${name} ×`)));
    drawSubjects();
    const warn = h('div', { class: 'warn act-similar', hidden: true });

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
        subject.el, h('button', { class: 'btn ghost', type: 'button', onclick: () => { const name = subject.value(); if (name && !subjects.includes(name)) { subjects.push(name); drawSubjects(); } } }, '관련 과목 추가'), subjectPicks,
        App.field('활동 내용', desc),
        App.field('생기부에 기재된 내용', cv),
        h('label', { class: 'check' }, cvDone, '생기부에 기재되었어요'),
        App.field('심화 메모', memo),
        act.sourceDetails ? h('details', { class: 'school-source-detail' }, h('summary', null, '생기부에서 가져온 원문과 추가 항목'), h('pre', null, JSON.stringify(act.sourceDetails, null, 2))) : null,
        h('p', { class: 'hint' }, '과목명이나 활동 종류가 불확실하면 학교 자료나 공식 교육과정을 검색해 확인하세요.'),
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
      const rec = { ...act,
        id: act.id || uid(), title: t, type: type.value, date: noDate.checked ? '' : date.value,
        grade: grade.value, semester: sem.value, subjects: [...new Set([...subjects, subject.value()].filter(Boolean))], subject: subjects[0] || subject.value(), desc: desc.value.trim(), cv: cv.value.trim(),
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
    let list = load().filter((a) => viewFor(a) === f.view && (f.view !== 'activities' || !f.type || a.type === f.type) && (f.view !== 'activities' || !f.sem || String(a.semester) === f.sem)
      && (f.view !== 'activities' || !f.grade || String(a.grade) === f.grade) && (f.view !== 'activities' || !f.cv || (f.cv === 'done') === (!!a.cvDone || !!a.sourceSchoolImport))
      && (f.view !== 'activities' || !q || [a.title, ...subjectsOf(a), a.desc, a.cv, a.memo].some((s) => String(s || '').toLowerCase().includes(q))));
    const dir = f.order === 'asc' ? 1 : -1;
    list = list.sort((a, b) => {
      if (!a.date || !b.date) return (a.date ? -1 : 0) + (b.date ? 1 : 0) || a.created - b.created;
      return dir * (a.date.localeCompare(b.date) || a.created - b.created);
    });
    return list;
  }

  function card(a, after) {
    const recorded = a.cvDone || a.sourceSchoolImport && a.reportStatus !== 'notProvided';
    return h('button', { type: 'button', class: 'act-card', style: { '--c': borderColor(a) }, onclick: () => {
      const dialog = App.modal({ title: a.title, wide: true, body: [
        h('p', null, `${typeLabel(a)} · ${a.date || '날짜 없음'} · ${semLabel(a)}`),
        subjectsOf(a).length ? h('p', null, `관련 과목: ${subjectsOf(a).join(', ')}`) : null,
        a.desc ? h('p', null, a.desc) : null,
        a.cv ? h('section', null, h('b', null, '생기부에 기재된 내용'), h('p', null, a.cv)) : null,
        a.memo ? h('section', null, h('b', null, '심화 메모'), h('p', null, a.memo)) : null,
      ], footer: [h('button', { class: 'btn primary', type: 'button', onclick: () => { dialog.close(); edit(a, after); } }, '수정')] });
    } },
      h('div', { class: 'act-top' },
        h('span', { class: 'badge' }, typeLabel(a)),
        h('span', { class: 'act-date' }, a.date || '날짜 없음'),
        h('span', { class: 'cv-state ' + (recorded ? 'ok' : 'no') }, recorded ? '생기부에 기재됨' : '생기부 미기재')),
      h('h4', null, subjectsOf(a).length ? `${subjectsOf(a).join(', ')} · ${a.title}` : a.title),
      h('div', { class: 'act-sem' }, semLabel(a)),
      a.desc ? h('p', { class: 'act-desc' }, a.desc) : null,
      a.memo ? h('p', { class: 'act-memo' }, h('b', null, '심화 '), a.memo) : null);
  }

  function attendanceCard(a) {
    const report = a.sourceDetails?.attendance || {};
    const cell = (label, values) => h('tr', null, h('th', null, label), ...['illness', 'unexcused', 'other'].map((key) => h('td', null, values?.[key] ?? '—')));
    return h('section', { class: 'gr-card act-attendance' }, h('h3', null, a.grade ? `${a.grade}학년 출결` : '학년 미상 출결'),
      h('p', null, '수업 일수: ', h('strong', null, report.schoolDays ?? '미기재'), report.schoolDays != null ? '일' : ''),
      h('div', { class: 'gr-scroll' }, h('table', { class: 'gr-table' }, h('thead', null, h('tr', null, ['구분', '질병', '미인정', '기타'].map((name) => h('th', null, name)))),
        h('tbody', null, cell('결석', report.absence), cell('지각', report.late), cell('조퇴', report.earlyLeave), cell('결과', report.classExit)))),
      report.remarks ? h('p', null, report.remarks) : null);
  }

  function render(root) {
    const expanded = new Set();
    root.append(SchoolData.tools('activities'));
    const listBox = h('div', { class: 'act-list' });
    const stat = h('div', { class: 'stat' });
    const groupActions = h('div', { class: 'act-group-actions' });
    const filterBox = h('div', { class: 'filters' });
    const addButton = h('button', { class: 'btn primary', type: 'button', onclick: () => edit({ type: 'etc' }, redraw) }, '＋ 활동 추가');
    const redraw = () => {
      const all = load();
      const list = filtered();
      const active = filters.view === 'activities';
      addButton.hidden = !active; filterBox.hidden = !active; groupActions.hidden = !active || filters.group === 'none';
      stat.replaceChildren(...[
        h('span', { class: 'pill' }, `${{ activities: '활동', attendance: '출결', awards: '수상', source: '생기부 원문·기타' }[filters.view]} ${list.length}개`),
        active ? h('span', { class: 'pill warn-pill' }, `생기부 미기재 ${all.filter((a) => viewFor(a) === 'activities' && !a.cvDone && !a.sourceSchoolImport).length}개`) : null,
        ...(active ? Object.entries(TYPES).map(([k, v]) => {
          const n = all.filter((a) => viewFor(a) === 'activities' && a.type === k).length;
          return n ? h('span', { class: 'pill', style: { '--c': v.color } }, `${v.label} ${n}`) : '';
        }).filter(Boolean) : [])].filter(Boolean));
      listBox.replaceChildren();
      if (!list.length) {
        listBox.append(h('div', { class: 'empty-box' }, '표시할 기록이 없어요.'));
        return;
      }
      if (filters.view === 'attendance') { listBox.append(...list.sort((a, b) => Number(a.grade || 0) - Number(b.grade || 0)).map(attendanceCard)); return; }
      if (filters.view === 'awards') { listBox.append(h('div', { class: 'act-grid' }, list.map((a) => card(a, redraw)))); return; }
      if (filters.view === 'source') { listBox.append(...list.map((a) => h('details', { class: 'school-source-detail' },
        h('summary', null, `${a.grade ? `${a.grade}학년 ` : ''}${a.semester ? `${a.semester}학기 ` : ''}${a.title}`),
        h('p', null, a.cv || a.desc || '원문은 아래에서 확인하세요.'), h('pre', null, JSON.stringify(a.sourceDetails || a, null, 2))))); return; }
      if (filters.group === 'none') {
        listBox.append(h('div', { class: 'act-grid' }, list.map((a) => card(a, redraw))));
        return;
      }
      if (filters.group === 'curriculum') {
        const grades = [...new Set(list.map((a) => a.grade || '미지정'))].sort((a, b) => String(a).localeCompare(String(b), 'ko', { numeric: true }));
        const allKeys = [];
        const detail = (key, title, children, count) => {
          allKeys.push(key);
          return h('details', { class: 'act-group', open: expanded.has(key), ontoggle: (event) => { if (!event.currentTarget.isConnected) return; if (event.currentTarget.open) expanded.add(key); else { expanded.delete(key); [...expanded].filter((child) => child.startsWith(key+'/')).forEach((child) => expanded.delete(child)); event.currentTarget.querySelectorAll('details.act-group').forEach((child) => { child.open = false; }); } } },
            h('summary', null, title, h('small', null, ` ${count}개`)), ...children);
        };
        const familyOrder = (name) => { const i = Curriculum2022.families.indexOf(name); return i < 0 ? 999 : i; };
        grades.forEach((grade) => {
          const gradeItems = list.filter((a) => String(a.grade || '미지정') === String(grade));
          const familyOf = (name) => name ? Curriculum2022.familyFor(name) : '기타';
          const families = [...new Set(gradeItems.flatMap((a) => subjectsOf(a).length ? subjectsOf(a).map(familyOf) : ['기타']))]
            .sort((a, b) => familyOrder(a) - familyOrder(b) || a.localeCompare(b, 'ko'));
          listBox.append(detail(`grade:${grade}`, grade === '미지정' ? '학년 미지정' : `${grade}학년`, families.map((family) => {
            const familyItems = gradeItems.filter((a) => subjectsOf(a).some((name) => familyOf(name) === family) || family === '기타' && !subjectsOf(a).length);
            const names = [...new Set(familyItems.flatMap((a) => subjectsOf(a).filter((name) => familyOf(name) === family)))].sort((a, b) => a.localeCompare(b, 'ko', { numeric: true }));
            if (family === '기타') names.push('과목 없음');
            return detail(`grade:${grade}/family:${family}`, family, names.map((name) => {
              const rows = familyItems.filter((a) => name === '과목 없음' ? !subjectsOf(a).length : subjectsOf(a).includes(name));
              return detail(`grade:${grade}/family:${family}/subject:${name}`, name, [h('div', { class: 'act-grid' }, rows.map((a) => card(a, redraw)))], rows.length);
            }), familyItems.length);
          }), gradeItems.length));
        });
        groupActions.replaceChildren(
          h('button', { class: 'btn ghost', type: 'button', onclick: () => { allKeys.forEach((key) => expanded.add(key)); redraw(); } }, '전체 펼치기'),
          h('button', { class: 'btn ghost', type: 'button', onclick: () => { allKeys.forEach((key) => expanded.delete(key)); redraw(); } }, '전체 접기'));
        return;
      }
      const groups = [];
      const idx = new Map();
      list.forEach((a) => {
        const key = filters.group === 'subject' ? (a.subject || '과목 없음') : filters.group === 'type' ? (TYPES[a.type] || TYPES.etc).label : semLabel(a);
        if (!idx.has(key)) { idx.set(key, groups.length); groups.push({ key, items: [] }); }
        groups[idx.get(key)].items.push(a);
      });
      if (filters.group === 'sem') groups.sort((a, b) => a.key.localeCompare(b.key, 'ko', { numeric: true }));
      groupActions.replaceChildren(
        h('button', { class: 'btn ghost', type: 'button', onclick: () => { groups.forEach((g) => expanded.add(g.key)); redraw(); } }, '전체 펼치기'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => { groups.forEach((g) => expanded.delete(g.key)); redraw(); } }, '전체 접기'));
      groups.forEach((g) => listBox.append(h('details', { class: 'act-group', open: expanded.has(g.key), ontoggle: (event) => {
        if (!event.currentTarget.isConnected) return;
        if (event.currentTarget.open) expanded.add(g.key); else expanded.delete(g.key);
      } }, h('summary', null, g.key, h('small', null, ` ${g.items.length}개`)),
      h('div', { class: 'act-grid' }, g.items.map((a) => card(a, redraw))))));
    };

    const sel = (key, opts) => h('select', { onchange: (e) => { filters[key] = e.target.value; redraw(); } },
      opts.map(([v, l]) => h('option', { value: v, selected: filters[key] === v }, l)));

    function openColors() {
      const saved = colorRules();
      const draft = { mode: saved.mode || 'type', type: { ...saved.type }, family: { ...saved.family }, subject: { ...saved.subject } };
      const mode = h('select', { 'aria-label': '테두리 색 기준' }, [['type', '활동 종류별'], ['family', '교과군별'], ['subject', '과목별']].map(([value, label]) => h('option', { value, selected: value === draft.mode }, label)));
      const rows = h('div', { class: 'act-color-rows' });
      const draw = () => {
        draft.mode = mode.value;
        const names = mode.value === 'type' ? Object.keys(TYPES) : mode.value === 'family' ? [...Curriculum2022.families, '기타'] : [...new Set([...Store.get('subjectCatalog', []), ...load().map((a) => a.subject).filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'ko'));
        rows.replaceChildren(...names.map((key) => {
          const label = mode.value === 'type' ? TYPES[key].label : key;
          const fallback = mode.value === 'type' ? TYPES[key].color : mode.value === 'subject' ? colorFor(key) : '#9aa8bb';
          const color = h('input', { type: 'color', value: draft[mode.value][key] || fallback, 'aria-label': `${label} 테두리 색`, onchange: (event) => { draft[mode.value][key] = event.target.value; } });
          return h('label', { class: 'act-color-row' }, label, color);
        }));
      };
      mode.addEventListener('change', draw); draw();
      const dialog = App.modal({ title: '활동 테두리 색', body: [App.field('색상 기준', mode), rows], footer: [h('button', { class: 'btn primary', type: 'button', onclick: () => { Store.set('activityColorRules', draft); dialog.close(); redraw(); } }, '저장')] });
    }
    const tabs = h('div', { class: 'seg act-view-tabs' }, [['activities', '활동'], ['attendance', '출결'], ['awards', '수상'], ['source', '생기부 원문·기타']].map(([key, label]) => h('button', { class: 'seg-btn' + (filters.view === key ? ' on' : ''), type: 'button', onclick: () => {
      filters.view = key; tabs.querySelectorAll('button').forEach((button) => button.classList.toggle('on', button.textContent === label)); redraw();
    } }, label)));
    filterBox.append(
      h('input', { type: 'search', placeholder: '활동명·내용 검색', value: filters.q, oninput: (e) => { filters.q = e.target.value; redraw(); } }),
      sel('type', [['', '모든 종류'], ...Object.entries(TYPES).map(([k, v]) => [k, v.label])]),
      sel('grade', [['', '모든 학년'], ['1', '1학년'], ['2', '2학년'], ['3', '3학년']]),
      sel('sem', [['', '모든 학기'], ['1', '1학기'], ['2', '2학기']]),
      sel('cv', [['', '생기부 전체'], ['done', '기재됨'], ['todo', '미기재']]),
      sel('group', [['curriculum', '학년·교과군·과목별'], ['sem', '학기별'], ['subject', '과목별'], ['type', '종류별'], ['none', '전체 목록']]),
      sel('order', [['desc', '최신순'], ['asc', '오래된순']]));

    root.append(h('section', { class: 'panel' },
      h('div', { class: 'title-row' },
        h('h1', { class: 'page-title' }, '활동 관리'),
        h('div', { class: 'set-btns' }, h('button', { class: 'btn ghost', type: 'button', onclick: openColors }, '테두리 색'), addButton)),
      tabs,
      stat,
      filterBox,
      groupActions,
      listBox));
    redraw();
  }

  const stats = () => { const all = load().filter((a) => viewFor(a) === 'activities'); return { total: all.length, todo: all.filter((a) => !a.cvDone && !a.sourceSchoolImport).length }; };
  return { render, stats };
})();

App.registerView('activities', { label: '활동 관리', icon: 'activities', render: Activities.render });
