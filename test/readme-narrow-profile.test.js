'use strict';
// The README's "Why the profile is so narrow" said "The matching only needs region, availability and subject.
// Every additional field would be personal data about a minor, so the code refuses it outright" - but
// makeProfile also takes role, parentConsent and three lists no screen writes, and stamps a retention record.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
const profile = require('../src/lib/profile.js');

function narrowSection() {
  const start = readme.indexOf('## Why the profile is so narrow');
  assert.ok(start !== -1, 'the README should still have the narrow-profile section');
  return readme.slice(start);
}

test('the narrow-profile section names every field makeProfile accepts', () => {
  const section = narrowSection();
  assert.doesNotMatch(section, /only needs region, availability and subject\./);
  for (const field of ['blockedUsers', 'reportEvent', 'responseToReport']) {
    assert.match(section, new RegExp('`' + field + '`'), field);
  }
  for (const word of ['role', 'region', 'availability', 'subject', 'parent-consent']) {
    assert.match(section, new RegExp(word), word);
  }
  assert.deepEqual(profile.ACCEPTED_FIELDS.slice().sort(),
    ['availability', 'blockedUsers', 'parentConsent', 'region', 'reportEvent', 'responseToReport', 'role', 'subjects']);
});

test('makeProfile writes the retention stamp the section names and refuses any other field', () => {
  const made = profile.makeProfile({ role: 'pupil', region: 'NORTH', availability: ['SUN_8'], subjects: ['MATH'] });
  assert.deepEqual(Object.keys(made.retention).sort(), ['dataCategory', 'maxAgeDays']);
  assert.match(narrowSection(), /`retention`, holding only `dataCategory` and `maxAgeDays`/);
  assert.throws(() => profile.makeProfile({ role: 'pupil', region: 'NORTH', availability: ['SUN_8'],
    subjects: ['MATH'], school: 'x' }), /personal data is not accepted/);
});
