'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const profileLib = require('../src/lib/profile.js');
const { makeProfile } = profileLib;
const validator = require('../src/lib/validator.js');
const regionsLib = require('../src/lib/regions.js');

function getValidRegion() {
  const candidateRegions = ['NORTH', 'SOUTH', 'CENTER', 'JERUSALEM', 'HAIFA', 'TEL_AVIV', 'IL-NORTH', 'IL_NORTH', 'NORTHERN'];
  for (let i = 0; i < candidateRegions.length; i += 1) {
    if (typeof regionsLib.isRegion === 'function' && regionsLib.isRegion(candidateRegions[i])) {
      return candidateRegions[i];
    }
  }
  if (regionsLib.REGIONS) {
    if (Array.isArray(regionsLib.REGIONS) && regionsLib.REGIONS.length > 0) {
      return regionsLib.REGIONS[0];
    }
    const keys = Object.keys(regionsLib.REGIONS);
    if (keys.length > 0) {
      return typeof regionsLib.REGIONS[keys[0]] === 'string' ? regionsLib.REGIONS[keys[0]] : keys[0];
    }
  }
  return 'NORTH';
}

const OTHER_USER = 'p-00000001';
const BLOCKED_USER = 'p-abcdef01';

test('when a user is blocked, checkBlocked returns true for that user', () => {
  const region = getValidRegion();
  const pupil = makeProfile({
    role: 'pupil',
    region: region,
    availability: ['SUN_16'],
    subjects: ['MATH']
  });

  assert.strictEqual(typeof profileLib.checkBlocked, 'function');
  assert.strictEqual(typeof profileLib.blockUser, 'function');
  assert.strictEqual(profileLib.checkBlocked(pupil, BLOCKED_USER), false);
  assert.strictEqual(profileLib.checkBlocked(pupil, OTHER_USER), false);

  const blocked = profileLib.blockUser(pupil, BLOCKED_USER);
  assert.strictEqual(profileLib.checkBlocked(blocked, BLOCKED_USER), true);
  assert.strictEqual(profileLib.checkBlocked(blocked, OTHER_USER), false);

  assert.strictEqual(profileLib.checkBlocked(pupil, BLOCKED_USER), false);
});

test('blockUser keeps the privacy gate and refuses opaque ids that carry personal data', () => {
  assert.throws(
    () => profileLib.blockUser({ name: 'x' }, BLOCKED_USER),
    { message: profileLib.PERSONAL_DATA_ERROR }
  );
  assert.throws(
    () => validator.assertUserId('0501234567'),
    /invalid user id/
  );
  assert.throws(
    () => profileLib.blockUser(
      makeProfile({ role: 'pupil', region: getValidRegion(), availability: ['SUN_16'], subjects: ['MATH'] }),
      'not-a-peer-id'
    ),
    /invalid user id/
  );
});

test('blockUser returns a frozen profile with a copied blockedUsers list', () => {
  const pupil = makeProfile({
    role: 'pupil',
    region: getValidRegion(),
    availability: ['SUN_16'],
    subjects: ['MATH']
  });
  const once = profileLib.blockUser(pupil, BLOCKED_USER);
  const twice = profileLib.blockUser(once, BLOCKED_USER);
  assert.ok(Object.isFrozen(twice));
  assert.ok(Object.isFrozen(twice.blockedUsers));
  assert.notStrictEqual(twice.blockedUsers, once.blockedUsers);
  assert.deepStrictEqual(twice.blockedUsers, [BLOCKED_USER]);
  assert.deepStrictEqual(twice.blockedUsers, once.blockedUsers);
});
