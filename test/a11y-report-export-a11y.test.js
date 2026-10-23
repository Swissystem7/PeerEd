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


test('a11y: report export controls have aria attributes and manage aria-expanded and focus', () => {
  const currentShell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
  assert.ok(/<button type="button" class="ghost" id="exportReport"[^>]*aria-expanded="false"[^>]*aria-controls="reportBox reportStatus"[^>]*aria-describedby="reportStatus"/.test(currentShell),
    'exportReport must have aria-expanded="false", aria-controls="reportBox reportStatus", and aria-describedby="reportStatus"');
  assert.ok(/<textarea id="reportText"[^>]*aria-describedby="reportStatus"/.test(currentShell),
    'reportText must have aria-describedby="reportStatus"');

  const $ = openApp();
  const exportBtn = $('exportReport');
  assert.equal(exportBtn.getAttribute('aria-expanded'), 'false');
  assert.equal($('reportBox').hidden, true);

  exportBtn.fire('click');
  assert.equal(exportBtn.getAttribute('aria-expanded'), 'true');
  assert.equal($('reportBox').hidden, false);
  assert.equal($('reportText').focused, true, 'reportText must receive focus upon export');
  assert.equal($('reportText').selected, true, 'reportText must be selected for easy copying');
  assert.match($('reportStatus').textContent, /הדוח מוכן/);

  // Wiping device resets reportBox and aria-expanded
  $('wipeBtn').fire('click'); // arm
  $('wipeBtn').fire('click'); // confirm wipe
  assert.equal($('reportBox').hidden, true);
  assert.equal(exportBtn.getAttribute('aria-expanded'), 'false');
});
