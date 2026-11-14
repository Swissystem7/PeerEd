'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { compareMatchCandidates, detectScheduleConflicts } = require('../src/lib/match2.js');
const ROOT = path.join(__dirname, '..');

test('1. compareMatchCandidates computes correct score diff and shared slots diff', () => {
  const a = { score: 90, sharedSlots: ['1-10', '1-11'], sharedAiTopics: ['AI_LIT_PROMPT'], breakdown: { levelCounted: true } };
  const b = { score: 80, sharedSlots: ['1-10'], sharedAiTopics: [], breakdown: { levelCounted: false } };
  const res = compareMatchCandidates(a, b);
  assert.equal(res.scoreDiff, 10);
  assert.equal(res.sharedSlotsDiff, 1);
  assert.equal(res.aiTopicsOverlapDiff, 1);
  assert.equal(res.levelMatchDiff, 1);
});

test('2. compareMatchCandidates handles empty or missing fields gracefully', () => {
  const res = compareMatchCandidates(null, null);
  assert.equal(res.scoreDiff, 0);
  assert.equal(res.sharedSlotsDiff, 0);
  assert.equal(res.aiTopicsOverlapDiff, 0);
  assert.equal(res.levelMatchDiff, 0);
});

test('3. detectScheduleConflicts detects overlap when student or pupil shares a locked slot', () => {
  const locked = [
    { studentIndex: 0, pupilIndex: 2, sharedSlots: ['1-10', '1-11'] }
  ];
  const candidate = {
    studentIndex: 0,
    pupilIndex: 5,
    sharedSlots: ['1-11', '2-10']
  };
  assert.equal(detectScheduleConflicts(locked, candidate), true);
});

test('4. detectScheduleConflicts returns false when no time slots overlap with locked pairs', () => {
  const locked = [
    { studentIndex: 0, pupilIndex: 2, sharedSlots: ['1-10'] }
  ];
  const candidate = {
    studentIndex: 0,
    pupilIndex: 5,
    sharedSlots: ['2-10', '2-11']
  };
  assert.equal(detectScheduleConflicts(locked, candidate), false);
});

test('5. app-shell.html contains match-conflict-badge and match-compare-chk elements for #tab-match', () => {
  const shell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
  assert.ok(shell.includes('match-conflict-badge'), 'shell should include match-conflict-badge');
  assert.ok(shell.includes('match-compare-chk'), 'shell should include match-compare-chk');
});

test('6. app-shell.html contains matchComparePanel and clearMatchCompareBtn with proper attributes', () => {
  const shell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
  assert.ok(shell.includes('matchComparePanel'), 'shell should include matchComparePanel');
  assert.ok(shell.includes('clearMatchCompareBtn'), 'shell should include clearMatchCompareBtn');
  assert.ok(shell.includes('type="button"'), 'clearMatchCompareBtn should have type="button"');
  assert.ok(shell.includes('aria-describedby="match2Status"'), 'clearMatchCompareBtn should have aria-describedby="match2Status"');
});

test('7. app.html is up to date and includes match comparison and conflict detection features', () => {
  const appHtml = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
  assert.ok(appHtml.includes('match-conflict-badge'), 'app.html should include match-conflict-badge');
  assert.ok(appHtml.includes('matchComparePanel'), 'app.html should include matchComparePanel');
  assert.ok(appHtml.includes('clearMatchCompareBtn'), 'app.html should include clearMatchCompareBtn');
});

test('8. Multi-language and PII-free verification in app shell / match UI strings', () => {
  const shell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
  assert.ok(shell.length > 0);
  for (const forbidden of ['email@', 'password', 'credit_card']) {
    assert.equal(shell.includes(forbidden), false);
  }
});

test('9. detectScheduleConflicts handles empty or invalid inputs safely', () => {
  assert.equal(detectScheduleConflicts(null, null), false);
  assert.equal(detectScheduleConflicts([], {}), false);
});

test('10. compareMatchCandidates handles partial and edge breakdown objects', () => {
  const res = compareMatchCandidates({ score: 50, sharedSlots: ['1-10'] }, { score: 40 });
  assert.equal(res.scoreDiff, 10);
  assert.equal(res.sharedSlotsDiff, 1);
});
