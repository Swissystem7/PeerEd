'use strict';
// For a student, explainUnmatched judges the hour and subject codes over the pupils in the region that
// have parent consent only. The unmatched card said "לאף תלמיד באזור אין מקצוע משותף" - over a pupil
// from the same region on the same card, without consent, who shares that subject. Now the line says it
// counts pupils with consent, and names the ones that would fit and wait only for the consent.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp, addPerson, press, text } = require('../test-support/fake-dom.js');

function addPupilWithoutConsent($, region, subjects, slots) {
  $('role').value = 'pupil';
  $('consentRow').hidden = false;
  $('region').value = region;
  $('consent').checked = false;
  subjects.forEach((s) => press($('subjects'), 'data-subject', s));
  slots.forEach((s) => press($('hours'), 'data-slot', s));
  $('addPerson').fire('click');
  if ($('addStatus').className.includes('bad')) throw new Error('add refused: ' + $('addStatus').textContent);
}
function unmatched($) {
  $('runMatch').fire('click');
  return text($('unmatched').innerHTML);
}

test('a pupil without consent who shares the subject: the student line counts pupils with consent and names #3', () => {
  const $ = openApp();
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);       // #1
  addPerson($, 'pupil', 'CENTER', ['HISTORY'], ['SUN_16']);      // #2, consent, hour only
  addPupilWithoutConsent($, 'CENTER', ['MATH'], ['SUN_16']);    // #3, hour and subject, no consent
  const u = unmatched($);
  assert.doesNotMatch(u, /לאף תלמיד באזור אין מקצוע משותף/, u);
  assert.match(u, /לאף תלמיד עם אישור הורה באזור אין מקצוע משותף\. תלמיד #3 מהאזור חולק איתו שעה ומקצוע ומחכה רק לאישור הורה/, u);
});

test('a pupil without consent who fits in nothing: the line says such pupils are not counted, names nobody', () => {
  const $ = openApp();
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);       // #1
  addPerson($, 'pupil', 'CENTER', ['MATH'], ['MON_16']);         // #2, consent, subject only
  addPupilWithoutConsent($, 'CENTER', ['HISTORY'], ['TUE_16']); // #3, nothing in common
  const u = unmatched($);
  assert.match(u, /אף תלמיד עם אישור הורה באזור לא פנוי באותה שעה\. תלמידים בלי אישור הורה לא נספרים כאן\./, u);
  assert.doesNotMatch(u, /#3 מהאזור/, u);
});

test('no pupil without consent in the region: the old lines stay', () => {
  const $ = openApp();
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);       // #1
  addPerson($, 'pupil', 'CENTER', ['HISTORY'], ['SUN_16']);      // #2
  addPupilWithoutConsent($, 'NORTH', ['MATH'], ['SUN_16']);     // #3, another region
  const u = unmatched($);
  assert.match(u, /לאף תלמיד באזור אין מקצוע משותף\./, u);
  assert.doesNotMatch(u, /עם אישור הורה באזור/, u);
});

test('marking the consent where the line points pairs them', () => {
  const $ = openApp();
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);
  addPerson($, 'pupil', 'CENTER', ['HISTORY'], ['SUN_16']);
  addPupilWithoutConsent($, 'CENTER', ['MATH'], ['SUN_16']);
  assert.match(unmatched($), /תלמיד #3 מהאזור/);
  press($('peopleList'), 'data-consent', '2');  // list #3 is index 2
  $('runMatch').fire('click');
  assert.match(text($('pairs').innerHTML), /סטודנט מלמד #1 עם תלמיד #3/);
});
