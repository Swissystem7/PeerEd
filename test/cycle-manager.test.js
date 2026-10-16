'use strict';
// "Nothing is kept indefinitely" is the promise a municipality's privacy officer tests first: the
// boundary day, each category by its own limit, a category the policy does not name, no mutation.
const test = require('node:test');
const assert = require('node:assert/strict');

const { sweep, isExpired, ageInDays, applyRetentionPolicy } = require('../src/lib/cycle-manager.js');
const { matchPairs, makeMatchRecord } = require('../src/lib/match.js');
const { makeProfile } = require('../src/lib/profile.js');
const { getRetentionPolicy } = require('../src/lib/retention.js');

const POLICY = getRetentionPolicy();
const ASOF = '2026-03-04';

// n days before ASOF, as an ISO day.
const daysBefore = (n) => new Date(Date.UTC(2026, 2, 4) - n * 86400000).toISOString().slice(0, 10);
const row = (dataCategory, recordedAt) =>
  Object.freeze({ recordedAt: recordedAt, retention: Object.freeze({ dataCategory: dataCategory }) });

test('cycle sweep: a row is kept through the last day of its window and dropped the day after', () => {
  const lastAllowed = row('match', daysBefore(POLICY.match));
  const firstExpired = row('match', daysBefore(POLICY.match + 1));
  assert.equal(isExpired(lastAllowed, ASOF), false, 'day ' + POLICY.match + ' is still allowed');
  assert.equal(isExpired(firstExpired, ASOF), true, 'day ' + (POLICY.match + 1) + ' is over the limit');

  const out = sweep([lastAllowed, firstExpired], ASOF);
  assert.deepEqual(out.kept, [lastAllowed]);
  assert.deepEqual(out.dropped, [firstExpired]);
});

test('cycle sweep: each category is judged by its own limit', () => {
  const age = POLICY.match + 1;                   // past the match window, inside the profile one
  assert.ok(age <= POLICY.profile, 'this test assumes profiles are kept longer than matches');
  const out = sweep([row('match', daysBefore(age)), row('profile', daysBefore(age))], ASOF);
  assert.deepEqual(out.kept.map((r) => r.retention.dataCategory), ['profile']);
  assert.deepEqual(out.dropped.map((r) => r.retention.dataCategory), ['match']);
});

test('cycle sweep: the limit is read from the policy, so shortening it deletes more', () => {
  // A row stamped under a longer policy cannot outlive a tightened one: only its category is trusted.
  const old = { recordedAt: daysBefore(POLICY.match + 1), retention: { dataCategory: 'match', maxAgeDays: 99999 } };
  assert.equal(isExpired(Object.freeze(old), ASOF), true);
});

test('cycle sweep: an unreadable row is refused, never silently kept', () => {
  assert.throws(() => isExpired(row('audit-log', ASOF), ASOF), /no limit for audit-log/);
  assert.throws(() => isExpired({ recordedAt: ASOF }, ASOF), /recordedAt and retention/);
  assert.throws(() => isExpired(null, ASOF), /recordedAt and retention/);
  assert.throws(() => isExpired([row('match', ASOF)], ASOF), /recordedAt and retention/);
  assert.throws(() => isExpired(row('match', undefined), ASOF), /recordedAt/);
  assert.throws(() => isExpired(row('match', 'last winter'), ASOF), /recordedAt/);
  assert.throws(() => sweep(row('match', ASOF), ASOF), /array of stored rows/);
});

test('cycle sweep: the caller\'s array is never mutated and kept rows are not copied', () => {
  const rows = [row('match', ASOF), row('match', daysBefore(POLICY.match + 1))];
  const before = rows.slice();
  const out = sweep(rows, ASOF);

  assert.deepEqual(rows, before);
  assert.equal(rows.length, 2, 'the sweep answers with new arrays, it does not splice');
  assert.equal(out.kept[0], rows[0], 'a kept row is the same object');
});

test('cycle sweep: the same day gives the same answer, whatever the hour', () => {
  const rows = [row('match', daysBefore(POLICY.match + 1)), row('profile', ASOF)];
  const morning = sweep(rows, new Date('2026-03-04T00:00:00.000Z'));
  const night = sweep(rows, new Date('2026-03-04T23:59:59.000Z'));
  assert.deepEqual(morning, night);
});

test('cycle sweep: a match record from match.js sweeps with no adapter in between', () => {
  const slots = ['SUN_16'];
  const pair = matchPairs(
    [makeProfile({ role: 'student', region: 'CENTER', availability: slots, subjects: ['MATH'] })],
    [makeProfile({ role: 'pupil', region: 'CENTER', availability: slots, subjects: ['MATH'], parentConsent: true })]
  )[0];
  const fresh = makeMatchRecord(pair, daysBefore(1));
  const stale = makeMatchRecord(pair, daysBefore(POLICY.match + 1));

  const out = sweep([fresh, stale], ASOF);
  assert.deepEqual(out.kept, [fresh]);
  assert.deepEqual(out.dropped, [stale]);
});

