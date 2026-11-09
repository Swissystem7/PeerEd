'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeSemester, expandSessions, cancelSession, planMakeup, isTeachingDay } = require('../src/lib/semester.js');
const { makeAttendanceLog, recordAttendance, attendanceSummary, stalePairs } = require('../src/lib/attendance.js');

const sem = makeSemester({ startDate: '2026-09-06', endDate: '2026-10-15', holidays: [{ date: '2026-09-08', code: 'TEST_HOLIDAY' }] }); // starts Sunday

test('semester: teaching days skip Fri/Sat and holidays; expansion skips holiday', () => {
  assert.equal(sem.teachingDays[0], '2026-09-06');
  assert.equal(isTeachingDay(sem, '2026-09-11'), false); // Friday
  assert.equal(isTeachingDay(sem, '2026-09-08'), false); // holiday
  const ex = expandSessions([{ pairIndex: 0, slot: 'SUN_8', week: 0 }, { pairIndex: 1, slot: 'TUE_8', week: 0 }], sem);
  assert.equal(ex.sessions.length, 1);
  assert.equal(ex.sessions[0].date, '2026-09-06');
  assert.equal(ex.skipped[0].reason, 'HOLIDAY');
  assert.throws(() => makeSemester({ startDate: '2026-02-30', endDate: '2026-03-01' }), /invalid date/);
});

test('semester: cancellation on a teaching day needs makeup; makeup dates are teaching days', () => {
  const c = cancelSession({ pairIndex: 0, date: '2026-09-06', slot: 'SUN_8' }, sem);
  assert.equal(c.status, 'cancelled'); assert.equal(c.needsMakeup, true);
  const mk = planMakeup(c, sem);
  assert.ok(mk.length >= 1 && mk.every((d) => isTeachingDay(sem, d) && d > c.date));
  assert.equal(cancelSession({ pairIndex: 0, date: '2026-09-08', slot: 'TUE_8' }, sem).needsMakeup, false);
});

test('attendance: statuses, duplicate upsert, two-week stale alert in Hebrew', () => {
  let log = makeAttendanceLog();
  log = recordAttendance(log, { pairIndex: 0, date: '2026-09-06', status: 'held' });
  log = recordAttendance(log, { pairIndex: 1, date: '2026-09-06', status: 'postponed' });
  log = recordAttendance(log, { pairIndex: 0, date: '2026-09-06', status: 'missed', durationHours: 2 });
  assert.equal(log.entries.length, 2);
  assert.equal(log.entries[0].status, 'missed');
  assert.equal(log.entries[0].durationHours, 0);
  assert.equal(log.entries[1].status, 'postponed');
  assert.throws(() => recordAttendance(log, { pairIndex: 0, date: '2026-09-07', status: 'done' }), /status/);
  assert.equal(attendanceSummary(log).heldRate, 0);
  const stale = stalePairs([{ pairIndex: 0 }, { pairIndex: 1 }], log, '2026-09-25', { since: '2026-09-06' });
  assert.equal(stale.length, 2);
  assert.match(stale[0].alertHe, /לא נפגש/);
  assert.equal(stalePairs([{ pairIndex: 0 }], log, '2026-09-19', { since: '2026-09-06' }).length, 0); // 13 days: not yet
});

