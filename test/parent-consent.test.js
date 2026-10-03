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
