'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const { REGIONS, isRegion, normalizeRegion } = require('../src/lib/regions.js');
const { makeProfile, PERSONAL_DATA_ERROR } = require('../src/lib/profile.js');
const { getRetentionPolicy } = require('../src/lib/retention.js');
const { matchPairs } = require('../src/lib/match.js');

test('regions: isRegion accepts every REGIONS entry and rejects everything else', () => {
  assert.deepEqual(REGIONS, ['NORTH', 'HAIFA', 'CENTER', 'TEL_AVIV', 'JERUSALEM', 'SOUTH']);
  assert.ok(Object.isFrozen(REGIONS));
  for (const code of REGIONS) assert.equal(isRegion(code), true, code);
  for (const bad of ['north', 'ABC', 123, null, undefined, {}, ['NORTH'], '']) {
    assert.equal(isRegion(bad), false, String(bad));
  }
});

test('regions: normalizeRegion trims and upper-cases, otherwise null', () => {
  assert.equal(normalizeRegion('  north '), 'NORTH');
  assert.equal(normalizeRegion('tel_aviv'), 'TEL_AVIV');
  assert.equal(normalizeRegion('Tel Aviv'), null);
  assert.equal(normalizeRegion(''), null);
  assert.equal(normalizeRegion(42), null);
  assert.equal(normalizeRegion(null), null);
});

const VALID = { role: 'student', region: 'CENTER', availability: ['SUN_16', 'MON_18'], subjects: ['MATH', 'CS'] };

test('profile: any personal field is rejected with the exact message, even when empty', () => {
  for (const field of ['name', 'email', 'phone', 'id', 'address', 'school', 'birthdate', 'parent']) {
    for (const value of ['', 'x', null]) {
      const input = Object.assign({}, VALID);
      input[field] = value;
      assert.throws(() => makeProfile(input), { message: PERSONAL_DATA_ERROR }, field + '=' + JSON.stringify(value));
    }
  }
  assert.equal(PERSONAL_DATA_ERROR, 'personal data is not accepted');
});

test('profile: invalid role / region / availability / slot / subjects name the offending field', () => {
  assert.throws(() => makeProfile(Object.assign({}, VALID, { role: 'teacher' })), /role/);
  assert.throws(() => makeProfile(Object.assign({}, VALID, { region: 'center' })), /region/);
  assert.throws(() => makeProfile(Object.assign({}, VALID, { availability: [] })), /availability/);
  assert.throws(() => makeProfile(Object.assign({}, VALID, { availability: ['SUN_7'] })), /availability/);
  assert.throws(() => makeProfile(Object.assign({}, VALID, { availability: ['XYZ_16'] })), /availability/);
  assert.throws(() => makeProfile(Object.assign({}, VALID, { availability: ['sun_16'] })), /availability/);
  assert.throws(() => makeProfile(Object.assign({}, VALID, { subjects: [] })), /subjects/);
  assert.throws(() => makeProfile(Object.assign({}, VALID, { subjects: ['ART'] })), /subjects/);
  assert.throws(() => makeProfile(null), /object/);
  assert.throws(() => makeProfile('student'), /object/);
});

test('profile: a valid input yields a frozen four-field object that cannot be mutated', () => {
  const p = makeProfile(VALID);
  assert.equal(p.role, 'student');
  assert.equal(p.region, 'CENTER');
  assert.deepEqual(p.availability, ['SUN_16', 'MON_18']);
  assert.deepEqual(p.subjects, ['MATH', 'CS']);
  assert.equal(p.retention.dataCategory, 'profile');
  assert.equal(p.retention.maxAgeDays, getRetentionPolicy().profile);
  assert.ok(Object.isFrozen(p.retention));
  assert.deepEqual(Object.keys(p).sort(), ['availability', 'region', 'retention', 'role', 'subjects']);
  assert.ok(Object.isFrozen(p));
  assert.throws(() => { 'use strict'; p.role = 'pupil'; }, TypeError);
  assert.throws(() => { 'use strict'; p.name = 'x'; }, TypeError);
  assert.throws(() => { 'use strict'; p.subjects.push('HEBREW'); }, TypeError);
  assert.equal(p.role, 'student');
  assert.deepEqual(p.subjects, ['MATH', 'CS']);
  // the input arrays are copied, not shared
  const input = { role: 'pupil', region: 'SOUTH', availability: ['TUE_17'], subjects: ['ENGLISH'] };
  const q = makeProfile(input);
  input.availability.push('WED_17');
  assert.deepEqual(q.availability, ['TUE_17']);
});

