'use strict';
// Two hints spoke about the pairs file and one stored flag, parent consent. The participants card (#289)
// said the file is the match result by list number and that "hours outside the pair and parent consent
// are not in the file"; the match card said the file holds "only list numbers, region, subjects and
// hours". The file itself has a "לא שובצו" section with a reason for each one left out, and for a pupil
// without consent that reason is "אין עדיין אישור הורה..." next to the pupil's list number - and for a
// student whose region's pupils have none, "לאף תלמיד באזור אין עדיין אישור הורה". So the flag was in the
// file, by list number, under a hint that promised it was not. Now both hints say what the file holds:
// consent is in it only as the reason of whoever was left without a pair for it, and the reason column
// is named beside the numbers, region, subjects and shared hours.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { openApp, addPerson, press, ROOT } = require('../test-support/fake-dom.js');

function shell() {
  return fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
}
function peopleHint() {
  const m = /<h2>המשתתפים<\/h2>\s*(?:<!--[\s\S]*?-->\s*)?<p class="hint">([\s\S]*?)<\/p>/.exec(shell());
  assert.ok(m, 'the participants card has a hint under its heading');
  return m[1].replace(/\s+/g, ' ');
}
function matchHint() {
  const m = /id="matchStatus"[^>]*><\/p>\s*(?:<!--[\s\S]*?-->\s*)?<p class="hint">([\s\S]*?)<\/p>/.exec(shell());
  assert.ok(m, 'the match card has a hint under its status line');
  return m[1].replace(/\s+/g, ' ');
}
function addPupilWithoutConsent($, region, subjects, slots) {
  $('role').value = 'pupil';
  $('consentRow').hidden = false;
  $('region').value = region;
  $('consent').checked = false;
  subjects.forEach((s) => press($('subjects'), 'data-subject', s));
  slots.forEach((s) => press($('hours'), 'data-slot', s));
  $('addPerson').fire('click');
  if ($('addStatus').className.includes('bad')) throw new Error('add refused: ' + $('addStatus').textContent);
}
function exportCsv($) {
  $('runMatch').fire('click');
  $('exportCsv').fire('click');
  assert.equal($.downloads.length, 1);
  return $.downloads[0].text;
}

test('the participants card no longer says parent consent is not in the file', () => {
  const h = peopleHint();
  assert.doesNotMatch(h, /ואישור הורה לא נמצאים/, h);
  assert.match(h, /אישור הורה מופיע בו רק כסיבה אצל מי שנשאר בלי זוג בגללו/, h);
  // what it still says is missing is missing (test/ui-roster-copy-hint.test.js checks the hours)
  assert.match(h, /שעות שאינן משותפות לזוג לא נמצאות בקובץ/, h);
  assert.match(h, /אי אפשר לטעון אותו בחזרה/, h);
});

test('the match card names the reason column, consent included, not "only numbers, region, subjects and hours"', () => {
  const h = matchHint();
  assert.doesNotMatch(h, /מקצועות ושעות\. /, h);
  assert.match(h, /שעות משותפות/, h);
  assert.match(h, /ולמי שנשאר בלי זוג גם את הסיבה/, h);
  assert.match(h, /כולל תלמיד שחסר לו אישור הורה/, h);
  assert.match(h, /את השמות מצליבים בגיליון שלך/, h);
});

test('a pupil left out for consent has the consent written in the file next to the list number', () => {
  const $ = openApp();
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);    // #1 pairs with #2
  addPerson($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);      // #2, with consent
  addPupilWithoutConsent($, 'CENTER', ['MATH'], ['SUN_16']);  // #3, no consent: left out for it
  const csv = exportCsv($);
  const lines = csv.split('\r\n');
  const row = lines.find((l) => l.startsWith('תלמיד,3,'));
  assert.ok(row, csv);
  assert.match(row, /אין עדיין אישור הורה/, row);
  // the paired pupil's consent is in the file only as the pair itself: no flag, no "יש"
  assert.doesNotMatch(csv, /אישור הורה: (יש|אין)/, csv);
  // and the screen's own list says what the file says, flag and reason both
  assert.match($('peopleList').innerHTML, /אישור הורה: אין/);
  assert.match($('unmatched').innerHTML, /תלמיד #3[\s\S]*אין עדיין אישור הורה/);
});

test('a student left out because no pupil in the region has consent carries that in the file too', () => {
  const $ = openApp();
  addPerson($, 'student', 'SOUTH', ['ENGLISH'], ['WED_17']);     // #1
  addPupilWithoutConsent($, 'SOUTH', ['ENGLISH'], ['WED_17']);  // #2, the only pupil there, no consent
  const csv = exportCsv($);
  const lines = csv.split('\r\n');
  const student = lines.find((l) => l.startsWith('סטודנט מלמד,1,'));
  const pupil = lines.find((l) => l.startsWith('תלמיד,2,'));
  assert.ok(student && pupil, csv);
  assert.match(student, /לאף תלמיד באזור אין עדיין אישור הורה/, student);
  assert.match(pupil, /אין עדיין אישור הורה/, pupil);
  assert.match($('matchStatus').textContent, /ירד/, 'the export line still says the file went down');
});

test('with consent everywhere the word is not in the file: the flag is no column', () => {
  const $ = openApp();
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);   // #1 pairs with #2
  addPerson($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);     // #2
  addPerson($, 'pupil', 'NORTH', ['HISTORY'], ['WED_17']);   // #3 left out: nobody in the region
  const csv = exportCsv($);
  assert.doesNotMatch(csv, /אישור הורה/, csv);
  assert.match(csv, /תלמיד,3,צפון,היסטוריה,אין באזור הזה אף סטודנט/, csv);
});
