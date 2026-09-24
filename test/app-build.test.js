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

test('the text gate neither stores the checked text nor promises to', () => {
  const shell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
  const handler = shell.slice(shell.indexOf("$('checkBtn')"), shell.indexOf("$('gateBtn')"));
  assert.ok(handler.length > 100, 'the checkBtn handler should be findable');
  // The text path holds the text in a variable and throws it away. A screen that says otherwise is a lie
  // in the one app whose whole claim is that it stores nothing identifying.
  assert.equal(/save\(\)|localStorage|state\./.test(handler), false, 'the text path must store nothing');
  assert.equal(/יישמר|נשמור|ישמור/.test(handler), false, 'the status must not promise a save no code performs');
  assert.ok(handler.includes('לא נשמר'), 'the clean status must say the text is not saved');
  // The same goes for the gaps card's scale bullet (kept inside this test so the README's test count holds).
  // Measured with node --expose-gc, 1000 x 1000 in one region, everyone overlapping: about 1 s and 420MB
  // live heap when each person has one hour and one subject, about 10-12 s and 920MB when each marks all
  // 49 hours on the grid with four subjects. The old bullet gave only the best case as if it were the cost.
  const built = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
  const li = /<li>החישוב מחזיק כל צמד אפשרי בזיכרון[^<]*<\/li>/.exec(built);
  assert.ok(li, 'the scale bullet is on the gaps card');
  assert.equal(/0\.8 שניות|450MB/.test(li[0]), false, 'the best case alone is not the cost: ' + li[0]);
  assert.match(li[0], /כשנייה וכ-420MB/, 'the low end, with its condition');
  assert.match(li[0], /כ-12 שניות וכ-920MB/, 'the high end, with its condition');
  assert.match(li[0], /כל 49 השעות/, 'the high end names the grid that produces it');
  assert.match(li[0], /בטלפון לא נמדד/, 'a phone was never measured, so the bullet says so');
});
