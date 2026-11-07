// 홈 화면과 앱 시작
const Home = (() => {
  let selectedDate = new Date();
  let clockTimer, sideObserver;
  const CARDS = [
    { to: 'wrong', cls: 'blue', icon: 'wrong', title: '오답노트', desc: 'pdf파일을 잘라내고 오답정리를 해요.' },
    { to: 'timetable', cls: 'green', icon: 'timetable', title: '시간표', desc: '나의 시간표를 입력하고 관리해요.' },
    { to: 'calendar', cls: 'orange', icon: 'calendar', title: '일정 관리', desc: '날짜 별로 자신의 학업 일정을 관리해요.' },
    { to: 'activities', cls: 'purple', icon: 'activities', title: '활동 관리', desc: '현재까지의 학업 활동을 관리해요.' },
    { to: 'grades', cls: 'pink', icon: 'grades', title: '성적 관리', desc: '시험 점수를 기록하고 추이를 봐요.' },
    { to: 'meals', cls: 'teal', icon: 'meals', title: '급식', desc: '우리 학교 급식을 날짜별로 봐요.' },
    { to: 'notes', cls: 'amber', icon: 'notes', title: '메모', desc: '필요한 내용을 자유롭게 적어 둬요.' },
    { to: 'timer', cls: 'slate', icon: 'timer', title: '타이머', desc: '공부 시간을 재고 기록해요.' },
    { to: 'study', cls: 'indigo', icon: 'study', title: '필기 공간', desc: '과목과 단원별로 필기를 정리해요.' },
    { to: 'whiteboard', cls: 'coral', icon: 'whiteboard', title: '화이트보드', desc: '그리고 저장해요.' },
    { to: 'schoolmap', cls: 'mint', icon: 'schoolmap', title: '학교 지도', desc: '층별 장소와 마커를 확인해요.' },
    { to: 'subjects', cls: 'orchid', icon: 'subjects', title: '과목 관리', desc: '과목 색과 기본 교실을 정해요.' },
  ];

  function render(root) {
    clearInterval(clockTimer);
    sideObserver?.disconnect();
    const now = new Date();
    const st = Settings.protectedTab('activities') ? null : Activities.stats();
    const nextExam = Settings.protectedTab('calendar') ? null : Calendar.nextExam();
    let sideMode = Store.get('homeSideMode', 'list');

    const order = Settings.get().tabOrder || Settings.get().homeCardOrder || [];
    const enabled = Settings.get().enabledTabs;
    const sortedCards = CARDS.filter((c) => !Array.isArray(enabled) || enabled.includes(c.to)).sort((a, b) => (order.indexOf(a.to) < 0 ? 999 : order.indexOf(a.to)) - (order.indexOf(b.to) < 0 ? 999 : order.indexOf(b.to)));
    const cards = h('div', { class: 'home-cards' }, sortedCards.map((c) => h(c.to ? 'a' : 'button', c.to ? { class: 'home-card ' + c.cls, href: '#' + c.to } : { class: 'home-card ' + c.cls, type: 'button', onclick: App.openSettings },
      h('span', { class: 'hc-ico' }, icon(c.icon)),
      h('span', { class: 'hc-text' }, h('b', null, c.title), h('small', null, c.desc)),
      h('span', { class: 'hc-go', 'aria-hidden': 'true' }, '→'))));

    // 상자 크기는 고정하고, 내용이 많아지면 안에서 스크롤한다
    const todayBox = h('div', { class: 'side-box' },
      h('button', { type: 'button', class: 'bm r', title: '오늘 일정 목록', 'aria-label': '오늘 일정 목록으로 보기', onclick: () => selectSide('list') }),
      h('button', { type: 'button', class: 'bm b', title: '오늘 일정 원 그래프', 'aria-label': '오늘 일정 원 그래프로 보기', onclick: () => selectSide('pie') }),
      h('div', { class: 'side-date-nav' },
        h('button', { class: 'btn ghost', type: 'button', 'aria-label': '이전 날짜', onclick: () => changeDate(-1) }, '◀'),
        h('h3', null),
        h('button', { class: 'btn ghost', type: 'button', 'aria-label': '다음 날짜', onclick: () => changeDate(1) }, '▶'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => { selectedDate = new Date(); drawSide(); } }, '오늘')),
      h('div', { class: 'side-scroll' }),
      st?.total ? h('p', { class: 'note' }, `생기부 미기록 활동 ${st.todo}개`) : null);

    const sideScroll = todayBox.querySelector('.side-scroll');
    function changeDate(n) { selectedDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + n); drawSide(); }
    function openDayNotes(ds) {
      const body = h('div', { class: 'nt-completed home-note-modal' });
      const refreshNotes = () => {
        const notes = Notes.forDate(ds);
        body.replaceChildren(...(notes.length
          ? notes.map((n) => h('button', { class: 'btn ghost', style: { '--c': n.color || '#fff4b8' }, type: 'button', onclick: () => Notes.show(n, () => { refreshNotes(); drawSide(); }) }, n.title || n.body))
          : [h('p', { class: 'muted' }, '이 날의 메모가 없어요.')]));
      };
      refreshNotes();
      App.modal({ title: `${ds} 메모`, body });
    }
    function drawSide() {
      const ds = dateStr(selectedDate), lessons = Settings.protectedTab('timetable') ? [] : Timetable.lessonsFor(selectedDate), dayEvents = Calendar.byDate(ds).filter((e) => !e.schoolLesson && !e.sourceBreak);
      todayBox.querySelector('h3').replaceChildren(
        h('span', { class: 'date-long' }, `${ds === todayStr() ? '오늘 ' : ''}${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일 (${WEEK[selectedDate.getDay()]})`),
        h('span', { class: 'date-short' }, `${selectedDate.getMonth() + 1}/${selectedDate.getDate()} (${WEEK[selectedDate.getDay()]})`));
      if (sideMode === 'pie') return sideScroll.replaceChildren(
        h('div', { class: 'home-pie-view' },
          h('div', { class: 'home-pie-full' }, Calendar.homePie(selectedDate)),
          h('div', { class: 'home-pie-half' }, Calendar.homeSemi(selectedDate))),
        h('div', { class: 'home-pie-actions' },
          Settings.protectedTab('notes') ? null : h('button', { class: 'btn ghost', type: 'button', onclick: () => openDayNotes(ds) }, '메모 보기'),
          h('button', { class: 'btn ghost', type: 'button', onclick: () => App.modal({ title: `${ds} 전체 일정`, body: h('div', { class: 'home-pie-large' }, Calendar.homePie(selectedDate)), wide: true }) }, '전체 보기')));
      sideScroll.replaceChildren(...[
        Settings.protectedTab('timetable') ? null : lessons.length ? h('div', { class: 'chips side-lessons' }, lessons.map((l) => h('button', { class: 'chip', type: 'button', style: { '--c': colorFor(l.subject) }, title: l.teacher, onclick: () => Calendar.showEvent(l, drawSide) }, `${l.period} ${l.displayTitle}`)))
          : h('p', { class: 'muted' }, '입력된 수업이 없어요.'),
        !Settings.protectedTab('notes') && Notes.forDate(ds).length ? h('button', { class: 'home-day-notes-open btn ghost', type: 'button', onclick: () => openDayNotes(ds) }, `이 날의 메모 ${Notes.forDate(ds).length}개 보기`) : null,
        Settings.protectedTab('calendar') ? null : dayEvents.length ? h('ul', { class: 'mini-list' }, dayEvents.map((e) => h('li', { style: { '--c': e.color } },
          e.checkable !== false ? h('button', { type: 'button', class: 'ck sm' + (e.done ? ' on' : ''), role: 'checkbox', 'aria-checked': String(!!e.done), 'aria-label': `${e.title} 완료 표시`, title: e.done ? '완료 취소' : '완료로 표시', onclick: () => { Calendar.setDone(e.id, e.date, !e.done); drawSide(); } }) : null,
          h('button', { class: 'home-event-open', type: 'button', onclick: () => Calendar.showEvent(e, drawSide) }, h('span', null, `${e.start}~${e.end}`), h('b', null, e.title)))))
          : h('p', { class: 'muted' }, '등록된 일정이 없어요.')].filter(Boolean));
    }
    function selectSide(next) {
      sideMode = next; Store.set('homeSideMode', next);
      todayBox.classList.toggle('show-pie', next === 'pie');
      todayBox.querySelector('.bm.r').setAttribute('aria-pressed', String(next === 'list'));
      todayBox.querySelector('.bm.b').setAttribute('aria-pressed', String(next === 'pie'));
      drawSide();
    }
    selectSide(sideMode);

    // 마우스를 올리거나 누르면 책이 차례로 통통 튄다
    const logo = h('div', { class: 'home-logo' },
      icon('books', 'logo-books'),
      h('div', { class: 'logo-name', 'aria-label': 'ClassHub' },
        [...'Class'].map((letter, i) => h('span', { style: { '--i': i }, 'aria-hidden': 'true' }, letter)),
        [...'Hub'].map((letter, i) => h('b', { style: { '--i': i + 5 }, 'aria-hidden': 'true' }, letter))));
    const bounce = () => { logo.classList.remove('go'); void logo.offsetWidth; logo.classList.add('go'); };
    logo.addEventListener('mouseenter', bounce);
    logo.addEventListener('pointerdown', bounce);
    logo.addEventListener('focus', bounce);

    root.append(h('button', { class: 'home-settings-btn btn', type: 'button', onclick: App.openSettings, 'aria-label': '설정 열기', title: '설정' }, icon('settings')));
    root.append(h('div', { class: 'home' },
      cards,
      h('aside', { class: 'home-side' },
        nextExam ? h('button', { class: 'home-exam-banner', type: 'button', onclick: () => Calendar.manageExams(() => App.refresh()) },
          h('b', null, nextExam.title),
          h('span', null, nextExam.start <= todayStr() ? '시험기간 진행 중' : `D-${Math.round((parseDate(nextExam.start) - parseDate(todayStr())) / 86400000)}`),
          h('small', null, `${nextExam.start} ~ ${nextExam.end}`)) : null,
        h('div', { class: 'home-topline' },
          !Settings.protectedTab('timetable') ? h('div', { class: 'home-schedule-preview' },
            h('h3', null, '오늘 시간표'),
            Timetable.lessonsFor(now).length ? h('div', { class: 'home-schedule-list' }, Timetable.lessonsFor(now).map((lesson) => h('button', { type: 'button', class: 'home-schedule-lesson', style: { '--c': colorFor(lesson.subject) }, onclick: () => Calendar.showEvent(lesson, () => App.refresh()) }, `${lesson.period}. ${lesson.displayTitle}`)))
              : h('p', { class: 'muted' }, '오늘 등록된 수업이 없어요.')) : null, logo),
        Settings.protectedTab('calendar') ? null : todayBox)));
    sideObserver = new ResizeObserver(() => {
      if (todayBox.isConnected && matchMedia('(min-width: 1001px)').matches) cards.style.height = `${Math.max(200, todayBox.getBoundingClientRect().bottom - cards.getBoundingClientRect().top)}px`;
      else cards.style.height = '';
      const width = todayBox.clientWidth, height = todayBox.clientHeight;
      const wide = todayBox.classList.contains('wide-pie');
      // 카드 자체의 크기를 사용한다. 그래프 모양이 바뀌어도 기준 크기는 흔들리지 않는다.
      const ratio = width / Math.max(1, height);
      const diameter = Math.min(width - 32, height - 140);
      const next = diameter < (wide ? 290 : 260) || height < 350 && ratio > (wide ? 1.55 : 1.75);
      if (next !== wide) todayBox.classList.toggle('wide-pie', next);
    });
    sideObserver.observe(todayBox);
    clockTimer = setInterval(() => {
      if (!root.isConnected) { clearInterval(clockTimer); sideObserver?.disconnect(); return; }
      if (sideMode === 'pie' && dateStr(selectedDate) === todayStr()) drawSide();
    }, 60000);
  }
  return { render };
})();

App.registerView('home', { label: '홈', icon: 'home', render: Home.render });

(async function start() {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost'))
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  await Store.init();
  await Cloud.init();
  Settings.apply();
  if (!Cloud.configured) Timer.init();
  window.addEventListener('hashchange', App.route);
  if (Cloud.ready) App.route();
})();
