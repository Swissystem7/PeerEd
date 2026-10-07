'use strict';

const test = require('node:test');
const assert = require('node:assert');
const profileLib = require('../src/lib/profile.js');
const { makeProfile } = profileLib;
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

test('pupil profile parentConsent defaults to false and updates to true upon parent approval', () => {
  const region = getValidRegion();
  const pupil = makeProfile({
    role: 'pupil',
    region: region,
    availability: ['SUN_16'],
    subjects: ['MATH']
  });

  // Contract: default parentConsent on pupil profile is false
  assert.strictEqual(pupil.parentConsent, false);

  // Contract: parent approval sets parentConsent to true
  assert.strictEqual(typeof profileLib.setParentConsent, 'function');
  const approvedPupil = profileLib.setParentConsent(pupil, true);
  assert.strictEqual(approvedPupil.parentConsent, true);

  // Immutability: original profile remains unchanged
  assert.strictEqual(pupil.parentConsent, false);

  // Disapproving/revoking sets parentConsent to false
  const revokedPupil = profileLib.setParentConsent(approvedPupil, false);
  assert.strictEqual(revokedPupil.parentConsent, false);

  // Profile creation with explicit parentConsent: true sets parentConsent to true
  const preApproved = makeProfile({
    role: 'pupil',
    region: region,
    availability: ['SUN_16'],
    subjects: ['MATH'],
    parentConsent: true
  });
  assert.strictEqual(preApproved.parentConsent, true);
});

test('setParentConsent keeps the privacy gate: a record with personal data is refused, not copied', () => {
  // Before this test the function copied any object it was given, so a name or a phone number could
  // enter the system through the consent path without ever meeting makeProfile.
  assert.throws(
    () => profileLib.setParentConsent({ name: 'x', phone: '0501234567' }, true),
    { message: profileLib.PERSONAL_DATA_ERROR }
  );
  assert.throws(
    () => profileLib.grantParentConsent({
      role: 'pupil', region: getValidRegion(), availability: ['SUN_16'], subjects: ['MATH'], email: 'a@b.co'
    }),
    { message: profileLib.PERSONAL_DATA_ERROR }
  );
  // A broken record is re-validated on the way, with the same error makeProfile gives.
  assert.throws(
    () => profileLib.revokeParentConsent({ role: 'pupil', region: 'NOWHERE', availability: ['SUN_16'], subjects: ['MATH'] }),
    { message: /invalid region/ }
  );
});

test('setParentConsent returns a frozen profile with copied arrays, like makeProfile', () => {
  const pupil = makeProfile({ role: 'pupil', region: getValidRegion(), availability: ['SUN_16'], subjects: ['MATH'] });
  const approved = profileLib.grantParentConsent(pupil);
  assert.ok(Object.isFrozen(approved));
  assert.ok(Object.isFrozen(approved.availability));
  assert.notStrictEqual(approved.availability, pupil.availability);
  assert.deepStrictEqual(approved.availability, pupil.availability);
  assert.deepStrictEqual(Object.keys(approved).sort(), ['availability', 'parentConsent', 'region', 'role', 'subjects']);
  // a student gets an explicit flag too, and nothing else changes
  const student = makeProfile({ role: 'student', region: getValidRegion(), availability: ['SUN_16'], subjects: ['MATH'] });
  assert.strictEqual(student.parentConsent, undefined);
  assert.strictEqual(profileLib.revokeParentConsent(student).parentConsent, false);
});

test('setParentConsent takes a real boolean only: a form string never records consent', () => {
  // Before this test the value went through Boolean(), so 'false', 'no' or '0' from a form
  // recorded a consent the parent never gave.
  const pupil = makeProfile({ role: 'pupil', region: getValidRegion(), availability: ['SUN_16'], subjects: ['MATH'] });
  ['false', 'no', '0', 'true', 1, 0, null, {}].forEach((value) => {
    assert.throws(() => profileLib.setParentConsent(pupil, value), { message: /invalid parentConsent/ });
  });
  // omitted still means grant, as before
  assert.strictEqual(profileLib.setParentConsent(pupil).parentConsent, true);
});
