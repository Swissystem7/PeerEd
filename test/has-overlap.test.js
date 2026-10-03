'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { hasOverlap } = require('../src/lib/match');

test('hasOverlap returns true when timeslots share at least one identical string', () => {
  assert.strictEqual(typeof hasOverlap, 'function');
  assert.strictEqual(hasOverlap(['SUN_16'], ['SUN_16', 'MON_18']), true);
  assert.strictEqual(hasOverlap(['SUN_16', 'MON_18'], ['SUN_16']), true);
  assert.strictEqual(hasOverlap(['TUE_10', 'WED_12'], ['MON_18', 'WED_12']), true);
});

test('hasOverlap returns false when there is no overlap', () => {
  assert.strictEqual(typeof hasOverlap, 'function');
  assert.strictEqual(hasOverlap(['SUN_16'], ['MON_18']), false);
  assert.strictEqual(hasOverlap([], ['SUN_16']), false);
  assert.strictEqual(hasOverlap(['SUN_16'], []), false);
  assert.strictEqual(hasOverlap([], []), false);
  assert.strictEqual(hasOverlap(null, ['SUN_16']), false);
  assert.strictEqual(hasOverlap(['SUN_16'], undefined), false);
});
