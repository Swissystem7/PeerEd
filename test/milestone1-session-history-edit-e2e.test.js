'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const attendance = require('../src/lib/attendance.js');
const session = require('../src/lib/session.js');

test('milestone1 1: filterAttendanceRecords filters by status', () => {
  const records = [
    { pairIndex: 0, date: '2025-01-01', status: 'held', durationHours: 1 },
    { pairIndex: 0, date: '2025-01-02', status: 'missed', durationHours: 1 }
  ];
  const filtered = attendance.filterAttendanceRecords(records, { status: 'held' });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].status, 'held');
});

test('milestone1 2: filterAttendanceRecords filters by pairIndex', () => {
  const records = [
    { pairIndex: 0, date: '2025-01-01', status: 'held', durationHours: 1 },
    { pairIndex: 1, date: '2025-01-01', status: 'held', durationHours: 1 }
  ];
  const filtered = attendance.filterAttendanceRecords(records, { pairIndex: 1 });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].pairIndex, 1);
});

test('milestone1 3: filterAttendanceRecords filters by aiTopic', () => {
  const records = [
    { pairIndex: 0, date: '2025-01-01', status: 'held', durationHours: 1, aiTopic: 'AI_LIT_PROMPT' },
    { pairIndex: 0, date: '2025-01-02', status: 'held', durationHours: 1, aiTopic: 'AI_CREATIVE' }
  ];
  const filtered = attendance.filterAttendanceRecords(records, { aiTopic: 'AI_CREATIVE' });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].aiTopic, 'AI_CREATIVE');
});

test('milestone1 4: getPairSessionTimeline returns chronologically sorted records', () => {
  const log = {
    entries: [
      { pairIndex: 0, date: '2025-01-05', status: 'held', durationHours: 1 },
      { pairIndex: 0, date: '2025-01-02', status: 'held', durationHours: 1 }
    ]
  };
  const timeline = attendance.getPairSessionTimeline(log, 0);
  assert.equal(timeline.length, 2);
  assert.equal(timeline[0].date, '2025-01-02');
  assert.equal(timeline[1].date, '2025-01-05');
});

test('milestone1 5: updateSessionOutcome updates status, duration and aiTopic successfully', () => {
  const log = attendance.makeAttendanceLog();
  const logged = attendance.recordAttendance(log, {
    pairIndex: 0,
    date: '2025-01-01',
    status: 'missed'
  });
  const updated = attendance.updateSessionOutcome(logged, 0, '2025-01-01', {
    status: 'held',
    durationHours: 2.0,
    aiTopic: 'AI_LIT_PROMPT'
  });
  assert.equal(updated.entries.length, 1);
  assert.equal(updated.entries[0].status, 'held');
  assert.equal(updated.entries[0].durationHours, 2.0);
  assert.equal(updated.entries[0].aiTopic, 'AI_LIT_PROMPT');
});

test('milestone1 test 1: filterAttendanceRecords filters correctly by status', () => {
  const records = [
    { pairIndex: 0, date: '2025-01-01', status: 'held', durationHours: 1 },
    { pairIndex: 0, date: '2025-01-02', status: 'missed', durationHours: 1 }
  ];
  const res = attendance.filterAttendanceRecords(records, { status: 'held' });
  assert.equal(res.length, 1);
  assert.equal(res[0].status, 'held');
});

test('milestone1 test 2: filterAttendanceRecords filters correctly by pairIndex', () => {
  const records = [
    { pairIndex: 0, date: '2025-01-01', status: 'held', durationHours: 1 },
    { pairIndex: 1, date: '2025-01-01', status: 'held', durationHours: 1 }
  ];
  const res = attendance.filterAttendanceRecords(records, { pairIndex: 1 });
  assert.equal(res.length, 1);
  assert.equal(res[0].pairIndex, 1);
});

test('milestone1 test 3: filterAttendanceRecords filters correctly by aiTopic', () => {
  const records = [
    { pairIndex: 0, date: '2025-01-01', status: 'held', durationHours: 1, aiTopic: 'AI_LIT_PROMPT' },
    { pairIndex: 0, date: '2025-01-02', status: 'held', durationHours: 1, aiTopic: 'AI_CREATIVE' }
  ];
  const res = attendance.filterAttendanceRecords(records, { aiTopic: 'AI_CREATIVE' });
  assert.equal(res.length, 1);
  assert.equal(res[0].aiTopic, 'AI_CREATIVE');
});

