'use strict';
// Granting a pupil's parent consent said "סומן אישור הורה. התלמיד נכנס לשידוך הבא." - and nothing about a
// pairs file already down that lists that pupil under "לא שובצו" with the no-consent reason. Now it says so.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp, addPerson, press } = require('../test-support/fake-dom.js');

const GRANTED = 'סומן אישור הורה. התלמיד נכנס לשידוך הבא.';
const NOTE = ' בקובץ הזוגות שירד קודם הוא עדיין ברשימת "לא שובצו" (תלמיד #2) עם הסיבה שאין אישור הורה: ' +
  'הקובץ לא מתעדכן לבד - לחץ "חשב שידוך" והורד אותו מחדש.';

function setUp($) {
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);   // #1
  addPerson($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);     // #2
  press($('peopleList'), 'data-consent', '1');               // revoke: #2 is left out for consent
}

test('granting a pupil the downloaded file left out for consent says the file still gives that reason', () => {
  const $ = openApp();
  setUp($);
  $('runMatch').fire('click');
  $('exportCsv').fire('click');
  press($('peopleList'), 'data-consent', '1');
  assert.equal($('addStatus').textContent, GRANTED + NOTE);
  press($('peopleList'), 'data-consent', '1');               // revoke, then grant again: the file has not changed
  press($('peopleList'), 'data-consent', '1');
  assert.equal($('addStatus').textContent, GRANTED + NOTE);
});

test('with no file down, or a file that does not leave the pupil out for consent, the line is as before', () => {
  const $ = openApp();
  setUp($);
  press($('peopleList'), 'data-consent', '1');
  assert.equal($('addStatus').textContent, GRANTED);
  $('runMatch').fire('click');
  $('exportCsv').fire('click');                               // the file pairs #2
  press($('peopleList'), 'data-consent', '1');
  press($('peopleList'), 'data-consent', '1');
  assert.equal($('addStatus').textContent, GRANTED);
});

test('a wipe forgets the file', () => {
  const $ = openApp();
  setUp($);
  $('runMatch').fire('click');
  $('exportCsv').fire('click');
  $('wipeBtn').fire('click');
  $('wipeBtn').fire('click');
  setUp($);
  press($('peopleList'), 'data-consent', '1');
  assert.equal($('addStatus').textContent, GRANTED);
});
