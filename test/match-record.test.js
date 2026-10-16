'use strict';
// A stored pair must carry its own expiry: the retention policy is only real if every row written down
// says which category it belongs to and when it was kept. These tests pin that down, and pin down that
// makeMatchRecord() reads no clock of its own.
const test = require('node:test');
const assert = require('node:assert/strict');

const { matchPairs, matchAcrossRegions, makeMatchRecord } = require('../src/lib/match.js');
const { makeProfile } = require('../src/lib/profile.js');
const { getRetentionPolicy } = require('../src/lib/retention.js');
const { isExpired } = require('../src/lib/cycle-manager.js');

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

test('match record: recordedAt is a real ISO day, never a guess of the engine\'s legacy parser', () => {
  // a day the calendar has not, a local-clock date, a bare number, a timestamp with no offset, a number
  for (const bad of ['2026-02-30', '2026-13-01', '3/4/2026', '12', '2026-03-04T10:00', 'March 4 2026',
    '2026-03-04T25:00Z', 1772582400000]) {
    assert.throws(() => makeMatchRecord(onePair(), bad), /recordedAt/, 'accepted ' + String(bad));
  }
  assert.equal(makeMatchRecord(onePair(), '2026-02-28').recordedAt, '2026-02-28');
  assert.equal(makeMatchRecord(onePair(), '2026-03-04T10:00:00.000Z').recordedAt, '2026-03-04');
  // an offset is honoured: 23:30 in New York is already the next UTC day
  assert.equal(makeMatchRecord(onePair(), '2026-03-04T23:30-05:00').recordedAt, '2026-03-05');
});

test('match record: a day outside the years the sweep reads back is refused, not stored broken', () => {
  // an offset can carry the last day of 9999 into the year 10000 (or the first day of 0 back into -1),
  // and a Date can be any year
  for (const bad of ['9999-12-31T23:00-05:00', new Date(Date.UTC(10000, 0, 1)), '0000-01-01T00:30+01:00']) {
    assert.throws(() => makeMatchRecord(onePair(), bad), /recordedAt/, 'accepted ' + String(bad));
  }
  const row = makeMatchRecord(onePair(), '9999-12-31');
  assert.equal(row.recordedAt, '9999-12-31');
  assert.equal(isExpired(row, '9999-12-31'), false, 'the sweep reads the stored day back');
});

test('match record: a day in the years 0-99 is stored, and the sweep reads it in its own century', () => {
  for (const day of ['0050-01-01', '0000-01-01']) {
    const row = makeMatchRecord(onePair(), day);
    assert.equal(row.recordedAt, day);
    assert.equal(isExpired(row, day), false, 'the sweep reads the stored day back');
    assert.equal(isExpired(row, '2026-01-01'), true, 'a row from ' + day + ' is not 1900 years younger');
  }
});

test('match record: anything that is not a matchPairs() candidate is refused', () => {
  const pair = onePair();
  for (const bad of [null, undefined, 'SUN_16', [pair], {}, Object.assign({}, pair, { sharedSlots: 'SUN_16' }),
    Object.assign({}, pair, { studentIndex: -1 }), Object.assign({}, pair, { pupilIndex: -2 }),
    Object.assign({}, pair, { region: undefined }), Object.assign({}, pair, { region: undefined, pupilRegion: 'NORTH' })]) {
    assert.throws(() => makeMatchRecord(bad, '2026-03-04'), /match pair/, 'accepted ' + JSON.stringify(bad));
  }
});

test('match record: a matchAcrossRegions() pair keeps both regions after a JSON round trip', () => {
  const s = makeProfile({ role: 'student', region: 'CENTER', availability: ['MON_18'], subjects: ['MATH'] });
  const p = makeProfile({ role: 'pupil', region: 'NORTH', availability: ['MON_18'], subjects: ['MATH'], parentConsent: true });
  const across = matchAcrossRegions([s], [p], matchPairs([s], [p]));
  assert.equal(across.length, 1);
  const row = JSON.parse(JSON.stringify(makeMatchRecord(across[0], '2026-03-04')));
  assert.equal(row.studentRegion, 'CENTER');
  assert.equal(row.pupilRegion, 'NORTH');
  assert.equal('region' in row, false, 'a cross-region row has no single region');
});
