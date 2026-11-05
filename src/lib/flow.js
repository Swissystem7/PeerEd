'use strict';
// PeerEd - the coordinator flow end to end (stage 8): import -> match -> schedule -> semester ->
// attendance -> report export. Pure composition of the stage modules; a failure names its stage and
// stops, nothing partial is reported as success. Consent is granted out-of-band by the coordinator
// (parentConsentPupilIndexes): imported pupils start without it, exactly as the import gate leaves them.

const { parseAvailabilityCsv } = require('./import-availability.js');
const { setParentConsent } = require('./profile.js');
const { match2 } = require('./match2.js');
const { buildSchedule } = require('./schedule.js');
const { makeSemester, expandSessions } = require('./semester.js');
const { makeAttendanceLog, recordAttendance } = require('./attendance.js');
const { semesterReport, reportToCsv, reportToIcs } = require('./reports.js');

function runCoordinatorFlow(input) {
  const o = input || {};
  let stage = 'import';
  try {
    const imported = parseAvailabilityCsv(o.csvText);
    const students = []; const pupils = [];
    imported.profiles.forEach((p) => { (p.role === 'student' ? students : pupils).push(p); });
    stage = 'consent';
    (Array.isArray(o.parentConsentPupilIndexes) ? o.parentConsentPupilIndexes : []).forEach((i) => {
      if (pupils[i]) pupils[i] = setParentConsent(pupils[i], true);
    });
    stage = 'match';
    const matching = match2(students, pupils, o.matchOpts || {});
    stage = 'schedule';
    const schedule = buildSchedule(matching.pairs, Object.assign({}, o.scheduleOpts, { students, pupils }));
    stage = 'semester';
    const semester = makeSemester(o.semester || {});
    const dated = expandSessions(schedule.sessions, semester);
    stage = 'attendance';
    let attendance = makeAttendanceLog();
    (Array.isArray(o.attendanceEntries) ? o.attendanceEntries : []).forEach((e) => { attendance = recordAttendance(attendance, e); });
    stage = 'report';
    const sessions = dated.sessions.map((s, i) => Object.assign({}, s, {
      pairIndex: Number.isInteger(s.pairIndex) ? s.pairIndex : i,
      region: (students[s.studentIndex] || {}).region || null
    }));
    const pairs = matching.pairs.map((p, i) => ({ pairIndex: i }));
    const report = semesterReport({ sessions, attendance, pairs }, semester);
    // ok means complete: any refused import row, waitlisted pair or skipped session is surfaced, not hidden
    const counts = Object.freeze({ importErrors: imported.errors.length, waitlisted: schedule.waitlist.length, unscheduled: schedule.unscheduled.length, skipped: dated.skipped.length });
    const complete = counts.importErrors === 0 && counts.waitlisted === 0 && counts.skipped === 0;
    return Object.freeze({
      ok: complete, partial: !complete, counts, imported, matching, schedule, semester, dated, attendance, report,
      reportCsv: reportToCsv(report), reportIcs: reportToIcs(sessions, { dtstamp: o.dtstamp })
    });
  } catch (e) {
    return Object.freeze({ ok: false, stage, error: String(e && e.message || e) });
  }
}

// Accessibility contract for the new screens (stage 8). Data, not rendering: the shell must satisfy
// every requirement per screen; checkScreenSpec is what a screen declaration is verified against.
const A11Y_SCREENS = Object.freeze(['schedule', 'capacity', 'semester', 'reports', 'import', 'wizard', 'backup', 'guide']);
const A11Y_FEATURES = Object.freeze(['label', 'keyboard', 'live-region', 'focus-visible', 'min-target-44', 'narrow-360']);
const A11Y_REQUIREMENTS = Object.freeze(A11Y_SCREENS.map((screen) => Object.freeze({ screen, needs: A11Y_FEATURES })));

function checkScreenSpec(spec) {
  const s = spec || {};
  const req = A11Y_REQUIREMENTS.find((r) => r.screen === s.screen);
  if (!req) return Object.freeze({ ok: false, missing: Object.freeze(['unknown-screen']) });
  const have = Array.isArray(s.features) ? s.features : [];
  const missing = req.needs.filter((f) => have.indexOf(f) === -1);
  return Object.freeze({ ok: missing.length === 0, screen: s.screen, missing: Object.freeze(missing) });
}

module.exports = { runCoordinatorFlow, A11Y_SCREENS, A11Y_FEATURES, A11Y_REQUIREMENTS, checkScreenSpec };
