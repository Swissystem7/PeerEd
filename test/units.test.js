'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const validator = require('../src/lib/validator.js');
const { PERSONAL_DATA_ERROR } = validator;

test('validator.makeUnit: frozen enrichment record with deterministic id and privacy gates', () => {
  assert.equal(typeof validator.makeUnit, 'function', 'validator.makeUnit is missing');

  const baseInput = {
    title: 'שברים פשוטים',
    subject: 'MATH',
    minutes: 20,
    text: 'פתרו 3 תרגילים מפרק 12'
  };
  const unit = validator.makeUnit(baseInput);
  const sameKeyOtherText = validator.makeUnit(Object.assign({}, baseInput, { text: 'טקסט אחר' }));
  const differentMinutes = validator.makeUnit(Object.assign({}, baseInput, { minutes: 25 }));

  assert.equal(unit.id, sameKeyOtherText.id);
  assert.notEqual(unit.id, differentMinutes.id);
  assert.match(unit.id, /^u-[0-9a-f]{8}$/);
  assert.equal(Object.isFrozen(unit), true);
  assert.deepEqual(Object.keys(unit).sort(), ['id', 'minutes', 'subject', 'text', 'title']);

  assert.throws(
    () => validator.makeUnit(Object.assign({}, baseInput, { teacher: '' })),
    { message: PERSONAL_DATA_ERROR }
  );
  assert.throws(
    () => validator.makeUnit(Object.assign({}, baseInput, { text: 'התקשרו 050-1234567' })),
    { message: PERSONAL_DATA_ERROR }
  );
  assert.throws(() => validator.makeUnit(Object.assign({}, baseInput, { subject: 'ART' })), /subject/);
  assert.throws(() => validator.makeUnit(Object.assign({}, baseInput, { minutes: 0 })), /minutes/);
  assert.throws(() => validator.makeUnit(Object.assign({}, baseInput, { minutes: 61 })), /minutes/);
});
