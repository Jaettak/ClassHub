const Subjects = (() => {
  const catalog = () => Store.get('subjectCatalog', []);
  const names = () => {
    const all = new Set(catalog());
    (Store.get('timetable', {})?.cells || []).forEach((day) => day.forEach((cell) => { if (cell?.subject) all.add(cell.subject); }));
    Store.get('grades', []).forEach((row) => { if (row.subject) all.add(row.subject); });
    Store.get('schoolReportExtras', []).forEach((row) => { if (row.subject || row.sourceDetails?.subject) all.add(row.subject || row.sourceDetails.subject); });
    Store.get('captures', []).forEach((row) => { if (row.subject) all.add(row.subject); });
    const hidden = new Set(Store.get('hiddenSubjects', []));
    return [...all].filter((name) => !hidden.has(name)).sort((a, b) => a.localeCompare(b, 'ko'));
  };
  const timetableNames = () => new Set((Store.get('timetable', {})?.cells || [])
    .flatMap((day) => day || []).map((cell) => cell?.subject).filter(Boolean));
  const allNames = () => [...new Set([...Curriculum2022.list.map((row) => row.name), ...catalog(), ...names(), ...Store.get('hiddenSubjects', [])])].filter(Boolean).sort((a, b) => a.localeCompare(b, 'ko'));
  function choose(current, onPick) {
    const timetable = timetableNames();
    const list = h('div', { class: 'subject-choice-groups' });
    const search = h('input', { type: 'search', placeholder: '과목 검색', 'aria-label': '선택할 과목 검색' });
    const group = (label, values) => h('section', null, h('h4', null, label), h('div', { class: 'subject-choice-list' },
      values.length ? values.map((name) => h('button', { class: 'btn ghost' + (name === current ? ' on' : ''), type: 'button', onclick: () => { onPick(name); dialog.close(); } }, name))
        : h('p', { class: 'muted' }, '표시할 과목이 없어요. 과목 관리에서 골라 주세요.')));
    const visible = names();
    const draw = () => {
      const filtered = visible.filter((name) => name.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase()));
      list.replaceChildren(group('시간표 과목', filtered.filter((name) => timetable.has(name))), group('표시한 과목', filtered));
    };
    search.addEventListener('input', draw);
    draw();
    const dialog = App.modal({ title: '과목 선택', body: [search, list] });
  }
  function manageOptions(subject, button, type) {
    const isRoom = type === 'room';
    const key = isRoom ? 'subjectRoomOptions' : 'subjectTeachers';
    const label = isRoom ? '교실' : '선생님';
    const list = h('div', { class: 'teacher-list' });
    const input = h('input', { type: 'text', placeholder: isRoom ? '교실 이름' : '선생님 이름', maxLength: 50, 'aria-label': `추가할 ${label} 이름` });
    const values = () => [...new Set([...(Store.get(key, {})[subject] || []), ...(isRoom && Store.get('subjectRooms', {})[subject] ? [Store.get('subjectRooms', {})[subject]] : [])])];
    const save = (values) => {
      Store.set(key, { ...Store.get(key, {}), [subject]: values });
      if (isRoom) Store.set('subjectRooms', { ...Store.get('subjectRooms', {}), [subject]: values[0] || '' });
      button.textContent = `${label} 관리 (${values.length})`;
      draw();
    };
    const draw = () => list.replaceChildren(...(values().length ? values().map((name, index) => h('div', { class: 'teacher-item' },
      h('span', null, name), index ? h('button', { class: 'btn ghost', type: 'button', onclick: () => save([name, ...values().filter((value) => value !== name)]) }, '기본으로') : h('small', { class: 'muted' }, '기본'),
      h('button', { class: 'btn danger', type: 'button', 'aria-label': `${name} 삭제`, onclick: () => save(values().filter((value) => value !== name)) }, '삭제')))
      : [h('p', { class: 'muted' }, `등록한 ${label}이 없어요.`) ]));
    const add = () => {
      const name = input.value.trim();
      if (!name) return App.toast(`${label} 이름을 입력해 주세요.`);
      if (values().includes(name)) return App.toast(`이미 등록한 ${label}이에요.`);
      save([...values(), name]); input.value = ''; input.focus();
    };
    input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); add(); } });
    App.modal({ title: `${subject} ${label} 관리`, body: [list, h('div', { class: 'teacher-add' }, input,
      h('button', { class: 'btn primary', type: 'button', onclick: add }, '추가'))] });
    draw();
  }
  function render(root) {
    const list = h('div', { class: 'subject-list' });
    const search = h('input', { type: 'search', placeholder: '과목 검색', 'aria-label': '과목 관리 검색', oninput: () => draw() });
    const sort = h('select', { 'aria-label': '과목 정렬', onchange: () => draw() },
      h('option', { value: 'name' }, '이름순'), h('option', { value: 'family' }, '교과군순'));
    const view = h('select', { 'aria-label': '과목 목록 보기' },
      h('option', { value: 'timetable' }, '시간표 과목만'),
      h('option', { value: 'all' }, '전체 과목'));
    const viewTabs = h('div', { class: 'seg subject-view-tabs', role: 'group', 'aria-label': '과목 목록 보기' });
    const viewButtons = ['timetable', 'all'].map((value) => h('button', { class: 'seg-btn', type: 'button',
      onclick: () => { view.value = value; draw(); } }));
    viewTabs.append(...viewButtons);
    const updateViewTabs = () => {
      const active = timetableNames();
      const total = names().length;
      viewTabs.dataset.mode = view.value;
      viewButtons[0].textContent = `시간표 과목 ${names().filter((name) => active.has(name)).length}개`;
      viewButtons[1].textContent = `전체 과목 ${total}개`;
      viewButtons.forEach((button, index) => button.setAttribute('aria-pressed', view.value === ['timetable', 'all'][index]));
    };
    const draw = () => {
      const active = timetableNames();
      const shown = (view.value === 'timetable' ? names().filter((name) => active.has(name)) : names())
        .filter((name) => name.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase()));
      if (sort.value === 'family') {
        const assigned = Store.get('subjectFamilies', {});
        const rank = (name) => {
          const family = assigned[name] || Curriculum2022.find(name)?.family || '기타';
          const index = Curriculum2022.families.indexOf(family);
          return index < 0 ? Curriculum2022.families.length : index;
        };
        shown.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'ko'));
      }
      updateViewTabs();
      list.replaceChildren(...(shown.length ? shown.map((name) => {
      const color = h('input', { type: 'color', value: colorFor(name), 'aria-label': `${name} 색상` });
      const teacherButton = h('button', { class: 'btn teacher-manage', type: 'button', onclick: () => manageOptions(name, teacherButton, 'teacher') },
        `선생님 관리 (${(Store.get('subjectTeachers', {})[name] || []).length})`);
      const roomOptions = [...new Set([...(Store.get('subjectRoomOptions', {})[name] || []), ...(Store.get('subjectRooms', {})[name] ? [Store.get('subjectRooms', {})[name]] : [])])];
      const roomButton = h('button', { class: 'btn teacher-manage', type: 'button', onclick: () => manageOptions(name, roomButton, 'room') }, `교실 관리 (${roomOptions.length})`);
      const family = h('select', { 'aria-label': `${name} 교과군` },
        h('option', { value: '' }, `자동: ${Curriculum2022.find(name)?.family || '기타'}`),
        Curriculum2022.families.map((value) => h('option', { value, selected: Store.get('subjectFamilies', {})[name] === value }, value)));
      const automatic = h('input', { type: 'checkbox', checked: !Object.hasOwn(Store.get('subjectColors', {}), name) });
      const save = () => {
        const colors = Store.get('subjectColors', {});
        if (automatic.checked) delete colors[name]; else colors[name] = color.value;
        Store.set('subjectColors', colors);
        const families = Store.get('subjectFamilies', {});
        if (family.value) families[name] = family.value; else delete families[name];
        Store.set('subjectFamilies', families);
        Store.set('subjectCatalog', [...new Set([...catalog(), name])].sort());
        App.toast('과목 설정을 저장했어요.');
      };
      return h('div', { class: 'subject-row panel' }, h('strong', null, name), family, color,
        h('label', { class: 'check' }, '자동 색상', automatic), teacherButton, roomButton,
        h('button', { class: 'btn', type: 'button', onclick: save }, '저장'),
        h('button', { class: 'btn danger', type: 'button', onclick: async () => {
          if (!await App.confirm(`${name} 과목을 현재 시간표에서 지울까요? 이미 기록된 수업·성적은 유지돼요.`)) return;
          const tt = Store.get('timetable', null);
          if (tt?.cells) { tt.cells.forEach((day) => day.forEach((cell, i) => { if (cell?.subject === name) day[i] = null; })); Store.set('timetable', tt); }
          Store.set('subjectCatalog', catalog().filter((value) => value !== name));
          Store.set('hiddenSubjects', [...new Set([...Store.get('hiddenSubjects', []), name])]);
          const colors = Store.get('subjectColors', {}), families = Store.get('subjectFamilies', {}), rooms = Store.get('subjectRooms', {}), teachers = Store.get('subjectTeachers', {}), roomOptions = Store.get('subjectRoomOptions', {}); delete colors[name]; delete families[name]; delete rooms[name]; delete teachers[name]; delete roomOptions[name];
          Store.set('subjectColors', colors); Store.set('subjectFamilies', families); Store.set('subjectRooms', rooms); Store.set('subjectTeachers', teachers); Store.set('subjectRoomOptions', roomOptions); draw();
        } }, '과목 삭제'));
      }) : [h('p', { class: 'muted' }, view.value === 'timetable'
        ? '현재 내 시간표에 배치된 과목이 없어요. 전체 과목에서 과목을 관리할 수 있어요.'
        : '등록된 과목이 없어요. 위에서 새 과목을 추가할 수 있어요.')]));
    };
    view.addEventListener('change', draw);
    const visibility = () => {
      const list = h('div', { class: 'subject-visibility-list' });
      const query = h('input', { type: 'search', placeholder: '표시할 과목 검색', 'aria-label': '표시할 과목 검색' });
      const order = h('select', { 'aria-label': '표시할 과목 정렬' },
        h('option', { value: 'name' }, '이름순'), h('option', { value: 'checked' }, '체크한 과목 먼저'));
      const drawVisibility = () => list.replaceChildren(...allNames()
        .filter((name) => name.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase()))
        .sort((a, b) => order.value === 'checked' ? Number(names().includes(b)) - Number(names().includes(a)) || a.localeCompare(b, 'ko') : a.localeCompare(b, 'ko'))
        .map((name) => h('label', { class: 'subject-visibility-row' },
        h('input', { type: 'checkbox', checked: names().includes(name), onchange: (event) => {
          const hidden = new Set(Store.get('hiddenSubjects', []));
          if (event.target.checked) { hidden.delete(name); Store.set('subjectCatalog', [...new Set([...catalog(), name])]); }
          else hidden.add(name);
          Store.set('hiddenSubjects', [...hidden]); draw(); drawVisibility();
        } }), name)));
      query.addEventListener('input', drawVisibility);
      order.addEventListener('change', drawVisibility);
      drawVisibility();
      const setAll = (show) => {
        const all = allNames();
        Store.set('subjectCatalog', [...new Set([...catalog(), ...all])]);
        Store.set('hiddenSubjects', show ? [] : all);
        drawVisibility(); draw();
      };
      App.modal({ title: '표시할 과목', body: [h('p', { class: 'hint' }, '과목 선택창에 보일 과목을 고르세요.'),
        h('div', { class: 'subject-visibility-controls' }, query, order),
        h('div', { class: 'set-row set-btns' }, h('button', { class: 'btn', type: 'button', onclick: () => setAll(true) }, '전체 선택'),
          h('button', { class: 'btn ghost', type: 'button', onclick: () => setAll(false) }, '전체 해제')), list] });
    };
    const addSubject = () => {
      const input = h('input', { type: 'text', placeholder: '새 과목 이름', maxLength: 50 });
      const add = (name) => {
        name = name.trim(); if (!name) return App.toast('과목 이름을 입력해 주세요.');
        Store.set('subjectCatalog', [...new Set([...catalog(), name])].sort((a, b) => a.localeCompare(b, 'ko')));
        Store.set('hiddenSubjects', Store.get('hiddenSubjects', []).filter((value) => value !== name));
        view.value = 'all'; search.value = ''; draw(); dialog.close();
      };
      const dialog = App.modal({ title: '과목 추가', body: [App.field('새 과목 이름', input),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => Curriculum2022.pick((row) => add(row.name)) }, '공식 과목에서 선택')],
        footer: [h('button', { class: 'btn primary', type: 'button', onclick: () => add(input.value) }, '추가')] });
      input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); add(input.value); } });
    };
    root.append(h('section', { class: 'panel' }, h('h1', { class: 'page-title' }, '과목 관리'),
      h('div', { class: 'subject-add-row' }, search, h('button', { class: 'btn primary', type: 'button', onclick: addSubject }, '과목 추가')),
      h('div', { class: 'subject-view-row' }, h('strong', null, '과목 목록'), viewTabs, sort,
        h('button', { class: 'btn ghost', type: 'button', onclick: visibility }, '표시할 과목')),
      h('p', { class: 'hint' }, '색상과 과목별 선생님·교실을 관리해요. 시간표에서는 저장한 이름을 선택할 수 있어요. 과목을 삭제해도 과거 기록은 유지합니다.'), list));
    draw();
  }
  return { render, names, timetableNames, choose };
})();
App.registerView('subjects', { label: '과목 관리', icon: 'subjects', render: Subjects.render });
