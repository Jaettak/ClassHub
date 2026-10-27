// 타이머: 숙제·공부 시간을 재는 떠 있는 타이머 (화면을 옮겨도 유지됨)
const Timer = (() => {
  let st = null; // { title, evId, date, mode:'down'|'up', total, running, startedAt, before }
  let dock = null;
  let tick = null;
  let ctx = null;
  const baseTitle = document.title;

  const elapsed = () => (st ? st.before + (st.running ? (Date.now() - st.startedAt) / 1000 : 0) : 0);
  const shown = () => (st.mode === 'down' ? Math.max(0, st.total - elapsed()) : elapsed());
  const fmt = (s) => {
    s = Math.floor(s);
    const hh = Math.floor(s / 3600); const mm = Math.floor((s % 3600) / 60); const ss = s % 60;
    return (hh ? `${hh}:${pad(mm)}` : pad(mm)) + `:${pad(ss)}`;
  };
  const persist = () => Store.set('timer', st);
  const log = () => Store.get('timerLog', []);

  function beep() {
    const soundSettings = Store.get('settings', {}) || {};
    if (soundSettings.timerSound === false || Number(soundSettings.soundVolume ?? 70) <= 0) return;
    const volume = Math.min(1, Math.max(0, Number(soundSettings.soundVolume ?? 70) / 100));
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.35, 0.7].forEach((t) => {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.25 * volume, ctx.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.25);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.3);
      });
    } catch (e) { /* 소리를 못 내도 무시 */ }
  }

  function saveSession() {
    let sec = Math.round(elapsed());
    if (st.mode === 'down') sec = Math.min(sec, st.total);
    if (sec >= 10) {
      const l = log();
      l.push({ title: st.title, evId: st.evId || '', date: st.date || todayStr(), sec, at: Date.now() });
      Store.set('timerLog', l.slice(-500));
    }
    return sec;
  }

  function clear() {
    st = null;
    Store.set('timer', null);
    document.title = baseTitle;
    if (tick) { clearInterval(tick); tick = null; }
    if (dock) { dock.remove(); dock = null; }
  }

  function finish(auto) {
    if (!st) return;
    const info = { ...st };
    const sec = saveSession();
    clear();
    if (auto) beep();
    const min = Math.max(1, Math.round(sec / 60));
    App.toast(`${info.title || '타이머'} · ${min}분 기록했어요.`);
    if (info.evId) askDone(info);
    if (App.current === 'calendar') App.refresh();
  }

  function askDone(info) {
    if (!window.Calendar || !Calendar.isDone) return;
    const m = App.modal({
      title: '수고했어요!',
      body: h('p', null, `"${info.title}" 일정을 완료로 표시할까요?`),
      footer: [
        h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, '나중에'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => { Calendar.setDone(info.evId, info.date, true); m.close(); App.toast('완료로 표시했어요.'); if (App.current === 'calendar' || App.current === 'home') App.refresh(); } }, '완료 표시'),
      ],
    });
  }
  const auto2 = () => '수고했어요!';

  function update() {
    if (!st) return;
    if (st.mode === 'down' && st.running && elapsed() >= st.total) { finish(true); return; }
    if (dock) {
      dock.querySelector('.tm-time').textContent = fmt(shown());
      dock.querySelector('.tm-play').textContent = st.running ? '일시정지' : '계속';
      dock.classList.toggle('paused', !st.running);
    }
    document.title = st.running ? `${fmt(shown())} · ${st.title || '타이머'}` : baseTitle;
  }

  function mount() {
    if (dock) dock.remove();
    dock = h('div', { class: 'timer-dock', role: 'timer', 'aria-live': 'off' },
      h('div', { class: 'tm-title' }, st.title || '타이머'),
      h('div', { class: 'tm-time' }, fmt(shown())),
      h('div', { class: 'tm-btns' },
        h('button', { class: 'btn tm-play', type: 'button', onclick: toggle }, '일시정지'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => finish(false) }, '끝내기'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => { if (confirm('기록하지 않고 타이머를 끌까요?')) clear(); } }, '취소')));
    document.body.append(dock);
    if (!tick) tick = setInterval(update, 500);
    update();
  }

  function toggle() {
    if (!st) return;
    if (st.running) { st.before = elapsed(); st.running = false; } else { st.startedAt = Date.now(); st.running = true; }
    persist(); update();
  }

  function start(o) {
    if (st && !confirm('진행 중인 타이머가 있어요. 기록하고 새로 시작할까요?')) return;
    if (st) { saveSession(); clear(); }
    try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.resume) ctx.resume(); } catch (e) { /* 무시 */ }
    st = { title: o.title || '', evId: o.evId || '', date: o.date || todayStr(), mode: o.mode, total: (o.minutes || 0) * 60, running: true, startedAt: Date.now(), before: 0 };
    persist(); mount();
  }

  // 시작 창: 제목, 방식(카운트다운/스톱워치), 시간
  function open(o) {
    o = o || {};
    const title = h('input', { type: 'text', value: o.title || '', placeholder: '예: 수학 숙제', maxLength: 40 });
    const mins = h('input', { type: 'number', min: 1, max: 600, value: o.minutes || 25 });
    let mode = 'down';
    const seg = h('div', { class: 'seg' });
    const minsField = App.field('시간 (분)', mins);
    const draw = () => {
      seg.replaceChildren(...[['down', '타이머'], ['up', '스톱워치']].map(([k, l]) => h('button', { type: 'button', class: 'seg-btn' + (mode === k ? ' on' : ''), onclick: () => { mode = k; draw(); } }, l)));
      minsField.hidden = mode !== 'down';
      if (typeof quick !== 'undefined') quick.hidden = mode !== 'down';
    };
    const quick = h('div', { class: 'chips tm-quick' }, [10, 25, 30, 45, 60].map((n) => h('button', { type: 'button', class: 'fchip', onclick: () => { mins.value = n; mode = 'down'; draw(); } }, `${n}분`)));
    draw();
    const m = App.modal({
      title: '타이머 시작',
      body: [App.field('무엇을 할까요?', title), h('div', { class: 'field' }, h('span', null, '방식'), seg), minsField, quick,
        o.spent ? h('p', { class: 'hint' }, `이 일정에 지금까지 ${o.spent}분 공부했어요.`) : null],
      footer: [
        h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, '취소'),
        h('button', { class: 'btn primary', type: 'button', onclick: go }, '시작'),
      ],
    });
    function go() {
      const n = Number(mins.value);
      if (mode === 'down' && !(n >= 1)) { App.toast('시간을 1분 이상으로 적어 주세요.'); return; }
      m.close();
      start({ title: title.value.trim(), evId: o.evId, date: o.date, mode, minutes: n });
    }
    m.el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') go(); });
    setTimeout(() => title.focus(), 50);
  }

  // 일정에 쓴 공부 시간(분)
  const spent = (evId, date) => Math.round(log().filter((x) => x.evId === evId && x.date === date).reduce((a, x) => a + x.sec, 0) / 60);

  function init() {
    st = Store.get('timer', null);
    if (st && st.mode) mount(); else st = null;
  }

  function suspend() {
    st = null;
    if (tick) { clearInterval(tick); tick = null; }
    if (dock) { dock.remove(); dock = null; }
    document.title = baseTitle;
  }

  return { open, start, spent, init, suspend, active: () => !!st };
})();

App.registerView('timer', { label: '타이머', icon: 'timer', render(root) {
  const panel = h('section', { class: 'panel timer-page' },
    h('h1', { class: 'page-title' }, '타이머'),
    h('div', { class: 'timer-page-card' }, icon('timer'),
      h('h2', null, '학습 타이머'),
      h('p', { class: 'muted' }, '타이머와 스톱워치로 공부 시간을 기록해요.'),
      h('button', { class: 'btn primary', type: 'button', onclick: () => Timer.open({}) }, Timer.active() ? '새 타이머 시작' : '타이머 시작')),
    h('h3', null, '최근 기록'),
    h('div', { class: 'timer-history' }));
  const list = panel.querySelector('.timer-history');
  const fmtMin = sec => `${Math.floor(sec / 60)}분 ${sec % 60}초`;
  const logs = Store.get('timerLog', []).slice().reverse();
  list.replaceChildren(...(logs.length ? logs.slice(0, 30).map(x => h('div', { class: 'timer-history-item' },
    h('b', null, x.title || '학습'), h('span', null, `${x.date} · ${fmtMin(x.sec)}`))) :
    [h('p', { class: 'muted' }, '아직 타이머 기록이 없어요.') ]));
  root.append(panel);
} });
