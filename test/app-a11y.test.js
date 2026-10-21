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

test('a11y: pending unit rejection reason input has descriptive label naming the title, aria-label, and placeholder', () => {
  const $ = openApp();
  $('unitTitle').value = 'שברים פשוטים';
  $('unitSubject').value = 'MATH';
  $('unitDuration').value = '20';
  $('unitBody').value = 'תרגילים על שברים פשוטים בכיתה';
  $('submitUnit').fire('click');

  const pendingHtml = $('pendingList').innerHTML;
  assert.ok(pendingHtml.includes('סיבת דחייה עבור שברים פשוטים (חובה רק לדחייה)'), 'label must name unit title');
  assert.ok(pendingHtml.includes('aria-label="סיבת דחייה עבור שברים פשוטים"'), 'input must have aria-label');
  assert.ok(pendingHtml.includes('placeholder="לדוגמה: תוכן קצר מדי או לא מתאים לרמת הכיתה"'), 'input must have placeholder');
});

test('a11y: rejecting a pending unit without a reason focuses the reason input and reports Hebrew error', () => {
  const $ = openApp();
  $('unitTitle').value = 'שברים פשוטים';
  $('unitSubject').value = 'MATH';
  $('unitDuration').value = '20';
  $('unitBody').value = 'תרגילים על שברים פשוטים בכיתה';
  $('submitUnit').fire('click');

  const rejectBtn = $('pendingList').innerHTML.match(/data-reject="([^"]+)"/);
  assert.ok(rejectBtn, 'reject button must exist in pendingList');
  const unitId = rejectBtn[1];

  $('pendingList').fire('click', { target: { getAttribute: (attr) => (attr === 'data-reject' ? unitId : null) } });

  const status = $('decideStatus');
  assert.ok(status.className.includes('bad'), 'rejection without reason must fail');
  assert.match(status.textContent, /כתוב סיבה לדחייה/);
  assert.equal($('reason-' + unitId).focused, true, 'reason input must be focused on error');
});

test('a11y: dynamic match result regions have role="region", aria-live="polite", and aria-label', () => {
  assert.ok(/<div id="summary"[^>]*role="region"[^>]*aria-live="polite"[^>]*aria-label="סיכום לרשות"/.test(shell),
    'summary must have role="region", aria-live="polite", and aria-label="סיכום לרשות"');
  assert.ok(/<div id="pairs"[^>]*role="region"[^>]*aria-live="polite"[^>]*aria-label="רשימת הזוגות"/.test(shell),
    'pairs must have role="region", aria-live="polite", and aria-label="רשימת הזוגות"');
  assert.ok(/<div id="unmatched"[^>]*role="region"[^>]*aria-live="polite"[^>]*aria-label="מי נשאר בלי זוג"/.test(shell),
    'unmatched must have role="region", aria-live="polite", and aria-label="מי נשאר בלי זוג"');
  assert.ok(/<div id="across"[^>]*role="region"[^>]*aria-live="polite"[^>]*aria-label="שידוך בין אזורים \(חירום\)"/.test(shell),
    'across must have role="region", aria-live="polite", and aria-label="שידוך בין אזורים (חירום)"');
});

test('a11y: participant action buttons have aria-pressed and aria-describedby', () => {
  const $ = openApp();
  addPerson($, 'pupil', 'NORTH', ['MATH'], ['SUN_16']);
  const html = $('peopleList').innerHTML;
  assert.ok(/id="consentBtn-0"[^>]*data-consent="0"[^>]*aria-pressed="true"[^>]*aria-describedby="addStatus"/.test(html),
    'consent button should have id, data-consent, aria-pressed="true", and aria-describedby="addStatus"');
  assert.ok(/id="delBtn-0"[^>]*data-del="0"[^>]*aria-describedby="addStatus"/.test(html),
    'delete button should have id, data-del, and aria-describedby="addStatus"');
});

test('a11y: toggling parent consent restores focus to the re-rendered consent button', () => {
  const $ = openApp();
  addPerson($, 'pupil', 'NORTH', ['MATH'], ['SUN_16']);
  $('consentBtn-0').focused = false;
  $('peopleList').fire('click', { target: { getAttribute: (k) => (k === 'data-consent' ? '0' : null) } });

  assert.equal($('consentBtn-0').focused, true, 'consent button must regain focus after toggle');
  assert.ok($('peopleList').innerHTML.includes('aria-pressed="false"'), 'aria-pressed should flip to false when consent is revoked');
});

test('a11y: deleting a participant moves focus to the next delete button or addPerson when empty', () => {
  const $ = openApp();
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);
  addPerson($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);

  // Delete first participant (student, index 0). Next participant is at index 0.
  $('delBtn-0').focused = false;
  $('peopleList').fire('click', { target: { getAttribute: (k) => (k === 'data-del' ? '0' : null) } });
  assert.equal($('delBtn-0').focused, true, 'delBtn-0 must receive focus after first person is deleted');

  // Delete remaining participant (index 0). List becomes empty, focus moves to addPerson.
  $('addPerson').focused = false;
  $('peopleList').fire('click', { target: { getAttribute: (k) => (k === 'data-del' ? '0' : null) } });
  assert.equal($('addPerson').focused, true, 'addPerson must receive focus when the last person is deleted');
});

