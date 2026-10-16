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

test('a11y: wipe device controls have aria attributes and manage aria-expanded and focus', () => {
  const currentShell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
  assert.ok(/<button type="button" class="ghost" id="wipeBtn"[^>]*aria-expanded="false"[^>]*aria-controls="wipeCancel wipeStatus"[^>]*aria-describedby="wipeStatus"/.test(currentShell),
    'wipeBtn must have aria-expanded="false", aria-controls="wipeCancel wipeStatus", and aria-describedby="wipeStatus"');
  assert.ok(/<button type="button" class="ghost" id="wipeCancel"[^>]*aria-label="בטל מחיקה מהמכשיר"[^>]*aria-describedby="wipeStatus"/.test(currentShell),
    'wipeCancel must have aria-label="בטל מחיקה מהמכשיר" and aria-describedby="wipeStatus"');

  const $ = openApp();
  assert.equal($('wipeBtn').getAttribute('aria-expanded'), 'false');
  assert.equal($('wipeCancel').hidden, true);

  // Arm wipe
  $('wipeBtn').fire('click');
  assert.equal($('wipeBtn').getAttribute('aria-expanded'), 'true');
  assert.equal($('wipeCancel').hidden, false);

  // Cancel wipe
  $('wipeBtn').focused = false;
  $('wipeCancel').fire('click');
  assert.equal($('wipeBtn').getAttribute('aria-expanded'), 'false');
  assert.equal($('wipeCancel').hidden, true);
  assert.equal($('wipeBtn').focused, true, 'focus must be restored to wipeBtn upon cancellation');
});
