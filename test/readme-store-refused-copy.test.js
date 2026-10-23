'use strict';
// The README's store.js row said a refused document "comes back as an empty state plus the reason", and the
// wipe paragraph said "the one storage key is removed", over a store whose load() copies a refused document
// to key + ':rejected' and whose clear() removes both keys. The README must name the second key.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createStore, DEFAULT_KEY } = require('../src/lib/store.js');

const root = path.join(__dirname, '..');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const row = readme.split('\n').find(function (line) { return line.startsWith('| `src/lib/store.js`'); });

function fakeBackend(items) {
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(items, k) ? items[k] : null; },
    setItem: function (k, v) { items[k] = String(v); },
    removeItem: function (k) { delete items[k]; }
  };
}

test('store: a refused document is kept under key:rejected and clear() removes both keys', () => {
  const items = {};
  items[DEFAULT_KEY] = '{"schema":1,"people":[],"teacher":"x"}';
  const store = createStore(fakeBackend(items));
  const loaded = store.load();
  assert.ok(loaded.problem);
  assert.equal(loaded.kept, true);
  assert.equal(items[DEFAULT_KEY + ':rejected'], '{"schema":1,"people":[],"teacher":"x"}');
  assert.equal(store.clear(), true);
  assert.deepEqual(Object.keys(items), []);
});

test('README: the store.js row and the wipe paragraph name the :rejected copy', () => {
  assert.ok(row, 'the README has a store.js row');
  assert.ok(row.includes(DEFAULT_KEY + ':rejected'), 'the row names the second key');
  assert.match(row, /`clear\(\)` removes both keys/);
  assert.doesNotMatch(readme, /the one storage key is removed/);
  assert.match(readme, /`:rejected` copy of a refused document/);
});
