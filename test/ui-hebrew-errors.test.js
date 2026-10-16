'use strict';
// The screen is Hebrew. The engine's error messages are English (tests and logs read them), so every
// message that can reach a status line must be translated before it is shown. This test runs the real
// app.html in a tiny fake DOM, presses the buttons a coordinator presses, and fails if a status line
// shows Latin letters.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const LATIN = /[A-Za-z]/;

function fakeElement(id) {
  const handlers = {};
  const attrs = {};
  return {
    id, value: '', textContent: '', className: '', innerHTML: '', hidden: false, children: [],
    addEventListener(type, fn) { (handlers[type] = handlers[type] || []).push(fn); },
    setAttribute(k, v) { attrs[k] = String(v); },
    getAttribute(k) { return k in attrs ? attrs[k] : null; },
    fire(type, ev) { (handlers[type] || []).forEach((fn) => fn(ev || { target: this })); }
  };
}

// Load app.html's scripts into a fresh context and return the element lookup.
function openApp() {
  const html = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(scripts.length >= 3, 'app.html should carry its scripts inline');
  const els = {};
  const $ = (id) => (els[id] = els[id] || fakeElement(id));
  const store = {};
  const ctx = {
    document: { getElementById: $, querySelectorAll: () => [] },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    window: { scrollTo() {} },
    console
  };
  vm.createContext(ctx);
  for (const code of scripts) vm.runInContext(code, ctx);
  return $;
}

function clickChip(el, attr, value) {
  el.fire('click', { target: { getAttribute: (k) => (k === attr ? value : null), setAttribute() {} } });
}

test('adding a participant with no hours or no subject explains it in Hebrew', () => {
  const $ = openApp();
  $('role').value = 'pupil';
  $('region').value = 'CENTER';

  clickChip($('subjects'), 'data-subject', 'MATH');      // a subject, but no hour
  $('addPerson').fire('click');
  assert.ok($('addStatus').className.includes('bad'), 'the add should be refused');
  assert.doesNotMatch($('addStatus').textContent, LATIN, $('addStatus').textContent);

  clickChip($('subjects'), 'data-subject', 'MATH');      // un-select: an hour, but no subject
  clickChip($('hours'), 'data-slot', 'SUN_16');
  $('addPerson').fire('click');
  assert.ok($('addStatus').className.includes('bad'), 'the add should be refused');
  assert.doesNotMatch($('addStatus').textContent, LATIN, $('addStatus').textContent);
});

test('checking empty text explains it in Hebrew', () => {
  const $ = openApp();
  $('checkText').value = '   ';
  $('checkBtn').fire('click');
  assert.ok($('checkStatus').className.includes('bad'), 'empty text should be refused');
  assert.doesNotMatch($('checkStatus').textContent, LATIN, $('checkStatus').textContent);
});

test('the forbidden-field demo shows the refusal in Hebrew', () => {
  const $ = openApp();
  $('gateBtn').fire('click');
  assert.doesNotMatch($('gateStatus').className, /bad/, 'the phone field must be refused');
  assert.doesNotMatch($('gateStatus').textContent, LATIN, $('gateStatus').textContent);
});

test('logging a lesson with no approved unit explains it in Hebrew', () => {
  const $ = openApp();
  $('demoBtn').fire('click');
  $('sessionPair').value = '0';
  $('sessionSlot').value = 'SUN_16';
  $('sessionSubject').value = 'MATH';
  $('sessionUnit').value = '';                             // the unit list is empty: nothing approved yet
  $('sessionOutcome').value = 'held';
  $('logSession').fire('click');
  assert.ok($('sessionStatus').className.includes('bad'), 'the lesson should be refused');
  assert.doesNotMatch($('sessionStatus').textContent, LATIN, $('sessionStatus').textContent);
});

// session.js shares the 'invalid slot:' / 'invalid subject:' prefixes with the profile, whose lines say
// "not in the grid" / "not in the list". A lesson at an hour the pair does not share is a different fault.
test('a lesson outside what the pair shares is named as such, not as a bad hour or subject', () => {
  const $ = openApp();
  $('demoBtn').fire('click');
  $('sessionPair').value = '0';
  $('sessionOutcome').value = 'held';
  $('sessionUnit').value = '';

  $('sessionSlot').value = 'THU_20';                       // in the grid, but no demo pair is free then
  $('sessionSubject').value = 'MATH';
  $('logSession').fire('click');
  assert.match($('sessionStatus').textContent, /הזוג לא פנוי יחד/, $('sessionStatus').textContent);

  $('sessionSlot').value = 'SUN_16';
  $('sessionSubject').value = 'HISTORY';                   // in the list, but not shared by the pair
  $('logSession').fire('click');
  assert.match($('sessionStatus').textContent, /לא משותף לזוג/, $('sessionStatus').textContent);
});

// The modules a screen input reaches: the add-participant form, the free-text gate, the unit record,
// the approve/reject buttons and the log-session button with its CSV export.
const SCREEN_MODULES = ['profile.js', 'validator.js', 'unit.js', 'approval.js', 'session.js'];

test('every error the modules can throw has a Hebrew line in the shell', () => {
  const shell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
  const lib = SCREEN_MODULES.map((f) => fs.readFileSync(path.join(ROOT, 'src', 'lib', f), 'utf8')).join('\n');
  const literals = [...lib.matchAll(/new Error\('([^']+)'/g)].map((m) => m[1]);
  literals.push('personal data is not accepted');
  assert.ok(literals.length >= 9, 'found ' + literals.length + ' messages');
  for (const msg of literals) {
    const key = msg.includes(':') ? msg.slice(0, msg.indexOf(':') + 1) : msg;
    assert.ok(shell.includes("'" + key + "'"), 'no Hebrew translation for: ' + msg);
  }
});
