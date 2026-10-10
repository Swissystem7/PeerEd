'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { getSlotHour } = require('../src/lib/profile.js');

test('getSlotHour returns the numeric hour from a slot string', () => {
  assert.strictEqual(typeof getSlotHour, 'function');
  assert.strictEqual(getSlotHour('SUN_16'), 16);
  assert.strictEqual(getSlotHour('MON_8'), 8);
  assert.strictEqual(getSlotHour('FRI_22'), 22);
});
