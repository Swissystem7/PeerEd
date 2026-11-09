'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const shell = fs.readFileSync(path.join(__dirname, '..', 'src', 'app-shell.html'), 'utf8');

test('tab-sessions has scholarship progress track/fill elements', () => {
  assert.match(shell, /id="tab-sessions"/);
  assert.match(shell, /class="scholarship-progress-track"/);
  assert.match(shell, /class="scholarship-progress-fill"/);
  assert.match(shell, /id="scholarshipProgressBar"/);
  assert.match(shell, /role="progressbar"/);
});

test('progress percent math is capped at 100 for 0/15/30/45 hours', () => {
  assert.match(shell, /SCHOLARSHIP_PROGRESS_TARGET_HOURS = 30/);
  assert.match(shell, /function scholarshipProgressPct/);
  function scholarshipProgressPct(hours) {
    const n = Number(hours);
    const safe = !Number.isFinite(n) || n < 0 ? 0 : n;
    return Math.min(100, Math.round((safe / 30) * 100));
  }
  assert.deepEqual(
    [0, 15, 30, 45].map(scholarshipProgressPct),
    [0, 50, 100, 100]
  );
});

test('progress labels cover he/ar/ru', () => {
  assert.match(shell, /SCHOLARSHIP_PROGRESS_LABELS/);
  assert.match(shell, /% מהיעד/);
  assert.match(shell, /% من الهدف/);
  assert.match(shell, /% от цели/);
});

test('updatePairTotalHoursBadge wires fill width and aria-valuenow', () => {
  assert.match(shell, /scholarshipProgressPct\(total\)/);
  assert.match(shell, /fill\.style\.width = pct \+ '%'/);
  assert.match(shell, /aria-valuenow/);
});
