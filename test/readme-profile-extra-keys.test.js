'use strict';
// The README's profile.js row said the record holds role, region, hours, subjects and a pupil's consent,
// over a module whose ACCEPTED_FIELDS also take blockedUsers, reportEvent and responseToReport - lists no
// screen writes, but a stored person carrying them loads and keeps them. The row must name them.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const profile = require('../src/lib/profile.js');

const root = path.join(__dirname, '..');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const row = readme.split('\n').find(function (line) { return line.startsWith('| `src/lib/profile.js`'); });

test('README: the profile.js row names every field the module accepts', () => {
  assert.ok(row, 'the README has a profile.js row');
  for (const field of profile.ACCEPTED_FIELDS) {
    assert.ok(row.includes(field) || ['role', 'region', 'availability', 'subjects'].includes(field),
      'the row names ' + field);
  }
  assert.match(row, /no screen writes or shows/);
});
