'use strict';
// The pending list is rebuilt on every decision and every submit. A rebuilt reason box was empty, so a
// reason typed for one unit was gone after "אשר" on another, and "דחה" then said "כתוב סיבה לדחייה" over a
// reason the approver had written. The typed reason is now written back into the rebuilt box - for the
// same version of the unit only: a revised unit is new text and starts with an empty box.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp } = require('../test-support/fake-dom.js');

function submit($, title, body) {
  $('unitSubject').value = 'MATH';
  $('unitDuration').value = '20';
  $('unitTitle').value = title;
  $('unitBody').value = body;
  $('submitUnit').fire('click');
  const m = /מזהה: (\S+)/.exec($('unitStatus').textContent);
  return m && m[1];
}

function decide($, attr, id) {
  $('pendingList').fire('click', { target: { getAttribute: (k) => (k === attr ? id : null) } });
}

function boxMarkup($, id) {
  const m = new RegExp('<input id="reason-' + id + '"[^>]*>').exec($('pendingList').innerHTML);
  assert.ok(m, 'a reason box for ' + id);
  return m[0];
}

test('a reason typed for one unit stays in its box after another unit is approved', () => {
  const $ = openApp();
  const a = submit($, 'שברים', 'שלושה תרגילים בשברים פשוטים.');
  const b = submit($, 'אחוזים', 'שלושה תרגילים באחוזים.');
  $('reason-' + a).value = 'קצר מדי לשיעור של עשרים דקות';
  decide($, 'data-approve', b);
  assert.match($('decideStatus').textContent, /^אושר/);
  assert.match(boxMarkup($, a), /value="קצר מדי לשיעור של עשרים דקות"/);

  decide($, 'data-reject', a);
  assert.match($('decideStatus').textContent, /^נדחה עם סיבה/, $('decideStatus').textContent);
  assert.match($('rejectedList').innerHTML, /סיבה: קצר מדי לשיעור של עשרים דקות/);
});

test('a reason typed for one unit stays after a new unit is submitted', () => {
  const $ = openApp();
  const a = submit($, 'שברים', 'שלושה תרגילים בשברים פשוטים.');
  $('reason-' + a).value = 'חסרה דוגמה';
  submit($, 'אחוזים', 'שלושה תרגילים באחוזים.');
  assert.match(boxMarkup($, a), /value="חסרה דוגמה"/);
});

test('a revised unit starts with an empty reason box', () => {
  const $ = openApp();
  const a = submit($, 'שברים', 'שלושה תרגילים בשברים פשוטים.');
  $('reason-' + a).value = 'חסרה דוגמה';
  submit($, 'שברים', 'דוגמה מהחיים ואז שלושה תרגילים בשברים פשוטים.');
  assert.match($('unitStatus').textContent, /כגרסה 2/);
  assert.match(boxMarkup($, a), /value=""/);
  assert.equal($('reason-' + a).value, '');
});
