'use strict';
// "טען דוגמה" and "טען לטופס לעריכה" write over the units form. A unit typed there and not sent sits in
// no store, so the teacher's text was replaced with no word, under a line that named only the unit loaded
// in its place. The line now says the earlier text is gone; text the queue already holds as it is, or the
// very unit being loaded, is not lost and is not named.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp } = require('../test-support/fake-dom.js');

const GONE = /מה שהיה כתוב בטופס קודם/;

function fill($, title, body) {
  $('unitSubject').value = 'MATH';
  $('unitDuration').value = '20';
  $('unitTitle').value = title;
  $('unitBody').value = body;
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

test('the sample over an unsent unit names the text it replaced', () => {
  const $ = openApp();
  fill($, 'גאומטריה בסיסית', 'משולשים וזוויות.');
  $('unitDemoBtn').fire('click');
  assert.match($('unitStatus').textContent, /הדוגמה מולאה/);
  assert.match($('unitStatus').textContent, GONE);
  assert.match($('unitStatus').textContent, /"גאומטריה בסיסית"/);
  assert.match($('unitStatus').textContent, /לא הוגש ולא נשמר בשום מקום/);
});

test('the sample over an empty form, the sample itself or a unit just sent names nothing', () => {
  const $ = openApp();
  $('unitDemoBtn').fire('click');
  assert.doesNotMatch($('unitStatus').textContent, GONE);
  $('unitDemoBtn').fire('click');
  assert.doesNotMatch($('unitStatus').textContent, GONE);
  fill($, 'גאומטריה בסיסית', 'משולשים וזוויות.');
  $('submitUnit').fire('click');
  $('unitDemoBtn').fire('click');
  assert.doesNotMatch($('unitStatus').textContent, GONE);
});

test('loading a rejected unit for editing over an unsent unit names the text it replaced', () => {
  const $ = openApp();
  fill($, 'שברים', 'פיצה שחולקה ל-8 חלקים שווים.');
  $('submitUnit').fire('click');
  const id = rejectFirst($, 'קצר מדי');
  fill($, 'אחוזים', 'מבצע של 20 אחוז הנחה.');
  revise($, id);
  assert.match($('unitStatus').textContent, /נטענה לטופס/);
  assert.match($('unitStatus').textContent, /"אחוזים"/);
  assert.equal($('unitTitle').value, 'שברים');
});

test('loading a rejected unit over its own unchanged text names nothing, over an unsent edit of it does', () => {
  const $ = openApp();
  fill($, 'שברים', 'פיצה שחולקה ל-8 חלקים שווים.');
  $('submitUnit').fire('click');
  const id = rejectFirst($, 'קצר מדי');
  revise($, id);
  assert.doesNotMatch($('unitStatus').textContent, GONE);
  $('unitBody').value = 'פיצה שחולקה ל-8 חלקים שווים, ועוד שני תרגילים.';
  revise($, id);
  assert.match($('unitStatus').textContent, GONE);
});
