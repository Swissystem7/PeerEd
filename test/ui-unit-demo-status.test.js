'use strict';
// "טען דוגמה" on the units screen always fills the same unit. Its line said "לחץ הגש לאישור" even when
// that unit was already waiting, approved or rejected with this very text - and the button then answered
// "כבר בתור" / "כבר מאושרת" / "לא הוגש". Now the line says where the sample stands and what the button
// will do; and the empty pending list no longer says a sample can be "loaded" into it.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp } = require('../test-support/fake-dom.js');

function submitDemoUnit($, body) {
  $('unitDemoBtn').fire('click');
  if (body) $('unitBody').value = body;
  $('submitUnit').fire('click');
  return /מזהה: (\S+)/.exec($('unitStatus').textContent);
}

function approve($, id) {
  $('pendingList').fire('click', { target: { getAttribute: (k) => (k === 'data-approve' ? id : null) } });
}

function rejectFirst($, reason) {
  const id = /data-reject="([^"]+)"/.exec($('pendingList').innerHTML)[1];
  $('reason-' + id).value = reason;
  $('pendingList').fire('click', { target: { getAttribute: (k) => (k === 'data-reject' ? id : null) } });
  return id;
}

test('a fresh sample still says to press submit', () => {
  const $ = openApp();
  $('unitDemoBtn').fire('click');
  assert.equal($('unitStatus').textContent, 'הדוגמה מולאה. לחץ "הגש לאישור".');
});

test('a sample already waiting says submit changes nothing, and submit agrees', () => {
  const $ = openApp();
  submitDemoUnit($);
  $('unitDemoBtn').fire('click');
  const line = $('unitStatus').textContent;
  assert.match(line, /כבר ממתינה לאישור בדיוק בטקסט הזה/, line);
  assert.match(line, /"הגש לאישור" לא ישנה דבר/, line);
  $('submitUnit').fire('click');
  assert.match($('unitStatus').textContent, /כבר בתור, ללא שינוי/);
});

test('an approved sample says so', () => {
  const $ = openApp();
  approve($, submitDemoUnit($)[1]);
  $('unitDemoBtn').fire('click');
  assert.match($('unitStatus').textContent, /כבר אושרה בדיוק בטקסט הזה/);
});

test('a rejected sample says to fix the text by the reason first', () => {
  const $ = openApp();
  submitDemoUnit($);
  rejectFirst($, 'תוכן קצר מדי לשיעור של עשרים דקות');
  $('unitDemoBtn').fire('click');
  const line = $('unitStatus').textContent;
  assert.match(line, /נדחתה בדיוק בטקסט הזה/, line);
  assert.match(line, /מתקנים את הטקסט לפי סיבת הדחייה/, line);
  $('submitUnit').fire('click');
  assert.match($('unitStatus').textContent, /לא הוגש: הטקסט זהה לגרסה שנדחתה/);
});

test('an approved unit with the same id and another text: submit makes the sample the next version', () => {
  const $ = openApp();
  approve($, submitDemoUnit($, 'גוף אחר: שלושה תרגילים עם מכנה משותף.')[1]);
  $('unitDemoBtn').fire('click');
  const line = $('unitStatus').textContent;
  assert.match(line, /כבר אושרה בטקסט אחר/, line);
  assert.match(line, /כגרסה 2 שממתינה לאישור/, line);
  assert.match(line, /עד שתאושר שוב תלמידים לא יראו אותה/, line);
  $('submitUnit').fire('click');
  assert.match($('unitStatus').textContent, /חזרה להמתנה כגרסה 2/);
});

test('the empty pending list says the sample fills the form, not the list', () => {
  const $ = openApp();
  $('unitDemoBtn').fire('click');
  const empty = $('pendingList').innerHTML;
  assert.doesNotMatch(empty, /לטעון דוגמה/);
  assert.match(empty, /"טען דוגמה" ממלא אותו/);
});
