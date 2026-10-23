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


test('a11y: session form selects have aria-required and aria-describedby attributes', () => {
  for (const id of ['sessionPair', 'sessionSlot', 'sessionSubject', 'sessionUnit', 'sessionOutcome']) {
    const pattern = new RegExp('<select id="' + id + '"[^>]*aria-required="true"[^>]*aria-describedby="sessionStatus"');
    assert.ok(pattern.test(shell), id + ' must have aria-required="true" and aria-describedby="sessionStatus"');
  }
  assert.ok(/<textarea id="reportText"[^>]*aria-describedby="reportStatus"/.test(shell),
    'reportText must have aria-describedby="reportStatus"');
});

test('a11y: logging a session without pairs focuses sessionPair select and shows Hebrew error', () => {
  const $ = openApp();
  $('logSession').fire('click');
  const status = $('sessionStatus');
  assert.ok(status.className.includes('bad'), 'session logging without pairs must fail');
  assert.match(status.textContent, /אין זוג לרשום לו שיעור/);
  assert.equal($('sessionPair').focused, true, 'sessionPair must be focused on error');
});

test('a11y: logging a session with unapproved unit focuses sessionUnit select and shows Hebrew error', () => {
  const $ = openApp();
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);
  addPerson($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);
  $('nav-sessions').fire('click');

  $('sessionSlot').value = 'SUN_16';
  $('sessionSubject').value = 'MATH';
  $('sessionUnit').value = '';
  $('sessionOutcome').value = 'held';
  $('logSession').fire('click');

  const status = $('sessionStatus');
  assert.ok(status.className.includes('bad'), 'session logging with unapproved unit must fail');
  assert.match(status.textContent, /אפשר לרשום רק יחידה מאושרת/);
  assert.equal($('sessionUnit').focused, true, 'sessionUnit must be focused on error');
});

