// 급식 관리: NEIS(공식)에서 학교별 급식을 주 단위로 보기
const Meals = (() => {
  let sel = new Date();
  const cache = new Map();

  const weekStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const getSchool = () => Store.get('mealSchool', null) || Settings.get().school;

  function dishLi(d, mine) {
    const hit = d.allergens.filter((n) => mine.has(n));
    return h('li', { class: hit.length ? 'al-hit' : '', title: hit.length ? `내 알레르기: ${hit.map((n) => Neis.ALLERGY[n]).join(', ')}` : '' },
      h('span', { class: 'dn' }, d.name),
      d.allergens.length ? h('span', { class: 'al-nums' }, d.allergens.map((n) => h('i', { class: mine.has(n) ? 'mine' : '', title: Neis.ALLERGY[n] || '' }, n))) : null);
  }

  function mealCard(m, mine) {
    const hits = new Set();
    m.dishes.forEach((d) => d.allergens.forEach((n) => { if (mine.has(n)) hits.add(n); }));
    return h('section', { class: 'ml-card' },
      h('h3', null, m.kind, m.cal ? h('small', null, ` ${m.cal}`) : null),
      hits.size ? h('p', { class: 'al-warn' }, `내 알레르기 주의: ${[...hits].map((n) => Neis.ALLERGY[n]).join(', ')}`) : null,
      h('ul', { class: 'ml-dishes' }, m.dishes.map((d) => dishLi(d, mine))),
      m.ntr.length || m.origin.length ? h('details', { class: 'ml-more' }, h('summary', null, '영양·원산지 보기'),
        m.ntr.length ? h('div', null, h('b', null, '영양 정보'), h('ul', null, m.ntr.map((x) => h('li', null, x)))) : null,
        m.origin.length ? h('div', null, h('b', null, '원산지'), h('ul', null, m.origin.map((x) => h('li', null, x)))) : null) : null);
  }

  function render(root) {
    const panel = h('section', { class: 'panel' });
    let token = 0;

    async function draw() {
      const my = ++token;
      const school = getSchool();
      const ws = weekStart(sel);
      const we = addDays(ws, 6);
      const mine = new Set(Settings.get().allergies || []);
      const pick = () => Neis.pickSchool((sc) => { Store.set('mealSchool', sc); draw(); });
      const isMine = school && Settings.get().school && Settings.get().school.code === school.code;

      const strip = h('div', { class: 'ml-strip' });
      const detail = h('div', { class: 'ml-detail' });
      panel.replaceChildren(
        h('div', { class: 'title-row' },
          h('h1', { class: 'page-title' }, '급식 관리'),
          h('div', { class: 'ml-school' },
            school ? h('b', { class: 'set-school' }, school.name) : null,
            h('button', { class: 'btn', type: 'button', onclick: pick }, school ? '학교 바꾸기' : '학교 찾기'),
            school && !isMine ? h('button', { class: 'btn ghost', type: 'button', onclick: () => { Settings.save({ school }); App.toast('내 학교로 저장했어요.'); draw(); } }, '내 학교로 저장') : null)),
        h('div', { class: 'cal-nav ml-nav' },
          h('button', { class: 'btn', type: 'button', onclick: () => { sel = addDays(sel, -7); draw(); }, 'aria-label': '지난주' }, '◀'),
          h('b', { class: 'cal-label' }, `${ws.getMonth() + 1}월 ${ws.getDate()}일 ~ ${we.getMonth() + 1}월 ${we.getDate()}일`),
          h('button', { class: 'btn', type: 'button', onclick: () => { sel = addDays(sel, 7); draw(); }, 'aria-label': '다음주' }, '▶'),
          h('button', { class: 'btn ghost', type: 'button', onclick: () => { sel = new Date(); draw(); } }, '오늘')),
        strip, detail,
        );

      const paintStrip = (data) => {
        strip.replaceChildren(...Array.from({ length: 7 }, (_, i) => {
          const d = addDays(ws, i);
          const ds = dateStr(d);
          const has = data && data[ds] && data[ds].length;
          return h('button', { type: 'button', class: 'ml-day' + (ds === dateStr(sel) ? ' on' : '') + (ds === todayStr() ? ' today' : '') + (i === 0 ? ' sun' : '') + (i === 6 ? ' sat' : ''),
            onclick: () => { sel = d; draw(); } }, h('span', null, WEEK[i]), h('b', null, d.getDate()), h('i', { class: has ? 'has' : '' }));
        }));
      };

      if (!school) {
        paintStrip(null);
        detail.append(h('div', { class: 'empty-box' }, '먼저 학교를 찾아 주세요. 설정에서 “내 학교”를 정해 두면 여기에도 자동으로 쓰여요.'));
        return;
      }

      const key = `${school.code}|${dateStr(ws)}`;
      let data = cache.get(key);
      if (!data) {
        paintStrip(null);
        detail.append(h('p', { class: 'muted ml-loading' }, '급식을 불러오는 중…'));
        try {
          data = await Neis.meals(school, ws, we);
          cache.set(key, data);
        } catch (e) {
          if (my !== token) return;
          detail.replaceChildren(h('div', { class: 'empty-box' }, e.message, h('div', null, h('button', { class: 'btn', type: 'button', onclick: draw }, '다시 시도'))));
          return;
        }
        if (my !== token) return;
      }
      paintStrip(data);
      const list = data[dateStr(sel)];
      const d = sel;
      detail.replaceChildren(
        h('h2', { class: 'ml-date' }, `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})`),
        list && list.length
          ? h('div', { class: 'ml-cards' }, list.map((m) => mealCard(m, mine)))
          : h('div', { class: 'empty-box' }, '이 날은 급식 정보가 없어요. 주말·방학·휴업일이거나 아직 등록되지 않았을 수 있어요.'));
    }

    draw();
    root.append(panel);
  }

  return { render };
})();

App.registerView('meals', { label: '급식', icon: 'meals', render: Meals.render });
