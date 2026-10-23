'use strict';
// The pairs file's cross-region section said "הרכז מחליט" and nothing else, while the lessons screen lists
// same-region pairs only (matchPairs) and session.logSession refuses a pair with no single region. The file
// is read in a spreadsheet, away from the card's hint, so its section header says such a pair's lesson is
// not logged and not counted for the municipality.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp, addPerson } = require('../test-support/fake-dom.js');

test('pairs file: the cross-region header says a lesson of such a pair is not logged', () => {
  const $ = openApp();
  addPerson($, 'student', 'CENTER', ['ENGLISH'], ['MON_18']);
  addPerson($, 'pupil', 'NORTH', ['ENGLISH'], ['MON_18']);
  $('runMatch').fire('click');
  $('exportCsv').fire('click');
  const csv = $.downloads[$.downloads.length - 1].text;
  assert.ok(csv.includes('\r\n"הצעות בין אזורים (טקסט בלבד, הרכז מחליט; יומן השיעורים רושם רק זוג מאותו אזור, ' +
    'אז שיעור של זוג כזה לא נרשם ביומן ולא נספר בסיכום לרשות)"\r\n'));
  assert.match(csv, /\r\n2,צפון,1,מרכז,אנגלית,/);
});
