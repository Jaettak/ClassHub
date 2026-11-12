// 타이머: 숙제·공부 시간을 재는 떠 있는 타이머 (화면을 옮겨도 유지됨)
const Timer = (() => {
  let st = null; // 현재 조작 중인 타이머 또는 스톱워치
  let sessions = { down: null, up: null };
  const ordered = () => Object.values(sessions).filter(Boolean).sort((a, b) => (b.order || b.startedAt) - (a.order || a.startedAt));
  let dock = null;
  let tick = null;
  let ctx = null;
  let alarmTimer = null;
  let alarmBar = null;
  let alarmSound = false;
  const baseTitle = `ClassHub - 학교생활 통합 관리 · ${CLASSHUB_VERSION}`;

  const elapsed = (session = st) => (session ? session.before + (session.running ? (Date.now() - session.startedAt) / 1000 : 0) : 0);
  const shown = (session = st) => (session?.mode === 'down' ? Math.max(0, session.total - elapsed(session)) : elapsed(session));
  const fmt = (s) => {
    s = Math.floor(s);
    const hh = Math.floor(s / 3600); const mm = Math.floor((s % 3600) / 60); const ss = s % 60;
    return (hh ? `${hh}:${pad(mm)}` : pad(mm)) + `:${pad(ss)}`;
  };
  const persist = () => Store.set('timerSessions', sessions);
  const log = () => Store.get('timerLog', []);

  function beep() {
    const soundSettings = Settings.get();
    if (!alarmSound || Number(soundSettings.soundVolume ?? 50) <= 0) return;
    const volume = Math.min(1, Math.max(0, Number(soundSettings.soundVolume ?? 50) / 50)) * 1.25;
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

  function stopAlarm() {
    if (alarmTimer) clearInterval(alarmTimer);
    alarmTimer = null;
    if (alarmBar) alarmBar.remove();
    alarmBar = null;
    document.body.classList.remove('timer-alerting');
    alarmSound = false;
  }

  function startAlarm(info) {
    stopAlarm();
    const settings = Settings.get();
    alarmSound = info.alarmSound ?? (settings.timerSound !== false);
    const visual = info.alarmVisual !== false;
    if (!visual && !alarmSound) return;
    alarmBar = h('div', { class: 'timer-alarm', role: 'alert' },
      h('b', null, `${info.title || '타이머'} 시간이 끝났어요`),
      h('button', { class: 'btn primary', type: 'button', onclick: stopAlarm }, '타이머 끄기'));
    document.body.append(alarmBar);
    if (visual) document.body.classList.add('timer-alerting');
    if (alarmSound) { beep(); alarmTimer = setInterval(beep, 1800); }
  }

  function saveSession() {
    let sec = Math.max(1, Math.round(elapsed()));
    if (st.mode === 'down') sec = Math.min(sec, st.total);
    if (sec >= 1) {
      const l = log();
      l.push({ id: uid(), title: st.title, evId: st.evId || '', date: st.date || todayStr(), sec, mode: st.mode, laps: st.laps || [], at: Date.now() });
      Store.set('timerLog', l.slice(-500));
    }
    return sec;
  }

  function clear() {
    if (!st) return;
    sessions[st.mode] = null;
    st = ordered()[0] || null;
    persist(); mount();
  }

  function finish(auto) {
    if (!st) return;
    const info = { ...st };
    const sec = saveSession();
    clear();
    if (auto) startAlarm(info);
    App.toast(`${info.title || '타이머'} · ${fmt(sec)} 기록했어요.`);
    if (info.evId) askDone(info);
    if (App.current === 'calendar' || App.current === 'timer') App.refresh();
  }

  function askDone(info) {
    if (typeof Calendar === 'undefined' || !Calendar.isDone) return;
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
    for (const session of ordered()) {
      if (session.mode === 'down' && session.running && elapsed(session) >= session.total) { st = session; finish(true); return; }
    }
    dock?.querySelectorAll('.timer-dock').forEach((card) => {
      const session = sessions[card.dataset.mode];
      if (!session) return;
      card.querySelector('.tm-time').textContent = fmt(shown(session));
      card.querySelector('.tm-play').textContent = session.running ? '일시정지' : '계속';
      card.classList.toggle('paused', !session.running);
    });
    const latest = ordered().find((session) => session.running);
    document.title = latest?.running ? `${fmt(shown(latest))} · ${latest.title || (latest.mode === 'up' ? '스톱워치' : '타이머')}` : baseTitle;
  }

  function mount() {
    if (dock) dock.remove();
    dock = null;
    const running = ordered();
    if (!running.length) { if (tick) clearInterval(tick); tick = null; document.title = baseTitle; return; }
    dock = h('div', { class: 'timer-stack' }, running.map((session) => h('div', { class: 'timer-dock', 'data-mode': session.mode, role: 'timer', 'aria-live': 'off' },
      h('div', { class: 'tm-header' }, h('div', { class: 'tm-title' }, session.title || (session.mode === 'up' ? '스톱워치' : '타이머'))),
      h('div', { class: 'tm-time' }, fmt(shown(session))),
      h('div', { class: 'tm-btns' },
        h('button', { class: 'btn tm-play', type: 'button', onclick: () => { st = session; toggle(); } }, '일시정지'),
        session.mode === 'up' ? h('button', { class: 'btn', type: 'button', onclick: () => { st = session; lap(); } }, '구간 저장') : null,
        h('button', { class: 'btn primary', type: 'button', onclick: () => { st = session; finish(false); } }, '끝내기'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => { if (confirm('기록하지 않고 끌까요?')) { st = session; clear(); } } }, '취소')))));
    document.body.append(dock);
    if (!tick) tick = setInterval(update, 500);
    update();
  }

  function lap() {
    if (!st || st.mode !== 'up') return;
    const total = Math.floor(elapsed()), previous = st.laps?.at(-1)?.total || 0;
    if (total <= previous) return App.toast('1초 이상 지난 뒤 구간을 저장해 주세요.');
    st.laps = [...(st.laps || []), { total, sec: total - previous }];
    persist();
    App.toast(`${st.laps.length}구간 · ${fmt(total - previous)} 저장했어요.`);
  }

  function toggle() {
    if (!st) return;
    if (st.running) { st.before = elapsed(); st.running = false; } else { st.startedAt = Date.now(); st.running = true; }
    persist(); update();
  }

  function start(o) {
    stopAlarm();
    st = sessions[o.mode] || null;
    if (st && !confirm(`진행 중인 ${o.mode === 'up' ? '스톱워치' : '타이머'}가 있어요. 기록하고 새로 시작할까요?`)) return;
    if (st) { saveSession(); sessions[o.mode] = null; if (App.current === 'timer') App.refresh(); }
    try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.resume) ctx.resume(); } catch (e) { /* 무시 */ }
    st = { title: o.title || '', evId: o.evId || '', date: o.date || todayStr(), mode: o.mode, total: o.seconds ?? ((o.minutes || 0) * 60), alarmSound: o.alarmSound, alarmVisual: o.alarmVisual, running: true, startedAt: Date.now(), order: Date.now(), before: 0, laps: [] };
    sessions[o.mode] = st;
    persist(); mount();
  }

  // 시작 창: 제목, 방식(카운트다운/스톱워치), 시간
  function open(o) {
    o = o || {};
    const title = h('input', { type: 'text', value: o.title || '', placeholder: '예: 수학 숙제', maxLength: 40 });
    const mins = h('input', { type: 'number', min: 0, max: 600, value: o.minutes ?? 25 });
    const secs = h('input', { type: 'number', min: 0, max: 59, value: 0 });
    const sound = h('input', { type: 'checkbox', checked: Settings.get().timerSound !== false });
    const visual = h('input', { type: 'checkbox', checked: true });
    let mode = o.mode === 'up' ? 'up' : 'down';
    const seg = h('div', { class: 'seg' });
    const timeFields = h('div', { class: 'row2 tm-duration' }, App.field('분', mins), App.field('초', secs));
    const alertChoices = h('div', { class: 'tm-alert-choices' }, h('b', null, '종료 알림'), h('label', { class: 'check' }, sound, '소리'), h('label', { class: 'check' }, visual, '화면 표시'));
    const draw = () => {
      if (!o.mode) seg.replaceChildren(...[['down', '타이머'], ['up', '스톱워치']].map(([k, l]) => h('button', { type: 'button', class: 'seg-btn' + (mode === k ? ' on' : ''), onclick: () => { mode = k; draw(); } }, l)));
      timeFields.hidden = mode !== 'down';
      alertChoices.hidden = mode !== 'down';
      if (typeof quick !== 'undefined') quick.hidden = mode !== 'down';
    };
    const quick = h('div', { class: 'chips tm-quick' }, [10, 25, 30, 45, 60].map((n) => h('button', { type: 'button', class: 'fchip', onclick: () => { mins.value = n; mode = 'down'; draw(); } }, `${n}분`)));
    draw();
    const m = App.modal({
      title: mode === 'up' ? '스톱워치 시작' : '타이머 시작',
      body: [App.field('무엇을 할까요?', title), o.mode ? null : h('div', { class: 'field' }, h('span', null, '방식'), seg), timeFields, quick,
        alertChoices,
        o.spent ? h('p', { class: 'hint' }, `이 일정에 지금까지 ${o.spent}분 공부했어요.`) : null],
      footer: [
        h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, '취소'),
        h('button', { class: 'btn primary', type: 'button', onclick: go }, '시작'),
      ],
    });
    function go() {
      const n = Number(mins.value), s = Number(secs.value);
      if (mode === 'down' && (!Number.isInteger(n) || !Number.isInteger(s) || n < 0 || n > 600 || s < 0 || s > 59 || n * 60 + s < 1)) { App.toast('시간을 1초 이상으로 적어 주세요.'); return; }
      m.close();
      start({ title: title.value.trim(), evId: o.evId, date: o.date, mode, seconds: n * 60 + s, alarmSound: sound.checked, alarmVisual: visual.checked });
    }
    m.el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') go(); });
    setTimeout(() => title.focus(), 50);
  }

  // 일정에 쓴 공부 시간(분)
  const spent = (evId, date) => Math.round(log().filter((x) => !x.deletedAt && x.evId === evId && x.date === date).reduce((a, x) => a + x.sec, 0) / 60);
  const totalForDate = (date) => Math.round(log().filter((x) => !x.deletedAt && x.date === date).reduce((a, x) => a + x.sec, 0) / 60);

  function init() {
    const saved = Store.get('timerSessions', null);
    if (saved && typeof saved === 'object') sessions = { down: saved.down || null, up: saved.up || null };
    else {
      const legacy = Store.get('timer', null);
      if (legacy?.mode && legacy.mode in sessions) { sessions[legacy.mode] = legacy; persist(); Store.set('timer', null); }
    }
    st = ordered()[0] || null;
    if (st) mount();
  }

  function suspend() {
    stopAlarm();
    st = null;
    sessions = { down: null, up: null };
    if (tick) { clearInterval(tick); tick = null; }
    if (dock) { dock.remove(); dock = null; }
    document.title = baseTitle;
  }

  return { open, start, spent, totalForDate, init, suspend, stopAlarm, active: () => ordered().length > 0 };
})();

