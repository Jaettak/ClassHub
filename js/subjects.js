const Subjects = (() => {
  const catalog = () => Store.get('subjectCatalog', []);
  const names = () => {
    const all = new Set(catalog());
    (Store.get('timetable', {})?.cells || []).forEach((day) => day.forEach((cell) => { if (cell?.subject) all.add(cell.subject); }));
    Store.get('grades', []).forEach((row) => { if (row.subject) all.add(row.subject); });
    Store.get('captures', []).forEach((row) => { if (row.subject) all.add(row.subject); });
    const hidden = new Set(Store.get('hiddenSubjects', []));
    return [...all].filter((name) => !hidden.has(name)).sort((a, b) => a.localeCompare(b, 'ko'));
  };
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
    const draw = () => list.replaceChildren(...names().map((name) => {
      const color = h('input', { type: 'color', value: colorFor(name), 'aria-label': `${name} 색상` });
      const teacherButton = h('button', { class: 'btn teacher-manage', type: 'button', onclick: () => manageOptions(name, teacherButton, 'teacher') },
        `선생님 관리 (${(Store.get('subjectTeachers', {})[name] || []).length})`);
      const roomOptions = [...new Set([...(Store.get('subjectRoomOptions', {})[name] || []), ...(Store.get('subjectRooms', {})[name] ? [Store.get('subjectRooms', {})[name]] : [])])];
      const roomButton = h('button', { class: 'btn teacher-manage', type: 'button', onclick: () => manageOptions(name, roomButton, 'room') }, `교실 관리 (${roomOptions.length})`);
      const automatic = h('input', { type: 'checkbox', checked: !Object.hasOwn(Store.get('subjectColors', {}), name) });
      const save = () => {
        const colors = Store.get('subjectColors', {});
        if (automatic.checked) delete colors[name]; else colors[name] = color.value;
        Store.set('subjectColors', colors);
        Store.set('subjectCatalog', [...new Set([...catalog(), name])].sort());
        App.toast('과목 설정을 저장했어요.');
      };
      return h('div', { class: 'subject-row panel' }, h('strong', null, name), color,
        h('label', { class: 'check' }, automatic, '자동 색상'), teacherButton, roomButton,
        h('button', { class: 'btn', type: 'button', onclick: save }, '저장'),
        h('button', { class: 'btn danger', type: 'button', onclick: () => {
          if (!confirm(`${name} 과목을 현재 시간표에서 지울까요? 이미 기록된 수업·성적은 유지돼요.`)) return;
          const tt = Store.get('timetable', null);
          if (tt?.cells) { tt.cells.forEach((day) => day.forEach((cell, i) => { if (cell?.subject === name) day[i] = null; })); Store.set('timetable', tt); }
          Store.set('subjectCatalog', catalog().filter((value) => value !== name));
          Store.set('hiddenSubjects', [...new Set([...Store.get('hiddenSubjects', []), name])]);
          const colors = Store.get('subjectColors', {}), rooms = Store.get('subjectRooms', {}), teachers = Store.get('subjectTeachers', {}), roomOptions = Store.get('subjectRoomOptions', {}); delete colors[name]; delete rooms[name]; delete teachers[name]; delete roomOptions[name];
          Store.set('subjectColors', colors); Store.set('subjectRooms', rooms); Store.set('subjectTeachers', teachers); Store.set('subjectRoomOptions', roomOptions); draw();
        } }, '과목 삭제'));
    }));
    const input = h('input', { type: 'text', placeholder: '새 과목 이름', maxLength: 50 });
    root.append(h('section', { class: 'panel' }, h('h1', { class: 'page-title' }, '과목 관리'),
      h('div', { class: 'set-row' }, input, h('button', { class: 'btn primary', type: 'button', onclick: () => {
        const name = input.value.trim(); if (!name) return App.toast('과목 이름을 입력해 주세요.');
        Store.set('subjectCatalog', [...new Set([...catalog(), name])].sort());
        Store.set('hiddenSubjects', Store.get('hiddenSubjects', []).filter((value) => value !== name)); input.value = ''; draw();
      } }, '과목 추가')),
      h('p', { class: 'hint' }, '색상과 과목별 선생님·교실을 관리해요. 시간표에서는 저장한 이름을 선택할 수 있어요. 과목을 삭제해도 과거 기록은 유지합니다.'), list));
    draw();
  }
  return { render };
})();
App.registerView('subjects', { label: '과목 관리', icon: 'subjects', render: Subjects.render });
