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

test('a11y: pending unit approve and reject buttons have id and aria-describedby', () => {
  const $ = openApp();
  $('unitTitle').value = 'שברים פשוטים';
  $('unitSubject').value = 'MATH';
  $('unitDuration').value = '20';
  $('unitBody').value = 'תרגילים על שברים פשוטים בכיתה';
  $('submitUnit').fire('click');

  const pendingHtml = $('pendingList').innerHTML;
  const match = pendingHtml.match(/data-approve="([^"]+)"/);
  assert.ok(match, 'unit id should be present in data-approve');
  const unitId = match[1];

  assert.ok(pendingHtml.includes('id="approveBtn-' + unitId + '"'), 'approve button must have id="approveBtn-<id>"');
  assert.ok(pendingHtml.includes('id="rejectBtn-' + unitId + '"'), 'reject button must have id="rejectBtn-<id>"');
  assert.ok(/id="approveBtn-[^"]*"[^>]*aria-describedby="decideStatus"/.test(pendingHtml),
    'approve button must have aria-describedby="decideStatus"');
  assert.ok(/id="rejectBtn-[^"]*"[^>]*aria-describedby="decideStatus"/.test(pendingHtml),
    'reject button must have aria-describedby="decideStatus"');
  assert.ok(/id="reason-[^"]*"[^>]*aria-describedby="decideStatus"/.test(pendingHtml),
    'reason input must have aria-describedby="decideStatus"');
});

test('a11y: approving a pending unit moves focus to the next unit approve button or submitUnit when empty', () => {
  const $ = openApp();

  // Unit 1
  $('unitTitle').value = 'שברים פשוטים';
  $('unitSubject').value = 'MATH';
  $('unitDuration').value = '20';
  $('unitBody').value = 'תרגילים על שברים פשוטים';
  $('submitUnit').fire('click');

  // Unit 2
  $('unitTitle').value = 'גיאומטריה בסיסית';
  $('unitSubject').value = 'MATH';
  $('unitDuration').value = '30';
  $('unitBody').value = 'משולשים ומרובעים';
  $('submitUnit').fire('click');

  const approveMatches = [...$('pendingList').innerHTML.matchAll(/data-approve="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(approveMatches.length, 2, 'two units should be pending');
  const [id1, id2] = approveMatches;

  // Approve first unit: focus should move to id2's approve button
  $('approveBtn-' + id2).focused = false;
  $('pendingList').fire('click', { target: { getAttribute: (k) => (k === 'data-approve' ? id1 : null) } });
  assert.equal($('approveBtn-' + id2).focused, true, 'focus must move to next pending unit approve button');

  // Approve second unit: pending list is now empty, focus should move to submitUnit
  $('submitUnit').focused = false;
  $('pendingList').fire('click', { target: { getAttribute: (k) => (k === 'data-approve' ? id2 : null) } });
  assert.equal($('submitUnit').focused, true, 'focus must move to submitUnit when all pending units are handled');
});

test('a11y: rejecting a pending unit without reason focuses reason input, and rejecting with reason moves focus', () => {
  const $ = openApp();

  // Unit 1
  $('unitTitle').value = 'שברים פשוטים';
  $('unitSubject').value = 'MATH';
  $('unitDuration').value = '20';
  $('unitBody').value = 'תרגילים על שברים פשוטים';
  $('submitUnit').fire('click');

  // Unit 2
  $('unitTitle').value = 'גיאומטריה בסיסית';
  $('unitSubject').value = 'MATH';
  $('unitDuration').value = '30';
  $('unitBody').value = 'משולשים ומרובעים';
  $('submitUnit').fire('click');

  const rejectMatches = [...$('pendingList').innerHTML.matchAll(/data-reject="([^"]+)"/g)].map((m) => m[1]);
  const [id1, id2] = rejectMatches;

  // Reject without reason: fails, focuses reason input
  $('reason-' + id1).focused = false;
  $('pendingList').fire('click', { target: { getAttribute: (k) => (k === 'data-reject' ? id1 : null) } });
  assert.ok($('decideStatus').className.includes('bad'), 'empty reason must fail');
  assert.match($('decideStatus').textContent, /כתוב סיבה לדחייה/);
  assert.equal($('reason-' + id1).focused, true, 'reason input must be focused on error');

  // Reject with valid reason: succeeds, moves focus to next pending unit approve button
  $('reason-' + id1).value = 'תוכן קצר מדי';
  $('approveBtn-' + id2).focused = false;
  $('pendingList').fire('click', { target: { getAttribute: (k) => (k === 'data-reject' ? id1 : null) } });
  assert.equal($('approveBtn-' + id2).focused, true, 'focus must move to next pending unit approve button');

  // Reject second unit with reason: moves focus to submitUnit
  $('reason-' + id2).value = 'לא מתאים לכיתה';
  $('submitUnit').focused = false;
  $('pendingList').fire('click', { target: { getAttribute: (k) => (k === 'data-reject' ? id2 : null) } });
  assert.equal($('submitUnit').focused, true, 'focus must move to submitUnit when queue becomes empty');
});

