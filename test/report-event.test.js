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

const REPORTED_USER = 'p-abcdef01';

test('when a parent reports an event, reportEvent state is saved on the pupil profile', () => {
  const pupil = makeProfile({
    role: 'pupil',
    region: getValidRegion(),
    availability: ['SUN_16'],
    subjects: ['MATH']
  });

  assert.strictEqual(pupil.reportEvent, undefined);
  assert.strictEqual(typeof profileLib.reportEvent, 'function');

  const detail = 'הודעה לא הולמת בשיעור.';
  const reported = profileLib.reportEvent(pupil, { userId: REPORTED_USER, detail: detail });

  assert.ok(Array.isArray(reported.reportEvent));
  assert.strictEqual(reported.reportEvent.length, 1);
  assert.deepStrictEqual(reported.reportEvent[0], { userId: REPORTED_USER, detail: detail });
  assert.strictEqual(pupil.reportEvent, undefined);
});

test('reportEvent keeps the privacy gate and refuses detail that carries personal data', () => {
  const pupil = makeProfile({
    role: 'pupil',
    region: getValidRegion(),
    availability: ['SUN_16'],
    subjects: ['MATH']
  });

  assert.throws(
    () => profileLib.reportEvent({ name: 'x' }, { userId: REPORTED_USER, detail: 'x' }),
    { message: profileLib.PERSONAL_DATA_ERROR }
  );
  assert.throws(
    () => profileLib.reportEvent(pupil, { userId: '0501234567', detail: 'x' }),
    /invalid user id/
  );
  assert.throws(
    () => profileLib.reportEvent(pupil, { userId: REPORTED_USER, detail: 'תתקשר אליי 050-1234567' }),
    { message: validator.PERSONAL_DATA_ERROR }
  );
});

test('reportEvent returns a frozen profile with a copied reportEvent list', () => {
  const pupil = makeProfile({
    role: 'pupil',
    region: getValidRegion(),
    availability: ['SUN_16'],
    subjects: ['MATH']
  });
  const once = profileLib.reportEvent(pupil, { userId: REPORTED_USER, detail: 'אירוע ראשון.' });
  const twice = profileLib.reportEvent(once, { userId: REPORTED_USER, detail: 'אירוע שני.' });

  assert.ok(Object.isFrozen(twice));
  assert.ok(Object.isFrozen(twice.reportEvent));
  assert.notStrictEqual(twice.reportEvent, once.reportEvent);
  assert.strictEqual(twice.reportEvent.length, 2);
  assert.deepStrictEqual(twice.reportEvent[0], once.reportEvent[0]);
});
