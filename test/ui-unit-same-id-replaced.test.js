'use strict';
// A unit's id is its title, subject and duration, so a unit typed from scratch with those of a unit already
// in the queue replaces that unit's text (approval.submit keeps no old text). The submit line said only
// "הטקסט עודכן, ..." - not which unit, nor that the text it replaced was gone. Now it names the unit and says
// so; a unit loaded by "טען לטופס לעריכה" and sent back is the edit the teacher asked for, and is not named.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp } = require('../test-support/fake-dom.js');

const TITLE = 'שברים פשוטים';

function submitUnit($, body) {
  $('unitSubject').value = 'MATH';
  $('unitDuration').value = '20';
  $('unitTitle').value = TITLE;
  $('unitBody').value = body;
  $('submitUnit').fire('click');
}

test('typing a pending unit\'s title again names the unit whose text was replaced', () => {
  const $ = openApp();
  submitUnit($, 'פיצה שחולקה ל-8 חלקים שווים.');
  submitUnit($, 'עוגה שחולקה ל-6 חלקים שווים.');
  const line = $('unitStatus').textContent;
  assert.match(line, /הטקסט עודכן, היחידה עדיין ממתינה לאישור, עכשיו כגרסה 2\./);
  assert.match(line, /הטקסט הקודם של "שברים פשוטים" \(מזהה [^)]+\), שהייתה בתור, הוחלף בטקסט מהטופס ולא נשמר/);
});

test('an approved unit replaced from scratch is named as approved', () => {
  const $ = openApp();
  submitUnit($, 'פיצה שחולקה ל-8 חלקים שווים.');
  const id = /data-approve="([^"]+)"/.exec($('pendingList').innerHTML)[1];
  $('pendingList').fire('click', { target: { getAttribute: (k) => (k === 'data-approve' ? id : null) } });
  submitUnit($, 'עוגה שחולקה ל-6 חלקים שווים.');
  assert.match($('unitStatus').textContent, /שהייתה מאושרת, הוחלף בטקסט מהטופס ולא נשמר/);
});

test('a rejected unit loaded for editing and sent back is not named as replaced', () => {
  const $ = openApp();
  submitUnit($, 'פיצה שחולקה ל-8 חלקים שווים.');
  const id = /data-reject="([^"]+)"/.exec($('pendingList').innerHTML)[1];
  $('reason-' + id).value = 'חסר תרגול';
  $('pendingList').fire('click', { target: { getAttribute: (k) => (k === 'data-reject' ? id : null) } });
  $('rejectedList').fire('click', { target: { getAttribute: (k) => (k === 'data-revise' ? id : null) } });
  $('unitBody').value = 'פיצה שחולקה ל-8 חלקים שווים, ושלושה תרגילים.';
  $('submitUnit').fire('click');
  const line = $('unitStatus').textContent;
  assert.match(line, /חזרה להמתנה כגרסה 2/);
  assert.doesNotMatch(line, /הטקסט הקודם/);
});

test('a new unit says nothing about a replaced text', () => {
  const $ = openApp();
  submitUnit($, 'פיצה שחולקה ל-8 חלקים שווים.');
  assert.doesNotMatch($('unitStatus').textContent, /הטקסט הקודם/);
});
