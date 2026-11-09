'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { emptyState, serialize, deserialize } = require('../src/lib/store.js');
const { makeAttendanceLog, recordAttendance } = require('../src/lib/attendance.js');

test('app-shell initializes attendance as a bare array', () => {
  const shell = fs.readFileSync(path.join(__dirname, '..', 'src', 'app-shell.html'), 'utf8');
  assert.match(shell, /var state = \{ people: \[\], queue: null, log: null, attendance: \[\]/);
  assert.match(shell, /attendance: \[\], pairs: \[\]/);
  // report bridge may wrap { entries: state.attendance } for reports.js; state itself stays a bare array
});

test('emptyState attendance is an array', () => {
  const s = emptyState();
  assert.ok(Array.isArray(s.attendance));
});

test('recordAttendance entries can be assigned to state.attendance array', () => {
  let log = makeAttendanceLog();
  log = recordAttendance(log, { pairIndex: 0, date: '2026-09-06', status: 'held' });
  const attendance = log.entries.slice();
  assert.ok(Array.isArray(attendance));
  assert.equal(attendance.length, 1);
  assert.equal(attendance[0].durationHours, 1);
});

test('store roundtrip keeps bare attendance array', () => {
  let log = makeAttendanceLog();
  log = recordAttendance(log, { pairIndex: 1, date: '2026-09-07', status: 'missed', durationHours: 2 });
  const state = Object.freeze({
    people: Object.freeze([]),
    queue: emptyState().queue,
    log: emptyState().log,
    attendance: log.entries,
  });
  const back = deserialize(serialize(state));
  assert.ok(Array.isArray(back.attendance));
  assert.equal(back.attendance.length, 1);
  assert.deepEqual(back.attendance[0], {
    pairIndex: 1, date: '2026-09-07', status: 'missed', durationHours: 0,
  });
});
