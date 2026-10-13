'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { applyRetentionPolicy } = require('../src/lib/cycle-manager.js');
const { makeMatchRecord, matchPairs } = require('../src/lib/match.js');
const { makeProfile } = require('../src/lib/profile.js');
const { getRetentionPolicy } = require('../src/lib/retention.js');

const st = () => makeProfile({ role: 'student', region: 'CENTER', availability: ['SUN_16'], subjects: ['MATH'] });
const pu = () => makeProfile({ role: 'pupil', region: 'CENTER', availability: ['SUN_16'], subjects: ['MATH'] });

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
