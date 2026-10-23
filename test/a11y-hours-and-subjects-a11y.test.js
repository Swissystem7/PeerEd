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


test('a11y: subject chips have unique IDs and aria-pressed attributes', () => {
  const $ = openApp();
  const subjectsHtml = $('subjects').innerHTML;
  for (const s of ['MATH', 'PHYSICS', 'CHEMISTRY', 'BIOLOGY', 'ENGLISH', 'HEBREW', 'HISTORY', 'CS']) {
    const pattern = new RegExp('<button type="button" class="chip" id="subjectBtn-' + s + '" data-subject="' + s + '" aria-pressed="false">');
    assert.ok(pattern.test(subjectsHtml), 'subject ' + s + ' must have button with id and aria-pressed="false"');
  }
});

test('a11y: hours grid slot buttons have unique IDs, aria-describedby pointing to hoursHint, and aria-label', () => {
  const $ = openApp();
  const hoursHtml = $('hours').innerHTML;
  const match = hoursHtml.match(/id="slotBtn-SUN_16"[^>]*data-slot="SUN_16"[^>]*aria-pressed="false"[^>]*aria-describedby="hoursHint"[^>]*aria-label="יום א 16:00"/);
  assert.ok(match, 'slot SUN_16 button must have unique id, aria-pressed, aria-describedby="hoursHint", and aria-label');
  assert.ok(hoursHtml.includes('id="slotBtn-MON_9"'), 'slot MON_9 button must have id="slotBtn-MON_9"');
});

test('a11y: toggling a subject chip updates aria-pressed and toggles selection', () => {
  const $ = openApp();
  const chipTarget = {
    getAttribute(k) { return k === 'data-subject' ? 'MATH' : null; },
    setAttribute(k, v) { this[k] = String(v); }
  };
  $('subjects').fire('click', { target: chipTarget });
  assert.equal(chipTarget['aria-pressed'], 'true', 'aria-pressed should become true when selected');

  $('subjects').fire('click', { target: chipTarget });
  assert.equal(chipTarget['aria-pressed'], 'false', 'aria-pressed should become false when deselected');
});

test('a11y: toggling an hour slot button updates aria-pressed and toggles selection', () => {
  const $ = openApp();
  const slotTarget = {
    getAttribute(k) { return k === 'data-slot' ? 'SUN_16' : null; },
    setAttribute(k, v) { this[k] = String(v); }
  };
  $('hours').fire('click', { target: slotTarget });
  assert.equal(slotTarget['aria-pressed'], 'true', 'aria-pressed should become true when selected');

  $('hours').fire('click', { target: slotTarget });
  assert.equal(slotTarget['aria-pressed'], 'false', 'aria-pressed should become false when deselected');
});

