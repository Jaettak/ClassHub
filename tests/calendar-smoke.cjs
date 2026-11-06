const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const state = {};
const clone = (v) => JSON.parse(JSON.stringify(v));
const context = vm.createContext({
  Store: { get: (key, fallback) => clone(state[key] ?? fallback), set: (key, value) => { state[key] = clone(value); } },
  App: { registerView() {} }, WEEK: '일월화수목금토',
  pad: (n) => String(n).padStart(2, '0'),
  dateStr: (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
  todayStr: () => '2026-11-05',
  parseDate: (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); },
  colorFor: () => '#4f8cff',
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'calendar.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'timetable.js'), 'utf8'), context);
const Calendar = vm.runInContext('Calendar', context);
const Timetable = vm.runInContext('Timetable', context);
state.events = [
  { id: 'range', date: '2026-11-05', dateEnd: '2026-11-07', start: '10:00', end: '11:00', title: '기간', color: '#4f8cff' },
  { id: 'multi', date: '2026-11-05', dates: ['2026-11-05', '2026-11-07'], start: '12:00', end: '13:00', title: '선택', color: '#4f8cff' },
  { id: 'lesson', date: '2026-11-05', start: '09:00', end: '10:00', title: '평소 수업', schoolLesson: true, color: '#4f8cff' },
];
assert.equal(Calendar.byDate('2026-11-06').map((e) => e.id).join(','), 'range');
assert.equal(Calendar.byDate('2026-11-07').map((e) => e.id).join(','), 'range,multi');
Calendar.setDone('multi', '2026-11-07', true);
assert.equal(Calendar.byDate('2026-11-07').find((e) => e.id === 'multi').done, true);
assert.equal(Calendar.byDate('2026-11-05').find((e) => e.id === 'multi').done, false);
state.examPeriods = [{ id: 'exam', title: '중간고사', start: '2026-11-05', end: '2026-11-06', days: { '2026-11-05': [{ period: 1, subject: '수학', room: '101', start: '09:00', end: '10:00' }] } }];
const examDay = Calendar.byDate('2026-11-05');
assert.equal(examDay.some((e) => e.id === 'lesson'), false);
assert.equal(examDay.find((e) => e.examLesson).room, '101');
assert.equal(Timetable.lessonsFor(new Date(2026, 10, 5))[0].room, '101');
assert.equal(Calendar.nextExam().title, '중간고사');
assert.equal(Calendar.eventsFrom('2026-11-05', 0).some((e) => e.id === 'multi' && e.date === '2026-11-07'), true);
process.stdout.write('calendar-smoke: ok\n');
