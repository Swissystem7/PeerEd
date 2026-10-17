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

test('a11y: subject chips have unique IDs and aria-pressed attributes', () => {
  const $ = openApp();
  const subjectsHtml = $('subjects').innerHTML;
  for (const s of ['MATH', 'PHYSICS', 'CHEMISTRY', 'BIOLOGY', 'ENGLISH', 'HEBREW', 'HISTORY', 'CS']) {
    const pattern = new RegExp('<button type="button" class="chip" id="subjectBtn-' + s + '" data-subject="' + s + '" aria-pressed="false">');
    assert.ok(pattern.test(subjectsHtml), 'subject ' + s + ' must have button with id and aria-pressed="false"');
  }
});

test('a11y: hours grid slot buttons have unique IDs, aria-describedby pointing to hoursHint, and aria-label', () => {
  const $ = openApp();
  const hoursHtml = $('hours').innerHTML;
  const match = hoursHtml.match(/id="slotBtn-SUN_16"[^>]*data-slot="SUN_16"[^>]*aria-pressed="false"[^>]*aria-describedby="hoursHint"[^>]*aria-label="יום א 16:00"/);
  assert.ok(match, 'slot SUN_16 button must have unique id, aria-pressed, aria-describedby="hoursHint", and aria-label');
  assert.ok(hoursHtml.includes('id="slotBtn-MON_9"'), 'slot MON_9 button must have id="slotBtn-MON_9"');
});

test('a11y: toggling a subject chip updates aria-pressed and toggles selection', () => {
  const $ = openApp();
  const chipTarget = {
    getAttribute(k) { return k === 'data-subject' ? 'MATH' : null; },
    setAttribute(k, v) { this[k] = String(v); }
  };
  $('subjects').fire('click', { target: chipTarget });
  assert.equal(chipTarget['aria-pressed'], 'true', 'aria-pressed should become true when selected');

  $('subjects').fire('click', { target: chipTarget });
  assert.equal(chipTarget['aria-pressed'], 'false', 'aria-pressed should become false when deselected');
});

test('a11y: toggling an hour slot button updates aria-pressed and toggles selection', () => {
  const $ = openApp();
  const slotTarget = {
    getAttribute(k) { return k === 'data-slot' ? 'SUN_16' : null; },
    setAttribute(k, v) { this[k] = String(v); }
  };
  $('hours').fire('click', { target: slotTarget });
  assert.equal(slotTarget['aria-pressed'], 'true', 'aria-pressed should become true when selected');

  $('hours').fire('click', { target: slotTarget });
  assert.equal(slotTarget['aria-pressed'], 'false', 'aria-pressed should become false when deselected');
});

