const test = require('node:test');
const assert = require('node:assert/strict');

test('repository skeleton exists (research-first, no product code yet)', () => {
  assert.equal(typeof require('../package.json').scripts.test, 'string');
});
