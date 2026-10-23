'use strict';
// Revoking a pupil's parent consent named the pair a downloaded pairs file holds (#300), but not a
// suggestion in the file's cross-region section: "התלמיד נשאר ברשימה אבל לא ישודך" over a file that
// still offers that pupil to a student in another region. Now the line names that suggestion too.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp, addPerson, press } = require('../test-support/fake-dom.js');

const REVOKED = 'האישור בוטל. התלמיד נשאר ברשימה אבל לא ישודך.';

function acrossOnly($) {
  addPerson($, 'student', 'NORTH', ['MATH'], ['SUN_16']);    // #1
  addPerson($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);     // #2, suggested across regions with #1
}

test('revoking a pupil the downloaded file suggests across regions names that suggestion', () => {
  const $ = openApp();
  acrossOnly($);
  $('runMatch').fire('click');
  assert.match($('across').innerHTML, /תלמיד #2/);
  $('exportCsv').fire('click');
  press($('peopleList'), 'data-consent', '1');
  assert.equal($('addStatus').textContent, REVOKED +
    ' בקובץ הזוגות שירד קודם הוא עדיין בהצעות בין אזורים (תלמיד #2 עם סטודנט מלמד #1): הקובץ לא מתעדכן לבד - לחץ "חשב שידוך" והורד אותו מחדש.');
});

test('with no file down the line is as before', () => {
  const $ = openApp();
  acrossOnly($);
  $('runMatch').fire('click');
  press($('peopleList'), 'data-consent', '1');
  assert.equal($('addStatus').textContent, REVOKED);
});

test('a wipe forgets the file\'s suggestions', () => {
  const $ = openApp();
  acrossOnly($);
  $('runMatch').fire('click');
  $('exportCsv').fire('click');
  $('wipeBtn').fire('click');
  $('wipeBtn').fire('click');
  acrossOnly($);
  press($('peopleList'), 'data-consent', '1');
  assert.equal($('addStatus').textContent, REVOKED);
});
