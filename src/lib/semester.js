'use strict';
// PeerEd - semester calendar (stage 3). Static Israeli school-holiday table (major breaks, 2025-2027);
// the coordinator may pass an explicit holidays list which replaces it. Dates are caller-passed
// YYYY-MM-DD strings; weekday math is UTC, so the same input always gives the same output.

const { DAYS } = require('./profile.js');

// A *_BREAK code written twice is a range: both written dates and every day between them are holidays,
// so a "break" is never just its two endpoints. (Break ranges are school-break approximations; a
// coordinator overrides the whole list per semester when the official calendar differs.)
function expandBreaks(rows) {
  const out = [];
  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i]; const next = rows[i + 1];
    if (/_BREAK$/.test(r.code) && next && next.code === r.code && next.date > r.date) {
      const end = new Date(next.date + 'T00:00:00Z');
      for (let d = new Date(r.date + 'T00:00:00Z'); d <= end; d.setUTCDate(d.getUTCDate() + 1)) out.push({ date: d.toISOString().slice(0, 10), code: r.code });
      i += 1;
    } else out.push(r);
  }
  return out;
}
const HOLIDAYS_IL = Object.freeze(expandBreaks([
  { date: '2025-09-23', code: 'ROSH_HASHANA' }, { date: '2025-09-24', code: 'ROSH_HASHANA' },
  { date: '2025-10-02', code: 'YOM_KIPPUR' }, { date: '2025-10-07', code: 'SUKKOT' }, { date: '2025-10-14', code: 'SUKKOT' },
  { date: '2025-12-16', code: 'HANUKKAH_BREAK' }, { date: '2025-12-23', code: 'HANUKKAH_BREAK' },
  { date: '2026-03-03', code: 'PURIM' }, { date: '2026-03-25', code: 'PESACH_BREAK' }, { date: '2026-04-08', code: 'PESACH_BREAK' },
  { date: '2026-04-22', code: 'YOM_HAATZMAUT' }, { date: '2026-05-21', code: 'SHAVUOT' },
  { date: '2026-10-02', code: 'ROSH_HASHANA' }, { date: '2026-10-03', code: 'ROSH_HASHANA' },
  { date: '2026-10-11', code: 'YOM_KIPPUR' }, { date: '2026-10-16', code: 'SUKKOT' }, { date: '2026-10-23', code: 'SUKKOT' }
]).map(Object.freeze));

function parseDate(iso) {
  const m = typeof iso === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error('invalid date: expected YYYY-MM-DD');
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (d.toISOString().slice(0, 10) !== iso) throw new Error('invalid date: expected YYYY-MM-DD');
  return d;
}
function fmt(d) { return d.toISOString().slice(0, 10); }
function addDays(iso, n) { const d = parseDate(iso); d.setUTCDate(d.getUTCDate() + n); return fmt(d); }
function diffDays(a, b) { return Math.round((parseDate(b) - parseDate(a)) / 86400000); }
function weekday(iso) { return parseDate(iso).getUTCDay(); } // 0=Sunday

function makeSemester(input) {
  const o = input || {};
  parseDate(o.startDate); parseDate(o.endDate);
  if (diffDays(o.startDate, o.endDate) < 0) throw new Error('invalid semester: endDate is before startDate');
  const holidays = Object.freeze((Array.isArray(o.holidays) ? o.holidays : HOLIDAYS_IL).map((h) => {
    parseDate(h && h.date); if (!h || typeof h.code !== 'string' || !/^[A-Z0-9_]+$/.test(h.code)) throw new Error('invalid holiday entry');
    return Object.freeze({ date: h.date, code: h.code });
  }));
  const set = new Set(holidays.map((h) => h.date));
  const teachingDays = [];
  for (let d = o.startDate, i = 0, n = diffDays(o.startDate, o.endDate); i <= n; i += 1, d = addDays(o.startDate, i)) {
    const wd = weekday(d);
    if (wd >= 0 && wd <= 4 && !set.has(d)) teachingDays.push(d); // Sun-Thu teaching week
  }
  return Object.freeze({ startDate: o.startDate, endDate: o.endDate, holidays, teachingDays: Object.freeze(teachingDays) });
}
function isTeachingDay(semester, iso) { parseDate(iso); return semester.teachingDays.indexOf(iso) !== -1; }
function holidayOn(semester, iso) { const h = semester.holidays.find((x) => x.date === iso); return h ? h.code : null; }

// schedule sessions carry {slot:'SUN_8', week:n}. Expand them onto real dates of the semester.
function expandSessions(sessions, semester) {
  const dated = []; const skipped = [];
  (Array.isArray(sessions) ? sessions : []).forEach((s, index) => {
    const m = s && /^([A-Z]{3})_/.exec(s.slot || ''); const dayIdx = m ? DAYS.indexOf(m[1]) : -1;
    if (dayIdx < 0 || !Number.isInteger(s.week)) { skipped.push({ index, reason: 'INVALID_SESSION' }); return; }
    const base = addDays(semester.startDate, s.week * 7);
    let date = null;
    for (let i = 0; i < 7; i += 1) { const cand = addDays(base, i); if (weekday(cand) === dayIdx) { date = cand; break; } }
    if (date === null || diffDays(semester.endDate, date) > 0) { skipped.push({ index, reason: 'OUT_OF_SEMESTER' }); return; }
    if (!isTeachingDay(semester, date)) { skipped.push({ index, date, reason: holidayOn(semester, date) ? 'HOLIDAY' : 'NON_TEACHING_DAY' }); return; }
    dated.push(Object.assign({}, s, { date }));
  });
  return Object.freeze({ sessions: Object.freeze(dated), skipped: Object.freeze(skipped) });
}
function cancelSession(session, semester) {
  if (!session || !session.date) throw new Error('invalid session: expected a dated session');
  const onHoliday = semester ? !isTeachingDay(semester, session.date) : false;
  return Object.freeze(Object.assign({}, session, { status: 'cancelled', needsMakeup: !onHoliday }));
}
// Up to 3 makeup dates: same weekday as the cancelled session, teaching days after it.
function planMakeup(cancelled, semester, opts) {
  const limit = opts && Number.isInteger(opts.limit) ? Math.min(3, Math.max(0, opts.limit)) : 3;
  const out = []; if (!cancelled || !cancelled.date) return out;
  const wd = weekday(cancelled.date);
  for (let i = 7; i <= 56 && out.length < limit; i += 7) { const d = addDays(cancelled.date, i); if (isTeachingDay(semester, d) && diffDays(d, semester.endDate) >= 0) out.push(d); }
  return out;
}

module.exports = { HOLIDAYS_IL, makeSemester, isTeachingDay, holidayOn, expandSessions, cancelSession, planMakeup, addDays, diffDays, parseDate };
