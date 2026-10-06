'use strict';
// Screen-reader checks on the app shell. A <label> with no control and a row of identical "מחק" buttons
// both look fine on screen and are unusable by ear, so they are pinned here.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const shell = fs.readFileSync(path.join(__dirname, '..', 'src', 'app-shell.html'), 'utf8');

test('every <label> points at a control that exists', () => {
  const labels = shell.match(/<label\b[^>]*>/g) || [];
  assert.ok(labels.length > 0);
  for (const tag of labels) {
    const m = tag.match(/\bfor="([^"]+)"/);
    assert.ok(m, 'label without for=: ' + tag);
    assert.ok(shell.includes('id="' + m[1] + '"'), 'label for="' + m[1] + '" has no matching control');
  }
});

test('the subject chips and the hours grid are named groups', () => {
  for (const id of ['subjects', 'hours']) {
    const tag = (shell.match(new RegExp('<div[^>]*\\bid="' + id + '"[^>]*>')) || [''])[0];
    assert.match(tag, /role="group"/, id + ' should be role="group"');
    const by = tag.match(/aria-labelledby="([^"]+)"/);
    assert.ok(by, id + ' should have aria-labelledby');
    assert.ok(shell.includes('id="' + by[1] + '"'), id + ' is labelled by a missing element');
  }
});

test('each delete button names the participant it removes', () => {
  assert.match(shell, /data-del="' \+ i \+ '" aria-label="' \+\s*esc\('מחק ' \+ who\)/);
});
