'use strict';
// A coordinator is judged on how many pupils got a tutor. Taking the best-scored pair first can leave a
// pupil without a tutor when another arrangement pairs everyone, so matchPairs must return the largest
// possible number of pairs, and still be deterministic. Whoever is left out gets the true reason.
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeProfile } = require('../src/lib/profile.js');
const { matchPairs, explainUnmatched } = require('../src/lib/match.js');
const { openApp, addPerson, text } = require('../test-support/fake-dom.js');

const st = (region, availability, subjects) => makeProfile({ role: 'student', region, availability, subjects });
const pu = (region, availability, subjects) => makeProfile({ role: 'pupil', region, availability, subjects });

// s0-p0 has the best score (two shared hours), but taking it first leaves s1 with nobody:
// s1 can only teach p0 (physics), and p1 only learns math.
const TRAP_S = () => [st('CENTER', ['SUN_16', 'MON_16'], ['MATH']), st('CENTER', ['SUN_16'], ['PHYSICS'])];
const TRAP_P = () => [pu('CENTER', ['SUN_16', 'MON_16'], ['MATH', 'PHYSICS']), pu('CENTER', ['SUN_16'], ['MATH'])];

test('match: the largest number of pairs wins over the best-scored first pair', () => {
  const pairs = matchPairs(TRAP_S(), TRAP_P());
  assert.equal(pairs.length, 2, JSON.stringify(pairs));
  assert.deepEqual(pairs.map((p) => p.studentIndex + ':' + p.pupilIndex).sort(), ['0:1', '1:0']);
  assert.deepEqual(matchPairs(TRAP_S(), TRAP_P()), pairs, 'same input, same output');
});

test('match: every pair is still valid - same region, shared hour, shared subject, nobody twice', () => {
  const S = [st('NORTH', ['SUN_8', 'SUN_9'], ['MATH', 'CS']), st('NORTH', ['SUN_9'], ['CS']), st('NORTH', ['SUN_8'], ['MATH']),
    st('SOUTH', ['MON_10'], ['ENGLISH'])];
  const P = [pu('NORTH', ['SUN_8', 'SUN_9'], ['CS', 'MATH']), pu('NORTH', ['SUN_9'], ['CS']), pu('NORTH', ['SUN_8'], ['MATH']),
    pu('SOUTH', ['MON_10'], ['ENGLISH'])];
  const pairs = matchPairs(S, P);
  assert.equal(pairs.length, 4);
  const seenS = new Set(); const seenP = new Set();
  for (const p of pairs) {
    assert.equal(S[p.studentIndex].region, P[p.pupilIndex].region);
    assert.ok(p.sharedSlots.length > 0 && p.sharedSubjects.length > 0);
    assert.ok(!seenS.has(p.studentIndex) && !seenP.has(p.pupilIndex));
    seenS.add(p.studentIndex); seenP.add(p.pupilIndex);
  }
});

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

test('match: on 300 small generated rosters the pair count equals a brute-force maximum', () => {
  let seed = 12345;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  const REG = ['CENTER', 'NORTH'];
  const SL = ['SUN_16', 'SUN_17', 'MON_16'];
  const SU = ['MATH', 'CS', 'ENGLISH'];
  const pick = (arr) => { const out = arr.filter(() => rnd(2) === 0); return out.length ? out : [arr[rnd(arr.length)]]; };
  function brute(S, P) {
    let best = 0;
    (function go(si, usedP, count) {
      if (count + (S.length - si) <= best) return;
      if (si === S.length) { best = Math.max(best, count); return; }
      go(si + 1, usedP, count);
      for (let pi = 0; pi < P.length; pi += 1) {
        if (usedP & (1 << pi)) continue;
        const ok = S[si].region === P[pi].region &&
          S[si].availability.some((x) => P[pi].availability.includes(x)) &&
          S[si].subjects.some((x) => P[pi].subjects.includes(x));
        if (ok) go(si + 1, usedP | (1 << pi), count + 1);
      }
    })(0, 0, 0);
    return best;
  }
  for (let round = 0; round < 300; round += 1) {
    const S = []; const P = [];
    for (let i = 0, n = 1 + rnd(6); i < n; i += 1) S.push(st(REG[rnd(2)], pick(SL), pick(SU)));
    for (let i = 0, n = 1 + rnd(6); i < n; i += 1) P.push(pu(REG[rnd(2)], pick(SL), pick(SU)));
    assert.equal(matchPairs(S, P).length, brute(S, P), 'round ' + round);
  }
});
