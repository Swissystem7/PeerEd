'use strict';
// One hour, one spelling. The engine compares availability slots as strings, so 'SUN_08' and 'SUN_8'
// were two different hours to it: both passed isSlot, neither met the other in matchPairs, and the
// coordinator saw NO_SHARED_SLOT for two people free at the same time. makeProfile now stores the
// canonical spelling (no leading zero) and drops repeats, and store.load runs every stored record
// through makeProfile, so a document written by an older build comes back canonical too.

const test = require('node:test');
const assert = require('node:assert');
const { makeProfile, isSlot, normalizeSlot } = require('../src/lib/profile.js');
const { matchPairs, explainUnmatched } = require('../src/lib/match.js');
const { createStore, memoryBackend, SCHEMA } = require('../src/lib/store.js');

test('normalizeSlot: the canonical spelling has no leading zero; anything else is null', () => {
  assert.strictEqual(normalizeSlot('SUN_08'), 'SUN_8');
  assert.strictEqual(normalizeSlot('SUN_8'), 'SUN_8');
  assert.strictEqual(normalizeSlot('MON_18'), 'MON_18');
  assert.strictEqual(normalizeSlot('SAT_22'), 'SAT_22');
  assert.strictEqual(normalizeSlot('SUN_07'), null);
  assert.strictEqual(normalizeSlot('SUN_23'), null);
  assert.strictEqual(normalizeSlot('sun_16'), null);
  assert.strictEqual(normalizeSlot('SUN_016'), null);
  assert.strictEqual(normalizeSlot('SUN-16'), null);
  assert.strictEqual(normalizeSlot('XYZ_16'), null);
  assert.strictEqual(normalizeSlot(16), null);
  assert.strictEqual(normalizeSlot(null), null);
  assert.strictEqual(normalizeSlot(undefined), null);
});

test('isSlot agrees with normalizeSlot on every case', () => {
  const cases = ['SUN_08', 'SUN_8', 'MON_18', 'SUN_07', 'SUN_23', 'sun_16', 'SUN_016', 'XYZ_16', '', 16, null];
  for (let i = 0; i < cases.length; i += 1) {
    assert.strictEqual(isSlot(cases[i]), normalizeSlot(cases[i]) !== null, 'case ' + String(cases[i]));
  }
});

test('makeProfile stores the canonical slot and keeps the order given', () => {
  const p = makeProfile({ role: 'student', region: 'CENTER', availability: ['MON_18', 'SUN_08', 'TUE_9'], subjects: ['MATH'] });
  assert.deepStrictEqual(p.availability.slice(), ['MON_18', 'SUN_8', 'TUE_9']);
  assert.ok(Object.isFrozen(p.availability));
});

test('makeProfile drops a repeated slot and a repeated subject, first occurrence wins', () => {
  const p = makeProfile({
    role: 'pupil', region: 'CENTER',
    availability: ['SUN_16', 'SUN_16', 'SUN_8', 'SUN_08', 'MON_18'],
    subjects: ['MATH', 'CS', 'MATH'],
    parentConsent: true
  });
  assert.deepStrictEqual(p.availability.slice(), ['SUN_16', 'SUN_8', 'MON_18']);
  assert.deepStrictEqual(p.subjects.slice(), ['MATH', 'CS']);
});

test('makeProfile still refuses a slot that is not an hour of the schedule, repeated or not', () => {
  assert.throws(() => makeProfile({ role: 'student', region: 'CENTER', availability: ['SUN_07'], subjects: ['MATH'] }),
    /invalid availability slot: SUN_07/);
  assert.throws(() => makeProfile({ role: 'student', region: 'CENTER', availability: ['SUN_16', 'SUN_16', 'SUN_0016'], subjects: ['MATH'] }),
    /invalid availability slot: SUN_0016/);
  assert.throws(() => makeProfile({ role: 'student', region: 'CENTER', availability: [], subjects: ['MATH'] }),
    /invalid availability/);
});

test('match: a student free at SUN_08 and a pupil free at SUN_8 are the same hour and are paired', () => {
  const student = makeProfile({ role: 'student', region: 'CENTER', availability: ['SUN_08'], subjects: ['MATH'] });
  const pupil = makeProfile({ role: 'pupil', region: 'CENTER', availability: ['SUN_8'], subjects: ['MATH'], parentConsent: true });
  const pairs = matchPairs([student], [pupil]);
  assert.strictEqual(pairs.length, 1);
  assert.deepStrictEqual(pairs[0].sharedSlots, ['SUN_8']);
  const why = explainUnmatched([student], [pupil], pairs);
  assert.deepStrictEqual(why, { students: [], pupils: [] });
});

test('match: a slot ticked twice does not outrank a candidate with two distinct shared hours', () => {
  const student = makeProfile({ role: 'student', region: 'CENTER', availability: ['SUN_16', 'MON_18'], subjects: ['MATH'] });
  const twice = makeProfile({ role: 'pupil', region: 'CENTER', availability: ['SUN_16', 'SUN_16'], subjects: ['MATH'], parentConsent: true });
  const two = makeProfile({ role: 'pupil', region: 'CENTER', availability: ['SUN_16', 'MON_18'], subjects: ['MATH'], parentConsent: true });
  assert.strictEqual(twice.availability.length, 1);
  const pairs = matchPairs([student], [twice, two]);
  assert.strictEqual(pairs.length, 1);
  assert.strictEqual(pairs[0].pupilIndex, 1);
  assert.deepStrictEqual(pairs[0].sharedSlots, ['MON_18', 'SUN_16']);
});

test('store: a document saved by an older build with SUN_08 loads as SUN_8', () => {
  const backend = memoryBackend();
  const key = 'peered-test';
  const doc = {
    schema: SCHEMA,
    people: [
      { role: 'student', region: 'CENTER', availability: ['SUN_08', 'SUN_08'], subjects: ['MATH', 'MATH'] },
      { role: 'pupil', region: 'CENTER', availability: ['SUN_8'], subjects: ['MATH'], parentConsent: true }
    ]
  };
  backend.setItem(key, JSON.stringify(doc));
  const store = createStore(backend, key);
  const loaded = store.load();
  assert.strictEqual(loaded.problem, null, String(loaded.problem));
  assert.deepStrictEqual(loaded.state.people[0].availability.slice(), ['SUN_8']);
  assert.deepStrictEqual(loaded.state.people[0].subjects.slice(), ['MATH']);
  const students = loaded.state.people.filter((p) => p.role === 'student');
  const pupils = loaded.state.people.filter((p) => p.role === 'pupil');
  assert.strictEqual(matchPairs(students, pupils).length, 1);
});
