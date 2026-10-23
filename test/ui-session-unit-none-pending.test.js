'use strict';
// With no approved unit in the pair's subject, the lessons form's unit option said "אשר אחת במסך יחידות"
// whatever the queue held: over a pending list with nothing in that subject it sent the coordinator to
// approve a unit that is not there. Now it counts the units waiting in that subject, or says none waits.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp, addPerson } = require('../test-support/fake-dom.js');

function unitOption($) {
  $('nav-sessions').fire('click');
  $('sessionSubject').value = 'MATH';
  $('sessionSubject').fire('change');
  return $('sessionUnit').innerHTML;
}

function submit($, title) {
  $('unitSubject').value = 'MATH';
  $('unitDuration').value = '20';
  $('unitTitle').value = title;
  $('unitBody').value = 'פותחים בדוגמה מהחיים ואחר כך שלושה תרגילים מפרק 12.';
  $('submitUnit').fire('click');
}

function pair($) {
  addPerson($, 'student', 'NORTH', ['MATH'], ['SUN_16']);
  addPerson($, 'pupil', 'NORTH', ['MATH'], ['SUN_16']);
}

test('nothing in the queue: the option says none waits and that one is submitted and approved', () => {
  const $ = openApp();
  pair($);
  const html = unitOption($);
  assert.match(html, /אין יחידה מאושרת במקצוע הזה, ואף אחת לא ממתינה לאישור - מגישים יחידה במקצוע הזה במסך יחידות ומאשרים אותה/, html);
  assert.equal(html.indexOf('אשר אחת'), -1, html);
  assert.equal($('sessionUnit').disabled, true);
});

test('one unit waiting in the subject: the option says one waits', () => {
  const $ = openApp();
  pair($);
  submit($, 'שברים פשוטים');
  const html = unitOption($);
  assert.match(html, /אין יחידה מאושרת במקצוע הזה - אחת ממתינה לאישור במסך יחידות/, html);
});

test('two units waiting in the subject: the option counts them', () => {
  const $ = openApp();
  pair($);
  submit($, 'שברים פשוטים');
  submit($, 'אחוזים');
  assert.match(unitOption($), /- 2 ממתינות לאישור במסך יחידות/);
});

test('a unit waiting in another subject is not counted for this one', () => {
  const $ = openApp();
  pair($);
  $('unitSubject').value = 'HEBREW';
  $('unitTitle').value = 'הבנת הנקרא';
  $('unitBody').value = 'קוראים קטע קצר ועונים על שלוש שאלות.';
  $('submitUnit').fire('click');
  assert.match(unitOption($), /ואף אחת לא ממתינה לאישור/);
});