test('recordAttendance: validation and immutability', () => {
  const validEntry = { pairIndex: 0, date: '2026-09-06', status: 'held' };
  const log = makeAttendanceLog();

  // Throws /invalid attendance log/ when log is null, undefined, or missing an entries array
  assert.throws(() => recordAttendance(null, validEntry), /invalid attendance log/);
  assert.throws(() => recordAttendance(undefined, validEntry), /invalid attendance log/);
  assert.throws(() => recordAttendance({}, validEntry), /invalid attendance log/);
  assert.throws(() => recordAttendance({ entries: null }, validEntry), /invalid attendance log/);
  assert.throws(() => recordAttendance({ entries: 'not-array' }, validEntry), /invalid attendance log/);

  // Throws /invalid attendance: pairIndex/ when pairIndex is negative, non-integer (e.g. 1.5, '0', NaN), null, or missing
  assert.throws(() => recordAttendance(log, { pairIndex: -1, date: '2026-09-06', status: 'held' }), /invalid attendance: pairIndex/);
  assert.throws(() => recordAttendance(log, { pairIndex: 1.5, date: '2026-09-06', status: 'held' }), /invalid attendance: pairIndex/);
  assert.throws(() => recordAttendance(log, { pairIndex: '0', date: '2026-09-06', status: 'held' }), /invalid attendance: pairIndex/);
  assert.throws(() => recordAttendance(log, { pairIndex: NaN, date: '2026-09-06', status: 'held' }), /invalid attendance: pairIndex/);
  assert.throws(() => recordAttendance(log, { pairIndex: null, date: '2026-09-06', status: 'held' }), /invalid attendance: pairIndex/);
  assert.throws(() => recordAttendance(log, { pairIndex: undefined, date: '2026-09-06', status: 'held' }), /invalid attendance: pairIndex/);
  assert.throws(() => recordAttendance(log, { date: '2026-09-06', status: 'held' }), /invalid attendance: pairIndex/);

  // Throws /invalid date: expected YYYY-MM-DD/ for malformed or impossible calendar dates (e.g. '2026-02-30')
  assert.throws(() => recordAttendance(log, { pairIndex: 0, date: '2026-02-30', status: 'held' }), /invalid date: expected YYYY-MM-DD/);
  assert.throws(() => recordAttendance(log, { pairIndex: 0, date: '2026-09-31', status: 'held' }), /invalid date: expected YYYY-MM-DD/);
  assert.throws(() => recordAttendance(log, { pairIndex: 0, date: '2026-13-01', status: 'held' }), /invalid date: expected YYYY-MM-DD/);
  assert.throws(() => recordAttendance(log, { pairIndex: 0, date: 'malformed-date', status: 'held' }), /invalid date: expected YYYY-MM-DD/);
  assert.throws(() => recordAttendance(log, { pairIndex: 0, date: '06-09-2026', status: 'held' }), /invalid date: expected YYYY-MM-DD/);
  assert.throws(() => recordAttendance(log, { pairIndex: 0, status: 'held' }), /invalid date: expected YYYY-MM-DD/);

  // Verify returned log and entry objects are frozen while leaving the original log entries intact
  const origLog = makeAttendanceLog();
  const resLog = recordAttendance(origLog, { pairIndex: 0, date: '2026-09-06', status: 'held' });
  assert.equal(Object.isFrozen(resLog), true);
  assert.equal(Object.isFrozen(resLog.entries), true);
  assert.equal(Object.isFrozen(resLog.entries[0]), true);
  assert.equal(origLog.entries.length, 0);
  assert.equal(resLog.entries.length, 1);
  assert.deepEqual(resLog.entries[0], { pairIndex: 0, date: '2026-09-06', status: 'held', durationHours: 1 });
});

test('attendanceSummary: options and metrics', () => {
  // Verify it throws /invalid attendance log/ for invalid log input
  assert.throws(() => attendanceSummary(null), /invalid attendance log/);
  assert.throws(() => attendanceSummary(undefined), /invalid attendance log/);
  assert.throws(() => attendanceSummary({}), /invalid attendance log/);
  assert.throws(() => attendanceSummary({ entries: 'not-array' }), /invalid attendance log/);

  // Returns heldRate: null when decided sessions count is 0 (e.g. empty log or only postponed/cancelled)
  const emptySummary = attendanceSummary(makeAttendanceLog());
  assert.equal(emptySummary.heldRate, null);

  let undecLog = makeAttendanceLog();
  undecLog = recordAttendance(undecLog, { pairIndex: 0, date: '2026-09-01', status: 'postponed' });
  undecLog = recordAttendance(undecLog, { pairIndex: 1, date: '2026-09-02', status: 'cancelled' });
  assert.equal(attendanceSummary(undecLog).heldRate, null);

  // Rounds heldRate to 3 decimal places when decided > 0 (e.g. 1 held and 2 missed yields 0.333)
  let rateLog = makeAttendanceLog();
  rateLog = recordAttendance(rateLog, { pairIndex: 0, date: '2026-09-01', status: 'held' });
  rateLog = recordAttendance(rateLog, { pairIndex: 0, date: '2026-09-02', status: 'missed' });
  rateLog = recordAttendance(rateLog, { pairIndex: 0, date: '2026-09-03', status: 'missed' });
  assert.equal(attendanceSummary(rateLog).heldRate, 0.333);

  // Populates byStatus and byPair counters for all statuses
  let allStatusLog = makeAttendanceLog();
  allStatusLog = recordAttendance(allStatusLog, { pairIndex: 0, date: '2026-09-01', status: 'held' });
  allStatusLog = recordAttendance(allStatusLog, { pairIndex: 0, date: '2026-09-02', status: 'missed' });
  allStatusLog = recordAttendance(allStatusLog, { pairIndex: 1, date: '2026-09-03', status: 'postponed' });
  allStatusLog = recordAttendance(allStatusLog, { pairIndex: 1, date: '2026-09-04', status: 'cancelled' });
  const allSummary = attendanceSummary(allStatusLog);
  assert.deepEqual(allSummary.byStatus, { held: 1, missed: 1, postponed: 1, cancelled: 1 });
  assert.deepEqual(allSummary.byPair[0], { held: 1, missed: 1, postponed: 0, cancelled: 0 });
  assert.deepEqual(allSummary.byPair[1], { held: 0, missed: 0, postponed: 1, cancelled: 1 });

  // Filters entries correctly when opts.from, opts.to, or both are supplied
  let dateLog = makeAttendanceLog();
  dateLog = recordAttendance(dateLog, { pairIndex: 0, date: '2026-09-01', status: 'held' });
  dateLog = recordAttendance(dateLog, { pairIndex: 0, date: '2026-09-05', status: 'held' });
  dateLog = recordAttendance(dateLog, { pairIndex: 0, date: '2026-09-10', status: 'held' });
  dateLog = recordAttendance(dateLog, { pairIndex: 0, date: '2026-09-15', status: 'held' });

  const fromSummary = attendanceSummary(dateLog, { from: '2026-09-05' });
  assert.equal(fromSummary.byStatus.held, 3);
  assert.equal(fromSummary.byPair[0].held, 3);

  const toSummary = attendanceSummary(dateLog, { to: '2026-09-05' });
  assert.equal(toSummary.byStatus.held, 2);
  assert.equal(toSummary.byPair[0].held, 2);

  const rangeSummary = attendanceSummary(dateLog, { from: '2026-09-05', to: '2026-09-10' });
  assert.equal(rangeSummary.byStatus.held, 2);
  assert.equal(rangeSummary.byPair[0].held, 2);
});

