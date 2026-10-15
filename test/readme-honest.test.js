'use strict';
// The README is the first page a reviewer or a municipality reads. It must describe what exists.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
const pitch = readme.slice(0, readme.indexOf('\n## '));

test('README: the pitch sells what is built, not enrichment units or an AI gateway', () => {
  assert.doesNotMatch(pitch, /enrichment|\bAI\b/i, pitch);
  assert.match(pitch, /match/i);
});

test('README: no stale claims about the interface or the test count', () => {
  assert.doesNotMatch(readme, /no user interface/i);
  assert.doesNotMatch(readme, /runs \d+ tests/);
  assert.match(readme, /app\.html/);
  for (const f of fs.readdirSync(path.join(__dirname, '..', 'src', 'lib'))) {
    assert.ok(readme.includes('src/lib/' + f), 'README should describe src/lib/' + f);
  }
});
