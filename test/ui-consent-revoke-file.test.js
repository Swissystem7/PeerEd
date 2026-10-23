'use strict';
// Revoking a pupil's parent consent said "האישור בוטל. התלמיד נשאר ברשימה אבל לא ישודך." - and nothing
// about a pairs file already down that pairs that pupil, the file the coordinator crosses names against.
// Now the line names the pair the file still holds, by the file's numbers.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp, addPerson, press } = require('../test-support/fake-dom.js');

const REVOKED = 'האישור בוטל. התלמיד נשאר ברשימה אבל לא ישודך.';

function pairUp($) {
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);   // #1
  addPerson($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);     // #2
  addPerson($, 'pupil', 'NORTH', ['ENGLISH'], ['MON_18']);   // #3, left out
}

test('revoking a pupil the downloaded file pairs names that pair', () => {
  const $ = openApp();
  pairUp($);
  $('runMatch').fire('click');
  $('exportCsv').fire('click');
  press($('peopleList'), 'data-consent', '1');
  assert.equal($('addStatus').textContent, REVOKED +
    ' בקובץ הזוגות שירד קודם הוא עדיין בזוג 1 (תלמיד #2 עם סטודנט מלמד #1): הקובץ לא מתעדכן לבד - לחץ "חשב שידוך" והורד אותו מחדש.');
});

test('with no file down, or a pupil the file does not pair, the line is as before', () => {
  const $ = openApp();
  pairUp($);
  press($('peopleList'), 'data-consent', '1');
  assert.equal($('addStatus').textContent, REVOKED);
  press($('peopleList'), 'data-consent', '1');  // grant back
  $('runMatch').fire('click');
  $('exportCsv').fire('click');
  press($('peopleList'), 'data-consent', '2');
  assert.equal($('addStatus').textContent, REVOKED);
});

test('the file numbers stay the file\'s after a deletion moves the list, and a re-grant keeps the link', () => {
  const $ = openApp();
  addPerson($, 'pupil', 'NORTH', ['ENGLISH'], ['MON_18']);   // #1
  pairUp($);                                                  // #2 student, #3 pupil, #4 pupil
  $('runMatch').fire('click');
  $('exportCsv').fire('click');
  press($('peopleList'), 'data-del', '0');                    // the paired pupil is now #2
  press($('peopleList'), 'data-consent', '1');
  assert.match($('addStatus').textContent, /בזוג 1 \(תלמיד #3 עם סטודנט מלמד #2\)/);
  press($('peopleList'), 'data-consent', '1');                // grant
  press($('peopleList'), 'data-consent', '1');                // revoke again
  assert.match($('addStatus').textContent, /בקובץ הזוגות שירד קודם/);
});

test('a wipe forgets the file', () => {
  const $ = openApp();
  pairUp($);
  $('runMatch').fire('click');
  $('exportCsv').fire('click');
  $('wipeBtn').fire('click');
  $('wipeBtn').fire('click');
  pairUp($);
  press($('peopleList'), 'data-consent', '1');
  assert.equal($('addStatus').textContent, REVOKED);
});
