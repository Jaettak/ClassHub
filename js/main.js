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
  ];

  function render(root) {
    clearInterval(clockTimer);
    sideObserver?.disconnect();
    const now = new Date();
    const st = Activities.stats();
    let sideMode = Store.get('homeSideMode', 'list');

    const cards = h('div', { class: 'home-cards' }, CARDS.map((c) => h(c.to ? 'a' : 'button', c.to ? { class: 'home-card ' + c.cls, href: '#' + c.to } : { class: 'home-card ' + c.cls, type: 'button', onclick: App.openSettings },
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
      st.total ? h('p', { class: 'note' }, `생기부 미기록 활동 ${st.todo}개`) : null);

    const sideScroll = todayBox.querySelector('.side-scroll');
    function changeDate(n) { selectedDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + n); drawSide(); }
    function drawSide() {
      const ds = dateStr(selectedDate), lessons = Timetable.lessonsFor(selectedDate), dayEvents = Calendar.byDate(ds).filter((e) => !e.schoolLesson);
      todayBox.querySelector('h3').replaceChildren(
        h('span', { class: 'date-long' }, `${ds === todayStr() ? '오늘 ' : ''}${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일 (${WEEK[selectedDate.getDay()]})`),
        h('span', { class: 'date-short' }, `${selectedDate.getMonth() + 1}/${selectedDate.getDate()} (${WEEK[selectedDate.getDay()]})`));
      if (sideMode === 'pie') return sideScroll.replaceChildren(
        h('div', { class: 'home-pie-actions' },
          h('button', { class: 'btn ghost', type: 'button', onclick: () => App.modal({ title: `${ds} 메모`, body: Notes.forDate(ds).length
            ? h('div', { class: 'nt-completed' }, Notes.forDate(ds).map((n) => h('button', { class: 'btn ghost', type: 'button', onclick: () => Notes.show(n, drawSide) }, n.title || n.body)))
            : h('p', { class: 'muted' }, '이 날의 메모가 없어요.') }) }, '메모 보기'),
          h('button', { class: 'btn ghost', type: 'button', onclick: () => App.modal({ title: `${ds} 전체 일정`, body: h('div', { class: 'home-pie-large' }, Calendar.homePie(selectedDate)), wide: true }) }, '전체 보기')),
        h('div', { class: 'home-pie-view' },
          h('div', { class: 'home-pie-full' }, Calendar.homePie(selectedDate)),
          h('div', { class: 'home-pie-half' }, Calendar.homeSemi(selectedDate))));
      sideScroll.replaceChildren(...[
        lessons.length ? h('div', { class: 'chips side-lessons' }, lessons.map((l) => h('button', { class: 'chip', type: 'button', style: { '--c': colorFor(l.subject) }, title: l.teacher, onclick: () => Calendar.showEvent(l, drawSide) }, `${l.period} ${l.displayTitle}`)))
          : h('p', { class: 'muted' }, '입력된 수업이 없어요.'),
        dayEvents.length ? h('ul', { class: 'mini-list' }, dayEvents.map((e) => h('li', { style: { '--c': e.color } },
          e.checkable !== false ? h('button', { type: 'button', class: 'ck sm' + (e.done ? ' on' : ''), role: 'checkbox', 'aria-checked': String(!!e.done), 'aria-label': `${e.title} 완료 표시`, title: e.done ? '완료 취소' : '완료로 표시', onclick: () => { Calendar.setDone(e.id, e.date, !e.done); drawSide(); } }) : null,
          h('button', { class: 'home-event-open', type: 'button', onclick: () => Calendar.showEvent(e, drawSide) }, h('span', null, `${e.start}~${e.end}`), h('b', null, e.title)))))
          : h('p', { class: 'muted' }, '등록된 일정이 없어요.'),
        Notes.forDate(ds).length ? h('div', { class: 'home-day-notes' }, h('b', null, '이 날의 메모'), Notes.forDate(ds).map((n) => h('button', { type: 'button', onclick: () => Notes.show(n, drawSide) }, n.title || n.body))) : null].filter(Boolean));
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

    root.append(h('button', { class: 'home-settings-btn btn', type: 'button', onclick: App.openSettings, 'aria-label': '설정 열기' }, icon('settings'), '설정'));
    root.append(h('div', { class: 'home' },
      cards,
      h('aside', { class: 'home-side' },
        h('div', { class: 'home-topline' },
          h('div', { class: 'home-schedule-preview' },
            h('h3', null, '오늘 시간표'),
            Timetable.lessonsFor(now).length ? h('div', { class: 'home-schedule-list' }, Timetable.lessonsFor(now).map((lesson) => h('button', { type: 'button', class: 'home-schedule-lesson', style: { '--c': colorFor(lesson.subject) }, onclick: () => Calendar.showEvent(lesson, () => App.refresh()) }, `${lesson.period}교시 · ${lesson.displayTitle}`)))
              : h('p', { class: 'muted' }, '오늘 등록된 수업이 없어요.')), logo),
        todayBox)));
    sideObserver = new ResizeObserver(() => {
      const area = todayBox.querySelector('.home-pie-view');
      if (area) todayBox.classList.toggle('wide-pie', area.clientWidth > area.clientHeight * 1.55 && area.clientHeight < 350);
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
