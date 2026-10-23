'use strict';
// "רשום שיעור" with no pair said "טען משתתפים במסך "אנשים" ובדוק במסך "שידוך" שנוצר זוג" whatever the
// roster held: over a roster with people and no pair it sent the coordinator to load people who are
// already there, and "check that a pair was made" contradicted the pair option above it, which says
// "חשב שידוך" only shows the pairs. Now the line tells an empty roster from one with nobody to pair.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp, addPerson } = require('../test-support/fake-dom.js');

function logLine($) {
  $('nav-sessions').fire('click');
  $('logSession').fire('click');
  return $('sessionStatus').textContent;
}

test('an empty roster: the line says the list is empty and how to fill it', () => {
  const $ = openApp();
  const line = logLine($);
  assert.match(line, /^אין זוג לרשום לו שיעור\. הרשימה במסך "אנשים" ריקה - הוסף שם סטודנט ותלמיד, או טען דוגמה\.$/, line);
});

test('people with no pair: the line counts them and does not ask to load participants', () => {
  const $ = openApp();
  addPerson($, 'student', 'NORTH', ['MATH'], ['SUN_16']);
  addPerson($, 'pupil', 'NORTH', ['HEBREW'], ['MON_16']);
  const line = logLine($);
  assert.match(line, /^אין זוג לרשום לו שיעור\. ברשימה במסך "אנשים" יש 2 משתתפים ואין ביניהם/, line);
  assert.match(line, /"חשב שידוך" במסך השידוך מראה אצל כל מי שנשאר בלי זוג למה\.$/, line);
  assert.equal(line.indexOf('טען משתתפים'), -1, line);
  assert.equal(line.indexOf('שנוצר זוג'), -1, line);
});

test('one participant: counted as one', () => {
  const $ = openApp();
  addPerson($, 'student', 'NORTH', ['MATH'], ['SUN_16']);
  assert.match(logLine($), /יש משתתף אחד ואין ביניהם/);
});
