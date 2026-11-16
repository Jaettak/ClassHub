const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const memory = new Map();
const uploaded = [];
const localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
};
const images = {
  capture1: { flat: 'data:image/png;base64,AA==', base: 'data:image/png;base64,AA==' },
  'school-floor-1': { data: 'data:image/jpeg;base64,AA==' },
  'school-source-1': { data: 'data:application/pdf;base64,AA==' },
};
let nextId = 1;
const fetch = async (url, options = {}) => {
  if (url.includes('spaces=appDataFolder')) return { ok: true, json: async () => ({ files: [] }) };
  if (url.includes('/upload/')) {
    uploaded.push(options.body?.text ? await options.body.text() : String(options.body));
    return { ok: true, json: async () => ({ id: String(nextId++), modifiedTime: new Date().toISOString() }) };
  }
  throw new Error(`Unexpected request: ${url}`);
};
const context = {
  Blob, URLSearchParams, Date, Map, JSON, Promise, crypto: webcrypto, fetch, localStorage,
  navigator: { onLine: true }, window: { addEventListener() {} },
  Cloud: { user: { uid: 'test', reauthenticateWithPopup: async () => ({}) } },
  firebase: { auth: { GoogleAuthProvider: class { addScope() {} static credentialFromResult() { return { accessToken: 'token' }; } } } },
  Store: {
    get: (key) => key === 'captures' ? [{ id: 'capture1', sourceType: 'pdf' }] : [],
    imageIds: async () => Object.keys(images),
    getLocalImg: async (id) => images[id] || null,
    putImg: async (id, value) => { images[id] = value; },
  },
  App: { toast: (message) => { throw new Error(message); } },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('js/cloud-drive.js', 'utf8') + '\nglobalThis.CloudDrive = CloudDrive;', context);
(async () => {
  context.CloudDrive.accountChanged('test');
  await context.CloudDrive.connect();
  assert.equal(uploaded.length, 2);
  assert(uploaded.some((body) => body.includes('classhub-media-capture1.json')));
  assert(uploaded.some((body) => body.includes('classhub-media-school-floor-1.json')));
  assert(!uploaded.some((body) => body.includes('school-source-1')));
  console.log('cloud-drive-smoke: ok');
})().catch((error) => { console.error(error); process.exitCode = 1; });
