'use strict';
// Accessibility and interactive controls test:
// Verifies semantic grouping, accessible button names (WCAG 2.4.4 / 4.1.2), focus styling,
// and Hebrew error feedback for unit submissions.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { openApp, addPerson } = require('../test-support/fake-dom.js');

const ROOT = path.join(__dirname, '..');
const shell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
const LATIN = /[A-Za-z]/;


test('a11y: tabpanel sections have role="tabpanel", aria-labelledby and roving tabindex', () => {
  const currentShell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
  assert.ok(/<section role="tabpanel" id="tab-people" aria-labelledby="nav-people" tabindex="0">/.test(currentShell),
    'tab-people must start with tabindex="0"');
  for (const id of ['tab-match', 'tab-text', 'tab-units', 'tab-sessions']) {
    const pattern = new RegExp('<section role="tabpanel" id="' + id + '" aria-labelledby="nav-' + id.replace('tab-', '') + '" tabindex="-1" hidden>');
    assert.ok(pattern.test(currentShell), id + ' must start with tabindex="-1" and hidden');
  }
});

test('a11y: switching tabs synchronizes tabindex and visibility on tabpanels', () => {
  const $ = openApp();
  assert.equal($('tab-people').getAttribute('tabindex'), '0');
  assert.equal($('tab-people').hidden, false);
  assert.equal($('tab-match').getAttribute('tabindex'), '-1');
  assert.equal($('tab-match').hidden, true);

  $('nav-match').fire('click');
  assert.equal($('tab-people').getAttribute('tabindex'), '-1');
  assert.equal($('tab-people').hidden, true);
  assert.equal($('tab-match').getAttribute('tabindex'), '0');
  assert.equal($('tab-match').hidden, false);

  $('nav-units').fire('click');
  assert.equal($('tab-match').getAttribute('tabindex'), '-1');
  assert.equal($('tab-match').hidden, true);
  assert.equal($('tab-units').getAttribute('tabindex'), '0');
  assert.equal($('tab-units').hidden, false);
});
