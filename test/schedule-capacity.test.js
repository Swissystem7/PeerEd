'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSchedule, findConflicts, suggestAlternatives } = require('../src/lib/schedule.js');
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
