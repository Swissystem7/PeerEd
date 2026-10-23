'use strict';
// The wipe card names three stored things - the roster, the units queue, the lessons log - and its
// armed line counts all three ("יימחקו 7 משתתפים, יחידה אחת ושיעור אחד"). Any save disarms the button,
// and the disarm line said "הרשימה השתנתה" for every one of them: a unit submitted, a unit approved or
// rejected, a lesson logged - with a roster nobody touched. The line now names the stored thing that
// changed, with the wipe card's own three names.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp, press } = require('../test-support/fake-dom.js');

const DISARM_TAIL = ', אז המחיקה בוטלה. לחץ שוב כדי לראות מה יימחק.';

function submitUnit($) {
  $('unitDemoBtn').fire('click');
  $('submitUnit').fire('click');
  assert.doesNotMatch($('unitStatus').className, /bad/, $('unitStatus').textContent);
  const m = /data-approve="([^"]+)"/.exec($('pendingList').innerHTML);
  assert.ok(m, 'a unit waits for approval: ' + $('pendingList').innerHTML);
  return m[1];
}

function approveUnit($, id) {
  press($('pendingList'), 'data-approve', id);
  assert.match($('approvedList').innerHTML, new RegExp(id), 'the unit is approved');
}

function logSession($, unitId) {
  $('nav-sessions').fire('click');
  $('sessionPair').value = '0';
  $('sessionSlot').value = 'SUN_16';
  $('sessionSubject').value = 'MATH';
  $('sessionUnit').value = unitId;
  $('sessionOutcome').value = 'held';
  $('logSession').fire('click');
  assert.match($('sessionStatus').textContent, /^נרשם שיעור/, $('sessionStatus').textContent);
}

function arm($) {
  $('nav-people').fire('click');
  $('wipeBtn').fire('click');
  assert.equal($('wipeBtn').textContent, 'כן, מחק הכול');
  assert.match($('wipeStatus').textContent, /^יימחקו /, $('wipeStatus').textContent);
}

function assertDisarmed($, head) {
  assert.equal($('wipeBtn').textContent, 'מחק הכול מהמכשיר הזה', 'the change disarmed the button');
  assert.equal($('wipeCancel').hidden, true);
  assert.equal($('wipeStatus').textContent, head + DISARM_TAIL);
}

test('a roster change under an armed wipe still says the list changed', () => {
  const $ = openApp();
  $('demoBtn').fire('click');
  arm($);
  press($('peopleList'), 'data-consent', '3');
  assertDisarmed($, 'הרשימה השתנתה');
});

test('a unit submitted under an armed wipe says the units queue changed, not the list', () => {
  const $ = openApp();
  $('demoBtn').fire('click');
  arm($);
  const people = $('peopleList').innerHTML;
  submitUnit($);
  assertDisarmed($, 'תור היחידות השתנה');
  assert.equal($('peopleList').innerHTML, people, 'the roster did not change');
  assert.equal($('wipeStatus').textContent.indexOf('הרשימה'), -1, $('wipeStatus').textContent);
});

test('a unit approved under an armed wipe says the units queue changed', () => {
  const $ = openApp();
  $('demoBtn').fire('click');
  const id = submitUnit($);
  arm($);
  approveUnit($, id);
  assertDisarmed($, 'תור היחידות השתנה');
});

test('a unit rejected under an armed wipe says the units queue changed', () => {
  const $ = openApp();
  $('demoBtn').fire('click');
  const id = submitUnit($);
  arm($);
  $('reason-' + id).value = 'הדוגמה לא מתאימה לכיתה';
  press($('pendingList'), 'data-reject', id);
  assert.match($('rejectedList').innerHTML, new RegExp(id), 'the unit is rejected: ' + $('decideStatus').textContent);
  assertDisarmed($, 'תור היחידות השתנה');
});

test('a lesson logged under an armed wipe says the lessons log changed, not the list', () => {
  const $ = openApp();
  $('demoBtn').fire('click');
  const id = submitUnit($);
  approveUnit($, id);
  arm($);
  const people = $('peopleList').innerHTML;
  logSession($, id);
  assertDisarmed($, 'יומן השיעורים השתנה');
  assert.equal($('peopleList').innerHTML, people, 'the roster did not change');
  assert.equal($('wipeStatus').textContent.indexOf('הרשימה'), -1, $('wipeStatus').textContent);
});

test('after the disarm the next click arms again with the new counts and deletes nothing', () => {
  const $ = openApp();
  $('demoBtn').fire('click');
  const id = submitUnit($);
  approveUnit($, id);
  arm($);
  assert.match($('wipeStatus').textContent, /^יימחקו 7 משתתפים, יחידה אחת ו-0 שיעורים\./, $('wipeStatus').textContent);
  logSession($, id);
  assertDisarmed($, 'יומן השיעורים השתנה');
  $('nav-people').fire('click');
  $('wipeBtn').fire('click');
  assert.equal($('wipeBtn').textContent, 'כן, מחק הכול');
  assert.match($('wipeStatus').textContent, /^יימחקו 7 משתתפים, יחידה אחת ושיעור אחד\./, $('wipeStatus').textContent);
  assert.equal($('peopleList').innerHTML.split('<div class="item">').length - 1, 7, 'nothing was deleted');
});
