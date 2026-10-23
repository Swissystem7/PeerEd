'use strict';
// The wipe said "נמחק. במכשיר הזה לא נשאר דבר מהרשימה, מהיחידות ומהיומן" after the lessons report had been
// copied to the clipboard: that report holds the log's counts and unit ids, and it sits in the device's
// clipboard, which the wipe does not empty. Now both clicks name the copied report, the way they name a
// pairs file that went down - and only a copy the browser took counts, not a refused one.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp, press } = require('../test-support/fake-dom.js');

const tick = () => new Promise((resolve) => setImmediate(resolve));

function ready(opts) {
  const $ = openApp(opts);
  $('demoBtn').fire('click');
  $('unitSubject').value = 'MATH';
  $('unitDuration').value = '20';
  $('unitTitle').value = 'שברים פשוטים';
  $('unitBody').value = 'פיצה שחולקה ל-8: כמה זה 3/8 ועוד 2/8?';
  $('submitUnit').fire('click');
  const m = /data-approve="([^"]+)"/.exec($('pendingList').innerHTML);
  assert.ok(m, $('pendingList').innerHTML);
  press($('pendingList'), 'data-approve', m[1]);
  $('nav-sessions').fire('click');
  $('sessionPair').value = '0';
  $('sessionSlot').value = 'SUN_16';
  $('sessionSubject').value = 'MATH';
  $('sessionUnit').value = m[1];
  $('sessionOutcome').value = 'held';
  $('logSession').fire('click');
  assert.match($('sessionStatus').textContent, /^נרשם שיעור/, $('sessionStatus').textContent);
  return $;
}

const CLIP = ' דוח הספירות שהועתק מכאן ללוח בביקור הזה נמצא בלוח של המכשיר, אם לא הועתק מאז משהו אחר מעליו: ' +
  'הכפתור הזה לא מנקה את הלוח - מעתיקים משהו אחר במקומו.';

test('a report the clipboard took is named by both wipe clicks', async () => {
  const $ = ready({ clipboard: 'ok' });
  $('exportReport').fire('click');
  await tick();
  assert.match($('reportStatus').textContent, /הועתק גם ללוח/);
  $('wipeBtn').fire('click');
  const arm = $('wipeStatus').textContent;
  assert.ok(arm.endsWith('.' + CLIP + ' לחץ שוב כדי לאשר, או ביטול.'), arm);
  $('wipeBtn').fire('click');
  assert.equal($('wipeStatus').textContent, 'נמחק. בדפדפן הזה לא נשאר דבר מהרשימה, מהיחידות ומהיומן.' + CLIP);
  // the clipboard still holds it, so a wipe of the now-empty app still says so
  $('wipeBtn').fire('click');
  assert.equal($('wipeStatus').textContent, 'בדפדפן הזה אין משתתפים, יחידות או שיעורים.' + CLIP +
    ' לחץ שוב כדי לנקות בכל זאת את האחסון, או ביטול.');
});

test('a refused copy or no clipboard API leaves the wipe lines as they were', async () => {
  for (const opts of [{ clipboard: 'refuse' }, undefined]) {
    const $ = ready(opts);
    $('exportReport').fire('click');
    await tick();
    assert.doesNotMatch($('reportStatus').textContent, /הועתק/);
    $('wipeBtn').fire('click');
    assert.equal($('wipeStatus').textContent.indexOf('לוח'), -1, $('wipeStatus').textContent);
    $('wipeBtn').fire('click');
    assert.equal($('wipeStatus').textContent, 'נמחק. במכשיר הזה לא נשאר דבר מהרשימה, מהיחידות ומהיומן.');
  }
});

test('a copied report and a downloaded pairs file are both named', async () => {
  const $ = ready({ clipboard: 'ok' });
  $('exportReport').fire('click');
  await tick();
  $('nav-match').fire('click');
  $('runMatch').fire('click');
  $('exportCsv').fire('click');
  $('wipeBtn').fire('click');
  $('wipeBtn').fire('click');
  const line = $('wipeStatus').textContent;
  assert.ok(line.startsWith('נמחק. בדפדפן הזה לא נשאר דבר'), line);
  assert.ok(line.indexOf('peered-pairs.csv') !== -1 && line.endsWith(CLIP), line);
});
