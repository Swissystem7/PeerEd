'use strict';
// Two cards on the participants screen spoke about the same stored roster: the list card said the list
// lives in this browser only and pointed at "הורד זוגות (CSV)" on the match screen "for a copy", while
// the wipe card under it said there is no backup and no restore. The file is the result of a match by
// list number - pairs, who was left out and why, cross-region suggestions - not the list: a person's
// hours outside the pair's shared ones and the parent-consent flag are not in it, and nothing loads it
// back. Now the list card says what the file is and that the list itself has no copy.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { openApp, addPerson, ROOT } = require('../test-support/fake-dom.js');

function hint() {
  const shell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
  // a comment may sit between the heading and the hint
  const m = /<h2>המשתתפים<\/h2>\s*(?:<!--[\s\S]*?-->\s*)?<p class="hint">([\s\S]*?)<\/p>/.exec(shell);
  assert.ok(m, 'the participants card has a hint under its heading');
  return m[1].replace(/\s+/g, ' ');
}

test('the participants card does not call the pairs file a copy of the list', () => {
  const h = hint();
  assert.doesNotMatch(h, /לעותק/, h);
  assert.match(h, /אין ממנה גיבוי/, h);
  assert.match(h, /הורד זוגות \(CSV\)/, h);
  assert.match(h, /תוצאת השידוך/, h);
  assert.match(h, /לא את הרשימה/, h);
  assert.match(h, /אי אפשר לטעון אותו בחזרה/, h);
  // and it still agrees with the wipe card under it
  const shell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
  assert.match(shell, /אין גיבוי ואין שחזור\./);
});

test('what the hint says is missing from the file is missing: hours outside the pair and parent consent', () => {
  const $ = openApp();
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16', 'TUE_17']); // #1: TUE_17 is his alone
  addPerson($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);             // #2 pairs with #1
  addPerson($, 'pupil', 'NORTH', ['HISTORY'], ['WED_17']);           // #3 left out, with consent
  $('runMatch').fire('click');
  $('exportCsv').fire('click');
  assert.equal($.downloads.length, 1);
  const csv = $.downloads[0].text;
  assert.match(csv, /יום א 16:00/, 'the shared hour is in the file');
  assert.doesNotMatch(csv, /יום ג 17:00/, 'an hour only one of the pair has is not');
  assert.doesNotMatch(csv, /יום ד 17:00/, 'the hours of someone left out are not');
  assert.doesNotMatch(csv, /אישור הורה: (יש|אין)/, 'the consent flag is not');
  // the list card, by contrast, shows every one of them
  const list = $('peopleList').innerHTML;
  assert.match(list, /2 שעות פנויות/);
  assert.match(list, /אישור הורה: יש/);
});
