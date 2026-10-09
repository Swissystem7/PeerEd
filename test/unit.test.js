'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeUnit, unitId, DURATION_MIN, DURATION_MAX, TITLE_MAX_LENGTH } = require('../src/lib/unit.js');
const { PERSONAL_DATA_ERROR, PROFANITY_ERROR } = require('../src/lib/validator.js');

const GOOD = Object.freeze({
  title: 'משוואות ריבועיות - נוסחת השורשים',
  subject: 'MATH',
  durationMinutes: 20,
  body: 'פותרים 3 משוואות: x^2 - 5x + 6 = 0 ועוד שתיים. בסוף שאלה אחת לבד.'
});

test('unit: a valid submission becomes a frozen record whose id is a hash of title+subject+duration', () => {
  const unit = makeUnit(GOOD);
  assert.equal(Object.isFrozen(unit), true);
  assert.deepEqual(Object.keys(unit).sort(), ['body', 'durationMinutes', 'id', 'subject', 'title']);
  assert.match(unit.id, /^u-[0-9a-f]{16}$/);
  assert.equal(unit.id, unitId(GOOD.title, GOOD.subject, GOOD.durationMinutes));
  assert.equal(unit.title, GOOD.title);
  assert.equal(unit.body, GOOD.body);
});

test('unit: the id is deterministic and stable across runs', () => {
  // Pinned value: if the hash or the key layout changes, every id a municipality has on file breaks.
  assert.equal(unitId('Quadratic equations', 'MATH', 20), 'u-e8281b3a2f2f8f08');
  assert.equal(makeUnit(GOOD).id, makeUnit(Object.assign({}, GOOD)).id);
});

test('unit: title spacing and case do not make a new unit; the body does not either', () => {
  const base = makeUnit(GOOD).id;
  assert.equal(makeUnit(Object.assign({}, GOOD, { title: '  משוואות   ריבועיות - נוסחת השורשים ' })).id, base);
  assert.equal(makeUnit(Object.assign({}, GOOD, { body: 'גרסה מתוקנת של הטקסט.' })).id, base);
  assert.equal(unitId('Quadratic Equations', 'MATH', 20), unitId('quadratic equations', 'MATH', 20));
});

test('unit: a different title, subject or duration is a different unit', () => {
  const base = makeUnit(GOOD).id;
  assert.notEqual(makeUnit(Object.assign({}, GOOD, { title: GOOD.title + ' ב' })).id, base);
  assert.notEqual(makeUnit(Object.assign({}, GOOD, { subject: 'PHYSICS' })).id, base);
  assert.notEqual(makeUnit(Object.assign({}, GOOD, { durationMinutes: 25 })).id, base);
  // the separator keeps the fields apart: moving characters between title and duration is not the same key
  assert.notEqual(unitId('a1', 'MATH', 5), unitId('a', 'MATH', 15));
});

test('unit: any key outside the accepted fields is refused with the profile gate message', () => {
  for (const extra of [{ author: 'x' }, { school: '' }, { email: 'a@b.co' }, { teacherId: 1 }]) {
    assert.throws(() => makeUnit(Object.assign({}, GOOD, extra)), { message: PERSONAL_DATA_ERROR });
  }
});

test('unit: personal data or offensive language in title or body is refused', () => {
  assert.throws(() => makeUnit(Object.assign({}, GOOD, { body: 'שאלות אליי: 050-1234567' })),
    { message: PERSONAL_DATA_ERROR });
  assert.throws(() => makeUnit(Object.assign({}, GOOD, { title: 'שיעור עם moreh@school.org' })),
    { message: PERSONAL_DATA_ERROR });
  assert.throws(() => makeUnit(Object.assign({}, GOOD, { body: 'מי שלא פותר הוא מטומטם' })),
    { message: PROFANITY_ERROR });
});

test('unit: subject, duration, title and body are validated', () => {
  assert.throws(() => makeUnit(Object.assign({}, GOOD, { subject: 'ART' })), /invalid subject/);
  assert.throws(() => makeUnit(Object.assign({}, GOOD, { subject: 'math' })), /invalid subject/);
  for (const d of [DURATION_MIN - 1, DURATION_MAX + 1, 20.5, '20', NaN]) {
    assert.throws(() => makeUnit(Object.assign({}, GOOD, { durationMinutes: d })), /invalid durationMinutes/);
  }
  assert.throws(() => makeUnit(Object.assign({}, GOOD, { title: '' })), /too short/);
  assert.throws(() => makeUnit(Object.assign({}, GOOD, { title: 'a'.repeat(TITLE_MAX_LENGTH + 1) })), /too long/);
  assert.throws(() => makeUnit(Object.assign({}, GOOD, { title: 'two\nlines' })), /single line/);
  assert.throws(() => makeUnit(Object.assign({}, GOOD, { body: '   ' })), /too short/);
  assert.throws(() => makeUnit(Object.assign({}, GOOD, { body: 42 })), /invalid body/);
  for (const bad of [null, [], 'x', undefined]) assert.throws(() => makeUnit(bad), /unit input must be an object/);
});

test('unit: the stored text is the cleaned text, so the id is computed on what is kept', () => {
  const unit = makeUnit(Object.assign({}, GOOD, { title: ' כותרת \t עם  רווחים ', body: 'שורה 1 \n  שורה 2 ' }));
  assert.equal(unit.title, 'כותרת עם רווחים');
  assert.equal(unit.body, 'שורה 1\nשורה 2');
  assert.equal(unit.id, unitId('כותרת עם רווחים', 'MATH', 20));
});
