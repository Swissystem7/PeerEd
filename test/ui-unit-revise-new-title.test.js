'use strict';
// The rejection line promised "fix it and submit again - it returns to the queue as a new version", and
// the edit button's line said "fix the content and submit". A unit's id is its title, subject and duration
// (unit.js), so that promise holds for a fix to the body only: a teacher told the title was unclear fixed
// the title, and the submit line said "הוגש וממתין לאישור" about a unit that was new, while the rejected one
// stayed in the rejected list with its reason and its edit button - two cards for what the screen had
// called one unit, and nothing said which was which. Now the three lines agree: what keeps the id goes back
// as a version, what changes it is submitted beside the rejected unit, and the submit line names the one
// that stayed.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp } = require('../test-support/fake-dom.js');

const TITLE = 'שברים פשוטים';
const BODY = 'פיצה שחולקה ל-8 חלקים שווים.';

function submitUnit($, title, body, duration) {
  $('unitSubject').value = 'MATH';
  $('unitDuration').value = duration || '20';
  $('unitTitle').value = title;
  $('unitBody').value = body;
  $('submitUnit').fire('click');
}

function rejectFirst($, reason) {
  const id = /data-reject="([^"]+)"/.exec($('pendingList').innerHTML)[1];
  $('reason-' + id).value = reason;
  $('pendingList').fire('click', { target: { getAttribute: (k) => (k === 'data-reject' ? id : null) } });
  return id;
}

function revise($, id) {
  $('rejectedList').fire('click', { target: { getAttribute: (k) => (k === 'data-revise' ? id : null) } });
}

test('the rejection line and the edit line say what keeps the id and what makes a new unit', () => {
  const $ = openApp();
  submitUnit($, TITLE, BODY);
  const id = rejectFirst($, 'הכותרת לא ברורה');
  assert.match($('decideStatus').textContent, /לתקן את התוכן ולהגיש שוב - זה יחזור לתור כגרסה חדשה/);
  assert.match($('decideStatus').textContent, /כותרת, מקצוע או משך אחרים הם יחידה חדשה, והדחויה נשארת ברשימה/);

  revise($, id);
  assert.match($('unitStatus').textContent, /נטענה לטופס/);
  assert.match($('unitStatus').textContent, /תחזור לתור כגרסה חדשה/);
  assert.match($('unitStatus').textContent, /כותרת, מקצוע או משך אחרים הם יחידה חדשה/);
  assert.match($('unitStatus').textContent, /הגרסה שנדחתה תישאר ברשימת הנדחות/);
});

test('a rejected unit sent back with another title is a new unit beside it, and the line says so', () => {
  const $ = openApp();
  submitUnit($, TITLE, BODY);
  const id = rejectFirst($, 'הכותרת לא ברורה');
  revise($, id);
  $('unitTitle').value = 'שברים פשוטים: חיבור וחיסור';
  $('submitUnit').fire('click');

  const line = $('unitStatus').textContent;
  assert.match(line, /^הוגש כיחידה חדשה וממתין לאישור\. מזהה: u-/, line);
  assert.match(line, /"שברים פשוטים" נשארה ברשימת הנדחות כפי שהיא/, line);
  const newId = /מזהה: (u-[0-9a-f]+)/.exec(line)[1];
  assert.notEqual(newId, id);
  assert.match($('pendingList').innerHTML, new RegExp(newId), 'the new unit waits in the queue');
  assert.match($('pendingList').innerHTML, /גרסה 1/);
  assert.match($('rejectedList').innerHTML, new RegExp(id), 'the rejected unit is still there');
  assert.match($('rejectedList').innerHTML, /סיבה: הכותרת לא ברורה/);
  assert.match($('rejectedList').innerHTML, new RegExp('data-revise="' + id + '"'));
});

test('a rejected unit sent back with another duration is a new unit beside it too', () => {
  const $ = openApp();
  submitUnit($, TITLE, BODY);
  const id = rejectFirst($, 'קצר מדי לשיעור');
  revise($, id);
  $('unitDuration').value = '30';
  $('submitUnit').fire('click');
  assert.match($('unitStatus').textContent, /^הוגש כיחידה חדשה/, $('unitStatus').textContent);
  assert.match($('unitStatus').textContent, /נשארה ברשימת הנדחות/);
  assert.match($('rejectedList').innerHTML, new RegExp(id));
});

test('a fix to the body alone is still a version of the rejected unit, with the line as before', () => {
  const $ = openApp();
  submitUnit($, TITLE, BODY);
  const id = rejectFirst($, 'נא להוסיף דוגמה מספרית');
  revise($, id);
  $('unitBody').value = BODY + ' דוגמה: 3/8 ועוד 2/8.';
  $('submitUnit').fire('click');
  assert.match($('unitStatus').textContent, /^הטקסט עודכן, היחידה חזרה להמתנה כגרסה 2\.$/, $('unitStatus').textContent);
  assert.doesNotMatch($('unitStatus').textContent, /נשארה|יחידה אחרת/);
  assert.match($('pendingList').innerHTML, /גרסה 2/);
  assert.match($('rejectedList').innerHTML, /אין יחידות שנדחו/);
});

test('a new title that is an approved unit revises that unit, and the line still names the rejected one', () => {
  const $ = openApp();
  submitUnit($, 'אחוזים', 'מה זה 10% מ-50?');
  const approvedId = /data-approve="([^"]+)"/.exec($('pendingList').innerHTML)[1];
  $('pendingList').fire('click', { target: { getAttribute: (k) => (k === 'data-approve' ? approvedId : null) } });
  submitUnit($, TITLE, BODY);
  const id = rejectFirst($, 'הכותרת לא ברורה');
  revise($, id);
  $('unitTitle').value = 'אחוזים';
  $('submitUnit').fire('click');
  const line = $('unitStatus').textContent;
  assert.match(line, /^הטקסט עודכן, היחידה חזרה להמתנה כגרסה 2\./, line);
  assert.match(line, /זו יחידה אחרת מ"שברים פשוטים", שנשארה ברשימת הנדחות כפי שהיא/, line);
  assert.match($('rejectedList').innerHTML, new RegExp(id));
});

test('after "נקה טופס" or the demo, a new title is just a new unit: nothing about a rejected one', () => {
  const $ = openApp();
  submitUnit($, TITLE, BODY);
  const id = rejectFirst($, 'הכותרת לא ברורה');
  revise($, id);
  $('clearUnitBtn').fire('click');
  submitUnit($, 'משוואות', 'פתרו: 2x + 3 = 11.');
  assert.match($('unitStatus').textContent, /^הוגש וממתין לאישור\. מזהה: u-[0-9a-f]+$/, $('unitStatus').textContent);

  revise($, id);
  $('unitDemoBtn').fire('click');
  $('submitUnit').fire('click');
  assert.match($('unitStatus').textContent, /^הוגש וממתין לאישור\. מזהה: u-[0-9a-f]+$/, $('unitStatus').textContent);
});

test('the rejected unit sent back unchanged is still refused as the same text, not reported as new', () => {
  const $ = openApp();
  submitUnit($, TITLE, BODY);
  const id = rejectFirst($, 'נא להוסיף דוגמה מספרית');
  revise($, id);
  $('submitUnit').fire('click');
  assert.match($('unitStatus').textContent, /^לא הוגש: הטקסט זהה לגרסה שנדחתה/, $('unitStatus').textContent);
  assert.ok($('unitStatus').className.includes('bad'));
});
