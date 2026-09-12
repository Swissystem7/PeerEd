'use strict';
// The screen has to agree with itself: the number next to a person on the participants list is the
// number the match screen must use for that same person.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { makeProfile } = require('../src/lib/profile.js');
const { matchPairs } = require('../src/lib/match.js');
const { byRole, roster, pairsWithNumbers, unmatchedWithNumbers } = require('../src/lib/roster.js');

// The demo the app loads, in the order it is added - three students, then four pupils.
const DEMO = [
  { role: 'student', region: 'CENTER', availability: ['SUN_16', 'MON_18', 'TUE_16'], subjects: ['MATH', 'CS'] },
  { role: 'student', region: 'CENTER', availability: ['SUN_16'], subjects: ['MATH'] },
  { role: 'student', region: 'SOUTH', availability: ['TUE_17', 'WED_17'], subjects: ['PHYSICS', 'ENGLISH'] },
  { role: 'pupil', region: 'CENTER', availability: ['SUN_16', 'MON_18'], subjects: ['CS', 'MATH', 'HEBREW'] },
  { role: 'pupil', region: 'CENTER', availability: ['SUN_16'], subjects: ['MATH', 'PHYSICS'] },
  { role: 'pupil', region: 'SOUTH', availability: ['WED_17'], subjects: ['ENGLISH'] },
  { role: 'pupil', region: 'JERUSALEM', availability: ['THU_16'], subjects: ['HISTORY'] }
].map(makeProfile);

function matchDemo(people) {
  const r = roster(people);
  return matchPairs(r.students.map((e) => e.person), r.pupils.map((e) => e.person));
}

test('roster: the number is the place in the participants list, whatever the role', () => {
  const r = roster(DEMO);
  assert.deepEqual(r.students.map((e) => e.number), [1, 2, 3]);
  assert.deepEqual(r.pupils.map((e) => e.number), [4, 5, 6, 7]);
  assert.equal(r.pupils[0].person, DEMO[3]);
  assert.deepEqual(byRole([], 'student'), []);
  assert.deepEqual(byRole(null, 'pupil'), []);
  assert.deepEqual(byRole([null, { role: 'pupil' }], 'pupil'), [{ number: 2, person: { role: 'pupil' } }]);
});

test('roster: a pair names the same numbers the participants list shows', () => {
  const pairs = matchDemo(DEMO);
  const view = pairsWithNumbers(DEMO, pairs);
  // matchPairs returns positions among students / among pupils: 0-0, 1-1, 2-2 here. On the list those
  // same people are #1 with #4, #2 with #5, #3 with #6 - the pupil numbers are NOT 1, 2, 3.
  assert.deepEqual(pairs.map((p) => [p.studentIndex, p.pupilIndex]), [[0, 0], [1, 1], [2, 2]]);
  assert.deepEqual(view.map((p) => [p.studentNumber, p.pupilNumber]), [[1, 4], [2, 5], [3, 6]]);
  view.forEach((p) => {
    assert.equal(p.student, DEMO[p.studentNumber - 1]);
    assert.equal(p.pupil, DEMO[p.pupilNumber - 1]);
    assert.equal(p.student.role, 'student');
    assert.equal(p.pupil.role, 'pupil');
  });
});

test('roster: the person left over is the one the list calls #7, not the one it calls #4', () => {
  const left = unmatchedWithNumbers(DEMO, matchDemo(DEMO));
  assert.deepEqual(left.map((e) => [e.role, e.number]), [['pupil', 7]]);
  // #4 on the list is a CENTER pupil that WAS paired; the leftover is the JERUSALEM pupil.
  assert.equal(left[0].person.region, 'JERUSALEM');
  assert.equal(DEMO[3].region, 'CENTER');
});

test('roster: deleting the first person renumbers both screens together', () => {
  const people = DEMO.slice(1);            // the list now starts at the second student
  const view = pairsWithNumbers(people, matchDemo(people));
  const left = unmatchedWithNumbers(people, matchDemo(people));
  const r = roster(people);
  assert.deepEqual(r.students.map((e) => e.number), [1, 2]);
  assert.deepEqual(r.pupils.map((e) => e.number), [3, 4, 5, 6]);
  const named = view.map((p) => [p.studentNumber, p.pupilNumber])
    .concat(left.map((e) => [e.role, e.number]));
  assert.ok(named.length > 0);
  // every number printed anywhere is a real place in the list, and the role at that place matches
  view.forEach((p) => {
    assert.equal(people[p.studentNumber - 1].role, 'student');
    assert.equal(people[p.pupilNumber - 1].role, 'pupil');
  });
  left.forEach((e) => assert.equal(people[e.number - 1].role, e.role));
});

test('roster: empty and junk input do not invent people', () => {
  assert.deepEqual(roster([]), { students: [], pupils: [] });
  assert.deepEqual(pairsWithNumbers([], []), []);
  assert.deepEqual(pairsWithNumbers(DEMO, null), []);
  assert.deepEqual(unmatchedWithNumbers([], null), []);
  const out = pairsWithNumbers(DEMO, [{ studentIndex: 99, pupilIndex: 99, region: 'CENTER' }]);
  assert.deepEqual([out[0].studentNumber, out[0].pupilNumber], [null, null]);
  assert.deepEqual(unmatchedWithNumbers(DEMO, []).map((e) => e.number), [1, 2, 3, 4, 5, 6, 7]);
});

test('the match screen prints roster numbers, not positions inside the filtered arrays', () => {
  const shell = fs.readFileSync(path.join(__dirname, '..', 'src', 'app-shell.html'), 'utf8');
  const handler = shell.slice(shell.indexOf("$('runMatch')"), shell.indexOf('// ---------- text gate'));
  assert.ok(handler.length > 100, 'the runMatch handler should be findable');
  assert.equal(/studentIndex \+ 1|pupilIndex \+ 1/.test(handler), false,
    'a filtered-array index must never reach the screen as a participant number');
  assert.ok(/roster\.pairsWithNumbers/.test(handler) && /roster\.unmatchedWithNumbers/.test(handler),
    'the match screen must take its numbers from src/lib/roster.js');
});
