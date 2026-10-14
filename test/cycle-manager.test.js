'use strict';
// "Nothing is kept indefinitely" is the promise a municipality's privacy officer tests first: the
// boundary day, each category by its own limit, a category the policy does not name, no mutation.
const test = require('node:test');
const assert = require('node:assert/strict');

const { sweep, isExpired, ageInDays } = require('../src/lib/cycle-manager.js');
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
    [makeProfile({ role: 'pupil', region: 'CENTER', availability: slots, subjects: ['MATH'] })]
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
