'use strict';
// A roster of students only, or pupils only: "רשום שיעור" said "חשב שידוך" on the match screen shows next
// to everyone left without a pair why - but "חשב שידוך" over such a roster puts no one on that card and
// said only "צריך לפחות סטודנט אחד ותלמיד אחד". Both lines now name what the list holds and the role it
// has none of.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp, addPerson } = require('../test-support/fake-dom.js');

function logLine($) {
  $('nav-sessions').fire('click');
  $('logSession').fire('click');
  return $('sessionStatus').textContent;
}
function matchLine($) {
  $('runMatch').fire('click');
  return $('matchStatus').textContent;
}

test('students only: the lessons line names them and the missing pupil, not the match screen', () => {
  const $ = openApp();
  addPerson($, 'student', 'NORTH', ['MATH'], ['SUN_16']);
  addPerson($, 'student', 'CENTER', ['CS'], ['MON_16']);
  const line = logLine($);
  assert.equal(line, 'אין זוג לרשום לו שיעור. ברשימה במסך "אנשים" יש 2 סטודנטים ואין אף תלמיד - הוסף שם תלמיד.');
});

test('pupils only: the lessons line names them and the missing student', () => {
  const $ = openApp();
  addPerson($, 'pupil', 'NORTH', ['MATH'], ['SUN_16']);
  assert.match(logLine($), /יש תלמיד אחד ואין אף סטודנט - הוסף שם סטודנט\.$/);
});

test('the match line says which role the list lacks, and that an empty list is empty', () => {
  let $ = openApp();
  addPerson($, 'pupil', 'NORTH', ['MATH'], ['SUN_16']);
  addPerson($, 'pupil', 'NORTH', ['CS'], ['SUN_16']);
  assert.equal(matchLine($), 'צריך לפחות סטודנט אחד ותלמיד אחד. ברשימה במסך "אנשים" יש 2 תלמידים ואין אף סטודנט - הוסף שם סטודנט.');
  $ = openApp();
  assert.match(matchLine($), /^צריך לפחות סטודנט אחד ותלמיד אחד\. הרשימה במסך "אנשים" ריקה/);
});

test('both roles with no pair: the lessons line still sends the coordinator to the reasons', () => {
  const $ = openApp();
  addPerson($, 'student', 'NORTH', ['MATH'], ['SUN_16']);
  addPerson($, 'pupil', 'SOUTH', ['MATH'], ['SUN_16']);
  assert.match(logLine($), /מראה אצל כל מי שנשאר בלי זוג למה\.$/);
});