App.registerView('timer', { label: '타이머', icon: 'timer', render(root) {
  const panel = h('section', { class: 'panel timer-page' },
    h('div', { class: 'title-row' }, h('h1', { class: 'page-title' }, '타이머'),
      h('button', { class: 'trash-icon-btn', type: 'button', title: '타이머 기록 휴지통', 'aria-label': '타이머 기록 휴지통', onclick: () => openTrash() }, icon('trash'))),
    h('div', { class: 'timer-mode-grid' },
      h('button', { class: 'timer-page-card', type: 'button', onclick: () => Timer.open({ mode: 'down' }) }, icon('timer'), h('h2', null, '타이머'), h('span', null, '정해 둔 시간만큼 집중하기')),
      h('button', { class: 'timer-page-card', type: 'button', onclick: () => Timer.open({ mode: 'up' }) }, icon('timer'), h('h2', null, '스톱워치'), h('span', null, '공부한 시간 재기'))),
    h('h3', null, '최근 기록'),
    h('div', { class: 'timer-history' }));
  const list = panel.querySelector('.timer-history');
  const fmtMin = sec => `${Math.floor(sec / 60)}분 ${sec % 60}초`;
  const sameLog = (a, b) => a.id || b.id ? a.id === b.id : a.at === b.at;
  const drawLogs = () => {
    const current = Store.get('timerLog', []).filter((x) => !x.deletedAt).slice().reverse();
    list.replaceChildren(...(current.length ? current.slice(0, 30).map((x) => h('div', { class: 'timer-history-row' },
      h('details', { class: 'timer-history-item' },
        h('summary', null, h('b', null, x.title || (x.mode === 'up' ? '스톱워치' : '타이머')), h('span', null, `${x.date} · ${fmtMin(x.sec)}`)),
        x.laps?.length ? h('ol', { class: 'timer-laps' }, x.laps.map((lap, i) => h('li', null, `${i + 1}구간 ${fmtMin(lap.sec)} · 누적 ${fmtMin(lap.total)}`))) : h('p', { class: 'muted' }, '저장된 구간이 없어요.')),
      h('button', { class: 'timer-log-delete', type: 'button', 'aria-label': '기록 휴지통으로 이동', onclick: () => {
        Store.set('timerLog', Store.get('timerLog', []).map((log) => sameLog(log, x) ? { ...log, deletedAt: Date.now() } : log)); drawLogs();
      } }, '×'))) : [h('p', { class: 'muted' }, '아직 타이머 기록이 없어요.') ]));
  };
  drawLogs();
  const openTrash = () => {
    const body = h('div', { class: 'timer-trash' });
    const refresh = () => {
      const deleted = Store.get('timerLog', []).filter((x) => x.deletedAt);
      body.replaceChildren(...(deleted.length ? deleted.map((x) => h('div', { class: 'timer-trash-row' },
        h('span', null, `${x.title || '학습'} · ${x.date} · ${fmtMin(x.sec)}`),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => {
          Store.set('timerLog', Store.get('timerLog', []).map((log) => sameLog(log, x) ? { ...log, deletedAt: null } : log)); refresh(); drawLogs();
        } }, '복원'),
        h('button', { class: 'btn danger', type: 'button', onclick: () => {
          if (!confirm('이 기록을 영구 삭제할까요?')) return;
          Store.set('timerLog', Store.get('timerLog', []).filter((log) => !sameLog(log, x))); refresh();
        } }, '영구 삭제'))) : [h('p', { class: 'muted' }, '휴지통이 비어 있어요.') ]));
    };
    refresh();
    App.modal({ title: '타이머 기록 휴지통', body, footer: [h('button', { class: 'btn danger', type: 'button', onclick: () => {
      if (!confirm('휴지통의 기록을 모두 영구 삭제할까요?')) return;
      Store.set('timerLog', Store.get('timerLog', []).filter((x) => !x.deletedAt)); refresh();
    } }, '휴지통 비우기')] });
  };
  root.append(panel);
} });
