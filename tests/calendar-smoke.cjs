const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const state = {};
const clone = (v) => JSON.parse(JSON.stringify(v));
const context = vm.createContext({
  localStorage: { getItem: () => null, setItem: () => {} },
  Store: { get: (key, fallback) => clone(state[key] ?? fallback), set: (key, value) => { state[key] = clone(value); } },
  App: { registerView() {} }, WEEK: '일월화수목금토',
  pad: (n) => String(n).padStart(2, '0'),
  dateStr: (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
  todayStr: () => '2026-11-05',
  parseDate: (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); },
  colorFor: (name) => state.subjectColors?.[name] || (name === '자습' ? '#8b95a5' : '#4f8cff'),
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'holidays.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'calendar.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'timetable.js'), 'utf8'), context);
const Calendar = vm.runInContext('Calendar', context);
const Timetable = vm.runInContext('Timetable', context);
state.events = [
  { id: 'range', date: '2026-11-05', dateEnd: '2026-11-07', start: '10:00', end: '11:00', title: '기간', color: '#4f8cff' },
  { id: 'multi', date: '2026-11-05', dates: ['2026-11-05', '2026-11-07'], start: '12:00', end: '13:00', title: '선택', color: '#4f8cff' },
  { id: 'lesson', date: '2026-11-05', start: '09:00', end: '10:00', title: '평소 수업 (1교시)', subject: '평소 수업', schoolLesson: true, color: '#4f8cff' },
];
state.subjectColors = { '평소 수업': '#d42660' };
assert.equal(Calendar.byDate('2026-11-05').find((e) => e.id === 'lesson').color, '#d42660');
state.events.push({ id: 'custom-lesson', date: '2026-11-05', start: '11:00', end: '12:00', title: '평소 수업 (2교시)', subject: '평소 수업', schoolLesson: true, colorSource: 'custom', color: '#22aa44' });
assert.equal(Calendar.byDate('2026-11-05').find((e) => e.id === 'custom-lesson').color, '#22aa44');
assert.equal(Timetable.lessonsFor(new Date(2026, 10, 5)).find((e) => e.id === 'custom-lesson').color, '#22aa44');
state.events.push({ id: 'self-study', date: '2026-11-05', start: '12:00', end: '13:00', title: '자습 (3교시)', subject: '', schoolLesson: true, selfStudy: true, colorSource: 'custom', color: '#8b95a5' });
assert.equal(Calendar.byDate('2026-11-05').find((e) => e.id === 'self-study').color, '#8b95a5');
state.subjectColors.자습 = '#a8b6ca';
assert.equal(Calendar.byDate('2026-11-05').find((e) => e.id === 'self-study').color, '#a8b6ca');
state.events.push({ id: 'custom-study', date: '2026-11-05', start: '13:00', end: '14:00', title: '자습 (4교시)', subject: '', schoolLesson: true, selfStudy: true, colorSource: 'custom', color: '#7846af' });
assert.equal(Calendar.byDate('2026-11-05').find((e) => e.id === 'custom-study').color, '#7846af');
state.subjectColors['평소 수업'] = '#3388cc';
assert.equal(Calendar.byDate('2026-11-05').find((e) => e.id === 'lesson').color, '#3388cc');
assert.equal(Calendar.byDate('2026-11-05').find((e) => e.id === 'custom-lesson').color, '#22aa44');
assert.equal(Calendar.byDate('2026-11-05').find((e) => e.id === 'self-study').color, '#a8b6ca');
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
state.events.push({ id: 'christmas-class', date: '2026-12-25', start: '09:00', end: '10:00', title: '수업', schoolLesson: true });
state.events.push({ id: 'christmas-plan', date: '2026-12-25', start: '12:00', end: '13:00', title: '개인 일정' });
assert.equal(vm.runInContext('Holidays.forDate("2026-12-25")', context), '성탄절');
assert.equal(Calendar.byDate('2026-12-25').map((e) => e.id).join(','), 'christmas-plan');
process.stdout.write('calendar-smoke: ok\n');
