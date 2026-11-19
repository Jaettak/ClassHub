const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync('js/grades.js', 'utf8').replace('return { render };', 'return { render, category, displayRows, examText };');
const context = vm.createContext({ App: { registerView() {} } });
vm.runInContext(source, context);
const Grades = vm.runInContext('Grades', context);
const base = { schoolYear: 2025, grade: 1, semester: 2, subject: '공통수학2' };
const rows = [
  { ...base, recordType: 'assessment', category: '지필', exam: '1회시험', score: 84.1 },
  { ...base, recordType: 'examResult', exam: '2학기 중간고사', score: 84.1 },
  { ...base, recordType: 'assessment', category: '지필', exam: '2회고사', score: 89.3 },
  { ...base, recordType: 'examResult', exam: '2학기 기말고사', score: 89.3 },
  { ...base, recordType: 'assessment', category: '수행', assessmentName: '문제 해결', score: 20 },
  { ...base, recordType: 'courseResult', exam: '학기말', score: 94 },
];
assert.deepEqual(Array.from(Grades.displayRows(rows).map((row) => row.recordType)), ['examResult', 'examResult', 'assessment', 'courseResult']);
assert.equal(Grades.category(rows[4]), 'assessment');
assert.equal(Grades.examText(rows[0]), '1회고사');
console.log('grades-import-smoke: ok');
