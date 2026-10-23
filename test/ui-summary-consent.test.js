'use strict';
// The summary's "missing students" list tells a coordinator where to recruit. A pupil left out only
// because a parent has not said yes is not short of a student - a new student would not be paired with
// them either - so they are counted apart and never put a region/subject on that list.
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

test('a pupil waiting for parent consent is not counted as missing a student', () => {
  const $ = openApp();
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);
  addPerson($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);
  addPupilWithoutConsent($, 'NORTH', ['HISTORY'], ['THU_16']);
  $('runMatch').fire('click');
  const s = text($('summary').innerHTML);
  assert.match(s, /0 תלמידים בלי סטודנט/, s);
  assert.match(s, /תלמיד אחד מחכה לאישור הורה, וגם אין באזור שלו סטודנט שחולק איתו שעה ומקצוע: אחרי האישור הוא יחכה גם לסטודנט\./, s);
  assert.doesNotMatch(s, /לא לסטודנט/, s);
  assert.doesNotMatch(s, /חסרים סטודנטים \(/, s);
});

test('pupils short of a student are still listed next to the ones waiting for consent', () => {
  const $ = openApp();
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);
  addPerson($, 'pupil', 'SOUTH', ['ENGLISH'], ['MON_16']);
  addPupilWithoutConsent($, 'NORTH', ['HISTORY'], ['THU_16']);
  addPupilWithoutConsent($, 'NORTH', ['HISTORY'], ['THU_16']);
  $('runMatch').fire('click');
  const s = text($('summary').innerHTML);
  assert.match(s, /2 תלמידים מחכים לאישור הורה, וגם אין באזור שלהם סטודנט שחולק איתם שעה ומקצוע: אחרי האישור הם יחכו גם לסטודנט\./, s);
  assert.match(s, /חסרים סטודנטים/, s);
  assert.match(s, /אנגלית: 1/, s);
  assert.doesNotMatch(s, /היסטוריה/, s);
});

// "לא לסטודנט" was said of every such pupil, also of one with no student in the region who shares an
// hour and a subject with them: after the consent that pupil is still left out, for want of a student.
test('a pupil waiting for consent with a fitting student in the region is told apart', () => {
  const $ = openApp();
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);
  addPerson($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);
  addPupilWithoutConsent($, 'CENTER', ['MATH'], ['SUN_16']);
  addPupilWithoutConsent($, 'NORTH', ['HISTORY'], ['THU_16']);
  $('runMatch').fire('click');
  const s = text($('summary').innerHTML);
  assert.match(s, /תלמיד אחד מחכה לאישור הורה; באזור שלו יש סטודנט שחולק איתו שעה ומקצוע\./, s);
  assert.match(s, /תלמיד אחד מחכה לאישור הורה, וגם אין באזור שלו סטודנט/, s);
  assert.doesNotMatch(s, /לא לסטודנט/, s);
});

test('the demo pupil in Jerusalem, a region with no student, is not told it waits only for consent', () => {
  const $ = openApp();
  $('demoBtn').fire('click');
  $('runMatch').fire('click');
  const s = text($('summary').innerHTML);
  assert.match(s, /תלמיד אחד מחכה לאישור הורה, וגם אין באזור שלו סטודנט שחולק איתו שעה ומקצוע/, s);
  assert.doesNotMatch(s, /לא לסטודנט/, s);
  assert.doesNotMatch(s, /באזור שלו יש סטודנט/, s);
});
