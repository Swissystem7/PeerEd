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

test('a11y: subjects and hours containers have role="group" with labelledby', () => {
  assert.ok(/<div class="chips" id="subjects" role="group" aria-labelledby="subjectsLabel">/.test(shell),
    'subjects chips must have role="group" and aria-labelledby');
  assert.ok(/<div class="grid-hours" id="hours" role="group" aria-labelledby="hoursLabel" aria-describedby="hoursHint">/.test(shell),
    'hours grid must have role="group", aria-labelledby and aria-describedby');
});

test('a11y: stylesheet includes focus-visible rules for interactive elements', () => {
  assert.ok(shell.includes('button:focus-visible'), 'button:focus-visible rule must exist');
  assert.ok(shell.includes('outline:2px solid var(--key)'), 'focus outline must use --key');
});

test('a11y: participant action buttons have informative aria-labels naming the participant', () => {
  const $ = openApp();
  addPerson($, 'pupil', 'NORTH', ['MATH'], ['SUN_16']);
  const html = $('peopleList').innerHTML;
  assert.ok(html.includes('aria-label="מחק תלמיד #1"'), 'delete button should have descriptive aria-label: ' + html);
  assert.ok(/aria-label="(בטל|סמן) אישור הורה לתלמיד #1"/.test(html), 'consent button should have descriptive aria-label: ' + html);
});

test('a11y: pending unit approve and reject buttons name the unit title', () => {
  const $ = openApp();
  $('unitTitle').value = 'שברים פשוטים';
  $('unitSubject').value = 'MATH';
  $('unitDuration').value = '20';
  $('unitBody').value = 'תרגילים על שברים פשוטים בכיתה';
  $('submitUnit').fire('click');

  const pendingHtml = $('pendingList').innerHTML;
  assert.ok(pendingHtml.includes('aria-label="אשר שברים פשוטים"'), 'approve button should name title: ' + pendingHtml);
  assert.ok(pendingHtml.includes('aria-label="דחה שברים פשוטים"'), 'reject button should name title: ' + pendingHtml);
});

test('a11y: unit submission errors are reported in Hebrew without Latin letters', () => {
  const $ = openApp();
  $('unitTitle').value = '   ';
  $('unitSubject').value = 'MATH';
  $('unitDuration').value = '20';
  $('unitBody').value = 'תוכן כלשהו';
  $('submitUnit').fire('click');

  const status = $('unitStatus');
  assert.ok(status.className.includes('bad'), 'empty title must be rejected');
  assert.doesNotMatch(status.textContent, LATIN, 'error status should not have English letters: ' + status.textContent);
  assert.match(status.textContent, /הכותרת ריקה|כותרת לא תקינה/, status.textContent);
});

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

