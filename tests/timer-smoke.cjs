const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

let timerView;
let savedLogs = [null];
const node = (tag, props, ...children) => {
  const el = {
    tag, props: props || {}, children: [], parent: null,
    append(...items) { items.flat(Infinity).filter((item) => item != null).forEach((item) => {
      this.children.push(item);
      if (typeof item === 'object') item.parent = this;
    }); },
    replaceChildren(...items) { this.children = []; this.append(...items); },
    replaceWith(item) {
      const i = this.parent.children.indexOf(this);
      assert.ok(i >= 0);
      this.parent.children.splice(i, 1, item);
      item.parent = this.parent;
    },
    querySelector(selector) {
      const flat = [];
      const visit = (item) => { if (!item || typeof item !== 'object') return; flat.push(item); item.children.forEach(visit); };
      visit(this);
      if (selector === '.timer-history') return flat.find((item) => item.props.class === 'timer-history');
      if (selector === '.timer-mode-grid + h3') return this.children.find((item, i) => item.tag === 'h3' && this.children[i - 1]?.props.class === 'timer-mode-grid');
      return null;
    },
  };
  el.append(...children);
  return el;
};
const context = vm.createContext({
  App: { registerView(name, view) { if (name === 'timer') timerView = view; } },
  Store: { get(key, fallback) { return key === 'timerLog' ? savedLogs : fallback; } },
  h: node, icon: (name) => node('svg', { name }),
  localStorage: { getItem: () => null },
  window: { addEventListener() {} }, document: { title: '' },
  CLASSHUB_VERSION: 'v2.4.3', innerWidth: 1000, innerHeight: 700,
  matchMedia: () => ({ matches: false }),
});
vm.runInContext(fs.readFileSync('js/timer.js', 'utf8'), context);
assert.ok(timerView, 'timer view is registered');
const root = node('main');
timerView.render(root);
assert.equal(root.children[0].props.class, 'panel timer-page');
assert.equal(root.children[0].querySelector('.timer-history').children.length, 1);
const cards = root.children[0].children.find((item) => item.props.class === 'timer-mode-grid');
assert.equal(cards.children.length, 2, 'timer and stopwatch cards are visible');
savedLogs = [];
const emptyRoot = node('main');
timerView.render(emptyRoot);
assert.equal(emptyRoot.children[0].querySelector('.timer-history').children.length, 1);
console.log('timer-smoke: ok');
