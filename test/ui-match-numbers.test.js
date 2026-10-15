'use strict';
// The participants list numbers a person within its role (תלמיד #1, #2... / סטודנט מלמד #1, #2...), the
// same count matchPairs() uses for its indexes. A coordinator reads a pair on the match screen and goes
// back to that list (or to their own sheet) to find who it is. If the match screen counts differently,
// the coordinator calls the wrong person. test/people-numbering.test.js covers the people screen side.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp, addPerson, text } = require('../test-support/fake-dom.js');

test('a pair names the same numbers the participants list shows', () => {
  const $ = openApp();
  // A pupil without parent consent is never paired, and the form clears the checkbox after every add.
  $('consent').checked = true;
  addPerson($, 'pupil', 'NORTH', ['HISTORY'], ['THU_16']);          // תלמיד #1, nobody for them
  addPerson($, 'student', 'SOUTH', ['PHYSICS'], ['TUE_17']);        // סטודנט #1, nobody for them
  $('consent').checked = true;
  addPerson($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);            // תלמיד #2
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);          // סטודנט #2
  const list = text($('peopleList').innerHTML);
  assert.match(list, /תלמיד #2/);
  assert.match(list, /סטודנט מלמד #2/);

  $('runMatch').fire('click');
  const pairs = text($('pairs').innerHTML);
  assert.match(pairs, /סטודנט #2 עם תלמיד #2/, pairs);
  const left = text($('unmatched').innerHTML);
  assert.match(left, /תלמיד #1/, left);
  assert.match(left, /סטודנט #1/, left);
  assert.doesNotMatch(left, /תלמיד #2|סטודנט #2/, left);
});
