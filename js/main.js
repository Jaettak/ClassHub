// 홈 화면과 앱 시작
const Home = (() => {
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
    const now = new Date();
    const today = todayStr();
    const lessons = Timetable.lessonsFor(now);
    const todayEvents = Calendar.byDate(today).filter((e) => !e.schoolLesson);
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
      h('h3', null, `오늘 ${now.getMonth() + 1}월 ${now.getDate()}일 (${WEEK[now.getDay()]})`),
      h('div', { class: 'side-scroll' },
        lessons.length
          ? h('div', { class: 'chips' }, lessons.map((l) => h('span', { class: 'chip', style: { '--c': colorFor(l.subject) }, title: l.teacher }, `${l.period} ${l.subject}`)))
          : h('p', { class: 'muted' }, '오늘 입력된 수업이 없어요.'),
        todayEvents.length
          ? h('ul', { class: 'mini-list' }, todayEvents.map((e) => h('li', { style: { '--c': e.color } },
            h('button', { type: 'button', class: 'ck sm' + (e.done ? ' on' : ''), role: 'checkbox', 'aria-checked': String(!!e.done), 'aria-label': `${e.title} 완료 표시`, title: e.done ? '완료 취소' : '완료로 표시',
              onclick: () => { Calendar.setDone(e.id, e.date, !e.done); App.refresh(); } }),
            h('span', null, `${e.start}~${e.end}`), h('b', null, e.title))))
          : h('p', { class: 'muted' }, '오늘 등록된 일정이 없어요.')),
      st.total ? h('p', { class: 'note' }, `생기부 미기록 활동 ${st.todo}개`) : null);

    const sideScroll = todayBox.querySelector('.side-scroll');
    const listContents = Array.from(sideScroll.childNodes);
    function selectSide(next) {
      sideMode = next; Store.set('homeSideMode', next);
      todayBox.classList.toggle('show-pie', next === 'pie');
      todayBox.querySelector('.bm.r').setAttribute('aria-pressed', String(next === 'list'));
      todayBox.querySelector('.bm.b').setAttribute('aria-pressed', String(next === 'pie'));
      if (next === 'pie') {
        sideScroll.replaceChildren(h('div', { class: 'home-pie-view' }, Calendar.homePie(new Date())));
      } else { sideScroll.replaceChildren(...listContents); }
    }
    selectSide(sideMode);

    // 마우스를 올리거나 누르면 책이 차례로 통통 튄다
    const logo = h('div', { class: 'home-logo' },
      icon('books', 'logo-books'),
      h('div', { class: 'logo-name' }, 'Class', h('b', null, 'Hub')));
    const bounce = () => { logo.classList.remove('go'); void logo.offsetWidth; logo.classList.add('go'); };
    logo.addEventListener('mouseenter', bounce);
    logo.addEventListener('pointerdown', bounce);
    logo.addEventListener('focus', bounce);

    root.append(h('button', { class: 'home-settings-btn btn', type: 'button', onclick: App.openSettings, 'aria-label': '설정 열기' }, icon('settings'), '설정'));
    root.append(h('div', { class: 'home' },
      cards,
      h('aside', { class: 'home-side' },
        h('div', { class: 'home-topline' }, h('div', { class: 'home-greeting' }, h('span', { class: 'home-greeting-kicker' }, 'CLASS HUB'), h('b', null, '오늘도 차근차근!'), h('span', null, '할 일과 수업을 한눈에 확인해요.')), logo),
        todayBox)));
  }
  return { render };
})();

App.registerView('home', { label: '홈', icon: 'home', render: Home.render });

(async function start() {
  await Store.init();
  await Cloud.init();
  Settings.apply();
  if (!Cloud.configured) Timer.init();
  window.addEventListener('hashchange', App.route);
  if (Cloud.ready) App.route();
})();
