'use strict';
// The wipe said "נמחק. במכשיר הזה לא נשאר דבר מהרשימה" after a pairs file had gone down: that file is the
// match result of the list, by list number, and it sits in the device's downloads, out of the reach of
// the browser storage the wipe clears. Now both clicks name the file(s) that went down in this visit.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { openApp, press, addPerson, ROOT } = require('../test-support/fake-dom.js');

function pairUp($) {
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);
  addPerson($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);
  $('runMatch').fire('click');
}

const ONE = ' קובץ הזוגות peered-pairs.csv שירד מכאן בביקור הזה נמצא בהורדות של המכשיר, מחוץ לדפדפן: ' +
  'הכפתור הזה לא מוחק אותו - מוחקים אותו מההורדות.';

test('without a download the wipe lines stay as they were', () => {
  const $ = openApp();
  pairUp($);
  $('wipeBtn').fire('click');
  assert.equal($('wipeStatus').textContent, 'יימחקו 2 משתתפים, 0 יחידות ו-0 שיעורים. לחץ שוב כדי לאשר, או ביטול.');
  $('wipeBtn').fire('click');
  assert.equal($('wipeStatus').textContent, 'נמחק. במכשיר הזה לא נשאר דבר מהרשימה, מהיחידות ומהיומן.');
});

test('after a download both clicks name the file left in the downloads', () => {
  const $ = openApp();
  pairUp($);
  $('exportCsv').fire('click');
  assert.equal($.downloads.length, 1);
  $('wipeBtn').fire('click');
  assert.equal($('wipeStatus').textContent, 'יימחקו 2 משתתפים, 0 יחידות ו-0 שיעורים.' + ONE + ' לחץ שוב כדי לאשר, או ביטול.');
  $('wipeBtn').fire('click');
  assert.equal($('wipeStatus').textContent, 'נמחק. בדפדפן הזה לא נשאר דבר מהרשימה, מהיחידות ומהיומן.' + ONE);
});

test('two downloads are counted, and emptying the list does not forget them', () => {
  const $ = openApp();
  pairUp($);
  $('exportCsv').fire('click');
  $('exportCsv').fire('click');
  press($('peopleList'), 'data-del', '1');
  press($('peopleList'), 'data-del', '0');
  $('wipeBtn').fire('click');
  assert.equal($('wipeStatus').textContent, 'בדפדפן הזה אין משתתפים, יחידות או שיעורים. 2 קובצי הזוגות (peered-pairs.csv) ' +
    'שירדו מכאן בביקור הזה נמצאים בהורדות של המכשיר, מחוץ לדפדפן: הכפתור הזה לא מוחק אותם - מוחקים אותם מההורדות.' +
    ' לחץ שוב כדי לנקות בכל זאת את האחסון, או ביטול.');
});

test('a second wipe still names the file: the first one did not remove it', () => {
  const $ = openApp();
  pairUp($);
  $('exportCsv').fire('click');
  $('wipeBtn').fire('click');
  $('wipeBtn').fire('click');
  $('wipeBtn').fire('click');
  assert.match($('wipeStatus').textContent, /^בדפדפן הזה אין משתתפים, יחידות או שיעורים\. קובץ הזוגות peered-pairs\.csv/);
});

test('the wipe card hint says a downloaded pairs file is deleted from the downloads', () => {
  const html = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
  assert.match(html, /קובץ זוגות שהורד במסך השידוך כבר לא בדפדפן אלא בהורדות\s+של המכשיר, ואותו מוחקים משם\./);
});
