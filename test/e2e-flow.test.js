'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { runCoordinatorFlow, A11Y_REQUIREMENTS, checkScreenSpec, A11Y_FEATURES } = require('../src/lib/flow.js');
const { verifyExtraParity, tExtra } = require('../src/lib/lang-extra.js');

const CSV = ['role,region,subjects,availability',
  'student,CENTER,MATH;ENGLISH,SUN_8;SUN_9;MON_8',
  'student,CENTER,MATH,SUN_8',
  'pupil,CENTER,MATH,SUN_8;SUN_9',
  'pupil,CENTER,ENGLISH,SUN_9',
  'pupil,NORTH,MATH,SUN_8'].join('\n');

test('e2e: import -> match -> schedule -> semester -> attendance -> report export', () => {
  const r = runCoordinatorFlow({
    csvText: CSV,
    parentConsentPupilIndexes: [0, 1], // third pupil: no consent, must stay unmatched
    semester: { startDate: '2026-09-06', endDate: '2026-09-30', holidays: [] },
    scheduleOpts: { weeks: 2 },
    attendanceEntries: [{ pairIndex: 0, date: '2026-09-06', status: 'held' }],
    dtstamp: '20260901T000000Z'
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.matching.pairs.length, 2);
  assert.equal(r.matching.unmatchedPupils.length, 1);
  assert.ok(r.schedule.sessions.length >= 2);
  assert.ok(r.dated.sessions.length >= 2);
  assert.equal(r.report.byStatus.held, 1);
  assert.match(r.reportCsv, /status_held,,1/);
  assert.match(r.reportIcs, /BEGIN:VEVENT/);
});

test('e2e: a poisoned paste fails at the import stage, nothing downstream runs', () => {
  const r = runCoordinatorFlow({ csvText: CSV + '\nstudent,CENTER,MATH,050-1234567', semester: { startDate: '2026-09-06', endDate: '2026-09-30' } });
  assert.equal(r.ok, false); assert.equal(r.stage, 'import'); assert.match(r.error, /personal data/);
});

test('a11y spec: every new screen requires keyboard/screen-reader/360px features and has i18n titles', () => {
  assert.equal(A11Y_REQUIREMENTS.length, 8);
  for (const req of A11Y_REQUIREMENTS) {
    const good = checkScreenSpec({ screen: req.screen, features: Array.from(A11Y_FEATURES) });
    assert.equal(good.ok, true, req.screen);
    const bad = checkScreenSpec({ screen: req.screen, features: ['label'] });
    assert.equal(bad.ok, false); assert.ok(bad.missing.includes('keyboard') && bad.missing.includes('narrow-360'));
  }
  assert.equal(checkScreenSpec({ screen: 'nope', features: [] }).ok, false);
  assert.equal(verifyExtraParity().ok, true);
  for (const key of ['sched.title', 'cap.title', 'sem.title', 'rep.title', 'imp.title', 'wiz.title', 'bak.title', 'guide.title']) {
    assert.notEqual(tExtra(key, 'he'), key); assert.notEqual(tExtra(key, 'ar'), key); assert.notEqual(tExtra(key, 'ru'), key);
  }
});