test('stalePairs: edge cases and ordering', () => {
  const log = makeAttendanceLog();

  // Input validation throws on invalid log or invalid asOfISO / opts.since date
  assert.throws(() => stalePairs([], null, '2026-09-20'), /invalid attendance log/);
  assert.throws(() => stalePairs([], undefined, '2026-09-20'), /invalid attendance log/);
  assert.throws(() => stalePairs([], {}, '2026-09-20'), /invalid attendance log/);
  assert.throws(() => stalePairs([], log, '2026-02-30'), /invalid date: expected YYYY-MM-DD/);
  assert.throws(() => stalePairs([], log, 'not-a-date'), /invalid date: expected YYYY-MM-DD/);
  assert.throws(() => stalePairs([], log, '2026-09-20', { since: '2026-02-30' }), /invalid date: expected YYYY-MM-DD/);
  assert.throws(() => stalePairs([], log, '2026-09-20', { since: 'not-a-date' }), /invalid date: expected YYYY-MM-DD/);

  // Verify pairs are sorted primarily by daysSince descending and tie-broken by pairIndex ascending
  let sortLog = makeAttendanceLog();
  sortLog = recordAttendance(sortLog, { pairIndex: 2, date: '2026-09-01', status: 'held' });
  sortLog = recordAttendance(sortLog, { pairIndex: 1, date: '2026-09-11', status: 'held' });
  sortLog = recordAttendance(sortLog, { pairIndex: 3, date: '2026-09-11', status: 'held' });
  const sorted = stalePairs([{ pairIndex: 3 }, { pairIndex: 1 }, { pairIndex: 2 }], sortLog, '2026-10-01');
  assert.deepEqual(sorted.map((s) => ({ pairIndex: s.pairIndex, daysSince: s.daysSince })), [
    { pairIndex: 2, daysSince: 30 },
    { pairIndex: 1, daysSince: 20 },
    { pairIndex: 3, daysSince: 20 }
  ]);

  // Verify custom opts.days threshold is respected
  let threshLog = makeAttendanceLog();
  threshLog = recordAttendance(threshLog, { pairIndex: 0, date: '2026-09-10', status: 'held' });
  // asOf 2026-09-20 -> gap is 10 days
  assert.equal(stalePairs([{ pairIndex: 0 }], threshLog, '2026-09-20').length, 0); // default is 14 days
  assert.equal(stalePairs([{ pairIndex: 0 }], threshLog, '2026-09-20', { days: 10 }).length, 1);
  assert.equal(stalePairs([{ pairIndex: 0 }], threshLog, '2026-09-20', { days: 11 }).length, 0);

  // Verify fallback to array index when pair objects lack an explicit pairIndex
  const fallbackPairs = [{}, { label: 'pair-one' }, null];
  const fallbackRes = stalePairs(fallbackPairs, log, '2026-09-20', { since: '2026-09-01' });
  assert.equal(fallbackRes.length, 3);
  assert.equal(fallbackRes[0].pairIndex, 0);
  assert.equal(fallbackRes[1].pairIndex, 1);
  assert.equal(fallbackRes[2].pairIndex, 2);

  // Verify pairs with no held sessions and no opts.since baseline are safely omitted
  let noHeldLog = makeAttendanceLog();
  noHeldLog = recordAttendance(noHeldLog, { pairIndex: 0, date: '2026-09-01', status: 'missed' });
  noHeldLog = recordAttendance(noHeldLog, { pairIndex: 0, date: '2026-09-02', status: 'postponed' });
  noHeldLog = recordAttendance(noHeldLog, { pairIndex: 0, date: '2026-09-03', status: 'cancelled' });
  assert.deepEqual(stalePairs([{ pairIndex: 0 }, { pairIndex: 1 }], noHeldLog, '2026-09-20'), []);
  let mixedLog = recordAttendance(noHeldLog, { pairIndex: 0, date: '2026-09-04', status: 'held' });
  const mixedRes = stalePairs([{ pairIndex: 0 }, { pairIndex: 1 }], mixedLog, '2026-09-20');
  assert.equal(mixedRes.length, 1);
  assert.equal(mixedRes[0].pairIndex, 0);
});
