'use strict';
// The wipe button when the browser hands out no storage (site data blocked, a sandboxed frame, some
// private modes). The shell then works on a memory store, and store.clear() on it "succeeds" - so the
// wipe said "נמחק. במכשיר הזה לא נשאר דבר מהרשימה, מהיחידות ומהיומן" about a device it never reached,
// a minute after load() said, on the same screen, that a list saved here on an earlier visit could
// not be read. Two lines, one storage, two different promises. Now both clicks say what the wipe can
// and cannot touch: what is on the screen sits in memory for this visit and goes, and a list saved
// before, if there is one, stays until the browser's own site data is cleared. The screen is still
// emptied either way.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp, press } = require('../test-support/fake-dom.js');

const LEFTOVER = /רשימה שנשמרה כאן בביקור קודם, אם יש כזו, לא נמחקה: נקה את נתוני האתר בהגדרות הדפדפן\./;

function fillDevice($) {
  $('demoBtn').fire('click');
  $('unitDemoBtn').fire('click');
  $('submitUnit').fire('click');
  const unitId = $('pendingList').innerHTML.match(/data-approve="([^"]+)"/)[1];
  press($('pendingList'), 'data-approve', unitId);
  $('nav-sessions').fire('click');
  $('sessionPair').value = '0';
  $('sessionSlot').value = 'SUN_16';
  $('sessionSubject').value = 'MATH';
  $('sessionUnit').value = unitId;
  $('sessionOutcome').value = 'held';
  $('logSession').fire('click');
  assert.match($('sessionStatus').textContent, /^נרשם שיעור 1\. /, $('sessionStatus').textContent);
}

test('the first click on a filled screen counts what goes, and says it goes from memory only', () => {
  const $ = openApp({ noStorage: true });
  fillDevice($);
  $('wipeBtn').fire('click');
  const line = $('wipeStatus').textContent;
  assert.match(line, /^יימחקו 7 משתתפים, יחידה אחת ושיעור אחד - מהזיכרון בלבד, כי הדפדפן לא מאפשר אחסון מקומי ובאחסון הם לא נשמרו\. לחץ שוב כדי לאשר, או ביטול\.$/, line);
  assert.equal($('wipeBtn').textContent, 'כן, מחק הכול', 'the click still arms the button');
  assert.equal($('wipeCancel').hidden, false);
});

test('the second click empties the screen and names the storage it could not reach, not "nothing is left on this device"', () => {
  const $ = openApp({ noStorage: true });
  fillDevice($);
  $('wipeBtn').fire('click');
  $('wipeBtn').fire('click');
  const line = $('wipeStatus').textContent;
  assert.match(line, /^נמחק מהמסך ומהזיכרון\. הדפדפן לא מאפשר אחסון מקומי, אז /, line);
  assert.match(line, LEFTOVER, line);
  assert.equal(line.indexOf('לא נשאר דבר'), -1, line);
  assert.equal($('wipeStatus').className, 'status bad', 'a device the wipe could not reach is a warning, like a key the browser refused to remove');
  assert.ok($('peopleList').innerHTML.indexOf('אין עדיין משתתפים') !== -1, 'the roster is off the screen');
  assert.equal($('approvedList').innerHTML.indexOf('<div class="item'), -1, 'and so are the units');
  assert.ok($('sessionList').innerHTML.indexOf('היומן ריק') !== -1, 'and the log');
  assert.equal($('wipeBtn').textContent, 'מחק הכול מהמכשיר הזה');
  assert.equal($('wipeCancel').hidden, true);
  assert.equal(Object.keys($.store).length, 0, 'nothing was ever written anywhere');
});

test('the first click on an empty screen says there is nothing to wipe from here and where an earlier list would be', () => {
  const $ = openApp({ noStorage: true });
  $('wipeBtn').fire('click');
  const line = $('wipeStatus').textContent;
  assert.match(line, /^על המסך אין משתתפים, יחידות או שיעורים, והדפדפן לא מאפשר אחסון מקומי, אז מכאן אין מה למחוק\. /, line);
  assert.match(line, LEFTOVER, line);
  assert.match(line, /לחץ שוב כדי לנקות בכל זאת את הזיכרון, או ביטול\.$/, line);
  assert.equal(line.indexOf('אין במכשיר הזה'), -1, 'the device is not described as empty: ' + line);
  $('wipeBtn').fire('click');
  assert.match($('wipeStatus').textContent, /^נמחק מהמסך ומהזיכרון\. /, $('wipeStatus').textContent);
});

test('the load line and the wipe line now agree about a list saved on an earlier visit', () => {
  const $ = openApp({ noStorage: true });
  const loadLine = $('addStatus').textContent;
  assert.match(loadLine, /רשימה שנשמרה כאן קודם לא נטענה/, loadLine);
  $('demoBtn').fire('click');
  $('wipeBtn').fire('click');
  $('wipeBtn').fire('click');
  const wipeLine = $('wipeStatus').textContent;
  assert.match(wipeLine, /רשימה שנשמרה כאן בביקור קודם, אם יש כזו, לא נמחקה/, wipeLine);
});

test('with the storage available the wipe lines are unchanged', () => {
  const $ = openApp();
  $('demoBtn').fire('click');
  $('wipeBtn').fire('click');
  assert.match($('wipeStatus').textContent, /^יימחקו 7 משתתפים, 0 יחידות ו-0 שיעורים\. לחץ שוב כדי לאשר, או ביטול\.$/, $('wipeStatus').textContent);
  $('wipeBtn').fire('click');
  assert.equal($('wipeStatus').textContent, 'נמחק. במכשיר הזה לא נשאר דבר מהרשימה, מהיחידות ומהיומן.');
  assert.equal($('wipeStatus').className, 'status');
  const again = openApp();
  again('wipeBtn').fire('click');
  assert.equal(again('wipeStatus').textContent, 'אין במכשיר הזה משתתפים, יחידות או שיעורים. לחץ שוב כדי לנקות בכל זאת את האחסון, או ביטול.');
});

test('a storage that is there but refuses one write is not a blocked storage: its wipe still removes the key and says so', () => {
  const $ = openApp({ saveFails: true });
  $('demoBtn').fire('click');
  $('wipeBtn').fire('click');
  $('wipeBtn').fire('click');
  assert.equal($('wipeStatus').textContent, 'נמחק. במכשיר הזה לא נשאר דבר מהרשימה, מהיחידות ומהיומן.');
  assert.equal($('wipeStatus').className, 'status');
});
