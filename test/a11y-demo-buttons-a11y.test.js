'use strict';
// Accessibility and interactive controls test:
// Verifies semantic grouping, accessible button names (WCAG 2.4.4 / 4.1.2), focus styling,
// and Hebrew error feedback for unit submissions.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { openApp, addPerson } = require('../test-support/fake-dom.js');

const ROOT = path.join(__dirname, '..');
const shell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
const LATIN = /[A-Za-z]/;


test('a11y: demo buttons have unambiguous labels and aria-describedby pointing to status messages', () => {
  const currentShell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
  assert.ok(/<button type="button" class="ghost" id="demoBtn"[^>]*aria-label="טען משתתפים לדוגמה"[^>]*aria-describedby="addStatus"/.test(currentShell),
    'demoBtn must have aria-label="טען משתתפים לדוגמה" and aria-describedby="addStatus"');
  assert.ok(/<button type="button" class="ghost" id="unitDemoBtn"[^>]*aria-label="טען יחידת העשרה לדוגמה"[^>]*aria-describedby="unitStatus"/.test(currentShell),
    'unitDemoBtn must have aria-label="טען יחידת העשרה לדוגמה" and aria-describedby="unitStatus"');
  assert.ok(/<button type="button" class="ghost" id="badBtn"[^>]*aria-describedby="checkStatus"/.test(currentShell),
    'badBtn must have aria-describedby="checkStatus"');
  assert.ok(/<button type="button" class="ghost" id="rudeBtn"[^>]*aria-describedby="checkStatus"/.test(currentShell),
    'rudeBtn must have aria-describedby="checkStatus"');

  const $ = openApp();
  $('demoBtn').fire('click');
  assert.match($('addStatus').textContent, /נטענו \d+ משתתפים לדוגמה/);

  $('unitDemoBtn').fire('click');
  assert.match($('unitStatus').textContent, /הדוגמה מולאה/);

  $('badBtn').fire('click');
  assert.match($('checkStatus').textContent, /לחץ "בדוק"/);

  $('rudeBtn').fire('click');
  assert.match($('checkStatus').textContent, /לחץ "בדוק"/);
});

