'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const attendance = require('../src/lib/attendance.js');

const shell = fs.readFileSync(path.join(__dirname, '..', 'src', 'app-shell.html'), 'utf8');

test('tab-sessions has zero-hours empty-state hint element', () => {
  assert.match(shell, /id="tab-sessions"/);
  assert.match(shell, /id="pairZeroHoursHint"/);
  assert.match(shell, /PAIR_ZERO_HOURS_HINT/);
  assert.match(shell, /טרם נרשמו שעות מאושרות לזוג זה/);
});

test('zero-hours hint covers Hebrew, Arabic, and Russian', () => {
  assert.match(shell, /טרם נרשמו שעות מאושרות לזוג זה/);
  assert.match(shell, /لم تُسجَّل بعد ساعات معتمدة لهذا الزوج/);
  assert.match(shell, /Для этой пары ещё не записаны подтверждённые часы/);
});

test('updatePairTotalHoursBadge hides the hint when total hours rise above zero', () => {
  assert.match(shell, /if \(total > 0\)/);
  assert.match(shell, /hint\.hidden = true/);
  assert.match(shell, /hint\.hidden = false/);
  assert.match(shell, /pairZeroHoursHintText/);
});

test('held session hours for a pair rise above zero (transition path)', () => {
  const records = [
    { pairIndex: 0, status: 'held', durationHours: 1 },
  ];
  assert.equal(attendance.calculatePairHours([], 0), 0);
  assert.equal(attendance.calculatePairHours(records, 0), 1);
});
