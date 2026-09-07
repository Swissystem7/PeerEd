const test = require('node:test');
const assert = require('node:assert/strict');

// TODO(agent): replace this placeholder with the real tests for regions, profile and match.
test('peered module scaffolding is loadable', () => {
  assert.equal(typeof require('../src/lib/regions.js'), 'object');
  assert.equal(typeof require('../src/lib/profile.js'), 'object');
  assert.equal(typeof require('../src/lib/match.js'), 'object');
});
