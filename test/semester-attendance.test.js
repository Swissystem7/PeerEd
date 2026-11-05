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

test('attendance: statuses, duplicate refusal, two-week stale alert in Hebrew', () => {
  let log = makeAttendanceLog();
  log = recordAttendance(log, { pairIndex: 0, date: '2026-09-06', status: 'held' });
  log = recordAttendance(log, { pairIndex: 1, date: '2026-09-06', status: 'postponed' });
  assert.throws(() => recordAttendance(log, { pairIndex: 0, date: '2026-09-06', status: 'held' }), /duplicate/);
  assert.throws(() => recordAttendance(log, { pairIndex: 0, date: '2026-09-07', status: 'done' }), /status/);
  assert.equal(attendanceSummary(log).heldRate, 1);
  const stale = stalePairs([{ pairIndex: 0 }, { pairIndex: 1 }], log, '2026-09-25', { since: '2026-09-06' });
  assert.equal(stale.length, 2);
  assert.match(stale[0].alertHe, /לא נפגש/);
  assert.equal(stalePairs([{ pairIndex: 0 }], log, '2026-09-19', { since: '2026-09-06' }).length, 0); // 13 days: not yet
});
