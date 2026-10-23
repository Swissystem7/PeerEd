'use strict';
// Deleting someone a downloaded pairs file names says so (#302, #306) - but the delete that empties the
// list cleared the file flags before the line was built, so the one deleted last got "נמחק." over a file
// that still pairs them, by the number the next one added takes. The line is built first now.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp, addPerson, press } = require('../test-support/fake-dom.js');

const REDO = ': הקובץ לא מתעדכן לבד - לחץ "חשב שידוך" והורד אותו מחדש.';

function pairDown($) {
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);   // #1
  addPerson($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);     // #2, pair 1 with #1
  $('runMatch').fire('click');
  $('exportCsv').fire('click');
}

test('deleting the last one left on the list, who the file pairs, names the pair', () => {
  const $ = openApp();
  pairDown($);
  press($('peopleList'), 'data-del', '1');
  press($('peopleList'), 'data-del', '0');
  assert.equal($('addStatus').textContent,
    'נמחק סטודנט מלמד #1. בקובץ הזוגות שירד קודם הוא עדיין #1, בזוג 1 (תלמיד #2 עם סטודנט מלמד #1)' +
    ', ומי שיתווסף עכשיו יקבל ברשימה את #1' + REDO);
});

test('after the list is emptied, people added anew are not taken for the file\'s', () => {
  const $ = openApp();
  pairDown($);
  press($('peopleList'), 'data-del', '1');
  press($('peopleList'), 'data-del', '0');
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);
  press($('peopleList'), 'data-del', '0');
  assert.equal($('addStatus').textContent, 'נמחק סטודנט מלמד #1. מי שהיה #2 הוא עכשיו #1.');
});
