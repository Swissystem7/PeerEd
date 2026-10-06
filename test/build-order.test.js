'use strict';

const assert = require('node:assert');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { build } = require('../scripts/build-app.js');

test('build-app validates dependency order', () => {
  const regionsCode = "'use strict';\nconst v = require('./validator.js');\nmodule.exports = { v };";
  assert.throws(() => {
    build({ modules: { regions: regionsCode } });
  }, /regions.*validator.*after/);

  const matchPath = path.join(__dirname, '..', 'src', 'lib', 'match.js');
  const matchCode = fs.readFileSync(matchPath, 'utf8');
  const matchWithRoster = matchCode + "\nrequire('./roster.js');";

  assert.throws(() => {
    build({ modules: { match: matchWithRoster } });
  }, /match.*roster.*ORDER/);

  const defaultBuild = build();
  const buildWithMatch = build({ modules: { match: matchCode } });
  assert.strictEqual(buildWithMatch, defaultBuild);
});
