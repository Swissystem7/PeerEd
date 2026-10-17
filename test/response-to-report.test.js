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

test('when a response is received on a report, responseToReport state is saved on the pupil profile', () => {
  const pupil = makeProfile({
    role: 'pupil',
    region: getValidRegion(),
    availability: ['SUN_16'],
    subjects: ['MATH']
  });
  const withReport = profileLib.reportEvent(pupil, { userId: REPORTED_USER, detail: 'הודעה לא הולמת בשיעור.' });

  assert.strictEqual(withReport.responseToReport, undefined);
  assert.strictEqual(typeof profileLib.responseToReport, 'function');

  const reply = 'הדיווח התקבל ויטופל.';
  const responded = profileLib.responseToReport(withReport, { reportIndex: 0, detail: reply });

  assert.ok(Array.isArray(responded.responseToReport));
  assert.strictEqual(responded.responseToReport.length, 1);
  assert.deepStrictEqual(responded.responseToReport[0], { reportIndex: 0, detail: reply });
  assert.strictEqual(withReport.responseToReport, undefined);
});

test('responseToReport keeps the privacy gate and refuses detail that carries personal data', () => {
  const pupil = makeProfile({
    role: 'pupil',
    region: getValidRegion(),
    availability: ['SUN_16'],
    subjects: ['MATH']
  });
  const withReport = profileLib.reportEvent(pupil, { userId: REPORTED_USER, detail: 'אירוע.' });

  assert.throws(
    () => profileLib.responseToReport({ name: 'x' }, { reportIndex: 0, detail: 'x' }),
    { message: profileLib.PERSONAL_DATA_ERROR }
  );
  assert.throws(
    () => profileLib.responseToReport(withReport, { reportIndex: 0, detail: 'תתקשר אליי 050-1234567' }),
    { message: validator.PERSONAL_DATA_ERROR }
  );
});

test('responseToReport returns a frozen profile with a copied responseToReport list', () => {
  const pupil = makeProfile({
    role: 'pupil',
    region: getValidRegion(),
    availability: ['SUN_16'],
    subjects: ['MATH']
  });
  const withReport = profileLib.reportEvent(pupil, { userId: REPORTED_USER, detail: 'אירוע ראשון.' });
  const once = profileLib.responseToReport(withReport, { reportIndex: 0, detail: 'תגובה ראשונה.' });
  const twice = profileLib.responseToReport(once, { reportIndex: 0, detail: 'תגובה שנייה.' });

  assert.ok(Object.isFrozen(twice));
  assert.ok(Object.isFrozen(twice.responseToReport));
  assert.notStrictEqual(twice.responseToReport, once.responseToReport);
  assert.strictEqual(twice.responseToReport.length, 2);
  assert.deepStrictEqual(twice.responseToReport[0], once.responseToReport[0]);
});

test('a malformed response to report names responseToReport in its error, not reportEvent or unit', () => {
  const base = { role: 'pupil', region: getValidRegion(), availability: ['SUN_16'], subjects: ['MATH'] };
  assert.throws(() => makeProfile(Object.assign({}, base, { responseToReport: 'x' })), { message: 'invalid responseToReport: expected an array' });
  assert.throws(() => validator.makeResponseToReport({ reportIndex: 0, detail: 42 }), { message: 'invalid detail: expected a string' });
  for (const bad of [null, [], 'x']) {
    assert.throws(() => validator.makeResponseToReport(bad), { message: 'response to report input must be an object with reportIndex, detail' });
  }
});
