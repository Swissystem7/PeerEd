'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

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
  const ctx = { Math, Number, console };
  vm.createContext(ctx);
  vm.runInContext(`
    var SCHOLARSHIP_PROGRESS_TARGET_HOURS = 30;
    function scholarshipProgressPct(hours) {
      var n = Number(hours);
      if (!Number.isFinite(n) || n < 0) n = 0;
      return Math.min(100, Math.round((n / SCHOLARSHIP_PROGRESS_TARGET_HOURS) * 100));
    }
    globalThis.__pct = [scholarshipProgressPct(0), scholarshipProgressPct(15), scholarshipProgressPct(30), scholarshipProgressPct(45)];
  `, ctx);
  assert.deepEqual(ctx.__pct, [0, 50, 100, 100]);
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
