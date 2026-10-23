'use strict';
// The README's "What does not exist" said there was no accessibility work beyond the tab bar's keyboard
// navigation and the contrast audit, over a screen with status lines, live regions, aria-pressed buttons and
// focus moved on errors (the a11y tests). It must name that work and still say no screen reader heard it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8').replace(/\s+/g, ' ');
const shell = fs.readFileSync(path.join(root, 'src', 'app-shell.html'), 'utf8');

test('README: does not say the only accessibility work is the tab bar and the contrast audit', () => {
  assert.doesNotMatch(readme, /no accessibility work beyond keyboard navigation/);
});

test('README: names the markup the screen carries and says no screen reader has been tried', () => {
  for (const attr of ['role="status"', 'aria-live', 'aria-pressed', 'aria-describedby']) {
    assert.ok(shell.includes(attr), 'the shell carries ' + attr);
    assert.ok(readme.includes(attr), 'the README names ' + attr);
  }
  assert.match(readme, /no screen-reader pass/);
  assert.match(readme, /test\/a11y-\*/);
});
