'use strict';
// The pairs file names everyone who was on the list when it went down: pairs by list number, and the
// rest in its "לא שובצו" section. Deleting the last one moved nobody, so the line said "נמחק." - but the
// file still gives that number to the deleted one, and the next one added takes the same number on the
// screen. Deleting someone the file pairs said only that the numbers are the ones from before, not
// that a pair in the file holds someone no longer on the list. Now the line names both.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp, addPerson, press, text } = require('../test-support/fake-dom.js');

function three($) {
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);   // #1
  addPerson($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);     // #2
  addPerson($, 'pupil', 'NORTH', ['ENGLISH'], ['MON_18']);   // #3, left out
}

function fileDown($) {
  $('runMatch').fire('click');
  $('exportCsv').fire('click');
  assert.equal($.downloads.length, 1);
}

const REDO = ': הקובץ לא מתעדכן לבד - לחץ "חשב שידוך" והורד אותו מחדש.';

test('deleting the last one, who is in the file, says the next one added takes their number', () => {
  const $ = openApp();
  three($);
  fileDown($);
  assert.match($.downloads[0].text, /תלמיד,3,צפון/, 'the file names #3 among the unmatched');
  press($('peopleList'), 'data-del', '2');
  assert.equal($('addStatus').textContent,
    'נמחק תלמיד #3. בקובץ הזוגות שירד קודם הוא עדיין #3, ומי שיתווסף עכשיו יקבל ברשימה את #3' + REDO);
  addPerson($, 'student', 'SOUTH', ['PHYSICS'], ['TUE_17']);
  assert.match(text($('peopleList').innerHTML), /סטודנט מלמד #3/);
});

test('deleting the last one when they are in a pair names the pair', () => {
  const $ = openApp();
  three($);
  fileDown($);
  press($('peopleList'), 'data-del', '2');
  press($('peopleList'), 'data-del', '1');
  assert.equal($('addStatus').textContent,
    'נמחק תלמיד #2. בקובץ הזוגות שירד קודם הוא עדיין #2, בזוג 1 (תלמיד #2 עם סטודנט מלמד #1), ' +
    'ומי שיתווסף עכשיו יקבל ברשימה את #2' + REDO);
});

test('deleting a paired one who is not last adds the pair after the old-numbers note', () => {
  const $ = openApp();
  three($);
  fileDown($);
  press($('peopleList'), 'data-del', '0');
  assert.equal($('addStatus').textContent,
    'נמחק סטודנט מלמד #1. מי שהיו #2 עד #3 ירדו במספר אחד, וקובץ הזוגות שירד קודם מתייחס למספרים שלפני המחיקה.' +
    ' בקובץ הוא היה #1, בזוג 1 (תלמיד #2 עם סטודנט מלמד #1)' + REDO);
});

test('someone added after the file went down is not in it: deleting them is just "נמחק."', () => {
  const $ = openApp();
  three($);
  fileDown($);
  addPerson($, 'student', 'SOUTH', ['PHYSICS'], ['TUE_17']);  // #4
  press($('peopleList'), 'data-del', '3');
  assert.equal($('addStatus').textContent, 'נמחק.');
});

test('a consent toggle after the download does not lose the pupil from the file', () => {
  const $ = openApp();
  three($);
  fileDown($);
  press($('peopleList'), 'data-consent', '2');
  press($('peopleList'), 'data-del', '2');
  assert.match($('addStatus').textContent, /^נמחק תלמיד #3\. בקובץ הזוגות שירד קודם הוא עדיין #3/);
});

test('a wipe forgets the file: deleting the last one of a new list is "נמחק."', () => {
  const $ = openApp();
  three($);
  fileDown($);
  $('wipeBtn').fire('click');
  $('wipeBtn').fire('click');
  three($);
  press($('peopleList'), 'data-del', '2');
  assert.equal($('addStatus').textContent, 'נמחק.');
});
