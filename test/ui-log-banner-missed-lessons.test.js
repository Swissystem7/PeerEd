'use strict';
// The sessions banner said the log records "שהתקיים שיעור" with "היחידה המאושרת שנלמדה", over a form
// whose "איך הסתיים" offers "לא התקיים" and "נקטע באמצע", and a summary that counts both. The banner now
// says a row is a lesson set for the pair, held or not, with the unit chosen for it, and the line under
// "רשום שיעור" names the outcome it logged instead of "נרשם שיעור N." alone.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { openApp, press, text } = require('../test-support/fake-dom.js');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.html'), 'utf8');
const panel = app.slice(app.indexOf('id="tab-sessions"'), app.indexOf('<h2>רישום שיעור</h2>'));

function approveDemoUnit($) {
  $('unitDemoBtn').fire('click');
  $('submitUnit').fire('click');
  const m = /data-approve="([^"]+)"/.exec($('pendingList').innerHTML);
  assert.ok(m, 'the sample unit waits for approval');
  press($('pendingList'), 'data-approve', m[1]);
  return m[1];
}

function logLesson($, unitId, outcome) {
  $('nav-sessions').fire('click');
  $('sessionPair').value = '0';
  $('sessionSlot').value = 'SUN_16';
  $('sessionSubject').value = 'MATH';
  $('sessionUnit').value = unitId;
  $('sessionOutcome').value = outcome;
  $('logSession').fire('click');
  return $('sessionStatus').textContent;
}

test('the banner does not say every row is a lesson that took place', () => {
  const banner = text(panel.slice(panel.indexOf('<div class="banner">'))).replace(/\s+/g, ' ');
  assert.equal(banner.indexOf('רושם שהתקיים שיעור'), -1, banner);
  assert.equal(banner.indexOf('שנלמדה'), -1, banner);
  assert.ok(banner.indexOf('גם אם לא התקיים או נקטע באמצע') !== -1, banner);
});

test('logging a missed lesson says it did not take place', () => {
  const $ = openApp();
  $('demoBtn').fire('click');
  const id = approveDemoUnit($);
  const line = logLesson($, id, 'missed');
  assert.match(line, /^נרשם שיעור 1\. איך הסתיים: לא התקיים\. /, line);
  assert.doesNotMatch($('sessionStatus').className, /bad/);
  assert.ok($('sessionList').innerHTML.indexOf('לא התקיים') !== -1, 'the row says so too');
});

test('each outcome is named on the line, with the row number', () => {
  const $ = openApp();
  $('demoBtn').fire('click');
  const id = approveDemoUnit($);
  assert.match(logLesson($, id, 'held'), /^נרשם שיעור 1\. איך הסתיים: התקיים\. /);
  assert.match(logLesson($, id, 'cut_short'), /^נרשם שיעור 2\. איך הסתיים: נקטע באמצע\. /);
  assert.match(logLesson($, id, 'missed'), /^נרשם שיעור 3\. איך הסתיים: לא התקיים\. /);
});
