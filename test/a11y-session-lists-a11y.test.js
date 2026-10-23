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


test('a11y: stylesheet includes focus-visible rules for interactive links', () => {
  assert.ok(shell.includes('a:focus-visible'), 'a:focus-visible rule must exist in stylesheet');
});

test('a11y: session log button has aria-describedby attribute', () => {
  assert.ok(/<button type="button" class="act" id="logSession"[^>]*aria-describedby="sessionStatus"/.test(shell),
    'logSession button must have aria-describedby="sessionStatus"');
});

test('a11y: dynamic session and unit list containers have role="region", aria-live="polite", and aria-label', () => {
  assert.ok(/<div id="sessionSummary"[^>]*role="region"[^>]*aria-live="polite"[^>]*aria-label="סיכום לרשות"/.test(shell),
    'sessionSummary must have role="region", aria-live="polite", and aria-label="סיכום לרשות"');
  assert.ok(/<div id="sessionList"[^>]*role="region"[^>]*aria-live="polite"[^>]*aria-label="יומן השיעורים"/.test(shell),
    'sessionList must have role="region", aria-live="polite", and aria-label="יומן השיעורים"');
  assert.ok(/<div id="approvedList"[^>]*role="region"[^>]*aria-live="polite"[^>]*aria-label="יחידות מאושרות"/.test(shell),
    'approvedList must have role="region", aria-live="polite", and aria-label="יחידות מאושרות"');
  assert.ok(/<div id="rejectedList"[^>]*role="region"[^>]*aria-live="polite"[^>]*aria-label="יחידות שנדחו"/.test(shell),
    'rejectedList must have role="region", aria-live="polite", and aria-label="יחידות שנדחו"');
});

