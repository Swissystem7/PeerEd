'use strict';
// When load() refuses the saved document, the participants card says a copy of it was kept beside the
// key "so a new change does not delete it". The wipe button, two cards below, then said the device held
// no participants, units or lessons and offered to "clean the storage anyway" - and the second click
// removed that copy (and the refused document still under the key) without ever naming them. The first
// click now says what is still in the storage, and the line after the wipe says it is gone.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp } = require('../test-support/fake-dom.js');

const KEY = 'peered_app_v1';
const REJECTED_KEY = KEY + ':rejected';
const BAD = '{not json';
const LIST_AND_COPY = 'הנתונים השמורים שנדחו בטעינה והעותק שלהם שנשמר בצד';
const COPY_ONLY = 'העותק שנשמר בצד של הנתונים השמורים שנדחו בטעינה';
const LIST_ONLY = 'הנתונים השמורים שנדחו בטעינה';

function openRefused(opts) {
  const store = {};
  store[KEY] = BAD;
  return openApp(Object.assign({ store: store }, opts || {}));
}

test('an empty screen over a refused document: the first click names the document and its copy, the second removes both and says so', () => {
  const $ = openRefused();
  assert.match($('addStatus').textContent, /עותק שלהם נשמר בצד/, 'the participants card promised the copy');
  assert.equal($.store[REJECTED_KEY], BAD);

  $('wipeBtn').fire('click');
  const armed = $('wipeStatus').textContent;
  assert.match(armed, /^על המסך אין משתתפים, יחידות או שיעורים, אבל באחסון עדיין יש /, armed);
  assert.ok(armed.indexOf(LIST_AND_COPY) !== -1, armed);
  assert.doesNotMatch(armed, /אין במכשיר הזה|בכל זאת/, armed);
  assert.equal($.store[KEY], BAD, 'the first click deletes nothing');
  assert.equal($.store[REJECTED_KEY], BAD);

  $('wipeBtn').fire('click');
  assert.equal(KEY in $.store, false, 'the refused document is gone');
  assert.equal(REJECTED_KEY in $.store, false, 'and so is its copy');
  const done = $('wipeStatus').textContent;
  assert.match(done, /^נמחק\. /, done);
  assert.ok(done.indexOf('גם ' + LIST_AND_COPY + ' כבר לא באחסון.') !== -1, done);
  assert.equal($('wipeStatus').className, 'status');

  // armed again on a device that now holds nothing: the plain line, nothing left to name
  $('wipeBtn').fire('click');
  assert.match($('wipeStatus').textContent, /^אין במכשיר הזה משתתפים, יחידות או שיעורים\./, $('wipeStatus').textContent);
});

test('after a save wrote over the refused document, only its copy is left, and the counts line names that copy', () => {
  const $ = openRefused();
  $('demoBtn').fire('click');
  assert.notEqual($.store[KEY], BAD, 'the save wrote the roster over the refused document');
  assert.equal($.store[REJECTED_KEY], BAD, 'the copy is still beside it');

  $('wipeBtn').fire('click');
  const armed = $('wipeStatus').textContent;
  assert.match(armed, /^יימחקו 7 משתתפים, 0 יחידות ו-0 שיעורים, ואיתם גם /, armed);
  assert.ok(armed.indexOf(COPY_ONLY) !== -1, armed);
  assert.ok(armed.indexOf(LIST_AND_COPY) === -1, 'the document itself is no longer under the key: ' + armed);
  assert.match(armed, /\. לחץ שוב כדי לאשר, או ביטול\.$/, armed);

  $('wipeBtn').fire('click');
  assert.equal(KEY in $.store, false);
  assert.equal(REJECTED_KEY in $.store, false);
  assert.ok($('wipeStatus').textContent.indexOf('גם ' + COPY_ONLY + ' כבר לא באחסון.') !== -1, $('wipeStatus').textContent);
});

test('when the browser refused to write the copy, only the refused document is named - no copy that was never kept', () => {
  const $ = openRefused({ saveFails: true });
  assert.match($('addStatus').textContent, /לא אפשר לשמור עותק/, $('addStatus').textContent);
  assert.equal(REJECTED_KEY in $.store, false);

  $('wipeBtn').fire('click');
  const armed = $('wipeStatus').textContent;
  assert.ok(armed.indexOf('אבל באחסון עדיין יש ' + LIST_ONLY + '.') !== -1, armed);
  assert.ok(armed.indexOf('העותק') === -1, armed);

  // a failed save leaves the refused document under the key, so it is still named with the counts
  $('wipeCancel').fire('click');
  $('demoBtn').fire('click');
  assert.equal($.store[KEY], BAD, 'the save failed, the refused document is still there');
  $('wipeBtn').fire('click');
  const counted = $('wipeStatus').textContent;
  assert.match(counted, /^יימחקו 7 משתתפים/, counted);
  assert.ok(counted.indexOf(', ואיתם גם ' + LIST_ONLY + '.') !== -1, counted);
});

test('cancel keeps the refused document and its copy, like everything else', () => {
  const $ = openRefused();
  $('wipeBtn').fire('click');
  $('wipeCancel').fire('click');
  assert.equal($('wipeStatus').textContent, 'בוטל. לא נמחק דבר.');
  assert.equal($.store[KEY], BAD);
  assert.equal($.store[REJECTED_KEY], BAD);
});

test('with no refused document the wipe lines read exactly as before', () => {
  const $ = openApp();
  $('wipeBtn').fire('click');
  assert.equal($('wipeStatus').textContent, 'אין במכשיר הזה משתתפים, יחידות או שיעורים. לחץ שוב כדי לנקות בכל זאת את האחסון, או ביטול.');
  $('wipeCancel').fire('click');
  $('demoBtn').fire('click');
  $('wipeBtn').fire('click');
  assert.equal($('wipeStatus').textContent, 'יימחקו 7 משתתפים, 0 יחידות ו-0 שיעורים. לחץ שוב כדי לאשר, או ביטול.');
  $('wipeBtn').fire('click');
  assert.equal($('wipeStatus').textContent, 'נמחק. במכשיר הזה לא נשאר דבר מהרשימה, מהיחידות ומהיומן.');
});
