const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

let rules = { mode: 'type', type: { club: '#123456' }, family: {}, subject: {} };
const context = {
  App: { registerView() {} },
  Store: { get(key, fallback) { return key === 'activityColorRules' ? rules : fallback; } },
  Curriculum2022: { familyFor(subject) { return subject.startsWith('공통수학') ? '수학' : '국어'; } },
  colorFor(subject) { return subject === '공통수학2' ? '#abcdef' : '#fedcba'; },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('js/activities.js', 'utf8') + '\nthis.activities = Activities;', context);
const { borderColor } = context.activities;
const activity = { type: 'club', subject: '공통수학1', subjects: ['공통수학1', '공통수학2'] };

assert.equal(borderColor(activity), '#123456');
rules = { ...rules, mode: 'family' };
assert.equal(borderColor(activity), '#4f8cff');
assert.equal(borderColor(activity, { family: '국어' }), '#e76f89');
rules.family.수학 = '#654321';
assert.equal(borderColor(activity), '#654321');
rules = { ...rules, mode: 'subject' };
assert.equal(borderColor(activity), '#fedcba');
assert.equal(borderColor(activity, { subject: '공통수학2' }), '#abcdef');
rules.subject.공통수학2 = '#112233';
assert.equal(borderColor(activity, { subject: '공통수학2' }), '#112233');
console.log('activity-colors-smoke: ok');
