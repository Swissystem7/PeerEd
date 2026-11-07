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

// applyRetentionPolicy(): the { matches, profiles } shape, judged by the policy's limit like sweep().
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

test('cycle-manager: the stamp on a row is not its limit, so a tightened policy deletes what an older one kept', () => {
  // the same row the sweep test refuses to keep: a match from past the window, stamped 99999 on disk
  const stale = { recordedAt: daysBefore(POLICY.match + 1), retention: { dataCategory: 'match', maxAgeDays: 99999 } };
  const fresh = { recordedAt: daysBefore(POLICY.match), retention: { dataCategory: 'match', maxAgeDays: 99999 } };
  const out = applyRetentionPolicy({ matches: [stale, fresh], profiles: [] }, ASOF);
  assert.deepEqual(out.matches, [fresh], 'the policy window, not the stamp, decides');
  // and a stamp shorter than the policy does not delete early either: the limit is the policy's
  const short = { recordedAt: daysBefore(10), retention: { dataCategory: 'profile', maxAgeDays: 1 } };
  assert.deepEqual(applyRetentionPolicy({ matches: [], profiles: [short] }, ASOF).profiles, [short]);
  // a category the policy does not name is refused here as in sweep(), never kept on its own stamp
  const foreign = { recordedAt: ASOF, retention: { dataCategory: 'audit-log', maxAgeDays: 30 } };
  assert.throws(() => applyRetentionPolicy({ matches: [foreign], profiles: [] }, ASOF), /no limit for audit-log/);
});

test('cycle-manager: applyRetentionPolicy throws when stored input is null, undefined, primitive, or array', () => {
  for (const bad of [null, undefined, 'invalid', 123, 0, true, false, Symbol('stored'), 10n, [], ['records']]) {
    assert.throws(
      () => applyRetentionPolicy(bad, ASOF),
      /stored input must be an object with matches and profiles arrays/
    );
  }
});

test('cycle-manager: applyRetentionPolicy defaults empty object or non-array matches/profiles gracefully to empty arrays', () => {
  assert.deepEqual(applyRetentionPolicy({}, ASOF), { matches: [], profiles: [] });
  assert.deepEqual(applyRetentionPolicy({ matches: null, profiles: undefined }, ASOF), { matches: [], profiles: [] });
  assert.deepEqual(applyRetentionPolicy({ matches: 'not-array', profiles: 123 }, ASOF), { matches: [], profiles: [] });
  assert.deepEqual(applyRetentionPolicy({ matches: {}, profiles: false }, ASOF), { matches: [], profiles: [] });
  assert.deepEqual(applyRetentionPolicy({ matches: undefined }, ASOF), { matches: [], profiles: [] });
  assert.deepEqual(applyRetentionPolicy({ profiles: undefined }, ASOF), { matches: [], profiles: [] });

  const validMatch = makeMatchRecord(matchPairs([st()], [pu()])[0], '2026-03-01');
  const validProfile = storedProfile(st(), '2026-03-01');

  assert.deepEqual(
    applyRetentionPolicy({ matches: [validMatch], profiles: null }, ASOF),
    { matches: [validMatch], profiles: [] }
  );
  assert.deepEqual(
    applyRetentionPolicy({ matches: undefined, profiles: [validProfile] }, ASOF),
    { matches: [], profiles: [validProfile] }
  );
});

test('cycle-manager: records within matches or profiles validate their structure', () => {
  // Non-object records throw /retention record must be an object/
  for (const badRecord of [null, undefined, 'string', 42, true, Symbol('record')]) {
    assert.throws(
      () => applyRetentionPolicy({ matches: [badRecord], profiles: [] }, ASOF),
      /retention record must be an object/
    );
    assert.throws(
      () => applyRetentionPolicy({ matches: [], profiles: [badRecord] }, ASOF),
      /retention record must be an object/
    );
  }

  // Records missing retention or retention.maxAgeDays throw /retention record is missing maxAgeDays/
  const missingMaxAge = [
    { recordedAt: ASOF },
    { recordedAt: ASOF, retention: null },
    { recordedAt: ASOF, retention: undefined },
    { recordedAt: ASOF, retention: {} },
    { recordedAt: ASOF, retention: { maxAgeDays: undefined } },
    { recordedAt: ASOF, retention: { dataCategory: 'match' } }
  ];
  for (const badRecord of missingMaxAge) {
    assert.throws(
      () => applyRetentionPolicy({ matches: [badRecord], profiles: [] }, ASOF),
      /retention record is missing maxAgeDays/
    );
    assert.throws(
      () => applyRetentionPolicy({ matches: [], profiles: [badRecord] }, ASOF),
      /retention record is missing maxAgeDays/
    );
  }

  // Records where recordedAt is missing or null throw /retention record is missing recordedAt/
  const missingRecordedAt = [
    { retention: { dataCategory: 'match', maxAgeDays: 30 } },
    { recordedAt: undefined, retention: { dataCategory: 'match', maxAgeDays: 30 } },
    { recordedAt: null, retention: { dataCategory: 'match', maxAgeDays: 30 } }
  ];
  for (const badRecord of missingRecordedAt) {
    assert.throws(
      () => applyRetentionPolicy({ matches: [badRecord], profiles: [] }, ASOF),
      /retention record is missing recordedAt/
    );
    assert.throws(
      () => applyRetentionPolicy({ matches: [], profiles: [badRecord] }, ASOF),
      /retention record is missing recordedAt/
    );
  }
});

test('cycle sweep: a day is read only from a Date or an ISO string, and only if the calendar has it', () => {
  // the legacy parser rolled '2026-02-30' into March, read '12' as 2001 and '3/4/2026' on the local clock
  for (const bad of ['2026-02-30', '2025-02-29', '3/4/2026', 'March 4 2026', '12', '2026', '2026-03-04T10:00', 12, 0, true]) {
    assert.throws(() => isExpired(row('match', bad), ASOF), /invalid recordedAt/, JSON.stringify(bad));
    assert.throws(() => isExpired(row('match', ASOF), bad), /invalid asOf/, JSON.stringify(bad));
  }
  assert.equal(ageInDays('2024-02-29', '2024-03-01'), 1, 'a real leap day is still a day');
  assert.equal(ageInDays('2026-03-04T01:30:00+03:00', ASOF), 1, 'an offset is honoured: that is 3 March in UTC');
  assert.equal(ageInDays(new Date(Date.UTC(2026, 2, 3)), ASOF), 1);
});

test('cycle sweep: a day in the years 0-99 stays in its own century', () => {
  // Date.UTC reads the year 50 as 1950, so a row from the year 50 was 1900 years too young
  const year50 = new Date(0);
  year50.setUTCFullYear(50, 0, 1);
  const year51 = new Date(0);
  year51.setUTCFullYear(51, 0, 1);
  assert.equal(ageInDays(year50, year51), 365);
  assert.equal(ageInDays('0050-01-01', '0051-01-01'), 365, 'the ISO day is read, not refused');
  assert.equal(ageInDays(year50, '2026-01-01'), ageInDays('0050-01-01', '2026-01-01'));
  assert.ok(ageInDays(year50, '2026-01-01') > 700000);
});