test('cycle sweep: ageInDays counts whole UTC days', () => {
  assert.equal(ageInDays(ASOF, ASOF), 0);
  assert.equal(ageInDays('2026-03-03T23:00:00.000Z', '2026-03-04T01:00:00.000Z'), 1);
  assert.equal(ageInDays('2026-03-04', '2026-03-03'), -1, 'a row from the future is simply young');
  assert.equal(ageInDays('2025-03-04', ASOF), 365);
  assert.deepEqual(sweep([], ASOF), { kept: [], dropped: [] });
});

// applyRetentionPolicy(): the { matches, profiles } shape, judged by the maxAgeDays stamped on each row.
const st = () => makeProfile({ role: 'student', region: 'CENTER', availability: ['SUN_16'], subjects: ['MATH'] });
const pu = () => makeProfile({ role: 'pupil', region: 'CENTER', availability: ['SUN_16'], subjects: ['MATH'], parentConsent: true });

function storedProfile(profile, recordedAt) {
  return Object.freeze(Object.assign({}, profile, { recordedAt }));
}

test('cycle-manager: omits records older than their retention period', () => {
  const policy = getRetentionPolicy();
  const pair = matchPairs([st()], [pu()])[0];
  const asOf = new Date('2026-06-01T12:00:00.000Z');

  const freshMatch = makeMatchRecord(pair, '2026-01-01');
  const staleMatch = makeMatchRecord(pair, '2024-01-01');

  const freshProfile = storedProfile(makeProfile({
    role: 'student',
    region: 'NORTH',
    availability: ['MON_10'],
    subjects: ['CS']
  }), '2025-06-01');
  const staleProfile = storedProfile(makeProfile({
    role: 'pupil',
    region: 'NORTH',
    availability: ['MON_10'],
    subjects: ['CS']
  }), '2020-01-01');

  const input = { matches: [freshMatch, staleMatch], profiles: [freshProfile, staleProfile] };
  const kept = applyRetentionPolicy(input, asOf);

  assert.deepEqual(kept.matches, [freshMatch]);
  assert.deepEqual(kept.profiles, [freshProfile]);
  assert.equal(freshMatch.retention.maxAgeDays, policy.match);
  assert.equal(freshProfile.retention.maxAgeDays, policy.profile);
});

test('cycle-manager: does not mutate the original arrays', () => {
  const pair = matchPairs([st()], [pu()])[0];
  const matches = [
    makeMatchRecord(pair, '2026-01-01'),
    makeMatchRecord(pair, '2019-01-01')
  ];
  const profiles = [
    storedProfile(st(), '2026-01-01'),
    storedProfile(pu(), '2018-01-01')
  ];
  const input = { matches: matches.slice(), profiles: profiles.slice() };
  const beforeMatches = input.matches.slice();
  const beforeProfiles = input.profiles.slice();

  applyRetentionPolicy(input, new Date('2026-06-01T00:00:00.000Z'));

  assert.deepEqual(input.matches, beforeMatches);
  assert.deepEqual(input.profiles, beforeProfiles);
  assert.equal(input.matches.length, 2);
  assert.equal(input.profiles.length, 2);
});

test('cycle-manager: keeps a record through its last allowed day and drops it the day after', () => {
  const pair = matchPairs([st()], [pu()])[0];
  const policy = getRetentionPolicy();
  const recordedAt = '2025-06-01';
  const match = makeMatchRecord(pair, recordedAt);

  const lastAllowed = new Date('2026-05-31T12:00:00.000Z');
  const firstExpired = new Date('2026-06-02T00:00:00.000Z');

  assert.deepEqual(applyRetentionPolicy({ matches: [match], profiles: [] }, lastAllowed).matches, [match]);
  assert.deepEqual(
    applyRetentionPolicy({ matches: [match], profiles: [] }, firstExpired).matches,
    [],
    'match retention is ' + policy.match + ' days'
  );
});

test('cycle-manager: a maxAgeDays that is not a whole number of days is refused, so no row is kept forever', () => {
  const stamped = (maxAgeDays) => ({ recordedAt: '2020-01-01', retention: { dataCategory: 'match', maxAgeDays: maxAgeDays } });
  for (const bad of [Infinity, NaN, -1, 1.5, '365']) {
    assert.throws(() => applyRetentionPolicy({ matches: [stamped(bad)], profiles: [] }, ASOF), /maxAgeDays/, String(bad));
  }
  assert.deepEqual(applyRetentionPolicy({ matches: [stamped(0)], profiles: [] }, ASOF).matches, []);
});
