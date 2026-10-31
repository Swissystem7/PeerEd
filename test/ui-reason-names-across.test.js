'use strict';
// A student whose region holds pupils but none with parent consent was told "אז אין עם מי לשדך" - while
// the cross-region card on the same screen offered that student a pupil with consent from another region.
// The line now says "באזור", and a left person the cross-region pass pairs is told so by number and region.
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

test('a student with no consented pupil in the region but a cross-region suggestion: the line names it', () => {
  const $ = openApp();
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);       // #1
  addPupilWithoutConsent($, 'CENTER', ['MATH'], ['SUN_16']);    // #2, no consent
  addPerson($, 'pupil', 'NORTH', ['MATH'], ['SUN_16']);          // #3, consent, another region
  const u = unmatched($);
  assert.doesNotMatch(u, /אז אין עם מי לשדך/, u);
  assert.match(u, /לאף תלמיד באזור אין עדיין אישור הורה, אז באזור אין עם מי לשדך\. בכרטיס "שידוך בין אזורים \(חירום\)" יש הצעה: תלמיד #3 מאזור צפון/, u);
  assert.match(text($('across').innerHTML), /תלמיד #3 \(צפון\) עם סטודנט מלמד #1 \(מרכז\)/);
});

test('the pupil on the other side is told too, by the student number and region', () => {
  const $ = openApp();
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);       // #1
  addPerson($, 'pupil', 'NORTH', ['MATH'], ['SUN_16']);          // #2
  const u = unmatched($);
  assert.match(u, /אין באזור הזה אף סטודנט\. בכרטיס "שידוך בין אזורים \(חירום\)" יש הצעה: סטודנט מלמד #1 מאזור מרכז/, u);
});

test('no cross-region suggestion: no such sentence', () => {
  const $ = openApp();
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);       // #1
  addPupilWithoutConsent($, 'CENTER', ['MATH'], ['SUN_16']);    // #2
  addPerson($, 'pupil', 'NORTH', ['HISTORY'], ['MON_16']);       // #3, nothing in common
  const u = unmatched($);
  assert.match(u, /אז באזור אין עם מי לשדך\./, u);
  assert.doesNotMatch(u, /יש הצעה/, u);
});

