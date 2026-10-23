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


test('a11y: wipe device controls have aria attributes and manage aria-expanded and focus', () => {
  const currentShell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
  assert.ok(/<button type="button" class="ghost" id="wipeBtn"[^>]*aria-expanded="false"[^>]*aria-controls="wipeCancel wipeStatus"[^>]*aria-describedby="wipeStatus"/.test(currentShell),
    'wipeBtn must have aria-expanded="false", aria-controls="wipeCancel wipeStatus", and aria-describedby="wipeStatus"');
  assert.ok(/<button type="button" class="ghost" id="wipeCancel"[^>]*aria-label="בטל מחיקה מהמכשיר"[^>]*aria-describedby="wipeStatus"/.test(currentShell),
    'wipeCancel must have aria-label="בטל מחיקה מהמכשיר" and aria-describedby="wipeStatus"');

  const $ = openApp();
  assert.equal($('wipeBtn').getAttribute('aria-expanded'), 'false');
  assert.equal($('wipeCancel').hidden, true);

  // Arm wipe
  $('wipeBtn').fire('click');
  assert.equal($('wipeBtn').getAttribute('aria-expanded'), 'true');
  assert.equal($('wipeCancel').hidden, false);

  // Cancel wipe
  $('wipeBtn').focused = false;
  $('wipeCancel').fire('click');
  assert.equal($('wipeBtn').getAttribute('aria-expanded'), 'false');
  assert.equal($('wipeCancel').hidden, true);
  assert.equal($('wipeBtn').focused, true, 'focus must be restored to wipeBtn upon cancellation');
});
