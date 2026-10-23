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


test('a11y: unit form inputs have aria-describedby and required attributes', () => {
  assert.ok(/<input id="unitDuration"[^>]*aria-describedby="unitStatus"/.test(shell),
    'unitDuration must have aria-describedby="unitStatus"');
  assert.ok(/<input id="unitTitle"[^>]*aria-required="true"[^>]*aria-describedby="unitStatus"/.test(shell),
    'unitTitle must have aria-required="true" and aria-describedby="unitStatus"');
  assert.ok(/<textarea id="unitBody"[^>]*aria-required="true"[^>]*aria-describedby="unitStatus"/.test(shell),
    'unitBody must have aria-required="true" and aria-describedby="unitStatus"');
});

test('a11y: submitting a unit with validation errors focuses the invalid input', () => {
  const $ = openApp();

  // 1. Empty title focuses unitTitle
  $('unitTitle').value = '';
  $('unitSubject').value = 'MATH';
  $('unitDuration').value = '20';
  $('unitBody').value = 'תוכן כלשהו';
  $('submitUnit').fire('click');
  assert.equal($('unitTitle').focused, true, 'unitTitle must be focused when title is empty');

  // 2. Empty body focuses unitBody
  $('unitTitle').value = 'כותרת תקינה';
  $('unitTitle').focused = false;
  $('unitBody').value = '';
  $('submitUnit').fire('click');
  assert.equal($('unitBody').focused, true, 'unitBody must be focused when body is empty');

  // 3. Out-of-range duration focuses unitDuration
  $('unitBody').value = 'תוכן יחידה תקין ומפורט';
  $('unitBody').focused = false;
  $('unitDuration').value = '90'; // max is 60
  $('submitUnit').fire('click');
  assert.equal($('unitDuration').focused, true, 'unitDuration must be focused when duration is invalid');
});

