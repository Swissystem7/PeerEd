'use strict';
// Deleting someone a downloaded pairs file pairs names that pair (#302), but not a suggestion in the
// file's cross-region section: someone who moved others up a number got no note at all, and the last
// one got "עדיין #N" with no word of the suggestion that still offers them. Now the line names it.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp, addPerson, press } = require('../test-support/fake-dom.js');

const REDO = ': הקובץ לא מתעדכן לבד - לחץ "חשב שידוך" והורד אותו מחדש.';

function acrossOnly($) {
  addPerson($, 'student', 'NORTH', ['MATH'], ['SUN_16']);    // #1
  addPerson($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);     // #2, suggested across regions with #1
}

function fileDown($) {
  $('runMatch').fire('click');
  assert.match($('across').innerHTML, /תלמיד #2/);
  $('exportCsv').fire('click');
}

test('deleting a student the file suggests across regions, moving the pupil up, names the suggestion', () => {
  const $ = openApp();
  acrossOnly($);
  fileDown($);
  press($('peopleList'), 'data-del', '0');
  assert.equal($('addStatus').textContent,
    'נמחק סטודנט מלמד #1. מי שהיה #2 הוא עכשיו #1, וקובץ הזוגות שירד קודם מתייחס למספרים שלפני המחיקה.' +
    ' בקובץ הוא היה #1, בהצעות בין אזורים (תלמיד #2 עם סטודנט מלמד #1)' + REDO);
});

test('deleting the last one, a pupil the file suggests across regions, names the suggestion', () => {
  const $ = openApp();
  acrossOnly($);
  fileDown($);
  press($('peopleList'), 'data-del', '1');
  assert.equal($('addStatus').textContent,
    'נמחק תלמיד #2. בקובץ הזוגות שירד קודם הוא עדיין #2, בהצעות בין אזורים (תלמיד #2 עם סטודנט מלמד #1)' +
    ', ומי שיתווסף עכשיו יקבל ברשימה את #2' + REDO);
});

test('with no file down the line is as before', () => {
  const $ = openApp();
  acrossOnly($);
  $('runMatch').fire('click');
  press($('peopleList'), 'data-del', '1');
  assert.equal($('addStatus').textContent, 'נמחק.');
});
