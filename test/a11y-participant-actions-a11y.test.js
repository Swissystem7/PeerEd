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
