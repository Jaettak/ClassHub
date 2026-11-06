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
  function manageTeachers(subject, button) {
    const list = h('div', { class: 'teacher-list' });
    const input = h('input', { type: 'text', placeholder: '선생님 이름', maxLength: 50, 'aria-label': '추가할 선생님 이름' });
    const teachers = () => Store.get('subjectTeachers', {})[subject] || [];
    const save = (values) => {
      Store.set('subjectTeachers', { ...Store.get('subjectTeachers', {}), [subject]: values });
      button.textContent = `선생님 관리 (${values.length})`;
      draw();
    };
    const draw = () => list.replaceChildren(...(teachers().length ? teachers().map((name) => h('div', { class: 'teacher-item' },
      h('span', null, name), h('button', { class: 'btn danger', type: 'button', 'aria-label': `${name} 삭제`, onclick: () => save(teachers().filter((value) => value !== name)) }, '삭제')))
      : [h('p', { class: 'muted' }, '등록한 선생님이 없어요.') ]));
    const add = () => {
      const name = input.value.trim();
      if (!name) return App.toast('선생님 이름을 입력해 주세요.');
      if (teachers().includes(name)) return App.toast('이미 등록한 선생님이에요.');
      save([...teachers(), name]); input.value = ''; input.focus();
    };
    input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); add(); } });
    App.modal({ title: `${subject} 선생님 관리`, body: [list, h('div', { class: 'teacher-add' }, input,
      h('button', { class: 'btn primary', type: 'button', onclick: add }, '추가'))] });
    draw();
  }
  function render(root) {
    const list = h('div', { class: 'subject-list' });
    const draw = () => list.replaceChildren(...names().map((name) => {
      const color = h('input', { type: 'color', value: colorFor(name), 'aria-label': `${name} 색상` });
      const room = h('input', { type: 'text', value: Store.get('subjectRooms', {})[name] || '', placeholder: '기본 교실', 'aria-label': `${name} 기본 교실` });
      const teacherButton = h('button', { class: 'btn teacher-manage', type: 'button', onclick: () => manageTeachers(name, teacherButton) },
        `선생님 관리 (${(Store.get('subjectTeachers', {})[name] || []).length})`);
      const automatic = h('input', { type: 'checkbox', checked: !Object.hasOwn(Store.get('subjectColors', {}), name) });
      const save = () => {
        const colors = Store.get('subjectColors', {}), rooms = Store.get('subjectRooms', {});
        if (automatic.checked) delete colors[name]; else colors[name] = color.value;
        rooms[name] = room.value.trim();
        Store.set('subjectColors', colors); Store.set('subjectRooms', rooms);
        Store.set('subjectCatalog', [...new Set([...catalog(), name])].sort());
        App.toast('과목 설정을 저장했어요.');
      };
      return h('div', { class: 'subject-row panel' }, h('strong', null, name), color,
        h('label', { class: 'check' }, automatic, '자동 색상'), room, teacherButton,
        h('button', { class: 'btn', type: 'button', onclick: save }, '저장'),
        h('button', { class: 'btn danger', type: 'button', onclick: () => {
          if (!confirm(`${name} 과목을 현재 시간표에서 지울까요? 이미 기록된 수업·성적은 유지돼요.`)) return;
          const tt = Store.get('timetable', null);
          if (tt?.cells) { tt.cells.forEach((day) => day.forEach((cell, i) => { if (cell?.subject === name) day[i] = null; })); Store.set('timetable', tt); }
          Store.set('subjectCatalog', catalog().filter((value) => value !== name));
          Store.set('hiddenSubjects', [...new Set([...Store.get('hiddenSubjects', []), name])]);
          const colors = Store.get('subjectColors', {}), rooms = Store.get('subjectRooms', {}), teachers = Store.get('subjectTeachers', {}); delete colors[name]; delete rooms[name]; delete teachers[name];
          Store.set('subjectColors', colors); Store.set('subjectRooms', rooms); Store.set('subjectTeachers', teachers); draw();
        } }, '과목 삭제'));
    }));
    const input = h('input', { type: 'text', placeholder: '새 과목 이름', maxLength: 50 });
    root.append(h('section', { class: 'panel' }, h('h1', { class: 'page-title' }, '과목 관리'),
      h('div', { class: 'set-row' }, input, h('button', { class: 'btn primary', type: 'button', onclick: () => {
        const name = input.value.trim(); if (!name) return App.toast('과목 이름을 입력해 주세요.');
        Store.set('subjectCatalog', [...new Set([...catalog(), name])].sort());
        Store.set('hiddenSubjects', Store.get('hiddenSubjects', []).filter((value) => value !== name)); input.value = ''; draw();
      } }, '과목 추가')),
      h('p', { class: 'hint' }, '색상·기본 교실·선생님을 관리해요. 선생님은 과목별 관리 창에서 한 명씩 추가하거나 삭제할 수 있어요. 과목을 삭제해도 과거 기록은 유지합니다.'), list));
    draw();
  }
  return { render };
})();
App.registerView('subjects', { label: '과목 관리', icon: 'subjects', render: Subjects.render });
