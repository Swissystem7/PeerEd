'use strict';

const assert = require('node:assert');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { build } = require('../scripts/build-app.js');

const matchPath = path.join(__dirname, '..', 'src', 'lib', 'match.js');
const matchCode = fs.readFileSync(matchPath, 'utf8');

test('build refuses a module that requires a later module in ORDER', () => {
  const regionsCode = "'use strict';\nconst v = require('./validator.js');\nmodule.exports = { v };";
  assert.throws(() => {
    build({ modules: { regions: regionsCode } });
  }, /regions.*validator.*after/);
});

test('build refuses a require target that is not in ORDER', () => {
  const matchWithRoster = matchCode + "\nrequire('./roster.js');";
  assert.throws(() => {
    build({ modules: { match: matchWithRoster } });
  }, /match.*roster.*ORDER/);
});

test('build with only real module overrides matches the default build', () => {
  assert.strictEqual(build({ modules: { match: matchCode } }), build());
});

test('the real modules pass the order check, with or without the .js suffix', () => {
  assert.doesNotThrow(() => build());
  assert.throws(() => build({ modules: { regions: "require('./contact')" } }), /regions.*contact.*after/);
});
