'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSchedule, findConflicts, suggestAlternatives, sortSlots } = require('../src/lib/schedule.js');
const { analyzeCapacity } = require('../src/lib/capacity.js');

const pair = (s, p, slots, subs) => ({ studentIndex: s, pupilIndex: p, sharedSlots: slots || ['SUN_8', 'SUN_9', 'MON_8'], sharedSubjects: subs || ['MATH'] });

test('schedule: multi-week plan, no double booking, waitlist on student clash', () => {
  const r = buildSchedule([pair(0, 0), pair(0, 1)], { weeks: 2, sessionsPerWeek: 1 });
  assert.equal(r.sessions.length, 4); // second pair moves to the next free slot, same week
  assert.deepEqual(findConflicts(r.sessions), []);
  const clash = buildSchedule([pair(0, 0, ['SUN_8']), pair(0, 1, ['SUN_8'])], { weeks: 1 });
  assert.equal(clash.waitlist.length, 1);
  assert.equal(clash.waitlist[0].reason, 'STUDENT_DOUBLE_BOOKED');
});

test('schedule: pupil over weekly cap is waitlisted, alternatives are 3 free slots', () => {
  const r = buildSchedule([pair(0, 0), pair(1, 0), pair(2, 0)], { maxSessionsPerPupilWeek: 2 });
  assert.equal(r.sessions.filter((s) => s.pupilIndex === 0).length, 2);
  assert.ok(r.waitlist.some((w) => w.reason === 'PUPIL_OVER_CAP'));
  const alts = suggestAlternatives(pair(2, 0), r.sessions.filter((s) => s.pupilIndex !== 0));
  assert.ok(alts.length >= 1 && alts.length <= 3);
  assert.equal(findConflicts([{ pairIndex: 0, studentIndex: 0, pupilIndex: 0, slot: 'SUN_8', week: 0 }, { pairIndex: 1, studentIndex: 0, pupilIndex: 1, slot: 'SUN_8', week: 0 }])[0].type, 'STUDENT_DOUBLE_BOOKED');
});

test('capacity: demand over supply alert with needed places, consent gate on demand', () => {
  const students = [{ region: 'CENTER', subjects: ['MATH'], maxPupils: 1 }];
  const pupils = [0, 1, 2].map(() => ({ region: 'CENTER', subjects: ['MATH'], parentConsent: true })).concat([{ region: 'CENTER', subjects: ['MATH'], parentConsent: false }]);
  const c = analyzeCapacity(students, pupils);
  assert.equal(c.bySubject.MATH.demand, 3);
  assert.equal(c.bySubject.MATH.supply, 1);
  assert.ok(c.alerts.some((a) => a.code === 'DEMAND_GT_SUPPLY' && a.kind === 'subject' && a.gap === 2 && a.neededStudents === 2));
  assert.match(c.alerts[0].neededStudentsNoteHe, /צריך עוד/);
  assert.equal(c.totals.pupils, 3);
});

test('sortSlots: sorts slots by day of week then hour', () => {
  assert.deepEqual(
    sortSlots(['MON_10', 'SUN_8', 'SUN_12']),
    ['SUN_8', 'SUN_12', 'MON_10']
  );
  assert.deepEqual(
    sortSlots(['THU_14', 'SUN_20', 'MON_9', 'SUN_8', 'WED_10']),
    ['SUN_8', 'SUN_20', 'MON_9', 'WED_10', 'THU_14']
  );
});

test('sortSlots: deduplicates repeated slots and discards invalid slot strings or non-slot values', () => {
  const input = ['MON_10', 'SUN_8', 'MON_10', 'SUN_8', 'INVALID_SLOT', null, undefined, 123, {}, 'SUN_99', 'NOTADAY_10'];
  assert.deepEqual(sortSlots(input), ['SUN_8', 'MON_10']);
});

test('sortSlots: gracefully handles empty or non-array input by returning an empty array', () => {
  assert.deepEqual(sortSlots([]), []);
  assert.deepEqual(sortSlots(null), []);
  assert.deepEqual(sortSlots(undefined), []);
  assert.deepEqual(sortSlots('MON_10'), []);
  assert.deepEqual(sortSlots(123), []);
  assert.deepEqual(sortSlots({}), []);
  assert.deepEqual(sortSlots(false), []);
});

test('capacity: student without explicit maxPupils defaults to capacity 1', () => {
  const students = [{ region: 'CENTER', subjects: ['MATH'] }];
  const c = analyzeCapacity(students, []);
  assert.equal(c.studentLoad[0].capacity, 1);
  assert.equal(c.bySubject.MATH.supply, 1);
  assert.equal(c.byRegion.CENTER.supply, 1);
  assert.equal(c.totals.supplyPlaces, 1);
});

test('capacity: opts.studentCapacity sets capacity fallback for students lacking maxPupils', () => {
  const students = [
    { region: 'CENTER', subjects: ['MATH'] },
    { region: 'NORTH', subjects: ['PHYSICS'], maxPupils: 5 },
  ];
  const c = analyzeCapacity(students, [], { studentCapacity: 3 });
  assert.equal(c.studentLoad[0].capacity, 3);
  assert.equal(c.studentLoad[1].capacity, 5);
  assert.equal(c.bySubject.MATH.supply, 3);
  assert.equal(c.bySubject.PHYSICS.supply, 5);
  assert.equal(c.totals.supplyPlaces, 8);
});

test('capacity: opts.newStudentCapacity is used to calculate neededStudents on gap', () => {
  const students = [{ region: 'CENTER', subjects: ['MATH'], maxPupils: 1 }];
  const pupils = Array.from({ length: 6 }, () => ({ region: 'CENTER', subjects: ['MATH'], parentConsent: true }));
  // demand = 6, supply = 1, gap = 5. With newStudentCapacity = 2, neededStudents = Math.ceil(5 / 2) = 3
  const c = analyzeCapacity(students, pupils, { newStudentCapacity: 2 });
  const alert = c.alerts.find((a) => a.kind === 'subject' && a.codeKey === 'MATH');
  assert.ok(alert);
  assert.equal(alert.gap, 5);
  assert.equal(alert.neededStudents, 3);
  assert.equal(c.bySubject.MATH.neededStudents, 3);
});

test('capacity: validation errors for invalid maxPupils or invalid studentCapacity', () => {
  assert.throws(() => analyzeCapacity([{ maxPupils: -1 }], []), /invalid maxPupils/);
  assert.throws(() => analyzeCapacity([{ maxPupils: 1.5 }], []), /invalid maxPupils/);
  assert.throws(() => analyzeCapacity([{ maxPupils: 'abc' }], []), /invalid maxPupils/);
  assert.throws(() => analyzeCapacity([{ maxPupils: NaN }], []), /invalid maxPupils/);

  assert.throws(() => analyzeCapacity([{}], [], { studentCapacity: -1 }), /invalid studentCapacity/);
  assert.throws(() => analyzeCapacity([{}], [], { studentCapacity: 2.5 }), /invalid studentCapacity/);
  assert.throws(() => analyzeCapacity([{}], [], { studentCapacity: 'abc' }), /invalid studentCapacity/);
  assert.throws(() => analyzeCapacity([{}], [], { studentCapacity: NaN }), /invalid studentCapacity/);
});
