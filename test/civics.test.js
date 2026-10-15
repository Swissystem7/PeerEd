'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { getValidRegions } = require('../src/lib/regions.js');

test('getValidRegions returns the frozen list of deployment region codes', () => {
  const regions = getValidRegions();
  assert.deepStrictEqual(regions, ['NORTH', 'HAIFA', 'CENTER', 'TEL_AVIV', 'JERUSALEM', 'SOUTH']);
  assert.ok(Object.isFrozen(regions));
});
