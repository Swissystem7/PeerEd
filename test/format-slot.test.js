'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { formatSlotHebrew } = require('../src/lib/profile.js');

test('formatSlotHebrew correctly formats time slots like SUN_16 to Hebrew representation א 16:00', () => {
  assert.strictEqual(typeof formatSlotHebrew, 'function');
  assert.strictEqual(formatSlotHebrew('SUN_16'), 'א 16:00');
  assert.strictEqual(formatSlotHebrew('MON_18'), 'ב 18:00');
  assert.strictEqual(formatSlotHebrew('TUE_10'), 'ג 10:00');
  assert.strictEqual(formatSlotHebrew('WED_14'), 'ד 14:00');
  assert.strictEqual(formatSlotHebrew('THU_20'), 'ה 20:00');
  assert.strictEqual(formatSlotHebrew('FRI_12'), 'ו 12:00');
  assert.strictEqual(formatSlotHebrew('SAT_21'), 'ש 21:00');
});

test('formatSlotHebrew throws on invalid slot input', () => {
  assert.strictEqual(typeof formatSlotHebrew, 'function');
  assert.throws(() => formatSlotHebrew('INVALID'), /invalid slot/);
  assert.throws(() => formatSlotHebrew('SUN_07'), /invalid slot/);
  assert.throws(() => formatSlotHebrew('SUN_23'), /invalid slot/);
  assert.throws(() => formatSlotHebrew(null), /invalid slot/);
  assert.throws(() => formatSlotHebrew(123), /invalid slot/);
});
