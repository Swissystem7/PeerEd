'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { getRetentionPolicy } = require('../src/lib/retention.js');
const { makeProfile } = require('../src/lib/profile.js');

test('retention: policy is frozen and maps profile and match to finite day limits', () => {
  const policy = getRetentionPolicy();
  assert.ok(Object.isFrozen(policy));

  assert.equal(typeof policy.profile, 'number');
  assert.equal(typeof policy.match, 'number');
  assert.ok(Number.isFinite(policy.profile) && policy.profile > 0);
  assert.ok(Number.isFinite(policy.match) && policy.match > 0);
  assert.notEqual(policy.profile, Infinity);
  assert.notEqual(policy.match, Infinity);
});

test('retention: new profiles carry the profile category limit from the active policy', () => {
  const policy = getRetentionPolicy();
  const profile = makeProfile({
    role: 'student',
    region: 'CENTER',
    availability: ['SUN_16'],
    subjects: ['MATH']
  });

  assert.ok(Object.isFrozen(profile.retention));
  assert.equal(profile.retention.dataCategory, 'profile');
  assert.equal(profile.retention.maxAgeDays, policy.profile);
});
