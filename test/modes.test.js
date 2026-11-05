'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/lib/modes.js');
const C = require('../src/lib/curriculum.js');
const { tExtra, verifyExtraParity } = require('../src/lib/lang-extra.js');

test('modes: chips map to real profile slots and back', () => {
  assert.deepEqual(M.periodSlots('SUN', 'morning'), ['SUN_9', 'SUN_10', 'SUN_11']);
  const slots = M.chipsToSlots([{ day: 'SUN', period: 'morning' }, { day: 'MON', period: 'afternoon' }]);
  assert.deepEqual(slots, ['SUN_9', 'SUN_10', 'SUN_11', 'MON_16', 'MON_17', 'MON_18']);
  assert.deepEqual(M.slotsToChips(slots), [{ day: 'SUN', period: 'morning' }, { day: 'MON', period: 'afternoon' }]);
  assert.deepEqual(M.toggleChip(slots, 'SUN', 'morning'), ['MON_16', 'MON_17', 'MON_18']);
  assert.deepEqual(M.slotsToChips(['SUN_9']), [], 'a partial period is not a chip');
  assert.throws(() => M.periodSlots('SUN', 'night'), /invalid period/);
  assert.throws(() => M.periodSlots('XXX', 'morning'), /invalid day/);
});

test('modes: routine aggregates group by school and grade, no child fields survive', () => {
  const a = M.makeGroupAggregate({ mode: 'routine', school: 'אלון', grade: 5, count: 20 });
  assert.equal(a.key, 'אלון|5'); assert.equal(a.track, 'elementary');
  assert.equal(M.makeGroupAggregate({ mode: 'routine', school: 'אלון', grade: 8, count: 3 }).track, 'middle');
  assert.throws(() => M.makeGroupAggregate({ mode: 'routine', school: 'x', grade: 5, count: 1, name: 'y' }), /personal data is not accepted/);
  assert.throws(() => M.makeGroupAggregate({ mode: 'routine', school: 'x', grade: 2, count: 1 }), /invalid grade/);
  assert.throws(() => M.makeGroupAggregate({ mode: 'routine', school: 'x', grade: 5, count: 0 }), /invalid count/);
  const groups = M.formGroups([a]);
  assert.equal(groups.length, 1); assert.equal(groups[0].size, 20);
});

test('modes: emergency aggregates are counts at a place, chunked to 12, exact address refused', () => {
  const a = M.makeGroupAggregate({ mode: 'emergency', location: 'מקלט שכונתי', region: 'SOUTH', ageBand: '3-6', count: 25 });
  assert.equal(a.track, 'elementary');
  assert.throws(() => M.makeGroupAggregate({ mode: 'emergency', location: 'x', region: 'SOUTH', ageBand: '3-6', count: 1, address: 'רחוב 1' }), /personal data is not accepted/);
  assert.throws(() => M.makeGroupAggregate({ mode: 'emergency', location: 'x', region: 'NOPE', ageBand: '3-6', count: 1 }), /invalid region/);
  const groups = M.formGroupsWithRegion([a]);
  assert.deepEqual(groups.map((g) => g.size), [12, 12, 1]);
  assert.ok(groups.every((g) => g.regionCode === 'SOUTH'));
});

test('modes: nearby students only, unmet groups stay visible', () => {
  const groups = M.formGroupsWithRegion([
    { mode: 'emergency', location: 'א', region: 'SOUTH', ageBand: '7-9', count: 5 },
    { mode: 'emergency', location: 'ב', region: 'NORTH', ageBand: '7-9', count: 5 }
  ]);
  const r = M.assignStudents(groups, [{ region: 'SOUTH', available: 1 }, { region: 'CENTER', available: 9 }]);
  assert.equal(r.assignments.length, 1); assert.equal(r.assignments[0].region, 'SOUTH');
  assert.equal(r.unmet.length, 1); assert.equal(r.unmet[0].region, 'NORTH', 'a CENTER student is not nearby for a NORTH group');
  assert.throws(() => M.assignStudents(groups, [{ region: 'X', available: 1 }]), /invalid supply/);
});

test('modes: emergency lessons are short and unplugged, routine lessons stay 45 minutes', () => {
  const groups = M.formGroupsWithRegion([{ mode: 'emergency', location: 'א', region: 'SOUTH', ageBand: '3-6', count: 4 }]);
  const short = M.lessonForGroup(groups[0], 0);
  assert.ok(short.minutes >= 20 && short.minutes <= 30);
  assert.equal(short.flowHe.reduce((n, f) => n + f.minutes, 0), short.minutes);
  assert.equal(short.activityHe, C.getLesson('elementary', 0).unpluggedHe);
  assert.throws(() => M.shortLesson(C.getLesson('elementary', 0), 45), /invalid short lesson minutes/);
  const routine = M.formGroups([{ mode: 'routine', school: 'א', grade: 8, count: 4 }]);
  assert.equal(C.flowMinutes(M.lessonForGroup(routine[0], 0)), 45);
});

test('modes: switching mode keeps people and groups untouched', () => {
  const state = Object.freeze({ mode: 'routine', people: Object.freeze([1, 2]), groups: Object.freeze(['g']) });
  const next = M.switchMode(state, 'emergency');
  assert.equal(next.mode, 'emergency'); assert.equal(next.people, state.people); assert.equal(next.groups, state.groups);
  assert.throws(() => M.switchMode(state, 'war'), /invalid mode/);
});

test('modes: report is per school in routine and per location in emergency, CSV has counts only', () => {
  const groups = M.formGroupsWithRegion([
    { mode: 'routine', school: 'אלון', grade: 4, count: 10 },
    { mode: 'emergency', location: 'מקלט', region: 'SOUTH', ageBand: '7-9', count: 13 }
  ]);
  const assignment = M.assignStudents(groups, [{ region: 'SOUTH', available: 2 }]);
  const report = M.groupReport(groups, assignment);
  assert.equal(report.length, 2);
  const csv = M.groupReportCsv(report);
  assert.match(csv, /^mode,key,children,groups,students,unmet_groups/);
  assert.ok(csv.includes('routine')); assert.ok(csv.includes('emergency'));
});

test('modes: i18n keys exist in he, ar and ru', () => {
  assert.equal(verifyExtraParity().ok, true);
  for (const k of ['mode.routine', 'mode.emergency', 'mode.morning', 'mode.noon', 'mode.afternoon', 'mode.formGroups', 'mode.todayLesson', 'mode.emergencyBanner']) {
    assert.ok(tExtra(k, 'he') && tExtra(k, 'ar') && tExtra(k, 'ru'), k);
  }
  assert.equal(tExtra('mode.routine', 'he'), 'שגרה');
});
