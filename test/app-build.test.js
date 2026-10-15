'use strict';
// app.html is generated. A stale build means the app quietly runs old logic, so that is a test failure.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { build, lf, ORDER, MARKER } = require('../scripts/build-app.js');
const ROOT = path.join(__dirname, '..');

test('app.html is a fresh build of the current modules', () => {
  // lf(): a Windows checkout (git autocrlf) hands us CRLF; the build itself is LF either way.
  const current = lf(fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8'));
  assert.equal(current, build(), 'app.html is stale - run: node scripts/build-app.js');
});

test('the build is byte-identical whether its inputs arrive with LF or CRLF', () => {
  // The staleness check used to fail on every Windows laptop and pass on CI, for the same source.
  const code = lf(fs.readFileSync(path.join(ROOT, 'src', 'lib', 'regions.js'), 'utf8'));
  const crlf = code.replace(/\n/g, '\r\n');
  assert.equal(build({ modules: { regions: crlf } }), build({ modules: { regions: code } }));
  assert.equal(build().includes('\r'), false, 'the build must never contain a carriage return');
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
  let built = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
  // The one exception is the contact channel from src/lib/contact.js: a link the user clicks, which
  // carries nothing from the list. Exactly those configured strings are removed before the scan.
  const contact = require('../src/lib/contact.js');
  for (const allowed of [contact.ISSUE_FORM, contact.CONTACT].filter(Boolean)) built = built.split(allowed).join('');
  // PeerEd handles data about minors. Anything that leaves the device would break that promise.
  for (const forbidden of ['http://', 'https://', 'fetch(', 'XMLHttpRequest', 'sendBeacon',
    'cdn.', 'googleapis', 'unpkg', 'jsdelivr', 'analytics', 'gtag(']) {
    assert.equal(built.includes(forbidden), false, 'app.html must not contain ' + forbidden);
  }
});

test('the app stores no name, no contact detail and no free text', () => {
  const built = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
  // The shell never touches localStorage itself: the single writer is src/lib/store.js, whose
  // serialize() only emits the re-validated state (store.test.js covers what that state may hold).
  assert.equal(/localStorage\.setItem/.test(built), false, 'the shell must write through the store module');
  const stores = built.match(/\.setItem\([^)]*\)/g) || [];
  assert.ok(stores.length > 0, 'the app does save something');
  for (const call of stores) {
    assert.equal(/name|email|phone|note/i.test(call), false, 'must not store personal text: ' + call);
  }
  assert.ok(stores.some((call) => /setItem\(storageKey, text\)/.test(call)), 'the store writes serialize() output');
  assert.ok(built.indexOf('__registry["store"] = module.exports') !== -1, 'store.js is inlined');
});
