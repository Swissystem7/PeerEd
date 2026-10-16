'use strict';
// A stored pair must carry its own expiry: the retention policy is only real if every row written down
// says which category it belongs to and when it was kept. These tests pin that down, and pin down that
// makeMatchRecord() reads no clock of its own.
const test = require('node:test');
const assert = require('node:assert/strict');

const { matchPairs, makeMatchRecord } = require('../src/lib/match.js');
const { makeProfile } = require('../src/lib/profile.js');
const { getRetentionPolicy } = require('../src/lib/retention.js');

const student = () => makeProfile({ role: 'student', region: 'CENTER', availability: ['SUN_16', 'MON_18'], subjects: ['MATH', 'CS'] });
const pupil = () => makeProfile({ role: 'pupil', region: 'CENTER', availability: ['SUN_16', 'MON_18'], subjects: ['MATH'], parentConsent: true });
const onePair = () => matchPairs([student()], [pupil()])[0];

test('match record: a pair gains the match retention category and the day it was kept', () => {
  const row = makeMatchRecord(onePair(), '2026-03-04');

  assert.equal(row.recordedAt, '2026-03-04');
  assert.equal(row.retention.dataCategory, 'match');
  assert.equal(row.retention.maxAgeDays, getRetentionPolicy().match);
  assert.equal(row.region, 'CENTER');
  assert.deepEqual(row.sharedSlots, ['MON_18', 'SUN_16']);
  assert.deepEqual(row.sharedSubjects, ['MATH']);
  assert.equal(row.studentIndex, 0);
  assert.equal(row.pupilIndex, 0);
});

test('match record: no name, phone, email or id can ride along', () => {
  const row = makeMatchRecord(onePair(), '2026-03-04');
  assert.deepEqual(Object.keys(row).sort(), [
    'pupilIndex', 'recordedAt', 'region', 'retention', 'sharedSlots', 'sharedSubjects', 'studentIndex'
  ]);
});

test('match record: the row and its arrays are frozen, and the pair is not aliased', () => {
  const pair = onePair();
  const row = makeMatchRecord(pair, new Date('2026-03-04T21:30:00.000Z'));

  assert.ok(Object.isFrozen(row) && Object.isFrozen(row.sharedSlots) && Object.isFrozen(row.retention));
  assert.notEqual(row.sharedSlots, pair.sharedSlots, 'the record must hold its own copy');
  assert.deepEqual(JSON.parse(JSON.stringify(row)), row, 'a stored row must survive a round trip');
});

test('match record: a Date is reduced to its UTC day, so no hour of a minor is written down', () => {
  const late = makeMatchRecord(onePair(), new Date('2026-03-04T23:59:59.000Z'));
  const early = makeMatchRecord(onePair(), new Date('2026-03-04T00:00:00.000Z'));

  assert.equal(late.recordedAt, '2026-03-04');
  assert.equal(early.recordedAt, '2026-03-04');
  assert.deepEqual(late, early, 'the same day must give the same row');
});

test('match record: the same arguments always give the same row (no clock, no randomness)', () => {
  assert.deepEqual(makeMatchRecord(onePair(), '2026-03-04'), makeMatchRecord(onePair(), '2026-03-04'));
});

test('match record: a missing or unreadable recordedAt is refused, never defaulted to now', () => {
  for (const bad of [undefined, null, 'yesterday', '', new Date('nope')]) {
    assert.throws(() => makeMatchRecord(onePair(), bad), /recordedAt/, 'accepted ' + String(bad));
  }
});

test('match record: anything that is not a matchPairs() candidate is refused', () => {
  const pair = onePair();
  for (const bad of [null, undefined, 'SUN_16', [pair], {}, Object.assign({}, pair, { sharedSlots: 'SUN_16' }),
    Object.assign({}, pair, { studentIndex: -1 }), Object.assign({}, pair, { pupilIndex: -2 })]) {
    assert.throws(() => makeMatchRecord(bad, '2026-03-04'), /match pair/, 'accepted ' + JSON.stringify(bad));
  }
});
