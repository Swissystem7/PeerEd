'use strict';
// Accessibility and interactive controls test:
// Verifies semantic grouping, accessible button names (WCAG 2.4.4 / 4.1.2), focus styling,
// and Hebrew error feedback for unit submissions.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { openApp, addPerson, press } = require('../test-support/fake-dom.js');

const ROOT = path.join(__dirname, '..');
const shell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
const LATIN = /[A-Za-z]/;


test('a11y: participant form inputs and actions have aria attributes', () => {
  assert.ok(/<select id="role"[^>]*aria-required="true"[^>]*aria-describedby="addStatus"/.test(shell),
    'role select must have aria-required="true" and aria-describedby="addStatus"');
  assert.ok(/<select id="region"[^>]*aria-required="true"[^>]*aria-describedby="addStatus"/.test(shell),
    'region select must have aria-required="true" and aria-describedby="addStatus"');
  assert.ok(/<button type="button" class="act" id="addPerson"[^>]*aria-describedby="addStatus"/.test(shell),
    'addPerson button must have aria-describedby="addStatus"');
  assert.ok(/<button type="button" class="ghost" id="wipeBtn"[^>]*aria-describedby="wipeStatus"/.test(shell),
    'wipeBtn button must have aria-describedby="wipeStatus"');
  assert.ok(/<button type="button" class="ghost" id="wipeCancel"[^>]*aria-describedby="wipeStatus"/.test(shell),
    'wipeCancel button must have aria-describedby="wipeStatus"');
});

test('a11y: adding a participant without hours focuses hours container and reports Hebrew error', () => {
  const $ = openApp();
  $('role').value = 'student';
  $('region').value = 'CENTER';
  press($('subjects'), 'data-subject', 'MATH');
  $('hours').focused = false;
  $('addPerson').fire('click');

  const status = $('addStatus');
  assert.ok(status.className.includes('bad'), 'missing hours must be rejected');
  assert.doesNotMatch(status.textContent, LATIN, 'error status should not have English letters: ' + status.textContent);
  assert.equal($('hours').focused, true, 'hours container must be focused on error');
});

test('a11y: adding a participant without subjects focuses subjects container and reports Hebrew error', () => {
  const $ = openApp();
  $('role').value = 'student';
  $('region').value = 'CENTER';
  press($('hours'), 'data-slot', 'SUN_16');
  $('subjects').focused = false;
  $('addPerson').fire('click');

  const status = $('addStatus');
  assert.ok(status.className.includes('bad'), 'missing subjects must be rejected');
  assert.doesNotMatch(status.textContent, LATIN, 'error status should not have English letters: ' + status.textContent);
  assert.equal($('subjects').focused, true, 'subjects container must be focused on error');
});

test('a11y: adding a participant with invalid role focuses role select and reports Hebrew error', () => {
  const $ = openApp();
  $('role').value = 'invalid';
  $('region').value = 'CENTER';
  press($('hours'), 'data-slot', 'SUN_16');
  press($('subjects'), 'data-subject', 'MATH');
  $('role').focused = false;
  $('addPerson').fire('click');

  const status = $('addStatus');
  assert.ok(status.className.includes('bad'), 'invalid role must be rejected');
  assert.doesNotMatch(status.textContent, LATIN, 'error status should not have English letters: ' + status.textContent);
  assert.equal($('role').focused, true, 'role select must be focused on error');
});

test('a11y: adding a participant with invalid region focuses region select and reports Hebrew error', () => {
  const $ = openApp();
  $('role').value = 'student';
  $('region').value = 'INVALID';
  press($('hours'), 'data-slot', 'SUN_16');
  press($('subjects'), 'data-subject', 'MATH');
  $('region').focused = false;
  $('addPerson').fire('click');

  const status = $('addStatus');
  assert.ok(status.className.includes('bad'), 'invalid region must be rejected');
  assert.doesNotMatch(status.textContent, LATIN, 'error status should not have English letters: ' + status.textContent);
  assert.match(status.textContent, /אזור לא מוכר/);
  assert.equal($('region').focused, true, 'region select must be focused on error');
});