test('match: deterministic, and [] when region, slots or subjects do not overlap', () => {
  const s = [makeProfile({ role: 'student', region: 'CENTER', availability: ['SUN_16'], subjects: ['MATH'] })];
  const p = [makeProfile({ role: 'pupil', region: 'CENTER', availability: ['SUN_16'], subjects: ['MATH'] })];
  const first = matchPairs(s, p);
  const second = matchPairs(s, p);
  assert.deepEqual(first, second);
  assert.deepEqual(first, [{ studentIndex: 0, pupilIndex: 0, region: 'CENTER', sharedSlots: ['SUN_16'], sharedSubjects: ['MATH'] }]);
  assert.deepEqual(matchPairs(s, [makeProfile({ role: 'pupil', region: 'SOUTH', availability: ['SUN_16'], subjects: ['MATH'] })]), []);
  assert.deepEqual(matchPairs(s, [makeProfile({ role: 'pupil', region: 'CENTER', availability: ['MON_16'], subjects: ['MATH'] })]), []);
  assert.deepEqual(matchPairs(s, [makeProfile({ role: 'pupil', region: 'CENTER', availability: ['SUN_16'], subjects: ['CS'] })]), []);
  assert.deepEqual(matchPairs([], p), []);
  assert.deepEqual(matchPairs(s, []), []);
});

test('match: worked example — three students, three pupils, two regions, ordering rule decides', () => {
  const students = [
    makeProfile({ role: 'student', region: 'CENTER', availability: ['SUN_16', 'MON_18'], subjects: ['MATH', 'CS'] }),
    makeProfile({ role: 'student', region: 'CENTER', availability: ['SUN_16'], subjects: ['MATH'] }),
    makeProfile({ role: 'student', region: 'SOUTH', availability: ['TUE_17', 'WED_17'], subjects: ['PHYSICS', 'ENGLISH'] })
  ];
  const pupils = [
    makeProfile({ role: 'pupil', region: 'CENTER', availability: ['SUN_16', 'MON_18'], subjects: ['CS', 'MATH', 'HEBREW'] }),
    makeProfile({ role: 'pupil', region: 'CENTER', availability: ['SUN_16'], subjects: ['MATH', 'PHYSICS'] }),
    makeProfile({ role: 'pupil', region: 'SOUTH', availability: ['WED_17'], subjects: ['ENGLISH'] })
  ];
  // candidates: s0-p0 (2 slots, 2 subjects) first; then the (1,1) ties by student index then pupil index:
  // s0-p1 (student 0 already used), s1-p0 (pupil 0 already used), s1-p1 taken, s2-p2 taken.
  const expected = [
    { studentIndex: 0, pupilIndex: 0, region: 'CENTER', sharedSlots: ['MON_18', 'SUN_16'], sharedSubjects: ['CS', 'MATH'] },
    { studentIndex: 1, pupilIndex: 1, region: 'CENTER', sharedSlots: ['SUN_16'], sharedSubjects: ['MATH'] },
    { studentIndex: 2, pupilIndex: 2, region: 'SOUTH', sharedSlots: ['WED_17'], sharedSubjects: ['ENGLISH'] }
  ];
  assert.deepStrictEqual(matchPairs(students, pupils), expected);
  assert.deepStrictEqual(matchPairs(students, pupils), expected, 'second call is identical');
});

test('match: each participant appears at most once and the better-scored pair wins the shared participant', () => {
  const students = [
    makeProfile({ role: 'student', region: 'NORTH', availability: ['SUN_16'], subjects: ['MATH'] }),
    makeProfile({ role: 'student', region: 'NORTH', availability: ['SUN_16', 'MON_16'], subjects: ['MATH'] })
  ];
  const pupils = [makeProfile({ role: 'pupil', region: 'NORTH', availability: ['SUN_16', 'MON_16'], subjects: ['MATH'] })];
  const pairs = matchPairs(students, pupils);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].studentIndex, 1, 'two shared slots beat one, even with a higher student index');
  const ids = pairs.map((x) => x.studentIndex + ':' + x.pupilIndex);
  assert.equal(new Set(ids).size, ids.length);
});
