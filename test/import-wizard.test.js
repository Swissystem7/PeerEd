'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseAvailabilityCsv } = require('../src/lib/import-availability.js');
const { encodeAvailabilityLink, decodeAvailabilityLink } = require('../src/lib/wizard-link.js');

const HEADER = 'role,region,subjects,availability\n';

test('import: valid rows become profiles, bad rows are per-line errors, consent never imported', () => {
  const r = parseAvailabilityCsv(HEADER + 'student,center,MATH;ENGLISH,SUN_8;SUN_09\npupil,NORTH,MATH,MON_8\nstudent,MOON,MATH,SUN_8\npupil,CENTER,MATH,SUN_25');
  assert.equal(r.profiles.length, 2);
  assert.equal(r.profiles[0].availability.join(','), 'SUN_8,SUN_9');
  assert.equal(r.profiles[1].parentConsent, false);
  assert.deepEqual(r.errors.map((e) => e.reason), ['INVALID_REGION', 'INVALID_SLOT']);
});

test('import: a phone or email anywhere refuses the whole paste', () => {
  assert.throws(() => parseAvailabilityCsv(HEADER + 'student,CENTER,MATH,SUN_8\ncall 050-1234567'), /personal data is not accepted/);
  assert.throws(() => parseAvailabilityCsv('role,region,subjects,availability,0501234567'), /invalid import header|personal data/);
  assert.throws(() => parseAvailabilityCsv('x'), /invalid import header/);
});

test('wizard link: round trip, tamper refused, extra key refused, no identifier inside', () => {
  const input = { role: 'student', region: 'CENTER', subjects: ['MATH'], availability: ['SUN_8', 'MON_10'] };
  const link = encodeAvailabilityLink(input);
  assert.match(link, /^#a=[A-Za-z0-9_-]+\.[0-9a-f]{8}$/);
  const back = decodeAvailabilityLink(link);
  assert.equal(back.role, 'student'); assert.deepEqual(Array.from(back.availability), ['SUN_8', 'MON_10']);
  assert.throws(() => decodeAvailabilityLink(link.slice(0, -1) + (link.endsWith('0') ? '1' : '0')), /invalid availability link/);
  assert.throws(() => encodeAvailabilityLink(Object.assign({}, input, { name: 'x' })), /invalid availability link/);
});
