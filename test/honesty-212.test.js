'use strict';
// Refs #212: the pitch, the README, the cross-region hint and the sessions banner must say what
// the code does. (1) The pitch record bullet names the retention stamp the code writes itself and
// the three extra lists ACCEPTED_FIELDS accepts. (2) A cross-region offer needs only being left
// without a local pair - not a region with no free student. (3) The sessions banner names the
// result (including "did not happen"), not a lesson that happened.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ACCEPTED_FIELDS } = require('../src/lib/profile.js');
const { openApp, addPerson, text } = require('../test-support/fake-dom.js');

const root = path.join(__dirname, '..');
const pitch = fs.readFileSync(path.join(root, 'docs', 'launch', 'PITCH.md'), 'utf8');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'src', 'app-shell.html'), 'utf8');

test('pitch: the record bullet names the retention stamp and the three extra lists', () => {
  const line = pitch.split(/\r?\n/).find((l) => l.includes('רשומה אחת בלבד'));
  assert.ok(line, 'pitch has a participant-record bullet');
  ['תפקיד', 'אזור', 'שעות', 'מקצועות', 'אישור הורה'].forEach((word) => {
    assert.ok(line.includes(word), word + ': ' + line);
  });
  assert.match(line, /חותמת שמירה/, line);
  ['חסומים', 'דיווחים', 'תגובות לדיווח'].forEach((word) => {
    assert.ok(line.includes(word), word + ': ' + line);
  });
  assert.equal(ACCEPTED_FIELDS.length, 8, ACCEPTED_FIELDS.join(','));
  ['role', 'region', 'availability', 'subjects', 'parentConsent',
    'blockedUsers', 'reportEvent', 'responseToReport'].forEach((field) => {
    assert.ok(ACCEPTED_FIELDS.includes(field), field);
  });
});

test('cross-region: README and hint need left-without-a-local-pair, not a region with no free student', () => {
  assert.ok(!readme.includes('whose region has no free student'), 'old README wording');
  assert.match(readme, /left without a local pair/, readme.slice(readme.indexOf('cross-region') - 200, readme.indexOf('cross-region') + 500));
  assert.match(readme, /share an hour and a subject/, 'shared hour/subject: README');
  assert.match(readme, /parent consent/, 'parent consent: README');
  assert.ok(!shell.includes('תלמיד מאזור שאין בו סטודנט פנוי'), 'old hint wording');
  assert.match(shell, /שנשאר בלי זוג/, 'left without a pair: hint');
});

test('cross-region: a pupil is offered across while an unmatched student sits in their own region', () => {
  const $ = openApp();
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']); // #1: same region, no shared hour
  addPerson($, 'pupil', 'CENTER', ['MATH'], ['MON_16']);   // #2: consented (addPerson ticks it)
  addPerson($, 'student', 'SOUTH', ['MATH'], ['MON_16']);  // #3: shares hour and subject
  $('runMatch').fire('click');
  assert.match(text($('pairs').innerHTML), /לא נוצר אף זוג/, 'no local pair');
  // CENTER does have an unmatched student (#1), so region-with-no-free-student would offer
  // nothing; left-without-a-local-pair offers pupil #2 with student #3.
  assert.match(text($('across').innerHTML), /תלמיד #2 \(מרכז\) עם סטודנט מלמד #3 \(דרום\)/,
    text($('across').innerHTML));
});

test('sessions banner: it records the result, including a lesson that did not happen', () => {
  assert.ok(!shell.includes('רושם שהתקיים שיעור'), 'old banner wording');
  assert.ok(!shell.includes('היחידה המאושרת שנלמדה'), 'old banner wording');
  const at = shell.indexOf('יומן השיעורים רושם');
  assert.ok(at >= 0, 'sessions banner exists');
  assert.match(shell.slice(at, at + 400), /לא התקיים/, shell.slice(at, at + 400));
});
