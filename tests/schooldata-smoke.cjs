const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const context = { App: { registerView() {} } };
vm.createContext(context);
vm.runInContext(fs.readFileSync('js/schooldata.js', 'utf8') + '\nthis.school = SchoolData;', context);
const { normalize, makeTemplate } = context.school;
for (const kind of ['calendar', 'map', 'timetable', 'grades', 'activities']) {
  const template = makeTemplate(kind);
  assert.equal(template.version, 2);
  assert.equal(template.kind, kind);
  assert.ok(Array.isArray(template.examples));
  assert.ok(template.fieldGuide);
  for (const [index, example] of template.examples.entries()) assert.ok(normalize(kind, example, index));
}
assert.ok(makeTemplate('calendar').overview.semesterInstructionDays);
assert.equal(makeTemplate('grades').examples.find((row) => row.recordType === 'courseResult').achievementDistribution.A, 10);
const calendar = normalize('calendar', { date: '2026-11-10', title: '체육대회' }, 0);
assert.equal(calendar.title, '체육대회');
assert.equal(calendar.checkable, false);
const importedCalendar = normalize('calendar', { date: '2026-11-10', title: '졸업식', type: '학사' }, 0);
assert.equal(importedCalendar.memo, '');
assert.equal(importedCalendar.sourceSchoolImport, true);
const range = normalize('calendar', { date: '2026-11-10', dateEnd: '2026-11-12', title: '시험기간', location: '본관' }, 0);
assert.equal(range.dateEnd, '2026-11-12');
assert.match(range.memo, /본관/);
const floor = normalize('map', { building: '본관', floor: '2층', width: 1000, height: 700,
  rooms: [{ name: '2학년 3반', polygon: [[0, 0], [200, 0], [200, 100], [0, 100]] }],
  features: [{ name: '소화기', x: 300, y: 200 }] }, 0);
assert.equal(floor.rooms[0].name, '2학년 3반');
const gridOnlyFloor = normalize('map', { building: '본관', floor: '4층', width: 1000, height: 700,
  rooms: [{ name: '학습카페', sourceCell: 'H31', polygon: [] }], features: [], gridCells: [{ cell: 'H31', text: '학습카페' }] }, 0);
assert.equal(gridOnlyFloor.rooms[0].sourceCell, 'H31');
const grade = normalize('grades', { subject: '수학', score: 88, full: 100, classRank: 3, rateA: 21 }, 0);
assert.equal(grade.classRank, 3);
assert.equal(grade.rank, null);
assert.equal(grade.rateA, 21);
const gradeWithRank = normalize('grades', { recordType: 'courseResult', subject: '수학', score: 88, full: 100, rankGrade: 2, classRank: 12, jointRank: 2 }, 0);
assert.equal(gradeWithRank.rank, 2);
assert.equal(gradeWithRank.classRank, 12);
assert.equal(gradeWithRank.jointRank, 2);
assert.equal(normalize('grades', { subject: '국어', achievement: 'A' }, 0).reportOnly, true);
const completion = normalize('grades', { recordType: 'completion', schoolYear: 2025, grade: 1, semester: 1,
  subject: '진로와 직업', completed: true, completionMark: 'P', score: null }, 0);
assert.equal(completion.reportOnly, true);
assert.equal(completion.sourceDetails.completionMark, 'P');
const course = normalize('grades', { recordType: 'courseResult', subject: '국어', score: 96.45, full: 100,
  achievementDistribution: { A: 28.3 }, subjectAverage: 81.3, weightPercent: 0 }, 0);
assert.equal(course.rateA, 28.3);
assert.equal(course.avg, 81.3);
assert.equal(course.weightPercent, 0);
const roundedCourse = normalize('grades', { recordType: 'courseResult', subject: '공통국어2', score: null, full: null,
  rawScore: 97, achievement: 'A', rankGrade: 1 }, 0);
assert.equal(roundedCourse.reportOnly, undefined);
assert.equal(roundedCourse.score, 97);
assert.equal(roundedCourse.rawScore, 97);
assert.equal(roundedCourse.rank, 1);
const stored = { grades: [], schoolReportExtras: [{ id: 'imported-course', reportOnly: true, sourceSchoolImport: true,
  sourceDetails: { recordType: 'courseResult', subject: '공통국어2', score: null, rawScore: 97, rankGrade: 1 } }] };
context.Store = { get: (key, fallback) => stored[key] ?? fallback, set: (key, value) => { stored[key] = value; } };
assert.equal(context.school.repairImportedGrades(), 1);
assert.equal(stored.grades[0].id, 'imported-course');
assert.equal(stored.grades[0].score, 97);
assert.equal(stored.schoolReportExtras.length, 0);
assert.equal(context.school.repairImportedGrades(), 0);
const record = normalize('activities', { subject: '국어', section: '세부능력및특기사항', cv: '수업 원문' }, 0);
assert.equal(record.date, '');
assert.equal(record.subject, '국어');
const attendance = normalize('activities', { recordType: 'attendance', title: '1학년 출결상황', section: '출결상황',
  attendance: { schoolDays: 191, absence: { illness: 1, unexcused: 0, other: 0 } } }, 0);
assert.match(attendance.desc, /결석 1일/);
assert.equal(normalize('timetable', { day: 1, period: 7, subject: '수학', start: '09:00', end: '09:50' }, 0).period, 7);
assert.throws(() => normalize('timetable', { day: 8, period: 1, subject: '수학' }, 0));
assert.throws(() => normalize('grades', { subject: '수학', score: 120, full: 100 }, 0));
assert.throws(() => normalize('calendar', { date: '잘못된 날짜', title: '행사' }, 0));
console.log('schooldata-smoke: ok');