test('milestone1 test 4: getPairSessionTimeline returns chronologically sorted entries', () => {
  const log = {
    entries: [
      { pairIndex: 0, date: '2025-01-10', status: 'held', durationHours: 1 },
      { pairIndex: 0, date: '2025-01-02', status: 'held', durationHours: 1 }
    ]
  };
  const timeline = attendance.getPairSessionTimeline(log, 0);
  assert.equal(timeline.length, 2);
  assert.equal(timeline[0].date, '2025-01-02');
  assert.equal(timeline[1].date, '2025-01-10');
});

test('milestone1 test 5: updateSessionOutcome updates status, duration, and aiTopic', () => {
  const log = attendance.makeAttendanceLog();
  const recorded = attendance.recordAttendance(log, {
    pairIndex: 0,
    date: '2025-01-01',
    status: 'missed'
  });
  const updated = attendance.updateSessionOutcome(recorded, 0, '2025-01-01', {
    status: 'held',
    durationHours: 2.5,
    aiTopic: 'AI_STEM_CODE'
  });
  assert.equal(updated.entries.length, 1);
  assert.equal(updated.entries[0].status, 'held');
  assert.equal(updated.entries[0].durationHours, 2.5);
  assert.equal(updated.entries[0].aiTopic, 'AI_STEM_CODE');
});

test('milestone1 test 6: app.html contains session history filter elements and tab', () => {
  const appHtml = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
  assert.ok(appHtml.includes('sessionHistoryStatusFilter'));
  assert.ok(appHtml.includes('sessionHistoryCount'));
  assert.ok(appHtml.includes('sessionHistoryEmpty'));
  assert.ok(appHtml.includes('tab-sessions'));
});

test('milestone1 test 7: scholarship report reflects updated attendance metrics correctly', () => {
  const log = attendance.makeAttendanceLog();
  const recorded = attendance.recordAttendance(log, {
    pairIndex: 0,
    date: '2025-01-01',
    status: 'held',
    durationHours: 1.0
  });
  const updated = attendance.updateSessionOutcome(recorded, 0, '2025-01-01', {
    status: 'held',
    durationHours: 3.0
  });
  const report = attendance.buildScholarshipReport(updated, [{ pairIndex: 0, studentIndex: 1, pupilIndex: 2 }], 30);
  assert.equal(report.summary.totalHours, 3.0);
  assert.equal(report.pairs[0].totalHours, 3.0);
});

test('milestone1 test 8: zero PII and multi-language support present for session history elements', () => {
  const appShell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
  assert.ok(appShell.includes('sessionHistoryStatusFilter'));
  assert.ok(appShell.includes('הכל') || appShell.includes('الكل') || appShell.includes('Все'));
});
test('milestone1 test 6: app.html contains session history filter elements and tab', () => {
  const appHtml = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
  assert.ok(appHtml.includes('sessionHistoryStatusFilter'));
  assert.ok(appHtml.includes('sessionHistoryCount'));
  assert.ok(appHtml.includes('sessionHistoryEmpty'));
  assert.ok(appHtml.includes('tab-sessions'));
});

test('milestone1 test 7: scholarship report reflects updated attendance metrics correctly', () => {
  const log = attendance.makeAttendanceLog();
  const recorded = attendance.recordAttendance(log, {
    pairIndex: 0,
    date: '2025-01-01',
    status: 'held',
    durationHours: 1.0
  });
  const updated = attendance.updateSessionOutcome(recorded, 0, '2025-01-01', {
    status: 'held',
    durationHours: 3.0
  });
  const report = attendance.buildScholarshipReport(updated, [{ pairIndex: 0, studentIndex: 1, pupilIndex: 2 }], 30);
  assert.equal(report.summary.totalHours, 3.0);
  assert.equal(report.pairs[0].totalHours, 3.0);
});

test('milestone1 test 8: zero PII and multi-language support present for session history elements', () => {
  const appShell = fs.readFileSync(path.join(ROOT, 'src', 'app-shell.html'), 'utf8');
  assert.ok(appShell.includes('sessionHistoryStatusFilter'));
  assert.ok(appShell.includes('הכל') || appShell.includes('الكل') || appShell.includes('Все'));
});
