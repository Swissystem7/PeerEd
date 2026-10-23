'use strict';
// The wipe's first click counted participants, units and lessons, and the second click also emptied the
// units form - so a unit a teacher had typed and not sent was gone, though no line had named it. Now both
// clicks name it; a unit the form still shows after it was sent is in the queue and is not named.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp } = require('../test-support/fake-dom.js');

const UNSENT = 'בטופס במסך "יחידות" יש יחידה שלא הוגשה';
const GONE = 'גם יחידה שהייתה בטופס במסך "יחידות" ולא הוגשה נמחקה מהטופס.';

function typeUnit($) {
  $('unitSubject').value = 'MATH';
  $('unitDuration').value = '20';
  $('unitTitle').value = 'שברים פשוטים';
  $('unitBody').value = 'פיצה שחולקה ל-8: כמה זה 3/8 ועוד 2/8?';
}

test('an unsent unit in the form is named by both wipe clicks', () => {
  const $ = openApp();
  $('demoBtn').fire('click');
  typeUnit($);
  $('wipeBtn').fire('click');
  assert.match($('wipeStatus').textContent, /^יימחקו 7 משתתפים/);
  assert.ok($('wipeStatus').textContent.includes(UNSENT), $('wipeStatus').textContent);
  $('wipeBtn').fire('click');
  assert.ok($('wipeStatus').textContent.includes(GONE), $('wipeStatus').textContent);
  assert.equal($('unitBody').value, '');
});

test('on an empty device an unsent unit is still named', () => {
  const $ = openApp();
  $('unitBody').value = 'טיוטה';
  $('wipeBtn').fire('click');
  assert.match($('wipeStatus').textContent, /^אין במכשיר הזה משתתפים, יחידות או שיעורים\./);
  assert.ok($('wipeStatus').textContent.includes(UNSENT), $('wipeStatus').textContent);
});

test('a unit typed after the first click is named by the second', () => {
  const $ = openApp();
  $('demoBtn').fire('click');
  $('wipeBtn').fire('click');
  assert.ok(!$('wipeStatus').textContent.includes(UNSENT), $('wipeStatus').textContent);
  typeUnit($);
  $('wipeBtn').fire('click');
  assert.ok($('wipeStatus').textContent.includes(GONE), $('wipeStatus').textContent);
});

test('a unit already sent and still in the form is not named', () => {
  const $ = openApp();
  typeUnit($);
  $('submitUnit').fire('click');
  assert.match($('unitStatus').textContent, /^הוגש/);
  $('wipeBtn').fire('click');
  assert.match($('wipeStatus').textContent, /^יימחקו 0 משתתפים, יחידה אחת/);
  assert.ok(!$('wipeStatus').textContent.includes(UNSENT), $('wipeStatus').textContent);
  $('wipeBtn').fire('click');
  assert.ok(!$('wipeStatus').textContent.includes(GONE), $('wipeStatus').textContent);
});

test('a sent unit whose text was then changed in the form is named', () => {
  const $ = openApp();
  typeUnit($);
  $('submitUnit').fire('click');
  $('unitBody').value += ' ועוד תרגיל.';
  $('wipeBtn').fire('click');
  assert.ok($('wipeStatus').textContent.includes(UNSENT), $('wipeStatus').textContent);
});
