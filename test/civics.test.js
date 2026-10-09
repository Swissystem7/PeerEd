'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { makeProfile } = require('../src/lib/profile.js');

test('Calling makeProfile with role pupil, region SOUTH, availability MON_18, and subjects CIVICS returns a profile object whose subjects array contains CIVICS as its first element', () => {
  let profile;
  assert.doesNotThrow(() => {
    profile = makeProfile({
      role: 'pupil',
      region: 'SOUTH',
      availability: ['MON_18'],
      subjects: ['CIVICS']
    });
  });
  assert.ok(profile);
  assert.ok(Array.isArray(profile.subjects));
  assert.strictEqual(profile.subjects[0], 'CIVICS');
});
