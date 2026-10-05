'use strict';
// app.html is generated. A stale build means the app quietly runs old logic, so that is a test failure.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { build, ORDER, MARKER } = require('../scripts/build-app.js');
const ROOT = path.join(__dirname, '..');

test('app.html is a fresh build of the current modules', () => {
  const current = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
  assert.equal(current, build(), 'app.html is stale - run: node scripts/build-app.js');
});

test('every module is inlined exactly once, in dependency order', () => {
  const built = build();
  for (const name of ORDER) {
    const marker = '/* ===== src/lib/' + name + '.js ===== */';
    assert.equal(built.split(marker).length - 1, 1, name + ' should appear exactly once');
  }
  const positions = ORDER.map((n) => built.indexOf('/* ===== src/lib/' + n + '.js ===== */'));
  assert.deepEqual(positions, positions.slice().sort((a, b) => a - b));
  assert.equal(built.indexOf(MARKER), -1);
});

test('module code is inlined verbatim, even a regex holding a replacement pattern', () => {
  // A "$&" or "$'" in module source must not be expanded by the build. It used to be, and the result
  // was an app.html that still passed the staleness check while holding the shell twice.
  const code = "var RE = new RegExp('^' + 'a' + ')$', 'i'); var AMP = '$&'; var TICK = '$`';";
  const built = build({ modules: { validator: code } });
  assert.ok(built.includes(code), 'module source was rewritten while being inlined');
  assert.equal(built.split('<script>').length, fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8')
    .split('<script>').length, 'the shell was duplicated');
});

test('no module in src/lib can be forgotten', () => {
  const files = fs.readdirSync(path.join(ROOT, 'src', 'lib'))
    .filter((f) => f.endsWith('.js')).map((f) => f.replace(/\.js$/, '')).sort();
  assert.deepEqual(ORDER.slice().sort(), files);
});

test('the app sends nothing anywhere: no network call, no third-party asset', () => {
  const built = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
  // PeerEd handles data about minors. Anything that leaves the device would break that promise.
  for (const forbidden of ['http://', 'https://', 'fetch(', 'XMLHttpRequest', 'sendBeacon',
    'cdn.', 'googleapis', 'unpkg', 'jsdelivr', 'analytics', 'gtag(']) {
    assert.equal(built.includes(forbidden), false, 'app.html must not contain ' + forbidden);
  }
});

test('the app stores no name, no contact detail and no free text', () => {
  const built = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
  const stores = built.match(/localStorage\.setItem\([^)]*\)/g) || [];
  assert.ok(stores.length > 0, 'the app does save something');
  for (const call of stores) {
    assert.equal(/name|email|phone|text|note/i.test(call), false, 'must not store personal text: ' + call);
  }
});
