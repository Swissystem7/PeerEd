'use strict';
// The participants list numbers people 1, 2, 3... in the order they were added, whatever the role.
// A coordinator reads a pair on the match screen and goes back to that list (or to their own sheet)
// to find who it is. If the match screen counts differently, the coordinator calls the wrong person.
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp, addPerson, text } = require('../test-support/fake-dom.js');

test('a pair names the same numbers the participants list shows', () => {
  const $ = openApp();
  addPerson($, 'pupil', 'NORTH', ['HISTORY'], ['THU_16']);          // #1 pupil, nobody for them
  addPerson($, 'student', 'SOUTH', ['PHYSICS'], ['TUE_17']);        // #2 student, nobody for them
  addPerson($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);            // #3 pupil
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);          // #4 student
  const list = text($('peopleList').innerHTML);
  assert.match(list, /תלמיד #3/);
  assert.match(list, /סטודנט מלמד #4/);

  $('runMatch').fire('click');
  const pairs = text($('pairs').innerHTML);
  assert.match(pairs, /#4 עם תלמיד #3/, pairs);
  const left = text($('unmatched').innerHTML);
  assert.match(left, /תלמיד #1/, left);
  assert.match(left, /#2/, left);
  assert.doesNotMatch(left, /#3|#4/, left);
});
