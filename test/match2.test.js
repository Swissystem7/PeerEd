'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { match2, rematchPartial, scorePair } = require('../src/lib/match2.js');

const S = (o) => Object.assign({ region: 'CENTER', availability: ['SUN_8', 'SUN_9', 'SUN_10'], subjects: ['MATH', 'ENGLISH'], level: 3, languages: ['HE'] }, o);
const P = (o) => Object.assign({ region: 'CENTER', availability: ['SUN_8', 'SUN_9'], subjects: ['MATH'], level: 3, languages: ['HE'], parentConsent: true }, o);

test('match2: global optimum beats greedy (extra pair wins)', () => {
  // student 0 can take both pupils, student 1 only pupil 0. Greedy best-first steals pupil 0.
  const students = [S(), S({ availability: ['SUN_8'], subjects: ['MATH'] })];
  const pupils = [P(), P({ subjects: ['ENGLISH'] })];
  const r = match2(students, pupils);
  assert.equal(r.pairs.length, 2);
});

test('match2: no consent, no pair; Hebrew explanation carries breakdown', () => {
  const r = match2([S()], [P({ parentConsent: false }), P()]);
  assert.equal(r.pairs.length, 1);
  assert.deepEqual(r.unmatchedPupils[0], { pupilIndex: 0, reason: 'NO_PARENT_CONSENT' });
  assert.match(r.pairs[0].explanationHe, /ציון \d+\/100/);
  assert.match(r.pairs[0].explanationHe, /אותו אזור/);
  assert.equal(r.pairs[0].breakdown.region, 25);
});

test('match2: weights change the winner; locked pair is forced; invalid lock throws', () => {
  const students = [S(), S({ region: 'NORTH', languages: ['AR'] })];
  const pupils = [P(), P({ region: 'NORTH', languages: ['AR'] })];
  const byRegion = match2(students, pupils, { weights: { region: 100, hours: 0, subject: 0, level: 0, language: 0, preference: 0 } });
  assert.ok(byRegion.pairs.some((x) => x.studentIndex === 1 && x.pupilIndex === 1));
  const locked = match2(students, pupils, { locked: [{ studentIndex: 0, pupilIndex: 1 }] });
  assert.ok(locked.pairs.some((x) => x.studentIndex === 0 && x.pupilIndex === 1 && x.locked));
  assert.throws(() => match2(students, [P({ parentConsent: false })], { locked: [{ studentIndex: 0, pupilIndex: 0 }] }), /invalid locked pair/);
});

test('match2: student capacity and partial re-match keeps unreleased pairs', () => {
  const students = [S({ maxPupils: 2 }), S()];
  const pupils = [P(), P(), P({ subjects: ['ENGLISH'] })];
  const r = match2(students, pupils);
  assert.equal(r.pairs.length, 3);
  const again = rematchPartial(students, pupils, r.pairs, { releasePupilIndexes: [2] });
  assert.equal(again.pairs.length, 3);
  assert.ok(again.pairs.filter((x) => x.pupilIndex !== 2).every((x) => x.locked));
  const sc = scorePair(S(), P());
  assert.equal(sc.score, sc.breakdown.total);
});
