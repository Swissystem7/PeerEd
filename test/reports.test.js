'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { weeklyReport, monthlyReport, reportToCsv, reportToIcs, svgBarChart, printableHtml } = require('../src/lib/reports.js');
const { makeAttendanceLog, recordAttendance } = require('../src/lib/attendance.js');
const { makeSemester } = require('../src/lib/semester.js');
const { semesterReport } = require('../src/lib/reports.js');

function data() {
  let attendance = makeAttendanceLog();
  attendance = recordAttendance(attendance, { pairIndex: 0, date: '2026-09-06', status: 'held' });
  attendance = recordAttendance(attendance, { pairIndex: 1, date: '2026-09-07', status: 'missed' });
  attendance = recordAttendance(attendance, { pairIndex: 0, date: '2026-10-06', status: 'held' });
  return {
    attendance,
    pairs: [{ pairIndex: 0 }, { pairIndex: 1 }],
    sessions: [
      { pairIndex: 0, date: '2026-09-06', slot: 'SUN_8', subject: 'MATH', region: 'CENTER', durationMinutes: 60 },
      { pairIndex: 1, date: '2026-09-07', slot: 'MON_9', subject: 'ENGLISH', region: 'CENTER' },
      { pairIndex: 0, date: '2026-10-06', slot: 'TUE_8', subject: 'MATH', region: 'NORTH' }
    ]
  };
}

test('reports: weekly/monthly/semester windows and counts', () => {
  const d = data();
  const w = weeklyReport(d, '2026-09-06');
  assert.equal(w.scheduled, 2); assert.equal(w.byStatus.held, 1); assert.equal(w.heldRate, 0.5);
  const mo = monthlyReport(d, '2026-10');
  assert.equal(mo.scheduled, 1); assert.equal(mo.bySubject.MATH, 1);
  const sem = makeSemester({ startDate: '2026-09-01', endDate: '2026-10-31' });
  const sr = semesterReport(d, sem);
  assert.equal(sr.scheduled, 3); assert.ok(sr.stale.length >= 1);
});

test('reports: CSV sorted codes, ICS internal UID, SVG/print escape and no script', () => {
  const d = data(); const r = weeklyReport(d, '2026-09-06');
  const csv = reportToCsv(r);
  assert.ok(csv.startsWith('measure,code,count\n'));
  assert.match(csv, /subject,MATH,1/);
  const ics = reportToIcs(d.sessions, { dtstamp: '20260901T000000Z' });
  assert.match(ics, /UID:peered-0-20260906-SUN_8@peered/);
  assert.match(ics, /DTSTART:20260906T080000/);
  const svg = svgBarChart([{ code: 'MATH', count: 2 }, { code: '<x>', count: 9 }]);
  assert.ok(svg.includes('MATH') && !svg.includes('<x>'), 'unsafe code dropped');
  const html = printableHtml(r);
  assert.ok(html.includes('דוח רכז') && !/<script/i.test(html));
});
