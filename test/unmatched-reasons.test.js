'use strict';
// Whoever is left out gets the true reason, on the screen too, not one sentence for everybody.
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeProfile } = require('../src/lib/profile.js');
const { matchPairs, explainUnmatched } = require('../src/lib/match.js');
const { openApp, addPerson, text } = require('../test-support/fake-dom.js');

const st = (region, availability, subjects) => makeProfile({ role: 'student', region, availability, subjects });
const pu = (region, availability, subjects) => makeProfile({ role: 'pupil', region, availability, subjects });

test('explainUnmatched: each person left out gets the reason that is actually true', () => {
  const S = [st('CENTER', ['SUN_16'], ['MATH']), st('NORTH', ['SUN_16'], ['MATH'])];
  const P = [
    pu('CENTER', ['SUN_16'], ['MATH']),      // paired with s0
    pu('SOUTH', ['SUN_16'], ['MATH']),       // no student in SOUTH
    pu('NORTH', ['MON_20'], ['MATH']),       // NORTH student is never free then
    pu('NORTH', ['SUN_16'], ['HISTORY']),    // free together, nothing in common to learn
    pu('CENTER', ['SUN_16'], ['MATH'])       // could learn with s0, but s0 went to p0
  ];
  const pairs = matchPairs(S, P);
  const why = explainUnmatched(S, P, pairs);
  assert.deepEqual(why.students, [{ index: 1, reason: 'NO_HOUR_AND_SUBJECT_TOGETHER' }]);
  assert.deepEqual(why.pupils, [
    { index: 1, reason: 'NO_ONE_IN_REGION' },
    { index: 2, reason: 'NO_SHARED_HOUR' },
    { index: 3, reason: 'NO_SHARED_SUBJECT' },
    { index: 4, reason: 'PARTNERS_TAKEN' }
  ]);
});

test('the screen shows the true reason, not one sentence for everybody', () => {
  const $ = openApp();
  addPerson($, 'student', 'CENTER', ['MATH'], ['SUN_16']);   // #1
  addPerson($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);     // #2
  addPerson($, 'pupil', 'CENTER', ['MATH'], ['SUN_16']);     // #3 - partner taken
  addPerson($, 'pupil', 'SOUTH', ['MATH'], ['SUN_16']);      // #4 - nobody in the region
  $('runMatch').fire('click');
  const left = text($('unmatched').innerHTML);
  assert.match(left, /#3[\s\S]*כבר שובצ/, left);
  assert.match(left, /#4[\s\S]*אין באזור/, left);
  assert.doesNotMatch(left, /#3[^#]*אין באזור/, 'pupil #3 has a student in the region: ' + left);
});
