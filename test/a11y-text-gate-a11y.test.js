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


test('a11y: text gate input and controls have aria attributes', () => {
  assert.ok(/<textarea id="checkText"[^>]*aria-required="true"[^>]*aria-describedby="checkStatus"/.test(shell),
    'checkText must have aria-required="true" and aria-describedby="checkStatus"');
  assert.ok(/<div id="findings"[^>]*role="region"[^>]*aria-live="polite"/.test(shell),
    'findings must have role="region" and aria-live="polite"');
  assert.ok(/<button type="button" class="ghost" id="gateBtn"[^>]*aria-label="נסה לשמור משתתף עם שדה טלפון אסור"[^>]*aria-describedby="gateStatus"/.test(shell),
    'gateBtn must have aria-label and aria-describedby="gateStatus"');
});

test('a11y: checking empty text focuses the checkText textarea and reports Hebrew error', () => {
  const $ = openApp();
  $('checkText').value = '   ';
  $('checkText').focused = false;
  $('checkBtn').fire('click');

  const status = $('checkStatus');
  assert.ok(status.className.includes('bad'), 'empty text must be rejected');
  assert.doesNotMatch(status.textContent, LATIN, 'error status should not have English letters: ' + status.textContent);
  assert.match(status.textContent, /אין טקסט לבדוק/, status.textContent);
  assert.equal($('checkText').focused, true, 'checkText must be focused on validation error');
});
